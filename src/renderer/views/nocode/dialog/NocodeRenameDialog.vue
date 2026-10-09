<template>
  <div class="rename-container">
    <el-dialog v-model="showDialog" width="350px" :title="$t('nocodeRenameDialog.dialogHeader')" top="40vh" destroy-on-close :close-on-click-modal="false" @opened="newName.focus()" @closed="emit('closed')">
      <el-form-item :label="$t('nocodeRenameDialog.title')" label-position="top">
        <el-input ref="newName" type="text" @keyup.enter="doRename" v-model="nocodeName" />
      </el-form-item>
      <template #footer>
        <span class="dialog-footer">
          <el-button type="primary" @click="doRename">{{ $t("nocodeRenameDialog.confirmLabel") }}</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script lang='ts' setup>
import { ref } from "vue";
import axios from "axios";
import { ElMessage } from "element-plus";
import i18next from "i18next";


const showDialog = ref(false);
const nocodeId = ref("");
const nocodeName = ref("");
defineExpose({
  show(id: string, name: string) {
    nocodeId.value = id;
    nocodeName.value = name;
    showDialog.value = true;
  },
  hide() {
    showDialog.value = false;
  }
});

const emit = defineEmits<{
  (event: "closed", id?: string, name?: string): void,
}>();
const newName = ref<HTMLInputElement>(null);

const reg = /[\/\\:*?"<>|]/;
const doRename = async () => {
  let name = nocodeName.value;
  if(!name || !name.trim()){
    ElMessage.warning(i18next.t("nocodeRenameDialog.nameEmptyTip"));
    return;
  } else if(reg.test(name)){
    ElMessage.warning(i18next.t("nocodeRenameDialog.nameFormatTip") + ' \\ / : * ? " < > |');
    return;
  }
  let result = await axios.get("/project/rename-nocode?name="+encodeURIComponent(nocodeName.value)+"&id="+nocodeId.value).catch(err => {
    console.log(err);
  });
  if(result){
    emit("closed", nocodeId.value, result.data);
  }else{
    emit("closed");
  }
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
      padding: 22px 16px;
    }

    .el-form-item {
      &:last-child {
        margin-bottom: 0;
      }

      .el-form-item__label {
        line-height: 16px;
        margin-bottom: 8px;
        font-size: 12px;
        color: var(--text-color-secondary);
      }

      .el-input {
        font-size: 12px;
        --el-input-bg-color: var(--el-bg-color-overlay);

          .el-input__wrapper {
            border-radius: 4px;
          }
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