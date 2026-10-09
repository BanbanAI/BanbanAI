import { PrivateData, PrivateDataConnectionUID, PrivateDataTableUID, OptionFieldUID } from "@common/types/project";
import { DefinedOptions, OptionFontValue, OptionFieldValue, WidgetMetaData, ChartClickState } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { Widget } from "@renderer/b2/controllers/widget";
import { formatFloat } from "@common/utils/math";
import { TheWidget as Axis, component as B2Axis } from "@renderer/widgets/echarts/axis";
import { TooltipComponentOption, SeriesOption } from "echarts/dist/echarts";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { recursive } from "merge";
import { merge } from "lodash";

export class Line extends Axis {
  static resource = recursive(true, Axis.resource, resource);
  static getSeriesShapeBasicOptions() {
    return [
      {
        name: "series-shape-shadow-color",
        alias: i18next.t("shadowColor"),
        type: "color(gradient)",
        default: "#ffffff00",
      },
      {
        name: "series-shape-shadow-blur",
        alias: i18next.t("shadowBlur"),
        type: "number(unit=px)",
        default: 10,
      },
      {
        name: "series-shape-shadow-offset",
        alias: i18next.t("shadowOffset"),
        type: "vector<X, Y>(unit=px)",
        default: [0,0],
      },
    ] as any;
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
                name: "axis-line",
                alias: i18next.t("axisLine"),
                type: "field(aggs=sum|none|max|min|mean|count|distinct, min=0)",
                visible: true
              },
              {
                name: "axis-group",
                alias: i18next.t("axisGroup"),
                type: "field(recommend=string, min=0, max=1)",
                visible: true,
              },
            ],
          },
          sort: {
            visible: false
          }
        },
        style: {
          "label-group": {
            children: [
              {
                name: "label-default-cluster",
                alias: i18next.t("labelDefaultCluster"),
                children: [
                  {
                    name: "label-follow-graph",
                    alias: i18next.t("label-follow-graph"),
                    type: "boolean",
                    default: false,
                  },
                  {
                    name: "label-text-style-cluster",
                    children: [
                      {
                        name: "label-position",
                        visible: false
                      },
                      {
                        name: "label-color-type",
                        visible: true,
                      },
                      {
                        name: "label-text-offset",
                        alias: i18next.t("label-text-offset"),
                        type:"vector<X, Y>(unit=px)",
                        default:[0,0]
                      }
                    ]
                  }
                ]
              },
              {
                name: "ranking-cluster",
                visible: true,
                children: []
              }
            ]
          },
          "series-shape": {
            children: [
              {
                name: "series-shape-default-cluster",
                children: [
                  {
                    name: "boundaryGap",
                    alias: i18next.t("boundaryGap"),
                    type: "boolean",
                    default: true
                  },
                  {
                    name: "zero-removal",
                    visible: true
                  },
                  {
                    name: "unified-shape-type",
                    alias: i18next.t("unifiedShapeType"),
                    type: "select(radioGroup)",
                    default: "solid",
                    selectChoices: [
                      {
                        label: i18next.t("unifiedShapeTypeSolid"),
                        value: "solid",
                      },
                      {
                        label: i18next.t("unifiedShapeTypeDashed"),
                        value: "dashed",
                      },
                    ],
                  },
                  {
                    name: "unified-shape-smooth",
                    alias: i18next.t("unifiedShapeSmooth"),
                    type: "boolean",
                    default: false,
                  },
                  {
                    name: "unified-dot-shape-type",
                    alias: i18next.t("unifiedDotShapeType"),
                    type: "select",
                    default: "circle",
                    selectChoices: [
                      {
                        label: i18next.t("dotShapeTypeNone"),
                        value: "none",
                      },
                      {
                        label: i18next.t("dotShapeTypeImage"),
                        value: "image",
                      },
                      {
                        label: i18next.t("dotShapeTypeRect"),
                        value: "rect",
                      },
                      {
                        label: i18next.t("dotShapeTypeEmptyRect"),
                        value: "emptyRect",
                      },
                      {
                        label: i18next.t("dotShapeTypeRoundRect"),
                        value: "roundRect",
                      },
                      {
                        label: i18next.t("dotShapeTypeCircle"),
                        value: "circle",
                      },
                      {
                        label: i18next.t("dotShapeTypeEmptyCircle"),
                        value: "emptyCircle",
                      },
                      {
                        label: i18next.t("dotShapeTypeGradientCircle"),
                        value: "gradientCircle",
                      },
                      {
                        label: i18next.t("dotShapeTypeTriangle"),
                        value: "triangle",
                      },
                      {
                        label: i18next.t("dotShapeTypeDiamond"),
                        value: "diamond",
                      },
                    ],
                  },
                  {
                    name:"image-url",
                    alias: i18next.t("imageUrl"),
                    type: "file(format=image)",
                    default: "",
                    visible: (widget: Widget) => {
                      return widget.getOption("unified-dot-shape-type") == "image";
                    },
                  },
                  {
                    name: "unified-dot-size",
                    alias: i18next.t("unifiedDotSize"),
                    type: "number(unit=px, min=0)",
                    default: 5,
                  },
                  {
                    name: "unified-dot-shadowBlur",
                    alias: i18next.t("unified-dot-shadowBlur"),
                    type: "number(unit=px, min=0)",
                    default: 2,
                  },
                  {
                    name: "unified-dot-shadowColor",
                    alias: i18next.t("unified-dot-shadowColor"),
                    type: "color",
                    default: "#1c222a",
                  },
                  {
                    name: "unified-dot-shadowOffset",
                    alias: i18next.t("unified-dot-shadowOffset"),
                    type: "vector<X, Y>(unit=px)",
                    default: [0,0],
                  },
                  {
                    name: "unified-shape-size",
                    alias: i18next.t("unifiedShapeSize"),
                    type: "number(unit=px, min=0)",
                    default: 2,
                  },
                  ...this.getSeriesShapeBasicOptions(),
                  {
                    name: "series-shape-custom",
                    alias: i18next.t("seriesShapeCustom"),
                    type: "boolean",
                    default: false,
                  },
                  {
                    name: "flow-light-show",
                    alias:i18next.t("flow-light-show"),
                    type: "boolean",
                    default: false,
                  },
                  {
                    name: "series-shape-cluster",
                    cluster: "array",
                    alias: i18next.t("seriesShapeCluster"),
                    items: (widget: Line) => {
                      return widget.getSeries().map(({ alias }) => alias);
                    },
                    itemsHint: "数据字段",
                    visible: (widget: Widget) => {
                      return widget.getOption("series-shape-custom");
                    },
                    children: [
                      {
                        name: "series-shape-type",
                        alias: i18next.t("seriesShapeType"),
                        type: "select(radioGroup)",
                        default: "solid",
                        selectChoices: [
                          {
                            label: i18next.t("seriesShapeTypeSolid"),
                            value: "solid",
                          },
                          {
                            label: i18next.t("seriesShapeTypeDashed"),
                            value: "dashed",
                          },
                        ],
                        visible: (widget: Widget) => {
                          return widget.getOption("series-shape-custom");
                        },
                      },
                      {
                        name: "series-shape-smooth",
                        alias: i18next.t("seriesShapeSmooth"),
                        type: "boolean",
                        default: false,
                        visible: (widget: Widget) => {
                          return widget.getOption("series-shape-custom");
                        },
                      },
                      {
                        name: "series-dot-shape-type",
                        alias: i18next.t("seriesDotShapeType"),
                        type: "select",
                        default: "circle",
                        selectChoices: [
                          {
                            label: i18next.t("dotShapeTypeNone"),
                            value: "none",
                          },
                          {
                            label: i18next.t("dotShapeTypeImage"),
                            value: "image",
                          },
                          {
                            label: i18next.t("dotShapeTypeRect"),
                            value: "rect",
                          },
                          {
                            label: i18next.t("dotShapeTypeEmptyRect"),
                            value: "emptyRect",
                          },
                          {
                            label: i18next.t("dotShapeTypeRoundRect"),
                            value: "roundRect",
                          },
                          {
                            label: i18next.t("dotShapeTypeCircle"),
                            value: "circle",
                          },
                          {
                            label: i18next.t("dotShapeTypeEmptyCircle"),
                            value: "emptyCircle",
                          },
                          {
                            label: i18next.t("dotShapeTypeGradientCircle"),
                            value: "gradientCircle",
                          },
                          {
                            label: i18next.t("dotShapeTypeTriangle"),
                            value: "triangle",
                          },
                          {
                            label: i18next.t("dotShapeTypeDiamond"),
                            value: "diamond",
                          },
                        ],
                        visible: (widget: Widget) => {
                          return widget.getOption("series-shape-custom");
                        },
                      },
                      {
                        name: "series-image-url",
                        alias: i18next.t("imageUrl"),
                        type: "file(format=image)",
                        default: "",
                        visible: (widget: Widget , paths: string[]) => {
                          return widget.getOption([...paths,"series-dot-shape-type"]) == "image";
                        },
                      },
                      {
                        name: "series-dot-size",
                        alias: i18next.t("seriesDotSize"),
                        type: "number(unit=px)",
                        default: 5,
                        visible: (widget: Widget) => {
                          return widget.getOption("series-shape-custom");
                        },
                      },
                      {
                        name: "series-dot-shadowBlur",
                        alias: i18next.t("series-dot-shadowBlur"),
                        type: "number(unit=px, min=0)",
                        default: 2,
                      },
                      {
                        name: "series-dot-shadowColor",
                        alias: i18next.t("series-dot-shadowColor"),
                        type: "color",
                        default: "#1c222a",
                      },
                      {
                        name: "series-dot-shadowOffset",
                        alias: i18next.t("series-dot-shadowOffset"),
                        type: "vector<X, Y>(unit=px)",
                        default: [0,0],
                      },
                      {
                        name: "series-shape-size",
                        alias: i18next.t("seriesShapeSize"),
                        type: "number(unit=px)",
                        default: 2,
                        visible: (widget: Widget) => {
                          return widget.getOption("series-shape-custom");
                        },
                      },
                    ],
                  },
                  {
                    name: "flow-light-cluster",
                    cluster: "array",
                    alias:i18next.t("flow-light-cluster"),
                    items: (widget: Line) => {
                      return widget.getSeries().map(({ alias }) => alias);
                    },
                    itemsHint: "数据字段",
                    visible: (widget: Widget) => {
                      return widget.getOption("flow-light-show");
                    },
                    children:[
                      {
                        name: "flow-light",
                        alias: i18next.t("flow-light"),
                        tip:i18next.t("flow-light-show-tip"),
                        type: "boolean",
                        default: false,
                      },
                      {
                        name: "flow-light-select",
                        alias:i18next.t("flow-light-show"),
                        type: "boolean",
                        default: true,
                        visible:false
                      },
                      {
                        name: "flow-light-dot-shape-type",
                        alias: i18next.t("flow-light-dot-shape-type"),
                        type: "select",
                        selectChoices: [
                          {
                            label:  i18next.t("dotShapeTypeEmptyRect"),
                            value: "rect",
                          },
                          {
                            label: i18next.t("dotShapeTypeRoundRect"),
                            value: "roundRect",
                          },
                          {
                            label: i18next.t("dotShapeTypeCircle"),
                            value: "circle",
                          },
                          {
                            label: i18next.t("dotShapeTypeEmptyCircle"),
                            value: "emptyCircle",
                          },
                          {
                            label: i18next.t("dotShapeTypeTriangle"),
                            value: "triangle",
                          },
                          {
                            label: i18next.t("dotShapeTypeDiamond"),
                            value: "diamond",
                          },
                        ],
                        default: "circle",
                      },
                      {
                        name: "flow-light-color",
                        alias: i18next.t("flow-light-color"),
                        type: "color(gradient)",
                        default: "#FFFFFFFF",
                      },
                      {
                        name: "flow-light-size",
                        alias: i18next.t("flow-light-size"),
                        type: "number",
                        default: 8,
                      },
                      {
                        name: "flow-light-trailLength",
                        alias:i18next.t("flow-light-trailLength"),
                        tip:"该属性越大尾部轨迹越明显",
                        type: "number",
                        default: 10,
                      },
                      {
                        name: "flow-light-time",
                        alias: i18next.t("flow-light-time"),
                        type: "number",
                        default: 10,
                      }
                    ]
                  },
                ],
              }
            ]
          },
          tooltip: {
            children: [
              {
                name: "tooltip-format-cluster",
                children:[
                  {
                    name: "tooltip-left-axis-format-cluster",
                    alias: i18next.t("tooltipLeftAxisFormatCluster"),
                    fold: "unfold",
                    children: []
                  },
                  {
                    name: "tooltip-right-axis-format-cluster",
                    fold: "unfold",
                    visible: true,
                    children: []
                  }
                ]
              },
              {
                name: "cross-hairs-line-cluster",
                alias: i18next.t("crossHairsLineCluster"),
                show: "tab",
                children: [
                  {
                    name: "show-cross-hairs-y",
                    alias: i18next.t("showCrossHairsY"),
                    type: "boolean",
                    default: true
                  },
                  {
                    name: "show-cross-hairs-x",
                    alias: i18next.t("showCrossHairsX"),
                    type: "boolean",
                    default: false,
                    visible: (widget: Widget) => {
                      return widget.getOption("show-cross-hairs-y");
                    },
                  },
                  {
                    name: "cross-hairs-line-type",
                    alias: i18next.t("crossHairsLineType"),
                    type: "select(radioGroup)",
                    selectChoices: [
                      { label: i18next.t("crossHairsLineTypeSolid"), value: "solid" },
                      { label: i18next.t("crossHairsLineTypeDashed"), value: "dashed" },
                    ],
                    default: "dashed",
                    disabled: (widget: Widget) => {
                      return !widget.getOption("show-cross-hairs-y");
                    },
                  },
                  {
                    name: "cross-hairs-line-color",
                    alias: i18next.t("crossHairsLineColor"),
                    type: "color",
                    default: "#999",
                    disabled: (widget: Widget) => {
                      return !widget.getOption("show-cross-hairs-y");
                    },
                  },
                  {
                    name: "cross-hairs-line-width",
                    alias: i18next.t("crossHairsLineWidth"),
                    type: "number(unit=px, min=0)",
                    default: 1,
                    disabled: (widget: Widget) => {
                      return !widget.getOption("show-cross-hairs-y");
                    },
                  },
                  {
                    name: "show-cross-hairs-label",
                    alias: i18next.t("showCrossHairsLabel"),
                    type: "boolean",
                    default: false,
                    disabled: (widget: Widget) => {
                      return !widget.getOption("show-cross-hairs-y");
                    }
                  },
                  {
                    name: "cross-hairs-label-setting",
                    alias: i18next.t("crossHairsLabelSetting"),
                    show: "tab",
                    children: [
                      {
                        name: "cross-hairs-label-font",
                        alias: i18next.t("crossHairsLabelFont"),
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
                        name: "cross-hairs-label-background",
                        alias: i18next.t("crossHairsLabelBackground"),
                        type: "color",
                        default:"#505765",
                      },
                    ],
                    visible: (widget: Widget) => {
                      return widget.getOption("show-cross-hairs-label") &&  widget.getOption("show-cross-hairs-y");
                    },
                  }
                ],
              }
            ]
          },
          "axis": {
            visible: true,
            children: [
              {
                name: "y-display-cluster",
                children: [
                  {
                    name: "y-data-type",
                    selectChoices: [
                      {
                        value: "value",
                        label: i18next.t("value"),
                      },
                      {
                        value: "log",
                        label: i18next.t("log"),
                      },
                    ],
                  },
                  {
                    name: "y-label-cluster",
                    alias: i18next.t("xLabelCluster"),
                    children: [
                      {
                        name: "y-scope-optimization",
                        type: "boolean",
                        visible: (widget: Line) => {
                          return widget.getOption("y-data-type") === "value" && widget.getOption("y-scale-range") === "adaptive";
                        },
                      },
                    ]
                  },
                ]
              },
              {
                name: "y-polyline-display-cluster",
                children: [
                  {
                    name: "y-polyline-label-cluster",
                    alias: i18next.t("xLabelCluster"),
                    children: [
                      {
                        name: "y-polyline-scope-optimization",
                        type: "boolean",
                        visible: (widget: Line) => {
                          return widget.getOption("y-polyline-data-type") === "value"
                            && widget.getOption("y-polyline-scale-range") === "adaptive";
                        },
                      },
                    ]
                  }
                ],
                visible: true
              }
            ]
          },
          "animation-display": {
            visible: false,
            children: [
              {
                name: "label-emphasis-show",
                alias: i18next.t("labelEmphasis"),
                type: "boolean",
                default: false,
              }
            ]
          }
        },
      },
      ...super.defineOptions(),
    ];
  }


  override getMetaData() {
    return merge(super.getMetaData(), {
      axisValue: [
        ...this.axisX,
        ...this.axisY,
        ...this.axisLine,
        ...this.axisGroup,
      ]
    } as WidgetMetaData);
  }
  protected getDefaultPrivateData(): PrivateData {
    return {
      fields: [
        { uid: "f_name", alias: "分类", type: "string" },
        { uid: "f_value1", alias: "值1", type: "number" },
        { uid: "f_value2", alias: "值2", type: "number" },
        { uid: "f_value3", alias: "值3", type: "number" },
      ],
      rows: [
        { f_name: '示例1', f_value1: 1048, f_value2: 610, f_value3:500},
        { f_name: '示例2', f_value1: 735, f_value2: 285, f_value3:500},
        { f_name: '示例3', f_value1: 580, f_value2: 550, f_value3:500},
        { f_name: '示例4', f_value1: 1005, f_value2: 600, f_value3:500},
        { f_name: '示例5', f_value1: 700, f_value2: 650, f_value3:500},
      ],
    };
  }

  get boundaryGap() { // 两侧留白 会影响网格线对齐
    return this.getOption<boolean>("boundaryGap");
  }

  getSeriesSizes() {
    if (!this.getOption("series-shape-custom")) {
      let baseSize = this.getOption<number>("unified-shape-size");
        baseSize = baseSize !== undefined ?
            baseSize === 0 ? -1 : baseSize
          : 2;
      return [ baseSize ];
    }
    let lineSizes = [];
    let series = this.getSeries();
    const indexes = this.getArrayClusterIndexes(["series-shape-cluster"]);
    for (let i = 0; i < series.length; i++) {
      let size = this.getOption(["series-shape-cluster", indexes[i], "series-shape-size"]);
      size = size !== undefined ?
          size === 0 ? -1 : size
       : 2;
      lineSizes.push(size);
    }
    return lineSizes;
  }

  getSeriesPointSize(): number[] {
    if (!this.getOption("series-shape-custom")) {
      return [this.getOption("unified-dot-size")];
    }
    let pointSizes = [];
    let series = this.getSeries();
    const indexes = this.getArrayClusterIndexes(["series-shape-cluster"]);
    for (let i = 0; i < series.length; i++) {
      let size = this.getOption(["series-shape-cluster", indexes[i], "series-dot-size"]);
      pointSizes.push(size);
    }
    return pointSizes;
  }

  getSeriesItemStyle() {
    if (!this.getOption("series-shape-custom")) {
      let shadowBlur = this.getOption("unified-dot-shadowBlur");
      let shadowColor = this.toEchartsColor(this.getOption("unified-dot-shadowColor"));
      let shadowOffset = this.getOption("unified-dot-shadowOffset")
      return [{shadowBlur, shadowColor, shadowOffset}];
    }
    let itemStyle = [];
    let series = this.getSeries();
    const indexes = this.getArrayClusterIndexes(["series-shape-cluster"]);
    for (let i = 0; i < series.length; i++) {
      let shadowBlur = this.getOption(["series-shape-cluster", indexes[i], "series-dot-shadowBlur"]);
      let shadowColor = this.toEchartsColor(this.getOption(["series-shape-cluster", indexes[i], "series-dot-shadowColor"]));
      let shadowOffset = this.getOption(["series-shape-cluster", indexes[i], "series-dot-shadowOffset"]);
      itemStyle.push({shadowBlur,shadowColor,shadowOffset});
    }
    return itemStyle
  }



  getSeriesShapes() {
    if (!this.getOption("series-shape-custom")) {
      let lineType = this.getOption("unified-shape-type");
      let smooth = this.getOption("unified-shape-smooth");
      return [{lineType, smooth}];
    }
    let strShapes = [];
    let series = this.getSeries();
    const indexes = this.getArrayClusterIndexes(["series-shape-cluster"]);
    for (let i = 0; i < series.length; i++) {
      let lineType = this.getOption(["series-shape-cluster", indexes[i], "series-shape-type"]);
      let smooth = this.getOption(["series-shape-cluster", indexes[i], "series-shape-smooth"]);
      strShapes.push({lineType, smooth});
    }
    return strShapes;
  }

  getSeriesLines(){
    if(this.getOption("flow-light-cluster")){
      const indexes = this.getArrayClusterIndexes(["flow-light-cluster"]);
      let flowLightOpt = [];
      this.getSeries().forEach((item, index) => {
        let flowLightSize = this.getOption(["flow-light-cluster", indexes[index], "flow-light-size"]);
        let flowLightTrailLength = this.getOption<number>(["flow-light-cluster", indexes[index], "flow-light-trailLength"])*0.01;
        let flowLightDotShape = this.getOption<string>(["flow-light-cluster", indexes[index], "flow-light-dot-shape-type"]);
        let flowLightColor = this.toEchartsColor(this.getOption(["flow-light-cluster", indexes[index], "flow-light-color"]));
        let flowLightTime = this.getOption(["flow-light-cluster", indexes[index], "flow-light-time"]);
        let flowLightShow = this.getOption(["flow-light-cluster", indexes[index], "flow-light"]);
        let flowSelect = this.getOption(["flow-light-cluster", indexes[index], "flow-light-select"]);
        flowLightOpt.push({ flowLightSize, flowLightTrailLength, flowLightDotShape, flowLightColor, flowLightTime, flowLightShow,flowSelect })
      }
      );
      return flowLightOpt;
    } else {
      let flowLightSize = this.getOption("flow-light-size");
      let flowLightTrailLength = this.getOption<number>("flow-light-trailLength")*0.01;
      let flowLightDotShape = this.getOption<string>("flow-light-dot-shape-type");
      let flowLightColor = this.toEchartsColor(this.getOption("flow-light-color"));
      let flowLightTime = this.getOption("flow-light-time");
      let flowLightShow = this.getOption("flow-light");
      let flowSelect = this.getOption("flow-light-select");
      return [{ flowLightSize, flowLightTrailLength, flowLightDotShape, flowLightColor, flowLightTime, flowLightShow,flowSelect }];
    }
  }


  getSeriesPointShape(): string[] {
    if (this.getOption("series-shape-custom")) {
      const indexes = this.getArrayClusterIndexes(["series-shape-cluster"]);
      return this.getSeries().map((item, index) =>
        this.getOption([
          "series-shape-cluster",
          indexes[index],
          "series-dot-shape-type",
        ])
      );
    } else {
      return [this.getOption("unified-dot-shape-type")];
    }
  }

  getSeriesImageUrl(){
    if (this.getOption("series-shape-custom")) {
      const indexes = this.getArrayClusterIndexes(["series-shape-cluster"]);
      return this.getSeries().map((item, index) =>
        this.imageSrc(this.getOption([
          "series-shape-cluster",
          indexes[index],
          "series-image-url",
        ])||"")
      );
    } else {
      return [this.imageSrc(this.getOption("image-url") || "")];
    }
  }

  isAreaChart() {
    return false;
  }

  getSeriesAreaColors() {
    return [];
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

  checkErrorData() {
    let yDims = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let xDims = this.getOption<OptionFieldValue[]>("axis-x") || [];
    let lineDims = this.getOption<OptionFieldValue[]>("axis-line") || [];
    if (!xDims?.length || (!yDims?.length && !lineDims?.length)) {
      if (!xDims?.length && !yDims?.length && !lineDims?.length) {
        this.addErrorDataStatus("filed-empty");
      } else if (!xDims?.length || (!yDims?.length && !lineDims?.length)) {
        this.addErrorDataStatus("filed-incomplete");
      }
    } else {
      this.clearErrorDataStatus();
    }
  }

  get echartsSeriesOption(): SeriesOption | SeriesOption[] {
    if(this.xTypes) this.datasetSource();
    let yDims = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let xDims = this.getOption<OptionFieldValue[]>("axis-x") || [];
    let groupDims = this.getOption<OptionFieldValue[]>("axis-group") || [];
    let lineDims = this.getOption<OptionFieldValue[]>("axis-line") || [];
    let hasGroup = groupDims.length > 0;
    if (!xDims?.length || (!yDims?.length && !lineDims?.length)) {
      let seriesOption: SeriesOption = {
        name: "value",
        id: "demo-line",
        type: "line",
        stack: this.stack?'total':'',
        encode: {
          x: "name",
          y: "value",
        },
        xAxisIndex: 0,
        yAxisIndex: 0,
        silent: true,
        // animation: false
      };
      if(this.isAreaChart()){
        seriesOption["areaStyle"] = {
          color: "#1890FF33"
        }
      }
      return seriesOption;
    } else {
      let seriesOpt = [];
      let seriesColor = this.getSeriesColors();
      let seriesAreaColor = this.getSeriesAreaColors();
      let shapeCustom = this.getOption("series-shape-custom");
      let lineShapes = this.getSeriesShapes();
      let symbolShapes = this.getSeriesPointShape();
      let symbolSizes = this.getSeriesPointSize();
      let symbolImage = this.getSeriesImageUrl();
      let symbolItems = this.getSeriesItemStyle();
      let lineSizes = this.getSeriesSizes();
      let labelFont = this.getOption<OptionFontValue>("label-font");
      let isPercent = this.getOption("label-text-type") === "percent";
      let labelDecimalPlaces = this.getOption<number>("label-decimal-places");
      let isComplete = this.getOption<boolean>("label-complete-zero");
      let colorFollow = this.getOption("label-color-type") === "follow";
      let unitFont = this.getOption<OptionFontValue>("label-unit-font");
      let valueLineNum = yDims?.length + lineDims?.length;
      let xTypeLineNum = this.xTypes?.length || 1;
      let getSeriesFlowlightOpt = this.getSeriesLines();
      let dataSource = this.datasetSource();
      let flowLightCluster = this.getOption("flow-light-show");
      let labelOffset = this.getOption("label-text-offset");
      let labelFollowGraph = this.getOption("label-follow-graph")
      let seriesIndex = 0;
      const valueDims = (xTypeLineNum === 1 ? [...yDims] : [yDims[0]]).filter(it=>it !== void 0).concat([...lineDims]);
      for(let valueLineIndex = 0; valueLineIndex < valueDims.length; valueLineIndex++){
        let currentDims = yDims;
        let currentLineIndex = valueLineIndex;
        if(xTypeLineNum === 1){
          if(valueLineIndex >= yDims.length){
            currentDims = lineDims;
            currentLineIndex = valueLineIndex - yDims.length;
          }
        } else if(!yDims?.length || valueLineIndex >= 1) {
          currentDims = lineDims;
          currentLineIndex = valueLineIndex - (yDims?.length ? 1 : 0);
        }
        for(let xLineIndex = 0; xLineIndex < xTypeLineNum; xLineIndex++){
          let name = this.xTypes?.[xLineIndex] || this.getFieldAlias(currentDims[currentLineIndex]?.uid);
          let symbol = shapeCustom ? symbolShapes[seriesIndex] : symbolShapes[0];
          let symbolItem = shapeCustom ? symbolItems[seriesIndex] : symbolItems[0];
          let encode = {}
          if (currentDims[0].uid[2] === xDims[0].uid[2]) {
            encode = {
              x: xDims[0].uid[2],
              y: hasGroup ? `${currentDims[0].uid[2]}_${name}_count` : `${currentDims[0].uid[2]}_count`
            }
          } else {
            encode = {
              x: xDims[0].uid[2],
              y: hasGroup ? `${currentDims[0].uid[2]}_${name}` : currentDims[currentLineIndex].uid[2],
            }
          }
          // 折线点图片
          if(symbol == "image"){
              let url = shapeCustom?symbolImage[seriesIndex]:symbolImage[0];
              url?symbol = `image://${url}` : symbol = "none";
          }
          let symbolSize = shapeCustom ? symbolSizes[seriesIndex] : symbolSizes[0];
          if (symbol === "gradientCircle") {
            symbol = 'circle'
            symbolSize = symbolSize / 2;
            let symbolLineOption = {
              name,
              type:"line",
              id: `${hasGroup ? `${currentDims[0].uid[2]}_${name}_gradient` : currentDims[currentLineIndex].uid[2]}-${valueLineIndex}-line-${xLineIndex}-gradient`,
              connectNulls: true,
              color: seriesColor[seriesIndex],
              lineStyle: {
                opacity: 0
              },
              encode,
              xAxisIndex: 0,
              yAxisIndex: valueLineIndex >= yDims.length ? 1 : 0,
              silent: false,
              selectedMode: 'single',
              itemStyle: {
                opacity: 0.5,
                shadowBlur:symbolItem.shadowBlur,
                shadowColor:symbolItem.shadowColor,
                shadowOffsetX:symbolItem.shadowOffset[0],
                shadowOffsetY:symbolItem.shadowOffset[1],
              },
              symbol: "circle",
              symbolSize: symbolSize * 2,
              showAllSymbol:true
            }
            seriesOpt.push(symbolLineOption);
          }
          let fontColor = this.toEchartsColor(labelFont.color as Color);
          if(colorFollow) {
            if(typeof seriesColor[seriesIndex] === "string") {
              fontColor = seriesColor[seriesIndex];
            } else {
              fontColor = seriesColor[seriesIndex]?.colorStops?.[0]?.color || "#ffffff";
            }
          }
          const lineShadowOffset = this.getOption("series-shape-shadow-offset");
          let seriesOption = {
            name,
            id: `${hasGroup ? `${currentDims[0].uid[2]}_${name}` : currentDims[currentLineIndex].uid[2]}-${valueLineIndex}-line-${xLineIndex}`,
            type: "line",
            connectNulls: true,
            encode,
            color: seriesColor[seriesIndex],
            stack: this.stack?'total':'',
            xAxisIndex: 0,
            yAxisIndex: valueLineIndex >= yDims.length ? 1 : 0,
            silent: false,
            selectedMode: 'single',
            symbol: symbol,
            symbolSize: symbolSize,
            showAllSymbol:true,
            markLine: this.markLineOption,
            smooth: shapeCustom ? lineShapes[seriesIndex].smooth : lineShapes[0].smooth,
            lineStyle: {
              type: shapeCustom ? lineShapes[seriesIndex].lineType : lineShapes[0].lineType,
              shadowColor: this.toEchartsColor(this.getOption("series-shape-shadow-color")),
              shadowBlur: this.getOption("series-shape-shadow-blur"),
              shadowOffsetX: lineShadowOffset[0],
              shadowOffsetY: lineShadowOffset[1],
              width: shapeCustom ? lineSizes[seriesIndex] : lineSizes[0],
            },
            itemStyle: {
              shadowBlur:symbolItem.shadowBlur,
              shadowColor:symbolItem.shadowColor,
              shadowOffsetX:symbolItem.shadowOffset[0],
              shadowOffsetY:symbolItem.shadowOffset[1],
            },
            label: {
              show: this.getOption("label"),
              position: "top",
              offset: [labelOffset[0], -labelOffset[1]],
              rotate: this.getOption<number>("label-tilt") % 360 || 0,
              formatter: (param) => {
                let unit = this.getOption<string>("label-unit-value");
                let val =  param.value[param.dimensionNames[param.encode.y[0]]];
                if (!isPercent) {
                  val = formatFloat(val, labelDecimalPlaces, isComplete);
                } else {
                  val = formatFloat(val * 100, labelDecimalPlaces, isComplete) + "%";
                }
                return `{value|${val}}{unit|${unit}}`;
              },
              rich: {
                value: {
                  color:labelFollowGraph ? seriesColor[seriesIndex] : fontColor,
                  fontWeight: labelFont.bold ? "bold" : "normal",
                  fontStyle: labelFont.italic ? "italic" : "normal",
                  fontSize: labelFont.size,
                  fontFamily: labelFont.family,
                },
                unit: {
                  color: unitFont.color || "#ffffff",
                  fontWeight: unitFont.bold ? "bold" : "normal",
                  fontStyle: unitFont.italic ? "italic" : "normal",
                  fontSize: unitFont.size,
                  fontFamily: unitFont.family,
                }
              }
            },
            blur: {
              label: {
                show: false
              }
            },
            emphasis: {
              label: {
                show: this.getOption("label") || this.getOption("label-emphasis-show")
              }
            }
          }
          if(this.isAreaChart()){
            seriesOption["areaStyle"] = {
              color: seriesAreaColor[seriesIndex]
            }
          }

          // 折线图排序文本
          if (this.getOption("ranking-text")) {
            const handleCustomLabelOffset = (text, font = 'normal 12px sans-serif') => {
              let _canvas = document.createElement('canvas');
              const _context = _canvas.getContext('2d');
              _context.font = font;
              let fontWidth = _context.measureText(text);
              _canvas.remove();
              return fontWidth;
            }

            let rankingTextFont = this.getOption<OptionFontValue>("ranking-text-font");
            let fontSize = rankingTextFont.size;
            let fontColor = this.toEchartsColor(rankingTextFont.color as Color);
            let fontFamily = rankingTextFont.family;
            let fontStyle = rankingTextFont.italic;
            let fontWeight = rankingTextFont.bold;
            let distance = this.getOption<number>("ranking-text-distance");
            let rankingTextTemplate = this.getOption<string>("ranking-text-template");
            let templateStrArr = [];
            let showTextType = this.getOption("show-text-type");
            let showTextNumber = this.getOption<number>("ranking-text-show-number");
            let textFommaterType = this.getOption("ranking-text-fommater-type");
            let backgroundColor = this.toEchartsColor(this.getOption<Color>("ranking-text-background-color"))
            let backgroundWidth = this.getOption<number>("ranking-text-background-width");
            let backgroundHeight = this.getOption<number>("ranking-text-background-height");
            let backgroundType = this.getOption<string>("ranking-text-background")
            let backgroundShapeType = this.getOption("ranking-text-background-shape-type")
            let backgroundImageUrl = this.rankingBackgroundImageSrc

            if (rankingTextTemplate.replace("{}", "#") !== rankingTextTemplate) {
              let tempStr = rankingTextTemplate.replace("{}", "#");
              templateStrArr = tempStr.split("#");
            } else {
              templateStrArr.push(rankingTextTemplate);
            }
            const sortType = this.getOption("sort-type");
            const sortUid = this.getOption<string>("sort-object");
            let valuse = this.datasetSource().map(item => {
              if(sortType == "normal" || ["toChoose", "sumVal"].includes(sortUid)) return item.sumVal;
              return isNaN(item[sortUid]) ? 0 : item[sortUid];
            })
            let sumMax = Math.max(...valuse);
            let sumMin = Math.min(...valuse);
            valuse.sort((a, b) => {
              return b - a;
            })

            let sortTextOption = {
              name: 'rankingText__$',
              type: 'custom',
              z: 2,
              encode,
              silent: true,
              renderItem: (params, api) => {
                let categoryIndex = api.value(params.encode.x);
                let yUid = hasGroup ? yDims[0].uid[2] : yDims[currentLineIndex].uid[2];
                let yValue = api.value(yUid);
                const dataRaw = this.datasetSource()[categoryIndex];
                let currentSumValue = (sortType == "normal" || ["toChoose", "sumVal"].includes(sortUid)) ? dataRaw.sumVal : dataRaw[sortUid];
                // 根据数据获取坐标信息
                let start = this.transposed ? api.coord([yValue, categoryIndex]) : api.coord([categoryIndex, yValue]);
                let max = this.transposed ? (this.echartsChart as any).getModel().getComponent('xAxis').axis.scale._extent[1] : (this.echartsChart as any).getModel().getComponent('yAxis').axis.scale._extent[1];
                let maxCoord: number = this.transposed ? api.coord([max, 0])[0] : api.coord([0, max])[1];
                let rankValue = valuse.indexOf(currentSumValue) + 1;
                let rankingStr = rankingTextTemplate.replace("{}", (valuse.indexOf(currentSumValue) + 1).toString());

                if(textFommaterType == "text-template"){
                  rankingStr = rankingTextTemplate.replace("{}", (valuse.indexOf(currentSumValue) + 1).toString())
                }else{
                  rankValue = currentSumValue;
                  rankingStr = rankingTextTemplate.replace("{}", currentSumValue.toString())
                }

                let textWidth = handleCustomLabelOffset(rankingStr, `${fontStyle ? "italic" : "normal"} ${fontSize}px ${fontFamily}`).width;
                let textHeight = handleCustomLabelOffset(rankingStr[0], `${fontStyle ? "italic" : "normal"} ${fontSize}px ${fontFamily}`).width;
                let isShowText = true;
                if (showTextType !== "all") {
                  if (showTextType == "max" && (currentSumValue !== sumMax)) {
                    isShowText = false;
                  } else if (showTextType == "min" && (currentSumValue !== sumMin)) {
                    isShowText = false;
                  } else if (showTextType == "max-and-min") {
                    if (currentSumValue !== sumMax && currentSumValue !== sumMin) {
                      isShowText = false;
                    }
                  } else if (showTextType == "custom" && valuse.indexOf(currentSumValue) + 1 > showTextNumber) {
                    isShowText = false;
                  }
                }

                let textCustomObj = {
                  type: 'text',
                  x: this.transposed ? (maxCoord + distance + textWidth / 2) : start[0],
                  y: this.transposed ? start[1] : maxCoord - distance,
                  emphasisDisabled: true,
                  style: {
                    text: (isNaN(rankValue) || !rankValue) ? "" : rankingStr,
                    fill: fontColor,
                    z: 100,
                    textAlign: this.transposed ?'right':'center',
                    textVerticalAlign: 'middle',
                    font: `${fontStyle ? "italic" : ""}  ${fontWeight ? "bolder" : ""} ${fontSize}px ${fontFamily}`,
                    opacity: isShowText ? 1 : 0
                  },
                  silent: true,
                  z2:52
                };
                // 绘制背景
                if (backgroundType == "shape") {
                  let rectX = this.transposed ? (maxCoord + distance) - backgroundWidth/2 : start[0] - backgroundWidth / 2;
                  let rectY = this.transposed ? start[1] - backgroundHeight/2: maxCoord - distance - backgroundHeight / 2;
                  textCustomObj.x = rectX - textWidth / 2 + backgroundWidth / 2;
                  textCustomObj.y = rectY - textHeight / 2 + backgroundHeight / 2;

                  let textCustomBackgroundObj = {
                    type: 'rect',
                    emphasisDisabled: true,
                    shape: {
                      x: rectX,
                      y: rectY,
                      width: backgroundWidth,
                      height: backgroundHeight
                    },
                    style: {
                      fill: backgroundColor,
                      opacity: isShowText ? 1 : 0
                    },
                    transition: ["shape"],
                    textContent: textCustomObj
                  }
                  if (backgroundShapeType == "down-arrow-rect") {
                    let width = 5;
                    let height = 5;
                    let bottomTriangle = {
                      type: 'polygon',
                      shape: {
                        points: this.transposed ?
                        [[maxCoord -  backgroundWidth/2 + distance -5 , start[1] ],
                        [maxCoord + distance - backgroundWidth/2, start[1]  - height],
                        [maxCoord + distance - backgroundWidth/2 , start[1]  + height],
                        [maxCoord -  backgroundWidth/2 + distance -5 , start[1] ]
                        ] : [[start[0], maxCoord - distance + backgroundHeight/2 + height],
                        [start[0] - width, maxCoord - distance + backgroundHeight/2],
                        [start[0] + width, maxCoord - distance + backgroundHeight/2],
                        [start[0], maxCoord - distance + backgroundHeight/2 + height]
                        ],
                      },
                      emphasisDisabled: true,
                      style: {
                        fill: backgroundColor,
                        opacity: isShowText ? 1 : 0
                      },
                      transition: ["shape"],
                      z2: 49
                    }
                    return {
                      type: "group",
                      children: [textCustomBackgroundObj, bottomTriangle],
                    }
                  }
                  return textCustomBackgroundObj;
                }else{
                  let imgX = this.transposed ? (maxCoord + distance) - backgroundWidth/2 : start[0] - backgroundWidth / 2;
                  let imgY = this.transposed ? start[1] - backgroundHeight/2: maxCoord - distance - backgroundHeight / 2;
                  textCustomObj.x = imgX - textWidth / 2 + backgroundWidth / 2;
                  textCustomObj.y = imgY - textHeight / 2 + backgroundHeight / 2;
                  return {
                    type: 'image',
                    style: {
                      image:backgroundImageUrl,
                      x: imgX,
                      y: imgY,
                      width: backgroundWidth,
                      height: backgroundHeight,
                      emphasisDisabled: true,
                      opacity: isShowText ? 1 : 0
                    },
                    transition: ["shape"],
                    textContent: textCustomObj,
                  }
                }
              }
            }
            seriesOpt.push(sortTextOption);
          }

          seriesOpt.push(seriesOption);
          seriesIndex++;
        }
        let flowLightOption = flowLightCluster ? getSeriesFlowlightOpt[valueLineIndex] : getSeriesFlowlightOpt[0];
        let name = this.xTypes?.[valueLineIndex] || this.getFieldAlias(currentDims[currentLineIndex]?.uid)
        if (flowLightOption?.flowLightShow && flowLightCluster && dataSource.length && this.getBoard().status?.isVisible && flowLightOption?.flowSelect) {
          let coords = [];
          let showLight =  shapeCustom ? lineShapes[currentLineIndex].smooth : lineShapes[0].smooth;
          dataSource.forEach(item => {
            let xUid = xDims[0].uid[2]
            let yUid = this.xTypes?.length != 0 ? `${currentDims[0].uid[2]}_${name}` : currentDims[currentLineIndex].uid[2]
            coords.push([item[xUid],item[yUid]])
          })
          let flowLightObj = {
            name,
            id: `${this.xTypes.length != 0 ? `${currentDims[0].uid[2]}_${name}` : currentDims[currentLineIndex].uid[2]}-line-${currentLineIndex}-flowLight`,
            coordinateSystem: 'cartesian2d',
            type: "lines",
            z:90,
            zlevel:20,
            connectNulls: true,
            xAxisIndex: 0,
            yAxisIndex: valueLineIndex >= yDims.length ? 1 : 0,
            silent: true,
            polyline: true,
            smooth: shapeCustom ? lineShapes[currentLineIndex].smooth : lineShapes[0].smooth,
            lineStyle: {
              opacity:0,
            },
            emphasis:{
              disabled:false
            },
            clip:false,
            large:true,
            largeThreshold:1000,
            effect: {
              show: flowLightOption.flowLightShow && flowLightOption.flowSelect && flowLightCluster && !showLight, //是否展示
              period: flowLightOption.flowLightTime, //时间
              trailLength: flowLightOption.flowLightTrailLength, //尾部长度
              symbolSize: flowLightOption.flowLightSize, //点大小
              symbol: flowLightOption.flowLightDotShape, //点的类型
              color: flowLightOption.flowLightColor, //颜色
            },
            animation:false,
            data: [
              {
                coords
              }
            ]
          };
          seriesOpt.push(flowLightObj);
        }
      }
      return seriesOpt;
    }
  }

  get tooltipAxisPointer():TooltipComponentOption["axisPointer"] {
    let xCrossHairs = this.getOption("show-cross-hairs-x");
    let yCrossHairs = this.getOption("show-cross-hairs-y")
    let lineColor = new Color(this.getOption("cross-hairs-line-color")).toEchartsColor();
    let lineWidth = this.getOption<number>("cross-hairs-line-width");
    let labelFont = this.getOption<OptionFontValue>("cross-hairs-label-font");
    let fontColor = this.toEchartsColor(labelFont.color as Color);
    let fontBackgroundColor = this.toEchartsColor(this.getOption("cross-hairs-label-background"))

    let axisPointerType
    if (yCrossHairs) {
      axisPointerType = xCrossHairs ? "cross" : "line";
    } else {
      axisPointerType = "none";
    }

    return {
      show: true,
      type: axisPointerType,
      lineStyle: {
        color: lineColor,
        width: lineWidth,
        type: this.getOption("cross-hairs-line-type")
      },
      crossStyle: {
        color: lineColor,
        width: lineWidth,
        type: this.getOption("cross-hairs-line-type")
      },
      label: {
        show: this.getOption("show-cross-hairs-label") && axisPointerType !== "none",
        color: fontColor,
        fontWeight: labelFont.bold ? "bold" : "normal",
        fontStyle: labelFont.italic ? "italic" : "normal",
        fontSize: labelFont.size,
        fontFamily: labelFont.family,
        backgroundColor: fontBackgroundColor
      }
    };
  }
  getLegendOtherOption() {
    let xDims = this.getOption<OptionFieldValue[]>("axis-x") || [];
    let yDims = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let groupDims = this.getOption<OptionFieldValue[]>("axis-group") || [];
    let legendIcon = this.getOption<string>("legend-icon");
    let legendLimit = this.getOption<number>("legend-text-limit");
    let lineDims = this.getOption<OptionFieldValue[]>("axis-line") || [];
    let colors = this.getSeriesColors();
    let hasGroup = groupDims.length > 0;
    let lineNum = hasGroup ? this.xTypes.length : yDims.length;
    let data = [];
    if (!xDims.length) return {}

    if (yDims?.length) {
      for (let i = 0; i < lineNum; i++) {
        let color = colors[i];
        if(typeof color !== "string") {
          color = colors[i]?.[0] || color?.colorStops?.[0]?.color || colors[0]?.[0];
        }
        let opt = { name: hasGroup ? this.xTypes[i] : this.getFieldAlias(yDims[i].uid), itemStyle: { color: color, opacity: 1} };
        if (legendIcon !== "default") {
          opt['icon'] = legendIcon;
        }
        data.push(opt);
      }
    }

    lineDims?.forEach((dim, index) => {
      let color = colors[lineNum + index];
      if(typeof color !== "string") {
        color = colors[lineNum + index]?.[0] || color?.colorStops?.[0]?.color || colors[0]?.[0];
      }
      let opt = { name: this.getFieldAlias(dim?.uid), itemStyle: { color: colors?.[lineNum + index] } };
      if (legendIcon !== "default") {
        opt['icon'] = legendIcon;
      }
      data.push(opt);
    })

    return {
      formatter: (name) => {
        let processedName = name?.split('__$')[0] || name;
        if(processedName.length > legendLimit) {
          return processedName.slice(0, legendLimit) + "...";
        } else {
          return processedName;
        }
      },
      data: data?.length ? data : undefined
    }
  }

  initEchartsEvents(): void {
    const state: ChartClickState = {
      lastseriesIndex: -1,
      lastDataIndex: -1
    };

    this.echartsChart.off("click");
    this.echartsChart.on('click', (params) => {
      const chartOption = this.echartsChart.getOption();
      const currentSeries = chartOption.series[params.seriesIndex];
      if (currentSeries.selectedMap[params.name]) {
        this.selectedIndex.value = params.dataIndex;
      } else {
        this.selectedIndex.value = -1;
        state.lastDataIndex = params.dataIndex;
        state.lastseriesIndex = params.seriesIndex;
      }

      this.processClick(params, state);

    })
  }
}
