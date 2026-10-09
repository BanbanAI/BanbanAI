import { DefinedOptions, OptionFieldValue, WidgetMetaData } from "@renderer/b2/types";
import { Widget } from "@renderer/b2/controllers/widget";
import { Color } from "@renderer/b2/color";
import { WidgetSoul } from "@common/types/project";
import { Board } from "@renderer/b2/controllers/board";
import { formatFloat } from "@common/utils/math";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { watch, Ref, ref } from "vue";
import { merge } from "merge";
import { isEmpty } from "@common/utils/object";
import {
  evaluateBucketStageTableAggregateField,
  getTableAggregateFieldRows,
  shouldBypassSecondarySummary,
} from "../_common/tableAggregateField";

type CardAbnormalDisplayMode = "number" | "text" | "empty";

type CardValueResult = {
  numericValue: number;
  displayText: string;
  isAbnormal: boolean;
};

export class CardV2 extends Widget {
  constructor(soul: WidgetSoul, parent: Widget | Board) {
    const soulOptions = soul.options || {};
    if (!soul.isNew && soulOptions["abnormal-display-mode"] === undefined) {
      soulOptions["abnormal-display-mode"] = "number";
    }
    soul.options = soulOptions;
    super(soul, parent);
  }

  static resource = resource;
  static defineOptions(): DefinedOptions[] {
    const UNIT_WEI = i18next.t("unitWei");
    const UNIT_MIAO = i18next.t("unitMiao");
    return [{
      data: {
        fields: {
          alias: i18next.t("stFieldSetting"),
          fold: "unfold",
          children: [
            {
              name: "axis-value",
              alias: i18next.t("stAxisValue"),
              type: "field(aggs, max=1)",
            },
          ]
        }
      },
      style: {
        "digit-setting": {
          alias: i18next.t("digitSetting"),
          children: [
            {
              name: "digitFormat",
              alias: i18next.t("stDigitFormat"),
              fold: "unfold",
              show:"tab",
              children: [
                {
                  name: "abnormal-display-mode",
                  alias: i18next.t("stAbnormalDisplayMode"),
                  default: "text",
                  type: "select(radioGroup)",
                  selectChoices: [
                    {
                      label: i18next.t("stAbnormalDisplayText"),
                      value: "text"
                    },
                    {
                      label: i18next.t("stAbnormalDisplayNumber"),
                      value: "number"
                    },
                    {
                      label: i18next.t("stAbnormalDisplayEmpty"),
                      value: "empty"
                    },
                  ]
                },
                {
                  name: "placeholder",
                  alias: i18next.t("stPlaceholder"),
                  tip: i18next.t("stPlaceholderTip"),
                  default: 12345,
                  type: "number<float>",
                  visible: (widget: CardV2) => widget.getOption("abnormal-display-mode") === "number"
                },
                {
                  name: "abnormal-text",
                  alias: i18next.t("stAbnormalText"),
                  tip: i18next.t("stAbnormalTextTip"),
                  default: i18next.t("stAbnormalTextDefault"),
                  type: "string",
                  visible: (widget: CardV2) => widget.getOption("abnormal-display-mode") === "text"
                },
                {
                  name: "comma-display",
                  alias: i18next.t("stCommaDisplay"),
                  default: false,
                  type: "boolean",
                },
                {
                  name: "percentage-format",
                  alias: i18next.t("stPercentageFormat"),
                  default: "normal",
                  type: "select(radioGroup)",
                  selectChoices: [
                    {
                      label: i18next.t("stFormatNormal"),
                      value: "normal"
                    },
                    {
                      label: i18next.t("stFormatPercent"),
                      value: "percent"
                    },
                  ]
                },
                {
                  name: "integer-digits",
                  alias: i18next.t("integerDigits"),
                  default: "auto",
                  type: "select(radioGroup)",
                  selectChoices: [
                    {
                      label: i18next.t("integerDigitsAuto"),
                      value: "auto"
                    },
                    {
                      label: i18next.t("integerDigitsFixed"),
                      value: "fixed"
                    },
                  ],
                  tip: i18next.t("integerDigitsTip")
                },
                {
                  name: "fixed-digits",
                  alias: i18next.t("fixedDigits"),
                  type: "number(unit=" + UNIT_WEI + ", min=0)",
                  default: 2,
                  visible: (widget: CardV2) => widget.getOption("integer-digits") === "fixed"
                },
                {
                  name: "decimal-places",
                  alias: i18next.t("stDecimalPlaces"),
                  type: "number(unit=" + UNIT_WEI + ", min=0)",
                  default: 2,
                },
                {
                  name: "complete-zero",
                  alias: i18next.t("stCompleteZero"),
                  type: "boolean",
                  default: false,
                },
              ]
            },
            {
              name: "styleSetting",
              alias: i18next.t("digitStyles"),
              show:"tab",
              children: [
                {
                  name: "base-cluster",
                  alias: i18next.t("stBaseCluster"),
                  show: "tab",
                  fold: "unfold",
                  children: [
                    {
                      name: "type",
                      alias: i18next.t("stType"),
                      type: "select(radioGroup)",
                      default: "lcd",
                      selectChoices: [
                        {
                          value: "normal",
                          label: i18next.t("stTypeNormal")
                        },
                        {
                          value: "lcd",
                          label: i18next.t("stTypeLcd")
                        },
                        {
                          value: "card",
                          label: i18next.t("stTypeCard")
                        }
                      ]
                    },
                    {
                      name: "card-color",
                      alias: i18next.t("stCardColor"),
                      type: "color",
                      default: "transparent",
                      visible: (widget: Widget) => {
                        return widget.getOption("type") == "card"
                      }
                    },
                    {
                      name: "card-image",
                      alias: i18next.t("stCardImage"),
                      type: "file(format=image)",
                      visible: (widget: Widget) => {
                        return widget.getOption("type") == "card"
                      }
                    },
                    {
                      name: "card-flag-background",
                      alias: i18next.t("stFlagBackground"),
                      tip: i18next.t("stFlagBackgroundTips"),
                      type: "boolean",
                      default: false,
                      visible: (widget: Widget) => {
                        return widget.getOption("type") == "card"
                      }
                    },
                    {
                      name: "font-spacing",
                      alias: i18next.t("stFontSpacing"),
                      default: 15,
                      type: "number(unit=px)",
                    },
                    {
                      name: "text-align",
                      alias: i18next.t("stTextAlign"),
                      type: "align",
                      default: "center",
                    },
                  ]
                },
                {
                  name: "value-font-cluster",
                  alias: i18next.t("stValueFontCluster"),
                  show: "tab",
                  fold: 'unfold',
                  children: [
                    {
                      name: "font",
                      alias: i18next.t("stFont"),
                      type: "font(gradient=true)",
                      default: {
                        family: "sans-serif",
                        size: 30,
                        color: "#000000",
                      },
                    },
                    {
                      name: "font-shadow-color",
                      alias: i18next.t("stShadowColor"),
                      type: "color",
                      default: "#ffffff",
                    },
                    {
                      name: "font-shadow-blur",
                      alias: i18next.t("stShadowBlur"),
                      type: "number(unit=px)",
                      default: -1,
                    },
                    {
                      name: "font-shadow-offset",
                      alias: i18next.t("stFontShadowOffset"),
                      type: "vector<X,Y>(unit=px)",
                      default: [0,0],
                    },
                  ]
                },
              ]
            },
          ]
        },
        "unit-setting":{
           alias:i18next.t("unitSetting"),
           children:[
            {
              name: "unit-cluster",
              alias: i18next.t("unitStyles"),
              fold: "unfold",
              children: [
                {
                  name: "unit-basic",
                  alias: i18next.t("unitBasic"),
                  show: "tab",
                  children: [
                    {
                      name: "unit-text",
                      alias: i18next.t("stUnitText"),
                      default: "",
                      type: "string",
                    },
                    {
                      name: "unit-offsetX",
                      alias: i18next.t("stUnitOffsetX"),
                      type: "number(unit=px)",
                      default: 0,
                    },
                    {
                      name: "unit-offsetY",
                      alias: i18next.t("stUnitOffsetY"),
                      type: "number(unit=px)",
                      default: 0,
                    },
                  ]
                },
                {
                  name: "unit-font-cluster",
                  alias: i18next.t("stUnitFontCluster"),
                  show: "tab",
                  children: [
                    {
                      name: "unit-font",
                      alias: i18next.t("unitFont"),
                      type: "font(gradient=true)",
                      default: {
                        size: 30
                      },
                    },
                    {
                      name: "unit-shadow-color",
                      alias: i18next.t("stShadowColor"),
                      type: "color",
                      default: "#ffffff",
                    },
                    {
                      name: "unit-shadow-blur",
                      alias: i18next.t("stShadowBlur"),
                      type: "number(unit=px)",
                      default: -1,
                    },
                    {
                      name: "unit-shadow-offset",
                      alias: i18next.t("stFontShadowOffset"),
                      type: "vector<X,Y>(unit=px)",
                      default: [0,0],
                    },
                  ]
                }
              ]
            },
           ]
        },
        "animation-display": {
          alias: i18next.t("stAnimationDisplayGroup"),
          visible: true,
          children: [
            {
              name: "animation-display",
              alias: i18next.t("stAnimationDisplay"),
              type: "boolean",
              default: true,
            },
            {
              name: "animation-type",
              alias: i18next.t("stAnimationType"),
              type: "select(radioGroup)",
              default: "count",
              selectChoices: [
                {
                  value: "count",
                  label: i18next.t("stTypeCount")
                },
                {
                  value: "update",
                  label: i18next.t("stUndate")
                }
              ],
              visible: true,
            },
            {
              name: "animation-delay",
              alias: i18next.t("stAnimationDelay"),
              visible: true,
              type: "number<float>(unit=" + UNIT_MIAO + ", min=0)",
              default: 1,
            },
            {
              name: "animation-duration",
              alias: i18next.t("stAnimationDuration"),
              type: "number<float>(unit=" + UNIT_MIAO + ", min=0)",
              default: 1,
              visible: true
            },
            {
              name: "animation-loop",
              alias: i18next.t("stAnimationLoop"),
              default: true,
              type: "boolean",
              visible: (widget: CardV2) => {
                return widget.getOption('animation-type') == 'count'
              },
            },
            {
              name: "animation-interval",
              alias: i18next.t("stAnimationInterval"),
              type: "number<float>(unit=" + UNIT_MIAO + ", min=0)",
              default: 10,
              visible: (widget: CardV2) => {
                return widget.getOption('animation-type') == 'count' && widget.getOption('animation-loop')
              },
            },
          ]
        },
      },
    }, ...super.defineOptions()];
  }

  private _cardValueResult: Ref<CardValueResult> = ref(undefined);
  get cardValueResult(): CardValueResult {
    if (this._cardValueResult.value === undefined) {
      this.effectScope.run(()=>{
        watch(()=>{
          if(!this.status.isVisible && this._cardValueResult.value !== undefined) return this._cardValueResult.value;
          return this.resolveCardValueResult();
        }, (value)=>{
          const currentValue = this._cardValueResult.value;
          if (
            !currentValue
            || currentValue.numericValue !== value.numericValue
            || currentValue.displayText !== value.displayText
            || currentValue.isAbnormal !== value.isAbnormal
          ) {
            this._cardValueResult.value = value;
          }
        }, {immediate: true});
      });
    }
    return this._cardValueResult.value;
  }

  get cardValue(): number {
    return this.cardValueResult?.numericValue;
  }

  get cardValueText() {
    return this.cardValueResult?.displayText || "";
  }

  get isAbnormal() {
    return this.cardValueResult?.isAbnormal || false;
  }

  get abnormalDisplayMode(): CardAbnormalDisplayMode {
    const abnormalDisplayMode = this.getOption<CardAbnormalDisplayMode>("abnormal-display-mode", { skipDefault: true });
    if (abnormalDisplayMode) {
      return abnormalDisplayMode;
    }
    return "text";
  }

  get abnormalText() {
    return this.getOption<string>("abnormal-text") || i18next.t("stAbnormalTextDefault");
  }

  get shouldAnimateCardValue() {
    return !this.isAbnormal || this.abnormalDisplayMode === "number";
  }

  get defaultName() {
    return i18next.t("defaultName");
  }

  get displayUnitValue() {
    if (this.isAbnormal && this.abnormalDisplayMode !== "number") {
      return "";
    }
    return this.unitValue;
  }

  private isValidNumericValue(value: any) {
    if (value === undefined || value === null) return false;
    if (typeof value === "string" && value.trim() === "") return false;
    return Number.isFinite(Number(value));
  }

  private createNormalCardValueResult(value: number): CardValueResult {
    const numericValue = Number(value);
    return {
      numericValue,
      displayText: this.getCartValueText(numericValue),
      isAbnormal: false,
    };
  }

  private createAbnormalCardValueResult(defaultValue: number): CardValueResult {
    const numericValue = this.isValidNumericValue(defaultValue) ? Number(defaultValue) : 0;
    if (this.abnormalDisplayMode === "empty") {
      return {
        numericValue,
        displayText: "",
        isAbnormal: true,
      };
    }
    if (this.abnormalDisplayMode === "text") {
      return {
        numericValue,
        displayText: this.abnormalText,
        isAbnormal: true,
      };
    }
    return {
      numericValue,
      displayText: this.getCartValueText(numericValue),
      isAbnormal: true,
    };
  }

  private resolveCardValueResult(): CardValueResult {
    const valueDims = this.getOption<OptionFieldValue[]>("axis-value") || [];
    const defaultValue = this.getOption<number>("placeholder");
    if (!valueDims.length) {
      return this.createAbnormalCardValueResult(defaultValue);
    }

    const valueDim = valueDims[0];
    const valueUid = valueDim.uid;
    const summary = valueDim.summary;

    if (shouldBypassSecondarySummary(this, valueDim)) {
      const value = evaluateBucketStageTableAggregateField(this, valueDim, getTableAggregateFieldRows(this, valueUid));
      if (value === undefined || value === null || isNaN(value)) {
        return this.createAbnormalCardValueResult(defaultValue);
      }
      return this.createNormalCardValueResult(Number(value));
    }

    const column = (this.getData().getflatColumns([valueUid])?.[0] as Array<any>) || [];
    if(["sum", "max", "min", "mean"].includes(summary)){
      const columnValid = column.filter(val => !isNaN(val));
      if (!columnValid.length) {
        return this.createAbnormalCardValueResult(defaultValue);
      }
    }

    let value = column[0];
    if (summary === "sum") {
      value = column.reduce((result, current) => { return result + current }, 0);
    } else if (summary === "max") {
      value = column.reduce((result, current) => { return Math.max(result, current) }, -Infinity);
    } else if (summary === "min") {
      value = column.reduce((result, current) => { return Math.min(result, current) }, Infinity);
    } else if (summary === "mean") {
      value = column.reduce((result, current) => { return result + current }, 0) / column.length;
    } else if (summary === "count") {
      value = column.length;
    } else if (summary === "fill") {
      value = column.filter(item => !isEmpty(item) && item != "").length;
    } else if (summary === "unfill") {
      value = column.filter(item => isEmpty(item) || item == "").length;
    }

    if (value === undefined || value === null || isNaN(value)) {
      return this.createAbnormalCardValueResult(defaultValue);
    }
    return this.createNormalCardValueResult(Number(value));

  }

  getCartValueText(originValue): string {
    let value = Number(originValue);
    let flag = Math.abs(value) != value;
    value = Math.abs(value);
    if (this.getOption("percentage-format") === "percent") {
      value = value * 100;
    }

    let decimalPlaces = this.getOption<number>("decimal-places");
    let completeZero = this.getOption<boolean>("complete-zero");
    let fixedDigits = this.getOption<number>("fixed-digits");
    let text = formatFloat(value, decimalPlaces, completeZero);

    if (this.getOption("integer-digits") === "fixed"){
      text = this.formatInteger(text, fixedDigits);
    }

    if (this.getOption<boolean>("comma-display")) {
      let textArr = text.toString().replace(/\,/g, "").split('.');
      let integerStr = textArr[0];
      if (integerStr.length > 3) {
        let addCount = integerStr.length % 3;
        addCount = addCount > 0 ? 3 - addCount : addCount;
        textArr[0] = textArr[0].padStart(integerStr.length + addCount).match(/.{1,3}/g).join(",");
      }
      text = textArr.join(".").trim();
    }
    if(flag){
      if(text.indexOf(" ") > -1){
        text = text.replace(/.(?=\d)/, "-");
      }else{
        text = "-" + text;
      }
    }
    return text;
  }

  get divClass() {
    return "card-box";
  }

  toCssColor(color: Color) {
    return new Color(color).toCssString();
  }


  get showUnit() {
    return this.getOption<boolean>("unit");
  }

  get unitValue() {
    return this.getOption<string>("unit-text");
  }

  formatInteger(text: string, fixedDigits: number): string {
    const [integerPart, decimalPart] = text.split(".");
    if (decimalPart) {
      return `${integerPart.padStart(fixedDigits, '0')}.${decimalPart}`;
    }
    return integerPart.padStart(fixedDigits, '0');
  }

  get axisValue() {
    return this.getOption<OptionFieldValue[]>("axis-value") || [];
  }

  override getMetaData() {
    return merge(super.getMetaData(), {
      axisValue: [
        ...this.axisValue,
      ]
    } as WidgetMetaData);
  }
}
