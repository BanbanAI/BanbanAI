<template>
  <div class="workbench-add-user-dialog">
    <el-dialog v-model="dialogVisible" width="680px" :close-on-click-modal="false"
      :title="$t('PrintSettingDialog.title')" align-center destroy-on-close @closed="handleClosed" @open="handleOpen">
      <div class="dialog-body">
        <div class="pagination-method">
          <div class="title-text">
            {{ $t('PrintSettingDialog.templateScope') }}
            <el-tooltip
              class="box-item"
              effect="light"
              :content="$t('PrintSettingDialog.scopeDesc')"
              placement="top"
              raw-content
            >
              <el-icon size="16"><i-ant-design-question-circle-outlined /></el-icon>
            </el-tooltip>
          </div>
          <div class="use-scope" @click="setRange" ref="tagContainerRef">
            <div class="use-scope-text" v-if="isEmptyRange">
              <el-icon>
                <i-ep-plus></i-ep-plus>
              </el-icon>
              <span>
                {{ $t('PrintSettingDialog.setScope') }}
              </span>
            </div>
            <div class="tag-container" v-else>
              <el-tag
                v-for="item in tagList"
                :key="item.value"
                color="#f5f6f7"
              >
                {{ item.label }}
              </el-tag>
            </div>
          </div>
        </div>
        <div class="file-name">
          <div class="name-text">
            {{ $t('PrintSettingDialog.fileName') }}
            <el-tooltip
              class="box-item"
              effect="light"
              :content="$t('PrintSettingDialog.fileNameDesc')"
              placement="top"
              raw-content
            >
              <el-icon size="16"><i-ant-design-question-circle-outlined /></el-icon>
            </el-tooltip>
          </div>
          <el-radio-group v-model="fileName">
            <el-radio :value="PrintTemplateExportNameMode.DEFAULT">{{ $t('PrintSettingDialog.defaultName') }}</el-radio>
            <el-radio :value="PrintTemplateExportNameMode.DATA_TITLE">{{ $t('PrintSettingDialog.dataTitleName') }}</el-radio>
            <el-radio :value="PrintTemplateExportNameMode.CUSTOM">{{ $t('PrintSettingDialog.customName') }}</el-radio>
          </el-radio-group>
          <div class="default-tip" v-if="fileName === PrintTemplateExportNameMode.DEFAULT">{{ $t('PrintSettingDialog.defaultNameDesc') }}</div>
          <div class="data-title-tip" v-if="fileName === PrintTemplateExportNameMode.DATA_TITLE">{{ $t('PrintSettingDialog.sameAsTitle') }}</div>
          <div class="custom-tip" v-if="fileName === PrintTemplateExportNameMode.CUSTOM">
            <div class="filename-editor" @click="handleFilenameEditorClick">
              <CodeMirror
                class="filename-codemirror"
                :placeholder="$t('PrintSettingDialog.inputFileName')"
                :extensions="filenameEditorExtensions"
                wrap
                @update="handleFilenameEditorUpdate"
                @ready="handleFilenameEditorReady"
              />
              <el-dropdown
                class="field-insert-dropdown"
                trigger="click"
                placement="bottom-start"
                @command="insertFieldSegment"
              >
                <el-button class="field-insert-button" text>
                  <el-icon><i-ep-plus /></el-icon>
                  {{ $t('PrintSettingDialog.insertField') }}
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item
                      v-if="printableFilenameFields.length === 0"
                      disabled
                    >
                      {{ $t('PrintSettingDialog.noFilenameFields') }}
                    </el-dropdown-item>
                    <el-dropdown-item
                      v-for="field in printableFilenameFields"
                      :key="field.uid"
                      :command="field.uid"
                    >
                      {{ field.alias }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
        </div>
        <div class="print-method" v-if="templateType === PrintTemplateType.EXCEL">
          <div class="title-text">{{ $t('PrintSettingDialog.batchPrintMode') }}</div>
          <el-radio-group v-model="printMethod">
            <el-radio :value="PrintTemplateMode.SINGLE">{{ $t('PrintSettingDialog.mergePrint') }}</el-radio>
            <el-radio :value="PrintTemplateMode.MULTIPLE">{{ $t('PrintSettingDialog.splitPrint') }}</el-radio>
          </el-radio-group>
        </div>
      </div>
      <template #footer>
        <el-button class="cancel" @click="dialogVisible = false">{{ $t('PrintSettingDialog.cancel') }}</el-button>
        <el-button type="primary" class="confirm" @click="handleConfirm">{{ $t('PrintSettingDialog.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
  <nocode-user-select-dialog  ref="userSelectRef" @save="handleSave"/>
</template>

<script setup lang='ts'>
import type { Field } from '@common/types/project';
import type { PrintTemplate, PrintTemplateExportNameSegment } from '@common/types/nocode';
import { PrintTemplateExportNameMode, PrintTemplateMode, PrintTemplateType } from '@common/types/nocode';
import { getPrintableFilenameFields, normalizePrintTemplateFilenameSegments, stringifyPrintTemplateFilenameSegments } from '@common/utils/printTemplateFilename';
import { ORGANIZE_UTIL } from '@renderer/types';
import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { minimalSetup } from 'codemirror';
import CodeMirror from 'vue-codemirror6';
import { ref, computed, inject } from 'vue';
import type { Ref } from 'vue';
import i18next from 'i18next';

class FilenameFieldTagWidget extends WidgetType {
  constructor(private readonly label: string) {
    super();
  }

  eq(other: FilenameFieldTagWidget) {
    return other.label === this.label;
  }

  toDOM() {
    const tag = document.createElement('span');
    tag.className = 'filename-cm-field-tag';
    tag.title = this.label;

    const label = document.createElement('span');
    label.className = 'filename-cm-field-label';
    label.textContent = this.label;
    tag.appendChild(label);

    const close = document.createElement('span');
    close.className = 'filename-cm-field-remove';
    close.textContent = 'x';
    tag.appendChild(close);

    return tag;
  }

  ignoreEvent() {
    return false;
  }
}

const findFilenameFieldTokenRangeAt = (text: string, pos: number | null | undefined) => {
  if (pos === null || pos === undefined) return null;
  const regex = /\$\{([^}\r\n]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    const from = match.index;
    const to = from + match[0].length;
    if (pos >= from && pos <= to) return { from, to };
  }
  return null;
}

const createFilenameFieldTagExtension = (labelMap: Map<string, string>, invalidLabel: string) => {
  const buildDecorations = (view: EditorView) => {
    const builder = new RangeSetBuilder<Decoration>();
    const text = view.state.doc.toString();
    const regex = /\$\{([^}\r\n]+)\}/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text))) {
      const fieldUid = match[1].trim();
      if (!fieldUid) continue;
      const from = match.index;
      const to = from + match[0].length;
      builder.add(from, to, Decoration.replace({
        widget: new FilenameFieldTagWidget(labelMap.get(fieldUid) || invalidLabel),
      }));
    }

    return builder.finish();
  };

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged) {
          this.decorations = buildDecorations(update.view);
        }
      }
    },
    {
      decorations: instance => instance.decorations,
      provide: plugin => EditorView.atomicRanges.of(view => view.plugin(plugin)?.decorations || Decoration.none),
      eventHandlers: {
        mousedown(event, view) {
          const target = event.target as HTMLElement | null;
          if (!target?.closest('.filename-cm-field-remove')) return;

          event.preventDefault();
          event.stopPropagation();

          let pos: number | null = null;
          try {
            pos = view.posAtDOM(target);
          } catch (_error) {
            pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
          }
          const range = findFilenameFieldTokenRangeAt(view.state.doc.toString(), pos);
          if (!range) return;
          view.dispatch({
            changes: { from: range.from, to: range.to, insert: '' },
            selection: { anchor: range.from },
            scrollIntoView: true,
          });
          view.focus();
        },
      },
    },
  );
}

const filenameEditorTheme = EditorView.baseTheme({
  '.filename-cm-field-tag': {
    display: 'inline-flex',
    alignItems: 'center',
    maxWidth: '220px',
    height: '24px',
    margin: '0 2px',
    padding: '0 6px',
    borderRadius: '3px',
    color: '#2f7deb',
    backgroundColor: '#eaf2fd',
    verticalAlign: 'middle',
  },
  '.filename-cm-field-label': {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  '.filename-cm-field-remove': {
    flex: 'none',
    marginLeft: '5px',
    color: '#8c8c8c',
    cursor: 'pointer',
    lineHeight: '24px',
  },
  '.filename-cm-field-remove:hover': {
    color: 'var(--color-danger)',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-content': {
    fontFamily: 'inherit',
    fontSize: '14px',
    lineHeight: '28px',
    color: 'var(--text-color-primary)',
  },
  '.cm-line': {
    minHeight: '28px',
    lineHeight: '28px',
    padding: '0',
  },
  '.cm-placeholder': {
    color: 'var(--text-color-placeholder)',
  },
});

const props = defineProps<{
  printTemplateData:  PrintTemplate,
  templateType: PrintTemplateType,
  fields?: Field[],
}>();
const emit = defineEmits<{
  (event: 'confirm', value: object),
  (event: "update");
}>();

const dialogVisible = ref(false);
const range = ref({
  departments: [],
  roles: [],
  users: [],
})
const fileName = ref(PrintTemplateExportNameMode.DEFAULT);
const printMethod = ref(PrintTemplateMode.SINGLE);
const userSelectRef = ref(null);
const organizeUtil = inject(ORGANIZE_UTIL)
const filenameEditorText = ref('');
const filenameEditorView = ref<EditorView | null>(null);

const printableFilenameFields = computed(() => getPrintableFilenameFields(props.fields || []));
const filenameFieldLabelByUid = computed(() => new Map(printableFilenameFields.value.map(field => [field.uid, field.alias])));
const filenameEditorExtensions = computed(() => [
  minimalSetup,
  createFilenameFieldTagExtension(filenameFieldLabelByUid.value, i18next.t('PrintSettingDialog.invalidField')),
  filenameEditorTheme,
  EditorView.lineWrapping,
]);

const handleClosed = () => {
  dialogVisible.value = false;
  filenameEditorView.value = null;
}

const setFilenameEditorText = (text: string) => {
  filenameEditorText.value = text;
  const view = filenameEditorView.value;
  if (!view) return;
  if (view.state.doc.toString() === text) return;
  view.dispatch({
    changes: {
      from: 0,
      to: view.state.doc.length,
      insert: text,
    },
    selection: { anchor: text.length },
  });
}

const initFilenameSegments = () => {
  const segments = normalizePrintTemplateFilenameSegments(props.printTemplateData.exportNameSegments);
  setFilenameEditorText(segments.length > 0
    ? stringifyPrintTemplateFilenameSegments(segments)
    : props.printTemplateData.exportNameValue || '');
}

const handleOpen = () => {
  range.value = {
    departments: props.printTemplateData.range.departments || [],
    roles: props.printTemplateData.range.roles || [],
    users: props.printTemplateData.range.users || [],
  };
  fileName.value = props.printTemplateData.exportNameMode;
  printMethod.value = props.printTemplateData.mode;
  initFilenameSegments();
}

const handleConfirm = () => {
  const editorText = filenameEditorView.value?.state.doc.toString() ?? filenameEditorText.value;
  const exportNameSegments = parseFilenameEditorTextToSegments(editorText);
  emit('confirm', {
    range: range.value,
    exportNameValue: stringifyPrintTemplateFilenameSegments(exportNameSegments),
    exportNameSegments,
    exportNameMode: fileName.value,
    mode: printMethod.value,
  })
  dialogVisible.value = false;
}

const isEmptyRange = computed(() => {
  return !range.value.departments.length && !range.value.roles.length && !range.value.users.length;
})

const setRange = () => {
  userSelectRef.value.show(i18next.t('PrintSettingDialog.scopeSet'), range.value)
}

const handleSave = (val) => {
  range.value = val
}

const handleFilenameEditorClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement | null;
  if (target?.closest('.field-insert-dropdown')) return;
  filenameEditorView.value?.focus();
}

const insertFieldSegment = (fieldUid: string) => {
  const field = printableFilenameFields.value.find(item => item.uid === fieldUid);
  if (!field) return;

  const token = `\${${fieldUid}}`;
  const view = filenameEditorView.value;
  if (!view) {
    setFilenameEditorText(`${filenameEditorText.value}${token}`);
    return;
  }

  const selection = view.state.selection.main;
  view.dispatch({
    changes: {
      from: selection.from,
      to: selection.to,
      insert: token,
    },
    selection: { anchor: selection.from + token.length },
    scrollIntoView: true,
  });
  filenameEditorText.value = view.state.doc.toString();
  view.focus();
}

const handleFilenameEditorReady = (payload: { view: Ref<EditorView> }) => {
  filenameEditorView.value = payload.view.value;
  setFilenameEditorText(filenameEditorText.value);
}

const handleFilenameEditorUpdate = (viewUpdate: ViewUpdate) => {
  if (!viewUpdate.docChanged) return;
  filenameEditorText.value = viewUpdate.view.state.doc.toString();
}

const parseFilenameEditorTextToSegments = (value: string): PrintTemplateExportNameSegment[] => {
  const segments: PrintTemplateExportNameSegment[] = [];
  const regex = /\$\{([^}\r\n]+)\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(value))) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: value.slice(lastIndex, match.index) });
    }
    const fieldUid = match[1].trim();
    if (fieldUid) {
      segments.push({ type: 'field', fieldUid });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < value.length) {
    segments.push({ type: 'text', value: value.slice(lastIndex) });
  }

  return normalizePrintTemplateFilenameSegments(segments);
}

const tagContainerRef = ref(null);

function getTextWidth(text) {
  const font = '12px "PingFangSC-Regular", "din", "Microsoft Yahei", "Arial", "Helvetica Neue", "Helvetica", sans-serif'
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = font; // 字体要一致，否则测量结果不准
  return ctx.measureText(text).width + 20;
}

const tagList = computed(() => {
  let line = 1
  let width = 0
  const tags = []
  const keys = ['departments', 'roles', 'users']
  for(const key of keys) {
    for(const itemId of range.value[key]) {
      const item = organizeUtil[key].find(d => d.id === itemId)
      if(!item) continue;
      const label = item.realname || item.name || i18next.t('PrintSettingDialog.unnamed')
      const tagWidth = Math.max(getTextWidth(label), getTextWidth('. . .'))
      width = width + 8 + tagWidth
      if(width > tagContainerRef.value?.clientWidth - 8) {
        line++
        width = 8 + tagWidth
      }
      if(line > 2) {
        const tag = tags.at(-1)
        tag.label = '. . .'
        return tags
      }

      tags.push({
        value: item.id,
        label,
      })
    }
  }
  return tags
})

defineExpose({
  show: () => {
    dialogVisible.value = true;
  }
})
</script>

<style scoped lang='scss'>
.workbench-add-user-dialog {
  :deep(.el-dialog) {
    border-radius: 4px;
    --el-dialog-bg-color: var(--bg-color-page);
    --el-dialog-padding-primary: 0;

    .el-dialog__header {
      padding: 0px;
      margin: 0px;
      text-align: center;
      line-height: 40px;
      border-bottom: 1px solid var(--border-color);
      --el-dialog-title-font-size: 14px;

      .el-dialog__headerbtn {
        height: 40px;
        width: 40px;
        line-height: 46px;
        font-size: 16px;
        border-top-right-radius: 4px;
        top: 0;

        &:hover {
          background-color: var(--color-danger);

          .el-dialog__close {
            color:var(--color-white);
          }
        }
        .el-dialog__close {
          font-size: 18px;
        }
      }
    }

    .el-dialog__body {
      padding: 24px 16px;
      border-bottom: 1px solid var(--border-color);

      .dialog-body {
        display: flex;
        flex-direction: column;

        .pagination-method {
          font-size: 14px;
          font-weight: 400;
          color: #141414;
          margin-bottom: 32px;

          .title-text {
            display: flex;
            align-items: center;
            margin-bottom: 16px;
            
            .el-icon {
              margin-left: 8px;
            }
          }
          .use-scope {
            width: 100%;
            height: 72px;
            border: 1px dashed rgba($color: #141414, $alpha: 0.2);
            border-radius: 4px;
            font-weight: 400;
            font-size: 14px;
            color: var(--text-color-secondary);
            cursor: pointer;
            overflow: hidden;

            .use-scope-text {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              height: 100%;
            }

            .tag-container {
              padding: 8px;
              gap: 8px;
              display: flex;
              flex-wrap: wrap;

              .el-tag {
                border: none;
                color: #373737;
              }
            }
          }
        }

        .file-name {
          margin-bottom: 32px;
          .name-text {
            display: flex;
            align-items: center;
            font-size: 14px;
            font-weight: 400;
            color: #141414;
            margin-bottom: 8px;

            .el-icon {
              margin-left: 8px;
            }
          }
          .default-tip {
            margin-top: 8px;
            font-size: 14px;
            font-weight: 400;
            color: #A1A1A1;
          }
          .data-title-tip {
            margin-top: 8px;
            font-size: 14px;
            font-weight: 400;
            color: #A1A1A1;
          }
          .custom-tip {
            margin-top: 8px;
            .filename-editor {
              width: 520px;
              min-height: 148px;
              max-height: 180px;
              position: relative;
              border: 1px solid var(--border-color);
              border-radius: 4px;
              background-color: var(--color-white);
              cursor: text;
              overflow-y: auto;

              &:focus-within {
                border-color: var(--color-primary);
              }

              .field-insert-dropdown {
                position: absolute;
                left: 12px;
                bottom: 10px;
                z-index: 2;
                height: 28px;
                line-height: 28px;
              }

              .field-insert-button {
                height: 28px;
                padding: 0 6px;
                color: var(--color-primary);
                border-radius: 4px;

                .el-icon {
                  margin-right: 2px;
                }
              }

              .filename-codemirror {
                min-height: 148px;
                padding: 0 4px;
                :deep(.cm-editor) {
                  min-height: 148px;
                  max-height: 180px;
                  background: transparent;
                }

                :deep(.cm-scroller) {
                  overflow-y: auto;
                  overflow-x: hidden;
                  padding: 12px 12px 44px 12px;
                  font-family: inherit;
                }

                :deep(.cm-content) {
                  min-height: 92px;
                  padding: 0;
                  caret-color: var(--text-color-regular);
                }

                :deep(.cm-gutters) {
                  display: none;
                }
              }
            }
          }
        }

        .print-method {
          .title-text {
            font-size: 14px;
            font-weight: 400;
            color: #141414;
            margin-bottom: 8px;
          }
        }
      }
    }

    .el-dialog__footer {
      padding: 16px;

      .el-button { 
        height: 32px;
        width: 60px;
        border-radius: 4px;
      }
    }
  }
}
</style>
