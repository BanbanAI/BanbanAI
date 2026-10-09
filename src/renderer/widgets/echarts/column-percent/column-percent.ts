import { PrivateData } from "@common/types/project";
import { DefinedOptions, OptionFieldValue, OptionFileValue } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { TheWidget as Column, component as B2Column } from "@renderer/widgets/echarts/column";
import { formatFloat } from "@common/utils/math";
import { TooltipComponentOption, SeriesOption } from "echarts/dist/echarts";
import i18next from "@renderer/widgets/i18next";
import resource from "./locales";
import { recursive } from "merge";

export class ColumnPercent extends Column {
  static resource:any = recursive(true, Column.resource, resource);
  static defineOptions(): DefinedOptions[] {
    return [
      {
        data: {
          fields: {
            alias: i18next.t("fieldsSetting"),
            fold: "unfold",
            children: [
              {
                name: "axis-x",
                type: "field(max=1)",
              },
              {
                name: "axis-group",
                alias: i18next.t("axisGroup"),
                type: "field(recommend=string, min=0, max=1)",
                visible: false,
              },
            ],
          },
        },
        style: {
          basic: {
            children: [
              {
                name: "percent-denominator",
                alias: i18next.t("percentDenominator"),
                type: "select(radioGroup)",
                default: "sum",
                selectChoices: [
                  {
                    value: "sum",
                    label: i18next.t("percentDenominatorSum"),
                  },
                  {
                    value: "max",
                    label: i18next.t("percentDenominatorMax"),
                  },
                  {
                    value: "customize",
                    label: i18next.t("percentDenominatorCustomize"),
                  }
                ],
                visible: true
              },
              {
                name: "denominator-customize",
                type: "number(min=0.01)",
                alias: i18next.t("denominatorCustomize"),
                default: 100,
                visible: (widget: ColumnPercent) => {
                  return widget.getOption("percent-denominator") === "customize";
                },
              },],
          },
          "series-shape": {
            children: [
              {
                name: "series-shape-default-cluster",
                children: [
                  {
                    name: "bar-shape",
                    default: "bar",
                    selectChoices: [
                      {
                        value: "bar",
                        label: i18next.t("barShapeBar"),
                      },
                      {
                        value: "rect",
                        label: i18next.t("barShapeRect"),
                      }
                    ],
                  },
                  {
                    name: "shape-background",
                    default: "#d9e4eb"
                  }
                ]
              },
              {
                name: "series-shape-top-cluster",
                children: [],
                visible: false
              },
              {
                name: "series-shape-texture-cluster",
                visible: false,
                children: []
              }
            ],
          },
          "axis": {
            children: [
              {
                name: "y-display-cluster",
                children: [
                  {
                    name: "y-label-cluster",
                    children: [
                      {
                        name: "y-text-type",
                        default:"percent",
                      },
                      {
                        name: "y-scale-range",
                        default: "custom",
                        visible: false
                      },
                      {
                        name: "y-scale-min",
                        default: 0,
                        visible: false
                      },
                      {
                        name: "y-scale-max",
                        default: 100,
                        visible: false
                      },
                      {
                        name: "y-scale-interval",
                        default: 20,
                        visible: false
                      },
                    ]
                  },
                ]
              }
            ]
          },
          "label-group": {
            children: [
              {
                name: "label-default-cluster",
                children: [
                  {
                    name: "label-text-style-cluster",
                    children: [
                      {
                        name: "label-position",
                        default: "inside",
                        selectChoices: [
                          {
                            label: i18next.t("labelPositionInside"),
                            value: "inside",
                          },
                          {
                            label: i18next.t("labelPositionTop"),
                            value: "top",
                          },
                        ],
                      },
                    ]
                  }
                ]
              },
              {
                name: "ranking-cluster",
                visible: false,
                children: []
              }
            ]
          },
          tooltip:{
            children:[
              {
                name: "tooltip-unit-setName",
                alias: i18next.t("tooltipUnitSetName"),
                show: "tab",
                visible: false,
                children:[]
              }
            ]
          },
        }
      },
      ...super.defineOptions(),
    ];
  }

  protected getDefaultPrivateData() : PrivateData{
    return {
      fields: [
        { uid: "f_name", alias: "分类", type: "string" },
        { uid: "f_value1", alias: "值1", type: "number" },
        { uid: "f_value2", alias: "值2", type: "number" },

      ],
      rows: [
        { f_name: '示例1', f_value1: 10, f_value2: 20 },
        { f_name: '示例2', f_value1: 20, f_value2: 35 },
        { f_name: '示例3', f_value1: 30, f_value2: 25 },
        { f_name: '示例4', f_value1: 20, f_value2: 15 },
        { f_name: '示例5', f_value1: 15, f_value2: 10 },
      ],
    };
  }

  _datasetSource() {
    let yDims = this.getOption<OptionFieldValue[]>("axis-y");
    let xDims = this.getOption<OptionFieldValue[]>("axis-x");
    let percentType = this.getOption<string>("percent-denominator");
    let customizeValue = this.getOption<number>("denominator-customize");

    let sourceData = [];
    if (xDims?.length && yDims?.length) {
      sourceData = super._datasetSource();
      if (yDims.length == 1) {
        let maxValue = 0;
        let sumValue = sourceData.reduce((resultVla, current) => {
          maxValue = Math.max(maxValue, current["sumVal"]);
          resultVla += current["sumVal"];
          return resultVla;
        }, 0);
        let yUid = yDims[0]?.uid[2];
        sourceData = sourceData.map((item) => {
          const metricKey = this.getMetricFieldKey(yDims[0], xDims)
          if (percentType == "sum") {
            item[`${metricKey}_percentValue`] = (item[metricKey] / sumValue || 0) * 100;
          } else if (percentType == "max") {
            item[`${metricKey}_percentValue`] = (item[metricKey] / maxValue || 0) * 100;
          } else if (percentType == "customize") {
            item[`${metricKey}_percentValue`] = (item[metricKey] / customizeValue || 0) * 100;
          }
          return item;
        });
      } else {
        sourceData = sourceData.map((item) => {
          const metricKey = this.getMetricFieldKey(yDims[0], xDims)
          yDims.forEach((yDim) => {
            let yUid = yDim.uid[2];
            if (percentType == "sum") {
              item[`${metricKey}_percentValue`] = (item[metricKey] / item["sumVal"] || 0) * 100;
            } else if (percentType == "max") {
              item[`${metricKey}_percentValue`] = (item[metricKey] / item["sumVal"] || 0) * 100;
            } else if (percentType == "customize") {
              item[`${metricKey}_percentValue`] = (item[metricKey] / item["sumVal"] || 0) * 100;
            }
          });
          return item;
        });
      }
    } else {
      let sumValue = 316;
      let maxValue = 83;
      sourceData = [
        { value: 20, name: "示例一" },
        { value: 70, name: "示例二" },
        { value: 45, name: "示例三" },
        { value: 66, name: "示例四" },
        { value: 32, name: "示例五" },
        { value: 83, name: "示例六" },
      ].map((item) => {
        if (percentType == "sum") {
          item["percentValue"] = (item.value / sumValue || 0) * 100;
        } else if (percentType == "max") {
          item["percentValue"] = (item.value / maxValue || 0) * 100;
        } else if (percentType == "customize") {
          item["percentValue"] = (item.value / customizeValue || 0) * 100;
        }
        return item;
      });
    }
    sourceData = this.getDataAfterSort(sourceData);
    return sourceData;


  }

  get stack() {
    return true;
  }

  get percent(){
    return true;
  }

  checkErrorData() {
    let yDims = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let xDims = this.getOption<OptionFieldValue[]>("axis-x") || [];
    if (xDims.length && yDims.length) {
      this.clearErrorDataStatus();
    } else if (xDims.length || yDims.length){
      this.addErrorDataStatus("filed-incomplete");
    } else {
      this.addErrorDataStatus("filed-empty");
    }
  }

  get echartsSeriesOption(): SeriesOption | SeriesOption[] {
    let yDims = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let xDims = this.getOption<OptionFieldValue[]>("axis-x") || [];
    let seriesOpt: any = super.echartsSeriesOption
    if (xDims.length && yDims.length) {
      seriesOpt.forEach(element => {
        let newEncode = {
          x: this.transposed ? element.encode.x + '_percentValue': element.encode.x,
          y: this.transposed ? element.encode.y : element.encode.y + '_percentValue'
        }
        element.encode = newEncode;
      });
    }

    return seriesOpt;
  }
  get echartsTooltipOption(): TooltipComponentOption | TooltipComponentOption[] {
    let yDims = this.getOption<OptionFieldValue[]>("axis-y");
    let xDims = this.getOption<OptionFieldValue[]>("axis-x");
    let backgroundColor = new Color(this.getOption<Color>("tooltip-background-color")).toCssString();
    let backgroundImage = this.getOption<OptionFileValue>("tooltip-background-image");
    let backgroundBlur = this.getOption<OptionFileValue>("tooltip-background-blur");
    let paddingWidth = this.getOption<number>("tooltip-padding-width");
    let paddingHeight = this.getOption<number>("tooltip-padding-height");
    let radius = this.getOption<number>("tooltip-radius");
    let showIcon = this.getOption<boolean>("tooltip-icon");
    let commaDisplay = this.getOption<boolean>("tooltip-comma-display")
    let nameFontColor = new Color(this.getOption<Color>("tooltip-name-font-color")).hexa();
    let nameFontSize = this.getOption<number>("tooltip-name-font-size");
    let valueFontColor = new Color(this.getOption<Color>("tooltip-value-font-color")).hexa();
    let valueFontSize = this.getOption<number>("tooltip-value-font-size");
    let showTitle = this.getOption<boolean>("tooltip-title");
    let titleFontColor = new Color(this.getOption<Color>("tooltip-title-font-color")).hexa();
    let titleFontSize = this.getOption<number>("tooltip-title-font-size");

    const projectId = this.getBoard().projectId;
    const seriesCssColors = this.getSeriesCssColors();
    let showTooltip = this.getOption<boolean>("tooltip");
    let tooltipBackground = backgroundImage?.relativePath ? `url("${projectId}/${backgroundImage.relativePath}")` : backgroundColor;

    let tooltipStyle = this.getOption("tooltip-text-type");
    let tooltipDecimalPlaces = this.getOption<number>("tooltip-decimal-places");
    let tooltipCompleteZero = this.getOption<boolean>("tooltip-complete-zero");

    let isDefaul = !(xDims?.length && yDims?.length)
    let yUids = yDims?.map(item=>item.uid[2]) || []
    return {
      trigger: this.tooltipTrigger,
      axisPointer: this.tooltipAxisPointer,
      show: showTooltip,
      borderWidth: 0,
      padding: [paddingHeight, paddingWidth, paddingHeight, paddingWidth],
      extraCssText: `
        background: ${tooltipBackground};
        background-size: 100% 100%;
        background-repeat: no-repeat;
        background-position: center center;
        border-radius: ${radius}px;
        backdrop-filter: blur(${backgroundBlur}px);
        z-index:0;
      `,
      formatter: (params) => {
        let dataHtml = "";
        let noRepeatArr = [];
        let keys = []
        // 去重
        params.forEach(item => {
          if (!keys.includes(item.seriesId)) {
            keys.push(item.seriesId);
            noRepeatArr.push(item);
          }
        })

        for (let param of noRepeatArr || []) {
          if (param.seriesName.includes("-bg")) continue;

          let iconHtml = showIcon ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${isDefaul ? '#1890FFFF' : seriesCssColors[yUids.indexOf(param.seriesId.split('-')[0])][0]};"></span>` : "";
          let val = param.value[param.dimensionNames[param.encode.y[0]]];

          if (this.transposed) {
            val = param.value[param.dimensionNames[param.encode.x[0]]] ;
          }
          val = val * 0.01;
          if (tooltipStyle === "normal") {
            val = formatFloat(val, tooltipDecimalPlaces, tooltipCompleteZero);
          } else if (tooltipStyle === "percent") {
            val = formatFloat(val*100, tooltipDecimalPlaces, tooltipCompleteZero) + "%";
          }
          if(commaDisplay){
            val = this.doCommaSeparat(val)
          }
          dataHtml += `<div>
            ${iconHtml}
            <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${param.seriesName}：</span>
            <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${val}</span>
          </div>`;
        }
        let titleHtml = showTitle ? `<div>
          <span style="color:${titleFontColor};font-size:${titleFontSize}px;line-height:1;">${params[0]?.name}</span>
        </div>` : "";
        return `
          <div>
            ${titleHtml}
            <div>${dataHtml}</div>
          </div>
        `;
      },
      position: (point, params, dom, rect, size) => {
        return this.getOption("tooltip-position") == "auto" ? void 0 : [point[0], "50%"] 
      }
    }
  }
}
