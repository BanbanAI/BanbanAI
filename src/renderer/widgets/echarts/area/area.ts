import { DefinedOptions } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { TheWidget as Line, component as B2Line } from "@renderer/widgets/echarts/line";
import resource from "./locales/index";
import { recursive } from "merge";
import i18next from "@renderer/widgets/i18next";
export class Area extends Line {
  static resource = recursive(true, Line.resource, resource);
  static defineOptions(): DefinedOptions[] {
    return [
      {
        style: {
          "series-color-group": {
            alias: "颜色",
            children: [
              {
                cluster: "array",
                alias: i18next.t("数据颜色"),
                name: "series-color-cluster",
                children: [
                  {
                    name: "area-color",
                    alias: i18next.t("面积颜色"),
                    type: "color(gradient)",
                    default: (widget: Area, paths: string[])=>{
                      const indexes = widget.getArrayClusterIndexes(["series-color-cluster"]);
                      const index = paths[1] as `idx-${string}`;
                      const idx = indexes.indexOf(index);
                      if (idx >= 0) {
                        return widget.defaultColors10[idx % 10] + "33";
                      } else {
                        return "#1890ff33";
                      }
                    },
                  },
                ],
              },
            ],
          },
        },
      },
      ...super.defineOptions(),
    ];
  }
  getSeriesAreaColors(){
    let areaColors = [];
    let series = this.getSeries();
    const indexes = this.getArrayClusterIndexes(["series-color-cluster"]);
    for (let i = 0; i < series.length; i++) {
      let color = this.getOption(["series-color-cluster", indexes[i], "area-color"]);
      if (!color) {
        color = this.defaultColors10[i] ? this.defaultColors10[i] : this.defaultColors10[0];
      }
      areaColors.push(this.toEchartsColor(color as Color));
    }
    return areaColors;
  }

  isAreaChart() {
    return true;
  }
}
