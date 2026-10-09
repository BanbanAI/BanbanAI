<template>
  <div class="filter-widget-value-format">
    <el-config-provider :locale="locale">
      <template v-if="type === RuleFuncValue.RANGE">
        <div class="number-range" v-if="configurations?.subType === 'number'">
          <el-input-number :disabled="disabled" :controls="false" :model-value="getPercentValue(modelValue[0])" @update:model-value="emit('update:modelValue', [getNumberValue($event), modelValue[1]])" :placeholder="`最小值`">
            <template #suffix v-if="curSelectField?.meta?.extra?.isPercent">
              <span>%</span>
            </template>
          </el-input-number> ~
          <el-input-number :disabled="disabled" :controls="false" :model-value="getPercentValue(modelValue[1])" @update:model-value="emit('update:modelValue', [modelValue[0], getNumberValue($event)])" :placeholder="`最大值`">
            <template #suffix v-if="curSelectField?.meta?.extra?.isPercent">
              <span>%</span>
            </template>
          </el-input-number>
        </div>
        <el-date-picker :disabled="disabled" class="date-range" :value-format="'YYYY-MM-DD HH:mm:ss'" range-separator="~" v-else-if="configurations?.subType === 'date' || configurations?.subType === 'daterange'"
         :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" :format="datePickFormat" :start-placeholder="dropdownTipText" :end-placeholder="dropdownTipText"
          :type="rangeDateType"
        />
      </template>
      <template v-else-if="type === RuleFuncValue.DATE">
        <el-date-picker :disabled="disabled" :value-format="'YYYY-MM-DD HH:mm:ss'" :format="datePickFormat"
         :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" :placeholder="dropdownTipText"
          :type="dateType"
        />
      </template>
      <template v-else-if="type === RuleFuncValue.TIME">
        <el-time-picker :disabled="disabled" :value-format="'HH:mm:ss'" :format="timePickFormat"
         :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" :placeholder="dropdownTipText"
        />
      </template>
      <template v-else-if="type === RuleFuncValue.SELECT_MULTIPLE || type === RuleFuncValue.TAGS">
        <!-- <div :class="{ 'is-disabled-btn': disabled }" v-if="['department', 'account'].includes(configurations?.subType)" class="department-container" @click="handleShowOrganizeManageDialog" :style="{ color: modelValue?.length ? 'var(--color-primary)' : 'var(--el-color-text-2)' }">
          {{ modelValue?.length ? '已选择' : '选择' }}{{ configurations?.subType === 'department' ? '部门' : '成员' }}
        </div> -->
        <field-select
          :disabled="disabled"
          :model-value="selectOptions.length>0 ? modelValue : undefined"
          @update:model-value="emit('update:modelValue', $event)"
          :collapse-tags="true"
          :no-data-text="i18next.t('emptyData')"
          :multiple="true"
          :clearable="true"
          :options="selectOptions"
          :props="selectProps"
          :placeholder="dropdownTipText"
          v-if="widget.getSoul().type === 'widget.basic.filter'"
        >
        </field-select>
        <el-input-tag v-else :disabled="disabled" collapse-tags collapse-tags-tooltip tag-type="primary" filterable :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" :placeholder="`输入后回车添加值`" />
      </template>
      <template v-else-if="type === RuleFuncValue.ADDRESS">
        <el-tree-select :disabled="disabled" class="drop-down" ref="addressRef"
          :modelValue="modelValue"
          @update:model-value="emit('update:modelValue', $event)"
          lazy :load="loadNode" node-key="value"
          :render-after-expand="false"
          clearable filterable check-strictly
          :placeholder="dropdownTipText"
          :highlight-current="true" :show-path="true" :no-data-text="i18next.t('emptyData')" :props="{
            label: 'label',
            value: 'value',
            children: 'children',
            isLeaf: 'isLeaf',
          }">
        </el-tree-select>
      </template>
      <template v-else>
        <!-- <div :class="{ 'is-disabled-btn': disabled }" v-if="['department', 'account'].includes(configurations?.subType)" class="department-container" @click="handleShowOrganizeManageDialog" :style="{ color: modelValue?.length ? 'var(--color-primary)' : 'var(--el-color-text-2)' }">
          {{ modelValue?.length ? '已选择' : '选择' }}{{ configurations?.subType === 'department' ? '部门' : '成员' }}
        </div> -->
        <date-dynamic-filter-value-select class="dynamic-filter-select" :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" :append-to="'body'" :teleported="true" v-if="configurations?.subType === 'date' && type === RuleFuncValue.STRING">
        </date-dynamic-filter-value-select>
        <field-select
          :disabled="disabled"
          :model-value="selectOptions.length>0 ? modelValue : undefined"
          @update:model-value="emit('update:modelValue', $event)"
          :no-data-text="i18next.t('emptyData')"
          :clearable="true"
          :placeholder="dropdownTipText"
          :options="selectOptions"
          :props="selectProps"
          v-else-if="widget.getSoul().type === 'widget.basic.filter'"
        >
        </field-select>
        <el-input :disabled="disabled" :model-value="getPercentValue(modelValue)" @update:model-value="emit('update:modelValue', getNumberValue(Number($event)))" type="number" :placeholder="dropdownTipText" v-else-if="widget.getSoul().type === 'widget.basic.filter-input'&& type === RuleFuncValue.NUMBER">
          <template #suffix v-if="curSelectField?.meta?.extra?.isPercent">
            <span>%</span>
          </template>
        </el-input>
        <el-input :disabled="disabled" :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" :placeholder="dropdownTipText" v-else />
      </template>
    </el-config-provider>
    <!-- <teleport to="body">
      <organize-manager-dialog
        ref="organizeManageDialogRef"
        v-if="type === RuleFuncValue.SELECT || type === RuleFuncValue.SELECT_MULTIPLE"
        :isInWidget="true"
        :isShowQuick="false"
        :currentType="configurations?.subType === 'department' ? 'department' : 'member'"
        :dialogTitle="configurations?.subType === 'department' ? '选择部门' : '选择成员'"
        :multiple="type != RuleFuncValue.SELECT"
        @confirm="handleClosed"
        :tableList="tableList"
      ></organize-manager-dialog>
    </teleport> -->
  </div>
</template>

<script setup lang='ts'>
import { FormElementConfiguration, RuleFuncValue } from "@common/types/nocode";
import { getSystemColumnConfigurations } from "@common/utils/connection";
import { FormElement } from "@renderer/b2/controllers/form";
import { computed, inject, onMounted, reactive, ref, watch } from "vue";
import { DataFilter } from "./filter";
import { getChinaAddressData } from "@renderer/utils/township";
import i18next, { $t } from "@renderer/widgets/i18next";
import { elementPlusLocale as locale } from "@renderer/widgets/utils/elementPlusLocale";

const props = withDefaults(defineProps<{
  modelValue: any,
  type: RuleFuncValue,
  widget: DataFilter,
  disabled?: boolean,
}>(), {
  disabled: false
});

const emit = defineEmits<{
  (event: 'update:modelValue', value: any): void
}>();

const configurations = computed(() => {
  if (!curElement.value) {
    return getSystemColumnConfigurations(curSelectField.value?.meta?.name);
  }
  return curElement.value?.getConfigurations();
});
const organizeUtil = ref({
  departments: [],
  users: [],
  roles: [],
  dynamic: [],
})
const organizeManageDialogRef = ref(null)

const curSelectField = computed(() => {
  if (!props.widget?.relationshipField?.linkageWidgets?.[0]) return null;
  const table = props.widget.getLinkageTable(props.widget.relationshipField.linkageWidgets[0]);
  return props.widget.getLinkageFieldByTable(table);
})

const curElement = computed(() => {
  return props.widget.relationshipElementTemp as FormElement;
})

// const handleClosed = (data) => {
//   let inputValue = []
//   if (configurations.value.subType === "department") {
//     inputValue = data.departments.map(item => item.id);
//   } else {
//     inputValue = data.users.map((user)=> user.id);
//   }
//   emit('update:modelValue', props.type === RuleFuncValue.SELECT ? inputValue.length ? inputValue[0] : '' : inputValue);
// }
const tableList = computed(() => {
  let value
  if(props.type !== RuleFuncValue.SELECT) {
    value = props.modelValue || [];
  } else {
    value = props.modelValue ? [props.modelValue] : [];
  }
  let inputValue = {
    departments: [],
    roles: [],
    users: [],
    dynamic: [],
  }
  if (configurations.value.subType === "department") {
    inputValue.departments = (value || []).map(item => organizeUtil.value.departments.find(department => department.id === item));
  } else {
    inputValue.users = (value || []).map(item => organizeUtil.value.users.find(user => user.id === item));
  }
  return inputValue
})

const dropdownTipText = computed(() => {
  return props.widget.dropdownTipText
})

// 数值转百分比值
const getPercentValue = (value: number) => {
  if (curSelectField.value?.meta?.extra?.isPercent) return value * 100;
  return value;
}
// 百分比值转数值
const getNumberValue = (value: number) => {
  if (curSelectField.value?.meta?.extra?.isPercent) return value / 100;
  return value;
}

const timePickFormat = computed(() => {
  if (curElement.value && (props.type === RuleFuncValue.TIME)) {
    return (curElement.value as any).format;
  }
})

const datePickFormat = computed(() => {
  if (curElement.value && (props.type === RuleFuncValue.DATE || (props.type === RuleFuncValue.RANGE && (configurations as FormElementConfiguration)?.subType === 'date'))) {
    return (curElement.value as any).getFormat();
  }
})

const rangeDateType = computed(() => {
  if (curElement.value.getOption("date-format") === 'datetime' || curElement.value.getOption("date-format") === 'datetimerange') {
    return 'datetimerange'
  } else if (curElement.value.getOption("date-format") === 'month' || curElement.value.getOption("date-format") === 'monthrange') {
    return 'monthrange'
  } else if (curElement.value.getOption("date-format") === 'year' || curElement.value.getOption("date-format") === 'yearrange') {
    return 'yearrange'
  } else {
    return 'daterange'
  }
})

const dateType = computed(() => {
  if (curElement.value.getOption("date-format") === 'datetime' || curElement.value.getOption("date-format") === 'datetimerange') {
    return 'datetime'
  } else if (curElement.value.getOption("date-format") === 'month' || curElement.value.getOption("date-format") === 'monthrange') {
    return 'month'
  } else if (curElement.value.getOption("date-format") === 'year' || curElement.value.getOption("date-format") === 'yearrange') {
    return 'year'
  } else {
    return 'date'
  }
})

const selectProps = {
  label: "label",
  value: "value",
  options: "get"
}
const cacheSelectOptions = reactive({});
const selectOptions = computed(() => {
  const columnId = curElement.value?.uid;
  if (cacheSelectOptions[columnId]) return cacheSelectOptions[columnId];
  return props.widget.relationshipDefaultOptions
});

const findNodeByValue = (data, value) => {
  for (const node of data) {
    if (node.value === value) {
      return node;
    }
    if (node.children) {
      const found = findNodeByValue(node.children, value);
      if (found) return found;
    }
  }
  return null;
};
const loadNode = async (node, resolve: (data) => void) => {
  const townshipData = await getChinaAddressData();
  if (!node?.label) {
    resolve(townshipData.map(({ children, ...rest }) => ({
      ...rest,
      isLeaf: !children || children.length === 0
    })));
  } else if (node.data?.value) {
    const match = findNodeByValue(townshipData, node.data.value);

    if (match && match.children) {
      resolve(match.children.map(({ children, ...rest }) => ({
        ...rest,
        isLeaf: !children || children.length === 0
      })));
    } else {
      resolve([]);
    }
  } else {
    resolve([]);
  }
};

// const handleShowOrganizeManageDialog = () => {
//   if (!props.disabled) {
//     organizeManageDialogRef.value.show();
//   }
// }
</script>

<style lang="scss" scoped>
.filter-widget-value-format {
  width: 100%;
  :deep(.el-input) {
    border-radius: 4px;
    .el-input__wrapper {
      border-radius: 4px;
    }
    .el-input__inner::-webkit-inner-spin-button {
      all: unset;
    }
  }

  .number-range {
    display: flex;
    align-items: center;
    column-gap: 4px;
    width: 100%;
    :deep(.el-input-number) {
      width: 100% !important;
      .el-input__wrappe {
        border-radius: 4px !important;
      }
    }
  }
  :deep(.el-date-editor--date) {
    width: 100%;
    border-radius: 4px;
  }
  :deep(.date-range) {
    width: 100%;
    border-radius: 4px;
  }
  :deep(.el-input-tag) {
    width: 100%;
    border-radius: 4px;
    .el-input-tag__inner {
      overflow: hidden;
      white-space: nowrap;
      flex-wrap: nowrap;
      justify-content: end;
    }
  }
  :deep(.el-select__wrapper) {
    border-radius: 4px;
    .el-select__selection {
      margin: 0;
      .label {
        position: absolute;
        width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    &.is-focused .el-select__selection .label {
      opacity: 0;
    }
  }

  .department-container {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    column-gap: 4px;
    border: 1px solid #DCDFE6;
    height: 32px;
    border-radius: 4px;
    background-color: #fff;
    cursor: pointer;

    &:hover {
      border-color: #409EFF;
      color: #409EFF;
    }
  }
  .is-disabled-btn {
    cursor: not-allowed;
    opacity: 0.5;
    background-color: var(--text-color-disabled);
    color: var(--text-color-disabled);
    &:hover {
      border-color: var(--text-color-disabled);
      color: var(--text-color-disabled);
    }
  }
}
</style>

