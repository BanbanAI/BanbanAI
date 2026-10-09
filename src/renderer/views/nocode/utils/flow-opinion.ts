import { FlowOpinionFile } from '@common/types/project';
import axios from 'axios';
import { unique } from '@common/utils/unique';

const FLOW_OPINION_HISTORY_STORAGE_PREFIX = 'FLOW_OPINION_HISTORY';

const imageExtensions = new Set([
  'apng',
  'avif',
  'bmp',
  'gif',
  'ico',
  'jpeg',
  'jpg',
  'png',
  'svg',
  'tif',
  'tiff',
  'webp',
]);

const getFileExtension = (nameOrUrl = '') => {
  const cleanValue = nameOrUrl.split('?')[0]?.split('#')[0] || '';
  const ext = cleanValue.split('.').pop();
  return ext ? ext.toLowerCase() : '';
};

export const isImageFlowOpinionFile = (file?: Partial<FlowOpinionFile>) => {
  if (!file) return false;
  return imageExtensions.has(getFileExtension(file.name || file.url || ''));
};

export const normalizeFlowOpinionFile = (file?: Partial<FlowOpinionFile>) => {
  if (!file?.name || !file?.url) return null;
  const normalized: FlowOpinionFile = {
    uid: file.uid || unique(),
    name: file.name,
    url: file.url,
    size: file.size,
    status: file.status || 'success',
  };
  return normalized;
};

export const normalizeFlowOpinionFiles = (files?: Partial<FlowOpinionFile>[]) => {
  return (files || [])
    .map((file) => normalizeFlowOpinionFile(file))
    .filter(Boolean) as FlowOpinionFile[];
};

const normalizeFlowOpinionHistory = (history: string[] = [], defaults: string[] = []) => {
  const normalizedHistory: string[] = [];
  for (const value of history) {
    const text = `${value || ''}`.trim();
    if (!text || normalizedHistory.includes(text)) continue;
    normalizedHistory.push(text);
  }

  const normalizedDefaults: string[] = [];
  for (const value of defaults) {
    const text = `${value || ''}`.trim();
    if (!text || normalizedDefaults.includes(text) || normalizedHistory.includes(text)) continue;
    normalizedDefaults.push(text);
  }

  return [...normalizedDefaults, ...normalizedHistory];
};

const getFlowOpinionHistoryStorageKey = (accountKey: string) => {
  const normalizedAccountKey = `${accountKey || ''}`.trim() || 'anonymous';
  return `${FLOW_OPINION_HISTORY_STORAGE_PREFIX}_${normalizedAccountKey}`;
};

const readFlowOpinionHistory = (accountKey: string) => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(getFlowOpinionHistoryStorageKey(accountKey));
    if (!rawValue) return [];
    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch (error) {
    console.error(error);
    return [];
  }
};

const writeFlowOpinionHistory = (accountKey: string, history: string[]) => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return history;
  }

  const normalizedHistory = normalizeFlowOpinionHistory(history);
  try {
    window.localStorage.setItem(getFlowOpinionHistoryStorageKey(accountKey), JSON.stringify(normalizedHistory));
  } catch (error) {
    console.error(error);
  }
  return normalizedHistory;
};

export const getGlobalFlowOpinionHistory = (accountKey: string, defaults: string[] = []) => {
  return normalizeFlowOpinionHistory(readFlowOpinionHistory(accountKey), defaults);
};

export const appendGlobalFlowOpinionHistory = (accountKey: string, text: string, defaults: string[] = []) => {
  const normalizedText = `${text || ''}`.trim();
  const history = getGlobalFlowOpinionHistory(accountKey, defaults).filter((item) => item !== normalizedText);
  if (normalizedText) {
    history.unshift(normalizedText);
  }
  return writeFlowOpinionHistory(accountKey, history);
};

export const extractFlowOpinionHistory = (records: any[] = []) => {
  const history: Array<{ text: string; time: number }> = [];
  const pushHistory = (text?: string, time?: number) => {
    const value = `${text || ''}`.trim();
    if (!value) return;
    const exists = history.find((item) => item.text === value);
    if (exists) {
      exists.time = Math.max(exists.time || 0, time || 0);
      return;
    }
    history.push({
      text: value,
      time: time || 0,
    });
  };

  for (const record of records) {
    for (const meta of Object.values(record?.metas || {})) {
      const opinionMeta = meta as { comment?: string; updateTime?: number };
      pushHistory(opinionMeta.comment, opinionMeta.updateTime || record?.endTime || record?.startTime);
    }

    for (const submitRecord of record?.submitRecords || []) {
      pushHistory(submitRecord?.comment, submitRecord?.time);
    }
  }

  return history
    .sort((a, b) => b.time - a.time)
    .map((item) => item.text);
};

export const uploadFlowOpinionFile = async (nocodeId: string, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('filename', file.name);
  formData.append('nocodeId', nocodeId);

  const { data } = await axios.post('/nocode/upload-resource', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return normalizeFlowOpinionFile({
    uid: unique(),
    name: file.name,
    size: file.size,
    status: 'success',
    url: data?.url,
  });
};
