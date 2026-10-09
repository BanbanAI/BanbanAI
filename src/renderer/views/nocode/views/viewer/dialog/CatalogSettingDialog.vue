<template>
  <div class="catalog-setting-dialog">
    <el-dialog
      ref="ElDialogRef"
      :model-value="modelValue"
      :title="type === 'category' ? $t('CatalogSettingDialog.catalogSet') : $t('catalogSettingDialog.dialogHeader')"
      @update:model-value="emit('update:modelValue', $event)"
      top="30vh"
      destroy-on-close
      :close-on-click-modal="false"
      @open="dialogOpen"
      @closed="dialogDataReset"
      draggable align-center
    >
      <el-form
        ref="elFormRef"
        :model="settingForm"
        :rules="settingFormRules"
        label-position="top"
        label-width="auto"
        style="max-width: 600px"
      >

        <el-form-item :label="type === 'category' ? $t('CatalogSettingDialog.selectStructField') : $t('catalogSettingDialog.selectStructureField')" prop="catalogFieldUID">
          <el-select
            v-model="settingForm.catalogFieldUID"
            clearable
            filterable
            value-key="uid"
            :placeholder="$t('catalogSettingDialog.fieldPlaceHolder')"
          >
            <el-option v-for="item in catalogFieldList" :key="item.uid" :label="item.alias" :value="item.uid">
            </el-option>
          </el-select>
        </el-form-item>

        <div class="advanced-setting-row">
          <span class="label">{{ $t('catalogSettingDialog.advancedSetting') }}</span>
          <el-switch v-model="advancedSetting" />
        </div>

        <div class="advanced-setting-container" v-show="advancedSetting">
          <el-form-item
            :label="type === 'document' ? $t('catalogSettingDialog.selectCatalogTitleField') : $t('CatalogSettingDialog.selectTitleField')"
            prop="catalogTitleFieldUID"
          >
            <el-select
              v-model="settingForm.catalogTitleFieldUID"
              clearable
              filterable
              value-key="uid"
              :placeholder="$t('catalogSettingDialog.fieldPlaceHolder')"
            >
              <el-option v-for="item in catalogTitleFieldList" :key="item.uid" :label="item.alias" :value="item.uid">
              </el-option>
            </el-select>
          </el-form-item>

          <el-form-item 
            :label="$t('catalogSettingDialog.selectPageTitleField')"
            prop="titleFieldUID"
            v-if="type === 'document'"
          >
            <el-select
              v-model="settingForm.titleFieldUID"
              clearable
              filterable
              value-key="uid"
              :placeholder="$t('catalogSettingDialog.fieldPlaceHolder')"
            >
              <el-option v-for="item in titleFieldList" :key="item.uid" :label="item.alias" :value="item.uid">
              </el-option>
            </el-select>
          </el-form-item>
          
          <el-form-item 
            :label="$t('catalogSettingDialog.selectPageContentField')"
            prop="contentFieldUID"
            v-if="type === 'document'"
          >
            <el-select
              v-model="settingForm.contentFieldUID"
              clearable
              filterable
              value-key="uid"
              :placeholder="$t('catalogSettingDialog.fieldPlaceHolder')"
            >
              <el-option v-for="item in contentFieldList" :key="item.uid" :label="item.alias" :value="item.uid">
              </el-option>
            </el-select>
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="default" @click="handleCancel" :loading="btnLoading">
            {{ $t("catalogSettingDialog.cancelButton") }}
          </el-button>
          <el-button type="primary" @click="handleConfirm" :loading="btnLoading">
            {{ $t("catalogSettingDialog.confirmButton") }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>

</template>

<script lang='ts' setup>
import { ref, computed, shallowRef, inject } from 'vue';
import { ElDialog, ElForm, ElMessage, FormRules } from 'element-plus';
import { Field } from "@common/types/project";
import axios from 'axios';
import i18next from 'i18next';
import { CatalogViewSetting } from '@common/types/nocode';
import { NOCODE } from '@renderer/types';
import { useFormTable } from '@renderer/views/nocode/views/editor/form/hooks';
import { unique } from '@common/utils/unique';

const nocode = inject(NOCODE);
const table = useFormTable();

const props = defineProps<{
  modelValue: boolean,
  type: 'document' | 'category'
}>();

const emit = defineEmits(["closed", "created", "update:modelValue", "savaCatalogSetting"]);

const nocodeId = computed(() => nocode.value.meta.id);
const tableId = computed(() => table.value.uid);

const ElDialogRef = shallowRef<typeof ElDialog | null>(null);
const elFormRef = shallowRef<typeof ElForm | null>(null);
const settingForm = ref<CatalogViewSetting>({
  uid: '',
  name: '',
  type: 'category',
  catalogFieldUID: null,
  contentFieldUID: null
});
const settingFormRules = ref<FormRules<CatalogViewSetting | any>>({
  catalogFieldUID: [
    {
      validator: (rule, value, callback) => value
        ? callback()
        : callback(new Error(i18next.t('catalogSettingDialog.requiredMessage'))),
      trigger: 'change',
    }
  ]
})
const advancedSetting = ref<boolean>(false);

const catalogFieldList = ref<Field[]>([]);
const catalogTitleFieldList = ref<Field[]>([]);
const titleFieldList = ref<Field[]>([]);
const contentFieldList = ref<Field[]>([]);

const relatedTableId = computed<string>(() => catalogFieldList.value[0]?.meta.extra.relatedTableUID[1]);
async function getFieldList(tableId: string, subType: string[] | 'text' | 'html') {
  const resData = await axios.get(`/nocode/toc/tableFields/${nocodeId.value}/${tableId}`, {
    params: { subType }
  }).then(res => res.data).catch(({ response }) => {
    ElMessage.error(response.data.message);
  });
  return resData;
}
async function getStructureFieldList() {
  catalogFieldList.value = await getFieldList(tableId.value, ['related']);
}
async function getPageTitleFieldList() {
  titleFieldList.value = await getFieldList(tableId.value, 'text');
}
async function getPageContentFieldList() {
  contentFieldList.value = await getFieldList(tableId.value, 'html');
}
async function getCatalogTitleFieldList(tableId: string) {
  if(tableId)
    catalogTitleFieldList.value = await getFieldList(tableId, 'text');
}

function handleCancel(): void {
  emit('update:modelValue', false);
}

function handleConfirm(): void {
  elFormRef.value.validate(async (valid: boolean, fields: any) => {
    if (!valid) return;

    settingForm.value.type = props.type
    settingForm.value.name = props.type === 'category' ? i18next.t('CatalogSettingDialog.catalogView') : i18next.t('CatalogSettingDialog.docView')
    
    if(!settingForm.value.catalogTitleFieldUID || !advancedSetting){
      settingForm.value.catalogTitleFieldUID = catalogTitleFieldList.value?.[0]?.uid;
    }

    if((!settingForm.value.titleFieldUID || !advancedSetting)){
      settingForm.value.titleFieldUID = titleFieldList.value[0]?.uid;
    }

    if((!settingForm.value.contentFieldUID || !advancedSetting) && contentFieldList.value.length){
      settingForm.value.contentFieldUID = contentFieldList.value[0].uid;
    }
    
    settingForm.value.uid = unique();
    emit('savaCatalogSetting', settingForm.value);
  })
}

function dialogDataReset(): void {
  elFormRef.value.resetFields();
}

const btnLoading = ref(false);

async function dialogOpen(): Promise<void> {
  dialogDataReset();
  getPageTitleFieldList();
  getPageContentFieldList();
  await getStructureFieldList();
  getCatalogTitleFieldList(relatedTableId.value);
}
</script>
<style scoped lang='scss'>
.catalog-setting-dialog {
  position: absolute;

  .advanced-setting-row{
    margin-bottom: 8px;
    & > span.label{
      margin-right: 16px;
    }
  }

  .dialog-footer {
    padding-top: 24px;

    &::before {
      content: "";
      display: block;
      position: absolute;
      bottom: 64px;
      width: 100%;
      height: 1px;
      left: 0px;
      background-color: #D9D9D9;
    }
  }

  :deep(.el-dialog) {
    width: 360px;
    max-height: 70%;
    font-weight: 400;
    padding-top: 8px;
    background-color: white;

    .el-dialog__header {
      display: flex;
      justify-content: center;
      padding: 0px;
      margin-bottom: 32px;

      .el-dialog__title {
        font-size: 14px;
      }

      &::after {
        content: "";
        display: block;
        position: absolute;
        top: 40px;
        width: 100%;
        height: 1px;
        left: 0px;
        background-color: #D9D9D9;
      }
    }
  }

  :deep(.el-form){
    .el-form-item{
      margin-bottom: 8px;
    }
  }
  :deep(.el-select){
    .el-select__wrapper{
      background-color: #F5F6F7;
      border-radius: 4px;
      box-shadow: none;
      .el-select__suffix .el-select__icon{
        color: #373737;
      }
    }
  }
  :deep(.el-button){
    border: 1px solid #d0d0d0;
    border-radius: 4px;
    &.el-button--primary{
      border: none;
      background-color: #0873FF;
    }
  }
}
</style>
