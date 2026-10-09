import { unique } from "@common/utils/unique";
import { FieldUID, OptionTableUID } from "@common/types/project";
import { FormConditionValueType, RuleFunc, FormCondition, FormWidgetType } from "@common/types/nocode";
import { isSystemField, getUUIDSystemField, SystemField, transformCondition } from "@common/utils/connection";
import { DefinedOptions, LogicalOperator, GetOptionOptions, SelectIdOfForm, WidgetStatus, FormVisibleRule, VisibleType, FormLinkageRule } from "@renderer/b2/types";
import { FormElement, AbstractSubForm, SubFormRow, AbstractForm } from "@renderer/b2/controllers/form";
import { WidgetSoul, OptionValue } from "@common/types/project";
import { Widget } from "@renderer/b2/controllers/widget";
import { effectScope, EffectScope, nextTick, reactive, Ref, ref, watch, defineAsyncComponent } from "vue";
import { ElMessage } from "element-plus";
import resource from "./locales";
import { equals, isEmpty } from "@common/utils/object";
import { RelatedData } from "../_common/table";
import SubFormDefaultValueDialog from "./SubFormDefaultValueDialog.vue";
import DataFillRulesDialog from "./DataFillRulesDialog.vue";
import AggregationRulesDialog from "./AggregationRulesDialog.vue";
import { AggregationRule, AggregationType, DataFillRule } from "./type";
import { meetRuleFuncs } from "../form/types";
import { FormMode } from "../_common/type";
import { cloneDeep as deepClone, filter } from "lodash";
import { Field, QueryOptions, WhereCondition } from "@common/types/project";
import SubVisibilityRuleList from "./components/visibility/SubVisibilityRuleList.vue";
import dayjs from "dayjs";
import type { SerialNumber } from "../serialNumber/serialNumber";
import { isEmptySerialNumberValue } from "../serialNumber/utils";
import axios from "axios";
import { markSubFormStructureChanged } from "../form/formula-change-triggers";
import { fetchDistinct } from "../_common/distinct";
import { attachMockWidgetRequiredBridge } from "./mockWidgetRequiredBridge";
import { attachMockWidgetReadonlyBridge } from "./mockWidgetReadonlyBridge";
import i18next from "@renderer/widgets/i18next";
import { loadWidget } from "@renderer/b2/utils/widget.util";
import { calculateAggregation } from "@renderer/utils/autoCompute";
import { getDefaultQuickComputeRuntimeDataFilter } from "../_common/defaultQuickCompute";
import { resolveDataSourceSelectionMeta } from "../_common/page-permission";

export const UUID = "__uuid__";
export const DEFERRED_SELECT_DATA = "__deferredSelectData__";
export const SUB_FORM_ROW_LIMIT = 200;
const CONDITION_WIDGET_SEPARATOR = ".";

type SubFormFillTrace = { batch: true };

type RelatedTableInfo = Record<FieldUID, {
  relatedTableFields: Field[],
  relatedTableUID: OptionTableUID,
}>
type _TableData = {
  rows: object[],
  total: number,
};

// FIXME 后续改成用 allFormFieldTypes 中的内容
const optionalWidgets = [
  "widget.form.textInput",
  "widget.form.textarea",
  "widget.form.numberInput",
  "widget.form.amountInput",
  "widget.form.datePicker",
  "widget.form.dateRangePicker",
  "widget.form.timePicker",
  "widget.form.radioGroup",
  "widget.form.checkboxGroup",
  "widget.form.treeSelect",
  "widget.form.treeMultipleSelect",
  "widget.form.memberSelect",
  "widget.form.departmentSelect",
  "widget.form.phoneInput",
  "widget.form.address",
  "widget.form.rate",
  "widget.form.position",
  "widget.form.tagInput",
  "widget.form.image-uploader",
  "widget.form.file-uploader",
  "widget.form.switch",
  "widget.form.hyperlink",
  "widget.form.autoCompute",
  "widget.form.serialNumber",
  "widget.form.selectData",
  "widget.form.relatedData",
];

const deduplicationUnsupportedWidgetTypes = new Set([
  "widget.form.image-uploader",
  "widget.form.file-uploader",
]);

const deduplicationUnorderedArrayWidgetTypes = new Set([
  "widget.form.memberSelect",
  "widget.form.departmentSelect",
  "widget.form.checkboxGroup",
  "widget.form.treeMultipleSelect",
  "widget.form.tagInput",
  "widget.form.selectData",
  "widget.form.relatedData",
]);

const isUnsupportedDeduplicationWidget = (widget?: FormElement | null) => {
  return Boolean(widget?.type && deduplicationUnsupportedWidgetTypes.has(widget.type));
};

const shouldSortDeduplicationArray = (widget?: FormElement | null) => {
  return Boolean(widget?.type && deduplicationUnorderedArrayWidgetTypes.has(widget.type));
};

const encodeDeduplicationPrimitive = (value: any) => {
  if (value === undefined) return { __dedupeType: "undefined" };
  if (typeof value === "number" && Number.isNaN(value)) return { __dedupeType: "number", value: "NaN" };
  if (value === Number.POSITIVE_INFINITY) return { __dedupeType: "number", value: "Infinity" };
  if (value === Number.NEGATIVE_INFINITY) return { __dedupeType: "number", value: "-Infinity" };
  if (value === null) return { __dedupeType: "null" };
  return value;
};

const stringifyDeduplicationValue = (value: any) => {
  return JSON.stringify([value], (_, currentValue) => {
    return encodeDeduplicationPrimitive(currentValue);
  });
};

const normalizeDeduplicationValue = (
  value: any,
  options: { sortArray?: boolean } = {},
): any => {
  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    const normalized = value.map(item => normalizeDeduplicationValue(item, options));
    if (!options.sortArray) return normalized;
    return normalized.sort((left, right) => {
      return stringifyDeduplicationValue(left).localeCompare(stringifyDeduplicationValue(right));
    });
  }

  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = normalizeDeduplicationValue(value[key], options);
      return result;
    }, {});
  }

  return encodeDeduplicationPrimitive(value);
};

const getDeduplicationKey = (value: any, widget?: FormElement | null) => {
  return stringifyDeduplicationValue(normalizeDeduplicationValue(value, {
    sortArray: shouldSortDeduplicationArray(widget),
  }));
};

export class SubForm extends AbstractSubForm implements RelatedData {
  static resource = resource as any;

  get defaultName() {
    return i18next.t("defaultName");
  }
  private watchedRows = false;
  private _subSerialNumberFillTasks = new Map<string, Promise<Record<string, any>>>();
  private unsupportedDeduplicationFieldUid = "";
  declare public status: WidgetStatus & { rowsInitialized: boolean };

  static defineOptions(): DefinedOptions[] {
    return [{
      style: {
        basic: {
          children: [
            {
              name: "container-layout",
              default: "fluid",
              visible: false,
            },
          ]
        },
        basicStyle: {
          children: [
            {
              name: "width-ratio",
              visible: false,
            },
            {
              name: "form-children-array-option",
              alias: i18next.t("subFormFields"),
              type: `form-children-array(draggable, optionalWidgets=${encodeURIComponent(JSON.stringify(optionalWidgets))})`,
              click: (widget: SubForm, uid: string) => {
                widget.selectWidgetByUid(uid)
              },
            },
            {
              name: "default-value",
              alias: i18next.t("defaultValue"),
              type: "dialog",
              dialog: {
                component: SubFormDefaultValueDialog,
                buttonText: (widget: SubForm)=>{
                  if (widget.defaultValue?.some(row => Object.values(row).some(v => !isEmpty(v)))) {
                    return i18next.t("configured");
                  }
                  return i18next.t("set");
                },
                buttonStyle(element: SubForm, paths) {
                  return element.defaultValue?.some(row => Object.values(row).some(v => !isEmpty(v))) ? { color: 'var(--color-primary)' } : {}
                },
              },
            },
          ],
        },
        linkageFill: {
          alias: i18next.t("linkageFillSettings"),
          fold: "unfold",
          after: "basicStyle",
          children: [
            {
              name: "data-origin",
              alias: i18next.t("fillMode"),
              type: "select(radioGroup)",
              selectChoices: [
                {
                  value: "single",
                  label: i18next.t("singleRecord"),
                },
                {
                  value: "multiple",
                  label: i18next.t("multipleRecords"),
                }
              ],
              default: "multiple",
            },
            {
              name: "data-fill-rules",
              alias: i18next.t("fillRules"),
              type: "dialog",
              dialog: {
                component: DataFillRulesDialog,
                buttonText: (element: SubForm)=>{
                  if(element.dataOrigin != "multiple") {
                    return i18next.t("setInTriggerField")
                  }

                  if (!isEmpty(element.dataFillRules)) {
                    return i18next.t("configuredDataFillRules");
                  }
                  return i18next.t("setDataFillRules");
                },
                buttonStyle(element: SubForm, paths) {
                  if(element.dataOrigin != "multiple") {
                    return {color: 'var(--text-color-disabled)'}
                  }
                  const value = element.getOption("data-fill-rules");
                  return (isEmpty(value) || value === "") ? {} : { color: 'var(--color-primary)' }
                },
                componentProps: (element: SubForm) => {
                  return {
                    widget: element,
                    value: element.getOption('data-fill-rules'),
                  }
                }
              },
              disabled: (element: SubForm) => {
                return element.dataOrigin != "multiple";
              },
            },
            {
              name: "fill-order",
              alias: i18next.t("fillOrder"),
              type: "select(radioGroup)",
              selectChoices: [
                {
                  value: "forward",
                  label: i18next.t("forwardOrder"),
                },
                {
                  value: "backward",
                  label: i18next.t("reverseOrder"),
                }
              ],
              default: "forward",
            },
            {
              name: "sub-fields-visible",
              alias: i18next.t("subFieldVisibilityRules"),
              type: "drawer",
              drawer: {
                component: SubVisibilityRuleList,
                title: i18next.t("visibilityRules"),
                buttonText: (element: SubForm) => {
                  const value = element.subFieldsVisibleRules;
                  return isEmpty(value)
                    ? i18next.t("addVisibilityRule")
                    : i18next.t("configuredVisibilityRuleCount", { count: value.length });
                },
                buttonStyle(element: SubForm) {
                  const value = element.subFieldsVisibleRules;
                  return isEmpty(value) ? {} : { color: 'var(--color-primary)' }
                },
              }
            }
          ]
        },
        deduplication: {
          alias: i18next.t("deduplicationAggregation"),
          fold: "unfold",
          after: "linkageFill",
          children: [
            {
              name: "deduplication-aggregation",
              alias: i18next.t("enableDeduplicationAggregation"),
              type: "boolean",
              default: false,
            },
            {
              name: "aggregation-order",
              alias: i18next.t("aggregationOrder"),
              type: "select",
              disabled: (element: SubForm) => {
                return !element.getOption("deduplication-aggregation");
              },
              selectChoices: [
                {
                  value: "formula",
                  label: i18next.t("formulaThenAggregation"),
                },
                {
                  value: "aggregation",
                  label: i18next.t("aggregationThenFormula"),
                }
              ],
              default: "formula",
            },
            {
              name: "deduplication-field",
              alias: i18next.t("deduplicationField"),
              type: "select",
              disabled: (element: SubForm) => {
                return !element.getOption("deduplication-aggregation");
              },
              selectChoices: (element: SubForm)=>{
                return element.children.filter(item => !isUnsupportedDeduplicationWidget(item)).map(item => {
                  return {
                      value: item.uid,
                      label: item.title || item.name,
                  }
                })
              },
            },
            {
              name: "aggregation-rules",
              alias: i18next.t("aggregationSettings"),
              type: "dialog",
              disabled: (element: SubForm) => {
                return !element.getOption("deduplication-aggregation");
              },
              dialog: {
                component: AggregationRulesDialog,
                buttonText: (element: SubForm)=>{
                  const value = element.getOption("aggregation-rules");
                  if(!isEmpty(value)) {
                    for(let item of value as AggregationRule[]) {
                      if(item.type != AggregationType.NOTAGGRE) {
                        return i18next.t("configured")
                      }
                    }
                  }
                  return i18next.t("set")
                },
                buttonStyle(element: SubForm, paths) {
                  if (!element.getOption("deduplication-aggregation")) {
                    return {color: 'var(--text-color-disabled)'}
                  }
                  const value = element.getOption("aggregation-rules");
                  if(!isEmpty(value)) {
                    for(let item of value as AggregationRule[]) {
                      if(item.type != AggregationType.NOTAGGRE) {
                        return { color: 'var(--color-primary)' }
                      }
                    }
                  }
                  return {}
                },
                componentProps: (element: SubForm) => {
                  return {
                    widget: element,
                    value: element.getOption('aggregation-rules'),
                  }
                }
              }
            }
          ]
        },
        fieldsControl: {
          visible: false,
        },
        validation: {
          children: [
            {
              name: "required",
              visible: false
            },
            {
              name: "unique",
              visible: false
            },
            {
              name: "submit-valid",
              alias: i18next.t("subFormSubmitValidation"),
              type: "drawer",
              drawer: {
                component: defineAsyncComponent(() => import("@renderer/views/nocode/components/global/FormValidRule.vue")),
                title: i18next.t("subFormSubmitValidation"),
                buttonText: (widget: SubForm) => {
                  const value = widget.submitValid?.validConditions;
                  return isEmpty(value)
                    ? i18next.t("addValidationRule")
                    : i18next.t("configuredValidationRuleCount", { count: value?.length });
                },
                buttonStyle(widget: SubForm) {
                  const value = widget.submitValid?.validConditions;
                  return isEmpty(value) ? {} : { color: 'var(--color-primary)' }
                },
              }
            },
          ],
        },
        linkForm: {
          visible: false,
        },
        continuousInput: {
          visible: true,
          alias: i18next.t("continuousInput"),
          fold: "unfold",
          after: "validation",
          children: [
            {
              name: "enter-newline-input",
              alias: i18next.t("enterNewlineInput"),
              type: "boolean",
              default: false
            },
          ]
        }
      },
    }, ...super.defineOptions()];
  }

  private _isLoading = ref(true)
  private _selectDataBatchFillCount = ref(0)
  get isLoading() {
    return this._isLoading.value || this._selectDataBatchFillCount.value > 0
  }

  get isSelectDataBatchFilling() {
    return this._selectDataBatchFillCount.value > 0
  }

  public beginSelectDataBatchFill() {
    this._selectDataBatchFillCount.value += 1
  }

  public endSelectDataBatchFill() {
    this._selectDataBatchFillCount.value = Math.max(
      0,
      this._selectDataBatchFillCount.value - 1,
    )
  }

  protected initAfterConstructor(): void {
    super.initAfterConstructor();
    // watchRows 被 isReady 门控，子表单所在页签未激活时不会执行，此时 inputValue 为空。
    // 表单快照（serialize、退回提交）会把这个空值当成真实值回写主表，覆盖已取回的子表单明细。
    // 这里先按行数据补一次初始值，保证 inputValue 始终反映已持久化的明细。
    this.effectScope.run(() => {
      const stop = watch(() => this.initialValue, (value) => {
        if (this._rows.value !== undefined || !Array.isArray(value)) {
          return;
        }
        this._rows.value = deepClone(value);
        stop();
      }, { immediate: true, flush: 'sync' });
    });

    const stop = watch(()=>this.isProjectReady && this.enabled && this.isReady(), (value)=>{
      if (value) {
        this.watchRows();
        this.effectScope.run(() => {
          this.watchDataFill();
        });
        nextTick(() => {
          stop();
        })
      }
    }, { immediate: true });

    this.effectScope.run(() => {
      if (this.getBoard().formMode === FormMode.Edit) {
        this.watchRelatedRows();
      }
    })

    watch(() => {
      return this.isReady()
    }, (newValue) => {
      if(newValue) {
        setTimeout(() => {
          this._isLoading.value = false
        }, 500)
      }
    }, { immediate: true })
  }

  private transformFieldsFillCondition(condition: FormCondition) {
    const { uid, func, fixedValue, type } = condition;
    if (type === FormConditionValueType.FORM && Array.isArray(fixedValue)) {
      const value = fixedValue.filter(item => item !== undefined && item !== null && item !== "");
      if (!value.length) return null;
      if (func === RuleFunc.EQUAL) {
        return transformCondition({ uid, func: RuleFunc.IN, value });
      }
      if (func === RuleFunc.NOT_EQUAL) {
        return transformCondition({ uid, func: RuleFunc.NOT_IN, value });
      }
      return transformCondition({ uid, func, value });
    }
    return transformCondition({ uid, func, value: fixedValue });
  }

  private isNoValueRequiredFunc(func: RuleFunc) {
    return [RuleFunc.EMPTY, RuleFunc.NOT_EMPTY, RuleFunc.TRUE, RuleFunc.FALSE].includes(func);
  }

  private isAggregateLinkageTable(rule: FormLinkageRule) {
    const [connectionUID, tableUID] = rule.linkageTable || [];
    if (!connectionUID || !tableUID) return false;

    const bodyData = this.getBoard().getNocodeBodyData?.();
    const aggregateSources = [
      bodyData?.formData?.uid ? {
        uid: bodyData.formData.uid,
        aggregateTables: bodyData.formData.aggregateTables || [],
      } : null,
      ...((bodyData?.otherDataSources || []).map(source => ({
        uid: source.uid,
        aggregateTables: (source as any).aggregateTables || [],
      }))),
    ].filter(Boolean) as Array<{ uid: string, aggregateTables: Array<{ uid: string }> }>;

    return aggregateSources.some(source => {
      return source.uid === connectionUID && source.aggregateTables.some(table => table.uid === tableUID);
    });
  }

  private buildFieldsFillQuery(
    conditions: FormCondition[],
    filterValue: Record<string, any>,
    logic: LogicalOperator,
    scope: "main" | "sub",
    sourceFieldUID?: FieldUID,
  ) {
    if (!conditions.length) return null;

    const queryConditions = conditions.map(condition => {
      const conditionKey = (condition as any).id || condition.uid;
      const noValueRequired = this.isNoValueRequiredFunc(condition.func);
      const currentValue = condition.type === FormConditionValueType.FORM
        ? (filterValue?.[conditionKey] ?? filterValue?.[condition.uid] ?? filterValue?.[(condition as any).id])
        : condition.fixedValue;
      if (!noValueRequired && currentValue === undefined) return null;

      const uidSegments = condition.uid?.split(".").filter(Boolean) || [];
      if (scope === "main" && uidSegments.length !== 1) return null;
      if (scope === "sub" && (uidSegments.length < 2 || uidSegments[0] !== sourceFieldUID)) return null;

      const uid = scope === "main" ? uidSegments[0] : uidSegments[uidSegments.length - 1];
      if (!uid) return null;

      return this.transformFieldsFillCondition({
        ...condition,
        uid,
        fixedValue: noValueRequired ? condition.fixedValue : currentValue,
      } as FormCondition);
    }).filter(Boolean);

    if (!queryConditions.length) return null;

    return {
      [logic === LogicalOperator.AND ? "$and" : "$or"]: queryConditions,
    } as WhereCondition;
  }

  private buildMainAndSubFilterCondition(
    mainCondition: WhereCondition | null | undefined,
    subMatchedUUIDs: string[],
    hasSubCondition: boolean,
    logic: LogicalOperator,
    rowKey: FieldUID,
  ) {
    const uuidCondition = hasSubCondition
      ? {
        [rowKey]: {
          $in: subMatchedUUIDs,
        }
      } as WhereCondition
      : null;
    const hasMainCondition = !isEmpty(mainCondition);

    if (uuidCondition && hasMainCondition) {
      return {
        [logic === LogicalOperator.AND ? "$and" : "$or"]: [
          uuidCondition,
          mainCondition,
        ]
      } as WhereCondition;
    }

    if (uuidCondition) {
      return uuidCondition;
    }

    return hasMainCondition ? mainCondition : null;
  }

  private mergeWhereConditionsWithLogic(logic: LogicalOperator, ...conditions: (WhereCondition | null | undefined)[]) {
    const validConditions = conditions.filter(condition => !isEmpty(condition)) as WhereCondition[];
    if (!validConditions.length) return null;
    if (validConditions.length === 1) return validConditions[0];
    const logicKey = logic === LogicalOperator.AND ? "$and" : "$or";
    return {
      [logicKey]: validConditions,
    } as WhereCondition;
  }

  private mergeMatchedKeys(groups: string[][], logic: LogicalOperator) {
    if (!groups.length) return [];
    if (logic === LogicalOperator.OR) {
      return Array.from(new Set(groups.flat()));
    }

    return groups.reduce<string[]>((prev, current, index) => {
      if (index === 0) return Array.from(new Set(current));
      const currentSet = new Set(current);
      return prev.filter(item => currentSet.has(item));
    }, []);
  }

  private isEmptyFieldsFillValue(value: any) {
    if (Array.isArray(value)) {
      return value.filter(item => item !== undefined && item !== null && item !== "").length === 0;
    }
    return value === undefined || value === null || value === "";
  }

  private hasMissingFieldsFillCondition(conditions: FormCondition[], filterValue: Record<string, any>) {
    return conditions.some(condition => {
      if (condition.type !== FormConditionValueType.FORM) return false;
      if (this.isNoValueRequiredFunc(condition.func)) return false;
      const conditionKey = (condition as any).id || condition.uid;
      return this.isEmptyFieldsFillValue(filterValue?.[conditionKey]);
    });
  }

  private async getAllTableData(tableUID: OptionTableUID, options: QueryOptions = {}) {
    const pageSize = options.pageSize || 1000;
    const rows = [];
    let pageNumber = options.pageNumber || 1;

    while (true) {
      const data = await this.topForm.getData().getPagingRows(tableUID, {
        ...options,
        pageNumber,
        pageSize,
      }).catch(() => null);
      const currentRows = data?.rows || [];
      rows.push(...currentRows);
      if (currentRows.length < pageSize) {
        break;
      }
      pageNumber += 1;
    }

    return rows;
  }

  private async handleFillData(value, subFormValue, rule, subFormFillWidgets) {
    if(this.topForm.isViewing) return;
    const newValue = value
    const sourceTableUID = [rule.sourceConnectionUID || this.tableUID?.[0] || '', rule.sourceTableUID] as OptionTableUID
    const sourceTable = this.getTable(sourceTableUID);
    const dataUid = sourceTable?.fields?.find(f => f.meta?.name === '_uuid')?.uid
    const subFormFields = sourceTable?.fields?.filter(item => item.meta?.extra?.widgetType === 'widget.form.subform') ?? []
    if (!sourceTable || !dataUid) return;
    const useSubForms = rule.fillWidgets.map(f => {
      if(f.linkageWidget?.split(".")?.length > 1) {
        return f.linkageWidget.split(".")[0];
      } else {
        return undefined;
      }
    }).filter(Boolean)
    const sourceSubConditionGroups = ((rule.conditions || []) as FormCondition[]).reduce<Record<FieldUID, FormCondition[]>>((prev, condition) => {
      const uidSegments = condition.uid?.split(".").filter(Boolean) || [];
      if (uidSegments.length > 1) {
        const fieldUID = uidSegments[0] as FieldUID;
        if (!prev[fieldUID]) prev[fieldUID] = [];
        prev[fieldUID].push(condition);
      }
      return prev;
    }, {})
    function expandObject(obj) {
      const key = Object.keys(obj).find(k => Array.isArray(obj[k]));
      if (!key) return [obj]; // 没有数组，直接返回原对象

      return obj[key].map(v => ({
        ...obj,
        [key]: v
      }));
    }
    const filters = expandObject(newValue);
    const rows = []
    for(let i = 0; i < filters.length; i++) {
      const filter = filters[i];
      if (rule.logic === LogicalOperator.AND && this.hasMissingFieldsFillCondition(rule.conditions || [], filter)) {
        continue;
      }
      const mainQuery = this.buildFieldsFillQuery(rule.conditions || [], filter, rule.logic, "main");
      const matchedRowKeysGroups = await Promise.all(Object.keys(sourceSubConditionGroups).map(async fieldUID => {
        const sourceSubField = subFormFields.find(item => item.uid === fieldUID);
        const subTableUID = sourceSubField?.meta?.extra?.subTableUID;
        const subTable = subTableUID ? this.getTable(subTableUID) : null;
        const relationKey = subTable?.fields?.find(f => f.meta?.name === SystemField.KEY)?.uid;
        const subQuery = this.buildFieldsFillQuery(
          sourceSubConditionGroups[fieldUID] || [],
          filter,
          rule.logic,
          "sub",
          fieldUID as FieldUID,
        );
        if (!subTableUID || !relationKey || !subQuery) {
          return [];
        }
        const subRows = await this.getAllTableData(subTableUID, {
          filters: {
            [subTableUID[1]]: [subQuery],
          },
        });
        return Array.from(new Set(subRows.map(row => row?.[relationKey]).filter(Boolean)));
      }));
      const query = this.buildMainAndSubFilterCondition(
        mainQuery,
        this.mergeMatchedKeys(matchedRowKeysGroups, rule.logic),
        !isEmpty(sourceSubConditionGroups),
        rule.logic,
        dataUid,
      );
      if (!query) continue;
      let value = deepClone(await this.getAllTableData(sourceTableUID, {
        filters: {
          [sourceTableUID[1]]: [query],
        },
      })) || [];
      for(const subF of subFormFields) {
        if(!useSubForms.includes(subF.uid)) continue;
        const tempRows = [];
        const subTableUID = subF.meta?.extra?.subTableUID;
        const subFields = this.topForm.getTable(subTableUID)?.fields || [];
        const dataSource = subFields.find(f => f.meta?.name === '_key')?.uid
        const rowKeys = dataUid ? value.map(row => row[dataUid]).filter(Boolean) : [];
        if(!subTableUID || !dataSource || !rowKeys.length) continue;
        const subQuery = this.buildFieldsFillQuery(
          sourceSubConditionGroups[subF.uid] || [],
          filter,
          rule.logic,
          "sub",
          subF.uid as FieldUID,
        );
        const subTableQuery = this.mergeWhereConditionsWithLogic(
          rule.logic,
          {
            [dataSource]: {
              $in: rowKeys,
            },
          },
          subQuery,
        );
        if (!subTableQuery) continue;
        const subFormRows = deepClone(await this.getAllTableData(subTableUID, {
          filters: {
            [subTableUID[1]]: [subTableQuery],
          },
        })) || [];
        if(this.getOption('fill-order') === 'forward') {
          subFormRows.reverse();
        }
        for(let row of value) {
          const subFormRow = subFormRows.filter(r => r[dataSource] === row[dataUid])
          if(subFormRow?.length) {
            for(const r of subFormRow) {
              tempRows.push({...row, ...(r as any)});
            }
          } else {
            tempRows.push(row);
          }
        }
        value = tempRows;
      }
      const subFormVal = {}
      for (const key in subFormValue) {
        const isSubFormFill= typeof subFormValue[key] === 'object' && subFormValue[key]?.isSubFormFill
        if(isSubFormFill) {
          subFormVal[key.split(".").at(-1)] = subFormValue[key]?.value?.[i];
        } else {
          subFormVal[key.split(".").at(-1)] = subFormValue[key];
        }
      }
      for(let v of value) {
        Object.assign(v, subFormVal)
      }
      rows.push(...deepClone(value));
    }
    const widgetRow = []
    for(let i = 0; i < rows.length; i++) {
      const value = {}
      for(const fill of rule.fillWidgets) {
        const subWidget = this.form.getChildElement(fill.fillWidget)?.fieldId;
        if(subWidget) value[subWidget] = rows[i][fill.linkageWidget.split(".").at(-1)];
      }
      for(const fill of subFormFillWidgets) {
        const subWidget = this.form.getChildElement(fill.fillWidget)?.fieldId;
        if(subWidget) {
          value[subWidget] = rows[i][fill.fillWidget.split(".").at(-1)]
        };
      }
      widgetRow.push(value)
    }
    let finalRows
    if(this.getOption('aggregation-order') === 'aggregation') {
        finalRows = this.handleAggregation(widgetRow)
    } else {
      const subFormRows: SubFormRow[] = [];
      for (const row of widgetRow) {
        const uuid = row[UUID]
        const form: SubFormRow = new SubFormRow({type: "SubFormRow", uid: uuid}, this);
        form.setRow(row);
        const rowEffectScope = effectScope(true);
        for (const widget of this.children) {
          const mockWidget = await form.container.addWidget(
            reactive({
              ...deepClone(widget.getSoul()),
              uid: unique()
            }), undefined) as FormElement;
            Object.defineProperty(mockWidget, "originId", {
              get() {
                return widget.uid;
              }
            });
            Object.defineProperty(mockWidget, "field", {
              get: () => {
                if (!widget.field) {
                const field = this.field.subTableFields.find(f => f.meta?.uid === widget.uid);
                widget.bindField(field)
              }
              return widget.field;
            }
          });
          Object.defineProperty(mockWidget, "isHidden", {
            get() {
              return widget.isHidden;
            }
          });
          attachMockWidgetReadonlyBridge(mockWidget, widget as FormElement);
          attachMockWidgetRequiredBridge(mockWidget, widget as FormElement);
          // mockWidget.bindField(widget.field);
          mockWidget.setInputValueNotChanged(row[mockWidget.fieldId]);
          rowEffectScope.run(() => {
            watch(() => {
              const value = mockWidget.inputValue;
              if(value instanceof Date) {
                return {
                  lastChangeTime: mockWidget.status?.lastChangeTime,
                  value: dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
                }
              }
              if (!value) return {
                lastChangeTime: mockWidget.status?.lastChangeTime,
                value: value
              };
              return {
                lastChangeTime: mockWidget.status?.lastChangeTime,
                value: deepClone(value)
              };
            }, (value, oldValue) => {
              // if(!mockWidget.status?.lastChangeTime) return;
              if (equals(value?.lastChangeTime, oldValue?.lastChangeTime) && equals(value?.value, oldValue?.value)) return;
              if (equals(value?.value, oldValue?.value)) return;

              if (!equals(row[mockWidget.fieldId], value.value)) {
                row[mockWidget.fieldId] = value.value;
              }
            }, { immediate: true });
          });
        }
        this._rowEffectScopeMap.set(uuid, rowEffectScope);
        subFormRows.push(form);
      }
      const shouldRecalculateFilledValue = (child: any) => {
        if (!child?.handleFormatValue || typeof child.handleFormatValue !== "function") {
          return false;
        }
        if (child.type === "widget.form.autoCompute") {
          return true;
        }
        return child.defaultType === "formula" && !!child.defaultFormulaValueStr;
      };
      for(let i = 0; i < subFormRows.length; i++) {
        const recalculationChildren = subFormRows[i].children.filter(child => shouldRecalculateFilledValue(child as any));
        const count = recalculationChildren.length

        for(let j = 0; j < count; j++) {
          recalculationChildren.forEach(child => {
            (child as any).handleFormatValue()
          })
        }
      }
      const lastData = subFormRows.map(row => {
        const result = {}
        for(const field of row.children) {
          result[field.fieldId] = field.inputValue
        }
        return result
      })
      finalRows = this.handleAggregation(lastData)
    }
    clearTimeout(this.dataFillTimer)
    this.dataFillTimer = setTimeout(async () => {
      for(const finalRow of finalRows) {
        finalRow.isManualAdd = true
      }
      this.inputValue = deepClone(finalRows)
    },100)
  }
  private fillConditionValue = ref(null)
  private fillFieldValue = ref(null)

  private dataFillTimer = null
  private isChange = false
  private watchDataFill() {
    const rule: DataFillRule = this.getOption("data-fill-rules") || {};
    // 当前表单中子表单的字段
    // 当前表单映射项不在所选数据源表结构中，这里按数据源字段集合排除误判。
    const sourceTableUID = [rule.sourceConnectionUID || this.tableUID?.[0] || '', rule.sourceTableUID] as OptionTableUID
    const sourceTable = this.getTable(sourceTableUID);
    const sourceLinkageFieldUIDSet = new Set<string>();
    for (const field of sourceTable?.fields || []) {
      sourceLinkageFieldUIDSet.add(field.uid);
      const subTableUID = field.meta?.extra?.subTableUID;
      const subTable = subTableUID ? this.getTable(subTableUID) : null;
      for (const subField of subTable?.fields || []) {
        sourceLinkageFieldUIDSet.add(`${field.uid}.${subField.uid}`);
      }
    }
    const subFormFillWidgets = (rule.fillWidgets || []).filter(item => {
      return !!item.linkageWidget && !sourceLinkageFieldUIDSet.has(item.linkageWidget);
    })

    if(!rule.conditions) return;
    watch(() => {
      const value = rule.conditions?.reduce((prev, item) => {
        if(item.type != FormConditionValueType.FORM) return prev;
        if (this.isNoValueRequiredFunc(item.func)) return prev;
        const widgetIds = item.value?.split(".") || [];
        if (widgetIds.length > 1) {
          const widget = this.topForm.getChildElement(widgetIds[0]);
          const subWidget = widget?.form?.getChildElement(widgetIds[1]);
          if (widget) prev[item.id] = widget.inputValue?.map(i => i[subWidget.fieldId]);
        } else {
          const widget = (this.topForm as AbstractForm).getChildElement(item.value);
          if (widget) prev[item.id] = widget.inputValue;
          // 根据关联表单的数据进行筛选
          if (item.comparisonOfForm && item.comparisonOfForm === SelectIdOfForm.LINKAGE) {
              let allRelatedForms = this.topForm.children.filter(child => child.getSoul().type === "widget.form.relatedData").filter((r: any) => {
                const relatedTable = this.getTable(r.connectionTable);
                if (relatedTable?.fields.find(f => f.uid === item.value)) return r;
              });
              const relatedValues = ref([])
              for(const [index, relatedData] of allRelatedForms.entries()) {
                // 只会与关联表单的主表字段值进行筛选
                relatedValues.value[index] = (relatedData as any).getValue(item.value);
              }
              prev[item.id] = [...new Set(relatedValues.value.flat())];
            }
        }
        return prev;
      }, {})

      const lastChangeTime = rule.conditions?.reduce((prev, item) => {
        if(item.type != FormConditionValueType.FORM) return prev;
        if (this.isNoValueRequiredFunc(item.func)) return prev;
        const widgetIds = item.value?.split(".") || [];
        if (widgetIds.length > 1) {
          const widget = this.topForm.getChildElement(widgetIds[0]) as SubForm;
          const subWidget = widget?.form?.getChildElement(widgetIds[1]);
          if (widget) prev[item.id] = widget.tableData?.map(i => i.children.find(f => f.fieldId === subWidget.fieldId)?.status.lastChangeTime).filter(Boolean);
        } else {
          const widget = (this.topForm as AbstractForm).getChildElement(item.value);
          if (widget) prev[item.id] = widget?.status?.lastChangeTime;
        }
        return prev;
      }, {})

      return {
        value,
        lastChangeTime
      }
    }, async (newValue, oldValue) => {
      if(equals(newValue.value, oldValue.value)) return;
      for(const key of Object.keys(newValue.lastChangeTime)) {
        if(!isEmpty(newValue?.lastChangeTime?.[key]) && !equals(newValue?.lastChangeTime?.[key], oldValue?.lastChangeTime?.[key])) {
          this.isChange = true
          break
        }
      }
      if(this.dataOrigin != "multiple") return;
      this.fillConditionValue = newValue.value
      if(!this.isChange) return
      this.handleFillData(this.fillConditionValue, this.fillFieldValue, rule, subFormFillWidgets)
    }, { deep: true })

    watch(() => {
      const subFormValue = subFormFillWidgets.reduce((prev, item) => {
        const widgetIds = item.linkageWidget?.split(".");
        if (widgetIds.length > 1) {
          const widget = this.topForm.getChildElement(widgetIds[0]);
          const subWidget = widget?.form?.getChildElement(widgetIds[1]);
          if (!subWidget) {
            return prev
          }
          if (widget) {
            prev[item.fillWidget] = {
              isSubFormFill: true,
              value: widget.inputValue?.map(i => i[subWidget.fieldId])
            };
          }
        } else {
          const widget = (this.topForm as AbstractForm).getChildElement(item.linkageWidget);
          if (widget) prev[item.fillWidget] = widget.inputValue;
        }
        return prev
      }, {});

      const lastChangeTime = subFormFillWidgets.reduce((prev, item) => {
        const widgetIds = item.linkageWidget?.split(".");
        if (widgetIds.length > 1) {
          const widget = this.topForm.getChildElement(widgetIds[0]) as SubForm;
          const subWidget = widget?.form?.getChildElement(widgetIds[1]);
          if (!subWidget) {
            return prev
          }
          if (widget) {
            prev[item.fillWidget] = widget.tableData?.map(i => i.children.find(f => f.fieldId === subWidget.fieldId)?.status.lastChangeTime).filter(Boolean);
          }
        } else {
          const widget = (this.topForm as AbstractForm).getChildElement(item.linkageWidget);
          if (widget) prev[item.fillWidget] = widget?.status?.lastChangeTime;
        }
        return prev
      }, {});

      return {
        value: subFormValue,
        lastChangeTime
      }
    }, async (newValue, oldValue) => {
      if(equals(newValue.value, oldValue.value)) return;
      for(const key of Object.keys(newValue.lastChangeTime)) {
        if(!isEmpty(newValue?.lastChangeTime?.[key]) && !equals(newValue?.lastChangeTime?.[key], oldValue?.lastChangeTime?.[key])) {
          this.isChange = true
          break
        }
      }
      if(this.dataOrigin != "multiple") return;
      this.fillFieldValue = newValue.value
      if(!this.isChange) return
      this.handleFillData(this.fillConditionValue, this.fillFieldValue, rule, subFormFillWidgets)
    }, { deep: true })
  }

  private get subFieldsVisibleRules () {
    return this.getOption<FormVisibleRule[]>("sub-fields-visible") || [];
  }

  private watchRelatedRows() {
    watch(() => {
      if (!this.topForm.isViewing) return false;
      return !isEmpty(this.rows);
    }, (value) => {
      if (!value) return;
      // 读关联表数据
      this.readRelatedTableData();
    }, { immediate: true });
  }
  private _relatedTableData: Ref<{[fieldUID: FieldUID]: _TableData}> = ref({});
  private async readRelatedTableData() {
    for (const [fieldUID, { relatedTableUID, relatedTableFields }] of Object.entries(this.relatedTableInfo)) {
      const ids = this.rows.map(row => row[fieldUID])?.flat(Infinity);
      const uuidField = getUUIDSystemField(relatedTableFields);
      this.getData().getPagingRows(relatedTableUID, {
        filters: {
          [relatedTableUID[1]]: [
            { [uuidField.uid]: { $in: ids } }
          ]
        }
      }).then(({ count, rows }) => {
        const data = this._relatedTableData.value[fieldUID];
        if (!data) {
          this._relatedTableData.value[fieldUID] = {rows: rows, total: count};
        } else {
          data.rows = rows;
          data.total = count;
        }
      })
    }
  }

  // 处理聚合规则
  private handleAggregation(value) {
    if(!this.getOption('deduplication-aggregation')) return value
    const aggregationRules: AggregationRule[] = this.getOption("aggregation-rules") || [];
    const deduplicationField: string = this.getOption("deduplication-field") || "";
    if(!aggregationRules?.length || !deduplicationField || !value?.length) return value

    const deduplicationWidget = this.form.getChildElement(deduplicationField) as FormElement | undefined;
    if (!deduplicationWidget) return value;

    if (isUnsupportedDeduplicationWidget(deduplicationWidget)) {
      if (this.unsupportedDeduplicationFieldUid !== deduplicationWidget.uid) {
        ElMessage.warning(i18next.t("unsupportedDeduplicationFieldWarning"));
        this.unsupportedDeduplicationFieldUid = deduplicationWidget.uid;
      }
      return value;
    }

    this.unsupportedDeduplicationFieldUid = "";

    function mergeRow(arr, idKey, deduplicationWidget: FormElement, rules = []) {
      const map = new Map()

      for (const item of arr) {
        const id = getDeduplicationKey(item[idKey], deduplicationWidget)
        if (!map.has(id)) {
          // 首次出现，直接存入
          const base = { ...item }
          for (const rule of rules) {
            base[rule.field] = Number(base[rule.field]) || 0
          }
          map.set(id, { ...base, _count: 1 })
        } else {
          // 已存在 → 合并
          const exist = map.get(id)
          const merged = { ...exist }
          merged._count += 1

          // 累加指定字段
          for (const rule of rules) {
            switch(rule.type) {
              case AggregationType.SUM:
                merged[rule.field] = (Number(exist[rule.field]) || 0) + (Number(item[rule.field]) || 0)
                break;
              case AggregationType.MAX:
                merged[rule.field] = Math.max(Number(exist[rule.field]) || 0, Number(item[rule.field]) || 0)
                break;
              case AggregationType.MIN:
                if (exist[rule.field] == null) merged[rule.field] = Number(item[rule.field]) || 0
                else merged[rule.field] = Math.min(Number(exist[rule.field]) || 0, Number(item[rule.field]) || 0)
                break
              case AggregationType.AVG:
                merged[rule.field] = ((Number(exist[rule.field]) || 0) * (exist._count) + (Number(item[rule.field]) || 0)) / merged._count
                break
            }
          }

          // 其他字段以第一个为准，不覆盖
          map.set(id, merged)
        }
      }
      return Array.from(map.values())
    }

    const _deField = this.form.getChildElement(deduplicationField)?.fieldId || ''
    const _rules = deepClone(aggregationRules.map(r => {
      return {
        field: this.form.getChildElement(r.field)?.fieldId || '',
        type: r.type
      }
    }))

    const merged = mergeRow(deepClone(value), _deField, deduplicationWidget, _rules)
    return merged
  }

  get dataOrigin() {
    return this.getOption<"single" | "multiple">("data-origin");
  }

  set dataOrigin(val: "single" | "multiple") {
    this.setOption("data-origin", val);
  }

  get dataFillRules(): DataFillRule {
    return this.getOption("data-fill-rules") || {};
  }

  get widthRatio() {
    return 1;
  }

  get supportFixedWidth() {
    return false;
  }

  get defaultValueByUid() {
    return this.getOption<object[]>("default-value") ?? [{}];
  }

  get submitValid(): any {
    return this.getOption("submit-valid") || {};
  }

  get enterNewlineInput(): boolean {
    return this.getOption("enter-newline-input");
  }

  get defaultValue() {
    return this.defaultValueByUid.map(row => {
      const _row = {};
      for (const [uid, value] of Object.entries(row)) {
        const widget = this.children.find(child => child.uid === uid);
        if (widget) _row[widget.fieldId] = value;
      }
      return _row;
    });
  }

  override async doValidate() {
    if (!this.watchedRows) {
      this.watchRows();
      if (!isEmpty(this._rows.value)) {
        await new Promise<void>(resolve => {
          const stop = watch(() => this.tableData, (value) => {
            if (!isEmpty(value)) {
              resolve();
              nextTick(() => {
                stop();
              })
            }
          }, { immediate: true, deep: true});
        });
      }
    }
    await this.ensureAllSubFormRowsInitialized();
    // Validate row fields, including conditional required rules.
    for (const row of this.tableData) {
      for (const widget of row.children) {
        if(!widget.isHidden) {
          if (this.isRowConditionalRequired(widget, row) && this.isWidgetEmpty(widget)) {
            throw new Error(i18next.t("pleaseCheckSubFormBeforeSubmit"));
          }
          await widget.validate();
          if (widget.validationError) {
            throw new Error(i18next.t("pleaseCheckSubFormBeforeSubmit"));
          }
        }
      }
    }

    // 不允许重复字段校验
    // 收集所有有isUnique属性的字段
    const uniqueFields = this.children.filter(widget => widget.isUnique);
    // 对每个唯一字段进行校验
    for (const uniqueField of uniqueFields) {
      const fieldId = uniqueField.fieldId;
      const fieldName = uniqueField?.title || uniqueField?.field?.alias;
      const values = [];

      // 收集该字段在所有行中的值
      for (const row of this.tableData) {
        const widget = row.children.find(w => w.fieldId === fieldId);
        if (widget) {
          const value = widget.inputValue;
          // 只有非空值才参与唯一性校验
          if (value !== null && value !== undefined && value !== '') {
            // 检查是否已经有相同的值
            if (values.includes(value)) {
              // 找到重复值，设置错误并抛出异常
              throw new Error(i18next.t("subFormDuplicateFieldValue", { fieldName }));
            }
            values.push(value);
          }
        }
      }
    }
  }

  private isWidgetEmpty(widget: FormElement) {
    return typeof (widget as any).isEmpty === "function"
      ? (widget as any).isEmpty()
      : widget.inputValue === undefined || widget.inputValue === null || widget.inputValue === "";
  }

  private normalizeRowConditionUid(uid: string) {
    if (!uid || !this.getChildElement(uid)) {
      return uid;
    }
    return `${this.uid}${CONDITION_WIDGET_SEPARATOR}${uid}`;
  }

  private getRowConditionWidgetValue(row: SubFormRow, uid: string) {
    const normalizedUid = this.normalizeRowConditionUid(uid);
    if (!normalizedUid) return undefined;
    const widgetIds = normalizedUid.split(CONDITION_WIDGET_SEPARATOR).filter(Boolean);
    if (widgetIds.length > 1) {
      if (widgetIds[0] !== this.uid) {
        return this.topForm.getChildElement(normalizedUid)?.inputValue;
      }
      const conditionWidget = row.children.find(child => {
        return ((child as any).originId || child.uid) === widgetIds[1];
      });
      return conditionWidget?.inputValue;
    }
    return this.topForm.getChildElement(normalizedUid)?.inputValue;
  }

  private isRowConditionalRequired(widget: FormElement, row: SubFormRow) {
    const requiredMode = widget.getOption?.("required-mode", { skipDefault: true } as any);
    if (requiredMode !== "condition") {
      return false;
    }
    const rule = widget.getOption?.("field-required", { skipDefault: true } as any) as { logic?: LogicalOperator, conditions?: FormCondition[] } | null;
    if (!rule?.conditions?.length) {
      return false;
    }
    const matcher = rule.logic === LogicalOperator.OR ? "some" : "every";
    return rule.conditions[matcher]((condition) => {
      const conditionUid = this.normalizeRowConditionUid(condition?.uid);
      if (!conditionUid) return false;
      let targetWidget: FormElement | undefined;
      let templateWidget: FormElement | undefined;
      if (conditionUid.includes(CONDITION_WIDGET_SEPARATOR)) {
        const widgetIds = conditionUid.split(CONDITION_WIDGET_SEPARATOR).filter(Boolean);
        if (widgetIds[0] === this.uid) {
          templateWidget = this.getChildElement(widgetIds[1]);
          targetWidget = row.children.find(child => {
            return ((child as any).originId || child.uid) === widgetIds[1];
          }) as FormElement | undefined;
        } else {
          targetWidget = this.topForm.getChildElement(conditionUid);
        }
      } else {
        targetWidget = this.topForm.getChildElement(conditionUid);
      }
      if (!targetWidget) return false;
      const isVisible = targetWidget.getOption<boolean>("is-hidden")
        ? true
        : conditionUid.includes(CONDITION_WIDGET_SEPARATOR) && conditionUid.split(CONDITION_WIDGET_SEPARATOR)[0] === this.uid
          ? !!templateWidget && row.isChildShow(templateWidget)
          : !targetWidget.isHidden;
      if (!isVisible) {
        return false;
      }
      const fieldValue = this.getRowConditionWidgetValue(row, conditionUid);
      return meetRuleFuncs[condition.func]?.(fieldValue, condition.value) ?? false;
    });
  }

  public isColumnRequired(widget: FormElement) {
    if (widget.isRequired) {
      return true;
    }
    return this.tableData.some(row => {
      const rowWidget = row.children.find(child => child.fieldId === widget.fieldId || ((child as any).originId || child.uid) === widget.uid);
      return !!rowWidget?.isRequired;
    });
  }

  private _rows: Ref<object[]> = ref();

  get rows() {
    return this._rows.value;
  }

  get inputValue() {
    return this._rows.value;
  }

  /**
   * Flush values held by initialized virtual-row widgets before the parent
   * form snapshots the sub-form for submission. Dynamic columns are handled
   * by the submit-time pass above; uninitialized static columns keep their raw
   * values in _rows.
   */
  override async ensureInputValue() {
    // Formula/aggregation columns are not all mounted by the virtual table.
    // Recalculate their values on the submit snapshot so unmounted rows are
    // persisted with the same values as visible rows.
    await this.ensureDynamicFieldValues([], { force: true });
    const rows = this._rows.value || [];
    for (const row of rows as Record<string, unknown>[]) {
      const rowId = String(row?.[UUID] || "");
      if (!rowId || !this._initializedRowUids.has(rowId)) continue;

      const rowForm = this._subFormRowMap.get(rowId);
      if (!rowForm) continue;

      for (const child of rowForm.children) {
        const fieldId = child.fieldId || this.getSubWidgetFieldId(child);
        if (!fieldId) continue;

        await child.ensureInputValue();
        const initialChangeTimes = this._rowChildInitialChangeTimes.get(rowId);
        if (
          initialChangeTimes
          && equals(child.status?.lastChangeTime, initialChangeTimes.get(fieldId))
          && !isEmpty(row[fieldId])
        ) {
          continue;
        }
        const value = child.inputValue;
        // A virtual widget can temporarily expose no submit value while its
        // display state is being restored. Keep the raw row value in that
        // case; child watchers already write genuine user changes to it.
        if (value === undefined) {
          continue;
        }
        if (!equals(row[fieldId], value)) {
          row[fieldId] = deepClone(value);
        }
      }
    }
  }

  set inputValue(rows: object[]) {
    this._dynamicValueCache?.clear();
    this._dynamicValueVersions?.clear();
    this._dynamicValueDirtyRows?.clear();
    this.clearDynamicValueTasks();
    this._dynamicValueGeneration = (this._dynamicValueGeneration || 0) + 1;
    this._rows.value = rows;
  }

  public clearValue() {
    this.inputValue = [];
  }

  public canAddRows(count = 1) {
    return (this.rows?.length || 0) + Math.max(count, 0) <= SUB_FORM_ROW_LIMIT;
  }

  private getSubSerialNumberWidgets() {
    return this.children.filter(child => child.type === "widget.form.serialNumber") as SerialNumber[];
  }

  private getSubWidgetFieldId(widget: FormElement) {
    return widget.fieldId || this.field?.subTableFields?.find(field => field.meta?.uid === widget.uid)?.uid;
  }

  private async fillSubSerialNumberFields(row: Record<string, any>) {
    const serialNumberWidgets = this.getSubSerialNumberWidgets();
    if (!serialNumberWidgets.length) return row;

    const countingMap: Record<string, number> = {};
    const generatedWidgets: SerialNumber[] = [];

    for (const widget of serialNumberWidgets) {
      const fieldId = this.getSubWidgetFieldId(widget);
      if (!fieldId || !isEmptySerialNumberValue(row[fieldId])) continue;

      await widget.preloadFieldDisplaySources();
      const nextCount = widget.getNextSubSerialNumberCount();
      if (nextCount === undefined || nextCount === null) continue;

      countingMap[widget.uid] = nextCount;
      generatedWidgets.push(widget);
    }

    for (let i = 0; i < generatedWidgets.length; i++) {
      for (const widget of generatedWidgets) {
        const fieldId = this.getSubWidgetFieldId(widget);
        if (!fieldId) continue;

        row[fieldId] = widget.formatSubSerialNumber(countingMap[widget.uid], row);
      }
    }

    return row;
  }

  private ensureSubSerialNumberFields(row: Record<string, any>) {
    const rowId = row[UUID];
    if (!rowId) {
      return Promise.resolve(row);
    }

    const currentTask = this._subSerialNumberFillTasks.get(rowId);
    if (currentTask) {
      return currentTask;
    }

    const task = this.fillSubSerialNumberFields(row)
      .catch((error) => {
        console.error("fill sub serial number fields failed", error);
        ElMessage.error(i18next.t("subSerialNumberGenerateFailed"));
        return row;
      })
      .finally(() => {
        if (this._subSerialNumberFillTasks.get(rowId) === task) {
          this._subSerialNumberFillTasks.delete(rowId);
        }
      });

    this._subSerialNumberFillTasks.set(rowId, task);
    return task;
  }

  private _subFormRowMap = new Map<string, SubFormRow>();
  private _rowEffectScopeMap = new Map<string, EffectScope>();
  private _rowInitializationTasks = new Map<string, Promise<SubFormRow>>();
  private _rowChildInitialChangeTimes = new Map<string, Map<string, number | undefined>>();
  private _initializedRowUids = new Set<string>();
  private _rowInitializationVersion = ref(0);
  private _lazyRowInitializationEnabled = false;
  private fieldFillWatchVersions = new Map<string, number>();
  private _dynamicValueCache = new Map<string, Map<string, any>>();
  private _dynamicValueTasks = new Map<string, Promise<void>>();
  private _dynamicValueVersions = new Map<string, number>();
  // A dirty row keeps its existing raw values until recalculation succeeds.
  // This prevents cache invalidation from dropping sibling computed fields.
  private _dynamicValueDirtyRows = new Set<string>();
  private _dynamicValueGeneration = 0;

  private clearDynamicValueTasks(rowId?: string) {
    if (!rowId) {
      this._dynamicValueTasks.clear();
      return;
    }
    const prefix = `${String(rowId)}:`;
    for (const taskKey of this._dynamicValueTasks.keys()) {
      if (taskKey === String(rowId) || taskKey.startsWith(prefix)) this._dynamicValueTasks.delete(taskKey);
    }
  }

  private getDynamicChildren() {
    return this.children.filter((child: any) => {
      if (child.type === FormWidgetType.AUTO_COMPUTE) {
        return !child.isEditable && ((child.computeType === "formula" && !!child.formulaValue)
          || (child.computeType === "quickCompute" && child.otherTableFieldUID?.length >= 3));
      }
      return !child.isEditable && !!child.handleFormatValue && child.defaultType === "formula" && (
        !!child.defaultFormulaValueStr
        || (child.defaultComputeType === "quickCompute" && child.defaultOtherTableFieldUID?.length >= 3)
      );
    });
  }

  private getDynamicChildFieldId(child: FormElement) {
    return child.fieldId || this.getSubWidgetFieldId(child);
  }

  /** Calculate formula-backed fields for unmounted virtual rows on demand. */
  public async ensureDynamicFieldValues(fieldIds: string[] = [], options: { force?: boolean } = {}) {
    const forceRecalculate = options.force === true;
    const dynamicChildren = this.getDynamicChildren();
    if (!dynamicChildren.length) return;
    const requested = new Set(
      fieldIds
        .filter(Boolean)
        .map(fieldId => {
          const child = dynamicChildren.find(item => item.fieldId === fieldId || item.uid === fieldId);
          return child ? this.getDynamicChildFieldId(child) : fieldId;
        })
    );
    const targets = requested.size
      ? dynamicChildren.filter(child => requested.has(this.getDynamicChildFieldId(child)))
      : dynamicChildren;
    if (!targets.length) return;

    const rows = this.inputValue || [];
    const calculateRow = async (row: any) => {
      const rowId = String(row?.[UUID] || "");
      if (!rowId) return;
      // A transient row calculation evaluates all dynamic children. Reuse the
      // same task when multiple formulas request different fields of a row.
      const taskKey = rowId;
      const currentTask = this._dynamicValueTasks.get(taskKey);
      if (currentTask) {
        await currentTask;
        // A submit-time forced pass must still run after an earlier watcher
        // pass completes; that pass may have observed dependencies too early.
        if (!forceRecalculate) return;
      }
      const cache = this._dynamicValueCache.get(rowId) || new Map<string, any>();
      const rowDirty = this._dynamicValueDirtyRows.has(rowId);
      const isQuickComputeChild = (child: any) => child.type === FormWidgetType.AUTO_COMPUTE
        ? child.computeType === "quickCompute" && child.otherTableFieldUID?.length >= 3
        : child.defaultComputeType === "quickCompute" && child.defaultOtherTableFieldUID?.length >= 3;
      const missingTargets = targets.filter(child => {
        const fieldId = this.getDynamicChildFieldId(child);
        if (!fieldId) return false;
        // Submit-time recalculation is local and deterministic. Keep persisted
        // quick-compute results unless a row was actually changed; refreshing
        // those columns can require one data query per row.
        if (rowDirty || (forceRecalculate && !isQuickComputeChild(child))) return true;
        // Persisted values are authoritative on initial load. A transient
        // widget may calculate before its dependencies are ready and produce 0.
        if (Object.prototype.hasOwnProperty.call(row, fieldId) && row[fieldId] !== undefined) {
          if (!cache.has(fieldId)) cache.set(fieldId, deepClone(row[fieldId]));
          return false;
        }
        return !cache.has(fieldId);
      });
      if (!missingTargets.length) {
        this._dynamicValueCache.set(rowId, cache);
        return;
      }
      const calculationVersion = this._dynamicValueVersions.get(String(rowId)) || 0;
      const calculationGeneration = this._dynamicValueGeneration;

      const task = (async () => {
        const transientRow = deepClone(row);
        if (forceRecalculate) {
          // Do not let a stale persisted result survive a failed calculation.
          // Formula fields are repopulated below from the current dependencies.
          for (const child of dynamicChildren) {
            const fieldId = this.getDynamicChildFieldId(child);
            if (fieldId && !isQuickComputeChild(child)) delete transientRow[fieldId];
          }
        }
        const dynamicFieldIds = new Set(
          dynamicChildren
            .map(child => this.getDynamicChildFieldId(child))
            .filter(Boolean)
        );
        const transient = await this.createTransientSubFormRow(transientRow, dynamicFieldIds, false);
        try {
          const calculatedFieldIds = new Set<string>();
          const transientDynamicChildren = (transient.form.children as any[]).filter(child =>
            dynamicChildren.some(item => this.getDynamicChildFieldId(item) === child.fieldId)
          );
          const quickComputeChildren = transientDynamicChildren.filter(isQuickComputeChild);
          const formulaChildren = transientDynamicChildren.filter(child =>
            !quickComputeChildren.includes(child)
          );

          // Keep the transient row synchronized after each field. This allows
          // a quick-compute filter to consume a formula value and a formula to
          // consume a quick-compute result without mounting every row.
          const calculateFormulaChildren = () => {
            let changed = false;
            for (const child of formulaChildren) {
              if (typeof (child as any).handleFormatValue === "function") {
                const previousValue = child.fieldId ? transientRow[child.fieldId] : undefined;
                const calculatedValue = (child as any).handleFormatValue();
                if (child.fieldId && calculatedValue !== undefined) {
                  const nextValue = deepClone(calculatedValue);
                  transientRow[child.fieldId] = nextValue;
                  calculatedFieldIds.add(child.fieldId);
                  changed = changed || !equals(previousValue, nextValue);
                }
              }
            }
            return changed;
          };
          const formulaRounds = Math.max(1, formulaChildren.length);
          const runFormulaPass = () => {
            for (let i = 0; i < formulaRounds; i++) {
              if (!calculateFormulaChildren()) break;
            }
          };
          runFormulaPass();

          const fixedRuntimeDataFilter = (dataFilter: any) => dataFilter && {
            ...dataFilter,
            conditions: (dataFilter.conditions || []).map((condition: any) => {
              if ((!condition.type || condition.type === FormConditionValueType.FORM) && condition.comparisonUid) {
                return {
                  ...condition,
                  type: FormConditionValueType.CUSTOM,
                  fixedValue: condition.value,
                };
              }
              return condition;
            }),
          };

          for (const child of quickComputeChildren) {
            const isAutoCompute = child.type === FormWidgetType.AUTO_COMPUTE;
            const otherTableFieldUID = isAutoCompute
              ? child.otherTableFieldUID
              : child.defaultOtherTableFieldUID;
            const dataSourceMeta = (isAutoCompute ? (child as any).getOtherTableMeta?.() : undefined)
              || resolveDataSourceSelectionMeta(
                this.getBoard(),
                otherTableFieldUID?.slice(0, 2),
                this.topForm?.tableUID?.[0],
                { includeSchemaOnly: true },
              );
            const canCalculate = Boolean(dataSourceMeta?.nocodeId)
              && (dataSourceMeta?.isCurrentConnection || dataSourceMeta?.hasViewPermission);
            // An unavailable source is a transient state during form restore,
            // and a failed request must never replace a persisted aggregate.
            if (!canCalculate) continue;
            let value: number | null | undefined;
            try {
              value = await calculateAggregation({
                otherTableFieldUID,
                dataFilter: isAutoCompute
                  ? fixedRuntimeDataFilter(child.runtimeDataFilter)
                  : getDefaultQuickComputeRuntimeDataFilter(child as any, true),
                nocodeId: dataSourceMeta.nocodeId,
                aggregateType: isAutoCompute ? child.aggregateType : child.defaultAggregateType,
                decimal: child.decimal,
                row: transientRow,
                fields: this.field?.subTableFields || [],
                throwOnError: true,
              });
            } catch {
              continue;
            }
            if (value === undefined) continue;
            (child as any).inputValue = value;
            if (child.fieldId) {
              transientRow[child.fieldId] = deepClone(value);
              calculatedFieldIds.add(child.fieldId);
            }
          }

          // Re-evaluate formulas after quick-compute values are available.
          runFormulaPass();
          if (
            calculationGeneration !== this._dynamicValueGeneration
            || (this._dynamicValueVersions.get(String(rowId)) || 0) !== calculationVersion
          ) return;
          // The transient row evaluates every dynamic child. Commit every
          // missing dynamic value so concurrent callers requesting different
          // columns can safely share the same row task.
          const commitTargets = rowDirty
            ? dynamicChildren
            : forceRecalculate
              ? dynamicChildren.filter(child => !isQuickComputeChild(child))
            : dynamicChildren.filter(child => {
              const fieldId = this.getDynamicChildFieldId(child);
              return !!fieldId
                && (!Object.prototype.hasOwnProperty.call(row, fieldId) || row[fieldId] === undefined);
            });
          for (const child of transient.form.children as any[]) {
            if (!commitTargets.some(item => this.getDynamicChildFieldId(item) === child.fieldId)) continue;
            if (!calculatedFieldIds.has(child.fieldId)) continue;
            const value = child.inputValue;
            if (value === undefined) continue;
            cache.set(child.fieldId, deepClone(value));
            row[child.fieldId] = deepClone(value);
          }
          this._dynamicValueCache.set(rowId, cache);
          if (rowDirty) this._dynamicValueDirtyRows.delete(rowId);
        } finally {
          transient.dispose();
        }
      })();
      this._dynamicValueTasks.set(taskKey, task);
      try {
        await task;
      } finally {
        if (this._dynamicValueTasks.get(taskKey) === task) this._dynamicValueTasks.delete(taskKey);
      }
    };
    // Keep transient widget creation bounded so a large subtable does not
    // monopolize the renderer while a statistic is being calculated.
    for (let index = 0; index < rows.length; index += 4) {
      await Promise.all(rows.slice(index, index + 4).map(calculateRow));
    }
  }

  public invalidateDynamicValueCache(rowId?: string) {
    if (!rowId) {
      this._dynamicValueCache.clear();
      this._dynamicValueVersions.clear();
      this._dynamicValueDirtyRows.clear();
      this.clearDynamicValueTasks();
      this._dynamicValueGeneration += 1;
      return;
    }
    const normalizedRowId = String(rowId);
    this.clearDynamicValueTasks(normalizedRowId);
    this._dynamicValueVersions.set(normalizedRowId, (this._dynamicValueVersions.get(normalizedRowId) || 0) + 1);
    // Keep raw row values intact. The dirty marker makes the next calculation
    // recompute the dynamic columns instead of treating those values as fresh.
    this._dynamicValueCache.delete(normalizedRowId);
    this._dynamicValueDirtyRows.add(normalizedRowId);
  }

  private getRowValueByPath(row: Record<string, any>, path: string) {
    const parts = path.split(".").filter(Boolean);
    if (parts[0] === this.uid && parts[1]) {
      const child = this.getChildElement(parts[1]);
      if (child?.fieldId) parts.splice(0, 2, child.fieldId);
    } else if (parts.length === 1) {
      const child = this.getChildElement(parts[0]);
      if (child?.fieldId) parts[0] = child.fieldId;
    }
    return parts.reduce((value, key) => {
      if (Array.isArray(value)) return value.map(item => item?.[key]).filter(item => item !== undefined);
      return value?.[key];
    }, row as any);
  }

  private getCurrentSubFormFillWidgets(rule: FormLinkageRule) {
    return (rule.fillWidgets || []).filter(item => item.fillWidget === this.uid && item.linkageSubFields?.length);
  }

  /**
   * Return rows currently held by a form/subform before they are submitted.
   * Linkage fill must be able to use these rows because getTableData only
   * queries persisted data and therefore cannot see direct edits in another
   * virtualized subform.
   */
  private getLocalLinkageRows(tableUID?: OptionTableUID) {
    if (!tableUID?.[1] || !this.topForm) return undefined;
    const targetKey = tableUID.join(".");
    const visited = new Set<any>();
    const visit = (form: any): object[] | undefined => {
      if (!form || visited.has(form)) return undefined;
      visited.add(form);

      if (Array.isArray(form.inputValue) && form.tableUID?.join?.(".") === targetKey) {
        return form.inputValue.map((row: object) => deepClone(row));
      }
      if (form.tableUID?.join?.(".") === targetKey && typeof form.getRow === "function") {
        const row = form.getRow();
        return row ? [deepClone(row)] : [];
      }

      for (const child of form.children || []) {
        const rows = visit(child);
        if (rows !== undefined) return rows;
      }
      return undefined;
    };

    return visit(this.topForm);
  }

  private getRelatedFormConditionValues(fieldUid: string) {
    const allRelatedForms = this.topForm.children
      .filter(child => child.getSoul().type === "widget.form.relatedData")
      .filter((relatedForm: RelatedData) => {
        const relatedTable = this.getTable(relatedForm.connectionTable);
        return relatedTable?.fields?.find(field => field.uid === fieldUid);
      });
    const relatedValues = ref([]);
    for (const [index, relatedData] of allRelatedForms.entries()) {
      relatedValues.value[index] = (relatedData as any).getValue(fieldUid);
    }
    return [...new Set(relatedValues.value.flat())];
  }

  private getRowChildElement(rowForm: SubFormRow, childUid: string) {
    const templateChild = this.getChildElement(childUid);
    if (templateChild) {
      return rowForm.children.find(child => child.fieldId === templateChild.fieldId) as FormElement | undefined;
    }
    return rowForm.children.find(child => (((child as any).originId || child.uid) === childUid)) as FormElement | undefined;
  }

  private getFieldFillConditionValues(rowForm: SubFormRow, rowData: Record<string, any>, conditions: FormCondition[], preferUid = false) {
    return conditions.reduce<Record<string, any>>((prev, item: any) => {
      if (item.type === "CUSTOM") return prev;
      const key = preferUid ? (item.uid || item.id) : (item.id || item.uid);
      if (!key) return prev;
      const widgetIds = item.value?.split(".") || [];
      if (widgetIds.length > 1) {
        if (widgetIds[0] === this.uid) {
          // 当前规则引用的是本子表字段时，只取当前行的值，不能再聚合整列值。
          const widget = this.getRowChildElement(rowForm, widgetIds[1]);
          if (widget) prev[key] = rowData[widget.fieldId];
          return prev;
        }
        const subFormWidget = this.topForm.getChildElement(widgetIds[0]) as SubForm;
        const subWidget = subFormWidget?.form?.getChildElement(widgetIds[1]) as FormElement | undefined;
        if (subWidget?.fieldId) {
          const values = subFormWidget?.inputValue
            ?.map(item => item[subWidget.fieldId])
            .filter(value => value !== undefined && value !== null && value !== "");
          if (values?.length) {
            prev[key] = values.length === 1 ? values[0] : values;
          }
        }
        return prev;
      }
      const widget = (this.topForm as AbstractForm).getChildElement(item.value);
      if (widget) prev[key] = widget.inputValue;
      if (item.comparisonOfForm && item.comparisonOfForm === SelectIdOfForm.LINKAGE) {
        prev[key] = this.getRelatedFormConditionValues(item.value);
      }
      return prev;
    }, {});
  }

  private watchFieldFillForRow(rowForm: SubFormRow, rowData: Record<string, any>, rule: FormLinkageRule, currentSubFormFillWidgets = this.getCurrentSubFormFillWidgets(rule)) {
    if (currentSubFormFillWidgets.length === 0) return;
    const watchKey = `${rowForm.uid}:${rule.id || JSON.stringify(rule)}`;
    watch(() => {
      return this.getFieldFillConditionValues(rowForm, rowData, rule.conditions);
    }, async (newVal, oldVal) => {
      if (this.topForm.isViewing) return;
      const isInitialRun = oldVal === undefined;
      const isChanged = newVal ? Object.keys(newVal).some(key => !equals(newVal?.[key], oldVal?.[key])) : false;
      const hasNoValueCondition = (rule.conditions || []).some(condition => this.isNoValueRequiredFunc(condition.func));
      // Virtual rows can be initialized after their source fields already have
      // values. Run the fill once on initialization, but skip genuinely empty
      // conditions so we do not issue useless linkage queries for blank rows.
      if (!isChanged && !Object.values(newVal || {}).some(value => !isEmpty(value)) && !hasNoValueCondition) {
        return;
      }
      const watchVersion = (this.fieldFillWatchVersions.get(watchKey) || 0) + 1;
      this.fieldFillWatchVersions.set(watchKey, watchVersion);
      // 每一行单独生成过滤条件，只查询当前行对应的数据。
      const rowsFilterValue = this.getFieldFillConditionValues(rowForm, rowData, rule.conditions, true);
      // In an AND rule, an empty current-form value makes the rule incomplete.
      // Do not drop that condition and accidentally query by the remaining
      // conditions (for example, only by an `is empty` source-field check).
      if (rule.logic === LogicalOperator.AND && this.hasMissingFieldsFillCondition(rule.conditions || [], rowsFilterValue)) {
        return;
      }
      const rowsQuery = this.buildFieldsFillQuery(rule.conditions || [], rowsFilterValue, rule.logic, "main");
      if (!rowsQuery) return;
      let rowsFilters = {
        [rule.linkageTable[1]]: [rowsQuery],
      };
      const linkageTable = this.getTable(rule.linkageTable);
      if (!linkageTable) return;
      const isSubTableChanged = () => {
        return !isEmpty(linkageTable.meta?.extra?.primaryTable);
      }
      if (isSubTableChanged()) {
        const subTableFilterConditions = this.getFieldFillConditionValues(rowForm, rowData, rule.subTableSetting?.conditions || [], true);
        const subTableQuery = this.buildFieldsFillQuery(
          rule.subTableSetting?.conditions || [],
          subTableFilterConditions,
          rule.subTableSetting?.logic || LogicalOperator.AND,
          "main",
        );
        if (rule.subTableSetting?.conditions?.length && !subTableQuery) return;
        const primaryTablePath = linkageTable.meta?.extra?.primaryTable;
        const primaryTable = primaryTablePath ? this.getTable(primaryTablePath) : null;
        const primaryKeyField = primaryTable ? getUUIDSystemField(primaryTable.fields) : null;
        const keyField = linkageTable.fields.find(field => field.meta?.name === SystemField.KEY);
        if (primaryTable?.uid && primaryKeyField?.uid && keyField?.uid) {
          const filters = {
            [primaryTable.uid]: [subTableQuery || {}],
          };
          const distinct = await fetchDistinct({
            nocodeId: this.getBoard().nocodeId,
            tableUID: primaryTable.uid,
            columnId: primaryKeyField.uid,
            options: {
              filters,
            },
          }, axios, { baseURL: "" }) || [];
          rowsFilters = {
            [rule.linkageTable[1]]: [{
              $and: [
                rowsQuery,
                {
                  [keyField.uid]: Array.isArray(distinct) ? distinct : [],
                },
              ],
            }]
          };
        }
      }
      const isAggregateLinkageTable = this.isAggregateLinkageTable(rule);
      const queryOptions = isAggregateLinkageTable ? {} : { filters: rowsFilters };
      let _rows;
      try {
        _rows = await (this.topForm as any).getTableData(rule.linkageTable, queryOptions) || [];
      } catch {
        return;
      }
      const localRows = this.getLocalLinkageRows(rule.linkageTable);
      if (localRows !== undefined) {
        _rows = localRows;
      }
      const currentMainTableUID = this.topForm?.tableUID?.[1];
      if (!_rows.length && localRows === undefined && currentMainTableUID && rule.linkageTable?.[1] === currentMainTableUID) {
        const currentMainRow = (this.topForm as any).getRow?.();
        if (currentMainRow) {
          _rows = [deepClone(currentMainRow)];
        }
      }
      if (this.fieldFillWatchVersions.get(watchKey) !== watchVersion) return;
      const dataUid = linkageTable.fields.find(field => field.meta?.name === "_uuid")?.uid;
      const subFormFields = linkageTable.fields.filter(item => item.meta?.extra?.widgetType === "widget.form.subform");
      for (const subF of subFormFields) {
        const tempRows = [];
        const dataSource = this.getTable(subF.meta?.extra?.subTableUID)?.fields?.find(field => field.meta?.name === "_key")?.uid;
        const localSubFormRows = this.getLocalLinkageRows(subF.meta?.extra?.subTableUID);
        const subFormRows = localSubFormRows !== undefined
          ? localSubFormRows
          : await (this.topForm as any).getTableData(subF.meta?.extra?.subTableUID);
        if (!subFormRows?.length) continue;
        for (const currentRow of _rows) {
          const currentSubRows = subFormRows.filter(item => item[dataSource] === currentRow[dataUid]);
          if (currentSubRows?.length) {
            tempRows.push({ ...currentRow, [subF.uid]: currentSubRows });
          } else {
            tempRows.push(currentRow);
          }
        }
        _rows = tempRows;
      }
      if (this.fieldFillWatchVersions.get(watchKey) !== watchVersion) return;
      const rows = _rows?.filter(currentRow => {
        const func = rule.logic === LogicalOperator.AND ? "every" : "some";
        return rule.conditions[func](condition => {
          try {
            const conditionValue = condition.type === FormConditionValueType.FORM
              ? this.getRowValueByPath(currentRow, condition.uid)
              : condition.fixedValue;
            return meetRuleFuncs[condition.func]?.(
              conditionValue,
              newVal[condition.id || condition.uid],
            );
          } catch {
            return false;
          }
        });
      });
      for (const item of currentSubFormFillWidgets) {
        for (const itemField of item.linkageSubFields || []) {
          // 这里只回填当前 rowForm 里的控件，避免把结果广播到子表其他行。
          const widget = this.getRowChildElement(rowForm, itemField.fillWidget) as any;
          if (!widget) continue;
          const [tableField, subField] = itemField.linkageField.split(".");
          if (["widget.form.treeSelect", "widget.form.treeMultipleSelect"].includes(widget?.type)) {
            if (!rows?.length) {
              const fieldId = widget.fieldId || this.getSubWidgetFieldId(widget);
              if (isInitialRun && fieldId && !isEmpty(rowData[fieldId])) continue;
              widget.onFillData([]);
              continue;
            }
            let data;
            if (subField) {
              data = [];
              for (const matchedRow of rows) {
                const subRows = matchedRow?.[tableField];
                if (Array.isArray(subRows)) {
                  data.push(...subRows.map(subRow => subRow?.[subField]));
                }
              }
            } else {
              data = rows.map(matchedRow => matchedRow?.[tableField]);
            }
            widget.onFillData(data);
          } else {
            if (!rows?.length) {
              // During virtual-row restoration the linkage query can finish
              // before its source data or relation details are available. Do
              // not erase a value that was already persisted on the row on
              // this initial watcher run; later user changes still clear it.
              const fieldId = widget.fieldId || this.getSubWidgetFieldId(widget);
              if (isInitialRun && fieldId && !isEmpty(rowData[fieldId])) continue;
              widget.clearValue();
              continue;
            }
            const value = subField ? rows?.[0]?.[tableField]?.[0]?.[subField] : rows?.[0]?.[tableField];
            widget.inputValue = value;
          }
        }
      }
    }, { deep: true, immediate: true });
  }

  private watchFieldsFillForRow(rowForm: SubFormRow, rowData: Record<string, any>, rowEffectScope: EffectScope) {
    if (!this.topForm)  return;
    const rules = (((this.topForm as any).runnableFieldsFilling || []) as FormLinkageRule[]);
    if (!rules.length) return;
    rowEffectScope.run(() => {
      for (const rule of rules) {
        const currentSubFormFillWidgets = this.getCurrentSubFormFillWidgets(rule);
        if (currentSubFormFillWidgets.length === 0) continue;
        // 子表行创建时为每一行挂独立 watcher，后续联动按行触发。
        this.watchFieldFillForRow(rowForm, rowData, rule, currentSubFormFillWidgets);
      }
    });
  }

  private async addWidgets(form: SubFormRow, souls: WidgetSoul[]) {
    const nextSouls = souls.map(soul => {
      if (!soul.uid) soul.uid = unique();
      if (!form.container.isChildTypeValid(soul.type)) throw new Error(i18next.t("containerTs.invalidTypeError"));
      soul.preventLockEvent = true;
      form.container.checkSoulUid(soul);
      return soul;
    });

    const widgetTypes = [...new Set(nextSouls.map(soul => soul.type))];
    await Promise.all(widgetTypes.map(type => loadWidget(type)));
    await form.container.syncWidgetsBatch(nextSouls);

    const widgetMap = new Map(form.container.widgets.map(widget => [widget.uid, widget]));
    const widgets = nextSouls.map(soul => widgetMap.get(soul.uid));
    for (const widget of widgets) {
      widget?.clearGroupStatusFold();
    }
    form.container.autoArrange();
    return widgets;
  }

  private async _initializeSubFormRow(row: object, form: SubFormRow, isBatchInitialization = false): Promise<SubFormRow> {
    const uuid = row[UUID];
    if (this._initializedRowUids.has(uuid)) {
      form.setRow(row);
      return form;
    }

    const currentTask = this._rowInitializationTasks.get(uuid);
    if (currentTask) return currentTask;

    const task = (async () => {
      const rowEffectScope = effectScope(true);
      const children = this.children;
      const childSouls = children.map(widget => reactive({
        ...deepClone(widget.getSoul()),
        uid: unique()
      }));
      const mockWidgets = await this.addWidgets(form, childSouls);
      for (const [index, widget] of children.entries()) {
        const mockWidget = mockWidgets[index] as FormElement;
        if (!mockWidget) continue;
        if((row as any).updateLastChangeTime) {
          widget.status.lastChangeTime = mockWidget.status.lastChangeTime = (row as any).updateLastChangeTime;
        }
        Object.defineProperty(mockWidget, "originId", {
          get() {
            return widget.uid;
          }
        });
        Object.defineProperty(mockWidget, "field", {
          get: () => {
            if (!widget.field) {
              const field = this.field?.subTableFields?.find(f => f.meta?.uid === widget.uid);
              widget.bindField(field)
            }
            return widget.field;
          }
        });
        Object.defineProperty(mockWidget, "isHidden", {
          get() {
            return widget.isHidden;
          }
        });
        attachMockWidgetReadonlyBridge(mockWidget, widget as FormElement);
        attachMockWidgetRequiredBridge(mockWidget, widget as FormElement);
        if (row.hasOwnProperty(mockWidget.fieldId)) {
          mockWidget.setInputValueNotChanged(deepClone(row[mockWidget.fieldId]));
        } else {
          mockWidget.setInputValueNotChanged(undefined);
        }
        let initialChangeTimes = this._rowChildInitialChangeTimes.get(String(uuid));
        if (!initialChangeTimes) {
          initialChangeTimes = new Map();
          this._rowChildInitialChangeTimes.set(String(uuid), initialChangeTimes);
        }
        initialChangeTimes.set(
          mockWidget.fieldId,
          mockWidget.status?.lastChangeTime,
        );
        rowEffectScope.run(() => {
          watch(() => {
            const value = mockWidget.inputValue;
            if(value instanceof Date) {
              return {
                lastChangeTime: mockWidget.status?.lastChangeTime,
                value: dayjs(value).format("YYYY-MM-DD HH:mm:ss"),
              }
            }
            if (!value) return {
              lastChangeTime: mockWidget.status?.lastChangeTime,
              value: value
            };
            return {
              lastChangeTime: mockWidget.status?.lastChangeTime,
              value: deepClone(value)
            };
          }, (value, oldValue) => {
            if (equals(value?.lastChangeTime, oldValue?.lastChangeTime) && equals(value?.value, oldValue?.value)) return;
            if (equals(value?.value, oldValue?.value)) return;
            if (
              this._rowChildInitialChangeTimes.get(String(row[UUID]))
              && equals(
                mockWidget.status?.lastChangeTime,
                this._rowChildInitialChangeTimes.get(String(row[UUID]))?.get(mockWidget.fieldId),
              )
              && !isEmpty(row?.[mockWidget.fieldId])
            ) {
              return;
            }
            if (!equals(row?.[mockWidget.fieldId], value.value)) {
              const _row = this._rows.value.find(item => item[UUID] === row[UUID]);
              if(_row) {
                _row[mockWidget.fieldId] = value.value;
                this.invalidateDynamicValueCache(String(row[UUID]));
                if (this.getDynamicChildren().some(child => this.getDynamicChildFieldId(child) === mockWidget.fieldId)) {
                  _row[mockWidget.fieldId] = value.value;
                }
              }
            }
          }, { immediate: true, deep: true });
        });
      }
      const deferredSelectData = (row as any)[DEFERRED_SELECT_DATA] || {};
      for (const child of form.children) {
        const deferred = deferredSelectData[(child as any).originId];
        if (deferred && "selectedRows" in (child as any)) {
          (child as any).selectedRows = {
            [deferred.key]: deepClone(deferred.rows),
          };
        }
      }
      if (!isBatchInitialization) {
        for (const child of form.children) {
          if (child.type === FormWidgetType.AUTO_COMPUTE) {
            (child as any).refreshAggregationWatchers?.();
          }
        }
      }
      this.watchFieldsFillForRow(form, row as Record<string, any>, rowEffectScope);
      this._rowEffectScopeMap.set(uuid, rowEffectScope);
      this._initializedRowUids.add(uuid);
      this._rowInitializationVersion.value += 1;
      return form;
    })();

    this._rowInitializationTasks.set(uuid, task);
    try {
      return await task;
    } finally {
      if (this._rowInitializationTasks.get(uuid) === task) {
        this._rowInitializationTasks.delete(uuid);
      }
    }
  }

  private async _createSubFormRow(row: object, isBatchInitialization = false, initializeWidgets = true): Promise<SubFormRow> {
    const uuid = row[UUID];
    const cachedForm = this._subFormRowMap.get(uuid);
    if (cachedForm) {
      cachedForm.setRow(row);
      if (initializeWidgets) {
        await this._initializeSubFormRow(row, cachedForm, isBatchInitialization);
      }
      return cachedForm;
    }
    const form: SubFormRow = new SubFormRow({type: "SubFormRow", uid: uuid}, this);
    form.setRow(row);
    this._subFormRowMap.set(uuid, form);
    if (initializeWidgets) {
      await this._initializeSubFormRow(row, form, isBatchInitialization);
    }
    return form;
  }

  async addWidget(soul: WidgetSoul, index: number) {
    if (!soul.uid) soul.uid = unique();
    const widget = await this.container.addWidget(soul, index);
    return widget;
  }

  async moveWidget(widget: FormElement, index: number) {
    const soul = widget.detach();
    await this.container.insertByIndex([soul], index);
  }

  private _tableData: SubFormRow[] = reactive([]);
  private _rowsSyncVersion = ref(0);
  // 批量更新只等待行模型和已创建子控件 watcher，不等待 Vue 渲染队列；可视行子控件按需初始化。
  private _pendingRowsSync: Array<{
    rows: object[];
    resolve: () => void;
    tableDataResolve: () => void;
    trace?: SubFormFillTrace;
  }> = [];
  public isEditingDefaultValue: boolean = false
  public watchRows() {
    if (this.watchedRows) return;
    this.watchedRows = true;
    let initialValue = this.initialValue;
    let hasRowsInitializedGuard = false;
    if (!Array.isArray(initialValue)) {
      initialValue = undefined;
    }
    let defaultValue = [];
    if (this.form?.isAddingRow || this.isEditingDefaultValue) {
      defaultValue = this.defaultValue ?? [{}];
    }
    this._rows.value = isEmpty(this._rows.value) ? deepClone(initialValue ?? defaultValue) : this._rows.value;
    this.effectScope.run(()=>{
      watch(()=>{
        return {
          uuids: this.inputValue.map((row)=>{
          if (!row[UUID]) {
            row[UUID] = unique();
          }
          return row[UUID];
          }),
          syncVersion: this._rowsSyncVersion.value,
        };
      }, async (newVal, oldVal) => {
        const rows = this.inputValue;
        const pendingRowsSync = this._pendingRowsSync.find(item => item.rows === rows);
        const batchTrace = pendingRowsSync?.trace;
        const deferRowInitialization = !!batchTrace && this._lazyRowInitializationEnabled;
        const tableData: SubFormRow[] = [];

        for (const row of rows) {
          await this.ensureSubSerialNumberFields(row as Record<string, any>);
        }

        const rowForms = await Promise.all(rows.map(async row => {
          const uuid = row[UUID];
          let form = this._subFormRowMap.get(uuid);

          if (!form) {
            form = await this._createSubFormRow(row, true, !deferRowInitialization);
          } else {
            form.setRow(row);
            if (!deferRowInitialization && !this._initializedRowUids.has(uuid)) {
              await this._initializeSubFormRow(row, form, true);
            }
          }
          return form;
        }));
        tableData.push(...rowForms);

        const updateTableData = () => {
          this._tableData.splice(0, this._tableData.length, ...tableData);
        };
        const hasPendingRowsSync = !!pendingRowsSync;
        if (!hasPendingRowsSync) {
          updateTableData();
        }

        for(let i = 0; i < rows.length; i++) {
          const rowData = rows[i];
          const form = rowForms[i];
          for(const child of form.children) {
            const hasExplicitValue = Object.prototype.hasOwnProperty.call(rowData, child.fieldId);
            if (hasExplicitValue) {
              child.setInputValueNotChanged(deepClone(rowData[child.fieldId]));
            } else if (rowData.isManualAdd !== true) {
              // 这里需要设置为undefined，因为如果设置为null，会导致数字组件的判别为空值，而导致默认值不显示
              child.setInputValueNotChanged(undefined);
            }
          }
        }

        for (const form of rowForms) {
          for (const child of form.children) {
            if (child.type === FormWidgetType.AUTO_COMPUTE) {
              (child as any).refreshAggregationWatchers?.();
            }
          }
        }

        const pendingRowsSyncIndex = this._pendingRowsSync.findIndex(item => item.rows === rows);
        if (pendingRowsSyncIndex >= 0) {
          const [pendingRowsSync] = this._pendingRowsSync.splice(pendingRowsSyncIndex, 1);
          pendingRowsSync.resolve();
        }

        if (hasPendingRowsSync) {
          window.setTimeout(() => {
            if (this.inputValue === rows) {
              updateTableData();
            }
            pendingRowsSync?.tableDataResolve();
          }, 0);
        }

        if (!hasRowsInitializedGuard && rows.length === initialValue?.length) {
          this.status.rowsInitialized = true;
          hasRowsInitializedGuard = true;
        }

      }, {immediate: true});
    });
  }
  get tableData() {
    return this._tableData;
  }

  getTableVisibleChildren() {
    return this.children.filter(item => {
      if(item.isHidden) {
        return false
      }
      if(item.isReadonly && !item.fieldId && item.type !== FormWidgetType.SELECT_DATA) {
        return false
      }
      return true
    })
  }

  getRowChildVisibilitySignature(row: SubFormRow, widget: FormElement) {
    return row?.isChildShow?.(widget) ? '1' : '0';
  }

  getRowVisibilitySignature(row: SubFormRow, widgets: FormElement[] = this.getTableVisibleChildren()) {
    return widgets.map(widget => this.getRowChildVisibilitySignature(row, widget)).join('');
  }

  getSubFormRow(uuid: string) {
    return this._subFormRowMap.get(uuid);
  }

  public setLazyRowInitialization(enabled: boolean) {
    this._lazyRowInitializationEnabled = enabled;
  }

  get rowInitializationVersion() {
    return this._rowInitializationVersion.value;
  }

  public isSubFormRowInitialized(row: SubFormRow | Record<string, any> | string) {
    const uuid = typeof row === "string"
      ? row
      : (row as SubFormRow)?.getRow?.()?.[UUID] || (row as any)?.[UUID] || (row as any)?.uid;
    return !!uuid && this._initializedRowUids.has(uuid);
  }

  public async ensureSubFormRowInitialized(row: SubFormRow | Record<string, any>) {
    const rowData = (row as SubFormRow)?.getRow?.() || row;
    const uuid = rowData?.[UUID] || (row as any)?.uid;
    if (!uuid) return;

    let form = this._subFormRowMap.get(uuid);
    if (!form) {
      form = await this._createSubFormRow(rowData, false, false);
    }
    await this._initializeSubFormRow(rowData, form);
  }

  public async ensureRowsForRange(start: number, end: number) {
    const rows = this.inputValue || [];
    const first = Math.max(0, Math.floor(start || 0));
    const last = Math.min(rows.length - 1, Math.floor(end || 0));
    if (last < first) return;

    await Promise.all(rows.slice(first, last + 1).map(row => {
      return this.ensureSubFormRowInitialized(row as Record<string, any>);
    }));
  }

  public async ensureAllSubFormRowsInitialized() {
    const rows = this.inputValue || [];
    if (!rows.length) return;
    await Promise.all(rows.map(row => this.ensureSubFormRowInitialized(row as Record<string, any>)));
  }

  getSubFormRowMap() {
    return this._subFormRowMap;
  }

  public async createTransientSubFormRow(
    row: Record<string, any>,
    includedFieldIds?: Set<string>,
    refreshAggregationWatchers = true,
  ) {
    const uuid = row[UUID] || unique();
    row[UUID] = uuid;

    const rowEffectScope = effectScope(true);
    const form: SubFormRow = new SubFormRow(
      { type: "SubFormRow", uid: uuid },
      this,
      { suppressComputedWatchers: true },
    );
    form.setRow(row);

    for (const widget of this.children) {
      const fieldId = this.getSubWidgetFieldId(widget);
      if (includedFieldIds && (!fieldId || !includedFieldIds.has(fieldId)) && !includedFieldIds.has(widget.uid)) continue;
      const mockWidget = await form.container.addWidget(
        reactive({
          ...deepClone(widget.getSoul()),
          uid: unique()
        }), undefined) as FormElement;

      Object.defineProperty(mockWidget, "originId", {
        get() {
          return widget.uid;
        }
      });
      Object.defineProperty(mockWidget, "field", {
        get: () => {
          if (!widget.field) {
            const field = this.field?.subTableFields?.find(f => f.meta?.uid === widget.uid);
            widget.bindField(field);
          }
          return widget.field;
        }
      });
      Object.defineProperty(mockWidget, "isHidden", {
        get() {
          return widget.isHidden;
        }
      });
      attachMockWidgetReadonlyBridge(mockWidget, widget as FormElement);
      attachMockWidgetRequiredBridge(mockWidget, widget as FormElement);

      if (row.hasOwnProperty(mockWidget.fieldId)) {
        mockWidget.setInputValueNotChanged(deepClone(row[mockWidget.fieldId]));
      } else {
        mockWidget.setInputValueNotChanged(undefined);
      }

      rowEffectScope.run(() => {
        watch(() => {
          const value = mockWidget.inputValue;
          if (value instanceof Date) {
            return {
              lastChangeTime: mockWidget.status?.lastChangeTime,
              value: dayjs(value).format("YYYY-MM-DD HH:mm:ss"),
            };
          }
          if (!value) {
            return {
              lastChangeTime: mockWidget.status?.lastChangeTime,
              value
            };
          }
          return {
            lastChangeTime: mockWidget.status?.lastChangeTime,
            value: deepClone(value)
          };
        }, (value, oldValue) => {
          if (equals(value?.lastChangeTime, oldValue?.lastChangeTime) && equals(value?.value, oldValue?.value)) return;
          if (equals(value?.value, oldValue?.value)) return;
          row[mockWidget.fieldId] = value?.value;
        }, { immediate: true, deep: true });
      });
    }

    if (refreshAggregationWatchers) {
      for (const child of form.children) {
        if (child.type === FormWidgetType.AUTO_COMPUTE) {
          (child as any).refreshAggregationWatchers?.();
        }
      }
    }

    return {
      form,
      dispose: () => {
        rowEffectScope.stop();
        form.destroy();
      }
    };
  }

  public addRow(index?: number, row: Record<string, any> = {}, isManualAdd: boolean = false) {
    if (!this.canAddRows()) return false;

    if(isManualAdd) {
      row.isManualAdd = true;
    }

    if (!row[UUID]) {
      row[UUID] = unique();
    }

    void this.ensureSubSerialNumberFields(row);

    (this as any).applyManualAddRowDefaults?.(row);

    if (index === undefined) {
      this._rows.value.push(row);
    } else {
      this._rows.value.splice(index, 0, row);
    }

    return true;
  }

  public async addRowAsync(index?: number, row: object = {}, isManualAdd: boolean = false): Promise<boolean> {
    if (!this.addRow(index, row, isManualAdd)) return false;

    return new Promise<boolean>((resolve) => {
      const stop = watch(
        () => this._tableData.map(row => row.uid),
        (uuids) => {
          const uuid = row[UUID];
          if (uuid && uuids.find(i => i === uuid)) {
            stop();
            resolve(true);
          }
        },
        { flush: 'post', immediate: true }
      );
    });
  }

  public async batchApplyRows(rows: Record<string, any>[], trace?: SubFormFillTrace) {
    if (!this.watchedRows) {
      this.watchRows();
    }

    const nextRows = rows.map(row => {
      const nextRow = row || {};
      if (!nextRow[UUID]) {
        nextRow[UUID] = unique();
      }
      return nextRow;
    });
    this._dynamicValueCache.clear();
    this._dynamicValueVersions.clear();
    this._dynamicValueDirtyRows.clear();
    this.clearDynamicValueTasks();
    this._dynamicValueGeneration += 1;
    this._rowsSyncVersion.value += 1;
    this._rows.value = nextRows;
    const expectedRows = this.inputValue;
    let resolveTableData = () => {};
    const tableDataPromise = trace
      ? new Promise<void>(resolve => {
        resolveTableData = resolve;
      })
      : undefined;
    const batchSyncPromise = new Promise<void>(resolve => {
      this._pendingRowsSync.push({
        rows: expectedRows,
        resolve,
        tableDataResolve: resolveTableData,
        trace,
      });
    });
    await batchSyncPromise;
    if (tableDataPromise) {
      await tableDataPromise;
    }
    markSubFormStructureChanged(this);
  }

  public deleteRow(index: number) {
    const deletedRow = this._rows.value[index];
    const deleteUuid = deletedRow?.[UUID];

    const rowData = deepClone(this._rows.value);
    const beforeLength = rowData.length;
    rowData.splice(index, 1);
    if (rowData.length === beforeLength) return;

    this._rows.value = rowData;

    if (deleteUuid) {
      this._subSerialNumberFillTasks.delete(deleteUuid);
      this.invalidateDynamicValueCache(String(deleteUuid));
      this._dynamicValueDirtyRows.delete(String(deleteUuid));
      this._rowEffectScopeMap.get(deleteUuid)?.stop();
      this._rowEffectScopeMap.delete(deleteUuid);
      this._subFormRowMap.delete(deleteUuid);
      this._rowChildInitialChangeTimes.delete(String(deleteUuid));
      this._rowInitializationTasks.delete(deleteUuid);
      this._initializedRowUids.delete(deleteUuid);
    }

    markSubFormStructureChanged(this);
  }

  public deleteRows(indexs: number[]) {
    const deleteIndexSet = new Set(
      indexs.filter(index => index >= 0 && index < this._rows.value.length)
    );
    if (!deleteIndexSet.size) return;

    const deleteUuids = [...deleteIndexSet].map(i => this._rows.value[i]?.[UUID]).filter(Boolean);

    const rowData = deepClone(this._rows.value);
    const filteredRows = rowData.filter((_, index) => !deleteIndexSet.has(index));

    this._rows.value = filteredRows;

    deleteUuids.forEach(uuid => {
      this._subSerialNumberFillTasks.delete(uuid);
      this.invalidateDynamicValueCache(String(uuid));
      this._dynamicValueDirtyRows.delete(String(uuid));
      this._rowEffectScopeMap.get(uuid)?.stop();
      this._rowEffectScopeMap.delete(uuid);
      this._subFormRowMap.delete(uuid);
      this._rowChildInitialChangeTimes.delete(String(uuid));
      this._rowInitializationTasks.delete(uuid);
      this._initializedRowUids.delete(uuid);
    });

    markSubFormStructureChanged(this);
  }

  // 目前只有选择数据使用子表填充（覆盖填充对应字段）
  async onFillData(value: any[]) {
    this.inputValue = []
    await nextTick()
    for(const row of value) {
      const nextRow = {
        ...row,
        updateLastChangeTime: Date.now(),
        isManualAdd: true,
      };
      if (!nextRow[UUID]) {
        nextRow[UUID] = unique();
      }
      this.applyManualAddRowDefaults(nextRow, {
        allowPopulatedRow: true,
      });
      this.addRow(undefined, nextRow, true)
    }
  }

  get relatedTableInfo(): RelatedTableInfo {
    const subTableUID = this.field?.meta?.extra?.subTableUID;
    if (!subTableUID) return {};
    const table = this.getTable(subTableUID);
    const relatedFields = table.fields.filter(f => f.meta?.subType === "related" && f.meta?.extra?.relatedTableUID);
    return relatedFields.reduce((prev, field) => {
      const relatedTableUID = field.meta.extra.relatedTableUID;
      const relatedTableFields = this.getTable(relatedTableUID)?.fields || [];
      prev[field.uid] = {
        relatedTableUID,
        relatedTableFields,
      };
      return prev;
    }, {});
  }

  getRelatedRows(fieldUID: FieldUID, uuids: string[]): object[] {
    const relatedTableInfo = this.relatedTableInfo[fieldUID];
    if (!relatedTableInfo) return [];
    const uuidField = getUUIDSystemField(relatedTableInfo.relatedTableFields);
    const {rows} = this._relatedTableData.value[fieldUID] ?? {};
    return uuids?.map(uuid => rows?.find(row => row[uuidField.uid] === uuid))?.filter(Boolean) || [];
  }
  getRelatedRowKey(fieldUID: FieldUID): FieldUID {
    const relatedTableInfo = this.relatedTableInfo[fieldUID];
    const uuidField = getUUIDSystemField(relatedTableInfo.relatedTableFields);
    return uuidField.uid;
  }
  getRelatedTitleFieldUID(fieldUID: FieldUID): FieldUID {
    const relatedTableInfo = this.relatedTableInfo[fieldUID];
    return relatedTableInfo.relatedTableFields.find(f => f.meta.name === SystemField.DATA_TITLE)?.uid;
  }
  getRelatedTableUID(fieldUID: FieldUID): OptionTableUID {
    const relatedTableInfo = this.relatedTableInfo[fieldUID];
    return relatedTableInfo.relatedTableUID;
  }

  private _selectedWidgets?: Ref<FormElement[]>;

  setSelectedWidgetsRef(ref: Ref<FormElement[]>) {
    this._selectedWidgets = ref;
  }

  selectWidgetByUid(uid: string) {
    const target = this.children.find(c => c.uid === uid);
    if (target && this._selectedWidgets) {
      this._selectedWidgets.value = [target];
      target.dom.closest(".column")?.scrollIntoView();
    }
  }

  public get childrenOption() {
    return this.getOption<WidgetSoul>("form-children-array-option");
  }

  public set childrenOption(value: any) {
    this.setOption("form-children-array-option", value);
  }

  resolveFormSetting() {
    const extra = {
      submitValid: this.getOption("submit-valid"),
    }

    return {
      ...super.resolveFormSetting(),
      extra: {
        ...(super.resolveFormSetting()?.extra || {}),
        ...extra,
      }
    };
  }

  // 单个条件的计算函数
  private isConditionMet(cond: FormCondition, type: VisibleType): boolean {
    if (cond.uid.split(".").length > 1) {
      const fieldId = this.getChildElement(cond.uid.split(".")[1]).fieldId;
      const fieldValues = this.rows?.map(row => row[fieldId]) || [];
      // 如果是显示类型，则只要有一个满足条件，则显示，否则隐藏
      return type === VisibleType.SHOW ? fieldValues.some(value => meetRuleFuncs[cond.func]?.(value, cond.value)) : fieldValues.every(value => meetRuleFuncs[cond.func]?.(value, cond.value));
    } else {
      const fieldValue = this.topForm.getChildElement(cond.uid)?.inputValue;
      const targetValue = cond.value;
      return meetRuleFuncs[cond.func]?.(fieldValue, targetValue);
    }
  }

  private controlFieldVisible(cond: FormCondition): boolean {
    let widget: FormElement;
    if (cond.uid.split(".").length > 1) {
      widget = this.getChildElement(cond.uid.split(".")[1]);
    } else {
      widget = this.topForm.getChildElement(cond.uid);
    }

    // 如果组件自身隐藏属性开启，则自己隐藏不影响被控组件隐藏
    if (!widget.getOption<boolean>("is-hidden")) {
      return !widget.isHidden;
    } else {
      return true;
    }
  }

  isChildShow(widget: Widget) {
    if (!this.subFieldsVisibleRules) return true;
    const widgetId = widget.uid;

    // 遍历所有规则，找出包含该组件的只有主表条件的规则项
    const matchedRules = this.subFieldsVisibleRules.filter(rule =>
      rule.widgetIds.includes(widgetId)
    );

    if (isEmpty(matchedRules)) {
      // 没有规则，默认显示
      return true;
    }

    const showRules = matchedRules.filter(rule => rule.visibleType !== VisibleType.HIDE);
    const hideRules = matchedRules.filter(rule => rule.visibleType === VisibleType.HIDE);

    for (const rule of showRules) {
      const result = rule.logic === LogicalOperator.AND
        ? rule.conditions.every(cond => this.isConditionMet(cond, rule.visibleType) && this.controlFieldVisible(cond))
        : rule.conditions.some(cond => this.isConditionMet(cond, rule.visibleType) && this.controlFieldVisible(cond));

      if (result) {
        return true;
      }
    }

    for (const rule of hideRules) {
      const result = rule.logic === LogicalOperator.AND
        ? rule.conditions.every(cond => this.isConditionMet(cond, rule.visibleType) && this.controlFieldVisible(cond))
        : rule.conditions.some(cond => this.isConditionMet(cond, rule.visibleType) && this.controlFieldVisible(cond));

      if (result) {
        return false;
      }
    }

    return (!isEmpty(showRules) && !isEmpty(hideRules)) ? false : isEmpty(hideRules) ? false : true;
  }

   override getOption<T extends OptionValue>(paths: string | string[], options?: GetOptionOptions): T {
    if (paths === "aggregation-rules") {
      const option = (super.getOption<T>(paths, options) || []) as AggregationRule[];
      const children = this.children.filter((item) => {
        let isSystem
        if(item.field) {
          isSystem = !isSystemField(item.field)
        } else {
          isSystem = true
        }
        return isSystem && item.type === 'widget.form.numberInput'
      });
      return children.map((item) => {
        return {
          field: item.uid,
          type: option.find((i) => i.field === item.uid)?.type || AggregationType.NOTAGGRE
        }
      }) as unknown as T;
    }
    return super.getOption<T>(paths, options);
  }
}
