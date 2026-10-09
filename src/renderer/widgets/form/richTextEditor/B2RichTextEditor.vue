<template>
  <b2-form-element>
    <!-- 单元格编辑 -->
    <template v-if="widget.isInSubForm && !isMobileDevice">
      <!-- <div class="table-trigger" v-if="!isConfirmed" @click="handleOpenTableDialog"> -->
      <div class="table-trigger" @click="handleOpenTableDialog">
        <div class="trigger-content" v-if="widget.inputValue && widget.inputValue !== '<p><br></p>'" v-html="widget.inputValue"></div>
        <div class="trigger-placeholder" v-else>{{ $t('clickToEdit') }}</div>
      </div>

      <el-dialog
        v-model="tableDialogVisible"
        :title="$t('richText')"
        width="900px"
        align-center
        append-to-body
        class="rich-text-dialog"
        :close-on-click-modal="false"
        destroy-on-close
        @opened="handleDialogOpened"
      >
        <div class="dialog-editor-wrapper">
          <Toolbar class="toolbar" :editor="dialogEditorRef" :defaultConfig="toolbarConfig" />
          <Editor
            class="editor"
            style="height: 350px; overflow-y: hidden;"
            v-model="dialogInputValue"
            :defaultConfig="dialogEditorConfig"
            @onCreated="handleDialogEditorCreated"
          />
        </div>
        <template #footer>
          <div class="dialog-footer">
            <el-button @click="handleCloseTableDialog">{{ $t('cancel') }}</el-button>
            <el-button type="primary" @click="handleConfirmTableDialog">{{ $t('confirm') }}</el-button>
          </div>
        </template>
      </el-dialog>
    </template>

    <!-- 普通编辑 -->
    <template v-else>
    <div v-if="!widget.isReadonly" class="rich-text-editor" :class="{ 'mobile': isMobileDevice }" ref="richTextEditorRef" @mousedown.stop="" @keydown="handleKeyDown">
      <template v-if="isMobileDevice">
        <div class="editor-text-container" @click="isDrawerVisible = true">
          <Editor
            class="editor-text"
            v-if="widget.inputValue"
            v-model="widget.inputValue"
            :defaultConfig="{readOnly: true}"
          />
          <div class="editor-text-placeholder" v-else style="color: var(--text-color-inactive);">{{ i18next.t('noContent') }}</div>
        </div>
        <mobile-rich-text-editor-drawer
          v-model="isDrawerVisible"
          :widget="widget"
          :editorConfig="editorConfig"
          :toolbarConfig="toolbarConfig"
          @close="handleDrawerClose"
          @change="handleDrawerChange"
          @editorCreated="handleCreated"
          />
      </template>
      <template v-else>
        <Toolbar class="toolbar" :editor="editorRef" :defaultConfig="toolbarConfig" />
        <Editor
          class="editor"
          :style="{'height': isMobileDevice ? 'auto' : `${widget.editorHeight}px`}"
          v-model="widget.inputValue"
          :defaultConfig="editorConfig"
          @onCreated="handleCreated"
          @vue:unmounted="editorRef = null" />
      </template>
    </div>
    <div v-else class="html-container" :class="{ 'mobile': isMobileDevice }">
      <Editor
        class="editor"
        :style="{'height': isMobileDevice ? 'auto' : `${widget.editorHeight}px`}"
        v-if="widget.inputValue"
        v-model="widget.inputValue"
        :defaultConfig="{readOnly: true}"
      />
      <div v-else class="editor-placeholder" style="color: var(--text-color-inactive);">{{ i18next.t('noContent') }}</div>
    </div>
    </template>
  </b2-form-element>
</template>

<script lang="ts" setup>
import "@wangeditor-next/editor/dist/css/style.css";
import { isMobile } from "@renderer/utils/pure";
import { useWidget } from "@renderer/b2/types";
import { ref, onBeforeUnmount, shallowRef, inject, nextTick, watch, onMounted } from "vue";
import { RichTextEditor } from "./richTextEditor";
import { Editor, Toolbar } from "@wangeditor-next/editor-for-vue";
import { IEditorConfig, IToolbarConfig } from "@wangeditor-next/editor";
import axios from "axios";
import MobileRichTextEditorDrawer from "./MobileRichTextEditorDrawer.vue";
import i18next, { $t } from "@renderer/widgets/i18next";

const isMobileDevice = isMobile();

const widget = useWidget<RichTextEditor>();
const richTextEditorRef = shallowRef<HTMLElement>();
const editorRef = shallowRef();
const isDrawerVisible = ref(false);

const tableDialogVisible = ref(false);
const dialogInputValue = ref("");
const dialogEditorRef = shallowRef();
// const isConfirmed = ref(false);

const handleOpenTableDialog = () => {
  if (widget.isReadonly) return;
  dialogInputValue.value = widget.inputValue;
  // isConfirmed.value = false;
  tableDialogVisible.value = true;
};

const handleCloseTableDialog = () => {
  tableDialogVisible.value = false;
  dialogEditorRef.value = null;
};

const handleConfirmTableDialog = () => {
  widget.inputValue = dialogInputValue.value;
  widget.validate();
  // isConfirmed.value = true;
  tableDialogVisible.value = false;
};

const handleDialogEditorCreated = (editor) => {
  dialogEditorRef.value = editor;
};

const handleDialogOpened = () => {
  nextTick(() => dialogEditorRef.value?.focus(true));
}

const toolbarConfig: Partial<IToolbarConfig> = {
  excludeKeys: [
    "emotion",
    "fullScreen",
  ],
};

const editorConfig: Partial<IEditorConfig> = {
  autoFocus: isMobileDevice,
  MENU_CONF: {
    insertImage: {
      onInsertedImage(imageNode) {
        if (imageNode == null) return;
      },
    },
    uploadImage: {
      metaWithUrl: false,
      base64LimitSize: 0,
      server: "/uploader/uploadFile",
      async customUpload(file: File, insertFn) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("filename", file.name);
        formData.append("projectId", widget.getBoard().projectId);
        formData.append("nocodeId", widget.getBoard().nocodeId || "");
        let res = await axios.post("/uploader/uploadFile", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        insertFn(res.data.url || "", "", "");
      },
      customInsert(res, insertFn) {
        insertFn(res.data.url, "", "");
      },
      // 上传进度的回调函数
      onProgress(progress: number) {},
      onSuccess(file, res: any) {},
      onFailed(file, res: any) {},
      onError(file, err: any, res: any) {},
    },
    // 上传视频配置
    uploadVideo: {
      metaWithUrl: false,
      server: "/uploader/uploadFile",
      async customUpload(file: File, insertFn) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("filename", file.name);
        formData.append("projectId", widget.getBoard().projectId);
        formData.append("nocodeId", widget.getBoard().nocodeId || "");
        let res = await axios.post("/uploader/uploadFile", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        insertFn(res.data.url || "", "", "");
      },
      customInsert(res, insertFn) {
        insertFn(res.data.url, "", "");
      },
      onProgress(progress: number) {},
      onSuccess(file, res: any) {},
      onFailed(file, res: any) {},
      onError(file, err: any, res: any) {},
    },
  },
};

const dialogEditorConfig: Partial<IEditorConfig> = {
  ...editorConfig,
  autoFocus: true,
};

const handleCreated = (editor) => {
  editorRef.value = editor;
};
const noEventsArr = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
const handleKeyDown = (event: KeyboardEvent)=>{
  if (noEventsArr.includes(event.key)) {
    event.stopPropagation();
  }
};

const handleDrawerClose = () => {
  isDrawerVisible.value = false;
}

const handleDrawerChange = () => {
  widget.validate();
}

watch(()=> widget.inputValue, () => {
  widget.validate();
})

// 组件销毁时，也及时销毁编辑器
onBeforeUnmount(() => {
  editorRef.value?.destroy();
  dialogEditorRef.value?.destroy();
});

onMounted(() => {
  if (widget.isInSubForm && !widget.isReadonly) {
    handleOpenTableDialog();
  }
});
</script>

<style lang="scss" scoped>
// 单元格编辑
.table-trigger {
  min-height: 32px;
  max-height: var(--table-row-height, 32px);
  padding: 4px 11px;
  border: 1px solid var(--border-color, #dcdfe6);
  border-radius: 4px;
  cursor: pointer;
  background-color: var(--color-white);
  transition: border-color 0.2s;
  overflow-y: scroll;

  &:hover {
    border-color: var(--primary-color, #409eff);
  }

  .trigger-content {
    font-size: 14px;
    line-height: 22px;

    :deep(*) {
      margin: 0;
      padding: 0;
    }
  }

  .trigger-placeholder {
    color: var(--text-color-inactive, #a8abb2);
    font-size: 14px;
  }
}

.dialog-editor-wrapper {
  border: 1px solid var(--border-color, #dcdfe6);
  border-radius: 4px;
  display: flex;
  flex-direction: column;

  .toolbar {
    border-bottom: 1px solid var(--border-color, #dcdfe6);
  }
}

// 普通编辑
.rich-text-editor {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  overflow: hidden;
  .toolbar {
    border-bottom: 1px solid var(--border-color);
  }
  .editor {
    overflow-y: hidden;
  }

  &.mobile {
    .editor-text {
      border-radius: 4px;
      font-size: 14px;
      line-height: 1.25;
      min-height: 120px;
      max-height: 500px;
      padding: 8px;
      overflow-y: auto;
      :deep(.w-e-text-container) {
        p { margin: 10px 0; }
      }
    }

    .editor-text-placeholder {
      height: 120px;
      border-radius: 4px;
      padding: 8px;
    }

  }
}

:deep(.toolbar .w-e-bar-item),
:deep(.toolbar .w-e-bar-item-group),
:deep(.toolbar .w-e-select) {
  flex-shrink: 0;
}

:deep(.w-e-text-container [data-slate-editor]) {
  overflow-wrap: anywhere;
  word-break: break-word;
}

:deep(.w-e-text-container) {
  h1 { font-size: 2em; }
  h2 { font-size: 1.5em; }
  h3 { font-size: 1.17em; }
  h4 { font-size: 1em; }
  h5 { font-size: 0.83em; }
  h6 { font-size: 0.67em; }
}

.html-container {
  overflow-y: auto;
  line-height: 1.5;
  border: 1px solid var(--border-color);
  border-radius: 2px;
  .editor-placeholder {
    padding: 8px;
  }

  &.mobile {
    padding: 8px;
    border-radius: 4px;
    min-height: 120px;
    max-height: 500px;
    .editor-placeholder {
      height: 120px;
    }
  }
}
</style>
