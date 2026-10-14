<template>
  <organize-manager-dialog
    ref="dialogRef"
    :is-in-widget="true"
    :multiple="multiple"
    :current-type="currentType"
    :dialog-title="dialogTitle"
    :table-list="tableList"
    :available-value="availableValue"
    :is-available="isAvailable"
    @confirm="handleConfirm"
    @update:model-value="handleDialogVisibility"
  />
</template>

<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import type { Account, Department, Role } from "@common/types/account";
import type { Department as DepartmentWidget } from "../../departmentSelect/department";
import type { Member } from "../../memberSelect/member";
import { usePassportStore } from "@renderer/stores/passport";
import { normalizeRuntimeOrganizeIds, resolveRuntimeOrganizeValue } from "../runtime/organization-runtime";
import i18next from "@renderer/widgets/i18next";

type OrganizeWidget = DepartmentWidget | Member;
type OrganizeList = {
  departments: Department[];
  users: Account[];
  roles: Role[];
  dynamic: string[];
};

const props = defineProps<{
  widget: OrganizeWidget | null;
  modelValue: boolean;
  value: unknown;
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void;
  (event: "commit", value: string[]): void;
  (event: "cancel"): void;
}>();

const dialogRef = ref<{ show?: () => void } | null>(null);
const tableList = ref<OrganizeList>({ departments: [], users: [], roles: [], dynamic: [] });
const availableValue = ref<OrganizeList>({ departments: [], users: [], roles: [], dynamic: [] });
const loading = ref(false);
const committed = ref(false);
const passportState = usePassportStore();

const currentType = computed(() => props.widget?.currentType || "member");
const multiple = computed(() => props.widget?.isMultiple !== false);
const dialogTitle = computed(() => currentType.value === "department"
  ? i18next.t("subFormSelectDepartment")
  : i18next.t("subFormSelectMember"));
const isAvailable = computed(() => props.widget?.getOption("select-range") === true
  && props.widget?.getOption("range-type") === "custom");

const emptyList = (): OrganizeList => ({ departments: [], users: [], roles: [], dynamic: [] });

const flatten = (items: Department[] = []) => {
  const result: Department[] = [];
  const visit = (list: Department[]) => {
    for (const item of list) {
      result.push(item);
      if (item.children?.length) visit(item.children);
    }
  };
  visit(items);
  return result;
};

const selectedEntities = <T extends { id?: string }>(ids: string[], list: T[]) => ids
  .map(id => list.find(item => item.id === id) || ({ id, name: id } as T))
  .filter(item => Boolean(item.id));

const prepare = async () => {
  const widget = props.widget;
  if (!widget || loading.value) return;
  loading.value = true;
  try {
    const board = widget.getBoard();
    const [departments, users, roles] = await Promise.all([
      board.getOrganizeDepartments(),
      board.getOrganizeUsers(),
      board.getOrganizeRoles(),
    ]);
    const allDepartments = flatten(departments || []);
    const allUsers = (users || []) as Account[];
    const allRoles = (roles || []) as Role[];
    widget.allDepartmentsList = allDepartments;
    widget.allUserList = allUsers;
    widget.allRolesList = allRoles;

    const selectedIds = normalizeRuntimeOrganizeIds(props.value);
    const next = emptyList();
    if (currentType.value === "member") next.users = selectedEntities(selectedIds, allUsers);
    else next.departments = selectedEntities(selectedIds, allDepartments);
    tableList.value = next;

    const custom = isAvailable.value ? (currentType.value === "member"
      ? widget.availableUserList?.users
      : widget.availableDepartmentsList?.departments) : undefined;
    availableValue.value = {
      departments: currentType.value === "department" ? (custom || []) as Department[] : [],
      users: currentType.value === "member" ? (custom || []) as Account[] : [],
      roles: [],
      dynamic: [],
    };
  } finally {
    loading.value = false;
  }
};

const handleConfirm = (value: OrganizeList) => {
  committed.value = true;
  emit("commit", resolveRuntimeOrganizeValue({
    currentType: currentType.value,
    multiple: multiple.value,
    data: value,
    currentAccount: passportState.account,
  }));
};

const handleDialogVisibility = (value: boolean) => {
  if (!value && !committed.value) emit("cancel");
  emit("update:modelValue", value);
};

watch(() => props.modelValue, async visible => {
  if (!visible) return;
  committed.value = false;
  await prepare();
  if (props.modelValue) dialogRef.value?.show?.();
}, { immediate: true });
</script>
