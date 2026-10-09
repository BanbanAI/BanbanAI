import { DefinedOptions } from "@renderer/b2/types";
import { TheWidget as Pie3, component as B2Pie3 } from "@renderer/widgets/echarts/pie3";
import i18next from "@renderer/widgets/i18next";
import resource from "./locales";
import { recursive } from "merge";

//3D环形图
export class Dount3 extends Pie3 {
  static resource:any = recursive(true, Pie3.resource, resource);
  static defineOptions(): DefinedOptions[] {
    return [
      {
        style: {
          "series-shape": {
            children: [
              {
                name: "shape-size",
                alias: i18next.t("shapeSize"),
                default: 75,
                type: "number(unit=%)",
                visible: false
              },
              {
                name: "shape-internal-ratio",
                alias: i18next.t("shapeInternalRatio"),
                type: "number(unit=%)",
                default: 30
              },
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
                    name: "label-style-cluster",
                    alias: i18next.t("labelStyleCluster"),
                    children: [
                      {
                        name: "label-center-distance",
                        default: 50,
                        visible: true
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

  get internalDiameterRatio(): number {
    let internalRatio = this.getOption<number>("shape-internal-ratio");
    internalRatio = Math.max(0, Math.min(internalRatio, 100));
    return internalRatio * 0.01;
  }
}
