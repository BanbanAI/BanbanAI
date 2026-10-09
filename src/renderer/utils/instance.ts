
import { Board } from "@renderer/b2/controllers/board";
import { FormElement } from "@renderer/b2/controllers/form";
import { resolveWidget } from "@renderer/b2/utils/widget.util";
import { loadWidget } from "@renderer/b2/utils/widget.util";
class FormElementInstances {
  private elements: Record<string, FormElement> = {};
  private board: Board;
  constructor() {
  }
  private initBoard() {
    if (this.board) return;
    this.board = new Board({ type: "board" }, {} as any);
  }
  private async initInstance(type: string) {
    let { TheWidget } = resolveWidget(type);
    if (!TheWidget) {
      const _widget = await loadWidget(type);
      if (!_widget) {
        console.error("no widget or widget is corrupted", type);
      } else {
        TheWidget = _widget.TheWidget;
      }
    }
    if (!this.board) this.initBoard();
    const instance = new TheWidget({ type }, this.board) as FormElement;
    this.elements[type] = instance;
    return instance;
  }
  async getInstance(type: string) {
    const element = this.elements[type];
    if (element) return element;
    return await this.initInstance(type);
  }
}

export const formElementInstances = new FormElementInstances();