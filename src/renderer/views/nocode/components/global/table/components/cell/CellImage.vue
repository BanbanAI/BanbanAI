<template>
  <div 
    class="image-preview-toolbar" 
    ref="toolbarRef"
    v-if="imageData?.length"
  >
    <div ref="thumbnailContainerRef" class="thumbnail-container" :style="thumbnailStyle">
      <el-image
        v-if="category === 'image'"
        v-for="(image, index) in imageData"
        :key="image.uid"
        :src="image.url"
        fit="cover"
        show-progress
        preview-teleported
        @click.stop="openImageViewer(index)"
        :style="{height: imgHeight[rowHeightLevel] + 'px'}"
        loading="lazy"
        lazy
      />
      <el-image-viewer
        v-if="category === 'image' && isImageViewerVisible"
        :initial-index="activeImageIndex"
        :url-list="imageData.map(image => image.url)"
        @close="isImageViewerVisible = false"
        show-progress
        teleported
      >
        <template #toolbar="{ actions, prev, next, reset, activeIndex, setActiveItem }">
          <el-icon @click="prev"><Back /></el-icon>
          <el-icon @click="next"><Right /></el-icon>
          <el-icon @click="setActiveItem(imageData.length - 1)"><DArrowRight /></el-icon>
          <el-icon @click="actions('zoomOut')"><ZoomOut /></el-icon>
          <el-icon @click="actions('zoomIn', { enableTransition: false, zoomRate: 2 })"><ZoomIn /></el-icon>
          <el-icon @click="actions('clockwise', { rotateDeg: 180, enableTransition: false })"><RefreshRight /></el-icon>
          <el-icon @click="actions('anticlockwise')"><RefreshLeft /></el-icon>
          <el-icon @click="reset"><Refresh /></el-icon>
          <el-icon @click="downloadImage(activeIndex)"><Download /></el-icon>
        </template>
      </el-image-viewer>

      <span v-if="category === 'file'">{{ imageData.map(img => img.name).join(', ')}}</span>
    </div>

    <el-button
      v-if="showArrowButton"
      :style="{height: imgHeight[rowHeightLevel] + 'px'}"
      link 
      :icon="ArrowDown" 
      @click.stop="togglePopover"
    ></el-button>

    <el-popover
      :virtual-ref="toolbarRef"
      v-model:visible="isPopoverVisible"
      trigger="click"
      width="392px"
      placement="bottom-start"
      :show-arrow="false"
      :offset="2"
      :popper-style="{ background: 'var(--el-color-white)', padding: '14px 0 14px 14px' }"
      @click-outside="handleClickOutside"
    >
      <div class="popover-image-list">
        <el-scrollbar max-height="340px">
          <div class="header-wrap">
            <slot name="popover-header"></slot>
          </div>
          <div class="popover-grid" :class="{'list-img-preview': listType !== 'text'}">
            <div v-for="(image, index) in imageData" :key="image.uid" class="popover-image-item">
              <el-image v-if="category === 'image'"
                :src="image.url"
                fit="cover"
                preview-teleported
                @click.stop="openImageViewer(index)"
                loading="lazy"
                lazy
              />
              <div class="image-meta">
                <div class="file-data" :title="image.name">
                  <div class="filename">{{ image.name }}</div>
                  <div class="filesize">
                    {{ diskSize(image.size) }}
                    <el-button type="primary" link @click="downloadImage(index)">
                      {{ $t('CellImage.download') }}
                    </el-button>
                  </div>
                </div>
                <div class="file-option-wrap" :style="{
                  justifyContent: listType === 'text' ? 'flex-end' : 'center'
                }">
                  <slot name="list-item-option" :image="image"></slot>
                </div>
              </div>
            </div>
          </div>
        </el-scrollbar>
      </div>
    </el-popover>
  </div>
</template>

<script lang="ts" setup>
import { computed, inject, ref } from "vue";
import { FormTableRowHeight } from "@common/types/nocode";
import { diskSize } from '@common/utils';
import {
  ArrowDown,
  Back,
  DArrowRight,
  Refresh,
  RefreshLeft,
  RefreshRight,
  Right,
  ZoomIn,
  ZoomOut,
  Download
} from "@element-plus/icons-vue";

type ImageFile = {
  uid: string;
  name: string;
  status: string;
  size: number;
  url: string;
};

const props = withDefaults(defineProps<{
  category: 'image' | 'file';
  imageList: ImageFile[];
  listType: 'text' | 'picture' | 'picture-card';
  rowHeightLevel: FormTableRowHeight;
  showArrowButton: boolean;
}>(), {
  showArrowButton: true
});


const imageData = computed(() => {
  return props.imageList.filter(item=>typeof item === "object");
})

const thumbnailContainerRef = ref<HTMLElement | null>(null);
const isImageViewerVisible = ref(false);
const activeImageIndex = ref(0);
const toolbarRef = ref(null);
const isPopoverVisible = ref(false);

const openImageViewer = (index: number): void => {
  activeImageIndex.value = index;
  isImageViewerVisible.value = true;
};

const togglePopover = (): void => {
  isPopoverVisible.value = true;
};

const handleClickOutside = () => {
  isPopoverVisible.value = false;
};

const downloadImage = (index: number): void => {
  const image = imageData.value[index];
  if (!image) return;

  fetch(image.url)
    .then((response) => response.blob())
    .then((blob) => {
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = image.name;
      document.body.appendChild(link);
      link.click();
      URL.revokeObjectURL(blobUrl);
      link.remove();
    });
};

defineExpose({
  changePopoverVisible: (visible) => {
    isPopoverVisible.value = visible;
  }
})

const thumbnailStyle = computed(() => {
  if (props.rowHeightLevel === FormTableRowHeight.AUTO) return {}
  return {
    maxHeight: `${imgHeight.value[props.rowHeightLevel]}px`,
  };
})

const imgHeight = ref({
  [FormTableRowHeight.SMALL]: 32,
  [FormTableRowHeight.MEDIUM]: 66,
  [FormTableRowHeight.LARGE]: 110,
  [FormTableRowHeight.AUTO]: 32,
})
</script>

<style scoped lang="scss">
.image-preview-toolbar {
  width: 100%;
  display: flex;
  position: static;
  box-sizing: border-box;

  .thumbnail-container {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
    white-space: nowrap;

    & > span {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .el-image {
      aspect-ratio: 1 / 1;
      max-height: 100%;
      flex-shrink: 0;
      overflow: hidden;
      cursor: var(--cursor-pointer);

      :deep(.el-image__inner) {
        width: 100%;
        height: 100%;
        border-radius: 2px;
        object-fit: cover;
        image-rendering: -webkit-optimize-contrast;
      }
    }
  }

  > .el-button {
    cursor: var(--cursor-pointer);
    width: 80px;
  }
}

.popover-image-list {
  width: 370px;

  .header-wrap {
    width: 100%;
    padding: 4px 12px 4px 4px;
  }
}

.popover-grid {
  display: grid;
  grid-template-columns: repeat(3, 112px);
  row-gap: 8px;
  column-gap: 8px;
  padding: 4px;

  .popover-image-item {
  width: 114px;
  height: 166px;
  display: flex;
  flex-direction: column;
  align-items: center;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  position: relative;

  .el-image {
    width: 110px;
    height: 110px;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: var(--el-bg-color-overlay);
    cursor: var(--cursor-pointer);

    :deep(.el-image__inner) {
      max-width: 110px;
      max-height: 110px;
      width: auto;
      height: auto;
      object-fit: contain;
    }
  }

  .image-meta {
    flex: 1;
    width: 100%;
    padding: 4px 8px 8px;
    padding-right: 20px;
    overflow: hidden;
    display: flex;
    justify-content: flex-start;

    .file-data {
      max-width: 100%;
      display: flex;
      flex-direction: column;
      flex: 1;
      width: 100%;

      .filename {
        line-height: 20px;
        margin-bottom: 4px;
        color: var(--text-color-regular);
        display: inline-block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
      }

      .filesize {
        line-height: 16px;
        font-size: 12px;
        color: var(--text-color-secondary);
        display: flex;
        justify-content: space-between;
      }
    }

    .file-option-wrap {
      height: 100%;
      display: flex;
      flex-direction: column;
    }
  }
}

  &.list-img-preview {
    grid-template-columns: repeat(1, 354px);

    .popover-image-item {
      width: 100%;
      height: 52px;
      flex-direction: row;
      padding: 8px;
      background-color: var(--el-bg-color-overlay);

      .el-image {
        height: 40px;
        width: 40px;
        margin-right: 16px;
      }

      .image-meta {
        height: 40px;
        padding-top: 0;
        padding-bottom: 0;
        padding-left: 0;
      }
    }
  }
}


</style>
