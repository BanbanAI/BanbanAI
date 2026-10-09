import { DefinedOptions, OptionFieldValue, OptionFileValue } from "@renderer/b2/types";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { ref } from "vue";
import { Widget } from "@renderer/b2/controllers/widget";

export class SplitLine extends Widget {
  static resource = resource;

  get defaultName() {
    return i18next.t("defaultName");
  }
  get currentValue() {
    return "";
  }

  public get hiddenTitle(): boolean {
    return this.getOption("hidden-title");
  }

  public get titleText(): string {
    return this.getOption("title-text");
  }

  public get isSplitLineType(): boolean {
    return this.getOption("split-line-type") === "line";
  }

  public get lineType(): "solid" | "dotted" | "dashed" | "double" {
    return this.getOption("line-type");
  }

  handleImageSrc(relativePath) {
    const projectId = this.getBoard().projectId;
    return relativePath ? `${projectId}/${relativePath}` : "";
  }

  private firstPaint = true;

  public get imageSrc() {
    if (!this.status.isVisible && this.firstPaint) return "";
    this.firstPaint = false;
    const imageOptions = this.getOption<OptionFileValue>("image-src");

    let src;
    if (imageOptions) {
      if (typeof imageOptions === "string") {
        src = imageOptions;
      } else {
        src = imageOptions?.url || this.handleImageSrc(imageOptions.relativePath);
      }
      return `url("${src}") center center / 100% 100% no-repeat`;
    } else {
      return "none";
    }
  }

  static defineOptions(): DefinedOptions[] {
    return [
      {
        style: {
          basic: {
            children: [
              {
                name: "hidden-title",
                alias: i18next.t("hiddenTitle"),
                type: "boolean",
                default: false,
              },
              {
                name: "title-text",
                alias: i18next.t("title"),
                type: "string",
                default: i18next.t("splitLine"),
              },
            ],
          },
          splitLine: {
            alias: i18next.t("styleSetting"),
            children: [
              {
                name: "title-style",
                alias: i18next.t("titleStyle"),
                show: "tab",
                children: [
                  {
                    name: "font",
                    alias: i18next.t("font"),
                    type: "font",
                    default: {
                      size: 14,
                      color: "#141414",
                      bold: true,
                    },
                  },
                  {
                    name: "letter-spacing",
                    alias: i18next.t("letterSpacing"),
                    type: "number(unit=px)",
                    default: 0,
                  },
                  {
                    name: "margin-bottom",
                    alias: i18next.t("marginBottom"),
                    type: "number(unit=px)",
                    default: 8,
                  },
                ],
              },
              {
                name: "line-style",
                alias: i18next.t("splitLineStyle"),
                show: "tab",
                children: [
                  {
                    name: "split-line-type",
                    alias: i18next.t("splitLineType"),
                    type: "select(radioGroup)",
                    default: "line",
                    selectChoices: [
                      {
                        label: i18next.t("line"),
                        value: "line",
                      },
                      {
                        label: i18next.t("image"),
                        value: "image",
                      },
                    ],
                  },
                  {
                    name: "line-type",
                    alias: i18next.t("splitLineType"),
                    type: "select",
                    visible: (widget: SplitLine) => {
                      return widget.getOption("split-line-type") === "line";
                    },
                    selectChoices: [
                      {
                        label: i18next.t("solid"),
                        value: "solid",
                      },
                      {
                        label: i18next.t("dashed"),
                        value: "dashed",
                      },
                      {
                        label: i18next.t("dotted"),
                        value: "dotted",
                      },
                      {
                        label: i18next.t("doubleLine"),
                        value: "double",
                      },
                    ],
                    default: "solid",
                  },
                  {
                    name: "line-width",
                    alias: i18next.t("splitLineWidth"),
                    type: "number(unit=px,min=0)",
                    default: 1,
                    visible: (widget: SplitLine) => {
                      return !widget.isSplitLineType || widget.lineType !== "dotted";
                    },
                  },
                  {
                    name: "dotted-radius",
                    alias: i18next.t("dottedRadius"),
                    type: "number(unit=px, min=1)",
                    default: 5,
                    visible: (widget: SplitLine) => {
                      return widget.isSplitLineType && widget.lineType === "dotted";
                    },
                  },
                  {
                    name: "line-radius",
                    alias: i18next.t("lineRadius"),
                    type: "number(unit=px, min=0)",
                    default: 0,
                    visible: (widget: SplitLine) => {
                      return !widget.isSplitLineType || widget.lineType !== "dotted";
                    },
                  },
                  {
                    name: "line-color",
                    alias: i18next.t("splitLineColor"),
                    type: "color",
                    default: "#CCCCCC",
                    visible: (widget: SplitLine) => {
                      return widget.getOption("split-line-type") === "line";
                    },
                  },
                  {
                    name: "image-src",
                    alias: i18next.t("splitLineImageSrc"),
                    type: "file(format=image)",
                    visible: (widget: SplitLine) => {
                      return widget.getOption("split-line-type") === "image";
                    },
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

}
