import { Field, PackType, Table } from "@common/types/project";
import { SaasPlan } from "@common/types/user";
// @ts-ignore
import { OptionTableUID } from "@common/types/project";
import { OptionFieldValue, OptionTableValue } from "@renderer/b2/types";
import { Element } from "@renderer/b2/controllers/element";
import { Ref } from "vue";

export type Folder = {
  id: string,
  name: string,
  createTime: number,
  deleteTime?: number,
  deleted?: boolean,
  accountId?:string,
  folders?:string[],
  projects?:string[],
  isPublic?:boolean,
}

export type Share = {
  id: string,
  name: string,
  type: string,
  parent: string,
  link?:string,
  thumbnail?:string,
}

export type GetRefType<T> = T extends Ref<(infer U)> ? U : never;

// @ts-ignore
export type { ParsedRef } from "@renderer/b2/types";

export type FieldOptionContext = {
  getFields ?: () => OptionFieldValue[],
  addField ?:(uids: [string, string, string], field: Field) => boolean,
  removeField ?: (uids: [string, string, string]) => boolean,
  computeFieldScore ?: (field: Field) => number | 'quantityLimit' | 'typeError'

  getTables ?: () => OptionTableValue[],
  addTable ?:(uids: OptionTableUID, table: Table) => boolean,
  removeTable ?: (uids: OptionTableUID) => boolean,
}

export type ContextMenuContext = {
  event: MouseEvent,
  currentData: Field,
  type: ProjectDataContextMenuType,
  visible: boolean,
  params: object,
  renameCallback() :void,
}

export type ProjectDataContextMenuType = "table" | "field" | "private-field";

export type Pack = {
  key: PackType,
  name: string,
  money: number,
  dateValue: number,
  dateUnit: any,
}

export type RechargeType = 'recharge' | 'saas';
export type RechargeSubType = 'coin' | 'money' | SaasPlan | 'SEAT';

export type RechargeChannelDialogArgs = {
  rechargeType: RechargeType,
  type: RechargeSubType,
}

export type SelectFormTableDialogArgs = (tableUid: OptionTableUID) => void;

export enum ClientTheme {
  Light = 'Light',
  Dark = 'Dark',
}

export type Theme = {
  money: number,
  hotValue: number,
  previewCount?: string,
  client?: any,
  id: number,
  title: string,
  timeUpdate: number,
  author: string,
  screenRatio: string,
  screenSize: string,
  /** @deprecated */
  plan: string,
  thumbnail: string,
  thumbnailBig: string,
  preview: string,
  proveImg?: string,
  previewSmall: string,
  previewVideo: string,
  tags: string[],
  brief: string,
  previewUrl: string,
  fileSizeLatest: number,
  themePrice?: number,
  themePlan?: SaasPlan,
  previewVideoSmall: string,
  md5: string,
  version: number,
  isBest: boolean,
  isCollect: boolean,
  isPayed: boolean,
}
type ButtonProps = {
  callback?:(val?:string) => void,
  label:string,
  icon:any,
  type: 'button',
  visible?: boolean,
  disabled?:boolean
}
type SelectProps = {
  type: 'select'
  callback?:(val?:string) => void,
  selectChoices?:{
    label:string,
    value:any
  }[],
  label:string,
  icon:any,
  value:any,
  visible?: boolean,
  disabled?:boolean
}
type ToggleProps = {
  type: 'toggle'
  callback?:(val?:string) => void,
  info:{
    label:string,
    icon:any,
    value:string
  }[],
  value: string,
  visible?: boolean,
  disabled?:boolean
}
export type ShareProps = ButtonProps | SelectProps | ToggleProps;

export const CLOUD_HOST_STATUS = "CLOUD_HOST_STATUS";
export const UPDATE_REPORT_LIST = "UPDATE_REPORT_LIST";

export enum ProjectResourceType {
  Image = 'Image',
  Video = 'Video',
  Unknown = 'Unknown',
}
export type ProjectResourceTableItem = {
  element: Element,
  optionPaths: string[],
  resourceType: ProjectResourceType,
  resourceName: string,
  resourcePath: string,
  resolution: [number, number],
  resourceSize: number,
  bitRate: number,
}

export enum FormMode {
  Edit = 'edit',
  Add = 'add'
}
