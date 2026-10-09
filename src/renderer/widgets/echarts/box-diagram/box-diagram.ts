import { PrivateDataConnectionUID, PrivateDataTableUID, PrivateData, OptionFieldUID } from "@common/types/project";
import { DefinedOptions, OptionFileValue, OptionFieldValue, OptionFontValue, WidgetMetaData, ChartClickState } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { TheWidget as Axis, component as B2Axis } from "@renderer/widgets/echarts/axis";
import { SeriesOption, TooltipComponentOption } from "echarts/dist/echarts";
import { formatFloat } from "@common/utils/math";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { merge, recursive } from "merge";

export class BoxDiagram extends Axis {
  static resource = recursive(true, Axis.resource, resource);

  static defineOptions(): DefinedOptions[] {
    return [
      {
        data: {
          fields: {
            alias: i18next.t("fieldsSetting"),
            fold: "unfold",
            children: [
              {
                name: "axis-x",
                visible: false
              },
              {
                name: "axis-y",
                visible: false
              },
              {
                name: "axis-value",
                alias: i18next.t("axisValue"),
                type: "field",
                default:[
                  {"uid":[PrivateDataConnectionUID, PrivateDataTableUID,"f_value1"],"__opt_type":"field","summary":""},
                  {"uid":[PrivateDataConnectionUID, PrivateDataTableUID,"f_value2"],"__opt_type":"field","summary":""},
                  {"uid":[PrivateDataConnectionUID, PrivateDataTableUID,"f_value3"],"__opt_type":"field","summary":""},
                  {"uid":[PrivateDataConnectionUID, PrivateDataTableUID,"f_value4"],"__opt_type":"field","summary":""},
                  {"uid":[PrivateDataConnectionUID, PrivateDataTableUID,"f_value5"],"__opt_type":"field","summary":""},
                ]
              },
            ],
          },
          sort: {
            visible: false
          },
          'fields-filter': {
            alias: '数据筛选',
            children: [
              {
                name: "fields-data-sort-fields",
                visible: false,
              },
              {
                name: "fields-data-sort-orderby",
                visible: false,
              },
            ]
          }
        },
        style: {
          basic: {
            children: [
              {
                name:"boxDiagram-select-width",
                alias:"图形宽度",
                type:"select",
                selectChoices:[
                  {
                    label:"自适应",
                    value:"0"
                  },
                  {
                    label:"自定义",
                    value:"1"
                  }
                ],
                default:"0"
              },
              {
                name:"boxDiagram-width",
                alias:"图形宽度",
                type:"number(min=0,max=100,showInput,unit=%)",
                default:50,
                visible:((widget:BoxDiagram)=>{
                  return widget.getOption("boxDiagram-select-width") === "1"
                })
              }
            ]
          },
          "series-color": {
            visible: true,
            children: [
              {
                name: "palette",
                alias: '图形边框颜色',
                type: "palette",
                default: (widget: BoxDiagram) => { return Array.from(widget.defaultColors10) },
              },
              {
                name: "palette-fill",
                alias: '图形填充颜色',
                type: "palette",
                default: (widget: BoxDiagram) => { return Array.from(widget.defaultColors10) },
              },
            ]
          },
          "series-color-group": {
            visible: false
          },
          "series-shape": {
            children: [
              {
                name: "series-shape-default-cluster",
                children: [
                  {
                    name: "shape-border-width",
                    alias: '图形边框宽度',
                    default: 1,
                    type: "number(unit=px, min=0)",
                  },
                  {
                    name: "shape-background",
                    alias: '图形底色',
                    type: "color",
                    default: "transparent",
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
          "label-group": {
            visible: false
          },
          legend: {
            visible: false
          },
          sort: {
            visible: false
          },
          tooltip: {
            children: [
              {
                name: "tooltip-style-group",
                children: [
                  {
                    name: "tooltip-icon",
                    default: false,
                    visible: false
                  }
                ]
              },
              {
                name: "tooltip-unit-setName",
                alias: i18next.t("tooltipUnitSetName"),
                show: "tab",
                visible: false,
                children:[]
              }
            ]
          }
        }
      },
      ...super.defineOptions(),
    ];
  }

  createView(paths?: string[]): any {
    let result = {
      data: [],
      columns: [],
      alias: []
    };
    if (!paths) return result;
    const uids = [];
    for (const item of paths) {
      const options = this.getOption<OptionFieldValue[]>(item) || [];
      for (const option of options) {
        uids.push(option.uid);
      }
    }
    if (!uids.length) return result;
    return {
      data: this.getData().getRows(uids),
      columns: this.getData().getflatColumns(uids),
      alias: Array.from(uids).map((uid) => { return this.getFieldAlias(uid) })
    };
  }

  get echartsXAxisOption() {
    let axisLabelFont = this.getOption<OptionFontValue>("x-font");
    let xIsPercent = this.getOption("x-text-type") === "percent";
    let xDecimalPlaces = Math.max(this.getOption("x-decimal-places"), 0);
    let xCompleteZero = this.getOption<boolean>("x-complete-zero");
    let valueAbb = this.getOption<string>("x-value-abbreviation");
    let xUnitFont = this.getOption<OptionFontValue>("x-unit-font");
    let dataSource = this.datasetSource();
    let xAxisData = dataSource.map((dataItem) => {
      return dataItem["name"];
    })
    let axisOpt: any = {
      data: xAxisData,
      show: this.getOption<boolean>("x-display"),
      type: this.getOption<"category" | "value" | "time" | "log">("x-data-type"),
      logBase: this.getOption<number>("x-logBase"),
      boundaryGap: this.boundaryGap,
      name: this.getOption<boolean>("x-unit") ? this.getOption<string>("x-unit-text") : "",
      nameGap: this.getOption<number>("x-nameGap"),
      nameTextStyle: {
        color: this.toEchartsColor(xUnitFont.color as Color),
        fontStyle: xUnitFont.italic ? "italic" : "normal",
        fontWeight: xUnitFont.bold ? "bold" : "normal",
        fontFamily: xUnitFont.family,
        fontSize: xUnitFont.size,
      },
      axisLine: { //轴线
        show: this.getOption<boolean>("x-line"),
        lineStyle: {
          color: this.toEchartsColor(this.getOption<Color>("x-line-color")),
          width: Math.max(this.getOption<number>("x-line-width"), 0),
          type: this.getOption<"dashed" | "solid">("x-line-type"),
          join: "miter"
        },
      },
      axisTick: {
        alignWithLabel: true,
        show: this.getOption<boolean>("x-tickline"),
        length: this.getOption<number>("x-tickline-length"),
        lineStyle: {
          width: this.getOption<number>("x-tickline-width"),
          color: this.toEchartsColor(this.getOption<Color>("x-tickline-color")),
        }
      },
      axisLabel: {
        show: this.getOption<boolean>("x-label"),
        margin: this.getOption<number>("x-label-offset"),
        fontStyle: axisLabelFont.italic ? "italic" : "normal",
        fontWeight: axisLabelFont.bold ? "bold" : "normal",
        fontSize: axisLabelFont.size,
        fontFamily: axisLabelFont.family,
        color: this.toEchartsColor(axisLabelFont.color as Color),
        textShadowColor: this.toEchartsColor(this.getOption<Color>("x-display-shadow-color")),
        textShadowBlur: this.getOption<number>("x-display-shadow-blur"),
        textShadowOffsetX: this.getOption<number>("x-display-shadow-offset-x"),
        textShadowOffsetY: this.getOption<number>("x-display-shadow-offset-y"),
        rotate: Number(this.getOption<string>("x-rotate")),
        formatter: (value, index) => {
          if (this.getOption<"category" | "value" | "time" | "log">("x-data-type") == "value") {
            let num = value;
            if (!isNaN(num)) {
              if (xIsPercent) {
                value = formatFloat(num * 100, xDecimalPlaces, xCompleteZero) + "%";
              } else {
                let abb = Number(valueAbb);
                let unit = this.axisUnitMap[abb] || "";
                value = formatFloat(num / Math.pow(10, abb), xDecimalPlaces, xCompleteZero) + unit;
              }
            }
          }
          return value;
        }
      },
      splitLine: this.xGridLineOption
    }
    if (this.getOption("x-scale-range") === "custom") {
      axisOpt.min = this.getOption<number>("x-scale-min");
      axisOpt.max = this.getOption<number>("x-scale-max");
      axisOpt.interval = this.getOption("x-scale-interval");
    }
    return axisOpt;
  }

  protected getDefaultPrivateData(): PrivateData {
    return {
      fields: [
        { uid: "f_value1", alias: "value1", type: "number" },
        { uid: "f_value2", alias: "value2", type: "number" },
        { uid: "f_value3", alias: "value3", type: "number" },
        { uid: "f_value4", alias: "value4", type: "number" },
        { uid: "f_value5", alias: "value5", type: "number" },
      ],
      rows: [
        {
          f_value1: 850,
          f_value2: 960,
          f_value3: 840,
          f_value4: 890,
          f_value5: 890,
        },
        {
          f_value1: 740,
          f_value2: 940,
          f_value3: 880,
          f_value4: 810,
          f_value5: 840,
        },
        {
          f_value1:900,
          f_value2: 960,
          f_value3: 850,
          f_value4:810,
          f_value5: 780,
        },
        {
          f_value1:980,
          f_value2: 1100,
          f_value3: 950,
          f_value4:910,
          f_value5: 880,
        },
        {
          f_value1:780,
          f_value2: 800,
          f_value3: 750,
          f_value4:610,
          f_value5: 580,
        },
      ],
    };
  }

  checkErrorData() {
    if(this.getOption<OptionFieldValue[]>("axis-value")?.length) {
      this.clearErrorDataStatus();
    } else {
      this.addErrorDataStatus("filed-empty");
    }
  }

  _datasetSource(): any {
    let sourceData = this.createView(["axis-value"]);
    let dataValues = [this.getPrivateData()?.rows];
    if (sourceData?.columns?.length) {
        dataValues = sourceData.columns;
    }
    let dataResult = [];
    dataValues.forEach((values, index) => {
      values = values.sort((a, b) => { return a - b; });
      let valueLength = values.length;
      let dataInfo = {};
      dataInfo["high"] = Math.max(...values);
      dataInfo["low"] = Math.min(...values);
      if ((valueLength + 1) % 4 == 0) {
        let Q1Index = (valueLength + 1) / 4;
        let Q2Index = (valueLength + 1) / 4 * 2;
        let Q3Index = (valueLength + 1) / 4 * 3;
        dataInfo["Q1"] = values[Q1Index - 1];
        dataInfo["Q2"] = values[Q2Index - 1];
        dataInfo["Q3"] = values[Q3Index - 1];
      } else {
        let Q1Index = (valueLength + 1) / 4;
        let Q2Index = (valueLength + 1) / 2;
        let Q3Index = (valueLength + 1) / 4 * 3;
        dataInfo["Q1"] = Math.round(Q1Index) == Math.floor(Q1Index) ? values[Math.floor(Q1Index) - 1] * 0.75 + values[Math.ceil(Q1Index) - 1] * 0.25 : values[Math.floor(Q1Index) - 1] * 0.25 + values[Math.ceil(Q1Index) - 1] * 0.75;
        dataInfo["Q2"] = (values[Math.floor(Q2Index) - 1] + values[Math.ceil(Q2Index) - 1]) * 0.5;
        dataInfo["Q3"] = Math.round(Q3Index) == Math.floor(Q3Index) ? values[Math.floor(Q3Index) - 1] * 0.75 + values[Math.ceil(Q3Index) - 1] * 0.25 : values[Math.floor(Q3Index) - 1] * 0.25 + values[Math.ceil(Q3Index) - 1] * 0.75;
      }
      if (sourceData?.alias?.length) {
        dataInfo["name"] = sourceData?.alias[index];
      } else {
        dataInfo["name"] = `示例${index + 1}`;
      }

      dataResult.push(dataInfo);
    })

    return dataResult;
  }

  echartsDatasetOption() { return {} }

  getLegendOtherOption() {
    let legendIconColors = this.getSerieEchartsColors("palette");
    let legendData: any = [
      { name: "示例1", icon: "rect", itemStyle: { color: legendIconColors[0] } },
      { name: "示例2", icon: "rect", itemStyle: { color: legendIconColors[1] } },
      { name: "示例3", icon: "rect", itemStyle: { color: legendIconColors[2] } },
      { name: "示例4", icon: "rect", itemStyle: { color: legendIconColors[3] } },
      { name: "示例5", icon: "rect", itemStyle: { color: legendIconColors[4] } },
    ]
    let valueDims = this.getOption<OptionFieldValue[]>("axis-value") || [];
    if (valueDims.length) {
      let alias = [];
      valueDims.forEach(field => {
        alias.push(this.getFieldAlias(field.uid));
      });

      legendData = alias.map((itemName, itemIndex) => {
        return {
          name: itemName,
          icon: "rect",
          itemStyle: { color: legendIconColors[itemIndex] }
        }
      });
    }
    return {
      data: legendData,
      show: false
    }
  }

  get tooltipAxisPointer(): TooltipComponentOption["axisPointer"] {
    return {
      type: "shadow"
    };
  }

  get echartsTooltipOption(): TooltipComponentOption | TooltipComponentOption[] {
    let backgroundColor = new Color(this.getOption<Color>("tooltip-background-color")).toCssString();
    let backgroundImage = this.getOption<OptionFileValue>("tooltip-background-image");
    let backgroundBlur = this.getOption<OptionFileValue>("tooltip-background-blur");
    let paddingWidth = this.getOption<number>("tooltip-padding-width");
    let paddingHeight = this.getOption<number>("tooltip-padding-height");
    let radius = this.getOption<number>("tooltip-radius");

    let nameFontColor = new Color(this.getOption<Color>("tooltip-name-font-color")).hexa();
    let nameFontSize = this.getOption<number>("tooltip-name-font-size");
    let valueFontColor = new Color(this.getOption<Color>("tooltip-value-font-color")).hexa();
    let valueFontSize = this.getOption<number>("tooltip-value-font-size");
    let showTitle = this.getOption<boolean>("tooltip-title");
    let titleFontColor = new Color(this.getOption<Color>("tooltip-title-font-color")).hexa();
    let titleFontSize = this.getOption<number>("tooltip-title-font-size");

    const projectId = this.getBoard().projectId;
    let showTooltip = this.getOption<boolean>("tooltip");
    let tooltipBackground = backgroundImage?.relativePath ? `url("${projectId}/${backgroundImage.relativePath}")` : backgroundColor;
    let commaDisplay = this.getOption<boolean>("tooltip-comma-display")
    let tooltipStyle = this.getOption("tooltip-text-type");
    let tooltipDecimalPlaces = this.getOption<number>("tooltip-decimal-places");
    let tooltipCompleteZero = this.getOption<boolean>("tooltip-complete-zero");
    return {
      trigger: this.tooltipTrigger,
      axisPointer: this.tooltipAxisPointer,
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
      formatter: (params) => {
        let dataHtml = "";
        for (let param of params || []) {
          let values = param.value;
          if (!Array.isArray(values)) continue;
          let [name, low, Q1, Q2, Q3, high] = values;

          if (tooltipStyle === "normal") {
            low = formatFloat(low, tooltipDecimalPlaces, tooltipCompleteZero);
            Q1 = formatFloat(Q1, tooltipDecimalPlaces, tooltipCompleteZero);
            Q2 = formatFloat(Q2, tooltipDecimalPlaces, tooltipCompleteZero);
            Q3 = formatFloat(Q3, tooltipDecimalPlaces, tooltipCompleteZero);
            high = formatFloat(high, tooltipDecimalPlaces, tooltipCompleteZero);
          } else if (tooltipStyle === "percent") {
            low = formatFloat(low * 100, tooltipDecimalPlaces, tooltipCompleteZero) + "%";
            Q1 = formatFloat(Q1 * 100, tooltipDecimalPlaces, tooltipCompleteZero) + "%";
            Q2 = formatFloat(Q2 * 100, tooltipDecimalPlaces, tooltipCompleteZero) + "%";
            Q3 = formatFloat(Q3 * 100, tooltipDecimalPlaces, tooltipCompleteZero) + "%";
            high = formatFloat(high * 100, tooltipDecimalPlaces, tooltipCompleteZero) + "%";
          }
          if(commaDisplay){
            low = this.doCommaSeparat(low)
            Q1 = this.doCommaSeparat(Q1)
            Q2 = this.doCommaSeparat(Q2)
            Q3 = this.doCommaSeparat(Q3)
            high = this.doCommaSeparat(high)
          }
          dataHtml += `
            <div>
              <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">最大值：</span>
              <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${high}</span>
            </div>
            <div>
              <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">上四分位数</span>
              <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${Q3}</span>
            </div>
            <div>
              <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">中位数：</span>
              <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${Q2}</span>
            </div>
            <div>
              <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">下四分位数：</span>
              <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${Q1}</span>
            </div>
            <div>
              <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">最小值：</span>
              <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${low}</span>
            </div>
          `;
        }
        let titleHtml = showTitle ? `<div>
          <span style="color:${titleFontColor};font-size:${titleFontSize}px;line-height:1;">${params[0]?.axisValue}</span>
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

  get echartsSeriesOption(): SeriesOption | SeriesOption[] | any {
    let borderWidth = this.getOption<number>("shape-border-width");
    let borderColors = this.getSerieEchartsColors("palette");
    let shapeBackground = new Color(this.getOption<Color>("shape-background")).hexa();
    let dataSource = this.datasetSource();
    let fillColors = this.getSerieEchartsColors("palette-fill");
    let boxWidth = this.getOption("boxDiagram-select-width") === "0" ? ["7%","50%"] : ["0%",`${this.getOption("boxDiagram-width")}%`]
    let dataResult = dataSource.map((dataItem, index) => {
      let { Q1, Q2, Q3, high, low, name } = dataItem;
      return {
        name: name,
        value: [low, Q1, Q2, Q3, high],
        itemStyle: {
          color: fillColors[index] || shapeBackground
        }
      }
    });
    return {
      type: "boxplot",
      colorBy: "data",
      boxWidth: boxWidth,
      itemStyle: {
        color: shapeBackground,
        borderWidth: borderWidth,
        borderColor: (param) => {
          return borderColors[param.dataIndex % borderColors.length];
        },
      },
      markLine: this.markLineOption,
      emphasis: {
        disabled: true
      },
      silent: false,
      data: dataResult
    }
  }

  beginAnimationDisplay() {
    // super.beginAnimationDisplay();
    let b2_animator = null;
    if (this.getAnimationType() == "roll") {
      b2_animator = this.rollAnimationDisplay();
    }else if (this.getAnimationType() == "carousel") {
      b2_animator = this.carouselAnimationDisplays();
    }
    if (b2_animator) {
      this.b2_animators.push(b2_animator);
    }
  }

  rollAnimationDisplay() {
    let that = this;
    let start = this.echartsChart.getOption()?.dataZoom?.[0]?.start;
    let end = this.echartsChart.getOption()?.dataZoom?.[0]?.end;
    let xDims = this.getOption<OptionFieldValue[]>("axis-value") || [];
    let dataLength = that.echartsChart.getOption()?.xAxis?.[0]?.data?.length
    if(start === 0 && end === 100 || this.getOption("series-shape-number-type") !== "custom") return;
    let rollNum = this.getOption<number>("shape-column-number") - 1;
    let promise = Promise.resolve();
    let currentIndex = this.echartsChart.getOption().dataZoom[0].startValue;
    let display_duration = this.getAnimationDisplayDuration();
    let display_interval = Math.max(this.getOption<number>("animation-display-single-interval") * 1000, 0) || 1000;
    let update_data;
    if(this.transposed){
      // 条形图滚动动画
      let endVal = dataLength - 1;
      currentIndex = endVal - rollNum ;
      update_data = (resolve) => {
      that.animation_display_timeout = setInterval(() => {
        if (that.stopAnimate) {
          clearInterval(that.animation_display_timeout);
          that.echartsChart.dispatchAction({ type: 'dataZoom', startValue: dataLength-rollNum-1, endValue: dataLength-1 });
          return resolve();
        }
        if(that.animation_display_paused || that.isAnimating) return;
        if(that.selectedIndex.value !== -1){
          that.selectedIndex.value = -1;
          that.selectedData.value = null;
          that.animationTriggerLinkage && that.withdrawLinkage();
        }

        //选中当前
        if (currentIndex < 0) {
          currentIndex = dataLength - rollNum;
          clearInterval(that.animation_display_timeout);
          //全部取消选中
          that.echartsChart.dispatchAction({ type: 'dataZoom', startValue: dataLength-rollNum-1, endValue: dataLength-1 });
          resolve();
        }else{
          that.echartsChart.dispatchAction({ type: 'dataZoom', startValue: currentIndex, endValue: endVal });
          currentIndex--;
          endVal--;
        }
      }, display_duration + display_interval);
    };
    }else{
      update_data = (resolve) => {
      that.animation_display_timeout = setInterval(() => {
        if (that.stopAnimate) {
          clearInterval(that.animation_display_timeout);
          that.echartsChart.dispatchAction({ type: 'dataZoom', startValue: 0, endValue: rollNum });
          return resolve();
        }
        if(that.animation_display_paused || that.isAnimating) return;
        if(that.selectedIndex.value !== -1){
          that.selectedIndex.value = -1;
          that.selectedData.value = null;
          that.animationTriggerLinkage && that.withdrawLinkage();
        }

        //选中当前
        if (currentIndex + rollNum >= dataLength) {
          currentIndex = that.echartsChart.getOption().dataZoom[0].startValue;
          clearInterval(that.animation_display_timeout);
          //全部取消选中
          that.echartsChart.dispatchAction({ type: 'dataZoom', startValue: 0, endValue: rollNum });
          resolve();
        }else{
          that.echartsChart.dispatchAction({ type: 'dataZoom', startValue: currentIndex, endValue: currentIndex + rollNum });
          currentIndex++;
        }
      }, display_duration + display_interval);
    };
    }

    promise = new Promise((resolve) => {
      update_data(resolve);
    });
    return promise
  }

  carouselAnimationDisplays() {
    let that = this;
    let display_stay = Math.max(this.getOption<number>("animation-display-stay-column-carousel") * 1000, 1000);
    let x_uid = this.getOption("axis-value");
    let promise = Promise.resolve();
    let currentIndex = this.echartsChart.getOption().dataZoom[0].startValue;
    let update_data = (resolve) => {
      // 先执行一次 否则刚开始会多停顿 display_stay 的时长
      let linkages = [];
      that.echartsChart.dispatchAction({ type: 'showTip', seriesIndex: currentIndex, dataIndex: 0 });
      that.echartsChart.dispatchAction({ type: 'select', seriesIndex: currentIndex, dataIndex: 0 });
      if (x_uid[currentIndex]?.uid) {
        let targetData = that.echartsChart.getOption().series?.[0]?.data?.[currentIndex]?.value;
        if(targetData) {
          linkages.push({ uid:x_uid[currentIndex].uid, value: targetData });
        }
      }
      that.animationTriggerLinkage && that.applyLinkage(linkages);
      currentIndex++;
      that.animation_display_timeout = setInterval(() => {
        if (that.stopAnimate) {
          clearInterval(that.animation_display_timeout);
          that.echartsChart.dispatchAction({ type: 'hideTip' });
          that.echartsChart.dispatchAction({ type: 'unselect', dataIndex: currentIndex });
          return resolve();
        }
        if(that.animation_display_paused || that.isAnimating) return;

        //选中当前
        let linkages = [];
        that.echartsChart.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: currentIndex });
        that.echartsChart.dispatchAction({ type: 'select', seriesIndex: 0,dataIndex: currentIndex });
        if (x_uid[currentIndex]?.uid) {
          let targetData = that.echartsChart.getOption().series?.[0]?.data?.[currentIndex]?.value;
          if(targetData) {
            linkages.push({ uid:x_uid[currentIndex].uid, value: targetData });
          }
        }
        that.animationTriggerLinkage && that.applyLinkage(linkages);
        if (currentIndex > that.echartsChart.getOption().dataZoom[0].endValue) {
          currentIndex = that.echartsChart.getOption().dataZoom[0].startValue;
          clearInterval(that.animation_display_timeout);
          that.echartsChart.dispatchAction({ type: 'hideTip' });
          that.echartsChart.dispatchAction({ type: 'select', dataIndex: -1 });
          that.animationTriggerLinkage && that.withdrawLinkage();
          resolve();
        }
        else{
          currentIndex++;
        }
      }, display_stay);
    };
    promise = new Promise((resolve) => {
      update_data(resolve);
    });
    return promise
  }

  initEchartsEvents(): void {
    const state: ChartClickState = {
      lastseriesIndex: -1,
      lastDataIndex: -1,
    };

    this.echartsChart.off("click");
    this.echartsChart.on('click', (params) => {
      this.selectedIndex.value = params.dataIndex;
      this.selectedData.value = {
        name: params.name,
        value: params.value
      }

      if (state.lastDataIndex === params.dataIndex && state.lastseriesIndex === params.seriesIndex) {
        state.lastDataIndex = -1;
        state.lastseriesIndex = -1;
        this.selectedIndex.value = -1;
        this.selectedData.value = null;
        this.withdrawLinkage();
        this.echartsChart.dispatchAction({
          type: 'unselect',
          seriesIndex: params.seriesIndex,
          dataIndex: params.dataIndex
        })
      } else {
        if(state.lastDataIndex !== -1) {
          this.echartsChart.dispatchAction({
            type: 'unselect',
            seriesIndex: state.lastseriesIndex,
            dataIndex: state.lastDataIndex
          })
        }
        state.lastDataIndex = params.dataIndex;
        state.lastseriesIndex = params.seriesIndex;
        this.echartsChart.dispatchAction({
          type: 'select',
          seriesIndex: params.seriesIndex,
          dataIndex: params.dataIndex
        })

        let uids = this.getOption("axis-x")?.[0]?.uid;
        if (uids?.length) {
          let fieldArr = this.getOption<string>("linkage-form-field")?.split(".");
          let fieldUIDs;
          let filterValue = params.name;

          if (fieldArr?.length) {
            if (fieldArr.length === 2) {
              fieldUIDs = [uids[0], ...fieldArr];
            } else if (fieldArr.length === 3) {
              fieldUIDs = [uids[0], fieldArr[0], `${fieldArr[1]}.${fieldArr[2]}`];
            }
          }
          console.log({ uid: fieldUIDs as OptionFieldUID, value: filterValue });
          this.applyLinkage({ uid: fieldUIDs as OptionFieldUID, value: filterValue });
        }
      }

    })
  }

  get axisValue() {
    return this.getOption<OptionFieldValue[]>("axis-value") || [];
  }

  override getMetaData() {
    return merge(super.getMetaData(), {
      axisValue: [
        ...this.axisValue
      ]
    } as WidgetMetaData);
  }
}
