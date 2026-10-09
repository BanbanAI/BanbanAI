<template>
  <div class="document-view">
    <el-container style="height: 100%; border: 1px solid #eee;display: flex; justify-content: space-between;">
      <el-aside width="300px">
        <div>
          <div class="aside-header">
            <div class="left">
              <el-icon size="18"><i-uil-list-ui-alt /></el-icon>
              <span>{{ $t('DocumentView.catalog') }}</span>
            </div>

            <div class="right">
              <el-icon size="16" @click="handleExpandAll">
                <i-ant-design-menu-unfold-outlined />
              </el-icon>
              <handle-menu v-if="rootNode" :node="rootNode" :treeData="treeData" :commandHandles="commandHandles">
                <el-icon size="16">
                  <i-ep-plus />
                </el-icon>
              </handle-menu>
            </div>
          </div>

          <!-- <el-input placeholder="快速搜索文档" v-model="filterText"> </el-input>  icon-class="el-icon-arrow-down"-->
          <div ref="asideTreeRef" class="aside-tree" id="document-view-aside-tree-loading-area">
            <el-scrollbar>
              <el-tree v-if="treeVisible" class="filter-tree" :data="treeData" :props="treeProps"
                :default-expand-all="false" :filter-node-method="filterNode" ref="treeRef" :draggable="treeDraggable"
                @node-click="handleNodeClick" @node-drop="handleNodeDrop" :allow-drop="allowDrop"
                :default-expanded-keys="treeDefaultExpandedKeys" node-key="id"
                :expand-on-click-node="false" @current-change="handleCurrentChange"
                @node-expand="handleNodeExpand" @node-collapse="handleNodeCollapse"
                @node-drag-over="handleNodeDragOver" @node-drag-leave="handleNodeDragLeave"
                @node-drag-end="handleTreeDragEnd">
                <template #default="{ node, data }">
                  <div class="custom-tree-node" v-if="data.rename">
                    <el-input v-model="data.label" ref="inputRef" :placeholder="$t('DocumentView.inputContent')" size="small"
                      style="width: 220px; border-radius: 10px;" @blur="(event) => handleRenameBlur(data)"
                      @keydown.enter="(event) => handleRenameBlur(data)">
                    </el-input>
                  </div>
                  <span
                    v-else
                    class="custom-tree-node"
                    @mouseenter="() => data.hover = true"
                    @mouseleave="() => handleMouseLeave(data)">

                    <div
                      class="node-arrow"
                      v-if="data.type === 'catalog' || (data.canContainChildren && node.childNodes.length > 0)"
                    >
                      <el-icon v-show="!node.expanded" @click.stop="handleExpand(node)">
                        <i-ep-arrow-right />
                      </el-icon>
                      <el-icon v-show="node.expanded" @click.stop="handleExpand(node)">
                        <i-ep-arrow-down />
                      </el-icon>
                    </div>

                    <div class="node-label" :title="data.label">{{ data.label }}</div>

                    <div class="node-handle" style="display: flex; gap: 8px;  align-items: center; " @click.stop>
                      <handle-menu :node="node" :treeData="treeData" v-model:iconVisible="iconVisible"
                        :commandHandles="commandHandles" @handleMouseLeave="handleMouseLeave">
                        <el-icon v-show="data.hover" style="transform: rotate(90deg); transform-origin: center; ">
                          <i-ep-more-filled />
                        </el-icon>
                      </handle-menu>
                    </div>

                  </span>
                </template>
              </el-tree>
            </el-scrollbar>
            <div
              ref="treeDragIndicatorRef"
              v-show="treeDragIndicatorVisible"
              class="tree-drag-indicator"
            ></div>
          </div>
        </div>
      </el-aside>
      <el-container style="background-color: #fff; flex: 1; max-width: calc(100% - 300px)">
        <div class="document" v-if="uuid" :key="uuid">
          <div class="header">
            <div class="header-left">
              {{ documentData ? documentData[titleField.uid] : '' }}
            </div>
            <div class="header-center" aria-live="polite">
              <div v-if="showEditorUploadIndicator" class="editor-upload-indicator" role="status">
                <span class="editor-upload-indicator__spinner"></span>
                <span class="editor-upload-indicator__text">{{ editorUploadIndicatorText }}</span>
              </div>
            </div>
            <div class="header-right" v-if="isViewing">
              <div class="icon-wrap" v-if="false">
                <el-icon size="16">
                  <i-ep-share />
                </el-icon>
              </div>
              <div class="division"></div>
              <div class="icon-wrap" :class="{ 'active': !isViewing }" @click="handleClickEditBtn">
                <el-icon size="16">
                  <i-ep-edit />
                </el-icon><span>{{ $t('DocumentView.edit') }}</span>
              </div>
              <div class="icon-wrap" v-if="false">
                <el-icon size="16">
                  <i-ep-printer />
                </el-icon><span>{{ $t('DocumentView.print') }}</span>
              </div>
              <div class="icon-wrap" @click="handleClickCopyBtn">
                <el-icon size="16">
                  <i-ep-copy-document />
                </el-icon><span>{{ $t('DocumentView.copy') }}</span>
              </div>
              <div class="icon-wrap" @click="handleClickDeleteBtn">
                <el-icon size="16">
                  <i-ep-delete />
                </el-icon><span>{{ $t('DocumentView.delete') }}</span>
              </div>
              <div class="icon-wrap" :class="{ 'active': !isViewing }" @click="handleClickOutlineBtn" v-if="false">
                <el-icon size="16">
                  <i-ep-edit />
                </el-icon><span>{{ $t('DocumentView.outline') }}</span>
              </div>
              <!-- <div class="icon-wrap" :class="{ 'active': !isViewing }" @click="handleClickSetBtn">
                <el-icon size="16">
                  <i-ep-edit />
                </el-icon><span>设置</span>
              </div> -->
            </div>
            <div class="header-right" v-else>
              <div :class="['icon-wrap', isSetting ? 'is-setting' : '']" @click="handleClickSetBtn">
                <el-icon size="16">
                  <i-ven-setting />
                </el-icon><span>{{ $t('DocumentView.setting') }}</span>
              </div>
              <div class="icon-wrap" @click="handleSave()">
                <el-icon size="16">
                  <i-ven-save />
                </el-icon><span>{{ $t('DocumentView.save') }}</span>
              </div>
            </div>
          </div>
          <el-container class="editor-content">
            <div class="form-container" :class="{'isSetting': isSetting}">
              <div class="form-wrap-display" v-show="isViewing">
                <div class="document-content">
                  <div class="title">{{ documentData ? documentData[titleField.uid] : '' }}</div>
                  <div class="content">
                    <Editor v-if="documentData" :model-value="documentData[contentField.uid]"
                      :defaultConfig="{ readOnly: true }" mode="default" />
                  </div>
                </div>
              </div>
              <div class="form-wrap-edit" v-if="!isViewing">
                <div class="content" ref="richTextEditorRef">
                  <Toolbar class="toolbar" :editor="editorRef" :defaultConfig="toolbarConfig" mode="default" />
                  <div class="editor-wrap" @click="editorRef.focus()">
                    <el-input class="title" v-model="titleValue" @input="handleTitleInput" @blur="handleChangeTitleBlur" @click.stop />
                    <div class="editor-box">
                      <Editor class="editor" :defaultConfig="editorConfig"
                        mode="default" @dblclick="handleEditorDblclick" @onCreated="handleCreated"
                        @customPaste="handleCustomPaste" @onChange="handleChange" />
                      <div v-if="showMode" class="paste-popup" :style="modeStyle">
                        <el-button link @click.stop="handleSaveText">{{ $t('DocumentView.onlyText') }}</el-button>
                        <el-button link @click.stop="handleSaveFormat">{{ $t('DocumentView.pasteWithFormat') }}</el-button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="document-setting" v-show="isSetting">
              <div class="setting-content">
                <nocode-form class="nocode-form" :key="uuid" ref="editingFormRef" :nocodeId="nocodeId"
                  :tableUID="[connection.uid, table.uid]" :row="documentData" :hiddenWidgets="hiddenWidgets"
                  :widthRatio="1"></nocode-form>
              </div>
              <!-- <div class="setting-footer">
                <el-button type="primary" @click="handleSubmit">保存</el-button>
              </div> -->
            </div>
          </el-container>
        </div>
        <div v-else class="document-empty">
          <el-icon class="document-empty__icon">
            <i-ven-nocode-view-document />
          </el-icon>
          <div class="document-empty__text">{{ $t('DocumentView.emptyHint') }}</div>
        </div>
      </el-container>
    </el-container>
  </div>
</template>
<!-- todo  写个方法专门删除一些不必要的属性 -->
<script lang="ts" setup>
import "@wangeditor-next/editor/dist/css/style.css";
import { ref, watch, inject, computed, nextTick, shallowRef, onBeforeUnmount } from 'vue'
import { NOCODE } from '@renderer/types';
import axios from 'axios';
import { useFormData, useFormTable } from '../../editor/form/hooks';
import { ElLoading, ElMessage, NodeDropType, TreeInstance } from 'element-plus';
import type { AllowDropType } from 'element-plus';
import { CatalogViewSetting } from '@common/types/nocode';
import { Bucket, Connection, QueryOptions, Row, Table, TableUID, OptionFieldUID } from '@common/types/project';
import { FormDataStage, isSystemField, SystemField } from '@common/utils';
import { CommandHandles, CustomNodeData, TreeNode } from './catalogView/type';
import { DeleteConfirmContext } from './NocodePageView.vue';
import { unique } from "@common/utils/unique";
import { Editor, Toolbar } from "@wangeditor-next/editor-for-vue";
import { IEditorConfig, IToolbarConfig, SlateElement, IDomEditor, SlateEditor, SlateTransforms, DomEditor } from "@wangeditor-next/editor";
import { getNocodeDataSourceTableByUID } from '@common/utils/connection';
import type { Range as SlateRange, RangeRef as SlateRangeRef } from 'slate';
import { merge } from "lodash";
import { deepClone, equals } from '@common/utils/object';
import i18next from 'i18next';
import { autoScrollToElement } from '../utils/other';
import { formDataApi } from '@renderer/views/nocode/utils';

type TableInfoResData = {
  bucket: Bucket,
  connection: Connection,
  rows: Row[]
}

type TableInfo = {
  tableId: TableUID,
  table: Table,
  promise: Promise<any>,
  data: TableInfoResData
}

const props = defineProps<{
  active: boolean,
  currentTOC: CatalogViewSetting
}>();
const emit = defineEmits<{
  (event: 'draft-saved'): void,
}>();

const setDeleteConfirmDialog: Function = inject('setDeleteConfirmDialog');
const nocode = inject(NOCODE);
const nocodeId = nocode.value.meta.id;
const connection = useFormData();
const table = useFormTable();

const uuidField = table.value.fields.find((field) => field.meta.name === SystemField.UUID);
const sortField = table.value.fields.find((field) => field.meta.name === SystemField.SORT);
const dataStageField = table.value.fields.find((field) => field.meta.name === SystemField.DATA_STAGE);
const parentField = table.value.fields.find((field) => field.uid === props.currentTOC.catalogFieldUID);
const titleField = table.value.fields.find((field) => field.uid === props.currentTOC.titleFieldUID);
let contentField = table.value.fields.find((field) => field.uid === props.currentTOC.contentFieldUID);
if (!contentField) {
  contentField = table.value.fields.filter((field) => !isSystemField(field) && field.meta.subType === "html")[0];
}
const subFormField = table.value.fields.find((field) => field.meta.subType === 'subForm');
const subFormTable = subFormField ? getNocodeDataSourceTableByUID(nocode.value.body, subFormField.meta.extra.subTableUID[1], {
  nocodeId,
}, true)?.table : null;
const subFormUuidField = subFormTable && subFormTable.fields.find((field) => field.meta.name === SystemField.UUID);
const subFormRelatedDataIdField = subFormTable && subFormTable.fields.find(item => item.meta.name === '_key');

const catalogTable = getNocodeDataSourceTableByUID(nocode.value.body, parentField.meta.extra.relatedTableUID[1], {
  nocodeId,
}, true)?.table;
const catalogUuidField = catalogTable.fields.find((field) => field.meta.name === SystemField.UUID);
const catalogSortField = catalogTable.fields.find((field) => field.meta.name === SystemField.SORT);
const catalogParentField = catalogTable.fields.find((field) => {
  return field.meta.subType === 'related' && field.meta.extra.relatedTableUID[1] === catalogTable.uid;
});
const catalogTitleField = catalogTable.fields.find((field) => field.uid === props.currentTOC.catalogTitleFieldUID);
const catalogSubFormField = catalogTable.fields.find((field) => field.meta.subType === 'subForm');
const isSelfCatalogTable = (
  parentField.meta.extra.relatedTableUID[0] === connection.value.uid
  && catalogTable.uid === table.value.uid
);
const documentTreeTitleField = isSelfCatalogTable && catalogTitleField ? catalogTitleField : titleField;

const treeProps = ref({
  children: 'children',
  label: 'label',
  class: treeClassBuilder
})

const isViewing = ref(true)
const uuid = ref('')

const showHiddenElement = ref(false)
const treeData = ref<CustomNodeData[]>([])
const filterText = ref('')
const tree = ref(null);
const treeRef = ref<TreeInstance>(null);
const asideTreeRef = ref<HTMLElement | null>(null);
const treeDragIndicatorRef = ref<HTMLElement | null>(null);
const rootNode = ref<TreeNode>();
const inputRef = ref(null)
const treeDraggable = ref<boolean>(true);
const editingFormRef = ref(null)
let expandedKeys = ref<string[]>([])
const treeDefaultExpandedKeys = ref<string[]>([])
const treeExpandedStateInitialized = ref(false);
let treeVisible = ref(true)
let iconVisible = ref(true)
const treeDragIndicatorVisible = ref(false);
let treeDragHoverState: {
  nodeId: string | null,
  dropType: NodeDropType,
  highlightCatalogId: string | null,
} = {
  nodeId: null,
  dropType: 'none',
  highlightCatalogId: null,
};
let treeDragIndicatorState = {
  visible: false,
  top: 0,
  left: 0,
  width: 0,
};
let treeDragExpandTimer: number | null = null;
let treeDragExpandTargetId: string | null = null;
let treeDragOverFrameId: number | null = null;
let pendingTreeDragOverPayload: {
  draggingNode: TreeNode,
  dropNode: TreeNode | null,
  event: DragEvent | null,
} | null = null;

const documentTitle = ref()
const isSetting = ref(false)
const documentData = ref();
const baseDocumentData = ref<Row | null>(null);
const editingInitialRow = ref<Row | null>(null);
const settingFormSnapshot = ref<Row | null>(null);
const draftDirty = ref(false);
const draftTrackingReady = ref(false);
const settingDraftTrackingReady = ref(false);
const hiddenWidgets = ref([])
const draftRows = ref<Row[]>([]);
const draftRowsLoaded = ref(false);
let draftRowsPromise: Promise<Row[]> | null = null;
const lastSavedDraftRow = ref<Row | null>(null);
const pendingEditorUserChange = ref(false);
const richTextEditorRef = shallowRef<HTMLElement>();
const editorRef = shallowRef<IDomEditor>(null);
let toolBarDom: HTMLElement | null = null;
let editorDom: HTMLElement | null = null;
let editorUserEditVersion = 0;
let isLoaded = false
let autoSaveDraftTimer: number | null = null;
let removeEditorInteractionListeners: (() => void) | null = null;
let flushPendingDraftPromise: Promise<boolean> | null = null;
const documentDraftKeys: OptionFieldUID[] = [[connection.value.uid, table.value.uid, uuidField.uid]];

const toolbarConfig: Partial<IToolbarConfig> = {
  excludeKeys: [
    "emotion",
    "fullScreen",
  ],
};
type InsertFnType = (url: string, alt: string, href: string) => void;
type ImageElement = SlateElement & {
  type: 'image';
  src: string;
  alt?: string;
  href?: string;
  style?: Record<string, never>;
  children: Array<{ text: '' }>;
};
type ImageUploadTask = {
  id: string;
  progress: number;
};
type ImageInsertTarget = {
  insertFn?: InsertFnType;
  insertRangeRef?: SlateRangeRef | null;
};
type InsertPastedHtmlOptions = {
  showPasteModePopup?: boolean;
};
type AsyncMixedClipboardPasteContext = {
  startUserEditVersion: number;
};
type EditorImageUploadPlaceholder = {
  src: string;
  alt: string;
};
type EditorImageUploadJob = {
  placeholder: EditorImageUploadPlaceholder;
  resolveFile: () => Promise<File | null>;
  updateProps?: (result: { url: string; uploadFileName: string }) => Partial<ImageElement>;
};
type PreparedClipboardHtmlImageUpload = {
  html: string;
  jobs: EditorImageUploadJob[];
};
const EMPTY_DOCUMENT_HTML = '<p><br></p>';
const normalizeDocumentContentHtml = (content?: unknown) => {
  if (typeof content !== 'string') return EMPTY_DOCUMENT_HTML;
  return content.trim() ? content : EMPTY_DOCUMENT_HTML;
};

const imageUploadTasks = ref<Record<string, ImageUploadTask>>({});
const pendingImageUploadTasks = computed(() => Object.values(imageUploadTasks.value));
const hasPendingImageUploads = computed(() => pendingImageUploadTasks.value.length > 0);
const IMAGE_UPLOAD_INDICATOR_MIN_VISIBLE_MS = 400;
const showEditorUploadIndicator = ref(false);
const editorUploadIndicatorText = ref('');
let editorUploadIndicatorShownAt = 0;
let editorUploadIndicatorHideTimer: number | null = null;
const latestEditorUploadIndicatorText = computed(() => {
  if (!pendingImageUploadTasks.value.length) return '';

  const avgProgress = Math.round(
    pendingImageUploadTasks.value.reduce((total, task) => total + task.progress, 0)
      / pendingImageUploadTasks.value.length,
  );

  if (pendingImageUploadTasks.value.length === 1) {
    return i18next.t('DocumentView.imageUploadingIndicator', { progress: avgProgress });
  }

  return i18next.t('DocumentView.imageUploadingIndicatorMulti', {
    count: pendingImageUploadTasks.value.length,
    progress: avgProgress,
  });
});
const clearEditorUploadIndicatorHideTimer = () => {
  if (editorUploadIndicatorHideTimer !== null) {
    window.clearTimeout(editorUploadIndicatorHideTimer);
    editorUploadIndicatorHideTimer = null;
  }
};

watch(latestEditorUploadIndicatorText, (nextText) => {
  if (!nextText) return;
  editorUploadIndicatorText.value = nextText;
}, { immediate: true });

watch(hasPendingImageUploads, (hasPendingUploads) => {
  const wasWaitingToHide = editorUploadIndicatorHideTimer !== null;
  clearEditorUploadIndicatorHideTimer();

  if (hasPendingUploads) {
    if (!showEditorUploadIndicator.value || wasWaitingToHide) {
      editorUploadIndicatorShownAt = Date.now();
    }
    showEditorUploadIndicator.value = true;
    if (latestEditorUploadIndicatorText.value) {
      editorUploadIndicatorText.value = latestEditorUploadIndicatorText.value;
    }
    return;
  }

  if (!showEditorUploadIndicator.value) return;

  const elapsed = Date.now() - editorUploadIndicatorShownAt;
  const remaining = Math.max(0, IMAGE_UPLOAD_INDICATOR_MIN_VISIBLE_MS - elapsed);
  if (remaining === 0) {
    showEditorUploadIndicator.value = false;
    return;
  }

  editorUploadIndicatorHideTimer = window.setTimeout(() => {
    showEditorUploadIndicator.value = false;
    editorUploadIndicatorHideTimer = null;
  }, remaining);
}, { immediate: true });

const createEditorImagePlaceholderId = () => {
  return `doc-upload-placeholder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};
const escapeSvgText = (value = '') => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};
const createEditorUploadingPlaceholderSrc = (placeholderId: string) => {
  const uploadText = escapeSvgText(i18next.t('DocumentView.imageUploadingLine', { progress: 0 }));
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="120" viewBox="0 0 240 120">
      <!--${placeholderId}-->
      <rect width="240" height="120" rx="14" fill="#F5F7FA" />
      <rect x="14" y="14" width="212" height="92" rx="10" fill="#FFFFFF" stroke="#E4E7ED" />
      <circle cx="48" cy="60" r="12" fill="#D9ECFF" stroke="#409EFF" stroke-width="2" />
      <path d="M48 48v8M48 60l6 6" stroke="#409EFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      <text x="74" y="66" font-size="14" fill="#606266" font-family="sans-serif">${uploadText}</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};
const createEditorImageUploadPlaceholder = (alt = ''): EditorImageUploadPlaceholder => {
  return {
    src: createEditorUploadingPlaceholderSrc(createEditorImagePlaceholderId()),
    alt: alt || i18next.t('DocumentView.imageUploadingLine', { progress: 0 }),
  };
};
const isEditorUploadingPlaceholderSrc = (src = '') => {
  return src.includes('doc-upload-placeholder-');
};
const getUploadFilename = (file: File) => {
  if (file.name) return file.name;

  const fileExt = file.type?.split('/')?.[1];
  return fileExt ? `pasted-${Date.now()}.${fileExt}` : `pasted-${Date.now()}`;
};
const getFileExtByMimeType = (mimeType = '') => {
  const normalizedMimeType = mimeType.toLowerCase();
  if (!normalizedMimeType.startsWith('image/')) return '';
  if (normalizedMimeType === 'image/jpeg') return 'jpg';
  if (normalizedMimeType === 'image/svg+xml') return 'svg';
  return normalizedMimeType.split('/')[1]?.split('+')[0] || '';
};
const getMimeTypeByImageExt = (fileExt = '') => {
  const normalizedFileExt = fileExt.trim().toLowerCase().replace(/^\./, '');
  if (!normalizedFileExt) return '';

  if (normalizedFileExt === 'jpg' || normalizedFileExt === 'jpeg') return 'image/jpeg';
  if (normalizedFileExt === 'png') return 'image/png';
  if (normalizedFileExt === 'gif') return 'image/gif';
  if (normalizedFileExt === 'bmp' || normalizedFileExt === 'dib') return 'image/bmp';
  if (normalizedFileExt === 'webp') return 'image/webp';
  if (normalizedFileExt === 'svg') return 'image/svg+xml';
  return '';
};
const getImageMimeTypeFromSrc = (src = '') => {
  const resolveMimeTypeFromPath = (pathValue = '') => {
    const normalizedPath = decodeURIComponent(pathValue).toLowerCase().split('?')[0].split('#')[0];
    const fileExt = normalizedPath.split('.').pop() || '';
    return getMimeTypeByImageExt(fileExt);
  };

  try {
    return resolveMimeTypeFromPath(new URL(src, window.location.href).pathname);
  } catch (error) {
    return resolveMimeTypeFromPath(src);
  }
};
const isDataUrlImageSrc = (src = '') => {
  return src.trim().toLowerCase().startsWith('data:image/');
};
const isTemporaryClipboardImageSrc = (src = '') => {
  const normalizedSrc = src.trim().toLowerCase();
  if (isEditorUploadingPlaceholderSrc(normalizedSrc)) return false;
  return normalizedSrc.startsWith('blob:')
    || normalizedSrc.startsWith('file:')
    || normalizedSrc.startsWith('mhtml:')
    || normalizedSrc.startsWith('cid:')
    || isDataUrlImageSrc(normalizedSrc);
};
const isUploadedClipboardImageSrc = (src = '') => {
  const normalizedSrc = src.trim().toLowerCase();
  return normalizedSrc.startsWith('uploads/')
    || normalizedSrc.includes('/uploads/');
};
const hasClipboardHtmlImage = (html = '') => {
  return /<img\b/i.test(html);
};
const isImageOnlyHtml = (html = '') => {
  if (!hasClipboardHtmlImage(html)) return false;

  const container = document.createElement('div');
  container.innerHTML = html;
  container.querySelectorAll('img').forEach((img) => img.remove());

  const remainingText = (container.textContent || '').replace(/\u00a0/g, ' ').trim();
  return !remainingText;
};
const dataUrlToImageFile = (dataUrl: string, index = 0) => {
  if (!dataUrl.startsWith('data:image/')) return null;

  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) return null;

  const meta = dataUrl.slice(5, commaIndex);
  const encoded = dataUrl.slice(commaIndex + 1).replace(/\s/g, '');
  const [mimeType, encoding] = meta.split(';');
  if (!mimeType?.startsWith('image/') || encoding !== 'base64') return null;

  try {
    const binary = window.atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    const fileExt = getFileExtByMimeType(mimeType);
    const fileName = fileExt
      ? `pasted-${Date.now()}-${index}.${fileExt}`
      : `pasted-${Date.now()}-${index}`;

    return new File([bytes], fileName, { type: mimeType });
  } catch (error) {
    console.warn('Parse clipboard image data url failed', error);
    return null;
  }
};
const skipRtfControlWord = (content = '', startIndex = 0) => {
  let nextIndex = startIndex + 1;
  if (nextIndex >= content.length) return nextIndex;

  if (content[nextIndex] === "'") {
    return Math.min(nextIndex + 3, content.length);
  }

  if (!/[a-zA-Z]/.test(content[nextIndex])) {
    nextIndex += 1;
    if (content[nextIndex] === ' ') nextIndex += 1;
    return nextIndex;
  }

  while (/[a-zA-Z]/.test(content[nextIndex])) {
    nextIndex += 1;
  }
  if (content[nextIndex] === '-') {
    nextIndex += 1;
  }
  while (/\d/.test(content[nextIndex])) {
    nextIndex += 1;
  }
  if (content[nextIndex] === ' ') {
    nextIndex += 1;
  }
  return nextIndex;
};
const readRtfGroup = (content = '', startIndex = 0) => {
  if (content[startIndex] !== '{') return '';

  let depth = 0;
  for (let index = startIndex; index < content.length; index += 1) {
    const char = content[index];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return content.slice(startIndex, index + 1);
      }
    }
  }

  return '';
};
const extractRtfPictureHex = (rtfGroup = '') => {
  if (!rtfGroup) return '';

  let depth = 0;
  let dataStartIndex = -1;
  let index = 0;

  while (index < rtfGroup.length) {
    const char = rtfGroup[index];

    if (char === '{') {
      depth += 1;
      index += 1;
      continue;
    }
    if (char === '}') {
      depth -= 1;
      if (depth <= 0) break;
      index += 1;
      continue;
    }
    if (depth !== 1) {
      index += 1;
      continue;
    }
    if (char === '\\') {
      index = skipRtfControlWord(rtfGroup, index);
      continue;
    }
    if (/[0-9a-fA-F]/.test(char)) {
      dataStartIndex = index;
      break;
    }
    index += 1;
  }

  if (dataStartIndex < 0) return '';

  let pictureHex = '';
  depth = 0;
  index = 0;

  while (index < rtfGroup.length) {
    const char = rtfGroup[index];

    if (char === '{') {
      depth += 1;
      index += 1;
      continue;
    }
    if (char === '}') {
      depth -= 1;
      if (depth <= 0) break;
      index += 1;
      continue;
    }
    if (index < dataStartIndex) {
      index += 1;
      continue;
    }
    if (depth !== 1) {
      index += 1;
      continue;
    }
    if (char === '\\') {
      index = skipRtfControlWord(rtfGroup, index);
      continue;
    }
    if (/[0-9a-fA-F]/.test(char)) {
      pictureHex += char;
    }
    index += 1;
  }

  return pictureHex.length % 2 === 0 ? pictureHex : pictureHex.slice(0, -1);
};
const hexToUint8Array = (hex = '') => {
  if (!hex || hex.length % 2 !== 0) return null;

  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16);
  }
  return bytes;
};
const rtfPictureGroupToImageFile = (rtfGroup = '', index = 0) => {
  const normalizedGroup = rtfGroup.toLowerCase();
  let mimeType = '';

  if (normalizedGroup.includes('\\pngblip')) {
    mimeType = 'image/png';
  } else if (normalizedGroup.includes('\\jpegblip') || normalizedGroup.includes('\\jpgblip')) {
    mimeType = 'image/jpeg';
  } else if (normalizedGroup.includes('\\gifblip')) {
    mimeType = 'image/gif';
  }

  if (!mimeType) return null;

  const pictureHex = extractRtfPictureHex(rtfGroup);
  const bytes = hexToUint8Array(pictureHex);
  if (!bytes?.length) return null;

  const fileExt = getFileExtByMimeType(mimeType);
  const fileName = fileExt
    ? `pasted-${Date.now()}-${index}.${fileExt}`
    : `pasted-${Date.now()}-${index}`;

  return new File([bytes], fileName, { type: mimeType });
};
const getClipboardRtfImageFiles = (rtf = '') => {
  if (!rtf || !rtf.toLowerCase().includes('{\\pict')) return [];

  const normalizedRtf = rtf.toLowerCase();
  const imageFiles: File[] = [];
  let searchIndex = 0;

  while (searchIndex < normalizedRtf.length) {
    const pictStartIndex = normalizedRtf.indexOf('{\\pict', searchIndex);
    if (pictStartIndex < 0) break;

    const pictGroup = readRtfGroup(rtf, pictStartIndex);
    if (!pictGroup) break;

    const imageFile = rtfPictureGroupToImageFile(pictGroup, imageFiles.length);
    if (imageFile) {
      imageFiles.push(imageFile);
    }
    searchIndex = pictStartIndex + pictGroup.length;
  }

  return imageFiles;
};
const fetchClipboardImageFile = async (src = '', index = 0) => {
  if (!src || !isTemporaryClipboardImageSrc(src) || isDataUrlImageSrc(src)) return null;

  try {
    const res = await fetch(src);
    const blob = await res.blob();
    const mimeType = blob.type?.startsWith('image/')
      ? blob.type
      : getImageMimeTypeFromSrc(src);

    if (!mimeType.startsWith('image/')) return null;

    const fileExt = getFileExtByMimeType(mimeType);
    const fileName = fileExt
      ? `pasted-${Date.now()}-${index}.${fileExt}`
      : `pasted-${Date.now()}-${index}`;

    return new File([blob], fileName, { type: mimeType });
  } catch (error) {
    console.warn('Fetch clipboard image source failed', error);
    return null;
  }
};
const getClipboardHtmlImageFiles = (html = '') => {
  if (!hasClipboardHtmlImage(html) || !isImageOnlyHtml(html)) return [];

  const container = document.createElement('div');
  container.innerHTML = html;

  return Array.from(container.querySelectorAll('img'))
    .map((img, index) => {
      const src = img.getAttribute('src')?.trim() || '';
      if (isEditorUploadingPlaceholderSrc(src)) return null;
      return dataUrlToImageFile(src, index);
    })
    .filter((file): file is File => Boolean(file));
};
const getClipboardImageFiles = (clipboardData: DataTransfer) => {
  const itemFiles = Array.from(clipboardData.items || [])
    .filter((item) => item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));

  if (itemFiles.length) {
    return itemFiles;
  }

  return Array.from(clipboardData.files || []).filter((file) => file.type.startsWith('image/'));
};
const hasClipboardTextContent = (text = '') => {
  return text.replace(/\u00a0/g, ' ').trim().length > 0;
};
const isImageOnlyClipboardData = (clipboardData: DataTransfer, html = '') => {
  if (html) {
    return isImageOnlyHtml(html);
  }

  return !hasClipboardTextContent(clipboardData.getData('text/plain'));
};
const createImageUploadId = () => {
  return `doc-image-upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};
const normalizeUploadProgress = (progress = 0) => {
  const safeProgress = Math.max(0, Math.min(100, Math.round(progress)));
  if (safeProgress >= 100) return 100;
  if (safeProgress <= 0) return 0;
  return Math.min(99, Math.max(1, Math.round(safeProgress / 10) * 10));
};
const syncEditorUploadState = () => {
  if (!pendingImageUploadTasks.value.length && draftDirty.value) {
    scheduleAutoSaveDraft();
  }
};
const addImageUploadTask = (id: string) => {
  imageUploadTasks.value = {
    ...imageUploadTasks.value,
    [id]: {
      id,
      progress: 0,
    },
  };
};
const updateImageUploadTaskProgress = (id: string, progress = 0) => {
  const currentTask = imageUploadTasks.value[id];
  if (!currentTask) return;

  const nextProgress = Math.max(currentTask.progress, normalizeUploadProgress(progress));
  imageUploadTasks.value = {
    ...imageUploadTasks.value,
    [id]: {
      ...currentTask,
      progress: nextProgress,
    },
  };
};
const removeImageUploadTask = (id: string) => {
  if (!imageUploadTasks.value[id]) return;

  const nextTasks = { ...imageUploadTasks.value };
  delete nextTasks[id];
  imageUploadTasks.value = nextTasks;
  syncEditorUploadState();
};
const createEditorInsertRangeRef = (selection?: SlateRange | null) => {
  const editor = editorRef.value;
  if (!editor || !selection) return null;

  return SlateEditor.rangeRef(editor, deepClone(selection), { affinity: 'forward' });
};
const findEditorImageNodePathBySrc = (
  targetSrc = '',
  nodes: Array<{ children?: unknown[] }> = (editorRef.value?.children as Array<{ children?: unknown[] }>) || [],
  parentPath: number[] = [],
): number[] | null => {
  if (!targetSrc || !nodes.length) return null;

  for (const [index, node] of nodes.entries()) {
    const path = parentPath.concat(index);
    if (SlateElement.isElement(node) && node.type === 'image' && (node as ImageElement).src === targetSrc) {
      return path;
    }
    if (!Array.isArray(node?.children) || !node.children.length) {
      continue;
    }
    const childPath = findEditorImageNodePathBySrc(targetSrc, node.children as Array<{ children?: unknown[] }>, path);
    if (childPath) {
      return childPath;
    }
  }

  return null;
};
const hasEditorImageNodeBySrc = (targetSrc = '') => {
  return Boolean(findEditorImageNodePathBySrc(targetSrc));
};
const releaseEditorInsertRangeRef = (insertRangeRef?: SlateRangeRef | null) => {
  try {
    insertRangeRef?.unref();
  } catch (error) {
    console.warn('Release document image insert range failed', error);
  }
};
const restoreEditorSelectionByRangeRef = (insertRangeRef?: SlateRangeRef | null) => {
  const editor = editorRef.value;
  if (!editor || !insertRangeRef?.current) return;

  editor.focus();
  SlateTransforms.select(editor, insertRangeRef.current);
};
const updateEditorImageNodeBySrc = (targetSrc = '', nextProps: Partial<ImageElement> = {}) => {
  const editor = editorRef.value;
  const targetPath = findEditorImageNodePathBySrc(targetSrc);
  if (!editor || !targetPath) return false;

  SlateTransforms.setNodes(editor, nextProps, { at: targetPath });
  queueEditorUserChange();
  markDraftDirty();
  return true;
};
const removeEditorImageNodeBySrc = (targetSrc = '') => {
  const editor = editorRef.value;
  const targetPath = findEditorImageNodePathBySrc(targetSrc);
  if (!editor || !targetPath) return false;

  SlateTransforms.removeNodes(editor, { at: targetPath });
  queueEditorUserChange();
  markDraftDirty();
  return true;
};
const insertUploadedImageAtSelection = (src: string, alt = '') => {
  const editor = editorRef.value;
  if (!editor) return false;

  if (!ensureEditorSelection(editor)) return false;

  const imageNode: ImageElement = {
    type: 'image',
    src,
    alt,
    href: '',
    style: {},
    children: [{ text: '' }],
  };

  editor.focus();
  SlateTransforms.insertNodes(editor, imageNode);
  queueEditorUserChange();
  markDraftDirty();
  return true;
};
const insertUploadedImageByRangeRef = (src: string, alt = '', insertRangeRef?: SlateRangeRef | null) => {
  const editor = editorRef.value;
  if (!editor) return false;

  if (insertRangeRef?.current) {
    editor.focus();
    SlateTransforms.select(editor, insertRangeRef.current);
  }

  return insertUploadedImageAtSelection(src, alt);
};
const insertEditorImagePlaceholder = (placeholder: EditorImageUploadPlaceholder, target: ImageInsertTarget = {}) => {
  return insertUploadedEditorImage(placeholder.src, placeholder.alt, target);
};
const insertUploadedEditorImage = (src: string, alt = '', target: ImageInsertTarget = {}) => {
  if (target.insertRangeRef) {
    return insertUploadedImageByRangeRef(src, alt, target.insertRangeRef);
  }

  if (target.insertFn) {
    target.insertFn(src, alt, "");
    queueEditorUserChange();
    markDraftDirty();
    return true;
  }

  return insertUploadedImageAtSelection(src, alt);
};
const ensureEditorSelection = (editor: IDomEditor | null = editorRef.value) => {
  if (!editor) return false;

  editor.focus();
  if (editor.selection !== null) return true;

  editor.restoreSelection?.();
  if (editor.selection !== null) return true;

  try {
    DomEditor.normalizeContent(editor);
    if (!Array.isArray(editor.children) || editor.children.length === 0) {
      SlateTransforms.insertNodes(editor, DomEditor.genEmptyParagraph(), { at: [0] });
    }
    const endPoint = SlateEditor.end(editor, []);
    SlateTransforms.select(editor, endPoint);
    editor.focus();
  } catch {
    return false;
  }

  return editor.selection !== null;
};
const getEditorSelectionSnapshot = (editor: IDomEditor | null = editorRef.value) => {
  if (!ensureEditorSelection(editor) || !editor?.selection) return null;
  return deepClone(editor.selection) as SlateRange;
};
const waitForEditorSelectionSnapshot = async (
  editor: IDomEditor | null = editorRef.value,
  targetUUID = uuid.value,
  retries = 10,
) => {
  const selection = getEditorSelectionSnapshot(editor);
  if (selection) return selection;
  if (!targetUUID) return null;

  await nextTick();

  for (let index = 0; index < retries; index += 1) {
    if (isViewing.value || uuid.value !== targetUUID) return null;

    queueEnsureEditorSelection(targetUUID, 1, editor);
    await new Promise((resolve) => {
      window.setTimeout(resolve, 50);
    });

    const nextSelection = getEditorSelectionSnapshot(editor);
    if (nextSelection) return nextSelection;
  }

  return null;
};
const insertEditorHtmlAtSelection = (html = '') => {
  const editor = editorRef.value;
  if (!editor || !html) return false;

  if (!ensureEditorSelection(editor)) return false;

  editor.focus();
  editor.dangerouslyInsertHtml(html);
  queueEditorUserChange();
  return true;
};
const insertEditorHtmlByRangeRef = (html = '', insertRangeRef?: SlateRangeRef | null) => {
  const editor = editorRef.value;
  if (!editor || !html) return false;

  if (insertRangeRef?.current) {
    editor.focus();
    SlateTransforms.select(editor, insertRangeRef.current);
  }

  return insertEditorHtmlAtSelection(html);
};
const showPasteModePopup = () => {
  window.setTimeout(() => {
    const position = editorRef.value?.getSelectionPosition();
    if (!position) return;

    const { top, left, bottom, right } = position;
    modeStyle.value = { top, left, bottom, right };
    showMode.value = true;
  }, 100);
};
const insertPastedHtml = (
  html = '',
  text = '',
  rtf = '',
  insertRangeRef?: SlateRangeRef | null,
  options: InsertPastedHtmlOptions = {},
) => {
  const { showPasteModePopup: shouldShowPasteModePopup = true } = options;
  if (shouldShowPasteModePopup) {
    saveModeValue = { html, text, rtf };
  }

  const inserted = insertRangeRef
    ? insertEditorHtmlByRangeRef(html, insertRangeRef)
    : insertEditorHtmlAtSelection(html);
  if (!inserted) return false;

  if (shouldShowPasteModePopup) {
    showPasteModePopup();
  }
  return true;
};
const shouldBlockForPendingImageUploads = (showMessage = true) => {
  if (!hasPendingImageUploads.value) return false;

  if (showMessage) {
    ElMessage.warning(i18next.t('DocumentView.imageUploadingWait'));
  }
  return true;
};
let pendingTreeSelectionRestoreDocumentId: string | null = null;
const canLeaveView = async (showMessage = true) => {
  if (shouldBlockForPendingImageUploads(showMessage)) {
    return false;
  }

  const saved = await flushPendingDraft();
  if (saved) {
    return true;
  }

  if (showMessage) {
    ElMessage.error(i18next.t('DocumentView.saveFail'));
  }
  return false;
};
const ensureCanLeaveCurrentDocument = async (showMessage = true) => {
  const allowLeave = await canLeaveView(showMessage);
  if (allowLeave) return true;
  await syncTreeCurrentState(uuid.value);
  return false;
};
const uploadEditorImageFileResource = async (file: File) => {
  const uploadId = createImageUploadId();
  const uploadFileName = getUploadFilename(file);
  let params = new FormData();
  params.append('file', file);
  params.append('filename', uploadFileName);
  params.append('nocodeId', nocodeId);

  addImageUploadTask(uploadId);

  try {
    const res = await axios.post('/nocode/upload-resource', params, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        const total = progressEvent.total || 0;
        const progress = total > 0
          ? Math.round((progressEvent.loaded / total) * 100)
          : 0;
        updateImageUploadTaskProgress(uploadId, progress);
      },
    });
    const url = res?.data?.url || "";

    if (!url) {
      throw new Error('Upload resource response missing url');
    }

    updateImageUploadTaskProgress(uploadId, 100);
    return { url, uploadFileName };
  } catch (error) {
    console.error('Document image upload failed', error);
    ElMessage.error(i18next.t('DocumentView.imageUploadFailed'));
    throw error;
  } finally {
    removeImageUploadTask(uploadId);
  }
};
const clearClipboardHtmlImageSrcset = (img: HTMLImageElement) => {
  img.removeAttribute('srcset');
  img.closest('picture')
    ?.querySelectorAll('source')
    .forEach((source) => source.removeAttribute('srcset'));
};
const resolveEditorImageUploadJob = async (job: EditorImageUploadJob) => {
  const { placeholder, resolveFile, updateProps } = job;
  if (!hasEditorImageNodeBySrc(placeholder.src)) {
    return false;
  }

  const uploadFile = await resolveFile();
  if (!uploadFile || !hasEditorImageNodeBySrc(placeholder.src)) {
    removeEditorImageNodeBySrc(placeholder.src);
    return false;
  }

  try {
    const result = await uploadEditorImageFileResource(uploadFile);
    if (!hasEditorImageNodeBySrc(placeholder.src)) {
      return false;
    }
    return updateEditorImageNodeBySrc(
      placeholder.src,
      updateProps?.(result) ?? { src: result.url },
    );
  } catch (error) {
    removeEditorImageNodeBySrc(placeholder.src);
    return false;
  }
};
const prepareClipboardHtmlWithImagePlaceholders = (
  html = '',
  imageFiles: File[] = [],
): PreparedClipboardHtmlImageUpload => {
  if (!html || !hasClipboardHtmlImage(html)) {
    return {
      html,
      jobs: [],
    };
  }

  const container = document.createElement('div');
  container.innerHTML = html;

  const htmlImages = Array.from(container.querySelectorAll('img'));
  let clipboardImageFileIndex = 0;
  const jobs: EditorImageUploadJob[] = [];

  htmlImages.forEach((img, index) => {
    const src = img.getAttribute('src')?.trim() || '';
    if (!src || isUploadedClipboardImageSrc(src) || isEditorUploadingPlaceholderSrc(src)) {
      return;
    }

    let resolveFile: (() => Promise<File | null>) | null = null;
    if (isDataUrlImageSrc(src)) {
      resolveFile = async () => dataUrlToImageFile(src, index);
    } else if (isTemporaryClipboardImageSrc(src) && clipboardImageFileIndex < imageFiles.length) {
      const uploadFile = imageFiles[clipboardImageFileIndex];
      clipboardImageFileIndex += 1;
      resolveFile = async () => uploadFile;
    } else if (isTemporaryClipboardImageSrc(src)) {
      resolveFile = () => fetchClipboardImageFile(src, index);
    }

    if (!resolveFile) {
      if (isTemporaryClipboardImageSrc(src)) {
        img.remove();
      }
      return;
    }

    const placeholder = createEditorImageUploadPlaceholder(
      img.getAttribute('alt')?.trim() || i18next.t('DocumentView.imageUploadingLine', { progress: 0 }),
    );
    clearClipboardHtmlImageSrcset(img);
    img.setAttribute('src', placeholder.src);
    if (!img.getAttribute('alt') && placeholder.alt) {
      img.setAttribute('alt', placeholder.alt);
    }
    jobs.push({
      placeholder,
      resolveFile,
      updateProps: ({ url }) => ({ src: url }),
    });
  });

  return {
    html: container.innerHTML,
    jobs,
  };
};
const uploadMixedClipboardHtmlAndInsert = async ({
  html = '',
  text = '',
  rtf = '',
  imageFiles = [],
  selection = null,
  pasteContext = null,
}: {
  html?: string;
  text?: string;
  rtf?: string;
  imageFiles?: File[];
  selection?: SlateRange | null;
  pasteContext?: AsyncMixedClipboardPasteContext | null;
}) => {
  const insertRangeRef = createEditorInsertRangeRef(selection);
  let restoreSelectionRef: SlateRangeRef | null = null;

  try {
    const preparedClipboardHtml = prepareClipboardHtmlWithImagePlaceholders(html, imageFiles);
    const shouldAutoKeepFormat = Boolean(
      pasteContext && editorUserEditVersion > pasteContext.startUserEditVersion,
    );
    if (shouldAutoKeepFormat) {
      restoreSelectionRef = createEditorInsertRangeRef(
        editorRef.value?.selection ? (deepClone(editorRef.value.selection) as SlateRange) : null,
      );
    }
    const inserted = insertPastedHtml(preparedClipboardHtml.html, text, rtf, insertRangeRef, {
      showPasteModePopup: !shouldAutoKeepFormat,
    });
    if (!inserted) {
      throw new Error('Insert clipboard html failed');
    }
    if (shouldAutoKeepFormat) {
      restoreEditorSelectionByRangeRef(restoreSelectionRef);
    }
    for (const job of preparedClipboardHtml.jobs) {
      await resolveEditorImageUploadJob(job);
    }
  } catch (error) {
    console.error('Document mixed clipboard paste failed', error);
  } finally {
    releaseEditorInsertRangeRef(restoreSelectionRef);
    releaseEditorInsertRangeRef(insertRangeRef);
  }
};
const uploadEditorImageFile = async (file: File, target: ImageInsertTarget = {}) => {
  const { url, uploadFileName } = await uploadEditorImageFileResource(file);
  const inserted = insertUploadedEditorImage(url, uploadFileName, target);
  if (!inserted) {
    console.error('Document image insert failed');
    ElMessage.error(i18next.t('DocumentView.imageUploadFailed'));
    throw new Error('Insert uploaded image failed');
  }
};
const uploadEditorImageFilesSequentially = async (files: File[] = [], selection?: SlateRange | null) => {
  if (!files.length) return false;

  const insertRangeRef = createEditorInsertRangeRef(selection);
  const sharedTarget: ImageInsertTarget = insertRangeRef ? { insertRangeRef } : {};
  const uploadJobs: EditorImageUploadJob[] = [];
  let hasInsertedImage = false;

  try {
    for (const file of files) {
      const placeholder = createEditorImageUploadPlaceholder(getUploadFilename(file));
      const inserted = insertEditorImagePlaceholder(placeholder, sharedTarget);
      if (!inserted) {
        continue;
      }
      hasInsertedImage = true;
      uploadJobs.push({
        placeholder,
        resolveFile: async () => file,
        updateProps: ({ url, uploadFileName }) => ({
          src: url,
          alt: uploadFileName,
        }),
      });
    }
    for (const job of uploadJobs) {
      try {
        await resolveEditorImageUploadJob(job);
        hasInsertedImage = true;
      } catch (error) {
        // Keep uploading subsequent images even if one file fails.
      }
    }
  } finally {
    releaseEditorInsertRangeRef(insertRangeRef);
  }

  return hasInsertedImage;
};

const editorConfig: Partial<IEditorConfig> = {
  autoFocus: true,
  hoverbarKeys: {
    text: {
      menuKeys: [
        "formatPainter",
        "headerSelect",
        "fontSize",
        "insertLink",
        "bulletedList",
        "|",
        "bold",
        "through",
        "color",
        "bgColor",
        "clearStyle",
      ],
    },
  },
  MENU_CONF: {
    fontSize: {
      fontSizeList: [
        "12px",
        "14px",
        "16px",
        "18px",
        "20px",
        "24px",
        "28px",
        "32px",
      ],
    },
    insertImage: {
      onInsertedImage(imageNode: ImageElement | null) {
        if (imageNode == null) return;
      },
    },
    uploadImage: {
      metaWithUrl: false,
      base64LimitSize: 0,
      server: "/nocode/upload-resource",
      async customUpload(file: File, insertFn: InsertFnType) {
        await uploadEditorImageFile(file, { insertFn });
      },
      onProgress(progress: number) { },
      onSuccess(file, res: any) { },
      onFailed(file, res: any) { },
      onError(file, err: any, res: any) { },
    },
    // 添加视频上传配置
    uploadVideo: {
      metaWithUrl: false,
      server: "/nocode/upload-resource",
      async customUpload(file: File, insertFn: InsertFnType) {
        let params = new FormData();
        params.append('file', file);
        params.append('filename', getUploadFilename(file));
        params.append('nocodeId', nocodeId);

        const res = await axios.post('/nocode/upload-resource', params, { headers: { 'Content-Type': 'multipart/form-data' } }).catch((err) => {
          return err;
        })

        insertFn(res?.data?.url || "", "", "");
      },
      onProgress(progress: number) { },
      onSuccess(file, res: any) { },
      onFailed(file, res: any) { },
      onError(file, err: any, res: any) { },
    },
    lineHeight: {
      lineHeightList: ['1', '1.5', '2', '2.5', '3', '3.5', '5', '10', '15', '20']
    }
  },
};

const titleValue = ref('');

// 监听标题变化，更新titleValue
watch(
  () => documentData.value?.[titleField?.uid],
  (newVal) => {
    titleValue.value = newVal || '';
  },
  { immediate: true }
);

const handleEditorDblclick = () => {
  // 可选扩展
};
const showMode = ref(false);
const modeStyle = ref({});
let saveModeValue = { html: '', text: '', rtf: '' };

// 只保留文本
const handleSaveText = () => {
  editorRef.value.focus();
  editorRef.value.undo();
  const { html, text, rtf } = saveModeValue;
  editorRef.value.insertText(text);

  showMode.value = false;
  markDraftDirty();
}
const handleSaveFormat = () => {
  editorRef.value.focus()
  showMode.value = false;
  markDraftDirty();
}
const handleChange = () => {
  showMode.value = false;
  if (!draftTrackingReady.value && !pendingEditorUserChange.value) return;

  const currentContent = editorRef.value?.getHtml();
  const initialContent = editingInitialRow.value?.[contentField.uid];
  pendingEditorUserChange.value = false;

  if (currentContent === undefined) return;
  if (initialContent !== undefined && equals(currentContent, initialContent)) return;

  markDraftDirty();
}
const handleCustomPaste = (
  editor: IDomEditor,
  event: ClipboardEvent,
  callback?: (handled: boolean) => void,
) => {
  if (editorRef.value !== editor) {
    editorRef.value = editor;
  }
  const finishCustomPaste = (handled: boolean) => {
    callback?.(handled);
  };
  const clipboardData = event.clipboardData;
  if (!clipboardData) {
    showMode.value = false;
    finishCustomPaste(true);
    return;
  }

  const clipboardHtml = clipboardData.getData('text/html');
  const text = event.clipboardData.getData('text/plain'); // 获取粘贴的纯文本
  const rtf = event.clipboardData.getData('text/rtf'); // 获取 rtf 数据（如从 word wsp 复制粘贴）
  const clipboardImageFiles = getClipboardImageFiles(clipboardData);
  const rtfImageFiles = clipboardImageFiles.length ? [] : getClipboardRtfImageFiles(rtf);
  const imageFiles = clipboardImageFiles.length ? clipboardImageFiles : rtfImageFiles;
  const shouldUploadImageFiles = imageFiles.length > 0 && isImageOnlyClipboardData(clipboardData, clipboardHtml);
  const htmlImageFiles = shouldUploadImageFiles || imageFiles.length ? [] : getClipboardHtmlImageFiles(clipboardHtml);
  const filesToUpload = shouldUploadImageFiles ? imageFiles : htmlImageFiles;
  const targetUUID = uuid.value;
  const pasteContext = {
    startUserEditVersion: editorUserEditVersion,
  };
  const resolvePasteSelection = async () => {
    const currentSelection = getEditorSelectionSnapshot(editor);
    if (currentSelection) return currentSelection;
    return waitForEditorSelectionSnapshot(editor, targetUUID);
  };
  if (filesToUpload.length) {
    showMode.value = false;
    event.preventDefault();
    void (async () => {
      const pasteSelection = await resolvePasteSelection();
      if (!pasteSelection) {
        console.warn('Document paste skipped because editor selection is unavailable');
        return;
      }
      await uploadEditorImageFilesSequentially(filesToUpload, pasteSelection);
    })();
    finishCustomPaste(false);
    return;
  }
  if (clipboardHtml && hasClipboardHtmlImage(clipboardHtml)) {
    showMode.value = false;
    event.preventDefault();
    void (async () => {
      const pasteSelection = await resolvePasteSelection();
      if (!pasteSelection) {
        console.warn('Document mixed clipboard paste skipped because editor selection is unavailable');
        return;
      }
      await uploadMixedClipboardHtmlAndInsert({
        html: clipboardHtml,
        text,
        rtf,
        imageFiles,
        selection: pasteSelection,
        pasteContext,
      });
    })();
    finishCustomPaste(false);
    return;
  }
  const html = clipboardHtml; // 获取粘贴的 html
  if (!html) {
    showMode.value = false;
    finishCustomPaste(true);
    return;
  }

  const inserted = insertPastedHtml(html, text, rtf);
  if (!inserted) {
    finishCustomPaste(true);
    return;
  }

  // 阻止默认的粘贴行为
  event.preventDefault();
  event.preventDefault();
  finishCustomPaste(false);
}
const handleCreated = (editor) => {
  editorRef.value = editor;
  syncEditorContent();
  nextTick(() => {
    toolBarDom = richTextEditorRef.value?.querySelector(".toolbar") as HTMLElement;
    editorDom = editorRef.value?.getEditableContainer?.() as HTMLElement;
    attachEditorInteractionListeners();
    queueEnsureEditorSelection(uuid.value);
  });
};

const updateMainSign = (sign?: string) => {
  if (sign) {
    nocode.value.body.sign = sign;
  }
};

const notifyDraftChanged = () => {
  emit('draft-saved');
};

const syncEditorContent = (content = documentData.value?.[contentField.uid]) => {
  const editor = editorRef.value;
  if (!editor) return;
  const nextContent = normalizeDocumentContentHtml(content);
  if (editor.getHtml() === nextContent) return;
  editor.setHtml(nextContent);
};

const cloneRow = (row?: Row | null) => {
  return row ? deepClone(row) : null;
};

const stripDraftRowMeta = (row?: Row | null) => {
  if (!row) return null;
  const nextRow = cloneRow(row);
  if (dataStageField?.uid) {
    delete nextRow[dataStageField.uid];
  }
  delete nextRow[SystemField.DATA_STAGE];
  delete nextRow._id;
  return nextRow;
};

const getDraftRowByUUID = (value = uuid.value) => {
  return draftRows.value.find((item) => item?.[uuidField.uid] === value) || null;
};

const normalizeDraftRows = (rows: Row[] = []) => {
  const draftRowMap = new Map<string, Row>();
  rows.forEach((row) => {
    const rowUUID = row?.[uuidField.uid];
    if (!rowUUID) return;
    draftRowMap.set(rowUUID, cloneRow(row));
  });
  return Array.from(draftRowMap.values());
};

const upsertDraftRow = (row: Row) => {
  const nextRow = cloneRow(row);
  draftRows.value = normalizeDraftRows(
    draftRows.value
      .filter((item) => item?.[uuidField.uid] !== nextRow?.[uuidField.uid])
      .concat(nextRow),
  );
};

const removeDraftRowsByUUIDs = (values: string[] = []) => {
  const uuidSet = new Set(values.filter(Boolean));
  if (!uuidSet.size) return;
  draftRows.value = draftRows.value.filter((item) => !uuidSet.has(item?.[uuidField.uid]));
};

const loadDraftRows = async () => {
  if (draftRowsLoaded.value) {
    return draftRows.value;
  }
  if (!draftRowsPromise) {
    draftRowsPromise = formDataApi.getDrafts({
      nocodeId,
      tableUID: table.value.uid,
    }).then((rows) => {
      draftRows.value = normalizeDraftRows(Array.isArray(rows) ? rows : []);
      draftRowsLoaded.value = true;
      return draftRows.value;
    }).catch((error) => {
      console.error('Failed to load document drafts', error);
      return draftRows.value;
    }).finally(() => {
      draftRowsPromise = null;
    });
  }
  await draftRowsPromise;
  return draftRows.value;
};

const updateHiddenWidgets = () => {
  const hiddenFields = [parentField.uid, titleField.uid, contentField.uid];
  hiddenWidgets.value = table.value.fields
    .filter(item => hiddenFields.includes(item.uid))
    .map(item => item.meta?.uid);
};

const setCurrentDocument = async (row: Row, restoreDraft = false) => {
  const baseRow = stripDraftRowMeta(row);
  if (!baseRow) return;
  baseRow[contentField.uid] = normalizeDocumentContentHtml(baseRow[contentField.uid]);

  let nextRow = cloneRow(baseRow);
  if (restoreDraft) {
    await loadDraftRows();
    const draftRow = getDraftRowByUUID(baseRow[uuidField.uid]);
    if (draftRow) {
      nextRow = {
        ...nextRow,
        ...stripDraftRowMeta(draftRow),
      };
      nextRow[contentField.uid] = normalizeDocumentContentHtml(nextRow[contentField.uid]);
      lastSavedDraftRow.value = stripDraftRowMeta({
        ...draftRow,
        [contentField.uid]: normalizeDocumentContentHtml(draftRow[contentField.uid]),
      });
    } else {
      lastSavedDraftRow.value = null;
    }
  } else {
    lastSavedDraftRow.value = null;
  }
  nextRow[contentField.uid] = normalizeDocumentContentHtml(nextRow[contentField.uid]);

  baseDocumentData.value = cloneRow(baseRow);
  editingInitialRow.value = cloneRow(nextRow);
  resetSettingDraftTracking();
  draftDirty.value = false;
  draftTrackingReady.value = false;
  pendingEditorUserChange.value = false;
  cleanupEditorInteractionListeners();
  editorRef.value = null;
  uuid.value = baseRow[uuidField.uid];
  documentData.value = nextRow;
  documentTitle.value = nextRow[titleField.uid];
  updateHiddenWidgets();
  if (isSetting.value) {
    queueSyncSettingDraftSnapshot(baseRow[uuidField.uid]);
  }
};

const buildEditingRow = () => {
  if (!documentData.value) return null;

  const formRow = isSetting.value
    ? (editingFormRef.value?.getFormRow?.() ?? {})
    : {};
  const documentContent = documentData.value?.[contentField.uid];
  const editorContent = !isViewing.value ? editorRef.value?.getHtml() : undefined;

  return stripDraftRowMeta({
    ...cloneRow(documentData.value),
    ...formRow,
    [titleField.uid]: titleValue.value ?? documentData.value?.[titleField.uid] ?? '',
    [contentField.uid]: normalizeDocumentContentHtml(
      editorContent ?? documentContent,
    ),
  });
};

const buildSettingFormSnapshot = () => {
  if (isViewing.value || !isSetting.value || !uuid.value) return null;
  return stripDraftRowMeta(editingFormRef.value?.getFormRow?.() ?? {});
};

const resetSettingDraftTracking = () => {
  settingFormSnapshot.value = null;
  settingDraftTrackingReady.value = false;
};

const buildDraftRow = () => {
  const row = buildEditingRow();
  if (!row) return null;
  const nextRow = {
    ...row,
  };
  if (dataStageField?.uid) {
    nextRow[dataStageField.uid] = FormDataStage.DRAFT;
  }
  return nextRow;
};

const deleteDraftByUUID = async (value = uuid.value) => {
  return await deleteDraftsByUUIDs([value]);
};

const deleteDraftsByUUIDs = async (values: string[] = []) => {
  const uuidValues = Array.from(new Set(values.filter(Boolean)));
  if (!uuidValues.length) return;

  await loadDraftRows();
  const uuidSet = new Set(uuidValues);
  const draftRowsToDelete = draftRows.value.filter((item) => uuidSet.has(item?.[uuidField.uid]));
  if (!draftRowsToDelete.length) {
    removeDraftRowsByUUIDs(uuidValues);
    return;
  }

  await formDataApi.deleteDraft({
    nocodeId,
    tableUID: table.value.uid,
    rows: draftRowsToDelete,
    keys: documentDraftKeys,
    sign: nocode.value.body.sign,
    onMainSign: updateMainSign,
  });
  removeDraftRowsByUUIDs(uuidValues);
  notifyDraftChanged();
};

const persistCurrentDraft = async (): Promise<boolean> => {
  if (isViewing.value || !uuid.value || !baseDocumentData.value) return true;
  if (hasPendingImageUploads.value) return false;

  const currentRow = buildEditingRow();
  const baseRow = stripDraftRowMeta(baseDocumentData.value);
  if (!currentRow || !baseRow) return true;

  const currentDraftRow = getDraftRowByUUID(currentRow[uuidField.uid]);
  if (equals(currentRow, baseRow)) {
    if (currentDraftRow) {
      try {
        await deleteDraftByUUID(currentRow[uuidField.uid]);
      } catch (error) {
        console.error('Failed to delete document draft', error);
      }
    }
    lastSavedDraftRow.value = null;
    draftDirty.value = false;
    return true;
  }

  // Setting-panel changes are only reflected through getFormRow(), so allow
  // draft persistence to detect them even if no explicit dirty flag was set.
  if (!draftDirty.value && !isSetting.value) {
    return true;
  }

  if (editingInitialRow.value && equals(currentRow, editingInitialRow.value)) {
    return true;
  }

  if (lastSavedDraftRow.value && equals(currentRow, lastSavedDraftRow.value)) {
    return true;
  }

  const nextDraftRow = buildDraftRow();
  if (!nextDraftRow) return true;

  try {
    if (currentDraftRow) {
      await formDataApi.updateDraft({
        formData: connection.value,
        nocodeId,
        tableUID: table.value.uid,
        rows: [nextDraftRow],
        stage: FormDataStage.DRAFT,
        sign: nocode.value.body.sign,
        onMainSign: updateMainSign,
      });
    } else {
      await formDataApi.addDraft({
        formData: connection.value,
        nocodeId,
        tableUID: table.value.uid,
        rows: [nextDraftRow],
        sign: nocode.value.body.sign,
        onMainSign: updateMainSign,
      });
    }
    upsertDraftRow(nextDraftRow);
    lastSavedDraftRow.value = stripDraftRowMeta(nextDraftRow);
    draftDirty.value = false;
    notifyDraftChanged();
    return true;
  } catch (error) {
    console.error('Failed to save document draft', error);
    return false;
  }
};

const clearAutoSaveDraftTimer = () => {
  if (autoSaveDraftTimer !== null) {
    window.clearTimeout(autoSaveDraftTimer);
    autoSaveDraftTimer = null;
  }
};

const flushPendingDraft = (): Promise<boolean> => {
  clearAutoSaveDraftTimer();
  if (flushPendingDraftPromise) {
    return flushPendingDraftPromise;
  }
  flushPendingDraftPromise = persistCurrentDraft()
    .catch((error) => {
      console.error('Failed to flush document draft', error);
      return false;
    })
    .finally(() => {
      flushPendingDraftPromise = null;
    });
  return flushPendingDraftPromise;
};

const waitPendingDraftFlush = async () => {
  if (flushPendingDraftPromise) {
    return await flushPendingDraftPromise;
  }
  return true;
};

const hasPendingLeaveWork = () => {
  if (hasPendingImageUploads.value) return true;
  if (flushPendingDraftPromise) return true;
  if (autoSaveDraftTimer !== null) return true;
  return !isViewing.value && draftDirty.value;
};

const cleanupEditorInteractionListeners = () => {
  removeEditorInteractionListeners?.();
  removeEditorInteractionListeners = null;
  toolBarDom = null;
  editorDom = null;
};

const markDraftDirty = () => {
  if (isViewing.value || !uuid.value) return;
  draftDirty.value = true;
  scheduleAutoSaveDraft();
};

const queueEditorUserChange = () => {
  if (isViewing.value || !uuid.value) return;
  pendingEditorUserChange.value = true;
};
const bumpEditorUserEditVersion = () => {
  if (isViewing.value || !uuid.value) return;
  editorUserEditVersion += 1;
};
const shouldTrackEditorUserEdit = (event: Event) => {
  if (event.isTrusted === false) return false;

  if (event.type === 'paste' || event.type === 'cut' || event.type === 'drop') {
    return true;
  }
  if (event.type !== 'beforeinput') {
    return false;
  }

  const inputType = (event as InputEvent).inputType || '';
  return inputType !== 'insertFromPaste' && inputType !== 'insertFromDrop';
};

const attachEditorInteractionListeners = () => {
  cleanupEditorInteractionListeners();
  const nextToolbarDom = toolBarDom;
  const nextEditorDom = editorDom;
  if (!nextToolbarDom && !nextEditorDom) return;

  const editorInteractionHandler = (event: Event) => {
    queueEditorUserChange();
    if (shouldTrackEditorUserEdit(event)) {
      bumpEditorUserEditVersion();
    }
  };
  const toolbarInteractionHandler = (event: Event) => {
    queueEditorUserChange();
    if (event.isTrusted === false) return;
    bumpEditorUserEditVersion();
  };

  const cleanupCallbacks: Array<() => void> = [];
  ['beforeinput', 'input', 'cut', 'drop', 'paste'].forEach((eventName) => {
    if (!nextEditorDom) return;
    nextEditorDom.addEventListener(eventName, editorInteractionHandler, true);
    cleanupCallbacks.push(() => nextEditorDom.removeEventListener(eventName, editorInteractionHandler, true));
  });
  if (nextToolbarDom) {
    nextToolbarDom.addEventListener('mousedown', toolbarInteractionHandler, true);
    cleanupCallbacks.push(() => nextToolbarDom.removeEventListener('mousedown', toolbarInteractionHandler, true));
  }

  removeEditorInteractionListeners = () => {
    cleanupCallbacks.forEach((callback) => callback());
  };
};

const scheduleAutoSaveDraft = () => {
  if (isViewing.value || !uuid.value) return;
  clearAutoSaveDraftTimer();
  autoSaveDraftTimer = window.setTimeout(() => {
    autoSaveDraftTimer = null;
    void flushPendingDraft();
  }, 3000);
};

const queueSyncSettingDraftSnapshot = (targetUUID = uuid.value, retries = 10) => {
  if (!targetUUID) return;
  nextTick(() => {
    if (isViewing.value || !isSetting.value || uuid.value !== targetUUID) return;

    const currentRow = buildSettingFormSnapshot();
    if (!currentRow || Object.keys(currentRow).length === 0) {
      if (retries > 0) {
        window.setTimeout(() => {
          queueSyncSettingDraftSnapshot(targetUUID, retries - 1);
        }, 100);
      }
      return;
    }

    settingFormSnapshot.value = cloneRow(currentRow);
    settingDraftTrackingReady.value = true;
  });
};

const queueSyncEditingInitialRow = (targetUUID = uuid.value, retries = 10) => {
  if (!targetUUID) return;
  window.setTimeout(() => {
    if (isViewing.value || uuid.value !== targetUUID) return;
    if (!editorRef.value) {
      if (retries > 0) {
        queueSyncEditingInitialRow(targetUUID, retries - 1);
      }
      return;
    }

    const currentRow = buildEditingRow();
    if (!currentRow) {
      if (retries > 0) {
        queueSyncEditingInitialRow(targetUUID, retries - 1);
      }
      return;
    }

    if (draftDirty.value || pendingEditorUserChange.value) {
      draftTrackingReady.value = true;
      return;
    }

    editingInitialRow.value = cloneRow(currentRow);
    draftDirty.value = false;
    draftTrackingReady.value = true;
    pendingEditorUserChange.value = false;
    if (getDraftRowByUUID(targetUUID)) {
      lastSavedDraftRow.value = cloneRow(currentRow);
    }
  }, 100);
};
const queueEnsureEditorSelection = (
  targetUUID = uuid.value,
  retries = 10,
  editor: IDomEditor | null = editorRef.value,
) => {
  if (!targetUUID) return;
  window.setTimeout(() => {
    if (isViewing.value || uuid.value !== targetUUID) return;
    if (ensureEditorSelection(editor)) return;

    if (retries > 0) {
      queueEnsureEditorSelection(targetUUID, retries - 1, editor);
    }
  }, 50);
};

function treeClassBuilder(data: CustomNodeData) {
  const nodeClassMap = {
    catalog: 'catalog-node',
    document: 'document-node'
  }
  let isActive = data.id === uuid.value ? 'active' : '';
  return `${nodeClassMap[data.type]} ${isActive}`.trim()
}

function buildTree(items) {
  const idMap = items.reduce((map, item) => {
    map[item.id] = { ...item, children: [], sort: item.sort || 0 };
    return map;
  }, {});

  const tree = [];
  items.forEach(item => {
    const node = idMap[item.id];
    // todo  ids
    if (item.parentIds?.[0] === undefined || item.parentIds[0] === null) {
      tree.push(node);
    } else {
      idMap[item.parentIds[0]].children.push(node);
    }
  });
  sortTree(tree);

  return tree;
}

function sortTree(nodes) {
  const zeroSortNodes = nodes.filter(n => n.sort === 0);
  const nonZeroSortNodes = nodes.filter(n => n.sort !== 0);

  nonZeroSortNodes.sort((a, b) => a.sort - b.sort);
  zeroSortNodes.reverse();

  nodes.length = 0;
  nodes.push(...nonZeroSortNodes, ...zeroSortNodes);

  nodes.forEach(node => {
    if (node.children && node.children.length > 0) {
      sortTree(node.children);
    }
  });
}

function flattenTree(nodes: CustomNodeData[], parentId = null): CustomNodeData[] {
  let result: CustomNodeData[] = [];

  nodes.forEach(node => {
    const item = {
      ...node
    };

    result.push(item);

    if (node.children && node.children.length > 0) {
      result = result.concat(flattenTree(node.children, node.id));
    }
  });

  return result;
}

function resetAllHover(arr) {
  if (!Array.isArray(arr)) return;
  arr.forEach(item => {
    if (item.hasOwnProperty('hover')) {
      item.hover = false;
    }
    if (item.children && Array.isArray(item.children)) {
      resetAllHover(item.children);
    }
  });
}


function updateNodeParent(tree, nodeId, parent = null) {
  for (const node of tree) {
    if (node.id === nodeId) {
      node.parentIds[0] = parent.id
    }

    if (node.children && node.children.length > 0) {
      updateNodeParent(node.children, nodeId, node);
    }
  }
}


function getAllNodeKeys(nodes) {
  let keys = []
  nodes.forEach(node => {
    keys.push(node.id)
    if (node.children) {
      keys = keys.concat(getAllNodeKeys(node.children))
    }
  })
  return keys
}

function handleClickCopyBtn() {
  const activeNode: TreeNode = treeRef.value.getNode(uuid.value);
  copyNode(activeNode.data as CustomNodeData, activeNode);
}

function handleClickDeleteBtn() {
  const activeNode: TreeNode = treeRef.value.getNode(uuid.value);
  deleteNode(activeNode.data as CustomNodeData, activeNode);
}

async function handleClickEditBtn() {
  await setCurrentDocument(baseDocumentData.value || documentData.value, true);
  isViewing.value = false;
  // isSetting.value = false;
  documentTitle.value = documentData.value[titleField.uid]
}

function handleClickOutlineBtn() {
  console.log("大纲");
}

function handleClickSetBtn() {
  const isClosingSetting = isSetting.value;
  isSetting.value = !isSetting.value;
  if (isClosingSetting && editingFormRef.value && documentData.value) {
    merge(documentData.value, editingFormRef.value.getFormRow?.() ?? {});
    draftDirty.value = true;
  }
  if (!isSetting.value) {
    scheduleAutoSaveDraft();
    resetSettingDraftTracking();
    return;
  }
  queueSyncSettingDraftSnapshot();
}

const addExpandedKey = (nodeId?: string) => {
  if (!nodeId || expandedKeys.value.includes(nodeId)) return;
  treeExpandedStateInitialized.value = true;
  expandedKeys.value = [...expandedKeys.value, nodeId];
};

const canContainTreeChildren = (data: CustomNodeData | null | undefined) => (
  data?.type === 'catalog' || data?.canContainChildren === true
);

const removeExpandedKey = (nodeId?: string) => {
  if (!nodeId) return;
  treeExpandedStateInitialized.value = true;
  expandedKeys.value = expandedKeys.value.filter(key => key !== nodeId);
};

const applyExpandedKeysToTree = () => {
  const rootChildNodes = treeRef.value?.root?.childNodes as TreeNode[] | undefined;
  if (!rootChildNodes) return;

  const expandedKeySet = new Set(expandedKeys.value);
  const syncNodeExpanded = (nodes: TreeNode[]) => {
    nodes.forEach((node) => {
      if (canContainTreeChildren(node.data as CustomNodeData)) {
        node.expanded = expandedKeySet.has(node.data.id);
      }
      if (node.childNodes?.length) {
        syncNodeExpanded(node.childNodes as TreeNode[]);
      }
    });
  };

  syncNodeExpanded(rootChildNodes);
};

const setNodeExpandedState = (node: TreeNode | null | undefined, expanded: boolean) => {
  if (!node || node.level === 0 || !canContainTreeChildren(node.data as CustomNodeData)) return;
  node.expanded = expanded;
  if (expanded) {
    addExpandedKey(node.data.id);
    return;
  }
  removeExpandedKey(node.data.id);
};

const handleExpand = (node: TreeNode) => {
  setNodeExpandedState(node, !node.expanded);
}

const handleNodeExpand = (data: CustomNodeData) => {
  addExpandedKey(data.id);
};

const handleNodeCollapse = (data: CustomNodeData) => {
  removeExpandedKey(data.id);
};

const expandNodeAncestors = (node: TreeNode | null | undefined) => {
  let current = node?.parent;
  while (current && current.level > 0) {
    setNodeExpandedState(current, true);
    current = current.parent;
  }
};

const syncTreeCurrentState = async (nodeId = uuid.value) => {
  if (!nodeId || !treeRef.value) return;
  if (treeRef.value.getCurrentKey() !== nodeId) {
    pendingTreeSelectionRestoreDocumentId = nodeId;
    treeRef.value.setCurrentKey(nodeId);
  }
  await scrollToTreeNodeById(nodeId);
};

const getTreeNodeWrapperElementById = (nodeId: string): HTMLElement | null => {
  const treeRootElement = treeRef.value?.$el;
  if (!treeRootElement) return null;

  return treeRootElement.querySelector(`.el-tree-node[data-key="${nodeId}"]`) as HTMLElement | null;
};

const getTreeNodeElementById = (nodeId: string): HTMLElement | null => {
  const treeNodeElement = getTreeNodeWrapperElementById(nodeId);
  if (!treeNodeElement) return null;

  return (
    (treeNodeElement.querySelector('.custom-tree-node') as HTMLElement)
    || (treeNodeElement.querySelector('.el-tree-node__content') as HTMLElement)
    || treeNodeElement
  );
};

const scrollToTreeNodeById = async (nodeId: string, maxRetries = 4) => {
  if (!nodeId) return;
  let retries = 0;

  while (retries < maxRetries) {
    const node = treeRef.value?.getNode(nodeId) as TreeNode | undefined;
    expandNodeAncestors(node);
    await nextTick();

    const nodeEl = getTreeNodeElementById(nodeId);
    if (nodeEl) {
      autoScrollToElement(nodeEl, {
        block: 'nearest',
        inline: 'nearest',
      });
      return;
    }
    retries += 1;
  }
};

async function handleSubmit() {

  const expandNode = (node: TreeNode) => {
    if (node.level === 0) return;
    setNodeExpandedState(node, true);
    expandNode(node.parent);
  }

  if (!editingFormRef.value) return;
  const row = await editingFormRef.value.prepareSubmitRow().catch(err => { });
  if (!row) return;
  const confirmed = await editingFormRef.value.confirmSubmitBeforeMutation?.({
    onSignSyncConflict: flushPendingDraft,
  });
  if (!confirmed) {
    editingFormRef.value?.clearSubmitValidationNotice?.();
    return;
  }
  merge(documentData.value, row)
  const loadingInstance = ElLoading.service({
    target: ".iframe-wrap",
    text: i18next.t('DocumentView.submitting'),
    background: "rgba(0, 0, 0, 0.2)"
  });
  saveDocument().then(async (result) => {
    loadingInstance.close();
    if (!result) {
      editingFormRef.value?.clearSubmitValidationNotice?.();
      return;
    }
    editingFormRef.value?.notifySubmitValidationMessages?.();
    editingFormRef.value?.clearSubmitValidationNotice?.();
    // isViewing.value = true;
    // 更新右侧展示的文本数据
    // const uuidT = refreshContentContainer();
    // 更新左侧的树数据
    const resData = await axios.get(`nocode/read-form-data`, {
      params: {
        nocodeId: nocodeId,
        connectionId: connection.value.uid,
        tableId: table.value.uid,
        uuid: uuid.value
      }
    }).then(res => res.data);
    const oldNode = treeRef.value.getNode(uuid.value);
    const newNodeData: CustomNodeData = {
      row: { ...resData.row },
      label: resData.row[documentTreeTitleField.uid],
      id: resData.row[uuidField.uid],
      parentIds: resData.row[parentField.uid],
      sort: resData.row[sortField.uid] || 0,
      tableId: table.value.uid,
      type: 'document',
      hover: false,
      rename: false,
      children: oldNode.data.children,
      canContainChildren: isSelfCatalogTable,
    };
    // 若更改了文档的所在目录字段，则树中对应文档需位移到对应的父节点下
    if (oldNode.data.parentIds[0] !== newNodeData.parentIds[0]) {
      treeRef.value.remove(oldNode);
      treeRef.value.append(newNodeData, newNodeData.parentIds[0]);
      // 展开新的父节点
      const newParentNode = treeRef.value.getNode(newNodeData.parentIds[0]);
      newParentNode && expandNode(newParentNode);
    } else {
      // 此处修改node.data变量的指向地址会导致treeData中的数据不能同步更新
      for (const key in newNodeData) {
        oldNode.data[key] = newNodeData[key];
      }
    }
  }).catch(() => {
    loadingInstance.close();
    editingFormRef.value?.clearSubmitValidationNotice?.();
  })
}

function refreshContentContainer() {
  const uuidT = uuid.value;
  uuid.value = '';
  nextTick(() => {
    uuid.value = uuidT;
  })
  return uuidT;
}

const handleMouseLeave = (data) => {
  if (iconVisible.value) {
    data.hover = false
  }
}

async function saveDocument() {
  if (shouldBlockForPendingImageUploads()) return null;

  const nextRow = buildEditingRow();
  if (!nextRow) return null;

  const res = await updateFormRow(table.value.uid, [nextRow])
  const savedRow = stripDraftRowMeta(res?.data?.bucket?.rows?.[0]);
  if (!savedRow) return null;

  documentData.value = cloneRow(savedRow);
  baseDocumentData.value = cloneRow(savedRow);
  editingInitialRow.value = cloneRow(savedRow);
  lastSavedDraftRow.value = null;
  draftDirty.value = false;

  if (treeRef.value) {
    // 查找当前编辑的节点并更新其标签
    const updateNodeLabel = (nodes) => {
      for (let node of nodes) {
        if (node.id === uuid.value) {
          node.row = { ...savedRow };
          node.label = savedRow[documentTreeTitleField.uid];
          // 强制更新树的显示
          return true;
        }
        // 递归检查子节点
        if (node.children && node.children.length > 0) {
          const updated = updateNodeLabel(node.children);
          if (updated) {
            return true;
          }
        }
      }
      return false;
    };

    // 更新树数据
    const updated = updateNodeLabel(treeData.value);
    if (updated) {
      treeData.value = [...treeData.value];
      await nextTick();
      await syncTreeCurrentState(savedRow[uuidField.uid]);
    }
  }
  return savedRow;
}

async function handleSave() {
  if (shouldBlockForPendingImageUploads()) return;

  clearAutoSaveDraftTimer();
  await waitPendingDraftFlush();
  if (shouldBlockForPendingImageUploads()) return;
  let shouldNotifySubmitValidationMessages = false;

  try {
    if (isSetting.value && editingFormRef.value) {
      const row = await editingFormRef.value?.prepareSubmitRow()?.catch(err => { });
      if (!row) {
        return;
      }
      const confirmed = await editingFormRef.value.confirmSubmitBeforeMutation?.({
        onSignSyncConflict: flushPendingDraft,
      });
      if (!confirmed) {
        return;
      }
      merge(documentData.value, row)
    }
    isSetting.value = false
    const savedRow = await saveDocument()
    if (!savedRow) {
      return;
    }
    shouldNotifySubmitValidationMessages = true;
    await deleteDraftByUUID().catch((error) => {
      console.error('Failed to delete document draft after save', error);
    });
    isViewing.value = true
  } finally {
    if (shouldNotifySubmitValidationMessages) {
      editingFormRef.value?.notifySubmitValidationMessages?.();
    }
    editingFormRef.value?.clearSubmitValidationNotice?.();
  }
}

const handleCurrentChange = async (data: CustomNodeData, node: TreeNode) => {
  if (data.type === 'document') {
    const nextDocumentId = data.row?.[uuidField.uid];
    if (pendingTreeSelectionRestoreDocumentId) {
      if (nextDocumentId === pendingTreeSelectionRestoreDocumentId) {
        pendingTreeSelectionRestoreDocumentId = null;
        return;
      }
      pendingTreeSelectionRestoreDocumentId = null;
    }
    if (nextDocumentId && nextDocumentId !== uuid.value) {
      const allowLeave = await ensureCanLeaveCurrentDocument(true);
      if (!allowLeave) {
        return;
      }
    }

    if (!data.row) {
      return;
    }

    if (!isViewing.value) {
      await flushPendingDraft();
    }

    await setCurrentDocument(data.row, !isViewing.value);
    if (!isViewing.value) {
      queueSyncEditingInitialRow(data.row[uuidField.uid]);
    }
  }
}

const handleNodeClick = async (data: CustomNodeData, node: TreeNode) => {
  if (data.type === 'catalog') {
    handleExpand(node);
  }
}

const getTreeNodeDomRefsById = (nodeId: string) => {
  const wrapperElement = getTreeNodeWrapperElementById(nodeId);
  if (!wrapperElement) {
    return {
      wrapperElement: null,
      contentElement: null,
      customNodeElement: null,
      labelElement: null,
    };
  }

  return {
    wrapperElement,
    contentElement: wrapperElement.querySelector('.el-tree-node__content') as HTMLElement | null,
    customNodeElement: wrapperElement.querySelector('.custom-tree-node') as HTMLElement | null,
    labelElement: wrapperElement.querySelector('.node-label') as HTMLElement | null,
  };
};

const getTreeNodeWrapperElementFromEvent = (event: DragEvent, nodeId: string) => {
  const eventTarget = event.target as HTMLElement | null;
  const targetWrapperElement = eventTarget?.closest?.('.el-tree-node[data-key]') as HTMLElement | null;
  if (targetWrapperElement?.dataset.key === nodeId) {
    return targetWrapperElement;
  }
  return getTreeNodeWrapperElementById(nodeId);
};

const toggleTreeNodeDragClass = (nodeId: string | null, className: string, target: 'custom' | 'label', shouldAdd: boolean) => {
  if (!nodeId) return;
  const { wrapperElement, customNodeElement, labelElement } = getTreeNodeDomRefsById(nodeId);
  const node = treeRef.value?.getNode(nodeId) as TreeNode | undefined;
  if (!wrapperElement || !canContainTreeChildren(node?.data as CustomNodeData)) return;

  const targetElement = target === 'custom' ? customNodeElement : labelElement;
  if (!targetElement) return;

  targetElement.classList.toggle(className, shouldAdd);
};

const hasTreeNodeDragClass = (nodeId: string | null, className: string, target: 'custom' | 'label') => {
  if (!nodeId) return false;
  const { wrapperElement, customNodeElement, labelElement } = getTreeNodeDomRefsById(nodeId);
  const node = treeRef.value?.getNode(nodeId) as TreeNode | undefined;
  if (!wrapperElement || !canContainTreeChildren(node?.data as CustomNodeData)) return false;

  const targetElement = target === 'custom' ? customNodeElement : labelElement;
  return targetElement?.classList.contains(className) ?? false;
};

const clearTreeDragIndicator = () => {
  if (!treeDragIndicatorState.visible && !treeDragIndicatorVisible.value) {
    return;
  }

  treeDragIndicatorState = {
    visible: false,
    top: 0,
    left: 0,
    width: 0,
  };
  treeDragIndicatorVisible.value = false;
};

const clearTreeDragHoverState = () => {
  toggleTreeNodeDragClass(treeDragHoverState.nodeId, 'is-direct-drop-target-catalog', 'custom', false);
  toggleTreeNodeDragClass(treeDragHoverState.highlightCatalogId, 'is-inherited-drop-target-catalog', 'label', false);

  treeDragHoverState = {
    nodeId: null,
    dropType: 'none',
    highlightCatalogId: null,
  };
};

const resolveTreeDragHighlightCatalogId = (dropNode: TreeNode | null | undefined, dropType: NodeDropType) => {
  if (!dropNode || dropType === 'none') {
    return null;
  }

  if (dropType === 'inner') {
    return canContainTreeChildren(dropNode.data as CustomNodeData) ? dropNode.data.id : null;
  }

  return dropNode.data?.parentIds?.[0] ?? null;
};

const setTreeDragHoverState = (
  nodeId: string | null | undefined,
  dropType: NodeDropType,
  highlightCatalogId: string | null,
) => {
  const nextNodeId = nodeId ?? null;
  const nextDirectNodeId = dropType !== 'none' ? nextNodeId : null;
  const nextInheritedNodeId = (
    highlightCatalogId
    && highlightCatalogId !== nextDirectNodeId
  )
    ? highlightCatalogId
    : null;

  if (
    treeDragHoverState.nodeId === nextNodeId
    && treeDragHoverState.dropType === dropType
    && treeDragHoverState.highlightCatalogId === highlightCatalogId
  ) {
    if (nextDirectNodeId && !hasTreeNodeDragClass(nextDirectNodeId, 'is-direct-drop-target-catalog', 'custom')) {
      toggleTreeNodeDragClass(nextDirectNodeId, 'is-direct-drop-target-catalog', 'custom', true);
    }
    if (nextInheritedNodeId && !hasTreeNodeDragClass(nextInheritedNodeId, 'is-inherited-drop-target-catalog', 'label')) {
      toggleTreeNodeDragClass(nextInheritedNodeId, 'is-inherited-drop-target-catalog', 'label', true);
    }
    return;
  }

  const previousDirectNodeId = treeDragHoverState.dropType !== 'none' ? treeDragHoverState.nodeId : null;
  const previousInheritedNodeId = (
    treeDragHoverState.highlightCatalogId
    && treeDragHoverState.highlightCatalogId !== previousDirectNodeId
  )
    ? treeDragHoverState.highlightCatalogId
    : null;

  if (previousDirectNodeId !== nextDirectNodeId) {
    toggleTreeNodeDragClass(previousDirectNodeId, 'is-direct-drop-target-catalog', 'custom', false);
    toggleTreeNodeDragClass(nextDirectNodeId, 'is-direct-drop-target-catalog', 'custom', true);
  }

  if (previousInheritedNodeId !== nextInheritedNodeId) {
    toggleTreeNodeDragClass(previousInheritedNodeId, 'is-inherited-drop-target-catalog', 'label', false);
    toggleTreeNodeDragClass(nextInheritedNodeId, 'is-inherited-drop-target-catalog', 'label', true);
  }

  treeDragHoverState = {
    nodeId: nextNodeId,
    dropType,
    highlightCatalogId,
  };
};

const clearTreeDragExpandTimer = () => {
  if (treeDragExpandTimer !== null) {
    window.clearTimeout(treeDragExpandTimer);
    treeDragExpandTimer = null;
  }
  treeDragExpandTargetId = null;
};

const scheduleTreeDragExpand = (dropNode: TreeNode, dropType: NodeDropType) => {
  if (dropType === 'none' || !canContainTreeChildren(dropNode.data as CustomNodeData) || dropNode.expanded) {
    clearTreeDragExpandTimer();
    return;
  }

  if (treeDragExpandTargetId === dropNode.data.id) {
    return;
  }

  clearTreeDragExpandTimer();
  treeDragExpandTargetId = dropNode.data.id;
  treeDragExpandTimer = window.setTimeout(() => {
    setNodeExpandedState(dropNode, true);
    treeDragExpandTimer = null;
    treeDragExpandTargetId = null;
  }, 350);
};

const resolveTreeDragFeedback = (draggingNode: TreeNode, dropNode: TreeNode, event: DragEvent) => {
  let dropPrev = allowDrop(draggingNode, dropNode, 'prev');
  let dropInner = allowDrop(draggingNode, dropNode, 'inner');
  let dropNext = allowDrop(draggingNode, dropNode, 'next');

  if ((dropNode as any).nextSibling === draggingNode) {
    dropNext = false;
  }
  if ((dropNode as any).previousSibling === draggingNode) {
    dropPrev = false;
  }
  if ((dropNode as any).contains?.(draggingNode, false)) {
    dropInner = false;
  }
  if (draggingNode === dropNode || (draggingNode as any).contains?.(dropNode)) {
    return {
      dropType: 'none' as NodeDropType,
      highlightCatalogId: null,
      indicator: null,
    };
  }

  const containerElement = asideTreeRef.value;
  const wrapperElement = getTreeNodeWrapperElementFromEvent(event, dropNode.data.id);
  const contentElement = wrapperElement?.querySelector('.el-tree-node__content') as HTMLElement | null;
  const customNodeElement = wrapperElement?.querySelector('.custom-tree-node') as HTMLElement | null;

  if (!contentElement) {
    return {
      dropType: 'none' as NodeDropType,
      highlightCatalogId: null,
      indicator: null,
    };
  }

  const contentRect = contentElement.getBoundingClientRect();
  const prevPercent = dropPrev
    ? (
      dropInner
        ? 0.25
        : (dropNext ? 0.45 : 1)
    )
    : Number.NEGATIVE_INFINITY;
  const nextPercent = dropNext
    ? (
      dropInner
        ? 0.75
        : (dropPrev ? 0.55 : 0)
    )
    : Number.POSITIVE_INFINITY;
  const distance = event.clientY - contentRect.top;
  let dropType: NodeDropType = 'none';

  if (distance < contentRect.height * prevPercent) {
    dropType = 'before';
  } else if (distance > contentRect.height * nextPercent) {
    dropType = 'after';
  } else if (dropInner) {
    dropType = 'inner';
  }

  let indicator: { top: number, left: number, width: number } | null = null;
  if (dropType !== 'none' && dropType !== 'inner' && containerElement && customNodeElement) {
    const containerRect = containerElement.getBoundingClientRect();
    const customNodeRect = customNodeElement.getBoundingClientRect();
    indicator = {
      top: dropType === 'before'
        ? contentRect.top - containerRect.top
        : contentRect.bottom - containerRect.top,
      left: Math.max(customNodeRect.left - containerRect.left + 8, 14),
      width: Math.max(containerRect.right - customNodeRect.left - 8, 48),
    };
  }

  return {
    dropType,
    highlightCatalogId: resolveTreeDragHighlightCatalogId(dropNode, dropType),
    indicator,
  };
};

const updateTreeDragIndicator = (indicator: { top: number, left: number, width: number } | null) => {
  const nextIndicatorState = indicator
    ? {
      visible: true,
      top: indicator.top,
      left: indicator.left,
      width: indicator.width,
    }
    : {
      visible: false,
      top: 0,
      left: 0,
      width: 0,
    };

  if (
    treeDragIndicatorState.visible === nextIndicatorState.visible
    && treeDragIndicatorState.top === nextIndicatorState.top
    && treeDragIndicatorState.left === nextIndicatorState.left
    && treeDragIndicatorState.width === nextIndicatorState.width
  ) {
    return;
  }

  treeDragIndicatorState = nextIndicatorState;
  treeDragIndicatorVisible.value = nextIndicatorState.visible;

  const indicatorElement = treeDragIndicatorRef.value;
  if (!indicatorElement || !nextIndicatorState.visible) {
    return;
  }

  indicatorElement.style.top = `${nextIndicatorState.top}px`;
  indicatorElement.style.left = `${nextIndicatorState.left}px`;
  indicatorElement.style.width = `${nextIndicatorState.width}px`;
};

const processTreeDragOver = (draggingNode: TreeNode, dropNode: TreeNode | null, event: DragEvent | null) => {
  if (!dropNode || !event) {
    clearTreeDragExpandTimer();
    clearTreeDragIndicator();
    clearTreeDragHoverState();
    return;
  }

  const { dropType, highlightCatalogId, indicator } = resolveTreeDragFeedback(draggingNode, dropNode, event);
  scheduleTreeDragExpand(dropNode, dropType);
  updateTreeDragIndicator(indicator);
  setTreeDragHoverState(dropNode.data?.id, dropType, highlightCatalogId);
};

const cancelTreeDragOverFrame = () => {
  if (treeDragOverFrameId !== null) {
    window.cancelAnimationFrame(treeDragOverFrameId);
    treeDragOverFrameId = null;
  }
  pendingTreeDragOverPayload = null;
};

const queueTreeDragOver = (draggingNode: TreeNode, dropNode: TreeNode | null, event: DragEvent | null) => {
  pendingTreeDragOverPayload = { draggingNode, dropNode, event };
  if (treeDragOverFrameId !== null) {
    return;
  }

  treeDragOverFrameId = window.requestAnimationFrame(() => {
    treeDragOverFrameId = null;
    const payload = pendingTreeDragOverPayload;
    pendingTreeDragOverPayload = null;
    if (!payload) return;

    processTreeDragOver(payload.draggingNode, payload.dropNode, payload.event);
  });
};

const handleNodeDragOver = (draggingNode: TreeNode, dropNode: TreeNode, event: DragEvent) => {
  queueTreeDragOver(draggingNode, dropNode, event);
};

const handleNodeDragLeave = () => {
  clearTreeDragExpandTimer();
  clearTreeDragIndicator();
  clearTreeDragHoverState();
};

const handleTreeDragEnd = () => {
  cancelTreeDragOverFrame();
  clearTreeDragExpandTimer();
  clearTreeDragIndicator();
  clearTreeDragHoverState();
};

const allowDrop = (_draggingNode: TreeNode, dropNode: TreeNode, type: AllowDropType) => {
  if (type === 'inner' && !canContainTreeChildren(dropNode.data as CustomNodeData)) {
    return false;
  }
  return true;
}

async function handleNodeDrop(draggingNode: TreeNode, dropNode: TreeNode, dropType: NodeDropType) {
  clearTreeDragExpandTimer();
  clearTreeDragIndicator();
  clearTreeDragHoverState();
  const newParentId = dropType === 'inner'
    ? dropNode.data.id
    : dropNode.data.parentIds?.[0] || null;

  draggingNode.data.parentIds = newParentId ? [newParentId] : [];

  resetTreeSort(treeData.value);
  const flatNodes = flattenTree(treeData.value);
  const changedNodes = flatNodes.filter(nodeData => {
    const parentFieldUid = nodeData.type === 'catalog' ? catalogParentField.uid : parentField.uid;
    const sortFieldUid = nodeData.type === 'catalog' ? catalogSortField.uid : sortField.uid;
    return (nodeData.row[parentFieldUid]?.[0] !== (nodeData.parentIds?.[0])) ||
      (nodeData.row[sortFieldUid] !== nodeData.sort);
  });

  try {
    await syncTreeData(changedNodes);
    if (dropType === 'inner') {
      setNodeExpandedState(dropNode, true);
    }
  } catch (error) {
    console.error(i18next.t('DocumentView.saveFail'), error);
  }
}

async function syncTreeData(nodesToSync: CustomNodeData[]) {
  if (nodesToSync.length === 0) return;

  const parentTableRows = nodesToSync.filter(item => item.type === 'catalog').map(item => {
    item.row[catalogParentField.uid] = item.parentIds[0] ? item.parentIds : [];
    item.row[catalogUuidField.uid] = item.id;
    item.row[catalogSortField.uid] = item.sort;
    return {
      [catalogParentField.uid]: item.row[catalogParentField.uid],
      [catalogUuidField.uid]: item.row[catalogUuidField.uid],
      [catalogSortField.uid]: item.row[catalogSortField.uid],
    };
  });

  const childrenTableRows = nodesToSync.filter(item => item.type === 'document').map(item => {
    item.row[parentField.uid] = item.parentIds[0] ? item.parentIds : [];
    item.row[uuidField.uid] = item.id;
    item.row[sortField.uid] = item.sort;
    return {
      [parentField.uid]: item.row[parentField.uid],
      [uuidField.uid]: item.row[uuidField.uid],
      [sortField.uid]: item.row[sortField.uid],
    };
  });

  const httpArr: Promise<any>[] = [];
  if (parentTableRows.length) {
    httpArr.push(axios.post(`form-data/update-sort-data`, {
      nocodeId: nocodeId,
      rows: parentTableRows,
      tableUID: catalogTable.uid,
    }));
  }
  if (childrenTableRows.length) {
    httpArr.push(axios.post(`form-data/update-sort-data`, {
      nocodeId: nocodeId,
      rows: childrenTableRows,
      tableUID: table.value.uid,
    }));
  }

  return Promise.all(httpArr);
}

function resetTreeSort(data: CustomNodeData[]) {
  let globalSort = 0;
  const traverse = (nodes: CustomNodeData[]) => {
    nodes.forEach(node => {
      node.sort = ++globalSort;
      if (node.children && node.children.length > 0) {
        traverse(node.children);
      }
    });
  };
  traverse(data);
}

function getLastNodeInSubtree(data: CustomNodeData): CustomNodeData {
  if (data.children && data.children.length > 0) {
    return getLastNodeInSubtree(data.children[data.children.length - 1]);
  }
  return data;
}

function calculateNewSort(data: CustomNodeData, node: TreeNode, position: 'above' | 'below' | 'inside') {
  const flat = flattenTree(treeData.value);

  if (position === 'above') {
    const index = flat.findIndex(n => n.id === data.id);
    if (index === -1) return 1;
    const prev = flat[index - 1];
    return prev ? (prev.sort + data.sort) / 2 : data.sort / 2;
  }

  if (position === 'below' || position === 'inside') {
    let lastNode: CustomNodeData;
    if (node.level === 0) {
      if (treeData.value.length === 0) return 1;
      lastNode = getLastNodeInSubtree(treeData.value[treeData.value.length - 1]);
    } else {
      lastNode = getLastNodeInSubtree(data);
    }

    const index = flat.findIndex(n => n.id === lastNode.id);
    const next = flat[index + 1];
    return next ? (lastNode.sort + next.sort) / 2 : lastNode.sort + 1;
  }

  return 1;
}

const commandHandles = computed<CommandHandles>(() => ({
  addCatalog,
  addDocument,
  addDocumentAbove,
  addDocumentBelow,
  copyNode,
  renameNode,
  deleteNode
}));

async function addDocumentAbove(data: CustomNodeData, node: TreeNode) {
  const parentNode = node.parent;
  let sort = calculateNewSort(data, node, 'above');
  let newRow: Row = {
    [sortField.uid]: sort,
  };
  const parentData = parentNode.level === 0
    ? { children: parentNode.data } as unknown as CustomNodeData
    : parentNode.data as CustomNodeData;
  addDocument(parentData, parentNode, newRow);
}

async function addDocumentBelow(data: CustomNodeData, node: TreeNode) {
  const parentNode = node.parent;
  let sort = calculateNewSort(data, node, 'below');
  let newRow: Row = {
    [sortField.uid]: sort,
  };
  const parentData = parentNode.level === 0
    ? { children: parentNode.data } as unknown as CustomNodeData
    : parentNode.data as CustomNodeData;
  addDocument(parentData, parentNode, newRow);
}

async function addCatalog(data: CustomNodeData, node: TreeNode) {
  setNodeExpandedState(node, true);
  let label: string = i18next.t('DocumentView.unnamedCatalog');
  let parentIds: string[] = data.id ? [data.id] : [];
  const targetTitleField = isSelfCatalogTable ? documentTreeTitleField : catalogTitleField;
  const targetParentField = isSelfCatalogTable ? parentField : catalogParentField;
  const targetSortField = isSelfCatalogTable ? sortField : catalogSortField;
  const targetUuidField = isSelfCatalogTable ? uuidField : catalogUuidField;
  const targetSubFormField = isSelfCatalogTable ? subFormField : catalogSubFormField;
  const row = {
    [targetTitleField.uid]: label,
    [targetParentField.uid]: parentIds,
    [targetSortField.uid]: calculateNewSort(data, node, 'inside'),
  };
  if (isSelfCatalogTable && titleField.uid !== targetTitleField.uid) {
    row[titleField.uid] = label;
  }
  if (targetSubFormField) {
    row[targetSubFormField.uid] = [];
  }
  const res = await createFormRow(catalogTable.uid, [row]);
  const rowData = res.data.rows[0];
  // 组装新节点的nodeData
  const newNodeData: CustomNodeData = {
    row: { ...rowData },
    label: rowData[targetTitleField.uid],
    id: rowData[targetUuidField.uid],
    parentIds: rowData[targetParentField.uid],
    sort: rowData[targetSortField.uid] || 0,
    tableId: catalogTable.uid,
    type: isSelfCatalogTable ? 'document' : 'catalog',
    hover: false,
    rename: false,
    children: [],
    canContainChildren: isSelfCatalogTable,
  }
  treeRef.value.append(newNodeData, node);
  renameNode(newNodeData);
  await scrollToTreeNodeById(newNodeData.id);
}
const changeDocument = async (data: CustomNodeData) => {
  if (!data || !data.row) return;
  await setCurrentDocument(data.row);
}
async function addDocument(data: CustomNodeData, node: TreeNode, row?: Row) {
  const allowLeave = await ensureCanLeaveCurrentDocument(true);
  if (!allowLeave) {
    return;
  }
  setNodeExpandedState(node, true);
  // 实现添加文档的逻辑
  let label: string = i18next.t('DocumentView.unnamedDoc');
  let parentIds: string[] = data.id ? [data.id] : [];
  let newRow: Row = {
    [titleField.uid]: label,
    [contentField.uid]: normalizeDocumentContentHtml(row?.[contentField.uid]),
    [parentField.uid]: parentIds,
    [sortField.uid]: calculateNewSort(data, node, 'inside'),
  };
  if (isSelfCatalogTable && documentTreeTitleField.uid !== titleField.uid) {
    newRow[documentTreeTitleField.uid] = label;
  }
  if (row) newRow = { ...newRow, ...row };
  if (subFormField) {
    newRow[subFormField.uid] = row?.[subFormField.uid] || [];
  }
  const res = await createFormRow(table.value.uid, [newRow]);
  const rowData = res.data.rows[0];
  const newNodeData: CustomNodeData = {
    row: { ...rowData },
    label: rowData[documentTreeTitleField.uid],
    id: rowData[uuidField.uid],
    parentIds: rowData[parentField.uid],
    sort: rowData[sortField.uid],
    tableId: table.value.uid,
    type: 'document',
    hover: false,
    rename: false,
    canContainChildren: isSelfCatalogTable,
  }
  let referNodeIndex: number = node.childNodes.findIndex(item => item.data.sort > newNodeData.sort);
  if (referNodeIndex === -1) {
    treeRef.value.append(newNodeData, node);
  } else {
    treeRef.value.insertBefore(newNodeData, node.childNodes[referNodeIndex]);
  }
  treeRef.value.setCurrentKey(newNodeData.id);
  await changeDocument(newNodeData);
  isViewing.value = false;
  await scrollToTreeNodeById(newNodeData.id);
  queueEnsureEditorSelection(newNodeData.id);
}

async function copyNode(data: CustomNodeData, node: TreeNode) {
  const allowLeave = await ensureCanLeaveCurrentDocument(true);
  if (!allowLeave) {
    return;
  }
  const parentNode = node.parent;
  let sort = data.sort + 1;
  if (node.nextSibling) {
    sort = (node.data.sort + node.nextSibling.data.sort) / 2;
  }
  let newRow: Row = {
    [uuidField.uid]: unique() // 新的子表单数据需要指定父表的uuid
  };
  for (const field of table.value.fields) {
    if (isSystemField(field)) continue;

    if (field.meta.subType === 'subForm') {
      // 填充子表单数据，
      data.row[field.uid] = await getSubFormData(data.row[uuidField.uid]);
      newRow[field.uid] = data.row[field.uid].map((item: Row) => ({
        ...item,
        [subFormUuidField.uid]: undefined,  // 拷贝的子表单数据为新数据，uuid置空
        [subFormRelatedDataIdField.uid]: newRow[uuidField.uid], // 关联数据ID字段值指定为新节点的uuid
      }));
      continue;
    }
    newRow[field.uid] = data.row[field.uid];
  }
  newRow = {
    ...newRow,
    [sortField.uid]: sort,
  }
  const parentData = parentNode.level === 0 
    ? { children: parentNode.data } as unknown as CustomNodeData 
    : parentNode.data as CustomNodeData;
  addDocument(parentData, parentNode, newRow);
}

function renameNode(data: CustomNodeData, node?: TreeNode) {
  data.rename = true;
  treeDraggable.value = false;
  nextTick(() => {
    inputRef.value.focus();
    inputRef.value.select();
  })
}
async function handleRenameBlur(data: CustomNodeData) {
  let originalRow: Row = {};
  const typeUidMap = {
    document: [uuidField.uid, documentTreeTitleField.uid],
    catalog: [catalogUuidField.uid, catalogTitleField.uid]
  }
  originalRow[typeUidMap[data.type][0]] = data.id;
  originalRow[typeUidMap[data.type][1]] = data.label;
  // 重命名保存请求
  const res = await updateFormRow(data.tableId, [originalRow]);
  data.rename = false;
  treeDraggable.value = true;
  data.row = res.data.bucket.rows[0];
  refreshContentContainer();
}

function deleteNode(data: CustomNodeData, node: TreeNode) {
  const affectsCurrentDocument = isCurrentDocumentInTreeNode(data);
  if (affectsCurrentDocument && shouldBlockForPendingImageUploads(true)) {
    void syncTreeCurrentState(uuid.value);
    return;
  }
  const textMap = {
    document: {
      text: i18next.t('DocumentView.confirmDelDoc'),
      tip: i18next.t('DocumentView.delDocWarn')
    },
    catalog: {
      text: i18next.t('DocumentView.confirmDelCatalog'),
      tip: i18next.t('DocumentView.delCatalogWarn')
    }
  }
  const deleteConfirmContext: DeleteConfirmContext = {
    text: textMap[data.type].text,
    tip: textMap[data.type].tip,
    visible: true,
    confirm: async () => { await _deleteNode(data, node) }
  };
  setDeleteConfirmDialog(deleteConfirmContext)
}

function collectDocumentUUIDs(data: CustomNodeData): string[] {
  const ids: string[] = data.type === 'document' ? [data.id] : [];
  if (!data.children?.length) {
    return ids;
  }
  data.children.forEach((child) => {
    ids.push(...collectDocumentUUIDs(child));
  });
  return ids;
}

function isCurrentDocumentInTreeNode(data: CustomNodeData): boolean {
  if (!uuid.value) {
    return false;
  }
  return collectDocumentUUIDs(data).includes(uuid.value);
}

async function _deleteNode(data: CustomNodeData, node: TreeNode) {
  if (isCurrentDocumentInTreeNode(data)) {
    const allowLeave = await ensureCanLeaveCurrentDocument(true);
    if (!allowLeave) {
      return;
    }
  }
  const typeUidMap = {
    document: [uuidField.uid, titleField.uid],
    catalog: [catalogUuidField.uid, catalogTitleField.uid]
  }
  const documentUUIDs = collectDocumentUUIDs(data);
  if (documentUUIDs.length) {
    await deleteDraftsByUUIDs(documentUUIDs);
  }
  // 递归删除所有children
  const dn = (data: CustomNodeData) => {
    let p = [];
    if (data.children && data.children.length > 0) {
      for (const iterator of data.children) {
        p = p.concat(dn(iterator));
      }
    }
    let originalRow: Row = {};
    originalRow[typeUidMap[data.type][0]] = data.id;
    p.push(deleteFormRow(data.tableId, [originalRow]));
    return p;
  }
  const deletePromiseArr = dn(data);
  await Promise.all(deletePromiseArr);
  treeRef.value.remove(node);
  uuid.value = '';
}

async function getSubFormData(relatedDataId: string) {
  let filters = {
    [subFormTable.uid]: [
      { [subFormRelatedDataIdField.uid]: { '$in': [relatedDataId] } }
    ]
  };
  const res = await getFormData(subFormTable.uid, { filters });
  return res.data[0].rows;
}

const filterNode = (value, data) => {
  if (!value) return true
  return data.label.indexOf(value) !== -1
}

const append = (data) => {
  console.log(data)
  //  const newChild = { id: id++, label: 'testtest', children: [] }
  //       if (!data.children) {
  //           data.children = []
  //         }
  //         data.children.push(newChild)
  //         this.data = [...this.data]
}

const handleExpandAll = async () => {
  // 获取所有节点的 key
  if (expandedKeys.value.length === 0) {
    treeVisible.value = false
    await nextTick()
    treeExpandedStateInitialized.value = true;
    expandedKeys.value = getAllNodeKeys(treeData.value)
    treeDefaultExpandedKeys.value = [...expandedKeys.value]
    treeVisible.value = true
  } else {
    treeVisible.value = false;
    await nextTick()
    treeExpandedStateInitialized.value = true;
    treeDefaultExpandedKeys.value = []
    treeVisible.value = true
    expandedKeys.value = []

  }
}

async function updateFormRow(formId: TableUID, rows: Row[]) {
  const res = await axios.post(`/form-data/form/update/${nocodeId}/${formId}`, { rows }).then(res => {
    ElMessage.success(i18next.t('DocumentView.saveSuccess'));
    return res;
  }).catch(err => {
    console.error(err);
    ElMessage.error(i18next.t('DocumentView.saveFail'));
    return err;
  })
  return res;
}

async function createFormRow(formId: TableUID, rows: Row[]) {
  const res = await axios.post(`/form-data/form/create/${nocodeId}/${formId}`, { rows }).then(res => {
    ElMessage.success(i18next.t('DocumentView.createSuccess'));
    return res;
  }).catch(err => {
    console.error(err);
    return err;
  })
  return res;
}

async function deleteFormRow(formId: TableUID, rows: Row[]) {
  const res = await axios.post(`/form-data/form/delete/${nocodeId}/${formId}`, { rows }).then(res => {
    ElMessage.success(i18next.t('DocumentView.deleteSuccess'));
  }).catch(err => {
    console.error(err)
    return err;
  })
  return res;
}

async function getFormData(formId: TableUID, options: QueryOptions) {
  const res = await axios.post('/form-data/get', {
    nocodeId: nocodeId,
    tableUIDs: [formId],
    options
  }).then(res => {
    return res;
  }).catch(err => {
    console.error(err)
    return err;
  })
  return res;
}

async function refreshTree() {
  let asideLoading = null
  try {
    if (!isLoaded) {
      asideLoading = ElLoading.service({
        target: '#document-view-aside-tree-loading-area',
        fullscreen: false,
        text: i18next.t('DocumentView.loading')
      });
    }
    const catalogTableInfo: TableInfo = {
      tableId: catalogTable.uid,
      table: catalogTable,
      promise: null,
      data: null
    };
    const selfTable: TableInfo = {
      tableId: table.value.uid,
      table: table.value,
      promise: null,
      data: null
    };

    const allTables: TableInfo[] = isSelfCatalogTable
      ? [selfTable]
      : [catalogTableInfo, selfTable];
    for (const iterator of allTables) {
      iterator.promise = axios.get(`nocode/read-form-list`, {
        params: {
          nocodeId: nocodeId,
          connectionId: connection.value.uid,
          tableId: iterator.tableId,
        }
      })
    }
    const tableResponses = await Promise.all(allTables.map(t => t.promise));
    if (isSelfCatalogTable) {
      selfTable.data = tableResponses[0].data;
    } else {
      [catalogTableInfo.data, selfTable.data] = tableResponses.map(response => response.data);
    }

    const catalogItems: CustomNodeData[] = isSelfCatalogTable
      ? []
      : catalogTableInfo.data.rows.map(item => {
        return {
          row: { ...item },
          label: item[catalogTitleField.uid],
          id: item[catalogUuidField.uid],
          parentIds: item[catalogParentField?.uid],
          sort: item[catalogSortField.uid] || 0,
          tableId: catalogTable.uid,
          type: 'catalog' as 'catalog',
          hover: false,
          rename: false
        }
      });
    const documentItems: CustomNodeData[] = selfTable.data.rows.map(item => {
      return {
        row: { ...item },
        label: item[documentTreeTitleField?.uid],
        id: item[uuidField.uid],
        parentIds: item[parentField.uid],
        sort: item[sortField.uid] || 0,
        tableId: table.value.uid,
        type: 'document' as 'document',
        hover: false,
        rename: false,
        canContainChildren: isSelfCatalogTable,
      }
    });
    const items: CustomNodeData[] = [...catalogItems, ...documentItems];
    treeData.value = buildTree(items);
    resetTreeSort(treeData.value);

    // 自动修复并同步 sort 为 0 或冲突的数据
    const flatNodes = flattenTree(treeData.value);
    const nodesToSync = flatNodes.filter(nodeData => {
      const sortFieldUid = nodeData.type === 'catalog' ? catalogSortField.uid : sortField.uid;
      return nodeData.row[sortFieldUid] !== nodeData.sort;
    });
    if (nodesToSync.length > 0) {
      await syncTreeData(nodesToSync);
    }

    // 默认展开所有第一级的菜单
    const currentNodeKeys = new Set(flatNodes.map(node => node.id));
    expandedKeys.value = treeExpandedStateInitialized.value
      ? expandedKeys.value.filter(key => currentNodeKeys.has(key))
      : treeData.value.map(item => item.id);
    treeExpandedStateInitialized.value = true;
    treeDefaultExpandedKeys.value = [...expandedKeys.value];
    await nextTick();
    applyExpandedKeysToTree();
  } catch (error) {
    console.error('Failed to refresh tree', error);
  } finally {
    asideLoading?.close();
    isLoaded = true;
  }
}

const handleChangeTitleBlur = async () => {
  if (documentData.value && titleField && documentData.value[titleField.uid] !== titleValue.value) {
    documentData.value[titleField.uid] = titleValue.value;
    scheduleAutoSaveDraft();
  }
};

const handleTitleInput = () => {
  if (isViewing.value) return;
  markDraftDirty();
};

watch(() => props.active, async (value) => {
  if (!value) {
    await flushPendingDraft();
    return;
  }
  refreshTree();
}, { immediate: true })

watch(() => isViewing.value, (value) => {
  if (value) {
    clearAutoSaveDraftTimer();
    resetSettingDraftTracking();
    return;
  }
  queueEnsureEditorSelection(uuid.value);
  queueSyncEditingInitialRow(uuid.value);
}, { immediate: true })

watch(
  () => buildSettingFormSnapshot(),
  (currentRow) => {
    if (!currentRow) {
      resetSettingDraftTracking();
      return;
    }
    if (!settingDraftTrackingReady.value) {
      if (Object.keys(currentRow).length === 0) {
        return;
      }
      settingFormSnapshot.value = cloneRow(currentRow);
      settingDraftTrackingReady.value = true;
      return;
    }
    if (settingFormSnapshot.value && equals(currentRow, settingFormSnapshot.value)) {
      return;
    }
    settingFormSnapshot.value = cloneRow(currentRow);
    markDraftDirty();
  },
  { flush: 'post' }
)

const handleWindowBeforeUnload = (event: BeforeUnloadEvent) => {
  if (!hasPendingLeaveWork()) return;
  event.preventDefault();
  event.returnValue = '';
};

window.addEventListener('beforeunload', handleWindowBeforeUnload);

defineExpose({
  canLeaveView,
});

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleWindowBeforeUnload);
  void flushPendingDraft();
  clearEditorUploadIndicatorHideTimer();
  imageUploadTasks.value = {};
  cleanupEditorInteractionListeners();
  cancelTreeDragOverFrame();
  clearTreeDragExpandTimer();
})

watch(filterText, (newVal) => {
  tree.value.filter(newVal)
})

watch(() => treeData.value, (newVal: CustomNodeData[]) => {
  nextTick(() => {
    rootNode.value = treeRef.value.root;
  })
})
</script>


<style lang='scss' scoped>
.document-view {
  display: flex;
  height: 100%;
  background-color: var(--bg-color-page);

  :deep(.el-aside) {
    height: 100%;

    &>div {
      height: 100%;
      display: flex;
      flex-direction: column;
    }
  }
}

.aside-tree {
  padding: 0 0 0 8px;
  flex: 1;
  min-height: 0;
  position: relative;

  :deep(.el-scrollbar) {
    .el-scrollbar__wrap {
      padding-right: 8px;
    }

    .el-scrollbar__bar {
      right: 1px;
    }
  }
}

:deep(.el-tree) {
  --hover-color: #F5F6F7;

  .el-tree__drop-indicator {
    display: none !important;
  }

  .el-tree-node {
    overflow: visible;

    .el-tree-node__content .custom-tree-node {
      max-width: 100%;
      flex: 1;
      display: flex;
      align-items: center;
      gap: 4px;
      font-weight: 400;
      padding: 0px 8px;
      font-size: 14px;
      color: #373737;
      height: 32px;
      font-family: "PingFangSC-Regular", "din", "Microsoft Yahei", "Arial", "Helvetica Neue", "Helvetica", sans-serif;

      &.is-direct-drop-target-catalog {
        background-color: var(--el-color-primary-light-9);
        box-shadow: inset 0 0 0 1px var(--el-color-primary-light-5);
        color: var(--el-color-primary-dark-2);
        border-radius: 8px;
      }

      .node-arrow {
        position: relative;
        left: -2px;
      }

      .node-label {
        max-width: 90%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        border-radius: 6px;
        padding: 2px 6px;
        margin-left: -6px;

        &.is-inherited-drop-target-catalog {
          color: var(--el-color-primary-dark-2);
        }
      }

      .node-handle {
        margin-left: auto;
      }
    }

    &.document-node {

      &.active>.el-tree-node__content,
      &:focus>.el-tree-node__content {
        background-color: var(--hover-color);

        >.custom-tree-node {
          font-weight: 800;
        }
      }
    }

    &.catalog-node:focus>.el-tree-node__content {
      background-color: transparent;
    }

    .el-tree-node__content {
      padding: 14px 0;
      height: 32px;

      .el-tree-node__expand-icon {
        display: none;
      }

      &:hover {
        background-color: var(--hover-color) !important;
      }
    }
  }
}

.tree-drag-indicator {
  position: absolute;
  height: 2px;
  border-radius: 999px;
  background-color: var(--el-color-primary);
  box-shadow: 0 0 0 1px rgba(64, 158, 255, 0.22);
  pointer-events: none;
  z-index: 10;
  transform: translateY(-50%);

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background-color: var(--el-color-primary);
    transform: translate(-25%, -50%);
  }
}

:deep(.el-tooltip__trigger:focus-visible) {
  outline: unset;
}

.aside-header {
  display: flex;
  padding: 12px;
  justify-content: space-between;
  height: 48px;

  .left,
  .right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .left {
    font-weight: 400;
    font-size: 16px;
    color: #141414;
  }

  .right {
    .el-icon {
      cursor: var(--cursor-pointer);
    }
  }
}

.el-dropdown-link {
  cursor: pointer;
  border: node !important;
  /* color: #409eff; */
}

.document {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;

  .header {
    display: flex;
    align-items: center;
    gap: 16px;
    height: 48px;
    padding-left: 16px;
    background-color: var(--bg-color-page);

    .header-left {
      flex: none;
      min-width: 0;
      font-size: 14px;
      font-weight: 500;
    }

    .header-center {
      flex: 1;
      min-width: 0;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .header-right {
      flex: none;
      display: flex;
      align-items: center;
      height: 40px;
      padding-left: 16px;
      padding-right: 10px;
      background-color: var(--bg-color-page);

      .icon-wrap {
        padding: 5px 10px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        cursor: var(--cursor-pointer);

        &.active,
        &:hover,
        &.is-setting {
          background-color: var(--bg-color-overlay);

          span,
          i {
            color: var(--color-primary);
          }
        }

        span {
          margin-left: 4px;
          font-size: 14px;
          line-height: 20px;
          font-weight: 400;
        }
      }

      .division {
        border-left: 1px solid var(--border-color-light);
        margin: 0 5px;
        height: 20px;
      }
    }
  }

  .editor-upload-indicator {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    max-width: min(100%, 420px);
    padding: 6px 14px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.96);
    border: 1px solid var(--el-border-color-light);
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
    color: var(--el-text-color-primary);
    font-size: 13px;
    line-height: 20px;
    pointer-events: none;
  }

  .editor-upload-indicator__text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .editor-upload-indicator__spinner {
    width: 14px;
    height: 14px;
    flex: none;
    border-radius: 50%;
    border: 2px solid rgba(64, 158, 255, 0.2);
    border-top-color: var(--el-color-primary);
    animation: document-upload-spin 0.8s linear infinite;
  }

  .editor-content {
    border: 2px solid #f5f6f7;
    height: calc(100% - 40px);

    .form-container {
      height: 100%;
      display: flex;
      flex-direction: column;
      width: 100%;
      &.isSetting {
        width: calc(100% - 300px);
      }

      // padding-left: 16px;

      .form-status {
        background-color: var(--bg-color-page);
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        height: 72px;
        padding: 8px 24px;
        margin: 16px 16px 0 16px;
        border-radius: 4px;

        .status-item {
          width: 33%;
          height: 16px;
          display: flex;
          align-items: center;
          border-radius: 4px;
          margin: 8px 0;

          span {
            display: inline-block;
            font-size: 12px;
          }

          .item-label {
            width: 76px;
          }

          .item-value {
            flex: 1;
          }
        }
      }

      .form-wrap-display {
        display: flex;
        height: 100%;
        min-height: 0;

        .document-content {
          flex: 1;
          min-width: 0;
          /* 防止flex项目溢出 */
          overflow: auto;
          background-color: var(--bg-color-page);

          .title {
            padding: 30px 70px 0px 70px;
            font-size: 36px;
            font-weight: 700;
          }

          .content {
            padding: 20px 70px 90px 70px;
            font-size: 16px;
          }
        }
      }

      .form-wrap-edit {
        display: flex;
        height: 100%;
        min-height: 0px;
        font-size: 16px;

        .content {
          display: flex;
          flex-direction: column;
          flex: 1;
          height: 100%;
          background-color: var(--bg-color-page);
          min-width: 0;
          /* 防止flex项目溢出 */

          .toolbar {
            flex: none;
            border-top: 1px solid var(--el-border-color);
            border-bottom: 1px solid var(--el-border-color);
          }

          .editor-wrap {
            height: 100%;
            flex: auto;
            min-height: 0px;
            overflow: auto;

            .title {
              padding: 30px 70px 0px 70px;
              font-size: 36px;
              font-weight: 700;

              :deep(.el-input__wrapper) {
                box-shadow: none;
                padding: 0px;
              }

              :deep(.el-input__inner) {
                height: unset;
                line-height: unset;
                font-weight: 700;
              }
            }

            .editor {
              height: unset !important;
              padding: 20px 70px 90px 70px;
              cursor: text;

              :deep(.w-e-modal) {
                right: 0 !important;
              }
            }

            .editor-box {
              height: fit-content;
              width: 100%;
              position: relative;
            }

            .paste-popup {
              position: absolute;
              padding: 4px;
              line-height: 32px;
              border: 1px solid #a1a1a1;
              border-radius: 4px;
              cursor: pointer;
              background-color: #ffffff;
              display: flex;
              flex-direction: column;
              transform: translateX(10px) translateY(20px);

              .el-button {
                margin: 0;
                height: 32px;
                border-radius: 4px;

                &:hover {
                  background-color: #f1f1f1;
                  color: #000000;
                }
              }
            }
          }
        }
      }

      .footer {
        text-align: right;
        background-color: var(--bg-color-page);
        padding: 10px 24px;
        border-top: 1px solid var(--border-color);

        .el-button {
          margin-right: 8px;
          border-radius: 4px;
        }
      }
    }

    .document-setting {
      background-color: var(--bg-color-page);
      width: 300px;
      height: calc(100% - 1px);
      margin-left: 2px;
      font-size: 14px;
      font-weight: 400;
      overflow: auto;

      .setting-content {
        min-height: 100px;
      }

      .setting-footer {
        margin-left: 20px;

        :deep(.el-button) {
          border-radius: 4px;
        }
      }
    }
  }


}

.document-empty {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background-color: #fff;
  border-left: 2px solid #f5f6f7;
  box-sizing: border-box;

  &__icon {
    color: #c0c4cc;
    font-size: clamp(52px, 4vw, 72px);
  }

  &__text {
    font-size: 14px;
    line-height: 22px;
    color: #909399;
  }
}

:deep(.w-e-text-container) {
  h1 {
    font-size: 2em;
  }

  h2 {
    font-size: 1.5em;
  }

  h3 {
    font-size: 1.17em;
  }

  h4 {
    font-size: 1em;
  }

  h5 {
    font-size: 0.83em;
  }

  h6 {
    font-size: 0.67em;
  }

  .w-e-scroll {
    [data-slate-editor] {
      padding: 0px;
    }
  }
}

@keyframes document-upload-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
