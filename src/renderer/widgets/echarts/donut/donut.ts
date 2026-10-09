import { DefinedOptions, OptionFontValue } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { Widget } from "@renderer/b2/controllers/widget";
import { formatFloat } from "@common/utils/math";
import { TheWidget as Pie, component as B2Pie } from "@renderer/widgets/echarts/pie";
import i18next from "@renderer/widgets/i18next";
import resource from "./locales";
import { SeriesOption, EChartsOption } from "echarts/dist/echarts";
import { debounce } from "lodash";
import { equals } from "@common/utils/object";
import { watch } from "vue";
import { recursive } from "merge";

export class Donut extends Pie {
  private timer;
  public delayTimer;
  static resource: any = recursive(true, Pie.resource, resource);
  static labelShowType() {
    return "list";
  }
  static getLabelDefaultOptions() {
    return [
      {
        name: "label-outside-cluster",
        alias: i18next.t("outside"),
        show: "tab",
        children: [
          ...super.getLabelDefaultOptions(),
        ]
      },
      {
        name: "label-inside-cluster",
        alias: i18next.t("inside"),
        show: "tab",
        children: [
          {
            name: "label-type-inside",
            alias: i18next.t("labelTypeInside"),
            type: "select(radioGroup)",
            selectChoices: [
              { label: i18next.t("labelType1"), value: "item" },
              { label: i18next.t("labelType2"), value: "max" },
              { label: i18next.t("labelType3"), value: "min" }
            ],
            default: "item",
          },
          {
            name: "label-spacing",
            alias: i18next.t("labelSpacing"),
            type: "number",
            default: 10,
          },
          {
            name: "label-type-cluster",
            alias: i18next.t("labelTypeCluster"),
            fold: "unfold",
            children: [
              {
                name: "label-text-type-inside",
                alias: i18next.t("labelTextType"),
                default: "normal",
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
              },
              {
                name: "label-decimal-places-inside",
                alias: i18next.t("labelDecimalPlaces"),
                type: "number(unit=" + i18next.t("unitWei") + ", min=0)",
                default: 2,
              },
              {
                name: "label-complete-zero-inside",
                alias: i18next.t("labelCompleteZero"),
                type: "boolean",
                default: false,
              },
            ],
          },
          {
            name: "label-style-cluster",
            fold: "unfold",
            alias: i18next.t("labelStyleCluster"),
            children: [
              {
                name: "label-value-visible-inside",
                alias: i18next.t("labelValueVisible"),
                type: "boolean",
                default: false,
              },
              {
                name: "label-value-font-inside",
                alias: i18next.t("valueFont"),
                type: "font",
                default: {
                  family: "sans-serif",
                  size: 14,
                  bold: false,
                  italic: false,
                },
                disabled: (widget: Donut) => { return !widget.getOption<boolean>("label-value-visible-inside") },
              },
              {
                name: "label-name-visible-inside",
                alias: i18next.t("labelNameVisible"),
                type: "boolean",
                default: false,
              },
              {
                name: "label-font-inside",
                alias: i18next.t("nameFont"),
                type: "font",
                default: {
                  family: "sans-serif",
                  color: "#fff",
                  size: 14,
                  bold: false,
                  italic: false,
                },
                disabled: (widget: Donut) => { return !widget.getOption<boolean>("label-name-visible-inside") }
              },
              {
                name: "label-unit-value-inside",
                alias: i18next.t("labelUnitValue"),
                type: "string",
                default: "",
              },
              {
                name: "label-unit-font-inside",
                alias: i18next.t("labelUnitFont"),
                type: "font",
                default: {
                  family: "sans-serif",
                  size: 14,
                  bold: false,
                  italic: false,
                  underline: false,
                  deleteline: false,
                },
              },
              {
                name: "label-unit-newline-inside",
                alias: i18next.t("labelNewlineValue"),
                type: "boolean",
                default: false,
              },
            ]
          },
          {
            name: "label-shadow-inside-cluster",
            fold: "unfold",
            alias: i18next.t("labelShadowCluster"),
            children: this.getLabelShadowOptions()
          }
        ]
      }
    ]
  }

  static getLabelShadowOptions() {
    let opts = [];
    let keys = ["value", "name", "unit"];
    keys.forEach(key => {
      opts.push({
        name: `label-shadow-${key}`,
        alias: i18next.t(`${key}Shadow`),
        visible: (widget: Donut) => {
          return key === "unit" ? !!widget.getOption("label-unit-value-inside") : widget.getOption(`label-${key}-visible-inside`);
        },
        show: "tab",
        children: [
          {
            name: `label-${key}-shadow-color-inside`,
            alias: i18next.t("shadowColor"),
            type: "color",
            default: "#ffffff",
          },
          {
            name: `label-${key}-shadow-blur-inside`,
            alias: i18next.t("shadowBlur"),
            type: "number(unit=px)",
            default: 0,
          },
          {
            name: `label-${key}-shadow-offset-inside`,
            alias: i18next.t("shadowOffset"),
            type: "vector<X, Y>",
            default: [0, 0],
          },
        ]
      })
    })
    return opts;
  }

  static getSeriesShapeDefaultOptions() {
    return [];
  }

  static defineOptions(): DefinedOptions[] {
    let shapeOptions = super.getSeriesShapeDefaultOptions();
    for (let key in shapeOptions) {
      if (shapeOptions[key].name === "shape-size") {
        shapeOptions[key] = {
          name: "shape-size",
          visible: false
        }
      }
    }
    return [
      {
        style: {
          "series-shape": {
            children: [
              {
                name: 'default-series-shape',
                alias: i18next.t("defaultSeriesShape"),
                show: 'tab',
                children: [
                  {
                    name: "ring-ratio",
                    alias: i18next.t("shapeInternalRatio"),
                    type: "number(unit=%)",
                    default: 100,
                  },
                  ...shapeOptions,
                  {
                    name: "ring-size",
                    alias: i18next.t("ringSize"),
                    default: 15,
                    type: "number(unit=px)",
                  },
                  {
                    name: "ring-spacing",
                    alias: i18next.t("ringSpacing"),
                    type: "number(unit=%)",
                    default: 0,
                  },
                  {
                    name: "ring-type",
                    type: "select(radioGroup)",
                    alias: i18next.t("ringType"),
                    default: "butt",
                    selectChoices: [
                      {
                        value: "butt",
                        label: i18next.t("ringTypeButt")
                      },
                      {
                        value: "round",
                        label: i18next.t("ringTypeRound")
                      },
                    ],
                  },
                  {
                    name: "ring-background-size",
                    type: "number(unit=px)",
                    default: 30,
                    alias: i18next.t("ringBackgroundSize")
                  },
                ]
              },
              {
                name: 'decorations',
                alias: i18next.t("decorations"),
                show: 'tab',
                children: [
                  {
                    name: 'decorations-show',
                    alias: i18next.t("decorationsShow"),
                    type: "boolean",
                    default: false,
                  },
                  {
                    name: "decorations-type",
                    alias: i18next.t("decorationsType"),
                    type: "select(radioGroup)",
                    default: "default",
                    disabled: (widget: Donut) => {
                      return !widget.getOption('decorations-show');
                    },
                    selectChoices: [
                      {
                        value: "default",
                        label: i18next.t("decorationsType1")
                      },
                      {
                        value: "image",
                        label: i18next.t("decorationsType2")
                      },
                    ],
                  }, {
                    name: 'decorations-image',
                    alias: i18next.t("decorationsImage"),
                    type: 'file(format=image)',
                    disabled: (widget: Donut) => {
                      return !widget.getOption('decorations-show');
                    },
                    visible: (widget: Widget) => {
                      return widget.getOption("decorations-type") === "image";
                    }
                  },
                  {
                    name: "decorations-inner-radius",
                    alias: i18next.t("decorationsInnerRadius"),
                    type: "number(min=0,max=100,unit=%,showInput)",
                    default: 48,
                    disabled: (widget: Donut) => {
                      return !widget.getOption('decorations-show');
                    },
                    visible: (widget: Widget) => {
                      return widget.getOption("decorations-type") === "default";
                    }
                  },
                  {
                    name: "decorations-outer-radius",
                    alias: i18next.t("decorationsOuterRadius"),
                    type: "number(min=0,max=100,unit=%,showInput)",
                    default: 52,
                    disabled: (widget: Donut) => {
                      return !widget.getOption('decorations-show');
                    },
                    visible: (widget: Widget) => {
                      return widget.getOption("decorations-type") === "default";
                    }
                  },
                  {
                    name: "decorations-image-width",
                    alias: i18next.t("decorationsImageWidth"),
                    type: "number(unit=%)",
                    default: 50,
                    disabled: (widget: Donut) => {
                      return !widget.getOption('decorations-show');
                    },
                    visible: (widget: Widget) => {
                      return widget.getOption("decorations-type") === "image" && (widget.getOption("decorations-image") as any)?.relativePath;
                    }
                  },
                  {
                    name: "decorations-image-height",
                    alias: i18next.t("decorationsImageHeight"),
                    type: "number(unit=%)",
                    default: 50,
                    disabled: (widget: Donut) => {
                      return !widget.getOption('decorations-show');
                    },
                    visible: (widget: Widget) => {
                      return widget.getOption("decorations-type") === "image" && (widget.getOption("decorations-image") as any)?.relativePath;
                    }
                  },
                  {
                    name: "decorations-opacity",
                    alias: i18next.t("decorationsOpacity"),
                    type: "number(min=0,max=100,showInput,unit=%)",
                    default: 100,
                    disabled: (widget: Donut) => {
                      return !widget.getOption('decorations-show');
                    },
                    visible: (widget: Widget) => {
                      return (widget.getOption("decorations-image") as any)?.relativePath || widget.getOption("decorations-type") === "default";
                    }
                  },
                  {
                    name: "decorations-rotation-direction",
                    alias: i18next.t("decorationsRotationDirection"),
                    type: "select(radioGroup)",
                    default: "counterclockwise",
                    selectChoices: [
                      {
                        value: "clockwise",
                        label: i18next.t("clockwise")
                      },
                      {
                        value: "counterclockwise",
                        label: i18next.t("counterclockwise")
                      }
                    ],
                    disabled: (widget: Donut) => {
                      return !widget.getOption('decorations-show');
                    },
                    visible: (widget: Widget) => {
                      return (widget.getOption("decorations-image") as any)?.relativePath || widget.getOption("decorations-type") === "default";
                    }
                  }
                ]
              }
            ]
          },
          highlight: {
            alias: i18next.t("highlight"),
            type: "boolean",
            default: false,
            children: [
              {
                name: "shape-hight-light-color",
                alias: i18next.t("shapeHightLightColor"),
                type: "color(gradient)",
                default: "#fff",
              },
              {
                name: "shape-shadow-color",
                alias: i18next.t("shapeShadowColor"),
                type: "color(gradient)",
                default: "#fff",
              },
              {
                name: "shape-shadow-blur",
                alias: i18next.t("shapeShadowBlur"),
                type: "number(unit=px)",
                default: 0,
              },
              {
                name: "shape-shadow-offsetX",
                alias: i18next.t("shapeShadowOffsetX"),
                type: "number(unit=px)",
                default: 0,
              },
              {
                name: "shape-shadow-offsetY",
                alias: i18next.t("shapeShadowOffsetY"),
                type: "number(unit=px)",
                default: 0,
              },
              {
                name: "shape-inner-width",
                alias: i18next.t("shapeInnerWidth"),
                type: "number(unit=px)",
                default: 20,
              },
              {
                name: "hight-light-color-follow",
                alias: i18next.t("hightLightColorFollow"),
                type: "boolean",
                default: false,
              }
            ],
          },
          "animation-display": {
            visible: false,
            children: [
              {
                name: "animation-display-duration"
              },
              {
                name: "decorations-rotation-speed",
                alias: i18next.t("decorationsRotationSpeed"),
                type: "number<float>(min=0,max=10,showInput,exceedMaxLimit,step=1)",
                default: 5
              },
            ]
          },
          "label-group": {
            children: [
              {
                name: "label-outside-cluster",
                children: [
                  {
                    name: "label-style-cluster",
                    children: [
                      {
                        name: "label-position",
                        type: "select(radioGroup)",
                        default: "outside",
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
                    ]
                  }
                ]
              }
            ]
          },
        }
      },
      ...super.defineOptions()
    ]
  }

  getLegendOtherOption() {
    let legendOtherOption = super.getLegendOtherOption();

    let sourceData = this.datasetSource();
    return {
      ...legendOtherOption,
      data: sourceData,
      selectedMode: false
    }
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

    let pieSize = Math.min(this.contentSize.height, this.contentSize.width) * this.getOption<number>("ring-ratio") / 100 / 2 * 0.75;
    let borderWidth = Number(this.getOption<number>("shape-border-width"));
    let borderColors = Array.from(this.getOption<Color[]>("shape-border-color")).map((color) => { return new Color(color).toEchartsColor(); });
    let insideBorderWidth = this.getOption<number>("inside-border-width");
    let insideBorderColor = this.toEchartsColor(this.getOption<Color>("inside-border-color"));
    let backgroundColor = new Color(this.getOption<Color>("shape-background")).hexa();
    let pieStartAngle = this.getOption<number>("angle-start");

    let ringSize = this.getOption<number>("ring-size");
    let ringType = this.getOption<string>("ring-type");
    let ringBackgroundSize = this.getOption<number>("ring-background-size");
    let minRadius = pieSize - ringSize;

    let seriesCssColors = this.getSeriesCssColors();
    let hightLightColor = this.toEchartsColor(this.getOption("shape-hight-light-color"));
    let hightLightShadowColor = this.toEchartsColor(this.getOption("shape-shadow-color"));
    let shadowBlur = this.getOption("shape-shadow-blur");
    let shadowOffsetX = this.getOption("shape-shadow-offsetX");
    let shadowOffsetY = this.getOption("shape-shadow-offsetY");

    let dataSource = this.datasetSource();
    let sumValue = dataSource.reduce((result, current) => {
      return result + (isNaN(current?.value) ? 0 : current.value);
    }, 0);
    let dataLength = dataSource.length;
    let ringSpacing = this.getOption<number>("ring-spacing");
    let ringValue = sumValue * ringSpacing * 0.01 / (1 - dataLength * ringSpacing * 0.01) || 0;
    let hightLight = this.getOption<boolean>("highlight");
    let highlightFollow = this.getOption<boolean>("hight-light-color-follow");
    let innerWidth = this.getOption<number>("shape-inner-width");

    let decorationsFlag = this.getOption<boolean>("decorations-show");
    let decorationsInnerRadius = this.getOption<number>("decorations-inner-radius")
    let decorationsOuterRadius = this.getOption<number>("decorations-outer-radius")
    let decorationsOpacity = this.getOption<number>("decorations-opacity") * 0.01;
    let decorationsType = this.getOption<'image' | 'default'>("decorations-type");
    let direction = this.getOption<'counterclockwise' | 'clockwise'>("decorations-rotation-direction");

    const getPieData = (type?: string) => {
      return dataSource.reduce((result, current, dataIndex) => {
        let itemOption = {
          name: current.name,
          value: current.value,
          percentValue: current.value / sumValue * 100,
          iconColor: seriesCssColors[dataIndex % seriesCssColors.length],
          itemStyle: {
            borderWidth: insideBorderWidth, borderColor: insideBorderColor,
          }
        }
        if (type === "border") {
          itemOption["itemStyle"] = { color: borderWidth === 0 ? 'transparent' : borderColors[dataIndex % borderColors.length] }
        }
        result.push(itemOption);
        if(dataSource.length !== 1) {
          result.push({ name: "ring-spacing", value: ringValue, itemStyle: { color: "transparent" }, label: { show: false }, tooltip: { show: false }, select: { disabled: true } });
        }
        return result;
      }, []);
    }

    let pieDataMap = { "max": { value: -Infinity, percent: -Infinity, name: "" }, "min": { value: Infinity, percent: Infinity, name: "" } };
    let transparentPieData = () => {
      return dataSource.reduce((result, current, dataIndex) => {
        let itemOption = { name: current.name, value: current.value, percentValue: current.value / sumValue * 100, iconColor: seriesCssColors[dataIndex % seriesCssColors.length], select: {} }
        itemOption["itemStyle"] = { color: "transparent" };
        if (hightLight) {
          let color = highlightFollow ? seriesCssColors[dataIndex % seriesCssColors.length] : hightLightColor;
          let shadowColor = highlightFollow ? seriesCssColors[dataIndex % seriesCssColors.length] : hightLightShadowColor;
          itemOption["select"]["itemStyle"] = {
            color,
            shadowColor,
            shadowBlur,
            shadowOffsetX,
            shadowOffsetY,
            borderColor: color,
          }
        }
        result.push(itemOption);
        if(dataSource.length !== 1) {
          result.push({ name: "ring-spacing", value: ringValue, itemStyle: { color: "transparent" }, label: { show: false }, tooltip: { show: false }, select: { disabled: true } });
        }

        let maxData = {
          value: Math.max(pieDataMap["max"].value, itemOption.value),
          percent: Math.max(pieDataMap["max"].percent, itemOption.percentValue),
          name: pieDataMap["max"].name
        }
        if (itemOption.value == maxData.value) {
          maxData["name"] = itemOption.name;
        }
        let minData = {
          value: Math.min(pieDataMap["min"].value, itemOption.value),
          percent: Math.min(pieDataMap["min"].percent, itemOption.percentValue),
          name: pieDataMap["min"].name
        }
        if (itemOption.value == minData.value) {
          minData["name"] = itemOption.name;
        }
        pieDataMap["max"] = maxData;
        pieDataMap["min"] = minData;
        return result;
      }, []);
    }

    let valueSerieObj = {
      name: "value",
      type: "pie",
      data: getPieData(),
      radius: [minRadius, pieSize],
      startAngle: pieStartAngle,
      percentPrecision: labelValueDecimalPlaces,
      itemStyle: {
        borderRadius: ringType == "round" ? "50%" : 0,
      },
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
            resultValue = param?.data;
            if(resultValue.value) {
              resultValue = formatFloat(resultValue["percentValue"], labelValueDecimalPlaces, labelValueCompleteZero) + '%';
            } else {
              resultValue = "0%"
            }
          }
          let resultStr = "";
          if (labelShowName) {
            resultStr = resultStr + `{name|${param.name}}`;
          }
          if (labelShowValue) {
            if (labelShowName) resultStr += "\n";
            resultStr = resultStr + `{value|${resultValue}}`;
          }
          resultStr += `{unit|${unit}}`
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
      selectedMode: "single",
      emphasis: {
        scale: false
      },
      z: 5,
      ...this.pieSizeOpts,
    }

    let insideLabelNameShow = this.getOption("label-name-visible-inside");
    let insideLabelValueShow = this.getOption("label-value-visible-inside");
    let insideLabelValueType = this.getOption<string>("label-text-type-inside");
    let insideLabelValueDecimalPlaces = this.getOption<number>("label-decimal-places-inside");
    let insideLabelValueCompleteZero = this.getOption<boolean>("label-complete-zero-inside");

    let insideLabelNameFont = this.getOption<OptionFontValue>("label-font-inside");
    let insideLabelValueFont = this.getOption<OptionFontValue>("label-value-font-inside");
    let insideUnitFont = this.getOption<OptionFontValue>("label-unit-font-inside");
    let insideUnitNewline = this.getOption<boolean>("label-unit-newline-inside");
    let insideUnit = this.getOption<string>("label-unit-value-inside").trim();
    let insideLabelType = this.getOption<string>("label-type-inside");
    let showLabel = this.getOption<boolean>("label");

    let insideValueShadowColor = new Color(this.getOption("label-value-shadow-color-inside")).toCssString();
    let insideValueShadowBlur = this.getOption("label-value-shadow-blur-inside");
    let insideValueShadowOffset = this.getOption("label-value-shadow-offset-inside");

    let insideNameShadowColor = new Color(this.getOption("label-name-shadow-color-inside")).toCssString();
    let insideNameShadowBlur = this.getOption("label-name-shadow-blur-inside");
    let insideNameShadowOffset = this.getOption("label-name-shadow-offset-inside");

    let insideUnitShadowColor = new Color(this.getOption("label-unit-shadow-color-inside")).toCssString();
    let insideUnitShadowBlur = this.getOption("label-unit-shadow-blur-inside");
    let insideUnitShadowOffset = this.getOption("label-unit-shadow-offset-inside");

    let labelSpacing = [this.getOption<number>("label-spacing"), 0];

    // 内部文本处理，调整时同步修改rose-donut.ts
    let selectValueSerieObj = {
      name: "selectValue",
      type: "pie",
      data: transparentPieData(),
      radius: [minRadius - innerWidth, pieSize],
      startAngle: pieStartAngle,
      percentPrecision: labelValueDecimalPlaces,
      itemStyle: {
        borderRadius: ringType == "round" ? "50%" : 0,
      },
      animation: false,
      label: {
        show: showLabel && insideLabelType != "item",
        position: 'center',
        formatter: () => {
          let result = "";
          if (insideLabelNameShow) {
            result = result + `{labelName|${pieDataMap[insideLabelType]?.name}}`
          }
          if (insideLabelValueShow) {
            let resultValue: any = 0;
            if (insideLabelValueType === "normal") {
              resultValue = pieDataMap[insideLabelType]?.value;
              resultValue = formatFloat(resultValue, insideLabelValueDecimalPlaces, insideLabelValueCompleteZero);
              result = result + `\n{labelValue|${resultValue}}`;
              if (insideUnit) {
                result = result + `${insideUnitNewline ? '\n' : ''}{labelUnit|${insideUnit}}`;
              }
            } else {
              resultValue = pieDataMap[insideLabelType]?.percent;
              resultValue = formatFloat(resultValue, insideLabelValueDecimalPlaces, insideLabelValueCompleteZero) + '%';
              result = result + `\n{labelValue|${resultValue}}`;
            }
          }
          return result;
        },
        rich: {
          labelName: {
            color: new Color(insideLabelNameFont.color).alpha() == 0 ? "auto" : new Color(insideLabelNameFont.color).toCssString(),
            fontSize: insideLabelNameFont.size,
            fontFamily: insideLabelNameFont.family,
            fontWeight: insideLabelNameFont.bold ? "bold" : "normal",
            fontStyle: insideLabelNameFont.italic ? "italic" : "normal",
            padding: labelSpacing,
            textShadowColor: insideNameShadowColor,
            textShadowBlur: insideNameShadowBlur,
            textShadowOffsetX: insideNameShadowOffset[0],
            textShadowOffsetY: insideNameShadowOffset[1],
            align: "center"
          },
          labelValue: {
            color: new Color(insideLabelValueFont.color).alpha() == 0 ? "auto" : new Color(insideLabelValueFont.color).toCssString(),
            fontSize: insideLabelValueFont.size,
            fontFamily: insideLabelValueFont.family,
            fontWeight: insideLabelValueFont.bold ? "bold" : "normal",
            fontStyle: insideLabelValueFont.italic ? "italic" : "normal",
            padding: labelSpacing,
            textShadowColor: insideValueShadowColor,
            textShadowBlur: insideValueShadowBlur,
            textShadowOffsetX: insideValueShadowOffset[0],
            textShadowOffsetY: insideValueShadowOffset[1],
            align: "center"
          },
          labelUnit: {
            color: new Color(insideUnitFont.color).alpha() == 0 ? "auto" : new Color(insideUnitFont.color).toCssString(),
            fontSize: insideUnitFont.size,
            fontFamily: insideUnitFont.family,
            fontWeight: insideUnitFont.bold ? "bold" : "normal",
            fontStyle: insideUnitFont.italic ? "italic" : "normal",
            textShadowColor: insideUnitShadowColor,
            textShadowBlur: insideUnitShadowBlur,
            textShadowOffsetX: insideUnitShadowOffset[0],
            textShadowOffsetY: insideUnitShadowOffset[1],
            align: "center"
          },

        }
      },
      selectedOffset: 0,
      selectedMode: "single",
      emphasis: {
        scale: false,
        label: {
          show: false,
        },
      },
      select: {
        disabled: insideLabelType !== "item",
        label: {
          show: this.getOption<boolean>("label"),
          formatter: (param) => {
            let result = "";
            if (insideLabelNameShow) {
              result = result + `{labelName|${param.name}}`
            }
            if (insideLabelValueShow) {
              let resultValue: any = 0;
              if (insideLabelValueType === "normal") {
                resultValue = param?.value;
                if (typeof resultValue == "object") {
                  resultValue = resultValue["value"];
                }
                resultValue = formatFloat(resultValue, insideLabelValueDecimalPlaces, insideLabelValueCompleteZero);
                result = result + `\n{labelValue|${resultValue}}`;

                if (insideUnit) {
                  result = result + `${insideUnitNewline ? '\n' : ''}{labelUnit|${insideUnit}}`;
                }
              } else {
                resultValue = param?.data;
                resultValue = formatFloat(resultValue["percentValue"], insideLabelValueDecimalPlaces, insideLabelValueCompleteZero) + '%';
                result = result + `\n{labelValue|${resultValue}}`;
              }
            }
            return result;
          },
          rich: {
            labelName: {
              color: new Color(insideLabelNameFont.color).alpha() == 0 ? "auto" : new Color(insideLabelNameFont.color).toCssString(),
              fontSize: insideLabelNameFont.size,
              fontFamily: insideLabelNameFont.family,
              fontWeight: insideLabelNameFont.bold ? "bold" : "normal",
              fontStyle: insideLabelNameFont.italic ? "italic" : "normal",
              textShadowColor: insideNameShadowColor,
              textShadowBlur: insideNameShadowBlur,
              textShadowOffsetX: insideNameShadowOffset[0],
              textShadowOffsetY: insideNameShadowOffset[1],
              align: "center",
              padding: 0,
            },
            labelValue: {
              color: new Color(insideLabelValueFont.color).alpha() == 0 ? "auto" : new Color(insideLabelValueFont.color).toCssString(),
              fontSize: insideLabelValueFont.size,
              fontFamily: insideLabelValueFont.family,
              fontWeight: insideLabelValueFont.bold ? "bold" : "normal",
              fontStyle: insideLabelValueFont.italic ? "italic" : "normal",
              textShadowColor: insideValueShadowColor,
              textShadowBlur: insideValueShadowBlur,
              textShadowOffsetX: insideValueShadowOffset[0],
              textShadowOffsetY: insideValueShadowOffset[1],
              align: "center",
              padding: labelSpacing,
            },
            labelUnit: {
              color: new Color(insideUnitFont.color).alpha() == 0 ? "auto" : new Color(insideUnitFont.color).toCssString(),
              fontSize: insideUnitFont.size,
              fontFamily: insideUnitFont.family,
              fontWeight: insideUnitFont.bold ? "bold" : "normal",
              fontStyle: insideUnitFont.italic ? "italic" : "normal",
              textShadowColor: insideUnitShadowColor,
              textShadowBlur: insideUnitShadowBlur,
              textShadowOffsetX: insideUnitShadowOffset[0],
              textShadowOffsetY: insideUnitShadowOffset[1],
              align: "center",
              padding: labelSpacing,
            }
          }
        }
      },
      silent: true,
      z: 0,
      ...this.pieSizeOpts,
    }
    let borderSerieObj = {
      name: "borderSerie",
      type: "pie",
      data: getPieData("border"),
      radius: [pieSize, pieSize + borderWidth],
      startAngle: pieStartAngle,
      label: {
        show: false,
      },
      itemStyle: {
        borderRadius: ringType == "round" ? "50%" : 0,
        color: "transparent"
      },
      selectedMode: "single",
      emphasis: {
        scale: false
      },
      silent: true,
      z: 5,
      ...this.pieSizeOpts,
    }
    let backgroundSerieObj = {
      name: "backgroundSerie",
      type: "pie",
      radius: [minRadius - ringBackgroundSize / 2, pieSize + ringBackgroundSize / 2],
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
    }
    if (hightLight) {
      valueSerieObj["selectedOffset"] = 0;
      borderSerieObj["selectedOffset"] = 0;
      selectValueSerieObj["z"] = 6;

    }
    let decorationsSerieObj = {
      name: "decorationsSerie",
      type: "pie",
      data: getPieData(),
      radius: [pieSize * decorationsInnerRadius / 100, pieSize * decorationsOuterRadius / 100],
      startAngle: pieStartAngle,
      percentPrecision: labelValueDecimalPlaces,
      silent: true,
      animation: false,
      label: {
        show: false,
      },
      emphasis: {
        scale: false
      },
      itemStyle: {
        color: '',
        opacity: decorationsOpacity
      },
      z: 0,
      ...this.pieSizeOpts,
    }

    decorationsSerieObj["itemStyle"]["color"] = (decorationsFlag && decorationsType === 'default') ? '' : 'transparent';
    let seriesOpt: any = [valueSerieObj, selectValueSerieObj, borderSerieObj, backgroundSerieObj];
    if (decorationsFlag && decorationsOpacity !== 0) {
      seriesOpt.push(decorationsSerieObj);
    }
    return seriesOpt;
  }

  get echartsGraphicOption() {
    let img = this.getOption<{ relativePath: string }>("decorations-image");
    let type = this.getOption<'image' | 'default'>("decorations-type");
    let pieSize = Math.min(this.contentSize.height, this.contentSize.width) / 2 * 0.75;
    let height = this.getOption<number>("decorations-image-height");
    let width = this.getOption<number>("decorations-image-width");
    let decorationsOpacity = this.getOption<number>("decorations-opacity") * 0.01;
    let decorationsFlag = this.getOption<boolean>("decorations-show");
    let url = ''
    if (img) {
      url = `${this.getBoard().projectId}/${img.relativePath}`
    }

    return {
      elements: [{
        type: "image",
        invisible: !decorationsFlag || decorationsOpacity === 0 || type === 'default',
        style: {
          image: url,
          width: pieSize * width * 0.01,
          height: pieSize * height * 0.01,
          opacity: decorationsOpacity
        },
        left: "center",
        top: "middle"
      }]
    }
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
      color: ()=>this.getSerieEchartsColors(),
      graphic: ()=>this.echartsGraphicOption
    };
  }

  decorationsRotation() {
    const rotationFn = () => {
      let speed = Math.min(this.getOption<number>("decorations-rotation-speed"), 100);
      let type = this.getOption<'image' | 'default'>("decorations-type");
      let decorationsFlag = this.getOption<boolean>("decorations-show");
      let img = this.getOption<{ relativePath: string }>("decorations-image");
      const duration = 12000;
      let direction = this.getOption<'counterclockwise' | 'clockwise'>("decorations-rotation-direction");
      if (speed !== 0 && decorationsFlag) {

        if (type === 'default') {
          let seriesMap = this.echartsChart?.['_chartsMap'] || {};
          let groupSeries;
          for (let key in seriesMap) {
            if (key.includes('decorationsSerie')) {
              groupSeries = seriesMap[key].group
            }
          }
          const box = groupSeries.getBoundingRect();
          if (box) {
            groupSeries.setOrigin([box.width / 2 + box.x, box.height / 2 + box.y])
          }
          groupSeries.attr({ rotation: 0 })
          groupSeries.animateTo({
            rotation: Math.PI * 2 * (direction === 'clockwise' ? -1 : 1)
          }, {
            duration: duration / speed,
            done: () => {
              // group.attr({rotation: 0})
              // rotationFn()
            }
          });
        } else {
          if (img?.relativePath) {
            let graphicMap = this.echartsChart?.['_componentsMap'] || {};
            let groupGraphic;
            for (let key in graphicMap) {
              if (key.includes('graphic')) {
                groupGraphic = graphicMap[key].group
              }
            }
            const box = groupGraphic.getBoundingRect();
            if (box) {
              groupGraphic.setOrigin([box.width / 2 + box.x, box.height / 2 + box.y])
            }
            groupGraphic.attr({ rotation: 0 })
            groupGraphic.animateTo({
              rotation: Math.PI * 2 * (direction === 'clockwise' ? -1 : 1)
            }, {
              duration: duration / speed,
              done: () => {
                // group.attr({rotation: 0})
                // rotationFn()
              }
            });
          }
        }
      }
      const delay = (delay) => {
        return new Promise<void>((resolve) => {
          this.timer = setTimeout(resolve, delay)
        })
      }

      delay(duration / speed).then(() => {
        let interval = this.getOption<number>("animation-display-interval");
        this.delayTimer = setTimeout(() => rotationFn(), interval * 1000);
      })
    }
    rotationFn()
  }

  stopRotation() {
    clearTimeout(this.timer);
    clearTimeout(this.delayTimer);
    this.timer = null;
    this.delayTimer = null;
  }

  initOptionWatch() {
    for (let key in this.echartsOption) {
      this.effectScope.run(() => {
        watch(() => {
          return {
            option: this.echartsOption[key],
            data: this["_dataSource"].value,
          }
        }, debounce((val: any, oldVal) => {
          let newOpt = {};
          newOpt[key] = val.option;
          // 会触发多次，用 lazyUpdate: true 做优化
          if(key === "color") {
            this.echartsChart.setOption(newOpt, {
                notMerge: false,
                lazyUpdate: true
              });
            } else {
              this.echartsChart.setOption(newOpt, {
                notMerge: false,
                replaceMerge: key,
                lazyUpdate: true
              });
            }
          this.updatedOption();
        }, 200))
      })
    }

    // serise和datasetSource都需要处理
    watch(() => this.status.isVisible, (val) => {
      if (val) {
        if (this.lastestData && JSON.stringify(this['_dataSource'].value) !== JSON.stringify(this.lastestData)) {
          this['_dataSource'].value = this.lastestData;
          this.dataChangeTime = Date.now();
          this.lastestData = null;
        }
        if (this['lastestSeries'] && JSON.stringify(this['_series'].value) !== JSON.stringify(this['lastestSeries'])) {
          this['_series'].value = this['lastestSeries'];
          this['lastestSeries'] = null;
        }
      }
    }, { immediate: true });

    watch(() => this.getMetaData(), (val) => {
      let selectFiedlInAxis = false;
      for (const item of val.axisValue) {
        if (item.uid[2] === this.formDataSortFields) {
          selectFiedlInAxis = true;
          break;
        }
      }
      // 选中的排序字段不在axis中时清除选中
      if (!selectFiedlInAxis) {
        this.setOption("fields-data-sort-fields", null);
      }
    })
  }

  updatedOption() {
    this.echartsChart.on('finished', () => {
      if (this.timer) {
        clearTimeout(this.timer);
        clearTimeout(this.delayTimer);
        this.timer = null;
        this.delayTimer = null;
        this.decorationsRotation();
      }
      this.echartsChart.off('finished')
    })
  }

  restartAnimationDisplay() {
    super.restartAnimationDisplay()
    this.updatedOption()
  }
}
