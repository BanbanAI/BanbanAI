<template>
  <div class="nocode-box" :class="{ selected: isSelected }" @click.stop="handleBoxClick">
    <div class="nocode-box-content">
      <div class="nocode-box-content-header">
        <div class="icon" v-if="coverType === 'icon' && props.snapshot" :style="{ background: props.snapshot.color }">
          <el-icon :size="36" color="#fff">
            <component :is="props.snapshot.icon" />
          </el-icon>
        </div>
        <el-image v-else-if="coverType === 'image'" loading="lazy" style="width: 100%; height: 100%;" :src="getCoverImageURL(nocode?.id)">
          <template #error>
            <img src="@renderer/assets/image/report-default-cover.png" alt="">
          </template>
        </el-image>
        <img v-else src="@renderer/assets/image/report-default-cover.png" alt="">
      </div>
      <div class="nocode-box-content-title">{{ nocode?.name }}</div>
    </div>
    <div class="setting-icon" :class="{ 'checked-style': appChecked }">
      <el-checkbox v-model="appChecked" size="large" @click.stop />
    </div>
  </div>
</template>

<script setup lang='ts'>
import { NocodeBody, NocodeCoverSummary, NocodeMeta } from '@common/types/nocode';
import { computed, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    nocode: NocodeMeta,
    snapshot?: NocodeBody['snapshot'],
    cover?: NocodeCoverSummary,
  }>(),
  {}
) ;

const emit = defineEmits<{
  (e: "changeSelect", nocode: NocodeMeta, isSelected: boolean),
}>();

const appChecked = ref(false)
const isSelected = ref(false);
const coverType = computed<NocodeCoverSummary['type']>(() => props.cover?.type || (props.snapshot ? 'icon' : 'default'));

const handleBoxClick = () => {
  isSelected.value = !isSelected.value;
  appChecked.value = isSelected.value;
  // 向父组件发送选中状态
  emit('changeSelect', props.nocode, isSelected.value);
}

const coverVersion = ref(0);

const getCoverImageURL = (nocodeId: string) => {
  return props.cover?.imageUrl || `project/get-nocode-snapshot/${nocodeId}?t=${coverVersion.value}`;
};

</script>

<style scoped lang='scss'>
.nocode-box {
  position: relative;
  width: 182px;
  height: 144px;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: var(--bg-color-page);
  padding: 16px;
  border-radius: 4px;
  cursor: var(--cursor-pointer);
  transition: box-shadow 0.3s ease-in-out;

  &:hover {
    box-shadow: 0px 10px 32px 0px var(--bg-color-hover);
  }
  &.selected{
    border: 1px solid #0873FF;
  }


  .nocode-box-content {
    width: 178px;
    height: 92px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    row-gap: 10px;

    .nocode-box-content-header {
      width: 48px;
      height: 48px;

      .icon {
        width: 48px;
        height: 48px;
        border-radius: 8px;
        display: flex;
        justify-content: center;
        align-items: center;
      }

      img {
        width: 100%;
        height: 100%;
      }

      .el-image {
        border-radius: 8px;
      }
    }

    .nocode-box-content-title {
      width: 100%;
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
      color: var(--text-color-regular);
      font-size: 16px;
      text-align: center
    }
  }

  .setting-icon {
    position: absolute;
    top: 4px;
    right: 12px;
    width: 24px;
    height: 24px;
    display: none;
    pointer-events: none;
  }
  /* 选中时显示（并列类选择器） */
  .setting-icon.checked-style {
    display: block; /* 覆盖默认的 display: none */
  }
}
</style>
