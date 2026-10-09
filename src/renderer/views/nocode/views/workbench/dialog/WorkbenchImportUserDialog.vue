<template>
  <div class="workbench-import-user-dialog">
    <el-dialog class="import-user-dialog" v-model="dialogVisible" :close-on-click-modal="false" :title="$t('WorkbenchImportUserDialog.importExcelAddMember')" 
      align-center destroy-on-close :show-close="false" :style="isFullscreen ? { '--width': '100%', '--height': '100%', } : {}" @closed="onClosed">
      <template #header>
        <div class="title">{{ $t('WorkbenchImportUserDialog.importExcelAddMember') }}</div>
        <div class="menus">
          <el-button link  @click="isFullscreen = !isFullscreen"><el-icon :size="16">
            <i-ant-design-fullscreen-exit-outlined v-if="isFullscreen"></i-ant-design-fullscreen-exit-outlined>
            <i-ant-design-fullscreen-outlined v-else></i-ant-design-fullscreen-outlined>
          </el-icon></el-button>
          <el-button link @click="dialogVisible = false"><el-icon :size="16"><i-ep-close></i-ep-close></el-icon></el-button>
        </div>
      </template>
      <template #default>
        <div class="container">
          <div class="body">
            <div class="import-step-content" v-if="!isCompleted">
              <div class="import-tip">
                <p>{{ $t('WorkbenchImportUserDialog.excelRuleTips') }}<a @click="handleDownloadTemplate">{{ $t('WorkbenchImportUserDialog.downloadTemplate') }}</a></p>
                <p>&nbsp;· &nbsp;{{ $t('WorkbenchImportUserDialog.excelFileSupportTips') }}</p>
                <p>&nbsp;· &nbsp;{{ $t('WorkbenchImportUserDialog.fieldNameMatchTips') }}</p>
                <p>&nbsp;· &nbsp;{{ $t('WorkbenchImportUserDialog.deptRoleMatchTips') }}</p>
                <p>&nbsp;· &nbsp;{{ $t('WorkbenchImportUserDialog.fieldDataMismatchTips') }}</p>
                <p>&nbsp;· &nbsp;{{ $t('WorkbenchImportUserDialog.moreOperateTips') }}<a href="https://www.banban.work/docs/v1/pg4skt33glvs96x1" target="_blank">{{ $t('WorkbenchImportUserDialog.viewTutorial') }}</a></p>
              </div>
              <el-upload
                class="drag-upload"
                ref="uploadRef"
                drag list-type="text"
                :show-file-list="false"
                accept=".xlsx,.xls"
                :auto-upload="false"
                :limit="1"
                :on-change="onSelectFile"
              >
                <div class="drag-upload-content" v-if="!excelFile">
                  <div class="drag-upload-content-item">
                    <img class="upload-icon" src="@renderer/assets/icons/workbench/upload.svg">
                    <div class="upload-text">
                      {{ $t('WorkbenchImportUserDialog.dragOrClickAddFile') }}<span>{{ $t('WorkbenchImportUserDialog.clickAddFile') }}</span>
                    </div>
                  </div>
                </div>
                <div class="file-name" v-else>
                  <el-icon :size="16" class="remove-filepath" @click.stop="handleRemoveFile"><i-ep-close /></el-icon>
                  {{ excelFile.name }}
                </div>
              </el-upload>
            </div>
            <div class="complete-step-content" v-if="isCompleted">
              <div class="container">
                <div class="check-circle">
                  <el-icon class="check-icon"
                    v-if="isAllUsersCreated"
                  ><i-nocode-import-success /></el-icon>
                  <el-icon class="check-icon" v-else><i-nocode-import-warning /></el-icon>
                </div>
                <p class="text">
                  <div class="text-primary">
                    {{ $t('WorkbenchImportUserDialog.memberImport') }}<span v-if="createdUserCount !== 0">{{ $t('WorkbenchImportUserDialog.success') }}</span><span v-else>{{ $t('WorkbenchImportUserDialog.fail') }}</span>
                  </div>
                  <div class="text-secondary">
                    {{$t('WorkbenchImportUserDialog.memberImportComplete')}}，{{$t('WorkbenchImportUserDialog.importSuccessCount')}}&nbsp;{{ createdUserCount }}&nbsp;{{$t('WorkbenchImportUserDialog.memberCountSuffix')}}，{{$t('WorkbenchImportUserDialog.importFailCount')}}&nbsp;{{ failedCreatedUserCount }}&nbsp;{{ $t('WorkbenchImportUserDialog.memberCountSuffix') }}
                  </div>
                </p>
              </div>
            </div>
          </div>
          <div class="footer">
            <div class="footer-left">
              <a class="guide-text" href="https://www.banban.work/docs/v1/pg4skt33glvs96x1" target="_blank" v-if="false"><el-icon><Opportunity /></el-icon>{{ $t('WorkbenchImportUserDialog.viewTutorial') }}</a>
            </div>
            <div class="footer-right">
              <div class="import-step-button" v-if="!isCompleted">
                <el-button class="cancel" @click="dialogVisible = false">{{ $t('WorkbenchImportUserDialog.cancel') }}</el-button>
                <el-button type="primary" class="next-step" @click="handleNextStep" :disabled="!excelFile">{{ $t('WorkbenchImportUserDialog.nextStep') }}</el-button>
              </div>
              <div class="complete-step-button" v-if="isCompleted">
                <el-button type="primary" class="complete" @click="dialogVisible = false">{{ $t('WorkbenchImportUserDialog.complete') }}</el-button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang='ts'>
import { computed, ref, Ref } from 'vue';
import { ElMessage, UploadInstance } from 'element-plus';
import { Opportunity } from '@element-plus/icons-vue'
import axios from "axios";
import * as XLSX from 'xlsx';
import { doDownload } from "@renderer/utils";
import i18next from 'i18next';

const emit = defineEmits<{
  (event: 'completed'),
}>();

const uploadRef = ref<UploadInstance>();
const isFullscreen = ref(false);
const dialogVisible = ref(false);
const isCompleted = ref(false);
const createdUserCount = ref(0);
const failedCreatedUserCount = ref(0);
const isAllUsersCreated = computed(() => failedCreatedUserCount.value === 0);

const handleDownloadTemplate = async() => {
  try {
    // 通过import引入资源，确保在构建时被打包
    const templateFile = await import('@renderer/assets/resource/member-import-template.xlsx')
    doDownload({ url: templateFile.default, name: i18next.t('WorkbenchImportUserDialog.memberImportTemplateName'), target: '_blank' })
  } catch (error) {
    console.error(`${i18next.t('WorkbenchImportUserDialog.downloadTemplateFail')}:`, error)
    ElMessage.error(i18next.t('WorkbenchImportUserDialog.downloadTemplateFail'))
  }
}

let excelFile: Ref<File> = ref();
const onSelectFile = (file) => {
  const fileType = file.name.split('.').pop().toLowerCase();
  const isValidType = ['xls', 'xlsx'].includes(fileType);
  if (!isValidType) {
    ElMessage.error(i18next.t('WorkbenchImportUserDialog.onlyExcelFileTips'));
    return false; // 阻止文件上传
  }
  excelFile.value = file.raw;
  uploadRef.value?.clearFiles?.();
  return true;  // 允许文件上传
};
const handleRemoveFile = () => {
  uploadRef.value?.clearFiles?.();
  excelFile.value = null;
}
const handleSubmit = async () => {
  if (!excelFile.value) return;
  try {
    // 使用xlsx读取文件
    const workbook = XLSX.read(await excelFile.value.arrayBuffer(), { type: 'array' });
    // 解析所有工作表，每行数据作为数组存储
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    // 直接将工作表转换为数组格式
    const excelData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
    await importUserInfo(excelData);
    return true;
  } catch (error) {
    console.error(`${i18next.t('WorkbenchImportUserDialog.parseExcelFileFail')}:`, error);
    ElMessage.error(`${i18next.t('WorkbenchImportUserDialog.parseExcelFileFail')}: ` + (error.message || i18next.t('WorkbenchImportUserDialog.unknownError')));
  }
}

const handleNextStep = async () => {
  const res = await handleSubmit();
  if (res) {
    isCompleted.value = true;
  }
}

const onClosed = () => {
  excelFile.value = null;
  isFullscreen.value = false;
}

const importUserInfo = async (usersInfoData) => {
  const res = await axios.post("/workbench/import-users", {
    usersInfoData: usersInfoData,
  }).catch(({ response }) => {
    console.error(response?.data?.message);
  });
  if(res) {
    emit('completed');
    createdUserCount.value = res.data;
    failedCreatedUserCount.value = usersInfoData.length - res.data;
  } else {
    console.log("成员导入接口调用失败！")
  }
}

defineExpose({
  show: () => {
    dialogVisible.value = true;
    isCompleted.value = false;
  }
})
</script>

<style scoped lang='scss'>
.workbench-import-user-dialog {
  :deep(.import-user-dialog) {
    --close-button-size: 16px;
    --el-message-close-size: 24px;
    width: var(--width, 680px);
    // height: var(--height, calc(100% - 100px));
    height: var(--height, 440px);
    pointer-events: all;
    padding: 0;
    border-radius: 4px;
    background-color: var(--bg-color-page);

    .el-dialog__header {
      padding: 0 16px;
      height: 40px;
      border-bottom: 1px solid var(--border-color);
      position: relative;

      .title{
        font-size: 14px;
        color: #444444;
        line-height: 40px;
        display: flex;
        justify-content: center;
      }
      .menus {
        position: absolute;
        right: 12px;
        top: 0;
        height: 100%;
        display: flex;
        align-items: center;
      }
    }

    .el-dialog__body{
      height: calc(100% - 40px);
    }

    .el-button {
      height: 32px;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 400;
    }
  }

  .container {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    .body {
      flex: 1;
      padding: 16px;

      .import-step-content {
        height: 100%;
        display: flex;
        flex-direction: column;

        .import-tip {
          margin-top: 16px;
          margin-bottom: 16px;
          display: flex;
          flex-direction: column;
          row-gap: 5px;

          p {
            font-size: 14px;
            font-weight: 400;
            color: var(--text-color-secondary);
            letter-spacing: 1px;
          }

          a {
            color: var(--color-primary);
          }
        }
        
        :deep(.drag-upload) {
          .el-upload {
            height: 100%;

            .el-upload-dragger {
              height: 100%;
            }
          }
          height: 100%;
          .drag-upload-content {
            height: 100%;
            display: flex;
            justify-content: center;

            .drag-upload-content-item {
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100%;

              .upload-icon {
                width: 24px;
                height: 24px;
                margin-right: 6px;
              }

              .upload-text {
                color: var(--text-color-secondary);
                letter-spacing: 1px;

                span {
                  color: var(--color-primary);
                }
              }
            }
          }
          .file-name {
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;

            .remove-filepath {
              position: absolute;
              top: 10px;
              right: 10px;
              color: #7A7A7A;
              opacity: 0;

              &:hover {
                color: #BDBDBD;
              }
            }
          }
          &:hover {
            .remove-filepath {
              opacity: 1;
            }
          }
        }
      }

      .complete-step-content {
        height: 100%;

        .container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background-color: var(--bg-color-page);

          .check-circle {
            margin-bottom: 16px;
            .check-icon {
              font-size: 64px;
            }
          }

          .text {
            display: flex;
            flex-direction: column;
            align-items: center;

            .text-primary {
              font-size: 16px;
              font-weight: 400;
              color: #141414;
              margin-bottom: 16px;
            }
            .text-secondary {
              font-size: 14px;
              font-weight: 400;
              color: #727272;
              letter-spacing: 1px;
            }
          }
        }
      }
    }

    .footer {
      height: 64px;
      padding: 16px;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
    }
  }
}
</style>
