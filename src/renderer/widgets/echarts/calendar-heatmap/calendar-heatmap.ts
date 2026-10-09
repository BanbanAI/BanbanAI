import { PrivateData, PrivateDataConnectionUID, PrivateDataTableUID, OptionFieldUID } from "@common/types/project";
import { DefinedOptions, OptionFieldValue, OptionFontValue, WidgetMetaData, ChartClickState } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { TheWidget as ColorLump, component as B2ColorLump } from "@renderer/widgets/echarts/color-lump";
import { CustomSeriesOption, CalendarComponentOption, EChartsOption } from "echarts/dist/echarts";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { merge, recursive } from "merge";
import { ref, Ref } from "vue";
import dayjs from "dayjs";

export class CalendarHeatmap extends ColorLump {
  static resource:any = recursive(true, ColorLump.resource, resource);
  public selectedIndex: Ref<number> = ref(-1);
  public selectedData: Ref<{}> = ref(null);
  public resetSelectedIndex: Ref<boolean> = ref(false);

  static defineOptions(): DefinedOptions[] {
    return [
      {
        data: {
          fields: {
            alias: i18next.t("fieldsSetting"),
            children: [
              {
                name: "axis-date",
                alias: i18next.t("axisDate"),
                type: "field(max=1)",
                default: [{"uid":[PrivateDataConnectionUID,PrivateDataTableUID,"f_date"],"__opt_type":"field","summary":""}]
              },
              {
                name: "axis-angle",
                visible: false
              },
              {
                name: "axis-radius",
                visible: false
              },
              {
                name: "axis-value",
                alias: i18next.t("axisValue"),
                type: "field(aggs=sum|max|min|mean|count|distinct, max=1)",
                default: [{"uid":[PrivateDataConnectionUID,PrivateDataTableUID,"f_value"],"__opt_type":"field","summary":"sum"}]
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
          basic: {
            children: [
              {
                name: "time-range-custom",
                alias: i18next.t("timeRangeCustom"),
                type: "boolean",
                default: false
              },
              {
                name: "show-all-year",
                alias: i18next.t("showAllYear"),
                type: "boolean",
                default: true,
                visible:(widget: CalendarHeatmap)=>{
                  return !widget.getOption("time-range-custom")
                }
              },
              {
                name: "start-time",
                alias: i18next.t("startTime"),
                type: "string",
                default: "2023-01-01",
                visible:(widget: CalendarHeatmap)=>{
                  return widget.getOption("time-range-custom")
                }
              },
              {
                name: "end-time",
                alias: i18next.t("endTime"),
                type: "string",
                default: "2023-12-01",
                visible:(widget: CalendarHeatmap)=>{
                  return widget.getOption("time-range-custom")
                }
              }
            ]
          },
          label: {
            alias: i18next.t("label"),
            type: "boolean",
            default: true,
            children:[
              {
                name: "date-label-font",
                alias: i18next.t("dateLabelFont"),
                type: "font",
                default: {
                  size: 12,
                  color: "#fff"
                },
              },
              {
                name: "month-label-font",
                alias: i18next.t("monthLabelFont"),
                type: "font",
                default: {
                  size: 12,
                  color: "#fff"
                },
              }
            ]
          },
          "date-splitline": {
            alias: i18next.t("dateSplitline"),
            children: [
              {
                name: "splitline-color",
                alias: i18next.t("splitlineColor"),
                type: "color",
                default: "#000"
              },
              {
                name: "splitline-width",
                alias: i18next.t("splitlineWidth"),
                type: "number(unit=px, min=0)",
                default: 1
              }
            ]
          },
          "axis": {
            visible: false
          }
        }
      },
      ...super.defineOptions(),
    ]
  }

  get echartsOptionFunc(): {[key: string]: Function} {
    return {
      visualMap: ()=>this.echartsVisualMapOption,
      calendar: ()=>this.echartsCalendarOption,
      tooltip: ()=>this.echartsTooltipOption,
      series: ()=>this.echartsSeriesOption,
      dataset: ()=>this.echartsDatasetOption(),
    };
  }

  getMaxAndMinData(sourceData=[]) {
    let minTime = "2099-01-01";
    let maxTime = "0";
    for(let data of sourceData) {
      if(data?.dateValue) {
        let time = dayjs(data.dateValue).format("YYYY-MM-DD");
        let minStr = minTime.replace(/\-/g, "");
        let maxStr = minTime.replace(/\-/g, "");
        let timeStr = time.replace(/\-/g, "");
        if(Number(minStr) > Number(timeStr)) {
          minTime = time;
        }
        if(Number(maxStr) < Number(timeStr)) {
          maxTime = time;
        }
      }
    }
    if(sourceData.length == 0){
      return {min: minTime, max: dayjs(Date.now()).format("YYYY-MM-DD")}
    }
    return {min: minTime, max: maxTime};
  }

  get echartsCalendarOption(): CalendarComponentOption {
    let showLabel = this.getOption<boolean>("label");
    let dateLabelFont = this.getOption<OptionFontValue>("date-label-font");
    let monthLabelFont = this.getOption<OptionFontValue>("month-label-font");
    let borderColor = new Color(this.getOption<Color>("color-piece-border-color")).hexa();
    let borderSize = this.getOption<number>("color-piece-border-width");
    let splitlineColor = new Color(this.getOption<Color>("splitline-color")).hexa();
    let splitlineSize = this.getOption<number>("splitline-width");

    let sourceData = this.datasetSource();
    let startTime = this.getOption<string>("start-time");
    let endTime = this.getOption<string>("end-time");
    let range = dayjs(sourceData[0]?.dateValue || Date.now()).year();
    if(!this.getOption<boolean>("time-range-custom")) {
      if(!this.getOption("show-all-year")) {
        let {max, min} = this.getMaxAndMinData(sourceData)
        range = [min, max];
      }
    } else {
      range = [ dayjs(startTime).format("YYYY-MM-DD"), dayjs(endTime).format("YYYY-MM-DD") ];
    }
    return {
      top: 20 + this.padding.top,
      left: 50 + this.padding.left,
      right: 20 + this.padding.right,
      bottom: 20 + this.padding.bottom,
      cellSize: ["auto", "auto"],
      range: range,
      itemStyle: {
        color: this.getSerieEchartsColors()[0] || "transparent",
        borderWidth: borderSize,
        borderColor: borderColor
      },
      splitLine: {
        lineStyle: {
          color: splitlineColor,
          width: splitlineSize
        }
      },
      yearLabel: { show: false },
      dayLabel: {
        show: showLabel,
        nameMap: ["星期日","星期一","星期二","星期三","星期四","星期五","星期六"],
        color: new Color(dateLabelFont.color).hexa(),
        fontSize: dateLabelFont.size,
        fontFamily: dateLabelFont.family,
        fontWeight: dateLabelFont.bold ? "bold" : "normal",
        fontStyle: dateLabelFont.italic ? "italic" : "normal",
      },
      monthLabel: {
        show: showLabel,
        nameMap: "ZH",
        color: new Color(monthLabelFont.color).hexa(),
        fontSize: monthLabelFont.size,
        fontFamily: monthLabelFont.family,
        fontWeight: monthLabelFont.bold ? "bold" : "normal",
        fontStyle: monthLabelFont.italic ? "italic" : "normal",
      }
    }
  }
  protected getDefaultPrivateData(): PrivateData {
    return {
      fields: [
        { uid: "f_date", alias: "日期", type: "string" },
        { uid: "f_value", alias: "数量", type: "number" },
      ],
      rows: [
        { f_date: "2022-01", f_value: 1000 },
        { f_date: "2022-02", f_value: 859 },
        { f_date: "2022-03", f_value: 652 },
        { f_date: "2022-04", f_value: 222 },
        { f_date: "2022-05", f_value: 435 },
        { f_date: "2022-06", f_value: 789 },
        { f_date: "2022-07", f_value: 1500 },
        { f_date: "2022-08", f_value: 1120 },
        { f_date: "2022-09", f_value: 789 },
      ],
    };
  }

  checkErrorData() {
    let angleDims = this.getOption<OptionFieldValue[]>("axis-date");
    let valueDims = this.getOption<OptionFieldValue[]>("axis-value");
    if (angleDims?.length && valueDims?.length) {
      this.clearErrorDataStatus();
    } else if(angleDims?.length || valueDims?.length) {
      this.addErrorDataStatus("filed-incomplete");
    } else {
      this.addErrorDataStatus("filed-empty");
    }
  }

  get ignoreDims(): `f_${string}`[] {
    const ignoreArr = []
    let angleDimUid = this.getOption<OptionFieldValue[]>("axis-date")?.[0]?.uid?.[2];
    if (angleDimUid) ignoreArr.push(angleDimUid)
    return ignoreArr
  }
  _datasetSource() {
    let angleDims = this.getOption<OptionFieldValue[]>("axis-date");
    let valueDims = this.getOption<OptionFieldValue[]>("axis-value");
    if (angleDims?.length && valueDims?.length) {
      let source = this.createView(["axis-date", "axis-value"]);
      source = this.dealDataByAggregate(source, [angleDims[0]], valueDims);
      this.nameMap = {
        dateValue: this.getFieldAlias(angleDims[0].uid),
        value: this.getFieldAlias(valueDims[0].uid),
      };
      let newSource = [];
      source.forEach(row => {
        let dataItem = {};
        dataItem["dateValue"] = row[angleDims[0].uid[2]];
        const val = this.getMetric(row, valueDims[0]);
        dataItem["value"] = val;
        newSource.push(dataItem);
      })
      return newSource;
    }else{
      const privateData = this.getPrivateData();
      const dateDim = privateData.fields.find(field => field.uid === "f_date");
      const valueDim = privateData.fields.find(field => field.uid === "f_value");
      this.nameMap = {
        dateValue: dateDim.alias || "日期",
        value: valueDim.alias || "数量",
      };
      const newSource = [];
      privateData.rows.forEach(row => {
        newSource.push({
          dateValue: row[dateDim.uid],
          value: row[valueDim.uid]
        })
      });
      return newSource;
    }
  }

  get echartsSeriesOption(): CustomSeriesOption | any {
    return {
      name: "value",
      type: "heatmap",
      coordinateSystem: "calendar",
      encode: {
        value: "value"
      },
      silent: false
    }
  }

  get axisDate() {
    return this.getOption<OptionFieldValue[]>("axis-date") || [];
  }

  override getMetaData() {
    return merge(super.getMetaData(), {
      axisValue: [
        ...this.axisDate,
        ...this.axisValue
      ]
    } as WidgetMetaData);
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
        name: params.data.dateValue,
        value: params.data.value
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

        let uids = this.getOption("axis-date")?.[0]?.uid;
        let data = this.createView(["axis-date", "axis-value"]);
        const currentData = data[params.dataIndex];
        if (uids?.length) {
          let fieldArr = this.getOption<string>("linkage-form-field")?.split(".")
          let fieldUIDs;
          let filterValue = params.data.dateValue;
          if (fieldArr?.length) {
            if (fieldArr.length === 2) {
              fieldUIDs = [uids[0], ...fieldArr];
              filterValue = currentData[fieldArr[1]];
            } else if (fieldArr.length === 3) {
              fieldUIDs = [uids[0], fieldArr[0], `${fieldArr[1]}.${fieldArr[2]}`];
              filterValue = currentData[fieldArr[1]].map(item => item[fieldArr[2]]);
            }
          }
          // console.log("calendar-heatmap", { uid: fieldUIDs as OptionFieldUID, value: filterValue });
          this.applyLinkage({ uid: fieldUIDs as OptionFieldUID, value: filterValue });
        }
      }

    })
  }
}
