
import { FormElementConfiguration, RuleFunc, RuleFuncValue, AggregationType } from "@common/types/nocode";
import { FormulaConfig } from "@common/utils/formula";
import { DefinedOptions } from "@renderer/b2/types";
import { Board } from "@renderer/b2/controllers/board";
import { FormElement } from "@renderer/b2/controllers/form";
import { Widget } from "@renderer/b2/controllers/widget";
import { WidgetSoul } from "@common/types/project";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { watch, Ref, ref, nextTick, defineAsyncComponent } from "vue";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { isEmpty } from "@common/utils/object";
import { processFormulaResult } from "@renderer/widgets/form/form/function";
import { FormMode } from "../_common/type";
import { useFormulaWatcher } from "@renderer/widgets/form/form/useFormulaWatcher";

dayjs.extend(customParseFormat);

export class TimePicker extends FormElement {
  static resource = resource;

  // HH:mm:ss 或 HH:mm
  protected _timeValue = ref<string>();

  constructor(soul: WidgetSoul, parent: Widget | Board){
    super(soul, parent);
  }

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
        normalizeResult: (value) => this.formatTimeValue(processFormulaResult(value, this.fieldType)),
        onApplyResult: (value) => {
          this._timeValue.value = value;
        }
      });
    });
  }

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
              name: "placeholder",
              alias: i18next.t("tipText"),
              default: i18next.t("pleaseSelect"),
              type: "string",
            },
            {
              name: "default-type",
              alias: i18next.t("defaultValue"),
              type: "select",
              selectChoices: [
                {
                  label: i18next.t("currentTime"),
                  value: "currentTime",
                },
                {
                  label: i18next.t("custom"),
                  value: "customTime",
                },
                {
                  label: i18next.t("formulaEdit"),
                  value: "formula"
                },
              ],
            },
            {
              name: "custom-time",
              alias: i18next.t("custom"),
              type: "time",
              valueType: (widget: TimePicker) => {
                return widget.getOption("time-format");
              },
              visible: (widget: TimePicker) => {
                return widget.getOption<"customTime"|"formula">("default-type") === "customTime";
              },
            },
            {
              name: "default-formula",
              alias: "",
              type: "dialog",
              dialog: {
                component: defineAsyncComponent(() => import("@renderer/views/nocode/components/global/table/components/formula/FormDefaultValueFormulaDialog.vue")),
                buttonText: (widget: TimePicker)=>{
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
              visible: (widget: TimePicker)=>{
                return widget.getOption<"customTime"|"formula">("default-type") === "formula";
              },
            },
            {
              name: "time-precision",
              alias: i18next.t("timePrecision"),
              type: "select",
              default: `HH:mm`,
              selectChoices: (widget: TimePicker) => {
                let choices = [
                  { value: "HH:mm", label: i18next.t("hourMinute") },
                  { value: "HH:mm:ss", label: i18next.t("hourMinuteSecond") },
                ]
                return choices;
              },
            },
            // {
            //   name: "time-step",
            //   alias: "时间步长",
            //   type: "select",
            //   default: "5分钟",
            //   selectChoices: (widget: TimePicker) => {
            //     let choices = [
            //       { value: "1分钟", label: "1分钟" },
            //       { value: "5分钟", label: "5分钟" },
            //       { value: "10分钟", label: "10分钟" },
            //       { value: "15分钟", label: "15分钟" },
            //       { value: "30分钟", label: "30分钟" },
            //       { value: "60分钟", label: "60分钟" },
            //     ]
            //     return choices;
            //   },
            // },
          ],
        },
        validation: {
          children: [

          ],
        },
      },
    }, ...super.defineOptions()];
  }

  get widthSubform() {
    return this.getOption("width-subform");
  }

  get placeholder() {
    return this.getOption<string>("placeholder");
  }

  get defaultValue(): string {
    const defaultType = this.getOption("default-type");
    if (defaultType === "currentTime") {
      return dayjs().format("HH:mm:ss");
    } else if (defaultType === "customTime") {
      const date = dayjs(this.getOption<Date>("custom-time"));
      return date.isValid() ? date.format("HH:mm:ss") : this.getOption<string>("custom-time");
    } else if (defaultType === "formula") {
      return this.getOption<string>("default-value");
    }
    return "";
  }

  set defaultValue(value: string ){
    this.setOption("default-value", value);
  }

  get format(): string {
    return this.getOption<string>("time-precision") || "HH:mm";
  }

  get timeStep(): number {
    return +this.getOption<string>("time-step").replace("分钟", "") || 1;
  }

  formatTimeValue(val: string | number | Date, format?: string): string {
    if (!val) return "";
    format = format || this.format;

    if (dayjs.isDayjs(val)) {
      return val.format(this.format);
    }

    if (val instanceof Date) {
      return dayjs(val).format(format);
    }

    if (typeof val === 'string') {
      let d = dayjs(val, this.format, true);
      if (d.isValid()) return d.format(format);

      d = dayjs(val);
      if (d.isValid()) return d.format(format);

      d = dayjs(val, ["HH:mm:ss", "HH:mm"]);
      if (d.isValid()) return d.format(format);
    }

    return "";
  }

  get timeValue() {
    if (this._timeValue.value) {
      return this._timeValue.value;
    } else if (this.initialValue) {
      const value = this.formatTimeValue(this.initialValue);
      this.inputValue = value;
      return value;
    } else {
      const value = this.formatTimeValue(this.defaultValue);
      this.inputValue = value;
      return value;
    }
  }

  set timeValue(val: string) {
    this._timeValue.value = val;
    this.updateLastChangeTime();
  }

  public get inputValue() {
    return this.timeValue;
  }

  set inputValue(value) {
    this._timeValue.value = this.formatTimeValue(value);
    this.updateLastChangeTime();
  }

  override setInputValueNotChanged(value) {
    this._timeValue.value = this.formatTimeValue(value);
  }

  public resetValue() {
    this.timeValue = "";
  }

  protected async doValidate() {
  }

  get defaultType() {
    return this.getOption<"custom"|"formula">("default-type");
  }

  get defaultFormulaValue() {
    return this.getOption<string | FormulaConfig>("default-formula");
  }

  public updateValueByFormula(value) {
    this._timeValue.value = this.formatTimeValue(value);
  }

  get defaultName() {
    return i18next.t("defaultName");
  }

  public otherTableDataCache: Record<string, Record<string, any>> = {};

  resolveFormSetting() {
    const extra = {
      format: this.format,
      defaultValueType: this.defaultType,
      defaultValue: this.defaultValue,
      formula: this.defaultFormulaValue,
    }

    return {
      ...super.resolveFormSetting(),
      subType: "time",
      extra: {
        ...(super.resolveFormSetting()?.extra || {}),
        ...extra
      }
    };
  }

  getConfigurations(): FormElementConfiguration {
    return {
      subType: "time",
      funcInfo: {
        [RuleFunc.TIME_EQUAL]: RuleFuncValue.TIME,
        [RuleFunc.TIME_NOT_EQUAL]: RuleFuncValue.TIME,
        [RuleFunc.GTE]: RuleFuncValue.TIME,
        [RuleFunc.TIME_LTE]: RuleFuncValue.TIME,
        [RuleFunc.TIME_BETWEEN]: RuleFuncValue.RANGE,
        // [RuleFunc.DYNAMIC]: RuleFuncValue.STRING,
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
      },
      // 编辑表单时使用的筛选判断条件
      editFuncInfo: {
        [RuleFunc.TIME_EQUAL]: RuleFuncValue.TIME,
        [RuleFunc.TIME_NOT_EQUAL]: RuleFuncValue.TIME,
        [RuleFunc.GTE]: RuleFuncValue.TIME,
        [RuleFunc.TIME_LTE]: RuleFuncValue.TIME,
        // [RuleFunc.DYNAMIC]: RuleFuncValue.STRING,
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.TIME_BETWEEN]: RuleFuncValue.RANGE,
      },
      aggregationInfo: [
        AggregationType.NOT_SHOW,
        AggregationType.FILLED,
        AggregationType.UNFILLED,
      ]
    }
  }
}

