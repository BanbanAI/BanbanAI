import { DefinedOptions,OptionFontValue,OptionFieldValue } from "@renderer/b2/types";
import { TheWidget as Column } from "@renderer/widgets/echarts/column";
import { SeriesOption } from "echarts/dist/echarts";
import resource from "./locales/index";
import i18next from "@renderer/widgets/i18next";
import { recursive } from "merge";

export class Bar extends Column {
  static resource = recursive(true, Column.resource, resource);
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
        alias:  i18next.t("seriesShapeShadowBlur"),
        type: "number(unit=px)",
        default: 10,
      },
    ];
  }
  static defineOptions(): DefinedOptions[] {
    return [
      {
        style: {
          "label-group": {
            children: [
              {
                name: "label-default-cluster",
                alias: i18next.t("labelDefaultCluster"),
                children: [
                  {
                    name: "label-text-style-cluster",
                    children: [
                      {
                        name: "label-position",
                        alias: i18next.t("labelPosition"),
                        default: "inside",
                        type: "select(radioGroup)",
                        selectChoices: [
                          {
                            label: i18next.t("labelPositionInside"),
                            value: "inside",
                          },
                          {
                            label: i18next.t("labelPositionTop"),
                            value: "right",
                          },
                          {
                            label: i18next.t("labelPositionTopAlign"),
                            value: "top-align",
                          }
                        ],
                      },
                      {
                        name: "label-x",
                        visible:false
                      },
                      {
                        name: "label-y",
                        visible:true
                      }
                    ]
                  }
                ]
              }
            ]
          },
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
                  {
                    name: "y-label-cluster",
                    alias: i18next.t("xLabelCluster"),
                    children: [
                      {
                        name: "y-label-padding",
                        alias: i18next.t("rankingTextOffset"),
                        type: "number(unit=px)",
                        default: 0,
                        visible: (widget: Bar) => {
                          return  widget.getOption("y-label-position") == "above";
                        },
                      },
                    ]
                  }
                ]
              }
            ]
          },
          "series-shape": {
            children: [
              {
                name: "series-shape-texture-cluster",
                visible: false
              }
            ] 
          }
        }
      },
      ...super.defineOptions(),
    ];
  }

  get transposed(){
    return true;
  }

  get echartsSeriesOption(): SeriesOption | SeriesOption[] {
    let seriesOpt:any = super.echartsSeriesOption;
    let yLabelPadding = this.getOption<number>("y-label-padding");
    let yFontOverflow = this.getOption("y-font-overflow") ? "truncate" : "none";
    let yFontMaxWidth
    if(yFontOverflow === "truncate"){
      yFontMaxWidth = this.getOption("y-font-max-width")
    }
      // 绘制柱形图上方文本
      if(this.getOption("y-label-position") === "above" && this.transposed && this.getOption("y-label") && this.getOption("y-display")){
          let offset = this.getOption<number>('y-label-offset');
          let axisLabelFont = this.getOption<OptionFontValue>("y-font");
          let xDims = this.getOption<OptionFieldValue[]>("axis-x");
          let data = this.datasetSource();
          let xUid = "name";
          let textEncode = {
            x:"value",
            y:"name"
          }
          if(xDims?.length){
            xUid = xDims[0].uid[2];
            textEncode = {
               x:"value",
               y:xUid
            }
          }
          let xLableTextObj = {
            name:"__$customLabelText",
            type: 'custom',
            encode:textEncode,
            renderItem: function (param, api) {
              let categoryIndex = api.value(xUid);
              let start = api.coord([0, categoryIndex])
              let size = api.size([0, categoryIndex]);
              let textArr = [];
              let textObj = {
                type: 'text',
                style: {
                  text:data[param.dataIndex][xUid],
                  fill: axisLabelFont.color || '#fff',
                  x: start[0] + yLabelPadding,
                  y: start[1] - size[1] / 2 -offset,
                  verticalAlign: "center",
                  font:`${axisLabelFont.italic?'italic':'normal'} ${axisLabelFont.bold?'bolder':'normal'} ${axisLabelFont.size}px ${axisLabelFont.family}`,
                  overflow: yFontOverflow,
                  width: yFontMaxWidth
                },

              }
              textArr.push(textObj)
              return {
                type: 'group',
                children: textArr
              };
            }
          }
          seriesOpt.push(xLableTextObj)
        }
    return seriesOpt
  }

}
