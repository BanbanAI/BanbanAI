<template>
  <b2-axis></b2-axis>
</template>

<script lang="ts" setup>
import { TheWidget as Axis, component as B2Axis } from "@renderer/widgets/echarts/axis";
import { useWidget } from "@renderer/b2/types";
import { Line } from "./line";
import { onMounted ,watch} from "vue"
import { equals } from "@common/utils/object";
const line = useWidget<Line>();
onMounted(()=>{
   watch(()=>{
    let indexes = line.getArrayClusterIndexes(["flow-light-cluster"]);
    let flowLightOpt = [];
    line.getSeries().forEach((item, index) => {
        let flowLightDotShape = line.getOption<string>(["flow-light-cluster", indexes[index], "flow-light-dot-shape-type"]);
        flowLightOpt.push({flowLightDotShape})
      }
    );
    return flowLightOpt
   },(val,oldValue)=>{
     if(!equals(val,oldValue)){
        let indexes = line.getArrayClusterIndexes(["flow-light-cluster"]);
        line.getSeries().forEach((item, index) => {
          if(val[index].flowLightDotShape !== oldValue[index]?.flowLightDotShape){
              line.setOption(["flow-light-cluster",indexes[index],"flow-light-select"], false, false);  //先取消
              setTimeout(()=>{
                line.setOption(["flow-light-cluster",indexes[index],"flow-light-select"], true, false);
              },300)
          }
      }
    );
    }
   },{deep:true})
})
</script>

<style lang="scss" scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>
