<template>
  <div class="member-range">
    <div class="button-box">
      <div class="radio">
        <el-radio-group v-model="dataComp.rangeType">
          <el-radio :value="PermissionRangeType.ALL" size="small">{{ $t('MemberRange.allViewMember') }}</el-radio>
          <el-radio :value="PermissionRangeType.CUSTOM" size="small">{{ $t('MemberRange.custom') }} </el-radio>
        </el-radio-group>
      </div>
      <div 
        class="clear-button" 
        v-if="dataComp.rangeType === PermissionRangeType.CUSTOM"
        @click="handleClear()"
      >
        <el-icon>
          <i-ep-delete></i-ep-delete>
        </el-icon>
        <span>
          {{ $t('MemberRange.clear') }}
        </span>
      </div>
      <div class="add-button" v-if="dataComp.rangeType === PermissionRangeType.CUSTOM" @click="handleClickAdd">
        <span>
          {{ $t('MemberRange.setRange') }}
        </span>
      </div>
    </div>

    <div class="tag-container" v-if="dataComp.rangeType === PermissionRangeType.CUSTOM">
      <span v-if="isEmpty(dataComp.range.departments) && isEmpty(dataComp.range.roles) && isEmpty(dataComp.range.users)">
        {{ $t('MemberRange.emptyAddFirst') }}<span class="add-text" @click="handleClickAdd">{{ $t('MemberRange.add') }}</span>
      </span>
      <div class="tag-box" v-else>
        <el-tag closable v-for="tag in dataComp.range.departments" @close="closeTag(tag, 'departments')">
          {{ organizeUtil.departments.find(item => item.id === tag).name }}
        </el-tag>
        <el-tag closable v-for="tag in dataComp.range.roles" @close="closeTag(tag, 'roles')">
          {{ organizeUtil.roles.find(item => item.id === tag).name }}
        </el-tag>
        <el-tag closable v-for="tag in dataComp.range.users" @close="closeTag(tag, 'users')">
          {{ getUserName(tag) }}
        </el-tag>
      </div>
    </div>
    <div class="tips" v-if="dataComp.rangeType === PermissionRangeType.CUSTOM">
      <el-icon>
        <i-ep-warning></i-ep-warning>
      </el-icon>
      {{ $t('MemberRange.adminAuthTip') }}
    </div>

    <nocode-user-select-dialog ref="userSelectRef" @save="handleSave"></nocode-user-select-dialog>
  </div>
</template>

<script setup lang="ts">
import { MemberRange, PermissionRange, PermissionRangeType } from '@common/types/nocode';
import { ORGANIZE_UTIL } from '@renderer/types';
import { deepClone, isEmpty } from '@common/utils/object';
import { ElMessage } from 'element-plus';
import { computed, inject, ref, shallowRef } from 'vue';
import i18next from 'i18next';
import { getUserDisplayName } from '@renderer/utils/other';

const organizeUtil = inject(ORGANIZE_UTIL);

const props = defineProps<{
  data: MemberRange,
}>();

const emit = defineEmits(['update:data']);

const dataComp = computed<MemberRange>({
  get: () => props.data,
  set: (val) => emit('update:data', val),
});

const userSelectRef = shallowRef(null);

function handleClear() {
  dataComp.value.range = {
    departments: [],
    roles: [],
    users: [],
  };
  ElMessage.success(i18next.t('MemberRange.clearSuccess'));
}

function closeTag(tag, type) {
  dataComp.value.range[type] = dataComp.value.range[type].filter(item => item != tag);
}

const getUserName = (id: string) => {
  return getUserDisplayName(organizeUtil.findUserById(id), id);
}

function handleClickAdd() {
  let data: PermissionRange = deepClone(dataComp.value.range);
  userSelectRef.value.show(i18next.t('MemberRange.rangeSet'), data);
}

function handleSave(value: PermissionRange) {
  dataComp.value.range = deepClone(value);
}
</script>

<style lang="scss" scoped>
.member-range{
  width: 100%;
}
.button-box {
  display: flex;
  height: 32px;
  position: relative;
  justify-content: flex-end;
  margin-bottom: 12px;

  .radio {
    position: absolute;
    bottom: 0px;
    left: 0px;
  }

  .add-button {
    padding: 0px 16px 0px 12px;
    display: flex;
    align-items: center;
    border-radius: 4px;
    border: 1px solid var(--color-primary);
    color: var(--color-primary);
    gap: 2px;
    cursor: pointer;
    transition: all 0.3s ease;

    &:hover {
      opacity: 0.6;
    }
  }

  .clear-button {
    padding: 0px 16px 0px 12px;
    display: flex;
    align-items: center;
    border-radius: 4px;
    border: 1px solid var(--border-color);
    color: var(--text-color-regular);
    gap: 2px;
    cursor: pointer;
    margin-right: 8px;
    transition: all 0.3s ease;

    
    &:hover {
      opacity: 0.6;
    }
  }

  .el-icon {
    font-size: 16px;
  }
}

.tag-container {
  min-height: 216px;
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-color-secondary);

  .add-text {
    color: var(--el-color-primary);
    cursor: pointer;
    
    &:hover {
      text-decoration: underline;
    }
  }

  .tag-box {
    width: 100%;
    min-height: 216px;
    padding: 8px;


    span {
      margin: 4px;
    }

    :deep(.el-tag) {
      transition: none !important;
      animation: none !important;
      background-color: var(--bg-color-overlay); 
      border: none;
      height: 32px;
      color: var(--text-color-regular);

      .el-tag__close {
        color: var(--text-color-secondary);
        transition: all 0.3s ease;

        &:hover {
          background-color: var(--bg-color-hover);
        }
      }
    }
  }
}

.tips {
  display: flex;
  align-items: center;
  
  font-weight: 400;
  
  font-size: 14px;
  line-height: 20px;
  letter-spacing: 0%;
  margin-top: 8px;
  color: var(--text-color-secondary);

  .el-icon {
    font-size: 16px;
    margin-right: 2px;
    padding-top: 1px;
  }
}
</style>
