import { AggregationType, FormElementConfiguration, RuleFunc, RuleFuncValue } from "@common/types/nocode";
import { FormulaConfig, replaceByFormula, findIdByFormula, collectFormulaFieldUsages, createFormulaRuntimeByWidget, getFormulaStr } from "@common/utils/formula";
import { DefinedOptions } from "@renderer/b2/types";
import { FormElement } from "@renderer/b2/controllers/form";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { nextTick, Ref, ref, watch, defineAsyncComponent } from "vue";
import { isEmpty } from "@common/utils/object";
import { buildFormulaValueMap, getFormulaFieldValues, processFormulaResult } from "@renderer/widgets/form/form/function";
import { useFormulaWatcher } from "@renderer/widgets/form/form/useFormulaWatcher";
import { FormMode } from "../_common/type";
import { Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { ElInput } from "element-plus";

export class TextInput extends FormElement {
  static resource = resource as any;
  private _inputInstance: InstanceType<typeof ElInput> | null = null;

  set inputInstance(instance: InstanceType<typeof ElInput> | null) {
    this._inputInstance = instance;
  }

  initAfterConstructor() {
    super.initAfterConstructor();

    const suppressComputedWatchers = (this.form as any)?.suppressComputedWatchers;
    if (this.defaultType === "formula" && this.defaultFormulaValue && !this.isEditable && !suppressComputedWatchers) {
      const stop = watch(() => this.getBoard().isProjectReady, async (value) => {
        if (value) {
          this.watchDefaultFormula();
          nextTick(() => {
            stop();
          })
        }
      }, { immediate: true })
    }
  }

  public handleFormatValue() {
    const formula = this.defaultFormulaValue;
    const formulaText = getFormulaStr(formula);
    if (!formulaText) return;

    const formulaFieldMap = collectFormulaFieldUsages(formulaText);
    const dependencyMap = getFormulaFieldValues(this as any, findIdByFormula(formulaText), formulaFieldMap);
    const valueMap = buildFormulaValueMap({
      formElement: this as any,
      commonDeps: dependencyMap.formulaDeps,
      queryDeps: dependencyMap.queryDeps,
      formulaFieldMap,
    });
    const replaceCursor: Record<string, number> = {};
    const replaced = replaceByFormula(formulaText, (keys) => {
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
      const value = createFormulaRuntimeByWidget(this).evaluate(replaced);
      this._inputValue.value = processFormulaResult(value, this.fieldType);
      return this._inputValue.value;
    } catch {
      return;
    }
  }

  get isEditMode() {
    return this.getBoard().formMode === FormMode.Edit;
  }
  private watchDefaultFormula() {
    this.effectScope.run(() => {
      useFormulaWatcher({
        formElement: this,
        formula: this.defaultFormulaValue,
        fieldType: this.fieldType,
        isEditMode: this.isEditMode,
        normalizeResult: (value) => processFormulaResult(value, this.fieldType),
        onApplyResult: (value) => {
          this._inputValue.value = value;
        }
      });
    });
  }

  static defineOptions(): DefinedOptions[] {
    return [{
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
              name: "clear-button",
              alias: i18next.t("clearButton"),
              type: "boolean",
              default: false,
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
              type: "string",
              default: "",
              visible: (widget: TextInput)=>{
                return widget.getOption<"custom"|"formula">("default-type") === "custom";
              },
            },
            {
              name: "default-formula",
              alias: "",
              type: "dialog",
              dialog: {
                component: defineAsyncComponent(() => import("@renderer/views/nocode/components/global/table/components/formula/FormDefaultValueFormulaDialog.vue")),
                buttonText: (widget: TextInput)=>{
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
              visible: (widget: TextInput)=>{
                return widget.getOption<"custom"|"formula">("default-type") === "formula";
              },
            },
          ],
        },
        scanInput: {
          visible: true,
          alias: i18next.t("mobileScan"),
          fold: "unfold",
          children: [
            {
              name: "scan-input",
              alias: i18next.t("scanInput"),
              type: "boolean",
              default: false,
            },
            {
              name: "scan-input-editable",
              alias: i18next.t("scanEditable"),
              type: "boolean",
              default: true,
              visible: (widget: TextInput) => {
                return widget.getOption<boolean>("scan-input");
              },
            },
            {
              name: "scan-input-continuous",
              alias: i18next.t("continuousScanInput"),
              type: "boolean",
              default: true,
              visible: (widget: TextInput) => {
                return widget.getOption<boolean>("scan-input") && widget.isInSubForm;
              },
            },
            {
              name: "scan-input-type",
              alias: i18next.t("scanType"),
              type: "select",
              selectChoices: [
                { label: i18next.t("all"), value: "all" },
                { label: i18next.t("qrcode"), value: "qrcode" },
                { label: i18next.t("barcode"), value: "barcode" },
              ],
              default: "all",
              visible: (widget: TextInput) => {
                return widget.getOption<boolean>("scan-input");
              },
            },
          ],
        },
        validation: {
          children: [
            {
              name: "word-count",
              alias: i18next.t("limitWordCount"),
              type: "boolean",
              default: false,
            },
            {
              name: "word-count-range",
              alias: i18next.t("wordCountRange"),
              default: [0, 100],
              type: "vector<min,max>(min=0)",
              visible: (widget: TextInput) => {
                return widget.getOption<boolean>("word-count");
              },
              beforeChange: (widget, value) => {
                return value && value[0] <= value[1];
              }
            },
            {
              name: "validation-format",
              alias: i18next.t("limitFormat"),
              type: "select",
              selectChoices: [
                { label: i18next.t("none"), value: "none" },
                { label: i18next.t("mobilePhoneNumber"), value: "mobile-phone" },
                { label: i18next.t("telephoneNumber"), value: "telephone" },
                { label: i18next.t("idCardNumber"), value: "ID-number" },
                { label: i18next.t("email"), value: "email" },
                { label: i18next.t("licensePlate"), value: "license-plate" },
              ],
              default: "none",
            },
          ],
        },
        // 单行文本加密
        encryption: {
          visible: true,
          alias: i18next.t("encryption"),
          fold: "unfold",
          children: [
            {
              name: "enable-encrypt",
              alias: i18next.t("enableEncryption"),
              type: "boolean",
              default: false,
            },
            {
              name: "front-number",
              alias: i18next.t("frontDisplayCount"),
              type: `number(unit=${i18next.t("unitGE")},min=0)`,
              default: 2,
              visible: (widget: TextInput) => {
                return widget.getOption<boolean>("enable-encrypt");
              },
            },
            {
              name: "back-number",
              alias: i18next.t("backDisplayCount"),
              type: `number(unit=${i18next.t("unitGE")},min=0)`,
              default: 2,
              visible: (widget: TextInput) => {
                return widget.getOption<boolean>("enable-encrypt");
              },
            },
            {
              name: "encrypt-char",
              alias: i18next.t("encryptDisplayChar"),
              type: "string",
              default: '*',
              visible: (widget: TextInput) => {
                return widget.getOption<boolean>("enable-encrypt");
              },
            },
          ],
        },
      },
    }, ...super.defineOptions()];
  }

  get placeholder() {
    return this.getOption<string>("placeholder");
  }
  get clearable() {
    return this.getOption<boolean>("clear-button");
  }
  get wordLimit() {
    return this.getOption<boolean>("word-count");
  }
   get minLength() {
    if (!this.wordLimit) {
      return null;
    }
    const [min, max] = this.getOption<[number, number]>("word-count-range");
    return min;
  }
  get maxLength() {
    if (!this.wordLimit) {
      return null;
    }
    const [min, max] = this.getOption<[number, number]>("word-count-range");
    return max;
  }

  get defaultValue(): string {
    return this.getOption<string>("default-value");
  }

  protected _inputValue: Ref<string> = ref();
  public get inputValue() {
    return this._inputValue.value ?? this.initialValue ?? this.defaultValue;
  }
  public set inputValue(value: string) {
    this._inputValue.value = value;
    this.updateLastChangeTime();
  }

  public clearValue() {
    this.inputValue = "";
  }

  protected async doValidate() {
    if (this.getOption("word-count")) {
      const range = this.getOption("word-count-range");
      if (this.inputValue.length < range[0] || this.inputValue.length > range[1]) {
        throw new Error(i18next.t("wordCountOutOfRange", { min: range[0], max: range[1] }));
      }
    }
    if (!this.inputValue) return;
    const format = this.getOption("validation-format");
    switch (format) {
      case "mobile-phone":
        if (!/^(?:(?:\+|00)86)?1\d{10}$/.test(this.inputValue)) {
          throw new Error(i18next.t("invalidMobilePhone"));
        }
        break;
      case "telephone":
        if (!/^(?:(?:\d{3}-)?\d{8}|^(?:\d{4}-)?\d{7,8})(?:-\d+)?$/.test(this.inputValue)) {
          throw new Error(i18next.t("invalidTelephone"));
        }
        break;
      case "ID-number":
        if (!/^\d{6}((((((19|20)\d{2})(0[13-9]|1[012])(0[1-9]|[12]\d|30))|(((19|20)\d{2})(0[13578]|1[02])31)|((19|20)\d{2})02(0[1-9]|1\d|2[0-8])|((((19|20)([13579][26]|[2468][048]|0[48]))|(2000))0229))\d{3})|((((\d{2})(0[13-9]|1[012])(0[1-9]|[12]\d|30))|((\d{2})(0[13578]|1[02])31)|((\d{2})02(0[1-9]|1\d|2[0-8]))|(([13579][26]|[2468][048]|0[048])0229))\d{2}))(\d|X|x)$/.test(this.inputValue)) {
          throw new Error(i18next.t("invalidIdNumber"));
        }
        break;
      case "email":
        if (!/^[A-Za-z0-9\u4e00-\u9fa5]+@[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/.test(this.inputValue)) {
          throw new Error(i18next.t("invalidEmail"));
        }
        break;
      case "license-plate":
        let val = this.inputValue.trim().toUpperCase();
        const cleanVal = val.replace(/[\s·]/g, "");

        // 普通燃油车
        const regexNormal = /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼][A-Z][A-HJ-NP-Z0-9]{4,5}([A-HJ-NP-Z0-9挂学警领]|应急)$/;
        // 新能源车
        const regexNewEnergy = /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼][A-Z](([DF][A-HJ-NP-Z0-9][0-9]{4,5})|([0-9]{5}[DF]))$/;
        // 跨境车
        const regexCrossBorder = /^粤Z[A-HJ-NP-Z0-9]{4,5}[港澳]$/;
        // 领事馆
        const regexConsulate = /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼]([A-Z][0-9A-Z]{4}|[0-9]{5})领$/;
        // 大使馆
        const regexEmbassy =/^(使[0-9]{6}|[0-9]{6}使)$/;

        let isValid = false;
        if (
          regexNormal.test(cleanVal) ||
          regexNewEnergy.test(cleanVal) ||
          regexCrossBorder.test(cleanVal) ||
          regexConsulate.test(cleanVal) ||
          regexEmbassy.test(cleanVal)
        ) {
          isValid = true;
        }
        if (!isValid) {
          throw new Error(i18next.t("licensePlateError"));
        }
        break;
    }
  }
  get defaultType() {
    return this.getOption<"custom"|"formula">("default-type");
  }

  set defaultValue(value: string ){
    this.setOption("default-value", value);
  }

  get defaultFormulaValue() {
    return this.getOption<string | FormulaConfig>("default-formula");
  }

  get defaultFormulaValueStr() {
    return getFormulaStr(this.defaultFormulaValue);
  }

  get isScanInput() {
    return this.getOption<boolean>("scan-input");
  }

  get isScanInputEditable() {
    return this.getOption<boolean>("scan-input-editable");
  }

  get isScanInputContinuous() {
    return this.getOption<boolean>("scan-input-continuous");
  }

  get scanInputType() {
    return this.getOption<string>("scan-input-type");
  }

  get defaultName() {
    return i18next.t("defaultName");
  }

  // 单行文本加密
  // 添加获取加密配置的方法
  get isEnableEncrypt() {
    return this.getOption<boolean>("enable-encrypt");
  }
  get displayFrontLength() {
    return this.getOption<number>("front-number");
  }
  get diaplayBackLength() {
    return this.getOption<number>("back-number");
  }
  get encryptChar() {
    return this.getOption<string>("encrypt-char");
  }

  public otherTableDataCache: Record<string, Record<string, any>> = {};

  resolveFormSetting() {
    return {
      ...super.resolveFormSetting(),
      subType: "text",
      extra: {
        ...(super.resolveFormSetting()?.extra || {}),
        scanInput: this.isScanInput,
        encryption: {
          enable: this.isEnableEncrypt,
          frontLength: this.displayFrontLength,
          backLength: this.diaplayBackLength,
          encryptChar: this.encryptChar,
        },
        defaultValueType: this.defaultType,
        defaultValue: this.defaultValue,
        formula: this.defaultFormulaValue,
        wordLimit: this.wordLimit,
        wordRange: [this.minLength, this.maxLength],
        validationFormat: this.getOption<string>("validation-format"),
      }
    };
  }

  getConfigurations(): FormElementConfiguration {
    return {
      funcInfo: {
        [RuleFunc.EQUAL]: RuleFuncValue.SELECT,
        [RuleFunc.NOT_EQUAL]: RuleFuncValue.SELECT,
        [RuleFunc.IN]: RuleFuncValue.SELECT_MULTIPLE,
        [RuleFunc.NOT_IN]: RuleFuncValue.SELECT_MULTIPLE,
        [RuleFunc.CONTAIN]: RuleFuncValue.STRING,
        [RuleFunc.NOT_CONTAIN]: RuleFuncValue.STRING,
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
      },
      // 编辑表单时使用的筛选判断条件
      editFuncInfo: {
        [RuleFunc.EQUAL]: RuleFuncValue.STRING,
        [RuleFunc.NOT_EQUAL]: RuleFuncValue.STRING,
        [RuleFunc.CONTAIN]: RuleFuncValue.STRING,
        [RuleFunc.NOT_CONTAIN]: RuleFuncValue.STRING,
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.IN]: RuleFuncValue.TAGS,
        [RuleFunc.NOT_IN]: RuleFuncValue.TAGS,
      },
      aggregationInfo: [
        AggregationType.NOT_SHOW,
        AggregationType.FILLED,
        AggregationType.UNFILLED,
      ]
    };
  }

  getScanFormats(codeType?: 'qrcode' | 'barcode' | 'all'): Html5QrcodeSupportedFormats[] {
    codeType = codeType || this.scanInputType as any;
    if (codeType === 'qrcode') {
      return [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.DATA_MATRIX,
        // 极少使用的二维码
        // Html5QrcodeSupportedFormats.AZTEC,
        // Html5QrcodeSupportedFormats.PDF_417,
        // Html5QrcodeSupportedFormats.MAXICODE
      ];
    } else if (codeType === 'barcode') {
      return [
        // 常用的条形码 (按照使用频率从高到低排序)
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.CODE_39,
        // 极少使用的条形码 (注释以优化性能)
        // Html5QrcodeSupportedFormats.CODABAR,
        // Html5QrcodeSupportedFormats.CODE_93,
        // Html5QrcodeSupportedFormats.UPC_EAN_EXTENSION,
        // Html5QrcodeSupportedFormats.RSS_14,
        // Html5QrcodeSupportedFormats.RSS_EXPANDED
      ];
    }
    return undefined; // all
  }

  checkScanFormatValidity(detectedFormat: Html5QrcodeSupportedFormats): boolean {
    const codeType = this.scanInputType as any;
    if (!codeType || codeType === 'all') return true;

    if (codeType === 'qrcode') {
      return this.getScanFormats(codeType).includes(detectedFormat);
    }
    if (codeType === 'barcode') {
      return this.getScanFormats(codeType).includes(detectedFormat);
    }
    return true;
  }

  command(cmd: string) {
    if (cmd === "focus") {
      this._inputInstance?.focus();
    } else if (cmd === "select") {
      this._inputInstance?.select();
    }
  }
}

