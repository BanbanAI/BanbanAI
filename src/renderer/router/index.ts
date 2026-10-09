import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'
import { getNocodeRoutes } from './nocode';
import { serverBeforeEach, workbenchBeforeEach } from './guard';
import { routes as serverRoutes } from "./server";
import { env } from "@renderer/utils/env";

const getRoutes = (): Array<RouteRecordRaw> => {
  const _routes = getNocodeRoutes();
  if (__IS_SERVER__) _routes.push(...serverRoutes);
  return _routes;
}

const router = createRouter({
  history: createWebHashHistory(),
  routes: getRoutes(),
})

router.beforeEach(async (to, from) => {
  if (env.inClient()) {
    if (!to.path.includes("/server")) return "/server";
    return true;
  }
  if (__IS_SERVER__) {
    const res = await serverBeforeEach(to, from)
    if (res !== void 0) return res;
  }
  return await workbenchBeforeEach(to, from);
})

export default router
