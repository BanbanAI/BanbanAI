import { PrivateData } from "@common/types/project";
import { DefinedOptions } from "@renderer/b2/types";
import { TheWidget as ColumnPercent, component as B2ColumnPercent } from "@renderer/widgets/echarts/column-percent";
import resource from "./locales/index";
import i18next from "@renderer/widgets/i18next";
import { recursive } from "merge";

export class BarPercent extends ColumnPercent {
  static resource = recursive(true, ColumnPercent.resource, resource);
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
                    visible: false
                  },
                  {
                    name: "x-label-cluster",
                    children: [
                      {
                        name: "x-scale-range",
                        default: "custom",
                        visible: false
                      },
                      {
                        name: "x-scale-min",
                        default: 0,
                        visible: false
                      },
                      {
                        name: "x-scale-max",
                        default: 100,
                        visible: false
                      },
                      {
                        name: "x-scale-interval",
                        default: 20,
                        visible: false
                      },
                    ]
                  },
                  {
                    name: "x-label-cluster",
                    children: [
                      {
                        name: "x-text-type",
                        default: "percent",
                      },
                    ]
                  }
                ]
              },
              {
                name: "y-display-cluster",
                children: [
                  {
                    name: "y-data-type",
                    default: "category",
                    visible: false
                  },
                  {
                    name: "y-label-cluster",
                    children: [
                      {
                        name: "y-scale-range",
                        default: "adaptive",
                        visible: false
                      },
                    ]
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
                        name: "label-x",
                        visible:false
                      }
                    ]
                  }
                ]
              }
            ]
          },
          "ranking-text":{
            visible:false
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

  protected getDefaultPrivateData(): PrivateData {
    return {
      fields: [
        { uid: "f_name", alias: "分类", type: "string" },
        { uid: "f_value1", alias: "值1", type: "number" },
        { uid: "f_value2", alias: "值2", type: "number" },
      ],
      rows: [
        { f_name: '示例1', f_value1: 10, f_value2: 20 },
        { f_name: '示例2', f_value1: 20, f_value2: 35 },
        { f_name: '示例3', f_value1: 30, f_value2: 25 },
        { f_name: '示例4', f_value1: 20, f_value2: 15 },
        { f_name: '示例5', f_value1: 15, f_value2: 10 },
      ],
    };
  }

  get transposed(): boolean {
    return true;
  }
}
