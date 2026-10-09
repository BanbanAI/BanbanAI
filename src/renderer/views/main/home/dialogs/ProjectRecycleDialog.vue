<template>
  <div class="recycle-container">
    <el-dialog :title="$t('projectRecycleDialog.dialogHeader')" :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" width="400px" top="30vh" 
      destroy-on-close :close-on-click-modal="false" @open="refreshDialog" @closed="clearDialog" draggable align-center>
      <div class="nocode-container">
        <workbench-nocode-box v-for="nocode in deteledNocodeList" :key="nocode.id"
          :nocode="nocode" :menuDisabled="true" :isEditable="false" :isDeletable="true"
          :class="[{'selected': isSelectedNocode(nocode) !== -1}]"
          @preview="handleSelectNocode(nocode)"
          ></workbench-nocode-box>
      </div>
      
      <template #footer>
        <div class="dialog-footer">
          <div class="footer-left-box" >
            <input class="select-all-checkbox" id="select-all-checkbox" type="checkbox" name="open-project" v-model="selectAllCheckedComp" @click="handleSelectAllNocode"/>
            <label class="label" for="select-all-checkbox">{{ $t("projectRecycleDialog.selectAllRecyleApp") }}</label>
          </div>
          <div class="footer-button-box">
            <el-button v-show="selectedNocodeList.length" type="default" @click="handleRestore" :loading="btnLoading" >{{ $t("projectRecycleDialog.restoreRecyleApp") }}</el-button>
            <el-button v-show="!selectedNocodeList.length" type="primary" @click="handleClear" :loading="btnLoading" >{{ $t("projectRecycleDialog.clearRecyleApp") }}</el-button>
            <el-button v-show="selectedNocodeList.length" type="danger" @click="handleCompleteDetele" :loading="btnLoading" >{{ $t("projectRecycleDialog.completeDeteleApp") }}</el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>

</template>

<script lang='ts' setup>
import { ref, computed } from 'vue';
import { NocodeMeta } from '@common/types/nocode';
import { ElMessage } from 'element-plus';
import axios from 'axios';

const props = defineProps<{
  modelValue: boolean,
  args?: string,
}>();

const emit = defineEmits(["closed", "created", "update:modelValue", "refresh"]);

const deteledNocodeList = ref<NocodeMeta[]>([]);
async function getDeteledNocodeList(){
  const res = await axios.get("/project/deleted-nocode-list").then(({ data }) => data).catch(({ response }) => {
    ElMessage.error(response.data.message);
    return [];
  });
  deteledNocodeList.value = res;
}

const selectedNocodeList = ref<NocodeMeta[]>([]);
const selectAllCheckedComp = computed<Boolean>({
  get: () => selectedNocodeList.value.length === deteledNocodeList.value.length,
  set: (val) => {}
});
// 检索传入应用是否存在于已选中数组中，存在return其对应索引，未找到则return -1
function isSelectedNocode(nocode: NocodeMeta) : number{
  return selectedNocodeList.value.indexOf(nocode);
}
function handleSelectNocode(nocode: NocodeMeta){
  const sIndex = isSelectedNocode(nocode);
  if(sIndex !== -1){
    selectedNocodeList.value.splice(sIndex, 1);
  }else{
    selectedNocodeList.value.push(nocode);
  }
}
function handleSelectAllNocode(){
  if(selectAllCheckedComp.value){
    selectedNocodeList.value = [];
  }else{
    selectedNocodeList.value = deteledNocodeList.value.map(item => item);
  }
}

async function handleRestore(){
  const ids = selectedNocodeList.value.map(item => item.id);
  const res = await axios.post("/project/restore-nocode-list", { ids }).then(({ data }) => data).catch(({ response }) => {
    ElMessage.error(response.data.message);
    return [];
  });
  refreshDialog();
  emit("refresh");
}
async function handleClear(){
  const ids = deteledNocodeList.value.map(item => item.id);
  completeDeteleNocodeList(ids);
}
async function handleCompleteDetele(){
  const ids = selectedNocodeList.value.map(item => item.id);
  completeDeteleNocodeList(ids);
}

async function completeDeteleNocodeList(ids){
  const res = await axios.post("/project/complete-delete-nocode-list", { ids }).then(({ data }) => data).catch(({ response }) => {
    ElMessage.error(response.data.message);
    return [];
  });
  refreshDialog();
}

function refreshDialog(){
  selectedNocodeList.value = [];
  getDeteledNocodeList();
}
function clearDialog(){
  selectedNocodeList.value = [];
  deteledNocodeList.value = [];
}

const btnLoading = ref(false);

</script>
<style scoped lang='scss'>
.recycle-container {
  position: absolute;
  .nocode-container {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(144px, 1fr));
    gap: 16px;
    padding: 16px;
    background-color: #F5F6F7;
    height: 50vh;
    overflow: auto;
  }
  .dialog-footer{
    display: flex;
    justify-content: space-between;
    .footer-left-box{
      display: flex;
      justify-content: space-around;
      align-items: center;
      label{
        font-size: 12px;
        margin-left: 8px;
      }
    }
  }
  :deep(.el-dialog) {
    width: 70%;
    max-height: 70%;
    font-weight: 400;
    padding-top: 8px;
    background-color: white;
    .el-dialog__header{
      display: flex;
      justify-content: center;
      padding: 0px;
      margin-bottom: 32px;
      .el-dialog__title{
        font-size: 14px;
      }
      &::after{
        content: "";
        display: block;
        position: absolute;
        top: 40px;
        width: 100%;
        height: 1px;
        left: 0px;
        background-color: #D9D9D9;
      }
    }
  }
}
</style>