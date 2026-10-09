<template>
  <b2-widget>
    <div class="pivot-table-widget">
      <div v-if="widget.dataErrorText" class="pivot-table-widget__error">
        {{ widget.dataErrorText }}
      </div>

      <div class="pivot-table-wrapper" v-else>
        <div class="pivot-table-widget__toolbar">
          <button
            type="button"
            class="pivot-table-widget__export-button"
            :title="$t('exportAction')"
            @click.stop.prevent="handleExport"
          >
            <el-icon :size="16"><IVenIconExport /></el-icon>
          </button>
        </div>

        <pivot-table-adapter
          ref="pivotTableAdapterRef"
          :widget="widget"
          @change-left-expand-keys="handleLeftExpandChange"
          @change-top-expand-keys="handleTopExpandChange"
          @column-width-change="handleColumnWidthChange"
        />
      </div>
    </div>
  </b2-widget>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { useWidget } from "@renderer/b2/types";
import { ElMessage } from "element-plus";
import { utils as xlsxUtils, writeFile as writeXlsxFile } from "xlsx/dist/xlsx.full.min.js";
import IVenIconExport from "~icons/ven-icon/widget-form-pivot-table-export";
import i18next, { $t } from "@renderer/widgets/i18next";
import PivotTableAdapter from "./PivotTableAdapter.vue";
import { PivotTableWidget } from "./pivot-table";

type PivotTableExportData = {
  data: any[][];
  merges?: Array<{
    s: { r: number; c: number };
    e: { r: number; c: number };
  }>;
  sheetName?: string;
};

type PivotTableAdapterExpose = {
  getExportData?: () => PivotTableExportData | undefined;
};

const widget = useWidget<PivotTableWidget>();
const pivotTableAdapterRef = ref<PivotTableAdapterExpose | null>(null);

const normalizeExcelName = (value: unknown, fallback: string, maxLength?: number) => {
  const name = String(value || fallback)
    .replace(/[\\/?*:[\]]/g, " ")
    .trim();
  const limitedName = maxLength ? name.slice(0, maxLength) : name;
  return limitedName || fallback;
};

const handleExport = () => {
  const exportData = pivotTableAdapterRef.value?.getExportData?.();
  if (!exportData?.data?.length) {
    ElMessage.error(i18next.t("exportNoData"));
    return;
  }

  const worksheet = xlsxUtils.aoa_to_sheet(exportData.data);
  if (exportData.merges?.length) {
    worksheet["!merges"] = exportData.merges;
  }

  const workbook = xlsxUtils.book_new();
  const sheetName = normalizeExcelName(i18next.t("defaultName"), "PivotTable", 31);
  xlsxUtils.book_append_sheet(workbook, worksheet, sheetName);
  writeXlsxFile(workbook, `${normalizeExcelName(widget.name, i18next.t("defaultName"))}.xlsx`);
};

const handleLeftExpandChange = (payload: { nextKeys: string[] }) => {
  widget.runtimeState.leftExpandKeys = [...payload.nextKeys];
};

const handleTopExpandChange = (payload: { nextKeys: string[] }) => {
  widget.runtimeState.topExpandKeys = [...payload.nextKeys];
};

type PivotColumnWidthChangePayload = {
  column?: {
    key?: string;
    meta?: {
      pivot?: {
        leftMetaColumn?: {
          key?: string;
        };
      };
    };
  };
  width: number;
};

const resolveColumnWidthOptionKey = (payload: PivotColumnWidthChangePayload) => {
  const pivotMeta = payload.column?.meta?.pivot;
  const leftMetaKey = String(pivotMeta?.leftMetaColumn?.key || "").trim();
  if (leftMetaKey) {
    return leftMetaKey;
  }

  return String(payload.column?.key || "").trim();
};

const handleColumnWidthChange = (payload: PivotColumnWidthChangePayload) => {
  const optionKey = resolveColumnWidthOptionKey(payload);
  const nextWidth = Math.max(100, Math.round(Number(payload.width) || 0));
  if (!optionKey || nextWidth <= 0) {
    return;
  }

  if (widget.columnWidthMap[optionKey] === nextWidth) {
    return;
  }

  widget.setOption("column-width-map", {
    ...widget.columnWidthMap,
    [optionKey]: nextWidth,
  }, false);
};
</script>

<style lang="scss" scoped>
.pivot-table-widget__export-button {
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-color-primary);
  background: transparent;
  cursor: pointer;
  transition: background-color 0.15s;

  &:hover {
    background-color: #dedfe0;
  }
}

.pivot-table-wrapper {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.pivot-table-widget__toolbar {
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-shrink: 0;
  margin-bottom: 8px;
}

.pivot-table-widget {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-radius: 8px;
  overflow: hidden;
  padding: 8px;
}

.pivot-table-widget__error {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
}

</style>
