<template>
  <div class="user-container">
    <div class="header-right-user" @click="emit('clickAvatar')">
      <el-icon :size="24" color="var(--color-primary)">
        <i-workbench-avatar></i-workbench-avatar>
      </el-icon>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { usePassportStore } from '@renderer/stores';
import { OrganizeUtil } from '@renderer/views/nocode/utils';

const emit = defineEmits<{
  (e: 'clickAvatar'): void
}>();

const passportState = usePassportStore();
passportState.init()

const organizeUtil = new OrganizeUtil();
organizeUtil.getDepartments();

</script>

<style scoped lang='scss'>
.user-container {
  position: relative;
  z-index: 1001;

  .header-right-user {
    // width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: var(--cursor-pointer);
    transition: all 0.3s;

    &:hover {
      opacity: 0.8;
    }
  }
}
</style>