import { DefinedOptions, OptionFileValue, OptionFieldValue, OptionFontValue } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { TheWidget as Pie, component as B2Pie } from "@renderer/widgets/echarts/pie";
import { TooltipComponentOption, SeriesOption, EChartsOption } from "echarts/dist/echarts";
import { formatFloat } from "@common/utils/math";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { recursive } from "merge";
import { watch, computed } from "vue";
/**
 * 3D饼图
 */
export class Pie3 extends Pie {
  protected lastSeriesIndex;
  protected currentDataLength;

  static resource = recursive(true, Pie.resource, resource);
  static defineOptions(): DefinedOptions[] {
    return [
      {
        style: {
          "basic": {
            children: [
              {
                name: "webgl-optimization",
                alias: i18next.t("webGLOptimization"),
                tip: i18next.t("webGLOptimizationTips"),
                type: "boolean",
                default: true
              },
              {
                name: "echarts-renderer",
                visible: false
              }
            ]
          },
          "series-shape": {
            alias: i18next.t("seriesShape"),
            children: [
              {
                name: "angle-start",
                default: 270,
                visible: false
              },
              {
                name: "shape-size",
                alias: i18next.t("shapeSize"),
                default: 75,
                type: "number(unit=%)",
                visible: false
              },
              {
                name: "angle-uplift",
                alias: i18next.t("angleUplift"),
                type: "number(min=10,max=90, showInput, unit=°)",
                default: 45,
              },
              {
                name: "deep-height",
                alias: i18next.t("deepHeight"),
                type: "number(unit=px)",
                default: 10,
              },
              {
                name: "uplift-height",
                alias: i18next.t("upliftHeight"),
                type: "number(unit=px)",
                default: 30,
              },
              {
                name: "shape-border-width",
                visible: false
              },
              {
                name: "shape-border-color",
                visible: false
              },
              {
                name: "shape-background",
                visible: false
              },
            ]

          },
          padding: {
            visible: true
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
                    name: "label-position",
                    default: "outside",
                    visible: false
                  },
                  {
                    name: "label-algin-auto",
                    alias: i18next.t("labelAlginAuto"),
                    type: "boolean",
                    default: false,
                  },
                  {
                    name: "label-style-cluster",
                    alias: i18next.t("labelStyleCluster"),
                    children: [
                      {
                        name: "label-offset-y",
                        alias: i18next.t("labelOffsetY"),
                        type: "number(unit=px)",
                        default: 10
                      },
                      {
                        name: "label-center-distance",
                        alias: i18next.t("labelCenterDistance"),
                        type: "number(unit=%)",
                        default: 73,
                        visible: false
                      },
                    ]
                  },
                  {
                    name: "label-line",
                    alias: i18next.t("labelLine"),
                    children: [
                      {
                        name: "label-line-width",
                        alias: i18next.t("labelLineWidth"),
                        type: "number(unit=px)",
                        default: 2
                      },
                      {
                        name: "label-line-first-length",
                        alias: i18next.t("labelLineFirstLength"),
                        type: "number(unit=px)",
                        default: 10
                      },
                      {
                        name: "label-line-second-length",
                        alias: i18next.t("labelLineSecondLength"),
                        type: "number(unit=px)",
                        default: 50
                      },
                      {
                        alias: i18next.t("labelLineColor"),
                        name: "label-line-color",
                        type: "palette",
                        default: (widget: Pie3) => { return Array.from(widget.defaultColors10) },
                        visible: false
                      },
                    ]
                  },
                ]
              }
            ]
          },
        }
      },
      ...super.defineOptions()
    ]
  }

  // 生成扇形的曲面参数方程
  getParametricEquation(startRatio, endRatio, isSelected, isHovered, k, h) {
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

    // 计算选中效果分别在 x 轴、y 轴方向上的位移（未选中，则位移均为 0）
    // const offsetX = isSelected ? Math.cos(midRadian) * 0.1 : 0;
    // const offsetY = isSelected ? Math.sin(midRadian) * 0.1 : 0;
    const offsetX = 0;
    const offsetY = 0;
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
          return offsetX + Math.cos(startRadian) * (1 + Math.cos(v) * k) * hoverRate;
        }
        if (u > endRadian) {
          return offsetX + Math.cos(endRadian) * (1 + Math.cos(v) * k) * hoverRate;
        }
        return offsetX + Math.cos(u) * (1 + Math.cos(v) * k) * hoverRate;
      },
      y(u, v) {
        if (u < startRadian) {
          return offsetY + Math.sin(startRadian) * (1 + Math.cos(v) * k) * hoverRate;
        }
        if (u > endRadian) {
          return offsetY + Math.sin(endRadian) * (1 + Math.cos(v) * k) * hoverRate;
        }
        return offsetY + Math.sin(u) * (1 + Math.cos(v) * k) * hoverRate;
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
      }
    };
  }

  get echartsOptionFunc(): {[key: string]: Function} {
    return {
      grid3D: ()=>{
        let pieStartAngle = this.getOption<number>("angle-start");
        let upliftAngle = this.getOption<number>("angle-uplift");
        let { left, right, top, bottom } = this.pieSizeOpts;
        return {
          show: false,
          viewControl: {
            alpha: upliftAngle,
            beta: pieStartAngle,
            rotateSensitivity: 0,
            zoomSensitivity: 0,
            panSensitivity: 0,
            distance: 150,
          },
          postEffect: {
            enable: true
          },
          left: left - right,
          top: top -bottom
        }
      },
      xAxis3D: ()=>{
        return {min: -2, max: 2};
      },
      yAxis3D: ()=>{
        return {min: -2, max: 2};
      },
      zAxis3D: ()=>{
        return {min: -10, max: 10};
      },
      tooltip: ()=>this.echartsTooltipOption,
      legend: ()=>this.echartsLegendOption,
      series: ()=>this.echartsSeriesOption,
      color: ()=>this.getSerieEchartsColors()
    };
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
    let showUnit = this.getOption<boolean>("tooltip-unit");
    let unitText = this.getOption<boolean>("tooltip-unit-text");
    let unitFontColor = new Color(this.getOption<Color>("tooltip-unit-font-color")).hexa();
    let unitFontSize = this.getOption<number>("tooltip-unit-font-size");

    let tooltipValueType = this.getOption<string>("tooltip-text-type");
    let tooltipValueDecimalPlaces = this.getOption<number>("tooltip-decimal-places");
    let tooltipValueCompleteZero = this.getOption<boolean>("tooltip-complete-zero");

    const projectId = this.getBoard().projectId;
    const seriesCssColors = this.getSeriesCssColors();
    let showTooltip = this.getOption<boolean>("tooltip");
    let tooltipBackground = backgroundImage?.relativePath ? `url("${projectId}/${backgroundImage.relativePath}")` : backgroundColor;

    let titleName = "value";
    let categoryDims = this.getOption<OptionFieldValue[]>("axis-category") || [];
    let valueDims = this.getOption<OptionFieldValue[]>("axis-value") || [];
    if (categoryDims.length && valueDims.length) {
      titleName = this.getFieldAlias(valueDims[0].uid);
    }

    let datasetSource = this.datasetSource();
    let sumValue = datasetSource.reduce((resultValue, currentValue) => {
      let value = isNaN(currentValue?.value) ? 0 : currentValue?.value;
      return resultValue + value;
    }, 0);
    return {
      trigger: 'item',
      confine: true,
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
      formatter: (param) => {
        let currentSeriesIndex = param.seriesIndex;
        let dataHtml = "";
        let iconHtml = showIcon ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${seriesCssColors[currentSeriesIndex % seriesCssColors.length]};"></span>` : "";
        let unitHtml = showUnit ? `<span style="color:${unitFontColor};font-size:${unitFontSize}px;line-height:1;">${unitText}</span>` : "";

        let resultValue: any = datasetSource[currentSeriesIndex]["value"];
        if (isNaN(resultValue)) resultValue = 0;

        if (tooltipValueType === "normal") {
          resultValue = formatFloat(resultValue, tooltipValueDecimalPlaces, tooltipValueCompleteZero);
        } else {
          resultValue = resultValue / sumValue;
          if (isNaN(resultValue)) resultValue = 0;
          resultValue = formatFloat(resultValue * 100, tooltipValueDecimalPlaces, tooltipValueCompleteZero) + '%';
        }
        if(commaDisplay){
          resultValue = this.doCommaSeparat(resultValue)
        }
        dataHtml += `<div>
          ${iconHtml}
          <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${param.seriesName}：</span>
          <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${resultValue}</span>
          ${unitHtml}
        </div>`;
        let titleHtml = showTitle ? `<div>
          <span style="color:${titleFontColor};font-size:${titleFontSize}px;line-height:1;">${titleName}</span>
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

  get internalDiameterRatio(): number {
    return 1;
  }

  getGradientColorDataURL(baseColor) {
    let colorInfo = new Color(baseColor);
    if (colorInfo?.isSolid()) return colorInfo.hexa();
    let angle = colorInfo.getAngle();
    let startX = 0, startY = 0, endX = 0, endY = 0;


    let imgDataURL = "";
    let _canvas = document.createElement("canvas");
    _canvas.width = 100;
    _canvas.height = 100;
    const _context = _canvas.getContext("2d");

    if (angle == "0") {
      startY = 100;
    } else if (angle == "45") {
      startY = 100;
      endX = 100;
    } else if (angle == "90") {
      endX = 100;
    } else if (angle == "135") {
      endX = 100;
      endY = 100;
    } else if (angle == "180") {
      endY = 100;
    } else if (angle == "225") {
      startX = 100;
      endY = 100;
    } else if (angle == "270") {
      startX = 100;
    } else if (angle == "315") {
      startX = 100;
      startY = 100;
    }
    let grd = _context.createLinearGradient(startX, startY, endX, endY);

    if (angle == "r") {
      grd = _context.createRadialGradient(50, 50, 50, 0, 0, 0);
    }

    colorInfo.colorStops().forEach((item) => {
      grd.addColorStop(item.position * 0.01, item.color.string());
    });
    _context.fillStyle = grd;
    _context.fillRect(0, 0, 100, 100);
    imgDataURL = _canvas.toDataURL();
    _canvas.remove();
    _canvas = null;
    return imgDataURL;
  }

  getLabelLayoutList() {
    let originData = this.datasetSource();
    if(!originData.length) return [];
    let sumValue = originData.reduce((resultValue, currentValue) => {
      let value = isNaN(currentValue?.value) ? 0 : currentValue?.value;
      return resultValue + value;
    }, 0);
    let offsetX = 0;
    let offsetY = this.getOption<number>("label-offset-y");
    let { left, right, top, bottom } = this.pieSizeOpts;

    const centerX = left - right + offsetX + this.contentSize.width / 2;
    const centerY = top - bottom + offsetY + this.contentSize.height / 2;
    let upliftAngle = this.getOption<number>("angle-uplift");
    let labelCenterPercent = this.getOption<number>("label-center-distance");
    labelCenterPercent = Math.max(0, Math.min(100, labelCenterPercent));
    let radiusY = this.contentSize.height / 2 * labelCenterPercent * 0.01 * Math.sin(Math.PI / 180 * upliftAngle);
    let radiusX = radiusY / Math.sin(Math.PI / 180 * upliftAngle);

    let layoutList = [];
    let currentEndCurveAngle = -Math.PI / 2;
    let currentDealValue = 0;
    let labelShapeSpacing = this.getOption<number>("label-shape-spacing");

    const getPoint = (cx, cy, rx, ry, r) => {
      return {
        x: cx + rx * Math.cos(r),
        y: cy + ry * Math.sin(r)
      }
    }
    const quadrantMap = Array(5).fill(0);
    const rightQuadrantItems = [];
    const leftQuadrantItems = [];

    //旧版布局方式
    for(let index=0; index < originData.length; index++){
      const row = originData[index];
      currentDealValue = currentDealValue + row["value"];
      let percentValue = row["value"] / sumValue;
      let curveAngle = Math.PI * 2 * percentValue;
      let startPoint = getPoint(centerX, centerY, radiusX, radiusY, currentEndCurveAngle + curveAngle / 2);

      let isLeft = currentEndCurveAngle + curveAngle / 2 > Math.PI / 2 ? true : false;
      let isBottom = currentEndCurveAngle + curveAngle / 2 > 0 && currentEndCurveAngle + curveAngle / 2 < Math.PI ? true : false;

      currentEndCurveAngle = currentEndCurveAngle + curveAngle;
      if (currentEndCurveAngle >= Math.PI * 3 / 2) {
        currentEndCurveAngle = -Math.PI / 2;
      }

      let lineFirstLength = this.getOption<number>("label-line-first-length");
      let lineSecondLength = this.getOption<number>("label-line-second-length");
      let middlePoint = {
        x: startPoint.x + lineFirstLength * Math.cos(Math.PI / 180 * 60),
        y: startPoint.y + lineFirstLength * Math.sin(Math.PI / 180 * 60),
      }
      let endPoint = {
        x: startPoint.x + lineFirstLength * Math.cos(Math.PI / 180 * 60) + lineSecondLength,
        y: startPoint.y + lineFirstLength * Math.sin(Math.PI / 180 * 60),
      }

      if (!isBottom) {
        middlePoint["y"] = startPoint.y - lineFirstLength * Math.sin(Math.PI / 180 * 60);
      }
      endPoint["y"] = middlePoint["y"];

      if (isLeft) {
        middlePoint["x"] = startPoint.x - lineFirstLength * Math.cos(Math.PI / 180 * 60);
        endPoint["x"] = middlePoint["x"] - lineSecondLength - labelShapeSpacing;
      } else {
        endPoint["x"] = middlePoint["x"] + lineSecondLength + labelShapeSpacing;
      }

      const quadrant = isBottom ? (isLeft ? 3 : 2) : (isLeft ? 4 : 1);
      quadrantMap[quadrant] += 1;
      const item = {
        name: row["name"],
        value: row["value"],
        percent: percentValue,
        sumValue,
        startPoint,
        middlePoint,
        endPoint,
        isLeft,
        isBottom,
        quadrant,
        isShow: true
      }
      layoutList.push(item);
      isLeft ? leftQuadrantItems.push(item) : rightQuadrantItems.push(item);
    }
    if(!this.getOption("label-algin-auto")) {
      return layoutList;
    }

    let halfVHeight = this.contentSize.height / 2;
    let labelBoxMargin = 10;
    let labelBoxHeight = labelBoxMargin + this.getOption<OptionFontValue>("label-value-font").size + this.getOption<OptionFontValue>("label-font").size;
    let quadrantMax = Math.floor(halfVHeight / labelBoxHeight);

    //是否需要象限合并计算
    let needMerge = false;
    const updateNeedMerge = (q1, q2) => {
      needMerge = quadrantMap[q1] > quadrantMax || quadrantMap[q2] > quadrantMax;
      let exceed = quadrantMap[q1] + quadrantMap[q2] - 2 * quadrantMax;

      //需要隐藏的文本
      if(exceed > 0){
        let quadrantItems = q1 == 1 ? rightQuadrantItems : leftQuadrantItems;
        let num = Math.ceil((quadrantItems.length - 2) / exceed);
        const dealQuadrantItems = quadrantItems.slice(1,-1);
        if(dealQuadrantItems.length < exceed) return;

        for(let index = 0; index < exceed; index++){

          const hitItem = dealQuadrantItems[index * num];
          hitItem && (hitItem["isShow"] = false);
        }

      }
    }
    updateNeedMerge(1,2);

    const labelPadding = this.contentSize.width * 0.1;
    let startY = 0;

    return layoutList.map((item, index, arr)=>{
      if(!item["isShow"]) return item;
      let currentQuadrant = item.quadrant;
      if(currentQuadrant != arr[index-1]?.quadrant){
        let restHeight = halfVHeight - labelBoxHeight * quadrantMap[currentQuadrant];
        switch(currentQuadrant){
          case 1:
            if(!needMerge){
              startY = restHeight / 2;
            }
            break;
          case 2:
            if(!needMerge){
              startY = halfVHeight + restHeight / 2;
            }
            break;
          case 3:
            updateNeedMerge(3,4);
            if(!needMerge){
              startY = this.contentSize.height - restHeight / 2;
            }else{
              startY = this.contentSize.height;
            }
            break;
          case 4:
            if(!needMerge){
              startY = halfVHeight - restHeight / 2;
            }
        }
      }
      item["endPoint"]["x"] = item["isLeft"] ? labelPadding : this.contentSize.width - labelPadding;
      item["endPoint"]["y"] = startY;
      item["middlePoint"]["y"] = item["endPoint"]["y"];

      startY = item["isLeft"] ? startY - labelBoxHeight : startY + labelBoxHeight;
      return item;
    });
  }

  computedLabelLayoutList;
  loadEcharts(echarts?) {
    this.computedLabelLayoutList = computed(()=>{
      return this.getLabelLayoutList();
    });
    super.loadEcharts(echarts);
  }

  get echartsSeriesOption(): SeriesOption | SeriesOption[] {
    let resultData = this.datasetSource();
    let series = [];

    const labelLayoutList = this.computedLabelLayoutList.value;
    let sumValue = labelLayoutList[0]?.["sumValue"];
    let endValue1 = sumValue;
    let startValue1 = 0;
    let deepHeight = this.getOption<number>("deep-height");
    deepHeight = Math.max(1, Math.min(deepHeight, 50));
    let shapeColors = this.getOption<Color[]>("palette");
    for (let i = 0; i < resultData.length; i++) {
      let currentValue = isNaN(resultData[i]?.value) ? 0 : resultData[i]?.value;
      // endValue = startValue + currentValue;
      startValue1 = endValue1 - currentValue;
      let seriesItem = {
        name: resultData[i].name,
        type: "surface",
        parametric: true,
        wireframe: {
          show: false,
        },
        //渐变
        shading: 'realistic',
        realisticMaterial: {
          detailTexture: this.getGradientColorDataURL(shapeColors[i % (shapeColors.length || 1)])
        },
        itemStyle: {
          color: (parame) => {
            if (typeof parame.color == "string") {
              return parame.color;
            }
            let alpha = new Color(parame?.color?.colorStops?.[0]?.color).alpha();
            return `rgba(255,255,255,${alpha})`;
          }
        },
        parametricEquation: this.getParametricEquation(
          startValue1 / sumValue,
          endValue1 / sumValue,
          false,
          false,
          this.internalDiameterRatio,
          deepHeight
        ),
        pieData: {
          name: resultData[i].name,
          value: currentValue,
          startRatio: startValue1 / sumValue,
          endRatio: endValue1 / sumValue,
          isSelected: false,
          isHovered: false,
          k: this.internalDiameterRatio,
          h: deepHeight
        }
      }
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
      let labelValueDecimalPlaces = this.getOption<number>("label-decimal-places");
      let labelValueCompleteZero = this.getOption<boolean>("label-complete-zero");
      let labelValueFont = this.getOption<OptionFontValue>("label-value-font");
      let seriesCssColors = this.getSeriesCssColors();

      let labelLineWidth = this.getOption<number>("label-line-width");
      let labelLineColors = this.getOption<Color[]>("palette");

      let labelSeries = {
        type: "custom",
        coordinateSystem: null,
        renderItem: (parame, api) => {
          let dataIndex = parame.dataIndex;
          const { startPoint, middlePoint, endPoint, isLeft, isBottom, percent, isShow} = labelLayoutList[parame.dataIndex];
          if(!isShow) return;
          let shapes = [];
          if (labelShowName || labelShowValue) {
            shapes.push({
              type: "line",
              shape: {
                x1: startPoint.x,
                y1: startPoint.y,
                x2: middlePoint.x,
                y2: middlePoint.y
              },
              style: {
                stroke: new Color(labelLineColors[dataIndex % (labelLineColors.length || 1)]).toEchartsColor(),
                lineWidth: labelLineWidth
              }
            });
            shapes.push({
              type: "line",
              shape: {
                x1: middlePoint.x,
                y1: middlePoint.y,
                x2: endPoint.x,
                y2: endPoint.y
              },
              style: {
                stroke: new Color(labelLineColors[dataIndex % (labelLineColors.length || 1)]).toEchartsColor(),
                lineWidth: labelLineWidth
              }
            });
            let shapeColor = new Color(shapeColors[dataIndex % (shapeColors.length || 1)]);
            if (labelShowName) {
              shapes.push({
                type: "text",
                style: {
                  x: endPoint.x,
                  y: endPoint.y,
                  fill: new Color(labelNameFont.color).alpha() == 0 && !shapeColor?.isGradient?.() ? shapeColor?.hexa?.() : new Color(labelNameFont.color)?.hexa?.(),
                  font: `${labelNameFont.italic ? "italic" : ""}  ${labelNameFont.bold ? "bolder" : ""} ${labelNameFont.size}px ${labelNameFont.family}`,
                  text: resultData[dataIndex].name,
                  textAlign: `${isLeft ? "right" : "left"}`
                },
                y: -labelNameFont.size / 2
              });
            }
            if (labelShowValue) {
              let resultValue: any = 0;
              if (labelValueType === "normal") {
                resultValue = api.value();
                resultValue = formatFloat(resultValue, labelValueDecimalPlaces, labelValueCompleteZero);
              } else {
                resultValue = formatFloat(percent * 100, labelValueDecimalPlaces, labelValueCompleteZero) + '%';
              }
              let val_width = handleCustomLabelOffset(resultValue, `${labelValueFont.italic ? "italic" : "normal"} ${labelValueFont.size}px ${labelValueFont.family}`).width;
              shapes.push({
                type: "text",
                style: {
                  x: endPoint.x,
                  y: endPoint.y,
                  fill: new Color(labelValueFont.color).alpha() == 0 && !shapeColor?.isGradient?.() ? shapeColor?.hexa?.() : new Color(labelValueFont.color)?.hexa?.(),
                  font: `${labelValueFont.italic ? "italic" : ""}  ${labelValueFont.bold ? "bolder" : ""} ${labelValueFont.size}px ${labelValueFont.family}`,
                  text: resultValue,
                  textAlign: `${isLeft ? "right" : "left"}`
                },
                y: labelValueFont.size / 2
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
            children: shapes
          }
        },
        data: resultData,
        silent: true
      };
      series.push(labelSeries);
    }

    return series;
  }

  resetChartOption(loaded?: boolean) {
    super.resetChartOption(loaded);
    this.lastSeriesIndex = null;
    this.currentDataLength = this.datasetSource()?.length || 0;
  }

  getCurrentDataLength(){
    return this.currentDataLength;
  }

  initEchartsEvents() {
    super.initEchartsEvents();
    this.echartsChart.off("selectchanged");
    this.echartsChart.off("click");
    this.echartsChart.on("click", "series.surface", (param: any) => {
      if(!this.status.isVisible) return;
      const currentEchartsOption = this.echartsChart.getOption();
      let upliftHeight = this.getOption<number>("uplift-height");
      let catUid = this.getOption("axis-category")?.[0]?.uid;
      let currentSeriesIndex = param.seriesIndex;
      if (currentSeriesIndex >= this.currentDataLength) return;
      if (this.lastSeriesIndex != null && this.lastSeriesIndex != currentSeriesIndex && this.lastSeriesIndex < this.currentDataLength ) {
        let lastPieData = currentEchartsOption["series"][this.lastSeriesIndex]["pieData"];
        lastPieData["isSelected"] = false;
        currentEchartsOption["series"][this.lastSeriesIndex]["parametricEquation"] = this.getParametricEquation(
          lastPieData["startRatio"],
          lastPieData["endRatio"],
          lastPieData["isSelected"],
          false,
          lastPieData["k"],
          lastPieData["h"]
        );
      }

      let currentPieData = currentEchartsOption["series"][currentSeriesIndex]["pieData"];
      currentPieData["isSelected"] = !currentPieData["isSelected"];
      currentEchartsOption["series"][currentSeriesIndex]["parametricEquation"] = this.getParametricEquation(
        currentPieData["startRatio"],
        currentPieData["endRatio"],
        currentPieData["isSelected"],
        false,
        currentPieData["k"],
        currentPieData["isSelected"] ? currentPieData["h"] + upliftHeight : currentPieData["h"]
      );
      if (catUid) {
        const triggerLinkage = param.event ? true : this.animationTriggerLinkage;
        if(currentSeriesIndex === this.lastSeriesIndex && !currentPieData.isSelected) {
          triggerLinkage && this.withdrawLinkage();
        } else {
          let linkages = [];
          if ((currentPieData && this.getOption("display-with-linkage"))) {
            linkages.push({ uid: catUid, value: currentPieData.name });
            triggerLinkage && this.applyLinkage(linkages)
          }
        }
      }
      this.echartsChart.setOption(currentEchartsOption);
      if (currentPieData["isSelected"]) {
      } else {
      }
      this.lastSeriesIndex = currentSeriesIndex;
      if(param?.event){
      }
    });
  }

  datasetSource() {
    if (this['_dataSource'].value === undefined) {
      this.effectScope.run(() => {
        watch(() => {
          if(this.status.isVisible || this._firstLoadData || !this["_dataSource"].value) {
            return this._datasetSource();
          } else {
            return this.lastestData || this["_dataSource"].value || [];
          }
        }, (value) => {
          if ((this._firstLoadData || this.status.isVisible) && JSON.stringify(value) !== JSON.stringify(this["_dataSource"].value)) {
            this._firstLoadData = false;
            this['_dataSource'].value = value;
            this.dataChangeTime = Date.now();
            this.currentDataLength = value?.length || 0;
          } else {
            this.lastestData = value;
          }
        }, { immediate: true });
      });
    }
    return this['_dataSource'].value || [];
  }

  beginAnimationDisplay() {
    let display_stay = Math.max(this.getOption<number>("animation-display-duration") * 1000, 1000);
    let promise = Promise.resolve();
    let update_data = (resolve) => {
      // 先执行一次 否则刚开始会多停顿 display_stay 的时长
      this.echartsChart.trigger("click", ({
        type: "click",
        componentType: "series.surface",
        seriesIndex: this.selectedIndex.value
      } as any));
      this.selectedIndex.value++;

      this.animation_display_timeout = setInterval(() => {
        if (this.stopAnimate) {
          this.selectedIndex.value = 0;
          clearInterval(this.animation_display_timeout);
          return resolve();
        }
        if(this.animation_display_paused || !this.status.isVisible) return;
        let dataLength = this.datasetSource()?.length || 0;

        if(this.selectedIndex.value > dataLength - 1) {
          this.echartsChart.trigger("click", ({
            type: "click",
            componentType: "series.surface",
            seriesIndex: dataLength - 1
          } as any));
          this.selectedIndex.value = 0;
          clearInterval(this.animation_display_timeout);
          return this.delay(display_stay).then(resolve);
        } else {
          this.echartsChart.trigger("click", ({
            type: "click",
            componentType: "series.surface",
            seriesIndex: this.selectedIndex.value
          } as any));
          this.selectedIndex.value++;
        }
      }, display_stay);
    };
    promise = new Promise((resolve) => {
      update_data(resolve);
    });
    if (promise) {
      this.b2_animators.push(promise);
    }
  }

  restartAnimationDisplay() {
    this.selectedIndex.value = 0;
    this.currentDataLength = this.datasetSource()?.length || 0;
    this.stopAnimationDisplay();
    this.echartsChart.setOption({
      series: this.echartsSeriesOption,
    }, {
      notMerge: false,
      replaceMerge: ["series"],
      lazyUpdate: true
    })
    this.startAnimationDisplay();
  }
}
