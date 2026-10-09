import { DefinedOptions } from "@renderer/b2/types";
import { Board } from "@renderer/b2/controllers/board";
import { Soul } from "@common/types/project";
import { Widget } from "@renderer/b2/controllers/widget";
import { TheWidget as DataFilter } from "../filter";
import i18next from "@renderer/widgets/i18next";

export class FilterInput extends DataFilter {

  static defineOptions(): DefinedOptions[] {
    return [{
      style: {
        basic: {
          children: [
            {
              name: "dropdown-tip-text",
              alias: i18next.t('inputTipText'),
              type: "string",
              default: i18next.t('pleaseInput'),
              visible: true
            },
          ]
        },
        "custom-widget-title": {
          default: true,
          children: [
            {
              name: "custom-widget-title-text",
              alias: i18next.t('title'),
              type: "string",
              default: i18next.t('inputFilter'),
            },
            {
              name: "custom-widget-font",
              alias: i18next.t('fontSec'),
              type: "font(underline, line-through, noSize)",
              default: {
                family: 'sans-serif',
                size: 14,
                color: "#111111",
                bold: false,
                italic: false,
                underline: false,
                "line-through": false
              },
            },
          ]
        },
      }
    }, ...super.defineOptions()]
  }

  constructor(soul: Soul, parent: Widget | Board) {
    super(soul, parent);
  }

  initAfterConstructor() {
    super.initAfterConstructor();
  }
}

