import { DefinedOptions } from "@renderer/b2/types";
import { Board } from "@renderer/b2/controllers/board";
import { Soul } from "@common/types/project";
import { Widget } from "@renderer/b2/controllers/widget";
import { resolveWidget } from "@renderer/b2/utils/widget.util";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";

export class Panel extends Widget {
  public childResizeFollow: boolean = true;
  constructor(soul: Soul, parent: Widget | Board) {
    super(soul, parent);
    this.initContainer();
    if (this.parent.getSoul().type === "widget.group.panel-tab") {
      this.isMoveable = false;
      this.position = {left: this.parent.containerGap ?? 0, top: this.parent.containerGap ?? 0};
    }
  }

  get defaultName() {
    return i18next.t("defaultName");
  }
  static resource = resource;

  get childStateFollow(): boolean{
    return this.getOption<boolean>("child-state-follow");
  }

  static defineOptions(): DefinedOptions[] {
    return [{
      style: {
        basic: {
          children:[
            {
              name: "children-no-events",
              alias: i18next.t("childrenNoEvents"),
              type: "boolean",
              default: false,
              visible: (element: Panel) => element.getOption<boolean>("no-events")
            },
            {
              name: "child-state-follow",
              alias: i18next.t("childStateFollow"),
              default: false,
              visible: false,
              type: "boolean",
            },
          ]
        },
        padding: {
          visible: false,
        }
      }
    }, ...Widget.defineOptions()];
  }

  get virtualPath() {
    return resolveWidget("widget.group.panel").TheWidget.prototype.virtualPath;
  }

  get defaultPadding() {
    return {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0
    }
  }
}
