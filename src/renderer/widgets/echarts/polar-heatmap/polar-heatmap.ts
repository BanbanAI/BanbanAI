import { TheWidget as Echarts, component as B2Echarts } from "@renderer/widgets/echarts/basic";
import { PrivateData, PrivateDataConnectionUID, PrivateDataTableUID, OptionFieldUID } from "@common/types/project";
import { DefinedOptions, OptionFieldValue, OptionFontValue, OptionFileValue, WidgetMetaData, ChartClickState } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { TooltipComponentOption, CustomSeriesOption, EChartsOption } from "echarts/dist/echarts";
import { formatFloat } from "@common/utils/math";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { merge, recursive } from "merge";
import { Ref, ref } from "vue";

export class PolarHeatmap extends Echarts {
  protected nameMap: any;
  static resource = recursive(true, Echarts.resource, resource);
  static defineOptions(): DefinedOptions[] {
    return [
      {
        data: {
          fields: {
            alias: i18next.t("fields"),
            children: [
              {
                name: "axis-angle",
                alias: i18next.t("axis_angle"),
                type: "field(max=1)",
                default: [{ "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_year"], "__opt_type": "field", "summary": "" }],
              },
              {
                name: "axis-radius",
                alias: i18next.t("axis_radius"),
                type: "field(max=1)",
                default: [{ "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_name"], "__opt_type": "field", "summary": "" }],
              },
              {
                name: "axis-value",
                alias: i18next.t("axis_value"),
                type: "field(aggs=sum|max|min|mean|count|distinct, max=1)",
                default: [{ "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_value"], "__opt_type": "field", "summary": "" }],
              },
              {
                name: "axis-fields",
                visible: false
              }
            ],
          },
        },
        style: {
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
          "series-color": {
            children: [
              {
                name: "palette",
                default: ["#bae7ff", "#1890ff", "#0050b3"],
              },
              {
                name: "inner-radius",
                alias: i18next.t("inner_radius"),
                type: "number(unit=%)",
                default: 20,
              },
              {
                name: "color-piece-border-color",
                alias: i18next.t("color_piece_border_color"),
                type: "color",
                default: "#fff",
              },
              {
                name: "color-piece-border-width",
                alias: i18next.t("color_piece_border_width"),
                type: "number(unit=px, min=0)",
                default: 0,
              },
            ]
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
                name: "tooltip-label-style",
                children: [
                  {
                    name: "tooltip-title",
                    default: false,
                    visible: false
                  },
                ]
              }
            ]
          },
          "axis": {
            visible: true,
            children: [
              {
                name: "angle-display-cluster",
                alias: i18next.t("angle_axis"),
                show: "tab",
                children: [
                  {
                    name: "angle-axis",
                    alias: i18next.t("angle_axis"),
                    type: "boolean",
                    default: true,
                  },
                  {
                    name: "angle-axis-offset",
                    alias: i18next.t("axis_offset"),
                    type: "number(unit=px)",
                    default: 1,
                  },
                  {
                    name: "angle-axis-font",
                    alias: i18next.t("axis_font"),
                    type: "font",
                    default: {
                      size: 12,
                      color: "#fff"
                    },
                  }
                ]
              },
              {
                name: "radius-display-cluster",
                alias: i18next.t("radius_axis"),
                show: "tab",
                children: [
                  {
                    name: "radius-axis",
                    alias: i18next.t("radius_axis"),
                    type: "boolean",
                    default: true,
                  },
                  {
                    name: "radius-axis-offset",
                    alias: i18next.t("axis_offset"),
                    type: "number(unit=px)",
                    default: 1,
                  },
                  {
                    name: "radius-axis-font",
                    alias: i18next.t("axis_font"),
                    type: "font",
                    default: {
                      size: 12,
                      color: "#fff"
                    },
                  }
                ]
              }
            ]
          }
        },
      },
      ...super.defineOptions(),
    ];
  }

  get echartsOptionFunc(): {[key: string]: Function} {
    return {
      polar: ()=>this.echartsPolarOption,
      angleAxis: ()=>this.echartsAngleAxisOption,
      radiusAxis: ()=>this.echartsRadiusAxisOption,
      visualMap: ()=>this.echartsVisualMapOption,
      tooltip: ()=>this.echartsTooltipOption,
      series: ()=>this.echartsSeriesOption,
      dataset: ()=>this.echartsDatasetOption(),
    };
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
    let innerRadius = this.getOption<number>("inner-radius");
    let chartSizeOpts = this.chartSizeOpts;
    let diffX = chartSizeOpts.left - chartSizeOpts.right;
    let diffY = chartSizeOpts.top - chartSizeOpts.bottom;
    return {
      center: [this.contentSize.width / 2 + diffX, this.contentSize.height / 2 + diffY],
      radius: [`${70 / 100 * innerRadius}%`, "70%"]
    };
  }

  get echartsAngleAxisOption(): any {
    let showLabel = this.getOption<boolean>("angle-axis");
    let font = this.getOption<OptionFontValue>("angle-axis-font");
    let labelOffset = this.getOption<boolean>("angle-axis-offset");

    return {
      type: "category",
      axisLine: {
        show: false
      },
      axisTick: {
        show: false
      },
      axisLabel: {
        show: showLabel,
        margin: labelOffset,
        color: font.color,
        fontSize: font.size,
        fontFamily: font.family,
        fontWeight: font.bold ? "bold" : "normal",
        fontStyle: font.italic ? "italic" : "normal",
      }
    };
  }

  get echartsRadiusAxisOption(): any {
    let showLabel = this.getOption<boolean>("radius-axis");
    let font = this.getOption<OptionFontValue>("radius-axis-font");
    let labelOffset = this.getOption<boolean>("radius-axis-offset");
    return {
      type: 'category',
      axisLine: {
        show: false
      },
      axisTick: {
        show: false
      },
      axisLabel: {
        show: showLabel,
        margin: labelOffset,
        color: font.color,
        fontSize: font.size,
        fontFamily: font.family,
        fontWeight: font.bold ? "bold" : "normal",
        fontStyle: font.italic ? "italic" : "normal",
        interval: 0
      },
      z: 999
    };
  }

  get echartsVisualMapOption() {
    let sourceData = this.datasetSource();
    let minValue = sourceData.reduce((result, current) => { return Math.min(result, current.value) }, Infinity);
    let maxValue = sourceData.reduce((result, current) => { return Math.max(result, current.value) }, -Infinity);
    return {
      show: false,
      type: "continuous",
      min: minValue,
      max: maxValue,
      inRange: {
        color: this.getSerieEchartsColors(),
      },
    };
  }

  get echartsTooltipOption(): TooltipComponentOption | TooltipComponentOption[] {
    //tooltip相关
    let showTooltip = this.getOption<boolean>("tooltip");
    let backgroundColor = new Color(this.getOption<Color>("tooltip-background-color")).toCssString();
    let backgroundImage = this.getOption<OptionFileValue>("tooltip-background-image");
    let backgroundBlur = this.getOption<OptionFileValue>("tooltip-background-blur");
    let tooltipPaddingWidth = this.getOption<number>("tooltip-padding-width");
    let tooltipPaddingHeight = this.getOption<number>("tooltip-padding-height");
    let radius = this.getOption<number>("tooltip-radius");
    let commaDisplay = this.getOption<boolean>("tooltip-comma-display")
    let nameFontColor = new Color(this.getOption<Color>("tooltip-name-font-color")).hexa();
    let nameFontSize = this.getOption<number>("tooltip-name-font-size");
    let valueFontColor = new Color(this.getOption<Color>("tooltip-value-font-color")).hexa();
    let valueFontSize = this.getOption<number>("tooltip-value-font-size");

    const projectId = this.getBoard().projectId;
    let tooltipBackground = backgroundImage?.relativePath ? `url("${projectId}/${backgroundImage.relativePath}")` : backgroundColor;

    let tooltipStyle = this.getOption("tooltip-text-type");
    let tooltipDecimalPlaces = this.getOption<number>("tooltip-decimal-places");
    let tooltipCompleteZero = this.getOption<boolean>("tooltip-complete-zero");
    return {
      show: showTooltip,
      trigger: "item",
      borderWidth: 0,
      padding: [tooltipPaddingHeight, tooltipPaddingWidth, tooltipPaddingHeight, tooltipPaddingWidth],
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
        let paramValue = param.value;
        if (typeof paramValue == "string") return paramValue;
        let dataHtml = "";
        for (let key in paramValue) {
          let val = paramValue[key];
          if (typeof val === "number") {
            if (tooltipStyle === "normal") {
              val = formatFloat(val, tooltipDecimalPlaces, tooltipCompleteZero);
            } else if (tooltipStyle === "percent") {
              val = formatFloat(val * 100, tooltipDecimalPlaces, tooltipCompleteZero) + "%";
            }
          }
          if(commaDisplay){
            val = this.doCommaSeparat(val)
          }
          dataHtml += `
            <div>
              <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${this.nameMap[key] || key}：</span>
              <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${val}</span>
            </div>
          `;
        }
        return dataHtml;
      }
    }
  }

  protected getDefaultPrivateData(): PrivateData {
    return {
      fields: [
        { uid: "f_year", alias: "年份", type: "string" },
        { uid: "f_name", alias: "组件名称", type: "string" },
        { uid: "f_value", alias: "使用次数", type: "number" },
      ],
      rows: [
        { f_year: "2020", f_name: "折线图", f_value: 1000 },
        { f_year: "2020", f_name: "柱状图", f_value: 859 },
        { f_year: "2020", f_name: "条形图", f_value: 652 },
        { f_year: "2021", f_name: "折线图", f_value: 222 },
        { f_year: "2021", f_name: "柱状图", f_value: 435 },
        { f_year: "2021", f_name: "条形图", f_value: 789 },
        { f_year: "2022", f_name: "折线图", f_value: 1500 },
        { f_year: "2022", f_name: "柱状图", f_value: 1120 },
        { f_year: "2022", f_name: "条形图", f_value: 789 }
      ],
    };
  }

  checkErrorData() {
    let angleDims = this.getOption<OptionFieldValue[]>("axis-angle");
    let radiusDims = this.getOption<OptionFieldValue[]>("axis-radius");
    let valueDims = this.getOption<OptionFieldValue[]>("axis-value");
    if (angleDims?.length && radiusDims?.length && valueDims?.length) {
      this.clearErrorDataStatus();
    } else {
      if (!angleDims?.length && !radiusDims?.length && !valueDims?.length) {
        this.addErrorDataStatus("filed-empty");
      } else {
        this.addErrorDataStatus("filed-incomplete");
      }
    }
  }

  _datasetSource() {
    let angleDims = this.getOption<OptionFieldValue[]>("axis-angle");
    let radiusDims = this.getOption<OptionFieldValue[]>("axis-radius");
    let valueDims = this.getOption<OptionFieldValue[]>("axis-value");
    if (angleDims?.length && radiusDims?.length && valueDims?.length) {
      let source = this.createView(["axis-angle", "axis-radius", "axis-value"]);
      source = this.dealDataByAggregate(source,  [angleDims[0], radiusDims[0]], valueDims);
      source = this.getDataAfterSort(source);
      this.nameMap = {
        angleName: this.getFieldAlias(angleDims[0].uid),
        radiusName: this.getFieldAlias(radiusDims[0].uid),
        value: this.getFieldAlias(valueDims[0].uid),
      };
      let newSource = [];
      source.forEach(row => {
        let dataItem = {};
        dataItem["angleName"] = row[angleDims[0].uid[2]];
        dataItem["radiusName"] = row[radiusDims[0].uid[2]];
        const val = this.getMetric(row, valueDims[0]);
        dataItem["value"] = val;
        newSource.push(dataItem);
      })
      return newSource;
    } else {
      const privateData = this.getPrivateData();
      const angleDim = privateData.fields.find(field => field.uid === "f_year");
      const nameDim = privateData.fields.find(field => field.uid === "f_name");
      const valueDim = privateData.fields.find(field => field.uid === "f_value");
      this.nameMap = {
        angleName: angleDim.alias || "年份",
        radiusName: nameDim.alias || "组件名称",
        value: valueDim.alias || "使用次数",
      };
      const newSource = [];
      privateData.rows.forEach(row => {
        newSource.push({
          angleName: row[angleDim.uid],
          radiusName: row[nameDim.uid],
          value: row[valueDim.uid]
        })
      });
      return newSource;
    }
  }

  get echartsSeriesOption(): CustomSeriesOption | any {
    //shape
    let borderColor = new Color(this.getOption<Color>("color-piece-border-color")).hexa();
    let borderSize = this.getOption<number>("color-piece-border-width");

    return {
      name: "value",
      type: "custom",
      coordinateSystem: 'polar',
      renderItem: (params, api) => {
        let values = [api.value("radiusName"), api.value("angleName")];
        let coord = api.coord(values);
        let size = api.size([1, 1], values);

        return {
          type: "sector",
          shape: {
            cx: params.coordSys.cx,
            cy: params.coordSys.cy,
            r0: coord[2] - size[0] / 2,
            r: coord[2] + size[0] / 2,
            startAngle: -(coord[3] + size[1] / 2),
            endAngle: -(coord[3] - size[1] / 2)
          },
          style: api.style({
            fill: api.visual('color'),
            stroke: borderColor,
            lineWidth: borderSize
          })
        }
      },
      encode: {
        angle: "angleName",
        radius: "radiusName",
      },
    }
  }

  get axisAngle() {
    return this.getOption<OptionFieldValue[]>("axis-angle") || [];
  }

  get axisRadius() {
    return this.getOption<OptionFieldValue[]>("axis-radius") || [];
  }

  get axisValue() {
    return this.getOption<OptionFieldValue[]>("axis-value") || [];
  }

  override getMetaData() {
    return merge(super.getMetaData(), {
      axisValue: [
        ...this.axisAngle,
        ...this.axisRadius,
        ...this.axisValue
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
        let data = this.createView(["axis-angle", "axis-radius", "axis-value"]);
        const currentData = data[params.dataIndex];
        let uids = this.getOption("axis-angle")?.[0]?.uid;
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
