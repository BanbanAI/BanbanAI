// @ts-ignore
import router from "@renderer/router";
import { reactive } from "vue";

export type FetchOptions = {
  force?: boolean;
};

export type CacheEntry<T> = {
  data?: T;
  dirty: boolean;
  updatedAt?: number;
  pending?: Promise<T | undefined>;
  invalidateToken: number;
};

export type CacheBucket<T> = Record<string, CacheEntry<T>>;

type FetchWithCacheOptions<TResult> = {
  bucket: CacheBucket<TResult>;
  key: string;
  request: () => Promise<TResult | undefined | null>;
  options?: FetchOptions;
  keepDirtyOnFallback?: boolean;
};

const routeDirtyHooks = new Map<string, () => void>();

let routeDirtyHookInstalled = false;

export const createCacheBucket = <T>() => reactive<CacheBucket<T>>({});

// 稳定序列化参数，避免对象属性顺序不同导致缓存 key 不一致。
export const stableSerialize = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(item => stableSerialize(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== void 0)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
};

export const getCacheKey = (params?: unknown) => {
  return stableSerialize(params ?? {});
};

// 读取指定 key 的缓存项；不存在时先创建一个默认的脏缓存项。
export const getOrCreateEntry = <T>(bucket: CacheBucket<T>, key: string): CacheEntry<T> => {
  if (!bucket[key]) {
    bucket[key] = {
      dirty: true,
      invalidateToken: 0,
    };
  }
  return bucket[key];
};

export const hasValidCache = <T>(entry: CacheEntry<T>) => {
  return entry.data !== void 0 && !entry.dirty;
};

// 标记单个或整桶缓存为脏；下次读取时会重新请求远端数据。
export const markBucketDirty = <T>(bucket: CacheBucket<T>, key?: string) => {
  if (key) {
    const entry = bucket[key];
    if (!entry) return;
    entry.dirty = true;
    entry.invalidateToken += 1;
    return;
  }

  Object.values(bucket).forEach((entry) => {
    entry.dirty = true;
    entry.invalidateToken += 1;
  });
};

export const clearBucket = <T>(bucket: CacheBucket<T>) => {
  Object.keys(bucket).forEach((key) => {
    delete bucket[key];
  });
};

// 通用缓存读取流程：
// 1. 命中进行中的请求则直接复用 Promise
// 2. 命中有效缓存则直接返回缓存
// 3. 否则发起请求，并在完成后写回缓存
export const fetchWithCache = async <TResult>({
  bucket,
  key,
  request,
  options,
  keepDirtyOnFallback = false,
}: FetchWithCacheOptions<TResult>) => {
  const entry = getOrCreateEntry(bucket, key);

  if (entry.pending) {
    return entry.pending;
  }

  if (!options?.force && hasValidCache(entry)) {
    return entry.data;
  }

  // 记录请求发起时的失效令牌，用来判断请求过程中是否发生过路由切换或手动失效。
  const requestInvalidateToken = entry.invalidateToken;
  entry.pending = Promise.resolve(request())
    .then((result) => {
      if (result !== void 0 && result !== null) {
        entry.data = result;
        entry.updatedAt = Date.now();
        // 请求结束后，如果令牌没变，说明缓存仍然有效；否则保留 dirty 状态等待下次刷新。
        entry.dirty = entry.invalidateToken !== requestInvalidateToken;
        return result;
      }

      // 请求失败或未返回结果时：
      // - keepDirtyOnFallback=true：保持脏状态，确保后续还能重试
      // - 否则仅根据令牌变化决定是否保持脏状态
      entry.dirty = keepDirtyOnFallback
        ? true
        : entry.invalidateToken !== requestInvalidateToken;
      return entry.data;
    })
    .finally(() => {
      delete entry.pending;
    });

  return entry.pending;
};

// 安装全局路由切换失效钩子。
// 每个 store 只注册自己的失效回调，真正的 afterEach 只安装一次。
export const installRouteDirtyHook = (id: string, onDirty: () => void) => {
  routeDirtyHooks.set(id, onDirty);

  if (routeDirtyHookInstalled) return;

  routeDirtyHookInstalled = true;
  router.afterEach((to, from, failure) => {
    if (failure || to.fullPath === from.fullPath) return;
    // 路由变化后统一标脏，但不立刻请求；等下次业务读取时再回源。
    routeDirtyHooks.forEach((callback) => callback());
  });
};
