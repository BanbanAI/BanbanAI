<template>
  <div class="nocode-release-wrapper">
    <div class="publish-toolbar">
      <div class="publish-way">
        {{ $t('NocodePublishInnerPage.updateMethod') }}
        <el-select class="update-method" size="small" v-model="innerUpdateMethod" placement="bottom">
          <el-option :label="updateLabel[PublishUpdateMethod.LIVE]" :value="PublishUpdateMethod.LIVE" />
          <el-option :label="updateLabel[PublishUpdateMethod.MANUAL]" :value="PublishUpdateMethod.MANUAL" />
        </el-select>
      </div>
    </div>
    <div class="setting-block app-share-block">
      <div class="block-label">{{ $t('NocodePublishInnerPage.appShareLink') }}</div>
      <div class="block-control link-control">
        <el-input :model-value="innerAppShareUrl" readonly />
        <div class="link-actions">
          <el-button class="icon-btn" @click="handleCopyInnerAppShareUrl">
            <el-icon :title="$t('NocodePublishInnerPage.copyLink')"><i-ven-copy-link /></el-icon>
          </el-button>
          <el-button class="icon-btn" @click="handleShowInnerAppShareQr">
            <el-icon :title="$t('NocodePublishInnerPage.qrcode')"><i-ven-qr-code /></el-icon>
          </el-button>
          <el-button class="icon-btn" @click="handleOpenInnerAppShareUrl">
            <el-icon :title="$t('NocodePublishInnerPage.openLink')"><i-ven-share-link /></el-icon>
          </el-button>
        </div>
      </div>
    </div>

    <div class="content">
      <div class="section-panel">
        <el-header>
          <span class="header-tip">
            <el-icon :size="14" color="var(--text-color-placeholder)"><i-ep-warning /></el-icon>
            {{ $t('NocodePublishInnerPage.publishModeTip') }}
          </span>

          <div class="btns-batch">
            <el-button
              v-if="innerUpdateMethod === PublishUpdateMethod.MANUAL"
              size="small"
              :disabled="!Array.from(selectedInnerIds).length"
              @click="handleBatchInner(true)"
            >
              {{ $t('NocodePublishInnerPage.batchStart') }}
            </el-button>
            <el-button
              v-if="innerUpdateMethod === PublishUpdateMethod.MANUAL"
              size="small"
              :disabled="!Array.from(selectedInnerIds).length"
              @click="handleBatchInner(false)"
            >
              {{ $t('NocodePublishInnerPage.batchStop') }}
            </el-button>
          </div>
        </el-header>

        <el-main class="main-content">
          <div class="publish-table-wrapper">
            <el-table
              :data="innerPagedProjects"
              height="100%"
              border
              :empty-text="$t('NocodePublishInnerPage.emptyText')"
              :row-style="{ height: '36px', backgroundColor: 'transparent' }"
              :row-key="getPublishRowKey"
              :cell-style="{ padding: '0' }"
              @selection-change="handleInnerSelectionChange"
              :ref="(el) => innerTableRef = (el as any)"
            >
              <el-table-column align="center" :resizable="false" type="selection" width="40" />
              <el-table-column
                align="center"
                :resizable="false"
                prop="name"
                :label="$t('NocodePublishInnerPage.page')"
                show-overflow-tooltip
              >
                <template #default="{ row }">
                  {{ checkIsForm(row) ? row.alias : getPageName(row) }}
                </template>
              </el-table-column>
              <el-table-column align="center" :resizable="false" :label="$t('NocodePublishInnerPage.isSharing')">
                <template #default="{ row }">
                  <el-button v-if="innerUpdateMethod !== PublishUpdateMethod.MANUAL" link :disabled="true">
                    {{ (checkIsForm(row) ? row.publish?.sharing : row.sharing) ? $t('NocodePublishInnerPage.alreadySharing') : $t('NocodePublishInnerPage.notSharing') }}
                  </el-button>
                  <el-switch v-else-if="!checkIsForm(row)" v-model="row.sharing" size="small" />
                  <el-switch v-else v-model="row.publish.sharing" size="small" />
                </template>
              </el-table-column>
              <el-table-column align="center" :resizable="false" :label="$t('NocodePublishInnerPage.isUpdate')">
                <template #default>
                  <el-button link :disabled="true">{{ $t('NocodePublishInnerPage.manualUpdate') }}</el-button>
                </template>
              </el-table-column>
              <el-table-column align="center" :resizable="false" :label="$t('NocodePublishInnerPage.shareUrl')" width="150">
                <template #default="{ row }">
                  <el-button
                    class="icon-btn"
                    link
                    :disabled="(checkIsForm(row) ? !row.publish?.sharing : !row.sharing)"
                    @click="handleCopyUrl(row)"
                  >
                    <el-icon :title="$t('NocodePublishInnerPage.copyLink')"><i-ven-copy-link /></el-icon>
                  </el-button>
                  <el-button
                    class="icon-btn"
                    link
                    :disabled="(checkIsForm(row) ? !row.publish?.sharing : !row.sharing)"
                    @click="handleOpenUrl(row)"
                  >
                    <el-icon :title="$t('NocodePublishInnerPage.openLink')"><i-ven-share-link /></el-icon>
                  </el-button>
                  <el-button
                    class="icon-btn"
                    link
                    :disabled="(checkIsForm(row) ? !row.publish?.sharing : !row.sharing)"
                    @click="handleShowQr(row, $event)"
                  >
                    <el-icon :title="$t('NocodePublishInnerPage.qrcode')"><i-ven-qr-code /></el-icon>
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <el-config-provider :locale="locale">
            <el-pagination
              v-model:current-page="innerPage"
              v-model:page-size="pageSize"
              :total="innerPublishProjects.length"
              layout="sizes, total, prev, pager, next"
              :page-sizes="[10, 20, 30, 40, 50, 100]"
              @current-change="handleInnerPageChange"
              @size-change="handleInnerPageSizeChange"
            />
          </el-config-provider>

          <el-popover :visible="qrCodeVisible" :virtual-ref="virtualRef" trigger="click" width="176" :popper-style="{ padding: 0 }">
            <div class="qrcode-container" v-click-outside="onClickOutside">
              <div class="qrcode-title">{{ $t(isAppShareQrCode ? 'NocodePublishInnerPage.scanToAccessApp' : 'NocodePublishInnerPage.scanToAccess') }}</div>
              <Qrcode :size="150" :value="qrCodeUrl" level="L" />
              <el-button class="download-button" plain @click="downloadQrcode">
                <el-icon><i-ep-download /></el-icon>{{ $t('NocodePublishInnerPage.download') }}
              </el-button>
            </div>
          </el-popover>

        </el-main>
      </div>
    </div>

    <el-button class="confirm-btn" type="primary" @click="handleConfirm">{{ $t('NocodePublishInnerPage.confirm') }}</el-button>
    <nocode-update-tip-dialog ref="updateTipDialogRef" />
    <nocode-update-tip-dialog ref="visitPageTipDialogRef" />
  </div>
</template>

<script setup lang="ts">
import { PublishScope, PublishUpdateMethod } from '@common/types/project';
import Qrcode from 'qrcode.vue';
import { ClickOutside as vClickOutside, ElMessage } from 'element-plus';
import type { PropType } from 'vue';
import { computed, ref, toRefs } from 'vue';
import i18next from 'i18next';
import type { ProjectBody, Table } from '@common/types/project';
import type { PublishSettingState } from './usePublishSettingState';
import { elementPlusLocale as locale } from '@renderer/utils/elementPlusLocale';
import { useSettingStore } from '@renderer/stores';
import { useClipboard } from '@vueuse/core';

const props = defineProps({
  publishState: {
    type: Object as PropType<PublishSettingState>,
    required: true,
  },
});
const { publishState } = toRefs(props);

const updateTipDialogRef = ref();
const visitPageTipDialogRef = ref();
const isAppShareQrCode = ref(false);
const settingState = useSettingStore();
const { copy } = useClipboard({ legacy: true });

const {
  innerUpdateMethod,
  selectedInnerIds,
  innerPagedProjects,
  innerPublishProjects,
  checkIsForm,
  getPageName,
  handleBatchInner,
  handleCopyPublicUrl,
  handleOpenPublishUrl,
  handleShowQrCode,
  handleInnerSelectionChange,
  innerTableRef,
  innerPage,
  pageSize,
  handleInnerPageChange,
  handleInnerPageSizeChange,
  qrCodeVisible,
  virtualRef,
  qrCodeUrl,
  qrCodeFileName,
  onClickOutside,
  downloadQrcode,
  handleConfirm,
  checkUpdate: checkPublishUpdate,
} = publishState.value;

const updateLabel = computed(() => {
  return {
    [PublishUpdateMethod.LIVE]: i18next.t('NocodePublishInnerPage.live'),
    [PublishUpdateMethod.MANUAL]: i18next.t('NocodePublishInnerPage.manual'),
  };
});

const currentNocodeId = computed(() => {
  return String(publishState.value.nocode.value?.meta?.id || "");
});

const innerAppShareUrl = computed(() => `${settingState.saas.domain}/#/app/${currentNocodeId.value}`);

const handleCopyInnerAppShareUrl = async () => {
  await copy(innerAppShareUrl.value);
  ElMessage.success(i18next.t('NocodePublishInnerPage.copySuccess'));
};

const handleOpenInnerAppShareUrl = () => {
  window.open(innerAppShareUrl.value, 'browser');
};

const handleShowInnerAppShareQr = (event: MouseEvent) => {
  if (qrCodeVisible.value) return;
  isAppShareQrCode.value = true;
  qrCodeUrl.value = innerAppShareUrl.value;
  qrCodeFileName.value = publishState.value.nocode.value?.meta?.name || i18next.t('NocodePublishInnerPage.appShareLink');
  virtualRef.value = event.currentTarget as HTMLElement;
  qrCodeVisible.value = true;
};

const getPublishRowKey = (row: ProjectBody | Table) => {
  return checkIsForm(row) ? row.uid : row.id;
};


const handleCopyUrl = async (row: ProjectBody | Table) => {
  await handleCopyPublicUrl(row, visitPageTipDialogRef.value, PublishScope.INNER);
};

const handleOpenUrl = async (row: ProjectBody | Table) => {
  await handleOpenPublishUrl(row, visitPageTipDialogRef.value, PublishScope.INNER);
};

const handleShowQr = async (row: ProjectBody | Table, event: MouseEvent) => {
  isAppShareQrCode.value = false;
  await handleShowQrCode(event, row, visitPageTipDialogRef.value, PublishScope.INNER);
};

defineExpose({
  checkUpdate: () => checkPublishUpdate(updateTipDialogRef.value),
});
</script>

<style scoped lang="scss">
.nocode-release-wrapper {
  width: 100%;
  height: 100%;
  padding: 16px;
  display: flex;
  flex-direction: column;

  .publish-toolbar {
    height: 32px;
    display: flex;
    align-items: center;

    .publish-way {
      height: 100%;
      display: flex;
      align-items: center;
      font-size: 14px;
      white-space: nowrap;

      :deep(.update-method) {
        width: 74px;
        --el-input-text-color: var(--color-primary);
        --el-select-input-color: var(--el-input-text-color);
        --el-text-color-placeholder: var(--el-input-text-color);

        .el-select__wrapper {
          font-size: 14px;
          padding: 0;
          box-shadow: none;
          background-color: transparent;
        }
      }
    }
  }

  .app-share-block {
    width: min(100%, 730px);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    margin-top: 16px;

    .block-label {
      font-size: 14px;
      line-height: 20px;
      color: var(--text-color-regular);
    }

    .block-control {
      width: 100%;
      display: flex;
      align-items: center;
    }

    .link-control {
      gap: 8px;

      :deep(.el-input) {
        flex: 1;
      }
    }

    .link-actions {
      display: flex;
      flex-shrink: 0;
      gap: 8px;
    }

    :deep(.el-input__wrapper) {
      min-height: 36px;
      border-radius: 6px;
      background-color: #f5f6f7;
      box-shadow: none;
      padding: 0 12px;
    }

    .icon-btn {
      width: 36px;
      height: 36px;
      padding: 0;
      margin: 0;
      border: none;
      border-radius: 6px;
      background-color: #f2f3f5;
      color: var(--text-color-secondary);

      &:hover,
      &:focus {
        background-color: #e8eaee;
        color: var(--text-color-regular);
      }
    }
  }

  .content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    margin-top: 16px;
  }

  .confirm-btn {
    margin-top: 8px;
    align-self: flex-start;
    border-radius: 4px;
  }
}

.section-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.el-header {
  height: 32px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0 0 8px 0;
  padding: 0;

  .header-tip {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 14px;
    color: var(--text-color-placeholder);
  }

  .btns-batch {
    display: flex;
    align-items: center;

    .el-button {
      border-radius: 4px;
      height: 32px;

      :deep(span) {
        font-size: 14px;
      }
    }
  }
}

.main-content {
  --el-main-padding: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: end;
  min-height: 0;
  gap: 16px;

  .publish-table-wrapper {
    width: 100%;
    flex: 1;
    min-height: 0;
  }

  :deep(.el-table) {
    width: 100%;
    height: 100%;

    thead tr th .cell {
      color: var(--text-color-regular);
      font-weight: 500;
    }
  }

  .icon-btn {
    &[aria-disabled="false"]:hover {
      color: var(--color-primary);
    }

    cursor: var(--cursor-pointer);
  }
}

.qrcode-container {
  padding: 12px 10px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: var(--bg-color-page);
  border-radius: 4px;

  .qrcode-title {
    margin-bottom: 5px;
  }

  .download-button {
    width: 150px;
    height: 25px;
    border-radius: 4px;
    margin-top: 10px;
  }
}

.operation-btn {
  margin-left: 0;
  padding: 0;
  border: none;
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
  color: var(--color-primary);

  &[aria-disabled="false"]:hover {
    color: var(--color-primary);
    text-decoration: none;
  }

  &[aria-disabled="true"] {
    color: var(--text-color-placeholder);
  }
}
</style>
