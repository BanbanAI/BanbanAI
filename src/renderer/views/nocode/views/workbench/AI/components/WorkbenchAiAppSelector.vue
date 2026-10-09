<template>
  <div ref="selectorRef" class="workbench-ai-app-selector" :class="{ 'is-open': panelVisible }">
    <button
      type="button"
      class="workbench-ai-app-selector__trigger"
      :aria-label="$t('WorkbenchAiAppSelector.linkApp')"
      @click.stop="togglePanel"
    >
      <el-icon :size="18">
        <i-ven-ai-sidebar-apps />
      </el-icon>
    </button>

    <div v-show="panelVisible" class="workbench-ai-app-selector__panel">
      <div class="workbench-ai-app-selector__search">
        <el-icon class="workbench-ai-app-selector__search-icon" :size="16">
          <i-ep-search />
        </el-icon>
        <input
          v-model="searchValue"
          type="text"
          class="workbench-ai-app-selector__search-input"
          :placeholder="$t('WorkbenchAiAppSelector.input')"
        />
      </div>

      <div class="workbench-ai-app-selector__section-title">{{ $t('WorkbenchAiAppSelector.accessibleApps') }}</div>

      <button
        type="button"
        class="workbench-ai-app-selector__option is-all"
        :class="{ 'is-selected': selectedAppIds.length === 0 }"
        @click="selectAllApps"
      >
        <span class="workbench-ai-app-selector__option-icon is-all">
          <el-icon :size="14">
            <i-ven-ai-sidebar-apps />
          </el-icon>
        </span>
        <span class="workbench-ai-app-selector__option-label">{{ $t('WorkbenchAiAppSelector.all') }}</span>
        <el-icon
          class="workbench-ai-app-selector__option-check"
          :class="{ 'is-visible': selectedAppIds.length === 0 }"
          :size="16"
        >
          <i-ep-check />
        </el-icon>
      </button>

      <div class="workbench-ai-app-selector__options">
        <button
          v-for="app in filteredAppOptions"
          :key="app.id"
          type="button"
          class="workbench-ai-app-selector__option"
          :class="{ 'is-selected': selectedAppIds.includes(app.id) }"
          @click="toggleApp(app.id)"
        >
          <span class="workbench-ai-app-selector__option-icon">
            <el-icon :size="14">
              <i-ven-ai-sidebar-apps />
            </el-icon>
          </span>
          <span class="workbench-ai-app-selector__option-label">{{ app.name }}</span>
          <el-icon
            class="workbench-ai-app-selector__option-check"
            :class="{ 'is-visible': selectedAppIds.includes(app.id) }"
            :size="16"
          >
            <i-ep-check />
          </el-icon>
        </button>

        <div v-if="!filteredAppOptions.length" class="workbench-ai-app-selector__empty">
          {{ $t('WorkbenchAiAppSelector.noMatchingApps') }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import axios from "axios";
import { computed, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";
import { createAccessibleAppOptionsLoader } from "./workbench-ai-app-selector.loader";

const props = defineProps({
  appIds: {
    type: Array as PropType<string[]>,
    default: () => [],
  },
});

const emit = defineEmits(["change", "panel-close"]);

const selectorRef = ref<HTMLElement | null>(null);
const panelVisible = ref(false);
const searchValue = ref("");
const selectedAppIds = ref<string[]>([]);
const {
  appOptions,
  ensureAppOptionsLoaded,
  loadAppOptions,
} = createAccessibleAppOptionsLoader(async () => {
  const { data } = await axios.get("/ai/threads/accessible-apps");
  return data;
});

const filteredAppOptions = computed(() => {
  const keyword = searchValue.value.trim().toLowerCase();
  if (!keyword) {
    return appOptions.value;
  }

  return appOptions.value.filter((app) =>
    app.name.toLowerCase().includes(keyword),
  );
});

const emitSelectedAppIdsChange = () => {
  emit("change", [...selectedAppIds.value]);
};

const closePanel = () => {
  if (!panelVisible.value) return;
  panelVisible.value = false;
  emit("panel-close", [...selectedAppIds.value]);
};

const togglePanel = () => {
  if (panelVisible.value) {
    closePanel();
    return;
  }

  panelVisible.value = true;
  void loadAppOptions({ force: true }).catch((error) => {
    console.error("加载应用列表失败:", error);
  });
};

const toggleApp = (id: string) => {
  const nextSelectedAppIds = selectedAppIds.value.includes(id)
    ? selectedAppIds.value.filter((appId) => appId !== id)
    : [...selectedAppIds.value, id];

  selectedAppIds.value = nextSelectedAppIds;
  emitSelectedAppIdsChange();
};

const selectAllApps = () => {
  if (selectedAppIds.value.length === 0) return;

  selectedAppIds.value = [];
  emitSelectedAppIdsChange();
};

const syncSelectedAppIds = () => {
  selectedAppIds.value = Array.isArray(props.appIds) ? [...props.appIds] : [];
};

const handleDocumentPointerDown = (event: PointerEvent) => {
  const target = event.target;
  if (!(target instanceof Node)) return;
  if (selectorRef.value?.contains(target)) return;

  closePanel();
};

watch(() => props.appIds, () => {
  syncSelectedAppIds();
}, { deep: true });

onMounted(() => {
  syncSelectedAppIds();
  void ensureAppOptionsLoaded().catch((error) => {
    console.error("加载应用列表失败:", error);
  });
  document.addEventListener("pointerdown", handleDocumentPointerDown);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleDocumentPointerDown);
});
</script>

<style scoped lang="scss">
.workbench-ai-app-selector {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;

  .workbench-ai-app-selector__trigger {
    width: 36px;

    height: 36px;
    border: 1px solid #d9dde3;
    border-radius: 50%;
    background: #ffffff;
    color: #1d2129;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: var(--cursor-pointer);
    transition:
      color 0.2s ease;

    &:hover {
      background-color: #F2F3F5;
    }
  }

  &.is-open {
    .workbench-ai-app-selector__trigger {
      background-color: #F2F3F5;
    }
  }

  .workbench-ai-app-selector__panel {
    position: absolute;
    left: 0;
    bottom: calc(100% + 10px);
    width: 200px;
    padding: 5px;
    border: 1px solid #e5e6eb;
    border-radius: 8px;
    background: #ffffff;
    box-shadow: 0 8px 24px 0 rgba(29, 33, 41, 0.12);
    z-index: 30;
  }

  .workbench-ai-app-selector__search {
    height: 36px;
    padding: 0 12px;
    border-radius: 10px;
    background: #F2F3F5;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .workbench-ai-app-selector__search-icon {
    color: #86909c;
    flex-shrink: 0;
  }

  .workbench-ai-app-selector__search-input {
    width: 100%;
    border: 0;
    padding: 0;
    background: transparent;
    color: #1d2129;
    font-size: 14px;
    line-height: 22px;
    outline: none;

    &::placeholder {
      color: #c9cdd4;
    }
  }

  .workbench-ai-app-selector__section-title {
    height: 36px;
    color: #86909c;
    font-size: 14px;
    line-height: 36px;
    padding-left: 12px;
  }

  .workbench-ai-app-selector__options {
    max-height: 170px;
    overflow-y: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .workbench-ai-app-selector__option {
    width: 100%;
    height: 34px;
    margin-bottom: 2px;
    padding-left: 12px;
    padding-right: 10px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    display: flex;
    align-items: center;
    gap: 8px;
    color: #1d2129;
    text-align: left;
    cursor: var(--cursor-pointer);
    transition:
      background-color 0.2s ease,
      color 0.2s ease;

    &:hover,
    &.is-selected {
      background: #f2f3f5;
    }

    &:last-child {
      margin-bottom: 0;
    }
  }

  .workbench-ai-app-selector__option-icon {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    background: linear-gradient(180deg, #5cb0ff 0%, #2f86ff 100%);
    color: #ffffff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    &.is-all {
      background-color: linear-gradient(0deg, #6D6A6A, #6D6A6A),
        linear-gradient(180deg, #66B8FF 0%, #0873FF 100%);
    }
  }

  .workbench-ai-app-selector__option-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
    line-height: 22px;
  }

  .workbench-ai-app-selector__option-check {
    color: #0873ff;
    opacity: 0;
    transition: opacity 0.2s ease;

    &.is-visible {
      opacity: 1;
    }
  }

  .workbench-ai-app-selector__empty {
    padding: 12px 16px 4px;
    color: #86909c;
    font-size: 13px;
    line-height: 20px;
  }
}
</style>
