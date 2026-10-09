import { NocodeBody, NocodeImportState, PrintTemplate } from '@common/types/nocode';
import { RowShareAccessScope, TableUID } from '@common/types/project';
import axios from 'axios';

type TemplateRenderOptions = {
  nocodeId: string,
  tableId: TableUID,
  printTemplate?: PrintTemplate,
  printTemplateUID?: string,
  selectRowUids?: string[],
}
type GeneratePrintFileOptions = {
  nocodeId: string,
  tableId: TableUID,
  printTemplateUID: string,
  selectRowUids: string[],
  mergePrint?: boolean,
}
type GeneratePrintFileUrlOptions = {
  nocodeId: string,
  tableId: TableUID,
  recordId: string,
  isTemporary?: boolean,
  excelPrintSheetName?: string | string[],
}
type RowShareCreateOptions = {
  nocodeId: string,
  tableUID: TableUID,
  rowUUID: string,
}
type RowShareAccessOptions = {
  token: string,
  scope: RowShareAccessScope,
  detail?: boolean,
}
type RowShareVisitOptions = RowShareAccessOptions & {
  password: string,
}
type RowShareTokenValidateOptions = RowShareAccessOptions & {
  accessToken: string,
}
type RowShareRequestHeadersOptions = {
  accessToken?: string,
}
type RowShareAccessConfigPayload = {
  token: string,
  scope: RowShareAccessScope,
  access: {
    isNeedPassword?: boolean,
    shareExpireTime?: number | null,
    password?: string,
  },
}
type PublicQueryBootstrapOptions = {
  nocodeId: string,
  tableUID: TableUID,
}
type PublicQueryVisitOptions = {
  nocodeId: string,
  tableUID: TableUID,
  password: string,
}
type UploadNocodeSnapshotOptions = {
  nocodeId: string,
  formData: FormData,
  sign?: string,
}
const requestNocodeBody = async (nocodeId: string) => {
  const { data } = await axios.get(`/project/get-nocode-body/${nocodeId}`);
  return data as NocodeBody;
};

const getMainSign = (headers: Record<string, any> = {}) => {
  const sign = headers['x-sign'];
  return Array.isArray(sign) ? sign[0] : sign;
};

const buildRowShareHeaders = (accessToken?: string) => {
  if (!accessToken) return undefined;
  return {
    'x-row-share-access-token': accessToken,
  };
};

export const projectApi = {
  async getNocodeBody(nocodeId: string) {
    return requestNocodeBody(nocodeId);
  },
  async getNocodeImportState(nocodeId: string) {
    const { data } = await axios.get("/project/get-nocode-import-state", {
      params: { nocodeId },
    });
    return data as NocodeImportState;
  },
  async saveNocodeImportReadonly(nocodeId: string, disableEdit: boolean) {
    const { data } = await axios.post("/project/save-nocode-import-readonly", {
      nocodeId,
      disableEdit,
    });
    return data as NocodeImportState;
  },
  async uploadNocodeSnapshot(options: UploadNocodeSnapshotOptions) {
    const { nocodeId, formData, sign } = options;
    let requestSign = sign;

    if (!requestSign) {
      requestSign = (await requestNocodeBody(nocodeId).catch(() => null))?.sign;
    }

    const headers = {
      'Content-Type': 'multipart/form-data',
      'x-nocode-id': nocodeId,
    } as Record<string, string>;

    if (requestSign) {
      headers['x-sign'] = requestSign;
    }

    const response = await axios.post('/project/upload-nocode-snapshot', formData, { headers });
    return {
      sign: getMainSign(response.headers),
      cover: response.data?.cover,
      snapshot: response.data?.snapshot,
    };
  },
  async getTemplateRender(options: TemplateRenderOptions) {
    try {
      const { data } = await axios.post("/project/template-render", options);
      return data;
    } catch (err) {
      const message = err?.response?.data?.message || err?.message;
      throw Object.assign(new Error(message), { response: err?.response });
    }
  },
  async generatePrintFile(options: GeneratePrintFileOptions) {
    try {
      const { data } = await axios.post("/project/generate-print-file", options)
      return data;
    } catch (err) {
      throw err;
    }
  },
  async generatePrintFileUrl(options: GeneratePrintFileUrlOptions) {
    try {
      const { data } = await axios.post("/project/generate-print-file-url", options);
      return data;
    } catch (err) {
      throw err;
    }
  },
  async createOrGetRowShare(options: RowShareCreateOptions) {
    const { data } = await axios.post("/project/row-share/create-or-get", options);
    return data;
  },
  async updateRowShareAccess(options: RowShareAccessConfigPayload) {
    const { data } = await axios.post("/project/row-share/access-config", options);
    return data;
  },
  async getRowShareAccess(options: RowShareAccessOptions) {
    const { data } = await axios.get("/project/row-share/access", {
      params: options,
    });
    return data;
  },
  async getRowShareAccessDetail(options: RowShareAccessOptions) {
    const { data } = await axios.get("/project/row-share/access-detail", {
      params: options,
    });
    return data;
  },
  async visitRowShare(options: RowShareVisitOptions) {
    const { data } = await axios.post("/project/row-share/visit", options);
    return data;
  },
  async validateRowShareAccessToken(options: RowShareTokenValidateOptions) {
    const { data } = await axios.post("/project/row-share/validate-access-token", options);
    return data;
  },
  async getRowShareBootstrap(token: string, options: RowShareRequestHeadersOptions = {}) {
    const { data } = await axios.get("/project/row-share/bootstrap", {
      params: { token },
      headers: buildRowShareHeaders(options.accessToken),
    });
    return data;
  },
  async updateRowShare(token: string, row: Record<string, any>, options: RowShareRequestHeadersOptions = {}) {
    const { data } = await axios.post("/project/row-share/update", {
      token,
      row,
    }, {
      headers: buildRowShareHeaders(options.accessToken),
    });
    return data;
  },
  async getPublicRowShareBootstrap(token: string, options: RowShareRequestHeadersOptions = {}) {
    const { data } = await axios.get("/project/public-row-share/bootstrap", {
      params: { token },
      headers: buildRowShareHeaders(options.accessToken),
    });
    return data;
  },
  async updatePublicRowShare(token: string, row: Record<string, any>, options: RowShareRequestHeadersOptions = {}) {
    const { data } = await axios.post("/project/public-row-share/update", {
      token,
      row,
    }, {
      headers: buildRowShareHeaders(options.accessToken),
    });
    return data;
  },
  async validatePublicQuery(options: PublicQueryBootstrapOptions) {
    const { data } = await axios.get("/project/validate-public-query", {
      params: options,
    });
    return data;
  },
  async getPublicQueryBootstrap(options: PublicQueryBootstrapOptions) {
    const { data } = await axios.get("/project/public-query/bootstrap", {
      params: options,
    });
    return data;
  },
  async getPublicQueryAccess(options: PublicQueryBootstrapOptions) {
    const { data } = await axios.get("/project/public-query/access", {
      params: options,
    });
    return data;
  },
  async visitPublicQuery(options: PublicQueryVisitOptions) {
    const { data } = await axios.post("/project/public-query/visit", options);
    return data;
  },
  async validatePublicQueryToken(options: { nocodeId: string, tableUID: TableUID, token: string }) {
    const { data } = await axios.post("/project/validate-public-query-token", options);
    return data;
  },
}
