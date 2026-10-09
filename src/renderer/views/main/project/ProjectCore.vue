<template>
  <vn-stack class="sheets" v-model="activeBoardId">
    <div class="layers" ref="layersDom" :class="{ 'webshare': webshare }">
      <vn-stack-layer v-for="board in project?.boards || []" :key="board.uid" :name="board.uid" class="screen-board">
        <b2-board :board="allBoard.boards[board.uid]" :isViewing="webshare" type="normal" />
        <slot name="empty" v-if="!board.widgets?.length"></slot>
      </vn-stack-layer>
    </div>
    <slot name="tabs" key="tabs"></slot>
  </vn-stack>
</template>

<script lang="ts" setup>
import { ref, inject, watch, nextTick, onUnmounted } from "vue";
import { ProjectBody } from "@common/types/project";
import { ACTIVE_BOARD_ID, ALL_BOARD, IS_PROJECT_READY } from "@renderer/types/inject";
import { useMemory } from "@renderer/hooks/useMemory";
import { measureLog } from "@renderer/b2/utils/measure";


const emit = defineEmits<{
  (event: "menuClicked", type: string, paths?: string[])
}>();

const props = withDefaults(defineProps<{
  project: ProjectBody,
  webshare?: boolean,
  playBarVisible?: boolean,
  isEditor?: boolean,
}>(), {
});

const allBoard = inject(ALL_BOARD);
const activeBoardId = inject(ACTIVE_BOARD_ID);
const isProjectReady = inject(IS_PROJECT_READY);

let mediaStream: MediaStream;


const layersDom = ref(null);


const { memory, isSupported: isMemorySupported } = useMemory();
const memoryInfo = ref("");
watch(()=>memory.value, (newValue)=>{
  if (!isMemorySupported || !newValue) {
    return;
  }
  if (!newValue.v8HeapInfo) {
    memoryInfo.value = `${newValue.usedJSHeapSize} / ${newValue.totalJSHeapSize} / ${newValue.jsHeapSizeLimit} MB`;
  } else {
    const v8HeapInfo = newValue.v8HeapInfo;
    const offHeapUsedSize = newValue.usedJSHeapSize - v8HeapInfo.usedHeapSize;
    memoryInfo.value = `${v8HeapInfo.usedHeapSize} / ${v8HeapInfo.totalAvailableSize} / ${v8HeapInfo.heapSizeLimit} MB  ${offHeapUsedSize} / ${newValue.usedJSHeapSize} MB`;
  }
  // console.debug("内存: " + memoryInfo.value);
}, {deep: true});


onUnmounted(() => {
  const tracks = mediaStream?.getTracks?.() || [];
  tracks.forEach(track => track.stop());
})

const stopForeBoardReadyWatch = watch(()=>{
  if(allBoard.foreBoard && !allBoard.foreBoard.isReady()){
    return false;
  }
  if(allBoard.backBoard && !allBoard.backBoard.isReady()){
    return false;
  }
  return true;
}, (value)=>{
  if (value) {
    if (allBoard.foreBoard) {
      allBoard.foreBoard.status.isForeBoardReady = true;
      allBoard.foreBoard.status.isBackBoardReady = true;
    }
    if (allBoard.backBoard) {
      allBoard.backBoard.status.isForeBoardReady = true;
      allBoard.backBoard.status.isBackBoardReady = true;
    }
    for(const key in allBoard.boards){
      allBoard.boards[key].status.isForeBoardReady = true;
      allBoard.boards[key].status.isBackBoardReady = true;
    }
    nextTick(()=>{
      stopForeBoardReadyWatch();
    });
  }
}, {immediate: true});

const stopProjectReadyWatch = watch(()=>{
  if(allBoard.foreBoard && !allBoard.foreBoard.isReady()){
    return false;
  }
  for(const key in allBoard.boards){
    if(!allBoard.boards[key].isReady()) return false;
  }
  if(allBoard.backBoard && !allBoard.backBoard.isReady()){
    return false;
  }
  return true;
}, (value)=>{
  if(value){
    //project ready之后取消watch
    nextTick(()=>{
      measureLog("loading", "project loading done");
      isProjectReady.value = true;
      stopProjectReadyWatch();
      if (allBoard.foreBoard) {
        allBoard.foreBoard.status.isProjectReady = true;
      }
      for(const key in allBoard.boards){
        allBoard.boards[key].status.isProjectReady = true;
      }
      if (allBoard.backBoard) {
        allBoard.backBoard.status.isProjectReady = true;
      }
    })
  }
}, {immediate: true})
</script>

<style scoped lang="scss">
.sheets {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;

  .layers {
    width: 100%;
    height: 100%;
    overflow: hidden;
    flex: auto;
    min-height: 0px;

    &.webshare{
      top: 0px;
      right: 0px;
      bottom: 0px;
      left: 0px;
      background: black;
    }

    .vn-stack-layer {
      width: 100%;
      height: 100%;
      transform-origin: 0 0;
    }

    .screen-board {
      pointer-events: none;
      opacity: 0;

      &.active {
        opacity: 1;
      }
    }
  }
}
</style>
