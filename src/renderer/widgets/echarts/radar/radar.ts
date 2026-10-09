import { PrivateData, PrivateDataConnectionUID, PrivateDataTableUID, OptionFieldUID } from "@common/types/project";
import { DefinedOptions, OptionFieldValue, OptionFontValue, OptionFileValue, WidgetMetaData, ChartClickState } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { TheWidget as Echarts, component as B2Chart } from "@renderer/widgets/echarts/basic";
import { TooltipComponentOption } from "echarts/dist/echarts";
import { formatFloat } from "@common/utils/math";
import  resource  from "./locales"
import i18next from "@renderer/widgets/i18next";
import { merge, recursive } from "merge";
import { ref, watch } from "vue";

export class Radar extends Echarts {
  static resource = recursive(true, Echarts.resource, resource);
  public selectedIndex = ref(-1);
  public selectedData = ref({});

  protected axisUnitMap: Object = {
    3: i18next.t("thousand"),
    4: i18next.t("ten_thousand"),
    5: i18next.t("one_hundred_thousand"),
    6: i18next.t("million"),
    7: i18next.t("must"),
    8: i18next.t("Billion"),
  };

  static defineOptions(): DefinedOptions[] {
    return [
      {
        data: {
          fields: {
            alias: i18next.t("fields"),
            children: [
              {
                name: "axis-x",
                alias: i18next.t("axis-x"),
                type: "field(recommend=string)",
                default: [{ "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_1"], "__opt_type": "field", "summary": "" }]
              },
              {
                name: "axis-y",
                alias: i18next.t("axis-y"),
                type: "field(aggs=sum|none|max|min|mean|count|distinct, min=0)",
                default: [{ "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_2"], "__opt_type": "field", "summary": "sum" }]
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
          legend: {
            default: false,
          },
          sort: {
            visible: false
          },
          "series-color": {
            alias: i18next.t("series-color"),
            children: [
              {
                name: "palette",
                alias: i18next.t("palette"),
                type: "palette(gradient)",
              },
              {
                name: "palette-area",
                alias: i18next.t("palette-area"),
                type: "palette(gradient)",
                default: ["transparent"],
              },
            ]
          },
          "axis": {
            visible: true,
            children: [
              {
                name: "angle-display-cluster",
                alias: i18next.t("angle-display"),
                show: "tab",
                children: [
                  {
                    name: "angle-display",
                    alias: i18next.t("angle-display"),
                    type: "boolean",
                    default: true,
                  },
                  {
                    name: "angle-label-cluster",
                    alias: i18next.t("angle-label-cluster"),
                    children: [
                      {
                        name: "angle-label",
                        alias: i18next.t("angle-label"),
                        type: "boolean",
                        default: true,
                      },
                      {
                        name: "angle-label-offset",
                        alias: i18next.t("angle-label-offset"),
                        type: "number(unit=px)",
                        default: 10,
                        disabled: (widget: Radar) => {
                          return !widget.getOption("angle-label");
                        },
                      },
                      {
                        name: "angle-font",
                        alias: i18next.t("angle-font"),
                        type: "font",
                        default: {
                          family: "sans-serif",
                          size: 12,
                          bold: false,
                          italic: false,
                          underline: false,
                          deleteline: false,
                        },
                        disabled: (widget: Radar) => {
                          return !widget.getOption("angle-label");
                        },
                      },
                      {
                        name: "angle-display-shadow-color",
                        alias: i18next.t("angle-display-shadow-color"),
                        type: "color",
                        default: "#ffffff",
                        disabled: (widget: Radar) => {
                          return !widget.getOption("angle-label");
                        },
                      },
                      {
                        name: "angle-display-shadow-blur",
                        alias: i18next.t("angle-display-shadow-blur"),
                        type: "number(unit=px)",
                        default: 0,
                        disabled: (widget: Radar) => {
                          return !widget.getOption("angle-label");
                        },
                      },
                      {
                        name: "angle-display-shadow-offset-x",
                        alias: i18next.t("angle-display-shadow-offset-x"),
                        type: "number(unit=px)",
                        default: 0,
                        disabled: (widget: Radar) => {
                          return !widget.getOption("angle-label");
                        },
                      },
                      {
                        name: "angle-display-shadow-offset-y",
                        alias: i18next.t("angle-display-shadow-offset-y"),
                        type: "number(unit=px)",
                        default: 0,
                        disabled: (widget: Radar) => {
                          return !widget.getOption("angle-label");
                        },
                      }
                    ]
                  }
                ],
              },
              {
                name: "radius-display-cluster",
                alias: i18next.t("radius-display"),
                show: "tab",
                children: [
                  {
                    name: "radius-display",
                    alias: i18next.t("radius-display"),
                    type: "boolean",
                    default: true,
                  },
                  {
                    name: "radius-line-cluster",
                    alias: i18next.t("radius-line-cluster"),
                    children: [
                      {
                        name: "radius-line",
                        alias: i18next.t("radius-line"),
                        type: "boolean",
                        default: true,
                      },
                      {
                        name: "radius-line-type",
                        alias: i18next.t("radius-line-type"),
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
                        disabled: (widget: Radar) => {
                          return !widget.getOption("radius-line");
                        },
                      },
                      {
                        name: "radius-line-color",
                        alias: i18next.t("radius-line-color"),
                        type: "color",
                        default: "#CCCCCC",
                        disabled: (widget: Radar) => {
                          return !widget.getOption("radius-line");
                        },
                      },
                      {
                        name: "radius-line-width",
                        alias: i18next.t("radius-line-width"),
                        type: "number(unit=px)",
                        default: 1,
                        disabled: (widget: Radar) => {
                          return !widget.getOption("radius-line");
                        },
                      },
                    ],
                  },
                  {
                    name: "radius-tickline-cluster",
                    alias: i18next.t("radius-tickline-cluster"),
                    children: [
                      {
                        name: "radius-tickline",
                        alias: i18next.t("radius-tickline-cluster"),
                        type: "boolean",
                        default: true,
                      },
                      {
                        name: "radius-tickline-color",
                        alias: i18next.t("radius-tickline-color"),
                        type: "color",
                        default: "#CCCCCC",
                        disabled: (widget: Radar) => {
                          return !widget.getOption("radius-tickline");
                        },
                      },
                      {
                        name: "radius-tickline-width",
                        alias: i18next.t("radius-tickline-width"),
                        type: "number(unit=px)",
                        default: 2,
                        disabled: (widget: Radar) => {
                          return !widget.getOption("radius-tickline");
                        },
                      },
                      {
                        name: "radius-tickline-length",
                        alias: i18next.t("radius-tickline-length"),
                        type: "number(unit=px)",
                        default: 5,
                        disabled: (widget: Radar) => {
                          return !widget.getOption("radius-tickline");
                        },
                      },
                    ],
                  },
                  {
                    name: "radius-label-cluster",
                    alias: i18next.t("radius-label-cluster"),
                    children: [
                      {
                        name: "radius-label",
                        alias: i18next.t("radius-label-cluster"),
                        type: "boolean",
                        default: true,
                      },
                      {
                        name: "radius-label-position",
                        alias: i18next.t("radius-label-position"),
                        type: "select(radioGroup)",
                        default: "outside",
                        selectChoices: [
                          {
                            value: "outside",
                            label: i18next.t("outside"),
                          },
                          {
                            value: "above",
                            label: i18next.t("above"),
                          },
                        ],
                        visible: (widget: Radar) => {
                          return widget.transposed;
                        },
                      },
                      {
                        name: "radius-text-type",
                        alias: i18next.t("radius-text-type"),
                        default: "normal", //FIXME this.getYFormatter() ? "percent" : "normal",
                        type: "select(radioGroup)",
                        selectChoices: [
                          {
                            label: i18next.t("normal"),
                            value: "normal",
                          },
                          {
                            label: i18next.t("percent"),
                            value: "percent",
                          },
                        ],
                        disabled: (widget: Radar) => {
                          return !widget.getOption("radius-label");
                        },
                      },
                      {
                        name: "radius-value-abbreviation",
                        alias: i18next.t("radius-value-abbreviation"),
                        type: "select",
                        default: "0",
                        selectChoices: [
                          {
                            label: i18next.t("zore"),
                            value: "0",
                          },
                          {
                            label: i18next.t("thousand"),
                            value: "3",
                          },
                          {
                            label: i18next.t("ten_thousand"),
                            value: "4",
                          },
                          {
                            label: i18next.t("one_hundred_thousand"),
                            value: "5",
                          },
                          {
                            label: i18next.t("million"),
                            value: "6",
                          },
                          {
                            label: i18next.t("must"),
                            value: "7",
                          },
                          {
                            label: i18next.t("Billion"),
                            value: "8",
                          },
                        ],
                        disabled: (widget: Radar) => {
                          return !widget.getOption("radius-label");
                        },
                      },
                      {
                        name: "radius-decimal-places",
                        alias: i18next.t("radius-decimal-places"),
                        type: "number(unit=" + i18next.t("unit_wei") + ")",
                        default: 0,
                        disabled: (widget: Radar) => {
                          return !widget.getOption("radius-label");
                        },
                      },
                      {
                        name: "radius-complete-zero",
                        alias: i18next.t("radius-complete-zero"),
                        type: "boolean",
                        default: false,
                        disabled: (widget: Radar) => {
                          return !widget.getOption("radius-label");
                        },
                      },
                      {
                        name: "radius-label-offset",
                        alias: i18next.t("radius-label-offset"),
                        type: "number(unit=px)",
                        default: 10,
                        disabled: (widget: Radar) => {
                          return !widget.getOption("radius-label");
                        },
                      },
                      {
                        name: "radius-scale-range",
                        alias: i18next.t("radius-scale-range"),
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
                        disabled: (widget: Radar) => {
                          return !widget.getOption("radius-label");
                        },
                      },
                      {
                        name: "radius-scale-min",
                        alias: i18next.t("radius-scale-min"),
                        type: "number",
                        default: 0,
                        visible: (widget: Radar) => {
                          return widget.getOption("radius-scale-range") == "custom";
                        },
                      },
                      {
                        name: "radius-scale-max",
                        alias: i18next.t("radius-scale-max"),
                        type: "number",
                        default: 100,
                        visible: (widget: Radar) => {
                          return widget.getOption("radius-scale-range") == "custom";
                        },
                      },
                      {
                        name: "radius-scale-interval",
                        alias: i18next.t("radius-scale-interval"),
                        type: "number(unit=" + i18next.t("unit_ge") + ")",
                        default: 50,
                        visible: (widget: Radar) => {
                          return false
                        },
                      },
                      {
                        name: "radius-font",
                        alias: i18next.t("radius-font"),
                        type: "font",
                        default: {
                          family: "sans-serif",
                          size: 12,
                          bold: false,
                          italic: false,
                          underline: false,
                          deleteline: false,
                        },
                        disabled: (widget: Radar) => {
                          return !widget.getOption("radius-label");
                        },
                      },
                      {
                        name: "radius-display-shadow-color",
                        alias: i18next.t("radius-display-shadow-color"),
                        type: "color",
                        default: "#ffffff",
                        disabled: (widget: Radar) => {
                          return !widget.getOption("radius-label");
                        },
                      },
                      {
                        name: "radius-display-shadow-blur",
                        alias: i18next.t("radius-display-shadow-blur"),
                        type: "number(unit=px)",
                        default: 0,
                        disabled: (widget: Radar) => {
                          return !widget.getOption("radius-label");
                        },
                      },
                      {
                        name: "radius-display-shadow-offset-x",
                        alias: i18next.t("radius-display-shadow-offset-x"),
                        type: "number(unit=px)",
                        default: 0,
                        disabled: (widget: Radar) => {
                          return !widget.getOption("radius-label");
                        },
                      },
                      {
                        name: "radius-display-shadow-offset-y",
                        alias: i18next.t("radius-display-shadow-offset-y"),
                        type: "number(unit=px)",
                        default: 0,
                        disabled: (widget: Radar) => {
                          return !widget.getOption("radius-label");
                        },
                      },
                      {
                        name: "radius-rotate",
                        alias: i18next.t("radius-rotate"),
                        type: "select",
                        default: "0",
                        disabled: (widget: Radar) => {
                          return !widget.getOption("radius-label");
                        },
                        selectChoices: [
                          {
                            value: "0",
                            label: i18next.t("radius-zore"),
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
                    name: "radius-grid-cluster",
                    alias: i18next.t("grid"),
                    children: [
                      {
                        name: "grid-radius-line-shape-type",
                        alias: i18next.t("grid-radius-line-shape-type"),
                        default: "line",
                        type: "select(radioGroup)",
                        selectChoices: [
                          {
                            value: "line",
                            label: i18next.t("line"),
                          },
                          {
                            value: "circle",
                            label: i18next.t("circle"),
                          },
                        ],
                        visible: false,
                      },
                      {
                        name: "grid-radius-line-type",
                        alias: i18next.t("grid-radius-line-type"),
                        default: "dotted",
                        type: "select(radioGroup)",
                        selectChoices: [
                          {
                            value: "line",
                            label: i18next.t("straight_line"),
                          },
                          {
                            value: "dotted",
                            label: i18next.t("dashed"),
                          },
                        ],
                      },
                      {
                        name: "grid-radius-line-dotted-width",
                        alias: i18next.t("grid-radius-line-dotted-width"),
                        default: 4,
                        // range:"[2,30,1]",
                        type: "number(unit=px)",
                        visible: (widget: Radar) => {
                          return (
                            widget.getOption("grid-radius-line-type") == "dotted"
                          );
                        },
                      },
                      {
                        name: "grid-radius-line-colors",
                        alias: i18next.t("grid-radius-line-colors"),
                        type: "palette(gradient)",
                        default: ["#fff"],
                      },
                      {
                        name: "grid-radius-line-width",
                        alias: i18next.t("grid-radius-line-width"),
                        default: 1,
                        type: "number(unit=px)",
                      },
                      {
                        name: "grid-radius-line-fill",
                        alias: i18next.t("grid-radius-line-fill"),
                        type: "palette(gradient)",
                        default: [],
                      },
                    ],
                  }
                ],
              }
            ]
          },
          "series-shape": {
            alias: i18next.t("series-shape"),
            children: [
              {
                name: "radar-shape",
                alias: i18next.t("radar-shape"),
                type: "select(radioGroup)",
                default: "circle",
                selectChoices: [
                  {
                    value: "circle",
                    label: i18next.t("circle")
                  },
                  {
                    value: "polygon",
                    label: i18next.t("polygon")
                  },
                ],
              },
              {
                name: "radar-direction",
                alias: i18next.t("radar-direction"),
                type: "select(radioGroup)",
                default: "counterClockwise",
                selectChoices: [
                  {
                    value: "clockwise",
                    label: i18next.t("clockwise")
                  },
                  {
                    value: "counterClockwise",
                    label: i18next.t("counterClockwise")
                  },
                ],
              },
              {
                name: "start-angle",
                alias: i18next.t("start-angle"),
                default: 90,
                type: "number(min=0, max=360, step=1, showInput,unit=°)",
              },
              {
                name: "inner-radius",
                alias: i18next.t("inner-radius"),
                default: 0,
                type: "number(min=0, max=75, step=1, showInput, unit=%)",
                visible: false,
              },
              {
                name: "outer-radius",
                default: 80,
                type: "number(min=1, max=100, step=1, showInput, unit=%)",
                alias: i18next.t("outer-radius"),
              },
              {
                name: "radar-background-color",
                alias: i18next.t("radar-background-color"),
                type: "color(gradient)",
                default: "#EDEDED19",
                visible: (widget: Radar) => {
                  return !widget.getOption("splitLine");
                }
              },
              {
                name: "radar-line-type",
                alias: i18next.t("radar-line-type"),
                type: "select(radioGroup)",
                default: "solid",
                selectChoices: [
                  {
                    value: "solid",
                    label: i18next.t("solid")
                  },
                  {
                    value: "dashed",
                    label: i18next.t("dashed")
                  },
                  {
                    value: "dotted",
                    label: i18next.t("dotted")
                  },
                ],
              },
              {
                name: "radar-line-width",
                alias: i18next.t("radar-line-width"),
                type: "number(min=0, unit=px)",
                default: 1
              },
              {
                name: "radar-symbol-type",
                alias: i18next.t("radar-symbol-type"),
                type: "select",
                default: "emptyCircle",
                selectChoices: [
                  { label: i18next.t("none"), value: "none" },
                  { label: i18next.t("emptyCircle"), value: "emptyCircle" },
                  { label: i18next.t("circle"), value: "circle" },
                  { label: i18next.t("rect"), value: "rect" },
                  { label: i18next.t("triangle"), value: "triangle" },
                  { label: i18next.t("diamond"), value: "diamond" },
                  { label: i18next.t("triangle"), value: "triangle" },
                  { label: i18next.t("arrow"), value: "arrow" },
                ]
              },
              {
                name: "radar-symbol-size",
                alias: i18next.t("radar-symbol-size"),
                type: "number(min=0, unit=px)",
                default: 4
              },
            ]
          },
        }
      },
      ...super.defineOptions()
    ]
  }

  protected getDefaultPrivateData(): PrivateData {
    return {
      fields: [
        { uid: "f_1", alias: "名称", type: "string" },
        { uid: "f_2", alias: "数值", type: "number" },
      ],
      rows: [
        { f_1: '示例一', f_2: 36 },
        { f_1: '示例二', f_2: 18 },
        { f_1: '示例三', f_2: 25 },
        { f_1: '示例四', f_2: 20 },
        { f_1: '示例五', f_2: 40 },
        { f_1: '示例六', f_2: 27 },
      ],
    };
  }

  _datasetSource(): any {
    let yDims = this.getOption<OptionFieldValue[]>("axis-y");
    let xDims = this.getOption<OptionFieldValue[]>("axis-x");
    let directionType = this.getOption("radar-direction");
    let source
    if (xDims?.length && yDims?.length) {
      source = this.createView(["axis-x", "axis-y"]);
      source = this.dealDataByAggregate(source, [xDims[0]], yDims);
      source.forEach(row => {
        this.writeMetricToRow(row, yDims[0], xDims);
      })
    } else {
      source = this.getPrivateData().rows;
    }

    if(directionType === "clockwise") {
      return source.reverse()
    }else{
      return source
    }
  }

  get echartsOption(): any {
    let innerRadius = this.getOption<number>("inner-radius");
    let outerRadius = this.getOption<number>("outer-radius");
    let centerX = this.contentSize.width / 2 + this.padding.left - this.padding.right;
    let centerY = this.contentSize.height / 2 + this.padding.top - this.padding.bottom;

    let option = {
      tooltip: this.echartsTooltipOption,
      legend: this.echartsLegendOption,
      radar: {
        center: [centerX, centerY],
        radius: [`${innerRadius}%`, `${outerRadius}%`],
        ...this.echartsRadarOption
      },
      dataset: this.echartsDatasetOption(),
      color: this.getSerieEchartsColors(),
      polar: {
        center: [centerX, centerY],
        radius: [`${innerRadius}%`, `${outerRadius}%`],
      },
      angleAxis: { type: "category", boundaryGap: false, clockwise: false, axisLabel: { show: false }, axisLine: { show: false }, axisTick: { show: false } },
      radiusAxis: { type: "value", splitLine: { show: false }, axisLabel: { show: false }, axisLine: { show: false }, axisTick: { show: false } },
      series: this.echartsSeriesOption,
    }
    return option;
  }

  getRadarOptionIndicator() {
    let xDimensions = this.getOption<OptionFieldValue[]>("axis-x") || [];
    let yDimensions = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let indicatorData = [];
    let dataMax = 0;
    if (!xDimensions.length || !yDimensions?.length) {
      let fieldTypeUids = this.getPrivateFieldTypeUids();
      indicatorData = this.getPrivateData().rows.map((rowItem, rowIndex) => {
        dataMax = Math.max(dataMax, rowItem?.[fieldTypeUids.number?.[0]]);
        let rowInfo = { name: rowItem?.[fieldTypeUids.string?.[0]] };
        if (rowIndex !== 0) {
          rowInfo["axisLabel"] = { show: false };
          rowInfo["axisLine"] = { show: false };
          rowInfo["axisTick"] = { show: false };
        }
        return rowInfo;
      });
    } else {
      let dataView = this.datasetSource();
      let columns = [];
      dataView.forEach(row => {
        if(!columns[0]) columns[0] = [];
        columns[0].push(row[xDimensions[0].uid[2]]);
        yDimensions.forEach((dim, index) => {
          if(!columns[index + 1]) columns[index + 1] = [];
          columns[index + 1].push(this.getMetric(row, yDimensions[index]));
        })
      })
      if(columns?.length) {
        indicatorData = Array.from(columns[0]).map((item: string, index) => {
          if (index == 0) {
            return { name: item }
          } else {
            return { name: item, axisLabel: { show: false }, axisLine: { show: false }, axisTick: { show: false } }
          }
        });
      }
      let data = this.datasetSource();
      let values = [];
      data.forEach(item => {
        values.push(this.getMetric(item, yDimensions[0]))
      })
      dataMax = Math.max(...values);
    }

    let radiusRangeType = this.getOption("radius-scale-range");
    if (radiusRangeType === "custom") {
      let scaleMin = this.getOption("radius-scale-min");
      let scaleMax = this.getOption<number>("radius-scale-max") < dataMax ? dataMax : this.getOption("radius-scale-max");
      indicatorData = indicatorData.map((item) => {
        item["min"] = scaleMin;
        item["max"] = scaleMax;
        return item;
      });
    }
    return indicatorData;
  }

  get echartsRadarOption(): any {
    let radarShape = this.getOption<"circle" | "polygon">("radar-shape");
    let startAngle = this.getOption<number>("start-angle");
    let directionType = this.getOption("radar-direction");

    let showAxis = this.getOption<boolean>("radius-display");
    let axisLabelFont = this.getOption<OptionFontValue>(`radius-font`);
    let yIsPercent = this.getOption(`radius-text-type`) === "percent";
    let yDecimalPlaces = Math.max(this.getOption(`radius-decimal-places`), 0);
    let yCompleteZero = this.getOption<boolean>(`radius-complete-zero`);
    let valueAbb = this.getOption<string>(`radius-value-abbreviation`);

    let angleAxisDisplay = this.getOption<boolean>("angle-display");
    let angleAxisLabelFont = this.getOption<OptionFontValue>("angle-font");


    let radarBackgroundColor = new Color(this.getOption<Color>("radar-background-color")).toEchartsColor();
    let dashWidth = this.getOption<number>(`grid-radius-line-dotted-width`) || 2;
    let splitLineColor = Array.from(this.getOption<Color[]>(`grid-radius-line-colors`)).map((color) => {
      return new Color(color).toEchartsColor();
    });
    let splitLineAreaColor = Array.from(this.getOption<Color[]>(`grid-radius-line-fill`))?.map((color) => {
      return new Color(color).toEchartsColor();
    });

    return {
      shape: radarShape,
      nameGap: this.getOption<number>("angle-label-offset"),
      axisName: {
        show: angleAxisDisplay && this.getOption<boolean>("angle-label"),
        fontStyle: angleAxisLabelFont.italic ? "italic" : "normal",
        fontWeight: angleAxisLabelFont.bold ? "bold" : "normal",
        fontSize: angleAxisLabelFont.size,
        fontFamily: angleAxisLabelFont.family,
        color: this.toEchartsColor(angleAxisLabelFont.color as Color),
        textShadowColor: this.toEchartsColor(this.getOption<Color>("angle-display-shadow-color")),
        textShadowBlur: this.getOption<number>("angle-display-shadow-blur"),
        textShadowOffsetX: this.getOption<number>("angle-display-shadow-offset-x"),
        textShadowOffsetY: this.getOption<number>("angle-display-shadow-offset-y"),
      },
      axisLine: {
        show: showAxis && this.getOption<boolean>(`radius-line`),
        lineStyle: {
          color: this.toEchartsColor(this.getOption<Color>(`radius-line-color`)),
          width: Math.max(this.getOption<number>(`radius-line-width`), 0),
          type: this.getOption<"dashed" | "solid">(`radius-line-type`),
          join: "miter"
        },
      },
      axisTick: {
        show: showAxis && this.getOption<boolean>(`radius-tickline`),
        length: this.getOption<number>(`radius-tickline-length`),
        lineStyle: {
          width: this.getOption<number>(`radius-tickline-width`),
          color: this.toEchartsColor(this.getOption<Color>(`radius-tickline-color`)),
        }
      },
      axisLabel: {
        show: showAxis && this.getOption<boolean>(`radius-label`),
        margin: this.getOption<number>(`radius-label-offset`),
        fontStyle: axisLabelFont.italic ? "italic" : "normal",
        fontWeight: axisLabelFont.bold ? "bold" : "normal",
        fontSize: axisLabelFont.size,
        fontFamily: axisLabelFont.family,
        color: this.toEchartsColor(axisLabelFont.color as Color),
        textShadowColor: this.toEchartsColor(this.getOption<Color>(`radius-display-shadow-color`)),
        textShadowBlur: this.getOption<number>(`radius-display-shadow-blur`),
        textShadowOffsetX: this.getOption<number>(`radius-display-shadow-offset-x`),
        textShadowOffsetY: this.getOption<number>(`radius-display-shadow-offset-y`),
        rotate: Number(this.getOption<string>(`radius-rotate`)),
        formatter: (value, index) => {
          let num = value;
          if (!isNaN(num)) {
            if (yIsPercent) {
              value = formatFloat(num * 100, yDecimalPlaces, yCompleteZero) + "%";
            } else {
              let abb = Number(valueAbb);
              let unit = this.axisUnitMap[abb] || "";
              value = formatFloat(num / Math.pow(10, abb), yDecimalPlaces, yCompleteZero) + unit;
            }
          }
          return value;
        }
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: splitLineColor,
          width: this.getOption<number>(`grid-radius-line-width`),
          type: this.getOption<string>(`grid-radius-line-type`) === "line" ? "solid" : dashWidth,
        }
      },
      splitArea: {
        show: true,
        areaStyle: {
          color: splitLineAreaColor?.length ? splitLineAreaColor : [radarBackgroundColor]
        }
      },
      startAngle: directionType === "clockwise" ? 360 / this.datasetSource().length + startAngle : startAngle,
      indicator: this.getRadarOptionIndicator(),
    }
  }

  checkErrorData() {
    let xDimensions = this.getOption<OptionFieldValue[]>("axis-x") || [];
    let yDimensions = this.getOption<OptionFieldValue[]>("axis-y") || [];
    if (!xDimensions?.length || !yDimensions?.length) {
      if(!xDimensions?.length && !yDimensions?.length) {
        this.addErrorDataStatus("filed-empty");
      } else {
        this.addErrorDataStatus("filed-incomplete");
      }
    } else {
      this.clearErrorDataStatus();
    }
  }

  get echartsSeriesOption(): any {
    let xDimensions = this.getOption<OptionFieldValue[]>("axis-x") || [];
    let yDimensions = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let lineColors = this.getSerieEchartsColors();
    let areaColors = this.getSerieEchartsColors("palette-area");

    let resultData = [];
    let maxValue = 0;
    let fieldTypeUids = this.getPrivateFieldTypeUids();
    if (!xDimensions?.length || !yDimensions?.length) {
      let privateData = this.getPrivateData();
      resultData = [
        {
          name: privateData.fields.find((item) => { return item["uid"] == fieldTypeUids.number?.[0] })?.alias || "value",
          value: privateData.rows.map((item) => {
            maxValue = Math.max(maxValue, item[fieldTypeUids.number?.[0]])
            return item[fieldTypeUids.number?.[0]];
          }),
          areaStyle: { color: areaColors[0] || "transparent" }
        },
      ];
    } else {
      let dataView = this.datasetSource();
      let columns = [];
      dataView.forEach(row => {
        if(!columns[0]) columns[0] = [];
        columns[0].push(row[xDimensions[0].uid[2]]);
        yDimensions.forEach((dim, index) => {
          if(!columns[index + 1]) columns[index + 1] = [];
          columns[index + 1].push(this.getMetric(row, yDimensions[index]));
        })
      })
      for (let fieldIndex = 1; fieldIndex < columns.length; fieldIndex++) {
        if (!columns[fieldIndex]?.length) continue;
        let areaColor = isNaN(fieldIndex % areaColors.length) ? "transparent" : areaColors[fieldIndex % areaColors.length];
        let values: number[] = Array.from(columns[fieldIndex]);
        resultData.push({
          name: this.getFieldAlias(yDimensions[fieldIndex-1].uid),
          value: values,
          areaStyle: { color: areaColor },
        })
        maxValue = Math.max(maxValue, ...values);
      }
    }
    if (maxValue) {
      let dataLength = resultData[0]?.value?.length || 0;
      resultData.push({
        name: "maxValue",
        value: Array(dataLength).fill(maxValue),
        itemStyle: { opacity: 0 },
        lineStyle: { opacity: 0 },
      })
    }
    let radarLineType: any = this.getOption<string>("radar-line-type");
    let radarLineWidth = this.getOption<number>("radar-line-width");
    let radarSymbol = this.getOption<string>("radar-symbol-type");
    let radarSymbolSize = this.getOption<number>("radar-symbol-size");
    let seriesOpt: any = [];
    seriesOpt.push({
      name: "value",
      type: "radar",
      symbol: radarSymbol,
      symbolSize: radarSymbolSize,
      lineStyle: {
        type: radarLineType,
        width: radarLineWidth
      },
      tooltip: {
        show: false,
      },
      data: resultData,
      silent: false
    })

    let lineLength = 1;
    if (xDimensions?.length && yDimensions?.length) { lineLength = yDimensions?.length }
    for (let lineIndex = 0; lineIndex < lineLength; lineIndex++) {
      let lineColor = isNaN(lineIndex % lineColors?.length) ? "transparent" : lineColors?.[lineIndex % lineColors.length];
      let seriesName;
      if (xDimensions?.length && yDimensions?.length) {
        seriesName = this.getFieldAlias(yDimensions?.[lineIndex]?.uid);
      }
      let option = {
        name: seriesName,
        type: "line",
        symbol: "none",
        coordinateSystem: 'polar',
        encode: {
          angle: seriesName == undefined ? fieldTypeUids.string?.[0] : xDimensions?.[0]?.uid?.[2],
          radius: seriesName == undefined ? fieldTypeUids.number?.[0] : this.getMetricFieldKey(yDimensions?.[lineIndex], xDimensions),
        },
        itemStyle: {
          color: lineColor,
          opacity: 0,
        },
        lineStyle: {
          color: lineColor,
          opacity: 0,
        }
      }
      seriesOpt.push(option);
    }

    return seriesOpt;
  }

  getLegendOtherOption() {
    let legendData: any = [];
    let xDimensions = this.getOption<OptionFieldValue[]>("axis-x") || [];
    let yDimensions = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let lineColors = this.getSerieEchartsColors();
    if (xDimensions?.length && yDimensions?.length) {
      legendData = yDimensions?.reduce((result, yDim, yIndex) => {
        let legendName = this.getFieldAlias(yDim?.uid);
        let lineColor = isNaN(yIndex % lineColors?.length) ? "transparent" : lineColors?.[yIndex % lineColors.length];
        result.push({
          name: legendName,
          icon: "rect",
          itemStyle: {
            color: lineColor,
            opacity: 1
          },
        });
        return result;
      }, []);
    } else {

      let privateData = this.getPrivateData();
      let fieldTypeUids = this.getPrivateFieldTypeUids();
      legendData = [];
      privateData.fields.map((field) => {
        if (field.uid == fieldTypeUids.number?.[0]) {
          legendData.push({
            name: field.alias,
            icon: "rect",
            itemStyle: { color: lineColors?.[0], opacity: 1 }
          });
        }
      });
    }
    return {
      data: legendData
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

    return {
      trigger: "axis",
      confine: true,
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
        let seriesNameSet = new Set();
        for (let param of params || []) {
          let name = param.seriesName;
          let val = param.value[param.dimensionNames[param.encode.radius?.[0]]];
          if (seriesNameSet.has(name)) continue;
          let iconHtml = showIcon ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${seriesCssColors[param.seriesIndex - 1 % seriesCssColors.length]};"></span>` : "";

          if (isNaN(val)) continue;
          if (tooltipStyle === "normal") {
            val = formatFloat(val, tooltipDecimalPlaces, tooltipCompleteZero);
          } else if (tooltipStyle === "percent") {
            val = formatFloat(val * 100, tooltipDecimalPlaces, tooltipCompleteZero) + "%";
          }
          if(commaDisplay){
            val = this.doCommaSeparat(val)
          }
          dataHtml += `<div>
            ${iconHtml}
            <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${name}：</span>
            <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${val}</span>
          </div>`;
          seriesNameSet.add(name);
        }
        let titleHtml = showTitle ? `<div>
          <span style="color:${titleFontColor};font-size:${titleFontSize}px;line-height:1;">${params[0].name}</span>
        </div>` : "";
        return `
          <div>
            ${titleHtml}
            <div>${dataHtml}</div>
          </div>
        `;
      },
    }
  }

  get axisX() {
    return this.getOption<OptionFieldValue[]>("axis-x") || [];
  }
  get axisY() {
    return this.getOption<OptionFieldValue[]>("axis-y") || [];
  }

  override getMetaData() {
    return merge(super.getMetaData(), {
      axisValue: [
        ...this.axisX,
        ...this.axisY
      ]
    } as WidgetMetaData);
  }

  /** 获取点击的最近行索引 */
  getClickedRowIndex(event: MouseEvent, dataCount: number): number {
    const { offsetX, offsetY } = event;
    const width = this.contentSize.width;
    const height = this.contentSize.height;
    const padding = this.padding;
    const centerX = width / 2 + padding.left - padding.right;
    const centerY = height / 2 + padding.top - padding.bottom;

    const dx = offsetX - centerX;
    const dy = centerY - offsetY;

    // 计算点击点的角度
    let clickAngle = Math.atan2(dy, dx) * 180 / Math.PI;
    if (clickAngle < 0) clickAngle += 360;

    let startAngle = this.getOption<number>("start-angle") || 90;
    let direction = this.getOption("radar-direction") || "counterClockwise";
    const step = 360 / dataCount;

    let bestIndex = 0;
    let minDiff = 360;

    // 找到最近的点
    for (let i = 0; i < dataCount; i++) {
      let indicatorAngle;
      if (direction === 'clockwise') {
        indicatorAngle = (startAngle - i * step) % 360;
      } else {
        indicatorAngle = (startAngle + i * step) % 360;
      }
      if (indicatorAngle < 0) indicatorAngle += 360;

      let diff = Math.abs(clickAngle - indicatorAngle);
      if (diff > 180) diff = 360 - diff;

      if (diff < minDiff) {
        minDiff = diff;
        bestIndex = i;
      }
    }
    return bestIndex;
  }

  initEchartsEvents(): void {
    const state: ChartClickState = {
      lastseriesIndex: -1,
      lastDataIndex: -1
    };

    this.echartsChart.off("click");
    this.echartsChart.on('click', (params) => {
      // 获取数据源
      const data = this.datasetSource();
      if (!data || data.length === 0) return;

      const event = params.event?.event || params.event;
      // 获取最近的行
      const bestIndex = this.getClickedRowIndex(event, data.length);

      if (state.lastseriesIndex !== -1 && state.lastDataIndex !== -1 &&
        (state.lastseriesIndex !== params.seriesIndex || state.lastDataIndex !== params.dataIndex)) {
        this.echartsChart.dispatchAction({
          type: 'unselect',
          seriesIndex: state.lastseriesIndex,
          dataIndex: state.lastDataIndex
        });
      }

      if (this.selectedIndex.value === bestIndex) {
        // 点击了同一行
        if (state.lastseriesIndex !== -1 && state.lastDataIndex !== -1) {
          this.echartsChart.dispatchAction({
            type: 'unselect',
            seriesIndex: state.lastseriesIndex,
            dataIndex: state.lastDataIndex
          });
        }
        state.lastseriesIndex = -1;
        state.lastDataIndex = -1;
        this.selectedIndex.value = -1;
        this.selectedData.value = {};
        this.withdrawLinkage();
        return;
      }

      // 完整行数据
      const clickedRow = data[bestIndex];
      this.selectedData.value = clickedRow;
      this.selectedIndex.value = bestIndex;

      this.echartsChart.dispatchAction({
        type: 'select',
        seriesIndex: params.seriesIndex,
        dataIndex: params.dataIndex
      });
      state.lastseriesIndex = params.seriesIndex;
      state.lastDataIndex = params.dataIndex;

      // 联动逻辑
      let uids = this.getOption<OptionFieldValue[]>("axis-x")?.[0]?.uid;
      if (uids?.length) {
        let fieldArr = this.getOption<string>("linkage-form-field")?.split(".");
        let fieldUIDs;
        let filterValue;

        if (fieldArr?.length) {
          if (fieldArr.length === 2) {
            fieldUIDs = [uids[0], ...fieldArr];
            filterValue = clickedRow[fieldArr[1]];
          } else if (fieldArr.length === 3) {
            fieldUIDs = [uids[0], fieldArr[0], `${fieldArr[1]}.${fieldArr[2]}`];
            const rawData = clickedRow[fieldArr[1]];
            filterValue = Array.isArray(rawData) ? rawData.map(item => item[fieldArr[2]]) : rawData;
          }
        }

        // console.log("radar", { uid: fieldUIDs as OptionFieldUID, value: filterValue, row: clickedRow });
        this.applyLinkage({ uid: fieldUIDs as OptionFieldUID, value: filterValue });
      }

    })
  }
}
