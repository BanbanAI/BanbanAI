import { ADDED_CUSTOM_OPTION_COLOR, TheWidget as TreeSelect } from "@renderer/widgets/form/treeSelect";
import { unique } from "@common/utils/unique";
import { FormElementConfiguration, RuleFunc, RuleFuncValue } from "@common/types/nocode";
import { DefinedOptions } from "@renderer/b2/types";
import i18next from "@renderer/widgets/i18next";
import resource from "./locales";

const defaultColoredArray = {
  get options() {
    return [
      {
        label: i18next.t("defaultOption1"),
        value: i18next.t("defaultOption1"),
      },
      {
        label: i18next.t("defaultOption2"),
        value: i18next.t("defaultOption2"),
      },
      {
        label: i18next.t("defaultOption3"),
        value: i18next.t("defaultOption3"),
      },
    ];
  },
};

type CheckboxItem = {
  id?: string;
  label: string;
  value: string;
  color?: string;
}

type ColorOptions = {
  options: CheckboxItem[];
  otherOptions?: { id: string; value: string };
};

export class TreeMultipleSelect extends TreeSelect {
  static resource = resource as any;

  get defaultName() {
    return i18next.t("defaultName");
  }

  get isMultiple(): boolean {
    return true;
  }

  static defineOptions(): DefinedOptions[] {
    const optionText = i18next.t("optionName");
    return [{
      style: {
        basicStyle: {
          children: [
            {
              name: "width-subform",
              default: 320,
            },
            {
              name: "placeholder",
              alias: i18next.t("placeholderLabel"),
              default: i18next.t("treeSelectPlaceholder"),
              type: "string",
            },
            {
              name: "treeselect-value-text-option",
              alias: i18next.t("treeselectOptions"),
              type: `colored-array(multiple, draggable, defaultString=${optionText})`,
              default: (widget: TreeMultipleSelect) => {
                return {options: widget?.field?.meta?.extra?.choices || defaultColoredArray.options};
              },
            },
          ],
        },
        validation: {
          children: [
            {
              name: "option-count",
              alias: i18next.t("optionCountLimit"),
              type: "boolean",
              default: false,
            },
            {
              name: "option-count-range",
              alias: i18next.t("optionCountRange"),
              default: [0, 100],
              type: "vector<min,max>(min=0)",
              visible: (widget: TreeMultipleSelect) => {
                return widget.getOption<boolean>("option-count");
              },
              beforeChange: (widget, value) => {
                return value && value[0] <= value[1];
              }
            },
          ]
        }
      },

    },
    ...super.defineOptions(),
    ];
  }

  get optionLimit() {
    return this.getOption<boolean>("option-count");
  }
  get maxCount() {
    if (!this.optionLimit) {
      return null;
    }
    const [min, max] = this.getOption<[number, number]>("option-count-range");
    return max;
  }

  get fieldType() {
    return "array";
  }

  onFillData(value: string[]) {
    if (this.isDataFill) {
      super.onFillData(value);
    } else {
      if(this.isInitOption.value) {
        this.setInputValue(value);
      }
      this.fillValue.value = value
    }
  }

  public transformValue(value: any): string[] {
    return this.normalizeRuntimeMultipleValues(value);
  }

  public get checkedValue() {
    const value = this.customOption.checkedValue;
    if (!Array.isArray(value)) return [];

    const opts = this.customOption.options.filter(opt => value.includes(opt.value));
    return opts?.map(opt => opt.value) ?? [];
  }

  public get inputValue(): string[] {
    let value = this._inputValue.value ?? this.initialValue ?? this.checkedValue;

    const otherLabel = this.customOption.otherOptions?.value;
    value = this.transformValue(value);
    const optionValues = this.getPrimaryTreeListByValues(value).map(item => item.value);
    const realValues = value.filter(v => optionValues.includes(v));
    const otherVal = value.find(v => !optionValues.includes(v));
    if (otherLabel && otherVal) {
      realValues.push(otherVal);
      this._otherInputVal.value = otherVal;
    }
    return this.choicesType !== "custom" ? value : realValues;
  }

  public clearValue() {
    this.inputValue = [];
  }

  setInputValue(value: string | string[]): void {
    value = this.transformValue(value);
    if (this.choicesType !== "custom") {
      this._inputValue.value = value;
      return;
    }

    this.rememberRuntimeCustomOptions(value);

    const realValues: string[] = [];
    const otherLabel = this.customOption.otherOptions?.value;
    const optionValues = this.getPrimaryTreeListByValues(value).map(item => item.value);
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

  public set inputValue(value: string | string[]) {
    this.setInputValue(value);
    this.updateLastChangeTime();
  }

  override setInputValueNotChanged(value: string | string[]) {
    this.fillValue.value = value;
    this.setInputValue(value)
  }

  public get otherInputVal() {
    if (!this._otherInputVal.value) {
      let currentValues = this.transformValue(this._inputValue.value);
      const optionValues = this.getPrimaryTreeListByValues(currentValues).map(item => item.value);
      if (!currentValues) return "";
      const otherVal = currentValues.find(val => !optionValues.includes(val));
      if (otherVal && this.customOption.otherOptions?.value) {
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

  public updateOtherInputValue(val: string) {
    this._otherInputVal.value = val;

    const optionValues = this.getPrimaryTreeListByValues(this.inputValue).map(item => item.value);
    const currentValues = this.inputValue.filter(v => optionValues.includes(v));

    if (val) {
      currentValues.push(val);
    }

    this._inputValue.value = currentValues;
    this.updateLastChangeTime();
  }

  public appendCustomOption(value: string, appendedChoice?: Partial<CheckboxItem>) {
    const choice = super.appendCustomOption(value, appendedChoice);
    if (!choice) return null;
    return {
      ...choice,
      color: choice.color ?? ADDED_CUSTOM_OPTION_COLOR,
    };
  }

  resolveFormSetting() {
    const options = this.getOption<ColorOptions>("treeselect-value-text-option");
    const extra = super.resolveFormSetting().extra || {};
    return {
      ...super.resolveFormSetting(),
      extra: {
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
        [RuleFunc.CONTAIN_ANY]: RuleFuncValue.TAGS,
        [RuleFunc.CONTAIN_ALL]: RuleFuncValue.TAGS,
        [RuleFunc.NOT_CONTAIN]: RuleFuncValue.TAGS,
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
      }
    };
  }
}

