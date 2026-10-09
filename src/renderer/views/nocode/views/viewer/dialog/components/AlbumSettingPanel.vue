<template>
  <view-drawer-panel @close="handleClose" @cancel="handleCancel" @confirm="handleConfirm">
    <div class="album-setting-panel">
      <div class="album-setting-item">
        <div class="album-setting-row album-setting-name">
          <div class="label">
            {{ $t("albumSettingDrawer.albumSettingNameLabel") }}
          </div>
          <div class="value">
            <el-input v-model="viewName" type="text" :placeholder="$t('albumSettingDrawer.albumSettingNamePlaceholder')
              " />
          </div>
        </div>
        <div class="album-setting-row">
          <div class="label">
            {{ $t("albumSettingDrawer.albumSettingSizeLabel") }}
          </div>
          <div class="value">
            <single-button-group v-model="sizeTypeCom" :options="SizeDataCom"></single-button-group>
          </div>
        </div>
      </div>
      <div class="album-setting-item">
        <div class="album-setting-row album-setting-cover">
          <div class="label">
            {{ $t("albumSettingDrawer.albumSettingShowCover") }}
          </div>
          <div class="value">
            <el-switch v-model="showCoverCom"></el-switch>
          </div>
        </div>
        <div class="album-setting-row album-setting-cover">
          <div class="label">
            {{ $t("albumSettingDrawer.albumSettingCoverLabel") }}
          </div>
          <div class="value">
            <el-select v-model="coverColumnUid" :placeholder="$t('albumSettingDrawer.albumSettingCoverPlaceholder')
              ">
              <el-option v-for="column in coverColumn" :key="column.uid" :label="column.alias"
                :value="column.uid"></el-option>
            </el-select>
          </div>
        </div>
        <div class="album-setting-row">
          <div class="label">
            {{ $t("albumSettingDrawer.albumSettingCoverStyleLabel") }}
          </div>
          <div class="value">
            <single-button-group v-model="albumCoverStateCom" :options="CoverStateOptions"
              :width="68"></single-button-group>
          </div>
        </div>
      </div>
      <div class="album-setting-item">
        <div class="album-setting-row">
          <div class="label">
            {{ $t("albumSettingDrawer.albumSettingFieldLabel") }}
          </div>
          <div class="value">
            <single-button-group v-model="fieldTitleStateCom" :options="fieldTitleStateOptions"
              :width="68"></single-button-group>
          </div>
        </div>
        <div class="album-setting-row album-setting-keys">
          <div class="label">
            {{ $t("albumSettingDrawer.albumSettingShowFieldLabel") }}
          </div>
          <div class="value">
            <div class="drag-container">
              <field-selector :options="filedSelectorOption" :popperOptions="{
                modifiers: [
                  {
                    name: 'offset',
                    options: {
                      offset: ({ placement }) => {
                        // 根据 placement 返回不同的 [x, y] 偏移
                        switch (placement) {
                          case 'top':
                          case 'bottom':
                            return [41, 0]; // x: 20px (水平偏移), y: 0
                          case 'left':
                          case 'right':
                            return [0, 41]; // y: 20px (垂直偏移)
                          default:
                            return [0, 0];
                        }
                      },
                    },
                  },
                ],
              }" :teleported="false" @select="handleSelect">
                <div class="add-btn" link type="primary">
                  {{ $t("albumSettingDrawer.albumSettingAddShowFieldLabel") }}
                </div>
              </field-selector>
              <div class="drag">
                <vue-draggable :modelValue="showColumns" :component-data="{
                  class: 'drag',
                }" handle=".move" animation="500" delay="60" item-key="uid" @end="endDrag">
                  <template #item="{ element: item }: { element: useColumnType }">
                    <div class="drag-item" v-show="item.show">
                      <el-icon class="move" :size="14"><i-table-drag /></el-icon>
                      <div class="drag-text">{{ item.alias }}</div>
                      <div class="drag-right">
                        <el-icon class="delete" :size="14" @click.stop="handleDelete(item)">
                          <i-ep-delete />
                        </el-icon>
                      </div>
                    </div>
                  </template>
                </vue-draggable>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </view-drawer-panel>
</template>

<script lang="ts" setup>
import VueDraggable from "vuedraggable";
import { Nocode } from "@common/types/nocode";
import { NOCODE, FORM_DATA_VIEWER_EMITTER, VIEW_ACTIVE_UID, NOCODE_SIGN_IS_LATEST } from "@renderer/types";
import {
  ref,
  computed,
  watch,
  onUnmounted,
  onMounted,
  nextTick,
  inject,
  Ref,
  toRaw,
} from "vue";
import {
  SizeData,
  SizeType,
  AlbumCoverStateEnum,
  FieldTitleStateEnum,
  DefautAlbumStateOption,
  SizeStateEnum,
  isShowColums,
  useColumnType,
  AlbumStateOption,
  isCoverColumn,
  getCoverIndex,
  AlbumStateOptionType,
  sortAlbumColumnsByOrder,
} from "../../../../components/global/table/album";
import i18next from "i18next";
import axios from "axios";
import { ElMessage } from "element-plus";
import { Column } from "../../../../components/global/table/table";
import { deepClone, isEmpty } from "@common/utils/object";
import { VIEW_SETTING_DRAWER_REF } from "@renderer/types";
import { Events } from "../../main/formDataViewerEmitter";
import { CatalogViewSetting } from "@common/types/nocode";
import { Table } from '@common/types/project'
import { isSystemField, SystemField } from "@common/utils";
import { checkNocodeSyncBeforeRequest, handleNocodeSyncConflictError } from "@renderer/utils/nocodeSyncMessage";

interface ViewSettingDrawerProps {
  currentTOC: CatalogViewSetting;
  table: Table;
}

const props = withDefaults(defineProps<ViewSettingDrawerProps>(), {});

const viewSettingDrawerRef = inject(VIEW_SETTING_DRAWER_REF);
const nocode: Ref<Nocode> = inject(NOCODE);
const forDataViewerEmitter = inject(FORM_DATA_VIEWER_EMITTER);
const viewActiveUid = inject(VIEW_ACTIVE_UID)

watch(
  () => viewActiveUid.value,
  (newVal, oldVal) => {
    if (newVal !== oldVal) {
      initData();
    }
  }
);

const viewIndex = computed(() => {
  return nocode.value.body.views[props.table.uid].findIndex(
    (item) => item.uid === viewActiveUid.value
  );
});

const albumStateOption = computed(() => {
  return nocode.value.body.views[props.table.uid][viewIndex.value] as AlbumStateOptionType;
});
const allColumnsMap = computed(() => {
  const map = new Map();
  allColumns.value.forEach((item, index) => {
    map.set(item.uid, item);
  });
  return map;
});
const getSortOrderColumns = () => {
  return sortAlbumColumnsByOrder(
    allColumns.value,
    albumStateOption.value?.sortOrderColumns || []
  ).map((item) => item.uid);
};
const sortOrderColumns = computed(() => {
  return getSortOrderColumns();
});
const viewName = ref("");
const isCurrent = computed(() => {
  return viewActiveUid.value === props.currentTOC.uid
})

const allColumns = computed(() => {
  if (!isCurrent.value) return []
  const showSystemFields: string[] = [
    SystemField.DATA_TITLE,
    SystemField.CREATE_OWNER,
    SystemField.DATA_OWNER,
    SystemField.CREATE_TIME,
    SystemField.UPDATE_TIME,
  ];
  const fields = props.table?.fields ?? [];
  const columns: Column[] = [];
  const systemColumns: Column[] = [];
  for (const field of fields ?? []) {
    const column: Column = {
      uid: field.uid,
      name: field.meta?.name,
      alias: field.alias,
      subType: field.meta?.subType,
      extra: field.meta?.extra,
    };
    if (isSystemField(field)) {
      if ([SystemField.CREATE_OWNER, SystemField.DATA_OWNER, SystemField.UPDATE_OWNER].includes(field.meta.name as SystemField)) {
        column.subType = "account";
      }
      if (showSystemFields.includes(field.meta.name)) {
        systemColumns.push(column);
      }
    } else {
      column.elementId = field.meta?.uid;
      columns.push(column);
    }
  }
  systemColumns.sort((a, b) => showSystemFields.indexOf(a.name) - showSystemFields[b.name]);
  if (!isEmpty(systemColumns)) {
    columns.unshift(systemColumns[0]);
    columns.push(...systemColumns.slice(1));
  }
  return columns;
})
const SizeDataCom = computed(() => {
  return SizeData.map((item) => {
    const label = item.type === SizeStateEnum.LARGE
      ? i18next.t("albumSettingDrawer.albumSettingSizeValue.Large")
      : item.type === SizeStateEnum.MEDIUM
        ? i18next.t("albumSettingDrawer.albumSettingSizeValue.Medium")
        : i18next.t("albumSettingDrawer.albumSettingSizeValue.Small");
    return {
      value: item.type,
      label,
    };
  });
});
const coverColumnUid = computed({
  get() {
    if (!albumStateOption.value) return '';
    if (albumStateOption.value.coverUid) return albumStateOption.value.coverUid;
    if (!allColumns.value) return "";

    const index = getCoverIndex(allColumns.value);
    if (!allColumns.value[index]) return "";
    return allColumns.value[index].uid;
  },
  set(value) {
    if (albumStateOption.value) {
      albumStateOption.value.coverUid = value;
    }
  },
});
const CoverStateOptions = computed(() => {
  return [
    {
      value: AlbumCoverStateEnum.COVER,
      label: i18next.t("albumSettingDrawer.albumSettingCoverClipStyleLabel"),
    },
    {
      value: AlbumCoverStateEnum.CONTAIN,
      label: i18next.t("albumSettingDrawer.albumSettingCoverAutoStyleLabel"),
    },
  ];
});
const fieldTitleStateOptions = computed(() => {
  return [
    {
      value: FieldTitleStateEnum.SHOW,
      label: i18next.t("albumSettingDrawer.albumSettingFieldShowLabel"),
    },
    {
      value: FieldTitleStateEnum.HIDE,
      label: i18next.t("albumSettingDrawer.albumSettingFieldHideLabel"),
    },
  ];
});

const originAlbumStateOption = ref<AlbumStateOption | {}>({});
const originViewName = ref("");

const showColumns = computed<useColumnType[]>(() => {
  if (!allColumns.value) return [];
  return sortOrderColumns.value.reduce<useColumnType[]>((result, uid) => {
    const item = allColumnsMap.value.get(uid);
    if (!item) return result;
    const hiddenColumns = albumStateOption.value?.hiddenColumns ?? [];
    result.push({
      ...item,
      show: isShowColums(item) && !hiddenColumns.includes(item.uid),
    });
    return result;
  }, []);
});

const filedSelectorOption = computed(() => {
  if (!allColumns.value) return [];
  const hiddenColumns = albumStateOption.value?.hiddenColumns ?? [];

  return allColumns.value
    .filter((item) => {
      return isShowColums(item);
    })
    .map((item) => {
      return {
        label: item.alias,
        value: item.uid,
        disabled: !hiddenColumns.includes(item.uid),
      };
    });
});
const handleSelect = (option) => {
  const index = albumStateOption.value?.hiddenColumns.findIndex((item) => {
    return item === option.value;
  });
  albumStateOption.value.hiddenColumns.splice(index, 1);
};

const coverColumn = computed(() => {
  if (!allColumns.value) return [];
  return allColumns.value.filter((item) => {
    return isCoverColumn(item);
  });
});

const sizeTypeCom = computed({
  get() {
    if (albumStateOption.value && albumStateOption.value.sizeType) {
      return albumStateOption.value.sizeType;
    }
    return DefautAlbumStateOption.sizeType;
  },
  set(value) {
    if (albumStateOption.value) {
      albumStateOption.value.sizeType = value;
    }
  },
});
const showCoverCom = computed({
  get() {
    if (albumStateOption.value && typeof albumStateOption.value.showCover === "boolean") {
      return albumStateOption.value.showCover;
    }
    return DefautAlbumStateOption.showCover;
  },
  set(value) {
    if (albumStateOption.value) {
      albumStateOption.value.showCover = value;
    }
  },
});
const albumCoverStateCom = computed({
  get() {
    if (albumStateOption.value && albumStateOption.value.albumCoverState) {
      return albumStateOption.value.albumCoverState;
    }
    return DefautAlbumStateOption.albumCoverState;
  },
  set(value) {
    if (albumStateOption.value) {
      albumStateOption.value.albumCoverState = value;
    }
  },
});

const fieldTitleStateCom = computed({
  get() {
    if (albumStateOption.value && albumStateOption.value.fieldTitleState) {
      return albumStateOption.value.fieldTitleState;
    }
    return DefautAlbumStateOption.fieldTitleState;
  },
  set(value) {
    if (albumStateOption.value) {
      albumStateOption.value.fieldTitleState = value;
    }
  },
});
const handleDelete = (column: Column) => {
  if (!Array.isArray(albumStateOption.value.hiddenColumns)) {
    albumStateOption.value.hiddenColumns = [];
  }
  albumStateOption.value.hiddenColumns.push(column.uid);
};
const endDrag = ({ oldIndex, newIndex }) => {
  const moveArrayItem = (arr: any[], oldIndex: number, newIndex: number) => {
    const newArr = [...arr];
    const item = newArr.splice(oldIndex, 1)[0];
    newArr.splice(newIndex, 0, item);
    return newArr;
  };
  albumStateOption.value.sortOrderColumns = moveArrayItem(
    albumStateOption.value.sortOrderColumns,
    oldIndex,
    newIndex
  );
};

const nocodeSignIsLatest = inject(NOCODE_SIGN_IS_LATEST, null);

const saveTabData = async () => {
  if (!checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return;
  await axios
    .post("/project/save-nocode-toc", {
      nocodeId: toRaw(nocode.value.meta.id),
      tableId: props.table.uid,
      data: nocode.value.body.views[props.table.uid],
    }, {
      headers: {
        'x-sign': nocode.value.body.sign,
      },
    })
    .then(({headers}) => {
      const mainSign = Array.isArray(headers?.['x-sign']) ? headers['x-sign'][0] : headers?.['x-sign'];
      if (mainSign) {
        nocode.value.body.sign = mainSign;
      }
    })
    .catch((error) => {
      if (handleNocodeSyncConflictError(error, nocodeSignIsLatest)) return;
      ElMessage.error(error.message);
    });
};

const setViewName = (name: string) => {
  const item = nocode.value.body.views[props.table.uid].find(
    (item) => item.uid === viewActiveUid.value
  );
  if (item.name !== name) {
    item.name = name;
  }
};
const setAlbumStateOption = (option: AlbumStateOption) => {
  const index = nocode.value.body.views[props.table.uid].findIndex(
    (item) => item.uid === viewActiveUid.value
  );
  for (const key in option) {
    if (!Object.hasOwn(option, key)) continue;
    nocode.value.body.views[props.table.uid][index][key] = option[key];
  }
};
// 数据恢复原来
const dataToOrigin = () => {
  if (!isCurrent.value) return
  setAlbumStateOption(originAlbumStateOption.value as AlbumStateOption);
  setViewName(originViewName.value);
};
const initData = () => {
  if (!isCurrent.value) return
  const item = nocode.value.body.views[props.table.uid].find(
    (item) => item.uid === viewActiveUid.value
  );
  // 保存配置原数据
  originAlbumStateOption.value = deepClone({
    ...DefautAlbumStateOption,
    ...item,
    sortOrderColumns: getSortOrderColumns(),
  });
  nextTick(() => {
    albumStateOption.value.sortOrderColumns = getSortOrderColumns();
  });
  // 处理表单名字
  originViewName.value = item ? item.name : '';
  viewName.value = item ? item.name : '';
};

const handleClose = () => {
  if (!isCurrent.value) return
  dataToOrigin();
  viewSettingDrawerRef.value?.hide();
};
const handleCancel = () => {
  if (!isCurrent.value) return
  dataToOrigin();
  viewSettingDrawerRef.value?.hide();
};
// 通过点击其他地方关闭抽屉 需要恢复数据
const handleDrawerOtherClose = () => {
  if (!isCurrent.value) return
  dataToOrigin();
};
// 抽屉打开
const handleDrawerOpen = () => {
  if (!isCurrent.value) return
  initData();
};
forDataViewerEmitter.on(Events.DRAWER_OTHERCLOSE, handleDrawerOtherClose);
forDataViewerEmitter.on(Events.DRAWER_OPEN, handleDrawerOpen);
onUnmounted(() => {
  forDataViewerEmitter.off(Events.DRAWER_OTHERCLOSE, handleDrawerOtherClose);
  forDataViewerEmitter.off(Events.DRAWER_OPEN, handleDrawerOpen);
});
const save = () => {
  setAlbumStateOption(albumStateOption.value);
  setViewName(viewName.value);
  saveTabData();
};
const handleConfirm = () => {
  if (!isCurrent.value) return
  save();
  viewSettingDrawerRef.value?.hide();
};
onMounted(() => {
  if (!isCurrent.value) return
  initData();
});
</script>

<style lang="scss" scoped>
.album-setting-panel {
  .album-setting-item {
    border-bottom: 1px solid #d9d9d9;

    &:last-child {
      border: none;
    }

    &:first-child {
      .album-setting-row {
        &:first-child {
          padding-top: 0;
        }
      }
    }
  }

  .album-setting-row {
    display: flex;
    align-items: start;
    padding-bottom: 16px;

    &:first-child {
      padding-top: 16px;
    }
  }

  .label {
    height: 32px;
    width: 80px;
    color: #141414;
    font-size: 14px;
    line-height: 32px;
  }

  .value {
    flex: 1;
    flex-basis: auto;
    min-height: 32px;
    display: flex;
    align-items: center;

    .el-input {
      --el-input-border-radius: 4px;
      --el-input-bg-color: #f5f6f7;
    }

    .el-select {
      --el-border-radius-base: 4px;
      --el-fill-color-blank: #f5f6f7;
    }
  }

  .drag-container {
    width: 100%;
  }

  .drag {
    width: 100%;
  }

  .drag-item {
    width: 100%;
    box-sizing: border-box;
    height: 32px;
    border-radius: 4px;
    border: 1px solid #0000001a;

    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px;
    gap: 8px;

    color: #141414cc;

    margin-bottom: 8px;

    .drag-text {
      flex: 1;
    }
  
    .move {
      cursor: move;
    }

    &:last-child {
      margin-bottom: 0px;
    }
  }

  .drag-right {
    display: flex;
    justify-content: right;
    gap: 8px;
    color: #727272;

    .delete {
      cursor: pointer;
    }

  }

  .add-btn {
    line-height: 32px;
    height: 32px;
  }
}

.el-popper {
  background-color: #ffffff;
}

.columnSelect-container {
  display: flex;
  align-items: center;
  flex-direction: column;
  max-height: 300px;
  overflow-y: auto;

  .columnSelect-none {
    width: 100%;
    height: 150px;
    line-height: 150px;
    text-align: center;
    color: gray;
    box-sizing: border-box;
  }

  .column-row {
    width: 100%;
    height: 30px;
    line-height: 30px;
    border-radius: 4px;
    margin-bottom: 4px;
    cursor: pointer;

    &:hover {
      background-color: #f5f6f8;
    }

    &:last-child {
      margin-bottom: 0px;
    }
  }

  .column-row .column-row-hide {
    opacity: 0.5;
    cursor: not-allowed;

    &:hover {
      background-color: #ffffff;
    }
  }
}
</style>
