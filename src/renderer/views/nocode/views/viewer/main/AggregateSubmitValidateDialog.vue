<template>
  <el-dialog
    :model-value="modelValue"
    class="aggregate-submit-validate-formula-dialog"
    width="1008"
    align-center
    destroy-on-close
    :close-on-click-modal="false"
    @open="onOpen"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="dialog-header">
        <div class="dialog-header__title">{{ $t('AggregateSubmitValidateDialog.formulaEdit') }}</div>
      </div>
    </template>

    <div class="aggregate-submit-validate-dialog">
      <formula-editer
        v-if="formulaTables.length"
        ref="formulaEditor"
        :default-tables="[]"
        :tables="formulaTables"
        :linked-tables="[]"
        :hidden-current-table="true"
        :other-table-label="$t('AggregateSubmitValidateDialog.aggregateMetricLabel')"
      />

      <el-empty v-else :description="$t('AggregateSubmitValidateDialog.pleaseAddMetricField')" :image-size="60" />
    </div>

    <template #footer>
      <el-button @click="handleClose">{{ $t('AggregateSubmitValidateDialog.cancel') }}</el-button>
      <el-button type="primary" @click="handleConfirm">{{ $t('AggregateSubmitValidateDialog.confirm') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { AggregateMetric } from '@common/types/nocode';
import { Field, FieldUID, TableUID, TableWithSource } from '@common/types/project';
import FormulaEditer from '@renderer/views/nocode/components/global/table/components/formula/FormulaEditer.vue';
import { replaceBracketId } from '@renderer/views/nocode/components/global/table/components/formula/utils';
import { ElMessage } from 'element-plus';
import i18next from 'i18next';
import { computed, nextTick, ref } from 'vue';

const props = withDefaults(defineProps<{
  modelValue: boolean,
  tableUid: string,
  metrics?: AggregateMetric[],
  value?: string,
}>(), {
  metrics: () => [],
  value: '',
});

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void,
  (event: 'update', value: string): void,
}>();

const formulaEditor = ref();

const metricFields = computed<Field[]>(() => (props.metrics || []).map(metric => ({
  uid: metric.uid as FieldUID,
  alias: metric.name || i18next.t('AggregateSubmitValidateDialog.unnamedMetric'),
  type: 'number',
  meta: {
    uid: metric.uid as FieldUID,
    name: metric.name || i18next.t('AggregateSubmitValidateDialog.unnamedMetric'),
    extra: {
      widgetType: 'widget.form.numberInput',
    },
  },
} as Field)));

const formulaTables = computed<TableWithSource[]>(() => {
  if (!props.tableUid || !metricFields.value.length) return [];
  return [{
    uid: props.tableUid as TableUID,
    name: i18next.t('AggregateSubmitValidateDialog.aggregateMetricLabel'),
    alias: i18next.t('AggregateSubmitValidateDialog.aggregateMetricLabel'),
    meta: {
      connectionUID: 'c_aggregate_submit_validate',
    },
    fields: metricFields.value,
    formSelectLabel: i18next.t('AggregateSubmitValidateDialog.aggregateMetricLabel'),
    formulaAlias: i18next.t('AggregateSubmitValidateDialog.aggregateMetricLabel'),
    connectionUID: 'c_aggregate_submit_validate',
  } as TableWithSource];
});

const syncFormulaAlias = (formula: string) => {
  if (!formula) return '';
  return replaceBracketId(formula, (ids, aliases) => {
    if (ids[0] !== props.tableUid) return `${ids.join('.')},${aliases.join('.') || ids.join('.')}`;
    const metric = (props.metrics || []).find(item => item.uid === ids[1]);
    if (!metric) return `${props.tableUid}.${ids[1] || ''},${i18next.t('AggregateSubmitValidateDialog.deleted')}`;
    return `${props.tableUid}.${metric.uid},${metric.name || i18next.t('AggregateSubmitValidateDialog.unnamedMetric')}`;
  });
};

const onOpen = async () => {
  await nextTick();
  const tableUID = formulaTables.value[0]?.uid;
  if (tableUID) {
    formulaEditor.value?.selectTable?.(tableUID);
    formulaEditor.value?.init?.(syncFormulaAlias(props.value || ''));
  }
};

const handleClose = () => {
  formulaEditor.value?.clear?.();
  emit('update:modelValue', false);
};

const handleConfirm = () => {
  const formula = syncFormulaAlias(formulaEditor.value?.getCodeMirrorText?.() || '');
  if (!formula) {
    ElMessage.error(i18next.t('AggregateSubmitValidateDialog.validateFormulaRequired'));
    return;
  }

  emit('update', formula);
  handleClose();
};
</script>

<style scoped lang="scss">
.dialog-header__title {
  color: var(--text-color-primary);
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
  text-align: center;
}

.aggregate-submit-validate-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

</style>

<style lang="scss">
.aggregate-submit-validate-formula-dialog {
  --el-dialog-padding-primary: 0;
  --el-dialog-bg-color: var(--bg-color-page);
  --dialog-header-height: 48px;
  --dialog-footer-height: 64px;

  .el-dialog__header {
    height: var(--dialog-header-height);
    padding: 0 16px;
    margin-right: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-bottom: 1px solid var(--border-color);
  }

  .el-dialog__headerbtn {
    top: 0;
    right: 0;
    width: var(--dialog-header-height);
    height: var(--dialog-header-height);
  }

  .el-dialog__body {
    padding: 16px;
  }

  .el-dialog__footer {
    height: var(--dialog-footer-height);
    padding: 16px;
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: end;
    align-items: center;
    background: var(--bg-color-page);
  }

  .el-dialog__footer .el-button {
    border-radius: 4px;
  }
}
</style>
