import { DefinedOptions, OptionFieldValue, OptionFileValue, WidgetMetaData } from "@renderer/b2/types";
import { Widget } from "@renderer/b2/controllers/widget";
import { Color } from "@renderer/b2/color";
import { OptionFontValue } from "@renderer/b2/types";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { merge } from "merge";
import {
  evaluateBucketStageTableAggregateField,
  getTableAggregateFieldRows,
  shouldBypassSecondarySummary,
} from "../_common/tableAggregateField";
export class Trend extends Widget {
  toCssColor(color: Color) {
    return new Color(color).toCssString();
  }
  //css样式
  get trendStyle(): any {
    let iconColor;
    let iconSize;
    let valueColor;
    let valueSize;
    let valueFont;
    let iconMargin = this.getOption<number>("icon-margin");
    let trendPosition = this.getOption("font-position");
    let unitOffsetx = this.getOption("unit-offsetX");
    let unitOffsety = this.getOption("unit-offsetY");
    let unitFontStyle = this.getOption<OptionFontValue>("unit-font");
    let unitColorFollow = this.getOption<boolean>("unit-color-follow");
    let unitColor = this.toCssColor(unitFontStyle.color as Color);
    let unitFamily = unitFontStyle.family;
    let unitSize = unitFontStyle.size;
    let unitItalic = unitFontStyle.italic ? 'italic' : 'normal';
    let unitBold = unitFontStyle.bold ? 'bold' : 'normal';
    let letterSpacing = 0;
    let showIcon = true;
    let data = this.trendValues;
    if (data > 0) {
      //根据数值判断样式的选取
      valueFont = this.getOption<OptionFontValue>("data-rise-font");
      iconColor = this.toCssColor(this.getOption("icon-rise-color"));
      iconSize = this.getOption("icon-rise-size");
      letterSpacing = this.getOption("data-rise-spacing");
      showIcon = this.getOption("icon-rise-style") !== "customize";
    } else if (data < 0) {
      valueFont = this.getOption<OptionFontValue>("data-derise-font");
      iconColor = this.toCssColor(this.getOption("icon-derise-color"));
      iconSize = this.getOption(["icon-derise-size"]);
      letterSpacing = this.getOption("data-derise-spacing");
      showIcon = this.getOption("icon-derise-style") !== "customize";
    } else {
      valueFont = this.getOption<OptionFontValue>("data-constant-font");
      iconColor = this.toCssColor(this.getOption("icon-constant-color"));
      iconSize = this.getOption("icon-constant-size");
      letterSpacing = this.getOption("data-constant-spacing");
      showIcon = this.getOption("icon-constant-style") !== "customize";
    }
    let valueFamily = valueFont.family;
    let valueBold = valueFont.bold ? "bold" : "normal";
    let valueItalic = valueFont.italic ? "italic" : "normal";
    valueColor = this.toCssColor(valueFont.color as Color);
    valueSize = valueFont.size;
    let valueStyle = `letter-spacing:${letterSpacing}px;font-family:${valueFamily};font-size:${valueSize}px;
                      height: ${this.contentSize.height-10}px;line-height: ${this.contentSize.height-10}px;
                      margin-right:${iconMargin}px;padding-right:20px;width: auto;`;
    if (new Color(valueFont.color).isGradient()) {
      valueStyle += `background:${valueColor};-webkit-background-clip: text;color: transparent;`;
    } else {
      valueStyle += `color:${valueColor};`;
    }
    let iconStyleEnd  = `background: ${iconColor};-webkit-background-clip: text;-webkit-text-fill-color: transparent;
                        font-size:${iconSize}px;height: ${this.contentSize.height-10}px;line-height: ${this.contentSize.height-10}px;`
    let iconStyleStart = iconStyleEnd + `margin-right:${iconMargin}px;`;

    let imageStyleEnd = `width:${iconSize}px;height:${iconSize}px;`
    let imageStyleStart = imageStyleEnd + `margin-right:${iconMargin}px;`;

    let unitStyle = {
      color: unitColorFollow ? iconColor : unitColor,
      fontFamily: unitFamily,
      fontSize: `${unitSize}px`,
      fontStyle: unitItalic,
      fontWeight: unitBold,
      marginLeft: `${unitOffsetx}px`,
      marginTop: `${unitOffsety}px`
    };
    if (unitColorFollow && new Color(valueFont.color).isGradient()) {
      unitStyle.color = "transparent";
      unitStyle['background'] = valueColor;
      unitStyle['-webkit-background-clip'] = 'text';
    }
    let trendStyle = `font-style:${valueItalic};font-weight:${valueBold};justify-content:${trendPosition};`;

    let trendStructure = this.getOption("trend-structure");
    switch (trendStructure) {
      case "1": // 图标在前
        if(showIcon) {
          iconStyleStart += "display:inline";
          imageStyleStart += "display:none";
        } else {
          iconStyleStart += "display:none";
          imageStyleStart += "display:inline";
        }
        iconStyleEnd += "display:none";
        imageStyleEnd += "display:none";
        valueStyle += "display:inline !important";
        break;
      case "2": // 数据在前
        if(showIcon) {
          iconStyleEnd += "display:inline";
          imageStyleEnd += "display:none";
        } else {
          iconStyleEnd += "display:none";
          imageStyleEnd += "display:inline";
        }
        iconStyleStart += "display:none";
        imageStyleStart += "display:none";
        valueStyle += "display:inline !important";
        break;
      case "3": // 只显示数据
        valueStyle += "display:inline !important";
        iconStyleStart += "display:none";
        iconStyleEnd += "display:none";
        imageStyleStart += "display:none";
        imageStyleEnd += "display:none";
        break;
      case "4": // 只显示图标
        valueStyle += "display:none !important";
        if(showIcon) {
          iconStyleStart += "display:inline";
          imageStyleStart += "display:none";
        } else {
          iconStyleStart += "display:none";
          imageStyleStart += "display:inline";
        }
        iconStyleEnd += "display:none";
        imageStyleEnd += "display:none";

        break;
    }
    return { trendStyle, unitStyle, iconStyleStart, iconStyleEnd, valueStyle, imageStyleStart, imageStyleEnd };
  }
  //判断数值选默认图标
  getIconClass(): any {
    let data = this.trendValues;
    let icon: any;
    if (parseFloat(data) > 0) {
      let iconType = this.getOption<string>("icon-rise-style");
      icon = iconType.startsWith("fs-") ? "fs " + iconType : "fs fs-rise-" + iconType;
    }
    else if (parseFloat(data) < 0) {
      let iconType = this.getOption<string>("icon-derise-style");
      icon = iconType.startsWith("fs-") ? "fs " + iconType : "fs fs-derise-" + this.getOption("icon-derise-style");
    }
    else {
      let iconType = this.getOption<string>("icon-constant-style");
      icon = iconType.startsWith("fs-") ? "fs " + iconType : "fs fs-" + this.getOption("icon-constant-style");
    }
    return icon;
  }

  getImageSrc(): any {
    let data = this.trendValues;
    let src: any;
    let imageOpt: OptionFileValue;
    let projectId = this.getBoard().projectId;
    if (parseFloat(data) > 0) {
      imageOpt = this.getOption<OptionFileValue>("icon-rise-image");
    }
    else if (parseFloat(data) < 0) {
      imageOpt = this.getOption<OptionFileValue>("icon-derise-image");
    }
    else {
      imageOpt = this.getOption<OptionFileValue>("icon-constant-image");
    }
    src = imageOpt?.url ? imageOpt.url : `${projectId}/${imageOpt?.relativePath}`;
    return src;
  }

  getSingleDateAfterAggregate(dim:OptionFieldValue) {
    if (shouldBypassSecondarySummary(this, dim)) {
      return evaluateBucketStageTableAggregateField(this, dim, getTableAggregateFieldRows(this, dim.uid));
    }

    const rows = this.getData().getRows([dim.uid]);
    const uids = dim.uid[2]?.split(".");
    if (!this.uid?.length) return;
    const [fieldUID, subFieldUID] = uids;
    let values = rows.map(row => row[fieldUID]);

    if (subFieldUID) {
      values = values.map(subRows => subRows.map(subRow => subRow[subFieldUID])).flat();
    }

    if (dim.summary === "sum") {
      return values.reduce((a, b) => a + b, 0);
    } else if (dim.summary === "max") {
      return Math.max(...values);
    } else if (dim.summary === "min") {
      return Math.min(...values);
    } else if (dim.summary === "mean") {
      return values.reduce((a, b) => a + b, 0) / values.length;
    } else if (dim.summary === "count") {
      return values.length;
    } else {
      // 没有聚合方式，取第一个值
      return values[0];
    }
  }

  //数据源的选取
  get trendValues(): any {
    let start_value;
    let end_value;
    let dim_value;
    let text;
    let reg = new RegExp(/^[-+]?[0-9]+(.[0-9]+)?%?$/);
    let placeholder_is_NaN = reg.test(this.getOption("placeholder"))
    let axisDim = this.getOption<OptionFieldValue[]>("axis-value") || [];
    if (axisDim && axisDim.length > 1) { //多个数据源
      let start_dim = axisDim[0];
      let end_dim = axisDim[1];
      if (start_dim?.uid) {
        start_value = this.getSingleDateAfterAggregate(start_dim);
      }
      if (end_dim?.uid) {
        end_value = this.getSingleDateAfterAggregate(end_dim);
      }
      if (this.getOption("trend-data-format") == "percent") {
        text = (parseFloat(end_value) - parseFloat(start_value)) / Math.abs(parseFloat(start_value));
      } else {
        text = parseFloat(end_value) - parseFloat(start_value);
      }
    } else if (axisDim.length == 1) {  //单个数据源
      let dim = axisDim[0];
      if (dim?.uid) {
        dim_value = this.getSingleDateAfterAggregate(dim);
      }
      text = parseFloat(dim_value);
    } else { //默认数据源
      text = placeholder_is_NaN ? parseFloat(this.getOption("placeholder")) : this.getOption("placeholder")
    }
    if (text === '') return text = 0
    return isNaN(text) ? text = 0 : text
  }

  get defaultName() {
    return i18next.t("defaultName");
  }

  get dataFormat() {
    return this.getOption("trend-data-format")
  }

  get placeholders() {
    return this.getOption("placeholder")
  }
  get decimalplaces() {
    return this.getOption("decimal-places")
  }
  get completeZero() {
    return this.getOption("complete-zero")
  }
  get positive() {
    return this.getOption("trend-show-positive")
  }
  get negative() {
    return this.getOption("trend-show-negative")
  }
  //基本配置
  static resource = resource;
  static defineOptions(): DefinedOptions[] {
    const UNIT_WEI = i18next.t("unitWEI");
    return [
      {
        data: {
          fileds: {
            alias: i18next.t("fieldSetting"),
            fold: "unfold",
            children: [
              {
                name: "axis-value",
                alias: i18next.t("valueField"),
                type: "field(aggs=sum|none|max|min|mean|count|distinct, min=0, max=1)",
              },
            ],
          },
        },
        style: {
          //基本设置
          basic: {
            children: [
              {
                name: "placeholder",
                alias: i18next.t("placeholder"),
                type: "string",
                default: "0.5",
              },
              {
                name: "trend-structure",
                alias: i18next.t("trendStyleType"),
                type: "select(radio)",
                default: "1",
                selectChoices: [
                  {
                    value: "1",
                    label: i18next.t("iconFront"),
                  },
                  {
                    value: "2",
                    label: i18next.t("dataFront"),
                  },
                  {
                    value: "3",
                    label: i18next.t("dataOnly"),
                  },
                  {
                    value: "4",
                    label: i18next.t("iconOnly"),
                  },
                ],
              },
              {
                name: "trend-data-format",
                alias: i18next.t("trendDataType"),
                type: "select(radioGroup)",
                default: "percent",
                selectChoices: [
                  {
                    value: "normal",
                    label: i18next.t("normal"),
                  },
                  {
                    value: "percent",
                    label: i18next.t("percent"),
                  },
                ],
              },
              {
                name: "decimal-places",
                alias: i18next.t("decimalPlaces"),
                type: "number(unit=" + UNIT_WEI + ", min=0)",
                default: 2,
              },
              {
                name: "complete-zero",
                alias: i18next.t("completeZero"),
                type: "boolean",
                default: false,
              },
              {
                name: "trend-show-positive",
                alias: i18next.t("showPositive"),
                type: "boolean",
                default: false,
              },
              {
                name: "trend-show-negative",
                alias: i18next.t("showNegative"),
                type: "boolean",
                default: false,
              },
            ],
          },
          //数据样式
          trendStyle: {
            alias: i18next.t("dataStyle"),
            children: [
              {
                name: "data-rise",
                alias: i18next.t("dataRise"),
                fold: "unfold",
                show: "tab",
                children: [
                  {
                    name: "data-rise-font",
                    alias: i18next.t("font"),
                    type: "font(gradient=true)",
                    default: {
                      family: 'sans-serif',
                      color: "#1FB862",
                      size: 20,
                      bold: false,
                      italic: false,
                      underline: false,
                      "line-through": false
                    },
                  },
                  {
                    name: "data-rise-spacing",
                    alias: i18next.t("fontSpacing"),
                    type: "number",
                    default: 0
                  }
                ],
              },
              {
                name: "data-constant",
                alias: i18next.t("dataConstant"),
                fold: "unfold",
                show: "tab",
                children: [
                  {
                    name: "data-constant-font",
                    alias: i18next.t("font"),
                    type: "font(gradient=true)",
                    default: {
                      family: 'sans-serif',
                      color: "#cccccc",
                      size: 20,
                      bold: false,
                      italic: false,
                      underline: false,
                      "line-through": false
                    },
                  },
                  {
                    name: "data-constant-spacing",
                    alias: i18next.t("fontSpacing"),
                    type: "number",
                    default: 0
                  }
                ],
              },
              {
                name: "data-derise",
                alias: i18next.t("dataDerise"),
                fold: "unfold",
                show: "tab",
                children: [
                  {
                    name: "data-derise-font",
                    alias: i18next.t("font"),
                    type: "font(gradient=true)",
                    default: {
                      color: "#ED7D2F",
                      family: 'sans-serif',
                      size: 20,
                      bold: false,
                      italic: false,
                      underline: false,
                      "line-through": false
                    },
                  },
                  {
                    name: "data-derise-spacing",
                    alias: i18next.t("fontSpacing"),
                    type: "number",
                    default: 0
                  }
                ],
              },
            ],
          },
          //显示单位
          unit: {
            alias: i18next.t("showUnit"),
            type: "boolean",
            default: false,
            children: [
              {
                name: "unit-text",
                alias: i18next.t("unit"),
                type: "string",
                default: "",
              },
              {
                name: "unit-offsetX",
                alias: i18next.t("unitOffsetX"),
                type: "number(unit=px)",
                default: 5,
              },
              {
                name: "unit-offsetY",
                alias: i18next.t("unitOffsetY"),
                type: "number(unit=px)",
                default: 0,
              },
              {
                name: "unit-font",
                alias: i18next.t("unitFont"),
                type: "font",
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
                name: "unit-color-follow",
                alias: i18next.t("unitColorFollow"),
                type: "boolean",
                default: false
              }
            ],
          },
          //图标样式
          icon: {
            alias: i18next.t("iconStyle"),
            children: [
              {
                name: "icon-margin",
                alias: i18next.t("iconMargin"),
                type: "number(unit=px)",
                default: 0,
              },
              {
                name: "icon-rise",
                alias: i18next.t("dataRise"),
                show: "tab",
                children: [
                  {
                    name: "icon-rise-color",
                    alias: i18next.t("iconColor"),
                    type: "color(gradient)",
                    default: "#1FB862",
                  },
                  {
                    name: "icon-rise-size",
                    alias: i18next.t("iconSize"),
                    type: "number(unit=px)",
                    default: 20,
                  },
                  {
                    name: "icon-rise-style",
                    type: "select(radio)",
                    default: "line2",
                    alias: i18next.t("iconStyle"),
                    selectChoices: [
                      {
                        value: "customize",
                        label: `${i18next.t("customize")}`,
                      },
                      {
                        value: "line2",
                        label: `${i18next.t("lineArrow")}1`,
                      },
                      {
                        value: "line3",
                        label: `${i18next.t("lineArrow")}2`,
                      },
                      {
                        value: "line4",
                        label: `${i18next.t("lineArrow")}3`,
                      },
                      {
                        value: "curve2",
                        label: i18next.t("curveArrow"),
                      },
                      {
                        value: "fs-up-arrow",
                        label: i18next.t("triangleArrow"),
                      },
                      {
                        value: "polyline2",
                        label: i18next.t("brokenArrow"),
                      },
                      {
                        value: "dot2",
                        label: i18next.t("circlePoint"),
                      },
                      {
                        value: "positive2",
                        label: i18next.t("plusSign"),
                      },

                    ],
                  },
                  {
                    name: "icon-rise-image",
                    alias: i18next.t("customizeImage"),
                    type: "file(format=image)",
                    visible: (widget: Trend) => {
                      return widget.getOption("icon-rise-style") === "customize"
                    }
                  },
                ],
              },
              {
                name: "icon-constant",
                alias: i18next.t("dataConstant"),
                show: "tab",
                children: [
                  {
                    name: "icon-constant-color",
                    alias: i18next.t("iconColor"),
                    type: "color(gradient)",
                    default: "#cccccc",
                  },
                  {
                    name: "icon-constant-size",
                    alias: i18next.t("iconSize"),
                    type: "number(unit=px)",
                    default: 20,
                  },
                  {
                    name: "icon-constant-style",
                    alias: i18next.t("iconStyle"),
                    type: "select(radio)",
                    default: "horizontal2",
                    selectChoices: [
                      {
                        value: "customize",
                        label: `${i18next.t("customize")}`,
                      },
                      {
                        value: "polyline",
                        label: i18next.t("line"),
                      },
                      {
                        value: "horizontal2",
                        label: i18next.t("transverseLine"),
                      },
                      {
                        value: "dot2",
                        label: i18next.t("circlePoint"),
                      },
                    ],
                  },
                  {
                    name: "icon-constant-image",
                    alias: i18next.t("customizeImage"),
                    type: "file(format=image)",
                    visible: (widget: Trend) => {
                      return widget.getOption("icon-constant-style") === "customize"
                    }
                  },
                ],
              },
              {
                name: "icon-derise",
                alias: i18next.t("dataDerise"),
                show: "tab",
                children: [
                  {
                    name: "icon-derise-color",
                    alias: i18next.t("iconColor"),
                    type: "color(gradient)",
                    default: "#ED7D2F",
                  },
                  {
                    name: "icon-derise-size",
                    alias: i18next.t("iconSize"),
                    type: "number(unit=px)",
                    default: 20,
                  },
                  {
                    name: "icon-derise-style",
                    alias: i18next.t("iconStyle"),
                    type: "select(radio)",
                    default: "line2",
                    selectChoices: [
                      {
                        value: "customize",
                        label: `${i18next.t("customize")}`,
                      },
                      {
                        value: "line2",
                        label: `${i18next.t("lineArrow")}1`,
                      },
                      {
                        value: "line3",
                        label: `${i18next.t("lineArrow")}2`,
                      },
                      {
                        value: "line4",
                        label: `${i18next.t("lineArrow")}3`,
                      },
                      {
                        value: "curve2",
                        label: i18next.t("curveArrow"),
                      },
                      {
                        value: "fs-down-arrow",
                        label: i18next.t("triangleArrow"),
                      },
                      {
                        value: "polyline2",
                        label: i18next.t("brokenArrow"),
                      },
                      {
                        value: "dot2",
                        label: i18next.t("circlePoint"),
                      },
                      {
                        value: "negative2",
                        label: i18next.t("negativeSign"),
                      },
                    ],
                  },
                  {
                    name: "icon-derise-image",
                    alias: i18next.t("customizeImage"),
                    type: "file(format=image)",
                    visible: (widget: Trend) => {
                      return widget.getOption("icon-derise-style") === "customize"
                    }
                  },
                ],
              },
            ],
          },
          //字体设置
          font: {
            alias: i18next.t("fontSetting"),
            children: [
              {
                name: "font",
                alias: i18next.t("font"),
                type: "font",
                visible: false,
              },
              {
                name: "font-position",
                alias: i18next.t("fontAlign"),
                type: "select(radio,radioGroup)",
                default: "center",
                selectChoices: [
                  {
                    label: i18next.t("flexStart"),
                    value: "flex-start",
                  },
                  {
                    label: i18next.t("center"),
                    value: "center",
                  },
                  {
                    label: i18next.t("flexEnd"),
                    value: "flex-end",
                  },
                ],
              },
            ],
          },
        },
      },
      ...super.defineOptions(),
    ];
  }
  get axisValue() {
    return this.getOption<OptionFieldValue[]>("axis-value") || [];
  }

  override getMetaData() {
    return merge(super.getMetaData(), {
      axisValue: [
        ...this.axisValue
      ]
    } as WidgetMetaData);
  }
}
