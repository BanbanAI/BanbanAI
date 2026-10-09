import { PublishCategory, PublishScope, PublishUpdateMethod, type FormShareConfig } from '@common/types/project';
import { getAllPages, getInnerPublishUpdateMethod, getPublicPublishUpdateMethod } from '@common/utils';
import { NOCODE_SIGN_IS_LATEST } from '@renderer/types';
import { useSettingStore } from '@renderer/stores';
import { doDownload } from '@renderer/utils';
import { checkNocodeSyncBeforeRequest, handleNocodeSyncConflictError } from '@renderer/utils/nocodeSyncMessage';
import { useClipboard } from '@vueuse/core';
import dayjs from 'dayjs';
import { ElMessage, TableInstance } from 'element-plus';
import { deepClone, equals, isEmpty } from '@common/utils/object';
import axios from 'axios';
import i18next from 'i18next';
import QRCode from 'qrcode';
import { ComputedRef, Ref, computed, inject, ref, watch } from 'vue';
import type { FormViewConfig, Nocode, NocodeStructure } from '@common/types/nocode';
import type { ProjectBody, Table } from '@common/types/project';

type ConfirmDialogRef = {
  confirm: () => Promise<'close' | 'cancel' | 'save'>,
} | null | undefined;

type PublishPageItem = ProjectBody | Table;

export type FormShareBaseSettingDraft = {
  buttons: {
    submit: Required<NonNullable<NonNullable<FormViewConfig["buttons"]>["submit"]>>,
    saveDraft: Required<NonNullable<NonNullable<FormViewConfig["buttons"]>["saveDraft"]>>,
    continuousSubmit: Required<NonNullable<NonNullable<FormViewConfig["buttons"]>["continuousSubmit"]>>,
    saveCurrentContent: Required<NonNullable<NonNullable<FormViewConfig["buttons"]>["saveCurrentContent"]>>,
    viewDataAfterSubmit: Required<NonNullable<NonNullable<FormViewConfig["buttons"]>["viewDataAfterSubmit"]>>,
  },
  submitBehavior: {
    successMode: "successPage" | "resetForm" | "keepCurrentContent",
    successText: string,
  },
};

export type KeepCurrentContentButtonStateBackup = {
  continuousSubmitVisible: boolean,
  continuousSubmitDefaultChecked: boolean,
  saveCurrentContentVisible: boolean,
  saveCurrentContentDefaultChecked: boolean,
} | null;

export const normalizeButtonDraftConfig = (config: FormShareBaseSettingDraft) => {
  if (config.submitBehavior.successMode === "keepCurrentContent") {
    config.buttons.continuousSubmit.visible = true;
    config.buttons.continuousSubmit.defaultChecked = true;
    config.buttons.saveCurrentContent.visible = true;
    config.buttons.saveCurrentContent.defaultChecked = true;
    return config;
  }
  if (!config.buttons.continuousSubmit.visible) {
    config.buttons.continuousSubmit.defaultChecked = false;
    config.buttons.saveCurrentContent.visible = false;
    config.buttons.saveCurrentContent.defaultChecked = false;
    return config;
  }
  if (!config.buttons.saveCurrentContent.visible) {
    config.buttons.saveCurrentContent.defaultChecked = false;
  }
  return config;
};

export const createDefaultFormViewConfig = (value?: FormViewConfig): FormShareBaseSettingDraft => {
  return normalizeButtonDraftConfig({
    buttons: {
      submit: {
        visible: value?.buttons?.submit?.visible ?? true,
        label: value?.buttons?.submit?.label ?? "",
        defaultChecked: false,
      },
      saveDraft: {
        visible: value?.buttons?.saveDraft?.visible ?? true,
        label: value?.buttons?.saveDraft?.label ?? "",
        defaultChecked: false,
      },
      continuousSubmit: {
        visible: value?.buttons?.continuousSubmit?.visible ?? true,
        label: value?.buttons?.continuousSubmit?.label ?? "",
        defaultChecked: value?.buttons?.continuousSubmit?.defaultChecked ?? false,
      },
      saveCurrentContent: {
        visible: value?.buttons?.saveCurrentContent?.visible ?? true,
        label: value?.buttons?.saveCurrentContent?.label ?? "",
        defaultChecked: value?.buttons?.saveCurrentContent?.defaultChecked ?? false,
      },
      viewDataAfterSubmit: {
        visible: value?.buttons?.viewDataAfterSubmit?.visible ?? true,
        label: value?.buttons?.viewDataAfterSubmit?.label ?? "",
        defaultChecked: false,
      },
    },
    submitBehavior: {
      successMode: value?.submitBehavior?.successMode ?? "successPage",
      successText: value?.submitBehavior?.successText ?? "",
    },
  });
};

export const buildSavedFormViewConfig = (
  config: FormShareBaseSettingDraft,
  autoSubmit?: FormViewConfig["autoSubmit"],
): FormViewConfig => {
  const nextConfig = normalizeButtonDraftConfig(deepClone(config));
  const nextValue: FormViewConfig = {
    buttons: {
      submit: {
        visible: nextConfig.buttons.submit.visible,
        label: nextConfig.buttons.submit.label.trim(),
      },
      saveDraft: {
        visible: nextConfig.buttons.saveDraft.visible,
        label: nextConfig.buttons.saveDraft.label.trim(),
      },
      continuousSubmit: {
        visible: nextConfig.buttons.continuousSubmit.visible,
        label: nextConfig.buttons.continuousSubmit.label.trim(),
        defaultChecked: nextConfig.buttons.continuousSubmit.defaultChecked,
      },
      saveCurrentContent: {
        visible: nextConfig.buttons.saveCurrentContent.visible,
        label: nextConfig.buttons.saveCurrentContent.label.trim(),
        defaultChecked: nextConfig.buttons.saveCurrentContent.defaultChecked,
      },
      viewDataAfterSubmit: {
        visible: nextConfig.buttons.viewDataAfterSubmit.visible,
        label: nextConfig.buttons.viewDataAfterSubmit.label.trim(),
      },
    },
    submitBehavior: {
      successMode: nextConfig.submitBehavior.successMode,
      successText: nextConfig.submitBehavior.successText.trim(),
    },
  };
  if (autoSubmit) {
    nextValue.autoSubmit = deepClone(autoSubmit);
  }
  return nextValue;
};

export const createKeepCurrentContentButtonStateBackup = (
  config: FormShareBaseSettingDraft,
): NonNullable<KeepCurrentContentButtonStateBackup> => ({
  continuousSubmitVisible: config.buttons.continuousSubmit.visible,
  continuousSubmitDefaultChecked: config.buttons.continuousSubmit.defaultChecked,
  saveCurrentContentVisible: config.buttons.saveCurrentContent.visible,
  saveCurrentContentDefaultChecked: config.buttons.saveCurrentContent.defaultChecked,
});

export const restoreKeepCurrentContentButtonStateBackup = (
  config: FormShareBaseSettingDraft,
  backup: NonNullable<KeepCurrentContentButtonStateBackup>,
) => {
  config.buttons.continuousSubmit.visible = backup.continuousSubmitVisible;
  config.buttons.continuousSubmit.defaultChecked = backup.continuousSubmitDefaultChecked;
  config.buttons.saveCurrentContent.visible = backup.saveCurrentContentVisible;
  config.buttons.saveCurrentContent.defaultChecked = backup.saveCurrentContentDefaultChecked;
};

export const createDefaultFormShareConfig = (value?: FormShareConfig): FormShareConfig => ({
  baseConfig: buildSavedFormViewConfig(
    createDefaultFormViewConfig(value?.baseConfig),
    value?.baseConfig?.autoSubmit,
  ),
});

export const ensureInnerFormShareConfig = (table: Table) => {
  table.publish = table.publish || {};
  table.publish.innerFormShareConfig = createDefaultFormShareConfig(table.publish.innerFormShareConfig);
  return table.publish.innerFormShareConfig;
};

export const ensurePublicFormShareConfig = (table: Table) => {
  table.publish = table.publish || {};
  table.publish.publicFormShareConfig = createDefaultFormShareConfig(table.publish.publicFormShareConfig);
  return table.publish.publicFormShareConfig;
};

type PublishSettingStateOptions = {
  nocode: Ref<Nocode | undefined>,
  onUpdateNocode: () => void | Promise<void>,
  onUpdateTable: (tables: Table[]) => void | Promise<void>,
  onPublishSuccess?: () => void | Promise<void>,
};

export type PublishSettingState = {
  nocode: Ref<Nocode | undefined>,
  innerUpdateMethod: Ref<PublishUpdateMethod>,
  publicUpdateMethod: Ref<PublishUpdateMethod>,
  publicPageIds: Ref<string[]>,
  publicFormIds: Ref<string[]>,
  isPageUpdate: Ref<boolean>,
  selectedInnerIds: Ref<Set<string>>,
  selectedPublicRows: ComputedRef<PublishPageItem[]>,
  innerPagedProjects: ComputedRef<PublishPageItem[]>,
  publicPagedProjects: ComputedRef<PublishPageItem[]>,
  innerPublishProjects: ComputedRef<PublishPageItem[]>,
  publicPublishProjects: ComputedRef<PublishPageItem[]>,
  innerPublishPages: Ref<ProjectBody[]>,
  innerPublishForms: Ref<Table[]>,
  innerPage: Ref<number>,
  publicPage: Ref<number>,
  rowSharePage: Ref<number>,
  pageSize: Ref<number>,
  activePublicTab: Ref<'formPublish' | 'rowShare' | 'publicQuery'>,
  innerTableRef: Ref<TableInstance | undefined>,
  publicTableRef: Ref<TableInstance | undefined>,
  addLayerDialogValue: Ref<boolean>,
  qrCodeVisible: Ref<boolean>,
  virtualRef: Ref<HTMLElement | undefined>,
  qrCodeUrl: Ref<string>,
  checkIsForm: (unknownType: PublishPageItem) => boolean,
  getPageName: (row: ProjectBody) => string | undefined,
  isPublicFormSharing: (table: Table) => boolean,
  handleBatchInner: (value: boolean) => void,
  handleBatchPublic: (value: boolean) => void,
  handleCopyPublicUrl: (project: PublishPageItem, dialogRef?: ConfirmDialogRef, type?: PublishScope) => Promise<void>,
  handleOpenPublishUrl: (project: PublishPageItem, dialogRef?: ConfirmDialogRef, type?: PublishScope) => Promise<void>,
  handleShowQrCode: (event: MouseEvent, project: PublishPageItem, dialogRef?: ConfirmDialogRef, type?: PublishScope) => Promise<void>,
  handlePublicSelectionChange: (rows: PublishPageItem[]) => void,
  handleInnerSelectionChange: (rows: PublishPageItem[]) => void,
  handlePublicPageChange: () => void,
  handlePublicPageSizeChange: () => void,
  handleInnerPageChange: () => void,
  handleInnerPageSizeChange: () => void,
  handleRowSharePageChange: () => void,
  handleRowSharePageSizeChange: () => void,
  handleDeletePublicProjectMultiple: () => void,
  handleDeletePublicProjects: (ids: string[]) => void,
  handleUpdateNeedPsw: (row: PublishPageItem) => void,
  handleBoardPasswordChange: (row: ProjectBody) => void,
  handleFormPasswordChange: (row: Table) => void,
  handlePublicQueryPasswordChange: (row: Table) => void,
  handleExpireTimeChange: (row: PublishPageItem) => void,
  handleAddLayers: (ids: string[]) => Promise<void>,
  handleConfirm: (force?: boolean, releaseTableUIDs?: string[]) => Promise<void>,
  checkUpdate: (dialogRef?: ConfirmDialogRef) => Promise<boolean | string>,
  reset: () => Promise<void>,
  onDisabledDate: (data: Date) => boolean,
  onClickOutside: () => void,
  downloadQrcode: () => Promise<void>,
  rowSharePagedForms: ComputedRef<Table[]>,
};

export const usePublishSettingState = (options: PublishSettingStateOptions): PublishSettingState => {
  const settingState = useSettingStore();
  void settingState.getDomainPort();
  const { copy } = useClipboard({ legacy: true });
  const nocodeSignIsLatest = inject(NOCODE_SIGN_IS_LATEST, null);

  const innerUpdateMethod = ref<PublishUpdateMethod>(PublishUpdateMethod.LIVE);
  const publicUpdateMethod = ref<PublishUpdateMethod>(PublishUpdateMethod.LIVE);
  const innerTableRef = ref<TableInstance>();
  const publicTableRef = ref<TableInstance>();
  const addLayerDialogValue = ref(false);
  const virtualRef = ref<HTMLElement>();
  const qrCodeVisible = ref(false);
  const qrCodeUrl = ref('');
  const qrCodeProject = ref<PublishPageItem>();
  const qrCodeFileName = ref('');
  const modifyPwdMap = ref<Record<string, boolean>>({});

  const innerPublishPages = ref<ProjectBody[]>([]);
  const innerPublishForms = ref<Table[]>([]);
  const publicPageIds = ref<string[]>([]);
  const publicFormIds = ref<string[]>([]);
  const isPageUpdate = ref(false);
  const allPages = ref<NocodeStructure[]>([]);

  const selectedPublicIds = ref<Set<string>>(new Set());
  const selectedInnerIds = ref<Set<string>>(new Set());
  const publicPage = ref(1);
  const innerPage = ref(1);
  const rowSharePage = ref(1);
  const pageSize = ref(10);
  const activePublicTab = ref<'formPublish' | 'rowShare' | 'publicQuery'>('formPublish');
  const needUpdateProjectIds = ref<string[]>([]);

  const currentNocode = computed(() => options.nocode.value);

  const innerPublishProjects = computed(() => {
    return [...innerPublishPages.value, ...innerPublishForms.value];
  });

  const publicPublishProjects = computed(() => {
    return [
      ...(innerPublishPages.value?.filter(body => !!body.id && publicPageIds.value.includes(body.id)) || []),
      ...(innerPublishForms.value?.filter(table => publicFormIds.value.includes(table.uid)) || []),
    ];
  });

  const rowSharePagedForms = computed(() => {
    const start = (rowSharePage.value - 1) * pageSize.value;
    return innerPublishForms.value.slice(start, start + pageSize.value);
  });

  const tablesDecode = computed(() => {
    const tables = currentNocode.value?.body?.formData?.tables ?? [];
    return tables
      .filter(t => t.meta.extra?.primaryTable?.length !== 2)
      .map(table => {
        const nextTable = {
          ...table,
          publish: {
            ...(table.publish ?? {}),
            updateMethod: table.publish?.updateMethod || defaultPublicUpdateMethod.value,
          },
        };
        return nextTable;
      });
  });

  const defaultInnerUpdateMethod = computed(() => {
    return getInnerPublishUpdateMethod(currentNocode.value?.meta);
  });

  const defaultPublicUpdateMethod = computed(() => {
    return getPublicPublishUpdateMethod(currentNocode.value?.meta);
  });

  const initInnerPublishData = async (pageBodies: ProjectBody[]) => {
    const clonePages = deepClone(pageBodies || []);
    const tables = (currentNocode.value?.body?.formData?.tables ?? []).filter(table => !table.meta.extra?.primaryTable?.length);
    const cloneForms = deepClone(tables).map(table => {
      const nextTable = {
        ...table,
        publish: {
          ...(table.publish ?? {}),
          updateMethod: table.publish?.updateMethod || defaultPublicUpdateMethod.value,
        },
      };
      return nextTable;
    });

    innerPublishPages.value = clonePages;
    innerPublishForms.value = cloneForms;
  };

  const init = async () => {
    if (!currentNocode.value) {
      return;
    }
    const pageBodies = currentNocode.value.pageBodies || [];

    publicPageIds.value = pageBodies
      .filter((body): body is ProjectBody & { id: string } => !!body.isPublicShare && !!body.id)
      .map(body => body.id);

    const tables = (currentNocode.value.body?.formData?.tables ?? []).filter(table => !table.meta.extra?.primaryTable?.length);
    publicFormIds.value = tables.filter(table => table.publish?.isPublicShare)?.map(table => table.uid) || [];

    await initInnerPublishData(pageBodies);

    innerUpdateMethod.value = defaultInnerUpdateMethod.value;
    publicUpdateMethod.value = defaultPublicUpdateMethod.value;
    allPages.value = getAllPages(currentNocode.value.body?.structure);
    needUpdateProjectIds.value = [];
    modifyPwdMap.value = {};
    selectedPublicIds.value.clear();
    selectedInnerIds.value.clear();
    publicPage.value = 1;
    innerPage.value = 1;
    rowSharePage.value = 1;
  };

  watch(
    () => currentNocode.value,
    (value) => {
      if (!value) return;
      init();
    },
    { immediate: true }
  );

  watch(() => [innerPublishProjects.value, publicPublishProjects.value, innerUpdateMethod.value, publicUpdateMethod.value], () => {
    if (
      !equals(innerPublishPages.value, currentNocode.value?.pageBodies) ||
      !equals(innerPublishForms.value, tablesDecode.value) ||
      innerUpdateMethod.value !== defaultInnerUpdateMethod.value ||
      publicUpdateMethod.value !== defaultPublicUpdateMethod.value
    ) {
      isPageUpdate.value = true;
    } else {
      isPageUpdate.value = false;
    }
  }, { deep: true });

  const selectedPublicRows = computed(() => {
    const map = new Map<string, PublishPageItem>();
    publicPublishProjects.value.forEach(row => {
      const id = getPublishItemId(row);
      if (selectedPublicIds.value.has(id)) {
        map.set(id, row);
      }
    });
    return Array.from(map.values());
  });

  const getPageName = (row: ProjectBody) => {
    return allPages.value.find(item => item.id === row.id)?.name;
  };

  const checkIsForm = (unknownType: PublishPageItem): unknownType is Table => {
    return !innerPublishPages.value.includes(unknownType as ProjectBody);
  };

  const getPublishItemId = (project: PublishPageItem) => {
    return checkIsForm(project) ? project.uid : (project.id || '');
  };

  const isPublicFormSharing = (table: Table) => {
    return !!table.publish?.isPublicShare && !!table.publish?.sharing;
  };

  const handleFormPasswordChange = (row: Table) => {
    row.publish.encrypted = false;
    modifyPwdMap.value[row.uid] = true;
  };

  const handlePublicQueryPasswordChange = (row: Table) => {
    row.publish = row.publish || {};
    row.publish.publicQuery = row.publish.publicQuery || {};
    row.publish.publicQuery.encrypted = false;
    modifyPwdMap.value[row.uid] = true;
  };

  const handleBoardPasswordChange = (row: ProjectBody) => {
    row.encrypted = false;
    modifyPwdMap.value[row.id || ''] = true;
  };

  const handleExpireTimeChange = (row: PublishPageItem) => {
    if (checkIsForm(row)) {
      modifyPwdMap.value[row.uid] = true;
    } else {
      modifyPwdMap.value[row.id || ''] = true;
    }
  };

  const handleUpdateNeedPsw = (row: PublishPageItem) => {
    if (checkIsForm(row)) {
      row.publish.isNeedPassword = !row.publish.isNeedPassword;
      modifyPwdMap.value[row.uid] = true;
    } else {
      row.isNeedPassword = !row.isNeedPassword;
      modifyPwdMap.value[row.id || ''] = true;
    }
  };

  const sortPage = <T extends ProjectBody[] | Table[]>(pages: T, ids: string[]): T => {
    return pages.sort((a, b) => {
      const indexA = ids.indexOf(getPublishItemId(a));
      const indexB = ids.indexOf(getPublishItemId(b));
      return indexA - indexB;
    }) as T;
  };

  const handleAddLayers = async (ids: string[]) => {
    if (isEmpty(ids) || !currentNocode.value) return;
    if (!checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return;
    const pageBodies = currentNocode.value.pageBodies || [];

    publicPageIds.value = [...new Set([...publicPageIds.value, ...ids.filter(id => innerPublishPages.value.some(page => page.id === id))])];
    publicFormIds.value = [...new Set([...publicFormIds.value, ...ids.filter(id => innerPublishForms.value.some(page => page.uid === id))])];

    innerPublishPages.value = sortPage(innerPublishPages.value, ids).map((body: ProjectBody) => {
      if (ids.includes(body.id || '')) {
        body.isPublicShare = true;
        body.sharing = true;
      }
      return body;
    });

    innerPublishForms.value = sortPage(innerPublishForms.value, ids).map((table: Table) => {
      if (ids.includes(table.uid)) {
        table.publish.isPublicShare = true;
        table.publish.sharing = true;
      }
      return table;
    });

    const data = await axios.post('project/update-nocode-pages', {
      nocodeId: currentNocode.value.meta.id,
      innerUpdateMethod: innerUpdateMethod.value,
      publicUpdateMethod: publicUpdateMethod.value,
      projectIds: innerUpdateMethod.value === PublishUpdateMethod.MANUAL ? needUpdateProjectIds.value : null,
      projectBodies: sortPage(pageBodies, ids).map(body => {
        if (ids.includes(body.id || '')) {
          body.isPublicShare = true;
          body.sharing = true;
        }
        return body;
      }),
      tables: sortPage(tablesDecode.value, ids).map(table => {
        if (ids.includes(table.uid)) {
          table.publish.isPublicShare = true;
          table.publish.sharing = true;
        }
        return table;
      }),
    }, {
      headers: {
        'x-sign': currentNocode.value.body.sign,
      },
    }).then(({ data, headers }) => {
      const mainSign = Array.isArray(headers?.['x-sign']) ? headers['x-sign'][0] : headers?.['x-sign'];
      if (mainSign && currentNocode.value) {
        currentNocode.value.body.sign = mainSign;
      }
      return data;
    }).catch((error) => {
      const { response } = error;
      if (handleNocodeSyncConflictError(error, nocodeSignIsLatest)) return false;
      ElMessage.error(response?.data?.message);
      return false;
    });

    if (data) {
      ElMessage.success(i18next.t('usePublishSettingState.addSuccess'));
      await options.onUpdateTable(data?.tables);
      await options.onUpdateNocode();
      await options.onPublishSuccess?.();
    }
  };

  const onDisabledDate = (data: Date) => {
    return dayjs(data).isBefore(dayjs());
  };

  const getShareUrl = (project: PublishPageItem, type = PublishScope.PUBLIC) => {
    const saasDomain = settingState.saas.domain;
    const formType = checkIsForm(project) ? PublishCategory.FORM : PublishCategory.PAGE;
    const id = getPublishItemId(project);
    if (type === PublishScope.PUBLIC) {
      return `${saasDomain}/#/share/${formType}/${currentNocode.value?.meta.id}/${id}`;
    }
    return `${saasDomain}/#/view/${formType}/${currentNocode.value?.meta.id}/${id}`;
  };

  const validIsSave = async (id: string, dialogRef?: ConfirmDialogRef) => {
    if (!modifyPwdMap.value[id]) {
      return true;
    }
    if (!dialogRef) {
      return 'close';
    }
    const resolve = await dialogRef.confirm();
    if (resolve === 'save') {
      await handleConfirm();
    }
    return resolve;
  };

  const handleCopyPublicUrl = async (project: PublishPageItem, dialogRef?: ConfirmDialogRef, type = PublishScope.PUBLIC) => {
    const res = await validIsSave(getPublishItemId(project), dialogRef);
    if (res === 'close') return;

    const url = getShareUrl(project, type);
    await copy(url);
    ElMessage.success(i18next.t('usePublishSettingState.copySuccess'));
  };

  const handleOpenPublishUrl = async (project: PublishPageItem, dialogRef?: ConfirmDialogRef, type = PublishScope.PUBLIC) => {
    const res = await validIsSave(getPublishItemId(project), dialogRef);
    if (res === 'close') return;

    const url = getShareUrl(project, type);
    window.open(url, '_blank');
  };

  const handleShowQrCode = async (event: MouseEvent, project: PublishPageItem, dialogRef?: ConfirmDialogRef, type = PublishScope.PUBLIC) => {
    const res = await validIsSave(getPublishItemId(project), dialogRef);
    if (res === 'close') return;
    if (qrCodeVisible.value) return;

    qrCodeUrl.value = getShareUrl(project, type);
    qrCodeProject.value = project;
    qrCodeFileName.value = checkIsForm(project) ? project.alias : getPageName(project) || '';
    virtualRef.value = event.target as HTMLElement;
    qrCodeVisible.value = true;
  };

  const onClickOutside = () => {
    qrCodeVisible.value = false;
  };

  const handleDeletePublicProjects = (ids: string[]) => {
    if (isEmpty(ids)) return;

    publicPageIds.value = publicPageIds.value.filter(id => !ids.includes(id));
    publicFormIds.value = publicFormIds.value.filter(uid => !ids.includes(uid));
    innerPublishPages.value = innerPublishPages.value.map(body => {
      if (ids.includes(body.id || '')) {
        body.isPublicShare = false;
        body.shareExpireTime = null;
        body.isNeedPassword = false;
        body.password = undefined;
      }
      return body;
    });

    innerPublishForms.value = innerPublishForms.value.map(table => {
      if (ids.includes(table.uid)) {
        table.publish.isPublicShare = false;
        table.publish.shareExpireTime = null;
        table.publish.isNeedPassword = false;
        table.publish.password = undefined;
      }
      return table;
    });
  };

  const handleBatchPublic = (value: boolean) => {
    if (isEmpty(selectedPublicRows.value)) return;
    for (const row of selectedPublicRows.value) {
      if (!checkIsForm(row)) row.sharing = value;
      else row.publish.sharing = value;
    }
  };

  const handleBatchInner = (value: boolean) => {
    const selectedIds = Array.from(selectedInnerIds.value);
    if (isEmpty(selectedIds)) return;

    for (const project of innerPublishProjects.value) {
      const id = getPublishItemId(project);
      if (!selectedIds.includes(id)) {
        continue;
      }
      if (checkIsForm(project)) {
        project.publish.sharing = value;
      } else {
        project.sharing = value;
      }
    }
  };

  const handleDeletePublicProjectMultiple = () => {
    if (isEmpty(selectedPublicRows.value)) return;
    handleDeletePublicProjects(selectedPublicRows.value.map(row => getPublishItemId(row)));
  };

  const getChangedPublicManualFormIds = () => {
    const currentTables = new Map(innerPublishForms.value.map(table => [table.uid, table]));
    const sourceTables = new Map(tablesDecode.value.map(table => [table.uid, table]));

    return innerPublishForms.value
      .filter((table) => {
        if ((table.publish?.updateMethod || defaultPublicUpdateMethod.value) !== PublishUpdateMethod.MANUAL) {
          return false;
        }
        return !equals(currentTables.get(table.uid), sourceTables.get(table.uid));
      })
      .map(table => table.uid);
  };

  const handleConfirm = async (force = false, releaseTableUIDs?: string[]) => {
    if ((!isPageUpdate.value && !force) || !currentNocode.value) {
      return;
    }
    if (!checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return;

    const data = await axios.post('project/update-nocode-pages', {
      nocodeId: currentNocode.value.meta.id,
      innerUpdateMethod: innerUpdateMethod.value,
      publicUpdateMethod: publicUpdateMethod.value,
      projectIds: innerUpdateMethod.value === PublishUpdateMethod.MANUAL ? needUpdateProjectIds.value : null,
      projectBodies: innerPublishPages.value,
      tables: innerPublishForms.value,
      releaseTableUIDs: releaseTableUIDs ?? getChangedPublicManualFormIds(),
    }, {
      headers: {
        'x-sign': currentNocode.value.body.sign,
      },
    }).then(({ data, headers }) => {
      const mainSign = Array.isArray(headers?.['x-sign']) ? headers['x-sign'][0] : headers?.['x-sign'];
      if (mainSign && currentNocode.value) {
        currentNocode.value.body.sign = mainSign;
      }

      ElMessage.success(i18next.t('usePublishSettingState.saveSuccess'));
      return data;
    }).catch((error) => {
      const { response } = error;
      if (handleNocodeSyncConflictError(error, nocodeSignIsLatest)) return false;
      ElMessage.error(response?.data?.message);
      return false;
    });

    if (!data) {
      return;
    }

    await options.onUpdateTable(data?.tables);
    await options.onUpdateNocode();
    await options.onPublishSuccess?.();
    isPageUpdate.value = false;
    modifyPwdMap.value = {};
  };

  const checkUpdate = async (dialogRef?: ConfirmDialogRef): Promise<boolean | string> => {
    if (!isPageUpdate.value) {
      return true;
    }
    if (!dialogRef) {
      return 'close';
    }

    const resolve = await dialogRef.confirm();
    if (resolve === 'save') {
      await handleConfirm();
    }
    return resolve;
  };

  const downloadQrcode = async () => {
    try {
      let projectName = '';
      if (qrCodeProject.value) {
        projectName = checkIsForm(qrCodeProject.value) ? qrCodeProject.value.alias : getPageName(qrCodeProject.value);
      }
      const dataUrl = await QRCode.toDataURL(qrCodeUrl.value, {
        width: 200,
        margin: 1,
        errorCorrectionLevel: 'L',
      });

      doDownload({
        url: dataUrl,
        name: `${qrCodeFileName.value || projectName}-${Date.now()}.png`,
      });
    } catch {
      ElMessage.error(i18next.t('usePublishSettingState.downloadFailed'));
    }
  };

  const publicPagedProjects = computed(() => {
    const start = (publicPage.value - 1) * pageSize.value;
    return publicPublishProjects.value.slice(start, start + pageSize.value);
  });

  const innerPagedProjects = computed(() => {
    const start = (innerPage.value - 1) * pageSize.value;
    return innerPublishProjects.value.slice(start, start + pageSize.value);
  });

  const handlePublicSelectionChange = (rows: PublishPageItem[]) => {
    const currentPageIds = publicPagedProjects.value.map(row => getPublishItemId(row));
    const selectedIds = rows.map(row => getPublishItemId(row));

    currentPageIds.forEach(id => {
      if (!selectedIds.includes(id)) {
        selectedPublicIds.value.delete(id);
      }
    });

    selectedIds.forEach(id => {
      selectedPublicIds.value.add(id);
    });
  };

  const handleInnerSelectionChange = (rows: PublishPageItem[]) => {
    const currentPageIds = innerPagedProjects.value.map(row => getPublishItemId(row));
    const selectedIds = rows.map(row => getPublishItemId(row));

    currentPageIds.forEach(id => {
      if (!selectedIds.includes(id)) {
        selectedInnerIds.value.delete(id);
      }
    });

    selectedIds.forEach(id => {
      selectedInnerIds.value.add(id);
    });
  };

  watch(() => [innerPublishProjects.value, pageSize.value], () => {
    innerPage.value = 1;
  });

  watch(() => [publicPublishProjects.value, pageSize.value], () => {
    publicPage.value = 1;
  });

  watch(() => [innerPublishForms.value, pageSize.value], () => {
    rowSharePage.value = 1;
  }, { deep: true });

  const clearInnerSelection = () => {
    selectedInnerIds.value.clear();
    innerTableRef.value?.clearSelection();
  };

  const handleInnerPageChange = () => {
    clearInnerSelection();
  };

  const handleInnerPageSizeChange = () => {
    innerPage.value = 1;
    clearInnerSelection();
  };

  const clearPublicSelection = () => {
    selectedPublicIds.value.clear();
    publicTableRef.value?.clearSelection();
  };

  const handlePublicPageChange = () => {
    clearPublicSelection();
  };

  const handlePublicPageSizeChange = () => {
    publicPage.value = 1;
    clearPublicSelection();
  };

  const handleRowSharePageChange = () => {};

  const handleRowSharePageSizeChange = () => {
    rowSharePage.value = 1;
  };

  const reset = async () => {
    await init();
    isPageUpdate.value = false;
  };

  return {
    nocode: options.nocode,
    innerUpdateMethod,
    publicUpdateMethod,
    publicPageIds,
    publicFormIds,
    isPageUpdate,
    selectedInnerIds,
    selectedPublicRows,
    innerPagedProjects,
    publicPagedProjects,
    innerPublishProjects,
    publicPublishProjects,
    innerPublishPages,
    innerPublishForms,
    innerPage,
    publicPage,
    rowSharePage,
    pageSize,
    activePublicTab,
    innerTableRef,
    publicTableRef,
    addLayerDialogValue,
    qrCodeVisible,
    virtualRef,
    qrCodeUrl,
    qrCodeFileName,
    checkIsForm,
    getPageName,
    isPublicFormSharing,
    handleBatchInner,
    handleBatchPublic,
    handleCopyPublicUrl,
    handleOpenPublishUrl,
    handleShowQrCode,
    handlePublicSelectionChange,
    handleInnerSelectionChange,
    handlePublicPageChange,
    handlePublicPageSizeChange,
    handleInnerPageChange,
    handleInnerPageSizeChange,
    handleRowSharePageChange,
    handleRowSharePageSizeChange,
    handleDeletePublicProjectMultiple,
    handleDeletePublicProjects,
    handleUpdateNeedPsw,
    handleBoardPasswordChange,
    handleFormPasswordChange,
    handlePublicQueryPasswordChange,
    handleExpireTimeChange,
    handleAddLayers,
    handleConfirm,
    checkUpdate,
    reset,
    onDisabledDate,
    onClickOutside,
    downloadQrcode,
    rowSharePagedForms,
  };
};
