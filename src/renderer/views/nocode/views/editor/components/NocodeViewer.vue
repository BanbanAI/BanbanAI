<template>
  <div class="nocode-viewer" v-if="project">
    <div class="visit-login" v-if="notLoginYet">
      <div class="wrap-form">
        <img src="@renderer/assets/image/visit-login.png" alt="">
        <div class="tip">{{ $t('NocodeViewer.inputAccessPwd') }}</div>
        <el-input v-model="password" type="password" :showPassword="true"></el-input>
        <el-button type="primary" @click="handleVerifyVisit">{{ $t('NocodeViewer.confirm') }}</el-button>
      </div>

      <div class="hint">{{ $t('NocodeViewer.techSupportTip') }}</div>
    </div>
    <project-viewer v-else-if="type === 'page'"
      :project="project"
      :nocode="nocode"
      :projectId="pageId"
      :nocodeId="nocodeId"
      :webshare="true"
      />
    <form-share-viewer v-else
      :key="formShareViewerKey"
      :tableId="pageId"
      :fieldsAuth="fieldsAuth"
      :shareConfig="formShareConfig"
      :publisher="publisher"
      :reportAccount="reportAccount"
      :isPublicShare="true"
      />
  </div>
</template>

<script setup lang='ts'>
import { ref, provide, computed, onUnmounted, watch } from 'vue';
import axios from "axios";
import { ProjectBody, PublishCategory, Table } from "@common/types/project";
import { useRoute } from 'vue-router';
import { Nocode } from '@common/types/nocode';
import { OrganizeUtil } from '@renderer/views/nocode/utils';
import { NOCODE, ORGANIZE_UTIL } from '@renderer/types';
import { getAllPages } from '@common/utils';
import { ElMessage } from 'element-plus';
import { isEmpty } from '@common/utils/object';
import { visitTokenStore } from '@renderer/utils/storage';


const route = useRoute();
const project = ref<ProjectBody | Table>();
const nocode = ref<Nocode>();
const isNeedPassword = ref(true);
const organizeUtil = new OrganizeUtil();

const type = computed(() => String(route.params.type || ''));
const nocodeId = computed(() => String(route.params.nocodeId || ''));
const pageId = computed(() => String(route.params.pageId || ''));
const isPreview = computed(() => String(route.query.isPreview || ''));
const currentViewerKey = computed(() => `${type.value}|${nocodeId.value}|${pageId.value}|${isPreview.value}`);
const formShareViewerKey = computed(() => `${type.value}|${nocodeId.value}|${pageId.value}|${route.fullPath}`);
const password = ref<string>('')
const isVerifyVisitSuccess = ref(false);
const fieldsAuth = ref<Record<string, number> | "all">("all");
const publisher = ref<{
  userId?: string,
  user?: string,
  realname?: string,
}>();
const reportAccount = ref('');
const latestInitId = ref(0);

const isLatestInit = (initId: number) => {
  return initId === latestInitId.value;
};

const resetViewerState = () => {
  project.value = undefined;
  nocode.value = undefined;
  isNeedPassword.value = true;
  isVerifyVisitSuccess.value = false;
  fieldsAuth.value = "all";
  password.value = '';
  publisher.value = undefined;
  reportAccount.value = '';
};

const syncPublicFormShareHeaders = () => {
  if (type.value !== PublishCategory.FORM) {
    delete axios.defaults.headers.common['x-public-form-share-nocode-id'];
    delete axios.defaults.headers.common['x-public-form-share-table-id'];
    delete axios.defaults.headers.common['x-public-share-visit-token'];
    return;
  }
  axios.defaults.headers.common['x-public-form-share-nocode-id'] = nocodeId.value;
  axios.defaults.headers.common['x-public-form-share-table-id'] = pageId.value;
  const visitToken = visitTokenStore.get();
  if (visitToken) {
    axios.defaults.headers.common['x-public-share-visit-token'] = visitToken;
  } else {
    delete axios.defaults.headers.common['x-public-share-visit-token'];
  }
};

const notLoginYet = computed(() => {
  const isNeedPassword = type.value === PublishCategory.FORM ? (project.value as Table)?.publish.isNeedPassword : (project.value as ProjectBody)?.isNeedPassword
  return isEmpty(project.value) || (isNeedPassword && !isVerifyVisitSuccess.value);
});

const getNocodeProject = async (initId?: number) => {
  const url = `workbench/${nocodeId.value}/get-nocode-project?type=${type.value}&nocodeId=${nocodeId.value}&projectId=${pageId.value}${isPreview.value ? '&isPreview=' + isPreview.value : ''}`
  const res = await axios.get(url).catch(err => {
    console.log("get-nocode-project-error", err);
  });
  if (initId !== undefined && !isLatestInit(initId)) return;
  if (res && res.data) {
    if (type.value === PublishCategory.PAGE) {
      const theProject: ProjectBody = res.data.project ?? {};
      project.value = theProject;
      nocode.value = res.data.nocode;
      const allPages = getAllPages(nocode.value?.body?.structure);
      document.title = allPages.find(page => page.id === theProject.id)?.name;
    } else {
      project.value = (res.data.project as Table);
      nocode.value = res.data.nocode;
      fieldsAuth.value = res.data.fieldsAuth || "all";
      publisher.value = res.data.publisher;
      reportAccount.value = String(res.data.reportAccount || '');
      document.title = project.value.alias;
    }
    isNeedPassword.value = res.data.isNeedPassword;
  }
}

const formShareConfig = computed(() => {
  if (type.value !== PublishCategory.FORM) {
    return undefined;
  }
  return (project.value as Table | undefined)?.publish?.publicFormShareConfig;
});

const validateToken = async (token: string): Promise<any> => {
  return await axios.post(`project/validate-share-token`, {
    nocodeId: nocodeId.value,
    pageId: pageId.value,
    type: type.value,
    token,
  }).then(({ data }) => data).catch(() => null)
}

const tryAutoLogin = async (initId?: number) => {
  if (!nocodeId.value || !pageId.value) return;

  const token = visitTokenStore.get();
  if (!token) return;
  const data = await validateToken(token);
  if (initId !== undefined && !isLatestInit(initId)) return;
  if (data) {
    isVerifyVisitSuccess.value = true;
  } else {
    isVerifyVisitSuccess.value = false;
    visitTokenStore.remove();
    syncPublicFormShareHeaders();
  }
};

const validatePassword = async (password: string): Promise<any> => { 
  const params = {
    type: type.value,
    nocodeId: nocodeId.value,
    projectId: pageId.value,
    password,
  };
  const res = await axios.post(`workbench/${nocodeId.value}/visit-nocode-project`, params).catch((err) => {
    ElMessage.error(err.response?.data?.message);
  })
  if (res) {
    return res?.data;
  }
}

const handleVerifyVisit = async () => {
  const verifyKey = currentViewerKey.value;
  const verifyInitId = latestInitId.value;
  const data = await validatePassword(password.value);
  if (!data?.success) return;
  if (verifyKey !== currentViewerKey.value || verifyInitId !== latestInitId.value) return;

  isVerifyVisitSuccess.value = true;
  visitTokenStore.set(data.token);
  syncPublicFormShareHeaders();
}

const init = async () => {
  const initId = latestInitId.value + 1;
  latestInitId.value = initId;
  resetViewerState();
  syncPublicFormShareHeaders();
  await getNocodeProject(initId);
  if (!isLatestInit(initId)) return;
  if (isNeedPassword.value) {
    await tryAutoLogin(initId);
  }
};
watch(currentViewerKey, () => {
  init();
}, { immediate: true });
watch(() => route.fullPath, () => {
  syncPublicFormShareHeaders();
}, { immediate: true });
provide(ORGANIZE_UTIL, organizeUtil)
provide(NOCODE, nocode)

onUnmounted(() => {
  if (type.value === PublishCategory.FORM) {
    delete axios.defaults.headers.common['x-public-form-share-nocode-id'];
    delete axios.defaults.headers.common['x-public-form-share-table-id'];
    delete axios.defaults.headers.common['x-public-share-visit-token'];
  }
});
</script>

<style scoped lang='scss'>
.nocode-viewer {
  width: 100%;
  height: 100%;

  .visit-login {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;

    .wrap-form {
      width: 320px;
      height: 216px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px 0;

      img {
        width: 64px;
      }

      .tip {
        font-size: 16px;
        line-height: 24px;
        padding: 8px 0;
        color: var(--text-color-primary);
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
            text-align: center;

            &::placeholder {
              font-size: 14px;
            }
          }
        }

      .el-button {
        width: 100%;
        border-radius: 4px;
      }
    }

    .hint {
      position: absolute;
      left: 50%;
      bottom: 64px;
      transform: translateX(-50%);
      color: var(--text-color-placeholder);
    }
  }

}
</style>
