import type { Department, NocodeUser, Role } from "@common/types/account";
import axios from "axios";
import { ElMessage } from "element-plus";
import i18next from "i18next";
import { defineStore } from "pinia";
import { ref } from "vue";

export type OrganizeUsersParams = {
  projectId?: string;
  nocodeId?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  accountIds?: string[];
  roleIds?: string[];
  departmentIds?: string[];
  isAdmin?: boolean;
  status?: "active" | "resigned" | "all";
  id?: string;
  ids?: string[];
};

export const useOrganizeCacheStore = defineStore("organizeCache", () => {
  const users = ref<NocodeUser[]>([]);
  const roles = ref<Role[]>([]);
  const departments = ref<Department[]>([]);
  const loaded = ref(false);
  let pending: Promise<void> | null = null;

  const load = async (force = false) => {
    if (loaded.value && !force) return;
    if (!pending) {
      pending = Promise.all([
        axios.get("/workbench/get-user-list"),
        axios.get("/workbench/get-role-list"),
        axios.get("/workbench/get-department-list"),
      ]).then(([usersRes, rolesRes, departmentsRes]) => {
        users.value = usersRes.data || [];
        roles.value = rolesRes.data || [];
        departments.value = departmentsRes.data || [];
        loaded.value = true;
      }).catch((error) => {
        ElMessage.error(error?.response?.data?.message || error?.message || i18next.t("organizeCache.loadFailed"));
      }).finally(() => {
        pending = null;
      });
    }
    await pending;
  };

  const getUsers = async (params?: OrganizeUsersParams) => {
    await load();
    let result = users.value;
    const hasSelectors = !!(
      params?.accountIds?.length
      || params?.roleIds?.length
      || params?.departmentIds?.length
    );
    if (hasSelectors) {
      result = result.filter(user => (
        !!params?.accountIds?.includes(user.id)
        || !!params?.roleIds?.some(roleId => user.roles?.includes(roleId))
        || !!params?.departmentIds?.some(departmentId => user.departments?.includes(departmentId))
      ));
    }
    if (params?.isAdmin !== undefined) {
      result = result.filter(user => !!user.isAdmin === params.isAdmin);
    }
    if (params?.status && params.status !== "all") {
      result = result.filter(user => params.status === "resigned"
        ? !!(user as NocodeUser & { resigned?: boolean }).resigned
        : !(user as NocodeUser & { resigned?: boolean }).resigned);
    }
    if (params?.search) {
      const search = params.search.toLowerCase();
      result = result.filter(user => `${user.user || ""} ${user.realname || ""}`.toLowerCase().includes(search));
    }
    const total = result.length;
    if (params?.pageSize) {
      const page = Math.max(params.page || 1, 1);
      result = result.slice((page - 1) * params.pageSize, page * params.pageSize);
    }
    return { users: result, total };
  };

  const getRoles = async () => {
    await load();
    return roles.value;
  };

  const getDepartments = async () => {
    await load();
    return departments.value;
  };

  const invalidate = () => {
    loaded.value = false;
  };

  return {
    users,
    roles,
    departments,
    allUsers: users,
    loaded,
    load,
    getUsers,
    getRoles,
    getDepartments,
    invalidate,
  };
});
