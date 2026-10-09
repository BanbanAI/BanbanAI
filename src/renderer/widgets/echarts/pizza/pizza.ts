import { PrivateData, PrivateDataConnectionUID, PrivateDataTableUID, OptionFieldUID } from "@common/types/project";
import { DefinedOptions, OptionFieldValue, OptionFontValue, OptionFileValue, WidgetMetaData, ChartClickState } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { TheWidget as EchartsChart, component as B2Chart } from "@renderer/widgets/echarts/basic";
import { CustomSeriesOption, EChartsOption, TooltipComponentOption} from "echarts/dist/echarts";
import { formatFloat } from "@common/utils/math";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { merge, recursive } from "merge";
import { Ref, ref } from "vue";

export class Pizza extends EchartsChart {
  protected nameMap: any;
  static resource = recursive(true, EchartsChart.resource, resource);
  static defineOptions(): DefinedOptions[] {
    return [
      {
        data: {
          fields: {
            alias: i18next.t("fields"),
            fold: "unfold",
            children: [
              {
                name: "axis-fields",
                alias: i18next.t("axisFields"),
                type: "field",
                default: [{"uid":[PrivateDataConnectionUID,PrivateDataTableUID,"f_angle"],"__opt_type":"field","summary":""}]
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
          "angle-axis": {
            alias: i18next.t("angleAxis"),
            children: [
              {
                name: "angle-axis-label",
                alias: i18next.t("angleAxisLabel"),
                type: "boolean",
                default: true,
              },
              {
                name: "angle-axis-font",
                alias: i18next.t("angleAxisFont"),
                type: "font",
                default: {
                  size: 12,
                  color: "#fff"
                },
              },
              {
                name: "angle-axis-offset",
                alias: i18next.t("angleAxisOffset"),
                type: "number(unit=px)",
                default: 1,
              },
              {
                name: "angle-axis-color",
                alias: i18next.t("angleAxisColor"),
                type: "color",
                default: "#fff",
              },
              {
                name: "angle-axis-width",
                alias: i18next.t("angleAxisWidth"),
                type: "number(unit=px, min=0)",
                default: 1,
              },
            ]
          },
          "label-group": {
            default: false,
            visible: false,
          },
          legend: {
            default: false,
            visible: false,
          },
          sort: {
            default: false,
            visible: false
          },
        },
      },
      ...super.defineOptions(),
    ];
  }

  get echartsOptionFunc(): {[key: string]: Function} {
    return {
      tooltip: ()=>this.echartsTooltipOption,
      polar: ()=>this.echartsPolarOption,
      angleAxis: ()=>this.echartsAngleAxisOption,
      radiusAxis: ()=>this.echartsRadiusAxisOption,
      series: ()=>this.echartsSeriesOption,
      dataset: ()=>this.echartsDatasetOption(),
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

    const projectId = this.getBoard().projectId;
    const seriesCssColors = this.getSeriesCssColors();
    let showTooltip = this.getOption<boolean>("tooltip");
    let tooltipBackground = backgroundImage?.relativePath ? `url("${projectId}/${backgroundImage.relativePath}")` : backgroundColor;

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
          if(seriesNameSet.has(param.seriesName)) continue;
          let iconHtml = showIcon ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${seriesCssColors[param.seriesIndex % seriesCssColors.length]};"></span>` : "";

          let val = param.value[param.dimensionNames[param.encode.radius[0]]];
          if(isNaN(val)) continue;
          if (tooltipStyle === "normal") {
            val = formatFloat(val, tooltipDecimalPlaces, tooltipCompleteZero);
          } else if (tooltipStyle === "percent") {
            val = formatFloat(val * 100, tooltipDecimalPlaces, tooltipCompleteZero) + "%";
          }
          if(commaDisplay){
            val = this.doCommaSeparat(val)
          }
          dataHtml += `<div>
            ${iconHtml}
            <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${param.axisValue}：</span>
            <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${val}</span>
          </div>`;
          seriesNameSet.add(param.seriesName);
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

  get defaultPadding() {
    const padding = {
      left: 10,
      right: 10,
      top: 10,
      bottom: 10
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
    let width = this.contentSize.width - paddingRight - paddingLeft;
    let height = this.contentSize.height - paddingTop - paddingBottom;

    return { left, right, top, bottom, width, height };
  }

  get echartsPolarOption() {
    let chartSizeOpts = this.chartSizeOpts;
    let diffX = chartSizeOpts.left - chartSizeOpts.right;
    let diffY = chartSizeOpts.top - chartSizeOpts.bottom;
    return {
      center: [this.contentSize.width / 2 + diffX, this.contentSize.height / 2 + diffY],
      radius: ["0%", "70%"]
    };
  }

  get echartsAngleAxisOption(): any {
    let showLabel = this.getOption<boolean>("angle-axis-label");
    let font = this.getOption<OptionFontValue>("angle-axis-font");
    let labelOffset = this.getOption<boolean>("angle-axis-offset");
    let axisLineColor = this.getOption<Color>("angle-axis-color");
    let axisLineWidth = this.getOption<number>("angle-axis-width");

    return {
      type: "category",
      axisLabel: {
        show: showLabel,
        margin: labelOffset,
        color: new Color(font.color).hexa(),
        fontSize: font.size,
        fontFamily: font.family,
        fontWeight: font.bold ? "bold" : "normal",
        fontStyle: font.italic ? "italic" : "normal",
      },
      axisTick: {
        show: false
      },
      axisLine: {
        show: true,
        lineStyle: {
          color: axisLineColor,
          width: axisLineWidth
        }
      },
      splitLine:{
        show: true,
        lineStyle: {
          color: axisLineColor,
          width: axisLineWidth
        }
      },
    };
  }

  get echartsRadiusAxisOption():any {
    return {
      min: 0,
      max: 1,
      axisLine: {
        show: false
      },
      axisLabel: {
        show: false
      },
      splitLine:{
        show: false
      }
    };
  }

  protected getDefaultPrivateData(): PrivateData {
    return {
      fields: [
        { uid: "f_angle", alias: "水果", type: "string" },
      ],
      rows: [
        { f_angle: "橘子" },
        { f_angle: "香蕉" },
        { f_angle: "苹果" },
        { f_angle: "柠檬" },
        { f_angle: "鸭梨" }
      ],
    };
  }

  checkErrorData() {
    let fieldDims = this.getOption<OptionFieldValue[]>("axis-fields");
    if (fieldDims?.length) {
      this.clearErrorDataStatus();
    } else {
      this.addErrorDataStatus("filed-empty");
    }
  }

  _datasetSource() {
    let fieldDims = this.getOption<OptionFieldValue[]>("axis-fields");
    if (fieldDims?.length) {
      let source = this.createView(["axis-fields"]);
      if (this.axisFields[0]?.uid?.[2]?.split(".")?.length > 1) {
        source = this.flatDataset(source, [this.axisFields[0].uid[2]]);
      }
      this.nameMap = {
        angleName: this.getFieldAlias(fieldDims[0].uid),
        radiusName: "值",
      };
      let newSource = [];
      source.forEach(row => {
        let dataItem = {};
        dataItem["angleName"] = row[fieldDims[0].uid[2]];
        dataItem["radiusName"] = Math.random();
        newSource.push(dataItem);
      })
      return newSource;
    }else{
      const privateData = this.getPrivateData();
      const field = privateData.fields[0];
      this.nameMap = {
        angleName: field.alias,
        radiusName: "",
      };
      let resultSuorce = [];
      let angleNameArr = privateData.rows;
      for(let i = 0; i<50; i++){
        let data = {};
        data["angleName"] = angleNameArr[Math.floor((Math.random()*angleNameArr.length))][field.uid];
        data["radiusName"] = Math.random();
        resultSuorce.push(data);
      }
      return resultSuorce;
    }
  }

  get echartsSeriesOption(): CustomSeriesOption | any {
    let colorArr = this.getSerieEchartsColors();

    let nameArr = [];
    this.datasetSource().forEach((item)=>{
      if(!nameArr.includes(item?.angleName)){
        nameArr.push(item?.angleName)
      }
     });

    let intervalAngle = Math.PI * 2 / nameArr.length;
    let startAngle = -Math.PI / 2;
    return {
      // name: "value",
      type: "custom",
      coordinateSystem: "polar",
      renderItem: (params, api) => {
        let values = [api.value("radiusName"), api.value("angleName")];
        let coord = api.coord(values);
        let currentAngle = startAngle + intervalAngle * values[1];
        let offsetAngle = Math.random() * intervalAngle;

        return {
          type: "circle",
          shape: {
            cx: params.coordSys.cx + Math.cos(currentAngle + offsetAngle) * coord[2],
            cy: params.coordSys.cy + Math.sin(currentAngle + offsetAngle) * coord[2],
            r: 5
          },
          style: api.style({
            fill: api.visual("color"),
            stroke: "#fff",
          })
        }
      },
      itemStyle: {
        color: (param)=>{
          let colorIndex = nameArr.indexOf(param?.name) || 0;
          return colorArr[ colorIndex % (colorArr.length || 1) ];
        }
      },
      encode: {
        angle: "angleName",
        radius: "radiusName",
      },
    }
  }

  get axisFields() {
    return this.getOption<OptionFieldValue[]>("axis-fields") || [];
  }

  override getMetaData() {
    return merge(super.getMetaData(), {
      axisValue: [
        ...this.axisFields
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
        let data = this.createView(["axis-fields"]);
        const currentData = data[params.dataIndex];
        let uids = this.getOption("axis-fields")?.[0]?.uid;
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
