import { FormElementConfiguration, RuleFunc, RuleFuncValue } from "@common/types/nocode";
import { DefinedOptions } from "@renderer/b2/types";
import { FormElement } from "@renderer/b2/controllers/form";
import { WidgetSoul } from "@common/types/project";
import { Widget } from "@renderer/b2/controllers/widget";
import { Board } from "@renderer/b2/controllers/board";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { ref } from "vue";
import { escapeUnterminatedHtmlEntities } from "./htmlEntities";

export class RichTextEditor extends FormElement {
  static resource = resource as any;

  get supportFixedWidth() {
    return false;
  }

  constructor(soul: WidgetSoul, parent: Widget | Board){
    super(soul, parent);
  }

  static defineOptions(): DefinedOptions[] {
    return [
      {
        style: {
          basicStyle: {
            children: [
              {
                name: "width-subform",
                default: 320,
              },
              {
                name: "editor-height",
                alias: i18next.t("editorHeight"),
                type: "number(min=100,unit=px)",
                default: 400,
              }
            ],
          },
        },
      },
      ...super.defineOptions(),
    ];
  }

  get editorHeight() {
    return this.getOption<number>("editor-height");
  }

  protected _inputValue = ref();
  public get inputValue(): string {
    return this._inputValue.value ?? escapeUnterminatedHtmlEntities(this.initialValue ?? "");
  }

  public set inputValue(value: string) {
    this._inputValue.value = escapeUnterminatedHtmlEntities(value ?? "<p></p>");
    this.updateLastChangeTime();
  }

  get defaultName() {
    return i18next.t("defaultName");
  }

  resolveFormSetting() {
    return {
      ...super.resolveFormSetting(),
      subType: "html",
    };
  }

  public isEmpty(): boolean {
    if (this.inputValue === "<p><br></p>") {
      return true;
    }
    return super.isEmpty();
  }

  protected async doValidate() {

  }

  getConfigurations(): FormElementConfiguration {
    return {
      funcInfo: {
        [RuleFunc.CONTAIN]: RuleFuncValue.STRING,
        [RuleFunc.NOT_CONTAIN]: RuleFuncValue.STRING,
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
      },
      // 编辑表单时使用的筛选判断条件
      editFuncInfo: {
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
      }
    };
  }
}
