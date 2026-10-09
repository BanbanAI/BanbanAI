import { DefinedOptions } from "@renderer/b2/types";
import { TheWidget as Bar, component as B2Bar } from "@renderer/widgets/echarts/bar";
import resource from "./locales/index";
import i18next from "@renderer/widgets/i18next";
import { recursive } from "merge"

export class BarStack extends Bar {
  static resource = recursive(true, Bar.resource, resource);
  static getSeriesShapeBasicOptions() {
    return [
      {
        name: "series-shape-shadow-color",
        alias: i18next.t("seriesShapeShadowColor"),
        type: "color(gradient)",
        default: "#ffffff00",
      },
      {
        name: "series-shape-shadow-blur",
        alias: i18next.t("seriesShapeShadowBlur"),
        type: "number(unit=px)",
        default: 10,
      },
    ];
  }
  static defineOptions(): DefinedOptions[] {
    return [
      {
        style: {
          "series-shape": {
            children: [
              {
                name: "series-shape-default-cluster",
                children: [
                  {
                    name: "bar-shape",
                    alias: i18next.t("barShape"),
                    type: "select",
                    default: "bar",
                    selectChoices: [
                      {
                        value: "bar",
                        label: i18next.t("normal"),
                      },
                      {
                        value: "rect",
                        label: i18next.t("rect"),
                      }
                    ],
                  }

                ],
              },
              {
                name: "series-shape-top-cluster",
                visible: false,
                children: []
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
                        default: "inside",
                        selectChoices: [
                          {
                            label: i18next.t("inside"),
                            value: "inside",
                          },
                          {
                            label: i18next.t("outside"),
                            value: "right",
                          }
                        ],
                      }
                    ]
                  }
                ]
              }
            ]
          },
        }
      },
      ...super.defineOptions(),
    ];
  }
  get stack(): boolean {
    return true;
  }

}
