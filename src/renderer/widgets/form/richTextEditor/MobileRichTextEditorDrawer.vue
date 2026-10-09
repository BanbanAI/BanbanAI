<template>
  <el-drawer
    class="mobile-rich-text-editor-drawer"
    :model-value="modelValue"
    direction="btt"
    size="335"
    destroy-on-close
    append-to-body
    :show-close="false"
    close-on-click-modal
    @close="handleClose"
    @opened="handleOpened"
  >
    <template #header>
      <span class="header-title" v-if="widget.title">{{ widget.title }}</span>
    </template>
    <Toolbar class="toolbar" :editor="editorRef" :defaultConfig="toolbarConfig" />
    <div class="editor-container">
      <Editor
        class="editor"
        v-model="text"
        :defaultConfig="editorConfig"
        @onCreated="handleCreated" />
    </div>
    </el-drawer>
</template>

<script lang="ts" setup>
import { ref, watch, shallowRef, ShallowRef } from "vue";
import { RichTextEditor } from "./richTextEditor";
import { Editor, Toolbar } from "@wangeditor-next/editor-for-vue";

const props = defineProps<{
  modelValue: boolean,
  widget: RichTextEditor,
  editorConfig: any,
  toolbarConfig: any
}>();

const text = ref(props.widget.inputValue);

const editorRef = shallowRef();

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void;
  (event: "close", value: string): void;
  (event: "editorCreated", editor: ShallowRef): void;
  (event: "change", value: string): void;
}>();

const handleCreated = async (editor) => {
  text.value = props.widget.inputValue;
  editorRef.value = editor;
  emit('editorCreated', editor);
}

const handleOpened = () => {
  editorRef.value?.focus(true);
}

const handleClose = () => {
  props.widget.inputValue = text.value;
  emit("close", text.value);
  emit("update:modelValue", false);
}

watch(()=> text.value, (newValue) => {
  emit("change", newValue);
})
</script>

<style lang="scss">
.el-drawer.mobile-rich-text-editor-drawer {
  max-height: 100%;

  .el-drawer__header {
    margin: 0;
    padding: 16px;
    padding-bottom: 8px;
    font-size: 16px;
  }

  .el-drawer__body {
    margin: 0 12px;
    padding: 0;
    overflow-x: auto;

    &::-webkit-scrollbar {
      display: none;
    }
    scrollbar-width: none;
    -ms-overflow-style: none;

    .editor-container {
      position: fixed;
      width: 100%;
      bottom: 0;
      left: 0;
      padding: 12px;
    }

    .editor {
      display: flex;
      flex-direction: column;
      border-radius: 6px;
      overflow: hidden;

      .w-e-text-container {
        height: 240px;
        font-size: 1.25em;
        p {
          margin: 10px 0;
        }
      }
    }

    .toolbar {

      .w-e-toolbar {
        display: flex;
        flex-wrap: nowrap;
        background: none;
        padding: 0;
        gap: 8px;

        > * {
          max-height: 100%;
          padding: 0;
        }

        .w-e-bar-divider {
          display: none;
        }

        .w-e-select-list {
          max-height: 250px;
          li {
            padding-top: 5px;
            padding-bottom: 5px;
          }
        }
      }
    }

  }
}
</style>
