<template>
  <div class="create-info-dialog">
    <el-dialog 
      v-model="dialogState.NocodeCreationInfoDialogVisible"
      width="360"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :align-center="true"
      :show-close="!props.submitting"
      :title="$t('NocodeCreateInfoDialog.createBlankApp')"
      @open="handleOpen"
      @close="handleClose"
      destroy-on-close
    >
      <div class="name-container">
        <div class="name">
          {{ $t('NocodeCreateInfoDialog.nameLabel') }}
        </div>
        <el-input v-model="createName" :placeholder="$t('NocodeCreateInfoDialog.myLowCodeApp')"></el-input>
      </div>
      <div class="description-container">
        <div class="name">
          {{ $t('NocodeCreateInfoDialog.descriptionLabel') }}
        </div>
        <el-input
          v-model="createDescription"
          type="textarea"
          :autosize="{ minRows: 3, maxRows: 5 }"
          :placeholder="$t('NocodeCreateInfoDialog.descriptionPlaceholder')"
        ></el-input>
      </div>
      <div class="group-container" v-if="groupsData?.length > 1">
        <div class="name">
          {{ $t('NocodeCreateInfoDialog.group') }}{{ getI18nLabelColon() }}
        </div>
        <el-select v-model="importGroupId" :placeholder="$t('NocodeCreateInfoDialog.group')">
          <el-option
            v-for="group in groupsData"
            :key="group.id"
            :label="group.name"
            :value="group.id"
          />
        </el-select>
      </div>
      <div class="icon-container">
        <div class="name">
          {{ $t('NocodeCreateInfoDialog.iconLabel') }}
        </div>
        <el-popover
          class="box-item"
          placement="top-start"
          :show-arrow="false"
          :teleported="false"
          append-to=".icon-container"
          :width="326"
          popper-style="background-color: var(--color-white)"
          trigger="click"
        >
          <template #reference>
            <div class="image-wrapper">
              <div class="icon-wrapper">
                <div class="icon" :style="{ background: nocodeImgCoreRef?.systemIcon.color }" v-if="nocodeImgCoreRef?.isShowIcon">
                  <el-icon :size="36" color="#fff">
                    <component :is="nocodeImgCoreRef?.systemIcon.icon" />
                  </el-icon>
                </div>
                <el-image fit="fill" loading="lazy" style="width: 100%; height: 100%;" :src="nocodeImgCoreRef?.coverImageURL" v-else>
                  <template #error>
                    <div class="default-cover"></div>
                  </template>
                </el-image>
              </div>
              <div class="overlay">
                <el-icon size="30">
                  <i-ven-edit-state/>
                </el-icon>
              </div>
            </div>
          </template>
          <nocode-img-core ref="nocodeImgCoreRef"></nocode-img-core>
        </el-popover>
      </div>
      <template #footer>
        <el-button class="cancel-btn" :disabled="props.submitting" @click="handleCancel">{{ $t('NocodeCreateInfoDialog.cancel') }}</el-button>
        <el-button type="primary" class="save-btn" :loading="props.submitting" :disabled="props.submitting" @click="handleConfirm">{{ $t('NocodeCreateInfoDialog.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang='ts'>
import { ref, watch } from 'vue';
import axios from 'axios';
import { unique } from '@common/utils/unique';
import { ElMessage } from 'element-plus';
import i18next from 'i18next';
import { useDialogStore } from '@renderer/stores';
import { getI18nLabelColon } from '@common/utils/i18n';

const props = withDefaults(defineProps<{
  submitting?: boolean;
}>(), {
  submitting: false,
});

const emit = defineEmits<{
  (event: "create", name: string, description: string, formData: FormData, groupId: string);
}>();

const visible = ref(false);
const nocodeImgCoreRef = ref(null)
const createName = ref('')
const createDescription = ref('')
const dialogState = useDialogStore();

const importGroupId = ref()
const groupsData = ref([])
const ungroupedApp = ref()
const getGroupsData = async () => {
  await axios.get("/project/get-all-nocode-groups").then(({ data }) => {
    // 添加未分组应用项
    ungroupedApp.value = {
      id: unique(),
      name: i18next.t('NocodeCreateInfoDialog.ungrouped'),
      isUngrouped: true,
    }
    data.push(ungroupedApp.value)
    groupsData.value = data;
    importGroupId.value = ungroupedApp.value?.id
  }).catch(({ response }) => {
    ElMessage.error(response.data.message);
    return [];
  });
};

const handleConfirm = async () => {
  if (props.submitting) return;
  const form = await nocodeImgCoreRef.value?.getFormData() 

  emit(
    'create',
    createName.value || i18next.t('NocodeCreateInfoDialog.myLowCodeApp'),
    createDescription.value,
    form,
    importGroupId.value,
  )
  //获取图片的信息

}
const handleCancel = () => {
  if (props.submitting) return;
  visible.value = false
  dialogState.hide('NocodeCreationInfoDialogVisible');
  createName.value = ''
  createDescription.value = ''
}

const handleOpen = () => {
  getGroupsData()
}

const handleClose = () => {
  importGroupId.value = ungroupedApp.value?.id
  createName.value = ''
  createDescription.value = ''
}

watch(() => visible.value, () => {
  nocodeImgCoreRef.value?.closeClear()
});

defineExpose({
  show: () => {
    visible.value = true;
    dialogState.show('NocodeCreationInfoDialogVisible');
  },
  hide: () => {
    visible.value = false;
    dialogState.hide('NocodeCreationInfoDialogVisible');
  }
})
</script>

<style scoped lang='scss'>
:deep(.el-dialog) {
  background-color: var(--bg-color-page);
  border-radius: 8px;
  padding: 0;

  .el-dialog__header {
    display: flex;
    padding: 12px 20px;
    border-bottom: 1px solid #E5E6EB;
    justify-content: center;
  }

  .el-dialog__body {
    display: flex;
    flex-direction: column;
    padding: 20px 24px;
    gap: 16px;

    .name-container {
      .name {
        margin-bottom: 8px;
      }

      .el-input__wrapper {
        border-radius: 4px;
        box-shadow: unset;
        background-color: var(--bg-color-overlay);

        &:hover {
          box-shadow: unset;
        }
      }
    }

    .description-container {
      .name {
        margin-bottom: 8px;
      }

      :deep(.el-textarea__inner) {
        border-radius: 4px;
        box-shadow: unset;
        background-color: var(--bg-color-overlay);
        resize: none;
        min-height: 76px !important;

        &:hover {
          box-shadow: unset;
        }
      }
    }

    .group-container {
      .name {
        margin-bottom: 8px;
      }

      .el-select__wrapper {
        border-radius: 4px;
        box-shadow: unset;
        background-color: var(--bg-color-overlay);

        &:hover {
          box-shadow: unset;
        }
      }
    }

    .icon-container {
      .name {
        margin-bottom: 8px;
      }

      .image-wrapper {
        position: relative;
        width: 48px;
        height: 48px;
        border-radius: 8px;
        overflow: hidden;

        img {
          width: 48px;
          height: 48px;
          cursor: pointer;
        }

        .icon-wrapper {
          width: 48px;
          height: 48px;
          cursor: pointer;

          .icon {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100%;
          }

          .default-cover {
            width: 100%;
            height: 100%;
            background: url(@renderer/assets/image/report-default-cover.png) center / cover no-repeat !important;

          }
        }

        .overlay {
          position: absolute;
          display: flex;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          background-color: var(--bg-color-overlay);
          transition: all 0.3s ease;
          opacity: 0;
          justify-content: center;
          align-items: center;
        }

        &:hover {
          .overlay {
            opacity: 0.5;
          }
        }
      }
    }
  }

  .el-dialog__footer {
    padding: 16px;
    border-top: 1px solid #E5E6EB;

    .el-button {
      border-radius: 4px;
    }
  }
}
</style>
