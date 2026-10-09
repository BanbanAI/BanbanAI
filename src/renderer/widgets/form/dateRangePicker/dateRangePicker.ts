import { TheWidget as DatePicker } from "@renderer/widgets/form/datePicker";
import { DateRangeValue } from "@renderer/widgets/form/datePicker/types";
import { ref, Ref } from "vue";
import { FormElementConfiguration } from "@common/types/nocode";
import { DefinedOptions } from "@renderer/b2/types";
import { configurations } from "./configurations";
import dayjs from "dayjs";
import i18next from "@renderer/widgets/i18next";
import resource from "./locales";

export class DateRangePicker extends DatePicker {
  static resource = resource;

  get defaultName() {
    return i18next.t("defaultName");
  }

  resetValue() {
    this.calendarRangeValue = ["", ""];
  }

  get calendarType(): string {
    return super.calendarType;
  }

  private formatDateRangeValue(val: DateRangeValue): [string, string] {
    if (!val || !val[0] || !val[1]) return ["", ""];
    return [
      this.formatDateValue(val[0]),
      this.formatDateValue(val[1])
    ];
  }

  get startDate() {
    return this.getOption<Date>("custom-start-date");
  }

  get endDate() {
    return this.getOption<Date>("custom-end-date");
  }

  get defaultValues() {
    const value = [0, 0];
    if (this.startDate) {
      value[0] = dayjs(this.startDate).valueOf();
    }
    if (this.endDate) {
      value[1] = dayjs(this.endDate).valueOf();
    }
    return value;
    // const startDateJs = dayjs(this.getOption<Date>("custom-start-date"));
    // const endDateJs = dayjs(this.getOption<Date>("custom-end-date"));
    // const startDate = startDateJs.isValid() ? startDateJs.format('YYYY-MM-DD HH:mm:ss') : undefined;
    // const endDate = endDateJs.isValid() ? endDateJs.format('YYYY-MM-DD HH:mm:ss') : undefined;

    // return [startDate ?? this.getOption<string>("custom-start-date") ?? "", endDate ?? this.getOption<string>("custom-end-date") ?? ''];
  }

  get placeholders(): [string, string] {
    return [this.getOption<string>("start-placeholder") ?? '', this.getOption<string>("end-placeholder") ?? '']
  }
  private _calendarRangeValue: Ref<string[] | number[]> = ref();
  public get calendarRangeValue(): (number|string)[] {
    if (!this._calendarRangeValue.value && this.initialValue) {
      this._calendarRangeValue.value = this.initialValue;
    }

    return this._calendarRangeValue.value !== undefined ? this._calendarRangeValue.value : this.defaultValues;
  }

  public set calendarRangeValue(val: any[]) {
    this._calendarRangeValue.value = val?.map(date => date ? dayjs(date).valueOf() : date);
    this.updateLastChangeTime();
  }

  get inputValue(): DateRangeValue {
    const value = this._calendarRangeValue.value ?? (this.initialValue) ?? this.defaultValue;
    if (!value) return [];
    return value.map(item => {
      return item ? (dayjs(item).isValid() ? dayjs(item).valueOf() : (dayjs(item, this.format).isValid() ? dayjs(item, this.format).valueOf() : item)) : item;
    });

  }

  set inputValue(val: DateRangeValue) {
    super.inputValue = val;
  }

  get renderValue(): DateRangeValue {
    return this.formatDateRangeValue(this.inputValue);
  }

  async doValidate() {

  }
  get isRange(): boolean {
    return true;
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
                name: "start-placeholder",
                alias: i18next.t('startTimeTip'),
                default: i18next.t('plsSelect'),
                type: "string",
              },
              {
                name: "end-placeholder",
                alias: i18next.t('endTimeTip'),
                default: i18next.t('plsSelect'),
                type: "string",
              },
              {
                name: "custom-start-date",
                alias: i18next.t('startTime'),
                type: "date",
                valueType: (widget: DatePicker) => {
                  return widget.precision;
                },
              },
              {
                name: "custom-end-date",
                alias: i18next.t('endTime'),
                type: "date",
                valueType: (widget: DatePicker) => {
                  return widget.precision;
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

  get fieldType() {
    return "object";
  }

  getConfigurations(): FormElementConfiguration {
    return configurations;
  }

  resolveFormSetting() {
    const extra = {
      format: this.format,
      defaultValue: [this.getOption<string>("custom-start-date") ?? "", this.getOption<string>("custom-end-date") ?? ''],
    }

    return {
      ...super.resolveFormSetting(),
      subType: "daterange",
      extra: {
        ...(super.resolveFormSetting()?.extra || {}),
        ...extra
      }
    };
  }

  public isEmpty(): boolean {
    if (this.inputValue.every((date: string) => date === undefined || date.length === 0)) {
      return true;
    }
    return super.isEmpty();
  }
}

