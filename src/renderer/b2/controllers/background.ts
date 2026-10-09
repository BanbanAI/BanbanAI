import { Color } from "../color";
import { DefinedOptions, NinePatch, OptionColorValue, OptionFileValue } from "../types";
import { Element } from "./element";
import i18next from "i18next";

export class Background {
  static defineOptions(): DefinedOptions {
    return {
      style: {
        border: {
          alias: i18next.t("backgroundTs.borderSetting"),
          type: 'boolean',
          default: false,
          children: [
            {
              name: 'border-color',
              alias: i18next.t("backgroundTs.borderColor"),
              type: 'color',
              default: '#cccccc',
            },
            {
              name: 'border-width',
              alias: i18next.t("backgroundTs.borderWidth"),
              type: 'number(unit=px)',
              default: 1,
            },
            {
              name: 'border-radius',
              alias: i18next.t("backgroundTs.borderRadius"),
              type: 'number(unit=px)',
              default: 0,
            },
            {
              name: 'border-style',
              alias: i18next.t("backgroundTs.borderStyle"),
              type: 'select(radioGroup)',
              selectChoices: [
                { value: 'solid', label: i18next.t("backgroundTs.borderSolid") },
                { value: 'dashed', label: i18next.t("backgroundTs.borderDashed") },
                { value: 'dotted', label: i18next.t("backgroundTs.borderDotted") },
                { value: 'none', label: i18next.t("backgroundTs.borderNone") },
              ],
              default: 'solid',
            },
          ],
        },
        background: {
          alias: i18next.t("backgroundTs.backgroundSetting"),
          type: 'boolean',
          default: true,
          children: [
            {
              name: 'background-color',
              alias: i18next.t("backgroundTs.backgroundColor"),
              type: 'color(gradient)',
              default: "#FFFFFF",
            },
            {
              name: 'background-image',
              alias: i18next.t("backgroundTs.backgroundImage"),
              type: 'file(format=image|video,preview)',
            },
            {
              name: 'background-fill-type',
              alias: i18next.t("backgroundTs.backgroundFillType"),
              type: 'select(radioGroup)',
              selectChoices: [
                { value: 'stretch', label: i18next.t("backgroundTs.backgroundStretch") },
                { value: 'tile', label: i18next.t("backgroundTs.backgroundTile") },
                { value: 'none', label: i18next.t("backgroundTs.backgroundNoneFill") },
              ],
              default: 'tile',
            },
            {
              name: "use-nine-patch",
              alias: i18next.t("backgroundTs.isUseNinePatch"),
              type: "boolean",
              default: false,
              visible: (element) => {
                return element.getOption("background-fill-type") === 'stretch';
              }
            },
            {
              name: "nine-patch",
              alias: i18next.t("backgroundTs.ninePatch"),
              type: "nine-patch",
              visible: (element) => {
                return  element.getOption("background-fill-type") === 'stretch' && element.getOption("use-nine-patch");
              },
              imageSource: (element) => {
                return element.getOption("background-image");
              }
            },
            {
              name: "background-image-scale",
              alias: i18next.t("backgroundTs.backgroundScale"),
              type: "number(unit=%)",
              default: 100,
              visible: (element) => {
                return element.getOption(["background-fill-type"]) === "none";
              }
            },
            {
              name: "background-image-position",
              alias: i18next.t("backgroundTs.backgroundPosition"),
              type: "vector<X,Y>(unit=%)",
              default: [0, 0],
              visible: (element) => {
                return element.getOption(["background-fill-type"]) === "none";
              }
            },
            {
              name: 'background-blur',
              alias: i18next.t("backgroundTs.backgroundBlur"),
              type: 'number(unit=px)',
              default: 0,
            }
          ],
        },
      }
    };
  }

  constructor(public element: Element) {
  }

  get enabled(): boolean {
    return this.element.getOption('background');
  }

  get color(): Color {
    let color = this.element.getOption<OptionColorValue>('background-color');
    return new Color(color);
  }

  get fillType(): 'stretch' | 'tile' | 'none' {
    return this.element.getOption('background-fill-type');
  }

  get isUseNinePatch() {
    return this.fillType === 'stretch' && this.element.getOption("use-nine-patch");
  }

  get ninePatch(): NinePatch {
    return this.element.getOption("nine-patch");
  }

  get imageScale() {
    return this.element.getOption("background-image-scale");
  }

  get imagePosition() {
    return this.element.getOption("background-image-position");
  }

  get image(): OptionFileValue {
    return this.element.getOption('background-image') as OptionFileValue;
  }

  get blur(): number {
    return this.element.getOption('background-blur');
  }

  get border() {
    return {
      enabled: this.element.getOption('border'),
      color: new Color(this.element.getOption('border-color')).toCssString(),
      width: this.element.getOption('border-width'),
      style: this.element.getOption('border-style'),
      radius: this.element.getOption('border-radius'),
    };
  }

}