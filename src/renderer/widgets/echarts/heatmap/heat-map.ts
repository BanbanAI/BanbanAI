import { PrivateData, PrivateDataConnectionUID, PrivateDataTableUID, OptionFieldUID } from "@common/types/project";
import { DefinedOptions, OptionFileValue, OptionFieldValue, WidgetMetaData, ChartClickState } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { formatFloat } from "@common/utils/math";
import { TheWidget as Echarts, component as B2Chart } from "@renderer/widgets/echarts/basic";
import { TooltipComponentOption, XAXisComponentOption, YAXisComponentOption, SeriesOption, VisualMapComponentOption, EChartsOption, GridComponentOption } from "echarts/dist/echarts";
import resource from "./locales";
import { merge, recursive } from "merge";
import i18next from "@renderer/widgets/i18next";
import { Ref, ref } from "vue";
export class HeatMap extends Echarts {
  noDims: Boolean = false;
  static resource = recursive(true, Echarts.resource, resource);
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
                type: "field(recommend=string|number)",
                alias: i18next.t("axisX"),
                default: [
                  {
                    "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_date"],
                    "__opt_type": "field",
                    "summary": ""
                  }
                ]
              },
              {
                name: "axis-y",
                type: "field(aggs=sum|none|max|min|mean|count|distinct, min=0, recommend=string|number)",
                alias: i18next.t("axisY"),
                default: [
                  {
                    "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_name"],
                    "__opt_type": "field",
                    "summary": ""
                  }
                ]
              },
              {
                name: "axis-value",
                alias: i18next.t("axisValue"),
                type: "field",
                default: [
                  {
                    "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_value"],
                    "__opt_type": "field",
                    "summary": ""
                  }
                ],
                visible: true
              },
              {
                name: "axis-fields",
                alias: i18next.t("axisFields"),
                type: "field",
                visible: false
              },
            ]
          },
        },
        style: {
          basic: {
            children: [
              {
                name: "max",
                alias: i18next.t("max"),
                type: "number",
                default: 1,
              },
              {
                name: "min",
                alias: i18next.t("min"),
                type: "number",
                default: 0,
              }
            ]
          },
          legend: {
            children: [
              {
                name: "legend-type",
                alias: i18next.t("legendType"),
                type: "select(radioGroup)",
                default: "plain",
                visible: false,
                selectChoices: [
                  {
                    value: "plain",
                    label: i18next.t("legendTypePlain"),
                  },
                  {
                    value: "scroll",
                    label: i18next.t("legendTypeScroll"),
                  },
                ],
              },
              {
                name: "legend-icon-size",
                visible: false
              },
              {
                name: "legend-font",
                alias: i18next.t("legendFont"),
                type: "font",
                default: {
                  size: 12,
                  color: "#fff"
                },
                visible: false
              },
              {
                name: "legend-itemGap",
                alias: i18next.t("legendItemGap"),
                type: "number(unit=px)",
                default: 10,
                visible: false
              },
              {
                name: "legend-offset-x",
                alias: i18next.t("legendOffsetX"),
                type: "number(min=-100, max=100, step=1, showInput, unit=px)",
                default: 0,
              },
              {
                name: "legend-offset-y",
                alias: i18next.t("legendOffsetY"),
                type: "number(min=-100, max=100, step=1, showInput, unit=px)",
                default: 0,
              },
              {
                name: "legend-width",
                alias: i18next.t("legendWidth"),
                type: "number(unit=px)",
                default: 20,
              },
              {
                name: "legend-height",
                alias: i18next.t("legendHeight"),
                type: "number(unit=px)",
                default: 100,
              },
              {
                name: "handle-size",
                alias: i18next.t("handleSize"),
                type: "number(unit=%)",
                default: 105,
              }
            ]
          },
          sort: {
            visible: false
          },
        }
      },
      ...super.defineOptions()
    ]
  }

  get echartsGridOption(): GridComponentOption | GridComponentOption[] {
    let gridPadding = this.padding;
    return {
      top: gridPadding.top + 35,
      right: gridPadding.right + 35,
      bottom: gridPadding.bottom + 35,
      left: gridPadding.left + 35,
      containLabel: false,
    }
  }

  get echartsXAxisOption(): XAXisComponentOption {
    return {
      show: false,
      type: "category",

    }
  }

  get echartsYAxisOption(): YAXisComponentOption {
    return {
      show: false,
      type: "category",

    }
  }

  getNoiseHelper() {
    class Grad {
      constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
      }
      dot2(x, y) {
        return this.x * x + this.y * y;
      }
      dot3(x, y, z) {
        return this.x * x + this.y * y + this.z * z;
      }
    }
    const grad3 = [
      new Grad(1, 1, 0),
      new Grad(-1, 1, 0),
      new Grad(1, -1, 0),
      new Grad(-1, -1, 0),
      new Grad(1, 0, 1),
      new Grad(-1, 0, 1),
      new Grad(1, 0, -1),
      new Grad(-1, 0, -1),
      new Grad(0, 1, 1),
      new Grad(0, -1, 1),
      new Grad(0, 1, -1),
      new Grad(0, -1, -1)
    ];
    const p = [
      151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140,
      36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120,
      234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33,
      88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71,
      134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133,
      230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161,
      1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130,
      116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250,
      124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227,
      47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44,
      154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98,
      108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34,
      242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14,
      239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121,
      50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243,
      141, 128, 195, 78, 66, 215, 61, 156, 180
    ];
    // To remove the need for index wrapping, double the permutation table length
    let perm = new Array(512);
    let gradP = new Array(512);
    // This isn't a very good seeding function, but it works ok. It supports 2^16
    // different seed values. Write something better if you need more seeds.
    function seed(seed) {
      if (seed > 0 && seed < 1) {
        // Scale the seed out
        seed *= 65536;
      }
      seed = Math.floor(seed);
      if (seed < 256) {
        seed |= seed << 8;
      }
      for (let i = 0; i < 256; i++) {
        let v;
        if (i & 1) {
          v = p[i] ^ (seed & 255);
        } else {
          v = p[i] ^ ((seed >> 8) & 255);
        }
        perm[i] = perm[i + 256] = v;
        gradP[i] = gradP[i + 256] = grad3[v % 12];
      }
    }
    seed(0);
    // ##### Perlin noise stuff
    function fade(t) {
      return t * t * t * (t * (t * 6 - 15) + 10);
    }
    function lerp(a, b, t) {
      return (1 - t) * a + t * b;
    }
    // 2D Perlin Noise
    function perlin2(x, y) {
      // Find unit grid cell containing point
      let X = Math.floor(x),
        Y = Math.floor(y);
      // Get relative xy coordinates of point within that cell
      x = x - X;
      y = y - Y;
      // Wrap the integer cells at 255 (smaller integer period can be introduced here)
      X = X & 255;
      Y = Y & 255;
      // Calculate noise contributions from each of the four corners
      let n00 = gradP[X + perm[Y]].dot2(x, y);
      let n01 = gradP[X + perm[Y + 1]].dot2(x, y - 1);
      let n10 = gradP[X + 1 + perm[Y]].dot2(x - 1, y);
      let n11 = gradP[X + 1 + perm[Y + 1]].dot2(x - 1, y - 1);
      // Compute the fade curve value for x
      let u = fade(x);
      // Interpolate the four results
      return lerp(lerp(n00, n10, u), lerp(n01, n11, u), fade(y));
    }
    return {
      seed,
      perlin2
    };
  }

  protected getDefaultPrivateData(): PrivateData {
    let noise = this.getNoiseHelper();
    noise.seed(0.5343871757204821);
    let data = [];
    for (let i = 1; i <= 30; i++) {
      for (let j = 1; j <= 30; j++) {
        data.push({ "f_date": i, "f_name": j, "f_value": noise.perlin2(i / 40, j / 20) + 0.5 });
      }
    }
    return {
      fields: [
        { uid: "f_date", alias: "date", type: "string" },
        { uid: "f_name", alias: "category", type: "string" },
        { uid: "f_value", alias: "value", type: "number" },
      ],
      rows: data
    }
  }

  // generateData() {
  //   let noise = this.getNoiseHelper();
  //   noise.seed(Math.random());
  //   let data = [];
  //   for (let i = 0; i <= 200; i++) {
  //     for (let j = 0; j <= 100; j++) {
  //       data.push([i, j, noise.perlin2(i / 40, j / 20) + 0.5]);
  //     }
  //   }
  //   return data;
  // }

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

    let tooltipStyle = this.getOption("tooltip-text-type");
    let tooltipDecimalPlaces = this.getOption<number>("tooltip-decimal-places");
    let tooltipCompleteZero = this.getOption<boolean>("tooltip-complete-zero");
    return {
      trigger: "item",
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
        let iconHtml = showIcon ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${param.color};"></span>` : "";

        let val = param.value[2];

        if (tooltipStyle === "normal") {
          val = formatFloat(val, tooltipDecimalPlaces, tooltipCompleteZero);
        } else if (tooltipStyle === "percent") {
          val = formatFloat(val * 100, tooltipDecimalPlaces, tooltipCompleteZero) + "%";
        }
        let yVal = param.value[1];
        dataHtml += `<div>
            ${iconHtml}
            <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${yVal}：</span>
            <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${val}</span>
          </div>`;
        let titleHtml = showTitle ? `<div>
          <span style="color:${titleFontColor};font-size:${titleFontSize}px;line-height:1;">${param?.name}</span>
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
      show: false
    }
  }

  checkErrorData() {
    let yDims = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let xDims = this.getOption<OptionFieldValue[]>("axis-x") || [];
    let valueDims = this.getOption<OptionFieldValue[]>("axis-value") || [];
    if (xDims.length && yDims.length && valueDims.length) {
      this.clearErrorDataStatus();
    } else {
      if (!xDims.length && !yDims.length && !valueDims.length) {
        this.addErrorDataStatus("filed-empty");
      } else {
        this.addErrorDataStatus("filed-incomplete");
      }
    }
  }

  _datasetSource() {
    let yDims = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let xDims = this.getOption<OptionFieldValue[]>("axis-x") || [];
    let valueDims = this.getOption<OptionFieldValue[]>("axis-value") || [];
    let data = []
    if (xDims.length && yDims.length && valueDims.length) {
      let dataRows = this.getData().getRows([yDims[0].uid, xDims[0].uid, valueDims[0].uid])
      dataRows = this.getDataAfterSort(dataRows);
      dataRows.forEach((item) => {
        let arr = [];
        arr.push(item[yDims[0].uid[2]]);
        arr.push(item[xDims[0].uid[2]]);
        arr.push(item[valueDims[0].uid[2]])
        data.push(arr);
      })
    } else {
      let field = this.getPrivateFieldTypeUids()
      this.getPrivateData()?.rows?.map(item => {
        let arr = [];
        arr.push(item[field.string?.[0]]);
        arr.push(item[field.string?.[1]]);
        arr.push(item[field.number?.[0]])
        data.push(arr)
      })
    }
    return data;
  }

  legendPosition() {
    let positionObj = {};
    return positionObj;
  }

  get getVisualMapOption(): VisualMapComponentOption | VisualMapComponentOption[] {
    let handleSize = this.getOption<number>("handle-size") + '%';
    let visualMapOpt: VisualMapComponentOption = {
      type: 'continuous',
      min: this.getOption("min"),
      max: this.getOption("max"),
      show: this.getOption("legend"),
      left: 'right',
      calculable: true,
      realtime: false,
      splitNumber: 8,
      handleSize,
      itemWidth: this.getOption("legend-width"),
      itemHeight: this.getOption("legend-height"),
      padding: [2, 0, 2, 4],
      textStyle: {
        color: "#fff"
      },
      inRange: {
        color: this.getSerieEchartsColors()
      }
    }
    // 控件方位
    let position = this.getOption<string>("legend-position");
    let offsetX = this.getOption<string>("legend-offset-x");
    let offsetY = this.getOption<string>("legend-offset-y");

    if (position.startsWith("left")) {
      visualMapOpt.left = 0 + offsetX;
      if (position.includes("top")) {
        visualMapOpt.top = 0 + offsetY;
      } else if (position.includes("bottom")) {
        visualMapOpt.bottom = 0 + offsetY;
      } else {
        visualMapOpt.top = "center";
      }
    } else if (position.startsWith("right")) {
      visualMapOpt.right = 0 + offsetX;
      if (position.includes("top")) {
        visualMapOpt.top = 0 + offsetY;
      } else if (position.includes("bottom")) {
        visualMapOpt.bottom = 0 + offsetY;
      } else {
        visualMapOpt.top = "center";
      }

    } else if (position.startsWith("bottom")) {
      visualMapOpt.bottom = 0 + offsetY;
      visualMapOpt.orient = 'horizontal';
      if (position.includes("left")) {
        visualMapOpt.left = 0 + offsetX;
      } else if (position.includes("right")) {
        visualMapOpt.right = 0 + offsetX;
      } else {
        visualMapOpt.left = "center";
      }

    } else if (position.startsWith("top")) {
      visualMapOpt.top = 0 + offsetY;
      visualMapOpt.orient = 'horizontal';
      if (position.includes("left")) {
        visualMapOpt.left = 0 + offsetX;
      } else if (position.includes("right")) {
        visualMapOpt.right = 0 + offsetX;
      } else {
        visualMapOpt.left = "center";
      }
    }


    return visualMapOpt;

  }

  get echartsSeriesOption(): SeriesOption | SeriesOption[] {
    return [{
      name: "Gaussian",
      type: "heatmap",
      emphasis: {
        itemStyle: {
          borderColor: '#333',
          borderWidth: 1
        }
      },
      progressive: 1000,
      animation: false,
      encode: {
        x: [0],
        y: [1],
        value: [2]
      },
    },]
  }

  get echartsOptionFunc(): {[key: string]: Function} {
    return {
      grid: ()=>this.echartsGridOption,
      tooltip: ()=>this.echartsTooltipOption,
      xAxis: ()=>this.echartsXAxisOption,
      yAxis: ()=>this.echartsYAxisOption,
      legend: ()=>this.echartsLegendOption,
      series: ()=>this.echartsSeriesOption,
      dataset: ()=>this.echartsDatasetOption(),
      color: ()=>this.getSerieEchartsColors(),
      visualMap: ()=>this.getVisualMapOption
    };
  }

  get axisX() {
    return this.getOption<OptionFieldValue[]>("axis-x") || [];
  }
  get axisY() {
    return this.getOption<OptionFieldValue[]>("axis-y") || [];
  }

  get axisValue() {
    return this.getOption<OptionFieldValue[]>("axis-value") || [];
  }

  override getMetaData() {
    return merge(super.getMetaData(), {
      axisValue: [
        ...this.axisX,
        ...this.axisY,
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
              filterValue = currentData?.[fieldArr[1]];
            } else if (fieldArr.length === 3) {
              fieldUIDs = [uids[0], fieldArr[0], `${fieldArr[1]}.${fieldArr[2]}`];
              filterValue = currentData?.[fieldArr[1]].map(item => item[fieldArr[2]]);
            }
          }
          this.applyLinkage({ uid: fieldUIDs as OptionFieldUID, value: filterValue });
        }
      }

    })
  }
}
