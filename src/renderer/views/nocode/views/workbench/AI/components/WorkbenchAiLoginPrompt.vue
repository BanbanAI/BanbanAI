<template>
  <div class="workbench-ai-login-prompt">
    <div class="workbench-ai-login-prompt__title">{{ $t('WorkbenchAiChat.loginPromptTitle') }}</div>
    <div class="workbench-ai-login-prompt__description">{{ $t('WorkbenchAiChat.loginPromptDescription') }}</div>
    <div v-if="props.adminOnly" class="workbench-ai-login-prompt__admin-only">
      {{ $t('WorkbenchAiChat.loginPromptAdminOnly') }}
    </div>
    <template v-else>
      <div class="workbench-ai-login-prompt__actions">
        <el-button type="primary" @click="emit('login')">
          {{ $t('WorkbenchAiChat.loginPromptLogin') }}
        </el-button>
        <el-button @click="emit('other-options')">
          {{ $t('WorkbenchAiChat.loginPromptOtherOptions') }}
        </el-button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
type Props = {
  adminOnly?: boolean
}

// eslint-disable-next-line vue/valid-define-props
const props = withDefaults(defineProps<Props>(), {
  adminOnly: false,
})

// eslint-disable-next-line vue/valid-define-emits
const emit = defineEmits<{
  (event: 'login'): void
  (event: 'other-options'): void
}>()
</script>

<style scoped lang="scss">
.workbench-ai-login-prompt {
  width: 100%;
  padding: 24px 0;
  text-align: center;
}

.workbench-ai-login-prompt__title {
  color: #1d2129;
  font-size: 17px;
  font-weight: 600;
  line-height: 24px;
}

.workbench-ai-login-prompt__description {
  margin-top: 4px;
  color: #86909c;
  font-size: 14px;
  line-height: 20px;
}

.workbench-ai-login-prompt__admin-only {
  margin-top: 16px;
  color: #86909c;
  font-size: 14px;
  line-height: 20px;
  text-align: center;
}

.workbench-ai-login-prompt__actions {
  margin-top: 16px;
  display: flex;
  justify-content: center;
  gap: 10px;

  .el-button {
    width: 104px;
    height: 32px;
    margin: 0;
    border-radius: 4px;
    font-size: 14px;
  }
}
</style>
