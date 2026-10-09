<template>
  <div class="nocode-box-content" @click.stop="emit('preview')">
    <div class="nocode-box-content-header">
      <div class="icon" v-if="nocodeBody?.snapshot" :style="{ background: nocodeBody?.snapshot?.color }">
        <el-icon :size="28" color="#fff">
          <component :is="nocodeBody?.snapshot?.icon" />
        </el-icon>
      </div>
      <el-image class="image" loading="lazy" style="width: 100%; height: 100%;" :src="getCoverImageURL(nocode?.id)" v-else>
        <template #error>
          <img src="@renderer/assets/image/report-default-cover.png" alt="">
        </template>
      </el-image>
    </div>
    <div class="nocode-box-content-title">{{ nocode?.name }}</div>
  </div>
</template>

<script setup lang='ts'>
import { NocodeMeta } from '@common/types/nocode';
import { ref } from 'vue';
import axios from "axios";

const props = withDefaults(
  defineProps<{
    nocode: NocodeMeta,
    isEditable: boolean,
    isDeletable: boolean,
    menuDisabled?: boolean
  }>(),
  { menuDisabled: false }
) ;

const emit = defineEmits<{
  (e: "preview"),
}>();

const nocodeBody = ref();
const coverVersion = ref(0);

const getCoverImageURL = (nocodeId: string) => {
  return `project/get-nocode-snapshot/${nocodeId}?t=${coverVersion.value}`;
};

const getNocodeBody = async () => {
  const res = await axios.get(`project/get-nocode-body/${props.nocode.id}`).then(({ data }) => data).catch(() => null)
  if (res) nocodeBody.value = res;
}
getNocodeBody();

defineExpose({
  updateCoverImage: async () => {
    await getNocodeBody();
    coverVersion.value++;
  },
})

</script>

<style scoped lang='scss'>
.nocode-box-content {
  width: 78px;
  height: auto;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  row-gap: 8px;

  .nocode-box-content-header {
    width: 40px;
    height: 40px;

    .icon {
      width: 100%;
      height: 100%;
      border-radius: 8px;
      padding: 8px;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    img {
      width: 100%;
      height: 100%;
      border-radius: 8px;
    }

    .el-image {
      width: 100%;
      height: 100%;
      border-radius: 8px;
    }
  }

  .nocode-box-content-title {
    width: 100%;
    color: var(--text-color-regular);
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    text-align: center;

    line-height: 20px;
    max-width: 66px;
    max-height: 40px;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    white-space: normal;
    word-break: break-all;
    text-overflow: ellipsis;
  }
}
</style>