<template>
  <el-container
    ref="formDesignerRef"
    class="form-designer"
    :class="{
      'is-blueprint-applying-readonly': props.blueprintApplyingReadonly,
      'has-pinned-panel': isFormCatalogPinned || isFormPropertyPinned,
      'is-pointer-dragging': pointerDrag?.moved,
    }"
  >
    <div v-if="props.blueprintApplyingReadonly" class="form-designer-readonly-tip">{{ $t('formDesigner.generatingFromBlueprintLockedTip') }}</div>
    <div
      v-if="props.fieldCatalogVisible"
      ref="fieldCatalogPanelRef"
      class="form-designer-floating-panel field-catalog-panel"
      :class="{ 'is-pinned': isFormCatalogPinned }"
      :style="fieldCatalogPanelStyle"
    >
      <div class="form-designer-floating-panel__header" :class="{ 'is-draggable': !isFormCatalogPinned }" @mousedown.stop="handleFieldCatalogDragStart">
        <span class="form-designer-floating-panel__title">{{ $t('FormDesigner.fieldCatalogTitle') }}</span>
        <button type="button" class="form-designer-floating-panel__pin" @click.stop="toggleFormCatalogPinned">
          <el-icon v-if="isFormCatalogPinned"><i-ven-icon-no-nail /></el-icon>
          <el-icon v-else><i-ven-icon-nail /></el-icon>
        </button>
        <button
          type="button"
          class="form-designer-floating-panel__close"
          :title="$t('formDesigner.close')"
          @click.stop="emit('update:field-catalog-visible', false)"
        >
          <el-icon :size="16"><i-ep-close /></el-icon>
        </button>
      </div>
      <div class="form-designer-floating-panel__body">
        <form-designer-left
          floating
          width="100%"
          :show-recycle-button="false"
          @addWidget="handleAddWidget"
          @openRecycle="handleOpenRecycleBinDrawer"
        />
      </div>
    </div>
    <el-main class="designer" @click.stop.prevent="handleDesignerBackgroundClick">
      <form-designer-main style="outline: none;" :tabindex="props.blueprintApplyingReadonly ? -1 : 0" @addWidget="handleAddWidget" @moveWidget="moveWidget" @removeWidget="handleRemoveWidget" ref="formDesignerMainRef" v-if="formWidget" />
    </el-main>
    <div
      v-show="props.propertyPanelVisible"
      ref="propertyPanelRef"
      class="form-designer-floating-panel property-panel"
      :class="{ 'is-pinned': isFormPropertyPinned }"
      :style="propertyPanelStyle"
    >
      <div class="form-designer-floating-panel__header form-designer-floating-panel__header--property" :class="{ 'is-draggable': !isFormPropertyPinned }" @mousedown.stop="handlePropertyPanelDragStart">
        <bread-crumbs class="form-designer-floating-panel__breadcrumbs" />
        <button type="button" class="form-designer-floating-panel__pin" @click.stop="toggleFormPropertyPinned">
          <el-icon v-if="isFormPropertyPinned"><i-ven-icon-no-nail /></el-icon>
          <el-icon v-else><i-ven-icon-nail /></el-icon>
        </button>
        <button
          type="button"
          class="form-designer-floating-panel__close"
          :title="$t('formDesigner.close')"
          @click.stop="emit('update:property-panel-visible', false)"
        >
          <el-icon :size="16"><i-ep-close /></el-icon>
        </button>
      </div>
      <div class="form-designer-floating-panel__body form-designer-floating-panel__body--property">
        <form-designer-right floating width="100%" :show-breadcrumbs="false" />
      </div>
    </div>
    <el-drawer class="field-recycle-bin-drawer" :class="{ 'is-blueprint-applying-readonly': props.blueprintApplyingReadonly }" v-model="recycleBinVisible" direction="btt" :title="$t('FormDesigner.fieldRecycleBin')">
      <template #default>
        <div class="field-recycle-bin-wrapper">
          <div class="clear-field-recycle-header">
            <div class="batch-operater-field-recycle-btns">
              <el-button class="clear-field-recycle-btn" text v-if="recycleFieldSelection.length > 0" @click="handleBatchRestoreField">
                <el-icon :size="16"><i-workbench-revoke /></el-icon>
                {{ $t('FormDesigner.restore') }}
              </el-button>
              <el-button class="clear-field-recycle-btn" text v-if="recycleFieldSelection.length > 0" @click="handleBeforeBatchDeleteField">
                <el-icon :size="16"><i-workbench-delete /></el-icon>
                {{ $t('FormDesigner.delete') }}
              </el-button>
            </div>
            <el-button class="clear-field-recycle-btn" text :disabled="recycleBinData.length === 0" @click="handleBeforeClearRecycleBin">
              <el-icon :size="16"><i-workbench-clear /></el-icon>
              {{ $t('FormDesigner.clear') }}
            </el-button>
          </div>
          <el-table class="field-recycle-bin-table" border :data="currentRecycleData" @selection-change="handleChangeSelectRecycleField">
            <template #default>
              <el-table-column type="selection" width="55" />
              <el-table-column prop="fieldName" :label="$t('FormDesigner.fieldName')"></el-table-column>
              <el-table-column prop="deleteOperator" :label="$t('FormDesigner.deleteOperator')"></el-table-column>
              <el-table-column prop="deleteTime" :label="$t('FormDesigner.deleteTime')"></el-table-column>
              <el-table-column prop="operation" :label="$t('FormDesigner.operation')">
                <template #default="scope">
                  <div class="operation-btn" v-if="recycleFieldSelection.length === 0">
                    <el-button type="primary" link @click="handleRestoreSingleField(scope.row)">{{ $t('FormDesigner.restore') }}</el-button>
                    <div class="divider"></div>
                    <el-button type="danger" link @click="handleBeforeRealDeleteSingleField(scope.row)">{{ $t('FormDesigner.delete') }}</el-button>
                  </div>
                </template>
              </el-table-column>
            </template>
            <template #empty>
              <div>
                {{ $t('FormDesigner.noData') }}
              </div>
            </template>
          </el-table>
          <el-config-provider :locale="elementPlusLocale">
            <el-pagination class="page-container"
              :page-size="recyclePageSize"
              :page-sizes="[10, 20, 30, 40, 50, 100]"
              layout="sizes, total, prev, pager, next"
              :total="recycleTotalCount"
              :current-page="recycleCurrentPage"
              @size-change="recycleSizeChange"
              @current-change="recyclePageChange"
            />
          </el-config-provider>
        </div>
      </template>
    </el-drawer>
    <table-delete-data-dialog 
      v-if="deleteTipDialogVisible"
      v-model="deleteTipDialogVisible"
      :isNoneSummary="true"
      :title="deleteDialogTips.title"
      :deleteTip="deleteDialogTips.deleteTip"
      :deleteWarningText="deleteDialogTips.deleteWarningText"
      @deleteTableData="handleDeleteData"
    />
    <recycle-restore-dialog 
      v-if="restoreTipDialogVisible"
      v-model="restoreTipDialogVisible"
      :title="restoreDialogTips.title"
      :restoreTip="restoreDialogTips.restoreTip"
      :restoreWarningText="restoreDialogTips.restoreWarningText"
      @confirm="handleRestoreData"
    />
  </el-container>
</template>

<script lang='ts' setup>
import { unique } from '@common/utils/unique';
import { usePassportStore } from '@renderer/stores/passport';
import { ProjectContext, isCallableVisible, isOption, isOptionCluster, isOptionSubgroup } from '@renderer/b2/types';
import { Board } from '@renderer/b2/controllers/board';
import { Element } from '@renderer/b2/controllers/element';
import { resolveWidget } from '@renderer/b2/utils/widget.util';
import { Widget } from '@renderer/b2/controllers/widget';
import { FormElement, AbstractForm } from '@renderer/b2/controllers/form';
import { Soul } from '@common/types/project';
import { computed, provide, Ref, ref, watch, nextTick, inject, customRef, ShallowRef, shallowRef, toRef, unref } from 'vue';
import { provideDraggableIndex, provideFormWidget, provideRenderWidgets, provideIsExistContainer, useFormData, useFormTable, provideFormWidgetRows, provideIsDrag, providePointerDrag, providePointerDragClickSuppressed } from './hooks';
import type { FormPointerDragSession } from './hooks';
import { DeletedWidgetSoul, Field, FormOptions, OptionTableUID, Table, TableColumn, TableUID, WidgetSoul } from '@common/types/project';
import { deepClone, equals, isEmpty } from '@common/utils/object';
import { loadWidget } from '@renderer/b2/utils/widget.util';
import { ACTIVE_ELEMENT, PROJECT_ID, REPORT_ID, SELECTED_WIDGETS, NOCODE, ORGANIZE_UTIL, HANDLE_DELETE_TABLE, HANDLE_SYNC_FORM_TABLE, HAS_WIDGET_MOUNTED, HOVER_WIDGET, ACTIVE_WIDGET, VISIBLE, DROP_SUCCESS, CLEAN_TEMPORARY_WIDGET, HANDLE_INTO_FIELD_RECYCLE_BIN_KEY, OPEN_FORM_DESIGNER_PROPERTY_PANEL, FORM_DESIGNER_BLUEPRINT_APPLYING_READONLY, FORM_DESIGNER_OPTION_CHANGED, FORM_DESIGNER_ACTIVE_ISSUE_HIGHLIGHT } from '@renderer/types';
import { getUUIDSystemField, isBuiltinField, SystemField } from '@common/utils';
import { getFormulaStr } from '@common/utils/formula';
import { buildTree, formDataApi } from '@renderer/views/nocode/utils';
import { MULTIPLETABS, SUBFORM } from './utils';
import { ElMessage, ElMessageBox } from 'element-plus';
import { BaseWidget } from '@renderer/b2/controllers/widget';
import { findWidgetSoulByUID } from '@renderer/utils';
import i18next from 'i18next';
import dayjs from 'dayjs';
import { FormWidgetType } from '@common/types/nocode';
import { useEventListener, useResizeObserver } from '@vueuse/core';
import { clampFloatingPanelPosition, DEFAULT_FIELD_CATALOG_POSITION, DEFAULT_FIELD_CATALOG_WIDTH, DEFAULT_FLOATING_PANEL_PADDING, FORM_PROPERTY_PANEL_WIDTH, resolveFieldCatalogCollisionInsets, resolveFieldCatalogDragPosition } from '../formDesignerFloatingPanels';
import { getBoardConnectionsByNocodeBody } from '@common/utils/connection';
import { AggregateRuntimeSource, buildBoardConnectionsWithAggregateTables } from '@renderer/utils/aggregateTable';
import { normalizeFormulaText } from '@common/utils/formula';
import {
  buildAiAvailableWidgetTypes,
  resolveAiAvailableWidgetType,
} from './aiAvailableWidgetTypes';
import {
  buildSelectedFieldSet,
  buildSelectedTableSet,
  collectFormDesignValidationIssues,
  FormDesignValidationIssue,
  resolveFormDesignValidationIssueHighlightTarget,
  FormDesignValidationWidgetSnapshot,
} from './designValidation';
import {
  buildDefaultFormulaAiContext,
  buildDefaultFormulaFieldList,
  buildDefaultFormulaFunctionList,
} from '../../../components/global/table/components/formula/aiContext';
import { isNocodeFormData, buildFormulaTableUID } from '@common/utils/connection';
import { linkWidgetTypeMap } from '@common/utils/formula';
import { elementPlusLocale } from '@renderer/utils/elementPlusLocale';
import { editorPanelLayouts, resolveEditorPanelPosition, setEditorPanelPinned, updateEditorPanelFloatingPosition } from '../editorPanelPinning';

type FormulaLinkageTable = Table & Partial<{
  linkedForm: string;
  sourceTableUID: string;
  sourceConnectionUID: string;
  name: string;
  formulaAlias: string;
  connectionUID: string;
}>

const formData = useFormData();
const table = useFormTable();
const organizeUtil = inject(ORGANIZE_UTIL);
const nocode = inject(NOCODE);
const handleDeleteTable = inject(HANDLE_DELETE_TABLE);
const handleSyncFormTable = inject(HANDLE_SYNC_FORM_TABLE);

const formChanged = ref(false);
const formChangeRevision = ref(0);
const markFormChanged = () => {
  formChanged.value = true;
  formChangeRevision.value += 1;
};
const resetChangeTracking = () => {
  formChanged.value = false;
  formChangeRevision.value = 0;
};
provide(FORM_DESIGNER_OPTION_CHANGED, () => {
  markFormChanged();
  refreshDisplayedDesignValidationErrors();
});
const formDesignerMainRef = ref();
const dropSuccess = ref(false);
provide(DROP_SUCCESS, dropSuccess);
const passportState = usePassportStore();
passportState.syncSubAccounts()

const ensurePagePermissionContextReady = async () => {
  if (!organizeUtil?.departments?.length) {
    await organizeUtil?.getDepartments?.();
  }
};

// 临时存储待删除的 widget，在保存时统一处理
const pendingDeletedWidgets = ref<Record<TableUID, DeletedWidgetSoul[]>>({});

const cleanTemporaryWidget = ref({
  form: false,
  subForm: false,
})
provide(CLEAN_TEMPORARY_WIDGET, cleanTemporaryWidget)
const emit = defineEmits<{
  (event: "save", value: boolean): void;
  (event: "update:field-catalog-visible", visible: boolean): void;
  (event: "update:property-panel-visible", visible: boolean): void;
}>();

const props = withDefaults(defineProps<{
  fieldCatalogVisible?: boolean
  propertyPanelVisible?: boolean
  blueprintApplyingReadonly?: boolean
}>(), {
  fieldCatalogVisible: true,
  propertyPanelVisible: true,
  blueprintApplyingReadonly: false,
});

const formDesignerRef = ref<HTMLElement | null>(null);
const fieldCatalogPanelRef = ref<HTMLElement | null>(null);
const propertyPanelRef = ref<HTMLElement | null>(null);
const designValidationIssueHighlight = ref<null | {
  widgetId: string
  optionPath?: string[]
  groupKey?: string
  token: number
}>(null);
let designValidationIssueHighlightTimer: ReturnType<typeof setTimeout> | null = null;
const fieldCatalogPosition = ref({ ...DEFAULT_FIELD_CATALOG_POSITION });
const fieldCatalogDragState = ref<null | {
  startPointer: { x: number; y: number }
  startPosition: { x: number; y: number }
}>(null);
const propertyPanelPosition = ref({ x: 0, y: 0 });
const propertyPanelDragState = ref<null | {
  startPointer: { x: number; y: number }
  startPosition: { x: number; y: number }
}>(null);
const propertyPanelHasManualPosition = ref(false);
const isFormCatalogPinned = computed(() => editorPanelLayouts.formCatalog.pinned);
const isFormPropertyPinned = computed(() => editorPanelLayouts.formProperty.pinned);
const formDesignerHostRef = computed<HTMLElement | null>(() => {
  const candidate = formDesignerRef.value as any;
  return candidate?.$el ?? candidate ?? null;
});
const fieldCatalogPanelStyle = computed(() => ({
  height: isFormCatalogPinned.value ? '100%' : undefined,
  transform: `translate(${fieldCatalogPosition.value.x}px, ${fieldCatalogPosition.value.y}px)`,
}));
const propertyPanelStyle = computed(() => ({
  height: isFormPropertyPinned.value ? '100%' : undefined,
  width: `${FORM_PROPERTY_PANEL_WIDTH}px`,
  transform: `translate(${propertyPanelPosition.value.x}px, ${propertyPanelPosition.value.y}px)`,
}));
const fieldCatalogPanelPadding = computed(() => ({
  top: 0,
  left: 0,
  right: DEFAULT_FLOATING_PANEL_PADDING,
  bottom: DEFAULT_FLOATING_PANEL_PADDING,
}));
const fieldCatalogCollisionInsets = computed(() => (
  resolveFieldCatalogCollisionInsets(
    props.propertyPanelVisible,
    fieldCatalogPosition.value,
    propertyPanelPosition.value,
    formDesignerHostRef.value?.getBoundingClientRect?.().width,
    fieldCatalogPanelRef.value?.getBoundingClientRect?.().width || DEFAULT_FIELD_CATALOG_WIDTH,
  )
));

const resolveFieldCatalogDragInsets = (nextPosition: { x: number; y: number }) => {
  return resolveFieldCatalogCollisionInsets(
    props.propertyPanelVisible,
    nextPosition,
    propertyPanelPosition.value,
    formDesignerHostRef.value?.getBoundingClientRect?.().width,
    fieldCatalogPanelRef.value?.getBoundingClientRect?.().width || DEFAULT_FIELD_CATALOG_WIDTH,
  );
}

// 数据

const formWidget = ref<AbstractForm>();

const getRuntimeSources = (): AggregateRuntimeSource[] => {
  const body = nocode.value?.body;
  const currentNocodeId = nocode.value?.meta?.id;
  const sources: AggregateRuntimeSource[] = [];

  if (body?.formData?.uid) {
    sources.push({
      uid: body.formData.uid,
      nocodeId: currentNocodeId,
      tables: body.formData.tables || [],
      aggregateTables: body.formData.aggregateTables || [],
    });
  }
  (body?.otherDataSources || []).forEach(source => {
    if (!source?.uid) return;
    sources.push({
      uid: source.uid,
      nocodeId: source.nocodeId,
      tables: source.tables || [],
      aggregateTables: (source as any).aggregateTables || [],
    });
  });
  return sources;
}
const boardConnections = computed(() => {
  // Option changes already advance this revision; make the derived connection cache follow it.
  formChangeRevision.value;
  return buildBoardConnectionsWithAggregateTables(getBoardConnectionsByNocodeBody(nocode.value?.body, {
    nocodeId: nocode.value?.meta?.id,
    name: nocode.value?.meta?.name,
  }), getRuntimeSources());
});
const renderWidgets = ref<WidgetSoul[]>();
const draggableIndex = ref(-1);
const selectedWidgets: Ref<BaseWidget[]> = ref([]);
const activeWidget = computed(() => {
  const element = selectedWidgets.value[selectedWidgets.value.length-1];
  window["temp"] = element;
  return element;
});
const activeElement = computed(()=>{
  return activeWidget.value ?? formWidget.value;
});
const isDrag = ref(false);
const pointerDrag = ref<FormPointerDragSession | null>(null);
const pointerDragClickSuppressed = ref(false);

const scrollTo = () => {
  formDesignerMainRef.value.scrollTo();
}

const isWidgetInDesignerView = (widget: FormElement) => {
  const widgetDom = widget.dom as HTMLElement | null | undefined;
  const designerVm = formDesignerMainRef.value as { $el?: HTMLElement | null } | null;
  const designerDom = designerVm?.$el as HTMLElement | null | undefined;
  const scrollWrapDom = designerDom?.querySelector?.('.el-scrollbar__wrap') as HTMLElement | null | undefined;
  const viewportDom = scrollWrapDom || designerDom;

  if (!widgetDom || !viewportDom) {
    return false;
  }

  const widgetRect = widgetDom.getBoundingClientRect();
  const viewportRect = viewportDom.getBoundingClientRect();

  return widgetRect.bottom > viewportRect.top
    && widgetRect.top < viewportRect.bottom
    && widgetRect.right > viewportRect.left
    && widgetRect.left < viewportRect.right;
}

const getFieldCatalogPanelMetrics = () => {
  const containerRect = formDesignerHostRef.value?.getBoundingClientRect?.();
  const panelRect = fieldCatalogPanelRef.value?.getBoundingClientRect();
  if (!containerRect || !panelRect) {
    return null;
  }
  return {
    bounds: {
      width: containerRect.width,
      height: containerRect.height,
    },
    panelSize: {
      width: panelRect.width,
      height: panelRect.height,
    },
  };
}

const getPropertyPanelMetrics = () => {
  const containerRect = formDesignerHostRef.value?.getBoundingClientRect?.();
  const panelRect = propertyPanelRef.value?.getBoundingClientRect();
  if (!containerRect || !panelRect) {
    return null;
  }
  return {
    bounds: {
      width: containerRect.width,
      height: containerRect.height,
    },
    panelSize: {
      width: panelRect.width,
      height: panelRect.height,
    },
  };
}

const syncFieldCatalogPanelPosition = (nextPosition = fieldCatalogPosition.value) => {
  const metrics = getFieldCatalogPanelMetrics();
  if (!metrics) {
    return;
  }
  if (isFormCatalogPinned.value) {
    fieldCatalogPosition.value = resolveEditorPanelPosition(
      'formCatalog',
      metrics.panelSize,
      metrics.bounds,
      DEFAULT_FIELD_CATALOG_POSITION,
    );
    return;
  }
  fieldCatalogPosition.value = clampFloatingPanelPosition(
    nextPosition,
    metrics.panelSize,
    metrics.bounds,
    fieldCatalogPanelPadding.value,
    fieldCatalogCollisionInsets.value,
  );
  updateEditorPanelFloatingPosition('formCatalog', fieldCatalogPosition.value);
}

const syncPropertyPanelPosition = (nextPosition = propertyPanelPosition.value) => {
  const metrics = getPropertyPanelMetrics();
  if (!metrics) {
    return;
  }
  if (isFormPropertyPinned.value) {
    propertyPanelPosition.value = resolveEditorPanelPosition(
      'formProperty',
      metrics.panelSize,
      metrics.bounds,
      { x: metrics.bounds.width - metrics.panelSize.width, y: 0 },
    );
    return;
  }
  propertyPanelPosition.value = clampFloatingPanelPosition(
    nextPosition,
    metrics.panelSize,
    metrics.bounds,
    {
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
  );
  updateEditorPanelFloatingPosition('formProperty', propertyPanelPosition.value);
}

const resetPropertyPanelPosition = () => {
  const metrics = getPropertyPanelMetrics();
  if (!metrics) {
    return;
  }
  propertyPanelPosition.value = clampFloatingPanelPosition(
    {
      x: metrics.bounds.width - metrics.panelSize.width,
      y: 0,
    },
    metrics.panelSize,
    metrics.bounds,
    {
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
  );
}

const clearDesignValidationIssueHighlight = () => {
  designValidationIssueHighlight.value = null;
  if (!designValidationIssueHighlightTimer) {
    return;
  }
  clearTimeout(designValidationIssueHighlightTimer);
  designValidationIssueHighlightTimer = null;
}

const applyDesignValidationIssueHighlight = async (
  widget: FormElement,
  issue: FormDesignValidationIssue,
  highlight?: { optionPath?: string[] },
) => {
  const optionPath = Array.isArray(highlight?.optionPath) && highlight.optionPath.length > 0
    ? [...highlight.optionPath]
    : resolveFormDesignValidationIssueHighlightTarget(issue).optionPath
  const groupKey = optionPath?.length
    ? widget.getOptionGroup?.(optionPath)
    : undefined

  if (!optionPath?.length && !groupKey) {
    clearDesignValidationIssueHighlight()
    return
  }

  designValidationIssueHighlight.value = {
    widgetId: widget.uid,
    optionPath,
    groupKey: String(groupKey || '').trim() || undefined,
    token: Date.now(),
  }
  if (designValidationIssueHighlightTimer) {
    clearTimeout(designValidationIssueHighlightTimer)
  }
  designValidationIssueHighlightTimer = setTimeout(() => {
    designValidationIssueHighlight.value = null
    designValidationIssueHighlightTimer = null
  }, 3600)
  await nextTick()
}
const activateDesignValidationIssueHighlight = async (
  widget: FormElement,
  issue: FormDesignValidationIssue,
  highlight?: { optionPath?: string[] },
) => {
  emit('update:property-panel-visible', true);
  await nextTick();
  syncPropertyPanelPosition();
  await applyDesignValidationIssueHighlight(widget, issue, highlight);
}
provide(FORM_DESIGNER_ACTIVE_ISSUE_HIGHLIGHT, designValidationIssueHighlight);

const handleFieldCatalogDragStart = (event: MouseEvent) => {
  if (props.blueprintApplyingReadonly || isFormCatalogPinned.value) {
    return;
  }
  if (event.button !== 0) {
    return;
  }
  fieldCatalogDragState.value = {
    startPointer: {
      x: event.clientX,
      y: event.clientY,
    },
    startPosition: {
      ...fieldCatalogPosition.value,
    },
  };
  event.preventDefault();
}

const handlePropertyPanelDragStart = (event: MouseEvent) => {
  if (props.blueprintApplyingReadonly || isFormPropertyPinned.value) {
    return;
  }
  if (event.button !== 0) {
    return;
  }
  const target = event.target as HTMLElement | null;
  if (
    target?.closest('.sub-region .level-item span')
    || target?.closest('.bread-crumbs__ellipsis')
    || target?.closest('.el-dropdown-menu')
  ) {
    return;
  }
  propertyPanelHasManualPosition.value = true;
  propertyPanelDragState.value = {
    startPointer: {
      x: event.clientX,
      y: event.clientY,
    },
    startPosition: {
      ...propertyPanelPosition.value,
    },
  };
  event.preventDefault();
}

const toggleFormCatalogPinned = () => {
  const pinned = !isFormCatalogPinned.value;
  setEditorPanelPinned('formCatalog', pinned, fieldCatalogPosition.value);
  nextTick(() => {
    const metrics = getFieldCatalogPanelMetrics();
    if (!metrics) {
      return;
    }
    fieldCatalogPosition.value = resolveEditorPanelPosition(
      'formCatalog',
      metrics.panelSize,
      metrics.bounds,
      DEFAULT_FIELD_CATALOG_POSITION,
    );
  });
}

const toggleFormPropertyPinned = () => {
  const pinned = !isFormPropertyPinned.value;
  setEditorPanelPinned('formProperty', pinned, propertyPanelPosition.value);
  nextTick(() => {
    const metrics = getPropertyPanelMetrics();
    if (!metrics) {
      return;
    }
    propertyPanelPosition.value = resolveEditorPanelPosition(
      'formProperty',
      metrics.panelSize,
      metrics.bounds,
      { x: metrics.bounds.width - metrics.panelSize.width, y: 0 },
    );
  });
}

const handleDesignerBackgroundClick = () => {
  if (props.blueprintApplyingReadonly) {
    return;
  }
  clearDesignValidationIssueHighlight();
  selectedWidgets.value = [formWidget.value];
}

const handleAddWidget = async (widgetSoul: WidgetSoul, type: 'drag' | 'click' = 'click') => {
  const soul = deepClone(widgetSoul);
  // 如果选中的是选项卡组件, 则添加到选项卡组件中
  if(activeWidget.value?.type == 'widget.form.multipleTabs' && type === 'click') {
    const widget = await (activeWidget.value as any).tabPanel.addWidget(soul, (activeWidget.value as any).tabPanel.children);
    return widget
  }

  if (type === 'click') {
    if (!activeWidget.value || activeWidget.value.uid === formWidget.value.uid) {
      draggableIndex.value = renderWidgets.value?.length || 0;
    } else {
      draggableIndex.value = renderWidgets.value.findIndex((item) => item.uid === activeWidget.value.uid) + 1;
    }
  } else if (type === 'drag') {
    
  }
  const widget = await addWidget(soul, draggableIndex.value);
  soul.uid = widget.uid;
  scrollTo();
  return widget;
}

useEventListener(document, 'mousemove', (event: MouseEvent) => {
  if (!fieldCatalogDragState.value) {
    if (!propertyPanelDragState.value) {
      return;
    }
  }
  if (fieldCatalogDragState.value) {
    const metrics = getFieldCatalogPanelMetrics();
    if (!metrics) {
      return;
    }
    const nextPosition = {
      x: fieldCatalogDragState.value.startPosition.x + (event.clientX - fieldCatalogDragState.value.startPointer.x),
      y: fieldCatalogDragState.value.startPosition.y + (event.clientY - fieldCatalogDragState.value.startPointer.y),
    };
    fieldCatalogPosition.value = resolveFieldCatalogDragPosition({
      startPointer: fieldCatalogDragState.value.startPointer,
      currentPointer: {
        x: event.clientX,
        y: event.clientY,
      },
      startPosition: fieldCatalogDragState.value.startPosition,
      panelSize: metrics.panelSize,
      bounds: metrics.bounds,
      padding: fieldCatalogPanelPadding.value,
      insets: resolveFieldCatalogDragInsets(nextPosition),
    });
    updateEditorPanelFloatingPosition('formCatalog', fieldCatalogPosition.value);
  }
  if (propertyPanelDragState.value) {
    const metrics = getPropertyPanelMetrics();
    if (!metrics) {
      return;
    }
    propertyPanelPosition.value = resolveFieldCatalogDragPosition({
      startPointer: propertyPanelDragState.value.startPointer,
      currentPointer: {
        x: event.clientX,
        y: event.clientY,
      },
      startPosition: propertyPanelDragState.value.startPosition,
      panelSize: metrics.panelSize,
      bounds: metrics.bounds,
      padding: {
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      },
    });
    updateEditorPanelFloatingPosition('formProperty', propertyPanelPosition.value);
  }
});

useEventListener(document, 'mouseup', () => {
  fieldCatalogDragState.value = null;
  propertyPanelDragState.value = null;
});

useResizeObserver(formDesignerHostRef, () => {
  syncFieldCatalogPanelPosition();
  if (!props.propertyPanelVisible) {
    return;
  }
  if (propertyPanelHasManualPosition.value || isFormPropertyPinned.value || editorPanelLayouts.formProperty.floatingPosition) {
    syncPropertyPanelPosition();
    return;
  }
  resetPropertyPanelPosition();
});

watch(() => props.fieldCatalogVisible, async (visible) => {
  if (!visible) {
    fieldCatalogDragState.value = null;
    return;
  }
  await nextTick();
  const metrics = getFieldCatalogPanelMetrics();
  if (metrics) {
    syncFieldCatalogPanelPosition(resolveEditorPanelPosition(
      'formCatalog',
      metrics.panelSize,
      metrics.bounds,
      DEFAULT_FIELD_CATALOG_POSITION,
    ));
  }
}, {
  immediate: true,
});

watch(() => props.propertyPanelVisible, async (visible) => {
  if (!visible) {
    propertyPanelDragState.value = null;
    propertyPanelHasManualPosition.value = false;
    return;
  }
  await nextTick();
  const metrics = getPropertyPanelMetrics();
  if (metrics) {
    syncPropertyPanelPosition(resolveEditorPanelPosition(
      'formProperty',
      metrics.panelSize,
      metrics.bounds,
      { x: metrics.bounds.width - metrics.panelSize.width, y: 0 },
    ));
  }
  if (!props.fieldCatalogVisible) {
    return;
  }
  syncFieldCatalogPanelPosition();
}, {
  immediate: true,
});

const initWidgetByFields = async () => {
  const widgetMapping = {
    string: "widget.form.textInput",
    number: "widget.form.numberInput",
  }
  for (const field of table.value?.fields || []) {
    const type = field.revisedType || field.type;
    if (isBuiltinField(field)) continue;
    const widget: Widget = await handleAddWidget({
      type: field.meta.extra.widgetType || widgetMapping[type],
      name: field.alias,
      uid: field.meta.uid,
    });
    if (widget.type === 'widget.form.subform') {
      const subTableId = field.meta.extra?.subTableUID?.[1];
      const subTable = formData.value.tables.find(item => item.uid === subTableId);
      if (!subTable) continue;
      subTable.fields.forEach((subField, subIndex) => {
        if (isBuiltinField(subField)) return;
        const subType = subField.revisedType || field.type;
        widget.container.addWidget({
          type: subField.meta.extra.widgetType || widgetMapping[subType],
          name: subField.alias,
          uid: subField.meta.uid,
        }, subIndex);
      });
    }
  }
}

const bindFields = ()=>{
  const fields = table.value.fields;
  for (const field of fields) {
    const subTableUID: OptionTableUID = field.meta?.extra?.subTableUID;
    if (subTableUID) {
      const subTable = formData.value.tables.find((item)=>item.uid === subTableUID[1]);
      if (!subTable) continue;
      field.subTableFields = subTable.fields;
    }
  }
  formWidget.value.bindFields(fields);
};

const init = async (soul: WidgetSoul, isFirstCreate: boolean) => {
  await ensurePagePermissionContextReady();
  let { TheWidget, component } = resolveWidget(soul.type);
  if (!TheWidget || !component) {
    const _widget = await loadWidget(soul.type);
    if (!_widget) {
      console.error("no widget or widget is corrupted", soul.type);
      // if (!this.owner.isReady() && !this._corruptedWidgets.includes(soul)) {
      //   this._corruptedWidgets.push(soul);
      // }
      // continue;
    } else {
      TheWidget = _widget.TheWidget;
      component = _widget.component;
    }
  }
  if (!TheWidget || !component) {
    throw new Error(i18next.t('FormDesigner.widgetLoadFailed'));
  }
  const board = new Board({ type: "board" }, {
    typography: "page",
    get nocodeId() {
      return nocode.value?.meta?.id;
    },
    get pagePermissionContext() {
      return {
        nocodeBody: nocode.value?.body,
        departments: organizeUtil?.departments || [],
        account: passportState.account,
      };
    },
    getElementByUID(uid: string[]) {
      if(!uid?.length) return undefined;
      const [boardUID, widgetUID] = uid;
      if(!widgetUID) return undefined;
      return formWidget.value.getBoard().getWidgetByUID(widgetUID) as Element;
    },
    getBoards() {
      return [board]
    },
    getConnections() {
      return boardConnections.value;
    },
    getNocodeBodyData() {
      return {
        formData: nocode.value?.body?.formData,
        otherDataSources: nocode.value?.body?.otherDataSources || [],
      };
    },
    async saveFormData() {
      emit('save', true);
    }
  } as unknown as ProjectContext);
  board.status.isFormMode = true;
  board.status.isEditable = true;
  
  formWidget.value = new TheWidget(soul, board) as AbstractForm;
  formWidget.value.status.isMounted = true;
  selectedWidgets.value = [ formWidget.value ];

  const readyPromise = new Promise<void>((resolve) => {
    const stopHandle = watch(() => formWidget.value?.isReady(), async(value) => {
      if (!value) return;
      bindFields();
      board.updateHistory = (historyId: string = "", add = true) => {
        if (add) markFormChanged();
      }
      await nextTick();
      stopHandle();
      resolve();
    }, { immediate: true });
  });

  if (isFirstCreate) {
    await initWidgetByFields();
  }

  await readyPromise;

  const allTableUIDs = formData.value.tables.filter(tabeItem => !tabeItem.meta.extra?.primaryTable).map(item => item.uid)
  for (const key of allTableUIDs) {
    if (!isEmpty(formData.value.formOptions[key]?.deletedWidgets)) {
      pendingDeletedWidgets.value[key] = [...formData.value.formOptions[key].deletedWidgets];
    } else {
      pendingDeletedWidgets.value[key] = []
    }
  }
  
  formWidget.value.setTableUID([formData.value.uid, table.value.uid]);
}

const container = computed(() => {
  // 子表单和多标签组件删除时container是主表单的container
  if (activeWidget.value.container && activeWidget.value.type !== SUBFORM && activeWidget.value.type !== MULTIPLETABS) {
    return activeWidget.value.container;
  } else {
    return formWidget.value.container;
  }
})
const addWidget = async (soul: WidgetSoul, index: number) => {
  const widget = await container.value?.addWidget(soul, index);
  selectedWidgets.value = [widget as FormElement];
  markFormChanged();
  return widget;
}

const getChildrenWidgetSouls = (soul: WidgetSoul) => {
  const result: WidgetSoul[] = [];
  
  function traverse(widgetsArray: WidgetSoul[]) {
    for (const widget of widgetsArray) {
      result.push(widget); // 将当前widget加入结果
      if (widget.widgets && Array.isArray(widget.widgets)) {
        traverse(widget.widgets); // 递归处理子widgets
      }
    }
  }
  
  if (soul.widgets && Array.isArray(soul.widgets)) {
    traverse(soul.widgets);
  }
  
  return result;
}
const removeWidget = (uid: string) => {
  const widget = container.value.removeWidget(uid);
  if (activeWidget.value.uid === uid) {
    selectedWidgets.value = [ formWidget.value ];
  }
  markFormChanged();
  return widget;
}
const handleRemoveWidget = (uid: string) => {
  const widgetSoul = removeWidget(uid);
  // 处理删除的组件，临时存储到pendingDeletedWidgets中，保存后再放入回收站
  if (widgetSoul.type === FormWidgetType.MULTIPLE_TABS) {
    const allWidgets = getChildrenWidgetSouls(widgetSoul);
    const allDeleteWidgets = allWidgets.filter(item => item.type !== FormWidgetType.TAB_PANEL);
    for (const _deleteWidget of allDeleteWidgets) {
      handleIntoRecycleBin(_deleteWidget, table.value);
    }
  } else {
    handleIntoRecycleBin(widgetSoul, table.value);
  }
}

const isPersistedWidget = (widgetUID: string) => {
  const hasWidget = (widgets: WidgetSoul[] = []): boolean => widgets.some(widget => (
    widget.uid === widgetUID || hasWidget(widget.widgets)
  ));
  const hasPersistedColumn = formData.value.options.tables.some(currentTable => (
    currentTable.columns.some(column => column.uid === widgetUID)
  ));
  if (hasPersistedColumn) return true;

  return Object.values(formData.value.formOptions || {}).some(formOption => (
    hasWidget(formOption.widget ? [formOption.widget] : [])
  ));
}

// 字段进回收站的逻辑--需改成公用给子表单删除时用
const handleIntoRecycleBin = (widget: WidgetSoul, widgetTable: Table) => {
  const widgetSoul = widget as DeletedWidgetSoul;
  if (!widgetSoul.uid || !isPersistedWidget(widgetSoul.uid)) return;

  // 主表单删除的widget，放入回收站
  const deletedWidget = widgetSoul;
  // const deletedWidgetAlias = `${widgetSoul.options?.['title-text'] || widgetSoul.name}`;
  const cuurentTable = formData.value.tables.find(_table => _table.uid === widgetTable.uid);
  
  deletedWidget.recycleInfo = {
    operateTime: new Date().getTime(),
    operator: passportState.account.id,
    tableUID: cuurentTable.uid,
    tableMetaUID: cuurentTable.meta?.uid,
    fieldId: cuurentTable.fields.find(field => field.meta?.uid === widgetSoul.uid)?.uid,
    widgetUID: widgetSoul.uid
  };
  // 子表单子字段放入回收站
  if (widgetSoul.type === FormWidgetType.SUBFORM) {
    const mainTable = formData.value.tables.find(_table => _table.uid === widgetTable.uid);
    const subFormField = mainTable.fields.find(field => field.meta?.uid === widgetSoul.uid);
    const subTable = formData.value.tables.find(_table => _table.uid === subFormField.meta?.extra?.subTableUID?.[1]);
    
    // 子表单删除tableUID存自己的tableUID，恢复时使用原tableUID
    deletedWidget.recycleInfo.tableUID = subTable.uid;
    deletedWidget.recycleInfo.tableMetaUID = subTable.meta?.uid;
    for (const subWidgetSoul of widgetSoul.widgets) {
      const deletedSubWidget = subWidgetSoul as DeletedWidgetSoul;
      if (!deletedSubWidget.uid || !isPersistedWidget(deletedSubWidget.uid)) continue;

      if (!pendingDeletedWidgets.value[table.value.uid].find(item => item.uid === deletedSubWidget.uid)) {
        deletedSubWidget.recycleInfo = {
          operateTime: new Date().getTime(),
          operator: passportState.account.id,
          tableUID: subTable.uid,
          tableMetaUID: subTable.meta?.uid,
          fieldId: subTable.fields.find(field => field.meta?.uid === subWidgetSoul.uid)?.uid,
          widgetUID: subWidgetSoul.uid,
        };
        pendingDeletedWidgets.value[table.value.uid].push(deletedSubWidget);
      }
    }
    widgetSoul.widgets = []
  }

  pendingDeletedWidgets.value[table.value.uid].push(deletedWidget);
}

const moveWidget = (souls: WidgetSoul[], index: number) => {
  const sourceContainer = formWidget.value.container;
  let _souls = [];
  for (const soul of souls) {
    if (!sourceContainer.souls.some((sourceSoul) => sourceSoul.uid === soul.uid)) {
      continue;
    }
    const _soul = sourceContainer.removeWidget(soul.uid);
    if (_soul) {
      _souls.push(_soul);
    }
  }
  if(index > -1 && _souls.length > 0) {
    sourceContainer.insertByIndex(_souls, index);
  }
  markFormChanged();
}

watch(() => formWidget.value?.widgets?.map(item => item.uid), () => {
  renderWidgets.value = formWidget.value?.widgets?.map(widget => widget.getSoul()) || [];
});

const getAiWidgetById = (widgetId: string) => {
  const normalizedId = String(widgetId || '').trim();
  if (!normalizedId || !formWidget.value) return undefined;
  return formWidget.value.getBoard().getWidgetByUID(normalizedId) as Widget | undefined;
}

const AI_FORMULA_HISTORY_TABLE_UID_PREFIX = 'hist_';

const replaceAiFormulaFieldUID = (fields: Array<Record<string, any>> = []) => {
  fields.forEach((field) => {
    field.uid = field?.meta?.uid as `f_${string}`;
    if (Array.isArray(field?.subTableFields) && field.subTableFields.length) {
      replaceAiFormulaFieldUID(field.subTableFields);
    }
  });
}

const createAiFormulaFieldFromWidget = (widget: FormElement, createSubField = false) => {
  const field = {
    uid: widget.uid as `f_${string}`,
    alias: widget.title,
    type: widget.fieldType,
    meta: {
      name: widget.name,
      uid: widget.uid,
      extra: {
        widgetType: widget.getSoul?.()?.type,
      },
    },
  } as Field;

  if (widget.type === FormWidgetType.SUBFORM) {
    field.subTableFields = createSubField
      ? (widget.children || []).map((child) => createAiFormulaFieldFromWidget(child as FormElement, true))
      : [];
  }

  return field;
}

const buildAiFormulaCurrentRowTable = (activeFormWidget: AbstractForm) => {
  const currentConnectionUID = activeFormWidget.tableUID?.[0];
  const currentTableUID = activeFormWidget.tableUID?.[1];
  const connections = activeFormWidget.getBoard?.().getConnections?.()?.filter(connection => isNocodeFormData(connection)) || [];
  const tables = connections.find(connection => connection.uid === currentConnectionUID)?.tables || [];
  const currentTable = tables.find(item => item.uid === currentTableUID);
  if (!currentTable) return null;

  const targetTable = deepClone(currentTable);
  targetTable.alias = `${targetTable.alias}-${i18next.t('FormDefaultValueFormulaDialog.currentRow')}`;
  targetTable.fields = (activeFormWidget.children || []).map((child) => {
    return createAiFormulaFieldFromWidget(child as FormElement, true);
  });
  replaceAiFormulaFieldUID(targetTable.fields);
  return targetTable;
}

const buildAiFormulaLinkedTables = (activeFormWidget: AbstractForm): FormulaLinkageTable[] => {
  const connections = activeFormWidget.getBoard?.().getConnections?.()?.filter(connection => isNocodeFormData(connection)) || [];
  const widgets = activeFormWidget.container?.getChildWidgets?.(true) as FormElement[] || [];
  const linkedTables = [];

  widgets.forEach((widget) => {
    const key = linkWidgetTypeMap[widget.getSoul?.()?.type];
    if (!key) return;

    const linkTableUID = (widget as any)[key];
    const linkConnection = connections.find(connection => connection.uid === linkTableUID?.[0]);
    const sourceTable = linkConnection?.tables?.find(item => item.uid === linkTableUID?.[1]);
    if (!sourceTable) return;

    const linkedTable: FormulaLinkageTable = deepClone(sourceTable);
    linkedTable.uid = `t_${unique()}`;
    linkedTable.alias = `${widget.title}-${linkedTable.alias}`;
    linkedTable.linkedForm = `${activeFormWidget.tableUID[1]}.${widget.isInSubForm ? `${widget.parent.uid}.` : ''}${widget.uid}`;
    linkedTable.sourceTableUID = sourceTable.uid;
    linkedTable.sourceConnectionUID = linkConnection?.uid || activeFormWidget.tableUID?.[0];
    linkedTables.push(linkedTable);
  });

  return linkedTables;
}

const buildAiFormulaOtherTables = (activeFormWidget: AbstractForm): FormulaLinkageTable[] => {
  const currentConnectionUID = activeFormWidget.tableUID?.[0];
  const currentTableUID = activeFormWidget.tableUID?.[1];
  const dataSources = activeFormWidget.getBoard?.().getConnections?.()?.filter(connection => isNocodeFormData(connection)) || [];

  return dataSources.reduce((result, source) => {
    const tables = source.tables?.filter((tableItem) => {
      if (tableItem.meta?.extra?.primaryTable) return false;
      return !(source.uid === currentConnectionUID && tableItem.uid === currentTableUID);
    }) || [];

    tables.forEach((tableItem) => {
      const nextTable: FormulaLinkageTable = deepClone(tableItem);
      nextTable.uid = buildFormulaTableUID(source.uid, tableItem.uid, currentConnectionUID) as unknown as `t_${string}`;
      nextTable.name = source.uid === currentConnectionUID || !source.name
        ? nextTable.alias
        : `${source.name}-${nextTable.alias}`;
      nextTable.formulaAlias = nextTable.name;
      nextTable.connectionUID = source.uid;
      result.push(nextTable);
    });

    return result;
  }, []);
}

const buildAiDefaultFormulaTaskContext = () => {
  const activeFormWidget = formWidget.value as AbstractForm | null;
  if (!activeFormWidget) return null;

  const currentRowTable = buildAiFormulaCurrentRowTable(activeFormWidget);
  if (!currentRowTable) return null;

  const currentHistoryTable: FormulaLinkageTable = deepClone(currentRowTable);
  currentHistoryTable.uid = `${AI_FORMULA_HISTORY_TABLE_UID_PREFIX}${currentRowTable.uid}` as any;
  currentHistoryTable.formulaAlias = `${currentRowTable.alias}-${i18next.t('FormDefaultValueFormulaDialog.historyData')}`;
  const linkedTables = buildAiFormulaLinkedTables(activeFormWidget);
  const otherTables = buildAiFormulaOtherTables(activeFormWidget);

  const fieldList = buildDefaultFormulaFieldList({
    currentTables: [currentRowTable, currentHistoryTable],
    linkedTables,
    otherTables,
  });

  return buildDefaultFormulaAiContext({
    widgetId: '',
    widgetTitle: table.value?.alias || (activeFormWidget as unknown as FormElement).title || '',
    currentFormula: '',
    fieldList,
    formulaList: buildDefaultFormulaFunctionList(),
  });
}

const normalizeAiFieldOptionPath = (change: Record<string, any>) => {
  if (Array.isArray(change?.path) && change.path.length) {
    return change.path.map(item => String(item || '').trim()).filter(Boolean);
  }
  return [String(change?.key || '').trim()].filter(Boolean);
}

const cloneAiFieldOptionChange = (change: Record<string, any>, path: string[]) => {
  return {
    ...change,
    key: path[path.length - 1] || change?.key,
    path,
  };
}

const getAiFormulaWidgetTitle = (widget: Widget) => {
  const formElement = widget as unknown as FormElement;
  const title = String(
    formElement?.title
    || widget.getSoul?.()?.name
    || widget.name
    || widget.uid
    || '',
  ).trim();
  const parentTitle = String((formElement?.parent as FormElement | undefined)?.title || '').trim();
  return formElement?.isInSubForm && parentTitle
    ? `${parentTitle}.${title}`
    : title;
}

const buildAiFormulaFieldTitleMap = () => {
  const context = buildAiDefaultFormulaTaskContext();
  const fieldList = Array.isArray(context?.fieldList) ? context.fieldList : [];
  const titleMap = new Map<string, string>();

  fieldList.forEach((field) => {
    const token = String(field.token || '').trim();
    const title = String(field.title || '').trim();
    const tokenId = token.match(/^\[\[([a-zA-Z0-9.:_]+)/)?.[1] || '';
    if (token && title) {
      titleMap.set(token, title);
    }
    if (tokenId && title) {
      titleMap.set(tokenId, title);
    }
  });

  return titleMap;
}

const resolveAiFormulaTokenDisplayTitle = (
  tokenText: string,
  tokenId: string,
  aliasText: string,
  targetWidget: Widget,
  titleMap: Map<string, string>,
) => {
  const aliasParts = String(aliasText || '').split('.').map(item => item.trim()).filter(Boolean);
  if (aliasParts.length) {
    const formElement = targetWidget as unknown as FormElement;
    const parentTitle = String((formElement?.parent as FormElement | undefined)?.title || '').trim();
    let fieldParts = aliasParts.length > 1 ? aliasParts.slice(1) : aliasParts;
    if (formElement?.isInSubForm && parentTitle && fieldParts[0] === parentTitle) {
      fieldParts = fieldParts.slice(1);
    }
    return fieldParts.join('.') || aliasParts[aliasParts.length - 1] || tokenId;
  }

  return titleMap.get(tokenText) || titleMap.get(tokenId) || tokenId;
}

const formatAiFormulaDisplayText = (formula: string, targetWidget: Widget) => {
  const titleMap = buildAiFormulaFieldTitleMap();
  return String(formula || '')
    .replace(/\[\[([a-zA-Z0-9.:_]+)(?:,([^\]]*))?\]\]/g, (tokenText, tokenId, aliasText) => (
      resolveAiFormulaTokenDisplayTitle(tokenText, tokenId, aliasText, targetWidget, titleMap)
    ))
    .replace(/\s*\*\s*/g, ' × ');
}

const resolveAiFormulaUpdateItem = (
  widget: Widget,
  paths: string[],
  change: Record<string, any>,
) => {
  const normalizedPath = paths.join('.');
  if (
    normalizedPath !== 'default-formula'
    && normalizedPath !== 'compute-formula'
  ) {
    return null;
  }

  const formula = normalizeFormulaText(change?.value);
  if (!formula) {
    return null;
  }

  return {
    tableId: table.value?.uid || '',
    tableName: table.value?.alias || '',
    widgetId: widget.uid,
    fieldName: getAiFormulaWidgetTitle(widget),
    formula,
    displayFormula: formatAiFormulaDisplayText(formula, widget),
    formulaPath: normalizedPath,
  };
}

const ensureAiDefaultFormulaTypeChange = (widget: Widget, rewritten: Array<Record<string, any>>) => {
  if (
    widget.hasOption?.(['default-type'])
    && !rewritten.some(item => normalizeAiFieldOptionPath(item).join('.') === 'default-type')
  ) {
    rewritten.push({
      key: 'default-type',
      path: ['default-type'],
      value: 'formula',
    });
  }
}

const rewriteAiFormulaFieldOptionChanges = (widget: Widget, changes: Array<Record<string, any>> = []) => {
  const isAutoComputeWidget = String(widget?.type || '').trim() === 'widget.form.autoCompute';
  if (!changes.length) return [];

  const rewritten: Array<Record<string, any>> = [];

  for (const rawChange of changes) {
    const change = rawChange && typeof rawChange === 'object' ? rawChange : {};
    const path = normalizeAiFieldOptionPath(change);
    if (!path.length) {
      rewritten.push(change);
      continue;
    }

    const normalizedPath = path.join('.');
    if (!isAutoComputeWidget) {
      if (normalizedPath === 'compute-formula') {
        if (normalizeFormulaText(change?.value)) {
          ensureAiDefaultFormulaTypeChange(widget, rewritten);
        }
        rewritten.push(cloneAiFieldOptionChange(change, ['default-formula']));
      } else if (normalizedPath === 'default-formula') {
        if (normalizeFormulaText(change?.value)) {
          ensureAiDefaultFormulaTypeChange(widget, rewritten);
        }
        rewritten.push(cloneAiFieldOptionChange(change, path));
      } else {
        rewritten.push(cloneAiFieldOptionChange(change, path));
      }
      continue;
    }

    if (normalizedPath === 'default-formula' || normalizedPath === 'compute-formula') {
      if (!rewritten.some(item => normalizeAiFieldOptionPath(item).join('.') === 'compute-type')) {
        rewritten.push({
          key: 'compute-type',
          path: ['compute-type'],
          value: 'formula',
        });
      }
      rewritten.push(cloneAiFieldOptionChange(change, ['compute-formula']));
      continue;
    }

    rewritten.push(cloneAiFieldOptionChange(change, path));
  }

  return rewritten;
}

const removeWidgetIntoRecycleBinById = (widgetId: string) => {
  const targetWidget = getAiWidgetById(widgetId);
  if (!targetWidget) {
    throw new Error(i18next.t('FormDesigner.fieldNotFound', { fieldId: widgetId || '' }));
  }
  if (targetWidget.uid === formWidget.value?.uid) {
    throw new Error(i18next.t('FormDesigner.cannotDeleteFormRoot'));
  }

  const targetContainer = (targetWidget.parent as any)?.container;
  if (!targetContainer?.removeWidget) {
    throw new Error(i18next.t('FormDesigner.fieldDeleteUnsupported', { fieldId: targetWidget.uid }));
  }

  const widgetSoul = targetContainer.removeWidget(targetWidget.uid);
  if (!widgetSoul) {
    throw new Error(i18next.t('FormDesigner.fieldDeleteFailed', { fieldId: targetWidget.uid }));
  }
  if (targetWidget.uid === activeWidget.value?.uid) {
    selectedWidgets.value = formWidget.value ? [formWidget.value] : [];
  }

  if (widgetSoul.type === FormWidgetType.MULTIPLE_TABS) {
    const allWidgets = getChildrenWidgetSouls(widgetSoul);
    const allDeleteWidgets = allWidgets.filter(item => item.type !== FormWidgetType.TAB_PANEL);
    for (const deletedWidget of allDeleteWidgets) {
      handleIntoRecycleBin(deletedWidget, table.value);
    }
  } else {
    handleIntoRecycleBin(widgetSoul, table.value);
  }
  markFormChanged();
  return widgetSoul;
}

const getAiAvailableWidgetTypes = () => {
  return buildAiAvailableWidgetTypes();
}

const AI_VALIDATION_FORMAT_VALUE_MAP: Record<string, string> = {
  email: 'email',
  mail: 'email',
  'e-mail': 'email',
  'id-number': 'ID-number',
  idnumber: 'ID-number',
  idcard: 'ID-number',
  identity: 'ID-number',
  身份证: 'ID-number',
  身份证号: 'ID-number',
};

const normalizeAiValidationFormat = (value: unknown) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return undefined;
  return AI_VALIDATION_FORMAT_VALUE_MAP[normalized]
    || AI_VALIDATION_FORMAT_VALUE_MAP[normalized.replace(/号码|号|格式/g, '')]
    || undefined;
}

const inferAiValidationFormat = (name: string, current?: unknown) => {
  const normalizedCurrent = normalizeAiValidationFormat(current);
  if (normalizedCurrent) {
    return normalizedCurrent;
  }
  if (/(邮箱|电子邮箱|e-?mail|email)/i.test(name)) {
    return 'email';
  }
  if (/(身份证|身份证号|居民身份证|id\\s*card|identity)/i.test(name)) {
    return 'ID-number';
  }
  return undefined;
}

const AI_WIDGET_ENUM_OPTION_KEY_MAP: Partial<Record<FormWidgetType, string>> = {
  [FormWidgetType.RADIO_GROUP]: 'radiogroup-value-text-color-option',
  [FormWidgetType.CHECKBOX_GROUP]: 'checkbox-option',
  [FormWidgetType.TREE_SELECT]: 'treeselect-value-text-option',
  [FormWidgetType.TREE_MULTIPLE_SELECT]: 'treeselect-value-text-option',
}

const normalizeAiEnumOptionsPreview = (value: unknown) => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const label = String((item as any).label || (item as any).value || '').trim()
      const optionValue = String((item as any).value || (item as any).label || '').trim()
      if (!label && !optionValue) {
        return null
      }
      return {
        label: label || optionValue,
        value: optionValue || label,
      }
    })
    .filter(Boolean)
}

const getAiWidgetEnumMeta = (widget: Widget) => {
  const widgetType = widget.type as FormWidgetType
  const optionKey = AI_WIDGET_ENUM_OPTION_KEY_MAP[widgetType]
  if (!optionKey) {
    return {}
  }

  const normalizedSourceType = String(widget.getOption?.(['select-choices-type']) || '').trim()
  const enumOptionValue = widget.getOption?.([optionKey]) as Record<string, any> | undefined
  const enumSourceType = normalizedSourceType || 'custom'
  const enumOptionsPreview = enumSourceType === 'custom'
    ? normalizeAiEnumOptionsPreview(enumOptionValue?.options)
    : []

  return {
    enumSourceType,
    enumOptionCount: enumOptionsPreview.length,
    enumOptionsPreview,
  }
}

const serializeAiWidgetTree = (widget: Widget, parentUid = ''): Record<string, any> => {
  const soul = widget.getSoul();
  const children = Array.isArray((widget as any).widgets)
    ? (widget as any).widgets.map((child: Widget) => serializeAiWidgetTree(child, widget.uid))
    : [];
  const formulaPaths = [
    ...(widget.hasOption?.(['default-formula']) ? ['default-formula'] : []),
    ...(widget.hasOption?.(['compute-formula']) ? ['compute-formula'] : []),
  ];
  return {
    uid: widget.uid,
    type: widget.type,
    name: soul?.name || widget.defaultName || widget.type,
    parentUid,
    formulaPaths,
    ...getAiWidgetEnumMeta(widget),
    children,
  };
}

const isAiVisible = (visible: any, element: Widget, paths?: string[]) => {
  if (visible === undefined) return true;
  return isCallableVisible(visible) ? Boolean(unref(visible(element, paths))) : Boolean(visible);
}

const collectAiOptionItems = (element: Widget, items: any[] = [], paths: string[] = []) => {
  const result: Record<string, any>[] = [];
  for (const item of items) {
    if (isOption(item)) {
      const itemPaths = [...paths, item.name];
      if (!isAiVisible(item.visible, element, paths)) continue;
      const optionType = element.getOptionType(itemPaths);
      result.push({
        key: item.name,
        path: itemPaths,
        label: item.alias || item.name,
        type: optionType?.type || item.type,
        currentValue: element.getOption(itemPaths),
        hasDynamicChoices: Boolean(optionType?.selectChoices),
      });
      continue;
    }
    if (isOptionSubgroup(item)) {
      if (!isAiVisible(item.visible, element, paths)) continue;
      result.push(...collectAiOptionItems(element, item.children || [], paths));
      continue;
    }
    if (isOptionCluster(item)) {
      if (!isAiVisible(item.visible, element, paths)) continue;
      result.push({
        key: item.name,
        path: [...paths, item.name],
        label: item.alias || item.name,
        type: `cluster:${item.cluster}`,
        currentValue: element.getOption([...paths, item.name]),
        hasDynamicChoices: false,
      });
    }
  }
  return result;
}

const normalizeAiChoices = (choices: any): any => {
  if (!Array.isArray(choices)) return [];
  if (choices.length > 0 && Array.isArray(choices[0])) {
    return choices.map(group => normalizeAiChoices(group));
  }
  return choices.map((item: any) => ({
    label: item?.label,
    value: item?.value,
    disabled: item?.disabled,
    tip: item?.tip,
    unUse: item?.unUse,
    children: Array.isArray(item?.children) ? normalizeAiChoices(item.children) : undefined,
  }));
}

const resolveAiSelectChoices = (element: Widget, paths: string[]) => {
  const optionType = element.getOptionType(paths);
  const rawChoices = optionType?.selectChoices;
  if (!rawChoices) return [];
  if (typeof rawChoices === 'function') {
    return normalizeAiChoices(rawChoices(element));
  }
  return normalizeAiChoices(rawChoices);
}

const findAiChoiceByValue = (choices: any, value: any): any => {
  if (!Array.isArray(choices)) return null;
  for (const item of choices) {
    if (Array.isArray(item)) {
      const groupChoice = findAiChoiceByValue(item, value);
      if (groupChoice) return groupChoice;
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    if (item.value === value || item.legacyValue === value) {
      return item;
    }
    if (Array.isArray(item.children)) {
      const childChoice = findAiChoiceByValue(item.children, value);
      if (childChoice) return childChoice;
    }
  }
  return null;
}

const assertAiOptionValueEnabled = (widget: Widget, paths: string[], value: any) => {
  if (value === undefined || value === null) return;
  const choices = resolveAiSelectChoices(widget, paths);
  if (!choices.length) return;
  const values = Array.isArray(value) ? value : [value];
  for (const item of values) {
    const choice = findAiChoiceByValue(choices, item);
    if (choice?.disabled) {
      throw new Error(i18next.t('FormDesigner.disabledOptionBlocked', {
        label: choice.label || item,
      }));
    }
  }
}

const resolveAiWidgetType = (widgetType: string) => {
  return resolveAiAvailableWidgetType(widgetType, getAiAvailableWidgetTypes());
}

const resolveAiContainer = (containerWidgetId?: string) => {
  if (!containerWidgetId) {
    return formWidget.value?.container;
  }
  const targetWidget = getAiWidgetById(containerWidgetId);
  if (!targetWidget) {
    throw new Error(i18next.t('FormDesigner.containerFieldNotFound', { fieldId: containerWidgetId }));
  }
  if ((targetWidget as any).tabPanel) {
    return (targetWidget as any).tabPanel;
  }
  if ((targetWidget as any).container) {
    return (targetWidget as any).container;
  }
  throw new Error(i18next.t('FormDesigner.fieldNotContainer', { fieldId: containerWidgetId }));
}

const AI_FIELD_REPLACE_BASE_OPTIONS = [
  'width-ratio', 'width-subform', 'input-width', 'input-width-px',
  'show-title', 'title-text', 'show-description', 'description-layout', 'description-content',
  'placeholder',
  'is-hidden', 'is-readonly',
  'required', 'unique', 'option-count', 'option-count-range',
]

const AI_FIELD_REPLACE_STRING_WIDGETS: FormWidgetType[] = [
  FormWidgetType.TEXT_INPUT,
  FormWidgetType.TREE_SELECT,
  FormWidgetType.RADIO_GROUP,
]

const AI_FIELD_REPLACE_ARRAY_WIDGETS: FormWidgetType[] = [
  FormWidgetType.TREE_MULTIPLE_SELECT,
  FormWidgetType.CHECKBOX_GROUP,
]

const buildAiReplacementSoul = (soul: Soul, nextType: FormWidgetType, nextName?: string) => {
  const oldType = soul.type as FormWidgetType
  const nextSoul: Soul = {
    ...soul,
    uid: soul.uid,
    type: nextType,
    name: String(nextName || soul.name || '').trim() || soul.name,
    options: {},
  }

  for (const key in soul.options) {
    if (AI_FIELD_REPLACE_BASE_OPTIONS.includes(key)) {
      nextSoul.options[key] = soul.options[key]
    }
  }

  if (AI_FIELD_REPLACE_STRING_WIDGETS.includes(oldType)) {
    if (oldType === FormWidgetType.TREE_SELECT && nextType === FormWidgetType.RADIO_GROUP) {
      nextSoul.options['radiogroup-value-text-color-option'] = soul.options['treeselect-value-text-option']
    }
    if (oldType === FormWidgetType.RADIO_GROUP && nextType === FormWidgetType.TREE_SELECT) {
      nextSoul.options['treeselect-value-text-option'] = soul.options['radiogroup-value-text-color-option']
    }
  }

  if (AI_FIELD_REPLACE_ARRAY_WIDGETS.includes(oldType)) {
    if (oldType === FormWidgetType.TREE_MULTIPLE_SELECT) {
      nextSoul.options['checkbox-option'] = soul.options['treeselect-value-text-option']
    }
    if (oldType === FormWidgetType.CHECKBOX_GROUP) {
      nextSoul.options['treeselect-value-text-option'] = soul.options['checkbox-option']
    }
  }

  return nextSoul
}

const replaceAiField = async (input: { widgetId: string; widgetType: string; name?: string }) => {
  const targetWidget = getAiWidgetById(input?.widgetId)
  if (!targetWidget) {
    throw new Error(i18next.t('FormDesigner.fieldNotFound', { fieldId: input?.widgetId || '' }))
  }

  const nextWidgetType = resolveAiWidgetType(input?.widgetType || '')
  if (!nextWidgetType) {
    throw new Error(i18next.t('FormDesigner.invalidFieldType', { widgetType: input?.widgetType || '' }))
  }

  if (targetWidget.type === nextWidgetType) {
    const nextName = String(input?.name || '').trim()
    if (nextName && nextName !== targetWidget.getSoul()?.name) {
      targetWidget.getSoul().name = nextName
      markFormChanged()
    }
    selectedWidgets.value = [targetWidget as unknown as FormElement]
    return {
      widgetId: targetWidget.uid,
      widgetType: targetWidget.type,
      name: targetWidget.getSoul()?.name || nextName,
      replaced: false,
    }
  }

  const parentWidget = targetWidget.parent as Widget | undefined
  const targetContainer = parentWidget?.container
  if (!targetContainer) {
    throw new Error(i18next.t('FormDesigner.fieldReplaceUnsupported', { fieldId: targetWidget.uid }))
  }

  const index = targetContainer.widgets.findIndex(item => item.uid === targetWidget.uid)
  if (index < 0) {
    throw new Error(i18next.t('FormDesigner.fieldPositionNotFound', { fieldId: targetWidget.uid }))
  }

  const currentSoul = targetWidget.getSoul()
  const nextSoul = buildAiReplacementSoul(
    currentSoul,
    nextWidgetType as FormWidgetType,
    input?.name,
  )

  targetContainer.removeWidget(targetWidget.uid)
  const nextWidget = await targetContainer.addWidget(nextSoul, index)
  if (!nextWidget) {
    throw new Error(i18next.t('FormDesigner.fieldReplaceFailed', { fieldName: currentSoul?.name || targetWidget.uid }))
  }

  selectedWidgets.value = [nextWidget as FormElement]
  markFormChanged()
  return {
    widgetId: nextWidget.uid,
    widgetType: nextWidget.type,
    name: nextWidget.getSoul?.()?.name || currentSoul?.name || '',
    replaced: true,
  }
}


const formWidgetRows = ref<FormElement[][]>();

type PersistWriteOptions = {
  beforeWrite?: () => void
}

const createTable = async (
  tableName: string,
  extra?: any,
  options: PersistWriteOptions = {},
) => {
  const { formData: newFormData, table } = await formDataApi.addTable({
    name: tableName,
    formData: formData.value, 
    extra,
  });
  options.beforeWrite?.();
  formData.value = newFormData;
  return table;
}

const syncRelationTableColumns = async (
  relationTable: Table,
  columns: TableColumn[],
  options: PersistWriteOptions = {},
) => {
  const _formData = await formDataApi.syncTableColumns({
    formData: formData.value,
    tableUID: relationTable.uid,
    columns,
  });
  options.beforeWrite?.();
  const nextFormData = await handleSyncFormTable(_formData, relationTable, false, {
    beforeWrite: options.beforeWrite,
  });
  if (nextFormData) {
    formData.value = nextFormData;
  }
}

const deleteSubTable = async (
  subTableUID: OptionTableUID,
  options: PersistWriteOptions = {},
) => {
  const subTable = formWidget.value.getTable(subTableUID);
  if (!subTable) return;
  options.beforeWrite?.();
  await handleDeleteTable(subTable, {
    beforeWrite: options.beforeWrite,
  });
}

const checkColumnInSouls = (column: TableColumn): boolean => {
  const soul = formWidget.value?.getSoul();
  if (!soul) return true;
  const _soul = findWidgetSoulByUID(soul.widgets, column.uid);
  return !!_soul;
}

/**更新表结构之前进行对比 处理关系表、子表 */
const compareColumns = async (
  oldColumns: TableColumn[],
  newColumns: TableColumn[],
  options: PersistWriteOptions = {},
) => {
  const addColumns: TableColumn[] = [], modifyColumns: TableColumn[] = [], deleteColumns: TableColumn[] = [];

  const oldColumnUids = oldColumns.map(oldColumn => oldColumn.uid);
  const newColumnUids = newColumns.map(newColumn => newColumn.uid);
  for (const oldColumn of oldColumns) {
    if (newColumnUids.includes(oldColumn.uid)) continue;
    // 检测是不是真删除
    const isExist = checkColumnInSouls(oldColumn);
    if (isExist) {
      ElMessage.warning(i18next.t('FormDesigner.editEnvError'));
      const index = oldColumns.findIndex(item => item.uid === oldColumn.uid);
      newColumns.splice(index, 0, oldColumn);
      continue;
    }
    deleteColumns.push(oldColumn);
  }
  for (const newColumn of newColumns) {
    if (oldColumnUids.includes(newColumn.uid)) {
      const oldColumn = oldColumns.find(oldColumn => oldColumn.uid === newColumn.uid);
      if (oldColumn.subType === "subForm") {
        const subTableUID = oldColumn.extra.subTableUID;
        const table = formWidget.value?.getTable(subTableUID);
        if (!table) {
          ElMessage.warning(`${i18next.t('FormDesigner.detectSubForm')} ${oldColumn.alias} ${i18next.t('FormDesigner.recreateSubForm')}`);
          addColumns.push(newColumn);
          continue;
        }
      }
      modifyColumns.push(newColumn);
    } else {
      addColumns.push(newColumn);
    }
  }
  const table = formWidget.value?.getTable(formWidget.value?.tableUID);
  const uuidField = getUUIDSystemField(table.fields);
  //修改的字段
  for (const modifyColumn of modifyColumns) {
    if (modifyColumn.subType !== "subForm") continue;
    const extra = modifyColumn.extra;
    const oldIndex = oldColumnUids.indexOf(modifyColumn.uid);
    const oldModifyColumn = oldColumns[oldIndex];
    const oldExtra = oldModifyColumn.extra;

    if (equals(extra.subColumns, oldExtra.subColumns)) {
      //同步需要保留的信息
      extra.subTableUID = oldExtra.subTableUID;
      continue;
    }

    extra.subTableUID = oldExtra.subTableUID;
    //子表格同步字段
    const selfUuidColumn: TableColumn = {
      name: SystemField.KEY,
      uid: uuidField.meta.uid,
      type: "string",
    };
    const relationTable = formWidget.value?.getTable(extra.subTableUID);
    if(relationTable) {
      await syncRelationTableColumns(relationTable, [selfUuidColumn].concat(extra.subColumns ?? []), {
        beforeWrite: options.beforeWrite,
      });
    }
  }
  //新增的字段
  for (const addColumn of addColumns) {
    if (addColumn.subType !== "subForm") continue;
    const extra = addColumn.extra;
    //创建子表格
    const tableName = `${table.alias}--${i18next.t('FormDesigner.subForm')}(${addColumn.alias}-${addColumn.uid})`;
    const relationTable = await createTable(tableName, {
      primaryTable: formWidget.value.tableUID,
      __tableUID__: addColumn.extra?.['__tableUID__'],
      __metaUID__: addColumn.extra?.['__metaUID__']
    }, {
      beforeWrite: options.beforeWrite,
    });
    extra.subTableUID = [formData.value.uid, relationTable.uid];
    //同步字段
    const selfUuidColumn: TableColumn = {
      name: SystemField.KEY,
      uid: uuidField.meta.uid,
      type: "string",
    }
    await syncRelationTableColumns(relationTable, [selfUuidColumn].concat(extra.subColumns ?? []), {
      beforeWrite: options.beforeWrite,
    });
  }
  //删除的字段
  let willDeleteSubTableUIDs = [];
  for (const deleteColumn of deleteColumns) {
    const subTableUID = deleteColumn.extra?.subTableUID;
    if (subTableUID) {
      willDeleteSubTableUIDs.push(subTableUID);
    }
  }
  //最后统一删除多余的关系表
  willDeleteSubTableUIDs = Array.from(new Set(willDeleteSubTableUIDs));
  for (const willDeleteSubTableUID of willDeleteSubTableUIDs) {
    await deleteSubTable(willDeleteSubTableUID, {
      beforeWrite: options.beforeWrite,
    });
  }
}

const recycleBinVisible = ref(false);
const recycleTotalCount = computed(() => {
  return recycleBinData.value.length;
});
const recycleCurrentPage = ref(1);
const recyclePageSize = ref(10);
const currentRecycleData = computed(() => {
  return recycleBinData.value.filter((item, index) => index < recycleCurrentPage.value * recyclePageSize.value && index >= (recycleCurrentPage.value - 1) * recyclePageSize.value);
})
const recycleSizeChange = (size: number) => {
  recyclePageSize.value = size;
}
const recyclePageChange = (page: number) => {
  recycleCurrentPage.value = page;
}

const handleOpenRecycleBinDrawer = (val) => {
  if (props.blueprintApplyingReadonly && val) {
    return;
  }
  recycleCurrentPage.value = 1;
  recyclePageSize.value = 10;
  recycleBinVisible.value = val;
}

watch(() => props.blueprintApplyingReadonly, (readonly) => {
  if (readonly) {
    fieldCatalogDragState.value = null;
    propertyPanelDragState.value = null;
    recycleBinVisible.value = false;
    selectedWidgets.value = formWidget.value ? [formWidget.value] : [];
    hoverWidget.value = undefined;
    const activeElement = document.activeElement as HTMLElement | null;
    if (activeElement && formDesignerHostRef.value?.contains(activeElement)) {
      activeElement.blur();
    }
  }
});

const recycleBinData = computed(() => {
  if (!table.value) return [];
  const formOption = formData.value.formOptions?.[table.value?.uid];
  const subFormFields = table.value.fields.filter(field => field.meta?.extra?.widgetType === FormWidgetType.SUBFORM) || [];
  // 获取 deletedWidgets 中的回收站组件
  const deletedWidgets = formOption?.deletedWidgets || [];
  // 删除并且保存后的组件才会在回收站里显示
  
  const widgetRecycleData = pendingDeletedWidgets.value[table.value.uid]?.filter(_widget => deletedWidgets.find(item => item.uid === _widget.uid)).map(_widget => {
    let fieldName = _widget.options?.['title-text'] || _widget.name;
    let subFormWidget;

    if ((_widget.type !== FormWidgetType.SUBFORM) && deletedWidgets.find(item => ((item.type === FormWidgetType.SUBFORM) && (item.recycleInfo.tableUID === _widget.recycleInfo.tableUID)))) {
      // _widget所属子表单自身被删除，在deletedWidgets中找到对应的子表单组件
      subFormWidget = deletedWidgets.find(item => (item.type === FormWidgetType.SUBFORM) && (item.recycleInfo.tableUID === _widget.recycleInfo.tableUID));
    } else if (subFormFields.find(item => item.meta?.extra?.subTableUID?.[1] === _widget.recycleInfo.tableUID)) {
      // 子表单未被删除
      const subFormField = subFormFields.find(item => item.meta?.extra?.subTableUID?.[1] === _widget.recycleInfo.tableUID);
      subFormWidget = formOption.widget.widgets.find(item => item.uid === subFormField.meta?.uid);
    }

    if (subFormWidget) {
      fieldName = `${subFormWidget.options?.['title-text'] || subFormWidget.name}.${fieldName}`
    }

    const deleteOperatorData = passportState.subAccounts.find(item => item.id === _widget.recycleInfo.operator);
    return {
      uid: _widget.uid,
      tableUId: _widget.recycleInfo.tableUID,
      fieldName,
      widgetType: _widget.type, // 组件类型s
      deleteOperator: deleteOperatorData?.realname || deleteOperatorData?.user,
      deleteTime: dayjs(_widget.recycleInfo.operateTime).format('YYYY-MM-DD HH:mm'),
    };
  }) || [];

  return widgetRecycleData;
})

// 恢复字段（单行）
const handleRestoreField = async (row) => {
  const formDataTable = formData.value.options.tables.find(
    _table => _table.uid === table.value.meta.uid
  );
  if (!formDataTable) return;
  
  const formOption = formData.value.formOptions?.[table.value.uid];
  if (!formOption) return;

  const deletedWidgets = pendingDeletedWidgets.value[table.value.uid] || [];
  let deletedIndex = deletedWidgets.findIndex(w => w.uid === row.uid);
  if (deletedIndex === -1) return;
  
  const deletedWidget = deletedWidgets[deletedIndex];
  
  // 将 widget 添加回表单（不包含 recycleInfo）
  const { recycleInfo, ...widgetWithoutRecycleInfo } = deletedWidget;
  let formElement: FormElement;
  if (recycleInfo.tableUID === formWidget.value.tableUID[1] || widgetWithoutRecycleInfo.type === FormWidgetType.SUBFORM) {
    formElement = await formWidget.value.container.addWidget(widgetWithoutRecycleInfo, formWidget.value.container.souls.length) as FormElement;
  } else {
    const mainTable = formData.value.tables.find(item => item.uid === formWidget.value.tableUID[1])
    const subFormField = mainTable.fields.filter(item => item.meta?.extra?.widgetType === FormWidgetType.SUBFORM).find(field => ((field.meta?.uid === recycleInfo.tableUID) || (field.meta?.extra?.subTableUID?.[1] === recycleInfo.tableUID)));
    if (!isEmpty(subFormField) && !formOption.deletedWidgets.find(item => item.uid === subFormField.meta?.uid)) {
      // 子表单未被删除
      const thisSubForm = formWidget.value.widgets?.find(item => item.uid === subFormField.meta?.uid);
      formElement = await thisSubForm.container.addWidget(widgetWithoutRecycleInfo, thisSubForm.container.souls.length) as FormElement;
    } else if (formOption.deletedWidgets.find(item => (item.type === FormWidgetType.SUBFORM) &&  (item.recycleInfo.tableUID === recycleInfo.tableUID))) {
      const subFormInRecycle = formOption.deletedWidgets.find(item => (item.type === FormWidgetType.SUBFORM) &&  (item.recycleInfo.tableUID === recycleInfo.tableUID));
      const { recycleInfo: subFormRecycleInfo, ...subFormWithoutRecycleInfo } = subFormInRecycle;
      if (deletedWidgets.find(item => item.uid === subFormWithoutRecycleInfo.uid)) {
        const subFormElement = await formWidget.value.container.addWidget(subFormWithoutRecycleInfo, formWidget.value.container.souls.length) as FormElement;
        const subDeletedIndex = deletedWidgets.findIndex(w => w.uid === subFormRecycleInfo.tableUID);
        deletedWidgets.splice(subDeletedIndex, 1);
        const _resolveFormSetting = subFormElement.resolveFormSetting.bind(subFormElement);
        subFormElement.resolveFormSetting = () => {
          const value = _resolveFormSetting() ?? {};
          
          return {
            ...value,
            extra: {
              ...(value?.extra || {}),
              __fieldId__: subFormRecycleInfo.fieldId,
              __tableUID__: subFormRecycleInfo.tableUID,
              __metaUID__: subFormRecycleInfo.tableMetaUID
            }
          };
        }
      }

      const thisSubForm = formWidget.value.widgets?.find(item => item.uid === subFormWithoutRecycleInfo.uid);
      formElement = await thisSubForm.container.addWidget(widgetWithoutRecycleInfo, thisSubForm.container.souls.length) as FormElement;
      deletedIndex = deletedWidgets.findIndex(w => w.uid === row.uid);
    }
  }
  
  // 从 deletedWidgets 中移除
  deletedWidgets.splice(deletedIndex, 1);
  
  if(formElement) {
    const _resolveFormSetting = formElement.resolveFormSetting.bind(formElement);
    formElement.resolveFormSetting = () => {
      const value = _resolveFormSetting() ?? {};
      
      return {
        ...value,
        extra: {
          ...(value?.extra || {}),
          __fieldId__: recycleInfo.fieldId,
          __tableUID__: recycleInfo.tableUID,
          __metaUID__: recycleInfo.tableMetaUID
        }
      };
    }
  }

  markFormChanged();
}

// 彻底删除字段（单行）
const handleRealDeleteField = async (row) => {
  try {
    const formOption = formData.value.formOptions?.[table.value.uid];
    if (!formOption) return;

    // 彻底删除组件
    const deletedWidgets = formOption.deletedWidgets || [];
    const deletedWidget = deletedWidgets.find(w => w.uid === row.uid);
    
    if (deletedWidget.type === FormWidgetType.SUBFORM) {
      // 删除子表单的子字段
      for (const [index, item] of deletedWidgets.entries()) {
        if (item.recycleInfo.tableUID === deletedWidget.recycleInfo.tableUID) {
          deletedWidgets.splice(index, 1);
          const pendingIndex = pendingDeletedWidgets.value[table.value.uid].findIndex(w => w.uid === item.uid);
          if (pendingIndex > -1) {
            pendingDeletedWidgets.value[table.value.uid].splice(pendingIndex, 1);
          }
        }
      }
    }
    const deletedIndex = deletedWidgets.findIndex(w => w.uid === row.uid);
    if (deletedIndex > -1) {
      deletedWidgets.splice(deletedIndex, 1);
    }
    
    // 同时从 pendingDeletedWidgets 中移除
    const pendingIndex = pendingDeletedWidgets.value[table.value.uid].findIndex(w => w.uid === row.uid);
    if (pendingIndex > -1) {
      pendingDeletedWidgets.value[table.value.uid].splice(pendingIndex, 1);
    }
    
    // 保存修改
    const savedDeletedWidgets = formOption.deletedWidgets.filter(w => {
      if (w.uid === row.uid) {
        delete w.recycleInfo;
      }
      return w.uid !== row.uid
    });

    markFormChanged();
    // 恢复 deletedWidgets
    if (formData.value.formOptions?.[table.value.uid]) {
      formData.value.formOptions[table.value.uid].deletedWidgets = savedDeletedWidgets || [];
    }

    emit('save', true);
  } catch (error) {
    // 用户取消操作
  }
}

// 清空回收站
const handleClearRecycleBin = async () => {
  try {
    const formDataTable = formData.value.options.tables.find(
      _table => _table.uid === table.value.meta.uid
    );
    const formOption = formData.value.formOptions?.[table.value.uid];
    
    if (!formDataTable?.columns || !formOption) return;

    // 清空 deletedWidgets
    formOption.deletedWidgets = [];
    
    // 清空 pendingDeletedWidgets
    pendingDeletedWidgets.value[table.value.uid] = [];
    
    markFormChanged();

    // 保存
    emit('save', true);
  } catch (error) {
    // 用户取消操作
  }
}

// 回收站选择变化
const recycleFieldSelection = ref([])
const handleChangeSelectRecycleField = (val) => {
  recycleFieldSelection.value = val;
}

const restoreTipDialogVisible = ref(false);
const selectMode = ref<'single' | 'batch' | 'clear'>('single');
const singleSelectedRow = ref(null);
const restoreDialogTips = ref({
  title: '',
  restoreTip: '',
  restoreWarningText: '',
})
const resetRestoreDialogTips = () => {
  restoreDialogTips.value = {
    title: i18next.t('FormDesigner.restoreDialogTitle'),
    restoreTip: i18next.t('FormDesigner.confirmRestore'),
    restoreWarningText: i18next.t('FormDesigner.restoreWarn'),
  }
}
const handleRestoreSingleField = (row) => {
  singleSelectedRow.value = row;
  selectMode.value = 'single';
  resetRestoreDialogTips();
  restoreTipDialogVisible.value = true;
}
const handleBatchRestoreField = () => {
  selectMode.value = 'batch';
  resetRestoreDialogTips();
  restoreTipDialogVisible.value = true;
}
const handleRestoreData =  async () => {
  if (selectMode.value === 'single') {
    await handleRestoreField(singleSelectedRow.value);
    ElMessage.success(i18next.t('FormDesigner.restoreSuccess'));
  } else if (selectMode.value === 'batch') {
    for (const item of recycleFieldSelection.value) {
      await handleRestoreField(item);
    }
    recycleFieldSelection.value = [];
    ElMessage.success(i18next.t('FormDesigner.restoreSuccess'));
  }
}

const deleteTipDialogVisible = ref(false);
const deleteDialogTips = ref({
  title: '',
  deleteTip: '',
  deleteWarningText: '',
});
const handleBeforeRealDeleteSingleField = (row) => {
  deleteDialogTips.value = {
    title: i18next.t('FormDesigner.deleteDialogTitle'),
    deleteTip: i18next.t('FormDesigner.confirmRealDeleteField'),
    deleteWarningText: i18next.t('FormDesigner.deleteWarn'),
  }
  deleteTipDialogVisible.value = true;
  singleSelectedRow.value = row;
  selectMode.value = 'single';
}

const handleDeleteData = async () => {
  if (selectMode.value === 'single') { // 单个
    await handleRealDeleteField(singleSelectedRow.value);
    singleSelectedRow.value = null;
    ElMessage.success(i18next.t('FormDesigner.deleteSuccess'));
  } else if (selectMode.value === 'batch') { // 批量
    for (const item of recycleFieldSelection.value) {
      await handleRealDeleteField(item);
    }
    recycleFieldSelection.value = [];
    ElMessage.success(i18next.t('FormDesigner.deleteSuccess'));
  } else { // 清空
    await handleClearRecycleBin();
    ElMessage.success(i18next.t('FormDesigner.clearRecycleBinSuccess'));
    recycleFieldSelection.value = [];
  }
}

const handleBeforeBatchDeleteField = () => {
  deleteDialogTips.value = {
    title: i18next.t('FormDesigner.deleteDialogTitle'),
    deleteTip: i18next.t('FormDesigner.confirmRealDeleteField'),
    deleteWarningText: i18next.t('FormDesigner.deleteWarn'),
  }
  deleteTipDialogVisible.value = true;
  selectMode.value = 'batch';
}

const handleBeforeClearRecycleBin = () => {
  selectMode.value = 'clear';
  deleteDialogTips.value = {
    title: i18next.t('FormDesigner.deleteDialogTitle'),
    deleteTip: i18next.t('FormDesigner.confirmClearRecycleBin'),
    deleteWarningText: i18next.t('FormDesigner.deleteWarn'),
  }
  deleteTipDialogVisible.value = true;
}

type DesignValidationIssue = {
  widget: FormElement;
  message: string;
  issue: FormDesignValidationIssue;
}

type DesignValidationWidget = FormElement & {
  widgets?: FormElement[];
  children?: FormElement[];
}

const getWidgetChildren = (widget: DesignValidationWidget): FormElement[] => {
  return (widget?.widgets || widget?.children || []) as FormElement[];
}

const walkWidgets = (widgets: FormElement[] = [], visitor: (widget: FormElement) => void) => {
  widgets.forEach((widget) => {
    visitor(widget);
    const children = getWidgetChildren(widget as DesignValidationWidget);
    if (children.length > 0) {
      walkWidgets(children, visitor);
    }
  });
}

const clearDesignValidationErrors = () => {
  walkWidgets((formWidget.value?.widgets || []) as FormElement[], (widget) => {
    widget.validationError = null as unknown as Error;
  });
}

const syncTargetTableExtra = () => {
  const targetTable = formData.value.options.tables.find(_table => _table.uid === table.value.meta.uid);
  targetTable.extra = {
    ...(targetTable.extra || {}),
    dataTitle: {
      value: formWidget.value.dataTitle,
    }
  }
  return targetTable;
}

const removeMovedWidgetsFromPendingDeleted = (columns: TableColumn[]) => {
  const moveWidgetsUIDs = []
  for (const item of columns) {
    if (pendingDeletedWidgets.value[table.value.uid].find(_item => _item.uid === item.uid)) {
      moveWidgetsUIDs.push(item.uid);
    }
  }
  pendingDeletedWidgets.value[table.value.uid] = pendingDeletedWidgets.value[table.value.uid]
    .filter(_item => !moveWidgetsUIDs.includes(_item.uid));
}

const persistFormStructure = async (options: {
  formOptions: FormOptions
  clearFormChanged: boolean
  beforeWrite?: () => void
}) => {
  formWidget.value.onSave();
  const columns = formWidget.value.generateColumns();
  const targetTable = syncTargetTableExtra();
  const oldColumns = targetTable.columns.filter(column => !column.isSystem);
  await compareColumns(oldColumns, columns, {
    beforeWrite: options.beforeWrite,
  });
  options.beforeWrite?.();
  removeMovedWidgetsFromPendingDeleted(columns);

  const _formData = await formDataApi.syncTableColumns({
    formData: formData.value,
    tableUID: table.value.uid,
    columns,
  });
  options.beforeWrite?.();
  options.formOptions[table.value.uid].deletedWidgets = [...pendingDeletedWidgets.value[table.value.uid]];
  _formData.formOptions = options.formOptions;
  formData.value = _formData;
  if (options.clearFormChanged) {
    formChanged.value = false;
  }
  return _formData;
}

const getBoardConnections = () => {
  return formWidget.value?.getBoard?.().getConnections?.() || [];
}

const buildValidationOptionFieldUID = (value?: string[] | null) => (
  Array.isArray(value) && value.length >= 3 ? value.join('.') : undefined
);

const buildValidationConnectionTableUID = (value?: string[] | null) => (
  Array.isArray(value) && value.length >= 2 ? `${value[0]},${value[1]}` : undefined
);

const buildValidationWidgetSnapshots = (widgets: FormElement[] = []): FormDesignValidationWidgetSnapshot[] => {
  return widgets.map((widget) => {
    const children = getWidgetChildren(widget as DesignValidationWidget);
    return {
      uid: widget.uid,
      type: widget.type,
      fieldName: String(widget.getSoul?.()?.name || widget.uid || ''),
      options: {
        'amount-case': widget.getOption?.('amount-case') ?? widget.field?.meta?.extra?.amountCase,
        'related-lower-amount': widget.getOption?.('related-lower-amount')
          ?? buildValidationOptionFieldUID(widget.field?.meta?.extra?.relatedLowerAmount),
        connectionTable: widget.getOption?.('connectionTable')
          ?? buildValidationConnectionTableUID(widget.field?.meta?.extra?.connectionTableUID),
        'select-search-form': widget.getOption?.('select-search-form')
          ?? buildValidationConnectionTableUID(widget.field?.meta?.extra?.selectSearchFormUID),
        'select-choices-type': widget.getOption?.('select-choices-type'),
        'treeselect-value-text-option': widget.getOption?.('treeselect-value-text-option'),
        'other-table-field': widget.getOption?.('other-table-field')
          ?? buildValidationOptionFieldUID(widget.field?.meta?.extra?.otherTableFieldUID),
        'radiogroup-value-text-color-option': widget.getOption?.('radiogroup-value-text-color-option'),
        'checkbox-option': widget.getOption?.('checkbox-option'),
        'compute-type': widget.getOption?.('compute-type') ?? widget.field?.meta?.extra?.computeType,
        'compute-formula': widget.getOption?.('compute-formula') ?? widget.field?.meta?.extra?.formula,
      },
      widgets: buildValidationWidgetSnapshots(children),
    };
  });
}

const collectCurrentDesignValidationIssues = () => {
  const connections = getBoardConnections();
  return collectFormDesignValidationIssues({
    widgets: buildValidationWidgetSnapshots((formWidget.value?.widgets || []) as FormElement[]),
    selectedTables: buildSelectedTableSet(connections),
    selectedFields: buildSelectedFieldSet(connections),
  });
}

const hasDisplayedDesignValidationErrors = () => {
  let hasValidationError = false;
  walkWidgets((formWidget.value?.widgets || []) as FormElement[], (widget) => {
    if (widget.validationError) {
      hasValidationError = true;
    }
  });
  return hasValidationError;
}

const refreshDisplayedDesignValidationErrors = () => {
  if (!hasDisplayedDesignValidationErrors()) return;
  applyDesignValidationIssues(collectCurrentDesignValidationIssues());
}

const buildDesignValidationIssues = () => {
  return collectCurrentDesignValidationIssues()
    .map((issue) => {
      const widget = getAiWidgetById(issue.widgetId) as unknown as FormElement;
      return widget
        ? {
          widget,
          message: issue.message,
          issue,
        }
        : null;
    })
    .filter(Boolean) as DesignValidationIssue[];
}

const applyDesignValidationIssues = (issues: FormDesignValidationIssue[] = []) => {
  clearDesignValidationErrors();
  const restoredIssues = issues
    .map((issue) => {
      const widget = getAiWidgetById(issue.widgetId) as unknown as FormElement | undefined;
      return widget
        ? {
          widget,
          message: issue.message,
          issue,
        }
        : null;
    })
    .filter(Boolean) as DesignValidationIssue[];

  restoredIssues.forEach(({ widget, message }) => {
    widget.validationError = new Error(message);
  });

  console.log('[design-validation][form-designer][apply]', {
    requestedIssueCount: issues.length,
    restoredIssueCount: restoredIssues.length,
    requestedWidgetIds: issues.map(item => item.widgetId),
    restoredWidgetIds: restoredIssues.map(item => item.widget.uid),
  });

  return restoredIssues;
}

const validateBeforeSave = async () => {
  clearDesignValidationErrors();
  const issues = buildDesignValidationIssues();
  if (!issues.length) return true;

  issues.forEach(({ widget, message }) => {
    widget.validationError = new Error(message);
  });

  const firstIssue = issues[0];
  selectedWidgets.value = [firstIssue.widget];
  await firstIssue.widget.intoView?.();
  // 配置不完整只提示（字段已标红并定位），不再阻断保存
  ElMessage.warning(i18next.t('FormDesigner.designConfigInvalid', { count: issues.length }));
  return true;
}

const restoreDesignValidationErrors = (issues?: FormDesignValidationIssue[]) => {
  if (Array.isArray(issues) && issues.length > 0) {
    return applyDesignValidationIssues(issues);
  }
  return applyDesignValidationIssues(collectCurrentDesignValidationIssues());
}

const deleteAiField = (input: { widgetId: string }) => {
  const widget = getAiWidgetById(input?.widgetId);
  if (!widget) {
    throw new Error(i18next.t('FormDesigner.fieldNotFound', { fieldId: input?.widgetId || '' }));
  }
  if (widget.uid === formWidget.value?.uid) {
    throw new Error(i18next.t('FormDesigner.cannotDeleteFormRoot'));
  }

  const widgetName = String(widget.getSoul?.()?.name || widget.defaultName || widget.type || '').trim();
  const widgetType = String(widget.type || '').trim();
  const widgetId = widget.uid;
  removeWidgetIntoRecycleBinById(widgetId);
  selectedWidgets.value = formWidget.value ? [formWidget.value] : [];

  return {
    widgetId,
    name: widgetName,
    widgetType,
    deleted: true,
    recycleBin: true,
  };
}

defineExpose({
  get formChanged() {
    return formChanged.value;
  },
  get changeRevision() {
    return formChangeRevision.value;
  },
  init,
  resetChangeTracking,
  getDesignValidationIssues() {
    return collectCurrentDesignValidationIssues();
  },
  restoreDesignValidationErrors(issues?: FormDesignValidationIssue[]) {
    return restoreDesignValidationErrors(issues);
  },
  async focusDesignValidationIssue(
    issue: FormDesignValidationIssue,
    highlight?: { optionPath?: string[] },
  ) {
    const widget = getAiWidgetById(issue.widgetId) as unknown as unknown as FormElement | undefined;
    if (!widget) return false;
    selectedWidgets.value = [widget];
    widget.validationError = new Error(issue.message);
    await widget.intoView?.();
    await activateDesignValidationIssueHighlight(widget, issue, highlight);
    return true;
  },
  async clear() {
    clearDesignValidationIssueHighlight();
    selectedWidgets.value = [];
    resetChangeTracking();
    formWidget.value?.destroy();
    formWidget.value = null;
    await nextTick();
  },
  getAiFormSummary() {
    return {
      tableId: table.value?.uid || '',
      tableName: table.value?.alias || '',
      draftRevision: formChangeRevision.value,
      selectedWidgetId: activeWidget.value?.uid === formWidget.value?.uid ? '' : activeWidget.value?.uid || '',
      widgets: formWidget.value?.widgets?.map(widget => serializeAiWidgetTree(widget as Widget)) || [],
      availableWidgetTypes: getAiAvailableWidgetTypes(),
    };
  },
  getAiDefaultFormulaTaskContext() {
    return buildAiDefaultFormulaTaskContext();
  },
  async openAiFormulaPanel(input: { widgetId: string }) {
    const widget = getAiWidgetById(input?.widgetId) as unknown as FormElement | undefined;
    if (!widget) {
      throw new Error(i18next.t('FormDesigner.fieldNotFound', { fieldId: input?.widgetId || '' }));
    }
    selectedWidgets.value = [widget];
    if (!isWidgetInDesignerView(widget)) {
      await widget.intoView?.();
    }
    emit('update:property-panel-visible', true);
    await nextTick();
    syncPropertyPanelPosition();
    return {
      widget,
      widgetId: widget.uid,
      widgetType: widget.type,
      name: String(widget.getSoul?.()?.name || widget.name || widget.uid || '').trim(),
      defaultFormula: widget.getOption?.('default-formula'),
      computeFormula: widget.getOption?.('compute-formula'),
      includeSelf: widget.getOption?.('includeSelf'),
      isLimitSubform: widget.getOption?.('isLimitSubform'),
    };
  },
  getAiWidgetOptionSchema(input: { widgetId: string }) {
    const widget = getAiWidgetById(input?.widgetId);
    if (!widget) {
      throw new Error(i18next.t('FormDesigner.fieldNotFound', { fieldId: input?.widgetId || '' }));
    }
    const parsedOptions = widget.getParsedOptions()?.style || [];
    const groups = parsedOptions
      .filter(group => isAiVisible(group.visible, widget))
      .map(group => ({
        group: group.group,
        label: group.alias || group.group,
        type: group.type,
        options: [
          ...(group.type === 'boolean' ? [{
            key: group.group,
            path: [group.group],
            label: group.alias || group.group,
            type: 'boolean',
            currentValue: widget.getOption(group.group),
            hasDynamicChoices: false,
          }] : []),
          ...collectAiOptionItems(widget, group.children || [], []),
        ],
      }))
      .filter(group => group.options.length > 0);
    return {
      widgetId: widget.uid,
      widgetType: widget.type,
      groups,
    };
  },
  getAiWidgetOptionChoices(input: { widgetId: string; optionKey?: string; optionPath?: string[] }) {
    const widget = getAiWidgetById(input?.widgetId);
    if (!widget) {
      throw new Error(i18next.t('FormDesigner.fieldNotFound', { fieldId: input?.widgetId || '' }));
    }
    const paths = Array.isArray(input?.optionPath) && input.optionPath.length
      ? input.optionPath
      : [String(input?.optionKey || '').trim()].filter(Boolean);
    if (!paths.length) {
      throw new Error(i18next.t('FormDesigner.optionPathMissing'));
    }
    return {
      widgetId: widget.uid,
      optionPath: paths,
      choices: resolveAiSelectChoices(widget, paths),
    };
  },
  async addAiFields(input: { fields: Array<Record<string, any>> }) {
    const created: Array<Record<string, any>> = [];
    const failed: Array<Record<string, any>> = [];
    for (const field of input?.fields || []) {
      try {
        const widgetType = resolveAiWidgetType(field.widgetType);
        if (!widgetType) {
          throw new Error(i18next.t('FormDesigner.invalidFieldType', { widgetType: field.widgetType || '' }));
        }
        const containerRef = resolveAiContainer(field.containerWidgetId);
        const containerWidgets = Array.isArray((containerRef as any)?.widgets) ? (containerRef as any).widgets : [];
        let index = containerWidgets.length;
        if (field.afterWidgetId) {
          const afterIndex = containerWidgets.findIndex(item => item.uid === field.afterWidgetId);
          if (afterIndex > -1) {
            index = afterIndex + 1;
          }
        }
        const widget = await (containerRef as any)?.addWidget({
          uid: unique(),
          type: widgetType,
          name: field.name,
        }, index);
        if (!widget) {
          throw new Error(i18next.t('FormDesigner.fieldCreateFailed', { fieldName: field.name || widgetType }));
        }
        const fieldName = String(widget.getSoul?.()?.name || field.name || '').trim();
        const currentValidationFormat = normalizeAiValidationFormat(
          widget.getOption?.(['validation-format']),
        );
        const validationFormat = inferAiValidationFormat(
          fieldName,
          currentValidationFormat,
        );
        if (
          validationFormat
          && widget.hasOption?.(['validation-format'])
          && !currentValidationFormat
        ) {
          widget.setOption(['validation-format'], validationFormat);
        }
        selectedWidgets.value = [widget as FormElement];
        created.push({
          requestId: field.requestId || '',
          widgetId: widget.uid,
          widgetType: widget.type,
          name: widget.getSoul()?.name || field.name,
        });
      } catch (error) {
        failed.push({
          requestId: field.requestId || '',
          widgetType: field.widgetType,
          name: field.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if (created.length) {
      markFormChanged();
    }
    return {
      created,
      failed,
    };
  },
  replaceAiField,
  deleteAiField,
  setAiFieldOptions(input: { widgetId: string; changes: Array<Record<string, any>> }) {
    const widget = getAiWidgetById(input?.widgetId);
    if (!widget) {
      throw new Error(i18next.t('FormDesigner.fieldNotFound', { fieldId: input?.widgetId || '' }));
    }
    const applied = [];
    const formulaUpdates = [];
    const normalizedChanges = rewriteAiFormulaFieldOptionChanges(widget, input?.changes || []);
    let hasActualChanges = false;
    for (const change of normalizedChanges) {
      const paths = normalizeAiFieldOptionPath(change);
      if (!paths.length) {
        throw new Error(i18next.t('FormDesigner.optionChangePathMissing'));
      }
      if (!widget.hasOption(paths)) {
        throw new Error(i18next.t('FormDesigner.optionUnsupported', { fieldId: widget.uid, optionPath: paths.join('.') }));
      }
      const previousValue = widget.getOption(paths);
      if (change?.unset) {
        widget.unsetOption(paths);
      } else {
        assertAiOptionValueEnabled(widget, paths, change?.value);
        widget.setOption(paths, change?.value);
      }
      const nextValue = widget.getOption(paths);
      if (JSON.stringify(previousValue) !== JSON.stringify(nextValue)) {
        hasActualChanges = true;
      }
      applied.push({
        path: paths,
      });
      const formulaUpdate = resolveAiFormulaUpdateItem(widget, paths, change);
      if (formulaUpdate) {
        formulaUpdates.push(formulaUpdate);
      }
    }
    if (hasActualChanges) {
      markFormChanged();
    }
    selectedWidgets.value = [widget as unknown as FormElement];
    return {
      widgetId: widget.uid,
      tableId: table.value?.uid || '',
      tableName: table.value?.alias || '',
      name: String(widget.getSoul?.()?.name || widget.name || widget.uid || '').trim(),
      applied,
      formulaUpdates,
    };
  },
  async save(formOptions: FormOptions, options: { beforeWrite?: () => void } = {}) {
    if (!await validateBeforeSave()) {
      return null;
    }
    return await persistFormStructure({
      formOptions,
      clearFormChanged: true,
      beforeWrite: options.beforeWrite,
    });
  },
  async saveDraft(formOptions: FormOptions, options: { beforeWrite?: () => void } = {}) {
    return await persistFormStructure({
      formOptions,
      clearFormChanged: false,
      beforeWrite: options.beforeWrite,
    });
  },
  openRecycleBin() {
    handleOpenRecycleBinDrawer(true);
  }
});

const isExistContainer = ref(false);
provideIsExistContainer(isExistContainer);
provideDraggableIndex(draggableIndex);
provideFormWidget(formWidget);
provideRenderWidgets(renderWidgets);
provide(ACTIVE_WIDGET, activeWidget);
provide(ACTIVE_ELEMENT, activeElement);
provide(SELECTED_WIDGETS, selectedWidgets);
const reportId = inject(REPORT_ID);
provide(PROJECT_ID, reportId);
provideFormWidgetRows(formWidgetRows);
provideIsDrag(isDrag);
providePointerDrag(pointerDrag);
providePointerDragClickSuppressed(pointerDragClickSuppressed);

const visible = ref(true);
provide(VISIBLE, visible as any);
const hoverWidget: ShallowRef<Widget> = shallowRef();
provide(HOVER_WIDGET, hoverWidget);
provide(FORM_DESIGNER_BLUEPRINT_APPLYING_READONLY, toRef(props, 'blueprintApplyingReadonly'));
const hasWidgetMounted = ref(false);
provide(HAS_WIDGET_MOUNTED, hasWidgetMounted);
provide(ACTIVE_WIDGET, activeElement);
provide(HANDLE_INTO_FIELD_RECYCLE_BIN_KEY, handleIntoRecycleBin);
provide(OPEN_FORM_DESIGNER_PROPERTY_PANEL, () => {
  if (props.blueprintApplyingReadonly) {
    return;
  }
  if (!props.propertyPanelVisible) {
    emit('update:property-panel-visible', true);
    return;
  }
  nextTick(() => {
    syncPropertyPanelPosition();
  });
});
</script>

<style lang='scss' scoped>
.form-designer {
  overflow: hidden;
  height: 100%;
  width: 100%;
  position: relative;

  &.has-pinned-panel {
    gap: 12px;
  }

  .form-designer-readonly-tip {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 30;
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid rgba(8, 115, 255, 0.12);
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 8px 24px rgba(29, 33, 41, 0.12);
    color: #1d2129;
    font-size: 12px;
    line-height: 18px;
    font-weight: 500;
    pointer-events: none;
  }
  
  .designer {
    flex: 1 1 0;
    background-color: var(--bg-color);
    position: relative;
    z-index: 1;
    min-width: 0;
    padding: 0;
    .header {
      height: 35px;
      color: var(--text-color-primary);

      .title {
        font-size: 17px;
        font-weight: 700 !important;
        padding-left: 12px !important;
      }
    }
  }

  .form-designer-floating-panel {
    position: absolute;
    z-index: 20;
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    border-radius: 12px;
    border: 1px solid #e5e6eb;
    background: #fff;
    box-shadow: 0 12px 32px rgba(29, 33, 41, 0.12), 0 4px 12px rgba(29, 33, 41, 0.08);
    overflow: hidden;

    &.is-pinned {
      position: relative !important;
      top: auto;
      left: auto;
      flex: none;
      height: 100% !important;
      transform: none !important;
      z-index: auto !important;
    }
  }

  .form-designer-floating-panel__header {
    height: 44px;
    padding: 0 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    border-bottom: 1px solid #f2f3f5;
    color: #1d2129;
    font-size: 14px;
    font-weight: 600;
    line-height: 22px;
    background: #fff;

    &.is-draggable {
      cursor: move;
      user-select: none;
    }
  }

  .form-designer-floating-panel__title {
    min-width: 0;
    flex: 1;
  }

  .form-designer-floating-panel__pin,
  .form-designer-floating-panel__close {
    width: 24px;
    height: 24px;
    border: none;
    outline: none;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #4e5969;
    background: transparent;
    cursor: pointer;
    transition: background-color 0.18s ease, color 0.18s ease;

    &:hover {
      color: #1d2129;
      background-color: #f2f3f5;
    }
  }

  .form-designer-floating-panel__pin img {
    width: 14px;
    height: 14px;
  }

  .form-designer-floating-panel__body {
    flex: 1;
    min-height: 0;
    display: flex;
    overflow: hidden;

    :deep(.left.floating) {
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
  }

  .field-catalog-panel {
    top: 0;
    left: 0;
    width: 260px;
    max-height: 100%;
    display: flex;
    flex-direction: column;

    &.is-pinned {
      max-height: none;
    }
  }

  .property-panel {
    top: 0;
    left: 0;
    max-width: calc(100% - 32px);
    height: 100%;
    max-height: 100%;
    display: flex;
    flex-direction: column;
  }

  .form-designer-floating-panel__header--property {
    padding: 0 8px 0 0;
  }

  .form-designer-floating-panel__body--property {
    :deep(.right.floating) {
      flex: 1;
      min-height: 0;
      height: 100%;
    }
  }

  .form-designer-floating-panel__breadcrumbs.bread-crumbs {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0 12px;
    border-bottom: none;
  }

  &.is-blueprint-applying-readonly {
    user-select: none;

    .form-designer-floating-panel {
      pointer-events: none;
    }

    .designer {
      cursor: default;
    }

    .designer :deep(*) {
      user-select: none !important;
    }

    .designer :deep(.el-form-item) {
      pointer-events: none !important;
    }

    .designer :deep(.el-form-item.hover) {
      outline: none !important;
    }

    .designer :deep(.el-form-item.hover .icon) {
      visibility: hidden !important;
      opacity: 0 !important;
      box-shadow: none !important;
    }

    .designer :deep(.widget),
    .designer :deep(.widget-item),
    .designer :deep(.widget-form),
    .designer :deep(.widget-container),
    .designer :deep(.widget-wrap),
    .designer :deep(.designer-widget-control-wrap),
    .designer :deep(.right.floating),
    .designer :deep(.left.floating),
    .designer :deep(.bread-crumbs),
    .designer :deep([data-widget-uid]) {
      pointer-events: none !important;
    }
  }

  &.is-pointer-dragging {
    .field-catalog-panel,
    .property-panel {
      pointer-events: none;
    }
  }
  
  :deep(.field-recycle-bin-drawer) {
    height: 80% !important;
    border-radius: 8px;
    display: flex;

    .el-drawer__header {
      height: 48px;
      margin-bottom: 0;
      padding: 12px 20px;
      font-size: 16px;
      line-height: 24px;
      border-bottom: 1px solid #e5e6eb;
      background-color: #fff;
      border-radius: 8px 8px 0 0;

      .el-drawer__title {
        display: flex;
        justify-content: center;
      }
    }

    .el-drawer__body {
      background-color: #f2f3f5;
      padding: 0;
      flex: 1;

      .field-recycle-bin-wrapper {
        background-color: #fff;
        height: 100%;
        width: 54%;
        margin: 0 auto;
        padding: 12px 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        .clear-field-recycle-header {
          display: flex;
          justify-content: space-between;
          height: 32px;
          .clear-field-recycle-btn {
            border-radius: 4px;
            padding: 5px 8px;
            .el-icon {
              margin-right: 4px;
            }
          }
        }

        .field-recycle-bin-table {
          border-radius: 5px;
          flex: 1;
          
          .el-scrollbar__view {
            height: 100%;
            .el-table__body {
              .el-table__row {
                background-color: #fff;
              }
            }
          }
          .el-table__empty-text {

          }
          .operation-btn {
            display: flex;
            gap: 12px;
            align-items: center;
            .divider {
              width: 1px;
              height: 12px;
              background-color: #E5E6EB;
            }
          }
        }

        .page-container {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          height: 32px;

          .el-select {
            width: 102px;

            .el-select__wrapper {
              min-height: 32px;
              width: 102px;
              border-radius: 4px;
            }
          }

          .el-pager {
            .is-active {
              background-color: var(--color-primary);
              color: var(--color-white);
            }

            li {
              min-width: 32px;
              height: 32px;
            }
          }

          .btn-prev {
            margin: 0px;
          }

          .el-pagination__total {
            color: #86909C;
          }
        }
      }
    }
  }

  :deep(.field-recycle-bin-drawer.is-blueprint-applying-readonly) {
    user-select: none;

    .el-drawer__body * {
      user-select: none !important;
    }

    .el-drawer__body .clear-field-recycle-btn,
    .el-drawer__body .el-table,
    .el-drawer__body .operation-btn,
    .el-drawer__body .el-pagination {
      pointer-events: none !important;
    }
  }
}
</style>
