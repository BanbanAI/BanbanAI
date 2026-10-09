<template>
  <div class="empty-layer-dialog-container">
    <el-dialog v-model="dialogVisibleComp" 
      destroy-on-close :close-on-click-modal="false" width="680px"
      :title="$t('EmptyLayerDialog.title')" top="30vh" draggable align-center
    >
      <div class="content">
        <div class="form-content-box">
          <img loading="lazy" src="@renderer/assets/image/nocode_creation/create-form-new-inborder.png" />
          <div class="desc-box">
            <p class="title">{{ $t("EmptyLayerDialog.createForm") }}</p>
            <p class="desc">{{ $t("EmptyLayerDialog.createFormTip") }}</p>
          </div>
          <div class="btn-box">
            <el-button type="primary" @click="handleNewForm">{{ $t("EmptyLayerDialog.createBlankForm") }}</el-button>
            <el-button class="import-excel" type="success" plain @click="handleImportExcel">{{ $t("EmptyLayerDialog.importExcel") }}</el-button>
          </div>
        </div>
        <div class="page-content-box">
          <img loading="lazy" src="@renderer/assets/image/nocode_creation/create-page-new-inborder.png" />
          <div class="desc-box">
            <p class="title">{{ $t("EmptyLayerDialog.createPage") }}</p>
            <p class="desc">{{ $t("EmptyLayerDialog.createPageTip") }}</p>
          </div>
          <div class="btn-box">
            <el-button type="primary" plain @click="handleNewPage">{{ $t("EmptyLayerDialog.createBlankPage") }}</el-button>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import i18next from 'i18next';

const props = defineProps<{
  dialogVisible: boolean
}>();

const emit = defineEmits(['update:dialogVisible', 'newForm', 'newPage', 'importExcel']);

const dialogVisibleComp = computed({
  get: () => props.dialogVisible,
  set: (val) => emit('update:dialogVisible', val)
});

function handleNewForm() {
  emit('newForm', `${i18next.t('EmptyLayerDialog.myForm')}`);
  dialogVisibleComp.value = false;
}

function handleImportExcel() {
  emit('importExcel');
  dialogVisibleComp.value = false;
}

function handleNewPage() {
  emit('newPage');
  dialogVisibleComp.value = false;
}

</script>

<style lang="scss" scoped>
.empty-layer-dialog-container{
  :deep(.el-dialog){
    padding: 0px;
    border-radius: 4px;
    --el-dialog-bg-color: var(--bg-color-page);
    .el-dialog__header{
      padding: 8px;
      text-align: center;
      border-bottom: 1px solid var(--border-color);
      --el-dialog-title-font-size: 14px;
    }
    .el-dialog__body{
      padding: 24px 24px 32px 24px;
    }
  }

  .content {
    display: flex;

    .form-content-box {
      padding-right: 16px;
      border-right: 1.5px solid var(--border-color);
      
      img {
        width: 300px;
        height: 168px;
      }

      .desc-box {
        margin-top: 16px;
        margin-bottom: 32px;

        .title {
          font-size: 16px;
          font-weight: 400;
          color: var(--text-color-primary);
          margin-bottom: 8px;
        }
        .desc {
          font-size: 14px;
          font-weight: 400;
          line-height: 20px;
          color: var(--text-color-secondary);
          letter-spacing: 0.5px;
        }
      }

      .btn-box {
        :deep(.el-button){
          border-radius: 4px;
          width: 142px;
          height: 36px;
        }
        :deep(.import-excel) {
          --el-button-bg-color: transparent;
        }

        display: flex;
        justify-content: space-between;
      }
    }

    .page-content-box {
      padding-left: 16px;

      img {
        width: 300px;
        height: 168px;
      }

      .desc-box {
        margin-top: 16px;
        margin-bottom: 32px;

        .title {
          font-size: 16px;
          font-weight: 400;
          color: var(--text-color-primary);
          margin-bottom: 8px;
        }
        .desc {
          font-size: 14px;
          font-weight: 400;
          line-height: 20px;
          color: var(--text-color-secondary);
          letter-spacing: 0.5px;
        }
      }

      .btn-box {
        :deep(.el-button){
          border-radius: 4px;
          width: 300px;
          height: 36px;
          --el-button-bg-color: transparent;
        }

        display: flex;
        justify-content: center;
      }
    }
  }
}
</style>