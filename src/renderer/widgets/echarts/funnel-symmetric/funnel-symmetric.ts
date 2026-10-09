import { PrivateData, PrivateDataConnectionUID, PrivateDataTableUID, OptionFieldUID } from "@common/types/project";
import { DefinedOptions, OptionFontValue, OptionFileValue, OptionFieldValue, WidgetMetaData, ChartClickState } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { Widget } from "@renderer/b2/controllers/widget";
import { formatFloat } from "@common/utils/math";
import { TheWidget as Funnel, component as B2Chart } from "@renderer/widgets/echarts/funnel";
import { TooltipComponentOption, XAXisComponentOption, YAXisComponentOption, SeriesOption, EChartsOption } from "echarts/dist/echarts";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { merge, recursive } from "merge";

export class FunnelSymmetric extends Funnel {
  noDims: Boolean = false;
  static resource:any = recursive(true, Funnel.resource, resource);

  static defineOptions(): DefinedOptions[] {
    const UNIT_WEI = i18next.t("unitWei");
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
                default: [{ "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_1"], "__opt_type": "field", "summary": "" }],
                alias: i18next.t("axisCategory")
              },
              {
                name: "axis-value1",
                type: "field(aggs=sum|none|max|min|mean|count|distinct, max=1)",
                default: [{ "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_2"], "__opt_type": "field", "summary": "sum" }],
                alias: i18next.t("axisValue1")
              },
              {
                name: "axis-value2",
                type: "field(aggs=sum|none|max|min|mean|count|distinct, max=1)",
                default: [{ "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_3"], "__opt_type": "field", "summary": "sum" }],
                alias: i18next.t("axisValue2")
              },
              {
                name: "axis-value",
                visible:false
              },
              {
                name: "axis-fields",
                visible: false
              }
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
                        name: "label-position",
                        default: "inside",
                        type: "select(radioGroup)",
                        selectChoices: [
                          {
                            label: i18next.t("labelPositionInside"),
                            value: 'inside'
                          },
                          {
                            label: i18next.t("labelPositionOutside"),
                            value: 'outside'
                          },
                        ]
                      },
                      {
                        name:"label-text-row",
                        visible:false
                      }
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
                    name: "funnel-margin",
                    alias: i18next.t("funnelMargin"),
                    type: "number(unit=px)",
                    default: 10
                  },
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
                name: 'legend-value-cluster',
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
                        label: i18next.t("valueTypeNormal"),
                        value: "normal"
                      },
                      {
                        label: i18next.t("valueTypePercent"),
                        value: "percent"
                      },
                    ],
                  },
                  {
                    name: "legend-value-decimal-places",
                    alias: i18next.t("valueDecimalPlaces"),
                    type: "number(unit=" + UNIT_WEI + ")",
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

  get echartsTitleOption(): any {
    let dataSouce = this.echartsData;
    let labelNameFont = this.getOption<OptionFontValue>("label-font");
    let labelColor = this.toEchartsColor(labelNameFont.color as Color);

    let funnelMargin = this.getOption<number>("funnel-margin");
    let funnelWidth = (this.contentSize.width - this.padding.left - this.padding.right - funnelMargin) / 2;

    return [{
      text: dataSouce[0][0]?.field,
      left: this.padding.left + funnelWidth / 2,
      top: 20 + this.padding.top,
      textAlign: "center",
      textStyle: {
        color: labelColor,
        fontSize: labelNameFont.size,
        fontWeight: labelNameFont.bold ? "bold" : "normal",
        fontStyle: labelNameFont.italic ? "italic" : "normal",
        fontFamily: labelNameFont.family || "sans-serif",
      },

    },
    {
      text: dataSouce[1][0]?.field,
      left: this.padding.left + funnelWidth + funnelMargin + funnelWidth / 2,
      textAlign: "center",
      top: 20 + this.padding.top,
      textStyle: {
        color: labelColor,
        fontSize: labelNameFont.size,
        fontWeight: labelNameFont.bold ? "bold" : "normal",
        fontStyle: labelNameFont.italic ? "italic" : "normal",
        fontFamily: labelNameFont.family || "sans-serif",
      },

    }]
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
        let resultValue: any = param.value;
        if (isNaN(resultValue)) resultValue = 0;

        if (tooltipValueType === "normal") {
          resultValue = formatFloat(resultValue, tooltipValueDecimalPlaces, tooltipValueCompleteZero);
        } else {
          let sum = this.echartsData[param.seriesIndex].reduce((results, current) => {
            return results + current.value
          }, 0)
          resultValue = parseFloat((param.value / sum) * 100 as any)
          resultValue = formatFloat(resultValue, tooltipValueDecimalPlaces, tooltipValueCompleteZero) + '%';
        }
        if(commaDisplay){
          resultValue = this.doCommaSeparat(resultValue)
        }
        dataHtml += `<div>
          ${iconHtml}
          <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${param.name}：</span>
          <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${param.seriesName}: ${resultValue}</span>
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
    {
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
        z-index:0;
      `,
      formatter: (param) => {
        let dataHtml = "";
        let iconHtml = showIcon ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${param.color};"></span>` : "";

        let resultValue: any = param.value;
        if (isNaN(resultValue)) resultValue = 0;

        if (tooltipValueType === "normal") {
          resultValue = formatFloat(resultValue, tooltipValueDecimalPlaces, tooltipValueCompleteZero);
        } else {
          let sum = this.echartsData[1].reduce((results, current) => {
            return results + current.value
          }, 0)
          resultValue = parseFloat((param.value / sum) * 100 as any)
          resultValue = formatFloat(resultValue, tooltipValueDecimalPlaces, tooltipValueCompleteZero) + '%';
        }

        dataHtml += `<div>
          ${iconHtml}
          <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${param.name}：</span>
          <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${param.seriesName}: ${param.value}</span>
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
    }]
  }

  getLegendOtherOption():any {
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
        { uid: "f_1", alias: "名称", type: "string" },
        { uid: "f_2", alias: "站点1", type: "number" },
        { uid: "f_3", alias: "站点2", type: "number" },
      ],
      rows: [
        { f_1: "访问", f_2: 550, f_3: 500 },
        { f_1: "浏览", f_2: 420, f_3: 400 },
        { f_1: "下单", f_2: 280, f_3: 300 },
        { f_1: "交互", f_2: 150, f_3: 200 },
        { f_1: "完成", f_2: 80, f_3: 100 },
      ],
    };
  }

  checkErrorData() {
    let dataOpt = this.getOption<OptionFieldValue[]>("axis-category") || [];
    let dataValue1 = this.getOption<OptionFieldValue[]>("axis-value1") || [];
    let dataValue2 = this.getOption<OptionFieldValue[]>("axis-value2") || [];
    if (!dataOpt.length || !dataValue1.length || !dataValue2.length) {
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
    let dataOpt = this.getOption<OptionFieldValue[]>("axis-category") || [];
    let dataValue1 = this.getOption<OptionFieldValue[]>("axis-value1") || [];
    let dataValue2 = this.getOption<OptionFieldValue[]>("axis-value2") || [];
    let dataMap = new Map();
    if (!dataOpt.length || !dataValue1.length || !dataValue2.length) {
      let privateData = this.getPrivateData();
      let fieldTypeUids = this.getPrivateFieldTypeUids();

      let nameUid = fieldTypeUids.string?.[0];
      let valueUid = fieldTypeUids.number?.[0];
      let value1Uid = fieldTypeUids.number?.[1];

      let valueData = [];
      let value1Data = [];
      privateData.rows.forEach((row) => {
        valueData.push({
          name: row[nameUid],
          value: row[valueUid],
          field: this.getFieldAlias([PrivateDataConnectionUID, PrivateDataTableUID, valueUid])
        });
        value1Data.push({
          name: row[nameUid],
          value: row[value1Uid],
          field: this.getFieldAlias([PrivateDataConnectionUID, PrivateDataTableUID, value1Uid])
        });
      });
      sampleData.push(valueData);
      sampleData.push(value1Data);
      return sampleData;
    } else {
      let funnelData = this.datasetSource();
      let dataInfo1 = [];
      let dataInfo2 = [];

      for (let i = 0; i < funnelData.length; i++) {
        const row = funnelData[i];

        dataInfo1.push({ value: this.getMetric(row, dataValue1[0]), name: row[dataOpt[0]?.uid[2]], field: this.getFieldAlias(dataValue1[0].uid) })
        dataInfo2.push({ value: this.getMetric(row, dataValue2[0]), name: row[dataOpt[0]?.uid[2]], field: this.getFieldAlias(dataValue2[0].uid) })
      }
      resultData.push(dataInfo1)
      resultData.push(dataInfo2)
    }
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
      title: ()=>this.echartsTitleOption,
      color: ()=>this.getSerieEchartsColors()
    };
  }

  get echartsSeriesOption(): SeriesOption | SeriesOption[] {
    let labelShowName = this.getOption<boolean>("label");
    let labelNameFont = this.getOption<OptionFontValue>("label-font");
    let labelShowValue = this.getOption<boolean>("label-value-visible");
    let labelShow = this.getOption<boolean>("label") && (labelShowName || labelShowValue);
    let labelTextType = this.getOption<string>("label-text-type");
    let labelDecimalPlaces = this.getOption<number>("label-decimal-places");
    let labelCompleteZero = this.getOption<boolean>("label-complete-zero");
    let labelPosition = this.getOption<string>("label-position");
    let unitFont = this.getOption<OptionFontValue>("label-unit-font");
    let unit = this.getOption<string>("label-unit-value");
    let dataSouce = this.echartsData;
    let data1 = [];
    let data2 = [];
    let dataValue1 = [];
    let dataValue2 = [];
    let colors = this.getSerieEchartsColors();

    let funnelMargin = this.getOption<number>("funnel-margin");
    let funnelWidth = (this.contentSize.width - this.padding.left - this.padding.right - funnelMargin) / 2;
    let funnelSpacing = this.getOption<number>("funnel-spacing") || 0;
    let funnelBorderWidth = this.getOption<number>("funnel-border-width");
    let funnelBorderColor = this.getOption<string>("funnel-border-color");

    dataSouce[0].forEach((item) => {
      data1.push({ value: item.value, name: item.name });
      dataValue1.push(item.value);
    });
    dataSouce[1].forEach((item) => {
      data2.push({ value: item.value, name: item.name });
      dataValue2.push(item.value);
    });

    let max = Math.max(...dataValue1,...dataValue2);
    let name1 = dataSouce[0][0]?.field;
    let name2 = dataSouce[1][0]?.field;
    data1.forEach((item, index) => {
      item["itemStyle"] = {};
      item["itemStyle"]["color"] = colors[index];
    })
    data2.forEach((item, index) => {
      item["itemStyle"] = {};
      item["itemStyle"]["color"] = colors[index];
    })

    return [
      {
        name: name1,
        type: 'funnel',
        left: this.padding.left,
        top: 50 + this.padding.top,
        bottom: 30 + this.padding.bottom,
        width: funnelWidth,
        max: max,
        minSize: '25%',
        maxSize: '100%',
        sort: 'none',
        gap: funnelSpacing,
        label: {
          show: labelShow,
          position: labelPosition == 'inside' ? 'insideRight' : 'left',
          padding: [0, 5, 0, 0],
          color: this.toEchartsColor(labelNameFont.color as Color),
          formatter: (params) => {
            let value: any = params.value;
            let resultValue;
            let resultString = params.name;
            if (labelShowValue) {
              // 标签数值格式
              if (labelTextType === "percent") {
                let sum = this.echartsData[0].reduce((results, current) => {
                  return results + current.value
                }, 0)
                resultValue = parseFloat((value / sum) * 100 as any)
                resultString = `{a|${formatFloat(resultValue, labelDecimalPlaces, labelCompleteZero)}%}`

              } else {
                resultString = `{a|${formatFloat(Number(value), labelDecimalPlaces, labelCompleteZero)}}`

              }
              resultString += `{unit|${unit}}`
            }
            return resultString;
          },
          rich:{
            a: {
              fontSize: labelNameFont.size,
              fontWeight: labelNameFont.bold ? "bold" : "normal",
              fontStyle: labelNameFont.italic ? "italic" : "normal",
              fontFamily: labelNameFont.family || "sans-serif",
            },
            unit: {
              fontSize: unitFont.size,
              fontWeight: unitFont.bold ? "bold" : "normal",
              fontStyle: unitFont.italic ? "italic" : "normal",
              fontFamily: unitFont.family || "sans-serif",
              color: this.toEchartsColor(unitFont.color as Color)
            }
          }
        },
        funnelAlign: 'right',
        labelLine: {
         show:false
        },
        itemStyle: {
          borderColor: funnelBorderColor,
          borderWidth: funnelBorderWidth
        },
        data: data1
      },
      {
        name: name2,
        type: 'funnel',
        funnelAlign: 'left',
        top: 50 + this.padding.top,
        bottom: 30 + this.padding.bottom,
        left: this.padding.left + funnelWidth + funnelMargin,
        width: funnelWidth,
        gap: funnelSpacing,
        max: max,
        minSize: '25%',
        maxSize: '100%',
        sort: 'none',
        label: {
          show: labelShow,
          position: labelPosition == 'inside' ? 'insideLeft' : 'right',
          color: this.toEchartsColor(labelNameFont.color as Color),
          padding: [0, 0, 0, 5],
          formatter: (params) => {
            let value: any = params.value;
            let resultValue;
            let resultString = params.name;
            if (labelShowValue) {
              // 标签数值格式
              if (labelTextType === "percent") {
                let sum = this.echartsData[0].reduce((results, current) => {
                  return results + current.value
                }, 0)
                resultValue = parseFloat((value / sum) * 100 as any)
                resultString = `{a|${formatFloat(resultValue, labelDecimalPlaces, labelCompleteZero)}%}`

              } else {
                resultString = `{a|${formatFloat(Number(value), labelDecimalPlaces, labelCompleteZero)}}`

              }
              resultString += `{unit|${unit}}`
            }
            return resultString;
          },
          rich:{
            a: {
              fontSize: labelNameFont.size,
              fontWeight: labelNameFont.bold ? "bold" : "normal",
              fontStyle: labelNameFont.italic ? "italic" : "normal",
              fontFamily: labelNameFont.family || "sans-serif",
            },
            unit: {
              fontSize: unitFont.size,
              fontWeight: unitFont.bold ? "bold" : "normal",
              fontStyle: unitFont.italic ? "italic" : "normal",
              fontFamily: unitFont.family || "sans-serif",
              color: this.toEchartsColor(unitFont.color as Color)
            }
          }
        },
        labelLine: {
          show:false
        },
        emphasis: {
          label: {
            show: labelShow,
            position: 'insideLeft',
            color: this.toEchartsColor(labelNameFont.color as Color),
            fontSize: labelNameFont.size,
            fontWeight: labelNameFont.bold ? "bold" : "normal",
            fontStyle: labelNameFont.italic ? "italic" : "normal",
            fontFamily: labelNameFont.family || "sans-serif",
            padding: [0, 0, 0, 5],
            formatter: (params) => {
              let value: any = params.value;
              let resultValue;
              let resultString = params.name;
              if (labelShowValue) {
                // 标签数值格式
                if (labelTextType === "percent") {
                  let sum = this.echartsData[1].reduce((results, current) => {
                    return results + current.value
                  }, 0)
                  resultValue = parseFloat((value / sum) * 100 as any)
                  resultString = `${formatFloat(resultValue, labelDecimalPlaces, labelCompleteZero)}%`

                } else {
                  resultString = `${formatFloat(Number(value), labelDecimalPlaces, labelCompleteZero)}`

                }
              }
              return resultString;
            },
          },
        },
        itemStyle: {
          borderColor: funnelBorderColor,
          borderWidth: funnelBorderWidth
        },
        data: data2
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
        const data = this.datasetSource();
        let uids = this.getOption("axis-category")?.[0]?.uid;
        const currentData = data[params.dataIndex];
        if (uids?.length) {
          let fieldArr = this.getOption<string>("linkage-form-field")?.split(".")
          let fieldUIDs;
          let filterValue;
          if (fieldArr?.length) {
            if (fieldArr.length === 2) {
              fieldUIDs = [uids[0], ...fieldArr];
              filterValue = currentData[fieldArr[1]];
            } else if (fieldArr.length === 3) {
              fieldUIDs = [uids[0], fieldArr[0], `${fieldArr[1]}.${fieldArr[2]}`];
              filterValue = currentData[fieldArr[1]].map(item => item[fieldArr[2]]);
            }
          }
          this.applyLinkage({ uid: fieldUIDs as OptionFieldUID, value: filterValue });
        }
      }

    })
  }
}
