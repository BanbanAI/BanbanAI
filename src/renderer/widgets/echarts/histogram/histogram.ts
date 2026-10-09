import { PrivateData, PrivateDataConnectionUID, PrivateDataTableUID, OptionFieldUID } from "@common/types/project";
import { DefinedOptions, OptionFieldValue, OptionFontValue, OptionFileValue, WidgetMetaData, ChartClickState } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { TheWidget as Axis, component as B2Axis } from "@renderer/widgets/echarts/axis";
import { formatFloat } from "@common/utils/math";
import { DatasetComponentOption, SeriesOption, XAXisComponentOption, YAXisComponentOption, TooltipComponentOption, ECharts } from "echarts/dist/echarts";
import ecStat from "echarts-stat";
import resource from "./locales";
import { merge, recursive } from "merge";
import i18next from "@renderer/widgets/i18next";
import { Ref, ref } from "vue";

export class Histogram extends Axis {
  static resource = recursive(true, Axis.resource, resource);

  addEchartsDatasetTransform(echarts) {
    super.addEchartsDatasetTransform(echarts);
    echarts.registerTransform((ecStat as any).transform.histogram);
  }

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
                name: "axis-fields",
                visible: true,
                default: [
                  {
                    "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_title"],
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
            children: [
              {
                name: "class-interval",
                alias: i18next.t("classInterval"),
                type: "select",
                default: "squareRoot",
                selectChoices: [
                  {
                    value: "squareRoot",
                    label: i18next.t("classIntervalSquareRoot")
                  },
                  {
                    value: "scott",
                    label: i18next.t("classIntervalScott")
                  },
                  {
                    value: "freedmanDiaconis",
                    label: i18next.t("classIntervalFreedmanDiaconis")
                  },
                  {
                    value: "sturges",
                    label: i18next.t("classIntervalSturges")
                  },
                ]
              },
            ],
          },
          "series-color": {
            visible: true
          },
          "series-shape": {
            visible: false,
          },
          "series-color-group": {
            visible: false
          },
          sort: {
            visible: false
          },
          legend: {
            default: false,
            visible: false
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
                name: "animation-display",
                default: false,
              },
              {
                name: "animation-display-type",
                default: "carousel",
                visible: false
              },
            ]
          }
        },
      },
      ...super.defineOptions(),
    ];
  }


  createView(paths?: string[] | any) {
    let result = [];
    if (!paths) return result;
    this.noDims = false;
    const uids = [];
    for (const item of paths) {
      const options = this.getOption<OptionFieldValue[]>(item) || [];
      for (const option of options) {
        uids.push(option.uid);
      }
    }
    return this.getData().getflatColumns(uids) || [[]];
  }

  createRowData(paths?: string[] | any) {
    let result = [];
    if (!paths) return result;
    this.noDims = false;
    const uids = [];
    for (const item of paths) {
      const options = this.getOption<OptionFieldValue[]>(item) || [];
      for (const option of options) {
        uids.push(option.uid);
      }
    }
    return this.getData().getRows(uids);
  }


  checkErrorData() {
    let fieldsDims = this.getOption<OptionFieldValue[]>("axis-fields") || [];
    if (fieldsDims.length) {
      this.clearErrorDataStatus();
    } else {
      this.addErrorDataStatus("filed-empty");
    }
  }

  _datasetSource() {
    let fieldsDims = this.getOption<OptionFieldValue[]>("axis-fields") || [];
    if (fieldsDims.length) {
      let uid = fieldsDims[0].uid;
      let source: any = this.createView(["axis-fields"]);
      let newSource: any = Array.from(source[0]).map((dataItem) => {
        return [dataItem, 1];
      });
      return newSource;
    } else {
      let data = this.getPrivateData()
      let uids = data?.fields?.find?.(item => { return item.type === "string" })
      return data?.rows?.map?.(items => {
        return [items[uids["uid"]], 1]
      })
    }
  }


  protected getDefaultPrivateData(): PrivateData {
    return {
      fields: [
        { uid: "f_title", alias: "title", type: "string" },
      ],
      rows: [
        {
          f_title: 1.2,
        },
        {
          f_title: 3.4,
        },
        {
          f_title: 3.7,
        },
        {
          f_title: 4.3,
        },
        {
          f_title: 5.2,
        },
        {
          f_title: 5.8,
        },
        {
          f_title: 6.1,
        },
        {
          f_title: 6.5,
        },
        {
          f_title: 6.8,
        },
        {
          f_title: 7.1,
        },
        {
          f_title: 7.3,
        },
        {
          f_title: 7.7,
        }
      ]
    }
  }


  echartsDatasetOption(): DatasetComponentOption | DatasetComponentOption[] {
    let dataSource = this.datasetSource();
    let datasetResult: DatasetComponentOption[] = [{ source: dataSource }];
    let selectType = this.getOption('class-interval')
    if (dataSource?.[0]?.length) {
      datasetResult.push({
        transform: {
          type: "ecStat:histogram",
          config: {
            method: selectType,
          },
          print: true
        }
      });
    }

    return datasetResult;
  }

  get boundaryGap() { // 两侧留白 会影响网格线对齐
    return true;
  }

  get echartsXAxisOption(): XAXisComponentOption | XAXisComponentOption[] {
    let showXAxis = this.getOption<boolean>("x-display");
    let axisLabelFont = this.getOption<OptionFontValue>("x-font");
    let xUnitFont = this.getOption<OptionFontValue>("x-unit-font");
    let datasetSource = this.datasetSource();
    let splitNumber = 10;
    if (datasetSource?.[0]?.length > 0) {
      splitNumber = ecStat.histogram(datasetSource, this.getOption('class-interval'))?.data?.length;
    }
    return [
      {
        show: showXAxis,
        scale: true,
        splitNumber: splitNumber,
        name: this.getOption<boolean>("x-unit") ? this.getOption<string>("x-unit-text") : "",
        nameGap: this.getOption<number>("x-nameGap"),
        nameTextStyle: {
          color: this.toEchartsColor(xUnitFont.color as Color),
          fontStyle: xUnitFont.italic ? "italic" : "normal",
          fontWeight: xUnitFont.bold ? "bold" : "normal",
          fontFamily: xUnitFont.family,
          fontSize: xUnitFont.size,
        },
        // type: this.transposed ? "value" : this.getOption("x-data-type"),
        // boundaryGap: this.boundaryGap,
        axisLine: { //轴线
          show: this.getOption("x-line"),
          lineStyle: {
            color: this.toEchartsColor(this.getOption("x-line-color")),
            width: Math.max(this.getOption("x-line-width"), 0),
            type: this.getOption("x-line-type"),
            join: "miter"
          },
        },
        axisTick: {
          alignWithLabel: true,
          show: this.getOption("x-tickline"),
          length: this.getOption("x-tickline-length"),
          lineStyle: {
            width: this.getOption("x-tickline-width"),
            color: this.toEchartsColor(this.getOption("x-tickline-color")),
          }
        },
        axisLabel: {
          show: this.getOption("x-label"),
          margin: this.getOption("x-label-offset"),
          fontStyle: axisLabelFont.italic ? "italic" : "normal",
          fontWeight: axisLabelFont.bold ? "bold" : "normal",
          fontSize: axisLabelFont.size,
          fontFamily: axisLabelFont.family,
          color: this.toEchartsColor(axisLabelFont.color as Color),
          textShadowColor: this.toEchartsColor(this.getOption("x-display-shadow-color")),
          textShadowBlur: this.getOption("x-display-shadow-blur"),
          textShadowOffsetX: this.getOption("x-display-shadow-offset-x"),
          textShadowOffsetY: this.getOption("x-display-shadow-offset-y"),
          rotate: this.getOption("x-rotate")
        },
        splitLine: this.xGridLineOption
      },
    ]
  }

  get echartsYAxisOption(): YAXisComponentOption | YAXisComponentOption[] {
    let showYAxis = this.getOption<boolean>("y-display");
    let axisLabelFont = this.getOption<OptionFontValue>("y-font");
    let yIsPercent = this.getOption("y-text-type") === "percent";
    let yDecimalPlaces = Math.max(this.getOption("y-decimal-places"), 0);
    let yCompleteZero = this.getOption<boolean>("y-complete-zero");
    let valueAbb = this.getOption("y-value-abbreviation");
    let axisYUnitMap = this.axisUnitMap;
    let yUnitFont = this.getOption<OptionFontValue>("y-unit-font");
    let axisOpt: any = {
      show: showYAxis,
      type: this.transposed ? this.getOption("y-data-type") : "value",
      name: this.getOption("y-unit") ? this.getOption("y-unit-text") : "",
      nameTextStyle: {
        color: this.toEchartsColor(yUnitFont.color as Color),
        fontStyle: yUnitFont.italic ? "italic" : "normal",
        fontWeight: yUnitFont.bold ? "bold" : "normal",
        fontFamily: yUnitFont.family,
        fontSize: yUnitFont.size,
        align: "right"
      },
      axisLine: { //轴线
        show: this.getOption("y-line"),
        lineStyle: {
          color: this.toEchartsColor(this.getOption("y-line-color")),
          width: Math.max(this.getOption("y-line-width"), 0),
          join: "miter"
        },
      },
      axisTick: {
        show: this.getOption("y-tickline"),
        alignWithLabel: true,
        length: this.getOption("y-tickline-length"),
        lineStyle: {
          width: this.getOption("y-tickline-width"),
          color: this.toEchartsColor(this.getOption("y-tickline-color")),
        }
      },
      axisLabel: {
        show: this.getOption("y-label"),
        fontStyle: axisLabelFont.italic ? "italic" : "normal",
        fontWeight: axisLabelFont.bold ? "bold" : "normal",
        fontSize: axisLabelFont.size,
        fontFamily: axisLabelFont.family,
        color: this.toEchartsColor(axisLabelFont.color as Color),
        textShadowColor: this.toEchartsColor(this.getOption("y-display-shadow-color")),
        textShadowBlur: this.getOption("y-display-shadow-blur"),
        textShadowOffsetX: this.getOption("y-display-shadow-offset-x"),
        textShadowOffsetY: this.getOption("y-display-shadow-offset-y"),
        formatter: function (value, index) {
          let num = value;
          if (!isNaN(num)) {
            if (yIsPercent) {
              value = formatFloat(num * 100, yDecimalPlaces, yCompleteZero) + "%";
            } else {
              let abb = +valueAbb;
              let unit = "";
              if (abb !== 0) {
                unit = axisYUnitMap[abb] || "";
              }
              value = formatFloat(num / Math.pow(10, abb), yDecimalPlaces, yCompleteZero) + unit;
            }
          }
          return value;
        }
      },
      splitLine: this.yGridLineOption
    };
    if (this.getOption("y-scale-range") === "custom") {
      axisOpt.min = this.getOption("y-scale-min");
      axisOpt.max = this.getOption("y-scale-max");
      axisOpt.splitNumber = this.getOption("y-polyline-scale-interval");
    }
    return [{ ...axisOpt, position: "left" }];
  }

  get tooltipTrigger(): TooltipComponentOption["trigger"] {
    return "item";
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
      formatter: (param) => {
        let dataHtml = "";
        let values = param?.value || [0, 0, 0];

        let iconHtml = showIcon ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${seriesCssColors[param.dataIndex % seriesCssColors.length]};"></span>` : "";
        let val = values[1];
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
          <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${param.name}：</span>
          <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${val}</span>
        </div>`;
        let titleHtml = showTitle ? `<div>
          <span style="color:${titleFontColor};font-size:${titleFontSize}px;line-height:1;">${param?.seriesName}</span>
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

  get echartsSeriesOption(): SeriesOption | SeriesOption[] {
    let labelFont = this.getOption<OptionFontValue>("label-font");
    let isPercent = this.getOption("label-text-type") === "percent";
    let labelDecimalPlaces = this.getOption<number>("label-decimal-places");
    let isComplete = this.getOption<boolean>("label-complete-zero");
    let colorFollow = this.getOption("label-color-type") === "follow" || new Color(labelFont.color)?.alpha() == 0;
    let labelPosition = this.getOption<string>("label-position");
    let unitFont = this.getOption<OptionFontValue>("label-unit-font");
    let unit = this.getOption<string>("label-unit-value");
    return [
      {
        name: "histogram",
        type: "bar",
        barWidth: '99.3%',
        markLine: this.markLineOption,
        label: {
          show: this.getOption("label"),
          position: labelPosition == "outside" ? "top" : "inside",
          formatter: (param) => {
            let val = param?.value[1] || 0;
            if (!isPercent) {
              val = formatFloat(val, labelDecimalPlaces, isComplete);
            } else {
              val = formatFloat(val * 100, labelDecimalPlaces, isComplete) + "%";
            }
            return `{value|${val}}{unit|${unit}}`
          },
          rich: {
            value: {
              color: colorFollow ? "auto" : this.toEchartsColor(labelFont.color as Color),
              fontWeight: labelFont.bold ? "bold" : "normal",
              fontStyle: labelFont.italic ? "italic" : "normal",
              fontSize: labelFont.size,
              fontFamily: labelFont.family,
            },
            unit: {
              fontSize: unitFont.size,
              fontWeight: unitFont.bold ? "bold" : "normal",
              fontStyle: unitFont.italic ? "italic" : "normal",
              fontFamily: unitFont.family || "sans-serif",
              color: this.toEchartsColor(unitFont.color as Color)
            }
          }
        },
        colorBy: "data",
        encode: {
          x: "value",
          y: "number",
          itemName: "DisplayableName",
        },
        datasetIndex: 1,
      }
    ]
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
        let data = this.createRowData(["axis-fields"]);
        let uids = this.getOption("axis-fields")?.[0]?.uid;
        if (uids?.length) {
          const currentData = data.filter(item => params.data[2] <= item[uids[2]] && item[uids[2]] < params.data[3]);
          let fieldArr = this.getOption<string>("linkage-form-field")?.split(".")
          let fieldUIDs;
          let filterValue;
          if (fieldArr?.length) {
            if (fieldArr.length === 2) {
              fieldUIDs = [uids[0], ...fieldArr];
              filterValue = currentData.map(item => item[fieldArr[1]]);
            } else if (fieldArr.length === 3) {
              fieldUIDs = [uids[0], fieldArr[0], `${fieldArr[1]}.${fieldArr[2]}`];
              filterValue = currentData.map(item => item[fieldArr[1]].map(item => item[fieldArr[2]])).flat(Infinity);
            }
          }
          this.applyLinkage({ uid: fieldUIDs as OptionFieldUID, value: filterValue });
        }
      }

    })
  }
}
