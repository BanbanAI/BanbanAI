import { DefinedOptions, OptionFontValue, OptionFieldValue, WidgetMetaData } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { Widget } from "@renderer/b2/controllers/widget";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { isEmpty } from "@common/utils/object";
import { merge } from "merge";
export class Paragraph extends Widget {
  public textareaHeight: number;
  public lastHeight: number;

  static resource = resource;

  toCssColor(color: Color) {
    return new Color(color).toCssString();
  }

  get textareaValue(): string {
    const dimUid = this.textFields?.[0]?.uid;
    if (dimUid) {
      const columns = this.getData().getflatColumns([dimUid])?.[0]?.flat?.() || [];
      const text = columns.find(col => !isEmpty(col));
      if (text) return text;
    }

    let text = this.getOption<string>("text");
    if (text === undefined) text = "";
    text = text.replace(/\\n/g, "\n");
    return text;
  }
  get htmlValue() {
    return this.textareaValue.split("\n").map((item)=>{
      return `<div>${item}</div>`
    }).join("");
  }
  get defaultName () {
    return i18next.t("defaultName");
  }

  static defineOptions(): DefinedOptions[] {
    const UNIT_MIAO = i18next.t("unitMiao");
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
          alias: i18next.t("basicSetting"),
          children: [
            {
              name: "text",
              alias: i18next.t("text"),
              type: "paragraph(row=5)",
              default: i18next.t("textExample"),
            },
          ],
        },
        font: {
          alias: i18next.t("fontSetting"),
          children: [
            {
              name: "font-style",
              alias: i18next.t("fontStyle"),
              show: "tab",
              children: [
                {
                  name: "font",
                  alias: i18next.t("font"),
                  type: "font",
                  default: {
                    family: 'sans-serif',
                    size: 16,
                    bold: false,
                    italic: false,
                  },
                },
                {
                  name: "font-spacing",
                  alias: i18next.t("fontSpacing"),
                  default: 0,
                  type: "number(unit=px,min=0)",
                },
                {
                  name: "font-line-height",
                  alias: i18next.t("fontLineHeight"),
                  type: "number(unit=px)",
                  default: 40,
                },
                {
                  name: "text-indent",
                  alias: i18next.t("textIndent"),
                  type: `number(unit=${i18next.t("digit")},min=0)`,
                  default: 2,
                },
                {
                  name: "text-position",
                  alias: i18next.t("textPosition"),
                  type: "select",
                  default: "left",
                  selectChoices: [
                    {
                      label: i18next.t("textPositionLeft"),
                      value: "left"
                    },
                    {
                      label: i18next.t("textPositionCenter"),
                      value: "center"
                    },
                    {
                      label: i18next.t("textPositionRight"),
                      value: "right"
                    },
                    {
                      label: i18next.t("textPositionJustify"),
                      value: "justify"
                    }
                  ],
                },
                {
                  name: "text-padding",
                  alias: i18next.t("textPadding"),
                  type: `vector<${i18next.t("left")},${i18next.t("right")},${i18next.t("up")},${i18next.t("down")}>(unit=px)`,
                  default:[0,0,0,0]
                }
              ]
            },
            {
              name: "font-shadow",
              alias: i18next.t("fontShadow"),
              show: "tab",
              children: [
                {
                  name: "font-shadow-color",
                  alias: i18next.t("fontShadowColor"),
                  type: "color(gradient)",
                  default: "#ffffff",
                },
                {
                  name: "font-shadow-blur",
                  alias: i18next.t("fontShadowBlur"),
                  type: "number(unit=px, min=0)",
                  default: 0,
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
          ]
        },
        "animation-display": {
          alias: i18next.t("animationSetting"),
          visible: false,
          children: [
            {
              name: "animation-display",
              alias: i18next.t("animationDisplay"),
              type: "boolean",
              default: true,
            },
            {
              name: "animation-delay",
              alias: i18next.t("animationDelay"),
              visible: true,
              type: "number<float>(unit=" + UNIT_MIAO + ", min=0)",
              default: 1,
            },
            {
              name: "animation-duration",
              alias: i18next.t("animationDuration"),
              type: "number<float>(unit=" + UNIT_MIAO + ", min=0)",
              default: 1,
              visible: true
            },
            {
              name: "animation-loop",
              alias: i18next.t("animationLoop"),
              default: true,
              type: "boolean",
              visible: true
            },
            {
              name: "animation-interval",
              alias: i18next.t("animationInterval"),
              type: "number<float>(unit=" + UNIT_MIAO + ", min=0)",
              default: 0,
              visible: (widget: Paragraph) => {
                return widget.getOption('animation-loop');
              },
            },
          ]
        },
      },
    }, ...super.defineOptions()];
  }

  get currentValue(){
    return {
      value: this.textareaValue
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