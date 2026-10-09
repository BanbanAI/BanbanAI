<template>
  <div class="rename-container">
    <el-dialog
      v-model="showDialog"
      :title="$t('NocodeFolderCreateDialog.title')"
      width="350px"
      top="40vh"
      destroy-on-close
      :close-on-click-modal="false"
      @opened="newName.focus()"
      @closed="onClosed"
      draggable
    >
      <div>
        <div class="title">{{ $t('NocodeFolderCreateDialog.folderName') }}:</div>
        <el-input
          ref="newName"
          v-model="folderName"
          :placeholder="$t('NocodeFolderCreateDialog.noNameFolder')"
          class="name-input"
        />
      </div>
      <div v-if="props.groupData?.length">
        <div class="title">{{ $t('NocodeFolderCreateDialog.folder') }}:</div>
        <el-select
          :placeholder="$t('NocodeFolderCreateDialog.folderPlaceholder')"
          class="name-select"
          ref="inputRef"
          type="text"
          v-model="parentId"
          :disabled="lockGroupSelection"
        >
          <el-option value="none" :label="$t('nocodeFolderCreateDialog.none')"/>
          <el-option
            v-for="({ value, label }, index) in props.groupData"
            :value="value"
            :label="label"
          />
        </el-select>
      </div>
      <div class="button-container">
        <el-button @click="showDialog = false">{{ $t('NocodeFolderCreateDialog.cancel') }}</el-button>
        <el-button
          type="primary"
          @click="createFolder"
          :loading="isLoading"
        >
          {{ $t("folderCreateDialog.confirmLabel") }}
        </el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script lang='ts' setup>
import { ref } from "vue";
import i18next from "i18next";

const props = defineProps<{
  nocodeId?: string,
  groupData?: [],
  defaultGroupId?: string,
}>();
const showDialog = ref(false);
const folderName = ref("");
const isLoading = ref(false);
const parentId = ref('none')
const lockGroupSelection = ref(false);

defineExpose({
  show(defaultGroupId?: string, shouldLockGroupSelection = false) {
    parentId.value = defaultGroupId || props.defaultGroupId || 'none';
    lockGroupSelection.value = shouldLockGroupSelection;
    showDialog.value = true;
  },
  hide() {
    showDialog.value = false;
  }
});

const emit = defineEmits<{
  (event: "create", name: string, parent: string),
  (event: "closed"): void,
}>();
const newName = ref<HTMLInputElement>(null);

const onClosed = () => {
  folderName.value = "";
  parentId.value = 'none';
  lockGroupSelection.value = false;
  emit('closed');
  isLoading.value = false;
}
const createFolder = async () => {
  isLoading.value = true;
  let name = folderName.value ? folderName.value : `${i18next.t("NocodeFolderCreateDialog.noNameFolder")}`;
  emit("create", name, parentId.value);
  showDialog.value = false;
};

</script>
<style scoped lang='scss'>
.rename-container {
  position: absolute;

  :deep(.el-dialog) {
    border-radius: 4px;
    overflow: hidden;
    --el-dialog-padding-primary: 0;
    --el-dialog-bg-color: var(--el-bg-color-page);

    .el-dialog__header {
      padding: 0px;
      margin: 0px;
      text-align: center;
      height: 40px;
      line-height: 40px;
      border-bottom: 1px solid var(--border-color);
      --el-dialog-title-font-size: 14px;

      .el-dialog__headerbtn {
        height: 40px;
        width: 40px;
        line-height: 46px;
        font-size: 16px;
        top: 0;
      }
    }

    .el-dialog__body {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;

      .button-container {
        display: flex;
        justify-content: end;


        .el-button { 
          height: 36px;
          width: 64px;
          border-radius: 4px;
        }
      }
    }

    .title {
      line-height: 16px;
      margin-bottom: 8px;
      font-size: 12px;
    }

    .name-input {
      font-size: 12px;

      .el-input__wrapper {
        border-radius: 4px;
        box-shadow: none;
        background-color: var(--el-bg-color-overlay);
      }
    }

    .name-select {
      font-size: 12px;

      .el-select__wrapper {
        border-radius: 4px;
        box-shadow: none;
        background-color: var(--el-bg-color-overlay);
      }
    }

    .el-dialog__footer {
      height: 60px;
      padding: 8px 16px 16px;

      .el-button { 
        height: 36px;
        width: 64px;
        border-radius: 4px;
      }
    }
  }
}
</style>
