<template>
  <div class="linkage-rule-list">
    <div class="empty" v-if="isEmpty(rules)">
      <div class="wrap">
        <div class="icon">
          <el-icon :size="40">
            <i-ven-linkage />
          </el-icon>
        </div>
        <p>{{ $t("linkageFillEmptyDesc") }}</p>
        <el-button class="btn-prefix-icon" type="primary" @click="handleOpenAddRuleDialog" :icon="IEpPlus">
          {{ $t("addLinkageFillRule") }}
        </el-button>
      </div>
    </div>
    <el-scrollbar class="linkage-rule-list-scrollbar" v-else>
      <div class="container">
        <el-header class="pane-header">
          <el-button class="btn-prefix-icon" type="primary" @click="handleOpenAddRuleDialog" style="border-radius: 4px;" :icon="IEpPlus">
            {{ $t("addLinkageFillRule") }}
          </el-button>
        </el-header>
        <vue-draggable :model-value="rules" :component-data="{ class: 'pane-list' }" handle=".rule-item" animation="500" delay="60">
          <template #item="{ element: item, index }: { element: FormLinkageRule, index: number }">
            <div class="rule-item" :key="index" :title="$t('dragSortTip')">
              <div class="cond-wrapper" v-if="isRuleLinkageTableMissing(item)">
                <div class="missing-linkage-table">
                  <el-tag class="name" type="danger">{{ $t("missingLinkageForm") }}</el-tag>
                  <span>{{ $t("missingLinkageFormDesc") }}</span>
                </div>
              </div>
              <div class="cond-wrapper" v-else>
                <div class="cond-item" v-for="(cond, i) in item.conditions" :key="i">
                  <el-tag>{{ i === 0 ? $t("conditionWhen") : ( item.logic === LogicalOperator.AND ? $t("conditionAnd") : $t("conditionOr")) }}</el-tag>
                  <div class="cond">
                    <el-tag class="name" type="info" :style="{'color': !getLinkageTableFieldAlias(item, cond.uid) ? '#FF4D4F' : ''}">{{ getLinkageTableFieldAlias(item, cond.uid) || $t("fieldDeleted") }}</el-tag>
                    <span>{{ RuleFuncTextMapping[cond.func] }}</span>
                    <el-tag class="name" type="info" v-if="cond.type === FormConditionValueType.FORM" :style="{'color': !getWidgetTitle(cond.value, cond, item) ? '#FF4D4F' : ''}">{{ getWidgetTitle(cond.value, cond, item) || $t("fieldDeleted")  }}</el-tag>
                    <el-tag class="name" type="info" v-else>{{ transformValue(cond, item, cond.uid) }}</el-tag>
                    {{ $t("whenSuffix") }}
                  </div>
                </div>
                <div class="all-field-show" v-for="(field, idx) in item.fillWidgets" :key="idx">
                  <div class="field-show">
                    <el-tag>{{ $t("fill") }}</el-tag>
                    <div class="field-name-wrapper">
                      <el-tag class="name" type="info" :style="{'color': !getWidgetTitle(field.fillWidget) ? '#FF4D4F' : ''}">{{ getWidgetTitle(field.fillWidget) || $t("fieldDeleted") }}</el-tag>
                      <template v-if="!(!field.linkageField && field.linkageSubFields)">
                        <span>{{ $t("fillAs") }}</span>
                        <el-tag class="name" type="info" :style="{'color': !getLinkageTableFieldAlias(item, field.linkageField) ? '#FF4D4F' : ''}">{{ getLinkageTableFieldAlias(item, field.linkageField) || $t("fieldDeleted") }}</el-tag>
                        <span>{{ $t("fieldValueSuffix") }}</span>
                      </template>
                      <template v-else>
                        <span>{{ i18next.t("fillRulesBelow") }}</span>
                      </template>
                    </div>
                  </div>
                  <template v-if="!field.linkageField && field.linkageSubFields">
                    <div class="field-show sub-field-show" v-for="(subField, idx) in field.linkageSubFields">
                      <div class="field-name-wrapper">
                        <div style="width: 50px;"></div>
                        <el-tag class="name" type="info" :style="{'color': !getWidgetTitle(subField.fillWidget) ? '#FF4D4F' : ''}">{{ getWidgetTitle(subField.fillWidget) || i18next.t("fieldDeleted") }}</el-tag>
                        <span>{{ i18next.t("fillAs") }}</span>
                        <el-tag class="name" type="info" :style="{'color': !getLinkageTableFieldAlias(item, subField.linkageField) ? '#FF4D4F' : ''}">{{ getLinkageTableFieldAlias(item, subField.linkageField) || i18next.t("fieldDeleted")  }}</el-tag>
                        <span>{{ i18next.t("fieldValueSuffix") }}</span>
                      </div>
                    </div>
                  </template>
                </div>
              </div>
              <div class="controls">
                <el-button text size="small" :title="i18next.t('edit')" @click.stop="handleEditRule(item)"><el-icon :size="16">
                  <i-ep-edit />
                </el-icon></el-button>
                <el-button v-if="!isRuleLinkageTableMissing(item)" text size="small" :title="i18next.t('copy')" @click.stop="handleCopyRule(item)"><el-icon :size="16">
                  <i-ep-copy-document />
                </el-icon></el-button>
                <el-button text size="small" :title="i18next.t('delete')" @click.stop="handleDeleteRule(item)"><el-icon :size="16">
                  <i-ep-delete />
                </el-icon></el-button>
              </div>
            </div>
          </template>
        </vue-draggable>
      </div>
    </el-scrollbar>
    <linkage-fill-dialog :widget="widget" :value="editRule" v-model="dialogVisible" @update="handleConfirm" />
  </div>
</template>

<script lang='ts' setup>
import { computed, onMounted, provide, ref, watch } from "vue";
import { Form } from "../../form";
import IEpPlus from "~icons/ep/plus";
import IEpEdit from "~icons/ep/edit";
import IEpDelete from "~icons/ep/delete";
import IVenLinkage from "~icons/ven-icon/widget-form-form-linkage";
import IEpCopyDocument from "~icons/ep/copy-document";
import { deepClone, isEmpty } from '@common/utils/object';
import VueDraggable from 'vuedraggable';
import { unique } from "@common/utils/unique";
import { FormConditionValueType, RuleFuncTextMapping, RuleFunc, DateDynamicRuleType, DateDynamicRuleTypeMapping } from "@common/types/nocode";
import { FormLinkageRule, LogicalOperator, FormFieldTypeOption, FormLinkageCondition, SelectIdOfForm } from "@renderer/b2/types";
import { FormElement, AbstractForm } from "@renderer/b2/controllers/form";
import { ElMessageBox } from "element-plus";
import { isMissingLinkageTable } from "./linkageRuleState";
import i18next, { $t } from "@renderer/widgets/i18next";


const props = defineProps<{
  widget: Form,
  value: FormLinkageRule[],
}>();

const emit = defineEmits<{
  (e: "update", value: FormLinkageRule[]): void;
}>();


const rules = ref<FormLinkageRule[]>([]);

const dialogVisible = ref(false);
const editRule = ref<FormLinkageRule | null>(null);

const getLinkageTableFieldAlias = (rule: FormLinkageRule, uid: string) => {
  if (isRuleLinkageTableMissing(rule)) return null;
  const table = props.widget.getTable(rule.linkageTable);
  const ids = uid?.split(".");
  if (ids?.length > 1) {
    const field = table?.fields?.find((f) => f.uid === ids[0]);
    if (!field) return null;
    const subField = props.widget.getTable(field?.meta?.extra?.subTableUID)?.fields?.find((f) => f.uid === ids[1]);
    if (!subField) return null;
    return `${field?.alias}.${subField?.alias}`;
  } else {
    const field = table?.fields?.find((f) => f.uid === uid);
    return field?.alias || null;
  }
}

const getWidgetTitle = (uid: string, cond?: FormLinkageCondition, rule?: FormLinkageRule) => {
  const widgetIds = uid.split(".");
  const [subformUid, subWidgetUid] = widgetIds;
  if (subWidgetUid) {
    const subform = props.widget.getChildElement(subformUid)
    if(!subform) return null;
    const subWidget = subform?.children.find((item) => item.uid === subWidgetUid)
    if(!subWidget) return null;
    return (`${subform?.title}.${(subWidget as FormElement)?.title}`) || null;
  };
  if (cond && rule) {
    if (isRuleLinkageTableMissing(rule)) return null;
    const connections = props.widget.getBoard().getConnections();
    const connection = connections.find(c => c.uid === rule.linkageTable[0]);
    const table = connection?.tables?.find(t => t.fields.find(f => f.uid === cond.value));
    const field = table?.fields?.find((f) => f.uid === uid);
    return ((cond.comparisonOfForm && cond.comparisonOfForm === SelectIdOfForm.LINKAGE) ? `${table?.alias}-${field?.alias}` : props.widget.getChildElement(uid)?.title) || null;
  }
  return props.widget.getChildElement(uid)?.title || null;
}

const isRuleLinkageTableMissing = (rule: FormLinkageRule) => {
  return isMissingLinkageTable(rule, props.widget);
}

const updateValue = () => {
  emit("update", rules.value);
}

const handleOpenAddRuleDialog = () => {
  editRule.value = null;
  dialogVisible.value = true;
}

const handleEditRule = (rule: FormLinkageRule) => {
  // 使用深拷贝避免循环引用问题
  editRule.value = deepClone(rule);
  dialogVisible.value = true;
}

const handleCopyRule = (rule: FormLinkageRule) => {
  rules.value.push({
    ...deepClone(rule),
    id: unique(),
  })
  updateValue();
}

const handleDeleteRule = async (rule: FormLinkageRule) => {
  const isDelete = await ElMessageBox.confirm(
    i18next.t("confirmDeleteFillRule"),
    '',
    {
      confirmButtonText: i18next.t("confirm"),
      cancelButtonText: i18next.t("cancel"),
      type: 'warning',
      showClose: false,
    }
  ).then(() => true).catch(() => false);
  if (!isDelete) return;
  rules.value = rules.value.filter((item) => item.id !== rule.id);
  updateValue();
}

const handleConfirm = (value: FormLinkageRule) => {
  if (!value) return;
  const index = rules.value.findIndex(item => item.id === value.id)
  if (index >= 0) {
    rules.value.splice(index, 1, value);
  } else {
    rules.value.push(value);
  }
  updateValue();
}

watch(() => props.value, (value) => {
  // 使用深拷贝避免循环引用问题
  rules.value = value ? deepClone(value) : [];
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
const transformValue = (cond, rule, uid) => {
  const value = cond.fixedValue;
  const table = props.widget.getTable(rule.linkageTable);
  const ids = uid?.split(".");
  let field = null;
  if (ids?.length > 1) {
    const mainField = table?.fields?.find((f) => f.uid === ids[0]);
    field = props.widget.getTable(mainField?.meta?.extra?.subTableUID)?.fields?.find((f) => f.uid === ids[1]);
  } else {
    field = table?.fields?.find((f) => f.uid === uid);
  }
  if (value && field?.meta?.extra?.isPercent) return `${value * 100}%`;
  if(field?.meta?.extra?.widgetType === 'widget.form.memberSelect') {
    return Array.isArray(value) ? value.map(item => organize.value.users.find(u => u.id === item)?.realname || item).join(',') : organize.value.users.find(u => u.id === value)?.realname || value;
  };
  if(field?.meta?.extra?.widgetType === 'widget.form.departmentSelect') {
    return Array.isArray(value) ? value.map(item => organize.value.departments.find(d => d.id === item)?.name || item).join(',') : organize.value.departments.find(d => d.id === value)?.name || value;
  }
  if (cond.func === RuleFunc.DYNAMIC && value) {
    console.log('value',value);

    const dynamicValue = JSON.parse(value);
    let label;
    if (dynamicValue.type === DateDynamicRuleType.CUSTOM) {
      const getUnit = (unitData: string) => {
        let unitLabel;
        switch(unitData) {
          case 'day':
            unitLabel = i18next.t("dayUnit");
            break;
          case 'week':
            unitLabel = i18next.t("weekUnit");
            break;
          case 'month':
            unitLabel = i18next.t("monthUnit");
            break;
          case 'quarter':
            unitLabel = i18next.t("quarterUnit");
            break;
          case 'year':
            unitLabel = i18next.t("yearUnit");
            break;
        }
        return unitLabel
      }
      if (dynamicValue.value.first) {
        const time = (dynamicValue.value.first[0] === 'this') ? i18next.t("current") : ((dynamicValue.value.first[0] === 'last') ? i18next.t("past") : i18next.t("future"));
        let unit = getUnit(dynamicValue.value.first[2]);
        label = i18next.t("startTimeLabel") + time + dynamicValue.value.first[1] + unit;
      }
      if (dynamicValue.value.last) {
        const time = (dynamicValue.value.last[0] === 'this') ? i18next.t("current") : ((dynamicValue.value.last[0] === 'last') ? i18next.t("past") : i18next.t("future"));
        let unit = getUnit(dynamicValue.value.last[2]);
        if (dynamicValue.value.first) {
          label += ` ~ ${i18next.t("endTimeLabel")}${time}${dynamicValue.value.last[1]}${unit}`;
        } else {
          label = i18next.t("endTimeLabel") + time + dynamicValue.value.last[1] + unit;
        }
      }
    } else {
      label = DateDynamicRuleTypeMapping[dynamicValue.type];
    }
    return label;
  }
  return value;
}
</script>

<style lang='scss' scoped>
.linkage-rule-list {
  width: 100%;
  height: 100%;
  overflow: hidden;

  .btn-prefix-icon {
    padding: 8px 16px 8px 12px;

    :deep(span) {
      margin: 4px;
    }
  }

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

  :deep(.linkage-rule-list-scrollbar) {

    .el-scrollbar__view {
      height: auto;
      padding: 20px 0;
      min-height: 100%;
      .container {
        width: 780px;
        margin: 0px auto;
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
            padding: 16px;
            cursor: move;
            user-select: none;

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
              flex: 1;
              display: flex;
              flex-direction: column;
              row-gap: 4px;

              .missing-linkage-table {
                display: flex;
                align-items: center;
                gap: 4px;
              }

              .cond-item {
                display: flex;
                column-gap: 8px;

                .el-tag {
                  width: 50px;
                  border: none;
                  --el-tag-border-radius: 4px;
                  --el-tag-text-color: var(--text-color-regular);
                }

                .cond {
                  flex: 1;
                  display: flex;
                  flex-wrap: wrap;
                  align-content: center;
                  align-items: center;
                  column-gap: 8px;
                  color: var(--color-primary);

                  .label {
                    color: var(--text-color-regular);
                  }

                  .name.el-tag {
                    width: fit-content;
                    color: var(--text-color-regular);
                  }
                }
              }

              .all-field-show {
                .sub-field-show {
                  margin-top: 4px;
                }
              }

              .field-show {
                display: flex;
                column-gap: 8px;

                .el-tag {
                  width: 50px;
                  border: none;
                  --el-tag-border-radius: 4px;
                }
                .field-name-wrapper {
                  flex: 1;
                  display: flex;
                  flex-wrap: wrap;
                  align-content: center;
                  align-items: center;
                  column-gap: 8px;
                  color: var(--color-primary);

                  .name.el-tag {
                    width: fit-content;
                    color: var(--text-color-regular);
                  }
                }
              }
            }
            .controls {
              .el-button {
                width: 32px;
                margin: 0;
              }
            }
          }
        }
      }
    }
  }

}
</style>
