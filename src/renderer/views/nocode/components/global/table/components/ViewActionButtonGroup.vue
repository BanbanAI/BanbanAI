<template>
  <div class="view-action-button-group" v-if="items.length">
    <template v-for="item in visibleItems" :key="item.action.id">
      <el-tooltip
        v-if="item.disabled && item.tip"
        :content="item.tip"
        placement="top"
      >
        <span class="button-wrap">
          <el-button
            class="action-button"
            :size="size"
            :disabled="item.disabled"
            :style="getButtonStyle(item)"
            @click.stop="handleExecute(item)"
          >
            <span class="action-content">
              <el-icon v-if="item.action.display?.icon" class="action-icon">
                <component :is="item.action.display.icon" />
              </el-icon>
              <span class="action-label" :title="getActionLabel(item.action)">{{ getActionLabel(item.action) }}</span>
            </span>
          </el-button>
        </span>
      </el-tooltip>
      <el-button
        v-else
        class="action-button"
        :size="size"
        :disabled="item.disabled"
        :style="getButtonStyle(item)"
        @click.stop="handleExecute(item)"
      >
        <span class="action-content">
          <el-icon v-if="item.action.display?.icon" class="action-icon">
            <component :is="item.action.display.icon" />
          </el-icon>
          <span class="action-label" :title="getActionLabel(item.action)">{{ getActionLabel(item.action) }}</span>
        </span>
      </el-button>
    </template>

    <el-dropdown v-if="overflowItems.length" trigger="click" :persistent="false">
      <el-button class="more-button" :size="size" :style="moreButtonStyle" @click.stop>
        <span class="action-content">
          <span class="action-label">{{ $t('viewActionButtonGroup.more') }}</span>
          <el-icon class="more-icon">
            <i-ep-arrow-down />
          </el-icon>
        </span>
      </el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item
            v-for="item in overflowItems"
            :key="item.action.id"
            :disabled="item.disabled"
            @click.stop="handleExecute(item)"
          >
            <div class="menu-item" :title="item.disabled ? item.tip : ''">
              <el-icon v-if="item.action.display?.icon" class="action-icon">
                <component :is="item.action.display.icon" />
              </el-icon>
              <span class="action-label">{{ getActionLabel(item.action) }}</span>
            </div>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup lang="ts">
import { computed, CSSProperties } from "vue";
import { ViewAction, ViewActionButtonStyle } from "@common/types/nocode";

type RuntimeActionButtonItem = {
  action: ViewAction,
  disabled?: boolean,
  tip?: string,
}

const props = withDefaults(defineProps<{
  items?: RuntimeActionButtonItem[],
  maxVisible?: number,
  size?: "" | "default" | "small" | "large",
  buttonWidth?: number | string,
  overflowTakesSlot?: boolean,
}>(), {
  items: () => [],
  maxVisible: 2,
  size: "small",
  buttonWidth: "",
  overflowTakesSlot: false,
});

const emit = defineEmits<{
  (event: "execute", action: ViewAction): void,
}>();

const items = computed(() => props.items.filter(item => !!item?.action));
const normalizedButtonWidth = computed(() => {
  if (!props.buttonWidth) {
    return "";
  }
  return typeof props.buttonWidth === "number" ? `${props.buttonWidth}px` : props.buttonWidth;
});
const buttonLayoutStyle = computed<CSSProperties>(() => {
  if (!normalizedButtonWidth.value) {
    return {};
  }
  return {
    width: normalizedButtonWidth.value,
    minWidth: normalizedButtonWidth.value,
    maxWidth: normalizedButtonWidth.value,
  };
});
const visibleCount = computed(() => {
  if (!items.value.length) {
    return 0;
  }
  if (!props.overflowTakesSlot || items.value.length <= props.maxVisible) {
    return props.maxVisible;
  }
  return Math.max(props.maxVisible - 1, 0);
});
const visibleItems = computed(() => items.value.slice(0, visibleCount.value));
const overflowItems = computed(() => items.value.slice(visibleItems.value.length));

const getActionLabel = (action: ViewAction) => action.display?.label || action.name;

const handleExecute = (item: RuntimeActionButtonItem) => {
  if (item.disabled) {
    return;
  }
  emit("execute", item.action);
};

const getButtonStyle = (item: RuntimeActionButtonItem): CSSProperties => {
  if (item.disabled) {
    return {
      ...buttonLayoutStyle.value,
      "--el-button-disabled-text-color": "var(--el-text-color-placeholder)",
      "--el-button-disabled-border-color": "var(--el-border-color-light)",
      "--el-button-disabled-bg-color": item.action.display?.style === ViewActionButtonStyle.OUTLINE
        ? "transparent"
        : "var(--el-fill-color-light)",
    };
  }
  const color = item.action.display?.color || "#1677FF";
  if (item.action.display?.style === ViewActionButtonStyle.OUTLINE) {
    return {
      ...buttonLayoutStyle.value,
      color,
      borderColor: color,
      backgroundColor: "transparent",
    };
  }
  return {
    ...buttonLayoutStyle.value,
    color: "#fff",
    borderColor: color,
    backgroundColor: color,
  };
};

const moreButtonStyle = computed<CSSProperties>(() => ({
  ...buttonLayoutStyle.value,
}));
</script>

<style scoped lang="scss">
.view-action-button-group {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
  flex-wrap: nowrap;
  overflow: hidden;

  .button-wrap {
    display: inline-flex;
    min-width: 0;
  }

  .action-button,
  .more-button {
    margin: 0;
    min-width: 0;
    overflow: hidden;
    border-radius: 4px;
  }

  .action-content,
  .menu-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    width: 100%;
  }

  .action-icon,
  .more-icon {
    flex-shrink: 0;
  }

  .more-icon {
    margin-left: auto;
  }

  .action-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
