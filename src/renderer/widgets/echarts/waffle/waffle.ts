import { TheWidget as EchartsChart, component as B2Chart } from "@renderer/widgets/echarts/basic";
import { PrivateData, PrivateDataConnectionUID, PrivateDataTableUID, OptionFieldUID } from "@common/types/project";
import { DefinedOptions, OptionFieldValue, OptionFileValue, WidgetMetaData, ChartClickState } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { TooltipComponentOption, XAXisComponentOption } from "echarts/dist/echarts";
import { formatFloat } from "@common/utils/math";
import i18next from "@renderer/widgets/i18next";
import { merge, recursive } from "merge";
import resource from "./locales"
import { ref, Ref } from "vue";
export class Waffle extends EchartsChart {
  static resource = recursive(true, EchartsChart.resource, resource);
  static defineOptions(): DefinedOptions[] {
    return [{
      data: {
        fields: {
          alias: i18next.t("fields"),
          children: [
            {
              name: "axis-category",
              type: "field(recommend=string)",
              alias: i18next.t("axis-category"),
              default: [{ "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_type"], "__opt_type": "field", "summary": "" }]
            },
            {
              name: "axis-value",
              type: "field",
              alias: i18next.t("axis-value"),
              default: [{ "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_value"], "__opt_type": "field", "summary": "sum" }]
            },
            {
              name: "axis-fields",
              visible: false
            },
          ]
        }
      },
      style: {
        "series-shape": {
          alias: i18next.t("series-shape"),
          children: [
            {
              name: "waffle-size",
              alias: i18next.t("waffle-size"),
              type: "number(unit=px, min=0)",
              default: 15,
            },
            {
              name: "waffle-itemgap",
              alias: i18next.t("waffle-itemgap"),
              type: "number(unit=px)",
              default: 5,
            },
            {
              name: "waffle-images",
              alias: i18next.t("waffle-images"),
              type: "file(format=image)",
              // multiple: true,
              default: "",
              visible: false
            },
          ]
        },
        sort: {
          visible: false
        },
        tooltip: {
          children: [
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
        }
      }
    }, ...super.defineOptions()]
  }

  get echartsXAxisOption(): XAXisComponentOption {
    return {
      type: "category",
      show: false,
    }
  }

  get echartsYAxisOption() {
    return {
      show: false
    }
  }

  getLegendOtherOption() {
    let data = this.datasetSource().map(item => item.category);
    return {
      ...super.getLegendOtherOption(),
      data: data,
      selectedMode: false
    }
  }

  protected getDefaultPrivateData(): PrivateData {
    return {
      fields: [
        { uid: "f_type", alias: "分类", type: "string" },
        { uid: "f_value", alias: "值", type: "number" },
      ],
      rows: [
        { f_type: "示例1", f_value: 859 },
        { f_type: "示例2", f_value: 652 },
        { f_type: "示例3", f_value: 222 },
        { f_type: "示例4", f_value: 435 },
        { f_type: "示例5", f_value: 789 },
        { f_type: "示例6", f_value: 789 },
      ],
    };
  }

  checkErrorData() {
    let categoryDims = this.getOption<OptionFieldValue[]>("axis-category");
    let valueDims = this.getOption<OptionFieldValue[]>("axis-value");
    if (categoryDims?.length && valueDims?.length) {
      this.clearErrorDataStatus();
    } else {
      if (!categoryDims?.length && !valueDims?.length) {
        this.addErrorDataStatus("filed-empty");
      } else {
        this.addErrorDataStatus("filed-incomplete");
      }
    }
  }

  _datasetSource() {
    let categoryDims = this.getOption<OptionFieldValue[]>("axis-category");
    let valueDims = this.getOption<OptionFieldValue[]>("axis-value");
    if (categoryDims?.length && valueDims?.length) {
      let source = this.createView(["axis-category", "axis-value"]);
      if ([...categoryDims, ...valueDims]?.every(option => option.uid?.[2]?.split(".")?.length > 1)
      ) {
      source = this.flatDataset(source, [...([...categoryDims, ...valueDims].map(dim => dim.uid[2]))]);
      }
      let newSource = [];
      source = this.getDataAfterSort(source)
      source.forEach(row => {
        let dataItem = {};
        dataItem["category"] = row[categoryDims[0].uid[2]];
        dataItem["value"] = row[valueDims[0].uid[2]];
        dataItem["self_row_data"] = row;
        newSource.push(dataItem);
      })
      return newSource;
    } else {
      let privateData = this.getPrivateData();
      let newSource = [];
      privateData.rows.forEach(row => {
        newSource.push({
          category: row["f_type"],
          value: row["f_value"],
          "self_row_data": row
        })
      });
      return newSource;
    }
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
    let showIcon = this.getOption<boolean>("tooltip-icon");
    let commaDisplay = this.getOption<boolean>("tooltip-comma-display")
    let nameFontColor = new Color(this.getOption<Color>("tooltip-name-font-color")).hexa();
    let nameFontSize = this.getOption<number>("tooltip-name-font-size");
    let valueFontColor = new Color(this.getOption<Color>("tooltip-value-font-color")).hexa();
    let valueFontSize = this.getOption<number>("tooltip-value-font-size");

    const projectId = this.getBoard().projectId;
    const seriesCssColors = this.getSeriesCssColors();
    let tooltipBackground = backgroundImage?.relativePath ? `url("${projectId}/${backgroundImage.relativePath}")` : backgroundColor;

    let tooltipStyle = this.getOption("tooltip-text-type");
    let tooltipDecimalPlaces = this.getOption<number>("tooltip-decimal-places");
    let tooltipCompleteZero = this.getOption<boolean>("tooltip-complete-zero");

    let totalValue = this.datasetSource().reduce((result, current) => { return result + (current?.value || 0) }, 0) || 1;
    return {
      show: showTooltip,
      trigger: "item",
      confine: true,
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
        let iconHtml = showIcon ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${seriesCssColors[param.dataIndex % seriesCssColors.length]};"></span>` : "";
        let dataHtml = "";

        let name = param.name;
        let val = paramValue["value"];
        if (!isNaN(val)) {
          if (tooltipStyle === "normal") {
            val = formatFloat(val, tooltipDecimalPlaces, tooltipCompleteZero);
          } else if (tooltipStyle === "percent") {
            val = formatFloat((val / totalValue) * 100, tooltipDecimalPlaces, tooltipCompleteZero) + "%";
          }
          if(commaDisplay){
            val = this.doCommaSeparat(val)
          }
        }
        dataHtml += `
          <div>
            ${iconHtml}
            <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${name}：</span>
            <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${val}</span>
          </div>
        `;
        return dataHtml;
      }
    }
  }


  get padding(): any {
    let paddingTop = this.getOption<string>("padding-top") == "auto" ? this.defaultPadding.top : this.getOption<number>("padding-top-diy");
    let paddingRight = this.getOption<string>("padding-right") == "auto" ? this.defaultPadding.right : this.getOption<number>("padding-right-diy");
    let paddingBottom = this.getOption<string>("padding-bottom") == "auto" ? this.defaultPadding.bottom : this.getOption<number>("padding-bottom-diy");
    let paddingLeft = this.getOption<string>("padding-left") == "auto" ? this.defaultPadding.left : this.getOption<number>("padding-left-diy");
    return {
      top: paddingTop,
      right: paddingRight,
      bottom: paddingBottom,
      left: paddingLeft
    }
  }

  get echartsSeriesOption(): any {
    let itemSize = this.getOption<number>("waffle-size");
    let itemGap = this.getOption<number>("waffle-itemgap");

    let legendHeight = 0;
    let legendWidth = 0;
    let legendShow = this.getOption<boolean>("legend");
    let legendPosition = this.getOption<string>("legend-position");
    if (legendShow) {
      let isVertical = legendPosition.startsWith("left") || legendPosition.startsWith("right");
      if (isVertical) {
        legendWidth = legendPosition.startsWith("left") ? 60 : -60;
      } else {
        legendHeight = legendPosition.startsWith("top") ? 20 : -20;
      }
    }

    let seriesTotalWidth = this.contentSize.width - this.padding.left - this.padding.right - Math.abs(legendWidth);
    let seriesTotalHeight = this.contentSize.height - this.padding.bottom - this.padding.top - Math.abs(legendHeight);
    let sourceData = this.datasetSource();
    let totalValue = sourceData.reduce((result, current) => { return result + (current?.value || 0) }, 0);

    let xMaxNum = Math.floor(seriesTotalWidth / (itemSize + itemGap));
    let yMaxNum = Math.floor(seriesTotalHeight / (itemSize + itemGap));
    let maxNum = xMaxNum * yMaxNum;

    let offsetX = (legendWidth > 0 ? legendWidth : 0) + this.padding.left + (seriesTotalWidth - (xMaxNum * (itemGap + itemSize) - itemGap)) / 2;
    let offsetY = (legendHeight > 0 ? legendHeight : 0) + this.padding.top + (seriesTotalHeight - (yMaxNum * (itemGap + itemSize) - itemGap)) / 2;

    let currentRow = 0;
    let currentColumn = 0;
    return [{
      name: "value",
      type: "custom",
      colorBy: "data",
      renderItem: (params, api) => {
        let values: any = [api.value("category"), api.value("value")];
        if (params.dataIndex == 0) {
          currentRow = 0;
          currentColumn = 0;
        }
        let percentValue = values[1] / totalValue;
        let itemMaxNum = Math.floor(maxNum * percentValue);

        let items = [];

        for (let itemIndex = 0; itemIndex < itemMaxNum; itemIndex++) {
          let currentX = offsetX + currentColumn * itemSize;
          let currentY = offsetY + currentRow * itemSize;
          currentX += itemGap * currentColumn;
          currentY += itemGap * currentRow;

          items.push({
            type: "rect",
            shape: {
              x: currentX,
              y: currentY,
              width: itemSize,
              height: itemSize
            },
            style: {
              fill: api.visual('color'),
              stroke: "#ccc",
            }
          });
          currentRow++;
          if (currentRow >= yMaxNum) {
            currentRow = 0;
            currentColumn++;
          }
        }

        return {
          type: "group",
          children: items
        }
      },
      encode: {
        x: "category",
        y: "value",
      },
    }, {
      type: "pie",
      colorBy: "data",
      radius: [0, 0],
      label: { show: false },
      color: this.getSerieEchartsColors()
    }]
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

        let uids = this.getOption("axis-category")?.[0]?.uid;
        if (uids?.length) {
          let fieldArr = this.getOption<string>("linkage-form-field")?.split(".")
          let fieldUIDs;
          let filterValue;
          if (fieldArr?.length) {
            if (fieldArr.length === 2) {
              fieldUIDs = [uids[0], ...fieldArr];
              filterValue = params.value['self_row_data']?.[fieldArr[1]];
            } else if (fieldArr.length === 3) {
              fieldUIDs = [uids[0], fieldArr[0], `${fieldArr[1]}.${fieldArr[2]}`];
              filterValue = params.value['self_row_data']?.[fieldArr[1]].map(item => item[fieldArr[2]]);
            }
          }
          this.applyLinkage({ uid: fieldUIDs as OptionFieldUID, value: filterValue });
        }
      }

    })
  }
}
