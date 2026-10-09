import { unique } from "@common/utils/unique";
import { DefinedOptions } from "@renderer/b2/types";
import { Soul } from "@common/types/project";
import { Widget } from "@renderer/b2/controllers/widget";
import { Board } from "@renderer/b2/controllers/board";
import { TheWidget as Tab } from "@renderer/widgets/group/tab";
import resource from "./locales";
import { recursive } from "merge";
import i18next from "@renderer/widgets/i18next";
import { ref, watch } from "vue";
export type TabsTitleItem = {
  id: string;
  label?: string;
  value: string;
  color?: string;
};

export type TabsTitleFont = {
  family?: string,
  size: number,
  color: string,
  bold: boolean,
  italic?: boolean,
  underline?: boolean,
  "line-through"?: boolean,
};

export type ColorOptions = {
  checkedValue?: string;
  isColored: boolean;
  options: TabsTitleItem[];
  otherOptions?: { id: string; value: string };
};
export class PanelTab extends Tab {
  static resource = recursive(true,  resource);

  get defaultName() {
    return i18next.t("defaultName");
  }
  constructor(soul: Soul, parent: Widget | Board) {
    super(soul, parent);
    this.container.childTypes = ["widget.group.panel"];
    // 是否是第一次（第一次主动加3个tab）避免新建多个选项卡时面板uid一样
    if(!this.getOption("is-first-create")) {
      this.setOption("panel-button-name", {
        options: [
          {
            id: unique(),
            label: i18next.t("buttonName") + "1",
            value: i18next.t("buttonName") + "1",
          },

          {
            id: unique(),
            label: i18next.t("buttonName") + "2",
            value: i18next.t("buttonName") + "2",
          },
          {
            id: unique(),
            label: i18next.t("buttonName") + "3",
            value: i18next.t("buttonName") + "3",
          },
        ],
      })
      this.setOption("is-first-create", true)
    }
  }

  static defineOptions(): DefinedOptions[] {
    const buttonText = i18next.t("buttonName");
    return [
      {
        data: {
          //联动字段绑定
          relationship: {
            visible: false,
            children: [
              {
                name: "linkage-field",
                alias: i18next.t("linkageField"),
                type: "string",
                default: "",
              },
              {
                name: "linkage-values",
                alias: i18next.t("linkageValues"),
                type: "mapping",
                keys: (widget: Tab) => {
                  return widget.getOption<ColorOptions>("panel-button-name").options.map(item => item.value) || []
                },
              }
            ]
          }
        },
        style: {
          "basic": {
            children: [
              {
                name: "first-paint",
                type: "boolean",
                default: true,
                visible: false
              },
              {
                name: "panel-button-name",
                alias: i18next.t("panelButtonName"),
                type: `tabs-array(draggable, defaultString=${buttonText})`,
                default: {
                  options: []
                }
              },
              {
                name: "is-first-create",
                type: 'hidden',
                visible: false
              },
            ]
          },
        }
      },
      ...super.defineOptions()
    ]
  }

  get panelButtonNameOptionList() {
    return this.getOption<ColorOptions>("panel-button-name").options || [];
  }

  get panelButtonNameOption() {
    return this.getOption<ColorOptions>("panel-button-name");
  }

  get buttonNameList() {
    let nameArray = [];
    let values = this.panelButtonNameOptionList;
    for (let i = 0; i < values.length; i++) {
      let val = values[i].value;
      val = String(val).trim();
      if (!val) continue;
      nameArray.push(val);
    }
    return nameArray;
  }

  getPrivateFiledAlias() {
    return this.getOption("linkage-field") ? [this.getOption("linkage-field")] : [];
  }
}
