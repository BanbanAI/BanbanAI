import { DefinedOptions, DefinedOptionGroups, DefinedOptionGroup, DefinedOptionCluster, DefinedOption, ParsedOption, isOption, isOptionCluster, isOptionSubgroup, BlueprintOptions, BlueprintCluster, DefinedOptionSubgroup } from "../types";
import { Element } from "../controllers/element";
import { reactive } from "vue";
import { registerI18nOptionLabelRefresh } from "./elementI18nRefresh";

const allElements: {
  [key: string]: {
    parsedOption?: ParsedOption,
    blueprint?: BlueprintOptions,
    dirty?: boolean,
  },
} = {};
const i18nOptionVersions = reactive<Record<string, number>>({});

export function markDirty(type: string) {
  if (allElements[type]) {
    allElements[type].dirty = true;
  }
}

export function buildElement(ElementCls: Omit<typeof Element, "constructor">) {
  const type = ElementCls.prototype.type;
  if (allElements[type]?.dirty) {
    delete allElements[type];
  }
  if (!allElements[type]) {
    parseOptions(type, ElementCls.defineOptions());
  }
}

export function getBlueprints(type: string) {
  void i18nOptionVersions[type];
  return allElements[type]?.blueprint;
}
export function getParsedOptions(type: string) {
  void i18nOptionVersions[type];
  return allElements[type]?.parsedOption;
}
export function refreshI18nOptionLabels(type: string, resolve: (value: string) => string) {
  const element = allElements[type];
  if (!element) return;
  refreshI18nOptionLabelsInValue(element.parsedOption, resolve);
  refreshI18nOptionLabelsInValue(element.blueprint, resolve);
  i18nOptionVersions[type] = (i18nOptionVersions[type] || 0) + 1;
}
registerI18nOptionLabelRefresh(refreshI18nOptionLabels);

function refreshI18nOptionLabelsInValue(value: unknown, resolve: (value: string) => string) {
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") {
      (value as Record<string, unknown>)[key] = resolve(item);
    } else {
      refreshI18nOptionLabelsInValue(item, resolve);
    }
  }
}

function parseOptions(type: string, optionList: DefinedOptions[]): ParsedOption {
  const definedOption = {};
  for (let i = optionList.length - 1; i >= 0; i--) {
    const option = optionList[i];
    for (const namespace in option) {
      if (!definedOption[namespace]) {
        definedOption[namespace] = {};
      }
      mergeNamespace(option[namespace], definedOption[namespace]);
    }
  }
  buildBlueprint(type, definedOption);
  const parsedOption = {};
  for (const namespace in definedOption) {
    let groups = [];
    for (const group in definedOption[namespace]) {
      const index = groups[0] === "basic" ? 1 : 0;
      groups.splice(index, 0, group)
    }
    const clonedGroups = [...groups];
    //根据after、before进行二次调整
    for(const key of groups){
      const group = definedOption[namespace][key]
      if(group.before && definedOption[namespace][group.before]){
        clonedGroups.splice(clonedGroups.indexOf(key), 1);
        clonedGroups.splice(clonedGroups.indexOf(group.before), 0, key);
      }else if(group.after && definedOption[namespace][group.after]){
        clonedGroups.splice(clonedGroups.indexOf(key), 1);
        clonedGroups.splice(clonedGroups.indexOf(group.after) + 1, 0, key);
      }
    }
    parsedOption[namespace] = clonedGroups.map(key=>Object.assign(definedOption[namespace][key], {
      group: key,
    }));
  }
  if (!allElements[type]) {
    allElements[type] = {};
  }
  allElements[type].parsedOption = parsedOption;
  return parsedOption;
}

function buildBlueprint(type: string, definedOption: DefinedOptions) {
  const blueprint: BlueprintOptions = {};
  for (const namespace in definedOption) {
    const definedOptionGroups = definedOption[namespace as keyof DefinedOptions];
    for (const group in definedOptionGroups) {
      const definedOptionGroup = definedOptionGroups[group];
      blueprint[group] = {
        alias: definedOptionGroup.alias,
        group,
        type: definedOptionGroup.type,
        default: definedOptionGroup.default,
        before: definedOptionGroup.before,
        after: definedOptionGroup.after,
        hideTitle: definedOptionGroup.hideTitle,
        groupStatus: {
          fold: definedOptionGroup.fold,
          locked: definedOptionGroup.locked,
        },
      };
      buildOptionBlueprint(blueprint, definedOptionGroup.children, group);
    }
  }
  if (!allElements[type]) {
    allElements[type] = {};
  }
  allElements[type].blueprint = blueprint;
  return blueprint;
}
export function buildOptionBlueprint(blueprint: BlueprintOptions, options: DefinedOptionGroup["children"], group: string) {
  for (const option of options) {
    if (isOption(option)) {
      const { type, alias, selectChoices } = option;
      blueprint[option.name] = { type, default: option.default, group, alias, selectChoices };
    } else if (isOptionCluster(option)) {
      const blueprintCluster: BlueprintCluster = { cluster: option.cluster, blueprintOptions: {} };
      if (option.cluster === "map") {
        blueprintCluster.entries = option.entries;
      } else if (option.cluster === "array") {
        blueprintCluster.items = option.items;
      }
      blueprint[option.name] = blueprintCluster;
      buildOptionBlueprint(blueprintCluster.blueprintOptions, option.children, group);
    } else {
      buildOptionBlueprint(blueprint, option.children, group);
    }
  }
}

function mergeNamespace(src: DefinedOptionGroups, dest: DefinedOptionGroups) {
  const groups = Object.keys(src);
  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i];
    if (!dest[group]) {
      dest[group] = { children: [] };
    }
    mergeGroup(src[group], dest[group]);
  }
}
function mergeGroup(src: DefinedOptionGroup, dest: DefinedOptionGroup) {
  dest.alias = src.alias ?? dest.alias;
  dest.tip = src.tip ?? dest.tip;
  dest.type = src.type ?? dest.type;
  dest.default = src.default ?? dest.default;
  dest.fold = src.fold ?? dest.fold;
  dest.visible = src.visible ?? dest.visible;
  dest.locked = src.locked ?? dest.locked;
  dest.before = src.before ?? dest.before;
  dest.after = src.after ?? dest.after;
  dest.hideTitle = src.hideTitle ?? dest.hideTitle;
  src.children = src.children ?? [];
  mergeChildren(src.children, dest.children);
}
function mergeChildren(src: DefinedOptionGroup["children"], dest: DefinedOptionGroup["children"]) {
  for (const option of src) {
    let found = false;
    for (let i = 0; i < dest.length; i++) {
      if (option.name === dest[i].name) {
        found = true;
        const destOption = dest[i];
        if (isOptionCluster(option) && isOptionCluster(destOption)) {//cluster
          mergeOptionCluster(option, destOption);
        } else if (isOptionSubgroup(option) && isOptionSubgroup(destOption)) {
          mergeOptionSubgroup(option, destOption);
        } else if (isOption(option) && isOption(destOption)) {
          mergeOption(option, destOption);
        } else {
          console.warn(`[defineOptions] Failed to merge ${option.name}, different type`, option, destOption);
        }
        break;
      }
    }
    if (!found) {
      dest.push(option);
    }
  }
}
function mergeOptionSubgroup(src: DefinedOptionSubgroup, dest: DefinedOptionSubgroup) {
  dest.name = src.name ?? dest.name;
  dest.alias = src.alias ?? dest.alias;
  dest.tip = src.tip ?? dest.tip;
  dest.show = src.show ?? dest.show;
  dest.fold = src.fold ?? dest.fold;
  dest.visible = src.visible ?? dest.visible;
  src.children = src.children ?? [];
  mergeChildren(src.children, dest.children);
}
function mergeOptionCluster(src: DefinedOptionCluster, dest: DefinedOptionCluster) {
  dest.cluster = src.cluster ?? dest.cluster;
  dest.name = src.name ?? dest.name;
  dest.alias = src.alias ?? dest.alias;
  dest.items = src.items ?? dest.items;
  dest.itemsHint = src.itemsHint ?? dest.itemsHint;
  dest.entries = src.entries ?? dest.entries;
  dest.fold = src.fold ?? dest.fold;
  dest.show = src.show ?? dest.show;
  dest.sortable = src.sortable ?? dest.sortable;
  dest.editable = src.editable ?? dest.editable;
  dest.visible = src.visible ?? dest.visible;
  src.children = src.children ?? [];
  mergeChildren(src.children, dest.children);
}
function mergeOption(src: DefinedOption, dest: DefinedOption) {
  for (const key in src) {
    dest[key] = src[key];
  }
}
