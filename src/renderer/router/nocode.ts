import { NavigationGuardNext, RouteRecordRaw } from "vue-router";
import axios from "axios";
import { isMobile } from "@renderer/utils/pure";
import { ElMessage, ElMessageBox } from "element-plus";
import i18next from "i18next";
import { NocodeImportState } from "@common/types/nocode";
import { routes as devRoutes } from "@renderer/router/dev-routes-entry";
import { env } from "@renderer/utils/env";

const getNocodeImportState = async (nocodeId?: string) => {
  if (!nocodeId) return null;
  return await axios.get(`/project/get-nocode-import-state?nocodeId=${nocodeId}`)
    .then(({ data }) => data as NocodeImportState)
    .catch(() => null);
}

const showNocodeImportStateAlert = async (nocodeId: string, type: "view" | "edit") => {
  const importState = await getNocodeImportState(nocodeId);
  if (importState?.expired) {
    await ElMessageBox.alert(i18next.t("nocodeRouter.nocodeExpired"), i18next.t("nocodeRouter.tipTitle"), {
      type: "warning",
      confirmButtonText: i18next.t("projectImportDialog.projectImportConfirm"),
      showClose: false,
    });
    return true;
  }
  if (type === "edit" && importState?.disableEdit) {
    await ElMessageBox.alert(i18next.t("nocodeRouter.nocodeReadonly"), i18next.t("nocodeRouter.tipTitle"), {
      type: "warning",
      confirmButtonText: i18next.t("projectImportDialog.projectImportConfirm"),
      showClose: false,
    });
    return true;
  }
  return false;
}

const requestNocodeRoutePermission = async (url: string, params?: Record<string, unknown>): Promise<boolean | undefined> => {
  try {
    const { data } = await axios.get(url, params ? { params } : undefined);
    return !!data;
  } catch {
    return undefined;
  }
}

const handleNocodeRouteDenied = async (nocodeId: string, type: "view" | "edit", next: NavigationGuardNext) => {
  const handled = await showNocodeImportStateAlert(nocodeId, type);
  if (handled || type === "edit") {
    next('/');
    return;
  }
  next(`/app/${nocodeId}/access-denied`);
}

const handleNocodeLayerRouteDenied = async (nocodeId: string, next: NavigationGuardNext) => {
  const handled = await showNocodeImportStateAlert(nocodeId, "view");
  if (handled) {
    next('/');
    return;
  }
  ElMessage.error(i18next.t("nocodeRouter.cannotViewLayer"))
  next(false);
}

export const getNocodeRoutes = (): Array<RouteRecordRaw> => {
  const otherRoutes: Array<RouteRecordRaw> = [...devRoutes];
  if (isMobile()) {
    return [
      {
        path: '/',
        name: 'MobileHome',
        component: () => import("@renderer/views/nocode/views/mobile/workbench/MobileWorkbenchHome.vue"),
        children: [
          {
            path: "/",
            name: "MobileWorkbenchHomeMain",
            component: () => import("@renderer/views/nocode/views/mobile/workbench/MobileWorkbenchHomeMain.vue"),
          },
        ],
      },
      {
        path: "/login",
        name: "Login",
        component: () => import("@renderer/views/nocode/views/mobile/MobileLogin.vue"),
      },
      {
        path: "/process",
        name: "Process",
        component: () => import("@renderer/views/nocode/views/mobile/workbench/process/MobileWorkbenchProcess.vue"),
      },
      {
        path: "/oa/app/:nocodeId",
        name: "MobileNocodeOaTodo",
        component: () => import("@renderer/views/nocode/views/editor/todo/NocodeOaTodoPage.vue"),
      },
      {
        path: "/signature/handwritten",
        name: "MobileHandwrittenSignaturePage",
        component: () => import("@renderer/views/nocode/views/mobile/HandwrittenSignaturePage.vue")
      },
      {
        path: "/chat/:chatId",
        name: "Chat",
        component: () => import("@renderer/views/nocode/views/workbench/AI/Chat.vue"),
        beforeEnter: async (to, from, next) => {
          const chatId = to.params.chatId as string;
          const isValid = await axios.post(`/ai/share/ping`, { token: chatId }).then(() => true).catch(() => false);
          if (isValid) {
            next();
          }
        }
      },
      {
        path: "/app/:nocodeId/access-denied",
        name: "NocodeAccessDenied",
        component: () => import("@renderer/views/nocode/views/viewer/NocodeAccessDenied.vue"),
      },
      {
        path: "/app",
        component: () => import("@renderer/views/nocode/views/mobile/viewer/MobileNocodeIndex.vue"),
        children: [
          {
            path: "/app/:nocodeId",
            name: "NocodeHome",
            component: () => import("@renderer/views/nocode/views/mobile/viewer/MobileNocodeHome.vue"),
            beforeEnter: async (to, from, next) => {
              const nocodeId = to.params.nocodeId as string;
              const canView = await requestNocodeRoutePermission(`/project/can-view-nocode?nocodeId=${nocodeId}`);
              if (canView === true) {
                next();
              } else if (canView === false) {
                await handleNocodeRouteDenied(nocodeId, "view", next);
              } else {
                ElMessage.error(i18next.t("nocodeRouter.permissionRequestFailed"));
                next(false);
              }
            }
          },
          {
            path: "/app/:nocodeId/:layerId",
            name:"NocodeDataView",
            component: () => import("@renderer/views/nocode/views/viewer/NocodeDataView.vue"),
            beforeEnter: async (to, from, next) => {
              const nocodeId = to.params.nocodeId as string;
              const canView = await requestNocodeRoutePermission(`/project/can-view-nocode-layer`, to.params as Record<string, unknown>);
              if (canView === true) {
                next();
              } else if (canView === false) {
                await handleNocodeLayerRouteDenied(nocodeId, next);
              } else {
                ElMessage.error(i18next.t("nocodeRouter.permissionRequestFailed"));
                next(false);
              }
            }
          },
        ]
      },
      {
        path: "/view/data/:token",
        name: "InnerRowShare",
        component: () => import("@renderer/views/nocode/views/editor/components/InnerRowShareViewer.vue"),
      },
      {
        path: "/view/:type/:nocodeId/:pageId",
        name: "NocodePageView",
        component: () => import("@renderer/views/nocode/views/editor/components/NocodeInnerViewer.vue"),
      },
      {
        path: "/share/data/:token",
        name: "PublicRowShare",
        meta: {
          isPublicShare: true,
          isPublicRowShare: true,
        },
        component: () => import("@renderer/views/nocode/views/editor/components/PublicRowShareViewer.vue"),
      },
      {
        path: "/share/query/:nocodeId/:tableUID",
        name: "PublicQuery",
        component: () => import("@renderer/views/nocode/views/editor/components/PublicQueryViewer.vue"),
        beforeEnter: async (to, from, next) => {
          const { nocodeId, tableUID } = to.params;
          if (!nocodeId || !tableUID) return false;
          const res = await axios.get(`/project/validate-public-query?nocodeId=${nocodeId}&tableUID=${tableUID}`)
            .then(({ data }) => data)
            .catch(() => false);
          if (res) {
            next();
          }
        }
      },
      {
        path: "/share/:type/:nocodeId/:pageId",
        name: "NocodePageShare",
        meta: {
          isPublicShare: true,
        },
        component: () => import("@renderer/views/nocode/views/editor/components/NocodeViewer.vue"),
        beforeEnter: async (to, from, next) => {
          const { type, nocodeId, pageId } = to.params;
          if (!nocodeId || !pageId) return false;
          const res = await axios.get(`/project/validate-share?type=${type}&nocodeId=${nocodeId}&projectId=${pageId}`).then(({data}) => data).catch(() => false);
          if (res) next();
        }
      },
      ...otherRoutes,
    ]
  }
  return [
    {
      path: '/',
      component: () => import("@renderer/views/nocode/views/workbench/WorkbenchDesktopLayout.vue"),
      children: [
        {
          path: '',
          name: 'Home',
          component: () => import("@renderer/views/nocode/views/workbench/WorkbenchHome.vue"),
          children: [
            {
              path: "",
              name: "WorkbenchHomeMain",
              component: () => import("@renderer/views/nocode/views/workbench/WorkbenchHomeMain.vue"),
            },
            {
              path: "apps",
              name: "WorkbenchHomeAppsAlias",
              redirect: "/",
            },
          ],
        },
        {
          path: "/user",
          name: "User",
          component: () => import("@renderer/views/nocode/views/workbench/WorkbenchUserSetting.vue"),
        },
        {
          path: "/market",
          name: "Market",
          component: () => import("@renderer/views/nocode/views/workbench/WorkbenchMarket.vue"),
          beforeEnter: async (to, from, next) => {
            const isZh = /^zh(?:-|$)/i.test(i18next.resolvedLanguage || i18next.language || '');
            return isZh ? next() : next('/');
          }
        },
        {
          path: "/recharge-management",
          name: "RechargeManagement",
          component: () => import("@renderer/views/nocode/views/workbench/rechargeManagement/WorkbenchRechargeManagement.vue"),
        },
        {
          path: "/organize",
          name: "Organize",
          component: () => import("@renderer/views/nocode/views/workbench/organize/WorkbenchOrganize.vue"),
        },
        {
          path: "/process",
          name: "Process",
          component: () => import("@renderer/views/nocode/views/workbench/process/WorkbenchProcess.vue"),
        },
        {
          path: "/view/data/:token",
          name: "InnerRowShare",
          component: () => import("@renderer/views/nocode/views/editor/components/InnerRowShareViewer.vue"),
        },
        {
          path: "/share/data/:token",
          name: "PublicRowShare",
          meta: {
            isPublicRowShare: true,
          },
          component: () => import("@renderer/views/nocode/views/editor/components/PublicRowShareViewer.vue"),
        },
        {
          path: "/app/:nocodeId/access-denied",
          name: "NocodeAccessDenied",
          component: () => import("@renderer/views/nocode/views/viewer/NocodeAccessDenied.vue"),
        },
        {
          path: "/app/:nocodeId/edit/",
          component: () => import("@renderer/views/nocode/views/editor/NocodeEditor.vue"),
          name: "NocodeEditor",
          meta: {
            hideWorkbenchAi: true,
          },
          beforeEnter: async (to, from, next) => {
            const nocodeId = to.params.nocodeId as string;
            const canEdit = await requestNocodeRoutePermission(`/project/can-editor-nocode?nocodeId=${nocodeId}`);
            if (canEdit === true) {
              next();
            } else if (canEdit === false) {
              await handleNocodeRouteDenied(nocodeId, "edit", next);
            } else {
              ElMessage.error(i18next.t("nocodeRouter.permissionRequestFailed"));
              next(false);
            }
          }
        },
        {
          path: "/app",
          component: () => import("@renderer/views/nocode/views/viewer/NocodeIndex.vue"),
          children: [
            {
            path: "/app/:nocodeId",
            name: "NocodeHome",
            component: () => import("@renderer/views/nocode/views/viewer/NocodeHome.vue"),
            beforeEnter: async (to, from, next) => {
                const nocodeId = to.params.nocodeId as string;
                const canView = await requestNocodeRoutePermission(`/project/can-view-nocode?nocodeId=${nocodeId}`);
                if (canView === true) {
                  next();
                } else if (canView === false) {
                  await handleNocodeRouteDenied(nocodeId, "view", next);
                } else {
                  ElMessage.error(i18next.t("nocodeRouter.permissionRequestFailed"));
                  next(false);
                }
              }
            },
          ]
        },
        {
          path: "/app/:nocodeId/setting",
          name:"NocodeViewSetting",
          component: () => import("@renderer/views/nocode/views/viewer/NocodeViewSetting.vue"),
          beforeEnter: async (to, from, next) => {
            const nocodeId = to.params.nocodeId as string;
            const canEdit = await requestNocodeRoutePermission(`/project/can-editor-nocode?nocodeId=${nocodeId}`);
            if (canEdit === true) {
              next();
            } else if (canEdit === false) {
              await handleNocodeRouteDenied(nocodeId, "edit", next);
            } else {
              ElMessage.error(i18next.t("nocodeRouter.permissionRequestFailed"));
              next(false);
            }
          }
        },
      ],
    },
    {
      path: "/oa/app/:nocodeId",
      name: "NocodeOaTodo",
      component: () => import("@renderer/views/nocode/views/editor/todo/NocodeOaTodoPage.vue"),
    },
    {
      path: "/app/:nocodeId/:layerId",
      name:"NocodeDataView",
      component: () => import("@renderer/views/nocode/views/viewer/NocodeDataView.vue"),
      beforeEnter: async (to, from, next) => {
        const nocodeId = to.params.nocodeId as string;
        const canView = await requestNocodeRoutePermission(`/project/can-view-nocode-layer`, to.params as Record<string, unknown>);
        if (canView === true) {
          next();
        } else if (canView === false) {
          await handleNocodeLayerRouteDenied(nocodeId, next);
        } else {
          ElMessage.error(i18next.t("nocodeRouter.permissionRequestFailed"));
          next(false);
        }
      }
    },
    {
      path: "/nocode/form",
      name: "NocodeForm",
      component: () => import("@renderer/views/nocode/components/NocodeForm.vue")
    },
    {
      path: "/server",
      name: "Server",
      component: () => import('@renderer/views/nocode/NocodeView.vue'),
      beforeEnter: () => env.inClient() || __IS_SERVER__,
    },
    {
      path: "/chat/:chatId",
      name: "Chat",
      component: () => import("@renderer/views/nocode/views/workbench/AI/Chat.vue"),
      beforeEnter: async (to, from, next) => {
        const chatId = to.params.chatId as string;
        const isValid = await axios.post(`/ai/share/ping`, { token: chatId }).then(() => true).catch(() => false);
        if (isValid) {
          next();
        }
      }
    },
    {
      path: "/signature/handwritten",
      name: "HandwrittenSignaturePage",
      component: () => import("@renderer/views/nocode/views/mobile/HandwrittenSignaturePage.vue")
    },
    {
      path: "/preview/:type/:nocodeId/:pageId",
      name: "NocodePreview",
      component: () => import("@renderer/views/nocode/views/editor/components/NocodeViewer.vue")
    },
    {
      path: "/view/:type/:nocodeId/:pageId",
      name: "NocodePageView",
      component: () => import("@renderer/views/nocode/views/editor/components/NocodeInnerViewer.vue"),
      // beforeEnter: async (to, from, next) => {
        // const { type, nocodeId, pageId } = to.params;
        // if (!nocodeId || !pageId) return false;
        // const res = await axios.get(`/project/validate-share?type=${type}&nocodeId=${nocodeId}&projectId=${pageId}`).then(({data}) => data).catch(() => false);
        // if (res) next();
      // }
    },
    {
      path: "/share/:type/:nocodeId/:pageId",
      name: "NocodePageShare",
      meta: {
        isPublicShare: true,
      },
      component: () => import("@renderer/views/nocode/views/editor/components/NocodeViewer.vue"),
      beforeEnter: async (to, from, next) => {
        const { type, nocodeId, pageId } = to.params;
        if (!nocodeId || !pageId) return false;
        const res = await axios.get(`/project/validate-share?type=${type}&nocodeId=${nocodeId}&projectId=${pageId}`).then(({data}) => data).catch(() => false);
        if (res) next();
      }
    },
    {
      path: "/view/data/:token",
      name: "InnerRowShare",
      component: () => import("@renderer/views/nocode/views/editor/components/InnerRowShareViewer.vue"),
    },
    {
      path: "/share/data/:token",
      name: "PublicRowShare",
      meta: {
        isPublicShare: true,
        isPublicRowShare: true,
      },
      component: () => import("@renderer/views/nocode/views/editor/components/PublicRowShareViewer.vue"),
    },
    {
      path: "/share/query/:nocodeId/:tableUID",
      name: "PublicQuery",
      component: () => import("@renderer/views/nocode/views/editor/components/PublicQueryViewer.vue"),
      beforeEnter: async (to, from, next) => {
        const { nocodeId, tableUID } = to.params;
        if (!nocodeId || !tableUID) return false;
        const res = await axios.get(`/project/validate-public-query?nocodeId=${nocodeId}&tableUID=${tableUID}`)
          .then(({ data }) => data)
          .catch(() => false);
        if (res) {
          next();
        }
      }
    },
    {
      path: "/login",
      name: "Login",
      component: () => import("@renderer/views/nocode/views/workbench/WorkbenchLogin.vue"),
    },
    ...otherRoutes,
  ]
}
