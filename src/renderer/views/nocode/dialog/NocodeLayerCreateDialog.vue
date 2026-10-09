<template>
  <div class="rename-container">
    <el-dialog v-model="showDialog" width="350px" :title="$t('reportEditor.addPage')" align-center destroy-on-close :close-on-click-modal="false" @opened="inputRef.focus()" @closed="handleClosed" draggable>
      <div>
        <div class="title">{{ $t("NocodeLayerCreateDialog.name") }}:</div>
        <el-input
          :placeholder="$t('NocodeLayerCreateDialog.namePlaceholder')"
          class="name-input"
          ref="inputRef"
          type="text"
          v-model="nocodeName"
        />
      </div>
      <div v-if="props.groupData?.length">
        <div class="title">{{ $t("NocodeLayerCreateDialog.group") }}:</div>
        <el-select
          :placeholder="$t('NocodeLayerCreateDialog.groupPlaceholder')"
          class="name-select"
          ref="inputRef"
          type="text"
          v-model="parentId"
          :disabled="lockGroupSelection"
        >
          <el-option value="none" :label="$t('nocodeLayerCreateDialog.none')"/>
          <el-option
            v-for="item in props.groupData"
            :value="item.value"
            :label="item.label"
          />
        </el-select>
      </div>
      <div class="button-container">
        <el-button @click="showDialog = false">{{ $t("NocodeLayerCreateDialog.cancel") }}</el-button>
        <el-button
          type="primary"
          @click="createNocodeLayer"
          :loading="isLoading"
        >
          {{ $t("nocodeCreateDialog.confirmLabel") }}
        </el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script lang='ts' setup>
import { ref } from "vue";
import i18next from "i18next";

const showDialog = ref(false);
const nocodeName = ref('');
const parentId = ref('none')
const lockGroupSelection = ref(false);
const isLoading = ref(false);
const emit = defineEmits<{
  (event: "create", name?: string, parent?: string): void,
}>();

const props = defineProps({
  groupData: [],
  defaultGroupId: {
    type: String,
    default: ''
  }
})

const inputRef = ref<HTMLInputElement>(null);
const handleClosed = () => {
  nocodeName.value = '';
  parentId.value = 'none'
  lockGroupSelection.value = false;
  isLoading.value = false;
}
const createNocodeLayer = async () => {
  isLoading.value = true;
  const name = nocodeName.value ? nocodeName.value : i18next.t('NocodeLayerCreateDialog.namePlaceholder');
  const parent = parentId.value
  emit("create",name, parent);
  showDialog.value = false;
};

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
