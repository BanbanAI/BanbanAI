import { FormWidgetType, FormConditionValueType, FormElementConfiguration, RuleFunc, RuleFuncValue, AggregationType } from "@common/types/nocode";
import { calculateAggregation } from "@renderer/utils/autoCompute";
import { formatNumberWithSeparator } from "@common/utils/amount";
import { isNocodeFormData, SystemField, isSystemField, transformCondition } from "@common/utils/connection";
import { replaceByFormula, findIdByFormula, collectFormulaFieldUsages, createFormulaRuntimeByWidget, getFormulaStr } from "@common/utils/formula";
import { SelectIdOfForm, FormLinkageCondition, SelectChoice, DefinedOptions, LogicalOperator } from "@renderer/b2/types";
import { AbstractForm, FormElement, SubFormRow } from "@renderer/b2/controllers/form";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { Ref, ref, watch, nextTick, defineAsyncComponent } from "vue";
import { isEmpty } from "@common/utils/object";
import { Field } from "@common/types/project";
import { buildFormulaValueMap, getFormulaFieldValues, processFormulaResult } from "@renderer/widgets/form/form/function";
import { useFormulaWatcher } from "@renderer/widgets/form/form/useFormulaWatcher";
import { FormMode } from "../_common/type";
import { ElInput } from "element-plus";
import { debounce } from "lodash";
import { FilterRule } from "./types";
import { resolveDataSourceSelectionMeta } from "../_common/page-permission";

export class AutoCompute extends FormElement {
  static resource = resource as any;
  private _inputInstance: InstanceType<typeof ElInput> | null = null;
  private aggregationConditionWatchStops: Array<() => void> = [];
  private triggerAggregationCalculation = debounce(() => {
    void this.calculateQuickComputeValue();
  }, 300);

  set inputInstance(instance: InstanceType<typeof ElInput> | null) {
    this._inputInstance = instance;
  }

  initAfterConstructor() {
    super.initAfterConstructor();
    const suppressComputedWatchers = (this.form as any)?.suppressComputedWatchers;

    if (this.computeType === "formula" && this.formulaValue && !this.isEditable && !suppressComputedWatchers) {
      this.effectScope.run(() => {
        const stop = watch(() => this.getBoard().isProjectReady, (value) => {
          if (!value) return;
          this.watchDefaultFormula();
          nextTick(() => {
            stop();
          })
        }, { immediate: true })
      });
    }

    if (!this.isEditable && this.computeType === "quickCompute" && !suppressComputedWatchers) {
      this.watchAggregation();
    }
  }
  // isCreateField() {
  //   return false;
  // }

  get isEditMode() {
    return this.getBoard().formMode === FormMode.Edit;
  }
  private formulaWatcher: any;

  private get currentSubFormRow() {
    if (this.parent instanceof SubFormRow) {
      return this.parent as SubFormRow;
    }

    if (this.form instanceof SubFormRow) {
      return this.form as SubFormRow;
    }

    return undefined;
  }

  private findElementByUidOrFieldId(elements: FormElement[] = [], targetId?: string) {
    if (!targetId) return undefined;

    return elements.find((item: FormElement) => item.uid === targetId)
      ?? elements.find((item: FormElement) => item.fieldId === targetId);
  }

  private getTopFormComparisonElement(comparisonUid?: string) {
    return this.findElementByUidOrFieldId(this.topForm?.children as FormElement[], comparisonUid);
  }

  private getComparisonFormElement(comparisonUid?: string) {
    if (!comparisonUid) return undefined;
    const currentSubFormRow = this.currentSubFormRow;

    if (currentSubFormRow) {
      const [subFormFieldId, subFieldId] = comparisonUid.split(".");
      if (subFieldId) {
        const currentSubForm = currentSubFormRow.parent as FormElement | undefined;
        if (currentSubForm?.fieldId && ![currentSubForm.uid, currentSubForm.fieldId].includes(subFormFieldId)) {
          return undefined;
        }

        return this.findElementByUidOrFieldId(currentSubFormRow.children as FormElement[], subFieldId);
      }

      return this.getTopFormComparisonElement(comparisonUid);
    }

    return this.findElementByUidOrFieldId(this.form.children as FormElement[], comparisonUid)
      ?? this.getTopFormComparisonElement(comparisonUid);
  }

  private normalizeFormulaResult(value: any) {
    const processed = processFormulaResult(value, this.fieldType as any);
    const decimal = this.decimal || 0;
    return typeof processed === "number"
      ? parseFloat(
          processed.toFixed(this.numberType === "percent" ? decimal + 2 : decimal)
        )
      : processed;
  }

  private resolveConditionRuntimeValue(condition: FormLinkageCondition) {
    if (condition.type !== FormConditionValueType.FORM || !condition.comparisonUid) {
      return condition.value;
    }

    if (condition.comparisonOfForm === SelectIdOfForm.LINKAGE) {
      const allRelatedForms = this.topForm.children
        .filter(child => child.getSoul().type === FormWidgetType.RELATED_DATA)
        .filter((relatedForm: any) => {
          const relatedTable = this.getTable(relatedForm.connectionTable);
          return relatedTable.fields.find(f => f.uid === condition.comparisonUid);
        });
      const relatedValues = allRelatedForms
        .map((relatedData: any) => relatedData.getValue(condition.comparisonUid))
        .flat(Infinity);

      return relatedValues.length > 0 ? [...new Set(relatedValues)] : condition.value;
    }

    const comparisonForm = this.getComparisonFormElement(condition.comparisonUid);
    return comparisonForm ? comparisonForm.inputValue : condition.value;
  }

  get runtimeDataFilter() {
    if (!this.dataFilter) return this.dataFilter;

    return {
      ...this.dataFilter,
      conditions: this.dataFilter.conditions.map(condition => ({
        ...condition,
        value: this.resolveConditionRuntimeValue(condition),
      })),
    };
  }

  private commitInputValue(value: number | string | null | undefined, options: { updateLastChangeTime?: boolean } = {}) {
    const { updateLastChangeTime = true } = options;
    if (Object.is(this._inputValue.value, value)) {
      return value;
    }

    this._inputValue.value = value as any;
    if (updateLastChangeTime) {
      this.updateLastChangeTime();
    }

    return value;
  }

  watchDefaultFormula(isComputeOnce = false, callback?: (value: any) => void) {
    this.effectScope.run(() => {
      this.formulaWatcher = useFormulaWatcher({
        formElement: this,
        formula: this.formulaValue,
        fieldType: this.fieldType,
        isEditMode: this.isEditMode,
        onBeforeCalculate: () => {
          if (
            (this.form as SubFormRow)?.form?.getOption("deduplication-aggregation") &&
            (this.form as SubFormRow)?.form?.getOption("aggregation-order") === "formula"
          ) {
            return false;
          }
        },
        normalizeResult: (value) => this.normalizeFormulaResult(value),
        onApplyResult: (value) => {
          this.commitInputValue(value, { updateLastChangeTime: false });
        },
        onAfterCalculate: () => {
          if (isComputeOnce) {
            this.removeFormulaWatcher();
            callback?.(this.inputValue);
          }
        }
      });
    });
  }
  // 移除公式监听器
  private removeFormulaWatcher() {
    if (this.formulaWatcher) {
      this.formulaWatcher();
    }
  }

  private clearAggregationConditionWatchers() {
    this.triggerAggregationCalculation.cancel();
    this.aggregationConditionWatchStops.forEach(stop => stop());
    this.aggregationConditionWatchStops = [];
  }

  public refreshAggregationWatchers() {
    this.clearAggregationConditionWatchers();
    if (this.computeType !== "quickCompute") return;

    this.bindAggregationConditionWatchers();
    this.triggerAggregationCalculation();
  }

  private bindAggregationConditionWatchers() {
    if (isEmpty(this.dataFilter?.conditions)) return;

    this.effectScope.run(() => {
      this.dataFilter.conditions.forEach(condition => {
        if (condition.type !== FormConditionValueType.FORM || !condition.comparisonUid) {
          return;
        }

        if (condition.comparisonOfForm === SelectIdOfForm.LINKAGE) {
          const allRelatedForms = this.topForm.children
            .filter(child => child.getSoul().type === FormWidgetType.RELATED_DATA)
            .filter((relatedForm: any) => {
              const relatedTable = this.getTable(relatedForm.connectionTable);
              return relatedTable.fields.find(f => f.uid === condition.comparisonUid);
            });

          const stop = watch(() => {
            return allRelatedForms.map((relatedData: any) => {
              return (relatedData as any).getValue(condition.comparisonUid);
            });
          }, () => {
            this.triggerAggregationCalculation();
          }, { deep: true, immediate: true });

          this.aggregationConditionWatchStops.push(stop);
          return;
        }

        const stop = watch(() => {
          const widget = this.getComparisonFormElement(condition.comparisonUid);
          return {
            forceWatch: this.topForm?.forceWatch?.value,
            widgetUid: widget?.uid,
            value: widget?.inputValue,
            lastChangeTime: widget?.status?.lastChangeTime,
          };
        }, () => {
          this.triggerAggregationCalculation();
        }, { deep: true, immediate: true });

        this.aggregationConditionWatchStops.push(stop);
      });
    });
  }

  private async calculateQuickComputeValue() {
    if (!this.getBoard().isProjectReady || this.computeType !== "quickCompute") {
      return;
    }

    const dataSourceMeta = this.getOtherTableMeta();
    if (!dataSourceMeta.nocodeId || (!dataSourceMeta.isCurrentConnection && !dataSourceMeta.hasViewPermission)) {
      this.inputValue = null;
      return;
    }

    this.inputValue = await calculateAggregation({
      otherTableFieldUID: this.otherTableFieldUID,
      dataFilter: this.runtimeDataFilter as FilterRule,
      nocodeId: dataSourceMeta.nocodeId,
      aggregateType: this.aggregateType as AggregationType,
      decimal: this.decimal
    });
  }

  private watchAggregation() {
    this.effectScope.run(() => {
      watch(() => {
        return {
          isProjectReady: this.getBoard().isProjectReady,
          computeType: this.computeType,
          otherTableField: this.getOption<string>("other-table-field"),
          aggregateType: this.aggregateType,
          dataFilter: this.dataFilter,
          decimal: this.decimal,
          forceWatch: this.topForm?.forceWatch?.value,
        };
      }, () => {
        this.refreshAggregationWatchers();
      }, { deep: true, immediate: true });
    });
  }

  public handleFormatValue() {
    const formulaFieldMap = collectFormulaFieldUsages(this.formulaValueStr);
    const dependencyMap = getFormulaFieldValues(this as any, findIdByFormula(this.formulaValueStr), formulaFieldMap)
    const valueMap = buildFormulaValueMap({
      formElement: this as any,
      commonDeps: dependencyMap.formulaDeps,
      queryDeps: dependencyMap.queryDeps,
      formulaFieldMap,
    });
    const replaceCursor: Record<string, number> = {};
    const formula = replaceByFormula(this.formulaValueStr, (keys) => {
      const id = keys.join('.');
      const values = valueMap[id];
      if (Array.isArray(values)) {
        const index = replaceCursor[id] ?? 0;
        replaceCursor[id] = index + 1;
        return values[index] ?? values[0] ?? null;
      }
      if (values !== undefined) return values;
      return null;
    });

    try {
      const formulaRuntime = createFormulaRuntimeByWidget(this);
      const value = formulaRuntime.evaluate(formula);
      const nextValue = this.normalizeFormulaResult(value);
      return this.commitInputValue(nextValue);
    } catch (err) {
      return;
    }
  }

  // 千分符数字
  public getNumberWithCommas(num: number | string): string {
    return formatNumberWithSeparator(
      num,
      {
        decimalPlaces: this.decimal,
        thousandSeparator: this.thousandSeparator,
        decimalPadding: this.isDecimalPadding
      }
    );
  }

  get defaultValue() {
    return null;
  }

  protected _inputValue: Ref<number | string> = ref();
  public get inputValue() {
    let value = this._inputValue.value;
    return value;
  }
  public set inputValue(value) {
    this.commitInputValue(value);
  }

  public clearValue() {
    this.inputValue = undefined;
  }

  get currentValue() {
    return this.inputValue;
  }

  static defineOptions(): DefinedOptions[] {
    return [
      {
        style: {
          basicStyle: {
            children: [
              {
                name: "width-subform",
                default: 200,
              },
              {
                name: "placeholder",
                alias: i18next.t("tipText"),
                default: i18next.t("pleaseInput"),
                type: "string",
              },
              // 返回结果格式
              {
                name: "result-format",
                alias: i18next.t("computeResultFormat"),
                type: "select(radioGroup)",
                default: "number",
                selectChoices: [
                  { label: i18next.t("number"), value: "number" },
                  { label: i18next.t("text"), value: "text" },
                ],
              },
              // > 数字
              {
                name: "number-type",
                alias: i18next.t("numberFormat"),
                type: "select",
                selectChoices: [
                  { label: i18next.t("num"), value: "number" },
                  { label: i18next.t("percent"), value: "percent" },
                ],
                default: "number",
                visible: (widget: AutoCompute) => {
                  return widget.resultFormat === "number";
                }
              },
              {
                name: "use-decimal",
                alias: i18next.t("useDecimal"),
                type: "boolean",
                default: true,
                visible: false,
              },
              {
                name: "decimal",
                alias: i18next.t("decimalDigits"),
                type: "number",
                default: 2,
                visible: (widget: AutoCompute) => {
                  return widget.resultFormat === "number" && widget.getOption<boolean>("use-decimal");
                }
              },
              {
                name: "decimal-padding",
                alias: i18next.t("decimalPadding"),
                type: "boolean",
                default: false,
                visible: (widget: AutoCompute) => {
                  return widget.resultFormat === "number" && widget.getOption<boolean>("use-decimal");
                }
              },
              {
                name: "thousand-separator",
                alias: i18next.t("thousandSeparator"),
                type: "boolean",
                default: false,
                visible: (widget: AutoCompute) => {
                  return widget.resultFormat === "number";
                }
              },
              {
                name: "unit-position",
                alias: i18next.t("unitFormat"),
                type: "select(radioGroup)",
                default: "suffix",
                selectChoices: [
                  { label: i18next.t("prefix"), value: "prefix" },
                  { label: i18next.t("suffix"), value: "suffix" },
                ],
                visible: (widget: AutoCompute) => {
                  return widget.resultFormat === "number";
                }
              },
              {
                name: "unit",
                alias: i18next.t("unit"),
                type: "string",
                default: "",
                visible: (widget: AutoCompute) => {
                  return widget.resultFormat === "number";
                }
              },

              // > 文本

              // 计算类型
              {
                name: "compute-type",
                alias: i18next.t("computeType"),
                type: "select(radioGroup)",
                default: "quickCompute",
                selectChoices: [
                  { label: i18next.t("quickCompute"), value: "quickCompute" },
                  { label: i18next.t("formulaEdit"), value: "formula" },
                ],
              },
              // > 快捷计算
              {
                name: "other-table-field", // 被计算的字段
                alias: i18next.t("computeField"),
                type: "select(tree,onlyCheckLeaf)",
                placeholder: i18next.t("plsSelectField"),
                default: null,
                selectChoices: (widget: AutoCompute) => {
                  const systemFieldNameOfFilter = [ SystemField.CREATE_TIME, SystemField.UPDATE_TIME, SystemField.CREATE_OWNER, SystemField.DATA_OWNER ]
                  const connections = widget.getBoard().getConnections().filter(c => isNocodeFormData(c));
                  if (!connections.length) return [];

                  const canView = (connectionUID: string, tableUID: string) => {
                    return connectionUID !== widget.topForm?.tableUID?.[0] || (widget.topForm as any)?.canReadLayerDataSync?.(tableUID);
                  };

                  const buildOptions = (connection) => connection.tables?.filter(t => {
                    return isEmpty(t.meta?.extra?.primaryTable) && canView(connection.uid, t.uid);
                  }).map(t => {
                    const { baseFields, subFields } = t.fields.reduce<{ baseFields: Field[], subFields: Field[] }>((prev, f) => {
                      if (isSystemField(f) && !systemFieldNameOfFilter.includes(f.meta.name as SystemField)) return prev;
                      if (f.meta?.uid === widget.uid) return prev;
                      if (f.meta.subType === "subForm") {
                        prev.subFields.push(f);
                      } else {
                        prev.baseFields.push(f);
                      }
                      return prev;
                    }, { baseFields: [], subFields: [] });
                    const baseOptions = baseFields.filter(f => !systemFieldNameOfFilter.includes(f.meta.name as SystemField)).map(f => ({ label: f.alias, value: `${connection.uid}.${t.uid}.${f.uid}` }));
                    const showSystemOptions = baseFields.filter(f => systemFieldNameOfFilter.includes(f.meta.name as SystemField)).map(f => ({ label: f.alias, value: `${f.uid}` }));
                    const subOptions = subFields.map(f => {
                      const subTable = connection.tables.find(t => t.uid === f.meta?.extra?.subTableUID?.[1]);
                      return subTable?.fields?.filter(f => !isSystemField(f)).map(sf => {
                        return {
                          label: `${f.alias}.${sf.alias}`,
                          value: `${f.meta.extra?.subTableUID?.join(".")}.${sf.uid}`,
                        }
                      }) ?? [];
                    })
                    const isCurrent = t.uid === widget.topForm?.tableUID[1];
                    return {
                      label: isCurrent ? i18next.t("currentForm") : t.alias,
                      value: t.uid,
                      isCurrent,
                      children: [...baseOptions, ...subOptions.flat(Infinity), ...showSystemOptions],
                    };
                  }).filter(option => option.children?.length > 0) || [];

                  if (connections.length === 1) {
                    return buildOptions(connections[0]).sort((a, b) => b.isCurrent - a.isCurrent);
                  }

                  return connections.map(connection => {
                    const options = buildOptions(connection).sort((a, b) => b.isCurrent - a.isCurrent);
                    return {
                      label: connection.name,
                      value: connection.uid,
                      children: options,
                      isCurrent: options.some(item => item.isCurrent),
                    };
                  }).filter(option => option.children?.length > 0).sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));
                },
                visible: (widget: AutoCompute)=>{
                  return widget.computeType === "quickCompute";
                },
              },
              {
                name: "option-filter-use-group-option",
                alias: i18next.t("useRelationValue"),
                type: "boolean",
                default: true,
                visible: false,
              },
              {
                name: "data-filter",
                alias: i18next.t("dataFilter"),
                type: "dialog",
                default: null,
                dialog: {
                  component: defineAsyncComponent(() => import("@renderer/views/nocode/components/global/FormDataFilterDialog.vue")),
                  buttonText(element) {
                    const value = element.getOption("data-filter");
                    return isEmpty(value) || (value as any).conditions?.length === 0 ? i18next.t("setCondition") : i18next.t("hasCondition");
                  },
                  buttonStyle(element, paths) {
                    const value = element.getOption("data-filter");
                    return isEmpty(value) || (value as any).conditions?.length === 0 ? {} : { color: 'var(--color-primary)' }
                  },
              },
              visible: (widget: AutoCompute)=>{
                const connections = widget.getBoard().getConnections();
                const [connectionUID, tableUID] = widget.otherTableFieldUID;
                const connection = connections.find(c => c.uid === connectionUID && isNocodeFormData(c));
                if (!connection) return false;
                const mainTable = connection.tables.find(t => t.uid === tableUID);
                return widget.computeType === "quickCompute" && widget.getOption("other-table-field") && mainTable !== undefined;
              },
              },
              {
                name: "aggregate-type",
                alias: i18next.t("aggregateType"),
                type: "select",
                placeholder: i18next.t("plsSelectAggregateType"),
                default: AggregationType.SUM,
                selectChoices: (widget: AutoCompute) => {
                  let aggregationOptionText: Record<string, string> = {};
                  if (widget.resultFormat === "number") {
                    aggregationOptionText = {
                      [AggregationType.SUM]: i18next.t('aggregation.sum'),
                      [AggregationType.AVE]: i18next.t('aggregation.ave'),
                      [AggregationType.MAX]: i18next.t('aggregation.max'),
                      [AggregationType.MIN]: i18next.t('aggregation.min'),
                      // [AggregationType.FILLED]: i18next.t('aggregation.filled'),
                      // [AggregationType.UNFILLED]: i18next.t('aggregation.notFilled'),
                      [AggregationType.COUNT]: i18next.t('aggregation.count'),
                    }
                  } else {
                    aggregationOptionText = {
                      // [AggregationType.FILLED]: i18next.t('aggregation.filled'),
                      // [AggregationType.UNFILLED]: i18next.t('aggregation.notFilled'),
                      [AggregationType.COUNT]: i18next.t('aggregation.count'),
                    }
                  }
                  const options = Object.entries(aggregationOptionText).map(([key, value]) => ({ label: value, value: key }));
                  return options;
                },
                visible: (widget: AutoCompute)=>{
                  return widget.computeType === "quickCompute";
                },
              },
              // > 公式编辑
              {
                name: "compute-formula",
                alias: "",
                type: "dialog",
                dialog: {
                  component: defineAsyncComponent(() => import("@renderer/views/nocode/components/global/table/components/formula/FormDefaultValueFormulaDialog.vue")),
                  buttonText: (widget: AutoCompute)=>{
                    if (widget.formulaValue) {
                      return i18next.t("formulaSet");
                    }
                    return i18next.t("editFormula");
                  },
                  buttonStyle(widget: AutoCompute, paths) {
                    const value = widget.formulaValue;
                    return (isEmpty(value) || value === "") ? {} : { color: 'var(--color-primary)' }
                  },
                },
                visible: (widget: AutoCompute)=>{
                  return widget.computeType === "formula";
                },
              }
            ],
          },
          fieldProperty: {
            children: [
              {
                name: "is-readonly",
                visible: false
              },
            ],
          },
          fieldsControl: {
            children: [
              {
                name: "field-filling",
                visible: false
              }
            ]
          },
          scanInput: {
            visible: false,
          },
          validation: {
            visible: false,
          },
          linkForm: {
            visible: false,
          }
        },
      }, ...super.defineOptions()
    ];
  }

  get placeholder() {
    return this.getOption<string>("placeholder");
  }

  get resultFormat() {
    return this.getOption<"number"|"text">("result-format");
  }

  get numberType() {
    if (this.resultFormat === "text") return "number";
    return this.getOption<string>("number-type");
  }

  get decimal() {
    if (this.resultFormat === "text") return 0;
    return this.getOption<number>("decimal");
  }

  get isDecimalPadding() {
    return this.getOption<boolean>("decimal-padding");
  }

  get thousandSeparator(): string {
    if (this.resultFormat === "text") return "";
    return this.getOption("thousand-separator") ? "," : "";
  }

  get isThousandSeparator(): boolean {
    if (this.resultFormat === "text") return false;
    return this.getOption("thousand-separator");
  }

  get unit() {
    if (this.resultFormat === "text") return "";
    return this.getOption<string>("unit");
  }

  get unitPosition() {
    return this.getOption<string>("unit-position");
  }

  get computeType() {
    return this.getOption<"quickCompute"|"formula">("compute-type");
  }

  private getOtherTableMeta() {
    return resolveDataSourceSelectionMeta(
      this.getBoard(),
      this.otherTableFieldUID?.slice(0, 2),
      this.topForm?.tableUID?.[0],
      { includeSchemaOnly: true },
    );
  }

  private getOtherTableConnection() {
    return this.getOtherTableMeta().connection;
  }

  private getOtherTableTable() {
    return this.getOtherTableMeta().table;
  }

  get connectionTableFields() {
    if (!isEmpty(this.otherTableFieldUID)) {
      const table = this.getOtherTableTable();
      return table?.fields || [];
    }
    return [];
  }

  get otherTableFieldUID() {
    const value = this.getOption<string>("other-table-field");
    return value?.split(".") || [];
  }

  get dataFilter() {
    return this.getOption<FilterRule>("data-filter");
  }

  get aggregateType() {
    return this.getOption<AggregationType>("aggregate-type");
  }

  get formulaValue() {
    return this.getOption<string>("compute-formula");
  }

  get formulaValueStr() {
    return getFormulaStr(this.formulaValue);
  }

  get defaultName() {
    return i18next.t("defaultName");
  }

  get fieldType() {
    if (this.resultFormat === "number") {
      return "number";
    } else if (this.resultFormat === "text") {
      return "string";
    }
  }

  resolveFormSetting() {
    const extra = {
      isNumber: this.resultFormat === "number",
      isPercent: this.resultFormat === "number" && this.numberType ===  "percent",
      completeZero: this.isDecimalPadding,
      decimalPlaces: this.decimal,
      thousandSeparator: this.thousandSeparator,
      unitPosition: this.resultFormat === "number" ? this.unitPosition : "",
      unit: this.resultFormat === "number" ? this.unit : "",

      aggregateType: this.aggregateType,
      otherTableFieldUID: this.otherTableFieldUID,
      dataFilter: this.dataFilter,
      computeType: this.computeType,
      formula: this.formulaValue,
    }

    return {
      ...super.resolveFormSetting(),
      subType: "autoCompute",
      extra: {
        ...(super.resolveFormSetting()?.extra || {}),
        ...extra,
      }
    };
  }

  get isReadonly() {
    return true;
  }

  getConfigurations(): FormElementConfiguration {
    let funcInfo = {};
    let editFuncInfo = {};
    if (this.resultFormat === "number") {
      funcInfo = {
        [RuleFunc.EQUAL]: RuleFuncValue.NUMBER,
        [RuleFunc.NOT_EQUAL]: RuleFuncValue.NUMBER,
        [RuleFunc.GT]: RuleFuncValue.NUMBER,
        [RuleFunc.GTE]: RuleFuncValue.NUMBER,
        [RuleFunc.LT]: RuleFuncValue.NUMBER,
        [RuleFunc.LTE]: RuleFuncValue.NUMBER,
        [RuleFunc.BETWEEN]: RuleFuncValue.RANGE,
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
      };
      editFuncInfo = {
        [RuleFunc.EQUAL]: RuleFuncValue.NUMBER,
        [RuleFunc.NOT_EQUAL]: RuleFuncValue.NUMBER,
        [RuleFunc.GT]: RuleFuncValue.NUMBER,
        [RuleFunc.GTE]: RuleFuncValue.NUMBER,
        [RuleFunc.LT]: RuleFuncValue.NUMBER,
        [RuleFunc.LTE]: RuleFuncValue.NUMBER,
        [RuleFunc.BETWEEN]: RuleFuncValue.RANGE,
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
      }
    } else {
      // text
      funcInfo = {
        [RuleFunc.EQUAL]: RuleFuncValue.SELECT,
        [RuleFunc.NOT_EQUAL]: RuleFuncValue.SELECT,
        [RuleFunc.IN]: RuleFuncValue.SELECT_MULTIPLE,
        [RuleFunc.NOT_IN]: RuleFuncValue.SELECT_MULTIPLE,
        [RuleFunc.CONTAIN]: RuleFuncValue.STRING,
        [RuleFunc.NOT_CONTAIN]: RuleFuncValue.STRING,
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
      };
      editFuncInfo = {
        [RuleFunc.EQUAL]: RuleFuncValue.STRING,
        [RuleFunc.NOT_EQUAL]: RuleFuncValue.STRING,
        [RuleFunc.CONTAIN]: RuleFuncValue.STRING,
        [RuleFunc.NOT_CONTAIN]: RuleFuncValue.STRING,
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.IN]: RuleFuncValue.TAGS,
        [RuleFunc.NOT_IN]: RuleFuncValue.TAGS,
      }
    }
    return {
      subType: this.resultFormat === "number" ? "number" : "text",
      funcInfo,
      // 编辑表单时使用的筛选判断条件
      editFuncInfo,
      aggregationInfo: []
    };
  }

  command(cmd: string) {
    if (cmd === "focus") {
      this._inputInstance?.focus();
    } else if (cmd === "select") {
      this._inputInstance?.select();
    }
  }
}

