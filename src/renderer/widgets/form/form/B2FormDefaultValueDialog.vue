<template>
  <div class="formula-container">
    <el-dialog 
      class="form-formula-dialog" 
      :modelValue="isVisible" 
      @update:modelValue="emit('update:modelValue', $event)" 
      @open="onOpen"
      :title="$t('defaultFormulaTitle')"
      :align-center="true" 
      width="1008" 
      destroy-on-close 
      :close-on-click-modal="false" 
      ref="dialogRef"
      draggable
    >
      <div class="container">
        <div class="container-header">
          <div class="header-title">
            <span>{{ $t("formulaLabel") }}</span>
          </div>
          <div class="header-options">
            <div class="copy" color="var(--text-color-secondary)" @click="handleCopyFormula">
              <el-icon :size="16"><i-ven-icon-widget-form-form-copy-formula /></el-icon>
              {{ $t("copy") }}
            </div>
          </div>
        </div>
        <div class="container-code" ref="editorRef">
          <CodeMirror class="mirror" ref="codeMirrorRef" v-model="codeMirrorText" :placeholder="$t('formulaEditorPlaceholder')"
            :extensions="extensions" wrap @update="formulaValidator" />
          <div class="formula-error" v-show="hasError"> {{ errorMessage }}</div>
        </div>
        <div class="container-list">
          <div class="fields-container">
            <span class="title">{{ $t("currentFormField") }}</span>
            <div class="fields-search">
              <el-input :placeholder="$t('searchVariable')" v-model="fieldInput">
                <template #prefix>
                  <el-icon :size="12"><i-ven-icon-widget-form-form-search /></el-icon>
                </template>
              </el-input>
            </div>
            <div class="fields-list" v-if="!fieldInput">
              <div class="filed-item" v-for="item in fieldList" @click="insertTitleText(item, 'tag')">
                <span class="item-name" v-html="highlight(getWidgetTitle(item), fieldInput)"></span>
                <el-tag 
                  :style="getTagData(item).style ?? {}"
                  size="small"
                  class="item-attr"
                >
                  {{ getTagData(item).text }}
                </el-tag>
              </div>
            </div>
            <div class="fields-list" v-else>
              <div class="filed-item" v-for="item in searchFieldList" @click="insertTitleText(item, 'tag')">
                <span class="item-name" v-html="highlight(getWidgetTitle(item), fieldInput)"></span>
                <el-tag 
                  :style="getTagData(item).style ?? {}"
                  size="small"
                  class="item-attr"
                >
                  {{ getTagData(item).text }}
                </el-tag>
              </div>
            </div>
          </div>
          <div class="formula-menu">
            <span class="title">{{ i18next.t("functionList") }}</span>
            <div class="formula-search">
              <el-input :placeholder="i18next.t('searchFunction')" v-model="formulaInput">
                <template #prefix>
                  <el-icon :size="12"><i-ven-icon-widget-form-form-search /></el-icon>
                </template>
              </el-input>
            </div>
            <div class="formula-list" v-if="!formulaInput">
              <div class="formula-category" v-for="(category, index) in formula">
                <div class="title" @click="toggleCategory(index)">
                  <el-icon :size="12" v-if="category.isExpanded"><CaretBottom /></el-icon>
                  <el-icon :size="12" v-else><CaretRight /></el-icon>
                  <span>{{ category.title }}</span>
                </div>
                <div class="children" v-show="category.isExpanded">
                  <template v-for="item in category.children">
                    <div class="formula-item" v-if="!item.argOfNotTableCol" @click="insertClick(item, 'fn')"
                      @mouseenter="handleMouseEnter(item)">
                      <div class="item-name">{{ item.name }}</div>
                      <div class="item-subName">{{ item.subName }}</div>
                    </div>
                  </template>
                </div>
              </div>
            </div>
            <div class="search-list" v-else>
              <div class="formula-item" v-for="item in searchFormulaList" @click="insertClick(item, 'fn')"
                @mouseenter="handleMouseEnter(item)">
                <div class="item-name" v-html="highlight(item.name, formulaInput)"></div>
                <div class="item-subName">{{ item.subName }}</div>
              </div>
            </div>
          </div>
          <div class="formula-intro">
            <template v-if="!currentFormula">
              <div class="formula-title">{{ i18next.t("operationTip") }}</div>
              <ul class="default-intro-wrapper">
                <li>{{ i18next.t("selectFunctionOrFieldTip") }}</li>
                <li v-html="i18next.t('defaultFormulaExampleLineHtml')"></li>
              </ul>
            </template>
            <template v-else>
              <div class="formula-title">
                {{ currentFormula.name }}
                <el-tag type="info" size="small">{{ i18next.t("comment") }}</el-tag>
              </div>
              <div class="formula-container">
                <ul class="intro-wrapper">
                  <li class="intro"><span class="li-title">{{ i18next.t("featureLabel") }}</span><span v-html="highlightFormula(currentFormula.intro)"></span></li>
                  <li class="usage"><span class="li-title">{{ i18next.t("usageLabel") }}</span><span v-html="highlightFormula(currentFormula.usage)"></span></li>
                  <li class="example"><span class="li-title">{{ i18next.t("exampleLabel") }}</span><span v-html="highlightFormula(currentFormula.example)"></span></li>
                </ul>
              </div>
            </template>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="footer">
          <el-button class="cancel" type="default" @click="dialogClosed">{{ i18next.t("cancel") }}</el-button>
          <el-button class="confirm" type="primary" @click="confirm">{{ i18next.t("confirm") }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from "vue";
import IVenIconCopyFormula from "~icons/ven-icon/widget-form-form-copy-formula";
import IVenIconSearch from '~icons/ven-icon/widget-form-form-search';
import CodeMirror from "vue-codemirror6";
import { useClipboard } from '@vueuse/core'
import { ViewUpdate } from "@codemirror/view";
import { createExtensions, insertText } from './codemirror';
import { ElMessage, tableV2Props, useId } from "element-plus";
import { useDialogStore } from "@renderer/stores/dialog";
import { formulaList } from "@common/utils/formula";
import { FormElement, AbstractForm } from "@renderer/b2/controllers/form";
import { Widget } from "@renderer/b2/controllers/widget";
import { CaretRight, CaretBottom } from '@element-plus/icons-vue'
import { filedType } from "./types";
import { SubForm } from "@renderer/widgets/form/subForm/subForm";
import { checkChineseQuotesInFormula } from "./utils";
import i18next, { $t } from "@renderer/widgets/i18next";

const props = defineProps<{
  modelValue: boolean;
  value?: string;
  widget: FormElement;
  type: string;
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void;
  (event: "update", value: string): void;
}>();

const isVisible = computed(() => {
  return props.modelValue;
})

const onOpen = () => {
  codeMirrorText.value = injectFormulaTitles(props.value, (!props.widget.isInSubForm ? props.widget.form : props.widget.form.parent) as AbstractForm);
}

const { copy } = useClipboard({ legacy: true });
const dialogRef = ref();
const codeMirrorRef = ref();
const codeMirrorText = ref('');
const fieldInput = ref('');
const formulaInput = ref('');
const currentFormula = ref();
const formula = ref(formulaList);

const fieldList = computed(() => {
  const form = (props.widget.topForm) as AbstractForm;

  return form.container.getChildWidgets(true, (widget: Widget) => {
    if (widget.uid === props.widget.uid) return false; // 排除自身
    else if (["widget.form.multipleTabs", "widget.form.tabPanel"].includes(widget.getSoul()?.type)) {
      return undefined; // 跳过分组面板，获取children
    }
    else if (widget.getSoul()?.type === "widget.form.subform") {
      if (!props.widget.isInSubForm) {
        return undefined; // 设置公式的widget不在子表单中,跳过子表单
      }
      else {
        if (props.widget.parent.uid === widget.uid) return undefined; // 该子表单为设置公式的widget的parent,则跳过
        else return false;
      }
    }
    else {
      return true;
    }
  })
})
const formulaChildren = computed(() => {
  return formula.value.flatMap((category) => category.children || []);
})
const searchFieldList = computed(() => {
  return fieldList.value.filter((item) => {
    return item.title.includes(fieldInput.value)
  }) ?? []
})
const searchFormulaList = computed(() => {
  const seen = new Set();
  return formulaChildren.value.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(formulaInput.value.toLowerCase()) || item.subName.includes(formulaInput.value);

    if (matchesSearch && !seen.has(item.name)) {
      seen.add(item.name);
      return true;
    }

    return false;
  })
})
const extensions = computed(() => {
  return fieldList.value && formulaChildren.value ? createExtensions(fieldList.value, formulaChildren.value.filter(f => !f.argOfNotTableCol)) : [];
})

const hasError = ref(false);
const errorMessage = ref('');

const hexToRgba = (hex: string, alpha: number = 1) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getTagData = (widget: FormElement) => {
  const tagType = filedType.find(type => type.filed.some(filedname => filedname === widget.type)) ?? filedType.find(type => type.name === i18next.t("fieldTypeText"));
  return {
    text: tagType.name,
    style: {
      '--tag-color': tagType.color,
      '--tag-bg-color': hexToRgba(tagType.color, 0.1),
    }
  };
};

const getWidgetTitle = (widget: FormElement):string => {
  return (widget.parent.type === "widget.form.subform" ? widget.parent.title + '.' : '') + widget.title;
};

const hasUnclosedQuotes = (text: string): boolean => {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const prevChar = text[i - 1];

    // 遇到未转义的单引号
    if (char === "'" && prevChar !== '\\' && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    }

    // 遇到未转义的双引号
    if (char === '"' && prevChar !== '\\' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    }
  }

  return inSingleQuote || inDoubleQuote;
}

const formulaValidator = (view: ViewUpdate) => {
  const text = view.state.doc.toString().trim();
  hasError.value = false;
  errorMessage.value = '';

  // 空内容时不显示任何状态
  if (!text) return;

  // 1. 检查括号匹配
  const openBrackets = (text.match(/\(/g) || []).length;
  const closeBrackets = (text.match(/\)/g) || []).length;
  if (openBrackets !== closeBrackets) {
    hasError.value = true;
    errorMessage.value = i18next.t("unclosedBracketTip");
    return;
  }

  // 2. 检查未闭合的引号
  const regex = /(?<!\\)"/g;
  const matches = text.match(regex);
  
  if (matches && matches.length % 2 !== 0) {
    hasError.value = true;
    errorMessage.value = i18next.t("unclosedQuoteTip");
    return;
  }

  // 3. 检查转义引号是否合法
  const invalidEscapes = text.match(/(?<!\\)\\[^"\\]/g);
  if (invalidEscapes) {
    hasError.value = true;
    errorMessage.value = i18next.t("invalidEscapeTip", { value: invalidEscapes[0] });
    return;
  }

  // 4. 检查是否存在中文引号（在字符串外）
  const chineseQuotes = checkChineseQuotesInFormula(text);
  if (chineseQuotes.length > 0) {
    hasError.value = true;
    errorMessage.value = i18next.t("useEnglishQuotesTip");
    return;
  }

  // 5. 检查函数调用
  const functionNames = formulaChildren.value.map(fn => fn.name);
  if (functionNames.length > 0) {
    const escapedNames = functionNames.map(name => 
      name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
    );

    const functionCallRegex = new RegExp(
      `\\b(${escapedNames.join('|')})\\b(?!\\s*\\()`, 
      'g'
    );

    let match;
    while ((match = functionCallRegex.exec(text)) !== null) {
      hasError.value = true;
      errorMessage.value = i18next.t("functionMissingParenthesesTip", { name: match[0] });
      return;
    }
  }
};

const highlight = (text, keyword) => {
  if (!keyword || !text) return text;
  const regex = new RegExp(keyword, "g");
  return text.replace(regex, `<span class="keyword">${keyword}</span>`);
};

const toggleCategory = (index) => {
  formula.value[index].isExpanded = !formula.value[index].isExpanded;
}

const highlightFormula = (text) => {
  if (!text) return text;

  return text.replace(/([A-Z][A-Z0-9_]+)/g, '<span class="formula-name">$1</span>');
};

const insertTitleText = (item, type: "fn" | "tag") => {
  if (codeMirrorRef.value) {
    const content = type === "tag" ? `[[${item.uid},${getWidgetTitle(item)}]]` : `${item.title}()`;
    codeMirrorRef.value.replaceSelection(content)
    if (type === "fn") {
      codeMirrorRef.value.setCursor(codeMirrorRef.value.getCursor() - 1)
    }
    codeMirrorRef.value.focus = true
  }
};
const insertClick = (item, type: 'tag' | 'fn') => {
  insertText(codeMirrorRef.value, item, type);
};

const handleCopyFormula = () => {
  copy(codeMirrorText.value);
  ElMessage.success(i18next.t("copyFormulaSuccess"));
}
const handleMouseEnter = (item) => {
  currentFormula.value = item;
}
const dialogClosed = () => {
  currentFormula.value = null;
  formulaInput.value = "";
  fieldInput.value = "";
  formula.value = formulaList.map((item) => ({ ...item, isExpanded: false }));
  emit("update:modelValue", false);
};

const stripFormulaTitles = (formula: string): string => {
  const regex = /\[\[([a-zA-Z0-9]+),\s*[^\]]+\]\]/g;
  return formula?.replace(regex, (_match, id) => `[[${id}]]`);
}

const injectFormulaTitles = (formula: string, form: AbstractForm): string => {
  const regex = /\[\[([a-zA-Z0-9]+)\]\]/g;

  const topForm = props.widget.topForm
  const allWidgets = topForm.container.getChildWidgets(true)
  return formula?.replace(regex, (_match, id:string) => {
    let title:string = '';

    const widget = allWidgets.find(child => child.uid === id) as FormElement;
    title = widget ? `${widget.isInSubForm ? (widget.form as SubForm).title + '.' : ''}${widget.title}` : i18next.t("unknownField")
    return `[[${id},${title}]]`;
  });
}

const confirm = () => {
  emit("update", stripFormulaTitles(codeMirrorText.value));

  dialogClosed();
}

</script>

<style lang="scss" scoped>
.formula-container {
  :deep(.el-dialog) {
    --el-dialog-padding-primary: 0;
    --el-dialog-bg-color: var(--color-white);
    border-radius: 4px;

    .el-dialog__header {
      height: 40px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;

      span {
        font-size: 14px;
      }
    }

    .el-dialog__body {
      padding: 24px;

      .el-input {
        --el-input-placeholder-color: var(--text-color-placeholder);

        .el-input__wrapper {
          border-radius: 4px;
          border: 1px solid var(--border-color);
          padding: 0 0 0 9px;
          box-shadow: none;

          .el-input__prefix {
            color: var(--text-color-regular);
          }
        }
      }
    }

    .el-dialog__footer {
      padding: 0 24px 24px;

      .el-button {
        border-radius: 4px;
      }
    }
  }

  .invalid-feedback {
    display: flex;
    flex-direction: row;
    height: 30px;
    align-items: center;
    margin-bottom: 15px;

    .invalid-feedback-tip {
      font-size: 14px;
      color: var(--text-color-regular);
      margin-right: 10px;
    }

    .invalid-feedback-input {
      width: 678px;
      height: 30px;
    }
  }

  .container {
    width: 100%;
    height: 100%;
    border: 1px solid var(--border-color);

    .container-header {
      height: 40px;
      font-size: 16px;
      color: var(--text-color-primary);
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      background-color: var(--bg-color-overlay);
      padding: 0 16px;

      .header-title {
        font-weight: 500;
      }

      .header-options {
        display: flex;
        align-items: center;
        font-size: 14px;
        color: var(--text-color-secondary);

        .copy {
          cursor: pointer;
          display: flex;
          align-items: center;

          .el-icon {
            margin-right: 2px;
          }
        }
      }
    }

    .container-code {
      display: flex;
      flex-direction: column;
      height: 148px;
      border-bottom: 1px solid var(--border-color);
      line-height: 20px;
      font-size: 12px;
      color: var(--text-color-regular);
      cursor: text;

      :deep(.vue-codemirror .cm-editor .cm-scroller .cm-line) {
        caret-color: var(--text-color-regular) !important;
      }

      .vue-codemirror {
        font-size: 14px;
        padding: 16px;
      }

      .mirror {
        flex: 1;
        overflow: auto;
      }

      .formula-error {
        background: #FAAD1426;
        color: var(--color-danger);
        height: 32px;
        line-height: 16px;
        font-size: 12px;
        padding: 8px;
      }
    }

    .container-list {
      display: flex;
      flex-direction: row;
      height: 328px;

      .fields-container {
        width: 320px;
        height: 328px;
        padding: 16px;

        .title {
          font-size: 12px;
          color: var(--text-color-secondary);
        }

        .fields-search {
          height: 34px;
          margin: 8px 0 16px 0;
          overflow: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
          &::-webkit-scrollbar {
            display: none;
          }
        }

        .fields-list {
          width: 100%;
          max-height: 224px;
          overflow: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
          &::-webkit-scrollbar {
            display: none;
          }

          .filed-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            height: 32px;
            padding: 6px 8px;
            border-radius: 4px;

            .item-name {
              font-size: 14px;
              max-width: 180px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }

            .item-attr {
              display: flex;
              justify-content: center;
              align-items: center;
              height: 20px;
              line-height: 20px;
              padding: 0 4px;
              font-size: 12px;
              border-radius: 2px;
              border: none !important;
              color: var(--tag-color) !important;
              background-color: var(--tag-bg-color) !important;
            }

            &:hover {
              cursor: pointer;
              background-color: var(--bg-color-hover);
            }
          }
        }
      }

      .formula-menu {
        width: 256px;
        height: 100%;
        border-left: 1px solid var(--border-color);
        padding: 16px;
        overflow: hidden;

        & > .title {
          font-size: 12px;
          color: var(--text-color-secondary);
        }

        .formula-search {
          height: 34px;
          margin: 8px 0 16px 0;
        }

        .formula-list {
          height: 224px;
          gap: 12px;
          overflow: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
          &::-webkit-scrollbar {
            display: none;
          }

          .formula-category {
            min-height: 20px;
            line-height: 20px;
            color: var(--text-color-regular);
            font-size: 14px;
            margin-top: 6px;
            margin-bottom: 6px;
            cursor: pointer;

            .el-icon {
              margin-right: 4px;
            }

            .children {
              margin-top: 10px;

              .formula-item {
                margin-bottom: 16px;
                padding-left: 16px;

                .item-name {
                  line-height: 17px;
                }

                .item-subName {
                  line-height: 17px;
                  margin-top: 4px;
                  font-weight: 500;
                  color: var(--text-color-secondary);
                }

                &:hover {
                  cursor: pointer;
                  background: var(--bg-color-hover);
                }
              }
            }
          }
        }

        .search-list {
          height: calc(100% - 72px);
          padding: 0 8px;
          overflow: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
          &::-webkit-scrollbar {
            display: none;
          }

          .formula-item {
            margin-bottom: 16px;

            &:last-child { 
              margin-bottom: 0;
            }

            .item-name {
              line-height: 17px;
            }

            .item-subName {
              line-height: 17px;
              margin-top: 4px;
              font-weight: 500;
              color: var(--text-color-secondary);
            }

            &:hover {
              background: var(--bg-color-hover);
              cursor: pointer;
            }
          }
        }
      }

      .formula-intro {
        flex: 1;
        height: 272px;
        padding: 0 16px;
        margin-top: 40px;
        border-left: 1px solid var(--border-color);
        line-height: 20px;

        .default-intro-wrapper {
          margin-bottom: 16px;

          li {
            font-size: 14px;
            list-style-type: none;
            padding: 6px 0;
            margin-top: 8px;

            .li-title {
              color: var(--text-color-primary);
            }
          }
        }

        .default-links {
          a {
            display: block;
            margin-bottom: 20px;
            color: var(--color-primary);
          }
        }

        .formula-title {
          height: 32px;
          border-bottom: 1px solid var(--border-color);
          line-height: 20px;
          color: var(--text-color-primary);

          .el-tag {
            margin-left: 8px;
            border: 0;
          }
        }

        .formula-container {
          font-size: 14px;
          padding: 8px;
          line-height: 20px;

          .intro-wrapper {
            li {
              word-wrap: break-word;
              margin-bottom: 4px;
              word-break: break-word;
              margin-bottom: 16px;

              .li-title {
                color: var(--text-color-primary);
              }

              :deep(.formula-name) {
                color: var(--color-primary) !important;
              }
            }
          }
        }
      }
    }

    .keyword {
      color: #00B899
    }

    ::-webkit-scrollbar {
      width: 6px;
    }

    ::-webkit-scrollbar-thumb {
      border-radius: 10px;
      background-color: #555355;
    }

    ::-webkit-scrollbar-corner {
      background: transparent
    }
  }
}
</style>

