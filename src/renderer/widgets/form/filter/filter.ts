import { DefinedOptions, OptionTableValue } from "@renderer/b2/types";
import { FormElement } from "@renderer/b2/controllers/form";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { debounce } from "lodash";
import { equals } from "@common/utils/object";
import { Ref, ref, watch } from "vue";

export type SelectItem = {
  id: number;
  label: string;
  value: string | number;
  checked: boolean;
};

export class Filter extends FormElement {
  public isAlwaysLinkageOut: boolean = true;
  static resource = resource;

  get defaultName() {
    return i18next.t("defaultName");
  }

  public getInputValue() {
    return this.inputValue;
  }

  get currentValue() {
    return this.inputValue;
  }

  public selectedVal = ref([]);
  public get selectedValue(): string[] {
    return this.selectedVal.value.filter((item) => item !== "all");
  }
  public selectOption = ref<SelectItem[]>([]);


  private _dataValue: Ref= ref(undefined);
  public get dataValue() {
    if(this._dataValue.value === undefined) {
      this.effectScope.run(() => {
        watch(() => {
          let columnUidList = []
          const valueDims = this.getOption<OptionTableValue[]>("axis-linkage") || [];
          if (valueDims.length) {
            let tableUid = valueDims[0].uid.slice(0, 2)
            const columnFields = this.getTableFields(tableUid) ?? [];
            columnUidList = columnFields.map(field => field.uid);
          }
          return columnUidList;
        }, debounce((columnUidList, oldUidList) => {
          if (!columnUidList?.length || equals(columnUidList, oldUidList)) return;
          const valueDims = this.getOption<OptionTableValue[]>("axis-linkage") || [];
          let valueUid = valueDims[0].uid;
          let tableUid = valueUid.slice(0, 2)
          this.getData().getPagingRows(tableUid, {}).then(({ rows, count }) => {
            let value = rows.map((row) => row[valueUid[2]]);
            if (value === undefined || value === null) {
              this._dataValue.value = []
            } else {
              this._dataValue.value = [...new Set(value)]
            }
          });
        }, 200), { immediate: true })
      })
    }
    return this._dataValue.value
  }

  public get getSelectOption(): SelectItem[] {
    let arr = this.dataValue;
    if (Array.isArray(arr)) {
      return arr.map((item, index) => {
        return {
          id: index + 1,
          label: item,
          value: item,
          checked: false,
        };
      });
    } else {
      return [];
    }
  }

  public get selectOptionLabel(): string {
    let labelArr = [];
    for (let item of this.selectOption.value) {
      if (this.selectedVal.value.includes(item.value)) {
        labelArr.push(item.label);
      }
    }
    return labelArr.join(", ");
  }

  static defineOptions(): DefinedOptions[] {
    return [
      {
        data: {
          fields: {
            alias: i18next.t("fieldSetting"),
            fold: "unfold",
            children: [
              {
                name: "axis-linkage",
                alias: i18next.t("linkageField"),
                type: "field(max=1)",
              },
            ],
          },
          linkage: {
            children: [
              {
                name: "linkage-out",
                type: "boolean",
                default: true,
              },
              
            ],
          },
        },
        style: {
          check: {},
          filterStyle: {
            alias: i18next.t("filterStyle"),
            children: [
              {
                name: "select-box",
                alias: i18next.t("selectBox"),
                show: "tab",
                children: [
                  {
                    name: "select-height",
                    alias: i18next.t("height"),
                    type: "number(unit=px,min=0)",
                    default: 40,
                  },
                  {
                    name: "select-font",
                    alias: i18next.t("font"),
                    type: "font",
                    default: {
                      size: 14,
                      color: "#141E31",
                    },
                  },
                  {
                    name: "select-border-color",
                    alias: i18next.t("borderColor"),
                    type: "color",
                    default: "#D7D9DC",
                  },
                  {
                    name: "select-border-width",
                    alias: i18next.t("borderWidth"),
                    type: "number(unit=px,min=0)",
                    default: 1,
                  },
                  {
                    name: "select-border-radius",
                    alias: i18next.t("borderRadius"),
                    type: "number(unit=px,min=0)",
                    default: 4,
                  },
                  {
                    name: "select-background-color",
                    alias: i18next.t("backgroundColor"),
                    type: "color(gradient)",
                    default: "#ffffff",
                  },
                  {
                    name: "show-icon",
                    alias: i18next.t("showIcon"),
                    type: "boolean",
                    default: true,
                  },
                  {
                    name: "icon-size",
                    alias: i18next.t("iconSize"),
                    type: "number(unit=px,min=0)",
                    default: 14,
                    visible: (widget: Filter) => {
                      return widget.getOption("show-icon");
                    },
                  },
                  {
                    name: "icon-right",
                    alias: i18next.t("iconRight"),
                    type: "number(unit=px, min=0)",
                    default: 10,
                    visible: (widget: Filter) => {
                      return widget.getOption("show-icon");
                    },
                  },
                  {
                    name: "icon-color",
                    alias: i18next.t("iconColor"),
                    type: "color",
                    default: "#D7D9DC",
                    visible: (widget: Filter) => {
                      return widget.getOption("show-icon");
                    },
                  },
                ],
              },
              // 下拉框
              {
                name: "dropdown-box",
                alias: i18next.t("dropdownBox"),
                show: "tab",
                children: [
                  {
                    name: "dropdown-option-height",
                    alias: i18next.t("height"),
                    type: "number(unit=px)",
                    default: 34,
                  },
                  {
                    name: "dropdown-font",
                    alias: i18next.t("font"),
                    type: "font",
                    default: {
                      size: 14,
                      color: "#141E31",
                    },
                  },
                  {
                    name: "dropdown-border-color",
                    alias: i18next.t("borderColor"),
                    type: "color",
                    default: "#D7D9DC",
                  },
                  {
                    name: "dropdown-border-width",
                    alias: i18next.t("borderWidth"),
                    type: "number(unit=px)",
                    default: 1,
                  },
                  {
                    name: "dropdown-border-radius",
                    alias: i18next.t("borderRadius"),
                    type: "number(unit=px)",
                    default: 4,
                  },
                  {
                    name: "dropdown-background-color",
                    alias: i18next.t("backgroundColor"),
                    type: "color(gradient)",
                    default: "#ffffff",
                  },
                  {
                    name: "dropdown-option-hover-background-color",
                    alias: i18next.t("optionHoverBackgroundColor"),
                    type: "color",
                    default: "#051E500A",
                  },
                  {
                    name: "dropdown-offset",
                    alias: i18next.t("dropdownTransform"),
                    type: "vector<X,Y>(unit=px)",
                    default: [0, 0],
                  },
                  {
                    name: "dropdown-checkbox-select-color",
                    alias: i18next.t("checkboxSelectColor"),
                    type: "color",
                    default: "#5D6DE2",
                  },
                ],
              },
            ],
          },
        },
      },
      ...super.defineOptions(),
    ];
  }

  private lastDataValue;
  get inputValue(): number {
    //这句写前面 以便响应数据变化
    this.lastDataValue = this.getAxisValue("axis-data");
    return this.selectedValue.join(", ") ?? this.lastDataValue;
  }

  public get noneData(): string {
    return i18next.t("noneData");
  }

  public get placeholder(): string {
    return i18next.t("placeholder");
  }

}
