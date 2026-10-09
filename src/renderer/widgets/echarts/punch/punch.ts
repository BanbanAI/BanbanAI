import { PrivateData, PrivateDataConnectionUID, PrivateDataTableUID, OptionFieldUID } from "@common/types/project";
import { DefinedOptions, OptionFieldValue, OptionFontValue, OptionFileValue, WidgetMetaData, ChartClickState } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { TheWidget as EchartsChart, component as B2Chart } from "@renderer/widgets/echarts/basic";
import { SeriesOption, EChartsOption, TooltipComponentOption, XAXisComponentOption, YAXisComponentOption } from "echarts/dist/echarts";
import { formatFloat } from "@common/utils/math";
import i18next from "@renderer/widgets/i18next";
import dayjs from "dayjs";
import weekOfYear from "dayjs/plugin/weekOfYear";
import { merge, recursive } from "merge";
import resource from "./locales";
import { Ref, ref } from "vue";

dayjs.extend(weekOfYear);

export class Punch extends EchartsChart {
  public valueMin:number = 0;
  public valueMax:number = 0;
  static resource = recursive(true, EchartsChart.resource, resource);
  static defineOptions(): DefinedOptions[] {
    return [
      {
        data: {
          fields: {
            children: [
              {
                name: "axis-date",
                alias: i18next.t("axis-date"),
                type: "field(max=1)",
                default: [{"uid":[PrivateDataConnectionUID,PrivateDataTableUID,"f_1"],"__opt_type":"field","summary":""}]
              },
              {
                name: "axis-value",
                alias: i18next.t("axis-value"),
                type: "field(aggs=sum|max|min|mean|count|distinct, max=1)",
                default: [{"uid":[PrivateDataConnectionUID,PrivateDataTableUID,"f_2"],"__opt_type":"field","summary":""}]
              },
              {
                name: "axis-fields",
                visible: false
              },
            ],
          },
        },
        style: {
          basic: {
            children: [
              {
                name: "year",
                type: "number",
                default: 2019,
                alias: i18next.t("year"),
              },
            ],
          },
          "axis": {
            visible: true,
            children: [
              {
                name: "x-display-cluster",
                alias: i18next.t("x-display"),
                show: "tab",
                children: [
                  {
                    name: "x-display",
                    alias: i18next.t("x-display"),
                    type: "boolean",
                    default: true,
                  },
                  {
                    name: "x-line-cluster",
                    alias: i18next.t("x-line-cluster"),
                    children: [

                      {
                        name: "x-line",
                        alias: i18next.t("x-line-cluster"),
                        type: "boolean",
                        default: true,
                      },
                      {
                        name: "x-line-type",
                        alias: i18next.t("x-line-type"),
                        type: "select(radioGroup)",
                        default: "solid",
                        selectChoices: [
                          {
                            value: "dashed",
                            label: i18next.t("dashed"),
                          },
                          {
                            value: "solid",
                            label: i18next.t("solid"),
                          },
                        ],
                        disabled: (widget: Punch) => {
                          return !widget.getOption("x-line");
                        },
                      },
                      {
                        name: "x-line-color",
                        alias: i18next.t("x-line-color"),
                        type: "color",
                        default: "#CCCCCC",
                        disabled: (widget: Punch) => {
                          return !widget.getOption("x-line");
                        },
                      },
                      {
                        name: "x-line-width",
                        alias: i18next.t("x-line-width"),
                        type: "number(unit=px)",
                        default: 1,
                        disabled: (widget: Punch) => {
                          return !widget.getOption("x-line");
                        },
                      },
                    ],
                  },
                  {
                    name: "x-tickline-cluster",
                    alias: i18next.t("x-tickline-cluster"),
                    children: [
                      {
                        name: "x-tickline",
                        alias: i18next.t("x-tickline-cluster"),
                        type: "boolean",
                        default: true,
                      },
                      {
                        name: "x-tickline-color",
                        alias: i18next.t("x-tickline-color"),
                        type: "color",
                        default: "#CCCCCC",
                        disabled: (widget: Punch) => {
                          return !widget.getOption("x-tickline");
                        },
                      },
                      {
                        name: "x-tickline-width",
                        alias: i18next.t("x-tickline-width"),
                        type: "number(unit=px)",
                        default: 2,
                        disabled: (widget: Punch) => {
                          return !widget.getOption("x-tickline");
                        },
                      },
                      {
                        name: "x-tickline-length",
                        alias: i18next.t("x-tickline-length"),
                        type: "number(unit=px)",
                        default: 5,
                        disabled: (widget: Punch) => {
                          return !widget.getOption("x-tickline");
                        },
                      },
                    ],
                  },
                  {
                    name: "x-label-cluster",
                    alias: i18next.t("x-label-cluster"),
                    children: [
                      {
                        name: "x-label",
                        alias: i18next.t("x-label-cluster"),
                        type: "boolean",
                        default: true,
                      },
                      {
                        name: "x-show-all-label",
                        alias: i18next.t("x-show-all-label"),
                        type: "boolean",
                        default: false,
                      },
                      {
                        name: "x-text-type",
                        alias: i18next.t("x-text-type"),
                        default: "normal",
                        type: "select(radioGroup)",
                        selectChoices: [
                          {
                            label: i18next.t("normal"),
                            value: "normal",
                          },
                          {
                            label: i18next.t("percent"),
                            value: "percent",
                          },
                        ],
                        disabled: (widget: Punch) => {
                          return !widget.getOption("x-label");
                        },
                        visible: (widget: Punch) => {
                          return widget.getOption("x-data-type") == "value";
                        },
                      },
                      {
                        name: "x-value-abbreviation",
                        alias: i18next.t("x-value-abbreviation"),
                        type: "select",
                        default: "0",
                        selectChoices: [
                          {
                            label: i18next.t("zore"),
                            value: "0",
                          },
                          {
                            label: i18next.t("thousand"),
                            value: "3",
                          },
                          {
                            label: i18next.t("ten_thousand"),
                            value: "4",
                          },
                          {
                            label: i18next.t("one_hundred_thousand"),
                            value: "5",
                          },
                          {
                            label: i18next.t("million"),
                            value: "6",
                          },
                          {
                            label: i18next.t("must"),
                            value: "7",
                          },
                          {
                            label: i18next.t("Billion"),
                            value: "8",
                          },
                        ],
                        disabled: (widget: Punch) => {
                          return !widget.getOption("x-label");
                        },
                        visible: (widget: Punch) => {
                          return (
                            widget.getOption("x-text-type") === "normal" &&
                            widget.getOption("x-data-type") == "value"
                          );
                        },
                      },
                      {
                        name: "x-decimal-places",
                        alias: i18next.t("x-decimal-places"),
                        type: "number(unit=" + i18next.t("unit_wei") + ")",
                        default: 0,
                        disabled: (widget: Punch) => {
                          return !widget.getOption("x-label");
                        },
                        visible: (widget: Punch) => {
                          return widget.getOption("x-data-type") == "value";
                        },
                      },
                      {
                        name: "x-complete-zero",
                        alias: i18next.t("x-complete-zero"),
                        type: "boolean",
                        default: false,
                        disabled: (widget: Punch) => {
                          return !widget.getOption("x-label");
                        },
                        visible: (widget: Punch) => {
                          return widget.getOption("x-data-type") == "value";
                        },
                      },
                      {
                        name: "x-label-offset",
                        alias: i18next.t("x-label-offset"),
                        type: "number(unit=px)",
                        default: 10,
                        disabled: (widget: Punch) => {
                          return !widget.getOption("x-label");
                        },
                      },
                      {
                        name: "x-scale-range",
                        alias:i18next.t("x-scale-range"),
                        type: "select(radioGroup)",
                        default: "adaptive",
                        selectChoices: [
                          {
                            value: "adaptive",
                            label: i18next.t("adaptive"),
                          },
                          {
                            value: "custom",
                            label: i18next.t("custom"),
                          },
                        ],
                        disabled: (widget: Punch) => {
                          return !widget.getOption("x-label");
                        },
                        visible: (widget: Punch) => {
                          return (
                            widget.getOption("x-data-type") === "value"
                          );
                        },
                      },
                      {
                        name: "x-scale-min",
                        alias: i18next.t("x-scale-min"),
                        type: "number<float>",
                        default: 0,
                        disabled: (widget: Punch) => {
                          return !widget.getOption("x-label");
                        },
                        visible: (widget: Punch) => {
                          return (
                            widget.getOption("x-data-type") === "value" &&
                            widget.getOption("x-scale-range") === "custom"
                          );
                        },
                      },
                      {
                        name: "x-scale-max",
                        alias: i18next.t("x-scale-max"),
                        type: "number<float>",
                        default: 100,
                        disabled: (widget: Punch) => {
                          return !widget.getOption("x-label");
                        },
                        visible: (widget: Punch) => {
                          return (
                            widget.getOption("x-data-type") === "value" &&
                            widget.getOption("x-scale-range") === "custom"
                          );
                        },
                      },
                      {
                        name: "x-scale-interval",
                        alias: i18next.t("x-scale-interval"),
                        type: "number(unit=" + i18next.t("unit_ge") + ")",
                        default: 50,
                        visible: (widget: Punch) => {
                          return widget.getOption("x-scale-range") == "custom";
                        },
                      },
                      {
                        name: "x-font",
                        alias: i18next.t("x-font"),
                        type: "font",
                        default: {
                          family: "sans-serif",
                          size: 12,
                          bold: false,
                          italic: false,
                          underline: false,
                          deleteline: false,
                        },
                        disabled: (widget: Punch) => {
                          return !widget.getOption("x-label");
                        },
                      },
                      {
                        name: "x-display-shadow-color",
                        alias: i18next.t("x-display-shadow-color"),
                        type: "color",
                        default: "#ffffff",
                        disabled: (widget: Punch) => {
                          return !widget.getOption("x-label");
                        },
                      },
                      {
                        name: "x-display-shadow-blur",
                        alias: i18next.t("x-display-shadow-blur"),
                        type: "number(unit=px)",
                        default: 0,
                        disabled: (widget: Punch) => {
                          return !widget.getOption("x-label");
                        },
                      },
                      {
                        name: "x-display-shadow-offset-x",
                        alias: i18next.t("x-display-shadow-offset-x"),
                        type: "number(unit=px)",
                        default: 0,
                        disabled: (widget: Punch) => {
                          return !widget.getOption("x-label");
                        },
                      },
                      {
                        name: "x-display-shadow-offset-y",
                        alias: i18next.t("x-display-shadow-offset-y"),
                        type: "number(unit=px)",
                        default: 0,
                        disabled: (widget: Punch) => {
                          return !widget.getOption("x-label");
                        },
                      },
                      {
                        name: "x-rotate",
                        alias:  i18next.t("x-rotate"),
                        type: "select",
                        default: "0",
                        disabled: (widget: Punch) => {
                          return !widget.getOption("x-label");
                        },
                        selectChoices: [
                          {
                            value: "0",
                            label: i18next.t("rotateZore"),
                          },
                          {
                            value: "-90",
                            label: "90°",
                          },
                          {
                            value: "-45",
                            label: "45°",
                          },
                          {
                            value: "45",
                            label: "-45°",
                          },
                          {
                            value: "90",
                            label: "-90°",
                          },
                        ],
                      },
                    ],
                  },
                  {
                    name: "x-unit-cluster",
                    alias: i18next.t("x-unit-cluster"),
                    children: [
                      {
                        name: "x-unit",
                        alias:i18next.t("x-unit"),
                        type: "boolean",
                        default: false,
                      },
                      {
                        name: "x-unit-text",
                        alias: i18next.t("x-unit-text"),
                        type: "string",
                        disabled: (widget: Punch) => {
                          return !widget.getOption("x-unit");
                        },
                      },
                      {
                        name: "x-unit-font",
                        alias: i18next.t("x-unit-font"),
                        type: "font",
                        default: {
                          family: "sans-serif",
                          size: 12,
                          bold: false,
                          italic: false,
                          underline: false,
                          deleteline: false,
                        },
                        disabled: (widget: Punch) => {
                          return !widget.getOption("x-unit");
                        },
                      },
                      {
                        name: "x-nameGap",
                        alias: i18next.t("x-nameGap"),
                        type: "number(unit=px)",
                        default: 0,
                        disabled: (widget: Punch) => {
                          return !widget.getOption("x-unit");
                        },
                      },
                    ],
                  },
                ],
              },
              {
                name: "y-display-cluster",
                alias: i18next.t("y-display"),
                show: "tab",
                children: [
                  {
                    name: "y-display",
                    alias: i18next.t("y-display"),
                    type: "boolean",
                    default: true,
                  },
                  {
                    name: "y-line-cluster",
                    alias:  i18next.t("y-line-cluster"),
                    children: [
                      {
                        name: "y-line",
                        alias: i18next.t("y-line-cluster"),
                        type: "boolean",
                        default: true,
                      },
                      {
                        name: "y-line-type",
                        alias: i18next.t("y-line-type"),
                        type: "select(radioGroup)",
                        default: "solid",
                        selectChoices: [
                          {
                            value: "dashed",
                            label: i18next.t("dashed"),
                          },
                          {
                            value: "solid",
                            label: i18next.t("solid"),
                          },
                        ],
                        disabled: (widget: Punch) => {
                          return !widget.getOption("y-line");
                        },
                      },
                      {
                        name: "y-line-color",
                        alias: i18next.t("y-line-color"),
                        type: "color",
                        default: "#CCCCCC",
                        disabled: (widget: Punch) => {
                          return !widget.getOption("y-line");
                        },
                      },
                      {
                        name: "y-line-width",
                        alias: i18next.t("y-line-width"),
                        type: "number(unit=px)",
                        default: 1,
                        disabled: (widget: Punch) => {
                          return !widget.getOption("y-line");
                        },
                      },
                    ],
                  },
                  {
                    name: "y-tickline-cluster",
                    alias: i18next.t("y-tickline-cluster"),
                    children: [
                      {
                        name: "y-tickline",
                        alias: i18next.t("y-tickline-cluster"),
                        type: "boolean",
                        default: true,
                      },
                      {
                        name: "y-tickline-color",
                        alias: i18next.t("y-tickline-color"),
                        type: "color",
                        default: "#CCCCCC",
                        disabled: (widget: Punch) => {
                          return !widget.getOption("y-tickline");
                        },
                      },
                      {
                        name: "y-tickline-width",
                        alias: i18next.t("y-tickline-width"),
                        type: "number(unit=px)",
                        default: 2,
                        disabled: (widget: Punch) => {
                          return !widget.getOption("y-tickline");
                        },
                      },
                      {
                        name: "y-tickline-length",
                        alias: i18next.t("y-tickline-length"),
                        type: "number(unit=px)",
                        default: 5,
                        disabled: (widget: Punch) => {
                          return !widget.getOption("y-tickline");
                        },
                      },
                    ],
                  },
                  {
                    name: "y-label-cluster",
                    alias:  i18next.t("y-label-cluster"),
                    children: [
                      {
                        name: "y-label",
                        alias: i18next.t("y-label-cluster"),
                        type: "boolean",
                        default: true,
                      },
                      {
                        name: "y-label-position",
                        alias: i18next.t("y-label-position"),
                        type: "select(radioGroup)",
                        default: "outside",
                        selectChoices: [
                          {
                            value: "outside",
                            label: i18next.t("y-label-position"),
                          },
                          {
                            value: "above",
                            label: i18next.t("above"),
                          },
                        ],
                        visible: (widget: Punch) => {
                          return widget.transposed;
                        },
                      },
                      {
                        name: "y-value-abbreviation",
                        alias: i18next.t("y-value-abbreviation"),
                        type: "select",
                        default: "0",
                        selectChoices: [
                          {
                            label: i18next.t("zore"),
                            value: "0",
                          },
                          {
                            label: i18next.t("thousand"),
                            value: "3",
                          },
                          {
                            label: i18next.t("ten_thousand"),
                            value: "4",
                          },
                          {
                            label: i18next.t("one_hundred_thousand"),
                            value: "5",
                          },
                          {
                            label: i18next.t("million"),
                            value: "6",
                          },
                          {
                            label: i18next.t("must"),
                            value: "7",
                          },
                          {
                            label: i18next.t("Billion"),
                            value: "8",
                          },
                        ],
                        disabled: (widget: Punch) => {
                          return !widget.getOption("y-label");
                        },
                        visible: (widget: Punch) => {
                          return (
                            widget.getOption("y-text-type") === "normal" &&
                            widget.getOption("y-data-type") == "value"
                          );
                        },
                      },
                      {
                        name: "y-decimal-places",
                        alias: i18next.t("y-decimal-places"),
                        type: "number(unit=" + i18next.t("unit_wei") + ")",
                        default: 0,
                        disabled: (widget: Punch) => {
                          return !widget.getOption("y-label");
                        },
                        visible: (widget: Punch) => {
                          return  widget.getOption("y-data-type") == "value";
                        },
                      },
                      {
                        name: "y-complete-zero",
                        alias: i18next.t("y-complete-zero"),
                        type: "boolean",
                        default: false,
                        disabled: (widget: Punch) => {
                          return !widget.getOption("y-label");
                        },
                        visible: (widget: Punch) => {
                          return  widget.getOption("y-data-type") == "value";
                        },
                      },
                      {
                        name: "y-label-offset",
                        alias: i18next.t("y-label-offset"),
                        type: "number(unit=px)",
                        default: 10,
                        disabled: (widget: Punch) => {
                          return !widget.getOption("y-label");
                        },
                      },
                      {
                        name: "y-scale-range",
                        alias: i18next.t("y-scale-range"),
                        type: "select(radioGroup)",
                        default: "adaptive",
                        selectChoices: [
                          {
                            value: "adaptive",
                            label: i18next.t("adaptive"),
                          },
                          {
                            value: "custom",
                            label: i18next.t("custom"),
                          },
                        ],
                        disabled: (widget: Punch) => {
                          return !widget.getOption("y-label");
                        },
                        visible: (widget: Punch) => {
                          return widget.getOption("y-data-type") === "value";
                        },
                      },
                      {
                        name: "y-scale-min",
                        alias: i18next.t("y-scale-min"),
                        type: "number<float>",
                        default: 0,
                        visible: (widget: Punch) => {
                          return widget.getOption("y-scale-range") == "custom";
                        },
                      },
                      {
                        name: "y-scale-max",
                        alias: i18next.t("y-scale-max"),
                        type: "number<float>",
                        default: 100,
                        visible: (widget: Punch) => {
                          return widget.getOption("y-scale-range") == "custom";
                        },
                      },
                      {
                        name: "y-font",
                        alias: i18next.t("y-font"),
                        type: "font",
                        default: {
                          family: "sans-serif",
                          size: 12,
                          bold: false,
                          italic: false,
                          underline: false,
                          deleteline: false,
                        },
                        disabled: (widget: Punch) => {
                          return !widget.getOption("y-label");
                        },
                      },
                      {
                        name: "y-display-shadow-color",
                        alias: i18next.t("y-display-shadow-color"),
                        type: "color",
                        default: "#ffffff",
                        disabled: (widget: Punch) => {
                          return !widget.getOption("y-label");
                        },
                      },
                      {
                        name: "y-display-shadow-blur",
                        alias: i18next.t("y-display-shadow-blur"),
                        type: "number(unit=px)",
                        default: 0,
                        disabled: (widget: Punch) => {
                          return !widget.getOption("y-label");
                        },
                      },
                      {
                        name: "y-display-shadow-offset-x",
                        alias: i18next.t("y-display-shadow-offset-x"),
                        type: "number(unit=px)",
                        default: 0,
                        disabled: (widget: Punch) => {
                          return !widget.getOption("y-label");
                        },
                      },
                      {
                        name: "y-display-shadow-offset-y",
                        alias: i18next.t("y-display-shadow-offset-y"),
                        type: "number(unit=px)",
                        default: 0,
                        disabled: (widget: Punch) => {
                          return !widget.getOption("y-label");
                        },
                      },
                      {
                        name: "y-rotate",
                        alias: i18next.t("y-rotate"),
                        type: "select",
                        default: "0",
                        disabled: (widget: Punch) => {
                          return !widget.getOption("y-label");
                        },
                        selectChoices: [
                          {
                            value: "0",
                            label: i18next.t("rotateZore"),
                          },
                          {
                            value: "-90",
                            label: "90°",
                          },
                          {
                            value: "-45",
                            label: "45°",
                          },
                          {
                            value: "45",
                            label: "-45°",
                          },
                          {
                            value: "90",
                            label: "-90°",
                          }
                        ],
                      },
                    ],
                  },
                  {
                    name: "y-unit-cluster",
                    alias: i18next.t("y-unit-cluster"),
                    children: [
                      {
                        name: "y-unit",
                        alias: i18next.t("y-unit-cluster"),
                        type: "boolean",
                        default: false,
                      },
                      {
                        name: "y-unit-text",
                        alias: i18next.t("y-unit-text"),
                        type: "string",
                        disabled: (widget: Punch) => {
                          return !widget.getOption("y-unit");
                        },
                      },
                      {
                        name: "y-unit-font",
                        alias: i18next.t("y-unit-font"),
                        type: "font",
                        default: {
                          family: "sans-serif",
                          size: 12,
                          bold: false,
                          italic: false,
                          underline: false,
                          deleteline: false,
                        },
                        disabled: (widget: Punch) => {
                          return !widget.getOption("y-unit");
                        },
                      },
                      {
                        name: "y-nameGap",
                        alias: i18next.t("y-nameGap"),
                        type: "number(unit=px)",
                        default: 15,
                        disabled: (widget: Punch) => {
                          return !widget.getOption("y-unit");
                        },
                      },
                    ],
                  },
                ],
              }
            ]
          },
          "series-shape": {
            alias: i18next.t("series-shape"),
            children: [
              {
                name: "bubble-size-min",
                type: "number(min=1,unit=px)",
                default: 1,
                alias: i18next.t("bubble-size-min"),
              },
              {
                name: "bubble-size-max",
                type: "number(min=1,unit=px)",
                default: 10,
                alias: i18next.t("bubble-size-max"),
              },
              {
                name: "bubble-outline-width",
                type: "number(unit=px, min=0)",
                default: 0,
                alias: i18next.t("bubble-outline-width"),
              },
              {
                name: "bubble-outline-color",
                type: "color",
                default: "#1890FF",
                alias: i18next.t("bubble-outline-color"),
              },
              {
                name: "bubble-display-shadow-color",
                alias: i18next.t("bubble-display-shadow-color"),
                type: "color",
                default: "#ffffff",
              },
              {
                name: "bubble-display-shadow-blur",
                alias: i18next.t("bubble-display-shadow-blur"),
                type: "number(unit=px)",
                default: 0,
              },
              {
                name: "bubble-display-shadow-offset",
                alias: i18next.t("bubble-display-shadow-offset"),
                type: "number(unit=px)",
                default: 0,
              },
              {
                name: "bubble-shadow-offset",
                alias: i18next.t("bubble-shadow-offset"),
                type: "number(unit=px)",
                default: 0,
              },
            ],
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
                  }
                ]
              }
            ]
          },
          legend: {
            visible: false,
            default: false,
          },
          sort: {
            visible: false,
          },
        },
      },
      ...super.defineOptions(),
    ];
  }

  protected getDefaultPrivateData(): PrivateData {
    return {
      fields: [
      {uid: "f_1", alias: "日期", type: "string"},
      {uid: "f_2", alias: "数值", type: "number"},
    ],
      rows: [
        { f_1: "2022-1-10", f_2: 1000 },
        { f_1: "2022-2-15", f_2: 859 },
        { f_1: "2022-3-20", f_2: 652 },
        { f_1: "2022-5-20", f_2: 222 },
        { f_1: "2022-7-5", f_2: 435 },
        { f_1: "2022-4-30", f_2: 789 },
        { f_1: "2022-6-12", f_2: 1500 },
        { f_1: "2022-8-17", f_2: 1120 },
        { f_1: "2022-9-8", f_2: 789 },
      ],
    };
  }

  checkErrorData() {
    let dateDims = this.getOption<OptionFieldValue[]>("axis-date");
    let valueDims = this.getOption<OptionFieldValue[]>("axis-value");
    if (dateDims?.length && valueDims?.length) {
      this.clearErrorDataStatus();
    } else {
      if(!dateDims?.length && !valueDims?.length) {
        this.addErrorDataStatus("filed-empty");
      } else {
        this.addErrorDataStatus("filed-incomplete");
      }
    }
  }

  _datasetSource() {
    this.valueMin = Infinity;
    this.valueMax = -Infinity;
    let dateDims = this.getOption<OptionFieldValue[]>("axis-date");
    let valueDims = this.getOption<OptionFieldValue[]>("axis-value");
    let newSource = [];
    if (dateDims?.length && valueDims?.length) {
      let source = this.createView(["axis-date", "axis-value"]);
      source = this.dealDataByAggregate(source,  [dateDims[0]], valueDims);
      source.forEach(row => {
        let dataItem = {};
        dataItem["date"] = row[dateDims[0].uid[2]];
        dataItem["value"] = this.getMetric(row, valueDims[0]);
        dataItem['self_row_data'] = row;
        this.valueMin = Math.min(this.valueMin, dataItem["value"]);
        this.valueMax = Math.max(this.valueMax, dataItem["value"]);
        newSource.push(dataItem);
      })
    }else{
      let privateData = this.getPrivateData();
      let fieldTypeUids = this.getPrivateFieldTypeUids();
      let dateUid = fieldTypeUids.string?.[0];
      let valueUid = fieldTypeUids.number?.[0];
      privateData.rows.forEach((row)=>{
        this.valueMin = Math.min(this.valueMin, row[valueUid]);
        this.valueMax = Math.max(this.valueMax, row[valueUid]);
        newSource.push({
          date: row[dateUid],
          value: row[valueUid],
          'self_row_data': row
        })
      });
    }

    let weekArr = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    const tempSource = newSource.map((dataItem)=> {
      let dayjsDate = dayjs(new Date(dataItem?.date));
      dataItem["weekday"] = weekArr[dayjsDate.day()];
      dataItem["week"] = dayjsDate.week();
      return dataItem;
    })

    return this.getDataAfterSort(tempSource);
  }

  getDataAfterSort(dataSource) {
    this.originDataSource = JSON.parse(JSON.stringify(dataSource));
    let sortUid = this.getOption<string>("fields-data-sort-fields");
    let sortType = this.getOption("fields-data-sort-orderby");
    if(sortUid){
      dataSource = dataSource.sort((a,b)=>{
        const aSortData = a.self_row_data?._metrics?.[sortUid];
        const bSortData = b.self_row_data?._metrics?.[sortUid];
        let aValue = aSortData ? aSortData[Object.keys(aSortData)[0]] : a.self_row_data[sortUid];
        let bValue = bSortData ? bSortData[Object.keys(bSortData)[0]] : b.self_row_data[sortUid];
        if(aValue == undefined && bValue == undefined) return 0;
        if(!isNaN(aValue) && !isNaN(bValue)){
          if(sortType === 1){
            return aValue - bValue;
          }else {
            return bValue - aValue;
          }
        }else {
          if(sortType === 1){
            return aValue.localeCompare(bValue, "zh");
          }else {
            return bValue.localeCompare(aValue, "zh");
          }
        }
      });
    }
    return dataSource;
  }

  get xGridLineOption(): XAXisComponentOption["splitLine"] {
    let dashWidth = this.getOption<number>("grid-x-line-dotted-width") || 2;
    return {
      show: this.getOption("grid-x-display"),
      lineStyle: {
        color: this.toEchartsColor(this.getOption("grid-x-line-color")),
        width: this.getOption("grid-x-line-width"),
        type: this.getOption("grid-x-line-type") === "line" ? "solid" : dashWidth,
      }
    }
  }

  get echartsXAxisOption(): XAXisComponentOption | XAXisComponentOption[] {
    let axisLabelFont = this.getOption<OptionFontValue>("x-font");
    let xIsPercent = this.getOption("x-text-type") === "percent";
    let xDecimalPlaces = Math.max(this.getOption("x-decimal-places"), 0);
    let xCompleteZero = this.getOption<boolean>("x-complete-zero");
    let valueAbb = this.getOption<string>("x-value-abbreviation");
    let xUnitFont = this.getOption<OptionFontValue>("x-unit-font");
    let axisOpt: any = {
      show: this.getOption<boolean>("x-display"),
      animation: false,
      animationDuration: 0,
      type: "value",
      logBase: this.getOption<number>("x-logBase"),
      boundaryGap: true,
      name: this.getOption<boolean>("x-unit") ? this.getOption<string>("x-unit-text") : "",
      nameGap: this.getOption<number>("x-nameGap"),
      nameTextStyle: {
        color: this.toEchartsColor(xUnitFont.color as Color),
        fontStyle: xUnitFont.italic ? "italic" : "normal",
        fontWeight: xUnitFont.bold ? "bold" : "normal",
        fontFamily: xUnitFont.family,
        fontSize: xUnitFont.size,
      },
      axisLine: { //轴线
        show: this.getOption<boolean>("x-line"),
        lineStyle: {
          color: this.toEchartsColor(this.getOption<Color>("x-line-color")),
          width: Math.max(this.getOption<number>("x-line-width"), 0),
          type: this.getOption<"dashed" | "solid">("x-line-type"),
          join: "miter"
        },
      },
      axisTick: {
        alignWithLabel: true,
        show: this.getOption<boolean>("x-tickline"),
        length: this.getOption<number>("x-tickline-length"),
        lineStyle: {
          width: this.getOption<number>("x-tickline-width"),
          color: this.toEchartsColor(this.getOption<Color>("x-tickline-color")),
        }
      },
      axisLabel: {
        show: this.getOption<boolean>("x-label"),
        margin: this.getOption<number>("x-label-offset"),
        fontStyle: axisLabelFont.italic ? "italic" : "normal",
        fontWeight: axisLabelFont.bold ? "bold" : "normal",
        fontSize: axisLabelFont.size,
        fontFamily: axisLabelFont.family,
        color: this.toEchartsColor(axisLabelFont.color as Color),
        textShadowColor: this.toEchartsColor(this.getOption<Color>("x-display-shadow-color")),
        textShadowBlur: this.getOption<number>("x-display-shadow-blur"),
        textShadowOffsetX: this.getOption<number>("x-display-shadow-offset-x"),
        textShadowOffsetY: this.getOption<number>("x-display-shadow-offset-y"),
        rotate: Number(this.getOption<string>("x-rotate")),
        interval: this.getOption("x-show-all-label") ? 0 : "auto",
      },
      splitLine: this.xGridLineOption
    }
    if (this.getOption("x-scale-range") === "custom") {
      axisOpt.min = this.getOption<number>("x-scale-min");
      axisOpt.max = this.getOption<number>("x-scale-max");
      axisOpt.interval = this.getOption("x-scale-interval");
    }

    if(!this.getOption<boolean>("x-display")){
      axisOpt.show = true
      axisOpt.axisLabel.show = false
      axisOpt.axisTick.show = false
      axisOpt.axisLine.show = false
    }

    return axisOpt
  }

  get yGridLineOption(): YAXisComponentOption["splitLine"] {
    let dashWidth = this.getOption<number>("grid-y-line-dotted-width") || 2;
    return {
      show: this.getOption("grid-y-display"),
      lineStyle: {
        color: this.toEchartsColor(this.getOption("grid-y-line-color")),
        width: this.getOption("grid-y-line-width"),
        type: this.getOption("grid-y-line-type") === "line" ? "solid" : dashWidth,
      }
    }
  }

  get echartsYAxisOption(): YAXisComponentOption | YAXisComponentOption[] {
      let axisLabelFont = this.getOption<OptionFontValue>(`y-font`);
      let yIsPercent = this.getOption(`y-text-type`) === "percent";
      let yDecimalPlaces = Math.max(this.getOption(`y-decimal-places`), 0);
      let yCompleteZero = this.getOption<boolean>(`y-complete-zero`);
      let valueAbb = this.getOption<string>(`y-value-abbreviation`);
      let yUnitFont = this.getOption<OptionFontValue>(`y-unit-font`);
      let labelAbove = this.getOption("y-label-position") === "above"?true:false;
      let axisOpt: any = {
        show: this.getOption<boolean>(`y-display`),
        animation: false,
        animationDuration: 0,
        type: "category",
        logBase: this.getOption<number>(`y-logBase`),
        boundaryGap: true,
        name: this.getOption<boolean>(`y-unit`) ? this.getOption<string>(`y-unit-text`) : "",
        nameGap: this.getOption<number>(`y-nameGap`),
        nameTextStyle: {
          color: this.toEchartsColor(yUnitFont.color as Color),
          fontStyle: yUnitFont.italic ? "italic" : "normal",
          fontWeight: yUnitFont.bold ? "bold" : "normal",
          fontFamily: yUnitFont.family,
          fontSize: yUnitFont.size,
        },
        axisLine: { //轴线
          show: this.getOption<boolean>(`y-line`),
            animation: false,
        animationDuration: 0,
          lineStyle: {
            color: this.toEchartsColor(this.getOption<Color>(`y-line-color`)),
            width: Math.max(this.getOption<number>(`y-line-width`), 0),
            type: this.getOption<"dashed" | "solid">(`y-line-type`),
            join: "miter"
          },
        },
        axisTick: {
          show: this.getOption<boolean>(`y-tickline`),
            animation: false,
        animationDuration: 0,
          alignWithLabel: true,
          length: this.getOption<number>(`y-tickline-length`),
          lineStyle: {
            width: this.getOption<number>(`y-tickline-width`),
            color: this.toEchartsColor(this.getOption<Color>(`y-tickline-color`)),
          }
        },
        axisLabel: {
          show: this.getOption<boolean>(`y-label`) && !labelAbove,
          animation: false,
          margin: this.getOption<number>(`y-label-offset`),
          fontStyle: axisLabelFont.italic ? "italic" : "normal",
          fontWeight: axisLabelFont.bold ? "bold" : "normal",
          fontSize: axisLabelFont.size,
          fontFamily: axisLabelFont.family,
          color: this.toEchartsColor(axisLabelFont.color as Color),
          textShadowColor: this.toEchartsColor(this.getOption<Color>(`y-display-shadow-color`)),
          textShadowBlur: this.getOption<number>(`y-display-shadow-blur`),
          textShadowOffsetX: this.getOption<number>(`y-display-shadow-offset-x`),
          textShadowOffsetY: this.getOption<number>(`y-display-shadow-offset-y`),
          rotate: Number(this.getOption<string>(`y-rotate`)),
        },
        splitLine: this.yGridLineOption,
        data: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"],
      }
      return axisOpt
  }

  get echartsOptionFunc(): {[key: string]: Function} {
    return {
      grid: ()=>this.echartsGridOption,
      tooltip: ()=>this.echartsTooltipOption,
      xAxis: ()=>this.echartsXAxisOption,
      yAxis: ()=>this.echartsYAxisOption,
      series: ()=>this.echartsSeriesOption,
      dataset: ()=>this.echartsDatasetOption(),
      color: ()=>this.getSerieEchartsColors()
    };
  }

  get echartsSeriesOption(): SeriesOption {
    //shape
    let borderColor = new Color(this.getOption<Color>("bubble-outline-color")).hexa();
    let borderSize = this.getOption<number>("bubble-outline-width");
    let minSize = this.getOption<number>("bubble-size-min");
    let maxSize = this.getOption<number>("bubble-size-max");
    let shadowBlur = this.getOption<number>("bubble-display-shadow-blur");
    let shadowColor = new Color(this.getOption<Color>("bubble-display-shadow-color")).hexa();
    let shadowOffsetX = this.getOption<number>("bubble-display-shadow-offset");
    let shadowOffsetY = this.getOption<number>("bubble-shadow-blur");
    let that = this;
    return {
      name: "value",
      type: "scatter",
      symbolSize: function (data) {
        return (data.value - that.valueMin) / (that.valueMax - that.valueMin) * (maxSize - minSize) + minSize + 2;
      },
      itemStyle: {
        borderColor: borderColor,
        borderWidth: borderSize,
        shadowBlur,
        shadowColor,
        shadowOffsetX,
        shadowOffsetY
      },
      colorBy: "data",
      encode: {
        x: "week",
        y: "weekday",
        value: "value"
      },
    }
  }

  get echartsTooltipOption(): TooltipComponentOption {
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
        let val = param.data["value"];
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
          <span style="color:${nameFontColor};font-size:${nameFontSize}px;line-height:1;">${param.data["date"]}：</span>
          <span style="color:${valueFontColor};font-size:${valueFontSize}px;line-height:1;">${val}</span>
        </div>`;

        return `
          <div>
            <div>${dataHtml}</div>
          </div>
        `;
      },
    }
  }

  get axisDate() {
    return this.getOption<OptionFieldValue[]>("axis-date") || [];
  }

  get axisValue() {
    return this.getOption<OptionFieldValue[]>("axis-value") || [];
  }

  override getMetaData() {
    return merge(super.getMetaData(), {
      axisValue: [
        ...this.axisDate,
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

        let uids = this.getOption("axis-date")?.[0]?.uid;
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
