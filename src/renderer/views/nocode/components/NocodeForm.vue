<template>
  <div
    class="nocode-form"
    ref="nocodeFormRef"
    v-loading="showLoading && !initSuccessed"
    element-loading-custom-class="detail-loading-mask"
    :element-loading-text="$t('NocodeForm.loading')"
    @input.capture="markFormUserEdited"
    @change.capture="markFormUserEdited"
    @click.capture="handleFormClick"
  >
    <div class="empty-form-bg" v-if="isFormEmpty">
      <img src="@renderer/assets/image/nocode/empty-form.png" />
      <div class="tip">{{ $t('NocodeForm.formEmpty') }}</div>
    </div>
    <b2-board :board="board" :isViewing="true" type="normal" v-if="board" />
    <teleport to="body">
      <div class="submit-validation-notice-dialog">
        <el-dialog
          v-model="submitValidationDialogVisible"
          :title="$t('NocodeForm.submitValidationNoticeTitle')"
          width="420px"
          align-center
          :close-on-click-modal="false"
          @close="handleSubmitValidationDialogCancel"
        >
          <div class="submit-validation-notice-dialog__body">
            <el-icon class="submit-validation-notice-dialog__icon">
              <i-ep-warning-filled />
            </el-icon>
            <div class="submit-validation-notice-dialog__messages">
              <div
                v-for="(message, index) in submitValidationDialogMessages"
                :key="`${index}-${message}`"
                class="submit-validation-notice-dialog__message"
              >
                {{ index + 1 }}. {{ message }}
              </div>
            </div>
          </div>
          <template #footer>
            <div class="submit-validation-notice-dialog__footer">
              <el-button @click="handleSubmitValidationDialogCancel">
                {{ $t('NocodeForm.submitValidationNoticeCancel') }}
              </el-button>
              <el-button type="primary" @click="handleSubmitValidationDialogConfirm">
                {{ $t('NocodeForm.submitValidationNoticeConfirm') }}
              </el-button>
            </div>
          </template>
        </el-dialog>
      </div>
    </teleport>
    <tip-dialog
      ref="submitSignSyncConflictDialogRef"
      :title="$t('NocodeForm.submitSignSyncConflictTitle')"
      :content="$t('NocodeForm.submitSignSyncConflictContent')"
      :confirmText="$t('NocodeForm.submitSignSyncConflictConfirm')"
      :showClose="false"
      :showCancelButton="false"
      :closeOnClickModal="false"
    />
  </div>
</template>

<script setup lang='ts'>
import { ref, provide, computed, onMounted, onBeforeUnmount, nextTick, watch, inject } from 'vue';
import axios from 'axios';
import { ExecuteViewActionEditContext, FieldAuthValue, NocodeBody, NocodeFormData, ViewActionFieldId } from '@common/types/nocode';
import { BoardSoul, Connection, ConnectionData, DataChangeType, Field, FormSubmitAllowNoticeMode, NocodeProcess, OptionFieldUID, OptionTableUID, ProcessNodeType, Row, Table, TableUID, WhereCondition } from "@common/types/project";
import { deepClone, isEmpty, equals } from '@common/utils/object';
import { SystemField } from '@common/utils/connection';
import { usePassportStore } from '@renderer/stores/passport';
import { Account } from '@common/types/account';
import { ProjectContext, FormLinkageRule, LogicalOperator, FormLinkageCondition, SelectIdOfForm } from '@renderer/b2/types';
import { Board } from '@renderer/b2/controllers/board';
import { AbstractForm, FormElement } from '@renderer/b2/controllers/form';
import { Widget } from '@renderer/b2/controllers/widget';
import { WidgetSoul, ProjectBody } from '@common/types/project';
import { ACTIVE_BOARD, ACTIVE_BOARD_ID, ACTIVE_CONTAINER, ALL_BOARD, ALL_BOARD_DOM, CO_EDITING_ACCOUNTS, CUR_CO_EDITING_ACCOUNT, EDIT_BOARD_MODULE, FORE_BACK_ZOOM_X_Y, HAS_WIDGET_MOUNTED, HOVER_WIDGET, IS_MOBILE_FULLSCREEN, IS_WEB_SHARE, ORGANIZE_UTIL, NOCODE, PROJECT, PROJECT_ID, PROJECT_TABLE_DRAGGING, SELECTED_WIDGETS, VISIBLE, FormMode } from '@renderer/types';
import { storeFactory, useRuntime } from '@renderer/utils';
import { unique } from "@common/utils/unique";
import { buildTree, formDataApi, formFlowApi, OrganizeUtil } from '@renderer/views/nocode/utils';
import { ElMessage } from 'element-plus';
import { getUUIDSystemField } from '@common/utils';
import { isDataChangeTriggerStashEnabled } from '@common/utils';
import { buildFormFieldDefaultValueMap, buildFormFieldElementUidMap, buildMergedFormFieldsAuth, buildMergedFormRequiredAuth, filterEditableViewActionFieldIds, hydrateSubformParentDefaultRows } from './formFieldAuth';
import { useRoute } from 'vue-router';
import { useFormMode } from './global/table/hooks';
import { FormTableRuntime } from "@common/types/nocode";
import { isMobile } from "@renderer/utils";
import { usePreRow } from '../views/editor/form/hooks';
import i18next from 'i18next';
import TipDialog from '@renderer/views/nocode/dialog/TipDialog.vue';
import { getBoardConnectionsByNocodeBody, getNocodeDataSourceByUID } from '@common/utils/connection';
import {
  buildBoardConnectionsWithAggregateTables,
  type AggregateRuntimeSource,
} from '@renderer/utils/aggregateTable';
import {
  extendConnectionsWithTableAggregateFields,
  mergeBucketsWithTableAggregateFields,
  type TableAggregateRuntimeSource,
} from '@renderer/utils/tableAggregateField';
import { collectFormulaFields, getFormulaStr, rowsDefaultValueCalculation } from '@common/utils/formula';
import { getCopyContext, getCopyContextCalculationFields, getTableCalculationFields, stripCopyTransientState } from '@renderer/views/nocode/components/global/table/copy';
import { calculateAggregation } from '@renderer/utils/autoCompute';
import { canReadNocodeTableDataByBody, isPublicDataPermissionBypassedRoute } from '../utils/data-permission';
import { FormWidgetType } from '@common/types/nocode';
import { resolveHiddenOrganizeAutoFillSubmitValue, type RecalculateHiddenFieldOptions, type StabilizeHiddenFieldSubmitRowOptions } from '@renderer/b2/utils/hiddenFieldSubmitRuntime';
import { buildHiddenFieldLinkageRowsQuery, buildLinkageConditionValuesFromRow, resolveHiddenFieldLinkageSubmitValue } from '@renderer/b2/utils/hiddenFieldLinkageSubmit';
import { getLinkageFillData, getLinkageFillValue } from '@common/utils/linkage-fill';
import { getHiddenFieldSubmitMode, HiddenFieldSubmitMode } from '@common/utils/hiddenFieldSubmitPolicy';
import {
  buildSelectedFieldSet,
  buildSelectedTableSet,
  collectFormDesignValidationIssues,
  type FormDesignValidationWidgetSnapshot,
} from '../views/editor/form/designValidation';
import {
  applyOrganizeFieldRuntimeDefaultToRow,
  hasOrganizeFieldRuntimeDefaultValue,
  resolveOrganizeFieldRuntimeDefaultValue,
} from './organizeFieldDefaultValue';
import { captureStableFormSnapshot, createFormSnapshot, isSameFormSnapshot } from './formSnapshot';
import {
  buildTopLevelLinkageSubTableRowsQuery,
  collectTopLevelLinkageConditionWidgetIds,
  hasInitialLinkageTriggerValue,
  matchTopLevelLinkageCondition,
  replayTopLevelLinkageRules,
} from './topLevelLinkageReplay';
import { createWorkbenchAiFormFillRuntime } from '@renderer/views/nocode/utils/workbenchAiFormFillRuntime';
import {
  WORKBENCH_AI_FORM_FILL_CONTEXT,
  WORKBENCH_AI_FORM_FILL_SCOPE,
  type WorkbenchAiFormFillHost,
} from '@renderer/views/nocode/views/workbench/AI/workbenchAiFormFillContext';

const props = defineProps<{
  nocodeId: string;
  nocodeSign?: string;
  tableUID: OptionTableUID;
  isPreview?: boolean;
  uuid?: string;
  flowId?: string;
  isViewing?: boolean;
  row?: Row;
  hiddenWidgets?: string[]; // 要隐藏的组件
  widthRatio?: number;
  visibleFieldIds?: ViewActionFieldId[];
  memberFieldsAuth?: Record<string, FieldAuthValue> | "all";
  fieldsAuth?: Record<string, FieldAuthValue> | "all";
  requiredFieldsAuth?: Record<string, boolean>;
  viewActionContext?: ExecuteViewActionEditContext;
  relatedDetailHandler?: (payload: {
    relatedTableUID: OptionTableUID;
    uuid: string;
    row?: Row | null;
    fieldUID?: string;
    sourceContext?: {
      nocodeId: string;
      tableUID?: OptionTableUID;
      formData?: NocodeBody['formData'];
      otherDataSources?: NocodeBody['otherDataSources'];
    };
  }) => void;
  bootstrapData?: {
    formData: NocodeFormData,
    otherDataSources?: NocodeBody["otherDataSources"],
    otherDataSourceSchemas?: NocodeBody["otherDataSourceSchemas"],
    settings?: NocodeBody["settings"],
    fieldsAuth?: Record<string, FieldAuthValue> | "all",
  };
  permissionContextOverride?: {
    nocodeBody?: NocodeBody,
    getPermissionBody?: (tableId?: string) => Pick<NocodeBody, "permissions"> | NocodeBody | undefined,
  };
  showLoading?: boolean;
}>();

const emit = defineEmits<{
  (event: "ready", payload: {
    table?: Table;
    formData?: NocodeFormData;
    otherDataSources?: NocodeBody["otherDataSources"];
  }): void;
}>();

const preRow = usePreRow();
const route = useRoute();
const isPublicVisit = computed(() => isPublicDataPermissionBypassedRoute(route));
const isPreview = computed(() => props.isPreview || route.query.isPreview as string);
let nocodeId = props.nocodeId || route.query?.nocodeId as string;
let tableUID = props.tableUID || JSON.parse(decodeURIComponent(route.query?.tableUID as string)) as OptionTableUID;
let uuid = props.uuid || route.query?.uuid as string;
const flowId = computed(() => props.flowId || route.query?.flowId as string);
const projectOpenRelatedDetail = props.relatedDetailHandler
  ? (payload: {
    relatedTableUID: OptionTableUID;
    uuid: string;
    row?: Row | null;
    fieldUID?: string;
    sourceContext?: {
      nocodeId: string;
      tableUID?: OptionTableUID;
      formData?: NocodeBody['formData'];
      otherDataSources?: NocodeBody['otherDataSources'];
    };
  }) => {
    const bodyData = getNocodeBodyData();
    props.relatedDetailHandler?.({
      ...payload,
      sourceContext: payload.sourceContext || {
        nocodeId,
        tableUID,
        formData: bodyData?.formData,
        otherDataSources: bodyData?.otherDataSources || [],
      },
    });
  }
  : undefined;

const nocode = inject(NOCODE, null);
const currentNocodeId = computed(() => nocode?.value?.meta?.id);
const isCurrentNocode = computed(() => currentNocodeId.value === nocodeId);
const targetNocodeSign = ref(props.nocodeSign);
const nocodeSignMap = ref<Record<string, string>>({});
const submitSignSyncConflictDialogRef = ref();
watch(() => props.nocodeSign, (value) => {
  if (value) {
    targetNocodeSign.value = value;
    nocodeSignMap.value[nocodeId] = value;
  }
}, { immediate: true });

const getNocodeSignById = (targetId = nocodeId) => {
  if (!targetId) return "";
  if (targetId === currentNocodeId.value) {
    return nocode?.value?.body?.sign || nocodeSignMap.value[targetId] || "";
  }
  if (targetId === nocodeId) {
    return targetNocodeSign.value || nocodeSignMap.value[targetId] || "";
  }
  return nocodeSignMap.value[targetId] || "";
};

const getTargetNocodeSign = (targetId = nocodeId) => {
  return getNocodeSignById(targetId);
};

const updateMainSign = (sign: string, targetId = nocodeId) => {
  if (!sign || !targetId) return;
  nocodeSignMap.value[targetId] = sign;
  if (targetId === nocodeId) {
    targetNocodeSign.value = sign;
  }
  if (targetId === currentNocodeId.value && nocode?.value?.body) {
    nocode.value.body.sign = sign;
  }
};

const fetchTargetNocodeSign = async (signal?: AbortSignal) => {
  return await axios.post(
    isPublicVisit.value ? "/project/get-public-nocode-sign" : "/project/get-nocode-sign",
    {
      nocodeId,
      rootTableUID: tableId.value,
    },
    signal ? { signal } : undefined,
  ).then(({ data }) => ({
    sourceNocodeId: data?.nocodeId || nocodeId,
    sign: data?.sign || "",
  })).catch(() => null);
};

const ensureTargetNocodeSign = async (signal?: AbortSignal) => {
  if (!nocodeId || getTargetNocodeSign()) return;
  const targetNocodeData = await fetchTargetNocodeSign(signal);
  if (targetNocodeData?.sign && targetNocodeData?.sourceNocodeId) {
    updateMainSign(targetNocodeData.sign, targetNocodeData.sourceNocodeId);
  }
};

const shouldValidateSubmitSignSync = () => {
  return !isPublicVisit.value;
};

type SubmitSignSyncConflictHandler = () => Promise<boolean | void> | boolean;

interface ConfirmSubmitBeforeMutationOptions {
  onSignSyncConflict?: SubmitSignSyncConflictHandler;
}

const validateSubmitSignSync = async () => {
  if (!shouldValidateSubmitSignSync()) return true;

  await ensureTargetNocodeSign();
  const requestSign = getTargetNocodeSign();
  if (!nocodeId || !requestSign) return true;

  return await axios.post("/project/validate-sync", {
    nocodeId,
  }, {
    headers: {
      "x-sign": requestSign,
    },
  }).then(({ data }) => {
    if (requestSign !== getTargetNocodeSign()) {
      return true;
    }
    return !!data;
  }).catch((err) => {
    console.warn("[NocodeForm] validate submit sign sync failed", err);
    return true;
  });
};

const reloadCurrentPage = () => {
  const currentHref = window.location.href;
  window.location.reload();
  window.setTimeout(() => {
    if (window.location.href === currentHref) {
      window.location.replace(currentHref);
    }
  }, 300);
};

const confirmSubmitWhenSignNotSynced = async (onSignSyncConflict?: SubmitSignSyncConflictHandler) => {
  const confirmed = await submitSignSyncConflictDialogRef.value?.confirm();
  if (confirmed !== true) {
    return false;
  }
  if (onSignSyncConflict) {
    try {
      const shouldReload = await onSignSyncConflict();
      if (shouldReload === false) {
        return false;
      }
    } catch (err) {
      console.warn("[NocodeForm] sign sync conflict handler failed", err);
      return false;
    }
  }
  reloadCurrentPage();
  return false;
};

const connectionId = computed(() => tableUID[0]);
const tableId = computed(() => tableUID[1]);

const board = ref<Board>();
const formData = ref<NocodeFormData>();
const otherDataSources = ref([]);
const otherDataSourceSchemas = ref<NocodeBody["otherDataSourceSchemas"]>([]);
const runtimeNocodeSettings = ref<NocodeBody["settings"]>();
const projectConnectionData = ref<ConnectionData>({});
const mergedConnectionData = ref<ConnectionData>({});
const table = ref<Table>();
const widget = ref<WidgetSoul>();
const nocodeFormRef = ref();
const formWidget = ref<AbstractForm>();
const initSuccessed = ref(false);
const initialRow = ref();
const hasFormUserEdited = ref(false);
const hiddenFields = ref<string[]>([]);
const submitValidationDialogVisible = ref(false);
const submitValidationDialogResolved = ref(false);
const submitValidationDialogResolver = ref<((value: boolean) => void) | null>(null);
const preparedSubmitRow = ref<object | null>(null);
const hasPreparedSubmitRow = ref(false);
const isSubmitting = ref(false);
const autoSubmitHandlers = ref<Array<(payload: { type: "fieldEnter" | "mobileScan"; fieldUid?: string; value?: any }) => void>>([]);
const workbenchAiFormFillContext = inject(WORKBENCH_AI_FORM_FILL_CONTEXT, null);
const workbenchAiFormFillScope = inject(WORKBENCH_AI_FORM_FILL_SCOPE, null);
let unregisterAiFormFillHost: (() => void) | null = null;
let initAbortController: AbortController | undefined;
let readyWatchStop: (() => void) | undefined;
let formDisposed = false;

const isInitActive = (controller = initAbortController) => {
  return Boolean(controller && controller === initAbortController && !formDisposed && !controller.signal.aborted);
};

const aiFormFillRuntime = createWorkbenchAiFormFillRuntime({
  get contextId() {
    return workbenchAiFormFillScope?.contextId.value || '';
  },
  get appId() {
    return String(nocodeId || '');
  },
  get appName() {
    return String(nocode?.value?.meta?.name || '');
  },
  get formMode() {
    return props.uuid ? 'edit' as const : 'add' as const;
  },
  getForm: () => formWidget.value,
  getTable: () => table.value,
  getFormData: () => formData.value,
  getWidgetElement: (formInput) => (Array.from(
    nocodeFormRef.value?.querySelectorAll('.b2widget') || [],
  ) as HTMLElement[]).find(element => element.getAttribute('uid') === formInput.uid),
  setWidgetValue: (formInput, value) => {
    formInput.trySetInputValue(value);
    if (formInput.getSoul?.().type === 'widget.form.subform') {
      syncCopyCalculatedWidgets([formInput], { [formInput.fieldId]: value });
    }
  },
});

const registerAiFormFillHost = () => {
  unregisterAiFormFillHost?.();
  unregisterAiFormFillHost = null;
  if (!workbenchAiFormFillContext || !workbenchAiFormFillScope?.active.value || !initSuccessed.value) return;
  const host: WorkbenchAiFormFillHost = {
    contextId: workbenchAiFormFillScope.contextId.value,
    getSnapshot: aiFormFillRuntime.getSnapshot,
    applyFill: aiFormFillRuntime.applyFill,
    undoFill: aiFormFillRuntime.undoFill,
  };
  unregisterAiFormFillHost = workbenchAiFormFillContext.registerForm(host);
};

watch(() => [
  workbenchAiFormFillScope?.active.value,
  workbenchAiFormFillScope?.contextId.value,
  initSuccessed.value,
], registerAiFormFillHost, { immediate: true, flush: 'post' });
onBeforeUnmount(() => {
  formDisposed = true;
  readyWatchStop?.();
  readyWatchStop = undefined;
  initAbortController?.abort();
  initAbortController = undefined;
  unregisterAiFormFillHost?.();
  unregisterAiFormFillHost = null;
  const currentBoard = board.value;
  board.value = undefined;
  formWidget.value = undefined;
  currentBoard?.destroy();
});

type VisibleFieldTreeNode = {
  all: boolean;
  children: Map<string, VisibleFieldTreeNode>;
}

const organizeUtil = new OrganizeUtil();
const passportState = usePassportStore();
const MEMBER_SELECT_WIDGET_TYPE = "widget.form.memberSelect";
type MemberSelectFormElement = FormElement & { allUserList: Account[] };

const getMemberSelectWidgets = () => {
  return ((formWidget.value?.allFormInputs || []).filter((formInput: FormElement) => {
    return formInput?.getSoul?.().type === MEMBER_SELECT_WIDGET_TYPE;
  }) || []) as MemberSelectFormElement[];
};

const syncMemberSelectAllUsers = async () => {
  const memberSelectWidgets = getMemberSelectWidgets();
  if (!memberSelectWidgets.length || !board.value) {
    return;
  }

  // 成员字段历史值回显需要完整成员列表，否则已离职成员会在组件内部被过滤掉。
  const allUsers = await board.value.getOrganizeUsers({ status: 'all' });
  memberSelectWidgets.forEach((memberSelectWidget) => {
    memberSelectWidget.allUserList = allUsers;
  });
};

const ensurePagePermissionContextReady = async () => {
  if (!organizeUtil.departments?.length) {
    await organizeUtil.getDepartments();
  }
};
const buildVisibleFieldTree = (fieldPaths: string[] = []) => {
  const root = new Map<string, VisibleFieldTreeNode>();
  for (const fieldPath of fieldPaths) {
    if (typeof fieldPath !== "string" || !fieldPath) continue;
    const segments = fieldPath.split(".").filter(Boolean);
    if (!segments.length) continue;

    let currentMap = root;
    for (let index = 0; index < segments.length; index++) {
      const segment = segments[index];
      let node = currentMap.get(segment);
      if (!node) {
        node = {
          all: false,
          children: new Map<string, VisibleFieldTreeNode>(),
        };
        currentMap.set(segment, node);
      }
      if (index === segments.length - 1) {
        node.all = true;
      } else {
        currentMap = node.children;
      }
    }
  }
  return root;
}

const collectForceHiddenFieldIds = (
  currentTable: Table,
  visibleTree: Map<string, VisibleFieldTreeNode>,
  path: string[] = [],
) => {
  const hiddenFieldIds = new Set<string>();

  for (const field of currentTable?.fields || []) {
    const fieldPath = [...path, field.uid].join(".");
    const node = visibleTree.get(field.uid);
    const subTableUID = field.meta?.extra?.subTableUID?.[1];

    if (!subTableUID) {
      if (!node?.all) {
        hiddenFieldIds.add(fieldPath);
      }
      continue;
    }

    if (!node) {
      hiddenFieldIds.add(fieldPath);
      continue;
    }

    if (node.all) {
      continue;
    }

    const subTable = formData.value?.tables?.find(item => item.uid === subTableUID);
    if (!subTable || !node.children.size) {
      hiddenFieldIds.add(fieldPath);
      continue;
    }

    const childHiddenFieldIds = collectForceHiddenFieldIds(subTable, node.children, [...path, field.uid]);
    if (childHiddenFieldIds.size >= (subTable.fields?.length || 0)) {
      hiddenFieldIds.add(fieldPath);
      continue;
    }

    childHiddenFieldIds.forEach(fieldId => hiddenFieldIds.add(fieldId));
  }

  return hiddenFieldIds;
}

const forceHiddenFieldIds = computed(() => {
  if (!table.value || isEmpty(effectiveVisibleFieldIds.value)) {
    return [];
  }

  return Array.from(collectForceHiddenFieldIds(
    table.value,
    buildVisibleFieldTree(effectiveVisibleFieldIds.value || []),
  ));
});

const syncForceHiddenFields = () => {
  formWidget.value?.setForceHiddenFields(forceHiddenFieldIds.value);
}

const syncForceShownFields = () => {
  formWidget.value?.setForceShownFields?.(effectiveVisibleFieldIds.value || []);
}

const syncForceShownPanel = async () => {
  if (!effectiveVisibleFieldIds.value?.length) return;
  await nextTick();
  const fieldElementUIDs = effectiveVisibleFieldIds.value
    .map(fieldId => fieldElementUidMap.value?.[String(fieldId)])
    .filter(Boolean);
  const targetFormInput = formWidget.value?.allFormInputs?.find((formInput: FormElement) => (
    fieldElementUIDs.includes(formInput.uid) && !formInput.isHidden
  ));
  if (!targetFormInput) return;

  let currentWidget: any = targetFormInput;
  let parentWidget: any = currentWidget.parent;
  while (parentWidget && parentWidget !== formWidget.value) {
    await parentWidget.bringChildIntoView?.(currentWidget);
    currentWidget = parentWidget;
    parentWidget = currentWidget.parent;
  }
  await nextTick();
}

const syncHiddenFields = () => {
  formWidget.value?.setHiddenFields(hiddenFields.value);
}

const syncSubmitFieldIds = () => {
  formWidget.value?.setSubmitFieldIds(submitFieldIds.value);
}

const getEffectiveSubmitFieldIds = () => {
  return formWidget.value?.getEffectiveSubmitFieldIds?.() || submitFieldIds.value;
}

// 详情接口返回完整数据，列表行只作为接口未返回字段的补充。
const mergeUuidDetailRow = (baseRow?: Row | null, responseRow?: Row | null) => {
  if (!responseRow) return baseRow ?? void 0;

  return {
    ...(baseRow || {}),
    ...responseRow,
  };
}

const migrateLegacySubformFillRules = (formSoul: WidgetSoul, connectionUID: string) => {
  const currentRules = (formSoul.options?.["fields-filling"] || []) as FormLinkageRule[];
  const currentFillWidgets = new Set(
    currentRules.flatMap(rule => rule.fillWidgets?.map(item => item.fillWidget).filter(Boolean) || [])
  );
  const legacyRules: FormLinkageRule[] = [];

  const visit = (soul?: WidgetSoul) => {
    if (!soul) return;

    if (soul.type === "widget.form.subform") {
      const legacyRule = soul.options?.["data-fill-rules"] as any;
      const isMultipleSubform = soul.options?.["data-origin"] === "multiple";
      const linkageSubFields = legacyRule?.fillWidgets?.filter(item => item?.fillWidget && item?.linkageWidget)?.map(item => ({
        fillWidget: item.fillWidget,
        linkageField: item.linkageWidget,
      })) || [];
      const legacyConnectionUID = legacyRule?.sourceConnectionUID || connectionUID;
      const existingRule = currentRules.find(rule =>
        rule?.fillWidgets?.some(item => item?.fillWidget === soul.uid) &&
        rule?.linkageTable?.[1] === legacyRule?.sourceTableUID
      );

      if (existingRule && legacyRule?.sourceConnectionUID && existingRule.linkageTable?.[0] !== legacyConnectionUID) {
        existingRule.linkageTable = [legacyConnectionUID, legacyRule.sourceTableUID];
      }

      if (!isMultipleSubform && legacyRule?.sourceTableUID && legacyRule?.conditions?.length && linkageSubFields.length && !currentFillWidgets.has(soul.uid)) {
        legacyRules.push({
          id: legacyRule.id || `legacy-fill-${soul.uid}`,
          linkageTable: [legacyConnectionUID, legacyRule.sourceTableUID],
          logic: legacyRule.logic || LogicalOperator.AND,
          conditions: legacyRule.conditions as any,
          fillWidgets: [{
            fillWidget: soul.uid,
            linkageField: undefined as any,
            linkageSubFields,
          }],
          subTableSetting: {
            logic: LogicalOperator.AND,
            conditions: [],
          },
        });
        currentFillWidgets.add(soul.uid);
      }
    }

    soul.widgets?.forEach(child => visit(child as WidgetSoul));
  };

  formSoul.widgets?.forEach(child => visit(child as WidgetSoul));

  if (legacyRules.length > 0) {
    formSoul.options = formSoul.options || {};
    formSoul.options["fields-filling"] = currentRules.concat(legacyRules);
  }
}

const isFormEmpty = computed(() => {
  if (!formWidget.value?.isReady()) return false;
  const formInputs = formWidget.value.formInputs || [];
  const visibleStaticWidgetTypes = [
    FormWidgetType.IMAGE_TEXT_SHOW,
    FormWidgetType.RICH_TEXT_EDITOR,
    FormWidgetType.MARKDOWN_EDITOR,
    FormWidgetType.SPLIT_LINE,
    FormWidgetType.TITLE_BAR,
  ];
  const hasVisibleStaticWidget = (formWidget.value.allFormInputs || []).some(child => (
    visibleStaticWidgetTypes.includes(child.type) && !child.isHidden
  ));
  if (hasVisibleStaticWidget) return false;
  if (formInputs.length) {
    return formInputs.every(child => child.isHidden);
  }
  return formWidget.value.children.length === 0;
});

const getValidationWidgetChildren = (widgetInput: FormElement & {
  widgets?: FormElement[]
  children?: FormElement[]
}): FormElement[] => (
  (widgetInput?.widgets || widgetInput?.children || []) as FormElement[]
);

const buildValidationOptionFieldUID = (value?: string[] | null) => (
  Array.isArray(value) && value.length >= 3 ? value.join('.') : undefined
);

const buildValidationConnectionTableUID = (value?: string[] | null) => (
  Array.isArray(value) && value.length >= 2 ? `${value[0]},${value[1]}` : undefined
);

const buildValidationWidgetSnapshots = (
  widgets: FormElement[] = [],
  widgetMap?: Map<string, FormElement>,
): FormDesignValidationWidgetSnapshot[] => (
  widgets.map((widgetItem) => {
    widgetMap?.set(widgetItem.uid, widgetItem);
    return {
      fieldName: String(widgetItem.getSoul?.()?.name || widgetItem.uid || ''),
      uid: widgetItem.uid,
      type: widgetItem.type,
      options: {
        'amount-case': widgetItem.getOption?.('amount-case') ?? widgetItem.field?.meta?.extra?.amountCase,
        'related-lower-amount': widgetItem.getOption?.('related-lower-amount')
          ?? buildValidationOptionFieldUID(widgetItem.field?.meta?.extra?.relatedLowerAmount),
        connectionTable: widgetItem.getOption?.('connectionTable')
          ?? buildValidationConnectionTableUID(widgetItem.field?.meta?.extra?.connectionTableUID),
        'select-search-form': widgetItem.getOption?.('select-search-form')
          ?? buildValidationConnectionTableUID(widgetItem.field?.meta?.extra?.selectSearchFormUID),
        'select-choices-type': widgetItem.getOption?.('select-choices-type'),
        'treeselect-value-text-option': widgetItem.getOption?.('treeselect-value-text-option'),
        'other-table-field': widgetItem.getOption?.('other-table-field')
          ?? buildValidationOptionFieldUID(widgetItem.field?.meta?.extra?.otherTableFieldUID),
        'radiogroup-value-text-color-option': widgetItem.getOption?.('radiogroup-value-text-color-option'),
        'checkbox-option': widgetItem.getOption?.('checkbox-option'),
        'compute-type': widgetItem.getOption?.('compute-type') ?? widgetItem.field?.meta?.extra?.computeType,
        'compute-formula': widgetItem.getOption?.('compute-formula') ?? widgetItem.field?.meta?.extra?.formula,
      },
      widgets: buildValidationWidgetSnapshots(getValidationWidgetChildren(widgetItem as FormElement & {
        widgets?: FormElement[]
        children?: FormElement[]
      }), widgetMap),
    };
  })
);

const clearFormDesignValidationErrors = (widgets: FormElement[] = []) => {
  widgets.forEach((widgetItem) => {
    widgetItem.validationError = null as unknown as Error;
    const children = getValidationWidgetChildren(widgetItem as FormElement & {
      widgets?: FormElement[]
      children?: FormElement[]
    });
    if (children.length > 0) {
      clearFormDesignValidationErrors(children);
    }
  });
};

const applyFormDesignValidationErrors = () => {
  const currentFormWidget = formWidget.value;
  if (!currentFormWidget || !table.value) return [];

  const validationWidgets = (currentFormWidget.widgets || []) as FormElement[];
  clearFormDesignValidationErrors(validationWidgets);
  const widgetSnapshotMap = new Map<string, FormElement>();
  const snapshotWidgets = buildValidationWidgetSnapshots(validationWidgets, widgetSnapshotMap);
  const issues = collectFormDesignValidationIssues({
    widgets: snapshotWidgets,
    selectedTables: buildSelectedTableSet(boardConnections.value),
    selectedFields: buildSelectedFieldSet(boardConnections.value),
  });
  const restoredIssues = issues
    .map((issue) => {
      const widgetItem = widgetSnapshotMap.get(issue.widgetId)
        || currentFormWidget.getChildElement(issue.widgetId) as FormElement | null;
      if (!widgetItem) return null;
      widgetItem.validationError = new Error(issue.message);
      return issue;
    })
    .filter(Boolean);
  return restoredIssues;
};

const mergedFieldsAuth = computed(() => buildMergedFormFieldsAuth({
  runtime,
  formData: formData.value,
  table: table.value,
  widget: widget.value,
  flowId: flowId.value,
  isViewing: props.isViewing,
  uuid,
  memberFieldAuth: fieldsAuth.value as any,
  flowFieldAuthOverride: props.fieldsAuth as any,
  disableTriggerDataChangeFallback: !!props.viewActionContext,
}));

const permissionFieldsAuth = computed(() => buildMergedFormFieldsAuth({
  // 单独计算成员字段权限；流程节点隐藏必须继续参与隐藏字段赋值策略。
  runtime,
  formData: formData.value,
  table: table.value,
  widget: widget.value,
  flowId: flowId.value,
  isViewing: props.isViewing,
  uuid,
  memberFieldAuth: fieldsAuth.value as any,
  flowFieldAuthOverride: "all",
  disableTriggerDataChangeFallback: true,
}));

const mergedRequiredFieldsAuth = computed(() => buildMergedFormRequiredAuth({
  runtime,
  formData: formData.value,
  table: table.value,
  widget: widget.value,
  flowId: flowId.value,
  isViewing: props.isViewing,
  uuid,
  flowRequiredAuthOverride: props.requiredFieldsAuth,
  disableTriggerDataChangeFallback: !!props.viewActionContext,
}));

const effectiveRequiredFieldsAuth = computed(() => mergedRequiredFieldsAuth.value);

const fieldElementUidMap = computed(() => {
  if (!formData.value || !table.value || !widget.value) {
    return {};
  }
  return buildFormFieldElementUidMap(formData.value, table.value.uid, widget.value);
});

const fieldDefaultValueMap = computed(() => {
  if (!formData.value || !table.value || !widget.value) {
    return {};
  }
  return buildFormFieldDefaultValueMap(formData.value, table.value.uid, widget.value);
});

const effectiveVisibleFieldIds = computed(() => {
  if (isEmpty(props.visibleFieldIds)) {
    return props.visibleFieldIds || [];
  }

  return filterEditableViewActionFieldIds(
    props.visibleFieldIds || [],
    mergedFieldsAuth.value,
    fieldElementUidMap.value,
  );
});

const collectViewActionSubmitHelperFieldIds = (
  currentTable: Table | undefined,
  currentRow: Row | null | undefined,
  path: string[] = [],
): ViewActionFieldId[] => {
  if (!currentTable || !currentRow) {
    return [];
  }

  const helperFieldIds: ViewActionFieldId[] = [];
  const uuidField = getUUIDSystemField(currentTable.fields);
  const currentPath = path.length ? [...path, uuidField?.uid].filter(Boolean).join(".") : uuidField?.uid;
  if (uuidField?.uid && currentPath && currentRow?.[uuidField.uid] != null) {
    helperFieldIds.push(currentPath as ViewActionFieldId);
  }

  for (const field of currentTable.fields || []) {
    const subTableUID = field.meta?.extra?.subTableUID?.[1];
    const subRows = currentRow?.[field.uid];
    if (!subTableUID || !Array.isArray(subRows) || !subRows.length) {
      continue;
    }

    const subTable = formData.value?.tables?.find(item => item.uid === subTableUID);
    if (!subTable) {
      continue;
    }

    const nestedHelperFieldIds = new Set<ViewActionFieldId>();
    for (const subRow of subRows) {
      collectViewActionSubmitHelperFieldIds(subTable, subRow, [...path, field.uid]).forEach((fieldId) => {
        nestedHelperFieldIds.add(fieldId);
      });
    }
    helperFieldIds.push(...nestedHelperFieldIds);
  }

  return helperFieldIds;
}

const submitFieldIds = computed(() => {
  if (!props.viewActionContext) {
    return effectiveVisibleFieldIds.value;
  }

  const helperFieldIds = collectViewActionSubmitHelperFieldIds(table.value, props.row);
  return Array.from(new Set([
    ...effectiveVisibleFieldIds.value,
    ...helperFieldIds,
  ]));
});

const getCalculationFieldFormInput = (field: Field) => {
  const rootFieldId = String(field.uid || "").split(".")[0];
  const elementUID = fieldElementUidMap.value?.[rootFieldId] || fieldElementUidMap.value?.[String(field.uid || "")];
  return elementUID ? formWidget.value?.getChildElement?.(elementUID) : null;
}

const isCalculationFieldHiddenByPermission = (field: Field) => {
  const formInput = getCalculationFieldFormInput(field);
  if (formInput?.isHiddenByFieldPermission) {
    return true;
  }
  if (permissionFieldsAuth.value === "all") {
    return false;
  }
  const rootFieldId = String(field.uid || "").split(".")[0];
  const elementUID = fieldElementUidMap.value?.[rootFieldId] || fieldElementUidMap.value?.[String(field.uid || "")];
  return !!elementUID && (permissionFieldsAuth.value as Record<string, FieldAuthValue>)?.[elementUID] < FieldAuthValue.VISIBLE;
}

const isCalculationFieldBusinessHidden = (field: Field) => {
  if (isCalculationFieldHiddenByPermission(field)) {
    return false;
  }
  const formInput = getCalculationFieldFormInput(field);
  const rootFieldId = String(field.uid || "").split(".")[0];
  const elementUID = fieldElementUidMap.value?.[rootFieldId] || fieldElementUidMap.value?.[String(field.uid || "")];
  const isHiddenByMergedAuth = mergedFieldsAuth.value !== "all"
    && !!elementUID
    && (mergedFieldsAuth.value as Record<string, FieldAuthValue>)?.[elementUID] < FieldAuthValue.VISIBLE;
  return !!formInput?.isHidden || isHiddenByMergedAuth;
}

const filterCalculationFieldsByCurrentVisibility = <T extends Field>(
  fields: T[] = [],
  options: { allowBusinessHidden?: boolean } = {},
) => {
  if (!fields.length) {
    return fields;
  }

  return fields.filter((field) => {
    if (isCalculationFieldHiddenByPermission(field)) {
      return false;
    }
    if (!isCalculationFieldBusinessHidden(field) || options.allowBusinessHidden) {
      return true;
    }
    const rootFieldId = String(field.uid || "").split(".")[0];
    return getHiddenFieldSubmitMode(formWidget.value?.getSoul?.().options, rootFieldId) === HiddenFieldSubmitMode.RECALCULATE;
  });
}

const isFieldValueEmptyForCalculatedDefault = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return value === undefined || value === null || value === "";
}

const getMappedFieldDefaultValue = (field: Field, fieldId = String(field.uid || "")) => {
  const mappedDefaultValue = fieldDefaultValueMap.value?.[fieldId];
  return isFieldValueEmptyForCalculatedDefault(mappedDefaultValue)
    ? field.meta?.extra?.defaultValue
    : mappedDefaultValue;
}

const shouldHydrateCalculatedDefaultForField = (field: Field, row: Row = {}) => {
  const fieldUID = String(field.uid || "");
  if (!fieldUID) {
    return false;
  }

  const fieldPath = fieldUID.split(".");
  if (fieldPath.length === 1) {
    return isFieldValueEmptyForCalculatedDefault(row?.[fieldUID]);
  }

  if (fieldPath.length !== 2) {
    return false;
  }

  const [parentFieldId, subFieldId] = fieldPath;
  const subRows = row?.[parentFieldId];
  if (!Array.isArray(subRows) || !subRows.length) {
    return false;
  }

  return subRows.every((subRow) => isFieldValueEmptyForCalculatedDefault(subRow?.[subFieldId]));
}

const filterVisibleEmptyCalculationFields = <T extends Field>(
  fields: T[] = [],
  row: Row = {},
  options: { allowBusinessHidden?: boolean } = {},
) => {
  return filterCalculationFieldsByCurrentVisibility(fields, options).filter(field => shouldHydrateCalculatedDefaultForField(field, row));
}

const getFieldSubTable = (field: Field) => {
  const subTableUID = field.meta?.extra?.subTableUID;
  const currentTableUID = Array.isArray(subTableUID) ? subTableUID[subTableUID.length - 1] : subTableUID;
  if (!currentTableUID) {
    return null;
  }
  return formData.value?.tables?.find(item => item.uid === currentTableUID) || null;
}

const collectWidgetRuntimeDefaultFields = (fields: Field[] = [], path: string[] = []) => {
  return fields.reduce<Field[]>((prev, field) => {
    const fieldUID = String(field.uid || "");
    if (!fieldUID) {
      return prev;
    }

    const fieldPath = [...path, fieldUID];
    const defaultValueType = field.meta?.extra?.defaultValueType;
    const configuredDefaultValue = getMappedFieldDefaultValue(field, fieldPath.join("."));
    if (
      (defaultValueType && defaultValueType !== "formula")
      || hasOrganizeFieldRuntimeDefaultValue({
        defaultValue: configuredDefaultValue,
        field,
      })
    ) {
      prev.push({
        ...field,
        uid: fieldPath.join("."),
      });
    }

    const subTable = getFieldSubTable(field);
    if (subTable?.fields?.length) {
      prev.push(...collectWidgetRuntimeDefaultFields(subTable.fields, fieldPath));
    }
    return prev;
  }, []);
}

const getFieldWidgetByUID = (fieldUID: string) => {
  if (!formWidget.value) {
    return null;
  }

  const elementUID = fieldElementUidMap.value?.[fieldUID];
  if (!elementUID) {
    return null;
  }
  return formWidget.value.getChildElement(elementUID) as FormElement | null;
}

const setCalculatedDefaultFieldValue = (field: Field, row: Row, value: unknown) => {
  const fieldUID = String(field.uid || "");
  if (!fieldUID) {
    return false;
  }

  const clonedValue = deepClone(value);
  const fieldPath = fieldUID.split(".");
  if (fieldPath.length === 1) {
    if (!isFieldValueEmptyForCalculatedDefault(row?.[fieldUID])) {
      return false;
    }
    row[fieldUID] = clonedValue;
    return true;
  }

  if (fieldPath.length !== 2) {
    return false;
  }

  const [parentFieldId, subFieldId] = fieldPath;
  const subRows = Array.isArray(row?.[parentFieldId]) ? row[parentFieldId] : [];
  let changed = false;
  subRows.forEach((subRow) => {
    if (!isFieldValueEmptyForCalculatedDefault(subRow?.[subFieldId])) {
      return;
    }
    subRow[subFieldId] = deepClone(value);
    changed = true;
  });
  return changed;
}

const hydrateCalculatedSubformDefaultRows = (row: Row = {}, fields: Field[] = []) => {
  return hydrateSubformParentDefaultRows(row, fields, fieldDefaultValueMap.value);
}

const getFieldConfiguredRuntimeDefaultValue = (field: Field, fieldId = String(field.uid || "")) => {
  const widgetDefaultValue = getFieldWidgetByUID(fieldId)?.getOption?.('default-value');
  return isFieldValueEmptyForCalculatedDefault(widgetDefaultValue)
    ? getMappedFieldDefaultValue(field, fieldId)
    : widgetDefaultValue;
}

const resolveFieldRuntimeDefaultValue = (field: Field, defaultValue: unknown, widgetType?: string) => {
  const organizeDefaultValue = resolveOrganizeFieldRuntimeDefaultValue({
    defaultValue,
    field,
    widgetType,
    account: passportState.account,
  });
  return organizeDefaultValue.isOrganizeDefaultValue
    ? organizeDefaultValue.value
    : deepClone(defaultValue);
}

const applyVisibleEmptyWidgetRuntimeDefaults = (row: Row = {}, fields?: Field[]) => {
  if (!table.value) {
    return false;
  }

  const runtimeDefaultFields = fields || filterVisibleEmptyCalculationFields(
    collectWidgetRuntimeDefaultFields(table.value.fields),
    row,
    { allowBusinessHidden: true },
  );
  let changed = false;
  runtimeDefaultFields.forEach((field) => {
    const defaultValue = getFieldConfiguredRuntimeDefaultValue(field);
    if (isFieldValueEmptyForCalculatedDefault(defaultValue)) {
      return;
    }
    const organizeDefaultChanged = applyOrganizeFieldRuntimeDefaultToRow({
      row,
      field,
      defaultValue,
      account: passportState.account,
    });
    if (organizeDefaultChanged) {
      changed = true;
      return;
    }
    const runtimeDefaultValue = resolveFieldRuntimeDefaultValue(field, defaultValue);
    if (isFieldValueEmptyForCalculatedDefault(runtimeDefaultValue)) {
      return;
    }
    changed = setCalculatedDefaultFieldValue(field, row, runtimeDefaultValue) || changed;
  });
  return changed;
}

const isDefaultQuickComputeField = (field?: Field) => {
  const extra = field?.meta?.extra;
  return extra?.defaultValueType === "formula"
    && extra?.defaultComputeType === "quickCompute"
    && Array.isArray(extra?.otherTableFieldUID)
    && extra.otherTableFieldUID.length >= 3;
}

const getQuickComputeRuntimeFields = (field?: Field) => {
  if (!table.value || !formData.value) {
    return [] as Field[];
  }

  const fieldUID = String(field?.uid || "");
  const [parentFieldId] = fieldUID.split(".");
  if (!parentFieldId || !fieldUID.includes(".")) {
    return table.value.fields || [];
  }

  const parentField = table.value.fields.find(item => item.uid === parentFieldId);
  const subTableUID = parentField?.meta?.extra?.subTableUID?.at(-1);
  return formData.value.tables.find(item => item.uid === subTableUID)?.fields || table.value.fields;
}

const getDefaultQuickComputeTargetNocodeId = (otherTableFieldUID?: OptionFieldUID | string[]) => {
  const connectionUID = otherTableFieldUID?.[0];
  if (!connectionUID) {
    return nocodeId;
  }

  const dataSource = getNocodeDataSourceByUID(getNocodeBodyData(), connectionUID, {
    nocodeId,
    includeSchemaSources: true,
  });
  return dataSource?.nocodeId || nocodeId;
}

const calculateDefaultQuickComputeValue = async (field: Field, row: Row = {}) => {
  if (!table.value || !isDefaultQuickComputeField(field)) {
    return undefined;
  }

  const extra = field.meta?.extra || {};
  return await calculateAggregation({
    otherTableFieldUID: extra.otherTableFieldUID,
    dataFilter: extra.dataFilter,
    nocodeId: getDefaultQuickComputeTargetNocodeId(extra.otherTableFieldUID),
    aggregateType: extra.aggregateType,
    decimal: extra.decimalPlaces,
    row,
    fields: getQuickComputeRuntimeFields(field),
  });
}

const applyQuickComputeDefaultFields = async (row: Row = {}, fields: Field[] = []) => {
  let changed = false;

  for (const field of fields) {
    const fieldUID = String(field.uid || "");
    if (!fieldUID) {
      continue;
    }

    const fieldPath = fieldUID.split(".");
    if (fieldPath.length === 1) {
      if (!isFieldValueEmptyForCalculatedDefault(row?.[fieldUID])) {
        continue;
      }

      const value = await calculateDefaultQuickComputeValue(field, row);
      if (isFieldValueEmptyForCalculatedDefault(value)) {
        continue;
      }

      row[fieldUID] = deepClone(value);
      changed = true;
      continue;
    }

    if (fieldPath.length !== 2) {
      continue;
    }

    const [parentFieldId, subFieldId] = fieldPath;
    const subRows = Array.isArray(row?.[parentFieldId]) ? row[parentFieldId] : [];
    for (const subRow of subRows) {
      if (!isFieldValueEmptyForCalculatedDefault(subRow?.[subFieldId])) {
        continue;
      }

      const value = await calculateDefaultQuickComputeValue(field, subRow);
      if (isFieldValueEmptyForCalculatedDefault(value)) {
        continue;
      }

      subRow[subFieldId] = deepClone(value);
      changed = true;
    }
  }

  return changed;
}

const cloneHiddenSubmitField = (field: Field, fieldId: string) => {
  return {
    ...field,
    uid: fieldId,
  } as Field;
}

const findHiddenSubmitField = (fieldId: string) => {
  if (!table.value) {
    return null;
  }

  const field = table.value.fields?.find(item => item.uid === fieldId);
  return field || null;
}

const recalculateHiddenFieldSubmitValue = async ({
  formInput,
  fieldId,
  baseRow,
}: RecalculateHiddenFieldOptions) => {
  if (!table.value || !formData.value) {
    return undefined;
  }

  const field = findHiddenSubmitField(fieldId) || formInput.field;
  if (!field) {
    return undefined;
  }

  const extra = field.meta?.extra || {};
  const targetFieldId = String(field.uid || fieldId);
  const targetWidgetId = formInput.uid || targetFieldId;
  const organizeAutoFillResult = await resolveHiddenOrganizeAutoFillSubmitValue({
    formInput,
    loadUsers: () => board.value?.getOrganizeUsers({ status: 'all' }) || [],
  });
  if (organizeAutoFillResult.matched) {
    return organizeAutoFillResult.value;
  }
  const targetField = cloneHiddenSubmitField(field, targetFieldId);
  const nextRow = deepClone(baseRow || {}) as Row;
  const fieldsFilling = formWidget.value?.getRunnableFieldsFilling(
    (formWidget.value?.getOption?.("fields-filling") as FormLinkageRule[]) || [],
  ) || [];
  const linkageSubmitResult = await resolveHiddenFieldLinkageSubmitValue({
    fieldId: targetWidgetId,
    rules: fieldsFilling,
    baseRow: nextRow,
    resolveWidgetFieldId: widgetUid => formWidget.value?.getChildElement(widgetUid)?.fieldId,
    getRows: (rule, _conditionValues, rowsQuery) => getHiddenFieldLinkageRows(rule, rowsQuery),
  });
  if (linkageSubmitResult.matched) {
    return linkageSubmitResult.value;
  }

  if (extra.widgetType === FormWidgetType.AUTO_COMPUTE) {
    if (extra.computeType === "formula" && extra.formula) {
      rowsDefaultValueCalculation([nextRow], {
        defaultFields: [],
        formulaFields: [targetField],
      }, table.value, formData.value);
      return nextRow[targetFieldId];
    }

    if (extra.computeType === "quickCompute" && extra.otherTableFieldUID?.length) {
      return await calculateAggregation({
        otherTableFieldUID: extra.otherTableFieldUID,
        dataFilter: extra.dataFilter,
        nocodeId,
        aggregateType: extra.aggregateType,
        decimal: extra.decimalPlaces,
        row: nextRow,
        fields: table.value.fields,
      });
    }

    return undefined;
  }

  if (isDefaultQuickComputeField(field)) {
    return await calculateDefaultQuickComputeValue(targetField, nextRow);
  }

  if (extra.defaultValueType === "formula" && extra.formula) {
    rowsDefaultValueCalculation([nextRow], {
      defaultFields: [],
      formulaFields: [targetField],
    }, table.value, formData.value);
    return nextRow[targetFieldId];
  }

  return undefined;
}

const initWidgetAuth = () => {
  if (!formWidget.value) return;
  if (mergedFieldsAuth.value instanceof Object) {
    formWidget.value.setWidgetAuth(
      mergedFieldsAuth.value,
      permissionFieldsAuth.value instanceof Object ? permissionFieldsAuth.value : {},
    );
  }
  if (typeof formWidget.value.setWidgetRequired === 'function') {
    formWidget.value.setWidgetRequired(effectiveRequiredFieldsAuth.value);
    return;
  }
  const formInputs = formWidget.value?.allFormInputs || [];
  formInputs.forEach((widget: any) => {
    if (typeof widget?.setWidgetRequired === 'function') {
      widget.setWidgetRequired(effectiveRequiredFieldsAuth.value);
      return;
    }
    if (typeof widget?.setRequiredInProcess === 'function') {
      const hasOwnRequired = Object.prototype.hasOwnProperty.call(effectiveRequiredFieldsAuth.value || {}, widget.uid);
      widget.setRequiredInProcess(hasOwnRequired ? !!effectiveRequiredFieldsAuth.value?.[widget.uid] : null);
    }
  });
}

const resetWidgetRequiredState = (targetWidget = formWidget.value) => {
  if (!targetWidget?.allFormInputs?.length) return;
  targetWidget.allFormInputs.forEach((widget: any) => {
    if (typeof widget?.setRequiredInProcess === 'function') {
      widget.setRequiredInProcess(null);
    }
  });
}

watch(formWidget, (nextWidget, prevWidget) => {
  if (nextWidget === prevWidget) return;
  if (prevWidget) {
    resetWidgetRequiredState(prevWidget);
  }
});

const fieldsAuth = ref("all");
const formMode = useFormMode();
const runtime = useRuntime();
type RuntimeSource = AggregateRuntimeSource & TableAggregateRuntimeSource;
const getRuntimeNocodeBody = () => {
  return {
    ...(nocode?.value?.body || {}),
    formData: formData.value,
    otherDataSources: otherDataSources.value,
    otherDataSourceSchemas: otherDataSourceSchemas.value,
    settings: runtimeNocodeSettings.value,
  } as NocodeBody;
}
const getNocodeBodyData = () => {
  return {
    formData: formData.value,
    otherDataSources: otherDataSources.value,
    otherDataSourceSchemas: otherDataSourceSchemas.value,
    settings: runtimeNocodeSettings.value,
  };
}
const getPermissionBodyByTableId = (tableId?: string) => {
  return props.permissionContextOverride?.getPermissionBody?.(tableId) || (props.permissionContextOverride?.nocodeBody || nocode?.value?.body);
};
const getRuntimeSources = (): RuntimeSource[] => {
  const sources: RuntimeSource[] = [];
  if (formData.value) {
    sources.push({
      uid: formData.value.uid,
      nocodeId,
      tables: formData.value.tables || [],
      aggregateTables: formData.value.aggregateTables || [],
      metas: formData.value.metas || {},
    });
  }
  (otherDataSources.value || []).forEach(source => {
    if (!source?.uid) return;
    sources.push({
      uid: source.uid,
      nocodeId: source.nocodeId,
      tables: source.tables || [],
      aggregateTables: (source as any).aggregateTables || [],
      metas: source.metas || {},
    });
  });
  return sources;
}
const runtimeSources = computed(() => getRuntimeSources());
const boardConnections = computed(() => {
  const connectionsWithAggregateTable = buildBoardConnectionsWithAggregateTables(getBoardConnectionsByNocodeBody(getNocodeBodyData(), {
    nocodeId,
  }), runtimeSources.value);
  return extendConnectionsWithTableAggregateFields(connectionsWithAggregateTable, runtimeSources.value);
});

type RuntimeAddedChoice = {
  id?: string;
  label: string;
  value: string;
  color?: string;
};

type AppendFormFieldChoicePayload = {
  tableUID: string;
  rootTableUID?: string;
  fieldId: string;
  widgetUID: string;
  choice: RuntimeAddedChoice;
  sign?: string;
  targetSign?: string;
};

type PendingAppendFormFieldChoicePayload = Omit<AppendFormFieldChoicePayload, "sign" | "targetSign">;

const pendingAppendFormFieldChoices = ref<PendingAppendFormFieldChoicePayload[]>([]);

const queueAppendFormFieldChoice = (payload: PendingAppendFormFieldChoicePayload) => {
  const choiceValue = payload.choice?.value?.trim?.();
  if (!choiceValue) return;

  const existedIndex = pendingAppendFormFieldChoices.value.findIndex(item => {
    return item.tableUID === payload.tableUID
      && (item.rootTableUID || "") === (payload.rootTableUID || "")
      && item.fieldId === payload.fieldId
      && item.widgetUID === payload.widgetUID
      && item.choice?.value === choiceValue;
  });
  if (existedIndex >= 0) {
    pendingAppendFormFieldChoices.value[existedIndex] = {
      ...pendingAppendFormFieldChoices.value[existedIndex],
      ...payload,
      choice: {
        ...pendingAppendFormFieldChoices.value[existedIndex].choice,
        ...payload.choice,
        value: choiceValue,
      },
    };
    return;
  }

  pendingAppendFormFieldChoices.value.push({
    ...payload,
    choice: {
      ...payload.choice,
      value: choiceValue,
      label: payload.choice?.label?.trim?.() || choiceValue,
    },
  });
};

const isPendingAppendFormFieldChoiceSelected = (payload: PendingAppendFormFieldChoicePayload) => {
  const widget = formWidget.value?.getChildElement(payload.widgetUID) as any;
  if (!widget) return false;

  const currentValue = widget.inputValue;
  const choiceValue = payload.choice?.value;
  if (!choiceValue) return false;
  if (Array.isArray(currentValue)) {
    return currentValue.includes(choiceValue);
  }
  if (typeof currentValue === "string") {
    return currentValue === choiceValue || currentValue.split(",").includes(choiceValue);
  }
  return false;
};

const flushPendingAppendFormFieldChoices = async () => {
  if (!pendingAppendFormFieldChoices.value.length) return;

  const queue = [...pendingAppendFormFieldChoices.value];
  const remaining: PendingAppendFormFieldChoicePayload[] = [];
  for (const payload of queue) {
    if (!isPendingAppendFormFieldChoiceSelected(payload)) {
      continue;
    }
    try {
      await appendFormFieldChoice(payload);
    } catch (err) {
      remaining.push(payload);
      throw err;
    }
  }
  pendingAppendFormFieldChoices.value = remaining;
};

const appendChoiceToWidgetSoul = (widgetSoul: WidgetSoul | undefined, widgetUID: string, widgetType: string, choice: RuntimeAddedChoice) => {
  if (!widgetSoul?.widgets?.length) return;

  const visit = (widgets: WidgetSoul[]) => {
    for (const current of widgets || []) {
      if (current?.uid === widgetUID) {
        const optionKey = widgetType === "widget.form.checkboxGroup" ? "checkbox-option" : "treeselect-value-text-option";
        const optionConfig = ((current.options || {})[optionKey] || {}) as any;
        const optionList = Array.isArray(optionConfig.options) ? optionConfig.options : [];
        if (!optionList.some((item: any) => item?.value === choice.value)) {
          current.options = current.options || {};
          current.options[optionKey] = {
            ...optionConfig,
            options: [...optionList, choice],
          };
        }
        return true;
      }
      if (visit(current.widgets || [])) {
        return true;
      }
    }
    return false;
  };

  visit(widgetSoul.widgets || []);
};

const syncRuntimeAddedChoice = (payload: AppendFormFieldChoicePayload) => {
  const choice = {
    id: payload.choice.id,
    label: payload.choice.label,
    value: payload.choice.value,
    color: payload.choice.color,
  };
  const syncTarget = (targetFormData?: NocodeFormData | null) => {
    if (!targetFormData) return;
    const targetTable = targetFormData.tables?.find(item => item.uid === payload.tableUID);
    const targetField = targetTable?.fields?.find(field => field.uid === payload.fieldId);
    if (!targetField) return;

    const extra = ((targetField.meta?.extra || {}) as Record<string, any>);
    const choices = Array.isArray(extra.choices) ? extra.choices : [];
    if (!choices.some((item: any) => item?.value === choice.value)) {
      extra.choices = [...choices, choice];
      targetField.meta.extra = extra;
    }

    const widgetType = extra.widgetType;
    const rootTableUID = payload.rootTableUID || payload.tableUID;
    const rootWidgetSoul = targetFormData.formOptions?.[rootTableUID]?.widget;
    if (widgetType && rootWidgetSoul) {
      appendChoiceToWidgetSoul(rootWidgetSoul, payload.widgetUID, widgetType, choice);
    }
  };

  syncTarget(formData.value);
  if (nocode?.value?.body?.formData && nocode.value.body.formData !== formData.value) {
    syncTarget(nocode.value.body.formData);
  }
};

const fetchAppendChoiceTargetSign = async (payload: AppendFormFieldChoicePayload) => {
  return await axios.post(
    isPublicVisit.value ? "/project/get-public-form-field-choice-sign" : "/project/get-form-field-choice-sign",
    {
      nocodeId,
      tableUID: payload.tableUID,
      rootTableUID: payload.rootTableUID,
      fieldId: payload.fieldId,
      widgetUID: payload.widgetUID,
    },
  ).then(({ data }) => {
    if (data?.sign && data?.sourceNocodeId) {
      updateMainSign(data.sign, data.sourceNocodeId);
    }
    return {
      sourceNocodeId: data?.sourceNocodeId || nocodeId,
      sign: data?.sign || "",
    };
  });
};

const appendFormFieldChoice = async (payload: AppendFormFieldChoicePayload) => {
  await ensureTargetNocodeSign();
  const targetNocodeData = payload.targetSign ? null : await fetchAppendChoiceTargetSign(payload);
  const sourceNocodeId = targetNocodeData?.sourceNocodeId || nocodeId;
  const targetSign = payload.targetSign || targetNocodeData?.sign || "";
  const response = await axios.post(isPublicVisit.value ? "/project/append-public-form-field-choice" : "/project/append-form-field-choice", {
    nocodeId,
    ...payload,
    sign: payload.sign || getTargetNocodeSign(),
    targetSign,
  });
  const responseSign = response.data?.sign || response.headers?.["x-sign"];
  const responseNocodeId = response.data?.sourceNocodeId || sourceNocodeId;
  if (responseSign && responseNocodeId) {
    updateMainSign(responseSign, responseNocodeId);
  }
  syncRuntimeAddedChoice(payload);
  return response.data;
};

const init = async () => {
  if (formDisposed) return;
  initAbortController?.abort();
  const controller = new AbortController();
  initAbortController = controller;
  await ensureTargetNocodeSign(controller.signal);
  if (!isInitActive(controller)) return;
  await ensurePagePermissionContextReady();
  if (!isInitActive(controller)) return;
  let res = null;
  if (props.bootstrapData?.formData) {
    res = {
      formData: props.bootstrapData.formData,
      otherDataSources: props.bootstrapData.otherDataSources || [],
      otherDataSourceSchemas: props.bootstrapData.otherDataSourceSchemas || [],
      settings: props.bootstrapData.settings,
      fieldsAuth: props.bootstrapData.fieldsAuth || props.memberFieldsAuth || "all",
      row: props.row,
    };
  } else {
    res = await axios.get(`nocode/read-form-data`, {
      params: {
        nocodeId,
        tableId: tableId.value,
        uuid,
      },
      signal: controller.signal,
    }).then(({ data }) => data).catch(() => null)
  }
  if (!res || !isInitActive(controller)) return;
  formData.value = res.formData;
  otherDataSources.value = res.otherDataSources || [];
  otherDataSourceSchemas.value = res.otherDataSourceSchemas || [];
  runtimeNocodeSettings.value = res.settings;
  fieldsAuth.value = res.fieldsAuth || props.memberFieldsAuth || "all";
  const sourceTable = formData.value?.tables.find((item: Table) => item.uid === tableId.value);
  table.value = sourceTable
    ? {
      ...sourceTable,
      fields: sourceTable.fields?.map((field) => ({ ...field })),
    }
    : undefined;
  if (!table.value) return;

  widget.value = deepClone(formData.value?.formOptions?.[tableId.value]?.widget) || {
    type: "widget.form.form"
  };
  migrateLegacySubformFillRules(widget.value, formData.value.uid);

  // 过滤widget中的字段组件
  if (props.hiddenWidgets && props.hiddenWidgets.length > 0 && widget.value.widgets) {
    widget.value.widgets = widget.value.widgets.filter(widgetItem => {
      return !props.hiddenWidgets.includes(widgetItem.uid);
    });
  }

  const boardSoul: BoardSoul = {
    type: 'board',
    options: {
      "background": false,
      "container-layout": "fluid",
    }
  }
  const projectContext: ProjectContext = {
    typography: "page",
    isNocodeRuntime: true,
    inNocodeForm: true,
    nocodeId,
    get pagePermissionContext() {
      return {
        nocodeBody: props.permissionContextOverride?.nocodeBody || getRuntimeNocodeBody(),
        getPermissionBody: getPermissionBodyByTableId,
        departments: organizeUtil?.departments || [],
        account: passportState.account,
        skipDataPermission: isPublicVisit.value,
      };
    },
    get connectionData() {
      return projectConnectionData.value;
    },
    get mergedConnectionData() {
      return mergedConnectionData.value;
    },
    get widthRatio() {
      return isMobile() ? 1 : props.widthRatio;
    },
    get runtime(){
      return runtime;
    },
    get formMode() {
      return formMode?.value;
    },
    getBoards: () => [board.value],
    getConnections: () => boardConnections.value,
    getNocodeBodyData: () => getNocodeBodyData(),
    openRelatedDetail: projectOpenRelatedDetail,
    getDataConditions: () => [],
    appendFormFieldChoice,
    queueFormFieldChoiceAppend: queueAppendFormFieldChoice,
    addToConnection: async (uid: OptionTableUID, rows: object[],) => {
      return await formDataApi.addData({
        nocodeId,
        tableUID: uid[1],
        rows,
        runtime,
        sign: getTargetNocodeSign(),
        onMainSign: updateMainSign,
      })
    },
    updateToConnection: async (uid: OptionTableUID, rows: object[], keys: OptionFieldUID[]) => {
      return await formDataApi.updateData({
        nocodeId,
        tableUID: uid[1],
        rows,
        keys,
        updateFieldIds: getEffectiveSubmitFieldIds(),
        viewActionContext: props.viewActionContext,
        runtime,
        sign: getTargetNocodeSign(),
        onMainSign: updateMainSign,
      })
    },
    async readDataByOptions(optionTableUID, options) {
      if (!isInitActive(controller) || !optionTableUID || !formData.value) return;
      const dataSource = getNocodeDataSourceByUID(getNocodeBodyData(), optionTableUID[0], {
        nocodeId,
      });
      const targetNocodeId = dataSource?.nocodeId || nocodeId;
      const sourceUID = optionTableUID[0];
      const source = runtimeSources.value.find(item => item.uid === sourceUID);
      const aggregateTable = source?.aggregateTables?.find(item => item.uid === optionTableUID[1]);
      if (!canReadNocodeTableDataByBody(
        getPermissionBodyByTableId(optionTableUID[1]) as NocodeBody,
        optionTableUID[1],
        organizeUtil?.departments || [],
        undefined,
        isPublicVisit.value,
      )) {
        return {
          count: 0,
          rows: [],
        };
      }

      if (aggregateTable) {
        const buckets = await formDataApi.getData({
          nocodeId: targetNocodeId,
          tableUIDs: [aggregateTable.uid],
          options,
          signal: controller.signal,
        });
        if (!isInitActive(controller)) return;
        return mergeBucketsWithTableAggregateFields(sourceUID, buckets || [], {
          sources: runtimeSources.value,
        })[0];
      }

      const buckets = await formDataApi.getData({
        nocodeId: targetNocodeId,
        tableUIDs: [ optionTableUID[1] ],
        options,
        signal: controller.signal,
      });
      if (!isInitActive(controller)) return;
      return mergeBucketsWithTableAggregateFields(sourceUID, buckets || [], {
        sources: runtimeSources.value,
      })[0];
    },

  } as any;
  board.value = new Board(boardSoul, projectContext);
  // 加上isFormMode = true 子表单就不能编辑了 组件那边根据isFormMode值来决定是否设置 "no-events"
  board.value.status.isFormMode = true;
  board.value.status.isEditable = false;
  board.value.status.isConnectionInited = true;
  formWidget.value = await board.value.container.addWidget(widget.value, 0) as AbstractForm;
  if (!isInitActive(controller)) {
    const staleBoard = board.value;
    board.value = undefined;
    formWidget.value = undefined;
    staleBoard?.destroy();
    return;
  }
  formWidget.value.setTableUID([formData.value.uid, table.value.uid]);
  const uuidField = getUUIDSystemField(table.value.fields);
  const hasRowIdentity = Boolean(
    props.row?.[uuidField?.uid] || props.row?.[SystemField.UUID],
  );
  if (!(formMode.value === FormMode.Add && !uuid && !hasRowIdentity)) {
    formWidget.value.rowId = props.row?.[uuidField?.uid] || props.row?.[SystemField.UUID]
  }
  formWidget.value.setAddingRow(formMode.value === FormMode.Add && !uuid && !hasRowIdentity);
  formWidget.value.setHiddenFieldSubmitRecalculator(recalculateHiddenFieldSubmitValue);
  formWidget.value.setHiddenFieldSubmitStabilizer(stabilizeHiddenFieldSubmitRow);
  if (props.isViewing) {
    formWidget.value.isViewing = true;
  }
  syncHiddenFields();
  // 数据回显&编辑数据
  if (props.row) {
    formWidget.value.setRow(props.row);
  } else if (uuid) {
    formWidget.value.setRow(res.row);
  } else if (!isEmpty(preRow)) {
    formWidget.value.setRow({...preRow});
  }
  const initialFormRow = uuid
    ? mergeUuidDetailRow(props.row, res.row)
    : (props.row ?? (!isEmpty(preRow) ? { ...preRow } : void 0));
  if (initialFormRow !== void 0 && initialFormRow !== null) {
    formWidget.value.setRow(initialFormRow);
  }
  if (props.isViewing) {
    bindFields();
    initSuccessed.value = true;
  }
  await applyInitialCalculatedDefaults();
  if (!isInitActive(controller)) {
    const staleBoard = board.value;
    board.value = undefined;
    formWidget.value = undefined;
    staleBoard?.destroy();
    return;
  }

  readyWatchStop?.();
  readyWatchStop = watch(() => formWidget.value?.isReady(), async (value) => {
    if (!isInitActive(controller) || !formWidget.value || !board.value) return;
    if (value) {
      bindFields();
      await syncMemberSelectAllUsers();
      if (!isInitActive(controller)) return;
      board.value.status.isProjectReady = true;
      initWidgetAuth();
      syncForceHiddenFields();
      syncForceShownFields();
      await syncForceShownPanel();
      if (!isInitActive(controller)) return;
      syncSubmitFieldIds();
      formWidget.value.initializeHiddenFieldSubmitState();
      await nextTick();
      if (!isInitActive(controller)) return;
      await applyVisibleEmptyCalculatedDefaults();
      await nextTick();
      if (!isInitActive(controller)) return;
      await replayInitialDefaultLinkage();
      if (!isInitActive(controller)) return;
      applyFormDesignValidationErrors();
      readyWatchStop?.();
      readyWatchStop = undefined;
      formWidget.value.isViewing = props.isViewing ?? false;
      await applyCopyContext();
      if (!isInitActive(controller)) return;
      emit("ready", {
        table: table.value,
        formData: formData.value,
        otherDataSources: otherDataSources.value,
      });
      initSuccessed.value = true;
      setTimeout(() => {
        if (formWidget.value) {
          void captureInitialFormSnapshot(true);
        }
      }, 0);
    }
  }, { immediate: true });
}

watch(() => props.isViewing, (value) => {
  if (!formWidget.value) return; // 避免 undefined

  if (value) {
    formWidget.value.isViewing = true;
  } else {
    formWidget.value.isViewing = false;
  }
})

watch([mergedFieldsAuth, permissionFieldsAuth], () => {
  if (!formWidget.value?.isReady?.()) return;
  initWidgetAuth();
}, { deep: true })

watch(effectiveRequiredFieldsAuth, () => {
  if (!formWidget.value?.isReady?.()) return;
  initWidgetAuth();
}, { deep: true })

watch(forceHiddenFieldIds, () => {
  syncForceHiddenFields();
}, { deep: true })

watch(effectiveVisibleFieldIds, () => {
  syncForceShownFields();
  void syncForceShownPanel();
}, { deep: true })

watch(submitFieldIds, () => {
  syncSubmitFieldIds();
}, { deep: true })

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

const shouldApplyInitialCalculatedDefaults = () => {
  return !props.row && !uuid && isEmpty(preRow);
}

const applyInitialCalculatedDefaults = async () => {
  if (!formWidget.value || !table.value || !formData.value) return false;
  if (!shouldApplyInitialCalculatedDefaults()) return false;

  const { defaultFields, formulaFields, quickComputeFields } = getTableCalculationFields(table.value, formData.value);
  const visibleDefaultFields = filterCalculationFieldsByCurrentVisibility(defaultFields, { allowBusinessHidden: true });
  const visibleFormulaFields = filterCalculationFieldsByCurrentVisibility(formulaFields);
  const visibleQuickComputeFields = filterCalculationFieldsByCurrentVisibility(quickComputeFields);
  if (!visibleDefaultFields.length && !visibleFormulaFields.length && !visibleQuickComputeFields.length) return false;

  const nextRow = { ...(formWidget.value.getRow?.() || {}) };
  hydrateCalculatedSubformDefaultRows(nextRow, [...visibleDefaultFields, ...visibleFormulaFields, ...visibleQuickComputeFields]);
  rowsDefaultValueCalculation([nextRow], { defaultFields: visibleDefaultFields, formulaFields: visibleFormulaFields }, table.value, formData.value);
  await applyQuickComputeDefaultFields(nextRow, visibleQuickComputeFields);

  formWidget.value.setRow(nextRow);
  return true;
}

const shouldApplyVisibleEmptyCalculatedDefaults = () => {
  return !!flowId.value && !shouldApplyInitialCalculatedDefaults() && (!!props.row || !!uuid);
}

const applyVisibleEmptyCalculatedDefaults = async () => {
  if (!formWidget.value || !table.value || !formData.value) return false;
  if (!shouldApplyVisibleEmptyCalculatedDefaults()) return false;

  const currentRow = formWidget.value.serialize();
  const { defaultFields, formulaFields, quickComputeFields } = getTableCalculationFields(table.value, formData.value);
  const runtimeDefaultFields = collectWidgetRuntimeDefaultFields(table.value.fields);
  const filterRow = deepClone(currentRow);
  hydrateCalculatedSubformDefaultRows(filterRow, [...defaultFields, ...formulaFields, ...quickComputeFields, ...runtimeDefaultFields]);
  const visibleEmptyDefaultFields = filterVisibleEmptyCalculationFields(defaultFields, filterRow, { allowBusinessHidden: true });
  const visibleEmptyFormulaFields = filterVisibleEmptyCalculationFields(formulaFields, filterRow);
  const visibleEmptyQuickComputeFields = filterVisibleEmptyCalculationFields(quickComputeFields, filterRow);
  const visibleEmptyRuntimeDefaultFields = filterVisibleEmptyCalculationFields(
    runtimeDefaultFields,
    filterRow,
    { allowBusinessHidden: true },
  );
  if (!visibleEmptyDefaultFields.length && !visibleEmptyFormulaFields.length && !visibleEmptyQuickComputeFields.length && !visibleEmptyRuntimeDefaultFields.length) return false;

  const nextRow = deepClone(currentRow);
  const previousRow = deepClone(currentRow);
  hydrateCalculatedSubformDefaultRows(nextRow, [...visibleEmptyDefaultFields, ...visibleEmptyFormulaFields, ...visibleEmptyQuickComputeFields, ...visibleEmptyRuntimeDefaultFields]);
  rowsDefaultValueCalculation([nextRow], {
    defaultFields: visibleEmptyDefaultFields,
    formulaFields: visibleEmptyFormulaFields,
  }, table.value, formData.value);
  await applyQuickComputeDefaultFields(nextRow, visibleEmptyQuickComputeFields);
  applyVisibleEmptyWidgetRuntimeDefaults(nextRow, visibleEmptyRuntimeDefaultFields);
  if (equals(previousRow, nextRow)) return false;

  formWidget.value.setRow({
    ...(formWidget.value.getRow?.() || {}),
    ...nextRow,
  });
  syncCopyCalculatedWidgets(formWidget.value.formInputs || [], nextRow, { silent: true });
  return true;
}

const getLinkageConditionKey = (condition: FormLinkageCondition, options: { preferUid?: boolean } = {}) => {
  const { preferUid = false } = options;
  return preferUid ? (condition.uid || condition.id) : (condition.id || condition.uid);
}

const getCurrentFormWidgetValue = (value?: string) => {
  if (!value || !formWidget.value) return undefined;
  const widgetIds = value.split(".");
  const widget = widgetIds.length > 1
    ? formWidget.value.getChildElement(widgetIds[widgetIds.length - 1])
    : formWidget.value.getChildElement(value);
  return widget?.inputValue;
}

const getComparisonValuesFromRelatedForms = (fieldUID?: string) => {
  if (!fieldUID || !formWidget.value) return undefined;
  const relatedForms = formWidget.value.children.filter(child => child.getSoul().type === "widget.form.relatedData").filter((child: any) => {
    const relatedTable = child.connectionTable ? formWidget.value?.getTable(child.connectionTable) : null;
    return relatedTable?.fields?.find(field => field.uid === fieldUID);
  });
  if (!relatedForms.length) return undefined;

  const relatedValues = relatedForms.map((relatedData: any) => relatedData.getValue(fieldUID)).flat();
  return [...new Set(relatedValues)];
}

const buildLinkageConditionValues = (conditions: FormLinkageCondition[] = [], options: { preferUid?: boolean } = {}) => {
  return conditions.reduce<Record<string, any>>((prev, condition) => {
    if (condition.type === "CUSTOM") return prev;
    const conditionKey = getLinkageConditionKey(condition, options);
    if (!conditionKey) return prev;

    let value = getCurrentFormWidgetValue(condition.value);
    if (condition.comparisonOfForm === SelectIdOfForm.LINKAGE) {
      const relatedValues = getComparisonValuesFromRelatedForms(condition.value);
      if (relatedValues !== undefined) {
        value = relatedValues;
      }
    }

    prev[conditionKey] = value;
    return prev;
  }, {});
}

const getLinkageRows = async (rule: FormLinkageRule, currentValues: Record<string, any>, submitRow?: Row) => {
  if (!formWidget.value || !rule.linkageTable) return [];

  const rowsQuery = buildHiddenFieldLinkageRowsQuery(rule, currentValues);
  if (!rowsQuery) return [];
  let rowsFilters: Record<string, any> = {
    [rule.linkageTable[1]]: [rowsQuery],
  };
  const linkageTable = formWidget.value.getTable(rule.linkageTable);
  if (!linkageTable) return [];

  if (!isEmpty(linkageTable.meta?.extra?.primaryTable)) {
    const primaryTable = formWidget.value.getTable(linkageTable.meta?.extra?.primaryTable);
    const primaryKeyField = getUUIDSystemField(primaryTable?.fields || []);
    const keyField = linkageTable.fields.find(field => field.meta?.name === SystemField.KEY);
    if (primaryTable && primaryKeyField && keyField) {
      const subTableConditions = rule.subTableSetting?.conditions || [];
      const subTableConditionValues = submitRow
        ? buildLinkageConditionValuesFromRow(subTableConditions, submitRow, {
          resolveWidgetFieldId: widgetUid => formWidget.value?.getChildElement(widgetUid)?.fieldId,
        })
        : buildLinkageConditionValues(subTableConditions);
      const subTableQuery = subTableConditions.length
        ? buildHiddenFieldLinkageRowsQuery({
          conditions: subTableConditions,
          logic: rule.subTableSetting?.logic || LogicalOperator.AND,
        }, subTableConditionValues)
        : null;
      if (subTableConditions.length && !subTableQuery) return [];
      const distinct = await formDataApi.distinct({
        nocodeId,
        tableUID: primaryTable.uid,
        columnId: primaryKeyField.uid,
        options: {
          filters: {
            [primaryTable.uid]: [subTableQuery || {}],
          },
        },
      });
      rowsFilters = {
        [rule.linkageTable[1]]: [
          buildTopLevelLinkageSubTableRowsQuery(rowsQuery, keyField.uid, distinct),
        ],
      };
    }
  }

  let rows = await (formWidget.value as any).getTableData(rule.linkageTable, { filters: rowsFilters }) || [];
  const dataUid = linkageTable.fields.find(field => field.meta?.name === "_uuid")?.uid;
  const subFormFields = linkageTable.fields.filter(field => field.meta?.extra?.widgetType === "widget.form.subform");

  for (const subFormField of subFormFields) {
    const subTableUID = subFormField.meta?.extra?.subTableUID;
    const subTable = subTableUID ? formWidget.value.getTable(subTableUID) : null;
    const relationKey = subTable?.fields?.find(field => field.meta?.name === "_key")?.uid;
    if (!subTableUID || !relationKey || !dataUid) continue;

    const subRows = await (formWidget.value as any).getTableData(subTableUID, { filters: currentValues }) || [];
    if (!subRows.length) continue;

    rows = rows.map(rowItem => {
      const relatedRows = subRows.filter(subRow => subRow[relationKey] === rowItem[dataUid]);
      return relatedRows.length ? { ...rowItem, [subFormField.uid]: relatedRows } : rowItem;
    });
  }

  const matchedRows = rows.filter(rowItem => {
    const method = rule.logic === LogicalOperator.AND ? "every" : "some";
    return (rule.conditions || [])[method](condition => {
      return matchTopLevelLinkageCondition(condition, rowItem, currentValues);
    });
  });
  return matchedRows;
}

const getHiddenFieldLinkageRows = async (rule: FormLinkageRule, rowsQuery?: WhereCondition | null) => {
  if (!formWidget.value || !rule.linkageTable || !rowsQuery) return [];

  const linkageTable = formWidget.value.getTable(rule.linkageTable);
  if (!linkageTable) return [];

  const rowsFilters = {
    [rule.linkageTable[1]]: [rowsQuery],
  };
  return await (formWidget.value as any).getTableData(rule.linkageTable, { filters: rowsFilters }) || [];
}

const getSubmitFieldValue = (row: Row, fieldId: string) => {
  const [rootFieldId, subFieldId] = fieldId.split(".");
  if (!subFieldId) return row?.[rootFieldId];
  const subRows = Array.isArray(row?.[rootFieldId]) ? row[rootFieldId] : [];
  return subRows.map(item => item?.[subFieldId]);
}

const isSubmitDependencyMatch = (dependencyId: string, changedFieldId: string) => {
  return dependencyId === changedFieldId
    || dependencyId.split(".")[0] === changedFieldId.split(".")[0];
}

const canUpdateSubmitCalculationField = (
  fieldId: string,
  options: StabilizeHiddenFieldSubmitRowOptions,
) => {
  const rootFieldId = fieldId.split(".")[0];
  if (options.permissionHiddenFieldIds.includes(rootFieldId) || options.lockedFieldIds.includes(rootFieldId)) {
    return false;
  }
  const hiddenFieldIds = new Set([
    ...options.lockedFieldIds,
    ...options.recalculableHiddenFieldIds,
  ]);
  return !hiddenFieldIds.has(rootFieldId) || options.recalculableHiddenFieldIds.includes(rootFieldId);
}

const getSubmitCalculationFields = () => {
  const calculationFields = getTableCalculationFields(table.value, formData.value);
  const formulaFields = [...calculationFields.formulaFields];
  const quickComputeFields = [...calculationFields.quickComputeFields];
  const formulaFieldIds = new Set(formulaFields.map(field => String(field.uid || "")));
  const quickComputeFieldIds = new Set(quickComputeFields.map(field => String(field.uid || "")));

  for (const field of table.value?.fields || []) {
    const fieldId = String(field.uid || "");
    const extra = field.meta?.extra || {};
    if (extra.widgetType !== FormWidgetType.AUTO_COMPUTE || !fieldId) continue;
    if (extra.computeType === "formula" && extra.formula && !formulaFieldIds.has(fieldId)) {
      formulaFieldIds.add(fieldId);
      formulaFields.push(field);
    }
    if (extra.computeType === "quickCompute" && extra.otherTableFieldUID?.length && !quickComputeFieldIds.has(fieldId)) {
      quickComputeFieldIds.add(fieldId);
      quickComputeFields.push(field);
    }
  }

  return { formulaFields, quickComputeFields };
}

const getReachableSubmitFormulaFields = (
  fields: Field[],
  changedFieldIds: string[],
  options: StabilizeHiddenFieldSubmitRowOptions,
) => {
  const selected: Field[] = [];
  const reachableFieldIds = new Set(changedFieldIds);
  let progressed = true;

  // 从隐藏终值变化出发沿公式依赖向下游扩散，避免无关公式在提交时被重复计算。
  while (progressed) {
    progressed = false;
    for (const field of fields) {
      const fieldId = String(field.uid || "");
      if (!fieldId || reachableFieldIds.has(fieldId) || !canUpdateSubmitCalculationField(fieldId, options)) {
        continue;
      }
      const dependencies = collectFormulaFields(getFormulaStr(field.meta?.extra?.formula), formData.value?.tables || []);
      if (!dependencies.some(dependencyId => [...reachableFieldIds].some(changedId => isSubmitDependencyMatch(dependencyId, changedId)))) {
        continue;
      }
      selected.push(field);
      reachableFieldIds.add(fieldId);
      progressed = true;
    }
  }

  const selectedIds = new Set(selected.map(field => String(field.uid || "")));
  const pendingIds = new Set(selectedIds);
  while (pendingIds.size) {
    const executableId = [...pendingIds].find(fieldId => {
      const field = selected.find(item => String(item.uid || "") === fieldId);
      const dependencies = collectFormulaFields(getFormulaStr(field?.meta?.extra?.formula), formData.value?.tables || []);
      return !dependencies.some(dependencyId => pendingIds.has(dependencyId));
    });
    if (!executableId) {
      throw new Error(i18next.t("hiddenFieldSubmit.calculationCycle", { defaultValue: "隐藏字段提交计算存在循环依赖" }));
    }
    pendingIds.delete(executableId);
  }

  return selected;
}

const applySubmitFormulaCascade = (
  row: Row,
  changedFieldIds: string[],
  options: StabilizeHiddenFieldSubmitRowOptions,
) => {
  if (!table.value || !formData.value || !changedFieldIds.length) return [];
  const { formulaFields } = getSubmitCalculationFields();
  const reachableFields = getReachableSubmitFormulaFields(formulaFields, changedFieldIds, options);
  if (!reachableFields.length) return [];

  const previousValues = new Map(reachableFields.map(field => [
    String(field.uid || ""),
    deepClone(getSubmitFieldValue(row, String(field.uid || ""))),
  ]));
  rowsDefaultValueCalculation([row], { defaultFields: [], formulaFields: reachableFields }, table.value, formData.value);
  return reachableFields
    .map(field => String(field.uid || ""))
    .filter(fieldId => !equals(previousValues.get(fieldId), getSubmitFieldValue(row, fieldId)));
}

const calculateSubmitQuickComputeValue = async (field: Field, row: Row) => {
  const extra = field.meta?.extra || {};
  if (extra.widgetType === FormWidgetType.AUTO_COMPUTE && extra.computeType === "quickCompute") {
    return await calculateAggregation({
      otherTableFieldUID: extra.otherTableFieldUID,
      dataFilter: extra.dataFilter,
      nocodeId,
      aggregateType: extra.aggregateType,
      decimal: extra.decimalPlaces,
      row,
      fields: table.value?.fields || [],
    });
  }
  return await calculateDefaultQuickComputeValue(field, row);
}

const applySubmitQuickComputeCascade = async (
  row: Row,
  options: StabilizeHiddenFieldSubmitRowOptions,
) => {
  const { quickComputeFields } = getSubmitCalculationFields();
  const changedFieldIds: string[] = [];
  for (const field of quickComputeFields) {
    const fieldId = String(field.uid || "");
    if (!fieldId || !canUpdateSubmitCalculationField(fieldId, options)) continue;
    const [rootFieldId, subFieldId] = fieldId.split(".");
    if (!subFieldId) {
      const previousValue = deepClone(row[rootFieldId]);
      const nextValue = await calculateSubmitQuickComputeValue(field, row);
      if (nextValue === undefined || equals(previousValue, nextValue)) continue;
      row[rootFieldId] = deepClone(nextValue);
      changedFieldIds.push(fieldId);
      continue;
    }

    const subRows = Array.isArray(row[rootFieldId]) ? row[rootFieldId] : [];
    let changed = false;
    for (const subRow of subRows) {
      const previousValue = deepClone(subRow?.[subFieldId]);
      const nextValue = await calculateSubmitQuickComputeValue(field, subRow);
      if (nextValue === undefined || equals(previousValue, nextValue)) continue;
      subRow[subFieldId] = deepClone(nextValue);
      changed = true;
    }
    if (changed) changedFieldIds.push(fieldId);
  }
  return changedFieldIds;
}

const applySubmitLinkageCascade = async (
  row: Row,
  changedFieldIds: string[],
  options: StabilizeHiddenFieldSubmitRowOptions,
) => {
  if (!formWidget.value || !changedFieldIds.length) return [];
  const rules = formWidget.value.getRunnableFieldsFilling(
    (formWidget.value.getOption?.("fields-filling") as FormLinkageRule[]) || [],
  );
  const triggerWidgetIds = changedFieldIds.map(fieldId => {
    const rootFieldId = fieldId.split(".")[0];
    return formWidget.value?.formInputs.find(item => item.fieldId === rootFieldId)?.uid;
  }).filter((widgetId): widgetId is string => !!widgetId);
  const changedSubmitFieldIds = new Set<string>();

  await replayTopLevelLinkageRules({
    rules,
    triggerWidgetIds,
    getConditionValues: rule => buildLinkageConditionValuesFromRow(rule.conditions || [], row, {
      resolveWidgetFieldId: widgetUid => formWidget.value?.getChildElement(widgetUid)?.fieldId,
    }),
    shouldExecute: () => true,
    executeRule: async (rule, fillWidgets, currentValues) => {
      const rows = await getLinkageRows(rule, currentValues, row);
      const changedWidgetIds: string[] = [];
      for (const fillWidget of fillWidgets) {
        const targetWidget = formWidget.value?.getChildElement(fillWidget.fillWidget) as FormElement | undefined;
        const targetFieldId = targetWidget?.fieldId;
        if (!targetWidget || !targetFieldId || !canUpdateSubmitCalculationField(targetFieldId, options)) continue;
        const previousValue = deepClone(row[targetFieldId]);
        const nextValue = ["widget.form.treeSelect", "widget.form.treeMultipleSelect"].includes(targetWidget.type)
          ? (rows.length ? getLinkageFillData(fillWidget.linkageField, rows) : [])
          : (rows.length ? getLinkageFillValue(fillWidget.linkageField, rows) : null);
        if (equals(previousValue, nextValue)) continue;
        row[targetFieldId] = deepClone(nextValue);
        changedWidgetIds.push(fillWidget.fillWidget);
        changedSubmitFieldIds.add(targetFieldId);
      }
      return changedWidgetIds;
    },
    onMaxExecutions: () => {
      throw new Error(i18next.t("hiddenFieldSubmit.calculationCycle", { defaultValue: "隐藏字段提交计算存在循环依赖" }));
    },
  });

  return [...changedSubmitFieldIds];
}

const stabilizeHiddenFieldSubmitRow = async (options: StabilizeHiddenFieldSubmitRowOptions) => {
  const row = deepClone(options.row || {}) as Row;
  const affectedFieldIds = new Set<string>();
  let changedFieldIds = [...new Set(options.triggerFieldIds)];
  const maxPasses = Math.max(8, (table.value?.fields?.length || 0) * 2);

  // 公式、聚合和联动可能相互触发，按轮次运行到提交副本稳定为止。
  for (let pass = 0; pass < maxPasses && changedFieldIds.length; pass += 1) {
    const formulaChanged = applySubmitFormulaCascade(row, changedFieldIds, options);
    const quickComputeChanged = await applySubmitQuickComputeCascade(row, options);
    const linkageChanged = await applySubmitLinkageCascade(
      row,
      [...new Set([...changedFieldIds, ...formulaChanged, ...quickComputeChanged])],
      options,
    );
    const nextChangedFieldIds = [...new Set([...formulaChanged, ...quickComputeChanged, ...linkageChanged])];
    nextChangedFieldIds.forEach(fieldId => affectedFieldIds.add(fieldId.split(".")[0]));
    if (!nextChangedFieldIds.length) break;
    if (pass === maxPasses - 1) {
      throw new Error(i18next.t("hiddenFieldSubmit.calculationTimeout", { defaultValue: "隐藏字段提交计算未能稳定" }));
    }
    changedFieldIds = nextChangedFieldIds;
  }

  return {
    row,
    affectedFieldIds: [...affectedFieldIds],
  };
}

const applyLinkageFillValue = (fillWidgetUID: string, linkageField: string, rows: Row[]) => {
  if (!formWidget.value || !fillWidgetUID || !linkageField) return false;
  if (fillWidgetUID.split(".").length > 1) return false;

  const widget = formWidget.value.getChildElement(fillWidgetUID) as any;
  if (!widget) return false;
  if (formWidget.value.isHiddenFieldSubmitCalculationFrozen?.(widget)) return false;
  const previousValue = deepClone(widget.inputValue);

  if (["widget.form.treeSelect", "widget.form.treeMultipleSelect"].includes(widget.type)) {
    if (!rows.length) {
      widget.onFillData?.([]);
      return !equals(previousValue, widget.inputValue);
    }

    const [tableField, subField] = linkageField.split(".");
    const data = subField
      ? rows.flatMap(rowItem => Array.isArray(rowItem?.[tableField]) ? rowItem[tableField].map(item => item?.[subField]) : [])
      : rows.map(rowItem => rowItem?.[tableField]);
    widget.onFillData?.(data);
    return !equals(previousValue, widget.inputValue);
  }

  if (!rows.length) {
    widget.clearValue?.();
    return !equals(previousValue, widget.inputValue);
  }

  const [tableField, subField] = linkageField.split(".");
  widget.inputValue = subField
    ? rows?.[0]?.[tableField]?.[0]?.[subField]
    : rows?.[0]?.[tableField];
  return !equals(previousValue, widget.inputValue);
}

const replayFormTopLevelLinkage = async (
  linkageRules: FormLinkageRule[],
  triggerWidgetIds: string[],
  maxExecutionsWarning: string,
) => {
  const replayResult = await replayTopLevelLinkageRules({
    rules: linkageRules,
    triggerWidgetIds,
    getConditionValues: rule => buildLinkageConditionValues(rule.conditions || []),
    shouldExecute: currentValues => Object.values(currentValues).some(value => value !== undefined),
    executeRule: async (rule, fillWidgets, currentValues) => {
      const rows = await getLinkageRows(rule, currentValues);
      const changedWidgetIds = fillWidgets
        .filter(fillWidget => applyLinkageFillValue(fillWidget.fillWidget, fillWidget.linkageField, rows))
        .map(fillWidget => fillWidget.fillWidget);
      return changedWidgetIds;
    },
    onMaxExecutions: () => console.warn(maxExecutionsWarning),
  });
  return replayResult.hasChanges;
}

const replayInitialDefaultLinkage = async () => {
  if (!shouldApplyInitialCalculatedDefaults() || !formWidget.value) return false;

  const linkageRules = formWidget.value.getRunnableFieldsFilling(
    (formWidget.value.getOption?.("fields-filling") as FormLinkageRule[]) || [],
  );
  const triggerWidgetIds = collectTopLevelLinkageConditionWidgetIds(linkageRules)
    .filter(widgetId => hasInitialLinkageTriggerValue(getCurrentFormWidgetValue(widgetId)));
  if (!triggerWidgetIds.length) return false;

  return await replayFormTopLevelLinkage(
    linkageRules,
    triggerWidgetIds,
    "[NocodeForm] replayInitialDefaultLinkage reached max executions",
  );
}

const rerunCopyLinkage = async (copyContext = getCopyContext(props.row)) => {
  if (!formWidget.value) return false;
  const linkageRules = (formWidget.value.getOption?.("fields-filling") as FormLinkageRule[]) || [];
  if (!linkageRules.length) return false;
  const triggerWidgetIds = (copyContext?.resetFieldUIDs || [])
    .filter(fieldUID => fieldUID.split(".").length === 1);
  if (!triggerWidgetIds.length) return false;

  return await replayFormTopLevelLinkage(
    formWidget.value.getRunnableFieldsFilling(linkageRules),
    triggerWidgetIds,
    "[NocodeForm] rerunCopyLinkage reached max executions",
  );
}

const syncCopyCalculatedWidgets = (widgets: FormElement[] = [], row: Row = {}, options: { silent?: boolean } = {}) => {
  const { silent = false } = options;
  for (const widget of widgets) {
    if (widget.getSoul?.().type === "widget.form.subform") {
      const subRows = Array.isArray(row?.[widget.fieldId]) ? row[widget.fieldId] : [];
      widget.inputValue = subRows;

      const subFormRows = (((widget as any).tableData || []) as any[]);
      subFormRows.forEach((subFormRow, index) => {
        const subRow = subRows[index] || {};
        subFormRow.setRow?.(subRow);
        syncCopyCalculatedWidgets(subFormRow.children || [], subRow, options);
      });
      continue;
    }

    const nextValue = row?.[widget.fieldId];
    if (silent) {
      widget.setInputValueNotChanged(deepClone(nextValue));
      continue;
    }
    widget.inputValue = nextValue;
  }
}

const syncCurrentFormRowState = () => {
  if (!formWidget.value) return;
  formWidget.value.setRow({
    ...(formWidget.value.getRow?.() || {}),
    ...formWidget.value.serialize(),
  });
}

const emitAutoSubmitEvent = (payload: { type: "fieldEnter" | "mobileScan"; fieldUid?: string; value?: any }) => {
  autoSubmitHandlers.value.forEach(handler => handler(payload));
}

// Only recompute reset fields explicitly recorded in copyContext.
// Downstream formula/default updates outside this set continue to rely on existing widget watchers.
const applyCopyResetCalculations = async (copyContext = getCopyContext(props.row)) => {
  if (!copyContext || !formWidget.value || !table.value || !formData.value) return false;

  const { defaultFields, formulaFields, quickComputeFields } = getCopyContextCalculationFields(copyContext, table.value, formData.value);
  const visibleDefaultFields = filterCalculationFieldsByCurrentVisibility(defaultFields, { allowBusinessHidden: true });
  const visibleFormulaFields = filterCalculationFieldsByCurrentVisibility(formulaFields);
  const visibleQuickComputeFields = filterCalculationFieldsByCurrentVisibility(quickComputeFields);
  if (!visibleDefaultFields.length && !visibleFormulaFields.length && !visibleQuickComputeFields.length) return false;

  const nextRow = formWidget.value.serialize();
  const previousRow = deepClone(nextRow);
  hydrateCalculatedSubformDefaultRows(nextRow, [...visibleDefaultFields, ...visibleFormulaFields, ...visibleQuickComputeFields]);
  rowsDefaultValueCalculation([nextRow], { defaultFields: visibleDefaultFields, formulaFields: visibleFormulaFields }, table.value, formData.value);
  await applyQuickComputeDefaultFields(nextRow, visibleQuickComputeFields);
  if (equals(previousRow, nextRow)) return false;

  formWidget.value.setRow({
    ...(formWidget.value.getRow?.() || {}),
    ...nextRow,
  });
  syncCopyCalculatedWidgets(formWidget.value.formInputs || [], nextRow);
  return true;
}

const applyCopyContext = async () => {
  const copyContext = getCopyContext(props.row);
  if (!copyContext) return;

  const maxPasses = 4;
  for (let pass = 0; pass < maxPasses; pass += 1) {
    const resetChanged = await applyCopyResetCalculations(copyContext);
    const linkageChanged = await rerunCopyLinkage(copyContext);
    if (!linkageChanged && !resetChanged) break;

    if (pass === maxPasses - 1) {
      console.warn("[NocodeForm] applyCopyContext reached max passes");
    }
  }

  syncCurrentFormRowState();
}

const handleSubmit = async (options?: { skipSubmitValidationNoticeConfirm?: boolean; skipSubmitSignSyncConfirm?: boolean }) => {
  if (isSubmitting.value) return false;
  if (isPreview.value) {
    ElMessage.warning(i18next.t('NocodeForm.previewNoSubmit'));
    return false;
  }
  if ((props.visibleFieldIds?.length || 0) > 0 && effectiveVisibleFieldIds.value.length === 0) {
    ElMessage.warning(i18next.t('NocodeForm.noEditableFields'));
    return false;
  }
  isSubmitting.value = true;
  try {
    const shouldConfirmSubmitValidationNotice = !options?.skipSubmitValidationNoticeConfirm;
    const shouldConfirmSubmitSignSync = !options?.skipSubmitSignSyncConfirm;
    let row: object | null = null;
    if (shouldConfirmSubmitValidationNotice) {
      const confirmed = shouldConfirmSubmitSignSync
        ? await confirmSubmitBeforeMutation()
        : await confirmSubmitValidationNotice();
      if (!confirmed) {
        clearSubmitValidationNotice();
        return false;
      }
      row = preparedSubmitRow.value;
    } else {
      row = hasPreparedSubmitRow.value ? preparedSubmitRow.value : await prepareSubmitRow();
      if (!row) {
        clearSubmitValidationNotice();
        return false;
      }
      if (shouldConfirmSubmitSignSync) {
        const isSignSynced = await validateSubmitSignSync();
        if (!isSignSynced) {
          const confirmed = await confirmSubmitWhenSignNotSynced();
          if (!confirmed) {
            resetPreparedSubmitRow();
            return false;
          }
        }
      }
    }
    const submitOptions = shouldConfirmSubmitValidationNotice
      ? { ...(options || {}), skipSubmitValidationNoticeConfirm: true, preparedRow: row }
      : { ...(options || {}), preparedRow: row };
    const res = await formWidget.value?.submit(submitOptions).catch((err) => {
      ElMessage.error(err.message);
      return false;
    });
    resetPreparedSubmitRow();
    if (!res) {
      const invalidInputs = (formWidget.value?.formInputs || []).filter(item => item.validationError).map(item => ({
        fieldId: item.fieldId,
        title: item.title,
        validationError: item.validationError,
        inputValue: item.inputValue,
        isRequired: item.isRequired,
        isHidden: item.isHidden,
      }));
      console.warn('[NocodeForm] submit blocked', {
        invalidInputs,
        currentRow: formWidget.value?.getRow?.() ?? {},
      });
      console.error(i18next.t('NocodeForm.formSubmitFail'));
      return false;
    }
    await flushPendingAppendFormFieldChoices();
    return res?.data;
  } finally {
    isSubmitting.value = false;
  }
}

const draftStorage = storeFactory(`TABLE_DRAFT_${tableId.value}`);
const serialize = () =>{
  return formWidget.value.serialize();
}

const resetAddingRowIdentity = async () => {
  if (!formWidget.value?.isAddingRow) return;
  const uuid = unique();
  formWidget.value.rowId = uuid;
  formWidget.value.setRow({
    ...(formWidget.value.getRow() || {}),
    [SystemField.UUID]: uuid,
  });
  await nextTick();
  await captureInitialFormSnapshot();
}

const resetPreparedSubmitRow = () => {
  preparedSubmitRow.value = null;
  hasPreparedSubmitRow.value = false;
}

const prepareSubmitRow = async (options: { applyHiddenFieldSubmitPolicy?: boolean } = {}) => {
  const row = await formWidget.value.prepareSubmitRow(options);
  if (!row) {
    resetPreparedSubmitRow();
    return false;
  }
  preparedSubmitRow.value = row;
  hasPreparedSubmitRow.value = true;
  return row;
}

const getSubmitValidationNotice = () => {
  return formWidget.value?.submitValidationNotice ?? null;
}

const submitValidationDialogMessages = computed(() => {
  const notice = getSubmitValidationNotice();
  if (!notice?.messages?.length || notice.allowNoticeMode !== FormSubmitAllowNoticeMode.DIALOG) {
    return [];
  }
  return notice.messages;
});

const resolveSubmitValidationDialog = (confirmed: boolean) => {
  const resolver = submitValidationDialogResolver.value;
  submitValidationDialogResolver.value = null;
  submitValidationDialogResolved.value = true;
  submitValidationDialogVisible.value = false;
  resolver?.(confirmed);
}

const handleSubmitValidationDialogConfirm = () => {
  resolveSubmitValidationDialog(true);
}

const handleSubmitValidationDialogCancel = () => {
  if (!submitValidationDialogResolver.value || submitValidationDialogResolved.value) {
    return;
  }
  resolveSubmitValidationDialog(false);
}

const confirmSubmitValidationNotice = async () => {
  const row = hasPreparedSubmitRow.value ? preparedSubmitRow.value : await prepareSubmitRow();
  if (!row) {
    return false;
  }
  if (!submitValidationDialogMessages.value.length) {
    return true;
  }
  submitValidationDialogResolved.value = false;
  submitValidationDialogVisible.value = true;
  return await new Promise<boolean>((resolve) => {
    submitValidationDialogResolver.value = resolve;
  });
}

const confirmSubmitBeforeMutation = async (options?: ConfirmSubmitBeforeMutationOptions) => {
  const confirmed = await confirmSubmitValidationNotice();
  if (!confirmed) {
    return false;
  }
  const isSignSynced = await validateSubmitSignSync();
  if (isSignSynced) {
    return true;
  }
  return await confirmSubmitWhenSignNotSynced(options?.onSignSyncConflict);
}

const clearSubmitValidationNotice = () => {
  if (submitValidationDialogResolver.value && !submitValidationDialogResolved.value) {
    resolveSubmitValidationDialog(false);
  } else {
    submitValidationDialogVisible.value = false;
    submitValidationDialogResolver.value = null;
    submitValidationDialogResolved.value = false;
  }
  resetPreparedSubmitRow();
  formWidget.value?.clearSubmitValidationNotice?.();
}

const getCurrentFormSnapshot = () => {
  const row = formWidget.value?.getRow?.() ?? {};
  const serializedRow = formWidget.value?.serialize?.() ?? {};
  return createFormSnapshot(
    stripCopyTransientState(row) ?? {},
    stripCopyTransientState(serializedRow) ?? {},
  );
}

const captureInitialFormSnapshot = async (preserveExistingSnapshot = false) => {
  const snapshot = await captureStableFormSnapshot(getCurrentFormSnapshot);
  if (preserveExistingSnapshot && initialRow.value) {
    return;
  }
  initialRow.value = snapshot;
  hasFormUserEdited.value = false;
}

const markFormUserEdited = () => {
  if (initSuccessed.value && !initialRow.value && formWidget.value) {
    initialRow.value = getCurrentFormSnapshot();
  }
  hasFormUserEdited.value = true;
}

const isFormActionTarget = (target: EventTarget | null) => {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(target.closest([
    '.el-input',
    '.el-select',
    '.el-checkbox',
    '.el-radio',
    '.el-switch',
    '.el-date-editor',
    '.el-upload',
    '.el-rate',
    '.el-slider',
    '.el-color-picker',
    '.el-cascader',
    '.el-button',
    '[contenteditable=true]',
    'input',
    'textarea',
    'select',
    'button',
  ].join(',')));
}

const handleFormClick = (event: MouseEvent) => {
  if (isFormActionTarget(event.target)) {
    markFormUserEdited();
  }
}

const isCurrentFormModified = () => {
  if (!initialRow.value) {
    return false;
  }

  const currentSnapshot = getCurrentFormSnapshot();
  if (isSameFormSnapshot(initialRow.value, currentSnapshot)) {
    return false;
  }

  if (!hasFormUserEdited.value) {
    initialRow.value = currentSnapshot;
    return false;
  }

  return true;
}

const handleAddDraft = async () => {
  const row = serialize();
  row[formWidget.value.keyFieldId] = formWidget.value.rowId;
  if (runtime === FormTableRuntime.FORM_VIEWER) {
    await formDataApi.addDraft({
      formData: formData.value,
      nocodeId,
      tableUID: tableId.value,
      rows: [ row ],
      sign: getTargetNocodeSign(),
      onMainSign: updateMainSign,
    });
  } else {
    const drafts = draftStorage.get() || [];
    const field = table.value.fields.find(item => item.meta.name === SystemField.UPDATE_TIME);
    draftStorage.set(drafts.concat({
      ...row,
      [field.uid]: Date.now(),
    }));
  }
}

const stash = async (options?: {
  todo?: {
    nocodeId: string,
    tableId: TableUID,
    uuid: string,
    flowId: string,
    todoId: string,
    id: string,
    data?: Row,
    type?: ProcessNodeType,
  },
  row?: Row,
}) => {
  const row = options?.row || (await prepareSubmitRow());
  if (!row) {
    clearSubmitValidationNotice();
    return false;
  }

  if (options?.todo) {
    const res = await formFlowApi.stashTodo({
      nocodeId: options.todo.nocodeId,
      tableId: options.todo.tableId,
      uuid: options.todo.uuid,
      flowId: options.todo.flowId,
      todoId: options.todo.todoId,
      id: options.todo.id,
      row: options.todo.type === ProcessNodeType.REPORT_DATA ? row : {
        ...(options.todo.data || {}),
        ...row,
      },
    }).catch((err) => {
      ElMessage.error(err?.message || i18next.t('NocodeForm.stashFailed'));
      return false;
    });
    resetPreparedSubmitRow();
    return res || false;
  }

  if (!formData.value || !tableId.value) {
    resetPreparedSubmitRow();
    return false;
  }
  const process = formData.value.formOptions?.[tableId.value]?.process;
  const isEditingCurrentRow = Boolean(uuid);
  const stashEnabled = isEditingCurrentRow
    ? isDataChangeTriggerStashEnabled(process, DataChangeType.EDIT)
    : isDataChangeTriggerStashEnabled(process, DataChangeType.ADD);
  if (!stashEnabled) {
    ElMessage.warning(i18next.t('NocodeForm.stashUnavailable'));
    resetPreparedSubmitRow();
    return false;
  }
  try {
    let res;
    if (isEditingCurrentRow) {
      const uuidField = getUUIDSystemField(table.value?.fields || []);
      if (!uuidField?.uid) {
        resetPreparedSubmitRow();
        return false;
      }
      res = await formDataApi.updateData({
        formData: formData.value,
        nocodeId,
        tableUID: tableId.value,
        rows: [{
          ...row,
          [uuidField.uid]: uuid,
        }],
        keys: [[formData.value.uid, tableId.value, uuidField.uid]],
        updateFieldIds: getEffectiveSubmitFieldIds(),
        viewActionContext: props.viewActionContext,
        runtime,
        stashFlow: true,
        sign: getTargetNocodeSign(),
        onMainSign: updateMainSign,
      });
    } else {
      res = await formDataApi.addData({
        formData: formData.value,
        nocodeId,
        tableUID: tableId.value,
        rows: [row],
        runtime,
        stashFlow: true,
        sign: getTargetNocodeSign(),
        onMainSign: updateMainSign,
      });
    }
    resetPreparedSubmitRow();
    const affectedRows = Array.isArray(res?.data) ? res.data : [];
    const dataUid = affectedRows[0]?.[SystemField.UUID] || uuid;
    if (!dataUid) {
      return false;
    }
    return {
      dataUid,
      data: affectedRows,
      isStashed: true,
    };
  } catch (err) {
    ElMessage.error(err?.message || i18next.t('NocodeForm.stashFailed'));
    resetPreparedSubmitRow();
    return false;
  }
}
onMounted(async () => {
  await init();
});

defineExpose({
  submit: async (options?: { skipSubmitValidationNoticeConfirm?: boolean; skipSubmitSignSyncConfirm?: boolean }) => {
    return await handleSubmit(options);
  },
  getTargetNocodeSign: (targetId?: string) => {
    return getTargetNocodeSign(targetId);
  },
  prepareSubmitRow: async () => {
    return await prepareSubmitRow();
  },
  confirmSubmitValidationNotice: async () => {
    return await confirmSubmitValidationNotice();
  },
  confirmSubmitBeforeMutation: async (options?: ConfirmSubmitBeforeMutationOptions) => {
    return await confirmSubmitBeforeMutation(options);
  },
  notifySubmitValidationMessages: () => {
    formWidget.value?.notifySubmitValidationMessages?.();
  },
  clearSubmitValidationNotice: () => {
    clearSubmitValidationNotice();
  },
  getSubmitValidationNotice: () => {
    return getSubmitValidationNotice();
  },
  saveDraft: async () => {
    return await handleAddDraft(); 
  },
  resetAddingRowIdentity,
  stash: async (options?: {
    todo?: {
      nocodeId: string,
      tableId: TableUID,
      uuid: string,
      flowId: string,
      todoId: string,
      id: string,
      data?: Row,
      type?: ProcessNodeType,
    },
    row?: Row,
  }) => {
    return await stash(options);
  },
  getFormRow: () => {
    const row = formWidget.value?.getRow() ?? {}
    const _row = formWidget.value?.serialize() ?? {}
    return stripCopyTransientState({ ...row, ..._row }) ?? {};
  },
  getCurrentTable: () => table.value,
  getCurrentFormData: () => formData.value,
  getFormWidget: () => formWidget.value,
  serialize,
  getEditableVisibleFieldIds: () => effectiveVisibleFieldIds.value,
  setHiddenFields: (fields: string[]) => {
    hiddenFields.value = fields || [];
    syncHiddenFields();
  },
  setForceHiddenFields: (fields: string[]) => {
    formWidget.value?.setForceHiddenFields(fields);
  },
  isModified: () => {
    return isCurrentFormModified();
  },
  registerAutoSubmitHandler: (handler: (payload: { type: "fieldEnter" | "mobileScan"; fieldUid?: string; value?: any }) => void) => {
    autoSubmitHandlers.value.push(handler);
    return () => {
      autoSubmitHandlers.value = autoSubmitHandlers.value.filter(item => item !== handler);
    };
  },
})

// b2-board
const activeBoard = computed(() => board.value);
const visible = computed(() => true);
provide(ALL_BOARD, null);
provide(ACTIVE_BOARD, activeBoard);
provide(VISIBLE, visible);
provide(ORGANIZE_UTIL, organizeUtil);
provide(IS_MOBILE_FULLSCREEN, ref(false));
provide(CO_EDITING_ACCOUNTS, ref([]));
provide(CUR_CO_EDITING_ACCOUNT, ref(null));
provide(EDIT_BOARD_MODULE, async (uid) => true);
provide(SELECTED_WIDGETS, ref([]));
provide(PROJECT_ID, "");
provide(ACTIVE_CONTAINER, null);
provide(PROJECT_TABLE_DRAGGING, ref(false));
const project = ref<ProjectBody>();
provide(PROJECT, project);
const allBoardDom = ref<{ [key: string]: HTMLElement }>({});
provide(ALL_BOARD_DOM, allBoardDom);
const activeBoardId = ref(board.value?.uid);
provide(ACTIVE_BOARD_ID, activeBoardId);
const foreBackZoomXY = ref({ zoom: 1, x: 0, y: 0 });
provide(FORE_BACK_ZOOM_X_Y, foreBackZoomXY);

// b2-widget
provide(HAS_WIDGET_MOUNTED, ref(false));
provide(HOVER_WIDGET, ref(null));
provide("FORM_AUTO_SUBMIT_EMITTER", emitAutoSubmitEvent);
</script>

<style scoped lang='scss'>
.nocode-form {
  position: relative; // 添加相对定位以便子元素绝对定位
  width: 100%;
  height: 100%;
  min-height: 200px;

  :deep(.board) {
    background-color: transparent !important;

    .board-view {
      background-color: transparent !important;

      .b2widget {
        max-width: 100%;

        &[type="widget.form.form"] {
          width: 100% !important;
          height: 100% !important;
        }
      }
    }

    .b2-board {
      user-select: auto;
    }
  }

  .empty-form-bg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    img {
      width: 120px;
      height: 120px;
    }
    .tip {
      font-size: 12px;
      color: rgb(134, 144, 156);
      margin-top: 8px;
    }
  }
}

.submit-validation-notice-dialog {
  :deep(.el-dialog) {
    border-radius: 8px;
    overflow: hidden;
    padding: 0;

    .submit-validation-notice-dialog__body {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    
    .submit-validation-notice-dialog__icon {
      margin-top: 2px;
      color: var(--el-color-warning);
      font-size: 20px;
      flex-shrink: 0;
    }
    
    .submit-validation-notice-dialog__messages {
      display: flex;
      flex-direction: column;
      gap: 8px;
      color: var(--text-color);
      line-height: 1.5;
      word-break: break-word;
    }
    
    .submit-validation-notice-dialog__message {
      white-space: pre-wrap;
    }
    
    .submit-validation-notice-dialog__footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  }

  :deep(.el-dialog__header) {
    margin: 0;
    height: 48px;
    padding: 12px 20px;
    border-bottom: 1px solid var(--border-color);
  }

  :deep(.el-dialog__body) {
    padding: 24px 20px;
  }

  :deep(.el-dialog__footer) {
    height: 64px;
    padding: 16px 20px;
    border-top: 1px solid var(--border-color);

    .el-button {
      border-radius: 4px;
    }
  }
}
</style>
