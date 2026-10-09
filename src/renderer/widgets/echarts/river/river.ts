import { PrivateData, PrivateDataConnectionUID, PrivateDataTableUID, OptionFieldUID } from "@common/types/project";
import { DefinedOptions, OptionFileValue, OptionFieldValue, WidgetMetaData, ChartClickState } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { formatFloat } from "@common/utils/math";
import { TheWidget as Echarts, component as B2Chart } from "@renderer/widgets/echarts/basic";
import { EChartsOption, TooltipComponentOption, SeriesOption, SingleAxisComponentOption, DataZoomComponentOption } from "echarts/dist/echarts";
import  resource  from "./locales"
import i18next from "@renderer/widgets/i18next";
import { merge, recursive } from "merge";
import { Ref, ref } from "vue";
import { formatTimeCategoryLabelByStartedAt, getNextTimeCategoryStartedAt, isTimeCategorySummary } from "../basic/utils/aggregator";

export class River extends Echarts {
  noDims: Boolean = false;
  static resource = recursive(true, Echarts.resource, resource);
  static defineOptions(): DefinedOptions[] {
    return [
      {
        data: {
          fields: {
            alias: i18next.t("fields"),
            fold: "unfold",
            children: [
              {
                name: "axis-date",
                type: "field(recommend=string)",
                alias: i18next.t("axisDate"),
                default: [
                  {
                    "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_date"],
                    "__opt_type": "field",
                    "summary": ""
                  }
                ]
              },
              {
                name: "axis-category",
                type: "field",
                alias: i18next.t("axisCategory"),
                default: [
                  {
                    "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_category"],
                    "__opt_type": "field",
                    "summary": ""
                  }
                ]
              },
              {
                name: "axis-value",
                alias: i18next.t("axisValue"),
                type: "field(aggs=sum|max|min|mean|count|distinct)",
                default: [
                  {
                    "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_value"],
                    "__opt_type": "field",
                    "summary": ""
                  }
                ]
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
          "axis": {
            visible: true,
            children: [
              {
                name: "x-line-cluster",
                alias: i18next.t("xLineCluster"),
                show: "tab",
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
                    ],
                    disabled: (widget: River) => {
                      return !widget.getOption("x-line");
                    },
                  },
                  {
                    name: "x-line-color",
                    alias: i18next.t("xLineColor"),
                    type: "color",
                    default: "#CCCCCC",
                    disabled: (widget: River) => {
                      return !widget.getOption("x-line");
                    },
                  },
                  {
                    name: "x-line-width",
                    alias: i18next.t("xLineWidth"),
                    type: "number(unit=px, min=0)",
                    default: 1,
                    disabled: (widget: River) => {
                      return !widget.getOption("x-line");
                    },
                  },
                ],
              },
              {
                name: "x-tickline-cluster",
                alias: i18next.t("xTicklineCluster"),
                show: "tab",
                children: [
                  {
                    name: "x-tickline",
                    alias: i18next.t("xTickline"),
                    type: "boolean",
                    default: true,
                  },
                  {
                    name: "x-tickline-color",
                    alias: i18next.t("xTicklineColor"),
                    type: "color",
                    default: "#CCCCCC",
                    disabled: (widget: River) => {
                      return !widget.getOption("x-tickline");
                    },
                  },
                  {
                    name: "x-tickline-width",
                    alias: i18next.t("xTicklineWidth"),
                    type: "number(unit=px, min=0)",
                    default: 2,
                    disabled: (widget: River) => {
                      return !widget.getOption("x-tickline");
                    },
                  },
                  {
                    name: "x-tickline-length",
                    alias: i18next.t("xTicklineLength"),
                    type: "number(unit=px)",
                    default: 5,
                    disabled: (widget: River) => {
                      return !widget.getOption("x-tickline");
                    },
                  },
                ],
              },
              {
                name: "x-label-cluster",
                alias: i18next.t("xLabelCluster"),
                show: "tab",
                children: [
                  {
                    name: "x-label",
                    alias: i18next.t("xLabel"),
                    type: "boolean",
                    default: true,
                  },
                  {
                    name: "x-data-interval",
                    alias: i18next.t("xDataInterval"),
                    type: "number(unit=" + i18next.t("unitTian") + ")",
                    default: 1,
                  },
                  {
                    name: "x-label-offset",
                    alias: i18next.t("xLabelOffset"),
                    type: "number(unit=px)",
                    default: 10,
                    disabled: (widget: River) => {
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
                    disabled: (widget: River) => {
                      return !widget.getOption("x-label");
                    },
                    visible: (widget: River) => {
                      return (
                        widget.getOption("x-data-type") === "linear"
                      );
                    },
                  },
                  {
                    name: "x-scale-min",
                    alias: i18next.t("xScaleMin"),
                    type: "number<float>",
                    default: 0,
                    disabled: (widget: River) => {
                      return !widget.getOption("x-label");
                    },
                    visible: (widget: River) => {
                      return (
                        widget.getOption("x-data-type") === "linear" &&
                        widget.getOption("x-scale-range") === "custom"
                      );
                    },
                  },
                  {
                    name: "x-scale-max",
                    alias: i18next.t("xScaleMax"),
                    type: "number<float>",
                    default: 100,
                    disabled: (widget: River) => {
                      return !widget.getOption("x-label");
                    },
                    visible: (widget: River) => {
                      return (
                        widget.getOption("x-data-type") === "linear" &&
                        widget.getOption("x-scale-range") === "custom"
                      );
                    },
                  },
                  {
                    name: "x-font",
                    alias: i18next.t("xFont"),
                    type: "font",
                    default: {
                      family: "sans-serif",
                      size: 12,
                      bold: false,
                      italic: false,
                      underline: false,
                      deleteline: false,
                    },
                    disabled: (widget: River) => {
                      return !widget.getOption("x-label");
                    },
                  },
                  {
                    name: "x-display-shadow-color",
                    alias: i18next.t("xDisplayShadowColor"),
                    type: "color",
                    default: "#ffffff",
                    disabled: (widget: River) => {
                      return !widget.getOption("x-label");
                    },
                  },
                  {
                    name: "x-display-shadow-blur",
                    alias: i18next.t("xDisplayShadowBlur"),
                    type: "number(unit=px)",
                    default: 0,
                    disabled: (widget: River) => {
                      return !widget.getOption("x-label");
                    },
                  },
                  {
                    name: "x-display-shadow-offset-x",
                    alias: i18next.t("xDisplayShadowOffsetX"),
                    type: "number(unit=px)",
                    default: 0,
                    disabled: (widget: River) => {
                      return !widget.getOption("x-label");
                    },
                  },
                  {
                    name: "x-display-shadow-offset-y",
                    alias: i18next.t("xDisplayShadowOffsetY"),
                    type: "number(unit=px)",
                    default: 0,
                    disabled: (widget: River) => {
                      return !widget.getOption("x-label");
                    },
                  },
                  {
                    name: "x-rotate",
                    alias: i18next.t("xRotate"),
                    type: "select",
                    default: "0",
                    selectChoices: [
                      {
                        value: "0",
                        label: i18next.t("zore"),
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
                    disabled: (widget: River) => {
                      return !widget.getOption("x-label");
                    },
                    visible: (widget: River) => {
                      return (
                        widget.getOption("x-label-position") !== "above"
                      );
                    },
                  },
                ],
              },
              {
                name: "x-grid-cluster",
                show: "tab",
                alias: i18next.t("grid"),
                children: [
                  {
                    name: "grid",
                    alias: i18next.t("grid"),
                    type: "boolean",
                    default: false,
                  },
                  {
                    name: "grid-x-line-type",
                    alias: i18next.t("gridXLineType"),
                    default: "dashed",
                    type: "select(radioGroup)",
                    selectChoices: [
                      {
                        value: "solid",
                        label: i18next.t("solid"),
                      },
                      {
                        value: "dashed",
                        label: i18next.t("dashed"),
                      },
                    ],
                  },
                  {
                    name: "grid-x-line-dashed-width",
                    alias: i18next.t("gridXLineDashedWidth"),
                    default: 4,
                    type: "number(unit=px)",
                  },
                  {
                    name: "grid-x-line-color",
                    alias: i18next.t("gridXLineColor"),
                    default: "#ffffff",
                    type: "color",
                  },
                  {
                    name: "grid-x-line-width",
                    alias: i18next.t("gridXLineWidth"),
                    default: 1,
                    type: "number(unit=px)",
                  },
                  {
                    name: "grid-x-line-fill",
                    alias: i18next.t("gridXLineFill"),
                    type: "palette(gradient)",
                    default: ["transparent"],
                  },
                ],
              }
            ],
          },
          "series-shape":{
            alias: i18next.t("seriesShape"),
            children: [
              {
                name:'shape-top-space',
                alias:i18next.t("shapeTopSpace"),
                type:"number(unit=%)",
                default:10
              },
              {
                name:'shape-bottom-space',
                alias:i18next.t("shapeBottomSpace"),
                type:"number(unit=%)",
                default:10
              },
              {
                name:'shape-border-width',
                alias:i18next.t("shapeBorderWidth"),
                type:"number(unit=px, min=0)",
                default:0
              },
              {
                name:'shape-border-color',
                alias:i18next.t("shapeBorderColor"),
                type:"color",
                default:'#fff'
              }
            ]
          },
          "slider-display": {
            alias: i18next.t("sliderDisplay"),
            type: "boolean",
            default: false,
            children: [
              {
                name:"slider-style",
                alias: i18next.t("sliderStyle"),
                show: "tab",
                children: [
                  {
                    name: "slider-height",
                    alias: i18next.t("sliderHeight"),
                    type: "number(unit=px)",
                    default: 16,
                    visible: true,
                  },

                  {
                    name: "slider-text-color",
                    alias: i18next.t("sliderTextColor"),
                    type: "color",
                    default: "#FFFFFF80",
                    visible: true,
                  },
                  {
                    name: "slider-foreground-color",
                    alias: i18next.t("sliderForegroundColor"),
                    type: "color",
                    default: "#5B8FF926",
                    visible: true,
                  },
                  {
                    name: "slider-background-color",
                    alias: i18next.t("sliderBackgroundColor"),
                    type: "color",
                    default: "#4161800D",
                    visible: true,
                  },
                ]
              },
              {
                name: "slider-handler",
                alias: i18next.t("sliderHandler"),
                show: "tab",
                children: [
                  {
                    name: "slider-handler-size",
                    alias: i18next.t("sliderHandlerSize"),
                    type: "number(unit=px, min=0)",
                    default: 28,
                    visible: true,
                  },
                  {
                    name: "slider-handler-color",
                    alias: i18next.t("sliderHandlerColor"),
                    type: "color",
                    default: "#F7F7F7",
                    visible: true,
                  },
                ],
              },
            ],
          },
        }
      },
      ...super.defineOptions(),
    ];
  }

  getEchartsSplitLineColors() {
    let colors = this.getOption<Color[]>("grid-x-line-fill");
    if (!this.getOption("grid") || !colors || colors.length == 0) {
      return ["transparent"]
    } else {
      return Array.from(colors).map((color) => {
        return new Color(color).toEchartsColor();
      });
    }
  }

  get echartsOptionFunc(): {[key: string]: Function} {
    return {
      grid: ()=>this.echartsGridOption,
      tooltip: ()=>this.echartsTooltipOption,
      singleAxis: ()=>this.echartsSingleAxis,
      legend: ()=>this.echartsLegendOption,
      series: ()=>this.echartsSeriesOption,
      dataZoom: ()=>this.echartsDataZoom,
      color: ()=>this.getSerieEchartsColors()
    };
  }
  get echartsDataZoom(): DataZoomComponentOption | DataZoomComponentOption[] {
    return {
      show: this.getOption("slider-display"),
      bottom: "2%",
      height: this.getOption("slider-height"),
      handleSize: this.getOption("slider-handler-size"),
      backgroundColor: this.toEchartsColor(this.getOption<Color>("slider-background-color")),
      fillerColor: this.toEchartsColor(this.getOption<Color>("slider-foreground-color")),
      handleStyle: {
        color: this.toEchartsColor(this.getOption<Color>("slider-handler-color")),
        borderWidth: 0
      },
    }
  }

  get echartsSingleAxis(): SingleAxisComponentOption | SingleAxisComponentOption[] {
    let showAxisTick: boolean = this.getOption("x-tickline");
    let showAxisLabel: boolean = this.getOption("x-label");
    let showAxisLine: boolean = this.getOption("x-line");
    let axisLineColor: any = this.toEchartsColor(this.getOption<Color>("x-line-color"));
    let axisTickColor: any = this.toEchartsColor(this.getOption<Color>("x-tickline-color"));
    let axisLabelShadowColor: any = this.toEchartsColor(this.getOption<Color>("x-display-shadow-color"));
    let axisLabelFont: any = this.getOption("x-font");
    let padding = this.padding;
    let showTooltip = this.getOption<boolean>("tooltip");
    let tooltipColor = new Color(this.getOption<Color>("tooltip-background-color")).toCssString();
    let dataIntervale = Number(this.getOption<string>("x-data-interval"));
    // dataIntervale小于等于0会导致组件崩溃
    dataIntervale = dataIntervale > 0 ? dataIntervale : 1;
    return {
      top: padding.top,
      bottom: 30 + padding.bottom,
      right: 20 + padding.right,
      left: 20 + padding.left,
      maxInterval: 3600 * 24 * 1000 * dataIntervale,
      minInterval: 3600 * 24 * 1000 * dataIntervale,
      axisTick: {
        show: showAxisTick,
        length: this.getOption("x-tickline-length"),
        lineStyle: {
          color: axisTickColor,
          width: this.getOption("x-tickline-width"),
        }
      },
      axisLine: {
        show: showAxisLine,
        lineStyle: {
          color: axisLineColor,
          width: this.getOption("x-line-width"),
          type: this.getOption("x-line-type"),
        }
      },
      axisLabel: {

        show: showAxisLabel,
        showMaxLabel: true,
        fontSize: axisLabelFont.size,
        color: axisLabelFont.color,
        fontStyle: axisLabelFont.italic ? 'italic' : 'normal',
        fontFamily: axisLabelFont.family,
        fontWeight: axisLabelFont.bold ? "bold" : "normal",
        margin: this.getOption("x-label-offset"),
        textShadowColor: axisLabelShadowColor,
        textShadowBlur: this.getOption("x-display-shadow-blur"),
        textShadowOffsetX: this.getOption("x-display-shadow-offset-x"),
        textShadowOffsetY: this.getOption("x-display-shadow-offset-y"),
        rotate: Number(this.getOption("x-rotate")),
        formatter: '{yyyy}/{MM}/{dd}',
      },
      type: 'time',
      axisPointer: {
        show: showTooltip,
        animation: true,
        label: {
          backgroundColor: tooltipColor,
          show: true
        }
      },
      splitLine: {
        show: this.getOption("grid"),
        lineStyle: {
          color: this.toEchartsColor(this.getOption<Color>("grid-x-line-color")),
          type: this.getOption("grid-x-line-type") === "solid" ? "solid" : [this.getOption("grid-x-line-dashed-width"), 5] as any,
          width: this.getOption("grid-x-line-width"),
          opacity: 1
        }
      },
      splitArea: {
        show: true,
        areaStyle: {
          color: this.getEchartsSplitLineColors()
        }
      }
    }
  }

  checkErrorData() {
    let date_dims = this.getOption<OptionFieldValue[]>("axis-date") || [];
    let category_dims = this.getOption<OptionFieldValue[]>("axis-category") || [];
    let value_dim = this.getOption<OptionFieldValue[]>("axis-value") || [];
    if (date_dims.length && category_dims.length && value_dim.length) {
      this.clearErrorDataStatus();
    } else {
      if (!date_dims.length && !category_dims.length && !value_dim.length) {
        this.addErrorDataStatus("filed-empty");
      } else {
        this.addErrorDataStatus("filed-incomplete");
      }
    }
  }

  get ignoreDims(): `f_${string}`[] {
    const ignoreArr = []
    let angleDimUid = this.getOption<OptionFieldValue[]>("axis-date")?.[0]?.uid?.[2];
    if (angleDimUid) ignoreArr.push(angleDimUid)
    return ignoreArr
  }

  private shouldShowMissingTime(dateDim?: OptionFieldValue | null) {
    return Boolean((dateDim as OptionFieldValue & { showMissingTime?: boolean })?.showMissingTime)
      && isTimeCategorySummary(String(dateDim?.summary || ""));
  }

  private getCategoryTimeStartedAt(row: any, dateUid: string) {
    const startedAt = Number(row?._categoryTimeMeta?.[dateUid]?.startedAt);
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

  private sortTimeBucketRows(sourceData: any[], dateUid: string, categoryUid?: string) {
    const categoryOrder = new Map<string, number>();
    if (categoryUid) {
      sourceData.forEach(row => {
        const key = String(row?.[categoryUid]);
        if (!categoryOrder.has(key)) {
          categoryOrder.set(key, categoryOrder.size);
        }
      });
    }

    return [...sourceData].sort((left, right) => {
      const leftStartedAt = this.getCategoryTimeStartedAt(left, dateUid);
      const rightStartedAt = this.getCategoryTimeStartedAt(right, dateUid);
      if (leftStartedAt !== null && rightStartedAt !== null && leftStartedAt !== rightStartedAt) {
        return leftStartedAt - rightStartedAt;
      }
      if (leftStartedAt !== null && rightStartedAt === null) return -1;
      if (leftStartedAt === null && rightStartedAt !== null) return 1;
      if (categoryUid) {
        return (categoryOrder.get(String(left?.[categoryUid])) ?? Number.MAX_SAFE_INTEGER)
          - (categoryOrder.get(String(right?.[categoryUid])) ?? Number.MAX_SAFE_INTEGER);
      }
      return 0;
    });
  }

  private fillMissingTimeBuckets(
    sourceData: any[],
    dateDim?: OptionFieldValue | null,
    categoryDim?: OptionFieldValue | null,
    valueDims: OptionFieldValue[] = [],
  ) {
    const dateUid = dateDim?.uid?.[2];
    if (!dateUid || !this.shouldShowMissingTime(dateDim) || !Array.isArray(sourceData) || !sourceData.length) {
      return sourceData;
    }

    const startedAtList = sourceData
      .map(row => this.getCategoryTimeStartedAt(row, dateUid))
      .filter((value): value is number => value !== null);

    if (!startedAtList.length) {
      return sourceData;
    }

    const minStartedAt = Math.min(...startedAtList);
    const maxStartedAt = Math.max(...startedAtList);
    const categoryUid = categoryDim?.uid?.[2];
    const categoryValues = categoryUid
      ? Array.from(new Set(
        sourceData
          .map(row => row?.[categoryUid])
          .filter(value => value !== undefined && value !== null && value !== ""),
      ))
      : [undefined];
    const existingKeys = new Set(
      sourceData.map(row => `${this.getCategoryTimeStartedAt(row, dateUid)}__${categoryUid ? String(row?.[categoryUid]) : ""}`),
    );
    const filledSource = [...sourceData];
    const metricState = this.createMissingTimeMetrics(valueDims);

    let cursor = minStartedAt;
    while (cursor <= maxStartedAt) {
      const nextCursor = getNextTimeCategoryStartedAt(cursor, dateDim.summary as any);
      const dateLabel = formatTimeCategoryLabelByStartedAt(cursor, dateDim);

      categoryValues.forEach(categoryValue => {
        const bucketKey = `${cursor}__${categoryUid ? String(categoryValue) : ""}`;
        if (existingKeys.has(bucketKey)) {
          return;
        }
        filledSource.push({
          [dateUid]: dateLabel,
          ...(categoryUid ? { [categoryUid]: categoryValue } : {}),
          _metrics: {
            ...metricState,
          },
          _categoryTimeMeta: {
            [dateUid]: {
              startedAt: cursor,
              label: dateLabel,
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

    return this.sortTimeBucketRows(filledSource, dateUid, categoryUid);
  }

  get echartsSeriesOption(): SeriesOption | SeriesOption[] {
    let date_dims = this.getOption<OptionFieldValue[]>("axis-date") || [];
    let category_dims = this.getOption<OptionFieldValue[]>("axis-category") || [];
    let value_dim = this.getOption<OptionFieldValue[]>("axis-value") || [];
    let data = [];

    let shapeTopSpace = this.getOption<number>("shape-top-space") + '%';
    let shapeBottomSpace = this.getOption<number>("shape-bottom-space") + '%';
    let borderColor = this.getOption<Color>("shape-border-color");
    let borderWidth = this.getOption<number>("shape-border-width");
    if (date_dims.length && category_dims.length && value_dim.length) {
      let dateRow = this.createView(["axis-date", "axis-category", "axis-value"])
      dateRow = this.dealDataByAggregate(dateRow, [date_dims[0], category_dims[0]], value_dim);
      dateRow = this.fillMissingTimeBuckets(dateRow, date_dims[0], category_dims[0], value_dim);
      dateRow.forEach((item) => {
        let arr = [];
        arr.push(item[date_dims[0].uid[2]]);
        arr.push(this.getMetric(item, value_dim[0]));
        arr.push(item[category_dims[0].uid[2]]);
        data.push(arr);
      })
    } else {
      let provideData = this.getPrivateData()

      let fieldTypeUids = this.getPrivateFieldTypeUids();
      provideData?.rows?.map?.(item => {
        let arr = []
        arr.push(item[fieldTypeUids.string?.[0]])
        arr.push(item[fieldTypeUids.number?.[0]])
        arr.push(item[fieldTypeUids.string?.[1]])
        data.push(arr)
      })
    }

    let seriesOpt = [];
    let seriesObj = {
      type: 'themeRiver',
      boundaryGap:[shapeTopSpace,shapeBottomSpace],
      emphasis: {
        label: {
          show: false
        },
      },
      itemStyle:{
        borderWidth,
        borderColor
      },
      label: {
        show: false
      },
      data
    }
    seriesOpt.push(seriesObj);

    return seriesOpt
  }


  protected getDefaultPrivateData(): PrivateData {
    return {
      fields: [
        { uid: "f_date", alias: "date", type: "string", summary: "" },
        { uid: "f_category", alias: "category", type: "string", summary: "" },
        { uid: "f_value", alias: "value", type: "number", summary: "" },
      ],
      rows: [
        {
          f_date: "2021/5/1",
          f_category: "示例一",
          f_value: 3,
        },
        {
          f_date: "2021/5/2",
          f_category: "示例一",
          f_value: 14,
        },
        {
          f_date: "2021/5/3",
          f_category: "示例一",
          f_value: 11,
        },
        {
          f_date: "2021/5/1",
          f_category: "示例二",
          f_value: 3,
        },
        {
          f_date: "2021/5/2",
          f_category: "示例二",
          f_value: 7,
        },
        {
          f_date: "2021/5/3",
          f_category: "示例二",
          f_value: 8,
        },
        {
          f_date: "2021/5/1",
          f_category: "示例三",
          f_value: 5,
        },
        {
          f_date: "2021/5/2",
          f_category: "示例三",
          f_value: 4,
        },
        {
          f_date: "2021/5/3",
          f_category: "示例三",
          f_value: 7,
        },
        {
          f_date: "2021/5/1",
          f_category: "示例四",
          f_value: 6,
        },
        {
          f_date: "2021/5/2",
          f_category: "示例四",
          f_value: 8,
        },
        {
          f_date: "2021/5/3",
          f_category: "示例四",
          f_value: 9,
        }
      ]
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
    let showTooltip = this.getOption<boolean>("tooltip");
    let tooltipBackground = backgroundImage?.relativePath ? `url("${projectId}/${backgroundImage.relativePath}")` : backgroundColor;

    let tooltipStyle = this.getOption("tooltip-text-type");
    let tooltipDecimalPlaces = this.getOption<number>("tooltip-decimal-places");
    let tooltipCompleteZero = this.getOption<boolean>("tooltip-complete-zero");
    return {
      show: showTooltip,
      trigger: 'axis',
      axisPointer: {
        show: showTooltip,
        type: 'line',
        label: {
          show: false
        },
        lineStyle: {
          color: '#fff',
          width: 1,
          type: 'dashed'
        }
      },
      padding: [paddingHeight, paddingWidth, paddingHeight, paddingWidth],
      extraCssText: `
        background: ${tooltipBackground};
        background-size: 100% 100%;
        background-repeat: no-repeat;
        background-position: center center;
        border-radius: ${radius}px;
        backdrop-filter: blur(${backgroundBlur}px);
        border:none;
        z-index:0;
      `,
      formatter: (params) => {
        let dataHtml = "";
        let seriesNameSet = new Set();
        let titleHtml = "";
        for (let param of params || []) {
          let iconHtml = showIcon ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${param.color};"></span>` : "";
          let val = param.data[1];
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
            <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${param.name}：</span>
            <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${val}</span>
          </div>`;
          seriesNameSet.add(param.seriesName);
          titleHtml = showTitle ? `<div>
          <span style="color:${titleFontColor};font-size:${titleFontSize}px;line-height:1;">${param.value[0]}</span>
        </div>` : "";
        }

        return `
          <div>
            ${titleHtml}
            <div>${dataHtml}</div>
          </div>
        `;
      },
    }
  }

  get axisDate() {
    return this.getOption<OptionFieldValue[]>("axis-date") || [];
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
        ...this.axisDate,
        ...this.axisCategory,
        ...this.axisValue,
      ]
    } as WidgetMetaData);
  }

  _datasetSource() {
    return this.createView(["axis-date", "axis-category", "axis-value"]);
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
      this.selectedIndex.value = params.dataIndex;
      this.selectedData.value = {
        name: params.name,
        value: params.value
      }

      // 点击同一个点，取消选中
      if (state.lastDataIndex === params.dataIndex && state.lastseriesIndex === params.seriesIndex) {
        state.lastDataIndex = -1;
        state.lastseriesIndex = -1;
        this.selectedIndex.value = -1;
        this.selectedData.value = null;
        this.withdrawLinkage();
        this.echartsChart.dispatchAction({
          type: 'unselect',
          seriesIndex: params.seriesIndex,
          dataIndex: params.dataIndex
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
        state.lastDataIndex = params.dataIndex;
        state.lastseriesIndex = params.seriesIndex;
        this.echartsChart.dispatchAction({
          type: 'select',
          seriesIndex: params.seriesIndex,
          dataIndex: params.dataIndex
        })

        let uids = this.getOption("axis-category")?.[0]?.uid;
        if (uids?.length) {
          let fieldArr = this.getOption<string>("linkage-form-field")?.split(".")
          let fieldUIDs;
          let filterValue;
          if (fieldArr?.length) {
            if (fieldArr.length === 2) {
              fieldUIDs = [uids[0], ...fieldArr];
              filterValue = this.datasetSource()[params.dataIndex]?.[fieldArr[1]];
            } else if (fieldArr.length === 3) {
              fieldUIDs = [uids[0], fieldArr[0], `${fieldArr[1]}.${fieldArr[2]}`];
              filterValue = this.datasetSource()[params.dataIndex]?.[fieldArr[1]].map(item => item[fieldArr[2]]);
            }
          }
          this.applyLinkage({ uid: fieldUIDs as OptionFieldUID, value: filterValue });
        }
      }

    })
  }
}

