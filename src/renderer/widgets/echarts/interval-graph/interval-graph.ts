import { DefinedOptions, OptionFieldValue, WidgetMetaData } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { TheWidget as IntervalHistogram, component as B2IntervalHistogram } from "@renderer/widgets/echarts/interval-histogram";
import { CustomSeriesOption } from "echarts/dist/echarts";
import { recursive } from "merge";
import { merge } from "lodash";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
export class IntervalGraph extends IntervalHistogram {
  static resource = recursive(true, IntervalHistogram.resource, resource);

  get transposed() {
    return true;
  }

  static defineOptions(): DefinedOptions[] {
    return [
      {
        style: {
          "axis": {
            children: [
              {
                name: "x-display-cluster",
                children: [
                  {
                    name: "x-data-type",
                    default: "value",
                  },
                ]
              },
              {
                name: "y-display-cluster",
                children: [
                  {
                    name: "y-data-type",
                    default: "category",
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
                    name: "series-shape-number-type",
                    alias: i18next.t("seriesShapeStyle"),
                    type: "select(radioGroup)",
                    default: "all",
                    selectChoices: [
                      {
                        value: "all",
                        label: i18next.t("all"),
                      },
                      {
                        value: "custom",
                        label: i18next.t("custom"),
                      },
                    ],
                  },
                ]
              },
            ]
          },
        }
      },
      ...super.defineOptions(),
    ];
  }

  get echartsSeriesOption(): CustomSeriesOption | any {
    //shape
    const barWidth = this.getOption<number>("shape-bar-width");
    const shapeSize = this.getOption<number[]>("shape-size");
    const shapeRadius = this.getOption("shape-radius");

    const showOtherShape = this.getOption("shape-show-top-and-bottom");
    const barOffsetY = (shapeSize[0] - barWidth) / 5;
    return {
      name: "value",
      type: "custom",
      colorBy: "data",
      renderItem: (params, api) => {
        let values0 = [api.value("startValue"), api.value("xValue")];
        let values1 = [api.value("endValue"), api.value("xValue")];
        let startPoint = api.coord(values0);
        let endPoint = api.coord(values1);

        const startY = startPoint[1] - barWidth / 2;
        return {
          type: 'group',
          children: [
            {
              type:'rect',
              shape: {
                x: params.coordSys.x,
                y: showOtherShape ? startY - barOffsetY : startY,
                width: params.coordSys.width,
                height: showOtherShape ? barWidth + barOffsetY * 2 : barWidth
              },
              style: {
                fill: new Color(this.getOption("shape-background-color")).toEchartsColor(),
              }
            },
            {
              type: 'rect',
              shape: {
                x: Math.min(endPoint[0], startPoint[0]),
                y: startY,
                width: Math.abs(endPoint[0] - startPoint[0]),
                height: barWidth
              },
              style: {
                fill: api.visual('color'),
              },
              emphasis: {
                style: {
                  fill: new Color(this.getOption("shape-emphasis-color")).toEchartsColor(),
                }
              }
            }
          ].concat(showOtherShape ? [
            {
              type: 'group',
              children: [
                {
                  type: 'rect',
                  shape: {
                    x: Math.max(endPoint[0], startPoint[0]) - shapeSize[1] / 2,
                    y: startY - barOffsetY,
                    width: shapeSize[1],
                    height: barWidth + barOffsetY * 2,
                    r: shapeRadius
                  },
                  style: {
                    fill: new Color(this.getOption("shape-top-color")).hexa(),
                    shadowBlur: 5,
                    shadowColor: new Color(this.getOption("shape-top-color")).hexa(),
                  }
                },
                {
                  type: 'rect',
                  shape: {
                    x: Math.min(endPoint[0], startPoint[0]) - shapeSize[1] / 2,
                    y: startY - barOffsetY,
                    width: shapeSize[1],
                    height: barWidth + barOffsetY * 2,
                    r: shapeRadius
                  },
                  style: {
                    fill: new Color(this.getOption("shape-bottom-color")).hexa(),
                    shadowBlur: 5,
                    shadowColor: new Color(this.getOption("shape-bottom-color")).hexa(),
                  }
                }
              ]
            }
          ] : [])
        }
      },
      encode: {
        x: ["startValue", "endValue"],
        y: "xValue",
      },
    }
  }

  initEchartsEvents() {
    super.initEchartsEvents();
  }
}
