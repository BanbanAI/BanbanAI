import { PrivateData, PrivateDataConnectionUID, PrivateDataTableUID } from "@common/types/project";
import { DefinedOptions, OptionFontValue, OptionFileValue, OptionFieldValue, WidgetMetaData } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { formatFloat } from "@common/utils/math";
import { deepClone } from "@common/utils/object";
import { TheWidget as Line, component as B2Line } from "@renderer/widgets/echarts/line";
import { TooltipComponentOption, SeriesOption } from "echarts/dist/echarts";
import resource from "./locales/index";
import i18next from "@renderer/widgets/i18next";
import { merge, recursive } from "merge";

const UNIT_GE = "个";

export class AreaInterval extends Line {
  public intervalData = [];
  public intervalPoints = { topPoints: [], bottomPoints: [] };
  static resource = recursive(true, Line.resource, resource);

  static defineOptions(): DefinedOptions[] {
    return [
      {
        data: {
          fields: {
            alias: i18next.t("fields"),
            fold: "unfold",
            children: [
              {
                name: "axis-x",
                alias: i18next.t("axisX"),
                type: "field",
                default: [{ "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_name"], "__opt_type": "field", "summary": "" }]
              },
              {
                name: "axis-y",
                alias: i18next.t("axisY"),
                type: "field(aggs=sum|none|max|min|mean|count|distinct, min=0)",
                default: [{ "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_value"], "__opt_type": "field", "summary": "sum" }]
              },
              {
                name: "axis-group",
                alias: i18next.t("axisGroup"),
                type: "field(recommend=string, min=0, max=1)",
                visible: false,
              },
              {
                name: "axis-line",
                visible: false
              },
              {
                name: "axis-interval",
                type: "field",
                alias: i18next.t("axisInterval"),
                default: [{ "uid": [PrivateDataConnectionUID, PrivateDataTableUID, "f_interval"], "__opt_type": "field", "summary": "" }]
              }
            ],
          },
          sort: {
            visible: false
          },
        },
        style: {
          "series-color-group": {
            alias: i18next.t("seriesColorGroup"),
            children: [
              {
                name: "interval-color",
                alias: i18next.t("intervalColor"),
                type: "color(gradient)",
                default: "#1890FF33",
                visible: true
              },
              {
                cluster: "array",
                alias: i18next.t("seriesColorCluster"),
                name: "series-color-cluster"
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
                    name: "shape-column-width",
                    visible: false,
                  },
                  {
                    name: "shape-column-number",
                    visible: false
                  },
                ],
              }
            ]
          },
          "label-group": {
            children: [
              {
                name: "ranking-cluster",
                visible: false,
                children: []
              }
            ]
          },
          "axis": {
            visible: true,
            children: [
              {
                name: "y-polyline-display-cluster",
                children: [],
                visible: false
              }
            ]
          },
          tooltip: {
            children: [
              {
                name: "tooltip-format-cluster",
                children:[
                  {
                    name: "tooltip-right-axis-format-cluster",
                    visible: false,
                    children:[]
                  }
                ]
              },
            ]
          }
        },
      },
      ...super.defineOptions(),
    ];
  }

  protected getDefaultPrivateData(): PrivateData {
    return {
      fields: [
        { uid: "f_value", alias: "实际值", type: "number" },
        { uid: "f_name", alias: "名称", type: "string" },
        { uid: "f_interval", alias: "区间值", type: "string" }
      ],
      rows: [
        { f_value: 10, f_name: "示例1", f_interval: "0,30" },
        { f_value: 15, f_name: "示例2", f_interval: "3,20" },
        { f_value: 13, f_name: "示例3", f_interval: "10,25" },
        { f_value: 10, f_name: "示例4", f_interval: "3,18" },
        { f_value: 17, f_name: "示例5", f_interval: "10,23" },
      ],
    };
  }

  _datasetSource() {
    let yDims = this.getOption<OptionFieldValue[]>("axis-y");
    let xDims = this.getOption<OptionFieldValue[]>("axis-x");
    let groupDims = this.getOption<OptionFieldValue[]>("axis-group");
    let intervalDims = this.getOption<OptionFieldValue[]>("axis-interval");
    this.intervalData = [];
    if (xDims?.length && yDims?.length) {
      let source;

      if (groupDims?.length > 0) {// 有分组字段
        if (intervalDims?.length) {
          source = this.createView(["axis-x", "axis-y", "axis-group", "axis-interval"]);
          source = this.dealDataByAggregate(source,  [xDims[0], groupDims[0]], yDims);
          this.getDataAfterSort(source).forEach(item => {
            const intervalUid = intervalDims[0].uid[2]?.split(".")?.at(-1);
            if (typeof item[intervalUid] !== "string") return;
            const intervalValue = item[intervalUid]?.split(",") || [];
            if (intervalValue.length < 2) return;
            this.intervalData.push(intervalValue)
          })
        } else {
          source = this.createView(["axis-x", "axis-y", "axis-group"]);
          source = this.dealDataByAggregate(source,  [xDims[0], groupDims[0]], yDims);
        }
        let yUid = yDims[0].uid[2];
        let types = [];
        let xFields = []
        source.forEach(row => {
          xFields.push(row[xDims[0].uid[2]]);
          types.push(row[groupDims[0].uid[2]]);
        })
        types = Array.from(new Set(types));
        xFields = Array.from(new Set(xFields));
        this.xTypes = types;

        if (this.getOption<string>("sort-type").toLowerCase() === "normal") return source;

        // 统计每一个分类的总值用于排序
        let groups = {};
        types.forEach(type => {
          source.forEach(row => {
            if (row[groupDims[0].uid[2]] === type) {
              let xVal = row[xDims[0].uid[2]];
              if (groups[xVal] === undefined) groups[xVal] = 0;
              groups[xVal] += this.getMetric(row, yDims[0]);
            }
          })
        });
        let newSource = [];

        source.forEach(row => {
          let xVal = row[xDims[0].uid[2]];
          row["sumVal"] = groups[xVal];
          if (intervalDims?.length && row[intervalDims[0].uid[2]]?.split?.(",")) {
            let top = Number(row[intervalDims[0].uid[2]].split(",")[1]);
            let bottom = Number(row[intervalDims[0].uid[2]].split(",")[0]);
            row["intervalTop"] = top;
            row["intervalBottom"] = bottom;
          }
          newSource.push(row);
        })
        return this.getDataAfterSort(newSource);
      } else {
        if (intervalDims?.length) {
          source = this.createView(["axis-x", "axis-y", "axis-interval"]);
          source = this.dealDataByAggregate(source,  [xDims[0]], yDims);
          this.getDataAfterSort(source).forEach(item => {
            const intervalUid = intervalDims[0].uid[2]?.split(".")?.at(-1);
            if (typeof item[intervalUid] !== "string") return;
            const intervalValue = item[intervalUid]?.split(",") || [];
            if (intervalValue.length < 2) return;
            this.intervalData.push(intervalValue)
          })
        }
        let uids = [];
        yDims.forEach(dim => {
          uids.push(dim.uid[2]);
        });
        // 计算总和
        let newSource = [];
        source.forEach(row => {
          let sumVal = 0;
          uids.forEach(uid => {
            sumVal += this.getMetric(row, yDims.find(dim => dim.uid[2] === uid));
          })
          // 通过聚合方式计算后的值用来显示
          uids.forEach(uid => {
            row[uid] = sumVal;
          })
          row["sumVal"] = sumVal;
          const intervalUid = intervalDims[0].uid[2]?.split(".")?.at(-1);
          const intervalValue = row[intervalUid]?.split(",") || [];
          if (intervalDims?.length && intervalValue.length > 1) {
            let top = Number(intervalValue[0]);
            let bottom = Number(intervalValue[1]);
            let newRow = deepClone(row);
            newRow["intervalTop"] = top;
            newRow["intervalBottom"] = bottom;
            newSource.push(newRow);
          }else{
            newSource.push(row)
          }
        })
        return this.getDataAfterSort(newSource);
      }
    } else {
      let privateData = this.getPrivateData();
      let source = privateData.rows.map(row => {
        const interval = row["f_interval"].split(",");
        return {
          value: row["f_value"],
          name: row["f_name"],
          intervalTop: interval[1],
          intervalBottom: interval[0]
        }
      });
      return source;
    }
  }

  checkErrorData() {
    let yDims = this.getOption<OptionFieldValue[]>("axis-y");
    let xDims = this.getOption<OptionFieldValue[]>("axis-x");
    let intervalDims = this.getOption<OptionFieldValue[]>("axis-interval");
    if (xDims?.length && yDims?.length) {
      this.clearErrorDataStatus();
    } else if(!yDims.length && !xDims.length && !intervalDims.length) {
      this.addErrorDataStatus("filed-empty");
    } else {
      this.addErrorDataStatus("filed-incomplete");
    }
  }

  getLegendOtherOption() {
    let yDims = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let yAlias = [];
    yDims.forEach(dim => {
      yAlias.push(this.getFieldAlias(dim.uid));
    })
    return {
      data: yAlias.length ? yAlias : undefined
    }
  }

  stackType(): string {
    return ""
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
          if (seriesNameSet.has(param.seriesName)) continue;
          let iconHtml = showIcon ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${param.seriesName === "background" ? new Color(this.getOption("interval-color")).toCssString() : seriesCssColors[param.seriesIndex % seriesCssColors.length]};"></span>` : "";
          let val = param.value[param.dimensionNames[param.encode.y[0]]];
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
            <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${param.seriesName === "background" ? "区间" : param.seriesName}：</span>
            <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${param.seriesName === "background" ? `${param.value["intervalBottom"]}-${param.value["intervalTop"]}` : val}</span>
          </div>`;
          seriesNameSet.add(param.seriesName);
        }
        let titleHtml = showTitle ? `<div>
          <span style="color:${titleFontColor};font-size:${titleFontSize}px;line-height:1;">${params[0]?.name}</span>
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
    let yDims = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let xDims = this.getOption<OptionFieldValue[]>("axis-x") || [];
    let intervalDims = this.getOption<OptionFieldValue[]>("axis-interval") || [];
    let groupDims = this.getOption<OptionFieldValue[]>("axis-group") || [];
    let hasGroup = groupDims?.length > 0;
    this.intervalPoints.topPoints = [];
    this.intervalPoints.bottomPoints = [];
    let exampleData = [
      [0, 30],
      [3, 20],
      [10, 25],
      [3, 18],
      [10, 23]
    ]
    let example = [];
    if (!xDims.length || !yDims?.length) {
      example.push({
        name: "value",
        type: "line",
        encode: {
          x: "name",
          y: ["value", "intervalTop"],
        },
        stack: this.stackType(),
        xAxisIndex: 0,
        yAxisIndex: 0,
        silent: true,

      })
      example.push({
        type: 'custom',
        name: "background",
        encode: {
          x: "name",
          y: "value",
        },
        z: 2,
        itemStyle: {
          borderWidth: 1,
          color: this.toEchartsColor(this.getOption("interval-color"))
        },
        renderItem: (params, api) => {
          let index = params.dataIndex;
          let topPoint = api.coord([index, exampleData[index][1]]);
          let bottomPoint = api.coord([index, exampleData[index][0]]);
          this.intervalPoints.topPoints.push(topPoint);
          this.intervalPoints.bottomPoints.push(bottomPoint);

          if (index === exampleData.length - 1) {
            let points = [...this.intervalPoints.topPoints, ...this.intervalPoints.bottomPoints.reverse()]
            this.intervalData = [];
            this.intervalPoints.topPoints = [];
            this.intervalPoints.bottomPoints = [];
            return {
              // 表示这个图形元素是矩形。还可以是 'circle', 'sector', 'polygon' 等等。
              type: 'polygon',
              silent: true,
              shape: {
                // 矩形的位置和大小。
                points: points
              },
              // 用 api.style(...) 得到默认的样式设置。这个样式设置包含了
              // option 中 itemStyle 的配置和视觉映射得到的颜色。
              style: api.style({})
            };
          }
        }
      })
      return example
    } else {
      let seriesOpt = [];
      let lineOpt:any = super.echartsSeriesOption
      if(intervalDims?.length){
        seriesOpt.push({
          type: 'custom',
          name: "background",
          encode: {
            x: xDims[0].uid[2],
            y: "intervalTop",
          },
          z: 2,
          emphasis: {
            itemStyle: {
              color: this.toEchartsColor(this.getOption("interval-color")),
              opacity: 1
            }
          },
          itemStyle: {
            borderWidth: 0,
            strokeColor: "red",
            color: this.toEchartsColor(this.getOption("interval-color"))
          },
          renderItem: (params, api) => {
            if (!this.intervalData.length) {
              return;
            }
            let index = params.dataIndex;
            let topPoint = api.coord([index, this.intervalData[index][1]]);
            let bottomPoint = api.coord([index, this.intervalData[index][0]]);
            this.intervalPoints.topPoints.push(topPoint);
            this.intervalPoints.bottomPoints.push(bottomPoint);

            if (index === this.intervalData.length - 1) {
              let points = [...this.intervalPoints.topPoints, ...this.intervalPoints.bottomPoints.reverse()]

              this.intervalPoints.topPoints = [];
              this.intervalPoints.bottomPoints = [];
              return {
                // 表示这个图形元素是矩形。还可以是 'circle', 'sector', 'polygon' 等等。
                type: 'polygon',
                silent: true,
                shape: {
                  // 矩形的位置和大小。
                  points: points
                },
                // 用 api.style(...) 得到默认的样式设置。这个样式设置包含了
                // option 中 itemStyle 的配置和视觉映射得到的颜色。
                style: api.style({})
              };
            }
          }
        })
      }
      seriesOpt.push(...lineOpt)
      return seriesOpt;
    }
  }

  get tooltipAxisPointer(): TooltipComponentOption["axisPointer"] {
    return {
      show: true,
      type: "line"
    };
  }

  get axisInterval() {
    return this.getOption<OptionFieldValue[]>("axis-interval") || [];
  }

  override getMetaData() {
    return merge(super.getMetaData(), {
      axisValue: [
        ...this.axisX,
        ...this.axisY,
        ...this.axisInterval,
      ]
    } as WidgetMetaData);
  }
}
