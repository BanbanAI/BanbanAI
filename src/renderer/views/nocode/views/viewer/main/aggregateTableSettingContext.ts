import {
  AggregateDimension,
  AggregateDimensionItem,
  AggregateMetric,
  AggregateMetricMode,
  AggregateMetricVariable,
  AggregateSourceTable,
  AggregateSubmitValidateConfig,
  AggregateSubmitValidateRule,
  AggregateTable,
  AggregateVariableAggregate,
  FormConditionValueType,
  FilterRule,
  LogicalOperator,
  Nocode,
  NocodeStructureType,
  RuleFunc,
} from '@common/types/nocode';
import { ConnectionUID, Field, FieldUID, SortType, Table, TableUID } from '@common/types/project';
import { isSystemField } from '@common/utils';
import {
  isAggregateTableAvailable,
} from '@renderer/utils/aggregateTable';
import { checkNocodeSyncBeforeRequest, handleNocodeSyncConflictError } from '@renderer/utils/nocodeSyncMessage';
import { replaceBracketId } from '@renderer/views/nocode/components/global/table/components/formula/utils';
import { formDataApi } from '@renderer/views/nocode/utils';
import { deepClone } from '@common/utils/object';
import { ElMessage } from 'element-plus';
import axios from 'axios';
import i18next from 'i18next';
import { computed, inject, type InjectionKey, ref, type Ref, watch } from 'vue';
import { getFirstAvailableAggregateTableName, normalizeAggregateTableName } from './aggregateTableSettingUtils';

type AggregateDimensionDraft = Omit<AggregateDimension, 'items'> & {
  items: AggregateDimensionItem[],
};
type AggregateMetricDraft = AggregateMetric & {
  format: NonNullable<AggregateMetric['format']>,
  variables: AggregateMetricVariable[],
};
type AggregateSubmitValidateConfigDraft = {
  enabled: boolean,
  rules: AggregateSubmitValidateRule[],
};
type AggregateTableDraft = Omit<AggregateTable, 'sourceTables' | 'dimensions' | 'variables' | 'metrics' | 'submitValidate'> & {
  sourceTables: AggregateSourceTable[],
  dimensions: AggregateDimensionDraft[],
  metrics: AggregateMetricDraft[],
  submitValidate: AggregateSubmitValidateConfigDraft,
};
type AggregateFieldOption = {
  value: string,
  label: string,
  fullLabel: string,
  fieldUID?: FieldUID | '_count' | null,
  subFieldUID?: FieldUID | '_count' | null,
  field?: Field | null,
  conditionUID?: string,
};
type MetricVariableOption = {
  uid: string,
  label: string,
  sourceUID: string,
  sourceLabel?: string,
  optionType?: 'sourceField' | 'metric',
  metricUID?: string,
  aggregate: AggregateVariableAggregate,
  fieldUID?: FieldUID | '_count' | null,
  subFieldUID?: FieldUID | '_count' | null,
  filterFieldOptions?: {
    value: string,
    label: string,
    field?: Field | null,
  }[],
};
type AggregateTableListItem = {
  uid: string,
  name: string,
  sourceText: string,
  statusText: string,
  statusClass: string,
  createdAt: string,
  raw: AggregateTableDraft,
};
type AggregateSourceConnection = {
  uid: ConnectionUID,
  name: string,
  tables: Table[],
};
export type AggregateSourceTreeNode = {
  key: string,
  label: string,
  type: 'group' | 'table' | 'subTable',
  connectionUID?: ConnectionUID | null,
  tableUID?: TableUID | null,
  subTableUID?: TableUID | null,
  children?: AggregateSourceTreeNode[],
};

type CreateAggregateTableSettingContextOptions = {
  editorVisible: Ref<boolean>,
  enabled: Ref<boolean>,
  isChanged: Ref<boolean>,
  nocode: Ref<Nocode>,
  nocodeId: string,
  nocodeSignIsLatest: unknown,
  onUpdateNocode: () => void | Promise<void>,
};

const AGGREGATE_METRIC_SOURCE_UID = '__aggregate_metric__';

export const AGGREGATE_TABLE_TEXT = {
  get dataCenterTitle() { return i18next.t('aggregateTable.dataCenterTitle') },
  get aggregateTab() { return i18next.t('aggregateTable.aggregateTab') },
  get factoryTab() { return i18next.t('aggregateTable.factoryTab') },
  get factoryPlaceholder() { return i18next.t('aggregateTable.factoryPlaceholder') },
  get listTip() { return i18next.t('aggregateTable.listTip') },
  get viewTutorial() { return i18next.t('aggregateTable.viewTutorial') },
  get createAggregateTable() { return i18next.t('aggregateTable.createAggregateTable') },
  get nameColumn() { return i18next.t('aggregateTable.nameColumn') },
  get sourceColumn() { return i18next.t('aggregateTable.sourceColumn') },
  get statusColumn() { return i18next.t('aggregateTable.statusColumn') },
  get createdAtColumn() { return i18next.t('aggregateTable.createdAtColumn') },
  get actionColumn() { return i18next.t('aggregateTable.actionColumn') },
  get viewAction() { return i18next.t('aggregateTable.viewAction') },
  get moreAction() { return i18next.t('aggregateTable.moreAction') },
  get editAction() { return i18next.t('aggregateTable.editAction') },
  get copyAction() { return i18next.t('aggregateTable.copyAction') },
  get deleteAction() { return i18next.t('aggregateTable.deleteAction') },
  get noAggregateTables() { return i18next.t('aggregateTable.noAggregateTables') },
  get basicInfo() { return i18next.t('aggregateTable.basicInfo') },
  get nameField() { return i18next.t('aggregateTable.nameField') },
  get descriptionField() { return i18next.t('aggregateTable.descriptionField') },
  get namePlaceholder() { return i18next.t('aggregateTable.namePlaceholder') },
  get descriptionPlaceholder() { return i18next.t('aggregateTable.descriptionPlaceholder') },
  get sourceSection() { return i18next.t('aggregateTable.sourceSection') },
  get dimensionSection() { return i18next.t('aggregateTable.dimensionSection') },
  get metricSection() { return i18next.t('aggregateTable.metricSection') },
  get submitValidateSection() { return i18next.t('aggregateTable.submitValidateSection') },
  get submitValidateTip() { return i18next.t('aggregateTable.submitValidateTip') },
  get addValidateRule() { return i18next.t('aggregateTable.addValidateRule') },
  get hasValidateRule() { return i18next.t('aggregateTable.hasValidateRule') },
  get emptyValidateText() { return i18next.t('aggregateTable.emptyValidateText') },
  get noValidateRules() { return i18next.t('aggregateTable.noValidateRules') },
  get configureMetricFirst() { return i18next.t('aggregateTable.configureMetricFirst') },
  get configure() { return i18next.t('aggregateTable.configure') },
  get noSourceTables() { return i18next.t('aggregateTable.noSourceTables') },
  get noDimensions() { return i18next.t('aggregateTable.noDimensions') },
  get configureSourceFirst() { return i18next.t('aggregateTable.configureSourceFirst') },
  get addMetric() { return i18next.t('aggregateTable.addMetric') },
  get unnamedMetric() { return i18next.t('aggregateTable.unnamedMetric') },
  get noMetrics() { return i18next.t('aggregateTable.noMetrics') },
  get selectAggregateTable() { return i18next.t('aggregateTable.selectAggregateTable') },
  get dimensionItemPrefix() { return i18next.t('aggregateTable.dimensionItemPrefix') },
  get save() { return i18next.t('aggregateTable.save') },
  get cancel() { return i18next.t('aggregateTable.cancel') },
  get confirm() { return i18next.t('aggregateTable.confirm') },
  get add() { return i18next.t('aggregateTable.add') },
  get clear() { return i18next.t('aggregateTable.clear') },
  get unsaved() { return i18next.t('aggregateTable.unsaved') },
  get unnamedAggregateTable() { return i18next.t('aggregateTable.unnamedAggregateTable') },
  get normalStatus() { return i18next.t('aggregateTable.normalStatus') },
  get invalidStatus() { return i18next.t('aggregateTable.invalidStatus') },
  get notAvailable() { return i18next.t('aggregateTable.notAvailable') },
  get mainTable() { return i18next.t('aggregateTable.mainTable') },
  get subTable() { return i18next.t('aggregateTable.subTable') },
  get unselectedField() { return i18next.t('aggregateTable.unselectedField') },
  get unconfiguredSource() { return i18next.t('aggregateTable.unconfiguredSource') },
  get deleted() { return i18next.t('aggregateTable.deleted') },
  get formulaUnset() { return i18next.t('aggregateTable.formulaUnset') },
  get singleFieldUnset() { return i18next.t('aggregateTable.singleFieldUnset') },
  get percent() { return i18next.t('aggregateTable.percent') },
  get completeZero() { return i18next.t('aggregateTable.completeZero') },
  get thousandSeparator() { return i18next.t('aggregateTable.thousandSeparator') },
  get decimalPlacesSuffix() { return i18next.t('aggregateTable.decimalPlacesSuffix') },
  get saveSuccess() { return i18next.t('aggregateTable.saveSuccess') },
  get duplicateSuffix() { return i18next.t('aggregateTable.duplicateSuffix') },
  get copiedAggregateTable() { return i18next.t('aggregateTable.copiedAggregateTable') },
  get addSource() { return i18next.t('aggregateTable.addSource') },
  get addField() { return i18next.t('aggregateTable.addField') },
  get filterEmpty() { return i18next.t('aggregateTable.filterEmpty') },
  get quickAggregate() { return i18next.t('aggregateTable.quickAggregate') },
  get formulaEdit() { return i18next.t('aggregateTable.formulaEdit') },
  get unsupportedSourceFilter() { return i18next.t('aggregateTable.unsupportedSourceFilter') },
  get unsavedBackConfirm() { return i18next.t('aggregateTable.unsavedBackConfirm') },
  get backWithoutSave() { return i18next.t('aggregateTable.backWithoutSave') },
  get filterConditionTitle() { return i18next.t('aggregateTable.filterConditionTitle') },
  get searchPlaceholder() { return i18next.t('aggregateTable.searchPlaceholder') },
  get emptyText() { return i18next.t('aggregateTable.emptyText') },
  get selectField() { return i18next.t('aggregateTable.selectField') },
  get selectMainTable() { return i18next.t('aggregateTable.selectMainTable') },
  get selectSubTable() { return i18next.t('aggregateTable.selectSubTable') },
  get select() { return i18next.t('aggregateTable.select') },
  get selectDate() { return i18next.t('aggregateTable.selectDate') },
  get selectTime() { return i18next.t('aggregateTable.selectTime') },
  get input() { return i18next.t('aggregateTable.input') },
  get inputAndEnter() { return i18next.t('aggregateTable.inputAndEnter') },
  get inputStartValue() { return i18next.t('aggregateTable.inputStartValue') },
  get inputEndValue() { return i18next.t('aggregateTable.inputEndValue') },
  get startDate() { return i18next.t('aggregateTable.startDate') },
  get endDate() { return i18next.t('aggregateTable.endDate') },
  get addCondition() { return i18next.t('aggregateTable.addCondition') },
  get filterConditionIncomplete() { return i18next.t('aggregateTable.filterConditionIncomplete') },
  get dimensionDialogTitle() { return i18next.t('aggregateTable.dimensionDialogTitle') },
  get dimensionDialogTip() { return i18next.t('aggregateTable.dimensionDialogTip') },
  get inputFieldName() { return i18next.t('aggregateTable.inputFieldName') },
  get dateFormatLabel() { return i18next.t('aggregateTable.dateFormatLabel') },
  get configLabel() { return i18next.t('aggregateTable.configLabel') },
  get year() { return i18next.t('aggregateTable.year') },
  get yearQuarter() { return i18next.t('aggregateTable.yearQuarter') },
  get yearMonth() { return i18next.t('aggregateTable.yearMonth') },
  get yearWeek() { return i18next.t('aggregateTable.yearWeek') },
  get yearMonthDay() { return i18next.t('aggregateTable.yearMonthDay') },
  get metricNameLabel() { return i18next.t('aggregateTable.metricNameLabel') },
  get inputMetricName() { return i18next.t('aggregateTable.inputMetricName') },
  get aggregateMethod() { return i18next.t('aggregateTable.aggregateMethod') },
  get metricReference() { return i18next.t('aggregateTable.metricReference') },
  get metricReferenceSummary() { return i18next.t('aggregateTable.metricReferenceSummary') },
  get configDescription() { return i18next.t('aggregateTable.configDescription') },
  get configDescriptionSummary() { return i18next.t('aggregateTable.configDescriptionSummary') },
  get decimalPlaces() { return i18next.t('aggregateTable.decimalPlaces') },
  get showThousandSeparator() { return i18next.t('aggregateTable.showThousandSeparator') },
  get showAsPercent() { return i18next.t('aggregateTable.showAsPercent') },
  get sourceTableForm() { return i18next.t('aggregateTable.sourceTableForm') },
  get noSourceData() { return i18next.t('aggregateTable.noSourceData') },
  get aggregateMetricLabel() { return i18next.t('aggregateTable.aggregateMetricLabel') },
  get pleaseAddMetricField() { return i18next.t('aggregateTable.pleaseAddMetricField') },
  get validateFormulaRequired() { return i18next.t('aggregateTable.validateFormulaRequired') },
  get validateRuleTip() { return i18next.t('aggregateTable.validateRuleTip') },
  get validationCondition() { return i18next.t('aggregateTable.validationCondition') },
  get addConditionGroup() { return i18next.t('aggregateTable.addConditionGroup') },
  get conditionGroup() { return i18next.t('aggregateTable.conditionGroup') },
  get validationFailTipLabel() { return i18next.t('aggregateTable.validationFailTipLabel') },
  get inputValidationFailTip() { return i18next.t('aggregateTable.inputValidationFailTip') },
  get when() { return i18next.t('aggregateTable.when') },
  get and() { return i18next.t('aggregateTable.and') },
  get field() { return i18next.t('aggregateTable.field') },
  get setFormula() { return i18next.t('aggregateTable.setFormula') },
  get formulaConfigured() { return i18next.t('aggregateTable.formulaConfigured') },
  get minValue() { return i18next.t('aggregateTable.minValue') },
  get maxValue() { return i18next.t('aggregateTable.maxValue') },
  get defaultSubmitValidateError() { return i18next.t('aggregateTable.defaultSubmitValidateError') },
  get aggregateFields() { return i18next.t('aggregateTable.aggregateFields') },
  get fieldPrefix() { return i18next.t('aggregateTable.fieldPrefix') },
  get currentTable() { return i18next.t('aggregateTable.currentTable') },
  get recordCount() { return i18next.t('aggregateTable.recordCount') },
  get noAggregateFields() { return i18next.t('aggregateTable.noAggregateFields') },
  get noAggregatableFields() { return i18next.t('aggregateTable.noAggregatableFields') },
  get inputAggregateFieldName() { return i18next.t('aggregateTable.inputAggregateFieldName') },
  get mixedAggregateError() { return i18next.t('aggregateTable.mixedAggregateError') },
  get noData() { return i18next.t('aggregateTable.noData') },
} as const;

export const aggregateTableSettingContextKey: InjectionKey<AggregateTableSettingContext> = Symbol('aggregateTableSettingContext');

export const createAggregateTableSettingContext = ({
  editorVisible,
  enabled,
  isChanged,
  nocode,
  nocodeId,
  nocodeSignIsLatest,
  onUpdateNocode,
}: CreateAggregateTableSettingContextOptions) => {
  const draftAggregateTables = ref<AggregateTableDraft[]>([]);
  const activeTableUid = ref('');
  const editingAggregateTable = ref<AggregateTableDraft | null>(null);
  const savedSnapshot = ref('[]');
  const sourceTableDialogVisible = ref(false);
  const dimensionDialogVisible = ref(false);
  const metricFormulaDialogVisible = ref(false);
  const metricSingleFieldDialogVisible = ref(false);
  const submitValidateDialogVisible = ref(false);
  const editingMetricUid = ref('');
  const previewRows = ref<any[]>([]);
  const previewLoading = ref(false);
  const previewRequestId = ref(0);
  const aggregateTableCreatedAtMap = ref<Record<string, string>>({});

  const createId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const buildFieldOptionValue = (fieldUID?: FieldUID | '_count' | null, subFieldUID?: FieldUID | '_count' | null) => [fieldUID || '', subFieldUID || ''].join('::');
  const buildConditionFieldUID = (fieldUID?: FieldUID | '_count' | null, subFieldUID?: FieldUID | '_count' | null) => subFieldUID ? `${fieldUID || ''}.${subFieldUID}` : `${fieldUID || ''}`;
  const getTableLabel = (table?: Table) => table?.alias || table?.name || table?.uid || '';
  const getFieldLabel = (field?: Field) => field?.alias || field?.uid || '';

  const currentConnectionUID = computed(() => (nocode.value?.body?.formData?.uid || '') as ConnectionUID);
  const currentConnectionName = computed(() => nocode.value?.meta?.name || '');
  const sourceTables = computed(() => nocode.value?.body?.formData?.tables || []);
  const mainSourceTables = computed(() => sourceTables.value.filter(table => !table?.meta?.extra?.primaryTable));
  const aggregateSelectableConnections = computed<AggregateSourceConnection[]>(() => {
    const currentConnection = currentConnectionUID.value ? [{
      uid: currentConnectionUID.value,
      name: currentConnectionName.value,
      tables: sourceTables.value,
    }] : [];
    return [
      ...currentConnection,
      ...((nocode.value?.body?.otherDataSources || []).map(source => ({
        uid: source.uid,
        name: source.name || source.nocodeId || source.uid,
        tables: source.tables || [],
      }))),
    ];
  });
  const aggregateSchemaConnections = computed<AggregateSourceConnection[]>(() => {
    const connectionMap = new Map<string, AggregateSourceConnection>();
    aggregateSelectableConnections.value.forEach(connection => {
      if (!connection?.uid) return;
      connectionMap.set(connection.uid, connection);
    });
    (nocode.value?.body?.otherDataSourceSchemas || []).forEach(source => {
      if (!source?.uid || connectionMap.has(source.uid)) return;
      connectionMap.set(source.uid, {
        uid: source.uid,
        name: source.name || source.nocodeId || source.uid,
        tables: source.tables || [],
      });
    });
    return Array.from(connectionMap.values());
  });
  const currentAggregateTable = computed(() => editingAggregateTable.value);
  const currentEditingMetric = computed(() => currentAggregateTable.value?.metrics.find(item => item.uid === editingMetricUid.value));

  const getAggregateSourceConnectionUID = (sourceTable?: AggregateSourceTable | null) => sourceTable?.connectionUID || currentConnectionUID.value || '';
  const getAggregateConnectionByUID = (connectionUID?: ConnectionUID | null, selectableOnly = false) => {
    if (!connectionUID) return undefined;
    const connections = selectableOnly ? aggregateSelectableConnections.value : aggregateSchemaConnections.value;
    return connections.find(connection => connection.uid === connectionUID);
  };
  const getMainSourceTableByUID = (tableUID?: TableUID | null, connectionUID?: ConnectionUID | null) => {
    const connection = getAggregateConnectionByUID(connectionUID || currentConnectionUID.value);
    return connection?.tables.find(table => table.uid === tableUID && !table?.meta?.extra?.primaryTable);
  };
  const getSourceTableSchemaByUID = (tableUID?: TableUID | null, connectionUID?: ConnectionUID | null, selectableOnly = false) => {
    const connection = getAggregateConnectionByUID(connectionUID || currentConnectionUID.value, selectableOnly);
    return connection?.tables.find(table => table.uid === tableUID);
  };
  const getSourceTableByUID = (sourceUID?: string, table?: AggregateTableDraft | null) => (table?.sourceTables || []).find(item => item.uid === sourceUID);

  const createDefaultSourceTable = (): AggregateSourceTable => ({
    uid: createId('source'),
    connectionUID: currentConnectionUID.value || null,
    tableUID: null,
    subTableUID: null,
    filterRule: undefined,
  });
  const createDefaultDimensionItem = (sourceUID = ''): AggregateDimensionItem => ({ uid: createId('dimension_item'), sourceUID, fieldUID: null, subFieldUID: null });
  const createDefaultMetricVariable = (metricVariable?: AggregateMetricVariable | null): AggregateMetricVariable => ({
    uid: metricVariable?.uid || createId('metric_variable'),
    sourceVariableUID: metricVariable?.sourceVariableUID || '',
    name: metricVariable?.name || '',
    sourceUID: metricVariable?.sourceUID || '',
    aggregate: metricVariable?.aggregate || 'SUM',
    fieldUID: metricVariable?.fieldUID ?? null,
    subFieldUID: metricVariable?.subFieldUID ?? null,
    filterRule: metricVariable?.filterRule ? deepClone(metricVariable.filterRule) : undefined,
  });
  const createDefaultMetric = (): AggregateMetricDraft => ({
    uid: createId('metric'),
    name: '',
    mode: 'formula',
    formula: '',
    variables: [],
    singleFieldConfig: createDefaultMetricVariable(),
    format: {
      isPercent: false,
      completeZero: false,
      decimalPlaces: 0,
      thousandSeparator: '',
      decimalSeparator: '.',
    },
  });
  const createDefaultSubmitValidateRule = (rule?: AggregateSubmitValidateRule | null): AggregateSubmitValidateRule => ({
    uid: rule?.uid || createId('submit_validate_rule'),
    errorText: rule?.errorText || '',
    formula: rule?.formula || '',
    conditions: (
      (rule?.conditions?.length ? rule.conditions : (rule?.formula ? [{
        type: FormConditionValueType.FORMULA,
        formula: rule.formula,
      }] : []))
    ).map(condition => ({
      uid: condition?.uid || '',
      func: condition?.func || RuleFunc.EQUAL,
      value: deepClone(condition?.value ?? null),
      formula: condition?.formula || '',
      fixedValue: deepClone(condition?.fixedValue ?? null),
      type: condition?.type || (condition?.formula ? FormConditionValueType.FORMULA : FormConditionValueType.FORM),
      tFormat: deepClone(condition?.tFormat ?? null),
    })),
  });
  const createDefaultSubmitValidateConfig = (config?: AggregateSubmitValidateConfig | null): AggregateSubmitValidateConfigDraft => ({
    enabled: Boolean(config?.enabled),
    rules: (config?.rules || []).map(item => createDefaultSubmitValidateRule(item)),
  });
  const createDefaultAggregateTable = (name: string): AggregateTableDraft => ({
    uid: createId('aggregate'),
    name,
    description: '',
    dimensionFilterEmpty: false,
    sourceTables: [createDefaultSourceTable()],
    dimensions: [],
    metrics: [],
    submitValidate: createDefaultSubmitValidateConfig(),
  });

  const formatDateLabel = (date = new Date()) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}.${month}.${day}`;
  };
  const syncAggregateTableCreatedAtMap = (tables = draftAggregateTables.value) => {
    const nextMap = { ...aggregateTableCreatedAtMap.value };
    tables.forEach(item => {
      if (!nextMap[item.uid]) nextMap[item.uid] = AGGREGATE_TABLE_TEXT.notAvailable;
    });
    Object.keys(nextMap).forEach(uid => {
      if (!tables.some(item => item.uid === uid)) delete nextMap[uid];
    });
    aggregateTableCreatedAtMap.value = nextMap;
  };
  const setAggregateTableCreatedAt = (uid: string, value = formatDateLabel()) => {
    aggregateTableCreatedAtMap.value = {
      ...aggregateTableCreatedAtMap.value,
      [uid]: value,
    };
  };

  const applyMetricVariableFilterRule = (metricVariable: AggregateMetricVariable, filterRule?: FilterRule) => {
    metricVariable.filterRule = filterRule ? deepClone(filterRule) : undefined;
  };
  const getFieldReferenceValue = (field: { fieldUID?: FieldUID | '_count' | null, subFieldUID?: FieldUID | '_count' | null }) => buildFieldOptionValue(field.fieldUID, field.subFieldUID);
  const applyFieldReferenceValue = (target: { fieldUID?: FieldUID | '_count' | null, subFieldUID?: FieldUID | '_count' | null }, option?: AggregateFieldOption) => {
    target.fieldUID = option?.fieldUID ?? null;
    target.subFieldUID = option?.subFieldUID ?? null;
  };
  const clearInvalidFieldReference = (target: { fieldUID?: FieldUID | '_count' | null, subFieldUID?: FieldUID | '_count' | null }, options: AggregateFieldOption[]) => {
    if (!target.fieldUID && !target.subFieldUID) return;
    if (!options.some(option => option.value === getFieldReferenceValue(target))) applyFieldReferenceValue(target);
  };

  const getConnectionDisplayName = (connectionUID?: ConnectionUID | null) => {
    return getAggregateConnectionByUID(connectionUID)?.name || '';
  };
  const getSubTableOptionsByTableUID = (
    tableUID?: TableUID | null,
    connectionUID?: ConnectionUID | null,
    selectableOnly = false,
  ) => {
    const resolvedConnectionUID = connectionUID || currentConnectionUID.value;
    const mainTable = getMainSourceTableByUID(tableUID, resolvedConnectionUID);
    if (!mainTable) return [] as { value: TableUID, label: string }[];

    const usedUIDs = new Set<string>();
    return (mainTable.fields || []).reduce((result, field) => {
      if (isSystemField(field)) return result;
      const subTableUID = field.meta?.extra?.subTableUID?.[1];
      if (!subTableUID || usedUIDs.has(subTableUID)) return result;
      const subTable = getSourceTableSchemaByUID(subTableUID, resolvedConnectionUID, selectableOnly);
      if (!subTable) return result;
      usedUIDs.add(subTableUID);
      result.push({
        value: subTable.uid,
        label: getFieldLabel(field) || getTableLabel(subTable),
      });
      return result;
    }, [] as { value: TableUID, label: string }[]);
  };

  const getSubTableLabel = (sourceTable?: AggregateSourceTable | null) => {
    if (!sourceTable?.tableUID || !sourceTable?.subTableUID) return '';
    return getSubTableOptionsByTableUID(
      sourceTable.tableUID,
      getAggregateSourceConnectionUID(sourceTable),
    ).find(item => item.value === sourceTable.subTableUID)?.label || '';
  };
  const getSourceTableHeaderTitle = (sourceTable: AggregateSourceTable) => {
    const connectionUID = getAggregateSourceConnectionUID(sourceTable);
    const tableLabel = getTableLabel(getMainSourceTableByUID(sourceTable.tableUID, connectionUID));
    if (!tableLabel) return AGGREGATE_TABLE_TEXT.unconfiguredSource;
    const connectionLabel = getConnectionDisplayName(connectionUID);
    if (!connectionLabel || connectionUID === currentConnectionUID.value) return tableLabel;
    return `${connectionLabel} - ${tableLabel}`;
  };
  const getSourceTableSubLabel = (sourceTable: AggregateSourceTable) => getSubTableLabel(sourceTable);
  const getSourceTableSelectionLabel = (sourceTable: AggregateSourceTable) => {
    const title = getSourceTableHeaderTitle(sourceTable);
    const subLabel = getSourceTableSubLabel(sourceTable);
    return subLabel ? `${title} - ${subLabel}` : title;
  };
  const buildAggregateSourceTreeNodeKey = (connectionUID?: ConnectionUID | null, tableUID?: TableUID | null, subTableUID?: TableUID | null) => subTableUID
    ? `subTable:${connectionUID || ''}:${tableUID || ''}:${subTableUID}`
    : `table:${connectionUID || ''}:${tableUID || ''}`;
  const createAggregateSourceTreeNodeByTable = (table: Table, connectionUID?: ConnectionUID | null, label?: string): AggregateSourceTreeNode => ({
    key: buildAggregateSourceTreeNodeKey(connectionUID, table.uid),
    label: label || getTableLabel(table),
    type: 'table',
    connectionUID: connectionUID || null,
    tableUID: table.uid,
    subTableUID: null,
    children: getSubTableOptionsByTableUID(table.uid, connectionUID, true).map(item => ({
      key: buildAggregateSourceTreeNodeKey(connectionUID, table.uid, item.value),
      label: item.label,
      type: 'subTable',
      connectionUID: connectionUID || null,
      tableUID: table.uid,
      subTableUID: item.value,
    })),
  });
  const buildAggregateSourceTreeNodesByStructure = (
    structures: NonNullable<Nocode['body']['structure']>,
    usedTableUIDs: Set<string>,
  ): AggregateSourceTreeNode[] => structures.reduce((result, item) => {
    if (item.type === NocodeStructureType.GROUP) {
      const children = buildAggregateSourceTreeNodesByStructure(item.children || [], usedTableUIDs);
      if (!children.length) return result;
      result.push({
        key: `group:${item.id}`,
        label: item.name || '',
        type: 'group',
        children,
      });
      return result;
    }
    if (item.type !== NocodeStructureType.FORM) return result;
    const table = getMainSourceTableByUID(item.id, currentConnectionUID.value);
    if (!table) return result;
    usedTableUIDs.add(table.uid);
    result.push(createAggregateSourceTreeNodeByTable(table, currentConnectionUID.value, item.name || getTableLabel(table)));
    return result;
  }, [] as AggregateSourceTreeNode[]);

  const getFieldOptionsBySourceTable = (sourceTable?: AggregateSourceTable | null, onlyNumberField = false, includeCount = false): AggregateFieldOption[] => {
    if (!sourceTable?.tableUID) return [];
    const connectionUID = getAggregateSourceConnectionUID(sourceTable);
    const mainTable = getMainSourceTableByUID(sourceTable.tableUID, connectionUID);
    if (!mainTable) return [];

    const mainTableLabel = getSourceTableHeaderTitle(sourceTable);
    const options: AggregateFieldOption[] = [];
    if (includeCount) {
      options.push({
        value: buildFieldOptionValue('_count'),
        label: AGGREGATE_TABLE_TEXT.recordCount,
        fullLabel: `${mainTableLabel}.${AGGREGATE_TABLE_TEXT.recordCount}`,
        fieldUID: '_count',
        subFieldUID: null,
        field: null,
        conditionUID: buildConditionFieldUID('_count'),
      });
    }

    (mainTable.fields || []).forEach(field => {
      if (isSystemField(field)) return;
      const subTableUID = field.meta?.extra?.subTableUID?.[1];
      if (subTableUID) {
        if (sourceTable.subTableUID !== subTableUID) return;
        const subTable = getSourceTableSchemaByUID(subTableUID, connectionUID);
        if (!subTable) return;
        const subTableLabel = getFieldLabel(field) || getTableLabel(subTable);
        if (includeCount) {
          options.push({
            value: buildFieldOptionValue(null, '_count'),
            label: `${subTableLabel}.${AGGREGATE_TABLE_TEXT.recordCount}`,
            fullLabel: `${mainTableLabel}.${subTableLabel}.${AGGREGATE_TABLE_TEXT.recordCount}`,
            fieldUID: null,
            subFieldUID: '_count',
            field: null,
            conditionUID: buildConditionFieldUID(field.uid, '_count'),
          });
        }
        (subTable.fields || []).forEach(subField => {
          if (isSystemField(subField)) return;
          if (onlyNumberField && subField.type !== 'number') return;
          options.push({
            value: buildFieldOptionValue(null, subField.uid),
            label: `${subTableLabel}.${getFieldLabel(subField)}`,
            fullLabel: `${mainTableLabel}.${subTableLabel}.${getFieldLabel(subField)}`,
            fieldUID: null,
            subFieldUID: subField.uid,
            field: subField,
            conditionUID: buildConditionFieldUID(field.uid, subField.uid),
          });
        });
        return;
      }

      if (onlyNumberField && field.type !== 'number') return;
      options.push({
        value: buildFieldOptionValue(field.uid),
        label: getFieldLabel(field),
        fullLabel: `${mainTableLabel}.${getFieldLabel(field)}`,
        fieldUID: field.uid,
        subFieldUID: null,
        field,
        conditionUID: buildConditionFieldUID(field.uid),
      });
    });

    return options;
  };

  const getDimensionFieldOptionsBySourceUID = (sourceUID?: string, table = currentAggregateTable.value) => getFieldOptionsBySourceTable(getSourceTableByUID(sourceUID, table));
  const getMetricFieldOptionsBySourceUID = (sourceUID?: string, table = currentAggregateTable.value) => getFieldOptionsBySourceTable(getSourceTableByUID(sourceUID, table), true, false);
  const getFilterFieldOptionsBySourceUID = (sourceUID?: string, table = currentAggregateTable.value) => {
    return getFieldOptionsBySourceTable(getSourceTableByUID(sourceUID, table)).map(option => ({
      value: option.conditionUID || option.value,
      label: option.fullLabel,
      field: option.field,
    }));
  };
  const getVariableFilterFieldOptions = (sourceUID?: string, table = currentAggregateTable.value) => getFilterFieldOptionsBySourceUID(sourceUID, table);
  const getSourceFilterFieldOptions = (sourceUID?: string, table = currentAggregateTable.value) => getFilterFieldOptionsBySourceUID(sourceUID, table);

  const normalizeSourceTableFilterRule = (sourceTable: AggregateSourceTable, table = currentAggregateTable.value) => {
    if (!sourceTable.filterRule) return;
    const validUIDs = new Set(getSourceFilterFieldOptions(sourceTable.uid, table).map(item => item.value));
    const conditions = (sourceTable.filterRule.conditions || []).filter(condition => validUIDs.has(condition.uid));
    sourceTable.filterRule = conditions.length ? { logic: LogicalOperator.AND, conditions } : undefined;
  };

  const normalizeMetricVariableFilterRule = (metricVariable: AggregateMetricVariable, table = currentAggregateTable.value) => {
    if (!metricVariable.filterRule) return;
    const validUIDs = new Set(getVariableFilterFieldOptions(metricVariable.sourceUID, table).map(item => item.value));
    const conditions = (metricVariable.filterRule.conditions || []).filter(condition => validUIDs.has(condition.uid));
    applyMetricVariableFilterRule(metricVariable, conditions.length ? { logic: LogicalOperator.AND, conditions } : undefined);
  };

  const buildMetricFieldOptionUID = (sourceUID?: string, fieldUID?: FieldUID | '_count' | null, subFieldUID?: FieldUID | '_count' | null) => `${sourceUID || ''}::${fieldUID || ''}::${subFieldUID || ''}`;
  const buildMetricReferenceOptionUID = (metricUID?: string) => `metric::${metricUID || ''}`;
  const getMetricLabel = (metric?: AggregateMetric | null, index = 0) => metric?.name || `${AGGREGATE_TABLE_TEXT.metricSection}${index + 1}`;

  const syncAggregateTableStructure = (table?: AggregateTableDraft | null) => {
    if (!table) return;
    table.sourceTables = (table.sourceTables || []).map(item => ({
      uid: item.uid || createId('source'),
      connectionUID: item.connectionUID || currentConnectionUID.value || null,
      tableUID: item.tableUID ?? null,
      subTableUID: item.subTableUID ?? null,
      filterRule: parseFilterRule(item.filterRule),
    }));
    table.sourceTables.forEach(sourceTable => normalizeSourceTableFilterRule(sourceTable, table));

    const sourceUIDs = table.sourceTables.map(item => item.uid);
    const validUIDs = new Set(sourceUIDs);

    table.dimensions = (table.dimensions || []).map(dimension => ({
      ...dimension,
      items: sourceUIDs.map(sourceUID => {
        const currentItem = (dimension.items || []).find(item => item.sourceUID === sourceUID);
        return currentItem
          ? { uid: currentItem.uid || createId('dimension_item'), sourceUID, fieldUID: currentItem.fieldUID ?? null, subFieldUID: currentItem.subFieldUID ?? null }
          : createDefaultDimensionItem(sourceUID);
      }),
    }));

    table.dimensions.forEach(dimension => {
      dimension.items.forEach(item => {
        if (!validUIDs.has(item.sourceUID)) {
          item.sourceUID = '';
          applyFieldReferenceValue(item);
          return;
        }
        clearInvalidFieldReference(item, getDimensionFieldOptionsBySourceUID(item.sourceUID, table));
      });
      const selectedFieldOption = (dimension.items || []).reduce<AggregateFieldOption | undefined>((result, item) => {
        if (result) return result;
        return getDimensionFieldOptionsBySourceUID(item.sourceUID, table).find(field => field.value === getFieldReferenceValue(item));
      }, undefined);
      if (!['date', 'daterange'].includes(selectedFieldOption?.field?.meta?.subType || '')) {
        dimension.dateFormat = null;
      }
    });

    table.metrics.forEach(metric => {
      metric.mode = (metric.mode === 'singleField' ? 'singleField' : 'formula') as AggregateMetricMode;
      metric.variables = (metric.variables || []).map(item => createDefaultMetricVariable(item));
      metric.variables.forEach(metricVariable => {
        if (!validUIDs.has(metricVariable.sourceUID)) {
          metricVariable.sourceUID = '';
          metricVariable.sourceVariableUID = '';
          metricVariable.aggregate = 'SUM';
          applyFieldReferenceValue(metricVariable);
          applyMetricVariableFilterRule(metricVariable);
          return;
        }
        clearInvalidFieldReference(metricVariable, getMetricFieldOptionsBySourceUID(metricVariable.sourceUID, table));
        metricVariable.aggregate = 'SUM';
        metricVariable.sourceVariableUID = (metricVariable.fieldUID || metricVariable.subFieldUID)
          ? buildMetricFieldOptionUID(metricVariable.sourceUID, metricVariable.fieldUID, metricVariable.subFieldUID)
          : '';
        normalizeMetricVariableFilterRule(metricVariable, table);
      });

      metric.singleFieldConfig = createDefaultMetricVariable(metric.singleFieldConfig);
      const singleFieldConfig = metric.singleFieldConfig;
      if (!validUIDs.has(singleFieldConfig.sourceUID)) {
        singleFieldConfig.sourceUID = '';
        singleFieldConfig.sourceVariableUID = '';
        singleFieldConfig.aggregate = 'SUM';
        applyFieldReferenceValue(singleFieldConfig);
        applyMetricVariableFilterRule(singleFieldConfig);
        return;
      }
      clearInvalidFieldReference(singleFieldConfig, getMetricFieldOptionsBySourceUID(singleFieldConfig.sourceUID, table));
      singleFieldConfig.sourceVariableUID = (singleFieldConfig.fieldUID || singleFieldConfig.subFieldUID)
        ? buildMetricFieldOptionUID(singleFieldConfig.sourceUID, singleFieldConfig.fieldUID, singleFieldConfig.subFieldUID)
        : '';
      normalizeMetricVariableFilterRule(singleFieldConfig, table);
    });

    table.submitValidate = createDefaultSubmitValidateConfig(table.submitValidate);
    table.submitValidate.rules = (table.submitValidate.rules || []).map(item => createDefaultSubmitValidateRule(item));
  };

  const normalizeMetricDraft = (metric?: AggregateMetric | null): AggregateMetricDraft => ({
    uid: metric?.uid || createId('metric'),
    name: metric?.name || '',
    mode: metric?.mode === 'singleField' ? 'singleField' : 'formula',
    formula: metric?.formula || '',
    variables: (metric?.variables || []).map(item => createDefaultMetricVariable(item)),
    singleFieldConfig: createDefaultMetricVariable(metric?.singleFieldConfig),
    format: {
      isPercent: metric?.format?.isPercent ?? false,
      completeZero: metric?.format?.completeZero ?? false,
      decimalPlaces: metric?.format?.decimalPlaces ?? 0,
      thousandSeparator: metric?.format?.thousandSeparator || '',
      decimalSeparator: metric?.format?.decimalSeparator || '.',
    },
  });

  const normalizeAggregateTableDraft = (table?: AggregateTable | null): AggregateTableDraft => {
    const draft: AggregateTableDraft = {
      uid: table?.uid || createId('aggregate'),
      name: table?.name || '',
      description: table?.description || '',
      dimensionFilterEmpty: table?.dimensionFilterEmpty ?? false,
      sourceTables: (table?.sourceTables || []).map(item => ({
        uid: item.uid || createId('source'),
        connectionUID: item.connectionUID || currentConnectionUID.value || null,
        tableUID: item.tableUID ?? null,
        subTableUID: item.subTableUID ?? null,
        filterRule: parseFilterRule(item.filterRule),
      })),
      dimensions: (table?.dimensions || []).map(dimension => ({
        uid: dimension.uid || createId('dimension'),
        name: dimension.name || '',
        dateFormat: dimension.dateFormat || null,
        items: (dimension.items || []).map(item => ({
          uid: item.uid || createId('dimension_item'),
          sourceUID: item.sourceUID || '',
          fieldUID: item.fieldUID ?? null,
          subFieldUID: item.subFieldUID ?? null,
        })),
      })),
      metrics: (table?.metrics || []).map(metric => normalizeMetricDraft(metric)),
      submitValidate: createDefaultSubmitValidateConfig(table?.submitValidate),
    };
    if (!draft.sourceTables.length) draft.sourceTables = [createDefaultSourceTable()];
    syncAggregateTableStructure(draft);
    return draft;
  };

  const parseFilterRule = (filterRule?: FilterRule | null) => {
    const conditions = deepClone(filterRule?.conditions || []).filter(condition => condition.uid);
    if (!conditions.length) return undefined;
    return { logic: LogicalOperator.AND, conditions } as FilterRule;
  };

  const buildAggregateTablesForSave = (tables = draftAggregateTables.value): AggregateTable[] => {
    return deepClone(tables).map(table => {
      syncAggregateTableStructure(table);
      const sourceTablesForSave = table.sourceTables.filter(item => item.tableUID).map(item => ({
        uid: item.uid,
        connectionUID: item.connectionUID || currentConnectionUID.value || null,
        tableUID: item.tableUID ?? null,
        subTableUID: item.subTableUID ?? null,
        filterRule: parseFilterRule(item.filterRule),
      }));
      const sourceUIDSet = new Set(sourceTablesForSave.map(item => item.uid));
      return {
        uid: table.uid,
        name: table.name || '',
        description: table.description || '',
        dimensionFilterEmpty: Boolean(table.dimensionFilterEmpty),
        sourceTables: sourceTablesForSave,
        dimensions: table.dimensions.map(dimension => ({
          uid: dimension.uid,
          name: dimension.name || '',
          dateFormat: dimension.dateFormat || null,
          items: (dimension.items || [])
            .filter(item => sourceUIDSet.has(item.sourceUID))
            .map(item => ({
              uid: item.uid,
              sourceUID: item.sourceUID,
              fieldUID: item.fieldUID ?? null,
              subFieldUID: item.subFieldUID ?? null,
            })),
        })),
        metrics: table.metrics.map(metric => ({
          uid: metric.uid,
          name: metric.name || '',
          mode: metric.mode === 'singleField' ? 'singleField' : 'formula',
          formula: metric.formula || '',
          variables: (metric.variables || []).map(metricVariable => ({
            uid: metricVariable.uid,
            sourceVariableUID: metricVariable.sourceVariableUID || '',
            name: metricVariable.name || '',
            sourceUID: metricVariable.sourceUID || '',
            aggregate: metricVariable.aggregate || 'SUM',
            fieldUID: metricVariable.fieldUID ?? null,
            subFieldUID: metricVariable.subFieldUID ?? null,
            filterRule: parseFilterRule(metricVariable.filterRule),
          })),
          singleFieldConfig: metric.singleFieldConfig ? {
            uid: metric.singleFieldConfig.uid,
            sourceVariableUID: metric.singleFieldConfig.sourceVariableUID || '',
            name: metric.singleFieldConfig.name || '',
            sourceUID: metric.singleFieldConfig.sourceUID || '',
            aggregate: metric.singleFieldConfig.aggregate || 'SUM',
            fieldUID: metric.singleFieldConfig.fieldUID ?? null,
            subFieldUID: metric.singleFieldConfig.subFieldUID ?? null,
            filterRule: parseFilterRule(metric.singleFieldConfig.filterRule),
          } : undefined,
          format: {
            isPercent: metric.format?.isPercent ?? false,
            completeZero: metric.format?.completeZero ?? false,
            decimalPlaces: metric.format?.decimalPlaces ?? 0,
            thousandSeparator: metric.format?.thousandSeparator || '',
            decimalSeparator: metric.format?.decimalSeparator || '.',
          },
        })),
        submitValidate: {
          enabled: Boolean(table.submitValidate?.enabled),
          rules: (table.submitValidate?.rules || []).map(rule => ({
            uid: rule.uid,
            errorText: rule.errorText || '',
            formula: rule.formula || (
              rule.conditions?.length === 1 && rule.conditions[0]?.type === FormConditionValueType.FORMULA
                ? rule.conditions[0]?.formula || ''
                : ''
            ),
            conditions: (rule.conditions || []).map(condition => ({
              uid: condition.uid || '',
              func: condition.func || RuleFunc.EQUAL,
              value: deepClone(condition.value ?? null),
              formula: condition.formula || '',
              fixedValue: deepClone(condition.fixedValue ?? null),
              type: condition.type || (condition.formula ? FormConditionValueType.FORMULA : FormConditionValueType.FORM),
              tFormat: deepClone(condition.tFormat ?? null),
            })),
          })),
        },
      };
    });
  };

  const resetDraftAggregateTables = (aggregateTables?: AggregateTable[], syncChanged = enabled.value) => {
    const nextTables = (aggregateTables || []).map(item => normalizeAggregateTableDraft(item));
    draftAggregateTables.value = nextTables;
    const currentTable = nextTables.find(item => item.uid === activeTableUid.value);
    if (currentTable && editorVisible.value) {
      editingAggregateTable.value = normalizeAggregateTableDraft(deepClone(currentTable) as AggregateTable);
    } else {
      activeTableUid.value = '';
      editingAggregateTable.value = null;
    }
    editingMetricUid.value = '';
    savedSnapshot.value = JSON.stringify(buildAggregateTablesForSave(nextTables));
    if (syncChanged) isChanged.value = false;
    if (!nextTables.length) editorVisible.value = false;
    if (enabled.value && editorVisible.value && editingAggregateTable.value) {
      void loadPreviewRows();
    } else {
      previewRows.value = [];
      previewLoading.value = false;
    }
    syncAggregateTableCreatedAtMap(nextTables);
  };
  const resetDraftFromNocode = () => {
    resetDraftAggregateTables(nocode.value?.body?.formData?.aggregateTables || [], false);
  };

  const sourceTableBaseOptions = computed(() => mainSourceTables.value.map(table => ({
    value: table.uid,
    label: getTableLabel(table),
  })));
  const aggregateSourceTreeData = computed<AggregateSourceTreeNode[]>(() => {
    const usedTableUIDs = new Set<string>();
    const currentConnectionNodes = buildAggregateSourceTreeNodesByStructure(nocode.value?.body?.structure || [], usedTableUIDs);
    const currentRestNodes = mainSourceTables.value
      .filter(table => !usedTableUIDs.has(table.uid))
      .map(table => createAggregateSourceTreeNodeByTable(table, currentConnectionUID.value));
    const otherConnectionNodes = aggregateSelectableConnections.value
      .filter(connection => connection.uid !== currentConnectionUID.value)
      .map(connection => ({
        key: `group:connection:${connection.uid}`,
        label: connection.name || connection.uid,
        type: 'group' as const,
        children: (connection.tables || [])
          .filter(table => !table?.meta?.extra?.primaryTable)
          .map(table => createAggregateSourceTreeNodeByTable(table, connection.uid)),
      }))
      .filter(item => item.children.length);
    return [...currentConnectionNodes, ...currentRestNodes, ...otherConnectionNodes];
  });
  const sourceTableSummaryList = computed(() => {
    const sourceTableMap = (currentAggregateTable.value?.sourceTables || []).reduce<Record<string, AggregateSourceTable>>((result, item) => {
      if (!item.tableUID) return result;
      const sourceKey = `${getAggregateSourceConnectionUID(item)}::${item.tableUID}`;
      const currentItem = result[sourceKey];
      if (!currentItem || item.subTableUID) result[sourceKey] = item;
      return result;
    }, {});
    return Object.values(sourceTableMap).map(item => ({
      uid: item.uid,
      title: getSourceTableSelectionLabel(item),
      label: item.filterRule?.conditions?.length ? i18next.t('aggregateTable.configuredFilterCount', {
        count: item.filterRule.conditions.length,
      }) : '',
      hasFilter: Boolean(item.filterRule?.conditions?.length),
    }));
  });
  const dimensionSummaryList = computed(() => (currentAggregateTable.value?.dimensions || []).map(item => ({
    uid: item.uid,
    name: item.name || '',
    label: (item.items || []).map(dimensionItem => {
      const option = getDimensionFieldOptionsBySourceUID(dimensionItem.sourceUID).find(field => field.value === getFieldReferenceValue(dimensionItem));
      return option?.label || '';
    }).filter(Boolean).join(' / ') || AGGREGATE_TABLE_TEXT.unselectedField,
  })));
  const sourceTableDialogSubTableOptionsMap = computed(() => sourceTableBaseOptions.value.reduce<Record<string, { value: TableUID, label: string }[]>>((result, item) => {
    result[item.value] = getSubTableOptionsByTableUID(item.value);
    return result;
  }, {}));
  const dimensionSourceHeaders = computed(() => (currentAggregateTable.value?.sourceTables || []).map(item => ({
    uid: item.uid,
    title: getSourceTableHeaderTitle(item),
    subLabel: getSourceTableSubLabel(item),
  })));
  const dimensionFieldOptionsMap = computed(() => (currentAggregateTable.value?.sourceTables || []).reduce<Record<string, AggregateFieldOption[]>>((result, item) => {
    result[item.uid] = getDimensionFieldOptionsBySourceUID(item.uid);
    return result;
  }, {}));
  const sourceFilterFieldOptionsMap = computed(() => (currentAggregateTable.value?.sourceTables || []).reduce<Record<string, {
    value: string,
    label: string,
    field?: Field | null,
  }[]>>((result, item) => {
    result[item.uid] = getSourceFilterFieldOptions(item.uid);
    return result;
  }, {}));
  const currentEditingMetricIndex = computed(() => {
    const metrics = currentAggregateTable.value?.metrics || [];
    return metrics.findIndex(item => item.uid === editingMetricUid.value);
  });
  const currentMetricFieldOptions = computed<MetricVariableOption[]>(() => {
    const sourceFieldOptions = (currentAggregateTable.value?.sourceTables || [])
      .filter(item => !!item.tableUID)
      .flatMap(sourceTable => getMetricFieldOptionsBySourceUID(sourceTable.uid).map(option => ({
        uid: buildMetricFieldOptionUID(sourceTable.uid, option.fieldUID, option.subFieldUID),
        label: option.fullLabel,
        sourceUID: sourceTable.uid,
        sourceLabel: getSourceTableSelectionLabel(sourceTable),
        optionType: 'sourceField' as const,
        aggregate: 'SUM' as AggregateVariableAggregate,
        fieldUID: option.fieldUID ?? null,
        subFieldUID: option.subFieldUID ?? null,
        filterFieldOptions: getVariableFilterFieldOptions(sourceTable.uid),
      })));

    if (currentEditingMetricIndex.value <= 0) return sourceFieldOptions;

    const metricOptions = (currentAggregateTable.value?.metrics || [])
      .slice(0, currentEditingMetricIndex.value)
      .map((metric, index) => ({
        uid: buildMetricReferenceOptionUID(metric.uid),
        label: getMetricLabel(metric, index),
        sourceUID: AGGREGATE_METRIC_SOURCE_UID,
        sourceLabel: AGGREGATE_TABLE_TEXT.metricSection,
        optionType: 'metric' as const,
        metricUID: metric.uid,
        aggregate: 'SUM' as AggregateVariableAggregate,
        fieldUID: null,
        subFieldUID: null,
        filterFieldOptions: [],
      }));

    return [...sourceFieldOptions, ...metricOptions];
  });
  const previewDimensions = computed(() => (currentAggregateTable.value?.dimensions || []).map((dimension, index) => {
    const summary = dimensionSummaryList.value.find(item => item.uid === dimension.uid)?.label || '';
    return {
      uid: dimension.uid,
      label: dimension.name || summary || `${AGGREGATE_TABLE_TEXT.dimensionItemPrefix} ${index + 1}`,
    };
  }));
  const previewMetrics = computed(() => (currentAggregateTable.value?.metrics || []).map((metric, index) => ({
    uid: metric.uid,
    label: metric.name || `${AGGREGATE_TABLE_TEXT.metricSection} ${index + 1}`,
    format: {
      isPercent: metric.format?.isPercent ?? false,
      completeZero: metric.format?.completeZero ?? false,
      decimalPlaces: metric.format?.decimalPlaces ?? 0,
      thousandSeparator: metric.format?.thousandSeparator || '',
      decimalSeparator: metric.format?.decimalSeparator || '.',
    },
  })));
  const buildMetricVariablePreviewSignature = (variable?: AggregateMetricVariable | null) => {
    if (!variable) return null;
    return {
      uid: variable.uid,
      sourceUID: variable.sourceUID || '',
      aggregate: variable.aggregate || 'SUM',
      fieldUID: variable.fieldUID ?? null,
      subFieldUID: variable.subFieldUID ?? null,
      filterRule: variable.filterRule || null,
    };
  };
  const buildAggregatePreviewSignature = (table?: AggregateTableDraft | null) => {
    if (!table) return null;
    return {
      uid: table.uid,
      dimensionFilterEmpty: Boolean(table.dimensionFilterEmpty),
      sourceTables: table.sourceTables.map(item => ({
        uid: item.uid,
        connectionUID: item.connectionUID || null,
        tableUID: item.tableUID || null,
        subTableUID: item.subTableUID || null,
        filterRule: item.filterRule || null,
      })),
      dimensions: table.dimensions.map(dimension => ({
        uid: dimension.uid,
        dateFormat: dimension.dateFormat || null,
        items: dimension.items.map(item => ({
          sourceUID: item.sourceUID || '',
          fieldUID: item.fieldUID ?? null,
          subFieldUID: item.subFieldUID ?? null,
        })),
      })),
      metrics: table.metrics.map(metric => ({
        uid: metric.uid,
        mode: metric.mode,
        formula: metric.mode === 'formula' ? metric.formula || '' : '',
        variables: metric.mode === 'formula'
          ? metric.variables.map(variable => buildMetricVariablePreviewSignature(variable))
          : [],
        singleFieldConfig: metric.mode === 'singleField'
          ? buildMetricVariablePreviewSignature(metric.singleFieldConfig)
          : null,
      })),
    };
  };
  const previewSignature = computed(() => JSON.stringify({
    enabled: enabled.value,
    editorVisible: editorVisible.value,
    aggregateTable: buildAggregatePreviewSignature(currentAggregateTable.value),
    sourceTables: sourceTables.value.map(table => table.uid),
    otherDataSources: aggregateSchemaConnections.value.map(connection => ({
      uid: connection.uid,
      tables: (connection.tables || []).map(table => table.uid),
    })),
    currentSourceUID: nocode.value?.body?.formData?.uid,
  }));
  const buildAggregateTablesWithEditingDraft = () => {
    const aggregateTableDrafts = deepClone(draftAggregateTables.value);
    const editingTable = currentAggregateTable.value;
    if (!editingTable) return aggregateTableDrafts;
    const index = aggregateTableDrafts.findIndex(item => item.uid === editingTable.uid);
    if (index === -1) {
      aggregateTableDrafts.push(deepClone(editingTable));
    } else {
      aggregateTableDrafts.splice(index, 1, deepClone(editingTable));
    }
    return aggregateTableDrafts;
  };
  const currentSnapshot = computed(() => JSON.stringify(buildAggregateTablesForSave(buildAggregateTablesWithEditingDraft())));
  const currentEditingSnapshot = computed(() => currentAggregateTable.value
    ? JSON.stringify(buildAggregateTablesForSave([currentAggregateTable.value])[0])
    : '');
  const savedEditingSnapshot = computed(() => {
    const savedTable = draftAggregateTables.value.find(item => item.uid === activeTableUid.value);
    return savedTable ? JSON.stringify(buildAggregateTablesForSave([savedTable])[0]) : '';
  });
  const isCurrentAggregateTableChanged = computed(() => currentEditingSnapshot.value !== savedEditingSnapshot.value);

  const getAggregateTableSourceSummary = (table?: AggregateTableDraft | null) => {
    const labels = (table?.sourceTables || [])
      .filter(item => !!item.tableUID)
      .map(item => getSourceTableSelectionLabel(item))
      .filter(Boolean);
    return labels.length ? labels.join('\uFF0C') : AGGREGATE_TABLE_TEXT.unconfiguredSource;
  };
  const getAggregateTableStatusClass = (table?: AggregateTableDraft | null) => {
    return isAggregateTableAvailable(table) ? 'aggregate-status--normal' : 'aggregate-status--warning';
  };
  const getAggregateTableStatusText = (table?: AggregateTableDraft | null) => {
    return getAggregateTableStatusClass(table) === 'aggregate-status--normal' ? AGGREGATE_TABLE_TEXT.normalStatus : AGGREGATE_TABLE_TEXT.invalidStatus;
  };
  const aggregateTableList = computed<AggregateTableListItem[]>(() => draftAggregateTables.value.map(item => ({
    uid: item.uid,
    name: item.name || AGGREGATE_TABLE_TEXT.unnamedAggregateTable,
    sourceText: getAggregateTableSourceSummary(item),
    statusText: getAggregateTableStatusText(item),
    statusClass: getAggregateTableStatusClass(item),
    createdAt: aggregateTableCreatedAtMap.value[item.uid] || AGGREGATE_TABLE_TEXT.notAvailable,
    raw: item,
  })));

  const syncMetricFormulaAlias = (formula: string, metric?: AggregateMetricDraft | null) => {
    if (!formula || !currentAggregateTable.value) return formula || '';
    const currentMetric = metric || currentEditingMetric.value;
    return replaceBracketId(formula, (ids, aliases) => {
      const [tableUID, metricUID, variableUID] = ids;
      if (tableUID !== currentAggregateTable.value?.uid) return `${ids.join('.')},${aliases.join('.') || ids.join('.')}`;
      const metricVariable = currentMetric?.variables?.find(item => item.uid === (metricUID ? variableUID : ids[1]));
      if (!metricVariable) return `${ids.join('.')},${AGGREGATE_TABLE_TEXT.deleted}`;
      return `${currentAggregateTable.value.uid}.${currentMetric?.uid || metricUID}.${metricVariable.uid},${metricVariable.name || AGGREGATE_TABLE_TEXT.unconfiguredSource}`;
    });
  };
  const getMetricFormulaSummary = (metric: AggregateMetricDraft) => metric.formula ? syncMetricFormulaAlias(metric.formula, metric) : AGGREGATE_TABLE_TEXT.formulaUnset;
  const getMetricFormatSummary = (metric: AggregateMetricDraft) => {
    const parts = [`${metric.format.decimalPlaces || 0} ${AGGREGATE_TABLE_TEXT.decimalPlacesSuffix}`];
    if (metric.format.isPercent) parts.unshift(AGGREGATE_TABLE_TEXT.percent);
    if (metric.format.completeZero) parts.push(AGGREGATE_TABLE_TEXT.completeZero);
    if (metric.format.thousandSeparator) parts.push(AGGREGATE_TABLE_TEXT.thousandSeparator);
    return parts.join(' / ');
  };
  const getSingleFieldMetricSummary = (metric: AggregateMetricDraft) => {
    const config = metric.singleFieldConfig;
    if (!config) return AGGREGATE_TABLE_TEXT.singleFieldUnset;
    const option = getMetricFieldOptionsBySourceUID(config.sourceUID, currentAggregateTable.value).find(field => field.value === getFieldReferenceValue(config));
    const fieldLabel = option?.fullLabel || config.name || AGGREGATE_TABLE_TEXT.unselectedField;
    return `${config.aggregate || 'SUM'}(${fieldLabel})`;
  };
  const syncSubmitValidateFormulaAlias = (formula: string, table = currentAggregateTable.value) => {
    if (!formula || !table) return formula || '';
    return replaceBracketId(formula, (ids, aliases) => {
      if (ids[0] !== table.uid) return `${ids.join('.')},${aliases.join('.') || ids.join('.')}`;
      const metric = (table.metrics || []).find(item => item.uid === ids[1]);
      if (!metric) return `${table.uid}.${ids[1] || ''},${AGGREGATE_TABLE_TEXT.deleted}`;
      return `${table.uid}.${metric.uid},${metric.name || AGGREGATE_TABLE_TEXT.unnamedMetric}`;
    });
  };
  const getSubmitValidateRuleSummary = (rule: AggregateSubmitValidateRule) => rule.formula ? syncSubmitValidateFormulaAlias(rule.formula) : AGGREGATE_TABLE_TEXT.formulaUnset;
  const getMetricSummary = (metric: AggregateMetricDraft) => {
    if (metric.mode === 'singleField') return getSingleFieldMetricSummary(metric);
    return getMetricFormulaSummary(metric);
  };

  const closeEditorDialogs = () => {
    metricFormulaDialogVisible.value = false;
    metricSingleFieldDialogVisible.value = false;
    submitValidateDialogVisible.value = false;
    editingMetricUid.value = '';
  };
  const openAggregateTable = (uid: string) => {
    const table = draftAggregateTables.value.find(item => item.uid === uid);
    if (!table) return;
    activeTableUid.value = uid;
    editingAggregateTable.value = normalizeAggregateTableDraft(deepClone(table) as AggregateTable);
  };
  const openNewAggregateTable = (table: AggregateTableDraft) => {
    activeTableUid.value = table.uid;
    editingAggregateTable.value = table;
  };
  const discardCurrentAggregateTableDraft = () => {
    activeTableUid.value = '';
    editingAggregateTable.value = null;
    previewRows.value = [];
    closeEditorDialogs();
  };

  const loadPreviewRows = async () => {
    if (!enabled.value || !editorVisible.value) {
      previewRows.value = [];
      previewLoading.value = false;
      return;
    }

    const aggregateTable = currentAggregateTable.value ? buildAggregateTablesForSave([currentAggregateTable.value])[0] : undefined;
    if (!aggregateTable) {
      previewRows.value = [];
      previewLoading.value = false;
      return;
    }

    const sourceTableUIDs = Array.from(new Set((aggregateTable.sourceTables || [])
      .map(item => item.tableUID)
      .filter(Boolean)));
    if (!sourceTableUIDs.length) {
      previewRows.value = [];
      previewLoading.value = false;
      return;
    }

    previewLoading.value = true;
    const requestId = Date.now();
    previewRequestId.value = requestId;
    const previewOrderBy = previewDimensions.value.reduce<Record<string, SortType>>((result, item) => {
      result[item.uid] = SortType.ASC;
      return result;
    }, {});
    const previewBucket = await formDataApi.previewAggregateTable({
      nocodeId,
      aggregateTable,
      options: {
        orderBy: previewOrderBy,
        limit: 100,
      },
    });

    if (previewRequestId.value !== requestId) return;
    previewRows.value = previewBucket?.rows || [];
    previewLoading.value = false;
  };

  const handleAddAggregateTable = () => {
    const nextTable = createDefaultAggregateTable(getFirstAvailableAggregateTableName(
      draftAggregateTables.value.map(item => item.name),
      index => i18next.t('aggregateTable.defaultName', { index }),
    ));
    setAggregateTableCreatedAt(nextTable.uid);
    openNewAggregateTable(nextTable);
  };
  const handleDuplicateAggregateTable = (table: AggregateTableDraft) => {
    const nextTable = normalizeAggregateTableDraft(deepClone(table) as AggregateTable);
    nextTable.uid = createId('aggregate');
    nextTable.name = table.name ? `${table.name}${AGGREGATE_TABLE_TEXT.duplicateSuffix}` : AGGREGATE_TABLE_TEXT.copiedAggregateTable;
    setAggregateTableCreatedAt(nextTable.uid);
    openNewAggregateTable(nextTable);
  };
  const handleRemoveAggregateTable = (uid: string) => {
    draftAggregateTables.value = draftAggregateTables.value.filter(item => item.uid !== uid);
    syncAggregateTableCreatedAtMap();
    if (!draftAggregateTables.value.length) {
      editorVisible.value = false;
    }
  };
  const handleSourceTableDialogUpdate = (value: AggregateSourceTable[]) => {
    if (!currentAggregateTable.value) return;
    currentAggregateTable.value.sourceTables = deepClone(value);
    if (!currentAggregateTable.value.sourceTables.length) currentAggregateTable.value.sourceTables.push(createDefaultSourceTable());
    syncAggregateTableStructure(currentAggregateTable.value);
  };
  const handleSourceTableFilterUpdate = (uid: string, filterRule?: FilterRule) => {
    if (!currentAggregateTable.value) return;
    const nextSourceTables = deepClone(currentAggregateTable.value.sourceTables || []);
    const index = nextSourceTables.findIndex(item => item.uid === uid);
    if (index === -1) return;
    nextSourceTables[index].filterRule = parseFilterRule(filterRule);
    handleSourceTableDialogUpdate(nextSourceTables);
  };
  const handleDimensionDialogUpdate = (value: AggregateDimension[]) => {
    if (!currentAggregateTable.value) return;
    currentAggregateTable.value.dimensions = value.map(item => ({
      uid: item.uid || createId('dimension'),
      name: item.name || '',
      dateFormat: item.dateFormat || null,
      items: (item.items || []).map(dimensionItem => ({
        uid: dimensionItem.uid || createId('dimension_item'),
        sourceUID: dimensionItem.sourceUID || '',
        fieldUID: dimensionItem.fieldUID ?? null,
        subFieldUID: dimensionItem.subFieldUID ?? null,
      })),
    }));
    syncAggregateTableStructure(currentAggregateTable.value);
  };
  const handleDimensionFilterEmptyUpdate = (value: boolean) => {
    if (!currentAggregateTable.value) return;
    currentAggregateTable.value.dimensionFilterEmpty = Boolean(value);
  };
  const handleAddMetric = (mode: AggregateMetricMode = 'formula') => {
    if (!currentAggregateTable.value) return;
    const metric = createDefaultMetric();
    metric.mode = mode;
    currentAggregateTable.value.metrics.push(metric);
    openMetricDialog(metric);
  };
  const handleRemoveMetric = (uid: string) => {
    if (!currentAggregateTable.value) return;
    currentAggregateTable.value.metrics = currentAggregateTable.value.metrics.filter(item => item.uid !== uid);
    if (editingMetricUid.value === uid) {
      metricFormulaDialogVisible.value = false;
      metricSingleFieldDialogVisible.value = false;
    }
  };
  const openMetricDialog = (metric: AggregateMetricDraft) => {
    editingMetricUid.value = metric.uid;
    metricSingleFieldDialogVisible.value = metric.mode === 'singleField';
    metricFormulaDialogVisible.value = metric.mode !== 'singleField';
  };
  const handleMetricDialogUpdate = (value: AggregateMetric) => {
    if (!currentAggregateTable.value) return;
    const index = currentAggregateTable.value.metrics.findIndex(item => item.uid === value.uid);
    if (index !== -1) currentAggregateTable.value.metrics.splice(index, 1, normalizeMetricDraft(value));
    syncAggregateTableStructure(currentAggregateTable.value);
  };
  const handleAddSubmitValidateRule = () => {
    if (!currentAggregateTable.value) return;
    submitValidateDialogVisible.value = true;
  };
  const openSubmitValidateDialog = () => {
    submitValidateDialogVisible.value = true;
  };
  const handleRemoveSubmitValidateRule = (uid: string) => {
    if (!currentAggregateTable.value) return;
    currentAggregateTable.value.submitValidate.rules = currentAggregateTable.value.submitValidate.rules.filter(item => item.uid !== uid);
    if (!currentAggregateTable.value.submitValidate.rules.length) currentAggregateTable.value.submitValidate.enabled = false;
  };
  const handleSubmitValidateDialogUpdate = (value: AggregateSubmitValidateConfig) => {
    if (!currentAggregateTable.value) return;
    currentAggregateTable.value.submitValidate = createDefaultSubmitValidateConfig(value);
    currentAggregateTable.value.submitValidate.enabled = Boolean(currentAggregateTable.value.submitValidate.rules.length);
  };

  const handleSave = async () => {
    if (!nocode.value?.body) return false;
    if (!checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return false;
    const aggregateTableDrafts = buildAggregateTablesWithEditingDraft();
    const invalidTable = aggregateTableDrafts.find(item => !normalizeAggregateTableName(item.name));
    if (invalidTable) {
      if (invalidTable.uid !== currentAggregateTable.value?.uid) openAggregateTable(invalidTable.uid);
      editorVisible.value = true;
      ElMessage.warning(AGGREGATE_TABLE_TEXT.namePlaceholder);
      return false;
    }
    aggregateTableDrafts.forEach(item => {
      item.name = normalizeAggregateTableName(item.name);
    });
    const aggregateTables = buildAggregateTablesForSave(aggregateTableDrafts);
    const res = await axios.post('/project/save-nocode-aggregate-tables', {
      nocodeId,
      aggregateTables,
    }, {
      headers: { 'x-sign': nocode.value.body.sign },
    }).then(({ headers }) => {
      const mainSign = Array.isArray(headers?.['x-sign']) ? headers['x-sign'][0] : headers?.['x-sign'];
      if (mainSign) nocode.value.body.sign = mainSign;
      return true;
    }).catch(error => {
      if (handleNocodeSyncConflictError(error, nocodeSignIsLatest)) return false;
      ElMessage.error(error?.response?.data?.message || error.message);
      return false;
    });
    if (!res) return false;
    draftAggregateTables.value = aggregateTables.map(item => normalizeAggregateTableDraft(item));
    const savedTable = draftAggregateTables.value.find(item => item.uid === activeTableUid.value);
    editingAggregateTable.value = savedTable
      ? normalizeAggregateTableDraft(deepClone(savedTable) as AggregateTable)
      : null;
    nocode.value.body.formData = {
      ...(nocode.value.body.formData || {}),
      aggregateTables,
    } as Nocode['body']['formData'];
    savedSnapshot.value = JSON.stringify(aggregateTables);
    isChanged.value = false;
    await onUpdateNocode();
    ElMessage.success(AGGREGATE_TABLE_TEXT.saveSuccess);
    return true;
  };

  watch(() => nocode.value?.body?.formData?.aggregateTables, value => {
    resetDraftAggregateTables(value || []);
  }, { deep: true, immediate: true });
  watch(aggregateSchemaConnections, () => {
    draftAggregateTables.value.forEach(item => syncAggregateTableStructure(item));
    syncAggregateTableStructure(editingAggregateTable.value);
  }, { deep: true });
  watch(previewSignature, () => {
    void loadPreviewRows();
  }, { immediate: true });
  watch([currentSnapshot, enabled], ([value, isEnabled]) => {
    if (!isEnabled) return;
    isChanged.value = value !== savedSnapshot.value;
  }, { immediate: true });
  watch(currentAggregateTable, value => {
    if (value) return;
    closeEditorDialogs();
    previewRows.value = [];
    previewLoading.value = false;
    if (editorVisible.value) editorVisible.value = false;
  });
  watch(editorVisible, value => {
    if (value) {
      if (!currentAggregateTable.value && draftAggregateTables.value.length) openAggregateTable(draftAggregateTables.value[0].uid);
      return;
    }
    discardCurrentAggregateTableDraft();
  });

  return {
    draftAggregateTables,
    activeTableUid,
    currentAggregateTable,
    currentEditingMetric,
    sourceTableDialogVisible,
    dimensionDialogVisible,
    metricFormulaDialogVisible,
    metricSingleFieldDialogVisible,
    submitValidateDialogVisible,
    previewRows,
    previewLoading,
    aggregateTableList,
    aggregateSourceTreeData,
    sourceTableBaseOptions,
    sourceTableDialogSubTableOptionsMap,
    sourceTableSummaryList,
    dimensionSummaryList,
    dimensionSourceHeaders,
    dimensionFieldOptionsMap,
    sourceFilterFieldOptionsMap,
    currentMetricFieldOptions,
    previewDimensions,
    previewMetrics,
    isCurrentAggregateTableChanged,
    openAggregateTable,
    resetDraftFromNocode,
    discardCurrentAggregateTableDraft,
    handleAddAggregateTable,
    handleDuplicateAggregateTable,
    handleRemoveAggregateTable,
    handleSourceTableDialogUpdate,
    handleSourceTableFilterUpdate,
    handleDimensionDialogUpdate,
    handleDimensionFilterEmptyUpdate,
    handleAddMetric,
    handleRemoveMetric,
    openMetricDialog,
    handleMetricDialogUpdate,
    handleAddSubmitValidateRule,
    openSubmitValidateDialog,
    handleRemoveSubmitValidateRule,
    handleSubmitValidateDialogUpdate,
    handleSave,
    getMetricSummary,
    getMetricFormatSummary,
    getSubmitValidateRuleSummary,
  };
};

export type AggregateTableSettingContext = ReturnType<typeof createAggregateTableSettingContext>;

export const useAggregateTableSettingContext = () => {
  const context = inject(aggregateTableSettingContextKey, null);
  if (!context) throw new Error('aggregateTableSettingContext not provided');
  return context;
};
