import { BaseWidget, Widget } from "./widget";
import { Options, ConnectionData } from "@common/types/project";
import type { DefinedOptions, ProjectContext, BoardStatus, ParamLog } from "../types";
import type { Soul, BoardSoul } from "@common/types/project";
import { Element } from "./element";
import { Container } from "./container";
import { Background } from "./background"
import { nextTick, reactive, Ref, ref, unref, watch } from "vue";
import { unique } from '@common/utils/unique';
import { createB2History } from "../history";
import EventEmitter from "eventemitter2";
import i18next from "i18next";
import { measureLog } from "../utils/measure";
import { Filter, OptionFieldUID, OptionTableUID, QueryOptions } from "@common/types/project";
import { Account, Department } from "@common/types/account";
import { FormTableRuntime } from "@common/types/nocode";
import { waitForAll } from "../utils/auto-refresh.util";
import { buildTree, OrganizeUtil } from "@renderer/views/nocode/utils";
import { buildElement } from "../utils/element.util";

export class Board extends Element {
  public boardView: HTMLElement;
  private _instancedWidgets: { [key: string]: BaseWidget };
  private _instanceUpdateTime = reactive({ widgets: 0 });
  private _container: Container;
  declare protected soul: BoardSoul;
  declare public status: BoardStatus;
  declare public getSoul: () => BoardSoul;

  private _historyId: Ref<string> = ref();
  public get historyId() {
    return this._historyId.value;
  }
  public history: ReturnType<typeof createB2History>;
  public backgroundMusicDom: HTMLAudioElement;
  public emitter: EventEmitter = new EventEmitter();
  public organizeUtil = new OrganizeUtil();

  constructor(soul: Soul, private projectContext: ProjectContext, historyId?: string) {
    super(soul, null);
    buildElement(Board);
    this._instancedWidgets = {};
    this.initContainer();
    if (historyId) {
      this._historyId.value = historyId;
      const createHistoryWatch = watch(() => this.isReady(), async (val) => {
        if (val) {
          this.history = createB2History(this);
          await nextTick();
          createHistoryWatch();
        }
      }, { immediate: true })
    }
    if ([FormTableRuntime.BOARD_EDITOR, FormTableRuntime.BOARD_VIEWER].includes(this.runtime)) {
      this.iniWatchLinkage();
    }
  }

  private iniWatchLinkage() {
    this.effectScope.run(() => {
      watch(()=>{
        return [
          this._instanceUpdateTime.widgets,
          ...Object.values(this._instancedWidgets).map((widget)=>widget.isLinkageOut),
        ];
      }, ()=>{
        this._allLinkageOutWidgets.splice(0, this._allLinkageOutWidgets.length, ...(Object.values(this._instancedWidgets).filter(widget=>widget.isLinkageOut) as Widget[]));
      });
    });
  }

  get type() {
    return 'board';
  }
  get primitiveType() {
    return "board";
  }
  get defaultName() {
    return i18next.t("boardTs.boardDefaultName");
  }
  hasPrivateData() {
    return false;
  }
  get path(): [boardUID?: string] {
    return [this.uid];
  }
  get container() {
    return this._container;
  }
  get enabled() {
    return true;
  }
  get locked() {
    return false;
  }

  private _isReady = false;
  isReady() {
    if (this._isReady) return true;
    if (!super.isReady()) return false;
    if (this.container && !this.container?.hasWidgetSynced()) return false;
    for(const widget of this.widgets){
      if(!widget.isReady()) {
        measureLog("loading", `board ${this.name} is not ready for widget ${widget.name}(${widget.type})`)
        return false;
      }
    }
    if (!this._isReady) {
      measureLog("loading", `board ${this.name} is ready`)
      this._isReady = true;
    }
    this.container && this.container.clearCorruptedWidgets();
    return true;
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

  static defineOptions(): DefinedOptions[] {
    return [{
      style: {
        basic: {
          alias: i18next.t("boardTs.boardBasicSetting"),
          fold: 'unfold',
          visible: false,
          children: [
            {
              name: "container-layout",
              alias: i18next.t("boardTs.containerLayout"),
              default: "static",
              type: "select(radioGroup)",
              selectChoices: [
                { label: i18next.t("boardTs.staticLayout"), value: "static" },
                { label: i18next.t("boardTs.fluidLayout"), value: "fluid" },
              ],
              visible: false,
            },
          ],
        },
        border: {
          visible: false,
        },
        autoRefresh: {
          alias: i18next.t("boardTs.autoRefresh"),
          tip: i18next.t("boardTs.autoRefreshTip"),
          type: "boolean",
          default: false,
          fold: "unfold",
          before: "background",
          visible: (board: Board) => board.getSoul().type === "board",
          children: [
            {
              name: "auto-refresh-interval",
              alias: i18next.t("boardTs.refreshInterval"),
              type: "select",
              default: 300,
              selectChoices: [
                { value: 60, label: i18next.t("boardTs.refreshIntervalMinute", { count: 1 }) },
                { value: 180, label: i18next.t("boardTs.refreshIntervalMinute", { count: 3 }) },
                { value: 300, label: i18next.t("boardTs.refreshIntervalMinute", { count: 5 }) },
                { value: 600, label: i18next.t("boardTs.refreshIntervalMinute", { count: 10 }) },
                { value: 900, label: i18next.t("boardTs.refreshIntervalMinute", { count: 15 }) },
                { value: 1800, label: i18next.t("boardTs.refreshIntervalMinute", { count: 30 }) },
                { value: 3600, label: i18next.t("boardTs.refreshIntervalHour", { count: 1 }) },
                { value: 10800, label: i18next.t("boardTs.refreshIntervalHour", { count: 3 }) },
              ],
            },
          ],
        },
        background: {
          default: true,
          fold: 'unfold',
          children: [
            {
              name: 'background-music',
              alias: i18next.t("boardTs.boardBackgroundMusic"),
              tip: i18next.t("boardTs.boardBackgroundMusicTip"),
              fold: 'unfold',
              children: [
                {
                  name: 'background-music-file',
                  alias: i18next.t("boardTs.boardBackgroundMusicFile"),
                  type: 'file(format=.mp3)',
                },
                {
                  name: 'background-music-volume',
                  alias: i18next.t("boardTs.boardBackgroundMusicVolume"),
                  type: 'number(min=0,max=100,step=1)',
                  default: 100,
                }
              ],
            },
            {
              name: 'background-color',
              default: "#fff",
            },
            {
              name: "background-blur",
              visible: false,
            }
          ],
        },
      },
    }, Background.defineOptions(), ...super.defineOptions()];
  }

  get size() {
    return this._size.value;
  }
  private _size = ref({width: 1920, height: 1080});
  set size(size: { width: number, height: number }) {
    if (size.width <= 0 || size.height <= 0) {
      return;
    }
    this._size.value = size;
  }
  get layout() {
    return this.getOption<"static"|"fluid">("container-layout");
  }
  get flexDirection(): "column" {
    return "column";
  }
  get widgets() {
    return this.container.widgets;
  }
  get children() {
    return this.widgets;
  }
  get reversedWidgets() {
    return this.container.reversedWidgets;
  }

  get offset() {
    return {x: 0, y: 0};
  }
  get containerGap() {
    return this.container.gap;
  }

  mute(muted: boolean): void {
    if (this.backgroundMusicDom) {
      this.backgroundMusicDom.muted = muted;
    }
  }

  getInstancedWidget(uid: string) {
    return this._instancedWidgets[uid];
  }
  saveInstancedWidget(widget: BaseWidget) {
    this._instancedWidgets[widget.uid] = widget;
    this._instanceUpdateTime.widgets = Date.now();
  }
  unsetInstancedWidget(uid: string) {
    delete this._instancedWidgets[uid];
    this._instanceUpdateTime.widgets = Date.now();
  }
  private _allLinkageOutWidgets: Widget[] = reactive([]);
  get allLinkageOutWidgets() {
    return this._allLinkageOutWidgets;
  }


  get widgetsCount() {
    return this.container.getChildWidgets(true).length;
  }

  getBoards() {
    return this.projectContext.getBoards();
  }
  getWidgetByUID(uid: string){
    if(!uid) return undefined;
    return this._instancedWidgets[uid];
  }

  async beforeSnapshot() {
    await Promise.all(this.widgets.map((widget: Widget)=>{
      if(!widget.enabled) return;
      return widget.beforeSnapshot();
    }));
  }

  async afterSnapshot() {
    await Promise.all(this.widgets.map((widget: Widget)=>{
      if(!widget.enabled) return;
      return widget.afterSnapshot();
    }));
  }

  async onSave() {
    await Promise.all(this.widgets.map((widget)=>{
      if(!widget.enabled) return;
      return widget.onSave();
    }));
  }

  async saveFormData() {
    await this.projectContext.saveFormData();
  }

  get typography() {
    return this.projectContext.typography;
  }

  get inNocodeForm() {
    return !!this.projectContext.inNocodeForm;
  }

  get widthRatio() {
    return this.projectContext.widthRatio;
  }

  get projectId() {
    return this.nocodeId;
  }
  get nocodeId() {
    return this.projectContext.nocodeId;
  }
  getNocodeBodyData() {
    return this.projectContext.getNocodeBodyData?.();
  }
  get projectName() {
    return this.projectContext.projectName;
  }
  get mergedConnectionData() {
    return this.projectContext.mergedConnectionData;
  }
  get projectConnectionData() {
    return this.projectContext.connectionData;
  }
  get connectionData(): ConnectionData {
    return this.mergedConnectionData as ConnectionData;
  }
  get musicVolume() {
    return this.getOption<number>("background-music-volume") ?? 100;
  }

  get runtime() {
    return this.projectContext.runtime;
  }

  get formMode() {
    return this.projectContext.formMode;
  }

  getElementByUID(uid: string[]){
    return this.projectContext.getElementByUID(uid);
  }
  getDataConditions() {
    return this.projectContext.getDataConditions?.() || [];
  }
  getConnections() {
    return this.projectContext.getConnections();
  }
  setActiveBoardById(boardUID: string){
    this.projectContext.setActiveBoardById(boardUID);
  }
  activateWidget(widget: Widget) {
    this.emitter.emit("activate.widget", widget);
  }
  deactivateWidget() {
    this.emitter.emit("deactivate.widget");
  }
  async refreshConnectionData() {
    await this.projectContext.refreshConnectionData();
    await this.refreshWidgetDataCollections();
  }
  async refreshWidgetDataCollections() {
    await waitForAll(this.container.getChildWidgets(true).map(widget => {
      return (widget as Widget).refreshDataCollections();
    }));
  }
  async ensureConnectionBucket(optionTableUID: OptionTableUID) {
    return await this.projectContext.ensureConnectionBucket(optionTableUID);
  }

  undoHistory(){
    return this.history.undo();
  }
  redoHistory(){
    return this.history.redo();
  }
  updateHistory(historyId: string = unique(), add = true) {
    if (!this.status.isEditable || !this.status.isProjectReady) return;
    this._historyId.value = historyId;
    if (add) this.history.add();
  }
  getHistoryTimestamps(){
    return this.history.getTimestamps();
  }

  get projectParams() {
    return {};
  }

  editProjectParams(params) {
    
  }

  async readDataByOptions(optionTableUID: OptionTableUID, options: QueryOptions) {
    return await this.projectContext.readDataByOptions(optionTableUID, options);
  }

  async removeData(tableUID: OptionTableUID, rows: object[], keys?: OptionFieldUID[]) {
    return await this.projectContext.removeFromConnection(tableUID, rows, keys);    
  }
  async updateData(tableUID: OptionTableUID, rows: object[], keys?:OptionFieldUID[]) {
    return await this.projectContext.updateToConnection(tableUID, rows, keys);    
  }
  async addData(tableUID: OptionTableUID, rows: object[]) {
    return await this.projectContext.addToConnection(tableUID, rows);    
  }


  async cloneWidget(widget: Element, name: string, options: Options) {
    return await this.projectContext?.clone(widget, name, options);
  }

  destroy() {
    this.container.destroy();
    this._instancedWidgets = {};
    this._allLinkageOutWidgets.splice(0, this._allLinkageOutWidgets.length);
    this._departmentCache.clear();
    this._accountCache.clear();
    this.projectContext = undefined as unknown as ProjectContext;
    this.organizeUtil = undefined as unknown as OrganizeUtil;
    this.emitter.removeAllListeners();
    super.destroy();
  }

  addProjectLog(log: ParamLog ){
    this.projectContext.addProjectLog(log);
  }

  selectWidgets(widgets: Widget | Widget[]) {
    if (!Array.isArray(widgets)) {
      widgets = [ widgets ];
    }
    this.projectContext.selectWidgets(widgets);
  }

  private _departmentCache = new Map<string, Department>();
  private _accountCache = new Map<string, Account>();
  async getOrganizeDepartments(searchParams?, isTree=true) {
    const departments = await this.organizeUtil.getDepartments(searchParams);
    if(isTree) {
      buildTree(departments);
    }
    const queue = [...departments];
    while (queue.length) {
      const department = queue.pop();
      if (!this._departmentCache.has(department.id)) {
        this._departmentCache.set(department.id, department);
        queue.push(...department.children ?? []);
      }
    }
    return departments;
  }
  async getOrganizeRoles(searchParams?, isTree=true) {
    const roles = await this.organizeUtil.getRoles(searchParams);
    if(isTree) {
      buildTree(roles);
    }
    return roles
  }
  async getOrganizeUsers(searchParams?: {accountIds?: string[], roleIds?: string[], departmentIds?: string[]}) {
    const accounts = await this.organizeUtil.getUsers(searchParams);
    for (const account of accounts) {
      this._accountCache.set(account.id, account);
    }
    return accounts;
  }
  public async getOrganizationDepartment(id: string): Promise<Department> {
    if (!this._departmentCache.has(id)) {
      await this.getOrganizeDepartments();
    }
    return this._departmentCache.get(id);
  }
  public async getOrganizationAccount(id: string): Promise<Account> {
    if (!this._accountCache.has(id)) {
      await this.getOrganizeUsers({ accountIds: [id] });
    }
    return this._accountCache.get(id);
  }
}
