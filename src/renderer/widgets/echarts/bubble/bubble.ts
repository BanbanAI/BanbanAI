import { PrivateDataConnectionUID, PrivateDataTableUID, OptionFieldUID } from "@common/types/project";
import { DefinedOptions, OptionFontValue, OptionFieldValue, WidgetMetaData, ChartClickState } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { Widget } from "@renderer/b2/controllers/widget";
import { formatFloat } from "@common/utils/math";
import { TheWidget as Scatter, component as B2Scatter } from "@renderer/widgets/echarts/scatter";
import { SeriesOption } from "echarts/dist/echarts";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { merge, recursive } from "merge";

export class Bubble extends Scatter {
  static resource = recursive(true, Scatter.resource, resource);

  public yMin: number = 0;
  public yMax: number = 0;
  public imgArr: any = [];
  public canvasArr: any = [];
  static defineOptions(): DefinedOptions[] {
    const UNIT_GE = i18next.t("unitGe");
    return [{
      data: {
        fields: {
          alias: i18next.t("fieldsSetting"),
          fold: "unfold",
          children: [
            {
              name: "axis-group",
              alias: i18next.t("axisGroup"),
              type: "field(recommend=string, min=0, max=1)",
              visible: false,
            },
            {
              name: "axis-size",
              alias: i18next.t("axisSize"),
              type: "field",
              default: [{ "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_3"], "__opt_type": "field", "summary": "" }],
              visible: true
            },
            {
              name: "axis-image",
              alias: i18next.t("axisImage"),
              type: "field(recommend=string, max=1)",
              default: [{ "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_4"], "__opt_type": "field", "summary": "" }],
              visible: false
            },
          ]
        }
      },
      style: {
        "series-shape": {
          children: [
            {
              name: "series-shape-default-cluster",
              children: [
                {
                  name: "bubble-size-min",
                  type: "number(unit=px, min=0)",
                  alias: i18next.t("bubbleSizeMin"),
                  default: 5,
                },
                {
                  name: "scatter-size",
                  visible: false
                },
                {
                  name: "bubble-size-max",
                  type: "number(unit=px, min=0)",
                  alias: i18next.t("bubbleSizeMax"),
                  default: 30,
                },
                {
                  name: "bubble-outline-width",
                  type: "number(unit=px)",
                  alias: i18next.t("bubbleOutlineWidth"),
                  default: 0,
                },
                {
                  name: "bubble-outline-color",
                  type: "color",
                  alias: i18next.t("bubbleOutlineColor"),
                  default: '#1890ff',
                },
                {
                  name: "point-stroke-width",
                  visible: false
                },
                {
                  name: "point-stroke-color",
                  visible: false
                },
                {
                  name: "shape-column-number",
                  alias: i18next.t("shapeColumnNumber"),
                  type: "number(unit=" + UNIT_GE + ")",
                  default: 10,
                  visible: (widget: Widget) => {
                    return widget.getOption("series-shape-number-type") === "custom";
                  },
                },
                {
                  name: "series-shape-shadow-color",
                  visible: false
                },
                {
                  name: "series-shape-shadow-blur",
                  visible: false
                },
                {
                  name: "unified-shape-type",
                  visible: false
                },
                {
                  name: "unified-shape-show-dots",
                  visible: false
                },
                {
                  name: "unified-dot-shape-type",
                  visible: false
                },
                {
                  name: "unified-dot-size",
                  visible: false
                },
                {
                  name: "unified-shape-size",
                  visible: false
                },
                {
                  name: "series-shape-custom",
                  visible: false
                },
                {
                  name: "shape-image-percent",
                  alias: i18next.t("shapeImagePercent"),
                  type: "number(unit=%)",
                  default: 90,
                  visible: false,
                },
                {
                  name: "shape-show-line",
                  alias: i18next.t("shapeShowLine"),
                  type: "boolean",
                  default: false,
                  visible: false,
                },
                {
                  name: "shape-line-width",
                  alias: i18next.t("shapeLineWidth"),
                  type: "number(unit=px)",
                  default: 2,
                  visible: (widget: Widget) => {
                    return widget.getOption<boolean>("shape-show-line");
                  },
                },
                {
                  name: "shape-line-color",
                  alias: i18next.t("shapeLineColor"),
                  type: "color",
                  default: "#ccc",
                  visible: (widget: Widget) => {
                    return widget.getOption<boolean>("shape-show-line");
                  },
                },
              ]
            },
          ]
        },
      }
    }, ...super.defineOptions()]
  }

  checkErrorData() {
    let yDims = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let xDims = this.getOption<OptionFieldValue[]>("axis-x") || [];
    if(xDims?.length && yDims?.length) {
      this.clearErrorDataStatus();
    } else if(!xDims?.length && !yDims?.length) {
      this.addErrorDataStatus("filed-empty");
    } else {
      this.addErrorDataStatus("filed-incomplete");
    }
  }

  _datasetSource(addImage = false) {
    let dataSource = [];
    let yDims = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let xDims = this.getOption<OptionFieldValue[]>("axis-x") || [];
    let groupDims = this.getOption<OptionFieldValue[]>("axis-group") || [];
    let sDims = this.getOption<OptionFieldValue[]>("axis-size") || [];
    let imageDims = this.getOption<OptionFieldValue[]>("axis-image") || [];
    let sizeUid = sDims?.[0]?.uid?.[2];
    let imageUid = imageDims?.[0]?.uid?.[2];
    this.yMin = Infinity;
    this.yMax = 0;
    if (xDims?.length && yDims?.length) {
      let source;
      if (addImage) {
        source = this.createView(["axis-x", "axis-y", "axis-size", "axis-image"]);
      } else {
        source = this.createView(["axis-x", "axis-y", "axis-size"]);
      }
      let yDims = this.getOption<OptionFieldValue[]>("axis-y");
      if (groupDims?.length > 0) {
        if (yDims[0].summary === "sum") {
          let targetUids = sizeUid ? [yDims[0].uid, sDims[0].uid] : [yDims[0].uid];
          source = this.aggregateYData(
            source,
            [xDims[0].uid[2], groupDims[0].uid[2]],
            targetUids
          );
        }
        let yUid = yDims[0].uid[2];
        let types = [];
        let xFields = []
        source.forEach(row => {
          xFields.push(row[xDims[0].uid[2]]);
          types.push(row[groupDims[0].uid[2]]);
        })
        types = Array.from(new Set(types));
        xFields = Array.from(new Set(xFields));
        this.xTypes = types;

        // 统计每一个分类的总值用于排序
        let groups = {};
        types.forEach(type => {
          source.forEach(row => {
            if (row[groupDims[0].uid[2]] === type) {
              let xVal = row[xDims[0].uid[2]];
              if (groups[xVal] === undefined) groups[xVal] = 0;
              groups[xVal] += this.getMetric(row, yDims[0]);
            }
          });
        });
        let min = Infinity;
        let max = -Infinity;
        source.forEach(row => {
          let xVal = row[xDims[0].uid[2]];
          row["sumVal"] = groups[xVal];
          dataSource.push(row);
          if (sizeUid) {
            const sizeVal = this.getMetric(row, sDims?.[0]);
            min = Math.min(sizeVal, min);
            max = Math.max(sizeVal, max);
          } else {
            const val = this.getMetric(row, yDims[0]);
            min = Math.min(val, min);
            max = Math.max(val, max);
          }
        })
        this.yMin = min;
        this.yMax = max;
      } else {
        source = this.dealDataByAggregate(source, [xDims[0]], yDims);

        let uids = [];
        yDims.forEach(dim => {
          uids.push(dim.uid[2]);
        });
        // 计算总和
        let min = Infinity;
        let max = -Infinity;
        source.forEach(row => {
          let sumVal = 0;
          uids.forEach(uid => {
            const val = this.getMetric(row, yDims.find(dim => dim.uid[2] === uid));
            sumVal += val;
            if (sizeUid) {
              const sizeVal = this.getMetric(row, sDims?.[0]);
              min = Math.min(sizeVal, min);
              max = Math.max(sizeVal, max);
            } else {
              min = Math.min(val, min);
              max = Math.max(val, max);
            }
          })
          uids.forEach(uid => {
            row[uid] = sumVal
          })
          row["sumVal"] = sumVal;
          if (addImage) {
            row["imgUrl"] = row[imageUid];
          }
          dataSource.push(row);
        })
        this.yMin = min;
        this.yMax = max;
      }

    } else {
      let fieldTypeUids = this.getPrivateFieldTypeUids();
      this.getPrivateData()?.rows?.forEach((dataItem) => {
        let nameUid = fieldTypeUids.string?.[0];
        let valueUid = fieldTypeUids.number?.[0];
        let sizeUid = fieldTypeUids.number?.[1] || fieldTypeUids.number?.[0];
        let imgUid = fieldTypeUids.string?.[1];
        this.yMin = Math.min(this.yMin, dataItem[sizeUid]);
        this.yMax = Math.max(this.yMax, dataItem[sizeUid]);
        dataSource.push({
          name: dataItem[nameUid],
          value: dataItem[valueUid],
          size: dataItem[sizeUid],
          imgUrl: dataItem[imgUid] || ""
        })
      });
    }
    dataSource = this.getDataAfterSort(dataSource);
    return dataSource;
  }

  get boundaryGap() { // 两侧留白 会影响网格线对齐
    return true;
  }

  get showImage() {
    return false;
  }

  get showBubble() {
    return true;
  }

  getLegendOtherOption() {
    let yDims = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let groupDims = this.getOption<OptionFieldValue[]>("axis-group") || [];
    let hasGroup = groupDims.length > 0;
    let lineNum = hasGroup ? this.xTypes.length : yDims.length;
    let data = [];
    for (let i = 0; i < lineNum; i++) {
      data.push({
        name: hasGroup ? this.xTypes[i] : this.getFieldAlias(yDims[i].uid),
        icon: "circle",
        itemStyle: { color: this.getSeriesColors()[i] }
      })
    }
    return {
      data: data?.length ? data : undefined
    }
  }

  get echartsSeriesOption(): SeriesOption | SeriesOption[] {
    let yDims = this.getOption<OptionFieldValue[]>("axis-y");
    let xDims = this.getOption<OptionFieldValue[]>("axis-x");
    let groupDims = this.getOption<OptionFieldValue[]>("axis-group") || [];
    let sizeDims = this.getOption<OptionFieldValue[]>("axis-size");
    let sizeUid = sizeDims?.[0]?.uid[2];
    let data = this.datasetSource()
    let hasGroup = groupDims?.length > 0;
    let that = this;
    let minSize = this.getOption<number>("bubble-size-min");
    let maxSize = this.getOption<number>("bubble-size-max");
    let imagePercent = this.getOption<number>("shape-image-percent") * 0.01;
    let showLine = this.getOption<boolean>("shape-show-line");
    let lineWidth = this.getOption<number>("shape-line-width");
    let lineColor = new Color(this.getOption<Color>("shape-line-color")).hexa();
    let shadowColor = this.toEchartsColor(this.getOption("point-shadow-color"));
    let shadowBlur = this.getOption<number>("point-shadow-blur");
    let shadowOffsetX = this.getOption<number>("point-shadow-offset-x");
    let shadowOffsetY = this.getOption<number>("point-shadow-offset-y");
    let unitFont = this.getOption<OptionFontValue>("label-unit-font");
    let imgIndex = 0
    if (!xDims?.length || !yDims?.length) {
      let seriesOpt = [];
      if (that.showBubble) {
        seriesOpt.push({
          name: "value",
          type: "scatter",
          encode: {
            x: "name",
            y: "value",
          },
          symbolSize: function (data) {
            let val = data?.["size"];
            return (val - that.yMin) / (that.yMax - that.yMin) * (maxSize - minSize) + minSize;
          },
          xAxisIndex: 0,
          yAxisIndex: 0,
          silent: false,
        });
      }

      if (that.showImage) {
        seriesOpt.push({
          name: "value",
          type: "scatter",
          encode: {
            x: "name",
            y: "value",
          },
          symbol: (parame) => {
            if(imgIndex >= data?.length){
              imgIndex = 0
            }
            ++imgIndex;
            return this.imgArr[imgIndex-1]
          },
          symbolSize: function (parame) {
            let val = parame?.["size"];
            return ((val - that.yMin) / (that.yMax - that.yMin) * (maxSize - minSize) + minSize) * imagePercent;
          },
          itemStyle: {
            color: "red"
          },
          xAxisIndex: 0,
          yAxisIndex: 0,
          silent: false,
        });
      }
      if (showLine) {
        //竖线
        seriesOpt.push({
          name: "value",
          type: "custom",
          renderItem: (params, api) => {
            let xValue = api.value("name");
            let point = api.coord([xValue, api.value("value")]);
            let point0 = api.coord([xValue, 0]);
            return {
              type: "line",
              shape: {
                x1: point[0],
                y1: point[1],
                x2: point[0],
                y2: point0[1]
              },
              style: {
                lineWidth: lineWidth,
                lineDash: [lineWidth * 2, lineWidth * 2],
                stroke: lineColor
              }
            }
          },
          tooltip: {
            show: false
          },
          encode: {
            x: "name",
            y: "value",
          },
          xAxisIndex: 0,
          yAxisIndex: 0,
          silent: true,
        });
      }
      return seriesOpt;
    } else {
      let seriesOpt = [];
      let seriesColor = this.getSeriesColors();


      let bubbleOutlineWidth = this.getOption("bubble-outline-width");
      let bubbleOutlineColor = this.toEchartsColor(this.getOption("bubble-outline-color"))
      let labelFont = this.getOption<OptionFontValue>("label-font");
      let isPercent = this.getOption("label-text-type") === "percent";
      let labelDecimalPlaces = this.getOption<number>("label-decimal-places");
      let isComplete = this.getOption<boolean>("label-complete-zero");
      let colorFollow = this.getOption("label-color-type") === "follow";
      let lineNum = hasGroup ? this.xTypes.length : yDims.length;
      for (let index = 0; index < lineNum; index++) {
        let name = hasGroup ? this.getFieldAlias(yDims[0].uid) : this.getFieldAlias(yDims[index].uid);
        if (hasGroup) {
          name = this.xTypes[index];
        }

        if (that.showBubble) {
          const yDim = hasGroup ? yDims[0] : yDims[index];
          const encodeY = this.getMetricFieldKey(yDim, xDims);
          seriesOpt.push({
            name,
            type: "scatter",
            encode: {
              x: xDims[0].uid[2],
              y: encodeY,
            },
            symbolSize: function (data) {
              let val = sizeUid ? data[sizeUid] : hasGroup ? data[yDims[0].uid[2]] : data[yDims[index].uid[2]];
              return (val - that.yMin) / (that.yMax - that.yMin) * (maxSize - minSize) + minSize;
            },
            xAxisIndex: 0,
            yAxisIndex: 0,
            silent: false,
            markLine: this.markLineOption,
            itemStyle: {
              color: seriesColor[index],
              borderColor: bubbleOutlineColor,
              borderWidth: bubbleOutlineWidth,
              shadowBlur: shadowBlur,
              shadowColor: shadowColor,
              shadowOffsetX: shadowOffsetX,
              shadowOffsetY: shadowOffsetY
            },
            label: {
              show: this.getOption("label"),
              position: "top",
              formatter: (param) => {
                let unit = this.getOption<string>("label-unit-value");
                let val = param.value[param.dimensionNames[param.encode.y[0]]];
                if (!isPercent) {
                  val = formatFloat(val, labelDecimalPlaces, isComplete);
                } else {
                  val = formatFloat(val * 100, labelDecimalPlaces, isComplete) + "%";
                }
                return `{value|${val}}{unit|${unit}}`;
              },
              rich: {
                value: {
                  color:colorFollow ? seriesColor[index] : this.toEchartsColor(labelFont.color as Color),
                  fontWeight: labelFont.bold ? "bold" : "normal",
                  fontStyle: labelFont.italic ? "italic" : "normal",
                  fontSize: labelFont.size,
                  fontFamily: labelFont.family,
                },
                unit: {
                  color: unitFont.color,
                  fontWeight: unitFont.bold ? "bold" : "normal",
                  fontStyle: unitFont.italic ? "italic" : "normal",
                  fontSize: unitFont.size,
                  fontFamily: unitFont.family,
                }
              }
            }
          })
        }

        if (that.showImage) {
          const yDim = hasGroup ? yDims[0] : yDims[index];
          const encodeY = this.getMetricFieldKey(yDim, xDims);
          seriesOpt.push({
            name,
            type: "scatter",
            encode: {
              x: xDims[0].uid[2],
              y: encodeY
            },
            itemStyle: {
              color: seriesColor[index],
            },
            symbol: (parame) => {
              if(imgIndex >= data?.length){
                imgIndex = 0
              }
              ++imgIndex;
              return this.imgArr[imgIndex-1]
            },
            symbolSize: function (data) {
              let val = sizeUid ? data[sizeUid] : hasGroup ? data[yDims[0].uid[2]] : data[yDims[index].uid[2]];
              return ((val - that.yMin) / (that.yMax - that.yMin) * (maxSize - minSize) + minSize) * imagePercent;
            },
            xAxisIndex: 0,
            yAxisIndex: 0,
            silent: false,
          })
        }

        if (showLine) {
          //竖线
          const yDim = hasGroup ? yDims[0] : yDims[index];
          const encodeY = this.getMetricFieldKey(yDim, xDims);
          seriesOpt.push({
            name: "value",
            type: "custom",
            encode: {
              x: xDims[0].uid[2],
              y: encodeY,
            },
            renderItem: (params, api) => {
              let xValue = api.value(params.encode.x);
              let point = api.coord([xValue, api.value(params.encode.y)]);
              let point0 = api.coord([xValue, 0]);
              return {
                type: "line",
                shape: {
                  x1: point[0],
                  y1: point[1],
                  x2: point[0],
                  y2: point0[1]
                },
                style: {
                  lineWidth: lineWidth,
                  lineDash: [lineWidth * 2, lineWidth * 2],
                  stroke: lineColor
                }
              }
            },
            tooltip: {
              show: false
            },
            xAxisIndex: 0,
            yAxisIndex: 0,
            silent: true,
          });
        }
      }
      return seriesOpt;
    }
  }

  get axisSize() {
    return this.getOption<OptionFieldValue[]>("axis-size") || [];
  }

  override getMetaData() {
    return merge(super.getMetaData(), {
      axisValue: [
        ...this.axisX,
        ...this.axisY,
        ...this.axisSize
      ]
    } as WidgetMetaData);
  }

  initEchartsEvents(): void {
    super.initEchartsEvents();
    // const state: ChartClickState = {
    //   lastseriesIndex: -1,
    //   lastDataIndex: -1
    // };

    // this.echartsChart.off("click");
    // this.echartsChart.on('click', (params) => {
    //   this.selectedIndex.value = params.dataIndex;
    //   this.processClick(params, state);

    // })
  }
}
