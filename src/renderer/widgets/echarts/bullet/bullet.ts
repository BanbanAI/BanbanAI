import { PrivateData, PrivateDataConnectionUID, PrivateDataTableUID, OptionFieldUID } from "@common/types/project";
import { DefinedOptions, OptionFieldValue, WidgetMetaData, ChartClickState } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { OptionValue } from "@common/types/project";
import { formatFloat } from "@common/utils/math";
import { TheWidget as Echarts, component as B2Chart, } from "@renderer/widgets/echarts/basic";
import { GridComponentOption, XAXisComponentOption, YAXisComponentOption, SeriesOption, EChartsOption } from "echarts/dist/echarts";
import i18next from "@renderer/widgets/i18next";
import resource from "./locales";
import { merge, recursive } from "merge";
import { watch, ref, Ref } from "vue";
export class Bullet extends Echarts {
  static resource:any = recursive(true, Echarts.resource, resource);
  static defineOptions(): DefinedOptions[] {
    return [
      {
        data: {
          fields: {
            alias: i18next.t("fieldsSetting"),
            fold: "unfold",
            children: [
              {
                name: "axis-fields",
                alias: i18next.t("axisFields"),
                type: "field",
                visible: false,
              },
              {
                name: "axis-title",
                type: "field(recommend=string)",
                alias: i18next.t("axisTitle"),
                visible: true,
                default: [
                  {
                    "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_title"],
                    "__opt_type": "field",
                    "summary": ""
                  }
                ]
              },
              {
                name: "axis-ranges",
                type: "field(recommend=string)",
                alias: i18next.t("axisRanges"),
                visible: true,
                default: [
                  {
                    "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_ranges"],
                    "__opt_type": "field",
                    "summary": ""
                  }
                ]
              },
              {
                name: "axis-actual",
                type: "field(min=0, max=1)",
                alias: i18next.t("axisActual"),
                visible: true,
                default: [
                  {
                    "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_actual"],
                    "__opt_type": "field",
                    "summary": ""
                  }
                ]
              },
              {
                name: "axis-target-value",
                type: "field(min=0, max=1)",
                alias: i18next.t("axisTargetValue"),
                visible: true,
                default: [
                  {
                    "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_target"],
                    "__opt_type": "field",
                    "summary": ""
                  }
                ]
              },
            ],
          },
        },
        style: {
          basic: {
            visible: true,
          },
          sort: {
            visible: false
          },
          "series-color": {
            visible: false
          },
          scale: {
            alias: i18next.t("scale"),
            children: [
              {
                name: "basic-style",
                alias: i18next.t("basicStyle"),
                show: "tab",
                children: [
                  {
                    name: "ranges-logo",
                    default: "差,良,优",
                    type: "string",
                    alias: i18next.t("rangesLogo"),
                    visible: true,
                  },
                  {
                    name: "dial-color",
                    default: ["#9B999B", "#C2C2C2", "#EFEFEF"],
                    type: "palette(gradient)",
                    alias: i18next.t("dialColor"),
                  },
                  {
                    name: "calibration-scale-space",
                    default: 50,
                    type: "number(unit=px, min=0, max=180, step=1, showInput,unit=px)",
                    alias: i18next.t("calibrationScaleSpace"),
                  }
                ]
              },
              {
                name: "range-max",
                alias: i18next.t("rangeMax"),
                show: "tab",
                children: [
                  {
                    name: "ranges-max-visible",
                    type: "boolean",
                    default: false,
                    alias: i18next.t("rangesMaxVisible"),
                  },
                  {
                    name: "ranges-max-font-color",
                    default: "#fff",
                    type: "color(gradient)",
                    alias: i18next.t("rangesMaxFontColor"),
                    disabled: (bullet: Bullet) => {
                      return bullet.getOption("ranges-max-visible") !== true;
                    },
                  },
                  {
                    name: "ranges-max-font-size",
                    default: 12,
                    type: "number(min=0, max=180, step=1, showInput, unit=px)",
                    alias: i18next.t("rangesMaxFontSize"),
                    disabled: (bullet: Bullet) => {
                      return bullet.getOption("ranges-max-visible") !== true;
                    },
                  },
                  {
                    name: "ranges-max-unit",
                    default: "",
                    type: "string",
                    alias: i18next.t("rangesMaxUnit"),
                    disabled: (bullet: Bullet) => {
                      return bullet.getOption("ranges-max-visible") !== true;
                    },
                  },
                ]
              },
              {
                name: "actual-data",
                alias: i18next.t("actualData"),
                show: "tab",
                children: [
                  {
                    name: "actual-width",
                    alias: i18next.t("actualWidth"),
                    default: 30,
                    type: "number(unit=px, min=0, max=180, step=1, showInput, unit=px)",
                  },
                  {
                    name: "actual-color",
                    alias: i18next.t("actualColor"),
                    default: "#000000",
                    type: "color(gradient)",
                  },
                  {
                    name: "actual-text-visible",
                    alias: i18next.t("actualTextVisible"),
                    type: "boolean",
                    default: false,
                  },
                  {
                    name: "actual-font-color",
                    default: "#ffffff",
                    alias: i18next.t("actualFontColor"),
                    type: "color(gradient)",
                    visible: (bullet: Bullet) => {
                      return bullet.getOption("actual-text-visible") === true;
                    },
                  },
                  {
                    name: "actual-font-size",
                    alias: i18next.t("actualFontSize"),
                    default: 12,
                    type: "number(min=0, max=180, step=1, showInput, unit=px)",
                    visible: (bullet: Bullet) => {
                      return bullet.getOption("actual-text-visible") === true;
                    },
                  },
                  {
                    name: "actual-unit",
                    alias: i18next.t("actualUnit"),
                    default: "",
                    type: "string",
                    visible: (bullet: Bullet) => {
                      return bullet.getOption("actual-text-visible") === true;
                    },
                  },
                ],
              },
              {
                name: "actual-orderData",
                alias: i18next.t("actualOrderData"),
                show: "tab",
                children: [
                  {
                    name: "actual-orderWidth",
                    alias: i18next.t("actualOrderWidth"),
                    default: 80,
                    type: "number(unit=px, min=0, max=180, step=1, showInput, unit=px)",
                  },
                ],
              },
              {
                name: "actual-label",
                alias: i18next.t("actualLabel"),
                show: "tab",
                children: [
                  {
                    name: "actual-label-size",
                    default: 12,
                    alias: i18next.t("actualLabelSize"),
                    type: "number(min=0, max=180, step=1, showInput, unit=px)",
                  },
                  {
                    name: "actual-label-color",
                    default: "#fff",
                    alias: i18next.t("actualLabelColor"),
                    type: "color(gradient)",
                  },
                ],
              },
              {
                name: "actual-target",
                alias: i18next.t("actualTarget"),
                show: "tab",
                children: [
                  {
                    name: "target-width",
                    alias: i18next.t("targetWidth"),
                    default: 34,
                    type: "number(unit=px, min=0, max=180, step=1, showInput, unit=px)",
                  },
                  {
                    name: "target-color",
                    default: "#000000",
                    alias: i18next.t("targetColor"),
                    type: "color(gradient)",
                  },
                  {
                    name: "target-text-visible",
                    alias: i18next.t("targetTextVisible"),
                    type: "boolean",
                    default: false,
                  },
                  {
                    name: "target-font-color",
                    alias: i18next.t("targetFontColor"),
                    default: "#fff",
                    type: "color(gradient)",
                    visible: (bullet: Bullet) => {
                      return bullet.getOption("target-text-visible") === true;
                    },
                  },

                  {
                    name: "target-font-size",
                    alias: i18next.t("targetFontSize"),
                    default: 12,
                    type: "number(min=0, max=180, step=1, showInput, unit=px)",
                    visible: (bullet: Bullet) => {
                      return bullet.getOption("target-text-visible") === true;
                    },
                  },
                  {
                    name: "target-unit",
                    alias: i18next.t("targetUnit"),
                    default: "",
                    type: "string",
                    visible: (bullet: Bullet) => {
                      return bullet.getOption("target-text-visible") === true;
                    },
                  },
                ],
              },
            ],
          },
          font: {
            alias: i18next.t("font"),
            children: [
              {
                name: "font-size",
                alias: i18next.t("fontSize"),
                default: 14,
                type: "number(unit=px, min=0, max=180, step=1, showInput, unit=px)",
              },
              {
                name: "label-color",
                default: "#FFFFFF",
                alias: i18next.t("labelColor"),
                type: "color(gradient)",
              },
            ],
          },
          "label-group": {
            visible: false,
            default: false,
          },
          tooltip: {
            visible: true,
          },
        },
      },
      ...super.defineOptions(),
    ];
  }

  get echartsSeriesOption(): SeriesOption | SeriesOption[] {
    const seriesCssColors = this.getOption('dial-color');
    let showIcon = this.getOption<boolean>("tooltip-icon");
    let commaDisplay = this.getOption<boolean>("tooltip-comma-display")
    let nameFontColor = new Color(this.getOption<Color>("tooltip-name-font-color")).hexa();
    let nameFontSize = this.getOption<number>("tooltip-name-font-size");
    let valueFontColor = new Color(this.getOption<Color>("tooltip-value-font-color")).hexa();
    let valueFontSize = this.getOption<number>("tooltip-value-font-size");
    let showTitle = this.getOption<boolean>("tooltip-title");
    let titleFontColor = new Color(this.getOption<Color>("tooltip-title-font-color")).hexa();
    let titleFontSize = this.getOption<number>("tooltip-title-font-size");
    let tooltipStyle = this.getOption("tooltip-text-type");
    let tooltipDecimalPlaces = this.getOption<number>("tooltip-decimal-places");
    let tooltipCompleteZero = this.getOption<boolean>("tooltip-complete-zero");
    let legendName = this.getOption<OptionValue>(["ranges-logo"]).toString().split(',');
    let seriesInfo = [];
    this.echartsData.map((item, index) => {
      let num = 0  //每个数据总和
      let lastNum = 0 //ranges最后一个数值
      item.ranges.map((sum, keys) => {
        if (keys === (item.ranges.length - 1)) {
          lastNum = Number(sum);
        }
        num += Number(sum);
      })
      item.ranges.map((content, key) => {
        if (key === item.ranges.length - 1) {
          seriesInfo.push({
            name: legendName[key],
            data: [{
              value: content - item.ranges[key - 1],
              originalIndex: index
            }],
            type: 'bar',
            yAxisIndex: 2 * index,
            stack: "range" + index,
            silent: false,
            label: {
              position: 'right',
              color: this.toEchartsColor(this.getOption(["ranges-max-font-color"])),
              show: this.getOption("ranges-max-visible"),
              formatter: (param) => {
                return `${lastNum}${this.getOption(["ranges-max-unit"])}`
              },
              fontSize: this.getOption(["ranges-max-font-size"]),
            },
            barWidth: this.getOption(["actual-orderWidth"]),
            color: this.toEchartsColor(seriesCssColors[key]),
            xAxisIndex: index,
            tooltip: {
              show: false
            }
          })
        } else {
          seriesInfo.push({
            name: legendName[key],
            data: [{
              value: key === 0 ? content : content - item.ranges[key - 1],
              originalIndex: index
            }],
            type: 'bar',
            yAxisIndex: 2 * index,
            stack: "range" + index,
            silent: false,
            barWidth: this.getOption(["actual-orderWidth"]),
            color: this.toEchartsColor(seriesCssColors[key]),
            xAxisIndex: index,
            tooltip: {
              show: false
            }
          })
        }
      })
      seriesInfo.push({
        name: "实际值",
        data: [{
          value: item.actual,
          originalIndex: index
        }],
        type: 'bar',
        barWidth: this.getOption(["actual-width"]),
        label: {
          color: this.toEchartsColor(this.getOption(["actual-font-color"])),
          show: this.getOption(["actual-text-visible"]),
          formatter: (param) => {
            return `${param.value}${this.getOption(["actual-unit"])}`
          },
          fontSize: this.getOption(["actual-font-size"]),
        },
        yAxisIndex: 1 + 2 * index,
        xAxisIndex: index,
        color: this.toEchartsColor(this.getOption(["actual-color"])),
        z: 3,
        tooltip: {
          trigger: "item",
          show: true,
          formatter: (params) => {
            let dataHtml = "";
            let seriesNameSet = new Set();
            let iconHtml = showIcon ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${params.color};"></span>` : "";
            let val = params.value;
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
                    <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${params.seriesName}：</span>
                    <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${val}</span>
                  </div>`;
            let titleHtml = showTitle ? `<div>
                    <span style="color:${titleFontColor};font-size:${titleFontSize}px;line-height:1;">${item.title}</span></div>` : "";
            return `<div>${titleHtml}<div>${dataHtml}</div></div>`;
          },
        }
      },
        {
          name: "目标值",
          type: "scatter",
          symbol: "rect",
          symbolSize: [5, this.getOption(["target-width"])],
          data: [{
            value: item.target,
            originalIndex: index
          }],
          color: this.toEchartsColor(this.getOption(["target-color"])),
          label: {
            position: "insideLeft",
            distance: 15,
            show: this.getOption(["target-text-visible"]),
            color: this.toEchartsColor(this.getOption(["target-font-color"])),
            fontSize: this.getOption(["target-font-size"]),
            formatter: (param) => {
              return `${param.value}${this.getOption(["target-unit"])}`
            },
          },
          hoverAnimation: false,
          z: 4,
          yAxisIndex: index * 2,
          xAxisIndex: index,
          tooltip: {
            trigger: "item",
            show: true,
            formatter: (params) => {
              let dataHtml = "";
              let iconHtml = showIcon ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${params.color};"></span>` : "";
              let val = params.value;
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
                    <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${params.seriesName}：</span>
                    <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${val}</span>
                  </div>`;
              let titleHtml = showTitle ? `<div>
                    <span style="color:${titleFontColor};font-size:${titleFontSize}px;line-height:1;">${item.title}</span></div>` : "";
              return `<div>${titleHtml}<div>${dataHtml}</div></div>`;
            },
          }
        }
      )
    })
    return seriesInfo as SeriesOption;
  }
  useSampleDatas() {
    let data = { alias: [], columns: [], data: [] };
    let sample_data = this.getPrivateData();
    let fieldsNumber = []
    let fieldsString = []
    data = sample_data?.rows;

    sample_data?.fields?.map?.(item => {
      if (item.type === "number") {
        fieldsNumber.push(item)
      }
      if (item.type === "string") {
        fieldsString.push(item)
      }
    })

    return {
      title_dimension: fieldsString[0],
      ranges_dimension: fieldsString[1],
      actual_dimension: fieldsNumber[0],
      target_dimension: fieldsNumber[1],
      data,
    };
  }

  checkErrorData() {
    let title_dimensions: any = this.getOption<OptionFieldValue[]>("axis-title") || [];
    let ranges_dimensions: any = this.getOption<OptionFieldValue[]>("axis-ranges") || [];
    let actual_dimensions: any = this.getOption<OptionFieldValue[]>("axis-actual") || [];
    let target_dimensions: any = this.getOption<OptionFieldValue[]>("axis-target-value") || [];
    if ( title_dimensions.length > 0 && ranges_dimensions.length > 0 && actual_dimensions.length > 0 && target_dimensions.length > 0 ) {
      this.clearErrorDataStatus();
    } else if(!title_dimensions.length && !ranges_dimensions.length && !actual_dimensions.length && !target_dimensions.length) {
      this.addErrorDataStatus("filed-empty");
    } else {
      this.addErrorDataStatus("filed-incomplete");
    }
  }

  _datasetSource() {
    let sourceData = this.createView(["axis-title", "axis-ranges", "axis-actual", "axis-target-value"]);
    if (this.axisTitle[0]?.uid?.[2]?.split(".")?.length > 1
      && this.axisRanges[0]?.uid?.[2]?.split(".")?.length > 1
      && this.axisActual[0]?.uid?.[2]?.split(".")?.length > 1
      && this.axisTargetValue[0]?.uid?.[2]?.split(".")?.length > 1
    ) {
      sourceData = this.flatDataset(sourceData, [...([...this.axisTitle, ...this.axisRanges, ...this.axisActual, ...this.axisTargetValue].map(dim => dim.uid[2]))]);
    }
    return this.getDataAfterSort(sourceData);
  }

  get echartsData() {
    let resultData = [];
    let title_dimensions: any = this.getOption<OptionFieldValue[]>("axis-title") || [];
    let ranges_dimensions: any = this.getOption<OptionFieldValue[]>("axis-ranges") || [];
    let actual_dimensions: any = this.getOption<OptionFieldValue[]>("axis-actual") || [];
    let target_dimensions: any = this.getOption<OptionFieldValue[]>("axis-target-value") || [];
    let dataView = null;
    if (!title_dimensions.length || !ranges_dimensions.length || !actual_dimensions.length || !target_dimensions.length) {
      let sample_data = this.useSampleDatas();
      dataView = sample_data.data;
      title_dimensions = sample_data.title_dimension;
      ranges_dimensions = sample_data.ranges_dimension;
      actual_dimensions = sample_data.actual_dimension;
      target_dimensions = sample_data.target_dimension;

      for (let i = 0; i < dataView.length; i++) {
        let dataInfo = {
          title: dataView[i][title_dimensions?.uid],
          ranges: dataView[i][ranges_dimensions?.uid].split(","),
          actual: dataView[i][actual_dimensions?.uid],
          target: dataView[i][target_dimensions?.uid],
        };
        resultData.push(dataInfo);
      }
    } else if ( title_dimensions.length > 0 && ranges_dimensions.length > 0 && actual_dimensions.length > 0 && target_dimensions.length > 0 ) {
      dataView = this._datasetSource();
      let title_uid = title_dimensions[0];
      let ranges_uid = ranges_dimensions[0];
      let actual_dimension = actual_dimensions[0];
      let target_dimension = target_dimensions[0];
      for (let i = 0; i < dataView?.length; i++) {
        let dataInfo = {
          title: dataView[i][title_uid.uid[2]],
          ranges: dataView[i][ranges_uid.uid[2]].split(","),
          actual: dataView[i][actual_dimension.uid[2]],
          target: dataView[i][target_dimension.uid[2]],
        };
        resultData.push(dataInfo);
      }
    }
    return resultData;
  }

  get echartsGridOption(): GridComponentOption | GridComponentOption[] {
    let gridPadding = this.padding;
    let gridTop = this.getOption<any>(["calibration-scale-space"]);
    let size = this.contentSize.height - gridPadding.bottom;
    let result = [];
    this.echartsData.map((item, index) => {
      result.push(
        {
          containLabel: true,
          height: gridTop,
          left: 30 + gridPadding.left,
          right: 30 + gridPadding.right,
          top: 10 + (size / this.echartsData.length) * index + gridPadding.top,
        },
      );
    });
    return result
  }
  get echartsYAxisOption(): YAXisComponentOption | YAXisComponentOption[] {
    let yAxisInfo = [];
    this.echartsData.map((item, index) => {
      yAxisInfo.push(
        {
          type: "category",
          data: [`${item.title}`],
          axisLine: {
            show: false,
            alignWithLabel: false
          },
          offset: 12,
          axisLabel: {
            show: true,
            inside: true,
            fontSize: this.getOption(["font-size"]),
            color: this.toEchartsColor(this.getOption(["label-color"])),
            formatter: (value, index) => {
              return value
            },
            align: "right"
          },
          axisTick: {
            show: true,
          },
          gridIndex: index,
        },
        {
          type: "category",
          data: [""],
          axisLine: {
            show: false,
          },
          axisTick: {
            show: false,
          },
          gridIndex: index,
        }
      );
    });
    return yAxisInfo;
  }
  get echartsXAxisOption(): XAXisComponentOption | XAXisComponentOption[] {
    let xAxisInfo = [];
    this.echartsData.map((item, index) => {
      xAxisInfo.push({
        type: "value",
        axisLine: {
          show: false,
        },
        splitLine: {
          show: false
        },
        axisLabel: {
          fontSize: this.getOption(["actual-label-size"]),
          color: this.toEchartsColor(this.getOption(["actual-label-color"])),
        },
        minorTick: {
          show: false
        },
        axisTick: {
          show: false,
        },
        gridIndex: index,
      });
    });
    return xAxisInfo
  }
  protected getDefaultPrivateData(): PrivateData {
    return {
      fields: [
        { uid: "f_title", alias: "title", type: "string" },
        { uid: "f_ranges", alias: "ranges", type: "string" },
        { uid: "f_actual", alias: "actual", type: "number" },
        { uid: "f_target", alias: "target", type: "number" },
      ],
      rows: [
        {
          f_title: "财政收入",
          f_ranges: "150,225,300",
          f_actual: 270,
          f_target: 250
        },
        {
          f_title: "盈利率",
          f_ranges: "20,25,30",
          f_actual: 23,
          f_target: 26
        },
        {
          f_title: "平均成交额",
          f_ranges: "350,500,600",
          f_actual: 100,
          f_target: 550,
        },
        {
          f_title: "新客户数量",
          f_ranges: "1400,2000,2500",
          f_actual: 1650,
          f_target: 2100,
        },
        {
          f_title: "满意度",
          f_ranges: "3.5,4.25,5",
          f_actual: 3.2,
          f_target: 4.4
        },
      ]
    }
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
    };
  }

  get axisTargetValue() {
    return this.getOption<OptionFieldValue[]>("axis-target-value") || [];
  }

  get axisActual() {
    return this.getOption<OptionFieldValue[]>("axis-actual") || [];
  }

  get axisRanges() {
    return this.getOption<OptionFieldValue[]>("axis-ranges") || [];
  }

  get axisTitle() {
    return this.getOption<OptionFieldValue[]>("axis-title") || [];
  }

  override getMetaData() {
    return merge(super.getMetaData(), {
      axisValue: [
        ...this.axisTargetValue,
        ...this.axisActual,
        ...this.axisRanges,
        ...this.axisTitle
      ]
    } as WidgetMetaData);
  }

  initOptionWatch() {
    let penddingOpt = {};
    for (let key in this.echartsOptionFunc) {
      this.effectScope.run(() => {
        watch(() => {
          return {
            option: this.echartsOptionFunc[key](),
            data: this.datasetSource(), // 使用基类提供的公共方法替代私有属性
          }
        }, (val: any, oldVal) => {
          if (!this.status.isVisible) {
            penddingOpt[key] = val.option;
            return;
          }
          let newOpt = {};
          newOpt[key] = val.option;
          // 会触发多次，用 lazyUpdate: true 做优化
          if(key === "color" || (key.startsWith("animation") && typeof val.option !== "object")) {
            this.echartsChart.setOption(newOpt, {
              notMerge: false,
              lazyUpdate: true
            });
          } else {
            if(this?.isResourceLoading) return;
            if(key === "grid3D" && JSON.stringify(val.option) === JSON.stringify(oldVal?.option)) return;
            // 对于坐标轴相关配置，使用 notMerge 模式避免索引不匹配问题
            if (key === "xAxis" || key === "yAxis" || key === "grid" || key === "series") {
              // 当数据动态变化时，特别是从多到少的情况，完全重新创建配置
              this.echartsChart.setOption(this.echartsOption, {
                notMerge: true,
                lazyUpdate: true
              });
            } else {
              this.echartsChart.setOption(newOpt, {
                notMerge: false,
                replaceMerge: key,
                lazyUpdate: true
              });
            }
          }
        })
      })
    }

    // serise和datasetSource都需要处理
    watch(() => this.status.isVisible, (val)=>{
      if(val) {
        if (Object.keys(penddingOpt).length > 0) {
          this.echartsChart.setOption(penddingOpt);
          penddingOpt = {};
        }
        if(this["lastestSeries"] && JSON.stringify(this["lastestSeries"]) !== JSON.stringify(this["_series"].value)) {
          this["_series"].value = this["lastestSeries"];
          this["lastestSeries"] = null;
        }
      }
    }, {immediate: true});

    watch(()=>this.animationTriggerLinkage, (val)=>{
      if(!val){
        this.withdrawLinkage();
      }
    })
  }

  public selectedIndex: Ref<number> = ref(-1);

  initEchartsEvents(): void {
    const state: ChartClickState = {
      lastseriesIndex: -1,
      lastDataIndex: -1,
    };

    this.echartsChart.off("click");
    this.echartsChart.on('click', (params) => {
      const dataItem = params.data as any;
      const index = dataItem.originalIndex;

      if (index === undefined) return;

      if (state.lastDataIndex === index) {
        state.lastDataIndex = -1;
        this.selectedIndex.value = -1;
        this.withdrawLinkage();
      } else {
        state.lastDataIndex = index;
        this.selectedIndex.value = index;

        let uids = this.getOption("axis-title")?.[0]?.uid;
        if (uids?.length) {
          const row = this.datasetSource()[index];
          let fieldArr = this.getOption<string>("linkage-form-field")?.split(".")
          let fieldUIDs;
          let filterValue;
          if (fieldArr?.length) {
            if (fieldArr.length === 2) {
              fieldUIDs = [uids[0], ...fieldArr];
              filterValue = row[fieldArr[1]];
            } else if (fieldArr.length === 3) {
              fieldUIDs = [uids[0], fieldArr[0], `${fieldArr[1]}.${fieldArr[2]}`];
              filterValue = row[fieldArr[1]];
            }
          }
          // console.log("bullet", { uid: fieldUIDs as OptionFieldUID, value: filterValue });
          this.applyLinkage({ uid: fieldUIDs as OptionFieldUID, value: filterValue });
        }
      }

    });
  }
}
