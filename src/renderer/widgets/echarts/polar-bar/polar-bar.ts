import { formatFloat } from "@common/utils/math";
import { TheWidget as EchartsChart, component as B2Chart } from "@renderer/widgets/echarts/basic";
import { PrivateData, PrivateDataConnectionUID, PrivateDataTableUID, OptionFieldUID } from "@common/types/project";
import { DefinedOptions, OptionFileValue, OptionFontValue, WidgetMetaData, ChartClickState } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { TooltipComponentOption, XAXisComponentOption, YAXisComponentOption, SeriesOption, EChartsOption, AngleAxisComponentOption, RadiusAxisComponentOption, PolarComponentOption } from "echarts/dist/echarts";
import { OptionFieldValue } from "@renderer/b2/types";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { Ref, ref, watch } from "vue";
import { merge, recursive } from "merge";

export class PolarBar extends EchartsChart {
  noDims: Boolean = false;
  protected axisUnitMap: Object = {
    3: "k",
    4: "万",
    5: "十万",
    6: "百万",
    7: "千万",
    8: "亿",
  };
  static resource = recursive(true, EchartsChart.resource, resource);
  static defineOptions(): DefinedOptions[] {
    const UNIT_GE = i18next.t("unitGe");
    const UNIT_WEI = i18next.t("unitWei");
    return [
      {
        data: {
          fields: {
            alias: i18next.t("fields"),
            fold: "unfold",
            children: [
              {
                name: "axis-category",
                type: "field(recommend=string)",
                alias: i18next.t("axisCategory"),
                default: [
                  {
                    "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_name"],
                    "__opt_type": "field",
                    "summary": ""
                  }
                ]
              },
              {
                name: "axis-value",
                type: "field(aggs=sum|none|max|min|mean|count|distinct, min=0)",
                alias: i18next.t("axisValue"),
                default: [
                  {
                    "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_value"],
                    "__opt_type": "field",
                    "summary": "sum"
                  }
                ]
              },
              {
                name: "axis-fields",
                visible: false
              }
            ]
          },
        },
        style: {
          basic: {
            children: [
              {
                name: "angle-start",
                alias: i18next.t("angleStart"),
                default: 90,
                type: "number(min=0,max=360,showInput,unit=°)",
              },
              {
                name: "inner-radius",
                default: 30,
                type: "number(min=0, max=100, step=1, showInput, unit=%)",
                alias: i18next.t("innerRadius"),
              },
              {
                name: "outer-radius",
                default: 80,
                type: "number(min=50, max=100, step=1, showInput, unit=%)",
                alias: i18next.t("outerRadius"),
              },
            ]
          },
          "axis": {
            visible: true,
            children: [
              {
                name: "angle-display-cluster",
                alias: i18next.t("angleDisplay"),
                show: "tab",
                children: [
                  {
                    name: "angle-display",
                    alias: i18next.t("angleDisplay"),
                    type: "boolean",
                    default: true,
                  },
                  {
                    name: "angle-label-cluster",
                    alias: i18next.t("angleLabel"),
                    fold: "unfold",
                    children: [
                      {
                        name: "angle-label",
                        alias: i18next.t("angleLabel"),
                        type: "boolean",
                        default: true,
                      },
                      {
                        name: "angle-label-offset",
                        alias: i18next.t("angleLabelOffset"),
                        type: "number(unit=px)",
                        default: 10,
                        disabled: (widget: PolarBar) => {
                          return !widget.getOption("angle-label");
                        },
                      },
                      {
                        name: "angle-font",
                        alias: i18next.t("angleFont"),
                        type: "font",
                        default: {
                          family: "sans-serif",
                          size: 12,
                          color: "#fff",
                          bold: false,
                          italic: false,
                          underline: false,
                          deleteline: false,
                        },
                        disabled: (widget: PolarBar) => {
                          return !widget.getOption("angle-label");
                        },
                      },
                      {
                        name: "angle-display-shadow-color",
                        alias: i18next.t("angleDisplayShadowColor"),
                        type: "color",
                        default: "#ffffff",
                        disabled: (widget: PolarBar) => {
                          return !widget.getOption("angle-label");
                        },
                      },
                      {
                        name: "angle-display-shadow-blur",
                        alias: i18next.t("angleDisplayShadowBlur"),
                        type: "number(unit=px)",
                        default: 0,
                        disabled: (widget: PolarBar) => {
                          return !widget.getOption("angle-label");
                        },
                      },
                      {
                        name: "angle-display-shadow-offset-x",
                        alias: i18next.t("angleDisplayShadowOffsetX"),
                        type: "number(unit=px)",
                        default: 0,
                        disabled: (widget: PolarBar) => {
                          return !widget.getOption("angle-label");
                        },
                      },
                      {
                        name: "angle-display-shadow-offset-y",
                        alias: i18next.t("angleDisplayShadowOffsetY"),
                        type: "number(unit=px)",
                        default: 0,
                        disabled: (widget: PolarBar) => {
                          return !widget.getOption("angle-label");
                        },
                      },
                    ],
                  },
                  {
                    name: "grid-angle-cluster",
                    alias: i18next.t("grid"),
                    children: [
                      {
                        name: "grid-angle-line-shape-type",
                        alias: i18next.t("line_shape_type"),
                        default: "line",
                        type: "select(radioGroup)",
                        selectChoices: [
                          {
                            value: "line",
                            label: i18next.t("polygon"),
                          },
                          {
                            value: "circle",
                            label: i18next.t("circle"),
                          },
                        ],
                        visible: false,
                      },
                      {
                        name: "grid-angle-line-type",
                        alias: i18next.t("line_type"),
                        default: "dotted",
                        type: "select(radioGroup)",
                        selectChoices: [
                          {
                            value: "line",
                            label: i18next.t("line"),
                          },
                          {
                            value: "dotted",
                            label: i18next.t("dotted"),
                          },
                        ],
                      },
                      {
                        name: "grid-angle-line-dotted-width",
                        alias: i18next.t("line_dotted_width"),
                        default: 4,
                        // range:"[2,30,1]",
                        type: "number(unit=px)",
                        visible: (widget: PolarBar) => {
                          return (
                            widget.getOption("grid-angle-line-type") == "dotted"
                          );
                        },
                      },
                      {
                        name: "grid-angle-line-colors",
                        alias: i18next.t("line_colors"),
                        type: "palette(gradient)",
                        default: ["#fff"],
                      },
                      {
                        name: "grid-angle-line-width",
                        alias: i18next.t("line_width"),
                        default: 1,
                        type: "number(unit=px)",
                      }
                    ],
                  },
                ],
              },
              {
                name: "radius-display-cluster",
                alias: i18next.t("radiusDisplay"),
                show: "tab",

                children: [
                  {
                    name: "radius-display",
                    alias: i18next.t("radiusDisplay"),
                    type: "boolean",
                    default: true,
                  },
                  {
                    name: "radius-line-cluster",
                    alias: i18next.t("radiusLine"),
                    children: [
                      {
                        name: "radius-line",
                        alias: i18next.t("radiusLine"),
                        type: "boolean",
                        default: true,
                      },
                      {
                        name: "radius-line-type",
                        alias: i18next.t("radiusLineType"),
                        type: "select(radioGroup)",
                        default: "solid",
                        selectChoices: [
                          {
                            value: "dashed",
                            label: i18next.t("dotted"),
                          },
                          {
                            value: "solid",
                            label: i18next.t("solid"),
                          },
                        ],
                        disabled: (widget: PolarBar) => {
                          return !widget.getOption("radius-line");
                        },
                      },
                      {
                        name: "radius-line-color",
                        alias: i18next.t("radiusLineColor"),
                        type: "color",
                        default: "#CCCCCC",
                        disabled: (widget: PolarBar) => {
                          return !widget.getOption("radius-line");
                        },
                      },
                      {
                        name: "radius-line-width",
                        alias: i18next.t("radiusLineWidth"),
                        type: "number(unit=px)",
                        default: 1,
                        disabled: (widget: PolarBar) => {
                          return !widget.getOption("radius-line");
                        },
                      },
                    ],
                  },
                  {
                    name: "radius-tickline-cluster",
                    alias: i18next.t("radiusTickline"),
                    children: [
                      {
                        name: "radius-tickline",
                        alias: i18next.t("radiusTickline"),
                        type: "boolean",
                        default: true,
                      },
                      {
                        name: "radius-tickline-color",
                        alias: i18next.t("radiusTicklineColor"),
                        type: "color",
                        default: "#CCCCCC",
                        disabled: (widget: PolarBar) => {
                          return !widget.getOption("radius-tickline");
                        },
                      },
                      {
                        name: "radius-tickline-width",
                        alias: i18next.t("radiusTicklineWidth"),
                        type: "number(unit=px)",
                        default: 2,
                        disabled: (widget: PolarBar) => {
                          return !widget.getOption("radius-tickline");
                        },
                      },
                      {
                        name: "radius-tickline-length",
                        alias: i18next.t("radiusTicklineLength"),
                        type: "number(unit=px)",
                        default: 5,
                        disabled: (widget: PolarBar) => {
                          return !widget.getOption("radius-tickline");
                        },
                      },
                    ],
                  },
                  {
                    name: "radius-label-cluster",
                    alias: i18next.t("radiusLabel"),
                    children: [
                      {
                        name: "radius-label",
                        alias: i18next.t("radiusLabel"),
                        type: "boolean",
                        default: true,
                      },
                      {
                        name: "radius-label-position",
                        alias: i18next.t("radiusLabelPosition"),
                        type: "select(radioGroup)",
                        default: "outside",
                        selectChoices: [
                          {
                            value: "outside",
                            label: i18next.t("lineOutside"),
                          },
                          {
                            value: "above",
                            label: i18next.t("above"),
                          },
                        ],
                        visible: (widget: PolarBar) => {
                          return widget.transposed;
                        },
                      },
                      {
                        name: "radius-text-type",
                        alias: i18next.t("radiusTextType"),
                        default: "normal", //FIXME this.getYFormatter() ? "percent" : "normal",
                        type: "select(radioGroup)",
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
                        disabled: (widget: PolarBar) => {
                          return !widget.getOption("radius-label");
                        },
                      },
                      {
                        name: "radius-value-abbreviation",
                        alias: i18next.t("radiusValueAbbreviation"),
                        type: "select",
                        default: "0",
                        selectChoices: [
                          {
                            label: i18next.t("noSet"),
                            value: "0",
                          },
                          {
                            label: "K",
                            value: "3",
                          },
                          {
                            label: "万",
                            value: "4",
                          },
                          {
                            label: "十万",
                            value: "5",
                          },
                          {
                            label: "百万",
                            value: "6",
                          },
                          {
                            label: "千万",
                            value: "7",
                          },
                          {
                            label: "亿",
                            value: "8",
                          },
                        ],
                        disabled: (widget: PolarBar) => {
                          return !widget.getOption("radius-label");
                        },
                      },
                      {
                        name: "radius-decimal-places",
                        alias: i18next.t("radiusDecimalPlaces"),
                        type: "number(unit=" + UNIT_WEI + ")",
                        default: 0,
                        disabled: (widget: PolarBar) => {
                          return !widget.getOption("radius-label");
                        },
                      },
                      {
                        name: "radius-complete-zero",
                        alias: i18next.t("radiusCompleteZero"),
                        type: "boolean",
                        default: false,
                        disabled: (widget: PolarBar) => {
                          return !widget.getOption("radius-label");
                        },
                      },
                      {
                        name: "radius-label-offset",
                        alias: i18next.t("radiusLabelOffset"),
                        type: "number(unit=px)",
                        default: 10,
                        disabled: (widget: PolarBar) => {
                          return !widget.getOption("radius-label");
                        },
                      },
                      {
                        name: "radius-scale-range",
                        alias: i18next.t("radius_scale_range"),
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
                        disabled: (widget: PolarBar) => {
                          return !widget.getOption("radius-label");
                        },
                      },
                      {
                        name: "radius-scale-min",
                        alias: i18next.t("radius_scale_min"),
                        type: "number",
                        default: 0,
                        visible: (widget: PolarBar) => {
                          return widget.getOption("radius-scale-range") == "custom";
                        },
                      },
                      {
                        name: "radius-scale-max",
                        alias: i18next.t("radius_scale_max"),
                        type: "number",
                        default: 100,
                        visible: (widget: PolarBar) => {
                          return widget.getOption("radius-scale-range") == "custom";
                        },
                      },
                      {
                        name: "radius-scale-interval",
                        alias: i18next.t("radius_scale_interval"),
                        type: "number(unit=" + UNIT_GE + ")",
                        default: 50,
                        visible: (widget: PolarBar) => {
                          return false
                        },
                      },
                      {
                        name: "radius-font",
                        alias: i18next.t("font"),
                        type: "font",
                        default: {
                          family: "sans-serif",
                          size: 12,
                          bold: false,
                          italic: false,
                          underline: false,
                          deleteline: false,
                        },
                        disabled: (widget: PolarBar) => {
                          return !widget.getOption("radius-label");
                        },
                      },
                      {
                        name: "radius-display-shadow-color",
                        alias: i18next.t("radius_display_shadow_color"),
                        type: "color",
                        default: "#ffffff",
                        disabled: (widget: PolarBar) => {
                          return !widget.getOption("radius-label");
                        },
                      },
                      {
                        name: "radius-display-shadow-blur",
                        alias: i18next.t("radius_display_shadow_blur"),
                        type: "number(unit=px)",
                        default: 0,
                        disabled: (widget: PolarBar) => {
                          return !widget.getOption("radius-label");
                        },
                      },
                      {
                        name: "radius-display-shadow-offset-x",
                        alias: i18next.t("radius_display_shadow_offset_x"),
                        type: "number(unit=px)",
                        default: 0,
                        disabled: (widget: PolarBar) => {
                          return !widget.getOption("radius-label");
                        },
                      },
                      {
                        name: "radius-display-shadow-offset-y",
                        alias: i18next.t("radius_display_shadow_offset_y"),
                        type: "number(unit=px)",
                        default: 0,
                        disabled: (widget: PolarBar) => {
                          return !widget.getOption("radius-label");
                        },
                      },
                      {
                        name: "radius-rotate",
                        alias: i18next.t("radius_rotate"),
                        type: "select",
                        default: "0",
                        disabled: (widget: PolarBar) => {
                          return !widget.getOption("radius-label");
                        },
                        selectChoices: [
                          {
                            value: "0",
                            label: i18next.t("noRotate"),
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
                      },
                    ],
                  },
                  {
                    name: "grid-radius-cluster",
                    alias: i18next.t("grid"),
                    children: [
                      {
                        name: "grid-radius-line-shape-type",
                        alias: i18next.t("line_shape_type"),
                        default: "line",
                        type: "select(radioGroup)",
                        selectChoices: [
                          {
                            value: "line",
                            label: i18next.t("polygon"),
                          },
                          {
                            value: "circle",
                            label: i18next.t("circle"),
                          },
                        ],
                        visible: false,
                      },
                      {
                        name: "grid-radius-line-type",
                        alias: i18next.t("line_shape_type"),
                        default: "dotted",
                        type: "select(radioGroup)",
                        selectChoices: [
                          {
                            value: "line",
                            label: i18next.t("line"),
                          },
                          {
                            value: "dotted",
                            label: i18next.t("dotted"),
                          },
                        ],
                      },
                      {
                        name: "grid-radius-line-dotted-width",
                        alias: i18next.t("line_dotted_width"),
                        default: 4,
                        // range:"[2,30,1]",
                        type: "number(unit=px)",
                        visible: (widget: PolarBar) => {
                          return (
                            widget.getOption("grid-radius-line-type") == "dotted"
                          );
                        },
                      },
                      {
                        name: "grid-radius-line-colors",
                        alias: i18next.t("line_colors"),
                        type: "palette(gradient)",
                        default: ["#fff"],
                      },
                      {
                        name: "grid-radius-line-width",
                        alias: i18next.t("line_width"),
                        default: 1,
                        type: "number(unit=px)",
                      },
                      {
                        name: "grid-radius-line-fill",
                        alias: i18next.t("grid_radius_line_fill"),
                        type: "palette(gradient)",
                        default: ['#FFFFFF00'],
                      },
                    ],
                  },
                ],
              }
            ]
          },
          "label-group": {
            alias: i18next.t("label"),
            children: [
              {
                name: "label-default-cluster",
                alias: i18next.t("label"),
                show: "tab",
                children: [
                  {
                    name: "label",
                    alias: i18next.t("label"),
                    type: "boolean",
                    default: false,
                  },
                  {
                    name: "label-font",
                    alias: i18next.t("font"),
                    type: "font",
                    default: {
                      family: "sans-serif",
                      color: "#ffffff",
                      size: 12,
                      bold: false,
                      italic: false,
                    },
                  },
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
                    disabled: (widget: PolarBar) => { return !widget.getOption<boolean>("label-value-visible") },
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
                    type: "number(unit=" + UNIT_WEI + ")",
                    default: 2,
                    disabled: (widget: PolarBar) => { return !widget.getOption<boolean>("label-value-visible") },
                  },
                  {
                    name: "label-complete-zero",
                    alias: i18next.t("labelCompleteZero"),
                    type: "boolean",
                    default: false,
                    disabled: (widget: PolarBar) => { return !widget.getOption<boolean>("label-value-visible") },
                  },
                ],
              }
            ]
          },
          padding: {
            visible: false,
          },
          legend: {
            default: false,
            visible: false
          },
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

    let tooltipValueType = this.getOption<string>("tooltip-text-type");
    let tooltipValueDecimalPlaces = this.getOption<number>("tooltip-decimal-places");
    let tooltipValueCompleteZero = this.getOption<boolean>("tooltip-complete-zero");

    const projectId = this.getBoard().projectId;
    const seriesCssColors = this.getSeriesCssColors();
    let showTooltip = this.getOption<boolean>("tooltip");
    let tooltipBackground = backgroundImage?.relativePath ? `url("${projectId}/${backgroundImage.relativePath}")` : backgroundColor;
    return {
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
        let iconHtml = showIcon ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${seriesCssColors[param.seriesIndex % seriesCssColors.length]};"></span>` : "";

        let resultValue: any = param.value;
        if (isNaN(resultValue)) resultValue = 0;

        if (tooltipValueType === "normal") {
          resultValue = formatFloat(resultValue, tooltipValueDecimalPlaces, tooltipValueCompleteZero);
        } else {
          let sum = this.echartsData.reduce((results, current) => {
            return results + current.value
          }, 0)
          resultValue = parseInt((param.value / sum) * 100 as any)
          resultValue = formatFloat(resultValue, tooltipValueDecimalPlaces, tooltipValueCompleteZero) + '%';
        }
        if(commaDisplay){
            resultValue = this.doCommaSeparat(resultValue)
        }
        dataHtml += `<div>
          ${iconHtml}
          <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${param.name}：</span>
          <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${resultValue}</span>
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

  get polarOption(): PolarComponentOption | PolarComponentOption[] {
    let innerRadius = this.getOption<number>("inner-radius") + '%';
    let outerRadius = this.getOption<number>("outer-radius") + '%';
    return {
      radius: [innerRadius, outerRadius]
    }
  }

  get getRadiusCustomScale() {
    let max = this.getOption<number>("radius-scale-max");
    let min = this.getOption<number>("radius-scale-min");
    let dataMax = Math.max(...this.echartsData.map(item => {
      return item.value;
    }))
    let dataMin = Math.min(...this.echartsData.map(item => {
      return item.value;
    }))
    if (max < dataMax) {
      max = dataMax
    }
    if (min > dataMin) {
      min = dataMin
    }
    return { max, min }
  }

  get radiusAxisOption(): RadiusAxisComponentOption | RadiusAxisComponentOption[] {
    let showAxis = this.getOption<boolean>("radius-display");
    let axisLabelFont = this.getOption<OptionFontValue>(`radius-font`);
    let yIsPercent = this.getOption(`radius-text-type`) === "percent";
    let yDecimalPlaces = Math.max(this.getOption(`radius-decimal-places`), 0);
    let yCompleteZero = this.getOption<boolean>(`radius-complete-zero`);
    let valueAbb = this.getOption<string>(`radius-value-abbreviation`);

    let angleAxisDisplay = this.getOption<boolean>("angle-display");
    let angleAxisLabelFont = this.getOption<OptionFontValue>("angle-font");

    let customScale = this.getOption<string>("radius-scale-range") == "custom";

    let radarBackgroundColor = new Color(this.getOption<Color>("radar-background-color")).toEchartsColor();
    let dashWidth = this.getOption<number>(`grid-radius-line-dotted-width`) || 2;
    let splitLineColor = Array.from(this.getOption<Color[]>(`grid-radius-line-colors`)).map((color) => {
      return new Color(color).toEchartsColor();
    });
    let splitLineAreaColor = Array.from(this.getOption<Color[]>(`grid-radius-line-fill`))?.map((color) => {
      return new Color(color).toEchartsColor();
    });

    return {
      max: customScale ? this.getRadiusCustomScale.max : "dataMax",
      min: customScale ? this.getRadiusCustomScale.min : 0,
      nameGap: this.getOption<number>("angle-label-offset"),
      axisName: {
        show: angleAxisDisplay && this.getOption<boolean>("angle-label"),
        fontStyle: angleAxisLabelFont.italic ? "italic" : "normal",
        fontWeight: angleAxisLabelFont.bold ? "bold" : "normal",
        fontSize: angleAxisLabelFont.size,
        fontFamily: angleAxisLabelFont.family,
        color: this.toEchartsColor(angleAxisLabelFont.color as Color),
        textShadowColor: this.toEchartsColor(this.getOption<Color>("angle-display-shadow-color")),
        textShadowBlur: this.getOption<number>("angle-display-shadow-blur"),
        textShadowOffsetX: this.getOption<number>("angle-display-shadow-offset-x"),
        textShadowOffsetY: this.getOption<number>("angle-display-shadow-offset-y"),
      },
      axisLine: {
        show: showAxis && this.getOption<boolean>(`radius-line`),
        lineStyle: {
          color: this.toEchartsColor(this.getOption<Color>(`radius-line-color`)),
          width: Math.max(this.getOption<number>(`radius-line-width`), 0),
          type: this.getOption<"dashed" | "solid">(`radius-line-type`),
          join: "miter"
        },
      },
      axisTick: {
        show: showAxis && this.getOption<boolean>(`radius-tickline`),
        length: this.getOption<number>(`radius-tickline-length`),
        lineStyle: {
          width: this.getOption<number>(`radius-tickline-width`),
          color: this.toEchartsColor(this.getOption<Color>(`radius-tickline-color`)),
        }
      },
      axisLabel: {
        show: showAxis && this.getOption<boolean>(`radius-label`),
        showMinLabel:false,
        margin: this.getOption<number>(`radius-label-offset`),
        fontStyle: axisLabelFont.italic ? "italic" : "normal",
        fontWeight: axisLabelFont.bold ? "bold" : "normal",
        fontSize: axisLabelFont.size,
        fontFamily: axisLabelFont.family,
        color: this.toEchartsColor(axisLabelFont.color as Color),
        textShadowColor: this.toEchartsColor(this.getOption<Color>(`radius-display-shadow-color`)),
        textShadowBlur: this.getOption<number>(`radius-display-shadow-blur`),
        textShadowOffsetX: this.getOption<number>(`radius-display-shadow-offset-x`),
        textShadowOffsetY: this.getOption<number>(`radius-display-shadow-offset-y`),
        rotate: Number(this.getOption<string>(`radius-rotate`)),
        formatter: (value, index) => {
          let num = value;
          if (!isNaN(num)) {
            if (yIsPercent) {
              value = formatFloat(num * 100, yDecimalPlaces, yCompleteZero) + "%";
            } else {
              let abb = Number(valueAbb);
              let unit = this.axisUnitMap[abb] || "";
              value = formatFloat(num / Math.pow(10, abb), yDecimalPlaces, yCompleteZero) + unit;
            }
          }
          return value;
        }
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: splitLineColor,
          width: this.getOption<number>(`grid-radius-line-width`),
          type: this.getOption<string>(`grid-radius-line-type`) === "line" ? "solid" : dashWidth,
        }
      },
      splitArea: {
        show: true,
        areaStyle: {
          color: splitLineAreaColor?.length ? splitLineAreaColor : [radarBackgroundColor]
        }
      },

    }
  }

  get angleAxisOption(): AngleAxisComponentOption | AngleAxisComponentOption[] {
    let angleAxisDisplay = this.getOption<boolean>("angle-display");
    let angleAxisLabelFont: any = this.getOption<OptionFontValue>("angle-font");
    let angleShadowBlur = this.getOption<number>("angle-display-shadow-blur");
    let angleShadowOffsetX = this.getOption<number>("angle-display-shadow-offset-x");
    let angleShadowOffsetY = this.getOption<number>("angle-display-shadow-offset-y");
    let angleShadowColor = this.getOption<Color>("angle-display-shadow-color");

    let dashWidth = this.getOption<number>(`grid-angle-line-dotted-width`) || 2;
    let angleLabel = this.getOption<boolean>("angle-label");
    let angleLabelOffset = this.getOption<number>("angle-label-offset")
    let splitLineColor = Array.from(this.getOption<Color[]>(`grid-angle-line-colors`)).map((color) => {
      return new Color(color).toEchartsColor();
    });
    let categoryData = this.echartsData.map(item => {
      return item.name;
    })
    return {
      type: 'category',
      startAngle: this.getOption<number>("angle-start"),
      axisLabel: {
        show: angleAxisDisplay && angleLabel,
        fontSize: angleAxisLabelFont.size,
        color: angleAxisLabelFont.color,
        fontWeight: angleAxisLabelFont.bold ? 'bold' : 'normal',
        fontStyle: angleAxisLabelFont.italic ? 'italic' : 'normal',
        margin: angleLabelOffset,
        textShadowBlur:angleShadowBlur,
        textShadowOffsetX:angleShadowOffsetX,
        textShadowOffsetY:angleShadowOffsetY,
        textShadowColor:angleShadowColor
      },
      axisLine: {
        show: false
      },
      axisTick: {
        show: false
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: splitLineColor,
          width: this.getOption<number>(`grid-angle-line-width`),
          type: this.getOption<string>(`grid-angle-line-type`) === "line" ? "solid" : dashWidth,
        }
      },
      data: categoryData
    }
  }

  getLegendOtherOption() {
    return {}
  }

  get echartsOptionFunc(): {[key: string]: Function} {
    return {
      grid: ()=>this.echartsGridOption,
      tooltip: ()=>this.echartsTooltipOption,
      polar: ()=>this.polarOption,
      angleAxis: ()=>this.angleAxisOption,
      radiusAxis: ()=>this.radiusAxisOption,
      xAxis: ()=>this.echartsXAxisOption,
      yAxis: ()=>this.echartsYAxisOption,
      legend: ()=>this.echartsLegendOption,
      series: ()=>this.echartsSeriesOption,
      dataset: ()=>this.echartsDatasetOption(),
      color: ()=>this.getSerieEchartsColors()
    };
  }

  protected getDefaultPrivateData(): PrivateData {
    return {
      fields: [
        { uid: "f_name", alias: "key", type: "string" },
        { uid: "f_value", alias: "value", type: "number" },
      ],
      rows: [
        { f_name: i18next.t("demo1"), f_value: 1000 },
        { f_name: i18next.t("demo2"), f_value: 735 },
        { f_name: i18next.t("demo3"), f_value: 580 },
        { f_name: i18next.t("demo4"), f_value: 900 },
        { f_name: i18next.t("demo5"), f_value: 600 },
      ],
    };
  }

  checkErrorData() {
    let dataOpt = (this.getOption<OptionFieldValue[]>("axis-category") || []).filter(dim => dim?.uid?.[2]);
    let dataValue = (this.getOption<OptionFieldValue[]>("axis-value") || []).filter(dim => dim?.uid?.[2]);
    if (dataOpt.length === 0 || dataValue.length === 0) {
      if (!dataOpt.length && !dataValue.length) {
        this.addErrorDataStatus("filed-empty");
      } else {
        this.addErrorDataStatus("filed-incomplete");
      }
    } else {
      this.clearErrorDataStatus();
    }
  }


  _datasetSource() {
    const categoryDim = this.axisCategory?.find(dim => dim?.uid?.[2]);
    const valueDims = (this.axisValue || []).filter(dim => dim?.uid?.[2]);

    if (!categoryDim || !valueDims.length) return [];
    let sourceData = this.createView(["axis-category", "axis-value"]);
    sourceData = this.dealDataByAggregate(sourceData, [categoryDim], valueDims);

    return this.getDataAfterSort(sourceData);
  }

  get echartsData() {
    let resultData = []
    let dataOpt = this.getOption<OptionFieldValue[]>("axis-category") || [];
    let dataValue = this.getOption<OptionFieldValue[]>("axis-value") || [];
    let dataMap = new Map();
    if (dataOpt.length === 0 || dataValue.length === 0) {
      let treeMapData = this.datasetSource()
      if (treeMapData?.fields && treeMapData?.rows) {
        let name = treeMapData?.fields?.find(item => { return item.type === "string" })
        let value = treeMapData?.fields?.find(item => { return item.type === "number" })
        treeMapData?.rows?.map?.(item => {
          let obj = {}
          obj["name"] = item[name?.["uid"]];
          obj["value"] = item[value?.["uid"]];
          obj["self_row_data"] = item;
          resultData.push(obj)
        })
      }
    } else {
      let treeMapData = this.datasetSource();
      let index = 0;
      for (let row of treeMapData) {
        if(dataMap.get(row[dataOpt[0]?.uid[2]]) == 0 || dataMap.get(row[dataOpt[0]?.uid[2]])){
          resultData[dataMap.get(row[dataOpt[0]?.uid[2]])]["value"] += this.getMetric(row, dataValue[0]);
        }else{
          dataMap.set(row[dataOpt[0]?.uid[2]],index)
          let dataInfo = {};
          dataInfo["name"] = row[dataOpt[0]?.uid[2]];
          dataInfo["value"] = this.getMetric(row, dataValue[0]);
          dataInfo["self_row_data"] = row;
          resultData.push(dataInfo);
          index++;
        }
      }
    }
    dataMap.clear();
    return resultData;
  }



  get echartsSeriesOption(): SeriesOption | SeriesOption[] {
    let labelFont = this.getOption<OptionFontValue>("label-font");
    let labelShowValue = this.getOption<boolean>("label-value-visible");
    let labelValueType = this.getOption<string>("label-text-type");
    let labelValueDecimalPlaces = this.getOption<number>("label-decimal-places");
    let labelValueCompleteZero = this.getOption<boolean>("label-complete-zero");
    let labelShowName = this.getOption<boolean>("label-name-visible")
    return [
      {
        name: "value",
        type: "bar",
        coordinateSystem: 'polar',
        itemStyle: {
          color: (params) => {
            return this.getSerieEchartsColors()[params.dataIndex]
          },
        },
        label: {
          show: this.getOption("label"),
          color: labelFont.color,
          fontSize: labelFont.size,
          fontWeight: labelFont.bold ? "bold" : "normal",
          fontStyle: labelFont.italic ? "italic" : "normal",
          position: 'middle',
          formatter: (param) => {
            let resultValue: any = 0;
            if (labelValueType === "normal") {
              resultValue = param?.value;
              if (typeof resultValue == "object") {
                resultValue = resultValue["value"];
              }
              resultValue = formatFloat(resultValue, labelValueDecimalPlaces, labelValueCompleteZero);
            } else {
              resultValue = formatFloat(param?.value as number * 100, labelValueDecimalPlaces, labelValueCompleteZero) + '%';
            }
            let resultStr = "";
            if (labelShowName) {
              resultStr = resultStr + `{name| ${param.name}}`;
            }
            if (labelShowValue) {
              if (labelShowName) resultStr += "\n";
              resultStr = resultStr + `{value| ${resultValue}}`;
            }
            return resultStr;
          },
          rich: {
            name: {
              color: new Color(labelFont.color).alpha() == 0 ? "auto" : new Color(labelFont.color).toCssString(),
              fontSize: labelFont.size,
              fontFamily: labelFont.family,
              fontWeight: labelFont.bold ? "bold" : "normal",
              fontStyle: labelFont.italic ? "italic" : "normal",
            },
            value: {
              color: new Color(labelFont.color).alpha() == 0 ? "auto" : new Color(labelFont.color).toCssString(),
              fontSize: labelFont.size,
              fontFamily: labelFont.family,
              fontWeight: labelFont.bold ? "bold" : "normal",
              fontStyle: labelFont.italic ? "italic" : "normal",
            }
          }

        },
        data: this.echartsData,
        selectedMode: "single",
        z: 5
      },
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
              filterValue = params.data['self_row_data']?.[fieldArr[1]];
            } else if (fieldArr.length === 3) {
              fieldUIDs = [uids[0], fieldArr[0], `${fieldArr[1]}.${fieldArr[2]}`];
              filterValue = params.data['self_row_data']?.[fieldArr[1]].map(item => item[fieldArr[2]]);
            }
          }
          this.applyLinkage({ uid: fieldUIDs as OptionFieldUID, value: filterValue });
        }
      }

    })
  }
}
