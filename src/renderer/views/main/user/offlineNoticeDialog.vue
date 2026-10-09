<template>
  <el-dialog v-model="dialogState.offlineNoticeDialogVisible" @close="passportState.logout" :append-to-body="true" width="420px">
    <div class="title-text">
      {{ $t("offlineNoticeDialog.userForceQuitTip") }}
    </div>
    <template #footer>
      <span class="dialog-footer">
        <el-button type="primary" @click="dialogState.hide('offlineNoticeDialogVisible')">
          {{ $t("offlineNoticeDialog.confirmLabel") }}
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script lang="tsx" setup>
import { useDialogStore, usePassportStore } from '@renderer/stores';

const dialogState = useDialogStore()
const passportState = usePassportStore();

</script>

<style scoped lang="scss">
</style>
