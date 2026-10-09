import { PrivateData } from "@common/types/project";
import { DefinedOptions, OptionFontValue, OptionFieldValue, OptionFileValue, ChartClickState } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { TheWidget as Axis } from "@renderer/widgets/echarts/axis";
import i18next from "@renderer/widgets/i18next";
import resource from "./locales";
import { recursive } from "merge";
import { SeriesOption, TooltipComponentOption } from "echarts/dist/echarts";
import { formatFloat } from "@common/utils/math";
import { watch } from "vue";

export class SymbolColumn extends Axis {
  static resource = recursive(true, Axis.resource, resource);

  static defineOptions(): DefinedOptions[] {
    return [
      {
        style: {
          "series-color-group": {
            children: [
              {
                cluster: "array",
                name: "series-color-cluster",
                items: (chart: Axis) => {
                  return chart.getSeries().map((series) => series.alias);
                },
                children: [
                  {
                    name: "series-color",
                    visible: (widget) => widget.getOption("symbol-shape") !== "image"
                  },
                  {
                    name: "symbol-shape-image",
                    alias: i18next.t("symbolShapeImage"),
                    type: "file(format=image)",
                    visible: (widget) => widget.getOption("symbol-shape") === "image"
                  }
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
                    name: "symbol-shape",
                    alias: i18next.t("symbolShape"),
                    type: "select",
                    selectChoices: [
                      {
                        value: "leaf",
                        label: i18next.t("symbolShapeLeaf"),
                      },
                      // {
                      //   value: "circle",
                      //   label: i18next.t("symbolShapeCircle"),
                      // },
                      {
                        value: "rect",
                        label: i18next.t("symbolShapeRect"),
                      },
                      {
                        value: "roundRect",
                        label: i18next.t("symbolShapeRoundRect"),
                      },
                      {
                        value: "diamond",
                        label: i18next.t("symbolShapeDiamond"),
                      },
                      {
                        value: "custom",
                        label: i18next.t("symbolShapeCustom"),
                      },
                      {
                        value: "image",
                        label: i18next.t("symbolShapeImage"),
                      }
                    ],
                    default: "leaf",
                  },
                  {
                    name: "symbol-shape-custom",
                    alias: i18next.t("symbolShapeCustom"),
                    tip: i18next.t("symbolShapeCustomTip"),
                    type: "string",
                    default: "path://M989.429281 241.178346 569.32879 241.178346l0 143.150653 421.839993 0c10.408715 0 20.244333-9.210975 20.244333-20.748698L1011.413117 261.932098C1011.413117 253.974455 1005.627578 241.178346 989.429281 241.178346zM0 261.932098 0 363.580301c0 11.399251 8.816782 20.748698 20.250398 20.748698l434.941349 0L455.191747 241.178346 20.249387 241.178346C7.394655 241.178346 0 250.403471 0 261.932098zM128.70601 1016.922721l326.484726 0L455.190736 451.269022 104.110393 451.269022c-13.258022 0-20.244333 10.507768-20.244333 20.748698 0 10.252048-0.005054 491.267474-0.005054 502.3918C83.861006 1004.098311 108.509182 1016.922721 128.70601 1016.922721zM928.07568 974.40952 928.07568 472.01772c0-11.890476-7.720117-20.753752-20.25343-20.753752L569.32879 451.263968l0 565.653699 316.231667 0C914.897507 1016.922721 928.07568 992.407964 928.07568 974.40952zM545.123323 147.584818c-21.936331 14.382988-57.822037 14.382988-79.759378-0.004043L278.378029 24.881659c-21.931277-14.38602-49.444932-6.952957-61.139322 16.527802l-44.630724 89.638459c-11.693379 23.480758 0.201139 42.696147 26.435184 42.696147l616.719876 0c26.230001 0 37.757617-19.024357 25.615464-42.275674l-47.246548-90.472329c-12.148217-23.247275-40.02271-30.500424-61.959041-16.113394L545.123323 147.584818z",
                    visible: (widget) => widget.getOption("symbol-shape") === "custom"
                  },
                  {
                    name: "symbol-bg-color",
                    alias: i18next.t("symbolBgColor"),
                    type: "color",
                    default: "transparent",
                    visible: (widget) => widget.getOption("symbol-shape") !== "image",
                  }
                ]
              }
            ]
          },
          "label-group": {
            children: [
              {
                name: "label-default-cluster",
                children: [
                  {
                    name: "label-text-style-cluster",
                    children: [
                      {
                        name: "label-position",
                        visible: false
                      },
                      {
                        name: "label-color-type",
                        visible: true,
                      },
                      {
                        name: "label-text-offset",
                        alias: i18next.t("label-text-offset"),
                        type: "vector<X, Y>(unit=px)",
                        default: [0, 0]
                      }
                    ]
                  }
                ]
              }
            ]
          },
          tooltip: {
            children: [
              {
                name: "tooltip-axisPointer",
                alias: i18next.t("tooltip-axisPointer"),
                show: "tab",
                children: [
                  {
                    name: "tooltip-axisPointer-color",
                    alias: i18next.t("tooltip-axisPointer-color"),
                    type: "color",
                    default: "#4047527E",
                  },
                  {
                    name: "tooltip-axisPointer-shadowBlur",
                    alias: i18next.t("tooltip-axisPointer-shadowBlur"),
                    type: "number",
                    default: 0,
                  },
                  {
                    name: "tooltip-axisPointer-shadowColor",
                    alias: i18next.t("tooltip-axisPointer-shadowColor"),
                    type: "color",
                    default: "#ffffff",
                  },
                  {
                    name: "tooltip-axisPointer-shadowOffset",
                    alias: i18next.t("tooltip-axisPointer-shadowOffset"),
                    type: "vector<X, Y>(unit=px)",
                    default: [0, 0],
                  },
                ]
              },
            ]
          },
        }
      },
      ...super.defineOptions()
    ]
  }

  get transposed() {
    return false;
  }

  protected getDefaultPrivateData(): PrivateData {
    return {
      fields: [
        { uid: "f_name", alias: "分类", type: "string" },
        { uid: "f_value1", alias: "值1", type: "number" },
        { uid: "f_value2", alias: "值2", type: "number" },
      ],
      rows: [
        { f_name: '示例1', f_value1: 1048, f_value2: 650 },
        { f_name: '示例2', f_value1: 735, f_value2: 650 },
        { f_name: '示例3', f_value1: 580, f_value2: 650 },
        { f_name: '示例4', f_value1: 1005, f_value2: 650 },
        { f_name: '示例5', f_value1: 700, f_value2: 650 },
      ],
    };
  }

  checkErrorData() {
    let yDims = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let xDims = this.getOption<OptionFieldValue[]>("axis-x") || [];
    if (yDims.length && xDims.length) {
      this.clearErrorDataStatus();
    } else if (yDims.length || xDims.length) {
      this.addErrorDataStatus("filed-incomplete");
    } else {
      this.addErrorDataStatus("filed-empty");
    }
  }

  getSeriesInfo() {
    const seriesInfoList = [];
    const indexes = this.getArrayClusterIndexes(["series-color-cluster"]);
    for (let i = 0; i < indexes.length; i++) {
      const imageOption = this.getOption<OptionFileValue>(["series-color-cluster", indexes[i], "symbol-shape-image"]);
      const color = new Color(this.getOption<Color>(["series-color-cluster", indexes[i], "series-color"]));
      seriesInfoList.push({
        color: color.toEchartsColor(),
        cssColor: color.toCssString(),
        image: imageOption,
      })
    }
    return seriesInfoList;
  }

  getSingleColor(color) {
    if (typeof color === 'string') return color;
    return color?.["colorStops"]?.[0]?.["color"];
  }

  getSeriesCssColors() {
    return this.getSeriesInfo().map((item) => item.cssColor);
  }

  get echartsSeriesOption(): SeriesOption | SeriesOption[] {
    const xDims = this.getOption<OptionFieldValue[]>("axis-x") || [];
    const yDims = this.getOption<OptionFieldValue[]>("axis-y") || [];
    if (xDims.length === 0 || yDims.length === 0) return;
    const data = this.datasetSource();
    const xUid = xDims[0].uid[2];
    const seriesList = [];
    const seriesInfoList = this.getSeriesInfo();

    const labelFont = this.getOption<OptionFontValue>("label-font");
    const labelOffset = this.getOption("label-text-offset");
    const isPercent = this.getOption("label-text-type") === "percent";
    const labelDecimalPlaces = this.getOption<number>("label-decimal-places");
    const isComplete = this.getOption<boolean>("label-complete-zero");
    const colorFollow = this.getOption("label-color-type") === "follow";
    const unitFont = this.getOption<OptionFontValue>("label-unit-font");

    const bgColor = new Color(this.getOption("symbol-bg-color")).toEchartsColor();
    for (let index = 0; index < yDims.length; index++) {
      const yDim = yDims[index];
      const yUid = yDim.uid[2];
      let symbol = undefined;
      const seriesInfo = seriesInfoList[index];
      switch (this.getOption("symbol-shape")) {
        case "leaf":
          symbol = "path://M67.043226 726.78912c50.16576-284.59008 179.1232-390.20544 331.74016-432.5888 191.0016-53.1968 357.72416-15.0528 518.81984-90.86464 97.3312-45.80352 93.31712 36.41344 91.60704 49.62304-24.64768 190.30016-125.36832 371.57376-340.66944 457.6256-234.8288 93.80352-466.5856-79.87712-634.71104 193.34144a6.8096 6.8096 0 0 1-5.7856 3.2512H6.821786a6.79424 6.79424 0 0 1-6.05696-9.856c63.08352-125.28128 154.02496-233.14944 270.12608-319.14496 104.61696-77.40416 229.7856-137.50272 373.376-185.40032 11.6224-3.87584 6.71744-21.2992-5.21728-18.51904-110.1056 25.6512-209.59744 59.1616-301.952 111.80544-96.512 55.00416-185.2928 131.03104-270.0544 240.72704z";
          break;
        case "circle":
          symbol = "circle";
          break;
        case "rect":
          symbol = "rect";
          break;
        case "roundRect":
          symbol = "roundRect";
          break;
        case "diamond":
          symbol = "diamond";
          break;
        case "custom":
          symbol = this.getOption("symbol-shape-custom");
          break;
        case "image":
          const imageOption = seriesInfo.image;
          let imageUrl = "";
          if (imageOption?.relativePath) {
            imageUrl = `${this.getBoard().projectId}/${imageOption.relativePath}`;
          } else if (imageOption?.url) {
            imageUrl = imageOption.url;
          }
          symbol = imageUrl ? `image://${imageUrl}` : undefined;
          break;
      }
      const series: SeriesOption = {
        name: this.getFieldAlias(yDim.uid),
        id: `${yUid}-column-${index}`,
        type: "pictorialBar",
        symbolRepeat: true,
        symbolSize: ["80%", "60%"],
        symbolOffset: this.transposed ? [0, "90%"] : ["70%", 0],
        symbol: symbol,
        color: seriesInfo.color,
        encode: {
          x: this.transposed ? yUid : xUid,
          y: this.transposed ? xUid : yUid,
        },
        label: {
          show: false
        },
        animation: false,
        silent: false,
        selectedMode: 'single',
        z: 15
      }
      seriesList.push(series);
      seriesList.push({
        name: this.getFieldAlias(yDim.uid),
        id: `${yUid}-bg-${index}`,
        type: "pictorialBar",
        barGap: "10%",
        symbolRepeat: "fixed",
        symbolSize: ["80%", "60%"],
        symbolOffset: this.transposed ? [0, "-90%"] : ["-70%", 0],
        symbol: symbol,
        label: {
          show: this.getOption("label"),
          position: this.transposed ? "right" : "top",
          offset: [labelOffset[0], -labelOffset[1]],
          color: colorFollow? this.getSingleColor(seriesInfo.color) : labelFont.color,
          fontWeight: labelFont.bold? "bold" : "normal",
          formatter: (param) => {
            let unit = this.getOption<string>("label-unit-value");
            let val = param.value[param.dimensionNames[param.encode[(this.transposed ? "x" : "y")][0]]];
            if (!isPercent) {
              val = formatFloat(val, labelDecimalPlaces, isComplete);
            } else {
              val = formatFloat(val * 100, labelDecimalPlaces, isComplete) + "%";
            }
            return `{value|${val}}{unit|${unit}}`;
          },
          rich: {
            value: {
              color: colorFollow ? this.getSingleColor(seriesInfo.color) : labelFont.color,
              fontWeight: labelFont.bold ? "bold" : "normal",
              fontStyle: labelFont.italic ? "italic" : "normal",
              fontSize: labelFont.size,
              fontFamily: labelFont.family,
            },
            unit: {
              color: unitFont.color || "#ffffff",
              fontWeight: unitFont.bold ? "bold" : "normal",
              fontStyle: unitFont.italic ? "italic" : "normal",
              fontSize: unitFont.size,
              fontFamily: unitFont.family,
            }
          }
        },
        color: bgColor,
        animation: false,
        silent: true,
        z: 10
      });
    }
    return seriesList;
  }

  get tooltipAxisPointer(): TooltipComponentOption["axisPointer"] {
    let axisPointerColor = this.toEchartsColor(new Color(this.getOption<Color>("tooltip-axisPointer-color")));
    let axisPointerShadowBlur = this.getOption<number>("tooltip-axisPointer-shadowBlur");
    let axisPointerShadowColor = this.toEchartsColor(new Color(this.getOption<Color>("tooltip-axisPointer-shadowColor")));
    let axisPointerShadowOffset = this.getOption("tooltip-axisPointer-shadowOffset");
    return {
      type: "shadow",
      axis: this.transposed ? "y" : "x",
      shadowStyle: {
        color: axisPointerColor,
        shadowBlur: axisPointerShadowBlur,
        shadowColor: axisPointerShadowColor,
        shadowOffsetX: axisPointerShadowOffset?.[0],
        shadowOffsetY: axisPointerShadowOffset?.[1],
        opacity: 0.5
      }
    };
  }

  initEchartsEvents(): void {
    const state: ChartClickState = {
      lastseriesIndex: -1,
      lastDataIndex: -1
    };

    this.echartsChart.off("click");
    this.echartsChart.on('click', (params) => {
      this.selectedIndex.value = params.dataIndex;
      this.processClick(params, state);

    })
  }
}
