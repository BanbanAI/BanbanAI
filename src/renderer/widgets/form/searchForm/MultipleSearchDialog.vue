<template>
  <div class="multiple-search-form-dialog">
    <el-dialog  :modelValue="modelValue" @update:model-value="emit('update:modelValue', $event)" fullscreen :show-close="false">
      <multiple-search-form class="multiple-search" :isShowFullScreen="isShowFullScreen" @closeFullscreenDialog="handleCloseFullscreenDialog"></multiple-search-form>
    </el-dialog>
  </div>
</template>

<script setup lang='ts'>
import { useWidget } from '@renderer/b2/types';
import { SearchForm } from './searchForm';
import MultipleSearchForm from './MultipleSearchForm.vue';
import { onBeforeUnmount, ref, watch } from 'vue';

const props = defineProps<{
  modelValue: boolean,
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void
}>();
const isShowFullScreen = ref(true);
onBeforeUnmount(() => {
  isShowFullScreen.value = false;
  emit("update:modelValue", false)
})

const handleCloseFullscreenDialog = () => {
  emit("update:modelValue", false)
}
</script>

<style lang="scss" scoped>

</style>