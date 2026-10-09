import { OptionFieldUID } from "@common/types/project";
import { isNocodeFormData } from "@common/utils/connection";
import { Account } from "@common/types/account";
import { isEqual } from "@common/utils/flow";
import { DefinedOptions, OptionFontValue, OptionFileValue, OptionFieldValue, GetOptionOptions } from "@renderer/b2/types";
import { Widget } from "@renderer/b2/controllers/widget";
import { Color } from "@renderer/b2/color";
import { OptionValue } from "@common/types/project";
import * as echarts from "echarts";
import * as echarts_gl from "echarts-gl";
import "echarts-liquidfill";
import "echarts-wordcloud";
import { formatFloat } from "@common/utils/math";
import { GridComponentOption, LegendComponentOption, TooltipComponentOption, XAXisComponentOption, YAXisComponentOption, DatasetComponentOption, SeriesOption, EChartsOption, ECharts } from "echarts";
import { deepClone, equals, isEmpty } from "@common/utils/object";
import { watch, Ref, ref } from "vue";
import i18next from "@renderer/widgets/i18next";
import resource from "./locales";
import { Field, Row } from "@common/types/project";
import {
  evaluateBucketStageTableAggregateField,
  evaluateRowStageTableAggregateField,
  expandTableAggregateDataUids,
  resolveTableAggregateOptionUID,
  shouldBypassSecondarySummary,
} from "../../basic/_common/tableAggregateField";
import { CATEGORY_AGGREGATORS, resolveTimeCategoryBucket } from "./utils/aggregator";

console.log("echarts_gl", typeof echarts_gl); //防止 echarts-gl 没有显示被使用，导致esbuild 打包时过滤掉
enum SortType {
    ASC = 1,
    DESC = -1
}
export class EchartsBasic extends Widget {
  public echartsElement: HTMLDivElement;
  public echartsChart: ECharts;
  protected noDims: Boolean = false;
  public destroyed: boolean = false;
  public stopAnimate:boolean = false;
  public animation_display_paused: boolean = false;
  public animation_display_loop_id: number = 0;
  public animation_display_timeout;
  public b2_animators = [];
  public needPaintWhenVisible: boolean = false;
  public echartsLoaded: boolean = false;
  public isAnimating: boolean = false;
  public defaultColors10 = Array.from(["#5b8ff9", "#5ad8a6", "#5d7092", "#f6bd16", "#6f5ef9", "#6dc8ec", "#945fb9", "#ff9845", "#1e9493", "#ff99c3"]);
  public originDataSource;
  public dataSortMap = new Map();
  static resource = resource;
  public resizeReady?: boolean;
  public isResourceLoading = false;

  static defineOptions(): DefinedOptions[] {
    const UNIT_GE = i18next.t("unitGe");
    const UNIT_WEI = i18next.t("unitWei");
    const UNIT_MIAO = i18next.t("unitMiao");
    return [
      {
        data: {
          fields: {
            alias: i18next.t("fieldsSetting"),
            fold: "unfold",
            children: [
              {
                name: "axis-fields",
                alias: i18next.t("axisFields"),
                type: "field",
              },
            ],
          },
          'fields-filter': {
            alias: i18next.t("filterAndSort"),
            children: [
              {
                name: "fields-data-sort-fields",
                alias: i18next.t("dataSort"),
                type: "select",
                clearable: true,
                selectChoices: (element: Widget) => {
                  const optionTableUID = element.getMetaData().axisValue[0]?.uid;
                  if (!optionTableUID) return [];
                  const formData = element.getBoard().getConnections().find(c => c.uid === optionTableUID[0]);
                  const table = formData?.tables?.find(t => t.uid === optionTableUID[1]);
                  if (!table) return [];
                  return table.fields.filter(f => f.meta?.subType !== "subForm").map(f => {
                    return {
                      label: f.alias,
                      value: f.uid,
                    }
                  }).filter(f => element.getMetaData().axisValue.find(v => v.uid[2] === f.value));
                },
              },
              {
                name: "fields-data-sort-orderby",
                type: "select",
                default: SortType.ASC,
                selectChoices:[
                  {
                    label: i18next.t("ascending"),
                    value: SortType.ASC
                  },
                  {
                    label: i18next.t("descending"),
                    value: SortType.DESC
                  }
                ],
              },
            ]
          }
          // sort: {
          //   alias: i18next.t("sort"),
          //   visible: false,
          //   children: [
          //     {
          //       name: "sort-type",
          //       alias: i18next.t("sortType"),
          //       type: "select(radioGroup)",
          //       default: "normal",
          //       selectChoices: [
          //         {
          //           value: "normal",
          //           label: i18next.t("sortTypeNormal"),
          //         },
          //         {
          //           value: "ASC",
          //           label: i18next.t("sortTypeAsc"),
          //         },
          //         {
          //           value: "DESC",
          //           label: i18next.t("sortTypeDesc"),
          //         },
          //       ],
          //     },
          //     {
          //       name: "sort-object",
          //       alias: i18next.t("sortObject"),
          //       type: "select",
          //       default: "toChoose",
          //       selectChoices: (widget: EchartsBasic) => {
          //         return [ { value: "toChoose", label: i18next.t("toChoose") }, ...widget.getSortObjects()];
          //       },
          //       visible: (widget: EchartsBasic) => {
          //         return widget.getOption("sort-type") !== "normal";
          //       }
          //     },
          //     {
          //       name: "new-filter",
          //       alias: i18next.t("newFilter"),
          //       type: "boolean",
          //       default: false,
          //       visible: (widget: EchartsBasic) => {
          //         return widget.getOption("sort-type")!== "normal";
          //       }
          //     },
          //     {
          //       name: "new-filter-cluster",
          //       alias: i18next.t("newFilterCluster"),
          //       fold: "unfold",
          //       visible: (widget: EchartsBasic) => {
          //         return widget.getOption("sort-type")!== "normal" && widget.getOption("new-filter")!== false;
          //       },
          //       children: [
          //         {
          //           name: "new-filter-condition",
          //           alias: i18next.t("newFilterCondition"),
          //           type: "select",
          //           selectChoices: [
          //             { value: "no-condition", label: i18next.t("filterNoCondition"), },
          //             { value: "data-row", label: i18next.t("filterDataRow"), },
          //             { value: "data-rows", label: i18next.t("filterDataRows"), },
          //             { value: "data-condition", label: i18next.t("filterDataCondition"), },
          //           ],
          //           default: "no-condition",
          //         },
          //         {
          //           name: "new-filter-data-row-num",
          //           alias: i18next.t("newFilterDataRowNum"),
          //           type: "number(min=1)",
          //           default: 1,
          //           visible: (widget) => {
          //             return widget.getOption("new-filter-condition") === "data-row";
          //           }
          //         },
          //         {
          //           name: "new-filter-data-start-rows-num",
          //           alias: i18next.t("newFilterDataStartRowsNum"),
          //           type: "number(min=1)",
          //           default: 1,
          //           visible: (widget) => {
          //             return widget.getOption("new-filter-condition") === "data-rows";
          //           }
          //         },
          //         {
          //           name: "new-filter-data-rows",
          //           alias: i18next.t("newFilterDataRows"),
          //           type: "number(min=1)",
          //           default: 1,
          //           visible: (widget) => {
          //             return widget.getOption("new-filter-condition") === "data-rows";
          //           }
          //         },
          //         {
          //           name: "new-filter-condition-select",
          //           alias: i18next.t("newFilterConditionSelect"),
          //           type: "select(condition)",
          //           selectChoices: (widget) => {
          //             const dataconditions = widget.getBoard().getDataConditions();
          //             return dataconditions.map(dataCondition => ({ label: dataCondition.name, value: dataCondition.uid }));
          //           },
          //           visible: (widget) => {
          //             return widget.getOption("new-filter-condition") === "data-condition";
          //           },
          //         },
          //       ],
          //     }
          //   ],
          // },
        },
        style: {
          basic: {
            children:[
              {
                name: "echarts-renderer",
                alias: i18next.t("echartsRenderer"),
                type: "select",
                default: "canvas",
                visible: false,
                selectChoices: [
                  {
                    value: "canvas",
                    label: i18next.t("canvas"),
                  },
                  {
                    value: "svg",
                    label: i18next.t("svg"),
                  }
                ]
              }
            ]
          },
          "series-color": {
            alias: i18next.t("seriesColor"),
            after: "basic",
            children: [
              {
                name: "palette",
                alias: i18next.t("palette"),
                type: "palette(gradient)",
                default: (widget: Widget | any) => { return widget.defaultColors10 },
              },
            ]
          },
          axis: {
            alias: i18next.t("axis"),
            visible: false
          },
          legend: {
            alias: i18next.t("legend"),
            type: "boolean",
            default: true,
            children: [
            {
                name: "legend-type",
                alias: i18next.t("legendType"),
                type: "select(radioGroup)",
                default: "plain",
                selectChoices: [
                  {
                    value: "plain",
                    label: i18next.t("legendTypePlain"),
                  },
                  {
                    value: "scroll",
                    label: i18next.t("scroll"),
                  },
                ],
              },
              {
                name: "legend-position",
                alias: i18next.t("legendPosition"),
                type: "select",
                default: "top-right",
                selectChoices: [
                  {
                    value: "left-top",
                    label: i18next.t("leftTop"),
                  },
                  {
                    value: "left",
                    label: i18next.t("left"),
                  },
                  {
                    value: "left-bottom",
                    label: i18next.t("leftBottom"),
                  },
                  {
                    value: "right-top",
                    label: i18next.t("rightTop"),
                  },
                  {
                    value: "right",
                    label: i18next.t("right"),
                  },
                  {
                    value: "right-bottom",
                    label: i18next.t("rightBottom"),
                  },
                  {
                    value: "top-left",
                    label: i18next.t("topLeft"),
                  },
                  {
                    value: "top",
                    label: i18next.t("top"),
                  },
                  {
                    value: "top-right",
                    label: i18next.t("topRight"),
                  },
                  {
                    value: "bottom-left",
                    label: i18next.t("bottomLeft"),
                  },
                  {
                    value: "bottom",
                    label: i18next.t("bottom"),
                  },
                  {
                    value: "bottom-right",
                    label: i18next.t("bottomRight"),
                  },
                ],
              },
              {
                name: "legend-itemGap",
                alias: i18next.t("legendItemGap"),
                type: "number(unit=px)",
                default: 10,
              },
              {
                name: "legend-text-limit",
                alias: i18next.t("legendTextLimit"),
                type: "number(unit=" + UNIT_GE + ")",
                default: 100,
              },
              {
                name: "legend-font",
                alias: i18next.t("legendFont"),
                type: "font",
                default: {
                  size: 12,
                  color: "#666"
                },
              },
              {
                name: "legend-text",
                alias: i18next.t("legendText"),
                type: "select(radioGroup)",
                selectChoices: [
                  {
                    value: "auto",
                    label: i18next.t("legendAuto"),
                  },
                  {
                    value: "custom",
                    label: i18next.t("legendCustom"),
                  }
                ],
                default: "auto"
              },
              {
                name: "legend-text-width",
                alias: i18next.t("legendTextWidth"),
                type: "number(unit=px)",
                default: 30,
                visible: (widget:ECharts)=>{
                  return widget.getOption("legend-text") === "custom"
                }
              },
              {
                name: "legend-text-padding",
                alias: i18next.t("legendTextPadding"),
                type: "number(unit=px)",
                default: 0,
              },
              {
                name: "legend-icon",
                alias: i18next.t("legendIcon"),
                type:"select",
                default:'default',
                selectChoices:[
                  {
                    label: i18next.t("legendIconDefault"),
                    value: "default",
                  },
                  {
                    label: i18next.t("legendIconCircle"),
                    value:"circle",
                  },
                  {
                    label: i18next.t("legendIconRoundRect"),
                    value:'roundRect',
                  },
                  {
                    label: i18next.t("legendIconTriangle"),
                    value:'triangle',
                  },
                  {
                    label: i18next.t("legendIconDiamond"),
                    value:'diamond',
                  },
                  {
                    label: i18next.t("legend-rect"),
                    value:'rect',
                  },
                ]
              },
              {
                name: "legend-icon-size",
                alias: i18next.t("legendIconSize"),
                type: "number(unit=px, min=0)",
                default: 25,
              },
              {
                name: "legend-color",
                alias: i18next.t("legendColor"),
                type: "color",
                default: "#fff",
                visible: false
              },
              {
                name: "legend-font-size",
                alias: i18next.t("legendFontSize"),
                type: "number(unit=px)",
                default: 12,
                visible: false
              },
              {
                name:"legend-button",
                alias:i18next.t("legend-button"),
                children:[
                  {
                    name: "legend-pageTextStyle",
                    alias: i18next.t("legend-pageTextStyle"),
                    type: "font",
                    default: {
                      size: 12,
                      color: "#fff"
                    },
                  },
                  {
                    name: "legend-pageIconSize",
                    alias: i18next.t("legend-pageIconSize"),
                    type: "number(unit=px)",
                    default: 12,
                  },
                  {
                    name: "legend-pageButtonItemGap",
                    alias: i18next.t("legend-pageButtonItemGap"),
                    type: "number(unit=px)",
                    default: 12,
                  },
                  {
                    name: "legend-pageButtonGap",
                    alias: i18next.t("legend-pageButtonGap"),
                    type: "number(unit=px)",
                    default: 12,
                  },
                  {
                    name: "legend-pageIconColor",
                    alias: i18next.t("legend-pageIconColor"),
                    type: "color",
                    default: "#fff",
                  },
                  {
                    name: "legend-pageIconInactiveColor",
                    alias: i18next.t("legend-pageIconInactiveColor"),
                    type: "color",
                    default: "#3c3c3c",
                  },
                  {
                    name: "legend-page-rightBackground",
                    alias: i18next.t("legend-page-rightBackground"),
                    type: "file(format=image)",
                    default: "",
                  },
                  {
                    name: "legend-page-leftBackground",
                    alias: i18next.t("legend-page-leftBackground"),
                    type: "file(format=image)",
                    default: "",
                  },
                ],
                visible:(widget:Widget)=>{
                  return widget.getOption("legend-type") === "scroll"
                }
              },
              {
                name: "legend-padding",
                alias: i18next.t("legendPadding"),
                type: `vector<${i18next.t("directionTop")},${i18next.t("directionBottom")},${i18next.t("directionLeft")},${i18next.t("directionRight")}>(unit=px)`,
                default: (widget: EchartsBasic) => [widget.defaultLegendPadding.top, widget.defaultLegendPadding.bottom, widget.defaultLegendPadding.left, widget.defaultLegendPadding.right],
              },
            ],
          },
          tooltip: {
            alias: i18next.t("tooltip"),
            type: "boolean",
            default: true,
            children: [
              {
                name: "tooltip-style-group",
                alias: i18next.t("tooltipStyleGroup"),
                show: "tab",
                children: [
                  {
                    name: "tooltip-background-color",
                    alias: i18next.t("tooltipBackgroundColor"),
                    type: "color",
                    default: "#4D4D4DFC",
                  },
                  {
                    name: "tooltip-background-image",
                    alias: i18next.t("tooltipBackgroundImage"),
                    type: "file(format=image)",
                    default: "",
                  },
                  {
                    name: "tooltip-background-blur",
                    alias: i18next.t("tooltipBackgroundBlur"),
                    type: "number(unit=px)",
                    default: 0,
                  },
                  {
                    name: "tooltip-padding-width",
                    alias: i18next.t("tooltipPaddingWidth"),
                    type: "number(unit=px)",
                    default: 10,
                  },
                  {
                    name: "tooltip-padding-height",
                    alias: i18next.t("tooltipPaddingHeight"),
                    type: "number(unit=px)",
                    default: 5,
                  },
                  {
                    name: "tooltip-radius",
                    alias: i18next.t("tooltipRadius"),
                    type: "number(unit=px)",
                    default: 5,
                  },
                  {
                    name: "tooltip-icon",
                    alias: i18next.t("tooltipIcon"),
                    type: "boolean",
                    default: true
                  }
                ],
              },
              {
                name: "tooltip-format-cluster",
                alias: i18next.t("tooltipFormatCluster"),
                show: "tab",
                children: [
                  {
                    name: "tooltip-left-axis-format-cluster",
                    alias: i18next.t("tooltipLeftAxisFormatCluster"),
                    fold: "always-unfold",
                    children: [
                      {
                        name: "tooltip-text-type",
                        alias: i18next.t("tooltipTextType"),
                        default: "normal",
                        type: "select(radioGroup)",
                        selectChoices: [
                          {
                            label: i18next.t("tooltipTextTypeNormal"),
                            value: "normal",
                          },
                          {
                            label: i18next.t("tooltipTextTypePercent"),
                            value: "percent",
                          },
                        ],
                      },
                      {
                        name:"tooltip-comma-display",
                        alias: i18next.t("tooltipCommaDisplay"),
                        default: false,
                        type: "boolean",
                      },
                      {
                        name: "tooltip-decimal-places",
                        alias: i18next.t("tooltipDecimalPlaces"),
                        type: "number(unit=" + UNIT_WEI + ", min=0)",
                        default: 0,
                        visible: true,
                      },
                      {
                        name: "tooltip-complete-zero",
                        alias: i18next.t("tooltipCompleteZero"),
                        type: "boolean",
                        visible: true,
                      },
                    ]
                  }
                ],
              },
              {
                name: "tooltip-label-style",
                alias: i18next.t("tooltipLabelStyle"),
                show: "tab",
                children: [
                  {
                    name: "tooltip-name-font-color",
                    alias: i18next.t("tooltipNameFontColor"),
                    type: "color",
                    default: "#ccc",
                  },
                  {
                    name: "tooltip-name-font-size",
                    alias: i18next.t("tooltipNameFontSize"),
                    type: "number(unit=px, min=0)",
                    default: 14,
                  },
                  {
                    name: "tooltip-value-font-color",
                    alias: i18next.t("tooltipValueFontColor"),
                    type: "color",
                    default: "#fff",
                  },
                  {
                    name: "tooltip-value-font-size",
                    alias: i18next.t("tooltipValueFontSize"),
                    type: "number(unit=px, min=0)",
                    default: 14,
                  },
                  {
                    name: "tooltip-title",
                    alias: i18next.t("tooltipTitle"),
                    type: "boolean",
                    default: false
                  },
                  {
                    name: "tooltip-title-font-color",
                    alias: i18next.t("tooltipTitleFontColor"),
                    type: "color",
                    visible: (widget: Widget) => {
                      return widget.getOption("tooltip-title")
                    },
                    default: "#fff",
                  },
                  {
                    name: "tooltip-title-font-size",
                    alias: i18next.t("tooltipTitleFontSize"),
                    type: "number(unit=px, min=0)",
                    visible: (widget: Widget) => {
                      return widget.getOption("tooltip-title")
                    },
                    default: 16,
                  },
                  {
                    name: "tooltip-unit",
                    alias: i18next.t("tooltipUnit"),
                    type: "boolean",
                    default: false,
                    visible: false
                  },
                  {
                    name: "tooltip-unit-text",
                    alias: i18next.t("tooltipUnitText"),
                    type: "string",
                    default: "",
                    visible: (widget: Widget) => {
                      return widget.getOption("tooltip-unit")
                    },
                  },
                  {
                    name: "tooltip-unit-font-color",
                    alias: i18next.t("tooltipUnitFontColor"),
                    type: "color",
                    visible: (widget: Widget) => {
                      return widget.getOption("tooltip-unit")
                    },
                    default: "#fff",
                  },
                  {
                    name: "tooltip-unit-font-size",
                    alias: i18next.t("tooltipUnitFontSize"),
                    type: "number(unit=px)",
                    visible: (widget: Widget) => {
                      return widget.getOption("tooltip-unit")
                    },
                    default: 16,
                  },
                ],
              },
              {
                name: "tooltip-unit-setName",
                alias: i18next.t("tooltipUnitSetName"),
                show: "tab",
                visible: false,
                children:[
                  {
                    name: "tooltip-unit-name",
                    alias: i18next.t("tooltipUnitName"),
                    type: "boolean",
                    default: false,
                  },
                  {
                    name: "tooltip-unit-y",
                    alias: i18next.t("tooltipUnitY"),
                    type: "string",
                    default:"%",
                    disabled:((widget: Widget)=>{
                      return !widget.getOption("tooltip-unit-name")
                    }),
                  },
                  {
                    name: "tooltip-unit-yRight",
                    alias: i18next.t("tooltipUnitYRight"),
                    type: "string",
                    default:"%",
                    disabled:((widget: Widget)=>{
                      return !widget.getOption("tooltip-unit-name")
                    }),
                  },
                  {
                    name: "tooltip-unit-color",
                    alias: i18next.t("tooltipUnitColor"),
                    type: "color",
                    default: "#ffffff",
                    disabled:((widget: Widget)=>{
                      return !widget.getOption("tooltip-unit-name")
                    }),
                  },
                  {
                    name: "tooltip-unit-size",
                    alias: i18next.t("tooltipUnitSize"),
                    type: "number(unit=px)",
                    default: 16,
                    disabled:((widget: Widget)=>{
                      return !widget.getOption("tooltip-unit-name")
                    }),
                  }
                ]
              },
            ],
          },
          padding: {
            alias: i18next.t("padding"),
            after: "animation-display",
            children: [
              {
                name: "padding-right",
                alias: i18next.t("paddingRight"),
                type: "select(radioGroup)",
                selectChoices: [
                  {
                    value: "auto",
                    label: i18next.t("paddingRightAuto"),
                  },
                  {
                    value: "diy",
                    label: i18next.t("paddingRightDiy"),
                  },
                ],
                default: "auto",
              },
              {
                name: "padding-right-diy",
                alias: i18next.t("paddingRight"),
                type: "number(unit=px)",
                // default: 20,
                default: (widget: EchartsBasic) => widget.defaultPadding.right,
                visible: (widget: Widget) => {
                  return widget.getOption("padding-right") === "diy";
                },
              },
              {
                name: "padding-left",
                alias: i18next.t("paddingLeft"),
                type: "select(radioGroup)",
                selectChoices: [
                  {
                    value: "auto",
                    label: i18next.t("paddingLeftAuto"),
                  },
                  {
                    value: "diy",
                    label: i18next.t("paddingLeftDiy"),
                  },
                ],
                default: "auto",
              },
              {
                name: "padding-left-diy",
                alias: i18next.t("paddingLeft"),
                type: "number(unit=px)",
                // default: 20,
                default: (widget: EchartsBasic) => widget.defaultPadding.left,
                visible: (widget: Widget) => {
                  return widget.getOption("padding-left") === "diy";
                },
              },
              {
                name: "padding-top",
                alias: i18next.t("paddingTop"),
                type: "select(radioGroup)",
                selectChoices: [
                  {
                    value: "auto",
                    label: i18next.t("paddingTopAuto"),
                  },
                  {
                    value: "diy",
                    label: i18next.t("paddingTopDiy"),
                  },
                ],
                default: "auto",
              },
              {
                name: "padding-top-diy",
                alias: i18next.t("paddingTop"),
                type: "number(unit=px)",
                // default: 20,
                default: (widget: EchartsBasic) => widget.defaultPadding.top,
                visible: (widget: Widget) => {
                  return widget.getOption("padding-top") === "diy";
                },
              },
              {
                name: "padding-bottom",
                alias: i18next.t("paddingBottom"),
                type: "select(radioGroup)",
                selectChoices: [
                  {
                    value: "auto",
                    label: i18next.t("paddingBottomAuto"),
                  },
                  {
                    value: "diy",
                    label: i18next.t("paddingBottomDiy"),
                  },
                ],
                default: "auto",
              },
              {
                name: "padding-bottom-diy",
                alias: i18next.t("paddingBottom"),
                type: "number(unit=px)",
                // default: 20,
                default: (widget: EchartsBasic) => widget.defaultPadding.bottom,
                visible: (widget: Widget) => {
                  return widget.getOption("padding-bottom") === "diy";
                },
              },
            ],
          },
          "animation-display": {
            alias: i18next.t("animationDisplayGroup"),
            visible: false,
            children: [
              {
                name: "animation-display",
                alias: i18next.t("animationDisplay"),
                type: "boolean",
                default: true,
              },
              {
                name: "animation-trigger-linkage",
                alias: i18next.t("animationTriggerLinkage"),
                type: "boolean",
                default: true,
              },
              {
                name: "animation-display-type",
                alias: i18next.t("animationDisplayType"),
                type: "select(radioGroup)",
                default: "roll",
                selectChoices: [
                  {
                    value: "roll",
                    label: i18next.t("animationDisplayTypeRoll"),
                  },
                  {
                    value: "carousel",
                    label: i18next.t("animationDisplayTypeCarousel"),
                  }
                ]
              },
              {
                name: "animation-display-delay",
                alias: i18next.t("animationDisplayDelay"),
                type: "number<float>(unit=" + UNIT_MIAO + ", min=0)",
                default: 1,
              },
              {
                name: "animation-display-duration",
                alias: i18next.t("animationDisplayDuration"),
                type: "number<float>(unit=" + UNIT_MIAO + ", min=0)",
                default: 0.5,
                visible: (widget: EchartsBasic) => {
                  return widget.getOption("animation-display-type") === "roll";
                },
              },
              {
                name: "animation-display-single-interval",
                alias: i18next.t("animationDisplaySingleInterval"),
                type: "number<float>(unit=" + UNIT_MIAO + ", min=0)",
                default: 2,
                visible: (widget: EchartsBasic) => {
                  return widget.getOption("animation-display-type") === "roll";
                },
              },
              {
                name: "animation-display-stay-column-carousel",
                alias: i18next.t("animationDisplayStayColumnCarousel"),
                type: "number<float>(unit=" + UNIT_MIAO + ")",
                default: 2,
                visible: (widget: EchartsBasic) => {
                  return widget.getOption("animation-display-type") === "carousel";
                },
              },
              {
                name: "animation-display-loop",
                alias: i18next.t("animationDisplayLoop"),
                type: "boolean",
                default: true,
              },
              {
                name: "animation-display-interval",
                alias: i18next.t("animationDisplayInterval"),
                type: "number<float>(unit=" + UNIT_MIAO + ", min=0)",
                default: 0,
              },
              {
                name: "display-with-linkage",
                alias: i18next.t("displayWithLinkage"),
                type: "boolean",
                default: true,
                visible: false
              },
            ]
          },
          background: {
            children: [
              {
                name: 'background-clip-path',
                type: 'file(format=image)',
                visible: false
              },
            ]
          }
        },
      },
      ...super.defineOptions(),
    ];
  }

  get fluidAutoHeight() {
    return false;
  }
  get fluidAutoWidth() {
    return false;
  }

  get animationTriggerLinkage(){
    return this.getOption("animation-trigger-linkage");
  }

  get formDataSortFields() {
    return this.getOption<any>("fields-data-sort-fields");
  }
  get fieldsDataSortOrderby() {
    return this.getOption("fields-data-sort-orderby");
  }
  getSortObjects() {
    return [];
  }

  getMeetRuleFuncs() {
    return {
      '=': (current_value: number, value: number) => current_value == value,
      '>': (current_value: number, value: number) => current_value > value,
      '<': (current_value: number, value: number) => current_value < value,
      '>=': (current_value: number, value: number) => current_value >= value,
      '<=': (current_value: number, value: number) => current_value <= value,
      '!=': (current_value: number, value: number) => current_value != value,
    }
  }

  getDataAfterFilter(dataSource){
    let resultDataSource = dataSource;
    if (dataSource && this.getOption("new-filter")) {
      const filterCondition = this.getOption("new-filter-condition");
      let seriesLength = 1;
      if (filterCondition === "data-row") { // 筛选指定行
        const rowNum = this.getOption<number>("new-filter-data-row-num");

        let startRowNum = seriesLength * (rowNum - 1);
        let endRowNum = startRowNum + seriesLength
        resultDataSource = dataSource.filter((row, rowIndex)=>{
          return rowIndex >= startRowNum && rowIndex < endRowNum;
        });
      } else if (filterCondition === "data-rows") {
        let startRowsNum = this.getOption<number>("new-filter-data-start-rows-num");
        let readRows = this.getOption<number>("new-filter-data-rows");

        let startRowNum = seriesLength * (startRowsNum - 1);
        let endRowNum = seriesLength * (startRowsNum - 1 + readRows);

        resultDataSource = dataSource.filter((row, rowIndex)=>{
          return rowIndex >= startRowNum && rowIndex < endRowNum;
        });
      } else if (filterCondition === "data-condition") { // 数据条件
        const dataConditionUID = this.getOption("new-filter-condition-select");
        const dataCondition = this.getBoard().getDataConditions().find(dataCondition => dataCondition.uid === dataConditionUID);
        if(!dataCondition) return [];
        const meetRuleFuncs = this.getMeetRuleFuncs();
        let dataLength = Math.floor(dataSource.length / seriesLength);
        resultDataSource = dataSource.filter((row, rowIndex)=>{
          let currentIndex = Math.floor(rowIndex / seriesLength);
          for (const group of dataCondition.rules) {
            for (const rule of group) {
              const { func, args, field } = rule;
              if(!field || !func || !args) continue;

              if(rule.field === 'row' || rule.field === 'reverseRow') {
                let judgedIndex = rule.field === "row" ? currentIndex + 1 : dataLength - currentIndex;
                if(!meetRuleFuncs[func](judgedIndex, args)){ return false }
              }else if (rule.field == 'count') { // 数据条数
                if(!meetRuleFuncs[func](dataLength, args)){ return false }
              }else {
                let judgedValue = row[field];
                if(judgedValue != undefined){
                  if(!meetRuleFuncs[func](judgedValue, args)){ return false }
                }
              }
            }
          }
          return true;
        });
      }
    }
    return resultDataSource;
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

  get legendPadding(): any {
    let padding = this.getOption<number>("legend-padding");

    return {
      top: padding[0],
      right: padding[3],
      bottom: padding[1],
      left: padding[2]
    }
  }

  getLegendOtherOption() {
    return {}
  }

  doCommaSeparat(text){
    let isNegative = false;
    let isPercent = false;
    if(text.toString().includes("-")) {
      isNegative = true;
      text = text.toString().replace(/-/g, "");
    }
    if(text.toString().includes("%")) {
      isPercent = true;
      text = text.toString().replace(/%/g, "");
    }
    let valueArr = text.toString().replace(/\,/g, "").split('.');
    let integer = valueArr[0].split('');
    let decimal = valueArr[1];
    let result = [];
    let index = 0;
    for (let i = integer.length - 1; i >= 0; i--) {
      index++;
      result.unshift(integer[i]);
      if ((index % 3) === 0 && i !== 0) {
         result.unshift(',');
      }
    }
    if (decimal) {
      text = result.join('') + '.' + decimal;
    } else {
      text = result.join('');
    }

    if(isNegative) {
      text = "-" + text;
    }
    if(isPercent) {
      text = text + "%";
    }
    return text;
  }

  get echartsLegendOption(): LegendComponentOption | LegendComponentOption[] {
    const projectId = this.getBoard().projectId;
    let legendPosition = this.getOption<string>("legend-position");
    let legendFont = this.getOption<OptionFontValue>("legend-font");
    let legendIcon = this.getOption<string>("legend-icon");
    let legendIconSize = this.getOption<number>("legend-icon-size");
    let legendLimit = this.getOption<number>("legend-text-limit");
    let legendTextPadding = this.getOption<number>("legend-text-padding");
    let legendPageButtonItemGap = this.getOption<number>("legend-pageButtonItemGap");
    let legendPageButtonGap = this.getOption("legend-pageButtonGap");
    let legendPageIconColor = this.getOption("legend-pageIconColor");
    let legendPageIconInactiveColor = this.getOption("legend-pageIconInactiveColor");
    let legendPageIconSize = this.getOption("legend-pageIconSize");
    let legendPageTextStyle = this.getOption<OptionFontValue>("legend-pageTextStyle");
    let legendleftBackground = this.getOption<OptionFileValue>("legend-page-leftBackground");
    let legendrightBackground = this.getOption<OptionFileValue>("legend-page-rightBackground");
    let legendText = this.getOption("legend-text")
    let leftImage = null;
    let rightImage = null;
    if(legendleftBackground?.url){
      leftImage = legendleftBackground?.url;
    }else if(legendleftBackground?.relativePath){
      leftImage = encodeURI(`${projectId}/${legendleftBackground?.relativePath}`);
    }
    if(legendrightBackground?.url){
      rightImage = legendrightBackground?.url;
    }else if(legendrightBackground?.relativePath){
      rightImage = encodeURI(`${projectId}/${legendrightBackground?.relativePath}`);
    }

    const legendPadding = this.legendPadding;
    const isLeft = legendPosition.includes("left");
    const isRight = legendPosition.includes("right");
    const isTop = legendPosition.includes("top");
    const isBottom = legendPosition.includes("bottom");
    let legendOption:any = {
      show: this.getOption<boolean>("legend"),
      type: this.getOption<string>("legend-type"),
      itemGap: this.getOption<number>("legend-itemGap"),
      align: "left",
      orient: legendPosition.startsWith("left") || legendPosition.startsWith("right") ? 'vertical' : "horizontal",
      left: isLeft
        ? legendPadding.left
        : isRight
          ? undefined
          : "center",
      right: isRight
        ? legendPadding.right
        : undefined,
      top: isTop
        ? legendPadding.top
        : isBottom
          ? undefined
          : "middle",
      bottom: isBottom
        ? legendPadding.bottom
        : undefined,
      itemWidth: legendIconSize,
      itemHeight: legendIcon === "rect" ? legendIconSize : legendIconSize / 25 * 14,
      textStyle: {
        color: this.toEchartsColor(legendFont.color as Color) || this.toEchartsColor(this.getOption<Color>("legend-color")),
        fontSize: legendFont.size || this.getOption<number>("legend-font-size"),
        fontFamily: legendFont.family,
        fontWeight: legendFont.bold ? "bold" : "normal",
        fontStyle: legendFont.italic ? "italic" : "normal",
        padding: [0,0,0,Number(legendTextPadding)]
      },
      itemStyle:{
        opacity: 1
      },
      formatter:  function (name) {
          if(name.length > legendLimit) {
            return name.slice(0, legendLimit) + "...";
          } else {
            return name;
          }
      },
      pageTextStyle: {
        color: this.toEchartsColor(legendPageTextStyle.color as Color),
        fontSize: legendPageTextStyle.size || this.getOption<number>("legend-font-size"),
        fontFamily: legendPageTextStyle.family,
        fontWeight: legendPageTextStyle.bold ? "bold" : "normal",
        fontStyle: legendPageTextStyle.italic ? "italic" : "normal",
      },
      pageIconSize: legendPageIconSize,
      pageIconInactiveColor: this.toEchartsColor(legendPageIconInactiveColor as Color),
      pageIconColor: this.toEchartsColor(legendPageIconColor as Color),
      pageButtonGap: legendPageButtonGap,
      pageButtonItemGap: legendPageButtonItemGap,
      pageIcons:{
        horizontal:[rightImage ? `image://${rightImage}` : "M0,0L12,-10L12,10z",leftImage ? `image://${leftImage}` : "M0,0L-12,-10L-12,10z"],
        vertical:[rightImage ? `image://${rightImage}` : "M0,0L12,-10L12,10z",leftImage ? `image://${leftImage}` : "M0,0L-12,-10L-12,10z"]
      },
      ...this.getLegendOtherOption()
    }
    if(legendIcon !== "default"){
      legendOption["icon"] = legendIcon
    }
    if(legendText === "custom"){
      legendOption["textStyle"]["width"] = this.getOption("legend-text-width");
      legendOption["textStyle"]["backgroundColor"] = "transparent";
      legendOption["textStyle"]["overflow"] = "truncate";
    }

    return legendOption;
  }

  get echartsGridOption(): GridComponentOption | GridComponentOption[] {
    let gridPadding = this.padding;

    const showLegend = this.getOption<boolean>("legend")
    return {
      top: showLegend ? gridPadding.top : gridPadding.top,
      right: gridPadding.right,
      bottom: gridPadding.bottom,
      left: gridPadding.left,
      containLabel: true,
    }
  }

  get tooltipTrigger(): TooltipComponentOption["trigger"] {
    return "axis";
  }

  get tooltipAxisPointer(): TooltipComponentOption["axisPointer"] {
    return {
      show: false,
      type: "none"
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
      padding: [0],// [paddingHeight, paddingWidth, paddingHeight, paddingWidth],
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

          let val = param.value[param.dimensionNames[param.encode.y[0]]];
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
            <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${param.seriesName}：</span>
            <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${val}</span>
          </div>`;
          seriesNameSet.add(param.seriesName);
        }
        let titleHtml = showTitle ? `<div>
          <span style="color:${titleFontColor};font-size:${titleFontSize}px;line-height:1;">${params[0]?.name}</span>
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
      },
    }
  }

  get echartsXAxisOption(): XAXisComponentOption | XAXisComponentOption[] {
    return {
      type: "category",
      boundaryGap: true,
      axisLabel: {
        color: "#fff",
        fontSize: 12,
      },
      axisLine: {
        show: true,
      },
      axisTick: {
        show: false
      },
      splitLine: {
        show: false,
      },
      gridIndex: 0,
    }
  }

  get echartsYAxisOption(): YAXisComponentOption | YAXisComponentOption[] {
    return {
      type: "value",
      axisLabel: {
        color: "#fff",
        fontSize: 12,
      },
      axisLine: {
        show: true,
      },
      axisTick: {
        show: false
      },
      splitLine: {
        show: false,
      },
      gridIndex: 0,
    }
  }

  get echartsSeriesOption(): SeriesOption | SeriesOption[] {
    return {
      name: "value",
      type: "line",
      encode: {
        x: "name",
        y: "value",
      },
      silent: true,
    }
  }


  createView(paths?: string[] | any) {
    let result = [];
    if (!paths) return result;
    this.noDims = false;
    const uids = [];
    for (const item of paths) {
      const options = this.getOption<OptionFieldValue[]>(item) || [];
      for (const option of options) {
        const resolvedUID = resolveTableAggregateOptionUID(this, option.uid);
        if (resolvedUID && resolvedUID.join(".") !== option.uid?.join(".")) {
          option.uid = resolvedUID;
        }
        const dataUIDs = expandTableAggregateDataUids(this, [option.uid]);
        if (dataUIDs.length) {
          uids.push(...dataUIDs);
        } else {
          uids.push(option.uid);
        }
      }
    }
    return this.getData().getRows(uids);
  }

  get ignoreDims(): `f_${string}`[] {
    return []
  }

  dealDataByAggregate(
    sourceData: Row[],
    categoryDims: OptionFieldValue[],
    valueDims: OptionFieldValue[],
  ) {
    categoryDims = (categoryDims || []).filter((dim): dim is OptionFieldValue => !!dim?.uid?.[2]);
    valueDims = (valueDims || []).filter((dim): dim is OptionFieldValue => !!dim?.uid?.[2]);
    if (!categoryDims.length || !valueDims.length) return [];

    let temp: Record<string, any> = {};
    let isSubSource = false;
    const categoryUids = categoryDims.map(dim => dim.uid[2]);
    const bucketStageValueDims = valueDims.filter(dim => shouldBypassSecondarySummary(this, dim));
    const rowStageValueDims = valueDims.filter(dim => !shouldBypassSecondarySummary(this, dim));
    const subFormField = categoryUids.find(uid => uid.split(".").length > 1)?.split(".")[0];

    if (subFormField) {
      sourceData = this.flatDataset(
        sourceData,
        [...categoryUids, ...valueDims.map(dim => dim.uid[2])]
      );
      sourceData.forEach(row => {
        rowStageValueDims.forEach(dim => {
          const field = dim.uid[2];
          const value = evaluateRowStageTableAggregateField(this, dim, row, subFormField);
          if (value !== undefined) {
            row[field] = value;
          }
        });
      });
      isSubSource = true;
    }

    for (const row of sourceData) {
      const replaceMap = {};
      const categoryTimeMeta = {};

      const xKey = categoryDims.map(dim => {
        const uid = dim.uid[2];
        if (!this.ignoreDims.includes(uid)) {
          const aggregator = CATEGORY_AGGREGATORS[dim.summary]
          if (aggregator) {
            const field = this.getField(dim.uid);
            const timeBucket = resolveTimeCategoryBucket(row[uid], dim, field);
            if (timeBucket) {
              categoryTimeMeta[uid] = timeBucket;
            }
            const key = aggregator.getKey(row[uid], { dim, row, field });
            replaceMap[uid] = key;
            return key;
          }
        }
        return row[uid];
      }).join("$") + "$";

      if (!temp[xKey]) {
        temp[xKey] = { ...row, ...replaceMap, _metrics: {}, __tableAggregateRows: [], _categoryTimeMeta: {} };
      }

      const target = temp[xKey];
      if (!isEmpty(categoryTimeMeta)) {
        target._categoryTimeMeta = {
          ...(target._categoryTimeMeta || {}),
          ...categoryTimeMeta,
        };
      }
      const metrics = target._metrics;
      target.__tableAggregateRows.push(row);

      // 普通字段
      for (const dim of valueDims) {
        if (shouldBypassSecondarySummary(this, dim)) continue;

        const field = dim.uid[2];
        const summary = dim.summary || "none";

        if (!isSubSource && field.includes(".")) continue;

        const value = row[field];
        if (value === undefined) continue;

        this.applySummary(metrics, target, field, summary, value, 1);
      }

      // 子表字段
      if (!isSubSource) {
        for (const dim of valueDims) {
          const field = dim.uid[2];
          const summary = dim.summary || "none";
          const ids = field.split(".");
          if (ids.length <= 1) continue;

          const subRows = row[ids[0]] || [];
          const values = subRows
            .map(sub => sub?.[ids[1]])
            .filter(v => v !== undefined);

          if (!values.length) continue;

          if (summary === "distinct") {
            for (const v of values) {
              this.applySummary(metrics, target, field, summary, v, 1);
            }
            continue;
          }

          const total = values.reduce((a, b) => a + b, 0);
          const count = values.length;

          this.applySummary(metrics, target, field, summary, total, count);
        }
      }
    }

    return Object.values(temp).map((row: any) => {
      bucketStageValueDims.forEach(dim => {
        const field = dim.uid[2];
        const summary = dim.summary || "none";
        const value = evaluateBucketStageTableAggregateField(this, dim, row.__tableAggregateRows || []);

        if (!row._metrics[field]) {
          row._metrics[field] = {};
        }

        row._metrics[field][summary] = value;
      });

      for (const key in row) {
        if (key.startsWith("__")) delete row[key];
      }
      return row;
    });
  }

  applySummary(
    metrics: Record<string, any>,
    target: Record<string, any>,
    field: string,
    summary: string,
    value: number,
    countDelta = 1
  ) {
    if (!metrics[field]) metrics[field] = {};

    switch (summary) {
      case "sum":
        metrics[field][summary] =
          (metrics[field][summary] ?? 0) + value;
        break;

      case "max":
        metrics[field][summary] =
          metrics[field][summary] === undefined
            ? value
            : Math.max(metrics[field][summary], value);
        break;

      case "min":
        metrics[field][summary] =
          metrics[field][summary] === undefined
            ? value
            : Math.min(metrics[field][summary], value);
        break;

      case "count":
        metrics[field][summary] =
          (metrics[field][summary] ?? 0) + countDelta;
        break;

      case "mean": {
        const countKey = `__${field}_meanCount`;
        const count = target[countKey] ?? 0;
        metrics[field][summary] =
          count === 0
            ? value / countDelta
            : (metrics[field][summary] * count + value) /
              (count + countDelta);
        target[countKey] = count + countDelta;
        break;
      }

      case "distinct": {
        const setKey = `__${field}_distinctSet`;
        let set: Set<any> = target[setKey];

        if (!set) {
          set = new Set();
          target[setKey] = set;
        }

        set.add(value);
        metrics[field][summary] = set.size;
        break;
      }

      default:
        if (metrics[field][summary] === undefined) {
          metrics[field][summary] = value;
        }
    }
  }

  getMetric(row: any, dim: OptionFieldValue) {
    if (!row || !dim || !dim.uid) return undefined;

    const uid = dim.uid[2];
    const summary = dim.summary || "none";

    if (row._metrics?.[uid]?.[summary] !== undefined) {
      return row._metrics[uid][summary];
    }

    // fallback：无聚合时直接取原始值
    return row[uid];
  }

  getMetricFieldKey(
    dim: OptionFieldValue,
    xDims?: OptionFieldValue[]
  ) {
    const uid = dim.uid[2];
    const summary = dim.summary || "none";

    // x 轴同字段，需要区分 summary
    const conflictWithX = xDims?.some(x => x.uid[2] === uid);

    return conflictWithX && summary !== "none"
      ? `${uid}_${summary}`
      : uid;
  }

  writeMetricToRow(
    row: any,
    dim: OptionFieldValue,
    xDims?: OptionFieldValue[]
  ) {
    const key = this.getMetricFieldKey(dim, xDims);
    const value = this.getMetric(row, dim);
    row[key] = value;
    return value;
  }

  flatDataset(sourceData: Row[], flatUIDS: string[]) {
    let subFormField;
    for (const uid of flatUIDS) {
      const uids = uid.split(".");
      if (uids.length > 1) {
        subFormField = uids[0];
        break;
      }
    }
    if (!subFormField) return sourceData;

    return sourceData.map(row => {
      const subRows = row[subFormField];
      return subRows?.map(subRow => {
        for (const uid of flatUIDS) {
          const uids = uid.split(".");
          if (uids.length > 1) {
            subRow[uid] = subRow[uids[1]];
          } else {
            subRow[uid] = row[uid];
          }
        }
        return subRow;
      }) ?? [];
    }).flat();
  }

  private getAxisFieldUids(subType: "account" | "department"): string[] {
    const axisValues = this.getMetaData()?.axisValue ?? [];

    return axisValues.reduce<string[]>((res, axis) => {
      const field = this.getField(axis.uid);
      if (field?.meta?.subType === subType) {
        res.push(axis.uid[2])
      }

      return res;
    }, []);
  }

  async deferReplaceMemberName(dataSource: any[]) {
    const memberFields = this.getAxisFieldUids("account");
    const departmentFields = this.getAxisFieldUids("department");

    if (memberFields.length || departmentFields.length) {
      if (memberFields.length) {
        const users = await this.getBoard().getOrganizeUsers();
        for (const row of dataSource) {
          for (const fieldUID of memberFields) {
            const userUID = row[fieldUID]?.[0];
            const user = users.find(user => user.id === userUID);
            if (user) {
              row[fieldUID] = `${user.realname}${row[fieldUID].length > 1 ? i18next.t("more") : ""}`;
            }
          }
        }
      }

      if (departmentFields.length) {
        const departments = await this.getBoard().getOrganizeDepartments();
        for (const row of dataSource) {
          for (const fieldUID of departmentFields) {
            const departmentUID = row[fieldUID]?.[0];
            const department = departments.find(department => department.id === departmentUID);
            if (department) {
              row[fieldUID] = `${department.name}${row[fieldUID].length > 1 ? i18next.t("more") : ""}`;
            }
          }
        }
      }
    }
  }

  checkErrorData() {}

  addErrorDataStatus(type: "filed-empty" | "filed-incomplete" | "data-error"){
    this.status.error.data = [{ key: undefined, type: type }];
  }

  clearErrorDataStatus() {
    let newItems = [];
    if(this.status.error?.data?.length) {
      this.status.error.data.forEach(item=>{
        if(["filed-empty", "filed-incomplete", "data-error"].indexOf(item.type) === -1) {
          newItems.push(item);
        }
      });
    }
    this.status.error.data = newItems;
  }

  get transposed(){
    return false;
  }

  getDataAfterSort(dataSource) {
    this.originDataSource = JSON.parse(JSON.stringify(dataSource));
    let sortUid = this.getOption<string>("fields-data-sort-fields");
    let sortType = this.getOption("fields-data-sort-orderby");
    if(sortUid){
      // if (this.transposed) {
      //   if (sortType === "ASC") {
      //     sortType = "DESC";
      //   } else {
      //     sortType = "ASC";
      //   }
      // }
      dataSource = dataSource.sort((a,b)=>{
        const aSortData = a._metrics?.[sortUid];
        const bSortData = b._metrics?.[sortUid];
        let aValue = aSortData ? aSortData[Object.keys(aSortData)[0]] : a[sortUid];
        let bValue = bSortData ? bSortData[Object.keys(bSortData)[0]] : b[sortUid];
        if(aValue == undefined && bValue == undefined) return 0;
        if(!isNaN(aValue) && !isNaN(bValue)){
          if(sortType === SortType.ASC){
            return aValue - bValue;
          }else {
            return bValue - aValue;
          }
        }else {
          if(sortType === SortType.ASC){
            return aValue.localeCompare(bValue, "zh");
          }else {
            return bValue.localeCompare(aValue, "zh");
          }
        }
      });
    }

    //数据筛选
    // dataSource = this.getDataAfterFilter(dataSource);
    // let fieldUid = this.getOption<string>(["sort-object"])
    // if(fieldUid !== 'toChoose' && this.getOption(["sort-type"]) !== 'normal'){
    //   for (let index = 0; index < this.originDataSource.length; index++) {
    //     dataSource.forEach((source,i) => {
    //       if(this.originDataSource[index][fieldUid] == source[fieldUid]){
    //          this.dataSortMap.set(i,index);
    //       }
    //     });
    //   }
    // }else{
    //   dataSource.forEach((source,i) => {
    //     this.dataSortMap.set(i,i);
    //   });
    // }

    return dataSource;
  }

  private _dataChangeTime = ref(0);

  get dataChangeTime() {
    return this._dataChangeTime.value;
  }

  set dataChangeTime(val) {
    this._dataChangeTime.value = val;
  }

  private _dataSource: Ref<any[]> = ref(undefined);
  public lastestData = null;
  public _firstLoadData = true;
  datasetSource() {
    if (this._dataSource.value === undefined) {
      this.effectScope.run(()=>{
        watch(()=>{
          if(this.status.isVisible || this._firstLoadData || !this._dataSource.value) {
            return this._datasetSource();
          } else {
            return this.lastestData || this._dataSource.value || [];
          }
        }, async (value)=>{

          if((this._firstLoadData || this.status.isVisible) && JSON.stringify(value) !== JSON.stringify(this._dataSource.value)) {
            this._firstLoadData = false;
            this._dataSource.value = value;
            this.dataChangeTime = Date.now();
            this.lastestData = null;
          } else {
            this.lastestData = value;
          }
        }, {immediate: true});
      });
    }
    return this._dataSource.value || [];
  }

  private _series = ref(undefined);
  private lastestSeries = null;
  private _firstLoadSeries = true;
  getSeries() {
    if (this._series.value === undefined) {
      this.effectScope.run(()=>{
        watch(()=>{
          if(!this.status.isVisible && this._series.value !== undefined) {
            return this._series.value;
          }
          return this._getSeries();
        }, (value)=>{
          if((this.status.isVisible || this._firstLoadSeries) && JSON.stringify(value) !== JSON.stringify(this._series.value)) {
            this._firstLoadSeries = false;
            this._series.value = value;
            this.lastestSeries = null;
          } else {
            this.lastestSeries = value;
          }
        }, {immediate: true});
      });
    }
    return this._series.value;
  }

  _getSeries(){
    return [];
  }

  _datasetSource():any {
    return [
      { value: 20, name: i18next.t("exampleOne") },
      { value: 70, name: i18next.t("exampleTwo") },
      { value: 45, name: i18next.t("exampleThree") },
      { value: 66, name: i18next.t("exampleFour") },
      { value: 32, name: i18next.t("exampleFive") },
      { value: 83, name: i18next.t("exampleSix") }
    ]
  }

  getPrivateFieldTypeUids() {
    let privateData = this.getPrivateData();
    let strFieldUids = [];
    let numberFieldUids = [];
    privateData?.fields?.forEach((field)=>{
      if(!field?.type || !field?.uid) return;
      if(field.type == "string"){
        strFieldUids.push(field.uid);
      }else if(field.type == "number"){
        numberFieldUids.push(field.uid);
      }
    });
    return {
      number: numberFieldUids,
      string: strFieldUids
    }
  }

  echartsDatasetOption(): DatasetComponentOption | DatasetComponentOption[] {
    let source = this.datasetSource();
    let datasetResult: DatasetComponentOption | DatasetComponentOption[] = [{ source }];
    return datasetResult;
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
    };
  }
  get echartsOption(): EChartsOption {
    const funcs = this.echartsOptionFunc;
    const option: EChartsOption = {};
    for (const key in funcs) {
      option[key] = funcs[key]();
    }
    return option;
  }

  getSerieEchartsColors(optionKey:any = "palette") {
    let colors = this.getOption<Color[]>(optionKey);
    if (!colors || colors.length == 0) {
      return this.defaultColors10;
    } else {
      return Array.from(colors).map((color) => {
        return new Color(color).toEchartsColor();
      });
    }
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

  toEchartsColor(color: Color):any {
    return new Color(color).toEchartsColor();
  }

  resetChartOption(loaded?: boolean) {
    if(loaded) {
      this.echartsLoaded = true;
    }
    if(!this.echartsLoaded) return;
    this.stopAnimationDisplay();
    this.initFinishedEvent();
    this.clearChart();
    this.echartsChart.setOption(this.echartsOption, true);
  }

  initFinishedEvent(){
    this.echartsChart.on("finished", () => {
      this.startAnimationDisplay();
      this.echartsChart.off("finished");
    })
  }

  clearChart() {}

  initEchartsEvents() { }

  registerEchartsMap(mapName, mapData) {
    if(!echarts.getMap(mapName)){
      echarts.registerMap(mapName, mapData);
    }
  }

  addEchartsShapes(echarts) {}

  addEchartsDatasetTransform(echarts) {}

  initEchartsInstances() {
    const renderer = this.getOption("echarts-renderer");
    this.echartsChart = echarts.init(this.echartsElement, null, { renderer });
  }

  initChart() {
    this.initEchartsInstances();
    this.loadEcharts(echarts);
    this.initOptionWatch();
  }

  loadEcharts(chartLib=echarts) {
    this.addEchartsShapes(chartLib);
    this.addEchartsDatasetTransform(chartLib);
    this.resetChartOption(true);
    this.initEchartsEvents();
  }

  initOptionWatch() { // 这个方法在donut重写了 有更新注意看一下要不要同步过去
    let penddingOpt = {};
    for (let key in this.echartsOptionFunc) {
      this.effectScope.run(() => {
        watch(() => {
          return {
            option: this.echartsOptionFunc[key](),
            data: this._dataSource.value,
          }
        }, (val: any, oldVal) => {
          if (!this.status.isVisible) {
            penddingOpt[key] = val.option;
            return;
          }
          let newOpt = {};
          newOpt[key] = val.option;
          // 会触发多次，用 lazyUpdate: true 做优化
          if(key === "color" || (key.startsWith("animation") && typeof val.option !== "object")) {
            this.echartsChart.setOption(newOpt, {
              notMerge: false,
              lazyUpdate: true
            });
          } else {
            if(this?.isResourceLoading) return;
            if(key === "grid3D" && JSON.stringify(val.option) === JSON.stringify(oldVal?.option)) return;
            this.echartsChart.setOption(newOpt, {
              notMerge: false,
              replaceMerge: key,
              lazyUpdate: true
            });
          }
        })
      })
    }
    // serise和datasetSource都需要处理
    watch(() => this.status.isVisible, (val)=>{
      if(val) {
        if (Object.keys(penddingOpt).length > 0) {
          this.echartsChart.setOption(penddingOpt);
          penddingOpt = {};
        }
        if(this.lastestData && JSON.stringify(this.lastestData) !== JSON.stringify(this._dataSource.value)) {
          this._dataSource.value = this.lastestData;
          this.dataChangeTime = Date.now();
          this.lastestData = null;
        }
        if(this.lastestSeries && JSON.stringify(this.lastestSeries) !== JSON.stringify(this._series.value)) {
          this._series.value = this.lastestSeries;
          this.lastestSeries = null;
        }
      }
    }, {immediate: true});

    watch(()=>this.animationTriggerLinkage, (val)=>{
      if(!val){
        this.withdrawLinkage();
      }
    })

    watch(() => this.getMetaData(), (val) => {
      let selectFiedlInAxis = false;
      for (const item of val.axisValue) {
        if (item.uid[2] === this.formDataSortFields) {
          selectFiedlInAxis = true;
          break;
        }
      }
      // 选中的排序字段不在axis中时清除选中
      if (!selectFiedlInAxis) {
        this.setOption("fields-data-sort-fields", null);
      }
    })
  }

  bindChartEl(echartsRef: HTMLDivElement) {
    this.echartsElement = echartsRef;
  }

  getMountedInstance(): ECharts {
    return this.echartsChart;
  }

  destroy() {
    this.clearAnimation();
    super.destroy();
  }

  isDestroyed() {
    return this.destroyed === true;
  }



  setAnimationDisplayPaused(state = false){
    this.animation_display_paused = state;
  }

  // 动画部分
  startAnimationDisplay() {
    if (!this.hasAnimationDisplay()) {
      return;
    }

    this.setAnimationDisplayPaused(false);
    if (!this.animation_display_loop_id) {
      this.animation_display_loop_id = 0;
    }
    this.animation_display_loop_id++;
    this.animationDisplayLoop(this.animation_display_loop_id, true);
  }

  stopAnimationDisplay() {
    if(this._dataSource?.value?.length){
      this._dataSource.value.forEach((data,index) => {
        try {
          this.echartsChart.dispatchAction({ type: "unselect", dataIndex: index })
        } catch (error) {
          console.log('echarts basic stopAnimationDisplay error:', error)
        }
      });
    }
    this.clearAnimation();
  }

  clearAnimation() {
    clearInterval(this.animation_display_timeout);
    if (this.animation_display_loop_id) {//旧的展示设置循环需要停掉
      this.animation_display_loop_id++;
    }
    this.b2_animators = []; //直接清空数组是否会造成promise内存泄漏
  }

  animationDisplayLoop(loop_id, first = false) {
    /* IFTRUE_WEBDEBUGGER $cfra$$(Date.now()+";debugger") FITRUE_WEBDEBUGGER*/
    if (this.isDestroyed()) {
      return;
    }
    if (loop_id !== this.animation_display_loop_id) {
      return;
    }
    if (!this.status.isVisible) {
      setTimeout(() => {
        this.animationDisplayLoop(loop_id, first);
      }, 1000);
      return;
    }
    this.prepareAnimationDisplay();
    let delay = first ? this.getAnimationDisplayDelay() : 0;
    this.delay(delay).then(() => {
      if (loop_id !== this.animation_display_loop_id) {
        return;
      }
      this.beginAnimationDisplay();
      if (this.isAnimationDisplayLoop()) {
        this.allAnimationResolved().then(() => {
          this.delay(this.getAnimationDisplayInterval()).then(() => {
            let check_next_loop = () => {
              if (this.animation_display_paused) {
                setTimeout(check_next_loop, 100);
              } else {
                setTimeout(() => {
                  this.animationDisplayLoop(loop_id);
                }, 0);
              }
            };
            check_next_loop();
          });
        })
      }
    });
  }


  hasAnimationDisplay() {
    return this.getOption("animation-display");
  }

  prepareAnimationDisplay() {
    this.resetAnimation();
  }

  resetAnimation() {
  }

  getAnimationDisplayDelay() {
    return Math.max(0, this.getOption("animation-display-delay")) * 1000;
  }

  getAnimationDisplayDuration() {
    return Math.max(0, this.getOption("animation-display-duration")) * 1000;
  }

  beginAnimationDisplay() {
  }

  isAnimationDisplayLoop() {
    return this.getOption("animation-display-loop");
  }

  getAnimationDisplayInterval() {
    return Math.max(0, this.getOption("animation-display-interval")) * 1000;
  }

  allAnimationResolved() {
    let promsies = [];
    for (let animator of this.b2_animators || []) {
      promsies.push(animator.then((result) => { return result }));
    }
    return Promise.all(promsies);
  }

  delay = function (delay) {
    if (delay <= 0) return Promise.resolve();
    return new Promise(function (resovle) {
      setTimeout(resovle, delay);
    });
  }

  restartAnimationDisplay(){}

  get basePadding() {
    return {
      left: 20,
      right: 20,
      top: 20,
      bottom: 20
    }
  }

  get defaultPadding() {
    // 处理有无标题、图例的通用间距
    const padding = this.basePadding
    if (this.widgetTitleEnabled) padding.top = 10;

    let legend = this.getOption<boolean>("legend");
    if (legend) {
      let legendPosition = this.getOption<string>("legend-position");
      if (legendPosition.startsWith("left")) padding.left += 60;
      else if (legendPosition.startsWith("right")) padding.right += 40;
      else if (legendPosition.startsWith("top")) padding.top += 24;
      else if (legendPosition.startsWith("bottom")) padding.bottom += 24;
    }

    return padding;
  }

  get defaultLegendPadding() {
    return {
      left: 14,
      right: 14,
      top: this.widgetTitleEnabled ? 4 : 12,
      bottom: 8
    }
  }

  override getOption<T extends OptionValue>(paths: string | string[], options?: GetOptionOptions): T {
    if (paths === "echarts-renderer") {
      return "canvas" as T;
    }
    return super.getOption<T>(paths, options);
  }
}
