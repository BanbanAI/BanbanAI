<template>
  <div class="nocode-access-denied">
    <el-result icon="warning" :title="$t('NocodeAccessDenied.noViewPermission')">
      <template #icon>
        <el-icon color="#e6a23c" :size="48"><i-ven-icon-warning-filled /></el-icon>
      </template>
    </el-result>
  </div>
</template>

<style scoped lang="scss">
.nocode-access-denied {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-color-page);

  :deep(.el-result) {
    .el-result__icon {
      height: 48px;
      width: 48px;
    }

    .el-result__title {
      margin-top: 12px;
      p {
        font-size: 14px;
        line-height: 22px;
        color: #86909C;
      }
    }
  }
}
</style>
