import { DefinedOptions } from "@renderer/b2/types"
import { TheWidget as Biaxial, component as B2Biaxial } from "@renderer/widgets/echarts/biaxial";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";

export class BiaxialReverse extends Biaxial {
  static resource = resource;
  static defineOptions(): DefinedOptions[] {
    return [
      {
        data: {
          fields: {
            alias: i18next.t("fieldsSetting"),
            fold: "unfold",
            children: [
              {
                name: "axis-y",
              },
              {
                name: "axis-line",
              },
            ],
          },
        },
        style: {
          "axis": {
            visible: true,
            children: [
              {
                name: "y-display-cluster",
                alias: i18next.t("yDisplay"),
                children: [
                  {
                    name: "y-display",
                    alias: i18next.t("yDisplay")
                  }
                ],
              },
              {
                name: "y-polyline-display-cluster",
                alias: i18next.t("yPolylineDisplay"),
                children: [
                  {
                    name: "y-polyline-display",
                    alias: i18next.t("yAxisEnable")
                  }
              ],
              }
            ]
          },
          "series-shape": {
            children: [
              {
                name: "series-shape-texture-cluster",
                visible: false,
                children: []
              }
            ]
          }
        }
      },
      ...super.defineOptions(),
    ];
  }

  useInverse(axisType: string ) {
    return axisType === 'y' ? true : false
  }
}
