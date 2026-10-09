import { DefinedOptions, OptionFontValue, OptionFieldValue, WidgetMetaData } from "@renderer/b2/types";
import { Widget } from "@renderer/b2/controllers/widget";
import { Color } from "@renderer/b2/color";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { watch, Ref, ref } from "vue";
import { isEmpty } from "@common/utils/object";
import { merge } from "merge";

export class Text extends Widget {

  get name() {
    return this.soul.name || this.getOption("text");
  }
  set name(name: string) {
    super.name = name;
  }

  toCssColor(color: Color) {
    return new Color(color).toCssString();
  }

  private _textBasicStyle: Ref<string> = ref(undefined);
  get textBasicStyle(): string {
    if (this._textBasicStyle.value === undefined) {
      this.effectScope.run(()=>{
        watch(()=>{
          if(!this.status.isVisible && this._textBasicStyle.value !== undefined) return this._textBasicStyle.value;
          let fontStyle = this.getOption<OptionFontValue>("text-font");
          let color = this.toCssColor(fontStyle.color as Color);
          let size = fontStyle.size;
          let family = fontStyle.family;
          let italic = fontStyle.italic ? "italic" : "normal";
          let bold = fontStyle.bold ? "bold" : "normal";
          let spacing = this.getOption<number>("font-spacing")
          let indent = this.getOption<number>("text-indent");
          let tilt = this.getOption<number[]>("text-tilt");


          let indentDiff = 0;
          let marginRight = 0;
          let marginBottom = 0;
          let marginTop = 0;
          let textPosition = this.getOption("text-position");
          let textArrangement = this.getOption("text-arrangement");
          let textVertical = this.getOption("text-vertical");

          if(textPosition === "center" && textArrangement === "horizontal") {
            indentDiff = spacing;
          }else if(textPosition === "right" && textArrangement === "horizontal"){
            marginRight = -spacing - indent ;
          }else if(textPosition === "right"){
            let offset = 0;
            if(italic === 'italic'){
              offset = size*0.15
            }
          }

          if(textVertical === "bottom" && textArrangement === "vertical") {
            marginBottom = - indent - spacing;
          } else if (textVertical === "center" && textArrangement === "vertical") {
            marginTop = spacing;
          }

          let style = `transform: skew(${tilt[0]}deg, ${tilt[1]}deg) !important;font-size:${size}px;font-style:${italic};letter-spacing: ${spacing}px;font-weight:${bold};margin-right:${marginRight}px;margin-bottom:${marginBottom}px;margin-top:${marginTop}px;
            text-indent:${indent + indentDiff}px;font-family:${family};`;
          if(fontStyle.underline || fontStyle["line-through"]) {
            style += `text-decoration: ${fontStyle.underline ? "underline" : ""} ${fontStyle["line-through"] ? "line-through" : ""};text-underline-offset:${size / 5}px;`
          }
          return style;
        }, (value)=>{
          if (this._textBasicStyle.value !== value) {
            this._textBasicStyle.value = value;
          }
        }, {immediate: true});
      });
    }
    return this._textBasicStyle.value;
  }

  private _textValue: Ref<string> = ref(undefined);
  get textValue(): string {
    if (this._textValue.value === undefined) {
      this.effectScope.run(()=>{
        watch(()=>{
          const dimUid = this.textFields?.[0]?.uid;
          if (dimUid) {
            const columns = this.getData().getflatColumns([dimUid])?.[0]?.flat?.() || [];
            const text = columns.find(col => !isEmpty(col));
            if (text) return text;
          }

          return this.getOption<string>("text") !== undefined ? this.getOption<string>("text") : "";
        }, (value: string)=>{
          if (this._textValue.value !== value) {
            this._textValue.value = value;
          }
        }, {immediate: true});
      });
    }
    return this._textValue.value;
  }
  get defaultName () {
    return i18next.t("defaultName");
  }
  private _textPosition: Ref<string> = ref(undefined);
  get textPosition() {
    if (this._textPosition.value === undefined) {
      this.effectScope.run(()=>{
        watch(()=>{
          let classStr = "";
          let textPosition = this.getOption("text-position");
          let textVertical = this.getOption("text-vertical");
          switch (textVertical) {
            case "top":
              classStr += `top `
              break;
            case "center":
              classStr += `v-center `
              break;
            case "bottom":
              classStr += `bottom `
              break;
          }
          switch (textPosition) {
            case "left":
              classStr += `left `
              break;
            case "center":
              classStr += `h-center `
              break;
            case "right":
              classStr += `right `
              break;
          }
          return classStr;
        }, (value: string)=>{
          if (this._textPosition.value !== value) {
            this._textPosition.value = value;
          }
        }, {immediate: true});
      });
    }
    return this._textPosition.value;
  }

  private _baseClass: Ref<string> = ref(undefined);
  private get baseClass() {
    if (this._baseClass.value === undefined) {
      this.effectScope.run(()=>{
        watch(()=>{
          return this.getOption("text-arrangement") === 'horizontal' ? '' : 'vertical';
        }, (value)=>{
          if (this._baseClass.value !== value) {
            this._baseClass.value = value;
          }
        }, {immediate: true});
      });
    }
    return this._baseClass.value;
  }

  get divClass(): string {
    return `${this.baseClass} ${this.textPosition}`;
  }

  static resource = resource;
  static defineOptions(): DefinedOptions[] {
    const UNIT_MIAO = i18next.t("unitMIAO");
    return [{
      data: {
        fields: {
          alias: "字段设置",
          fold: "unfold",
          children: [
            {
              name: "text-fields",
              alias: "文本字段",
              type: "field(max=1)"
            },
          ],
        },
      },
      style: {
        basic: {
          children: [
            {
              name: "text",
              alias: i18next.t("text"),
              type: "string",
              default: i18next.t("textDefault"),
            },
            {
              name: "text-arrangement",
              alias: i18next.t("textArrangement"),
              type: "select(radioGroup)",
              default: "horizontal",
              selectChoices: [
                {
                  value: "horizontal",
                  label: i18next.t("horizontal"),
                },
                {
                  value: "vertical",
                  label: i18next.t("vertical"),
                },
              ]
            }

          ],
        },
        font: {
          alias: i18next.t("fontSetting"),
          children: [
            {
              name: "font-style",
              alias: i18next.t("fontStyle"),
              show: "tab",
              fold: "unfold",
              children: [
                {
                  name: "text-font",
                  alias: i18next.t("font"),
                  type: "font(gradient=true,underline=true,line-through=true)",
                  default: {
                    size: 20,
                  }
                },
                {
                  name: "font-spacing",
                  alias: i18next.t("fontSpacing"),
                  default: 0,
                  type: "number(unit=px)",
                },
                {
                  name: "text-indent",
                  alias: i18next.t("fontIndent"),
                  type: "number(unit=px)",
                  default: 0,
                },
                {
                  name: "text-tilt",
                  alias: i18next.t("textTilt"),
                  type: "vector<W, H>(unit=px)",
                  default: [0,0]
                },
                {
                  name: "text-position",
                  alias: i18next.t("fontAlign"),
                  type: "select(radioGroup)",
                  default: "center",
                  selectChoices: [
                    {
                      label: i18next.t("left"),
                      value: "left"
                    },
                    {
                      label: i18next.t("center"),
                      value: "center"
                    },
                    {
                      label: i18next.t("right"),
                      value: "right"
                    },
                  ],
                },
                {
                  name: "text-vertical",
                  alias: i18next.t("verticalAlign"),
                  type: "select(radioGroup)",
                  default: "center",
                  selectChoices: [
                    {
                      label: i18next.t("top"),
                      value: "top"
                    },
                    {
                      label: i18next.t("center"),
                      value: "center"
                    },
                    {
                      label: i18next.t("bottom"),
                      value: "bottom"
                    },
                  ],
                },
                {
                  name: "text-position-relative",
                  alias: i18next.t("textPosition"),
                  type: "vector<X,Y>(unit=px)",
                  default: [0, 0],
                }
              ]
            },
            {
              name: "shadow-cluster",
              alias: i18next.t("fontShadow"),
              show: "tab",
              fold: "unfold",
              children: [
                {
                  name: "font-shadow-color",
                  alias: i18next.t("fontShadowColor"),
                  type: "color",
                  default: "#ffffff",
                },
                {
                  name: "font-shadow-blur",
                  alias: i18next.t("fontShadowBlur"),
                  type: "number(unit=px)",
                  default: -1,
                },
                {
                  name: "font-shadow-offset-x",
                  alias: i18next.t("fontShadowOffsetX"),
                  type: "number(unit=px)",
                  default: 0,
                },
                {
                  name: "font-shadow-offset-y",
                  alias: i18next.t("fontShadowOffsetY"),
                  type: "number(unit=px)",
                  default: 0,
                },
              ]
            },
            {
              name: "shadow-font-cluster",
              alias: i18next.t("shadow-font-cluster"),
              show: "tab",
              fold: "unfold",
              children: [
                {
                  name: "shadow-color",
                  alias: i18next.t("shadow-color"),
                  type: "color",
                  default: "#ffffff",
                },
                {
                  name: "shadow-blur",
                  alias: i18next.t("shadow-blur"),
                  type: "number(unit=px)",
                  default: -1,
                },
                {
                  name: "shadow-offset-x",
                  alias: i18next.t("shadow-offset-x"),
                  type: "number(unit=px)",
                  default: 0,
                },
                {
                  name: "shadow-offset-y",
                  alias: i18next.t("shadow-offset-y"),
                  type: "number(unit=px)",
                  default: 0,
                },
              ]
            }
          ]
        },
        "animation-display": {
          alias: i18next.t("animationDisplaySetting"),
          visible: false,
          children: [
            {
              name: "animation-display",
              alias: i18next.t("animationDisplay"),
              type: "boolean",
              default: false,
            },
            {
              name: "animation-type",
              alias: i18next.t("animationDisplayType"),
              type: "select(radioGroup)",
              default: "scroll",
              selectChoices: [
                {
                  value: "scroll",
                  label: i18next.t("animationDisplayTypeScroll"),
                },
                {
                  value: "blink",
                  label: i18next.t("animationDisplayTypeBlink"),
                }
              ],
            },
            {
              name: "animation-easing",
              alias: i18next.t("animationEasing"),
              type: "select",
              selectChoices: [
                {
                  label: i18next.t("none"),
                  value: "none",
                },
                {
                  label: i18next.t("Power1.easeIn"),
                  value: "Power1.easeIn",
                },
                {
                  label: i18next.t("Power1.easeOut"),
                  value: "Power1.easeOut",
                },
                {
                  label: i18next.t("Power1.easeInOut"),
                  value: "Power1.easeInOut",
                },
                {
                  label: i18next.t("Back.easeIn"),
                  value: "Back.easeIn",
                },
                {
                  label: i18next.t("Back.easeOut"),
                  value: "Back.easeOut",
                },
                {
                  label: i18next.t("Back.easeInOut"),
                  value: "Back.easeInOut",
                },
                {
                  label: i18next.t("SlowMo.easeIn"),
                  value: "SlowMo.easeIn",
                },
                {
                  label: i18next.t("SlowMo.easeOut"),
                  value: "SlowMo.easeOut",
                },
                {
                  label: i18next.t("SlowMo.easeInOut"),
                  value: "SlowMo.easeInOut",
                },
              ],
              default: "none",
            },
            {
              name: "animation-delay",
              alias: i18next.t("animationDelay"),
              visible: true,
              type: "number<float>(step=0.1, unit=" + UNIT_MIAO + ")",
              default: 1,
            },
            {
              name: "animation-duration",
              alias: i18next.t("animationDuration"),
              type: "number<float>(step=0.1, unit=" + UNIT_MIAO + ")",
              default: 1,
              visible: true
            },
            {
              name: "animation-loop",
              alias: i18next.t("animationLoop"),
              default: false,
              type: "boolean",
              visible: true,
            },
            {
              name: "animation-interval",
              alias: i18next.t("animationInterval"),
              default: 0,
              type: "number<float>(step=0.1, unit=" + UNIT_MIAO + ")",
              visible: (widget: Widget) => {
                return widget.getOption("animation-loop")
              },
            }
          ]
        },
      },
    }, ...super.defineOptions()];
  }

  get currentValue(){
    return {
      value: this.textValue
    }
  }

  get textFields() {
    return this.getOption<OptionFieldValue[]>("text-fields") || [];
  }

  override getMetaData() {
    return merge(super.getMetaData(), {
      axisValue: [
        ...this.textFields
      ]
    } as WidgetMetaData);
  }
}
