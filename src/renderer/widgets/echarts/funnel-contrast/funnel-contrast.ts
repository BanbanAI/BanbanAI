import { PrivateData, PrivateDataConnectionUID, PrivateDataTableUID } from "@common/types/project";
import { DefinedOptions, OptionFontValue, OptionFileValue, OptionFieldValue, WidgetMetaData } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { Widget } from "@renderer/b2/controllers/widget";
import { formatFloat } from "@common/utils/math";
import { TheWidget as Funnel, component as B2Chart } from "@renderer/widgets/echarts/funnel";
import { TooltipComponentOption, XAXisComponentOption, YAXisComponentOption, SeriesOption, EChartsOption } from "echarts/dist/echarts";
import i18next from "@renderer/widgets/i18next";
import resource from "./locales";
import { merge, recursive } from "merge";

export class FunnelContrast extends Funnel {
  noDims: Boolean = false;
  static resource:any = recursive(true, Funnel.resource, resource);
  static defineOptions(): DefinedOptions[] {
    return [
      {
        data: {
          fields: {
            alias: i18next.t("fieldsSetting"),
            fold: "unfold",
            children: [
              {
                name: "axis-category",
                type: "field(recommend=string, max=1)",
                alias: i18next.t("axisCategory"),
                default: [{ "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_type"], "__opt_type": "field", "summary": "" }]
              },
              {
                name: "axis-value1",
                type: "field(aggs=sum|none|max|min|mean|count|distinct, max=1)",
                alias: i18next.t("axisValue1"),
                default: [{ "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_value1"], "__opt_type": "field", "summary": "sum" }]
              },
              {
                name: "axis-value2",
                type: "field(aggs=sum|none|max|min|mean|count|distinct, max=1)",
                alias: i18next.t("axisValue2"),
                default: [{ "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_value2"], "__opt_type": "field", "summary": "sum" }]
              },
              {
                name: "axis-fields",
                visible: false
              },
              {
                name: "axis-value",
                visible:false
              },
            ]
          },
        },
        style: {
          "label-group": {
            children: [
              {
                name: "label-default-cluster",
                children: [
                  {
                    name: "label-type-cluster",
                    visible:false,
                    children: [],
                  },
                  {
                    name: "label-font-cluster",
                    children: [
                      {
                        name:"label-text-row",
                        visible:false
                      },
                    ]
                  },

                ]
              }
            ]
          },
          "series-shape": {
            children: [
              {
                name: "series-shape-default-cluster",
                children: [
                  {
                    name: "funnel-shape",
                    visible:false
                  },
                  {
                    name:"funnel-direction",
                    visible:false
                  },
                  {
                    name: "funnel-border-width",
                    default: 2,
                  }
                ]
              },
            ]
          },
          legend: {
            children: [
              {
                name: "legend-value",
                type: "boolean",
                default: false,
                alias: i18next.t("legendValue"),
                visible: false
              },
              {
                name: 'legend-value-cluster' ,
                alias: i18next.t("legendValueCluster"),
                visible: (widget: Widget) => { return widget.getOption("legend-value") },
                children: [
                  {
                    name: "legend-value-type",
                    alias: i18next.t("legendValueType"),
                    default: "normal",
                    type: "select(radioGroup)",
                    selectChoices: [
                      {
                        label: i18next.t("legendValueTypeNormal"),
                        value: "normal"
                      },
                      {
                        label: i18next.t("legendValueTypePercent"),
                        value: "percent"
                      },
                    ],
                  },
                  {
                    name: "legend-value-decimal-places",
                    alias: i18next.t("valueDecimalPlaces"),
                    type: "number",
                    default: 0,
                  },
                  {
                    name: "legend-value-complete-zero",
                    alias: i18next.t("valueCompleteZero"),
                    type: "boolean",
                    default: false,
                  },
                  {
                    name: "legend-value-font",
                    alias: i18next.t("valueFont"),
                    type: "font",
                    default: {
                      color: "#fff",
                      size: 12,
                      bold: false,
                      italic: false,
                    },
                  },
                ]
              }
            ],
          },
          tooltip: {
            alias: i18next.t("tooltip"),
            type: "boolean",
            default: true,
            children: [
              {
                name: "tooltip-label-style",
                show: "tab",
                children: [
                  {
                    name: "tooltip-unit",
                    type: "boolean",
                    default: false,
                    visible: true
                  },
                ],
              },
            ],
          },
          padding: {
            visible: false,
          },
          sort: {
            visible: false
          }
        }
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

    let showUnit = this.getOption<boolean>("tooltip-unit");
    let unitText = this.getOption<boolean>("tooltip-unit-text");
    let unitFontColor = new Color(this.getOption<Color>("tooltip-unit-font-color")).hexa();
    let unitFontSize = this.getOption<number>("tooltip-unit-font-size");

    let tooltipValueType = this.getOption<string>("tooltip-text-type");
    let tooltipValueDecimalPlaces = this.getOption<number>("tooltip-decimal-places");
    let tooltipValueCompleteZero = this.getOption<boolean>("tooltip-complete-zero");

    const projectId = this.getBoard().projectId;
    const seriesCssColors = this.getSeriesCssColors();
    let showTooltip = this.getOption<boolean>("tooltip");
    let tooltipBackground = backgroundImage?.relativePath ? `url("${projectId}/${backgroundImage.relativePath}")` : backgroundColor;
    let data = this.echartsData;
    return [{
      trigger: 'item',
      // confine: true,
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
      formatter: (param) => {
        let dataHtml = "";
        let iconHtml = showIcon ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${param.color};"></span>` : "";
        let unitHtml = showUnit ? `<span style="color:${unitFontColor};font-size:${unitFontSize}px;line-height:1;">${unitText}</span>` : "";
        let resultValue: any = data[0][param.dataIndex].value
        let resultValue2: any = data[1][param.dataIndex].value
        if (isNaN(resultValue)) resultValue = 0;

        if (tooltipValueType === "normal") {
          resultValue = formatFloat(resultValue, tooltipValueDecimalPlaces, tooltipValueCompleteZero);
          resultValue2 = formatFloat(resultValue2, tooltipValueDecimalPlaces, tooltipValueCompleteZero);
        } else {
          let sum = data[0].reduce((results, current) => {
            return results + current.value
          }, 0)
          let sum2 = data[1].reduce((results, current) => {
            return results + current.value
          }, 0)

          resultValue = parseFloat((resultValue / sum) * 100 as any)
          resultValue = formatFloat(resultValue, tooltipValueDecimalPlaces, tooltipValueCompleteZero) + '%';
          resultValue2 = parseFloat((resultValue2 / sum2) * 100 as any)
          resultValue2 = formatFloat(resultValue2, tooltipValueDecimalPlaces, tooltipValueCompleteZero) + '%';
        }
        if(commaDisplay){
          resultValue = this.doCommaSeparat(resultValue)
          resultValue2 = this.doCommaSeparat(resultValue2)
        }
        dataHtml += `<div>
          ${iconHtml}
          <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${data[0][param.dataIndex]?.field || '预期'}：</span>
          <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${param.name}： ${resultValue}</span>
          ${unitHtml}
          </br>
          ${iconHtml}
          <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${data[1][param.dataIndex]?.field || '实际'}：</span>
          <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${param.name}： ${resultValue2}</span>
          ${unitHtml}
          </div>`;
        let titleHtml = showTitle ? `<div>
          <span style="color:${titleFontColor};font-size:${titleFontSize}px;line-height:1;">${param.seriesName}</span>
        </div>` : "";
        return `
          <div>
            ${titleHtml}
            <div>${dataHtml}</div>
          </div>
        `;
      },
    },
    ]
  }

  getLegendOtherOption() {
    let sourceData = this.echartsData;
    let legendData = [];
    sourceData[0].forEach(item => {
      legendData.push(item.name);
    })

    return {
      data: legendData,
    }
  }

  protected getDefaultPrivateData(): PrivateData {
    return {
      fields: [
        { uid: "f_value1", alias: "预期", type: "number" },
        { uid: "f_type", alias: "分类", type: "string" },
        { uid: "f_value2", alias: "实际", type: "number" }
      ],
      rows: [
        { f_value1: 100, f_type: '访问', f_value2: 80 },
        { f_value1: 80, f_type: '浏览', f_value2: 50 },
        { f_value1: 60, f_type: '下单', f_value2: 30 },
        { f_value1: 40, f_type: '交互', f_value2: 10 },
        { f_value1: 30, f_type: '完成', f_value2: 5 }
      ],
    };
  }

  checkErrorData() {
    let dataOpt = this.getOption<OptionFieldValue[]>("axis-category") || [];
    let dataValue1 = this.getOption<OptionFieldValue[]>("axis-value1") || [];
    let dataValue2 = this.getOption<OptionFieldValue[]>("axis-value2") || [];
    if (!dataOpt.length || (!dataValue1.length || !dataValue2.length)) {
      if(!dataOpt.length && !dataValue1.length && !dataValue2.length) {
        this.addErrorDataStatus("filed-empty");
      } else {
        this.addErrorDataStatus("filed-incomplete");
      }
    } else {
      this.clearErrorDataStatus();
    }
  }

  _datasetSource() {
    let source = this.createView(["axis-category", "axis-value1", "axis-value2"]);
    source = this.dealDataByAggregate(source, [this.axisCategory[0]], [...this.axisValue1, ...this.axisValue2]);
    return source;
  }

  _getEchartsData() {
    let resultData = [];
    let sampleData = [];
    let tempData = [];
    let handleData = [];
    let dataOpt = this.getOption<OptionFieldValue[]>("axis-category") || [];
    let dataValue1 = this.getOption<OptionFieldValue[]>("axis-value1") || [];
    let dataValue2 = this.getOption<OptionFieldValue[]>("axis-value2") || [];
    let dataMap = new Map();
    if (!dataOpt.length || (!dataValue1.length || !dataValue2.length)) {
      let privateData = this.getPrivateData();
      let data1 = [], data2 = [];
      privateData.rows.forEach(row => {
        data1.push({
          value: row["f_value1"],
          name: row["f_type"],
          self_row_data: row,
        });
        data2.push({
          value: row["f_value2"],
          name: row["f_type"],
          self_row_data: row,
        });
      });
      sampleData.push(data1, data2);
      return sampleData;
    } else {
      let funnelData = this.datasetSource();
      let dataInfo1 = [];
      let dataInfo2 = [];
      for (let i = 0; i < funnelData.length; i++) {
        const row = funnelData[i];
        dataInfo1.push({ value: this.getMetric(row, dataValue1[0]), name: row[dataOpt[0]?.uid[2]], field: this.getFieldAlias(dataValue1[0].uid), self_row_data: row, })
        dataInfo2.push({ value: this.getMetric(row, dataValue2[0]), name: row[dataOpt[0]?.uid[2]], field: this.getFieldAlias(dataValue2[0].uid), self_row_data: row, })
      }

      dataInfo1.sort((a, b) => {
        return b.value - a.value;
      })
      resultData.push(dataInfo1)
      tempData = dataInfo2;
    }

    resultData[0].forEach((item, index) => {
      for (let i = 0; i < tempData.length; i++) {
        if (tempData[i].name === item.name) {
          handleData.push(tempData[i]);
        }
      }
    })
    resultData.push(handleData)
    dataMap.clear();
    return resultData;
  }

  get echartsOptionFunc(): {[key: string]: Function} {
    return {
      grid: ()=>this.echartsGridOption,
      tooltip: ()=>this.echartsTooltipOption,
      xAxis: ()=>this.echartsXAxisOption,
      yAxis: ()=>this.echartsYAxisOption,
      legend: ()=>this.echartsLegendOption,
      series: ()=>this.echartsSeriesOption,
      dataset: ()=>this.echartsDatasetOption(),
      color: ()=>this.getSerieEchartsColors()
    };
  }

  get echartsSeriesOption(): SeriesOption | SeriesOption[] {
    let labelNameFont = this.getOption<OptionFontValue>("label-font");
    let labelPosition = this.getOption<string>("label-position");

    let funnelSpacing = this.getOption<number>("funnel-spacing") || 0;
    let funnelBorderWidth = this.getOption<number>("funnel-border-width");
    let funnelBorderColor = this.getOption<string>("funnel-border-color");
    let unitFont = this.getOption<OptionFontValue>("label-unit-font");
    let unit = this.getOption<string>("label-unit-value");
    let dataSouce = this.echartsData;
    let dataValue1 = [];
    let dataValue2 = [];
    let data1 = [];

    dataSouce[0].forEach((item) => {
      data1.push({ value: item.value, name: item.name });
      dataValue1.push(item.value);
    });
    dataSouce[1].forEach((item) => {
      dataValue2.push(item.value);
    });

    let max1 = Math.max(...dataValue1);
    let max2 = Math.max(...dataValue2);
    let name1 = dataSouce[0][0]?.field || 'Expected';
    let name2 = dataSouce[1][0]?.field || 'Actual';

    return [
      {
        name: name1,
        type: 'funnel',
        left: '10%',
        width: '80%',
        sort: "none",
        max: max1,
        gap:funnelSpacing,
        label: {
          show: this.getOption<boolean>("label") && labelPosition !== 'inside',
          color: this.toEchartsColor(labelNameFont.color as Color),
          formatter: (param) => {
            return `{value|${param.value}}{unit|${unit}}`;
          },
          rich:{
            value:{
              fontSize: labelNameFont.size,
              fontWeight: labelNameFont.bold ? "bold" : "normal",
              fontStyle: labelNameFont.italic ? "italic" : "normal",
              fontFamily: labelNameFont.family || "sans-serif",
            },
            unit:{
              color: this.toEchartsColor(unitFont.color as Color),
              fontWeight: unitFont.bold ? "bold" : "normal",
              fontStyle: unitFont.italic ? "italic" : "normal",
              fontSize: unitFont.size,
              fontFamily: unitFont.family,
            }
          },
          position:labelPosition
        },
        labelLine: {
          show: false
        },
        itemStyle: {
          borderColor: funnelBorderColor,
          borderWidth: funnelBorderWidth
        },
        emphasis: {
          label: {
            show: this.getOption<boolean>("label"),
            color: this.toEchartsColor(labelNameFont.color as Color),
            fontSize: labelNameFont.size,
            fontWeight: labelNameFont.bold ? "bold" : "normal",
            fontStyle: labelNameFont.italic ? "italic" : "normal",
            fontFamily: labelNameFont.family || "sans-serif",
          },
        },
        data: dataSouce[0]
      },
      {
        name: name2,
        type: 'funnel',
        left: '10%',
        width: '80%',
        max: max2,
        maxSize: '80%',
        sort: "none",
        gap:funnelSpacing,
        itemStyle: {
          borderColor: funnelBorderColor,
          borderWidth: funnelBorderWidth,
          opacity: 0.7,

        },
        label: {
          show: this.getOption<boolean>("label") && labelPosition == 'inside',
          color: this.toEchartsColor(labelNameFont.color as Color),
          formatter: (param) => {
            return `{value|${param.value}}{unit|${unit}}`;
          },
          rich:{
            value:{
              fontSize: labelNameFont.size,
              fontWeight: labelNameFont.bold ? "bold" : "normal",
              fontStyle: labelNameFont.italic ? "italic" : "normal",
              fontFamily: labelNameFont.family || "sans-serif",
            },
            unit:{
              color: this.toEchartsColor(unitFont.color as Color),
              fontWeight: unitFont.bold ? "bold" : "normal",
              fontStyle: unitFont.italic ? "italic" : "normal",
              fontSize: unitFont.size,
              fontFamily: unitFont.family,
            }
          },
          position:labelPosition
        },
        emphasis: {
          label: {
            show: labelPosition == 'inside'
          }
        },
        data: dataSouce[1],
        z: 100
      }
    ]
  }

  get axisValue1() {
    return this.getOption<OptionFieldValue[]>("axis-value1") || [];
  }

  get axisValue2() {
    return this.getOption<OptionFieldValue[]>("axis-value2") || [];
  }

  override getMetaData() {
    return merge(super.getMetaData(), {
      axisValue: [
        ...this.axisCategory,
        ...this.axisValue1,
        ...this.axisValue2,
      ]
    } as WidgetMetaData);
  }

  initEchartsEvents(): void {
    super.initEchartsEvents();
  }
}
