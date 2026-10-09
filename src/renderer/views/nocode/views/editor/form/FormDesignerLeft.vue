<template>
  <el-aside class="left" :class="{ floating: props.floating }" :width="props.width">
    <el-scrollbar>
      <div class="widgets-list-wrapper">
        <template v-for="item in allFormFieldTypes" :key="item.category">
          <div class="widgets-category" v-if="item.children.length > 0">
            <div class="title">{{ item.category }}</div>
            <ul class="widget-list">
              <li class="widget"
                v-for="widget in item.children"
                :key="widget.type"
                :title="widget.name" 
                @pointerdown.capture="handlePointerDown($event, widget)"
                @click="formAddWidget(widget)"
              >
                <el-icon>
                  <component :is="widget.icon" />
                </el-icon>
                <span>{{ widget.name }}</span>
              </li>
            </ul>
          </div>
        </template>
      </div>
    </el-scrollbar>
    <div v-if="props.showRecycleButton" class="recycle">
      <div class="recycle-btn" @click="emit('openRecycle', true)">
        <el-icon :size="14"><i-workbench-recycle /></el-icon>
        {{ $t('FormDesignerLeft.fieldRecycleBin') }}
      </div>
    </div>
  </el-aside>
</template>

<script lang='ts' setup>
import { WidgetSoul } from '@common/types/project';
import { usePointerDrag, usePointerDragClickSuppressed } from './hooks';
import { allFormFieldTypes } from '@renderer/b2/formFieldTypes';


const emit = defineEmits<{
  (e: 'addWidget', widgetSoul: WidgetSoul, type?: 'drag' | 'click'): void;
  (e: 'scrollTo'): void;
  (e: 'openRecycle', value: boolean): void;
}>();

const props = withDefaults(defineProps<{
  floating?: boolean
  showRecycleButton?: boolean
  width?: string
}>(), {
  floating: false,
  showRecycleButton: true,
  width: '260px',
});

const pointerDrag = usePointerDrag();
const pointerDragClickSuppressed = usePointerDragClickSuppressed();

const handlePointerDown = (event: PointerEvent, widgetSoul: WidgetSoul) => {
  if (event.button !== 0 || !pointerDrag) return;
  event.stopPropagation();
  const sourceElement = event.currentTarget as HTMLElement;
  const sourceRect = sourceElement.getBoundingClientRect();
  pointerDrag.value = {
    source: 'catalog',
    widgetSoul,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    currentX: event.clientX,
    currentY: event.clientY,
    moved: false,
    originIndex: -1,
    sourceElement,
    offsetX: event.clientX - sourceRect.left,
    offsetY: event.clientY - sourceRect.top,
  };
};

const formAddWidget = (widgetSoul: WidgetSoul) => {
  if (pointerDragClickSuppressed?.value) {
    pointerDragClickSuppressed.value = false;
    return;
  }
  emit('addWidget', widgetSoul, "click");
}

</script>

<style lang='scss' scoped>
.left {
  background-color: var(--bg-color-page);
  border-right: 1px solid var(--border-color-light);
  display: flex;
  flex-direction: column;
  user-select: none;
  overflow: unset;

  &.floating {
    width: 100% !important;
    height: auto;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    border-right: none;
    background-color: #fff;
  }

  :deep(.el-scrollbar) {
    flex: 1;
    height: 100%;
    min-height: 0;
  }

  .widgets-list-wrapper {
    flex: 1;

    .widgets-category {
      display: flex;
      flex-direction: column;
      row-gap: 12px;
      padding: 8px 12px;
      .title {
        height: 22px;
        display: flex;
        align-items: center;
      }
      .widget-list {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        row-gap: 14px;
  
        .widget {
          width: 47%;
          height: 30px;
          border: 1px solid var(--border-color);
          color:var(--text-color-regular);
          display: flex;
          align-items: center;
          padding: 0 8px;
          cursor: move;
          border-radius: 3px;
          user-select: none;
          column-gap: 9px;

          &:hover {
            border: 1px dashed var(--color-primary);
            color: var(--color-primary);
          }

          span {
            white-space: nowrap;
            text-overflow: ellipsis;
            overflow: hidden;
            line-height: 30px;
          }
        }
      }
    }

  }

  .recycle {
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #4E5969;
    padding: 8px;
    border-top: 1px solid var(--line-1, #e5e6eb);

    .recycle-btn {
      font-size: 12px;
      line-height: 20px;
      display: flex;
      width: 100%;
      height: 24px;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      gap: 4px;
      cursor: pointer;
      
      &:hover { 
        background-color: #F2F3F5;
      }
    }
  }
}
</style>
