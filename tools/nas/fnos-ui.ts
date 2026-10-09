import { buildNasUiRuntimeEnv } from "../../src/main/utils/nas-runtime";

export const createFnosUiIndexCgiPath = (packageName: string) => `/cgi/ThirdParty/${packageName}/index.cgi/`;

export const createFnosUiConfig = (packageName: string, displayName: string) => {
  return JSON.stringify({
    ".url": {
      [`${packageName}.Application`]: {
        title: displayName,
        icon: "images/icon_{0}.png",
        type: "url",
        protocol: "http",
        url: createFnosUiIndexCgiPath(packageName),
        allUsers: true,
      },
    },
  }, null, 2);
};

export const createFnosUiRuntimeEnv = (port: number, protocol: "http" | "https" = "http", baseUrl = "") => {
  return buildNasUiRuntimeEnv(port, {
    protocol,
    baseUrl,
  });
};
