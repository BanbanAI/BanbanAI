import { DefinedOptions, OptionFontValue } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { formatFloat } from "@common/utils/math";
import { TheWidget as Pie, component as B2Pie } from "@renderer/widgets/echarts/pie";
import { SeriesOption } from "echarts/dist/echarts";
export class Rose extends Pie {
  static defineOptions(): DefinedOptions[] {
    return [{
      data: {
        sort: {
          children: [
            {
              name: "sort-type",
              default: "DESC",
            }
          ]
        },
      },
      style: {
        "series-shape": {
          after: "label",
          children: [
            {
              name: "shape-background",
              visible: false
            },
            {
              name: "shape-border-width",
              visible: false
            },
            {
              name: "shape-border-color",
              visible: false
            },
            {
              name: "shape-size",
              visible:false
            },
          ]
        },
      }
    }, ...super.defineOptions()]
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

    let labelShow = this.getOption<boolean>("label") && (labelShowName || labelShowValue);

    let pieSize = Math.min(this.contentSize.height, this.contentSize.width) / 2 * 0.75;
    let borderWidth = this.getOption<number>("shape-border-width");
    let borderColors = Array.from(this.getOption<Color[]>("shape-border-color")).map((color) => { return new Color(color).hexa(); });
    let insideBorderWidth = this.getOption<number>("inside-border-width");
    let insideBorderColor = this.toEchartsColor(this.getOption<Color>("inside-border-color"));
    let pieStartAngle = this.getOption<number>("angle-start");
    let unitFont = this.getOption<OptionFontValue>("label-unit-font");
    let unit = this.getOption<string>("label-unit-value");
    return [
      {
        name: "value",
        type: "pie",
        radius: [0, pieSize],
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
              resultStr = resultStr + `{name| ${param.name}}`;
            }
            if (labelShowValue) {
              if (labelShowName) resultStr += "\n";
              resultStr = resultStr + `{value| ${resultValue}}`;
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
              color: this.toEchartsColor(unitFont.color as Color)
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
        ...this.pieSizeOpts,
        z: 5,
      },
      {
        name: "borderSerie",
        type: "pie",
        radius: [pieSize, pieSize + borderWidth],
        roseType: 'radius',
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
      }
    ]
  }
}
