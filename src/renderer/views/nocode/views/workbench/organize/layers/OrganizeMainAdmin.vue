<template>
  <div class="organize-main-admin">
    <div class="admin-content">
      <workbench-admin-list v-if="mode === 'admin'" :contentList="userList" :totalNumber="totalNumber" :pageInfo="pageInfo"
        @updatePageInfo="updatePageInfo">
        <div class="user-search">
          <el-input size="large" class="search-input" v-model="searchValue" :placeholder="$t('OrganizeMainAdmin.inputContentTips')"
            @change="getUserList">
            <template #prefix>
              <el-icon class="el-input__icon"><i-workbench-search /></el-icon>
            </template>
          </el-input>
        </div>
      </workbench-admin-list>
      <div class="company-info" v-else>
        <el-form :model="formData" :rules="rules" ref="formRef" hide-required-asterisk>
          <el-form-item :label="'logo：'" v-if="false">
            <el-image :src="formData.logoScr" v-if="formData.logoScr"></el-image>
            <div v-else class="logo"></div>
            <div class="edit-logo" @click="">{{ $t('OrganizeMainAdmin.modify') }}</div>
          </el-form-item>
          <el-form-item :label="$t('OrganizeMainAdmin.enterpriseNameLabel')" prop="name" :rules="companyNameRules">
            <el-input v-model="companyName" :readonly="!passportState.companyNameEditable"></el-input>
          </el-form-item>
          <el-form-item>
            <el-button
              @click="handleSaveCompanyInfo"
              class="submit-button"
              type="primary"
              :loading="isCompanyInfoLoading || isSavingCompanyInfo"
              :disabled="isCompanyInfoLoading"
            >
              {{ $t('OrganizeMainAdmin.save') }}
            </el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup lang='ts'>
import { NOCODE_ID, ORGANIZE_UTIL } from '@renderer/types';
import { ElMessage, FormItemRule } from 'element-plus';
import { ref, computed, inject, onMounted } from 'vue';
import { ADMIN_USERNAME } from '@common/types/account';
import { usePassportStore, useSettingStore } from '@renderer/stores';
import i18next from 'i18next';

const organizeUtil = inject(ORGANIZE_UTIL);
const nocodeId = inject(NOCODE_ID);
const passportState = usePassportStore();
const settingState = useSettingStore();

const emit = defineEmits<{
  (e: 'updatePageInfo', page: number, pageSize: number): void;
}>();
const formRef = ref();
const formData = ref({
  logoScr: '',
  name: null,
});
const isCompanyInfoLoading = ref(true);
const isSavingCompanyInfo = ref(false);
const initialCompanyName = ref('');
const isCompanyNameDirty = ref(false);

const props = withDefaults(defineProps<{
  mode?: 'admin' | 'company'
}>(), {
  mode: 'admin'
});

const companyName = computed({
  get() {
    if (!passportState.companyNameEditable) {
      return settingState.companyName;
    }
    return formData.value.name ?? settingState.companyName;
  },
  set(val) {
    if (!passportState.companyNameEditable) return;
    isCompanyNameDirty.value = true;
    formData.value.name = val;
  }
})

const rules = ref({
})

const companyNameRules: FormItemRule[] = [
  {
    required: true,
    validator(rule, value, callback, source, options) {
      if (!passportState.companyNameEditable) return callback();
      if (!companyName.value) {
        return callback(new Error(i18next.t('nocodeLoginDialog.notCompanyNameTip')));
      }
      callback();
    },
    trigger: 'blur'
  }
]

const userList = ref([]);
const searchValue = ref("");
const totalNumber = ref(0);
const pageInfo = ref({
  page: 1,
  pageSize: 20,
})

const getUserList = async () => {
  const data = await organizeUtil.getUserByOptions({
    nocodeId,
    page: pageInfo.value.page,
    pageSize: pageInfo.value.pageSize,
    search: searchValue.value,
    isAdmin: true,
  }).catch((err) => {
    ElMessage.error(err.message);
  });

  if (data) {
    userList.value = [
      {
        id: 1,
        user: ADMIN_USERNAME,
        realname: ADMIN_USERNAME,
      },
      ...data.users
    ];
    totalNumber.value = data.total;
  }

}

getUserList();

const syncCompanyInfo = async () => {
  isCompanyInfoLoading.value = true;
  try {
    const name = await settingState.getCompanyName();
    const nextCompanyName = name ?? '';

    if (!isCompanyNameDirty.value) {
      formData.value.name = nextCompanyName;
    }
    initialCompanyName.value = nextCompanyName;
  } finally {
    isCompanyInfoLoading.value = false;
  }
}

onMounted(() => {
  if (props.mode === 'company') {
    void syncCompanyInfo();
  }
});


const updatePageInfo = (page: number, pageSize: number) => {
  pageInfo.value.page = page;
  pageInfo.value.pageSize = pageSize;
  getUserList();
}

const handleSaveCompanyInfo = async() => { //保存企业信息
  if (isCompanyInfoLoading.value || isSavingCompanyInfo.value) return;

  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    const tasks: Promise<unknown>[] = [];
    const nextCompanyName = companyName.value ?? '';

    if (passportState.companyNameEditable && nextCompanyName !== initialCompanyName.value) {
      tasks.push(settingState.setCompanyName(nextCompanyName));
    }

    isSavingCompanyInfo.value = true;
    await Promise.all(tasks)
    .then(() => {
      initialCompanyName.value = nextCompanyName;
      formData.value.name = nextCompanyName;
      isCompanyNameDirty.value = false;
      ElMessage.success(i18next.t('OrganizeMainAdmin.saveSuccess'));
    }).catch(() => {
      ElMessage.error(i18next.t('OrganizeMainAdmin.saveFail'));
    }).finally(() => {
      isSavingCompanyInfo.value = false;
    })
  })
}
</script>

<style scoped lang='scss'>
.organize-main-admin {
  padding: 16px;
  height: 100%;
  width: 100%;
  background-color: var(--bg-color-page);
  border-radius: 4px;

  .admin-tabs {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: start;
    align-items: center;
    width: 100%;
    height: 36px;
    column-gap: 32px;
    border-bottom: 1px solid var(--border-color);

    .vn-stack-tab {
      padding: 6px 0;
      height: 100%;
      cursor: var(--cursor-pointer);
      font-size: 16px;
      line-height: 24px;

      &.active::after {
        content: "";
        position: absolute;
        bottom: -1px;
        left: 0;
        right: 0;
        height: 2px;
        background-color: var(--primary-color);
      }

      &.active {
        color: var(--primary-color);
      }
    }
  }

  .admin-content {
    // margin-top: 32px;
    border-radius: 8px;
    height: 100%;

    .user-search {
      :deep(.el-input) {
        .el-input__wrapper {
          width: 320px;
          height: 32px;
          background-color: var(--bg-color-overlay);
          border-radius: 4px;
          box-shadow: unset;

          &:hover {
            box-shadow: 0 0 0 1px var(--border-color) inset;
          }

          &.is-focus {
            box-shadow: 0 0 0 1px var(--el-input-focus-border-color) inset !important;
          }
        }
      }
    }

    .company-info {
      max-width: 544px;

      :deep(.el-form) {
        width: 512px;

        .el-form-item {
          align-items: center;
          margin-bottom: 16px;

          .el-input__wrapper {
            box-shadow: unset;
            background-color: var(--bg-color-overlay);
            border-radius: 4px;

            &:hover {
              box-shadow: 0 0 0 1px var(--border-color) inset;
            }

            &.is-focus {
              box-shadow: 0 0 0 1px var(--el-input-focus-border-color) inset !important;
            }

          }

          .el-input-group__append {
            width: 48px;
            margin-left: 8px;
            background-color: var(--bg-color-overlay);
            border: unset;
            box-shadow: unset;
            color: var(--color-primary);
            border-radius: 4px;
            cursor: var(--cursor-pointer);
          }

          .logo {
            width: 48px;
            height: 48px;
            background-color: #3091ff;
            border-radius: 50%;
          }

          .edit-logo {
            margin-left: 16px;
            color: var(--color-primary);
            cursor: var(--cursor-pointer);
          }

          .submit-button {
            border-radius: 4px;
            width: 60px;
            height: 32px;
            margin-top: 16px
          }

        }
      }

    }
  }
}
</style>
