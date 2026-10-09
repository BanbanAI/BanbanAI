<template>
    <div class="logic-option">
        <div class="condition-item" v-for="(condition, i) in logicData.conditions" :key="i">
            <div class="logic-text">
                <span>
                    {{ i === 0 ? `${i18next.t('LogicOption.when')} ` : logicData.value?.satisfyType === 'and' ?
                        `${i18next.t('LogicOption.and')} ` : `${i18next.t('LogicOption.or')} ` }}
                </span>
            </div>
            <div class="condition-item-content">
                <div class="condition-item-field">
                    <el-input :value="condition.element.label || ''" disabled />
                </div>
                <div class="condition-item-operator">
                    <el-input :value="`${condition.operator.label} ${condition?.value.join(',')}` || ''" disabled />
                </div>
            </div>
        </div>
        <div class="condition-item" v-if="logicData.fieldDisplay.length > 0">
            <div class="logic-text">
                <span>
                    {{ i18next.t('LogicOption.show') }}
                </span>
            </div>
            <div class="condition-item-showFields">
                <el-input :value="logicData.fieldDisplay.map(item => item.label).join(',') || ''" disabled />
            </div>
        </div>
    </div>
</template>

<script lang="ts">
export default {
  isBigContent: (args: any) => true,
};
</script>
<script lang="ts" setup>
import { computed, inject } from 'vue';
import { GET_OPTION_VALUE } from '../inject';
import { DefinedOptionWithParsedType } from '../types';
import i18next from 'i18next';

const props = defineProps<{
    option: DefinedOptionWithParsedType
}>();

const getOptionValue = inject(GET_OPTION_VALUE);

const logicData = computed(() => ({
    satisfyType: 'and',
    conditions: [],
    fieldDisplay: [],
    ...getOptionValue()
}));


</script>

<style lang="scss" scoped>
.logic-option {
    align-self: auto;
    width: 560px;
    overflow: hidden;
    
    .condition-item {
        display: flex;
        align-items: center;
        margin-bottom: 10px;

        :deep(.el-input__wrapper) {
            background-color: #2e2e2e;
            height: 28px;

            .el-input__inner {
                background-color: #2e2e2e;
                color: #fff;
            }
        }

        .logic-text {
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
            width: 45px;
            color: #606266;
            font-size: 14px;
            margin-top: 4px;
        }

        .condition-item-content {
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            flex-wrap: nowrap;
            width: calc(100% - 45px);

            .condition-item-field,
            .condition-item-operator {
                width: 100px;
                margin: 0 4px 0;
                overflow: hidden;
                
                :deep(.el-input__inner) {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
            }
        }
    }

    .condition-item-showFields {
        width: 208px;
        margin: 4px 4px 0;
        overflow: hidden;
        
        :deep(.el-input__inner) {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
    }
}
</style>