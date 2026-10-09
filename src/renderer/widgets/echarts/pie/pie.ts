import { PrivateData, PrivateDataConnectionUID, PrivateDataTableUID, OptionFieldUID, FieldUID } from "@common/types/project";
import { DefinedOptions, OptionFontValue, OptionFileValue, OptionFieldValue, WidgetMetaData } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { Widget } from "@renderer/b2/controllers/widget";
import { formatFloat } from "@common/utils/math";
import { TheWidget as Echarts, component as B2Chart } from "@renderer/widgets/echarts/basic";
import { LegendComponentOption, TooltipComponentOption, XAXisComponentOption, YAXisComponentOption, DatasetComponentOption, SeriesOption } from "echarts/dist/echarts";
import { ref, onMounted, watch } from "vue";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { recursive } from "merge"
import { merge } from "lodash";
import { isEmpty } from "@common/utils/object";

export class Pie extends Echarts {
  public selectedIndex = ref(0);
  public selectedData = ref(null);

  static resource = recursive(true, Echarts.resource, resource);
  static labelShowType() {
    return "tab";
  }
  static getLabelDefaultOptions(): any {
    return [
      {
        name: "label-type-cluster",
        alias: i18next.t("labelTypeCluster"),
        show: this.labelShowType(),
        fold: "unfold",
        children: [
          {
            name: "label-value-visible",
            alias: i18next.t("labelValueVisible"),
            type: "boolean",
            default: true,
            visible: true
          },
          {
            name: "label-text-type",
            alias: i18next.t("labelTextType"),
            default: "normal",
            type: "select(radioGroup)",
            disabled: (widget: Widget) => { return !widget.getOption<boolean>("label-value-visible") },
            selectChoices: [
              {
                label: i18next.t("value"),
                value: "normal",
              },
              {
                label: i18next.t("percent"),
                value: "percent",
              },
            ],
          },
          {
            name: "label-decimal-places",
            alias: i18next.t("labelDecimalPlaces"),
            type: "number(unit=" + i18next.t("unitWei") + ", min=0)",
            default: 2,
            disabled: (widget: Widget) => { return !widget.getOption<boolean>("label-value-visible") },
          },
          {
            name: "label-complete-zero",
            alias: i18next.t("labelCompleteZero"),
            type: "boolean",
            default: false,
            disabled: (widget: Widget) => { return !widget.getOption<boolean>("label-value-visible") },
          },
          {
            name: "label-value-font",
            alias: i18next.t("font"),
            type: "font",
            default: {
              family: "sans-serif",
              size: 12,
              bold: false,
              italic: false,
            },
            disabled: (widget: Widget) => { return !widget.getOption<boolean>("label-value-visible") },
          },
        ],
      },
      {
        name: "label-style-cluster",
        alias: i18next.t("labelStyleCluster"),
        show: this.labelShowType(),
        fold: "unfold",
        children: [
          {
            name: "label-position",
            alias: i18next.t("labelPosition"),
            default: "outside",
            type: "select(radioGroup)",
            selectChoices: [
              {
                label: i18next.t("labelShowType1"),
                value: "inside",
              },
              {
                label: i18next.t("labelShowType2"),
                value: "outside",
              },
            ],
          },
          {
            name: "label-name-visible",
            alias: i18next.t("labelNameVisible"),
            type: "boolean",
            default: false,
            visible: (widget: Widget) => { return widget.getOption<string>("label-position") === "inside" },
          },
          {
            name: "label-name-visible_outside",
            alias: i18next.t("labelNameVisibleOutside"),
            type: "boolean",
            default: true,
            visible: (widget: Widget) => { return widget.getOption<string>("label-position") === "outside" },
          },
          {
            name: "label-font",
            alias: i18next.t("font"),
            type: "font",
            default: {
              family: "sans-serif",
              color: "rgba(0,0,0,0)",
              size: 12,
              bold: false,
              italic: false,
            },
            disabled: (widget: Widget) => { return !widget.getOption<boolean>("label-name-visible_outside") && widget.getOption<string>("label-position") === "outside" || !widget.getOption<boolean>("label-name-visible") && widget.getOption<string>("label-position") === "inside" }
          },
          {
            alias: i18next.t("labelShapeSpacing"),
            name: "label-shape-spacing",
            type: "number(unit=px)",
            default: 10,
            visible: (widget: Widget) => { return widget.getOption("label-position") === "outside" },
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
    ]
  }

  static getSeriesShapeDefaultOptions(): any {
    return [
      {
        name: "shape-size",
        alias: i18next.t("shapeSize"),
        default: 75,
        type: "number(unit=%)"
      },
      {
        name: "shape-border-width",
        alias: i18next.t("shapeBorderWidth"),
        default: 0,
        type: "number(unit=px)",
        visible: true
      },
      {
        name: "shape-border-color",
        alias: i18next.t("shapeBorderColor"),
        type: "palette(gradient)",
        default: ["#5b8ff9", "#5ad8a6", "#5d7092", "#f6bd16", "#6f5ef9", "#6dc8ec", "#945fb9", "#ff9845", "#1e9493", "#ff99c3"],
        visible: true
      },
      {
        name: "inside-border-width",
        alias: i18next.t("insideBorderWidth"),
        default: 0,
        type: "number(unit=px)",
        visible: true
      },
      {
        name: "inside-border-color",
        alias: i18next.t("insideBorderColor"),
        type: "color(gradient)",
        default: "#5b8ff9",
        visible: true
      },
      {
        name: "angle-start",
        alias: i18next.t("angleStart"),
        default: 90,
        type: "number(min=0,max=360,showInput,unit=°)",
      },
      {
        name: "angle-end",
        alias: i18next.t("angleEnd"),
        default: 270,
        type: "number(min=0,max=360,showInput,unit=°)",
        visible: false //暂未实现功能
      },
      {
        name: "shape-background",
        alias: i18next.t("shapeBackground"),
        type: "color",
        default: "#eeeeee00",
      },
    ]
  }

  static defineOptions(): DefinedOptions[] {
    let labelDefaultOptions = this.getLabelDefaultOptions();
    let seriesShapeDefaultOptions = this.getSeriesShapeDefaultOptions();
    return [
      {
        data: {
          fields: {
            alias: i18next.t("fields"),
            fold: "unfold",
            children: [
              {
                name: "axis-category",
                type: "field(max=1, recommend=string)",
                alias: i18next.t("axisCategory"),
                default: [{ summary: "", uid: [PrivateDataConnectionUID, PrivateDataTableUID, "f_type"], __opt_type: "field" }]
              },
              {
                name: "axis-value",
                type: "field(max=1, aggs=sum|none|max|min|count|distinct)",
                alias: i18next.t("axisValue"),
                default: [{ summary: "", uid: [PrivateDataConnectionUID, PrivateDataTableUID, "f_number"], __opt_type: "field" }]
              },
              {
                name: "axis-fields",
                visible: false
              }
            ]
          },
          sort: {
            visible: false,
          }
        },
        style: {
          "series-shape": {
            alias: i18next.t("seriesShape"),
            children: seriesShapeDefaultOptions
          },
          legend: {
            default: false,
            children: [
              {
                name: "legend-value",
                type: "boolean",
                default: false,
                alias: i18next.t("legendValue")
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
                        label: i18next.t("value"),
                        value: "normal"
                      },
                      {
                        label: i18next.t("percent"),
                        value: "percent"
                      },
                    ],
                  },
                  {
                    name: "legend-value-decimal-places",
                    alias: i18next.t("legendValueDecimalPlaces"),
                    type: "number(unit=" + i18next.t("unitWei") + ", min=0)",
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
                    alias: i18next.t("font"),
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
          "label-group": {
            alias: i18next.t("label"),
            children: [
              {
                name: "label",
                alias: i18next.t("label"),
                type: "boolean",
                default: false,
              },
              ...labelDefaultOptions
            ]
          },
          tooltip: {
            children: [
              {
                name: "tooltip-label-style",
                children: [
                  {
                    name: "tooltip-unit",
                    visible: true
                  }
                ]
              }
            ]
          },
          "animation-display": {
            visible: false,
            children: [
              {
                name: "animation-display-type",
                visible: false
              },
              {
                name: "animation-display-single-interval",
                visible: false
              },
              {
                name: "animation-display-stay-column-carousel",
                visible: false
              },
              {
                name: "display-with-linkage",
                alias: i18next.t("displayWithLinkage"),
                type: "boolean",
                default: true
              },
            ]
          },
        }
      },
      ...super.defineOptions()
    ]
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

  protected getDefaultPrivateData(): PrivateData {
    return {
      fields: [
        { uid: "f_type", alias: i18next.t("defualtCategory"), type: "string" },
        { uid: "f_number", alias: i18next.t("defualtValue"), type: "number" },
      ],
      rows: [
        { f_type: '铅', f_number: 130 },
        { f_type: '铝', f_number: 58 },
        { f_type: '金', f_number: 10 },
        { f_type: '锌', f_number: 25 },
        { f_type: '铁', f_number: 95 },
        { f_type: '银', f_number: 50 },
        { f_type: '铜', f_number: 60 },
      ],
    };
  }

  getSortObjects() {
    let categoryDimensions: any = this.getOption<OptionFieldValue[]>("axis-category") || [];
    let valueDimensions: any = this.getOption<OptionFieldValue[]>("axis-value") || [];
    let selectChoices = [];
    if (categoryDimensions.length && valueDimensions.length) {
      selectChoices = [
        { value: "name", label: this.getFieldAlias(categoryDimensions[0].uid) },
        { value: "value", label: this.getFieldAlias(valueDimensions[0].uid) }
      ];
    } else {
      selectChoices = [
        { value: "name", label: "名称(示例数据)" },
        { value: "value", label: "数值(示例数据)" }
      ];
    }
    return selectChoices;
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
    let commaDisplay = this.getOption<boolean>("tooltip-comma-display")
    let tooltipValueType = this.getOption<string>("tooltip-text-type");
    let tooltipValueDecimalPlaces = this.getOption<number>("tooltip-decimal-places");
    let tooltipValueCompleteZero = this.getOption<boolean>("tooltip-complete-zero");

    const projectId = this.getBoard().projectId;
    const seriesCssColors = this.getSeriesCssColors();
    let showTooltip = this.getOption<boolean>("tooltip");
    let tooltipBackground = backgroundImage?.relativePath ? `url("${projectId}/${backgroundImage.relativePath}")` : backgroundColor;
    return {
      trigger: 'item',
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
      formatter: (param) => {
        let dataHtml = "";
        let iconColor = param?.data?.["iconColor"] || seriesCssColors[param.dataIndex % seriesCssColors.length];
        let iconHtml = showIcon ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${iconColor};"></span>` : "";
        let unitHtml = showUnit ? `<span style="color:${unitFontColor};font-size:${unitFontSize}px;line-height:1;">${unitText}</span>` : "";

        let resultValue: any = param?.data?.["value"];
        if (isNaN(resultValue)) resultValue = 0;

        if (tooltipValueType === "normal") {
          resultValue = formatFloat(resultValue, tooltipValueDecimalPlaces, tooltipValueCompleteZero);
        } else {
          resultValue = param?.data?.["percentValue"] || param.percent;
          resultValue = formatFloat(resultValue, tooltipValueDecimalPlaces, tooltipValueCompleteZero) + '%';
        }
        if (commaDisplay) {
          resultValue = this.doCommaSeparat(resultValue)
        }
        dataHtml += `<div>
          ${iconHtml}
          <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${param.name}：</span>
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
    let sourceData = this.datasetSource();
    let totalValue = sourceData.reduce((result, current) => {
      let currentValue = isNaN(current["value"]) ? 0 : Number(current["value"]);
      result = result + currentValue;
      return result;
    }, 0);

    let showLegendValue = this.getOption<boolean>("legend-value");
    let legendValueType = this.getOption<string>("legend-value-type");
    let legendValueDecimalPlaces = this.getOption<number>("legend-value-decimal-places");
    let legendValueCompleteZero = this.getOption<boolean>("legend-value-complete-zero");
    let legendFont = this.getOption<OptionFontValue>("legend-font");
    let legendValueFont = this.getOption<OptionFontValue>("legend-value-font");
    let legendValuepadding = this.getOption<number>("legend-value-padding");
    let legendTextPadding = this.getOption<number>("legend-text-padding");
    let legendUnit = this.getOption<string>("legend-value-unit");
    let legendUnitStyle = this.getOption<OptionFontValue>("legend-unit-style");
    let legendUnitPadding = this.getOption<number>("legend-unit-padding");
    let legendLimit = this.getOption<number>("legend-text-limit");
    return {
      textStyle: {
        color: this.toEchartsColor(legendFont.color as Color) || this.toEchartsColor(this.getOption<Color>("legend-color")),
        fontSize: legendFont.size || this.getOption<number>("legend-font-size"),
        fontFamily: legendFont.family,
        fontWeight: legendFont.bold ? "bold" : "normal",
        fontStyle: legendFont.italic ? "italic" : "normal",
        padding: [0, 0, 0, Number(legendTextPadding)],
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
    }
  }

  get defaultPadding() {
    const padding = {
      left: 10,
      right: 10,
      top: 10,
      bottom: 10
    }
    return padding;
  }

  get pieSizeOpts() {
    let paddingTop = this.getOption<string>("padding-top") == "auto" ? this.defaultPadding.top : this.getOption<number>("padding-top-diy");
    let paddingRight = this.getOption<string>("padding-right") == "auto" ? this.defaultPadding.right : this.getOption<number>("padding-right-diy");
    let paddingBottom = this.getOption<string>("padding-bottom") == "auto" ? this.defaultPadding.bottom : this.getOption<number>("padding-bottom-diy");
    let paddingLeft = this.getOption<string>("padding-left") == "auto" ? this.defaultPadding.left : this.getOption<number>("padding-left-diy");

    let left = paddingLeft;
    let right = paddingRight;
    let bottom = paddingBottom;
    let top = paddingTop;
    let width = this.contentSize.width - paddingRight - paddingLeft;
    let height = this.contentSize.height - paddingTop - paddingBottom;

    return { left, right, top, bottom, width, height };
  }

  get echartsSeriesOption(): SeriesOption | SeriesOption[] {
    let labelPosition = this.getOption<"outside" | "inside">("label-position");
    let labelShowName = this.getOption<boolean>("label-name-visible") && this.getOption<string>("label-position") === "inside" || this.getOption<boolean>("label-name-visible_outside") && this.getOption<string>("label-position") === "outside";
    let labelNameFont = this.getOption<OptionFontValue>("label-font");

    let labelShowValue = this.getOption<boolean>("label-value-visible");
    let labelValueType = this.getOption<string>("label-text-type");
    let labelValueDecimalPlaces = this.getOption<number>("label-decimal-places");
    let labelValueCompleteZero = this.getOption<boolean>("label-complete-zero");
    let labelValueFont = this.getOption<OptionFontValue>("label-value-font");
    let labelShapeSpacing = this.getOption<number>("label-shape-spacing");
    let unitFont = this.getOption<OptionFontValue>("label-unit-font");
    let labelShow = this.getOption<boolean>("label") && (labelShowName || labelShowValue);

    let pieSize = Math.min(this.contentSize.height, this.contentSize.width) / 2 * 0.75;
    let borderWidth = this.getOption<number>("shape-border-width");
    let borderColors = Array.from(this.getOption<Color[]>("shape-border-color")).map((color) => { return this.toEchartsColor(color) });
    let insideBorderWidth = this.getOption<number>("inside-border-width");
    let insideBorderColor = this.toEchartsColor(this.getOption<Color>("inside-border-color"));
    let backgroundColor = new Color(this.getOption<Color>("shape-background")).hexa();
    let pieStartAngle = this.getOption<number>("angle-start");

    let titleName = "value";
    let categoryDims = this.getOption<OptionFieldValue[]>("axis-category") || [];
    let valueDims = this.getOption<OptionFieldValue[]>("axis-value") || [];
    if (categoryDims.length && valueDims.length) {
      titleName = this.getFieldAlias(valueDims[0].uid);
    }

    let shapeSizeOffset = (this.getOption<number>('shape-size') - 75) * 0.01 * pieSize;
    return [
      {
        name: titleName,
        type: "pie",
        radius: [0, pieSize + shapeSizeOffset],
        startAngle: pieStartAngle,
        percentPrecision: labelValueDecimalPlaces,
        label: {
          show: labelShow,
          position: labelPosition,
          edgeDistance: 20 - labelShapeSpacing,
          alignTo: 'edge',
          color: 'auto',
          fontSize: 16,
          formatter: (param) => {
            let resultValue: any = 0;
            let unit = this.getOption<string>("label-unit-value");
            if (labelValueType === "normal") {
              resultValue = param?.value;
              if (typeof resultValue == "object") {
                resultValue = resultValue["value"];
              }
              resultValue = formatFloat(resultValue, labelValueDecimalPlaces, labelValueCompleteZero);
            } else {
              resultValue = formatFloat(param.percent, labelValueDecimalPlaces, labelValueCompleteZero) + '%';
            }
            let resultStr = "";
            if (labelShowName) {
              resultStr = resultStr + `{name| ${param.name}}`;
            }
            if (labelShowValue) {
              if (labelShowName) resultStr += "\n";
              resultStr = resultStr + `{value| ${resultValue}}`;
            }
            resultStr += `{unit| ${unit}}`
            return resultStr;
          },
          rich: {
            name: {
              color: new Color(labelNameFont.color).alpha() == 0 ? "auto" : new Color(labelNameFont.color).toCssString(),
              fontSize: labelNameFont.size,
              fontFamily: labelNameFont.family,
              fontWeight: labelNameFont.bold ? "bold" : "normal",
              fontStyle: labelNameFont.italic ? "italic" : "normal",
            },
            value: {
              color: new Color(labelValueFont.color).alpha() == 0 ? "auto" : new Color(labelValueFont.color).toCssString(),
              fontSize: labelValueFont.size,
              fontFamily: labelValueFont.family,
              fontWeight: labelValueFont.bold ? "bold" : "normal",
              fontStyle: labelValueFont.italic ? "italic" : "normal",
            },
            unit: {
              color: new Color(unitFont.color).alpha() == 0 ? "auto" : new Color(unitFont.color).toCssString(),
              fontWeight: unitFont.bold ? "bold" : "normal",
              fontStyle: unitFont.italic ? "italic" : "normal",
              fontSize: unitFont.size,
              fontFamily: unitFont.family,
            }
          }
        },
        labelLayout: {
          moveOverlap: "shiftY"
        },
        selectedMode: "single",
        emphasis: {
          scale: false
        },
        itemStyle: {
          borderWidth: insideBorderWidth,
          borderColor: insideBorderColor,
        },
        z: 5,
        ...this.pieSizeOpts,
      },
      {
        name: "borderSerie",
        type: "pie",
        radius: [pieSize + shapeSizeOffset, pieSize + borderWidth + shapeSizeOffset],
        startAngle: pieStartAngle,
        label: {
          show: false,
        },
        itemStyle: {
          color: (param) => {
            return borderColors[param.dataIndex % borderColors.length];
          },
        },
        selectedMode: "single",
        emphasis: {
          scale: false
        },
        silent: true,
        z: 5,
        ...this.pieSizeOpts,
      },
      {
        name: "backgroundSerie",
        type: "pie",
        radius: [0, pieSize + shapeSizeOffset],
        startAngle: pieStartAngle,
        selectedMode: false,
        label: {
          show: false,
        },
        itemStyle: {
          color: backgroundColor,
        },
        emphasis: {
          scale: false
        },
        silent: true,
        ...this.pieSizeOpts,
      },
    ]
  }

  checkErrorData() {
    let xDims = this.getOption<OptionFieldValue[]>("axis-category") || [];
    let yDims = this.getOption<OptionFieldValue[]>("axis-value") || [];
    if (xDims.length && yDims.length) {
      this.clearErrorDataStatus();
    } else {
      if (xDims.length || yDims.length) {
        this.addErrorDataStatus("filed-incomplete");
      } else {
        this.addErrorDataStatus("filed-empty");
      }
    }
  }

  _datasetSource() {
    let xDims = this.getOption<OptionFieldValue[]>("axis-category") || [];
    let yDims = this.getOption<OptionFieldValue[]>("axis-value") || [];
    let dataSource = [];
    let dataType = "sum";
    if (xDims.length && yDims.length) {
      dataType = yDims[0].summary;
      dataSource = this.createView(["axis-category", "axis-value"]);
      dataSource = this.dealDataByAggregate(dataSource, [xDims[0]], yDims);
      dataSource = dataSource.map(row => {
        return {
          name: row[xDims[0].uid[2]],
          value: this.getMetric(row, yDims[0]),
          'self_row_data': row
        }
      });
    } else {
      let privateData = this.getPrivateData();
      let fields = privateData.fields;
      let rows = privateData.rows;
      if (fields.length > 1) {
        let nameUid, valueUid;
        fields.forEach(field => {
          if (field.type === "string") {
            nameUid = field.uid;
          } else if (field.type === "number") {
            valueUid = field.uid;
          }
        })
        if (nameUid && valueUid) {
          rows.forEach(row => {
            dataSource.push({
              name: row[nameUid],
              value: row[valueUid],
              'self_row_data': row
            })
          })
        }
      }
    }
    //处理数据
    dataSource = this.getDataAfterSort(dataSource);
    return dataSource;
  }

  getDataAfterSort(dataSource) {
    this.originDataSource = JSON.parse(JSON.stringify(dataSource));
    let sortUid = this.getOption<string>("fields-data-sort-fields");
    let sortType = this.getOption("fields-data-sort-orderby");
    if(sortUid){
      dataSource = dataSource.sort((a,b)=>{
        const aSortData = a.self_row_data?._metrics?.[sortUid];
        const bSortData = b.self_row_data?._metrics?.[sortUid];
        let aValue = aSortData ? aSortData[Object.keys(aSortData)[0]] : a.self_row_data[sortUid];
        let bValue = bSortData ? bSortData[Object.keys(bSortData)[0]] : b.self_row_data[sortUid];
        if(aValue == undefined && bValue == undefined) return 0;
        if(!isNaN(aValue) && !isNaN(bValue)){
          if(sortType === 1){
            return aValue - bValue;
          }else {
            return bValue - aValue;
          }
        }else {
          if(sortType === 1){
            return aValue.localeCompare(bValue, "zh");
          }else {
            return bValue.localeCompare(aValue, "zh");
          }
        }
      });
    }
    return dataSource;
  }

  initEchartsEvents() {
    super.initEchartsEvents();
    this.echartsChart.off("selectchanged");
    this.echartsChart.on("selectchanged", (param: any) => {
      let targetSeriesIndex = param.fromActionPayload.seriesIndex;
      let data = this.datasetSource()
      let catUid = this.getOption("axis-category")?.[0]?.uid;
      let targetDataIndex = param.fromActionPayload.dataIndexInside
      if (targetDataIndex == undefined) {
        targetDataIndex = param.fromActionPayload.dataIndex;
      }
      if (targetSeriesIndex != 0) return
      const triggerLinkage = param.isFromClick ? true : this.animationTriggerLinkage;
      if (param.fromAction == "select") {
        if (catUid) {
          let currentDataIndex = this.type === "widget.echarts.donut" ? targetDataIndex / 2 : targetDataIndex;
          let currentData = data[currentDataIndex];
          let linkages = [];
          this.selectedData.value = currentData
          if ((currentData && this.getOption("display-with-linkage")) || param.isFromClick) { // 如果是点击，就直接触发联动
            let fieldArr = this.getOption<string>("linkage-form-field")?.split(".")
            let fieldUIDs;
            let filterValue;
            if (fieldArr?.length) {
              if (fieldArr.length === 2) {
                fieldUIDs = [catUid[0], ...fieldArr];
                filterValue = currentData['self_row_data']?.[fieldArr[1]];
              } else if (fieldArr.length === 3) {
                fieldUIDs = [catUid[0], fieldArr[0], `${fieldArr[1]}.${fieldArr[2]}`];
                filterValue = currentData['self_row_data']?.[fieldArr[1]].map(item => item[fieldArr[2]]);
              }
            }
            linkages.push({ uid: fieldUIDs as OptionFieldUID, value: filterValue });
            triggerLinkage && this.applyLinkage(linkages)
          }
        }
        this.echartsChart.dispatchAction({
          type: "select",
          seriesName: "borderSerie",
          dataIndex: targetDataIndex
        });
        this.echartsChart.dispatchAction({
          type: "select",
          seriesName: "selectValue",
          dataIndex: this.type === "widget.echarts.rose-donut" ? targetDataIndex * 2 : targetDataIndex
        });
      } else {
        triggerLinkage && this.withdrawLinkage()
        this.echartsChart.dispatchAction({
          type: "unselect",
          seriesName: "borderSerie",
          dataIndex: targetDataIndex
        })
        this.echartsChart.dispatchAction({
          type: "unselect",
          seriesName: "selectValue",
          dataIndex: this.type === "widget.echarts.rose-donut" ? targetDataIndex * 2 : targetDataIndex
        });
      }

      if (param?.isFromClick) {
      }
    });
  }

  beginAnimationDisplay() {
    super.beginAnimationDisplay();
    let that = this;
    let display_stay = Math.max(this.getOption<number>("animation-display-duration") * 1000, 1000);
    let promise = Promise.resolve();
    let baseDataLength = this.type === "widget.echarts.donut" ? 2 : 1;
    let update_data = (resolve) => {
      // 先执行一次 否则刚开始会多停顿 display_stay 的时长
      that.echartsChart.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: this.selectedIndex.value });
      that.echartsChart.dispatchAction({ type: 'select', seriesIndex: 0, dataIndex: this.selectedIndex.value });
      that.selectedIndex.value += baseDataLength;
      that.animation_display_timeout = setInterval(() => {
        if (that.stopAnimate) {
          clearInterval(that.animation_display_timeout);
          that.echartsChart.dispatchAction({ type: 'hideTip' });
          that.echartsChart.dispatchAction({ type: 'unselect', seriesIndex: 0, dataIndex: this.selectedIndex.value });
          return resolve();
        }
        let dataSourceLength = that.echartsChart.getOption().dataset?.[0]?.source?.length || 0;
        dataSourceLength *= baseDataLength;
        if (that.animation_display_paused || !dataSourceLength) return;

        //选中当前
        if (that.selectedIndex.value > dataSourceLength - baseDataLength) {
          that.echartsChart.dispatchAction({ type: 'hideTip' });
          that.echartsChart.dispatchAction({ type: 'unselect', seriesIndex: 0, dataIndex: this.selectedIndex.value - baseDataLength });
          that.selectedIndex.value = 0;
          clearInterval(that.animation_display_timeout);
          resolve();
        } else {
          that.echartsChart.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: that.selectedIndex.value });
          that.echartsChart.dispatchAction({ type: 'select', seriesIndex: 0, dataIndex: that.selectedIndex.value });
          that.selectedIndex.value += baseDataLength;
        }

      }, display_stay);
    };
    promise = new Promise((resolve) => {
      update_data(resolve);
    });
    if (promise) {
      that.b2_animators.push(promise);
    }
  }

  restartAnimationDisplay() {
    this.stopAnimationDisplay();
    this.selectedIndex.value = 0;
    this.echartsChart.setOption({
      series: this.echartsSeriesOption
    }, {
      notMerge: false,
      replaceMerge: ["series"]
    })
    this.startAnimationDisplay();
  }

  get currentValue() {
    return this.selectedData.value
  }
}
