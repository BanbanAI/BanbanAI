import { formatNumberWithSeparator, truncateNumber } from "@common/utils/amount";
import { FormElementConfiguration, RuleFunc, RuleFuncValue, AggregationType } from "@common/types/nocode";
import { replaceByFormula, findIdByFormula, collectFormulaFieldUsages, FormulaConfig, createFormulaRuntimeByWidget, getFormulaStr } from "@common/utils/formula";
import { DefinedOptions } from "@renderer/b2/types";
import { FormElement, SubFormRow } from "@renderer/b2/controllers/form";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { nextTick, Ref, ref, watch, defineAsyncComponent } from "vue";
import { isEmpty } from "@common/utils/object";
import { buildFormulaValueMap, getFormulaFieldValues, processFormulaResult } from "@renderer/widgets/form/form/function";
import { useFormulaWatcher } from "@renderer/widgets/form/form/useFormulaWatcher";
import { FormMode } from "../_common/type";
import { ElInput } from "element-plus";
import { getDefaultQuickComputeAggregateChoices, getDefaultQuickComputeAggregateType, getDefaultQuickComputeDataFilter, getDefaultQuickComputeFieldChoices, getDefaultQuickComputeOtherTableFieldUID, getDefaultQuickComputeType, isDefaultQuickComputeDataFilterVisible, watchDefaultQuickComputeValue } from "../_common/defaultQuickCompute";

export class NumberInput extends FormElement {
  static resource = resource as any;
  protected _inputValue: Ref<number> = ref();
  private _inputInstance: InstanceType<typeof ElInput> | null = null;

  set inputInstance(instance: InstanceType<typeof ElInput> | null) {
    this._inputInstance = instance;
  }

  initAfterConstructor() {
    super.initAfterConstructor();
    const suppressComputedWatchers = (this.form as any)?.suppressComputedWatchers;

    if (this.defaultType === "formula" && !this.isEditable && !suppressComputedWatchers) {
      const stop = watch(() => this.getBoard().isProjectReady, async (value) => {
        if (value) {
          if (this.defaultComputeType === "quickCompute") {
            this.watchDefaultQuickCompute();
          } else if (this.defaultFormulaValueStr) {
            this.watchDefaultFormula();
          }
          nextTick(() => {
            stop();
          })
        }
      }, { immediate: true })
    }
  }

  get isEditMode() {
    return this.getBoard().formMode === FormMode.Edit;
  }


  private normalizeNumber(value: number, decimalPlaces: number) {
    if (!Number.isFinite(value)) {
      return value;
    }

    if (this.isDecimalTruncate) {
      return truncateNumber(value, decimalPlaces);
    }

    return parseFloat(value.toFixed(decimalPlaces));
  }

  private normalizeFormulaResult(value: any) {
    const processed = processFormulaResult(value, this.fieldType as any);
    if (typeof processed !== "number") {
      return processed;
    }

    const decimal = this.decimal || 0;
    return this.normalizeNumber(
      processed,
      this.numberType === "percent" ? decimal + 2 : decimal
    );
  }

  private watchDefaultFormula() {
    this.effectScope.run(() => {
      useFormulaWatcher({
        formElement: this,
        formula: this.defaultFormulaValue,
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
          this._inputValue.value = value;
        }
      });
    });
  }

  private watchDefaultQuickCompute() {
    watchDefaultQuickComputeValue({
      widget: this,
      getDecimal: () => this.decimal,
      applyValue: (value) => {
        this._inputValue.value = this.normalizeFormulaResult(value);
      },
    });
  }

  public handleFormatValue() {
    const formulaFieldMap = collectFormulaFieldUsages(this.defaultFormulaValueStr);
    const dependencyMap = getFormulaFieldValues(this as any, findIdByFormula(this.defaultFormulaValueStr), formulaFieldMap)
    const valueMap = buildFormulaValueMap({
      formElement: this as any,
      commonDeps: dependencyMap.formulaDeps,
      queryDeps: dependencyMap.queryDeps,
      formulaFieldMap,
    });
    const replaceCursor: Record<string, number> = {};
    const formula = replaceByFormula(this.defaultFormulaValueStr, (keys) => {
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
      const value = formulaRuntime?.evaluate(formula);
      this._inputValue.value = this.normalizeFormulaResult(value);
      return this._inputValue.value
    } catch (err) {
      return;
    }
  }

  // 千分符数字
  public getNumberWithCommas(num: number | string): string {
    return this.formatDisplayValue(num, true);
  }

  public formatDisplayValue(num: number | string, useSeparator: boolean): string {
    if (num === null || num === undefined || num === "" as any) return "";

    const value = Number(num);
    if (!Number.isFinite(value)) return "";

    const decimal = this.decimal || 0;
    if (useSeparator) {
      const normalizedValue = this.isDecimalTruncate
        ? truncateNumber(value, decimal)
        : value;
      return formatNumberWithSeparator(
        normalizedValue,
        {
          decimalPlaces: this.decimal,
          thousandSeparator: this.thousandSeparator,
          decimalPadding: this.isDecimalPadding
        }
      );
    }

    if (this.isDecimalPadding) {
      const normalizedValue = this.isDecimalTruncate
        ? truncateNumber(value, decimal)
        : value;
      return normalizedValue.toFixed(decimal);
    }

    if (this.isDecimalTruncate) {
      return String(truncateNumber(value, decimal));
    }

    return parseFloat(value.toFixed(decimal)).toString();
  }

  public get inputValue() {
    //对于数字组件，null和undefined有所区别，undefined表示未设置过，null表示设置为空
    if (this._inputValue.value !== undefined) {
      return this._inputValue.value;
    }
    if (this.initialValue !== undefined && !isNaN(this.initialValue)) {
      return this.initialValue
    }
    return this.defaultValue;
  }

  public set inputValue(value: number) {
    if (value === null || value === undefined) {
      this._inputValue.value = null
    } else {
      this._inputValue.value = value;
    }

    this.updateLastChangeTime();
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
              {
                name: "default-type",
                alias: i18next.t("defaultValue"),
                type: "select(radioGroup)",
                selectChoices: [
                  { label: i18next.t("custom"), value: "custom" },
                  { label: i18next.t("formulaEdit"), value: "formula" },
                ],
                default: "custom",
              },
              {
                name: "default-value",
                alias: "",
                type: "number<float>(nullable)",
                default: null,
                visible: (widget: NumberInput)=>{
                  return widget.getOption<"custom"|"formula">("default-type") === "custom";
                },
              },
              {
                name: "default-compute-type",
                alias: i18next.t("computeType"),
                type: "select(radioGroup)",
                selectChoices: [
                  { label: i18next.t("quickCompute"), value: "quickCompute" },
                  { label: i18next.t("computeFormula"), value: "formula" },
                ],
                default: (widget: NumberInput) => getDefaultQuickComputeType(widget),
                visible: (widget: NumberInput) => {
                  return widget.getOption<"custom" | "formula">("default-type") === "formula";
                },
              },
              {
                name: "default-other-table-field",
                alias: i18next.t("computeField"),
                type: "select(tree,onlyCheckLeaf)",
                placeholder: i18next.t("plsSelectField"),
                default: null,
                selectChoices: (widget: NumberInput) => {
                  return getDefaultQuickComputeFieldChoices(widget);
                },
                visible: (widget: NumberInput) => {
                  return widget.getOption<"custom" | "formula">("default-type") === "formula"
                    && widget.defaultComputeType === "quickCompute";
                },
              },
              {
                name: "option-filter-use-group-option",
                type: "boolean",
                default: true,
                visible: false,
              },
              {
                name: "default-data-filter",
                alias: i18next.t("dataFilter"),
                type: "dialog",
                default: null,
                dialog: {
                  component: defineAsyncComponent(() => import("@renderer/views/nocode/components/global/FormDataFilterDialog.vue")),
                  buttonText(element) {
                    const value = element.getOption("default-data-filter");
                    return isEmpty(value) || (value as any).conditions?.length === 0 ? i18next.t("setCondition") : i18next.t("hasCondition");
                  },
                  buttonStyle(element) {
                    const value = element.getOption("default-data-filter");
                    return isEmpty(value) || (value as any).conditions?.length === 0 ? {} : { color: "var(--color-primary)" };
                  },
                },
                visible: (widget: NumberInput) => {
                  return widget.getOption<"custom" | "formula">("default-type") === "formula"
                    && widget.defaultComputeType === "quickCompute"
                    && isDefaultQuickComputeDataFilterVisible(widget);
                },
              },
              {
                name: "default-aggregate-type",
                alias: i18next.t("aggregateType"),
                type: "select",
                placeholder: i18next.t("plsSelectAggregateType"),
                default: AggregationType.SUM,
                selectChoices: (widget: NumberInput) => {
                  return getDefaultQuickComputeAggregateChoices(widget);
                },
                visible: (widget: NumberInput) => {
                  return widget.getOption<"custom" | "formula">("default-type") === "formula"
                    && widget.defaultComputeType === "quickCompute";
                },
              },
              {
                name: "default-formula",
                alias: "",
                type: "dialog",
                dialog: {
                  component: defineAsyncComponent(() => import("@renderer/views/nocode/components/global/table/components/formula/FormDefaultValueFormulaDialog.vue")),
                  buttonText: (widget: NumberInput)=>{
                    if (widget.getOption("default-formula")) {
                      return i18next.t("formulaSet");
                    }
                    return i18next.t("editFormula");
                  },
                  buttonStyle(element, paths) {
                    const value = element.getOption("default-formula");
                    return (isEmpty(value) || value === "") ? {} : { color: 'var(--color-primary)' }
                  },
                },
                visible: (widget: NumberInput)=>{
                  return widget.getOption<"custom"|"formula">("default-type") === "formula"
                    && widget.defaultComputeType === "formula";
                },
              },
              {
                name: "number-type",
                alias: i18next.t("numberFormat"),
                type: "select",
                selectChoices: [
                  { label: i18next.t("number"), value: "number" },
                  { label: i18next.t("percent"), value: "percent" },
                ],
                default: "number",
              },
              {
                name: "use-decimal",
                alias: i18next.t("useDecimal"),
                type: "boolean",
                default: true,
                visible: false
              },
              {
                name: "decimal",
                alias: i18next.t("decimalDigits"),
                type: "number",
                default: 2,
                visible: (widget: NumberInput) => {
                  return widget.getOption<boolean>("use-decimal");
                }
              },
              {
                name: "decimal-padding",
                alias: i18next.t("decimalPadding"),
                type: "boolean",
                default: false,
                visible: (widget: NumberInput) => {
                  return widget.getOption<boolean>("use-decimal");
                }
              },
              {
                name: "decimal-rounding-rule",
                alias: i18next.t("decimalTruncate"),
                type: "select(radioGroup)",
                selectChoices: [
                  { label: i18next.t("round"), value: "round" },
                  { label: i18next.t("truncate"), value: "truncate" },
                ],
                default: "round",
                visible: (widget: NumberInput) => {
                  return widget.getOption<boolean>("use-decimal");
                }
              },
              {
                name: "thousand-separator",
                alias: i18next.t("thousandSeparator"),
                type: "boolean",
                default: false,
                visible: (widget: NumberInput) => {
                  return widget.getOption<"number"|"percent">("number-type") === "number";
                }
              },
              {
                name: "unit-position",
                alias: i18next.t("unitFormat"),
                type: "select(radioGroup)",
                selectChoices: [
                  { label: i18next.t("suffix"), value: "suffix" },
                  { label: i18next.t("prefix"), value: "prefix" },
                ],
                default: "suffix",
                visible: (widget: NumberInput) => {
                  return widget.numberType === "number";
                }
              },
              {
                name: "unit",
                alias: i18next.t("unit"),
                type: "string",
                default: "",
                visible: (widget: NumberInput) => {
                  return widget.numberType === "number";
                }
              },
            ],
          },
          scanInput: {
            visible: false,
          },
          validation: {
            children: [
              {
                name: "number-range",
                alias: i18next.t("limitRange"),
                type: "boolean",
                default: false,
              },
              {
                name: "range",
                alias: i18next.t("range"),
                default: [0, 100],
                type: "vector<min=float,max=float>(min=0)",
                visible: (widget: NumberInput) => {
                  return widget.getOption<boolean>("number-range");
                },
                beforeChange: (widget, value) => {
                  return value && value[0] <= value[1];
                }
              },
            ],
          },
        },
      }, ...super.defineOptions()
    ];
  }

  public async doValidate() {
    const val = Number(this.inputValue);
    if (!Number.isNaN(val) && Math.abs(val) > Number.MAX_SAFE_INTEGER) {
      throw new Error(i18next.t('numberExceedsMax'));
    }
    if (this.getOption("number-range")) {
      const range = this.getOption<number[]>("range");
      if(!range) return;
      if (val < range[0] || val > range[1]) {
        throw new Error(i18next.t('numberOutOfRange', { min: range[0], max: range[1] }));
      }
    }
  }
  get placeholder() {
    return this.getOption<string>("placeholder");
  }

  get numberType() {
    return this.getOption<string>("number-type");
  }

  get decimal() {
    return this.getOption<number>("decimal");
  }

  get unit() {
    return this.getOption<string>("unit");
  }

  get unitPosition() {
    return this.getOption<string>("unit-position");
  }

  get defaultType() {
    return this.getOption<"custom"|"formula">("default-type");
  }

  get isDecimalPadding() {
    return this.getOption<boolean>("decimal-padding");
  }

  get decimalRoundingRule() {
    return this.getOption<"round" | "truncate">("decimal-rounding-rule") || "round";
  }

  get isDecimalTruncate() {
    return this.decimalRoundingRule === "truncate";
  }

  get defaultValue(): number {
    return this.getOption<number>("default-value");
  }

  set defaultValue(value: number ){
    this.setOption("default-value", value);
  }

  get defaultComputeType() {
    return getDefaultQuickComputeType(this);
  }

  get defaultOtherTableFieldUID() {
    return getDefaultQuickComputeOtherTableFieldUID(this);
  }

  get defaultDataFilter() {
    return getDefaultQuickComputeDataFilter(this);
  }

  get defaultAggregateType() {
    return getDefaultQuickComputeAggregateType(this);
  }

  get defaultFormulaValue() {
    return this.getOption<string | FormulaConfig>("default-formula");
  }
  get defaultFormulaValueStr() {
    return getFormulaStr(this.defaultFormulaValue);
  }
  resetValue() {
    this._inputValue.value = undefined;
  }

  get defaultName() {
    return i18next.t("defaultName");
  }

  get fieldType() {
    return "number";
  }

  get thousandSeparator(): string {
    return this.getOption("thousand-separator") ? "," : "";
  }

  get isThousandSeparator(): boolean {
    return this.getOption("thousand-separator");
  }

  public otherTableDataCache: Record<string, Record<string, any>> = {};

  resolveFormSetting() {
    const isQuickComputeDefault = this.defaultType === "formula" && this.defaultComputeType === "quickCompute";
    const isFormulaDefault = this.defaultType === "formula" && this.defaultComputeType === "formula";

    const extra = {
      isPercent: this.numberType ===  "percent",
      completeZero: this.isDecimalPadding,
      decimalPlaces: this.decimal,
      decimalRoundingRule: this.decimalRoundingRule,
      thousandSeparator: this.thousandSeparator,
      unitPosition:  this.unitPosition,
      unit: this.unit,

      defaultValueType: this.defaultType,
      defaultValue: this.defaultValue,
      defaultComputeType: this.defaultType === "formula" ? this.defaultComputeType : undefined,
      formula: isFormulaDefault ? this.defaultFormulaValue : undefined,
      otherTableFieldUID: isQuickComputeDefault ? this.defaultOtherTableFieldUID : undefined,
      dataFilter: isQuickComputeDefault ? this.defaultDataFilter : undefined,
      aggregateType: isQuickComputeDefault ? this.defaultAggregateType : undefined,
      numberRange: this.getOption<boolean>("number-range"),
      range: this.getOption<number[]>("range"),
    }

    return {
      ...super.resolveFormSetting(),
      subType: "number",
      extra: {
        ...(super.resolveFormSetting()?.extra || {}),
        ...extra,
      }
    };
  }

  getConfigurations(): FormElementConfiguration {
    return {
      subType: "number",
      funcInfo: {
        [RuleFunc.EQUAL]: RuleFuncValue.NUMBER,
        [RuleFunc.NOT_EQUAL]: RuleFuncValue.NUMBER,
        [RuleFunc.GT]: RuleFuncValue.NUMBER,
        [RuleFunc.GTE]: RuleFuncValue.NUMBER,
        [RuleFunc.LT]: RuleFuncValue.NUMBER,
        [RuleFunc.LTE]: RuleFuncValue.NUMBER,
        [RuleFunc.BETWEEN]: RuleFuncValue.RANGE,
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
      },
      // 编辑表单时使用的筛选判断条件
      editFuncInfo: {
        [RuleFunc.EQUAL]: RuleFuncValue.NUMBER,
        [RuleFunc.NOT_EQUAL]: RuleFuncValue.NUMBER,
        [RuleFunc.GT]: RuleFuncValue.NUMBER,
        [RuleFunc.GTE]: RuleFuncValue.NUMBER,
        [RuleFunc.LT]: RuleFuncValue.NUMBER,
        [RuleFunc.LTE]: RuleFuncValue.NUMBER,
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.BETWEEN]: RuleFuncValue.RANGE,
      },
      aggregationInfo: [
        AggregationType.NOT_SHOW,
        AggregationType.SUM,
        AggregationType.AVE,
        AggregationType.MAX,
        AggregationType.MIN,
        AggregationType.FILLED,
        AggregationType.UNFILLED,
      ]
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

