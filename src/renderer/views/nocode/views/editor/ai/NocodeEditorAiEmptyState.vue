<template>
  <div class="editor-ai-empty">
    <div class="editor-ai-empty__prompt">{{ $t('nocodeEditorAiEmptyState.aiCanCreateOrModifyApps') }}</div>
  </div>
</template>

<style scoped lang="scss">
.editor-ai-empty {
  flex: 1;
  width: 100%;
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.editor-ai-empty__prompt {
  color: #4e5969;
  font-size: 20px;
  font-weight: 500;
  line-height: 28px;
  text-align: center;
}
</style>
