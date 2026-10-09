import { FieldUID, QueryOptions, TableUID } from "@common/types/project";
import axios from "axios";
import { defineStore } from "pinia";
import {
  type FetchOptions,
  clearBucket,
  createCacheBucket,
  fetchWithCache,
  getCacheKey,
  installRouteDirtyHook,
  markBucketDirty,
} from "./runtimeCache";

export type FormDataDistinctOptions = {
  nocodeId: string;
  tableUID: TableUID;
  columnId: FieldUID;
  options?: QueryOptions;
};

export type DistinctCountResult = {
  value: any;
  count: number;
};

const requestDistinct = async (options: FormDataDistinctOptions) => {
  return await axios.post("/form-data/distinct", options).then(({ data }) => data).catch(() => null);
};

const requestDistinctCount = async (options: FormDataDistinctOptions) => {
  return await axios.post("/form-data/distinctCount", options).then(({ data }) => data).catch(() => null);
};

export const useFormDataDistinctCacheStore = defineStore("formDataDistinctCache", () => {
  const distinctCache = createCacheBucket<any[]>();
  const distinctCountCache = createCacheBucket<DistinctCountResult[]>();

  const getDistinct = async (params: FormDataDistinctOptions, options?: FetchOptions) => {
    return await fetchWithCache({
      bucket: distinctCache,
      key: getCacheKey(params),
      request: () => requestDistinct(params),
      options,
      keepDirtyOnFallback: true,
    });
  };

  const getDistinctCount = async (params: FormDataDistinctOptions, options?: FetchOptions) => {
    return await fetchWithCache({
      bucket: distinctCountCache,
      key: getCacheKey(params),
      request: () => requestDistinctCount(params),
      options,
      keepDirtyOnFallback: true,
    });
  };

  const markDistinctDirty = (params?: FormDataDistinctOptions) => {
    markBucketDirty(distinctCache, params ? getCacheKey(params) : void 0);
  };

  const markDistinctCountDirty = (params?: FormDataDistinctOptions) => {
    markBucketDirty(distinctCountCache, params ? getCacheKey(params) : void 0);
  };

  const markAllDirty = () => {
    markDistinctDirty();
    markDistinctCountDirty();
  };

  const clearDistinctCache = () => {
    clearBucket(distinctCache);
  };

  const clearDistinctCountCache = () => {
    clearBucket(distinctCountCache);
  };

  const clearAllCache = () => {
    clearDistinctCache();
    clearDistinctCountCache();
  };

  installRouteDirtyHook("formDataDistinctCache", clearAllCache);

  return {
    distinctCache,
    distinctCountCache,
    getDistinct,
    getDistinctCount,
    markDistinctDirty,
    markDistinctCountDirty,
    markAllDirty,
    clearDistinctCache,
    clearDistinctCountCache,
    clearAllCache,
  };
});
