<template>
  <div v-show="visible">
    <el-menu mode="vertical" class="contextMenu" :style="{
      left: `${position.x}px`,
      top: `${position.y}px`,
    }">
      <el-menu-item-group v-for="(menuItems, menuIndex) in menuOptions.filter(items => items.some(item => !item.hide))" :key="menuIndex">
        <el-divider v-if="menuIndex !== 0" />
        <el-menu-item v-for="item, itemIndex in menuItems" :key="item.label" @click="handleContextClick(item.value)" v-show="!item.hide">
          <i :class="`fs icon ${item.icon}`" v-if="typeof item.icon === 'string'"></i>
          <el-icon class="icon" v-else>
            <component :is="item.icon" />
          </el-icon>
          <span>{{ item.label }}</span>
          <i class='fs fs-arrow' v-if="item.children"></i>
          <div v-if="item.children" class='selectOptions' :style="menuChildrenPosition(item.children.length, menuIndex, itemIndex)">
            <div v-for="child in item.children" class="option" @click.stop="handleChildContextClick(child.value)">
              <i class="fs fs-selected-state" v-if="isSelected(child.value)"></i>
              <span>{{ child.label }}</span>
            </div>
          </div>
        </el-menu-item>
      </el-menu-item-group>
    </el-menu>
  </div>
</template>
<script setup lang='ts'>
import { Field } from '@common/types/project';
import { useWindowSize } from '@vueuse/core';
import { ProjectDataContextMenuType } from '@renderer/types'
import { computed, onUnmounted, reactive, ref, watch } from 'vue';
import i18next from "i18next";

const props = defineProps<{
  type: ProjectDataContextMenuType,
  currentData: Field,
  event: MouseEvent,
  visible: boolean,
  isEmbedded: boolean,
  isShowExpand: boolean,
}>();

const menuOptions = ref([])

const emits = defineEmits(['contextClick', 'childContextClick'])

const handleContextClick = (itemName: string) => {
  emits('contextClick', itemName)
}

const handleChildContextClick = (childName) => {
  emits('childContextClick', childName)
}

const isSelected = (type: string) => {
  if (!props.currentData) return false;
  const filedType = props.currentData.revisedType || props.currentData.type;
  return filedType === type;
}

watch(() => [props.type, props.isEmbedded], (value) => {
  const type = props.type;
  if (type === 'table') {
    menuOptions.value = [
      [
        {
          label: i18next.t("projectDataContextMenu.menuFoldAll"),
          value: "foldAll",
          icon: "fs-fold2",
          role: "project.fold_group",
          hide:!props.isShowExpand,
        },
        {
          label: i18next.t("projectDataContextMenu.menuExpandAll"),
          value: "expandAll",
          icon: "fs-expand",
          role: "project.open_group",
          hide: !props.isShowExpand,
        }
      ],
      [
        ...(props.isEmbedded ? [
          {
            label: i18next.t("projectDataContextMenu.menuReportData"),
            value: "formCreate",
            icon: "fs-edit",
            role: "project.formCreate",
          },
          {
            label: i18next.t("projectDataContextMenu.menuCopyTable"),
            value: "copyTable",
            icon: IEpDocumentCopy,
            role: "project.copyTable",
          },
          {
            label: i18next.t("projectDataContextMenu.menuDelete"),
            value: "deleteTable",
            icon: "fs-delete",
            role: "project.remove",
          },
        ] : []),
      ]
    ]
  } else {
    menuOptions.value = [
      [
        {
          label: i18next.t("projectDataContextMenu.menuChangeType"),
          value: "editType",
          icon: "fs-tuceng",
          role: "project.changeType",
          children: [
            {
              label: i18next.t("projectDataContextMenu.typeString"),
              value: 'string'
            },
            {
              label: i18next.t("projectDataContextMenu.typeNumber"),
              value: 'number'
            },
            {
              label: i18next.t("projectDataContextMenu.typeArray"),
              value: 'array'
            }
          ]
        },
        {
          label: i18next.t("projectDataContextMenu.menuDelete"),
          value: "delete",
          icon: "fs-delete",
          role: "project.delete",
          hide: type !== 'private-field',
        },
      ],
    ]
  }
})

const { width, height } = useWindowSize()

const position = reactive({
  x: 0,
  y: 0,
})

const setPosition = () => {
  const event = props.event;
  if (!event?.target) return;
  const { x, y} = (props.event.target as HTMLElement).getBoundingClientRect();
  let left = event.offsetX + x;
  let top = event.offsetY + y;
  if (left + 130 > width.value) {
    left = width.value - 130;
  }
  const menuItemLength = menuOptions.value.reduce((pre, cur) => pre + cur.length, 0);
  if (top + menuItemLength * 25 > height.value) {
    top -= menuItemLength * 25;
  }
  position.x = left;
  position.y = top;
}

watch(() =>  ({ x: props.event?.x, y: props.event?.y }), () => {
  setPosition();
})

window.addEventListener('resize', setPosition);

onUnmounted(() => {
  window.removeEventListener('resize', setPosition);
});

/**
 * @函数说明: '二级菜单top值'
 * @param {number} childrenLength 二级菜单length
 * @param {number} menuIndex      二级菜单所属一级菜单Index
 * @param {number} itemIndex      二级菜单在菜单里的index
 */
const menuChildrenPosition = computed(() => (childrenLength: number, menuIndex: number, itemIndex: number) => {
  let childrenTop = 0;
  // 获取二级菜单所属菜单之前的菜单项数
  const prevMenuItems = menuOptions.value?.slice(0, menuIndex)?.reduce((pre, cur) => pre + cur.length, 0) + itemIndex;
  if (position.x + (childrenLength + prevMenuItems) * 25 > height.value) {
    childrenTop =  0 - (childrenLength - 1) * 25;
  }
  return { top: childrenTop + 'px' }
})
</script>
<style lang="scss" scoped>
.contextMenu {
  --el-menu-base-level-padding: 10px;
  --el-menu-item-height: 25px;
  --el-font-size-base: 12px;
  --el-menu-item-font-size: var(--el-font-size-base);
  --el-menu-bg-color: var(--bg-color-overlay);

  position: fixed;
  z-index: 9999;
  width: 130px;
  border: solid 1px var(--el-menu-border-color);

  .el-divider {
    margin: 2px 0;
  }
  :deep(.el-menu-item-group__title) {
    display: none;
  }

  .el-menu-item {
    .icon {
      display: flex;
      width: 24px;
      height: 24px;
      line-height: 25px;
      font-size: 13px;
      margin: 0;
    }

    .selectOptions {
      display: none;
      position: absolute;
      z-index: 9999;
      flex-direction: column;
      transform: translateX(-100%);
      top: 0;
      left: 0;
      width: 120px;
      border: solid 1px var(--el-menu-border-color);
      background-color: var(--el-menu-bg-color);

      .option {
        width: 100%;
        height: 25px;
        line-height: 25px;
        font-size: 12px;
        text-align: center;
        position: relative;

        i {
          position: absolute;
          top: 50%;
          left: 5px;
          transform: translateY(-50%);
        }

        &:hover {
          background-color: var(--el-menu-hover-bg-color);
        }
      }

    }

    &:hover {
      .selectOptions {
        display: flex;
      }
    }
  }

  .fs-arrow::before {
    padding-left: 13px;
  }
}
</style>
