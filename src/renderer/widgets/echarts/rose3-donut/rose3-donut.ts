import { DefinedOptions, OptionFontValue } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { TheWidget as Pie3, component as B2Pie3, } from "@renderer/widgets/echarts/pie3";
import { SeriesOption } from "echarts/dist/echarts";
import { formatFloat } from "@common/utils/math";
import resource from "./locales"
import { recursive } from "merge";
import i18next from "@renderer/widgets/i18next";

//3D环形图
export class Rose3Donut extends Pie3 {
  static resource = recursive(true, Pie3.resource, resource);
  static defineOptions(): DefinedOptions[] {
    return [
      {
        style: {
          "series-shape": {
            children: [
              {
                name: "shape-internal-multiple",
                alias: i18next.t("shape-internal-multiple"),
                type: "number(unit=" + i18next.t("unit_bei") + ")",
                default: 2
              },
              {
                name: "shape-internal-proportion",
                alias: i18next.t("shape-internal-proportion"),
                type: "number(unit=%)",
                default: 20
              }
            ]
          },
          "label-group": {
            children: [
              {
                name: "label-default-cluster",
                show: "tab",
                children: [
                  {
                    name: "label-style-cluster",
                    children: [
                      {
                        name: "label-center-distance",
                        default: 50,
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

  getParametricEquations(startRatio, endRatio, isSelected, isHovered, k, h, r) {
    // 计算
    const midRatio = (startRatio + endRatio) / 2;
    const startRadian = startRatio * Math.PI * 2;
    const endRadian = endRatio * Math.PI * 2;
    const midRadian = midRatio * Math.PI * 2;

    // 如果只有一个扇形，则不实现选中效果。
    if (startRatio === 0 && endRatio === 1) {
      // eslint-disable-next-line no-param-reassign
      isSelected = false;
    }

    // 通过扇形内径/外径的值，换算出辅助参数 k（默认值 1/3）
    // eslint-disable-next-line no-param-reassign
    k = typeof k !== "undefined" ? k : 1 / 3;
    //  k=0.5
    // 计算选中效果分别在 x 轴、y 轴方向上的位移（未选中，则位移均为 0）
    const offsetX = isSelected ? Math.cos(midRadian) * 0.1 : 0;
    const offsetY = isSelected ? Math.sin(midRadian) * 0.1 : 0;

    //  const offsetX =  0;
    //  const offsetY =  0;
    // 计算高亮效果的放大比例（未高亮，则比例为 1）
    const hoverRate = isHovered ? 1.05 : 1;

    // 返回曲面参数方程
    return {
      u: {
        min: -Math.PI,
        max: Math.PI * 3,
        step: Math.PI / 32,
      },
      v: {
        min: 0,
        max: Math.PI * 2,
        step: Math.PI / 20,
      },
      x(u, v) {
        if (u < startRadian) {
          return (
            offsetX +
            Math.cos(startRadian) * (1 + Math.cos(v) * k) * hoverRate * r
          );
        }
        if (u > endRadian) {
          return (
            offsetX +
            Math.cos(endRadian) * (1 + Math.cos(v) * k) * hoverRate * r
          );
        }
        return offsetX + Math.cos(u) * (1 + Math.cos(v) * k) * hoverRate * r;
      },
      y(u, v) {
        if (u < startRadian) {
          return (
            offsetY +
            Math.sin(startRadian) * (1 + Math.cos(v) * k) * hoverRate * r
          );
        }
        if (u > endRadian) {
          return (
            offsetY +
            Math.sin(endRadian) * (1 + Math.cos(v) * k) * hoverRate * r
          );
        }
        return offsetY + Math.sin(u) * (1 + Math.cos(v) * k) * hoverRate * r;
      },
      z(u, v) {
        let zValue = 0;
        if (u < -Math.PI * 0.5) {
          zValue = Math.sin(u);
        } else if (u > Math.PI * 2.5) {
          zValue = Math.sin(u) * h * 0.1;
        } else {
          zValue = Math.sin(v) > 0 ? h * 0.1 : -2;
        }
        zValue = Math.max(0, zValue);
        return zValue;
      },
    };
  }

  get echartsSeriesOption(): SeriesOption | SeriesOption[] {
    let multiple = this.getOption("shape-internal-multiple")
    let resultData = this.datasetSource();
    let series = [];
    let maxValue = 0
    let mixValue = null
    let k = []
    let k3 = this.getOption<number>("shape-internal-proportion") / 100
    let sumValue = resultData.reduce((resultValue, currentValue) => {
      let value = isNaN(currentValue?.value) ? 0 : currentValue?.value;
      if (value > maxValue) {
        maxValue = value
      }
      if (mixValue) {
        if (mixValue > value) {
          mixValue = value
        }
      } else {
        mixValue = value
      }
      return resultValue + value;
    }, 0);
    resultData.map(item => {
      item.value === mixValue ? k.push(k3) : k.push((item.value - mixValue * (1 - k3)) / item.value)
    })
    let startValue = 0;
    let endValue = 0;
    let endValue1 = sumValue;
    let startValue1 = 0;
    let deepHeight = this.getOption<number>("deep-height");
    deepHeight = Math.max(1, Math.min(deepHeight, 50));
    let shapeColors = this.getOption<Color[]>("palette");
    for (let i = 0; i < resultData.length; i++) {
      let currentValue = isNaN(resultData[i]?.value) ? 0 : resultData[i]?.value;
      startValue1 = endValue1 - currentValue;
      let seriesItem = {
        name: resultData[i].name,
        type: "surface",
        parametric: true,
        wireframe: {
          show: false,
        },
        //渐变
        shading: "realistic",
        realisticMaterial: {
          detailTexture: this.getGradientColorDataURL(
            shapeColors[i % (shapeColors.length || 1)]
          ),
        },
        itemStyle: {
          color: (parame) => {
            if (typeof parame.color == "string") {
              return parame.color;
            }
            let alpha = new Color(
              parame?.color?.colorStops?.[0]?.color
            ).alpha();
            return `rgba(255,255,255,${alpha})`;
          },
        },
        parametricEquation: this.getParametricEquations(
          startValue1 / sumValue,
          endValue1 / sumValue,
          false,
          false,
          k[i],
          deepHeight,
          maxValue > sumValue / 4 ? ((currentValue / sumValue) as any) * (2) : ((currentValue / sumValue) as any) * (multiple as any)  //如果数据中最大值大于总体值的1/4 强制图形变小
        ),
        pieData: {
          name: resultData[i].name,
          value: currentValue,
          startRatio: startValue1 / sumValue,
          endRatio: endValue1 / sumValue,
          isSelected: false,
          isHovered: false,
          k: k[i],
          h: deepHeight,
        },
      };
      // startValue = endValue;
      endValue1 = startValue1;
      series.push(seriesItem);
    }
    const handleCustomLabelOffset = (text, font = 'normal 12px sans-serif') => {
      let _canvas = document.createElement('canvas');
      const _context = _canvas.getContext('2d');
      _context.font = font;
      let fontWidth = _context.measureText(text);
      _canvas.remove();
      return fontWidth;
    }
    //图形文本
    let labelShowName = this.getOption<boolean>("label-name-visible_outside");
    let labelShowValue = this.getOption<boolean>("label-value-visible");
    let labelShow = this.getOption<boolean>("label") && (labelShowName || labelShowValue);
    let unitFont = this.getOption<OptionFontValue>("label-unit-font");
    let unit = this.getOption<string>("label-unit-value");
    if (labelShow) {
      let labelNameFont = this.getOption<OptionFontValue>("label-font");
      let labelValueType = this.getOption<string>("label-text-type");
      let labelValueDecimalPlaces = this.getOption<number>(
        "label-decimal-places"
      );
      let labelValueCompleteZero = this.getOption<boolean>(
        "label-complete-zero"
      );
      let labelValueFont = this.getOption<OptionFontValue>("label-value-font");
      let upliftAngle = this.getOption<number>("angle-uplift");
      let seriesCssColors = this.getSeriesCssColors();

      let labelShapeSpacing = this.getOption<number>("label-shape-spacing");
      let labelLineWidth = this.getOption<number>("label-line-width");
      let labelLineColors = this.getOption<Color[]>("palette");

      const getPoint = (centerX, centerY, radiusX, radiusY, radian) => {
        return {
          x: centerX + radiusX * Math.cos(radian),
          y: centerY + radiusY * Math.sin(radian),
        };
      };



      let currentEndCurveAngle = -Math.PI / 2;
      let currentDealValue = 0;

      let labelSeries = {
        type: "custom",
        coordinateSystem: null,
        renderItem: (parame, api) => {
          if (currentDealValue >= sumValue) {
            currentDealValue = 0;
            currentEndCurveAngle = -Math.PI / 2;
          }
          let viewWidth = api.getWidth();
          let viewHeight = api.getHeight();
          let dataIndex = parame.dataIndex;
          let percentValue = api.value() / sumValue;
          if (isNaN(percentValue)) percentValue = 0;
          currentDealValue = currentDealValue + api.value();
          let curveAngle = Math.PI * 2 * percentValue;
          let offsetX = 0;
          let offsetY = this.getOption<number>("label-offset-y");
          let { left, right, top, bottom } = this.pieSizeOpts;

          let labelCenterPercent = this.getOption<number>(
            "label-center-distance"
          );
          labelCenterPercent = Math.max(0, Math.min(100, labelCenterPercent));
          let ellipseCenterPointX = left - right + offsetX + viewWidth / 2;
          let ellipseCenterPointY = top - bottom + offsetY + viewHeight / 2;
          let radiusY =
            (viewHeight / 2) *
            labelCenterPercent *
            0.01 *
            Math.sin((Math.PI / 180) * upliftAngle);
          let radiusX = radiusY / Math.sin((Math.PI / 180) * upliftAngle);
          let startPoint = getPoint(
            ellipseCenterPointX,
            ellipseCenterPointY,
            radiusX,
            radiusY,
            currentEndCurveAngle + curveAngle / 2
          );
          let isLeft =
            currentEndCurveAngle + curveAngle / 2 > Math.PI / 2 ? true : false;
          let isBottom =
            currentEndCurveAngle + curveAngle / 2 > 0 &&
              currentEndCurveAngle + curveAngle / 2 < Math.PI
              ? true
              : false;
          currentEndCurveAngle = currentEndCurveAngle + curveAngle;
          if (currentEndCurveAngle >= (Math.PI * 3) / 2) {
            currentEndCurveAngle = -Math.PI / 2;
          }

          let shapes = [];
          if (labelShowName || labelShowValue) {
            let lineFirstLength = this.getOption<number>(
              "label-line-first-length"
            );
            let lineSecondLength = this.getOption<number>(
              "label-line-second-length"
            );
            let middlePoint = {
              x:
                startPoint.x + lineFirstLength * Math.cos((Math.PI / 180) * 60),
              y:
                startPoint.y + lineFirstLength * Math.sin((Math.PI / 180) * 60),
            };
            let endPoint = {
              x:
                startPoint.x +
                lineFirstLength * Math.cos((Math.PI / 180) * 60) +
                lineSecondLength,
              y:
                startPoint.y + lineFirstLength * Math.sin((Math.PI / 180) * 60),
            };

            if (!isBottom) {
              middlePoint["y"] =
                startPoint.y - lineFirstLength * Math.sin((Math.PI / 180) * 60);
            }
            endPoint["y"] = middlePoint["y"];

            if (isLeft) {
              middlePoint["x"] =
                startPoint.x - lineFirstLength * Math.cos((Math.PI / 180) * 60);
              endPoint["x"] =
                middlePoint["x"] - lineSecondLength - labelShapeSpacing;
            } else {
              endPoint["x"] =
                middlePoint["x"] + lineSecondLength + labelShapeSpacing;
            }

            shapes.push({
              type: "line",
              shape: {
                x1: startPoint.x,
                y1: startPoint.y,
                x2: middlePoint.x,
                y2: middlePoint.y,
              },
              style: {
                stroke: new Color(labelLineColors[dataIndex % (labelLineColors.length || 1)]).toEchartsColor(),
                lineWidth: labelLineWidth,
              },
            });
            shapes.push({
              type: "line",
              shape: {
                x1: middlePoint.x,
                y1: middlePoint.y,
                x2: endPoint.x,
                y2: endPoint.y,
              },
              style: {
                stroke: new Color(labelLineColors[dataIndex % (labelLineColors.length || 1)]).toEchartsColor(),
                lineWidth: labelLineWidth,
              },
            });
            let shapeColor = new Color(
              shapeColors[dataIndex % (shapeColors.length || 1)]
            );
            if (labelShowName) {
              shapes.push({
                type: "text",
                style: {
                  x: endPoint.x,
                  y: endPoint.y,
                  fill:new Color(labelNameFont.color).alpha() == 0 &&!shapeColor?.isGradient?.()? shapeColor?.hexa?.(): new Color(labelNameFont.color)?.hexa?.(),
                  font: `${labelNameFont.italic ? "italic" : ""}  ${labelNameFont.bold ? "bolder" : ""} ${labelNameFont.size}px ${labelNameFont.family}`,
                  text: resultData[dataIndex].name,
                  textAlign: `${isLeft ? "right" : "left"}`,
                },
                y: -labelNameFont.size / 2,
              });
            }
            if (labelShowValue) {
              let resultValue: any = 0;
              if (labelValueType === "normal") {
                resultValue = api.value();
                resultValue = formatFloat(resultValue,labelValueDecimalPlaces,labelValueCompleteZero);
              } else {
                resultValue = formatFloat(percentValue * 100,labelValueDecimalPlaces,labelValueCompleteZero) + "%";
              }
              let val_width = handleCustomLabelOffset(resultValue, `${labelValueFont.italic ? "italic" : "normal"} ${labelValueFont.size}px ${labelValueFont.family}`).width;
              shapes.push({
                type: "text",
                style: {
                  x: endPoint.x,
                  y: endPoint.y,
                  fill: new Color(labelValueFont.color).alpha() == 0 &&!shapeColor?.isGradient?.()? shapeColor?.hexa?.(): new Color(labelValueFont.color)?.hexa?.(),
                  font: `${labelValueFont.italic ? "italic" : ""}  ${labelValueFont.bold ? "bolder" : ""} ${labelValueFont.size}px ${labelValueFont.family}`,
                  text: resultValue,
                  textAlign: `${isLeft ? "right" : "left"}`,
                },
                y: labelValueFont.size / 2,
              });
              shapes.push({
                type: "text",
                style: {
                  x: endPoint.x + val_width + 5,
                  y: endPoint.y,
                  fill: new Color(unitFont.color).alpha() == 0 && !shapeColor?.isGradient?.() ? shapeColor?.hexa?.() : new Color(unitFont.color)?.hexa?.(),
                  font: `${unitFont.italic ? "italic" : ""}  ${unitFont.bold ? "bolder" : ""} ${unitFont.size}px ${unitFont.family}`,
                  text: unit,
                  textAlign: `${isLeft ? "right" : "left"}`
                },
                y: labelValueFont.size / 2
              });
            }
          }
          return {
            type: "group",
            children: shapes,
          };
        },
        data: resultData,
        silent: true,
      };
      series.push(labelSeries);
    }

    return series;
  }
  public currentEchartsOption;

  resetChartOption(loaded?: boolean) {
    super.resetChartOption(loaded);

    this.currentEchartsOption = this.echartsOption;
    this.lastSeriesIndex = null;
    this.currentDataLength = this.datasetSource()?.length || 0;
  }

  initEchartsEvents() {
    // super.initEchartsEvents();
    this.echartsChart.off("selectchanged");
    let resultData = this.datasetSource();
    let maxValue = 0
    let multiple = this.getOption("shape-internal-multiple")
    let sumValue = resultData.reduce((resultValue, currentValue) => {
      let value = isNaN(currentValue?.value) ? 0 : currentValue?.value;
      if (value > maxValue) {
        maxValue = value
      }
      return resultValue + value;
    }, 0);
    this.echartsChart.off("click");
    this.echartsChart.on("click", "series.surface", (param: any) => {
      let upliftHeight = this.getOption<number>("uplift-height");
      let currentSeriesIndex = param.seriesIndex;
      let catUid = this.getOption("axis-category")?.[0]?.uid;
      if (currentSeriesIndex >= this.currentDataLength || !this.currentEchartsOption) return;
      if ( this.lastSeriesIndex != null && this.lastSeriesIndex != currentSeriesIndex ) {
        let lastPieData = this.currentEchartsOption["series"][this.lastSeriesIndex]["pieData"];
        lastPieData["isSelected"] = false;
        this.currentEchartsOption["series"][this.lastSeriesIndex][
          "parametricEquation"
        ] = this.getParametricEquations(
          lastPieData["startRatio"],
          lastPieData["endRatio"],
          lastPieData["isSelected"],
          false,
          lastPieData["k"],
          lastPieData["h"],
          maxValue > sumValue / 4 ? ((lastPieData.value / sumValue) as any) * 2 : ((lastPieData.value / sumValue) as any) * (multiple as any)
        );
      }

      let currentPieData = this.currentEchartsOption["series"][currentSeriesIndex]["pieData"];
      currentPieData["isSelected"] = !currentPieData["isSelected"];
      this.currentEchartsOption["series"][currentSeriesIndex][
        "parametricEquation"
      ] = this.getParametricEquations(
        currentPieData["startRatio"],
        currentPieData["endRatio"],
        currentPieData["isSelected"],
        false,
        currentPieData["k"],
        currentPieData["isSelected"] ? currentPieData["h"] + upliftHeight : currentPieData["h"],
        maxValue > sumValue / 4 ? ((currentPieData.value / sumValue) as any) * 2 : ((currentPieData.value / sumValue) as any) * (multiple as any)
      );
      if (catUid) {
        let linkages = [];
        const triggerLinkage = param.event ? true : this.animationTriggerLinkage;
        if (triggerLinkage && (currentPieData && this.getOption("display-with-linkage"))) {
          linkages.push({ uid: catUid, value: currentPieData.name });
          this.applyLinkage(linkages);
        }
      }
      this.echartsChart.setOption(this.currentEchartsOption);
      if (currentPieData["isSelected"]) {
      } else {
      }
      this.lastSeriesIndex = currentSeriesIndex;
      if(param?.event){
      }
    });
  }
}
