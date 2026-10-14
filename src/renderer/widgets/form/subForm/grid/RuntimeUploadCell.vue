<template>
  <div
    class="runtime-upload-cell"
    :class="{ 'runtime-upload-cell--boxed': !readonly }"
    @click.stop="emit('open')"
  >
    <span class="runtime-upload-cell__strip">
      <template v-if="isImage">
        <el-image
          v-for="(item, index) in items"
          :key="item.uid"
          class="runtime-upload-cell__thumb"
          :src="item.url"
          fit="cover"
          @click.stop="openViewer(index)"
        >
          <template #error>
            <span class="runtime-upload-cell__thumb-fallback">
              <el-icon :size="14" color="#fff"><Picture /></el-icon>
            </span>
          </template>
        </el-image>
      </template>
      <template v-else-if="!readonly">
        <el-tooltip
          v-for="item in items"
          :key="item.uid"
          :content="item.name"
          placement="top"
          :show-after="150"
        >
          <span class="runtime-upload-cell__file" @click.stop="previewMedia(item)">
            <video
              v-if="item.isVideo && item.url"
              class="runtime-upload-cell__file-media"
              :src="item.url"
              preload="metadata"
            />
            <img v-else class="runtime-upload-cell__file-media" :src="getUploadFileIcon(item.name, item.url)" alt="" />
            <el-icon v-if="item.isVideo" class="runtime-upload-cell__play" :size="14"><VideoPlay /></el-icon>
          </span>
        </el-tooltip>
      </template>
      <span v-else class="runtime-upload-cell__names">{{ names }}</span>
    </span>
    <el-icon class="runtime-upload-cell__arrow" :size="14"><ArrowDown /></el-icon>

    <el-image-viewer
      v-if="viewerIndex !== null"
      :initial-index="viewerIndex"
      :url-list="imageUrls"
      show-progress
      teleported
      @close="viewerIndex = null"
    />
    <teleport to="body">
      <table-media-viewer
        v-if="mediaVisible"
        :z-index="9000"
        :initial-index="mediaIndex"
        :url-list="mediaUrls"
        :hide-on-click-modal="true"
        :infinite="true"
        :autoplay="false"
        @close="mediaVisible = false"
      />
    </teleport>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from "vue";
import { ArrowDown, Picture, VideoPlay } from "@element-plus/icons-vue";
import type { RuntimeUploadDisplayItem } from "./runtime-upload-utils";
import { getUploadFileIcon } from "./runtime-upload-utils";

const props = defineProps<{
  type: string;
  items: RuntimeUploadDisplayItem[];
  readonly?: boolean;
}>();

const emit = defineEmits<{
  (event: "open"): void;
}>();

const isImage = computed(() => props.type === "widget.form.image-uploader");
const names = computed(() => props.items.map(item => item.name).join(", "));
const imageUrls = computed(() => props.items.map(item => item.url).filter(Boolean));
const mediaUrls = computed(() => props.items.filter(item => item.isMedia && item.url).map(item => item.url));

const viewerIndex = ref<number | null>(null);
const mediaVisible = ref(false);
const mediaIndex = ref(0);

const openViewer = (index: number) => {
  viewerIndex.value = index;
};

const previewMedia = (item: RuntimeUploadDisplayItem) => {
  if (!item.isMedia || !item.url) return;
  const index = mediaUrls.value.indexOf(item.url);
  if (index === -1) return;
  mediaIndex.value = index;
  mediaVisible.value = true;
};
</script>

<style lang="scss" scoped>
.runtime-upload-cell {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  cursor: pointer;

  &--boxed {
    height: 32px;
    padding: 0 8px;
    border: 1px dashed var(--cell-border);
    border-radius: 4px;
  }

  &__strip {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
  }

  &__thumb {
    flex: 0 0 auto;
    width: 26px;
    height: 26px;
    overflow: hidden;
    border-radius: 2px;
    background: var(--el-bg-color-overlay, #f5f7fa);

    :deep(.el-image__inner) {
      width: 100%;
      height: 100%;
      border-radius: 2px;
      object-fit: cover;
      image-rendering: -webkit-optimize-contrast;
    }
  }

  &__thumb-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: #f5f5f7;
  }

  &__file {
    position: relative;
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
  }

  &__file-media {
    width: 26px;
    height: 26px;
    border-radius: 2px;
    object-fit: cover;
  }

  &__play {
    position: absolute;
    color: rgb(255 255 255 / 85%);
    pointer-events: none;
  }

  &__names {
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__arrow {
    flex: 0 0 auto;
    color: var(--text-color-secondary);
  }
}
</style>
