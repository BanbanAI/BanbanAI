import { getDisplayAmount, formatNumberWithSeparator } from "@common/utils/amount";
import { FormElementConfiguration, RuleFunc, RuleFuncValue, AggregationType, FormWidgetType } from "@common/types/nocode";
import { replaceByFormula, findIdByFormula, collectFormulaFieldUsages, FormulaConfig, createFormulaRuntimeByWidget, getFormulaStr } from "@common/utils/formula";
import { isNocodeFormData } from "@common/utils/connection";
import { DefinedOptions, SelectChoice } from "@renderer/b2/types";
import { AbstractForm, FormElement, SubFormRow } from "@renderer/b2/controllers/form";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { Ref, ref, watch, nextTick, defineAsyncComponent } from "vue";
import { isEmpty } from "@common/utils/object";
import { buildFormulaValueMap, getFormulaFieldValues, processFormulaResult } from "@renderer/widgets/form/form/function";
import { useFormulaWatcher } from "@renderer/widgets/form/form/useFormulaWatcher";
import { FormMode } from "../_common/type";
import { ElInput } from "element-plus";
import { CurrencyType, PrefixType, SuffixType, AmountShowLang, AmountShowFormat } from "./types";
import { getCurrencyDict } from "./utils";
import { getDefaultQuickComputeAggregateChoices, getDefaultQuickComputeAggregateType, getDefaultQuickComputeDataFilter, getDefaultQuickComputeFieldChoices, getDefaultQuickComputeOtherTableFieldUID, getDefaultQuickComputeType, isDefaultQuickComputeDataFilterVisible, watchDefaultQuickComputeValue } from "../_common/defaultQuickCompute";
export class AmountInput extends FormElement {
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

    if (!this.isEditable && this.isUppercase) {
      const stop = watch(() => this.getBoard().isProjectReady, (value) => {
        if (value) {
          requestIdleCallback(() => {
            setTimeout(() => {
              this.watchRelatedAmount();
            }, 0);
            nextTick(() => {
              stop();
            })
          })
        }
      }, { immediate: true })
    }
  }

  // 监听关联的小写金额字段值变化
  private watchRelatedAmount() {
    const relatedPath = this.getOption<string>("related-lower-amount");
    if (!relatedPath) return;

    this.effectScope.run(() => {
      let stopWatcher: (() => void) | undefined;

      watch(() => {
        return this.findRelatedAmountWidget(relatedPath);
      }, (targetWidget) => {
        if (stopWatcher) {
          stopWatcher();
          stopWatcher = undefined;
        }
        if (targetWidget) {
          // 当关联字段变化时，同步数值到当前组件
          stopWatcher = watch(() => targetWidget.inputValue, (newVal) => {
            this.inputValue = newVal;
          }, { immediate: true });
        }
      }, { immediate: true });
    });
  }

  get isEditMode() {
    return this.getBoard().formMode === FormMode.Edit;
  }

  get isReadonly() {
    if (this.isUppercase) return true;
    return super.isReadonly;
  }

  private normalizeFormulaResult(value: any) {
    const processed = processFormulaResult(value, this.fieldType as any);
    return typeof processed === "number"
      ? parseFloat(processed.toFixed(this.decimal || 0))
      : processed;
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

  get relatedLowerAmount() {
    const value = this.getOption<string>("related-lower-amount");
    return value?.split(".") || [];
  }

  /**
   * 获取用于页面显示的完整字符串
   */
  public getDisplayValue(): string {
    let prefix = this.prefixValue;
    let suffix = this.suffixValue;
    if (prefix && this.prefixType === "currencyCode") {
      prefix = `${prefix} `;
    }
    if (suffix && this.suffixType === "currencyCode") {
      suffix = ` ${suffix}`;
    }

    return getDisplayAmount(this.inputValue, {
      isUppercase: this.isUppercase,
      currencyType: this.currencyType,
      uppercaseLanguage: this.uppercaseLanguage,
      uppercaseShowFormat: this.uppercaseShowFormat,
      decimalPlaces: this.decimal,
      decimalPadding: this.isDecimalPadding,
      thousandSeparator: this.thousandSeparator,
      decimalSeparator: this.decimalSeparator,
      prefix,
      suffix
    });
  }

  // 千分符数字
  public getNumberWithCommas(num: number | string): string {
    return formatNumberWithSeparator(
      num,
      {
        decimalPlaces: this.decimal,
        thousandSeparator: this.thousandSeparator,
        decimalSeparator: this.decimalSeparator,
        decimalPadding: this.isDecimalPadding
      }
    );
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

  private static getRelatedLowerAmountChoices(widget: AmountInput) {
    const connectionUID = widget.topForm?.tableUID?.[0];
    const tableUID = widget.topForm?.tableUID?.[1];
    if (!connectionUID || !tableUID) return [];

    const connections = widget.getBoard().getConnections();
    const connection = connections.find(c => c.uid === connectionUID);
    const table = connection?.tables?.find(t => t.uid === tableUID && isEmpty(t.meta?.extra?.primaryTable));
    if (!connection || !table) return [];

    const mainFormWidgets = (widget.topForm?.container?.getChildWidgets(true) || [])
      .filter((w: any) => !w.isInSubForm);
    const mainOptions = mainFormWidgets
      .filter((w: any) => w.uid !== widget.uid && w.type === FormWidgetType.AMOUNT_INPUT && w.getOption("amount-case") !== "upperAmount")
      .map((w: any) => {
        const wUid = w.uid || w.fieldId || w.field?.uid;
        const legacyValue = w.fieldId || w.field?.uid;
        return {
          label: w.title,
          value: `${connection.uid}.${table.uid}.${wUid}`,
          legacyValue: legacyValue ? `${connection.uid}.${table.uid}.${legacyValue}` : undefined,
        }
      });

    let children = mainOptions;
    const currentSubForm = widget.isInSubForm ? widget.form : null;
    if (currentSubForm) {
      const subTableId = currentSubForm.tableUID?.[1] || currentSubForm.uid;
      const subOptions = (currentSubForm.children || [])
        .filter((w: any) => w.uid !== widget.uid && w.type === FormWidgetType.AMOUNT_INPUT && w.getOption("amount-case") !== "upperAmount")
        .map((w: any) => {
          const wUid = w.uid || w.fieldId || w.field?.uid;
          const legacyValue = w.fieldId || w.field?.uid;
          return {
            label: `${currentSubForm.title}.${w.title}`,
            value: `${connection.uid}.${subTableId}.${wUid}`,
            legacyValue: legacyValue ? `${connection.uid}.${subTableId}.${legacyValue}` : undefined,
          }
        });
      children = [...mainOptions, ...subOptions];
    }

    if (children.length === 0) return [];

    return [{
      label: table.alias,
      value: table.uid,
      children,
    }] as SelectChoice[];
  }

  private resolveRelatedFieldPath(relatedPath: string) {
    const pathParts = relatedPath.split(".");
    if (pathParts.length < 3) return null;

    const targetConnUid = pathParts[pathParts.length - 3];
    const targetTableUid = pathParts[pathParts.length - 2];
    const targetFieldUid = pathParts[pathParts.length - 1];
    const connections = this.getBoard().getConnections();
    const connection = connections.find(c => c.uid === targetConnUid);
    if (!connection) return null;

    let table = connection.tables?.find(t => t.uid === targetTableUid);
    let parentSubFormUid: string | undefined;
    const mainTable = connection.tables?.find(t => t.uid === this.topForm?.tableUID?.[1]);

    if (!table) {
      const subFormField = mainTable?.fields?.find(f =>
        f.uid === targetTableUid ||
        f.meta?.uid === targetTableUid ||
        f.meta?.extra?.subTableUID?.[1] === targetTableUid
      );
      parentSubFormUid = subFormField?.meta?.uid || subFormField?.uid;
      table = connection.tables?.find(t => t.uid === subFormField?.meta?.extra?.subTableUID?.[1]);
    } else if (table.meta?.extra?.primaryTable?.[1]) {
      const parentTable = connection.tables?.find(t => t.uid === table.meta?.extra?.primaryTable?.[1]);
      const subFormField = parentTable?.fields?.find(f => f.meta?.extra?.subTableUID?.[1] === table?.uid);
      parentSubFormUid = subFormField?.meta?.uid || subFormField?.uid;
    }

    const field = table?.fields?.find(f => f.uid === targetFieldUid || f.meta?.uid === targetFieldUid);

    return {
      connection,
      table,
      field,
      fieldUID: targetFieldUid,
      parentSubFormUid,
    };
  }

  private findRelatedAmountWidget(relatedPath: string) {
    const relatedField = this.resolveRelatedFieldPath(relatedPath);
    if (!relatedField) return null;

    const ids = [
      relatedField.field?.meta?.uid,
      relatedField.field?.uid,
      relatedField.fieldUID,
    ].filter(Boolean);

    const findByIds = (widgets: any[] = []) => {
      return widgets.find((w: any) => {
        return ids.includes(w?.uid) ||
          ids.includes(w?.fieldId) ||
          ids.includes(w?.field?.uid) ||
          ids.includes(w?.field?.meta?.uid);
      });
    };

    if (relatedField.table?.uid === this.topForm?.tableUID?.[1]) {
      return findByIds((this.topForm?.container?.getChildWidgets(true) || []).filter((w: any) => !w?.isInSubForm));
    }

    if (this.form instanceof SubFormRow) {
      const rowWidget = findByIds(this.form.children || []);
      if (rowWidget) return rowWidget;
    }

    const currentFormWidget = findByIds(this.form?.children || []);
    if (currentFormWidget) return currentFormWidget;

    const subForm = (this.topForm?.children || []).find((w: any) =>
      w?.uid === relatedField.parentSubFormUid ||
      w?.fieldId === relatedField.parentSubFormUid ||
      w?.field?.uid === relatedField.parentSubFormUid ||
      w?.field?.meta?.uid === relatedField.parentSubFormUid
    ) as any;
    return findByIds(subForm?.children || []);
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
                name: "amount-case",
                alias: i18next.t("amountCase"),
                type: "select(radioGroup)",
                default: "lowerAmount",
                selectChoices: [
                  { label: i18next.t("lowerAmount"), value: "lowerAmount" },
                  { label: i18next.t("upperAmount"), value: "upperAmount" },
                ],
              },
              {
                name: "related-lower-amount",
                alias: i18next.t("relatedLowerAmount"),
                type: "select(tree,onlyCheckLeaf)",
                default: null,
                selectChoices: (widget: AmountInput) => {
                  return AmountInput.getRelatedLowerAmountChoices(widget);
                },
                visible: (widget: AmountInput)=>{
                  return widget.isUppercase;
                }
              },
              {
                name: "amount-uppercase-language",
                alias: i18next.t("amountUppercaseLanguage"),
                type: "select",
                default: () => {
                  const lang = (i18next as any).language || 'zh-CN';
                  if (['zh-CN', 'en-US', 'ja-JP'].includes(lang)) {
                    return lang;
                  } else if (lang === 'zh' || lang.startsWith('zh-')) {
                    return 'zh-CN';
                  } else if (lang === 'ja' || lang.startsWith('ja-')) {
                    return 'ja-JP';
                  } else if (lang === 'en' || lang.startsWith('en-')) {
                    return 'en-US';
                  }
                  return 'zh-CN';
                },
                selectChoices: [
                  { label: i18next.t("chinese"), value: "zh-CN" },
                  { label: i18next.t("english"), value: "en-US" },
                  { label: i18next.t("japanese"), value: "ja-JP" },
                  // { label: i18next.t("followSystem"), value: "followSystem" },
                ],
                visible: (widget: AmountInput)=>{
                  return widget.isUppercase;
                }
              },
              {
                name: "uppercase-zh-show-format",
                alias: "",
                type: "select",
                default: "simplified",
                selectChoices: (widget: AmountInput)=>{
                  return [{
                    label: i18next.t("simplifiedChinese"),
                    value: "simplified"
                  },{
                    label: i18next.t("traditionalChinese"),
                    value: "traditional"
                  }]
                },
                visible: (widget: AmountInput)=>{
                  return widget.isUppercase && widget.uppercaseLanguage === "zh-CN";
                }
              },
              {
                name: "uppercase-en-show-format",
                alias: "",
                type: "select",
                default: "fraction",
                selectChoices: (widget: AmountInput)=>{
                  return [{
                    label: i18next.t("fractionExpression"),
                    value: "fraction"
                  },{
                    label: i18next.t("centsExpression"),
                    value: "cents"
                  },{
                    label: i18next.t("pointsExpression"),
                    value: "points"
                  }];
                },
                visible: (widget: AmountInput)=>{
                  return widget.isUppercase && widget.uppercaseLanguage === "en-US";
                }
              },
              {
                name: "currency-type",
                alias: i18next.t("currencySelect"),
                type: "select",
                default: CurrencyType.CNY,
                selectChoices: getCurrencyDict(i18next.language).map(c => ({
                  label: c.label,
                  value: c.value
                })),
                visible: (widget: AmountInput)=>{
                  return !widget.isUppercase;
                }
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
                visible: (widget: AmountInput)=>{
                  return !widget.isUppercase;
                }
              },
              {
                name: "default-value",
                alias: "",
                type: "number<float>(nullable)",
                default: null,
                visible: (widget: AmountInput)=>{
                  return !widget.isUppercase && widget.getOption<"custom"|"formula">("default-type") === "custom";
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
                default: (widget: AmountInput) => getDefaultQuickComputeType(widget),
                visible: (widget: AmountInput) => {
                  return !widget.isUppercase && widget.getOption<"custom" | "formula">("default-type") === "formula";
                },
              },
              {
                name: "default-other-table-field",
                alias: i18next.t("computeField"),
                type: "select(tree,onlyCheckLeaf)",
                placeholder: i18next.t("plsSelectField"),
                default: null,
                selectChoices: (widget: AmountInput) => {
                  return getDefaultQuickComputeFieldChoices(widget);
                },
                visible: (widget: AmountInput) => {
                  return !widget.isUppercase
                    && widget.getOption<"custom" | "formula">("default-type") === "formula"
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
                visible: (widget: AmountInput) => {
                  return !widget.isUppercase
                    && widget.getOption<"custom" | "formula">("default-type") === "formula"
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
                selectChoices: (widget: AmountInput) => {
                  return getDefaultQuickComputeAggregateChoices(widget);
                },
                visible: (widget: AmountInput) => {
                  return !widget.isUppercase
                    && widget.getOption<"custom" | "formula">("default-type") === "formula"
                    && widget.defaultComputeType === "quickCompute";
                },
              },
              {
                name: "default-formula",
                alias: "",
                type: "dialog",
                dialog: {
                  component: defineAsyncComponent(() => import("@renderer/views/nocode/components/global/table/components/formula/FormDefaultValueFormulaDialog.vue")),
                  buttonText: (widget: AmountInput)=>{
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
                visible: (widget: AmountInput)=>{
                  return !widget.isUppercase
                    && widget.getOption<"custom"|"formula">("default-type") === "formula"
                    && widget.defaultComputeType === "formula";
                },
              },
              {
                name: "thousand-separator",
                alias: i18next.t("thousandSeparator"),
                type: "select(radioGroup)",
                default: "",
                selectChoices: [
                  { label: i18next.t("comma"), value: "comma" },
                  { label: i18next.t("dot"), value: "dot" },
                  { label: i18next.t("space"), value: "space" },
                  { label: i18next.t("noSeparator"), value: "" },
                ],
                visible: (widget: AmountInput)=>{
                  return !widget.isUppercase;
                }
              },
              {
                name: "decimal-separator",
                alias: i18next.t("decimal"),
                type: "select(radioGroup)",
                default: "dot",
                selectChoices: [
                  { label: i18next.t("dot"), value: "dot" },
                  { label: i18next.t("comma"), value: "comma" },
                ],
                visible: (widget: AmountInput)=>{
                  return !widget.isUppercase;
                }
              },
              {
                name: "prefix",
                alias: i18next.t("prefix"),
                type: "boolean",
                default: false,
                visible: (widget: AmountInput)=>{
                  return true;
                }
              },
              {
                name: "prefix-type",
                alias: i18next.t("prefixDisplay"),
                type: "select(radioGroup)",
                default: "custom",
                selectChoices: [
                  { label: i18next.t("currencySymbol"), value: "currencySymbol" },
                  { label: i18next.t("currencyCode"), value: "currencyCode" },
                  { label: i18next.t("custom"), value: "custom" },
                ],
                visible: (widget: AmountInput)=>{
                  return widget.prefix;
                }
              },
              {
                name: "prefix-custom-value",
                alias: "",
                type: "string",
                default: "",
                visible: (widget: AmountInput)=>{
                  return widget.prefix && widget.prefixType === "custom";
                }
              },
              {
                name: "suffix",
                alias: i18next.t("suffix"),
                type: "boolean",
                default: false,
                visible: (widget: AmountInput)=>{
                  return true;
                }
              },
              {
                name: "suffix-type",
                alias: i18next.t("suffixDisplay"),
                type: "select(radioGroup)",
                default: "custom",
                selectChoices: [
                  { label: i18next.t("currencySymbol"), value: "currencySymbol" },
                  { label: i18next.t("currencyCode"), value: "currencyCode" },
                  { label: i18next.t("custom"), value: "custom" },
                ],
                visible: (widget: AmountInput)=>{
                  return widget.suffix;
                }
              },
              {
                name: "suffix-custom-value",
                alias: "",
                type: "string",
                default: "",
                visible: (widget: AmountInput)=>{
                  return widget.suffix && widget.suffixType === "custom";
                }
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
                visible: (widget: AmountInput) => {
                  return !widget.isUppercase && widget.getOption<boolean>("use-decimal");
                }
              },
              {
                name: "decimal-padding",
                alias: i18next.t("decimalPadding"),
                type: "boolean",
                default: false,
                visible: (widget: AmountInput) => {
                  return widget.getOption<boolean>("use-decimal");
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
                visible: (widget: AmountInput) => {
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

  get isUppercase() {
    return this.getOption<string>("amount-case") === "upperAmount";
  }

  private getRelatedFieldExtra() {
    const relatedPath = this.getOption<string>("related-lower-amount");
    if (!relatedPath) return null;

    const connections = this.getBoard().getConnections();
    const connection = connections.find(c => c.uid === this.topForm?.tableUID?.[0]);
    if (!connection) return null;

    for (const t of connection.tables || []) {
      // 检查主表字段
      for (const f of t.fields || []) {
        const path = `${connection.uid}.${t.uid}.${f.uid}`;
        if (path === relatedPath) return f.meta?.extra;

        // 检查子表字段
        if (f.meta?.subType === "subForm") {
          const subTableUid = f.meta?.extra?.subTableUID?.[1];
          const subTable = connection.tables.find(st => st.uid === subTableUid);
          if (subTable) {
            const subTablePath = f.meta.extra?.subTableUID?.join(".");
            for (const sf of subTable.fields || []) {
              const subPath = `${subTablePath}.${sf.uid}`;
              if (subPath === relatedPath) return sf.meta?.extra;
            }
          }
        }
      }
    }
    return null;
  }

  private getRelatedFieldExtraCompat() {
    const relatedPath = this.getOption<string>("related-lower-amount");
    if (!relatedPath) return null;

    const relatedField = this.resolveRelatedFieldPath(relatedPath);
    if (relatedField?.field?.meta?.extra) return relatedField.field.meta.extra;

    return this.findRelatedAmountWidget(relatedPath)?.resolveFormSetting?.()?.extra || null;
  }

  get currencyType() {
    if (this.isUppercase) {
      const relatedExtra = this.getRelatedFieldExtraCompat();
      if (relatedExtra) {
        if (relatedExtra.amount?.currencyType) {
          return relatedExtra.amount.currencyType;
        }
        if (relatedExtra.currencyType) {
          return relatedExtra.currencyType;
        }
      }
    }
    return this.getOption<string>("currency-type");
  }

  get placeholder() {
    return this.getOption<string>("placeholder");
  }

  get decimal() {
    return this.getOption<number>("decimal");
  }

  get isDecimalPadding() {
    return this.getOption<boolean>("decimal-padding");
  }

  get prefix() {
    return this.getOption<boolean>("prefix");
  }

  get suffix() {
    return this.getOption<boolean>("suffix");
  }

  get prefixType() {
    return this.getOption<PrefixType>("prefix-type");
  }

  get suffixType() {
    return this.getOption<SuffixType>("suffix-type");
  }

  get prefixValue() {
    if (!this.prefix) return "";
    if (this.prefixType === "custom") {
      return this.getOption<string>("prefix-custom-value");
    }

    const currencyInfo = getCurrencyDict().find(item => item.value === this.currencyType);
    if (!currencyInfo) return "";

    if (this.prefixType === "currencySymbol") {
      return currencyInfo.symbol;
    } else if (this.prefixType === "currencyCode") {
      return currencyInfo.value;
    }
    return "";
  }

  get suffixValue() {
    if (!this.suffix) return "";
    if (this.suffixType === "custom") {
      return this.getOption<string>("suffix-custom-value");
    }

    const currencyInfo = getCurrencyDict().find(item => item.value === this.currencyType);
    if (!currencyInfo) return "";

    if (this.suffixType === "currencySymbol") {
      return currencyInfo.symbol;
    } else if (this.suffixType === "currencyCode") {
      return currencyInfo.value;
    }
    return "";
  }

  get uppercaseLanguage(): AmountShowLang {
    let lang = this.getOption<AmountShowLang>("amount-uppercase-language");
    return lang;
    // if (lang === "followSystem") {
    //   lang = (i18next as any).language || 'zh-CN';
    //   if (lang === 'zh' || lang.startsWith('zh-')) {
    //     return 'zh-CN';
    //   } else {
    //     return 'en-US';
    //   }
    // } else {
    //   return lang as AmountShowLang;
    // }
  }

  get uppercaseShowFormat() {
    if (this.uppercaseLanguage === "zh-CN") {
      return this.getOption<AmountShowFormat>("uppercase-zh-show-format");
    } else if (this.uppercaseLanguage === "en-US") {
      return this.getOption<AmountShowFormat>("uppercase-en-show-format");
    } else if (this.uppercaseLanguage === "ja-JP") {
      return "japanese";
    } else {
      return null;
    }
  }

  get defaultType() {
    return this.getOption<"custom"|"formula">("default-type");
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

  get isThousandSeparator(): boolean {
    return !!this.getOption("thousand-separator");
  }

  get thousandSeparator(): string {
    const thousandSeparator = this.getOption("thousand-separator");
    if (thousandSeparator === "comma") {
      return ",";
    } else if (thousandSeparator === "space") {
      return " ";
    }
    return "";
  }

  get decimalSeparator(): string {
    const decimalSeparator = this.getOption("decimal-separator");
    if (decimalSeparator === "dot") {
      return ".";
    } else if (decimalSeparator === "comma") {
      return ",";
    }
    return ".";
  }

  public otherTableDataCache: Record<string, Record<string, any>> = {};

  resolveFormSetting() {
    const isQuickComputeDefault = this.defaultType === "formula" && this.defaultComputeType === "quickCompute";
    const isFormulaDefault = this.defaultType === "formula" && this.defaultComputeType === "formula";

    let prefix = this.prefixValue;
    let suffix = this.suffixValue;
    if (prefix && this.prefixType === "currencyCode") {
      prefix = `${prefix} `;
    }
    if (suffix && this.suffixType === "currencyCode") {
      suffix = ` ${suffix}`;
    }
    const extra = {
      completeZero: this.isDecimalPadding,
      decimalPlaces: this.decimal,

      defaultValueType: this.defaultType,
      defaultValue: this.defaultValue,
      defaultComputeType: this.defaultType === "formula" ? this.defaultComputeType : undefined,
      formula: isFormulaDefault ? this.defaultFormulaValue : undefined,
      otherTableFieldUID: isQuickComputeDefault ? this.defaultOtherTableFieldUID : undefined,
      dataFilter: isQuickComputeDefault ? this.defaultDataFilter : undefined,
      aggregateType: isQuickComputeDefault ? this.defaultAggregateType : undefined,
      numberRange: this.getOption<boolean>("number-range"),
      range: this.getOption<number[]>("range"),

      amount: {
        isUppercase: this.isUppercase,
        currencyType: this.currencyType,
        prefix,
        suffix,
        uppercaseLanguage: this.uppercaseLanguage,
        uppercaseShowFormat: this.uppercaseShowFormat,
        thousandSeparator: this.thousandSeparator,
        decimalSeparator: this.decimalSeparator,
        relatedLowerAmount: this.getOption<string>("related-lower-amount"),
      }
    }

    return {
      ...super.resolveFormSetting(),
      subType: "amount",
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

