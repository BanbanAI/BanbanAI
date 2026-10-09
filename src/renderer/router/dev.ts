import { RouteRecordRaw } from "vue-router";

export const routes: Array<RouteRecordRaw> = [
  {
    path: "/dev/virtual-table/pivot",
    name: "RootVirtualTablePivotLab",
    component: () => import("@renderer/views/nocode/views/dev/VirtualTablePivotLabRoute.vue")
  },
]