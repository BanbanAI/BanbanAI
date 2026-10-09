<template>
  <div class="b2-option-subgroup" :class="{
    'b2-option-subgroup-fold': fold === 'fold',
  }">
    <div class="option-subgroup-header" v-if="!hideTitle">
      <div class="option-subgroup-title" @click="triggerOptionFold">
        <el-icon class="fold-icon" v-if="fold !== 'always-unfold'"><i-ep-arrow-down /></el-icon>
        <el-icon size="6" v-else><i-prime-circle-fill /></el-icon>
        <span :title="title">{{ title }}</span>
        <el-tooltip placement="top" effect="light">
          <template #content>
            <div style="max-width: 200px;">{{item.tip}}</div>
          </template>
          <div class="tip-icon" v-if="item.tip" @click.stop>
            <el-icon size="14"><i-ant-design-question-circle-outlined /></el-icon>
          </div>
        </el-tooltip>
      </div>
      <el-icon class="delete-icon" size="14" v-if="deletable" @click.stop="emit('delete')"><i-ep-close /></el-icon>
    </div>
    <div class="option-subgroup-body">
      <slot></slot>
      <b2-option-items :element="element" :items="item.children" :paths="paths" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { IS_OPTION_GROUP_UNFOLD } from "./inject";
import { computed, provide, ref } from 'vue';
import { DefinedOptionSubgroup } from './types';
import { Element } from '@renderer/b2/controllers/element';

const props = defineProps<{
  element: Element,
  item: DefinedOptionSubgroup,
  paths: string[],
  title: string,
  deletable?: boolean,
  hideTitle?: boolean,
}>();

const emit = defineEmits(["delete"]);

const fold = ref(props.item.fold || 'fold');
if (props.hideTitle) {
  fold.value = "always-unfold";
}
const isGroupUnfold = computed(()=>{
  return fold.value !== "fold";
});
provide(IS_OPTION_GROUP_UNFOLD, isGroupUnfold);

const triggerOptionFold = () => {
  if (fold.value === "always-unfold") {
    return;
  }
  fold.value = fold.value === 'fold' ? 'unfold' : 'fold';
}
</script>

<style lang="scss" scoped>
.b2-option-subgroup {
  width: calc(100% - 10px);
  margin: 5px;
  background-color: var(--option-bg-color);
  border: 1px var(--el-border-color) solid;
  border-radius: 2px;

  .option-subgroup-header {
    width: 100%;
    padding: 0 2px;
    background-color: var(--bg-color-overlay);
    border-top-left-radius: 2px;
    border-top-right-radius: 2px;
    user-select: none;
    vertical-align: baseline;
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 32px;

    .option-subgroup-title {
      width: 100%;
      display: flex;
      align-items: center;
      flex-grow: 1;
      text-indent: 4px;
      cursor: var(--cursor-pointer);
      .fold-icon {
        transition: all .25s ease;
      }
      .tip-icon {
        cursor: var(--cursor-default);
      }
      > span {
        max-width: 95%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
    .delete-icon {
      cursor: var(--cursor-pointer);
      color: var(--text-color-primary);
      &:hover {
        color: var(--color-danger);
      }
    }
  }
  &.b2-option-subgroup-fold .option-subgroup-header {
    background-color: var(--option-bg-color);
    .fold-icon {
      transform: rotate(-90deg);
    }
  }
  &.cluster-item .option-subgroup-header .option-subgroup-title .tip-icon {
    display: none;
  }
  &.active .option-subgroup-header .option-subgroup-title {
    color: var(--color-primary);
  }
  .option-subgroup-body {
    background-color: var(--option-bg-color);
  }
}

.b2-option-subgroup-fold .option-subgroup-body {
  display: none;
}
</style>
