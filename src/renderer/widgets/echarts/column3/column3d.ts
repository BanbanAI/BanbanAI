import { DefinedOptions, OptionFontValue, OptionFileValue, OptionFieldValue } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { Widget } from "@renderer/b2/controllers/widget";
import { formatFloat } from "@common/utils/math";
import { TheWidget as Column, component as B2Column } from "@renderer/widgets/echarts/column";
import { SeriesOption, TooltipComponentOption } from "echarts/dist/echarts";
import i18next from "@renderer/widgets/i18next";
import resource from "./locales";
import { recursive } from "merge";

const ANGLE_R = Math.atan(5 / 8) * 180 / Math.PI; // 右侧底边与x轴正方向夹角
const ANGLE_L = Math.atan(5.5 / 7) * 180 / Math.PI; // 左侧底边与x轴负方向夹角

export class Column3 extends Column {
  static resource:any = recursive(true, Column.resource, resource);
  static getSeriesShapeBasicOptions() {
    return [
      {
        name: "series-shape-shadow-color",
        alias: i18next.t("shapeShadowColor"),
        type: "color(gradient)",
        default: "#ffffff00",
      },
      {
        name: "series-shape-shadow-blur",
        alias: i18next.t("shapeShadowBlur"),
        type: "number(unit=px)",
        default: 10,
      },
    ];
  }
  static defineOptions(): DefinedOptions[] {
    return [{
      data: {
        fields: {
          alias: i18next.t("fieldsSetting"),
          fold: "unfold",
          children: [
            {
              name: "axis-group",
              alias: i18next.t("axisGroup"),
              type: "field(recommend=string, min=0, max=1)",
              visible: false,
            }
          ]
        }
      },
      style: {
        "series-color-group": {
          alias: i18next.t("colorGroup"),
          visible: (column3: Column3) => {
            return column3.isDisplaySeriesColor();
          },
          children: [
            {
              name: "series-color-cluster",
              cluster: "array",
              alias: i18next.t("seriesColorCluster"),
              fold: "unfold",
              items: (chart: Column3) => {
                return chart.getSeries().map((series) => series.alias);
              },
              itemsHint: "数据字段",
              children: [
                {
                  name: "series-color2",
                  visible: false
                },
                {
                    name: "column-faces-front-colors",
                    alias: i18next.t("facesFrontColors"),
                    default: [{
                    angle: "0",
                    colors: [
                      {
                        color: "rgb(10, 241, 251)",
                        position: 100
                      },
                      {
                        color: "rgb(11, 147, 255)",
                        position: 0
                      }
                    ]
                  }],
                    type: "palette(gradient)",
                },
                {
                    name: "column-faces-side-colors",
                    alias: i18next.t("facesSideColors"),
                    default: [{
                    angle: "0",
                    colors: [
                      {
                        color: "rgb(11, 138, 180)",
                        position: 0
                      },
                      {
                        color: "rgb(33, 109, 152)",
                        position: 100
                      }
                    ]
                  }],
                    type: "palette(gradient)",
                },
                {
                    name: "column-faces-top-colors",
                    alias: i18next.t("facesTopColors"),
                    default: [{
                    angle: "0",
                    colors: [
                      {
                        color: "rgb(10, 222, 250)",
                        position: 0
                      },
                      {
                        color: "rgb(8, 105, 162)",
                        position: 100
                      }
                    ]
                  }],
                    type: "palette(gradient)",
                },
                {
                  name: "condition-setting",
                  alias: i18next.t("conditionSetting"),
                  type: "boolean",
                  default: false,
                  visible: false
                },
              ]
            },
            {
              name: "highlight-cluster",
              children: [
                {
                  name: "series-hight-color-cluster",
                  cluster: "array",
                  alias: i18next.t("hightColorCluster"),
                  fold: "unfold",
                  items: (chart: Column3) => {
                    return chart.getSeries().map((series) => series.alias);
                  },
                  itemsHint: "数据字段",
                  children: [
                    {
                      name: "series-color",
                      type: "color(gradient)",
                      visible: false
                    },
                    {
                      name: "highlight-border-color",
                      type: "color(gradient)",
                      visible: false
                    },
                    {
                      name: "highlight-border-width",
                      type: "number",
                      visible: false
                    },
                    {
                      name: "highlight-font-color",
                      type: "color(gradient)",
                    },
                    {
                      name: "highlight-font-size",
                      type: "number(unit=px)",
                    },
                    {
                      name: "series-front-color",
                      alias: i18next.t("frontColor"),
                      default: "#1890FF",
                      type: "color(gradient)",
                    },
                    {
                      name: "series-side-color",
                      alias: i18next.t("sideColor"),
                      default: "#1890FF",
                      type: "color(gradient)",
                    },
                    {
                      name: "series-top-color",
                      alias: i18next.t("topColor"),
                      default: "#1890FF",
                      type: "color(gradient)",
                    },
                  ],
                },
              ]
            }
          ]
        },
        "series-shape": {
          children: [
            {
              name: "series-shape-default-cluster",
              children: [
                {
                  name: "shape-column-bargap",
                  visible: false
                },
                {
                  name: "shape-column-width-type",
                  visible: false
                },
                {
                  name: "shape-column-spacing",
                  visible: false,
                },
                {
                  name: "unselected-opacity",
                  alias: i18next.t("unselectedOpacity"),
                  type: "number(unit=%)",
                  default: 30,
                },
                {
                  name: "bar-shape",
                  visible: false,
                },
                {
                  name: "fill-border-radius",
                  visible: false,
                },
                {
                  name: "bar-shape_burst-number",
                  visible: false,
                },
                {
                  name: "shape-background",
                  visible: false,
                },
                {
                  name: "series-shape-type-column-3d",
                  alias: i18next.t("shapeTypeColumn3d"),
                  type: "select(radioGroup)",
                  default: "cuboid",
                  selectChoices: [
                    {
                      value: "cuboid",
                      label: i18next.t("shapeTypeColumn3dCuboid"),
                    },
                    {
                      value: "cylinder",
                      label: i18next.t("shapeTypeColumn3dCylinder"),
                    }
                  ],
                },
                {
                  name: "shape-margin-ratio",
                  alias: i18next.t("shapeMarginRatio"),
                  type: "number(unit=%)",
                  default: 30,
                  visible: (widget: Column3) => {
                    return widget.adjustType() !== "stack";
                  },
                },
                {
                  name: "column-faces-front-color-bg",
                  alias: i18next.t("facesFrontColorBg"),
                  type: "color(gradient)",
                  default: 'rgba(0,0,0,0)',
                },
                {
                  name: "column-faces-side-color-bg",
                  alias: i18next.t("facesSideColorBg"),
                  type: "color(gradient)",
                  default: 'rgba(0,0,0,0)',
                  visible: (widget: Widget) => {
                    return widget.getOption("series-shape-type-column-3d") === "cuboid"
                  },
                },
                {
                  name: "column-faces-top-color-bg",
                  alias: i18next.t("facesTopColorBg"),
                  type: "color(gradient)",
                  default: 'rgba(0,0,0,0)',
                },
                // {
                //   name: "shape-column-number",
                //   visible: false
                // },
                {
                  name: "unit-style-group",
                  alias: i18next.t("unitStyleGroup"),
                  visible: false,
                  children: []
                },
                {
                  name: "shape-column-width",
                  visible: true
                },
                {
                  //边框宽度
                  name: "shape-border-width",
                  visible: false,
                },
                {
                  //图形边框圆角半径
                  name: "shape-border-radius",
                  visible: false,
                },
                {
                  //边框颜色
                  name: "shape-border-color",
                  visible: false,
                },
              ]
            },
            {
              name: "series-shape-top-cluster",
              children: [],
              default: false,
              visible: false,
            },
            {
              name: "series-shape-texture-cluster",
              visible: false,
              children: []
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
                      name: "label-position",
                      default: "outside",
                      selectChoices: [
                        {
                          value: "inside",
                          label: i18next.t("labelPositionInside")
                        },
                        {
                          value: "outside",
                          label: i18next.t("labelPositionOutside")
                        },
                      ]
                    },
                    {
                      name: "label-shape-spacing",
                      alias: i18next.t("labelShapeSpacing"),
                      type: "number(unit=px)",
                      default: 0,
                      visible: (widget: Widget) => {
                        return widget.getOption("label-position") === "outside";
                      },
                    },
                    {
                      name: "label-x",
                      visible:false
                    }
                  ]
                }
              ]
            },
            {
              name: "ranking-cluster",
              visible: false,
              children: []
            }
          ]
        }
      }
    }, ...super.defineOptions()];
  }

  adjustType() {
    return "dodge"
  }

  getColor(index) {
    return index > 9 ? this.defaultColors10[9] : this.defaultColors10[index];
  }

  get column3D(){
    return true;
  }

  get echartsTooltipOption(): TooltipComponentOption | TooltipComponentOption[] {
    let backgroundColor = new Color(this.getOption<Color>("tooltip-background-color")).toCssString();
    let backgroundImage = this.getOption<OptionFileValue>("tooltip-background-image");
    let paddingWidth = this.getOption<number>("tooltip-padding-width");
    let paddingHeight = this.getOption<number>("tooltip-padding-height");
    let radius = this.getOption<number>("tooltip-radius");
    let showIcon = this.getOption<boolean>("tooltip-icon");

    let nameFontColor = new Color(this.getOption<Color>("tooltip-name-font-color")).hexa();
    let nameFontSize = this.getOption<number>("tooltip-name-font-size");
    let valueFontColor = new Color(this.getOption<Color>("tooltip-value-font-color")).hexa();
    let valueFontSize = this.getOption<number>("tooltip-value-font-size");
    let showTitle = this.getOption<boolean>("tooltip-title");
    let titleFontColor = new Color(this.getOption<Color>("tooltip-title-font-color")).hexa();
    let titleFontSize = this.getOption<number>("tooltip-title-font-size");

    const seriesCssColors = this.getSeriesColumnFacesColors();

    let tooltipStyle = this.getOption("tooltip-text-type");
    let tooltipDecimalPlaces = this.getOption<number>("tooltip-decimal-places");
    let tooltipCompleteZero = this.getOption<boolean>("tooltip-complete-zero");
    let commaDisplay = this.getOption<boolean>("tooltip-comma-display")
    let lineDimensions = this.getOption<OptionFieldValue[]>("axis-line") || [];
    let valueDims = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let tooltipRightStyle = this.getOption("tooltip-right-text-type");
    let tooltipRightDecimalPlaces = this.getOption<number>("tooltip-right-decimal-places");
    let tooltipRightCompleteZero = this.getOption<boolean>("tooltip-right-complete-zero");
    let tooltipShowUnit = this.getOption<boolean>("tooltip-unit-name")
    let tooltipShowUnitColor = new Color(this.getOption<Color>("tooltip-unit-color")).hexa()
    let tooltipShowUnitSize = this.getOption("tooltip-unit-size")
    let tooltipUnitY = this.getOption("tooltip-unit-y")
    let tooltipUnitYRight = this.getOption("tooltip-unit-yRight")
    let lineUids:any = lineDimensions?.map((item)=>item.uid[2]);
    let yUids = valueDims?.map(item=>item.uid[2]) || []

    if(lineUids?.length){
      yUids = [...yUids,...lineUids]
    }
    lineUids.push("line_data");

    let tooltipOption  =  super.echartsTooltipOption
    tooltipOption.formatter = (params) => {
      let dataHtml = "";
      let seriesNameSet = new Set();
      for (let param of params || []) {
        if (seriesNameSet.has(param.seriesName)) continue;
        // 根据seriesName中的'__$'筛选要显示在提示框上的信息
        if (param.seriesName.includes("__$") || param.seriesName.includes("-bg") || param.seriesName.includes("topShape")) continue;
        let colorIndex = this.xTypes.length ? this.xTypes.indexOf(param.seriesName) : yUids.indexOf(param.seriesId.split('-')[0]);
        let iconColor = seriesCssColors[colorIndex];
        if (Array.isArray(iconColor)) {
          iconColor = iconColor[0];
        }

        let iconHtml = showIcon ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${iconColor};"></span>` : "";

        let valueUid = param.dimensionNames[param.encode.y[0]];
        if (this.transposed) {
          valueUid = param.dimensionNames[param.encode.x[0]];
        }
        let val = param.value[valueUid];
        if (isNaN(val)) continue;
        if (lineUids.includes(valueUid)) {
          if (tooltipRightStyle === "normal") {
            val = formatFloat(val, tooltipRightDecimalPlaces, tooltipRightCompleteZero);
          } else if (tooltipRightStyle === "percent") {
            val = formatFloat(val * 100, tooltipRightDecimalPlaces, tooltipRightCompleteZero) + "%";
          }
        } else {
          if (tooltipStyle === "normal") {
            val = formatFloat(val, tooltipDecimalPlaces, tooltipCompleteZero);
          } else if (tooltipStyle === "percent") {
            val = formatFloat(val * 100, tooltipDecimalPlaces, tooltipCompleteZero) + "%";
          }
        }
        if (commaDisplay) {
          val = this.doCommaSeparat(val)
        }
        dataHtml += lineUids.includes(valueUid) ?
          `<div>
          ${iconHtml}
          <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${param.seriesName}：</span>
          <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${val}</span>
          <span style="visibility:${tooltipShowUnit ? "visible" : "hidden"}; color:${tooltipShowUnitColor};font-size:${tooltipShowUnitSize}px;line-height:1;">${tooltipUnitYRight}</span>
        </div>` :
          `<div>
          ${iconHtml}
          <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${param.seriesName}：</span>
          <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${val}</span>
          <span style="visibility:${tooltipShowUnit ? "visible" : "hidden"}; color:${tooltipShowUnitColor};font-size:${tooltipShowUnitSize}px;line-height:1;">${tooltipUnitY}</span>
        </div>`;
        seriesNameSet.add(param.seriesName);
      }
      let titleNameUid = this.transposed ? params[0].dimensionNames[params[0].encode['y'][0]] : params[0].dimensionNames[params[0].encode['x'][0]]
      let titleHtml = showTitle ? `<div>
        <span style="color:${titleFontColor};font-size:${titleFontSize}px;line-height:1;">${params[0]?.value[titleNameUid]}</span>
      </div>` : "";

      let paddingStyle = "0";
      if (titleHtml || dataHtml) {
        paddingStyle = `${paddingHeight}px ${paddingWidth}px`;
      }
      return `
        <div style="padding: ${paddingStyle};">
          ${titleHtml}
          <div>${dataHtml}</div>
        </div>
      `;
    }

    return tooltipOption

  }

  getSeriesColors() {
    let series_colors_arr = [];
    let series = this.getSeries();
    const indexes = this.getArrayClusterIndexes(["series-color-cluster"]);
    for (let i = 0; i < series.length; i++) {
      let cuboid_colors = {};
      let cuboid_fases = ["front", "side", "top"];
      let cuboid_colors_arr = {};
      for (let j = 0; j < 3; j++) {
        let color_info: any = {};
        //颜色组
        color_info.colors = this.getOption(["series-color-cluster", indexes[i], "column-faces-" + cuboid_fases[j] + "-colors"]);
        cuboid_colors_arr[cuboid_fases[j]] = [];
        color_info.colors.forEach(color=>{
          cuboid_colors_arr[cuboid_fases[j]].push(this.toEchartsColor(color));
        })


        cuboid_colors[cuboid_fases[j]] = color_info;
      }
      series_colors_arr.push(cuboid_colors_arr)
    }
    return [].concat(series_colors_arr);
  }

  isDisplaySeriesColor() {
    let xDimensions = this.getOption<OptionFieldValue[]>("axis-x") || [];
    let yDimensions = this.getOption<OptionFieldValue[]>("axis-y") || [];
    if (xDimensions.length > 0 && yDimensions.length > 0) {
      return true;
    }
    return false;
  }

  getSeriesHightColors() {
    let strColors = [];
    let series = this.getSeries();
    const indexes = this.getArrayClusterIndexes(["series-hight-color-cluster"]);
    for (let i = 0; i < series.length; i++) {
      let frontColor = this.getOption<Color>(["series-hight-color-cluster", indexes[i], "series-front-color"]);
      let sideColor = this.getOption<Color>(["series-hight-color-cluster", indexes[i], "series-side-color"]);
      let topColor = this.getOption<Color>(["series-hight-color-cluster", indexes[i], "series-top-color"]);
      let colors = {
        front: this.toEchartsColor(frontColor as Color),
        side: this.toEchartsColor(sideColor as Color),
        top: this.toEchartsColor(topColor as Color)
      }
      strColors.push(colors);
    }
    return [].concat(strColors);
  }

  getSeriesHightBorderColors() {
    let strColors = [];
    let series = this.getSeries();
    const indexes = this.getArrayClusterIndexes(["series-hight-color-cluster"]);
    for (let i = 0; i < series.length; i++) {
      let color = this.getOption<Color>(["series-hight-color-cluster", indexes[i], "highlight-border-color"]);
      strColors.push(this.toEchartsColor(color as Color));
    }
    if (strColors.length == 0) {
      strColors = this.defaultColors10;
    }
    return [].concat(strColors);
  }

  getSeriesHightFonts() {
    let strColors = [];
    let series = this.getSeries();
    const indexes = this.getArrayClusterIndexes(["series-hight-color-cluster"]);
    for (let i = 0; i < series.length; i++) {
      let color, size;
      if(this.getOption("highlight")) {
        color = this.getOption<Color>(["series-hight-color-cluster", indexes[i], "highlight-font-color"]);
        size = this.getOption<number>(["series-hight-color-cluster", indexes[i], "highlight-font-size"]);
      } else {
        color = this.getOption<OptionFontValue>("label-font").color;
        size = this.getOption<OptionFontValue>("label-font").size;
      }
      strColors.push({
        color: this.toEchartsColor(color as Color),
        size: size
      })
    }

    return [].concat(strColors);
  }

  getSeriesColumnFacesColors() {
    let strColors = [];
    let series = this.getSeries();
    const indexes = this.getArrayClusterIndexes(["series-color-cluster"]);
    for (let i = 0; i < series.length; i++) {
      let color = this.getOption<Color | Color[]>(["series-color-cluster", indexes[i], "column-faces-front-colors"]);
      if(Array.isArray(color)){
        strColors.push(Array.from(color).map((item) => { return new Color(item).toCssString() }));
      }else{
        strColors.push([new Color(color).toCssString()]);
      }
    }
    if (strColors.length == 0) {
      strColors = this.defaultColors10;
    }
    return [].concat(strColors);
  }

  getSeriesCssColors() {
    let series_colors = [];
    let series = this.getSeries();
    const indexes = this.getArrayClusterIndexes(["series-color-cluster"]);
    for (let i = 0; i < series.length; i++) {
      let frontColor:any = this.getOption(["series-color-cluster", indexes[i], "column-faces-front-colors"]) || undefined;
      let frontColorArr = [];
      frontColor?.forEach(color=>{
        frontColorArr.push(this.toEchartsColor(color));
      })
      series_colors.push(frontColorArr);
    }
    if (series_colors.length == 0) {
      series_colors = ["rgb(10, 241, 251)"]
    }
    return [].concat(series_colors);
  }

  getLegendOtherOption():any {
    let xDims = this.getOption<OptionFieldValue[]>("axis-x") || [];
    let yDims = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let groupDims = this.getOption<OptionFieldValue[]>("axis-group") || [];
    let hasGroup = groupDims.length > 0;
    let lineNum = hasGroup ? this.xTypes.length : yDims.length;
    let data = [];

    for (let i = 0; i < lineNum; i++) {
      data.push({ name: hasGroup ? this.xTypes[i] : this.getFieldAlias(yDims[i].uid), itemStyle: { color: this.getSeriesColors()[i]?.front?.[0] } })
    }
    return {
      data: data
    }
  }

  addEchartsShapes(echarts) {
    // 绘制左侧面
    let that = this;
    const CubeFront = echarts.graphic.extendShape({
      buildPath: function (ctx, shape) {
        const xAxisPoint = shape.xAxisPoint;
        const diffXL = (shape.shapeWidth - 10) * Math.cos(ANGLE_L);
        const diffYL = (shape.shapeWidth - 10) * Math.sin(ANGLE_L);
        const startPoint = shape.x - 6 + shape.offsetX; // c3的位置一直保持不变
        let aboveY = shape.y;
        let underY = xAxisPoint[1];
        let c0, c1, c2, c3;
        if (shape.background) {
          if (shape.adjustType === "stack" && shape.index !== 0) return;
          let yMin = that.getOption<string>("padding-top") === "diy" ? that.getOption<number>("padding-top-diy") + 40 : 50;
          c0 = [startPoint, yMin];//右上角
          c1 = [startPoint - 7 - diffXL, yMin - 5 - diffYL];//左上角
          c2 = [startPoint - 7 - diffXL, aboveY - 5 - diffYL];//左下角
          c3 = [startPoint, aboveY];//右下角
        } else {
          // 堆叠的情况需要加上前面的高度
          if (shape.lastHeight) {
            if (shape.yValue < 0) {
              aboveY += shape.lastHeight;
              underY += shape.lastHeight;
            } else {
              aboveY -= shape.lastHeight;
              underY -= shape.lastHeight;
            }
          }
          c0 = [startPoint, aboveY];//右上角
          c1 = [startPoint - 7 - diffXL, aboveY - 5 - diffYL];//左上角
          c2 = [startPoint - 7 - diffXL, underY - 5 - diffYL];//左下角
          c3 = [startPoint, underY];//右下角
        }
        ctx.moveTo(c0[0], c0[1]).lineTo(c1[0], c1[1]).lineTo(c2[0], c2[1]).lineTo(c3[0], c3[1]).closePath();
      },
    });

    // 绘制右侧面
    const CubeSide = echarts.graphic.extendShape({
      buildPath: function (ctx, shape) {
        const xAxisPoint = shape.xAxisPoint;
        const diffXR = (shape.shapeWidth - 10) * Math.cos(ANGLE_R);
        const diffYR = (shape.shapeWidth - 10) * Math.sin(ANGLE_R);
        const startPoint = shape.x - 6 + shape.offsetX;
        let aboveY = shape.y;
        let underY = xAxisPoint[1];
        let c0, c3, c4, c5;
        if (shape.background) {
          if (shape.adjustType === "stack" && shape.index !== 0) return;
          let yMin = that.getOption<string>("padding-top") === "diy" ? that.getOption<number>("padding-top-diy") + 40 : 50;
          const startPoint = shape.x - 6 + shape.offsetX;
          c0 = [startPoint, yMin];//左上
          c3 = [startPoint, aboveY];//左下
          c4 = [startPoint + 8 + diffXR, aboveY - 5 - diffYR];//右下
          c5 = [startPoint + 8 + diffXR, yMin - 5 - diffYR];//右上
        } else {
          if (shape.lastHeight) {
            if (shape.yValue < 0) {
              aboveY += shape.lastHeight;
              underY += shape.lastHeight;
            } else {
              aboveY -= shape.lastHeight;
              underY -= shape.lastHeight;
            }
          }
          c0 = [startPoint, aboveY];//左上
          c3 = [startPoint, underY];//左下
          c4 = [startPoint + 8 + diffXR, underY - 5 - diffYR];//右下
          c5 = [startPoint + 8 + diffXR, aboveY - 5 - diffYR];//右上
        }
        ctx.moveTo(c0[0], c0[1]).lineTo(c3[0], c3[1]).lineTo(c4[0], c4[1]).lineTo(c5[0], c5[1]).closePath();
      },
    });

    // 绘制顶面
    const CubeTop = echarts.graphic.extendShape({
      buildPath: function (ctx, shape) {
        const diffXR = (shape.shapeWidth - 10) * Math.cos(ANGLE_R);
        const diffYR = (shape.shapeWidth - 10) * Math.sin(ANGLE_R);
        const diffXL = (shape.shapeWidth - 10) * Math.cos(ANGLE_L);
        const diffYL = (shape.shapeWidth - 10) * Math.sin(ANGLE_L);
        const startPoint = shape.x - 6 + shape.offsetX;
        let aboveY = shape.y;
        let c0, c5, c6, c1;
        if (shape.background) {
          if (shape.adjustType === "stack" && shape.index !== 0) return;
          let yMin = that.getOption<string>("padding-top") === "diy" ? that.getOption<number>("padding-top-diy") + 40 : 50;
          const startPoint = shape.x - 6 + shape.offsetX;
          c0 = [startPoint, yMin];//下
          c5 = [startPoint + 8 + diffXR, yMin - 5 - diffYR]; //右点
          c6 = [startPoint + 1 + diffXR - diffXL, yMin - 10 - diffYL - diffYR];//上
          c1 = [startPoint - 7 - diffXL, yMin - 5 - diffYL];//左
        } else {
          if (shape.lastHeight) {
            if (shape.yValue < 0) {
              aboveY += shape.lastHeight;
            } else {
              aboveY -= shape.lastHeight;
            }
          }
          c0 = [startPoint, aboveY];//下
          c5 = [startPoint + 8 + diffXR, aboveY - 5 - diffYR]; //右点
          c6 = [startPoint + 1 + diffXR - diffXL, aboveY - 10 - diffYL - diffYR];//上
          c1 = [startPoint - 7 - diffXL, aboveY - 5 - diffYL];//左
        }
        if (c0[1] > shape.xAxisPoint[1]) { // 负值
          c0[1] = shape.xAxisPoint[1];
          c5[1] = shape.xAxisPoint[1] - 5 - diffYR;
          c6[1] = shape.xAxisPoint[1] - 10 - diffYL - diffYR;
          c1[1] = shape.xAxisPoint[1] - 5 - diffYL;
        }
        ctx.moveTo(c0[0], c0[1]).lineTo(c5[0], c5[1]).lineTo(c6[0], c6[1]).lineTo(c1[0], c1[1]).closePath();
      },
    });

    // 注册立方体三个面图形
    echarts.graphic.registerShape('CubeFront', CubeFront);
    echarts.graphic.registerShape('CubeSide', CubeSide);
    echarts.graphic.registerShape('CubeTop', CubeTop);

    // 注册圆柱正面图形
    const Cylinder = echarts.graphic.extendShape({
      buildPath: function (ctx, shape) {
        if (shape.adjustType === "stack" && shape.background && shape.index !== 0) return;
        let yMin = that.getOption<string>("padding-top") === "diy" ? that.getOption<number>("padding-top-diy") + 40 : 50;
        let aboveY = shape.y;
        let firstDiffY = shape.adjustType === "stack" ? shape.shapeWidth / 4 : 0;

        let endY = shape.xAxisPoint[1];
        if (shape.background) {
          aboveY = yMin;
        } else {
          if (shape.lastHeight) {
            if (shape.yValue < 0) {
              aboveY += shape.lastHeight;
              endY += shape.lastHeight;
            } else {
              aboveY -= shape.lastHeight;
              endY -= shape.lastHeight;
            }
          }
        }

        const startX = shape.x + shape.offsetX;
        const c0 = [startX, aboveY - firstDiffY]; // 左上
        const c1 = [startX, endY - firstDiffY]; // 左下
        const c2 = [startX + shape.shapeWidth, aboveY - firstDiffY];//右上
        const c3 = [startX + shape.shapeWidth, endY - firstDiffY];//右下

        let offsetX = shape.shapeWidth;
        let offsetY = shape.shapeWidth / 3;
        // 顶面以外部分
        ctx.beginPath();
        ctx.moveTo(c0[0], c0[1]).lineTo(c1[0], c1[1]);
        ctx.bezierCurveTo(c1[0], c1[1] + offsetY + 1, c1[0] + offsetX, c1[1] + offsetY + 1, c1[0] + offsetX, c1[1]);
        ctx.lineTo(c2[0], c2[1]);
        ctx.bezierCurveTo(c2[0], c2[1] + offsetY, c2[0] - offsetX, c2[1] + offsetY, c2[0] - offsetX, c2[1]);
        ctx.lineTo(c0[0], c0[1]).closePath();
      },
    });
    echarts.graphic.registerShape('Cylinder', Cylinder);
  }

  clearChart() {
    this.echartsChart.clear();
  }

  // 计算custom图形文本偏移
  handleCustomLabelOffset = (text, font = 'normal 12px sans-serif') => {
    let _canvas = document.createElement('canvas');
    const _context = _canvas.getContext('2d');
    _context.font = font;
    let fontWidth = _context.measureText(text);
    _canvas.remove();
    return fontWidth;
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
    let labelPosition = this.getOption<any>("label-position");
    let seriesOpt = [];
    let seriesColor = this.getSeriesColors();
    let unselectOpacity = Math.min(Math.max(this.getOption<number>("unselected-opacity") / 100, 0), 1);
    let highlight = this.getOption("highlight");
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
    let scaleRange = this.getOption("y-scale-range");
    let yScaleMin = this.getOption("y-scale-min");

    if (!xDims?.length || !yDims?.length) {
      let index = 0;
      let shapeType = this.getOption("series-shape-type-column-3d");
      //示例数据
      seriesOpt.push({
        name: "value",
        id: "demo-column3D",
        type: "custom",
        barWidth: shapeColumnWidth,
        label: {
          show: this.getOption("label"),
          position: labelPosition,
        },
        barGap: "30%",
        markLine: this.markLineOption,
        renderItem: (params, api) => {

          let xValue = api.value(1);
          let yValue = api.value(0);
          const location = api.coord([params.dataIndex, yValue]);

          let label = yValue;
          if (!isPercent) {
            label = formatFloat(label as number, labelDecimalPlaces, isComplete);
          } else {
            label = formatFloat(label as number * 100, labelDecimalPlaces, isComplete) + "%";
          }

          let isUnselected = this.selectedIndex.value === -1 || this.selectedIndex.value !== params.dataIndex;

          let shapeOpt = {
            api,
            xValue: xValue,
            yValue: yValue,
            x: shapeType === "cylinder" ? location[0] - shapeColumnWidth / 2 : location[0],
            y: location[1],
            shapeWidth: shapeColumnWidth,
            xAxisPoint: api.coord([xValue, 0]),
            shapeSpace,
            offsetX: 0,
            offsetY: 0,
            index
          }
          let textFill;
          if(isUnselected || !highlight) {
            textFill = colorFollow ? seriesColor[index] : this.toEchartsColor(labelFont.color as Color);
          } else {
            textFill = this.toEchartsColor(highlightFonts[params.seriesIndex].color);
          }
          let styleOpt = {
            textFill: textFill,
            text: showLabel ? label : "",
            textStroke: "rgba(0, 0, 0, 0)",
            fontSize: (isUnselected || !highlight) ? labelFont.size : highlightFonts[params.seriesIndex].size,
            fontWeight: labelFont.bold ? "bold" : "normal",
            fontStyle: labelFont.italic ? "italic" : "normal",
            fontFamily: labelFont.family,
            textPosition: "inside",
            textAlign: "center",
            textVerticalAlign: "middle"
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
                ...styleOpt,
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
            }]
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
            return this.getSeriesColors()[params.seriesIndex]
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
          barGap: "30%",
          id:`${hasGroup ? yDims[0].uid[2] + index: yDims[index].uid[2]}-column3D`,
          barWidth: shapeColumnWidth,
          showBackground: true,
          selectedMode: "single",
          markLine: this.markLineOption,
          renderItem: (params, api) => {
            let xValue = api.value(params.encode.x);
            let yValue = hasGroup ? api.value(1) : api.value(params.encode.y);
            const location = api.coord([xValue, yValue]);
            let label = yValue;
            if (!isPercent) {
              label = formatFloat(label, labelDecimalPlaces, isComplete);
            } else {
              label = formatFloat(label * 100, labelDecimalPlaces, isComplete) + "%";
            }
            let isUnselected = this.selectedIndex.value !== params.dataIndex;

            let frontColor = seriesColor[index]["front"][params.dataIndex] || seriesColor[index]["front"][seriesColor[index]["front"].length-1]
            let sideColor = seriesColor[index]["side"][params.dataIndex] || seriesColor[index]["side"][seriesColor[index]["side"].length-1]
            let topColor = seriesColor[index]["top"][params.dataIndex] || seriesColor[index]["top"][seriesColor[index]["top"].length-1]

            if(!isUnselected && highlight && this.selectedIndex.value !== -1) {
              frontColor = this.getSeriesHightColors()?.[index]?.front || frontColor;
              sideColor = this.getSeriesHightColors()?.[index]?.side || sideColor;
              topColor = this.getSeriesHightColors()?.[index]?.top || topColor;
            }
            const totalNum = api.currentSeriesIndices().length;
            const layout = api.barLayout({ barGap: shapeSpace, count: totalNum })[index];
            const offsetX = totalNum === 1 ? 0 : layout.offsetCenter;
            let xAxisPoint = scaleRange === "custom" ? api.coord([xValue, yScaleMin]) : api.coord([xValue, 0]);
            let shapeOpt = {
              api,
              xValue: xValue,
              yValue: yValue,
              x: shapeType === "cylinder" ? location[0] - shapeColumnWidth / 2 : location[0] + shapeColumnWidth/2,
              y: location[1],
              shapeWidth: Number(shapeColumnWidth),
              xAxisPoint,
              shapeSpace,
              offsetX,
              index
            }

            let textFill;
            if(isUnselected || !highlight) {
              textFill = colorFollow ? seriesColor[index] : this.toEchartsColor(labelFont.color as Color);
            } else {
              textFill = this.toEchartsColor(highlightFonts[params.seriesIndex].color);
            }

            let styleOpt = {
              opacity: isUnselected && this.selectedIndex.value !== -1 ? unselectOpacity : 1,
              textFill: textFill,
              text: showLabel ? label : "",
              textStroke: "rgba(0, 0, 0, 0)",
              fontSize: (isUnselected || !highlight) ? labelFont.size : highlightFonts[params.seriesIndex].size,
              fontWeight: labelFont.bold ? "bold" : "normal",
              fontStyle: labelFont.italic ? "italic" : "normal",
              fontFamily: labelFont.family,
              textPosition: "inside",
              textAlign: "center",
              textVerticalAlign: "middle"
            }

            let yMin = this.getOption<string>("padding-top") === "diy" ? this.getOption<number>("padding-top-diy") + 40 : 50;
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
                    cy: yMin,
                    r: shapeColumnWidth / 2,
                  },
                  originY: yMin,
                  scaleY: 0.5,
                  style: {
                    fill: topBgColor,
                    opacity: isUnselected && this.selectedIndex.value !== -1 ? unselectOpacity : 1,
                  }
                },
                {
                  type: "Cylinder",
                  shape: shapeOpt,
                  style: labelPosition === "outside" ? {
                    fill: frontColor,
                    opacity: isUnselected && this.selectedIndex.value !== -1 ? unselectOpacity : 1
                  } : {
                    fill: frontColor,
                    ...styleOpt,
                  }
                }, {
                  type: "circle",
                  shape: {
                    cx: location[0] + offsetX,
                    cy: location[1] > xAxisPoint[1] ? xAxisPoint[1] + 2 : location[1] + 2,
                    r: shapeColumnWidth / 2,
                  },
                  originY: location[1] > xAxisPoint[1] ? xAxisPoint[1] : location[1],
                  scaleY: 0.5,
                  style: labelPosition === "outside" ? {
                    fill: topColor,
                    ...styleOpt,
                    textPosition: ['50%', 15 - labelSpace],
                  } : {
                    fill: topColor,
                    opacity: isUnselected && this.selectedIndex.value !== -1 ? unselectOpacity : 1
                  }
                },
                {
                  type: "text",
                  style: labelPosition === "outside" ? {
                    text: unit,
                    fill: unitFont.color,
                    x: location[0] + offsetX + this.handleCustomLabelOffset(label)?.width/2 + 2,
                    y: location[1] > xAxisPoint[1] ? xAxisPoint[1] + 2 : location[1]+ 13 - labelSpace,
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
                style: labelPosition === "outside" ? {
                  fill: frontColor,
                  opacity: isUnselected && this.selectedIndex.value !== -1 ? unselectOpacity : 1
                } : {
                  fill: frontColor,
                  ...styleOpt
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
                style: labelPosition === "outside" ? {
                  fill: topColor,
                  ...styleOpt,
                  textPosition: ['50%', 15 - labelSpace],
                } : {
                  fill: topColor,
                  opacity: isUnselected && this.selectedIndex.value !== -1 ? unselectOpacity : 1,
                },
              }, {
                type: 'CubeFront',
                shape: {
                  ...shapeOpt,
                  background: true
                },
                style: {
                  fill: frontBgColor,
                  opacity: isUnselected && this.selectedIndex.value !== -1 ? unselectOpacity : 1,
                }
              }, {
                type: 'CubeSide',
                shape: {
                  ...shapeOpt,
                  background: true
                },
                style: {
                  fill: sideBgColor,
                  opacity: isUnselected && this.selectedIndex.value !== -1 ? unselectOpacity : 1,
                }
              }, {
                type: 'CubeTop',
                shape: {
                  ...shapeOpt,
                  background: true
                },
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
                  y: location[1] > xAxisPoint[1] ? xAxisPoint[1] + 2 : location[1] + 5 - labelSpace,
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
    return seriesOpt;
  }

  initEchartsEvents() {
    this.echartsChart.off("click");
    this.echartsChart.on("click", { element: "columnGroup" }, (ev) => {
      if (this.selectedIndex.value === ev.dataIndex) {
        this.selectedIndex.value = -1;
        this.echartsChart.setOption({ series: this.echartsSeriesOption });
        this.selectedData.value = {};
        this.withdrawLinkage();
      } else {
        let x_uid = this.getOption("axis-x")?.[0]?.uid;
        let y_uid = this.getOption("axis-y")?.[ev.seriesIndex]?.uid;
        this.selectedIndex.value = ev.dataIndex;
        this.selectedData.value = {
          xVal: x_uid ? ev.data[x_uid[2]] : "",
          yVal: y_uid ? ev.data[y_uid[2]] : "",
        }
        this.echartsChart.setOption({ series: this.echartsSeriesOption });
        let xDims = this.getOption<OptionFieldValue[]>("axis-x");
        if (xDims?.length) {
          let xUid = xDims[0].uid;
          this.applyLinkage({ uid: xUid, value: ev.data[xUid[2]] });
        }
      }
    })
  }

  carouselAnimationDisplay() {
    let that = this;
    let display_stay = Math.max(this.getOption<number>("animation-display-stay-column-carousel") * 1000, 1000);
    let x_uid = this.getOption("axis-x")?.[0]?.uid;
    let y_uid = this.getOption("axis-y")?.[0]?.uid;
    let promise = Promise.resolve();
    let currentIndex = this.echartsChart.getOption().dataZoom[0].startValue;
    let update_data = (resolve) => {
      if(this.resetSelectedIndex.value){
        this.resetSelectedIndex.value = !this.resetSelectedIndex.value
        currentIndex = 0;
      }
      // 先执行一次 否则刚开始会多停顿 display_stay 的时长
      let linkages = [];
      that.echartsChart.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: currentIndex });
      that.selectedIndex.value = currentIndex;
      that.echartsChart.setOption({ series: that.echartsSeriesOption });
      if (x_uid && currentIndex > -1) {
        let targetData = that.echartsChart.getOption().dataset[0].source[currentIndex];
        if(targetData) {
          linkages.push({ uid: x_uid, value: targetData[x_uid[2]] });
          that.selectedData.value = {
            xVal: targetData[x_uid[2]],
            yVal: y_uid ? targetData[y_uid[2]] : null
          }
          that.animationTriggerLinkage && that.applyLinkage(linkages);
        }
      }
      currentIndex++;

      that.animation_display_timeout = setInterval(() => {
        if(currentIndex === this.datasetSource()?.length){
          currentIndex = 0
        }
        if(this.resetSelectedIndex.value){
          this.resetSelectedIndex.value = !this.resetSelectedIndex.value
          currentIndex = 0;
        }
        if (that.stopAnimate) {
          clearInterval(that.animation_display_timeout);
          that.echartsChart.dispatchAction({ type: 'hideTip' });
          return resolve();
        }
        if (that.animation_display_paused) return;

        //选中当前
        let linkages = [];
        that.echartsChart.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: currentIndex });
        that.selectedIndex.value = currentIndex;
        that.echartsChart.setOption({ series: that.echartsSeriesOption });
        if (x_uid && currentIndex > -1) {
          let targetData = that.echartsChart.getOption().dataset[0].source[currentIndex];
          if(targetData) {
            linkages.push({ uid: x_uid, value: targetData[x_uid[2]] });
            that.selectedData.value = {
              xVal: targetData[x_uid[2]],
              yVal: targetData[y_uid[2]]
            }
            that.animationTriggerLinkage && that.applyLinkage(linkages);
          }
        }

        if (currentIndex > that.echartsChart.getOption().dataZoom[0].endValue) {
          currentIndex = that.echartsChart.getOption().dataZoom[0].startValue;
          clearInterval(that.animation_display_timeout);
          //全部取消选中
          that.echartsChart.dispatchAction({ type: 'hideTip' });
          if (that.getOption(["animation-display-loop"]) && that.getOption<number>(["animation-display-interval"]) <= 0) {
            // 开了轮播且间隔0秒，直接切回第一个，否则会因为异步造成闪烁
            that.selectedIndex.value = currentIndex;
          } else {
            that.selectedIndex.value = -1;
          }
          that.echartsChart.setOption({ series: that.echartsSeriesOption });
          that.animationTriggerLinkage && that.withdrawLinkage();
          resolve();
        } else {
          currentIndex++;
        }
      }, display_stay);
    };
    promise = new Promise((resolve) => {
      update_data(resolve);
    });
    return promise
  }
}
