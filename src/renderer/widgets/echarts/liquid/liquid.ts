import { PrivateData, PrivateDataConnectionUID, PrivateDataTableUID, OptionFieldUID } from "@common/types/project";
import { DefinedOptions, OptionFontValue, OptionFieldValue, WidgetMetaData, ChartClickState } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { formatFloat } from "@common/utils/math";
import { TheWidget as Echarts, component as B2Chart } from "@renderer/widgets/echarts/basic";
import { XAXisComponentOption, YAXisComponentOption, SeriesOption } from "echarts/dist/echarts";
import resource from "./locales";
import { merge, recursive } from "merge";
import { Ref, ref, watch } from 'vue';
import i18next from "@renderer/widgets/i18next";

export class Liquid extends Echarts {

  static resource = recursive(true, Echarts.resource, resource);

  static defineOptions(): DefinedOptions[] {
    const UNIT_WEI = i18next.t("unitWei");
    return [{
      data: {
        fields: {
          alias: i18next.t("basicSetting"),
          children: [
            {
              name: "axis-category",
              type: "field(max=1, recommend=string)",
              alias: i18next.t("axisCategory"),
              default: [{ "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_1"], "__opt_type": "field", "summary": "" }]
            },
            {
              name: "axis-value",
              type: "field(max=1)",
              alias: i18next.t("axisValue"),
              default: [{ "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_2"], "__opt_type": "field", "summary": "" }]
            },
            {
              name: "axis-fields",
              visible: false
            }
          ]
        },
        'fields-filter': {
          alias: '数据筛选',
          children: [
            {
              name: "fields-data-sort-fields",
              visible: false,
            },
            {
              name: "fields-data-sort-orderby",
              visible: false,
            },
          ]
        }
      },
      style: {
        basic: {
          children: [
            {
              name: "category_spotlight",
              alias: i18next.t("categorySpotlight"),
              type: "select",
              selectChoices: (liquid: Liquid) => {
                let choices = [{ value: "default", label: i18next.t("categorySpotlightDefault"), }];
                if (liquid.getOption<OptionFieldValue[]>(["axis-category"])?.length) {
                  let dataView = liquid.datasetSource();
                  if(dataView.columns?.length) {
                    (dataView.columns[0] as string[]).forEach((item) => {
                      choices.push({
                        label: item,
                        value: item
                      })
                    });
                  }
                } else {
                  let privateData = liquid.getPrivateData();
                  let fieldTypeUids = liquid.getPrivateFieldTypeUids();
                  privateData?.rows?.forEach((item) => {
                    choices.push({
                      label: item[fieldTypeUids.string?.[0]],
                      value: item[fieldTypeUids.string?.[0]]
                    })
                  })
                }
                const map = new Map();
                const uniqueChoices = [];
                choices.forEach((item) => {
                  if (!map.has(item.value)) {
                    map.set(item.value, item);
                    uniqueChoices.push(item);
                  }
                })
                return uniqueChoices;
              },
              default: "default",
            },
            {
              name: "liquid-value",
              alias: i18next.t("liquidValue"),
              type: "number<float>(unit=%, showInput)",
              default: 50,
              visible: (liquid: Liquid) => {
                return liquid.getOption<string>("category_spotlight") == "default";
              }
            },
            {
              name: "data-type",
              type: "select(radioGroup)",
              alias: i18next.t("dataType"),
              selectChoices: [
                {
                  value: "number",
                  label: i18next.t("dataTypeNumber"),
                },
                {
                  value: "percent",
                  label: i18next.t("dataTypePercent"),
                }
              ],
              default: "percent",
              visible: (liquid: Liquid) => {
                return liquid.getOption<string>("category_spotlight") !== "default";
              }
            },
          ]
        },
        "series-color": {
          alias: i18next.t("seriesColor"),
          children: [
            {
              name: "palette",
              visible: false
            },
            {
              name: "liquid-color",
              alias: i18next.t("liquidColor"),
              type: "color(gradient)",
              default: "#1890FF",
            },
          ]
        },
        "label-group": {
          alias: i18next.t("label"),
          children: [
            {
              name: "label-default-cluster",
              alias: i18next.t("label"),
              show: "tab",
              children: [
                {
                  name: "label",
                  alias: i18next.t("label"),
                  type: "boolean",
                  default: true,
                },
                {
                  name: "label-data-type",
                  alias: i18next.t("labelDataType"),
                  default: "percent",
                  type: "select(radioGroup)",
                  selectChoices: [
                    {
                      label: i18next.t("labelDataTypeNormal"),
                      value: "normal"
                    },
                    {
                      label: i18next.t("labelDataTypePercent"),
                      value: "percent"
                    },
                  ],
                },
                {
                  name: "label-decimal-places",
                  alias: i18next.t("labelDecimalPlaces"),
                  type: `number(unit=${UNIT_WEI}, min=0)`,
                  default: 2,
                },
                {
                  name: "label-complete-zero",
                  alias: i18next.t("labelCompleteZero"),
                  type: "boolean",
                  default: false,
                },
                {
                  name: "label-font",
                  alias: i18next.t("labelFont"),
                  type: "font",
                  default: {
                    color: "#ffffff",
                    family: "sans-serif",
                    size: 50,
                    bold: false,
                    italic: false,
                  },
                },
                {
                  name: "liquid-label-inside-color",
                  alias: i18next.t("liquidLabelInsideColor"),
                  type: "color",
                  default: "#759aa0",
                },
              ]
            }
          ]
        },
        "series-shape": {
          alias: i18next.t("seriesShape"),
          children: [
            {
              name: "series-shape-default-cluster",
              alias: i18next.t("seriesShape"),
              show: "tab",
              children: [
                {
                  name: "liquid-outline-color",
                  alias: i18next.t("liquidOutlineColor"),
                  type: "color(gradient)",
                  default: "#1890ff",
                },
                {
                  name: "liquid-outline-width",
                  alias: i18next.t("liquidOutlineWidth"),
                  type: "number(unit=px)",
                  default: 2,
                },
                {
                  name: "liquid-outline-distance",
                  alias: i18next.t("liquidOutlineDistance"),
                  type: "number(unit=px)",
                  default: 8,
                },
                {
                  name: "liquid-background-color",
                  alias: i18next.t("liquidBackgroundColor"),
                  type: "color(gradient)",
                  default: "transparent",
                },
                {
                  name: "liquid-border-color",
                  alias: i18next.t("liquidBorderColor"),
                  type: "color(gradient)",
                  default: "transparent",
                },
                {
                  name: "liquid-border-width",
                  alias: i18next.t("liquidBorderWidth"),
                  type: "number(unit=px)",
                  default: 2,
                },
                {
                  name: "liquid-amplitude",
                  alias: i18next.t("liquidAmplitude"),
                  type: "number(unit=px)",
                  default: 10,
                },
                {
                  name: "liquid-waveLength",
                  alias: i18next.t("liquidWaveLength"),
                  type: "number(unit=%)",
                  default: 80,
                },
                {
                  name: "liquid-direction",
                  alias: i18next.t("liquidDirection"),
                  type: "select(radioGroup)",
                  selectChoices: [
                    {
                      value: "right",
                      label: i18next.t("liquidDirectionRight"),
                    },
                    {
                      value: "left",
                      label: i18next.t("liquidDirectionLeft"),
                    }
                  ],
                  default: "right"
                },
                {
                  name: "liquid-shape",
                  alias: i18next.t("liquidShape"),
                  type: "select",
                  selectChoices: [
                    {
                      value: "circle",
                      label: i18next.t("liquidShapeCircle"),
                    },
                    {
                      value: "rect",
                      label: i18next.t("liquidShapeRect"),
                    },
                    {
                      value: "roundRect",
                      label: i18next.t("liquidShapeRoundRect"),
                    },
                    {
                      value: "triangle",
                      label: i18next.t("liquidShapeTriangle"),
                    },
                    {
                      value: "diamond",
                      label: i18next.t("liquidShapeDiamond"),
                    },
                    {
                      value: "pin",
                      label: i18next.t("liquidShapePin"),
                    },
                    {
                      value: "arrow",
                      label: i18next.t("liquidShapeArrow"),
                    },
                    {
                      value: "custom",
                      label: i18next.t("liquidShapeCustom"),
                    },
                    {
                      value: "container",
                      label: i18next.t("liquidShapeContainer"),
                    },
                  ],
                  default: "circle"
                },
                {
                  name: "liquid-shape-custom",
                  alias: i18next.t("liquidShapeCustom"),
                  type: "string",
                  default: "path://M367.855,428.202c-3.674-1.385-7.452-1.966-11.146-1.794c0.659-2.922,0.844-5.85,0.58-8.719 c-0.937-10.407-7.663-19.864-18.063-23.834c-10.697-4.043-22.298-1.168-29.902,6.403c3.015,0.026,6.074,0.594,9.035,1.728 c13.626,5.151,20.465,20.379,15.32,34.004c-1.905,5.02-5.177,9.115-9.22,12.05c-6.951,4.992-16.19,6.536-24.777,3.271 c-13.625-5.137-20.471-20.371-15.32-34.004c0.673-1.768,1.523-3.423,2.526-4.992h-0.014c0,0,0,0,0,0.014 c4.386-6.853,8.145-14.279,11.146-22.187c23.294-61.505-7.689-130.278-69.215-153.579c-61.532-23.293-130.279,7.69-153.579,69.202 c-6.371,16.785-8.679,34.097-7.426,50.901c0.026,0.554,0.079,1.121,0.132,1.688c4.973,57.107,41.767,109.148,98.945,130.793 c58.162,22.008,121.303,6.529,162.839-34.465c7.103-6.893,17.826-9.444,27.679-5.719c11.858,4.491,18.565,16.6,16.719,28.643 c4.438-3.126,8.033-7.564,10.117-13.045C389.751,449.992,382.411,433.709,367.855,428.202z",
                  visible: (liquid: Liquid) => {
                    return liquid.getOption<string>("liquid-shape") == "custom";
                  }
                },
              ]
            },
          ]
        },
        sort: {
          visible: false
        },
        legend: {
          visible: false
        },
        tooltip: {
          visible: false
        },
        padding: {
          visible: false
        }
      }
    }, ...super.defineOptions()];
  }

  protected getDefaultPrivateData(): PrivateData {
    return {
      fields: [
        { uid: "f_1", alias: "水果", type: "string" },
        { uid: "f_2", alias: "数量", type: "number" },
      ],
      rows: [
        { f_1: '苹果', f_2: 36 },
        { f_1: '香蕉', f_2: 18 },
        { f_1: '橘子', f_2: 25 },
      ],
    };
  }

  getLegendOtherOption() {
    return {
      show: false
    }
  }

  get echartsXAxisOption(): XAXisComponentOption {
    return { show: false };
  }

  get echartsYAxisOption(): YAXisComponentOption {
    return { show: false };
  }

  get echartsSeriesOption(): SeriesOption | any {
    let liquidColor = new Color(this.getOption<Color>("liquid-color")).toEchartsColor();
    let liquidBackgroundColor = new Color(this.getOption<Color>("liquid-background-color")).toEchartsColor();
    let liquidBorderColor = new Color(this.getOption<Color>("liquid-border-color")).toEchartsColor();
    let liquidBorderWidth = this.getOption<number>("liquid-border-width");
    let liquidAmplitude = this.getOption<number>("liquid-amplitude");
    let liquidWaveLength = this.getOption<number>("liquid-waveLength");
    let liquidDirection = this.getOption<string>("liquid-direction");
    let liquidShape = this.getOption<string>("liquid-shape");
    if (liquidShape == "custom") {
      liquidShape = this.getOption<string>("liquid-shape-custom");
    }

    let liquidOutlineColor = new Color(this.getOption<Color>("liquid-outline-color")).toEchartsColor();
    let liquidOutlineWidth = this.getOption<number>("liquid-outline-width");
    let liquidOutlineDistance = this.getOption<number>("liquid-outline-distance");

    let liquidLabel = this.getOption<string>("label");
    let labelFont = this.getOption<OptionFontValue>("label-font");
    let liquidInsideColor = new Color(this.getOption<Color>("liquid-label-inside-color")).hexa();
    let labelValueType = this.getOption<string>("label-data-type");
    let labelValueDecimalPlaces = this.getOption<number>("label-decimal-places");
    let labelValueCompleteZero = this.getOption<boolean>("label-complete-zero");
    let liquidDataKey = this.getOption<string>("category_spotlight");
    let dataType = this.getOption<string>("data-type");
    let liquidValue = 0;

    if (liquidDataKey === "default") {
      let liquidDefaultValue = this.getOption<number>("liquid-value");
      liquidValue = liquidDefaultValue / 100;
    } else {
      let totalValue = 1;
      if (this.getOption<OptionFieldValue[]>(["axis-value"])?.length) {
        let dataView = this.datasetSource();
        let columns = dataView.columns;
        if(columns?.length) {
          totalValue = (columns[1] as number[]).reduce((result, current) => { return result + current; }, 0) || 1;
          let dataIndex = Math.max(0, ((columns?.[0] || []) as string[]).indexOf(liquidDataKey));
          liquidValue = columns[1][dataIndex];
        }
      } else {
        let privateData = this.getPrivateData();
        let fieldTypeUids = this.getPrivateFieldTypeUids();
        privateData?.rows?.forEach((item) => {
          if (item[fieldTypeUids.string?.[0]] == liquidDataKey) liquidValue = item[fieldTypeUids.number?.[0]];
          totalValue = totalValue + item[fieldTypeUids.number?.[0]];
        });
      }

      if (dataType == "percent") {
        liquidValue = liquidValue / totalValue;
      } else {
        liquidValue *= 0.01;
      }
    }

    return {
      name: "value",
      type: "liquidFill",
      radius: '90%',
      amplitude: liquidAmplitude,
      waveLength: `${liquidWaveLength}%`,
      direction: liquidDirection,
      shape: liquidShape,
      itemStyle: {
        color: liquidColor,
        shadowBlur: 0
      },
      backgroundStyle: {
        borderWidth: liquidBorderWidth,
        borderColor: liquidBorderColor,
        color: liquidBackgroundColor
      },
      outline: {
        show: true,
        borderDistance: liquidOutlineDistance,
        itemStyle: {
          borderColor: liquidOutlineColor,
          borderWidth: liquidOutlineWidth,
        }
      },
      label: {
        show: liquidLabel,
        formatter: (param) => {
          let resultValue: any = 0;
          resultValue = param.value;
          if (typeof resultValue == "object") {
            resultValue = resultValue["value"];
          }

          if (labelValueType === "normal") {
            resultValue = formatFloat(resultValue, labelValueDecimalPlaces, labelValueCompleteZero);
          } else {
            resultValue = formatFloat(resultValue * 100, labelValueDecimalPlaces, labelValueCompleteZero) + '%';
          }
          return resultValue;
        },
        color: this.toEchartsColor(labelFont.color as Color),
        fontSize: labelFont.size,
        fontWeight: labelFont.bold ? "bold" : "normal",
        fontStyle: labelFont.italic ? "italic" : "normal",
        fontFamily: labelFont.family,
        insideColor: liquidInsideColor,
      },
      data: [liquidValue],
      silent: true,
    }
  }
  _datasetSource() {
    return this.createView(["axis-category", "axis-value"]);
  }

  createView(paths?: string[]):any {
    const uids = [];
    for (const item of paths) {
      const options = this.getOption<OptionFieldValue[]>(item) || [];
      for (const option of options) {
        uids.push(option.uid);
      }
    }
    return {
      data: this.getData().getRows(uids),
      columns: this.getData().getflatColumns(uids)
    };
  }

  get axisCategory() {
    return this.getOption<OptionFieldValue[]>("axis-category") || [];
  }
  get axisValue() {
    return this.getOption<OptionFieldValue[]>("axis-value") || [];
  }

  override getMetaData() {
    return merge(super.getMetaData(), {
      axisValue: [
        ...this.axisCategory,
        ...this.axisValue,
      ]
    } as WidgetMetaData);
  }

  public selectedIndex: Ref<number> = ref(-1);
  public selectedData: Ref<{}> = ref(null);
  public resetSelectedIndex: Ref<boolean> = ref(false);
  initEchartsEvents(): void {
    const state: ChartClickState = {
      lastseriesIndex: -1,
      lastDataIndex: -1,
    };
    watch(() => this.getOption<string>("category_spotlight"), (val) => {
      if (val) {
        const data = this.createView(["axis-category", "axis-value"]);
        let uids = this.getOption("axis-category")?.[0]?.uid;
        if (uids?.length && val !== "default") {
          const currentDatas = data.data.filter((item) => item[uids[2]] === val);
          let fieldArr = this.getOption<string>("linkage-form-field")?.split(".")
          let fieldUIDs;
          let filterValue;
          if (fieldArr?.length) {
            if (fieldArr.length === 2) {
              fieldUIDs = [uids[0], ...fieldArr];
              filterValue = currentDatas.map(item => item[fieldArr[1]]);
            } else if (fieldArr.length === 3) {
              fieldUIDs = [uids[0], fieldArr[0], `${fieldArr[1]}.${fieldArr[2]}`];
              filterValue = currentDatas.map(item => item[fieldArr[1]].map(item => item[fieldArr[2]])).flat(Infinity);
            }
          }
          this.applyLinkage({ uid: fieldUIDs as OptionFieldUID, value: filterValue });
        } else {
          this.withdrawLinkage();
        }
      }
    })
  }
}

