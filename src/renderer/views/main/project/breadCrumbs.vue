<template>
  <div class="bread-crumbs" :title="breadCrumbsTitle">
    <el-icon :size="16" class="bread-crumbs__icon"><i-ven-bread-crumbs /></el-icon>
    <template v-if="activeElementType !== 'board'">
      <div class="sub-region">
        <div class="level-item" v-for="element in visibleBreadCrumbElements" :key="element.uid || getText(element)">
          <span @click="handleActiveElement(element)">{{ getText(element) }}</span>
          <el-icon :size="12"><i-ep-arrow-right /></el-icon>
        </div>
        <el-dropdown
          v-if="collapsedBreadCrumbElements.length > 0"
          trigger="click"
          placement="bottom-start"
          popper-class="bread-crumbs__ellipsis-dropdown"
        >
          <div class="level-item bread-crumbs__ellipsis" :title="$t('breadCrumbs.expandMoreLevels')">
            <span>...</span>
            <el-icon :size="12"><i-ep-arrow-right /></el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="element in collapsedBreadCrumbElements"
                :key="element.uid || getText(element)"
                class="bread-crumbs__ellipsis-item"
                @click="handleActiveElement(element)"
              >
                {{ getText(element) }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </template>
    <div class="level-item active-name">
      <span>{{ getText(activeElement) }}</span>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ACTIVE_ELEMENT, SELECTED_WIDGETS } from '@renderer/types';
import { isBoard, isWidget } from "@renderer/b2/types";
import { Element } from "@renderer/b2/controllers/element";
import { FormElement } from "@renderer/b2/controllers/form";
import { computed, inject, ref, watch } from 'vue';
import { isEmpty } from '@common/utils/object';
import { useFormWidget } from '../../nocode/views/editor/form/hooks';
import i18next from 'i18next';

const activeElement = inject(ACTIVE_ELEMENT);
const selectedWidgets = inject(SELECTED_WIDGETS);
const formWidget = useFormWidget();

const MAX_VISIBLE_CRUMB_COUNT = 3;

const breadCrumbsTitle = ref('');
const breadCrumbElements = ref<Element[]>([]);
const activeElementType = ref<'board'|'widget'>('board');

const visibleBreadCrumbElements = computed(() => {
  if (breadCrumbElements.value.length <= MAX_VISIBLE_CRUMB_COUNT - 1) {
    return breadCrumbElements.value;
  }
  return breadCrumbElements.value.slice(0, MAX_VISIBLE_CRUMB_COUNT - 1);
});

const collapsedBreadCrumbElements = computed(() => {
  if (breadCrumbElements.value.length <= MAX_VISIBLE_CRUMB_COUNT - 1) {
    return [];
  }
  return breadCrumbElements.value.slice(MAX_VISIBLE_CRUMB_COUNT - 1);
});

const getText = (element: Element) => {
  if (element?.isFormMode) {
    if (element === formWidget?.value) return i18next.t("breadCrumbs.form");
    return (element as FormElement).title || (element as FormElement).name;
  }
  return element?.name;
} 

watch(() => activeElement.value, (element: Element) => {
  if (isEmpty(element)) return;
  breadCrumbElements.value = [];
  if (isBoard(element)) {
    activeElementType.value = 'board';
  } else if (isWidget(element)) {
    activeElementType.value = 'widget';
    const targetWidgets: Element[] = [];
    let parent:Element = element.parent;
    while(parent) {
      const board = parent.getBoard();
      if (board.isFormMode) {
        if (board === parent) break;
        else if (parent.uid === formWidget?.value?.uid) {
          targetWidgets.unshift(parent);
          break;
        }
      }
      targetWidgets.unshift(parent);
      parent = parent.parent;
    }
    breadCrumbElements.value = targetWidgets;
  }
  if (!isEmpty(breadCrumbElements.value)) {
    const breadCrumbElementNames = breadCrumbElements.value.map(element => getText(element));
    breadCrumbsTitle.value = `${breadCrumbElementNames.join(' > ')} > ${ getText(element) }`;
  } else {
    breadCrumbsTitle.value = getText(element);
  }
}, { immediate: true })

const handleActiveElement = (element: Element) => {
  if (isWidget(element)) {
    selectedWidgets.value = [element];
  } else {
    selectedWidgets.value = [];
  }
}
</script>

<style lang="scss" scoped>
.bread-crumbs{
  height: 40px;
  display: flex;
  align-items: center;
  padding: 0 10px;
  border-bottom: 1px solid var(--border-color-light);
  min-width: 0;

  .bread-crumbs__icon {
    flex-shrink: 0;
  }

  .level-item{
    display: flex;
    color: var(--text-color-inactive);
    justify-content: center;
    align-items: center;
    min-width: 0;

    span{
      display: block;
      max-width: 100px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: var(--cursor-pointer);
    }
    &:hover {
      text-decoration: underline;
    }
    &.active-name{
      color: var(--text-color);
      text-decoration: none;
      span {
        cursor: var(--cursor-default);
      }
    }
  }

  .bread-crumbs__ellipsis {
    flex-shrink: 0;
  }

  .sub-region{
    display: flex;
    align-items: center;
    min-width: 0;
    max-width: calc(100% - 100px);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

:deep(.bread-crumbs__ellipsis-dropdown) {
  .bread-crumbs__ellipsis-item {
    max-width: 280px;
  }
}
</style>
