<template>
  <el-checkbox-group
    :modelValue="widget.checkboxRow"
    @update:modelValue="setCheckboxRow"
    class="album-panel"
    :class="{'mobile': isMobileDevice}"
    :style="albumStyle"
  >
    <album-card
      class="album-card-box"
      v-for="(item, index) in widget.rows"
      :key="index"
      :type="sizeType"
      :value="item"
      :allColumns="widget.allColumns"
      :widgetTable="widget"
      :tableId="tableId"
      @click="handleCard(item)"
    ></album-card>
  </el-checkbox-group>
</template>

<script lang="ts" setup>
import { NOCODE, VIEW_ACTIVE_UID } from "@renderer/types";
import { Nocode } from "@common/types/nocode";
import {
  SizeType,
  SizeData,
  DefautAlbumStateOption,
  AlbumStateOption,
} from "../album";
import { computed, onUnmounted, ref, watch, Ref, inject } from "vue";
import { Table } from "../table";
import { isMobile } from "@renderer/utils";

const isMobileDevice = isMobile();

interface Props {
  widget: Table;
  tableId: string;
}
const nocode: Ref<Nocode> = inject(NOCODE);
const viewActiveUid = inject(VIEW_ACTIVE_UID)

const props = withDefaults(defineProps<Props>(), {
  widget: null,
});
const emits = defineEmits<{
  (event: "clickCard", value: object): void;
}>();
const albumStateOption = computed(() => {
  return nocode.value.body.views[props.tableId].find(
    (item) => item.uid === viewActiveUid.value
  );
});
const sizeType = computed(() => {
  if (!albumStateOption.value || !albumStateOption.value.sizeType) {
    return DefautAlbumStateOption.sizeType;
  }
  return albumStateOption.value.sizeType;
});

const width = computed(() => {
  return SizeData.find((item) => item.type === sizeType.value).size;
});

const albumStyle = computed(() => {
  if (isMobileDevice) {
    return `
    --album-card-width: 100%;
    --album-card-max-width: 100%;
  `
  }
  return `
    --album-card-width: ${width.value[0]}px;
    --album-card-max-width: ${width.value[1]}px;
  `;
});
const handleCard = (item: object) => {
  emits("clickCard", item);
};
const setCheckboxRow = (value: any) => {
  props.widget.setCheckboxRow(value);
};
</script>

<style lang="scss" scoped>
.album-panel {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(var(--album-card-width), var(--album-card-max-width)));
  grid-auto-rows: min-content;
  justify-content: flex-start;
  gap: 10px;
  overflow-y: auto;
  padding-bottom: 4px;
  .album-card-box {
    height: 100%;
    max-width: var(--album-card-max-width);
  }
}

.album-panel.mobile {
  overflow-y: auto;
  &::-webkit-scrollbar {
    display: none;
  }
  scrollbar-width: none;
  -ms-overflow-style: none;
  .album-card-box {
    width: 100%;
  }
}
</style>
