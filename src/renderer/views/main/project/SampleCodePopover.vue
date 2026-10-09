<template>
  <div class="popover-outside" @click.self="closePopover" v-show="dialogStorage.sampleCodeVisible">
    <el-popover placement="left" transition="none" :virtual-ref="sampleCodeReference" :teleported="false"
      :visible="dialogStorage.sampleCodeVisible" popper-class="sample-code-popover" :width="330" v-if="sampleCodeReference">
      <div>
        <div class="message-box further-development">
          <div class="message-header">
            <div class="title">{{ $t("sampleCodePopover.furtherDevelopment") }}</div>
          </div>
          <div class="message-body">
            <div class="title">{{ $t("sampleCodePopover.settingGet") }}</div>
            <i class="fs fs-clone" :title="$t('sampleCodePopover.clone')"  @click.prevent.stop="handleFurtherGetCodeCopy"></i>
            <code-mirror class="code-mirror" v-model="furtherGetCode" :lang="lang" 
            :basic="true" :extensions="extensions" :readonly="true" :editable="false"/>
          </div>
          <div class="message-body">
            <div class="title">{{ $t("sampleCodePopover.settingSet") }}</div>
            <i class="fs fs-clone" :title="$t('sampleCodePopover.clone')"  @click.prevent.stop="handleFurtherSetCodeCopy"></i>
            <code-mirror class="code-mirror" v-model="furtherSetCode" :lang="lang" 
            :basic="true" :extensions="extensions" :readonly="true" :editable="false"/>
          </div>
          <div class="message-body">
            <div class="title">{{ $t("sampleCodePopover.iframeSetCode") }}</div>
            <i class="fs fs-clone" :title="$t('sampleCodePopover.clone')"  @click.prevent.stop="handleiframeSetCodeCopy"></i>
            <code-mirror class="code-mirror" v-model="iframeSetCode" :lang="lang" 
            :basic="true" :extensions="extensions" :readonly="true" :editable="false"/>
          </div>
        </div>
      </div>
    </el-popover>
  </div>
</template>

<script lang="ts" setup>
import { inject, ref, watch } from 'vue';
import { ElMessage } from "element-plus";
import CodeMirror from "vue-codemirror6";
import { oneDark } from "@codemirror/theme-one-dark";
import { javascript } from "@codemirror/lang-javascript";
import { useClipboard } from "@vueuse/core";
import { useProjectDialogStore } from '@renderer/stores';
import { ACTIVE_ELEMENT, PROJECT_ID } from '@renderer/types';
import i18next from "i18next";

const extensions = [oneDark];
const lang = javascript();
const { copy } = useClipboard({legacy: true});
const sampleCodePaths = ref<string[]>();
const sampleCodeValue = ref<any>();
const sampleCodeReference = ref<HTMLElement>(null);

const projectId = inject(PROJECT_ID);
const activeElement = inject(ACTIVE_ELEMENT);

const projectDialogState = useProjectDialogStore();
const dialogStorage = projectDialogState.getStorage(projectId);

const furtherSetCode = ref('');
const furtherGetCode = ref('');
const iframeSetCode = ref('')
watch(()=>[sampleCodePaths.value, sampleCodeValue.value], ()=>{
  furtherSetCode.value = `this.element.setOption(
    ${JSON.stringify(sampleCodePaths.value)},
    ${JSON.stringify(sampleCodeValue.value)}
);`;
  furtherGetCode.value = `this.element.getOption(
    ${JSON.stringify(sampleCodePaths.value)}
);`;
  iframeSetCode.value = `const data = {
    action: 'setOption',
    data: {
        elementUID: ${JSON.stringify(activeElement.value.elementUID)},
        optionPaths: ${JSON.stringify(sampleCodePaths.value)},
        optionValue: ${JSON.stringify(sampleCodeValue.value)},
    }
};
iframe.contentWindow.postMessage(data, '*');`;
}, {immediate: true})

watch(() => activeElement.value?.uid, () => {
  closePopover()
})
const closePopover = ()=>{
  dialogStorage.hide('sampleCodeVisible')
}

const handleFurtherSetCodeCopy = async ()=>{
  await copy(furtherSetCode.value);
  ElMessage.success(i18next.t("sampleCodePopover.cloneSuccess"));
  closePopover()
}
const handleFurtherGetCodeCopy = async ()=>{
  await copy(furtherGetCode.value);
  ElMessage.success(i18next.t("sampleCodePopover.cloneSuccess"));
  closePopover()
}
const handleiframeSetCodeCopy = async ()=>{
  await copy(iframeSetCode.value);
  ElMessage.success(i18next.t("sampleCodePopover.cloneSuccess"));
  closePopover()
}

defineExpose({
  show: (_path: string[], _value: any, _reference: HTMLElement) => {
    sampleCodePaths.value = _path;
    sampleCodeValue.value = _value;
    sampleCodeReference.value = _reference;
    dialogStorage.show('sampleCodeVisible')
  }
})
</script>

<style lang="scss" scoped>
.popover-outside{
  position: fixed;
  top: 40px;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 99999;
}
.el-popper.sample-code-popover {
  padding: 0;
  background: var(--el-bg-color-overlay);
  .message-box{
    margin: 10px;
    position: relative;
    .message-header{
      position: relative;
      height: 30px;
      line-height: 30px;
      margin-bottom: 10px;
      .title{
        text-indent: 5px;
      }
    }
    .message-body{
      position: relative;
      box-shadow: 0px 0px 3px -2px;
      border-radius: 3px;
      border: 1px solid var(--border-color);
      line-height: 30px;
      text-indent: 10px;
      margin-bottom: 10px;
      user-select: all;
      .title{
        text-indent: 5px;
      }
      .fs {
        display: none;
        position: absolute;
        right: 6px;
        top: 0;
        font-size: 12px;
        cursor: var(--cursor-pointer);
      }
      .code-mirror {
        width: 100%;
        :deep(.cm-editor) {
          height: 100px;
        }
      }
      &:hover{
        .fs{
          display: block;
        }
      }
    }
  }
}
</style>