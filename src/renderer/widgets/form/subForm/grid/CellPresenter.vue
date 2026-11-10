<template>
  <div
    ref="cellRef"
    class="cell-presenter"
    :class="cellClasses"
    :title="cellError || undefined"
    :data-cell-row="props.address.rowId"
    :data-cell-field="props.address.fieldId"
    @click="handleClick"
  >
    <template v-if="inlineEditable">
      <RuntimeOptionEditor
        v-if="isOptionEditor"
        :model-value="props.store.getValue(props.address)"
        :options="optionValues"
        :loading="dynamicOptionLoading"
        :error="dynamicOptionError"
        :data-dynamic-options="Boolean(dynamicOptionDescriptor)"
        :multiple="isOptionMultiple"
        :allow-custom="props.column.schema.allowCustom === true"
        :other-label="String(props.column.schema.otherLabel || '')"
        :placeholder="String(props.column.schema.placeholder || '')"
        :display="optionDisplay"
        :add-option="appendCustomOption"
        @commit="commitEditorValue"
        @cancel="syncInlineDraft"
        @open="loadDynamicOptions"
        @close="releaseDynamicOptions"
      />
      <RuntimeTagEditor
        v-else-if="isTagEditor"
        :model-value="props.store.getValue(props.address)"
        :placeholder="String(props.column.schema.placeholder || '')"
        @commit="commitEditorValue"
        @cancel="syncInlineDraft"
      />
      <RuntimeAddressEditor
        v-else-if="isAddressEditor"
        :model-value="props.store.getValue(props.address)"
        :placeholder="String(props.column.schema.selectorPlaceholder || props.column.schema['selector-placeholder'] || i18next.t('subFormPlsSelectRegion'))"
        :detail-placeholder="String(props.column.schema.inputPlaceholder || props.column.schema['input-placeholder'] || i18next.t('subFormPlsInputDetailAddress'))"
        :with-detail="props.column.schema.addressDetail !== false && props.column.schema['address-detail'] !== false"
        :precision="Number(props.column.schema.addressPrecision || props.column.schema['address-precision'] || 4)"
        @commit="commitEditorValue"
        @cancel="syncInlineDraft"
      />
      <RuntimePositionEditor
        v-else-if="isPositionEditor"
        :model-value="props.store.getValue(props.address)"
        :map-key="props.column.schema.mapKey || props.column.schema['map-key']"
        :clear-button="positionClearButton"
        :show-coordinates="props.column.schema.showCoordinates === true"
        :auto-position="props.column.schema.autoPosition === true"
        :auto-position-key="`${props.address.rowId}\u0000${props.address.fieldId}`"
        @commit="commitEditorValue"
        @cancel="syncInlineDraft"
      />
      <RuntimeDateEditor
        v-else-if="isDateEditor || isDateRangeEditor"
        :model-value="dateDraft"
        :type="datePickerType"
        :format="dateFormat"
        :placeholder="String(props.column.schema.placeholder || i18next.t('subFormPlsSelectDate'))"
        :start-placeholder="String(props.column.schema.startPlaceholder || i18next.t('subFormDateStart'))"
        :end-placeholder="String(props.column.schema.endPlaceholder || i18next.t('subFormDateEnd'))"
        @commit="commitEditorValue"
        @cancel="syncInlineDraft"
      />
      <RuntimeTimeEditor
        v-else-if="isTimeEditor"
        :model-value="props.store.getValue(props.address)"
        :format="timeFormat"
        :placeholder="String(props.column.schema.placeholder || i18next.t('subFormPlsSelectTime'))"
        @commit="commitEditorValue"
        @cancel="syncInlineDraft"
      />
      <el-rate
        v-else-if="isRateEditor"
        class="cell-presenter__rate"
        :model-value="rateDraft"
        :max="rateMax"
        :allow-half="rateAllowHalf"
        :colors="rateColors"
        @change="handleRateChange"
        @click.stop
      />
      <textarea
        v-else-if="!isOptionEditor && isTextarea"
        class="cell-presenter__input cell-presenter__textarea"
        :placeholder="String(props.column.schema.placeholder || '')"
        :value="inlineDraft"
        @input="handleInput"
        @change="commitInline"
        @blur="commitInline"
        @keydown.ctrl.enter.exact.prevent="commitInline"
        @keydown.exact.stop
      />
      <input
        v-else-if="!isOptionEditor && inputType !== 'checkbox'"
        class="cell-presenter__input"
        :type="inputType"
        :inputmode="inputMode"
        :placeholder="String(props.column.schema.placeholder || '')"
        :value="nativeInputDraft"
        :maxlength="inputMaxLength"
        @focus="handleInlineFocus"
        @input="handleInput"
        @blur="handleInlineBlur"
        @keydown.enter.prevent="handleEnterKey"
        @keydown.stop
      />
      <el-switch
        v-else
        class="cell-presenter__switch"
        :model-value="booleanDraft"
        :active-text="booleanDraft ? switchActiveText : switchInactiveText"
        :inline-prompt="switchInlinePrompt"
        @change="handleBooleanChange"
        @click.stop
      />
    </template>
    <el-rate
      v-else-if="isRateEditor"
      class="cell-presenter__rate cell-presenter__rate--readonly"
      :model-value="rateDraft"
      :max="rateMax"
      :allow-half="rateAllowHalf"
      :colors="rateColors"
      disabled
    />
    <span
      v-else
      class="cell-presenter__value"
      :class="[
        {
          'cell-presenter__action-value': isActionOnly && !showsUploadStrip,
          'cell-presenter__action-value--has-value': isActionOnly && hasActionValue && !showsUploadStrip,
          'cell-presenter__action-value--upload-selected': isEmptyUploadCell && uploadCellSelected,
          'cell-presenter__readonly-box': isReadonlyCell,
          'cell-presenter__readonly-box--empty': isReadonlyCell && readonlyContent.placeholder,
          'cell-presenter__readonly-box--multiline': isReadonlyCell && isTextarea,
        },
        isActionOnly && !showsUploadStrip ? `cell-presenter__action-value--${actionVariant}` : '',
      ]"
      @dragover="handleUploadDragOver"
      @drop="handleUploadDrop"
    >
      <RuntimeUploadCell
        v-if="showsUploadStrip"
        :type="props.column.type"
        :items="uploadItems"
        :readonly="isReadonlyCell"
        @open="handleUploadOpen"
      />
      <template v-else-if="isActionOnly && !isReadonlyCell && actionVariant === 'image-upload'">
        <el-icon class="cell-presenter__action-icon"><IImageUpload /></el-icon>
        <span class="cell-presenter__upload-label">{{ uploadLabelText }}</span>
        <span class="cell-presenter__upload-hint">{{ uploadHintText }}</span>
      </template>
      <template v-else-if="isActionOnly && !isReadonlyCell && actionVariant === 'file-upload'">
        <el-icon class="cell-presenter__action-icon"><IFileUpload /></el-icon>
        <span class="cell-presenter__upload-label">{{ uploadLabelText }}</span>
        <span class="cell-presenter__upload-hint">{{ uploadHintText }}</span>
      </template>
      <span v-else-if="isActionOnly && !isReadonlyCell && actionVariant === 'member' && !hasActionValue" class="cell-presenter__action-icon cell-presenter__action-icon--plus">+</span>
      <span v-else-if="isActionOnly && !isReadonlyCell && actionVariant === 'department' && !hasActionValue" class="cell-presenter__action-icon cell-presenter__action-icon--plus">+</span>
      <el-icon v-else-if="isActionOnly && !isReadonlyCell && actionVariant === 'select-data'" class="cell-presenter__action-icon"><IDatabaseSuccess /></el-icon>
      <el-icon v-else-if="isActionOnly && !isReadonlyCell && actionVariant === 'related-data'" class="cell-presenter__action-icon"><IDatabaseSync /></el-icon>
      <a
        v-if="readonlyHyperlink"
        class="cell-presenter__link"
        :href="readonlyHyperlink.href"
        :title="readonlyHyperlink.href"
        target="_blank"
        rel="noopener noreferrer"
        @click.stop
      >{{ readonlyHyperlink.label }}</a>
      <span
        v-else-if="isReadonlyCell && readonlyOrganizeItems.length"
        class="cell-presenter__organize-list"
      >
        <template v-for="(item, index) in readonlyOrganizeItems" :key="`${item.id}-${index}`">
          <span v-if="index > 0" class="cell-presenter__organize-sep">,</span>
          <el-popover trigger="click" placement="bottom-start" :width="200" :show-arrow="false">
            <template #reference>
              <span class="cell-presenter__organize-link" :title="item.label" @click.stop>{{ item.label }}</span>
            </template>
            <div v-if="isMemberField" class="cell-presenter__user-card">
              <div class="cell-presenter__user-card-top">
                <span class="cell-presenter__user-avatar">{{ item.realname?.[0] || '?' }}</span>
                <span class="cell-presenter__user-name">{{ item.realname }}</span>
              </div>
              <div class="cell-presenter__user-info">
                <div class="cell-presenter__user-row">
                  <span class="cell-presenter__user-label">{{ i18next.t("nameLabel") }}</span>{{ item.account }}
                </div>
                <div class="cell-presenter__user-row">
                  <span class="cell-presenter__user-label">{{ i18next.t("phoneLabel") }}</span>{{ item.phone }}
                </div>
                <div class="cell-presenter__user-row">
                  <span v-if="!item.isAdmin" class="cell-presenter__user-label">{{ i18next.t("departmentLabel") }}</span>{{ item.departmentName }}
                </div>
              </div>
            </div>
            <span v-else>{{ i18next.t("departmentOwnership") }}&nbsp;{{ item.parentsLabel }}</span>
          </el-popover>
        </template>
      </span>
      <span v-else-if="!showsUploadStrip && !isEmptyUploadCell">{{ isReadonlyCell ? readonlyContent.text : displayValue }}</span>
    </span>
  </div>
</template>

<script lang="ts" setup>
import { computed, inject, onBeforeUnmount, ref, watch } from "vue";
import type { CellAddress } from "../runtime/types";
import type { ColumnDefinition } from "../runtime/column-definition";
import type { RowStore } from "../runtime/row-store";
import type { RuntimeAsyncToken } from "../runtime/async-service";
import type { RuntimeRelatedDataService } from "../runtime/related-data-service";
import type { DynamicOptionDescriptor, RuntimeOptionService, RuntimeOptionToken } from "../runtime/option-service";
import { getRuntimeFieldCapability, isRuntimeActionOnly, isRuntimeCellEditable } from "./runtime-editor-capabilities";
import i18next from "@renderer/widgets/i18next";
import { useOrganizeCacheStore } from "@renderer/stores/organizeCache";
import { displayUserInfoByUser } from "@renderer/utils/other";
import { displayFilledMemberInfoByUser } from "../../memberSelect/display-user-info";
import type { MemberShowInfo } from "@common/types/nocode";
import RuntimeTagEditor from "./RuntimeTagEditor.vue";
import RuntimeAddressEditor from "./RuntimeAddressEditor.vue";
import RuntimePositionEditor from "./RuntimePositionEditor.vue";
import RuntimeOptionEditor from "./RuntimeOptionEditor.vue";
import RuntimeDateEditor from "./RuntimeDateEditor.vue";
import RuntimeTimeEditor from "./RuntimeTimeEditor.vue";
import RuntimeUploadCell from "./RuntimeUploadCell.vue";
import { normalizeUploadItems, type RuntimeUploadDisplayItem } from "./runtime-upload-utils";
import { RUNTIME_PENDING_UPLOADS, type RuntimePendingUploads } from "./runtime-pending-uploads";
import { RUNTIME_UPLOAD_CELL, type RuntimeUploadCellService } from "./runtime-upload-cell";
import IDatabaseSuccess from "~icons/icon-park-outline/database-success";
import IDatabaseSync from "~icons/icon-park-outline/database-sync";
import IImageUpload from "~icons/ven-icon/widget-form-image-uploader-upload";
import IFileUpload from "~icons/ven-icon/widget-form-file-uploader-file";

const props = defineProps<{
  address: CellAddress;
  column: ColumnDefinition;
  store: RowStore;
  version?: number;
  actionSelected?: boolean;
  readonly?: boolean;
  relatedDataService?: RuntimeRelatedDataService | null;
  optionService?: RuntimeOptionService | null;
}>();

const emit = defineEmits<{
  (e: "commit", payload: { address: CellAddress; value: unknown }): void;
  (e: "click", address: CellAddress): void;
  (e: "action", address: CellAddress, anchor?: HTMLElement | null, readonly?: boolean): void;
  (e: "enter", address: CellAddress): void;
}>();

const canEdit = computed(() => !props.readonly && isRuntimeCellEditable(props.column));
const inlineEditable = computed(() => canEdit.value && !props.column.adapter.isReadonly?.(rowContext.value!));
const isHyperlinkSelect = computed(() => props.column.type === "widget.form.hyperlink"
  && props.column.schema.linkType === "form"
  && Array.isArray(props.column.schema.hyperlinkOptions));
const isOptionEditor = computed(() => [
  "widget.form.radioGroup",
  "widget.form.checkboxGroup",
  "widget.form.treeSelect",
  "widget.form.treeMultipleSelect",
].includes(props.column.type) || isHyperlinkSelect.value);
const isOptionMultiple = computed(() => props.column.type === "widget.form.checkboxGroup"
  || props.column.type === "widget.form.treeMultipleSelect"
  || props.column.schema.isMultiple === true);
const optionDisplay = computed<"tag" | "text">(() => (
  props.column.type === "widget.form.treeMultipleSelect" ? "text" : "tag"
));
const dynamicOptionDescriptor = computed(() => props.column.schema.dynamicOptions as DynamicOptionDescriptor | undefined);
const dynamicOptionValues = ref<readonly { value: string; label: string; depth?: number }[]>([]);
const dynamicOptionLoading = ref(false);
const dynamicOptionError = ref("");
let dynamicOptionToken: RuntimeOptionToken | undefined;
const optionValues = computed(() => {
  void props.version;
  const base = (isHyperlinkSelect.value
    ? props.column.schema.hyperlinkOptions
    : dynamicOptionDescriptor.value
      ? dynamicOptionValues.value
      : props.column.schema.options || []) as readonly { value: string; label: string; depth?: number }[];
  const added = props.optionService?.getAddedOptions(props.column.fieldId) || [];
  if (!added.length) return base;
  const known = new Set(base.map(option => option.value));
  return [...base, ...added.filter(option => !known.has(option.value))];
});
const appendCustomOption = computed(() => {
  if (!isOptionMultiple.value || props.column.schema.allowAddCustomOption !== true) return undefined;
  const append = props.column.schema.appendCustomOption as
    | ((value: string) => { value: string; label: string } | null)
    | undefined;
  if (typeof append !== "function") return undefined;
  return (value: string) => {
    const existed = optionValues.value.find(option => option.value === value);
    if (existed) return { value: existed.value, label: existed.label };
    return append(value);
  };
});
const inputType = computed(() => {
  if (props.column.type === "widget.form.numberInput" || props.column.type === "widget.form.amountInput") return "text";
  if (props.column.type === "widget.form.rate") return "number";
  if (props.column.type === "widget.form.datePicker") return "date";
  if (props.column.type === "widget.form.phoneInput") return "tel";
  if (props.column.type === "widget.form.timePicker") return "time";
  if (props.column.type === "widget.form.switch") return "checkbox";
  return "text";
});
const isNumericInput = computed(() => props.column.type === "widget.form.numberInput"
  || props.column.type === "widget.form.amountInput");
const inputMode = computed(() => isNumericInput.value ? "decimal" : undefined);
const isDateRangeEditor = computed(() => props.column.type === "widget.form.dateRangePicker");
const isDateEditor = computed(() => props.column.type === "widget.form.datePicker");
const isTimeEditor = computed(() => props.column.type === "widget.form.timePicker");
const datePickerType = computed(() => {
  const configured = String(props.column.schema.calendarType || props.column.schema.precision || "date");
  if (isDateRangeEditor.value) {
    if (configured === "datetime" || configured === "datetime-minute") return "datetimerange";
    if (configured.endsWith("range")) return configured;
    return "daterange";
  }
  return configured === "datetime-minute" ? "datetime" : configured;
});
const dateFormat = computed(() => String(props.column.schema.format || "YYYY-MM-DD"));
const timeFormat = computed(() => String(props.column.schema.timeFormat || props.column.schema.format || "HH:mm"));
const dateDraft = computed(() => {
  const value = props.version >= 0 ? props.store.getValue(props.address) : undefined;
  return isDateRangeEditor.value
    ? (Array.isArray(value) ? value : ["", ""])
    : value;
});
const isTagEditor = computed(() => props.column.type === "widget.form.tagInput");
const isAddressEditor = computed(() => props.column.type === "widget.form.address");
const isPositionEditor = computed(() => props.column.type === "widget.form.position");
const positionClearButton = computed(() => {
  const configured = props.column.schema.clearButton ?? props.column.schema["clear-button"];
  return configured === undefined ? true : configured === true;
});
const isRateEditor = computed(() => props.column.type === "widget.form.rate");
const rateDraft = computed(() => {
  const value = Number(props.version >= 0 ? props.store.getValue(props.address) : undefined);
  return Number.isFinite(value) ? value : 0;
});
const rateMax = computed(() => {
  const value = Number(props.column.schema.maxRate);
  return Number.isFinite(value) && value > 0 ? value : 5;
});
const rateAllowHalf = computed(() => props.column.schema.allowHalf === true);
const rateColors = computed(() => {
  const color = typeof props.column.schema.rateColor === "string" ? props.column.schema.rateColor : "#F7BA2A";
  return [color, color, color];
});

const switchActiveText = computed(() => String(props.column.schema.activeText || i18next.t("activeStateText", { ns: ["widget.form.switch", "translation"] })));
const switchInactiveText = computed(() => String(props.column.schema.inactiveText || i18next.t("inactiveStateText", { ns: ["widget.form.switch", "translation"] })));
const switchInlinePrompt = computed(() => props.column.schema.inlinePrompt === true);
const isSwitchOn = (value: unknown) => value === true
  || value === "true"
  || (switchActiveText.value !== "" && value === switchActiveText.value);
const inputMaxLength = computed(() => props.column.type === "widget.form.phoneInput" ? 11 : undefined);
const isTextarea = computed(() => props.column.type === "widget.form.textarea");
const inlineDraft = ref("");
const booleanDraft = ref(false);
const inlineDirty = ref(false);
const inlineFocused = ref(false);
const cellRef = ref<HTMLElement | null>(null);
const isActionOnly = computed(() => isRuntimeActionOnly(props.column.type));
const actionPlaceholder = computed(() => {
  const configured = props.column.schema.buttonText || props.column.schema.placeholder;
  if (configured) return String(configured);
  if (props.column.type === "widget.form.memberSelect") return i18next.t("subFormSelectMember");
  if (props.column.type === "widget.form.departmentSelect") return i18next.t("subFormSelectDepartment");
  if (props.column.type === "widget.form.relatedData") return i18next.t("subFormSelectRelatedData");
  return i18next.t("widgetSelectData");
});
const actionVariant = computed(() => {
  switch (props.column.type) {
  case "widget.form.memberSelect": return "member";
  case "widget.form.departmentSelect": return "department";
  case "widget.form.image-uploader": return "image-upload";
  case "widget.form.file-uploader": return "file-upload";
  case "widget.form.selectData": return "select-data";
  case "widget.form.relatedData": return "related-data";
  default: return "action";
  }
});
const hasActionValue = computed(() => {
  if (!isActionOnly.value) return false;
  if (props.actionSelected === true) return true;
  const value = props.store.getValue(props.address);
  return Array.isArray(value) ? value.some(item => item !== undefined && item !== null && item !== "")
    : value !== undefined && value !== null && value !== "";
});
const pendingUploads = inject<RuntimePendingUploads | null>(RUNTIME_PENDING_UPLOADS, null);
const pendingUploadItems = computed<RuntimeUploadDisplayItem[]>(() => (
  (pendingUploads?.list(props.address) || []).map(item => ({ ...item, pending: true }))
));

const uploadItems = computed<RuntimeUploadDisplayItem[]>(() => [
  ...normalizeUploadItems(props.store.getValue(props.address)),
  ...pendingUploadItems.value,
]);
const hasUploadValue = computed(() => uploadItems.value.length > 0);
const isUploadAction = computed(() => actionVariant.value === "image-upload" || actionVariant.value === "file-upload");
const showsUploadStrip = computed(() => isUploadAction.value && hasUploadValue.value);
const renderVersion = computed(() => props.version);
const relatedRenderVersion = ref(0);
let relatedRequest: RuntimeAsyncToken<readonly Record<string, unknown>[]> | undefined;

const rowContext = computed(() => {
  const row = props.store.getRow(props.address.rowId);
  if (!row) return null;
  return { address: props.address, row, store: props.store, version: renderVersion.value };
});

const isReadonlyCell = computed(() => props.readonly === true
  || props.column.adapter.isReadonly?.(rowContext.value!) === true
  || getRuntimeFieldCapability(props.column.type) === "readonly");

const isEmptyUploadCell = computed(() => isUploadAction.value && !isReadonlyCell.value && !hasUploadValue.value);
const uploadCell = inject<RuntimeUploadCellService | null>(RUNTIME_UPLOAD_CELL, null);
const uploadCellSelected = computed(() => uploadCell?.isSelected(props.address) === true);
const uploadLabelText = computed(() => i18next.t(actionVariant.value === "image-upload" ? "subFormUploadImage" : "subFormUploadFile"));
const uploadHintText = computed(() => i18next.t("subFormUploadHint"));

const displayValue = computed(() => {
  const ctx = rowContext.value;
  if (!ctx) return "";
  if (!props.column.adapter.isVisible?.(ctx)) return "";
  const value = props.store.getValue(props.address);
  const hasSelection = hasActionValue.value;
  if (isActionOnly.value && !isReadonlyCell.value && !hasSelection) {
    return actionPlaceholder.value;
  }
  if (isActionOnly.value && !isReadonlyCell.value && props.column.type === "widget.form.selectData") {
    return hasSelection
      ? String(props.column.schema.selectedButtonText || actionPlaceholder.value)
      : actionPlaceholder.value;
  }
  if (value === undefined || value === null) return "";
  if (relatedRenderVersion.value >= 0 && props.column.type === "widget.form.relatedData" && props.relatedDataService) {
    const ids = Array.isArray(value) ? value.filter(Boolean).map(String) : [String(value)];
    const tableUID = props.column.schema.relatedTableUID;
    const uuidFieldId = props.column.schema.relatedUuidFieldId;
    const titleFieldId = props.column.schema.relatedTitleFieldId;
    if (Array.isArray(tableUID) && typeof uuidFieldId === "string" && typeof titleFieldId === "string") {
      return props.relatedDataService.format(tableUID, ids);
    }
  }
  try {
    return props.column.adapter.format(ctx);
  } catch {
    return String(value);
  }
});

const noReadonlyPlaceholderTypes = new Set([
  "widget.form.memberSelect",
  "widget.form.departmentSelect",
  "widget.form.relatedData",
]);

const readonlyContent = computed<{ text: string; placeholder: boolean }>(() => {
  if (props.column.type === "widget.form.switch") {
    return { text: booleanDraft.value ? switchActiveText.value : switchInactiveText.value, placeholder: false };
  }
  if (props.column.type === "widget.form.selectData") {
    return {
      text: hasActionValue.value
        ? String(props.column.schema.selectedButtonText || actionPlaceholder.value)
        : actionPlaceholder.value,
      placeholder: false,
    };
  }
  const text = displayValue.value;
  if (String(text ?? "").trim()) return { text: String(text), placeholder: false };
  if (noReadonlyPlaceholderTypes.has(props.column.type)) return { text: "", placeholder: true };
  if (props.column.type === "widget.form.amountInput") return { text: i18next.t("subFormNoData"), placeholder: true };
  if (props.column.type === "widget.form.position") return { text: i18next.t("subFormNoPosition"), placeholder: true };
  return { text: i18next.t("subFormNoContent"), placeholder: true };
});

const readonlyHyperlink = computed(() => {
  if (!isReadonlyCell.value || props.column.type !== "widget.form.hyperlink") return null;
  const url = String(props.store.getValue(props.address) ?? "").trim();
  if (!/^https?:\/\//i.test(url)) return null;
  return { label: String(displayValue.value || url), href: url };
});

const organizeStore = useOrganizeCacheStore();
const isMemberField = computed(() => props.column.type === "widget.form.memberSelect");
const isDepartmentField = computed(() => props.column.type === "widget.form.departmentSelect");
const organizeDisplay = computed(() => props.column.schema.organizeDisplay as
  | { currentType: "member" | "department"; showInfo: string[]; autoFill: boolean }
  | undefined);

if (isMemberField.value || isDepartmentField.value) {
  void organizeStore.load();
}

type ReadonlyOrganizeItem = {
  id: string;
  label: string;
  realname: string;
  account: string;
  phone: string;
  departmentName: string;
  isAdmin: boolean;
  parentsLabel: string;
};

const resolveDepartmentParentsLabel = (id: string): string => {
  const byId = new Map(organizeStore.departments.map(item => [item.id, item]));
  const names: string[] = [];
  let current = byId.get(id);
  let guard = 0;
  while (current && guard++ < 100) {
    names.unshift(String(current.name || current.id || ""));
    current = current.parent ? byId.get(current.parent) : undefined;
  }
  return names.filter(Boolean).join("/") || id;
};

const readonlyOrganizeItems = computed<readonly ReadonlyOrganizeItem[]>(() => {
  if (!isReadonlyCell.value || (!isMemberField.value && !isDepartmentField.value)) return [];
  void props.version;
  const raw = props.store.getValue(props.address);
  const ids = Array.isArray(raw)
    ? raw.map(item => {
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        const identity = record.id ?? record.uid ?? record.value;
        return identity === undefined || identity === null ? "" : String(identity);
      }
      return String(item ?? "");
    }).filter(Boolean)
    : raw === undefined || raw === null || raw === ""
      ? []
      : [String(raw)];
  if (!ids.length) return [];
  if (isDepartmentField.value) {
    return ids.map(id => ({
      id,
      label: organizeStore.departments.find(item => item.id === id)?.name || id,
      realname: "",
      account: "",
      phone: "",
      departmentName: "",
      isAdmin: false,
      parentsLabel: resolveDepartmentParentsLabel(id),
    }));
  }
  const showInfo = (organizeDisplay.value?.showInfo || []) as MemberShowInfo;
  const autoFill = organizeDisplay.value?.autoFill === true;
  const dataset = {
    users: organizeStore.users,
    departments: organizeStore.departments,
    roles: organizeStore.roles,
  };
  return ids.map(id => {
    const user = organizeStore.users.find(item => item.id === id);
    const label = (autoFill
      ? displayFilledMemberInfoByUser(user, dataset, showInfo, i18next.t("unknownMember"))
      : displayUserInfoByUser(user, dataset, showInfo, i18next.t("unknownMember"))) || id;
    const firstDepartmentId = user?.departments?.[0];
    const department = firstDepartmentId
      ? organizeStore.departments.find(item => item.id === firstDepartmentId)
      : undefined;
    const isAdmin = user?.user === "admin";
    return {
      id,
      label,
      realname: user?.realname || "",
      account: user?.user || i18next.t("noneValue"),
      phone: user?.phone || i18next.t("noneValue"),
      departmentName: isAdmin ? i18next.t("superAdmin") : (department?.name || i18next.t("noneValue")),
      isAdmin,
      parentsLabel: "",
    };
  });
});

const syncInlineDraft = () => {
  const value = props.store.getValue(props.address);
  const ctx = rowContext.value;
  let displayValue = value;
  if (ctx && isNumericInput.value) {
    const formatter = inlineFocused.value
      ? props.column.adapter.formatEditor
      : props.column.adapter.format;
    displayValue = formatter?.(ctx) ?? value;
  }
  inlineDraft.value = displayValue === undefined || displayValue === null ? "" : String(displayValue);
  booleanDraft.value = isSwitchOn(value);
  inlineDirty.value = false;
};

const nativeInputDraft = computed(() => inlineDraft.value);

function releaseDynamicOptions() {
  dynamicOptionToken?.release();
  dynamicOptionToken = undefined;
  dynamicOptionLoading.value = false;
}

async function loadDynamicOptions() {
  const descriptor = dynamicOptionDescriptor.value;
  if (!descriptor || !props.optionService) return;
  releaseDynamicOptions();
  dynamicOptionError.value = "";
  dynamicOptionLoading.value = true;
  const token = props.optionService.request(props.address, descriptor);
  dynamicOptionToken = token;
  try {
    const options = await token.promise;
    if (!token.isCurrent()) return;
    dynamicOptionValues.value = options;
  } catch {
    if (token.isCurrent()) dynamicOptionError.value = i18next.t("subFormOptionLoadFailed");
  } finally {
    if (dynamicOptionToken === token) {
      dynamicOptionToken = undefined;
      dynamicOptionLoading.value = false;
      token.release();
    }
  }
}

watch(() => [props.address.rowId, props.address.fieldId, props.version], () => {
  if (!inlineDirty.value) syncInlineDraft();
  if (dynamicOptionDescriptor.value) {
    releaseDynamicOptions();
    dynamicOptionValues.value = [];
    dynamicOptionError.value = "";
  }
}, { immediate: true });

const cellError = computed(() => {
  const version = props.version;
  return version >= 0 ? (props.store.getCellState(props.address)?.error || "") : "";
});

const cellClasses = computed(() => ({
  "cell-presenter--readonly": props.readonly || props.column.adapter.isReadonly?.(rowContext.value!),
  "cell-presenter--hidden": !props.column.adapter.isVisible?.(rowContext.value!),
  "cell-presenter--editable": canEdit.value && !props.column.adapter.isReadonly?.(rowContext.value!),
  "cell-presenter--action": isActionOnly.value,
  "cell-presenter--error": !!cellError.value,
}));

const refreshRelatedData = () => {
  relatedRequest?.release();
  relatedRequest = undefined;
  if (props.column.type !== "widget.form.relatedData" || !props.relatedDataService) return;
  const value = props.store.getValue(props.address);
  const ids = Array.isArray(value) ? value.filter(Boolean).map(String) : value ? [String(value)] : [];
  const tableUID = props.column.schema.relatedTableUID;
  const uuidFieldId = props.column.schema.relatedUuidFieldId;
  const titleFieldId = props.column.schema.relatedTitleFieldId;
  if (!ids.length || !Array.isArray(tableUID) || typeof uuidFieldId !== "string" || typeof titleFieldId !== "string") return;
  relatedRequest = props.relatedDataService.request(props.address, tableUID, uuidFieldId, titleFieldId, ids);
  const request = relatedRequest;
  void request.promise.then(() => {
    if (request.isCurrent()) relatedRenderVersion.value += 1;
  });
};

watch(() => [props.address.rowId, props.address.fieldId, props.version], refreshRelatedData, { immediate: true });

onBeforeUnmount(() => {
  relatedRequest?.release();
  releaseDynamicOptions();
});

function handleInput(event: Event) {
  inlineDraft.value = (event.target as HTMLInputElement).value;
  if (isNumericInput.value) {
    const amount = (props.column.schema.amount || {}) as Record<string, unknown>;
    const decimalSeparator = String(amount.decimalSeparator || props.column.schema.decimalSeparator || ".");
    const escapedSeparator = decimalSeparator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const sign = inlineDraft.value.trimStart().startsWith("-") ? "-" : inlineDraft.value.trimStart().startsWith("+") ? "+" : "";
    const digits = inlineDraft.value.replace(new RegExp(`[^\\d${escapedSeparator}]`, "g"), "");
    const parts = digits.split(decimalSeparator);
    inlineDraft.value = sign + parts[0] + (parts.length > 1 ? decimalSeparator + parts.slice(1).join("") : "");
  }
  if (props.column.type === "widget.form.phoneInput") {
    inlineDraft.value = inlineDraft.value.replace(/\D/g, "").slice(0, 11);
  }
  inlineDirty.value = true;
}

function handleInlineFocus() {
  inlineFocused.value = true;
  if (isNumericInput.value) syncInlineDraft();
}

function handleInlineBlur() {
  inlineFocused.value = false;
  commitInline();
  syncInlineDraft();
}

function handleBooleanChange(value: boolean | string | number | Event) {
  booleanDraft.value = value instanceof Event
    ? (value.target as HTMLInputElement).checked
    : value === true || value === "true" || value === 1;
  inlineDirty.value = false;
  emit("commit", { address: props.address, value: booleanDraft.value });
}

function commitInline() {
  if (!inlineDirty.value) return;
  inlineDirty.value = false;
  emit("commit", { address: props.address, value: inlineDraft.value });
}

function handleEnterKey(event: KeyboardEvent) {
  if (event.isComposing || event.keyCode === 229) return;
  commitInline();
  emit("enter", props.address);
}

function commitEditorValue(value: unknown) {
  emit("commit", { address: props.address, value });
}

function handleRateChange(value: number) {
  emit("commit", { address: props.address, value });
}

function handleClick(event: MouseEvent) {
  emit("click", props.address);
  if (!isActionOnly.value || isReadonlyCell.value) return;
  if (isEmptyUploadCell.value && uploadCell) {
    uploadCell.select(props.address, cellRef.value);
    if ((event.target as HTMLElement | null)?.closest(".cell-presenter__upload-label, .cell-presenter__action-icon")) {
      uploadCell.pick(props.address);
    }
    return;
  }
  emit("action", props.address, cellRef.value, isReadonlyCell.value);
}

function handleUploadOpen() {
  emit("action", props.address, cellRef.value, isReadonlyCell.value);
}

function handleUploadDragOver(event: DragEvent) {
  if (!isEmptyUploadCell.value || !uploadCell) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
}

function handleUploadDrop(event: DragEvent) {
  if (!isEmptyUploadCell.value || !uploadCell) return;
  event.preventDefault();
  const files = [...(event.dataTransfer?.files || [])];
  if (files.length) uploadCell.drop(props.address, files);
}
</script>

<style lang="scss" scoped>
.cell-presenter {
  --cell-border: var(--el-border-color, var(--border-color));
  --cell-border-hover: var(--el-border-color-hover, var(--cell-border));
  --cell-focus: var(--el-color-primary, var(--color-primary));
  --cell-fill: var(--el-fill-color-blank, var(--bg-color));
  --cell-text: var(--el-text-color-regular, var(--text-color-primary));
  box-sizing: border-box;
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
  min-width: 0;
  padding: 3px 4px;
  overflow: hidden;
  user-select: none;
  background: transparent;
  color: var(--cell-text);
  line-height: 20px;

  &__value {
    box-sizing: border-box;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: 100%;
    padding: 0 4px;
  }

  &__input,
  &__select {
    width: 100%;
    min-width: 0;
    height: 32px;
    min-height: 32px;
    border: 1px solid var(--cell-border);
    border-radius: 4px;
    outline: none;
    padding: 0 8px;
    background: var(--cell-fill);
    color: var(--cell-text);
    font: inherit;
    box-sizing: border-box;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  &__input:hover,
  &__select:hover {
    border-color: var(--cell-border-hover);
  }

  &__input:focus,
  &__select:focus {
    border-color: var(--cell-focus);
    box-shadow: 0 0 0 1px var(--cell-focus) inset;
  }

  &__input:disabled,
  &__select:disabled {
    color: var(--el-text-color-disabled, var(--text-color-disabled));
    background: var(--el-fill-color-light, var(--cell-fill));
    cursor: not-allowed;
  }

  &__input::placeholder,
  &__select:invalid {
    color: var(--el-text-color-placeholder, var(--text-color-placeholder));
  }

  &__input,
  &__select {
    user-select: text;
  }

  &__textarea {
    height: calc(100% - 4px);
    min-height: 28px;
    padding-top: 4px;
    padding-bottom: 4px;
    resize: none;
  }

  &__date-range {
    display: flex;
    align-items: center;
    gap: 3px;
    width: 100%;
    min-width: 0;
  }

  &__date-range-separator {
    flex: 0 0 auto;
    color: var(--text-color-secondary);
  }

  &__rate {
    flex: 0 0 auto;
    min-width: 120px;
    width: auto;
    height: 28px;
    overflow: visible;

    :deep(.el-rate__icon) {
      margin-right: 2px;
      font-size: 18px;
    }

    :deep(.el-rate__icon:last-child) {
      margin-right: 0;
    }
  }

  &__switch {
    flex: 0 0 auto;
    margin: 0;
  }

  &__readonly-box {
    display: flex;
    align-items: center;
    height: 32px;
    padding: 0 8px;
    border: 1px solid var(--cell-border);
    border-radius: 2px;
    background: var(--el-bg-color-overlay);
    color: var(--el-text-color-primary);
  }

  &__readonly-box--empty {
    color: var(--text-color-inactive);
  }

  &__link {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--el-color-primary, var(--color-primary));
    text-decoration: none;
  }

  &__link:hover {
    text-decoration: underline;
  }

  &__organize-list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 2px;
    max-width: 100%;
    max-height: 100%;
    overflow: hidden;
  }

  &__organize-link {
    color: var(--el-color-primary, var(--color-primary));
    cursor: pointer;
  }

  &__organize-link:hover {
    text-decoration: underline;
  }

  &__user-card {
    display: flex;
    flex-direction: column;
  }

  &__user-card-top {
    display: flex;
    align-items: center;
    height: 48px;
    border-bottom: 1px solid var(--border-color);
    padding: 8px 10px;
  }

  &__user-avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    margin-right: 10px;
    border-radius: 50%;
    background-color: var(--color-primary);
    color: #fff;
    font-size: 20px;
    font-weight: bold;
    flex-shrink: 0;
  }

  &__user-name {
    font-size: 14px;
  }

  &__user-info {
    display: flex;
    flex-direction: column;
    flex: 1;
    font-size: 13px;
  }

  &__user-row {
    display: flex;
    gap: 8px;
    height: 36px;
    padding: 8px 12px;
    line-height: 20px;
    color: var(--text-color-regular);
  }

  &__user-label {
    color: #666;
  }

  &__readonly-box--multiline {
    height: calc(100% - 4px);
    padding: 4px 8px;
    align-items: flex-start;
    overflow-y: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  &__multi {
    position: relative;
    width: 100%;
    min-width: 0;
    height: 28px;
  }

  &__multi-summary {
    box-sizing: border-box;
    width: 100%;
    height: 28px;
    overflow: hidden;
    border: 1px solid var(--cell-border);
    border-radius: 3px;
    padding: 4px 24px 4px 8px;
    background: var(--cell-fill);
    color: var(--cell-text);
    cursor: pointer;
    list-style: none;
    line-height: 18px;
    text-overflow: ellipsis;
    white-space: nowrap;

    &::-webkit-details-marker {
      display: none;
    }

    &::after {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 6px;
      height: 6px;
      border-right: 1px solid var(--text-color-secondary);
      border-bottom: 1px solid var(--text-color-secondary);
      content: "";
      transform: rotate(45deg);
    }
  }

  &__multi[open] .cell-presenter__multi-summary {
    border-color: var(--cell-focus);
    box-shadow: 0 0 0 1px var(--cell-focus) inset;
  }

  &__multi-summary:hover {
    border-color: var(--cell-border-hover);
  }

  &__multi-menu {
    position: absolute;
    z-index: 20;
    top: 30px;
    left: 0;
    width: max-content;
    min-width: 100%;
    max-width: 260px;
    max-height: 220px;
    overflow: auto;
    border: 1px solid var(--cell-border);
    border-radius: 3px;
    padding: 4px 0;
    background: var(--bg-color-overlay, var(--bg-color));
    box-shadow: 0 2px 8px rgb(0 0 0 / 12%);
  }

  &__multi-option {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 28px;
    padding: 0 8px;
    cursor: pointer;
    white-space: nowrap;

    &:hover {
      background: var(--el-fill-color-light, #f5f7fa);
    }

    input {
      margin: 0;
    }
  }

  &__placeholder {
    color: var(--text-color-placeholder);
  }

  &--readonly {
    cursor: default;
  }

  &--editable {
    cursor: text;
  }

  &__action-value {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: flex-start;
    width: 100%;
    min-width: 0;
    min-height: 32px;
    overflow: hidden;
    border: 1px solid var(--el-border-color, var(--cell-border));
    border-radius: 3px;
    padding: 0 8px;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }

  &--action:not(.cell-presenter--readonly) &__action-value {
    color: var(--el-color-primary, var(--color-primary));
  }

  &--action:not(.cell-presenter--readonly) &__action-value:hover {
    border-color: var(--el-color-primary, var(--color-primary));
    background: var(--el-fill-color-light, var(--cell-fill));
  }

  &__action-icon {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    margin-right: 4px;
    color: var(--el-color-primary, var(--color-primary));
    font-size: 16px;
    line-height: 1;
  }

  &__action-icon--plus {
    color: var(--el-text-color-secondary, var(--text-color-secondary));
    font-size: 16px;
  }

  &--action:not(.cell-presenter--readonly) .cell-presenter__action-value--member:not(.cell-presenter__action-value--has-value),
  &--action:not(.cell-presenter--readonly) .cell-presenter__action-value--department:not(.cell-presenter__action-value--has-value) {
    border-style: dashed;
    color: var(--cell-text);
  }

  &--action:not(.cell-presenter--readonly) .cell-presenter__action-value--image-upload:not(.cell-presenter__action-value--has-value),
  &--action:not(.cell-presenter--readonly) .cell-presenter__action-value--file-upload:not(.cell-presenter__action-value--has-value) {
    border-style: dashed;
  }

  &__upload-label {
    flex: 0 0 auto;
    white-space: nowrap;
  }

  &__upload-hint {
    min-width: 0;
    margin-left: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &--action:not(.cell-presenter--readonly) &__action-value &__upload-hint {
    color: var(--text-color-secondary);
  }

  &__action-value--upload-selected {
    border-color: var(--el-color-primary, var(--color-primary));
  }

  &--action.cell-presenter--readonly &__value {
    cursor: default;
  }

  &:focus-within {
    background: var(--el-fill-color-light, var(--cell-fill));
  }

  &--hidden {
    display: none;
  }

  &--error {
    background: var(--el-color-danger-light-9, #fef0f0);
    box-shadow: inset 0 0 0 1px var(--el-color-danger, #f56c6c);
    z-index: 1;
  }
}
</style>
