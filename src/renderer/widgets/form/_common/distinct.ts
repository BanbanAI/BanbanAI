import axios from "axios";
import { getFormDataDistinctHost, useFormDataDistinctHost } from "@renderer/utils/other";

export type DistinctPayload = {
  nocodeId: string;
  tableUID: string;
  columnId: string;
  options?: any;
};

type DistinctHost = {
  distinct?: (payload: DistinctPayload) => Promise<any[] | null>;
};

type AxiosLike = {
  post: (url: string, payload?: any, config?: any) => Promise<{ data: any }>;
};

const getDistinctHost = (): DistinctHost | null => {
  try {
    const host = getFormDataDistinctHost() || useFormDataDistinctHost();
    return host || null;
  } catch (error) {
    return null;
  }
};

export const fetchDistinct = async (
  payload: DistinctPayload,
  axiosInstance: AxiosLike = axios,
  config?: any,
) => {
  const host = getDistinctHost();
  if (host?.distinct) {
    try {
      const result = await host.distinct(payload);
      if (result) return result;
    } catch (error) {
      console.warn("Failed to fetch distinct from host cache", error);
    }
  }
  const url = config?.baseURL === "" ? "/form-data/distinct" : "form-data/distinct";
  return await axiosInstance.post(url, payload, config).then(({ data }) => data).catch(() => null);
};
