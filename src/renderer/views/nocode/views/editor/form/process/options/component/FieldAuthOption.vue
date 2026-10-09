<template>
  <div class="field-auth-option"  v-if="filteredFields.length != 0">
    <!-- <el-input
      v-model="searchValue"
      size="small"
      :prefix-icon="Search"
      placeholder="搜索字段"
      class="search-input"
      clearable
    /> -->
    <div class="auth-table">
      <!-- <div class="auth-row auth-header">
        <span class="field-name">字段</span>
        <span class="check-title">可见</span>
        <span class="check-title" v-if="editable || true">可编辑</span>
      </div> -->
      <div class="auth-row all-select-row">
        <span class="field-name">{{ $t('FieldAuthOption.formField') }}</span>
        <el-checkbox
          v-model="selectAll.visible"
          :style="{'margin-right': !props.isNotify ? '10px' : '5px'}"
          :indeterminate="hasSelect.visible && !selectAll.visible"
          @change="handleSelectAll('visible')"
          :label="$t('FieldAuthOption.visible')"
        />
        <el-checkbox
          v-model="selectAll.editable"
          class="check-box"
          v-if="!props.isNotify"
          :indeterminate="hasSelect.editable && !selectAll.editable"
          @change="handleSelectAll('editable')"
          :label="$t('FieldAuthOption.editable')"
        />
        <el-checkbox
          v-model="selectAll.required"
          class="check-box"
          v-if="!props.isNotify"
          :indeterminate="hasSelect.required && !selectAll.required"
          @change="handleSelectAll('required')"
          :label="$t('FieldAuthOption.required')"
        />
      </div>
      <div
        v-for="item in filteredFields"
        :key="item.id"
        class="auth-row"
      >
        <div class="field-name" :title="item.name" :style="{paddingLeft: Math.min(item.path.length, 4) * 20 + 'px'}">
          {{ item.name }}{{ isTitleBar(item.id) ? $t('FieldAuthOption.titleBar') : '' }}
          <el-tooltip v-if="item.designHidden" :content="$t('FieldAuthOption.designHiddenPermissionTip')" placement="top">
            <el-icon class="field-design-hidden-warning"><i-ven-icon-info /></el-icon>
          </el-tooltip>
          <el-tooltip v-if="item.designRequired" placement="top">
            <template #content>
              <span style="white-space: pre-line">{{ $t('FieldAuthOption.designRequiredPermissionTip') }}</span>
            </template>
            <el-icon class="field-design-required-warning"><i-ep-warning /></el-icon>
          </el-tooltip>
        </div>
        <el-checkbox
          :model-value="item.visible"
          @update:model-value="handleSelectVisible(item, $event as boolean)"
          :style="{'margin-right': !props.isNotify ? '10px' : '5px'}"
          @change="(val) => changeSubFieldVisible(val, item)"
        />
        <el-checkbox
          :model-value="item.editable"
          @update:model-value="handleSelectEditable(item, $event as boolean)"
          class="check-box"
          v-if="!props.isNotify"
          @change="(val) => changeSubFieldEditable(val, item)"
        />
        <el-checkbox
          :model-value="item.required"
          @update:model-value="handleSelectRequired(item, $event as boolean)"
          class="check-box"
          v-if="!props.isNotify"
          :disabled="!item.editable"
          @change="(val) => changeSubFieldRequired(val, item)"
        />
      </div>
    </div>
  </div>
  <div v-else class="empty-state">
    <el-icon class="icon">
      <i-ven-nocode-checkbox-empty/>
    </el-icon>
    <span>
      {{ $t('FieldAuthOption.addFieldFirst') }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, inject, nextTick } from 'vue';
import { DefinedOptionWithParsedType } from '@renderer/b2/types';
import { GET_OPTION_VALUE, UPDATE_OPTION } from '@renderer/b2/inject';
import { useFormElementsInfo, useFormFields, useFormOption } from '@renderer/views/nocode/views/editor/form/hooks';
import { equals } from '@common/utils/object';
import { FieldAuthValue, FormElementInfo } from '@common/types/nocode';
import { Field } from "@common/types/project";
type AuthField = {
  id: string;
  name: string;
  visible: boolean;
  editable: boolean;
  required: boolean;
  designHidden: boolean;
  designRequired: boolean;
  path?: string[];
}

const props = withDefaults(defineProps<{
  option: DefinedOptionWithParsedType,
  isNotify?: boolean,
  isReportData?: boolean,
  targetFields?: Field[],
  targetFormElementsInfo?: FormElementInfo[],
  requiredValue?: Record<string, boolean>,
  targetRequiredMap?: Record<string, boolean>,
}>(),{
  isNotify: false,
  isReportData: false,
})
const emit = defineEmits<{
  (event: 'update:requiredValue', value: Record<string, boolean>): void,
}>();
const updateOption = inject(UPDATE_OPTION);
const getOptionValue = inject(GET_OPTION_VALUE);
const formFields = useFormFields();
const formElementsInfo = useFormElementsInfo();
const formOption = useFormOption();
type FormWidgetSoul = {
  uid?: string;
  options?: {
    'is-hidden'?: boolean;
    required?: boolean;
    'required-mode'?: 'off' | 'on' | 'condition';
  };
  widgets?: FormWidgetSoul[];
};
const hiddenFieldUIDSet = computed(() => {
  const result = new Set<string>();
  if (props.isReportData) return result;

  const visit = (widgets: FormWidgetSoul[] = []) => {
    for (const widget of widgets) {
      if (widget?.uid && widget.options?.['is-hidden'] === true) result.add(widget.uid);
      visit(widget?.widgets || []);
    }
  };
  visit(formOption.value?.widget?.widgets || []);
  return result;
});

const fields = ref<AuthField[]>([]);
const searchValue = ref('');
const optAuth = computed(() => getOptionValue());
const isSelectAll = computed(() => optAuth.value === "all");
const isInitializingFields = ref(false);

const isTitleBar = (uid) => {
  const element = (props.isReportData ? props.targetFormElementsInfo : formElementsInfo.value)?.find(info => info.uid === uid);
  return element?.type === 'widget.form.titleBar';
}

const designRequiredMap = computed(() => {
  if (props.isReportData) {
    return props.targetRequiredMap || {};
  }

  const requiredMap: Record<string, boolean> = {};
  const visit = (widgets = []) => {
    widgets.forEach((widget: any) => {
      if (widget?.uid) {
        const requiredMode = widget.options?.['required-mode'];
        requiredMap[widget.uid] = requiredMode
          ? requiredMode === 'on' || requiredMode === 'condition'
          : widget.options?.required === true;
      }
      if (Array.isArray(widget?.widgets) && widget.widgets.length) {
        visit(widget.widgets);
      }
    });
  };

  visit(formOption.value?.widget?.widgets || []);
  return requiredMap;
});

const resolveRequiredValue = (fieldUid: string, sourceField?: Field) => {
  if (props.requiredValue && Object.prototype.hasOwnProperty.call(props.requiredValue, fieldUid)) {
    return !!props.requiredValue[fieldUid];
  }
  if (sourceField?.uid && props.requiredValue && Object.prototype.hasOwnProperty.call(props.requiredValue, sourceField.uid)) {
    return !!props.requiredValue[sourceField.uid];
  }
  return false;
}

const init = () => {
  const result = ((props.isReportData ? props.targetFormElementsInfo : formElementsInfo.value) || []).map(info => {
    let auth = optAuth.value?.[info.uid];
    const field = props.isReportData ? props.targetFields?.find(field => field.meta?.uid === info.uid) : formFields.value.find(field => field.meta?.uid === info.uid);
    if (!auth && optAuth.value && field) {
      auth = optAuth.value?.[field.uid];
    }
    const visible = isSelectAll.value ? true : (auth === FieldAuthValue.VISIBLE || auth === FieldAuthValue.VISIBLE_EDITABLE);
    const editable = isSelectAll.value ? true : (auth === FieldAuthValue.VISIBLE_EDITABLE);
    const designHidden = hiddenFieldUIDSet.value.has(info.uid);
    const designRequired = !!designRequiredMap.value[info.uid];
    const required = resolveRequiredValue(info.uid, field);
    return {
      id: info.uid,
      name: info.name,
      visible,
      editable,
      required: visible && editable ? required : false,
      designHidden,
      designRequired,
      path: info.path,
    }
  });
  isInitializingFields.value = true;
  fields.value = result;
  nextTick(() => {
    isInitializingFields.value = false;
  });
}

// 权限数据初始化
watch(() => formElementsInfo.value, () => {
  nextTick(() => {
    init()
  })
}, { immediate: true, deep: true });

watch(() => props.targetFields, () => {
  nextTick(() => {
    init()
  })
}, { immediate: true, deep: true });

watch(() => props.targetFormElementsInfo, () => {
  nextTick(() => {
    init()
  })
}, { immediate: true, deep: true });

watch(() => optAuth.value, () => {
  nextTick(() => {
    init()
  })
}, { immediate: true, deep: true });

watch(() => props.requiredValue, () => {
  nextTick(() => {
    init()
  })
}, { immediate: true, deep: true });

const filteredFields = computed(() =>
  fields.value.filter(f => (f.name as string)?.includes(searchValue.value))
);

const hasSelect = computed(() => ({
  visible: fields.value.some(f => f.visible),
  editable: fields.value.some(f => f.editable),
  required: fields.value.some(f => f.required),
}));

const selectAll = computed(() => ({
  visible: fields.value.every(f => f.visible),
  editable: fields.value.every(f => f.editable),
  required: fields.value.every(f => f.required),
}));

// 同步规则：不可见 -> 不可编辑
watch(
  () => fields.value.map(f => f.visible),
  () => {
    fields.value.forEach(field => {
      if (!field.visible) {
        field.editable = false;
        field.required = false;
      }
      if (!field.editable) {
        field.required = false;
      }
    });
  },
  { deep: true }
);

const handleSelectAll = (key: 'visible' | 'editable' | 'required') => {
  const val = selectAll.value[key];
  fields.value.forEach(item => {
    item[key] = val;
    if ((key === 'editable' || key === 'required') && val) {
      item.visible = true;
    }
    if (key === 'required' && val) {
      item.editable = true;
    }
    if (key === 'visible' && !val) {
      item.editable = false;
      item.required = false;
    }
    if (key === 'editable' && !val) {
      item.required = false;
    }
  });
};

const handleSelectVisible = (authField: AuthField, value: boolean) => {
  authField.visible = value;
}

const handleSelectEditable = (authField: AuthField, value: boolean) => {
  authField.editable = value;
  if (value) authField.visible = true;
}

const handleSelectRequired = (authField: AuthField, value: boolean) => {
  if (!authField.editable && !value) {
    authField.required = false;
    return;
  }
  authField.required = value;
  if (value) {
    authField.visible = true;
    authField.editable = true;
  }
}

const changeSubFieldVisible = (val, authField: AuthField, isParent = false) => {
  const id = authField.id
  const parent = authField.path?.length ? authField.path?.[authField.path.length - 1] : null
  if(!isParent) {
    for(const field of fields.value) {
      if(field.path?.includes(id)) {
        field.visible = val
        if(!val) {
          field.editable = false
          field.required = false
        }
      }
    }
  }

  if(parent) {
    const parentField = fields.value.find(f => f.id === parent)
    if (!parentField) return
    if(val) {
      parentField.visible = val
    } else {
      const childFields = fields.value.filter(f => f.path?.[f.path.length - 1] === parent)
      if(childFields.every(f => !f.visible)) {
        parentField.visible = false
        parentField.required = false
      }
    }
    changeSubFieldVisible(val, parentField, true)
  }
}

const changeSubFieldEditable = (val, authField: AuthField, isParent = false) => {
  const id = authField.id
  const parent = authField.path?.length ? authField.path?.[authField.path.length - 1] : null
  if(!isParent) {
    for(const field of fields.value) {
      if(field.path?.includes(id)) {
        field.editable = val
        if(val) {
          field.visible = true
        } else {
          field.required = false
        }
      }
    }
  }

  if(parent) {
    const parentField = fields.value.find(f => f.id === parent)
    if (!parentField) return
    if(val) {
      parentField.editable = true
      parentField.visible = true
    } else {
      const childFields = fields.value.filter(f => f.path?.[f.path.length - 1] === parent)
      if(childFields.every(f => !f.editable)) {
        parentField.editable = false
        parentField.required = false
      }
    }
    changeSubFieldEditable(val, parentField, true)
  }
}

const changeSubFieldRequired = (val, authField: AuthField, isParent = false) => {
  const id = authField.id
  const parent = authField.path?.length ? authField.path?.[authField.path.length - 1] : null
  if(!isParent) {
    for(const field of fields.value) {
      if(field.path?.includes(id)) {
        field.required = val
        if(val) {
          field.visible = true
          field.editable = true
        }
      }
    }
  }

  if(parent) {
    const parentField = fields.value.find(f => f.id === parent)
    if (!parentField) return
    if(val) {
      parentField.required = true
      parentField.visible = true
      parentField.editable = true
    } else {
      const childFields = fields.value.filter(f => f.path?.[f.path.length - 1] === parent)
      if(childFields.every(f => !f.required)) {
        parentField.required = false
      }
    }
    changeSubFieldRequired(val, parentField, true)
  }
}

// const syncOption = () => {
//   if (isSelectAll.value && !isModify.value) return;
//   const result = fields.value.reduce((acc, item) => {
//     if (item.visible || item.editable) {
//       acc[item.id] = item.editable ? FieldAuthValue.VISIBLE_EDITABLE : FieldAuthValue.VISIBLE;
//     }
//     return acc;
//   }, {} as Record<string, number>);

//   updateOption(result);
// };

const syncOption = () => {
  let isAll = true
  const result = {}
  for(const field of fields.value) {
    if(!field.visible || (!field.editable && !props.isNotify)) {
      isAll = false
    }
    if(field.visible) {
      result[field.id] = FieldAuthValue.VISIBLE
    }
    if(field.editable) {
      result[field.id] = FieldAuthValue.VISIBLE_EDITABLE
    }
  }
  return isAll ? 'all' : result
};

const syncRequiredOption = () => {
  return fields.value.reduce<Record<string, boolean>>((prev, field) => {
    prev[field.id] = !!field.required;
    return prev;
  }, {});
}

watch(
  () => fields.value.map(f => ({ v: f.visible, e: f.editable, r: f.required })),
  (value, oldValue) => {
    if (isInitializingFields.value || equals(value, oldValue)) return;
    updateOption(syncOption());
    emit('update:requiredValue', syncRequiredOption());
  },
  { deep: true, flush: 'post' }
);
</script>

<style scoped lang="scss">
.field-auth-option {
  width: 100%;
  color: var(--text-color-regular);
  overflow: hidden;
  border-radius: 4px;
  border: 1px solid var(--border-color);

  .search-input {
    width: 100%;
    margin-bottom: 12px;
  }

  .auth-table {
    width: 100%;
    font-size: 12px;
  }

  .auth-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    
    font-weight: 400;
    
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0%;
    padding: 0px 16px;


    &.all-select-row {
      background-color: var(--bg-color-overlay);
      border-bottom: 1px solid var(--border-color);
    }
  }

  .auth-header {
    margin-bottom: 6px;
    font-weight: 700;
  }

  .field-name {
    flex: 1;
    min-width: 0;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .field-design-hidden-warning {
    margin-left: 4px;
    vertical-align: -2px;
    color: #165DFF;
  }

  .field-design-required-warning {
    margin-left: 4px;
    vertical-align: -2px;
    color: var(--el-color-warning);
  }

  .el-checkbox {
    margin-left: auto;
    width: 120px;
  }

  .check-title {
    text-align: center;
  }
}

.empty-state {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 15px 0px;

  .icon {
    font-size: 120px;
    color: #cecece9a;
  }

 span {
    font-size: 14px;
    color: #7b808aa8;
  }
}
</style>
