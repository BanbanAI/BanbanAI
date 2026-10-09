<template>
  <div class="auto-counting-container">
    <el-dialog
      :class="{'fullscreen': isFullscreen}"
      :modelValue="isVisible"
      @update:modelValue="emit('update:modelValue', $event)"
      @open="onOpen"
      :title="$t('ShowDescriptionDialog.descInfoSetting')"
      :align-center="true"
      destroy-on-close
      :close-on-click-modal="false"
      :width="1008"
      :show-close="false"
      :fullscreen="isFullscreen"
      ref="dialogRef"
    >
      <template #header>
        <div class="title">{{ $t('ShowDescriptionDialog.descInfoSetting') }}</div>
        <div class="menus">
          <el-button link v-show="!isFullscreen" @click="isFullscreen = !isFullscreen">
            <el-icon :size="16"><i-ep-full-screen/></el-icon>
          </el-button>
          <el-button link v-show="isFullscreen" @click="isFullscreen = !isFullscreen">
            <el-icon :size="16"><i-nocode-shrink-screen/></el-icon>
          </el-button>
          <el-button link @click="dialogClosed">
            <el-icon :size="16"><i-ep-close/></el-icon>
          </el-button>
        </div>
      </template>
      <div class="container" ref="richTextEditorRef">
        <Toolbar class="toolbar" :editor="editorRef" :defaultConfig="toolbarConfig" mode="default" />
        <div class="wrap-editor">
          <Editor
            class="editor"
            :defaultConfig="editorConfig"
            mode="default"
            @dblclick="handleEditorDblclick"
            @onCreated="handleCreated"
          />
        </div>
      </div>
      <template #footer>
        <div class="footer">
          <el-button class="cancel" type="default" @click="dialogClosed">{{ $t('ShowDescriptionDialog.cancel') }}</el-button>
          <el-button class="confirm" type="primary" @click="confirm">{{ $t('ShowDescriptionDialog.confirm') }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import "@wangeditor-next/editor/dist/css/style.css";
import { ref, computed, onBeforeUnmount, shallowRef, nextTick, onMounted } from "vue";
import { FormElement } from '@renderer/b2/controllers/form';
import { Editor, Toolbar } from "@wangeditor-next/editor-for-vue";
import { IEditorConfig, IToolbarConfig, SlateElement, IDomEditor, Boot } from "@wangeditor-next/editor";
import axios from "axios";
import { bgColorPickerMenu } from "./bgColorPicker"
import { txtColorPickerMenu } from "./txtColorPicker";

onMounted(() => {
  const safeRegister = (menu: any) => {
    try {
      Boot.registerMenu(menu);
    } catch (e) {
      // 忽略重复注册
      if (e.message && !e.message.includes('Duplicated key')) {
        console.error(e);
      }
    }
  };

  safeRegister(bgColorPickerMenu);
  safeRegister(txtColorPickerMenu);
});

const props = defineProps<{
  modelValue: boolean;
  value?: string;
  widget: FormElement;
}>();

type InsertFnType = (url: string, alt: string, href: string) => void;

type ImageElement = SlateElement & {
  src: string;
  alt: string;
  url: string;
  href: string;
};

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void;
  (event: "update", value: string): void;
}>();

const isVisible = computed(() => props.modelValue);
const isFullscreen = ref(false);

const richTextEditorRef = shallowRef<HTMLElement>();
const editorRef = shallowRef<IDomEditor>(null);

let toolBarDom: HTMLElement | null = null;
let editorDom: HTMLElement | null = null;

const toolbarConfig: Partial<IToolbarConfig> = {
  excludeKeys: [
    "group-indent",
    "group-video",
    "insertTable",
    "insertVideo",
    "codeBlock",
    "code",
    "emotion",
    "fullScreen",
    "color",
    "bgColor"
  ],
  insertKeys: {
    index: 9, // 插入的位置，基于当前的 toolbarKeys
    keys: [
      "txtColorPicker",
      'bgColorPicker'
    ],
  }
};

const editorConfig: Partial<IEditorConfig> = {
  autoFocus: false,
  MENU_CONF: {
    insertImage: {
      onInsertedImage(imageNode: ImageElement | null) {
        if (imageNode == null) return;
      },
    },
    uploadImage: {
      metaWithUrl: false,
      base64LimitSize: 0,
      server: "",
      async customUpload(file: File, insertFn: InsertFnType) {
        let params = new FormData();
        params.append('file', file);
        params.append('filename', file.name);
        const projectId = props.widget.getBoard().projectId;
        params.append('projectId', projectId);

        const res = await axios.post('project/file', params, { headers: { 'Content-Type': 'multipart/form-data' } }).catch((err) => {
          return err;
        })

        insertFn(res?.data?.filePath ? `/${projectId}/${res?.data?.filePath}` : "", "", "");
      },
      onProgress(progress: number) {},
      onSuccess(file, res: any) {},
      onFailed(file, res: any) {},
      onError(file, err: any, res: any) {},
    },
    lineHeight: {
      lineHeightList: ['1', '1.5', '2', '2.5', '3', '3.5', '5', '10', '15', '20']
    }
  },
};

const handleCreated = (editor) => {
  editorRef.value = editor;
  nextTick(() => {
    toolBarDom = richTextEditorRef.value?.querySelector(".toolbar") as HTMLElement;
    editorDom = richTextEditorRef.value?.querySelector(".editor") as HTMLElement;
  });
};

const handleEditorDblclick = () => {
  // 可选扩展
};

const onOpen = () => {
  // 设置初始内容
  nextTick(() => {
    const html = props.value || props.widget.descriptionContent || "";
    editorRef.value?.setHtml(html);
  });
};

const dialogRef = ref();

const dialogClosed = () => {
  emit("update:modelValue", false);
};

const confirm = () => {
  const html = editorRef.value?.getHtml() || "";
  emit("update", html);
  dialogClosed();
};

onBeforeUnmount(() => {
  if (editorRef.value) editorRef.value.destroy();
});
</script>

<style lang="scss" scoped>
.auto-counting-container {
  :deep(.el-dialog) {
    --el-dialog-padding-primary: 0;
    --el-dialog-bg-color: var(--color-white);
    --dialog-body-height: 500px;
    --el-dialog-body-padding: 16px;

    border-radius: 4px;

    .el-dialog__header {
      height: 40px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 16px;
      position: relative;

      span {
        font-size: 14px;
      }

      .menus {
        height: 100%;
        display: flex;
        align-items: center;
        position: absolute;
        right: 16px;
        top: 0;
      }
    }

    .el-dialog__body { 
      height: var(--dialog-body-height);
      padding: var(--el-dialog-body-padding);

      .toolbar {
        border-bottom: 1px solid var(--border-color);
      }

      .editor {
        min-height: 400px;
        p {
          margin: 0;
        }
      }
    }

    .el-dialog__footer {
      padding: 16px;
    }

    &.fullscreen .el-dialog__body {
      height: calc(100% - 95px);

      .container {
        height: 100%;
        display: flex;
        flex-direction: column;
        .wrap-editor {
          flex: 1;
        }
      }
    }

    &.fullscreen .el-dialog__footer {
      position: absolute;
      right: 0;
      bottom: 0;
    }
  }
}

.container {
  border: 1px solid var(--border-color);
  border-radius: 4px;

  .wrap-editor {
    height: 400px;
  }
}

.footer {
  .el-button {
    border-radius: 4px;
  }
}
</style>
