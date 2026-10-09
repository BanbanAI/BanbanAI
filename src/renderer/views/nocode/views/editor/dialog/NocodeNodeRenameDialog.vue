<template>
  <div class="rename-container">
    <el-dialog 
      v-model="showDialog" 
      width="350px" 
      align-center 
      destroy-on-close 
      :close-on-click-modal="false" 
      :title="$t('folderRenameDialog.title')"
      draggable
      @opened="newName.focus()"
    >
      <el-form-item :label="label" label-position="top">
        <el-input class="name-input" ref="newName" type="text" @keyup.enter="doRename" v-model="currentName" />
      </el-form-item>
      <template #footer>
        <span class="dialog-footer">
          <el-button class="cancel-btn" @click="showDialog = false">{{ $t("folderRenameDialog.cancelLabel") }}</el-button>
          <el-button class="confirm-btn" type="primary" @click="doRename">{{ $t("folderRenameDialog.confirmLabel") }}</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script lang='ts' setup>
import { computed, ref } from "vue";
import { ElMessage } from "element-plus";
import { NocodeStructureType } from "@common/types/nocode";
import i18next from 'i18next';

const showDialog = ref(false);
const currentName = ref("");
const type = ref<NocodeStructureType>();

const label = computed(() => {
  if (type.value === NocodeStructureType.GROUP) return i18next.t('folderRenameDialog.groupLabel');
  if (type.value === NocodeStructureType.FORM) return i18next.t('folderRenameDialog.formLabel');
  return i18next.t('folderRenameDialog.pageLabel');
})

defineExpose({
  show(name: string, _type: NocodeStructureType) {
    currentName.value = name;
    showDialog.value = true;
    type.value = _type;
  },
  hide() {
    showDialog.value = false;
  }
});

const emit = defineEmits<{
  (event: "confirm", name: string),
}>();
const newName = ref<HTMLInputElement>(null);

const doRename = async () => {
  const name = currentName.value;
  if(!name || !name.trim()){
    if (type.value === NocodeStructureType.GROUP) {
      ElMessage.warning(i18next.t('NocodeNodeRenameDialog.groupNameNotNull'));
    } else {
      ElMessage.warning(i18next.t('NocodeNodeRenameDialog.pageNameNotNull'));
    }
    return;
  }
  emit("confirm", name);
  showDialog.value = false;
};

</script>
<style scoped lang='scss'>
.rename-container {
  .el-button {
    border-radius: 4px;
  }
  :deep(.el-dialog) {
    padding: 0;
    border-radius: 4px;
    background-color: var(--bg-color-page);
    .el-dialog__header {
      height: 40px;
      text-align: center;
      border-bottom: 1px solid var(--border-color);
      --el-dialog-title-font-size: 14px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .el-dialog__body {
      padding: 20px;
      .el-form-item {
        .el-input {
          .el-input__wrapper {
            border-radius: 4px;
          }
        }
      }
    }
    .el-dialog__footer {
      padding: 14px 20px;
      border-top: 1px solid var(--border-color);
      .dialog-footer {
        .confirm-btn {
          margin-left: 8px;
        }
      }
    }
  }
}
</style>