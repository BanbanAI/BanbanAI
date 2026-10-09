import { PrivateData, PrivateDataConnectionUID, PrivateDataTableUID } from "@common/types/project";
import { DefinedOptions, OptionFontValue, OptionFileValue, OptionFieldValue, WidgetMetaData } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { formatFloat } from "@common/utils/math";
import { TheWidget as Echarts, component as B2Chart } from "@renderer/widgets/echarts/basic";
import { LegendComponentOption, TooltipComponentOption, XAXisComponentOption, YAXisComponentOption, SeriesOption } from "echarts/dist/echarts";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { ref, watch } from "vue";
import { merge, recursive } from "merge";
import {
  evaluateBucketStageTableAggregateField,
  getTableAggregateFieldRows,
  shouldBypassSecondarySummary,
} from "../../basic/_common/tableAggregateField";
export class ProgressV2 extends Echarts {
  static resource = recursive(true, Echarts.resource, resource);
  static defineOptions(): DefinedOptions[] {
    const UNIT_WEI = i18next.t("unitWei");
    const UNIT_PIAN = i18next.t("unitPian");
    return [
      {
        data: {
          fields: {
            alias: i18next.t("basic_option"),
            children: [
              {
                name: "axis-value",
                type: "field(aggs=sum|count|distinct)",
                alias: i18next.t("axis_value"),
                default: [{"uid":[PrivateDataConnectionUID,PrivateDataTableUID,"f_2"],"__opt_type":"field","summary":"sum"}]
              },
              {
                name: "axis-value-field",
                type: "select",
                alias: i18next.t("axis_value_field"),
                selectChoices: (element: ProgressV2) => {
                  let choices = [];
                  let valueDims = element.getOption<OptionFieldValue[]>(["axis-value"]) || [];
                  let xUid = valueDims[0].uid[2]
                  if (valueDims[0]?.summary === "count") {
                    element.datasetSource().forEach((row)=>{
                      choices.push({ value: row[xUid], label: row[xUid] });
                    })
                  }
                  return choices;
                },
                visible:(element: ProgressV2) => element.getOption<OptionFieldValue[]>(["axis-value"])[0]?.summary === "count"
              },
              {
                name: "axis-fields",
                visible: false
              }
            ],
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
          "series-color": {
            alias: i18next.t("series_color"),
            visible:false,
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
                    name: "label",
                    alias: i18next.t("label"),
                    type: "boolean",
                    default: false,
                  },
                  {
                    name: "item-default",
                    alias: i18next.t("full"),
                    fold: "unfold",
                    children: [
                      {
                        name: "label-position",
                        alias: i18next.t("label_position"),
                        default: "outside",
                        type: "select(radioGroup)",
                        selectChoices: [
                          {
                            label: i18next.t("center"),
                            value: "inside",
                          },
                          {
                            label: i18next.t("follow"),
                            value: "outside",
                          },
                          {
                            label: i18next.t("top"),
                            value:"top"
                          }
                        ],
                        visible: (progress: ProgressV2) => {
                          return (
                            progress.getOption<string>("shape") === "column" ||
                            progress.getOption<string>("shape") === "rect"
                          );
                        },
                      },
                      {
                        name: "label-color-type",
                        alias: i18next.t("label_color_type"),
                        default: "normal",
                        type: "select(radioGroup)",
                        selectChoices: [
                          {
                            value: "normal",
                            label: i18next.t("default"),
                          },
                          {
                            value: "follow",
                            label: i18next.t("follow"),
                          },
                        ],
                        visible: false
                      },
                      {
                        name: "label-font",
                        alias: i18next.t("font"),
                        type: "font",
                        default: {
                          family: "sans-serif",
                          size: 12,
                          bold: false,
                          italic: false,
                          underline: false,
                          "line-through": false,
                        },
                      },
                      {
                        name: "label-offset",
                        alias: i18next.t("labelOffset"),
                        type: "vector<x,y>(unit=px)",
                        default: [0, 0]
                      },
                      {
                        name: "label-shadow-color",
                        alias: i18next.t("shadow_color"),
                        type: "color",
                        default: "#ffffff",
                      },
                      {
                        name: "label-shadow-blur",
                        alias: i18next.t("shadow_blur"),
                        type: "number(unit=px)",
                        default: 0,
                      },
                      {
                        name: "label-shadow-offset-x",
                        alias: i18next.t("shadow_offset_x"),
                        type: "number(unit=px)",
                        default: 0,
                      },
                      {
                        name: "label-shadow-offset-y",
                        alias: i18next.t("shadow_offset_y"),
                        type: "number(unit=px)",
                        default: 0,
                      },
                    ]
                  },
                  {
                    name: "label-type-cluster",
                    alias: i18next.t("data_formmat"),
                    fold:"unfold",
                    children: [
                      {
                        name: "label-text-type",
                        alias: i18next.t("text_data_formmat"),
                        default: "percent",
                        type: "select(radioGroup)",
                        selectChoices: [
                          {
                            label: i18next.t("value"),
                            value: "normal",
                          },
                          {
                            label: i18next.t("percentage"),
                            value: "percent",
                          },
                        ],
                      },
                      {
                        name: "label-decimal-places",
                        alias: i18next.t("decimal_places"),
                        type: "number(unit=" + UNIT_WEI + ")",
                        default: 2,
                      },
                      {
                        name: "label-complete-zero",
                        alias: i18next.t("complete_zero"),
                        type: "boolean",
                        default: false,
                      },
                    ],
                  },
                ]
              }
            ]
          },
          shape: {
            alias: i18next.t("shape"),
            children: [
              {
                //图形形状
                name: "shape",
                alias: i18next.t("shape"),
                type: "select(radioGroup)",
                default: "ring",
                selectChoices: [
                  {
                    value: "rect",
                    label: i18next.t("rect"),
                  },
                  {
                    value: "column",
                    label: i18next.t("column"),
                  },
                  {
                    value: "ring",
                    label: i18next.t("ring"),
                  },
                ],
              },
              {
                name: "progress-color",
                alias: i18next.t("progress_color"),
                type: "color(gradient)",
                default: "#1890FF",
              },
              {
                name:"data-start-angle",
                alias:i18next.t("data_start_angle"),
                type:"number(min=-360,max=360,step=1,showInput,unit=°)",
                default:-90,
                visible: (progress: ProgressV2) => {
                  return progress.getOption<string>("shape") == "ring";
                },
              },
              {
                name:"data-end-angle",
                alias:i18next.t("data_end_angle"),
                type:"number(min=-360,max=360,step=1,showInput,unit=°)",
                default:270,
                visible: (progress: ProgressV2) => {
                  return progress.getOption<string>("shape") == "ring";
                },
              },
              {
                //图形底色
                name: "shape-background",
                alias: i18next.t("shape_background"),
                type: "color(gradient)",
                default: "#E6F3F7",
              },
              {
                //圆环类型  直角圆角
                name: "ring-type",
                alias: i18next.t("ring_type"),
                type: "select(radioGroup)",
                default: "square",
                selectChoices: [
                  {
                    value: "square",
                    label: i18next.t("square"),
                  },
                  {
                    value: "round",
                    label: i18next.t("round"),
                  },
                ],
                visible: false,
              },
              {
                //圆环宽度
                name: "ring-size",
                alias: i18next.t("ring_size"),
                default: 25,
                type: "number(min=0,max=100,showInput,unit=%)",
                visible: (progress: ProgressV2) => {
                  return progress.getOption<string>("shape") == "ring";
                },
              },
              {
                //圆环间隔
                name: "ring-spacing",
                alias: i18next.t("ring_spacing"),
                default: 0,
                type: "number(unit=px)",
                visible: (progress: ProgressV2) => {
                  return false;//功能暂未实现
                  return progress.getOption<string>("shape") == "ring";
                },
              },
              {
                //填充形状
                name: "bar-shape",
                alias: i18next.t("bar_shape"),
                type: "select(radioGroup)",
                default: "normal",
                selectChoices: [
                  {
                    value: "normal",
                    label: i18next.t("normal"),
                  },
                  {
                    value: "burst",
                    label: i18next.t("burst"),
                  },
                  {
                    value: "bold",
                    label: i18next.t("bold"),
                  },
                ],
              },
              {
                //背景分片
                name: "background-shape_burst",
                alias: i18next.t("background_shape_burst"),
                type: "boolean",
                default: false,
                visible: (progress: ProgressV2) => {
                  return progress.getOption<string>("bar-shape") == "burst";
                },
              },
              {
                //分片数量
                name: "bar-shape_burst-number",
                alias: i18next.t("bar_shape_burst_number"),
                type: "number(min=1,unit=" + UNIT_PIAN + ")",
                default: 20,
                visible: (progress: ProgressV2) => {
                  return progress.getOption<string>("bar-shape") == "burst";
                },
              },
              {
                //分片数量
                name: "bar-shape_burst-interval",
                alias: i18next.t("bar_shape_burst_interval"),
                type: "number(min=0,unit=px)",
                default: 10,
                visible: (progress: ProgressV2) => {
                  return progress.getOption<string>("bar-shape") == "burst";
                },
              },
              {
                //填充圆角半径
                name: "fill-border-radius",
                alias: i18next.t("fill_border_radius"),
                type: "number(min=0,unit=px)",
                default: 0,
              },
              {
                name: "border-cluster",
                alias: i18next.t("border_style"),
                visible: false,
                children: [
                  {
                    //圆环内边框类型
                    name: "ring-border-inside-dash",
                    type: "select(radioGroup)",
                    default: "solid",
                    alias: i18next.t("ring_border_inside_width"),
                    selectChoices: [
                      {
                        value: "solid",
                        label: i18next.t("solid"),
                      },
                      {
                        value: "dotted",
                        label: i18next.t("dotted"),
                      },
                    ],
                    visible: (progress: ProgressV2) => {
                      return progress.getOption<string>("shape") == "ring";
                    },
                  },
                  {
                    //圆环内边框宽度
                    name: "ring-border-inside-width",
                    alias: i18next.t("ring_border_inside_width"),
                    default: 0,
                    type: "number(unit=px)",
                    visible: (progress: ProgressV2) => {
                      return progress.getOption<string>("shape") == "ring";
                    },
                  },
                  {
                    //圆环内边框颜色
                    name: "ring-border-inside-color",
                    alias: i18next.t("ring_border_inside_color"),
                    default: "#1890FF",
                    type: "color",
                    visible: (progress: ProgressV2) => {
                      return progress.getOption<string>("shape") == "ring";
                    },
                  },
                  {
                    //圆环外边框类型
                    name: "ring-border-outside-dash",
                    type: "select(radioGroup)",
                    default: "solid",
                    alias: i18next.t("ring_border_outside_dash"),
                    selectChoices: [
                      {
                        value: "solid",
                        label: i18next.t("solid"),
                      },
                      {
                        value: "dotted",
                        label: i18next.t("dotted"),
                      },
                    ],
                    visible: (progress: ProgressV2) => {
                      return progress.getOption<string>("shape") == "ring";
                    },
                  },
                  {
                    //圆环外边框宽度
                    name: "ring-border-outside-width",
                    alias: i18next.t("ring_border_outside_width"),
                    default: 0,
                    type: "number(unit=px)",
                    visible: (progress: ProgressV2) => {
                      return progress.getOption<string>("shape") == "ring";
                    },
                  },
                  {
                    //圆环外边框颜色
                    name: "ring-border-outside-color",
                    alias: i18next.t("ring_border_outside_color"),
                    default: "#1890FF",
                    type: "color",
                    visible: (progress: ProgressV2) => {
                      return progress.getOption<string>("shape") == "ring";
                    },
                  },
                  {
                    //图形边框宽度
                    name: "shape-border-width",
                    alias: i18next.t("shape_border_width"),
                    default: 0,
                    type: "number(unit=px)",
                    visible: (progress: ProgressV2) => {
                      return (
                        progress.getOption<string>("shape") === "column" ||
                        progress.getOption<string>("shape") === "rect"
                      );
                    },
                  },
                  {
                    //图形边框颜色
                    name: "shape-border-color",
                    alias: i18next.t("shape_border_color"),
                    default: "#1890FF",
                    type: "color",
                    visible: (progress: ProgressV2) => {
                      return (
                        progress.getOption<string>("shape") === "column" ||
                        progress.getOption<string>("shape") === "rect"
                      );
                    },
                  },
                ],
              },
              {
                name: "shape-end-point-image",
                alias: i18next.t("endPointImageUrl"),
                type: "file(format=image)",
                default: ""
              },
              {
                name: "shape-end-point-image-size",
                alias: i18next.t("endPointImageSize"),
                type: "vector<W,H>",
                default: [30,30]
              },
              {
                name: "end-point-offset",
                alias: i18next.t("end-point-offset"),
                type: "vector<x,y>(unit=px)",
                default: [0, 0],
                visible: (widget: ProgressV2) => {
                  return widget.getOption<boolean>("end-point") ;
                },
              },
            ],
          },
          legend: {
            visible: false,
          },
          tooltip: {
            visible: false,
          },
        },
      },
      ...super.defineOptions(),
    ];
  }

  protected getDefaultPrivateData(): PrivateData {
    return {
      fields: [
      {uid: "f_1", alias: "水果", type: "string"},
      {uid: "f_2", alias: "数量", type: "number"},
    ],
      rows: [
        { f_1: '苹果', f_2: 36 },
        { f_1: '香蕉', f_2: 18 },
        { f_1: '橘子', f_2: 25 },
      ],
    };
  }

  _datasetSource() {
    let valueDims = this.getOption<OptionFieldValue[]>(["axis-value"]) || [];
    if (valueDims.length && shouldBypassSecondarySummary(this, valueDims[0])) {
      const value = evaluateBucketStageTableAggregateField(this, valueDims[0], getTableAggregateFieldRows(this, valueDims[0].uid)) ?? 0;
      return [{
        [valueDims[0].uid[2]]: value,
        [`${valueDims[0].uid[2]}_count`]: value,
      }];
    }

    let source = this.createView(["axis-value"])
    if (valueDims.length && valueDims[0]?.summary === "count") {
      source = this.dealDataByCount(source, [valueDims[0].uid[2]], valueDims)
    }
    return source;
  }

  dealDataByCount(sourceData,categoryUids,valueDims) {
    let temp = {};
    sourceData.forEach((row,index)=>{
      let xVals = []
      for(let xuid of categoryUids){
        xVals.push(row[xuid]);
      }
      let xKey = xVals.join("$") + "$";
      if(!temp[xKey]){
        temp[xKey] = { ...row };
        for(let key in temp[xKey]){
          let valueDim = valueDims.find((dim)=> dim?.uid?.[2] === key);
          if(valueDim && valueDim?.summary === "count"){
            let count = temp[xKey][`${key}_count`] || 0;
            temp[xKey][`${key}_count`] = count + 1;
          }
        }
      }else{
        for(let key in temp[xKey]){
          let valueDim = valueDims.find((dim)=> dim?.uid?.[2] === key);
          if(valueDim && valueDim?.summary === "count"){
            let count = temp[xKey][`${key}_count`] || 1;
            temp[xKey][`${key}_count`] = count + 1;
          }
        }
      }
    })
    let values = Object.values(temp);
    const xUid = valueDims[0].uid[2] + '_count';
    const sumValue: any = values.reduce((pre, cur) => pre + cur[xUid], 0);
    values.forEach(row => {
      row[xUid] = row[xUid] / sumValue;
    });
    return values;
  }

  get defaultPadding() {
    const padding = {
      left: 10,
      right: 10,
      top: 10,
      bottom: 10
    }

    let progressShape = this.getOption<string>("shape");
    let labelPosition = this.getOption<string>("label-position");
    if (labelPosition === "top" && progressShape == "column") {
      padding.top = 20;
    } else if (labelPosition === "top" &&  progressShape == "rect") {
      padding.right = 20;
    }

    return padding;
  }
  get chartSizeOpts() {
    let paddingTop = this.getOption<string>("padding-top") == "auto" ? this.defaultPadding.top : this.getOption<number>("padding-top-diy");
    let paddingRight = this.getOption<string>("padding-right") == "auto" ? this.defaultPadding.right : this.getOption<number>("padding-right-diy");
    let paddingBottom = this.getOption<string>("padding-bottom") == "auto" ? this.defaultPadding.bottom : this.getOption<number>("padding-bottom-diy");
    let paddingLeft = this.getOption<string>("padding-left") == "auto" ? this.defaultPadding.left : this.getOption<number>("padding-left-diy");
    let left = paddingLeft;
    let right = paddingRight;
    let bottom = paddingBottom;
    let top = paddingTop;
    let width = this.contentSize.width;
    let height = this.contentSize.height;

    return { left, right, top, bottom, width, height };
  }

  getPathData(options){
    let progressFillBorderRadius = this.getOption<number>("fill-border-radius");
    let {leftX, rightX , topY, bottomY} = options;
    let svgPathData = "";
    if(!progressFillBorderRadius){
      svgPathData = svgPathData.concat(`
        M${leftX},${topY}
        L${rightX},${topY}
        L${rightX},${bottomY}
        L${leftX},${bottomY}
      Z`);
    }else{
      let centerX = (leftX + rightX) / 2;
      let centerY = (bottomY + topY) / 2;
      svgPathData = svgPathData.concat(`
        M${Math.min(leftX+progressFillBorderRadius,centerX)},${topY}
        L${Math.max(rightX-progressFillBorderRadius,centerX)},${topY}
        Q${rightX},${topY} ${rightX},${Math.min(topY+progressFillBorderRadius,centerY)}
        L${rightX},${Math.max(bottomY-progressFillBorderRadius,centerY)}
        Q${rightX},${bottomY} ${Math.max(rightX-progressFillBorderRadius,centerX)},${bottomY}
        L${Math.min(leftX+progressFillBorderRadius,centerX)},${bottomY}
        Q${leftX},${bottomY} ${leftX},${Math.max(bottomY-progressFillBorderRadius,centerY)}
        L${leftX},${Math.min(topY+progressFillBorderRadius,centerY)}
        Q${leftX},${topY} ${Math.min(leftX+progressFillBorderRadius,centerX)},${topY}
      Z`);
    }
    return svgPathData;
  }

  checkErrorData() {
    let valDims = this.getOption<OptionFieldValue[]>(["axis-value"]) || [];
      if(valDims.length){
        this.clearErrorDataStatus();
      } else {
        if(!valDims.length) {
          this.addErrorDataStatus("filed-empty");
        } else {
          this.addErrorDataStatus("filed-incomplete");
        }
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

  get echartsSeriesOption(): SeriesOption {
    let progressShape = this.getOption<string>("shape");
    let progressColor = new Color(this.getOption<Color>("progress-color")).toEchartsColor();
    let progressBackgroundColor = new Color(this.getOption<Color>("shape-background")).toEchartsColor();
    let progressBarShape = this.getOption<string>("bar-shape");
    let progressBackgroundBurst = progressBarShape == "burst" && this.getOption<boolean>("background-shape_burst");
    let progressBurstNumber = this.getOption<number>("bar-shape_burst-number");
    let progressBurstInterval = this.getOption<number>("bar-shape_burst-interval");
    let progressFillBorderRadius = this.getOption<number>("fill-border-radius");
    let progressRingPercent = this.getOption<number>("ring-size") * 0.01;
    let progressBorderWidth = this.getOption<number>("shape-border-width");
    let progressBorderColor = new Color(this.getOption<Color>("shape-border-color")).toEchartsColor();
    let progressLabel = this.getOption<boolean>("label");
    let labelPosition = this.getOption<string>("label-position");
    let labelFont = this.getOption<OptionFontValue>("label-font");
    let labelOffset = this.getOption<number[]>("label-offset");
    let labelValueType = this.getOption<string>("label-text-type");
    let labelValueDecimalPlaces = this.getOption<number>("label-decimal-places");
    let labelValueCompleteZero = this.getOption<boolean>("label-complete-zero");


    let endImage = this.imageSrc(this.getOption("shape-end-point-image"));
    let endImageSize = this.getOption("shape-end-point-image-size");
    let endImageOffset = this.getOption("end-point-offset");

    let labelShadowColor = this.getOption("label-shadow-color");
    let labelShadowBlur = this.getOption("label-shadow-blur");
    let labelShadowOffsetX = this.getOption("label-shadow-offset-x");
    let labelShadowOffsetY = this.getOption("label-shadow-offset-y");
    let startAngles = this.getOption<number>("data-start-angle") + 360;
    let endAngles = this.getOption<number>("data-end-angle") + 360;
    let progressValue = 0.5;
    let valDims = this.getOption<OptionFieldValue[]>(["axis-value"]) || [];
    let position;
    const dataSource = this.datasetSource() || [];
    let valDimsField =this.getOption("axis-value-field");
    if(valDims.length){
      let dataIndex = 0
      const isBucketStage = shouldBypassSecondarySummary(this, valDims[0]);
      const valUid = valDims[0].summary === 'count' && !isBucketStage ? `${valDims[0]?.uid[2]}_count` : valDims[0]?.uid[2];
      if (valDims[0].summary === "count" && !isBucketStage) {
        dataIndex = dataSource.findIndex((row)=>row[valDims[0]?.uid[2]] === valDimsField);
      }
      progressValue = dataSource?.[dataIndex]?.[valUid] || 0;
    }
    let that = this;
    let chartSizeOpts = this.chartSizeOpts;
    //计算数字宽度和高度
    const getEleSize =(fontSize,fontFamily,conent)=>{
      let spanObj = document.createElement('span');
      let result = {};
      spanObj.style.fontSize = fontSize;
      spanObj.style.fontFamily = fontFamily;
      spanObj.style.visibility = "hidden";
      spanObj.style.display = "inline-block";
      document.body.appendChild(spanObj);
      spanObj.textContent = conent;
      result.width = parseFloat(window.getComputedStyle(spanObj).width);
      result.height = parseFloat(window.getComputedStyle(spanObj).height);
      spanObj.remove()
      return result;
    }

    return {
      name: "value",
      type: "custom",
      coordinateSystem: 'none',
      renderItem: (params, api) => {
        let shapGroupChildren = [];
        let viewSize = Math.min(chartSizeOpts.width, chartSizeOpts.height);
        let shapeScale = progressBarShape == "bold" ? 1.5 : 1;
        let scale1 = 0.9;//主轴缩放
        let scale2 = 0.4;//副轴缩放
        let valueText:any = progressValue;
        if (labelValueType === "normal") {
          valueText = formatFloat(valueText, labelValueDecimalPlaces, labelValueCompleteZero);
        } else {
          valueText = formatFloat(valueText * 100, labelValueDecimalPlaces, labelValueCompleteZero) + '%';
        }
        let size = getEleSize(`${labelFont?.size}px`,labelFont?.family,valueText)
        let diffX = chartSizeOpts.left - chartSizeOpts.right;
        let diffY = chartSizeOpts.top - chartSizeOpts.bottom;
        if(progressShape == "ring") {
          let r = viewSize / 2 * 0.75;
          let ringSize = Math.min(r, Math.max(0, progressRingPercent * r));
          let ringOffset = ringSize * (shapeScale - 1) / 2;
          let centerX = chartSizeOpts.width / 2 + diffX;
          let centerY = chartSizeOpts.height / 2 + diffY;
          let outerR = r;
          let innerR = r - ringSize;
          let intervalAngle = Math.PI / 180 * progressBurstInterval;
          let singleShapeAngle = (Math.PI * 2 - intervalAngle * progressBurstNumber) / progressBurstNumber;
          if(progressBackgroundBurst) {
            let startAngle = Math.PI/180 * startAngles;
            let totalAngle = Math.PI/180 * endAngles;

            let svgPathData = "";
            for(let burstIndex = 0; burstIndex < progressBurstNumber; burstIndex++){
              let endAngle = Math.max(startAngle, Math.min(totalAngle, startAngle + singleShapeAngle));
              svgPathData = svgPathData.concat(`
                M${centerX + Math.cos(startAngle) * innerR},${centerY + Math.sin(startAngle) * innerR}
                L${centerX + Math.cos(startAngle) * outerR},${centerY + Math.sin(startAngle) * outerR}
                A${outerR},${outerR},0,0,1,${centerX + Math.cos(endAngle) * outerR},${centerY + Math.sin(endAngle) * outerR}
                L${centerX + Math.cos(endAngle) * innerR},${centerY + Math.sin(endAngle) * innerR}
                A${innerR},${innerR},0,0,0,${centerX + Math.cos(startAngle) * innerR},${centerY + Math.sin(startAngle) * innerR}
              Z`);
              startAngle = startAngle + intervalAngle + singleShapeAngle;
            }
            shapGroupChildren.push({
              type: "path",
              id: "background",
              shape: {
                pathData: svgPathData,
              },
              style: {
                fill: progressBackgroundColor
              }
            });
          } else {
            shapGroupChildren.push({
              type: "sector",
              id: "background",
              shape: {
                cx: centerX,
                cy: centerY,
                r0: r - ringSize,
                r: r,
                startAngle: Math.PI/180 * startAngles,
                endAngle: Math.PI/180 * endAngles
              },
              style: {
                fill: progressBackgroundColor
              }
            });
          }
          if(progressBarShape == "burst") {
            //分片
            let startAngle = Math.PI/180 * startAngles;
            let totalAngle =  (Math.PI/180 * endAngles - Math.PI/180 * startAngles) * progressValue + Math.PI/180 * startAngles;

            let svgPathData = "";
            for(let burstIndex = 0; burstIndex < progressBurstNumber; burstIndex++){
              let endAngle = Math.max(startAngle, Math.min(totalAngle, startAngle + singleShapeAngle));
              svgPathData = svgPathData.concat(`
                M${centerX + Math.cos(startAngle) * innerR},${centerY + Math.sin(startAngle) * innerR}
                L${centerX + Math.cos(startAngle) * outerR},${centerY + Math.sin(startAngle) * outerR}
                A${outerR},${outerR},0,0,1,${centerX + Math.cos(endAngle) * outerR},${centerY + Math.sin(endAngle) * outerR}
                L${centerX + Math.cos(endAngle) * innerR},${centerY + Math.sin(endAngle) * innerR}
                A${innerR},${innerR},0,0,0,${centerX + Math.cos(startAngle) * innerR},${centerY + Math.sin(startAngle) * innerR}
              Z`);
              startAngle = startAngle + intervalAngle + singleShapeAngle;
            }
            shapGroupChildren.push({
              type: "path",
              id: "value",
              shape: {
                pathData: svgPathData,
              },
              style: {
                fill: progressColor
              }
            });

          } else {
            shapGroupChildren.push({
              type: "sector",
              id: "value",
              shape: {
                cx: centerX,
                cy: centerY,
                r0: r - ringSize - ringOffset,
                r: r + ringOffset,
                startAngle: Math.PI/180 * startAngles,
                endAngle: (Math.PI/180 * endAngles - Math.PI/180 * startAngles) * progressValue + Math.PI/180 * startAngles,
                cornerRadius: progressFillBorderRadius
              },
              style: {
                fill: progressColor
              }
            });
          }
          if(progressLabel){
            shapGroupChildren.push({
              type: "text",
              id: "label",
              style: {
                text: valueText,
                fontSize: labelFont.size,
                fontFamily: labelFont.family,
                fontWeight: labelFont.bold ? "bold" : "normal",
                fontStyle: labelFont.italic ? "italic" : "normal",
                fill: that.toEchartsColor(labelFont.color as Color),
                x: chartSizeOpts.width / 2 + diffX + labelOffset[0],
                y: chartSizeOpts.height / 2 + diffY + size?.height/10 + labelOffset[1], //文字高度/10 达到居中,
                align: "center",
                verticalAlign: "middle",
                textShadowColor: that.toEchartsColor(labelShadowColor as Color),
                textShadowBlur: labelShadowBlur,
                textShadowOffsetX: labelShadowOffsetX,
                textShadowOffsetY: labelShadowOffsetY
              }
            });
          }

          if(endImage) {
            let endAngle = (Math.PI/180 * endAngles - Math.PI/180 * startAngles) * progressValue + Math.PI/180 * startAngles;
            shapGroupChildren.push({
              type: "image",
              id: "end-image",
              style: {
                image: endImage,
                x: centerX + Math.cos(endAngle) * (innerR + ringSize / 2) - endImageSize[0] / 2,
                y: centerY + Math.sin(endAngle) * (innerR + ringSize / 2) - endImageSize[1] / 2,
                width: endImageSize[0],
                height: endImageSize[1]
              },
              silent: true
            });
          }

        } else if(progressShape == "rect") {
          let rectBackgroundWidth = chartSizeOpts.width * scale1;
          let rectBackgroundHeight = chartSizeOpts.height * scale2;
          let topY = (chartSizeOpts.height - rectBackgroundHeight) / 2 + diffY;
          let bottomY = topY + rectBackgroundHeight;
          let singleShapeWidth = (rectBackgroundWidth - progressBurstInterval * (progressBurstNumber - 1)) / progressBurstNumber;
          if(labelPosition === "inside"){
            position = chartSizeOpts.width / 2 +diffX
          }else if(labelPosition === "outside"){
            position =(chartSizeOpts.width - rectBackgroundWidth) / 2 + rectBackgroundWidth * progressValue + diffX;
          }else{
            position = rectBackgroundWidth + diffX + (chartSizeOpts.width - rectBackgroundWidth) / 2
          }
          if(progressBackgroundBurst) {
            let leftX = (chartSizeOpts.width - rectBackgroundWidth) / 2 + diffX;
            let totalWidth = leftX + rectBackgroundWidth;
            let svgPathData = "";
            for(let burstIndex = 0; burstIndex < progressBurstNumber; burstIndex++){
              let rightX = Math.max(leftX, Math.min(totalWidth, leftX + singleShapeWidth));
              svgPathData = svgPathData.concat(this.getPathData({ leftX, rightX, topY, bottomY}));
              leftX = leftX + progressBurstInterval + singleShapeWidth;
            }
            shapGroupChildren.push({
              type: "path",
              id: "background",
              shape: {
                pathData: svgPathData,
              },
              style: {
                fill: progressBackgroundColor
              }
            });
          } else {
            shapGroupChildren.push({
              type: "rect",
              id: "background",
              shape: {
                x: (chartSizeOpts.width - rectBackgroundWidth) / 2 + diffX,
                y: (chartSizeOpts.height - rectBackgroundHeight) / 2 + diffY,
                width: rectBackgroundWidth,
                height: rectBackgroundHeight,
                r: progressFillBorderRadius
              },
              style: {
                fill: progressBackgroundColor
              }
            });
          }
          if(progressBarShape == "burst") {
            //分片
            let leftX = (chartSizeOpts.width - rectBackgroundWidth) / 2 + diffX;
            let totalWidth = leftX + rectBackgroundWidth * progressValue;
            let svgPathData = "";
            for(let burstIndex = 0; burstIndex < progressBurstNumber; burstIndex++){
              let rightX = Math.max(leftX, Math.min(totalWidth, leftX + singleShapeWidth));
              svgPathData = svgPathData.concat(this.getPathData({ leftX, rightX, topY, bottomY}));
              if(rightX == totalWidth) break;
              leftX = leftX + progressBurstInterval + singleShapeWidth;
            }
            shapGroupChildren.push({
              type: "path",
              id: "value",
              shape: {
                pathData: svgPathData,
              },
              style: {
                fill: progressColor
              }
            });
          } else {
            shapGroupChildren.push({
              type: "rect",
              id: "value",
              shape: {
                x: (chartSizeOpts.width - rectBackgroundWidth) / 2 + diffX,
                y: (chartSizeOpts.height - rectBackgroundHeight * shapeScale) / 2 +diffY,
                width: rectBackgroundWidth * progressValue,
                height: rectBackgroundHeight * shapeScale,
                r: progressFillBorderRadius
              },
              style: {
                fill: progressColor
              }
            });
          }
          if(progressLabel) {
            shapGroupChildren.push({
              type: "text",
              id: "label",
              style: {
                text: valueText,
                fontSize: labelFont.size,
                fontWeight: labelFont.bold ? "bold" : "normal",
                fontStyle: labelFont.italic ? "italic" : "normal",
                fill: that.toEchartsColor(labelFont.color as Color),
                x: position + labelOffset[0],
                y: chartSizeOpts.height / 2 + diffY + size?.height/10 + labelOffset[1], //文字高度/10 达到居中
                align: labelPosition == "inside" ? "center" : "left",
                verticalAlign: "middle",
              }
            });
          }

          if (endImage) {
            // 条形结束点图片
            shapGroupChildren.push({
              type: "image",
              id: "end-bar",
              z2: 0,
              style: {
                image: endImage,
                x: (chartSizeOpts.width - rectBackgroundWidth) / 2 + diffX + rectBackgroundWidth * progressValue + endImageOffset[0],
                y: (chartSizeOpts.height) / 2 + diffY - endImageSize[1] / 2 - endImageOffset[1],
                width: endImageSize[0],
                height: endImageSize[1],
                r: progressFillBorderRadius
              },
            })
          }
        } else {
          let rectBackgroundWidth = chartSizeOpts.width * scale2;
          let rectBackgroundHeight = chartSizeOpts.height * scale1;
          let leftX = (chartSizeOpts.width - rectBackgroundWidth) / 2 + diffX;
          let rightX = leftX + rectBackgroundWidth;
          let singleShapeHeight = (rectBackgroundHeight - progressBurstInterval * (progressBurstNumber - 1)) / progressBurstNumber;
          if(labelPosition === "inside"){
            position = chartSizeOpts.height / 2 +diffY;
          }else if(labelPosition === "outside"){
            position = (chartSizeOpts.height - rectBackgroundHeight) / 2 + rectBackgroundHeight * (1 - progressValue) + diffY;
          }else{
            position = diffY +  (chartSizeOpts.height - rectBackgroundHeight) / 2
          }
          if(progressBackgroundBurst) {
            let bottomY = (chartSizeOpts.height + rectBackgroundHeight) / 2 + diffY;
            let totalHeight = bottomY - rectBackgroundHeight ;
            let svgPathData = "";

            for(let burstIndex = 0; burstIndex < progressBurstNumber; burstIndex++){
              let topY = Math.min(bottomY, Math.max(totalHeight, bottomY - singleShapeHeight));
              svgPathData = svgPathData.concat(this.getPathData({ leftX, rightX, topY, bottomY}));
              bottomY = bottomY - progressBurstInterval - singleShapeHeight;
            }

            shapGroupChildren.push({
              type: "path",
              id: "background",
              shape: {
                pathData: svgPathData,
              },
              style: {
                fill: progressBackgroundColor
              }
            });

          } else {
            shapGroupChildren.push({
              type: "rect",
              id: "background",
              shape: {
                x: (chartSizeOpts.width - rectBackgroundWidth) / 2 + diffX,
                y: (chartSizeOpts.height - rectBackgroundHeight) / 2 + diffY,
                width: rectBackgroundWidth,
                height: rectBackgroundHeight,
                r: progressFillBorderRadius
              },
              style: {
                fill: progressBackgroundColor
              }
            });
          }
          if(progressBarShape == "burst") {
            let bottomY = (chartSizeOpts.height + rectBackgroundHeight) / 2 + diffY;
            let totalHeight = bottomY - rectBackgroundHeight * progressValue;
            let svgPathData = "";
            for(let burstIndex = 0; burstIndex < progressBurstNumber; burstIndex++){
              let topY = Math.min(bottomY, Math.max(totalHeight, bottomY - singleShapeHeight));
              svgPathData = svgPathData.concat(this.getPathData({ leftX, rightX, topY, bottomY}));
              if(topY == totalHeight) break;
              bottomY = bottomY - progressBurstInterval - singleShapeHeight;
            }

            shapGroupChildren.push({
              type: "path",
              id: "value",
              shape: {
                pathData: svgPathData,
              },
              style: {
                fill: progressColor
              }
            });
          } else {
            shapGroupChildren.push({
              type: "rect",
              id: "value",
              shape: {
                x: (chartSizeOpts.width - rectBackgroundWidth * shapeScale) / 2 + diffX,
                y: (chartSizeOpts.height - rectBackgroundHeight) / 2 + rectBackgroundHeight * (1 - progressValue) + diffY,
                width: rectBackgroundWidth * shapeScale,
                height: rectBackgroundHeight * progressValue,
                r: progressFillBorderRadius
              },
              style: {
                fill: progressColor
              }
            });
          }
          if(progressLabel){
            shapGroupChildren.push({
              type: "text",
              id: "label",
              style: {
                text: valueText,
                fontSize: labelFont.size,
                fontWeight: labelFont.bold ? "bold" : "normal",
                fontStyle: labelFont.italic ? "italic" : "normal",
                fill: that.toEchartsColor(labelFont.color as Color),
                x: chartSizeOpts.width / 2 + diffX + labelOffset[0],
                y: position + size?.height/10 + labelOffset[1], //文字高度/10 达到居中,
                align: "center",
                verticalAlign: labelPosition == "inside" ? "middle" : "bottom",
              }
            });
          }
          if (endImage) {
            // 柱形结束点图片
            shapGroupChildren.push({
              type: "image",
              id: "end-column",
              style: {
                image: endImage,
                x: chartSizeOpts.width / 2 + diffX - endImageSize[0] / 2 + endImageOffset[0],
                y: (chartSizeOpts.height - rectBackgroundHeight) / 2 + rectBackgroundHeight * (1 - progressValue) + diffY - endImageSize[1] - endImageOffset[1],
                width: endImageSize[0],
                height: endImageSize[1],
                r: progressFillBorderRadius
              },
            })
          }
        }

        return {
          type: "group",
          children: shapGroupChildren
        };
      },
      silent: true,
    }
  }

  getLegendOtherOption() {
    return {
      show: false
    }
  }

  get echartsTooltipOption(): TooltipComponentOption{
    return {
      show: false
    }
  }

  get echartsXAxisOption(): XAXisComponentOption{
    return {
      show: false
    }
  }

  get echartsYAxisOption(): YAXisComponentOption{
    return {
      show: false
    }
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

