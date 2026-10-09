import { FormElementConfiguration, RuleFunc, RuleFuncValue } from "@common/types/nocode";
import { DefinedOptions } from "@renderer/b2/types";
import { FormElement } from "@renderer/b2/controllers/form";
import resource from "./locales";
import { Ref, ref } from "vue";
import i18next from "@renderer/widgets/i18next";

export class TagInput extends FormElement {
  static resource = resource as any;

  get defaultName() {
    return i18next.t("defaultName");
  }

  initAfterConstructor() {
    super.initAfterConstructor();
  }

  static defineOptions(): DefinedOptions[] {
    return [
      {
        style: {
          linkForm: {
            visible: false,
          }
        }
      },
      ...super.defineOptions(),
    ]
  }

  get defaultValue(): string[] {
    return [];
  }

  protected _inputValue: Ref<string[]> = ref();
  public get inputValue(): string[] {
    let value = this._inputValue.value ?? this.initialValue ?? this.defaultValue
    return value;
  }
  public set inputValue(value) {
    this._inputValue.value = value
    this.updateLastChangeTime();
  }

  get fieldType() {
    return "array";
  }

  resolveFormSetting() {
    const options = this.inputValue;
    const extra = {};
    for (const item of options) {
      extra[item] = '#909399';
    }

    return {
      ...super.resolveFormSetting(),
      subType: "tag",
      extra: {
        ...(super.resolveFormSetting()?.extra || {}),
        ...extra,
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
    }
  }
}
