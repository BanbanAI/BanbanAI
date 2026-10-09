import { FormElementConfiguration, RuleFunc, RuleFuncValue, AggregationType } from "@common/types/nocode";
import { replaceByFormula, evaluateFormula, findIdByFormula, FormulaConfig } from "@common/utils/formula";
import { DefinedOptions } from "@renderer/b2/types";
import { FormElement } from "@renderer/b2/controllers/form";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { ref, watch, Ref, nextTick, defineAsyncComponent } from "vue";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { isEmpty } from "@common/utils/object";
import { processFormulaResult } from "@renderer/widgets/form/form/function";
import { useFormulaWatcher } from "@renderer/widgets/form/form/useFormulaWatcher";
import { FormMode } from "../_common/type";
import "dayjs/locale/zh-cn";
import "dayjs/locale/en";
import { smartDayjs } from "./utils";
import { DateValue, DatePickerValue, DateStyle, DatePartMap } from "./types";

dayjs.extend(customParseFormat);

// 定义支持的显示风格
const DATE_STYLES = [
  { label: "2026年1月1日", value: DateStyle.ZH_CN },
  { label: "2026-01-01", value: DateStyle.HYPHEN },
  { label: "01/01/2026", value: DateStyle.SLASH },
  { label: "Jan 1, 2026", value: DateStyle.EN_SHORT },
  { label: "January 1, 2026", value: DateStyle.EN_LONG },
];

const DATE_PART_MAP: DatePartMap = {
  [DateStyle.ZH_CN]: {
    year: 'YYYY年',
    month: 'YYYY年M月',
    date: 'YYYY年M月D日',
    datetime: 'YYYY年M月D日'
  },
  [DateStyle.HYPHEN]: {
    year: 'YYYY',
    month: 'YYYY-MM',
    date: 'YYYY-MM-DD',
    datetime: 'YYYY-MM-DD'
  },
  [DateStyle.SLASH]: {
    year: 'YYYY',
    month: 'MM/YYYY',
    date: 'MM/DD/YYYY',
    datetime: 'MM/DD/YYYY'
  },
  [DateStyle.EN_SHORT]: {
    year: 'YYYY',
    month: 'MMM, YYYY',
    date: 'MMM D, YYYY',
    datetime: 'MMM D, YYYY'
  },
  [DateStyle.EN_LONG]: {
    year: 'YYYY',
    month: 'MMMM, YYYY',
    date: 'MMMM D, YYYY',
    datetime: 'MMMM D, YYYY'
  }
};

export class DatePicker extends FormElement {
  static resource = resource as any;

  public currentDateValue = ref<DatePickerValue>();

  protected _calendarRange = ref<DatePickerValue>();
  resetValue() {
    this.inputValue = "";
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
        normalizeResult: (value) => this.normalizeFormulaResult(value),
        onApplyResult: (value) => {
          this._calendarRange.value = value;
        }
      });
    });
  }

  get precision() {
    return this.calendarType.replace('range', '');
  }

  get calendarType() {
    const format = this.getOption<string>("date-format");
    if (format === 'datetime-minute') return 'datetime';
    if (format === 'datetimerange-minute') return 'datetimerange';
    return format;
  }

  get includesTime() {
    return this.calendarType.includes('time');
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
                alias: i18next.t('tipText'),
                default: i18next.t('pleaseSelect'),
                type: "string",
                visible: (widget: DatePicker) => {
                  return !widget.isRange;
                },
              },
              {
                name: "default-type",
                alias: i18next.t('defaultValue'),
                type: "select",
                selectChoices: [
                  {
                    label: i18next.t('none'),
                    value: "",
                  },
                  {
                    label: i18next.t('currentTime'),
                    value: "currentDate",
                  },
                  {
                    label: i18next.t('diy'),
                    value: "customDate",
                  },
                  {
                    label: i18next.t('formulaEdit'),
                    value: "formula"
                  },
                ],
                visible: (widget: DatePicker) => {
                  return !widget.isRange;
                },
              },
              {
                name: "custom-date",
                alias: i18next.t('diy'),
                type: "date",
                valueType: (widget: DatePicker) => {
                  return widget.precision;
                },
                visible: (widget: DatePicker) => {
                  return !widget.isRange && widget.getOption<""|"customDate"|"formula">("default-type") === "customDate";
                },
              },
              {
                name: "default-formula",
                alias: "",
                type: "dialog",
                dialog: {
                  component: defineAsyncComponent(() => import("@renderer/views/nocode/components/global/table/components/formula/FormDefaultValueFormulaDialog.vue")),
                  buttonText: (widget: DatePicker)=>{
                    if (widget.getOption("default-formula")) {
                      return i18next.t('formulaSet');
                    }
                    return i18next.t('editFormula');
                  },
                  buttonStyle(element, paths) {
                    const value = element.getOption("default-formula");
                    return (isEmpty(value) || value === "") ? {} : { color: 'var(--color-primary)' }
                  },
                },
                visible: (widget: DatePicker)=>{
                  return widget.getOption<""|"customDate"|"formula">("default-type") === "formula";
                },
              },
              {
                name: "date-format",
                alias: i18next.t('dateAccuracy'),
                type: "select",
                default: (widget: DatePicker) => {
                  return widget.isRange ? "daterange" : "date";
                },
                selectChoices: (widget: DatePicker) => {
                  return [
                    {
                      label: i18next.t('year'),
                      value: widget.isRange ? "yearrange" : "year",
                    },
                    {
                      label: `${i18next.t('year')}-${i18next.t('month')}`,
                      value: widget.isRange ? "monthrange" : "month",
                    },
                    {
                      label: `${i18next.t('year')}-${i18next.t('month')}-${i18next.t('day')}`,
                      value: widget.isRange ? "daterange" : "date",
                    },
                    {
                      label: `${i18next.t('year')}-${i18next.t('month')}-${i18next.t('day')} ${i18next.t('hour')}:${i18next.t('minute')}`,
                      value: widget.isRange ? "datetimerange-minute" : "datetime-minute",
                    },
                    {
                      label: `${i18next.t('year')}-${i18next.t('month')}-${i18next.t('day')} ${i18next.t('hour')}:${i18next.t('minute')}:${i18next.t('second')}`,
                      value: widget.isRange ? "datetimerange" : "datetime",
                    },
                  ];
                },
              },
              {
                name: "show-week",
                alias: i18next.t('showWeek'),
                type: "boolean",
                default: false,
                visible: (widget: DatePicker) => {
                  const datePrecision = widget.getOption<string>("date-format");
                  const basePrecision = datePrecision.replace('range', '');
                  return ["date", "datetime", "datetime-minute"].includes(basePrecision);
                }
              },
              {
                name: "time-hour-cycle",
                alias: i18next.t('timeFormat'),
                type: "select(radioGroup)",
                default: "hour_24",
                selectChoices: [
                  { label: `24${i18next.t('hourSystem')}`, value: "hour_24" },
                  { label: `12${i18next.t('hourSystem')}`, value: "hour_12" },
                ],
                visible: (widget: DatePicker) => {
                  return widget.getOption<string>("date-format").includes('time');
                }
              },
              {
                name: "date-show-format",
                alias: i18next.t('displayFormat'),
                type: "select",
                default: "hyphen",
                selectChoices: (widget: DatePicker) => {
                  const precision = widget.getOption<string>("date-format");
                  const showWeek = widget.getOption<boolean>("show-week");

                  const now = dayjs();
                  const seen = new Set<string>();
                  const choices: { label: string; value: string }[] = [];

                  DATE_STYLES.forEach(style => {
                    const pattern = widget.getFormatPattern(style.value, precision, showWeek, widget.isUse12Hour);
                    let previewDate = now;
                    // 语言环境
                    if ([DateStyle.EN_SHORT, DateStyle.EN_LONG].includes(style.value)) {
                      previewDate = previewDate.locale('en');
                    } else {
                      previewDate = previewDate.locale('zh-cn');
                    }

                    const label = previewDate.format(pattern);
                    if (!seen.has(label)) {
                      seen.add(label);
                      choices.push({
                        label: label,
                        value: style.value
                      });
                    }
                  });

                  return choices;
                },
              },
            ],
          },
          validation: {
            children: [

            ],
          },
        },
      },
      ...super.defineOptions(),
    ];
  }
  public overrideValue = ref(null);

  get isUse12Hour() {
    return this.getOption<string>("time-hour-cycle") === "hour_12";
  }

  get showFormat() {
    return this.getOption<DateStyle>("date-show-format") || DateStyle.ZH_CN;
  }

  get dateFormat() {
    const style = this.showFormat;
    const styleMap = DATE_PART_MAP[style] || DATE_PART_MAP[DateStyle.ZH_CN];
    return styleMap[this.precision] || styleMap['date'];
  }

  get timeFormat() {
    if (this.precision === 'datetime-minute') {
      return this.isUse12Hour ? 'A h:mm' : 'HH:mm';
    }
    return this.includesTime ? (this.isUse12Hour ? 'A h:mm:ss' : 'HH:mm:ss') : '';
  }

  get weekFormat() {
    const showWeek = this.getOption<boolean>("show-week");
    if (showWeek && ['date', 'datetime', 'datetime-minute'].includes(this.precision)) {
      const style = this.showFormat;
      return style === DateStyle.EN_SHORT ? 'ddd' : 'dddd';
    }
    return '';
  }

  /**
   * 获取日期完整格式的字符串
   */
  public getFormatPattern(style: DateStyle, precision: string, showWeek: boolean, use12Hour: boolean): string {
    const basePrecision = precision.replace('range', '');
    const styleMap = DATE_PART_MAP[style] || DATE_PART_MAP[DateStyle.ZH_CN];
    let formatStr = styleMap[basePrecision] || styleMap['date'];

    if (showWeek && ['date', 'datetime', 'datetime-minute'].includes(basePrecision)) {
      const weekStr = style === DateStyle.EN_SHORT ? 'ddd' : 'dddd';
      if ([DateStyle.EN_SHORT, DateStyle.EN_LONG].includes(style)) {
        formatStr = `${weekStr}, ` + formatStr;
      } else {
        formatStr += ` ${weekStr}`;
      }
    }
    if (basePrecision === 'datetime') {
      formatStr += use12Hour ? ' A h:mm:ss' : ' HH:mm:ss';
    } else if (basePrecision === 'datetime-minute') {
      formatStr += use12Hour ? ' A h:mm' : ' HH:mm';
    }

    return formatStr;
  }

  get format(): string {
    const style = this.showFormat;
    const precision = this.getOption<string>("date-format");
    const showWeek = this.getOption<boolean>("show-week");

    return this.getFormatPattern(style, precision, showWeek, this.isUse12Hour);
  }

  public getFormat(): string {
    const formats = {
      "year": `YYYY`,
      "month": `YYYY-MM`,
      "date": `YYYY-MM-DD`,
      "datetime": `YYYY-MM-DD HH:mm:ss`,
    }

    return formats[this.precision];
  }

  // 将inputValue转为设定的"显示格式", 一般用于显示值到页面中
  public formatDateValue(val: string): string {
    if (!val) return undefined;
    let date = smartDayjs(val);

    // 根据格式类型设置语言环境
    const style = this.getOption<string>("date-show-format");
    let locale;
    if ([DateStyle.EN_SHORT, DateStyle.EN_LONG].includes(style as DateStyle)) {
      locale = 'en';
    } else {
      locale = 'zh-cn';
    }
    if (date.isValid()) return date.locale(locale).format(this.format);
    date = dayjs(val, this.format);
    return date.isValid() ? date.locale(locale).format(this.format) : val;
  }

  public normalizeInputDateValue(value: any) {
    if (value === undefined || value === null || value === "") return value;

    if (dayjs(value).isValid()) {
      return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
    }

    const parsedValue = this.parseDateString(value);
    return parsedValue && dayjs(parsedValue).isValid()
      ? dayjs(parsedValue).format('YYYY-MM-DD HH:mm:ss')
      : undefined;
  }

  /**
   * @deprecated 后续删除
   * FIXME: 这个函数只能用于在页面上格式化显示，不要赋值给inputValue、_calendarRange相关会影响inputValue的值
   * @param val
   * @returns
   */
  private parseDateString(val: string | number | Date): DateValue {
    if (!val) return "";

    const formatMap = {
      "year": ['YYYY', (d) => d.year().toString()],
      "month": ['YYYY-MM', (d) => d.format('YYYY-MM')],
      "date": ['YYYY-MM-DD', (d) => d.toDate()],
      "datetime": ['YYYY-MM-DD HH:mm:ss', (d) => d.toDate()]
    }

    const type = this.precision;
    let [format, mapper] = formatMap[type];
    mapper = mapper || ((d) => d.toDate());

    let locale;
    const style = this.getOption<string>("date-show-format");
    if ([DateStyle.EN_SHORT, DateStyle.EN_LONG].includes(style as DateStyle)) {
      locale = 'en';
    } else {
      locale = 'zh-cn';
    }

    // Date 对象处理
    if (val instanceof Date) {
      const date = dayjs(val).locale(locale);
      return date.isValid() ? mapper(date) : undefined;
    }

    if (typeof val === "string") {
      let date = smartDayjs(val).locale(locale);
      if (date.isValid()) return mapper(date);

      date = dayjs(val, this.format).locale(locale);
      return date.isValid() ? mapper(date) : undefined;
    } else if(typeof val === "number") {
      return dayjs(val).locale(locale).format(format);
    }
  }

  get defaultValue(): string {
    if (this.getOption("default-type") === "currentDate") {
      const dateString = dayjs().format('YYYY-MM-DD HH:mm:ss');
      return dateString;
    } else if (this.getOption("default-type") === "customDate") {
      const date = dayjs(this.getOption<Date>("custom-date"));
      return date.isValid() ? date.format('YYYY-MM-DD HH:mm:ss') : this.getOption<string>("custom-date");
    } else if (this.getOption("default-type") === "formula") {
      return this.getOption<string>("default-value");
    }
    return '';
  }

  private normalizeFormulaResult(value) {
    const processed = processFormulaResult(value, this.fieldType);
    if (typeof processed === "number") {
      const day = dayjs(processed);
      if (processed && day.isValid()) {
        return day.format('YYYY-MM-DD HH:mm:ss');
      }
      return this.inputValue;
    } else {
      return String(processed);
    }
  }

  public get inputValue() {
    const value = this._calendarRange.value ?? ((this.initialValue && dayjs(this.initialValue, this.format).isValid()) ? dayjs(this.initialValue, this.format).valueOf() as any : this.initialValue) ?? this.defaultValue;
    return dayjs(value).isValid() ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : value;
  }

  set inputValue(value) {
    this._calendarRange.value = value;
    this.updateLastChangeTime();
  }

  override setInputValueNotChanged(value: any) {
    if (value === undefined) {
      this._calendarRange.value = value;
      return;
    }
    if (dayjs(value).isValid()) {
      this._calendarRange.value = dayjs(value).format('YYYY-MM-DD HH:mm:ss');
      return;
    }
    // FIXME : 这里后续需要核对一下是否可以直接赋值
    this._calendarRange.value = this.parseDateString(value);
  }

  get placeholder() {
    return this.getOption<string>("placeholder");
  }

  get isRange(): boolean {
    return false;
  }

  get defaultType() {
    return this.getOption<""|"currentDate"|"customDate"|"formula">("default-type");
  }

  set defaultValue(value: string){
    this.setOption("default-value", value);
  }

  get defaultFormulaValue() {
    return this.getOption<string | FormulaConfig>("default-formula");
  }


  get defaultName() {
    return i18next.t("defaultName");
  }

  public isEmpty(): boolean {
    if (this.inputValue instanceof Date) {
      return false;
    }
    return super.isEmpty();
  }

  public otherTableDataCache: Record<string, Record<string, any>> = {};

  resolveFormSetting() {
    let dateLocale;
    if ([DateStyle.EN_SHORT, DateStyle.EN_LONG].includes(this.showFormat)) {
      dateLocale = 'en';
    } else {
      dateLocale = 'zh-cn';
    }
    const extra = {
      format: this.format,
      dateLocale,
      defaultValueType: this.defaultType,
      defaultValue: this.defaultValue,
      formula: this.defaultFormulaValue,
    }

    return {
      ...super.resolveFormSetting(),
      subType: "date",
      extra: {
        ...(super.resolveFormSetting()?.extra || {}),
        ...extra
      }
    };
  }

  getConfigurations(): FormElementConfiguration {
    return {
      subType: "date",
      funcInfo: {
        [RuleFunc.TIME_EQUAL]: RuleFuncValue.DATE,
        [RuleFunc.TIME_NOT_EQUAL]: RuleFuncValue.DATE,
        [RuleFunc.GTE]: RuleFuncValue.DATE,
        [RuleFunc.TIME_LTE]: RuleFuncValue.DATE,
        [RuleFunc.TIME_BETWEEN]: RuleFuncValue.RANGE,
        [RuleFunc.DYNAMIC]: RuleFuncValue.STRING,
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
      },
      // 编辑表单时使用的筛选判断条件
      editFuncInfo: {
        [RuleFunc.TIME_EQUAL]: RuleFuncValue.DATE,
        [RuleFunc.TIME_NOT_EQUAL]: RuleFuncValue.DATE,
        [RuleFunc.GTE]: RuleFuncValue.DATE,
        [RuleFunc.TIME_LTE]: RuleFuncValue.DATE,
        [RuleFunc.DYNAMIC]: RuleFuncValue.STRING,
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

