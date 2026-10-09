import { FormElementConfiguration, RuleFunc, RuleFuncValue } from "@common/types/nocode";
import { DefinedOptions } from "@renderer/b2/types";
import { FormElement } from "@renderer/b2/controllers/form";
import { Ref, ref } from "vue";
import i18next from "@renderer/widgets/i18next";
import resource from "./locales";

export class HandwrittenSignature extends FormElement {
  static resource = resource as any;

  get defaultName() {
    return i18next.t("defaultName");
  }

  static defineOptions(): DefinedOptions[] {
    return [
      {
        style: {
          scanInput: {
            visible: false
          },
          fieldsControl: {
            children: [
              {
                name: "field-filling",
                visible: false
              }
            ]
          },
          linkForm: {
            visible: false
          },
          validation: {
            children: [
              {
                name: "unique",
                visible: false
              }
            ]
          }
        }
      },
      ...super.defineOptions()
    ];
  }

  protected _inputValue: Ref<string> = ref();

  get inputValue(): string {
    return this._inputValue.value ?? (typeof this.initialValue === "string" ? this.initialValue : "");
  }

  set inputValue(value: string) {
    this._inputValue.value = value || "";
    this.updateLastChangeTime();
  }

  clearValue() {
    this.inputValue = "";
  }

  get fieldType() {
    return "string";
  }

  resolveFormSetting() {
    return {
      ...super.resolveFormSetting(),
      subType: "signature",
      extra: {
        ...(super.resolveFormSetting()?.extra || {})
      }
    };
  }

  getConfigurations(): FormElementConfiguration {
    return {
      subType: "signature",
      funcInfo: {
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL
      },
      editFuncInfo: {
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL
      }
    };
  }
}
