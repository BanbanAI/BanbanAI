<template>
  <div class="custom-data-title-dialog">
    <el-dialog class="form-visibility-dialog" :modelValue="modelValue" :title="$t('dataTitleLabel')" width="680"
      @update:modelValue="emit('update:modelValue', $event)" align-center destroy-on-close :close-on-click-modal="false"
      @open="onOpen" @closed="onClosed">

      <div class="content">
        <div class="menus">
          <el-header>
            <div class="title">{{ $t("allFields") }}</div>
            <el-input :placeholder="$t('searchField')" v-model="searchValue">
              <template #prefix>
                <el-icon :size="16"><i-ep-search /></el-icon>
              </template>
            </el-input>
          </el-header>
          <el-scrollbar class="field-list">
            <div class="field-item" v-for="field in fields" :key="field.uid" @click="insertTag(field)">{{
              field.title }}</div>
          </el-scrollbar>
        </div>
        <div class="editor">
          <div class="editor-main" ref="editorRef">

          </div>
        </div>
      </div>
      <p class="tip">
        ⓘ {{ i18next.t("dataTitleSupportTip") }}
      </p>
      <template #footer>
        <el-button @click="emit('update:modelValue', false)">{{ i18next.t("cancel") }}</el-button>
        <el-button type="primary" @click="handleConfirm">{{ i18next.t("confirm") }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script lang='ts' setup>
import { computed, ref } from 'vue';
import { Form } from '../../form';
import { tagReg, useCodemirror } from './editor';
import IEpSearch from "~icons/ep/search";
import { FormElement } from '@renderer/b2/controllers/form';
import i18next, { $t } from "@renderer/widgets/i18next";

const props = defineProps<{
  modelValue: boolean;
  widget: Form;
  value: string;
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void;
  (event: "update", value): void;
}>();

const { code, view, editorRef, init, destroyed, insertTag } = useCodemirror();

const searchValue = ref("");

const showParentTitle = ['widget.form.multipleTabs', 'widget.form.tabPanel', 'widget.form.subform'];
const getFieldTitle = (element: FormElement) => {
  const title = element.title || "";
  if (element.parent && showParentTitle.includes(element.parent.type)) {
    return `${getFieldTitle(element.parent as FormElement)}.${title}`;
  }
  return title;
}

const allowTypes = [ "widget.form.textInput", "widget.form.radioGroup", "widget.form.treeSelect", "widget.form.memberSelect", "widget.form.serialNumber"];
const allFields = computed(() => {
  return (props.widget.container.getChildWidgets(true) as FormElement[]).filter(w => {
    return !w.isInSubForm && allowTypes.includes(w.type);
  }).map(w => {
    return {
      uid: w.uid,
      title: getFieldTitle(w),
      type: w.type,
    };
  });
})
const fields = computed(() => {
  return allFields.value.filter(w => {
    return w.title?.includes(searchValue.value);
  });
})

const handleConfirm = () => {
  const text = String(view.value.state.doc)?.replace(tagReg, (origin, key) => {
    const [id] = key?.split(".");
    if (!id) return origin;
    return `{:${id}}`;
  });
  emit("update", text);
  emit("update:modelValue", false)
}

const onOpen = () => {
  searchValue.value = "";
  code.value = (props.value || "")?.replace(tagReg, (origin, key) => {
    const element = allFields.value.find(f => f.uid === key);
    if (!element) return "";
    return `{:${key}.${element.title}}`;
  })
  init();
}

const onClosed = () => {
  destroyed();
}
</script>

<style lang='scss' scoped>
.custom-data-title-dialog {
  :deep(.el-dialog) {
    --el-dialog-padding-primary: 0;
    height: 528px;
    max-height: 100%;

    .el-dialog__header {
      height: 40px;
      padding: 0;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: center;
      --el-dialog-title-font-size: 14px;

      .el-dialog__headerbtn {
        width: 40px;
        height: 40px;
      }
    }

    .el-dialog__body {
      padding: 24px 16px;
      height: calc(100% - 40px - 56px);

      .content {
        border: 1px solid var(--border-color);
        height: 100%;
        display: flex;

        .menus {
          width: 320px;
          height: 100%;
          border-right: 1px solid var(--border-color);

          .el-header {
            padding: 16px;
            height: 92px;
            border-bottom: 1px solid var(--border-color);

            .title {
              line-height: 20px;
            }

            .el-input {
              margin-top: 8px;
            }
          }

          .field-list {
            height: calc(100% - 92px);

            .field-item {
              height: 36px;
              padding-left: 16px;
              line-height: 36px;
              cursor: pointer;
              user-select: none;

              &:hover {
                background-color: var(--bg-color-hover);
              }
            }
          }
        }

        .editor {
          flex: 1;

          .editor-main {
            width: 100%;
            height: 100%;

            .cm-editor {
              height: 100%;
              outline: unset;
              --code-height: 30px;

              .cm-scroller {

                &::-webkit-scrollbar {
                  width: 8px;
                }

                &::-webkit-scrollbar-thumb {
                  border-radius: 4px;
                }

                &::-webkit-scrollbar-track {
                  border-radius: 4px;
                }

                .cm-gutterElement:not(:first-of-type) {
                  line-height: var(--code-height);
                }
              }

              .cm-content {
                cursor: text;

                .cm-line {
                  height: var(--code-height);
                  line-height: var(--code-height);
                }
              }
            }
          }
        }

      }

      .tip {
        margin-top: 8px;
        color: var(--text-color-secondary);
        font-size: 12px;
      }
    }

    .el-dialog__footer {
      padding: 8px 16px 16px;
    }
  }
}
</style>
