<template>
  <div class="icon-selector" :class="[`scroll-mode-${props.scrollMode}`]">
    <ul class="colors">
      <li :class="['color-item', { active: color === item }]" v-for="item in colors" :key="item"
        :style="{ background: item }" @click.stop="emit('update:color', item)"></li>
    </ul>
    <el-scrollbar class="icons-wrapper">
      <ul class="icons">
        <li
          :class="['icon-item', { active: isIconActive(item) }]"
          v-for="item in displayIconList"
          :key="item"
          @click.stop="handleIconSelect(item)"
        >
          <el-icon v-if="item !== NO_ICON_KEY" :size="24" color="#fff">
            <component :is="item" />
          </el-icon>
        </li>
      </ul>
    </el-scrollbar>
  </div>
</template>

<script lang='ts' setup>
import * as svg from '@element-plus/icons-vue';
import { computed, ref } from 'vue';

const props = withDefaults(defineProps<{
  color: string;
  icon: string;
  maxRows?: number;
  scrollMode?: "container" | "rows";
}>(), {
  color: "#62cb84",
  maxRows: 6,
  scrollMode: "container",
});

const emit = defineEmits<{
  (e: 'update:color', color: string): void;
  (e: 'update:icon', icon: string): void;
}>();

const NO_ICON_KEY = "__none__";
const colors = ["#f4b92f", "#ee6c6c", "#62cb84", "#2dbedb", "#5293ef", "#9263ed"];
const iconList = ref<string[]>([]);
const iconWrapperMaxHeight = computed(() => {
  const rows = Math.max(1, Number(props.maxRows) || 6);
  return `${rows * 32 + (rows - 1) * 10}px`;
});
const displayIconList = computed(() => [NO_ICON_KEY, ...iconList.value]);

const handleIconSelect = (iconName: string) => {
  emit("update:icon", iconName === NO_ICON_KEY ? "" : iconName);
};

const isIconActive = (iconName: string) => {
  if (iconName === NO_ICON_KEY) {
    return !props.icon;
  }
  return props.icon === iconName;
};

const getElementPlusIcon = () => {
  const icons = svg as any;
  const sheetsIconList: string[] = [];
  for (const i in icons) {
    sheetsIconList.push(`i-ep-${icons[i].name}`);
  }
  iconList.value = sheetsIconList;
};
getElementPlusIcon();
</script>

<style lang='scss' scoped>
.icon-selector {
  width: 100%;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  row-gap: 8px;

  .colors {
    display: flex;
    justify-content: space-between;
    column-gap: 24.8px;
    padding: 8px;
    background-color: var(--bg-color-overlay);
    border-radius: 4px;
    flex-shrink: 0;

    .color-item {
      width: 24px;
      height: 24px;
      cursor: var(--cursor-pointer);
      border-radius: 50%;
      overflow: hidden;

      &:hover,
      &.active {
        transform: scale(0.9);
        border: 1px solid var(--primary-color);
      }
    }

  }

  .icons-wrapper {
    min-height: 0;
    overflow: hidden;

    :deep(.el-scrollbar__wrap) {
      height: 100%;
      overflow-x: hidden;
      overflow-y: auto;
    }

    .icons {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;

      .icon-item {
        width: 32px;
        height: 32px;
        border-radius: 4px;
        background-color: v-bind("props.color");
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: var(--cursor-pointer);
        &:hover,
        &.active {
          transform: scale(0.9);
        }
      }
    }

    :deep(.el-scrollbar__bar.is-vertical) {
      right: -8px;
    }
  }

  &.scroll-mode-container {
    .icons-wrapper {
      flex: 1;
    }
  }

  &.scroll-mode-rows {
    height: auto;

    .icons-wrapper {
      height: v-bind(iconWrapperMaxHeight);
      max-height: v-bind(iconWrapperMaxHeight);
      flex: none;

      :deep(.el-scrollbar__wrap) {
        max-height: v-bind(iconWrapperMaxHeight);
      }
    }
  }
}
</style>
