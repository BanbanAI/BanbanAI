import { unique } from "@common/utils/unique";
import { WidgetSoul } from "@common/types/project";
import { BaseWidget, Widget } from "./widget";
import { EffectScope, nextTick, reactive, watch, effectScope } from "vue";
import { Board } from "./board";
import { loadWidget, markWidgetDirty, resolveWidget } from "../utils/widget.util";
import { finalizationRegistry } from "../finalization";
import i18next from "i18next";
import { isEmpty } from "@common/utils/object";

type WidgetPredicate = (widget: BaseWidget) => boolean | undefined

/**
 * container对象是reactive的，getter出来的属性也是reactive的
 * 对getter返回值的修改会触发副作用
 */
export class Container {
  private _widgets: BaseWidget[] = reactive([]);
  private _childWidgetsCreated = false;
  private _skipSoulSync = false;
  private reloadingWidgets: Record<string, BaseWidget> = {};
  public dom: HTMLElement;
  private _destroyed = false;

  constructor(public readonly souls: WidgetSoul[], private readonly owner: BaseWidget | Board) {
    this.effectScope.run(()=>{
      //TODO 可能watch的是一个大对象
      watch(()=>this.souls.map((soul)=>soul?.uid), ()=>{
        if (this._skipSoulSync) return;
        this.syncWidgets();
      }, {deep: true});
    });
  }

  getOwner() {
    return this.owner;
  }

  private _effectScope: EffectScope;
  get effectScope() {
    if (!this._effectScope) {
      this._effectScope = effectScope();
    }
    return this._effectScope;
  }

  public destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this._effectScope?.stop();
    for (const widget of this._widgets) {
      this.owner.getBoard().unsetInstancedWidget(widget.uid);
      widget.destroy();
    }
    this._widgets.splice(0, this._widgets.length);
    this.reloadingWidgets = {};
  }

  private async syncWidgets() {
    if (this._destroyed) return;
    const widgets: BaseWidget[] = [];
    for (const soul of this.souls || []) {
      if (this._destroyed) return;
      let widget = this.owner.getBoard().getInstancedWidget(soul.uid);
      if (!widget) {
        let { TheWidget, component } = resolveWidget(soul.type);
        if (!TheWidget || !component) {
          const _widget = await loadWidget(soul.type);
          if (this._destroyed) return;
          if (!_widget) {
            console.error("no widget or widget is corrupted", soul.type);
            if (!this.owner.isReady() && !this._corruptedWidgets.includes(soul)) {
              this._corruptedWidgets.push(soul);
            }
            continue;
          } else {
            TheWidget = _widget.TheWidget;
            component = _widget.component;
          }
        }
        widget = new TheWidget(soul, this.owner);
        widget.status.isNew = false;
        widget.component = component;
        this.owner.getBoard().saveInstancedWidget(widget);
        // console.debug("new Widget", widget.name);
        finalizationRegistry.register(widget, "Widget " + widget.name);
      }
      widget.parent = this.owner;
      widgets.push(widget);
    }
    this._widgets.splice(0, this._widgets.length, ...widgets);
  }

  get widgets() {
    if (!this._childWidgetsCreated) {
      this.syncWidgets();
      this._childWidgetsCreated = true;
    }
    return this._widgets;
  }

  get isFluidLayout() {
    return this.owner.layout === "fluid";
  }

  get layoutStyle() {
    const style = {};
    if (this.owner.layout === "fluid" && this.owner instanceof BaseWidget) {
      const [top, bottom, left, right] = this.owner.getOption<[number, number, number, number]>("padding");
      const flexDirection = this.owner.flexDirection;
      Object.assign(style, {
        padding: `${top}px ${right}px ${bottom}px ${left}px`,
        "flex-direction": flexDirection,
      });
      const gapType = this.owner.getOption<"adaptive"|"fixed">("fluid-gap-type");
      if (gapType === "adaptive") {
        Object.assign(style, {
          "justify-content": "space-between",
        });
      } else {
        Object.assign(style, {
          "justify-content": this.owner.getOption<string>("fluid-justify-content"),
          "--fluid-gap": `${this.owner.getOption<number>("fluid-gap-value")}px`,
        });
      }
      style["align-items"] = this.owner.getOption<string>("fluid-align-items");
    } else if (this.owner.layout === "static") {
      style["height"] = `${this.calcHeight()}px`;
    }
    if (this.owner.isFormMode) {
      Object.assign(style, {
        "flex-wrap": "wrap",
        "height": "unset",
      });
    }
    return style;
  }

  public gap = 10;

  private calcHeight() {
    let max = 0;
    for (const widget of this.widgets) {
      const maxY = widget.position.top + widget.size.height;
      if (max < maxY) {
        max = maxY;
      }
    }
    return max + this.gap;
  }

  public autoArrange() {
    if (!this.owner.status.isVisible) return;
    const widgets = [...this.widgets].sort((a, b)=>{
      const aTop = a.showEditorShadow ? a.gridTop - 0.1 : a.gridTop;
      const bTop = b.showEditorShadow ? b.gridTop - 0.1 : b.gridTop;
      return aTop - bTop;
    });
    for (let i = 0; i < widgets.length; i++) {
      const widget = widgets[i];
      const upperWidgets = widgets.slice(0, i).filter(w=>{
        if (!w.status.isVisible) return false;
        return w !== widget && 
                    w.gridLeft < widget.gridLeft + widget.gridWidth &&
                    w.gridLeft + w.gridWidth > widget.gridLeft
      });
      let newTop = 0;
      for (const upperWidget of upperWidgets) {
        newTop = Math.max(newTop, upperWidget.gridTop + upperWidget.gridHeight);
      }
      widget.gridTop = newTop;
    }
  }

  get reversedWidgets() {
    //important 解构后再reverse，防止对原始对象的修改
    if (this.owner.layout === "fluid") {
      return [...this.widgets];
    }
    return [...this.widgets].reverse();
  }

  private _corruptedWidgets: WidgetSoul[] = [];
  clearCorruptedWidgets() {
    this._corruptedWidgets = [];
  }
  hasWidgetSynced() {
    return this.souls.length === this.widgets.length + this._corruptedWidgets.length;
  }

  isVisible() {
    return this.owner.status.isVisible;
  }

  get isEditable() {
    return this.owner.isEditable;
  }

  public shouldShowWidget(widget: BaseWidget) {
    if (this.owner instanceof Board) {
      return true;
    } else if ((widget as any).topForm?.isForceShownWidget?.(widget)) {
      return true;
    } else {
      return this.owner.isChildShow(widget);
    }
  }

  async reloadWidget(widget: Widget) {
    this.reloadingWidgets[widget.uid] = widget;
    const index = this.souls.findIndex((soul)=>soul.uid === widget.uid);
    const soul = this.souls.splice(index, 1)[0];
    widget.destroy(true);
    this.owner.getBoard().unsetInstancedWidget(widget.uid);
    await markWidgetDirty(widget.type);
    await loadWidget(widget.type);
    await nextTick();
    this.souls.splice(index, 0, soul);
    this.syncWidgets();
    delete this.reloadingWidgets[widget.uid];
    return this.widgets.find(widget => widget.uid === soul.uid);
  }

  onSave() {
    if (!isEmpty(this.reloadingWidgets)) throw new Error(i18next.t("containerTs.saveError"));
  }

  getChildWidget(uid: string) {
    return this.getChildWidgets(true, w => w.uid === uid)?.[0];
  }

  /**
   * 默认允许所有类型组件放入
   * 设置了childTypes之后仅允许放入符合类型的子组件
   */
  private _childTypes: string[];
  get childTypes() {
    return this._childTypes ?? [];
  }
  set childTypes(value: string[]) {
    this._childTypes = value;
  }
  isChildTypeValid(type: string) {
    if(!this.childTypes.length) return true;
    return this.childTypes.includes(type);
  }

  /**
   * 获取当前容器的子组件
   * @param recursively 是否递归
   * @param predicate 对每个widget进行判定（默认为永真判定）
   *                  返回true则获取当前widget且检查其子组件
   *                  返回false则忽略当前组件且不检查其子组件
   *                  返回undefined则忽略当前组件且检查其子组件
   */
  getChildWidgets(recursively=false, predicate: WidgetPredicate=null) {
    const widgets: BaseWidget[] = [];
    for (const widget of this.widgets) {
      let ret = true;
      if (typeof predicate === "function") {
        ret = predicate(widget);
      }
      if (ret === true) {
        widgets.push(widget);
      }
      if (recursively && widget.container) {
        widgets.push(...widget.container.getChildWidgets(true, predicate));
      }
    }
    return widgets;
  }

  checkSoulUid(soul: WidgetSoul) {
    if (!soul.uid) {
      soul.uid = unique();
      soul.isNew = true;
    }
    for(const widgetSoul of soul.widgets ?? []) {
      this.checkSoulUid(widgetSoul);
    }
  }

  public updateHistory() {
    this.owner.getBoard()?.updateHistory();
  }

  async addWidget(typeOrSoul: string | WidgetSoul, index: number, _isTemplate?: boolean) {
    let soul: WidgetSoul;
    if (typeof typeOrSoul === "string") {
      soul = {
        type: typeOrSoul,
        options: {
          "background-fill-type": "stretch",
        }
      };
    } else {
      soul = typeOrSoul;
    }
    if(!this.isChildTypeValid(soul.type)) throw new Error(i18next.t("containerTs.invalidTypeError"));
    soul.preventLockEvent = true;
    this.checkSoulUid(soul);
    await loadWidget(soul.type);
    if (index < this.souls.length) {
      this.souls.splice(index, 0, soul);
    } else {
      this.souls.push(soul);
    }
    this.updateHistory();
    await this.syncWidgets();
    const widget = this.widgets.find(widget => widget.uid === soul.uid);
    if(!widget) return null;
    if (this.owner.layout === "static") {
      const tops: number[] = [];
      for (let i = 0; i < 60; i++) {
        tops[i] = 0;
      }
      for (const w of this.widgets) {
        if (w === widget) continue;
        for (let i = w.gridLeft; i < w.gridLeft + w.gridWidth; i++) {
          tops[i] = Math.max(tops[i], w.gridTop + w.gridHeight);
        }
      }
      const topInfos = tops.map((top, index)=>{
        return { top, index };
      }).sort((a, b)=>a.top - b.top);
      for (const {top, index} of topInfos) {
        if (index + widget.gridWidth < 60 && tops.slice(index, widget.gridWidth).filter(val=>val>top).length === 0) {
          widget.gridLeft = index;
          widget.gridTop = top;
          this.updateHistory();
          break;
        }
      }
    }
    widget.clearGroupStatusFold();
    this.autoArrange();
    return widget;
  }

  async syncWidgetsBatch(nextSouls: WidgetSoul[]) {
    this._skipSoulSync = true;
    try {
      this.souls.push(...nextSouls);
      await this.syncWidgets();
      this._childWidgetsCreated = true;
    } finally {
      this._skipSoulSync = false;
    }
  }

  removeWidget(uid: string): WidgetSoul {
    this.owner.getBoard().unsetInstancedWidget(uid);
    const index = this.souls.findIndex(item => item.uid === uid);
    const returnValue = this.souls.splice(index, 1)[0];
    this.owner.getBoard().updateHistory();
    return returnValue;
  }
  detachWidget(uid: string): WidgetSoul {
    const index = this.souls.findIndex(item => item.uid === uid);
    const returnValue = this.souls.splice(index, 1)[0];
    this.syncWidgets();
    return returnValue;
  }
  async prepend(soul: WidgetSoul) {
    this.souls.unshift(soul);
    this.owner.getBoard().updateHistory();
  }
  async append(soul: WidgetSoul) {
    this.souls.push(soul);
    this.owner.getBoard().updateHistory();
  }
  async insertAfter(soul: WidgetSoul, uid: string) {
    const index = this.souls.findIndex(item => item.uid === uid);
    this.souls.splice(index, 0, soul);
    this.owner.getBoard().updateHistory();
  }
  async insertBefore(soul: WidgetSoul, uid: string) {
    const index = this.souls.findIndex(item => item.uid === uid);
    this.souls.splice(index + 1, 0, soul);
    this.owner.getBoard().updateHistory();
  }
  async insertByIndex(souls: WidgetSoul[], index: number) {
    this.souls.splice(index, 0, ...souls);
    this.owner.getBoard().updateHistory();
  }
  moveWidgetTop(uid: string) {
    let index = this.souls.findIndex((soul)=>soul.uid === uid);
    if (index < 0) {
      return;
    }
    const soul = this.souls.splice(index, 1);
    this.souls.push(...soul);
    this.owner.getBoard().updateHistory();
  }
  moveWidgetBottom(uid: string) {
    let index = this.souls.findIndex((soul)=>soul.uid === uid);
    if (index < 0) {
      return;
    }
    const soul = this.souls.splice(index, 1);
    this.souls.unshift(...soul);
    this.owner.getBoard().updateHistory();
  }
  moveWidgetUp(uid: string) {
    let index = this.souls.findIndex((soul)=>soul.uid === uid);
    if (index < 0 || index === this.souls.length - 1) {
      return;
    }
    const soul = this.souls.splice(index, 1);
    this.souls.splice(index+1, 0, ...soul);
    this.owner.getBoard().updateHistory();
  }
  moveWidgetDown(uid: string) {
    let index = this.souls.findIndex((soul)=>soul.uid === uid);
    if (index < 1) {
      return;
    }
    const soul = this.souls.splice(index, 1);
    this.souls.splice(index-1, 0, ...soul);
    this.owner.getBoard().updateHistory();
  }

  moveWidget(selectedWidgets: Widget[], offsetX: number, offsetY: number) {
    selectedWidgets.forEach(widget => {
      widget.position = {
        left: widget.position.left + offsetX,
        top: widget.position.top + offsetY,
      };
    });
  }
}
