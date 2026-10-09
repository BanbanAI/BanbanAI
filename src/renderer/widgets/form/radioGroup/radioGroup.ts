import { FormElementConfiguration, RuleFunc, RuleFuncValue, AggregationType } from "@common/types/nocode";
import { OptionFieldUID } from "@common/types/project";
import { unique } from "@common/utils/unique";
import { DefinedOptions, OptionFieldValue, OptionFileValue } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { Soul } from "@common/types/project";
import { FormElement } from "@renderer/b2/controllers/form";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { watch, Ref, ref } from "vue";
import { equals, isEmpty } from "@common/utils/object";

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

export type RadioGroupItem = {
  label?: string;
  value: string;
  color?: string;
};

type ColorOptions = {
  checkedValue?: string;
  isColored: boolean;
  options: RadioGroupItem[];
  otherOptions?: { id: string; value: string };
};

export class RadioGroup extends FormElement {
  static resource = resource as any;
  isOther = ref(false);
  public get radioLayout(): "horizontal" | "vertical" {
    return this.getOption<"horizontal" | "vertical">("layout") || "horizontal";
  }

  public get customOption(): ColorOptions {
    return this.getOption<ColorOptions>("radiogroup-value-text-color-option");
  }

  public get openBgColor(): boolean {
    return this.customOption.isColored;
  }

  static defineOptions(): DefinedOptions[] {
    const optionText = i18next.t("optionName");
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
              default: i18next.t("pleaseSelect"),
              type: "string",
            },
            {
              name: "layout",
              alias: i18next.t("layoutType"),
              type: "select(radioGroup)",
              default: "horizontal",
              selectChoices: [
                {
                  value: "horizontal",
                  label: i18next.t("horizontal"),
                },
                {
                  value: "vertical",
                  label: i18next.t("vertical"),
                },
              ],
            },
            {
              name: "radiogroup-value-text-color-option",
              alias: i18next.t("optionName"),
              type: `colored-array(draggable, defaultString=${optionText})`,
              default: (widget: RadioGroup) => {
                return {options: widget?.field?.meta?.extra?.choices || defaultColoredArray.options};
              },
              visible: (widget: RadioGroup) => {
                // TODO: 数据字段
                return true;
              },
            },
            {
              name: "supported-to-uncheck",
              alias: i18next.t("clickToUnselect"),
              tip: i18next.t("clickToUnselectTip"),
              type: "boolean",
              default: true,
              visible: false,
            },
          ],
        },
        validation: {
          children: [

          ],
        },
      },
    }, ...super.defineOptions()];
  }

  get supportFixedWidth() {
    return false;
  }

  public get placeholder() {
    return this.getOption<string>("placeholder");
  }

  public get isSupportedToUncheck() {
    return this.getOption<boolean>("supported-to-uncheck");
  }

  public get radioList(): RadioGroupItem[] {
    return this.customOption.options;
  }

  public get defaultId() {
    return this.customOption.checkedValue;
  }

  private _otherInputVal: Ref<string> = ref();
  public get otherInputVal() {
    if (this._otherInputVal.value === undefined || this._otherInputVal.value === null) {
      const radio = this.radioList.find((item) => item.value === this.initialValue);
      if (!radio && this.customOption.otherOptions?.value) {
        return this.initialValue;
      }
    }
    return this._otherInputVal.value;
  }
  public set otherInputVal(value: string) {
    this._otherInputVal.value = value;
    this.updateLastChangeTime();
  }

  public get checkedValue(): string {
    const value = this.customOption.checkedValue;
    if (!value) return null;

    const matched = this.radioList.find(item => item.value === value);
    if (matched) return matched.value;
    if (this.customOption.otherOptions?.id === value) return this.customOption.otherOptions.value;
    return null;
  }

  protected _inputValue = ref(null);
  public get inputValue() {
    let value = this._inputValue.value ?? this.initialValue ?? this.checkedValue;
    this.isOther.value = false;
    if (!this.radioList.some(item => item.value === value) && !isEmpty(this.customOption?.otherOptions) && value) {
      this.isOther.value = true;
      value = this.otherInputVal ?? "";
    }
    return value || null;
  }
  public set inputValue(value: string) {
    this.setInputValueNotChanged(value);
    this.updateLastChangeTime();
  }

  override setInputValueNotChanged(value: string) {
    if(value === null || value === undefined) {
      this._inputValue.value = null
      return
    };
    const matched = this.radioList.find(item => item.value === value);
    const otherOption = this.customOption.otherOptions;
    if (matched) {
      this._inputValue.value = matched.value;
    } else if (otherOption) {
      this._inputValue.value = otherOption.value;
      this.otherInputVal = value;
    }
  }

  cleanInputValue() {
    this._inputValue.value = "";
    this.otherInputVal = "";
    this.updateLastChangeTime();
  }


  get defaultName() {
    return i18next.t("defaultName");
  }

  toCssColor(color: Color) {
    return new Color(color).toCssString();
  }

  resolveFormSetting() {
    const options = this.getOption<ColorOptions>("radiogroup-value-text-color-option");
    const extra = super.resolveFormSetting().extra || {};
    const formSetting = {...super.resolveFormSetting()}
    if (options.isColored) {
      for (const item of options.options) {
        extra[item.value] = item.color;
      }
      formSetting.subType = 'tag'
    }
    return {
      subType: "text",
      ...formSetting,
      extra: {
        ...(super.resolveFormSetting()?.extra || {}),
        ...extra,
        choices: this.radioList,
        defaultValueType: "custom",
        defaultValue: this.checkedValue,
      },
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
}
