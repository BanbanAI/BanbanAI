import { FormElementConfiguration, RuleFunc, RuleFuncValue } from "@common/types/nocode";
import { FormulaConfig } from "@common/utils/formula";
import { DefinedOptions } from "@renderer/b2/types";
import { FormElement, AbstractForm } from "@renderer/b2/controllers/form";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { nextTick, Ref, ref, watch, defineAsyncComponent } from "vue";
import { isEmpty } from "@common/utils/object";
import { processFormulaResult } from "@renderer/widgets/form/form/function";
import { useFormulaWatcher } from "@renderer/widgets/form/form/useFormulaWatcher";
import { FormMode } from "../_common/type";

export class TextareaInput extends FormElement {
  static resource = resource as any;

  public inputAreaValue = ref("");
  public overrideValue = ref("");
  public noEffectedLinkages = ref(null);

  initAfterConstructor() {
    super.initAfterConstructor();

    if (this.defaultType === "formula" && this.defaultFormulaValue && !this.isEditable) {
      const stop = watch(() => this.getBoard().isProjectReady, async (value) => {
        if (value) {
          this.watchDefaultFormula();
          nextTick(() => {
            stop();
          })
        }
      }, { immediate: true })
    }
  }

  get isEditMode() {
    return this.getBoard().formMode === FormMode.Edit;
  }
  private watchDefaultFormula() {
    this.effectScope.run(() => {
      useFormulaWatcher({
        formElement: this,
        formula: this.defaultFormulaValue,
        fieldType: this.fieldType,
        isEditMode: this.isEditMode,
        normalizeResult: (value) => processFormulaResult(value, this.fieldType),
        onApplyResult: (value) => {
          this._inputValue.value = value;
        }
      });
    });
  }

  static defineOptions(): DefinedOptions[] {
    return [
      {
        style: {
          basicStyle: {
            children: [
              {
                name: "width-subform",
                default: 300,
              },
              {
                name: "placeholder",
                alias: i18next.t("tipText"),
                default: i18next.t("pleaseInput"),
                type: "string",
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
              },
              {
                name: "default-value",
                alias: "",
                type: "string",
                default: "",
                visible: (widget: TextareaInput)=>{
                  return widget.getOption<"custom"|"formula">("default-type") === "custom";
                },
              },
              {
                name: "default-formula",
                alias: "",
                type: "dialog",
                dialog: {
                  component: defineAsyncComponent(() => import("@renderer/views/nocode/components/global/table/components/formula/FormDefaultValueFormulaDialog.vue")),
                  buttonText: (widget: TextareaInput)=>{
                    if (widget.getOption("default-formula")) {
                      return i18next.t("formulaSet");
                    }
                    return i18next.t("editFormula");
                  },
                  buttonStyle(element, paths) {
                    const value = element.getOption("default-formula");
                    return (isEmpty(value) || value === "") ? {} : { color: 'var(--color-primary)' }
                  },
                },
                visible: (widget: TextareaInput)=>{
                  return widget.getOption<"custom"|"formula">("default-type") === "formula";
                },
              },
            ],
          },
          scanInput: {
            visible: false,
          },
          validation: {
            children: [
              {
                name: "word-count",
                alias: i18next.t("limitWordCount"),
                type: "boolean",
                default: false,
              },
              {
                name: "word-count-range",
                alias: i18next.t("wordCountRange"),
                default: [0, 100],
                type: "vector<min,max>(min=0)",
                visible: (widget: TextareaInput) => {
                  return widget.getOption<boolean>("word-count");
                },
                beforeChange: (widget, value) => {
                  return value && value[0] <= value[1];
                }
              }
            ],
          },
        },
      },
      ...super.defineOptions(),
    ];
  }

  resetValue() {
    this.inputAreaValue.value = "";
    this.overrideValue.value = "";
  }

  // Getters
  get placeholder() {
    return this.getOption<string>("placeholder");
  }

  get wordLimit() {
    return this.getOption<boolean>("word-count");
  }

  get length() {
    if (!this.wordLimit) {
      return null;
    }
    const [min, max] = this.getOption<[number, number]>("word-count-range");
    return { min, max };
  }

  get defaultValue(): string {
    return this.getOption<string>("default-value");
  }

  protected _inputValue: Ref<string> = ref();
  public get inputValue() {
    return this._inputValue.value ?? this.initialValue ?? this.defaultValue;
  }

  public set inputValue(value: string) {
    this._inputValue.value = value;
    this.updateLastChangeTime();
  }

  protected async doValidate() {
    if (this.getOption("word-count")) {
      const range = this.getOption("word-count-range");
      if (this.inputValue.length < range[0] || this.inputValue.length > range[1]) {
        throw new Error(i18next.t("wordCountOutOfRange", { min: range[0], max: range[1] }));
      }
    }
  }

  get defaultType() {
    return this.getOption<"custom"|"formula">("default-type");
  }

  set defaultValue(value: string ){
    this.setOption("default-value", value);
  }

  get defaultFormulaValue() {
    return this.getOption<string | FormulaConfig>("default-formula");
  }

  get defaultName() {
    return i18next.t("defaultName");
  }

  // get supportFixedWidth() {
  //   return false
  // }

  public otherTableDataCache: Record<string, Record<string, any>> = {};

  resolveFormSetting() {
    return {
      ...super.resolveFormSetting(),
      extra: {
        ...(super.resolveFormSetting()?.extra || {}),
        defaultValueType: this.defaultType,
        defaultValue: this.defaultValue,
        formula: this.defaultFormulaValue,
        wordLimit: this.wordLimit,
        wordRange: this.wordLimit ? [this.length.min, this.length.max] : [],
      }
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
      // 编辑表单时使用的筛选判断条件
      editFuncInfo: {
        [RuleFunc.EQUAL]: RuleFuncValue.STRING,
        [RuleFunc.NOT_EQUAL]: RuleFuncValue.STRING,
        [RuleFunc.CONTAIN]: RuleFuncValue.STRING,
        [RuleFunc.NOT_CONTAIN]: RuleFuncValue.STRING,
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
      }
    };
  }
}

