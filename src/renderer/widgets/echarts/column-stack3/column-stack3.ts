import { OptionFontValue, OptionFieldValue, DefinedOptions } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { formatFloat } from "@common/utils/math";
import { TheWidget as Column3, component as B2Column3 } from "@renderer/widgets/echarts/column3";
import { SeriesOption } from "echarts/dist/echarts";
import i18next from "@renderer/widgets/i18next";
import resource from "./locales";
import { recursive } from "merge";

export class ColumnStack3 extends Column3 {
  static resource = recursive(true, Column3.resource, resource);
  adjustType() {
    return "stack"
  }

  _datasetSource() {
    let yDims = this.getOption<OptionFieldValue[]>("axis-y");
    let xDims = this.getOption<OptionFieldValue[]>("axis-x");
    let groupDims = this.getOption<OptionFieldValue[]>("axis-group");
    if (xDims?.length && yDims?.length) {
      let source = this.createView(["axis-x", "axis-y"]);
      let yDims = this.getOption<OptionFieldValue[]>("axis-y");
      if (groupDims?.length > 0) {// 两个x轴字段
        source = this.createView(["axis-x", "axis-y", "axis-group"]);
        if (yDims[0].summary === "sum") {
          source = this.aggregateYData(source, [xDims[0].uid[2], groupDims[0].uid[2]], [yDims[0].uid[2]]);
        }
        let yUid = yDims[0].uid[2];
        let types = [];
        let xFields = []
        source.forEach(row => {
          xFields.push(row[xDims[0].uid[2]]);
          types.push(row[groupDims[0].uid[2]]);
        })
        types = Array.from(new Set(types));
        xFields = Array.from(new Set(xFields));
        this.xTypes = types;

        if (this.getOption<string>("sort-type").toLowerCase() === "normal") return source;

        // 统计每一个分类的总值用于排序
        let groups = {};
        types.forEach(type => {
          source.forEach(row => {
            if (row[groupDims[0].uid[2]] === type) {
              let xVal = row[xDims[0].uid[2]];
              if (groups[xVal] === undefined) groups[xVal] = 0;
              groups[xVal] += row[yUid];
            }
          })
        });
        let newSource = [];
        source.forEach(row => {
          let xVal = row[xDims[0].uid[2]];
          row["sumVal"] = groups[xVal];
          row["stackSumVal-bg"] = groups[xVal];
          newSource.push(row);
        })
        return newSource;
      } else {
        if (yDims[0].summary === "sum") {
          source = this.aggregateYData(source, [xDims[0].uid[2]], [yDims[0].uid[2]]);
        }
        let uids = [];
        yDims.forEach(dim => {
          uids.push(dim.uid[2]);
        });
        // 计算总和
        let newSource = [];
        source.forEach(row => {
          let sumVal = 0;
          let posSum = 0;
          let negSum = 0;
          uids.forEach(uid => {
            let temp = isNaN(row[uid]) ? 0 : row[uid];
            sumVal += temp;
            posSum += temp > 0 ? temp : 0;
            negSum += temp < 0 ? temp : 0;
          })
          row["sumVal"] = sumVal;
          row["stackSumVal-bg"] = posSum + negSum > 0 ? posSum : negSum;
          newSource.push(row);
        })
        return newSource;
      }
    } else {
      return super._datasetSource();
    }
  }

  checkErrorData() {
    let yDims = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let xDims = this.getOption<OptionFieldValue[]>("axis-x") || [];
    if(xDims.length && yDims.length) {
      this.clearErrorDataStatus();
    } else if (xDims.length || yDims.length) {
      this.addErrorDataStatus("filed-incomplete");
    } else {
      this.addErrorDataStatus("filed-empty");
    }
  }

  static defineOptions(): DefinedOptions[] {
    return [
      {
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
                        name: "label-color-type",
                        visible: true,
                      },
                      {
                        name: "label-offset-x",
                        alias: i18next.t("labelOffsetX"),
                        type: "number(unit=px)",
                        default: 0
                      },
                    ]
                  }
                ]
              }
            ]
          }
        }
      },
      ...super.defineOptions(),
    ]
  }

  get echartsSeriesOption(): SeriesOption | SeriesOption[] {
    let yDims = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let xDims = this.getOption<OptionFieldValue[]>("axis-x") || [];
    let groupDims = this.getOption<OptionFieldValue[]>("axis-group") || [];
    let hasGroup = groupDims.length > 0;
    let shapeColumnWidth = this.getOption<number>("shape-column-width");
    let shapeBorderWidth = this.getOption<number>("shape-border-width");
    let shapeBorderRadius = this.getOption<number>("shape-border-radius");
    let shapeColumnNumber = this.getOption<number>("shape-column-number");
    shapeColumnNumber = shapeColumnNumber < 2 ? 2 : shapeColumnNumber;
    let unselectOpacity = Math.min(Math.max(this.getOption<number>("unselected-opacity") / 100, 0), 1);
    let highlight = this.getOption("highlight");

    let labelPosition = this.getOption<any>("label-position");
    let seriesOpt = [];
    let seriesColor = this.getSeriesColors();
    let labelFont = this.getOption<OptionFontValue>("label-font");
    let highlightFonts = this.getSeriesHightFonts();
    let labelSpace = this.getOption<number>("label-shape-spacing");
    let isPercent = this.getOption("label-text-type") === "percent";
    let labelDecimalPlaces = this.getOption<number>("label-decimal-places");
    let isComplete = this.getOption<boolean>("label-complete-zero");
    let colorFollow = this.getOption("label-color-type") === "follow";
    let barShape = this.getOption<string>("bar-shape");
    let barShapeBurstNumber = this.getOption<number>("bar-shape_burst-number") + "%";
    barShapeBurstNumber = barShape === "rect" ? barShapeBurstNumber + "%" : "100%";
    let showLabel = this.getOption("label");
    let frontBgColor = this.toEchartsColor(this.getOption("column-faces-front-color-bg"));
    let sideBgColor = this.toEchartsColor(this.getOption("column-faces-side-color-bg"));
    let topBgColor = this.toEchartsColor(this.getOption("column-faces-top-color-bg"));
    let shapeSpace = this.getOption<number>("shape-margin-ratio") - 100 + "%";
    let colorIndexes = this.getArrayClusterIndexes("series-color-cluster");
    let unit = this.getOption<string>("label-unit-value");
    let unitFont = this.getOption<OptionFontValue>("label-unit-font");
    const labelOffsetX = this.getOption<number>("label-offset-x");
    if (!xDims?.length || !yDims?.length) {
      let index = 0;
      let shapeType = this.getOption("series-shape-type-column-3d");

      //示例数据
      seriesOpt.push({
        name: "value",
        type: "custom",
        id: "demo-column3D",
        barWidth: shapeColumnWidth,
        label: {
          show: this.getOption("label"),
          position: labelPosition,
        },
        barGap: "30%",
        renderItem: (params, api) => {
          let xValue = api.value(1);
          let yValue = api.value(0);
          const location = api.coord([`${xValue}`, yValue]);
          let isUnselected = this.selectedIndex.value === -1 || this.selectedIndex.value !== params.dataIndex;
          let label = yValue;
          if (!isPercent) {
            label = formatFloat(label as number, labelDecimalPlaces, isComplete);
          } else {
            label = formatFloat(label as number * 100, labelDecimalPlaces, isComplete) + "%";
          }

          let shapeOpt = {
            api,
            xValue: xValue,
            yValue: yValue,
            x: shapeType === "cylinder" ? location[0] - shapeColumnWidth / 2 : location[0],
            y: location[1],
            shapeWidth: shapeColumnWidth,
            xAxisPoint: api.coord([`${xValue}`, 0]),
            shapeSpace,
            offsetX: 0,
            offsetY: 0,
            index
          }
          let textFill;
          if (isUnselected) {
            textFill = colorFollow ? seriesColor[index] : this.toEchartsColor(labelFont.color as Color);
          } else {
            textFill = this.toEchartsColor(highlightFonts[params.seriesIndex].color);
          }
          let styleOpt = {
            textFill: textFill,
            text: showLabel ? label : "",
            textStroke: "rgba(0, 0, 0, 0)",
            fontSize: isUnselected ? labelFont.size : highlightFonts[params.seriesIndex].size,
            fontWeight: labelFont.bold ? "bold" : "normal",
            fontStyle: labelFont.italic ? "italic" : "normal",
            fontFamily: labelFont.family,
            textPosition: "inside",
            textAlign: "center"
          }
          return shapeType === "cylinder" ? {
            type: "group",
            name: "columnGroup",
            children: [{
              type: "Cylinder",
              shape: shapeOpt,
              style: labelPosition === "outside" ? {
                fill: "#1890FFFF",
              } : {
                fill: "#1890FFFF",
                ...styleOpt
              }
            }, {
              type: "circle",
              shape: {
                cx: location[0],
                cy: location[1] + 2,
                r: shapeColumnWidth / 2,
              },
              originY: location[1],
              scaleY: 0.5,
              style: labelPosition === "outside" ? {
                fill: "#1890FFFF",
                ...styleOpt,
                textPosition: ['50%', 15 - labelSpace],
              } : {
                fill: "#1890FFFF",
              }
            },]
          } : {
            type: 'group',
            name: "columnGroup",
            children: [{
              type: 'CubeFront',
              shape: shapeOpt,
              style: labelPosition === "outside" ? {
                fill: "#1890FFFF",
              } : {
                fill: "#1890FFFF",
                ...styleOpt
              }
            }, {
              type: 'CubeSide',
              shape: shapeOpt,
              style: {
                fill: "#1890FFFF"
              }
            }, {
              type: 'CubeTop',
              shape: shapeOpt,
              style: labelPosition === "outside" ? {
                fill: "#1890FFFF",
                ...styleOpt,
                textPosition: ['50%', 15 - labelSpace],
              } : {
                fill: "#1890FFFF",
              },
            }, {
              type: 'CubeFront',
              shape: {
                ...shapeOpt,
                background: true
              },
              style: {
                fill: frontBgColor,
              }
            }, {
              type: 'CubeSide',
              shape: {
                ...shapeOpt,
                background: true
              },
              style: {
                fill: sideBgColor
              }
            }, {
              type: 'CubeTop',
              shape: {
                ...shapeOpt,
                background: true
              },
              style: {
                fill: topBgColor
              }
            },
            ]
          }
        },
        itemStyle: {
          color: (params) => {
            return this.getSeriesColors()[params.seriesIndex];
          },
          borderWidth: shapeBorderWidth,
          borderColor: this.toEchartsColor(this.getOption("shape-border-color")),
          borderRadius: shapeBorderRadius <= 0 ? 0 : shapeBorderRadius
        },
        encode: {
          x: this.transposed ? "value" : "name2",
          y: this.transposed ? "name2" : "value"
        },
      })
    } else {
      let columnNum = hasGroup ? this.xTypes.length : yDims.length;
      for (let index = 0; index < columnNum; index++) {
        if (index >= shapeColumnNumber) continue;
        let name = hasGroup ? this.getFieldAlias(yDims[0].uid) : this.getFieldAlias(yDims[index].uid);
        let encode = hasGroup ? {
          x: this.transposed ? yDims[0].uid[2] : xDims[0].uid[2],
          y: this.transposed ? xDims[0].uid[2] : yDims[0].uid[2]
        } : {
          x: this.transposed ? yDims[index].uid[2] : xDims[0].uid[2],
          y: this.transposed ? xDims[0].uid[2] : yDims[index].uid[2]
        }
        if (hasGroup) {
          name = this.xTypes[index];
        }
        let shapeType = this.getOption("series-shape-type-column-3d");

        seriesOpt.push({
          name,
          type: "custom",
          id: `${hasGroup ? yDims[0].uid[2] + index : yDims[index].uid[2]}-column3D`,
          barGap: "30%",
          barWidth: shapeColumnWidth,
          showBackground: true,
          renderItem: (params, api) => {
            let isUnselected = this.selectedIndex.value === -1 || this.selectedIndex.value !== params.dataIndex;

            let frontColor = seriesColor[index]["front"][params.dataIndex] || seriesColor[index]["front"][seriesColor[index]["front"].length - 1]
            let sideColor = seriesColor[index]["side"][params.dataIndex] || seriesColor[index]["side"][seriesColor[index]["side"].length - 1]
            let topColor = seriesColor[index]["top"][params.dataIndex] || seriesColor[index]["top"][seriesColor[index]["top"].length - 1]

            if (!isUnselected && highlight && this.selectedIndex.value !== -1) {
              frontColor = this.getSeriesHightColors()?.[index]?.front || frontColor;
              sideColor = this.getSeriesHightColors()?.[index]?.front || frontColor;
              sideColor = this.getSeriesHightColors()?.[index]?.front || frontColor;
            }

            let xValue = api.value(params.encode.x);
            let yValue = hasGroup ? api.value(1) : api.value(params.encode.y);
            const location = api.coord([xValue, yValue]);
            let label = yValue;
            if (!isPercent) {
              label = formatFloat(label, labelDecimalPlaces, isComplete);
            } else {
              label = formatFloat(label * 100, labelDecimalPlaces, isComplete) + "%";
            }
            let offsetX = 0;
            let xAxisPoint = api.coord([xValue, 0]);
            const currentDatasetSource = this._datasetSource()[params.dataIndex];
            const axisY = this.getOption<any>("axis-y");
            let lastHeight = 0;
            let lastHeight_N = 0;
            let finalLastHeight = 0;
            const currData = currentDatasetSource[axisY[params.seriesIndex].uid[2]];
            for(let i = 0; i < index; i++){
              const fUid = axisY[i].uid[2];
              if(currentDatasetSource[fUid] > 0){ //处理正负值分开算
                lastHeight += api.size([xValue, currentDatasetSource[fUid]])[1];
              }
              else{
                lastHeight_N += api.size([xValue, currentDatasetSource[fUid]])[1];
              }
            } 
            if(currData > 0){
              finalLastHeight = lastHeight;
            }else{
              finalLastHeight = lastHeight_N;
            }

            let yRange = (this.echartsChart as any).getModel().getComponent('yAxis').axis.scale._extent;
            let yMin = api.coord([0, yRange[1]])[1];

            let shapeOpt = {
              api,
              xValue: xValue,
              yValue: yValue,
              x: shapeType === "cylinder" ? location[0] - shapeColumnWidth / 2 : location[0] + shapeColumnWidth / 2,
              y: location[1],
              shapeWidth: shapeColumnWidth,
              xAxisPoint,
              shapeSpace,
              offsetX,
              lastHeight: finalLastHeight,
              index,
              adjustType: this.adjustType()
            }
            const frontTextColor = typeof frontColor === "string" ? frontColor : frontColor?.["colorStops"]?.[0]?.color;
            let textFill= colorFollow ? frontTextColor : new Color(labelFont.color).hexa();
            if (!isUnselected) {
              textFill = this.toEchartsColor(highlight ? highlightFonts[params.seriesIndex].color : frontTextColor);
            }

            let styleOpt = {
              opacity: isUnselected && this.selectedIndex.value !== -1 ? unselectOpacity : 1,
              textFill: textFill,
              text: showLabel ? label : "",
              textStroke: "rgba(0, 0, 0, 0)",
              fontSize: isUnselected ? labelFont.size : highlightFonts[params.seriesIndex].size,
              fontWeight: labelFont.bold ? "bold" : "normal",
              fontStyle: labelFont.italic ? "italic" : "normal",
              fontFamily: labelFont.family,
              textPosition: "inside",
              textAlign: "center"
            }
            let circleY = 0;
            if (yValue > 0) {
              circleY = location[1] + 2 - shapeColumnWidth / 4 - finalLastHeight;
            } else {
              circleY = xAxisPoint[1] + 2 - shapeColumnWidth / 4 + finalLastHeight;
            }
            return shapeType === "cylinder" ? {
              type: "group",
              name: "columnGroup",
              children: [
                {
                  type: "Cylinder",
                  name: "CylinderBg",
                  shape: {
                    ...shapeOpt,
                    background: true
                  },
                  style: {
                    fill: frontBgColor,
                    opacity: isUnselected && this.selectedIndex.value !== -1 ? unselectOpacity : 1,
                  }
                }, {
                  name: "circleBg",
                  type: "circle",
                  shape: {
                    cx: location[0] + offsetX,
                    cy: yMin - shapeColumnWidth / 4 + 2,
                    r: shapeColumnWidth / 2,
                  },
                  originY: yMin - shapeColumnWidth / 4 + 2,
                  scaleY: 0.5,
                  style: {
                    fill: topBgColor,
                    opacity: isUnselected && this.selectedIndex.value !== -1 ? unselectOpacity : 1,
                  }
                },
                {
                  type: "Cylinder",
                  shape: shapeOpt,
                  style: {
                    fill: frontColor,
                    opacity: isUnselected && this.selectedIndex.value !== -1 ? unselectOpacity : 1,
                    ...Object.assign({}, labelPosition === "outside"? {text: ""} : styleOpt),
                    textPosition: [shapeColumnWidth / 2 + labelOffsetX, "50%"]
                  },
                }, {
                  type: "circle",
                  shape: {
                    cx: location[0] + offsetX,
                    cy: circleY,
                    r: shapeColumnWidth / 2,
                  },
                  originY: circleY,
                  scaleY: 0.5,
                  style: {
                    fill: topColor,
                    opacity: isUnselected && this.selectedIndex.value !== -1 ? unselectOpacity : 1,
                    ...Object.assign({}, labelPosition === "outside"? styleOpt : {text: ""}),
                    textPosition: [shapeColumnWidth / 2 + labelOffsetX, 15 - labelSpace],
                  }
                },
                {
                  type: "text",
                  style: labelPosition === "outside" ? {
                    text: unit,
                    fill: unitFont.color,
                    x: location[0] + offsetX + this.handleCustomLabelOffset(label)?.width/2 + 2,
                    y: circleY + 17 - labelSpace,
                    textAlign: 'left',
                    textVerticalAlign: 'middle',
                    font: `${unitFont.italic ? "italic" : ""}  ${unitFont.bold ? "bolder" : ""} ${unitFont.size}px ${unitFont.family}`,
                    opacity: showLabel ? 1 : 0,
                  } : {
                    fill: topColor,
                    opacity: isUnselected && this.selectedIndex.value !== -1 ? unselectOpacity : 1
                  }
                }]
            } : {
              type: 'group',
              name: "columnGroup",
              children: [{
                type: 'CubeFront',
                shape: shapeOpt,
                style: {
                  fill: frontColor,
                  opacity: isUnselected && this.selectedIndex.value!== -1? unselectOpacity : 1,
                  ...Object.assign({}, labelPosition === "outside"? {text: ""} : styleOpt),
                  textPosition: [shapeColumnWidth / 2 + labelOffsetX, "50%"],
                }
              }, {
                type: 'CubeSide',
                shape: shapeOpt,
                style: {
                  fill: sideColor,
                  opacity: isUnselected && this.selectedIndex.value !== -1 ? unselectOpacity : 1
                }
              }, {
                type: 'CubeTop',
                shape: shapeOpt,
                style: {
                  fill: topColor,
                  opacity: isUnselected && this.selectedIndex.value!== -1? unselectOpacity : 1,
                  ...Object.assign({}, labelPosition === "outside"? styleOpt : {text: ""}),
                  textPosition: [shapeColumnWidth / 2 + labelOffsetX, 15 - labelSpace],
                }
              }, {
                type: 'CubeFront',
                shape: shapeOpt,
                style: {
                  fill: frontBgColor,
                  opacity: isUnselected && this.selectedIndex.value !== -1 ? unselectOpacity : 1,
                }
              }, {
                type: 'CubeSide',
                shape: shapeOpt,
                style: {
                  fill: sideBgColor,
                  opacity: isUnselected && this.selectedIndex.value !== -1 ? unselectOpacity : 1,
                }
              }, {
                type: 'CubeTop',
                shape: shapeOpt,
                style: {
                  fill: topBgColor,
                  opacity: isUnselected && this.selectedIndex.value !== -1 ? unselectOpacity : 1,
                }
              },
              {
                type: "text",
                style: labelPosition === "outside" ? {
                  text: unit,
                  fill: unitFont.color,
                  x: location[0] + offsetX + this.handleCustomLabelOffset(label)?.width/2,
                  y:  circleY + 10 - labelSpace,
                  textAlign: 'left',
                  textVerticalAlign: 'middle',
                  font: `${unitFont.italic ? "italic" : ""}  ${unitFont.bold ? "bolder" : ""} ${unitFont.size}px ${unitFont.family}`,
                  opacity: showLabel ? 1 : 0,
                } : {
                  fill: topColor,
                  opacity: isUnselected && this.selectedIndex.value !== -1 ? unselectOpacity : 1
                }
              }
              ]
            }
          },
          itemStyle: {
            color: (params) => {
              let color = this.getSeriesColors()[params.seriesIndex];
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
              return color
            },
            borderWidth: shapeBorderWidth,
            borderColor: this.toEchartsColor(this.getOption("shape-border-color")),
            borderRadius: shapeBorderRadius <= 0 ? 0 : shapeBorderRadius
          },
          encode
        });
      }
    }

    xDims[0] && seriesOpt.push({
      name: "stackSumVal-bg",
      type: "bar",
      selectedMode: false,
      itemStyle: {
        opacity: 0
      },
      encode: {
        x: xDims[0].uid[2],
        y: "stackSumVal-bg"
      }
    })

    return seriesOpt;
  }

  get stack(): boolean {
    return true;
  }

}
