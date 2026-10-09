<template>
  <div class="workbench-organize-main">
    <vn-stack-layer name="member">
      <organize-member-manager />
    </vn-stack-layer>
    <vn-stack-layer name="company">
      <organize-main-admin mode="company"></organize-main-admin>
    </vn-stack-layer>
    <vn-stack-layer name="admin">
      <organize-main-admin mode="admin"></organize-main-admin>
    </vn-stack-layer>
    <vn-stack-layer name="aiPermission">
      <workbench-ai-permission-manage v-if="activeOrganizeTab === 'aiPermission'"></workbench-ai-permission-manage>
    </vn-stack-layer>
    <vn-stack-layer name="aiModelManage">
      <workbench-ai-model-manage v-if="activeOrganizeTab === 'aiModelManage'"></workbench-ai-model-manage>
    </vn-stack-layer>
    <vn-stack-layer name="conversation" v-if="false">
      <workbench-conversation-manage v-if="activeOrganizeTab === 'conversation'"></workbench-conversation-manage>
    </vn-stack-layer>
  </div>
</template>

<script setup lang='ts'>
import i18next from 'i18next';
import { useActiveOrganizeTab } from '../hooks';
import WorkbenchAiModelManage from '../layers/WorkbenchAiModelManage.vue';
import WorkbenchAiPermissionManage from '../layers/WorkbenchAiPermissionManage.vue';
import WorkbenchConversationManage from '../layers/WorkbenchConversationManage.vue';
import { useLocalizedDocumentTitle } from '@renderer/hooks/useLocalizedDocumentTitle';

const activeOrganizeTab = useActiveOrganizeTab();

useLocalizedDocumentTitle(() => `${i18next.t('WorkbenchOrganizeMain.workbench')} - ${i18next.t('WorkbenchOrganizeMain.organizeManagement')}`);
</script>

<style scoped lang='scss'>
.workbench-organize-main {
  padding: 16px;
  width: 100%;
  height: 100%;
  color: #000;
  background-color: #f5f5f7;

  .vn-stack-layer {
    width: 100%;
    height: 100%;
  }

}
</style>
