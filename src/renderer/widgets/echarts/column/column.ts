import { PrivateData, OptionFieldUID } from "@common/types/project";
import { DefinedOptions, OptionFontValue, OptionFileValue, OptionFieldValue, WidgetMetaData, ChartClickState } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { Widget } from "@renderer/b2/controllers/widget";
import { formatFloat } from "@common/utils/math";
import { TheWidget as Axis } from "@renderer/widgets/echarts/axis";
import { TooltipComponentOption, SeriesOption, EChartsOption } from "echarts/dist/echarts";
import i18next from "@renderer/widgets/i18next";
import resource from "./locales";
import { recursive } from "merge";
import { computed, nextTick } from "vue";
import { merge } from "lodash";

const getBoardTableFields = (widget: Widget, uid: OptionFieldUID) => {
  if (!uid?.[0] || !uid?.[1]) {
    return [];
  }

  if (uid[0] === "c_private" && uid[1] === "t_private") {
    return widget.getPrivateData()?.fields || [];
  }

  const board = widget.getBoard();
  const bucket = board.connectionData[uid[0]]?.find(item => item.tableId == uid[1]);
  if (bucket?.fields?.length) {
    return bucket.fields;
  }

  void (board as any).ensureConnectionBucket?.([uid[0], uid[1]]);
  const connection = board.getConnections()?.find(item => item.uid === uid[0]);
  const table = connection?.tables?.find(item => item.uid === uid[1]);
  return table?.fields || [];
}

export class Column extends Axis {
  public valueUids = [];
  public dataLength: number;
  static resource = recursive(true, Axis.resource, resource);
  static getSeriesShapeBasicOptions() {
    return [
      {
        name: "series-shape-shadow-color",
        alias: i18next.t("shapeShadowColor"),
        type: "color(gradient)",
        default: "#ffffff00",
      },
      {
        name: "series-shape-shadow-blur",
        alias: i18next.t("shapeShadowBlur"),
        type: "number(unit=px)",
        default: 10,
      },
    ];
  }

  static defineOptions(): DefinedOptions[] {
    const UNIT_GE = "个";
    const UNIT_PIAN = "片";
    return [
      {
        data: {
          "fields": {
            alias: i18next.t("fieldsSetting"),
            fold: "unfold",
            children: [
              {
                name: "axis-group",
                alias: i18next.t("axisGroup"),
                type: "field(recommend=string, min=0, max=1)",
                visible: true,
              }
            ]
          }
        },
        style: {
          "series-color-group": {
            alias: i18next.t("seriesColorGroup"),
            children: [
              {
                name: "series-color-cluster",
                cluster: "array",
                alias: i18next.t("seriesColorCluster"),
                fold: "unfold",
                items: (chart: Column) => {
                  return chart.getSeries().map((series) => series.alias);
                },
                itemsHint: "数据字段",
                children: [
                  {
                    name: "series-color",
                    alias: i18next.t("seriesColor"),
                    default: "#1890FF",
                    type: "color(gradient)",
                    visible: false
                  },
                  {
                    name: "series-color2",
                    alias: i18next.t("seriesColor2"),
                    type: "palette(gradient)",
                    default: (widget: Column, paths: string[])=>{
                      const indexes = widget.getArrayClusterIndexes(["series-color-cluster"]);
                      const index = paths[1] as `idx-${string}`;
                      const idx = indexes.indexOf(index);
                      if (idx >= 0) {
                        return [widget.defaultColors10[idx % 10]];
                      } else {
                        return ["#1890FF"];
                      }
                    },
                  },
                  {
                    name: "series-border-color",
                    alias: i18next.t("borderColor2"),
                    type: "color(gradient)",
                    default: (widget: Column, paths: string[])=>{
                      const indexes = widget.getArrayClusterIndexes(["series-color-cluster"]);
                      const index = paths[1] as `idx-${string}`;
                      const idx = indexes.indexOf(index);
                      if (idx >= 0) {
                        return widget.defaultColors10[idx % 10];
                      } else {
                        return "#1890FF";
                      }
                    },
                  },
                  {
                    name: "condition-setting",
                    alias: i18next.t("conditionSetting"),
                    type: "boolean",
                    default: false,
                  },
                  {
                    name: 'single-settings-condition-cluster',
                    alias: i18next.t("conditionCluster"),
                    cluster: "array",
                    fold: "unfold",
                    items: () => {
                      return [i18next.t("clusterDefault1")]
                    },
                    visible: (element, paths) => element.getOption([...paths, 'condition-setting']),
                    children: [
                      {
                        name: "select-condition-way",
                        alias: i18next.t("selectConditionWay"),
                        type: "select",
                        selectChoices: [
                          {
                            label: i18next.t("existingCondition"),
                            value: "existing-condition"
                          },
                          {
                            label: i18next.t("newBuiltCondition"),
                            value: "new-built-condition"
                          }
                        ],
                        default: "new-built-condition"
                      },
                      {
                        name: "select-condition",
                        alias: i18next.t("selectCondition"),
                        type: "select(condition)",
                        selectChoices: (element) => {
                          const conditions = element.getBoard().getDataConditions() || [];
                          const choices = [];
                          for (const condition of conditions) {
                            choices.push({
                              label: condition.name,
                              value: condition.uid
                            })
                          }
                          return choices;
                        },
                        visible: (element, paths) => element.getOption([...paths, 'select-condition-way']) == "existing-condition",
                        default: ''
                      },
                      {
                        name: "condition-field",
                        alias: i18next.t("conditionField"),
                        type: "selects(size=50%-50%)",
                        selectChoices: (chart: Column) => {
                          let conditionChoices = [
                            {
                              label: i18next.t("equals"),
                              value: "=="
                            },
                            {
                              label: i18next.t("greaterThan"),
                              value: ">"
                            },
                            {
                              label: i18next.t("lessThan"),
                              value: "<"
                            },
                            {
                              label: i18next.t("notEquals"),
                              value: "!="
                            },
                            {
                              label: i18next.t("greaterThanEquals"),
                              value: ">="
                            },
                            {
                              label: i18next.t("lessThanEquals"),
                              value: "<="
                            },
                            {
                              label: i18next.t("include"),
                              value: "in"
                            },
                            {
                              label: i18next.t("notInclude"),
                              value: "notIn"
                            },
                            {
                              label: i18next.t("null"),
                              value: "null"
                            },
                            {
                              label: i18next.t("notNull"),
                              value: "notNull"
                            }
                          ]
                          let choices = [{
                            label: i18next.t("chooseField"),
                            value: ""
                          }]
                          let xDim = chart.getOption("axis-x")[0];
                          let yDim = chart.getOption("axis-y")[0];
                          if (!xDim && !yDim) {
                            return [choices, conditionChoices];
                          }
                          let uid = xDim?.uid || yDim?.uid;
                          const fields = getBoardTableFields(chart, uid);
                          if (!fields?.length) {
                            return [choices, conditionChoices];
                          }
                          fields.forEach(field => {
                            let choice = {
                              label: field.alias,
                              value: field.uid
                            }
                            choices.push(choice)
                          })

                          return [choices, conditionChoices];
                        },
                        default: (chart) => {
                          let choices = [{
                            label: i18next.t("chooseField"),
                            value: ""
                          }]
                          let xDim = chart.getOption("axis-x")[0];
                          let yDim = chart.getOption("axis-y")[0];
                          if (!xDim && !yDim) {
                            return [choices, "=="];
                          }
                          let uid = xDim?.uid || yDim?.uid;
                          const fields = getBoardTableFields(chart, uid);
                          fields.forEach(field => {
                            let choice = {
                              label: field.alias,
                              value: field.uid
                            }
                            choices.push(choice)
                          })
                          let defaultChoice = choices[1] ? choices[1].value : ""
                          return [defaultChoice, "null"]
                        },
                        visible: (element, paths) => element.getOption([...paths, 'select-condition-way']) !== "existing-condition",
                      },
                      // {
                      //   name: "setting-condition",
                      //   alias: i18next.t("settingCondition"),
                      // },
                      {
                        name: "field-value",
                        alias: i18next.t("fieldValue"),
                        type: "string",
                        default: "",
                        selectChoices: [
                          {
                            value: "average",
                            label: i18next.t("average")
                          },
                          {
                            value: "max",
                            label: i18next.t("max")
                          },
                          {
                            value: "min",
                            label: i18next.t("min")
                          }
                        ],
                        visible: (element, paths) => element.getOption([...paths, 'select-condition-way']) !== "existing-condition" && (element.getOption([...paths, 'condition-field'])[1] !== "null" && element.getOption([...paths, 'condition-field'])[1] !== "notNull"),
                      },
                      {
                        name: "condition-color",
                        alias: i18next.t("conditionColor"),
                        type: 'color(gradient)',
                        default: '#fff',
                        visible: (element, paths) => !!element.getOption([...paths, 'select-condition']) || element.getOption([...paths, 'select-condition-way']) == "new-built-condition",
                      },
                    ]
                  }
                ],
              },
              {
                name: "highlight-cluster",
                alias: i18next.t("hightColorCluster"),
                children: [
                  {
                    name: "highlight",
                    alias: i18next.t("highlight"),
                    type: "boolean",
                    default: false,
                  },
                  {
                    name: "series-hight-color-cluster",
                    cluster: "array",
                    alias: i18next.t("highlight"),
                    fold: "always-unfold",
                    visible: (widget)=>widget.getOption("highlight"),
                    items: (chart: Column) => {
                      return chart.getSeries().map((series) => series.alias);
                    },
                    itemsHint: "数据字段",
                    children: [
                      {
                        name: "series-color",
                        alias: i18next.t("seriesColor"),
                        default: "#1890FF",
                        type: "color(gradient)",
                      },
                      {
                        name: "highlight-border-color",
                        alias: i18next.t("highlightBorderColor"),
                        type: "color(gradient)",
                        default: "rgba(0,0,0,0)",
                      },
                      {
                        name: "highlight-border-width",
                        alias: i18next.t("highlightBorderWidth"),
                        type: "number(unit=px)",
                        default: 0,
                      },
                      {
                        name: "highlight-font-color",
                        alias: i18next.t("highlightFontColor"),
                        type: "color(gradient)",
                        default: "#ccc",
                      },
                      {
                        name: "highlight-font-size",
                        alias: i18next.t("highlightFontSize"),
                        type: "number(unit=px)",
                        default: 14,
                      },
                      {
                        name: "unit-highlight-font-color",
                        alias: i18next.t("unit-highlight-font-color"),
                        type: "color(gradient)",
                        default: "#ccc",
                      },
                      {
                        name: "unit-highlight-font-size",
                        alias: i18next.t("unit-highlight-font-size"),
                        type: "number(unit=px)",
                        default: 14,
                      },
                    ],
                  },
                ]
              }
            ],
          },
          "label-group": {
            children: [
              {
                name: "label-default-cluster",
                alias: i18next.t("labelDefaultCluster"),
                children: [
                  {
                    name: "label-text-style-cluster",
                    children: [
                      {
                        name: "hide-zero-value",
                        alias: i18next.t("hideZeroValue"),
                        default: false,
                        type: "boolean",
                      },
                      {
                        name: "label-position",
                        alias: i18next.t("labelPosition"),
                        default: "inside",
                        type: "select(radioGroup)",
                        selectChoices: [
                          {
                            label: i18next.t("labelPositionInside"),
                            value: "inside",
                          },
                          {
                            label: i18next.t("labelPositionTop"),
                            value: "top",
                          },
                          {
                            label: i18next.t("labelPositionTopAlign"),
                            value: "top-align",
                          }
                        ],
                      },
                      {
                        name: "label-color-type",
                        visible: true
                      },
                      {
                        name: "label-offset2",
                        alias: i18next.t("labelOffset"),
                        type: "vector<X,Y>(unit=px)",
                        default: [0,0],
                      },
                      {
                        name:"label-vertical-offset",
                        alias:i18next.t("label-vertical-offset"),
                        type:"number",
                        default:0,
                        visible:(widget: Column) => {
                          return widget.transposed
                        }
                      },
                      {
                        name: "label-shape-spacing",
                        alias: i18next.t("labelShapeSpacing"),
                        type: "number(unit=px)",
                        default: 15,
                        visible: (widget: Column) => {
                          return (
                            widget.getOption("label-position") === "right" ||
                            widget.getOption("label-position") === "top" ||
                            widget.getOption("label-position") === "top-align"
                          );
                        },
                      },
                      {
                        name: "label-x",
                        alias: i18next.t("label-x"),
                        type:"boolean",
                        default: false
                      },
                      {
                        name: "label-y",
                        alias:i18next.t("label-y"),
                        type:"boolean",
                        default: false,
                        visible:false
                      }
                    ]
                  },
                ],
              },
              {
                name: "ranking-cluster",
                children: [
                  {
                    name: "ranking-text-offset",
                    alias: i18next.t("rankingTextOffset"),
                    type: "number(unit=px)",
                    tip:i18next.t("rankingTextOffsetTip"),
                    default: 0
                  }
                ],
                visible: true,
              }
            ]
          },
          "series-shape": {
            children: [
              {
                name: "series-shape-default-cluster",
                children: [
                  {
                    name: "series-shape-number-type",
                    selectChoices: [
                      {
                        value: "all",
                        label: i18next.t("shapeNumberTypeAll"),
                      },
                      {
                        value: "custom",
                        label: i18next.t("shapeNumberTypeCustom"),
                      },
                    ],
                  },
                  {
                    name: "zero-removal",
                    visible: true
                  },
                  {
                    name: "shape-line",
                    alias: i18next.t("shapeLine"),
                    default: false,
                    type: "boolean",
                    visible: (widget: Column) => {
                      return widget.transposed;
                    },
                  },
                  {
                    name: "shape-line-color",
                    alias: i18next.t("shapeLineColor"),
                    type: "color",
                    default: "#ccc",
                    visible: (widget: Column) => {
                      return widget.getOption("shape-line");
                    },
                  },
                  {
                    name: "shape-line-width",
                    alias: i18next.t("shapeLineWidth"),
                    type: "number(unit=px)",
                    default: 1,
                    visible: (widget: Column) => {
                      return widget.getOption("shape-line");
                    },
                  },
                  {
                    name: "shape-line-position",
                    alias: i18next.t("shapeLinePosition"),
                    type: "select(radioGroup)",
                    default: "top",
                    selectChoices: [
                      {
                        value: "top",
                        label: i18next.t("shapeLinePositionTop"),
                      },
                      {
                        value: "center",
                        label: i18next.t("shapeLinePositionCenter"),
                      },
                      {
                        value: "bottom",
                        label: i18next.t("shapeLinePositionBottom")
                      },
                    ],
                    visible: (widget: Column) => {
                      return widget.getOption("shape-line");
                    },
                  },
                  {
                    name: "bar-shape",
                    alias: i18next.t("barShape"),
                    type: "select",
                    default: "bar",
                    selectChoices: [
                      {
                        value: "bar",
                        label: i18next.t("barShapeBar"),
                      },
                      {
                        value: "rect",
                        label: i18next.t("barShapeRect"),
                      },
                      {
                        value: "triangle",
                        label: i18next.t("barShapeTriangle"),
                      },
                      {
                        value: "inverted-triangle",
                        label: i18next.t("inverted-triangle"),
                      },
                    ],
                  },
                  {
                    //图形边框圆角半径
                    name: "shape-border-radius",
                    alias: i18next.t("borderRadius"),
                    type: "number(unit=px)",
                    default: 0,
                    visible: (widget: Column) => {
                      return widget.getOption("bar-shape") === "bar";
                    },
                  },
                  {
                    name: "fill-border-radius",
                    alias: i18next.t("fillBorderRadius"),
                    type: "number(unit=px)",
                    tip: i18next.t("borderTip"),
                    default: 0,
                    visible: (widget: Column) => {
                      return (
                        widget.getOption("bar-shape") === "bar" ||
                        widget.getOption("bar-shape") === "rect"
                      );
                    },
                  },
                  {
                    name: "bar-shape_burst-number",
                    alias: i18next.t("barShapeBurstNumber"),
                    type: `number(unit=${UNIT_PIAN}, min=0)`,
                    default: 20,
                    visible: (widget: Column) => {
                      return widget.getOption("bar-shape") === "rect";
                    },
                  },
                  {
                    name: "shape-background",
                    alias: i18next.t("shapeBackground"),
                    type: "color",
                    default: "#00000000",
                  },
                  {
                    name: "shape-column-width-type",
                    visible: true
                  },
                  {
                    name: "shape-column-width",
                    visible: (widget: Column) => {
                      return widget.getOption("shape-column-width-type") === "custom";
                    }
                  },
                  {
                    name: "shape-column-bargap",
                    alias: i18next.t("columnBargap"),
                    type: "number(unit=%)",
                    default: 0,
                    visible: (widget: Column) => {
                      return widget.getOption("shape-column-width-type") === 'custom' && widget.stack === false;
                    },
                  },
                  {
                    name: "shape-column-spacing",
                    alias: i18next.t("columnSpacing"),
                    type: "number(unit=px)",
                    default: 0,
                    visible: (widget: Column) => {
                      return widget.stack === true
                    },
                  },
                  {
                    name: "shapeData-border-width",
                    alias: i18next.t("shapeData-border-width"),
                    default: 0,
                    type: "number(unit=px)",
                  },
                  {
                    name: "shapeData-border-color-follow-shape",
                    alias: i18next.t("shapeData-border-color-follow-shape"),
                    type: "boolean",
                    default: false,
                  },
                  {
                    name: "shapeData-border-color",
                    alias: i18next.t("shapeData-border-color"),
                    default: "#cccccc",
                    type: "color(gradient)",
                    visible: false,
                  },
                  {
                    //边框宽度
                    name: "shape-border-width",
                    alias: i18next.t("borderWidth"),
                    default: 0,
                    type: "number(unit=px)",
                    // visible: (widget: Column) => {
                    //   return widget.getOption("bar-shape") === "bar";
                    // },
                  },
                  {
                    //边框颜色
                    name: "shape-border-color",
                    alias: i18next.t("borderColor"),
                    default: "#cccccc",
                    type: "color(gradient)",
                    visible: true,
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
                    name: "top-shape-position",
                    alias: i18next.t("topShapePosition"),
                    type: "boolean",
                    default: false
                  },
                  {
                    name: "top-shape-type",
                    alias: i18next.t("topShapeType"),
                    type: "select(radioGroup)",
                    selectChoices: [
                      { value: "polygon", label: i18next.t("topShapeTypePolygon"), },
                      { value: "circle", label: i18next.t("topShapeTypeCircle"), },
                      { value: "image", label: i18next.t("topShapeTypeImage"), }
                    ],
                    default: "polygon"
                  },
                  {
                    name: "top-shape-radius",
                    alias: i18next.t("topShapeRadius"),
                    type: "number(unit=px, min=0)",
                    default: 5,
                    visible: (widget: Column) => {
                      return widget.getOption("top-shape-type") == "circle"
                    },
                  },
                  {
                    name: "top-shape-height",
                    alias: i18next.t("topShapeHeight"),
                    type: "number(unit=px, min=0)",
                    default: 1,
                    visible: (widget: Column) => {
                      return widget.getOption("top-shape-type") == "polygon"
                    },
                  },
                  {
                    name: "top-shape-width",
                    alias: i18next.t("topShapeWidth"),
                    type: "number(unit=px, min=0)",
                    default: 1,
                    visible: false
                  },
                  {
                    name: "top-shape-left-height",
                    alias: i18next.t("topShapeLeftHeight"),
                    type: "number(unit=px, min=0)",
                    default: 1,
                    visible: false
                  },
                  {
                    name: "top-shape-right-height",
                    alias: i18next.t("topShapeRightHeight"),
                    type: "number(unit=px, min=0)",
                    default: 1,
                    visible: false
                  },
                  {
                    name: "top-shape-top-width",
                    alias: i18next.t("topShapeTopWidth"),
                    type: "number(unit=px, min=0)",
                    default: 1,
                    visible: (widget: Column) => {
                      return widget.getOption("top-shape-type") == "polygon"
                    },
                  },
                  {
                    name: "top-shape-bottom-width",
                    alias: i18next.t("topShapeBottomWidth"),
                    type: "number(unit=px, min=0)",
                    default: 1,
                    visible: (widget: Column) => {
                      return widget.getOption("top-shape-type") == "polygon"
                    },
                  },
                  {
                    name: "top-shape-overlap-select",
                    alias: i18next.t("topShapeOverlapSelect"),
                    type: "select",
                    default: "overlap",
                    visible: false,
                    selectChoices: [
                      {
                        label: i18next.t("topShapeOverlapSelectOverlap"),
                        value: "overlap"
                      },
                      {
                        label: i18next.t("topShapeOverlapSelectNotOverlap"),
                        value: "not-overlap"
                      }
                    ]
                  },
                  {
                    name: "top-shape-distance",
                    alias: i18next.t("topShapeDistance"),
                    type: "number(unit=px)",
                    default: 0
                  },
                  {
                    name: "top-shape-color-select",
                    alias: i18next.t("topShapeColorSelect"),
                    type: "select",
                    default: "follow",
                    selectChoices: [
                      {
                        label: i18next.t("topShapeColorSelectFollow"),
                        value: "follow"
                      },
                      {
                        label: i18next.t("topShapeColorSelectCustomize"),
                        value: "customize"
                      }
                    ],
                    visible: (widget: Column) => {
                      return widget.getOption("top-shape-type") !== "image"
                    },
                  },
                  {
                    name: "top-shape-color-cluster",
                    alias: i18next.t("topShapeColorCluster"),
                    cluster: "array",
                    items: (widget: Column) => {
                      return widget.getSeries().map(({ alias }) => alias);
                    },
                    itemsHint: "数据字段",
                    visible: (widget: Widget) => {
                      return widget.getOption("top-shape-type") !== "image" && widget.getOption("top-shape-color-select") === "customize";
                    },
                    default: "",
                    children: [
                      {
                        name: "top-shape-fill",
                        alias: i18next.t("topShapeFill"),
                        type: "color(gradient)",
                        default: "#ffff00",
                      },
                    ],
                  },
                  {
                    name: "top-shape-image-url",
                    alias: i18next.t("topShapeImageUrl"),
                    type: "file(format=image)",
                    default: "",
                    visible: (widget: Column) => {
                      return widget.getOption("top-shape-type") == "image"
                    },
                  },
                  {
                    name: "top-shape-highImage-url",
                    alias: i18next.t("top-shape-highImage-url"),
                    type: "file(format=image)",
                    default: "",
                    visible: (widget: Column) => {
                      return widget.getOption("top-shape-type") == "image"
                    },
                  },
                  {
                    name: "top-shape-image-width",
                    alias: i18next.t("topShapeImageWidth"),
                    type: "number(unit=px)",
                    default: 20,
                    visible: (widget: Column) => {
                      return widget.getOption("top-shape-type") == "image"
                    },
                  },
                  {
                    name: "top-shape-image-height",
                    alias: i18next.t("topShapeImageHeight"),
                    type: "number(unit=px)",
                    default: 20,
                    visible: (widget: Column) => {
                      return widget.getOption("top-shape-type") == "image"
                    },
                  },
                  {
                    name: "top-shape-image-opacity",
                    alias: i18next.t("topShapeImageOpacity"),
                    type: "number(unit=%)",
                    default: 100,
                    visible: (widget: Column) => {
                      return widget.getOption("top-shape-type") == "image"
                    },
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
                    visible: (widget: Column) => {
                      return widget.getOption("top-shape-type") == "image"
                    },
                  },
                  {
                    name: "top-shape-image-cluster",
                    alias: i18next.t("topShapeImageCluster"),
                    cluster: "array",
                    items: (widget: Column) => {
                      return widget.getSeries().map(({ alias }) => alias);
                    },
                    itemsHint: "数据字段",
                    visible: (widget: Widget) => {
                      return widget.getOption("top-shape-type") == "image" && widget.getOption("top-shape-image-common") === "alone";
                    },
                    children: [
                      {
                        name: "top-shape-image-url",
                        alias: i18next.t("topShapeImageUrl"),
                        type: "file(format=image)",
                        default: "",
                      },
                      {
                        name: "top-shape-highImage-url",
                        alias: i18next.t("top-shape-highImage-url"),
                        type: "file(format=image)",
                        default: "",
                      },
                    ],
                  },
                ]
              },
              {
                name: "series-shape-texture-cluster",
                alias: i18next.t("textureShapeCluster"),
                show: "tab",
                children: [
                  {
                    name: "texture-image",
                    alias: i18next.t("textureImage"),
                    type: "file(format=image)",
                  },
                  {
                    name: "texture-image-animation",
                    alias: i18next.t("textureImageAnimation"),
                    tip: i18next.t("textureImageAnimationTip"),
                    type: "boolean",
                    default: true,
                  },
                  {
                    name: "texture-image-animation-duration",
                    alias: i18next.t("textureImageAnimationDuration"),
                    type: "number(unit=s, min=1,step=0.1)",
                    default: 10,
                  }
                ]
              }
            ]
          },
          tooltip: {
            children: [
              {
                name: "tooltip-axisPointer",
                alias: i18next.t("tooltip-axisPointer"),
                show: "tab",
                children:[
                  {
                    name: "tooltip-axisPointer-color",
                    alias: i18next.t("tooltip-axisPointer-color"),
                    type: "color",
                    default: "#4047527E",
                  },
                  {
                    name: "tooltip-axisPointer-shadowBlur",
                    alias: i18next.t("tooltip-axisPointer-shadowBlur"),
                    type: "number",
                    default: 0,
                  },
                  {
                    name: "tooltip-axisPointer-shadowColor",
                    alias: i18next.t("tooltip-axisPointer-shadowColor"),
                    type: "color",
                    default: "#ffffff",
                  },
                  {
                    name: "tooltip-axisPointer-shadowOffset",
                    alias: i18next.t("tooltip-axisPointer-shadowOffset"),
                    type: "vector<X, Y>(unit=px)",
                    default: [0, 0],
                  },
                ]
              },
            ]
          },
        },
      },
      ...super.defineOptions(),
    ];
  }

  override getMetaData() {
    return merge(super.getMetaData(), {
      axisValue: [
        ...this.axisX,
        ...this.axisY,
        ...this.axisGroup,
      ]
    } as WidgetMetaData);
  }

  get percent() {
    return false;
  }

  get column3D() {
    return false;
  }

  protected getDefaultPrivateData(): PrivateData {
    return {
      fields: [
        { uid: "f_name", alias: "分类", type: "string" },
        { uid: "f_value1", alias: "值1", type: "number" },
        { uid: "f_value2", alias: "值2", type: "number" },
      ],
      rows: [
        { f_name: '示例1', f_value1: 1048, f_value2: 650 },
        { f_name: '示例2', f_value1: 735, f_value2: 650 },
        { f_name: '示例3', f_value1: 580, f_value2: 650 },
        { f_name: '示例4', f_value1: 1005, f_value2: 650 },
        { f_name: '示例5', f_value1: 700, f_value2: 650 },
      ],
    };
  }

  getSeriesColors() {
    let strColors = [];
    let series = this.getSeries();
    const indexes = this.getArrayClusterIndexes(["series-color-cluster"]);
    for (let i = 0; i < series.length; i++) {
      let colors = this.getOption<Color[]>(["series-color-cluster", indexes[i], "series-color2"]);
      strColors.push(Array.from(colors).map((item) => { return new Color(item).toEchartsColor() }));
    }
    if (strColors.length == 0) {
      strColors = [this.defaultColors10];
    }
    return [].concat(strColors);
  }

  getSeriesBorderColors() {
    const borderColors = [];
    let series = this.getSeries();
    const indexes = this.getArrayClusterIndexes(["series-color-cluster"]);
    for (let i = 0; i < series.length; i++) {
      let borderColor = this.getOption<Color>(["series-color-cluster", indexes[i], "series-border-color"]);
      borderColors.push(new Color(borderColor).toEchartsColor());
    }
    return [].concat(borderColors);
  }


  getSeriesHightColors() {
    {
      let strColors = [];
      let series = this.getSeries();
      const indexes = this.getArrayClusterIndexes(["series-hight-color-cluster"]);
      for (let i = 0; i < series.length; i++) {
        let color = this.getOption<Color>(["series-hight-color-cluster", indexes[i], "series-color"]);
        strColors.push(this.toEchartsColor(color as Color));
      }
      if (strColors.length == 0) {
        strColors = this.defaultColors10;
      }
      return [].concat(strColors);
    }
  }

  getSeriesHightBorderColors() {
    let strColors = [];
    let series = this.getSeries();
    const indexes = this.getArrayClusterIndexes(["series-hight-color-cluster"]);
    for (let i = 0; i < series.length; i++) {
      let color = this.getOption<Color>(["series-hight-color-cluster", indexes[i], "highlight-border-color"]);
      strColors.push(this.toEchartsColor(color as Color));
    }
    if (strColors.length == 0) {
      strColors = this.defaultColors10;
    }
    return [].concat(strColors);
  }

  getSeriesHightFontColors() {
    let strColors = [];
    let series = this.getSeries();
    const indexes = this.getArrayClusterIndexes(["series-hight-color-cluster"]);
    for (let i = 0; i < series.length; i++) {
      let color = this.getOption<Color>(["series-hight-color-cluster", indexes[i], "highlight-font-color"]);
      strColors.push(this.toEchartsColor(color as Color));
    }
    if (strColors.length == 0) {
      strColors = this.defaultColors10;
    }
    return [].concat(strColors);
  }

  getSeriesTopShapeColors() {
    {
      let strColors = [];
      let series = this.getSeries();
      const indexes = this.getArrayClusterIndexes(["top-shape-color-cluster"]);
      for (let i = 0; i < series.length; i++) {
        let color = this.getOption<Color>(["top-shape-color-cluster", indexes[i], "top-shape-fill"]);
        strColors.push(this.toEchartsColor(color as Color));
      }
      if (strColors.length == 0) {
        strColors = this.defaultColors10;
      }
      return [].concat(strColors);
    }
  }

  getSeriesCssColors() {
    let strColors = [];
    let series = this.getSeries();
    const indexes = this.getArrayClusterIndexes(["series-color-cluster"]);
    for (let i = 0; i < series.length; i++) {
      let colors = this.getOption<Color[]>(["series-color-cluster", indexes[i], "series-color2"]);
      strColors.push(Array.from(colors).map((item) => { return new Color(item).toCssString() }));
    }
    if (strColors.length == 0) {
      strColors = this.defaultColors10;
    }
    return [].concat(strColors);
  }

  _datasetSource() {
    let yDims = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let xDims = this.getOption<OptionFieldValue[]>("axis-x") || [];
    let sourceData = super._datasetSource();
    if (this.transposed) {
      sourceData = sourceData.reverse();
    }

    let groupDims = this.getOption<OptionFieldValue[]>("axis-group") || [];
    if (groupDims.length && xDims.length) {
      let groupUid = groupDims[0].uid[2];
      let xUid = xDims[0].uid[2];
      let dataMap = {};
      sourceData.forEach(row => {
        let groupType = row[groupUid];
        if (!dataMap[groupType]) dataMap[groupType] = [];
        dataMap[groupType].push(row[xUid]);
      })
      let maxLength = 0;
      for (let key in dataMap) {
        maxLength = Math.max(Array.from(new Set(dataMap[key])).length, maxLength);
      }
      this.dataLength = maxLength;
    } else {
      this.dataLength = sourceData.length;
    }
    return sourceData;
  }

  addEchartsShapes(echarts) {
    // 绘制分片柱状图s
    const burstColumn = echarts.graphic.extendShape({
      buildPath: function (ctx, shape) {
        let { burstNum, barWidth, barHeight, transposed, maxHeight, maxStartX, maxStartY, x, y } = shape;

        let unitHeight = maxHeight / burstNum;  //各个分片高度
        let rectHeight = unitHeight * 0.7;
        if (!transposed) {

          let startX = x - barWidth / 2;
          let bottomY = maxStartY + maxHeight;
          let realBottomY = y + barHeight;
          let realTopY = y;
          let currentCtx = ctx;

          for (let burstIndex = 0; burstIndex < burstNum; burstIndex++) {
            let bY = bottomY - (burstIndex * unitHeight);
            let tY = bottomY - (burstIndex * unitHeight) - rectHeight;
            if (tY < realTopY) tY = realTopY;
            if (realBottomY <= bY && realBottomY > tY) {
              bY = realBottomY;
            }
            if (tY > realBottomY || bY < realTopY) continue;
            currentCtx = currentCtx.moveTo(startX, bY).lineTo(startX + barWidth, bY).lineTo(startX + barWidth, tY).lineTo(startX, tY).closePath();
          }
        } else {
          let startY = y - barWidth / 2;
          let leftX = maxStartX - maxHeight;
          let realLeftX = x - barHeight;
          let realRightX = x;
          let currentCtx = ctx;
          for (let burstIndex = 0; burstIndex < burstNum; burstIndex++) {
            let lX = leftX + (burstIndex * unitHeight);
            let rX = leftX + (burstIndex * unitHeight) + rectHeight;
            if (rX > realRightX) rX = realRightX;
            if (realLeftX <= rX && realLeftX > lX) {
              lX = realLeftX;
            }
            if (rX < realLeftX || lX > realRightX) continue;
            currentCtx = currentCtx.moveTo(lX, startY).lineTo(rX, startY).lineTo(rX, startY + barWidth).lineTo(lX, startY + barWidth).closePath();
          }
        }
      }
    });

    const triangleColumn = echarts.graphic.extendShape({
      buildPath: function (ctx, shape) {
        let { barWidth, barHeight, transposed } = shape;
        if (!transposed) {
          let startX = shape.x - barWidth / 2;
          let startY = shape.y;
          let bottomY = shape.bottomY;
          ctx.moveTo(startX, bottomY).quadraticCurveTo(shape.x, bottomY, shape.x, startY).quadraticCurveTo(shape.x, bottomY, startX + barWidth, bottomY).closePath();
        } else {
          let startX = shape.x;
          let topY = shape.y - barWidth / 2;
          let leftX = startX - barHeight;
          ctx.moveTo(leftX, topY).quadraticCurveTo(leftX + barHeight / 3, shape.y, startX, shape.y).quadraticCurveTo(leftX + barHeight / 3, shape.y, leftX, topY + barWidth).closePath();
        }
      }
    });

    // 倒三角形
    const invertedTriangleColumn = echarts.graphic.extendShape({
      buildPath: function (ctx, shape) {
        let { barWidth, barHeight, transposed } = shape;
        if (!transposed) {
          let startX = shape.x - barWidth / 2;
          let startY = shape.y;
          let bottomY = shape.bottomY;
          ctx.moveTo(startX, startY).quadraticCurveTo(shape.x, startY, shape.x, bottomY).quadraticCurveTo(shape.x, startY, startX + barWidth, startY).closePath();
        } else {
          let startX = shape.x;
          let topY = shape.y - barWidth / 2;
          let leftX = startX - barHeight;
          ctx.moveTo(startX, topY).quadraticCurveTo(leftX + barHeight / 3, shape.y, leftX, shape.y).quadraticCurveTo(leftX + barHeight / 3, shape.y, startX, topY + barWidth).closePath();
        }
      }
    });

    echarts.graphic.registerShape('burstColumn', burstColumn);
    echarts.graphic.registerShape('triangleColumn', triangleColumn);
    echarts.graphic.registerShape('invertedTriangleColumn', invertedTriangleColumn);
  }

  getTopShapeImageSrc(index) {
    const imageCommon = this.getOption("top-shape-image-common");
    let imageOptions = this.getOption<OptionFileValue>('top-shape-image-url');
    let indexes = this.getArrayClusterIndexes("top-shape-image-cluster");
    if (imageCommon !== "common") {
      imageOptions = this.getOption<OptionFileValue>(["top-shape-image-cluster", indexes[index], "top-shape-image-url"]);
    }
    if (typeof imageOptions === "string") {
      return imageOptions;
    } else {
      return imageOptions.url || this.handleImageSrc(imageOptions.relativePath);
    }
  }

  getTopShapeHighImageSrc(index) {
    const imageCommon = this.getOption("top-shape-image-common");
    let imageOptions = this.getOption<OptionFileValue>('top-shape-highImage-url');
    let indexes = this.getArrayClusterIndexes("top-shape-image-cluster");
    if (imageCommon !== "common") {
      imageOptions = this.getOption<OptionFileValue>(["top-shape-image-cluster", indexes[index], "top-shape-highImage-url"]);
    }
    if (typeof imageOptions === "string") {
      return imageOptions;
    } else {
      return imageOptions.url || this.handleImageSrc(imageOptions.relativePath);
    }
  }

  checkErrorData() {
    let yDims = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let xDims = this.getOption<OptionFieldValue[]>("axis-x") || [];
    if (yDims.length && xDims.length) {
      this.clearErrorDataStatus();
    } else if (yDims.length || xDims.length) {
      this.addErrorDataStatus("filed-incomplete");
    } else {
      this.addErrorDataStatus("filed-empty");
    }
  }

  // 处理新建数据条件的运算
  conditionOperate(currentVal, fn, fieldValue, uid) {
    if (uid) {
      let dataArr = this.datasetSource().map(item => {
        return item[uid];
      });
      if (fieldValue == 'average') {
        let sum = dataArr.reduce((prev, cur) => {
          return prev + cur;
        }, 0);
        let average = sum / dataArr.length;
        fieldValue = average
      } else if (fieldValue == "max") {
        let max = Math.max(...dataArr);
        fieldValue = max;
      } else if (fieldValue == "min") {
        let min = Math.min(...dataArr);
        fieldValue = min;
      }
    }

    if (currentVal == undefined) {
      return false;
    }
    if (fn == ">") {
      if (currentVal > fieldValue) {
        return true;
      }
    } else if (fn == ">=") {
      if (currentVal >= fieldValue) {
        return true;
      }
    } else if (fn == "<") {
      if (currentVal < fieldValue) {
        return true;
      }
    } else if (fn == "<=") {
      if (currentVal <= fieldValue) {
        return true;
      }
    } else if (fn == "==") {
      if (currentVal == fieldValue) {
        return true;
      }
    } else if (fn == "!=") {
      if (currentVal != fieldValue) {
        return true;
      }
    }
    // TODO 包含  不包含  空  非空
    else if (fn == "null") {
      if (currentVal == null) {
        return true;
      }
    } else if (fn == "notNull") {
      if (currentVal != null) {
        return true
      }
    } else if (fn == "in") {
      let temp = String(currentVal);
      if (temp.includes(String(fieldValue))) {
        return true;
      }
    } else if (fn == "notIn") {
      let temp = String(currentVal);
      if (!temp.includes(String(fieldValue))) {
        return true;
      }
    }
    return false;
  }

  get showLabel() {
    return this.getOption("label");
  }

  get defaultPadding() {
    const padding = super.defaultPadding

    if(this.getOption("slider-display")) {
      padding.bottom += 10 + Number(this.getOption("slider-move-handle-size")) + Number(this.getOption("slider-height")) + Number(this.getOption("slider-bottom"));
    }
    let labelPosition = this.getOption("label-position");
    if (this.transposed && labelPosition === "top-align") {
      padding.right += 40;
    } else if (!this.transposed && labelPosition === "top-align") {
      padding.top += 40;
    }

    return padding;
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

  private _textureImage;
  private _textureOffsetY = 50;
  private _textureAnimationTimer;
  private _textureAnimationIndex = 0;

  get textureImage() {
    if(!this._textureImage){
      this._textureImage = computed(() => {
        const textureImageOption = this.getOption<OptionFileValue>("texture-image");
        return textureImageOption?.url || this.handleImageSrc(textureImageOption?.relativePath);
      })
    }
    return this._textureImage.value;
  }

  removeTextureAnimationTimer() {
    window.clearInterval(this._textureAnimationTimer);
    this._textureAnimationTimer = null;
    this._textureOffsetY = 50;
  }

  get textureAnimationDuration() {
    return this.getOption<number>("texture-image-animation-duration");
  }

  get textureOffsetY() {
    if(!this.textureImage || !this.getOption<boolean>("texture-image-animation")){
      this.removeTextureAnimationTimer();
    } else {
      if(!this._textureAnimationTimer){
        const textureAnimationFn = ()=>{
          this._textureOffsetY -= 50;
          if (this._textureOffsetY < 0) {
            this._textureOffsetY = 50;
          }
          this.echartsChart?.setOption({
            series: this.echartsSeriesOption
          }, {
            notMerge: false,
            replaceMerge: "series",
            // lazyUpdate: true
          });
          this._textureAnimationIndex = (this._textureAnimationIndex + 1) % 2;
          if (this._textureAnimationIndex === 0) {
            textureAnimationFn();
          }
        }
        this._textureAnimationTimer = setInterval(textureAnimationFn, this.textureAnimationDuration * 1000);
      }
    }
    return this._textureOffsetY;
  }

  get echartsSeriesOption(): SeriesOption | SeriesOption[] {
    if (this.xTypes) this.datasetSource();
    let yDims = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let xDims = this.getOption<OptionFieldValue[]>("axis-x") || [];
    let groupDims = this.getOption<OptionFieldValue[]>("axis-group") || [];
    let hasGroup = groupDims.length > 0;
    let columnCustom = this.getOption<string>("shape-column-width-type") === "custom";
    let shapeColumnWidth = columnCustom ? this.getOption<number>("shape-column-width") : "auto";
    let shapeBorderWidth = this.getOption<number>("shape-border-width");
    let shapeDataBorderWidth = this.getOption<number>("shapeData-border-width");
    let shapeBorderRadius = this.getOption<number>("shape-border-radius");
    let shapeColumnNumber = this.getOption<number>("shape-column-number");
    shapeColumnNumber = shapeColumnNumber < 2 ? 2 : shapeColumnNumber;
    let labelPosition = this.getOption<any>("label-position");
    let seriesOpt = [];
    let seriesColor = this.getSeriesColors();
    let shapeBackground = new Color(this.getOption<Color>("shape-background")).toEchartsColor();
    let fillBorderRadius = this.getOption("fill-border-radius");
    let showLabel = this.showLabel;
    let labelFont = this.getOption<OptionFontValue>("label-font");
    let labelShapeSpacing = this.getOption<number>("label-shape-spacing");
    let isPercent = this.getOption("label-text-type") === "percent";
    let labelDecimalPlaces = this.getOption<number>("label-decimal-places");
    let isComplete = this.getOption<boolean>("label-complete-zero");
    let colorFollow = this.getOption("label-color-type") === "follow";
    let barShape = this.getOption<string>("bar-shape");
    let barShapeBurstNumber: any = this.getOption<number>("bar-shape_burst-number");
    let shapeBarGap = this.getOption<number>("shape-column-bargap");
    let shapeBarSpac = this.getOption<number>("shape-column-spacing");
    let currentBarGap = shapeColumnWidth !== "auto" ? shapeBarGap / Number(shapeColumnWidth) : "30%";
    let unitFont = this.getOption<OptionFontValue>("label-unit-font");
    let highlight = this.getOption("highlight");
    let columnWidth = this.getOption<number>('shape-column-width');
    let hideZeroValue = this.getOption("hide-zero-value");
    let xLabel = this.getOption("label-x")
    let yLabel = this.getOption("label-y")
    let colorIndexes = this.getArrayClusterIndexes("series-color-cluster");
    let hightLightIndexes = this.getArrayClusterIndexes(["series-hight-color-cluster"]);
    let singleSeriesOpt = <any>null
    let stackFlag = true;  //堆叠状态
    let notStackFlag = true;  //堆叠不分片时状态

    const borderFollowShape = this.getOption("shapeData-border-color-follow-shape");
    const seriesBorderColor = this.getSeriesBorderColors();
    const labelOffset = this.getOption("label-offset2") || [0,0];
    const labelColorFollow = this.getOption("label-color-type") == "follow";
    const getSingleColor = (color) => {
      if(typeof color ==='string') return color;
      return color?.["colorStops"]?.[0]?.["color"];
    }
    // 处理custom图形文本数值和单位
    let unit = this.getOption<string>("label-unit-value") || "";
    const handleCustomLabel = (value) => {
      if (!isPercent) {
        value = formatFloat(value, labelDecimalPlaces, isComplete);
      } else {
        value = formatFloat(value * 100, labelDecimalPlaces, isComplete);
        unit = unit || "%";
      }
      return { value, unit };
    }

    // 计算custom图形文本偏移
    const handleCustomLabelOffset = (text, font = 'normal 12px sans-serif') => {
      let _canvas = document.createElement('canvas');
      const _context = _canvas.getContext('2d');
      _context.font = font;
      let fontWidth = _context.measureText(text);
      _canvas.remove();
      return fontWidth;
    }

    // 获取当前系列的图例是否处于选中状态
    const isLegendSelect = (target) => {
      let legendInfo = this.echartsChart.getOption().legend[0].selected;
      for (let key in legendInfo) {
        if (key.split("__$")[0] === target && legendInfo[key] === false) {
          return false;
        }
      }
      return true;
    }

    //获取x轴字段
    const addX = ()=>{
      let indexs = xDims?.[0]?.uid?.[2]
      return this.datasetSource()?.map(item=> item[indexs])
    }
    let xName = addX()


    // 图形的id 分三类  1、正常  -bar-  2、分片  -burstRect-  3、三角形  -triangle-
    let lineNum = hasGroup ? this.xTypes.length : yDims.length;
    lineNum = yDims.length > 0 ? lineNum : 0;
    let privateYdims = [];
    let privateXdims = [];
    if (lineNum == 0 || !yDims.length || !xDims.length) {
      let fields = this.getPrivateData().fields;
      fields?.map(item=>{
        if(item.type == "number"){
          privateYdims.push({alias:item?.alias,type:item?.type,uid:["","",item?.uid]})
        }else if(item.type == "string"){
          privateXdims.push({alias:item?.alias,type:item?.type,uid:["","",item?.uid]})
        }
      })
      lineNum = privateYdims.length
      yDims = privateYdims;
      xDims = privateXdims;
    }
    for (let index = 0; index < lineNum; index++) {
      let borderColor = seriesBorderColor[index];
      const getXAndYUIDs = () => {
        let x, y;
        if (hasGroup){
          if (xDims[0].uid[2] === yDims[0].uid[2]){
            x = this.transposed ? yDims[0].uid[2] + "_" + this.xTypes[index] + "_count" : xDims[0].uid[2]
            y = this.transposed ? xDims[0].uid[2] : yDims[0].uid[2] + "_" + this.xTypes[index] + "_count"
          }else{
            x = this.transposed ? yDims[0].uid[2] + "_" + this.xTypes[index] : xDims[0].uid[2]
            y = this.transposed ? xDims[0].uid[2] : yDims[0].uid[2] + "_" + this.xTypes[index]
          }
        } else {
          if (xDims[0].uid[2] === yDims[index].uid[2]){
            x = this.transposed ? `${yDims[index].uid[2]}_count` : xDims[0].uid[2]
            y = this.transposed ? xDims[0].uid[2] : `${yDims[index].uid[2]}_count`
          }else{
            x = this.transposed ? yDims[index].uid[2] : xDims[0].uid[2]
            y = this.transposed ? xDims[0].uid[2] : yDims[index].uid[2]
          }
        }
        return {
          x,
          y
        }
      }
      // 使用自带数据
      let encode:any = {}
      let name;
      let yUid;
      if (!this.usePrivateData) {
        encode = getXAndYUIDs()
        name = hasGroup ? this.getFieldAlias(yDims[0].uid) : this.getFieldAlias(yDims[index].uid);
        // yUid = hasGroup ? yDims[0].uid[2] : yDims[index].uid[2];
        yUid = this.getMetricFieldKey(hasGroup ? yDims[0] : yDims[index], xDims)
        if (hasGroup) {
          name = this.xTypes[index];
        }
      } else {
        encode = {
          x: this.transposed ? privateYdims[index].uid : privateXdims[0].uid,
          y: this.transposed ? privateXdims[0].uid : privateYdims[index].uid
        }
        name = privateYdims[index].alias;
        yUid = privateYdims[index].uid;
      }

      // 填充形状为普通
      // 堆叠
      if (barShape === "bar" && this.stack) {
        let valueNum = lineNum;
        let barShapeBgOpt;
        let barWidth: number = columnWidth;
        // 颜色组设置
        let color:any = "#1890FFFF";
        let colorArr = seriesColor[index];
        singleSeriesOpt = {
          type: 'custom',
          name,
          encode,
          id: `${yUid}-bar-${index}`,
          selectedMode: 'single',
          z: 3,
          clip:false,
          labelLayout(params) {
            return {
              x: params.rect.x + 10,
              y: params.rect.y + params.rect.height / 2 - this.getOption("label-vertical-offset"),
              verticalAlign: 'middle',
              align: 'left'
            }
          },
          renderItem: (params, api) => {
            let { x, y } = getXAndYUIDs()
            let categoryIndex = api.value(this.transposed ? y : x);
            let yUid = this.transposed ? x : y;
            let yValue = api.value(this.percent ? yUid + '_percentValue' : yUid);
            if (isNaN(yValue)) return;
            // 根据数据获取坐标信息
            let size = this.transposed ? api.size([yValue, categoryIndex]) : api.size([categoryIndex, yValue]);
            let start = this.transposed ? api.coord([yValue, categoryIndex]) : api.coord([categoryIndex, yValue]);
            let barLayout = api.barLayout({
              barGap: this.stack ? '-100%' : currentBarGap,
              count: valueNum
            });
            // 颜色组取值
            color = params.dataIndex >= colorArr?.length ? colorArr?.[colorArr?.length - 1] : colorArr?.[params.dataIndex];
            let hightLightColor = highlight ? this.getSeriesHightColors()[index] : color;
            let step = 0;
            if (shapeColumnWidth === "auto") {
              step = barLayout[index].offsetCenter;
              barWidth = barLayout[index].width;
            } else {
              if (lineNum % 2 === 0) { // 正中间没有柱子
                if (index < lineNum / 2) { // 左边的柱子
                  step = - shapeBarGap / 2 - Number(shapeColumnWidth) / 2 - (lineNum / 2 - index - 1) * (Number(shapeColumnWidth) + shapeBarGap);
                } else {
                  step = shapeBarGap / 2 + Number(shapeColumnWidth) / 2 + (index - lineNum / 2) * (Number(shapeColumnWidth) + shapeBarGap);
                }
              } else { // 正中间有柱子
                if (index < lineNum / 2 - 0.5) { // 左边
                  step = - Number(shapeColumnWidth) / 2 - (lineNum / 2 - index - 0.5) * shapeBarGap - (lineNum / 2 - index - 1) * Number(shapeColumnWidth);
                } else if (index + 0.5 === lineNum / 2) { // 中间
                  step = 0;
                } else {
                  step = Number(shapeColumnWidth) / 2 + (index - lineNum / 2 + 0.5) * shapeBarGap + (index - lineNum / 2) * Number(shapeColumnWidth);
                }
              }
            }

            // 各组间隔偏移
            if (!this.stack) {
              this.transposed ? start[1] += step : start[0] += step;
            }

            // 取坐标轴最大值
            let rectGroup = [];
            let dataIndex = this.transposed ? this.dataLength - 1 - params.dataIndex : params.dataIndex;

            // 数据条件颜色
            let conditionSetting = this.getOption(['series-color-cluster', colorIndexes[index], "condition-setting"])
            if (conditionSetting) {
              let path = ['series-color-cluster', colorIndexes[index]]
              let indexes = this.getOption([...path, "single-settings-condition-cluster"])?.["indexes"] || [];
              for (const clusterIndex of indexes) {
                let selectConditionWay = this.getOption<string>([...path, 'single-settings-condition-cluster', clusterIndex, "select-condition-way"])
                if (selectConditionWay == 'new-built-condition') {
                  let [conditionFieldUid, fn] = this.getOption<string>([...path, 'single-settings-condition-cluster', clusterIndex, "condition-field"]);
                  let fieldValue = this.getOption<string>([...path, 'single-settings-condition-cluster', clusterIndex, "field-value"]);
                  let value = this.datasetSource()[dataIndex][conditionFieldUid]
                  if (!this.conditionOperate(value, fn, fieldValue, conditionFieldUid)) continue;
                  color = this.toEchartsColor(new Color(this.getOption<Color>([...path, 'single-settings-condition-cluster', clusterIndex, 'condition-color'])));
                } else {
                  const selectCondition: any = this.getOption<string>([...path, 'single-settings-condition-cluster', clusterIndex, "select-condition"]);
                  // 没有选择数据条件的 pass
                  if (!selectCondition) continue;
                  // 先看条数是否满足
                  let conditions = this.getBoard().getDataConditions() || [];
                  let condition = conditions.find(item => item.uid === selectCondition);
                  const isExistence = this.checkDataConditions([condition], this.dataSortMap.get(dataIndex));
                  if (!isExistence) continue;
                  color = this.toEchartsColor(new Color(this.getOption<Color>([...path, 'single-settings-condition-cluster', clusterIndex, 'condition-color'])));
                }
              }
            }
            let prevSum = 0;
            let prevSum_P = 0;
            let prevSum_N = 0;
            if (hasGroup) {
              let xValue = api.value(xDims[0].uid[2]);
              // api.value--根据params.dataIndexInside计算
              for (let i = 0; i <= params.dataIndexInside; i++) {
                if (api.value(xDims[0].uid[2], i) === xValue) {
                  let currentUid = xDims[0].uid[2] === yDims[0].uid[2]  ? `${yDims[0].uid[2]}_count` : yDims[0].uid[2];
                  let currentValue = api.value(currentUid, i);
                  if ((currentValue >= 0 && yValue >= 0) || (currentValue < 0 && yValue < 0)) {
                    prevSum += currentValue;
                  }
                }
              }
            } else {
              for (let i = 0; i <= index; i++) {
                // 如果开了图例并且对应图例没有处在选中状态，需要在计算时去掉对应柱子的数据
                let yAlias = this.getFieldAlias(yDims[i].uid);
                if (!isLegendSelect(yAlias)) continue;
                let currentUid = xDims[0].uid[2] === yDims[0].uid[2]  ? `${yDims[i].uid[2]}_count` : yDims[i].uid[2];
                let currentValue = api.value(this.percent ? currentUid + '_percentValue' : currentUid);
                if ((currentValue >= 0 && yValue >= 0) || (currentValue < 0 && yValue < 0)) {
                  prevSum += currentValue;
                }
              }
            }
            let stackStart
            if (this.transposed) {
              stackStart = prevSum >= 0 ? api.coord([prevSum, categoryIndex]) : api.coord([prevSum - yValue, categoryIndex])
            } else {
              stackStart = prevSum >= 0 ? api.coord([categoryIndex, prevSum]) : api.coord([categoryIndex, prevSum - yValue])
            }
            rectGroup.push({
              type: "rect",
              shape: {
                x: !this.transposed ? stackStart[0] - barWidth / 2 : stackStart[0] - size[0] + shapeBarSpac * index,
                y: !this.transposed ? stackStart[1] - shapeBarSpac * index : stackStart[1] - barWidth / 2,
                width: this.transposed ? size[0] : barWidth,
                r: shapeBorderRadius <= 0 ? 0 : shapeBorderRadius,
                height: this.transposed ? barWidth : size[1],
                transposed: this.transposed,
                opacity: barShape === "bar" ? 1 : 0,
              },
              originY: start[1] + (this.transposed ? size[0] : size[1]),
              style: {
                fill: color,
                lineWidth: shapeDataBorderWidth,
                stroke: borderFollowShape ? color : borderColor,// this.toEchartsColor(this.getOption("shapeData-border-color"))
              },
              select: {
                style: {
                  fill: hightLightColor
                }
              },
              emphasisDisabled: !this.getOption("highlight"),
              enterFrom: {
                scaleX: this.transposed ? 0 : 1,
                scaleY: this.transposed ? 1 : 0,
              },
              enterAnimation: {
                duration: 1000,
                easing: "quarticOut"
              },
              transition: 'shape'
            })

            // 添加label
            if (showLabel || unit) {
              // 计算label的值
              let textVal = handleCustomLabel(yValue).value;
              let unit = handleCustomLabel(yValue).unit
              // 计算lable偏移自动使其居中
              let val_fontWidth;
              if(this.transposed){
                val_fontWidth = yLabel ? handleCustomLabelOffset(xName[params.dataIndex]+"-"+textVal, `${labelFont.italic ? "italic" : "normal"} ${labelFont.size}px ${labelFont.family}`).width : handleCustomLabelOffset(textVal, `${labelFont.italic ? "italic" : "normal"} ${labelFont.size}px ${labelFont.family}`).width;
              }else{
                val_fontWidth = xLabel ? handleCustomLabelOffset(xName[params.dataIndex]+"-"+textVal, `${labelFont.italic ? "italic" : "normal"} ${labelFont.size}px ${labelFont.family}`).width : handleCustomLabelOffset(textVal, `${labelFont.italic ? "italic" : "normal"} ${labelFont.size}px ${labelFont.family}`).width;
              }
              let unit_fontWidth = handleCustomLabelOffset(unit, `${unitFont.italic ? "italic" : "normal"} ${unitFont.size}px ${unitFont.family}`).width;

              let offset = (val_fontWidth - unit_fontWidth) * 0.55;
              let labelX;
              let labelY;
              // 隐藏零值
              if (hideZeroValue && Number(textVal) == 0) {
                textVal = ""
                unit = ""
              }
              if (this.transposed) {
                // 转置时的图形文本位置
                if (prevSum >= 0) {
                  labelX = labelPosition === "inside" ? stackStart[0] - size[0] / 2 + 1 + offset + shapeBarSpac * index : stackStart[0] + 1 + offset + labelShapeSpacing + shapeBarSpac * index;
                } else {
                  labelX = labelPosition === "inside" ? stackStart[0] - size[0] / 2 + 1 + offset + shapeBarSpac * index : stackStart[0] - size[0] - 1 + offset - labelShapeSpacing + shapeBarSpac * index;
                }
                labelY = start[1] + 1 - this.getOption<number>("label-vertical-offset");
              } else {
                labelX = start[0] - 2 + offset;
                if (prevSum >= 0) {
                  labelY = labelPosition === "inside" ? stackStart[1] + size[1] / 2 - shapeBarSpac * index : stackStart[1] - labelShapeSpacing - shapeBarSpac * index;
                } else {
                  labelY = labelPosition === "inside" ? stackStart[1] + size[1] / 2 - shapeBarSpac * index : stackStart[1] + size[1] + labelShapeSpacing - shapeBarSpac * index;
                }
              }
              if (showLabel) {
                const textColor = labelColorFollow ? getSingleColor(color) : labelFont.color || "#ffffff";
                let textHighlightColor = highlight ? this.toEchartsColor(this.getOption(["series-hight-color-cluster", hightLightIndexes[index], "highlight-font-color"])) as Color : textColor;
                let textSize = highlight ? this.getOption<number>(["series-hight-color-cluster", hightLightIndexes[index], "highlight-font-size"]) : labelFont.size;
                rectGroup.push({ // 图形文本
                  type: 'text',
                  style: {
                    text: this.transposed ? yLabel ? xName[params.dataIndex]+"-"+textVal : textVal : xLabel ? xName[params.dataIndex]+"-"+textVal : textVal,
                    fill: textColor,
                    x: labelX + labelOffset[0],
                    y: labelY + labelOffset[1],
                    textAlign: 'right',
                    textVerticalAlign: 'middle',
                    font: `${labelFont.italic ? "italic" : ""}  ${labelFont.bold ? "bolder" : ""} ${labelFont.size}px ${labelFont.family}`,
                    opacity: barShape === "bar" && showLabel ? 1 : 0,
                  },
                  select: {
                    style: {
                      fill: textHighlightColor,
                      font: `${labelFont.italic ? "italic" : ""} ${labelFont.bold ? "bolder" : ""} ${textSize}px ${labelFont.family}`,
                      textAlign: 'center',
                      x: textSize === labelFont.size && highlight ? labelX + labelOffset[0] : labelX + (textSize - labelFont.size) / 2 + labelOffset[0],
                    }
                  },
                  silent: true,
                  z2: 100,
                  // 加载动画
                  enterFrom: {
                    scaleY: 0,
                  },
                  originY: start[1] + size[1],
                  enterAnimation: {
                    duration: 1000,
                    easing: "quarticOut"
                  },
                })
              }

              if (unit) {
                let unitTextColor = highlight ? this.toEchartsColor(this.getOption(["series-hight-color-cluster", hightLightIndexes[index], "unit-highlight-font-color"])) as Color : unitFont.color || "#ffffff";
                let textSize = highlight ? this.getOption<number>(["series-hight-color-cluster", hightLightIndexes[index], "unit-highlight-font-size"]) : unitFont.size;
                rectGroup.push({ // 单位文本
                  type: 'text',
                  style: {
                    text: unit,
                    fill: unitTextColor,
                    x: labelX + labelOffset[0],
                    y: labelY + labelOffset[1],
                    textAlign: 'left',
                    textVerticalAlign: 'middle',
                    font: `${unitFont.italic ? "italic" : ""}  ${unitFont.bold ? "bolder" : ""} ${unitFont.size}px ${unitFont.family}`,
                    opacity: barShape === "bar" && showLabel ? 1 : 0,
                  },
                  select: {
                    style: {
                      fill: unitTextColor,
                      font: `${unitFont.italic ? "italic" : ""} ${labelFont.bold ? "bolder" : ""} ${textSize}px ${labelFont.family}`,
                      textAlign: 'center',
                    }
                  },
                  silent: true,
                  z2: 100,
                  // 加载动画
                  enterFrom: {
                    scaleY: 0,
                  },
                  originY: start[1] + size[1],
                  enterAnimation: {
                    duration: 1000,
                    easing: "quarticOut"
                  },
                })
              }
            }

            return {
              type: 'group',
              children: rectGroup
            };
          },
          yAxisIndex: this.echartsYAxisOption.findIndex(yAxis => yAxis.id === this.getSingleYAxisOption("y").id)
        }
        // 绘制背景 从最小值开始绘制
        barShapeBgOpt = {
          type: 'custom',
          name: name + "-bg",
          id: `${yUid}-burstRectBg-${index}`,
          encode,
          z: 1,
          silent: true,
          renderItem: (params, api) => {
            let stackStart;
            let { x, y } = getXAndYUIDs()
            let categoryIndex = api.value(this.transposed ? y : x);
            let yUid = this.transposed ? x : y;
            let yValue = api.value(this.percent ? yUid + '_percentValue' : yUid);
            if (isNaN(yValue)) return;
            // 根据数据获取坐标信息
            // 取坐标轴最大值
            let axisScale = this.transposed ? (this.echartsChart as any).getModel().getComponent('xAxis').axis.scale : (this.echartsChart as any).getModel().getComponent('yAxis').axis.scale;
            let max = axisScale._extent[1];
            let min = axisScale._extent[0];
            // 根据数据获取坐标信息
            let start = this.transposed ? api.coord([max, categoryIndex]) : api.coord([categoryIndex, max]);

            let barLayout = api.barLayout({
              barGap: this.stack ? '-100%' : currentBarGap,
              count: valueNum
            });

            let step = 0;
            if (shapeColumnWidth === "auto") {
              step = barLayout[index].offsetCenter;
              barWidth = barLayout[index].width;
            } else {
              if (lineNum % 2 === 0) { // 正中间没有柱子
                if (index < lineNum / 2) { // 左边的柱子
                  step = - shapeBarGap / 2 - Number(shapeColumnWidth) / 2 - (lineNum / 2 - index - 1) * (Number(shapeColumnWidth) + shapeBarGap);
                } else {
                  step = shapeBarGap / 2 + Number(shapeColumnWidth) / 2 + (index - lineNum / 2) * (Number(shapeColumnWidth) + shapeBarGap);
                }
              } else { // 正中间有柱子
                if (index < lineNum / 2 - 0.5) { // 左边
                  step = - Number(shapeColumnWidth) / 2 - (lineNum / 2 - index - 0.5) * shapeBarGap - (lineNum / 2 - index - 1) * Number(shapeColumnWidth);
                } else if (index + 0.5 === lineNum / 2) { // 中间
                  step = 0;
                } else {
                  step = Number(shapeColumnWidth) / 2 + (index - lineNum / 2 + 0.5) * shapeBarGap + (index - lineNum / 2) * Number(shapeColumnWidth);
                }
              }
            }

            // 各组间隔偏移
            if (!this.stack) {
              this.transposed ? start[1] += step : start[0] += step;
            } else {
              stackStart = this.transposed ? api.coord([min, categoryIndex]) : api.coord([categoryIndex, min]);
            }

            let height = this.transposed ? api.size([max, min])[0] : api.size([min, max])[1];
            return {
              type: "rect",
              shape: {
                x: !this.transposed ? start[0] - barWidth / 2 : stackStart[0] + shapeBarSpac * index,
                y: !this.transposed ? start[1] : start[1] - barWidth / 2,
                height: this.stack && !this.transposed ? stackStart[1] - shapeBarSpac * index - start[1] > 0 ? stackStart[1] - shapeBarSpac * index - start[1] : 0 : barWidth,
                width: !this.transposed ? barWidth : start[0] - stackStart[0] - shapeBarSpac * index > 0 ? start[0] - stackStart[0] - shapeBarSpac * index : 0,
                r: shapeBorderRadius <= 0 ? 0 : shapeBorderRadius,
                transposed: this.transposed
              },
              style: {
                fill: shapeBackground,
                lineWidth: shapeBorderWidth,
                stroke: this.toEchartsColor(this.getOption("shape-border-color")),
                opacity: barShape === "bar" ? 1 : 0,
              },
              originY: start[1] + height,
              enterFrom: {
                scaleX: this.transposed ? 0 : 1,
                scaleY: this.transposed ? 1 : 0,
              },
              enterAnimation: {
                duration: 1000,
                easing: "quarticOut"
              },
              transition: 'shape',
            };
          },
          markLine: this.markLineOption,
        }
        if (stackFlag && index == lineNum - 1) {  //堆叠或条形时渲染一次背景
          seriesOpt.push(barShapeBgOpt);
          stackFlag = false;
        }
        singleSeriesOpt["stack"] = "A";
        seriesOpt.push(singleSeriesOpt);
      } else { // 分组
        singleSeriesOpt = {
          name,
          id: `${yUid}-bar-${index}`,
          type: "bar",
          barGap: currentBarGap,
          barWidth: shapeColumnWidth,
          showBackground: (!this.stack || notStackFlag) ? true : false,
          select: {
            disabled: !this.getOption("highlight"),
            label: {
              fontSize: this.getOption(["series-hight-color-cluster", hightLightIndexes[index], "highlight-font-size"]),
              color: this.getSeriesHightFontColors()[index],
              rich: {
                value: {
                  color: this.toEchartsColor(this.getOption(["series-hight-color-cluster", hightLightIndexes[index], "highlight-font-color"])),
                  fontSize: this.getOption(["series-hight-color-cluster", hightLightIndexes[index], "highlight-font-size"]),
                },
                unit:{
                  color: this.toEchartsColor(this.getOption(["series-hight-color-cluster", hightLightIndexes[index], "unit-highlight-font-color"])),
                  fontSize: this.getOption(["series-hight-color-cluster", hightLightIndexes[index], "unit-highlight-font-size"]),
                }
              }
            },
            itemStyle: {
              color: this.getSeriesHightColors()[index],
              borderWidth: this.getOption(["series-hight-color-cluster", hightLightIndexes[index], "highlight-border-width"]),
              borderColor: this.getSeriesHightBorderColors()[index]
            },
          },
          silent: barShape !== 'bar' ? true : false,
          selectedMode: "single",
          symbolSize: this.transposed ? [barShapeBurstNumber, "100%"] : ["100%", barShapeBurstNumber],
          backgroundStyle: {
            color: shapeBackground,
            borderWidth: shapeBorderWidth,
            borderColor: this.toEchartsColor(this.getOption("shape-border-color")),
            borderRadius: fillBorderRadius,
            opacity: barShape !== 'bar' ? 0 : 1,
          },
          label: {
            show: this.getOption("label"),
            position: labelPosition,
            distance: labelShapeSpacing,
            offset:[0,-this.getOption<number>("label-vertical-offset")],
            formatter: (param) => {
              let unit = this.getOption<string>("label-unit-value");
              let val = param.value[param.dimensionNames[param.encode.y[0]]];
              if (this.transposed) {
                val = param.value[param.dimensionNames[param.encode.x[0]]];
              }
              if (!isPercent) {
                val = formatFloat(val, labelDecimalPlaces, isComplete);
              } else {
                val = formatFloat(val * 100, labelDecimalPlaces, isComplete);
                unit = unit || "%";
              }
              if (this.getOption("hide-zero-value") && Number(val) == 0) {
                return ""
              }
              if(this.transposed){
                return yLabel ? `{value|${param.name}}{value|-}{value|${val}}{unit|${unit}}` : `{value|${val}}{unit|${unit}}`;
              }else{
                return xLabel ? `{value|${param.name}}{value|-}{value|${val}}{unit|${unit}}` : `{value|${val}}{unit|${unit}}`;
              }
            },
            rich: {
              value: {
                color: colorFollow ? seriesColor[index][0] : this.toEchartsColor(labelFont.color as Color) || "#ffffff",
                fontWeight: labelFont.bold ? "bold" : "normal",
                fontStyle: labelFont.italic ? "italic" : "normal",
                fontSize: labelFont.size,
                fontFamily: labelFont.family,
                align:"center",
                verticalAlign:"middle"
              },
              unit: {
                color: unitFont.color || "#ffffff",
                fontWeight: unitFont.bold ? "bold" : "normal",
                fontStyle: unitFont.italic ? "italic" : "normal",
                fontSize: unitFont.size,
                fontFamily: unitFont.family,
              }
            }
          },
          itemStyle: {
            opacity: barShape !== 'bar' ? 0 : 1,
            color: (params) => {
              let color;
              let dataIndex;
              if (hasGroup) {
                dataIndex = this.transposed ? this.dataLength - 1 - params.dataIndex % this?.dataLength : params.dataIndex;
              } else {
                dataIndex = this.transposed ? this.dataLength - 1 - params.dataIndex : params.dataIndex;
              }
              if (this.usePrivateData) {
                color = "#1890FFFF"
              } else {
                if (this.transposed && hasGroup){
                  color = (dataIndex >= seriesColor[seriesColor.length - 1 - index]?.length - 1) ? seriesColor[seriesColor.length - 1 - index][seriesColor[seriesColor.length - 1 - index]?.length - 1] : seriesColor[seriesColor.length -1 - index]?.[dataIndex] || "#1890FFFF";
                } else {
                  color = (dataIndex >= seriesColor[index]?.length - 1) ? seriesColor[index][seriesColor[index]?.length - 1] : seriesColor[index]?.[dataIndex] || "#1890FFFF";
                }
              }
              let conditionSetting = this.getOption(['series-color-cluster', colorIndexes[params.seriesIndex], "condition-setting"])
              if (conditionSetting) {
                let path = ['series-color-cluster', colorIndexes[params.seriesIndex]]
                let indexes = this.getOption([...path, "single-settings-condition-cluster"])?.["indexes"] || [];
                for (const clusterIndex of indexes) {
                  let selectConditionWay = this.getOption<string>([...path, 'single-settings-condition-cluster', clusterIndex, "select-condition-way"])
                  if (selectConditionWay == 'new-built-condition') {
                    let [conditionFieldUid, fn] = this.getOption<string>([...path, 'single-settings-condition-cluster', clusterIndex, "condition-field"]);
                    let fieldValue = this.getOption<string>([...path, 'single-settings-condition-cluster', clusterIndex, "field-value"]);
                    if (!this.conditionOperate(params.value[conditionFieldUid], fn, fieldValue, conditionFieldUid)) continue;
                    color = this.toEchartsColor(new Color(this.getOption<Color>([...path, 'single-settings-condition-cluster', clusterIndex, 'condition-color'])));
                  } else {
                    const selectCondition: any = this.getOption<string>([...path, 'single-settings-condition-cluster', clusterIndex, "select-condition"]);
                    // 没有选择数据条件的 pass 掉
                    if (!selectCondition) continue;
                    // 先看条数是否满足
                    let conditions = this.getBoard().getDataConditions() || [];
                    let condition = conditions.find(item => item.uid === selectCondition);
                    const isExistence = this.checkDataConditions([condition], this.dataSortMap.get(dataIndex));
                    if (!isExistence) continue;
                    color = this.toEchartsColor(new Color(this.getOption<Color>([...path, 'single-settings-condition-cluster', clusterIndex, 'condition-color'])));
                  }
                }
              }
              return color
            },
            // borderWidth: shapeBorderWidth,
            // borderColor: this.toEchartsColor(this.getOption("shape-border-color")),
            borderWidth: shapeDataBorderWidth,
            borderColor: borderColor,// this.toEchartsColor(this.getOption("shapeData-border-color")),
            borderRadius: shapeBorderRadius <= 0 ? 0 : shapeBorderRadius
          },
          markLine: this.markLineOption,
          encode,
          yAxisIndex: this.echartsYAxisOption.findIndex(yAxis => yAxis.id === this.getSingleYAxisOption("y").id),
          emphasis: {
            label: {
              show: this.getOption("label")
            }
          },
          labelLayout: ()=>{}
        }
        if (labelPosition === "top-align") {
          singleSeriesOpt["labelLayout"] = (params) => {
            let max = this.transposed ? (this.echartsChart as any).getModel().getComponent('xAxis').axis._extent[1] : (this.echartsChart as any).getModel().getComponent('yAxis').axis._extent[1];
            if (this.transposed) {
              return {
                x: params.rect.x + max + labelShapeSpacing,
                y: params.rect.y + params.rect.height / 2 - this.getOption<number>("label-vertical-offset"),
                verticalAlign: 'middle',
                align: 'left'
              }
            } else {
              return {
                y: (params.rect.height + params.rect.y) - max - labelShapeSpacing,
                x: params.rect.x + params.rect.width / 2,
                verticalAlign: 'bottom',
                align: 'center'
              }
            }
          }
        }
        seriesOpt.push(singleSeriesOpt);
      }

      // singleSeriesOpt["stack"] = "A";
      notStackFlag = false;
      // 填充形状不为普通的时
      if (barShape !== 'bar') {
        let valueNum = lineNum;
        let rectNum = barShapeBurstNumber;
        let barShapeOpt;
        let barShapeBgOpt;
        let barWidth: number = this.getOption('shape-column-width');
        let showLabel = this.getOption("label");
        // 颜色组设置
        let color:any = "#1890FFFF";
        let colorArr = seriesColor[index];
        // 加载动画属性设置
        if (barShape === 'rect') { // 分片
          // barWidth = barWidth / 2;
          let r = fillBorderRadius;
          // 填充形状为分片时
          barShapeOpt = {
            type: 'custom',
            name: name + "__$" + index,
            encode,
            id: `${yUid}-burstRect-${index}`, // 分片
            selectedMode: 'single',
            z: 3,
            clip:false,
            yAxisIndex: this.echartsYAxisOption.findIndex(yAxis => yAxis.id === this.getSingleYAxisOption("y").id),
            labelLayout(params) {
              return {
                x: params.rect.x + 10,
                y: params.rect.y + params.rect.height / 2,
                verticalAlign: 'middle',
                align: 'left'
              }
            },
            renderItem: (params, api) => {
              let { x, y } = getXAndYUIDs()
              let categoryIndex = api.value(this.transposed ? y : x);
              let yUid = this.transposed ? x : y;
              let yValue = api.value(this.percent ? yUid + '_percentValue' : yUid);
              if (isNaN(yValue)) return;
              // 根据数据获取坐标信息
              let size = this.transposed ? api.size([yValue, categoryIndex]) : api.size([categoryIndex, yValue]);
              let start = this.transposed ? api.coord([yValue, categoryIndex]) : api.coord([categoryIndex, yValue]);
              let barLayout = api.barLayout({
                barGap: this.stack ? '-100%' : currentBarGap,
                count: valueNum
              });
              // 颜色组取值
              color = params.dataIndex >= colorArr.length ? colorArr[colorArr.length - 1] : colorArr[params.dataIndex];
              let hightLightColor = this.getOption("highlight") ? this.getSeriesHightColors()[index] : color;
              let step = 0;
              if (shapeColumnWidth === "auto") {
                step = barLayout[index].offsetCenter;
                barWidth = barLayout[index].width;
              } else {
                if (lineNum % 2 === 0) { // 正中间没有柱子
                  if (index < lineNum / 2) { // 左边的柱子
                    step = - shapeBarGap / 2 - Number(shapeColumnWidth) / 2 - (lineNum / 2 - index - 1) * (Number(shapeColumnWidth) + shapeBarGap);
                  } else {
                    step = shapeBarGap / 2 + Number(shapeColumnWidth) / 2 + (index - lineNum / 2) * (Number(shapeColumnWidth) + shapeBarGap);
                  }
                } else { // 正中间有柱子
                  if (index < lineNum / 2 - 0.5) { // 左边
                    step = - Number(shapeColumnWidth) / 2 - (lineNum / 2 - index - 0.5) * shapeBarGap - (lineNum / 2 - index - 1) * Number(shapeColumnWidth);
                  } else if (index + 0.5 === lineNum / 2) { // 中间
                    step = 0;
                  } else {
                    step = Number(shapeColumnWidth) / 2 + (index - lineNum / 2 + 0.5) * shapeBarGap + (index - lineNum / 2) * Number(shapeColumnWidth);
                  }
                }
              }

              // 各组间隔偏移
              if (!this.stack) {
                this.transposed ? start[1] += step : start[0] += step;
              }

              // 取坐标轴最大值
              let max = this.transposed ? (this.echartsChart as any).getModel().getComponent('xAxis').axis.scale._extent[1] : (this.echartsChart as any).getModel().getComponent('yAxis').axis.scale._extent[1];
              let min = this.transposed ? (this.echartsChart as any).getModel().getComponent('xAxis').axis.scale._extent[0] : (this.echartsChart as any).getModel().getComponent('yAxis').axis.scale._extent[0];
              let height = this.transposed ? api.size([max, 0])[0] : api.size([0, max])[1];

              let maxStart = this.transposed ? api.coord([max, categoryIndex]) : api.coord([categoryIndex, max]);
              let rectGroup = [];
              let unitHeight = height / rectNum;  //各个分片高度
              let dataIndex = this.transposed ? this.dataLength - 1 - params.dataIndex : params.dataIndex;

              let scaleOffset = this.transposed?api.coord([min,categoryIndex])[0] - (maxStart[0] - height) : maxStart[1]+height - api.coord([categoryIndex, min])[1];

              // 数据条件颜色
              let conditionSetting = this.getOption(['series-color-cluster', colorIndexes[index], "condition-setting"])
              if (conditionSetting) {
                let path = ['series-color-cluster', colorIndexes[index]]
                let indexes = this.getOption([...path, "single-settings-condition-cluster"])?.["indexes"] || [];
                for (const clusterIndex of indexes) {
                  let selectConditionWay = this.getOption<string>([...path, 'single-settings-condition-cluster', clusterIndex, "select-condition-way"])
                  if (selectConditionWay == 'new-built-condition') {
                    let [conditionFieldUid, fn] = this.getOption<string>([...path, 'single-settings-condition-cluster', clusterIndex, "condition-field"]);
                    let fieldValue = this.getOption<string>([...path, 'single-settings-condition-cluster', clusterIndex, "field-value"]);
                    let value = this.datasetSource()[dataIndex][conditionFieldUid]
                    if (!this.conditionOperate(value, fn, fieldValue, conditionFieldUid)) continue;
                    color = this.toEchartsColor(new Color(this.getOption<Color>([...path, 'single-settings-condition-cluster', clusterIndex, 'condition-color'])));
                  } else {
                    const selectCondition: any = this.getOption<string>([...path, 'single-settings-condition-cluster', clusterIndex, "select-condition"]);
                    // 没有选择数据条件的 pass 掉
                    if (!selectCondition) continue;
                    // 先看条数是否满足
                    let conditions = this.getBoard().getDataConditions() || [];
                    let condition = conditions.find(item => item.uid === selectCondition);

                    const isExistence = this.checkDataConditions([condition], this.dataSortMap.get(dataIndex));
                    if (!isExistence) continue;
                    color = this.toEchartsColor(new Color(this.getOption<Color>([...path, 'single-settings-condition-cluster', clusterIndex, 'condition-color'])));
                  }
                }
              }
              if (this.stack) {
                let prevSum = 0;
                if (hasGroup) {
                  let xValue = api.value(xDims[0].uid[2]);
                  for (let i = 0; i <= params.dataIndex; i++) {
                    if (api.value(xDims[0].uid[2], i) === xValue) {
                      prevSum += api.value(yDims[0].uid[2], i);
                    }
                  }
                } else {
                  for (let i = 0; i <= index; i++) {
                    // 如果开了图例并且对应图例没有处在选中状态，需要在计算时去掉对应柱子的数据
                    let yAlias = this.getFieldAlias(yDims[i].uid);
                    if (!isLegendSelect(yAlias)) continue;
                    let yUid = yDims[i].uid[2];
                    prevSum += api.value(this.percent ? yUid + '_percentValue' : yUid)
                  }
                }
                let stackStart = this.transposed ? api.coord([prevSum, categoryIndex]) : api.coord([categoryIndex, prevSum]);
                let stackSize = this.transposed ? api.size([prevSum, categoryIndex]) : api.size([categoryIndex, prevSum]);
                // 堆叠绘制分片
                rectGroup.push({
                  type: "burstColumn",
                  shape: {
                    burstNum: barShapeBurstNumber,
                    barWidth: barWidth,
                    barHeight: this.transposed ? size[0] : size[1],
                    x: !this.transposed ? stackStart[0] : stackStart[0] + shapeBarSpac * index,
                    y: !this.transposed ? stackStart[1] - shapeBarSpac * index : stackStart[1],
                    maxStartX: maxStart[0],
                    maxStartY: maxStart[1],
                    maxHeight: this.transposed ? height - scaleOffset : height - scaleOffset,
                    transposed: this.transposed
                  },
                  originY: start[1] + (this.transposed ? size[0] : size[1]),
                  style: {
                    fill: color,
                    lineWidth: shapeDataBorderWidth,
                    stroke: borderFollowShape ? color : borderColor, // this.toEchartsColor(this.getOption("shapeData-border-color"))
                    // lineWidth: shapeBorderWidth,
                    // stroke:this.toEchartsColor(this.getOption("shape-border-color"))
                  },
                  select: {
                    style: {
                      fill: hightLightColor
                    }
                  },
                  emphasisDisabled: !this.getOption("highlight"),
                  enterFrom: {
                    scaleX: this.transposed ? 0 : 1,
                    scaleY: this.transposed ? 1 : 0,
                  },
                  enterAnimation: {
                    duration: 1000,
                    easing: "quarticOut"
                  },
                  transition: 'shape'
                })

                // 计算label的值
                let textVal = handleCustomLabel(yValue).value;
                let unit = handleCustomLabel(yValue).unit
                // 计算lable偏移自动使其居中
                let val_fontWidth;
                if(this.transposed){
                  val_fontWidth = yLabel ? handleCustomLabelOffset(xName[params.dataIndex]+"-"+textVal, `${labelFont.italic ? "italic" : "normal"} ${labelFont.size}px ${labelFont.family}`).width : handleCustomLabelOffset(textVal, `${labelFont.italic ? "italic" : "normal"} ${labelFont.size}px ${labelFont.family}`).width;
                }else{
                  val_fontWidth = xLabel ? handleCustomLabelOffset(xName[params.dataIndex]+"-"+textVal, `${labelFont.italic ? "italic" : "normal"} ${labelFont.size}px ${labelFont.family}`).width : handleCustomLabelOffset(textVal, `${labelFont.italic ? "italic" : "normal"} ${labelFont.size}px ${labelFont.family}`).width;
                }
                let unit_fontWidth = handleCustomLabelOffset(unit, `${unitFont.italic ? "italic" : "normal"} ${unitFont.size}px ${unitFont.family}`).width;
                let offset = (val_fontWidth - unit_fontWidth) * 0.55;
                let labelX;
                let labelY;
                // 隐藏零值
                if (this.getOption("hide-zero-value") && Number(textVal) == 0) {
                  textVal = ""
                  unit = ""
                }
                if (this.transposed) {
                  // 转置时的图形文本位置
                  labelX = labelPosition === "inside" ? stackStart[0] - size[0] / 2 + 1 + offset + shapeBarSpac * index : stackStart[0] + 1 + offset + labelShapeSpacing + shapeBarSpac * index;
                  labelY = start[1] + 1 - this.getOption<number>("label-vertical-offset");;
                } else {
                  labelX = start[0] - 2 + offset;
                  labelY = labelPosition === "inside" ? stackStart[1] + size[1] / 2 - shapeBarSpac * index : stackStart[1] - labelShapeSpacing - shapeBarSpac * index;
                }
                // 添加label

                const textColor = labelColorFollow ? getSingleColor(color) : labelFont.color || "#ffffff";
                rectGroup.push( // 图形文本
                  {
                    type: 'text',
                    style: {
                      text: this.transposed ? yLabel ? xName[params.dataIndex]+"-"+textVal : textVal : xLabel ? xName[params.dataIndex]+"-"+textVal : textVal,
                      fill: textColor,
                      x: labelX,
                      y: labelY,
                      textAlign: 'right',
                      textVerticalAlign: 'middle',
                      font: `${labelFont.italic ? "italic" : ""}  ${labelFont.bold ? "bolder" : ""} ${labelFont.size}px ${labelFont.family}`,
                      opacity: showLabel ? 1 : 0,
                    },
                    silent: true,
                    z2: 100,
                    // 加载动画
                    enterFrom: {
                      scaleY: 0,
                    },
                    originY: start[1] + size[1],
                    enterAnimation: {
                      duration: 1000,
                      easing: "quarticOut"
                    },
                  },
                  // 单位文本
                  {
                    type: 'text',
                    style: {
                      text: unit,
                      fill: unitFont.color,
                      x: labelX,
                      y: labelY,
                      textAlign: 'left',
                      textVerticalAlign: 'middle',
                      font: `${unitFont.italic ? "italic" : ""}  ${unitFont.bold ? "bolder" : ""} ${unitFont.size}px ${unitFont.family}`,
                      opacity: showLabel ? 1 : 0,
                    },
                    silent: true,
                    z2: 100,
                    // 加载动画
                    enterFrom: {
                      scaleY: 0,
                    },
                    originY: start[1] + size[1],
                    enterAnimation: {
                      duration: 1000,
                      easing: "quarticOut"
                    },
                  })
                return {
                  type: 'group',
                  children: rectGroup
                };
              } else {
                rectGroup.push({
                  type: "burstColumn",
                  shape: {
                    burstNum: barShapeBurstNumber,
                    barWidth: barWidth,
                    barHeight: this.transposed ? size[0] : size[1],
                    x: start[0],
                    y: this.useInverse('y') ? height - scaleOffset + maxStart[1] : start[1],
                    maxStartX: maxStart[0],
                    maxStartY: maxStart[1],
                    maxHeight: this.transposed ? height - scaleOffset : height - scaleOffset,
                    transposed: this.transposed
                  },
                  originY: this.useInverse('y') ? height - scaleOffset + maxStart[1] : start[1],

                  style: {
                    fill: color,
                    lineWidth: shapeDataBorderWidth,
                    stroke: borderFollowShape ? color : borderColor,// this.toEchartsColor(this.getOption("shapeData-border-color"))
                    // lineWidth: shapeBorderWidth,
                    // stroke:this.toEchartsColor(this.getOption("shape-border-color"))
                  },
                  select: {
                    style: {
                      fill: hightLightColor,
                    }
                  },
                  emphasisDisabled: true,
                  enterFrom: {
                    scaleX: this.transposed ? 0 : 1,
                    scaleY: this.transposed ? 1 : 0,
                  },
                  enterAnimation: {
                    duration: 1000,
                    easing: "quarticOut"
                  },
                  transition: 'shape'
                })

                // 计算label的值
                let textVal = handleCustomLabel(yValue).value;
                let unit = handleCustomLabel(yValue).unit
                // 计算lable偏移自动使其居中
                let val_fontWidth;
                if(this.transposed){
                  val_fontWidth = yLabel ? handleCustomLabelOffset(xName[params.dataIndex]+"-"+textVal, `${labelFont.italic ? "italic" : "normal"} ${labelFont.size}px ${labelFont.family}`).width : handleCustomLabelOffset(textVal, `${labelFont.italic ? "italic" : "normal"} ${labelFont.size}px ${labelFont.family}`).width;
                }else{
                  val_fontWidth = xLabel ? handleCustomLabelOffset(xName[params.dataIndex]+"-"+textVal, `${labelFont.italic ? "italic" : "normal"} ${labelFont.size}px ${labelFont.family}`).width : handleCustomLabelOffset(textVal, `${labelFont.italic ? "italic" : "normal"} ${labelFont.size}px ${labelFont.family}`).width;
                }
                let unit_fontWidth = handleCustomLabelOffset(unit, `${unitFont.italic ? "italic" : "normal"} ${unitFont.size}px ${unitFont.family}`).width;
                let offset = (val_fontWidth - unit_fontWidth) * 0.55;

                let labelX;
                let labelY;
                let max = this.transposed ? (this.echartsChart as any).getModel().getComponent('xAxis').axis._extent[1] : (this.echartsChart as any).getModel().getComponent('yAxis').axis._extent[1];
                if (this.transposed) {
                  // 转置时的图形文本位置
                  labelX = labelPosition === "inside" ? start[0] - size[0]/2 + 1 + offset : start[0] + 1 + offset + labelShapeSpacing;
                  if (labelPosition === "top-align") {
                    labelX = max + (start[0] - size[0]) + offset + labelShapeSpacing + scaleOffset;
                  }
                  labelY = start[1] + 1 - this.getOption<number>("label-vertical-offset");
                } else {
                  labelX = start[0] - 2 + offset;
                  labelY = labelPosition === "inside" ? start[1] + size[1] / 2 : start[1] - labelShapeSpacing;
                  if (labelPosition === "top-align") {
                    labelY = (size[1] + start[1]) - max - labelShapeSpacing - scaleOffset;
                  }
                }
                const textColor = labelColorFollow ? getSingleColor(color) : labelFont.color || "#ffffff";
                let textHighlightColor = highlight ? this.toEchartsColor(this.getOption(["series-hight-color-cluster", hightLightIndexes[index], "highlight-font-color"])) : textColor;
                let textSize:number = highlight ? this.getOption<number>(["series-hight-color-cluster", hightLightIndexes[index], "highlight-font-size"]) : labelFont.size;
                let unitTextColor = highlight ? this.toEchartsColor(this.getOption(["series-hight-color-cluster", hightLightIndexes[index], "unit-highlight-font-color"])) as Color : unitFont.color || "#ffffff";
                let unitextSize = highlight ? this.getOption<number>(["series-hight-color-cluster", hightLightIndexes[index], "unit-highlight-font-size"]) : unitFont.size;
                // 添加label
                rectGroup.push( // 图形文本
                  {
                    type: 'text',
                    style: {
                      text: this.transposed ? yLabel ? xName[params.dataIndex]+"-"+textVal : textVal : xLabel ? xName[params.dataIndex]+"-"+textVal : textVal,
                      fill: textColor,
                      x: labelX,
                      y: labelY,
                      textAlign: 'right',
                      textVerticalAlign: 'middle',
                      font: `${labelFont.italic ? "italic" : ""}  ${labelFont.bold ? "bolder" : ""} ${labelFont.size}px ${labelFont.family}`,
                      opacity: showLabel ? 1 : 0,
                    },
                    select: {
                      style: {
                        fill: textHighlightColor,
                        font: `${labelFont.italic ? "italic" : ""}  ${labelFont.bold ? "bolder" : ""} ${textSize}px ${labelFont.family}`,
                        x: highlight && labelFont.size !== textSize ? labelX + (textSize - labelFont.size) / 2 : labelX
                      }
                    },
                    silent: true,
                    z2: 99,
                    // 加载动画
                    enterFrom: {
                      scaleY: 0,
                    },
                    originY: start[1] + size[1],
                    enterAnimation: {
                      duration: 1000,
                      easing: "quarticOut"
                    },
                  },
                  // 单位文本
                  {
                    type: 'text',
                    style: {
                      text: unit,
                      fill: unitFont.color,
                      x: labelX,
                      y: labelY,
                      textAlign: 'left',
                      textVerticalAlign: 'middle',
                      font: `${unitFont.italic ? "italic" : ""}  ${unitFont.bold ? "bolder" : ""} ${unitFont.size}px ${unitFont.family}`,
                      opacity: showLabel ? 1 : 0,
                    },
                    select: {
                      style: {
                        fill: unitTextColor,
                        font: `${unitFont.italic ? "italic" : ""}  ${unitFont.bold ? "bolder" : ""} ${unitextSize}px ${unitFont.family}`,
                      }
                    },
                    silent: true,
                    z2: 99,
                    // 加载动画
                    enterFrom: {
                      scaleY: 0,
                    },
                    originY: start[1] + size[1],
                    enterAnimation: {
                      duration: 1000,
                      easing: "quarticOut"
                    },
                  })
                return {
                  type: 'group',
                  children: rectGroup
                };
              }
            }
          }
          // 绘制分片背景
          barShapeBgOpt = {
            type: 'custom',
            name: name + "-bg",
            id: `${yUid}-burstRectBg-${index}`,
            encode,
            z: 1,
            silent: true,
            renderItem: (params, api) => {
              let stackStart;
              let { x, y } = getXAndYUIDs()
              let categoryIndex = api.value(this.transposed ? y : x);
              let yUid = this.transposed ? x : y;
              let yValue = api.value(this.percent ? yUid + '_percentValue' : yUid);
              if (isNaN(yValue)) return;
              // 根据数据获取坐标信息
              // 取坐标轴最大值
              let axisScale = this.transposed ? (this.echartsChart as any).getModel().getComponent('xAxis').axis.scale : (this.echartsChart as any).getModel().getComponent('yAxis').axis.scale;
              let max = axisScale._extent[1];
              let min = axisScale._extent[0];
              // 根据数据获取坐标信息
              let start = this.transposed ? api.coord([max, categoryIndex]) : api.coord([categoryIndex, max]);

              let barLayout = api.barLayout({
                barGap: this.stack ? '-100%' : currentBarGap,
                count: valueNum
              });

              let step = 0;
              if (shapeColumnWidth === "auto") {
                step = barLayout[index].offsetCenter;
                barWidth = barLayout[index].width;
              } else {
                if (lineNum % 2 === 0) { // 正中间没有柱子
                  if (index < lineNum / 2) { // 左边的柱子
                    step = - shapeBarGap / 2 - Number(shapeColumnWidth) / 2 - (lineNum / 2 - index - 1) * (Number(shapeColumnWidth) + shapeBarGap);
                  } else {
                    step = shapeBarGap / 2 + Number(shapeColumnWidth) / 2 + (index - lineNum / 2) * (Number(shapeColumnWidth) + shapeBarGap);
                  }
                } else { // 正中间有柱子
                  if (index < lineNum / 2 - 0.5) { // 左边
                    step = - Number(shapeColumnWidth) / 2 - (lineNum / 2 - index - 0.5) * shapeBarGap - (lineNum / 2 - index - 1) * Number(shapeColumnWidth);
                  } else if (index + 0.5 === lineNum / 2) { // 中间
                    step = 0;
                  } else {
                    step = Number(shapeColumnWidth) / 2 + (index - lineNum / 2 + 0.5) * shapeBarGap + (index - lineNum / 2) * Number(shapeColumnWidth);
                  }
                }
              }

              // 各组间隔偏移
              if (!this.stack) {
                this.transposed ? start[1] += step : start[0] += step;
              } else {
                stackStart = this.transposed ? api.coord([min, categoryIndex]) : api.coord([categoryIndex, min]);
              }

              let height = this.transposed ? api.size([max, 0])[0] : api.size([0, max])[1];

              if (this.stack) {
                return {
                  type: "burstColumn",
                  shape: {
                    burstNum: barShapeBurstNumber,
                    barWidth: barWidth,
                    barHeight: this.stack && !this.transposed ? stackStart?.[1] - shapeBarSpac * index - start[1] : start[0] - stackStart[0] - shapeBarSpac * index,
                    x: start[0],
                    y: start[1],
                    maxStartX: start[0],
                    maxStartY: start[1],
                    maxHeight: height,
                    transposed: this.transposed
                  },
                  style: {
                    fill: shapeBackground,
                    lineWidth: shapeBorderWidth,
                    stroke: this.toEchartsColor(this.getOption("shape-border-color"))
                  },
                  originY: start[1] + height,
                  enterFrom: {
                    scaleX: this.transposed ? 0 : 1,
                    scaleY: this.transposed ? 1 : 0,
                  },
                  enterAnimation: {
                    duration: 1000,
                    easing: "quarticOut"
                  },
                  transition: 'shape',
                };
              } else {
                return {
                  type: "burstColumn",
                  shape: {
                    burstNum: barShapeBurstNumber,
                    barWidth: barWidth,
                    barHeight: height,

                    x: start[0],
                    y: start[1],
                    maxStartX: start[0],
                    maxStartY: start[1],
                    maxHeight: height,
                    transposed: this.transposed
                  },
                  style: {
                    fill: shapeBackground,
                    lineWidth: shapeBorderWidth,
                    stroke: this.toEchartsColor(this.getOption("shape-border-color"))
                  },
                  originY: start[1] + height,
                  enterFrom: {
                    scaleX: this.transposed ? 0 : 1,
                    scaleY: this.transposed ? 1 : 0,
                  },
                  enterAnimation: {
                    duration: 1000,
                    easing: "quarticOut"
                  },
                  transition: 'shape',
                }
              }

            }
          }
          if (this.stack) {
            barShapeOpt["stack"] = "A"
          }
        } else {
          let shape = barShape == "triangle" ? 'triangleColumn' : 'invertedTriangleColumn';
          // 填充形状为三角形时
          barShapeOpt = {
            type: 'custom',
            name: name + "__$" + index,
            encode,
            id: `${yUid}-triangle-${index}`,
            selectedMode: 'single',
            z: 3,
            yAxisIndex: this.echartsYAxisOption.findIndex(yAxis => yAxis.id === this.getSingleYAxisOption("y").id),
            renderItem: (params, api) => {
              let { x, y } = getXAndYUIDs()
              let categoryIndex = api.value(this.transposed ? y : x);
              let yUid = this.transposed ? x : y;
              let yValue = api.value(yUid);
              if (isNaN(yValue)) return;
              // 颜色组取值
              color = params.dataIndex >= colorArr.length ? colorArr[colorArr.length - 1] : colorArr[params.dataIndex];
              let hightLightColor = this.getOption("highlight") ? this.getSeriesHightColors()[index] : color;
              // 根据数据获取坐标信息
              let size = this.transposed ? api.size([yValue, categoryIndex]) : api.size([categoryIndex, yValue]);
              let start = this.transposed ? api.coord([yValue, categoryIndex]) : api.coord([categoryIndex, yValue]);

              let barLayout = api.barLayout({
                barGap: this.stack ? '-100%' : currentBarGap,
                count: valueNum
              });

              let step = 0;
              if (shapeColumnWidth === "auto") {
                step = barLayout[index].offsetCenter;
              } else {
                if (lineNum % 2 === 0) { // 正中间没有柱子
                  if (index < lineNum / 2) { // 左边的柱子
                    step = - shapeBarGap / 2 - Number(shapeColumnWidth) / 2 - (lineNum / 2 - index - 1) * (Number(shapeColumnWidth) + shapeBarGap);
                  } else {
                    step = shapeBarGap / 2 + Number(shapeColumnWidth) / 2 + (index - lineNum / 2) * (Number(shapeColumnWidth) + shapeBarGap);
                  }
                } else { // 正中间有柱子
                  if (index < lineNum / 2 - 0.5) { // 左边
                    step = - Number(shapeColumnWidth) / 2 - (lineNum / 2 - index - 0.5) * shapeBarGap - (lineNum / 2 - index - 1) * Number(shapeColumnWidth);
                  } else if (index + 0.5 === lineNum / 2) { // 中间
                    step = 0;
                  } else {
                    step = Number(shapeColumnWidth) / 2 + (index - lineNum / 2 + 0.5) * shapeBarGap + (index - lineNum / 2) * Number(shapeColumnWidth);
                  }
                }
              }

              // 各组间隔偏移
              this.transposed ? start[1] += step : start[0] += step;

              // 数据条件颜色
              let conditionSetting = this.getOption(['series-color-cluster', colorIndexes[index], "condition-setting"])
              if (conditionSetting) {
                let dataIndex = this.transposed ? this.dataLength - 1 - params.dataIndex : params.dataIndex;
                let path = ['series-color-cluster', colorIndexes[index]]
                let indexes = this.getOption([...path, "single-settings-condition-cluster"])?.["indexes"] || [];
                for (const clusterIndex of indexes) {
                  let selectConditionWay = this.getOption<string>([...path, 'single-settings-condition-cluster', clusterIndex, "select-condition-way"])
                  if (selectConditionWay == 'new-built-condition') {
                    let [conditionFieldUid, fn]: any = this.getOption<string>([...path, 'single-settings-condition-cluster', clusterIndex, "condition-field"]);
                    let fieldValue = this.getOption<string>([...path, 'single-settings-condition-cluster', clusterIndex, "field-value"]);
                    let value = this.datasetSource()[dataIndex][conditionFieldUid]
                    if (!this.conditionOperate(value, fn, fieldValue, conditionFieldUid)) continue;
                    color = this.toEchartsColor(new Color(this.getOption<Color>([...path, 'single-settings-condition-cluster', clusterIndex, 'condition-color'])));
                  } else {
                    const selectCondition: any = this.getOption<string>([...path, 'single-settings-condition-cluster', clusterIndex, "select-condition"]);
                    // 没有选择数据条件的 pass 掉
                    if (!selectCondition) continue;
                    // 先看条数是否满足
                    let conditions = this.getBoard().getDataConditions() || [];
                    let condition = conditions.find(item => item.uid === selectCondition);
                    const isExistence = this.checkDataConditions([condition], this.dataSortMap.get(dataIndex));
                    if (!isExistence) continue;
                    color = this.toEchartsColor(new Color(this.getOption<Color>([...path, 'single-settings-condition-cluster', clusterIndex, 'condition-color'])));
                  }
                }
              }

              let max = this.transposed ? (this.echartsChart as any).getModel().getComponent('xAxis').axis._extent[1] : (this.echartsChart as any).getModel().getComponent('yAxis').axis._extent[1];
              let min = this.transposed ? (this.echartsChart as any).getModel().getComponent('xAxis').axis.scale._extent[0] : (this.echartsChart as any).getModel().getComponent('yAxis').axis.scale._extent[0];
              let maxStart = this.transposed ? api.coord([max, categoryIndex]) : api.coord([categoryIndex, max]);
              let height = this.transposed ? api.size([max, 0])[0] : api.size([0, max])[1];
              let scaleOffset = this.transposed?api.coord([min,categoryIndex])[0] - (maxStart[0] - height) : maxStart[1]+height - api.coord([categoryIndex, min])[1];
              // 计算label的值
              let textVal = handleCustomLabel(yValue).value;
              let unit = handleCustomLabel(yValue).unit
              // 计算lable偏移自动使其居中
              let val_fontWidth;
              if(this.transposed){
                val_fontWidth = yLabel ? handleCustomLabelOffset(xName[params.dataIndex]+"-"+textVal, `${labelFont.italic ? "italic" : "normal"} ${labelFont.size}px ${labelFont.family}`).width : handleCustomLabelOffset(textVal, `${labelFont.italic ? "italic" : "normal"} ${labelFont.size}px ${labelFont.family}`).width;
              }else{
                val_fontWidth = xLabel ? handleCustomLabelOffset(xName[params.dataIndex]+"-"+textVal, `${labelFont.italic ? "italic" : "normal"} ${labelFont.size}px ${labelFont.family}`).width : handleCustomLabelOffset(textVal, `${labelFont.italic ? "italic" : "normal"} ${labelFont.size}px ${labelFont.family}`).width;
              }
              let unit_fontWidth = handleCustomLabelOffset(unit, `${unitFont.italic ? "italic" : "normal"} ${unitFont.size}px ${unitFont.family}`).width;
              let offset = (val_fontWidth - unit_fontWidth) * 0.55;
              let labelTextX;
              let labelTextY;
              if (labelPosition === "inside") {
                labelTextX = start[0] - size[0] / 2 - 1 + offset
                labelTextY = start[1] + size[1] / 2
              } else if (["right", "top"].includes(labelPosition)) {
                labelTextX = start[0] - 1 + offset + labelShapeSpacing
                labelTextY = start[1] - labelShapeSpacing
              } else {
                labelTextX = max + (start[0] - size[0]) + offset + labelShapeSpacing + scaleOffset
                labelTextY = (size[1] + start[1]) - max - labelShapeSpacing - scaleOffset
              }
              // 隐藏零值
              if (this.getOption("hide-zero-value") && Number(textVal) == 0) {
                textVal = ""
                unit = ""
              }

              // 转置(条形图)
              let shapes = [];
              if (this.transposed) {
                shapes.push({
                  type: shape,
                  shape: {
                    x: start[0] ,
                    y: start[1],
                    barWidth: barWidth,
                    barHeight: size[0] - scaleOffset ,
                    transposed: this.transposed
                  },
                  transition: 'shape',
                  originX: start[0] - size[0],
                  enterAnimation: {
                    duration: 1000,
                    easing: "quarticOut"
                  },
                  enterFrom: {
                    scaleX: 0,
                  },
                  select: {
                    style: {
                      fill: hightLightColor
                    }
                  },
                  style: {
                    fill: color,
                    lineWidth: shapeDataBorderWidth,
                    stroke: borderFollowShape ? color : borderColor, // this.toEchartsColor(this.getOption("shapeData-border-color"))
                    // lineWidth: shapeBorderWidth,
                    // stroke:this.toEchartsColor(this.getOption("shape-border-color"))
                  }
                })

                if (showLabel) {
                  const textColor = labelColorFollow ? getSingleColor(color) : labelFont.color || "#ffffff";
                  let textHighlightColor = highlight ? this.toEchartsColor(this.getOption(["series-hight-color-cluster", hightLightIndexes[index], "highlight-font-color"])) : textColor;
                  let textSize = highlight ? this.getOption<number>(["series-hight-color-cluster", hightLightIndexes[index], "highlight-font-size"]) : labelFont.size;
                  shapes.push({
                    type: 'text',
                    style: {
                      text: this.transposed ? yLabel ? xName[params.dataIndex]+"-"+textVal : textVal || "" : xLabel ? xName[params.dataIndex]+"-"+textVal : textVal || "",
                      fill: textColor,
                      x: labelTextX,
                      y: start[1] + 1 - this.getOption<number>("label-vertical-offset"),
                      textAlign: 'right',
                      textVerticalAlign: 'middle',
                      font: `${labelFont.italic ? "italic" : ""}  ${labelFont.bold ? "bolder" : ""} ${labelFont.size}px ${labelFont.family}`,
                      opacity: showLabel ? 1 : 0,
                    },
                    select: {
                      style: {
                        fill: textHighlightColor,
                        font: `${labelFont.italic ? "italic" : ""}  ${labelFont.bold ? "bolder" : ""} ${textSize}px ${labelFont.family}`,
                        x: highlight && labelFont.size !== textSize ? labelTextX + (textSize - labelFont.size) / 2 : labelTextX
                      }
                    },
                    silent: true,
                    z2: 99,
                    // 加载动画
                    enterFrom: {
                      scaleY: 0,
                    },
                    originY: start[1] + size[1],
                    enterAnimation: {
                      duration: 1000,
                      easing: "quarticOut"
                    },
                  })
                }

                if (unit) {
                  let unitTextColor = highlight ? this.toEchartsColor(this.getOption(["series-hight-color-cluster", hightLightIndexes[index], "unit-highlight-font-color"])) as Color : unitFont.color || "#ffffff";
                  let unitextSize = highlight ? this.getOption<number>(["series-hight-color-cluster", hightLightIndexes[index], "unit-highlight-font-size"]) : unitFont.size;
                  shapes.push({
                    type: 'text',
                    style: {
                      text: unit || "",
                      fill: unitFont.color,
                      x: labelTextX,
                      y: start[1] + 1,
                      textAlign: 'left',
                      textVerticalAlign: 'middle',
                      font: `${unitFont.italic ? "italic" : ""}  ${unitFont.bold ? "bolder" : ""} ${unitFont.size}px ${unitFont.family}`,
                      opacity: showLabel ? 1 : 0,
                    },
                    select: {
                      style: {
                        fill: unitTextColor,
                        font: `${unitFont.italic ? "italic" : ""}  ${labelFont.bold ? "bolder" : ""} ${unitextSize}px ${unitFont.family}`,
                      }
                    },
                    silent: true,
                    z2: 99,
                    // 加载动画
                    enterFrom: {
                      scaleY: 0,
                    },
                    originY: start[1] + size[1],
                    enterAnimation: {
                      duration: 1000,
                      easing: "quarticOut"
                    },
                  })
                }

              } else {
                shapes.push({
                  type: shape,
                  shape: {
                    x: start[0],
                    y: start[1],
                    barWidth: barWidth,
                    barHeight: size[1] - scaleOffset,
                    transposed: this.transposed,
                    bottomY: this.useInverse('y') ? height - scaleOffset + maxStart[1] : height - scaleOffset + maxStart[1],
                  },
                  transition: 'shape',
                  // 加载动画
                  enterFrom: {
                    scaleY: 0,
                  },
                  originY: this.useInverse('y') ? height - scaleOffset + maxStart[1] : start[1] + size[1],
                  enterAnimation: {
                    duration: 1000,
                    easing: "quarticOut"
                  },
                  select: {
                    style: {
                      fill: hightLightColor
                    }
                  },
                  style: {
                    fill: color,
                    lineWidth: shapeDataBorderWidth,
                    stroke: borderFollowShape ? color : borderColor, // this.toEchartsColor(this.getOption("shapeData-border-color"))
                    // lineWidth: shapeBorderWidth,
                    // stroke:this.toEchartsColor(this.getOption("shape-border-color"))
                  }
                })

                if (showLabel) {
                  const textColor = labelColorFollow ? getSingleColor(color) : labelFont.color || "#ffffff";
                  let textHighlightColor = highlight ? this.toEchartsColor(this.getOption(["series-hight-color-cluster", hightLightIndexes[index], "highlight-font-color"])) : textColor;
                  let textSize = highlight ? this.getOption<number>(["series-hight-color-cluster", hightLightIndexes[index], "highlight-font-size"]) : labelFont.size;

                  shapes.push({
                    type: 'text',
                    style: {
                      text: this.transposed ? yLabel ? xName[params.dataIndex]+"-"+textVal : textVal || "" : xLabel ? xName[params.dataIndex]+"-"+textVal : textVal || "",
                      fill: textColor,
                      x: start[0] - 1 + offset,
                      y: labelTextY,
                      textAlign: 'right',
                      textVerticalAlign: 'middle',
                      font: `${labelFont.italic ? "italic" : ""}  ${labelFont.bold ? "bolder" : ""} ${labelFont.size}px ${labelFont.family}`,
                      opacity: showLabel ? 1 : 0,
                    },
                    select: {
                      style: {
                        fill: textHighlightColor,
                        font: `${labelFont.italic ? "italic" : ""}  ${labelFont.bold ? "bolder" : ""} ${textSize}px ${labelFont.family}`,
                        x: highlight && labelFont.size !== textSize ? start[0] - 1 + offset + (textSize - labelFont.size) / 2 : start[0] - 1 + offset
                      }
                    },
                    silent: true,
                    z2: 99,
                    // 加载动画
                    enterFrom: {
                      scaleY: 0,
                    },
                    originY: start[1] + size[1],
                    enterAnimation: {
                      duration: 1000,
                      easing: "quarticOut"
                    },
                  })
                }

                if (unit) {
                  let unitTextColor = highlight ? this.toEchartsColor(this.getOption(["series-hight-color-cluster", hightLightIndexes[index], "unit-highlight-font-color"])) as Color : unitFont.color || "#ffffff";
                  let unitextSize = highlight ? this.getOption<number>(["series-hight-color-cluster", hightLightIndexes[index], "unit-highlight-font-size"]) : unitFont.size;
                  shapes.push({
                    type: 'text',
                    style: {
                      text: unit || "",
                      fill: unitFont.color,
                      x: start[0] + 1 + offset,
                      y: labelTextY,
                      textAlign: 'left',
                      textVerticalAlign: 'middle',
                      font: `${unitFont.italic ? "italic" : ""}  ${unitFont.bold ? "bolder" : ""} ${unitFont.size}px ${unitFont.family}`,
                      opacity: showLabel ? 1 : 0,
                    },
                    select: {
                      style: {
                        fill: unitTextColor,
                        font: `${unitFont.italic ? "italic" : ""}  ${unitFont.bold ? "bolder" : ""} ${unitextSize}px ${unitFont.family}`,
                      }
                    },
                    silent: true,
                    z2: 99,
                    // 加载动画
                    enterFrom: {
                      scaleY: 0,
                    },
                    originY: start[1] + size[1],
                    enterAnimation: {
                      duration: 1000,
                      easing: "quarticOut"
                    },
                  })
                }
              }

              return {
                type: 'group',
                children: shapes,
              }

            }
          }
          // 绘制背景
          barShapeBgOpt = {
            type: 'custom',
            name: name + "-bg",
            id: `${yUid}-triangleBg-${index}`,
            encode,
            silent: true,
            itemStyle: {
              color: '#ddd'
            },
            z: 0,
            renderItem: (params, api) => {

              let categoryIndex = api.value(this.transposed ? params.encode.y : params.encode.x);
              // 取坐标轴最大值
              let max = this.transposed ? (this.echartsChart as any).getModel().getComponent('xAxis').axis.scale._extent[1] : (this.echartsChart as any).getModel().getComponent('yAxis').axis.scale._extent[1];
              let pointStart = this.transposed ? api.coord([max, categoryIndex]) : api.coord([categoryIndex, max]);
              let maxHeight = this.transposed ? api.size([max, 0])[0] : api.size([0, max])[1];

              let barLayout = api.barLayout({
                barGap: this.stack ? '-100%' : currentBarGap,
                count: valueNum
              });

              let step = 0;
              if (shapeColumnWidth === "auto") {
                step = barLayout[index].offsetCenter;
              } else {
                if (lineNum % 2 === 0) { // 正中间没有柱子
                  if (index < lineNum / 2) { // 左边的柱子
                    step = - shapeBarGap / 2 - Number(shapeColumnWidth) / 2 - (lineNum / 2 - index - 1) * (Number(shapeColumnWidth) + shapeBarGap);
                  } else {
                    step = shapeBarGap / 2 + Number(shapeColumnWidth) / 2 + (index - lineNum / 2) * (Number(shapeColumnWidth) + shapeBarGap);
                  }
                } else { // 正中间有柱子
                  if (index < lineNum / 2 - 0.5) { // 左边
                    step = - Number(shapeColumnWidth) / 2 - (lineNum / 2 - index - 0.5) * shapeBarGap - (lineNum / 2 - index - 1) * Number(shapeColumnWidth);
                  } else if (index + 0.5 === lineNum / 2) { // 中间
                    step = 0;
                  } else {
                    step = Number(shapeColumnWidth) / 2 + (index - lineNum / 2 + 0.5) * shapeBarGap + (index - lineNum / 2) * Number(shapeColumnWidth);
                  }
                }
              }

              // 各组间隔偏移
              this.transposed ? pointStart[1] += step : pointStart[0] += step;

              if (shapeColumnWidth === 'auto') {
                barWidth = barLayout[index].width / 2;
              }

              return {
                // 表示这个图形元素是矩形。还可以是 'circle', 'sector', 'polygon' 等等。
                type: 'triangleColumn',
                shape: {
                  x: pointStart[0],
                  y: pointStart[1],
                  barWidth: barWidth,
                  barHeight: maxHeight,
                  transposed: this.transposed
                },
                // 加载动画
                enterFrom: {
                  scaleY: this.transposed ? undefined : 0,
                },
                originY: pointStart[1] + maxHeight,
                enterAnimation: {
                  duration: 1000,
                  easing: "quarticOut"
                },
                transition: 'shape',
                // 用 api.style(...) 得到默认的样式设置。这个样式设置包含了
                // option 中 itemStyle 的配置和视觉映射得到的颜色。
                style: {
                  fill: shapeBackground,
                  lineWidth: shapeBorderWidth,
                  stroke: this.toEchartsColor(this.getOption("shape-border-color"))
                }
              };
            }
          }
        }

        if (this.stack && stackFlag && index == lineNum - 1) {  //堆叠或条形时渲染一次背景
          seriesOpt.push(barShapeBgOpt);
          stackFlag = false;
        }
        if (!this.stack) {  //分组时分别渲染
          seriesOpt.push(barShapeBgOpt);
        }
        seriesOpt.push(barShapeOpt);
      }
      // 绘制顶部图形
      if (this.getOption("top-shape")) {
        let seriesSet = new Set();
        let topWidth = this.getOption<number>("top-shape-top-width");
        let bottomWidth = this.getOption<number>("top-shape-bottom-width");
        let height = this.getOption<number>("top-shape-height");
        let distance = this.getOption<number>("top-shape-distance");
        let follow = this.getOption<string>("top-shape-color-select") === 'follow';
        let shapeType = this.getOption<string>("top-shape-type");
        let imageWidth = this.getOption<number>("top-shape-image-width");
        let imageHeight = this.getOption<number>("top-shape-image-height");
        let imageOpacity = this.getOption<number>("top-shape-image-opacity") * 0.01;
        let shapePosition = this.getOption<boolean>("top-shape-position");
        let topShapeSeriesOpt = {
          type: 'custom',
          name: 'topShape-' + name,
          selectedMode: 'single',
          renderItem: (params, api) => {
            let { x, y } = getXAndYUIDs()
            let categoryIndex = api.value(this.transposed ? y : x);
            let yUid = this.transposed ? x : y;
            let yValue = api.value(yUid);
            if (isNaN(yValue)) return;
            let color = this.getSeriesTopShapeColors()[index];
            let seriesTopShapeColor = seriesColor;
            if (hasGroup && this.transposed) {
              const reversedColors = [...this.getSeriesTopShapeColors()].reverse();
              color = reversedColors[index];
              if (follow) {
                seriesTopShapeColor = [...seriesColor].reverse()
              }
            }
            let dataIndex
            if (hasGroup) {
              dataIndex = this.transposed ? this.dataLength - 1 - params.dataIndex % this?.dataLength : params.dataIndex;
            } else {
              dataIndex = this.transposed ? this.dataLength - 1 - params.dataIndex : params.dataIndex;
            }
            if (follow) {
              const currentSeriesTopShapeColor = seriesTopShapeColor[index] || seriesTopShapeColor[seriesTopShapeColor.length - 1] || seriesTopShapeColor[0] || [];
              color = currentSeriesTopShapeColor.length
                ? (dataIndex >= currentSeriesTopShapeColor.length ? currentSeriesTopShapeColor[currentSeriesTopShapeColor.length - 1] : currentSeriesTopShapeColor[dataIndex])
                : color;
            }
            // 取坐标轴最大值
            let max = this.transposed ? (this.echartsChart as any).getModel().getComponent('xAxis').axis.scale._extent[1] : (this.echartsChart as any).getModel().getComponent('yAxis').axis.scale._extent[1];
            let pointStart = this.transposed ? api.coord([max, categoryIndex]) : api.coord([categoryIndex, max]);
            let hightLightColor = this.getOption("highlight") ? this.getSeriesHightColors()[index] : color;
            // 根据数据获取坐标信息
            let size = this.transposed ? api.size([yValue, categoryIndex]) : api.size([categoryIndex, yValue]);
            let start = this.transposed ? api.coord([yValue, categoryIndex]) : api.coord([categoryIndex, yValue]);
            let step = 0;
            if (shapeColumnWidth === "auto") {
              let barLayout = api.barLayout({
                barGap: this.stack ? '-100%' : currentBarGap,
                count: lineNum
              });

              step = barLayout[index].offsetCenter;
            } else {
              if (lineNum % 2 === 0) { // 正中间没有柱子
                if (index < lineNum / 2) { // 左边,下边
                  step = - shapeBarGap / 2 - Number(shapeColumnWidth) / 2 - (lineNum / 2 - index - 1) * (Number(shapeColumnWidth) + shapeBarGap);
                } else { // 右边,上边
                  step = shapeBarGap / 2 + Number(shapeColumnWidth) / 2 + (index - lineNum / 2) * (Number(shapeColumnWidth) + shapeBarGap);
                }
              } else { // 正中间有柱子
                if (index < lineNum / 2 - 0.5) { // 左边,下边
                  step = - Number(shapeColumnWidth) / 2 - (lineNum / 2 - index - 0.5) * shapeBarGap - (lineNum / 2 - index - 1) * Number(shapeColumnWidth);
                } else if (index + 0.5 === lineNum / 2) { // 中间
                  step = 0;
                } else { // 右边,上边
                  step = Number(shapeColumnWidth) / 2 + (index - lineNum / 2 + 0.5) * shapeBarGap + (index - lineNum / 2) * Number(shapeColumnWidth);
                }
              }
            }

            // 各组间隔偏移
            let topShapeStart = start;
            if (!this.stack) {
              this.transposed ? shapePosition ? pointStart[1] += step : start[1] += step : shapePosition ? pointStart[0] += step : start[0] += step;
            } else {
              let prevSum = 0;
              if (hasGroup) {
                let xValue = api.value(xDims[0].uid[2]);
                for (let i = 0; i <= params.dataIndexInside; i++) {
                  if (api.value(xDims[0].uid[2], i) === xValue) {
                    let currentValue = api.value(yDims[0].uid[2], i);
                    if ((currentValue >= 0 && yValue >= 0) || (currentValue < 0 && yValue < 0)) {
                      prevSum += currentValue;
                    }
                  }
                }
              } else {
                for (let i = 0; i <= index; i++) {
                  // 如果开了图例并且对应图例没有处在选中状态，需要在计算时去掉对应柱子的数据
                  let yAlias = this.getFieldAlias(yDims[i].uid);
                  if (!isLegendSelect(yAlias)) continue;
                  let currentUid = xDims[0].uid[2] === yDims[0].uid[2]  ? `${yDims[i].uid[2]}_count` : yDims[i].uid[2];
                  let currentValue = api.value(this.percent ? currentUid + '_percentValue' : currentUid);
                  if ((currentValue >= 0 && yValue >= 0) || (currentValue < 0 && yValue < 0)) {
                    prevSum += currentValue;
                  }
                }
              }


              if (this.transposed) {
                topShapeStart = prevSum >= 0 ? api.coord([prevSum, categoryIndex]) : api.coord([prevSum - yValue, categoryIndex])
              } else {
                topShapeStart = prevSum >= 0 ? api.coord([categoryIndex, prevSum]) : api.coord([categoryIndex, prevSum - yValue])
              }

            }
            //是否转置
            if (this.transposed) {
              //条形图
              if (shapeType == "image") {
                // 使用顶部图片
                return {
                  type: 'image',
                  style: {
                    image: this.getTopShapeImageSrc(index),
                    x: shapePosition ? pointStart[0] + Number(distance) : start[0] + Number(distance),
                    y: shapePosition ? pointStart[1] - imageHeight / 2 : start[1] - imageHeight / 2,
                    width: imageWidth,
                    height: imageHeight,
                    opacity: imageOpacity
                  },
                  transition: "shape",
                  select:{
                    style:{
                      image:this.getTopShapeHighImageSrc(index),
                      x: shapePosition ? pointStart[0] + Number(distance) : start[0] + Number(distance),
                      y: shapePosition ? pointStart[1] - imageHeight / 2 : start[1] - imageHeight / 2,
                      width: imageWidth,
                      height: imageHeight,
                      opacity: imageOpacity
                    }
                  }
                };
              } else if (shapeType == "circle"){
                return {
                  type: 'circle',
                  shape: {
                    cx: shapePosition? pointStart[0] + Number(distance) : start[0] + Number(distance),
                    cy: shapePosition? pointStart[1] : start[1],
                    r: this.getOption("top-shape-radius")
                  },
                  style: api.style({
                    borderWidth: 0,
                    fill: color
                  }),
                  transition: "shape",
                  z2: 999
                }
              }
              return {
                // 表示这个图形元素是矩形。还可以是 'circle', 'sector', 'polygon' 等等。
                // barLayout[params.seriesIndex - count].width 获取自适应宽度
                type: 'polygon',
                shape: {
                  // 矩形的位置和大小。
                  /*
                    0 ---- 1
                    |      |
                    3 ---- 2
                  */
                  points: shapePosition ?  [
                    [
                      pointStart[0] + Number(distance),
                      pointStart[1] - bottomWidth / 2
                    ],
                    [
                      pointStart[0] + Number(distance) + height,
                      pointStart[1] - topWidth / 2
                    ],
                    [
                      pointStart[0] + Number(distance) + height,
                      pointStart[1] + topWidth / 2
                    ],
                    [
                      pointStart[0] + Number(distance),
                      pointStart[1] + bottomWidth / 2
                    ]
                  ] : [
                    [
                      start[0] + Number(distance),
                      start[1] - bottomWidth / 2
                    ],
                    [
                      start[0] + Number(distance) + height,
                      start[1] - topWidth / 2
                    ],
                    [
                      start[0] + Number(distance) + height,
                      start[1] + topWidth / 2
                    ],
                    [
                      start[0] + Number(distance),
                      start[1] + bottomWidth / 2
                    ]
                  ]
                },
                style: api.style({
                  borderWidth: 0,
                  fill: color
                }),
                select: {
                  style: {
                    fill: hightLightColor
                  }
                },
                transition: "shape"
              };
            } else {
              // 柱状图
              if (shapeType == "image") {
                // 使用顶部图片
                return {
                  type: 'image',
                  style: {
                    image: this.getTopShapeImageSrc(index),
                    x: shapePosition ? pointStart[0] - imageWidth / 2 : topShapeStart[0] - imageWidth / 2,
                    y: shapePosition ? pointStart[1] - imageHeight - distance : topShapeStart[1] - imageHeight - distance,
                    width: imageWidth,
                    height: imageHeight,
                    opacity: imageOpacity
                  },
                  transition: "shape",
                  select:{
                    style:{
                      image:this.getTopShapeHighImageSrc(index),
                      x: shapePosition ? pointStart[0] - imageWidth / 2 : topShapeStart[0] - imageWidth / 2,
                      y: shapePosition ? pointStart[1] - imageHeight - distance : topShapeStart[1] - imageHeight - distance,
                      width: imageWidth,
                      height: imageHeight,
                      opacity: imageOpacity
                    }
                  }
                };
              } else if (shapeType == "circle"){
                return {
                  type: 'circle',
                  shape: {
                    cx: shapePosition? pointStart[0] : topShapeStart[0],
                    cy: shapePosition? pointStart[1] - distance : topShapeStart[1] - distance,
                    r: this.getOption("top-shape-radius")
                  },
                  style: api.style({
                    borderWidth: 0,
                    fill: color
                  }),
                  transition: "shape",
                  z2: 999
                }
              }
              return {
                type: 'polygon',
                shape: {
                  // 矩形的位置和大小。
                  /*
                    0 ---- 1
                    |      |
                    3 ---- 2
                  */
                  points: shapePosition ? [
                    [
                      pointStart[0] - topWidth / 2,
                      pointStart[1] - height - distance
                    ],
                    [
                      pointStart[0] + topWidth / 2,
                      pointStart[1] - height - distance
                    ],
                    [
                      pointStart[0] + bottomWidth / 2,
                      pointStart[1] - distance
                    ],
                    [
                      pointStart[0] - bottomWidth / 2,
                      pointStart[1] - distance
                    ]
                  ] : [
                    [
                      topShapeStart[0] - topWidth / 2,
                      topShapeStart[1] - height - distance
                    ],
                    [
                      topShapeStart[0] + topWidth / 2,
                      topShapeStart[1] - height - distance
                    ],
                    [
                      topShapeStart[0] + bottomWidth / 2,
                      topShapeStart[1] - distance
                    ],
                    [
                      topShapeStart[0] - bottomWidth / 2,
                      topShapeStart[1] - distance
                    ]
                  ],
                },
                style: api.style({
                  borderWidth: 0,
                  fill: color
                }),
                select: {
                  style: {
                    fill: hightLightColor
                  }
                },
                transition: "shape"
              };

            }
          },
          encode,
          z: 3
        }
        seriesOpt.push(topShapeSeriesOpt);
      }

      // 绘制条形图分割线
      if (this.getOption("shape-line")) {
        let lineWidth = this.getOption<number>("shape-line-width");
        let lineColor = this.getOption<Color>("shape-line-color");

        let barSplitOption = {
          name: 'barSplitLine__$',
          type: 'custom',
          z: 2,
          encode,
          silent: true,
          renderItem: (params, api) => {
            let { x, y } = getXAndYUIDs()
            let categoryIndex = api.value(this.transposed ? y : x);
            let yUid = this.transposed ? x : y;
            let yValue = api.value(yUid);
            // 根据数据获取坐标信息
            let size = this.transposed ? api.size([yValue, categoryIndex]) : api.size([categoryIndex, yValue]);
            let start = this.transposed ? api.coord([yValue, categoryIndex]) : api.coord([categoryIndex, yValue]);
            let max = this.transposed ? (this.echartsChart as any).getModel().getComponent('xAxis').axis.scale._extent[1] : (this.echartsChart as any).getModel().getComponent('yAxis').axis.scale._extent[1];
            let maxVal = this.transposed ? api.size([max, 0])[0] : api.size([0, max])[1];
            let step = 0;
            let autoShapeWidth;
            if (shapeColumnWidth === "auto") {
              let barLayout = api.barLayout({
                barGap: this.stack ? '-100%' : currentBarGap,
                count: lineNum
              });
              autoShapeWidth = barLayout[0].width;
              step = barLayout[index].offsetCenter;
            } else {
              if (lineNum % 2 === 0) { // 正中间没有柱子
                if (index < lineNum / 2) { // 左边的柱子
                  step = - shapeBarGap / 2 - Number(shapeColumnWidth) / 2 - (lineNum / 2 - index - 1) * (Number(shapeColumnWidth) + shapeBarGap);
                } else {
                  step = shapeBarGap / 2 + Number(shapeColumnWidth) / 2 + (index - lineNum / 2) * (Number(shapeColumnWidth) + shapeBarGap);
                }
              } else { // 正中间有柱子
                if (index < lineNum / 2 - 0.5) { // 左边
                  step = - Number(shapeColumnWidth) / 2 - (lineNum / 2 - index - 0.5) * shapeBarGap - (lineNum / 2 - index - 1) * Number(shapeColumnWidth);
                } else if (index + 0.5 === lineNum / 2) { // 中间
                  step = 0;
                } else {
                  step = Number(shapeColumnWidth) / 2 + (index - lineNum / 2 + 0.5) * shapeBarGap + (index - lineNum / 2) * Number(shapeColumnWidth);
                }
              }
            }
            // 各组间隔偏移
            if (!this.stack) {
              this.transposed ? start[1] += step : start[0] += step;
            }
            let offset = 0;

            if (this.getOption('shape-line-position') == 'center') {
              offset = lineWidth / 2;
            } else if (this.getOption('shape-line-position') == 'bottom') {
              offset = shapeColumnWidth == 'auto' ? -autoShapeWidth / 2 : -shapeColumnWidth / 2;
            } else {
              offset = shapeColumnWidth == 'auto' ? autoShapeWidth / 2 + lineWidth : Number(shapeColumnWidth) / 2 + lineWidth;
            }

            return {
              type: 'rect',
              shape: {
                x: start[0] - size[0],
                y: start[1] - offset,
                width: maxVal,
                height: lineWidth
              },
              style: {
                fill: lineColor
              }
            };
          }
        }
        seriesOpt.push(barSplitOption);
      }

      // 柱状图排序文本
      if (this.getOption("ranking-text")) {
        let rankingTextFont = this.getOption<OptionFontValue>("ranking-text-font");
        let fontSize = rankingTextFont.size;
        let fontColor = this.toEchartsColor(rankingTextFont.color as Color);
        let fontFamily = rankingTextFont.family;
        let fontStyle = rankingTextFont.italic;
        let fontWeight = rankingTextFont.bold;
        let distance = this.getOption<number>("ranking-text-distance");
        let textOffset = this.getOption<number>("ranking-text-offset");
        let rankingTextTemplate = this.getOption<string>("ranking-text-template");
        let templateStrArr = [];
        let showTextType = this.getOption("show-text-type");
        let showTextNumber = this.getOption<number>("ranking-text-show-number");
        let textFommaterType = this.getOption("ranking-text-fommater-type");
        let backgroundColor = this.toEchartsColor(this.getOption<Color>("ranking-text-background-color"))
        let backgroundWidth = this.getOption<number>("ranking-text-background-width");
        let backgroundHeight = this.getOption<number>("ranking-text-background-height");
        let backgroundType = this.getOption<string>("ranking-text-background")
        let backgroundShapeType = this.getOption("ranking-text-background-shape-type")
        let backgroundImageUrl = this.rankingBackgroundImageSrc

        if (!this.getSoul().options["padding-right"] && this.transposed) {
          this.setOption(["padding-right"], "diy", false);
          this.setOption(["padding-right-diy"], 35, false);
        }
        if (rankingTextTemplate.replace("{}", "#") !== rankingTextTemplate) {
          let tempStr = rankingTextTemplate.replace("{}", "#");
          templateStrArr = tempStr.split("#");
        } else {
          templateStrArr.push(rankingTextTemplate);
        }
        const sortType = this.getOption("sort-type");
        const sortUid = this.getOption<string>("sort-object");
        let valuse = this.datasetSource().map(item => {
          if(sortType == "normal" || ["toChoose", "sumVal"].includes(sortUid)) return item.sumVal;
          return isNaN(item[sortUid]) ? 0 : item[sortUid];
        })
        let sumMax = Math.max(...valuse);
        let sumMin = Math.min(...valuse);
        valuse.sort((a, b) => {
          return b - a;
        })

        // 显示文本
        let rankingTextGroup = [];

        let sortTextOption = {
          name: 'rankingText__$',
          type: 'custom',
          z: 2,
          encode,
          silent: true,
          renderItem: (params, api) => {
            let { x, y } = getXAndYUIDs()
            let categoryIndex = api.value(this.transposed ? y : x);
            let yUid = this.transposed ? x : y;
            let yValue = api.value(yUid);
            const dataRaw = this.datasetSource()[categoryIndex];
            let currentSumValue = (sortType == "normal" || ["toChoose", "sumVal"].includes(sortUid)) ? dataRaw.sumVal : dataRaw[sortUid];
            // 根据数据获取坐标信息
            let start = this.transposed ? api.coord([yValue, categoryIndex]) : api.coord([categoryIndex, yValue]);
            let max = this.transposed ? (this.echartsChart as any).getModel().getComponent('xAxis').axis.scale._extent[1] : (this.echartsChart as any).getModel().getComponent('yAxis').axis.scale._extent[1];
            let maxCoord: number = this.transposed ? api.coord([max, 0])[0] : api.coord([0, max])[1];
            let rankValue = valuse.indexOf(currentSumValue) + 1;
            let rankingStr = rankingTextTemplate.replace("{}", (valuse.indexOf(currentSumValue) + 1).toString())

            if (textFommaterType == "text-template") {
              rankingStr = rankingTextTemplate.replace("{}", (valuse.indexOf(currentSumValue) + 1).toString())
            } else {
              rankValue = currentSumValue;
              rankingStr = rankingTextTemplate.replace("{}", currentSumValue.toString())
            }

            let textWidth = handleCustomLabelOffset(rankingStr, `${fontStyle ? "italic" : "normal"} ${fontSize}px ${fontFamily}`).width;
            let textHeight = handleCustomLabelOffset(rankingStr[0], `${fontStyle ? "italic" : "normal"} ${fontSize}px ${fontFamily}`).width;
            let isShowText = true;
            if (showTextType !== "all") {
              if (showTextType == "max" && (currentSumValue != sumMax)) {
                isShowText = false;
              } else if (showTextType == "min" && (currentSumValue != sumMin)) {
                isShowText = false;
              } else if (showTextType == "max-and-min") {
                if (currentSumValue != sumMax && currentSumValue != sumMin) {
                  isShowText = false;
                }
              } else if (showTextType == "custom" && valuse.indexOf(currentSumValue) + 1 > showTextNumber) {
                isShowText = false;
              }
            }
            let textCustomObj = {
              type: 'text',
              x: this.transposed ? (maxCoord + distance + textWidth / 2) : start[0] + textOffset,
              y: this.transposed ? start[1] + textOffset : maxCoord - distance,
              emphasisDisabled: true,
              style: {
                text: (isNaN(rankValue) || !rankValue) ? "" : rankingStr,
                fill: fontColor,
                z: 100,
                textAlign: this.transposed ? 'right' : 'center',
                textVerticalAlign: 'middle',
                font: `${fontStyle ? "italic" : ""}  ${fontWeight ? "bolder" : ""} ${fontSize}px ${fontFamily}`,
                opacity: isShowText ? 1 : 0
              },
              silent: true,
              z2: 52
            };
            // 绘制背景
            if (backgroundType == "shape") {
              let rectX = this.transposed ? (maxCoord + distance) - backgroundWidth / 2 : start[0] - backgroundWidth / 2 + textOffset;
              let rectY = this.transposed ? start[1] - backgroundHeight / 2 - textOffset: maxCoord - distance - backgroundHeight / 2;
              textCustomObj.x = rectX - textWidth / 2 + backgroundWidth / 2;
              textCustomObj.y = rectY - textHeight / 2 + backgroundHeight / 2;

              let textCustomBackgroundObj = {
                type: 'rect',
                emphasisDisabled: true,
                shape: {
                  x: rectX,
                  y: rectY,
                  width: backgroundWidth,
                  height: backgroundHeight
                },
                style: {
                  fill: backgroundColor,
                  opacity: isShowText ? 1 : 0
                },
                transition: ["shape"],
                textContent: textCustomObj
              }
              if (backgroundShapeType == "down-arrow-rect") {
                let width = 5;
                let height = 5;
                let bottomTriangle = {
                  type: 'polygon',
                  shape: {
                    points: this.transposed ?
                      [[maxCoord - backgroundWidth / 2 + distance - 5, start[1] - textOffset],
                      [maxCoord + distance - backgroundWidth / 2, start[1] - height - textOffset],
                      [maxCoord + distance - backgroundWidth / 2, start[1] + height - textOffset],
                      [maxCoord - backgroundWidth / 2 + distance - 5, start[1] - textOffset]
                      ] : [[start[0] + textOffset, maxCoord - distance + backgroundHeight / 2 + height],
                      [start[0] - width + textOffset, maxCoord - distance + backgroundHeight / 2],
                      [start[0] + width + textOffset, maxCoord - distance + backgroundHeight / 2],
                      [start[0] + textOffset, maxCoord - distance + backgroundHeight / 2 + height]
                      ],
                  },
                  emphasisDisabled: true,
                  style: {
                    fill: backgroundColor,
                    opacity: isShowText ? 1 : 0
                  },
                  transition: ["shape"],
                  z2: 49
                }
                return {
                  type: "group",
                  children: [textCustomBackgroundObj, bottomTriangle],
                }
              }
              return textCustomBackgroundObj;
            } else {
              let imgX = this.transposed ? (maxCoord + distance) - backgroundWidth / 2 : start[0] - backgroundWidth / 2 + textOffset;
              let imgY = this.transposed ? start[1] - backgroundHeight / 2 - textOffset: maxCoord - distance - backgroundHeight / 2;
              textCustomObj.x = imgX - textWidth / 2 + backgroundWidth / 2;
              textCustomObj.y = imgY - textHeight / 2 + backgroundHeight / 2;
              return {
                type: 'image',
                style: {
                  image: backgroundImageUrl,
                  x: imgX,
                  y: imgY,
                  width: backgroundWidth,
                  height: backgroundHeight,
                  emphasisDisabled: true,
                  opacity: isShowText ? 1 : 0
                },
                transition: ["shape"],
                textContent: textCustomObj,
              }
            }
          }
        }
        seriesOpt.push(sortTextOption);
      }

      // 绘制纹理
      if(this.textureImage){
        if(this.stack && index > 0) continue;
        const textureColumnWidth = shapeColumnWidth == "auto" ? "100%" : shapeColumnWidth;
        const axisMaxValue = this.transposed ? (this.echartsChart as any).getModel()?.getComponent?.('xAxis')?.axis.scale._extent[1] : (this.echartsChart as any).getModel()?.getComponent?.('yAxis')?.axis.scale._extent[1];
        seriesOpt.push({
          name: "texture",
          // id: "texture",
          id: `texture__${index}`,
          type: "pictorialBar",
          barGap: this.stack ? void 0 : currentBarGap,
          barWidth: textureColumnWidth,
          symbol: "image://" + this.textureImage,
          symbolSize: this.transposed ? ["200%", textureColumnWidth] : [textureColumnWidth, "200%"],
          symbolOffset: this.transposed ? [`-${this.textureOffsetY}%`, 0] : [0, `${this.textureOffsetY}%`],
          symbolRepeat: false,
          symbolClip: true,
          symbolBoundingData: axisMaxValue,
          animationDurationUpdate: this._textureAnimationIndex === 0 ? this.textureAnimationDuration * 1000 : 0,
          animationEasingUpdate: "linear",
          z: 9999,
          silent: true,
          encode: {
            x: this.transposed ? this.stack ? "sumVal" : encode?.x : encode?.x,
            y: this.transposed ? encode?.y : this.stack ? "sumVal" : encode?.y,
          },
          yAxisIndex: this.echartsYAxisOption.findIndex(yAxis => yAxis.id === this.getSingleYAxisOption("y").id),
        });
      }

    }

    return seriesOpt;

  }

  getLegendOtherOption() {
    let xDims = this.getOption<OptionFieldValue[]>("axis-x") || [];
    let yDims = this.getOption<OptionFieldValue[]>("axis-y") || [];
    let groupDims = this.getOption<OptionFieldValue[]>("axis-group") || [];
    let legendIcon = this.getOption<string>("legend-icon");
    let lineDims = this.getOption<OptionFieldValue[]>("axis-line") || [];
    let legendLimit = this.getOption<number>("legend-text-limit");
    let barShape = this.getOption<string>("bar-shape");
    let colors = this.getSeriesColors();
    let hasGroup = groupDims.length > 0;
    let lineNum = hasGroup ? this.xTypes.length : yDims.length;
    let data = [];
    if (!xDims.length) return {}

    if (yDims?.length && barShape !== "bar") { // 此处需要特殊处理
      for (let i = 0; i < lineNum; i++) {
        let opt = { name: hasGroup ? this.xTypes[i] : this.getFieldAlias(yDims[i].uid) + "__$" + i, itemStyle: { color: colors[i]?.[0] || colors[0]?.[0], opacity: 1 } };
        if (legendIcon !== "default") {
          opt['icon'] = legendIcon;
        }
        data.push(opt)
      }
    } else if (yDims?.length && barShape === "bar") {
      for (let i = 0; i < lineNum; i++) {
        let opt = { name: hasGroup ? this.xTypes[i] : this.getFieldAlias(yDims[i].uid), itemStyle: { color: colors[i]?.[0] || colors[0]?.[0] } };
        if (legendIcon !== "default") {
          opt['icon'] = legendIcon;
        }
        data.push(opt)
      }
    }

    lineDims?.forEach((dim, index) => {
      let opt = { name: this.getFieldAlias(dim?.uid), itemStyle: { color: colors?.[lineNum + index]?.[0] } };
      if (legendIcon !== "default") {
        opt['icon'] = legendIcon;
      }
      data.push(opt)
    })

    return {
      // 根据seriesName中的'__$'处理显示的图例名称
      formatter: (name) => {
        let processedName = name?.split('__$')[0] || name;
        if(processedName.length > legendLimit) {
          return processedName.slice(0, legendLimit) + "...";
        } else {
          return processedName;
        }
      },
      data: data?.length ? data : undefined
    }
  }

  get tooltipAxisPointer(): TooltipComponentOption["axisPointer"] {
    let axisPointerColor = this.toEchartsColor(new Color(this.getOption<Color>("tooltip-axisPointer-color")));
    let axisPointerShadowBlur = this.getOption<number>("tooltip-axisPointer-shadowBlur");
    let axisPointerShadowColor = this.toEchartsColor(new Color(this.getOption<Color>("tooltip-axisPointer-shadowColor")));
    let axisPointerShadowOffset = this.getOption("tooltip-axisPointer-shadowOffset");
    return {
      type: "shadow",
      axis: this.transposed ? "y" : "x",
      shadowStyle:{
        color:axisPointerColor,
        shadowBlur:axisPointerShadowBlur,
        shadowColor:axisPointerShadowColor,
        shadowOffsetX:axisPointerShadowOffset?.[0],
        shadowOffsetY:axisPointerShadowOffset?.[1],
        opacity:0.5
      }
    };
  }

  get echartsDataZoomOption() {
    let shapeColumnCustom = this.getOption<string>("series-shape-number-type");
    let shapeColumnNumber = this.getOption<number>("shape-column-number");
    let dataZoomOpt = super.echartsDataZoomOption;
    let sourceLength = this.echartsDatasetOption()?.[0]?.source?.length;
    if (this.transposed && shapeColumnCustom == "custom" && shapeColumnNumber < sourceLength) {
      dataZoomOpt[0].startValue = sourceLength - (shapeColumnNumber - 1);
      dataZoomOpt[0].endValue = sourceLength;
    }
    return dataZoomOpt;
  }

  get echartsTooltipOption(): TooltipComponentOption | TooltipComponentOption[] {
    let tooltipOption = super.echartsTooltipOption;

    let paddingWidth = this.getOption<number>("tooltip-padding-width");
    let paddingHeight = this.getOption<number>("tooltip-padding-height");
    let showIcon = this.getOption<boolean>("tooltip-icon");

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
    let groupDims = this.getOption<OptionFieldValue[]>("axis-group") || [];
    let hasGroup = groupDims.length > 0;

    if(lineUids?.length){
      yUids = [...yUids,...lineUids]
    }
    lineUids.push("line_data");

    tooltipOption.formatter = (params) => {
      let dataHtml = "";
      let seriesNameSet = new Set();
      if (this.stack) {
        params.reverse()
      }

      for (let param of params || []) {
        if(seriesNameSet.has(param.seriesName)) continue;
        // 根据seriesName中的'__$'筛选要显示在提示框上的信息
        if(param.seriesName.includes("__$") || param.seriesName.includes("-bg") || param.seriesName.includes("topShape")) continue;
        let index = this.xTypes.length ? this.xTypes.indexOf(param.seriesName) : yUids.indexOf(param.seriesId.split('-')[0]);
        let dataIndex
        let iconColor
        if (hasGroup) {
          dataIndex = this.transposed ? this.dataLength - 1 - param.dataIndex % this?.dataLength : param.dataIndex;
        } else {
          dataIndex = this.transposed ? this.dataLength - 1 - param.dataIndex : param.dataIndex;
        }
        if (this.transposed && hasGroup){
          iconColor = (dataIndex >= seriesCssColors[seriesCssColors.length - 1 - index]?.length - 1) ? seriesCssColors[seriesCssColors.length - 1 - index][seriesCssColors[seriesCssColors.length - 1 - index]?.length - 1] : seriesCssColors[seriesCssColors.length -1 - index]?.[dataIndex] || "#1890FFFF";
        } else {
          iconColor = (dataIndex >= seriesCssColors[index]?.length - 1) ? seriesCssColors[index][seriesCssColors[index]?.length - 1] : seriesCssColors[index]?.[dataIndex] || "#1890FFFF";
        }
        if(Array.isArray(iconColor)){
          iconColor = iconColor[0];
        }
        let iconHtml = showIcon ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${iconColor};"></span>` : "";

        let valueUid = param.dimensionNames[param.encode.y[0]];
        if(this.transposed){
          valueUid = param.dimensionNames[param.encode.x?.[0]];
        }
        let val = param.value[valueUid];
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

    return tooltipOption
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
    };
  }

  public processColumnClick(widget: any, params: any, state: ChartClickState, staticData?: { yAliasArr?: string[], dataIndexArr?: number[] }) {
    let yAliasArr = staticData?.yAliasArr || [];
    let dataIndexArr = staticData?.dataIndexArr || [];

    if (!staticData) {
      // 重新计算
      let yDims = widget.getOption("axis-y") || [];
      yDims.forEach(dim => {
        yAliasArr.push(widget.getFieldAlias(dim.uid));
      })
      for (let i = 0; i < widget.datasetSource().length; i++) {
        dataIndexArr.push(i)
      }
    }

    widget.selectedData.value = {
      name: params.name,
      value: params.data.sumVal
    }
    if (state.lastseriesIndex !== -1 && state.lastseriesIndex !== params.seriesIndex) {
      widget.echartsChart.dispatchAction({
        type: 'unselect',
        seriesIndex: state.lastseriesIndex,
        dataIndex: state.lastUnselectIndex
      })
    }
    //清除所有顶部图形的选中
    let topShapeSeriesNames = [];
    yAliasArr.forEach(alias => {
      topShapeSeriesNames.push(`topShape-${alias}`)
    })
    widget.echartsChart.dispatchAction({
      type: 'unselect',
      seriesName: topShapeSeriesNames,
      dataIndex: dataIndexArr
    })

    let uids = widget.getOption("axis-x")?.[0]?.uid;
    if (uids?.length) {
      if (state.lastTopshapeIndex == params.dataIndex && state.lastseriesIndex == params.seriesIndex) {
        state.lastTopshapeIndex = -1
      } else {
        let selectSeriesName = params.seriesName;
        if (widget.getOption('bar-shape') === 'rect' || widget.getOption('bar-shape') === 'triangle') {
          selectSeriesName = params.seriesName?.split('__$')[0]
        }
        //顶部图形高亮选中
        widget.echartsChart.dispatchAction({
          type: 'select',
          seriesName: `topShape-${selectSeriesName}`,
          dataIndex: widget.selectedIndex.value
        })
        state.lastTopshapeIndex = widget.selectedIndex.value
      }
      if (state.lastDataIndex === params.dataIndex) {
        state.lastDataIndex = -1;
        widget.withdrawLinkage();
        widget.selectedIndex.value = -1;
      } else {
        state.lastDataIndex = params.dataIndex;
        state.lastUnselectIndex = state.lastDataIndex;
        let alias = widget.getFieldAlias(uids);
        let fieldArr = widget.getOption("linkage-form-field")?.split(".")
        let fieldUIDs;
        let filterValue;
        if (fieldArr?.length) {
          if (fieldArr.length === 2) {
            fieldUIDs = [uids[0], ...fieldArr];
            filterValue = params.value[fieldArr[1]];
          } else if (fieldArr.length === 3) {
            fieldUIDs = [uids[0], fieldArr[0], `${fieldArr[1]}.${fieldArr[2]}`];
            filterValue = params.value[fieldArr[1]].map(item => item[fieldArr[2]]);
          }
        }
        widget.applyLinkage({ uid: fieldUIDs as OptionFieldUID, value: filterValue });
      }
    } else {
      state.lastDataIndex = params.dataIndex;
      state.lastUnselectIndex = state.lastDataIndex;
    }
    state.lastseriesIndex = params.seriesIndex;
  }

  initEchartsEvents(): void {
    const state: ChartClickState = {
      lastseriesIndex: -1,
      lastDataIndex: -1,
      lastUnselectIndex: -1,
      lastTopshapeIndex: -1
    };

    let yAliasArr = [];
    let dataIndexArr = []
    let yDims = this.getOption<OptionFieldValue[]>("axis-y") || [];
    yDims.forEach(dim => {
      yAliasArr.push(this.getFieldAlias(dim.uid));
    })
    for (let i = 0; i < this.datasetSource().length; i++) {
      dataIndexArr.push(i)
    }

    this.echartsChart.off("click");
    this.echartsChart.on('click', (params) => {
      const chartOption = this.echartsChart.getOption();
      const currentSeries = chartOption.series?.[params.seriesIndex];
      if (currentSeries?.selectedMap?.[params.name]) {
        this.selectedIndex.value = params.dataIndex;
      } else {
        this.selectedIndex.value = -1;
        state.lastDataIndex = params.dataIndex;
        state.lastUnselectIndex = params.dataIndex;
        state.lastseriesIndex = params.seriesIndex;
        state.lastTopshapeIndex = params.dataIndex;
      }

      this.processColumnClick(this, params, state, { yAliasArr, dataIndexArr });

    })
  }

  get currentValue() {
    return this.selectedData.value
  }

  get defaultConditionField(){
    let choices = [{
      label: i18next.t("chooseField"),
      value: ""
    }]
    let xDim = this.getOption("axis-x")[0];
    let yDim = this.getOption("axis-y")[0];
    if (!xDim && !yDim) {
      return [choices, "=="];
    }
    let uid = xDim?.uid || yDim?.uid;
    const fields = getBoardTableFields(this, uid);
    fields.forEach(field => {
      let choice = {
        label: field.alias,
        value: field.uid
      }
      choices.push(choice)
    })
    let defaultChoice = choices[1] ? choices[1].value : ""
    return [defaultChoice, "null"]
  }

  destroy() {
    this.removeTextureAnimationTimer();
    super.destroy();
  }
}

