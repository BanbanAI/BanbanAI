<template>
  <div class="project-editor-the-right">
    <el-aside :class="['right-aside']" @keydown="" ref="rightAsideRef">
    <edit-unable-mask></edit-unable-mask>
    <bread-crumbs v-if="props.showBreadcrumbs"></bread-crumbs>
    <div class="options">
      <vn-stack v-model="stackActiveTab">
        <div class="tabs">
          <vn-stack-tab class="tab" name="data" v-if="!isActiveBoard">{{ $t("projectEditorTheRight.tabData") }}</vn-stack-tab>
          <vn-stack-tab class="tab" name="style">{{ $t("projectEditorTheRight.tabStyle") }}</vn-stack-tab>
        </div>
        <div class="layers" @click.self="layersClick">
          <vn-stack-layer name="data" class="data" :lazy="true" v-if="!isActiveBoard">
            <div class="b2-options-wrapper">
              <b2-option-group v-for="group in options.data" :element="activeElement" :group="group"
                :key="`${activeElement.uid}-${group.group}`" />
            </div>
          </vn-stack-layer>
          <vn-stack-layer name="style" :lazy="true">
            <div class="element-info" v-if="isWidget(activeElement)">
              <div class="name" :title="activeElement.name">{{ activeElement.name }}</div>
              <div class="type">
                <span>{{ activeElement.defaultName }}</span> | <span>v{{ activeElement.version }}</span>
              </div>
            </div>
            <div class="b2-options-wrapper">
              <b2-option-group v-for="group in options.style" :element="activeElement" :group="group"
                :key="`${activeElement.uid}-${group.group}`" />
            </div>
          </vn-stack-layer>
        </div>
      </vn-stack>
    </div>
    <div class="info" v-if="false">
      <div class="memory" v-if="isMemorySupported">{{ $t("projectEditorTheRight.memory") }}<span :title="memoryInfo.title"><pre>{{ memoryInfo.text }}</pre></span></div>
      <div class="project">{{ $t("projectEditorTheRight.widgetCount") + currentWidgetsCount }}&nbsp;/&nbsp;{{ allWidgetsCount }}</div>
      <div class="fps">{{$t("projectEditorTheRight.fps") + fps }}</div>
      <div class="version">{{ version }}</div>
    </div>
    <teleport to="body">
      <option-role-menu ref="optionRoleMenuRef" />
    </teleport>
    </el-aside>
    <sample-code-popover ref="sampleCodeRef" />
  </div>
</template>

<script lang="ts" setup>
import { ACTIVE_BOARD, ACTIVE_ELEMENT, ACTIVE_FIELD_OPTION, ALL_BOARD, FieldOptionContext, FIELD_OPTION_CONTEXTS, LAYERS_CLICK_TIME, SHOW_SAMPLE_CODE, PROJECT, DELETED_TABLES_UID, OPTION_ROLE_MENU_INSTANCE, EDITOR_RIGHT_SWITCH_TAB, REPORT_ID, ALL_FIELD_OPTION_CONTEXTS, PROJECT_CHANGED, NOCODE_ID, NOCODE } from "@renderer/types";
import { useEventListener, useFps } from "@vueuse/core";
import { useMemory } from "@renderer/hooks/useMemory";
import { computed, inject, provide, Ref, ref, watch } from "vue";
import { isBoard, isWidget, EditorRightStackTab, OptionRoleMenuInstance } from "@renderer/b2/types";
import { PROJECT_ID } from "@renderer/types/inject";
import { usePassportStore } from "@renderer/stores";
import { isEmpty } from "@common/utils/object";
import { ConnectionUID, PrivateDataConnectionUID } from "@common/types/project";
import { isReportConnection } from '@common/utils'
import i18next from "i18next";

const props = withDefaults(defineProps<{
  showBreadcrumbs?: boolean
}>(), {
  showBreadcrumbs: true,
})

const activeBoard = inject(ACTIVE_BOARD);
const allBoard = inject(ALL_BOARD);
const activeElement = inject(ACTIVE_ELEMENT);
const nocode = inject(NOCODE);
const projectId = inject(PROJECT_ID);
const options = computed(() => activeElement.value?.getParsedOptions?.() ?? {});
const isActiveBoard = computed(() => isBoard(activeElement.value))

const fps = useFps();
const passportState = usePassportStore();

const version = ref(__APP_VERSION__);
const currentWidgetsCount = computed(()=>{
  return activeBoard?.value?.widgetsCount || 0;
});
const allWidgetsCount = computed(()=>{
  let count = 0;
  count += allBoard.foreBoard?.widgetsCount || 0;
  count += allBoard.backBoard?.widgetsCount || 0;
  Object.values(allBoard.boards || {}).map((board)=>{
    count += board.widgetsCount;
  });
  return count;
});
const deletedTablesUid = computed(() => {
  return nocode.value?.body.connections.map((connection) => {
    return connection.tables.map(table => {
      if (table.meta.isDeleted) {
        return table.uid;
      }
    });
  }).flat();
})
const { memory, isSupported: isMemorySupported } = useMemory();
const memoryInfo = ref({text: "", title: ""});
watch (()=>memory.value, (newValue)=>{
  if (!isMemorySupported.value || !newValue) {
    return;
  }
  if (!newValue.v8HeapInfo) {
    memoryInfo.value.text = `${newValue.usedJSHeapSize} / ${newValue.totalJSHeapSize} / ${newValue.jsHeapSizeLimit} MB`;
    memoryInfo.value.title = `${i18next.t("projectEditorTheRight.heapMemory")}
  ${i18next.t("projectEditorTheRight.memoryUsingCount") + newValue.usedJSHeapSize} MB
  ${i18next.t("projectEditorTheRight.appliedCount") + newValue.totalJSHeapSize} MB
  V8${i18next.t("projectEditorTheRight.memoryLimit") + newValue.jsHeapSizeLimit} MB`;
  } else {
    const v8HeapInfo = newValue.v8HeapInfo;
    const offHeapUsedSize = newValue.usedJSHeapSize - v8HeapInfo.usedHeapSize;
    memoryInfo.value.text = `${v8HeapInfo.usedHeapSize} / ${v8HeapInfo.totalAvailableSize} / ${v8HeapInfo.heapSizeLimit} MB  ${offHeapUsedSize} / ${newValue.usedJSHeapSize} MB`;
    memoryInfo.value.title = `V8${i18next.t("projectEditorTheRight.heapMemory")}
  ${i18next.t("projectEditorTheRight.memoryUsingCount") + v8HeapInfo.usedHeapSize} MB
  ${i18next.t("projectEditorTheRight.remainCount") + v8HeapInfo.totalAvailableSize} MB
  ${i18next.t("projectEditorTheRight.maxLimit") + v8HeapInfo.heapSizeLimit} MB
${i18next.t("projectEditorTheRight.heapMemory")}
  V8${i18next.t("projectEditorTheRight.offHeapMemory") + offHeapUsedSize} MB
  ${i18next.t("projectEditorTheRight.totalHeapMemoryUsed") + newValue.usedJSHeapSize} MB`;
    // console.debug("内存: " + memoryInfo.value.text);
  }
}, {immediate: true, deep: true});

const sampleCodeRef = ref(null);
const optionRoleMenuRef = ref<OptionRoleMenuInstance>();
const showSampleCode = (_path: string[], _value: any, _reference: HTMLElement) => {
  sampleCodeRef.value?.show(_path, _value, _reference);
}

const stackActiveTab = ref('data');
const switchTab = ([ stackTabName]: [ EditorRightStackTab ]) => {
  stackActiveTab.value = isActiveBoard.value && stackTabName === 'data' ? 'style' : stackTabName;
}

watch(isActiveBoard, (value) => {
  if (value && stackActiveTab.value === 'data') {
    stackActiveTab.value = 'style';
  }
}, {
  immediate: true,
});

// ------------------   处理ProjectData的逻辑 ---------------
const rightAsideRef = ref();
const dataAreaHeight = ref(20);
let isMoving = false;
let startY = null;
let containerHeight = null;
const activeFieldOption: Ref<FieldOptionContext> = ref({});
const fieldOptionContexts = ref<Record<string, FieldOptionContext>>({});  // 用于存放fieldOption的上下文对象

const handleMoving = (ev) => {
  if (!isMoving) return;
  let disY = ev.y - startY;
  let height = dataAreaHeight.value - disY / containerHeight * 100;
  if (height >= 70) {
    height = 70;
  } else if (height <= 10) {
    height = 10;
  }
  dataAreaHeight.value = height;
  startY = ev.y;
};
const handleDown = (ev: MouseEvent) => {
  isMoving = true;
  startY = ev.y;
  containerHeight = rightAsideRef.value?.$el?.clientHeight;
  const cleanMousemove = useEventListener(document, "mousemove", handleMoving);
  const cleanMouseup = useEventListener(document, 'mouseup', (ev: MouseEvent) => {
    isMoving = false
    cleanMousemove();
    cleanMouseup();
  })
};
const layersClickTime = ref(Date.now())
const layersClick = () => {
  layersClickTime.value = Date.now()
}

const getConnectionByUID = (connectionUID: ConnectionUID) => {
  const connections = activeElement.value.getBoard().getConnections();
  return connections.find(connection => connection.uid === connectionUID);
}

// report data
const reportId = inject(REPORT_ID);
const nocodeId = inject(NOCODE_ID);
if (reportId || nocodeId) {
  const allFieldOptionContexts = inject(ALL_FIELD_OPTION_CONTEXTS);
  const fieldActiveFieldOption = inject(ACTIVE_FIELD_OPTION);
  watch(fieldOptionContexts, (value) => {
    allFieldOptionContexts.value[projectId] = value;
  }, { immediate: true });
  watch(activeFieldOption, (value) => {
    fieldActiveFieldOption.value = value;
  }, { deep: true });
}

// dataActiveTabId
const dataActiveTabId = ref('project-data');
watch(() => fieldOptionContexts.value, (value) => {
  const fieldContexts = Object.values(value);
  if (isEmpty(fieldContexts)) {
    dataActiveTabId.value = 'project-data';
  } else {
    const fields = fieldContexts[0]?.getFields?.();
    if (isEmpty(fields)){
      dataActiveTabId.value = 'project-data';
      return;
    }
    const uid = fields[0].uid;
    if (uid[0] === PrivateDataConnectionUID) {
      dataActiveTabId.value = 'private-data';
    } else if (isReportConnection(getConnectionByUID(uid[0]))) {
      dataActiveTabId.value = 'report-data';
    } else {
      dataActiveTabId.value = 'project-data';
    }
  }
}, {
  immediate: true,
  deep: true,
})

provide(SHOW_SAMPLE_CODE, showSampleCode);
provide(OPTION_ROLE_MENU_INSTANCE, optionRoleMenuRef);

provide(LAYERS_CLICK_TIME,layersClickTime);
provide(ACTIVE_FIELD_OPTION, activeFieldOption);
provide(FIELD_OPTION_CONTEXTS, fieldOptionContexts)
provide(DELETED_TABLES_UID, deletedTablesUid);
provide(EDITOR_RIGHT_SWITCH_TAB, switchTab);
</script>

<style lang="scss" scoped>
.project-editor-the-right {
  width: 300px;
  height: 100%;

  .right-aside {
    width: 100%;
  }
}

.right-aside {
  width: 300px;
  height: 100%;
  background-color: var(--bg-color-page);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  .options {
    flex: 1;
    min-height: 0;

    .vn-stack {
      height: 100%;
      display: flex;
      flex-direction: column;

      .tabs {
        background-color: var(--tabs-bg-color);
        height: 36px;
        line-height: 36px;
        color: var(--tabs-text-color);
        padding-left: 10px;

        .tab {
          padding: 0 8px;
          height: 36px;
          text-align: center;
          border-bottom: 2px solid transparent;
          cursor: var(--cursor-pointer);
          display: inline-block;
        }

        .tab.active {
          border-bottom-color: var(--color-primary);
        }
      }

      .layers {
        flex: 1;
        min-height: 0;
        overflow-y: scroll;
        overflow-x: hidden;

        &::-webkit-scrollbar {
          width: 0 !important
        }

        .vn-stack-layer {
          width: 100%;
          height: 100%;
        }

        .element-info {
          padding: 10px;
          color: var(--text-color-inactive);
          position: relative;

          .name {
            font-size: 15px;
            color: var(--text-color-primary);
            display: inline-block;
            max-width: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .type {
            margin-top: 2px;
          }
          .doc {
            background-color: var(--color-primary);
            color: var(--color-white);
            cursor: var(--cursor-pointer);
            padding: 4px 5px;
            border-radius: 2px;
            position: absolute;
            right: 12px;
            top: 6px;
          }
          .doc:hover {
            background-color: var(--primary-color-hover);
          }
          .path {
            margin-top: 4px;
            word-wrap: break-word;
          }
          .building-widget-details-wrapper {
            margin-top: 5px;
          }
        }

        .widget-list {
          height: calc(100% - 30px);
        }

        .data.active {
          height: 100%;
          width: 100%;
          display: flex;
          flex-direction: column;

          .b2-options-wrapper {
            flex: 1;
            overflow-y: scroll;

            &::-webkit-scrollbar {
              display: none;
            }
          }
        }
        .button-wrapper{
          width: 100%;
          text-align: center;
          height: 50px;
          padding: 10px;
        }
      }
    }
  }

  .info {
    height: 40px;
    background-color: var(--bg-color);
    border-top: 1px solid var(--border-color-light);
    width: 100%;
    position: relative;
    color: var(--text-color-regular);

    pre {
      display: inline-block;
    }

    .version {
      position: absolute;
      right: 3px;
      bottom: 3px;
    }

    .fps {
      position: absolute;
      right: 3px;
      top: 3px;
    }

    .project {
      position: absolute;
      left: 3px;
      bottom: 3px;
    }

    .memory {
      position: absolute;
      left: 3px;
      top: 3px;
    }
  }
}
.option-menu-div {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgba($color: #000000, $alpha: 0.2);
  z-index: 3000;

  :deep(.context-menu) {
    .el-menu-item {
      padding-left: 10px;
    }
  }
}

.tabs-data {
  cursor: move;
  user-select: none;
  border-top: 1px solid var(--border-color);
}
</style>
