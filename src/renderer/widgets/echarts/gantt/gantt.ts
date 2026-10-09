import { OptionFieldUID, PrivateData, PrivateDataConnectionUID, PrivateDataTableUID } from "@common/types/project";
import { DefinedOptions, OptionFontValue, OptionFileValue, OptionFieldValue, ClusterEntry, WidgetMetaData, ChartClickState } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { formatFloat } from "@common/utils/math";
import { TheWidget as Axis, component as B2Axis } from "@renderer/widgets/echarts/axis";
import { graphic, TooltipComponentOption, XAXisComponentOption, YAXisComponentOption, SeriesOption, EChartsOption, } from "echarts/dist/echarts";
import i18next from "@renderer/widgets/i18next";
import { Ref, ref, watch } from 'vue';
import resource from "./locales";
import { merge, recursive } from "merge";

export class Gantt extends Axis {
  public MouseWheel: any = ref(true)
  public MouseWheels: any = ref(false)
  static resource:any = recursive(true, Axis.resource, resource);
  static defineOptions(): DefinedOptions[] {
  const UNIT_GE = i18next.t("unitGe");
  return [
      {
        data: {
          fields: {
            alias: i18next.t("fieldsSetting"),
            fold: "unfold",
            children: [
              {
                name: "axis-x",
                alias: i18next.t("axisX"),
                visible: false,
              },
              {
                name: "axis-y",
                alias: i18next.t("axisY"),
                visible: false,
              },
              {
                name: "axis-name",
                alias: i18next.t("axisName"),
                type: "field(recommend=string)",
                default: [
                  {
                    "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "sample_name"],
                    "__opt_type": "field",
                    "summary": ""
                  }
                ]
              },
              {
                name: "axis-start",
                alias: i18next.t("axisStart"),
                type: "field",
                default: [
                  {
                    "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "sample_startTime"],
                    "__opt_type": "field",
                    "summary": ""
                  }
                ]
              },
              {
                name: "axis-end",
                alias: i18next.t("axisEnd"),
                type: "field",
                visible: true,
                default: [
                  {
                    "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "sample_endTime"],
                    "__opt_type": "field",
                    "summary": ""
                  }
                ]
              },
              {
                name: "axis-value",
                alias: i18next.t("axisValue"),
                type: "field",
                default: [
                  {
                    "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "sample_value"],
                    "__opt_type": "field",
                    "summary": ""
                  }
                ]
              },
            ],
          },
          sort: {
            visible: false
          }
        },
        style: {
          basic: {
            children: [
              {
                name:"gantt-select-height",
                alias: i18next.t("ganttSelectHeight"),
                type:"select",
                selectChoices:[
                  {
                    label: i18next.t("ganttSelectHeight0"),
                    value:"0"
                  },
                  {
                    label: i18next.t("ganttSelectHeight1"),
                    value:"1"
                  }
                ],
                default:"0"
              },
              {
                name:"gantt-height",
                alias: i18next.t("ganttHeight"),
                type:"number(unit=px)",
                default:100,
                visible:((gantt:Gantt)=>{
                  return gantt.getOption("gantt-select-height") === "1"
                })
              }
            ]
          },
          "series-color-group": {
            alias: i18next.t("seriesColorGroup"),
            // fold: "disable",
            visible: true,
            children: [
              {
                name: "series-color-cluster",
                cluster: 'array',
                alias: i18next.t("seriesColorCluster"),
                items: (gantt: Gantt) => {
                  return gantt.getNames.map(({ alias }) => alias);
                },
                children: [
                  {
                    name: "series-color",
                    alias: i18next.t("seriesColor"),
                    visible: false
                  },
                  {
                    name: "finish-color",
                    alias: i18next.t("finishColor"),
                    type: "color(gradient)",
                    default: "#dbdbdb",
                  },
                  {
                    name: "plan-color",
                    type: "color(gradient)",
                    alias: i18next.t("planColor"),
                    default: "#6da752",
                  },
                ]
              },
            ]
          },
          "series-color": {
            alias: i18next.t("seriesColor"),
            visible: false,
            children: [
              {
                alias: i18next.t("palette"),
                name: "palette",
                type: "palette(gradient)",
                visible: false,
              },
            ]
          },
          "series-shape": {
            visible: false,
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
                        alias: i18next.t("labelPosition"),
                        default: "inside",
                        type: "select(radioGroup)",
                        selectChoices: [
                          {
                            label: i18next.t("labelPositionInside"),
                            value: "inside",
                          },
                          {
                            label: i18next.t("labelPositionOutside"),
                            value: "outside",
                          },
                        ],
                      },
                      {
                        name: "label-shape-spacing",
                        alias: i18next.t("labelShapeSpacing"),
                        default: 10,
                        type: "number(unit=px)",
                        visible: (widget: Gantt) => {
                          return widget.getOption("label-position") !== "inside";
                        },
                      },
                      {
                        name: "hide-zero-value",
                        alias: i18next.t("hideZeroValue"),
                        default: false,
                        type: "boolean",
                      },
                    ]
                  },
                ],
              }
            ]
          },
          tooltip: {
            children: [
              {
                name: "tooltip-unit-setName",
                visible: false,
              },
              {
                name: "tooltip-format-cluster",
                children:[
                  {
                    name: "tooltip-right-axis-format-cluster",
                    children:[
                      {
                        name: "tooltip-right-decimal-places",
                        default: 2,
                      },
                    ]
                  }
                ]
              }
            ],
          },
          "axis": {
            children: [
              {
                name: "x-display-cluster",
                children: [
                  {
                    name: "x-data-type",
                    visible: false,
                  },
                  {
                    name: "x-data-cluster",
                    alias: i18next.t("xDataCluster"),
                    children: [
                      {
                        name: "x-data-interval",
                        alias: i18next.t("xDataInterval"),
                        type: "select",
                        default: "1",
                        selectChoices: [
                          {
                            label: i18next.t("xDataInterval1"),
                            value: "1"
                          },
                          {
                            label: i18next.t("xDataInterval8"),
                            value: "8"
                          },
                          {
                            label: i18next.t("xDataInterval30"),
                            value: "30"
                          },
                        ]
                      },
                      {
                        name: "x-start",
                        alias: i18next.t("xStart"),
                        type: "number(unit=" + UNIT_GE + ")",
                        default: 5,
                        // visible: (widget: Gantt) => {
                        //   return widget.getOption("x-roll");
                        // },
                      },
                      {
                        name: "x-roll",
                        alias: i18next.t("xRoll"),
                        type: "boolean",
                        default: false,
                      },
                    ]
                  },
                  {
                    name: "x-unit-cluster",
                    visible: false,
                    children: []
                  }
                ]
              },
              {
                name: "y-display-cluster",
                children: [
                  {
                    name: "y-data-type",
                    visible: false,
                  },
                  {
                    name: "y-tickline-cluster",
                    children: [
                      {
                        name: "y-tick-interval",
                        alias: i18next.t("yTickInterval"),
                        type: "number(min=0, step=1, unit=px)",
                        default: 0,
                      },
                    ]
                  },
                  {
                    name: "y-label-cluster",
                    children: [
                      {
                        name: "y-label-interval",
                        alias: i18next.t("yLabelInterval"),
                        type: "number(min=0, step=1, unit=px)",
                        default: 0,
                      },
                      {
                        name: "y-text-type",
                        visible: false,
                      },
                      {
                        name: "y-decimal-places",
                        visible: false,
                      },
                      {
                        name: "y-complete-zero",
                        visible: false,
                      },
                      {
                        name: "y-scale-range",
                        visible: false,
                      },
                    ],
                  },
                  {
                    name: "y-unit-cluster",
                    visible: false,
                    children: []
                  },
                  {
                    name: "y-data-cluster",
                    alias: i18next.t("xDataCluster"),
                    children: [
                      {
                        name: "y-start",
                        alias: i18next.t("yStart"),
                        type: "number(unit=" + UNIT_GE + ")",
                        default: 3,
                        // visible: (widget: Gantt) => {
                        //   return widget.getOption("y-roll");
                        // },
                      },
                      {
                        name: "y-roll",
                        alias: i18next.t("yRoll"),
                        type: "boolean",
                        default: false,
                      },
                    ]
                  }

                ]
              }
            ]
          },
          "annotation-line": {
            alias: i18next.t("annotationLine"),
            type: "boolean",
            default: false,
            visible: false,
            children: [
              {
                name: "annotation-line-value",
                alias: i18next.t("annotationLineValue"),
                // default: 0,
                type: "date",
              },
            ],
          },
          sort: {
            alias: i18next.t("sort"),
            visible: false,
          },
          "animation-display": {
            visible: false,
            children: [
              {
                name: "animation-display",
                alias: i18next.t("animationDisplay"),
                type: "boolean",
                default: false,
              },
            ]
          }
        },
      },
      ...super.defineOptions(),
    ];
  }

  _datasetSource(): any[] {
    let source = this.createView(["axis-name", "axis-start", "axis-end", "axis-value"]);
    if (this.axisName[0]?.uid?.[2]?.split(".")?.length > 1
      && this.axisStart[0]?.uid?.[2]?.split(".")?.length > 1
      && this.axisEnd[0]?.uid?.[2]?.split(".")?.length > 1
      && this.axisValue[0]?.uid?.[2]?.split(".")?.length > 1
    ) {
      source = this.flatDataset(source, [...([...this.axisName, ...this.axisStart, ...this.axisEnd, ...this.axisValue].map(dim => dim.uid[2]))]);
    }
    return this.getDataAfterSort(source);
  }

  get getNames() {
    let nameDimensions = this.getOption<OptionFieldValue[]>("axis-name") || [];
    let names: ClusterEntry[] = [];
    if (nameDimensions.length > 0) {
      let nameUid = nameDimensions[0].uid[2];
      let dataView = this.datasetSource();
      for (let i = 0; i < dataView.length; i++) {
        names.push({
          name: dataView[i],
          alias: dataView[i][nameUid].replace(/^_/, ''),
        });
      }
    }
    return names;
  }

  get getSeriesColor() {
    let seriesColors = [];
    let series = this.getNames;
    const indexes = this.getArrayClusterIndexes(["series-color-cluster"]);
    if (series.length < 1) {
      let dataView = this.datasetSource();
      series = dataView;
    }
    for (let i = 0; i < series.length; i++) {
      let ganttColors = {};
      let ganttGroup = ["plan", "finish"];
      for (let j = 0; j < ganttGroup.length; j++) {
        let colorInfo: any = {};
        colorInfo.color = this.getOption(["series-color-cluster", indexes[i], ganttGroup[j] + "-color"]) || undefined;
        colorInfo.color = this.toEchartsColor(colorInfo.color);
        ganttColors[ganttGroup[j]] = colorInfo;
      }
      seriesColors.push(ganttColors);

    }
    return seriesColors;
  }

  get echartsXAxisOption(): XAXisComponentOption | XAXisComponentOption[] {
    let showXAxis = this.getOption<boolean>("x-display");
    let axisLabelFont = this.getOption<OptionFontValue>("x-font");
    let dataIntervale = Number(this.getOption<string>("x-data-interval"));
    return [{
      show: showXAxis,
      // boundaryGap: this.boundaryGap,
      type: 'time',
      axisLine: {
        //轴线
        show: this.getOption("x-line"),
        lineStyle: {
          color: this.toEchartsColor(this.getOption("x-line-color")),
          width: Math.max(this.getOption("x-line-width"), 0),
          type: this.getOption("x-line-type"),
        },
      },
      min: (value) => {
        return value.min
      },
      max: (value) => {
        return value.max
      },
      maxInterval: 3600 * 24 * 1000 * dataIntervale,
      minInterval: 3600 * 24 * 1000 * dataIntervale,
      axisTick: {
        interval: 0,
        alignWithLabel: true,
        show: this.getOption("x-tickline"),
        length: this.getOption("x-tickline-length"),
        lineStyle: {
          width: this.getOption("x-tickline-width"),
          color: this.toEchartsColor(this.getOption("x-tickline-color")),
        },
      },
      axisLabel: {
        show: this.getOption("x-label"),
        margin: this.getOption("x-label-offset"),
        fontStyle: axisLabelFont.italic ? "italic" : "normal",
        fontWeight: axisLabelFont.bold ? "bold" : "normal",
        fontSize: axisLabelFont.size,
        fontFamily: axisLabelFont.family,
        color: this.toEchartsColor(axisLabelFont.color as Color),
        textShadowColor: this.toEchartsColor(
          this.getOption("x-display-shadow-color")
        ),
        textShadowBlur: this.getOption("x-display-shadow-blur"),
        textShadowOffsetX: this.getOption("x-display-shadow-offset-x"),
        textShadowOffsetY: this.getOption("x-display-shadow-offset-y"),
        rotate: this.getOption("x-rotate"),
        hideOverlap: false,
        formatter: (param) => {
          return `${this.getTimeData(param)}`
          // return '{yyyy}-{MM}-{dd}-{HH}-{mm}'
        }
      },
      splitLine: this.xGridLineOption,
      position: 'top',
    }
    ]
  }

  getTimeData(n) {
    let now = new Date(n),
      y = now.getFullYear(),
      m = now.getMonth() + 1,
      d = now.getDate();
    return y + "-" + (m < 10 ? "0" + m : m) + "-" + (d < 10 ? "0" + d : d);
  }

  get echartsDataZoom() {
    let yStart = this.getOption<number>("y-start");
    let xStart = this.getOption<number>("x-start");
    let xRoll = this.getOption("x-roll");
    let yRoll = this.getOption("y-roll");
    let dataIntervale = Number(this.getOption<string>("x-data-interval"));
    let zoomSlider = {
      // show:true,
      id: "zoomSlider",
      type: 'slider',
      filterMode: 'none',
      brushSelect: false,
      handleIcon: "none",
      zoomLock: true,
      borderColor: '#555355',
      borderWidth: 10,
      showDetail: false,
      fillerColor: "#555355",
      backgroundColor: "#1c222a",
      selectedDataBackground: {
        areaStyle: {
          opacity: 0
        },
        lineStyle: {
          opacity: 0
        }
      },
      dataBackground: {
        areaStyle: {
          opacity: 0
        },
        lineStyle: {
          opacity: 0
        }
      },
      moveHandleIcon: "none",
      moveHandleSize: 0
    }
    let zoomInside = {
      id: "zoomInside",
      show: "false",
      type: "inside",
      filterMode: 'none',
      zoomOnMouseWheel: false, //不能触发缩放
      moveOnMouseMove: false, //鼠标移动不能触发平移
      moveOnMouseWheel: true, //鼠标滚轮触发平移
      preventDefaultMouseMove: true //阻止默认move事件
    }
    let zoomInsideDouble = {
      id: "zoomInsideDouble",
      show: "false",
      type: "inside",
      filterMode: 'none',
      zoomOnMouseWheel: false, //不能触发缩放
      moveOnMouseMove: false, //鼠标移动不能触发平移
      moveOnMouseWheel: "shift", //鼠标滚轮触发平移
      preventDefaultMouseMove: true //阻止默认move事件
    }
    let zoomSliderDouble = {
      // show:true,
      id: "zoomSliderDouble",
      type: 'slider',
      filterMode: 'none',
      brushSelect: false,
      handleIcon: "none",
      zoomLock: true,
      borderColor: '#555355',
      borderWidth: 10,
      showDetail: false,
      fillerColor: "#555355",
      backgroundColor: "#1c222a",
      selectedDataBackground: {
        areaStyle: {
          opacity: 0
        },
        lineStyle: {
          opacity: 0
        }
      },
      dataBackground: {
        areaStyle: {
          opacity: 0
        },
        lineStyle: {
          opacity: 0
        }
      },
      moveHandleIcon: "none",
      moveHandleSize: 0
    }
    let result = []
    if (this.getOption("y-display") && !xRoll && yRoll) {
      result.push(Object.assign(zoomSlider, { show: yRoll, yAxisIndex: [0], width: 5, startValue: 0, endValue: yStart - 1 }));
      result.push(Object.assign(zoomInside, { yAxisIndex: [0] }))
      result.push(Object.assign(zoomSliderDouble, { show: false, xAxisIndex: [0], startValue: 0, endValue: 3600 * 24 * 1000 * xStart * dataIntervale, height: 5 }))
      result.push(Object.assign(zoomInsideDouble, { xAxisIndex: [0], moveOnMouseWheel: false }))
    } else if (this.getOption("x-display") && !yRoll && xRoll) {
      result.push(Object.assign(zoomSlider, { show: xRoll, xAxisIndex: [0], height: 5, startValue: 0, endValue: 3600 * 24 * 1000 * xStart * dataIntervale }))
      result.push(Object.assign(zoomInside, { xAxisIndex: [0] }))
      result.push(Object.assign(zoomSliderDouble, { show: false, yAxisIndex: [0], width: 5, startValue: 0, endValue: yStart - 1 }))
      result.push(Object.assign(zoomInsideDouble, { yAxisIndex: [0], moveOnMouseWheel: false }))
    } else if (this.getOption("y-display") && this.getOption("x-display") && xRoll && yRoll) {
      result.push(Object.assign(zoomSlider, { show: yRoll, yAxisIndex: [0], width: 5, startValue: 0, endValue: yStart - 1 }));
      result.push(Object.assign(zoomInside, { yAxisIndex: [0] }))
      result.push(Object.assign(zoomSliderDouble, { show: xRoll, xAxisIndex: [0], startValue: 0, endValue: 3600 * 24 * 1000 * xStart * dataIntervale, height: 5 }))
      result.push(Object.assign(zoomInsideDouble, { xAxisIndex: [0], moveOnMouseWheel: "shift" }))
    } else {
      result.push(Object.assign(zoomSlider, { show: false, yAxisIndex: [0], width: 5, startValue: 0, endValue: yStart - 1 }));
      result.push(Object.assign(zoomInside, { yAxisIndex: [0], moveOnMouseWheel: false }))
      result.push(Object.assign(zoomSliderDouble, { show: false, xAxisIndex: [0], startValue: 0, endValue: 3600 * 24 * 1000 * xStart * dataIntervale, height: 5 }))
      result.push(Object.assign(zoomInsideDouble, { xAxisIndex: [0], moveOnMouseWheel: false }))
    }
    return result
  }

  get echartsYAxisOption(): YAXisComponentOption {
    let showYAxis = this.getOption<boolean>("y-display");
    let axisLabelFont = this.getOption<OptionFontValue>("y-font");
    let yIsPercent = this.getOption("y-text-type") === "percent";
    let yDecimalPlaces = Math.max(this.getOption("y-decimal-places"), 0);
    let yCompleteZero = this.getOption<boolean>("y-complete-zero");
    let valueAbb = this.getOption("y-value-abbreviation");
    let axisUnitMap = this.axisUnitMap;
    let yUnitFont = this.getOption<OptionFontValue>("y-unit-font");
    let axisOpt: any = {
      show: showYAxis,
      type: 'category',
      name: this.getOption("y-unit") ? this.getOption("y-unit-text") : "",
      nameTextStyle: {
        color: this.toEchartsColor(yUnitFont.color as Color),
        fontStyle: yUnitFont.italic ? "italic" : "normal",
        fontWeight: yUnitFont.bold ? "bold" : "normal",
        fontFamily: yUnitFont.family,
        fontSize: yUnitFont.size,
        align: "right",
      },
      inverse: true,
      axisLine: {
        //轴线
        show: this.getOption("y-line"),
        lineStyle: {
          type: this.getOption("y-line-type"),
          color: this.toEchartsColor(this.getOption("y-line-color")),
          width: Math.max(this.getOption("y-line-width"), 0),
          join: "miter",
        },
      },
      axisTick: {
        show: this.getOption("y-tickline"),
        alignWithLabel: true,
        interval: this.getOption("y-tick-interval"),
        length: this.getOption("y-tickline-length"),
        lineStyle: {
          width: this.getOption("y-tickline-width"),
          color: this.toEchartsColor(this.getOption("y-tickline-color")),
        },
      },
      axisLabel: {
        show: this.getOption("y-label"),
        fontStyle: axisLabelFont.italic ? "italic" : "normal",
        fontWeight: axisLabelFont.bold ? "bold" : "normal",
        fontSize: axisLabelFont.size,
        fontFamily: axisLabelFont.family,
        color: this.toEchartsColor(axisLabelFont.color as Color),
        textShadowColor: this.toEchartsColor(
          this.getOption("y-display-shadow-color")
        ),
        interval: this.getOption('y-label-interval'),
        hideOverlap: false, //是否隐藏重叠标签
        textShadowBlur: this.getOption("y-display-shadow-blur"),
        textShadowOffsetX: this.getOption("y-display-shadow-offset-x"),
        textShadowOffsetY: this.getOption("y-display-shadow-offset-y"),
        formatter: function (value, index) {
          let num = value;
          if (!isNaN(num)) {
            if (yIsPercent) {
              value = formatFloat(num * 100, yDecimalPlaces, yCompleteZero) + "%";
            } else {
              let abb = +valueAbb;
              let unit = "";
              if (abb !== 0) {
                unit = axisUnitMap[abb] || "";
              }
              value = formatFloat(num / Math.pow(10, abb), yDecimalPlaces, yCompleteZero) + unit;
            }
          }
          return value;
        },
      },
      splitLine: this.yGridLineOption,
      data: this.echartsData.map((data) => data.name),
    };
    // if (this.getOption("y-scale-range") === "custom") {
    //   axisOpt.min = this.getOption("y-scale-min");
    //   axisOpt.max = this.getOption("y-scale-max");
    //   axisOpt.splitNumber = this.getOption("y-scale-number");
    // }
    return axisOpt;
  }

  get echartsTooltipOption():
    | TooltipComponentOption
    | TooltipComponentOption[] {
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
    let tooltipValueType = this.getOption<string>("tooltip-text-type");
    let tooltipValueDecimalPlaces = this.getOption<number>("tooltip-decimal-places");
    let tooltipValueCompleteZero = this.getOption<boolean>("tooltip-complete-zero");
    let serieColor = this.getSeriesColor
    let iconColorData = []
    this.echartsData.map((item, index) => {
      if (item.values === 1) {
        iconColorData.push({
          color: serieColor[index]?.finish['color'] !== undefined ? serieColor[index]?.finish['color'] : "#6da752"
        })
      } else {
        iconColorData.push({
          color: serieColor[index]?.plan['color'] !== undefined ? serieColor[index]?.plan['color'] : "#6da752"
        })
      }
    })
    const projectId = this.getBoard().projectId;
    const seriesCssColors = this.getSeriesCssColors();
    let showTooltip = this.getOption<boolean>("tooltip");
    let tooltipBackground = backgroundImage?.relativePath ? `url("${projectId}/${backgroundImage.relativePath}")` : backgroundColor;
    return {
      trigger: "item",
      confine: true,
      show: this.getOption("tooltip"),
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
      formatter: (param) => {
        let dataHtml = "";
        let iconHtml = showIcon
          ? `<span style="color:red;display:inline-block;width:10px;height:10px;border-radius:50%;background:${iconColorData[param.seriesIndex].color};"></span>`
          : "";
        let resultValue: any = param.data.timeValue;
        if (isNaN(resultValue)) resultValue = 0;
        if (tooltipValueType === "normal") {
          resultValue = formatFloat(resultValue, tooltipValueDecimalPlaces, tooltipValueCompleteZero);
        } else {
          resultValue = formatFloat(resultValue * 100, tooltipValueDecimalPlaces, tooltipValueCompleteZero) + "%";
        }
        if(commaDisplay){
          resultValue = this.doCommaSeparat(resultValue)
        }
        dataHtml +=
          `<div>${iconHtml}
          <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${param.data.key[0] === "" ? '任务名称' : param.data.key[0]}：</span>
          <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${param.name}</span>
          </div>
         <div>${iconHtml}
          <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${param.data.key[1] === "" ? '起始时间' : param.data.key[1]}：</span>
          <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${this.getTimeData(param.data.value[1])}</span>
        </div>
         <div>${iconHtml}
          <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${param.data.key[2] === "" ? '结束时间' : param.data.key[2]}：</span>
          <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${this.getTimeData(param.data.value[2])}</span>
        </div>
         <div>${iconHtml}
          <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${param.data.key[3] === "" ? 'value값&nbsp;&nbsp;' : param.data.key[3]}：</span>
          <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${resultValue}</span>
        </div>`;
        let titleHtml = showTitle
          ? `<div><span style="color:${titleFontColor};font-size:${titleFontSize}px;line-height:1;">${param.seriesName}</span></div>`
          : "";
        return `<div>${titleHtml}<div>${dataHtml}</div></div>`;
      },
    };
  }

  getLegendOtherOption() {
    let legendData = [];
    let serieColor = this.getSeriesColor;
    this.echartsData.map((item, index) => {
      if (item.values === 1) {
        legendData.push({
          name: item.name,
          itemStyle: {
            color: serieColor[index]?.finish['color'] !== undefined ? serieColor[index]?.finish['color'] : "#6da752"
          }
        })
      } else {
        legendData.push({
          name: item.name,
          itemStyle: {
            color: serieColor[index]?.plan['color'] !== undefined ? serieColor[index]?.plan['color'] : "#6da752"
          }
        })
      }
    })
    return {
      data: legendData,
    }
  }


  get echartsSeriesOption(): SeriesOption | SeriesOption[] {
    const seriesCssColors = this.getSeriesCssColors();
    let serieColor = this.getSeriesColor
    let number = 0 //计数
    let dataLabel = this.getOption<OptionFontValue>("label-font");
    let labelValueType = this.getOption<string>("label-text-type");
    let labelValueDecimalPlaces = this.getOption<number>("label-decimal-places");
    let labelValueCompleteZero = this.getOption<boolean>("label-complete-zero");
    let seriesHeight = this.getOption<number>("gantt-height")
    let seriesSelect = this.getOption("gantt-select-height")
    let unitFont = this.getOption<OptionFontValue>("label-unit-font");
    let unit = this.getOption<string>("label-unit-value");
    let seriesInfo = [];
    for (let i = 0; i < this.echartsData.length; i++) {
      let startTime = new Date(this.echartsData[i].startTime).getTime();
      let endTime = new Date(this.echartsData[i].endTime).getTime();
      let duration = endTime - startTime;
      let values = {
        name: this.echartsData[i].name,
        value: [i, startTime, endTime, duration],
        timeValue: this.echartsData[i].values,
        key: [this.echartsData[i].nameKey, this.echartsData[i].startKey, this.echartsData[i].endKey, this.echartsData[i].valueKey],
      };
      seriesInfo.push({
        name: this.echartsData[i].name,
        type: "custom",
        itemStyle: {
          opacity: 1,
        },
        label: {
          show: this.getOption("label"),
          position: this.getOption('label-position') === "inside" ? "inside" : "right",
          formatter: (param) => {
            let resultValue: any = param.data.timeValue;
            if (isNaN(resultValue)) resultValue = 0;
            if (resultValue == 0 && this.getOption("hide-zero-value")) {
              return `{value|}`;
            }
            if (labelValueType === "normal") {
              resultValue = formatFloat(resultValue, labelValueDecimalPlaces, labelValueCompleteZero);
            } else {
              resultValue = formatFloat(resultValue * 100, labelValueDecimalPlaces, labelValueCompleteZero) + "%";
            }
            return `{value|${resultValue}}{unit|${unit}}`
          },
          rich: {
            value: {
              color: this.toEchartsColor(dataLabel.color as Color),
              fontSize: dataLabel.size,
              fontFamily: dataLabel.family,
              fontWeight: dataLabel.bold ? "bold" : "normal",
              fontStyle: dataLabel.italic ? "italic" : "normal"
            },
            unit: {
              fontSize: unitFont.size,
              fontWeight: unitFont.bold ? "bold" : "normal",
              fontStyle: unitFont.italic ? "italic" : "normal",
              fontFamily: unitFont.family || "sans-serif",
              color: this.toEchartsColor(unitFont.color as Color)
            }
          },
          color: 'blue'
        },
        encode: {
          x: [1, 2],
          y: 0,
        },
        renderItem: ((params, api) => {
          let categoryIndex = api.value(0);
          let start = api.coord([api.value(1), categoryIndex]);
          let end = api.coord([api.value(2), categoryIndex]);
          let height = seriesSelect === "1" ?  seriesHeight : api.size([0, 1])[1] * 0.6
          if (number >= this.echartsData.length) number = 0;
          let rectShape = graphic.clipRectByRect(
            {
              x: start[0],
              y: start[1] - height / 2,
              width: (end[0] - start[0]) * (this.echartsData[number].values),
              height: height,
            },
            {
              x: params.coordSys.x,
              y: params.coordSys.y,
              width: params.coordSys.width,
              height: params.coordSys.height,
            }
          );
          let rectShape1 = graphic.clipRectByRect(
            {
              x: start[0],
              y: end[1] - height / 2,
              width: (end[0] - start[0]),
              height: height,
            },
            {
              x: params.coordSys.x,
              y: params.coordSys.y,
              width: params.coordSys.width,
              height: params.coordSys.height,
            }
          );
          let rectShapeText = graphic.clipRectByRect(
            {
              x: start[0],
              y: start[1] - height / 2,
              width: end[0] - start[0],
              height: height,
            },
            {
              x: params.coordSys.x,
              y: params.coordSys.y,
              width: params.coordSys.width,
              height: params.coordSys.height,
            }
          );
          number++;
          if (this.echartsData[number - 1].values === 1) {
            return {
              type: 'group',
              children: [
                {
                  type: 'rect',
                  ignore: !rectShape,
                  shape: rectShape,
                  style: api.style({ fill: serieColor[number - 1]?.finish['color'] !== undefined ? serieColor[number - 1]?.finish['color'] : "#6da752", text: '' }),
                  focus: "self",
                  emphasis: {
                    style: {
                      lineWidth: 1,
                      stroke: '#fff'
                    }
                  }
                },
                {
                  type: 'rect',
                  ignore: !rectShapeText,
                  shape: rectShapeText,
                  style: api.style({ fill: '#dbdbdb', opacity: 0 }),
                }
              ]
            }
          } else {
            return {
              type: 'group',
              children: [
                {
                  type: 'rect',
                  ignore: !rectShape,
                  shape: rectShape,
                  style: api.style({ fill: serieColor[number - 1]?.plan['color'] !== undefined ? serieColor[number - 1]?.plan['color'] : "#6da752", text: '' }),
                  focus: "self",
                  z2: 20,
                  emphasis: {
                    style: {
                      lineWidth: 1,
                      stroke: '#fff'
                    }
                  }
                },
                {
                  type: 'rect',
                  ignore: !rectShape1,
                  shape: rectShape1,
                  style: api.style({ fill: serieColor[number - 1]?.finish['color'] !== undefined ? serieColor[number - 1]?.finish['color'] : "#dbdbdb", text: '' }),
                  focus: "self",
                  emphasis: {
                    style: {
                      lineWidth: 1,
                      stroke: '#fff'
                    }
                  }
                },
                {
                  type: 'rect',
                  ignore: !rectShapeText,
                  shape: rectShapeText,
                  style: api.style({ fill: '#dbdbdb', opacity: 0 }),
                }
              ]
            }
          }
        }),
        data: [values],
      });
    }
    return seriesInfo as SeriesOption;
  }

  get echartsOptionFunc(): {[key: string]: Function} {
    return {
      grid: ()=>this.echartsGridOption,
      xAxis: ()=>this.echartsXAxisOption,
      yAxis: ()=>this.echartsYAxisOption,
      tooltip: ()=>this.echartsTooltipOption,
      legend: ()=>this.echartsLegendOption,
      series: ()=>this.echartsSeriesOption,
      color: ()=>this.getSerieEchartsColors(),
      dataZoom: ()=>this.echartsDataZoom
    };
  }




  getSampleData() {
    let dataName = [
      {
        uid: ["", "", "sample_name"],
        alias: "name",
        type: "string",
        summary: "",
      },
    ];
    let dataStart = [
      {
        uid: ["", "", "sample_startTime"],
        alias: "startTime",
        type: "date",
        summary: "",
      },
    ];
    let dataEnd = [
      {
        uid: ["", "", "sample_endTime"],
        alias: "endTime",
        type: "date",
        summary: "",
      },
    ];
    let dataValue = [
      {
        uid: ["", "", "sample_value"],
        alias: "value",
        type: "number",
        summary: "sum",
      },
    ];
    let data = [
      {
        sample_name: "任务一",
        sample_startTime: "2020-5-8",
        sample_endTime: "2020-5-13",
        sample_value: 0.5,
      },
      {
        sample_name: "任务二",
        sample_startTime: "2020-5-12",
        sample_endTime: "2020-5-15",
        sample_value: 0.3,
      },
      {
        sample_name: "任务三",
        sample_startTime: "2020-5-14",
        sample_endTime: "2020-5-17",
        sample_value: 0.3,
      },
      {
        sample_name: "任务四",
        sample_startTime: "2020-5-16",
        sample_endTime: "2020-5-22",
        sample_value: 0.6,
      },
      {
        sample_name: "任务五",
        sample_startTime: "2020-5-22",
        sample_endTime: "2020-5-30",
        sample_value: 0.8,
      },
    ];
    return { data, dataName, dataStart, dataEnd, dataValue };
  }

  protected getDefaultPrivateData(): PrivateData {
    return {
      fields: [
        { uid: "sample_name", alias: "name", type: "string" },
        { uid: "sample_startTime", alias: "startTime", type: "string" },
        { uid: "sample_endTime", alias: "endTime", type: "string" },
        { uid: "sample_value", alias: "value", type: "number" },
      ],
      rows: [
        {
          sample_name: "任务一",
          sample_startTime: "2020-5-8",
          sample_endTime: "2020-5-13",
          sample_value: 0.5,
        },
        {
          sample_name: "任务二",
          sample_startTime: "2020-5-12",
          sample_endTime: "2020-5-15",
          sample_value: 0.3,
        },
        {
          sample_name: "任务三",
          sample_startTime: "2020-5-14",
          sample_endTime: "2020-5-17",
          sample_value: 0.3,
        },
        {
          sample_name: "任务四",
          sample_startTime: "2020-5-16",
          sample_endTime: "2020-5-22",
          sample_value: 0.6,
        },
        {
          sample_name: "任务五",
          sample_startTime: "2020-5-22",
          sample_endTime: "2020-5-30",
          sample_value: 0.8,
        },
      ],
    };
  }


  useSampleData() {
    let data = null;
    let sampleData = this.getPrivateData();

    data = sampleData?.rows;
    return {
      data: data,
      dataName: sampleData?.fields,
      dataStart: sampleData?.fields,
      dataEnd: sampleData?.fields,
      dataValue: sampleData?.fields,
    };
  }

  getAlias(uid: OptionFieldUID) {
    return this.getFieldAlias(uid);
  }

  checkErrorData() {
    let nameDimensions: any = this.getOption<OptionFieldValue[]>("axis-name") || [];
    let startDimensions: any = this.getOption<OptionFieldValue[]>("axis-start") || [];
    let endDimensions: any = this.getOption<OptionFieldValue[]>("axis-end") || [];
    let valueDimensions: any = this.getOption<OptionFieldValue[]>("axis-value") || [];
    if (nameDimensions.length && startDimensions.length && endDimensions.length && valueDimensions.length) {
      this.clearErrorDataStatus();
    }  else if ( !nameDimensions.length || !startDimensions.length || !endDimensions.length || !valueDimensions.length ) {
      if(!nameDimensions.length && !startDimensions.length && !endDimensions.length && !valueDimensions.length) {
        this.addErrorDataStatus("filed-empty");
      } else {
        this.addErrorDataStatus("filed-incomplete");
      }
    }
  }

  get echartsData() {
    let resultData = [];
    let dataSort = this.getOption("sort-type");
    //名称
    let nameDimensions: any =
      this.getOption<OptionFieldValue[]>("axis-name") || [];
    //开始时间
    let startDimensions: any =
      this.getOption<OptionFieldValue[]>("axis-start") || [];
    //结束时间
    let endDimensions: any =
      this.getOption<OptionFieldValue[]>("axis-end") || [];
    //值
    let valueDimensions: any =
      this.getOption<OptionFieldValue[]>("axis-value") || [];
    let dataView = null;
    if (nameDimensions.length && startDimensions.length && endDimensions.length && valueDimensions.length) {
      dataView = this.getDataAfterSort(this.datasetSource());
      //名称
      let nameDimension = nameDimensions?.[0];
      //开始时间
      let startDimension = startDimensions?.[0];
      //结束时间
      let endDimension = endDimensions?.[0];
      //进度百分比
      let valueDimension = valueDimensions?.[0];
      for (let i = 0; i < dataView.length; i++) {
        let dataInfo = {
          values: dataView[i][valueDimension?.uid?.[2]],
          startTime: new Date(dataView[i][startDimension?.uid?.[2]]).toLocaleDateString(),
          endTime: new Date(dataView[i][endDimension?.uid?.[2]]).toLocaleDateString(),
          name: dataView[i][nameDimension?.uid?.[2]],
          nameKey: this.getFieldAlias(nameDimension?.uid),
          startKey: this.getFieldAlias(startDimension?.uid),
          endKey: this.getFieldAlias(endDimension?.uid),
          valueKey: this.getFieldAlias(valueDimension?.uid),
        };
        resultData.push(dataInfo);
      }
    } else if ( !nameDimensions.length || !startDimensions.length || !endDimensions.length || !valueDimensions.length ) {
      let sampleData = this.useSampleData();
      dataView = sampleData.data;
      nameDimensions = sampleData.dataName?.[0];
      startDimensions = sampleData.dataStart?.[1];
      endDimensions = sampleData.dataEnd?.[2];
      valueDimensions = sampleData.dataValue?.[3];
      for (let i = 0; i < dataView.length; i++) {
        let dataInfo = {
          values: dataView[i][valueDimensions?.uid],
          startTime: new Date(dataView[i][startDimensions?.uid]).toLocaleDateString(),
          endTime: new Date(dataView[i][endDimensions?.uid]).toLocaleDateString(),
          name: dataView[i][nameDimensions?.uid],
          nameKey: this.getFieldAlias(nameDimensions?.uid),
          startKey: this.getFieldAlias(startDimensions?.uid),
          endKey: this.getFieldAlias(endDimensions?.uid),
          valueKey: this.getFieldAlias(valueDimensions?.uid),
        };
        resultData.push(dataInfo);
      }
    }
    return resultData;
  }

  selectDispatchAction() {
    let that = this;
    let nameDims = this.getOption<OptionFieldValue[]>("axis-name");
    that.echartsChart.on('click', (params) => {
      if (nameDims && nameDims.length > 0) {
        let nameDim = nameDims[0]?.uid;
        that.applyLinkage({ uid: nameDim, value: params.data?.name });
      }
    })
  }

  getAnimationType() {
    return this.getOption("animation-display-type");
  }

  beginAnimationDisplay() {
    // super.beginAnimationDisplay();
    let b2_animator = null;
    if (this.getAnimationType() == "roll") {
      b2_animator = this.rollAnimationDisplays();
    } else if (this.getAnimationType() == "carousel") {
      b2_animator = this.carouselAnimationDisplays();
    }
    if (b2_animator) {
      this.b2_animators.push(b2_animator);
    }
  }

  rollAnimationDisplays() {
    let that = this;
    let start = this.echartsChart.getOption()?.dataZoom?.[0]?.start;
    let end = this.echartsChart.getOption()?.dataZoom?.[0]?.end;
    let dataLength = that.echartsChart.getOption()?.yAxis?.[0]?.data?.length
    if(start === 0 && end === 100 ) return;
    let rollNum = this.getOption<number>("y-start") - 1;
    let promise = Promise.resolve();
    let currentIndex = this.echartsChart.getOption().dataZoom[0].startValue;
    let display_duration = this.getAnimationDisplayDuration();
    let display_interval = Math.max(this.getOption<number>("animation-display-single-interval") * 1000, 0) || 1000;
    let update_data = (resolve) => {
      that.animation_display_timeout = setInterval(() => {
        if (that.stopAnimate) {
          clearInterval(that.animation_display_timeout);
          that.echartsChart.dispatchAction({ type: 'dataZoom', startValue: 0, endValue: rollNum ,dataZoomIndex:1 });
          return resolve();
        }
        if(that.animation_display_paused || that.isAnimating) return;
        if(that.selectedIndex.value !== -1){
          that.selectedIndex.value = -1;
          that.selectedData.value = null;
          that.animationTriggerLinkage && that.withdrawLinkage();
        }
        //选中当前
        if (currentIndex + rollNum >= dataLength) {
          currentIndex = that.echartsChart.getOption().dataZoom[0].startValue;
          clearInterval(that.animation_display_timeout);
          //全部取消选中
          that.echartsChart.dispatchAction({ type: 'dataZoom', startValue: 0, endValue: rollNum ,dataZoomIndex:1 });
          resolve();
        }else{
          that.echartsChart.dispatchAction({ type: 'dataZoom', dataZoomIndex:1,startValue: currentIndex, endValue: currentIndex + rollNum });
          currentIndex++;
        }
      }, display_duration + display_interval);
    };
    promise = new Promise((resolve) => {
      update_data(resolve);
    });
    return promise
  }


  carouselAnimationDisplays() {
    let that = this;
    let display_stay = Math.max(this.getOption<number>("animation-display-stay-column-carousel") * 1000, 1000);
    let x_uid = this.getOption("axis-name")?.[0]?.uid;
    let name = this.getFieldAlias(x_uid)
    let promise = Promise.resolve();
    let currentIndex = this.echartsChart.getOption().dataZoom[0].startValue || 0;
    let update_data = (resolve) => {
      // 先执行一次 否则刚开始会多停顿 display_stay 的时长
      let linkages = [];
      that.echartsChart.dispatchAction({ type: 'showTip', seriesIndex: currentIndex, dataIndex: 0 });
      that.echartsChart.dispatchAction({ type: 'select', seriesIndex: currentIndex, dataIndex: 0 });
      if (x_uid?.length) {
        let data = this.datasetSource();
        const currentData = data[currentIndex];
        let fieldArr = this.getOption<string>("linkage-form-field")?.split(".")
        let fieldUIDs;
        let filterValue;
        if (fieldArr?.length) {
          if (fieldArr.length === 2) {
            fieldUIDs = [x_uid[0], ...fieldArr];
            filterValue = currentData?.[fieldArr[1]];
          } else if (fieldArr.length === 3) {
            fieldUIDs = [x_uid[0], fieldArr[0], `${fieldArr[1]}.${fieldArr[2]}`];
            filterValue = currentData?.[fieldArr[1]].map(item => item[fieldArr[2]]);
          }
        }
        linkages.push({ uid: fieldUIDs as OptionFieldUID, value: filterValue })
      }

      that.animationTriggerLinkage && that.applyLinkage(linkages);
      currentIndex++;
      that.animation_display_timeout = setInterval(() => {
        if (that.stopAnimate) {
          clearInterval(that.animation_display_timeout);
          that.echartsChart.dispatchAction({ type: 'hideTip' });
          that.echartsChart.dispatchAction({ type: 'unselect', dataIndex: currentIndex });
          return resolve();
        }
        if(that.animation_display_paused || that.isAnimating) return;

        //选中当前
        let linkages = [];
        that.echartsChart.dispatchAction({ type: 'showTip', seriesIndex: currentIndex, dataIndex: 0 });
        that.echartsChart.dispatchAction({ type: 'select', seriesIndex: currentIndex,dataIndex: 0 });
        if (x_uid?.length) {
          let data = this.datasetSource();
          const currentData = data[currentIndex];
          let fieldArr = this.getOption<string>("linkage-form-field")?.split(".")
          let fieldUIDs;
          let filterValue;
          if (fieldArr?.length) {
            if (fieldArr.length === 2) {
              fieldUIDs = [x_uid[0], ...fieldArr];
              filterValue = currentData?.[fieldArr[1]];
            } else if (fieldArr.length === 3) {
              fieldUIDs = [x_uid[0], fieldArr[0], `${fieldArr[1]}.${fieldArr[2]}`];
              filterValue = currentData?.[fieldArr[1]].map(item => item[fieldArr[2]]);
            }
          }
          linkages.push({ uid: fieldUIDs as OptionFieldUID, value: filterValue })
        }
        that.animationTriggerLinkage && that.applyLinkage(linkages);
        if (currentIndex > that.echartsChart.getOption().dataZoom[0].endValue) {
          currentIndex = that.echartsChart.getOption().dataZoom[0].startValue;
          clearInterval(that.animation_display_timeout);
          that.echartsChart.dispatchAction({ type: 'hideTip' });
          that.echartsChart.dispatchAction({ type: 'select', dataIndex: -1 });
          that.animationTriggerLinkage && that.withdrawLinkage();
          resolve();
        } else{
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
      dataZoom: this.echartsDataZoom,
    }, {
      notMerge: false,
      replaceMerge: ["series", "dataZoom"],
      lazyUpdate: true
    })
  }

  get axisName() {
    return this.getOption<OptionFieldValue[]>("axis-name") || [];
  }

  get axisStart() {
    return this.getOption<OptionFieldValue[]>("axis-start") || [];
  }

  get axisEnd() {
    return this.getOption<OptionFieldValue[]>("axis-end") || [];
  }

  get axisValue() {
    return this.getOption<OptionFieldValue[]>("axis-value") || [];
  }

  override getMetaData() {
    return merge(super.getMetaData(), {
      axisValue: [
        ...this.axisName,
        ...this.axisStart,
        ...this.axisEnd,
        ...this.axisValue
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

    this.echartsChart.off("click");
    this.echartsChart.on('click', (params) => {
      this.selectedIndex.value = params.componentIndex;
      this.selectedData.value = {
        name: params.name,
        value: params.value
      }

      // 点击同一个点，取消选中
      if (state.lastDataIndex === params.componentIndex && state.lastseriesIndex === params.seriesIndex) {
        state.lastDataIndex = -1;
        state.lastseriesIndex = -1;
        this.selectedIndex.value = -1;
        this.selectedData.value = null;
        this.withdrawLinkage();
        this.echartsChart.dispatchAction({
          type: 'unselect',
          seriesIndex: params.seriesIndex,
          dataIndex: params.componentIndex
        })
      } else {
        // 取消上一次的选中
        if(state.lastDataIndex !== -1) {
          this.echartsChart.dispatchAction({
            type: 'unselect',
            seriesIndex: state.lastseriesIndex,
            dataIndex: state.lastDataIndex
          })
        }
        state.lastDataIndex = params.componentIndex;
        state.lastseriesIndex = params.seriesIndex;
        this.echartsChart.dispatchAction({
          type: 'select',
          seriesIndex: params.seriesIndex,
          dataIndex: params.componentIndex
        })

        let data = this.datasetSource();
        const currentData = data[params.componentIndex];
        let uids = this.getOption("axis-x")?.[0]?.uid;
        if (uids?.length) {
          let fieldArr = this.getOption<string>("linkage-form-field")?.split(".")
          let fieldUIDs;
          let filterValue;
          if (fieldArr?.length) {
            if (fieldArr.length === 2) {
              fieldUIDs = [uids[0], ...fieldArr];
              filterValue = currentData?.[fieldArr[1]];
            } else if (fieldArr.length === 3) {
              fieldUIDs = [uids[0], fieldArr[0], `${fieldArr[1]}.${fieldArr[2]}`];
              filterValue = currentData?.[fieldArr[1]].map(item => item[fieldArr[2]]);
            }
          }
          this.applyLinkage({ uid: fieldUIDs as OptionFieldUID, value: filterValue });
        }
      }

    })
  }

  get ignoreDims(): `f_${string}`[] {
    const ignoreArr = [];
    let axisStartDimUid = this.getOption<OptionFieldValue[]>("axisStart")?.[0]?.uid?.[2];
    if (axisStartDimUid) ignoreArr.push(axisStartDimUid);
    let axisEndDimUid = this.getOption<OptionFieldValue[]>("axisEnd")?.[0]?.uid?.[2];
    if (axisEndDimUid) ignoreArr.push(axisEndDimUid);
    return ignoreArr;
  }
}
