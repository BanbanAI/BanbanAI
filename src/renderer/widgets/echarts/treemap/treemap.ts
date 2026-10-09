import { formatFloat } from "@common/utils/math";
import { TheWidget as EchartsChart, component as B2Chart } from "@renderer/widgets/echarts/basic";
import { PrivateData, PrivateDataConnectionUID, PrivateDataTableUID, OptionFieldUID } from "@common/types/project";
import { DefinedOptions, OptionFileValue, OptionFontValue, OptionFieldValue, WidgetMetaData, ChartClickState } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { TooltipComponentOption, XAXisComponentOption, YAXisComponentOption, SeriesOption } from "echarts/dist/echarts";
import resource from "./locales"
import { merge, recursive } from "merge";
import { Ref, ref, watch } from "vue";
import i18next from "@renderer/widgets/i18next";

export class Treemap extends EchartsChart {
  noDims: Boolean = false;
  static resource = recursive(true, EchartsChart.resource, resource);
  public selectedIndex: Ref<number> = ref(-1);
  public selectedData: Ref<{}> = ref(null);
  public resetSelectedIndex: Ref<boolean> = ref(false);
  static defineOptions(): DefinedOptions[] {
    return [
      {
        data: {
          fields: {
            alias: i18next.t("fields"),
            fold: "unfold",
            children: [
              {
                name: "axis-category",
                type: "field(recommend=string)",
                alias: i18next.t("axis-category"),
                default:[
                  {
                    "uid":[PrivateDataConnectionUID,PrivateDataTableUID,"f_name"],
                    "__opt_type":"field",
                    "summary":""
                  }
                ]
              },
              {
                name: "axis-value",
                type: "field(aggs=sum|none|max|min|mean|count|distinct, min=0)",
                alias: i18next.t("axis-value"),
                default:[
                  {
                    "uid":[PrivateDataConnectionUID,PrivateDataTableUID,"f_value"],
                    "__opt_type":"field",
                    "summary":"sum"
                  }
                ]
              },
              {
                name: "axis-fields",
                visible: false
              }
            ]
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
                    name: "label-type-cluster",
                    alias: i18next.t("label-type-cluster"),
                    visible: false
                  },
                  {
                    name: "label-font",
                    alias: i18next.t("label-font"),
                    type: "font",
                    default: {
                      family: "sans-serif",
                      color: "#ffffff",
                      size: 12,
                      bold: false,
                      italic: false,
                    },
                  },
                ]
              }
            ]
          },
          padding: {
            visible: false,
          },
          legend: {
            default: false,
            visible: false
          },
          "series-color": {
            alias: i18next.t("series-color"),
            children: [
              {
                alias: i18next.t("palette"),
                name: "palette",
                type: "palette(gradient)",
                default: (widget: Treemap) => { return widget.defaultColors10 },
              },
              {
                name: "border-color-way",
                alias: i18next.t("border-color-way"),
                type: "select(radioGroup)",
                default: "follow",
                selectChoices: [
                  {
                    value: "follow",
                    label:  i18next.t("follow")
                  },
                  {
                    value: "custom",
                    label: i18next.t("custom")
                  },
                ]
              },
              {
                name: "border-palette",
                type: "palette(gradient)",
                default: (widget: Treemap) => { return widget.defaultColors10 },
                visible: (Widget: Treemap) => { return Widget.getOption("border-color-way") === "custom" }
              },
              {
                alias: i18next.t("shadow-out-color-way"),
                name: "shadow-out-color-way",
                type: "select(radioGroup)",
                default: "follow",
                selectChoices: [
                  {
                    value: "follow",
                    label: i18next.t("follow")
                  },
                  {
                    value: "custom",
                    label: i18next.t("custom")
                  },
                ]
              },
              {
                name: "shadow-out-palette",
                type: "palette(gradient)",
                default: (widget: Treemap) => { return widget.defaultColors10 },
                visible: (Widget: Treemap) => { return Widget.getOption("shadow-out-color-way") === "custom" }
              },
            ]
          },
          "shape-style":{
            alias:i18next.t("shape-style"),
            children:[
              {
                alias: i18next.t("treemap-spacing"),
                name: "treemap-spacing",
                type: "number(unit=px)",
                default:0
              },
              {
                alias: i18next.t("border-width"),
                name: "border-width",
                type: "number(unit=px)",
                default:0
              },
              {
                alias: i18next.t("border-radius"),
                name: "border-radius",
                type: "number(unit=px, min=0)",
                default:0
              },
              {
                alias: i18next.t("shadow-blur"),
                name: "shadow-blur",
                type: "number(unit=px)",
                default:0
              },
              {
                alias: i18next.t("shadow-offset-x"),
                name: "shadow-offset-x",
                type: "number(unit=px)",
                default:0
              },
              {
                alias: i18next.t("shadow-offset-y"),
                name: "shadow-offset-y",
                type: "number(unit=px)",
                default:0
              }
            ]
          }
        }
      },
      ...super.defineOptions()
    ]
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

    let tooltipValueType = this.getOption<string>("tooltip-text-type");
    let tooltipValueDecimalPlaces = this.getOption<number>("tooltip-decimal-places");
    let tooltipValueCompleteZero = this.getOption<boolean>("tooltip-complete-zero");

    const projectId = this.getBoard().projectId;
    const seriesCssColors = this.getSeriesCssColors();
    let showTooltip = this.getOption<boolean>("tooltip");
    let tooltipBackground = backgroundImage?.relativePath ? `url("${projectId}/${backgroundImage.relativePath}")` : backgroundColor;
    return {
      trigger: 'item',
      // confine: true,
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
        let iconHtml = showIcon ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${seriesCssColors[param.seriesIndex % seriesCssColors.length]};"></span>` : "";

        let resultValue:any = param.value;
        if(isNaN(resultValue)) resultValue = 0;

        if (tooltipValueType === "normal") {
          resultValue = formatFloat(resultValue, tooltipValueDecimalPlaces, tooltipValueCompleteZero);
        } else {
         let sum=this.echartsData.reduce((results, current)=>{
            return results+current.value
          },0)
          resultValue = parseInt((param.value/sum)*100 as any)
          resultValue = formatFloat(resultValue, tooltipValueDecimalPlaces, tooltipValueCompleteZero) + '%';
        }
        if(commaDisplay){
          resultValue = this.doCommaSeparat(resultValue)
        }
        dataHtml += `<div>
          ${iconHtml}
          <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${param.name}：</span>
          <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${resultValue}</span>
        </div>`;
        let titleHtml = showTitle ? `<div>
          <span style="color:${titleFontColor};font-size:${titleFontSize}px;line-height:1;">${param.seriesName}</span>
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

  getLegendOtherOption() {
    return {}
  }

  protected getDefaultPrivateData(): PrivateData {
    return {
      fields: [
      {uid: "f_name", alias: "key", type: "string"},
      {uid: "f_value", alias: "value", type: "number"},
    ],
      rows: [
        { f_name: '示例1', f_value: 1048 },
        { f_name: '示例2', f_value: 735 },
        { f_name: '示例3', f_value: 580 },
        { f_name: '示例4', f_value: 1005 },
        { f_name: '示例5', f_value: 700 },
      ],
    };
  }

  checkErrorData() {
    let dataOpt = this.getOption<OptionFieldValue[]>("axis-category") || [];
    let dataValue = this.getOption<OptionFieldValue[]>("axis-value") || [];
    if( dataOpt.length === 0 || dataValue.length === 0 ) {
      if(!dataOpt.length && !dataValue.length ) {
        this.addErrorDataStatus("filed-empty");
      } else {
        this.addErrorDataStatus("filed-incomplete");
      }
    } else {
      this.clearErrorDataStatus();
    }
  }

  _datasetSource() {
    let categoryDims = this.axisCategory;
    let valueDims = this.axisValue;
    let source
    source = this.createView(["axis-category", "axis-value"]);
    source = this.dealDataByAggregate(source, [categoryDims[0]], valueDims);
    return source;
  }

  get echartsData() {
    let resultData=[]
    let dataOpt = this.getOption<OptionFieldValue[]>("axis-category") || [];
    let dataValue = this.getOption<OptionFieldValue[]>("axis-value") || [];
    let dataMap = new Map()
    if( dataOpt.length === 0 || dataValue.length === 0 ) {
      let treeMapData = this.getPrivateData()
      if(treeMapData?.fields && treeMapData?.rows){
        let name = treeMapData?.fields?.find(item =>{return item.type === "string"})
        let value = treeMapData?.fields?.find(item =>{return item.type === "number"})
        treeMapData?.rows?.map?.((item,index)=>{
          let obj = {};
          obj["name"] = item[name?.["uid"]];
          obj["value"] = item[value?.["uid"]];
          resultData.push(obj);
        })
      }
    } else {
      let shadowOutColorFollow = this.getOption("shadow-out-color-way") == 'follow';
      let treeMapData = this.datasetSource();
      let shadowColors = shadowOutColorFollow ? this.getSerieEchartsColors() : this.getSerieEchartsColors("shadow-out-palette");
      let shadowBlur = this.getOption("shadow-blur");
      let borderRadius = this.getOption<number>("border-radius");
      borderRadius = borderRadius>0?borderRadius+4:0;
      let shadowOffsetX = this.getOption("shadow-offset-x");
      let shadowOffsetY = this.getOption("shadow-offset-y");
      let index = 0;
      let sortData = treeMapData.sort((a, b) => {
        return Number(Object.values(b)[1]) - Number(Object.values(a)[1])
      })
      for (let row of sortData) {
        if(dataMap.get(row[dataOpt[0]?.uid[2]]) == 0 || dataMap.get(row[dataOpt[0]?.uid[2]])){
          resultData[dataMap.get(row[dataOpt[0]?.uid[2]])]["value"] += row[dataValue[0]?.uid[2]];
        }else{
          dataMap.set(row[dataOpt[0]?.uid[2]],index);
          let dataInfo = {};
          dataInfo["name"] = row[dataOpt[0]?.uid[2]];
          dataInfo["value"] = this.getMetric(row, dataValue[0]);
          dataInfo["self_row_data"] = row;
          dataInfo["itemStyle"] = {
            borderColor: 'transparent',
            borderWidth:0,
            shadowColor: shadowColors[index],
            shadowBlur,
            borderRadius,
            shadowOffsetX,
            shadowOffsetY
          }
          resultData.push(dataInfo);
          index++;
        }
      }
    }
    dataMap.clear()
    return resultData;
  }

  get echartsSeriesOption(): SeriesOption | SeriesOption[]{
    let labelShowName = this.getOption<boolean>("label");
    let labelNameFont = this.getOption<OptionFontValue>("label-font");

    let borderColorFollow = this.getOption("border-color-way") == 'follow';
    let borderColors = borderColorFollow ? this.getSerieEchartsColors() : this.getSerieEchartsColors("border-palette");
    let borderWidth = this.getOption<number>("border-width");
    let borderRadius = this.getOption<number>("border-radius");
    let treemapSpacing = this.getOption<number>("treemap-spacing");
    if(treemapSpacing>=120){
      treemapSpacing = 120;
    }
    let lineFixedVal = 1;
    return [
      {
        name: "value",
        type: "treemap",
        roam: false, //是否开启拖拽与漫游
        leafDepth: 2, //表示几层节点
        nodeClick: false,  //表示点击节点无反应
        breadcrumb:{
          show:false,
        },
        label: {
          show: labelShowName,
          position: "inside",
          color: new Color(labelNameFont.color).alpha() == 0 ? "auto" : this.toEchartsColor(labelNameFont.color as Color),
          fontSize: labelNameFont.size,
          fontFamily: labelNameFont.family,
          fontWeight: labelNameFont.bold ? "bold" : "normal",
          fontStyle: labelNameFont.italic ? "italic" : "normal",
          overflow: 'break'
        },
        itemStyle:{
          gapWidth: borderWidth / 2 + treemapSpacing,
          borderColor: "#0000",
        },
        data: this.echartsData,
        selectedMode: "single",
        select:{
          disabled:true
        },
        emphasis: {
          scale: false
        },
        z: 5
      },
      {
        type: 'custom',
        coordinateSystem: 'null',
        z: 10,
        renderItem: (params, api) => {
          let treemapInfo = (this.echartsChart as any)._chartsMap[Object.keys((this.echartsChart as any)._chartsMap)[0]]['__model'];
          let treemapStorage = (this.echartsChart as any)._chartsMap[Object.keys((this.echartsChart as any)._chartsMap)[0]]['_storage'];

          let borderX = treemapStorage.nodeGroup[params.dataIndex + 1].x;
          let borderY = treemapStorage.nodeGroup[params.dataIndex + 1].y;

          let width = treemapStorage.content[params.dataIndex + 1].shape.width - borderWidth / 2;
          let height = treemapStorage.content[params.dataIndex + 1].shape.height - borderWidth / 2;
          let transfromX = treemapInfo.layoutInfo.x;
          let transfromY = treemapInfo.layoutInfo.y;

          borderRadius = borderRadius >= height / 2 ? height / 2 : borderRadius;
          borderRadius = borderRadius >= width / 2 ? width / 2 : borderRadius;
          if (borderRadius == 0) {
            lineFixedVal = 3
          }
          return {
            type: 'group',
            children: [
              {
                type: 'arc',
                z2: 10,
                shape: {
                  cx: borderX + transfromX + borderRadius,
                  cy: borderY + transfromY + borderRadius,
                  r: borderRadius,
                  r0: 5,
                  startAngle: Math.PI,
                  endAngle: Math.PI * 1.5
                },
                style: {
                  fill: 'transparent',
                  stroke: borderColors[params.dataIndex],
                  lineWidth: borderWidth,
                }
              },
              {
                type: 'arc',
                z2: 10,
                shape: {
                  cx: borderX + width + transfromX - borderRadius,
                  cy: borderY + transfromY + borderRadius,
                  r: borderRadius,
                  r0: 5,
                  startAngle: Math.PI + Math.PI / 2,
                  endAngle: Math.PI + Math.PI
                },
                style: {
                  fill: 'transparent',
                  stroke: borderColors[params.dataIndex],
                  lineWidth: borderWidth,
                }
              },
              {
                type: 'arc',
                z2: 10,
                shape: {
                  cx: borderX + transfromX + borderRadius,
                  cy: borderY + height + transfromY - borderRadius,
                  r: borderRadius,
                  r0: 5,
                  startAngle: Math.PI / 2,
                  endAngle: Math.PI
                },
                style: {
                  fill: 'transparent',
                  stroke: borderColors[params.dataIndex],
                  lineWidth: borderWidth,
                }
              },
              {
                type: 'arc',
                z2: 10,
                shape: {
                  cx: borderX + width + transfromX - borderRadius,
                  cy: borderY + height + transfromY - borderRadius,
                  r: borderRadius,
                  r0: 5,
                  startAngle: 0,
                  endAngle: Math.PI / 2
                },
                style: {
                  fill: 'transparent',
                  stroke: borderColors[params.dataIndex],
                  lineWidth: borderWidth,
                }
              },
              // 直线
              {
                type: 'line',
                z2: 10,
                shape: {
                  x1: borderX + transfromX + borderRadius - lineFixedVal,
                  x2: borderX + transfromX + width - borderRadius + lineFixedVal,
                  y1: borderY + transfromY,
                  y2: borderY + transfromY,
                },
                style: {
                  fill: 'transparent',
                  stroke: borderColors[params.dataIndex],
                  lineWidth: borderWidth,
                }
              },
              {
                type: 'line',
                z2: 10,
                shape: {
                  x1: borderX + transfromX + width,
                  x2: borderX + transfromX + width,
                  y1: borderY + transfromY + borderRadius - lineFixedVal,
                  y2: borderY + transfromY + height - borderRadius + lineFixedVal
                },
                style: {
                  fill: 'transparent',
                  stroke: borderColors[params.dataIndex],
                  lineWidth: borderWidth,
                }
              },
              {
                type: 'line',
                z2: 10,
                shape: {
                  x1: borderX + transfromX + width - borderRadius + lineFixedVal,
                  x2: borderX + transfromX + borderRadius - lineFixedVal,
                  y1: borderY + transfromY + height,
                  y2: borderY + transfromY + height
                },
                style: {
                  fill: 'transparent',
                  stroke: borderColors[params.dataIndex],
                  lineWidth: borderWidth,

                }
              },
              {
                type: 'line',
                z2: 10,
                shape: {
                  x1: borderX + transfromX,
                  x2: borderX + transfromX,
                  y1: borderY + transfromY + borderRadius - lineFixedVal,
                  y2: borderY + transfromY + height - borderRadius + lineFixedVal
                },
                style: {
                  fill: 'transparent',
                  stroke: borderColors[params.dataIndex],
                  lineWidth: borderWidth,
                }
              }
            ]
          };
        },
        data: this.echartsData
      }
    ]
  }

  get axisCategory() {
    return this.getOption<OptionFieldValue[]>("axis-category") || [];
  }

  get axisValue() {
    return this.getOption<OptionFieldValue[]>("axis-value") || [];
  }

  override getMetaData() {
    return merge(super.getMetaData(), {
      axisValue: [
        ...this.axisCategory,
        ...this.axisValue,
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

        let uids = this.getOption("axis-category")?.[0]?.uid;
        if (uids?.length) {
          let fieldArr = this.getOption<string>("linkage-form-field")?.split(".")
          let fieldUIDs;
          let filterValue;

          if (fieldArr?.length) {
            const rowData = params.data?.['self_row_data'];
            if(rowData){
              if (fieldArr.length === 2) {
                fieldUIDs = [uids[0], ...fieldArr];
                filterValue = params.data?.['self_row_data'][fieldArr[1]];
              } else if (fieldArr.length === 3) {
                fieldUIDs = [uids[0], fieldArr[0], `${fieldArr[1]}.${fieldArr[2]}`];
                const rawVal = params.data?.['self_row_data'][fieldArr[1]];
                filterValue = Array.isArray(rawVal) ? rawVal.map(item => item[fieldArr[2]]) : rawVal;
              }
            }
            this.applyLinkage({ uid: fieldUIDs as OptionFieldUID, value: filterValue });
          }
        }
      }

    })
  }
}

