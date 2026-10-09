<template>
  <div class="node-timeout-setting">
    <option-item :title="$t('NodeTimeoutSetting.title')">
      <div class="setting-entry" @click="openMainDialog">
        <div class="setting-entry__text" :class="{ 'is-configured': hasTimeout }">
          {{ hasTimeout ? $t('NodeTimeoutSetting.configuredEntry') : $t('NodeTimeoutSetting.setSetting') }}
        </div>
      </div>
    </option-item>

    <el-dialog
      v-model="mainDialogVisible"
      class="node-timeout-main-dialog"
      width="960px"
      append-to-body
      align-center
      destroy-on-close
      :close-on-click-modal="false"
      :show-close="false"
    >
      <template #header>
        <div class="timeout-dialog-header">
          <div class="timeout-dialog-header__title">{{ $t('NodeTimeoutSetting.dialogTitle') }}</div>
          <button type="button" class="timeout-dialog-header__close" @click="mainDialogVisible = false">
            <el-icon><i-ep-close /></el-icon>
          </button>
        </div>
      </template>

      <div class="timeout-dialog-body timeout-dialog-body--main">
        <el-scrollbar class="timeout-dialog-scrollbar">
          <div class="timeout-dialog-scroll-content">
            <div class="section-block">
              <div class="section-label">{{ $t('NodeTimeoutSetting.deadlineField') }}</div>
              <div class="deadline-row">
                <el-select
                  v-model="deadlineType"
                  class="timeout-select source-select"
                  :style="sourceSelectStyle"
                  @change="handleDeadlineTypeChange"
                >
                  <el-option :label="$t('NodeTimeoutSetting.deadlineSourceCustom')" :value="ProcessTimeoutDeadlineType.CUSTOM" />
                  <el-option :label="$t('NodeTimeoutSetting.deadlineSourceField')" :value="ProcessTimeoutDeadlineType.FIELD" />
                </el-select>

                <template v-if="deadlineType === ProcessTimeoutDeadlineType.FIELD">
                  <el-select
                    v-model="deadlineFieldId"
                    class="timeout-select field-select"
                    filterable
                    :placeholder="$t('NodeTimeoutSetting.selectDeadlineField')"
                    @change="handleDeadlineFieldChange"
                  >
                    <el-option
                      v-for="field in deadlineFields"
                      :key="field.uid"
                      :label="field.alias"
                      :value="field.uid"
                    />
                  </el-select>

                  <el-config-provider :locale="locale">
                    <el-time-picker
                      v-if="selectedDeadlineFieldNeedsTime"
                      v-model="deadlineFieldTime"
                      class="timeout-select deadline-time-select"
                      format="HH:mm"
                      value-format="HH:mm"
                      :clearable="false"
                      :editable="false"
                      :placeholder="$t('NodeTimeoutSetting.selectDeadlineTime')"
                      @change="handleDeadlineFieldTimeChange"
                    />
                  </el-config-provider>
                </template>
                <template v-else>
                  <span class="inline-text">{{ $t('NodeTimeoutSetting.afterNodeArrival') }}</span>
                  <el-input-number
                    v-model="customDeadline.delay"
                    :min="0"
                    :max="getMaxDelayByUnit(customDeadline.unit)"
                    :step="1"
                    :controls="false"
                    class="timeout-number"
                    @change="handleCustomDeadlineDelayChange"
                  />
                  <el-select v-model="customDeadline.unit" class="timeout-select unit-select" @change="handleCustomDeadlineUnitChange">
                    <el-option v-for="item in unitOptions" :key="item.value" :label="item.label" :value="item.value" />
                  </el-select>
                  <span class="inline-text">{{ $t('NodeTimeoutSetting.after') }}</span>
                </template>
              </div>
            </div>

            <div class="section-divider"></div>

            <div class="section-block section-block--rules">
              <div class="section-header">
                <div class="section-label">{{ $t('NodeTimeoutSetting.rules') }}</div>
                <div class="add-rule-button" @click="handleAddRule">
                  <el-icon><i-ep-plus /></el-icon>
                  <span>{{ $t('NodeTimeoutSetting.addRule') }}</span>
                </div>
              </div>

              <div class="rule-list">
                <div v-for="(rule, index) in draftRules" :key="rule.uid" class="rule-card">
                  <div class="rule-card__head">
                    <div class="rule-card__summary">{{ resolveTimeoutRuleSummary(rule) }}</div>
                    <div class="rule-card__actions">
                      <span class="action-link" @click="openRuleDialog(rule, index)">{{ $t('NodeTimeoutSetting.edit') }}</span>
                      <span class="action-divider"></span>
                      <span class="action-link danger" @click="removeRule(index)">{{ $t('NodeTimeoutSetting.delete') }}</span>
                    </div>
                  </div>

                  <template v-if="rule.action === ProcessTimeoutActionType.BACK">
                    <div class="rule-detail">
                      <span class="rule-detail__label">{{ $t('NodeTimeoutSetting.ruleSummaryBackTo') }}</span>
                      <span class="rule-detail__value">{{ getBackNodeLabel(rule.backNodeId) }}</span>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </el-scrollbar>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="mainDialogVisible = false">{{ $t('NodeOptionDrawer.cancel') }}</el-button>
          <el-button type="primary" @click="saveMainDialog">{{ $t('NodeOptionDrawer.save') }}</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="ruleDialogVisible"
      class="node-timeout-rule-dialog"
      width="680px"
      append-to-body
      align-center
      destroy-on-close
      :close-on-click-modal="false"
      :show-close="false"
    >
      <template #header>
        <div class="timeout-dialog-header">
          <div class="timeout-dialog-header__title">{{ $t('NodeTimeoutSetting.ruleDialogTitle') }}</div>
          <button type="button" class="timeout-dialog-header__close" @click="ruleDialogVisible = false">
            <el-icon><i-ep-close /></el-icon>
          </button>
        </div>
      </template>

      <div class="timeout-dialog-body timeout-dialog-body--rule">
        <el-scrollbar class="timeout-dialog-scrollbar">
          <div class="timeout-dialog-scroll-content">
            <div class="form-field">
              <div class="field-label">{{ $t('NodeTimeoutSetting.processingMode') }}</div>
              <el-select v-model="ruleDraft.action" class="dialog-input dialog-input--select" @change="handleRuleActionChange">
                <el-option v-for="item in getSupportedActionOptions()" :key="item.value" :label="item.label" :value="item.value" :disabled="item.disabled" />
              </el-select>
            </div>

            <div class="form-field">
              <div class="field-label">{{ getRuleTimeLabel() }}</div>
              <div class="trigger-row">
                <el-select v-model="ruleDraft.trigger.point" class="dialog-input trigger-point">
                  <el-option v-for="item in triggerPointOptions" :key="item.value" :label="item.label" :value="item.value" />
                </el-select>

                <template v-if="ruleDraft.trigger.point !== ProcessTimeoutRelativePoint.AT_DEADLINE">
                  <el-input-number
                    v-model="ruleDraft.trigger.delay"
                    :min="0"
                    :max="getMaxDelayByUnit(ruleDraft.trigger.unit || ProcessTimeoutUnit.MINUTE)"
                    :step="1"
                    :controls="false"
                    class="timeout-number"
                    @change="handleRuleTriggerDelayChange"
                  />
                  <el-select v-model="ruleDraft.trigger.unit" class="dialog-input unit-select" @change="handleRuleTriggerUnitChange">
                    <el-option v-for="item in unitOptions" :key="item.value" :label="item.label" :value="item.value" />
                  </el-select>
                </template>
              </div>
            </div>

            <template v-if="ruleDraft.action === ProcessTimeoutActionType.BACK">
              <div class="form-field">
                <div class="field-label">{{ $t('NodeTimeoutSetting.backTo') }}</div>
                <el-select v-model="ruleDraft.backNodeId" class="dialog-input dialog-input--select" :placeholder="$t('NodeTimeoutSetting.selectBackNode')">
                  <el-option v-for="item in backNodeOptions" :key="item.uid" :label="item.label" :value="item.uid" />
                </el-select>
              </div>
            </template>
          </div>
        </el-scrollbar>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="ruleDialogVisible = false">{{ $t('NodeOptionDrawer.cancel') }}</el-button>
          <el-button type="primary" @click="saveRuleDialog">{{ $t('NodeTimeoutSetting.confirm') }}</el-button>
        </div>
      </template>
    </el-dialog>

  </div>
</template>

<script lang="ts" setup>
import {
  Field,
  ProcessFlow,
  ProcessNodeType,
  ProcessTimeoutActionType,
  ProcessTimeoutConfig,
  ProcessTimeoutDeadlineType,
  ProcessTimeoutFieldDeadlineValue,
  ProcessTimeoutRelativePoint,
  ProcessTimeoutRule,
  ProcessTimeoutUnit,
  FieldUID,
} from '@common/types/project';
import { FormWidgetType } from '@common/types/nocode';
import { getProcessTimeoutAvailableActions, getProcessTimeoutDeadlineConflictReason, getProcessTimeoutRuleLimitReason, hasConfiguredTimeout, normalizeProcessTimeoutConfig, resolveTimeoutRuleSummary } from '@common/utils';
import { isTriggerNode } from '@common/utils/flow';
import { unique } from '@common/utils/unique';
import { cloneDeep } from 'lodash';
import i18next from 'i18next';
import { computed, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useFormFields, useRootBranch } from '../../../hooks';
import { getApprovalRevertRangeOptions } from '../../flow-rules';
import { ProcessNode } from '../../process';
import { getTableDatePrecision } from '@renderer/views/nocode/components/global/table/date-filter';
import { elementPlusLocale as locale } from "@renderer/utils/elementPlusLocale";

type TimeoutOptionOwner = {
  timeout?: ProcessTimeoutConfig | null,
};

const props = defineProps<{
  node: ProcessNode,
  options: TimeoutOptionOwner & Record<string, any>,
}>();

const formFields = useFormFields();
const rootBranch = useRootBranch();

const createDefaultTimeoutOption = (): ProcessTimeoutConfig => ({
  enabled: false,
  deadline: {
    type: ProcessTimeoutDeadlineType.CUSTOM,
    value: {
      point: ProcessTimeoutRelativePoint.AFTER_NODE_ARRIVAL,
      delay: 1,
      unit: ProcessTimeoutUnit.DAY,
    },
  },
  deadlineFieldId: null,
  rules: [],
});

const DEFAULT_DATE_ONLY_DEADLINE_TIME = '09:00';

const createDefaultTrigger = () => ({
  point: ProcessTimeoutRelativePoint.AT_DEADLINE,
  delay: 0,
  unit: ProcessTimeoutUnit.MINUTE,
});

const createDefaultRule = (action: ProcessTimeoutActionType): ProcessTimeoutRule => {
  const rule: ProcessTimeoutRule = {
    uid: unique(),
    action,
    trigger: createDefaultTrigger(),
  };
  if (action === ProcessTimeoutActionType.BACK) {
    rule.trigger = {
      point: ProcessTimeoutRelativePoint.AFTER_DEADLINE,
      delay: 1,
      unit: ProcessTimeoutUnit.MINUTE,
    };
    rule.backNodeId = null;
  }
  return rule;
};

const normalizeTimeoutConfig = (timeout?: ProcessTimeoutConfig | null) => {
  const normalized = normalizeProcessTimeoutConfig(timeout || createDefaultTimeoutOption());
  if (normalized.deadline?.type === ProcessTimeoutDeadlineType.FIELD && !normalized.deadline.value) {
    normalized.deadline.value = {
      fieldId: null,
      time: null,
    };
  }
  if (normalized.deadline?.type === ProcessTimeoutDeadlineType.CUSTOM && !normalized.deadline.value) {
    normalized.deadline.value = {
      point: ProcessTimeoutRelativePoint.AFTER_NODE_ARRIVAL,
      delay: 1,
      unit: ProcessTimeoutUnit.DAY,
    };
  }
  return normalized;
};

const getDeadlineFieldValue = (deadline?: ProcessTimeoutConfig['deadline'] | null): ProcessTimeoutFieldDeadlineValue => {
  if (deadline?.type !== ProcessTimeoutDeadlineType.FIELD) {
    return {
      fieldId: null,
      time: null,
    };
  }
  if (typeof deadline.value === 'string') {
    return {
      fieldId: deadline.value || null,
      time: null,
    };
  }
  return {
    fieldId: (deadline.value as ProcessTimeoutFieldDeadlineValue)?.fieldId || null,
    time: (deadline.value as ProcessTimeoutFieldDeadlineValue)?.time || null,
  } as ProcessTimeoutFieldDeadlineValue;
};

const supportedActionMap: Record<ProcessNodeType, ProcessTimeoutActionType[]> = {
  [ProcessNodeType.APPROVAL]: [ProcessTimeoutActionType.SUBMIT, ProcessTimeoutActionType.BACK],
  [ProcessNodeType.TRANSACT]: [ProcessTimeoutActionType.SUBMIT],
  [ProcessNodeType.REPORT_DATA]: [ProcessTimeoutActionType.SUBMIT],
  [ProcessNodeType.START]: [],
  [ProcessNodeType.END]: [],
  [ProcessNodeType.TRIGGER_DATA_CHANGE]: [],
  [ProcessNodeType.TRIGGER_TIME_TASK]: [],
  [ProcessNodeType.TRIGGER_MANUAL]: [],
  [ProcessNodeType.TRIGGER_OPERATION]: [],
  [ProcessNodeType.CONDITION_BRANCH]: [],
  [ProcessNodeType.BRANCH_SETTING]: [],
  [ProcessNodeType.PARALLEL_BRANCH]: [],
  [ProcessNodeType.NOTIFY]: [],
  [ProcessNodeType.JUNCTION]: [],
  [ProcessNodeType.ADD_DATA]: [],
  [ProcessNodeType.EDIT_DATA]: [],
  [ProcessNodeType.DELETE_DATA]: [],
};

const actionLabelMap: Partial<Record<ProcessTimeoutActionType, string>> = {
  get [ProcessTimeoutActionType.SUBMIT]() { return i18next.t('NodeTimeoutSetting.submitAction') },
  get [ProcessTimeoutActionType.BACK]() { return i18next.t('NodeTimeoutSetting.backAction') },
};

const MAX_TIMEOUT_DELAY_BY_UNIT: Record<ProcessTimeoutUnit, number> = {
  [ProcessTimeoutUnit.MINUTE]: 43200,
  [ProcessTimeoutUnit.HOUR]: 720,
  [ProcessTimeoutUnit.DAY]: 30,
};

const unitOptions = [
  { get label() { return i18next.t('NodeTimeoutSetting.minute') }, value: ProcessTimeoutUnit.MINUTE },
  { get label() { return i18next.t('NodeTimeoutSetting.hour') }, value: ProcessTimeoutUnit.HOUR },
  { get label() { return i18next.t('NodeTimeoutSetting.day') }, value: ProcessTimeoutUnit.DAY },
];

const triggerPointOptions = [
  { get label() { return i18next.t('NodeTimeoutSetting.beforeDeadline') }, value: ProcessTimeoutRelativePoint.BEFORE_DEADLINE },
  { get label() { return i18next.t('NodeTimeoutSetting.atDeadline') }, value: ProcessTimeoutRelativePoint.AT_DEADLINE },
  { get label() { return i18next.t('NodeTimeoutSetting.afterDeadline') }, value: ProcessTimeoutRelativePoint.AFTER_DEADLINE },
];

const currentTimeout = computed(() => normalizeTimeoutConfig(props.options.timeout));
const hasTimeout = computed(() => hasConfiguredTimeout(currentTimeout.value));
const supportedActions = computed(() => supportedActionMap[props.node?.type] || []);
const availableRuleActions = computed(() => getProcessTimeoutAvailableActions(draftRules.value, supportedActions.value, editingRuleIndex.value));
const getSupportedActionOptions = () => supportedActions.value.map(item => ({
  value: item,
  label: actionLabelMap[item] || '',
  disabled: !availableRuleActions.value.includes(item) && item !== ruleDraft.value.action,
}));
const sourceSelectStyle = computed(() => ({
  width: deadlineType.value === ProcessTimeoutDeadlineType.FIELD ? '180px' : '118px',
}));

const deadlineFields = computed<Field[]>(() => {
  return (formFields.value || []).filter((field) => field?.meta?.extra?.widgetType === FormWidgetType.DATE_PICKER);
});

const backNodeOptions = computed(() => {
  if (props.node?.type !== ProcessNodeType.APPROVAL || !rootBranch.value) return [];
  const flows = rootBranch.value.getBranch().flows || [];
  return getApprovalRevertRangeOptions(flows, props.node.uid).map((item: ProcessFlow) => ({
    uid: item.uid,
    label: isTriggerNode(item.type) ? i18next.t('ApprovalOption.submit') : item.options?.name || item.type,
  }));
});

const mainDialogVisible = ref(false);
const ruleDialogVisible = ref(false);
const draftTimeout = ref<ProcessTimeoutConfig>(normalizeTimeoutConfig());
const draftRules = ref<ProcessTimeoutRule[]>([]);
const editingRuleIndex = ref(-1);
const ruleDraft = ref<ProcessTimeoutRule>(createDefaultRule(ProcessTimeoutActionType.SUBMIT));

const deadlineType = computed({
  get() {
    return draftTimeout.value.deadline?.type || ProcessTimeoutDeadlineType.CUSTOM;
  },
  set(value: ProcessTimeoutDeadlineType) {
    if (value === ProcessTimeoutDeadlineType.FIELD) {
      draftTimeout.value.deadline = {
        type: ProcessTimeoutDeadlineType.FIELD,
        value: {
          fieldId: null,
          time: null,
        },
      };
      return;
    }
    draftTimeout.value.deadline = createDefaultTimeoutOption().deadline;
  },
});

const deadlineFieldId = computed({
  get() {
    return getDeadlineFieldValue(draftTimeout.value.deadline).fieldId;
  },
  set(value: FieldUID) {
    const currentValue = getDeadlineFieldValue(draftTimeout.value.deadline);
    draftTimeout.value.deadline = {
      type: ProcessTimeoutDeadlineType.FIELD,
      value: {
        fieldId: value || null,
        time: currentValue.time,
      },
    };
  },
});

const deadlineFieldTime = computed({
  get() {
    return getDeadlineFieldValue(draftTimeout.value.deadline).time || DEFAULT_DATE_ONLY_DEADLINE_TIME;
  },
  set(value: string | null) {
    const currentValue = getDeadlineFieldValue(draftTimeout.value.deadline);
    draftTimeout.value.deadline = {
      type: ProcessTimeoutDeadlineType.FIELD,
      value: {
        fieldId: currentValue.fieldId,
        time: value || DEFAULT_DATE_ONLY_DEADLINE_TIME,
      },
    };
  },
});

const customDeadline = computed({
  get() {
    const value = draftTimeout.value.deadline?.value as any;
    if (draftTimeout.value.deadline?.type !== ProcessTimeoutDeadlineType.CUSTOM || !value) {
      draftTimeout.value.deadline = {
        type: ProcessTimeoutDeadlineType.CUSTOM,
        value: {
          point: ProcessTimeoutRelativePoint.AFTER_NODE_ARRIVAL,
          delay: 1,
          unit: ProcessTimeoutUnit.DAY,
        },
      };
    }
    return draftTimeout.value.deadline.value as { point: ProcessTimeoutRelativePoint, delay: number, unit: ProcessTimeoutUnit };
  },
  set(value) {
    draftTimeout.value.deadline = { type: ProcessTimeoutDeadlineType.CUSTOM, value };
  },
});

const getRuleTimeLabel = () => {
  if (ruleDraft.value.action === ProcessTimeoutActionType.BACK) return i18next.t('NodeTimeoutSetting.backTime');
  return i18next.t('NodeTimeoutSetting.submitTime');
};

const selectedDeadlineField = computed(() => {
  const currentFieldId = deadlineFieldId.value;
  return deadlineFields.value.find(field => field.uid === currentFieldId) || null;
});

const selectedDeadlineFieldNeedsTime = computed(() => {
  if (!selectedDeadlineField.value) return false;
  const precision = getTableDatePrecision(undefined, selectedDeadlineField.value.meta?.extra);
  return precision === 'day';
});

const getMaxDelayByUnit = (unit: ProcessTimeoutUnit) => {
  return MAX_TIMEOUT_DELAY_BY_UNIT[unit] ?? MAX_TIMEOUT_DELAY_BY_UNIT[ProcessTimeoutUnit.MINUTE];
};

const isDelayWithinUnitLimit = (delay: unknown, unit: ProcessTimeoutUnit) => {
  const numericDelay = Number(delay);
  return Number.isFinite(numericDelay) && numericDelay >= 0 && numericDelay <= getMaxDelayByUnit(unit);
};

const normalizeDelayWithinUnitLimit = (delay: unknown, unit: ProcessTimeoutUnit) => {
  const numericDelay = Number(delay);
  if (!Number.isFinite(numericDelay) || numericDelay < 0) {
    return 0;
  }
  return Math.min(numericDelay, getMaxDelayByUnit(unit));
};

const RULE_LIMIT_MESSAGE_KEY_MAP: Record<NonNullable<ReturnType<typeof getProcessTimeoutRuleLimitReason>>, string> = {
  get 'max-rule-count'() { return i18next.t('NodeTimeoutSetting.limitMaxRuleCount') },
  get 'submit-duplicate'() { return i18next.t('NodeTimeoutSetting.limitSubmitDuplicate') },
  get 'submit-conflict-back'() { return i18next.t('NodeTimeoutSetting.limitSubmitConflictBack') },
  get 'back-duplicate'() { return i18next.t('NodeTimeoutSetting.limitBackDuplicate') },
  get 'back-conflict-submit'() { return i18next.t('NodeTimeoutSetting.limitBackConflictSubmit') },
};

const DEADLINE_CONFLICT_MESSAGE_KEY_MAP: Record<NonNullable<ReturnType<typeof getProcessTimeoutDeadlineConflictReason>>, string> = {
  get 'before-node-arrival'() { return i18next.t('NodeTimeoutSetting.validationDeadlineConflict') },
};

const showRuleLimitMessage = (reason: ReturnType<typeof getProcessTimeoutRuleLimitReason>) => {
  if (!reason) return false;
  ElMessage.warning(RULE_LIMIT_MESSAGE_KEY_MAP[reason]);
  return true;
};

const showDeadlineConflictMessage = (reason: ReturnType<typeof getProcessTimeoutDeadlineConflictReason>) => {
  if (!reason) return false;
  ElMessage.warning(DEADLINE_CONFLICT_MESSAGE_KEY_MAP[reason]);
  return true;
};

const openMainDialog = () => {
  const nextTimeout = normalizeTimeoutConfig(cloneDeep(props.options.timeout || createDefaultTimeoutOption()));
  draftTimeout.value = nextTimeout;
  draftRules.value = cloneDeep(nextTimeout.rules || []).filter(rule => supportedActions.value.includes(rule.action));
  mainDialogVisible.value = true;
};

const handleDeadlineTypeChange = (value: ProcessTimeoutDeadlineType) => {
  if (value === ProcessTimeoutDeadlineType.FIELD) {
    draftTimeout.value.deadline = {
      type: ProcessTimeoutDeadlineType.FIELD,
      value: {
        fieldId: null,
        time: null,
      },
    };
    return;
  }
  draftTimeout.value.deadline = createDefaultTimeoutOption().deadline;
};

const handleDeadlineFieldChange = (value: FieldUID | null) => {
  const field = deadlineFields.value.find(item => item.uid === value) || null;
  const precision = field ? getTableDatePrecision(undefined, field.meta?.extra) : null;
  draftTimeout.value.deadline = {
    type: ProcessTimeoutDeadlineType.FIELD,
    value: {
      fieldId: value || null,
      time: precision === 'day' ? (getDeadlineFieldValue(draftTimeout.value.deadline).time || DEFAULT_DATE_ONLY_DEADLINE_TIME) : null,
    },
  };
};

const handleDeadlineFieldTimeChange = (value: string | null) => {
  deadlineFieldTime.value = value || DEFAULT_DATE_ONLY_DEADLINE_TIME;
};

const handleCustomDeadlineDelayChange = (value: number | string | undefined) => {
  customDeadline.value = {
    ...customDeadline.value,
    delay: normalizeDelayWithinUnitLimit(value, customDeadline.value.unit),
  };
};

const handleCustomDeadlineUnitChange = (value: ProcessTimeoutUnit) => {
  customDeadline.value = {
    ...customDeadline.value,
    unit: value,
    delay: normalizeDelayWithinUnitLimit(customDeadline.value.delay, value),
  };
};

const handleRuleActionChange = (value: ProcessTimeoutActionType) => {
  const limitReason = getProcessTimeoutRuleLimitReason(draftRules.value, value, editingRuleIndex.value);
  if (limitReason) {
    showRuleLimitMessage(limitReason);
    const fallbackAction = availableRuleActions.value[0] || ruleDraft.value.action;
    if (!fallbackAction || fallbackAction === value) {
      return;
    }
    value = fallbackAction;
  }

  const nextRule = createDefaultRule(value);
  ruleDraft.value = {
    ...nextRule,
    ...ruleDraft.value,
    action: value,
    trigger: {
      ...nextRule.trigger,
      ...(ruleDraft.value.trigger || {}),
    },
  };

  if (value === ProcessTimeoutActionType.BACK) {
    ruleDraft.value.backNodeId = ruleDraft.value.backNodeId || backNodeOptions.value[0]?.uid || null;
  } else {
    delete ruleDraft.value.backNodeId;
  }

  if (ruleDraft.value.trigger) {
    ruleDraft.value.trigger.delay = normalizeDelayWithinUnitLimit(
      ruleDraft.value.trigger.delay,
      ruleDraft.value.trigger.unit || ProcessTimeoutUnit.MINUTE,
    );
  }
};

const handleRuleTriggerDelayChange = (value: number | string | undefined) => {
  if (!ruleDraft.value.trigger) return;
  ruleDraft.value.trigger = {
    ...ruleDraft.value.trigger,
    delay: normalizeDelayWithinUnitLimit(value, ruleDraft.value.trigger.unit || ProcessTimeoutUnit.MINUTE),
  };
};

const handleRuleTriggerUnitChange = (value: ProcessTimeoutUnit) => {
  if (!ruleDraft.value.trigger) return;
  ruleDraft.value.trigger = {
    ...ruleDraft.value.trigger,
    unit: value,
    delay: normalizeDelayWithinUnitLimit(ruleDraft.value.trigger.delay, value),
  };
};

const handleAddRule = () => {
  if (showRuleLimitMessage(getProcessTimeoutRuleLimitReason(draftRules.value, null, -1))) return;
  openRuleDialog();
};

const openRuleDialog = (rule?: ProcessTimeoutRule, index = -1) => {
  editingRuleIndex.value = index;
  const action = rule?.action && supportedActions.value.includes(rule.action) ? rule.action : (availableRuleActions.value[0] || supportedActions.value[0]);
  ruleDraft.value = cloneDeep(rule || createDefaultRule(action));
  handleRuleActionChange(action);
  ruleDialogVisible.value = true;
};

const removeRule = (index: number) => {
  draftRules.value.splice(index, 1);
};

const ensureMainDialogValid = () => {
  if (deadlineType.value === ProcessTimeoutDeadlineType.FIELD && !deadlineFieldId.value) {
    ElMessage.warning(i18next.t('NodeTimeoutSetting.selectDeadlineField'));
    return false;
  }
  if (deadlineType.value === ProcessTimeoutDeadlineType.CUSTOM && !isDelayWithinUnitLimit(customDeadline.value.delay, customDeadline.value.unit)) {
    ElMessage.warning(i18next.t('NodeTimeoutSetting.validationDelay'));
    return false;
  }
  return true;
};

const ensureRuleDialogValid = () => {
  if (!ruleDraft.value.action) {
    ElMessage.warning(i18next.t('NodeTimeoutSetting.selectProcessingMode'));
    return false;
  }
  if (showRuleLimitMessage(getProcessTimeoutRuleLimitReason(draftRules.value, ruleDraft.value.action, editingRuleIndex.value))) {
    return false;
  }
  if (!ruleDraft.value.trigger?.point) {
    ElMessage.warning(i18next.t('NodeTimeoutSetting.selectTriggerPoint'));
    return false;
  }
  if (
    ruleDraft.value.trigger.point !== ProcessTimeoutRelativePoint.AT_DEADLINE
    && !isDelayWithinUnitLimit(ruleDraft.value.trigger.delay, ruleDraft.value.trigger.unit || ProcessTimeoutUnit.MINUTE)
  ) {
    ElMessage.warning(i18next.t('NodeTimeoutSetting.validationDelay'));
    return false;
  }
  if (ruleDraft.value.action === ProcessTimeoutActionType.BACK && !ruleDraft.value.backNodeId) {
    ElMessage.warning(i18next.t('NodeTimeoutSetting.validationBackNode'));
    return false;
  }
  return true;
};

const saveRuleDialog = () => {
  if (!ensureRuleDialogValid()) return;
  const nextRule = cloneDeep(ruleDraft.value);
  if (editingRuleIndex.value >= 0) {
    draftRules.value.splice(editingRuleIndex.value, 1, nextRule);
  } else {
    draftRules.value.push(nextRule);
  }
  ruleDialogVisible.value = false;
};

const saveMainDialog = () => {
  if (!ensureMainDialogValid()) return;
  const nextTimeout = normalizeTimeoutConfig(cloneDeep(draftTimeout.value));
  nextTimeout.rules = draftRules.value.filter(rule => supportedActions.value.includes(rule.action));
  if (showDeadlineConflictMessage(getProcessTimeoutDeadlineConflictReason(nextTimeout))) {
    return;
  }
  nextTimeout.enabled = Boolean(nextTimeout.deadline?.value && nextTimeout.rules.length);
  props.options.timeout = nextTimeout;
  mainDialogVisible.value = false;
};

const getBackNodeLabel = (backNodeId?: string | null) => {
  return backNodeOptions.value.find(item => item.uid === backNodeId)?.label || '--';
};
</script>

<style lang="scss" scoped>
.node-timeout-setting {
  width: 100%;
}

.setting-entry {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: #fff;
  box-sizing: border-box;
  cursor: pointer;

  &__text {
    font-size: 14px;
    line-height: 20px;
    font-weight: 400;
    text-align: center;

    &.is-configured {
      color: var(--color-primary);
    }
  }
}

.timeout-dialog-body {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;

  &--main {
    flex: 1;
  }

  &--rule {
    flex: 1;
  }
}

.timeout-dialog-scrollbar {
  flex: 1;
  min-height: 0;
}

.timeout-dialog-scroll-content {
  box-sizing: border-box;
  padding: 24px 20px;
}

.timeout-dialog-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 24px;

  &__title {
    font-size: 16px;
    line-height: 24px;
    font-weight: 400;
    color: #1d2129;
    text-align: center;
  }

  &__close {
    position: absolute;
    top: 50%;
    right: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 0;
    border: none;
    background: transparent;
    color: #4e5969;
    transform: translateY(-50%);
    cursor: pointer;
  }
}

.section-block + .section-block {
  margin-top: 24px;
}

.section-label {
  font-size: 14px;
  line-height: 22px;
  color: #4e5969;
  font-weight: 400;
}

.deadline-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.trigger-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.section-divider {
  margin: 24px 0;
  height: 1px;
  background: #e5e6eb;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.add-rule-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 28px;
  padding: 3px 6px;
  font-size: 14px;
  line-height: 22px;
  color: #0873ff;
  border-radius: 4px;
  cursor: pointer;
}

.rule-list {
  margin-top: 8px;
}

.rule-card + .rule-card {
  margin-top: 8px;
}

.rule-card {
  padding: 9px 12px;
  border-radius: 4px;
  background: #f2f3f5;

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  &__summary {
    font-size: 14px;
    line-height: 22px;
    color: #1d2129;
  }

  &__actions {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 14px;
    line-height: 22px;
  }
}

.action-link {
  color: #0873ff;
  cursor: pointer;

  &.danger {
    color: #ff4d4f;
  }
}

.action-divider {
  width: 1px;
  height: 12px;
  background: #e5e6eb;
}

.rule-detail {
  margin-top: 8px;
  font-size: 14px;
  line-height: 22px;

  &__label {
    color: #86909c;
  }

  &__value {
    color: #4e5969;
  }
}

.timeout-select,
.dialog-input {
  :deep(.el-select__wrapper),
  :deep(.el-input__wrapper) {
    min-height: 32px;
    height: 32px;
    padding: 0 12px;
    border-radius: 4px;
    box-shadow: none;
    background: #f2f3f5;
  }

  :deep(.el-select__selected-item),
  :deep(.el-input__inner) {
    font-size: 14px;
    line-height: 22px;
  }
}

.dialog-input--select {
  width: 240px;
  max-width: 100%;
}

.dialog-input--full {
  width: 100%;
}

.field-select { width: 240px; }
.deadline-time-select { width: 224px; }
.trigger-point {
  width: 240px;
  max-width: 100%;
}

.unit-select { width: 120px; }

.inline-text {
  font-size: 14px;
  line-height: 22px;
  color: #1d2129;
}

.timeout-number {
  width: 48px;

  :deep(.el-input__wrapper) {
    padding: 0 8px;
    background: #f2f3f5;
    box-shadow: unset;
  }

  :deep(.el-input__inner) {
    text-align: center;
    font-size: 14px;
    line-height: 22px;
  }
}

.form-field + .form-field {
  margin-top: 24px;
}

.field-label {
  margin-bottom: 8px;
  font-size: 14px;
  line-height: 22px;
  color: #4e5969;
}

.member-selector {
  min-height: 104px;
  padding: 18px 16px;
  border: 1px dashed #c9cdd4;
  border-radius: 4px;
  display: flex;
  align-items: flex-start;
  align-content: flex-start;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 8px;
  background: #fff;
  box-sizing: border-box;
  cursor: pointer;
}

.member-placeholder {
  display: flex;
  width: 100%;
  min-height: 66px;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 14px;
  line-height: 22px;
  color: #4e5969;
}

.member-tag {
  height: 32px;
}

.dialog-footer {
  display: flex;
  width: 100%;
  justify-content: flex-end;
  gap: 8px;

  :deep(.el-button) {
    width: 60px;
    height: 32px;
    padding: 5px 16px;
    border-radius: 4px;
    margin: 0;
  }
}
</style>

<style lang="scss">
.node-timeout-main-dialog,
.node-timeout-rule-dialog {
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
  max-height: calc(100vh - 32px);
  --el-dialog-padding-primary: 0;
}

.node-timeout-main-dialog {
  height: 730px;
}

.node-timeout-rule-dialog {
  height: 552px;
}

.node-timeout-main-dialog .el-dialog__header,
.node-timeout-rule-dialog .el-dialog__header {
  box-sizing: border-box;
  margin: 0;
  height: 48px;
  padding: 0 20px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.node-timeout-main-dialog .el-dialog__body,
.node-timeout-rule-dialog .el-dialog__body {
  padding: 0;
  flex: 1;
  min-height: 0;
}

.node-timeout-main-dialog .timeout-dialog-scrollbar,
.node-timeout-rule-dialog .timeout-dialog-scrollbar {
  height: 100%;
}

.node-timeout-main-dialog .timeout-dialog-scrollbar .el-scrollbar__wrap,
.node-timeout-rule-dialog .timeout-dialog-scrollbar .el-scrollbar__wrap {
  overflow-x: hidden;
}

.node-timeout-main-dialog .el-dialog__footer,
.node-timeout-rule-dialog .el-dialog__footer {
  box-sizing: border-box;
  height: 64px;
  padding: 0 20px;
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
}
</style>
