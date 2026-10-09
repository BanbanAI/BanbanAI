<template>
  <div class="nocode-create-data-dialog">
    <el-dialog
      v-model="dialogVisible"
      width="360px"
      class="create-option-dialog"
      :close-on-click-modal="false"
      draggable
      :title="$t('NocodeCreateDataDialog.title')"
      :before-close="handleClose"
      align-center
    >
      <div class="dialog-content">
        <div class="dialog-button-item1" :class="{active: createMode === 'form'}" @click="createMode = 'form'">
          <img src="@renderer/assets/image/form.svg" />
          <p>{{ $t('NocodeCreateDataDialog.createBlankForm') }}</p>
          <!-- 右上角对勾图标 -->
          <div v-if="createMode === 'form'" class="check-icon"></div>
        </div>
        <div class="dialog-button-item2" :class="{active: createMode === 'excel'}" @click="createMode = 'excel'">
          <img src="@renderer/assets/image/excel.svg" />
          <p>{{ $t('NocodeCreateDataDialog.importExcel') }}</p>
          <!-- 右上角对勾图标 -->
          <div v-if="createMode === 'excel'" class="check-icon"></div>
        </div>
      </div>
      <div class="name-input">
        <span>{{ $t('NocodeCreateDataDialog.name') }}{{ getI18nLabelColon() }}</span>
        <el-input :placeholder="$t('NocodeCreateDataDialog.myForm')" v-model="dataName"></el-input>
      </div>
      <div class="name-input" v-if="props.groupData?.length">
        <span>{{ $t('NocodeCreateDataDialog.group') }}{{ getI18nLabelColon() }}</span>
        <el-select :placeholder="$t('NocodeCreateDataDialog.myForm')" v-model="dataGroup" :disabled="props.lockGroupSelection">
          <el-option
            value="none"
            :label="$t('nocodeCreateDataDialog.none')"
          />
          <el-option
            v-for="item in props.groupData"
            :value="item.value"
            :label="item.label"
          />
        </el-select>
      </div>
      <div class="button-container">
        <el-button @click="handleClose">{{ $t('NocodeCreateDataDialog.cancel') }}</el-button>
        <el-button @click="handleConfirm" class="confirm">{{ $t('NocodeCreateDataDialog.confirm') }}</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import i18next from 'i18next';
import { getI18nLabelColon } from '@common/utils/i18n';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  groupData: [],
  defaultGroupId: {
    type: String,
    default: ''
  },
  lockGroupSelection: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue', 'closed', 'confirmed', 'importExcel']);

const dialogVisible = ref(false);
const dataName = ref('')
const dataGroup = ref('none')

// 监听父组件传入的 modelValue 变化
watch(() => props.modelValue, (val) => {
  dialogVisible.value = val;
  dataName.value = ''
  dataGroup.value = props.defaultGroupId || 'none'
});

// 监听本地 dialogVisible 变化，同步回父组件
watch(() => dialogVisible.value, (val) => {
  emit('update:modelValue', val);
});

const handleClose = () => {
  dialogVisible.value = false;
  emit('closed');
};

const handleConfirm = () => {
  if(createMode.value === 'form') {
    createBlankForm()
  } else {
    importExcel()
  }
}

const createBlankForm = () => {
  const name = dataName.value ? dataName.value : `${i18next.t("NocodeCreateDataDialog.myForm")}`
  const group = dataGroup.value === 'none' ? '' : dataGroup.value
  if (name != '') {
    // 这里添加确认逻辑
    dialogVisible.value = false;
    emit('confirmed', {
      name: name,
      group: group
    });
    emit('closed');
  }
};

const importExcel = () => {
  const name = dataName.value ? dataName.value : `${i18next.t("NocodeCreateDataDialog.myForm")}`
  const group = dataGroup.value === 'none' ? '' : dataGroup.value
  dialogVisible.value = false;
  emit('importExcel',{
    name: name,
    group: group
  });
}

const createMode = ref('form')

</script>

<style lang="scss" scoped>
.nocode-create-data-dialog {
  // 新建表单弹窗
  :deep(.create-option-dialog.el-dialog) {
    border-radius: 4px;
    overflow: hidden;
    --el-dialog-padding-primary: 0;
    background-color: var(--color-white);

    .el-dialog__header{
      padding: 0px;
      margin: 0px;
      text-align: center;
      line-height: 40px;
      border-bottom: 1px solid var(--border-color);
      --el-dialog-title-font-size: 14px;
    }

    .el-dialog__body{
      padding: 16px; 
    }
  }
  .dialog-content {
    display: flex;
    justify-content: space-around;
    gap: 8px;

    .dialog-button-item1,
    .dialog-button-item2 
    {
      position: relative;
      border: 1px solid var(--border-color);
      border-radius: 3px;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      transition: border-color 0.5s ease;
      padding: 12px 26px;
      gap: 12px;
    }

    .dialog-button-item1 {
      &:hover {
        border-color: var(--el-color-primary);
      }

      &.active {
        border-color: var(--el-color-primary);
      }
    }

    .dialog-button-item2 {
      &:hover {
        border-color: var(--el-color-success);
      }
      
      &.active {
        border-color: var(--el-color-success);
      }
    }

    .dialog-button-item1 img,
    .dialog-button-item2 img
    {
      width: 20px;
      height: 20px;
    }

    .dialog-button-item1 p,
    .dialog-button-item2 p
    {
      font-weight: 400;
      font-size: 12px;
      line-height: 16px;
      letter-spacing: 0%;
      text-align: center;
    }

    .dialog-button-item1 .check-icon {
      position: absolute;
      top: 0;
      right: 0;
      width: 28px;
      height: 24px;
      background-color: var(--el-color-primary);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1;
      clip-path: polygon(100% 0, 0 0, 100% 100%);
    }
    .dialog-button-item1 .check-icon::after {
      content: '';
      position: absolute;
      width: 4px;
      height: 8px;
      border: 2px solid white;
      border-top: 0;
      border-left: 0;
      transform: rotate(45deg);
      top: 1px;
      right: 4px;
    }

    .dialog-button-item2 .check-icon {
      position: absolute;
      top: 0;
      right: -0.5px;
      width: 28px;
      height: 24px;
      background-color: var(--el-color-success);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1;
      clip-path: polygon(100% 0, 0 0, 100% 100%);
    }
    .dialog-button-item2 .check-icon::after {
      content: '';
      position: absolute;
      width: 4px;
      height: 8px;
      border: 2px solid white;
      border-top: 0;
      border-left: 0;
      transform: rotate(45deg);
      top: 1px;
      right: 4.5px;
    }

  }

  .name-input {
    margin-top: 24px;
    display: flex;
    flex-direction: column;
    gap: 8px;

    :deep(.el-input) {
      .el-input__wrapper {
        background-color: var(--bg-color-overlay);
        box-shadow: none;
        border-radius: 4px;
      }
    }

    :deep(.el-select__wrapper) {
      background-color: var(--bg-color-overlay);
      box-shadow: none;
      border-radius: 4px;
    }
  }
  
  .button-container {
    margin-top: 24px;
    display: flex;
    justify-content: end;
    
    .el-button {
      width: 60px;
      height: 32px;
      border-radius: 4px;

      &.confirm {
        background-color: var(--color-primary);
        color: var(--color-white);
        border: none;
      }
    }
  }
}

</style>
