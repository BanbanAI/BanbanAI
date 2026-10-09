<template>
  <div class="album-card-cover">
    <div class="image-list-row" :style="listRowStyle">
      <template v-for="(item, i) in useList">
        <el-image class="img-box" :src="item.url" :fit="fitCom">
          <template #error>
            <slot name="none"></slot>
          </template>
          <template #placeholder>
            <slot name="none"></slot>
          </template>
        </el-image>
      </template>
      <!-- 图片没有被正确获取时，显示此占位符 -->
      <div v-if="useList.length === 0" class="image-error">
        <slot name="none"></slot>
      </div>
    </div>

    <div class="funs" v-show="hasMoreImg">
      <div
        class="func-btn func-left funs-glass"
        :class="{
          cursorNotAllowed: isFirst,
        }"
        data-element="stop-click"
        @click="handleLeft"
      >
        <el-icon><i-ep-arrow-left></i-ep-arrow-left></el-icon>
      </div>
      <div
        class="func-btn func-right funs-glass"
        :class="{
          cursorNotAllowed: isLast,
        }"
        data-element="stop-click"
        @click="handleRight"
      >
        <el-icon><i-ep-arrow-right></i-ep-arrow-right></el-icon>
      </div>

      <div class="func-num funs-glass">
        <span class="func-num-current">{{ currentIndex + 1 }}</span>
        <span class="func-num-center">/</span>
        <span class="func-num-count">{{ useList.length | 0 }}</span>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { computed, ref } from "vue";
import { AlbumCoverStateEnum, DefautAlbumStateOption } from "../album";
import { EpPropMergeType } from "element-plus/es/utils";
interface AlbumCardCoverPropsType {
  list: any[];
  fit?: EpPropMergeType<
    StringConstructor,
    "" | "fill" | "contain" | "none" | "cover" | "scale-down",
    unknown
  >;
}

const props = withDefaults(defineProps<AlbumCardCoverPropsType>(), {});

const currentIndex = ref(0);
const listRowStyle = computed(() => {
  return `
    transform: translate(-${100 * currentIndex.value}%);
  `;
});
const isFirst = computed(() => {
  return currentIndex.value === 0;
});
const isLast = computed(() => {
  return currentIndex.value === useList.value.length - 1;
});
const hasMoreImg = computed(() => {
  return useList.value.length > 1
})
const handleLeft = () => {
  if (isFirst.value) return;
  currentIndex.value--;
};
const handleRight = () => {
  if (isLast.value) return;
  currentIndex.value++;
};
const isImage = (url: string) => {
  // 检查 url 是否存在
  if (!url) return false;
  
  const imageExtensions = [
    ".bmp",
    ".jpg",
    ".jpeg",
    ".png",
    ".tif",
    ".gif",
    ".pcx",
    ".tga",
    ".exif",
    ".fpx",
    ".svg",
    ".psd",
    ".cdr",
    ".pcd",
    ".dxf",
    ".ufo",
    ".eps",
    ".ai",
    ".raw",
    // ".WMF",
    ".wmf",
    ".webp",
    ".avif",
    ".apng",
  ];
  return imageExtensions.some((ext) => url.toLowerCase().endsWith(ext));
};
const useList = computed(() => {
  return props.list.filter((item) => {
    return isImage(item.url);
  });
});
const fitCom = computed<
  AlbumCoverStateEnum.COVER | AlbumCoverStateEnum.CONTAIN
>(() => {
  if (props.fit) return props.fit as AlbumCoverStateEnum;
  return DefautAlbumStateOption.albumCoverState;
});
</script>
<style lang="scss" scoped>
.album-card-cover {
  position: relative;
  width: 100%;
  height: 100%;

  .funs {
    color: #ffffff;
  }
  .funs-glass {
    border: 0.5px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px); /* Safari兼容 */
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.05);
  }
  .func-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;

    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 16px;

    position: absolute;
    top: 50%;
    transform: translateY(-50%);

    cursor: pointer;
  }
  .func-left {
    left: 8px;
  }
  .func-right {
    right: 8px;
  }
  .func-num {
    position: absolute;
    bottom: 8px;
    left: 50%;
    transform: translateX(-50%);

    height: 20px;
    display: flex;
    justify-content: center;
    align-items: center;

    padding: 0 9.5px;
    font-size: 12px;

    border-radius: 20px;
    .func-num-center {
      margin: 0 2px;
    }
  }

  .image-list-row {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    transition: transform 0.5s ease;
    background-color: #e8e9eb;

    .image-error {
      width: 100%;
      height: 100%;
    }
  }
  .img-box {
    flex-shrink: 0;
    width: 100%;
    height: 100%;
  }
  .cursorNotAllowed {
    cursor: not-allowed;
  }
}
</style>
