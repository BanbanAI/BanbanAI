import { PrivateData, PrivateDataConnectionUID, PrivateDataTableUID } from "@common/types/project";
import { DefinedOptions, OptionFontValue, OptionFieldValue, ChartClickState } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { Widget } from "@renderer/b2/controllers/widget";
import { formatFloat } from "@common/utils/math";
import { TheWidget as Axis, component as B2Axis } from "@renderer/widgets/echarts/axis";
import { SeriesOption } from "echarts/dist/echarts";
import resource from "./locales"
import i18next from "@renderer/widgets/i18next";
import { recursive } from "merge";

export class Scatter extends Axis {
  static resource:any = recursive(true, Axis.resource, resource);
  static defineOptions(): DefinedOptions[] {
    return [{
      style: {
        "series-shape": {
          children: [
            {
              name: "series-shape-default-cluster",
              children: [
                {
                  name: "scatter-size",
                  type: "number(unit=px, min=0)",
                  alias: i18next.t("scatter-size"),
                  default: 5,
                },
                {
                  name: "point-stroke-width",
                  type: "number(unit=px, min=0)",
                  alias: i18next.t("point-stroke-width"),
                  default: 0,
                },
                {
                  name: "point-stroke-color",
                  type: "color",
                  alias: i18next.t("point-stroke-color"),
                  default: '#1890ff',
                },
                {
                  name: "point-shadow-color",
                  alias: i18next.t("point-shadow-color"),
                  type: "color",
                  default: "#ffffff",
                },
                {
                  name: "point-shadow-blur",
                  alias: i18next.t("point-shadow-blur"),
                  type: "number(unit=px)",
                  default: 0,
                },
                {
                  name: "point-shadow-offset-x",
                  alias: i18next.t("point-shadow-offset-x"),
                  type: "number(unit=px)",
                  default: 0,
                },
                {
                  name: "point-shadow-offset-y",
                  alias: i18next.t("point-shadow-offset-y"),
                  type: "number(unit=px)",
                  default: 0,
                },
                {
                  name: "shape-column-number",
                  alias: i18next.t("shape-column-number"),
                  type: "number(unit=" + i18next.t("unit_ge") + ")",
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
              ]
            },
          ]
        },
        "label-group": {
          children: [
            {
              name: "label-default-cluster",
              children: [
                {
                  name: "label-position",
                  visible: false
                },
              ]
            }
          ]
        }
      },
      data: {
        fields: {
          children: [
            {
              name: "axis-x",
              default: [{ "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_1"], "__opt_type": "field", "summary": "" }]
            },
            {
              name: "axis-y",
              default: [{ "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_2"], "__opt_type": "field", "summary": "sum" }]
            },
            {
              name: "axis-group",
              alias: i18next.t("axisGroup"),
              type: "field(recommend=string, min=0, max=1)",
              visible: false,
            }
          ]
        }
      }
    }, ...super.defineOptions()]
  }

  getSeriesCssColors() {
    return this.getSeriesColors();
  }

  protected getDefaultPrivateData(): PrivateData {
    return {
      fields: [
        { uid: "f_1", alias: "name", type: "string" },
        { uid: "f_2", alias: "value", type: "number" },
        { uid: "f_3", alias: "size", type: "number" },
        { uid: "f_4", alias: "imgUrl", type: "string" },
      ],
      rows: [
        { f_1: "示例1", f_2: 1048, f_3: 10 },
        { f_1: "示例2", f_2: 735, f_3: 16 },
        { f_1: "示例3", f_2: 580, f_3: 20 },
        { f_1: "示例4", f_2: 1005, f_3: 5 },
        { f_1: "示例5", f_2: 700, f_3: 30 },
      ],
    };
  }

  _datasetSource() {
    let dataSource = [];
    let yDims = this.getOption<OptionFieldValue[]>("axis-y");
    let xDims = this.getOption<OptionFieldValue[]>("axis-x");
    let groupDims = this.getOption<OptionFieldValue[]>("axis-group");
    let lineDims = this.getOption<OptionFieldValue[]>("axis-line");
    if (xDims?.length && (yDims?.length || lineDims?.length)) {
      let source = this.createView(["axis-x", "axis-y", "axis-line"]);
      if (groupDims?.length > 0) {
        // 两个x轴字段
        source = this.createView(["axis-x", "axis-y", "axis-group", "axis-line"]);
        let groupUid = groupDims[0].uid[2];
        let types = [];
        source.forEach(row => { types.push(row[groupUid]) });
        types = Array.from(new Set(types));
        this.xTypes = types;

        let valueDims = [];
        if (yDims?.length) {
          valueDims = valueDims.concat(yDims);
        }
        if (lineDims?.length) {
          valueDims = valueDims.concat(lineDims);
        }

        source = this.dealDataByAggregate(source, [xDims[0], groupDims[0]], valueDims);

        dataSource = source.map(row => {
          let group = row[groupUid];
          let valueUid = yDims?.[0]?.uid?.[2];
          let lineUid = lineDims?.[0]?.uid?.[2];

          for (let type of types) {
            if (type == group) {
              if (valueUid) row[`${valueUid}_${type}`] = this.getMetric(row, yDims?.[0]);
              if (lineUid) row[`${lineUid}_${type}`] = row[lineUid];
            } else {
              if (valueUid) row[`${valueUid}_${type}`] = "-";
              if (lineUid) row[`${lineUid}_${type}`] = "-";
            }
          }
          return row;
        });
      } else {
        let valueDims = [];
        if (yDims?.length) {
          valueDims = valueDims.concat(yDims);
        }
        if (lineDims?.length) {
          valueDims = valueDims.concat(lineDims);
        }
        source = this.dealDataByAggregate(source, [xDims[0]], valueDims);
        // 计算总和
        dataSource = source.map(row => {
          let sumVal = 0;
          valueDims.forEach(dim => {
            const val = this.writeMetricToRow(row, dim, xDims);
            sumVal += val ?? 0;
          })
          row["sumVal"] = sumVal;
          return row;
        });

      }
    } else {
      let privateData = this.getPrivateData();
      let fieldTypeUids = this.getPrivateFieldTypeUids();

      privateData?.rows?.forEach((dataItem) => {
        dataSource.push({
          name: dataItem?.[fieldTypeUids.string?.[0]],
          value: dataItem?.[fieldTypeUids.number?.[0]],
        })
      });
    }
    dataSource = this.getDataAfterSort(dataSource);

    let zeroRemoval = this.getOption("zero-removal");
    if (zeroRemoval) {
      dataSource.map((item) => {
        for (let key in item) {
          if (!isNaN(item[key]) && item[key] == 0) {
            item[key] = "-";
          }
        }
      });
    }
    return dataSource;
  }

  checkErrorData() {
    let yDims = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let xDims = this.getOption<OptionFieldValue[]>("axis-x") || [];
    if (!xDims?.length || !yDims?.length) {
      if (!xDims?.length && !yDims?.length) {
        this.addErrorDataStatus("filed-empty");
      } else {
        this.addErrorDataStatus("filed-incomplete");
      }
    } else {
      this.clearErrorDataStatus();
    }
  }

  get echartsSeriesOption(): SeriesOption | SeriesOption[] {
    let yDims = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let xDims = this.getOption<OptionFieldValue[]>("axis-x") || [];
    let groupDims = this.getOption<OptionFieldValue[]>("axis-group") || [];
    let scatterSize = this.getOption<number>("scatter-size");
    let hasGroup = groupDims.length > 0;
    if (!xDims?.length || !yDims?.length) {
      return {
        name: "value",
        type: "scatter",
        encode: {
          x: "name",
          y: "value",
        },
        symbolSize: scatterSize,
        xAxisIndex: 0,
        yAxisIndex: 0,
        silent: false,
      }
    } else {
      let seriesOpt = [];
      let seriesColor = this.getSeriesColors();
      let scatterOutlineWidth = this.getOption("point-stroke-width");
      let scatterOutlineColor = this.toEchartsColor(this.getOption("point-stroke-color"))
      let labelFont = this.getOption<OptionFontValue>("label-font");
      let isPercent = this.getOption("label-text-type") === "percent";
      let labelDecimalPlaces = this.getOption<number>("label-decimal-places");
      let isComplete = this.getOption<boolean>("label-complete-zero");
      let colorFollow = this.getOption("label-color-type") === "follow";
      let shadowColor = this.toEchartsColor(this.getOption("point-shadow-color"));
      let shadowBlur = this.getOption<number>("point-shadow-blur");
      let shadowOffsetX = this.getOption<number>("point-shadow-offset-x");
      let shadowOffsetY = this.getOption<number>("point-shadow-offset-y");
      let unitFont = this.getOption<OptionFontValue>("label-unit-font");
      let lineNum = hasGroup ? this.xTypes.length : yDims.length;
      for (let index = 0; index < lineNum; index++) {
        let name = hasGroup ? this.getFieldAlias(yDims[0].uid) : this.getFieldAlias(yDims[index].uid);
        if (hasGroup) {
          name = this.xTypes[index];
        }

        const yDim = hasGroup ? yDims[0] : yDims[index];
        const encodeY = this.getMetricFieldKey(yDim, xDims);
        seriesOpt.push({
          name,
          id: `${ hasGroup ? yDims[0].uid[2] : yDims[index].uid[2]}-scatter-${index}`,
          type: "scatter",
          encode: {
            x: xDims[0].uid[2],
            y: encodeY,
          },
          xAxisIndex: 0,
          yAxisIndex: 0,
          silent: false,
          markLine: this.markLineOption,
          symbolSize: scatterSize,
          itemStyle: {
            color: seriesColor[index],
            borderColor: scatterOutlineColor,
            borderWidth: scatterOutlineWidth,
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
        });
      }
      return seriesOpt;
    }
  }

  initEchartsEvents(): void {
    const state: ChartClickState = {
      lastseriesIndex: -1,
      lastDataIndex: -1
    };

    this.echartsChart.off("click");
    this.echartsChart.on('click', (params) => {
      this.selectedIndex.value = params.dataIndex;
      this.processClick(params, state);

    })
  }
}
