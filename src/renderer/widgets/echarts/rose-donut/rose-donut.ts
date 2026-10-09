import { DefinedOptions, OptionFontValue } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { TheWidget as Rose, component as B2Rose } from "@renderer/widgets/echarts/rose";
import { formatFloat } from "@common/utils/math";
import { SeriesOption } from "echarts/dist/echarts";
import resource from "./locales"
import { recursive } from "merge";
import i18next from "@renderer/widgets/i18next";

export class RoseDonut extends Rose {
  static resource = recursive(true, Rose.resource, resource);
  static getLabelDefaultOptions() {
    return [
      {
        name: "label-outside-cluster",
        alias: i18next.t("outside"),
        show: "tab",
        children: super.getLabelDefaultOptions()
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
            show: "tab",
            children: [
              {
                name: "label-value-visible-inside",
                alias: i18next.t("labelValueVisible"),
                type: "boolean",
                default: false,
              },
              {
                name: "label-text-type-inside",
                alias: i18next.t("labelTextType"),
                default: "normal",
                type: "select(radioGroup)",
                disabled: (widget: RoseDonut) => { return !widget.getOption<boolean>("label-value-visible-inside") },
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
                type: "number(unit=" + i18next.t("unitWei") + ")",
                default: 2,
                disabled: (widget: RoseDonut) => { return !widget.getOption<boolean>("label-value-visible-inside") },
              },
              {
                name: "label-complete-zero-inside",
                alias: i18next.t("labelCompleteZero"),
                type: "boolean",
                default: false,
                disabled: (widget: RoseDonut) => { return !widget.getOption<boolean>("label-value-visible-inside") },
              },
              {
                name: "label-value-font-inside",
                alias: i18next.t("font"),
                type: "font",
                default: {
                  family: "sans-serif",
                  size: 14,
                  bold: false,
                  italic: false,
                },
                disabled: (widget: RoseDonut) => { return !widget.getOption<boolean>("label-value-visible-inside") },
              },
              {
                name: "label-value-font-shadow-color",
                alias: i18next.t("fontShadowColor"),
                type: "color",
                default: "#ffffff",
                disabled: (widget: RoseDonut) => { return !widget.getOption<boolean>("label-value-visible-inside") },
              },
              {
                name: "label-value-font-shadow-blur",
                alias: i18next.t("fontShadowBlur"),
                type: "number(unit=px)",
                default: -1,
                disabled: (widget: RoseDonut) => { return !widget.getOption<boolean>("label-value-visible-inside") },
              },
              {
                name: "label-value-font-shadow-offset",
                alias: i18next.t("fontShadowOffset"),
                type: "vector<X,Y>(unit=px)",
                default: [0, 0],
                disabled: (widget: RoseDonut) => { return !widget.getOption<boolean>("label-value-visible-inside") },
              },
            ],
          },
          {
            name: "label-style-cluster",
            alias: i18next.t("labelStyleCluster"),
            show: "tab",
            children: [
              {
                name: "label-name-visible-inside",
                alias: i18next.t("labelNameVisible"),
                type: "boolean",
                default: false,
              },
              {
                name: "label-font-inside",
                alias: i18next.t("font"),
                type: "font",
                default: {
                  family: "sans-serif",
                  color: "#fff",
                  size: 14,
                  bold: false,
                  italic: false,
                },
                disabled: (widget: RoseDonut) => { return !widget.getOption<boolean>("label-name-visible-inside") }
              },
              {
                name: "label-unit-value-inside",
                alias: i18next.t("labelUnitValue"),
                type: "string",
                default: "",
                visible: (widget: RoseDonut) => widget.getOption("label-text-type-inside") === "normal",
              },
              {
                name: "label-unit-font-follow-inside",
                alias: i18next.t("fontFollowValue"),
                type: "boolean",
                default: true,
                visible: (widget: RoseDonut) => widget.getOption("label-text-type-inside") === "percent",
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
                visible: (widget: RoseDonut) => widget.getOption("label-text-type-inside") === "normal",
              },
            ]
          },
        ]
      }
    ]
  }

  static defineOptions(): DefinedOptions[] {
    return [
      {
        style: {
          "series-shape": {
            children: [
              {
                name: "inner-radius",
                alias: i18next.t("inner-radius"),
                default: 15,
                type: "number(unit=px, min=0)",
              },
              {
                name: "shape-size",
                visible: false
              },
            ]
          },
        }
      },
      ...super.defineOptions()
    ]
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

    let labelShow = this.getOption<boolean>("label") && (labelShowName || labelShowValue);

    let pieSize = Math.min(this.contentSize.height, this.contentSize.width) / 2 * 0.75;
    let borderWidth = this.getOption<number>("shape-border-width");
    let borderColors = Array.from(this.getOption<Color[]>("shape-border-color")).map((color) => { return new Color(color).hexa(); });
    let pieStartAngle = this.getOption<number>("angle-start");

    let innerRadiusSize = this.getOption<number>("inner-radius");
    let unitFont = this.getOption<OptionFontValue>("label-unit-font");
    let unit = this.getOption<string>("label-unit-value");

    // 内部文本处理，调整时同步修改donut.ts
    let dataSource = this.datasetSource();
    let sumValue = dataSource.reduce((result, current) => {
      return result + (isNaN(current?.value) ? 0 : current.value);
    }, 0);
    let hightLight = this.getOption<boolean>("highlight");
    let seriesCssColors = this.getSeriesCssColors();
    let hightLightColor = this.toEchartsColor(this.getOption("shape-hight-light-color"));
    let hightLightShadowColor = this.toEchartsColor(this.getOption("shape-shadow-color"));
    let shadowBlur = this.getOption("shape-shadow-blur");
    let shadowOffsetX = this.getOption("shape-shadow-offsetX");
    let shadowOffsetY = this.getOption("shape-shadow-offsetY");
    let dataLength = dataSource.length;
    let ringSpacing = this.getOption<number>("ring-spacing");
    let ringValue = sumValue * ringSpacing * 0.01 / (1 - dataLength * ringSpacing * 0.01) || 0;
    let highlightFollow = this.getOption<boolean>("hight-light-color-follow");
    let innerWidth = this.getOption<number>("shape-inner-width");
    let ringSize = this.getOption<number>("ring-size");
    let ringType = this.getOption<string>("ring-type");
    let minRadius = pieSize - ringSize;

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
    let insideUnitFontFollow = this.getOption<boolean>("label-unit-font-follow-inside"); // 内部文本跟随数值
    let percentFont = insideUnitFontFollow ? insideLabelValueFont : insideUnitFont;
    let insideLabelType = this.getOption<string>("label-type-inside");
    let showLabel = this.getOption<boolean>("label");
    let insideBorderWidth = this.getOption<number>("inside-border-width");
    let insideBorderColor = this.toEchartsColor(this.getOption<Color>("inside-border-color"));

    let labelSpacing = [this.getOption<number>("label-spacing"), 0];

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
        result.push({ name: "ring-spacing", value: ringValue, itemStyle: { color: "transparent" }, label: { show: false }, tooltip: { show: false }, select: { disabled: true } });

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

    let selectValueSerieObj: any = {
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
              resultValue = formatFloat(resultValue, insideLabelValueDecimalPlaces, insideLabelValueCompleteZero);
              result = result + `\n{labelValue|${resultValue}}{percentUnit|%}`;
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
          },
          labelValue: {
            color: new Color(insideLabelValueFont.color).alpha() == 0 ? "auto" : new Color(insideLabelValueFont.color).toCssString(),
            fontSize: insideLabelValueFont.size,
            fontFamily: insideLabelValueFont.family,
            fontWeight: insideLabelValueFont.bold ? "bold" : "normal",
            fontStyle: insideLabelValueFont.italic ? "italic" : "normal",
            padding: labelSpacing,
            textShadowColor: new Color(this.getOption("label-value-font-shadow-color")).hexa(),
            textShadowBlur: this.getOption("label-value-font-shadow-blur"),
            textShadowOffsetX: this.getOption("label-value-font-shadow-offset")[0],
            textShadowOffsetY: this.getOption("label-value-font-shadow-offset")[1],
          },
          labelUnit: {
            color: new Color(insideUnitFont.color).alpha() == 0 ? "auto" : new Color(insideUnitFont.color).toCssString(),
            fontSize: insideUnitFont.size,
            fontFamily: insideUnitFont.family,
            fontWeight: insideUnitFont.bold ? "bold" : "normal",
            fontStyle: insideUnitFont.italic ? "italic" : "normal",
          },
          percentUnit: {
            color: new Color(percentFont.color).alpha() == 0 ? "auto" : new Color(percentFont.color).toCssString(),
            fontSize: percentFont.size,
            fontFamily: percentFont.family,
            fontWeight: percentFont.bold ? "bold" : "normal",
            fontStyle: percentFont.italic ? "italic" : "normal",
          }
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
                resultValue = formatFloat(resultValue["percentValue"], insideLabelValueDecimalPlaces, insideLabelValueCompleteZero);
                result = result + `\n{labelValue|${resultValue}}{percentUnit|%}`;
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
              align: "center",
              padding: labelSpacing,
            },
            labelValue: {
              color: new Color(insideLabelValueFont.color).alpha() == 0 ? "auto" : new Color(insideLabelValueFont.color).toCssString(),
              fontSize: insideLabelValueFont.size,
              fontFamily: insideLabelValueFont.family,
              fontWeight: insideLabelValueFont.bold ? "bold" : "normal",
              fontStyle: insideLabelValueFont.italic ? "italic" : "normal",
              align: "center",
              padding: labelSpacing,
            },
            labelUnit: {
              color: new Color(insideUnitFont.color).alpha() == 0 ? "auto" : new Color(insideUnitFont.color).toCssString(),
              fontSize: insideUnitFont.size,
              fontFamily: insideUnitFont.family,
              fontWeight: insideUnitFont.bold ? "bold" : "normal",
              fontStyle: insideUnitFont.italic ? "italic" : "normal",
              align: "center",
              padding: labelSpacing,
            },
            percentUnit: {
              color: new Color(percentFont.color).alpha() == 0 ? "auto" : new Color(percentFont.color).toCssString(),
              fontSize: percentFont.size,
              fontFamily: percentFont.family,
              fontWeight: percentFont.bold ? "bold" : "normal",
              fontStyle: percentFont.italic ? "italic" : "normal",
            }
          }
        }
      },
      silent: true,
      z: 0,
      ...this.pieSizeOpts,
    }
    return [
      {
        name: "value",
        type: "pie",
        radius: [innerRadiusSize, pieSize],
        roseType: 'radius',
        percentPrecision: labelValueDecimalPlaces,
        startAngle: pieStartAngle,
        label: {
          show: labelShow,
          position: labelPosition,
          margin: 20,
          alignTo: 'edge',
          color: 'auto',
          fontSize: 16,
          formatter: (param) => {
            let resultValue: any = 0;
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
              fontSize: unitFont.size,
              fontWeight: unitFont.bold ? "bold" : "normal",
              fontStyle: unitFont.italic ? "italic" : "normal",
              fontFamily: unitFont.family || "sans-serif",
              color: new Color(unitFont.color).alpha() == 0 ? "auto" : this.toEchartsColor(unitFont.color as Color),
            }
          }
        },
        itemStyle: {
          borderWidth: insideBorderWidth,
          borderColor: insideBorderColor,
        },
        selectedMode: "single",
        emphasis: {
          scale: false
        },
        z: 5,
        ...this.pieSizeOpts,
      },
      selectValueSerieObj,
      // {
      //   name: "borderSerie",
      //   type: "pie",
      //   radius: [pieSize, pieSize + borderWidth],
      //   roseType: 'radius',
      //   label: {
      //     show: false,
      //   },
      //   itemStyle: {
      //     color: (param) => {
      //       return borderColors[param.dataIndex % borderColors.length];
      //     },
      //   },
      //   selectedMode: "single",
      //   emphasis: {
      //     scale: false
      //   },
      //   silent: true,
      //   z: 5,
      //   ...this.pieSizeOpts,
      // }
    ]
  }
}
