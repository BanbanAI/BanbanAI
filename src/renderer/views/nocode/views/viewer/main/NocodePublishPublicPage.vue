<template>
  <div class="nocode-public-publish">
    <div class="content">
      <div class="aside">
        <div class="project">
          <el-input
            v-model="searchVal"
            :placeholder="$t('NocodePublishPublicPage.searchKeyword')"
            :prefix-icon="Search"
          />

          <el-scrollbar class="scrollbar">
            <el-tree
              style="max-width: 600px"
              :data="filterPublishTree"
              @node-click="handleNodeClick"
              ref="treeRef"
              :filter-node-method="filterTree"
              :empty-text="$t('NocodePublishPublicPage.noContent')"
              :icon="ArrowDownBold"
              :indent="24"
            >
              <template #default="{ node, data }">
                <div class="custom-tree-node" :class="{ 'active': activePublishId === data.id }">
                  <div :class="['node-icon', data.type]">
                    <el-icon size="20" v-if="!node.expanded && data.type === NocodeStructureType.GROUP">
                      <i-ven-global-page-folder />
                    </el-icon>
                    <el-icon size="20" v-else-if="node.expanded && data.type === NocodeStructureType.GROUP">
                      <i-ven-global-page-folder-open />
                    </el-icon>
                    <el-icon size="20" v-else-if="data.type === NocodeStructureType.FORM">
                      <i-ven-global-page-form />
                    </el-icon>
                    <el-icon size="20" v-else-if="data.type === NocodeStructureType.PAGE">
                      <i-ven-global-page-document />
                    </el-icon>
                  </div>
                  <span :title="data.name">{{ data.name }}</span>
                </div>
              </template>
            </el-tree>
          </el-scrollbar>
        </div>
      </div>

      <div class="line"></div>

      <div class="main" v-if="currentBoard || (currentForm && currentFormPublish)">
        <div v-if="currentBoard" class="setting-panel board-publish-panel">
          <div class="setting-switch-item">
            <div class="switch-label">{{ $t('NocodePublishPublicPage.enablePublish') }}</div>
            <div class="switch-control">
              <el-switch v-model="boardPublishEnabled" size="small" />
            </div>
          </div>

          <div class="setting-block">
            <div class="block-label">{{ $t('NocodePublishPublicPage.publishMode') }}</div>
            <div class="block-control">
              <el-radio-group v-model="publicUpdateMethod">
                <el-radio :value="PublishUpdateMethod.LIVE">{{ $t('NocodePublishPublicPage.live') }}</el-radio>
                <el-radio :value="PublishUpdateMethod.MANUAL">{{ $t('NocodePublishPublicPage.manual') }}</el-radio>
              </el-radio-group>
            </div>
          </div>

          <div class="setting-switch-item" style="margin-bottom: 12px;">
            <div class="switch-label">{{ $t('NocodePublishPublicPage.passwordAccess') }}</div>
            <div class="switch-control">
              <el-switch v-model="boardPasswordAccessEnabled" size="small" :disabled="!boardPublishEnabled" />
            </div>
          </div>

          <div v-if="boardPublishEnabled && boardPasswordAccessEnabled" class="setting-block">
            <div class="block-control">
              <el-input
                v-model="boardPublishPassword"
                class="password-input"
                type="password"
                :placeholder="$t('NocodePublishPublicPage.inputPassword')"
                @copy.prevent
                @cut.prevent
              />
            </div>
          </div>

          <div class="setting-block">
            <div class="block-label">{{ $t('NocodePublishPublicPage.shareExpireTime') }}</div>
            <div class="block-control">
              <el-config-provider :locale="locale">
                <el-date-picker
                  v-model="currentBoard.shareExpireTime"
                  class="expire-time"
                  type="date"
                  size="small"
                  value-format="x"
                  :placeholder="$t('NocodePublishPublicPage.selectExpireTime')"
                  :disabled-date="onDisabledDate"
                  :disabled="!boardPublishEnabled"
                  @change="handleExpireTimeChange(currentBoard)"
                />
              </el-config-provider>
            </div>
          </div>

          <div class="setting-block">
            <div class="block-label">{{ $t('NocodePublishPublicPage.accessLink') }}</div>
            <div class="block-control link-control">
              <el-input :model-value="boardShareUrl" readonly :disabled="!boardPublishEnabled" />
              <div class="link-actions">
                <el-button class="icon-btn" :disabled="!boardPublishEnabled" @click="handleCopyCurrentUrl">
                  <el-icon><i-ven-copy-link></i-ven-copy-link></el-icon>
                </el-button>
                <el-button class="icon-btn" :disabled="!boardPublishEnabled" @click="handleShowCurrentQr">
                  <el-icon><i-ven-qr-code></i-ven-qr-code></el-icon>
                </el-button>
                <el-button class="icon-btn" :disabled="!boardPublishEnabled" @click="handleOpenCurrentUrl">
                  <el-icon><i-ven-share-link></i-ven-share-link></el-icon>
                </el-button>
              </div>
            </div>
          </div>
        </div>

        <vn-stack v-else v-model="activePublicTab" class="public-stack">
          <div class="tab">
            <vn-stack-tab class="tab-item" name="formPublish">
              <span>{{ $t('NocodePublishPublicPage.formPublish') }}</span>
            </vn-stack-tab>
            <vn-stack-tab class="tab-item" name="rowShare">
              <span>{{ $t('NocodePublishPublicPage.rowShare') }}</span>
            </vn-stack-tab>
            <vn-stack-tab class="tab-item" name="publicQuery">
              <span>{{ $t('NocodePublishPublicPage.publicQuery') }}</span>
            </vn-stack-tab>
          </div>

          <vn-stack-layer name="formPublish" class="stack-layer">
            <div class="setting-panel form-publish-panel">
              <div class="setting-switch-item">
                <div class="switch-label">{{ $t('NocodePublishPublicPage.enablePublish') }}</div>
                <div class="switch-control">
                  <el-switch v-model="formPublishEnabled" size="small" />
                </div>
              </div>

              <div class="setting-block">
                <div class="block-label">{{ $t('NocodePublishPublicPage.publishMode') }}</div>
                <div class="block-control">
                  <el-radio-group v-model="currentFormUpdateMethod">
                    <el-radio :value="PublishUpdateMethod.LIVE">{{ $t('NocodePublishPublicPage.live') }}</el-radio>
                    <el-radio :value="PublishUpdateMethod.MANUAL">{{ $t('NocodePublishPublicPage.manual') }}</el-radio>
                  </el-radio-group>
                </div>
              </div>

              <div class="setting-switch-item" style="margin-bottom: 12px;">
                <div class="switch-label">{{ $t('NocodePublishPublicPage.passwordAccess') }}</div>
                <div class="switch-control">
                  <el-switch v-model="passwordAccessEnabled" size="small" :disabled="!formPublishEnabled" />
                </div>
              </div>

              <div v-if="formPublishEnabled && passwordAccessEnabled" class="setting-block">
                <div class="block-control">
                  <el-input
                    v-model="publishPassword"
                    class="password-input"
                    type="password"
                    :placeholder="$t('NocodePublishPublicPage.inputPassword')"
                    @copy.prevent
                    @cut.prevent
                  />
                </div>
              </div>

              <div class="setting-block">
                <div class="block-label">{{ $t('NocodePublishPublicPage.shareExpireTime') }}</div>
                <div class="block-control">
                  <el-config-provider :locale="locale">
                    <el-date-picker
                      v-model="currentFormPublish.shareExpireTime"
                      class="expire-time"
                      type="date"
                      size="small"
                      value-format="x"
                      :placeholder="$t('NocodePublishPublicPage.selectExpireTime')"
                      :disabled-date="onDisabledDate"
                      :disabled="!formPublishEnabled"
                      @change="handleExpireTimeChange(currentForm)"
                    />
                  </el-config-provider>
                </div>
              </div>

              <div class="setting-block">
                <div class="block-label">{{ $t('NocodePublishPublicPage.accessLink') }}</div>
                <div class="block-control link-control">
                  <el-input :model-value="formShareUrl" readonly :disabled="!formPublishEnabled" />
                  <div class="link-actions">
                    <el-button class="icon-btn" :disabled="!formPublishEnabled" @click="handleCopyCurrentUrl">
                      <el-icon><i-ven-copy-link></i-ven-copy-link></el-icon>
                    </el-button>
                    <el-button class="icon-btn" :disabled="!formPublishEnabled" @click="handleShowCurrentQr">
                      <el-icon><i-ven-qr-code></i-ven-qr-code></el-icon>
                    </el-button>
                    <el-button class="icon-btn" :disabled="!formPublishEnabled" @click="handleOpenCurrentUrl">
                      <el-icon><i-ven-share-link></i-ven-share-link></el-icon>
                    </el-button>
                  </div>
                </div>
              </div>
            </div>
          </vn-stack-layer>

          <vn-stack-layer name="rowShare" class="stack-layer">
            <div class="setting-panel">
              <div class="setting-item setting-switch-item">
                <div class="switch-label">{{ $t('NocodePublishPublicPage.enablePublish') }}</div>
                <div class="switch-control">
                  <el-switch v-model="rowShareEnabled" size="small" />
                </div>
              </div>

              <div v-if="rowShareEnabled" class="field-section">
                <div class="row-share-access-block">
                  <div class="row-share-access-title">{{ $t('NocodePublishPublicPage.internalShare') }}</div>
                  <div class="row-share-access-item">
                    <div class="switch-control">
                      <el-checkbox v-model="rowShareInternalPasswordEnabled" />
                    </div>
                    <div class="switch-label">{{ $t('NocodePublishPublicPage.passwordAccess') }}</div>
                    <div class="switch-control">
                      <el-checkbox v-model="rowShareInternalExpireEnabled" />
                    </div>
                    <div class="switch-label">{{ $t('NocodePublishPublicPage.shareExpireTime') }}</div>
                  </div>
                </div>
                <div class="row-share-access-block">
                  <div class="row-share-access-title">{{ $t('NocodePublishPublicPage.publicShare') }}</div>
                  <div class="row-share-access-item">
                    <div class="switch-control">
                      <el-checkbox v-model="rowSharePublicPasswordEnabled" />
                    </div>
                    <div class="switch-label">{{ $t('NocodePublishPublicPage.passwordAccess') }}</div>
                    <div class="switch-control">
                      <el-checkbox v-model="rowSharePublicExpireEnabled" />
                    </div>
                    <div class="switch-label">{{ $t('NocodePublishPublicPage.shareExpireTime') }}</div>
                  </div>
                </div>
                <row-share-field-setting :key="currentForm.uid" :table="currentForm" :nocode="nocode" />
              </div>
            </div>
          </vn-stack-layer>

          <vn-stack-layer name="publicQuery" class="stack-layer">
            <div class="setting-panel form-publish-panel">
              <div class="setting-switch-item">
                <div class="switch-label">{{ $t('NocodePublishPublicPage.enablePublish') }}</div>
                <div class="switch-control">
                  <el-switch v-model="publicQueryEnabled" size="small" />
                </div>
              </div>

              <template v-if="publicQueryEnabled">
                <div class="setting-block">
                  <div class="block-label">{{ $t('NocodePublishPublicPage.queryCondition') }}</div>
                  <div class="block-control">
                    <field-select
                      class="field-select-input"
                      v-model="publicQueryConditionFieldUIDs"
                      :options="publicQueryConditionFieldOptions"
                      popper-class="public-query-field-tags-popper"
                      multiple
                      filterable
                      collapse-tags
                      collapse-tags-tooltip
                    />
                  </div>
                </div>

                <div class="setting-block">
                  <div class="block-label">{{ $t('NocodePublishPublicPage.displayContent') }}</div>
                  <div class="block-control">
                    <field-select
                      class="field-select-input"
                      v-model="publicQueryDisplayFieldUIDs"
                      :options="publicQueryDisplayFieldOptions"
                      popper-class="public-query-field-tags-popper"
                      multiple
                      filterable
                      collapse-tags
                      collapse-tags-tooltip
                    />
                  </div>
                </div>

                <div class="setting-switch-item" style="margin-bottom: 12px;">
                  <div class="switch-label">{{ $t('NocodePublishPublicPage.passwordAccess') }}</div>
                  <div class="switch-control">
                    <el-switch v-model="publicQueryPasswordAccessEnabled" size="small" />
                  </div>
                </div>

                <div v-if="publicQueryPasswordAccessEnabled" class="setting-block">
                  <div class="block-control">
                    <el-input
                      v-model="publicQueryPassword"
                      class="password-input"
                      type="password"
                      :placeholder="$t('NocodePublishPublicPage.inputPassword')"
                      @copy.prevent
                      @cut.prevent
                    />
                  </div>
                </div>

                <div class="setting-block">
                  <div class="block-label">{{ $t('NocodePublishPublicPage.shareExpireTime') }}</div>
                  <div class="block-control">
                    <el-config-provider :locale="locale">
                      <el-date-picker
                        v-model="publicQueryShareExpireTime"
                        class="expire-time"
                        type="date"
                        size="small"
                        value-format="x"
                        :placeholder="$t('NocodePublishPublicPage.selectExpireTime')"
                        :disabled-date="onDisabledDate"
                      />
                    </el-config-provider>
                  </div>
                </div>

                <div class="setting-block">
                  <div class="block-label">{{ $t('NocodePublishPublicPage.accessLink') }}</div>
                  <div class="block-control link-control">
                    <el-input :model-value="publicQueryShareUrl" readonly />
                    <div class="link-actions">
                      <el-button class="icon-btn" @click="handleCopyPublicQueryUrl">
                        <el-icon><i-ven-copy-link></i-ven-copy-link></el-icon>
                      </el-button>
                      <el-button class="icon-btn" @click="handleShowPublicQueryQr">
                        <el-icon><i-ven-qr-code></i-ven-qr-code></el-icon>
                      </el-button>
                      <el-button class="icon-btn" @click="handleOpenPublicQueryUrl">
                        <el-icon><i-ven-share-link></i-ven-share-link></el-icon>
                      </el-button>
                      <el-button class="embed-web-btn" @click="handleOpenPublicQueryEmbedDialog">
                        <el-icon><i-ven-frame></i-ven-frame></el-icon>
                        <span>{{ $t('NocodePublishPublicPage.embedWeb') }}</span>
                      </el-button>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </vn-stack-layer>
        </vn-stack>

        <el-dialog
          v-model="publicQueryEmbedDialogVisible"
          class="public-query-embed-dialog"
          :title="$t('NocodePublishPublicPage.embedWeb')"
          width="520px"
          align-center
        >
          <div class="embed-dialog-content">
            <div class="embed-code-label">{{ $t('NocodePublishPublicPage.embedCode') }}</div>
            <div class="embed-code-box">
              <el-input
                type="textarea"
                :rows="3"
                resize="none"
                readonly
                :model-value="publicQueryIframeCode"
              />
              <el-button class="embed-copy-btn" text @click="handleCopyPublicQueryIframeCode">
                <el-icon><i-ven-copy-link></i-ven-copy-link></el-icon>
              </el-button>
            </div>
          </div>
        </el-dialog>

        <el-popover :visible="qrCodeVisible" :virtual-ref="virtualRef" trigger="click" width="176" :popper-style="{ padding: 0 }">
          <div class="qrcode-container" v-click-outside="onClickOutside">
            <div class="qrcode-title">{{ $t('NocodePublishPublicPage.scanToAccess') }}</div>
            <Qrcode :size="150" :value="qrCodeUrl" level="L" />
            <el-button class="download-button" plain @click="downloadQrcode"><el-icon><i-ep-download /></el-icon>{{ $t('NocodePublishPublicPage.download') }}</el-button>
          </div>
        </el-popover>
      </div>

      <div v-else class="empty-box">
        {{ $t('NocodePublishPublicPage.selectPublishTargetTip') }}
      </div>
    </div>

    <hr>
    <el-button class="save-button" type="primary" @click="handleSave">{{ $t('NocodePublishPublicPage.confirm') }}</el-button>
    <nocode-update-tip-dialog ref="updateTipDialogRef"></nocode-update-tip-dialog>
    <nocode-update-tip-dialog ref="visitPageTipDialogRef"></nocode-update-tip-dialog>
  </div>
</template>

<script setup lang="ts">
import { FormWidgetType, NocodeStructureType, type NocodeStructure } from '@common/types/nocode';
import { PublishCategory, PublishUpdateMethod, type Field, type ProjectBody, type Table } from '@common/types/project';
import Qrcode from 'qrcode.vue';
import { ClickOutside as vClickOutside } from 'element-plus';
import { ArrowDownBold, Search } from '@element-plus/icons-vue';
import type { PropType } from 'vue';
import { computed, ref, toRefs, watch } from 'vue';
import { debounce } from 'lodash';
import { useSettingStore } from '@renderer/stores';
import { useClipboard } from '@vueuse/core';
import { ElMessage } from 'element-plus';
import { isSystemField, SystemField } from '@common/utils';
import { getPublicQueryFieldFuncInfo, isSupportedPublicQueryField } from '@renderer/views/nocode/views/utils/publicQuery';
import i18next from 'i18next';
import RowShareFieldSetting from './RowShareFieldSetting.vue';
import type { PublishSettingState } from './usePublishSettingState';
import { filterPublishStructure } from './publishTree';
import { elementPlusLocale as locale } from '@renderer/utils/elementPlusLocale';

const props = defineProps({
  publishState: {
    type: Object as PropType<PublishSettingState>,
    required: true,
  },
});
const { publishState } = toRefs(props);

const settingStore = useSettingStore();
const { copy } = useClipboard({ legacy: true });
const updateTipDialogRef = ref();
const visitPageTipDialogRef = ref();
const publicQueryEmbedDialogVisible = ref(false);
const searchVal = ref('');
const treeRef = ref(null);
const activePublishId = ref('');
const publicQueryConditionCapabilityMap = ref<Record<string, boolean>>({});

const {
  nocode: nocodeRef,
  activePublicTab,
  isPageUpdate,
  publicUpdateMethod,
  innerPublishForms,
  innerPublishPages,
  publicPageIds,
  publicFormIds,
  qrCodeVisible,
  virtualRef,
  qrCodeUrl,
  onClickOutside,
  downloadQrcode,
  onDisabledDate,
  handleExpireTimeChange,
  handleBoardPasswordChange,
  handleFormPasswordChange,
  handlePublicQueryPasswordChange,
  handleCopyPublicUrl,
  handleOpenPublishUrl,
  handleShowQrCode,
  handleConfirm,
  checkUpdate: checkPublishUpdate,
} = publishState.value;

const nocode = computed(() => nocodeRef.value);

const filterPublishTree = computed(() => {
  return filterPublishStructure(nocode.value?.body?.structure || []);
});

const findFirstPublishNode = (tree: NocodeStructure[]) => {
  for (const node of tree) {
    if (node.type === NocodeStructureType.PAGE || node.type === NocodeStructureType.FORM) {
      return node.id;
    }
    if (node.children?.length) {
      const found = findFirstPublishNode(node.children);
      if (found) return found;
    }
  }
  return '';
};

watch(filterPublishTree, (tree) => {
  const hasActiveForm = innerPublishForms.value.some(form => form.uid === activePublishId.value);
  const hasActivePage = innerPublishPages.value.some(page => page.id === activePublishId.value);
  if (!activePublishId.value || (!hasActiveForm && !hasActivePage)) {
    activePublishId.value = findFirstPublishNode(tree);
  }
}, { immediate: true, deep: true });

const handleNodeClick = (data: NocodeStructure) => {
  if (data.type !== NocodeStructureType.PAGE && data.type !== NocodeStructureType.FORM) return;
  activePublishId.value = data.id;
};

const filterTree = (value: string, data: { name?: string }) => {
  if (!value) return true;
  return String(data.name || '').includes(value);
};

const debouncedFilter = debounce((val: string) => {
  treeRef.value?.filter(val);
}, 300);

watch(searchVal, (val) => {
  debouncedFilter(val);
});

const currentForm = computed<Table | undefined>(() => {
  return innerPublishForms.value.find(form => form.uid === activePublishId.value);
});

const currentBoard = computed<ProjectBody | undefined>(() => {
  return innerPublishPages.value.find(page => page.id === activePublishId.value);
});

const currentPublishTarget = computed<ProjectBody | Table | undefined>(() => {
  return currentBoard.value || currentForm.value;
});

const ensureCurrentPublish = () => {
  if (!currentForm.value) {
    return null;
  }
  currentForm.value.publish = currentForm.value.publish || {};
  return currentForm.value.publish;
};

const currentFormPublish = computed(() => {
  return currentForm.value?.publish;
});

const boardPublishEnabled = computed({
  get: () => {
    return !!currentBoard.value?.isPublicShare && !!currentBoard.value?.sharing;
  },
  set: (value: boolean) => {
    if (!currentBoard.value?.id) return;

    currentBoard.value.isPublicShare = value;

    if (value) {
      currentBoard.value.sharing = true;
      if (!publicPageIds.value.includes(currentBoard.value.id)) {
        publicPageIds.value = [...publicPageIds.value, currentBoard.value.id];
      }
      return;
    }

    publicPageIds.value = publicPageIds.value.filter(id => id !== currentBoard.value?.id);
    currentBoard.value.isNeedPassword = false;
  },
});

const boardPasswordAccessEnabled = computed({
  get: () => {
    return !!currentBoard.value?.isNeedPassword;
  },
  set: (value: boolean) => {
    if (!currentBoard.value) return;
    currentBoard.value.isNeedPassword = value;
    if (!value) {
      currentBoard.value.password = '';
    }
  },
});

const boardPublishPassword = computed({
  get: () => {
    return String(currentBoard.value?.password || '');
  },
  set: (value: string) => {
    if (!currentBoard.value) return;
    currentBoard.value.password = value;
    handleBoardPasswordChange(currentBoard.value);
  },
});


const currentFormUpdateMethod = computed({
  get: () => {
    return currentForm.value?.publish?.updateMethod || PublishUpdateMethod.LIVE;
  },
  set: (value: PublishUpdateMethod) => {
    const publish = ensureCurrentPublish();
    if (!publish) {
      return;
    }
    publish.updateMethod = value;
  },
});

const formPublishEnabled = computed({
  get: () => {
    return !!currentForm.value?.publish?.isPublicShare && !!currentForm.value?.publish?.sharing;
  },
  set: (value: boolean) => {
    const publish = ensureCurrentPublish();
    if (!publish || !currentForm.value) return;

    publish.isPublicShare = value;
    publish.sharing = value;

    if (value) {
      if (!publicFormIds.value.includes(currentForm.value.uid)) {
        publicFormIds.value = [...publicFormIds.value, currentForm.value.uid];
      }
      return;
    }

    publicFormIds.value = publicFormIds.value.filter(uid => uid !== currentForm.value?.uid);
    publish.isNeedPassword = false;
  },
});

const passwordAccessEnabled = computed({
  get: () => {
    return !!currentForm.value?.publish?.isNeedPassword;
  },
  set: (value: boolean) => {
    const publish = ensureCurrentPublish();
    if (!publish) return;
    publish.isNeedPassword = value;
    if (!value) {
      publish.password = '';
    }
  },
});

const publishPassword = computed({
  get: () => {
    return String(currentForm.value?.publish?.password || '');
  },
  set: (value: string) => {
    const publish = ensureCurrentPublish();
    if (!publish || !currentForm.value) return;
    publish.password = value;
    handleFormPasswordChange(currentForm.value);
  },
});

const rowShareEnabled = computed({
  get: () => {
    return !!currentForm.value?.publish?.rowShareEnabled;
  },
  set: (value: boolean) => {
    const publish = ensureCurrentPublish();
    if (!publish) return;
    publish.rowShareEnabled = value;
  },
});

const rowShareInternalPasswordEnabled = computed({
  get: () => {
    return !!currentForm.value?.publish?.rowShareInternalAccess?.passwordEnabled;
  },
  set: (value: boolean) => {
    const publish = ensureCurrentPublish();
    if (!publish) return;
    publish.rowShareInternalAccess = publish.rowShareInternalAccess || {};
    publish.rowShareInternalAccess.passwordEnabled = value;
  },
});

const rowShareInternalExpireEnabled = computed({
  get: () => {
    return !!currentForm.value?.publish?.rowShareInternalAccess?.expireEnabled;
  },
  set: (value: boolean) => {
    const publish = ensureCurrentPublish();
    if (!publish) return;
    publish.rowShareInternalAccess = publish.rowShareInternalAccess || {};
    publish.rowShareInternalAccess.expireEnabled = value;
  },
});

const rowSharePublicPasswordEnabled = computed({
  get: () => {
    return !!currentForm.value?.publish?.rowSharePublicAccess?.passwordEnabled;
  },
  set: (value: boolean) => {
    const publish = ensureCurrentPublish();
    if (!publish) return;
    publish.rowSharePublicAccess = publish.rowSharePublicAccess || {};
    publish.rowSharePublicAccess.passwordEnabled = value;
  },
});

const rowSharePublicExpireEnabled = computed({
  get: () => {
    return !!currentForm.value?.publish?.rowSharePublicAccess?.expireEnabled;
  },
  set: (value: boolean) => {
    const publish = ensureCurrentPublish();
    if (!publish) return;
    publish.rowSharePublicAccess = publish.rowSharePublicAccess || {};
    publish.rowSharePublicAccess.expireEnabled = value;
  },
});

const isSubFormField = (field: Field) => {
  const widgetType = field?.meta?.extra?.widgetType;
  return field?.meta?.subType === 'subForm' || widgetType === FormWidgetType.SUBFORM;
};

const PUBLIC_QUERY_VISIBLE_SYSTEM_FIELDS = new Set<SystemField>([
  SystemField.UUID,
  SystemField.DATA_TITLE,
  SystemField.CREATE_OWNER,
  SystemField.DATA_OWNER,
  SystemField.CREATE_TIME,
  SystemField.UPDATE_TIME,
]);

const isPublicQueryVisibleSystemField = (field: Field) => {
  return PUBLIC_QUERY_VISIBLE_SYSTEM_FIELDS.has(field.meta?.name as SystemField);
};

const isPublicQueryDisplayRootField = (field: Field) => {
  if (!field) {
    return false;
  }
  if (field.meta?.subType === 'related') {
    return false;
  }
  return !isSystemField(field) || isPublicQueryVisibleSystemField(field);
};

const isPublicQueryDisplaySubField = (field: Field) => {
  if (!field) {
    return false;
  }
  if (field.meta?.subType === 'related') {
    return false;
  }
  return !isSystemField(field) || [SystemField.UUID].includes(field.meta?.name as SystemField);
};

const isPublicQueryConditionField = (field: Field) => {
  if (!field || isSystemField(field)) {
    return false;
  }
  if (field.meta?.subType === 'related' || isSubFormField(field)) {
    return false;
  }
  const widgetType = field?.meta?.extra?.widgetType;
  if ([FormWidgetType.RELATED_DATA, FormWidgetType.DATE_RANGE_PICKER].includes(widgetType as FormWidgetType)) {
    return false;
  }
  if ([SystemField.DATA_TITLE, SystemField.UUID, SystemField.RELATED_SUB_FORM].includes(field.meta?.name as SystemField)) {
    return false;
  }
  return publicQueryConditionCapabilityMap.value[field.uid] === true;
};

const loadPublicQueryConditionCapabilityMap = async () => {
  const fields = currentForm.value?.fields || [];
  const capabilityEntries = await Promise.all(fields.map(async (field) => {
    const funcInfo = await getPublicQueryFieldFuncInfo(field);
    const supported = isSupportedPublicQueryField(field, funcInfo);
    return [field.uid, supported] as const;
  }));
  publicQueryConditionCapabilityMap.value = Object.fromEntries(capabilityEntries);
};

const resolveSubFormFields = (field: Field) => {
  if (Array.isArray(field.subTableFields) && field.subTableFields.length) {
    return field.subTableFields;
  }
  const subTableUID = field?.meta?.extra?.subTableUID?.[1];
  if (!subTableUID) {
    return [];
  }
  return nocode.value?.body?.formData?.tables?.find(table => table.uid === subTableUID)?.fields || [];
};

const publicQueryConditionFieldOptions = computed(() => {
  return (currentForm.value?.fields || [])
    .filter(isPublicQueryConditionField)
    .map(field => ({
      label: field.alias,
      value: field.uid,
    }));
});

const publicQueryDisplayFieldOptions = computed(() => {
  return (currentForm.value?.fields || []).reduce<{ label: string; value: string }[]>((prev, field) => {
    if (!isPublicQueryDisplayRootField(field)) {
      return prev;
    }
    prev.push({
      label: field.alias,
      value: field.uid,
    });
    if (!isSubFormField(field)) {
      return prev;
    }
    const subFormFields = resolveSubFormFields(field);
    for (const subField of subFormFields) {
      if (!isPublicQueryDisplaySubField(subField)) {
        continue;
      }
      prev.push({
        label: `${field.alias}.${subField.alias}`,
        value: subField.uid,
      });
    }
    return prev;
  }, []);
});

const allPublicQueryConditionFieldUIDs = computed(() => {
  return publicQueryConditionFieldOptions.value.map(field => String(field.value));
});

watch(() => currentForm.value?.uid, async () => {
  publicQueryConditionCapabilityMap.value = {};
  await loadPublicQueryConditionCapabilityMap();
}, {
  immediate: true,
});

const allPublicQueryDisplayFieldUIDs = computed(() => {
  return publicQueryDisplayFieldOptions.value.map(field => String(field.value));
});

const getPublicQueryConfig = () => {
  return currentForm.value?.publish?.publicQuery;
};

const ensurePublicQueryConfig = () => {
  const publish = ensureCurrentPublish();
  if (!publish) return null;
  publish.publicQuery = publish.publicQuery || {};
  return publish.publicQuery;
};

const publicQueryEnabled = computed({
  get: () => {
    return !!getPublicQueryConfig()?.enabled;
  },
  set: (value: boolean) => {
    if (!ensureCurrentPublish() || !currentForm.value) return;
    const publicQuery = ensurePublicQueryConfig();
    if (!publicQuery) return;
    publicQuery.enabled = value;
    if (value) {
      if (!Array.isArray(publicQuery.conditionFieldUIDs)) {
        publicQuery.conditionFieldUIDs = [...allPublicQueryConditionFieldUIDs.value];
      }
      if (!Array.isArray(publicQuery.displayFieldUIDs)) {
        publicQuery.displayFieldUIDs = [...allPublicQueryDisplayFieldUIDs.value];
      }
      if (publicQuery.isNeedPassword === undefined) {
        publicQuery.isNeedPassword = false;
      }
    }
  },
});

const publicQueryConditionFieldUIDs = computed({
  get: () => {
    const conditionFieldUIDs = getPublicQueryConfig()?.conditionFieldUIDs;
    if (Array.isArray(conditionFieldUIDs)) {
      const validFieldUIDs = new Set(publicQueryConditionFieldOptions.value.map(option => String(option.value)));
      return conditionFieldUIDs.filter(uid => validFieldUIDs.has(String(uid)));
    }
    return [];
  },
  set: (value: string[]) => {
    const publicQuery = ensurePublicQueryConfig();
    if (!publicQuery) return;
    publicQuery.conditionFieldUIDs = Array.isArray(value) ? value : [];
  },
});

const publicQueryDisplayFieldUIDs = computed({
  get: () => {
    const displayFieldUIDs = getPublicQueryConfig()?.displayFieldUIDs;
    if (Array.isArray(displayFieldUIDs)) {
      return displayFieldUIDs;
    }
    return [];
  },
  set: (value: string[]) => {
    const publicQuery = ensurePublicQueryConfig();
    if (!publicQuery) return;
    publicQuery.displayFieldUIDs = Array.isArray(value) ? value : [];
  },
});

const publicQueryPasswordAccessEnabled = computed({
  get: () => {
    return !!getPublicQueryConfig()?.isNeedPassword;
  },
  set: (value: boolean) => {
    const publicQuery = ensurePublicQueryConfig();
    if (!publicQuery) return;
    publicQuery.isNeedPassword = value;
    if (!value) {
      publicQuery.password = '';
      publicQuery.encrypted = false;
    }
  },
});

const publicQueryPassword = computed({
  get: () => {
    return String(getPublicQueryConfig()?.password || '');
  },
  set: (value: string) => {
    const publicQuery = ensurePublicQueryConfig();
    if (!publicQuery || !currentForm.value) return;
    publicQuery.password = value;
    handlePublicQueryPasswordChange(currentForm.value);
  },
});

const publicQueryShareExpireTime = computed({
  get: () => {
    return getPublicQueryConfig()?.shareExpireTime || null;
  },
  set: (value: number | string | null) => {
    const publicQuery = ensurePublicQueryConfig();
    if (!publicQuery || !currentForm.value) return;
    publicQuery.shareExpireTime = value ? Number(value) : null;
    handleExpireTimeChange(currentForm.value);
  },
});

const formShareUrl = computed(() => {
  if (!currentForm.value || !formPublishEnabled.value || !nocode.value) {
    return '';
  }
  return `${settingStore.saas.domain}/#/share/${PublishCategory.FORM}/${nocode.value.meta.id}/${currentForm.value.uid}`;
});

const boardShareUrl = computed(() => {
  if (!currentBoard.value?.id || !boardPublishEnabled.value || !nocode.value) {
    return '';
  }
  return `${settingStore.saas.domain}/#/share/${PublishCategory.PAGE}/${nocode.value.meta.id}/${currentBoard.value.id}`;
});

const publicQueryShareUrl = computed(() => {
  if (!currentForm.value || !publicQueryEnabled.value || !nocode.value) {
    return '';
  }
  return `${settingStore.saas.domain}/#/share/query/${nocode.value.meta.id}/${currentForm.value.uid}`;
});

const publicQueryIframeCode = computed(() => {
  if (!publicQueryShareUrl.value) {
    return '';
  }
  return `<iframe width=1600 height=900 src="${publicQueryShareUrl.value}" frameborder=0 allowfullscreen=true></iframe>`;
});

const handleCopyCurrentUrl = async () => {
  if (!currentPublishTarget.value) return;
  await handleCopyPublicUrl(currentPublishTarget.value, visitPageTipDialogRef.value);
};

const handleOpenCurrentUrl = async () => {
  if (!currentPublishTarget.value) return;
  await handleOpenPublishUrl(currentPublishTarget.value, visitPageTipDialogRef.value);
};

const handleShowCurrentQr = async (event: MouseEvent) => {
  if (!currentPublishTarget.value) return;
  await handleShowQrCode(event, currentPublishTarget.value, visitPageTipDialogRef.value);
};

const handleCopyPublicQueryUrl = async () => {
  if (!publicQueryShareUrl.value) return;
  await copy(publicQueryShareUrl.value);
  ElMessage.success(i18next.t('NocodePublishPublicPage.copySuccess'));
};

const handleOpenPublicQueryUrl = async () => {
  if (!publicQueryShareUrl.value) return;
  window.open(publicQueryShareUrl.value, '_blank');
};

const handleShowPublicQueryQr = async (event: MouseEvent) => {
  if (!publicQueryShareUrl.value) return;
  qrCodeUrl.value = publicQueryShareUrl.value;
  virtualRef.value = event.target as HTMLElement;
  qrCodeVisible.value = true;
};

const handleOpenPublicQueryEmbedDialog = () => {
  if (!publicQueryShareUrl.value) return;
  publicQueryEmbedDialogVisible.value = true;
};

const handleCopyPublicQueryIframeCode = async () => {
  if (!publicQueryIframeCode.value) return;
  await copy(publicQueryIframeCode.value);
  ElMessage.success(i18next.t('NocodePublishPublicPage.copySuccess'));
};

const handleSave = async () => {
  const forceFormPublish = !!currentForm.value
    && formPublishEnabled.value
    && currentFormUpdateMethod.value === PublishUpdateMethod.MANUAL;
  const forceBoardPublish = !!currentBoard.value
    && boardPublishEnabled.value
    && publicUpdateMethod.value === PublishUpdateMethod.MANUAL;
  const forcePublish = !isPageUpdate.value && (forceFormPublish || forceBoardPublish);

  // 密码开启但是密码为空不允许保存
  const isBoardPublishPasswordInvalid = !!currentBoard.value
    && boardPasswordAccessEnabled.value
    && !boardPublishPassword.value;
  const isFormPublishPasswordInvalid = activePublicTab.value === 'formPublish'
    && !!currentForm.value
    && passwordAccessEnabled.value
    && !publishPassword.value;
  const isPublicQueryPasswordInvalid = activePublicTab.value === 'publicQuery'
    && !!currentForm.value
    && publicQueryPasswordAccessEnabled.value
    && !publicQueryPassword.value;

  if (isBoardPublishPasswordInvalid || isFormPublishPasswordInvalid || isPublicQueryPasswordInvalid) {
    ElMessage.error(i18next.t('NocodePublishPublicPage.passwordRequired'));
    return;
  }
  const releaseTableUIDs = forcePublish && currentForm.value ? [currentForm.value.uid] : undefined;
  await handleConfirm(forcePublish, releaseTableUIDs);
};

defineExpose({
  checkUpdate: () => checkPublishUpdate(updateTipDialogRef.value),
});
</script>

<style scoped lang="scss">
.nocode-public-publish {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;

  .content {
    width: 100%;
    height: 100%;
    display: flex;
    min-height: 0;
  }

  .aside {
    width: 300px;
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 16px;
    min-height: 0;

    .project {
      flex: 1;
      display: flex;
      flex-direction: column;
      row-gap: 8px;
      overflow: hidden;
      min-height: 0;

      :deep(.el-input) {
        height: 32px;

        .el-input__wrapper {
          background-color: var(--bg-color-overlay);
          box-shadow: unset;
          border-radius: 4px;
        }
      }

      :deep(.el-tree) {
        .el-tree-node__content {
          width: 100%;
          height: 44px;
          line-height: 44px;
          transition: all 0.3s ease;

          .el-tree-node__expand-icon {
            position: absolute;
            right: 8px;

            &.expanded {
              transform: rotate(180deg);
            }
          }

          &:hover {
            background-color: var(--bg-color-overlay) !important;
          }

          &:has(> .custom-tree-node.active) {
            background-color: var(--bg-color-overlay) !important;
          }

          .el-tree-node__expand-icon.is-leaf {
            padding: 0;
            margin-right: 4px;
          }

          .custom-tree-node {
            width: calc(100% - 16px);
            height: 100%;
            display: flex;
            align-items: center;
            position: relative;

            .node-icon {
              width: 20px;
              height: 20px;
              border-radius: 4px;
              display: flex;
              justify-content: center;
              align-items: center;
              margin-right: 8px;
              margin-left: 16px;
            }

            span {
              width: calc(100% - 80px);
              z-index: 1;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
          }
        }

        .el-tree-node:focus,
        .el-tree-node:focus-visible,
        .el-tree-node.is-focusable {
          .el-tree-node__content {
            background-color: unset;
          }
        }
      }

      .scrollbar {
        flex: 1;
      }
    }
  }

  .line {
    height: 100%;
    border-left: 1px solid var(--border-color);
  }

  .main {
    width: 100%;
    height: 100%;
    min-height: 0;
    padding: 16px;
  }

  .public-stack {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;

    .stack-layer {
      flex: 1;
      min-height: 0;
      overflow: auto;
      padding-top: 16px;
    }
  }

  .tab {
    height: 32px;
    display: flex;
    border-bottom: 1px solid var(--border-color);

    .tab-item {
      height: 100%;
      display: flex;
      align-items: center;
      margin-right: 32px;
      border-bottom: 2px solid transparent;
      cursor: pointer;

      span {
        font-size: 14px;
        line-height: 20px;
        color: var(--text-color-regular);
        transition: all 0.3s ease;
      }

      &.active {
        border-bottom-color: var(--color-primary);

        span {
          color: var(--color-primary);
        }
      }
    }
  }

  .setting-panel {
    width: 100%;
    max-width: 760px;
  }

  .form-publish-panel {
    max-width: 680px;
  }

  .setting-item {
    display: flex;
    align-items: center;
    gap: 24px;
    min-height: 48px;
    margin-bottom: 8px;

    &.align-start {
      align-items: flex-start;
      padding-top: 6px;
    }

    .label {
      width: 96px;
      flex-shrink: 0;
      font-size: 14px;
      color: var(--text-color-regular);
      line-height: 20px;
    }

    .control {
      flex: 1;
      min-width: 0;
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
      gap: 8px;
    }

    .icon-btn {
      width: 32px;
      height: 32px;
      padding: 0;
      border-radius: 4px;
    }

    .expire-time {
      width: 240px;
    }

    .password-input {
      width: 240px;
    }
  }

  .setting-switch-item {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 32px;
    margin-bottom: 28px;

    .switch-label {
      font-size: 14px;
      line-height: 20px;
      color: var(--text-color-regular);
    }

    .switch-control {
      display: flex;
      align-items: center;
    }
  }

  .setting-block {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 28px;

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

    .password-input,
    .expire-time,
    .field-select-input {
      width: 320px;
    }

    .link-control {
      gap: 8px;

      :deep(.el-input) {
        flex: 1;
      }
    }

    .link-actions {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }

    .icon-btn {
      width: 36px;
      height: 36px;
      padding: 0;
      border: none;
      border-radius: 6px;
      background-color: #f2f3f5;
      color: var(--text-color-secondary);

      &:hover,
      &:focus {
        background-color: #e8eaee;
        color: var(--text-color-regular);
      }

      &:disabled {
        background-color: #f2f3f5;
        color: var(--text-color-placeholder);
      }
    }

    .style-setting-entry {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }

    .style-setting-label {
      font-size: 14px;
      line-height: 20px;
      color: var(--text-color-regular);
    }

    .style-setting-btn {
      border-radius: 4px;
      --el-fill-color-light: #f2f3f5;
      --el-fill-color: #e8eaee;
    }
    .embed-web-btn {
      height: 36px;
      padding: 0 12px;
      border: none;
      border-radius: 6px;
      background-color: #f2f3f5;
      color: var(--text-color-secondary);
      margin-left: 0;
      display: inline-flex;
      align-items: center;
      gap: 4px;

      &:hover,
      &:focus {
        background-color: #e8eaee;
        color: var(--text-color-regular);
      }
    }

    :deep(.el-input__wrapper) {
      min-height: 36px;
      border-radius: 6px;
      background-color: #f5f6f7;
      box-shadow: none;
      padding: 0 12px;
    }

    :deep(.field-select-input .el-select__wrapper) {
      min-height: 36px;
      border-radius: 6px;
      background-color: #f5f6f7;
      box-shadow: none;
      padding: 0 12px;
    }

    :deep(.field-select-input .el-tag) {
      --el-tag-bg-color: var(--color-primary-light-9);
      --el-tag-border-color: var(--color-primary-light-7);
      --el-tag-text-color: var(--color-primary);
    }

    :deep(.field-select-input .el-tag .el-tag__close) {
      color: var(--color-primary);
    }
  }

  .field-section {
    margin-top: 4px;
  }

  .row-share-access-block {
    width: 100%;
    padding: 0 0 8px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 16px;

    &:last-of-type {
      margin-bottom: 12px;
    }
  }

  .row-share-access-title {
    font-size: 14px;
    line-height: 20px;
    color: var(--text-color-regular);
  }

  .row-share-access-tip {
    font-size: 12px;
    line-height: 20px;
    color: var(--text-color-secondary);
  }

  .row-share-access-item {
    display: flex;
    align-items: center;
    gap: 10px;

    & + .row-share-access-item {
      margin-top: 8px;
    }

    .switch-label {
      font-size: 14px;
      line-height: 20px;
      color: var(--text-color-regular);
      min-width: 80px;
    }

    .switch-control {
      display: flex;
      align-items: center;
    }
  }

  .row-share-access-item :deep(.el-checkbox) {
    --el-checkbox-checked-bg-color: var(--color-primary);
    --el-checkbox-checked-input-border-color: var(--color-primary);
    --el-checkbox-input-border-color: #cfd6e4;
    --el-checkbox-checked-text-color: var(--text-color-primary);
  }

  .row-share-access-item :deep(.el-checkbox__label) {
    font-size: 14px;
    line-height: 20px;
    color: var(--text-color-regular);
    padding-left: 8px;
  }

  .row-share-access-item :deep(.el-checkbox__inner) {
    border-color: #cfd6e4;
  }

  .row-share-access-item :deep(.el-checkbox__input.is-checked + .el-checkbox__label) {
    color: var(--text-color-primary);
  }

  .row-share-access-item :deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
    background-color: var(--color-primary);
    border-color: var(--color-primary);
  }

  .empty-box {
    display: flex;
    width: 100%;
    height: 100%;
    justify-content: center;
    align-items: center;
    font-size: 14px;
    color: var(--text-color-secondary);
  }

  hr {
    margin-top: auto;
    border: 0;
    border-top: 1px solid var(--border-color);
  }

  .save-button {
    margin: 16px;
    height: 32px;
    width: 60px;
    border-radius: 4px;
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

:deep(.public-query-embed-dialog) {
  border-radius: 8px;
  overflow: hidden;
  padding: 0;
  background: #ffffff;

  .el-dialog__header {
    height: 48px;
    padding: 12px 20px;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .el-dialog__title {
    font-size: 16px;
    line-height: 24px;
    color: var(--text-color-primary);
  }

  .el-dialog__body {
    padding: 24px 20px;
  }

  .embed-dialog-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .embed-code-label {
    font-size: 14px;
    line-height: 22px;
    color: var(--text-color-secondary);
  }

  .embed-code-box {
    position: relative;

    .el-textarea__inner {
      padding: 8px 12px;
      border-radius: 4px;
      background-color: #f2f3f5;
      color: var(--text-color-primary);
      font-size: 14px;
      line-height: 22px;
    }
  }

  .embed-copy-btn {
    position: absolute;
    right: 10px;
    bottom: 10px;
    width: 20px;
    height: 20px;
    padding: 0;
    color: var(--text-color-secondary);
    background-color: transparent;

    &:hover {
      background-color: transparent;
      color: var(--text-color-primary);
    }
  }
}

</style>
