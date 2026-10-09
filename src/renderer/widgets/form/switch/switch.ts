import { FormElementConfiguration, RuleFunc, RuleFuncValue } from "@common/types/nocode";
import { DefinedOptions, OptionFieldValue } from "@renderer/b2/types";
import { OptionValue } from "@common/types/project";
import { FormElement } from "@renderer/b2/controllers/form";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { ref, Ref } from "vue";

export class Switch extends FormElement {
  static resource = resource as any;

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
              name: "active-text",
              alias: i18next.t("activeTextLabel"),
              type: "string",
              default: i18next.t("activeStateText")
            },
            {
              name: "inactive-text",
              alias: i18next.t("inactiveTextLabel"),
              type: "string",
              default: i18next.t("inactiveStateText")
            },
            {
              name: "inline-prompt",
              alias: i18next.t("inlinePromptLabel"),
              type: "boolean",
              default: false
            },
            {
              name: "default-value",
              alias: i18next.t("defaultValueLabel"),
              type: "boolean",
              default: false
            },
            {
              name: "input-width",
              visible: false,
            },
            {
              name: "input-width-px",
              visible: false,
            }
          ],
        },
        scanInput: {
          visible: false,
        },
        validation: {
          children: [
            {
              name: "required",
              visible: false
            },
          ],
        },
      },
    }, ...super.defineOptions()];
  }

  get defaultValue(): boolean {
    return this.getOption<boolean>("default-value");
  }

  protected _inputValue: Ref<boolean> = ref();
  public get inputValue() {
    const result = this._inputValue.value ?? this.initialValue ?? this.defaultValue;
    if (result) {
      if (typeof result === "string") {
        if (result === "true") return true;
        return result === this.activeText ? true : false;
      }
      return result;
    }
    return false;
  }
  public set inputValue(value: boolean) {
    this._inputValue.value = value;
    this.updateLastChangeTime();
  }

  get inlinePrompt() {
    return this.getOption<boolean>("inline-prompt");
  }

  get activeText() {
    return this.getOption<string>("active-text");
  }

  get inactiveText() {
    return this.getOption<string>("inactive-text");
  }

  get defaultName() {
    return i18next.t("defaultName");
  }

  public isEmpty(): boolean {
    return false;
  }

  getConfigurations(): FormElementConfiguration {
    return {
      subType: "number",
      funcInfo: {
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.TRUE]: RuleFuncValue.NULL,
        [RuleFunc.FALSE]: RuleFuncValue.NULL,
      },
      editFuncInfoText: {
        [RuleFunc.TRUE]: this.activeText,
        [RuleFunc.FALSE]: this.inactiveText,
      },
      // 编辑表单时使用的筛选判断条件
      editFuncInfo: {
        [RuleFunc.EQUAL]: RuleFuncValue.STRING,
        [RuleFunc.NOT_EQUAL]: RuleFuncValue.STRING,
        [RuleFunc.TRUE]: RuleFuncValue.NULL,
        [RuleFunc.FALSE]: RuleFuncValue.NULL,
      }
    };
  }

  resolveFormSetting() {
    const extra = {
      format: [this.activeText || i18next.t("activeStateText"), this.inactiveText || i18next.t("inactiveStateText")],
      defaultValue: this.defaultValue,
    }

    return {
      ...super.resolveFormSetting(),
      subType: "switch",
      extra: {
        ...(super.resolveFormSetting()?.extra || {}),
        ...extra
      }
    };
  }
}
