import { unique } from "@common/utils/unique";
import { Options, FieldUID } from "@common/types/project";
import { replaceUID } from "@common/utils/replace";
import { transformCondition, SystemField, getUUIDSystemField, isNocodeFormData, isSystemField, transformConditionsGroup } from "@common/utils/connection";
import { createFormulaRuntimeByWidget } from "@common/utils/formula";
import { DefinedOptions, WidgetStatus, Linkage, isBoard, CloneParams, isWidget, WidgetMetaData, Filter, DataCollectionOptions, DataEncode, DataFormat, SelectChoice, LogicalOperator } from "../types";
import { Soul, WidgetSoul } from "@common/types/project";
import { Element } from "./element";
import { Container } from "./container";
import { Background } from "./background";
import { Component, defineAsyncComponent, effectScope, EffectScope, nextTick, reactive, ref, Ref, unref, watch } from "vue";
import { Board } from "./board";
import EventEmitter from "eventemitter2";
import { settleRefreshTask, waitForAll } from "../utils/auto-refresh.util";
import i18next from 'i18next';
import { deepClone, equals, isEmpty } from "@common/utils/object";
import { useResizeObserver } from "@vueuse/core";
import { Field, OptionFieldUID, OptionTableUID, QueryOptions, SortType, WhereCondition } from "@common/types/project";
import { FormCondition } from "@common/types/nocode";
import { formDataApi, isMobile } from "@renderer/utils";
import { intersection } from "lodash";

const systemFieldNameOfFilter = [ SystemField.CREATE_TIME, SystemField.UPDATE_TIME, SystemField.CREATE_OWNER, SystemField.DATA_OWNER ]

export class BaseWidget extends Element {
  static resource = {};
  declare static namespace: string;
  declare protected soul: WidgetSoul;
  declare public getSoul: () => WidgetSoul;
  declare public parent: BaseWidget | Board;
  declare public status: WidgetStatus;
  public emitter: EventEmitter = new EventEmitter();
  private _container: Container;
  public loadingProgressEnabled = false;
  public effectedOpacity: Ref<number> = ref();
  public opacityRatio: number = 1;
  public noEvents:Ref<Boolean> = ref(false);
  public childResizeFollow: boolean = false;

  public _showEditorShadow = ref(false);
  public get showEditorShadow() {
    return this._showEditorShadow.value;
  }
  public set showEditorShadow(value: boolean) {
    if (this._showEditorShadow.value !== value) {
      this._showEditorShadow.value = value;
    }
  }

  constructor(soul: WidgetSoul, parent: BaseWidget | Board) {
    super(soul, parent);
  }
  isChildShow(widget: BaseWidget) {
    return true;
  }
  protected initAfterConstructor() {
    super.initAfterConstructor();
  }
  get type() {
    return "widget";
  }
  get primitiveType() {
    return "widget";
  }
  get path(): [boardUID?: string, widgetUID?: string] {
    return [...this.getBoard().path, this.uid];
  }
  get container() {
    return this._container;
  }
  get virtualPath() {
    return "";
  }
  get toolbar(): Component {
    return null;
  }

  /** 是否禁止直接编辑（禁止直接编辑的组件只有双击才能进入编辑） */
  get disableDirectEditing() {
    return !!this.container;
  }

  get elementUID() {
    return [...this.getBoard().elementUID, this.uid];
  }

  initContainer() {
    if (this._container) {
      console.warn("Container can only be initialized once");
      return;
    }
    if (!this.soul.widgets) {
      this.soul.widgets = [];
    }
    this._container = new Container(this.soul.widgets, this);
  }
  get layout() {
    return this.getOption<"static"|"fluid">("container-layout");
  }
  get flexDirection() {
    return this.getOption<"row"|"column">("flex-direction");
  }
  get widgets(): BaseWidget[] {
    return unref(this.container?.widgets) || [];
  }
  get children() {
    return this.widgets;
  }
  public getParentWidgets() {
    const parents: BaseWidget[] = [];
    let parent = this.parent;
    while (parent && isWidget(parent)) {
      parents.push(parent);
      parent = parent.parent;
    }
    return parents;
  }
  get locked() {
    const selfLocked = this.soul.locked ?? false;
    return selfLocked || this.parent.locked;
  }
  set locked(locked: boolean) {
    this.soul.locked = locked;
    this.getBoard().updateHistory();
  }
  get preventLockEvent() {
    return this.soul.preventLockEvent ?? false
  }
  private _defaultPosition: [number, number];
  get defaultPosition(){
    return this._defaultPosition ?? [0, 0];
  }
  set defaultPosition(value: [number, number]){
    this._defaultPosition = value;
  }
  get position() {
    const gap = this.parent.containerGap;
    const left = isMobile() ? 0 : (this.gridLeft / 60 * (this.parent.size.width-gap) + gap);
    const top = this.gridTop * 15 + gap;
    return {left, top};
  }
  set position(position: { left: number, top: number }) {
    const gap = this.parent.containerGap;
    this.gridLeft = Math.round((position.left-gap) / (this.parent.size.width-gap) * 60);
    this.gridTop = Math.round((position.top-gap) / 15);
  }
  get size() {
    if (this.useFluidSize) {
      return this.fluidSize;
    }
    const gap = this.parent.containerGap;
    const width = isMobile() ? this.parent.size.width : (this.gridWidth / 60 * (this.parent.size.width-gap) - gap);
    const height = this.gridHeight * 15 - gap;
    return { width, height };
  }
  set size(size: { width: number, height: number }) {
    const gap = this.parent.containerGap;
    this.gridWidth = Math.round((size.width+gap) / (this.parent.size.width-gap) * 60);
    this.gridHeight = Math.round((size.height+gap) / 15);
  }

  get containerGap() {
    return this.container?.gap ?? 0;
  }

  get contentSize() {
    if (!this.widgetTitleEnabled) {
      return this.size;
    }
    const { width, height } = this.size;
    return { width, height: height - this.widgetTitleHeight };
  }

  get gridLeft() {
    return this.getOption<number>("grid-left");
  }
  set gridLeft(value) {
    if (this.gridLeft !== value) {
      this.setOption("grid-left", Math.max(0, Math.min(value, 60)), false);
    }
  }
  get gridTop() {
    return this.getOption<number>("grid-top");
  }
  set gridTop(value) {
    if (this.gridTop !== value) {
      this.setOption("grid-top", Math.max(0, value), false);
    }
  }
  get gridWidth() {
    // 检查是否使用自定义宽度
    const widthMode = this.getOption<"proportion"|"customize">("grid-width-option");
    if (widthMode === "customize") {
      // 使用自定义宽度值
      return this.getOption<number>("grid-width");
    } else if (widthMode === "proportion") {
      // 使用比例宽度值计算实际宽度
      const proportion = this.getOption<number>("grid-width-proportion");
      // 最大宽度为60格，根据比例计算
      const calculatedWidth = Math.max(this.minGrid.width, Math.round(60 * proportion));
      
      return calculatedWidth;
    }
    // 默认返回自定义宽度
    return this.getOption<number>("grid-width");
  }
  set gridWidth(value) {
    // 检查是否使用自定义宽度
    const widthMode = this.getOption<"proportion"|"customize">("grid-width-option");
    if (widthMode === "customize") {
      // 设置自定义宽度值
      if (this.getOption<number>("grid-width") !== value) {
        this.setOption("grid-width", Math.max(this.minGrid.width, value), false);
      }
    } else {
      // 在固定比例模式下，如果设置了新的宽度值，则自动切换到自定义模式
      // 并设置该宽度值
      this.setOption("grid-width-option", "customize", false);
      if (this.getOption<number>("grid-width") !== value) {
        this.setOption("grid-width", Math.max(this.minGrid.width, value), false);
      }
    }
  }
  get gridHeight() {
    return this.getOption<number>("grid-height");
  }
  set gridHeight(value) {
    if (this.gridHeight !== value) {
      this.setOption("grid-height", Math.max(this.minGrid.height, value), false);
    }
  }

  get minGrid() {
    return { width: 2, height: 2 };
  }

  private get useFluidSize() {
    return !this.fluidAutoHeight && this.parent.layout === "fluid";
  }
  private _fluidSize: Ref<{width: number, height: number}> = ref({width: 0, height: 0});
  private get fluidSize() {
    return this._fluidSize.value;
  }
  private _fluidEffectScope?: EffectScope;
  public startWatchFluidSize(bodyDom: HTMLElement|Ref<HTMLElement>) {
    this._fluidEffectScope?.stop();
    this._fluidEffectScope = effectScope();
    this._fluidEffectScope.run(()=>{
      let stopResizeObserver: Function;
      watch(()=>this.useFluidSize, (value)=>{
        stopResizeObserver?.();
        if (value) {
          const {stop} = useResizeObserver(bodyDom, (entries)=>{
            const entry = entries[0];
            const { width, height } = entry.contentRect;
            this._fluidSize.value = { width, height };
          });
          stopResizeObserver = stop;
        }
      }, {immediate: true});
    });
  }

  private _rotate: Ref<[number, number, number]> = ref(undefined);
  get rotate() {
    if (this._rotate.value === undefined) {
      this.effectScope.run(()=>{
        watch(()=>this.getOption<[number, number, number]>("rotate"), (value, oldValue)=>{
          if (!equals(value, oldValue)) {
            this._rotate.value = value;
          }
        }, {immediate: true});
      });
    }
    const [x, y, z] = this._rotate.value;
    return { x, y, z };
  }
  set rotate(rotate: { x: number, y: number, z: number }) {
    this.setOption("rotate", [Math.round(rotate.x), Math.round(rotate.y), Math.round(rotate.z)]);
  }
  get opacity() {
    const opacity = this.getOption<number>("opacity") ?? 100;
    return opacity / 100;
  }
  get offset(): { x: number, y: number } {
    const offset = this.parent.offset;
    const deviationOffset = isBoard(this.parent) ? {x:0, y:0} : this.parent.getChildDeviationOffset();
    return {
      x: offset.x + deviationOffset.x * this.scaling.x + this.position.left * this.scaling.x,
      y: offset.y + deviationOffset.y * this.scaling.x + this.position.top * this.scaling.y,
    }
  }
  getChildDeviationOffset() {
    return {x:0, y:0};
  }

  get shouldShowMask(): boolean {
    const baseJudge = this.isEditable && !this.isPlaying && !this.locked && this.disableDirectEditing && !this.isFormMode;
    if (!baseJudge) {
      return false;
    }
    return !this.status.canEditorChild;
  }

  /** 是否阻止键盘上下左右移动组件 */
  get preventKeyboardMove() {
    return false;
  }

  /** 是否支持自动宽高 */
  get supportAutoSize(): boolean {
    return false;
  }
  get widthRatio() {
    return this.getOption<number>("width-ratio");
  }
  /** 组件在流式布局模式下，宽度是否可以被内容撑开 */
  get fluidAutoWidth() {
    return true;
  }
  /** 组件在流式布局模式下，高度是否可以被内容撑开 */
  get fluidAutoHeight() {
    return true;
  }
  get layoutStyle() {
    const style = {};
    const containerLayout = this.parent.layout;
    if (containerLayout === "static") {
      const { left, top } = this.position;
      const { width, height } = this.size;
      if (isMobile()) {
        Object.assign(style, {
          width: `${width}px`,
          height: `${height}px`,
        });
      } else {
        Object.assign(style, {
          position: "absolute",
          left: `${left}px`,
          top: `${top}px`,
          width: `${width}px`,
          height: `${height}px`,
        });
      }
    } else if (containerLayout === "fluid") {
      Object.assign(style, {
        contain: "layout",
        flex: "0 0 auto",
      });
      if (this.isFormMode) {
        const widthRatio = this.getBoard().widthRatio || this.widthRatio;
        let flexBasis: string;
        if (widthRatio === 1) {
          flexBasis = "100%";
        } else if (widthRatio === 0.75) {
          flexBasis = "calc(75% - var(--fluid-gap) / 2)";
        } else if (widthRatio > 0.6) {
          flexBasis = "calc(66.666% - var(--fluid-gap) / 2)";
        } else if (widthRatio === 0.5) {
          flexBasis = "calc(50% - var(--fluid-gap) / 2)";
        } else if (widthRatio === 0.4) {
          flexBasis = "calc(40% - var(--fluid-gap) * 3 / 5)";
        } else if (widthRatio > 0.3) {
          flexBasis = "calc(33.333% - var(--fluid-gap) * 2 / 3)";
        } else if (widthRatio === 0.25) {
          flexBasis = "calc(25% - var(--fluid-gap) * 3 / 4)";
        } else if (widthRatio === 0.2) {
          flexBasis = "calc(20% - var(--fluid-gap) * 4 / 5)";
        } else if (widthRatio === 1 / 6) {
          flexBasis = "calc(16.666% - var(--fluid-gap) * 5 / 6)";
        } else if (widthRatio === 0.1) {
          flexBasis = "calc(10% - var(--fluid-gap) * 9 / 10)";
        }
        Object.assign(style, {
          width: flexBasis,
          flex: `0 0 ${flexBasis}`,
        });
      } else {
        const containerFlexDirection = this.parent.flexDirection;
        const widthType = this.getOption<"adaptive"|"px"|"auto">("fluid-width-type");
        if (widthType === "adaptive") {
          if (containerFlexDirection === "row") {
            style["flex"] = "1 1 auto";
          }
          const [minWidth, maxWidth] = this.getOption<[number, number]>("fluid-width-minmax");
          Object.assign(style, {
            width: "100%",
            "min-width": `${minWidth}px`,
          });
          if (maxWidth > 0) {
            style["max-width"] = `${maxWidth}px`;
          }
        } else if (widthType === "px") {
          Object.assign(style, {
            width: `${this.getOption<number>("fluid-width-px")}px`,
          });
        }
        const heightType = this.getOption<"adaptive"|"px"|"auto">("fluid-height-type");
        if (heightType === "adaptive") {
          if (containerFlexDirection === "column") {
            style["flex"] = "1 1 auto";
          }
          const [minHeight, maxHeight] = this.getOption<[number, number]>("fluid-height-minmax");
          Object.assign(style, {
            height: "100%",
            "min-height": `${minHeight}px`,
          });
          if (maxHeight > 0) {
            style["max-height"] = `${maxHeight}px`;
          }
        } else if (heightType === "px") {
          Object.assign(style, {
            height: `${this.getOption<number>("fluid-height-px")}px`,
          });
        }
      }
    }
    return style;
  }

  get contentStyle() {
    return {};
  }

  public get shouldLoad() {
    return this.enabled;
  }

  isReady():boolean{
    if(!this.shouldLoad) return true;
    if(!super.isReady()) return false;
    if(!this.status.isMounted) return false;
    if(this.container && !this.container?.hasWidgetSynced()) return false;
    for(const widget of this.widgets){
      if(!widget.isReady()) return false;
    }
    this.container && this.container.clearCorruptedWidgets();
    return true;
  }


  remove(){
    this.parent.container.removeWidget(this.uid);
    this.destroy();
    nextTick(() => {
      this.parent.container.autoArrange();
    })
  }
  detach(): Soul {
    return this.parent.container.detachWidget(this.uid);
  }
  static defineOptions(): DefinedOptions[] {
    return [{
      style: {
        basic: {
          alias: i18next.t("widgetTs.widgetBasicSetting"),
          fold: "unfold",
          children: [
            {
              name: "grid-width-option",
              alias: i18next.t('widget.width'),
              type: "select(radioGroup)",
              default: "customize",
              visible: (widget: Widget)=>{
                return widget.parent.layout !== "fluid";
              },
              selectChoices: [
                { label: i18next.t('widget.fixedRatio'), value: "proportion" },
                { label: i18next.t('widget.custom'), value: "customize" },
              ],
            },
            {
              name: "grid-width-proportion",
              alias: "",
              type: "select(radioGroup)",
              default: 0.25,
              visible: (widget: Widget)=>{
                return widget.parent.layout !== "fluid" && widget.getOption<"proportion"|"customize">("grid-width-option") === "proportion";
              },
              selectChoices: [
                { label: "1/6", value: 1 / 6 },
                { label: "1/5", value: 0.2 },
                { label: "1/4", value: 0.25 },
                { label: "1/3", value: 1 / 3 },
                { label: "1/2", value: 0.5 },
                { label: i18next.t('widget.fullRow'), value: 1 },
              ],
            },
            {
              name: "grid-width",
              alias: "",
              type: `number(unit=${i18next.t('widget.gridUnit')},min=1,max=60,showInput)`,
              default: 10,
              visible: (widget: Widget)=>{
                return widget.parent.layout !== "fluid" && widget.getOption<"proportion"|"customize">("grid-width-option") === "customize";
              },
            },
            {
              name: "grid-height",
              alias: i18next.t('widget.height'),
              type: `number(unit=${i18next.t('widget.gridUnit')},min=1)`,
              default: 10,
              visible: (widget: Widget)=>{
                return widget.parent.layout !== "fluid";
              },
            },
            {
              name: "opacity",
              alias: i18next.t("widgetTs.widgetOpacity"),
              type: "number(min=0,max=100,step=1,showInput,unit=%)",
              default: 100,
            },
            {
              name: "no-events",
              alias: i18next.t("widgetTs.noEvents"),
              default: false,
              tip: i18next.t("widgetTs.noEventsTips"),
              type: "boolean",
            },
            {
              name: "width-ratio",
              type: "select(radioGroup)",
              visible: false,
              default: 1,
            },
            {
              name: "grid-space",
              alias: i18next.t('widget.sizePosition'),
              fold: "always-unfold",
              visible: (widget: Widget)=>{
                return false && widget.parent.layout !== "fluid";
              },
              children: [
                {
                  name: "grid-left",
                  alias: "left",
                  type: "number(unit=/60,min=0)",
                  default: 0,
                },
                {
                  name: "grid-top",
                  alias: "top",
                  type: "number(unit=*15px,min=0)",
                  default: 0,
                },
              ],
            },
            {
              name: "fluid-size",
              alias: i18next.t('widget.size'),
              fold: "always-unfold",
              visible: (widget: Widget)=>{
                return widget.parent.layout === "fluid";
              },
              children: [
                {
                  name: "fluid-width-type",
                  alias: i18next.t('widget.width'),
                  type: "select(radioGroup)",
                  selectChoices: (widget: Widget)=>{
                    const choices = [
                      { label: i18next.t('widget.autoAdapt'), value: "adaptive" },
                      { label: i18next.t('widget.fixed'), value: "px" },
                    ];
                    if (widget.fluidAutoWidth) {
                      choices.push({label: i18next.t('widget.auto'), value: "auto"});
                    }
                    return choices;
                  },
                  default: "adaptive",
                },
                {
                  name: "fluid-width-px",
                  alias: "",
                  type: "number(min=0,unit=px)",
                  default: 100,
                  visible: (widget: Widget) => {
                    return widget.getOption<"adaptive"|"px"|"auto">("fluid-width-type") === "px";
                  },
                },
                {
                  name: "fluid-width-minmax",
                  alias: "",
                  type: `vector<${i18next.t('widget.min')},${i18next.t('widget.max')}>(min=0,unit=px)`,
                  default: [0, 0],
                  visible: (widget: Widget) => {
                    return widget.getOption<"adaptive"|"px"|"auto">("fluid-width-type") === "adaptive";
                  },
                },
                {
                  name: "fluid-height-type",
                  alias: i18next.t('widget.height'),
                  type: "select(radioGroup)",
                  selectChoices: (widget: Widget)=>{
                    const choices = [
                      { label: i18next.t('widget.autoAdapt'), value: "adaptive" },
                      { label: i18next.t('widget.fixed'), value: "px" },
                    ];
                    if (widget.fluidAutoHeight) {
                      choices.push({label: i18next.t('widget.auto'), value: "auto"});
                    }
                    return choices;
                  },
                  default: "px",
                },
                {
                  name: "fluid-height-px",
                  alias: "",
                  type: "number(min=0,unit=px)",
                  default: 100,
                  visible: (widget: Widget) => {
                    return widget.getOption<"adaptive"|"px"|"auto">("fluid-height-type") === "px";
                  },
                },
                {
                  name: "fluid-height-minmax",
                  alias: "",
                  type: `vector<${i18next.t('widget.min')},${i18next.t('widget.max')}>(min=0,unit=px)`,
                  default: [0, 0],
                  visible: (widget: Widget) => {
                    return widget.getOption<"adaptive"|"px"|"auto">("fluid-height-type") === "adaptive";
                  },
                },
              ],
            },
            {
              name: "container-layout",
              alias: i18next.t('widget.innerCompLayout'),
              default: "static",
              type: "select(radioGroup)",
              selectChoices: [
                { label: i18next.t('widget.staticLayout'), value: "static" },
                { label: i18next.t('widget.flowLayout'), value: "fluid" },
              ],
              visible: (widget: Widget)=>{
                return !!widget.container;
              },
            },
            {
              name: "container-layout-fluid",
              alias: i18next.t('widget.flowLayout'),
              fold: "unfold",
              visible: (widget: Widget)=>{
                return !!widget.container && widget.layout === "fluid";
              },
              children: [
                {
                  name: "flex-direction",
                  alias: i18next.t('widget.arrangeDirection'),
                  type: "select(radioGroup)",
                  selectChoices: [
                    { label: i18next.t('widget.horizontal'), value: "row" },
                    { label: i18next.t('widget.vertical'), value: "column" },
                  ],
                  default: "row",
                },
                {
                  name: "fluid-gap-type",
                  alias: i18next.t('widget.gap'),
                  type: "select(radioGroup)",
                  selectChoices: [
                    { label: i18next.t('widget.fixed'), value: "fixed" },
                    { label: i18next.t('widget.autoAdapt'), value: "adaptive" },
                  ],
                  default: "fixed",
                },
                {
                  name: "fluid-gap-value",
                  alias: "",
                  type: "number(unit=px,min=0)",
                  default: 10,
                  visible: (widget: Widget)=>{
                    return widget.getOption<"adaptive"|"fixed">("fluid-gap-type") === "fixed";
                  },
                },
                {
                  name: "fluid-align-items",
                  alias: i18next.t('widget.innerCompAlign'),
                  type: "select(radioGroup)",
                  selectChoices: (widget: Widget)=>{
                    const startLabel = widget.flexDirection === "row" ? i18next.t('widget.alignTop') : i18next.t('widget.alignLeft');
                    const endLabel = widget.flexDirection === "row" ? i18next.t('widget.alignBottom') : i18next.t('widget.alignRight');
                    return [
                      { label: startLabel, value: "flex-start" },
                      { label: i18next.t('widget.alignCenter'), value: "center" },
                      { label: endLabel, value: "flex-end" },
                    ];
                  },
                  default: "flex-start",
                },
                {
                  name: "fluid-justify-content",
                  alias: "",
                  type: "select(radioGroup)",
                  selectChoices: (widget: Widget)=>{
                    const startLabel = widget.flexDirection === "row" ? i18next.t('widget.alignLeft') : i18next.t('widget.alignTop');
                    const endLabel = widget.flexDirection === "row" ? i18next.t('widget.alignRight') : i18next.t('widget.alignBottom');
                    return [
                      { label: startLabel, value: "flex-start" },
                      { label: i18next.t('widget.alignCenter'), value: "center" },
                      { label: endLabel, value: "flex-end" },
                    ];
                  },
                  default: "flex-start",
                  visible: (widget: Widget)=>{
                    return widget.getOption<"adaptive"|"fixed">("fluid-gap-type") === "fixed";
                  },
                },
                {
                  name: "padding",
                  alias: i18next.t('widget.padding'),
                  type: `vector<${i18next.t('widget.top')},${i18next.t('widget.bottom')},${i18next.t('widget.left')},${i18next.t('widget.right')}>(unit=px)`,
                  default: [0, 0, 0, 0],
                },
              ],
            }
          ],
        },
        "widget-title": {
          alias: i18next.t('widget.title'),
          type: 'boolean',
          default: false,
          children: [
            {
              name: "widget-title-text",
              alias: i18next.t('widget.title'),
              type: "string",
              default: i18next.t('widget.compTitle'),
            },
            {
              name: "widget-font",
              alias: i18next.t('widget.font'),
              type: "font(underline, line-through)",
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
            {
              name: "widget-font-spacing",
              alias: i18next.t('widget.textGap'),
              default: 0,
              type: "number(unit=px,min=0)",
            },
          ],
        },
        padding: {
          after: "animation-display",
          alias: i18next.t('widget.padding'),
          children: [
            {
                "name": "padding-right",
                "alias": i18next.t('widget.marginRight'),
                "type": "select(radioGroup)",
                "selectChoices": [
                    {
                        "value": "auto",
                        "label": i18next.t('widget.auto')
                    },
                    {
                        "value": "diy",
                        "label": i18next.t('widget.custom')
                    }
                ],
                "default": "auto"
            },
            {
                "name": "padding-right-diy",
                "alias": i18next.t('widget.marginRight'),
                "type": "number(unit=px)",
                "default": 20,
                visible: (widget: Widget)=>{
                    return widget.getOption<"auto"|"diy">("padding-right") === "diy";
                }
            },
            {
                "name": "padding-left",
                "alias": i18next.t('widget.marginLeft'),
                "type": "select(radioGroup)",
                "selectChoices": [
                    {
                        "value": "auto",
                        "label": i18next.t('widget.auto')
                    },
                    {
                        "value": "diy",
                        "label": i18next.t('widget.custom')
                    }
                ],
                "default": "auto"
            },
            {
                "name": "padding-left-diy",
                "alias": i18next.t('widget.marginLeft'),
                "type": "number(unit=px)",
                "default": 20,
                visible: (widget: Widget)=>{
                  return widget.getOption<"auto"|"diy">("padding-left") === "diy";
                }
            },
            {
                "name": "padding-top",
                "alias": i18next.t('widget.marginTop'),
                "type": "select(radioGroup)",
                "selectChoices": [
                    {
                        "value": "auto",
                        "label": i18next.t('widget.auto')
                    },
                    {
                        "value": "diy",
                        "label": i18next.t('widget.custom')
                    }
                ],
                "default": "auto"
            },
            {
                "name": "padding-top-diy",
                "alias": i18next.t('widget.marginTop'),
                "type": "number(unit=px)",
                "default": 20,
                visible: (widget: Widget)=>{
                  return widget.getOption<"auto"|"diy">("padding-top") === "diy";
                }
            },
            {
                "name": "padding-bottom",
                "alias": i18next.t('widget.marginBottom'),
                "type": "select(radioGroup)",
                "selectChoices": [
                    {
                        "value": "auto",
                        "label": i18next.t('widget.auto')
                    },
                    {
                        "value": "diy",
                        "label": i18next.t('widget.custom')
                    }
                ],
                "default": "auto"
            },
            {
                "name": "padding-bottom-diy",
                "alias": i18next.t('widget.marginBottom'),
                "type": "number(unit=px)",
                "default": 20,
                visible: (widget: Widget)=>{
                  return widget.getOption<"auto"|"diy">("padding-bottom") === "diy";
                }
            }
          ]
        },
        space: {
          alias: i18next.t("widgetTs.widgetSpace"),
          locked: true,
          visible: false,
          children: [
            {
              name: "rotate",
              alias: i18next.t("widgetTs.widgetRotate"),
              type: "vector<X, Y, Z>(unit=°)",
              default: [0, 0, 0],
            },
          ],
        },
        cover: {
          alias: i18next.t("widgetTs.widgetCover"),
          children: [
            {
              name: 'cover-path',
              alias: i18next.t("widgetTs.coverPath"),
              tip: i18next.t("widgetTs.widgetCoverTip"),
              type: 'snapshot(cover)'
            },
          ],
        },
      },
    }, Background.defineOptions(), ...super.defineOptions()];
  }

  get widgetTitleEnabled() {
    return this.getOption<boolean>("widget-title");
  }
  get widgetTitle() {
    return this.getOption<string>("widget-title-text");
  }
  get widgetTitleHeight() {
    return 40;
  }

  /**
   * @deprecated use getFieldAlias instead
   */
  getAlias(uid: OptionFieldUID) {
    return this.getFieldAlias(uid);
  }

  destroy(onlySelf: boolean = false) {
    this._fluidEffectScope?.stop();
    this._fluidEffectScope = undefined;
    if (!onlySelf) {
      this.container?.destroy();
    }
    this.emitter.removeAllListeners();
    super.destroy();
  }

  async onSave() {
    this.parent.container?.onSave();
    await Promise.all(this.widgets.map((widget)=>{
      if(!widget.enabled) return;
      return widget.onSave();
    }));
  }

  getContextMenuItems() {
    return []
  }

  async cloneSelf(name?: string, cloneParams?: CloneParams, _options?: Options): Promise<Widget> {
    return await this.getBoard().cloneWidget(this, name, _options);
  }

  setTableOptionValue(uid: OptionTableUID) {
    this.setOption("form-table", [{ uid, __opt_type: 'table'}]);
  }

  private _isMoveable = ref<boolean>(true)
  get isMoveable() {
    return this._isMoveable.value
  }

  set isMoveable(bool: boolean) {
    this._isMoveable.value = bool;
  }

  updateLastChangeTime() {
    this.status.lastChangeTime = Date.now();
  }

  copySoul() {
    const soul = this.getSoul();
    const uidMapping = ref({});
    const replaceUid = (_soul: WidgetSoul) => {
      const uid = unique();
      uidMapping.value[_soul.uid] = uid;
      _soul.uid = uid;
      for (const widget of _soul.widgets || []) {
        replaceUid(widget);
      }
      replaceUID(_soul, uidMapping.value);
    }
    const newSoul = deepClone(soul);
    replaceUid(newSoul);
    return newSoul;
  }
}

export class Widget extends BaseWidget {
  declare public parent: Widget | Board;
  public mockBoardMap: { [key: string]: {
    soul: WidgetSoul,
    linkages: Linkage[],
    visible: Ref<boolean>,
    preloadTime: Ref<number>,
  } } = {};

  constructor(soul: WidgetSoul, parent: BaseWidget | Board) {
    super(soul, parent);
  }

  protected initAfterConstructor() {
    this.watchData();
    super.initAfterConstructor();
    this.watchEffectedOpacity();
    this.watchAutoArrange();
  }

  protected watchAutoArrange() {
    this.effectScope.run(() => {
      watch(() => {
        if (!this.getBoard().isProjectReady) return false;
        const { status, size } = this;
        return {
          isVisible: status.isVisible,
          ...size,
        }
      }, (value, oldValue) => {
        if (equals(value, oldValue) || !this.getBoard().status.isVisible) return;
        this.parent.container.autoArrange();
      })
    })
  }

  static defineOptions(): DefinedOptions[] {
    return [{
      data: {
        linkage: {
          fold: "unfold",
          children: [
            {
              name: "linkage-form-field",
              alias: i18next.t('widget.linkField'),
              type: "select(tree,onlyCheckLeaf)",
              selectChoices: (widget: Widget) => {
                const connections = widget.getBoard().getConnections();
                const curAxisValue = widget.getMetaData().axisValue
                const currentConnectionUID = curAxisValue?.[0]?.uid?.[0];
                const connection = connections.find(c => c.uid === currentConnectionUID);
                if (!connection || !curAxisValue?.length) return [];
                let xIsSubform = false;
                let yHasSubform = false;
                let allYIsSubform = false;
                let countYSubform = 0;
                for (const [index, item] of curAxisValue.entries()) {
                  if (index === 0) { // X轴
                    if (item.uid[2]?.split(".").length > 1) {
                      xIsSubform = true;
                    }
                  } else { // Y轴
                    if (item.uid[2]?.split(".").length > 1) {
                      yHasSubform = true;
                      countYSubform++;
                    }
                  }
                }
                if (countYSubform === curAxisValue.length - 1) {
                  allYIsSubform = true;
                }
                return connection.tables?.filter(t => isEmpty(t.meta?.extra?.primaryTable) && t.uid === curAxisValue[0].uid[1]).map(t => {
                  const { baseFields, subFields } = t.fields.reduce<{ baseFields: Field[], subFields: Field[] }>((prev, f) => {
                    if (isSystemField(f) && !systemFieldNameOfFilter.includes(f.meta.name as SystemField)) return prev;
                    if (f.meta.subType === "subForm") {
                      prev.subFields.push(f);
                    } else {
                      prev.baseFields.push(f);
                    }
                    return prev;
                  }, { baseFields: [], subFields: [] });
                  const baseOptions = baseFields.filter(f => !systemFieldNameOfFilter.includes(f.meta.name as SystemField)).map(f => ({ label: f.alias, value: `${t.uid}.${f.uid}` }));
                  const showSystemOptions = baseFields.filter(f => systemFieldNameOfFilter.includes(f.meta.name as SystemField)).map(f => ({ label: f.alias, value: `${f.uid}` }));
                  const subOptions = subFields.map(f => {
                    return f.subTableFields?.filter(f => !isSystemField(f)).map(sf => {
                      return {
                        label: `${f.alias}.${sf.alias}`,
                        value: `${t.uid}.${f.uid}.${sf.uid}`,
                      }
                    }) ?? [];
                  })
                  if (xIsSubform && allYIsSubform) { // 子表筛选只用子表字段
                    return {
                      label: t.alias,
                      value: t.uid,
                      children: [...subOptions.flat(Infinity)],
                    } as SelectChoice
                  } else if (!xIsSubform && yHasSubform) { // Y轴有子表，筛选只用主表
                    return {
                      label: t.alias,
                      value: t.uid,
                      children: [...baseOptions, ...showSystemOptions],
                    } as SelectChoice
                  } else {
                    return {
                      label: t.alias,
                      value: t.uid,
                      children: [...baseOptions, ...subOptions.flat(Infinity), ...showSystemOptions],
                    } as SelectChoice
                  }
                })
              },
              visible: (widget: Widget) => {
                return widget.getOption<boolean>("linkage-out") && widget.getOption<Array<any>>('linkage-elements')?.length > 0;
              }
            },
            {
              name: "linkage-elements",
              alias: i18next.t('widget.linkComp'),
            },
          ]
        },
        'fields-filter': {
          alias: i18next.t('widget.dataFilter'),
          fold: "unfold",
          visible: (element: Widget) => {
            return !isEmpty(element.getMetaData().axisValue);
          },
          children: [
            {
              name: "pre-fields-filter-conditions",
              alias: i18next.t('widget.dataFilter'),
              type: "dialog",
              dialog: {
                // @ts-ignore
                component: defineAsyncComponent(() => import("../FieldsFilterConditionsDialog.vue")),
                buttonText(element) {
                  const value = element.getOption("pre-fields-filter-conditions");
                  return isEmpty(value) || (value as any).conditions?.length === 0 ? i18next.t('widget.addFilterCondition') : i18next.t('widget.filterConditionAdded');
                },
                buttonStyle(element, paths) {
                  const value = element.getOption("pre-fields-filter-conditions");
                  return isEmpty(value) || (value as any).conditions?.length === 0 ? {} : { color: 'var(--color-primary)' }
                },
              },
            },
          ]
        }
      },
      style: {
        padding: {
          after: "animation-display",
          alias: i18next.t('widget.padding'),
          children: [
            {
              "name": "padding-right-diy",
              "default": (widget: Widget) => widget.defaultPadding.right,
            },
            {
              "name": "padding-left-diy",
              "default": (widget: Widget) => widget.defaultPadding.left,
            },
            {
              "name": "padding-top-diy",
              "default": (widget: Widget) => widget.defaultPadding.top,
            },
            {
              "name": "padding-bottom-diy",
              "default": (widget: Widget) => widget.defaultPadding.bottom,
            }
          ]
        },
        basic: {
          children: [
            {
              name: "no-events",
              visible: false
            }
          ]
        }
      }
    }, ...super.defineOptions()]
  }

  private watchDataCollection(optionTableUID: OptionTableUID) {
    const dataCollectionKey = this.getDataCollectionKey(optionTableUID);
    const collection = this.dataCollections[dataCollectionKey];
    if (collection.data) return;
    collection.data = { rows: [], count: 0 };
    collection.refreshTime = 0;
    this.effectScope.run(() => {
      watch(() => {
        const collection = this.dataCollections[dataCollectionKey];
        try {
          const { pageNumber, pageSize, refreshTime } = this.dataCollections[dataCollectionKey];
          let query: WhereCondition = {};
          const options: DataCollectionOptions = {};
          if (pageSize > 0 && pageNumber > 0) {
            options.pageNumber = pageNumber;
            options.pageSize = pageSize;
          }
          const linkages = this.getLinkageFilter();
          if (!isEmpty(linkages)) {
            if (linkages.length > 1) {
              query['$and'] = linkages;
            } else {
              query = linkages[0];
            }
          }
          // 获取数据时的排序先不用
          // const sortField = this.getOption<string>("fields-data-sort-fields");
          // if (sortField) {
          //   const sortRule = this.getOption<SortType>("fields-data-sort-orderby");
          //   options.orderBy = {
          //     [sortField]: sortRule
          //   }
          // }

          const preConditions = this.getOption<{
            logic: LogicalOperator;
            conditions?: FormCondition[],
          }>("pre-fields-filter-conditions");
          if (!isEmpty(preConditions)) {
            preConditions.conditions.forEach(item => {
              if (item.formula) {
                const formulaRuntime = createFormulaRuntimeByWidget(this as any);
                item.value = formulaRuntime.evaluate(item.formula)
              }
            })
            options.preConditions = {
              logic: preConditions.logic,
              conditions: preConditions.conditions,
            }
          }
          const conditions = this.getFilterConditions();
          if (!isEmpty(conditions)) {
            options.conditions = conditions;
          }
          options.query = query;
          return { options, refreshTime };
        } catch (error) {
          settleRefreshTask(collection, error);
          throw error;
        }
      }, async (value, oldValue) => {
        const { options, refreshTime } = value;
        const previousRefreshTime = oldValue?.refreshTime;
        const previousOptions = oldValue?.options;
        if (refreshTime === previousRefreshTime && equals(options, previousOptions)) return;
        const collection = this.dataCollections[dataCollectionKey];
        if (collection.getting) {
          // TODO 取消之前的请求
        }
        collection.getting = true;
        const requestVersion = (collection.requestVersion || 0) + 1;
        collection.requestVersion = requestVersion;
        try {
          const table = this.getTable(collection.optionTableUID);
          const conditions = options.conditions || [];
          let uuids: string[] = [];
          const preLogic = options.preConditions?.logic === LogicalOperator.AND ? "$and" : '$or';
          const preConditions = options.preConditions?.conditions || [];

          const { main: preMain, ...preSubGroup } = transformConditionsGroup(preConditions);
          const { main, ...subGroup } = transformConditionsGroup(conditions);

          // 加入图表之间的联动筛选条件
          if (!isEmpty(options.query)) {
            if (options.query?.['$and']) {
              const querys = options.query?.['$and']
              for (const index of Object.keys(querys)) {
                for (const key of Object.keys(querys[index])) {
                  if (key.split(".").length === 1) {
                    main.push({
                      [key]: querys[index][key]
                    });
                  }
                  if (key.split(".").length === 2) {
                    const fieldId = key.split(".")[0];
                    const subConditions = {[key.split(".")[1]]: querys[index][key]};
                    if (!subGroup[fieldId]) subGroup[fieldId] = [];
                    subGroup[fieldId].push(subConditions);
                  }
                }
              }
            } else {
              for (const key of Object.keys(options.query)) {
                if (key.split(".").length === 1) {
                  main.push({
                    [key]: options.query[key]
                  });
                }
                if (key.split(".").length === 2) {
                  const fieldId = key.split(".")[0];
                  const subConditions = {[key.split(".")[1]]: options.query[key]};
                  if (!subGroup[fieldId]) subGroup[fieldId] = [];
                  subGroup[fieldId].push(subConditions);
                }
              }
            }
          }

          if (!isEmpty(subGroup) || !isEmpty(preSubGroup)) {
            const promises = [];
            let subGroupsObject = {...preSubGroup, ...subGroup};

            for (const fieldId of Object.keys(subGroupsObject)) {
              const field = table.fields.find(f => f.uid === fieldId);
              const subTableUID = field.meta.extra?.subTableUID;
              const tableUID = subTableUID[1];
              let whereConditions: WhereCondition[] = [];
              if (!isEmpty(preSubGroup)) {
                whereConditions.push({
                  [preLogic]: preSubGroup[fieldId]
                })
              }
              if (!isEmpty(subGroup)) {
                whereConditions.push({
                  '$and': subGroup[fieldId]
                })
              }
              const queryConditions = whereConditions.length > 1 ? { '$and': whereConditions } : whereConditions?.[0];
              const subTable = this.getTable([collection.optionTableUID[0], tableUID]);
              const keyField = subTable.fields.find(f => f.meta.name === SystemField.KEY);
              promises.push(formDataApi.distinct({
                nocodeId: this.getBoard().nocodeId,
                tableUID,
                columnId: keyField.uid,
                options: {
                  filters: {
                    [tableUID]: [queryConditions],
                  }
                }
              }));
            }
            try {
              const uuidGroup = await Promise.all(promises);
              uuids = intersection(...uuidGroup)
            } catch (error) {
              if (collection.requestVersion !== requestVersion) return;
              if (!collection.refreshTask) {
                collection.data = {
                  rows: [],
                  count: 0,
                }
              }
              settleRefreshTask(collection, error);
              return;
            }
          }
          const uuidField = getUUIDSystemField(table.fields);
          if (!isEmpty(uuids)) {
            if (!isEmpty(preSubGroup) && isEmpty(subGroup) && preLogic === '$or') {
              // 只有预筛选时，uuid使用preLogic合并到preMain再一起合给main进行筛选
              preMain.push({
                [uuidField.uid]: { $in: uuids }
              });
            } else {
              main.push({
                [uuidField.uid]: { $in: uuids }
              });
            }
          }
          if (!isEmpty(preMain)) {
            const temp = preMain.length > 1 ? { [preLogic]: preMain } : preMain[0];
            main.unshift(temp);
          }

          this.getBoard().readDataByOptions(collection.optionTableUID, {
            ...options,
            filters: {
              [collection.optionTableUID[1]]: main.length ? [ main.length > 1 ? { $and: main } : main[0] ] : [],
            },
            fillSubTable: true,
            subTableFilters: { ...preSubGroup, ...subGroup },
          }).then((bucket) => {
            if (collection.requestVersion !== requestVersion) return;
            collection.data = {
              rows: bucket?.rows || [],
              count: bucket?.count || 0,
            }
            settleRefreshTask(collection);
          }).catch((error) => {
            if (collection.requestVersion !== requestVersion) return;
            if (!collection.refreshTask) {
              collection.data = {
                rows: [],
                count: 0,
              }
            }
            settleRefreshTask(collection, error);
          })
        } catch (error) {
          if (collection.requestVersion !== requestVersion) return;
          settleRefreshTask(collection, error);
        }
      }, { immediate: true, deep: true })
    })
  }

  private watchData() {
    this.effectScope.run(() => {
      watch(() => {
        if (!this.status.hasEnteredView) return [];
        const values = Object.values(this.dataCollections);
        const optionTableUIDs = values.filter(item => item.optionTableUID).map(item => item.optionTableUID);
        return optionTableUIDs;
      }, (optionTableUIDs, oldOptionTableUIDs) => {
        if (equals(optionTableUIDs, oldOptionTableUIDs)) return;
        for (const optionTableUID of optionTableUIDs) {
          this.watchDataCollection(optionTableUID);
        }
      }, { deep: true, immediate: true })
    })
  }

  async refreshDataCollections() {
    const refreshPromises: Promise<unknown>[] = [];
    Object.values(this.dataCollections).forEach(collection => {
      if (collection.data) {
        if (!collection.refreshTask) {
          let resolve: () => void;
          let reject: (error: unknown) => void;
          const promise = new Promise<void>((promiseResolve, promiseReject) => {
            resolve = promiseResolve;
            reject = promiseReject;
          });
          collection.refreshTask = { promise, resolve, reject };
          collection.refreshTime = (collection.refreshTime || 0) + 1;
        }
        refreshPromises.push(collection.refreshTask.promise);
      }
    });
    refreshPromises.push(this.emitter.emitAsync("refresh.data"));
    await waitForAll(refreshPromises);
  }

  get widgets() {
    return super.widgets as Widget[];
  }

  isReady():boolean{
    return super.isReady();
  }
  
  addMockBoard(teleportId: string, soul: WidgetSoul, linkages?: Linkage[], visible?: boolean) {
    this.mockBoardMap[teleportId] = {
      soul,
      linkages,
      visible: ref(visible ?? true),
      preloadTime: ref(0),
    };
  }
  removeMockBoard(teleportId: string) {
    delete this.mockBoardMap[teleportId];
  }
  closeMockBoard(teleportId: string, remove: boolean) {
    if(remove){
      this.removeMockBoard(teleportId);
    }
  }
  showMockBoard(teleportId: string){
    if(this.mockBoardMap[teleportId]){
      this.mockBoardMap[teleportId].visible.value = true;
    }
  }
  hideMockBoard(teleportId: string){
    if(this.mockBoardMap[teleportId]){
      this.mockBoardMap[teleportId].visible.value = false;
    }
  }

  preloadMockBoard(teleportId: string){
    if(this.mockBoardMap[teleportId]){
      this.mockBoardMap[teleportId].preloadTime.value = Date.now();
    }
  }

  private _stopEffectedOpacity: Function;
  watchEffectedOpacity(){
    this.effectedOpacity.value = this.opacity * this.opacityRatio;
    this._stopEffectedOpacity = watch(() => this.opacity, (newOpacity, prevOpacity) => {
      if (newOpacity === prevOpacity) return;
      this.effectedOpacity.value = Number(newOpacity);
    }, { flush:"post" })
  }

  private stopWatchEffectedOpacity() {
    this._stopEffectedOpacity?.();
  }

  destroy(onlySelf: boolean = false) {
    Object.values(this.dataCollections).forEach(collection => settleRefreshTask(collection));
    super.destroy(onlySelf);
    this.stopWatchEffectedOpacity();
  }

  async beforeSnapshot() {
    await Promise.all(this.widgets.map((widget)=>{
      if(!widget.enabled) return;
      return widget.beforeSnapshot();
    }));
  }

  async afterSnapshot() {
    await Promise.all(this.widgets.map((widget)=>{
      if(!widget.enabled) return;
      return widget.afterSnapshot();
    }));
  }

  getMetaData(): WidgetMetaData {
    return {};
  }
  getFilterConditions() {
    // 返回当前组件受到的筛选条件
    const widgets = this.getFilterWidgets();
    return widgets.map(widget => {
      // 从这些组件身上获取跟自己相关的筛选条件
      return widget.getFilterRules(this);
    })?.flat();
  }

  getFilterWidgets<T extends BaseWidget = Widget>(widgets?: T[]): FilterWidget[] {
    // 返回当前看板所有的筛选组件
    widgets = widgets || this.getBoard().children as T[];
    return widgets.map(widget => {
      let widgets = [];
      if (widget.children) {
        widgets = this.getFilterWidgets(widget.children);
      }
      if (widget instanceof FilterWidget) {
        widgets.push(widget);
      }
      return widgets;
    })?.flat(Infinity)?.filter(Boolean);
  }

  getData() {
    return {
      ...super.getData(),
      getflatColumns: (uids: OptionFieldUID[], encode?: DataEncode | DataFormat) => {
        if (isEmpty(uids)) return null;
        const tableUIDs: OptionTableUID[] = uids.map((uid)=>[uid[0], uid[1]]);
        const rows = this.afterLinkageAndFilterRows(tableUIDs);
        if (!rows) {
          return null;
        }
        const fieldUIDs = uids.map(uid => uid[2]);

        if(encode === 'json' || encode === 'object') {
          const aliasMap = {};
          if (encode === 'object') {
            for (const uid of uids) {
              aliasMap[uid[2]] = this.getFieldAlias(uid);
            }
          }

          return rows.map(row => {
            const json = {};
            for (const fieldUID of fieldUIDs) { 
              const uids = fieldUID.split(".");
              if (uids.length > 1) {
                if (!(uids[0] in row)) continue;
                const subRows = row[uids[0]];
                let _key = aliasMap[fieldUID] ?? fieldUID;
                json[_key] = subRows.map(subRow => subRow[uids[1]]);
              } else {
                if (!(fieldUID in row)) continue;
                let _key = aliasMap[fieldUID] ?? fieldUID;
                json[_key] = row[fieldUID];
              }
            }

            return json;
          })
        } else if(encode === 'row') {
          return rows.map(row => {
            const array = [];

            for (const fieldUID of fieldUIDs) { 
              const uids = fieldUID.split(".");
              if (uids.length > 1) {
                if (!(uids[0] in row)) continue;
                const subRows = row[uids[0]];
                const subArray = [];
                for (const subRow of subRows) {
                  if (uids[1] in subRow) subArray.push(subRow[uids[1]]);
                }
                array.push(subArray);
              } else {
                if (!(fieldUID in row)) continue;
                array.push(row[fieldUID]);
              }
            }

            return array;
          })
        }

        return fieldUIDs.map(fieldUID => {
          const uids = fieldUID.split(".");

          if(uids.length > 1) {
            return rows.map(row => row[uids[0]]?.map(subRow => subRow[uids[1]])).flat();
          } else {
            return rows.map(row => row[fieldUID])
          }
        });
      }
    };
  }

  // get padding() {
  //   return 
  // }

  get defaultPadding() {
    return {
      left: 8,
      right: 8,
      top: 4,
      bottom: 10
    }
  }

  get contentStyle() {
    return {
      paddingTop: (this.getOption<string>("padding-top") == "auto" ? this.defaultPadding.top : this.getOption<number>("padding-top-diy")) + "px",
      paddingLeft: (this.getOption<string>("padding-right") == "auto" ? this.defaultPadding.right : this.getOption<number>("padding-right-diy")) + "px",
      paddingBottom: (this.getOption<string>("padding-bottom") == "auto" ? this.defaultPadding.bottom : this.getOption<number>("padding-bottom-diy")) + "px",
      paddingRight: (this.getOption<string>("padding-left") == "auto" ? this.defaultPadding.left : this.getOption<number>("padding-left-diy")) + "px"
    }
  }

  get widgetTitleHeight() {
    return 28;
  }

  // get contentSize() {
  //   const { top, right, bottom, left } = this.padding;
  //   const { width, height } = this.size;

  //   if (!this.widgetTitleEnabled) {
  //     return { width: width - left - right, height: height - top - bottom };
  //   }
  //   return { width: width - left - right, height: height - top - bottom - this.widgetTitleHeight };
  // }
  
  get preFieldsFilterConditions() {
    return this.getOption("pre-fields-filter-conditions");
  }
}

export class FilterWidget extends Widget {
  private readonly _filters = ref<Filter[]>([]);

  static defineOptions(): DefinedOptions[] {
    return [{
      data: {
        linkage: {
          children: [
            {
              name: "linkage-form-field",
              visible: false
            }
          ]
        }
      }
    }, ...super.defineOptions()];
  }

  applyFilter(filters: Filter | Filter[]) {
    // 添加筛选条件
    if (!filters) return;
    if (!Array.isArray(filters)) {
      filters = [filters];
    }
    this._filters.value.length = 0;
    this._filters.value.push(...deepClone(filters));
  }

  withdrawFilter() {
    this._filters.value.length = 0;
  }
  getFilterRules(widget: Widget): FormCondition[] {
    // 从当前筛选条件中过滤出跟自己相关的筛选条件
    return this._filters.value.reduce<FormCondition[]>((prev, item) => {
      for (const fieldId in item.linkageFields) {
        const widgetIds = item.linkageFields[fieldId];
        if (widgetIds.includes(widget.uid)) {
          prev.push({
            uid: fieldId,
            func: item.func,
            value: item.value,
          });
        }
      }
      return prev;
    }, []);
  }
}
