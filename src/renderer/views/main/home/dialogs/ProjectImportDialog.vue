<template>
  <div class="import-container">
    <el-dialog :title="$t('projectImportDialog.dialogNocodeHeader')" :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" width="400px" top="30vh" destroy-on-close :close-on-click-modal="false" @open="handleDialogOpen" @closed="handleDialogClose" draggable align-center>
      <div class="item-title">{{ $t("projectImportDialog.nocodeImportTip") }}</div>
      <project-import-core ref="projectImportCoreRef" @import-success="importSuccess" @update-import-tip="updateImportTip" :args="args" :parentId="parentId" :restore-data-checked="restoreDataChecked" :groupId="importGroupId"></project-import-core>
      <div class="select-group">
        <p class="select-group-title">{{ $t("projectImportDialog.selectGroup") }}{{ getI18nLabelColon() }}</p>
        <div class="group-list">
          <el-select v-model="importGroupId" :placeholder="$t('projectImportDialog.selectPlaceholder')" style="width: 368px; background-color: #F5F6F7;">
            <el-option
              v-for="group in groupsData"
              :key="group.id"
              :label="group.name"
              :value="group.id"
            />
          </el-select>
        </div>
      </div>
      <div class="input-item options">
        <div class="open-project" @click="openAfterChecked=!openAfterChecked">
          <input class="open-project-checkbox" type="checkbox" name="open-project" v-model="openAfterChecked" checked ref="openAfterRef"/>
          <label>{{ $t("projectImportDialog.nocodeImportAndOpen") }}</label>
        </div>
        <!-- <div class="transform" @click.stop="restoreDataChecked=!restoreDataChecked">
          <input class="transform-checkbox" type="checkbox" name="transform" v-model="restoreDataChecked" ref="restoreDataRef"/>
          <label>{{ $t("projectImportDialog.apiDataReduction") }}</label>
          <el-tooltip :content="transformDataTip" placement="top" effect="light">
            <i class="fs fs-helper2" @click.stop></i>
          </el-tooltip>
        </div> -->
      </div>
      <template #footer>
        <div class="dialog-footer">
          <div class="tip" v-if="importTip">
            <img src="@renderer/assets/image/main/warning.svg">
            <span class="text" :title="importTip">{{ importTip }}</span>
          </div>
          <!-- <el-button type="primary" @click="doImport" :loading="btnLoading" :disabled="!allowImport">{{ $t("projectImportDialog.projectImportText") }}</el-button> -->
          <el-button @click="doCancel">{{ $t("projectImportDialog.projectImportCancel") }}</el-button>
          <el-button type="primary" @click="doImport" :loading="btnLoading" :disabled="!allowImport">{{ $t("projectImportDialog.projectImportConfirm") }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>

</template>

<script lang='ts' setup>
import { ref, computed, inject } from 'vue';
import { useRouter } from 'vue-router';
import i18next from 'i18next';
import { ImportNocodeResult } from '@common/types/nocode';
import { GET_LIST, PARENT_ID } from '@renderer/types';
import { ElMessage } from 'element-plus';
import axios from 'axios';
import { unique } from '@common/utils/unique';
import { isNocodeImportExpired } from '@common/utils';
import { getI18nLabelColon } from '@common/utils/i18n';

const getList = inject(GET_LIST);
const parentId = inject(PARENT_ID);
const router = useRouter();
const isDevelopmentMode = import.meta.env.DEV;

const props = defineProps<{
  modelValue: boolean,
  args?: string,
}>();

const emit = defineEmits(["closed", "created", "update:modelValue", "refresh", "closeDialog"]);

const ungroupedApp = ref()
const getGroupsData = async () => { 
  await axios.get("/project/get-all-nocode-groups").then(({ data }) => {
    // 添加未分组应用项
    ungroupedApp.value = {
      id: unique(),
      name: `${i18next.t("projectImportDialog.noGroup")}`,
      isUngrouped: true,
    }
    data.push(ungroupedApp.value)
    groupsData.value = data;
    importGroupId.value = ungroupedApp.value.id
  }).catch(({ response }) => {
    ElMessage.error(response.data.message);
    return [];
  });
};

async function handleDialogOpen(){ 
  getGroupsData()
}

const projectImportCoreRef = ref(null);
const openAfterRef = ref(null);
const restoreDataRef = ref(null);

const openAfterChecked = ref(true);
const restoreDataChecked = ref(false);

const showTip = ref(false);
const importTip = ref('');
const btnLoading = ref(false);

const importGroupId = ref()
const groupsData = ref()

const allowImport = computed(() => {
  return projectImportCoreRef.value?.allowImport || false;
});

const transformDataTip = computed(() => {
  return i18next.t("projectImportDialog.nocodeTransformDataTip")
})

const updateImportTip = (tip: string) => {
  importTip.value = tip;
}

const handleDialogClose = () => {
  projectImportCoreRef.value.close();
  showTip.value = false;
  importTip.value = '';
  emit('update:modelValue', false);
  emit("closed");
}

const shouldOpenImportedNocodeAfterImport = (options: {
  openAfterImport: boolean;
  isDevelopmentMode: boolean;
  result?: ImportNocodeResult | null;
}) => {
  const importedNocodeMeta = options.result?.meta;
  if (!options.openAfterImport || !importedNocodeMeta?.id) {
    return false;
  }
  if (options.isDevelopmentMode && isNocodeImportExpired(importedNocodeMeta)) {
    return false;
  }
  return true;
};

const importSuccess = async (result: ImportNocodeResult, replace?: boolean) => {
  const data = result.meta;
  if (!data) return;
  if (getList) {
    getList(parentId.value);
  } else {
    emit("refresh");
  }
  handleDialogClose();
  if (result.importData?.failedCount) {
    ElMessage.warning(i18next.t("projectImportDialog.importPartialSuccess"));
  }
  if (shouldOpenImportedNocodeAfterImport({
    openAfterImport: openAfterChecked.value,
    isDevelopmentMode,
    result,
  })) {
    router.push(`/app/${data.id}/`);
  }
}

const doImport = async () => {
  btnLoading.value = true;
  await projectImportCoreRef.value.doImport();
  btnLoading.value = false;
}

const doCancel = async () => {
  emit("closeDialog");
}

defineExpose({
  hide: handleDialogClose
})

</script>
<style scoped lang='scss'>
.import-container {
  position: absolute;

  :deep(.el-button) {
    border-radius: 4px;
  }

  :deep(.el-dialog) {
    width: 400px;
    border-radius: 4px;
    background-color: white;
    .el-dialog__header{
      display: flex;
      justify-content: center;
      padding: 0 0 10px 0;
      .el-dialog__title{
        font-size: 14px;
      }

      &::after{
        content: "";
        display: block;
        position: absolute;
        top: 40px;
        width: 100%;
        height: 1px;
        left: 0px;
        background-color: #D9D9D9;
      }
    }
    .el-dialog__body {
      font-size: 12px;
      .item-input.open-project,
      .item-input.transform {
        position: absolute;
        width: 100px;
        user-select: none;
        font-size: 12px;
        cursor: var(--cursor-pointer);
      }

      .item-input.transform span {
        width: 220px;
        padding: 4px;
        line-height: 15px;
        background: #ddd;
        color: #333;
        position: absolute;
        right: -20px;
        top: -45px;
        cursor: var(--cursor-pointer);
        border-radius: 5px;
        z-index: 2;
      }

      .label {
        font-weight: 400;
        position: absolute;
        margin-top: 1px;
        margin-left: 3px;
      }

      i.fs-helper2 {
        cursor: pointer;
      }

      .d-flex{
        position: relative;
        margin-top: 10px;

        &:hover .has-file {
          .remove-filepath {
            display: block;
            position: absolute;
            right: 10px;
            top: 10px;
            &:hover {
              color: #BDBDBD;
            }
          }

          ~div {
            .el-upload-dragger {
              background-color: #228CFC0A;
            }
          }
        }

        .tip-wrapper {
          position: absolute;
          z-index: 99;
          width: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          pointer-events: none;
          row-gap: 16px;

          .path {
            width: 100%;
            background: transparent;
            text-align: center;
            white-space: nowrap;
            text-overflow: ellipsis;
          }
  
          .remove-filepath {
            color: #7A7A7A;
            pointer-events: all;
            cursor: pointer;
            display: none;
          }
        }

        > div {
          width: 100%;
          height: 100%;
        }
      }

      .el-upload .btn {
        line-height: 21px;
        font-weight: bold;
        border: 0;
        border-radius: 0;
        padding: 4px 8px 5px 8px;
        background: #0089ff;

        &:hover {
          background: #39a3ff;
          color: #fff;
        }
      }

      .btn-save {
        width: 120px;
        height: 30px;
        position: relative;
      }

      .btn-save img {
        display: none;
      }

      .btn-save.loading img {
        display: block;
        width: 28px;
        position: absolute;
        top: 0;
      }
      
      .item-title {
        font-size: 14px;
        margin-top: 20px;
      }

      .select-group {
        margin-top: 15px;
        .select-group-title {
          font-size: 14px;
          margin-bottom: 10px;
        }
        .group-list {
          margin-bottom: 20px;

          .el-select__wrapper {
            border-radius: 4px;
            box-shadow: unset;
            background-color: var(--bg-color-overlay);

            &:hover {
              box-shadow: unset;
            }
          }
        }
      }

      .input-item.options {
        margin-top: 10px;
        height: 15px;
        display: flex;
        justify-content: space-between;
        align-items: center;

        .open-project {
          border-radius: 0;
          height: 100%;
          border-right: 0;
          padding-left: 0px;
          display: flex;
          align-items: center;
          column-gap: 4px;
        }

        .transform {
          display: flex;
          align-items: center;
          column-gap: 4px;
        }

        input {
          height: 14px;
        }
      }

    }

    .el-dialog__footer{
      .tip {
        position: absolute;
        font-size: 12px;
        height: 30px;
        line-height: 30px;
        color: #FE4A4A;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        vertical-align: bottom;
        max-width: 280px;
        .text {
          margin-left: 5px;
        }
      }
    }
  }
}
</style>
