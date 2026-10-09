import { randomBytes, timingSafeEqual } from "crypto";

export const ELECTRON_CLIENT_TOKEN_HEADER = "x-banban-client-token";

let clientToken: string | null = null;
let clientOrigin: string | null = null;

export const createElectronClientToken = () => {
  clientToken = randomBytes(32).toString("hex");
  return clientToken;
};

export const getElectronClientToken = () => clientToken;

export const setElectronClientOrigin = (url: string | null) => {
  clientOrigin = url ? new URL(url).origin : null;
};

export const getElectronClientOrigin = () => clientOrigin;

export const isElectronClientRequestToken = (value: string | string[] | undefined) => {
  if (!clientToken || typeof value !== "string" || value.length !== clientToken.length) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(clientToken));
};

export const clearElectronClientToken = () => {
  clientToken = null;
  clientOrigin = null;
};
