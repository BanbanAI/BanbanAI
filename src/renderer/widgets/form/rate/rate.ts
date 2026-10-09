import { FormElementConfiguration, RuleFunc, RuleFuncValue } from "@common/types/nocode";
import { DefinedOptions } from "@renderer/b2/types";
import { FormElement } from "@renderer/b2/controllers/form";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { Ref, ref } from "vue";

export class Rate extends FormElement {
  static resource = resource as any;

  static defineOptions(): DefinedOptions[] {
    return [{
      style: {
        basicStyle: {
          children: [
            {
              name: "input-width",
              visible: false,
            },
            {
              name: "input-width-px",
              visible: false,
            },
            {
              name: "width-subform",
              default: 200,
            },
            {
              name: "max-rate",
              alias: i18next.t("maxRate"),
              type: "number(min=0)",
              default: 5,
            },
            {
              name: "rate-color",
              alias: i18next.t("rateColor"),
              type: "color",
              default: "#F7BA2A",
            },
            {
              name: "allow-half",
              alias: i18next.t("allowHalf"),
              type: "boolean",
              default: false,
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

  get maxRate() {
    return this.getOption("max-rate");
  }

  get allowHalf() {
    return this.getOption("allow-half");
  }

  get rateColor() {
    return this.getOption("rate-color");
  }

  protected _inputValue: Ref<number> = ref();
  public get inputValue() {
    if (!this._inputValue.value && this.initialValue !== undefined) {
      this._inputValue.value = Number(this.initialValue);
    }
    return this._inputValue.value;
  }
  public set inputValue(value: number) {
    this._inputValue.value = value;
    this.updateLastChangeTime();
  }

  get fieldType() {
    return "number";
  }

  get defaultName() {
    return i18next.t("defaultName");
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
      }
    };
  }
}
