<template>
  <div class="formula-container">
    <el-dialog 
      class="form-formula-dialog" 
      :modelValue="isVisible" 
      @update:modelValue="emit('update:modelValue', $event)" 
      @open="onOpen"
      :title="$t('SourceTableFormulaDialog.editFormula')" 
      :align-center="true" 
      width="1008" 
      destroy-on-close 
      :close-on-click-modal="false" 
      ref="dialogRef"
      draggable
    >
      <div v-if="hasBodyHeaderExtra" class="dialog-body-header__extra">
        <slot name="body-header-extra" />
      </div>
      <formula-editer ref="formulaEditor" :defaultTables="defaultTables" :linkedTables="linkedTables" :tables="tables" :otherTableLabel="otherTableLabel"
       :defaultValue="value" :hiddenCurrentTable="hiddenCurrentTable" v-bind="attrs" :filterFunctions="filterFunctions"></formula-editer>
      <template #footer>
        <div class="footer" :class="{ 'footer--with-prefix': hasFooterPrefix }">
          <div v-if="hasFooterPrefix" class="footer__prefix">
            <slot name="footer-prefix" />
          </div>
          <div class="footer__actions">
            <el-button class="cancel" type="default" @click="dialogClosed">{{ $t('SourceTableFormulaDialog.cancel') }}</el-button>
            <el-button class="confirm" type="primary" @click="confirm">{{ $t('SourceTableFormulaDialog.confirm') }}</el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, useAttrs, useSlots } from "vue";
import { Table, TableWithSource } from "@common/types/project";
import FormulaEditer from "./FormulaEditer.vue"
import { replaceBracketId } from "./utils";
import i18next from "i18next";

const props = withDefaults(defineProps<{
  modelValue: boolean;
  value?: string;
  defaultTables: Table[];
  linkedTables?: TableWithSource[];
  tables: TableWithSource[];
  otherTableLabel: string;
  hiddenCurrentTable: false;
  filterFunctions?: string[];
  beforeConfirm?: (value: string) => boolean | Promise<boolean>;
}>(), {
  tables: () => [],
  linkedTables: () => [],
  otherTableLabel: () => i18next.t('SourceTableFormulaDialog.otherForm'),
  filterFunctions: () => [],
  beforeConfirm: undefined,
});

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void;
  (event: "update", value: string): void;
}>();

const attrs = useAttrs();
const slots = useSlots();
const formulaEditor = ref();

const isVisible = computed(() => {
  return props.modelValue;
})
const hasBodyHeaderExtra = computed(() => Boolean(slots["body-header-extra"]));
const hasFooterPrefix = computed(() => Boolean(slots["footer-prefix"]));

const dialogRef = ref();

const dialogClosed = () => {
  formulaEditor.value.clear();
  emit("update:modelValue", false);
};

const updateFormulaFieldAlias = (formula: string, tables: Table[]) => {
  const newFormula = replaceBracketId(formula, (ids, aliases) => {
    let [tableUID, field_uid, subField_uid, source_uid] = ids;
    const table = tables.find(table => table.uid === tableUID);

    const field = table.fields.find(field => field.uid === field_uid);
    if (!field) { // 引用字段被删除
      return `${ids.join(".")},${i18next.t('SourceTableFormulaDialog.fieldDeleted')}`;
    }

    if (subField_uid) {
      const subField = field.subTableFields.find(f => f.uid === subField_uid);
      if (!subField) {// 引用字段被删除
        return `${ids.join(".")},${i18next.t('SourceTableFormulaDialog.fieldDeleted')}`;
      }

      return `${table.uid}.${field.uid}.${subField.uid},${table.alias}.${field.alias}.${subField.alias}`
    } else {
        return `${table.uid}.${field.uid},${table.alias}.${field.alias}`
    }
  })

  return newFormula
}

const onOpen = () => {
  const formula = updateFormulaFieldAlias(props.value, [...props.defaultTables, ...props.tables, ...props.linkedTables])
  formulaEditor.value.init(formula);
}

const confirm = async () => {
  const formula = formulaEditor.value.getCodeMirrorText();
  const isPass = await props.beforeConfirm?.(formula);
  if (isPass === false) return;
  emit("update", formula);
  formulaEditor.value.clear();

  dialogClosed();
}
</script>

<style lang="scss" scoped>
.formula-container {
  :deep(.el-dialog) {
    --el-dialog-padding-primary: 0;
    --el-dialog-bg-color: var(--color-white);
    border-radius: 4px;
    max-height: 90vh;

    .el-dialog__header {
      height: 40px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .el-dialog__body {
      padding: 16px;

      .container-code {
        max-height: calc(90vh - 520px);
      }

      .el-input {
        --el-input-placeholder-color: var(--text-color-placeholder);

        .el-input__wrapper {
          border-radius: 4px;
          border: 1px solid var(--border-color);
          padding: 0 0 0 9px;
          box-shadow: none;
          height: 32px;

          .el-input__prefix {
            color: var(--text-color-regular);
          }
        }
      }

      .el-select__wrapper {
        height: 32px;
        border-radius: 4px;
      }
    }

    .el-dialog__footer {
      padding: 8px 16px 16px;

      .el-button {
        border-radius: 4px;
        height: 32px;
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

  .dialog-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  .dialog-header__title {
    font-size: 14px;
    line-height: 20px;
  }

  .dialog-header--with-extra {
    justify-content: space-between;
  }

  .dialog-body-header__extra {
    flex: none;
    width: 100%;
    min-width: 0;
  }

  .footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
  }

  .footer--with-prefix {
    justify-content: space-between;
  }

  .footer__prefix {
    min-width: 0;
    flex: 1;
  }

  .footer__actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }
}
</style>
