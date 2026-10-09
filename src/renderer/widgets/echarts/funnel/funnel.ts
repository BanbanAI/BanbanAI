import { PrivateData, PrivateDataConnectionUID, PrivateDataTableUID, OptionFieldUID } from "@common/types/project";
import { DefinedOptions, OptionFontValue, OptionFieldValue, OptionFileValue, WidgetMetaData, ChartClickState } from "@renderer/b2/types";
import { Widget } from "@renderer/b2/controllers/widget";
import { Color } from "@renderer/b2/color";
import { formatFloat } from "@common/utils/math";
import { TheWidget as Echarts, component as B2Chart } from "@renderer/widgets/echarts/basic";
import { TooltipComponentOption, XAXisComponentOption, YAXisComponentOption, SeriesOption, DatasetComponentOption } from "echarts/dist/echarts";
import i18next from "@renderer/widgets/i18next";
import resource from "./locales";
import { merge, recursive } from "merge";
import { watch, ref, Ref } from "vue";

export class Funnel extends Echarts {
  noDims: Boolean = false;
  max: number;
  min: number;
  static resource:any = recursive(true, Echarts.resource, resource);
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
                alias: i18next.t("axisCategory"),
                default: [{ "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_1"], "__opt_type": "field", "summary": "" }]
              },
              {
                name: "axis-value",
                type: "field(aggs=sum|none|max|min|mean|count|distinct, min=0)",
                alias: i18next.t("axisValue"),
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
          "label-group": {
            alias: i18next.t("label"),
            children: [
              {
                name: "label-default-cluster",
                alias: i18next.t("label"),
                fold: "always-unfold",
                children: [
                  {
                    name: "label",
                    alias: i18next.t("label"),
                    type: "boolean",
                    default: false,
                  },
                  {
                    name: "label-type-cluster",
                    alias: i18next.t("labelTypeCluster"),
                    show: "tab",
                    children: [
                      {
                        name: "label-value-visible",
                        alias: i18next.t("labelValueVisible"),
                        type: "boolean",
                        default: true,
                      },
                      {
                        name: "label-text-type",
                        alias: i18next.t("labelTextType"),
                        default: "normal",
                        type: "select(radioGroup)",
                        disabled: (widget: Widget) => { return !widget.getOption<boolean>("label-value-visible") },
                        selectChoices: [
                          {
                            label: i18next.t("labelTextTypeNormal"),
                            value: "normal",
                          },
                          {
                            label: i18next.t("labelTextTypePercent"),
                            value: "percent",
                          },
                        ],
                      },
                      {
                        name: "label-decimal-places",
                        alias: i18next.t("decimalPlaces"),
                        type: "number(unit=" + UNIT_WEI + ")",
                        disabled: (widget: Widget) => { return !widget.getOption<boolean>("label-value-visible") },
                        default: 2,
                      },
                      {
                        name: "label-complete-zero",
                        alias: i18next.t("labelCompleteZero"),
                        type: "boolean",
                        disabled: (widget: Widget) => { return !widget.getOption<boolean>("label-value-visible") },
                        default: false,
                      },
                    ],
                  },
                  {
                    name: "label-font-cluster",
                    alias: i18next.t("labelFontCluster"),
                    show: "tab",
                    children: [
                      {
                        name: "label-font",
                        alias: i18next.t("labelFont"),
                        type: "font",
                        default: {
                          family: "sans-serif",
                          color: "#fff",
                          size: 12,
                          bold: false,
                          italic: false,
                        },
                      },
                      {
                        name: "label-text-row",
                        alias: i18next.t("labelTextRow"),
                        default: '2',
                        type: "select(radioGroup)",
                        selectChoices: [
                          {
                            label: i18next.t("labelTextRow1"),
                            value: '1'
                          },
                          {
                            label: i18next.t("labelTextRow2"),
                            value: '2'
                          },
                        ]
                      },
                      {
                        name: "label-position",
                        alias: i18next.t("labelPosition"),
                        default: "inside",
                        type: "select(radioGroup)",
                        selectChoices: [
                          {
                            label: i18next.t("labelPositionLeft"),
                            value: 'left'
                          },
                          {
                            label: i18next.t("labelPositionInside"),
                            value: 'inside'
                          },
                          {
                            label: i18next.t("labelPositionRight"),
                            value: 'right'
                          },
                        ]
                      },
                      {
                        name: "label-unit-value",
                        alias: i18next.t("labelUnitValue"),
                        type: "string",
                        default: "",
                      },
                      {
                        name: "label-unit-font",
                        alias: i18next.t("labelUnitFont"),
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
                    ]
                  },
                ],
              }
            ]
          },
          "series-shape": {
            alias: i18next.t("seriesShape"),
            children: [
              {
                name: "series-shape-default-cluster",
                alias: i18next.t("seriesShapeDefault"),
                show: "tab",
                children: [
                  {
                    name: "funnel-shape",
                    alias: i18next.t("funnelShape"),
                    default: "funnel",
                    type: "select(radioGroup)",
                    selectChoices: [
                      {
                        label: i18next.t("funnelShapeFunnel"),
                        value: "funnel"
                      },
                      {
                        label: i18next.t("funnelShapePyramid"),
                        value: "pyramid"
                      },
                      {
                        label: i18next.t("funnelShapeRectangle"),
                        value: "rectangle"
                      }
                    ],

                  },
                  {
                    name: "funnel-direction",
                    alias: i18next.t("funnelDirection"),
                    default: "bottom",
                    type: "select(radioGroup)",
                    selectChoices: [
                      {
                        label: i18next.t("funnelDirectionBottom"),
                        value: "bottom"
                      },
                      {
                        label: i18next.t("funnelDirectionTop"),
                        value: "top"
                      },
                    ],

                  },
                  {
                    name: "funnel-spacing",
                    alias: i18next.t("funnelSpacing"),
                    type: "number(unit=px)",
                    default: 0,
                  },
                  {
                    name: "funnel-border-radius",
                    alias: i18next.t("borderRadius"),
                    type: "number(unit=px)",
                    default: 10,
                    visible: (widget: Widget) => widget.getOption("funnel-shape") === "rectangle"
                  },
                  {
                    name: "funnel-border-width",
                    alias: i18next.t("funnelBorderWidth"),
                    type: "number(unit=px, min=0)",
                    default: 0,
                  },
                  {
                    name: "funnel-border-color",
                    alias: i18next.t("funnelBorderColor"),
                    type: "color",
                    default: "#fff",
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
              },
              {
                name: "legend-value-padding",
                type: "number(unit=px)",
                visible: (widget: Widget) => { return widget.getOption("legend-value") },
                alias: i18next.t("legend-value-padding"),
                default: 0
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
                    alias: i18next.t("legendValueDecimalPlaces"),
                    type: "number(unit=" + UNIT_WEI + ")",
                    default: 0,
                  },
                  {
                    name: "legend-value-complete-zero",
                    alias: i18next.t("legendValueCompleteZero"),
                    type: "boolean",
                    default: false,
                  },
                  {
                    name: "legend-value-font",
                    alias: i18next.t("legendValueFont"),
                    type: "font",
                    default: {
                      color: "#fff",
                      size: 12,
                      bold: false,
                      italic: false,
                    },
                  },
                ]
              },
              {
                name: "legend-unit",
                alias: i18next.t("legend-unit"),
                children: [
                  {
                    name: "legend-value-unit",
                    type: "string",
                    alias: i18next.t("legend-value-unit"),
                    default: "",
                    visible: (widget: Widget) => { return widget.getOption("legend-value") },
                  },
                  {
                    name: "legend-unit-style",
                    alias: i18next.t("legend-unit-style"),
                    type: "font",
                    default: {
                      color: "#fff",
                      size: 12,
                      bold: false,
                      italic: false,
                    },
                  },
                  {
                    name: "legend-unit-padding",
                    type: "number(unit=px)",
                    visible: (widget: Widget) => { return widget.getOption("legend-value") },
                    alias: i18next.t("legend-unit-padding"),
                    default: 0
                  },
                ],
                visible: (widget: Widget) => { return widget.getOption("legend-value") },
              },
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
            visible: true,
          }
        }
      },
      ...super.defineOptions()
    ]
  }
  _count: number = 0
  get count(): number {
    return this._count;
  }

  calculateCount(dataSource) {
    let count = 0;
    dataSource.forEach(item => {
      count += item.value;
    });
    this._count = count;
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
    let isRectangle = this.getOption<string>("funnel-shape") === "rectangle";

    return {
      trigger: 'item',
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

        let resultValue: any = isRectangle ? param.data.value : param.value;
        if (isNaN(resultValue)) resultValue = 0;

        if (tooltipValueType === "normal") {
          resultValue = formatFloat(resultValue, tooltipValueDecimalPlaces, tooltipValueCompleteZero);
        } else {
          resultValue = parseFloat((isRectangle ? param.data.value : param.value / this.max) * 100 as any)
          resultValue = formatFloat(resultValue, tooltipValueDecimalPlaces, tooltipValueCompleteZero) + '%';
        }
        if(commaDisplay){
          resultValue = this.doCommaSeparat(resultValue)
        }
        dataHtml += `<div>
          ${iconHtml}
          <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${ isRectangle ? param.data.name : param.name}：</span>
          <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${resultValue}</span>
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
    }
  }

  getLegendOtherOption() {
    let legendFont = this.getOption<OptionFontValue>("legend-font");
    let legendLimit = this.getOption<number>("legend-text-limit");
    let showLegendValue = this.getOption<boolean>("legend-value");
    let legendValueFont = this.getOption<OptionFontValue>("legend-value-font");
    let legendValueType = this.getOption<string>("legend-value-type");
    let legendValueDecimalPlaces = this.getOption<number>("legend-value-decimal-places");
    let legendValueCompleteZero = this.getOption<boolean>("legend-value-complete-zero");
    let legendTextPadding = this.getOption<number>("legend-text-padding");
    let legendValuepadding = this.getOption<number>("legend-value-padding");
    let legendUnit = this.getOption<string>("legend-value-unit");
    let legendUnitStyle = this.getOption<OptionFontValue>("legend-unit-style");
    let legendUnitPadding = this.getOption<number>("legend-unit-padding");
    let sourceData = this.echartsChart?.getOption()?.dataset[0]?.source || [];
    let totalValue = sourceData.reduce((result, current) => {
      let currentValue = isNaN(current["value"]) ? 0 : Number(current["value"]);
      result = result + currentValue;
      return result;
    }, 0);


    return {
      formatter: (legendName) => {
        if (sourceData.length == 0 || !showLegendValue) return legendName;
        let resultValue: any = sourceData.find((currentData) => { return currentData["name"] == legendName })?.value;
        if (isNaN(resultValue)) resultValue = 0;

        if (legendValueType === "normal") {
          resultValue = formatFloat(resultValue, legendValueDecimalPlaces, legendValueCompleteZero);
        } else {
          resultValue = resultValue / totalValue;
          resultValue = formatFloat(resultValue * 100, legendValueDecimalPlaces, legendValueCompleteZero) + '%';
        }
        let b = "";
        let unitPadding = "";
        for (let i = 0; i < legendValuepadding; i++) {
          b += " ";
        }
        for (let i = 0; i < legendUnitPadding; i++) {
          unitPadding += " ";
        }

        let processedName = `${legendName}${b}{value| ${resultValue}}${unitPadding}{unit|${legendUnit}}`;
        if (processedName.length > legendLimit) {
          return processedName.slice(0, legendLimit) + "...";
        } else {
          return processedName;
        }
      },
      textStyle: {
        color: this.toEchartsColor(legendFont.color as Color) as string || this.toEchartsColor(this.getOption<Color>("legend-color")),
        fontSize: legendFont.size || this.getOption<number>("legend-font-size"),
        fontFamily: legendFont.family,
        fontWeight: legendFont.bold ? "bold" : "normal",
        fontStyle: legendFont.italic ? "italic" : "normal",
        padding: [0,0,0,Number(legendTextPadding)],
        rich: {
          value: {
            color: legendValueFont.color as string,
            fontSize: legendValueFont.size,
            fontFamily: legendValueFont.family,
            fontWeight: legendValueFont.bold ? "bold" : "normal",
            fontStyle: legendValueFont.italic ? "italic" : "normal",
          },
          unit: {
            color: legendUnitStyle.color as string,
            fontSize: legendUnitStyle.size,
            fontFamily: legendUnitStyle.family,
            fontWeight: legendUnitStyle.bold ? "bold" : "normal",
            fontStyle: legendUnitStyle.italic ? "italic" : "normal",
          }
        }
      },
      data: this.echartsData,
    }
  }

  protected getDefaultPrivateData(): PrivateData {
    return {
      fields: [
        { uid: "f_1", alias: "名称", type: "string" },
        { uid: "f_2", alias: "数值", type: "number" },
      ],
      rows: [
        { f_1: "示例一", f_2: 20 },
        { f_1: "示例二", f_2: 70 },
        { f_1: "示例三", f_2: 45 },
        { f_1: "示例四", f_2: 66 },
        { f_1: "示例五", f_2: 32 },
        { f_1: "示例六", f_2: 83 },
      ],
    };
  }

  checkErrorData() {
    let dataOpt = this.getOption<OptionFieldValue[]>("axis-category") || [];
    let dataValue = this.getOption<OptionFieldValue[]>("axis-value") || [];
    const hasCategoryField = !!dataOpt[0]?.uid;
    const hasValueField = !!dataValue[0]?.uid;
    if(!hasCategoryField || !hasValueField) {
      if(!hasCategoryField && !hasValueField) {
        this.addErrorDataStatus("filed-empty");
      } else {
        this.addErrorDataStatus("filed-incomplete");
      }
    } else {
      this.clearErrorDataStatus();
    }
  }

  private _echartsData = ref(undefined);

  _getEchartsData() {
    let resultData = []
    let dataOpt = this.getOption<OptionFieldValue[]>("axis-category") || [];
    let dataValue = this.getOption<OptionFieldValue[]>("axis-value") || [];
    let dataMap = new Map()
    if (!dataOpt[0]?.uid || !dataValue[0]?.uid) {
      let privateData = this.getPrivateData();
      let fieldTypeUids = this.getPrivateFieldTypeUids();
      let nameUid = fieldTypeUids.string?.[0];
      let valueUid = fieldTypeUids.number?.[0];
      privateData.rows.forEach((row) => {
        resultData.push({
          name: row[nameUid],
          value: row[valueUid],
          self_row_data: JSON.parse(JSON.stringify(row)),
        })
      });
    } else {
      resultData = this.createView(["axis-category", "axis-value"])
      resultData = this.dealDataByAggregate(resultData,  [dataOpt[0]], dataValue);
      for (const row of resultData) {
        row["name"] = row[dataOpt[0]?.uid[2]];
        const val = this.getMetric(row, dataValue[0]);
        row["value"] = val;
        row["self_row_data"] = JSON.parse(JSON.stringify(row));
      }
    }
    // 计算最大最小值
    let values = [];
    resultData.forEach(item => {
      values.push(item.value);
    })
    this.max = Math.max(...values);
    this.min = Math.min(...values);
    dataMap.clear()
    return resultData;
  }

  get echartsData() {
    if (this._echartsData.value === undefined) {
      this.effectScope.run(()=>{
        watch(()=>{
          if(!this.status.isVisible && this._echartsData.value !== undefined) {
            return this._echartsData.value;
          }
          return this._getEchartsData();
        }, (value)=>{
          this._echartsData.value = value;
        }, {immediate: true});
      });
    }
    return this._echartsData.value || [];
  }


  get echartsSeriesOption(): SeriesOption | SeriesOption[] {
    let labelShowName = this.getOption<boolean>("label");
    let labelNameFont = this.getOption<OptionFontValue>("label-font");
    let labelShowValue = this.getOption<boolean>("label-value-visible");
    let labelShow = this.getOption<boolean>("label") && (labelShowName || labelShowValue);
    let labelTextType = this.getOption<string>("label-text-type");
    let labelDecimalPlaces = this.getOption<number>("label-decimal-places");
    let labelCompleteZero = this.getOption<boolean>("label-complete-zero");
    let labelTextRow = this.getOption<string>("label-text-row");
    let funnelDirection = this.getOption<string>("funnel-direction");
    let funnelShape = this.getOption<string>("funnel-shape");
    let funnelSpacing = this.getOption<number>("funnel-spacing") || 0;
    let funnelBorderWidth = this.getOption<number>("funnel-border-width");
    let funnelBorderColor = this.getOption<string>("funnel-border-color");
    let labelPosition = this.getOption<any>("label-position");
    let unitFont = this.getOption<OptionFontValue>("label-unit-font");
    let unit = this.getOption<string>("label-unit-value");
    let { top, right, bottom, left } = this.padding

    const valueField = this.getOption<OptionFieldValue[]>("axis-value")?.[0];
    let seriesName = valueField?.uid ? this.getFieldAlias(valueField.uid) : "";

    let funnelBorderRadius = this.getOption<number>("funnel-border-radius");

    if (funnelShape !== "rectangle") {
      return [{
        name: seriesName,
        type: "funnel",
        min: funnelShape === "funnel" ? this.min : 0,
        max: this.max,
        minSize: funnelShape === "funnel" ? '20%' : '0%',
        maxSize: '100%',
        sort: funnelDirection === "bottom" ? 'descending' : 'ascending',
        gap: funnelSpacing,
        label: {
          show: labelShow,
          position: labelPosition,
          color: this.toEchartsColor(labelNameFont.color as Color),
          fontSize: labelNameFont.size,
          fontWeight: labelNameFont.bold ? "bold" : "normal",
          fontStyle: labelNameFont.italic ? "italic" : "normal",
          fontFamily: labelNameFont.family || "sans-serif",
          align: "center",
          formatter: (params) => {
            let value: any = params.value;
            let resultValue;
            let resultString = params.name;
            if (labelShowValue) {
              // 标签数值格式
              if (labelTextType === "percent") {
                resultValue = parseFloat((value / this.max) * 100 as any)
                resultString = `${params.name}${labelTextRow === "2" ? '\n' : " "}${formatFloat(resultValue, labelDecimalPlaces, labelCompleteZero)}%`
                if (labelPosition !== "inside") {
                  resultString = `{b|${params.name}}${labelTextRow === "2" ? '\n' : " "}{a|${formatFloat(resultValue, labelDecimalPlaces, labelCompleteZero)}%}`
                }
              } else {
                resultString = `${params.name} ${labelTextRow === "2" ? '\n' : " "}${formatFloat(Number(value), labelDecimalPlaces, labelCompleteZero)}`
                if (labelPosition !== "inside") {
                  resultString = `{b|${params.name}}${labelTextRow === "2" ? '\n' : " "}{a|${formatFloat(Number(value), labelDecimalPlaces, labelCompleteZero)}}`
                }
              }
              resultString += `{unit|${unit}}`
            }
            return resultString;
          },
          rich: {
            a: {
              align: "center",
              fontSize: labelNameFont.size,
              fontWeight: labelNameFont.bold ? "bold" : "normal",
              fontStyle: labelNameFont.italic ? "italic" : "normal",
              fontFamily: labelNameFont.family || "sans-serif",
            },
            b: {
              align: "center",
              fontSize: labelNameFont.size,
              fontWeight: labelNameFont.bold ? "bold" : "normal",
              fontStyle: labelNameFont.italic ? "italic" : "normal",
              fontFamily: labelNameFont.family || "sans-serif",
            },
            unit: {
              align: "center",
              fontSize: unitFont.size,
              fontWeight: unitFont.bold ? "bold" : "normal",
              fontStyle: unitFont.italic ? "italic" : "normal",
              fontFamily: unitFont.family || "sans-serif",
              color: this.toEchartsColor(unitFont.color as Color)
            }
          }
        },
        labelLine: {
          lineStyle: {
            width: 0
          }
        },
        itemStyle: {
          borderColor: funnelBorderColor,
          borderWidth: funnelBorderWidth
        },
        data: this.echartsData,
        z: 5,
        ...this.padding
      }]
    } else {
      let seriesOpt = [];
      let dataSourceLength = this.datasetSource().length
      let itemHeightMap = new Array(dataSourceLength).fill(0)
      for (let i = 0; i < dataSourceLength; i++) {
        seriesOpt.push({
          name: this.datasetSource()[i].name,
          selectedMode: true,
          type: 'custom',
          coordinateSystem: 'none',
          universalTransition: true,
          renderItem: (params, api) => {
            if (params.dataIndex !== i) return;
            let ration;
            if (this.max === api.value(1)) {
              ration = 1;
            } else {
              ration = api.value(1) / this.max;
            }

            let itemHeight = (api.value(1) / this.count) * (api.getHeight() - top - bottom);
            let itemWidth = (api.getWidth() - right - left) * ration;

            itemHeightMap[i] = itemHeight;
            let prefixSum = 0;
            for (let j = 0; j < i; j++) {
              prefixSum += itemHeightMap[j] || 0;
            }

            // 文字样式
            let resultString = `{a|${api.value(0)}}`
            let resultValue;
            if (labelShowValue) {
              // 标签数值格式
              if (labelTextType === "percent") {
                resultValue = parseFloat((api.value(1) / this.max) * 100 as any)
                resultString = `{a|${api.value(0)}${labelTextRow === "2" ? '\n' : " "}${formatFloat(resultValue, labelDecimalPlaces, labelCompleteZero)}%}`
              } else {
                resultString = `{a|${api.value(0)}${labelTextRow === "2" ? '\n' : " "}${formatFloat(Number(api.value(1)), labelDecimalPlaces, labelCompleteZero)}}`
              }
              resultString += `{unit|${unit}}`
            }


            return {
              type: 'rect',
              textContent: {
                type: 'text',
                style: {
                  text: resultString,
                  rich: {
                    a: {
                      align: "center",
                      fill: this.toEchartsColor(labelNameFont.color as Color),
                      fontSize: labelNameFont.size,
                      fontWeight: labelNameFont.bold ? "bold" : "normal",
                      fontStyle: labelNameFont.italic ? "italic" : "normal",
                      fontFamily: labelNameFont.family || "sans-serif",
                    },
                    unit: {
                      align: "center",
                      fill: this.toEchartsColor(unitFont.color as Color),
                      fontSize: unitFont.size,
                      fontWeight: unitFont.bold ? "bold" : "normal",
                      fontStyle: unitFont.italic ? "italic" : "normal",
                      fontFamily: unitFont.family || "sans-serif",
                      color: this.toEchartsColor(unitFont.color as Color)
                    }
                  }
                },
                invisible: !labelShow
              },
              textConfig: {
                position: labelPosition,
                inside: true
              },
              shape: {
                x: (api.getWidth() - itemWidth - right - left) * 0.5 + left,
                y: top + prefixSum,
                width: itemWidth,
                height: itemHeight - funnelSpacing,
                r: [funnelBorderRadius, funnelBorderRadius, funnelBorderRadius, funnelBorderRadius]
              },
              style: {
                fill: api.style().fill,
                stroke: funnelBorderColor,
                lineWidth: funnelBorderWidth
              }
            };
          },
          itemStyle: {
            borderColor: funnelBorderColor,
            borderWidth: funnelBorderWidth
          },
        });
      }

      return seriesOpt
    }

  }


   _tempDatasetSource = ref()

  _datasetSource() {
    let funnelDirection = this.getOption<string>("funnel-direction");
    let resultData = this._getEchartsData()
    this.calculateCount(resultData)
    if (funnelDirection === 'top') {
      this._tempDatasetSource.value = resultData.sort((a, b) => a.value - b.value)
    } else {
      this._tempDatasetSource.value = resultData.sort((a, b) => b.value - a.value)
    }
    return this._tempDatasetSource.value;
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
        ...this.axisCategory,
        ...this.axisValue,
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
        const currentData = params.data["self_row_data"];
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
