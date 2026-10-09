<template>
  <div class="data-form-side-panel">
    <el-button class="fold-button" text @click="emit('fold')">
      <el-icon :size="16">
        <i-ven-icon-double-right-arrow />
      </el-icon>
    </el-button>

    <el-tabs v-model="activeTab" class="panel-tabs">
      <el-tab-pane v-if="showFlowTab" :label="$t('dataFormSidePanel.workflow')" name="flow">
        <div class="panel-body">
          <process-flows v-if="todo && activeTab === 'flow'" :todo="todo" :isShowTitle="false" />
          <nocode-empty-state v-else :description="$t('dataFormSidePanel.emptyWorkflow')" />
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue';
import type { TODO } from '@common/types/nocode';
import NocodeEmptyState from '@renderer/views/nocode/components/global/NocodeEmptyState.vue';
import ProcessFlows from '../../../ProcessFlows.vue';

// eslint-disable-next-line vue/valid-define-props
const props = defineProps<{
  todo?: TODO,
  showFlowTab?: boolean,
  defaultActiveTab?: 'flow',
}>();

// eslint-disable-next-line vue/valid-define-emits
const emit = defineEmits<{
  (event: 'fold'): void,
}>();

const getAvailableTabs = () => {
  const tabs: Array<'flow'> = [];
  if (props.showFlowTab) {
    tabs.push('flow');
  }
  return tabs;
};

const resolveActiveTab = (preferred?: 'flow') => {
  const tabs = getAvailableTabs();
  if (!tabs.length) {
    return 'flow';
  }
  if (preferred && tabs.includes(preferred)) {
    return preferred;
  }
  if (props.defaultActiveTab && tabs.includes(props.defaultActiveTab)) {
    return props.defaultActiveTab;
  }
  if (tabs.includes('flow')) {
    return 'flow';
  }
  if (tabs.includes('log')) {
    return 'log';
  }
  return tabs[0];
};

const activeTab = ref(resolveActiveTab());

watch(() => ({
  showFlowTab: props.showFlowTab,
  defaultActiveTab: props.defaultActiveTab,
}), () => {
  activeTab.value = resolveActiveTab(activeTab.value);
}, {
  immediate: true,
});
</script>

<style lang="scss" scoped>
.data-form-side-panel {
  position: relative;
  width: 320px;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-left: 1px solid var(--border-color);
  background: #fff;

  .fold-button {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 2;
    padding: 0;
    width: 28px;
    height: 28px;
    border-radius: 4px;
  }

  .panel-tabs {
    height: 100%;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;

    :deep(.el-tabs__header) {
      flex-shrink: 0;
      margin: 0;
      padding: 0 12px;
      border-bottom: 1px solid var(--border-color);
    }

    :deep(.el-tabs__nav-wrap::after) {
      display: none;
    }

    :deep(.el-tabs__item) {
      height: 40px;
      line-height: 40px;
      padding: 0 16px;
    }

    :deep(.el-tabs__content) {
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    :deep(.el-tab-pane) {
      height: 100%;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
  }

  .panel-body {
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;


    :deep(.el-empty),
    :deep(.nocode-empty-state) {
      height: 100%;
    }

    :deep(.process-flows) {
      height: 100%;
      flex: 1;
      min-height: 0;
    }

  }
}
</style>
