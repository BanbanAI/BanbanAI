import { PrivateData, PrivateDataConnectionUID, PrivateDataTableUID } from "@common/types/project";
import { DefinedOptions, OptionFontValue, OptionFileValue, OptionFieldValue, WidgetMetaData } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { formatFloat } from "@common/utils/math";
import { TheWidget as Line, component as B2Line } from "@renderer/widgets/echarts/line";
import { SeriesOption, TooltipComponentOption } from "echarts/dist/echarts";
import i18next from "@renderer/widgets/i18next";
import { merge, recursive } from "merge";
import  resource  from "./locales"
export class RoadMap extends Line {
  static resource = recursive(true, Line.resource, resource);
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
                alias: i18next.t("axis-x"),
                type: "field",
                default: [{ "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_value1"], "__opt_type": "field", "summary": "sum" }]
              },
              {
                name: "axis-y",
                alias: i18next.t("axis-y"),
                type: "field(aggs=sum|none|max|min|mean|count|distinct, min=0)",
                default: [{ "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_value2"], "__opt_type": "field", "summary": "sum" }]
              },
              {
                name: "axis-line",
                visible: false
              },
              {
                name: "axis-group",
                visible: false
              },
              {
                name: "axis-catalog",
                alias: i18next.t("axis-catalog"),
                type: "field",
                default: [{ "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_catalog"], "__opt_type": "field", "summary": "" }]
              },
            ],
          },
          sort: {
            visible: false
          }
        },
        style: {
          "axis": {
            children: [
              {
                name: "x-display-cluster",
                children: [
                  {
                    name: "x-data-type",
                    default: "value",
                  },
                ]
              }
            ]
          },
          "series-shape": {
            alias: i18next.t("series-shape"),
            children: [
              {
                name:"series-shape-default-cluster",
                alias: i18next.t("seriesShapeDefault"),
                show: "tab",
                children: [
                  {
                    name: "series-shape-number-type",
                    visible: false
                  },
                  {
                    name: "series-shape-custom",
                    visible: false
                  },
                  {
                    name: "series-shape-cluster",
                    visible: false
                  },
                  {
                    name:"flow-light-show",
                    visible:false
                  }
                ]
              },
              {
                name: "series-shape-number-type",
                visible: false
              },
            ],
          },
          "ranking-text":{
            visible: false
          },
          "label-group": {
            children: [
              {
                name: "ranking-cluster",
                visible: false,
                children: []
              }
            ]
          },
        },
      },
      ...super.defineOptions(),
    ];
  }

  get echartsTooltipOption(): TooltipComponentOption | TooltipComponentOption[] {
    let backgroundColor = new Color(this.getOption<Color>("tooltip-background-color")).toCssString();
    let backgroundImage = this.getOption<OptionFileValue>("tooltip-background-image");
    let backgroundBlur = this.getOption<OptionFileValue>("tooltip-background-blur");
    let paddingWidth = this.getOption<number>("tooltip-padding-width");
    let paddingHeight = this.getOption<number>("tooltip-padding-height");
    let radius = this.getOption<number>("tooltip-radius");
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

    let catUids = this.getOption("axis-catalog")?.[0]?.uid;
    let xUids = this.getOption("axis-x")?.[0]?.uid;
    let yUids = this.getOption("axis-y")?.[0]?.uid;
    let catAlias = "";
    let xAlias = "";
    let yAlias = "";
    if (catUids && xUids && yUids) {
      catAlias = this.getFieldAlias(catUids);
      xAlias = this.getFieldAlias(xUids);
      yAlias = this.getFieldAlias(yUids);
    }

    return {
      trigger: this.tooltipTrigger,
      axisPointer: this.tooltipAxisPointer,
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
          if (seriesNameSet.has(param.seriesName)) continue;

          let keyX = param.dimensionNames[param.encode.x[0]];
          let keyY = param.dimensionNames[param.encode.y[0]];
          let keyCat = param.dimensionNames.filter(e => e !== keyX && e !== keyY)[0];
          let valY = param.value[keyY];
          let valX = param.value[keyX];
          let catalog = param.value[keyCat];
          if (tooltipStyle === "normal") {
            valY = formatFloat(valY, tooltipDecimalPlaces, tooltipCompleteZero);
            valX = formatFloat(valX, tooltipDecimalPlaces, tooltipCompleteZero);
          } else if (tooltipStyle === "percent") {
            valY = formatFloat(valY * 100, tooltipDecimalPlaces, tooltipCompleteZero) + "%";
            valX = formatFloat(valX * 100, tooltipDecimalPlaces, tooltipCompleteZero) + "%";
          }
          if(commaDisplay){
            valY = this.doCommaSeparat(valY)
            valX = this.doCommaSeparat(valX)
          }
          dataHtml += `<div>
            <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${catAlias || keyCat}：</span>
            <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${catalog}</span>
          </div>
          <div>
            <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${xAlias || keyX}：</span>
            <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${valX}</span>
          </div>
          <div>
            <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${yAlias || keyY}：</span>
            <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${valY}</span>
          </div>`;
          seriesNameSet.add(param.seriesName);
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
    }
  }

  protected getDefaultPrivateData(): PrivateData {
    return {
      fields: [
        { uid: "f_value1", alias: "x轴", type: "number" },
        { uid: "f_value2", alias: "y轴", type: "number" },
        { uid: "f_catalog", alias: "分类", type: "string" }
      ],
      rows: [
        { f_value1: 48, f_value2: 100, f_catalog: "示例1" },
        { f_value1: 135, f_value2: 230, f_catalog: "示例2" },
        { f_value1: 20, f_value2: 180, f_catalog: "示例3" },
        { f_value1: 85, f_value2: 60, f_catalog: "示例4" },
        { f_value1: 50, f_value2: 280, f_catalog: "示例5" },
      ],
    };
  }

  _datasetSource() {
    let yDims = this.getOption<OptionFieldValue[]>("axis-y");
    let xDims = this.getOption<OptionFieldValue[]>("axis-x");
    let catDims = this.getOption<OptionFieldValue[]>("axis-catalog");
    if (xDims?.length && yDims?.length && catDims?.length) {
      let source = this.createView(["axis-x", "axis-y", "axis-catalog"]);
      source = this.dealDataByAggregate(source,  [catDims[0], xDims[0]], yDims);
      let yUid = yDims[0].uid[2];
      // 计算总和
      let newSource = [];
      source.forEach(row => {
        let sumVal = this.getMetric(row, yDims[0]);
        this.writeMetricToRow(row, yDims[0], xDims)
        row["sumVal"] = sumVal;
        newSource.push(row);
      })
      return this.getDataAfterSort(newSource);
    } else {
      let privateData = this.getPrivateData();
      return privateData.rows.map(row => {
        return {
          xValue: row["f_value1"],
          yValue: row["f_value2"],
          catalog: row["f_catalog"]
        }
      });
    }
  }

  stackType() {
    return "none";
  }

  checkErrorData() {
    let yDims = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let xDims = this.getOption<OptionFieldValue[]>("axis-x") || [];
    let catDims = this.getOption<OptionFieldValue[]>("axis-catalog") || [];
    if (!xDims.length || !yDims.length || !catDims.length) {
      if (!xDims.length && !yDims.length && !catDims.length) {
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
    let catDims = this.getOption<OptionFieldValue[]>("axis-catalog") || [];
    if (!xDims.length || !yDims.length || !catDims.length) {
      return {
        name: "value",
        type: "line",
        stack: this.stackType(),
        encode: {
          x: "xValue",
          y: "yValue",
        },
        xAxisIndex: 0,
        yAxisIndex: 0,
        silent: true,
      }
    } else {
      let seriesOpt = [];
      let seriesColor = this.getSeriesColors();
      let shapeCustom = this.getOption("series-shape-custom");
      let lineShapes = this.getSeriesShapes();
      let symbolShapes = this.getSeriesPointShape();
      let symbolSizes = this.getSeriesPointSize();
      let lineSizes = this.getSeriesSizes();
      let labelFont = this.getOption<OptionFontValue>("label-font");
      let isPercent = this.getOption("label-text-type") === "percent";
      let labelDecimalPlaces = this.getOption<number>("label-decimal-places");
      let isComplete = this.getOption<boolean>("label-complete-zero");
      let colorFollow = this.getOption("label-color-type") === "follow";
      let unitFont = this.getOption<OptionFontValue>("label-unit-font");
      let unit = this.getOption<string>("label-unit-value");
      let name = this.getFieldAlias(yDims[0].uid);
      seriesOpt.push({
        name,
        type: "line",
        encode: {
          x: xDims[0].uid[2],
          y: yDims[0].uid[2],
        },
        color: seriesColor[0],
        stack: this.stackType(),
        xAxisIndex: 0,
        yAxisIndex: 0,
        silent: true,
        symbol: shapeCustom ? symbolShapes[0] : symbolShapes[0],
        markLine: this.markLineOption,
        smooth: shapeCustom ? lineShapes[0].smooth : lineShapes[0].smooth,
        symbolSize: shapeCustom ? symbolSizes[0] : symbolSizes[0],
        lineStyle: {
          type: shapeCustom ? lineShapes[0].lineType : lineShapes[0].lineType,
          shadowColor: this.toEchartsColor(this.getOption("series-shape-shadow-color")),
          shadowBlur: this.getOption("series-shape-shadow-blur"),
          width: shapeCustom ? lineSizes[0] : lineSizes[0],
        },
        label: {
          show: this.getOption("label"),
          position: "top",
          formatter: (param) => {
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
              color: colorFollow ? seriesColor[0] : this.toEchartsColor(labelFont.color as Color),
              fontWeight: labelFont.bold ? "bold" : "normal",
              fontStyle: labelFont.italic ? "italic" : "normal",
              fontSize: labelFont.size,
              fontFamily: labelFont.family,
            },
            unit: {
              fontSize: unitFont.size,
              fontWeight: unitFont.bold ? "bold" : "normal",
              fontStyle: unitFont.italic ? "italic" : "normal",
              fontFamily: unitFont.family || "sans-serif",
              color: this.toEchartsColor(unitFont.color as Color)
            }
          }
        }
      });
      return seriesOpt;
    }
  }

  get echartsDataZoomOption() {
    let type = this.getOption("series-shape-number-type");
    let orient:any = this.transposed ? "vertical" : "horizontal"
    if (type === "all" || !type) {
      return [
        {
          type: "inside",
          zoomLock: true,
          show: false,
          start: 0,
          end: 100,
          orient,
          preventDefaultMouseMove: false
        }
      ];
    }
  }


  get axisCatalog() {
    return this.getOption<OptionFieldValue[]>("axis-catalog") || [];
  }

  override getMetaData() {
    return merge(super.getMetaData(), {
      axisValue: [
        ...this.axisX,
        ...this.axisY,
        ...this.axisCatalog
      ]
    } as WidgetMetaData);
  }
}
