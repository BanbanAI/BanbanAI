import { PrivateData, PrivateDataConnectionUID, PrivateDataTableUID, OptionFieldUID } from "@common/types/project";
import { DefinedOptions, OptionFontValue, OptionFieldValue, WidgetMetaData, ChartClickState } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { formatFloat } from "@common/utils/math";
import { TheWidget as Column, component as B2Column } from "@renderer/widgets/echarts/column";
import { Line } from "../line/line";
import { SeriesOption } from "echarts/dist/echarts";
import i18next from "@renderer/widgets/i18next";
import resource from "./locales";
import { recursive } from "merge";
import { merge } from "lodash";

export class Biaxial extends Column {
  static resource = recursive(true, Column.resource, resource);
  static defineOptions(): DefinedOptions[] {
    const UNIT_WEI = i18next.t("unitWei");
    return [
      {
        data: {
          fields: {
            alias: i18next.t("fieldsSetting"),
            fold: "unfold",
            children: [
              {
                name: "axis-y",
                alias: i18next.t("axisY"),
                type: "field(aggs=sum|none|max|min|mean|count|distinct, min=0)",
                default:[
                  {"uid":[PrivateDataConnectionUID, PrivateDataTableUID,"f_value1"], "__opt_type":"field", "summary":"sum"},
                  {"uid":[PrivateDataConnectionUID, PrivateDataTableUID,"f_value2"], "__opt_type":"field", "summary":"sum"},
                ]
              },
              {
                name: "axis-line",
                default: [{"uid":[PrivateDataConnectionUID,PrivateDataTableUID,"f_value3"],"__opt_type":"field","summary":"sum"}],
                visible: true,
              },
              {
                name: "axis-group",
                alias: i18next.t("axisGroup"),
                type: "field(recommend=string, min=0, max=1)",
                visible: false,
              }
            ],
          },
        },
        style: {
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
                          }
                        ],
                      },

                    ]
                  }
                ]
              },
              {
                name: "polyline-cluster",
                alias: i18next.t("polyline"),
                visible: true,
                children: [
                  {
                    name: "polyline-label",
                    alias: i18next.t("polylineLabel"),
                    type: "boolean"
                  },
                  {
                    name: "polyline-label-format-cluster",
                    alias: i18next.t("polylineLabelFormatCluster"),
                    fold: "unfold",
                    children: [
                      {
                        name: "polyline-label-text-type",
                        alias: i18next.t("polylineLabelTextType"),
                        default: "normal",
                        type: "select(radioGroup)",
                        selectChoices: [
                          {
                            label: i18next.t("polylineLabelTextTypeNormal"),
                            value: "normal"
                          },
                          {
                            label: i18next.t("polylineLabelTextTypePercent"),
                            value: "percent"
                          },
                        ],
                      },
                      {
                        name: "polyline-decimal-places",
                        alias: i18next.t("polylineDecimalPlaces"),
                        type: "number(unit=" + UNIT_WEI + ")",
                        default: 0,
                      },
                      {
                        name: "polyline-label-complete-zero",
                        alias: i18next.t("polylineLabelCompleteZero"),
                        type: "boolean",
                        default: false,
                      },
                    ]
                  },
                  {
                    name: "polyline-label-style-cluster",
                    alias: i18next.t("polylineLabelStyleCluster"),
                    fold: "unfold",
                    children: [
                      {
                        name: "polyline-label-position",
                        alias: i18next.t("polylineLabelPosition"),
                        type: "select(radioGroup)",
                        selectChoices: [
                          {
                            label: i18next.t("polylineLabelPositionAbove"),
                            value: "above"
                          },
                          {
                            label: i18next.t("polylineLabelPositionTop"),
                            value: "top"
                          },
                        ],
                        default: "above",
                      },
                      {
                        name: "polyline-label-color-type",
                        alias: i18next.t("polylineLabelColorType"),
                        default: "normal",
                        type: "select(radioGroup)",
                        selectChoices: [
                          {
                            value: "normal",
                            label: i18next.t("polylineLabelColorTypeNormal"),
                          },
                          {
                            value: "follow",
                            label: i18next.t("polylineLabelColorTypeFollow"),
                          }
                        ],
                        visible: false
                      },
                      {
                        name: "polyline-label-font",
                        alias: i18next.t("polylineLabelFont"),
                        type: "font",
                        default: {
                          family: 'sans-serif',
                          color: "#fff",
                          size: 12,
                          bold: false,
                          italic: false,
                          underline: false,
                          "line-through": false
                        },
                      },
                      {
                        name: "polyline-label-unit-value",
                        alias: i18next.t("polylineLabelUnitValue"),
                        type: "string",
                        default: "",
                      },
                      {
                        name: "polyline-label-unit-font",
                        alias: i18next.t("polylineLabelUnitFont"),
                        type: "font",
                        default: {
                          family: "sans-serif",
                          size: 12,
                          bold: false,
                          italic: false,
                          underline: false,
                          deleteline: false,
                        },
                      },
                    ]
                  },
                ]
              },
            ]
          },
          "series-shape": {
            children: [
              {
                name: "series-shape-default-cluster",
                children: [
                  {
                    name: "series-shape-type",
                    alias: i18next.t("seriesShapeTtype"),
                    type: "select(radioGroup)",
                    default: "solid",
                    selectChoices: [
                      {
                        label: i18next.t("seriesShapeTtypeSolid"),
                        value: "solid"
                      },
                      {
                        label: i18next.t("seriesShapeTtypeDashed"),
                        value: "dashed"
                      }
                    ],
                  },
                  {
                    name: "series-shape-smooth",
                    alias: i18next.t("seriesShapeSmooth"),
                    type: "boolean",
                    default: false,
                  },
                  {
                    name: "series-shape-show-dots",
                    alias: i18next.t("seriesShapeShowDots"),
                    type: "boolean",
                    default: true,
                    visible: false
                  },
                  {
                    name: "series-dot-shape-type",
                    alias: i18next.t("seriesDotShapeType"),
                    type: "select",
                    default: "circle",
                    selectChoices: [
                      {
                        label: i18next.t("dotShapeTypeNone"),
                        value: "none",
                      },
                      {
                        label: i18next.t("dotShapeTypeImage"),
                        value: "image",
                      },
                      {
                        label: i18next.t("dotShapeTypeRect"),
                        value: "rect",
                      },
                      {
                        label: i18next.t("dotShapeTypeEmptyRect"),
                        value: "emptyRect",
                      },
                      {
                        label: i18next.t("dotShapeTypeRoundRect"),
                        value: "roundRect",
                      },
                      {
                        label: i18next.t("dotShapeTypeCircle"),
                        value: "circle",
                      },
                      {
                        label: i18next.t("dotShapeTypeEmptyCircle"),
                        value: "emptyCircle",
                      },
                      {
                        label: i18next.t("dotShapeTypeGradientCircle"),
                        value: "gradientCircle",
                      },
                      {
                        label: i18next.t("dotShapeTypeTriangle"),
                        value: "triangle",
                      },
                      {
                        label: i18next.t("dotShapeTypeDiamond"),
                        value: "diamond",
                      },
                    ],
                    visible: (widget: Biaxial) => {
                      return widget.getOption("series-shape-show-dots");
                    },
                  },
                  {
                    name:"series-dot-image-url",
                    alias: i18next.t("imageUrl"),
                    type: "file(format=img)",
                    default: "",
                    visible: (widget: Biaxial) => {
                      return widget.getOption("series-dot-shape-type") == "image";
                    },
                  },
                  {
                    name: "series-dot-size",
                    alias: i18next.t("seriesDotSize"),
                    type: "number(min=0,unit=px)",
                    default: 5,
                    visible: (widget: Biaxial) => {
                      return widget.getOption("series-shape-show-dots");
                    },
                  },
                  {
                    name: "series-shape-size",
                    alias: i18next.t("seriesShapeSize"),
                    type: "number(min=0,unit=px)",
                    default: 2,
                  },
                  {
                    name: "series-shape-shadow-color",
                    alias: i18next.t("seriesShapeShadowColor"),
                    type: "color",
                    default: "transparent",
                  }, {
                    name: "series-shape-shadow-blur",
                    alias: i18next.t("seriesShapeShadowBlur"),
                    type: "number(unit=px)",
                    default: 10,
                  },
                ]
              },
              {
                name: "series-shape-top-cluster",
                visible: false,
                children: []
              }
            ]
          },
          tooltip: {
            children: [
              {
                name: "tooltip-format-cluster",
                children: [
                  {
                    name: "tooltip-left-axis-format-cluster",
                    alias: i18next.t("tooltipLeftAxisFormatCluster"),
                    fold: "unfold",
                    children: []
                  },
                  {
                    name: "tooltip-right-axis-format-cluster",
                    fold: "unfold",
                    visible: true,
                    children: []
                  }
                ]
              }
            ]
          },
          "axis": {
            visible: true,
            children: [
              {
                name: "y-polyline-display-cluster",
                children: [],
                visible: true
              }
            ]
          }
        }
      },
      ...super.defineOptions(),
    ];
  }

  override getMetaData() {
    return merge(super.getMetaData(), {
      axisValue: [
        ...this.axisX,
        ...this.axisY,
        ...this.axisLine,
      ]
    } as WidgetMetaData);
  }

  protected getDefaultPrivateData(): PrivateData {
    return {
      fields: [
        { uid: "f_name", alias: "分类", type: "string" },
        { uid: "f_value1", alias: "值1", type: "number" },
        { uid: "f_value2", alias: "值2", type: "number" },
        { uid: "f_value3", alias: "值3", type: "number" },
      ],
      rows: [
        { f_name: '示例1', f_value1: 1048, f_value2: 650 ,f_value3:250},
        { f_name: '示例2', f_value1: 735, f_value2: 650 ,f_value3:600},
        { f_name: '示例3', f_value1: 580, f_value2: 650 ,f_value3:450},
        { f_name: '示例4', f_value1: 1005, f_value2: 650 ,f_value3:300},
        { f_name: '示例5', f_value1: 700, f_value2: 650 ,f_value3:360},
      ],
    };
  }

  _getSeries() {
    let xDimensions = this.getOption<OptionFieldValue[]>("axis-x") || [];
    let yDimensions = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let lineDimensions = this.getOption<OptionFieldValue[]>("axis-line") || [];
    let series = [];
    if (xDimensions.length > 1 && yDimensions.length > 0) {
      let dataSource = this.createView(["axis-x", "axis-y"]);
      // TODO 多x轴处理
      let typeUid = xDimensions[1].uid[2];
      let types = [];
      dataSource.forEach(item => {
        types.push(item[typeUid]);
      })
      types = Array.from(new Set(types));

      types.forEach(item => {
        series.push({
          name: typeUid,
          alias: item,
        })
      })
    } else {
      for (let i = 0; i < yDimensions.length; i++) {
        series.push({
          name: yDimensions[i].uid[2],
          alias: this.getFieldAlias(yDimensions[i].uid),
        });
      }
      if (lineDimensions?.length) {
        lineDimensions.forEach(dim => {
          series.push({
            name: dim.uid[2],
            alias: i18next.t("line") + this.getFieldAlias(dim.uid),
          });
        })

      }
    }
    return series;
  }

  getSortObjects() {
    let xDimensions: any = this.getOption<OptionFieldValue[]>("axis-x") || [];
    let yDimensions: any = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let lineDimensions: any = this.getOption<OptionFieldValue[]>("axis-line") || [];
    let selectChoices = [];

    for (let dimension of xDimensions.concat(yDimensions).concat(lineDimensions)) {
      selectChoices.push({
        value: dimension.uid[2],
        label: this.getFieldAlias(dimension.uid)
      })
    }

    if (!selectChoices.length) {
      selectChoices = [
        { value: "name", label: "名称(示例数据)" },
        { value: "value", label: "数值(示例数据)" },
        { value: "line_data", label: "折线数值(示例数据)" }
      ];
    }
    return selectChoices;
  }

  checkErrorData() {
    let xDimensions = this.getOption<OptionFieldValue[]>("axis-x") || [];
    let yDimensions = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let lineDims = this.getOption<OptionFieldValue[]>("axis-line") || [];
    if(!xDimensions.length && !yDimensions.length && !lineDims.length) {
      this.addErrorDataStatus("filed-empty");
    } else if(!xDimensions.length || !yDimensions.length) {
      this.addErrorDataStatus("filed-incomplete");
    } else {
      this.clearErrorDataStatus();
    }
  }

  handleImageSrc(relativePath) {
    const projectId = this.getBoard().projectId;
    return relativePath ? `${projectId}/${relativePath}` : "";
  }

  imageSrc(imageOptions) {
    if(typeof imageOptions === "string"){
      return imageOptions;
    }else{
      return imageOptions?.url || this.handleImageSrc(imageOptions?.relativePath);
    }
  }

  get echartsSeriesOption(): SeriesOption | SeriesOption[] {
    let xDimensions = this.getOption<OptionFieldValue[]>("axis-x") || [];
    let yDimensions = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let lineDims = this.getOption<OptionFieldValue[]>("axis-line") || [];
    let seriesOpt: any = super.echartsSeriesOption;
    // 单独控制bar的label显示隐藏

    if(!xDimensions.length || !yDimensions.length){
      seriesOpt.push({
        name: "lineValue",
        type: "line",
        encode: {
          x: "name",
          y: "line_data",
        },
        xAxisIndex: 0,
        yAxisIndex: 1,
        silent: true,
      });

      return seriesOpt;
    }

    let dotShapeType = this.getOption<string>("series-dot-shape-type");
    let dotSize = this.getOption<number>("series-dot-size");
    let shapeSize = this.getOption<number>("series-shape-size");
    let shadowColor = this.toEchartsColor(this.getOption<Color>("series-shape-shadow-color"));
    let shadowBlur = this.getOption<number>("series-shape-shadow-blur");
    let lineShape = this.getOption<string>("series-shape-type");
    let lineSmooth = this.getOption<boolean>("series-shape-smooth");
    let showDot = this.getOption<boolean>("series-shape-show-dots");
    let seriesColor = this.getSeriesColors();
    // 折线图形文本
    let lineLabelPosition = this.getOption<string>("polyline-label-position");
    let lineLableFont = this.getOption<OptionFontValue>("polyline-label-font");
    let isPercent = this.getOption("polyline-label-text-type") === "percent";
    let labelDecimalPlaces = this.getOption<number>("polyline-decimal-places");
    let isComplete = this.getOption<boolean>("polyline-label-complete-zero");
    let colorFollow = this.getOption("polyline-label-color-type") === "follow";
    let unitFont = this.getOption<OptionFontValue>("polyline-label-unit-font");

    if (lineDims.length) {
      lineDims.forEach((dim, index) => {
        let name = this.getFieldAlias(dim.uid);
        let symbol = dotShapeType;
        let symbolSize = dotSize;
        if(symbol == "image"){
          let url = this.imageSrc(this.getOption("series-dot-image-url"));
          url ? symbol = `image://${url}` : symbol = "none";
        }else if (symbol === "gradientCircle") {
          symbolSize = symbolSize / 2;
          symbol = "circle";
          seriesOpt.push({
            name,
            id: `${name}_gradient`,
            type: "line",
            connectNulls: true,
            lineStyle: {
              opacity: 0
            },
            color: seriesColor[yDimensions.length + index][0],
            encode: {
              y: dim.uid[2]
            },
            xAxisIndex: 0,
            yAxisIndex: 1,
            silent: true,
            itemStyle: {
              opacity: showDot ? 0.5 : 0
            },
            symbol: "circle",
            symbolSize: symbolSize * 2,
            showAllSymbol: true
          });
        }
        let lineSeriesObj = {};
        if (lineLabelPosition == "top") {
          lineSeriesObj = {
            labelLayout: (param) => {
              let max = (this.echartsChart as any).getModel().getComponent('yAxis').axis._extent[1];
              if (lineDims.length > 1) {
                max += lineDims.length * param.labelRect.height / 2
              }
              let maxY = (this.echartsChart as any).getModel().getComponent('yAxis').axis.toLocalCoord(max);
              maxY += index * param.labelRect.height;
              return {
                y: maxY,
                verticalAlign: 'bottom',
                align: 'center',
              }
            }
          }
        }else{
          lineSeriesObj = {
            labelLayout: undefined
          }
        }
        lineSeriesObj["type"] = 'line';
        lineSeriesObj["id"] = `${dim.uid[2]}-line${index}`;
        lineSeriesObj["name"] = name;
        lineSeriesObj["symbol"] = symbol;
        lineSeriesObj["symbolSize"] = symbolSize;
        lineSeriesObj["encode"] = {
          x: xDimensions[0].uid[2],
          y: dim.uid[2] === xDimensions[0].uid[2] ? `${dim.uid[2]}_count` : dim.uid[2]
        };
        let unit = this.getOption<string>("polyline-label-unit-value");
        let labelFormtter = (param) => {
          let val = param.value[param.dimensionNames[param.encode.y[0]]];
          if (this.transposed) {
            val = param.value[param.dimensionNames[param.encode.x[0]]];
          }

          if (!isPercent) {
            val = formatFloat(val, labelDecimalPlaces, isComplete);
          } else {
            val = formatFloat(val * 100, labelDecimalPlaces, isComplete);
            unit = unit || "%";
          }
          return `{value|${val}}{unit|${unit}}`;
        }
        lineSeriesObj["label"] = {
          show: this.getOption("polyline-label"),
          color: lineLableFont["color"],
          fontStyle: lineLableFont["italic"] ? "italic" : "normal",
          fontWeight: lineLableFont["bold"] ? "bold" : "normal",
          fontFamily: lineLableFont["family"],
          fontSize: lineLableFont["size"],
          formatter: labelFormtter,
          rich: {
            value: {
              color: colorFollow ? seriesColor[index][0] : this.toEchartsColor(lineLableFont.color as Color),
              fontWeight: lineLableFont.bold ? "bold" : "normal",
              fontStyle: lineLableFont.italic ? "italic" : "normal",
              fontSize: lineLableFont.size,
              fontFamily: lineLableFont.family,
            },
            unit: {
              color: unitFont.color,
              fontWeight: unitFont.bold ? "bold" : "normal",
              fontStyle: unitFont.italic ? "italic" : "normal",
              fontSize: unitFont.size,
              fontFamily: unitFont.family,
            }
          }
        };
        let hightLightColor = this.getOption("highlight") ? this.getSeriesHightColors()[index] : seriesColor[yDimensions.length + index]?.[0];
        lineSeriesObj["emphasisDisabled"] = !this.getOption("highlight");
        lineSeriesObj["select"] = {
          style: {
            fill: hightLightColor
          }
        },
        lineSeriesObj["lineStyle"] = {
          width: shapeSize,
          shadowColor,
          shadowBlur,
          type: lineShape
        };
        lineSeriesObj["itemStyle"] = {
          color: seriesColor[yDimensions.length + index][0],
          shadowColor,
          shadowBlur,
          opacity: showDot ? 1 : 0
        };

        lineSeriesObj["smooth"] = lineSmooth;
        lineSeriesObj["yAxisIndex"] = this.echartsYAxisOption.findIndex(yAxis => yAxis.id === this.getSingleYAxisOption("y-polyline").id);
        lineSeriesObj["xAxisIndex"] = 0;
        lineSeriesObj["silent"] = false;

        seriesOpt.push(lineSeriesObj)
      });
    }
    if(!yDimensions.length){
      seriesOpt = seriesOpt.filter(item=>{
        return item.id !== "demo-bar";
      })
    }
    return seriesOpt;
  }

  initEchartsEvents(): void {
    const state: ChartClickState = {
      lastseriesIndex: -1,
      lastDataIndex: -1,
      lastUnselectIndex: -1,
      lastTopshapeIndex: -1
    };

    let yAliasArr = [];
    let dataIndexArr = []
    let yDims = this.getOption<OptionFieldValue[]>("axis-y") || [];
    yDims.forEach(dim => {
      yAliasArr.push(this.getFieldAlias(dim.uid));
    })
    for (let i = 0; i < this.datasetSource().length; i++) {
      dataIndexArr.push(i)
    }
    this.echartsChart.off("click");
    this.echartsChart.on('click', (params) => {

      if(params.seriesType === 'line'){
        this.selectedIndex.value = params.dataIndex;

        // 折线图逻辑
        if (state.lastTopshapeIndex !== -1) {
          // 清理柱状图的选中
          let topShapeSeriesNames = [];
          yAliasArr.forEach(alias => {
            topShapeSeriesNames.push(`topShape-${alias}`)
          })
          this.echartsChart.dispatchAction({
            type: 'unselect',
            seriesName: topShapeSeriesNames,
            dataIndex: dataIndexArr
          })
          state.lastTopshapeIndex = -1;
        }

        this.processClick(params, state);
      } else {
        // 柱状图逻辑
        const chartOption = this.echartsChart.getOption();
        const currentSeries = chartOption.series[params.seriesIndex];
        if (currentSeries.selectedMap[params.name]) {
          this.selectedIndex.value = params.dataIndex;
        } else {
          this.selectedIndex.value = -1;
          state.lastDataIndex = params.dataIndex;
          state.lastUnselectIndex = params.dataIndex;
          state.lastseriesIndex = params.seriesIndex;
          state.lastTopshapeIndex = params.dataIndex;
        }

        this.processColumnClick(this, params, state, { yAliasArr, dataIndexArr });
      }

    })
  }

}
