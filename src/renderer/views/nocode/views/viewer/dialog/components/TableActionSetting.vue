<template>
  <div class="table-action-setting" :class="{ expanded: detailPanelVisible }">
    <div class="aside-pane">
      <div class="aside-header">
        <span class="title">{{ $t("TableActionSetting.actionListTitle") }}</span>
        <el-button type="primary" link @click="handleAddAction">
          <el-icon><i-ep-plus /></el-icon>
          <span>{{ $t("TableActionSetting.addAction") }}</span>
        </el-button>
      </div>
      <div class="aside-body">
        <VueDraggable
          v-if="localActions.length"
          v-model="localActions"
          item-key="id"
          handle=".drag-handle"
          class="action-list"
          @end="syncOrder"
        >
          <template #item="{ element }">
            <div
              class="action-item"
              :class="{ active: element.id === activeActionId }"
              tabindex="0"
              @click="handleSelectAction(element.id)"
              @focus="handleSelectAction(element.id)"
            >
              <div class="drag-handle">
                <el-icon :size="16"><i-icon-park-outline-drag /></el-icon>
              </div>
              <div class="content">
                <div class="name" :title="element.name || element.display?.label">
                  {{ element.name || element.display?.label }}
                </div>
                <div class="meta">
                  <span>{{ getTargetText(element.target) }}</span>
                  <span>{{ getBehaviorText(element.behavior.type) }}</span>
                </div>
              </div>
              <div class="action-tools">
                <el-button link @click.stop="handleEditAction(element.id)">
                  <el-icon :size="16"><i-ep-edit /></el-icon>
                </el-button>
                <el-button link @click.stop="handleCopyAction(element.id)">
                  <el-icon :size="16"><i-ep-copy-document /></el-icon>
                </el-button>
                <el-button link type="danger" @click.stop="handleRemoveAction(element.id)">
                  <el-icon :size="16"><i-ep-delete /></el-icon>
                </el-button>
              </div>
            </div>
          </template>
        </VueDraggable>
        <div v-else class="empty">{{ $t("TableActionSetting.emptyActionList") }}</div>
      </div>

    </div>

    <div
      class="main-pane"
      :class="{ 'is-visible': detailPanelContentVisible }"
      :aria-hidden="!detailPanelContentVisible"
      :inert="!detailPanelContentVisible"
    >
      <template v-if="currentAction">
        <div class="main-header">
          <el-button
            link
            class="collapse-btn"
            :title="$t('TableActionSetting.collapseActionSetting')"
            :aria-label="$t('TableActionSetting.collapseActionSetting')"
            @click="handleCollapseDetail"
          >
            <el-icon><i-ep-arrow-right /></el-icon>
          </el-button>
        </div>
        <el-scrollbar class="main-scrollbar">
          <div class="section">
            <div class="section-title">{{ $t("TableActionSetting.basicInfo") }}</div>
            <div class="form-grid">
              <el-form-item :label="$t('TableActionSetting.actionName')" required :error="currentActionNameError">
                <el-input
                  ref="actionNameInputRef"
                  v-model="currentAction.name"
                  :placeholder="$t('TableActionSetting.actionNamePlaceholder')"
                  @input="handleActionNameInput"
                />
              </el-form-item>
              <el-form-item :label="$t('TableActionSetting.actionType')">
                <el-input :model-value="($t('TableActionSetting.buttonActionType') as string)" disabled />
              </el-form-item>
              <el-form-item :label="$t('TableActionSetting.actionTarget')" required class="full-width">
                <el-radio-group v-model="currentAction.target" @change="handleTargetChange">
                  <el-radio :value="ViewActionTarget.VIEW_ALL">{{ $t("TableActionSetting.currentViewAll") }}</el-radio>
                  <el-radio :value="ViewActionTarget.VIEW_SELECTED">{{ $t("TableActionSetting.currentViewSelected") }}</el-radio>
                  <el-radio :value="ViewActionTarget.RECORD">{{ $t("TableActionSetting.singleRecord") }}</el-radio>
                </el-radio-group>
              </el-form-item>
              <el-form-item :label="$t('TableActionSetting.actionDescription')" class="full-width">
                <el-input
                  v-model="currentAction.description"
                  type="textarea"
                  :rows="3"
                  :placeholder="$t('TableActionSetting.actionDescriptionPlaceholder')"
                />
              </el-form-item>
            </div>
          </div>

          <div class="section">
            <div class="section-title">{{ $t("TableActionSetting.displaySetting") }}</div>
            <div class="form-grid">
              <el-form-item :label="$t('TableActionSetting.buttonName')" required :error="currentDisplayLabelError">
                <el-input
                  ref="displayLabelInputRef"
                  v-model="currentAction.display.label"
                  :placeholder="$t('TableActionSetting.buttonNamePlaceholder')"
                  @input="handleDisplayLabelInput"
                >
                  <template #suffix>
                    <el-tooltip
                      v-if="isCurrentActionLabelManual"
                      placement="top"
                      effect="light"
                      :content="getDisplayLabelResetTip()"
                    >
                      <el-icon
                        class="display-label-reset-icon"
                        role="button"
                        tabindex="0"
                        :aria-label="getDisplayLabelResetTip()"
                        @click.stop="resetDisplayLabelSync"
                        @keydown.enter.stop.prevent="resetDisplayLabelSync"
                        @keydown.space.stop.prevent="resetDisplayLabelSync"
                      >
                        <i-ep-refresh-right />
                      </el-icon>
                    </el-tooltip>
                  </template>
                </el-input>
              </el-form-item>
              <el-form-item :label="$t('TableActionSetting.displayPlacement')" required>
                <el-input :model-value="placementLabel" disabled v-if="isViewTarget(currentAction.target)" />
                <el-select v-else v-model="currentAction.display.placement" :placeholder="$t('TableActionSetting.displayPlacementPlaceholder')">
                  <el-option :value="ViewActionPlacement.TABLE_ACTION_COLUMN" :label="$t('TableActionSetting.displayPlacementTableActionColumn')+''" />
                  <el-option :value="ViewActionPlacement.DETAIL_HEADER" :label="$t('TableActionSetting.displayPlacementDetailHeader')+''" />
                </el-select>
              </el-form-item>
              <el-form-item :label="$t('TableActionSetting.buttonStyle')">
                <el-radio-group v-model="currentAction.display.style">
                  <el-radio :value="ViewActionButtonStyle.SOLID">{{ $t("TableActionSetting.buttonStyleSolid") }}</el-radio>
                  <el-radio :value="ViewActionButtonStyle.OUTLINE">{{ $t("TableActionSetting.buttonStyleOutline") }}</el-radio>
                </el-radio-group>
              </el-form-item>
              <el-form-item :label="$t('TableActionSetting.buttonColorAndIcon')">
                <el-popover
                  placement="bottom-start"
                  :width="320"
                  trigger="click"
                  :teleported="false"
                  popper-class="table-action-icon-selector-popper"
                >
                  <template #reference>
                    <div class="icon-selector-trigger" role="button" tabindex="0">
                      <span class="icon-preview" :style="buttonColorStyle">
                        <el-icon :size="16" color="#fff">
                          <component :is="currentAction.display.icon || 'i-ep-plus'" />
                        </el-icon>
                      </span>
                    </div>
                  </template>
                  <div class="icon-selector-panel">
                    <icon-selector
                      v-model:color="currentAction.display.color"
                      v-model:icon="currentAction.display.icon"
                      :maxRows="6"
                      scroll-mode="rows"
                    />
                  </div>
                </el-popover>
              </el-form-item>
              <el-form-item :label="$t('TableActionSetting.buttonPreview')" class="full-width">
                <el-button :style="buttonPreviewStyle" :plain="currentAction.display.style === ViewActionButtonStyle.OUTLINE">
                  <el-icon v-if="currentAction.display.icon" :size="14">
                    <component :is="currentAction.display.icon" />
                  </el-icon>
                  <span>{{ currentAction.display.label || currentAction.name || $t("TableActionSetting.newAction") }}</span>
                </el-button>
              </el-form-item>
            </div>
          </div>

          <div class="section">
            <div class="section-title">{{ $t("TableActionSetting.behaviorSetting") }}</div>
            <div class="form-grid">
              <el-form-item :label="$t('TableActionSetting.actionBehavior')" required class="full-width">
                <el-radio-group v-model="currentAction.behavior.type" @change="handleBehaviorChange">
                  <el-radio
                    v-for="item in behaviorOptions"
                    :key="item.value"
                    :value="item.value"
                  >
                    {{ item.label }}
                  </el-radio>
                </el-radio-group>
              </el-form-item>
              <div class="tip full-width" v-if="currentAction.behavior.type === ViewActionBehaviorType.CREATE_RECORD">
                {{ $t("TableActionSetting.addDataConditionDesc") }}
              </div>
            </div>

            <div class="behavior-panel" v-if="currentAction.behavior.type === ViewActionBehaviorType.TRIGGER_PROCESS">
              <el-form-item
                v-if="isViewTarget(currentAction.target)"
                :label="$t('TableActionSetting.triggerMode')"
                required
                class="full-width"
              >
                <el-radio-group v-model="triggerProcessTriggerMode">
                  <el-radio
                    v-for="item in triggerModeOptions"
                    :key="item.value"
                    :value="item.value"
                  >
                    {{ item.label }}
                  </el-radio>
                </el-radio-group>
              </el-form-item>
              <el-form-item :label="$t('TableActionSetting.relatedTriggerNode')" required class="full-width">
                <el-select
                  v-model="triggerProcessConfig.triggerNodeId"
                  :placeholder="$t('TableActionSetting.relatedTriggerNodePlaceholder')"
                  :empty-values="[undefined, null, '']"
                  :disabled="isViewTarget(currentAction.target) && !isTriggerModeSelected"
                  @change="handleTriggerNodeChange"
                >
                  <el-option
                    v-for="item in operationTriggerNodeOptions"
                    :key="item.uid"
                    :label="item.label"
                    :value="item.uid"
                    :disabled="item.disabled"
                  />
                </el-select>
              </el-form-item>
              <div class="tip trigger-conflict-tip" v-if="currentTriggerProcessConflict">
                {{ formatTriggerNodeConflictMessage(currentTriggerProcessConflict) }}
              </div>
              <div class="tip" v-if="showViewContextOnceTriggerTip">
                {{ $t("TableActionSetting.viewContextOnceTip") }}
              </div>
              <div class="tip" v-else-if="showViewContextEachTriggerTip">
                {{ $t("TableActionSetting.viewContextEachTip") }}
              </div>
              <div class="tip" v-if="!operationTriggerNodes.length">
                {{ $t("TableActionSetting.noOperationTriggerNode") }}
              </div>
            </div>

            <div class="behavior-panel" v-else-if="currentAction.behavior.type === ViewActionBehaviorType.CREATE_RECORD">
              <el-form-item :label="$t('TableActionSetting.targetForm')" required class="full-width">
                <el-select v-model="createRecordTargetFormId" :placeholder="$t('TableActionSetting.targetFormPlaceholder')">
                  <el-option
                    v-for="item in targetFormOptions"
                    :key="item.uid"
                    :label="item.alias"
                    :value="item.uid"
                  />
                </el-select>
              </el-form-item>
              <target-form-field
                :tableUID="createRecordTargetFormId"
                :targetFields="createFieldRules"
                :sourceTables="[]"
                :defaultTables="[table]"
                :allowedFillTypes="allowedFillTypes"
                :disallowAutoRelated="true"
                mode="add"
                :titleText="$t('TableActionSetting.targetFieldRule')"
                @update="handleCreateFieldRulesUpdate"
              />
            </div>

            <div class="behavior-panel" v-else-if="currentAction.behavior.type === ViewActionBehaviorType.EDIT_RECORD">
              <view-action-edit-field-setting
                :table="table"
                :fields="editFields"
                @update="handleEditFieldsUpdate"
              />
            </div>
          </div>

          <div class="section">
            <div class="section-title">{{ $t("TableActionSetting.executeCondition") }}</div>
            <div class="condition-box">
              <el-switch
                v-model="currentAction.executeCondition.enabled"
                class="execute-condition-switch"
                :active-text="$t('TableActionSetting.enableExecuteCondition')"
              />
              <template v-if="currentAction.executeCondition.enabled">
                <el-form-item :label="$t('TableActionSetting.conditionTip')" class="full-width">
                  <el-input
                    v-model="currentAction.executeCondition.tip"
                    :placeholder="$t('TableActionSetting.conditionTipPlaceholder')"
                  />
                </el-form-item>

                <template v-if="isViewTarget(currentAction.target)">
                  <el-radio-group v-model="viewConditionMode">
                    <el-radio
                      v-for="item in viewConditionOptions"
                      :key="item.value"
                      :value="item.value"
                    >
                      {{ item.label }}
                    </el-radio>
                  </el-radio-group>
                </template>

                <template v-else>
                  <el-radio-group v-model="recordConditionMode">
                    <el-radio :value="ViewActionRecordConditionMode.ALL">{{ $t("TableActionSetting.matchAllConditions") }}</el-radio>
                    <el-radio :value="ViewActionRecordConditionMode.ANY">{{ $t("TableActionSetting.matchAnyCondition") }}</el-radio>
                  </el-radio-group>
                  <filter-condition-setting-item
                    :filterRule="recordConditionRule"
                    :tableUID="table.uid"
                    :currentFields="table.fields || []"
                    :disableConditionSetting="!currentAction.executeCondition.enabled"
                    :filterTitle="$t('TableActionSetting.conditionConfig')"
                    :targetTitle="$t('TableActionSetting.currentRecordField')"
                  />
                </template>
              </template>
            </div>
          </div>

          <div class="section">
            <div class="section-title">{{ $t("TableActionSetting.permissionDescription") }}</div>
            <div class="permission-tip">
              {{ $t("TableActionSetting.permissionDescriptionText") }}
            </div>
          </div>
        </el-scrollbar>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, reactive, ref, watch } from "vue";
import i18next from "i18next";
import VueDraggable from "vuedraggable";
import { ElMessage } from "element-plus";
import { unique } from "@common/utils/unique";
import { cloneDeep, isEqual } from "lodash";
import { NOCODE } from "@renderer/types";
import {
  FilterRule,
  FormWidgetType,
  FormCondition,
  LogicalOperator,
  ViewAction,
  ViewActionBehaviorType,
  ViewActionButtonStyle,
  ViewActionConditionScope,
  ViewActionDisplay,
  ViewActionEditField,
  ViewActionEditFieldMode,
  ViewActionExecuteCondition,
  ViewActionFieldId,
  ViewActionFieldMapping,
  ViewActionFieldValueType,
  ViewActionLabelSyncMode,
  ViewActionPlacement,
  ViewActionRecordConditionMode,
  ViewActionRecordExecuteCondition,
  ViewActionTarget,
  ViewActionTriggerMode,
  ViewActionViewExecuteCondition,
  ViewActionType,
  ViewActionViewConditionMode,
} from "@common/types/nocode";
import {
  Field,
  FieldUID,
  getOperationTriggerMode,
  OperationTriggerMode,
  ProcessFlow,
  ProcessNodeType,
  Table as ProjectTable,
  TableUID,
  TargetFieldFillRule,
  TargetFieldFillType,
} from "@common/types/project";
import { getFlows, getFormulaStr, handleCopyName, hasConfiguredValue, isSystemField, shouldTreatFieldAsStaticRequired } from "@common/utils";
import { getNocodeDataSourceConnections } from "@common/utils/connection";
import { findWidgetSoulByUID } from "@common/utils/element";
import {
  getDefaultViewActionViewConditionMode,
  canViewActionEditFieldBeConfigured,
  getViewActionTriggerMode,
  isViewActionRecordTarget,
  isViewActionSelectedTarget,
  isViewActionViewTarget,
  isViewActionViewConditionModeAllowed,
  normalizeViewActionTarget,
  normalizeViewActionViewConditionMode,
} from "@common/utils/viewAction";
import FilterConditionSettingItem from "../../../editor/form/process/options/component/FilterConditionSettingItem.vue";
import TargetFormField from "../../../editor/form/process/options/component/TargetFormField.vue";
import IconSelector from "../../../workbench/components/IconSelector.vue";
import ViewActionEditFieldSetting from "./ViewActionEditFieldSetting.vue";

const props = withDefaults(defineProps<{
  table: ProjectTable,
  actions?: ViewAction[],
  detailVisible?: boolean,
  viewId?: string,
}>(), {
  actions: () => [],
  detailVisible: false,
  viewId: "",
});

const emit = defineEmits<{
  (event: "update:detailVisible", value: boolean): void,
}>();

const nocode = inject(NOCODE);
const table = props.table;
const localActions = ref<ViewAction[]>([]);
const activeActionId = ref("");
const hydrating = ref(false);
const isDetailClosing = ref(false);
let detailClosingTimer: ReturnType<typeof window.setTimeout> | null = null;
const actionNameInputRef = ref<any>(null);
const displayLabelInputRef = ref<any>(null);
type BehaviorDraftMap = Partial<Record<ViewActionBehaviorType, ViewAction["behavior"]>>;
type TriggerProcessBindingInfo = {
  triggerNodeId: string,
  actionId: string,
  actionName: string,
  viewId: string,
  viewName: string,
}
const behaviorDraftStore = reactive<Record<string, BehaviorDraftMap>>({});
const lastBehaviorTypeStore = reactive<Record<string, ViewActionBehaviorType>>({});
const lastRecordBehaviorTypeStore = reactive<Record<string, ViewActionBehaviorType>>({});
const lastTargetStore = reactive<Record<string, ViewActionTarget>>({});
const actionPermissionCopySourceStore = reactive<Record<string, string>>({});

const detailVisible = computed({
  get() {
    return !!props.detailVisible;
  },
  set(value: boolean) {
    emit("update:detailVisible", value);
  },
});

const allowedFillTypes = [
  TargetFieldFillType.FIELD,
  TargetFieldFillType.CUSTOM,
  TargetFieldFillType.FORMULA,
  TargetFieldFillType.EMPTY,
];

const tables = computed(() => {
  return getNocodeDataSourceConnections(nocode.value?.body, {
    nocodeId: nocode.value?.meta?.id,
    name: nocode.value?.meta?.name,
  }).flatMap(source => source.tables || []);
});

const isViewTarget = (target?: ViewActionTarget | "view" | "record" | null) => isViewActionViewTarget(target);
const isRecordTarget = (target?: ViewActionTarget | "view" | "record" | null) => isViewActionRecordTarget(target);
const isSelectedTarget = (target?: ViewActionTarget | "view" | "record" | null) => isViewActionSelectedTarget(target);

const getTargetText = (target: ViewActionTarget) => {
  if (isSelectedTarget(target)) {
    return i18next.t("TableActionSetting.currentViewSelected");
  }
  return isViewTarget(target)
    ? i18next.t("TableActionSetting.currentViewAll")
    : i18next.t("TableActionSetting.singleRecord");
};

const getBehaviorText = (type: ViewActionBehaviorType) => {
  if (type === ViewActionBehaviorType.CREATE_RECORD) {
    return i18next.t("TableActionSetting.behaviorCreateRecord");
  }
  if (type === ViewActionBehaviorType.EDIT_RECORD) {
    return i18next.t("TableActionSetting.behaviorEditRecord");
  }
  return i18next.t("TableActionSetting.behaviorTriggerProcess");
};

const behaviorOptions = computed(() => {
  if (isViewTarget(currentAction.value?.target)) {
    return [
      { label: i18next.t("TableActionSetting.behaviorTriggerProcess"), value: ViewActionBehaviorType.TRIGGER_PROCESS },
    ];
  }
  return [
    { label: i18next.t("TableActionSetting.behaviorCreateRecord"), value: ViewActionBehaviorType.CREATE_RECORD },
    { label: i18next.t("TableActionSetting.behaviorEditRecord"), value: ViewActionBehaviorType.EDIT_RECORD },
    { label: i18next.t("TableActionSetting.behaviorTriggerProcess"), value: ViewActionBehaviorType.TRIGGER_PROCESS },
  ];
});

const targetFormOptions = computed(() => {
  return (nocode.value.body.formData?.tables || []).filter((item) => !item.meta?.extra?.primaryTable);
});

const getTargetTableById = (tableId?: TableUID | null) => {
  return tables.value.find(item => item.uid === tableId) || null;
};

const getWidgetOwnerTableUID = (tableId: string) => {
  const target = tables.value.find(table => table.uid === tableId);
  return target?.meta?.extra?.primaryTable?.[1] || tableId;
};

const isCreateTargetFieldExist = (tableId: string, field?: Field) => {
  const widgetOwnerTableUID = getWidgetOwnerTableUID(tableId);
  const widget = nocode.value.body?.formData?.formOptions?.[widgetOwnerTableUID]?.widget;
  const fieldUID = field?.meta?.uid;
  if (!widget || !fieldUID) {
    return false;
  }
  return !!findWidgetSoulByUID([widget], fieldUID);
};

const shouldValidateCreateTargetField = (tableId: string, field?: Field) => {
  return !!field
    && !isSystemField(field)
    && field.meta?.extra?.widgetType !== FormWidgetType.DATE_RANGE_PICKER
    && !field.meta?.extra?.relatedTableUID
    && isCreateTargetFieldExist(tableId, field);
};

const getRequiredCreateTargetFields = (targetTable?: ProjectTable | null) => {
  if (!targetTable) {
    return [];
  }

  return targetTable.fields.flatMap((field) => {
    if (!shouldValidateCreateTargetField(targetTable.uid, field)) {
      return [];
    }

    const subTableUID = field.meta?.extra?.subTableUID?.[1];
    if (!subTableUID) {
      return shouldTreatFieldAsStaticRequired(field)
        ? [{ fieldId: field.uid, alias: field.alias }]
        : [];
    }

    const subTable = getTargetTableById(subTableUID);
    if (!subTable) {
      return [];
    }

    return subTable.fields.flatMap((subField) => {
      if (!shouldValidateCreateTargetField(targetTable.uid, subField) || !shouldTreatFieldAsStaticRequired(subField)) {
        return [];
      }
      return [{
        fieldId: `${field.uid}.${subField.uid}`,
        alias: `${field.alias}.${subField.alias}`,
      }];
    });
  });
};

const hasConfiguredCreateRuleValue = hasConfiguredValue;

const hasCreateTargetFieldDefaultValue = (field?: Field) => {
  const extra = field?.meta?.extra;
  if (!extra) {
    return false;
  }

  if ((extra.defaultValueType === "custom" || extra.linkType === "form") && hasConfiguredValue(extra.defaultValue)) {
    return true;
  }

  return extra.defaultValueType === "formula" && hasConfiguredValue(getFormulaStr(extra.formula));
};

const getCreateTargetFieldByFieldId = (targetTable: ProjectTable, fieldId: string) => {
  const [fieldUID, subFieldUID] = String(fieldId).split(".");
  const field = targetTable.fields.find(item => item.uid === fieldUID);
  if (!field) {
    return null;
  }

  if (!subFieldUID) {
    return field;
  }

  const subTableUID = field.meta?.extra?.subTableUID?.[1];
  if (!subTableUID) {
    return null;
  }

  const subTable = getTargetTableById(subTableUID);
  return subTable?.fields.find(item => item.uid === subFieldUID) || null;
};

const shouldValidateEditTargetField = (field?: Field | null) => {
  return !!field
    && !isSystemField(field)
    && canViewActionEditFieldBeConfigured(field)
    && isCreateTargetFieldExist(props.table.uid, field)
};

const resolveEditTargetFieldByFieldId = (fieldId?: ViewActionFieldId | null) => {
  const [fieldUID, subFieldUID] = String(fieldId || "").split(".");
  const field = props.table.fields.find(item => item.uid === fieldUID);
  if (!shouldValidateEditTargetField(field)) {
    return null;
  }

  if (!subFieldUID) {
    return field;
  }

  const subTableUID = field.meta?.extra?.subTableUID?.[1];
  if (!subTableUID) {
    return null;
  }

  const subTable = getTargetTableById(subTableUID);
  const subField = subTable?.fields.find(item => item.uid === subFieldUID);
  return shouldValidateEditTargetField(subField) ? subField : null;
};

const getCreateFieldMappings = (action: ViewAction) => {
  if (action.behavior.type !== ViewActionBehaviorType.CREATE_RECORD) {
    return [];
  }
  return action.behavior.config.fieldMappings || [];
};

const getActionDisplayName = (action?: ViewAction | null) => {
  const actionName = (action?.name || "").trim();
  if (actionName) {
    return actionName;
  }

  const displayLabel = (action?.display?.label || "").trim();
  return displayLabel || action?.id || i18next.t("TableActionSetting.unnamedButton");
};

const findAction = (actionId?: string) => {
  return localActions.value.find((item) => item.id === actionId);
};

const currentAction = computed(() => {
  return findAction(activeActionId.value) || localActions.value[0] || null;
});

const detailPanelVisible = computed(() => (detailVisible.value || isDetailClosing.value) && !!currentAction.value);
const detailPanelContentVisible = computed(() => detailVisible.value && !!currentAction.value);

const placementLabel = computed(() => {
  return isViewTarget(currentAction.value?.target)
    ? i18next.t("TableActionSetting.displayPlacementViewToolbar")
    : (currentAction.value?.display?.placement === ViewActionPlacement.DETAIL_HEADER
      ? i18next.t("TableActionSetting.displayPlacementDetailHeader")
      : i18next.t("TableActionSetting.displayPlacementTableActionColumn"));
});

const tableProcess = computed(() => {
  return nocode.value.body.formData?.formOptions?.[props.table.uid]?.process;
});

const tableViews = computed(() => {
  return nocode.value.body?.views?.[props.table.uid] || [];
});

const triggerModeOptions: Array<{ label: string, value: ViewActionTriggerMode }> = [
  {
    get label() { return i18next.t("TableActionSetting.triggerModeEachRecord") },
    value: ViewActionTriggerMode.EACH_RECORD,
  },
  {
    get label() { return i18next.t("TableActionSetting.triggerModeOnce") },
    value: ViewActionTriggerMode.VIEW_CONTEXT_ONCE,
  },
];

const DETAIL_PANEL_TRANSITION_FALLBACK_MS = 320;

const getDetailPanelTransitionMs = () => {
  return DETAIL_PANEL_TRANSITION_FALLBACK_MS;
};

const clearDetailClosingTimer = () => {
  if (!detailClosingTimer) {
    return;
  }
  window.clearTimeout(detailClosingTimer);
  detailClosingTimer = null;
};

const openDetailPanel = (actionId?: string) => {
  clearDetailClosingTimer();
  isDetailClosing.value = false;
  if (actionId) {
    activeActionId.value = actionId;
  }
  detailVisible.value = true;
};

const closeDetailPanel = () => {
  if (!detailVisible.value) {
    return;
  }
  clearDetailClosingTimer();
  detailVisible.value = false;
  isDetailClosing.value = true;
  detailClosingTimer = window.setTimeout(() => {
    isDetailClosing.value = false;
    detailClosingTimer = null;
  }, getDetailPanelTransitionMs());
};

const toViewActionTriggerMode = (mode?: ViewActionTriggerMode | null) => {
  return mode === ViewActionTriggerMode.VIEW_CONTEXT_ONCE
    ? ViewActionTriggerMode.VIEW_CONTEXT_ONCE
    : ViewActionTriggerMode.EACH_RECORD;
};

const getTriggerProcessMode = (action?: ViewAction | null) => {
  if (action?.behavior?.type !== ViewActionBehaviorType.TRIGGER_PROCESS) {
    return undefined;
  }
  if (!isViewTarget(action.target)) {
    return ViewActionTriggerMode.EACH_RECORD;
  }
  const mode = action.behavior.config?.triggerMode;
  if (mode === ViewActionTriggerMode.EACH_RECORD || mode === ViewActionTriggerMode.VIEW_CONTEXT_ONCE) {
    return mode;
  }
  return undefined;
};

const getOperationTriggerNodeById = (triggerNodeId?: string | null) => {
  if (!triggerNodeId) {
    return null;
  }
  return operationTriggerNodes.value.find((item) => item.uid === triggerNodeId) || null;
};

const getViewConditionOptionsByTriggerMode = (
  triggerMode: ViewActionTriggerMode,
  target?: ViewActionTarget | "view" | "record" | null,
) => {
  const options: Array<{ label: string, value: ViewActionViewConditionMode }> = [
    {
      label: i18next.t("TableActionSetting.viewConditionAlways"),
      value: ViewActionViewConditionMode.ALWAYS,
    },
    {
      label: i18next.t("TableActionSetting.viewConditionHasData"),
      value: ViewActionViewConditionMode.HAS_DATA,
    },
  ];

  if (triggerMode === ViewActionTriggerMode.VIEW_CONTEXT_ONCE && !isSelectedTarget(target)) {
    options.push({
      label: i18next.t("TableActionSetting.viewConditionNoData"),
      value: ViewActionViewConditionMode.NO_DATA,
    });
  }

  return options;
};

const normalizeTriggerProcessConfig = (action?: ViewAction | null) => {
  if (!action || action.behavior.type !== ViewActionBehaviorType.TRIGGER_PROCESS) {
    return;
  }

  action.behavior.config.processId = action.behavior.config.processId || props.table.uid;
  action.behavior.config.triggerNodeId = typeof action.behavior.config.triggerNodeId === "string"
    ? action.behavior.config.triggerNodeId
    : "";
  if (!isViewTarget(action.target)) {
    action.behavior.config.triggerMode = ViewActionTriggerMode.EACH_RECORD;
    const triggerNode = getOperationTriggerNodeById(action.behavior.config.triggerNodeId);
    if (triggerNode && getOperationTriggerMode(triggerNode.options) !== OperationTriggerMode.EACH_RECORD) {
      action.behavior.config.triggerNodeId = "";
    }
    return;
  }
  const currentTriggerMode = getTriggerProcessMode(action);
  if (currentTriggerMode) {
    action.behavior.config.triggerMode = currentTriggerMode;
    return;
  }

  if (!isViewTarget(action.target) || !action.behavior.config.triggerNodeId) {
    action.behavior.config.triggerMode = currentTriggerMode;
    return;
  }

  const triggerNode = getOperationTriggerNodeById(action.behavior.config.triggerNodeId);
  action.behavior.config.triggerMode = triggerNode
    ? toViewActionTriggerMode(getOperationTriggerMode(triggerNode.options))
    : ViewActionTriggerMode.EACH_RECORD;
};

const normalizeViewExecuteConditionByTriggerMode = (action?: ViewAction | null) => {
  if (!action || !isViewTarget(action.target)) {
    return;
  }

  const triggerMode = getTriggerProcessMode(action);
  if (!triggerMode) {
    return;
  }
  const executeCondition = action.executeCondition as ViewActionViewExecuteCondition;
  executeCondition.enabled = executeCondition.enabled ?? true;
  executeCondition.scope = ViewActionConditionScope.VIEW;
  if (isSelectedTarget(action.target) && executeCondition.mode === ViewActionViewConditionMode.NO_DATA) {
    executeCondition.mode = ViewActionViewConditionMode.HAS_DATA;
  }
  executeCondition.mode = normalizeViewActionViewConditionMode(triggerMode, executeCondition.mode);
  executeCondition.tip = executeCondition.tip || "";
};

const operationTriggerNodes = computed<ProcessFlow[]>(() => {
  const flows = getFlows(tableProcess.value);
  const result: ProcessFlow[] = [];
  const visit = (items: ProcessFlow[] = []) => {
    for (const flow of items) {
      if (flow.type === ProcessNodeType.TRIGGER_OPERATION) {
        result.push(flow);
      }
      for (const branch of flow.branches || []) {
        visit(branch.flows);
      }
    }
  };
  visit(flows || []);
  return result;
});

const triggerProcessBindings = computed<TriggerProcessBindingInfo[]>(() => {
  const result: TriggerProcessBindingInfo[] = [];
  let currentViewHandled = false;

  for (const view of tableViews.value) {
    const isCurrentView = !!props.viewId && view.uid === props.viewId;
    const actions = isCurrentView ? localActions.value : (view.actions || []);
    currentViewHandled = currentViewHandled || isCurrentView;

    for (const action of actions) {
      if (action?.behavior?.type !== ViewActionBehaviorType.TRIGGER_PROCESS) {
        continue;
      }

      const triggerNodeId = action.behavior.config?.triggerNodeId;
      if (!triggerNodeId) {
        continue;
      }

      result.push({
        triggerNodeId,
        actionId: action.id,
        actionName: getActionDisplayName(action),
        viewId: view.uid,
        viewName: view.name || "",
      });
    }
  }

  if (!currentViewHandled) {
    for (const action of localActions.value) {
      if (action?.behavior?.type !== ViewActionBehaviorType.TRIGGER_PROCESS) {
        continue;
      }

      const triggerNodeId = action.behavior.config?.triggerNodeId;
      if (!triggerNodeId) {
        continue;
      }

      result.push({
        triggerNodeId,
        actionId: action.id,
        actionName: getActionDisplayName(action),
        viewId: props.viewId,
        viewName: "",
      });
    }
  }

  return result;
});

const getTriggerNodeConflict = (action?: ViewAction | null) => {
  if (action?.behavior?.type !== ViewActionBehaviorType.TRIGGER_PROCESS) {
    return null;
  }

  const triggerNodeId = action.behavior.config.triggerNodeId;
  if (!triggerNodeId) {
    return null;
  }

  return triggerProcessBindings.value.find((item) => (
    item.triggerNodeId === triggerNodeId
    && (item.actionId !== action.id || item.viewId !== props.viewId)
  )) || null;
};

const formatTriggerNodeConflictMessage = (conflict: TriggerProcessBindingInfo) => {
  const viewName = (conflict.viewName || "").trim();
  if (viewName) {
    return `${i18next.t("TableActionSetting.triggerNodeConflictViewPrefix")}${viewName}${i18next.t("TableActionSetting.triggerNodeConflictViewMiddle")}${conflict.actionName}${i18next.t("TableActionSetting.triggerNodeConflictSuffix")}`;
  }
  return `${i18next.t("TableActionSetting.triggerNodeConflictPrefix")}${conflict.actionName}${i18next.t("TableActionSetting.triggerNodeConflictSuffix")}`;
};

const operationTriggerNodeOptions = computed(() => {
  return operationTriggerNodes.value.map((item) => {
    const occupiedBy = triggerProcessBindings.value.find((binding) => (
      binding.triggerNodeId === item.uid
      && (binding.actionId !== currentAction.value?.id || binding.viewId !== props.viewId)
    )) || null;
    const baseLabel = item.options?.name || item.uid;
    const nodeTriggerMode = getOperationTriggerMode(item.options);
    const selectedTriggerMode = triggerProcessTriggerMode.value;
    const triggerModeMismatch = currentAction.value?.behavior?.type === ViewActionBehaviorType.TRIGGER_PROCESS
      && (!selectedTriggerMode || nodeTriggerMode !== selectedTriggerMode);
    const suffix = occupiedBy
      ? `${i18next.t("TableActionSetting.triggerNodeOccupiedPrefix")}${occupiedBy.actionName}${i18next.t("TableActionSetting.triggerNodeOccupiedSuffix")}`
      : (triggerModeMismatch
          ? (
            nodeTriggerMode === OperationTriggerMode.VIEW_CONTEXT_ONCE
              ? i18next.t("TableActionSetting.triggerNodeOnlyOnceSuffix")
              : i18next.t("TableActionSetting.triggerNodeOnlyEachSuffix")
          )
          : "");
    return {
      uid: item.uid,
      label: `${baseLabel}${suffix}`,
      disabled: !!occupiedBy || triggerModeMismatch,
    };
  });
});

const currentTriggerProcessConflict = computed(() => {
  return getTriggerNodeConflict(currentAction.value);
});

const triggerProcessConfig = computed(() => {
  if (!currentAction.value || currentAction.value.behavior.type !== ViewActionBehaviorType.TRIGGER_PROCESS) {
    return {
      processId: props.table.uid,
      triggerNodeId: "",
      triggerMode: ViewActionTriggerMode.EACH_RECORD,
    };
  }
  return currentAction.value.behavior.config;
});

const triggerProcessTriggerMode = computed<ViewActionTriggerMode | undefined>({
  get() {
    return getTriggerProcessMode(currentAction.value);
  },
  set(value) {
    if (!currentAction.value || currentAction.value.behavior.type !== ViewActionBehaviorType.TRIGGER_PROCESS) {
      return;
    }

    currentAction.value.behavior.config.triggerMode = value;
    const currentTriggerNode = getOperationTriggerNodeById(currentAction.value.behavior.config.triggerNodeId);
    if (
      currentTriggerNode
      && value
      && getOperationTriggerMode(currentTriggerNode.options) !== value
    ) {
      currentAction.value.behavior.config.triggerNodeId = "";
    }
    if (!isViewTarget(currentAction.value.target)) {
      return;
    }
    if (!value) {
      return;
    }

    const executeCondition = currentAction.value.executeCondition as ViewActionViewExecuteCondition;
    if (
      (isSelectedTarget(currentAction.value.target) || value === ViewActionTriggerMode.EACH_RECORD)
      && executeCondition.mode === ViewActionViewConditionMode.NO_DATA
    ) {
      executeCondition.mode = ViewActionViewConditionMode.HAS_DATA;
      return;
    }

    if (!isViewActionViewConditionModeAllowed(value, executeCondition.mode)) {
      executeCondition.mode = getDefaultViewActionViewConditionMode(value);
    }
  },
});

const isTriggerModeSelected = computed(() => {
  return triggerProcessTriggerMode.value === ViewActionTriggerMode.EACH_RECORD
    || triggerProcessTriggerMode.value === ViewActionTriggerMode.VIEW_CONTEXT_ONCE;
});

const handleTriggerNodeChange = (value?: string) => {
  if (!currentAction.value || currentAction.value.behavior.type !== ViewActionBehaviorType.TRIGGER_PROCESS) {
    return;
  }
  if (!value) {
    currentAction.value.behavior.config.triggerNodeId = "";
    return;
  }
  if (isViewTarget(currentAction.value.target) && !isTriggerModeSelected.value) {
    currentAction.value.behavior.config.triggerNodeId = "";
    return;
  }
};

const viewConditionOptions = computed(() => {
  return getViewConditionOptionsByTriggerMode(
    triggerProcessTriggerMode.value || ViewActionTriggerMode.EACH_RECORD,
    currentAction.value?.target,
  );
});

const showViewContextOnceTriggerTip = computed(() => {
  return isViewTarget(currentAction.value?.target)
    && currentAction.value?.behavior?.type === ViewActionBehaviorType.TRIGGER_PROCESS
    && triggerProcessTriggerMode.value === ViewActionTriggerMode.VIEW_CONTEXT_ONCE;
});

const showViewContextEachTriggerTip = computed(() => {
  return isViewTarget(currentAction.value?.target)
    && currentAction.value?.behavior?.type === ViewActionBehaviorType.TRIGGER_PROCESS
    && triggerProcessTriggerMode.value === ViewActionTriggerMode.EACH_RECORD;
});

const createFieldRules = ref<TargetFieldFillRule[]>([]);
const editFields = ref<ViewActionEditField[]>([]);
const emptyRecordConditions: FormCondition[] = [];

const getCurrentRecordExecuteCondition = () => {
  if (!currentAction.value || !isRecordTarget(currentAction.value.target)) {
    return null;
  }
  return currentAction.value.executeCondition as ViewActionRecordExecuteCondition;
};

const recordConditionRule = reactive<FilterRule>({
  get logic() {
    const executeCondition = getCurrentRecordExecuteCondition();
    return executeCondition?.mode === ViewActionRecordConditionMode.ANY
      ? LogicalOperator.OR
      : LogicalOperator.AND;
  },
  set logic(value: LogicalOperator) {
    const executeCondition = getCurrentRecordExecuteCondition();
    if (!executeCondition) {
      return;
    }
    executeCondition.mode = value === LogicalOperator.OR
      ? ViewActionRecordConditionMode.ANY
      : ViewActionRecordConditionMode.ALL;
  },
  get conditions() {
    const executeCondition = getCurrentRecordExecuteCondition();
    if (!executeCondition) {
      return emptyRecordConditions;
    }
    if (!Array.isArray(executeCondition.conditions)) {
      executeCondition.conditions = [];
    }
    return executeCondition.conditions;
  },
  set conditions(value: FormCondition[]) {
    const executeCondition = getCurrentRecordExecuteCondition();
    if (!executeCondition) {
      return;
    }
    executeCondition.conditions = Array.isArray(value) ? value : [];
  },
});

const viewConditionMode = computed<ViewActionViewConditionMode>({
  get() {
    if (!currentAction.value || !isViewTarget(currentAction.value.target)) {
      return ViewActionViewConditionMode.HAS_DATA;
    }
    return normalizeViewActionViewConditionMode(
      getTriggerProcessMode(currentAction.value) || ViewActionTriggerMode.EACH_RECORD,
      (currentAction.value.executeCondition as any).mode,
    );
  },
  set(value) {
    if (!currentAction.value || !isViewTarget(currentAction.value.target)) {
      return;
    }
    (currentAction.value.executeCondition as any).mode = normalizeViewActionViewConditionMode(
      getTriggerProcessMode(currentAction.value) || ViewActionTriggerMode.EACH_RECORD,
      value,
    );
  },
});

const recordConditionMode = computed<ViewActionRecordConditionMode>({
  get() {
    const executeCondition = getCurrentRecordExecuteCondition();
    return executeCondition?.mode || ViewActionRecordConditionMode.ALL;
  },
  set(value) {
    const executeCondition = getCurrentRecordExecuteCondition();
    if (!executeCondition) {
      return;
    }
    executeCondition.mode = value;
  },
});

const createActionId = () => `operation_${unique(8)}`;

const toTargetFieldFillType = (valueType: ViewActionFieldValueType): TargetFieldFillType => {
  switch (valueType) {
    case ViewActionFieldValueType.FIELD:
      return TargetFieldFillType.FIELD;
    case ViewActionFieldValueType.CUSTOM:
      return TargetFieldFillType.CUSTOM;
    case ViewActionFieldValueType.FORMULA:
      return TargetFieldFillType.FORMULA;
    case ViewActionFieldValueType.EMPTY:
    default:
      return TargetFieldFillType.EMPTY;
  }
};

const toViewActionFieldValueType = (fillType: TargetFieldFillType): ViewActionFieldValueType => {
  switch (fillType) {
    case TargetFieldFillType.FIELD:
      return ViewActionFieldValueType.FIELD;
    case TargetFieldFillType.CUSTOM:
      return ViewActionFieldValueType.CUSTOM;
    case TargetFieldFillType.FORMULA:
      return ViewActionFieldValueType.FORMULA;
    case TargetFieldFillType.EMPTY:
    default:
      return ViewActionFieldValueType.EMPTY;
  }
};

const createDefaultDisplay = (target: ViewActionTarget): ViewActionDisplay => {
  return {
    label: i18next.t("TableActionSetting.newAction"),
    labelSyncMode: ViewActionLabelSyncMode.AUTO,
    style: ViewActionButtonStyle.SOLID,
    color: "#1677FF",
    icon: "",
    placement: isViewTarget(target) ? ViewActionPlacement.VIEW_TOOLBAR : ViewActionPlacement.TABLE_ACTION_COLUMN,
  };
};

const createDefaultExecuteCondition = (target: ViewActionTarget): ViewActionExecuteCondition => {
  if (isViewTarget(target)) {
    return {
      enabled: true,
      scope: ViewActionConditionScope.VIEW,
      mode: ViewActionViewConditionMode.HAS_DATA,
      tip: "",
    };
  }
  return {
    enabled: false,
    scope: ViewActionConditionScope.RECORD,
    mode: ViewActionRecordConditionMode.ALL,
    conditions: [],
    tip: "",
  };
};

const createBehaviorByType = (
  type: ViewActionBehaviorType,
  config?: any,
  target?: ViewActionTarget,
): ViewAction["behavior"] => {
  if (type === ViewActionBehaviorType.TRIGGER_PROCESS) {
    const triggerMode = config?.triggerMode === ViewActionTriggerMode.VIEW_CONTEXT_ONCE
      ? ViewActionTriggerMode.VIEW_CONTEXT_ONCE
      : (config?.triggerMode === ViewActionTriggerMode.EACH_RECORD
        ? ViewActionTriggerMode.EACH_RECORD
        : (isViewTarget(target) ? undefined : ViewActionTriggerMode.EACH_RECORD));
    return {
      type: ViewActionBehaviorType.TRIGGER_PROCESS,
      config: {
        processId: props.table.uid,
        triggerNodeId: typeof config?.triggerNodeId === "string" ? config.triggerNodeId : "",
        triggerMode,
      },
    };
  }

  if (type === ViewActionBehaviorType.CREATE_RECORD) {
    return {
      type: ViewActionBehaviorType.CREATE_RECORD,
      config: {
        targetFormId: config?.targetFormId || props.table.uid,
        fieldMappings: Array.isArray(config?.fieldMappings) ? cloneDeep(config.fieldMappings) : [],
      },
    };
  }

  return {
    type: ViewActionBehaviorType.EDIT_RECORD,
    config: {
      fields: Array.isArray(config?.fields)
        ? config.fields.map((item) => ({
          fieldId: item.fieldId,
          mode: item.mode || ViewActionEditFieldMode.CURRENT,
          customValue: cloneDeep(item.customValue),
        }))
        : [],
    },
  };
};

const cacheBehaviorDraft = (
  actionId: string,
  type: ViewActionBehaviorType,
  config?: any,
  target?: ViewActionTarget,
) => {
  if (!actionId) {
    return;
  }
  if (!behaviorDraftStore[actionId]) {
    behaviorDraftStore[actionId] = {};
  }
  behaviorDraftStore[actionId][type] = createBehaviorByType(type, config, target);
};

const getBehaviorDraft = (actionId: string, type: ViewActionBehaviorType) => {
  const draft = behaviorDraftStore[actionId]?.[type];
  return draft ? cloneDeep(draft) : null;
};

const rememberActionBehavior = (action?: ViewAction | null) => {
  if (!action?.id) {
    return;
  }
  cacheBehaviorDraft(action.id, action.behavior.type, action.behavior.config, action.target);
  lastBehaviorTypeStore[action.id] = action.behavior.type;
  lastTargetStore[action.id] = action.target;
  if (isRecordTarget(action.target)) {
    lastRecordBehaviorTypeStore[action.id] = action.behavior.type;
  }
};

const createDefaultAction = (): ViewAction => {
  const actionId = createActionId();
  return {
    id: actionId,
    name: i18next.t("TableActionSetting.newAction"),
    code: actionId,
    type: ViewActionType.BUTTON,
    description: "",
    target: ViewActionTarget.RECORD,
    display: createDefaultDisplay(ViewActionTarget.RECORD),
    behavior: createBehaviorByType(ViewActionBehaviorType.EDIT_RECORD),
    executeCondition: createDefaultExecuteCondition(ViewActionTarget.RECORD),
    order: localActions.value.length + 1,
  };
};

const resolveActionPermissionSourceId = (actionId: string) => {
  let sourceActionId = actionId;
  const visited = new Set<string>();

  while (actionPermissionCopySourceStore[sourceActionId] && !visited.has(sourceActionId)) {
    visited.add(sourceActionId);
    sourceActionId = actionPermissionCopySourceStore[sourceActionId];
  }

  return sourceActionId;
};

const pruneActionPermissionCopySources = (actions: ViewAction[]) => {
  const actionIds = new Set((actions || []).map((item) => item.id));
  Object.keys(actionPermissionCopySourceStore).forEach((actionId) => {
    if (!actionIds.has(actionId)) {
      delete actionPermissionCopySourceStore[actionId];
    }
  });
};

const resetCopiedTriggerProcessBinding = (action: ViewAction) => {
  if (action.behavior?.type !== ViewActionBehaviorType.TRIGGER_PROCESS) {
    return;
  }

  action.behavior.config = {
    ...action.behavior.config,
    triggerNodeId: "",
  };
};

const createCopiedAction = (sourceAction: ViewAction): ViewAction => {
  const actionId = createActionId();
  const copiedAction = cloneDeep(sourceAction);
  const copiedName = handleCopyName(sourceAction.name || sourceAction.display?.label || "");
  const copiedLabel = handleCopyName(sourceAction.display?.label || sourceAction.name || "");

  copiedAction.id = actionId;
  copiedAction.code = actionId;
  copiedAction.name = copiedName;
  copiedAction.display = {
    ...createDefaultDisplay(copiedAction.target),
    ...(copiedAction.display || {}),
    label: copiedLabel,
    labelSyncMode: getActionDisplayLabelSyncMode(sourceAction),
  };
  copiedAction.order = sourceAction.order;
  resetCopiedTriggerProcessBinding(copiedAction);
  normalizeAction(copiedAction);

  return copiedAction;
};

const syncOrder = () => {
  localActions.value.forEach((item, index) => {
    item.order = index + 1;
  });
};

const handleAddAction = () => {
  const action = createDefaultAction();
  localActions.value.push(action);
  syncOrder();
  openDetailPanel(action.id);
};

const handleCopyAction = (actionId: string) => {
  const index = localActions.value.findIndex((item) => item.id === actionId);
  if (index < 0) return;

  const copiedAction = createCopiedAction(localActions.value[index]);
  actionPermissionCopySourceStore[copiedAction.id] = resolveActionPermissionSourceId(localActions.value[index].id);
  localActions.value.splice(index + 1, 0, copiedAction);
  syncOrder();
  openDetailPanel(copiedAction.id);
};

const handleRemoveAction = (actionId: string) => {
  const index = localActions.value.findIndex((item) => item.id === actionId);
  if (index < 0) return;
  localActions.value.splice(index, 1);
  delete actionPermissionCopySourceStore[actionId];
  delete behaviorDraftStore[actionId];
  delete lastBehaviorTypeStore[actionId];
  delete lastRecordBehaviorTypeStore[actionId];
  delete lastTargetStore[actionId];
  syncOrder();
  if (activeActionId.value === actionId) {
    activeActionId.value = localActions.value[index]?.id || localActions.value[index - 1]?.id || "";
  }
  if (!localActions.value.length) {
    detailVisible.value = false;
  }
};

const handleSelectAction = (actionId: string) => {
  activeActionId.value = actionId;
};

const handleEditAction = (actionId: string) => {
  openDetailPanel(actionId);
};

const handleCollapseDetail = () => {
  closeDetailPanel();
};

const ensureTriggerProcessBehavior = (action: ViewAction) => {
  action.behavior = createBehaviorByType(
    ViewActionBehaviorType.TRIGGER_PROCESS,
    action.behavior.type === ViewActionBehaviorType.TRIGGER_PROCESS ? action.behavior.config : undefined,
    action.target,
  );
};

const ensureCreateRecordBehavior = (action: ViewAction) => {
  action.behavior = createBehaviorByType(
    ViewActionBehaviorType.CREATE_RECORD,
    action.behavior.type === ViewActionBehaviorType.CREATE_RECORD ? action.behavior.config : undefined,
  );
};

const ensureEditRecordBehavior = (action: ViewAction) => {
  action.behavior = createBehaviorByType(
    ViewActionBehaviorType.EDIT_RECORD,
    action.behavior.type === ViewActionBehaviorType.EDIT_RECORD ? action.behavior.config : undefined,
  );
};

const getActionDisplayLabelSyncMode = (action?: ViewAction | null) => {
  if (!action) {
    return ViewActionLabelSyncMode.AUTO;
  }
  if (action.display?.labelSyncMode === ViewActionLabelSyncMode.MANUAL) {
    return ViewActionLabelSyncMode.MANUAL;
  }
  if (action.display?.labelSyncMode === ViewActionLabelSyncMode.AUTO) {
    return ViewActionLabelSyncMode.AUTO;
  }
  const displayLabel = action.display?.label || "";
  return displayLabel && displayLabel !== action.name
    ? ViewActionLabelSyncMode.MANUAL
    : ViewActionLabelSyncMode.AUTO;
};

const syncDisplayLabelFromActionName = (action?: ViewAction | null) => {
  if (!action?.display || getActionDisplayLabelSyncMode(action) !== ViewActionLabelSyncMode.AUTO) {
    return;
  }
  action.display.labelSyncMode = ViewActionLabelSyncMode.AUTO;
  action.display.label = action.name;
};

const isCurrentActionLabelManual = computed(() => {
  return getActionDisplayLabelSyncMode(currentAction.value) === ViewActionLabelSyncMode.MANUAL;
});

const getDisplayLabelResetTip = () => i18next.t("TableActionSetting.displayLabelResetTip");

const getActionNameValue = (action?: ViewAction | null) => {
  return (action?.name || "").trim();
};

const getDisplayLabelValue = (action?: ViewAction | null) => {
  return (action?.display?.label || "").trim();
};

const currentActionNameError = computed(() => {
  if (!currentAction.value) {
    return "";
  }
  return getActionNameValue(currentAction.value) ? "" : i18next.t("TableActionSetting.actionNamePlaceholder");
});

const currentDisplayLabelError = computed(() => {
  if (!currentAction.value) {
    return "";
  }
  return getDisplayLabelValue(currentAction.value) ? "" : i18next.t("TableActionSetting.buttonNamePlaceholder");
});

const buttonColorStyle = computed(() => ({
  backgroundColor: currentAction.value?.display?.color || "#1677FF",
}));

const buttonPreviewStyle = computed(() => {
  const color = currentAction.value?.display?.color || "#1677FF";
  const isOutline = currentAction.value?.display?.style === ViewActionButtonStyle.OUTLINE;
  return {
    borderRadius: "4px",
    backgroundColor: isOutline ? "#fff" : color,
    borderColor: color,
    color: isOutline ? color : "#fff",
  };
});

const normalizeAction = (action: ViewAction) => {
  action.target = normalizeViewActionTarget(action.target) as ViewActionTarget;
  action.type = ViewActionType.BUTTON;
  action.display = action.display || createDefaultDisplay(action.target);
  action.display.style = action.display.style || ViewActionButtonStyle.SOLID;
  action.display.color = action.display.color || "#1677FF";
  action.display.icon = action.display.icon || "";
  action.display.labelSyncMode = getActionDisplayLabelSyncMode(action);
  if (!action.display.label) {
    action.display.label = action.name || "";
  }
  action.display.placement = isViewTarget(action.target)
    ? ViewActionPlacement.VIEW_TOOLBAR
    : (action.display.placement === ViewActionPlacement.DETAIL_HEADER ? ViewActionPlacement.DETAIL_HEADER : ViewActionPlacement.TABLE_ACTION_COLUMN);
  action.executeCondition = action.executeCondition || createDefaultExecuteCondition(action.target);
  action.executeCondition.tip = action.executeCondition.tip || "";

  if (isViewTarget(action.target)) {
    ensureTriggerProcessBehavior(action);
    normalizeTriggerProcessConfig(action);
    action.executeCondition = {
      enabled: action.executeCondition.enabled ?? true,
      scope: ViewActionConditionScope.VIEW,
      mode: (action.executeCondition as any).mode,
      tip: action.executeCondition.tip || "",
    } as ViewActionViewExecuteCondition;
    normalizeViewExecuteConditionByTriggerMode(action);
    return;
  }

  action.executeCondition = {
    enabled: action.executeCondition.enabled ?? false,
    scope: ViewActionConditionScope.RECORD,
    mode: (action.executeCondition as any).mode || ViewActionRecordConditionMode.ALL,
    conditions: Array.isArray((action.executeCondition as any).conditions) ? (action.executeCondition as any).conditions : [],
    tip: action.executeCondition.tip || "",
  } as ViewActionRecordExecuteCondition;

  if (action.behavior.type === ViewActionBehaviorType.TRIGGER_PROCESS) {
    ensureTriggerProcessBehavior(action);
    normalizeTriggerProcessConfig(action);
  } else if (action.behavior.type === ViewActionBehaviorType.CREATE_RECORD) {
    action.behavior = createBehaviorByType(ViewActionBehaviorType.CREATE_RECORD, action.behavior.config);
  } else {
    action.behavior = createBehaviorByType(ViewActionBehaviorType.EDIT_RECORD, action.behavior.config);
  }
};

const normalizeActions = (actions: ViewAction[] = []) => {
  const nextActions = cloneDeep(actions || []);
  nextActions.forEach((action) => normalizeAction(action));
  nextActions.forEach((item, index) => {
    item.order = index + 1;
  });
  return nextActions;
};

const toTargetRule = (item: ViewActionFieldMapping) => {
  return {
    fieldUID: item.fieldId,
    type: toTargetFieldFillType(item.valueType),
    value: item.value,
  } as TargetFieldFillRule;
};

const hydrateEditorState = async (action: ViewAction | null) => {
  hydrating.value = true;
  if (!action) {
    createFieldRules.value = [];
    editFields.value = [];
    hydrating.value = false;
    return;
  }

  createFieldRules.value = action.behavior.type === ViewActionBehaviorType.CREATE_RECORD
    ? cloneDeep((action.behavior.config.fieldMappings || []).map(toTargetRule))
    : [];
  editFields.value = action.behavior.type === ViewActionBehaviorType.EDIT_RECORD
    ? cloneDeep(action.behavior.config.fields || []).map((item) => ({
      fieldId: item.fieldId,
      mode: item.mode || ViewActionEditFieldMode.CURRENT,
      customValue: cloneDeep(item.customValue),
    }))
    : [];
  await nextTick();
  hydrating.value = false;
};

const createRecordTargetFormId = computed({
  get() {
    if (!currentAction.value || currentAction.value.behavior.type !== ViewActionBehaviorType.CREATE_RECORD) {
      return props.table.uid;
    }
    return currentAction.value.behavior.config.targetFormId || props.table.uid;
  },
  set(value: TableUID) {
    if (!currentAction.value || currentAction.value.behavior.type !== ViewActionBehaviorType.CREATE_RECORD) return;
    currentAction.value.behavior.config.targetFormId = value;
  },
});

const handleActionNameInput = () => {
  syncDisplayLabelFromActionName(currentAction.value);
};

const handleDisplayLabelInput = () => {
  if (!currentAction.value?.display) {
    return;
  }
  currentAction.value.display.labelSyncMode = ViewActionLabelSyncMode.MANUAL;
};

const resetDisplayLabelSync = () => {
  if (!currentAction.value?.display) {
    return;
  }
  currentAction.value.display.labelSyncMode = ViewActionLabelSyncMode.AUTO;
  currentAction.value.display.label = currentAction.value.name;
};

const focusActionField = async (field: "name" | "displayLabel") => {
  await nextTick();
  const targetRef = field === "name" ? actionNameInputRef.value : displayLabelInputRef.value;
  targetRef?.focus?.();
};

const getInvalidBasicInfo = (action: ViewAction) => {
  if (!getActionNameValue(action)) {
    return {
      field: "name" as const,
      message: i18next.t("TableActionSetting.actionNameRequiredError"),
    };
  }
  if (!getDisplayLabelValue(action)) {
    return {
      field: "displayLabel" as const,
      message: i18next.t("TableActionSetting.buttonNameRequiredError"),
    };
  }
  return null;
};

const getInvalidTriggerProcessConfig = (action: ViewAction) => {
  if (action.behavior.type !== ViewActionBehaviorType.TRIGGER_PROCESS) {
    return null;
  }

  const triggerMode = action.behavior.config.triggerMode;
  if (!triggerMode) {
    return {
      message: i18next.t("TableActionSetting.triggerModeRequiredError"),
    };
  }

  const triggerNodeId = action.behavior.config.triggerNodeId;
  if (!triggerNodeId) {
    return {
      message: i18next.t("TableActionSetting.relatedTriggerNodeRequiredError"),
    };
  }

  const triggerNode = getOperationTriggerNodeById(triggerNodeId);
  if (!triggerNode) {
    return {
      message: i18next.t("TableActionSetting.relatedTriggerNodeInvalidError"),
    };
  }

  if (
    isSelectedTarget(action.target)
    && action.executeCondition.scope === ViewActionConditionScope.VIEW
    && action.executeCondition.mode === ViewActionViewConditionMode.NO_DATA
  ) {
    return {
      message: i18next.t("TableActionSetting.selectedTargetNoDataUnsupportedError"),
    };
  }

  if (toViewActionTriggerMode(getOperationTriggerMode(triggerNode.options)) !== triggerMode) {
    return {
      message: triggerMode === ViewActionTriggerMode.VIEW_CONTEXT_ONCE
        ? i18next.t("TableActionSetting.relatedTriggerNodeOnceDisabledError")
        : i18next.t("TableActionSetting.relatedTriggerNodeEachDisabledError"),
    };
  }

  const conflict = getTriggerNodeConflict(action);
  if (conflict) {
    return {
      message: formatTriggerNodeConflictMessage(conflict),
    };
  }

  return null;
};

const getInvalidCreateRecordConfig = (action: ViewAction) => {
  if (action.behavior.type !== ViewActionBehaviorType.CREATE_RECORD) {
    return null;
  }

  const targetFormId = action.behavior.config.targetFormId;
  if (!targetFormId) {
    return {
      message: i18next.t("TableActionSetting.targetFormRequiredError"),
    };
  }

  const targetTable = getTargetTableById(targetFormId);
  if (!targetTable) {
    return {
      message: i18next.t("TableActionSetting.targetFormInvalidError"),
    };
  }

  const fieldMappingMap = new Map(
    getCreateFieldMappings(action)
      .filter(item => !!item?.fieldId)
      .map(item => [String(item.fieldId), item]),
  );
  const invalidRequiredField = getRequiredCreateTargetFields(targetTable).find((field) => {
    const mapping = fieldMappingMap.get(field.fieldId);
    if (!mapping) {
      return !hasCreateTargetFieldDefaultValue(getCreateTargetFieldByFieldId(targetTable, field.fieldId));
    }

    if (mapping.valueType === ViewActionFieldValueType.EMPTY) {
      return true;
    }

    if (![ViewActionFieldValueType.FIELD, ViewActionFieldValueType.CUSTOM, ViewActionFieldValueType.FORMULA].includes(mapping.valueType)) {
      return true;
    }

    return !hasConfiguredCreateRuleValue(mapping.value);
  });

  if (invalidRequiredField) {
    return {
      message: i18next.t("TableActionSetting.createRecordRequiredFieldError"),
    };
  }

  return null;
};

const handleTargetChange = () => {
  if (!currentAction.value) return;
  currentAction.value.target = normalizeViewActionTarget(currentAction.value.target) as ViewActionTarget;
  const prevTarget = normalizeViewActionTarget(lastTargetStore[currentAction.value.id] || currentAction.value.target) as ViewActionTarget;
  cacheBehaviorDraft(
    currentAction.value.id,
    lastBehaviorTypeStore[currentAction.value.id] || currentAction.value.behavior.type,
    currentAction.value.behavior.config,
    prevTarget,
  );
  if (isRecordTarget(prevTarget)) {
    lastRecordBehaviorTypeStore[currentAction.value.id] = currentAction.value.behavior.type;
  }
  currentAction.value.display.placement = isViewTarget(currentAction.value.target)
    ? ViewActionPlacement.VIEW_TOOLBAR
    : ViewActionPlacement.TABLE_ACTION_COLUMN;
  currentAction.value.executeCondition = createDefaultExecuteCondition(currentAction.value.target);
  if (isViewTarget(currentAction.value.target)) {
    ensureTriggerProcessBehavior(currentAction.value);
  } else {
    const nextRecordBehaviorType = lastRecordBehaviorTypeStore[currentAction.value.id] || ViewActionBehaviorType.EDIT_RECORD;
    if (nextRecordBehaviorType === ViewActionBehaviorType.CREATE_RECORD) {
      ensureCreateRecordBehavior(currentAction.value);
    } else if (nextRecordBehaviorType === ViewActionBehaviorType.TRIGGER_PROCESS) {
      ensureTriggerProcessBehavior(currentAction.value);
    } else {
      ensureEditRecordBehavior(currentAction.value);
    }
  }
  normalizeTriggerProcessConfig(currentAction.value);
  rememberActionBehavior(currentAction.value);
  hydrateEditorState(currentAction.value);
};

const handleBehaviorChange = (nextType: ViewActionBehaviorType) => {
  if (!currentAction.value) return;
  const prevType = lastBehaviorTypeStore[currentAction.value.id] || nextType;
  if (prevType !== nextType) {
    cacheBehaviorDraft(currentAction.value.id, prevType, currentAction.value.behavior.config, currentAction.value.target);
  }

  currentAction.value.behavior = getBehaviorDraft(currentAction.value.id, nextType)
    || createBehaviorByType(nextType, undefined, currentAction.value.target);
  normalizeTriggerProcessConfig(currentAction.value);
  rememberActionBehavior(currentAction.value);
  hydrateEditorState(currentAction.value);
};

const buildCreateFieldMappings = (value: TargetFieldFillRule[]) => {
  return cloneDeep(value)
    .filter((item) => !!item.fieldUID)
    .map((item) => ({
      fieldId: item.fieldUID as FieldUID,
      valueType: toViewActionFieldValueType(item.type),
      value: item.value,
    }));
};

const syncCurrentActionState = () => {
  if (!currentAction.value || hydrating.value) return;

  if (isViewTarget(currentAction.value.target)) {
    normalizeTriggerProcessConfig(currentAction.value);
    normalizeViewExecuteConditionByTriggerMode(currentAction.value);
    const executeCondition = currentAction.value.executeCondition as ViewActionViewExecuteCondition;
    executeCondition.enabled = executeCondition.enabled ?? true;
    executeCondition.mode = viewConditionMode.value;
    executeCondition.tip = executeCondition.tip || "";
  } else {
    const executeCondition = currentAction.value.executeCondition as ViewActionRecordExecuteCondition;
    executeCondition.enabled = executeCondition.enabled ?? false;
    executeCondition.scope = ViewActionConditionScope.RECORD;
    executeCondition.mode = recordConditionMode.value;
    executeCondition.conditions = Array.isArray(executeCondition.conditions) ? executeCondition.conditions : [];
    executeCondition.tip = executeCondition.tip || "";
  }

  if (currentAction.value.behavior.type === ViewActionBehaviorType.CREATE_RECORD) {
    currentAction.value.behavior.config.fieldMappings = buildCreateFieldMappings(createFieldRules.value);
  } else if (currentAction.value.behavior.type === ViewActionBehaviorType.EDIT_RECORD) {
    currentAction.value.behavior.config.fields = cloneDeep(editFields.value);
  }
};

const getValidEditFields = (action: ViewAction) => {
  if (action.behavior.type !== ViewActionBehaviorType.EDIT_RECORD) {
    return [];
  }
  return (action.behavior.config.fields || []).filter(item => !!item?.fieldId);
};

const getInvalidEditRecordConfig = (action: ViewAction) => {
  if (action.behavior.type !== ViewActionBehaviorType.EDIT_RECORD) {
    return null;
  }

  const fields = getValidEditFields(action);
  if (!fields.length) {
    return {
      message: i18next.t("TableActionSetting.editRecordFieldRequiredError"),
    };
  }

  const invalidField = fields.find(item => !resolveEditTargetFieldByFieldId(item.fieldId));
  if (invalidField) {
    return {
      message: i18next.t("TableActionSetting.editRecordFieldInvalidError"),
    };
  }

  return null;
};

const validateActions = async () => {
  await nextTick();
  syncCurrentActionState();

  const invalidBasicInfoAction = localActions.value.find((action) => !!getInvalidBasicInfo(action));
  if (invalidBasicInfoAction) {
    const invalidBasicInfo = getInvalidBasicInfo(invalidBasicInfoAction);
    activeActionId.value = invalidBasicInfoAction.id;
    detailVisible.value = true;
    await focusActionField(invalidBasicInfo?.field || "name");
    ElMessage.error(invalidBasicInfo?.message || i18next.t("TableActionSetting.actionConfigIncompleteError"));
    return false;
  }

  const invalidTriggerProcessAction = localActions.value.find((action) => !!getInvalidTriggerProcessConfig(action));
  if (invalidTriggerProcessAction) {
    const invalidTriggerProcessConfig = getInvalidTriggerProcessConfig(invalidTriggerProcessAction);
    activeActionId.value = invalidTriggerProcessAction.id;
    detailVisible.value = true;
    await nextTick();
    ElMessage.error(invalidTriggerProcessConfig?.message || i18next.t("TableActionSetting.relatedTriggerNodeRequiredError"));
    return false;
  }

  const invalidCreateRecordAction = localActions.value.find((action) => !!getInvalidCreateRecordConfig(action));
  if (invalidCreateRecordAction) {
    const invalidCreateRecordConfig = getInvalidCreateRecordConfig(invalidCreateRecordAction);
    activeActionId.value = invalidCreateRecordAction.id;
    detailVisible.value = true;
    await nextTick();
    ElMessage.error(invalidCreateRecordConfig?.message || i18next.t("TableActionSetting.createRecordRequiredFieldError"));
    return false;
  }

  const invalidEditRecordAction = localActions.value.find((action) => !!getInvalidEditRecordConfig(action));

  if (!invalidEditRecordAction) {
    return true;
  }

  const invalidEditRecordConfig = getInvalidEditRecordConfig(invalidEditRecordAction);
  if (!invalidEditRecordConfig) {
    return true;
  }
  activeActionId.value = invalidEditRecordAction.id;
  detailVisible.value = true;
  await nextTick();
  if (invalidEditRecordConfig) {
    ElMessage.error(invalidEditRecordConfig.message);
    return false;
  }
  ElMessage.error(i18next.t("TableActionSetting.editRecordFieldRequiredError"));
  return false;
};

const handleCreateFieldRulesUpdate = (value: TargetFieldFillRule[]) => {
  createFieldRules.value = cloneDeep(value);
  if (!currentAction.value || currentAction.value.behavior.type !== ViewActionBehaviorType.CREATE_RECORD) return;
  currentAction.value.behavior.config.fieldMappings = buildCreateFieldMappings(value);
};

const handleEditFieldsUpdate = (value: ViewActionEditField[]) => {
  editFields.value = cloneDeep(value);
  if (!currentAction.value || currentAction.value.behavior.type !== ViewActionBehaviorType.EDIT_RECORD) return;
  currentAction.value.behavior.config.fields = cloneDeep(value);
};

watch(() => props.actions, (value) => {
  const nextActions = normalizeActions(value || []);
  if (!isEqual(nextActions, localActions.value)) {
    localActions.value = nextActions;
  }
  pruneActionPermissionCopySources(nextActions);
  if (!localActions.value.some((item) => item.id === activeActionId.value)) {
    activeActionId.value = localActions.value[0]?.id || "";
  }
  if (!localActions.value.length) {
    detailVisible.value = false;
  }
}, { immediate: true, deep: true });

watch(currentAction, (value) => {
  rememberActionBehavior(value);
  hydrateEditorState(value);
}, { immediate: true });

watch(createFieldRules, (value) => {
  if (!currentAction.value || hydrating.value || currentAction.value.behavior.type !== ViewActionBehaviorType.CREATE_RECORD) return;
  currentAction.value.behavior.config.fieldMappings = buildCreateFieldMappings(value);
}, { deep: true });

watch(editFields, (value) => {
  if (!currentAction.value || hydrating.value || currentAction.value.behavior.type !== ViewActionBehaviorType.EDIT_RECORD) return;
  currentAction.value.behavior.config.fields = cloneDeep(value);
}, { deep: true });

onBeforeUnmount(() => {
  clearDetailClosingTimer();
});

defineExpose({
  flushActions: async () => {
    await nextTick();
    syncCurrentActionState();
    syncOrder();
  },
  validateActions,
  getActions: () => {
    syncCurrentActionState();
    syncOrder();
    return cloneDeep(localActions.value);
  },
  hasChanges: () => {
    syncCurrentActionState();
    syncOrder();
    return !isEqual(normalizeActions(localActions.value), normalizeActions(props.actions || []));
  },
  getActionPermissionCopySources: () => ({ ...actionPermissionCopySourceStore }),
});
</script>

<style lang="scss" scoped>
.table-action-setting {
  --table-action-setting-panel-transition-duration: 0.32s;
  --table-action-setting-panel-transition-ease: cubic-bezier(0.22, 1, 0.36, 1);
  display: grid;
  grid-template-columns: minmax(0, 1fr) 0;
  grid-template-rows: auto minmax(0, 1fr);
  column-gap: 0;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  transition:
    grid-template-columns var(--table-action-setting-panel-transition-duration) var(--table-action-setting-panel-transition-ease),
    column-gap var(--table-action-setting-panel-transition-duration) var(--table-action-setting-panel-transition-ease);

  &.expanded {
    grid-template-columns: 260px minmax(0, 1fr);
    column-gap: 12px;
  }

  .aside-pane,
  .main-pane {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    min-height: 0;
    overflow: hidden;
  }

  .aside-pane {
    width: 100%;
    min-width: 0;
  }

  .main-pane {
    min-width: 0;
    padding-left: 0;
    border-left: 1px solid transparent;
    opacity: 0;
    transform: translateX(100%);
    pointer-events: none;
    transition:
      padding-left var(--table-action-setting-panel-transition-duration) var(--table-action-setting-panel-transition-ease),
      border-color var(--table-action-setting-panel-transition-duration) var(--table-action-setting-panel-transition-ease),
      opacity var(--table-action-setting-panel-transition-duration) var(--table-action-setting-panel-transition-ease),
      transform var(--table-action-setting-panel-transition-duration) var(--table-action-setting-panel-transition-ease);

    &.is-visible {
      padding-left: 12px;
      border-left-color: var(--border-color);
      opacity: 1;
      transform: translateX(0);
      pointer-events: auto;
    }
  }

  .aside-header,
  .main-header {
    display: flex;
    align-items: center;
    min-height: 32px;
    padding-bottom: 7px;
    margin-bottom: 8px;
    border-bottom: 1px solid var(--border-color-light);
    box-sizing: border-box;
  }

  .aside-header {
    justify-content: space-between;

    .title {
      font-size: 14px;
      font-weight: 500;
    }
  }

  .aside-body {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .action-list {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
    overflow-y: auto;
  }

  .action-item {
    display: flex;
    align-items: start;
    gap: 8px;
    padding: 10px 12px;
    position: relative;
    border-radius: 4px;
    background-color: var(--bg-color-page);
    border: 1px solid transparent;
    cursor: pointer;

    &.active {
      border-color: var(--color-primary);
      background-color: var(--color-primary-light-9);
    }

    .drag-handle {
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: move;
      color: var(--text-color-secondary);
    }

    .content {
      flex: 1;
      min-width: 0;
      width: 100%;
    }

    .name {
      font-size: 14px;
      line-height: 20px;
      color: var(--text-color-regular);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      padding-right: 86px;
    }

    .meta {
      display: block;
      width: 100%;
      margin-top: 4px;
      font-size: 12px;
      line-height: 18px;
      color: var(--text-color-secondary);
      white-space: nowrap;
      word-break: keep-all;

      span + span {
        margin-left: 8px;
      }
    }

    .action-tools {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      position: absolute;
      top: 10px;
      right: 8px;
      visibility: hidden;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
    }

    &.active,
    &:hover {
      .action-tools {
        visibility: visible;
        opacity: 1;
        pointer-events: auto;
      }
    }

    &:focus-visible {
      outline: 2px solid rgba(22, 119, 255, 0.24);
      outline-offset: -2px;
    }
  }

  .main-header {
    justify-content: flex-end;

    .collapse-btn {
      width: 24px;
      height: 24px;
      border-radius: 4px;
      color: var(--text-color-secondary);

      &:hover {
        background-color: var(--bg-color-hover);
        color: var(--text-color-regular);
      }
    }
  }

  .main-scrollbar {
    flex: 1;
    min-height: 0;

    :deep(.el-scrollbar__wrap) {
      overflow-x: hidden;
    }

    :deep(.el-scrollbar__view) {
      box-sizing: border-box;
      min-width: 0;
      padding-right: 10px;
    }

    :deep(.el-scrollbar__bar.is-vertical) {
      right: 0;
    }
  }

  .section {
    padding: 24px 0;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    gap: 24px;

    &:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }

    .section-title {
      font-size: 14px;
      line-height: 22px;
      font-weight: 500;
      color: #000;
    }
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;

    .full-width {
      grid-column: 1 / -1;
    }
  }

  .behavior-panel,
  .condition-box {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .execute-condition-switch {
    align-self: flex-start;
    width: fit-content;
    max-width: 100%;
  }

  .display-label-reset-icon {
    cursor: pointer;
    color: var(--text-color-secondary);
    outline: none;

    &:hover,
    &:focus-visible {
      color: var(--color-primary);
    }
  }

  .icon-selector-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    background-color: var(--bg-color);
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

    &:hover,
    &:focus-visible {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.12);
      outline: none;
    }
  }

  .icon-preview {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    margin-right: 0;
    flex-shrink: 0;
  }

  .icon-selector-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow: hidden;

    :deep(.colors) {
      padding: 0 12px 0 4px;
    }

    :deep(.icons-wrapper) {
      max-height: 242px;
      padding: 0;
    }
  }

  :deep(.table-action-icon-selector-popper) {
    overflow: hidden;
  }

  .tip,
  .permission-tip,
  .empty {
    font-size: 13px;
    line-height: 20px;
    color: var(--text-color-secondary);
  }

  .trigger-conflict-tip {
    color: var(--color-danger);
  }

  .empty {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    min-height: 0;
  }

  :deep(.el-form-item) {
    margin-bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;

    .el-form-item__label {
      height: 22px;
      font-size: 14px;
      line-height: 22px;
      color: var(--text-color-regular);
    }

    .el-form-item__content {
      width: 100%;
    }
  }

  .main-pane {
    :deep(.el-input__wrapper),
    :deep(.el-select__wrapper),
    :deep(.el-input-tag),
    :deep(.el-textarea__inner) {
      border-radius: 4px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    .main-pane {
      transition: none;
      transform: none;
    }
  }

  @media (hover: none) {
    .action-item {
      .action-tools {
        display: inline-flex;
      }
    }
  }
}
</style>
