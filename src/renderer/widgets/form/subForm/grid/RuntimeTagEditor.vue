<template>
  <el-popover
    v-model:visible="open"
    trigger="click"
    :width="220"
    :show-arrow="false"
    :teleported="true"
    popper-class="runtime-tag-editor__popper"
  >
    <template #reference>
      <div class="runtime-tag-editor">
        <el-input-tag
          class="runtime-tag-editor__display"
          :model-value="value"
          readonly
          :placeholder="displayPlaceholder"
        >
          <template #tag="{ value: tag }">
            <span :title="String(tag)">{{ tag }}</span>
          </template>
        </el-input-tag>
      </div>
    </template>
    <el-input-tag
      ref="editorRef"
      class="runtime-tag-editor__editor"
      :model-value="value"
      :placeholder="editorPlaceholder"
      @update:model-value="handleChange"
      @keydown.escape.stop.prevent="open = false"
    >
      <template #tag="{ value: tag }">
        <span :title="String(tag)">{{ tag }}</span>
      </template>
    </el-input-tag>
  </el-popover>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref, watch } from "vue";
import i18next from "@renderer/widgets/i18next";

const props = withDefaults(defineProps<{
  modelValue: unknown;
  placeholder?: string;
}>(), { placeholder: "" });

const emit = defineEmits<{
  (event: "commit", value: string[]): void;
  (event: "cancel"): void;
}>();

const editorRef = ref<{ focus?: () => void } | null>(null);
const open = ref(false);

const value = computed(() => normalize(props.modelValue));
const displayPlaceholder = computed(() => props.placeholder || i18next.t("subFormPlsAddTag"));
const editorPlaceholder = computed(() => i18next.t("subFormTagInputHint"));

watch(open, visible => {
  if (!visible) return;
  void nextTick(() => editorRef.value?.focus?.());
});

function normalize(input: unknown): string[] {
  if (Array.isArray(input)) return input.filter(item => item !== null && item !== undefined).map(String);
  if (input === null || input === undefined || input === "") return [];
  return String(input).split(",").map(item => item.trim()).filter(Boolean);
}

function handleChange(next: unknown) {
  emit("commit", normalize(next));
}
</script>

<style scoped>
.runtime-tag-editor {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
}

.runtime-tag-editor__display {
  width: 100%;
  pointer-events: none;
}

.runtime-tag-editor__display :deep(.el-input-tag__wrapper) {
  box-sizing: border-box;
  min-height: 28px;
  height: 28px;
  padding: 1px 6px;
  overflow: hidden;
  border-radius: 4px;
  box-shadow: 0 0 0 1px var(--el-border-color, var(--border-color)) inset;
  background: var(--el-fill-color-blank, var(--bg-color));
}

.runtime-tag-editor__display :deep(.el-input-tag__inner) {
  display: block;
  width: 100%;
  height: 26px;
  line-height: 24px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.runtime-tag-editor__display :deep(.el-tag) {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
}

.runtime-tag-editor__display :deep(.el-tag + .el-tag) {
  margin-left: 4px;
}
</style>

<style lang="scss">
.runtime-tag-editor__popper.el-popper {
  padding: 8px;
  background: #fff;
}

.runtime-tag-editor__popper .el-input-tag {
  border-radius: 4px;
}
</style>
