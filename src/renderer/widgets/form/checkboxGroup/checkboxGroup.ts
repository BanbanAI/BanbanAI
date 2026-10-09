import { unique } from "@common/utils/unique";
import { FormElementConfiguration, RuleFunc, RuleFuncValue } from "@common/types/nocode";
import { DefinedOptions, OptionFieldValue } from "@renderer/b2/types";
import { FormElement } from "@renderer/b2/controllers/form";
import { Color } from "@renderer/b2/color";

import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { Ref, ref } from "vue";

export interface CheckboxItem {
  id?: string;
  label: string;
  value: string;
  color?: string;
}

type ColorOptions = {
  checkedValue?: string;
  isColored: boolean;
  options: CheckboxItem[];
  otherOptions?: { id: string; value: string };
};

const defaultCheckboxList = {
  get options() {
    return [
      {
        label: `${i18next.t('option')}1`,
        value: `${i18next.t('option')}1`,
      },
      {
        label: `${i18next.t('option')}2`,
        value: `${i18next.t('option')}2`,
      },
      {
        label: `${i18next.t('option')}3`,
        value: `${i18next.t('option')}3`,
      },
    ]
  }
};
const runtimeCustomOptionColors = [
  "rgba(16, 204, 85, 1)",
  "rgba(18, 184, 178, 1)",
  "rgba(31, 128, 255, 1)",
  "rgba(127, 102, 255, 1)",
  "rgba(202, 94, 235, 1)",
  "rgba(242, 97, 189, 1)",
  "rgba(255, 92, 97, 1)",
  "rgba(255, 158, 31, 1)",
  "rgba(178, 209, 25, 1)",
  "rgba(89, 214, 51, 1)",
];

export const ADDED_CUSTOM_OPTION_COLOR = "#909399";
export class CheckboxGroup extends FormElement {
  static resource = resource as any;

  get checkboxList(): CheckboxItem[] {
    return this.getRuntimeCheckboxList();
  }

  static defineOptions(): DefinedOptions[] {
    return [{
      style: {
        basicStyle: {
          children: [
            {
              name: "width-subform",
              default: 320,
            },
            {
              name: "layout",
              alias: i18next.t('arrangeType'),
              type: "select(radioGroup)",
              selectChoices: [
                { label: i18next.t('row'), value: "row" },
                { label: i18next.t('column'), value: "column" },
              ],
              default: "row",
            },
            {
              name: "checkbox-option",
              alias: i18next.t('option'),
              type: `colored-array(multiple, draggable, defaultString=${i18next.t('option')})`,
              default: (widget: CheckboxGroup) => {
                return {options: widget?.field?.meta?.extra?.choices || defaultCheckboxList.options};
              },
            },
            {
              name: "allow-add-custom-option",
              alias: i18next.t("allowAddCustomOption"),
              type: "boolean",
              default: false,
              beforeChange: (widget: CheckboxGroup, value) => {
                if (!value) {
                  widget.setOption("persist-added-custom-option", false);
                }
                return true;
              },
            },
            {
              name: "persist-added-custom-option",
              alias: i18next.t("persistAddedCustomOption"),
              type: "boolean",
              default: false,
              visible: (widget: CheckboxGroup) => {
                return widget.allowAddCustomOption;
              },
            },
          ],
        },
        scanInput: {
          visible: false,
        },
        validation: {
          children: [
            {
              name: "option-count",
              alias: i18next.t('limitOptionCount'),
              type: "boolean",
              default: false,
            },
            {
              name: "option-count-range",
              alias: i18next.t('optionRange'),
              default: [0, 100],
              type: "vector<min,max>(min=0)",
              visible: (widget: CheckboxGroup) => {
                return widget.getOption<boolean>("option-count");
              },
              beforeChange: (widget, value) => {
                return value && value[0] <= value[1];
              }
            },
          ]
        },
      },
    }, ...super.defineOptions()];
  }

  get supportFixedWidth() {
    return false;
  }

  get optionLimit() {
    return this.getOption<boolean>("option-count");
  }

  get optionLength() {
    if (!this.optionLimit) {
      return null;
    }
    const [min, max] = this.getOption<[number, number]>("option-count-range");
    return {
      min,
      max,
    }
  }


  get checkAll() {
    return this.getOption<boolean>("check-all");
  }

  get boxLayout() {
    return this.getOption<"row"|"column">("layout");
  }

  get openBgColor() {
    return this.checkboxOption.isColored;
  }

  get allowAddCustomOption() {
    return this.getOption<boolean>("allow-add-custom-option");
  }

  get persistAddedCustomOption() {
    return this.allowAddCustomOption && this.getOption<boolean>("persist-added-custom-option");
  }

  get canAddCustomOptionInRuntime() {
    return this.allowAddCustomOption && !this.checkboxOption.otherOptions?.value;
  }

  private getRuntimeCustomOptionColor(index: number) {
    return runtimeCustomOptionColors[index % runtimeCustomOptionColors.length] ?? ADDED_CUSTOM_OPTION_COLOR;
  }

  get checkboxOption(): ColorOptions {
    return this.getOption<ColorOptions>("checkbox-option");
  }

  get defaultName() {
    return i18next.t("defaultName");
  }

  public get checkedValue() {
    const value = this.checkboxOption.checkedValue;
    if (!Array.isArray(value)) return [];

    const opts = this.checkboxOption.options.filter(opt => value.includes(opt.value));
    return opts?.map(opt => opt.value) ?? [];
  }

  private normalizeInputValue(value: string | string[]): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);

    const optionValues = (this.checkboxOption.options ?? defaultCheckboxList.options).map(item => item.value);
    if (optionValues.includes(value)) {
      return [value];
    }
    return value.split(",").filter(Boolean);
  }

  private _runtimeCustomOptionsSessionKey = "";
  private _runtimeCustomOptions: Ref<CheckboxItem[]> = ref([]);

  private createRuntimeCustomOption(value: string, color = ADDED_CUSTOM_OPTION_COLOR, id = unique()): CheckboxItem {
    return {
      id,
      label: value,
      value,
      color,
    };
  }

  private getRuntimeCustomOptionsSeedValues() {
    return this.normalizeInputValue(this.initialValue ?? this.checkedValue);
  }

  private getRuntimeCustomOptionsSeedKey() {
    return JSON.stringify(this.getRuntimeCustomOptionsSeedValues());
  }

  private getSeedRuntimeCustomOptions() {
    const baseOptions = this.checkboxOption.options ?? defaultCheckboxList.options;
    const optionValues = new Set(baseOptions.map(item => item.value));
    const runtimeValues = new Set<string>();
    const runtimeOptions: CheckboxItem[] = [];

    this.getRuntimeCustomOptionsSeedValues().forEach(item => {
      if (!item || optionValues.has(item) || runtimeValues.has(item)) return;
      runtimeOptions.push(this.createRuntimeCustomOption(item, this.getRuntimeCustomOptionColor(runtimeOptions.length)));
      runtimeValues.add(item);
    });

    return runtimeOptions;
  }

  private getSessionRuntimeCustomOptions() {
    if (!this.canAddCustomOptionInRuntime) return [];
    if (this._runtimeCustomOptionsSessionKey !== this.getRuntimeCustomOptionsSeedKey()) {
      return [];
    }
    return this._runtimeCustomOptions.value;
  }

  private rememberRuntimeCustomOptions(values: string[]) {
    if (!this.canAddCustomOptionInRuntime) {
      this._runtimeCustomOptionsSessionKey = "";
      this._runtimeCustomOptions.value = [];
      return;
    }

    const sessionKey = this.getRuntimeCustomOptionsSeedKey();
    const baseOptions = this.checkboxOption.options ?? defaultCheckboxList.options;
    const optionValues = new Set(baseOptions.map(item => item.value));
    const seedValues = new Set(this.getSeedRuntimeCustomOptions().map(item => item.value));
    const runtimeOptions = this._runtimeCustomOptionsSessionKey === sessionKey ? [...this._runtimeCustomOptions.value] : [];
    const runtimeValues = new Set(runtimeOptions.map(item => item.value));

    values.forEach(item => {
      if (!item || optionValues.has(item) || seedValues.has(item) || runtimeValues.has(item)) return;
      runtimeOptions.push(this.createRuntimeCustomOption(item, this.getRuntimeCustomOptionColor(runtimeOptions.length)));
      runtimeValues.add(item);
    });

    this._runtimeCustomOptionsSessionKey = sessionKey;
    this._runtimeCustomOptions.value = runtimeOptions;
  }

  private getRuntimeCheckboxList(value = this.normalizeInputValue(this._inputValue.value ?? this.initialValue ?? this.checkedValue)) {
    const options = [...(this.checkboxOption.options ?? defaultCheckboxList.options)];
    if (!this.canAddCustomOptionInRuntime) {
      return options;
    }

    const optionValues = new Set(options.map(item => item.value));
    const runtimeOptions = [
      ...this.getSeedRuntimeCustomOptions(),
      ...this.getSessionRuntimeCustomOptions(),
    ];
    runtimeOptions.forEach(item => {
      if (optionValues.has(item.value)) return;
      options.push(item);
      optionValues.add(item.value);
    });
    return options;
  }

  public appendCustomOption(value: string, appendedChoice?: Partial<CheckboxItem>) {
    const optionValue = value?.trim?.();
    if (!optionValue) return null;

    const options = this.checkboxOption.options ?? defaultCheckboxList.options;
    const existed = options.find(item => item.value === optionValue);
    if (existed) {
      return existed;
    }

    const choice = {
      ...this.createRuntimeCustomOption(
        optionValue,
        appendedChoice?.color ?? this.getRuntimeCustomOptionColor(options.length),
        appendedChoice?.id,
      ),
      label: appendedChoice?.label?.trim?.() || optionValue,
    };
    this.setOption("checkbox-option", {
      ...this.checkboxOption,
      options: [...options, choice],
    });
    this._runtimeCustomOptions.value = this._runtimeCustomOptions.value.filter(item => item.value !== optionValue);
    return choice;
  }

  public async persistCustomOption(value: string) {
    const optionValue = value?.trim?.();
    if (!optionValue || !this.persistAddedCustomOption) return;

    const projectContext = (this.getBoard() as any)?.projectContext;
    const choice = this.createRuntimeCustomOption(
      optionValue,
      this.getRuntimeCustomOptionColor((this.checkboxOption.options ?? defaultCheckboxList.options).length),
    );
    if (projectContext?.queueFormFieldChoiceAppend) {
      projectContext.queueFormFieldChoiceAppend({
        tableUID: this.form?.tableUID?.[1],
        rootTableUID: this.topForm?.tableUID?.[1],
        fieldId: this.fieldId,
        widgetUID: this.uid,
        choice,
      });
    }
    this.appendCustomOption(optionValue, choice);
  }
  protected _inputValue: Ref<string[]> = ref();
  public get inputValue() {
    let value = this._inputValue.value ?? this.initialValue ?? this.checkedValue;

    const otherLabel = this.checkboxOption.otherOptions?.value;
    value = this.normalizeInputValue(value);
    const optionValues = this.getRuntimeCheckboxList(value).map(item => item.value);
    const realValues = value.filter(v => optionValues.includes(v));
    const otherVal = value.find(v => !optionValues.includes(v));
    if (otherLabel && otherVal) {
      realValues.push(otherVal);
      this._otherInputVal.value = otherVal;
    }
    // console.log("get inputValue", realValues);
    return realValues;
  }

  public clearValue() {
    this.inputValue = [];
  }


  public set inputValue(value: string[]) {
    this.setInputValueNotChanged(value);
    this.updateLastChangeTime();
  }

  override setInputValueNotChanged(value: string[]) {
    const otherLabel = this.checkboxOption.otherOptions?.value;
    const realValues: string[] = [];

    value = this.normalizeInputValue(value);
    this.rememberRuntimeCustomOptions(value);
    const optionValues = this.getRuntimeCheckboxList(value).map(item => item.value);
    value.forEach(v => {
      if (optionValues.includes(v)) {
        realValues.push(v);
      } else if (otherLabel) {
        realValues.push(v);
        this._otherInputVal.value = v;
      }
    });

    this._inputValue.value = realValues;
  }

  private _otherInputVal: Ref<string> = ref();
  public get otherInputVal() {
    if (!this._otherInputVal.value) {
      const currentValues = this._inputValue.value;
      if (!currentValues) return "";
      const optionValues = this.checkboxList.map(item => item.value);
      const otherVal = currentValues.find(val => !optionValues.includes(val));
      if (otherVal && this.checkboxOption.otherOptions?.value) {
        return otherVal;
      }
      return "";
    }
    return this._otherInputVal.value;
  }

  public set otherInputVal(value: string) {
    this.updateOtherInputValue(value);
    this.updateLastChangeTime();
  }

  public cleanInputValue() {
    this._inputValue.value = [];
    this._otherInputVal.value = "";
    this.updateLastChangeTime();
  }

  public updateOtherInputValue(val: string) {
    this._otherInputVal.value = val;

    const optionValues = this.checkboxList.map(item => item.value);
    const currentValues = this.inputValue.filter(v => optionValues.includes(v));

    if (val) {
      currentValues.push(val);
    }

    this._inputValue.value = currentValues;
    this.updateLastChangeTime();
  }

  async doValidate() {
    if (this.optionLimit) {
      const { min, max } = this.optionLength;
      if (this.inputValue.length < min || this.inputValue.length > max) {
        throw new Error(`${i18next.t('needSelect')}${min}~${max}${i18next.t('item')}`);
      }
    }
  }

  toCssColor(color: Color) {
    return new Color(color).toCssString();
  }

  get fieldType() {
    return "array";
  }

  resolveFormSetting() {
    const options = this.getOption<ColorOptions>("checkbox-option");
    const extra = super.resolveFormSetting().extra || {};
    const formSetting = {...super.resolveFormSetting()}
    if (options.isColored) {
      for (const item of options.options) {
        extra[item.value] = item.color;
      }
      formSetting.subType = 'tag'
    }
    return {
      ...formSetting,
      extra: {
        ...(super.resolveFormSetting()?.extra || {}),
        ...extra,
        choices: options.options,
        defaultValueType: "custom",
        defaultValue: this.checkedValue,
      },
    };
  }

  getConfigurations(): FormElementConfiguration {
    return {
      funcInfo: {
        [RuleFunc.CONTAIN_ANY]: RuleFuncValue.SELECT_MULTIPLE,
        [RuleFunc.CONTAIN_ALL]: RuleFuncValue.SELECT_MULTIPLE,
        [RuleFunc.NOT_CONTAIN]: RuleFuncValue.SELECT_MULTIPLE,
        [RuleFunc.EQUAL]: RuleFuncValue.SELECT_MULTIPLE,
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
      },
      // 编辑表单时使用的筛选判断条件
      editFuncInfo: {
        [RuleFunc.CONTAIN_ANY]: RuleFuncValue.SELECT_MULTIPLE,
        [RuleFunc.CONTAIN_ALL]: RuleFuncValue.SELECT_MULTIPLE,
        [RuleFunc.NOT_CONTAIN]: RuleFuncValue.SELECT_MULTIPLE,
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
      }
    }
  }
}
