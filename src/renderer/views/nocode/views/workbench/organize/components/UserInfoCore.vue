<template>
  <div class="user-info-core">
    <el-form :model="userInfo" label-position="top" ref="formRef" :rules="rules">
      <el-form-item :label="$t('UserInfoCore.account')" prop="user">
        <el-input v-model="userInfo.user" :placeholder="$t('UserInfoCore.inputAccount')" :disabled="!userInputEnable()"></el-input>
      </el-form-item>
      <el-form-item :label="$t('UserInfoCore.password')" prop="pass">
        <el-input v-model="userInfo.pass" :placeholder="$t('UserInfoCore.inputPassword')" type="password"
          :show-password="props.type === 'add'"></el-input>
      </el-form-item>
      <el-form-item :label="$t('UserInfoCore.name')" prop="realname">
        <el-input v-model="userInfo.realname" :placeholder="$t('UserInfoCore.inputName')"></el-input>
      </el-form-item>
      <el-form-item :label="$t('UserInfoCore.jobNumber')" prop="staffNo">
        <el-input v-model="userInfo.staffNo" :placeholder="$t('UserInfoCore.inputJobNumber')"></el-input>
      </el-form-item>
      <el-form-item :label="$t('UserInfoCore.phone')" prop="phone">
        <el-input v-model="userInfo.phone" :placeholder="$t('UserInfoCore.inputPhone')"></el-input>
      </el-form-item>
      <el-form-item :label="$t('UserInfoCore.email')" prop="email">
        <el-input v-model="userInfo.email" :placeholder="$t('UserInfoCore.inputEmail')"></el-input>
      </el-form-item>
      <el-form-item :label="$t('UserInfoCore.department')" prop="departments">
        <workbench-tree-select v-model="userInfo.departments" :data="departmentTree" :multiple="true"
          :placeholder="$t('UserInfoCore.selectDept')" theme="light" />
      </el-form-item>
      <el-form-item :label="$t('UserInfoCore.relatedRole')" prop="roles">
        <workbench-select v-model="userInfo.roles" :options="roleList" :multiple="true" :placeholder="$t('UserInfoCore.selectRelatedRole')"
          theme="light" />
      </el-form-item>
    </el-form>
  </div>
</template>

<script lang='ts' setup>
import { ORGANIZE_UTIL } from '@renderer/types';
import { buildTree } from '@renderer/views/nocode/utils';
import { FormInstance } from 'element-plus';
import { computed, inject, ref, unref } from 'vue';
import { usePassportStore } from '@renderer/stores';
import { ADMIN_USERNAME } from "@common/types/account";
import i18next from 'i18next';

const passportState = usePassportStore();

const props = defineProps<{
  type: 'add' | 'edit',
}>();

const organizeUtil = inject(ORGANIZE_UTIL);
const formRef = ref<FormInstance>();

const userInfo = ref({
  user: '',
  pass: '',
  realname: '',
  roles: [],
  departments: [],
  staffNo: '',
  phone: '',
  email: '',
});

const rules = computed(() => ({
  user: [{ required: true, message: i18next.t('UserInfoCore.inputAccountTips'), trigger: 'blur' }],
  pass: props.type === 'add'
    ? [{ required: true, message: i18next.t('UserInfoCore.inputPasswordTips'), trigger: 'blur' }]
    : [],
  realname: [{ required: true, message: i18next.t('UserInfoCore.inputNameTips'), trigger: 'blur' }],
}))

const roleList = computed(() => {
  const roles = organizeUtil.roles.map((role) => {
    role["label"] = role["name"];
    role["value"] = role["id"];
    return role;
  });
  return roles;
});

const departmentTree = computed(() => {
  const tree = buildTree(organizeUtil.departments.map(item => {
    return {
      ...item,
      label: item.name,
      value: item.id
    }
  }));
  return tree;
});

const userInputEnable = () => {
  const account = passportState.account
  if(account.user === ADMIN_USERNAME || props.type === 'add') return true
  if(account.isAdmin && !(userInfo.value as any).isAdmin) {
    return true
  }
  return false
}


defineExpose({
  validate: (...args: Parameters<typeof formRef.value.validate>) => {
    formRef.value.validate(...args);
  },
  serialize: () => {
    return unref(userInfo.value);
  },
  deserialize: (data: typeof userInfo.value) => {
    Object.assign(userInfo.value, data);
  },
  reset: () => {
    userInfo.value = {
      user: '',
      pass: '',
      realname: '',
      roles: [],
      departments: [],
      staffNo: '',
      phone: '',
      email: '',
    }
  }
})

</script>

<style lang='scss' scoped>
.user-info-core {
  .el-form {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    justify-content: space-between;

    .el-form-item {
      width: 308px;
      height: 65px;
      margin: unset;

      :deep(.el-form-item__label) {
        &:before {
          margin-left: -8px;
        }
      }

      :deep(.el-input__wrapper) {
        border-radius: 4px;
        background-color: var(--bg-color-overlay);
        box-shadow: unset;

        &:hover {
          box-shadow: 0 0 0 1px var(--border-color) inset;
        }

        &.is-focus {
          box-shadow: 0 0 0 1px var(--el-input-focus-border-color) inset !important;
        }

        .el-input__inner {
          font-size: 14px;
          height: 32px;

          &::placeholder {
            font-size: 14px;
          }
        }
      }

      :deep(.el-select__wrapper) {
        border-radius: 4px;
        background-color: var(--bg-color-page);
        box-shadow: 0 0 0 1px var(--border-color) inset;

        &:hover {
          box-shadow: 0 0 0 1px var(--border-color) inset;
        }

        &.is-focused {
          box-shadow: 0 0 0 1px var(--color-primary) inset !important;
        }

        .el-select__inner {
          font-size: 14px;
          height: 32px;

          &::placeholder {
            font-size: 14px;
          }
        }

        .el-tag {
          padding-left: 8px;
          padding-right: 4px;
          border: none;
          --el-tag-text-color: var(--text-color-regular);

          .el-tag__content {
            font-size: 14px;
          }

          .el-tag__close {
            font-size: 16px;
          }
        }
      }
    }
  }
}
</style>
