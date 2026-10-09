<template>
  <b2-form-element class="markdown-editor">
    <template v-if="widget.isInTable && !widget.isReadonly">
      <div class="markdown-table-trigger" @click="handleOpenTableDialog">
        <md-preview v-if="renderReady && editorValue" :model-value="editorValue" :language="editorLanguage" :sanitize="sanitizeHtml" />
        <div v-else class="markdown-table-placeholder">{{ $t('clickToEdit') }}</div>
      </div>

      <el-dialog
        v-model="tableDialogVisible"
        :title="$t('defaultName')"
        width="min(1200px, calc(100vw - 32px))"
        align-center
        append-to-body
        class="markdown-editor-dialog"
        :close-on-click-modal="false"
        destroy-on-close
      >
        <md-editor
          v-if="renderReady"
          :model-value="dialogEditorValue"
          :style="{ height: '450px' }"
          :toolbars="toolbars"
          :language="editorLanguage"
          :sanitize="sanitizeHtml"
          :on-upload-img="uploadImages"
          :on-html-changed="handleDialogHtmlChanged"
          @update:model-value="handleDialogEditorValueChange"
        />
        <template #footer>
          <el-button @click="handleCloseTableDialog">{{ $t('cancel') }}</el-button>
          <el-button type="primary" @click="handleConfirmTableDialog">{{ $t('confirm') }}</el-button>
        </template>
      </el-dialog>
    </template>
    <template v-else>
      <template v-if="!widget.isReadonly">
        <md-editor
          v-if="renderReady"
          :model-value="editorValue"
          :style="{ height: `${widget.editorHeight}px` }"
          :toolbars="formToolbars"
          :language="editorLanguage"
          :sanitize="sanitizeHtml"
          :on-upload-img="uploadImages"
          :on-html-changed="handleHtmlChanged"
          @update:model-value="handleEditorValueChange"
          @mousedown.stop
        />
      </template>
      <div v-else-if="widget.inputValue" class="markdown-preview">
        <md-preview v-if="renderReady" :model-value="editorValue" :language="editorLanguage" :sanitize="sanitizeHtml" />
      </div>
      <div v-else class="markdown-empty">{{ i18next.t('noContent') }}</div>
    </template>
  </b2-form-element>
</template>

<script lang="ts" setup>
import "md-editor-v3/lib/style.css";
import "katex/dist/katex.min.css";
import axios from "axios";
import DOMPurify from "dompurify";
import { config, MdEditor, MdPreview } from "md-editor-v3";
import katex from "katex";
import mermaid from "mermaid";
import * as prettier from "prettier/standalone";
import * as parserMarkdown from "prettier/plugins/markdown";
import screenfull from "screenfull";
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { useWidget } from "@renderer/b2/types";
import i18next, { $t } from "@renderer/widgets/i18next";
import { MarkdownEditor } from "./markdownEditor";
import { decodeMarkdownSource, encodeMarkdownHtml } from "./htmlToMarkdown";

config({
  editorConfig: {
    renderDelay: 0,
  },
  markdownItConfig: md => {
    md.set({ html: false });
    md.inline.ruler.before("html_inline", "underline", (state, silent) => {
      const isOpenTag = state.src.startsWith("<u>", state.pos);
      const isCloseTag = state.src.startsWith("</u>", state.pos);
      if (!isOpenTag && !isCloseTag) return false;

      if (!silent) {
        state.push(isOpenTag ? "underline_open" : "underline_close", "u", 0);
      }
      state.pos += isOpenTag ? 3 : 4;
      return true;
    });
    md.renderer.rules.underline_open = () => "<u>";
    md.renderer.rules.underline_close = () => "</u>";
  },
  editorExtensions: {
    prettier: {
      prettierInstance: prettier,
      parserMarkdownInstance: parserMarkdown,
    },
    screenfull: { instance: screenfull },
    mermaid: { instance: mermaid },
    katex: { instance: katex },
  },
});

const widget = useWidget<MarkdownEditor>();
const sanitizeHtml = (html: string) => DOMPurify.sanitize(html);
const editorLanguage = computed(() => i18next.language === "en" ? "en-US" : "zh-CN");
const editorValue = ref("");
const renderReady = ref(false);
const tableDialogVisible = ref(false);
const dialogEditorValue = ref("");
let lastGeneratedHtml = "";
let lastDialogGeneratedHtml = "";
let isSyncingEditorValue = false;
let ignoreEditorInitialEmptyValue = false;
let ignoreDialogInitialEmptyValue = false;
let hasUserChangedEditorValue = false;
const toolbars = [
  "bold",
  "underline",
  "italic",
  "strikeThrough",
  "-",
  "title",
  "sub",
  "sup",
  "quote",
  "unorderedList",
  "orderedList",
  "task",
  "-",
  "codeRow",
  "code",
  "link",
  "image",
  "table",
  "mermaid",
  "katex",
  "-",
  "revoke",
  "next",
  "=",
  "prettier",
  "pageFullscreen",
  "preview",
  "previewOnly",
  "htmlPreview",
  "catalog",
];
const formToolbars = toolbars.filter(toolbar => toolbar !== "pageFullscreen");

const uploadImages = async (files: File[], callback: (urls: string[]) => void) => {
  const results = await Promise.allSettled(files.map(async file => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("filename", file.name);
    formData.append("projectId", widget.getBoard().projectId);
    formData.append("nocodeId", widget.getBoard().nocodeId || "");

    const response = await axios.post("/uploader/uploadFile", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data.url || "";
  }));

  const successUrls = results
    .filter((result): result is PromiseFulfilledResult<string> => result.status === "fulfilled")
    .map(result => result.value)
    .filter(Boolean);
  const failedCount = results.filter(result => result.status === "rejected" || !result.value).length;
  if (failedCount > 0) {
    ElMessage.error(i18next.t("uploadFailed", { count: failedCount }));
  }
  callback(successUrls);
};

function handleHtmlChanged(html: string) {
  if (widget.storageFormat !== "html") return;
  if (!hasUserChangedEditorValue) return;
  if (isSyncingEditorValue || (!html && editorValue.value)) return;

  if (!editorValue.value.trim()) {
    lastGeneratedHtml = "";
    widget.inputValue = "";
    return;
  }

  lastGeneratedHtml = encodeMarkdownHtml(editorValue.value, html);
  widget.inputValue = lastGeneratedHtml;
}

function handleEditorValueChange(value: string) {
  if (ignoreEditorInitialEmptyValue && !value) {
    ignoreEditorInitialEmptyValue = false;
    return;
  }
  ignoreEditorInitialEmptyValue = false;
  hasUserChangedEditorValue = true;
  editorValue.value = value;
}

function handleDialogHtmlChanged(html: string) {
  if (widget.storageFormat !== "html") return;
  if (!html && dialogEditorValue.value) return;

  if (!dialogEditorValue.value.trim()) {
    lastDialogGeneratedHtml = "";
    return;
  }

  lastDialogGeneratedHtml = encodeMarkdownHtml(dialogEditorValue.value, html);
}

function handleDialogEditorValueChange(value: string) {
  if (ignoreDialogInitialEmptyValue && !value) {
    ignoreDialogInitialEmptyValue = false;
    return;
  }
  ignoreDialogInitialEmptyValue = false;
  dialogEditorValue.value = value;
}

function handleOpenTableDialog() {
  dialogEditorValue.value = editorValue.value;
  lastDialogGeneratedHtml = "";
  ignoreDialogInitialEmptyValue = true;
  tableDialogVisible.value = true;
  nextTick(() => {
    ignoreDialogInitialEmptyValue = false;
  });
}

function handleCloseTableDialog() {
  tableDialogVisible.value = false;
}

function handleConfirmTableDialog() {
  if (widget.storageFormat === "markdown") {
    widget.inputValue = dialogEditorValue.value;
  } else if (!dialogEditorValue.value.trim()) {
    widget.inputValue = "";
  } else if (lastDialogGeneratedHtml) {
    widget.inputValue = lastDialogGeneratedHtml;
  }
  widget.validate();
  tableDialogVisible.value = false;
}

function toMarkdownValue(value: string) {
  return decodeMarkdownSource(value) ?? value;
}

function syncEditorValue(value = widget.inputValue) {
  isSyncingEditorValue = true;
  hasUserChangedEditorValue = false;
  const markdownValue = toMarkdownValue(value);
  editorValue.value = markdownValue;
  nextTick(() => {
    isSyncingEditorValue = false;
  });
}

watch(editorValue, value => {
  if (widget.storageFormat === "markdown" && hasUserChangedEditorValue && !isSyncingEditorValue) {
    widget.inputValue = value;
  }
});

watch(() => widget.inputValue, value => {
  if (widget.storageFormat === "html" || decodeMarkdownSource(value) !== null) {
    if (value !== lastGeneratedHtml) {
      syncEditorValue(value);
    }
  } else if (editorValue.value !== value) {
    editorValue.value = value;
  }
  widget.validate();
}, { immediate: true });

watch(() => widget.initialValue, value => {
  if (widget.storageFormat !== "html" || !value) return;
  syncEditorValue(value);
});

watch(() => widget.storageFormat, () => {
  lastGeneratedHtml = "";
  syncEditorValue();
});

watch(() => widget.isReadonly, isReadonly => {
  if (isReadonly) return;
  renderReady.value = false;
  ignoreEditorInitialEmptyValue = true;
  nextTick(() => {
    renderReady.value = true;
    nextTick(() => {
      ignoreEditorInitialEmptyValue = false;
    });
  });
});

onMounted(() => {
  nextTick(() => {
    ignoreEditorInitialEmptyValue = true;
    renderReady.value = true;
    nextTick(() => {
      ignoreEditorInitialEmptyValue = false;
    });
    if (widget.isInTable && !widget.isReadonly) {
      handleOpenTableDialog();
    }
  });
});
</script>

<style lang="scss" scoped>
.markdown-editor {
  :deep(.md-editor) {
    border-radius: 4px;
  }
}

.markdown-preview,
.markdown-empty,
.markdown-table-trigger {
  min-height: 32px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--el-bg-color-overlay);
}

.markdown-preview {
  overflow: auto;

  :deep(.md-editor-preview-wrapper) {
    padding: 12px;
  }
}

:deep(.md-editor-preview-wrapper ul) {
  margin: 0;
  padding-left: 20px;
  list-style: disc outside;
}

:deep(.md-editor-preview-wrapper ol) {
  margin: 0;
  padding-left: 24px;
  list-style: decimal outside;
}

:deep(.md-editor-preview-wrapper li) {
  margin-bottom: 4px;
}

.markdown-table-trigger {
  max-height: var(--table-row-height, 32px);
  overflow: auto;
  cursor: pointer;

  :deep(.md-editor-preview-wrapper) {
    padding: 6px 12px;
  }
}

.markdown-table-placeholder {
  padding: 6px 12px;
  color: var(--text-color-inactive);
  line-height: 20px;
}

.markdown-empty {
  padding: 6px 12px;
  color: var(--text-color-inactive);
  line-height: 20px;
}
</style>
