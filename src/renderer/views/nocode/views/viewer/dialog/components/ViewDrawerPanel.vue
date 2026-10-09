<template>
  <el-container class="view-drawer-panel" v-loading="isLoading" :element-loading-text="loadingText">
    <el-header class="view-drawer-header" height="24px">
      <div class="view-drawer-title">
        {{ titleComputed }}
      </div>
      <el-button link class="close-btn" @click="handleClose">
        <el-icon class="close" :size="14"><i-ep-close /></el-icon>
      </el-button>
    </el-header>
    <el-main class="view-drawer-main">
      <slot></slot>
    </el-main>
    <el-footer class="view-drawer-footer" height="64px">
      <el-button class="footer-button" @click="handleCancel">
        {{ cancelTextComputed }}
      </el-button>
      <el-button class="footer-button" type="primary" @click="handleConfirm">
        {{ confirmTextComputed }}
      </el-button>
    </el-footer>
  </el-container>
</template>

<script lang="ts" setup>
import i18next from "i18next";
import { computed, ref, nextTick, onMounted, onUnmounted, watch } from "vue";
interface ViewDrawerPanelPropsType {
  title?: string;
  cancelText?: string;
  confirmText?: string;
  isLoading?: boolean;
  loadingText?: string;
}
interface ViewDrawerEmitsType {
  (event: "cancel"): void;
  (event: "confirm"): void;
  (event: "close"): void;
}
const props = withDefaults(defineProps<ViewDrawerPanelPropsType>(), {});
const titleComputed = computed(() => {
  if (!props.title) return i18next.t("albumSettingDrawer.drawerHeader");
  return props.title;
});
const emits = defineEmits<ViewDrawerEmitsType>();

const cancelTextComputed = computed(() => {
  if (!props.cancelText)
    return i18next.t("albumSettingDrawer.drawerFooterCancel");
  return props.cancelText;
});
const confirmTextComputed = computed(() => {
  if (!props.confirmText)
    return i18next.t("albumSettingDrawer.drawerFooterConfirm");
  return props.confirmText;
});

const handleClose = () => {
  emits("close");
};
const handleCancel = () => {
  emits("cancel");
};
const handleConfirm = () => {
  emits("confirm");
};
</script>

<style lang="scss" scoped>
.view-drawer-panel {
  height: 100%;
  overflow: hidden;

  .view-drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 24px 20px 0 20px;
    height: fit-content;
    flex-shrink: 0;

    .view-drawer-title {
      line-height: 24px;
      font-size: 16px;
      color: #141414;
      font-style: Medium;
    }

    .close-btn {
      &:hover {
        .close {
          color: var(--el-color-primary);
        }
      }
    }
  }

  .view-drawer-main {
    --el-main-padding: 16px 20px;
  }

  .view-drawer-footer {
    display: flex;
    justify-content: right;
    align-items: center;
    border-top: 1px solid #d9d9d9;
    gap: 8px;
    height: 64px;
    box-sizing: border-box;
    flex-shrink: 0;

    .footer-button {
      border-radius: 4px;
    }
  }
}
</style>
