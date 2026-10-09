import { PrivateData, PrivateDataConnectionUID, PrivateDataTableUID, OptionFieldUID } from "@common/types/project";
import { DefinedOptions, OptionFontValue, OptionFileValue, OptionFieldValue, WidgetMetaData, ChartClickState } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { Widget } from "@renderer/b2/controllers/widget";
import { formatFloat } from "@common/utils/math";
import { TheWidget as Echarts, component as B2Chart } from "@renderer/widgets/echarts/basic";
import { TooltipComponentOption, XAXisComponentOption, YAXisComponentOption, SeriesOption, EChartsOption } from "echarts/dist/echarts";
import resource from "./locales"
import { merge, recursive } from "merge";
import i18next from "@renderer/widgets/i18next";
import { Ref, ref, watch } from "vue";

export class SankeyV2 extends Echarts {
  static resource = recursive(true, Echarts.resource, resource);
  static defineOptions(): DefinedOptions[] {
    return [
      {
        data: {
          fields: {
            alias: i18next.t("fields"),
            children: [
              {
                name: "axis-nodes",
                alias: i18next.t("axis-nodes"),
                type: "field",
                default: [
                  {
                    "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_sample_source"],
                    "__opt_type": "field",
                    "summary": ""
                  },
                  {
                    "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_sample_target"],
                    "__opt_type": "field",
                    "summary": ""
                  }
                ]
              },
              {
                name: "axis-fields",
                alias: i18next.t("axis-fields"),
                type: "field",
                visible: false
              },
              {
                name: "axis-values",
                type: "field",
                alias: i18next.t("axis-values"),
                default: [
                  {
                    "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_sample_value"],
                    "__opt_type": "field",
                    "summary": ""
                  }
                ]
              },
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
            alias: i18next.t("basic"),
            children: [
              {
                name: "text-arrangement",
                visible: false,
              },
              {
                name: "sampling-rate",
                visible: false,
              },
            ],
          },
          sort: {
            visible: false
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
                    name: "label-font",
                    alias: i18next.t("label-font"),
                    type: "font",
                    visible: true,
                    default: {
                      family: 'sans-serif',
                      size: 12,
                      bold: false,
                      italic: false,
                      underline: false,
                      "line-through": false
                    },
                  },
                  {
                    name: "label-unit-value",
                    alias: i18next.t("labelUnitValue"),
                    type: "string",
                    default: "",
                  },
                  {
                    name: "label-unit-font",
                    alias: i18next.t("labelUnitFont"),
                    type: "font",
                    default: {
                      family: "sans-serif",
                      size: 12,
                      bold: false,
                      italic: false,
                      underline: false,
                      deleteline: false,
                    },
                  },
                ]
              }
            ]
          },
          legend: {
            visible: false,
          },
          font: {
            alias: i18next.t("font"),
            visible: false,
          },
          "series-color-group": {
            alias: i18next.t("series-color-group"),
            visible: false,
          },
        },
      },
      ...super.defineOptions(),
    ];
  }

  get echartsXAxisOption(): XAXisComponentOption {
    return {
      show: false
    }
  }

  get echartsYAxisOption(): YAXisComponentOption {
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
        let iconHtml = showIcon ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${seriesCssColors[param.dataIndex % seriesCssColors.length]};"></span>` : "";
        let resultValue: any = param.value
        if (isNaN(resultValue)) resultValue = 0;

        if (tooltipValueType === "normal") {
          resultValue = formatFloat(resultValue, tooltipValueDecimalPlaces, tooltipValueCompleteZero);
        } else {
          let sum = this.echartsData.links.reduce((results, current) => {
            return results + current.value
          }, 0)
          resultValue = parseInt((param.value / sum) * 100 as any)
          resultValue = formatFloat(resultValue, tooltipValueDecimalPlaces, tooltipValueCompleteZero) + '%';
        }
        if(commaDisplay){
          resultValue = this.doCommaSeparat(resultValue)
        }
        if (/>/.test(param.name)) {
          param.name = param.name.replace('>', 'to')
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
    return {
      show: false,
    }
  }

  get echartsSeriesOption(): SeriesOption | SeriesOption[] {

    let labelNameFont = this.getOption<OptionFontValue>("label-font");
    let unitFont = this.getOption<OptionFontValue>("label-unit-font");
    let unit = this.getOption<string>("label-unit-value");
    // let labelShowValue = this.getOption<boolean>("label-value-visible");
    // let labelValueType = this.getOption<string>("label-text-type");
    // let labelValueDecimalPlaces = this.getOption<number>("label-decimal-places");
    // let labelValueCompleteZero = this.getOption<boolean>("label-complete-zero");
    // let labelValueFont = this.getOption<OptionFontValue>("label-value-font");

    let labelShow = this.getOption<boolean>("label");

    return {
      type: 'sankey',
      left: this.padding.left,
      right: this.padding.right,
      top: this.padding.top,
      bottom: this.padding.bottom,
      data: this.echartsData.nodes,
      links: this.echartsData.links,
      edges: this.echartsData.links,
      nodeAlign: 'justify',
      nodeGap: 10,
      nodeWidth: 6,
      draggable: false,
      layout: 'none',
      label: {
        show: labelShow,
        formatter: (params) => {
          return `{value|${params.name}}{unit|${unit}}`
        },
        rich:{
          value: {
            color: new Color(labelNameFont.color).alpha() == 0 ? "auto" : new Color(labelNameFont.color).toCssString(),
            fontSize: labelNameFont.size,
            fontWeight: labelNameFont.bold ? "bold" : "normal",
            fontStyle: labelNameFont.italic ? "italic" : "normal",
            fontFamily: labelNameFont.family || "sans-serif",
          },
          unit: {
            fontSize: unitFont.size,
            fontWeight: unitFont.bold ? "bold" : "normal",
            fontStyle: unitFont.italic ? "italic" : "normal",
            fontFamily: unitFont.family || "sans-serif",
            color: this.toEchartsColor(unitFont.color as Color)
          }
        }
      }
    }
  }

  get echartsOptionFunc(): {[key: string]: Function} {
    return {
      grid: ()=>this.echartsGridOption,
      tooltip: ()=>this.echartsTooltipOption,
      xAxis: ()=>this.echartsXAxisOption,
      yAxis: ()=>this.echartsYAxisOption,
      legend: ()=>this.echartsLegendOption,
      series: ()=>this.echartsSeriesOption,
      color: ()=>this.getSerieEchartsColors()
    };
  }

  useSampleData() {
    this.noDims = true;
    let data = [];
    let sampleData = this.getPrivateData();
    let filedsString = []
    data = sampleData.rows;
    sampleData?.fields?.map(item => {
      let arr = []
      arr.push("")
      arr.push("")
      arr.push(item.uid)
      if (item?.type === "string") {
        filedsString.push(item)
      }
    })

    return {
      data: data,
      source: filedsString[0],
      target: filedsString[1],
      value: sampleData?.fields?.find(item => { return item.type === "number" })
    };
  }

  protected getDefaultPrivateData(): PrivateData {
    return {
      fields: [
        {
          uid: "f_sample_source",
          alias: "source",
          type: "string",
        },
        {
          uid: "f_sample_target",
          alias: "target",
          type: "string",
        },
        {
          uid: "f_sample_value",
          alias: "value",
          type: "number",
        },
      ],
      rows: [
        {
          f_sample_source: "页面",
          f_sample_target: "首页",
          f_sample_value: 20,
        },
        {
          f_sample_source: "页面",
          f_sample_target: "管理",
          f_sample_value: 30,
        },
        {
          f_sample_source: "页面",
          f_sample_target: "产品",
          f_sample_value: 50,
        },
        {
          f_sample_source: "首页",
          f_sample_target: "模块一",
          f_sample_value: 8,
        },
        {
          f_sample_source: "首页",
          f_sample_target: "模块二",
          f_sample_value: 10,
        },
        {
          f_sample_source: "首页",
          f_sample_target: "模块三",
          f_sample_value: 2,
        },
        {
          f_sample_source: "管理",
          f_sample_target: "模块三",
          f_sample_value: 12,
        },
        {
          f_sample_source: "管理",
          f_sample_target: "模块四",
          f_sample_value: 18,
        },
        {
          f_sample_source: "产品",
          f_sample_target: "模块一",
          f_sample_value: 16,
        },
        {
          f_sample_source: "产品",
          f_sample_target: "模块三",
          f_sample_value: 30,
        },
        {
          f_sample_source: "产品",
          f_sample_target: "模块五",
          f_sample_value: 4,
        },
      ]
    }
  }


  checkErrorData() {
    let data_value_f: any = this.getOption<OptionFieldValue[]>("axis-values") || [];
    let data_nodes_f: any = this.getOption<OptionFieldValue[]>("axis-nodes") || [];
    if (data_nodes_f.length > 1 && data_value_f.length > 0) {
      this.clearErrorDataStatus();
    } else {
      if (!data_nodes_f.length && !data_value_f.length) {
        this.addErrorDataStatus("filed-empty");
      } else {
        this.addErrorDataStatus("filed-incomplete");
      }
    }
  }

  _datasetSource() {
    return this.createView(["axis-values", "axis-nodes"]);
  }

  get echartsData() {

    let data_value = { nodes: [], links: [] };
    //值字段
    let data_value_f: any = this.getOption<OptionFieldValue[]>("axis-values") || [];
    //开始地点
    //目的地点
    let data_nodes_f: any = this.getOption<OptionFieldValue[]>("axis-nodes") || [];

    let data_view = null;
    //颜色
    const seriesCssColors = this.getSeriesCssColors();
    if ( data_nodes_f.length > 1 && data_value_f.length > 0 ) {
      data_view = this.datasetSource();
      if (data_value_f[0]?.uid?.[2]?.split(".")?.length > 1
        && data_nodes_f?.every(option => option.uid?.[2]?.split(".")?.length > 1)
      ) {
      data_view = this.flatDataset(data_view, [...([...data_value_f, ...data_nodes_f].map(dim => dim.uid[2]))]);
      }
    } else {
      let sample_data = this.useSampleData();
      data_view = sample_data.data;
      data_nodes_f = [sample_data.target, sample_data.source];
      data_value_f = [sample_data.value];
    }
    if (data_view) {
      //name集合
      let name_area: any = new Set();
      //得到对应value值
      let nodes_value = [];

      for(let index = 0;index < data_nodes_f.length - 1;index++){ // 分层
        let startUid = data_nodes_f[index].uid[2];
        let endUid = data_nodes_f[index + 1].uid[2];
        let value = data_value_f[0];
        for (let i = 0; i < data_view.length; i++) {
          if(data_view[i][startUid] && data_view[i][endUid] && value) {
            name_area.add(data_view[i][startUid]);
            name_area.add(data_view[i][endUid]);
            let link_data = {};
            link_data = {
              source: data_view[i][startUid],
              target: data_view[i][endUid],
              value: data_view[i][value.uid[2]] || 0,
              'self_row_data': data_view[i],
              lineStyle: {
                color: seriesCssColors[i % seriesCssColors.length],
                opacity: 0.6
              }
            };
            data_value.links.push(link_data);
          }
        }
      }
      //去重，取得所有地点
      name_area = Array.from(name_area);
      //name解决

      for (let i = 0; i < name_area.length; i++) {
        let value_data = 0; //暂存value值

        for (let j = 0; j < data_value.links.length; j++) {
          //nodes中的name与links中的source匹配，即同一个出发地 发出的数值
          if (name_area[i] === data_value.links[j].source) {
            value_data += data_value.links[j].value;
            data_value.links[j].lineStyle.color = seriesCssColors[i % seriesCssColors.length]
          }
          //nodes中的name与links中的target匹配
          if (name_area[i] === data_value.links[j].target) {
            value_data += data_value.links[j].value;
          }
        }
        //获取nodes中的value值
        nodes_value.push(value_data);
      }
      //nodes中的value值解决

      //数据处理

      //设置nodes数据
      for (let i = 0; i < name_area.length; i++) {
        data_value.nodes.push({
          name: name_area[i],
          itemStyle: {
            color: seriesCssColors[i % seriesCssColors.length],
          }
        });
      }

      for (let i = 0; i < data_value.links.length; i++) {
        let flag = 0;
        for (let j = 0; j < data_value.links.length; j++) {
          if (data_value.links[i].target === data_value.links[j].source) {
            flag++;
          }
        }
        if (!flag) {
          data_value.nodes.forEach((item) => {
            if (item.name === data_value.links[i].target) {
              Object.assign(item, { label: { position: "left" } });
            }
          })
        }
      }

      //将data_value.links中的source和target使用对应id替换
      for (let i = 0; i < data_value.links.length; i++) {
        for (let j = 0; j < data_value.nodes.length; j++) {
          if (data_value.links[i].source === data_value.nodes[j].name) {
            data_value.links[i].source = data_value.links[i].source;
          }
          if (data_value.links[i].target === data_value.nodes[j].name) {
            data_value.links[i].target = data_value.links[i].target;
          }
        }
      }
    }
    return data_value
  }

  get axisNodes() {
    return this.getOption<OptionFieldValue[]>("axis-nodes") || [];
  }

  get axisValues() {
    return this.getOption<OptionFieldValue[]>("axis-values") || [];
  }

  override getMetaData() {
    return merge(super.getMetaData(), {
      axisValue: [
        ...this.axisNodes,
        ...this.axisValues
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

        let uids = this.getOption("axis-nodes")?.[0]?.uid;
        if (uids?.length) {
          let fieldArr = this.getOption<string>("linkage-form-field")?.split(".")
          let fieldUIDs;
          let filterValue;
          if (fieldArr?.length) {
            if (fieldArr.length === 2) {
              fieldUIDs = [uids[0], ...fieldArr];
              filterValue = params.data['self_row_data']?.[fieldArr[1]];
            } else if (fieldArr.length === 3) {
              fieldUIDs = [uids[0], fieldArr[0], `${fieldArr[1]}.${fieldArr[2]}`];
              filterValue = params.data['self_row_data']?.[fieldArr[1]].map(item => item[fieldArr[2]]);
            }
          }
          this.applyLinkage({ uid: fieldUIDs as OptionFieldUID, value: filterValue });
        }
      }

    })
  }
}
