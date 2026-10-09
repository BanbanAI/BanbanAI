<template>
  <div class="view-drawer" ref="viewDrawerRef" :style="viewDrawerStyle">
    <slot></slot>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, nextTick, onMounted, onUnmounted, watch } from "vue";
interface ViewDrawerPropsType {
  modelValue?: boolean;
  duration?: number;
  width?: string;
}
interface ViewDrawerEmitsType {
  // 在打开前
  (event: "beforeOpen"): void;
  // 在打开后
  (event: "open"): void;
  (event: "beforeClose"): void;
  (event: "closed"): void;
  (event: "close"): void;
  (event: "update:modelValue", value: boolean): void;
  (event: "otherClick"): void;
}

const props = withDefaults(defineProps<ViewDrawerPropsType>(), {
  modelValue: false,
  duration: 300,
  width: "320px",
});
const emits = defineEmits<ViewDrawerEmitsType>();
const viewDrawerRef = ref<HTMLElement | null>(null);
// 是否展示抽屉
const showState = ref<boolean>(false);
// 动画是否正在进行
const isAnimation = ref<boolean>(false);
const viewDrawerStyle = computed(() => {
  return `
    width: ${props.width}
  `;
});

// 定义关键帧
const keyframes = [{ transform: "translateX(0px)" }];
const animate = ref<Animation | null>(null);
const pendingAnimationState = ref<boolean | null>(null);
const handleOpenFun = () => {
  // 打开前可以做其他事
  emits("beforeOpen");
  dealAnimationFun(true);
};
const handleCloseFun = () => {
  emits("beforeClose");
  dealAnimationFun(false);
};
watch(
  () => props.modelValue,
  (newVal, oldVal) => {
    showState.value = newVal;
    if (newVal) {
      handleOpenFun();
    } else {
      handleCloseFun();
    }
  }
);

// 控制打开和关闭
const dealAnimationFun = (value: boolean) => {
  try {
    if (!animate.value || !viewDrawerRef.value) {
      pendingAnimationState.value = value;
      return;
    }
    isAnimation.value = true;
    nextTick(() => {
      if (!animate.value) return;
      if (value) {
        // 开始 打开动画
        animate.value.playbackRate = 1;
        animate.value.play();
      } else {
        // 开始 关闭动画从当前位置反向播放到开始
        animate.value.playbackRate = 1;
        animate.value.reverse();
      }
      showState.value = value;
      emits("update:modelValue", value);
    });
  } catch (error) {
    isAnimation.value = false;
  }
};

const floatingLayerSelectors = [
  ".el-popper",
  ".el-select__popper",
  ".el-picker__popper",
  ".el-date-picker",
  ".el-time-panel",
  ".el-cascader__dropdown",
  ".el-tree-select__popper",
];

const isClickInsideFloatingLayer = (target: EventTarget | null) => {
  if (!(target instanceof Node)) return false;
  return floatingLayerSelectors.some((selector) =>
    [...document.querySelectorAll(selector)].some((element) => element.contains(target))
  );
};

const isEventInsideDrawer = (event: Event) => {
  if (!viewDrawerRef.value) return false;
  if (typeof event.composedPath === "function") {
    return event.composedPath().includes(viewDrawerRef.value);
  }
  return event.target instanceof Node && viewDrawerRef.value.contains(event.target);
};

const handler = (event: PointerEvent) => {
  if (isAnimation.value) return;
  if (!showState.value || !viewDrawerRef.value) return;
  if (isEventInsideDrawer(event)) return;
  if (isClickInsideFloatingLayer(event.target)) return;
  event.stopPropagation();
  event.preventDefault();
  emits("otherClick");
};

const unInit = () => {
  document.removeEventListener("click", handler);
};
const init = () => {
  const initAnimation = () => {
    if (!viewDrawerRef.value) {
      console.warn("viewDrawerRef.value element not found!");
      return;
    }
    animate.value = viewDrawerRef.value.animate(keyframes, {
      duration: props.duration, // 持续时间（毫秒）
      easing: "ease-in-out", // 缓动函数
      fill: "forwards", // 动画结束后保持最终状态
      // 初始状态为暂停，根据modelValue决定方向
      playbackRate: 0,
    });
    animate.value.onfinish = (event) => {
      if (showState.value) {
        emits("open");
      } else {
        emits("closed");
      }
      isAnimation.value = false;
    };

    // 根据初始值设置正确的位置
    if (props.modelValue) {
      animate.value.finish(); // 直接到结束位置
    } else {
      animate.value.cancel(); // 回到起始位置
    }

    const pendingState = pendingAnimationState.value;
    pendingAnimationState.value = null;
    if (pendingState !== null) {
      dealAnimationFun(pendingState);
    }
  };
  const initClick = () => {
    document.addEventListener("click", handler);
  };
  nextTick(() => {
    initAnimation();
    initClick();
  });
};

onMounted(() => {
  init();
});
onUnmounted(() => {
  unInit();
});
defineExpose({
  show: () => {
    handleOpenFun();
  },
  hide: () => {
    handleCloseFun();
  },
});
</script>

<style lang="scss" scoped>
.view-drawer {
  position: absolute;
  height: 100%;
  top: 0;
  right: 0;
  box-sizing: border-box;
  background-color: #ffffff;
  box-shadow: 0px 16px 48px 16px rgba(0, 0, 0, 0.08),
    0px 12px 32px rgba(0, 0, 0, 0.12), 0px 8px 16px -8px rgba(0, 0, 0, 0.16);
  z-index: 100;
  transform: translateX(100%);
}
</style>
