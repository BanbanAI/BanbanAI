<template>
  <div class="form-children-container" style="width: 100%;">
    <div class="container">
      <draggable :model-value="optionsValue" item-key="id" @start="handleDragStart" @end="handleDragEnd" handle=".move"
        chosen-class="dragging" :disabled="!isDraggable" :component-data="{ class: 'tabs-content' }" animation="500">
        <template #item="{ element, index }">
          <div v-if="element" :key="element?.uid" ref="dragRef" class="widget-option-item" @click.stop.prevent>
            <div class="drag-wrap" :title="$t('FormChildrenArrayOption.enterChildWidget')" @click="selectOption(element.uid)" @mousedown.stop>
              <el-icon>
                <component :is="widgetsList[element.type]?.icon" />
              </el-icon>
              <el-text truncated>
                {{ element.name }}
              </el-text>
            </div>

            <div class="icons">
              <el-icon v-if="isDraggable" class="darg-icon move" color="var(--text-color-secondary)"
                :size="16"><i-icon-park-outline-drag /></el-icon>

              <el-icon class="operate-icon copy" :size="16" color="var(--text-color-secondary)"
                @click.stop.prevent="copyOption(element.uid)"><i-ep-copy-document /></el-icon>

              <el-popover :ref="el => setPopoverRef(element.uid, el)" placement="bottom" :width="200" trigger="click" popper-class="delete-field-tip-popper" :show-arrow="false">
                <template #default>
                  <p>{{ $t("FormChildrenArrayOption.deleteTip") }}</p>
                  <div class="delete-field-tip-footer">
                    <el-button size="small" text @click="hidePopover(element.uid)">{{ $t("FormChildrenArrayOption.cancel") }}</el-button>
                    <el-button size="small" type="danger" @click="confirmRemove(index, element.uid)">
                      {{ $t("FormChildrenArrayOption.confirm") }}
                    </el-button>
                  </div>
                </template>

                <template #reference>
                  <el-icon v-if="element.type !== 'counting'" class="operate-icon danger" :size="16"
                    color="var(--text-color-secondary)">
                    <i-ep-delete />
                  </el-icon>
                </template>
              </el-popover>
            </div>
          </div>
        </template>
      </draggable>
      <el-dropdown max-height="200px" trigger="click" placement="bottom-start" popper-class="add-field-dropdown" 
      :popper-options="{
        modifiers: [
          {
            name: 'offset',
            options: {
              offset: [2, 4],
            },
          },
        ],
      }">
        <el-button class="btn-add" :icon="Plus">{{ $t("FormChildrenArrayOption.addField") }}</el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-for="type in optionalWidgets" @click="addWidget(type)">
              <el-icon>
                <component :is="widgetsList[type]?.icon" />
              </el-icon>
              <span>{{ widgetsList[type]?.name }}</span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  isBigContent: (args: any) => true,
};
</script>
<script lang="ts" setup>
import { ACTIVE_ELEMENT, HANDLE_INTO_FIELD_RECYCLE_BIN_KEY } from '@renderer/types';
import { GET_OPTION_VALUE, UPDATE_OPTION } from "../inject";
import { unique } from '@common/utils/unique';
import { DefinedOptionWithParsedType, FormChildrenArrayOptionValue } from '../types';
import { Widget } from '@renderer/b2/controllers/widget';
import { FormElement, AbstractSubForm } from '@renderer/b2/controllers/form';
import draggable from "vuedraggable";
import { ref, computed, inject, reactive } from "vue";
import { Plus } from '@element-plus/icons-vue'
import { deepClone } from "@common/utils/object";
import { allFormFieldTypes } from '../formFieldTypes';

const props = defineProps<{ option: DefinedOptionWithParsedType }>();

// const getOptionValue = inject(GET_OPTION_VALUE);
// const updateOption = inject(UPDATE_OPTION);

const widgetsList = computed(() => {
  const allWidgets = allFormFieldTypes.map(item => item.children)?.flat();
  return allWidgets.reduce((prev, item) => {
    prev[item.type] = item;
    return prev;
  }, {});
})

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void;
  (event: "update", value: FormChildrenArrayOptionValue[]): void;
}>();

const subForm = inject(ACTIVE_ELEMENT);
const optionsValue = computed<FormChildrenArrayOptionValue['options']>(() => {
  return subForm.value.children.map((c: FormElement) => {
    return {
      uid: c.uid,
      type: c.getSoul()?.type,
      name: c.title,
    }
  }) || []
});
const isDragging = ref(false);
const isDraggable = computed(() => props.option.args?.hasOwnProperty("draggable"));
const popoverRefs = reactive(new Map<string, any>())

const optionalWidgets = computed(() => {
  return props.option.args?.optionalWidgets
    ? JSON.parse(decodeURIComponent(props.option.args.optionalWidgets))
    : [];
});

const addWidget = (type: string) => {
  (subForm.value as any).addWidget({
    uid: unique(),
    name: widgetsList.value[type].name,
    type: type
  }, subForm.value.children.length)
}

const copyOption = (uid: string) => {
  const index = subForm.value.children.findIndex((w)=>w.uid === uid);
  const child = subForm.value.children[index];
  if (!child) return;

  const soul = deepClone(child.getSoul());
  (subForm.value as any).addWidget({
    ...soul,
    uid: unique(),
  }, index + 1)
}

const handleIntoFieldRecycleBin = inject(HANDLE_INTO_FIELD_RECYCLE_BIN_KEY);
const removeOption = (index: number) => {
  const child = subForm.value.children[index] as Widget;
  const mainFormData = subForm.value.getBoard().getConnections()?.find(c => c.uid === (subForm.value as AbstractSubForm).topForm.tableUID?.[0]);
  const mainTable = mainFormData?.tables?.find(tableItem => tableItem.uid === (subForm.value as AbstractSubForm).topForm.tableUID[1]);
  const subFormTableUID = (subForm.value as AbstractSubForm).tableUID || mainTable?.fields?.find(fieldItem => fieldItem.meta?.uid === subForm.value.uid)?.meta?.extra?.subTableUID;
  const subTable = subForm.value.getTable(subFormTableUID);
  handleIntoFieldRecycleBin(child.getSoul(), subTable);
  child.detach();
  child.destroy();
  child.getBoard().updateHistory();
};

const selectOption = (uid: string) => {
  props.option?.click?.(subForm.value, uid);
}

// 拖拽
const handleDragStart = () => (isDragging.value = true);
const handleDragEnd = ({ oldIndex, newIndex }: { oldIndex: number; newIndex: number }) => {
  if (oldIndex === newIndex) return;

  (subForm.value as any).moveWidget(subForm.value.children[oldIndex], newIndex);

  isDragging.value = false;
};

const setPopoverRef = (uid: string, ref: any) => {
  if (ref) popoverRefs.set(uid, ref)
}

const hidePopover = (uid: string) => {
  popoverRefs.get(uid)?.hide?.()
}

const confirmRemove = (index: number, uid: string) => {
  removeOption(index)
  hidePopover(uid)
}

</script>

<style lang="scss" scoped>
.container {
  padding: 0 5px;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;

  ::-webkit-scrollbar {
    width: 6px;
  }

  ::-webkit-scrollbar-thumb {
    border-radius: 10px;
    background-color: #555355;
  }

  ::-webkit-scrollbar-corner {
    background: transparent
  }

  .tabs-content {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .widget-option-item {
      display: flex;
      align-items: center;
      gap: 2px;
      height: 28px;

      .el-select {
        flex: 1;
      }

      .el-icon {
        cursor: var(--cursor-pointer);

        &:hover {
          color: var(--color-primary);
        }

        &.danger:hover {
          color: var(--color-danger);
        }
      }

      .icons {
        display: flex;
        align-items: center;
        gap: 2px;

        .el-icon {
          cursor: var(--cursor-pointer);
          width: 22px;
          height: 26px;

          &.darg-icon {
            cursor: move;
          }
        }
      }

      .drag-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 8px;
        border: 1px solid var(--border-color);
        border-radius: 4px;
        height: 100%;
        line-height: 1.5;
        flex: 1;
        font-size: 12px;
        cursor: var(--cursor-pointer);
        max-width: 208px;

        &:hover {
          color: var(--color-primary);
          background-color: #ecf5ff;
          border-color: #c6e2ff;
          cursor: var(--cursor-pointer);
        }
      }
    }
  }

  :deep(.tabs-content) {
    >.dragging.sortable-ghost {
      visibility: hidden;
      opacity: 1;
    }

    > :not(.dragging) {
      .el-input__wrapper {
        &:hover .el-input__prefix {
          opacity: v-bind("isDragging ? 0 : 1");
        }
      }
    }
  }

  :deep(.btn-add) {
    font-size: 12px;
    height: 24px;
    border-radius: 4px;
    margin-top: 8px;
    padding: 0 8px 0 4px;
    color: var(--color-primary);
    cursor: var(--cursor-pointer);

    .el-icon {
      font-size: 14px;
    }

    span {
      margin-left: 2px !important;
    }
  }
}
</style>

<style lang="scss">
@use "@renderer/styles/index.scss" as styles;

.delete-field-tip-popper {
  --el-popover-padding: 16px;
  background-color: var(--bg-color-page) !important;
}

.delete-field-tip-footer {
  text-align: right;
  margin: 16px 0 0 0;

  .el-button {
    border-radius: 4px;
    border: 1px solid var(--border-color);

    .el-button--danger {
      border: 0;
    }
  }
}

.add-field-dropdown {
  @include styles.popper-styles(2px);

  .el-scrollbar {
    border-radius: 4px;

    .el-scrollbar__wrap {
      max-height: 192px !important;
      width: 208px;
    }
  }
  .el-scrollbar__bar {
    display: none !important;
  }

  .el-dropdown-menu {
    padding: 4px;

    .el-dropdown-menu__item {
      font-size: 12px;
      padding: 8px 12px;
      cursor: var(--cursor-pointer);
    }
  }
}
</style>
