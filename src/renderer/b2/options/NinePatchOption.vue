<template>
  <div class="nine-patch-option">
    <div class="preview" ref="previewRef" v-show="imageSource">
      <el-image fit="contain" :src="imageSource" ref="imageRef" :style="imageStyle" @load="setImageSize"></el-image>
      <div class="top" :style="{top: patchValue.top + '%'}" ref="topLineRef"></div>
      <div class="right" :style="{right: patchValue.right + '%'}" ref="rightLineRef"></div>
      <div class="bottom" :style="{bottom: patchValue.bottom + '%'}" ref="bottomLineRef"></div>
      <div class="left" :style="{left: patchValue.left + '%'}" ref="leftLineRef"></div>
    </div>
    <div class="empty" v-if="!imageSource">
      {{ $t("ninePatchOption.emptyText") }}
    </div>
  </div>
</template>
<script lang="ts">
export default {
  isBigContent: (args: any) => true,
};
</script>
<script lang='ts' setup>
import { ACTIVE_ELEMENT, PROJECT_ID } from '@renderer/types';
import { inject, ref, computed, watch, onUnmounted, nextTick, Ref } from 'vue';
import { GET_OPTION_VALUE, UPDATE_OPTION } from "../inject";
import { DefinedOptionWithParsedType, OptionRenderFileValue } from '../types';
import { ImageViewerInstance } from 'element-plus';
import { useEventListener } from '@vueuse/core';

const props = defineProps<{
  option: DefinedOptionWithParsedType,
  paths: string[],
}>();

const element = inject(ACTIVE_ELEMENT);
const updateOption = inject(UPDATE_OPTION);
const getOptionValue = inject(GET_OPTION_VALUE);

const imageRef = ref<ImageViewerInstance>();
const previewRef = ref<HTMLElement>();
const topLineRef = ref<HTMLElement>();
const rightLineRef = ref<HTMLElement>();
const bottomLineRef = ref<HTMLElement>();
const leftLineRef = ref<HTMLElement>();
const patchValue = ref({
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
});

const getElementSize = (el: HTMLElement) => {
  return {
    width: el.clientWidth - 2,  // 减去padding
    height: el.clientHeight - 2,
  }
}

const handFilePath = (file: OptionRenderFileValue) => {
  if (!file) return '';
  if (/^http/.test(file?.url)) {
    return file.url;
  } else if (file.isLink || file.__opt_type !== "file") {
    return file.relativePath;
  } else {
    return `${element.value?.getBoard()?.projectId}/${file.relativePath}`;
  }
}
const imageSource = computed(() => {
  const value = props.option?.imageSource(element.value, props.paths.slice(0, props.paths.length - 1));
  return handFilePath(value);
});

const useDragListener = (el: Ref<HTMLElement>, callback: (value: [number, number], oldValue: [number, number]) => void) => {
  let prevX:number, prevY:number;
  return useEventListener(el, 'mousedown', (ev: MouseEvent) => {
    ev.stopPropagation();
    ev.preventDefault();
    prevX = ev.x;
    prevY = ev.y;

    const mouseMove = (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
      callback([ev.x, ev.y], [prevX, prevY]);
      prevX = ev.x;
      prevY = ev.y;
    }
    const mouseup = (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
      stopMouseUp();
      stopMouseMove();
    }
    const stopMouseMove = useEventListener(window, 'mousemove', mouseMove, false);
    const stopMouseUp = useEventListener(window, 'mouseup', mouseup, false);
  }, false)
}

const mixValueX = 5; // 保留最低5%的区域
const mixValueY = 5; // 保留最低5%的区域
// top
const stopTopDrag = useDragListener(topLineRef, ([x, y], [prevX, prevY]) => {
  const { height } = getElementSize(previewRef.value);
  const disY = y - prevY;
  const ratioY = disY / height * 100;

  if (patchValue.value.top + ratioY < 0) {
    patchValue.value.top = 0;
  } else if (patchValue.value.top + ratioY > (100 - patchValue.value.bottom - mixValueY)) {
    patchValue.value.top = 100 - patchValue.value.bottom - mixValueY;
  } else {
    patchValue.value.top += ratioY;
  }
});

// right
const stopRightDrag = useDragListener(rightLineRef, ([x, y], [prevX, prevY]) => {
  const { width } = getElementSize(previewRef.value);
  const disX = x - prevX;
  const ratioX = disX / width * 100 * -1;

  if (patchValue.value.right + ratioX < 0) {
    patchValue.value.right = 0;
  } else if (patchValue.value.right + ratioX > (100 - patchValue.value.left - mixValueX)) {
    patchValue.value.right = 100 - patchValue.value.left - mixValueX;
  } else {
    patchValue.value.right += ratioX;
  }
});

// bottom
const stopBottomDrag = useDragListener(bottomLineRef, ([x, y], [prevX, prevY]) => {
  const { height } = getElementSize(previewRef.value);
  const disY = y - prevY;
  const ratioY = disY / height * 100 * -1;

  if (patchValue.value.bottom + ratioY < 0) {
    patchValue.value.bottom = 0;
  } else if (patchValue.value.bottom + ratioY > (100 - patchValue.value.top - mixValueY)) {
    patchValue.value.bottom = 100 - patchValue.value.top - mixValueY;
  } else {
    patchValue.value.bottom += ratioY;
  }
});

// left
const stopLeftDrag = useDragListener(leftLineRef, ([x, y], [prevX, prevY]) => {
  const { width } = getElementSize(previewRef.value);
  const disX = x - prevX;
  const ratioX = disX / width * 100;

  if (patchValue.value.left + ratioX < 0) {
    patchValue.value.left = 0;
  } else if (patchValue.value.left + ratioX > (100 - patchValue.value.right - mixValueX)) {
    patchValue.value.left = 100 - patchValue.value.right - mixValueX;
  } else {
    patchValue.value.left += ratioX;
  }
});

onUnmounted(() => {
  stopTopDrag();
  stopRightDrag();
  stopBottomDrag();
  stopLeftDrag();
})

watch(() => getOptionValue(), (value) => {
  if (!value || Array.isArray(value) || typeof value !== 'object') return;
  patchValue.value = value;
}, { immediate: true, deep: true });
watch(patchValue.value, () => {
  updateOption(patchValue.value);
}, { deep: true });

const imageStyle = ref({});
const maxWidth = 230;
const maxHeight = 230;
const setImageSize = async () => {
  imageStyle.value = {};
  await nextTick();
  const width = imageRef.value?.$el?.clientWidth;
  const height = imageRef.value?.$el?.clientHeight;
  if (!width || !height) return;
  if (width < height) {
    imageStyle.value = {
      height: maxHeight + 'px'
    }
  } else {
    imageStyle.value = {
      width: maxWidth + 'px'
    }
  }
}
</script>

<style lang='scss' scoped>
.nine-patch-option {
  width: 100%;
  height: 100%;
  padding: 30px;
  user-select: none;
  .preview {
    position: relative;
    display: flex;
    padding: 1px;
    width: 100%;
    margin: auto;

    :deep(.el-image) {
      pointer-events: none;

      img {
        max-width: v-bind("maxWidth + 'px'");
        max-height: v-bind("maxHeight + 'px'");
      }
    }

    @mixin line($width, $height, $cursor) {
      width: $width;
      height: $height;
      cursor: $cursor;
      position: absolute;
      border: 1px solid transparent;
      background-clip: content-box;
      background-color: var(--el-color-primary);

      &:hover {
        border-color: rgba(255,255,255,0.3);
      }
    }

    .top,
    .bottom {
      @include line(calc(100% + 40px), 3px, n-resize);
      left: 0;
      transform: translateX(-20px);
    }

    .right,
    .left {
      @include line(3px, calc(100% + 40px), e-resize);
      top: 0;
      transform: translateY(-20px);
    }

    .top {
      top: 0;
    }
    .right {
      right: 0;
    }
    .bottom {
      bottom: 0;
    }
    .left {
      left: 0;
    }

  }

  .empty {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgb(222, 75, 75);
  }
}
</style>