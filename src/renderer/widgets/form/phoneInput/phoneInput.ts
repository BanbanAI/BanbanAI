import { FormElementConfiguration, RuleFunc, RuleFuncValue } from "@common/types/nocode";
import { DefinedOptions, OptionFileValue } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { FormElement } from "@renderer/b2/controllers/form";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { Ref, ref } from "vue";
import { ElInput } from "element-plus";

export class PhoneInput extends FormElement {
  static resource = resource as any;
  protected _inputValue: Ref<string> = ref();
  private _inputInstance: InstanceType<typeof ElInput> | null = null;
  public get inputValue() {
    return this._inputValue.value ?? this.initialValue ?? this.defaultValue;
  }
  public set inputValue(value: string) {
    this._inputValue.value = value;
    this.updateLastChangeTime();
  }

  set inputInstance(instance: InstanceType<typeof ElInput> | null) {
    this._inputInstance = instance;
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
                name: "clear-button",
                alias: i18next.t("clearButton"),
                type: "boolean",
                default: false,
              },
              {
                name: "default-type",
                alias: i18next.t("defaultValue"),
                type: "select",
                selectChoices: [
                  { label: i18next.t("custom"), value: "custom" },
                  { label: i18next.t("formulaEdit"), value: "formula" },
                ],
                default: "custom",
                visible: false,
              },
              {
                name: "default-value",
                alias: i18next.t("defaultValue"),
                type: "string",
                default: "",
              },
            ],
          },
          scanInput: {
            visible: false,
          },
          validation: {
          },
        },
      },
      ...super.defineOptions(),
    ];
  }
  protected async doValidate() {
    if (this.inputValue && !/^(?:(?:\+|00)86)?1\d{10}$/.test(this.inputValue)) {
      throw new Error(i18next.t("invalidMobilePhone"));
    }
  }
  resetValue() {
    this._inputValue.value = "";
  }
  toCssColor(color: Color) {
    return new Color(color).toCssString();
  }
  get placeholder() {
    return this.getOption<string>("placeholder");
  }
  get clearable() {
    return this.getOption<boolean>("clear-button");
  }

  get defaultValue() {
    return this.getOption<string>("default-value");
  }

  get defaultName() {
    return i18next.t("defaultName");
  }

  resolveFormSetting() {
    const extra = {
      defaultValue: this.defaultValue,
    }

    return {
      ...super.resolveFormSetting(),
      extra: {
        ...(super.resolveFormSetting()?.extra || {}),
        ...extra,
      }
    };
  }

  getConfigurations(): FormElementConfiguration {
    return {
      subType: "phone",
      funcInfo: {
        [RuleFunc.EQUAL]: RuleFuncValue.SELECT,
        [RuleFunc.NOT_EQUAL]: RuleFuncValue.SELECT,
        [RuleFunc.IN]: RuleFuncValue.SELECT_MULTIPLE,
        [RuleFunc.NOT_IN]: RuleFuncValue.SELECT_MULTIPLE,
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
      },
      // 编辑表单时使用的筛选判断条件
      editFuncInfo: {
        [RuleFunc.EQUAL]: RuleFuncValue.STRING,
        [RuleFunc.NOT_EQUAL]: RuleFuncValue.STRING,
        [RuleFunc.IN]: RuleFuncValue.TAGS,
        [RuleFunc.NOT_IN]: RuleFuncValue.TAGS,
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
      }
    }
  }

  command(cmd: string) {
    if (cmd === "focus") {
      this._inputInstance?.focus();
    } else if (cmd === "select") {
      this._inputInstance?.select();
    }
  }
}
