import { AggregationType, FormElementConfiguration, RuleFunc, RuleFuncValue } from "@common/types/nocode";
import { DefinedOptions, OptionFileValue } from "@renderer/b2/types";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { FormElement } from "@renderer/b2/controllers/form";
import { Ref, ref } from "vue";

export class Position extends FormElement {
  static resource = resource as any;

  get defaultName() {
    return i18next.t("defaultName");
  }

  protected _inputValue: Ref<string> = ref();
  public get inputValue() {
    return this._inputValue.value ?? this.initialValue ?? this.defaultValue;
  }
  public set inputValue(value: string) {
    this._inputValue.value = value;
    this.updateLastChangeTime();
  }
  get currentValue() {
    return this.positionValue;
  }

  static defineOptions(): DefinedOptions[] {
    return [
      {
        style: {
          basicStyle: {
            children: [
              {
                name: "input-width",
                alias: i18next.t("inputWidth"),
              },
              {
                name: "width-subform",
                default: 200,
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
                name: "map-key",
                alias: i18next.t("stPlaceholder"),
                tip: i18next.t("stPlaceholderTip"),
                default: '',
                type: "string"
              },
              {
                name: "clear-button",
                alias: i18next.t("clearButton"),
                type: "boolean",
                default: true,
              },
              {
                name: "show-coordinates",
                alias: i18next.t("showCoordinates"),
                type: "boolean",
              },
              {
                name: "default-value",
                alias: i18next.t("defaultValue"),
                type: "string",
              },
              {
                name: "auto-position",
                alias: i18next.t("autoPosition"),
                type: "boolean",
                visible: (widget: Position) => {
                  return widget.getOption("default-type") === "custom";
                }
              }
            ]
          },
          scanInput: {
            visible: false,
          },
          validation: {
          },
          linkForm: {
            visible: false,
          },
        },
      },
      ...super.defineOptions(),
    ];
  }

  public noEffectedLinkages = ref(null);


  get positionValue(): string {
    return this.inputValue;
  }

  get defaultValue(): string {
    return this.getOption<string>("default-value");
  }

  getIconUrl(iconKey: string): string {
    const iconOption = this.getOption<OptionFileValue>(iconKey);
    if (iconOption?.url) return iconOption.url;

    if (iconOption?.relativePath) {
      const projectId = this.getBoard().projectId;
      return `${projectId}/${iconOption.relativePath}`;
    }

    return "";
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
      funcInfo: {
        [RuleFunc.BELONG]: RuleFuncValue.ADDRESS,
        [RuleFunc.NOT_BELONG]: RuleFuncValue.ADDRESS,
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
      },
      // 编辑表单时使用的筛选判断条件
      editFuncInfo: {
        [RuleFunc.BELONG]: RuleFuncValue.ADDRESS,
        [RuleFunc.NOT_BELONG]: RuleFuncValue.ADDRESS,
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
      },
      aggregationInfo: [
        AggregationType.NOT_SHOW,
        AggregationType.FILLED,
        AggregationType.UNFILLED,
      ]
    };
  }
}
