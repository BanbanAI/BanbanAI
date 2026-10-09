import { TheWidget as PolarHeatmap, component as B2PolarHeatmap } from "@renderer/widgets/echarts/polar-heatmap";
import { DefinedOptions, OptionFontValue } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { CustomSeriesOption, EChartsOption, XAXisComponentOption, YAXisComponentOption } from "echarts/dist/echarts";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { recursive } from "merge";

export class ColorLump extends PolarHeatmap {
  static resource:any = recursive(true, PolarHeatmap.resource, resource);

  static defineOptions(): DefinedOptions[] {
    return [
      {
        style: {
          "series-color": {
            children: [
              {
                name: "inner-radius",
                visible: false
              }
            ]
          },
          "label-group": {
            alias: i18next.t("label"),
            visible: true,
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
                    name: "label-font",
                    alias: i18next.t("labelFont"),
                    type: "font",
                    default: {
                      size: 12,
                      color: "#fff"
                    },
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
              }
            ]
          },
          "axis": {
            children: [
              {
                name: "x-display-cluster",
                alias: i18next.t("xDisplay"),
                children: [
                  {
                    name: "x-display",
                    alias: i18next.t("xDisplay"),
                    type: "boolean",
                    default: true,
                  },
                  {
                    name: "x-label-offset",
                    alias: i18next.t("xLabelOffset"),
                    type: "number(unit=px)",
                    default: 10,
                  },
                  {
                    name: "x-font",
                    alias: i18next.t("xFont"),
                    type: "font",
                    default: {
                      family: 'sans-serif',
                      size: 12,
                      bold: false,
                      italic: false,
                      underline: false,
                      "line-through": false
                    },
                  },
                ],
              },
              {
                name: "y-display-cluster",
                alias: i18next.t("yDisplay"),
                children: [
                  {
                    name: "y-display",
                    alias: i18next.t("yDisplay"),
                    type: "boolean",
                    default: true,
                  },
                  {
                    name: "y-label-offset",
                    alias: i18next.t("yLabelOffset"),
                    type: "number(unit=px)",
                    default: 10,
                  },
                  {
                    name: "y-font",
                    alias: i18next.t("yFont"),
                    type: "font",
                    default: {
                      family: 'sans-serif',
                      size: 12,
                      bold: false,
                      italic: false,
                      underline: false,
                      "line-through": false
                    },
                  },
                ],
              },
              {
                name: "angle-display-cluster",
                visible: false,
                children: []
              },
              {
                name: "radius-display-cluster",
                visible: false,
                children: []
              }
            ]
          }
        }
      },
      ...super.defineOptions(),
    ]
  }

  get echartsOptionFunc(): {[key: string]: Function} {
    return {
      grid: ()=>this.echartsGridOption,
      xAxis: ()=>this.echartsXAxisOption,
      yAxis: ()=>this.echartsYAxisOption,
      visualMap: ()=>this.echartsVisualMapOption,
      series: ()=>this.echartsSeriesOption,
      tooltip: ()=>this.echartsTooltipOption,
      dataset: ()=>this.echartsDatasetOption(),
    };
  }

  get echartsXAxisOption(): XAXisComponentOption | XAXisComponentOption[] {
    let borderColor = new Color(this.getOption<Color>("color-piece-border-color")).hexa();
    let borderSize = this.getOption<number>("color-piece-border-width");
    let display = this.getOption<boolean>("x-display");
    let labelOffset = this.getOption<number>("x-label-offset");
    let font = this.getOption<OptionFontValue>("x-font");

    return {
      show: display,
      type: "category",
      boundaryGap: true,
      axisLabel: {
        margin: labelOffset,
        color: new Color(font.color).hexa(),
        fontSize: font.size,
        fontFamily: font.family,
        fontWeight: font.bold ? "bold" : "normal",
        fontStyle: font.italic ? "italic" : "normal",
      },
      axisLine: {
        show: false,
      },
      axisTick: {
        show: false
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: [borderColor],
          width: borderSize
        }
      },
      gridIndex: 0,
      z: 100
    }
  }

  get echartsYAxisOption(): YAXisComponentOption | YAXisComponentOption[] {
    let borderColor = new Color(this.getOption<Color>("color-piece-border-color")).hexa();
    let borderSize = this.getOption<number>("color-piece-border-width");
    let display = this.getOption<boolean>("y-display");
    let labelOffset = this.getOption<number>("y-label-offset");
    let font = this.getOption<OptionFontValue>("y-font");

    return {
      show: display,
      type: "category",
      axisLabel: {
        margin: labelOffset,
        color: new Color(font.color).hexa(),
        fontSize: font.size,
        fontFamily: font.family,
        fontWeight: font.bold ? "bold" : "normal",
        fontStyle: font.italic ? "italic" : "normal",
      },
      axisLine: {
        show: false,
      },
      axisTick: {
        show: false
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: [borderColor],
          width: borderSize
        }
      },
      gridIndex: 0,
      z: 100
    }
  }

  get echartsSeriesOption(): CustomSeriesOption | any {
    //shape
    let showLabel = this.getOption<boolean>("label");
    let labelFont = this.getOption<OptionFontValue>("label-font");
    let unitFont = this.getOption<OptionFontValue>("label-unit-font");
    let unit = this.getOption<string>("label-unit-value");
    return {
      name: "value",
      type: "heatmap",
      label: {
        show: showLabel,
        formatter: (param) => {
          return `{value|${param.value?.value}}{unit|${unit}}`
        },
        rich: {
          value: {
            color: labelFont.color,
            fontSize: labelFont.size,
            fontFamily: labelFont.family,
            fontWeight: labelFont.bold ? "bold" : "normal",
            fontStyle: labelFont.italic ? "italic" : "normal",
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
      encode: {
        x: "angleName",
        y: "radiusName",
        value: "value"
      },
    }
  }
}
