import { PROJECT_ID } from "@renderer/types/inject";
import { inject } from "vue";
import i18next from "@renderer/widgets/i18next";
import type { HandwrittenSignature } from "./handwrittenSignature";
import axios from "axios";

export type SignatureSessionState = "pending" | "signed" | "canceled" | "expired";

export interface SignatureSession {
  sessionId: string;
  deepLink: string;
  fieldUid: string;
  serverReady: boolean;
}

export interface SignatureSessionStatus {
  status: SignatureSessionState;
  signatureUrl?: string;
  saveForReuse?: boolean;
}

const SEARCH_SESSION_KEY = "signatureSessionId";
const SEARCH_FIELD_KEY = "signatureFieldUid";
const SEARCH_OPEN_KEY = "signatureOpen";

let accessibleOriginCache: string | null = null;
let accessibleOriginPromise: Promise<string> | null = null;

function unwrapPayload<T = any>(payload: any): T {
  if (payload && typeof payload === "object" && payload.data && typeof payload.data === "object") {
    return payload.data as T;
  }
  return payload as T;
}

function safeJsonParse(raw: string | null) {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

export function createSignatureSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `signature-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isLocalOrigin(url: URL) {
  const host = url.hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local");
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function parseHashQuery(hash: string) {
  const queryIndex = hash.indexOf("?");
  return new URLSearchParams(queryIndex > -1 ? hash.slice(queryIndex + 1) : "");
}

function getHashPath(hash: string) {
  const hashValue = hash.startsWith("#") ? hash.slice(1) : hash;
  const queryIndex = hashValue.indexOf("?");
  return queryIndex > -1 ? hashValue.slice(0, queryIndex) : hashValue;
}

function setHashQueryParams(url: URL, params: Record<string, string>) {
  const hashPath = getHashPath(url.hash || "");
  const hashQuery = parseHashQuery(url.hash || "");

  Object.entries(params).forEach(([key, value]) => {
    hashQuery.set(key, value);
  });

  const queryString = hashQuery.toString();
  url.hash = queryString ? `#${hashPath}?${queryString}` : `#${hashPath}`;
}

function removeSignatureParamsFromHash(url: URL) {
  const hashPath = getHashPath(url.hash || "");
  const hashQuery = parseHashQuery(url.hash || "");
  hashQuery.delete(SEARCH_SESSION_KEY);
  hashQuery.delete(SEARCH_FIELD_KEY);
  hashQuery.delete(SEARCH_OPEN_KEY);
  const queryString = hashQuery.toString();
  url.hash = hashPath ? (queryString ? `#${hashPath}?${queryString}` : `#${hashPath}`) : "";
}

function getTopFormTitle(widget: HandwrittenSignature) {
  const topForm = (widget as any)?.topForm;
  return String(topForm?.title || widget.title || i18next.t("defaultName"));
}

function createDirectSignatureRequestId() {
  return `direct-signature-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildHashRouteUrl(origin: string, hashRoute: string) {
  return `${trimTrailingSlash(origin)}/#${hashRoute.startsWith("/") ? hashRoute : `/${hashRoute}`}`;
}

function buildSignatureToolHashRoute(widget: HandwrittenSignature, options?: { external?: boolean }) {
  const params = new URLSearchParams();
  const isExternalAccess = options?.external ?? isPublicPublishedFormAccess();
  params.set("nocodeId", widget.getBoard().nocodeId || "");
  params.set("prefix", widget.virtualPath.split("/")[0] || "");
  params.set("title", getTopFormTitle(widget));
  params.set("external", isExternalAccess ? "1" : "0");
  return `/signature/handwritten?${params.toString()}`;
}

function buildUrlWithHashParams(baseUrl: string, params: Record<string, string>) {
  const url = new URL(baseUrl);
  removeSignatureParamsFromHash(url);
  setHashQueryParams(url, params);
  return url.toString();
}

function buildFallbackLaunchUrl(widget: HandwrittenSignature, fieldUid: string, sessionId: string) {
  const currentUrl = new URL(window.location.href);
  const baseOrigin = trimTrailingSlash(`${currentUrl.origin}${currentUrl.pathname}`);
  const isExternalAccess = isPublicPublishedFormAccess();
  const url = new URL(
    buildHashRouteUrl(baseOrigin, buildSignatureToolHashRoute(widget, { external: isExternalAccess }))
  );
  setHashQueryParams(url, {
    [SEARCH_SESSION_KEY]: sessionId,
    [SEARCH_FIELD_KEY]: fieldUid,
    [SEARCH_OPEN_KEY]: "1"
  });
  return url.toString();
}

async function getAccessibleOrigin() {
  if (accessibleOriginCache) {
    return accessibleOriginCache;
  }
  if (accessibleOriginPromise) {
    return accessibleOriginPromise;
  }

  const currentUrl = new URL(window.location.href);
  if (!isLocalOrigin(currentUrl)) {
    accessibleOriginCache = trimTrailingSlash(`${currentUrl.origin}${currentUrl.pathname}`);
    return accessibleOriginCache;
  }

  accessibleOriginPromise = axios.get('/user/domain-port')
    .then((response) => {
      const payload = unwrapPayload<any>(response.data) || response.data || {};
      const domain = payload?.saas?.domain || payload?.share?.domain || currentUrl.origin;
      accessibleOriginCache = trimTrailingSlash(String(domain || currentUrl.origin));
      return accessibleOriginCache;
    })
    .catch(() => trimTrailingSlash(`${currentUrl.origin}${currentUrl.pathname}`))
    .finally(() => {
      accessibleOriginPromise = null;
    });

  return accessibleOriginPromise;
}

async function getSignatureAppOrigin() {
  const currentUrl = new URL(window.location.href);
  const currentOrigin = trimTrailingSlash(`${currentUrl.origin}${currentUrl.pathname}`);

  if (isPublicPublishedFormAccess()) {
    return getAccessibleOrigin();
  }

  if (!isLocalOrigin(currentUrl)) {
    return currentOrigin;
  }

  return getAccessibleOrigin();
}

export async function buildSignatureLaunchUrl(widget: HandwrittenSignature, fieldUid: string, sessionId: string) {
  const appOrigin = await getSignatureAppOrigin();
  const isExternalAccess = isPublicPublishedFormAccess();
  const launchBaseUrl = buildHashRouteUrl(
    appOrigin,
    buildSignatureToolHashRoute(widget, { external: isExternalAccess })
  );
  return buildUrlWithHashParams(launchBaseUrl, {
    [SEARCH_SESSION_KEY]: sessionId,
    [SEARCH_FIELD_KEY]: fieldUid,
    [SEARCH_OPEN_KEY]: "1"
  });
}

export async function buildDirectSignaturePageUrl(widget: HandwrittenSignature) {
  const appOrigin = await getSignatureAppOrigin();
  const requestId = createDirectSignatureRequestId();
  const isExternalAccess = isPublicPublishedFormAccess();
  const currentUrl = new URL(window.location.href);
  removeSignatureParamsFromHash(currentUrl);
  setHashQueryParams(currentUrl, {
    directSignatureRequestId: requestId,
    [SEARCH_FIELD_KEY]: widget.uid
  });

  const launchBaseUrl = buildHashRouteUrl(
    appOrigin,
    buildSignatureToolHashRoute(widget, { external: isExternalAccess })
  );
  return {
    requestId,
    url: buildUrlWithHashParams(launchBaseUrl, {
      requestId,
      returnUrl: currentUrl.toString()
    })
  };
}

export function getSignatureLaunchPayload(fieldUid?: string) {
  const url = new URL(window.location.href);
  const hashQuery = parseHashQuery(url.hash || "");
  const sessionId = hashQuery.get(SEARCH_SESSION_KEY) || url.searchParams.get(SEARCH_SESSION_KEY);
  const currentFieldUid = hashQuery.get(SEARCH_FIELD_KEY) || url.searchParams.get(SEARCH_FIELD_KEY);
  const shouldOpen =
    (hashQuery.get(SEARCH_OPEN_KEY) || url.searchParams.get(SEARCH_OPEN_KEY)) === "1";

  if (!sessionId || !currentFieldUid || !shouldOpen) {
    return null;
  }
  if (fieldUid && fieldUid !== currentFieldUid) {
    return null;
  }

  return {
    sessionId,
    fieldUid: currentFieldUid
  };
}

export function clearSignatureLaunchPayload() {
  const url = new URL(window.location.href);
  url.searchParams.delete(SEARCH_SESSION_KEY);
  url.searchParams.delete(SEARCH_FIELD_KEY);
  url.searchParams.delete(SEARCH_OPEN_KEY);
  removeSignatureParamsFromHash(url);
  window.history.replaceState({}, "", url.toString());
}

export function getDirectSignatureResultPayload(fieldUid?: string) {
  const url = new URL(window.location.href);
  const hashQuery = parseHashQuery(url.hash || "");
  const requestId = hashQuery.get("directSignatureRequestId") || url.searchParams.get("directSignatureRequestId");
  const currentFieldUid = hashQuery.get(SEARCH_FIELD_KEY) || url.searchParams.get(SEARCH_FIELD_KEY);

  if (!requestId || !currentFieldUid) {
    return null;
  }
  if (fieldUid && fieldUid !== currentFieldUid) {
    return null;
  }

  return {
    requestId,
    fieldUid: currentFieldUid
  };
}

export function clearDirectSignatureResultPayload() {
  const url = new URL(window.location.href);
  url.searchParams.delete("directSignatureRequestId");
  const hashQuery = parseHashQuery(url.hash || "");
  hashQuery.delete("directSignatureRequestId");
  const hashPath = getHashPath(url.hash || "");
  const queryString = hashQuery.toString();
  url.hash = hashPath ? (queryString ? `#${hashPath}?${queryString}` : `#${hashPath}`) : "";
  window.history.replaceState({}, "", url.toString());
}

export function getDirectSignatureResultStorageKey(requestId: string) {
  return `handwritten-signature-result:${requestId}`;
}

export function isPublicPublishedFormAccess() {
  const currentUrl = new URL(window.location.href);
  const hashPath = getHashPath(currentUrl.hash || "").toLowerCase();
  if (/^\/share\/form\/[^/?#]+\/[^/?#]+/.test(hashPath)) {
    return true;
  }

  const pathname = trimTrailingSlash(currentUrl.pathname.toLowerCase());
  return /^\/share\/form\/[^/?#]+\/[^/?#]+/.test(pathname);
}

export function isProbablyExternalAccess() {
  return isPublicPublishedFormAccess();
}

export function canUseSignatureReuse() {
  return true;
}

export async function createSignatureSession(widget: HandwrittenSignature): Promise<SignatureSession> {
  const sessionId = createSignatureSessionId();
  let deepLink = "";
  let serverReady = true;

  try {
    deepLink = await buildSignatureLaunchUrl(widget, widget.uid, sessionId);
  } catch (_error) {
    deepLink = buildFallbackLaunchUrl(widget, widget.uid, sessionId);
  }

  try {
    await axios.post(`/signature/session/create`, {
      sessionId,
      fieldUid: widget.uid,
      nocodeId: widget.getBoard().nocodeId,
      launchUrl: deepLink
    });
  } catch (_error) {
    serverReady = false;
  }

  return {
    sessionId,
    deepLink,
    fieldUid: widget.uid,
    serverReady
  };
}

export async function getSignatureSessionStatus(
  widget: HandwrittenSignature,
  sessionId: string
): Promise<SignatureSessionStatus> {
  const response = await axios.get(`/signature/session/status`, {
    params: {
      sessionId
    }
  });
  const payload = unwrapPayload<any>(response.data) || {};

  return {
    status: payload.status || "pending",
    signatureUrl: payload.signatureUrl || payload.url,
    saveForReuse: !!payload.saveForReuse
  };
}

export async function cancelSignatureSession(widget: HandwrittenSignature, sessionId: string) {
  try {
    await axios.post(`/signature/session/cancel`, {
      sessionId
    });
  } catch (_error) {
  }
}

export async function completeSignatureSession(
  widget: HandwrittenSignature,
  sessionId: string,
  signatureUrl: string,
  saveForReuse = false
) {
  try {
    await axios.post(`/signature/session/complete`, {
      sessionId,
      signatureUrl,
      saveForReuse
    });
  } catch (_error) {
  }
}

export async function uploadSignatureFile(
  widget: HandwrittenSignature,
  file: File,
  projectId?: string
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("filename", file.name);
  formData.append("projectId", projectId || "");
  formData.append("nocodeId", widget.getBoard().nocodeId || "");
  const response = await axios.post("/uploader/uploadFile", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });
  const payload = unwrapPayload<any>(response.data) || {};
  const url = payload.url || payload?.data?.url;

  if (!url) {
    throw new Error(i18next.t("signatureUploadFailed"));
  }

  return url;
}

export async function loadReusableSignature(widget: HandwrittenSignature) {
  const raw = window.localStorage.getItem(`handwritten-signature-reuse:${widget.getBoard().nocodeId || "default"}:${widget.uid}`);
  if (!raw) {
    return "";
  }

  const parsed = safeJsonParse(raw);
  if (parsed && typeof parsed === "object") {
    return String(parsed.signatureUrl || parsed.url || "");
  }

  return raw;
}

export async function saveReusableSignature(widget: HandwrittenSignature, signatureUrl: string) {
  if (!signatureUrl) {
    return;
  }

  window.localStorage.setItem(
    `handwritten-signature-reuse:${widget.getBoard().nocodeId || "default"}:${widget.uid}`,
    JSON.stringify({
      signatureUrl,
      updatedAt: Date.now()
    })
  );
}

export async function clearReusableSignature(widget: HandwrittenSignature) {
  window.localStorage.removeItem(`handwritten-signature-reuse:${widget.getBoard().nocodeId || "default"}:${widget.uid}`);
}

export function useSignatureProjectId() {
  return inject(PROJECT_ID, "") as string;
}
