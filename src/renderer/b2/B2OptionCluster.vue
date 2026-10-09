<template>
  <div class="cluster" :class="{
    'no-cluster': (item.cluster === 'array' && !indexes.length) || (item.cluster === 'map' && !entries.length),
    'b2-option-cluster-fold': fold === 'fold',
  }">
    <div class="option-cluster-header">
      <div class="option-cluster-title" @click="triggerOptionFold">
        <el-icon class="fold-icon"><i-ep-arrow-down /></el-icon>
        {{ item.alias }}<template v-if="isSingleMap"> - {{ entries[0].alias }}</template>
        <el-tooltip placement="top" effect="light">
          <template #content>
            <div style="max-width: 200px;">{{item.tip}}</div>
          </template>
          <div class="tip-icon" v-if="item.tip" @click.stop>
            <el-icon size="14"><i-ant-design-question-circle-outlined /></el-icon>
          </div>
        </el-tooltip>
      </div>
      <div class="option-cluster-action" v-if="!isSingleMap">
        <el-icon size="14" :class="{active: show === 'tab'}" :title="$t('optionClusterTab')" @click="show = 'tab'"><i-uil-window-section /></el-icon>
        <el-icon size="14" :class="{active: show === 'list'}" :title="$t('optionClusterList')" @click="show = 'list'"><i-uil-window-grid /></el-icon>
        <template v-if="item.cluster === 'array' && editable">
          <el-icon size="14" :title="$t('optionClusterAdd')" @click="addCluster" v-if="addable"><i-ep-plus /></el-icon>
          <el-icon size="14" :title="$t('optionClusterCopy')" v-show="show === 'tab'" @click="copyCluster" v-if="copyable"><i-ep-copy-document /></el-icon>
          <el-icon class="delete" :class="{disabled: !activeIndexDeletable}" size="14" :title="!activeIndexDeletable?$t('optionClusterNotDelete'):$t('optionClusterDelete')" @click="activeIndexDeletable && handleDeleteCluster(activeIndex)" v-if="deleteable"><i-ep-delete /></el-icon>
        </template>
      </div>
    </div>
    <div class="option-cluster-body">
      <template v-if="isSingleMap">
        <b2-option-subgroup class="cluster-item"
            :element="element" :item="item" :title="entries[0].alias" :hide-title="true" :paths="[...paths, item.name, entries[0].name]" />
      </template>
      <template v-else-if="item.cluster === 'map'">
        <vn-stack v-show="show === 'tab'">
          <div class="tab-container">
            <el-icon @click="scrollTab(-200)"><i-ep-arrow-left-bold /></el-icon>
            <div class="tabs" ref="tabContainer">
              <vn-stack-tab v-for="entry in entries" :key="entry.name" :name="entry.name" @active="scrollTabIntoView">
                <span>{{ entry.alias }}</span>
              </vn-stack-tab>
            </div>
            <el-icon @click="scrollTab(200)"><i-ep-arrow-right-bold /></el-icon>
          </div>
          <div class="layers">
            <vn-stack-layer v-for="entry in entries" :key="entry.name" :name="entry.name">
              <b2-option-subgroup class="cluster-item"
                :element="element" :item="item" :title="entry.alias" :hide-title="true" :paths="[...paths, item.name, entry.name]" />
            </vn-stack-layer>
          </div>
        </vn-stack>
        <div v-show="show === 'list'">
          <b2-option-subgroup class="cluster-item" v-for="entry in entries" :key="entry.name"
            :element="element" :item="item" :title="entry.alias" :paths="[...paths, item.name, entry.name]" />
        </div>
      </template>
      <template v-else-if="item.cluster === 'array'">
        <div class="empty" v-show="indexes.length === 0">
          <el-icon size="14"><i-ep-info-filled /></el-icon>
          {{ $t("optionClusterAddTip") }}
        </div>
        <vn-stack v-model="activeIndex" v-if="show === 'tab'">
          <div class="tab-container" v-show="indexes.length > 0">
            <el-icon @click="scrollTab(-200)"><i-ep-caret-left /></el-icon>
            <div class="tabs" ref="tabContainer">
              <draggable :model-value="indexes"
              :force-fallback="sortable"
              :draggable="!sortable"
              :item-key="draggableKey"
              animation="500" delay="60"
              chosen-class="dragging"
              handle=".vn-stack-tab"
              :component-data="{ class: 'tabs-content' }"
              @end="handleDragEnd"
              >
                <template #item="{ element:index, index: idx }">
                  <vn-stack-tab :key="index" :name="index" @active="scrollTabIntoView">
                    <span>{{ items[idx] }}</span>
                  </vn-stack-tab>
                </template>
              </draggable>
            </div>
            <el-icon @click="scrollTab(200)"><i-ep-caret-right /></el-icon>
          </div>
          <div class="layers">
            <vn-stack-layer v-for="(index, idx) in indexes" :key="index" :name="index">
              <b2-option-subgroup class="cluster-item"
                :element="element" :item="item" :title="items[idx]" :hide-title="true" :paths="[...paths, item.name, index]"
                :deletable="idx >= originItems.length && editable && (!item.least || item.least < indexes.length)" @delete="handleDeleteCluster(index, idx)">
                <div class="cluster-hint" :class="{none: !originItems[idx]}" v-if="item.itemsHint && originItems.length > 0">
                  <div class="label">{{ item.itemsHint }}</div>
                  <div class="content">{{ originItems[idx] ?? $t('b2OptionCluster.none') }}</div>
                </div>
              </b2-option-subgroup>
            </vn-stack-layer>
          </div>
        </vn-stack>
        <div v-else>
          <draggable class="aaa" :model-value="indexes" :force-fallback="sortable" :draggable="!sortable" :item-key="draggableKey"
            animation="500" delay="60" chosen-class="dragging" handle=".option-subgroup-header" @end="handleDragEnd">
            <template #item="{ element:index, index: idx }">
              <b2-option-subgroup class="cluster-item" :class="{active: activeIndex === index}" :key="index"
                :element="element" :item="item" :title="items[idx]" :paths="[...paths, item.name, index]"
                :deletable="idx >= originItems.length && editable && (!item.least || item.least < indexes.length)" @delete="handleDeleteCluster(index, idx)">
                <div class="cluster-hint" :class="{none: !originItems[idx]}" v-if="item.itemsHint && originItems.length > 0">
                  <div class="label">{{ item.itemsHint }}</div>
                  <div class="content">{{ originItems[idx] ?? $t('b2OptionCluster.none') }}</div>
                </div>
              </b2-option-subgroup>
            </template>
          </draggable>
        </div>
      </template>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, inject, ref, toRaw, watch, Ref } from "vue";
import { unique } from "@common/utils/unique";
import { DefinedOptionCluster, isOptionCluster, isCallableEntries } from "./types";
import { Element } from "@renderer/b2/controllers/element";
import { ClusterArrayIndex } from "@common/types/project";
import { BULK_UPDATE_VALUE } from "./inject";
import draggable from 'vuedraggable'
import { deepClone } from "@common/utils/object";
import i18next from "i18next";

const props = defineProps<{
  element: Element,
  item: DefinedOptionCluster,
  paths: string[],
}>();
const bulkUpdateValue = inject(BULK_UPDATE_VALUE);

const fold = ref(props.item.fold || 'fold');
const triggerOptionFold = () => {
  if (fold.value === "always-unfold") {
    return;
  }
  fold.value = fold.value === 'fold' ? 'unfold' : 'fold';
}
const show = ref(props.item.show ?? "tab");
const sortable = ref(props.item.sortable ?? true);
const editable = ref(props.item.editable ?? true);
const addable = ref(props.item.addable ?? true);
const copyable = ref(props.item.copyable ?? true);
const deleteable = ref(props.item.deleteable ?? true);
const tabContainer: Ref<HTMLElement> = ref(null);
const scrollTab = (delta: number)=>{
  if (tabContainer.value) {
    tabContainer.value.scrollBy({left: delta, behavior: "smooth"});
  }
};
const scrollTabIntoView = function(tab: HTMLElement) {
  tab.scrollIntoView({behavior: "smooth", block: "nearest", inline: "nearest"});
};

const draggableKey = unique();
const handleDragEnd = ({ oldIndex, newIndex })=>{
  if (oldIndex === newIndex) return;
  bulkUpdateValue((element) => {
    const clusterIndexes = element.getArrayClusterIndexes([... props.paths, props.item.name]);
    const index = clusterIndexes.splice(oldIndex, 1)[0];
    clusterIndexes.splice(newIndex, 0, index);
    element.setOption([...props.paths, props.item.name, "indexes"], toRaw(clusterIndexes));
  });
};

const entries = computed(() => {
  if (isOptionCluster(props.item) && props.item.cluster === 'map') {
    return isCallableEntries(props.item.entries) ? props.item.entries(props.element) : props.item.entries;
  } else {
    return undefined;
  }
});
const indexes = computed(() => {
  if (isOptionCluster(props.item) && props.item.cluster === 'array') {
    let indexes = props.element.getArrayClusterIndexes([...props.paths, props.item.name]);
    return indexes;
  }
  return [];
});
const isSingleMap = computed(()=>{
  return props.item.cluster === 'map' && entries.value.length === 1;
});
const originItems = computed(()=>{
  if (isOptionCluster(props.item) && props.item.cluster === 'array') {
    if (props.item.items) {
      return props.item.items(props.element);
    }
  }
  return [];
});
const items = computed(() => {
  if (isOptionCluster(props.item) && props.item.cluster === 'array') {
    if (props.item.items) {
      const items = props.item.items(props.element);
      const count = Math.max(items.length, indexes.value.length);
      if (props.item.itemsHint) {
        items.length = 0;
      }
      for (let idx = items.length; idx < count; idx++) {
        items.push(i18next.t("optionConfiguration") + (idx+1));
      }
      return items;
    } else if (props.item.customAlias) {
      return props.item.customAlias(props.element, props.paths);
    } else {
      return indexes.value.map((_, idx)=>{
        return i18next.t("optionConfiguration") + (idx+1);
      });
    }
  }
  return [];
});

const activeIndex: Ref<ClusterArrayIndex> = ref(indexes[0]);
const activeIndexDeletable = computed(()=>{
  if (props.item.least && props.item.least >= indexes.value.length) {
    return false;
  }
  const idx = indexes.value.indexOf(activeIndex.value);
  if (idx >= 0 && idx < originItems.value.length) {
    return false;
  }
  return true;
});
const handleDeleteCluster = (index: ClusterArrayIndex, idx?: number) => {
  bulkUpdateValue((element) => {
    const indexes = element.getArrayClusterIndexes([... props.paths, props.item.name]);
    if (!indexes.includes(index)) {
      index = indexes[idx];
    }
    element.deleteArrayCluster([...props.paths, props.item.name], index);
  })
};
const addCluster = () => {
  const index: ClusterArrayIndex =`idx-${unique()}`;
  bulkUpdateValue((element) => {
    element.addArrayCluster([...props.paths, props.item.name], index);
  })
};

const copyCluster = () => {
  const index: ClusterArrayIndex =`idx-${unique()}`;
  bulkUpdateValue((element) => {
    element.addArrayCluster([...props.paths, props.item.name], index);
    element.setOption([...props.paths, props.item.name, index], deepClone(element.getOption([...props.paths, props.item.name, activeIndex.value ])));
    activeIndex.value = index;
  })
  
}
</script>

<style lang="scss" scoped>
.cluster {
  display: flex;
  flex-direction: column;
  margin: 5px;
  padding: 0 2px;
  background-color: var(--option-bg-color);
  border: 1px solid var(--el-border-color);
  &.no-cluster {
    background-color: transparent;
    border: none;
    margin-bottom: 0;
    .el-button {
      background-color: transparent;
    }
  }

  .option-cluster-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 32px;
    user-select: none;
    .option-cluster-title {
      display: flex;
      align-items: center;
      flex-grow: 1;
      text-indent: 4px;
      cursor: var(--cursor-pointer);
    }
    .option-cluster-action {
      display: flex;
      justify-content: flex-end;
      .el-icon {
        margin: 0 3px;
        cursor: var(--cursor-pointer);
        &.active {
          color: var(--color-primary);
        }
        &:hover {
          color: var(--color-primary);
        }
        &.delete:hover {
          color: var(--color-danger);
        }
        &.disabled {
          color: var(--text-color-inactive) !important;
          cursor: var(--cursor-default);
        }
      }
    }
  }

  .option-cluster-body {
    .empty {
      display: flex;
      align-items: center;
      height: 30px;
      justify-content: center;
      text-indent: 5px;
      color: var(--text-color-inactive);
    }
    .cluster-hint {
      padding: 5px;
      display: flex;
      height: 34px;
      align-items: center;

      .label {
        width: 100px;
      }
      .content {
        max-width: calc(100% - 100px);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1;
      }
    }
    .tab-container {
      display: flex;
      align-items: center;
      background-color: var(--bg-color-overlay);
      user-select: none;
      margin-bottom: 10px;
      .el-icon {
        margin: 0 3px;
        cursor: var(--cursor-pointer);
        &:hover {
          color: var(--color-primary);
        }
      }
      .tabs {
        flex-grow: 1;
        display: flex;
        overflow-y: scroll;
        &::-webkit-scrollbar {
          display: none;
        }
        .tabs-content {
          width: 100%;
          height: 100%;
          display: flex;
        }
        .vn-stack-tab {
          display: inline-block;
          padding: 0 8px;
          height: 30px;
          line-height: 30px;
          cursor: var(--cursor-pointer);
          white-space: nowrap;
          &.active {
            border-bottom: 2px solid var(--color-primary);
            span {
              color: var(--color-primary);
            }
          }
        }
      }
    }
    .cluster-item {
      margin: 0;
      border: none;
      width: 100%;
    }

    .tabs-content > .vn-stack-tab.dragging.sortable-ghost,
    .b2-option-subgroup.dragging.sortable-ghost {
      visibility: hidden;
      opacity: 0;
    }
  }

  &.b2-option-cluster-fold {
    .fold-icon {
      transform: rotate(-90deg);
    }
    .option-cluster-action {
      display: none;
    }
    .option-cluster-body {
      display: none;
    }
  }
}
</style>
