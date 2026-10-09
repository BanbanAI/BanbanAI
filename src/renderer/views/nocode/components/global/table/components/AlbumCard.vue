<template>
  <div class="album-card" v-if="albumStateOption" @click="handleClick">
    <el-checkbox v-if="!isMobile()" data-element="stop-click" :value="value">
      <div></div>
    </el-checkbox>

    <div class="album-cover" v-if="showCover">
      <template v-if="coverArr && coverArr.length">
        <album-card-cover
          :list="coverArr"
          :fit="albumStateOption.albumCoverState"
        >
          <template #none>
            <div class="album-cover-none">
              <el-icon class="frame">
                <i-table-frame></i-table-frame>
              </el-icon>
            </div>
          </template>
        </album-card-cover>
      </template>
      <div class="album-cover-none" v-else>
        <el-icon class="frame">
          <i-table-frame></i-table-frame>
        </el-icon>
      </div>
    </div>

    <div class="album-content">
      <div class="row album-title" v-if="titleColumn" :title="value[titleColumn.uid]">
        {{ value[titleColumn.uid] }}
      </div>
      <template v-for="item in useColumn" :key="item.uid">
        <div class="row" v-if="item.show">
          <div
            class="row-title"
            v-if="albumStateOption.fieldTitleState === FieldTitleStateEnum.SHOW"
          >
            <el-icon v-if="item.show">
              <component :is="item.icon" />
            </el-icon>
            <span>
              {{ item.alias }}
            </span>
          </div>
          <div class="row-content">
            <table-cell-format
              :value="value[item.uid]"
              :params="item"
              :widget="widgetTable"
              :rowHeightLevel="'auto'"
            >
              <template #none>
                <span class="none-text">{{ $t('AlbumCard.empty') }}</span>
              </template>
            </table-cell-format>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, inject, ref, Ref } from "vue";
import { NOCODE, VIEW_ACTIVE_UID } from "@renderer/types";
import { Nocode } from "@common/types/nocode";
import { Column } from "../table";
import { SystemField } from "@common/utils/connection";
import {
  useColumnType,
  isShowColums,
  FieldTitleStateEnum,
  AlbumStateOption,
  getCoverIndex,
  DefautAlbumStateOption,
  sortAlbumColumnsByOrder,
} from "../album";
import { Table } from "../table";
import { allFormFieldTypes } from "@renderer/b2/formFieldTypes";
import type { FormFieldTypes } from "@renderer/b2/formFieldTypes";
import { isMobile } from "@renderer/utils";

const props = withDefaults(
  defineProps<{
    value: object;
    allColumns: Column[];
    widgetTable: Table;
    tableId: string;
  }>(),
  {}
);
const emits = defineEmits<{
  (event: "click", value: MouseEvent): void;
}>();
const nocode: Ref<Nocode> = inject(NOCODE);
const viewActiveUid = inject(VIEW_ACTIVE_UID)

const albumStateOption = computed(() => {
  return nocode.value.body.views[props.tableId].find(
    (item) => item.uid === viewActiveUid.value
  );
});
const defineColumn = computed(() => {
  if (!props.allColumns) return null;
  const index = getCoverIndex(props.allColumns);
  return props.allColumns[index];
});
const showCover = computed(() => {
  if (typeof albumStateOption.value.showCover === 'boolean') {
    return albumStateOption.value.showCover
  }
  return DefautAlbumStateOption.showCover;
})
const coverArr = computed(() => {
  let coverUid = albumStateOption.value.coverUid;
  if (!coverUid) {
    coverUid = defineColumn.value?.uid;
  }
  const coverVal = props.value[coverUid];
  if (Array.isArray(coverVal)) return coverVal;
  return [];
});
const widget = allFormFieldTypes;
const allColumnsMap = computed(() => {
  const map = new Map();
  props.allColumns.forEach((item, index) => {
    map.set(item.uid, item);
  });
  return map;
});
const sortOrderColumns = computed(() => {
  return sortAlbumColumnsByOrder(
    props.allColumns,
    albumStateOption.value?.sortOrderColumns || []
  ).map((item) => item.uid);
});
const getWidgetMap = (widget: FormFieldTypes) => {
  const map = new Map();
  for (let i = 0; i < widget.length; i++) {
    const item = widget[i];
    item.children.forEach((item) => {
      map.set(item.type, item);
    });
  }
  return map;
};
const widgetMap = getWidgetMap(widget);
const titleColumn = computed(() => {
  let col = props.allColumns.find((item) => {
    return item.name === SystemField.DATA_TITLE;
  });
  if (!col) return null;
  return col;
});

const useColumn = computed<useColumnType[]>(() => {
  return sortOrderColumns.value.reduce<useColumnType[]>((result, uid) => {
    const item = allColumnsMap.value.get(uid);
    if (!item) return result;
    const getIcon = (item: Column) => {
      if (!item || !item.extra || !item.extra.widgetType) return "";
      const widgetType = item?.extra?.widgetType;
      const fieldObj = widgetMap.get(widgetType);
      if (!fieldObj || !fieldObj.icon) return "";

      return fieldObj.icon;
    };
    const icon = getIcon(item);
    const show =
      isShowColums(item) &&
      !albumStateOption.value.hiddenColumns?.includes(item.uid);

    result.push({
      ...item,
      icon,
      show,
    });
    return result;
  }, []);
});
const handleClick = (event: MouseEvent) => {
  const target = event.target;
  if (target.closest('[data-element="stop-click"]')) {
    return;
  }
  emits("click", event);
};
</script>

<style lang="scss" scoped>
.album-card {
  border-radius: 4px;
  overflow: hidden;
  box-sizing: border-box;
  border: 1px solid #d9d9d9;
  position: relative;
  height: fit-content;

  transition: border-color 0.3s ease, box-shadow 0.3s ease, transform 0.3s ease;
  :deep(.funs) {
    display: none;
  }
  &:hover {
    border: 1px solid #0873ff;
    box-shadow: 0 2px 8px rgba(8, 115, 255, 0.2);

    :deep(.funs) {
      display: inline-block;
    }

    .el-checkbox {
      opacity: 1;
    }
  }

  /* 当父元素包含选中的 input 时，修改父元素样式 */
  &:has(input:checked) {
    border: 1px solid #0873ff;
    box-shadow: 0 2px 8px rgba(8, 115, 255, 0.2);

    .el-checkbox {
      opacity: 1;
    }
  }

  .album-cover {
    width: 100%;
    aspect-ratio: 16 / 9;
  }
  .album-cover-none {
    width: 100%;
    height: 100%;
    background-color: #e8e9eb;
    display: flex;
    justify-content: center;
    align-items: center;
    .frame {
      font-size: 40px;
    }
  }

  .album-content {
    padding: 12px;
  }
  .row {
    margin-bottom: 12px;
    &:last-child {
      margin-bottom: 0px;
    }
  }
  .album-title {
    font-size: 14px;
    height: 20px;
    line-height: 20px;
    margin-bottom: 12px;
    color: #141414;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .row-title {
    font-size: 12px;
    line-height: 16px;
    font-weight: 400;
    color: #a1a1a1;
    margin-bottom: 6px;

    display: flex;
    align-items: center;

    .el-icon {
      margin-right: 4px;
      margin-left: -1px;
    }
  }
  .row-content {
    font-size: 14px;
    line-height: 20px;
  }
  .none-text {
    color: #a1a1a1;
    font-style: italic;
  }

  .el-checkbox {
    opacity: 0;
    position: absolute;
    top: 9px;
    right: 9px;
  }
}
</style>
