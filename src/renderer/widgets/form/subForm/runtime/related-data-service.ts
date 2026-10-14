import type { CellAddress } from "./types";
import { RuntimeAsyncService, type RuntimeAsyncToken } from "./async-service";
import type { RowStore } from "./row-store";

export type RelatedDataRow = Record<string, unknown>;
export type RelatedDataLoader = (
  tableUID: readonly string[],
  ids: readonly string[],
  uuidFieldId: string,
  signal: AbortSignal,
) => Promise<readonly RelatedDataRow[]>;

export const relatedDataRequestKey = (
  tableUID: readonly string[],
  ids: readonly string[],
  uuidFieldId = "",
  titleFieldId = "",
) => `related:${tableUID.join(".")}:${uuidFieldId}:${titleFieldId}:${[...new Set(ids)].sort().join(",")}`;

export class RuntimeRelatedDataService {
  private readonly requests: RuntimeAsyncService;
  private readonly labels = new Map<string, Map<string, string>>();

  constructor(
    store: RowStore,
    private readonly load: RelatedDataLoader,
  ) {
    this.requests = new RuntimeAsyncService(store);
  }

  request(
    address: CellAddress,
    tableUID: readonly string[],
    uuidFieldId: string,
    titleFieldId: string,
    ids: readonly string[],
  ): RuntimeAsyncToken<readonly RelatedDataRow[]> {
    const normalizedIds = [...new Set(ids.map(String).filter(Boolean))];
    const key = relatedDataRequestKey(tableUID, normalizedIds, uuidFieldId, titleFieldId);
    const token = this.requests.request(address, key, signal => this.load(tableUID, normalizedIds, uuidFieldId, signal));
    void token.promise.then(rows => {
      if (!token.isCurrent()) return;
      const tableKey = tableUID.join(".");
      const tableLabels = this.labels.get(tableKey) || new Map<string, string>();
      for (const row of rows) {
        const id = row[uuidFieldId];
        const title = row[titleFieldId];
        if (id !== undefined && title !== undefined && title !== null) {
          tableLabels.set(String(id), String(title));
        }
      }
      this.labels.set(tableKey, tableLabels);
    });
    return token;
  }

  format(tableUID: readonly string[], ids: readonly string[]) {
    const tableLabels = this.labels.get(tableUID.join("."));
    return ids.map(id => tableLabels?.get(String(id)) || String(id)).join(", ");
  }

  dispose() {
    this.requests.dispose();
    this.labels.clear();
  }
}
