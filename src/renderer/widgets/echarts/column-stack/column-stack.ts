import { DefinedOptions } from "@renderer/b2/types";
import { TheWidget as Column, component as B2Column } from "@renderer/widgets/echarts/column";
import i18next from "@renderer/widgets/i18next";
import resource from "./locales";
import { recursive } from "merge";

export class ColumnStack extends Column {
  static resource:any = recursive(true, Column.resource, resource);
  static getSeriesShapeBasicOptions() {
    return [
      {
        name: "series-shape-shadow-color",
        alias: i18next.t("shapeShadowColor"),
        type: "color(gradient)",
        default: "#ffffff00",
      },
      {
        name: "series-shape-shadow-blur",
        alias: i18next.t("shapeShadowBlur"),
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
                        label: i18next.t("barShapeBar"),
                      },
                      {
                        value: "rect",
                        label: i18next.t("barShapeRect"),
                      }
                    ],
                  }
                ],
              },
            ],
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
                            label: i18next.t("labelPositionInside"),
                            value: "inside",
                          },
                          {
                            label: i18next.t("labelPositionTop"),
                            value: "top",
                          },
                        ],
                      },
                    ]
                  }
                ]
              },
            ]
          }
        }
      },
      ...super.defineOptions(),
    ];
  }
  get stack(): boolean {
    return true;
  }
}
