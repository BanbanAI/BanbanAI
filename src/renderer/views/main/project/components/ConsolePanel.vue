<template>
  <div class="console-panel">
    <vn-stack v-model="stackActiveTab">
      <div class="header">
        <span class="clear-icon" @click.stop.prevent="clearConsolePanel"><i class="fs fs-clear"></i></span>
        <div class="tabs">
          <vn-stack-tab class="tab" name="projectLogs">{{ $t("consolePanel.consoleProjectTitle") }}</vn-stack-tab>
        </div>
        <span class="remove-icon" @click.stop.prevent="emit('close')"><i class="fs fs-remove"></i></span>
      </div>
      <div class="layers">
        <vn-stack-layer name="projectLogs">
          <div class="messages">
            <el-auto-resizer>
              <template #default="{ height, width }">
                <el-table-v2 ref="tableProjectRef" :columns="columns" :data="projectLogs" :height="height" :width="width" :cache="10"
                  :header-height="0">
                  <template #cell="{ rowData }: { rowData: ProjectLogView }">
                    <div class='row-container'>
                      <el-scrollbar>
                        <div class='row-message'>
                          <div class="time">{{ rowData.currentTime }}</div>
                          <div class="message">{{ rowData.message }}</div>
                        </div>
                      </el-scrollbar>
                    </div>
                  </template>
                  <template #empty>
                    <div></div>
                  </template>
                </el-table-v2>
              </template>
            </el-auto-resizer>
          </div>
        </vn-stack-layer>
      </div>
    </vn-stack>
  </div>
</template>

<script lang="ts" setup>
import { watch, ref, inject, nextTick } from "vue";
import { LOGS_INFO_OBJ } from "@renderer/types";
import { LogsObj, ProjectLog } from "@renderer/b2/types";
import { unique } from "@common/utils/unique";
import i18next from "i18next";
type ProjectLogView = {
  id: string,
  type: string,
  currentTime: string,
  message?: string,
}

const emit = defineEmits<{
  (e: 'close'): void
}>();

const columns = [{
  key: 'message',
  dataKey: 'message',
  title: 'message',
}];
const logObj = inject(LOGS_INFO_OBJ);
const tableProjectRef = ref();
const stackActiveTab = ref<keyof LogsObj>('projectLogs');

const projectLogs = ref<ProjectLogView[]>([]);

const clearConsolePanel = () => {
  logObj[stackActiveTab.value].length = 0
  projectLogs.value.length = 0
}

const updateProjectLog = (projectLog: ProjectLog) => {
  const log: ProjectLogView = {
    id: unique(),
    type: projectLog.type,
    currentTime: projectLog.currentTime,
  };
  if (projectLog.type === 'param') {
    log.message = i18next.t("consolePanel.paramChanegMessage", {
      params: JSON.stringify(projectLog.params)
    }).replaceAll("&quot;", "\"");
  }
  return log;
}
let projectLogTimer = null;
watch(() => logObj?.projectLogs?.length, (length) => {
  clearTimeout(projectLogTimer);
  projectLogTimer = setTimeout(() => {
    for (let i = 0; i < logObj?.projectLogs?.length; i++) {
      if (projectLogs.value?.[i]) continue;
      projectLogs.value[i] = updateProjectLog(logObj?.projectLogs?.[i]);
    }
    if (length && stackActiveTab.value === 'projectLogs') {
      nextTick(() => {
        const contentDiv = tableProjectRef.value.$el.querySelector('.el-table-v2__body').children[0].children[0];
        const scrollHeight = parseInt(contentDiv.style.height) || 999999999;
        tableProjectRef.value?.scrollTo({ scrollTop: scrollHeight });
      })
    }
  }, 300);
}, { immediate: true })



</script>


<style scoped lang="scss">
.console-panel {
  padding: 0;
  background-color: var(--bg-color-page);
  position: absolute;
  left: 0;
  bottom: 40px;
  height: 230px;
  right: 0;
  z-index: 9999;
}

.header {
  display: flex;
  height: 30px;
  color: var(--text-color-primary);
  background-color: var(--bg-color);
  border-bottom: 1px solid var(--border-color);
  line-height: 30px;

  .clear-icon {
    width: 30px;
    text-align: center;
    cursor: pointer;

    &:hover {
      color: var(--color-primary)
    }
  }

  .remove-icon {

    width: 30px;
    text-align: center;
    cursor: pointer;

    &:hover {
      color: var(--color-danger)
    }
  }

  .tabs {
    display: flex;
    flex: 1;
    gap: 8px;
    padding-left: 10px;
    height: 29px;

    .tab {
      display: inline-block;
      border-bottom: 2px solid transparent;
      cursor: var(--cursor-pointer);
    }

    .tab.active {
      border-bottom-color: var(--color-primary);
    }
  }
}

.messages {
  height: 200px;
  overflow: hidden;

  :deep(.el-table-v2) {
    div:has(.el-table-v2__row ){
      width: 100%!important;
    }
    .el-table-v2__body{
      > .el-vl__horizontal{
        display: none;
      }
    }
    .el-table-v2__row {
      width: 100%!important;
      align-items: center;
      &:hover {
        background-color: unset !important;
      }
  
      .el-table-v2__row-cell {
        width: 100%;
  
        .row-container {
          display: flex;
          flex-direction: column;
          justify-content: center;
          overflow: hidden;
          padding: 4px 0;

          .el-scrollbar {
            max-height: 64px;
          }
  
          .row-message {
            display: flex;
            max-height: 64px;
  
            .time {
              margin-right: 10px;
              min-width: 120px;
            }
  
            .path-level {
              display: flex;
              margin-right: 10px;
  
              .spacing {
                margin: 0 3px;
              }
              .level-list {
                max-width: 400px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              }
              .level-name {
                color: var(--color-primary) !important;
                margin: 0 3px;
    
                &:hover {
                  color: var(--primary-color-hover) !important;
                  cursor: pointer;
                }
              }
            }
            
            .message {
              max-height: 56px;
            }
          }
  
          .row-payload {
            display: flex;
            white-space: nowrap;
  
            .fs {
              margin-left: 10px;
              display: none;
              font-size: 12px;
              cursor: var(--cursor-pointer);
            }
  
            &:hover {
              overflow-y: auto;
  
              .fs {
                display: block;
              }
  
              &::-webkit-scrollbar {
                height: 5px;
              }
  
              &::-webkit-scrollbar-thumb {
                border-radius: 2.5px;
                background-color: #76767680;
              }
            }
          }
        }
      }
    }
  }


  .expand-more {
    display: flex;
    height: 30px;
    font-size: 13px;
    margin-left: 40px;
    white-space: pre;
    overflow: hidden;
    align-items: center;

    &:hover {
      overflow-x: auto;

      &::-webkit-scrollbar {
        height: 5px;
      }

      &::-webkit-scrollbar-thumb {
        border-radius: 2.5px;
        background-color: #76767680;
      }
    }
  }
}

.error {
  color: var(--color-danger)
}
</style>
