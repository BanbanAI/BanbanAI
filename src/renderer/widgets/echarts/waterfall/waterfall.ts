import { PrivateData, PrivateDataConnectionUID, PrivateDataTableUID } from "@common/types/project";
import { DefinedOptions, OptionFontValue, OptionFieldValue, OptionFileValue } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { TheWidget as Column, component as B2Column } from "@renderer/widgets/echarts/column";
import { TooltipComponentOption, SeriesOption } from "echarts/dist/echarts";
import { formatFloat } from "@common/utils/math";
import i18next from "@renderer/widgets/i18next";
import { recursive } from "merge";
import resource from "./locales";
export class Waterfall extends Column {
  public dataLength: number = 0;
  static resource = recursive(true, Column.resource, resource);
  static defineOptions(): DefinedOptions[] {
    return [
      {
        data: {
          fields: {
            alias: i18next.t("fields"),
            fold: "unfold",
            children: [
              {
                name: "axis-x",
                alias: i18next.t("axis-x"),
                type: "field",
                default: [{ "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_name"], "__opt_type": "field", "summary": "" }]
              },
              {
                name: "axis-y",
                alias: i18next.t("axis-y"),
                type: "field(aggs=sum|none|max|min|mean|count|distinct, max=1)",
                default: [{ "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_value"], "__opt_type": "field", "summary": "" }]
              },
              {
                name: "axis-group",
                visible: false
              },
            ],
          },
          sort: {
            visible: false
          }
        },
        style: {
          basic: {
            children: [
              {
                name:"waterfall-select-width",
                alias:i18next.t("waterfall-select-width"),
                type:"select",
                selectChoices:[
                  {
                    label:i18next.t("zore"),
                    value:"0"
                  },
                  {
                    label:i18next.t("one"),
                    value:"1"
                  }
                ],
                default:"0"
              },
              {
                name:"waterfall-width",
                alias:i18next.t("waterfall-width"),
                type:"number(unit=px)",
                default:100,
                visible:((widget:Waterfall)=>{
                  return widget.getOption("waterfall-select-width") === "1"
                })
              }
            ]
          },
          "series-color-group": {
            alias: i18next.t("series-color-group"),
            children: [
              {
                name: "total-color",
                alias: i18next.t("total-color"),
                type: "color(gradient)",
                default: "#8C8C8CFF"
              },
              {
                cluster: "array",
                alias: i18next.t("series-color-cluster"),
                fold: "unfold",
                name: "series-color-cluster",

                children: [
                  {
                    name: "series-color",
                    alias: i18next.t("series-color-cluster"),
                    default: "#1890FF",
                    type: "color(gradient)",
                    visible: false
                  },
                  {
                    name: "series-color2",
                    alias: i18next.t("series-color-cluster"),
                    default: ["#1890FF"],
                    type: "palette(gradient)",
                  },
                  {
                    name: "condition-setting",
                    alias: i18next.t("condition-setting"),
                    type: "boolean",
                    default: false,
                    visible: false
                  },
                  {
                    name: 'single-settings-condition-cluster',
                    alias: i18next.t("single-settings-condition-cluster"),
                    cluster: "array",
                    visible: (element, paths) => element.getOption([...paths, 'condition-setting']),
                    children: [
                      {
                        name: "select-condition",
                        alias: i18next.t("select-condition"),
                        type: "select(condition)",
                        selectChoices: (element) => {
                          const conditions = element.getBoard().getDataConditions() || [];
                          const choices = [];
                          for (const condition of conditions) {
                            choices.push({
                              label: condition.name,
                              value: condition.uid
                            })
                          }
                          return choices;
                        },
                        default: ''
                      },
                      {
                        name: "condition-color",
                        alias: i18next.t("series-color-group"),
                        type: 'color(gradient)',
                        default: '#fff',
                        visible: (element, paths) => !!element.getOption([...paths, 'select-condition']),
                      },

                    ]
                  }
                ],
              },
            ],
          },
          "series-shape": {
            children:[
              {
                name: "series-shape-default-cluster",
                alias: i18next.t("seriesShapeDefault"),
                show: "tab",
                children:[],
                visible:false
              }
            ],
            visible: true
          },
          "label-group": {
            alias: i18next.t("labelGroup"),
            children: [
              {
                name: "ranking-cluster",
                children: [],
                visible:false
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
        { uid: "f_value", alias: "消费", type: "number" },
        { uid: "f_name", alias: "分类", type: "string" },
      ],
      rows: [
        { f_value: 20, f_name: "日用品", },
        { f_value: 70, f_name: "伙食费", },
        { f_value: 45, f_name: "交通费", },
        { f_value: 66, f_name: "水电费", },
        { f_value: 32, f_name: "房租", },
        { f_value: 83, f_name: "商场消费", },
        { f_value: 150, f_name: "应酬交际", },
      ],
    };
  }

  _datasetSource() {
    let yDims = this.getOption<OptionFieldValue[]>("axis-y");
    let xDims = this.getOption<OptionFieldValue[]>("axis-x");

    if (xDims?.length && yDims?.length) {
      let data = super._datasetSource();
      let sum = 0;
      let total = 0;
      data.forEach((item, index) => {
        if (index !== 0) {
          sum += data[index - 1][yDims[0].uid[2]];
          total += item[yDims[0].uid[2]];
          item["transparent"] = sum;
        } else {
          sum = 0;
          total += item[yDims[0].uid[2]];
          item["transparent"] = sum;
        }

      })
      let obj = {};
      obj[xDims[0].uid[2]] = i18next.t("final");
      obj[yDims[0].uid[2]] = total;
      data.push(obj);
      this.dataLength = data.length;
      return data;
    } else {
      let privateData = this.getPrivateData();
      let source = [];
      privateData.rows.forEach(row => {
        source.push({
          value: row["f_value"],
          name: row["f_name"],
          name2: row["name2"]
        })
      });
      let sum = 0;
      let total = 0;
      source.forEach((item, index) => {
        if (index !== 0) {
          sum += source[index - 1].value;
          total += item.value;
          item["transparent"] = sum;
        } else {
          sum = 0;
          total += item.value;
          item["transparent"] = sum;
        }

      })

      source.push({ value: total, name: i18next.t("final"), name2:i18next.t("final") })
      this.dataLength = source.length;

      return source;
    }
  }

  checkErrorData() {
    let yDims = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let xDims = this.getOption<OptionFieldValue[]>("axis-x") || [];
    if (!xDims?.length || !yDims?.length) {
      if(!xDims?.length && !yDims?.length) {
        this.addErrorDataStatus("filed-empty");
      } else {
        this.addErrorDataStatus("filed-incomplete");
      }
    } else {
      this.clearErrorDataStatus();
    }
  }

  get echartsSeriesOption(): SeriesOption | SeriesOption[] {
    let yDims = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let xDims = this.getOption<OptionFieldValue[]>("axis-x") || [];
    let data =this.datasetSource()
    let labelPosition = this.getOption<any>("label-position");
    let barselect = this.getOption("waterfall-select-width")
    let barWidth = this.getOption<number>("waterfall-width")
    let labelFont = this.getOption<OptionFontValue>("label-font");
    let labelShapeSpacing = this.getOption<number>("label-shape-spacing");
    let isPercent = this.getOption("label-text-type") === "percent";
    let labelDecimalPlaces = this.getOption<number>("label-decimal-places");
    let isComplete = this.getOption<boolean>("label-complete-zero");
    let colorIndexes = this.getArrayClusterIndexes("series-color-cluster");
    let hightLightIndexes = this.getArrayClusterIndexes(["series-hight-color-cluster"]);
    let unitFont = this.getOption<OptionFontValue>("label-unit-font");
    let unit = this.getOption<string>("label-unit-value");
    let seriesOpt = [];
    let lastValue = 0;
    if (!xDims?.length || !yDims?.length) {
      //示例数据
      return [
        {
          name: "transparentBar",
          type: 'bar',
          label: {
            show: false,
            position: labelPosition,
            distance: labelShapeSpacing,
          },
          itemStyle: {
            color: "transparent",
          },
          encode: {
            x: "name",
            y: "transparent",
          },
          stack: "A"
        },
        {
          name: "value",
          type: 'bar',
          label: {
            show: this.getOption("label"),
            position: labelPosition,
            distance: labelShapeSpacing,
          },
          itemStyle: {
            color: (params) => {
              if (params.dataIndex === this.dataLength - 1) {
                return "grey"
              }
              return "#1890FFFF"
            }
          },
          encode: {
            x: "name",
            y: "value"
          },
          stack: "A"
        }
      ]
    } else {
      // 透明柱状图配置项对象
      let transparentBarOpt = {
        name: "transparentBar",
        type: 'bar',
        label: {
          show: false,
          position: labelPosition,
          distance: labelShapeSpacing,
        },
        itemStyle: {
          color: "transparent",
        },
        encode: {
          x: xDims[0].uid[2],
          y: "transparent",
        },
        stack: "waterfall"
      }
      seriesOpt.push(transparentBarOpt)

      let name = this.getFieldAlias(yDims[0].uid)
      let xLabel = this.getOption("label-x")

      let singleSeriesOpt = {
        name,
        type: "bar",
        barGap: "30%",
        showBackground: false,
        stack: "waterfall",
        barWidth:barselect === "1" ? barWidth : null,
        select: {
          disabled: !this.getOption("highlight"),
          label: {
            fontSize: this.getOption(["series-hight-color-cluster", hightLightIndexes[0], "highlight-font-size"]),
            color: this.getSeriesHightFontColors()[0],
          },
          itemStyle: {
            color: this.getSeriesHightColors()[0],
            borderWidth: this.getOption(["series-hight-color-cluster", hightLightIndexes[0], "highlight-border-width"]),
            borderColor: this.getSeriesHightBorderColors()[0]
          },
        },
        selectedMode: "single",
        label: {
          show: this.getOption("label"),
          position: labelPosition,
          distance: labelShapeSpacing,
          formatter: (param) => {
            let name = param.value[param.dimensionNames[param.encode.x[0]]];
            let val = param.value[param.dimensionNames[param.encode.y[0]]];

            if (!isPercent) {
              val = formatFloat(val, labelDecimalPlaces, isComplete);
            } else {
              val = formatFloat(val * 100, labelDecimalPlaces, isComplete) + "%";
            }

            return `{value|${xLabel && name ? name + ": " :""}${val}}{unit|${unit}}`
          },
          rich: {
            value: {
              color: this.toEchartsColor(labelFont.color as Color),
              fontWeight: labelFont.bold ? "bold" : "normal",
              fontStyle: labelFont.italic ? "italic" : "normal",
              fontSize: labelFont.size,
              fontFamily: labelFont.family,
            },
            unit: {
              fontSize: unitFont.size,
              fontWeight: unitFont.bold ? "bold" : "normal",
              fontStyle: unitFont.italic ? "italic" : "normal",
              fontFamily: unitFont.family || "sans-serif",
              color: this.toEchartsColor(unitFont.color as Color)
            }
          }
        },
        itemStyle: {
          color: (params) => {
            let color = this.getSeriesColors()[0][params.dataIndex] || this.getSeriesColors()[0][0];
            // let color = "#fff"
            let conditionSetting = this.getOption(['series-color-cluster', colorIndexes[params.seriesIndex], "condition-setting"])
            if (conditionSetting) {
              let path = ['series-color-cluster', colorIndexes[params.seriesIndex]]
              let indexes = this.getOption([...path, "single-settings-condition-cluster"])?.["indexes"] || [];
              for (const clusterIndex of indexes) {
                const selectCondition = this.getOption<string>([...path, 'single-settings-condition-cluster', clusterIndex, "select-condition"]);
                // 没有选择数据条件的 pass 掉
                if (!selectCondition) continue;
                // 先看条数是否满足
                let conditions = this.getBoard().getDataConditions() || [];
                let condition = conditions.find(item => item.uid === selectCondition);
                const isExistence = this.checkDataConditions([condition], params.dataIndex);
                if (!isExistence) continue;
                color = this.toEchartsColor(new Color(this.getOption<Color>([...path, 'single-settings-condition-cluster', clusterIndex, 'condition-color'])));
              }
            }
            if (params.dataIndex === this.dataLength - 1) color = this.toEchartsColor(new Color(this.getOption<Color>("total-color")));
            return color
          },
        },
        encode: {
          x: xDims[0].uid[2],
          y: yDims[0].uid[2],
        }
      }

      seriesOpt.push(singleSeriesOpt);

      seriesOpt.push({
        type: 'bar',
        stack: "waterfall",
        name: i18next.t("final"),
        data: []
      })
      if (this.getOption("top-shape")) {
        let topWidth = this.getOption<number>("top-shape-top-width");
        let bottomWidth = this.getOption<number>("top-shape-bottom-width");
        let height = this.getOption<number>("top-shape-height");
        let distance = this.getOption<number>("top-shape-distance");
        let follow = this.getOption<string>("top-shape-color-select") === 'follow';
        let shapeType = this.getOption<string>("top-shape-type");
        let imageWidth = this.getOption<number>("top-shape-image-width");
        let imageHeight = this.getOption<number>("top-shape-image-height");
        let imageOpacity = this.getOption<number>("top-shape-image-opacity")*0.01;
        let topShapeSeriesOpt = {
          type: 'custom',
          name: 'topShape-' + name,
          selectedMode: 'single',
          renderItem: (params, api) => {
            let categoryIndex = api.value(params.encode.x);
            let yUid = yDims[0].uid[2]
            let yValue = api.value(yUid);
            if(lastValue && params.dataIndex < data.length - 1){
              yValue += lastValue
            }
            lastValue = yValue
            let color = this.getSeriesTopShapeColors()[0];
            if (follow) {
              color = this.getSeriesColors()[0][0]
            }
            let hightLightColor = this.getOption("highlight") ? this.getSeriesHightColors()[0] : color;
            let start = this.transposed ? api.coord([yValue, categoryIndex]) : api.coord([categoryIndex, yValue]);
            let step = 0;
            if (!this.stack) {
              this.transposed ? start[1] += step : start[0] += step;
            }
            if (shapeType == "image") {
              return {
                type: 'image',
                style: {
                  image: this.getTopShapeImageSrc(params.dataIndex),
                  x: start[0] - imageWidth / 2,
                  y: start[1] - imageHeight - distance,
                  width: imageWidth,
                  height: imageHeight,
                  opacity: imageOpacity
                },
                transition:"shape"
              };
            }
              return {
                type: 'polygon',
                shape: {
                  points: [
                    [
                      start[0] - topWidth / 2,
                      start[1] - height - distance
                    ],
                    [
                      start[0] + topWidth / 2,
                      start[1] - height - distance
                    ],
                    [
                      start[0] + bottomWidth / 2,
                      start[1] - distance
                    ],
                    [
                      start[0] - bottomWidth / 2,
                      start[1] - distance
                    ]
                  ],
                },
                style: api.style({
                  borderWidth: 0,
                  fill: color
                }),
                select: {
                  style: {
                    fill: hightLightColor
                  }
                },
                transition:"shape"
              };
            },
            encode:{
              x: xDims[0].uid[2],
              y: yDims[0].uid[2],
            },
            z: 3
          }
          seriesOpt.push(topShapeSeriesOpt);
        }
      return seriesOpt;
    }
  }

  get echartsTooltipOption(): TooltipComponentOption | TooltipComponentOption[] {
    let backgroundColor = new Color(this.getOption<Color>("tooltip-background-color")).toCssString();
    let backgroundImage = this.getOption<OptionFileValue>("tooltip-background-image");
    let backgroundBlur = this.getOption<OptionFileValue>("tooltip-background-blur");
    let paddingWidth = this.getOption<number>("tooltip-padding-width");
    let paddingHeight = this.getOption<number>("tooltip-padding-height");
    let radius = this.getOption<number>("tooltip-radius");
    let showIcon = this.getOption<boolean>("tooltip-icon");
    let commaDisplay = this.getOption<boolean>("tooltip-comma-display")
    let nameFontColor = new Color(this.getOption<Color>("tooltip-name-font-color")).hexa();
    let nameFontSize = this.getOption<number>("tooltip-name-font-size");
    let valueFontColor = new Color(this.getOption<Color>("tooltip-value-font-color")).hexa();
    let valueFontSize = this.getOption<number>("tooltip-value-font-size");
    let showTitle = this.getOption<boolean>("tooltip-title");
    let titleFontColor = new Color(this.getOption<Color>("tooltip-title-font-color")).hexa();
    let titleFontSize = this.getOption<number>("tooltip-title-font-size");

    const projectId = this.getBoard().projectId;
    const seriesCssColors = this.getSeriesColors()[0];
    let showTooltip = this.getOption<boolean>("tooltip");
    let tooltipBackground = backgroundImage?.relativePath ? `url("${projectId}/${backgroundImage.relativePath}")` : backgroundColor;

    let tooltipStyle = this.getOption("tooltip-text-type");
    let tooltipDecimalPlaces = this.getOption<number>("tooltip-decimal-places");
    let tooltipCompleteZero = this.getOption<boolean>("tooltip-complete-zero");
    return {
      trigger: this.tooltipTrigger,
      axisPointer: this.tooltipAxisPointer,
      show: showTooltip,
      borderWidth: 0,
      padding: [paddingHeight, paddingWidth, paddingHeight, paddingWidth],
      extraCssText: `
        background: ${tooltipBackground};
        background-size: 100% 100%;
        background-repeat: no-repeat;
        background-position: center center;
        border-radius: ${radius}px;
        backdrop-filter: blur(${backgroundBlur}px);
        z-index:0;
      `,
      formatter: (params) => {
        let dataHtml = "";
        let noRepeatArr = [];
        let keys = []
        // 去重
        params.forEach(item => {
          if (!keys.includes(item.seriesId)) {
            keys.push(item.seriesId);
            noRepeatArr.push(item);
          }
        })

        for (let param of noRepeatArr || []) {
          if (param.seriesName.startsWith("transparentBar")) continue;
          let iconHtml = showIcon ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${param.name === i18next.t("final") ? this.toEchartsColor(new Color(this.getOption<Color>("total-color"))) : seriesCssColors[param.dataIndex] || seriesCssColors[0]};"></span>` : "";
          let val = param.value[param.dimensionNames[param.encode.y[0]]];

          if (tooltipStyle === "normal") {
            val = formatFloat(val, tooltipDecimalPlaces, tooltipCompleteZero);
          } else if (tooltipStyle === "percent") {
            val = formatFloat(val * 100, tooltipDecimalPlaces, tooltipCompleteZero) + "%";
          }
          if(commaDisplay){
            val = this.doCommaSeparat(val)
          }
          dataHtml += `<div>
            ${iconHtml}
            <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${param.axisValue}：</span>
            <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${val}</span>
          </div>`;
        }
        let titleHtml = showTitle ? `<div>
          <span style="color:${titleFontColor};font-size:${titleFontSize}px;line-height:1;">${params[0]?.seriesName}</span>
        </div>` : "";
        return `
          <div>
            ${titleHtml}
            <div>${dataHtml}</div>
          </div>
        `;
      },
    }
  }

  getLegendOtherOption() {
    let yDims = this.getOption<OptionFieldValue[]>("axis-y") || [];
    if (!yDims[0]?.uid) {
      return { data: [] };
    }
    let data = [
      {
        name: this.getFieldAlias(yDims[0].uid),
        itemStyle: {
          color: this.getSeriesColors()[0][0]
        }
      },
      {
        name: i18next.t("final"),
        itemStyle: {
          color: this.toEchartsColor(new Color(this.getOption<Color>("total-color")))
        }
      }
    ];

    return {
      data: data
    }
  }

}
