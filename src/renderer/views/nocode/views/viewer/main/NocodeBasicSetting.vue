<template>
  <div class="title">{{ $t('NocodeBasicSetting.basicSet') }}</div>
  <div class="icon-container">
    <span>{{ $t('NocodeBasicSetting.appIcon') }}</span>
    <div class="icon" :style="{ background: nocode?.body?.snapshot?.color }" v-if="nocode?.body?.snapshot">
      <el-icon :size="36">
        <component :is="nocode?.body?.snapshot?.icon" />
      </el-icon>
    </div>
    <el-image loading="lazy" :src="getCoverImageURL(nocodeId)" v-else>
      <template #error>
        <img src="@renderer/assets/image/report-default-cover.png" alt="">
      </template>
    </el-image>
    <div class="change-btn" @click="changeIcon">{{ $t('NocodeBasicSetting.edit') }}</div>
  </div> 
  <div class="name">
    <span>
      {{ $t('NocodeBasicSetting.appName') }}
    </span>
    <el-input
      v-model="editName"
      @keydown.enter="changeName(editName)"
      type="text"
      @blur="changeName(editName)"
      ref="inputNameRef"
    />
  </div>
  <!-- 暂时隐藏应用首页设置-后续给定制版使用 -->
  <div class="home-page-setting" v-if="false">
    <span>{{ $t('NocodeBasicSetting.homePage') }}</span>
    <el-switch v-model="homePageEnabled" @change="handleHomePageEnabledChange" />
    <el-select
      v-if="homePageEnabled"
      v-model="homePageNodeId"
      class="home-page-select"
      filterable
      :placeholder="$t('NocodeBasicSetting.homePagePlaceholder')"
      @change="handleHomePageNodeChange"
    >
      <el-option
        v-for="item in homePageCandidates"
        :key="item.id"
        :label="item.label"
        :value="item.id"
      />
    </el-select>
  </div>
  <div class="color" v-if="false">
    <span>{{ $t('NocodeBasicSetting.appThemeColor') }}</span>
    <el-radio-group>
      <el-radio :value="3">{{ $t('NocodeBasicSetting.black') }}</el-radio>
      <el-radio :value="6">{{ $t('NocodeBasicSetting.orange') }}</el-radio>
      <el-radio :value="9">{{ $t('NocodeBasicSetting.red') }}</el-radio>
    </el-radio-group>
  </div>
  <div class="title" v-if="false">
    {{ $t('NocodeBasicSetting.accessUrlSet') }}
  </div>
  <div class="adress-box" v-if="false">
    <p>{{ $t('NocodeBasicSetting.customAccessUrl') }}</p>
    <div class="adress">
      <input type="text" disabled value="https://banban.work">
      <p>{{ $t('NocodeBasicSetting.urlDesc') }}</p>
    </div>
    <input type="text" :placeholder="$t('NocodeBasicSetting.plsInput')">
    <el-icon>
      <i-ven-nocode-setting-basic-copy/>
    </el-icon>
    <el-icon>
      <i-ven-nocode-setting-basic-open/>
    </el-icon>
    <el-icon>
      <i-ven-nocode-setting-basic-share/>
    </el-icon> 
  </div>
  <hr>
  <div class="name basic-setting-switch">
    <span>
      {{ $t('NocodeBasicSetting.allowEditDataTable') }}
    </span>
    <br>
    <el-switch
      v-model="isEditTableCell"
      @change="saveNocodeTableEdit"
    />
  </div>
  <nocode-replace-img-dialog
    v-model="dialogState.nocodeReplaceImgDialogVisible"
    :nocode="dialogState.getArgs('nocodeReplaceImgDialogVisible')"
    :nocodeBody="nocode?.body"
    @updateNocodeCoverImage="updateNocodeCoverImage"
  />
</template>

<script setup lang="ts">
import { NOCODE, NOCODE_ID, NOCODE_SIGN_IS_LATEST } from '@renderer/types';
import { ElMessage } from 'element-plus';
import { computed, inject, ref, watch } from 'vue';
import { checkNocodeSyncBeforeRequest, handleNocodeSyncConflictError } from '@renderer/utils/nocodeSyncMessage';
import { useDialogStore } from '@renderer/stores';
import axios from "axios"
import i18next from 'i18next';
import { getAllForms, getAllPages, getNocodeHomePage } from '@common/utils';
import { NocodeHomePageSetting } from '@common/types/nocode';

const nocode = inject(NOCODE)
const nocodeId = inject(NOCODE_ID)
const homePageEnabled = ref(false);
const homePageNodeId = ref('');
const editName = ref("")
const inputNameRef = ref(null)
const dialogState = useDialogStore();
const nocodeSignIsLatest = inject(NOCODE_SIGN_IS_LATEST, null)

const homePageCandidates = computed(() => {
  const structure = nocode?.value?.body?.structure || [];
  return [
    ...getAllForms(structure).filter(item => getNocodeHomePage(structure, { enabled: true, nodeId: item.id })).map(item => ({
      ...item,
      label: `${item.name}（${i18next.t('NocodeHomePageSettingDialog.form')}）`,
    })),
    ...getAllPages(structure).filter(item => getNocodeHomePage(structure, { enabled: true, nodeId: item.id })).map(item => ({
      ...item,
      label: `${item.name}（${i18next.t('NocodeHomePageSettingDialog.board')}）`,
    })),
  ];
});

const isEditTableCell = computed({
  get: () => {
    return nocode?.value?.body?.isEditTableCell ?? true
  },
  set: (val) => {
    nocode.value.body.isEditTableCell = val
  }
})

const saveNocodeTableEdit = async (val) => {
  if (!checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return;
  const params = {
    nocodeId: nocodeId,
    isEditTableCell: val,
  }
  await axios.post("/project/save-nocode-table-edit", params, {
    headers: {
      'x-sign': nocode.value.body.sign,
    },
  }).then(({headers}) => {
    const mainSign = Array.isArray(headers?.['x-sign']) ? headers['x-sign'][0] : headers?.['x-sign'];
    if (mainSign) {
      nocode.value.body.sign = mainSign;
    }
  }).catch((error) => {
    handleNocodeSyncConflictError(error, nocodeSignIsLatest)
  });
}

watch(
  () => nocode?.value?.meta?.name,
  (newName) => {
    if (newName !== undefined) {
      editName.value = newName
    }
  },
  { immediate: true }
)

watch(
  () => nocode?.value?.body?.settings?.homePage,
  (homePage) => {
    homePageEnabled.value = Boolean(homePage?.enabled);
    homePageNodeId.value = homePage?.nodeId || '';
  },
  { immediate: true, deep: true },
)

const emit = defineEmits<{
  (event: 'update');
}>();

const saveBasicSetting = async (payload: { name: string }) => {
  const result = await axios.post("/project/save-nocode-basic-setting", {
    nocodeId,
    name: payload.name,
  }).catch(err => {
    console.log(err);
    return null;
  });

  if (result?.data) {
    nocode.value.meta.name = result.data.name;
    editName.value = nocode.value.meta.name;
    ElMessage.success(i18next.t('NocodeBasicSetting.editSuccess'))
    emit('update')
    return true;
  }

  ElMessage.warning(i18next.t('NocodeBasicSetting.editFail'))
  editName.value = nocode?.value?.meta?.name
  return false;
}

const changeName = async (name) => {
  if(name === nocode?.value?.meta?.name) {
    inputNameRef.value.blur()
    return
  }
  if(!name) {
    ElMessage.warning(i18next.t('NocodeBasicSetting.nameNotEmpty'))
    editName.value = nocode?.value?.meta?.name
    return
  }
  const success = await saveBasicSetting({
    name,
  });
  if (success) {
    inputNameRef.value.blur()
  }
}

const changeIcon = () => {
  dialogState.show('nocodeReplaceImgDialogVisible', nocode.value.meta);
}

const saveHomePageSetting = async (homePage: NocodeHomePageSetting) => {
  if (!nocode?.value || !checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return false;

  const settings = {
    ...nocode.value.body.settings,
    homePage,
  };

  try {
    const { headers } = await axios.post('/project/save-nocode-settings', {
      nocodeId,
      settings,
    }, {
      headers: {
        'x-sign': nocode.value.body.sign,
      },
    });
    const mainSign = Array.isArray(headers?.['x-sign']) ? headers['x-sign'][0] : headers?.['x-sign'];
    if (mainSign) {
      nocode.value.body.sign = mainSign;
    }
    nocode.value.body.settings = settings;
    emit('update');
    return true;
  } catch (error) {
    if (!handleNocodeSyncConflictError(error, nocodeSignIsLatest)) {
      ElMessage.error(error?.response?.data?.message || error?.message);
    }
    return false;
  }
};

const handleHomePageEnabledChange = async (enabled: boolean) => {
  if (enabled) return;
  const saved = await saveHomePageSetting({ enabled: false });
  if (!saved) {
    homePageEnabled.value = true;
  } else {
    homePageNodeId.value = '';
  }
};

const handleHomePageNodeChange = async (nodeId: string) => {
  const saved = await saveHomePageSetting({ enabled: true, nodeId });
  if (!saved) {
    homePageNodeId.value = nocode?.value?.body?.settings?.homePage?.nodeId || '';
  }
};

const updateNocodeCoverImage = () => {
  emit('update')
}

const getCoverImageURL = (nocodeId: string) => {
  return `project/get-nocode-snapshot/${nocodeId}`;
};
</script>

<style scoped lang="scss">
:deep(.el-input) {
  background-color: var(--bg-color-overlay);
  
  font-weight: 400;
  
  font-size: 14px;
  line-height: 20px;
  letter-spacing: 0%;
  width: 406px;
  border-radius: 4px;
  overflow: hidden;

  .el-input__wrapper {
    box-shadow: unset;
    height: 32px;
    background-color: var(--bg-color-overlay);
  }
}

span {
  font-weight: 400;
  font-size: 14px;
  line-height: 20px;
  letter-spacing: 0%;
  width: 96px;
  display: inline-block;
  margin-right: 32px;
  color: var(--text-color-regular);
  text-wrap: nowrap;
}

hr {
  margin: 24px 0px;
  border: none;
  border-top: 1px solid var(--border-color);
}

.title {
  
  font-weight: 400;
  
  font-size: 14px;
  line-height: 20px;
  letter-spacing: 0%;
  margin-bottom: 16px;
  color: var(--text-color-primary);
}

.icon-container {
  height: 48px;
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  
  :deep(img) {
    width: 48px;
    height: 48px;
    margin-right: 12px;
    border-radius: 8px;
  }

  .change-btn {
    cursor: pointer;
    color: var(--color-primary);
    transition: all 0.3s ease;

    &:hover {
      opacity: 0.6;
    }
  }

  .icon {
    min-width: 24px;
    width: 48px;
    height: 48px;
    border-radius: 8px;
    display: flex;
    justify-content: center;
    align-items: center;
    margin-right: 12px;

    .el-icon {
      color: var(--color-white)
    }
  }
}

.name {
  height: 32px;
  margin-bottom: 16px;

  input {
    width: 406px;
  }
  
  &.basic-setting-switch {
    height: fit-content;
  }
}

.home-page-setting {
  display: flex;
  align-items: center;
  min-height: 32px;
  margin-bottom: 16px;

  .home-page-select {
    width: 406px;
    margin-left: 16px;

    :deep(.el-select__wrapper) {
      min-height: 32px;
      background-color: var(--bg-color-overlay);
      box-shadow: unset;
      border-radius: 4px;
    }
  }
}

.description {
  display: flex;
  align-items: flex-start;
  margin-bottom: 16px;

  :deep(.el-textarea) {
    width: 406px;
  }

  :deep(.el-textarea__inner) {
    min-height: 76px !important;
    resize: none;
    background-color: var(--bg-color-overlay);
    box-shadow: unset;
  }
}

.color  {
  height: 32px;
  margin-bottom: 16px;
}

.adress-box {
  display: flex; 

  .el-icon {
    width: 32px;
    height: 32px;
    font-size: 16px;
    color: var(--text-color-primary);
    cursor: pointer;
    transition: all 0.3s ease;
    border-radius: 4px;
    color: var(--text-color-regular);

    &:hover {
      background-color: var(--bg-color-overlay);
    }
  }

  input {
    margin-right: 8px;
  }
}

p {
  
  font-weight: 400;
  
  font-size: 14px;
  line-height: 20px;
  letter-spacing: 0%;
  margin-right: 32px;
  color: var(--text-color-regular);
}

.adress {
  p {
     
    font-weight: 400;
    
    font-size: 12px;
    line-height: 16px;
    letter-spacing: 0%;
    margin-top: 8px;
    color: var(--text-color-placeholder);
  }

  input {
    cursor: not-allowed;
    color: var(--text-color-placeholder);
  }
}
</style>
