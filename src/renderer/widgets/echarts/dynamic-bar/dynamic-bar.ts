import { PrivateDataConnectionUID, PrivateDataTableUID, PrivateData } from "@common/types/project";
import { DefinedOptions, OptionFontValue, OptionFieldValue, OptionFileValue } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { TheWidget as Axis } from "@renderer/widgets/echarts/axis";
import { XAXisComponentOption, YAXisComponentOption, EChartsOption, SeriesOption, TooltipComponentOption } from "echarts/dist/echarts";
import resource from "./locales/index";
import { formatFloat } from "@common/utils/math";
import i18next from "@renderer/widgets/i18next";
import { recursive } from "merge";
import { equals } from "@common/utils/object";
import { watch } from "vue";

export class DynamicBar extends Axis {
  public dataLength = 0;
  public xTypeToRowsMap = new Map();
  public max = 0;
  public keyList = [];
  public xValues = [];
  static resource = recursive(true, Axis.resource, resource);
  static defineOptions(): DefinedOptions[] {
    const UNIT_MIAO = i18next.t("unitMiao");
    return [
      {
        data: {
          "fields": {
            alias: i18next.t("fieldsSetting"),
            fold: "unfold",
            children: [
              {
                name: "axis-x",
                alias: i18next.t("axisX"),
                type: "field(min=0, max=1)",
                default: [
                  { "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_name"], "__opt_type": "field"},
                ]
              },
              {
                name: "axis-y",
                alias: i18next.t("axisY"),
                type: "field(min=0, max=1)",
                default: [
                  { "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_value"], "__opt_type": "field"},
                ]
              },
              {
                name: "axis-dynamic-value",
                alias: i18next.t("axisDynamicValue"),
                type: "field(min=0, max=1)",
                default: [
                  { "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_year"], "__opt_type": "field"},
                ]
              },
              {
                name: "axis-group",
                alias: i18next.t("axisGroup"),
                type: "field(recommend=string, min=0, max=1)",
                visible: false,
              }
            ]
          },
          sort: {
            alias: i18next.t("sort"),
            children: [
              {
                name: "sort-object",
                type: "select",
                visible: false
              },
              {
                name: "sort-type",
                alias: i18next.t("sortType"),
                type: "select(radioGroup)",
                default: "normal",
                selectChoices: [
                  {
                    value: "normal",
                    label: i18next.t("sortTypeNormal"),
                  },
                  {
                    value: "ASC",
                    label: i18next.t("sortTypeAsc"),
                  },
                  {
                    value: "DESC",
                    label: i18next.t("sortTypeDesc"),
                  },
                ],
              },
              {
                name: "new-filter",
                type: "boolean",
                visible: false
              },
            ],
          },
        },
        style: {
          "axis": {
            visible: true,
            children: [
              {
                name: "x-display-cluster",
                alias: i18next.t("xAxis"),
                show: "tab",
                children: [
                  {
                    name: "x-data-type",
                    alias: i18next.t("xDataType"),
                    type: "select(radioGroup)",
                    default: "value",
                    visible: false,
                    selectChoices: [
                      {
                        value: "category",
                        label: i18next.t("category"),
                      },
                      {
                        value: "value",
                        label: i18next.t("value"),
                      },
                      {
                        value: "time",
                        label: i18next.t("time"),
                      },
                      {
                        value: "log",
                        label: i18next.t("log")
                      }
                    ],
                  },
                ],
              },
              {
                name: "y-display-cluster",
                alias: i18next.t("yAxis"),
                show: "tab",
                children: [
                  {
                    name: "y-data-type",
                    alias: i18next.t("yDataType"),
                    type: "select(radioGroup)",
                    default: "category",
                    visible: false,
                    selectChoices: [
                      {
                        value: "category",
                        label: i18next.t("category"),
                      },
                      {
                        value: "value",
                        label: i18next.t("value"),
                      },
                      {
                        value: "time",
                        label: i18next.t("time"),
                      },
                      {
                        value: "log",
                        label: i18next.t("log")
                      }
                    ],
                  },
                ],
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
                        name: "label-shape-spacing",
                        alias: i18next.t("labelShapeSpacing"),
                        type: "number(unit=px)",
                        default: 15
                      }
                    ]
                  },
                ],
              }
            ]
          },
          "series-color-group": {
            alias: i18next.t("seriesColorGroup"),
            children: [
              {
                cluster: "array",
                fold: "unfold",
                name: "series-color-cluster",
                visible: false,
                children: [],
              },
              {
                name: "bar-color-type",
                alias: i18next.t("barColorType"),
                type: "select(radioGroup)",
                default: "normal",
                selectChoices:[
                  {
                    label: i18next.t("barColorTypeNormal"),
                    value: "normal"
                  },
                  {
                    label: i18next.t("barColorTypeCustom"),
                    value: "custom"
                  }
                ]
              },
              {
                name: "bar-color",
                alias: i18next.t("seriesColorCluster"),
                type: "color(gradient)",
                default: "#1890FFFF",
                visible: (widget: DynamicBar) => {
                  return widget.getOption("bar-color-type") === "normal";
                },
              },
              {
                name: "bar-color-cluster",
                alias: i18next.t("barColorCluster"),
                cluster: "array",
                items: (widget: DynamicBar) => {
                  return [...widget.xValues];
                },
                itemsHint: i18next.t("topShapeDataType"),
                visible: (widget: DynamicBar) => {
                  return widget.getOption("bar-color-type") === "custom";
                },
                children: [
                  {
                    name: "bar-color-custom",
                    alias: i18next.t("barColor"),
                    type: "color(gradient)",
                    default: "#1890FFFF",
                  },
                ],
              },
            ],
          },
          "series-shape": {
            children: [
              {
                name: "series-shape-default-cluster",
                children: [
                  {
                    name: "series-shape-number-type",
                    visible: false
                  },
                  {
                    name: "shape-column-numbe",
                    visible: false
                  },
                  {
                    name: "dynamic-shape-number-type",
                    alias: i18next.t("shapeNumber"),
                    type: "select(radioGroup)",
                    default: "all",
                    selectChoices: [
                      {
                        value: "all",
                        label: i18next.t("shapeNumberAll"),
                      },
                      {
                        value: "custom",
                        label: i18next.t("shapeNumberCustom"),
                      },
                    ],
                  },
                  {
                    name: "custom-shape-number",
                    alias: i18next.t("customShapeNumber"),
                    type: "number(min=0)",
                    default: 5,
                    visible: (widget: DynamicBar) => {
                      return widget.getOption("dynamic-shape-number-type") === "custom"
                    }
                  },
                  {
                    name: "custom-shape-column-width",
                    alias: i18next.t("shapeColumnWidth"),
                    type: "number(unit=px)",
                    default: 10,
                    visible: (widget: DynamicBar) => {
                      return widget.getOption("dynamic-shape-number-type") === "custom";
                    }
                  },
                ],
              },
              {
                name: "series-shape-top-cluster",
                alias: i18next.t("topShape"),
                show: "tab",
                children: [
                  {
                    name: "top-shape",
                    alias: i18next.t("topShape"),
                    type: "boolean",
                    default: false,
                  },
                  {
                    name: "top-shape-offset",
                    alias: i18next.t("topShapeOffset"),
                    type: "vector<X,Y>(unit=px)",
                    default: [0, 0]
                  },

                  {
                    name: "top-shape-image-url",
                    alias: i18next.t("topShapeImageUrl"),
                    type: "file(format=image)",
                    default: "",
                  },
                  {
                    name: "top-shape-image-size",
                    alias: i18next.t("topShapeImageSize"),
                    type: "vector<W, H>",
                    default: [20, 20],
                  },
                  {
                    name: "top-shape-image-common",
                    alias: i18next.t("topShapeImageShowType"),
                    type: "select",
                    selectChoices: [
                      { label: i18next.t("topShapeImageCommon"), value: "common" },
                      { label: i18next.t("topShapeImageAlone"), value: "alone" }
                    ],
                    default: "common",
                  },
                  {
                    name: "top-shape-image-cluster",
                    alias: i18next.t("topShapeImageCluster"),
                    cluster: "array",
                    items: (widget: DynamicBar) => {
                      return [...widget.xValues];
                    },
                    itemsHint: i18next.t("topShapeDataType"),
                    visible: (widget: DynamicBar) => {
                      return widget.getOption("top-shape-image-common") === "alone";
                    },
                    children: [
                      {
                        name: "top-shape-image-url-custom",
                        alias: i18next.t("topShapeImageUrl"),
                        type: "file(format=image)",
                        default: "",
                      },
                    ],
                  },
                ]
              }
            ]
          },
          "animation-display": {
            alias: i18next.t("animationDisplayGroup"),
            visible: false,
            children: [
              {
                name: "animation-display",
                alias: i18next.t("animationDisplay"),
                type: "boolean",
                visible: false,
                default: true,
              },
              {
                name: "animation-display-loop",
                alias: i18next.t("animationDisplayLoop"),
                type: "boolean",
                default: false,
                visible: false
              },
              {
                name: "animation-display-delay",
                alias: i18next.t("animationDisplayDelay"),
                type: "number<float>(unit=" + UNIT_MIAO + ", min=0)",
                default: 1,
              },
              {
                name: "animation-update-duration",
                alias: i18next.t("animationUpdateDuration"),
                type: "number<float>(unit=" + UNIT_MIAO + ", min=0)",
                default: 1,
              },
              {
                name: "animation-display-type",
                type: "select(radioGroup)",
                visible: false,
              },
              {
                name: "animation-display-duration",
                type: "number<float>(unit=" + UNIT_MIAO + ", min=0)",
                visible: false,
              },
              {
                name: "animation-display-single-interval",
                type: "number<float>(unit=" + UNIT_MIAO + ", min=0)",
                visible: false,
              },
              {
                name: "animation-display-stay-column-carousel",
                type: "number<float>(unit=" + UNIT_MIAO + ")",
                visible: false

              },
              {
                name: "animation-display-interval",
                type: "number<float>(unit=" + UNIT_MIAO + ", min=0)",
                visible: false
              },
              {
                name: "display-with-linkage",
                type: "boolean",
                visible: false
              },
            ]
          },
        },
      },
      ...super.defineOptions(),
    ];
  }

  datasetSource() {
    if (this['_dataSource'].value === undefined) {
      this.effectScope.run(() => {
        watch(() => {
          if (this.status.isVisible || this._firstLoadData || !this["_dataSource"].value) {
            return this._datasetSource();
          } else {
            return this.lastestData || this["_dataSource"].value || [];
          }
        }, (value) => {
          if ((this.status.isVisible || this._firstLoadData) && JSON.stringify(value) !== JSON.stringify(this["_dataSource"].value)) {
            if (this.status.isVisible || this._firstLoadData) {
              this._firstLoadData = false;
              this['_dataSource'].value = value;
              this.dataChangeTime = Date.now();
              this.lastestData = null;
            } else {
              this.lastestData = value;
            }
          }
        }, { immediate: true });
      });
    }
    return this['_dataSource'].value || [];
  }

  _datasetSource() {
    let dataSource = [];
    let yDims = this.getOption<OptionFieldValue[]>("axis-y");
    let xDims = this.getOption<OptionFieldValue[]>("axis-x");
    let dynamicDims = this.getOption<OptionFieldValue[]>("axis-dynamic-value");
    if (xDims?.length && yDims?.length && dynamicDims?.length) {
      dataSource = this.createView(["axis-x", "axis-y", "axis-dynamic-value"]);
      dataSource.map(row => {
        row["sumVal"] = row[yDims[0].uid[2]];
        return row;
      });
    } else {
      let data = this.getPrivateData();
      let fields = data.fields;
      let rows = data.rows;
      let nameFields = fields.filter(item => {
        return item.type === "string"
      });
      let valueFields = fields.filter(item => {
        return item.type === "number"
      });
      if (nameFields.length && valueFields.length) {
        rows.forEach(item => {
          let tempData = {};
          nameFields.forEach((field, index) => {
            if (index < 2) {
              tempData[field.uid] = item[field.uid];
            }
          })
          valueFields.forEach((field, index) => {
            tempData[field.uid] = item[field.uid];
          })
          dataSource.push(tempData);
        });
        return dataSource;
      } else {
        dataSource = [];
      }
    }
    let zeroRemoval = this.getOption("zero-removal");
    if (zeroRemoval) {
      dataSource.map((item) => {
        for (let key in item) {
          if (!isNaN(item[key]) && item[key] == 0) {
            item[key] = "-";
          }
        }
      });
    }

    this.xTypeToRowsMap = new Map();
    let keyList = new Set();
    let valueList = new Set();
    dataSource.forEach(row => {
      const key = row[dynamicDims[0].uid[2]];
      const category = row[xDims[0].uid[2]];
      const value = row[yDims[0].uid[2]];
      keyList.add(key);
      valueList.add(category)
      if (!this.xTypeToRowsMap.has(key)) {
        this.xTypeToRowsMap.set(key, []);
      }
      let list = this.xTypeToRowsMap.get(key);
      let hasSame = false;
      list = list.map(item => { // 聚合
        if (item[0] === category) {
          hasSame = true;
          item[1] += value;
        }
        return item;
      })
      if (!hasSame) list.push([category, value]);
      this.xTypeToRowsMap.set(key, list)
    });

    this.keyList = Array.from(keyList);
    this.xValues = Array.from(valueList);
    this.dataLength = dataSource.length;
    return dataSource;
  }

  getDataAfterFilter(dataSource) {
    return dataSource;
  }

  get echartsXAxisOption(): XAXisComponentOption | XAXisComponentOption[] {
    return {
      ...super.echartsXAxisOption,
      // type: "value",
      max: 'dataMax'
    }
  }

  get echartsYAxisOption(): YAXisComponentOption[] {
    let yAxisOption = this.getSingleYAxisOption("y");
    if (this.getOption("sort-type") === "DESC") {
      yAxisOption.inverse = true;
    } else if (this.getOption("sort-type") === "ASC") {
      yAxisOption.inverse = false;
    }

    if (this.getOption("dynamic-shape-number-type") === "custom") {
      yAxisOption.max = this.getOption<number>("custom-shape-number") - 1;
    }
    return [yAxisOption];
  }

  get echartsTooltipOption(): TooltipComponentOption | TooltipComponentOption[] {
    let paddingWidth = this.getOption<number>("tooltip-padding-width");
    let paddingHeight = this.getOption<number>("tooltip-padding-height");
    let showIcon = this.getOption<boolean>("tooltip-icon");
    let barColorType = this.getOption("bar-color-type");
    let barColor = this.getOption("bar-color");

    let nameFontColor = new Color(this.getOption<Color>("tooltip-name-font-color")).hexa();
    let nameFontSize = this.getOption<number>("tooltip-name-font-size");
    let valueFontColor = new Color(this.getOption<Color>("tooltip-value-font-color")).hexa();
    let valueFontSize = this.getOption<number>("tooltip-value-font-size");
    let showTitle = this.getOption<boolean>("tooltip-title");
    let titleFontColor = new Color(this.getOption<Color>("tooltip-title-font-color")).hexa();
    let titleFontSize = this.getOption<number>("tooltip-title-font-size");

    const seriesCssColors = this.getSeriesCssColors();

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
    return {
      ...super.echartsTooltipOption,
      formatter: (params) => {
        let dataHtml = "";
        let seriesNameSet = new Set();
        if (this.stack) {
          params.reverse()
        }
        for (let param of params || []) {
          if(seriesNameSet.has(param.seriesName)) continue;
          // 根据seriesName中的'__$'筛选要显示在提示框上的信息
          if(param.seriesName.includes("__$") || param.seriesName.includes("-bg") || param.seriesName.includes("topShape")) continue;
          let iconColor;
          if(barColorType === "normal") {
            iconColor = new Color(this.getOption("bar-color")).toEchartsColor();
          } else {
            let index = this.xValues.indexOf(params[0].name);
            let indexes = this.getArrayClusterIndexes("bar-color-cluster") || [];
            if(indexes[index]) {
              iconColor = new Color(this.getOption<Color>(["bar-color-cluster", indexes[index], "bar-color-custom"])).toEchartsColor();
            } else {
              iconColor = barColor;
            }
          }
          let iconHtml = showIcon ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${iconColor};"></span>` : "";
          let valueUid = param.dimensionNames[param.encode.y[0]];
          if(this.transposed){
            valueUid = param.dimensionNames[param.encode.x[0]];
          }
          let val = param.value[1];
          if(isNaN(val)) continue;
          if(lineUids.includes(valueUid)){
            if (tooltipRightStyle === "normal") {
              val = formatFloat(val, tooltipRightDecimalPlaces, tooltipRightCompleteZero);
            } else if (tooltipRightStyle === "percent") {
              val = formatFloat(val * 100, tooltipRightDecimalPlaces, tooltipRightCompleteZero) + "%";
            }
          }else{
            if (tooltipStyle === "normal") {
              val = formatFloat(val, tooltipDecimalPlaces, tooltipCompleteZero);
            } else if (tooltipStyle === "percent") {
              val = formatFloat(val * 100, tooltipDecimalPlaces, tooltipCompleteZero) + "%";
            }
          }
          if(commaDisplay){
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
        let titleNameUid = this.transposed? params[0].dimensionNames[params[0].encode['y'][0]] :params[0].dimensionNames[params[0].encode['x'][0]]
        let titleHtml = showTitle ? `<div>
          <span style="color:${titleFontColor};font-size:${titleFontSize}px;line-height:1;">${params[0]?.value[titleNameUid]}</span>
        </div>` : "";

        let paddingStyle = "0";
        if(titleHtml || dataHtml){
          paddingStyle = `${paddingHeight}px ${paddingWidth}px`;
        }
        return `
          <div style="padding: ${paddingStyle};">
            ${titleHtml}
            <div>${dataHtml}</div>
          </div>
        `;
      }
    }
  }


  get transposed(): boolean {
    return true;
  }

  get echartsOptionFunc(): {[key: string]: Function} {
    return {
      grid: ()=>this.echartsGridOption,
      xAxis: ()=>this.echartsXAxisOption,
      yAxis: ()=>this.echartsYAxisOption,
      tooltip: ()=>this.echartsTooltipOption,
      legend: ()=>this.echartsLegendOption,
      series: ()=>this.echartsSeriesOption,
      dataZoom: ()=>this.echartsDataZoomOption,
      dataset: ()=>this.echartsDatasetOption(),
      color: ()=>this.getSerieEchartsColors(),
      animationDuration: ()=>0,
      animationDurationUpdate: ()=>this.getOption<number>("animation-update-duration") * 1000,
      animationEasing: ()=>'linear',
      animationEasingUpdate: ()=>'linear'
    };
  }
  echartsDatasetOption() {
    let targetSource = this.xTypeToRowsMap.get(this.keyList[0]) || [];
    return { source: targetSource };
  }

  protected getDefaultPrivateData(): PrivateData {
    return {
      fields: [
        { uid: "f_name", alias: "种类", type: "string" },
        { uid: "f_value", alias: "销量", type: "number" },
        { uid: "f_year", alias: "月份", type: "number" },
      ],
      rows: [
        { f_name: '茶饮料', f_value: 1234, f_year: "1月" },
        { f_name: '咖啡', f_value: 789, f_year: "1月" },
        { f_name: '气泡水', f_value: 576, f_year: "1月" },
        { f_name: '碳酸饮料', f_value: 872, f_year: "1月" },
        { f_name: '饮用水', f_value: 1520, f_year: "1月" },

        { f_name: '茶饮料', f_value: 1048, f_year: "2月" },
        { f_name: '咖啡', f_value: 735, f_year: "2月" },
        { f_name: '气泡水', f_value: 505, f_year: "2月" },
        { f_name: '碳酸饮料', f_value: 680, f_year: "2月" },
        { f_name: '饮用水', f_value: 1000, f_year: "2月" },

        { f_name: '茶饮料', f_value: 1548, f_year: "3月" },
        { f_name: '咖啡', f_value: 935, f_year: "3月" },
        { f_name: '气泡水', f_value: 1005, f_year: "3月" },
        { f_name: '碳酸饮料', f_value: 980, f_year: "3月" },
        { f_name: '饮用水', f_value: 1700, f_year: "3月" },

        { f_name: '茶饮料', f_value: 1348, f_year: "4月" },
        { f_name: '咖啡', f_value: 935, f_year: "4月" },
        { f_name: '气泡水', f_value: 1405, f_year: "4月" },
        { f_name: '碳酸饮料', f_value: 1580, f_year: "4月" },
        { f_name: '饮用水', f_value: 2000, f_year: "4月" },

        { f_name: '茶饮料', f_value: 1748, f_year: "5月" },
        { f_name: '咖啡', f_value: 1135, f_year: "5月" },
        { f_name: '气泡水', f_value: 1205, f_year: "5月" },
        { f_name: '碳酸饮料', f_value: 1780, f_year: "5月" },
        { f_name: '饮用水', f_value: 2300, f_year: "5月" },
      ],
    };
  }

  getTopShapeImageSrc(index) {
    const imageCommon = this.getOption("top-shape-image-common");
    let imageOptions = this.getOption<OptionFileValue>('top-shape-image-url');
    let indexes = this.getArrayClusterIndexes("top-shape-image-cluster");
    if (imageCommon !== "common") {
      imageOptions = this.getOption<OptionFileValue>(["top-shape-image-cluster", indexes[index], "top-shape-image-url-custom"]);
    }
    if (typeof imageOptions === "string") {
      return imageOptions;
    } else {
      return imageOptions.url || this.handleImageSrc(imageOptions.relativePath);
    }
  }

  get echartsSeriesOption(): SeriesOption | SeriesOption[] {
    let yDims = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let xDims = this.getOption<OptionFieldValue[]>("axis-x") || [];
    let shapeColumnNumber = this.getOption<number>("shape-column-number");
    shapeColumnNumber = shapeColumnNumber < 2 ? 2 : shapeColumnNumber;
    let labelPosition = this.getOption<any>("label-position");
    let seriesOpt = [];
    let seriesColor = this.getSeriesColors();
    let barColor = new Color(this.getOption("bar-color")).toEchartsColor();
    let labelFont = this.getOption<OptionFontValue>("label-font");
    let labelShapeSpacing = this.getOption<number>("label-shape-spacing");
    let isPercent = this.getOption("label-text-type") === "percent";
    let labelDecimalPlaces = this.getOption<number>("label-decimal-places");
    let isComplete = this.getOption<boolean>("label-complete-zero");
    let colorFollow = this.getOption("label-color-type") === "follow";
    let unitFont = this.getOption<OptionFontValue>("label-unit-font");
    let yLabel = this.getOption("label-y");
    let singleSeriesOpt = <any>null;

    let privateYDims = [];
    let privateXDims = [];
    if (!yDims.length || !xDims.length) {
      let fields = this.getPrivateData().fields;
      fields?.map(item => {
        if (item.type == "number") {
          privateYDims.push({ alias: item?.alias, type: item?.type, uid: ["", "", item?.uid] })
        } else if (item.type == "string") {
          privateXDims.push({ alias: item?.alias, type: item?.type, uid: ["", "", item?.uid] })
        }
      })
      yDims = privateYDims;
      xDims = privateXDims;
    }

    let index = 0;
    // 使用自带数据
    let name;
    let yUid;
    if (!this.usePrivateData) {
      name = this.getFieldAlias(yDims[index].uid);
      yUid = yDims[index].uid[2];
    } else {
      name = privateYDims[index].alias;
      yUid = privateYDims[index].uid;
    }

    if (this.getOption("top-shape")) {
      let [offsetX, offsetY] = this.getOption<number[]>("top-shape-offset") || [0, 0];
      let [ imageWidth, imageHeight ] = this.getOption<number[]>("top-shape-image-size") || [20, 20];
      let topShapeSeriesOpt = {
        id: `${yUid}-bar-image-${0}`,
        name,
        type: 'scatter',
        silent: true,
        symbol: (value) => {
          let index = this.xValues.indexOf(value[0]);
          return "image://" + this.getTopShapeImageSrc(index);
        },
        symbolSize:[imageWidth, imageHeight],
        symbolOffset: [offsetX, offsetY]
      }
      seriesOpt.push(topShapeSeriesOpt);
    }
    let columnCustom = this.getOption<string>("dynamic-shape-number-type") === "custom";
    let shapeColumnWidth = columnCustom ? this.getOption<number>("custom-shape-column-width") : "auto";
    let barColorType = this.getOption("bar-color-type");
    singleSeriesOpt = {
      name,
      id: `${yUid}-bar-${index}`,
      type: "bar",
      realtimeSort: this.getOption("sort-type") !== "normal",
      silent: false,
      barWidth: shapeColumnWidth,
      selectedMode: "single",
      label: {
        show: this.getOption("label"),
        position: labelPosition,
        distance: labelShapeSpacing,
        valueAnimation: true,
        formatter: (param) => {
          let unit = this.getOption<string>("label-unit-value");
          let val = param.value[1];
          if (!isPercent) {
            val = formatFloat(val, labelDecimalPlaces, isComplete);
          } else {
            val = formatFloat(val * 100, labelDecimalPlaces, isComplete);
            unit = unit || "%";
          }
          if (this.getOption("hide-zero-value") && Number(val) == 0) {
            return ""
          }
          return yLabel ? `{value|${param.name}}{value|-}{value|${val}}{unit|${unit}}` : `{value|${val}}{unit|${unit}}`;
        },
        rich: {
          value: {
            color: colorFollow ? seriesColor[index][0] : this.toEchartsColor(labelFont.color as Color) || "#ffffff",
            fontWeight: labelFont.bold ? "bold" : "normal",
            fontStyle: labelFont.italic ? "italic" : "normal",
            fontSize: labelFont.size,
            fontFamily: labelFont.family,
            shadowBlur: 0,
            align: "center",
            verticalAlign: "middle"
          },
          unit: {
            color: unitFont.color,
            fontWeight: unitFont.bold ? "bold" : "normal",
            fontStyle: unitFont.italic ? "italic" : "normal",
            fontSize: unitFont.size,
            fontFamily: unitFont.family,
          }
        }
      },
      itemStyle: {
        color: (params) => {
          if(barColorType === "normal") {
            return barColor;
          } else {
            let index = this.xValues.indexOf(params.value[0]);
            let indexes = this.getArrayClusterIndexes("bar-color-cluster") || [];
            if(indexes[index]) {
              return new Color(this.getOption<Color>(["bar-color-cluster", indexes[index], "bar-color-custom"])).toEchartsColor();
            } else {
              return barColor;
            }
          }
        }
      },
      markLine: this.markLineOption,
      emphasis: {
        label: {
          show: this.getOption("label")
        }
      }
    }
    seriesOpt.push(singleSeriesOpt);
    return seriesOpt;
  }

  get axisAnimation() {
    return true;
  }

  get animationDurationUpdate() {
    return this.getOption<number>("animation-update-duration") * 100;
  }

  checkErrorData() {
    let yDims = this.getOption<OptionFieldValue[]>("axis-y");
    let xDims = this.getOption<OptionFieldValue[]>("axis-x");
    if (xDims?.length && yDims?.length) {
      this.clearErrorDataStatus();
    } else if (!yDims.length && !xDims.length) {
      this.addErrorDataStatus("filed-empty");
    } else {
      this.addErrorDataStatus("filed-incomplete");
    }
  }
}
