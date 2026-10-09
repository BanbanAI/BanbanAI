<template>
  <div class="nocode-inner-viewer" v-if="project">
    <project-viewer v-if="type === 'page'"
      :project="project"
      :nocode="nocode"
      :projectId="pageId"
      :nocodeId="nocodeId"
      :webshare="true"
      />
    <form-share-viewer v-else
      :tableId="pageId"
      :shareConfig="formShareConfig"
      :publisher="publisher"
      :reportAccount="reportAccount"
      />
  </div>
</template>

<script setup lang='ts'>
import { ref, provide, computed } from 'vue';
import axios from "axios";
import { ProjectBody, PublishCategory, Table } from "@common/types/project";
import { useRoute } from 'vue-router';
import { usePassportStore } from '@renderer/stores';
import { Nocode } from '@common/types/nocode';
import { OrganizeUtil } from '@renderer/views/nocode/utils';
import { NOCODE, ORGANIZE_UTIL } from '@renderer/types';
import { getAllPages } from '@common/utils';

const route = useRoute();
const passportState = usePassportStore();
passportState.init();
const project = ref<ProjectBody | Table>();
const nocode = ref<Nocode>();
const isNeedPassword = ref(true);
const organizeUtil = new OrganizeUtil();
const publisher = ref<{
  userId?: string,
  user?: string,
  realname?: string,
}>();
const reportAccount = ref('');

const { type, nocodeId, pageId } = route.params;

const getNocodeProject = async () => {
  publisher.value = undefined;
  reportAccount.value = '';
  const url = `workbench/get-view-nocode-layer?type=${type}&nocodeId=${nocodeId}&id=${pageId}`
  const res = await axios.get(url).catch(err => {
    console.log("get-nocode-project-error", err);
  });
  if (res && res.data) {
    if (type === PublishCategory.PAGE) {
      const theProject: ProjectBody = res.data.project ?? {};
      project.value = theProject;
      nocode.value = res.data.nocode;
      const allPages = getAllPages(nocode.value?.body?.structure);
      document.title = allPages.find(page => page.id === theProject.id)?.name;
    } else {
      project.value = (res.data.project as Table);
      nocode.value = res.data.nocode;
      publisher.value = res.data.publisher;
      reportAccount.value = String(res.data.reportAccount || '');
      document.title = project.value.alias;
    }
    isNeedPassword.value = res.data.isNeedPassword;
  }
}

const formShareConfig = computed(() => {
  if (type !== PublishCategory.FORM) {
    return undefined;
  }
  return (project.value as Table | undefined)?.publish?.innerFormShareConfig;
});

const init = async () => {
  await getNocodeProject();
};
init();
provide(ORGANIZE_UTIL, organizeUtil)
provide(NOCODE, nocode)
</script>

<style scoped lang='scss'>
.nocode-inner-viewer {
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
