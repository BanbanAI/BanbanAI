import { reactive } from "vue";
import { ElMessage } from "element-plus";
import type { UploadRequestOptions } from "element-plus";
import i18next from "@renderer/widgets/i18next";
import type { CellAddress, RowId } from "../runtime/types";
import type { RuntimeAsyncToken } from "../runtime/async-service";
import type { RowStore } from "../runtime/row-store";
import type { RuntimeUploadItem, RuntimeUploaderService } from "../runtime/uploader-service";
import type { Uploader } from "../../uploader/uploader";
import { createUploadDisplayItem, type RuntimeUploadDisplayItem } from "./runtime-upload-utils";

export type RuntimePendingUpload = RuntimeUploadDisplayItem & {
  token?: RuntimeAsyncToken<RuntimeUploadItem>;
};

export type RuntimePendingUploadsOptions = {
  store: () => RowStore | null;
  service: () => RuntimeUploaderService | null;
  widget: (address: CellAddress) => Uploader | null;
  commit: (address: CellAddress, items: RuntimeUploadItem[]) => void;
};

const PERCENT_STEP = 5;
const PENDING_SETTLE_MS = 400;

const cellKey = (address: CellAddress) => `${address.rowId}\u0000${address.fieldId}`;

const delay = (ms: number) => new Promise(resolve => { window.setTimeout(resolve, ms); });

const revokeLocalUrl = (item: RuntimePendingUpload) => {
  if (item.url.startsWith("blob:")) URL.revokeObjectURL(item.url);
};

export const createRuntimePendingUploads = (options: RuntimePendingUploadsOptions) => {
  const byCell = reactive(new Map<string, RuntimePendingUpload[]>());
  const cancelledUids = new Set<string>();

  const list = (address: CellAddress): RuntimePendingUpload[] => byCell.get(cellKey(address)) || [];
  const count = (address: CellAddress) => list(address).length;
  const isUploading = (address: CellAddress) => count(address) > 0;
  const hasAny = () => byCell.size > 0;

  const append = (key: string, items: RuntimePendingUpload[]) => {
    byCell.set(key, [...(byCell.get(key) || []), ...items]);
  };

  const patch = (key: string, uid: string, patchValue: Partial<RuntimePendingUpload>) => {
    const current = byCell.get(key);
    if (!current) return;
    byCell.set(key, current.map(item => (item.uid === uid ? { ...item, ...patchValue } : item)));
  };

  const remove = (key: string, uids: ReadonlySet<string>) => {
    const current = byCell.get(key);
    if (!current) return;
    for (const item of current) {
      if (uids.has(item.uid)) revokeLocalUrl(item);
    }
    const next = current.filter(item => !uids.has(item.uid));
    if (next.length) byCell.set(key, next);
    else byCell.delete(key);
  };

  const dropRow = (rowId: RowId) => {
    for (const [key, items] of [...byCell]) {
      if (!key.startsWith(`${rowId}\u0000`)) continue;
      for (const item of items) {
        revokeLocalUrl(item);
        item.token?.release();
      }
      byCell.delete(key);
    }
  };

  let stopStoreSubscription: (() => boolean) | undefined;
  const ensureStoreSubscription = () => {
    if (stopStoreSubscription) return;
    stopStoreSubscription = options.store()?.subscribe(changeSet => {
      for (const rowId of changeSet.deletedRows) dropRow(rowId);
    });
  };
  ensureStoreSubscription();

  const cancel = (address: CellAddress, uid: string) => {
    const item = list(address).find(entry => entry.uid === uid);
    if (!item) return;
    cancelledUids.add(uid);
    item.token?.release();
    remove(cellKey(address), new Set([uid]));
  };

  const start = (address: CellAddress, files: File[]) => {
    ensureStoreSubscription();
    const store = options.store();
    const service = options.service();
    const widget = options.widget(address);
    if (!store || !service || !widget || !files.length) return;
    const key = cellKey(address);
    const isImage = widget.type === "widget.form.image-uploader";
    const startedAt = Date.now();
    const batchId = `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const entries = files.map((file, index) => ({ file, uid: `${batchId}-${index}` }));
    append(key, entries.map(entry => createUploadDisplayItem({
      name: entry.file.name,
      url: isImage ? URL.createObjectURL(entry.file) : "",
      size: entry.file.size,
      uid: entry.uid,
      pending: true,
      percent: 0,
    })));

    const tasks = entries.map(async entry => {
      const token = service.upload(
        address,
        entry.file,
        (rawFile, signal, onProgress) => widget.uploadFile({
          file: rawFile,
          signal,
          onProgress: event => onProgress(event.percent),
        } as UploadRequestOptions & { signal?: AbortSignal }),
        percent => {
          const current = list(address).find(item => item.uid === entry.uid);
          const next = Math.min(100, Math.max(1, Math.round(percent / PERCENT_STEP) * PERCENT_STEP));
          if (next <= (current?.percent || 0)) return;
          patch(key, entry.uid, { percent: next });
        },
      );
      patch(key, entry.uid, { token });
      try {
        return await token.promise;
      } finally {
        token.release();
      }
    });

    void Promise.allSettled(tasks).then(async results => {
      const uids = new Set(entries.map(entry => entry.uid));
      const uploaded = results
        .filter((result): result is PromiseFulfilledResult<RuntimeUploadItem> => result.status === "fulfilled")
        .map(result => result.value);
      const failures = results.filter((result, index) => (
        result.status === "rejected" && !cancelledUids.has(entries[index].uid)
      ));
      for (const uid of uids) cancelledUids.delete(uid);
      if (!list(address).some(item => uids.has(item.uid))) return;
      for (const uid of uids) patch(key, uid, { percent: 100 });
      await delay(Math.max(0, PENDING_SETTLE_MS - (Date.now() - startedAt)));
      remove(key, uids);
      if (!uploaded.length) {
        const failure = failures[0] as PromiseRejectedResult | undefined;
        const reason = failure?.reason;
        ElMessage.error(reason instanceof Error ? reason.message : i18next.t("subFormUploadFailed"));
        return;
      }
      const current = store.getValue(address);
      options.commit(address, [...(Array.isArray(current) ? current as RuntimeUploadItem[] : []), ...uploaded]);
      if (failures.length) ElMessage.error(i18next.t("subFormUploadPartialFailed", { count: failures.length }));
    });
  };

  const dispose = () => {
    stopStoreSubscription?.();
    for (const [, items] of [...byCell]) {
      for (const item of items) {
        revokeLocalUrl(item);
        item.token?.release();
      }
    }
    byCell.clear();
  };

  return { list, count, isUploading, hasAny, start, cancel, dispose };
};

export type RuntimePendingUploads = ReturnType<typeof createRuntimePendingUploads>;
export const RUNTIME_PENDING_UPLOADS = Symbol("runtimePendingUploads");
