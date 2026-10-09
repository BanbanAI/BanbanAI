import { DataPermissionOther, FieldPermissionGroupItemType, PermissionCategory, PermissionRangeType } from "@common/types/nocode"
import i18next from "i18next"

export const dataRangeLabelMap = {
  get all(){return i18next.t('formPermissionUtils.allData')},
  get self(){return i18next.t('formPermissionUtils.ownData')},
  get currentDepartment(){return i18next.t('formPermissionUtils.ownDeptData')},
  get siblingDepartment(){return i18next.t('formPermissionUtils.sameLevelDeptData')},
  get subDepartment(){return i18next.t('formPermissionUtils.subDeptData')},
  get anonymous(){return i18next.t('formPermissionUtils.publicSubmitData')},
  get customDepartment(){return i18next.t('formPermissionUtils.customDeptData')},
  get inProcess(){return i18next.t('formPermissionUtils.unfinishedProcessData')},
  get fromFormField(){return i18next.t('formPermissionUtils.formMemberDeptField')},
}

export const dataStatusLabelMap = {
  get processing(){return i18next.t('formPermissionUtils.processUnfinished')},
  get finished(){return i18next.t('formPermissionUtils.processFinished')},
  get noProcess(){return i18next.t('formPermissionUtils.noProcessData')},
}

export const handleRangeLabelMap = {
  get [PermissionCategory.GET](){return i18next.t('formPermissionUtils.view')},
  get [PermissionCategory.UPDATE](){return i18next.t('formPermissionUtils.edit')},
  get [PermissionCategory.DELETE](){return i18next.t('formPermissionUtils.delete')}
}

export function newInitialForm(): DataPermissionOther {
  return {
    title: i18next.t('formPermissionUtils.allMemberManageAllData'),
    description: i18next.t('formPermissionUtils.allMemberOperateAllAppData'),
    memberRange: {
      rangeType: PermissionRangeType.ALL,
      range: {
        departments: [],
        roles: [],
        users: [],
      },
    },
    dataRange: {
      all: true,
      anonymous: true,
      currentDepartment: true,
      customDepartment: { enabled: true, departments: [] },
      self: true,
      siblingDepartment: true,
      subDepartment: true,
      fromFormField: { enabled: false, field: [] },
    },
    dataStatus: {
      processing: false,
      finished: true,
      noProcess: true,
    },
    handleRange: {
      [PermissionCategory.GET]: true,
      [PermissionCategory.UPDATE]: true,
      [PermissionCategory.DELETE]: false,
    },
  }
}

export function newFieldPermissionItem(): FieldPermissionGroupItemType {
  return {
    title: i18next.t('formPermissionUtils.allMemberViewAllFieldTitle'),
    description: i18next.t('formPermissionUtils.allMemberViewAllFieldDescription'),
    externalVisitorEnabled: true,
    memberRange: {
      rangeType: PermissionRangeType.ALL,
      range: {
        departments: [],
        roles: [],
        users: [],
      }
    },
    fieldRange: {
      rangeType: PermissionRangeType.ALL,
      range: {}
    }
  }
}
