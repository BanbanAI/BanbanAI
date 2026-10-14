import { computed, ref } from "vue";
import { ElMessage } from "element-plus";
import i18next from "@renderer/widgets/i18next";
import type { CellAddress } from "../runtime/types";
import type { RowStore } from "../runtime/row-store";
import type { Uploader } from "../../uploader/uploader";
import type { RuntimePendingUploads } from "./runtime-pending-uploads";
import { isImageUploadFile } from "./runtime-upload-utils";

export type RuntimeUploadCellService = {
  isSelected: (address: CellAddress) => boolean;
  select: (address: CellAddress, element?: HTMLElement | null) => void;
  pick: (address: CellAddress) => void;
  drop: (address: CellAddress, files: File[]) => void;
};

export const RUNTIME_UPLOAD_CELL = Symbol("runtimeUploadCell");

const isRuntimeUploaderType = (type: string) => (
  type === "widget.form.image-uploader" || type === "widget.form.file-uploader"
);

type CellUploaderWidget = Uploader & {
  fileSelectMode?: "select-single" | "select-mulitple";
  fileAccept?: string;
  fileFormatList?: string[];
};

const maxFileCount = (widget: CellUploaderWidget) => {
  if (!widget.getOption("limit-count")) return undefined;
  const range = widget.getOption<unknown>("limit-count-range");
  return Array.isArray(range) && typeof range[1] === "number" ? range[1] : undefined;
};

export const createRuntimeUploadCell = (options: {
  store: () => RowStore | null;
  widget: (address: CellAddress) => Uploader | null;
  pendingUploads: () => RuntimePendingUploads;
  isReadonly: () => boolean;
}) => {
  const selected = ref<{ address: CellAddress; element: HTMLElement | null } | null>(null);
  let pickerInput: HTMLInputElement | null = null;

  const addressKey = (address: CellAddress) => `${address.rowId}\u0000${address.fieldId}`;
  const selectedKey = computed(() => (selected.value ? addressKey(selected.value.address) : ""));

  const isSelected = (address: CellAddress) => selectedKey.value === addressKey(address);
  const clear = () => { selected.value = null; };

  const widgetFor = (address: CellAddress): CellUploaderWidget | null => {
    const widget = options.widget(address);
    return widget && isRuntimeUploaderType(String(widget.type)) ? widget as CellUploaderWidget : null;
  };

  const storedCount = (address: CellAddress) => {
    const value = options.store()?.getValue(address);
    return Array.isArray(value) ? value.filter(Boolean).length : value ? 1 : 0;
  };

  const canIntake = (address: CellAddress) => (
    !options.isReadonly()
    && Boolean(options.store()?.getRow(address.rowId))
    && Boolean(widgetFor(address))
    && options.pendingUploads().list(address).length === 0
    && storedCount(address) === 0
  );

  const start = (address: CellAddress, files: File[]) => {
    if (!files.length || !canIntake(address)) return;
    const widget = widgetFor(address)!;
    const acceptable = widget.type === "widget.form.image-uploader" ? files.filter(isImageUploadFile) : files;
    if (acceptable.length !== files.length) ElMessage.error(i18next.t("subFormUploadImageOnly"));
    if (!acceptable.length) return;
    const maxCount = maxFileCount(widget);
    if (maxCount !== undefined && acceptable.length > maxCount) {
      ElMessage.error(i18next.t(
        widget.type === "widget.form.image-uploader" ? "subFormMaxImageCountError" : "subFormMaxFileCountError",
        { count: maxCount },
      ));
      return;
    }
    clear();
    options.pendingUploads().start(address, acceptable);
  };

  const removePicker = () => {
    pickerInput?.remove();
    pickerInput = null;
  };

  const pick = (address: CellAddress) => {
    const widget = widgetFor(address);
    if (!widget) return;
    removePicker();
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = widget.fileSelectMode === "select-mulitple";
    const accept = widget.fileAccept
      || (widget.fileFormatList || []).join(",")
      || (widget.type === "widget.form.image-uploader" ? "image/*" : "");
    if (accept) input.accept = accept;
    input.style.display = "none";
    input.addEventListener("change", () => {
      const files = [...(input.files || [])];
      removePicker();
      start(address, files);
    });
    input.addEventListener("cancel", removePicker);
    document.body.appendChild(input);
    pickerInput = input;
    input.click();
  };

  const handlePaste = (event: ClipboardEvent) => {
    const current = selected.value;
    if (!current) return;
    const files = [...(event.clipboardData?.files || [])];
    if (!files.length) return;
    if (!canIntake(current.address)) {
      clear();
      return;
    }
    event.preventDefault();
    start(current.address, files);
  };

  const handlePointerDown = (event: PointerEvent) => {
    const current = selected.value;
    if (!current) return;
    if (current.element?.contains(event.target as Node | null)) return;
    clear();
  };

  window.addEventListener("paste", handlePaste, true);
  window.addEventListener("pointerdown", handlePointerDown, true);

  const dispose = () => {
    window.removeEventListener("paste", handlePaste, true);
    window.removeEventListener("pointerdown", handlePointerDown, true);
    removePicker();
    clear();
  };

  const select = (address: CellAddress, element: HTMLElement | null = null) => {
    selected.value = { address, element };
  };

  return { isSelected, select, pick, drop: start, dispose };
};
