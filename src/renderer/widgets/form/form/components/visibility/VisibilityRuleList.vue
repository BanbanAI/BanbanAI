<template>
  <div class="visibility-rule-list">
    <div class="empty" v-if="isEmpty(rules)">
      <div class="wrap">
        <div class="icon">
          <el-icon :size="40">
            <i-ven-visible />
          </el-icon>
        </div>
        <p>{{ $t('visibilityDesc') }}</p>
        <el-button type="primary" @click="handleAddRule" style="border-radius: 4px;" :icon="IEpPlus">
          {{ $t('addVisibilityRule') }}
        </el-button>
      </div>
    </div>
    <el-scrollbar class="visibility-rule-list-scrollbar" v-else>
        <div class="container">
          <el-header class="pane-header">
            <el-button type="primary" @click="handleAddRule" style="border-radius: 4px;" :icon="IEpPlus">
            {{ $t('addVisibilityRule') }}
          </el-button>
        </el-header>
        <vue-draggable :model-value="rules" :component-data="{ class: 'pane-list' }" handle=".rule-item" animation="500" delay="60">
          <template #item="{ element: rule }: { element: FormVisibleRule }">
            <div class="rule-item" :key="rule.id" :title="$t('dragSortTip')">
              <div class="cond-wrapper">
                <div class="cond-box" v-for="condition, index in rule.conditions" :key="condition.uid">
                  <el-tag>{{ getConditionRelationship(index, rule.logic)}}</el-tag>
                  <div class="cond">
                    <el-tag class="name" type="info" v-if="!isDeletedField(condition.uid)">{{ getFieldTitleByUid(condition.uid) }}</el-tag>
                    <el-tag class="name" type="info" v-else style="color: #FF4D4F;">{{ $t('fieldDeleted') }}</el-tag>
                    <span>{{ getFuncTextLabel(condition.func, condition.uid) }}</span>
                    <el-tag class="name padding"  type="info" v-if="![RuleFunc.EMPTY, RuleFunc.NOT_EMPTY, RuleFunc.TRUE, RuleFunc.FALSE].includes(condition.func)"> {{ formatFieldValue(condition) }} </el-tag>
                    {{ $t('whenSuffix') }}
                  </div>
                </div>
                <div class="field-show">
                  <el-tag :type="rule.visibleType === VisibleType.HIDE ? 'danger' : ''">{{ rule.visibleType === VisibleType.HIDE ? $t('hide') : $t('show') }}</el-tag>
                  <div class="field-name-wrapper">
                    <span class="name" v-for="uid in rule.widgetIds" :key="uid">
                      <span v-if="!isDeletedField(uid)">
                        {{ getFieldTitleByUid(uid) }}
                      </span>
                      <span v-else style="color: #FF4D4F;">{{ $t('fieldDeleted') }}</span>
                    </span>
                  </div>
                </div>
              </div>
              <div class="controls">
                <el-button text size="small" :title="$t('edit')" @click.stop="handleEditRule(rule)"><el-icon :size="16">
                  <i-ep-edit />
                </el-icon></el-button>
                <el-button text size="small" :title="$t('copy')" @click.stop="handleCopyRule(rule)"><el-icon :size="16">
                  <i-ep-copy-document />
                </el-icon></el-button>
                <el-button text size="small" :title="$t('delete')" @click.stop="handleRemoveRule(rule.id)"><el-icon :size="16">
                  <i-ep-delete />
                </el-icon></el-button>
              </div>
            </div>
          </template>
        </vue-draggable>
      </div>
    </el-scrollbar>
    <b2-form-visibility-dialog v-model="dialogVisible" :rule="editRule" :widget="widget" @confirm="handleConfirm" />
  </div>
</template>

<script lang='ts' setup>
import { computed, onMounted, provide, ref, watch } from "vue";
import { Form } from "../../form";
import B2FormVisibilityDialog from "./B2FormVisibilityDialog.vue";
import IEpPlus from "~icons/ep/plus";
import IEpEdit from "~icons/ep/edit";
import IEpDelete from "~icons/ep/delete";
import IVenVisible from "~icons/ven-icon/widget-form-form-visible";
import IEpCopyDocument from "~icons/ep/copy-document";
import { deepClone, isEmpty } from '@common/utils/object';
import VueDraggable from 'vuedraggable';
import { unique } from "@common/utils/unique";
import { RuleFuncTextMapping, RuleFunc, DateDynamicRuleType, DateDynamicRuleTypeMapping } from "@common/types/nocode";
import { FormVisibleRule, LogicalOperator, VisibleType } from "@renderer/b2/types";
import { FormElement } from "@renderer/b2/controllers/form";
import { ElMessageBox } from "element-plus";
import { TabPanel } from "@renderer/widgets/form/tabPanel/tabPanel";
import { MultipleTabs } from "@renderer/widgets/form/multipleTabs/multipleTabs";
import i18next, { $t } from "@renderer/widgets/i18next";

const props = defineProps<{
  widget: Form,
  value: FormVisibleRule[],
}>();

const emit = defineEmits<{
  (e: "update", value: FormVisibleRule[]): void;
}>();

const dialogVisible = ref();
const rules = ref<FormVisibleRule[]>([]);

const editRule = ref<FormVisibleRule>();

const getConditionRelationship = (index: number, logic: LogicalOperator) => {
  if (index === 0) {
    return i18next.t('conditionWhen');
  }
  if (logic === LogicalOperator.AND) {
    return i18next.t('conditionAnd');
  }
  if (logic === LogicalOperator.OR) {
    return i18next.t('conditionOr');
  }
}

const getFieldTitleByUid = (uid: string) => {
  const element = props.widget.getChildElement(uid);
  if(!element) return uid;
  const title = element.title || uid;
  const showParentTitle = ['widget.form.multipleTabs', 'widget.form.tabPanel', 'widget.form.subform']
  if(showParentTitle.includes(element.parent.type)) {
    return getFieldTitleByUid(element.parent.uid) + '.' + title;
  }
  return title
}

const isDeletedField = (uid: string) => {
  const element = props.widget.getChildElement(uid);
  if(!element) return true
  return false
}

const updateValue = () => {
  emit("update", rules.value);
}

const handleAddRule = () => {
  editRule.value = null;
  dialogVisible.value = true;
}

const handleEditRule = (rule: FormVisibleRule) => {
  editRule.value = rule;
  dialogVisible.value = true;
}

const handleCopyRule = (rule: FormVisibleRule) => {
  const newRule = deepClone(rule);
  newRule.id = unique();
  handleEditRule(newRule);
}

const handleRemoveRule = async (id: string) => {
  const isDelete = await ElMessageBox.confirm(
    i18next.t('confirmDeleteVisibilityRule'),
    '',
    {
      confirmButtonText: i18next.t('confirm'),
      cancelButtonText: i18next.t('cancel'),
      type: 'warning',
      showClose: false,
    }
  ).then(() => true).catch(() => false);
  if (!isDelete) return;
  rules.value = rules.value.filter((item) => item.id !== id);
  updateValue();
}

const handleConfirm = (value: FormVisibleRule) => {
  const index = rules.value.findIndex(r => r.id === value.id);
  if (index > -1) {
    rules.value.splice(index, 1, value);
  } else {
    rules.value.push(value);
  }
  updateValue();
}

const getFuncTextLabel = (key, uid) => {
  const element = props.widget.getChildElement(uid);
  if (element?.getConfigurations()?.editFuncInfoText?.[key]) {
    return element?.getConfigurations()?.editFuncInfoText?.[key];
  }
  return RuleFuncTextMapping[key];
}

watch(() => props.value, (value) => {
  rules.value = props.value || [];
}, { immediate: true, deep: true });

provide("widget", props.widget);

const organize = ref({
  departments: [],
  users: [],
})

onMounted(async ()=>{
  organize.value.departments = await props.widget.getBoard().getOrganizeDepartments(null, false)
  organize.value.users = await props.widget.getBoard().getOrganizeUsers();
});

// 字段值格式化为可展示的值
const formatFieldValue = (condition) => {
  const element = props.widget.getChildElement(condition.uid);
  if (condition.value && element.getSoul().options?.['number-type'] === "percent") return `${condition.value * 100}%`;
  if(element.type === 'widget.form.memberSelect') {
    return Array.isArray(condition.value) ? condition.value.map((item) => organize.value.users.find((user) => user.id === item)?.realname || item).join(',') : organize.value.users.find((user) => user.id === condition.value)?.realname || condition.value;
  }
  if(element.type === 'widget.form.departmentSelect') {
    return Array.isArray(condition.value) ? condition.value.map((item) => organize.value.departments.find((department) => department.id === item)?.name || item).join(',') : organize.value.departments.find((department) => department.id === condition.value)?.name || condition.value;
  }
  if (condition.func === RuleFunc.DYNAMIC && condition.value) {
    const dynamicValue = JSON.parse(condition.value);
    let label;
    if (dynamicValue.type === DateDynamicRuleType.CUSTOM) {
      const getUnit = (unitData: string) => {
        let unitLabel;
        switch(unitData) {
          case 'day':
            unitLabel = i18next.t('dayUnit');
            break;
          case 'week':
            unitLabel = i18next.t('weekUnit');
            break;
          case 'month':
            unitLabel = i18next.t('monthUnit');
            break;
          case 'quarter':
            unitLabel = i18next.t('quarterUnit');
            break;
          case 'year':
            unitLabel = i18next.t('yearUnit');
            break;
        }
        return unitLabel
      }
      if (dynamicValue.value.first) {
        const time = (dynamicValue.value.first[0] === 'this') ? i18next.t('current') : ((dynamicValue.value.first[0] === 'last') ? i18next.t('past') : i18next.t('future'));
        let unit = getUnit(dynamicValue.value.first[2]);
        label = i18next.t('startTimeLabel') + time + dynamicValue.value.first[1] + unit;
      }
      if (dynamicValue.value.last) {
        const time = (dynamicValue.value.last[0] === 'this') ? i18next.t('current') : ((dynamicValue.value.last[0] === 'last') ? i18next.t('past') : i18next.t('future'));
        let unit = getUnit(dynamicValue.value.last[2]);
        if (dynamicValue.value.first) {
          label += ' ~ ' + i18next.t('endTimeLabel') + time + dynamicValue.value.last[1] + unit;
        } else {
          label = i18next.t('endTimeLabel') + time + dynamicValue.value.last[1] + unit;
        }
      }
    } else {
      label = DateDynamicRuleTypeMapping[dynamicValue.type];
    }
    return label;
  }
  return condition.value;
}
</script>

<style lang='scss' scoped>
.visibility-rule-list {
  width: 100%;
  height: 100%;
  overflow: hidden;

  .empty {
    width: 100%;

    .wrap {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      row-gap: 16px;
      margin-top: 100px;
      font-size: 14px;

      .icon {
        width: 64px;
        height: 64px;
        border-radius: 16px;
        background-color: var(--text-color-disabled);
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .el-button {
        border-radius: 4px;
      }
    }

  }

  :deep(.visibility-rule-list-scrollbar) {

    .el-scrollbar__view {
      height: auto;
      padding: 20px 0;
      min-height: 100%;
      .container {
        width: 780px;
        margin: 0 auto;
        background-color: var(--bg-color-page);
        padding: 12px 20px 20px;
        display: flex;
        flex-direction: column;
        row-gap: 8px;
        .pane-header {
          margin: 0 -20px;
          padding-left: 20px;
          padding-right: 20px;
          border-bottom: 1px solid var(--border-color);
          height: 50px;
        }

        .pane-list {
          display: flex;
          flex-direction: column;
          color: var(--text-color-secondary);
          font-size: 14px;

          .rule-item {
            display: flex;
            row-gap: 4px;
            padding: 16px;
            cursor: move;
            user-select: none;
            justify-content: space-between;

            &:not(:first-of-type) {
              border-top: 1px solid var(--border-color);
            }

            &:hover {
              border-color: transparent;
              box-shadow: 0 2px 8px #00000014;
              &+.rule-item {
                border-color: transparent;
              }
            }

            .cond-wrapper {
              display: flex;
              flex-direction: column;
              row-gap: 8px;

              .cond-box {
                display: flex;
                align-items: center;
                column-gap: 8px;

                .el-tag {
                  width: 50px;
                  --el-tag-border-radius: 4px;
                  border: none;
                  --el-tag-text-color: var(--text-color-regular);
                }

                .cond {
                  flex: 1;
                  display: flex;
                  flex-wrap: wrap;
                  align-content: center;
                  color: var(--bg-color-active);
                  column-gap: 8px;
                  align-items: center;

                  .name.el-tag {
                    width: fit-content;
                    color: var(--text-color-regular);
                  }

                  .padding {
                    padding: 0 4px;
                  }
                }
              }

              .field-show {
                display: flex;
                column-gap: 8px;

                .el-tag {
                  width: 50px;
                  --el-tag-border-radius: 4px;
                  border: none;
                }

                .field-name-wrapper {
                  flex: 1;
                  display: flex;
                  flex-wrap: wrap;
                  align-content: center;
                  column-gap: 8px;

                  .name {
                    color: var(--text-color-regular);
                  }
                }
              }
            }

            .controls {
              .el-button {
                width: 32px;
                margin: 0;
                border-radius: 4px;
              }
            }
          }
        }
      }
    }
  }

}
</style>

