<template>
  <div class="option-group-control">
    <code-mirror class="code-mirror" ref="codeMirrorRef" v-model="code" @changed="updateValue" :linter="jsonLinter"
      :lang="lang" :basic="true" :extensions="extensions" />
    <div class="resize-line" @mousedown="startResize"></div>
    <teleport to="body">
      <div class="resize-masks">
        <div class="mask" @mousemove.stop="handleResize" @mouseup="endResize" v-show="isResizing"></div>
      </div>
    </teleport>
  </div>
</template>
<script lang="ts">
export default {
  isBigContent: (args: any) => true,
};
</script>
<script lang="ts" setup>
import { GET_OPTION_VALUE, UPDATE_OPTION } from "../inject";
import { inject, ref, watch } from 'vue';
import { DefinedOptionWithParsedType } from '../types';
import CodeMirror from "vue-codemirror6";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import { ElMessage } from 'element-plus';
import i18next from 'i18next';

const props = defineProps<{
  option: DefinedOptionWithParsedType,
}>();
const getOptionValue = inject(GET_OPTION_VALUE);
const updateOption = inject(UPDATE_OPTION);

const extensions = [oneDark];
const lang = json();
const jsonLinter = jsonParseLinter()

const code = ref('{}');
watch(()=>getOptionValue(), (value)=>{
  code.value = JSON.stringify(value ?? {}, null, 2);
}, {immediate: true});
function updateValue() {
  try {
    let val = JSON.parse(code.value);
    code.value = JSON.stringify(val, null, 2);
    updateOption(val);
  } catch (err) {
    ElMessage.warning(i18next.t("optionJSONParsingError"));
  }
}

const codeMirrorRef = ref(null);
const isResizing = ref(false);
const height = ref(100);

let startClientY;
const startResize = (ev: MouseEvent) => {
  startClientY = ev.clientY;
  isResizing.value = true;
}

const handleResize = (ev: MouseEvent) => {
  if (!isResizing.value) {
    return;
  }
  let offset = ev.clientY - startClientY;
  height.value += Math.round(offset);
  startClientY = ev.clientY;
}

const endResize = () => {
  isResizing.value = false;
}
</script>

<style lang="scss" scoped>
.option-group-control {
  overflow: auto;
  height: v-bind("`${height}px`");
  width: 100%;
  &::-webkit-scrollbar {
    height: 5px;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 2.5px;
    background-color: #76767680;
  }

  .code-mirror {
    width: 100%;
    height: 100%;

    :deep(.cm-editor) {
      width: 100%;

      .cm-scroller{
        &::-webkit-scrollbar {
          height: 5px;
        }

        &::-webkit-scrollbar-thumb {
          border-radius: 2.5px;
          background-color: #76767680;
        }
      }
    }
    
  }

  .resize-line{
    width: 100%;
    height: 5px;
    border-bottom: 1px solid #76767680;
    cursor: s-resize;
    position: absolute;
    bottom: 0px;
  }
}
</style>