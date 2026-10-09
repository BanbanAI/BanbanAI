<template>
  <div class="b2-option-subgroup" v-if="hasItemShow">
    <vn-stack>
      <div class="tab-container">
        <el-icon @click="scrollTab(-200)" v-if="!isScroll"><i-ep-caret-left /></el-icon>
        <div class="tabs" :class="isScroll? '' : 'tabs-scroll'" ref="tabContainer">
          <template v-for="item in newItem" :key="item.name">
            <vn-stack-tab :name="item.name" v-if="handleTabVisible(item.visible)">
              <span>{{ item.alias }}</span>
              <el-tooltip placement="top" effect="light">
                <template #content>
                  <div style="max-width: 200px;">{{item.tip}}</div>
                </template>
                <div class="tip-icon" v-if="item.tip" @click.stop>
                  <el-icon size="14"><i-ant-design-question-circle-outlined /></el-icon>
                </div>
              </el-tooltip>
            </vn-stack-tab>
          </template>
        </div>
        <el-icon @click="scrollTab(200)" v-if="!isScroll"><i-ep-caret-right /></el-icon>
      </div>
      <div class="layers">
        <template v-for="item in newItem" :key="item.name">
          <vn-stack-layer :name="item.name" v-if="handleTabVisible(item.visible)">
            <div class="option-subgroup-body">
              <b2-option-items :element="element" :items="item.children" :paths="paths" />
            </div>
          </vn-stack-layer>
        </template>
      </div>
    </vn-stack>
  </div>
</template>

<script lang="ts" setup>
import { Ref, computed, ref, unref } from "vue";
import { DefinedOptionSubgroup, isCallableVisible } from "./types";
import { Element } from "@renderer/b2/controllers/element";


const props = defineProps<{
  element: Element,
  item: DefinedOptionSubgroup[],
  paths: string[]
}>();

const newItem = props.item;
const hasItemShow = computed(()=>{
  let visible = false;
  for(const item of newItem){
    visible = handleTabVisible(item.visible);
    if(visible) break;
  }
  return visible;
})

const handleTabVisible = (visible) => {
  if (visible === undefined) return true;
  return isCallableVisible(visible) ? unref(visible(props.element, props.paths)) : visible;
}
const tabContainer: Ref<HTMLElement> = ref(null);
const isScroll = computed(()=>{
  if (tabContainer.value) {
    return tabContainer.value.scrollWidth === tabContainer.value.clientWidth;
  }
  return false;
})
const scrollTab = (delta: number) => {
  if (tabContainer.value) {
    tabContainer.value.scrollBy({left: delta, behavior: "smooth"});
  }
};
</script>

<style lang="scss" scoped>
.b2-option-subgroup {
  margin: 5px;
  padding: 0 2px;
  background-color: var(--option-bg-color);
  border: 1px var(--el-border-color) solid;
  border-radius: 2px;

  .tab-container {
    display: flex;
    align-items: center;
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
      display: flex;
      overflow-y: scroll;
      height: 35px;
      align-items: center;
      padding: 0 5px;
      &.tabs-scroll {
        padding: 0px;
      }
      &::-webkit-scrollbar {
        display: none;
      }
      .vn-stack-tab {
        display: inline-flex;
        padding: 0 8px;
        height: 24px;
        line-height: 24px;
        cursor: var(--cursor-pointer);
        white-space: nowrap;
        &.active {
          border-bottom: 2px solid var(--color-primary);
          span {
            color: var(--color-primary);
          }
        }
        .tip-icon {
          display: flex;
          margin-left: 2px;
          cursor: var(--cursor-default);
        }
      }
    }
  }

  .option-subgroup-body {
    background-color: var(--option-bg-color);
  }
}
</style>