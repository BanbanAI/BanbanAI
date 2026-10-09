import { Options, PrivateDataTableUID } from "@common/types/project";
import { unique } from "@common/utils/unique";
import { ElementStatus, DefinedOptions, ParsedOption, Linkage, OptionFieldValue, ClusterPaths, BlueprintCluster, LinkageValue, isCallableEntries, DataEncode, isBoard, ElementDescription, ElementDescriptionGroup, DataFormat, CloneParams, GetOptionOptions, SelectChoice } from "../types";
import { Soul, GroupStatus, OptionValue } from "@common/types/project";
import widgetMissingIconUrl from "@renderer/assets/image/widget-missing.svg";
import { FieldUID } from "@common/types/project";
import { isBlueprintCluster, BlueprintOptions, BlueprintValue } from "../types";
import { ClusterArrayIndex, ClusterArrayValue, DataCondition } from "@common/types/project";
import { ConcreteComponent, reactive, nextTick, watch, Ref, ref, markRaw, WatchStopHandle, effectScope, EffectScope, shallowReactive, toRaw, ShallowReactive } from "vue";
import { Board } from "./board";
import { getParsedOptions, getBlueprints } from "../utils/element.util";
import { Data } from "../data";
import { deepClone, equals, isEmpty } from "@common/utils/object";
import { parseOptionType } from "../utils/option.util";
import { Field, OptionFieldUID, OptionTableUID, PROJECT_PARAMS_UID, PrivateData, PrivateDataConnectionUID, QueryOptions, Row, TableUID, WhereCondition } from "@common/types/project";
import i18next from "i18next";
import { SaasPlan } from "@common/types/user";
import { compareSaasPlan } from "@common/utils/saas";
import dayjs from "dayjs";

const isString = (item: string | string[]): item is string => {
  return typeof item === "string";
};
type ParsedLinkage = {
  data: {
    [alias: string]: LinkageValue,
  },
  timestamp: number,
};

type DataCollection = {
  optionTableUID?: OptionTableUID,
  data?: { rows: Row[], count: number },
  getting?: boolean,
  pageSize?: number,
  pageNumber?: number,
  refreshTime?: number,
  requestVersion?: number,
  refreshTask?: {
    promise: Promise<void>,
    resolve: () => void,
    reject: (error: unknown) => void,
  },

}

export class Element {
  public component: ConcreteComponent;
  public dom: HTMLElement;
  public status: ElementStatus;
  public dataCollections: ShallowReactive<Record<string, DataCollection>> = shallowReactive({});
  private _destroyed = false;

  constructor(protected soul: Soul, public parent: Element) {
    //1.所有的element对象都不要响应式
    //2.soul都是响应式的
    markRaw(this);
    if (!this.soul.options) {
      this.soul.options = {};
    }

    this.status = reactive({
      isVisible: this.enabled,  //影响组件初始化,组件内部resize相关
      error: {},
    });
    if (this.soul.isNew) {
      this.status.isNew = true;
      delete this.soul.isNew;
    }
    nextTick(async ()=>{
      if (this._destroyed) return;
      this.initAfterConstructor();
    });
  }
  protected initAfterConstructor() {
    if (!this.isFormMode) {
      this.effectScope.run(() => {
        this.watchLinkage();
      });
    }
  }
  private _effectScope: EffectScope;
  get effectScope() {
    if (!this._effectScope) {
      this._effectScope = effectScope(true);
    }
    return this._effectScope;
  }
  get _visible(){
    return true;
  }
  get type() {
    return "element";
  }
  get primitiveType() {
    return "element";
  }
  get uid() {
    return this.soul.uid;
  }
  get enabled() {
    const selfEnabled = this.soul.enabled ?? true;
    return selfEnabled && this._enabledTransient.value && !this._trashed.value && this.parent?.enabled;
  }
  set enabled(enabled: boolean) {
    this.soul.enabled = enabled;
    this.getBoard().updateHistory();
  }
  private _enabledTransient = ref(true);
  set enabledTransient(enabledTransient:boolean){
    this._enabledTransient.value = enabledTransient;
  }
  private _trashed = ref(false);
  set trashed(trashed:boolean){
    this._trashed.value = trashed;
  }

  get isEditable() {
    return this.getBoard().status.isEditable;
  }
  get isFormMode() {
    return this.getBoard().status.isFormMode;
  }
  get isPlaying() {
    return this.getBoard().status.isPlaying;
  }
  get isBoardEditing() {
    return this.isEditable && !this.isPlaying;
  }
  get isProjectReady() {
    return this.getBoard().status.isProjectReady;
  }
  get isBoardReady() {
    const board = this.getBoard();
    return board.status.isForeBoardReady && board.status.isBackBoardReady && board.isReady();
  }
  get scaling() {
    return { x: 1, y: 1};
  }
  get path(): [boardUID?: string, widgetUID?: string] {
    return [];
  }
  private _pathJSON: string;
  get pathJSON(){
    if(!this._pathJSON){
      this._pathJSON = JSON.stringify(this.path);
    }
    return this._pathJSON;
  }
  get name() {
    return this.soul.name || this.defaultName;
  }
  set name(newName: string) {
    this.soul.name = newName;
    this.getBoard()?.updateHistory();
  }
  get defaultName() {
    return "Element";
  }
  get version() {
    return "0.0.1";
  }
  get nameSuffix() {
    return "";
  }
  get icon() {
    return widgetMissingIconUrl;
  }
  get isConnectionInited() {
    return this.getBoard().status.isConnectionInited;
  }
  get isSnap() {
    return this.soul.isSnap;
  }
  get childStateFollow(): boolean{
    return false;
  }
  get children(): Element[] {
    return [];
  }
  public getParentWidgets() { return []}
  get currentValue() {
    return undefined;
  }

  protected definedElementDescriptions(): ElementDescriptionGroup[] {
    return []
  }

  get elementDescriptionGroups(): ElementDescriptionGroup[] {
    return this.definedElementDescriptions();
  }

  static defineOptions(): DefinedOptions[] {
    return [{
      style: {
        cover: {
          alias: i18next.t("elementTs.coverSetting"),
          visible: false,
          children: [
            {
              name: 'cover-path',
              alias: i18next.t("elementTs.coverPath"),
              type: 'snapshot(cover)'
            },
          ],
        },
      },
      data: {
        linkage: {
          alias: i18next.t("elementTs.elementDataLinkage"),
          locked: true,
          fold: "always-unfold",
          children: [
            {
              name: "linkage-out",
              alias: i18next.t("elementTs.elementDataLinkageOut"),
              type: "boolean",
              default: false,
            },
            {
              name: "linkage-elements",
              alias: i18next.t("elementTs.elementDataLinkageElements"),
              type: "element(multiple)",
              default: [],
              visible(element, paths) {
                return element.getOption("linkage-out");
              },
            },
          ],
        },
      },
    }];
  }

  getParsedOptions(): ParsedOption {
    return getParsedOptions(this.type);
  }

  getBlueprints(): BlueprintOptions {
    return getBlueprints(this.type);
  }

  getSoul() {
    return this.soul;
  }

  setSoul(soul: Soul): void {
    this.soul = soul;
  }

  getBoard(): Board {
    if (this.parent?.type === "board") {
      return this.parent as Board;
    } else if (this.type === "board") {
      return this as unknown as Board;
    }
    return this.parent?.getBoard();
  }

  isReady() {
    return true;
  }

  getElementByUID(uid: string[]): Element{
    return this.getBoard().getElementByUID(uid);
  }

  get elementUID(): string[] {
    return [this.uid];
  }

  hasOption(paths: string | string[]): boolean {
    if (isString(paths)) {
      paths = [paths];
    }
    try {
      this.getBlueprint(paths);
      return true;
    } catch (err) {
      return false;
    }
  }

  private getBlueprint(paths: string | string[], onPath?: (paths: string[], i: number, blueprint: BlueprintValue | BlueprintCluster)=>void): BlueprintValue {
    const blueprints = this.getBlueprints();
    if (isString(paths)) {
      paths = [paths];
    }
    let theBlueprint: BlueprintValue;
    let blueprintOptions = blueprints;
    if (!blueprintOptions) return;
    for (let i = 0; i < paths.length; i++) {
      const name = paths[i];
      const blueprint = blueprintOptions[name];
      if (isBlueprintCluster(blueprint)) {
        blueprintOptions = blueprint.blueprintOptions;
        i++;
      } else if (!blueprint) {
        throw new Error("cannot find blueprint", {
          cause: { type: this.type, blueprints, paths, i } as any
        });
      } else {
        theBlueprint = blueprint;
      }
      onPath?.(paths, i, blueprint);
    }
    return theBlueprint;
  }

  getOptionType(paths: string | string[]): Pick<BlueprintValue, "type" | "alias" | "selectChoices"> {
    try {
      const blueprint = this.getBlueprint(paths);
      return {
        type: blueprint?.type,
        alias: blueprint?.alias,
        selectChoices: blueprint?.selectChoices,
      };
    } catch (err) {
      // console.warn("[getOptionType]", err.message, err.cause);
      return undefined;
    }
  }

  protected getOptionDefault(paths: string[]): OptionValue {
    try {
      const blueprint = this.getBlueprint(paths);
      switch (typeof blueprint?.default) {
        case "function":
          return blueprint.default(this, paths);
        case "object":
          if (blueprint.default === null) {
            return blueprint.default;
          }
          return deepClone(blueprint.default);
        default:
          return blueprint.default;
      }
    } catch (err) {
      // console.warn("[getOptionDefault]", err.message, err.cause);
      return undefined;
    }
  }
  _getOptionDefault(paths: string[]) {
    return this.getOptionDefault(paths);
  }

  getOptionGroup(paths: string | string[]) {
    try {
      const blueprint = this.getBlueprint(paths);
      return blueprint?.group;
    } catch(err) {
      // console.warn("[getOptionGroup]", err.message, err.cause);
      return undefined;
    }
  }

  private getOptionValue(curOptions: Options, paths: string[]) {
    if (curOptions === undefined || curOptions === null) {
      return undefined;
    }
    let ref: Options | OptionValue = curOptions;
    let parentRef: Options | OptionValue;
    for (let i = 0; i < paths.length; i++) {
      parentRef = ref;
      ref = parentRef[paths[i]];
      if (ref === undefined) {
        return undefined;
      }
    }
    //兼容element option未存储__opt_type的情况
    //只有值是数组的时候才可能需要修正
    if (Array.isArray(ref)) {
      const optionType = this.getOptionType(paths);
      if (optionType && optionType.type) {
        if (/^(element|board|widget)/.test(optionType.type)) {
          if (typeof ref[0] === "string") {
            parentRef[paths[paths.length-1]] = {
              elementPath: ref,
              __opt_type: 'element',
            }
          } else if (Array.isArray(ref[0])) {
            parentRef[paths[paths.length-1]] = ref.map((val)=>{
              return {
                elementPath: val,
                __opt_type: 'element',
              }
            })
          }
        }else if (/^vector.*/.test(optionType.type) && optionType.type.indexOf("multiple") > -1 && !Array.isArray(ref[0])) {
          parentRef[paths[paths.length-1]] = [ref];
        }
      }
    }
    return parentRef[paths[paths.length-1]];
  }
  private setOptionValue(curOptions: Options, paths: string[], value: OptionValue) {
    let ref: Options | OptionValue = curOptions;
    for (let i = 0; i < paths.length; i++) {
      const path = paths[i];
      if (i < paths.length - 1) {
        if (!ref[path]) {
          ref[path] = {};
        }
        ref = ref[path];
      } else {
        ref[path] = value;
      }
    }
  }
  private unsetOptionValue(curOptions: Options, paths: string[]) {
    let ref: Options | OptionValue = curOptions;
    for (let i = 0; i < paths.length; i++) {
      const path = paths[i];
      if (i < paths.length - 1) {
        if (!ref[path]) break;
        ref = ref[path];
      } else {
        delete ref[path];
      }
    }
    //递归删除空对象
    const deleteEmpty = (ref: OptionValue, paths: string[])=>{
      if (!ref) return;
      const path = paths[0];
      deleteEmpty(ref[path], paths.slice(1));
      if (ref[path] === undefined || Object.keys(ref[path]).length === 0) {
        delete ref[path];
      }
    };
    deleteEmpty(curOptions, paths);
  }

  private getResolvedOption(paths: string[], options?: GetOptionOptions): OptionValue {
    let value;
    if (!options?.skipInherit) {
      value = this.getInheritOption(paths);
    }
    if (value === undefined && !options?.skipTransition) {
      value = this.getTransitionOption(paths);
    }
    if (value === undefined) {
      value = this.getOptionValue(this.soul.options, paths);
    }
    if (value === undefined && !options?.skipDefault) {
      value = this.getOptionDefault(paths);
    }
    return value;
  }

  getOption<T extends OptionValue>(paths: string | string[], options?: GetOptionOptions) {
    if (isString(paths)) {
      paths = [paths];
    }
    return this.getResolvedOption(paths, options) as T;
  }

  getOptions(): Options {
    return { ...this.getSoul().options };
  }

  /** option是否被设置 */
  isOptionSet(paths: string | string[]) {
    if (isString(paths)) {
      paths = [paths];
    }
    return this.getResolvedOption(paths, { skipDefault: true }) !== undefined;
  }

  getNonLeafOption(paths: string | string[], options?: Omit<GetOptionOptions, "skipDefault">): object {
    if (isString(paths)) {
      paths = [paths];
    }
    const values = [this.getOptionValue(this.soul.options, paths)];
    if (!options?.skipTransition) {
      values.push(this.getTransitionOption(paths));
    }
    if (!options?.skipInherit) {
      values.push(this.getInheritOption(paths));
    }
    const value = {};
    for (const val of values) {
      if (typeof val === "object") {
        Object.assign(value, val);
      }
    }
    return value;
  }

  /**
   * 获取所有需要批量修改的option paths，默认只返回传入的paths
   * 子类通过重写该方法，以实现批量设置同类option，比如同时设置报表组件的多个单元格
   * @param paths 当前选中的option paths
   * @returns 所有需要修改的option paths
   */
  protected getBatchUpdatePathsList(paths: string[]): string[][] {
    return [paths];
  }

  setOption(paths: string | string[], value: OptionValue, history = true) {
    this.unsetTransientOption(paths);
    if (isString(paths)) {
      paths = [paths];
    }
    const pathsList = this.getBatchUpdatePathsList(paths);
    for (const paths of pathsList) {
      this.setOptionValue(this.soul.options, paths, value);
    }
    history && this.getBoard()?.updateHistory();
  }

  unsetOption(paths: string | string[]) {
    this.unsetTransientOption(paths);
    if (isString(paths)) {
      paths = [paths];
    }
    const pathsList = this.getBatchUpdatePathsList(paths);
    for (const paths of pathsList) {
      this.unsetOptionValue(this.soul.options, paths);
    }
    this.getBoard()?.updateHistory();
  }

  private _transientOptions: Options = reactive({});

  setTransientOption(paths: string | string[], value: any) {
    if (isString(paths)) {
      paths = [paths];
    }
    const pathsList = this.getBatchUpdatePathsList(paths);
    for (const paths of pathsList) {
      this.setOptionValue(this._transientOptions, paths, value);
    }
  }

  unsetTransientOption(paths: string | string[]) {
    if (isString(paths)) {
      paths = [paths];
    }
    const pathsList = this.getBatchUpdatePathsList(paths);
    for (const paths of pathsList) {
      this.unsetOptionValue(this._transientOptions, paths);
    }
  }

  private getTransitionOption(paths: string | string[]) {
    if (isString(paths)) {
      paths = [paths];
    }
    return this.getOptionValue(this._transientOptions, paths);
  }

  private _inheritOptions: Options = reactive({});

  setInheritOption(paths: string | string[], value: any) {
    if (isString(paths)) {
      paths = [paths];
    }
    const pathsList = this.getBatchUpdatePathsList(paths);
    for (const paths of pathsList) {
      this.setOptionValue(this._inheritOptions, paths, value);
    }
  }

  unsetInheritOption(paths: string | string[]) {
    if (isString(paths)) {
      paths = [paths];
    }
    const pathsList = this.getBatchUpdatePathsList(paths);
    for (const paths of pathsList) {
      this.unsetOptionValue(this._inheritOptions, paths);
    }
  }

  private getInheritOption(paths: string | string[]) {
    if (isString(paths)) {
      paths = [paths];
    }
    return this.getOptionValue(this._inheritOptions, paths);
  }

  isInheritOptionSet(paths: string | string[]): boolean {
    return this.getInheritOption(paths) !== undefined;
  }

  toClusterPaths(paths: string | string[]): ClusterPaths {
    try {
      const clusterPaths: ClusterPaths = [];
      this.getBlueprint(paths, (paths, i, blueprint)=>{
        if (isBlueprintCluster(blueprint)) {
          clusterPaths.push(paths[i-1]);
          if (blueprint.cluster === "array") {
            const indexes: string[] = this.getArrayClusterIndexes(paths.slice(0, i));
            clusterPaths.push({
              key: paths[i],
              index: indexes.indexOf(paths[i]),
            });
          } else if (blueprint.cluster === "map") {
            const entries = typeof blueprint.entries === "function" ? blueprint.entries(this) : blueprint.entries;
            clusterPaths.push({
              key: paths[i],
              index: entries.findIndex((entry)=>entry.name === paths[i]),
            });
          }
        } else {
          clusterPaths.push(paths[i]);
        }
      });
      return clusterPaths;
    } catch (err) {
      // console.warn("[toClusterPaths]", err.message, err.cause);
      return undefined;
    }
  }
  fromClusterPaths(clusterPaths: ClusterPaths): string[] {
    const paths = clusterPaths.map((item)=>typeof(item) === "string" ? item : item.key);
    try {
      this.getBlueprint(paths, (paths, i, blueprint)=>{
        const clusterPath = clusterPaths[i];
        if (typeof(clusterPath) === "string") {
          if (isBlueprintCluster(blueprint)) {
            throw new Error("blueprint is unexpected cluster", {cause: {paths, i, blueprint} as any});
          }
        } else {
          if (!isBlueprintCluster(blueprint)) {
            throw new Error("blueprint need to be cluster", {cause: {paths, i, blueprint} as any});
          }
          const {key, index} = clusterPath;
          if (blueprint.cluster === "array") {
            const indexes: string[] = this.getArrayClusterIndexes(paths.slice(0, i));
            if (index > indexes.length - 1) {
              throw new Error("array cluster length < index", {cause: {paths, i, blueprint, indexes, index, key} as any});
            }
            paths[i] = indexes[index];
          } else if (blueprint.cluster === "map") {
            const entries = typeof blueprint.entries === "function" ? blueprint.entries(this) : blueprint.entries;
            if (index > entries.length - 1) {
              throw new Error("map cluster entries length < index", {cause: {paths, i, blueprint, entries, index, key} as any});
            }
            paths[i] = entries[index].name;
          }
        }
      });
      return paths;
    } catch (err) {
      // console.debug("[fromClusterPaths]", err.message, err.cause);
      return undefined;
    }
  }
  trySetOption(clusterPaths: ClusterPaths, value: OptionValue, type?: 'transient') {
    const paths = this.fromClusterPaths(clusterPaths);
    if (!paths) return;
    if (type === 'transient') {
      this.setTransientOption(paths, value);
    } else {
      this.setOption(paths, value);
    }
  }

  setGroupStatus<T extends keyof GroupStatus>(group: string, item: T, value: GroupStatus[T]) {
    this.soul.groupStatus ?? (this.soul.groupStatus = {});
    this.soul.groupStatus[group] ?? (this.soul.groupStatus[group] = {});
    this.soul.groupStatus[group][item] = value;
    if (item !== "fold") {
      this.getBoard()?.updateHistory();
    }
  }

  getGroupStatus(group: string) {
    let groupStatus = this.soul.groupStatus?.[group] ?? {};
    const blueprintsGroupStatus = (this.getBlueprints()[group] as BlueprintValue).groupStatus;
    for (const key in blueprintsGroupStatus) {
      if (!groupStatus.hasOwnProperty(key)) {
        groupStatus[key] = blueprintsGroupStatus[key];
      }
    }
    return groupStatus;
  }

  clearGroupStatusFold() {
    for (const group in this.soul.groupStatus ?? {}) {
      const groupStatus = this.soul.groupStatus[group];
      delete groupStatus.fold;
    }
  }

  deleteArrayCluster(paths: string | string[], index: ClusterArrayIndex) {
    if (isString(paths)) {
      paths = [paths];
    }
    let indexes = this.getArrayClusterIndexes(paths);
    indexes = indexes.filter(item => item !== index);
    this.setOption([...paths, "indexes"], indexes);
  }
  addArrayCluster(paths: string | string[], index: ClusterArrayIndex, history = true) {
    if (isString(paths)) {
      paths = [paths];
    }
    let indexes = this.getArrayClusterIndexes(paths);
    indexes.push(index);
    this.setOption([...paths, "indexes"], indexes, history);
  }
  getArrayClusterIndexes(paths: string | string[]): ClusterArrayIndex[] {
    if (isString(paths)) {
      paths = [paths];
    }
    let items: string[];
    this.getBlueprint(paths, (paths, i, blueprint)=>{
      if (i === paths.length && isBlueprintCluster(blueprint)) {
        items = blueprint.items?.(this);
      }
    });
    const indexesPaths = [...paths, "indexes"];
    let indexes = this.getResolvedOption(indexesPaths, { skipDefault: true }) as ClusterArrayIndex[];
    if (items?.length) {
      if (indexes === undefined) {
        indexes = [];
        const clusterValue = this.getResolvedOption([...paths], { skipDefault: true }) as ClusterArrayValue;
        for (const key in clusterValue || {}) {
          if (key === "indexes") continue;
          indexes.push(key as ClusterArrayIndex);
        }
        while(indexes.length < items.length) {
          indexes.push(`idx-${unique()}`);
        }
        this.setOption(indexesPaths, indexes, false);
      } else if (indexes.length < items.length) {
        while(indexes.length < items.length) {
          indexes.push(`idx-${unique()}`);
        }
        this.setOption(indexesPaths, indexes, false);
      }
    }
    return indexes || [];
  }

  /**
   *
   * @param uid 字段uid
   * @returns
   */
  protected getOptionByField(uid: OptionFieldUID) {
    const field = this.getField(uid);
    const meta = field.meta;
    const { name, uid: widgetUid, subType, extra } = meta;
    if (!widgetUid) {
      console.warn(`field ${uid} get option failed.`)
      return;
    }
    return {
      subType,
      extra,
    }
  }





  //#region 筛选联动
  private _linkageStatus = reactive({
    out: false,
    outElements: [],
  });
  public get isLinkageOut() {
    return this._linkageStatus.out;
  }
  public get linkageOutElements() {
    return this._linkageStatus.outElements || [];
  }




  private _stopWatchLinkage: WatchStopHandle;
  private watchLinkage() {
    this._stopWatchLinkage = watch(()=>{
      return {
        out: this.getOption<boolean>("linkage-out"),
        outElements: this.getOption<string[][]>("linkage-elements"),
      };
    }, (newValue, oldValue)=>{
      if (equals(newValue, oldValue)) return;
      if (newValue.out !== oldValue?.out) {
        this._linkageStatus.out = newValue.out;
      }
      if (!equals(newValue.outElements, oldValue?.outElements)) {
        this._linkageStatus.outElements = newValue.outElements;
      }
    }, {immediate: true});
  }
  private stopWatchLinkage() {
    this._stopWatchLinkage?.();
  }
  private readonly _linkages: Ref<ParsedLinkage[]> = ref([]);
  applyLinkage(linkage: Linkage | Linkage[]) {
    if(!Array.isArray(linkage)){
      linkage = [linkage]
    }
    if (!this.isLinkageOut || !linkage.length) {
      return;
    }
    const newLinkages = linkage.map((mLinkage)=>{
      // const alias = mLinkage.uid ? this.getFieldAlias(mLinkage.uid) : mLinkage.name;
      const fieldUId = mLinkage.uid[2]
      return {
        data: { [fieldUId]: mLinkage.value },
        timestamp: Date.now(),
      };
    });
    //合并
    const oldLinkages = this._linkages.value.map((mLinkage)=>{
      return {
        data: { ...mLinkage.data },
        timestamp: mLinkage.timestamp,
      };
    });
    for (const newLinkage of newLinkages) {
      const uid = Object.keys(newLinkage.data)[0];
      // const oldLinkage = oldLinkages.find((oldLinkage)=>Object.keys(oldLinkage.data)[0] === alias);
      const oldLinkage = oldLinkages.find((oldLinkage)=>Object.keys(oldLinkage.data)[0] === uid);
      if (oldLinkage) {
        oldLinkage.data = newLinkage.data;
        oldLinkage.timestamp = newLinkage.timestamp;
      } else {
        oldLinkages.push(newLinkage);
      }
    }
    this._linkages.value = oldLinkages;
  }

  withdrawLinkage(names?: string[]) {
    if (!this.isLinkageOut || !this._linkages.value.length) {
      return;
    }
    if (names?.length) {
      for (let i = this._linkages.value.length - 1;i > -1;i--) {
        for (const name of names) {
          delete this._linkages.value[i].data[name];
        }
      }
    } else {
      this._linkages.value = [];
    }
  }

  private shouldAcceptLinkageFromElement(fromElement: Element): boolean {
    //优先检查已触发的联动以减少依赖
    if (!fromElement._linkages.value.length) {
      return false;
    }
    if (fromElement === this) {
      return false;
    }
    if (!fromElement.isLinkageOut) return false;

    // 触发联动的组件开了高级设置: 联动其他组件
    const linkageOutElements = fromElement.linkageOutElements;
    // 判断组件是否在白名单 不存在 return false
    return linkageOutElements.map(value=>value.elementPath.slice(-1)[0]).includes(this.uid);
  }

  getLinkageFilter(): {[key:string]: LinkageValue}[] {
    const elements = this.getLinkageElements();

    const linkages: ParsedLinkage[] = [];
    for (const element of elements) {
      if (element._linkages.value?.length) {
        for (const mLinkage of element._linkages.value) {
          const alias = Object.keys(mLinkage.data)[0];
          const index = linkages.findIndex((linkage)=>Object.keys(linkage.data)[0] === alias);
          if (index !== -1) {
            if (linkages[index].timestamp < mLinkage.timestamp) {
              linkages.splice(index, 1, mLinkage);
            }
          } else {
            linkages.push(mLinkage);
          }
        }
      }
    }
    return linkages.map((linkage)=>linkage.data);
  }

  private getLinkageElements() {
    const predicate = <T extends Element>(element: T) => {
      return this.shouldAcceptLinkageFromElement(element);
    };
    const boards = this.getBoard().getBoards();
    let elements: Element[] = [];
    elements.push(...boards.filter(predicate));
    for (const board of boards) {
      elements.push(...board.allLinkageOutWidgets.filter(predicate));
    }
    return elements;
  }
  //#endregion 筛选联动
  public applySelectItem(row: object) {
    //从当前组件往上寻找开启了筛选联动的组件，在该组件上触发筛选联动
    this._applySelectItemLinkage(row);
  }
  private _applySelectItemLinkage(row: object) {
    if (this.isLinkageOut) {
      const linkages = [];
      for (const key in row) {
        linkages.push({name: key, value: row[key]});
      }
      this.applyLinkage(linkages);
    } else {
      this.parent?._applySelectItemLinkage(row);
    }
  }
  public withdrawSelectItem(row: object) {
    //从当前组件往上寻找开启了筛选联动的组件，在该组件上取消筛选联动
    this._withdrawSelectItemLinkage(row);
  }
  private _withdrawSelectItemLinkage(row: object) {
    if (this.isLinkageOut) {
      const names = row ? Object.keys(row) : undefined;
      this.withdrawLinkage(names);
    } else {
      this.parent?._withdrawSelectItemLinkage(row);
    }
  }
  //#region 读数据
  getTableFields(uid: OptionTableUID) {
    if (uid[0] === PrivateDataConnectionUID) {// use private data
      const { fields } = this.getPrivateData();
      return fields;
    } else {
      const table = this.getTable([uid[0], uid[1]]);
      return table?.fields;
    }
  }
  getTable(uid: OptionTableUID) {
    if (uid[0] === PrivateDataConnectionUID) return;
    const connections = this.getBoard().getConnections();
    const connection = connections.find(item => item.uid === uid[0]);
    const table = connection?.tables?.find(table => table.uid === uid[1]);
    return table;
  }
  getField(uid: OptionFieldUID) {
    const fields = this.getTableFields([uid[0], uid[1]]);
    const ids = uid[2]?.split(".");
    let field = fields?.find(field=>field.uid === ids?.[0]);
    if (ids?.length > 1) {
      const subTableUID = field.meta.extra?.subTableUID
      const subTable = this.getTable(subTableUID);
      return subTable.fields.find(field => field.uid === ids?.[1]);
    }
    return field;
  }
  getFieldAlias(uid: OptionFieldUID) {
    const field = this.getField(uid);
    return field?.alias || "";
  }
  getFieldType(uid: OptionFieldUID) {
    const field = this.getField(uid);
    return field?.revisedType || field?.type;
  }

  getTableAlias(uid: OptionTableUID) {
    if (uid[0] === PrivateDataConnectionUID) {// use private data
      return "";
    }
    const table = this.getTable(uid);
    return table?.alias || "";
  }

  private evaluateCondition = (currentValue: any, linkageValue: LinkageValue) => {
    if (Array.isArray(linkageValue)) {
      return linkageValue.indexOf(currentValue as never) > -1;
    } else if (typeof (linkageValue) === "object") {
      const replacements = { "年": "-", "月": "-", "日": "", "时": ":", "分": ":", "秒": "" };
      switch (linkageValue?.operator) {
        case "$and": {
          const value = Array.isArray(linkageValue.value) ? linkageValue.value : [ linkageValue.value ];
          return value.every(condition => this.evaluateCondition(currentValue, condition));
        }
        case "$eq":
          if (Array.isArray(currentValue) && Array.isArray(linkageValue.value)) {
            return equals(currentValue,linkageValue.value)
          }
          return currentValue === linkageValue.value;
        case "$in":
          if (typeof (linkageValue.value) !== "number") {
            return Array.isArray(linkageValue.value) && linkageValue.value.includes(currentValue as never);
          }
          return true;
        case "$contains":
          if (typeof linkageValue.value !== "number" && typeof currentValue === "string") {
            let linkageValue2 = Array.isArray(linkageValue.value) ? linkageValue.value : [linkageValue.value]
            let tmp = (linkageValue2 as []).filter(item => currentValue.indexOf(item) > -1);
            return tmp.length > 0;
          }
          return true;
        case "$gt":
          if (typeof currentValue === 'number')  {
            let value = Array.isArray(linkageValue.value) ? linkageValue.value[0] : linkageValue.value;
            value = typeof value === 'string' ? Number(value) : value;
            return currentValue > value;
          }
          return true;
        case "$gte":
          if (typeof currentValue === 'number')  {
            let value = Array.isArray(linkageValue.value) ? linkageValue.value[0] : linkageValue.value;
            value = typeof value === 'string' ? Number(value) : value;
            return currentValue >= value;
          }
          return true;
        case "$lt":
          if (typeof currentValue === 'number')  {
            let value = Array.isArray(linkageValue.value) ? linkageValue.value[0] : linkageValue.value;
            value = typeof value === 'string' ? Number(value) : value;
            return currentValue < value;
          }
          return true;
        case "$lte":
          if (typeof currentValue === 'number')  {
            let value = Array.isArray(linkageValue.value) ? linkageValue.value[0] : linkageValue.value;
            value = typeof value === 'string' ? Number(value) : value;
            return currentValue <= value;
          }
          return true;
        case "$ne":
          return !equals(currentValue, linkageValue.value);
        case "$nin":
          if (typeof linkageValue.value !== 'number') {
            return Array.isArray(linkageValue.value) && !linkageValue.value.includes(currentValue as never);
          }
          return true;
        case "$time-lte": {
          const value = Array.isArray(linkageValue.value) ? linkageValue.value[0] : linkageValue.value;
          currentValue = currentValue.replace(/(年|月|日|时|分|秒)/g, (match) => replacements[match]);
          return dayjs(currentValue).valueOf() <= dayjs(value).valueOf();
        }
        case "$time-gte": {
          const value = Array.isArray(linkageValue.value) ? linkageValue.value[0] : linkageValue.value;
          currentValue = currentValue.replace(/(年|月|日|时|分|秒)/g, (match) => replacements[match]);
          return dayjs(currentValue).valueOf() >= dayjs(value).valueOf();
        }
        default:
          return true;
      }
    } else {
      return currentValue === linkageValue;
    }
  }
  protected afterLinkageAndFilterRows(tableUIDs: OptionTableUID[]) {
    this.watchDataChanged(tableUIDs);
    const cacheKey = this.tableUIDsToKey(tableUIDs);
    if (!this.dataCache[cacheKey]) {
      const rows = this._afterLinkageAndFilterRows(tableUIDs);
      this.dataCache[cacheKey] = rows;
    }
    return this.dataCache[cacheKey];
  }
  private _afterLinkageAndFilterRows(tableUIDs: OptionTableUID[]){
    const tableUID = tableUIDs[0][1];
    const dataCollectionKey = this.getDataCollectionKey(tableUIDs[0]);
    if (tableUID === PrivateDataTableUID) {
      return this.getPrivateData().rows;
    } else if (!this.dataCollections[dataCollectionKey]) {
      this.dataCollections[dataCollectionKey] = shallowReactive({
        optionTableUID: tableUIDs[0],
      })
    }
    return this.dataCollections[dataCollectionKey]?.data?.rows || [];
  }
  private dataCache: {[key: string]: Row[]} = shallowReactive({});
  private dataChangeWatchMap: {[key: string]: {
    stop: WatchStopHandle,
    stopVisible?: WatchStopHandle,
  } } = {};
  private tableUIDsToKey(tableUIDs: OptionTableUID[]) {
    const tableUIDsStrs = Array.from(new Set(tableUIDs.map(val=>val.join())));
    return tableUIDsStrs.sort().join();
  }
  protected getDataCollectionKey(optionTableUID?: OptionTableUID) {
    return optionTableUID?.join?.() || "";
  }
  protected get shouldTriggerDataChange() {
    return this.status.isVisible;
  }
  private watchDataChanged(tableUIDs: OptionTableUID[]) {
    const tableUIDsStr = this.tableUIDsToKey(tableUIDs);
    const dataCollectionKey = this.getDataCollectionKey(tableUIDs[0]);
    if(!this.dataChangeWatchMap[tableUIDsStr]){
      this.effectScope.run(()=>{
        const watchState = {
          stop: undefined as WatchStopHandle,
          stopVisible: undefined as WatchStopHandle,
        };
        let firstOldValue;
        watchState.stop = watch(()=>{
          const data = this.dataCollections[dataCollectionKey]?.data;
          const rows = data?.rows || [];
          return deepClone(rows);
        }, (value, oldValue)=>{
          if (this.shouldTriggerDataChange) {
            if(!equals(value, oldValue)){
              delete this.dataCache[tableUIDsStr];
            }
          } else {
            watchState.stopVisible?.();
            firstOldValue = firstOldValue ?? oldValue;
            watchState.stopVisible = watch(()=>this.shouldTriggerDataChange, ()=>{
              if (this.shouldTriggerDataChange) {
                if (!equals(value, firstOldValue)) {
                  delete this.dataCache[tableUIDsStr];
                }
                firstOldValue = undefined;
                watchState.stopVisible?.();
                watchState.stopVisible = undefined;
              }
            });
          }
        });
        this.dataChangeWatchMap[tableUIDsStr] = watchState;
      });
    }
  }
  getData() {
    return {
      getRows: (uids: OptionFieldUID[], encode?: DataEncode, key?: string) => {
        if(isEmpty(uids)) return [];
        const tableUIDs: OptionTableUID[] = uids.map((uid)=>[uid[0], uid[1]]);
        const otherUID = tableUIDs.find(uid => uid[1] !== tableUIDs[0][1]);
        nextTick(()=>{//错误收集放到nextTick中以减少watch的依赖
          if (!isEmpty(otherUID)) {
            //不支持获取多个表的数据,存下异常信息
            if (!this.status.error.data) {
              this.status.error.data = [];
            }
            let error = this.status.error.data.find(val => {
              return val.key === key && val.type === "multi-filed-error";
            });
            if (error) {
              error.data = uids;
            } else {
              this.status.error.data.push({ key, type: "multi-filed-error", data: uids });
            }
            return [];
          } else if (this.status.error.data?.length) {
            this.status.error.data = this.status.error.data.filter(val => val.type !== "multi-filed-error");
          }
        });
        if (!isEmpty(otherUID)) return [];
        const rows = this.afterLinkageAndFilterRows(tableUIDs) ?? [];
        if (isEmpty(rows)) return rows;
        if (encode === 'array') {
          const arrayRows = [];
          const keys = uids.map(uid=>uid[2]);
          for (const key of keys) {
            const arr = [];
            for (const row of rows) {
              arr.push(row[key]);
            }
            arrayRows.push(arr);
          }
          return arrayRows;
        }
        return rows;
      },
      getPagingRows: async (tableUID: OptionTableUID, pageOptions: QueryOptions = {}) => {
        const result = {
          count: 0,
          rows: [],
        }
        if(isEmpty(tableUID)) return result;
        const bucket = await this.getBoard().readDataByOptions(tableUID, pageOptions);
        result.rows = bucket?.rows || [];
        result.count = bucket?.count || 0;
        return result;
      },
      _translateRows: (rows: object[], uids: OptionFieldUID[]) => {
        const tableUID: OptionTableUID = [uids?.[0]?.[0], uids?.[0]?.[1]];
        const fields = this.getTableFields(tableUID);
        if (!fields?.length) {
          return rows;
        }
        const translatedRows = [];
        for (const row of rows) {
          const translatedRow = {};
          for (const key in row) {
            const field = fields.find(field=>field.uid === key);
            translatedRow[field?.alias ?? key] = row[key];
          }
          translatedRows.push(translatedRow);
        }
        return translatedRows;
      },
      getColumns: (uids: OptionFieldUID[], encode?: DataEncode | DataFormat) => {
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
            for (const key in row) {
              let _key = aliasMap[key] ?? key;
              if (fieldUIDs.includes(key as FieldUID)) {
                json[_key] = row[key];
              }
            }
            return json;
          })
        } else if(encode === 'row') {
          return rows.map(row => {
            const array = [];
            for (const key in row) {
              if (fieldUIDs.includes(key as FieldUID)) {
                array.push(row[key]);
              }
            }
            return array;
          })
        }
        return fieldUIDs.map(fieldUID => rows.map((row)=>row[fieldUID]));
      },
      removeRows: async (tableUID: OptionTableUID, rows: object[], keys?:OptionFieldUID[]) => {
        return await this.getBoard().removeData(tableUID,rows,keys);
      },
      updateRows: async (tableUID: OptionTableUID,rows: object[], keys?:OptionFieldUID[]) => {
        return await this.getBoard().updateData(tableUID,rows,keys);
      },
      addRows: async (tableUID: OptionTableUID,rows: object[]) => {
        return await this.getBoard().addData(tableUID,rows);
      }
    };
  }
  getRefreshInterval(uid: OptionFieldUID) {
    const [connectionUID, tableUID] = uid ?? [];
    if (connectionUID === PrivateDataConnectionUID) {
      return 0;
    }
    const connections = this.getBoard().getConnections();
    const connection = connections.find(connection => connection.uid === connectionUID);
    return connection?.refreshIntervals?.[tableUID] ?? connection?.refreshInterval;
  }

  /** 使用数据可以生成多少个拷贝 */
  numberOfCopies() {
    const pathsArray: string[][] = [];
    const blueprints = this.getBlueprints();
    const queue = [
      { blueprintOptions: blueprints, paths: [] }
    ];
    while (queue.length > 0) {
      const { blueprintOptions, paths } = queue.pop();
      for (const key in blueprintOptions) {
        let blueprint = blueprintOptions[key];
        if (isBlueprintCluster(blueprint)) {
          let indexes: string[];
          if (blueprint.cluster === "map") {
            const entries = isCallableEntries(blueprint.entries) ? blueprint.entries(this) : blueprint.entries;
            indexes = entries.map((entry)=>entry.name);
          } else {
            indexes = this.getArrayClusterIndexes([...paths]);
          }
          for (const index of indexes || []) {
            queue.push({blueprintOptions: blueprint.blueprintOptions, paths: [...paths, key, index]});
          }
        } else {
          const type = parseOptionType(blueprint.type).parsedType;
          if (type === "field") {
            pathsArray.push([...paths, key]);
          }
        }
      }
    }
    for (const paths of pathsArray) {
      const fields = this.getOption<OptionFieldValue[]>(paths);
      if(!fields) continue;
      const uids = fields.map((field)=>field.uid);
      if (fields.length) {
        return this.getData().getRows(uids).length || 0;
      }
    }
    return 0;
  }
  //#endregion 读数据

  //#region 组件自有数据
  protected getDefaultPrivateData(): PrivateData {
    return {
      fields: [{uid: "f_1", alias: i18next.t("elementTs.elementData"), type: "string"}],
      rows: [],
    };
  }
  hasPrivateData() {
    return true;
  }
  getPrivateData(): PrivateData {
    return this.soul.privateData ?? this.getDefaultPrivateData();
  }
  savePrivateData(privateData: PrivateData) {
    this.soul.privateData = privateData;
    this.getBoard().updateHistory();
  }
  //#endregion 组件自有数据

  //返回用于联动、筛选的字段名称
  getPrivateFiledAlias(): string[] {
    return [];
  }

  // 判断数据条件是否符合
  checkDataConditions(conditions: DataCondition[], rowIndex: number = 0) {
    const connectionData = this.getBoard().connectionData;
    if (!connectionData || !(conditions.length > 0)) return false;
    const data = new Data(connectionData, this);
    const meetRuleFuncs = data.getMeetRuleFuncs();
    for (let index = 0; index < conditions.length; index++) {
      const condition = conditions[index];
      for (const group of condition.rules) {
        let and = true;
        for (const rule of group) {
          if (!rule.field || !rule.func || !rule.args) continue;
          // @ts-ignore
          if (rule.table === PROJECT_PARAMS_UID) {
            const projectParams = this.getBoard().projectParams;
            if (!meetRuleFuncs[rule?.func](projectParams[rule.field], rule.args)) {
              and = false;
            }
          } else {
            const tableData = connectionData[rule.connection]?.find(table => table.tableId === rule.table);
            if (!tableData) {
              void this.getBoard().ensureConnectionBucket([rule.connection, rule.table]);
              return false;
            }
            const tableUIDs:OptionTableUID[] = [[rule.connection, rule.table]];
            const rows = this._afterLinkageAndFilterRows(tableUIDs) ?? [];
            if ((rule.field === 'row' || rule.field === 'reverseRow') && rowIndex > -1) {  // 行号条件处理
              const { func, args } = rule;
              let _rowIndex = rule.field === "row" ? rowIndex + 1 : rows.length - rowIndex;
              if (!meetRuleFuncs[func](_rowIndex, args)) {
                and = false;
              }
            } else if (rule.field == 'count') { // 数据条数
              const { func, args } = rule;
              if (!meetRuleFuncs[func](rows.length, args)) {
                and = false;
              }
            } else if (rowIndex > -1) {
              let result = data.filterByFieldMethodRule(rows, rule, rowIndex);
              if (!result) and = false;
            }
          }
        }
        if (and) return true;
      }
    }
    return false;
  }
  // 静音当前组件
  mute(muted: boolean) {}

  lookAt(duration: number) {}

  async cloneSelf(name?: string, cloneParams?: CloneParams, _options?: Options): Promise<Element> {
    return null;
  }

  getExtension(key: string){
    return null;
  }

  /** 项目保存的时候调用*/
  async onSave() {}

  async snapshotForCover():Promise<string> {
    return null;
  }

  destroy() {
    this._destroyed = true;
    this._effectScope?.stop();
    this.stopWatchLinkage();
    Object.values(this.dataChangeWatchMap).forEach(({ stop, stopVisible }) => {
      stopVisible?.();
      stop?.();
    });
    this.dataChangeWatchMap = {};
    Object.keys(this.dataCache).forEach(key => delete this.dataCache[key]);
  }
  trash() {
    this.trashed = true;
  }
  untrash() {
    this.trashed = false;
  }

  get plan() {
    const curPlan =  this.getSoul().plan || SaasPlan.FREE;
    return compareSaasPlan(curPlan, this.parent?.plan) ? curPlan : this.parent.plan;
  }

  set plan(plan: SaasPlan) {
    this.getSoul().plan = plan;
  }
}
