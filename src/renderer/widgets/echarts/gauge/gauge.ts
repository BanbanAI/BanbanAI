import { PrivateData, PrivateDataConnectionUID, PrivateDataTableUID } from "@common/types/project";
import { DefinedOptions, OptionFieldValue, OptionColorValue, WidgetMetaData } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { formatFloat } from "@common/utils/math";
import { TheWidget as Echarts, component as B2Chart } from "@renderer/widgets/echarts/basic";
import { TooltipComponentOption, XAXisComponentOption, YAXisComponentOption, SeriesOption, color } from "echarts/dist/echarts";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { merge, recursive } from "merge";
import { ref, watch } from 'vue';
import {
  evaluateBucketStageTableAggregateField,
  getTableAggregateFieldRows,
  shouldBypassSecondarySummary,
} from "../../basic/_common/tableAggregateField";

export class Gauge extends Echarts {
  noDims: Boolean = false;
  static resource:any = recursive(true, Echarts.resource, resource);
  public defaultColors10 = ["#1890FFFF", "#DDDDDDFF", "#AAAAAAFF"];
  static defineOptions(): DefinedOptions[] {
    const UNIT_WEI = i18next.t("unitWei");
    return [
      {
        data: {
          fields: {
            alias: i18next.t("fieldsSetting"),
            fold: "unfold",
            children: [
              {
                name: "axis-value",
                type: "field(aggs=none|sum|max|min|mean|count|distinct, max=1)",
                alias: i18next.t("axisValue"),
                default: [{ "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_1"], "__opt_type": "field", "summary": "sum" }]
              },
              {
                name: "axis-value-field",
                type: "select",
                alias: i18next.t("axis_value_field"),
                selectChoices: (element: Gauge) => {
                  let choices = [];
                  let valueDims = element.getOption<OptionFieldValue[]>(["axis-value"]) || [];
                  let xUid = valueDims[0].uid[2]
                  if (valueDims[0]?.summary === "count") {
                    element.datasetSource().forEach((row)=>{
                      choices.push({ value: row[xUid], label: row[xUid] });
                    })
                  }
                  return choices;
                },
                visible:(element: Gauge) => {
                  let axisValueDim = element.getOption<OptionFieldValue[]>(["axis-value"])
                  let data = element.datasetSource()
                  return axisValueDim[0]?.summary === "count"  && typeof data[0]?.[axisValueDim[0]?.uid[2]] === 'string'
                }
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
            alias: i18next.t("basicSetting"),
            children: [
              {
                name: "scale-max",
                alias: i18next.t("scaleMax"),
                default: 10,
                type: "number"
              },
              {
                name: "scale-min",
                alias: i18next.t("scaleMin"),
                default: 0,
                type: "number"
              },
              {
                name: "scale-step",
                alias: i18next.t("scaleStep"),
                default: 10,
                type: "number(min=1)"
              }
            ]
          },
          "series-shape": {
            alias: i18next.t("seriesShape"),
            children: [
              {
                name: "gauge-shape-cluster",
                alias: i18next.t("gaugeShapeCluster"),
                fold: "unfold",
                show: "tab",
                children: [
                  {
                    name: "shape-gauge-size",
                    alias: i18next.t("gaugeSize"),
                    type: "number(min=1,max=90,step=1,showInput,unit=%)",
                    default: 75,
                  },
                  {
                    name: "shape-gauge-startAngle",
                    alias: i18next.t("gaugeStartAngle"),
                    type: "number(unit=°)",
                    default: 208,
                  },
                  {
                    name: "shape-gauge-endAngle",
                    alias: i18next.t("gaugeEndAngle"),
                    type: "number(unit=°)",
                    default: -28,
                  },
                  {
                    name: "shape-gauge-style",
                    alias: i18next.t("shapeGaugeStyle"),
                    type: "select(radioGroup)",
                    default: "normal",
                    selectChoices: [
                      {
                        label: i18next.t("shapeGaugeStyleNormal"),
                        value: "normal"
                      },
                      {
                        label: i18next.t("shapeGaugeStyleColorful"),
                        value: "colorful"
                      },
                      {
                        label: i18next.t("shapeGaugeStyleBurst"),
                        value: "burst"
                      }
                    ],
                  },
                  {
                    name: "shape-gauge-axis-shape",
                    alias: i18next.t("shapeGaugeAxisShape"),
                    type: "select(radioGroup)",
                    default: "normal",
                    selectChoices: [
                      {
                        label: i18next.t("shapePointTypeNormal"),
                        value: "normal"
                      },
                      {
                        label: i18next.t("shapePointTypeCircle"),
                        value: "round"
                      },
                    ],
                    visible: (widget: Gauge) => {
                      return widget.getOption("shape-gauge-style") !== "burst";
                    },
                  },
                  {
                    name: "shape-gauge-width",
                    alias: i18next.t("shapeGaugeWidth"),
                    type: "number(unit=px)",
                    default: 20,
                    visible: (widget: Gauge) => {
                      return widget.getOption("shape-gauge-style") !== "burst";
                    },
                  },
                  {
                    name: "shape-burst-width",
                    alias: i18next.t("shapeBurstWidth"),
                    type: "number(unit=px)",
                    default: 5,
                    visible: (widget: Gauge) => {
                      return widget.getOption("shape-gauge-style") === "burst";
                    },
                  },
                  {
                    name: "shape-burst-length",
                    alias: i18next.t("shapeBurstLength"),
                    type: "number(unit=px)",
                    default: 30,
                    visible: (widget: Gauge) => {
                      return widget.getOption("shape-gauge-style") === "burst";
                    },
                  },
                  {
                    name: "scale-color-section",
                    cluster: "array",
                    alias: i18next.t("scaleColorSection"),
                    visible: (widget: Gauge) => {
                      return widget.getOption("shape-gauge-style") === "colorful";
                    },
                    children: [{
                      name: "scale-color-propotion",
                      alias: i18next.t("scaleColorPropotion"),
                      type: "color(gradient)",
                      // gradient:true,
                      default: "#1890FF",
                    },
                    {
                      name: "scale-propotion",
                      alias: i18next.t("scalePropotion"),
                      type: "number(unit=%)",
                      default: 20,
                    }
                    ]
                  },
                ]
              },
              {
                name: "gauge-point",
                alias: i18next.t("gaugePoint"),
                fold: "unfold",
                show: "tab",
                children: [
                  {
                    name: "show-shape-point",
                    alias: i18next.t("showShapePoint"),
                    type: "boolean",
                    default: (widget: Gauge) => {
                      return widget.getOption("shape-gauge-style") !== "burst";
                    }
                  },
                  {
                    name: "shape-point-color-type",
                    alias: i18next.t("shapePointColorType"),
                    type: "select(radioGroup)",
                    default: "follow",
                    visible: (widget: Gauge) => {
                      return widget.getOption("show-shape-point");
                    },
                    selectChoices: [
                      {
                        label: i18next.t("shapePointColorTypeFollow"),
                        value: "follow"
                      }, {
                        label: i18next.t("shapePointColorTypeCustom"),
                        value: "custom"
                      }
                    ]
                  },
                  {
                    name: "shape-point-color",
                    alias: i18next.t("shapePointColor"),
                    type: "palette(gradient)",
                    default: ["#1688ee", "#1688ee", "#ffffff"],
                    visible: (widget: Gauge) => {
                      return widget.getOption("shape-point-color-type") === "custom" && widget.getOption("show-shape-point");
                    },
                  },
                  {
                    name: "shape-point-type",
                    alias: i18next.t("shapePointType"),
                    type: "select",
                    default: "",
                    visible: (widget: Gauge) => {
                      return widget.getOption("show-shape-point");
                    },
                    selectChoices: [
                      {
                        label: i18next.t("shapePointTypeNormal"),
                        value: ""
                      },
                      {
                        value: "rect",
                        label: i18next.t("shapePointTypeRect"),
                      },
                      {
                        value: "circle",
                        label: i18next.t("shapePointTypeCircle"),
                      },
                      {
                        value: "roundRect",
                        label: i18next.t("shapePointTypeRoundRect"),
                      },
                      {
                        value: "triangle",
                        label: i18next.t("shapePointTypeTriangle"),
                      },
                      {
                        value: "diamond",
                        label: i18next.t("shapePointTypeDiamond"),
                      },
                      {
                        value: "arrow",
                        label: i18next.t("shapePointTypeArrow"),
                      },
                      {
                        value: "image",
                        label: i18next.t("shapePointTypeImage"),
                      },
                    ],
                  },
                  {
                    name: "shape-point-image",
                    alias: i18next.t("imageUrl"),
                    type: "file(format=image)",
                    default: "",
                    visible: (widget: Gauge) => {
                      return widget.getOption("shape-point-type") == "image" && widget.getOption("show-shape-point");
                    },
                  },
                  {
                    name: "shape-point-length",
                    alias: i18next.t("shapePointLength"),
                    type: "number(unit=%)",
                    visible: (widget: Gauge) => {
                      return widget.getOption("show-shape-point");
                    },
                    default: 60
                  },
                  {
                    name: "shape-point-line-width",
                    type: "number(unit=px, min=0)",
                    alias: i18next.t("shapePointLineWidth"),
                    visible: (widget: Gauge) => {
                      return widget.getOption("show-shape-point");
                    },
                    default: 6,
                  },
                  {
                    name: "shape-point-line-offset",
                    alias: i18next.t("shapePointLineOffset"),
                    type: "vector<X, Y>(unit=px)",
                    default: [0,0],
                    visible: (widget: Gauge) => {
                      return widget.getOption("show-shape-point");
                    },
                  },
                  {
                    name: "shape-point-radius",
                    alias: i18next.t("shapePointRadius"),
                    type: "number(unit=px, min=0)",
                    visible: (widget: Gauge) => {
                      return widget.getOption("show-shape-point");
                    },
                    default: 5
                  },
                  {
                    name: "shape-point-width",
                    alias: i18next.t("shapePointWidth"),
                    type: "number(unit=px, min=0)",
                    visible: (widget: Gauge) => {
                      return widget.getOption("show-shape-point");
                    },
                    default: 2
                  },
                  {
                    name: "shape-point-top",
                    alias: i18next.t("shapePointTop"),
                    type: "boolean",
                    visible: (widget: Gauge) => {
                      return widget.getOption("show-shape-point");
                    },
                    default: true
                  },
                ]
              },
            ]
          },
          "scale": {
            alias: i18next.t("scale"),
            type: "boolean",
            default: true,
            children: [
              {
                name: "scale-tickline-display-cluster",
                alias: i18next.t("scaleTicklineDisplayCluster"),
                visible: (widget: Gauge) => {
                  return widget.getOption("shape-gauge-style") !== "burst";
                },
                show: "tab",
                children: [
                  {
                    name: "scale-tickline-display",
                    alias: i18next.t("scaleTicklineDisplay"),
                    type: "boolean",
                    default: true,
                  },
                  {
                    name: "scale-tickline-color",
                    alias: i18next.t("scaleTicklineColor"),
                    type: "color",
                    default: "#CCCCCC",
                    disabled: (widget: Gauge) => {
                      return !widget.getOption("scale-tickline-display");
                    },
                  },
                  {
                    name: "scale-tickline-width",
                    alias: i18next.t("scaleTicklineWidth"),
                    default: 1,
                    type: "number(unit=px, min=0)",
                    disabled: (widget: Gauge) => {
                      return !widget.getOption("scale-tickline-display");
                    },
                  },
                  {
                    name: "scale-tickline-length",
                    alias: i18next.t("scaleTicklineLength"),
                    default: 30,
                    type: "number(unit=px)",
                    disabled: (widget: Gauge) => {
                      return !widget.getOption("scale-tickline-display");
                    },
                  },
                ]
              },
              {
                name: "tooltip-font-style",
                alias: i18next.t("tooltipFontStyle"),
                show: "tab",
                children: [
                  {
                    name: "scale-percent-display",
                    alias: i18next.t("scalePercentDisplay"),
                    type: "boolean",
                    default: false,
                  },
                  {
                    name: "scale-color-follow",
                    alias: i18next.t("scaleColorFollow"),
                    default: 0,
                    type: "boolean",
                    visible: (widget: Gauge) => {
                      return widget.getOption("shape-gauge-style") === "colorful"
                    }
                  },
                  {
                    name: "scale-text-offset",
                    alias: i18next.t("scaleTextOffset"),
                    default: 25,
                    type: "number(unit=px)"
                  },
                  {
                    name: "scale-font",
                    alias: i18next.t("scaleFont"),
                    type: "font",
                    default: {
                      color: "#ffffff",
                      family: "sans-serif",
                      size: 18,
                      bold: false,
                      italic: false,
                      underline: false,
                      "line-through": false
                    },
                  },
                  {
                    name: "scale-step-zero",
                    alias: i18next.t("textCompleteZero"),
                    type: "boolean",
                    default: false
                  },
                  {
                    name: "scale-step-digit-num",
                    alias: i18next.t("textDecimalPlaces"),
                    type: "number(unit=位)",
                    default: 2,
                  }
                ]
              }

            ]
          },
          "text-name": {
            alias: i18next.t("textName"),
            type: "boolean",
            default: true,
            children: [
              {
                name: "text-name-customize-display",
                alias: i18next.t("textNameCustomizeDisplay"),
                type: "boolean",
                default: false
              },
              {
                name: "text-name-customize",
                alias: i18next.t("textNameCustomize"),
                type: "string",
                visible: (widget: Gauge) => {
                  return widget.getOption("text-name-customize-display");
                }
              },
              {
                name: "text-name-font",
                alias: i18next.t("textNameFont"),
                type: "font",
                default: {
                  color: "#ffffff",
                  family: 'sans-serif',
                  size: 12,
                  bold: false,
                  italic: false,
                  underline: false,
                  "line-through": false
                },
              },
              {
                name: "text-name-customize-offset",
                alias: i18next.t("textNameCustomizeOffset"),
                type: "number(unit=%)",
                default: 0
              },
            ]
          },
          "text-value": {
            alias: i18next.t("textValue"),
            type: "boolean",
            default: false,
            children: [
              {
                name: "trend-data-format-text",
                alias: i18next.t("trendDataFormatText"),
                show: "tab",
                children: [
                  {
                    name: "text-complete-zero",
                    alias: i18next.t("textCompleteZero"),
                    type: "boolean",
                    default: false,
                  },
                  {
                    name: "text-decimal-places",
                    alias: i18next.t("textDecimalPlaces"),
                    type: "number(unit=" + UNIT_WEI + ", min=0)",
                    default: 2,
                  },
                ]
              },
              {
                name: "series-shape-style-text",
                alias: i18next.t("seriesShapeStyleText"),
                show: "tab",
                children: [
                  {
                    name: "unit",
                    alias: i18next.t("unit"),
                    type: "boolean",
                    default: false
                  },
                  {
                    name: "unit-text",
                    alias: i18next.t("unitText"),
                    type: "string",
                    default: "",
                    visible: (widget: Gauge) => {
                      return widget.getOption("unit");
                    },
                  },
                  {
                    name: "text-value-font",
                    alias: i18next.t("textValueFont"),
                    type: "font",
                    default: {
                      color: "#ffffff",
                      family: "sans-serif",
                      size: 18,
                      bold: false,
                      italic: false,
                      underline: false,
                      "line-through": false
                    },
                  },
                  {
                    name: "display-shadow-color",
                    alias: i18next.t("displayShadowColor"),
                    type: "color",
                    default: "#FFFFFF"
                  },
                  {
                    name: "display-shadow-blur",
                    alias: i18next.t("displayShadowBlur"),
                    type: "number(unit=px)",
                    default: 0,
                  },
                  {
                    name: "display-shadow-offset",
                    alias: i18next.t("displayShadowOffset"),
                    type: "vector<X,Y>(unit=px)",
                    default: [0, 0],
                  },

                  {
                    name: "text-value-offset",
                    alias: i18next.t("texValueOffset"),
                    type: "number(unit=%)",
                    default: 0
                  },
                ]
              }
            ]
          },
          "percent-value": {
            alias: i18next.t("percentValue"),
            default: false,
            type: "boolean",
            children: [
              {
                name: "trend-data-format-percent",
                alias: i18next.t("trendDataFormatPercent"),
                show: "tab",
                children: [
                  {
                    name: "complete-zero",
                    alias: i18next.t("completeZero"),
                    type: "boolean",
                    default: false
                  },
                  {
                    name: "decimal-places",
                    alias: i18next.t("decimalPlaces"),
                    type: "number(unit=" + UNIT_WEI + ", min=0)",
                    default: 2,
                  },
                ]
              },
              {
                name: "series-shape-style-percent",
                alias: i18next.t("seriesShapeStylePercent"),
                show: "tab",
                children: [{
                  name: "text-value-prefix-display",
                  alias: i18next.t("textValuePrefixDisplay"),
                  type: "boolean",
                  default: false
                },
                {
                  name: "text-value-prefix",
                  alias: i18next.t("textValuePrefix"),
                  type: "string",
                  default: "占比:",
                  visible: (widget: Gauge) => {
                    return widget.getOption("text-value-prefix-display");
                  }
                },
                {
                  name: "text-percent-font",
                  alias: i18next.t("textPercentFont"),
                  type: "font",
                  default: {
                    color: "#ffffff",
                    family: 'sans-serif',
                    size: 18,
                    bold: false,
                    italic: false,
                    underline: false,
                    "line-through": false
                  },
                },
                ],
              }
            ]
          },
          "legend": {
            visible: false,
            default: false
          },
          "sort": {
            visible: false
          },
          "tooltip": {
            visible: false
          }
        },
      },
      ...super.defineOptions()
    ]
  }

  get echartsXAxisOption(): XAXisComponentOption {
    return {
      show: false
    }
  }

  get echartsYAxisOption(): YAXisComponentOption {
    return {
      show: false
    }
  }

  get echartsTooltipOption(): TooltipComponentOption | TooltipComponentOption[] {
    return {
      show: false
    }
  }

  protected getDefaultPrivateData(): PrivateData {
    return {
      fields: [
        { uid: "f_1", alias: "数值", type: "number" },
      ],
      rows: [
        { f_1: 5 },
        { f_1: 6 },
        { f_1: 4 },
        { f_1: 7 },
      ],
    };
  }

  checkErrorData() {
    let axisValueDim: any = this.getOption("axis-value") || [];
    if (axisValueDim.length) {
      this.clearErrorDataStatus();
    } else {
      this.addErrorDataStatus("filed-empty");
    }
  }

  handleImageSrc(relativePath) {
    const projectId = this.getBoard().projectId;
    return relativePath ? `${projectId}/${relativePath}` : "";
  }

  imageSrc(imageOptions) {
    if(typeof imageOptions === "string"){
      return imageOptions;
    }else{
      return imageOptions?.url || this.handleImageSrc(imageOptions?.relativePath);
    }
  }

  dealDataByCount(sourceData,categoryUids,valueDims) {
    let temp = {};
    sourceData.forEach((row,index)=>{
      let xVals = []
      for(let xuid of categoryUids){
        xVals.push(row[xuid]);
      }
      let xKey = xVals.join("$") + "$";
      if(!temp[xKey]){
        temp[xKey] = { ...row };
        for(let key in temp[xKey]){
          let valueDim = valueDims.find((dim)=> dim?.uid?.[2] === key);
          if(valueDim && valueDim?.summary === "count"){
            let count = temp[xKey][`${key}_count`] || 0;
            temp[xKey][`${key}_count`] = count + 1;
          }
        }
      }else{
        for(let key in temp[xKey]){
          let valueDim = valueDims.find((dim)=> dim?.uid?.[2] === key);
          if(valueDim && valueDim?.summary === "count"){
            let count = temp[xKey][`${key}_count`] || 1;
            temp[xKey][`${key}_count`] = count + 1;
          }
        }
      }
    })
    let values = Object.values(temp);
    return values;
  }

  _datasetSource() {
    const valueDims = this.getOption<OptionFieldValue[]>("axis-value") || [];
    const valueDim = valueDims[0];
    if(!valueDim) return [];

    if (shouldBypassSecondarySummary(this, valueDim)) {
      return [{
        [valueDim.uid[2]]: evaluateBucketStageTableAggregateField(this, valueDim, getTableAggregateFieldRows(this, valueDim.uid)) ?? 0,
      }];
    }

    let dataSourceOrigin = this.createView(["axis-value"]);
    const valueUid = valueDim.uid[2];
    if (valueUid?.split(".")?.length > 1) dataSourceOrigin = this.flatDataset(dataSourceOrigin, [valueDim.uid[2]]);
    let dataSource = [];
    switch(valueDim.summary){
      case "count":
        if (typeof dataSourceOrigin[0]?.[valueUid] === "number") {
          dataSource.push({
            [valueUid]: dataSourceOrigin.length,
          })
        }else{
          dataSource = this.dealDataByCount(dataSourceOrigin, [valueDims[0].uid[2]], valueDims)
        }
        break;
      case "sum":
        dataSource.push({
          [valueUid]: dataSourceOrigin.reduce((sum, item) => {
            return sum + item[valueUid];
          }, 0)
        })
        break;
      case "mean":
        dataSource.push({
          [valueUid]: dataSourceOrigin.reduce((sum, item) => {
            return sum + item[valueUid];
          }, 0) / (dataSourceOrigin.length || 1)
        })
        break;
      case "max":
        dataSource.push({
          [valueUid]: Math.max(...dataSourceOrigin.map(item => item[valueUid]))
        })
        break;
      case "min":
        dataSource.push({
          [valueUid]: Math.min(...dataSourceOrigin.map(item => item[valueUid]))
        })
        break;
      default:
        return dataSourceOrigin;
    }
    return dataSource;
  }

  get echartsSeriesOption(): SeriesOption | SeriesOption[] {
    let value = 0;
    let fieldName = "value"
    let axisValueDim: any = this.getOption("axis-value") || [];
    let valDimsField =this.getOption("axis-value-field");
    if (axisValueDim.length) {
      let data = this.datasetSource()
      fieldName = this.getFieldAlias(axisValueDim[0].uid);
      if (axisValueDim[0].summary === "count"  && typeof data[0]?.[axisValueDim[0].uid[2]] === 'string'){
        let dataIndex = data.findIndex((row)=>row[axisValueDim[0]?.uid[2]] === valDimsField);
        value = data?.[dataIndex]?.[axisValueDim[0].uid[2] + '_count'] || 0;
      } else {
        value = data[0]?.[axisValueDim[0].uid[2]] || 0;
      }
    } else {
      let privateData = this.getPrivateData();
      let fieldTypeUids = this.getPrivateFieldTypeUids();
      fieldName = privateData.fields?.find?.((field) => { return field.uid === fieldTypeUids.number?.[0] })?.alias;
      value = privateData.rows?.[0]?.[fieldTypeUids.number?.[0]];
    }

    let max = this.getOption<number>("scale-max");
    let min = this.getOption<number>("scale-min");
    let scaleStep = this.getOption<number>("scale-step");
    let shapeGaugeStyle = this.getOption<string>("shape-gauge-style");
    let isBurst = shapeGaugeStyle === "burst";
    let pointerColor = this.getSerieEchartsColors()[0];
    let scaleColorsIndexs = this.getArrayClusterIndexes("scale-color-section") || [];
    let scaleColors = [];
    let totalPropotion = 0;
    let sacleFont = this.getOption("scale-font");
    let titleFont = this.getOption("text-name-font");
    let valueFont = this.getOption("text-value-font");
    let percentValueFont = this.getOption("text-percent-font");
    let unitValue = this.getOption("unit") ? this.getOption("unit-text") : '';
    let textNameCustomize = this.getOption("text-name-customize-display");
    let shadowColor = this.getOption("display-shadow-color")
    let shadowBlur = this.getOption("display-shadow-blur")
    let [shadowOffsetX, shadowOffsetY] = this.getOption<Number[]>("display-shadow-offset");
    let axisShape = this.getOption("shape-gauge-axis-shape")

    if (shapeGaugeStyle === "colorful") {
      scaleColorsIndexs.forEach((idx, index) => {
        let colorArr = [];
        let propotion = this.getOption<number>(["scale-color-section", idx, "scale-propotion"]) * 0.01;
        totalPropotion += propotion;
        let color = this.toEchartsColor(this.getOption(["scale-color-section", idx, "scale-color-propotion"]))
        colorArr.push(totalPropotion);
        colorArr.push(color);
        scaleColors.push(colorArr);

      })
      scaleColors.push([1, "#CAC5C5FF"])
    } else {
      scaleColors = axisShape === 'round' && value > max
        ? [[Math.max(0, (value - min) / (max - min)), this.getSerieEchartsColors()[0]]]
        : [
          [Math.max(0, (value - min) / (max - min)), this.getSerieEchartsColors()[0]],
          [1, this.getSerieEchartsColors()[1]]
        ];
    }

    let paddingValue = this.padding;
    let centerX = this.contentSize.width / 2 + paddingValue.left - paddingValue.right;
    let centerY = this.contentSize.height * 0.55 + paddingValue.top - paddingValue.bottom;
    let radius = this.getOption<number>("shape-gauge-size");
    let pointerType = this.getOption("shape-point-type");
    let showPoint = this.getOption("show-shape-point");
    if(pointerType == "image"){
      pointerType = `${pointerType}://${this.imageSrc(this.getOption("shape-point-image"))}`
    }
    let colorType = this.getOption("shape-point-color-type");
    let pointerColors = this.getOption<Color[]>("shape-point-color") || [];
    pointerColors = pointerColors.map(color => {
      return this.toEchartsColor(color);
    })
    let length = this.getOption("shape-point-length");
    let centerSize = this.getOption("shape-point-radius");
    let centerBorder = this.getOption("shape-point-width");
    let pointTop = this.getOption("shape-point-top");

    let startAngle = this.getOption("shape-gauge-startAngle");
    let endAngle = this.getOption("shape-gauge-endAngle");

    let textNameOffset = this.getOption<number>("text-name-customize-offset");
    let textValueOffset = this.getOption<number>("text-value-offset");
    let gaugeOpts: any = [{
      name: 'Pressure',
      type: 'gauge',
      center: [centerX, centerY],
      radius: `${radius}%`,
      max: max,
      min: min,
      splitNumber: scaleStep,
      startAngle: startAngle,
      endAngle: endAngle,
      detail: {
        show: this.getOption("text-value") || this.getOption("percent-value"),
        offsetCenter: isBurst ? [0, `${25 + textValueOffset}%`] : [0, `${60 + textValueOffset}%`],
        fontSize: valueFont["size"],
        color: valueFont["color"],
        fontWeight: valueFont["bold"] ? 'bold' : 'normal',
        fontStyle: valueFont["italic"] ? 'italic' : 'normal',
        fontFamily: valueFont["family"],
        textShadowColor: shadowColor,
        textShadowBlur: shadowBlur,
        textShadowOffsetX: shadowOffsetX,
        textShadowOffsetY: shadowOffsetY,
        formatter: (value) => {
          let result = value;
          result = formatFloat(value, this.getOption("text-decimal-places"), this.getOption("text-complete-zero"));
          result = result + unitValue;
          let valueArr = [];
          if (this.getOption("text-value")) {
            valueArr.push(result);
          }

          if (this.getOption("percent-value")) {
            let percentValue = formatFloat(value / max * 100, this.getOption("decimal-places"), this.getOption("complete-zero"));
            percentValue = this.getOption("text-value-prefix-display") ? this.getOption("text-value-prefix") + percentValue + "%" : percentValue + "%";
            valueArr.push(`{percent|${percentValue}}`);
          }

          return valueArr.join('\n');
        },
        rich: {
          percent: {
            fontSize: percentValueFont["size"],
            color: percentValueFont["color"],
            fontWeight: percentValueFont["bold"] ? 'bold' : 'normal',
            fontStyle: percentValueFont["italic"] ? 'italic' : 'normal',
            fontFamily: percentValueFont["family"]
          }
        }
      },
      anchor: {
        show: showPoint,
        showAbove: pointTop,
        size: centerSize,
        itemStyle: {
          borderColor: colorType === "follow" ? pointerColor : pointerColors[1] || pointerColor,
          borderWidth: centerBorder,
          color: colorType === "follow" ? pointerColor : pointerColors[2] || pointerColor,
        },
      },
      axisLine: {
        lineStyle: {
          width: isBurst ? 0 : this.getOption("shape-gauge-width"),
          color: scaleColors,
          opacity: isBurst ? 0 : 1
        },
        roundCap: axisShape === "round"
      },
      axisLabel: {
        show: this.getOption("scale"),
        distance: this.getOption("scale-text-offset"),
        fontSize: sacleFont["size"],
        color: this.getOption("scale-color-follow") ? "inherit" : sacleFont["color"],
        fontWeight: sacleFont["bold"] ? 'bold' : 'normal',
        fontStyle: sacleFont["italic"] ? 'italic' : 'normal',
        fontFamily: sacleFont["family"],
        formatter: (value) => {
          if (isBurst) {
            if (value === min) return value;
            if (value === max) return value;
          } else {
            if (this.getOption("scale-percent-display")) {
              let percent = formatFloat(value / max * 100, this.getOption("scale-step-digit-num"), this.getOption("scale-step-zero"));
              return percent + "%";
            }
            return formatFloat(value, this.getOption("scale-step-digit-num"), this.getOption("scale-step-zero"));
          }

        }
      },
      axisTick: {
        show: this.getOption("scale-tickline-display"),
        distance: -this.getOption("shape-gauge-width"),
        length: isBurst ? this.getOption("shape-burst-length") : this.getOption("shape-gauge-width"),
        lineStyle: {
          color: isBurst ? "auto" : this.toEchartsColor(this.getOption("scale-tickline-color")),
          width: isBurst ? this.getOption("shape-burst-width") : this.getOption("scale-tickline-width"),
          opacity: 1
        }
      },
      // 文字名称选项
      title: {
        show: this.getOption("text-name"),
        offsetCenter: isBurst ? [0, `${-25 + textNameOffset}%`] : [0, `${30 + textNameOffset}%`],
        fontSize: titleFont["size"],
        color: titleFont["color"],
        fontWeight: titleFont["bold"] ? 'bold' : 'normal',
        fontStyle: titleFont["italic"] ? 'italic' : 'normal',
        fontFamily: titleFont["family"],
      },
      splitLine: {
        distance: -this.getOption("shape-gauge-width"),
        length: this.getOption("scale-tickline-length"),
        show: this.getOption("scale-tickline-display") && !isBurst,
        lineStyle: {
          color: this.toEchartsColor(this.getOption("scale-tickline-color")),
          width: this.getOption("scale-tickline-width")
        }
      },
      pointer: {
        show: showPoint,
        icon: pointerType,
        offsetCenter: this.getOption("shape-point-line-offset"),
        width: this.getOption("shape-point-line-width"),
        length: length + "%",
        itemStyle: {
          color: colorType === "follow" ? pointerColor : pointerColors[0] || pointerColor
        },
      },
      data: [
        {
          value: value,
          name: textNameCustomize ? this.getOption("text-name-customize") : fieldName,
        }
      ]
    }]
    let insideTickOpt: any = {
      type: 'gauge',
      max: max,
      min: min,
      startAngle: startAngle,
      endAngle: endAngle,
      center: [centerX, centerY],
      radius: `${radius}%`,
      anchor: {
        show: false,
      },
      axisLine: {
        lineStyle: {
          width: 0,
          opacity: 0,
          show: false
        }
      },
      axisTick: {
        distance: 20,
        length: 5,
        show: isBurst,
        lineStyle: {
          color: this.getSerieEchartsColors()[2],
          width: this.getOption("shape-burst-width"),
          opacity: 1
        }
      },
      pointer: {
        show: false
      },
      splitLine: {
        show: false
      },
      title: {
        show: false
      },
      axisLabel: {
        show: false
      },
      detail: {
        show: false
      }

    }
    if (shapeGaugeStyle === "burst") {
      gaugeOpts.push(insideTickOpt)
    }
    return gaugeOpts;
  }

  get axisValue() {
    return this.getOption<OptionFieldValue[]>("axis-value") || [];
  }

  override getMetaData() {
    return merge(super.getMetaData(), {
      axisValue: [
        ...this.axisValue
      ]
    } as WidgetMetaData);
  }
}

