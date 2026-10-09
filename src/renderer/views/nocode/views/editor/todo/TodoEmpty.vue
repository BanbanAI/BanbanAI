<template>
  <div class="todo-empty">
    <el-empty :image-size="120" :description="description">
      <template #image>
        <img src="@renderer/assets/image/nocode/todo/todo-empty.png" alt="">
      </template>
    </el-empty>
  </div>
</template>

<script lang='ts' setup>
import { TodoCategory } from '@common/types/nocode';
import { computed } from 'vue';
import i18next from 'i18next';

const props = defineProps<{
  category: TodoCategory,
}>();

const description = computed(() => {
  switch (props.category) {
    case TodoCategory.MY_TODO:
      return i18next.t('TodoEmpty.noTodo');
    case TodoCategory.MY_INITIATED:
      return i18next.t('TodoEmpty.noMyInitiatedTodo');
    case TodoCategory.MY_PROCESSED:
      return i18next.t('TodoEmpty.noMyProcessedTodo');
    case TodoCategory.CC_ME:
      return i18next.t('TodoEmpty.noCcToMeTodo');
    default:
      return '';
  }
})
</script>

<style lang='scss' scoped>
.todo-empty {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-self: center
}

:deep(.el-empty) {
  --el-font-size-base: 12px;

  .el-empty__description {
    margin-top: 10px;
    line-height: 150%;
  }

  svg {
    color: currentColor;
  }
}
</style>