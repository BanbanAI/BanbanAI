import { DefinedOptions } from "@renderer/b2/types";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { TheWidget as FilterMenu } from "@renderer/widgets/basic/filter-menu";

export class HorizontalFilterMenu extends FilterMenu {
  get styleCategory() {
    return "card";
  }

  static defineOptions(): DefinedOptions[] {
    return [{
      data: {
        relationship: {
          alias: i18next.t('menuOption')
        },
      },
      style: {
        basic: {
          children: [
            {
              name: "grid-height",
              default: 6,
            },
            {
              name: "grid-width",
              default: 18,
            },
            {
              name: "no-events",
              visible: false
            },
            {
              name: "dropdown-no-data",
              visible: false
            },
          ]
        },
        "widget-title": {
          default: true,
          children: [
            {
              name: "widget-title-text",
              alias: i18next.t('title'),
              type: "string",
              default: i18next.t('horizontalMenu'),
            },
          ]
        },
        layoutStyle: {
          visible: false
        }
      }
    }, ...super.defineOptions()]
  }
}
