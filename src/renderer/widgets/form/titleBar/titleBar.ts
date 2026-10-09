import { DefinedOptions } from "@renderer/b2/types";
import { FormElement } from "@renderer/b2/controllers/form";
import { Ref, ref } from "vue";
import resource from "./locales";
import { Form } from "../../form/form";
import BorderStyleDialog from './components/BorderStyleDialog.vue';
import { TitleType } from "./type";
import i18next from "@renderer/widgets/i18next";

export type barType = "border-title" | "image-text-title";
export type titleStyleType = {
  selectVal: string,
  titleAlign: string,
}
export type titleFamilyType = {
  family: string,
  size: number,
  color: string,
  bold: boolean,
  italic: boolean,
  underline: boolean,
  "line-through": boolean,
}
export type TitleAlignType = "left" | "center" | "right";
export type BackgroundFillType = "fill" | "repeat" | "auto";
export type FileOptionType = {
  relativePath?: string,
  [key: string]: any,
} | null | undefined;

export class TitleBar extends FormElement {
  static resource = resource as any;

  get defaultName() {
    return i18next.t("defaultName");
  }

  protected _inputValue: Ref<string> = ref();
  get defaultValue(): string {
    return this.getOption<barType>("title-bar-type") === "border-title" ? this.textDefaultValue : this.mainDefaultValue;
  }
  public get inputValue() {
    return this._inputValue.value ?? this.initialValue ?? this.defaultValue;
  }
  public set inputValue(value: string) {
    this._inputValue.value = value;
  }
  initAfterConstructor() {
    super.initAfterConstructor();
  }
  isCreateField() {
    return false;
  }
  static defineOptions(): DefinedOptions[] {
    return [
      {
        style: {
          basicStyle: {
            children: [
              {
                name: "show-title",
                default: false,
                visible: false
              },
              {
                name: "title-text",
                default: (element: TitleBar) => {
                  return (element.titleBarType === "border-title" ? element.textDefaultValue : element.mainDefaultValue) || element.name;
                },
                visible: false
              },
              {
                name: "title-bar-type",
                alias: i18next.t("titleBarType"),
                type: "select(radioGroup)",
                default: "border-title",
                selectChoices: [
                  { label: i18next.t("borderTitle"), value: "border-title" },
                  { label: i18next.t("imageTextTitle"), value: "image-text-title" }
                ]
              },
              {
                name: "title-border-style",
                alias: i18next.t("borderStyle"),
                type: "dialog",
                default: {
                  selectVal: 'title_1',
                  titleAlign: 'left',
                },
                dialog: {
                  component: BorderStyleDialog,
                  buttonText: (widget: TitleBar) => {
                    return i18next.t("chooseBorder")
                  }
                },
                visible: (widget) => {
                  return widget.getOption<barType>("title-bar-type") === "border-title"
                }
              },
              {
                name: "title-border-color",
                alias: i18next.t("borderColorScheme"),
                type: "color",
                default: "#0089FFFF",
                visible: (widget) => {
                  return widget.getOption<barType>("title-bar-type") === "border-title"
                }
              },
              {
                name: "text-default-value",
                alias: i18next.t("title"),
                type: "string",
                default: i18next.t("defaultTitleBar"),
                visible: (widget) => {
                  return widget.getOption<barType>("title-bar-type") === "border-title"
                }
              },
              {
                name: "main-default-value",
                alias: i18next.t("mainTitle"),
                type: "string",
                default: i18next.t("defaultMainTitle"),
                visible: (widget) => {
                  return widget.getOption<barType>("title-bar-type") === "image-text-title"
                }
              },
              {
                name: "default-sub-value",
                alias: i18next.t("subTitle"),
                type: "string",
                default: i18next.t("defaultSubTitle"),
                visible: (widget) => {
                  return widget.getOption<barType>("title-bar-type") === "image-text-title"
                }
              },
              {
                name: "title-family",
                alias: i18next.t("font"),
                type: "font",
                default: {
                  family: '',
                  size: 14,
                  color: "#0089FFFF",
                  bold: true,
                  italic: false,
                  underline: false,
                  "line-through": false,
                },
                visible: (widget) => {
                  return widget.getOption<barType>("title-bar-type") === "border-title"
                }
              },
              {
                name: "title-gap",
                alias: i18next.t("fontGap"),
                type: "number(unit=px)",
                default: 0,
                visible: (widget) => {
                  return widget.getOption<barType>("title-bar-type") === "border-title"
                }
              },
              {
                name: "title-border-gap",
                alias: i18next.t("textBorderGap"),
                type: "number(unit=px)",
                default: 8,
                visible: (widget) => {
                  return widget.getOption<barType>("title-bar-type") === "border-title" &&
                  [TitleType.TITLE_1, TitleType.TITLE_2, TitleType.TITLE_3, TitleType.TITLE_4].includes(widget.getOption<titleStyleType>("title-border-style").selectVal as TitleType)
                }
              },
              {
                name: "title-align",
                alias: i18next.t("titleAlign"),
                type: "select(radioGroup)",
                default: "center",
                selectChoices: [
                  { label: i18next.t("alignLeft"), value: "left" },
                  { label: i18next.t("alignCenter"), value: "center" },
                  { label: i18next.t("alignRight"), value: "right" },
                ],
                visible: (widget) => {
                  return widget.getOption<barType>("title-bar-type") === "image-text-title"
                }
              },
              {
                name: "main-sub-title-gap",
                alias: i18next.t("mainSubTitleGap"),
                type: "number(unit=px)",
                default: 12,
                visible: (widget) => {
                  return widget.getOption<barType>("title-bar-type") === "image-text-title"
                }
              },
              {
                name: "main-title-style",
                alias: i18next.t("mainTitleStyle"),
                children: [
                  {
                    name: "main-title-font",
                    alias: i18next.t("font"),
                    type: "font",
                    default: {
                      family: '',
                      size: 18,
                      color: "#FFFFFFFF",
                      bold: true,
                      italic: false,
                      underline: false,
                      "line-through": false,
                    }
                  },
                  {
                    name: "main-title-gap",
                    alias: i18next.t("fontGap"),
                    type: "number(unit=px)",
                    default: 0,
                  },
                ],
                visible: (widget) => {
                  return widget.getOption<barType>("title-bar-type") === "image-text-title"
                }
              },
              {
                name: "sub-title-style",
                alias: i18next.t("subTitleStyle"),
                children: [
                  {
                    name: "sub-title-font",
                    alias: i18next.t("font"),
                    type: "font",
                    default: {
                      family: '',
                      size: 14,
                      color: "#FFFFFFD9",
                      bold: false,
                      italic: false,
                      underline: false,
                      "line-through": false,
                    }
                  },
                  {
                    name: "sub-title-gap",
                    alias: i18next.t("fontGap"),
                    type: "number(unit=px)",
                    default: 0,
                  },
                ],
                visible: (widget) => {
                  return widget.getOption<barType>("title-bar-type") === "image-text-title"
                }
              },
              {
                name: "title-background",
                alias: i18next.t("backgroundSettings"),
                children: [
                  {
                    name: "title-background-color",
                    alias: i18next.t("backgroundColor"),
                    type: "color",
                    default: "#0089FFFF",
                  },
                  {
                    name: "title-background-img",
                    alias: i18next.t("backgroundMedia"),
                    type: "file"
                  },
                  {
                    name: "title-background-fill",
                    alias: i18next.t("fillMode"),
                    type: "select(radioGroup)",
                    default: "repeat",
                    selectChoices: [
                      { label: i18next.t("fillStretch"), value: "fill" },
                      { label: i18next.t("fillRepeat"), value: "repeat" },
                      { label: i18next.t("fillAuto"), value: "auto" },
                    ],
                  },
                  {
                    name: "title-background-blur",
                    alias: i18next.t("backgroundBlur"),
                    type: "number(unit=px)",
                    default: 8,
                  },
                ],
                visible: (widget) => {
                  return widget.getOption<barType>("title-bar-type") === "image-text-title"
                }
              }
            ]
          },
          fieldProperty: {
            children: [
              {
                name: "is-readonly",
                visible: false
              },
              {
                name: 'is-hidden',
                alias: i18next.t("hide"),
                default: false,
                type: "boolean",
              },
            ]
          },
          fieldsControl: {
            visible: false,
          },
          validation: {
            visible: false,
          },
          linkForm: {
            visible: false,
          }
        },
      },
      ...super.defineOptions()
    ]
  }

  get supportFixedWidth() {
    return false;
  }

  get titleBarType() {
    return this.getOption<barType>("title-bar-type")
  }

  get titleValue() {
    return this.getOption<barType>("title-value")
  }

  get titleBorderColor() {
    return this.getOption<string>("title-border-color")
  }

  get titleFamily() {
    return this.getOption<titleFamilyType>("title-family")
  }

  set titleFamily(val: titleFamilyType) {
    this.setOption("title-family", val, false)
  }

  get titleGap() {
    return this.getOption<number>("title-gap")
  }

  get titleBorderGap() {
    return this.getOption<number>("title-border-gap")
  }

  get textDefaultValue() {
    return this.getOption<string>("text-default-value")
  }

  get mainDefaultValue() {
    return this.getOption<string>("main-default-value")
  }

  get defaultSubValue() {
    return this.getOption<string>("default-sub-value")
  }

  get titleAlign() {
    return this.getOption<TitleAlignType>("title-align")
  }

  get mainSubTitleGap() {
    return this.getOption<number>("main-sub-title-gap")
  }

  // 边框标题样式
  public get titleBorderStyle() {
    return this.getOption<titleStyleType>("title-border-style")
  }

  // 图文标题主标题样式
  get mainTitleFont() {
    return this.getOption<titleFamilyType>("main-title-font")
  }
  get mainTitleGap() {
    return this.getOption<number>("main-title-gap")
  }


  // 图文标题副标题样式
  get subTitleFont() {
    return this.getOption<titleFamilyType>("sub-title-font")
  }
  get subTitleGap() {
    return this.getOption<number>("sub-title-gap")
  }

  get titleBackgroundColor() {
    return this.getOption<string>("title-background-color")
  }

  get titleBackgroundBlur() {
    return this.getOption<number>("title-background-blur")
  }

  // 上传背景图片
  get titleBackgroundImg(): string | undefined {
    const imageOptions = this.getOption<FileOptionType>("title-background-img");
    let src;
    if (imageOptions) {
      const projectId = this.getBoard().projectId;
      const relativePath = imageOptions.relativePath;
      let targetSource = this.getBoard().nocodeId;
      src = relativePath ? `${targetSource}/${relativePath}` : ""
    }

    return src;
  }

  // 背景填充方式
  get titleBackgroundFill() {
    return this.getOption<BackgroundFillType>("title-background-fill")
  }
}

