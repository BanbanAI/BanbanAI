import { TheWidget as Area, component as B2Area } from "@renderer/widgets/echarts/area";
import { PrivateData, PrivateDataConnectionUID, PrivateDataTableUID } from "@common/types/project";
import { DefinedOptions } from "@renderer/b2/types";
import i18next from "@renderer/widgets/i18next";

export class AreaRainfall extends Area {
  protected getDefaultPrivateData(): PrivateData {
    return {
      fields: [
        { uid: "f_time", alias: "时间", type: "string" },
        { uid: "f_value1", alias: "流量", type: "number" },
        { uid: "f_value2", alias: "降水量", type: "number" }
      ],
      rows: [
        { f_time: '2009/6/12 1:00', f_value1: 0.69, f_value2: 0.1 },
        { f_time: '2009/6/12 2:00', f_value1: 0.5, f_value2: 0.76 },
        { f_time: '2009/6/12 3:00', f_value1: 0.8, f_value2: 1.7 },
        { f_time: '2009/6/12 4:00', f_value1: 1.15, f_value2: 0.1 },
        { f_time: '2009/6/12 5:00', f_value1: 1.66, f_value2: 0.3 },
        { f_time: '2009/6/12 6:00', f_value1: 8.1, f_value2: 1.61 },
        { f_time: '2009/6/12 7:00', f_value1: 14.65, f_value2: 1.68, },
        { f_time: '2009/6/12 8:00', f_value1: 22.3, f_value2: 1.5, },
        { f_time: '2009/6/12 9:00', f_value1: 22.8, f_value2: 1.7, },
        { f_time: '2009/6/12 10:00', f_value1: 30.38, f_value2: 1.5, },
        { f_time: '2009/6/12 11:00', f_value1: 35.74, f_value2: 2.2, },
        { f_time: '2009/6/12 12:00', f_value1: 42.4, f_value2: 0.4, },
        { f_time: '2009/6/12 13:00', f_value1: 58, f_value2: 0.5, },
        { f_time: '2009/6/12 14:00', f_value1: 120.4, f_value2: 3 },
        { f_time: '2009/6/12 15:00', f_value1: 116.8, f_value2: 2.8 },
        { f_time: '2009/6/12 16:00', f_value1: 118, f_value2: 3.2 },
        { f_time: '2009/6/12 18:00', f_value1: 124.8, f_value2: 0.7 },
        { f_time: '2009/6/12 19:00', f_value1: 294, f_value2: 1 },
        { f_time: '2009/6/12 20:00', f_value1: 325, f_value2: 1.8 },
        { f_time: '2009/6/12 21:00', f_value1: 308, f_value2: 0.2, },
        { f_time: '2009/6/12 22:00', f_value1: 300, f_value2: 0.1, },
        { f_time: '2009/6/12 23:00', f_value1: 173, f_value2: 0, }
      ],
    };
  }


  static defineOptions(): DefinedOptions[] {
    return [
      {
        data: {
          fields: {
            children: [
              {
                name: "axis-x",
                default:[{"uid":[PrivateDataConnectionUID,PrivateDataTableUID,"f_time"], "__opt_type":"field", "summary":""}]
              },
              {
                name: "axis-y",
                default:[
                  {"uid":[PrivateDataConnectionUID, PrivateDataTableUID,"f_value1"], "__opt_type":"field", "summary":"sum"},
                ]
              },
              {
                name: "axis-line",
                default:[
                  {"uid":[PrivateDataConnectionUID, PrivateDataTableUID,"f_value2"], "__opt_type":"field", "summary":"sum"},
                ]
              },
            ],
          }
        },
        style: {
          "axis": {
            children: [
              {
                name: "y-polyline-display-cluster",
                children: [
                  {
                    name: "y-polyline-display",
                    default: true
                  },
                  {
                    name: "y-polyline-label-cluster",
                    children:[
                      {
                        name: "y-polyline-decimal-places",
                        default: 2
                      }
                    ]
                  }
              ],
              }
            ]
          },
          "series-shape": {
            children: [
              {
                name: "series-shape-default-cluster",
                children: [
                  {
                    name: "boundaryGap",
                    default: false
                  },
                ]
              }
            ]
          },
          "slider-display": {
            default: true
          },
          tooltip: {
            children: [
              {
                name: "tooltip-format-cluster",
                children:[
                  {
                    name: "tooltip-right-axis-format-cluster",
                    children:[
                          {
                            name: "tooltip-right-decimal-places",
                            default: 2,
                            visible: true,
                          },
                        ]
                      }
                ]
              }
            ]
          },
        },
      },
      ...super.defineOptions(),
    ];
  }

  get echartsDataZoomOption() {
    let dataZoomOpt = super.echartsDataZoomOption;
    dataZoomOpt[0].zoomLock = false
    return dataZoomOpt;
  }


  useInverse(axisType: string ) {
    return axisType === 'y-polyline' ? true : false
  }
}
