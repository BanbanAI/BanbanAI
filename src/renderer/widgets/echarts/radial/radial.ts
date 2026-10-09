import { PrivateData, PrivateDataConnectionUID, PrivateDataTableUID, OptionFieldUID } from "@common/types/project";
import { DefinedOptions, OptionFontValue, OptionFileValue, OptionFieldValue, ChartClickState } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { OptionValue } from "@common/types/project";
import { formatFloat } from "@common/utils/math";
import { TheWidget as Axis, component as B2Axis } from "@renderer/widgets/echarts/axis";
import { TooltipComponentOption, XAXisComponentOption, YAXisComponentOption, SeriesOption, EChartsOption, RadiusAxisComponentOption, AngleAxisComponentOption } from "echarts/dist/echarts";
import i18next from "@renderer/widgets/i18next";
import { Ref, ref, watch } from "vue";
import { recursive } from "merge";
import  resource  from "./locales"
export class Radial extends Axis {
  public animationSelectedIndex = ref(0);
  static resource = recursive(true, Axis.resource, resource);
  static defineOptions(): DefinedOptions[] {
    return [
      {
        data: {
          fields: {
            children: [
              {
                name: "axis-x",
                default: [{ "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_1"], "__opt_type": "field", "summary": "" }]
              },
              {
                name: "axis-y",
                default: [{ "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_2"], "__opt_type": "field", "summary": "sum" }]
              },
            ]
          }
        },
        style: {
          "series-color": {
            alias: i18next.t("series-color"),
            visible: true,
            children: [
              {
                alias: i18next.t("palette"),
                name: "palette",
                type: "palette(gradient)",
                default: (widget: Radial | any) => { return widget.defaultColors10 },
              },
              {
                alias: i18next.t("selected-color"),
                name: "selected-color",
                type: "color(gradient)",
                default: "#F6DAB5FF"
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
                    visible: false,
                  },
                  {
                    name: "x-line-cluster",
                    visible: false,
                    children: []
                  },
                  {
                    name: "x-tickline-cluster",
                    visible: false,
                    children: []
                  },
                  {
                    name: "x-label-cluster",
                    children: [
                      {
                        name: "x-show-all-label",
                        visible: false
                      },
                    ]
                  },
                  {
                    name: "x-unit-cluster",
                    visible: false,
                    children: []
                  },
                ]
              },
              {
                name: "y-display-cluster",
                children: [
                  {
                    name: "y-data-type",
                    visible: false,
                  },
                  {
                    name: "y-line-cluster",
                    visible: false,
                    children: []
                  },
                  {
                    name: "y-tickline-cluster",
                    visible: false,
                    children: []
                  },
                  {
                    name: "y-unit-cluster",
                    visible: false,
                    children: []
                  },
                  {
                    name: "y-label-cluster",
                    children: [
                      {
                        name: "y-value-abbreviation",
                        visible: false
                      },
                      {
                        name: "y-rotate",
                        visible: false
                      }
                    ]
                  },

                  {
                    name: "y-grid-cluster",
                    visible: false,
                    children: []
                  },
                ]
              }
            ]
          },
          shape: {
            after: "y-display",
            alias: i18next.t("shape"),
            children: [
              {
                name: "angle-start",
                default: 90,
                type: "number(min=-180, max=180, step=1, showInput,unit=°)",
                alias: i18next.t("angle-start"),
              },
              {
                name: "angle-end",
                default: 180,
                type: "number(min=-180, max=180, step=1, showInput,unit=°)",
                alias: i18next.t("angle-end"),
                visible: false
              },
              {
                name: "inner-radius",
                default: 30,
                type: "number(min=0, max=75, step=1, showInput,unit=%)",
                alias: i18next.t("inner-radius"),
              },
              {
                name: "outer-radius",
                default: 80,
                type: "number(min=50, max=90, step=1, showInput, unit=%)",
                alias: i18next.t("outer-radius"),
              },
              {
                name: "shape-column-width",
                type: "number(min=0, unit=px)",
                alias: i18next.t("shape-column-width"),
                default: 20,
              },
              {
                name: "rotation-direction",
                type: "select(multiple)",
                selectChoices: [
                  {
                    value: "clockwise",
                    label: i18next.t("clockwise"),
                  },
                  {
                    value: "anticlockwise",
                    label: i18next.t("anticlockwise"),
                  },
                ],
                default: "clockwise",
                visible: false,
              },
              {
                alias: i18next.t("shape-background"),
                name: "shape-background",
                type: "color(gradient)",
                default: "#eeeeee00",
                visible: false,
              },
              {
                name: "radial-point-enabled",
                default: false,
                type: "boolean",
                alias: i18next.t("radial-point-enabled"),
              },
              {
                name: "radial-point-radius",
                alias: i18next.t("radial-point-radius"),
                default: 5,
                visible: (radial: Radial) => {
                  return radial.getOption("radial-point-enabled") === true;
                },
                type: "number(unit=px, min=0)",
              },
            ],
          },
          "series-shape": {
            visible: false,
          },
          "slider-display": {
            visible: false,
          },
          "annotation-line": {
            visible: false,
          },
          "label-group": {
            default: false,
            visible: false,
          },
          "animate-show-duration": {
            visible: false,
          },
          "table-animate-show-duration": {
            visible: false,
          },
          "animate-show-delay": {
            visible: false,
          },
          "series-color-group": {
            visible: false,
          },
          tooltip:{
            children:[
              {
                name: "tooltip-unit-setName",
                alias: i18next.t("tooltipUnitSetName"),
                show: "tab",
                visible: false,
                children:[]
              }
            ]
          },
          "animation-display": {
            visible: false,
            children: [
              {
                name: "animation-display-type",
                visible: false
              },
              {
                name: "animation-display-stay-column-carousel",
                visible: true
              },
              {
                name: "animation-trigger-linkage",
                default: false
              }
            ]
          },
        },
      },
      ...super.defineOptions(),
    ];
  }

  get echartsXAxisOption(): XAXisComponentOption {
    return {
      show: false,
    };
  }

  get echartsYAxisOption(): YAXisComponentOption {
    return {
      show: false,
    };
  }

  get echartsTooltipOption():
    | TooltipComponentOption
    | TooltipComponentOption[] {
    let backgroundColor = new Color(this.getOption<Color>("tooltip-background-color")).toCssString();
    let backgroundImage = this.getOption<OptionFileValue>("tooltip-background-image");
    let backgroundBlur = this.getOption<OptionFileValue>("tooltip-background-blur");
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
    let tooltipValueType = this.getOption<string>("tooltip-text-type");
    let tooltipValueDecimalPlaces = this.getOption<number>("tooltip-decimal-places");
    let tooltipValueCompleteZero = this.getOption<boolean>("tooltip-complete-zero");
    let commaDisplay = this.getOption<boolean>("tooltip-comma-display")
    const projectId = this.getBoard().projectId;
    const seriesCssColors = this.getSeriesCssColors();
    let showTooltip = this.getOption<boolean>("tooltip");
    let tooltipBackground = backgroundImage?.relativePath
      ? `url("${projectId}/${backgroundImage.relativePath}")`
      : backgroundColor;
    return {
      trigger: "item",
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
        let dataHtml = "";
        let iconHtml = showIcon ? `<span style="color:red;display:inline-block;width:10px;height:10px;border-radius:50%;background:${param.color};"></span>` : "";
        let resultValue: any = param.value;
        if (isNaN(resultValue)) resultValue = 0;
        if (tooltipValueType === "normal") {
          resultValue = formatFloat(resultValue, tooltipValueDecimalPlaces, tooltipValueCompleteZero);
        } else {
          let sum = this.echartsData.reduce((results, current) => {
            return results + current.value
          }, 0)
          resultValue = parseInt((param.value / sum) * 100 as any)
          resultValue = formatFloat(resultValue, tooltipValueDecimalPlaces, tooltipValueCompleteZero) + '%';
        }
        if(commaDisplay){
          resultValue = this.doCommaSeparat(resultValue)
        }
        dataHtml += `<div>${iconHtml}
          <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${param.name}：</span>
          <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${resultValue}</span>
        </div>`;
        let titleHtml = showTitle ? `<div><span style="color:${titleFontColor};font-size:${titleFontSize}px;line-height:1;">${param.seriesName}</span></div>` : "";
        return `<div>${titleHtml}<div>${dataHtml}</div></div>`;
      },
    };
  }

  get echartsSeriesOption(): SeriesOption | SeriesOption[] {
    let shapeColumnWidth = this.getOption('shape-column-width');
    const seriesCssColors = this.getSerieEchartsColors();
    const showCircle = this.getOption("radial-point-enabled");
    const symbolSize = this.getOption("radial-point-radius");
    const selectedColor = new Color(this.getOption("selected-color")).toEchartsColor()

    let seriesInfo = [];
    let obj: Object;
    for (let i = 0; i < this.echartsData.length; i++) {
      let datas = [];
      for (let j = 0; j <= i; j++) {
        j === i ? datas.push(this.echartsData[i].value) : datas.push(0);
      }

      let serieInfo = {
        name: this.echartsData[i].name,
        type: 'bar',
        z: 2,
        barWidth: this.getOption("shape-column-width"),
        coordinateSystem: 'polar',
        data: datas,
        stack: 'b',
        label: {
          show: false,
        },
        selectedMode: 'series',
        select: {
          itemStyle: {
            color: selectedColor,
            borderColor: selectedColor
          }
        }
      }
      if (shapeColumnWidth === "diy") {
        obj = Object.assign(serieInfo, { barWidth: this.getOption("column-width") + '%' })
      } else {
        if (obj) {
          let { barWidth, ...parame } = obj
        }
      }
      seriesInfo.push(serieInfo)
    }
    let pictorialBarInfo = {
      type: 'scatter',
      coordinateSystem: 'polar',
      symbolSize: symbolSize,
      data: this.echartsData.map((data, index) => {
        return {
          name: data.name,
          value: [index, data.value],
          itemStyle: {
            color: Array.isArray(seriesCssColors[index % seriesCssColors.length])
              ? seriesCssColors[index % seriesCssColors.length][0]
              : seriesCssColors[index % seriesCssColors.length],
            opacity: 1
          },
          tooltip: {
            formatter: (param) => {
              return ``
            }
          }
        }
      }),
      z: 99,
    }
    showCircle ? seriesInfo.push(pictorialBarInfo) : seriesInfo.unshift()
    return seriesInfo
  }

  get echartsAngleAxis(): AngleAxisComponentOption | AngleAxisComponentOption[] {
    let max: number;
    let yDisplay = this.getOption<boolean>("y-display")
    let yaxisShow = this.getOption<OptionValue>("y-label");
    let axisFont = this.getOption<OptionFontValue>("y-font");
    let axisMarigin = this.getOption<OptionValue>("y-label-offset");
    let axisShadowColor = this.getOption<OptionValue>("y-display-shadow-color");
    let axisShadowBlur = this.getOption<OptionValue>("y-display-shadow-blur");
    let axisShadowoffsetx = this.getOption<OptionValue>("y-display-shadow-offset-x");
    let axisShadowOffsety = this.getOption<OptionValue>("y-display-shadow-offset-y");
    let yTextType = this.getOption<OptionValue>("y-text-type");
    let yValueAbbreviation = this.getOption<OptionValue>("y-value-abbreviation");
    let yDecimalPlaces = this.getOption<number>("y-decimal-places");
    let yCompleteZero = this.getOption<boolean>("y-complete-zero");
    let yScaleNumber = this.getOption<number>("y-scale-interval");
    let yScaleRange = this.getOption<OptionValue>("y-scale-range");
    let yScaleMin = this.getOption<number>("y-scale-min");
    let yScaleMax = this.getOption<number>("y-scale-max");
    const valueMax = Math.max(...this.echartsData.map(max => max.value), 0);
    if (yScaleRange === "adaptive") {
      max = valueMax * 4 / 3
    } else {
      max = yScaleMax
    }
    let angleAxisinfo = {
      type: "value",
      startAngle: this.getOption("angle-start"),  //调整角度
      axisLine: {
        show: false
      },
      axisTick: {
        show: false
      },
      splitLine: {
        show: false
      },
      min: function (value) {
        return yScaleMin
      },
      max: function (value) {
        return max;
      },
      interval: max / yScaleNumber,
      axisLabel: {
        show: yaxisShow && yDisplay ? true : false,
        margin: axisMarigin,
        color: this.toEchartsColor(axisFont.color as Color),
        fontStyle: axisFont.italic ? "italic" : "normal",
        fontWeight: axisFont.bold ? "bold" : "normal",
        fontFamily: axisFont.family,
        fontSize: axisFont.size,
        shadowColor: this.toEchartsColor(axisShadowColor as Color),
        shadowBlur: axisShadowBlur,
        shadowOffsetX: axisShadowoffsetx,
        shadowOffsetY: axisShadowOffsety,
        formatter: (value, index) => {
          if (yTextType === "normal") {
            value = formatFloat(value, yDecimalPlaces, yCompleteZero);
            return value + `${yValueAbbreviation}`
          } else {
            value = formatFloat(value, yDecimalPlaces, yCompleteZero) + '%';
            return value
          }
        }
      },
    };
    return angleAxisinfo as any
  }

  get echartsRadiusAxis(): RadiusAxisComponentOption | RadiusAxisComponentOption[] {
    let axisObj: Object;
    let type = this.getOption("x-data-type");
    let axisFont = this.getOption<OptionFontValue>("x-font");
    let axisMarigin = this.getOption<OptionValue>("x-label-offset");
    let axisShadowColor = this.getOption<OptionValue>("x-display-shadow-color");
    let axisShadowBlur = this.getOption<OptionValue>("x-display-shadow-blur");
    let axisShadowoffsetx = this.getOption<OptionValue>("x-display-shadow-offset-x");
    let axisShadowOffsety = this.getOption<OptionValue>("x-display-shadow-offset-y");
    let axisRotate = this.getOption<OptionValue>("x-rotate");
    let XGridx = this.getOption<boolean>('grid-x-display');
    let lineColor = this.getOption<OptionValue>("grid-x-line-color");
    let lineWidth = this.getOption<OptionValue>("grid-x-line-width");
    let lineType = this.getOption<OptionValue>("grid-x-line-type");
    let lineTypeWidth = this.getOption<OptionValue>("grid-x-line-dotted-width");
    let xDisplay = this.getOption<boolean>("x-display");
    let xLabel = this.getOption<boolean>("x-label");
    let radiusAxisinfo = {
      axisLine: {
        show: false
      },
      axisTick: {
        show: false
      },
      splitLine: {
        show: XGridx,
        lineStyle: {
          type: lineType === "dotted" ? [lineTypeWidth] : lineType,
          color: this.toEchartsColor(lineColor as Color),
          width: lineWidth,
        }
      },
      axisLabel: {
        interval: 0,
        margin: axisMarigin,
        color: this.toEchartsColor(axisFont.color as Color),
        fontStyle: axisFont.italic ? "italic" : "normal",
        fontWeight: axisFont.bold ? "bold" : "normal",
        fontFamily: axisFont.family,
        fontSize: axisFont.size,
        shadowColor: this.toEchartsColor(axisShadowColor as Color),
        shadowBlur: axisShadowBlur,
        shadowOffsetX: axisShadowoffsetx,
        shadowOffsetY: axisShadowOffsety,
        rotate: Number(axisRotate),
        show: xDisplay && xLabel ? true : false
      },
      data: this.echartsData.map((data) => data.name),
    }
    switch (type) {
      case "category": axisObj = Object.assign(radiusAxisinfo, { type });
        break;
      case "value": let b = 2;
        break;
      case "time": let c = 3;
        break;
    }
    return axisObj
  }

  get polar() {
    let paddingValue = this.padding;
    let innerRadius = this.getOption<number>("inner-radius");
    let outerRadius = this.getOption<number>("outer-radius");
    let centerX = this.contentSize.width / 2 + paddingValue.left - paddingValue.right;
    let centerY = this.contentSize.height / 2 + paddingValue.top - paddingValue.bottom;
    return {
      center: [centerX, centerY],
      radius: [`${innerRadius}%`, `${outerRadius}%`]
    }
  }

  get echartsOptionFunc(): {[key: string]: Function} {
    return {
      xAxis: ()=>this.echartsXAxisOption,
      yAxis: ()=>this.echartsYAxisOption,
      tooltip: ()=>this.echartsTooltipOption,
      legend: ()=>this.echartsLegendOption,
      polar: ()=>this.polar,
      series: ()=>this.echartsSeriesOption,
      angleAxis: ()=>this.echartsAngleAxis,
      radiusAxis: ()=>this.echartsRadiusAxis,
      color: ()=>this.getSerieEchartsColors()
    };
  }

  protected getDefaultPrivateData(): PrivateData {
    return {
      fields: [
        { uid: "f_1", alias: "名称", type: "string" },
        { uid: "f_2", alias: "数值", type: "number" },
      ],
      rows: [
        { f_1: '示例一', f_2: 20 },
        { f_1: '示例二', f_2: 70 },
        { f_1: '示例三', f_2: 45 },
        { f_1: '示例四', f_2: 66 },
        { f_1: '示例五', f_2: 32 },
        { f_1: '示例六', f_2: 80 },
      ],
    };
  }

  checkErrorData() {
    let dataOpt = this.getOption<OptionFieldValue[]>("axis-x") || [];
    let dataValue = this.getOption<OptionFieldValue[]>("axis-y") || [];
    if (dataOpt.length === 0 || dataValue.length === 0) {
      if(!dataOpt.length && !dataValue.length) {
        this.addErrorDataStatus("filed-empty");
      } else {
        this.addErrorDataStatus("filed-incomplete");
      }
    } else {
      this.clearErrorDataStatus();
    }
  }

  _datasetSource(): any[] {
    return this.createView(["axis-x", "axis-y"]);
  }


  get echartsData() {
    let resultData = [];
    let dataSort = this.getOption('sort-type');
    let dataOpt = this.getOption<OptionFieldValue[]>("axis-x") || [];
    let dataValue = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let dataMap = new Map();
    if (dataOpt.length === 0 || dataValue.length === 0) {
      let privateData = this.getPrivateData();
      let fieldTypeUids = this.getPrivateFieldTypeUids();
      privateData?.rows?.forEach?.((row) => {
        resultData.push({
          name: row?.[fieldTypeUids.string?.[0]],
          value: row?.[fieldTypeUids.number?.[0]],
          'self_row_data': row,
        });
      });
    } else {
      let treeMapData = this.datasetSource();
      treeMapData = this.dealDataByAggregate(treeMapData,  [dataOpt[0]], dataValue);
      for (let row of treeMapData) {
        let dataInfo = {};
        dataInfo["name"] = row[dataOpt[0]?.uid[2]];
        dataInfo["value"] = this.getMetric(row, dataValue[0]);
        dataInfo['self_row_data'] = row;
        resultData.push(dataInfo)
      }
    }
    // if (dataSort === "ASC") {
    //   resultData.sort((a, b) => { return a.value - b.value })
    // } else if (dataSort === "DESC") {
    //   resultData.sort((a, b) => { return b.value - a.value })
    // }
    dataMap.clear();
    return this.getDataAfterSort(resultData);
  }

  getDataAfterSort(dataSource) {
    this.originDataSource = JSON.parse(JSON.stringify(dataSource));
    let sortUid = this.getOption<string>("fields-data-sort-fields");
    let sortType = this.getOption("fields-data-sort-orderby");
    if(sortUid){
      dataSource = dataSource.sort((a,b)=>{
        const aSortData = a.self_row_data?._metrics?.[sortUid];
        const bSortData = b.self_row_data?._metrics?.[sortUid];
        let aValue = aSortData ? aSortData[Object.keys(aSortData)[0]] : a.self_row_data[sortUid];
        let bValue = bSortData ? bSortData[Object.keys(bSortData)[0]] : b.self_row_data[sortUid];
        if(aValue == undefined && bValue == undefined) return 0;
        if(!isNaN(aValue) && !isNaN(bValue)){
          if(sortType === 1){
            return aValue - bValue;
          }else {
            return bValue - aValue;
          }
        }else {
          if(sortType === 1){
            return aValue.localeCompare(bValue, "zh");
          }else {
            return bValue.localeCompare(aValue, "zh");
          }
        }
      });
    }
    return dataSource;
  }

  beginAnimationDisplay() {
    let display_stay = Math.max(this.getOption<number>("animation-display-stay-column-carousel") * 1000, 1000);
    let promise = Promise.resolve();
    let baseDataLength = 1
    let update_data = (resolve) => {
      // 先执行一次 否则刚开始会多停顿 display_stay 的时长
      this.echartsChart.dispatchAction({ type: 'showTip', seriesIndex: this.animationSelectedIndex.value ,dataIndex:  this.animationSelectedIndex.value});
      this.echartsChart.dispatchAction({ type: 'select', seriesIndex: this.animationSelectedIndex.value });
      this.animationSelectedIndex.value += baseDataLength;
      this.animation_display_timeout = setInterval(() => {
        if (this.stopAnimate) {
          clearInterval(this.animation_display_timeout);
          this.echartsChart.dispatchAction({ type: 'hideTip' });
          this.echartsChart.dispatchAction({ type: 'unselect', seriesIndex: this.animationSelectedIndex.value, dataIndex: this.animationSelectedIndex.value });
          return resolve();
        }
        let dataSourceLength = this.echartsData.length || 0;
        dataSourceLength *= baseDataLength;
        if (this.animation_display_paused || !dataSourceLength) return;

        //选中当前
        if (this.animationSelectedIndex.value > dataSourceLength - baseDataLength) {
          this.echartsChart.dispatchAction({ type: 'hideTip' });
          this.echartsChart.dispatchAction({ type: 'unselect'});
          this.animationSelectedIndex.value = 0;
          clearInterval(this.animation_display_timeout);
          resolve();
        } else {
          this.echartsChart.dispatchAction({ type: 'hideTip' });
          this.echartsChart.dispatchAction({ type: 'unselect' });
          this.echartsChart.dispatchAction({ type: 'showTip', seriesIndex: this.animationSelectedIndex.value, dataIndex:  this.animationSelectedIndex.value});
          this.echartsChart.dispatchAction({ type: 'select', seriesIndex: this.animationSelectedIndex.value });
          this.animationSelectedIndex.value += baseDataLength;
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
    this.stopAnimationDisplay();
    this.animationSelectedIndex.value = 0;
    this.echartsChart.setOption({
      series: this.echartsSeriesOption
    }, {
      notMerge: false,
      replaceMerge: ["series"]
    })
    this.startAnimationDisplay();
  }

  initEchartsEvents() {
    super.initEchartsEvents();
    this.echartsChart.on("selectchanged", (params: any) => {
      if (params.fromAction == "select") {
        if (params.isFromClick && params.selected.length > 1){ //选中超过1个--需要取消之前选中
          const clickedSeriesIndex = params.selected.findIndex((select)=>select.seriesIndex === params.fromActionPayload.seriesIndex)
          const unclickedSeriesIndex = clickedSeriesIndex === 0 ? 1 : 0;
          this.echartsChart.dispatchAction({ type: 'unselect', seriesIndex: params.selected[unclickedSeriesIndex].seriesIndex});
        }
        let targetDataIndex = params.fromActionPayload.dataIndexInside || params.fromActionPayload.seriesIndex ;
        // const triggerLinkage = params.isFromClick ? true : this.animationTriggerLinkage;
        let data = this.echartsData;
        let catUid = this.getOption("axis-x")?.[0]?.uid;
        let currentData = data[targetDataIndex]
        let linkages = [];
        if (catUid?.length) {
          let fieldArr = this.getOption<string>("linkage-form-field")?.split(".");
          let fieldUIDs;
          let filterValue;
          if (fieldArr?.length) {
            if (fieldArr.length === 2) {
              fieldUIDs = [catUid[0], ...fieldArr];
              filterValue = currentData['self_row_data']?.[fieldArr[1]];
            } else if (fieldArr.length === 3) {
              fieldUIDs = [catUid[0], fieldArr[0], `${fieldArr[1]}.${fieldArr[2]}`];
              const rawData = currentData['self_row_data']?.[fieldArr[1]];
              filterValue = Array.isArray(rawData) ? rawData.map(item => item[fieldArr[2]]) : rawData;
            }
            linkages.push({ uid: fieldUIDs, value: filterValue });
            this.applyLinkage(linkages)
          }
        }
      } else {
        if (params.selected.length === 0) {
          const triggerLinkage = params.isFromClick ? true : this.animationTriggerLinkage;
          this.withdrawLinkage()
        }
      }
    });
  }
}
