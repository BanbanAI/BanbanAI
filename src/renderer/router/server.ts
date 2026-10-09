import { RouteRecordRaw } from "vue-router";


export const routes: Array<RouteRecordRaw> = [
  {
    path: "/configuration",
    name: "Configuration",
    component: () => import("@renderer/views/server/Configuration.vue"),
  }
]