import { ProjectType, TableUID, PartOfCheckCoinOptions, QueryOptions, WhereCondition } from "@common/types/project"
import { SaasPlan } from "@common/types/user"

export type UploadFileParams = {
  projectId: string,
  elementId?: string,
  filename: string,
  type: 'resource' | 'data',
  folder?: string
}

export type ImportProjectOptions = {
  transformData?: boolean,
  filename: string,
  projectTypeLimit?: ProjectType[],
  parentId?: string,
  reportId?: string,
  nocodeId?: string,
  thumbnailUrl?: string,
  oldProjectId?: string,
  replaceProjectCode?: boolean,
  isTemplate?: boolean,
  plan?: SaasPlan,
  isLocal?: boolean,
}

export type ImportProjectDeplopOptions = ImportProjectOptions & {
  replace?: boolean, // 是否进行项目替换
}

export type UpdateProjectCodeOptions = {
  projectCode: string,
  projectId: string,
  projectName?: string,
  traceId: string,
  historyList?: string[],
}

export type ExportProjectOptions = {
  expireTime: number,
  toJson?: boolean,
  projectCode?: string,
  projectMigration: boolean,
  editLimit?: boolean,
  appControl?: boolean,
  cloudRender?: boolean,
  webLink?: boolean,
  advancedDataSource?: boolean,
  isLockIngProjectCode?: boolean,
}

export type ProjectRenewalOptions = {
  projectCode: string,
  renewalEndTime: number,
  projectId: string,
  partOfCheckCoinOptions: PartOfCheckCoinOptions,
}

export type ProjectRenewalContent = {
  projectCode?: string,
  endTime?: number,
  traceId: string,
  createTime: number,
  is3D: boolean,
  isPremiumWebLink: boolean,
  isCloudRender: boolean,
  isAppControl: boolean,
  isAdvancedDataSource: boolean,
}

export type ZipProjectOptions = Omit<ExportProjectOptions, "projectMigration"> & {
  projectType: ProjectType,
}

export type ReadConnectionOptions = {
  tableUIDs?: string[],
  isReset?: boolean,
  queryOptions?: QueryOptions,
  transformFormData?: boolean,
}

export type ExpressUploadFile = {
  buffer: Buffer,
  encoding: string,
  fieldname: string,
  mimetype: MimeType,
  originalname: string,
  size: number,
}

export type PagingOptions = Omit<QueryOptions, "filters"> & {
  wheres?: Record<string, WhereCondition[]>,
}

export type ApiTableSetting = {
  id: TableUID,
  name: string,
  apiAlias?: string,
  public: boolean
}

export type ApiSetting = {
  id: string,
  apiEnabled: boolean,
  apiAlias: string,
  apiTableInfo: ApiTableSetting[];
}

export type AliasType = 'app' | 'table';
