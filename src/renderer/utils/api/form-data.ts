import { FormDataColumn, FormDataTableExtra, FormValidateSubmitOptions, NocodeFormData } from '@common/types/nocode';
import { Bucket, FieldUID, OptionFieldUID, QueryOptions, Row, Table, TableUID } from '@common/types/project';
import { FormDataStage, SystemField } from '@common/utils';
import { AggregateTable, EnqueueViewActionTriggerRequest, EnqueueViewActionTriggerResult, ExecuteViewActionEditContext, ExecuteViewActionRequest, ExecuteViewActionResult, FormTableRuntime, ViewActionFieldId, ViewActionTriggerPrecheckResult } from "@common/types/nocode";
import axios from 'axios';
import { useFormDataDistinctCacheStore } from '@renderer/stores/formDataDistinctCache';
import type { FetchOptions } from '@renderer/stores/runtimeCache';
import type { FormDataFindRequest, FormDataFindResponse } from '@common/types/form-data-find';

type SyncTableColumnsOptions = {
  formData: NocodeFormData,
  tableUID: string,
  columns: FormDataColumn[],
}

type GetDataOptions = {
  nocodeId: string,
  tableUIDs: string[],
  options?: QueryOptions,
  signal?: AbortSignal,
}

type GetManagedViewTableDataOptions = GetDataOptions & {
  widgetUID: string,
  widgetNocodeId: string,
}

export type { GetDataOptions };

type FindDataOptions = FormDataFindRequest & {
  signal?: AbortSignal;
};

type PreviewAggregateTableOptions = {
  nocodeId: string,
  aggregateTable: AggregateTable,
  options?: QueryOptions,
}

type MainSignOptions = {
  sign?: string,
  onMainSign?: (sign: string) => void,
}

type MutationTargetOptions = MainSignOptions & {
  nocodeId: string,
  schemaNocodeId?: string,
  tableUID: string,
}

type AddDataOptions = MutationTargetOptions & {
  rows: any[],
  runtime?: FormTableRuntime,
  stashFlow?: boolean,
}

type importDataOptions = {
  formData: NocodeFormData,
  nocodeId: string,
  tableUID: string,
  rows?: any[],
  extraData?: any,
}

type GetDraftsOptions = {
  nocodeId: string,
  tableUID: string,
}
const draftRowsCache = new Map<string, Row[]>();
const draftRowsPending = new Map<string, Promise<Row[]>>();
const getDraftCacheKey = (nocodeId: string, tableUID: string) => `${nocodeId}:${tableUID}`;
const mergeDraftRowsIntoCache = (options: { nocodeId: string; tableUID: string; rows?: Row[] }) => {
  const key = getDraftCacheKey(options.nocodeId, options.tableUID);
  const cached = draftRowsCache.get(key);
  if (!cached || !options.rows?.length) return;
  const rowMap = new Map(cached.map(row => [row?.[SystemField.UUID] || JSON.stringify(row), row]));
  options.rows.forEach(row => rowMap.set(row?.[SystemField.UUID] || JSON.stringify(row), row));
  draftRowsCache.set(key, Array.from(rowMap.values()));
};
const removeDraftRowsFromCache = (options: { nocodeId: string; tableUID: string; rows?: Row[] }) => {
  const key = getDraftCacheKey(options.nocodeId, options.tableUID);
  const cached = draftRowsCache.get(key);
  if (!cached || !options.rows?.length) return;
  const removed = new Set(options.rows.map(row => row?.[SystemField.UUID] || JSON.stringify(row)));
  draftRowsCache.set(key, cached.filter(row => !removed.has(row?.[SystemField.UUID] || JSON.stringify(row))));
};
type FindOneOptions = {
  nocodeId: string,
  tableUID: string,
  uuid?: string,
}

type FormDataPayloadOptions = {
  formData: NocodeFormData,
}

type SaveDraftOptions = AddDataOptions & FormDataPayloadOptions;

type UpdateDraftOptions = AddDataOptions & FormDataPayloadOptions & {
  stage: FormDataStage,
}

type UpdateDataOptions = AddDataOptions & {
  keys: OptionFieldUID[],
  updateFieldIds?: ViewActionFieldId[],
  viewActionContext?: ExecuteViewActionEditContext,
}

type DeleteRowsOptions = MutationTargetOptions & {
  rows: any[],
  keys: OptionFieldUID[],
}

type DeleteDataOptions = DeleteRowsOptions & {
  runtime?: FormTableRuntime,
}

type DeleteDraftOptions = DeleteRowsOptions;
type RestoreDataOptions = DeleteRowsOptions;
type PurgeDataOptions = DeleteRowsOptions;

type DeleteAllDataOptions = MutationTargetOptions & {
  runtime?: FormTableRuntime,
}

type SyncOptions = {
  nocodeId: string,
  tableUIDs: string[],
  formData: NocodeFormData,
}


type AddTableOptions = {
  formData: NocodeFormData,
  name: string,
  extra?: FormDataTableExtra,
  columns?: any,
}

type DeleteTableOptions = {
  nocodeId: string,
  formData: NocodeFormData,
  table: Table,
}

type DistinctOptions = {
  nocodeId: string,
  tableUID: TableUID,
  columnId: FieldUID,
  options?: QueryOptions,
}


type RecalculateTableFieldOptions = MainSignOptions & {
  nocodeId: string,
  tableUID: TableUID,
  fieldUID: FieldUID,
}

type FormDataMutationResponse<T = any> = {
  success?: boolean,
  data?: T,
  errorMessage?: string,
  message?: string,
  delegatedToTodo?: boolean,
  mutationApplied?: boolean,
  partialSuccess?: boolean,
  successCount?: number,
  failedCount?: number,
  permissionDeniedCount?: number,
  successRows?: any[],
  failedRows?: any[],
  permissionDeniedRows?: any[],
  taskId?: string,
}

export const FORM_MUTATION_TASK_CREATED_EVENT = "form-mutation-task-created";

export type FormMutationTaskCreatedDetail = {
  taskId: string;
  nocodeId: string;
  tableUID: string;
};

const publishMutationTask = (data: FormDataMutationResponse, options: Pick<AddDataOptions, "nocodeId" | "tableUID">) => {
  if (!data?.taskId) return;
  window.dispatchEvent(new CustomEvent<FormMutationTaskCreatedDetail>(FORM_MUTATION_TASK_CREATED_EVENT, {
    detail: {
      taskId: data.taskId,
      nocodeId: options.nocodeId,
      tableUID: options.tableUID,
    },
  }));
}

const getFormDataRequestErrorMessage = (err: any) => {
  return err?.response?.data?.errorMessage || err?.response?.data?.message || err?.message;
}

const normalizeMutationResponse = <T = any>(data: FormDataMutationResponse<T>) => {
  if (data?.success === false) {
    throw new Error(data.errorMessage || data.message || "request failed");
  }

  return {
    success: data.success,
    data: data.data,
    delegatedToTodo: data.delegatedToTodo,
    mutationApplied: data.mutationApplied,
    partialSuccess: data.partialSuccess,
    successCount: data.successCount,
    failedCount: data.failedCount,
    permissionDeniedCount: data.permissionDeniedCount,
    successRows: data.successRows,
    failedRows: data.failedRows,
    permissionDeniedRows: data.permissionDeniedRows,
    taskId: data.taskId,
  };
}

const getMutationTargetPayload = (
  options: Pick<MutationTargetOptions, "nocodeId" | "schemaNocodeId" | "tableUID">,
) => ({
  nocodeId: options.nocodeId,
  ...(options.schemaNocodeId && options.schemaNocodeId !== options.nocodeId
    ? { schemaNocodeId: options.schemaNocodeId }
    : {}),
  tableUID: options.tableUID,
});

const markDistinctCacheDirty = () => {
  try {
    useFormDataDistinctCacheStore().markAllDirty();
  } catch (error) {
    console.warn("Failed to mark form data distinct cache dirty", error);
  }
}

export const formDataApi = {
  async find(options: FindDataOptions): Promise<FormDataFindResponse> {
    const { signal, ...request } = options;
    const { data } = await axios.post("/form-data/find", request, { signal });
    return data;
  },

  async getData(options: GetDataOptions): Promise<Bucket[]> {
    try {
      const { signal, ...requestData } = options;
      const { data } = await axios.post("/form-data/get", requestData, { signal });
      return data;
    } catch (err) {
      if (axios.isCancel(err)) return [];
      console.error(err);
      return [];
    }
  },

  async getManagedViewTableData(options: GetManagedViewTableDataOptions): Promise<Bucket[]> {
    try {
      const { signal, ...requestData } = options;
      const { data } = await axios.post("/form-data/get-managed-view-table-data", requestData, { signal });
      return data;
    } catch (err) {
      if (axios.isCancel(err)) return [];
      console.error(err);
      return [];
    }
  },

  async previewAggregateTable(options: PreviewAggregateTableOptions): Promise<Bucket | null> {
    try {
      const { data } = await axios.post("/form-data/preview-aggregate-table", options);
      return data;
    } catch (err) {
      console.error(err);
      return null;
    }
  },

  async findOne(options: FindOneOptions) {
    try {
      const row = await axios.post('/form-data/findOne', options).then(res => res.data)
      return row
    } catch (error) {
      console.error(error)
      return null
    }
  },

  async addData(options: AddDataOptions) {
    try {
      const { sign, onMainSign, rows, runtime, stashFlow } = options;
      const requestData = {
        ...getMutationTargetPayload(options),
        rows,
        ...(runtime !== undefined ? { runtime } : {}),
        ...(stashFlow !== undefined ? { stashFlow } : {}),
      };
      const response = await axios.post("/form-data/add", requestData, sign ? {
        headers: {
          'x-sign': sign,
        },
      } : undefined);
      const data = response.data;
      const mainSign = Array.isArray(response.headers?.['x-sign']) ? response.headers['x-sign'][0] : response.headers?.['x-sign'];
      if (mainSign) {
        onMainSign?.(mainSign);
      }
      publishMutationTask(data, options);
      const result = normalizeMutationResponse(data);
      markDistinctCacheDirty();
      return result;
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  async addDraft(options: SaveDraftOptions) {
    try {
      const { sign, onMainSign, ...requestData } = options;
      const response = await axios.post("/form-data/add-draft", requestData, sign ? {
        headers: {
          'x-sign': sign,
        },
      } : undefined);
      const data = response.data;
      const mainSign = Array.isArray(response.headers?.['x-sign']) ? response.headers['x-sign'][0] : response.headers?.['x-sign'];
      if (mainSign) {
        onMainSign?.(mainSign);
      }
      const result = normalizeMutationResponse(data);
      mergeDraftRowsIntoCache(options);
      markDistinctCacheDirty();
      return result;
    } catch (err) {
      throw new Error(getFormDataRequestErrorMessage(err));
    }
  },

  async getDrafts(options: GetDraftsOptions) {
    const cacheKey = getDraftCacheKey(options.nocodeId, options.tableUID);
    const cached = draftRowsCache.get(cacheKey);
    if (cached) return cached;
    const pending = draftRowsPending.get(cacheKey);
    if (pending) return pending;
    const request = axios.post("/form-data/get-drafts", options).then(({ data }) => {
      const rows = Array.isArray(data) ? data : [];
      draftRowsCache.set(cacheKey, rows);
      return rows;
    });
    draftRowsPending.set(cacheKey, request);
    try {
      return await request;
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    } finally {
      draftRowsPending.delete(cacheKey);
    }
  },

  async updateDraft(options: UpdateDraftOptions) {
    try {
      const { sign, onMainSign, ...requestData } = options;
      const response = await axios.post("/form-data/update-draft", requestData, sign ? {
        headers: {
          'x-sign': sign,
        },
      } : undefined);
      const data = response.data;
      const mainSign = Array.isArray(response.headers?.['x-sign']) ? response.headers['x-sign'][0] : response.headers?.['x-sign'];
      if (mainSign) {
        onMainSign?.(mainSign);
      }
      const result = normalizeMutationResponse(data);
      if (options.stage === FormDataStage.DRAFT) {
        mergeDraftRowsIntoCache(options);
      } else {
        draftRowsCache.delete(getDraftCacheKey(options.nocodeId, options.tableUID));
      }
      markDistinctCacheDirty();
      return result;
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  async deleteDraft(options: DeleteDraftOptions) {
    try {
      const { sign, onMainSign } = options;
      const requestData = {
        ...getMutationTargetPayload(options),
        rows: options.rows,
        keys: options.keys,
      };
      const response = await axios.post("/form-data/delete-draft", requestData, sign ? {
        headers: {
          'x-sign': sign,
        },
      } : undefined);
      const data = response.data;
      const mainSign = Array.isArray(response.headers?.['x-sign']) ? response.headers['x-sign'][0] : response.headers?.['x-sign'];
      if (mainSign) {
        onMainSign?.(mainSign);
      }
      if (data?.success !== false) {
        removeDraftRowsFromCache(options);
        markDistinctCacheDirty();
      }
      return {
        success: data.success,
        data: data.data
      }
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },


  async importExcelData(options: importDataOptions) {
    try {
      const data = await axios.post("/form-data/import-excel-data", options).then(({ data }) => data);
      if (data?.success !== false) {
        markDistinctCacheDirty();
      }
      return {
        success: data.success,
        data: data.data
      }
    } catch (err) {
      return {
        success: false,
        message: err?.response?.data?.message || err.message,
      }
    }
  },

  async updateData(options: UpdateDataOptions) {
    try {
      const {
        sign,
        onMainSign,
        rows,
        runtime,
        keys,
        updateFieldIds,
        viewActionContext,
        stashFlow,
      } = options;
      const requestData = {
        ...getMutationTargetPayload(options),
        rows,
        keys,
        ...(runtime !== undefined ? { runtime } : {}),
        ...(updateFieldIds !== undefined ? { updateFieldIds } : {}),
        ...(viewActionContext !== undefined ? { viewActionContext } : {}),
        ...(stashFlow !== undefined ? { stashFlow } : {}),
      };
      const response = await axios.post("/form-data/update", requestData, sign ? {
        headers: {
          'x-sign': sign,
        },
      } : undefined);
      const data = response.data;
      const mainSign = Array.isArray(response.headers?.['x-sign']) ? response.headers['x-sign'][0] : response.headers?.['x-sign'];
      if (mainSign) {
        onMainSign?.(mainSign);
      }
      if (data?.success !== false) {
        markDistinctCacheDirty();
      }
      publishMutationTask(data, options);
      return normalizeMutationResponse(data);
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  async deleteData(options: DeleteDataOptions) {
    try {
      const { sign, onMainSign } = options;
      const requestData = {
        ...getMutationTargetPayload(options),
        rows: options.rows,
        keys: options.keys,
        ...(options.runtime !== undefined ? { runtime: options.runtime } : {}),
      };
      const response = await axios.post("/form-data/delete", requestData, sign ? {
        headers: {
          'x-sign': sign,
        },
      } : undefined);
      const data = response.data;
      const mainSign = Array.isArray(response.headers?.['x-sign']) ? response.headers['x-sign'][0] : response.headers?.['x-sign'];
      if (mainSign) {
        onMainSign?.(mainSign);
      }
      if (data?.success !== false) {
        markDistinctCacheDirty();
      }
      return data
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  async deleteAllData(options: DeleteAllDataOptions) {
    try {
      const { sign, onMainSign } = options;
      const requestData = {
        ...getMutationTargetPayload(options),
        ...(options.runtime !== undefined ? { runtime: options.runtime } : {}),
      };
      const response = await axios.post("/form-data/delete-all", requestData, sign ? {
        headers: {
          'x-sign': sign,
        },
      } : undefined);
      const data = response.data;
      const mainSign = Array.isArray(response.headers?.['x-sign']) ? response.headers['x-sign'][0] : response.headers?.['x-sign'];
      if (mainSign) {
        onMainSign?.(mainSign);
      }
      if (data?.success !== false) {
        markDistinctCacheDirty();
      }
      return {
        success: data.success,
        data: data.data
      }
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  async restoreData(options: RestoreDataOptions) {
    try {
      const { sign, onMainSign } = options;
      const requestData = {
        ...getMutationTargetPayload(options),
        rows: options.rows,
        keys: options.keys,
      };
      const response = await axios.post("/form-data/restore", requestData, sign ? {
        headers: {
          'x-sign': sign,
        },
      } : undefined);
      const data = response.data;
      const mainSign = Array.isArray(response.headers?.['x-sign']) ? response.headers['x-sign'][0] : response.headers?.['x-sign'];
      if (mainSign) {
        onMainSign?.(mainSign);
      }
      if (data?.success !== false) {
        markDistinctCacheDirty();
      }
      return {
        success: data.success,
        data: data.data,
      }
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  async purgeData(options: PurgeDataOptions) {
    try {
      const { sign, onMainSign } = options;
      const requestData = {
        ...getMutationTargetPayload(options),
        rows: options.rows,
        keys: options.keys,
      };
      const response = await axios.post("/form-data/purge", requestData, sign ? {
        headers: {
          'x-sign': sign,
        },
      } : undefined);
      const data = response.data;
      const mainSign = Array.isArray(response.headers?.['x-sign']) ? response.headers['x-sign'][0] : response.headers?.['x-sign'];
      if (mainSign) {
        onMainSign?.(mainSign);
      }
      if (data?.success !== false) {
        markDistinctCacheDirty();
      }
      return {
        success: data.success,
        data: data.data,
      }
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  async executeViewAction(
    options: ExecuteViewActionRequest & MainSignOptions,
  ): Promise<{ success?: boolean, data: ExecuteViewActionResult }> {
    try {
      const { sign, onMainSign, ...requestData } = options;
      const response = await axios.post("/form-data/execute-view-action", requestData, sign ? {
        headers: {
          "x-sign": sign,
        },
      } : undefined);
      const data = normalizeMutationResponse<ExecuteViewActionResult>(response.data);
      const mainSign = Array.isArray(response.headers?.["x-sign"]) ? response.headers["x-sign"][0] : response.headers?.["x-sign"];
      if (mainSign) {
        onMainSign?.(mainSign);
      }
      markDistinctCacheDirty();
      return data;
    } catch (err) {
      throw new Error(getFormDataRequestErrorMessage(err));
    }
  },

  async precheckViewActionTrigger(
    options: ExecuteViewActionRequest & MainSignOptions,
  ): Promise<ViewActionTriggerPrecheckResult> {
    try {
      const { sign, onMainSign, ...requestData } = options;
      const response = await axios.post("/form-data/precheck-view-action-trigger", requestData, sign ? {
        headers: {
          "x-sign": sign,
        },
      } : undefined);
      const data = normalizeMutationResponse<ViewActionTriggerPrecheckResult>(response.data);
      const mainSign = Array.isArray(response.headers?.["x-sign"]) ? response.headers["x-sign"][0] : response.headers?.["x-sign"];
      if (mainSign) {
        onMainSign?.(mainSign);
      }
      return data.data;
    } catch (err) {
      throw new Error(getFormDataRequestErrorMessage(err));
    }
  },

  async enqueueViewActionTrigger(
    options: EnqueueViewActionTriggerRequest & MainSignOptions,
  ): Promise<EnqueueViewActionTriggerResult> {
    try {
      const { sign, onMainSign, ...requestData } = options;
      const response = await axios.post("/form-data/enqueue-view-action-trigger", requestData, sign ? {
        headers: {
          "x-sign": sign,
        },
      } : undefined);
      const data = normalizeMutationResponse<EnqueueViewActionTriggerResult>(response.data);
      const mainSign = Array.isArray(response.headers?.["x-sign"]) ? response.headers["x-sign"][0] : response.headers?.["x-sign"];
      if (mainSign) {
        onMainSign?.(mainSign);
      }
      markDistinctCacheDirty();
      return data.data;
    } catch (err) {
      throw new Error(getFormDataRequestErrorMessage(err));
    }
  },


  async sync(options: SyncOptions): Promise<{ tables: Table[], buckets: Bucket[] }> {
    try {
      const { data } = await axios.post("/form-data/sync", options);
      markDistinctCacheDirty();
      return data;
    } catch (err) {
      console.error(err);
      return null;
    }
  },

  async syncTableColumns(options: SyncTableColumnsOptions): Promise<NocodeFormData> {
    return await axios.post("/form-data/sync-table-columns", options).then(({ data }) => {
      if (data) {
        markDistinctCacheDirty();
      }
      return data;
    }).catch(() => null);
  },

  async addTable(options: AddTableOptions): Promise<{ formData: NocodeFormData, table: Table}> {
    return await axios.post("/form-data/add-table", options).then(({ data }) => {
      if (data) {
        markDistinctCacheDirty();
      }
      return data;
    }).catch(() => null);
  },

  async deleteTable(options: DeleteTableOptions): Promise<NocodeFormData> {
    return await axios.post("/form-data/delete-table", options).then(({ data }) => {
      if (data) {
        markDistinctCacheDirty();
      }
      return data;
    }).catch(() => null);
  },

  async validateFormSubmit(options: FormValidateSubmitOptions) {
    try {
      const { data } = await axios.post("/form-data/validate-form-submit", options);
      return data;
    } catch (err) {
      throw new Error(getFormDataRequestErrorMessage(err));
    }
  },

  async distinct(options: DistinctOptions, fetchOptions?: FetchOptions) {
    return await useFormDataDistinctCacheStore().getDistinct(options, fetchOptions);
  },

  async distinctCount(options: DistinctOptions, fetchOptions?: FetchOptions) {
    return await useFormDataDistinctCacheStore().getDistinctCount(options, fetchOptions);
  },

  async recalculateTableField(options: RecalculateTableFieldOptions) {
    try {
      const { ...requestData } = options;
      const response = await axios.post("/form-data/recalculate-table-field", requestData);
      const data = response.data;
      const result = normalizeMutationResponse(data);
      markDistinctCacheDirty();
      return result;
    } catch (err) {
      throw new Error(getFormDataRequestErrorMessage(err));
    }
  }
}
