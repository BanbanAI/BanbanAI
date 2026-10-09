import { Board } from "@renderer/b2/controllers/board";
import { Widget } from "@renderer/b2/controllers/widget";
import { isEmpty } from "@common/utils/object";

export type LayerBoard = {
  board: Board,
  crumbs: string[],
  children: LayerWidget[],
}

export type LayerWidget = {
  widget: Widget,
  children?: LayerWidget[],
}
