import type { CellAddress } from "./types";
import type { RowStore } from "./row-store";
import { RuntimeAsyncService, type RuntimeAsyncToken } from "./async-service";

export type RuntimeUploadItem = {
  name: string;
  uid: string;
  status: "success";
  size?: number;
  url?: string;
  md5?: string;
  previewUrl?: string;
};

type RuntimeUploadData = {
  url?: string;
  fileSize?: number;
  md5?: string;
};

export type RuntimeUploadResolver = (
  file: File,
  signal: AbortSignal,
  onProgress: (percent: number) => void,
) => Promise<{
  data?: RuntimeUploadData | { data?: RuntimeUploadData };
  url?: string;
  fileSize?: number;
  md5?: string;
}>;

const isRuntimeUploadData = (value: unknown): value is RuntimeUploadData => (
  typeof value === "object"
  && value !== null
  && ("url" in value || "fileSize" in value || "md5" in value)
);

const getRuntimeUploadData = (response: Awaited<ReturnType<RuntimeUploadResolver>>): RuntimeUploadData => {
  if (isRuntimeUploadData(response.data)) return response.data;
  if (response.data && typeof response.data === "object" && "data" in response.data
    && isRuntimeUploadData(response.data.data)) {
    return response.data.data;
  }
  return response;
};

export class RuntimeUploaderService {
  private readonly requests: RuntimeAsyncService;
  private readonly stopStoreSubscription: () => boolean;

  constructor(store: RowStore) {
    this.requests = new RuntimeAsyncService(store);
    this.stopStoreSubscription = store.subscribe(changeSet => {
      for (const rowId of changeSet.deletedRows) this.requests.invalidateRow(rowId);
    });
  }

  upload(
    address: CellAddress,
    file: File,
    resolve: RuntimeUploadResolver,
    onProgress?: (percent: number) => void,
  ): RuntimeAsyncToken<RuntimeUploadItem> {
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const requestAddress = {
      ...address,
      fieldId: `${address.fieldId}\u0000upload:${uid}`,
    };
    const requestToken = this.requests.request(requestAddress, `upload:${address.rowId}:${address.fieldId}:${uid}`, signal => (
      resolve(file, signal, percent => onProgress?.(percent)).then(response => {
        const payload = getRuntimeUploadData(response);
        return {
          name: file.name,
          uid,
          status: "success" as const,
          size: payload.fileSize ?? file.size,
          url: payload.url,
          md5: payload.md5,
          previewUrl: payload.url,
        };
      })
    ));
    return { ...requestToken, address: { ...address } };
  }

  invalidateRow(rowId: string) {
    this.requests.invalidateRow(rowId);
  }

  dispose() {
    this.stopStoreSubscription();
    this.requests.dispose();
  }
}
