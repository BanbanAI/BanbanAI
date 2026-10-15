<template>
  <el-popover
    v-model:visible="open"
    trigger="click"
    placement="bottom-start"
    :width="320"
    :teleported="true"
    :show-arrow="false"
    popper-class="runtime-address-popover"
    :popper-style="{ zIndex: 3000 }"
    @after-leave="handleAfterLeave"
  >
    <template #reference>
      <input
        class="runtime-address-editor__reference"
        :value="regionPath || detail"
        :placeholder="placeholder"
        readonly
        @click.stop
        @mousedown.stop
      />
    </template>
    <div class="runtime-address-editor__body" @click.stop>
      <el-tree-select
        v-model="regionDraft"
        class="runtime-address-editor__tree"
        :data="regionOptions"
        :cache-data="cacheData"
        lazy
        :load="loadChildren"
        :teleported="false"
        :filterable="true"
        :clearable="true"
        :empty-values="['', null, undefined]"
        :value-on-clear="''"
        :render-after-expand="false"
        :placeholder="placeholder"
        :precision="precision"
        node-key="value"
        :props="treeProps"
        @change="handleRegionChange"
      />
      <textarea
        v-if="withDetail"
        v-model="detailDraft"
        class="runtime-address-editor__detail"
        rows="3"
        :placeholder="detailPlaceholder"
      />
      <div class="runtime-address-editor__actions">
        <button type="button" @click="cancel">{{ i18next.t("subFormCancel") }}</button>
        <button type="button" @click="commit">{{ i18next.t("subFormOk") }}</button>
      </div>
    </div>
  </el-popover>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import i18next from "@renderer/widgets/i18next";
import { getChinaAddressData, type ChinaAddressNode } from "@renderer/utils/township";

const props = withDefaults(defineProps<{
  modelValue: unknown;
  placeholder?: string;
  detailPlaceholder?: string;
  withDetail?: boolean;
  precision?: number;
}>(), {
  placeholder: i18next.t("subFormPlsSelectRegion"),
  detailPlaceholder: i18next.t("subFormPlsInputDetailAddress"),
  withDetail: true,
  precision: 4,
});

const emit = defineEmits<{
  (event: "commit", value: string): void;
  (event: "cancel"): void;
}>();

type RegionNode = { label: string; value: string; isLeaf: boolean };
const treeProps = { value: "value", label: "label", children: "children", isLeaf: "isLeaf" };
const regionOptions = shallowRef<RegionNode[]>([]);
const open = ref(false);
const regionDraft = ref("");
const detailDraft = ref("");
let committed = false;
let previousValue = "";

const splitValue = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  const [region = "", ...detail] = text.split(" ").filter(Boolean);
  return { region, detail: detail.join(" ") };
};

const regionPath = ref("");
const detail = ref("");
const cacheData = computed<RegionNode[]>(() => {
  const labels = regionPath.value.split("/").filter(Boolean);
  return labels.map((label, index) => ({
    label,
    value: labels.slice(0, index + 1).join("/"),
    isLeaf: index === labels.length - 1,
  }));
});
const sync = (value: unknown) => {
  const parts = splitValue(value);
  previousValue = value === null || value === undefined ? "" : String(value);
  regionPath.value = parts.region;
  detail.value = parts.detail;
  regionDraft.value = parts.region;
  detailDraft.value = parts.detail;
};
sync(props.modelValue);

let loadTask: Promise<void> | undefined;
let sourceData: ChinaAddressNode[] = [];
let loadTimer: ReturnType<typeof setTimeout> | undefined;
const createOptions = (items: ChinaAddressNode[], parent = ""): RegionNode[] => items.map(item => ({
  label: String(item.label),
  value: [parent, item.label].filter(Boolean).join("/"),
  isLeaf: item.level <= 5 - Math.max(1, Math.min(4, Number(props.precision) || 4)) || !item.children?.length,
}));

const findSourceNode = (path: string) => {
  const labels = path.split("/").filter(Boolean);
  let nodes = sourceData;
  let match: ChinaAddressNode | undefined;
  for (const label of labels) {
    match = nodes.find(node => node.label === label);
    if (!match) return undefined;
    nodes = match.children || [];
  }
  return match;
};

const loadRegions = async () => {
  if (regionOptions.value.length || loadTask) return loadTask;
  loadTask = getChinaAddressData().then(data => {
    sourceData = data || [];
    regionOptions.value = createOptions(sourceData);
  }).catch(() => {
    sourceData = [];
    regionOptions.value = [];
    loadTask = undefined;
  });
  return loadTask;
};

const loadChildren = async (node: { data?: RegionNode }, resolve: (options: RegionNode[]) => void) => {
  await loadRegions();
  const source = findSourceNode(String(node?.data?.value || ""));
  resolve(source?.children?.length && !node?.data?.isLeaf
    ? createOptions(source.children, String(node.data.value))
    : []);
};

watch(open, visible => {
  if (visible) {
    committed = false;
    sync(props.modelValue);
    loadTimer = setTimeout(() => {
      loadTimer = undefined;
      void loadRegions();
    }, 0);
  } else if (loadTimer) {
    clearTimeout(loadTimer);
    loadTimer = undefined;
  }
});

watch(() => props.modelValue, value => {
  if (!open.value) sync(value);
});

function handleRegionChange(value: unknown) {
  regionDraft.value = value ? String(value) : "";
}

function commit() {
  if (committed) return;
  committed = true;
  const value = `${regionDraft.value || ""} ${props.withDetail ? detailDraft.value : ""}`.trim();
  sync(value);
  open.value = false;
  emit("commit", value);
}

function cancel() {
  if (committed) return;
  committed = true;
  open.value = false;
  sync(previousValue);
  emit("cancel");
}

function handleAfterLeave() {
  if (!committed) cancel();
}

onBeforeUnmount(() => {
  if (loadTimer) clearTimeout(loadTimer);
  loadTask = undefined;
});
</script>

<style scoped>
.runtime-address-editor__reference {
  width: 100%;
  height: 28px;
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid var(--el-border-color, var(--border-color));
  border-radius: 4px;
  padding: 0 8px;
  outline: none;
  background: var(--el-fill-color-blank, var(--bg-color));
  color: var(--el-text-color-regular, var(--text-color-primary));
  font: inherit;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.runtime-address-editor__reference:hover { border-color: var(--el-border-color-hover, var(--el-border-color)); }
.runtime-address-editor__reference:focus {
  border-color: var(--el-color-primary, var(--color-primary));
  box-shadow: 0 0 0 1px var(--el-color-primary, var(--color-primary)) inset;
}
.runtime-address-editor__body {
  display: grid;
  width: 288px;
  gap: 8px;
}
:global(.runtime-address-popover) {
  z-index: 3000 !important;
  box-sizing: border-box;
  width: 320px !important;
  max-width: calc(100vw - 16px);
  padding: 10px !important;
}
.runtime-address-editor__tree { width: 100%; }
.runtime-address-editor__tree :deep(.el-select__wrapper) {
  min-height: 32px;
  border-radius: 4px;
}
.runtime-address-editor__detail {
  width: 100%;
  min-height: 72px;
  box-sizing: border-box;
  padding: 6px 8px;
  resize: vertical;
  border: 1px solid var(--el-border-color, var(--border-color));
  border-radius: 4px;
  outline: none;
  background: var(--el-fill-color-blank, var(--bg-color));
  color: var(--el-text-color-regular, var(--text-color-primary));
  font: inherit;
}
.runtime-address-editor__detail:focus {
  border-color: var(--el-color-primary, var(--color-primary));
  box-shadow: 0 0 0 1px var(--el-color-primary, var(--color-primary)) inset;
}
.runtime-address-editor__actions { display: flex; justify-content: flex-end; gap: 8px; }
.runtime-address-editor__actions button {
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--el-border-color, var(--border-color));
  border-radius: 4px;
  background: var(--el-fill-color-blank, var(--bg-color));
  color: var(--el-text-color-regular, var(--text-color-primary));
  cursor: pointer;
  font: inherit;
}
.runtime-address-editor__actions button:hover { border-color: var(--el-color-primary, var(--color-primary)); color: var(--el-color-primary, var(--color-primary)); }
.runtime-address-editor__actions button:last-child {
  border-color: var(--el-color-primary, var(--color-primary));
  background: var(--el-color-primary, var(--color-primary));
  color: var(--el-color-white, #fff);
}
.runtime-address-editor__actions button:last-child:hover { opacity: 0.9; }
</style>
