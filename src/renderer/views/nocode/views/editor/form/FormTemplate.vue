<template>
  <div class="form-item">
    <!-- 表单数字输入框 -->
    <template v-if="type === 'widget.form.numberInput'">
      <el-input type="number" :readonly="isReadonly" :class="{readonly: isReadonly}"></el-input>
    </template>

    <!-- 表单文本输入框 -->
    <template v-if="type === 'widget.form.textInput'">
      <el-input type="text" :readonly="isReadonly" :class="{readonly: isReadonly}"></el-input>
    </template>

    <!-- 多行输入框组件 -->
    <template v-if="type === 'widget.form.textarea'">
      <el-input :readonly="isReadonly" :class="{readonly: isReadonly}"
      style="width: 240px" :rows="5" type="textarea" placeholder="" />
    </template>

    <!-- 表单下拉菜单 -->
    <template v-if="type === 'widget.form.treeSelect'">
      <el-select class="property-box-select" placeholder="" 
      :readonly="isReadonly" :class="{readonly: isReadonly}">
        <el-option :label="$t('formTemplate.keepOriginal')" value="keep"></el-option>
        <el-option :label="$t('formTemplate.emptyValue')" value="noValue"></el-option>
        <el-option :label="$t('formTemplate.alwaysRecalculate')" value="computed"></el-option>
      </el-select>
    </template>

    <!-- 表单开关 -->
    <template v-if="type === 'widget.form.switch'">
      <el-switch :readonly="isReadonly" :class="{ readonly: isReadonly }" />
    </template>

    <!-- 表单单选框 -->
    <template v-if="type === 'widget.form.radioGroup'">
      <el-radio-group :readonly="isReadonly" :class="{ readonly: isReadonly }">
        <el-radio :value="3">Option A</el-radio>
        <el-radio :value="6">Option B</el-radio>
        <el-radio :value="9">Option C</el-radio>
      </el-radio-group>
    </template>

    <!-- 表单多选框 -->
    <template v-if="type === 'widget.form.checkboxGroup'">
      <el-checkbox-group :readonly="isReadonly" :class="{ readonly: isReadonly }">
        <el-checkbox :value="$t('FormTemplate.option1')" name="type">
          {{ $t('FormTemplate.option1') }}
        </el-checkbox>
        <el-checkbox :value="$t('FormTemplate.option2')" name="type">
          {{ $t('FormTemplate.option2') }}
        </el-checkbox>
        <el-checkbox :value="$t('FormTemplate.option3')" name="type">
          {{ $t('FormTemplate.option3') }}
        </el-checkbox>
      </el-checkbox-group>
    </template>

    <!-- 表单时间选择器 -->
    <template v-if="type === 'widget.form.datePicker'">
      <el-date-picker :readonly="isReadonly" :class="{ readonly: isReadonly }" type="datetime"
        placeholder="" />
    </template>

    <!-- 表单上传组件 -->
    <template v-if="type === 'widget.form.uploader'">
      <el-upload :readonly="isReadonly" :class="{ readonly: isReadonly }" class="avatar-uploader"
        action="https://run.mocky.io/v3/9d059bf9-4660-45f2-925d-ce80ad6c4d15" :show-file-list="false">
        <el-icon class="avatar-uploader-icon"><i-ep-plus /></el-icon>
      </el-upload>
    </template>

    <!-- 表单隐藏域 -->
    <template v-if="type === 'widget.form.hidden-input'">

    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  value?: any,
  type: string,
  visible?: boolean,
  isReadonly?: boolean,
}>();
</script>

<style scoped lang='scss'>
.form-item {
  padding: 0 20px 0 0;
  width: 100%;

  .readonly {
    pointer-events: none;
  }

  :deep(.el-textarea) {

    textarea {
      resize: none !important;
    }
  }

  :deep(.el-date-editor) {
    .el-input__wrapper {
      pointer-events: none !important;
    }
  }

  .el-icon.avatar-uploader-icon {
    font-size: 28px;
    color: #8c939d;
    width: 178px;
    height: 178px;
    text-align: center;
  }

  .avatar-uploader {
    width: 185px;
    border: 1px solid #666 !important;
    border-radius: 4px;
  }
}
</style>