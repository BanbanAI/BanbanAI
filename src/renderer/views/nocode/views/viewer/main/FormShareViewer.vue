<template>
  <vn-stack
    class="form-share-viewer"
    :class="[{ mobile: isMobileDevice }, isPublicShare ? 'public-share' : 'inner-share']"
    v-model="activeTab"
  >
    <template v-if="isPublicShare">
      <div class="page-body">
        <div class="public-container">
          <div class="public-shell">
            <el-header v-if="showShareHeader" class="public-header">
              <div
                v-if="showFormTitle"
                class="title-wrap"
              >
                <h3>{{ table?.alias }}</h3>
              </div>
              <el-badge v-if="showDraftBoxEntry && drafts.length" :value="drafts.length" type="primary" :show-zero="false" class="drafts-btn-badge">
                <el-button class="drafts-btn" text @click="draftBoxListVisible = true" :title="$t('FormShareViewer.draftBox')">
                  <el-icon :size="16">
                    <i-ep-takeaway-box></i-ep-takeaway-box>
                  </el-icon>
                </el-button>
              </el-badge>
            </el-header>
            <div class="content">
              <submit-form-layer
                :active="true"
                :fieldsAuth="props.fieldsAuth"
                :formViewConfig="runtimeBaseConfig"
                @draft-saved="handleRefreshDraft"
              />
            </div>
          </div>
          <public-share-footer
            v-if="showFooter"
            class="share-footer"
            :publisher="publisher"
            :report-account="reportAccount"
            :light-text="footerLightText"
          />
        </div>
      </div>
    </template>
    <el-container v-else class="container">
      <div class="inner-shell">
        <el-header v-if="showShareHeader" class="inner-header">
          <div
            v-if="showFormTitle"
            class="title-wrap"
          >
            <h3>{{ table?.alias }}</h3>
          </div>
          <el-badge v-if="showDraftBoxEntry && drafts.length" :value="drafts.length" type="primary" :show-zero="false" class="drafts-btn-badge">
            <el-button class="drafts-btn" text @click="draftBoxListVisible = true" :title="$t('FormShareViewer.draftBox')">
              <el-icon :size="16">
                <i-ep-takeaway-box></i-ep-takeaway-box>
              </el-icon>
            </el-button>
          </el-badge>
        </el-header>
        <div class="content">
          <submit-form-layer
            :active="true"
            :fieldsAuth="props.fieldsAuth"
            :formViewConfig="runtimeBaseConfig"
            @draft-saved="handleRefreshDraft"
          />
        </div>
      </div>
    </el-container>
    <mobile-form-draft-list-dialog v-if="showDraftBoxEntry && isMobileDevice" v-model="draftBoxListVisible" :drafts="drafts" :table="table" @delete="handleDeleteDraft" @submitted="handleDraftSubmitted" @updated="handleRefreshDraft" />
    <form-draft-list v-else-if="showDraftBoxEntry" v-model="draftBoxListVisible" :drafts="drafts" :table="table" @delete="handleDeleteDraft" @submitted="handleDraftSubmitted" @updated="handleRefreshDraft" />
  </vn-stack>
</template>

<script lang='ts' setup>
import { NOCODE } from '@renderer/types';
import { FieldAuthValue, type FormViewConfig } from '@common/types/nocode';
import type { PropType } from 'vue';
import { computed, inject, ref } from 'vue';
import { provideFormData, provideFormTable } from '../../editor/form/hooks';
import { storeFactory } from '@renderer/utils';
import { SystemField } from '@common/utils';
import { Row, type FormShareConfig } from '@common/types/project';
import { isMobile } from '@renderer/utils';
import PublicShareFooter from '../../editor/components/PublicShareFooter.vue';

const isMobileDevice = isMobile();

const props = defineProps({
  tableId: {
    type: String,
    required: true,
  },
  fieldsAuth: {
    type: [Object, String] as PropType<Record<string, FieldAuthValue> | "all">,
    default: undefined,
  },
  shareConfig: {
    type: Object as PropType<FormShareConfig>,
    default: undefined,
  },
  publisher: {
    type: Object as PropType<{
      userId?: string,
      user?: string,
      realname?: string,
    }>,
    default: undefined,
  },
  reportAccount: {
    type: String,
    default: "",
  },
  isPublicShare: {
    type: Boolean,
    default: false,
  },
});

const nocode = inject(NOCODE);
const activeTab = ref('form');
const draftBoxListVisible = ref(false);
const draftsVersion = ref(0);
const draftStorage = computed(() => {
  const tableId = props.tableId;
  return storeFactory(`TABLE_DRAFT_${tableId}`);
});
const drafts = computed(() => {
  void draftsVersion.value;
  return draftStorage.value?.get() || [];
});
const formData = computed(() => {
  return nocode?.value?.body?.formData;
});
const table = computed(() => {
  return formData.value?.tables?.find(t => t.uid === props.tableId);
});

const runtimeBaseConfig = computed<FormViewConfig | undefined>(() => {
  const baseConfig = props.shareConfig?.baseConfig;
  if (!baseConfig || !isPublicShare.value) {
    return baseConfig;
  }
  return {
    ...baseConfig,
    buttons: {
      ...baseConfig.buttons,
      saveDraft: {
        ...baseConfig.buttons?.saveDraft,
        visible: false,
      },
    },
  };
});
const publisher = computed(() => props.publisher);
const reportAccount = computed(() => props.reportAccount || "");
const isPublicShare = computed(() => !!props.isPublicShare);
const showFormTitle = computed(() => true);
const showDraftBoxEntry = computed(() => !isPublicShare.value);
const showShareHeader = computed(() => showFormTitle.value || (showDraftBoxEntry.value && drafts.value.length > 0));
const showFooter = computed(() => true);
const footerLightText = ref(false);

const handleRefreshDraft = () => {
  draftsVersion.value += 1;
  if (!drafts.value.length) {
    draftBoxListVisible.value = false;
  }
}

const handleDraftSubmitted = (row: Row) => {
  const rows = draftStorage.value.get();
  const index = rows.findIndex(r => r[SystemField.UUID] === row[SystemField.UUID]);
  if (index > -1) {
    rows.splice(index, 1);
    draftStorage.value.set(rows);
  }
  handleRefreshDraft();
}

const handleDeleteDraft = (row: Row) => {
  const rows = draftStorage.value.get();
  const index = rows.findIndex(r => r[SystemField.UUID] === row[SystemField.UUID]);
  if (index > -1) {
    rows.splice(index, 1);
    draftStorage.value.set(rows);
  }
  handleRefreshDraft();
}

provideFormData(formData);
provideFormTable(table);
</script>

<style lang='scss' scoped>
.form-share-viewer{
  position: relative;
  height: 100%;
  overflow: hidden;
}

.page-body,
.container {
  position: relative;
  z-index: 1;
}

.title-wrap {
  flex: 1;
  min-width: 0;
  min-height: 50px;
  padding-left: 0;
  padding-right: 0;

  h3 {
    width: 100%;
    margin: 0;
    font-size: inherit;
    line-height: inherit;
    font-weight: inherit;
    font-style: inherit;
    color: inherit;
    text-decoration: inherit;
    word-break: break-word;
  }
}

.drafts-btn {
  margin-left: 0;
  width: 28px;
  min-width: 28px;
  padding: 0;
  border-radius: 4px;
  -webkit-tap-highlight-color: transparent;
}

.drafts-btn-badge {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
}

.form-share-viewer.public-share {
  display: flex;
  flex-direction: column;

  .page-body {
    flex: 1;
    min-height: 0;
    padding: 16px 24px 12px;
  }

  .public-container {
    width: 780px;
    max-width: 100%;
    height: 100%;
    min-height: 0;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .public-shell {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 4px;
    background-color: var(--bg-color-page);
    box-shadow: 0 2px 9px 0 hsla(0, 0%, 65%, .5);
  }

  .public-header {
    position: relative;
    width: 100%;
    min-height: 50px;
    padding: 0 16px;
    border-bottom: 1px solid #e5e6eb;
    display: flex;
    align-items: center;
    column-gap: 8px;
    box-sizing: border-box;
    background-color: var(--bg-color-page);
  }

  .content {
    width: 100%;
    flex: 1;
    min-height: 0;
    background-color: var(--bg-color-page);
    overflow: hidden;

    .vn-stack-layer {
      height: 100%;
    }
  }

  :deep(.public-share-footer) {
    width: 100%;
    margin: 0 auto;
  }

  :deep(.el-badge) {
    .el-badge__content {
      width: 18px;
      height: 18px;
    }
  }
}

.form-share-viewer.public-share.mobile {
  .page-body {
    width: 100%;
    padding: 8px 6px 12px;
  }

  .public-container {
    width: 100%;
    gap: 6px;
  }

  .public-shell {
    border-radius: 8px;
    box-shadow: none;
  }

  .public-header {
    height: auto;
    min-height: 50px;
    padding: 8px 12px;
    flex-wrap: wrap;
    row-gap: 8px;
  }

  .title-wrap {
    width: 100%;
  }
}

.form-share-viewer.inner-share {
  .container {
    display: flex;
    flex-direction: column;
    background-color: transparent;
    height: 100%;
    padding: 16px 24px 12px;
    box-sizing: border-box;
    justify-content: center;
    align-items: center;
    overflow: hidden;

    .inner-shell {
      width: 780px;
      max-width: 100%;
      height: 100%;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border-radius: 4px;
      background-color: var(--bg-color-page);
      box-shadow: 0 2px 9px 0 hsla(0, 0%, 65%, .5);
    }

  .inner-header {
      position: relative;
      width: 100%;
      min-height: 50px;
      padding: 0 16px;
      border-bottom: 1px solid #e5e6eb;
      display: flex;
      align-items: center;
      column-gap: 8px;
      box-sizing: border-box;
      background-color: var(--bg-color-page);
    }

    .content {
      width: 100%;
      flex: 1;
      min-height: 0;
      background-color: var(--bg-color-page);
      overflow: hidden;

      .vn-stack-layer {
        height: 100%;
      }
    }
  }
}

.form-share-viewer.inner-share.mobile {
  overflow: hidden;

  .container {
    width: 100%;
    background-color: transparent;
    padding: 8px 6px 12px;
    display: flex;
    flex-direction: column;

    .inner-shell {
      width: 100%;
      border-radius: 8px;
      box-shadow: none;
    }

    .inner-header {
      width: 100%;
      height: auto;
      min-height: 50px;
      padding: 8px 12px;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      row-gap: 8px;
    }

    .title-wrap {
      width: 100%;
    }

    .content {
      width: 100%;
      box-shadow: none;
    }
  }
}
</style>
