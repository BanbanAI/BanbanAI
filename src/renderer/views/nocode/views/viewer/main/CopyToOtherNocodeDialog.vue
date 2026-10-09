<template>
  <div class="copy-to-other-nocode-dialog">
    <el-dialog
      v-model="dialogVisible"
      width="400px"
      :show-close="false"
      destroy-on-close
      align-center
      @close="emit('close')"
    >
      <template #header>
        <div class="copy-to-other-nocode-dialog__header">
        <span>{{ $t('CopyToOtherNocodeDialog.title') }}</span>
          <el-icon class="copy-to-other-nocode-dialog__close" @click="dialogVisible = false">
            <i-ep-close />
          </el-icon>
        </div>
      </template>
  
      <div class="copy-to-other-nocode-dialog__body">
        <p class="copy-to-other-nocode-dialog__tip">
          {{ $t('CopyToOtherNocodeDialog.tip') }}
        </p>
  
        <div class="copy-to-other-nocode-dialog__main">
          <div class="copy-to-other-nocode-dialog__label">
            {{ $t('CopyToOtherNocodeDialog.selectTargetNocode') }}
          </div>
  
          <div class="copy-to-other-nocode-dialog__search">
            <el-icon class="copy-to-other-nocode-dialog__search-icon" :size="16">
              <i-ep-search />
            </el-icon>
            <input
              v-model="dialogKeyword"
              type="text"
              class="copy-to-other-nocode-dialog__search-input"
              :placeholder="$t('CopyToOtherNocodeDialog.pleaseInput')"
            />
          </div>
  
          <el-scrollbar class="copy-to-other-nocode-dialog__list">
            <button
              v-for="item in filteredTargetNocodes"
              :key="item.meta.id"
              type="button"
              class="copy-to-other-nocode-dialog__item"
              :class="{ 'is-active': selectedTargetNocodeId === item.meta.id }"
              @click="selectedTargetNocodeId = item.meta.id"
            >
              <div
                class="copy-to-other-nocode-dialog__item-icon"
                :style="{ background: item.body?.snapshot?.color || '#fff' }"
              >
                <el-icon :size="14" v-if="item.body?.snapshot?.icon">
                  <component :is="item.body.snapshot.icon" />
                </el-icon>
                <el-icon :size="16" v-else>
                  <i-ven-nocode-default-logo />
                </el-icon>
              </div>
              <span class="copy-to-other-nocode-dialog__item-name">{{ item.meta.name }}</span>
            </button>
  
            <div v-if="!filteredTargetNocodes.length" class="copy-to-other-nocode-dialog__empty">
              {{ $t('CopyToOtherNocodeDialog.noTargetNocode') }}
            </div>
          </el-scrollbar>
        </div>
      </div>
  
      <template #footer>
        <div class="copy-to-other-nocode-dialog__footer">
          <el-button @click="dialogVisible = false">{{ $t('CopyToOtherNocodeDialog.cancel') }}</el-button>
          <el-button type="primary" :loading="props.loading" @click="emit('confirm')">
            {{ $t('CopyToOtherNocodeDialog.confirm') }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Nocode } from '@common/types/nocode';

const props = defineProps<{
  modelValue: boolean,
  keyword: string,
  loading: boolean,
  selectedNocodeId: string,
  targetNocodes: Nocode[],
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void,
  (e: 'update:keyword', value: string): void,
  (e: 'update:selected-nocode-id', value: string): void,
  (e: 'confirm'): void,
  (e: 'close'): void,
}>();

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

const dialogKeyword = computed({
  get: () => props.keyword,
  set: (value: string) => emit('update:keyword', value),
});

const selectedTargetNocodeId = computed({
  get: () => props.selectedNocodeId,
  set: (value: string) => emit('update:selected-nocode-id', value),
});

const filteredTargetNocodes = computed(() => {
  const keyword = props.keyword.trim().toLowerCase();
  return props.targetNocodes.filter(item => {
    const name = String(item.meta?.name || '');
    return !keyword || name.toLowerCase().includes(keyword);
  });
});
</script>

<style lang="scss" scoped>
.copy-to-other-nocode-dialog {
  :deep(.el-dialog) {
    border-radius: 8px;
    padding: 0;
    overflow: hidden;
    background: #fff;

    .el-dialog__header, .el-dialog__body {
      padding: 0;
    }
  
    .copy-to-other-nocode-dialog__header {
      height: 48px;
      padding: 0 16px;
      border-bottom: 1px solid rgba(15, 23, 42, 0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      font-size: 16px;
      line-height: 24px;
      color: #1d2129;
    }
  
    .copy-to-other-nocode-dialog__close {
      position: absolute;
      right: 16px;
      color: #6b7280;
      cursor: pointer;
    }
  
    .copy-to-other-nocode-dialog__body {
      padding: 24px 20px;
      display: flex;
      flex-direction: column;
      gap: 24px;
  
      .copy-to-other-nocode-dialog__tip {
        font-size: 14px;
        line-height: 22px;
        color: #86909C;
      }
  
      .copy-to-other-nocode-dialog__main {
        display: flex;
        flex-direction: column;
        gap: 8px;
  
        .copy-to-other-nocode-dialog__label {
          font-size: 14px;
          line-height: 22px;
          color: #1D2129;
        }
  
        .copy-to-other-nocode-dialog__search {
          height: 36px;
          padding: 0 12px;
          border-radius: 4px;
          background: #F2F3F5;
          display: flex;
          align-items: center;
          gap: 8px;
  
          .copy-to-other-nocode-dialog__search-icon {
            color: #4E5969;
            flex-shrink: 0;
          }
  
          .copy-to-other-nocode-dialog__search-input {
            width: 100%;
            border: 0;
            background: transparent;
            outline: none;
            color: #1f2937;
            font-size: 14px;
            line-height: 20px;
  
            &::placeholder {
              color: #c0c4cc;
            }
          }
        }
  
        .copy-to-other-nocode-dialog__list {
          margin-top: 12px;
          height: 216px;
          display: flex;
          flex-direction: column;
          gap: 4px;
  
          .copy-to-other-nocode-dialog__item {
            width: 100%;
            height: 36px;
            padding: 0 12px;
            border: 0;
            border-radius: 4px;
            background: transparent;
            display: flex;
            align-items: center;
            gap: 10px;
            text-align: left;
            cursor: pointer;
            transition: background-color 0.2s ease;
  
            &:hover,
            &.is-active {
              background: #f2f3f5;
            }
          }
  
          .copy-to-other-nocode-dialog__item-icon {
            width: 16px;
            height: 16px;
            border-radius: 4px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            flex-shrink: 0;
          }
  
          .copy-to-other-nocode-dialog__item-name {
            flex: 1;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: #1D2129;
            font-size: 14px;
            line-height: 20px;
          }
        }
  
        .copy-to-other-nocode-dialog__empty {
          height: 160px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #F2F3F5;
          font-size: 14px;
        }
      }
    }
  
    .copy-to-other-nocode-dialog__footer {
      padding: 16px 20px;
      border-top: 1px solid rgba(15, 23, 42, 0.08);
      display: flex;
      justify-content: flex-end;
      gap: 8px;
  
      .el-button {
        border-radius: 4px;
        margin-left: 0;
      }
    }
  }
}
</style>
