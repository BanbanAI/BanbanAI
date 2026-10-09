import axios from 'axios'
import { ElMessage } from 'element-plus';
import { ManageCategory, TodoDataId } from '@common/types/project';
import { NocodeUser, Department, Role } from '@common/types/account';
import i18next from 'i18next';


type EditUserParams = NocodeUser & {
  projectId?: string,
  nocodeId?: string,
}

type AddUserToDepartmentParams = {
  departmentId?: string,
  userIds: string[],
}

type AddUserToRoleParams = {
  roleId?: string,
  userIds: string[],
}

type UpdateDepartmentParentParams = {
  departmentId: string,
  parentId: string,
}


type RemoveUserParams = {
  projectId?: string,
  nocodeId?: string,
  id?: string,
  ids?: string[],
}

type AddRoleParams = {
  name: string,
  parent?: string,
  isGroup?: boolean,
  userIds?: string[],
} & {
  projectId?: string,
  nocodeId?: string,
}

type EditRoleParams = Role & {
  projectId?: string,
  nocodeId?: string,
}

type RemoveRoleParams = {
  projectId?: string,
  nocodeId?: string,
  id?: string,
  isGroup?: boolean,
}

type EditDepartmentParams = Department & {
  projectId?: string,
  nocodeId?: string,
}

type RemoveDepartmentParams = {
  projectId?: string,
  nocodeId?: string,
  id?: string,
}

type EditDepartmentManagersParams = {
  id?: string,
  nocodeId?: string,
  managers?: string[],
}

type GetSharingParams = {
  nocodeId?: string,
}

type AddUserAsAdminParams = {
  ids: string[],
}

type RemoveUserAsAdminParams = {
  id: string,
}

export const globalOrganize = {
  async addUser(params: EditUserParams) {
    return await axios.post('/workbench/add-user', { user: params })
    .then(res => res.data)
    .catch(err => {
      ElMessage.error(err.response.data.message);
      throw err;
    });
  },

  async addUserToDepartment(params: AddUserToDepartmentParams) {
    return await axios.post('/workbench/add-user-to-department', params)
    .then(res => {
      ElMessage.success(i18next.t('nocodeUtilsApi.addSuccess'));
      return res.data;
    })
    .catch(err => {
      ElMessage.error(err.response.data.message);
      throw err;
    });
  },

  async addUserToRole(params: AddUserToRoleParams) {
    return await axios.post('/workbench/add-user-to-role', params)
    .then(res => {
      ElMessage.success(i18next.t('nocodeUtilsApi.addSuccess'));
      return res.data;
    })
    .catch(err => {
      ElMessage.error(err.response.data.message);
      throw err;
    });
  },

  async addRole(params: AddRoleParams) {
    return await axios.post('/workbench/add-role', params)
    .then(res => res.data)
    .catch(err => ElMessage.error(err.response.data.message));
  },

  async addDepartment(params?: EditDepartmentParams) {
    return await axios.post('/workbench/add-department', { department: params })
    .then(res => res.data)
    .catch(err => ElMessage.error(err.response.data.message));
  },

  async updateDepartmentParent(params: UpdateDepartmentParentParams) {
    return await axios.post('/workbench/update-department-parent', params)
    .then(res => {
      ElMessage.success(i18next.t('nocodeUtilsApi.editSuccess'));
      return res.data;
    })
    .catch(err => {
      ElMessage.error(err.response.data.message);
      throw err;
    });
  },

  async updateUser(params: EditUserParams) {
    return await axios.post('/workbench/update-user', { user: params })
    .then(res => res.data)
    .catch(err => {
      ElMessage.error(err.response.data.message);
      throw err;
    });
  },

  async updateRole(params: EditRoleParams) {
    return await axios.post('/workbench/update-role', { role: params })
    .then(res => res.data)
    .catch(err => ElMessage.error(err.response.data.message));
  },

  async updateDepartment(params: EditDepartmentParams) {
    return await axios.post('/workbench/update-department', { department: params })
    .then(res => res.data)
    .catch(err => ElMessage.error(err.response.data.message));
  },

  async updateDepartmentManagers(params: EditDepartmentManagersParams) {
    return await axios.post('/workbench/update-department-managers', params)
    .then(res => res.data)
    .catch(err => ElMessage.error(err.response.data.message));
  },

  async removeUserPermanently(params: RemoveUserParams) {
    return await axios.post('/workbench/remove-user-permanently', { id: params?.id })
    .then(res => res.data)
    .catch(err => {
      ElMessage.error(err.response.data.message);
      throw err;
    });
  },

  async removeUserPermanentlyList(params: RemoveUserParams) {
    return await axios.post('/workbench/remove-user-permanently-list', { ids: params?.ids })
    .then(res => res.data)
    .catch(err => {
      ElMessage.error(err.response.data.message);
      throw err;
    });
  },

  async removeRole(params: RemoveRoleParams) {
    const url = params?.isGroup ? '/workbench/remove-role-group' : '/workbench/remove-role';
    return await axios.post(url, { id: params?.id })
    .then(res => res.data)
    .catch(err => ElMessage.error(err.response.data.message));
  },

  async removeDepartment(params: RemoveDepartmentParams) {
    return await axios.post('/workbench/remove-department', { id: params?.id })
    .then(res => res.data)
    .catch(err => ElMessage.error(err.response.data.message));
  },

  async getSharingNocodes(params: GetSharingParams) {
    return await axios.get(`/project/get-sharing-nocodes`)
    .then(res => res.data)
    .catch(err => ElMessage.error(err.response.data.message));
  },

  async getSharingReports(params: GetSharingParams) {
    return await axios.get(`/project/get-sharing-reports`)
    .then(res => res.data)
    .catch(err => ElMessage.error(err.response.data.message));
  },

  async setAdmins(params: AddUserAsAdminParams) {
    return await axios.post(`/workbench/set-admins`, params)
    .then(res => res.data)
    .catch(err => ElMessage.error(err.response.data.message));
  },

  async removeUserAsAdmin(params: RemoveUserAsAdminParams) {
    return await axios.post(`/workbench/remove-user-as-admin`, params)
    .then(res => {
      ElMessage.success(i18next.t('nocodeUtilsApi.delSuccess'));
      return res.data;
    })
    .catch(err => ElMessage.error(err.response.data.message));
  },

}

