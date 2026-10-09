import { TheWidget as Area, component as B2Area } from "@renderer/widgets/echarts/area";
export class AreaStack extends Area {
  get stack() {
    return true
  }
}
