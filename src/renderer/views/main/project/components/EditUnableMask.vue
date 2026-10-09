<template>
  <div class="edit-unable-mask" @click="handleUnableTip" v-show="activeCoEditingAccount">
  </div>
</template>

<script lang="ts" setup>
import { usePassportStore } from '@renderer/stores';
import { ACTIVE_BOARD, CO_EDITING_ACCOUNTS } from '@renderer/types';
import { ElMessage } from 'element-plus';
import { computed, inject } from 'vue';
import i18next from "i18next";

const passportState = usePassportStore();
const activeBoard = inject(ACTIVE_BOARD);
const coEditingAccounts = inject(CO_EDITING_ACCOUNTS)


const activeCoEditingAccount = computed(() => {
  if(passportState.mode === 'user') return;
  return coEditingAccounts.value.find(item => {
    if (passportState.account.id === item.id) return false;
    if (item.boardUIDs) {
      return item.boardUIDs.includes(activeBoard.value.uid)
    }
  });
})

const handleUnableTip = () => {
  ElMessage.warning(activeCoEditingAccount.value?.nickname + i18next.t("editUnableMask.cannotEditTip"));
}
</script>

<style scoped lang="scss">
.edit-unable-mask {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1800;
}
</style>

