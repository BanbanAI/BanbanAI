<template>
  <el-dialog
    class="hidden-field-submit-special-rules-dialog"
    :modelValue="modelValue"
    :title="t('hiddenFieldSubmit.specialRulesDialogTitle')"
    header-class="dialog-header"
    width="620"
    align-center
    destroy-on-close
    draggable
    :close-on-click-modal="false"
    @open="onOpen"
    @update:modelValue="emit('update:modelValue', $event)"
  >
    <div class="dialog-body">
      <div class="rule-section" v-for="group in hiddenFieldSubmitRuleGroupsComp" :key="group.mode">
        <div class="section-header">
          <span class="section-title">{{ group.title }}</span>
          <field-selector
            class="field-picker"
            :options="getFieldOptionsByMode(group.mode)"
            close-on-select
            @select="addField(group.mode, $event.value)"
          >
            {{ t("hiddenFieldSubmit.addField") }}
          </field-selector>
        </div>
        <div class="field-list" v-if="selectedFieldsByMode(group.mode).length">
          <div class="field-item" v-for="field in selectedFieldsByMode(group.mode)" :key="field.value">
            <span class="field-name" :title="field.label">{{ field.label }}</span>
            <el-icon class="delete-icon" :size="16" @click="removeField(field.value)">
              <i-ep-delete />
            </el-icon>
          </div>
        </div>
        <div class="empty-text" v-else>{{ t("hiddenFieldSubmit.noFields") }}</div>
      </div>
    </div>

    <template #footer>
      <el-button class="cancel-btn btn" @click="emit('update:modelValue', false)">{{ t("hiddenFieldSubmit.cancel") }}</el-button>
      <el-button class="confirm-btn btn" type="primary" @click="confirm">{{ t("hiddenFieldSubmit.confirm") }}</el-button>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import i18next from "i18next";
import { computed, ref, type PropType } from "vue";
import {
  HIDDEN_FIELD_SUBMIT_MODE_OPTION,
  HiddenFieldSubmitMode,
  normalizeHiddenFieldSubmitMode,
  normalizeHiddenFieldSubmitSpecialRules,
  type HiddenFieldSubmitSpecialRules,
} from "@common/utils/hiddenFieldSubmitPolicy";
import { isBuiltinField } from "@common/utils/connection";
import type { AbstractForm } from "@renderer/b2/controllers/form";
import FieldSelector from "./FieldSelector.vue";

type FieldOption = {
  label: string;
  value: string;
  disabled: boolean;
};

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true,
  },
  value: {
    type: Object as PropType<HiddenFieldSubmitSpecialRules>,
    default: void 0,
  },
  widget: {
    type: Object as PropType<AbstractForm>,
    required: true,
  },
});

const emit = defineEmits({
  "update:modelValue": (value: boolean) => typeof value === "boolean",
  update: (value: HiddenFieldSubmitSpecialRules) => !!value && typeof value === "object",
});

const t = i18next.t.bind(i18next);
const rules = ref<HiddenFieldSubmitSpecialRules>({});
const hiddenFieldSubmitRuleGroups = [
  { title: t("hiddenFieldSubmit.modeRecalculate"), mode: HiddenFieldSubmitMode.RECALCULATE },
  { title: t("hiddenFieldSubmit.modeKeepOriginal"), mode: HiddenFieldSubmitMode.KEEP_ORIGINAL },
  { title: t("hiddenFieldSubmit.modeEmpty"), mode: HiddenFieldSubmitMode.EMPTY },
] as const;
const hiddenFieldSubmitRuleGroupsComp = computed(() => {
  return hiddenFieldSubmitRuleGroups.filter(item => item.mode !== defaultMode.value);
});

const table = computed(() => {
  return props.widget?.getTable?.(props.widget.tableUID);
});

const defaultMode = computed(() => {
  return normalizeHiddenFieldSubmitMode(props.widget?.getOption?.(HIDDEN_FIELD_SUBMIT_MODE_OPTION));
});

const fieldOptions = computed<FieldOption[]>(() => {
  const options: FieldOption[] = [];
  for (const field of table.value?.fields || []) {
    if (isBuiltinField(field)) {
      continue;
    }
    options.push({
      label: field.alias || field.meta?.name || field.uid,
      value: field.uid,
      disabled: false,
    });
  }
  return options;
});

const fieldOptionMap = computed(() => {
  return new Map(fieldOptions.value.map(item => [item.value, item]));
});

const selectedFieldsByMode = (mode: HiddenFieldSubmitMode) => {
  return Object.entries(rules.value)
    .filter(([, value]) => value === mode)
    .map(([fieldPath]) => fieldOptionMap.value.get(fieldPath))
    .filter(Boolean) as FieldOption[];
};

const getFieldOptionsByMode = (mode: HiddenFieldSubmitMode) => {
  return fieldOptions.value.map(item => ({
    ...item,
    disabled: mode === defaultMode.value || rules.value[item.value] !== undefined,
  }));
};

const addField = (mode: HiddenFieldSubmitMode, fieldPath?: string) => {
  if (!fieldPath) {
    return;
  }
  if (mode === defaultMode.value || rules.value[fieldPath] !== undefined) {
    return;
  }
  rules.value = {
    ...rules.value,
    [fieldPath]: mode,
  };
};

const removeField = (fieldPath: string) => {
  const nextRules = { ...rules.value };
  delete nextRules[fieldPath];
  rules.value = nextRules;
};

const normalizeRules = (inputRules: HiddenFieldSubmitSpecialRules) => {
  const availableFieldPaths = new Set(fieldOptions.value.map(item => item.value));
  return Object.entries(inputRules).reduce<HiddenFieldSubmitSpecialRules>((prev, [fieldPath, mode]) => {
    if (availableFieldPaths.has(fieldPath) && mode !== defaultMode.value) {
      prev[fieldPath] = mode;
    }
    return prev;
  }, {});
};

const onOpen = () => {
  rules.value = normalizeRules(normalizeHiddenFieldSubmitSpecialRules(props.value));
};

const confirm = () => {
  emit("update", normalizeRules(rules.value));
  emit("update:modelValue", false);
};
</script>

<style lang="scss">
.hidden-field-submit-special-rules-dialog {
  --el-dialog-title-font-size: 16px;
  --el-dialog-padding-primary: 24px;
  background: var(--bg-color-page);
  border-radius: 8px;
  .dialog-header {
    text-align: center;
  }
  .btn {
    border-radius: 4px;
  }
}
</style>

<style lang="scss" scoped>
.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 320px;
}

.rule-section {
  border-bottom: 1px solid var(--border-color-light);
  padding-bottom: 16px;

  &:last-child {
    border-bottom: 0;
    padding-bottom: 0;
  }
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  font-size: 14px;
}

.section-title {
  color: var(--text-color-primary);
  font-weight: 600;
}

.field-picker {
}

.field-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-item {
  align-items: center;
  display: flex;
  justify-content: space-between;
  min-height: 32px;

  .field-name {
    padding: 0 10px;
    align-items: center;
    display: inline-flex;
    min-height: 32px;
    background: var(--bg-color-overlay);
    border-radius: 4px;
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}


.delete-icon {
  color: var(--text-color-secondary);
  cursor: var(--cursor-pointer);
  flex: 0 0 auto;
  padding-left: 10px;
  width: 24px;
  height: 24px;

  &:hover {
    color: var(--color-danger);
  }
}

.empty-text {
  color: var(--text-color-secondary);
  font-size: 13px;
  line-height: 32px;
}
</style>
