import i18next from "i18next";

import type { Field } from "../types/project";

export const printRowShareInternalUrl = "rowShareInternalUrl";
export const printRowSharePublicUrl = "rowSharePublicUrl";

const getI18n = () => (globalThis as any)?.i18next || i18next;

export const getPrintRowShareDisabledText = () => {
  return getI18n().t("projectServices.printRowShareDisabledText");
};

export const getPrintRowShareUnavailableText = () => {
  return getI18n().t("projectServices.printRowShareUnavailableText");
};

export const printRowShareFieldNames = [
  printRowShareInternalUrl,
  printRowSharePublicUrl,
] as const;

export type PrintRowShareFieldName = typeof printRowShareFieldNames[number];
export type PrintRowShareScope = "internal" | "public";

export const printRowShareFieldAliases: Record<PrintRowShareFieldName, string> = {
  get [printRowShareInternalUrl]() { return getI18n().t("printRowShareFields.internalShareLink") },
  get [printRowSharePublicUrl]() { return getI18n().t("printRowShareFields.publicDataLink") },
};

export const createPrintRowShareFields = (): Field[] => {
  return printRowShareFieldNames.map((name) => ({
    uid: name as Field["uid"],
    alias: printRowShareFieldAliases[name],
    type: "string",
    meta: {
      name,
      uid: name,
      extra: {},
    },
  }));
};

const normalizeBaseUrl = (baseUrl: string) => {
  return String(baseUrl || "").trim().replace(/\/+$/, "");
};

export const buildPrintRowShareUrl = (
  baseUrl: string,
  token: string,
  scope: PrintRowShareScope,
) => {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const normalizedToken = String(token || "").trim();
  if (!normalizedBaseUrl || !normalizedToken) {
    return "";
  }

  const route = scope === "internal" ? "view" : "share";
  return `${normalizedBaseUrl}/#/${route}/data/${normalizedToken}`;
};

export const isPrintRowSharePlaceholderText = (value: unknown) => {
  return value === getPrintRowShareDisabledText() || value === getPrintRowShareUnavailableText();
};

export const shouldRenderPrintRowShareQrCode = (value: unknown) => {
  if (isPrintRowSharePlaceholderText(value)) {
    return false;
  }
  return String(value || "").trim().length > 0;
};
