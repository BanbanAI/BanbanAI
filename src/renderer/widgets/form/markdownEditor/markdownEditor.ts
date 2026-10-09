import { FormElementConfiguration, RuleFunc, RuleFuncValue } from "@common/types/nocode";
import { DefinedOptions } from "@renderer/b2/types";
import { Board } from "@renderer/b2/controllers/board";
import { FormElement } from "@renderer/b2/controllers/form";
import { Widget } from "@renderer/b2/controllers/widget";
import { WidgetSoul } from "@common/types/project";
import { ref } from "vue";
import i18next from "@renderer/widgets/i18next";
import resource from "./locales";

export class MarkdownEditor extends FormElement {
  static resource = resource as any;

  constructor(soul: WidgetSoul, parent: Widget | Board) {
    super(soul, parent);
  }

  get supportFixedWidth() {
    return false;
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
              },
              {
                name: "storage-format",
                alias: i18next.t("storageFormat"),
                type: "select(radioGroup)",
                default: "markdown",
                selectChoices: [
                  { value: "markdown", label: i18next.t("markdownFormat") },
                  { value: "html", label: i18next.t("htmlFormat") },
                ],
              },
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

  get storageFormat(): "markdown" | "html" {
    return this.getOption<string>("storage-format") === "html" ? "html" : "markdown";
  }

  protected _inputValue = ref<string>();

  public get inputValue(): string {
    return this._inputValue.value ?? this.initialValue ?? "";
  }

  public set inputValue(value: string) {
    if (this.inputValue === (value ?? "")) return;
    this._inputValue.value = value ?? "";
    this.updateLastChangeTime();
  }

  get defaultName() {
    return i18next.t("defaultName");
  }

  resolveFormSetting() {
    return {
      ...super.resolveFormSetting(),
      subType: this.storageFormat,
    };
  }

  getConfigurations(): FormElementConfiguration {
    return {
      funcInfo: {
        [RuleFunc.CONTAIN]: RuleFuncValue.STRING,
        [RuleFunc.NOT_CONTAIN]: RuleFuncValue.STRING,
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
      },
      editFuncInfo: {
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
      },
    };
  }
}
