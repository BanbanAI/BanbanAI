import { TheWidget as Axis, component as B2Axis } from "@renderer/widgets/echarts/axis";
import { PrivateData, PrivateDataConnectionUID, PrivateDataTableUID, OptionFieldUID } from "@common/types/project";
import { DefinedOptions, OptionFieldValue, OptionFontValue, OptionFileValue, ChartClickState, WidgetMetaData } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { CustomSeriesOption, TooltipComponentOption } from "echarts/dist/echarts";
import { formatFloat } from "@common/utils/math";
import resource from "./locales";
import { recursive } from "merge";
import { merge } from "lodash";
import i18next from "@renderer/widgets/i18next";
import { Ref, ref } from "vue";

export class IntervalHistogram extends Axis {
  static resource = recursive(true, Axis.resource, resource);
  protected nameMap: any;
  static defineOptions(): DefinedOptions[] {
    return [
      {
        data: {
          fields: {
            children: [
              {
                name: "axis-x",
                type: "field(max=1)",
                default: [{ "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_name"], "__opt_type": "field", "summary": "" }]
              },
              {
                name: "axis-y",
                visible: false
              },
              {
                name: "axis-start",
                alias: i18next.t("axisStart"),
                type: "field(aggs=sum|none|max|min|mean|count|distinct, max=1)",
                default: [{ "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_start"], "__opt_type": "field", "summary": "" }]
              },
              {
                name: "axis-end",
                alias: i18next.t("endStart"),
                type: "field(aggs=sum|none|max|min|mean|count|distinct, max=1)",
                default: [{ "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_end"], "__opt_type": "field", "summary": "" }]
              },
            ],
          },
          sort: {
            visible: false
          }
        },
        style: {
          "series-shape": {
            children: [
              {
                name: "series-shape-default-cluster",
                children: [
                  {
                    name: "series-shape-number-type",
                    alias: i18next.t("seriesShapeStyle"),
                    type: "select(radioGroup)",
                    default: "all",
                    selectChoices: [
                      {
                        value: "all",
                        label: i18next.t("all"),
                      },
                      {
                        value: "custom",
                        label: i18next.t("custom"),
                      },
                    ],
                  },
                  {
                    name: "shape-bar-width",
                    alias: i18next.t("shapeBarWidth"),
                    type: "number",
                    default: 20
                  },
                  {
                    name: "shape-background-color",
                    alias: i18next.t("shape-background-color"),
                    type: "color(gradient)",
                    default: "transparent"
                  },
                  {
                    name: "shape-emphasis-color",
                    alias: i18next.t("shape-emphasis-color"),
                    type: "color(gradient)",
                    default: "#d87e55"
                  },
                  {
                    name: "shape-show-top-and-bottom",
                    alias: i18next.t("shape-show-top-and-bottom"),
                    type: "boolean",
                    default: false
                  },
                  {
                    name: "shape-size",
                    alias: i18next.t("shape-size"),
                    type: "vector<W,H>(unit=px, min=0)",
                    default: [25, 5],
                    visible: (widget) => widget.getOption("shape-show-top-and-bottom")
                  },
                  {
                    name: "shape-radius",
                    alias: i18next.t("shape-radius"),
                    type: "number(unit=px, min=0)",
                    default: 5,
                    visible: (widget) => widget.getOption("shape-show-top-and-bottom")
                  },
                  {
                    name: "shape-top-color",
                    alias: i18next.t("shape-top-color"),
                    type: "color(gradient)",
                    default: "#ffffff",
                    visible: (widget) => widget.getOption("shape-show-top-and-bottom")
                  },
                  {
                    name: "shape-bottom-color",
                    alias: i18next.t("shape-bottom-color"),
                    type: "color(gradient)",
                    default: "#676b70",
                    visible: (widget) => widget.getOption("shape-show-top-and-bottom")
                  }
                ]
              },
            ]
          },
          "series-color": {
            visible: true
          },
          "series-color-group": {
            visible: false
          },
          legend: {
            default: false,
            visible: false
          },
          "label-group": {
            default: false,
            visible: false
          },
          "annotation-line": {
            default: false,
            visible: false
          },
          sort: {
            visible: false
          },
          tooltip:{
            children:[
              {
                name: "tooltip-axisPointer",
                alias: i18next.t("tooltip-axisPointer"),
                show: "tab",
                children:[
                  {
                    name: "tooltip-axisPointer-color",
                    alias: i18next.t("tooltip-axisPointer-color"),
                    type: "color",
                    default: "#4047527E",
                  },
                  {
                    name: "tooltip-axisPointer-shadowBlur",
                    alias: i18next.t("tooltip-axisPointer-shadowBlur"),
                    type: "number",
                    default: 0,
                  },
                  {
                    name: "tooltip-axisPointer-shadowColor",
                    alias: i18next.t("tooltip-axisPointer-shadowColor"),
                    type: "color",
                    default: "#ffffff",
                  },
                  {
                    name: "tooltip-axisPointer-shadowOffset",
                    alias: i18next.t("tooltip-axisPointer-shadowOffset"),
                    type: "vector<X, Y>(unit=px)",
                    default: [0, 0],
                  },
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
          },
        }
      },
      ...super.defineOptions(),
    ]
  }

  protected getDefaultPrivateData(): PrivateData {
    return {
      fields: [
        { uid: "f_name", alias: "名称", type: "string" },
        { uid: "f_start", alias: "开始", type: "number" },
        { uid: "f_end", alias: "结束", type: "number" }
      ],
      rows: [
        { f_name: "示例1", f_start: 76, f_end: 100 },
        { f_name: "示例2", f_start: 56, f_end: 108 },
        { f_name: "示例3", f_start: 38, f_end: 129 },
        { f_name: "示例4", f_start: 58, f_end: 155 },
        { f_name: "示例5", f_start: 45, f_end: 120 },
        { f_name: "示例6", f_start: 23, f_end: 99 },
        { f_name: "示例7", f_start: 18, f_end: 56 }
      ],
    };
  }

  checkErrorData() {
    let xDims = this.getOption<OptionFieldValue[]>("axis-x") || [];
    let startDims = this.getOption<OptionFieldValue[]>("axis-start") || [];
    let endDims = this.getOption<OptionFieldValue[]>("axis-end") || [];
    if (xDims.length && startDims.length && endDims.length) {
      this.clearErrorDataStatus();
    } else {
      if (!xDims.length && !startDims.length && !endDims.length) {
        this.addErrorDataStatus("filed-empty");
      } else {
        this.addErrorDataStatus("filed-incomplete");
      }
    }
  }

  _datasetSource() {
    let xDims = this.getOption<OptionFieldValue[]>("axis-x") || [];
    let startDims = this.getOption<OptionFieldValue[]>("axis-start") || [];
    let endDims = this.getOption<OptionFieldValue[]>("axis-end") || [];
    if (xDims.length && startDims.length && endDims.length) {
      let source = this.createView(["axis-x", "axis-start", "axis-end"]);
      const isSameYDim = startDims[0].uid[2]?.split(".").length > 1 && endDims[0].uid[2]?.split(".").length > 1 && startDims[0].uid[2] === endDims[0].uid[2];
      if (isSameYDim) {
        startDims[0].uid[2] += ".startDim";
        endDims[0].uid[2] += ".endDim";
      }
      source = this.dealDataByAggregate(source, [xDims[0]], [...startDims, ...endDims]);
      this.nameMap = {
        xValue: this.getFieldAlias(xDims[0].uid),
        startValue: this.getFieldAlias(startDims[0].uid),
        endValue: this.getFieldAlias(endDims[0].uid),
      };
      let newSource = [];
      source.forEach((row, index) => {
        let dataItem = {};
        dataItem["xValue"] = row[xDims[0].uid[2]];
        dataItem["startValue"] = this.getMetric(row, startDims[0]);
        dataItem["endValue"] = this.getMetric(row, endDims[0]);

        newSource.push(dataItem);
      })
      return this.getDataAfterSort(newSource);
    } else {
      const privateData = this.getPrivateData();
      const nameDim = privateData.fields.find(f => f.uid === "f_name");
      const startDim = privateData.fields.find(f => f.uid === "f_start");
      const endDim = privateData.fields.find(f => f.uid === "f_end");
      this.nameMap = {
        xValue: nameDim.alias || "名称",
        startValue: startDim.alias || "开始",
        endValue: endDim.alias || "结束"
      };
      const newSource = [];
      privateData.rows.forEach(row => {
        newSource.push({
          xValue: row[nameDim.uid],
          startValue: row[startDim.uid],
          endValue: row[endDim.uid]
        })
      });
      return newSource;
    }
  }


  getDataAfterSort(dataSource) {
    this.originDataSource = JSON.parse(JSON.stringify(dataSource));
    let sortUid = this.getOption<string>("fields-data-sort-fields");
    let sortType = this.getOption("fields-data-sort-orderby");
    if(sortUid){
      dataSource = dataSource.sort((a,b)=>{
        let sortAxisKey = '';
        if (this.axisX[0].uid[2] === sortUid) {
          sortAxisKey = 'xValue'
        } else if (this.axisStart[0].uid[2] === sortUid) {
          sortAxisKey = 'startValue'
        } else if (this.axisEnd[0].uid[2] === sortUid) {
          sortAxisKey = 'endValue'
        }

        let aValue = a[sortAxisKey];
        let bValue = b[sortAxisKey];
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

  get boundaryGap() {
    return true;
  }

  get echartsSeriesOption(): CustomSeriesOption | any {
    //shape
    const barWidth = this.getOption<number>("shape-bar-width");
    const shapeSize = this.getOption<number[]>("shape-size");
    const shapeRadius = this.getOption("shape-radius");

    const showOtherShape = this.getOption("shape-show-top-and-bottom");
    const barOffsetX = (shapeSize[0] - barWidth) / 2;
    return {
      name: "value",
      type: "custom",
      colorBy: "data",
      renderItem: (params, api) => {
        let values0 = [api.value("xValue"), api.value("startValue")];
        let values1 = [api.value("xValue"), api.value("endValue")];
        let startPoint = api.coord(values0);
        let endPoint = api.coord(values1);

        const startX = endPoint[0] - barWidth / 2;
        return {
          type: 'group',
          children: [
            {
              type:'rect',
              shape: {
                x: showOtherShape ? startX - barOffsetX : startX,
                y: params.coordSys.y,
                width: showOtherShape ? barWidth + barOffsetX * 2 : barWidth,
                height: params.coordSys.height
              },
              style: {
                fill: new Color(this.getOption("shape-background-color")).toEchartsColor(),
              }
            },
            {
              type: 'rect',
              shape: {
                x: startX,
                y: Math.min(endPoint[1], startPoint[1]),
                width: barWidth,
                height: Math.abs(endPoint[1] - startPoint[1])
              },
              style: {
                fill: api.visual('color'),
              },
              emphasis: {
                style: {
                  fill: new Color(this.getOption("shape-emphasis-color")).toEchartsColor(),
                }
              }
            },
          ].concat(showOtherShape ? [
            {
              type: 'group',
              children:[
                {
                  type: 'rect',
                  shape: {
                    x: startX - barOffsetX,
                    y: Math.min(endPoint[1], startPoint[1]) - shapeSize[1] / 2,
                    width: barWidth + barOffsetX * 2,
                    height: shapeSize[1],
                    r: shapeRadius
                  },
                  style: {
                    fill: new Color(this.getOption("shape-top-color")).hexa(),
                    shadowBlur: 5,
                    shadowColor: new Color(this.getOption("shape-top-color")).hexa(),
                  }
                },
                {
                  type: 'rect',
                  shape: {
                    x: startX - barOffsetX,
                    y: Math.max(endPoint[1], startPoint[1]) - shapeSize[1] / 2,
                    width: barWidth + barOffsetX * 2,
                    height: shapeSize[1],
                    r: shapeRadius
                  },
                  style: {
                    fill: new Color(this.getOption("shape-bottom-color")).hexa(),
                    shadowBlur: 5,
                    shadowColor: new Color(this.getOption("shape-bottom-color")).hexa(),
                  }
                }
              ]
            }
          ] : [])
        }
      },
      encode: {
        x: "xValue",
        y: ["startValue", "endValue"],
      },
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

    let nameFontColor = new Color(this.getOption<Color>("tooltip-name-font-color")).hexa();
    let nameFontSize = this.getOption<number>("tooltip-name-font-size");
    let valueFontColor = new Color(this.getOption<Color>("tooltip-value-font-color")).hexa();
    let valueFontSize = this.getOption<number>("tooltip-value-font-size");
    let showTitle = this.getOption<boolean>("tooltip-title");
    let titleFontColor = new Color(this.getOption<Color>("tooltip-title-font-color")).hexa();
    let titleFontSize = this.getOption<number>("tooltip-title-font-size");

    const projectId = this.getBoard().projectId;
    const seriesCssColors = this.getSeriesCssColors();
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
        let seriesNameSet = new Set();
        for (let param of params || []) {
          if (seriesNameSet.has(param.seriesName)) continue;
          let iconHtml = showIcon ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${seriesCssColors[param.dataIndex % seriesCssColors.length]};"></span>` : "";

          let startValue = param.value?.startValue || 0;
          let endValue = param.value?.endValue || 0;
          startValue = Math.min(startValue, endValue);
          endValue = Math.max(startValue, endValue);
          if (tooltipStyle === "normal") {
            startValue = formatFloat(startValue, tooltipDecimalPlaces, tooltipCompleteZero);
            endValue = formatFloat(endValue, tooltipDecimalPlaces, tooltipCompleteZero);
          } else if (tooltipStyle === "percent") {
            startValue = formatFloat(startValue * 100, tooltipDecimalPlaces, tooltipCompleteZero) + "%";
            endValue = formatFloat(endValue * 100, tooltipDecimalPlaces, tooltipCompleteZero) + "%";
          }
          if(commaDisplay){
            startValue = this.doCommaSeparat(startValue)
            endValue = this.doCommaSeparat(endValue)
          }
          dataHtml += `<div>
            ${iconHtml}
            <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${param.value?.xValue}：</span>
            <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${startValue}-${endValue}</span>
          </div>`;
          seriesNameSet.add(param.seriesName);
        }
        let titleHtml = showTitle ? `<div>
          <span style="color:${titleFontColor};font-size:${titleFontSize}px;line-height:1;">${params[0]?.name}</span>
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

  get tooltipAxisPointer(): TooltipComponentOption["axisPointer"] {
    let axisPointerColor = this.toEchartsColor(new Color(this.getOption<Color>("tooltip-axisPointer-color")));
    let axisPointerShadowBlur = this.getOption<number>("tooltip-axisPointer-shadowBlur");
    let axisPointerShadowColor = this.toEchartsColor(new Color(this.getOption<Color>("tooltip-axisPointer-shadowColor")));
    let axisPointerShadowOffset = this.getOption("tooltip-axisPointer-shadowOffset");
    return {
      type: "shadow",
      axis: this.transposed ? "y" : "x",
      shadowStyle:{
        color:axisPointerColor,
        shadowBlur:axisPointerShadowBlur,
        shadowColor:axisPointerShadowColor,
        shadowOffsetX:axisPointerShadowOffset?.[0],
        shadowOffsetY:axisPointerShadowOffset?.[1],
        opacity:0.5
      }
    };
  }

  getSeriesCssColors(optionKey = "palette") {
    let colors = this.getOption<Color[]>(optionKey);
    if (!colors || colors.length == 0) {
      return this.defaultColors10;
    } else {
      return Array.from(colors).map((color) => {
        return new Color(color).toCssString();
      });
    }
  }

  // 轮播动画-跟axis中的轮播动画获取筛选值不一样-需要单独处理
  carouselAnimationDisplay() {
    let display_stay = Math.max(this.getOption<number>("animation-display-stay-column-carousel") * 1000, 1000);
    let x_uid = this.getOption("axis-x")?.[0]?.uid;
    let promise = Promise.resolve();
    let currentIndex = this.echartsChart.getOption().dataZoom?.[0]?.startValue || 0;
    let update_data = (resolve) => {
      if(this.resetSelectedIndex.value){
        this.resetSelectedIndex.value = !this.resetSelectedIndex.value
        currentIndex = 0;
      }
      // 先执行一次 否则刚开始会多停顿 display_stay 的时长
      let linkages = [];
      if (this.xTypes.length) {
        this.echartsChart.dispatchAction({ type: 'showTip', seriesIndex: this.xValuesToSeriesList[currentIndex]?.seriesIndex, dataIndex: this.xValuesToSeriesList[currentIndex]?.dataIndex });
        this.echartsChart.dispatchAction({ type: 'select', seriesIndex: this.xValuesToSeriesList[currentIndex]?.seriesIndex, dataIndex: this.xValuesToSeriesList[currentIndex]?.dataIndex });
      } else {
        this.echartsChart.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: currentIndex });
        this.echartsChart.dispatchAction({ type: 'select', dataIndex: currentIndex });
      }
      if (x_uid) {
        let targetIndex = this.xTypes.length ? this.xValuesToSeriesList[currentIndex]?.dataIndex : currentIndex
        let data = this.createView(["axis-x", "axis-start", "axis-end"]);
        let targetData = data[targetIndex];
        let fieldArr = this.getOption<string>("linkage-form-field")?.split(".");
        let fieldUIDs;
        let filterValue;
        if (targetData && fieldArr?.length) {
          if (fieldArr.length === 2) {
            fieldUIDs = [x_uid[0], ...fieldArr];
            filterValue = targetData[fieldArr[1]];
          } else if (fieldArr.length === 3) {
            fieldUIDs = [x_uid[0], fieldArr[0], `${fieldArr[1]}.${fieldArr[2]}`];
            filterValue = targetData[fieldArr[1]] ? targetData[fieldArr[1]].map(item => item[fieldArr[2]]) : targetData[fieldArr[2]];
          }
        }
        if(filterValue) {
          linkages.push({ uid: fieldUIDs, value: filterValue });
        }
      }
      this.animationTriggerLinkage && this.applyLinkage(linkages);
      currentIndex++;

      this.animation_display_timeout = setInterval(() => {
        if(currentIndex === this.datasetSource()?.length){
          currentIndex = 0
        }
        if(this.resetSelectedIndex.value){
          this.resetSelectedIndex.value = !this.resetSelectedIndex.value
          currentIndex = 0;
        }
        if (this.stopAnimate) {
          clearInterval(this.animation_display_timeout);
          this.echartsChart.dispatchAction({ type: 'hideTip' });
          this.echartsChart.dispatchAction({ type: 'unselect', dataIndex: currentIndex });
          return resolve();
        }
        if(this.animation_display_paused || this.isAnimating) return;

        //选中当前
        let linkages = [];
        if (this.xTypes.length) {
          this.echartsChart.dispatchAction({ type: 'showTip', seriesIndex: this.xValuesToSeriesList[currentIndex]?.seriesIndex, dataIndex: this.xValuesToSeriesList[currentIndex]?.dataIndex });
          this.echartsChart.dispatchAction({ type: 'select', seriesIndex: this.xValuesToSeriesList[currentIndex]?.seriesIndex, dataIndex: this.xValuesToSeriesList[currentIndex]?.dataIndex });
        } else {
          this.echartsChart.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: currentIndex });
          this.echartsChart.dispatchAction({ type: 'select', dataIndex: currentIndex });
        }
        if (x_uid) {
          let targetIndex = this.xTypes.length ? this.xValuesToSeriesList[currentIndex]?.dataIndex : currentIndex
          let data = this.createView(["axis-x", "axis-start", "axis-end"]);
          let targetData = data[targetIndex];
          let fieldArr = this.getOption<string>("linkage-form-field")?.split(".");
          let fieldUIDs;
          let filterValue;
          if (targetData && fieldArr?.length) {
            if (fieldArr.length === 2) {
              fieldUIDs = [x_uid[0], ...fieldArr];
              filterValue = targetData[fieldArr[1]];
            } else if (fieldArr.length === 3) {
              fieldUIDs = [x_uid[0], fieldArr[0], `${fieldArr[1]}.${fieldArr[2]}`];
              filterValue = targetData[fieldArr[1]] ? targetData[fieldArr[1]].map(item => item[fieldArr[2]]) : targetData[fieldArr[2]]
            }
          }
          if(filterValue) {
            linkages.push({ uid: fieldUIDs, value: filterValue });
          }
        }
        this.animationTriggerLinkage && this.applyLinkage(linkages);

        if (this.echartsChart.getOption().dataZoom?.length && currentIndex > this.echartsChart.getOption().dataZoom[0].endValue) {
          currentIndex = this.echartsChart.getOption().dataZoom[0].startValue;
          clearInterval(this.animation_display_timeout);
          this.echartsChart.dispatchAction({ type: 'hideTip' });
          this.echartsChart.dispatchAction({ type: 'select', dataIndex: -1 });
          this.animationTriggerLinkage && this.withdrawLinkage();
          resolve();
        }else{
          currentIndex++;
        }
      }, display_stay);
    };
    promise = new Promise((resolve) => {
      update_data(resolve);
    });
    return promise
  }

  get axisStart() {
    return this.getOption<OptionFieldValue[]>("axis-start") || [];
  }
  get axisEnd() {
    return this.getOption<OptionFieldValue[]>("axis-end") || [];
  }

  override getMetaData() {
    return merge(super.getMetaData(), {
      axisValue: [
        ...this.axisX,
        ...this.axisStart,
        ...this.axisEnd,
      ]
    } as WidgetMetaData);
  }

  public selectedIndex: Ref<number> = ref(-1);
  public selectedData: Ref<{}> = ref(null);
  public resetSelectedIndex: Ref<boolean> = ref(false);
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

      // 点击同一个点，取消选中
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
        // 取消上一次的选中
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
        let data = this.createView(["axis-x", "axis-start", "axis-end"]);
        const currentData = data[params.dataIndex];
        let uids = this.getOption("axis-x")?.[0]?.uid;
        if (uids?.length) {
          let fieldArr = this.getOption<string>("linkage-form-field")?.split(".")
          let fieldUIDs;
          let filterValue;
          if (fieldArr?.length) {
            if (fieldArr.length === 2) {
              fieldUIDs = [uids[0], ...fieldArr];
              filterValue = currentData[fieldArr[1]];
            } else if (fieldArr.length === 3) {
              fieldUIDs = [uids[0], fieldArr[0], `${fieldArr[1]}.${fieldArr[2]}`];
              filterValue = currentData[fieldArr[1]].map(item => item[fieldArr[2]]);
            }
          }
          this.applyLinkage({ uid: fieldUIDs as OptionFieldUID, value: filterValue });
        }
      }

    })
  }
}
