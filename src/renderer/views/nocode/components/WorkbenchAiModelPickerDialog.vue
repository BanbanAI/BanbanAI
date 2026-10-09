<template>
  <div class="workbench-ai-model-picker-dialog">
    <el-dialog
      :model-value="modelValue"
      :title="$t('WorkbenchAiModelPickerDialog.addModelTitle')"
      width="680px"
      align-center
      :close-on-click-modal="false"
      @update:model-value="emit('update:modelValue', $event)"
    >
      <div class="model-picker">
        <div class="model-picker__controls">
          <el-input
            :model-value="keyword"
            clearable
            :placeholder="$t('WorkbenchAiModelPickerDialog.searchModelName')"
            @update:model-value="emit('update:keyword', String($event || ''))"
          >
            <template #prefix>
              <el-icon><i-ep-search /></el-icon>
            </template>
          </el-input>
          <el-button
            circle
            :title="$t('WorkbenchAiModelPickerDialog.addAllModels')"
            :disabled="actionDisabled || providerBusy || !hasAddableModels"
            @click="emit('add-all')"
          >
            <el-icon><i-ven-add-all /></el-icon>
          </el-button>
          <el-button
            circle
            :title="$t('WorkbenchAiModelPickerDialog.refreshAvailableModels')"
            :loading="syncing"
            :disabled="actionDisabled"
            @click="provider && emit('sync', provider)"
          >
            <template #icon>
              <el-icon v-if="!syncing"><i-ep-refresh /></el-icon>
            </template>
          </el-button>
        </div>
  
        <div v-if="!models.length" class="empty-block">
          <div class="empty-icon">
            <el-icon :size="32"><i-ven-ai-model-empty /></el-icon>
          </div>
          <div class="empty-block__title">
            {{ $t('WorkbenchAiModelPickerDialog.emptyAddableModels') }}
            <p>{{ $t('WorkbenchAiModelPickerDialog.emptyAddableModelsTip') }}</p>
          </div>
        </div>
  
        <el-scrollbar v-else class="available-model-scrollbar">
          <div class="available-model-list">
            <div
              v-for="model in models"
              :key="model.id"
              class="available-model-row"
              :class="{ 'is-added': isModelAlreadyAdded(model.id) }"
            >
              <span class="model-status-mark" :class="{ 'is-added': isModelAlreadyAdded(model.id) }">
                <el-icon v-if="isModelAlreadyAdded(model.id)"><i-ep-check /></el-icon>
              </span>
              <div class="available-model-row__main">
                <div class="model-name">{{ getModelDisplayName(provider, model) }}</div>
                <div v-if="shouldShowModelRawName(provider, model)" class="model-raw-name">{{ model.model }}</div>
              </div>
              <el-icon
                class="model-action-icon"
                :class="{ 'is-disabled': providerBusy }"
                :title="isModelAlreadyAdded(model.id) ? $t('WorkbenchAiModelPickerDialog.delete') : $t('WorkbenchAiModelPickerDialog.add')"
                @click="!providerBusy && emit(isModelAlreadyAdded(model.id) ? 'remove' : 'add', model)"
              ><i-ep-minus v-if="isModelAlreadyAdded(model.id)" /><i-ep-plus v-else /></el-icon>
            </div>
          </div>
        </el-scrollbar>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import type { AiProviderConfig, AiProviderModel } from '@common/types/ai-provider'
import { computed, type PropType } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  keyword: { type: String, required: true },
  provider: { type: Object as PropType<AiProviderConfig | null>, default: null },
  models: { type: Array as PropType<AiProviderModel[]>, required: true },
  syncing: { type: Boolean, required: true },
  actionDisabled: { type: Boolean, required: true },
  providerBusy: { type: Boolean, required: true },
  isModelAlreadyAdded: { type: Function as PropType<(modelId: string) => boolean>, required: true },
  getModelDisplayName: {
    type: Function as PropType<(provider?: Pick<AiProviderConfig, 'type'> | null, model?: AiProviderModel | null) => string>,
    required: true,
  },
  shouldShowModelRawName: {
    type: Function as PropType<(provider?: Pick<AiProviderConfig, 'type'> | null, model?: AiProviderModel | null) => boolean>,
    required: true,
  },
})

const hasAddableModels = computed(() => props.models.some(model => !props.isModelAlreadyAdded(model.id)))

const emit = defineEmits([
  'update:modelValue',
  'update:keyword',
  'sync',
  'add',
  'remove',
  'add-all',
])
</script>

<style scoped lang="scss">
.workbench-ai-model-picker-dialog {
  :deep(.el-dialog) {
    border-radius: 4px ;
    --el-dialog-bg-color: var(--bg-color-page);
    --el-dialog-padding-primary: 0;

    .el-button {
      border-radius: 4px ;
    }

    .el-dialog__header {
      height: 56px;
      margin: 0;
      padding: 0;
      border-bottom: 1px solid #e5e6eb;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;

      .el-dialog__title {
        font-size: 16px;
        line-height: 24px;
        font-weight: 600;
      }

      .el-dialog__headerbtn {
        top: 0;
        width: 56px;
        height: 56px;
      }
    }

    .el-dialog__body {
      color: #1d2129;
      padding: 24px;
      font-size: 16px;
      line-height: 24px;
      font-weight: 600;
      
      .model-picker {
        min-width: 0;
        height: min(600px, calc(100vh - 112px));
        display: flex;
        flex-direction: column;
        overflow: hidden;
        gap: 12px;
        
        .model-picker__controls {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 32px 32px;
          gap: 8px;

          .el-input__wrapper {
            min-height: 32px;
            border-radius: 4px;
            background: #fff;
            box-shadow: 0 0 0 1px #c9cdd4 inset;
          }

          .el-button {
            margin: 0;
            color: #4E5969;
          }
        }
        
        .empty-block {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 28px 20px;
          border-radius: 4px;
          text-align: center;

          .empty-icon {
            width: 52px;
            height: 52px;
            border-radius: 8px;
            padding: 10px;
            background: #E8F3FF;
            color: #165DFF;
          }
          
          .empty-block__title {
            font-size: 14px;
            line-height: 22px;
            font-weight: 600;
            color: #1d2129;
            
            p {
              margin-top: 4px;
              font-size: 12px;
              line-height: 20px;
              font-weight: 400;
              color: #86909C;
            }
          }
        }
        
        .available-model-scrollbar {
          flex: 1;
          min-height: 0;
          
          .available-model-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding-right: 4px;
            
            .available-model-row {
              min-height: 48px;
              display: flex;
              align-items: center;
              gap: 12px;
              padding: 8px 12px;
              border: 1px solid #e5e6eb;
              border-radius: 4px;
              box-sizing: border-box;
              background: #fff;
              
              .model-status-mark {
                width: 8px;
                height: 8px;
                flex: none;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                background: #c9cdd4;
                
                &.is-added {
                  width: 16px;
                  height: 16px;
                  color: #00b42a;
                  background: transparent;
                }
              }
              
              .available-model-row__main {
                flex: 1;
                min-width: 0;
                
                .model-name {
                  font-size: 14px;
                  line-height: 22px;
                  font-weight: 500;
                  color: #1d2129;
                }
                
                .model-raw-name {
                  font-size: 12px;
                  line-height: 18px;
                  color: #86909c;
                  overflow-wrap: anywhere;
                }
              }
              
              .model-action-icon {
                flex: none;
                width: 18px;
                height: 18px;
                color: #86909c;
                font-size: 16px;
                cursor: var(--cursor-pointer);
                
                &:hover {
                  color: var(--color-primary);
                }
                
                &.is-disabled {
                  color: #c9cdd4;
                  cursor: not-allowed;
                }
              }
            }
          }
        }
      }
    }
  }
}
</style>
