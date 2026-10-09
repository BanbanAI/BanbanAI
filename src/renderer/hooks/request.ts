import { type AxiosRequestConfig } from "axios";

const COMPRESSED_JSON_REQUEST_MIN_BYTES = 256 * 1024;
const COMPRESSED_JSON_REQUEST_FAST_PASS_CHARS = Math.floor(COMPRESSED_JSON_REQUEST_MIN_BYTES / 3);
const REQUEST_METHODS_WITH_BODY = new Set(["post", "put", "patch", "delete"]);
const textEncoder = new TextEncoder();

const getCompressionStream = () => {
  return (globalThis as any).CompressionStream as (new (format: "gzip") => any) | undefined;
}

const isPlainObject = (value: unknown) => {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

const isJsonRequestPayload = (value: unknown) => {
  if (Array.isArray(value)) return true;
  if (!isPlainObject(value)) return false;
  if (typeof FormData !== "undefined" && value instanceof FormData) return false;
  if (typeof URLSearchParams !== "undefined" && value instanceof URLSearchParams) return false;
  if (typeof Blob !== "undefined" && value instanceof Blob) return false;
  if (value instanceof ArrayBuffer) return false;
  if (ArrayBuffer.isView(value)) return false;
  return true;
}

const getRequestHeader = (headers: AxiosRequestConfig["headers"], name: string) => {
  if (!headers) return "";
  if (typeof (headers as any).get === "function") {
    return (headers as any).get(name) || (headers as any).get(name.toLowerCase()) || "";
  }
  return (headers as Record<string, any>)[name] || (headers as Record<string, any>)[name.toLowerCase()] || "";
}

const appendRequestHeaders = (headers: AxiosRequestConfig["headers"], nextHeaders: Record<string, string>) => {
  if (headers && typeof (headers as any).set === "function") {
    Object.entries(nextHeaders).forEach(([key, value]) => {
      (headers as any).set(key, value);
    });
    return headers;
  }

  return {
    ...((headers as Record<string, any>) || {}),
    ...nextHeaders,
  };
}

const getJsonRequestConfig = (config: AxiosRequestConfig, data: string | ArrayBuffer): AxiosRequestConfig => {
  return {
    ...config,
    data,
    headers: appendRequestHeaders(config.headers, {
      "Content-Type": "application/json",
    }),
    transformRequest: [(requestData) => requestData],
  };
}

const getCompressedJsonRequestConfig = (config: AxiosRequestConfig, data: ArrayBuffer): AxiosRequestConfig => {
  const jsonConfig = getJsonRequestConfig(config, data);

  return {
    ...jsonConfig,
    headers: appendRequestHeaders(jsonConfig.headers, {
      "Content-Encoding": "gzip",
    }),
  };
}

async function gzipJsonPayload(bytes: Uint8Array) {
  const CompressionStream = getCompressionStream();

  if (!CompressionStream) {
    return null;
  }

  const compressedStream = new Blob([bytes], { type: "application/json" })
    .stream()
    .pipeThrough(new CompressionStream("gzip"));

  return await new Response(compressedStream).arrayBuffer();
}

const shouldHandleCompressedJsonRequest = (config: AxiosRequestConfig) => {
  const method = `${config.method || "get"}`.toLowerCase();
  if (!REQUEST_METHODS_WITH_BODY.has(method)) return false;
  if (!isJsonRequestPayload(config.data)) return false;
  if (getRequestHeader(config.headers, "Content-Encoding")) return false;

  const contentType = `${getRequestHeader(config.headers, "Content-Type")}`.toLowerCase();
  if (!contentType) return true;

  return contentType.includes("application/json") || contentType.includes("text/json");
}

const removeInvisibleChars = (value: any): any => {
  if (value instanceof FormData) {
    return value;
  }

  if (typeof value === 'string') {
    return value.replace(/\p{Cf}/gu, '');
  }

  if (Array.isArray(value)) {
    return value.map(removeInvisibleChars);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        removeInvisibleChars(v)
      ])
    );
  }

  return value;
}

export async function normalizeAxiosRequestConfig(config: AxiosRequestConfig) {
  if (config.data) {
    config.data = removeInvisibleChars(config.data);
  }

  if (config.params) {
    config.params = removeInvisibleChars(config.params);
  }
  const nextConfig: AxiosRequestConfig = {
    ...config,
    url: typeof config.url === "string" ? config.url.replace(/^\//, "") : config.url,
  };

  if (!shouldHandleCompressedJsonRequest(nextConfig)) {
    return nextConfig;
  }

  const json = JSON.stringify(nextConfig.data);

  if (json.length < COMPRESSED_JSON_REQUEST_FAST_PASS_CHARS) {
    return getJsonRequestConfig(nextConfig, json);
  }

  const bytes = textEncoder.encode(json);

  if (bytes.byteLength < COMPRESSED_JSON_REQUEST_MIN_BYTES) {
    return getJsonRequestConfig(nextConfig, json);
  }

  const compressedBody = await gzipJsonPayload(bytes);

  if (!compressedBody) {
    return getJsonRequestConfig(nextConfig, json);
  }

  return getCompressedJsonRequestConfig(nextConfig, compressedBody);
}
