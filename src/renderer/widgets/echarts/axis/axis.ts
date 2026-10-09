import { TheWidget as EchartsBasic } from "@renderer/widgets/echarts/basic";
import { PrivateDataConnectionUID, PrivateDataTableUID, OptionFieldUID } from "@common/types/project";
import { DefinedOptions, OptionFontValue, OptionFileValue, OptionFieldValue, WidgetMetaData, ChartClickState } from "@renderer/b2/types";
import { Soul, OptionValue } from "@common/types/project";
import { Widget } from "@renderer/b2/controllers/widget";
import { Board } from "@renderer/b2/controllers/board";
import { Color } from "@renderer/b2/color";
import { formatFloat } from "@common/utils/math";
import { ref, Ref, watch } from "vue";
import { XAXisComponentOption, YAXisComponentOption, TooltipComponentOption, EChartsOption, DataZoomComponentOption } from "echarts/dist/echarts";
import resource from "./locales/index";
import i18next from "@renderer/widgets/i18next";
import { recursive } from "merge";
import { merge } from "lodash";
import { formatTimeCategoryLabelByStartedAt, getNextTimeCategoryStartedAt, isTimeCategorySummary } from "../basic/utils/aggregator";

const UNIT_GE = "个";
const UNIT_WEI = "位";

export class Axis extends EchartsBasic {
  static resource = recursive(true, EchartsBasic.resource, resource);
  public stopAnimate: boolean = false;
  public selectedIndex: Ref<number> = ref(-1);
  public selectedData: Ref<{}> = ref(null);
  public resetSelectedIndex: Ref<boolean> = ref(false);
  public xTypes = [];
  public xValuesToSeriesList = [];
  protected axisUnitMap: Object = {
    3: "k",
    4: "万",
    5: "十万",
    6: "百万",
    7: "千万",
    8: "亿",
  };
  public defaultColors10 = Array.from(["#1890FF", "#5ad8a6", "#5d7092", "#f6bd16", "#6f5ef9", "#6dc8ec", "#945fb9", "#ff9845", "#1e9493", "#ff99c3"]);

  constructor(soul: Soul, parent: Widget | Board) {
    // 兼容
    if (soul.options?.["series-shape-style"]) {
      let shapeStyle = soul.options?.["series-shape-style"];
      if (shapeStyle === "adaptive" || shapeStyle === "all") {
        soul.options["series-shape-number-type"] = "all";
      } else {
        soul.options["series-shape-number-type"] = "custom";
        soul.options["shape-column-width-type"] = "custom";
      }
      delete soul.options["series-shape-style"];
    }

    if(soul.options?.["grid"] === false){
      soul.options["grid-x-display"] = false;
      soul.options["grid-y-display"] = false;
      delete soul.options["grid"];
    }

    let xDims = soul.options?.["axis-x"] as OptionFieldValue[] || [];
    if(xDims.length > 1) {
      let newDims = Object.assign([], xDims);
      soul.options["axis-group"] = [newDims[1]];
      soul.options["axis-x"] = [newDims[0]];
    }
    super(soul, parent);
  }

  static defineOptions(): DefinedOptions[] {
    return [
      {
        data: {
          fields: {
            alias: i18next.t("fields"),
            fold: "unfold",
            children: [
              {
                name: "axis-x",
                alias: i18next.t("axisX"),
                type: "field(min=0, max=1)",
                default:[{"uid":[PrivateDataConnectionUID,PrivateDataTableUID,"f_name"], "__opt_type":"field", "summary":""}]
              },
              {
                name: "axis-y",
                alias: i18next.t("axisY"),
                type: "field(aggs=sum|none|max|min|mean|count|distinct, min=0)",
                default:[
                  {"uid":[PrivateDataConnectionUID, PrivateDataTableUID,"f_value1"], "__opt_type":"field", "summary":"sum"},
                  {"uid":[PrivateDataConnectionUID, PrivateDataTableUID,"f_value2"], "__opt_type":"field", "summary":"sum"},
                ]
              },
              {
                name: "axis-size",
                alias: i18next.t("axisSize"),
                type: "field",
                visible: false,
              },
              {
                name: "axis-fields",
                alias: i18next.t("axisFields"),
                type: "field",
                visible: false,
              },
              {
                name: "axis-line",
                alias: i18next.t("axisLine"),
                type: "field(aggs=sum|none|max|min|mean|count|distinct, min=0)",
                visible: false
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
          "series-color": {
            visible: false
          },
          "series-color-group": {
            alias: i18next.t("seriesColorGroup"),
            // fold: "disable",
            children: [
              {
                cluster: "array",
                alias: i18next.t("seriesColorCluster"),
                fold: "unfold",
                name: "series-color-cluster",
                items: (chart: Axis) => {
                  return chart.getSeries().map((series) => series.alias);
                },
                itemsHint: "数据字段",
                children: [
                  {
                    name: "series-color",
                    alias: i18next.t("seriesColorCluster"),
                    type: "color(gradient)",
                    default: (widget: Axis, paths: string[])=>{
                      const indexes = widget.getArrayClusterIndexes(["series-color-cluster"]);
                      const index = paths[1] as `idx-${string}`;
                      const idx = indexes.indexOf(index);
                      if (idx >= 0) {
                        return widget.defaultColors10[idx % 10];
                      } else {
                        return "#1890FF";
                      }
                    },
                  },
                ],
              },
            ],
          },
          "axis": {
            visible: true,
            children: [
              {
                name: "x-display-cluster",
                alias: i18next.t("xAxis"),
                show: "tab",
                children: [
                  {
                    name: "x-display",
                    alias: i18next.t("xAxisEnable"),
                    type: "boolean",
                    default: true,
                  },
                  {
                    name: "x-data-type",
                    alias: i18next.t("xDataType"),
                    type: "select(radioGroup)",
                    default: "category",
                    tip: i18next.t("xDataTypeyTips"),
                    selectChoices: [
                      {
                        value: "category",
                        label: i18next.t("category"),
                      },
                      {
                        value: "value",
                        label: i18next.t("value"),
                      },
                      {
                        value: "time",
                        label: i18next.t("time"),
                      },
                      {
                        value: "log",
                        label: i18next.t("log")
                      }
                    ],
                  },
                  {
                    name: "x-logBase",
                    alias: i18next.t("xLogBase"),
                    type: "number",
                    default: 10,
                    visible: (widget: Axis) => {
                      return widget.getOption("x-data-type") == "log";
                    },
                  },
                  {
                    name: "x-line-cluster",
                    alias: i18next.t("xLineCluster"),
                    children: [
                      {
                        name: "x-line",
                        alias: i18next.t("xLine"),
                        type: "boolean",
                        default: true,
                      },
                      {
                        name: "x-line-type",
                        alias: i18next.t("xLineType"),
                        type: "select(radioGroup)",
                        default: "solid",
                        selectChoices: [
                          {
                            value: "dashed",
                            label: i18next.t("dashed"),
                          },
                          {
                            value: "solid",
                            label: i18next.t("solid"),
                          },
                          {
                            value: "dottedLine",
                            label: i18next.t("dottedLine"),
                          }
                        ],
                        disabled: (widget: Axis) => {
                          return !widget.getOption("x-line");
                        },
                      },
                      {
                        name: "x-dotted-line-width",
                        alias: i18next.t("xDottedLineWidth"),
                        type: "vector<W1, W2>",
                        default: [2, 5],
                        visible: (widget: Axis) => {
                          return widget.getOption("x-line-type") === "dottedLine";
                        },
                        disabled: (widget: Axis) => {
                          return !widget.getOption("x-line");
                        },
                      },
                      {
                        name: "x-line-color",
                        alias: i18next.t("xLineColor"),
                        type: "color",
                        default: "#CCCCCC",
                        disabled: (widget: Axis) => {
                          return !widget.getOption("x-line");
                        },
                      },
                      {
                        name: "x-line-width",
                        alias: i18next.t("xLineWidth"),
                        type: "number(unit=px)",
                        default: 1,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("x-line");
                        },
                      },
                    ],
                  },
                  {
                    name: "x-tickline-cluster",
                    alias: i18next.t("xTicklineCluster"),
                    children: [
                      {
                        name: "x-tickline",
                        alias: i18next.t("yTickline"),
                        type: "boolean",
                        default: true,
                      },
                      {
                        name: "x-tickline-color",
                        alias: i18next.t("xTicklineColor"),
                        type: "color",
                        default: "#CCCCCC",
                        disabled: (widget: Axis) => {
                          return !widget.getOption("x-tickline");
                        },
                      },
                      {
                        name: "x-tickline-width",
                        alias: i18next.t("xTicklineWidth"),
                        type: "number(unit=px)",
                        default: 2,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("x-tickline");
                        },
                      },
                      {
                        name: "x-tickline-length",
                        alias: i18next.t("xTicklineLength"),
                        type: "number(unit=px)",
                        default: 5,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("x-tickline");
                        },
                      },
                    ],
                  },
                  {
                    name: "x-label-cluster",
                    alias: i18next.t("xLabelCluster"),
                    children: [
                      {
                        name: "x-label",
                        alias:  i18next.t("xLabel"),
                        type: "boolean",
                        default: true,
                      },
                      {
                        name: "x-show-all-label",
                        alias: i18next.t("xShowAllLabel"),
                        type: "boolean",
                        default: false,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("x-label");
                        },
                      },
                      {
                        name: "x-text-type",
                        alias: i18next.t("xTextType"),
                        default: "normal",
                        type: "select(radioGroup)",
                        selectChoices: [
                          {
                            label: i18next.t("value"),
                            value: "normal",
                          },
                          {
                            label: i18next.t("percent"),
                            value: "percent",
                          },
                        ],
                        disabled: (widget: Axis) => {
                          return !widget.getOption("x-label");
                        },
                        visible: (widget: Axis) => {
                          return widget.getOption("x-data-type") == "value";
                        },
                      },
                      {
                        name: "x-value-abbreviation",
                        alias: i18next.t("xValueAbbreviation"),
                        type: "select",
                        default: "0",
                        selectChoices: [
                          {
                            label: i18next.t("noSet"),
                            value: "0",
                          },
                          {
                            label: "K",
                            value: "3",
                          },
                          {
                            label: "万",
                            value: "4",
                          },
                          {
                            label: "十万",
                            value: "5",
                          },
                          {
                            label: "百万",
                            value: "6",
                          },
                          {
                            label: "千万",
                            value: "7",
                          },
                          {
                            label: "亿",
                            value: "8",
                          },
                        ],
                        disabled: (widget: Axis) => {
                          return !widget.getOption("x-label");
                        },
                        visible: (widget: Axis) => {
                          return (
                            widget.getOption("x-text-type") === "normal" &&
                            widget.getOption("x-data-type") == "value"
                          );
                        },
                      },
                      {
                        name: "x-decimal-places",
                        alias: i18next.t("xDecimalPlaces"),
                        type: "number(unit=" + UNIT_WEI + ")",
                        default: 0,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("x-label");
                        },
                        visible: (widget: Axis) => {
                          return widget.getOption("x-data-type") == "value";
                        },
                      },
                      {
                        name: "x-complete-zero",
                        alias: i18next.t("xCompleteZero"),
                        type: "boolean",
                        default: false,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("x-label");
                        },
                        visible: (widget: Axis) => {
                          return widget.getOption("x-data-type") == "value";
                        },
                      },
                      {
                        name: "x-label-offset",
                        alias: i18next.t("xLabelOffset"),
                        type: "number(unit=px)",
                        default: 10,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("x-label");
                        },
                      },
                      {
                        name: "x-scale-range",
                        alias: i18next.t("xScaleRange"),
                        type: "select(radioGroup)",
                        default: "adaptive",
                        selectChoices: [
                          {
                            value: "adaptive",
                            label: i18next.t("adaptive"),
                          },
                          {
                            value: "custom",
                            label: i18next.t("custom"),
                          },
                        ],
                        disabled: (widget: Axis) => {
                          return !widget.getOption("x-label");
                        },
                        visible: (widget: Axis) => {
                          return (
                            widget.getOption("x-data-type") === "value"
                          );
                        },
                      },
                      {
                        name: "x-scale-min",
                        alias: i18next.t("xScaleMin"),
                        type: "number<float>",
                        default: 0,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("x-label");
                        },
                        visible: (widget: Axis) => {
                          return (
                            widget.getOption("x-data-type") === "value" &&
                            widget.getOption("x-scale-range") === "custom"
                          );
                        },
                      },
                      {
                        name: "x-scale-max",
                        alias: i18next.t("xScaleMax"),
                        type: "number<float>",
                        default: 100,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("x-label");
                        },
                        visible: (widget: Axis) => {
                          return (
                            widget.getOption("x-data-type") === "value" &&
                            widget.getOption("x-scale-range") === "custom"
                          );
                        },
                      },
                      {
                        name: "x-scale-interval",
                        alias: i18next.t("xScaleInterval"),
                        type: "number<float>",
                        default: 50,
                        visible: (widget: Axis) => {
                          return widget.getOption("x-scale-range") == "custom";
                        },
                      },
                      {
                        name: "x-font",
                        alias: i18next.t("xFont"),
                        type: "font",
                        default: {
                          family: "sans-serif",
                          color: "#666",
                          size: 12,
                          bold: false,
                          italic: false,
                          underline: false,
                          deleteline: false,
                        },
                        disabled: (widget: Axis) => {
                          return !widget.getOption("x-label");
                        },
                      },
                      {
                        name: "x-font-overflow",
                        alias: i18next.t("xFontOverflow"),
                        type: "boolean",
                        default: false
                      },
                      {
                        name: "x-font-max-width",
                        alias: i18next.t("xFontMaxWidth"),
                        type: "number(unit=px)",
                        default: 100,
                        visible: (Widget: Axis) => {
                          return Widget.getOption("x-font-overflow")
                        }
                      },
                      {
                        name: "x-display-shadow-color",
                        alias: i18next.t("xDisplayShadowColor"),
                        type: "color",
                        default: "#ffffff",
                        disabled: (widget: Axis) => {
                          return !widget.getOption("x-label");
                        },
                      },
                      {
                        name: "x-display-shadow-blur",
                        alias: i18next.t("xDisplayShadowBlur"),
                        type: "number(unit=px)",
                        default: 0,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("x-label");
                        },
                      },
                      {
                        name: "x-display-shadow-offset-x",
                        alias: i18next.t("xDisplayShadowOffsetX"),
                        type: "number(unit=px)",
                        default: 0,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("x-label");
                        },
                      },
                      {
                        name: "x-display-shadow-offset-y",
                        alias: i18next.t("xDisplayShadowOffsetY"),
                        type: "number(unit=px)",
                        default: 0,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("x-label");
                        },
                      },
                      {
                        name: "x-rotate",
                        alias: i18next.t("xRotate"),
                        type: "select",
                        default: "0",
                        disabled: (widget: Axis) => {
                          return !widget.getOption("x-label");
                        },
                        selectChoices: [
                          {
                            value: "0",
                            label: i18next.t("noRotate"),
                          },
                          {
                            value: "-90",
                            label: "90°",
                          },
                          {
                            value: "-45",
                            label: "45°",
                          },
                          {
                            value: "45",
                            label: "-45°",
                          },
                          {
                            value: "90",
                            label: "-90°",
                          },
                        ],
                      },
                    ],
                  },
                  {
                    name: "x-unit-cluster",
                    alias: i18next.t("xUnitText"),
                    children: [
                      {
                        name: "x-unit",
                        alias: i18next.t("xUnit"),
                        type: "boolean",
                        default: false,
                      },
                      {
                        name: "x-unit-text",
                        alias: i18next.t("xUnitText"),
                        type: "string",
                        disabled: (widget: Axis) => {
                          return !widget.getOption("x-unit");
                        },
                      },
                      {
                        name: "x-unit-font",
                        alias: i18next.t("xUnitFont"),
                        type: "font",
                        default: {
                          family: "sans-serif",
                          size: 12,
                          bold: false,
                          italic: false,
                          underline: false,
                          deleteline: false,
                        },
                        disabled: (widget: Axis) => {
                          return !widget.getOption("x-unit");
                        },
                      },
                      {
                        name: "x-nameGap",
                        alias: i18next.t("xNameGap"),
                        type: "number(unit=px)",
                        default: 0,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("x-unit");
                        },
                      },
                    ],
                  },
                  {
                    name: "x-grid-cluster",
                    alias: i18next.t("grid"),
                    children: [
                      {
                        name: "grid-x-display",
                        alias: i18next.t("gridXdisplay"),
                        type: "boolean",
                        default: false,
                      },
                      {
                        name: "grid-x-line-type",
                        alias: i18next.t("gridXlineType"),
                        default: "dotted",
                        type: "select(radioGroup)",
                        selectChoices: [
                          {
                            value: "line",
                            label: i18next.t("line"),
                          },
                          {
                            value: "dotted",
                            label: i18next.t("dotted"),
                          },
                        ],
                        disabled: (widget: Axis) => {
                          return !widget.getOption("grid-x-display");
                        },
                      },
                      {
                        name: "grid-x-line-dotted-width",
                        alias: i18next.t("gridXlineDottedWidth"),
                        default: 4,
                        type: "number(unit=px)",
                        disabled: (widget: Axis) => {
                          return !widget.getOption("grid-x-display");
                        },
                        visible: (widget: Axis) => {
                          return (
                            widget.getOption("grid-x-line-type") == "dotted"
                          );
                        },
                      },
                      {
                        name: "grid-x-line-color",
                        alias: i18next.t("gridXlineColor"),
                        default: "#ffffff",
                        type: "color",
                        disabled: (widget: Axis) => {
                          return !widget.getOption("grid-x-display");
                        },
                      },
                      {
                        name: "grid-x-line-width",
                        alias: i18next.t("gridXlineWidth"),
                        default: 1,
                        type: "number(unit=px)",
                        disabled: (widget: Axis) => {
                          return !widget.getOption("grid-x-display");
                        },
                      },
                    ],
                  },
                ],
              },
              {
                name: "y-display-cluster",
                alias: i18next.t("yAxis"),
                show: "tab",
                children: [
                  {
                    name: "y-display",
                    alias: i18next.t("yAxisEnable"),
                    type: "boolean",
                    default: true,
                  },
                  {
                    name: "y-data-type",
                    alias: i18next.t("yDataType"),
                    type: "select(radioGroup)",
                    default: "value",
                    selectChoices: [
                      {
                        value: "category",
                        label: i18next.t("category"),
                      },
                      {
                        value: "value",
                        label: i18next.t("value"),
                      },
                      // {
                      //   value: "time",
                      //   label: i18next.t("time"),
                      // },
                      {
                        value: "log",
                        label: i18next.t("log"),
                      },
                    ],
                  },
                  {
                    name: "y-logBase",
                    alias: i18next.t("xLogBase"),
                    type: "number",
                    default: 10,
                    visible: (widget: Axis) => {
                      return widget.getOption("y-data-type") == "log";
                    },
                  },
                  {
                    name: "y-line-cluster",
                    alias: i18next.t("yLine"),
                    children: [
                      {
                        name: "y-line",
                        alias: i18next.t("yLine"),
                        type: "boolean",
                        default: true,
                      },
                      {
                        name: "y-line-type",
                        alias: i18next.t("yLineType"),
                        type: "select(radioGroup)",
                        default: "solid",
                        selectChoices: [
                          {
                            value: "dashed",
                            label: i18next.t("dashed"),
                          },
                          {
                            value: "solid",
                            label: i18next.t("solid"),
                          },
                          {
                            value: "dottedLine",
                            label: i18next.t("dottedLine"),
                          }
                        ],
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-line");
                        },
                      },
                      {
                        name: "y-dotted-line-width",
                        alias: i18next.t("xDottedLineWidth"),
                        type: "vector<W1, W2>",
                        default: [2, 5],
                        visible: (widget: Axis) => {
                          return widget.getOption("y-line-type") === "dottedLine";
                        },
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-line");
                        },
                      },
                      {
                        name: "y-line-color",
                        alias: i18next.t("yLineColor"),
                        type: "color",
                        default: "#CCCCCC",
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-line");
                        },
                      },
                      {
                        name: "y-line-width",
                        alias: i18next.t("yLineWidth"),
                        type: "number(unit=px)",
                        default: 1,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-line");
                        },
                      },
                    ],
                  },
                  {
                    name: "y-tickline-cluster",
                    alias: i18next.t("xTicklineCluster"),
                    children: [
                      {
                        name: "y-tickline",
                        alias: i18next.t("yTickline"),
                        type: "boolean",
                        default: true,
                      },
                      {
                        name: "y-tickline-color",
                        alias: i18next.t("yTicklineColor"),
                        type: "color",
                        default: "#CCCCCC",
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-tickline");
                        },
                      },
                      {
                        name: "y-tickline-width",
                        alias: i18next.t("yTicklineWidth"),
                        type: "number(unit=px)",
                        default: 2,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-tickline");
                        },
                      },
                      {
                        name: "y-tickline-length",
                        alias: i18next.t("yTicklineLength"),
                        type: "number(unit=px)",
                        default: 5,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-tickline");
                        },
                      },
                    ],
                  },
                  {
                    name: "y-label-cluster",
                    alias: i18next.t("xLabelCluster"),
                    children: [
                      {
                        name: "y-label",
                        alias: i18next.t("yLabel"),
                        type: "boolean",
                        default: true,
                      },
                      {
                        name: "y-label-position",
                        alias: i18next.t("yLabelPosition"),
                        type: "select(radioGroup)",
                        default: "outside",
                        selectChoices: [
                          {
                            value: "outside",
                            label: i18next.t("lineOutside"),
                          },
                          {
                            value: "above",
                            label: i18next.t("above"),
                          },
                        ],
                        visible: (widget: Axis) => {
                          return widget.transposed;
                        },
                      },
                      {
                        name: "y-text-type",
                        alias: i18next.t("yTextType"),
                        default: "normal", //FIXME this.getYFormatter() ? "percent" : "normal",
                        type: "select(radioGroup)",
                        selectChoices: [
                          {
                            label: i18next.t("value"),
                            value: "normal",
                          },
                          {
                            label: i18next.t("percent"),
                            value: "percent",
                          },
                        ],
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-label");
                        },
                        visible: (widget: Axis) => {
                          return widget.getOption("y-data-type") == "value";
                        },
                      },
                      {
                        name: "y-value-abbreviation",
                        alias: i18next.t("yValueAbbreviation"),
                        type: "select",
                        default: "0",
                        selectChoices: [
                          {
                            label: i18next.t("noSet"),
                            value: "0",
                          },
                          {
                            label: "K",
                            value: "3",
                          },
                          {
                            label: "万",
                            value: "4",
                          },
                          {
                            label: "十万",
                            value: "5",
                          },
                          {
                            label: "百万",
                            value: "6",
                          },
                          {
                            label: "千万",
                            value: "7",
                          },
                          {
                            label: "亿",
                            value: "8",
                          },
                        ],
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-label");
                        },
                        visible: (widget: Axis) => {
                          return (
                            widget.getOption("y-text-type") === "normal" &&
                            widget.getOption("y-data-type") == "value"
                          );
                        },
                      },
                      {
                        name: "y-decimal-places",
                        alias: i18next.t("yDecimalPlaces"),
                        type: "number(unit=" + UNIT_WEI + ")",
                        default: 0,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-label");
                        },
                        visible: (widget: Axis) => {
                          return  widget.getOption("y-data-type") == "value";
                        },
                      },
                      {
                        name: "y-complete-zero",
                        alias: i18next.t("yCompleteZero"),
                        type: "boolean",
                        default: false,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-label");
                        },
                        visible: (widget: Axis) => {
                          return  widget.getOption("y-data-type") == "value";
                        },
                      },
                      {
                        name: "y-label-offset",
                        alias: i18next.t("yLabelOffset"),
                        type: "number(unit=px)",
                        default: 10,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-label");
                        },
                      },
                      {
                        name: "y-scale-range",
                        alias: i18next.t("yScaleRange"),
                        type: "select(radioGroup)",
                        default: "adaptive",
                        selectChoices: [
                          {
                            value: "adaptive",
                            label: i18next.t("adaptive"),
                          },
                          {
                            value: "custom",
                            label: i18next.t("custom"),
                          },
                        ],
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-label");
                        },
                        visible: (widget: Axis) => {
                          return widget.getOption("y-data-type") === "value";
                        },
                      },
                      {
                        name: "y-scope-optimization",
                        alias: i18next.t("yPolylineScopeOptimization"),
                        type: "boolean",
                        default: false,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-label");
                        },
                        visible: false,
                      },
                      {
                        name: "y-scale-min",
                        alias: i18next.t("yScaleMin"),
                        type: "number<float>",
                        default: 0,
                        visible: (widget: Axis) => {
                          return widget.getOption("y-scale-range") == "custom";
                        },
                      },
                      {
                        name: "y-scale-max",
                        alias: i18next.t("yScaleMax"),
                        type: "number<float>",
                        default: 100,
                        visible: (widget: Axis) => {
                          return widget.getOption("y-scale-range") == "custom";
                        },
                      },
                      {
                        name:"y-scale-interval-way",
                        alias: i18next.t("scaleIntervalWay"),
                        default: "value",
                        type: "select(radioGroup)",
                        tip: i18next.t("scaleIntervalWayTips"),
                        selectChoices: [
                          {
                            label: i18next.t("value"),
                            value: "value",
                          },
                          {
                            label: i18next.t("number"),
                            value: "number",
                          },
                        ],
                        visible: (widget: Axis) => {
                          return widget.getOption("y-scale-range") == "custom";
                        },
                      },
                      {
                        name: "y-scale-interval",
                        alias: i18next.t("yScaleInterval"),
                        type: "number<float>",
                        default: 50,
                        visible: (widget: Axis) => {
                          return widget.getOption("y-scale-range") == "custom";
                        },
                      },
                      {
                        name: "y-font",
                        alias: i18next.t("yFont"),
                        type: "font",
                        default: {
                          family: "sans-serif",
                          color: "#666",
                          size: 12,
                          bold: false,
                          italic: false,
                          underline: false,
                          deleteline: false,
                        },
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-label");
                        },
                      },
                      {
                        name: "y-font-overflow",
                        alias: i18next.t("yFontOverflow"),
                        type: "boolean",
                        default: false
                      },
                      {
                        name: "y-font-max-width",
                        alias: i18next.t("yFontMaxWidth"),
                        type: "number(unit=px)",
                        default: 100,
                        visible: (Widget: Axis) => {
                          return Widget.getOption("y-font-overflow")
                        }
                      },
                      {
                        name: "y-display-shadow-color",
                        alias: i18next.t("yDisplayShadowColor"),
                        type: "color",
                        default: "#ffffff",
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-label");
                        },
                      },
                      {
                        name: "y-display-shadow-blur",
                        alias: i18next.t("yDisplayShadowBlur"),
                        type: "number(unit=px)",
                        default: 0,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-label");
                        },
                      },
                      {
                        name: "y-display-shadow-offset-x",
                        alias: i18next.t("yDisplayShadowOffsetX"),
                        type: "number(unit=px)",
                        default: 0,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-label");
                        },
                      },
                      {
                        name: "y-display-shadow-offset-y",
                        alias: i18next.t("yDisplayShadowOffsetY"),
                        type: "number(unit=px)",
                        default: 0,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-label");
                        },
                      },
                      {
                        name: "y-rotate",
                        alias: i18next.t("yRotate"),
                        type: "select",
                        default: "0",
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-label");
                        },
                        selectChoices: [
                          {
                            value: "0",
                            label: i18next.t("noRotate"),
                          },
                          {
                            value: "-90",
                            label: "90°",
                          },
                          {
                            value: "-45",
                            label: "45°",
                          },
                          {
                            value: "45",
                            label: "-45°",
                          },
                          {
                            value: "90",
                            label: "-90°",
                          }
                        ],
                      },
                    ],
                  },
                  {
                    name: "y-unit-cluster",
                    alias: i18next.t("xUnitText"),
                    children: [
                      {
                        name: "y-unit",
                        alias: i18next.t("yUnit"),
                        type: "boolean",
                        default: false,
                      },
                      {
                        name: "y-unit-text",
                        alias: i18next.t("yUnitText"),
                        type: "string",
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-unit");
                        },
                      },
                      {
                        name: "y-unit-font",
                        alias: i18next.t("yUnitFont"),
                        type: "font",
                        default: {
                          family: "sans-serif",
                          size: 12,
                          bold: false,
                          italic: false,
                          underline: false,
                          deleteline: false,
                        },
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-unit");
                        },
                      },
                      {
                        name: "y-nameGap",
                        alias: i18next.t("yNameGap"),
                        type: "number(unit=px)",
                        default: 15,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-unit");
                        },
                      },
                      {
                        name: "y-padding",
                        alias: i18next.t("yPadding"),
                        type: "number(unit=px)",
                        default: 0,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-unit");
                        },
                      },
                    ],
                  },
                  {
                    name: "y-grid-cluster",
                    alias: i18next.t("grid"),
                    children: [
                      {
                        name: "grid-y-display",
                        alias: i18next.t("gridYdisplay"),
                        type: "boolean",
                        default: false,
                      },
                      {
                        name: "grid-y-line-shape-type",
                        alias: i18next.t("gridYlineShapeType"),
                        default: "line",
                        type: "select(radioGroup)",
                        selectChoices: [
                          {
                            value: "line",
                            label: i18next.t("polygon"),
                          },
                          {
                            value: "circle",
                            label: i18next.t("circle"),
                          },
                        ],
                        visible: false,
                      },
                      {
                        name: "grid-y-line-type",
                        alias:  i18next.t("gridXlineType"),
                        default: "dotted",
                        type: "select(radioGroup)",
                        selectChoices: [
                          {
                            value: "line",
                            label: i18next.t("line"),
                          },
                          {
                            value: "dotted",
                            label: i18next.t("dotted"),
                          },
                        ],
                        disabled: (widget: Axis) => {
                          return !widget.getOption("grid-y-display");
                        },
                      },
                      {
                        name: "grid-y-line-dotted-width",
                        alias: i18next.t("gridXlineDottedWidth"),
                        default: 4,
                        type: "number(unit=px)",
                        disabled: (widget: Axis) => {
                          return !widget.getOption("grid-y-display");
                        },
                        visible: (widget: Axis) => {
                          return (
                            widget.getOption("grid-y-line-type") == "dotted"
                          );
                        },
                      },
                      {
                        name: "grid-y-line-color",
                        alias: i18next.t("gridXlineColor"),
                        default: "#ffffff",
                        type: "color",
                        disabled: (widget: Axis) => {
                          return !widget.getOption("grid-y-display");
                        },
                      },
                      {
                        name: "grid-y-line-width",
                        alias: i18next.t("gridXlineWidth"),
                        default: 1,
                        type: "number(unit=px)",
                        disabled: (widget: Axis) => {
                          return !widget.getOption("grid-y-display");
                        },
                      },
                    ],
                  },
                ],
              },
              {
                name: "y-polyline-display-cluster",
                alias: i18next.t("yPolylineDisplay"),
                show: "tab",
                visible: false,
                children: [
                  {
                    name: "y-polyline-display",
                    alias: i18next.t("yPolylineDisplay"),
                    type: "boolean",
                    default: false,
                  },
                  {
                    name: "y-polyline-inverse",
                    alias: i18next.t("yPolylineInverse"),
                    type: "boolean",
                    default: false,
                    visible: (widget: Axis) => {
                      return widget.getOption("y-polyline-display");
                    },
                  },
                  {
                    name: "y-polyline-data-type",
                    alias: i18next.t("yPolylineDataType"),
                    type: "select(radioGroup)",
                    default: "value",
                    selectChoices: [
                      {
                        value: "value",
                        label:  i18next.t("value"),
                      },
                      {
                        value: "log",
                        label:  i18next.t("log"),
                      },
                    ],
                  },
                  {
                    name: "y-polyline-logBase",
                    alias:  i18next.t("yPolylineLogBase"),
                    type: "number",
                    default: 10,
                    visible: (widget: Axis) => {
                      return widget.getOption("y-polyline-data-type") == "log";
                    },
                  },
                  {
                    name: "y-polyline-line-cluster",
                    alias: i18next.t("yPolylineLine"),
                    children: [
                      {
                        name: "y-polyline-line",
                        alias: i18next.t("yPolylineLine"),
                        type: "boolean",
                        default: true,
                      },
                      {
                        name: "y-polyline-line-type",
                        alias: i18next.t("yPolylineLineType"),
                        type: "select(radioGroup)",
                        default: "solid",
                        selectChoices: [
                          {
                            value: "dashed",
                            label: i18next.t("dashed"),
                          },
                          {
                            value: "solid",
                            label: i18next.t("solid"),
                          },
                        ],
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-polyline-line");
                        },
                      },
                      {
                        name: "y-polyline-line-color",
                        alias: i18next.t("yPolylineLineColor"),
                        type: "color",
                        default: "#CCCCCC",
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-polyline-line");
                        },
                      },
                      {
                        name: "y-polyline-line-width",
                        alias: i18next.t("yPolylineLineWidth"),
                        type: "number(unit=px, min=0)",
                        default: 1,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-polyline-line");
                        },
                      },
                    ],
                  },
                  {
                    name: "y-polyline-tickline-cluster",
                    alias: i18next.t("yPolylineTickline"),
                    children: [
                      {
                        name: "y-polyline-tickline",
                        alias: i18next.t("yTickline"),
                        type: "boolean",
                        default: true,
                      },
                      {
                        name: "y-polyline-tickline-color",
                        alias: i18next.t("yPolylineTicklineColor"),
                        type: "color",
                        default: "#CCCCCC",
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-polyline-tickline");
                        },
                      },
                      {
                        name: "y-polyline-tickline-width",
                        alias: i18next.t("yPolylineTicklineWidth"),
                        type: "number(unit=px, min=0)",
                        default: 2,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-polyline-tickline");
                        },
                      },
                      {
                        name: "y-polyline-tickline-length",
                        alias: i18next.t("yPolylineTicklineLength"),
                        type: "number(unit=px, min=0)",
                        default: 5,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-polyline-tickline");
                        },
                      },
                    ],
                  },
                  {
                    name: "y-polyline-label-cluster",
                    alias: i18next.t("xLabelCluster"),
                    children: [
                      {
                        name: "y-polyline-label",
                        alias: i18next.t("xLabel"),
                        type: "boolean",
                        default: true,
                      },
                      {
                        name: "y-polyline-text-type",
                        alias: i18next.t("yPolylineTextType"),
                        default: "normal", //FIXME this.getYFormatter() ? "percent" : "normal",
                        type: "select(radioGroup)",
                        selectChoices: [
                          {
                            label: i18next.t("value"),
                            value: "normal",
                          },
                          {
                            label: i18next.t("percent"),
                            value: "percent",
                          },
                        ],
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-polyline-label");
                        },
                        visible: (widget: Axis) => {
                          return widget.getOption("y-polyline-data-type") == "value";
                        },
                      },
                      {
                        name: "y-polyline-value-abbreviation",
                        alias: i18next.t("yPolylineValueAbbreviation"),
                        type: "select",
                        default: "0",
                        selectChoices: [
                          {
                            label: i18next.t("noSet"),
                            value: "0",
                          },
                          {
                            label: "K",
                            value: "3",
                          },
                          {
                            label: "万",
                            value: "4",
                          },
                          {
                            label: "十万",
                            value: "5",
                          },
                          {
                            label: "百万",
                            value: "6",
                          },
                          {
                            label: "千万",
                            value: "7",
                          },
                          {
                            label: "亿",
                            value: "8",
                          },
                        ],
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-polyline-label");
                        },
                        visible: (widget: Axis) => {
                          return (
                            widget.getOption("y-polyline-text-type") === "normal" &&
                            widget.getOption("y-polyline-data-type") == "value"
                          );
                        },
                      },
                      {
                        name: "y-polyline-decimal-places",
                        alias: i18next.t("yPolylineDecimalPlaces"),
                        type: "number(unit=" + UNIT_WEI + ")",
                        default: 0,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-polyline-label");
                        },
                        visible: (widget: Axis) => {
                          return  widget.getOption("y-polyline-data-type") == "value";
                        },
                      },
                      {
                        name: "y-polyline-complete-zero",
                        alias: i18next.t("yPolylineCompleteZero"),
                        type: "boolean",
                        default: false,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-polyline-label");
                        },
                        visible: (widget: Axis) => {
                          return  widget.getOption("y-polyline-data-type") == "value";
                        },
                      },
                      {
                        name: "y-polyline-label-offset",
                        alias: i18next.t("yPolylineLabelOffset"),
                        type: "number(unit=px)",
                        default: 10,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-polyline-label");
                        },
                      },
                      {
                        name: "y-polyline-scale-range",
                        alias: i18next.t("yPolylineScaleRange"),
                        type: "select(radioGroup)",
                        default: "adaptive",
                        selectChoices: [
                          {
                            value: "adaptive",
                            label: i18next.t("adaptive"),
                          },
                          {
                            value: "custom",
                            label: i18next.t("custom"),
                          },
                        ],
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-polyline-label");
                        },
                        visible: (widget: Axis) => {
                          return widget.getOption("y-polyline-data-type") === "value";
                        },
                      },
                      {
                        name: "y-polyline-scope-optimization",
                        alias: i18next.t("yPolylineScopeOptimization"),
                        type: "boolean",
                        default: false,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-polyline-label");
                        },
                        visible: false,
                      },
                      {
                        name: "y-polyline-scale-min",
                        alias: i18next.t("yPolylineScaleMin"),
                        type: "number",
                        default: 0,
                        visible: (widget: Axis) => {
                          return widget.getOption("y-polyline-scale-range") == "custom";
                        },
                      },
                      {
                        name: "y-polyline-scale-max",
                        alias: i18next.t("yPolylineScaleMax"),
                        type: "number<float>",
                        default: 100,
                        visible: (widget: Axis) => {
                          return widget.getOption("y-polyline-scale-range") == "custom";
                        },
                      },
                      {
                        name: "y-polyline-scale-interval",
                        alias: i18next.t("xScaleInterval"),
                        type: "number<float>",
                        default: 50,
                        visible: (widget: Axis) => {
                          return widget.getOption("y-polyline-scale-range") == "custom";
                        },
                      },
                      {
                        name:"y-polyline-scale-interval-way",
                        alias: i18next.t("scaleIntervalWay"),
                        default: "value",
                        type: "select(radioGroup)",
                        tip: i18next.t("scaleIntervalWayTips"),
                        selectChoices: [
                          {
                            label: i18next.t("value"),
                            value: "value",
                          },
                          {
                            label: i18next.t("number"),
                            value: "number",
                          },
                        ],
                        visible: (widget: Axis) => {
                          return widget.getOption("y-polyline-scale-range") == "custom";
                        },
                      },
                      {
                        name: "y-polyline-font",
                        alias: i18next.t("yPolylineFont"),
                        type: "font",
                        default: {
                          family: "sans-serif",
                          size: 12,
                          bold: false,
                          italic: false,
                          underline: false,
                          deleteline: false,
                        },
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-polyline-label");
                        },
                      },
                      {
                        name: "y-polyline-font-overflow",
                        alias: i18next.t("yFontOverflow"),
                        type: "boolean",
                        default: false
                      },
                      {
                        name: "y-polyline-font-max-width",
                        alias: i18next.t("yFontMaxWidth"),
                        type: "number(unit=px)",
                        default: 100,
                        visible: (Widget: Axis) => {
                          return Widget.getOption("y-polyline-font-overflow")
                        }
                      },
                      {
                        name: "y-polyline-display-shadow-color",
                        alias: i18next.t("yPolylineDisplayShadowColor"),
                        type: "color",
                        default: "#ffffff",
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-polyline-label");
                        },
                      },
                      {
                        name: "y-polyline-display-shadow-blur",
                        alias: i18next.t("yPolylineDisplayShadowBlur"),
                        type: "number(unit=px)",
                        default: 0,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-polyline-label");
                        },
                      },
                      {
                        name: "y-polyline-display-shadow-offset-x",
                        alias: i18next.t("yPolylineDisplayShadowOffsetX"),
                        type: "number(unit=px)",
                        default: 0,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-polyline-label");
                        },
                      },
                      {
                        name: "y-polyline-display-shadow-offset-y",
                        alias: i18next.t("yPolylineDisplayShadowOffsetY"),
                        type: "number(unit=px)",
                        default: 0,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-polyline-label");
                        },
                      },
                      {
                        name: "y-polyline-rotate",
                        alias: i18next.t("yPolylineRotate"),
                        type: "select",
                        default: "0",
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-polyline-label");
                        },
                        selectChoices: [
                          {
                            value: "0",
                            label: i18next.t("noRotate"),
                          },
                          {
                            value: "90",
                            label: "90°",
                          },
                          {
                            value: "45",
                            label: "45°",
                          },
                          {
                            value: "-45",
                            label: "-45°",
                          },
                          {
                            value: "-90",
                            label: "-90°",
                          },
                        ],
                      },
                    ],
                  },
                  {
                    name: "y-polyline-unit-cluster",
                    alias: i18next.t("xUnitText"),
                    children: [
                      {
                        name: "y-polyline-unit",
                        alias: i18next.t("yPolylineUnit"),
                        type: "boolean",
                        default: false,
                      },
                      {
                        name: "y-polyline-unit-text",
                        alias: i18next.t("yPolylineUnitText"),
                        type: "string",
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-polyline-unit");
                        },
                      },
                      {
                        name: "y-polyline-unit-font",
                        alias: i18next.t("yPolylineUnitFont"),
                        type: "font",
                        default: {
                          family: "sans-serif",
                          size: 12,
                          bold: false,
                          italic: false,
                          underline: false,
                          deleteline: false,
                        },
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-polyline-unit");
                        },
                      },
                      {
                        name: "y-polyline-nameGap",
                        alias: i18next.t("yPolylineNameGap"),
                        type: "number(unit=px)",
                        default: 15,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-polyline-unit");
                        },
                      },
                      {
                        name: "y-polyline-padding",
                        alias: i18next.t("yPadding"),
                        type: "number(unit=px)",
                        default: 0,
                        disabled: (widget: Axis) => {
                          return !widget.getOption("y-polyline-unit");
                        },
                      },
                    ],
                  },
                ],
              }
            ]
          },
          "label-group": {
            alias: i18next.t("labelGroup"),
            children: [
              {
                name: "label-default-cluster",
                alias: i18next.t("labelDefaultCluster"),
                show: "tab",
                children: [
                  {
                    name: "label",
                    alias: i18next.t("label"),
                    type: "boolean",
                    default: false,
                  },
                  {
                    name: "label-type-cluster",
                    alias: i18next.t("labelTypeCluster"),
                    fold: "unfold",
                    children: [
                      {
                        name: "label-text-type",
                        alias: i18next.t("labelTextType"),
                        default: "normal",
                        type: "select(radioGroup)",
                        selectChoices: [
                          {
                            label: i18next.t("value"),
                            value: "normal",
                          },
                          {
                            label: i18next.t("percent"),
                            value: "percent",
                          },
                        ],
                      },
                      {
                        name: "label-decimal-places",
                        alias: i18next.t("labelDecimalPlaces"),
                        type: "number(unit=" + UNIT_WEI + ")",
                        default: 2,
                      },
                      {
                        name: "label-complete-zero",
                        alias: i18next.t("labelCompleteZero"),
                        type: "boolean",
                        default: false,
                      },
                    ],
                  },
                  {
                    name: "label-text-style-cluster",
                    alias: i18next.t("labelTextStyleCluster"),
                    fold: "unfold",
                    children: [
                      {
                        name: "label-position",
                        alias: i18next.t("labelPosition"),
                        default: "outside",
                        type: "select(radioGroup)",
                        selectChoices: [
                          {
                            label: i18next.t("inside"),
                            value: "inside",
                          },
                          {
                            label: i18next.t("outside"),
                            value: "outside",
                          },
                        ],
                      },
                      {
                        name: "label-font",
                        alias: i18next.t("labelFont"),
                        type: "font",
                        default: {
                          family: "sans-serif",
                          size: 12,
                          bold: false,
                          italic: false,
                          underline: false,
                          deleteline: false,
                        },
                      },
                      {
                        name: "label-color-type",
                        default: "normal",
                        alias: i18next.t("labelColorType"),
                        type: "select(radioGroup)",
                        visible: false,
                        selectChoices: [
                          {
                            value: "normal",
                            label: i18next.t("defualt"),
                          },
                          {
                            value: "follow",
                            label: i18next.t("follow"),
                          }
                        ]
                      },
                      {
                        name: "label-tilt",
                        alias: i18next.t("labelTilt"),
                        type: "number(min=0,unit=°)",
                        default: 0,
                      },
                      {
                        name: "label-unit-value",
                        alias: i18next.t("labelUnitValue"),
                        type: "string",
                        default: "",
                      },
                      {
                        name: "label-unit-font",
                        alias: i18next.t("labelUnitFont"),
                        type: "font",
                        default: {
                          family: "sans-serif",
                          size: 12,
                          bold: false,
                          italic: false,
                          underline: false,
                          deleteline: false,
                        },
                      },
                    ],
                  },
                ]
              },
              {
                name: "polyline-cluster",
                show: "tab",
                visible: false,
                children: []
              },
              {
                name: "ranking-cluster",
                alias: i18next.t("rankingText"),
                show: "tab",
                visible: false,
                children: [
                  {
                    name: "ranking-text",
                    alias: i18next.t("rankingText"),
                    type: "boolean",
                    default: false,
                  },
                  {
                    name: "ranking-text-font",
                    alias: i18next.t("rankingTextFont"),
                    type: "font",
                    default: {
                      family: "sans-serif",
                      size: 12,
                      color: "white",
                      bold: false,
                      italic: false,
                      underline: false,
                      deleteline: false,
                    }
                  },
                  {
                    name: "ranking-text-distance",
                    alias: i18next.t("rankingTextDistance"),
                    type: "number",
                    default: 0
                  },
                  {
                    name: "ranking-text-template",
                    alias: i18next.t("rankingTextTemplate"),
                    tip: i18next.t("rankingTextTemplateTip"),
                    type: "string",
                    default: "NO.{}"
                  },
                  {
                    name: "show-text-type",
                    alias: i18next.t("showTextType"),
                    type: "select",
                    default: "all",
                    selectChoices:
                      [
                        {
                          label: i18next.t("all"),
                          value: "all"
                        },
                        {
                          label: i18next.t("max"),
                          value: "max",
                        },
                        {
                          label: i18next.t("min"),
                          value: "min",
                        },
                        {
                          label: i18next.t("maxAndMin"),
                          value: "max-and-min",
                        },
                        {
                          label: i18next.t("custom"),
                          value: "custom",
                        }
                      ]
                  },
                  {
                    name: "ranking-text-show-number",
                    alias: i18next.t("rankingTextShowNumber"),
                    type: "number(min=0)",
                    default: 3,
                    visible: (widget)=>widget.getOption("show-text-type") == "custom"
                  },
                  {
                    name: "ranking-text-background",
                    alias: i18next.t("rankingTextBackground"),
                    type: "select(radioGroup)",
                    default: "shape",
                    selectChoices: [
                      {
                        value: "shape",
                        label: i18next.t("shape"),
                      },
                      {
                        value: "image",
                        label: i18next.t("image"),
                      },
                    ],
                  },
                  {
                    name: "ranking-text-background-shape-type",
                    alias: i18next.t("rankingTextBackgroundShapeType"),
                    type: "select(radioGroup)",
                    default: "rect",
                    selectChoices: [
                      {
                        value: "rect",
                        label: i18next.t("rect"),
                      },
                      {
                        value: "down-arrow-rect",
                        label: i18next.t("downArrowRect"),
                      },
                    ],
                    visible: (widget: Axis) => {
                      return widget.getOption("ranking-text-background") == "shape"
                    },
                  },
                  {
                    name: "ranking-text-background-image",
                    alias: i18next.t("rankingTextBackgroundImage"),
                    type: "file(format=image)",
                    default: "",
                    visible: (widget: Axis) => {
                      return widget.getOption("ranking-text-background") == "image"
                    },
                  },
                  {
                    name: "ranking-text-background-color",
                    alias: i18next.t("rankingTextBackgroundColor"),
                    type: "color(gradient)",
                    default: "#ffffff00",
                  },
                  {
                    name: "ranking-text-background-width",
                    alias: i18next.t("rankingTextBackgroundWidth"),
                    type: "number",
                    default: 50,
                  },
                  {
                    name: "ranking-text-background-height",
                    alias: i18next.t("rankingTextBackgroundHeight"),
                    type: "number",
                    default: 30,
                  },
                  {
                    name: "ranking-text-fommater-type",
                    alias: i18next.t("rankingTextFommaterType"),
                    type: "select",
                    default: "text-template",
                    selectChoices: [
                      {
                        value: "text-template",
                        label: i18next.t("textTemplate"),
                      },
                      {
                        value: "value-template",
                        label: i18next.t("valueTemplate"),
                      },
                    ],
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
                alias: i18next.t("seriesShapeDefault"),
                show: "tab",
                default: "all",
                children: [
                  {
                    name: "series-shape-number-type",
                    alias: i18next.t("seriesShapeStyle"),
                    type: "select(radioGroup)",
                    default: "all",
                    selectChoices: [
                      {
                        value: "adaptive",
                        label: i18next.t("adaptive"),
                      },
                      {
                        value: "all",
                        label: i18next.t("showAll"),
                      },
                      {
                        value: "custom",
                        label: i18next.t("custom"),
                      },
                    ],
                  },
                  {
                    name: "shape-column-number",
                    alias: i18next.t("shapeColumnNumber"),
                    type: "number(unit=" + UNIT_GE + ")",
                    default: 10,
                    visible: (widget: Axis) => {
                      return widget.getOption("series-shape-number-type") === "custom";
                    },
                  },
                  {
                    name: "shape-column-width-type",
                    alias: i18next.t("shapeColumnWidthType"),
                    type: "select(radioGroup)",
                    default: "adaptive",
                    selectChoices: [
                      {
                        value: "adaptive",
                        label: i18next.t("adaptive"),
                      },
                      {
                        value: "custom",
                        label: i18next.t("custom"),
                      },
                    ],
                    visible: false,
                  },
                  {
                    name: "shape-column-width",
                    alias: i18next.t("shapeColumnWidth"),
                    type: "number(unit=px)",
                    default: 10,
                    visible: false
                  },
                  {
                    name: "zero-removal",
                    alias: i18next.t("zeroRemoval"),
                    type: "boolean",
                    default: false,
                    visible: false
                  },
                ]
              }
            ],
          },
          "annotation-line": {
            alias: i18next.t("annotationLine"),
            type: "boolean",
            default: false,
            children: [
              {
                name: 'annotation-line-array-cluster',
                alias: i18next.t("annotationLine"),
                cluster: 'array',
                fold: "always-unfold",
                children: [
                  {
                    name: "annotation-line-value",
                    alias: i18next.t("annotationLineValue"),
                    default: 0,
                    type: "number<float>",
                  },
                  {
                    name: "annotation-line-type",
                    alias: i18next.t("annotationLineType"),
                    default: "dotted",
                    type: "select(radioGroup)",
                    selectChoices: [
                      {
                        value: "polyline",
                        label: i18next.t("line"),
                      },
                      {
                        value: "dotted",
                        label: i18next.t("dotted"),
                      },
                    ],
                  },
                  {
                    name: "annotation-line-dotted-width",
                    alias: i18next.t("annotationLineDottedWidth"),
                    default: 4,
                    type: "number(unit=px)",
                    visible: (widget: Axis) => {
                      return (
                        widget.getOption("annotation-line-type") == "dotted"
                      );
                    },
                  },
                  {
                    name: "annotation-line-color",
                    alias: i18next.t("annotationLineColor"),
                    default: "#ffffff",
                    type: "color",
                  },
                  {
                    name: "annotation-line-width",
                    alias: i18next.t("annotationLineWidth"),
                    default: 1,
                    type: "number(unit=px)",
                  },
                  {
                    name: "annotation-line-text",
                    alias: i18next.t("annotationLineText"),
                    default: "",
                    type: "string",
                  },
                  {
                    name: "annotation-line-text-color",
                    alias: i18next.t("annotationLineTextColor"),
                    default: "#ffffff",
                    type: "color",
                  },
                  {
                    name: "annotation-line-text-position",
                    alias: i18next.t("annotationLineTextPosition"),
                    type: "vector<X,Y>",
                    default: [0,0]
                  },
                ]
              },
            ],
          },
          tooltip: {
            children: [
              {
                name: "tooltip-style-group",
                children: [
                  {
                    name: "tooltip-position",
                    alias: i18next.t("tooltipPosition"),
                    type: "select(radioGroup)",
                    default: "auto",
                    selectChoices: [
                      {
                        value: "auto",
                        label: i18next.t("auto"),
                      },
                      {
                        value: "center",
                        label: i18next.t("center"),
                      }
                    ],
                  }
                ]
              },
              {
                name: "tooltip-format-cluster",
                children:[
                  {
                    name: "tooltip-right-axis-format-cluster",
                    alias: i18next.t("tooltipRightAxisFormatCluster"),
                    fold: "always-unfold",
                    visible: false,
                    children:[

                          {
                            name: "tooltip-right-text-type",
                            alias: i18next.t("tooltipRightTextType"),
                            default: "normal",
                            type: "select(radioGroup)",
                            selectChoices: [
                              {
                                label: i18next.t("value"),
                                value: "normal",
                              },
                              {
                                label: i18next.t("percent"),
                                value: "percent",
                              },
                            ],
                          },
                          {
                            name: "tooltip-right-decimal-places",
                            alias: i18next.t("tooltipRightDecimalPlaces"),
                            type: "number(unit=" + UNIT_WEI + ")",
                            default: 0,
                            visible: true,
                          },
                          {
                            name: "tooltip-right-complete-zero",
                            alias: i18next.t("tooltipRightCompleteZero"),
                            type: "boolean",
                            default: false,
                            visible: true,
                          },
                        ]
                      }
                ]
              },
              {
                name: "tooltip-unit-setName",
                alias: i18next.t("tooltipUnitSetName"),
                show: "tab",
                visible:true,
                children:[
                  {
                    name: "tooltip-unit-name",
                    alias: i18next.t("tooltipUnitName"),
                    type: "boolean",
                    default: false,
                  },
                  {
                    name: "tooltip-unit-y",
                    alias: i18next.t("tooltipUnitY"),
                    type: "string",
                    default:"%",
                    disabled:((widget: Axis)=>{
                      return !widget.getOption("tooltip-unit-name")
                    }),
                  },
                  {
                    name: "tooltip-unit-yRight",
                    alias: i18next.t("tooltipUnitYRight"),
                    type: "string",
                    default:"%",
                    disabled:((widget: Axis)=>{
                      return !widget.getOption("tooltip-unit-name")
                    }),
                  },
                  {
                    name: "tooltip-unit-color",
                    alias: i18next.t("tooltipUnitColor"),
                    type: "color",
                    default: "#ffffff",
                    disabled:((widget: Axis)=>{
                      return !widget.getOption("tooltip-unit-name")
                    }),
                  },
                  {
                    name: "tooltip-unit-size",
                    alias: i18next.t("tooltipUnitSize"),
                    type: "number(unit=px)",
                    default: 16,
                    disabled:((widget: Axis)=>{
                      return !widget.getOption("tooltip-unit-name")
                    }),
                  }
                ]
              },
            ]
          },
          "slider-display": {
            alias: i18next.t("sliderDisplay"),
            type: "boolean",
            default: false,
            children: [
              {
                name: "slider-basic",
                alias: i18next.t("sliderBasic"),
                show: "tab",
                children: [
                  {
                    name: "slider-height",
                    alias: i18next.t("sliderHeight"),
                    type: "number(unit=px)",
                    default: 16,
                  },
                  {
                    name: "slider-bottom",
                    alias: i18next.t("sliderBottom"),
                    type: "number(unit=px)",
                    default: 10,
                  },
                  {
                    name: "slider-foreground-color",
                    alias: i18next.t("sliderForegroundColor"),
                    type: "color",
                    default: "#5B8FF926",
                  },
                  {
                    name: "slider-background-color",
                    alias: i18next.t("sliderBackgroundColor"),
                    type: "color",
                    default: "#4161800D",
                  },
                  {
                    name: "slider-border-color",
                    alias: i18next.t("sliderBorderColor"),
                    type: "color",
                    default: "#ccc"
                  },
                  {
                    name: "slider-move-handle-size",
                    alias: i18next.t("sliderMoveHandleSize"),
                    type: "number(unit=px)",
                    default: 5,
                  },
                  {
                    name: "slider-move-handle-color",
                    alias: i18next.t("sliderMoveHandleColor"),
                    type: "color",
                    default: "#5B8FF926",
                  },
                  {
                    name: "slider-handler-size",
                    alias: i18next.t("sliderHandlerSize"),
                    type: "number(unit=px, min=0)",
                    default: 28,
                  },
                  {
                    name: "slider-handler-color",
                    alias: i18next.t("sliderHandlerColor"),
                    type: "color",
                    default: "#F7F7F7",
                  },
                ]
              },
              {
                name: "slider-data-style",
                alias: i18next.t("sliderDataStyle"),
                show: "tab",
                children: [
                  {
                    name: "slider-text-style",
                    alias: i18next.t("sliderTextStyle"),
                    type: "font",
                    default: {
                      color: "#fff",
                      size: 12,
                    }
                  },
                  {
                    name: "slider-data-line-width",
                    alias: i18next.t("sliderDataLineWidth"),
                    type: "number(unit=px)",
                    default: 1
                  },
                  {
                    name: "slider-data-line-color",
                    alias: i18next.t("sliderDataLineColor"),
                    type: "color",
                    default: "#1890ff"
                  },
                  {
                    name: "slider-data-area-color",
                    alias: i18next.t("sliderDataAreaColor"),
                    type: "color",
                    default: "#1890ff55"
                  },
                  {
                    name: "slider-selected-data-line-color",
                    alias: i18next.t("sliderSelectedDataLineColor"),
                    type: "color",
                    default: "#1c6cb8"
                  },
                  {
                    name: "slider-selected-data-area-color",
                    alias: i18next.t("sliderSelectedDataAreaColor"),
                    type: "color",
                    default: "#1c6cb855"
                  }
                ]
              },
            ],
          },
          "animation-display": {
            visible: false,
          }
        },
      },
      ...super.defineOptions(),
    ];
  }

  get axisX() {
    return this.getOption<OptionFieldValue[]>("axis-x") || [];
  }
  get axisY() {
    return this.getOption<OptionFieldValue[]>("axis-y") || [];
  }
  get axisLine() {
    return this.getOption<OptionFieldValue[]>("axis-line") || [];
  }
  get axisSize() {
    return this.getOption<OptionFieldValue[]>("axis-size") || [];
  }
  get axisFields() {
    return this.getOption<OptionFieldValue[]>("axis-fields") || [];
  }
  get axisGroup() {
    return this.getOption<OptionFieldValue[]>("axis-group") || [];
  }


  override getMetaData() {
    return merge(super.getMetaData(), {
      axisValue: [
        ...this.axisX,
        ...this.axisY,
      ]
    } as WidgetMetaData);
  }

  getSortObjects() {
    let xDimensions = this.axisX;
    let yDimensions = this.axisY;
    let lineDimensions = this.axisLine;
    let sizeDimensions = this.axisSize;
    let selectChoices = [];
    for(let dimension of xDimensions.concat(yDimensions).concat(lineDimensions).concat(sizeDimensions)){
      selectChoices.push({
        value: dimension.uid[2],
        label: this.getFieldAlias(dimension.uid)
      })
    }
    if(selectChoices.length){
      selectChoices.push({
        value: "sumVal",
        label: "数值总和",
      });
    }else{
      selectChoices = [
        { value: "name", label: "名称(示例数据)" },
        { value: "value", label: "数值(示例数据)" }
      ];
    }
    return selectChoices;
  }

  resetChartOption(loaded?:boolean){
    this.selectedIndex.value = -1;
    this.selectedData.value = null;
    super.resetChartOption(loaded);
  }

  get transposed() {
    return false;
  }

  get stack(){
    return false
  }

  get percent() {
    return false;
  }

  get echartsOptionFunc(): {[key: string]: Function} {
    return {
      grid: ()=>this.echartsGridOption,
      xAxis: ()=>this.echartsXAxisOption,
      yAxis: ()=>this.echartsYAxisOption,
      tooltip: ()=>this.echartsTooltipOption,
      legend: ()=>this.echartsLegendOption,
      series: ()=>this.echartsSeriesOption,
      dataZoom: ()=>this.echartsDataZoomOption,
      dataset: ()=>this.echartsDatasetOption(),
      color: ()=>this.getSerieEchartsColors()
    };
  }

  get xGridLineOption(): XAXisComponentOption["splitLine"] {
    let dashWidth = this.getOption<number>("grid-x-line-dotted-width") || 2;
    return {
      show: this.getOption("grid-x-display"),
      lineStyle: {
        color: this.toEchartsColor(this.getOption("grid-x-line-color")),
        width: this.getOption("grid-x-line-width"),
        type: this.getOption("grid-x-line-type") === "line" ? "solid" : dashWidth,
      }
    }
  }

  get yGridLineOption(): YAXisComponentOption["splitLine"] {
    let dashWidth = this.getOption<number>("grid-y-line-dotted-width") || 2;
    return {
      show: this.getOption("grid-y-display"),
      lineStyle: {
        color: this.toEchartsColor(this.getOption("grid-y-line-color")),
        width: this.getOption("grid-y-line-width"),
        type: this.getOption("grid-y-line-type") === "line" ? "solid" : dashWidth,
      }
    }
  }

  get axisAnimation() {
    return false;
  }

  get animationDurationUpdate() {
    return 0;
  }

  get echartsXAxisOption(): XAXisComponentOption | XAXisComponentOption[] {
    let axisLabelFont = this.getOption<OptionFontValue>("x-font");
    let xIsPercent = this.getOption("x-text-type") === "percent";
    let xDecimalPlaces = Math.max(this.getOption("x-decimal-places"), 0);
    let xCompleteZero = this.getOption<boolean>("x-complete-zero");
    let valueAbb = this.getOption<string>("x-value-abbreviation");
    let xUnitFont = this.getOption<OptionFontValue>("x-unit-font");
    let xLineType = this.getOption("x-line-type");
    if(xLineType === "dottedLine") {
      let [w1, w2] = this.getOption<number[]>("x-dotted-line-width");
      xLineType = [w1, w1, w2, w1];
    }
    let xFontOverflow = this.getOption("x-font-overflow") ? "truncate" : "none";
    let xFontMaxWidth
    if(xFontOverflow === "truncate"){
      xFontMaxWidth = this.getOption("x-font-max-width")
    }
    let axisOpt: any = {
      show: this.getOption<boolean>("x-display"),
      type: this.getOption<"category" | "value" | "time" | "log">("x-data-type"),
      logBase: this.getOption<number>("x-logBase"),
      boundaryGap: this.boundaryGap,
      name: this.getOption<boolean>("x-unit") ? this.getOption<string>("x-unit-text") : "",
      nameGap: this.getOption<number>("x-nameGap"),
      nameTextStyle: {
        color: this.toEchartsColor(xUnitFont.color as Color),
        fontStyle: xUnitFont.italic ? "italic" : "normal",
        fontWeight: xUnitFont.bold ? "bold" : "normal",
        fontFamily: xUnitFont.family,
        fontSize: xUnitFont.size,
      },
      axisLine: { //轴线
        show: this.getOption<boolean>("x-line"),
        animation: false,
        animationDuration: 0,
        lineStyle: {
          color: this.toEchartsColor(this.getOption<Color>("x-line-color")),
          width: Math.max(this.getOption<number>("x-line-width"), 0),
          type: xLineType,
          join: "miter"
        },
      },
      axisTick: {
        alignWithLabel: true,
        show: this.getOption<boolean>("x-tickline"),
        length: this.getOption<number>("x-tickline-length"),
        animation: false,
        animationDuration: 0,
        lineStyle: {
          width: this.getOption<number>("x-tickline-width"),
          color: this.toEchartsColor(this.getOption<Color>("x-tickline-color")),
        }
      },
      axisLabel: {
        show: this.getOption<boolean>("x-label"),
        animation: this.axisAnimation,
        animationDurationUpdate: this.animationDurationUpdate,
        margin: Number(this.getOption<number>("x-label-offset")),
        fontStyle: axisLabelFont.italic ? "italic" : "normal",
        fontWeight: axisLabelFont.bold ? "bold" : "normal",
        fontSize: axisLabelFont.size,
        fontFamily: axisLabelFont.family,
        color: this.toEchartsColor(axisLabelFont.color as Color),
        textShadowColor: this.toEchartsColor(this.getOption<Color>("x-display-shadow-color")),
        textShadowBlur: this.getOption<number>("x-display-shadow-blur"),
        textShadowOffsetX: this.getOption<number>("x-display-shadow-offset-x"),
        textShadowOffsetY: this.getOption<number>("x-display-shadow-offset-y"),
        rotate: Number(this.getOption<string>("x-rotate")),
        interval: this.getOption("x-show-all-label") ? 0 : "auto",
        formatter: (value, index) => {
          if(this.getOption<"category" | "value" | "time" | "log">("x-data-type") == "value"){
            let num = value;
            if (!isNaN(num)) {
              if (xIsPercent) {
                if(this.percent){
                  value = formatFloat(num, xDecimalPlaces, xCompleteZero) + "%";
                }else{
                  value = formatFloat(num * 100, xDecimalPlaces, xCompleteZero) + "%";
                }
              } else {
                let abb = Number(valueAbb);
                let unit = this.axisUnitMap[abb] || "";
                value = formatFloat(num / Math.pow(10, abb), xDecimalPlaces, xCompleteZero) + unit;
              }
            }
          }else{
            value = value?.split?.("$")?.[0] ? value.split("$")[0] : value
          }
          return value;
        },
        overflow: xFontOverflow,
        width: xFontMaxWidth
      },
      splitLine: this.xGridLineOption
    }
    if (this.getOption<"category" | "value" | "time" | "log">("x-data-type") == "time") {
      axisOpt.axisLabel.formatter = {
        month: '{MM}',
      }
    }
    if (this.getOption("x-scale-range") === "custom") {
      axisOpt.min = this.getOption<number>("x-scale-min");
      axisOpt.max = this.getOption<number>("x-scale-max");
      axisOpt.interval = this.getOption("x-scale-interval");
    } else if(this.getOption<OptionFieldValue[]>("axis-group")?.length > 0 && this.stack) {
      if(this.transposed) {
        let max = 0;
        this.datasetSource().forEach(data => {
          max = Math.max(max, data.sumVal);
        })
        axisOpt.max = max;
      }
    }

    if(!this.getOption<boolean>("x-display")){
      axisOpt.show = true
      axisOpt.axisLabel.show = false
      axisOpt.axisTick.show = false
      axisOpt.axisLine.show = false
    }

    return axisOpt
  }

  get boundaryGap() { // 两侧留白 会影响网格线对齐
    return true;
  }

  get usePrivateData(){
    if(this.getOption<OptionFieldValue[]>("axis-x")?.length && this.getOption<OptionFieldValue[]>("axis-y")?.length){
      return false;
    }
    return true
  }

  get markLineOption():any {
    if (this.getOption("annotation-line")) {
      let indexes = this.getArrayClusterIndexes(["annotation-line-array-cluster"]);
      let markLineData = [];

      indexes.forEach((index)=>{
        let dashSize = this.getOption(["annotation-line-array-cluster", String(index), "annotation-line-dotted-width"]);

        let lineStyle = {
          type: this.getOption(["annotation-line-array-cluster", String(index), "annotation-line-type"]) === "polyline" ? "solid" : dashSize,
          color: this.toEchartsColor(this.getOption(["annotation-line-array-cluster", String(index), "annotation-line-color"])),
          width: this.getOption(["annotation-line-array-cluster", String(index), "annotation-line-width"]),
        }

        let lineLabel = {
          formatter: this.getOption(["annotation-line-array-cluster", String(index), "annotation-line-text"]),
          color: this.toEchartsColor(this.getOption(["annotation-line-array-cluster", String(index), "annotation-line-text-color"])),
          distance: this.getOption(["annotation-line-array-cluster", String(index), "annotation-line-text-position"]),
          align:  this.transposed ? "center" : "left",
          verticalAlign: "middle",
          rotate: 0
        }
        if(this.transposed){
          markLineData.push({
            xAxis: this.getOption(["annotation-line-array-cluster", String(index), "annotation-line-value"]),
            lineStyle: lineStyle,
            label:lineLabel
          });
        }else{
          markLineData.push({
            yAxis: this.getOption(["annotation-line-array-cluster", String(index), "annotation-line-value"]),
            lineStyle: lineStyle,
            label:lineLabel
          });
        }
      });
      return {
        data: markLineData,
        silent: true,
        animation: false,
        symbolSize: 0,
        label: {
          show: true,
          position:"insideEndTop"
        },
      }
    } else {
      return {
        show: false
      }
    }
  }

  getSingleYAxisOption(axisType = "y") {
    let axisLabelFont = this.getOption<OptionFontValue>(`${axisType}-font`);
    let yIsPercent = this.getOption(`${axisType}-text-type`) === "percent";
    let yDecimalPlaces = Math.max(this.getOption(`${axisType}-decimal-places`), 0);
    let yCompleteZero = this.getOption<boolean>(`${axisType}-complete-zero`);
    let valueAbb = this.getOption<string>(`${axisType}-value-abbreviation`);
    let yUnitFont = this.getOption<OptionFontValue>(`${axisType}-unit-font`);
    let labelAbove = this.getOption("y-label-position") === "above"?true:false;
    let yLineType = this.getOption(axisType + "-line-type");
    let yPadding = this.getOption(`${axisType}-padding`);
    if(yLineType === "dottedLine") {
      let [w1, w2] = this.getOption<number[]>(axisType + "-dotted-line-width");
      yLineType = [w1, w1, w2, w1];
    }
    let yFontOverflow = this.getOption(`${axisType}-font-overflow`) ? "truncate" : "none";
    let yFontMaxWidth
    if(yFontOverflow === "truncate"){
      yFontMaxWidth = this.getOption(`${axisType}-font-max-width`);
    }
    let axisOpt: any = {
      id: axisType,
      show: this.getOption<boolean>(`${axisType}-display`),
      type: this.getOption<"category" | "value" | "time" | "log">(`${axisType}-data-type`),
      logBase: this.getOption<number>(`${axisType}-logBase`),
      boundaryGap: this.boundaryGap,
      name: this.getOption<boolean>(`${axisType}-unit`) ? this.getOption<string>(`${axisType}-unit-text`) : "",
      nameGap: this.getOption<number>(`${axisType}-nameGap`),
      nameTextStyle: {
        color: this.toEchartsColor(yUnitFont.color as Color),
        fontStyle: yUnitFont.italic ? "italic" : "normal",
        fontWeight: yUnitFont.bold ? "bold" : "normal",
        fontFamily: yUnitFont.family,
        fontSize: yUnitFont.size,
        padding:[0,0,0,yPadding]
      },
      axisLine: { //轴线
        show: this.getOption<boolean>(`${axisType}-line`),
        animation: false,
        animationDuration: 0,
        lineStyle: {
          color: this.toEchartsColor(this.getOption<Color>(`${axisType}-line-color`)),
          width: Math.max(this.getOption<number>(`${axisType}-line-width`), 0),
          type: yLineType,
          join: "miter"
        },
      },
      axisTick: {
        show: this.getOption<boolean>(`${axisType}-tickline`),
        animation: false,
        animationDuration: 0,
        alignWithLabel: true,
        length: this.getOption<number>(`${axisType}-tickline-length`),
        lineStyle: {
          width: this.getOption<number>(`${axisType}-tickline-width`),
          color: this.toEchartsColor(this.getOption<Color>(`${axisType}-tickline-color`)),
        }
      },
      axisLabel: {
        show: this.getOption<boolean>(`${axisType}-label`) && !labelAbove && !this.getOption("label-y"),
        animation: this.axisAnimation,
        animationDurationUpdate: this.animationDurationUpdate,
        margin: this.getOption<number>(`${axisType}-label-offset`),
        fontStyle: axisLabelFont.italic ? "italic" : "normal",
        fontWeight: axisLabelFont.bold ? "bold" : "normal",
        fontSize: axisLabelFont.size,
        fontFamily: axisLabelFont.family,
        color: this.toEchartsColor(axisLabelFont.color as Color),
        textShadowColor: this.toEchartsColor(this.getOption<Color>(`${axisType}-display-shadow-color`)),
        textShadowBlur: this.getOption<number>(`${axisType}-display-shadow-blur`),
        textShadowOffsetX: this.getOption<number>(`${axisType}-display-shadow-offset-x`),
        textShadowOffsetY: this.getOption<number>(`${axisType}-display-shadow-offset-y`),
        rotate: Number(this.getOption<string>(`${axisType}-rotate`)),
        formatter: (value, index) => {
          if(this.getOption<"category" | "value" | "time" | "log">(`${axisType}-data-type`) == "value"){
            let num = value;
            if (!isNaN(num)) {
              if (yIsPercent) {
                if(this.percent){
                  value = formatFloat(num, yDecimalPlaces, yCompleteZero) + "%";
                }else{
                  value = formatFloat(num * 100, yDecimalPlaces, yCompleteZero) + "%";
                }


              } else {
                let abb = Number(valueAbb);
                let unit = this.axisUnitMap[abb] || "";
                value = formatFloat(num / Math.pow(10, abb), yDecimalPlaces, yCompleteZero) + unit;
              }
            }
          }else{
            value = value?.split?.("$")?.[0] ? value.split("$")[0] : value
          }
          return value;
        },
        overflow: yFontOverflow,
        width: yFontMaxWidth
      },
      splitLine: this.yGridLineOption,
      inverse: this.useInverse(axisType)
    };
    if (this.getOption(`${axisType}-scale-range`) === "custom") {
      let yDims = this.getOption<OptionFieldValue[]>("axis-y") || [];
      let polylineDims = this.getOption<OptionFieldValue[]>("axis-line") || [];
      let max = this.getOption<number>(`${axisType}-scale-max`);
      let min = this.getOption<number>(`${axisType}-scale-min`);
      let yValArr = [];
      if (this.stack) {
        // 堆叠
        this.datasetSource().forEach(data => {
          if (axisType == "y-polyline") {
            if (polylineDims?.length) {
              polylineDims.forEach(dim => {
                yValArr.push(data[dim.uid[2]]);
              })
            }
          } else {
            yValArr.push(data.sumVal);
          }
        })
      } else {
        // 分组
        this.datasetSource().forEach(data => {
          if (axisType == "y-polyline") {
            if (polylineDims?.length) {
              polylineDims.forEach(dim => {
                yValArr.push(data[dim.uid[2]]);
              })
            }
          } else {
            if (yDims?.length) {
              yDims.forEach(dim => {
                yValArr.push(data[dim.uid[2]]);
              });
            }
          }
        });
      }

      if(!this.percent){
        let rangeArr = Array.from(yValArr);
        if(this.getOption("zero-removal")) {
          rangeArr = rangeArr.filter(val => val !== "-");
        } else {
          rangeArr = rangeArr.map(val => val === "-" ? 0 : val);
        }
        let yMax = Math.max(...rangeArr);
        let yMin = Math.min(...rangeArr)
        max = max < yMax ? yMax : max;
        min = min > yMin ? yMin : min;
      }
      axisOpt.min = min;
      axisOpt.max = max;
      axisOpt.interval = this.getOption(`${axisType}-scale-interval`);
      if(this.getOption(`${axisType}-scale-interval-way`) == "number"){
         let interval = this.getOption<number>(`${axisType}-scale-interval`)
         let numberInterval = (max - min)/(interval-1);
         axisOpt.interval = numberInterval;
      }
    } else {
      if (this.getOption<OptionFieldValue[]>("axis-group")?.length > 0 && this.stack) {
        if (!this.transposed && axisType === "y") {
          let max = 0;
          let min = 0;
          this.datasetSource().forEach(data => {
            max = Math.max(max, data.pSumVal);
            min = Math.min(min, data.nSumVal);
          })
          axisOpt.max = max;
          axisOpt.min = min;
        }
      }
      const adaptiveEnabled =
        axisType === "y"
          ? this.getOption<boolean>("y-scope-optimization")
          : this.getOption<boolean>("y-polyline-scope-optimization");

      if (this.getOption(`${axisType}-scale-range`) === "adaptive" && adaptiveEnabled) {
        const yDims = this.getOption<OptionFieldValue[]>("axis-y") || [];
        const polylineDims = this.getOption<OptionFieldValue[]>("axis-line") || [];
        const rows = this.datasetSource();

        let minVal = Number.POSITIVE_INFINITY;
        let maxVal = Number.NEGATIVE_INFINITY;

        // 封装取值与更新最值
        const getCell = (row: any, dim: OptionFieldValue) => Number(row?.[dim?.uid?.[2]]);
        const updateMinMax = (val: number) => {
          if (!Number.isFinite(val)) return;
          if (val < minVal) minVal = val;
          if (val > maxVal) maxVal = val;
        };
        const scanCumulative = (row: any, dims: OptionFieldValue[]) => {
          if (!dims?.length) return 0;
          let running = 0;
          for (let i = 0; i < dims.length; i += 1) {
            const v = getCell(row, dims[i]);
            running += Number.isFinite(v) ? v : 0;
            updateMinMax(running);
          }
          return running;
        };

        if (rows?.length) {
          if (this.stack) {
            // 堆叠
            rows.forEach(row => {
              if (axisType === "y-polyline") {
                let running = 0;
                running += scanCumulative(row, yDims);
                running += scanCumulative(row, polylineDims);
              } else {
                scanCumulative(row, yDims);
              }
            });
          } else {
            // 分组
            rows.forEach(row => {
              const dims = axisType === "y-polyline" ? polylineDims : yDims;
              if (!dims?.length) return;
              for (let i = 0; i < dims.length; i += 1) {
                updateMinMax(getCell(row, dims[i]));
              }
            });
          }
        }

        if (Number.isFinite(minVal) && Number.isFinite(maxVal)) {
          const { min, max, interval } = this.calcAxisRange(minVal, maxVal);
          axisOpt.min = min;
          axisOpt.max = max;
          axisOpt.interval = interval;
        }
      }
    }
    if(axisType == "y" && !this.getOption<boolean>("y-display") && this.getOption<boolean>("grid-y-display")){
      axisOpt.show = true
      axisOpt.axisLabel.show = false
      axisOpt.axisTick.show = false
      axisOpt.axisLine.show = false
    }
    if(!this.getOption<OptionFieldValue[]>("axis-line")?.length && axisType== "y-polyline"){
      axisOpt.show = false;
    }
    return axisOpt;
  }

  calcAxisRange(minVal: number, maxVal: number): { min: number, max: number, interval: number } {
    const isDecimalPlaces: boolean = this.getOption<number>("y-decimal-places") > 0;

    if (!Number.isFinite(minVal) || !Number.isFinite(maxVal)) {
      return { min: 0, max: 10, interval: 2 };
    }

    if (minVal > maxVal) {
      const t = minVal; minVal = maxVal; maxVal = t;
    }

    const span: number = maxVal - minVal;
    const hasNegative: boolean = minVal < 0;

    if (!isDecimalPlaces && span < 5) {
      const step: number = 1;
      let min: number = Math.floor(minVal / step) * step;
      let max: number = Math.ceil(maxVal / step) * step;

      if (max - min < 4 * step) {
        const center: number = Math.round((minVal + maxVal) / 2 / step) * step;
        min = center - 2 * step;
        max = center + 2 * step;
        if (!hasNegative) min = Math.max(min, 0);
      }
      return { min, max, interval: step };
    }

    if (span === 0) {
      const step = Math.max(1, Math.abs(maxVal) || 1);
      const min = hasNegative ? maxVal - 2 * step : Math.max(0, maxVal - 2 * step);
      const max = maxVal + 2 * step;
      return { min, max, interval: step };
    }

    const decade: number = 10 ** Math.floor(Math.log10(span));
    const raw: readonly number[] = isDecimalPlaces ? [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10] : [1, 2, 5, 10];

    const steps: number[] = [];
    raw.forEach((r: number) => {
      steps.push(
        (r * decade) / 1000,
        (r * decade) / 100,
        (r * decade) / 10,
        r * decade,
        r * decade * 10
      );
    });

    const niceSteps: readonly number[] = Object.freeze(
      [...new Set(steps.filter((s: number) => s > 0))].sort((a, b) => a - b)
    );

    const findStep = (
      min: number,
      max: number,
      idx: number = Math.floor(niceSteps.length / 2)
    ): { step: number; floor: number; ceil: number } => {
      if (idx < 0 || idx >= niceSteps.length) {
        const step: number = niceSteps[niceSteps.length - 1] || 1;
        const floor: number = Math.floor(min / step);
        const ceil: number = Math.ceil(max / step);
        return { step, floor, ceil };
      }
      const step: number = niceSteps[idx];
      const floor: number = Math.floor(min / step);
      const ceil: number = Math.ceil(max / step);
      const ticks: number = ceil - floor;

      if (ticks >= 4 && ticks <= 8) return { step, floor, ceil };
      if (ticks > 8) return findStep(min, max, idx + 1);
      return findStep(min, max, idx - 1);
    };

    let low: number = minVal;
    let high: number = maxVal;
    if (!hasNegative) low = Math.max(low, 0);

    const { step, floor, ceil } = findStep(low, high);

    return {
      min: floor * step,
      max: ceil * step,
      interval: step,
    };
  }

  get echartsYAxisOption():  YAXisComponentOption[] {
    const yAxis1 = this.getSingleYAxisOption("y");
    const yAxis2 = this.getSingleYAxisOption("y-polyline");

    if (yAxis1.inverse) {
      return [yAxis2, yAxis1];
    } else {
      return [yAxis1, yAxis2];
    }
  }

  get padding(): any {
    if(!this.getOption("slider-display") || this.getOption<string>("padding-bottom") !== "auto") return super.padding;
    return {
      ...super.padding,
      bottom: 10 + Number(this.getOption("slider-move-handle-size")) + Number(this.getOption("slider-height")) + Number(this.getOption("slider-bottom")),
    }
  }

  getSliderOptions(): DataZoomComponentOption {
    let fontStyle = this.getOption<OptionFontValue>("slider-text-style");
    return {
      show: this.getOption("slider-display"),
      bottom: this.getOption("slider-bottom"),
      height: this.getOption("slider-height"),
      orient: this.transposed ? "vertical" : "horizontal",
      handleSize: this.getOption("slider-handler-size"),
      backgroundColor: this.toEchartsColor(this.getOption<Color>("slider-background-color")),
      fillerColor: this.toEchartsColor(this.getOption<Color>("slider-foreground-color")),
      handleStyle: {
        color: this.toEchartsColor(this.getOption<Color>("slider-handler-color")),
        borderWidth: 0,
      },
      dataBackground:{
        lineStyle:{
          color: this.toEchartsColor(this.getOption<Color>("slider-data-line-color")),
          width: this.getOption("slider-data-line-width"),
        },
        areaStyle: {
          color: this.toEchartsColor(this.getOption<Color>("slider-data-area-color")),
        }
      },
      selectedDataBackground: {
         lineStyle:{
          color: this.toEchartsColor(this.getOption<Color>("slider-selected-data-line-color")),
          width: this.getOption("slider-data-line-width"),
        },
        areaStyle: {
          color: this.toEchartsColor(this.getOption<Color>("slider-selected-data-area-color")),
        }
      },
      borderColor: this.toEchartsColor(this.getOption<Color>("slider-border-color")),
      borderRadius: 5,
      moveHandleSize: this.getOption("slider-move-handle-size"),
      moveHandleStyle:{
        color:this.toEchartsColor(this.getOption<Color>("slider-move-handle-color")),
      },
      textStyle:{
        color: this.toEchartsColor(fontStyle.color as Color),
        fontStyle: fontStyle.italic ? "italic" : "normal",
        fontWeight: fontStyle.bold ? "bolder" : "normal",
        fontFamily: fontStyle.family || "sans-serif",
        fontSize: fontStyle.size
      },
    }
  }

  get echartsDataZoomOption(): DataZoomComponentOption | DataZoomComponentOption[] {
    let type = this.getOption("series-shape-number-type");
    let orient:any = this.transposed ? "vertical" : "horizontal";
    let columnNumber = this.getOption<number>("shape-column-number");
    let dataType = this.getOption<"category" | "value" | "time" | "log">("x-data-type");
    let xAxisValues = this.xAxisValues();
    let endValue = dataType === 'category' ?  columnNumber - 1 :  xAxisValues[columnNumber-1];
    if (type === "all") {
      return [
        {
          type: "inside",
          zoomLock: true,
          show: false,
          start: 0,
          end: 100,
          orient,
          preventDefaultMouseMove: false
        },
        this.getSliderOptions()
      ];
    } else {
      return [
        {
          type: "inside",
          zoomLock: true,
          startValue: 0,
          endValue,
          orient,
          preventDefaultMouseMove: false
        },
        this.getSliderOptions()
      ]

    }
  }

  aggregateYData(data = [], xuids = [], yUids = []){
    let temp = {};
    data.forEach(row=>{
      let xVals = []
      for(let xuid of xuids){
        xVals.push(row[xuid]);
      }
      let xKey = xVals.join("$") + "$";
      if(!temp[xKey]){
        temp[xKey] = row;
      }else{
        let newRow = {};
        for(let key in temp[xKey]){
          if(yUids.includes(key)){
            newRow[key] = row[key] + temp[xKey][key];
          }else{
            newRow[key] = temp[xKey][key];
          }
        }
        temp[xKey] = newRow;
      }
    })
    return Object.values(temp);
  }


  dealDataBySameDimensions(sourceData, categoryUids, valueDims){
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

  private shouldShowMissingTime(xDim?: OptionFieldValue | null) {
    return Boolean((xDim as OptionFieldValue & { showMissingTime?: boolean })?.showMissingTime)
      && isTimeCategorySummary(String(xDim?.summary || ""));
  }

  private getCategoryTimeStartedAt(row: any, xUid: string) {
    const startedAt = Number(row?._categoryTimeMeta?.[xUid]?.startedAt);
    return Number.isFinite(startedAt) ? startedAt : null;
  }

  private createMissingTimeMetrics(valueDims: OptionFieldValue[]) {
    return (valueDims || []).reduce<Record<string, Record<string, null>>>((result, dim) => {
      const uid = dim?.uid?.[2];
      if (!uid) return result;
      result[uid] = {
        ...(result[uid] || {}),
        [dim.summary || "none"]: null,
      };
      return result;
    }, {});
  }

  private sortTimeBucketRows(sourceData: any[], xUid: string, groupUid?: string) {
    const groupOrder = new Map<string, number>();
    if (groupUid) {
      sourceData.forEach(row => {
        const key = String(row?.[groupUid]);
        if (!groupOrder.has(key)) {
          groupOrder.set(key, groupOrder.size);
        }
      });
    }

    return [...sourceData].sort((left, right) => {
      const leftStartedAt = this.getCategoryTimeStartedAt(left, xUid);
      const rightStartedAt = this.getCategoryTimeStartedAt(right, xUid);
      if (leftStartedAt !== null && rightStartedAt !== null && leftStartedAt !== rightStartedAt) {
        return leftStartedAt - rightStartedAt;
      }
      if (leftStartedAt !== null && rightStartedAt === null) return -1;
      if (leftStartedAt === null && rightStartedAt !== null) return 1;
      if (groupUid) {
        return (groupOrder.get(String(left?.[groupUid])) ?? Number.MAX_SAFE_INTEGER)
          - (groupOrder.get(String(right?.[groupUid])) ?? Number.MAX_SAFE_INTEGER);
      }
      return 0;
    });
  }

  private fillMissingTimeBuckets(
    sourceData: any[],
    xDim?: OptionFieldValue | null,
    groupDim?: OptionFieldValue | null,
    valueDims: OptionFieldValue[] = [],
  ) {
    const xUid = xDim?.uid?.[2];
    if (!xUid || !this.shouldShowMissingTime(xDim) || !Array.isArray(sourceData) || !sourceData.length) {
      return sourceData;
    }

    const startedAtList = sourceData
      .map(row => this.getCategoryTimeStartedAt(row, xUid))
      .filter((value): value is number => value !== null);

    if (!startedAtList.length) {
      return sourceData;
    }

    const minStartedAt = Math.min(...startedAtList);
    const maxStartedAt = Math.max(...startedAtList);
    const groupUid = groupDim?.uid?.[2];
    const groupValues = groupUid
      ? Array.from(new Set(
        sourceData
          .map(row => row?.[groupUid])
          .filter(value => value !== undefined && value !== null && value !== ""),
      ))
      : [undefined];
    const existingKeys = new Set(
      sourceData.map(row => `${this.getCategoryTimeStartedAt(row, xUid)}__${groupUid ? String(row?.[groupUid]) : ""}`),
    );
    const filledSource = [...sourceData];
    const metricState = this.createMissingTimeMetrics(valueDims);

    let cursor = minStartedAt;
    while (cursor <= maxStartedAt) {
      const nextCursor = getNextTimeCategoryStartedAt(cursor, xDim.summary as any);
      const xLabel = formatTimeCategoryLabelByStartedAt(cursor, xDim);

      groupValues.forEach(groupValue => {
        const bucketKey = `${cursor}__${groupUid ? String(groupValue) : ""}`;
        if (existingKeys.has(bucketKey)) {
          return;
        }
        filledSource.push({
          [xUid]: xLabel,
          ...(groupUid ? { [groupUid]: groupValue } : {}),
          _metrics: {
            ...metricState,
          },
          _categoryTimeMeta: {
            [xUid]: {
              startedAt: cursor,
              label: xLabel,
            },
          },
        });
        existingKeys.add(bucketKey);
      });

      if (nextCursor <= cursor) {
        break;
      }
      cursor = nextCursor;
    }

    return this.sortTimeBucketRows(filledSource, xUid, groupUid);
  }

  private isValidSeriesValue(value: any) {
    if (value === null || value === undefined || value === "-") {
      return false;
    }
    return Number.isFinite(Number(value));
  }


  _datasetSource() {
    let dataSource = [];
    let yDims = this.getOption<OptionFieldValue[]>("axis-y");
    let xDims = this.getOption<OptionFieldValue[]>("axis-x");
    let groupDims = this.getOption<OptionFieldValue[]>("axis-group");
    let lineDims = this.getOption<OptionFieldValue[]>("axis-line");
    let types = [];
    if (xDims?.length && (yDims?.length || lineDims?.length)) {
      let source = this.createView(["axis-x", "axis-y", "axis-line"]);
      if(groupDims?.length > 0){
        source = this.createView(["axis-x", "axis-y", "axis-group", "axis-line"]);
        let groupUid = groupDims[0].uid[2];
        let valueDims = [];
        if(yDims?.length){
          valueDims = valueDims.concat(yDims);
        }
        if(lineDims?.length){
          valueDims = valueDims.concat(lineDims);
        }

        let valueUids
        source = this.dealDataByAggregate(source,  [xDims[0], groupDims[0]], valueDims);
        source = this.fillMissingTimeBuckets(source, xDims[0], groupDims[0], valueDims);
        valueUids = valueDims.map(dim => dim.uid[2]);

        // 分类字段在dealDataByAggregate中汇总完成（日期字段汇总为指定时间格式）后再获取types
        // 当分类字段和值字段相同时，值字段的聚合数据在row._metric中，row中原字段数据依旧为汇总后的数据
        source.forEach(row => {
          // const uids = groupUid.split('.');
          // if (uids.length > 1) {
          //   types.push(...row[uids[0]].map(r => r[uids[1]]));
          // } else {
            types.push(row[groupUid]);
          // }
        });
        types = Array.from(new Set(types));

        let xSumMap = {};
        let pSumMap = {};
        let nSumMap = {};
        let xUid = xDims[0].uid[2];
        dataSource = source.map(row => {
          let group = row[groupUid];
          let valueUid = yDims?.[0]?.uid?.[2];
          if(xSumMap[row[xUid]] === undefined) {
            xSumMap[row[xUid]] = 0;
            pSumMap[row[xUid]] = 0;
            nSumMap[row[xUid]] = 0;
          }
          const sumUid = valueDims[0].uid[2] === xDims[0].uid[2] ? `${valueUid}_count` : valueUid;
          const metricVal = this.getMetric(row, valueDims[0]);
          if (!isNaN(metricVal)) {
            const val = Number(metricVal);
            xSumMap[row[xUid]] += val;
            (val >= 0 ? pSumMap : nSumMap)[row[xUid]] += val;
          }
          for(let type of types){
            if(type == group){
              if(valueUid) {
                if(valueDims[0].uid[2] === xDims[0].uid[2]){
                  row[`${valueUid}_${type}_count`] = this.getMetric(row, valueDims[0]);
                  row[`${valueUid}_count`] = this.getMetric(row, valueDims[0]);
                } else {
                  row[`${valueUid}_${type}`] = this.getMetric(row, valueDims[0]);
                  row[valueUid] = this.getMetric(row, valueDims[0]);
                }
              }

              lineDims?.forEach(dim => {
                const uid = dim.uid[2];
                if (uid) {
                  if(xDims.some(xDim => xDim.uid[2] === uid)){
                    row[`${uid}_${type}_count`] = this.getMetric(row, dim);
                    row[`${uid}_count`] = this.getMetric(row, dim);
                  }else{
                    row[`${uid}_${type}`] = this.getMetric(row, dim);
                    row[uid] = this.getMetric(row, dim);
                  }
                }
              })
            }else{
              valueUids.forEach(yUid => {
                if (yUid) {
                  if (xDims.some(xDim => xDim.uid[2] === yUid)) {
                    row[`${yUid}_${type}_count`] = "-";
                  } else {
                    row[`${yUid}_${type}`] = "-";
                  }
                }
              })

              lineDims?.map(dim => dim.uid[2])?.forEach(uid => {
                if (uid) {
                  if(xDims.some(xDim => xDim.uid[2] === uid)){
                    row[`${uid}_${type}_count`] = "-";
                  }else{
                    row[`${uid}_${type}`] = "-";
                  }
                }
              })
            }
          }
          return row;
        });
        dataSource = source.map(row => {
          row["sumVal"] = xSumMap[row[xUid]];
          row["pSumVal"] = pSumMap[row[xUid]];
          row["nSumVal"] = nSumMap[row[xUid]];
          return row;
        })
      }else{
        let valueDims = [];
        if(yDims?.length){
          valueDims = valueDims.concat(yDims);
        }
        if (lineDims?.length){
          valueDims = valueDims.concat(lineDims);
        }

        source = this.dealDataByAggregate(source, [xDims[0]], valueDims);
        source = this.fillMissingTimeBuckets(source, xDims[0], null, valueDims);

        dataSource = source.map(row => {
          let sumVal = 0;
          valueDims.forEach(dim => {
            const uid = dim.uid[2];
            if (xDims.some(xDim => xDim.uid[2] === uid)) {
              row[`${uid}_count`] = this.getMetric(row, dim);
            } else {
              row[`${uid}`] = this.getMetric(row, dim);
            }
            sumVal += this.getMetric(row, dim);
          })
          row["sumVal"] = sumVal;
          return row;
        });

      }
    } else {
      let data = this.getPrivateData();
      let fields = data.fields;
      let rows = data.rows;
      let nameFields = fields.filter(item=>{
        return item.type === "string"
      });
      let valueFields = fields.filter(item=>{
        return item.type === "number"
      });
     if (nameFields.length && valueFields.length) {
        rows.forEach(item => {
          let tempData = {};
          nameFields.forEach((field, index) => {
            if (index < 2) {
              tempData[field.uid] = item[field.uid];
            }
          })
          valueFields.forEach((field, index) => {
            tempData[field.uid] = item[field.uid];
          })
          dataSource.push(tempData);
        });
      } else {
        dataSource = [];
      }

    }
    this.xTypes = types;
    dataSource = this.getDataAfterSort(dataSource);

    let zeroRemoval = this.getOption("zero-removal");
    if(zeroRemoval){
      dataSource.map((item)=>{
        for(let key in item){
          if (
            key !== "_metrics" &&
            !isNaN(item[key]) &&
            item[key] == 0
          ) {
            item[key] = "-";
          }
        }
      });
    }
    return dataSource;
  }

  _getSeries() {
    let xDimensions = this.getOption<OptionFieldValue[]>("axis-x") || [];
    let groupDimensions = this.getOption<OptionFieldValue[]>("axis-group") || [];
    let yDimensions = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let lineDimensions = this.getOption<OptionFieldValue[]>("axis-line") || [];
    let series = [];
    if ((xDimensions.length > 0 && groupDimensions.length > 0) && (yDimensions.length > 0 || lineDimensions.length > 0)) {
      let dataSource = this.datasetSource();
      // TODO 多x轴处理
      let typeUid = groupDimensions[0].uid[2];
      let types = [];
      dataSource.forEach(item => {
        types.push(item[typeUid]);
      })
      types = Array.from(new Set(types));

      if(yDimensions.length){
        types.forEach(item=>{series.push({ name: typeUid, alias: `${item}_${this.getFieldAlias(yDimensions[0]?.uid)}` })})
      }
      if(lineDimensions.length){
        types.forEach(item=>{series.push({ name: typeUid, alias: `${item}_${this.getFieldAlias(lineDimensions[0]?.uid)}` })})
      }
    } else {
      for (let i = 0; i < yDimensions.length; i++) {
        series.push({
          name: yDimensions[i].uid[2],
          alias: this.getFieldAlias(yDimensions[i].uid),
        });
      }
      for (let i = 0; i < lineDimensions.length; i++) {
        series.push({
          name: lineDimensions[i].uid[2],
          alias: this.getFieldAlias(lineDimensions[i].uid),
        });
      }
    }
    return series;
  }

  getSeriesColors() {
    let strColors = [];
    let series = this.getSeries();
    const indexes = this.getArrayClusterIndexes(["series-color-cluster"]);
    for (let i = 0; i < series.length; i++) {
      let color = this.getOption<Color>(["series-color-cluster", indexes[i], "series-color"]);
      strColors.push(this.toEchartsColor(color as Color));
    }
    if (strColors.length == 0) {
      strColors = this.defaultColors10;
    }
    return [].concat(strColors);
  }

  getSeriesCssColors(option="series-color") {
    let strColors = [];
    let series = this.getSeries();
    const indexes = this.getArrayClusterIndexes(["series-color-cluster"]);
    for (let i = 0; i < series.length; i++) {
      let color = this.getOption<Color | Color[]>(["series-color-cluster", indexes[i], option]);
      if(Array.isArray(color)){
        strColors.push(Array.from(color).map((item) => { return new Color(item).toCssString() }));
      }else{
        strColors.push([new Color(color).toCssString()]);
      }
    }
    if (strColors.length == 0) {
      strColors = this.defaultColors10;
    }
    return [].concat(strColors);
  }

  handleImageSrc(relativePath) {
    const projectId = this.getBoard().projectId;
    return relativePath ? `${projectId}/${relativePath}` : "";
  }

  get rankingBackgroundImageSrc() {
    const imageOptions = this.getOption<OptionFileValue>('ranking-text-background-image');
    if (typeof imageOptions === "string") {
      return imageOptions;
    } else {
      return imageOptions.url || this.handleImageSrc(imageOptions.relativePath);
    }
  }

  get echartsTooltipOption(): TooltipComponentOption | TooltipComponentOption[] {
    let backgroundColor = new Color(this.getOption<Color>("tooltip-background-color")).toCssString();
    let backgroundImage = this.getOption<OptionFileValue>("tooltip-background-image");
    let backgroundBlur = this.getOption<OptionFileValue>("tooltip-background-blur");
    let paddingWidth = this.getOption<number>("tooltip-padding-width");
    let paddingHeight = this.getOption<number>("tooltip-padding-height");
    let radius = this.getOption<number>("tooltip-radius");
    let showIcon = this.getOption<boolean>("tooltip-icon");

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
    let commaDisplay = this.getOption<boolean>("tooltip-comma-display")
    let lineDimensions = this.getOption<OptionFieldValue[]>("axis-line") || [];
    let valueDims = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let tooltipRightStyle = this.getOption("tooltip-right-text-type");
    let tooltipRightDecimalPlaces = this.getOption<number>("tooltip-right-decimal-places");
    let tooltipRightCompleteZero = this.getOption<boolean>("tooltip-right-complete-zero");
    let tooltipShowUnit = this.getOption<boolean>("tooltip-unit-name")
    let tooltipShowUnitColor = new Color(this.getOption<Color>("tooltip-unit-color")).hexa()
    let tooltipShowUnitSize = this.getOption("tooltip-unit-size")
    let tooltipUnitY = this.getOption("tooltip-unit-y")
    let tooltipUnitYRight = this.getOption("tooltip-unit-yRight")
    let lineUids:any = lineDimensions?.map((item)=>item.uid[2]);
    let yUids = valueDims?.map(item=>item.uid[2]) || []

    if(lineUids?.length){
      yUids = [...yUids,...lineUids]
    }
    lineUids.push("line_data");

    return {
      trigger: this.tooltipTrigger,
      axisPointer: this.tooltipAxisPointer,
      confine: true,
      show: showTooltip,
      borderWidth: 0,
      padding: [0],// [paddingHeight, paddingWidth, paddingHeight, paddingWidth],
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
        let seriesNameSet = new Set();
        if (this.stack) {
          params.reverse()
        }
        for (let param of params || []) {
          if(seriesNameSet.has(param.seriesName)) continue;
          // 根据seriesName中的'__$'筛选要显示在提示框上的信息
          if(param.seriesName.includes("__$") || param.seriesName.includes("-bg") || param.seriesName.includes("topShape")) continue;
          let colorIndex = this.xTypes.length ? this.xTypes.indexOf(param.seriesName) : yUids.indexOf(param.seriesId.split('-')[0]);
          let iconColor = seriesCssColors[colorIndex];
          if(Array.isArray(iconColor)){
            iconColor = iconColor[0];
          }
          let iconHtml = showIcon ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${iconColor};"></span>` : "";

          let valueUid = param.dimensionNames[param.encode.y[0]];
          if(this.transposed){
            valueUid = param.dimensionNames[param.encode.x[0]];
          }
          let val = param.value[valueUid];
          if(isNaN(val)) continue;
          if(lineUids.includes(valueUid)){
            if (tooltipRightStyle === "normal") {
              val = formatFloat(val, tooltipRightDecimalPlaces, tooltipRightCompleteZero);
            } else if (tooltipRightStyle === "percent") {
              val = formatFloat(val * 100, tooltipRightDecimalPlaces, tooltipRightCompleteZero) + "%";
            }
          }else{
            if (tooltipStyle === "normal") {
              val = formatFloat(val, tooltipDecimalPlaces, tooltipCompleteZero);
            } else if (tooltipStyle === "percent") {
              val = formatFloat(val * 100, tooltipDecimalPlaces, tooltipCompleteZero) + "%";
            }
          }
          if(commaDisplay){
            val = this.doCommaSeparat(val)
          }
          dataHtml += lineUids.includes(valueUid) ?
          `<div>
            ${iconHtml}
            <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${param.seriesName}：</span>
            <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${val}</span>
            <span style="visibility:${tooltipShowUnit ? "visible" : "hidden"}; color:${tooltipShowUnitColor};font-size:${tooltipShowUnitSize}px;line-height:1;">${tooltipUnitYRight}</span>
          </div>` :
         `<div>
            ${iconHtml}
            <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${param.seriesName}：</span>
            <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${val}</span>
            <span style="visibility:${tooltipShowUnit ? "visible" : "hidden"}; color:${tooltipShowUnitColor};font-size:${tooltipShowUnitSize}px;line-height:1;">${tooltipUnitY}</span>
          </div>`;
          seriesNameSet.add(param.seriesName);
        }
        let titleNameUid = this.transposed? params[0].dimensionNames[params[0].encode['y'][0]] :params[0].dimensionNames[params[0].encode['x'][0]]
        let titleHtml = showTitle ? `<div>
          <span style="color:${titleFontColor};font-size:${titleFontSize}px;line-height:1;">${params[0]?.value[titleNameUid]}</span>
        </div>` : "";

        let paddingStyle = "0";
        if(titleHtml || dataHtml){
          paddingStyle = `${paddingHeight}px ${paddingWidth}px`;
        }
        return `
          <div style="padding: ${paddingStyle};">
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

  updateXValuesToSeriesList() {
    let yDims = this.getOption<OptionFieldValue[]>("axis-y");
    let xDims = this.getOption<OptionFieldValue[]>("axis-x");
    let groupDims = this.getOption<OptionFieldValue[]>("axis-group");
    let dataSource = this.datasetSource();
    let seriesList = Array.isArray(this.echartsSeriesOption) && this.echartsSeriesOption.map((series) => series.name)

    if (seriesList.length) {
      let xValuesToFirstValidIndexMap = new Map()
      let xValuesToLastIndexMap = new Map();
      dataSource.forEach((row, index) => {
        const key = row[groupDims[0].uid[2]];
        const yValue = this.getMetric(row, yDims[0]);
        const xValue = row[xDims[0].uid[2]];

        xValuesToLastIndexMap.set(xValue, {
          seriesIndex: seriesList.indexOf(key),
          dataIndex: index
        });
        if (!xValuesToFirstValidIndexMap.has(xValue) && this.isValidSeriesValue(yValue)) {
          xValuesToFirstValidIndexMap.set(xValue, {
            seriesIndex: seriesList.indexOf(key),
            dataIndex: index
          });
        }
      });
      this.xValuesToSeriesList = Array.from(xValuesToLastIndexMap.keys()).map(xValue => {
        if (xValuesToFirstValidIndexMap.has(xValue)) {
          return xValuesToFirstValidIndexMap.get(xValue);
        } else {
          return xValuesToLastIndexMap.get(xValue)
        }
      });
    }
  }

  getAnimationType() {
    return this.getOption("animation-display-type");
  }

  beginAnimationDisplay() {
    super.beginAnimationDisplay();
    let b2_animator = null;
    if (this.getAnimationType() == "roll") {
      b2_animator = this.rollAnimationDisplay();
    } else if (this.getAnimationType() == "carousel") {
      if (this.xTypes.length) {
        this.updateXValuesToSeriesList()
      }
      b2_animator = this.carouselAnimationDisplay();
    }
    if (b2_animator) {
      this.b2_animators.push(b2_animator);
    }
  }

  rollAnimationDisplay() {
    let start = this.echartsChart.getOption()?.dataZoom?.[0]?.start;
    let end = this.echartsChart.getOption()?.dataZoom?.[0]?.end;
    let xDims = this.getOption<OptionFieldValue[]>("axis-x") || [];
    let dataLength = this.echartsChart.getOption()?.dataset?.[0]?.source?.length
    if(xDims?.length){
      //处理X轴字段数量
      dataLength = dataLength/xDims.length
    }
    clearInterval(this.animation_display_timeout);
    if(start === 0 && end === 100 || this.getOption("series-shape-number-type") !== "custom") return this.delay(2000);
    let rollNum = this.getOption<number>("shape-column-number") - 1;
    let promise = Promise.resolve();
    let currentIndex = this.echartsChart.getOption().dataZoom[0].startValue;
    let display_duration = this.getAnimationDisplayDuration();
    let display_interval = Math.max(this.getOption<number>("animation-display-single-interval") * 1000, 0) || 1000;
    let update_data;
    if(this.transposed){
      // 条形图滚动动画
      let endVal = dataLength - 1;
      currentIndex = endVal - rollNum ;
      update_data = (resolve) => {
      this.animation_display_timeout = setInterval(() => {
        if (this.stopAnimate) {
          clearInterval(this.animation_display_timeout);
          this.echartsChart.dispatchAction({ type: 'dataZoom', startValue: dataLength-rollNum-1, endValue: dataLength-1 });
          return resolve();
        }
        if(this.animation_display_paused || this.isAnimating || !this.status.isVisible) return;
        if(this.selectedIndex.value !== -1){
          this.selectedIndex.value = -1;
          this.selectedData.value = null;
          this.animationTriggerLinkage && this.withdrawLinkage();
        }

        //选中当前
        if (currentIndex < 0) {
          currentIndex = dataLength - rollNum;
          clearInterval(this.animation_display_timeout);
          //全部取消选中
          this.echartsChart.dispatchAction({ type: 'dataZoom', startValue: dataLength-rollNum-1, endValue: dataLength-1 });
          resolve();
        }else{
          this.echartsChart.dispatchAction({ type: 'dataZoom', startValue: currentIndex, endValue: endVal });
          currentIndex--;
          endVal--;
        }
      }, display_duration + display_interval);
    };
    }else{
      update_data = (resolve) => {
      this.animation_display_timeout = setInterval(() => {
        if (this.stopAnimate) {
          clearInterval(this.animation_display_timeout);
          this.echartsChart.dispatchAction({ type: 'dataZoom', startValue: 0, endValue: rollNum });
          return resolve();
        }
        if(this.animation_display_paused || this.isAnimating || !this.status.isVisible) return;
        if(this.selectedIndex.value !== -1){
          this.selectedIndex.value = -1;
          this.selectedData.value = null;
          this.animationTriggerLinkage && this.withdrawLinkage();
        }

        //选中当前
        if (currentIndex + rollNum >= dataLength) {
          currentIndex = this.echartsChart.getOption().dataZoom[0].startValue;
          clearInterval(this.animation_display_timeout);
          //全部取消选中
          this.echartsChart.dispatchAction({ type: 'dataZoom', startValue: 0, endValue: rollNum });
          resolve();
        }else{
          this.echartsChart.dispatchAction({ type: 'dataZoom', startValue: currentIndex, endValue: currentIndex + rollNum });
          currentIndex++;
        }
      }, display_duration + display_interval);
    };
    }

    promise = new Promise((resolve) => {
      update_data(resolve);
    });
    return promise
  }

  carouselAnimationDisplay() {
    let display_stay = Math.max(this.getOption<number>("animation-display-stay-column-carousel") * 1000, 1000);
    let x_uid = this.getOption("axis-x")?.[0]?.uid;
    let promise = Promise.resolve();
    let currentIndex = this.echartsChart.getOption().dataZoom?.[0]?.startValue || 0;
    let update_data = (resolve) => {
      if(this.resetSelectedIndex.value){
        this.resetSelectedIndex.value = !this.resetSelectedIndex.value
        currentIndex = 0;
      }
      // 先执行一次 否则刚开始会多停顿 display_stay 的时长
      let linkages = [];
      if (this.xTypes.length) {
        this.echartsChart.dispatchAction({ type: 'showTip', seriesIndex: this.xValuesToSeriesList[currentIndex]?.seriesIndex, dataIndex: this.xValuesToSeriesList[currentIndex]?.dataIndex });
        this.echartsChart.dispatchAction({ type: 'select', seriesIndex: this.xValuesToSeriesList[currentIndex]?.seriesIndex, dataIndex: this.xValuesToSeriesList[currentIndex]?.dataIndex });
      } else {
        this.echartsChart.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: currentIndex });
        this.echartsChart.dispatchAction({ type: 'select', dataIndex: currentIndex });
      }
      if (x_uid) {
        let targetIndex = this.xTypes.length ? this.xValuesToSeriesList[currentIndex]?.dataIndex : currentIndex
        let targetData = this.echartsChart.getOption().dataset?.[0]?.source?.[targetIndex];
        let fieldArr = this.getOption<string>("linkage-form-field")?.split(".");
        let fieldUIDs;
        let filterValue;
        if (targetData && fieldArr?.length) {
          if (fieldArr.length === 2) {
            fieldUIDs = [x_uid[0], ...fieldArr];
            filterValue = targetData[fieldArr[1]];
          } else if (fieldArr.length === 3) {
            fieldUIDs = [x_uid[0], fieldArr[0], `${fieldArr[1]}.${fieldArr[2]}`];
            filterValue = targetData[fieldArr[1]] ? targetData[fieldArr[1]].map(item => item[fieldArr[2]]) : targetData[fieldArr[2]];
          }
        }
        if(filterValue) {
          linkages.push({ uid: fieldUIDs, value: filterValue });
        }
      }
      this.animationTriggerLinkage && this.applyLinkage(linkages);
      currentIndex++;

      this.animation_display_timeout = setInterval(() => {
        if(currentIndex === this.datasetSource()?.length){
          currentIndex = 0
        }
        if(this.resetSelectedIndex.value){
          this.resetSelectedIndex.value = !this.resetSelectedIndex.value
          currentIndex = 0;
        }
        if (this.stopAnimate) {
          clearInterval(this.animation_display_timeout);
          this.echartsChart.dispatchAction({ type: 'hideTip' });
          this.echartsChart.dispatchAction({ type: 'unselect', dataIndex: currentIndex });
          return resolve();
        }
        if(this.animation_display_paused || this.isAnimating) return;

        //选中当前
        let linkages = [];
        if (this.xTypes.length) {
          this.echartsChart.dispatchAction({ type: 'showTip', seriesIndex: this.xValuesToSeriesList[currentIndex]?.seriesIndex, dataIndex: this.xValuesToSeriesList[currentIndex]?.dataIndex });
          this.echartsChart.dispatchAction({ type: 'select', seriesIndex: this.xValuesToSeriesList[currentIndex]?.seriesIndex, dataIndex: this.xValuesToSeriesList[currentIndex]?.dataIndex });
        } else {
          this.echartsChart.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: currentIndex });
          this.echartsChart.dispatchAction({ type: 'select', dataIndex: currentIndex });
        }
        if (x_uid) {
          let targetIndex = this.xTypes.length ? this.xValuesToSeriesList[currentIndex]?.dataIndex : currentIndex
          let targetData = this.echartsChart.getOption().dataset?.[0]?.source?.[targetIndex];
          let fieldArr = this.getOption<string>("linkage-form-field")?.split(".");
          let fieldUIDs;
          let filterValue;
          if (targetData && fieldArr?.length) {
            if (fieldArr.length === 2) {
              fieldUIDs = [x_uid[0], ...fieldArr];
              filterValue = targetData[fieldArr[1]];
            } else if (fieldArr.length === 3) {
              fieldUIDs = [x_uid[0], fieldArr[0], `${fieldArr[1]}.${fieldArr[2]}`];
              filterValue = targetData[fieldArr[1]] ? targetData[fieldArr[1]].map(item => item[fieldArr[2]]) : targetData[fieldArr[2]]
            }
          }
          if(filterValue) {
            linkages.push({ uid: fieldUIDs, value: filterValue });
          }
        }
        this.animationTriggerLinkage && this.applyLinkage(linkages);

        if (this.echartsChart.getOption().dataZoom?.length && currentIndex > this.echartsChart.getOption().dataZoom[0].endValue) {
          currentIndex = this.echartsChart.getOption().dataZoom[0].startValue;
          clearInterval(this.animation_display_timeout);
          this.echartsChart.dispatchAction({ type: 'hideTip' });
          this.echartsChart.dispatchAction({ type: 'select', dataIndex: -1 });
          this.animationTriggerLinkage && this.withdrawLinkage();
          resolve();
        }else{
          currentIndex++;
        }
      }, display_stay);
    };
    promise = new Promise((resolve) => {
      update_data(resolve);
    });
    return promise
  }

  restartAnimationDisplay() {
    this.selectedIndex.value = -1;
    this.selectedData.value = null;
    this.stopAnimationDisplay();

    this.echartsChart.setOption({
      series: this.echartsSeriesOption,
      dataZoom: this.echartsDataZoomOption,
    }, {
      notMerge: false,
      replaceMerge: ["series", "dataZoom"],
      lazyUpdate: true
    })
    this.startAnimationDisplay();
  }

  useInverse(axisType: string ) {
    if (axisType === "y-polyline") {
      return this.getOption<boolean>("y-polyline-inverse");
    }
    return false
  }

  xAxisValues() {
    let xAxisValueArr = [];
    let xDims = this.getOption<OptionFieldValue[]>("axis-x") || [];
    if (xDims.length) {
      let dataSource = this.datasetSource();
      let xUid = xDims[0].uid[2];
      xAxisValueArr = dataSource.map(row => row[xUid]);
    }
    return xAxisValueArr;
  }

  /**
   * 处理图表点击联动的通用方法。处理选中状态切换、数据更新及联动逻辑
   * @param params ECharts 点击事件参数
   * @param state 点击状态记录对象
   */
  public processClick(params: any, state: ChartClickState) {
    this.selectedData.value = {
      name: params.name,
      value: params.data.sumVal ?? params.value
    }

    // 取消上一次的选中
    if ((state.lastseriesIndex !== -1 && state.lastDataIndex !== -1) &&
        (state.lastseriesIndex !== params.seriesIndex || state.lastDataIndex !== params.dataIndex)) {
      this.echartsChart.dispatchAction({
        type: 'unselect',
        seriesIndex: state.lastseriesIndex,
        dataIndex: state.lastDataIndex
      });
    }

    if (state.lastseriesIndex === params.seriesIndex && state.lastDataIndex === params.dataIndex) {
      // 点击同一个点，取消选中
      this.echartsChart.dispatchAction({
        type: 'unselect',
        seriesIndex: params.seriesIndex,
        dataIndex: params.dataIndex
      });
      state.lastseriesIndex = -1;
      state.lastDataIndex = -1;
      this.selectedIndex.value = -1;
      this.selectedData.value = null;
      this.withdrawLinkage();
    } else {
      // 选中新点
      this.echartsChart.dispatchAction({
        type: 'select',
        seriesIndex: params.seriesIndex,
        dataIndex: params.dataIndex
      })
      state.lastseriesIndex = params.seriesIndex;
      state.lastDataIndex = params.dataIndex;

      // 联动逻辑
      let uids = this.getOption("axis-x")?.[0]?.uid;
      if (uids?.length) {
        let fieldArr = this.getOption<string>("linkage-form-field")?.split(".");
        let fieldUIDs;
        let filterValue;
        if (fieldArr?.length) {
          if (fieldArr.length === 2) {
            fieldUIDs = [uids[0], ...fieldArr];
            filterValue = params.data[fieldArr[1]];
          } else if (fieldArr.length === 3) {
            fieldUIDs = [uids[0], fieldArr[0], `${fieldArr[1]}.${fieldArr[2]}`];
            const rawData = params.data[fieldArr[1]];
            filterValue = Array.isArray(rawData) ? rawData.map(item => item[fieldArr[2]]) : rawData;
          }
        }
        // console.log("axis click linkage", params.value, fieldArr, { uid: fieldUIDs as OptionFieldUID, value: filterValue });
        this.applyLinkage({ uid: fieldUIDs as OptionFieldUID, value: filterValue });
      }
    }
  }

}

