<template>
  <div class="workbench-user-list-wrapper">
    <div class="workbench-user-list">
      <div class="user-header">
        <slot class="header=left"></slot>
        <el-button type="primary" class="user-add" @click="handleAdd" v-if="passportState.isMainAccount">
          <el-icon class="add" size="16"><i-workbench-add /></el-icon>
          {{ $t("WorkbenchAdminList.addAdmin") }}
        </el-button>
      </div>
      <div class="user-body">
        <workbench-user-table :data="contentList" :theme="'light'" isAdmin actionColumn>
          <template #action="scoped">
            <el-button link type="danger" @click="handleDelete(scoped.row)" v-if="scoped.row?.user !== ADMIN_USERNAME && passportState.isMainAccount">{{ $t("WorkbenchAdminList.remove") }}</el-button>
            <span v-else>-</span>
          </template>
        </workbench-user-table>
      </div>
    </div>
    <el-pagination class="page-change" v-model:current-page="currentPage" @current-change="currentChange" :page-size="pageSize" background layout="prev, pager, next" :total="totalNumber"/>
    <organize-manager-dialog 
      :tableList="{
        users: contentList,
        departments:[],
        roles: [],
        dynamic: []
      }" 
      ref="addAdminDialogRef" 
      @confirm="handleAdminConfirm"
      :isOnlyAdd="true"
    ></organize-manager-dialog>
    <workbench-dialog class="delete-dialog" v-model="deleteDialog" :title="$t('WorkbenchAdminList.delAdmin')" width="480px">
      <template #content>
        <div class="delete-dialog-content">
          <p>{{ $t("WorkbenchAdminList.confirmDel") }}</p>
        </div>
      </template>
      <template #button>
        <el-button class="quit" @click="deleteDialog=false">{{ $t("WorkbenchAdminList.cancel") }}</el-button>
        <el-button class="confirm" type="primary" @click="deleteStaff">{{ $t("WorkbenchAdminList.confirm") }}</el-button>
      </template>
    </workbench-dialog>
  </div>
</template>

<script setup lang='ts'>
import { NOCODE_ID, ORGANIZE_UTIL } from '@renderer/types';
import { ref, watch, inject, computed } from 'vue';
import { ADMIN_USERNAME } from '@common/types/account';
import { usePassportStore } from '@renderer/stores';

const passportState = usePassportStore();
const organizeUtil = inject(ORGANIZE_UTIL);
const nocodeId = inject(NOCODE_ID);

interface Staff {
  id: string;
  user:string;
  realname: string;
  roles: Array<string>;
  departments: Array<string>;
  phone: string;
  email: string;
}
// 定义 props
const props = defineProps<{
  contentList: Staff[];
  totalNumber: number;
  pageInfo: {
    page: number;
    pageSize: number;
  },
}>();
const emit = defineEmits<{
  (e: 'updatePageInfo', page: number, pageSize: number): void;
}>();
const currentPage =ref(1);
const pageSize = ref(20);

watch(()=>props.pageInfo, ()=>{
  currentPage.value = props.pageInfo.page;
  pageSize.value = props.pageInfo.pageSize; 
}, { immediate: true });

const currentChange = async (newVal)=>{
  emit('updatePageInfo', currentPage.value, pageSize.value);
}

const addAdminDialogRef = ref(null);
const handleAdd = () => {
  addAdminDialogRef.value.show();
}


const handleAdminConfirm = async(value) => {
  const { users } = value;
  const userIds = users.map(item => item.id);
  await organizeUtil.setAdmins({
    ids: [...userIds],
  });
  emit('updatePageInfo', currentPage.value, pageSize.value);
}

let deleteRow = null;
const handleDelete = (row) => {
  deleteDialog.value =true;
  deleteRow = row;
}

const deleteDialog = ref(false)

const deleteStaff = async ()=>{
  await organizeUtil.removeUserAsAdmin({ id: deleteRow.id });
  deleteDialog.value = false;
  emit('updatePageInfo', currentPage.value, pageSize.value);
}
</script>
<style scoped lang='scss'>
.header-left{
  width: 320px;
  height: 32px;
}

.workbench-user-list-wrapper {
  width: 100%;
  height: 100%;
}
.workbench-user-list {
  width: 100%;
  height: calc(100% - 68px);
  background-color:#fff;
  border-radius: 8px;
  padding: 0;
}

.user-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
}

.user-add {
  width: 122px;
  height: 32px;
  border-radius: 4px;
  padding: 6px 16px 6px 12px;

  .add {
    margin-right: 4px;
  }
}

  .user-body{
    width: 100%;
    max-height: calc(100% - 40px);
    display: flex;
    flex-direction: column;

    .body-header{
      display: flex;
      height: 40px;
      justify-content: space-around;
      margin-top: 16px;
      margin-bottom: 8px;

      .header-item{
        text-align: center;
        width: 222.29px;
        padding: 8px 0;
        font-size: 16px;
        line-height: 24px;
      }
    }
    .body-line{
      width: 100%;
      border: 1px solid rgba(0, 0, 0, 0.1);
    }

    .body-body{
      width: 100%;
      display: flex;
      flex-direction: column;

      .content{
        justify-content: space-around;
        display: flex;
        margin-bottom: 8px;
        height: 36px;
        text-align: center;
        border-radius: 4px; 

        &:hover{
          background-color: rgba(245, 245, 247, 1);
        } 

        p{
          width: 222.29px;
          font-size: 14px;
          line-height: 20px;
          text-align: center;
          padding: 8px;
        }

        .editor{
          width: 222.29px;
          padding: 8px;
          .el-icon.delete-icon{
            margin-left: 10px;
          }

          svg{
            width: 16px;
            cursor: var(--cursor-pointer);
          }
        }   
      }        
    } 
  }
  .dialog-content{
    width: 50%;
    padding: 0 32px;
    display: flex;
    flex-direction: column;
    overflow: visible;

    p{
      font-size: 16px;
      line-height: 24px;
      font-weight: 500;
      margin-bottom: 8px;
    }
  }

  .dialog-content-item {
    min-height: 72px;    
    margin-top: 32px;

    :deep(.el-input__wrapper){
      min-height: 40px;
      font-size: 16px;
      line-height: 24px;
      border-radius: 8px;
      background-color: rgba(245, 245, 247, 1); 
      box-shadow:none;
      padding: 8px;
      border: 1px solid rgba(30, 30, 30, 0.2);

      .el-input__inner{
       height: 24px;
      }

      .el-input__inner::placeholder{
        font-size: 16px;
      } 

      &:hover{
        border:1px solid var(--color-primary);
      }
    }

    :deep(.el-cascader){
      width: 100%;

      .el-input__wrapper{
        box-shadow: none;

      &:hover{
        border:1px solid var(--color-primary);
        }
      }

      .el-cascader-panel{
        background-color: #fff;
      }

      .el-popper{
        background-color: #fff;
      }  

      .el-input__inner::placeholder{
      font-size: 16px;
      }
    }
  }

.content-right{
  height: 280px;
}

.pop-list{
  background-color: #fff;
}

.page-change {
  width: 100%;
  height: 36px;
  margin-top: 16px;
  display: flex;
  justify-content: center;

  --el-pagination-button-bg-color: #fff;
  --el-disabled-bg-color: #fff;
  --el-color-primary: var(--color-primary);
  --el-pagination-button-color: rgba(20, 20, 20, 1);

  :deep(.el-pager) {
    li {
      border-radius: 4px;

      &:hover {
        border: 1px solid var(--color-primary);
      }
    }
  }
}

.delete-dialog{
  width: 480px;
}

.delete-dialog-content{
  width: 100%;
  padding: 24px 24px 0 24px;
  font-size: 14px;
}
</style>
