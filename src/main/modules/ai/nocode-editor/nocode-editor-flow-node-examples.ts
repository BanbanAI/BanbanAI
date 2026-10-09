import type { NocodeEditorFlowPlanNodeType } from '@common/utils/nocodeEditorFlowPlan'

type FieldRequiredWhen = '必填' | '选填' | `只在 ${string} 时必填` | `只在 ${string} 时选填`

type FlowNodeExampleField =
  | {
    description: string
    type: 'string' | 'number' | 'boolean' | 'array'
    requiredWhen: FieldRequiredWhen
    exampleValue: unknown
  }
  | {
    description: string
    type: 'object'
    requiredWhen: FieldRequiredWhen
    exampleValue: Record<string, FlowNodeExampleField>
  }

export type NocodeEditorFlowNodeExample = {
  nodeType: NocodeEditorFlowPlanNodeType
  description: string
  nodeFields?: Record<string, FlowNodeExampleField>
  optionFields?: Record<string, FlowNodeExampleField>
}

export type NocodeEditorFlowConditionOperatorReference = {
  value: string
  label: string
  description: string
  aliases?: string[]
}

export const nocodeEditorFlowConditionOperatorReferences: NocodeEditorFlowConditionOperatorReference[] = [
  {
    value: '=',
    label: '等于',
    description: '字段值等于目标值',
    aliases: ['equal', 'equals', 'eq', '==', '==='],
  },
  {
    value: '!=',
    label: '不等于',
    description: '字段值不等于目标值',
    aliases: ['notequal', 'notequals', 'ne', 'neq', '!=', '!=='],
  },
  {
    value: '>',
    label: '大于',
    description: '字段值大于目标值',
    aliases: ['gt', 'sumgt', '>'],
  },
  {
    value: '>=',
    label: '大于等于',
    description: '字段值大于等于目标值',
    aliases: ['gte', 'sumgte', '>='],
  },
  {
    value: '<',
    label: '小于',
    description: '字段值小于目标值',
    aliases: ['lt', 'sumlt', '<'],
  },
  {
    value: '<=',
    label: '小于等于',
    description: '字段值小于等于目标值',
    aliases: ['lte', 'sumlte', '<='],
  },
  {
    value: '∅',
    label: '为空',
    description: '字段值为空，不需要额外 value',
    aliases: ['empty', 'isempty'],
  },
  {
    value: '!∅',
    label: '不为空',
    description: '字段值不为空，不需要额外 value',
    aliases: ['notempty', 'isnotempty'],
  },
  {
    value: '⊃',
    label: '包含',
    description: '字段值包含目标值，常用于文本或集合字段',
    aliases: ['contain', 'contains'],
  },
  {
    value: '!⊃',
    label: '不包含',
    description: '字段值不包含目标值，常用于文本或集合字段',
    aliases: ['notcontain', 'notcontains'],
  },
  {
    value: '∋',
    label: '属于',
    description: '字段值属于某个集合或对象',
  },
  {
    value: '!∋',
    label: '不属于',
    description: '字段值不属于某个集合或对象',
  },
  {
    value: '∈',
    label: '等于任意一个',
    description: '字段值命中给定数组中的任意一个值',
    aliases: ['in'],
  },
  {
    value: '!∈',
    label: '不等于任意一个',
    description: '字段值不命中给定数组中的任意一个值',
    aliases: ['notin'],
  },
  {
    value: '⊃∃',
    label: '包含任意一个',
    description: '集合字段至少包含给定数组中的一个值',
  },
  {
    value: '⊃∀',
    label: '同时包含',
    description: '集合字段同时包含给定数组中的全部值',
  },
  {
    value: '~',
    label: '范围',
    description: '字段值落在给定范围内，value 一般是长度为 2 的数组',
  },
  {
    value: 'T=',
    label: '时间等于',
    description: '日期/时间字段等于指定时间值',
  },
  {
    value: 'T!=',
    label: '时间不等于',
    description: '日期/时间字段不等于指定时间值',
  },
  {
    value: 'T<=',
    label: '时间小于等于',
    description: '日期/时间字段早于或等于指定时间值',
  },
  {
    value: 'T~',
    label: '时间范围',
    description: '日期/时间字段落在时间范围内，value 一般是长度为 2 的数组',
  },
  {
    value: 'DYNAMIC',
    label: '动态筛选',
    description: '按动态日期规则等条件过滤，通常只在支持动态筛选的字段类型上使用',
  },
  {
    value: 'TRUE',
    label: '开启',
    description: '布尔字段为开启/真，不需要额外 value',
  },
  {
    value: 'FALSE',
    label: '关闭',
    description: '布尔字段为关闭/假，不需要额外 value',
  },
]

export const nocodeEditorFlowConditionReferenceGuide = {
  description: '所有 conditions、filter、finishCondition、branch.conditions 等条件结构共用这一组 operator。请优先输出 value 中的规范值，不要重复发明别名；实际可用的 operator 仍会受字段类型影响。',
  operators: nocodeEditorFlowConditionOperatorReferences,
}

// #region 触发节点示例
const triggerDataChangeExample: NocodeEditorFlowNodeExample = {
  nodeType: 'trigger-data-change',
  description: '数据变化触发节点。至少要明确哪些数据变化会触发；changeType 始终使用数组，单个新增触发也必须写成 ["add"]。如果只在满足特定数据范围或条件时触发，还需要补齐来源表和触发条件。',
  optionFields: {
    changeType: {
      description: '触发的数据变化类型，可选新增：add、修改：edit、删除：delete；可单选也可多选',
      type: 'array',
      requiredWhen: '必填',
      exampleValue: ['add'],
    },
    enableTriggerConditions: {
      description: '是否启用触发条件；启用后通常需要同时补齐来源表和条件',
      type: 'boolean',
      requiredWhen: '选填',
      exampleValue: true,
    },
    sourceTables: {
      description: '触发条件中可引用的数据来源表',
      type: 'array',
      requiredWhen: '只在 enableTriggerConditions = true 时选填',
      exampleValue: [
        {
          name: '<source_table_name>',
          tableUID: '<source_table_uid>',
          filterRule: {
            logic: 'and',
            conditions: [
              {
                fieldName: '<source_filter_field_name>',
                operator: '=',
                value: '<source_filter_value>',
              },
            ],
          },
        },
      ],
    },
    conditions: {
      description: '触发条件表达式，支持单组条件或多组条件；每组内为且关系，多组之间可表达或关系',
      type: 'array',
      requiredWhen: '只在 enableTriggerConditions = true 时选填',
      exampleValue: [
        [
          {
            fieldName: '<field_name>',
            operator: '=',
            value: '<expected_value>',
          },
        ],
      ],
    },
  },
}

const triggerTimeTaskExample: NocodeEditorFlowNodeExample = {
  nodeType: 'trigger-time-task',
  description: '定时触发节点。至少要明确定时规则，基础定时需要频率和时间，高级定时需要日期字段和触发时间点。',
  optionFields: {
    schedule: {
      description: '定时规则',
      type: 'object',
      requiredWhen: '必填',
      exampleValue: {
        method: {
          description: '定时模式，基础定时：basic-task，高级定时：advanced-task',
          type: 'string',
          requiredWhen: '必填',
          exampleValue: 'basic-task',
        },
        repeat: {
          description: '基础定时的重复频率，例如 every-day / every-week / every-month',
          type: 'string',
          requiredWhen: '只在 schedule.method = basic-task 时必填',
          exampleValue: 'every-day',
        },
        triggerTime: {
          description: '触发时间，基础定时和高级定时都会用到',
          type: 'string',
          requiredWhen: '必填',
          exampleValue: '09:00',
        },
        triggerDate: {
          description: '高级定时的日期字段 ID 或字段名',
          type: 'string',
          requiredWhen: '只在 schedule.method = advanced-task 时必填',
          exampleValue: '<date_field_id>',
        },
        triggerTimePoint: {
          description: '高级定时相对日期字段的偏移规则，type 可选 before / today / after',
          type: 'object',
          requiredWhen: '只在 schedule.method = advanced-task 时必填',
          exampleValue: {
            type: {
              description: '相对日期字段的触发方向',
              type: 'string',
              requiredWhen: '必填',
              exampleValue: 'after',
            },
            value: {
              description: '偏移天数；today 时通常为 0',
              type: 'number',
              requiredWhen: '必填',
              exampleValue: 1,
            },
          },
        },
      },
    },
    sourceTables: {
      description: '定时触发条件中可引用的数据来源表',
      type: 'array',
      requiredWhen: '选填',
      exampleValue: [
        {
          name: '<source_table_name>',
          tableUID: '<source_table_uid>',
          filterRule: {
            logic: 'and',
            conditions: [
              {
                fieldName: '<source_filter_field_name>',
                operator: '=',
                value: '<source_filter_value>',
              },
            ],
          },
        },
      ],
    },
  },
}

const triggerOperationExample: NocodeEditorFlowNodeExample = {
  nodeType: 'trigger-operation',
  description: '操作触发节点。至少要给出节点名称和触发模式；按记录触发与按页面上下文触发的行为不同，不能混写。',
  nodeFields: {
    name: {
      description: '节点名称，直接体现在流程图上',
      type: 'string',
      requiredWhen: '必填',
      exampleValue: '打开详情页时触发',
    },
  },
  optionFields: {
    triggerMode: {
      description: '触发模式，每条记录触发：each_record；页面上下文只触发一次：view_context_once',
      type: 'string',
      requiredWhen: '必填',
      exampleValue: 'view_context_once',
    },
    allowViewContextOnce: {
      description: '是否允许页面上下文只触发一次；通常与 triggerMode 保持一致',
      type: 'boolean',
      requiredWhen: '选填',
      exampleValue: true,
    },
  },
}

// #endregion


// #region 人工节点示例
const personnelOwnerContractGuidance = '固定角色或固定用户只能使用 flow summary 中真实存在的 ID；对应对象不存在时，保留流程方案中的名称并生成待补配置，禁止编造 ID。部门负责人使用 department-manager 的 { mode, value } 结构，不要使用 dept-head。'

const approvalExample: NocodeEditorFlowNodeExample = {
  nodeType: 'approval',
  description: '审批节点。用于人工审批场景，至少要明确审批人、多人审批方式，以及审批人为空时的处理方式。',
  optionFields: {
    approver: {
      description: `审批人。approval_owner dependency 为 create_later + planned 时，使用 type=formMember 和 fieldName 表达计划成员字段；use_existing + existing 时才使用 form-member 真实字段 ID。${personnelOwnerContractGuidance}`,
      type: 'object',
      requiredWhen: '必填',
      exampleValue: {
        submitter: {
          description: '提交人自己',
          type: 'boolean',
          requiredWhen: '选填',
          exampleValue: true,
        },
        assignee: {
          description: '指定成员/角色',
          type: 'object',
          requiredWhen: '选填',
          exampleValue: {
            roles: {
              description: '角色',
              type: 'array',
              requiredWhen: '选填',
              exampleValue: ['<role_id_1>', '<role_id_2>'],
            },
            users: {
              description: '成员',
              type: 'array',
              requiredWhen: '选填',
              exampleValue: ['<user_id_1>', '<user_id_2>'],
            },
          },
        },
        'department-manager': {
          description: '部门主管',
          type: 'object',
          requiredWhen: '选填',
          exampleValue: {
            mode: {
              description: '模式，up 表示直属部门向上，down 表示最高部门向下',
              type: 'string',
              requiredWhen: '必填',
              exampleValue: 'up',
            },
            value: {
              description: '部门主管加 n 级部门',
              type: 'number',
              requiredWhen: '必填',
              exampleValue: 0,
            },
          },
        },
        'form-member': {
          description: '当前表单内的成员字段',
          type: 'array',
          requiredWhen: '选填',
          exampleValue: ['<member_field_id>'],
        },
        'form-department': {
          description: '当前表单内的部门字段',
          type: 'object',
          requiredWhen: '选填',
          exampleValue: {
            value: {
              description: '部门字段',
              type: 'string',
              requiredWhen: '必填',
              exampleValue: '<department_field_id>',
            },
          },
        },
      },
    },
    approverType: {
      description: '多人审批时采用的审批方式，会签：and，或签：or，依次审批：sequential',
      type: 'string',
      requiredWhen: '必填',
      exampleValue: 'and',
    },
    approverEmpty: {
      description: '审批人为空时的处理方式，自动通过：auto-approve，指定人员审批：assignee，转交给管理员：admin',
      type: 'string',
      requiredWhen: '必填',
      exampleValue: 'auto-approve',
    },
    approverEmptyUsers: {
      description: '审批人为空时，指定人员审批的处理方式',
      type: 'array',
      requiredWhen: '只在 approverEmpty = assignee 时必填',
      exampleValue: ['<user_id_1>', '<user_id_2>'],
    },
    approverEmptyAdmin: {
      description: '审批人为空时，转交给管理员的处理方式',
      type: 'string',
      requiredWhen: '只在 approverEmpty = admin 时必填',
      exampleValue: '<admin_user_id>',
    },
    approverSameAsSubmitter: {
      description: '审批人与提交人为同一人时的处理方式, 提交人自己审批: self, 转交给部门负责人审批: department-manager, 自动跳过: auto-skip',
      type: 'string',
      requiredWhen: '必填',
      exampleValue: 'self',
    },
    allowTransfer: {
      description: '是否允许转交',
      type: 'boolean',
      requiredWhen: '选填',
      exampleValue: true,
    },
    transferRange: {
      description: '允许转交时的可转交范围',
      type: 'object',
      requiredWhen: '选填',
      exampleValue: {
        users: {
          description: '允许转交的成员',
          type: 'array',
          requiredWhen: '选填',
          exampleValue: ['<user_id_1>', '<user_id_2>'],
        },
        roles: {
          description: '允许转交的角色',
          type: 'array',
          requiredWhen: '选填',
          exampleValue: ['<role_id_1>', '<role_id_2>'],
        },
      },
    },
    allowRevert: {
      description: '是否允许退回',
      type: 'boolean',
      requiredWhen: '选填',
      exampleValue: true,
    },
    revertRange: {
      description: '允许退回时的可退回节点范围',
      type: 'array',
      requiredWhen: '只在 allowRevert = true 时选填',
      exampleValue: ['<node_key_1>', '<node_key_2>'],
    },
    allowReject: {
      description: '是否允许拒绝',
      type: 'boolean',
      requiredWhen: '选填',
      exampleValue: true,
    },
    continueAfterReject: {
      description: '拒绝后是否继续后续流程',
      type: 'boolean',
      requiredWhen: '只在 allowReject = true 时选填',
      exampleValue: false,
    },
    rejectSkipNodeIds: {
      description: '拒绝后继续流程时需要跳过的节点',
      type: 'array',
      requiredWhen: '只在 allowReject = true 且 continueAfterReject = true 时选填',
      exampleValue: ['<node_key_1>', '<node_key_2>'],
    },
    requireApprovalComments: {
      description: '是否需要审批意见',
      type: 'boolean',
      requiredWhen: '选填',
      exampleValue: false,
    },
  },
}

const transactExample: NocodeEditorFlowNodeExample = {
  nodeType: 'transact',
  description: '办理节点。用于人工处理、补录、执行等场景，至少要明确办理人。',
  optionFields: {
    transactor: {
      description: `办理人。${personnelOwnerContractGuidance}`,
      type: 'object',
      requiredWhen: '必填',
      exampleValue: {
        submitter: {
          description: '提交人自己',
          type: 'boolean',
          requiredWhen: '选填',
          exampleValue: true,
        },
        assignee: {
          description: '指定成员/角色',
          type: 'object',
          requiredWhen: '选填',
          exampleValue: {
            roles: {
              description: '角色',
              type: 'array',
              requiredWhen: '选填',
              exampleValue: ['<role_id_1>', '<role_id_2>'],
            },
            users: {
              description: '成员',
              type: 'array',
              requiredWhen: '选填',
              exampleValue: ['<user_id_1>', '<user_id_2>'],
            },
          },
        },
        'department-manager': {
          description: '部门主管',
          type: 'object',
          requiredWhen: '选填',
          exampleValue: {
            mode: {
              description: '模式，up 表示直属部门向上，down 表示最高部门向下',
              type: 'string',
              requiredWhen: '必填',
              exampleValue: 'up',
            },
            value: {
              description: '部门主管加 n 级部门',
              type: 'number',
              requiredWhen: '必填',
              exampleValue: 0,
            },
          },
        },
        'form-member': {
          description: '当前表单内的成员字段',
          type: 'array',
          requiredWhen: '选填',
          exampleValue: ['<member_field_id>'],
        },
        'form-department': {
          description: '当前表单内的部门字段',
          type: 'object',
          requiredWhen: '选填',
          exampleValue: {
            value: {
              description: '部门字段',
              type: 'string',
              requiredWhen: '必填',
              exampleValue: '<department_field_id>',
            },
          },
        },
      },
    },
    transactorType: {
      description: '多人办理时采用的办理方式，会签：and，或签：or，依次办理：sequential',
      type: 'string',
      requiredWhen: '必填',
      exampleValue: 'and',
    },
    transactorEmpty: {
      description: '办理人为空时的处理方式，指定人员办理：assignee，转交给管理员：admin',
      type: 'string',
      requiredWhen: '选填',
      exampleValue: 'assignee',
    },
    transactorEmptyUsers: {
      description: '办理人为空时，指定人员办理的处理方式',
      type: 'array',
      requiredWhen: '只在 transactorEmpty = assignee 时必填',
      exampleValue: ['<user_id_1>', '<user_id_2>'],
    },
    transactorEmptyAdmin: {
      description: '办理人为空时，转交给管理员的处理方式',
      type: 'string',
      requiredWhen: '只在 transactorEmpty = admin 时必填',
      exampleValue: '<admin_user_id>',
    },
    allowTransfer: {
      description: '是否允许转交',
      type: 'boolean',
      requiredWhen: '选填',
      exampleValue: true,
    },
    transferRange: {
      description: '允许转交时的可转交范围',
      type: 'object',
      requiredWhen: '选填',
      exampleValue: {
        users: {
          description: '允许转交的成员',
          type: 'array',
          requiredWhen: '选填',
          exampleValue: ['<user_id_1>', '<user_id_2>'],
        },
        roles: {
          description: '允许转交的角色',
          type: 'array',
          requiredWhen: '选填',
          exampleValue: ['<role_id_1>', '<role_id_2>'],
        },
      },
    },
    allowRevert: {
      description: '是否允许退回',
      type: 'boolean',
      requiredWhen: '选填',
      exampleValue: true,
    },
    revertRange: {
      description: '允许退回时的可退回节点范围',
      type: 'array',
      requiredWhen: '只在 allowRevert = true 时选填',
      exampleValue: ['<node_key_1>', '<node_key_2>'],
    },
    requireTransactComments: {
      description: '是否需要办理意见',
      type: 'boolean',
      requiredWhen: '选填',
      exampleValue: false,
    },
  },
}

const notifyExample: NocodeEditorFlowNodeExample = {
  nodeType: 'notify',
  description: '抄送节点。至少要明确抄送对象。',
  optionFields: {
    notifier: {
      description: `抄送人。${personnelOwnerContractGuidance}通知节点只能使用 notifier，禁止使用 receivers。`,
      type: 'object',
      requiredWhen: '必填',
      exampleValue: {
        submitter: {
          description: '提交人本人',
          type: 'boolean',
          requiredWhen: '选填',
          exampleValue: true,
        },
        assignee: {
          description: '指定成员/角色',
          type: 'object',
          requiredWhen: '选填',
          exampleValue: {
            roles: {
              description: '角色',
              type: 'array',
              requiredWhen: '选填',
              exampleValue: ['<role_id_1>', '<role_id_2>'],
            },
            users: {
              description: '成员',
              type: 'array',
              requiredWhen: '选填',
              exampleValue: ['<user_id_1>', '<user_id_2>'],
            },
          },
        },
        'department-manager': {
          description: '部门主管',
          type: 'object',
          requiredWhen: '选填',
          exampleValue: {
            mode: {
              description: '模式，up 表示直属部门向上，down 表示最高部门向下',
              type: 'string',
              requiredWhen: '必填',
              exampleValue: 'up',
            },
            value: {
              description: '部门主管加 n 级部门',
              type: 'number',
              requiredWhen: '必填',
              exampleValue: 0,
            },
          },
        },
        'form-member': {
          description: '当前表单内的成员字段',
          type: 'array',
          requiredWhen: '选填',
          exampleValue: ['<member_field_id>'],
        },
        'form-department': {
          description: '当前表单内的部门字段',
          type: 'object',
          requiredWhen: '选填',
          exampleValue: {
            value: {
              description: '部门字段',
              type: 'string',
              requiredWhen: '必填',
              exampleValue: '<department_field_id>',
            },
          },
        },
        'related-node': {
          description: '引用其他节点的相关人员',
          type: 'string',
          requiredWhen: '选填',
          exampleValue: '<node_key>',
        },
      },
    },
  },
}

const reportDataExample: NocodeEditorFlowNodeExample = {
  nodeType: 'report-data',
  description: '数据填报节点。至少要明确目标表单和填报人；如果要求满足条件后才结束，还需要补齐完成条件。',
  optionFields: {
    targetTableUID: {
      description: '目标表单 ID',
      type: 'string',
      requiredWhen: '必填',
      exampleValue: '<target_table_uid>',
    },
    reporter: {
      description: `填报人，是单选的对象，支持多种方式指定填报人。${personnelOwnerContractGuidance}`,
      type: 'object',
      requiredWhen: '必填',
      exampleValue: {
        submitter: {
          description: '提交人本人',
          type: 'boolean',
          requiredWhen: '选填',
          exampleValue: true,
        },
        assignee: {
          description: '指定成员/角色',
          type: 'object',
          requiredWhen: '选填',
          exampleValue: {
            roles: {
              description: '角色',
              type: 'array',
              requiredWhen: '选填',
              exampleValue: ['<role_id_1>'],
            },
            users: {
              description: '成员',
              type: 'array',
              requiredWhen: '选填',
              exampleValue: ['<user_id_1>'],
            },
          },
        },
        'department-manager': {
          description: '部门主管',
          type: 'object',
          requiredWhen: '选填',
          exampleValue: {
            mode: {
              description: '模式，up 表示直属部门向上，down 表示最高部门向下',
              type: 'string',
              requiredWhen: '必填',
              exampleValue: 'up',
            },
            value: {
              description: '部门主管加 n 级部门',
              type: 'number',
              requiredWhen: '必填',
              exampleValue: 0,
            },
          },
        },
        'form-member': {
          description: '当前表单内的成员字段',
          type: 'array',
          requiredWhen: '选填',
          exampleValue: ['<member_field_id>'],
        },
        'form-department': {
          description: '当前表单内的部门字段',
          type: 'object',
          requiredWhen: '选填',
          exampleValue: {
            value: {
              description: '部门字段',
              type: 'string',
              requiredWhen: '必填',
              exampleValue: '<department_field_id>',
            },
          },
        },
      },
    },
    reporterEmpty: {
      description: '填报人为空时的处理方式，指定人员填报：assignee，转交给管理员：admin',
      type: 'string',
      requiredWhen: '选填',
      exampleValue: 'assignee',
    },
    reporterEmptyUser: {
      description: '填报人为空时，指定人员填报的处理方式',
      type: 'string',
      requiredWhen: '只在 reporterEmpty = assignee 时必填',
      exampleValue: '<user_id>',
    },
    reporterEmptyAdmin: {
      description: '填报人为空时，转交给管理员的处理方式',
      type: 'string',
      requiredWhen: '只在 reporterEmpty = admin 时必填',
      exampleValue: '<admin_user_id>',
    },
    requireSatisfyCondition: {
      description: '是否满足条件后才结束',
      type: 'boolean',
      requiredWhen: '选填',
      exampleValue: true,
    },
    finishCondition: {
      description: '完成条件',
      type: 'object',
      requiredWhen: '只在 requireSatisfyCondition = true 时必填',
      exampleValue: {
        sourceTables: {
          description: '条件中可引用的数据来源表',
          type: 'array',
          requiredWhen: '选填',
          exampleValue: [
            {
              name: '<source_table_name>',
              tableUID: '<source_table_uid>',
            },
          ],
        },
        conditions: {
          description: '完成条件表达式',
          type: 'array',
          requiredWhen: '必填',
          exampleValue: [
            [
              {
                fieldName: '<field_name>',
                operator: '=',
                value: '<expected_value>',
              },
            ],
          ],
        },
      },
    },
  },
}
// #endregion


// #region 跨表数据处理节点示例

const addDataExample: NocodeEditorFlowNodeExample = {
  nodeType: 'add-data',
  description: '新增数据节点。至少要明确目标表单，以及新增字段映射。',
  optionFields: {
    target: {
      description: '目标表单',
      type: 'object',
      requiredWhen: '必填',
      exampleValue: {
        formName: {
          description: '目标表单名称',
          type: 'string',
          requiredWhen: '必填',
          exampleValue: '<target_form_name>',
        },
      },
    },
    mapping: {
      description: '新增字段映射',
      type: 'array',
      requiredWhen: '必填',
      exampleValue: [
        {
          targetFieldName: '<target_field_name>',
          valueFieldName: '<source_field_name>',
        },
      ],
    },
    batch: {
      description: '批量新增设置',
      type: 'object',
      requiredWhen: '选填',
      exampleValue: {
        enabled: {
          description: '是否启用批量新增',
          type: 'boolean',
          requiredWhen: '选填',
          exampleValue: true,
        },
        number: {
          description: '批量新增数量或数量字段',
          type: 'string',
          requiredWhen: '只在 batch.enabled = true 时必填',
          exampleValue: '<count_or_count_field>',
        },
      },
    },
  },
}

const editDataExample: NocodeEditorFlowNodeExample = {
  nodeType: 'edit-data',
  description: '修改数据节点。至少要明确目标表单、修改范围，以及更新字段映射。',
  optionFields: {
    target: {
      description: '目标表单',
      type: 'object',
      requiredWhen: '必填',
      exampleValue: {
        formName: {
          description: '目标表单名称',
          type: 'string',
          requiredWhen: '必填',
          exampleValue: '<target_form_name>',
        },
      },
    },
    targetTableDataScope: {
      description: '修改范围，当前表单本条数据：current，历史数据：history',
      type: 'string',
      requiredWhen: '选填',
      exampleValue: 'current',
    },
    filter: {
      description: '更新目标记录的筛选条件',
      type: 'array',
      requiredWhen: '选填',
      exampleValue: [
        {
          fieldName: '<target_field_name>',
          operator: '=',
          valueFieldName: '<source_field_name>',
        },
      ],
    },
    mapping: {
      description: '更新字段映射',
      type: 'array',
      requiredWhen: '必填',
      exampleValue: [
        {
          targetFieldName: '<target_field_name>',
          valueFieldName: '<source_field_name>',
        },
      ],
    },
  },
}

const deleteDataExample: NocodeEditorFlowNodeExample = {
  nodeType: 'delete-data',
  description: '删除数据节点。至少要明确目标表单和删除条件，避免整表删除。',
  optionFields: {
    target: {
      description: '目标表单',
      type: 'object',
      requiredWhen: '必填',
      exampleValue: {
        formName: {
          description: '目标表单名称',
          type: 'string',
          requiredWhen: '必填',
          exampleValue: '<target_form_name>',
        },
      },
    },
    filter: {
      description: '删除条件',
      type: 'array',
      requiredWhen: '必填',
      exampleValue: [
        {
          fieldName: '<target_field_name>',
          operator: '=',
          valueFieldName: '<source_field_name>',
        },
      ],
    },
  },
}

// #endregion


// #region 分支节点示例

const conditionBranchExample: NocodeEditorFlowNodeExample = {
  nodeType: 'condition-branch',
  description: '条件分支节点。关键不在 options，而在 branches 结构本身。至少要有一个有条件的分支；如存在兜底分支，应该放在最后，且不要生成空分支。',
  nodeFields: {
    branches: {
      description: '条件分支数组。每个分支都要写自己的条件和后续节点；可有一个无条件的兜底分支',
      type: 'array',
      requiredWhen: '必填',
      exampleValue: [
        {
          branchKey: 'amount_over_10000',
          label: '金额大于 10000',
          conditions: [
            [
              {
                fieldName: '<field_name>',
                operator: '>',
                value: 10000,
              },
            ],
          ],
          nodes: [
            {
              type: 'approval',
              name: '主管审批',
              options: '<按 approval 节点示例补齐>',
            },
          ],
        },
        {
          branchKey: 'fallback',
          label: '其他分支',
          conditions: [],
          nodes: [
            {
              type: 'notify',
              name: '结果通知',
              options: '<按 notify 节点示例补齐>',
            },
          ],
        },
      ],
    },
  },
}

const parallelBranchExample: NocodeEditorFlowNodeExample = {
  nodeType: 'parallel-branch',
  description: '并行分支节点。关键不在 options，而在 branches 结构本身。至少要有两个并行分支，每个分支都要有实际后续节点。',
  nodeFields: {
    branches: {
      description: '并行分支数组。每个分支只需要名称和分支内节点，不需要写条件',
      type: 'array',
      requiredWhen: '必填',
      exampleValue: [
        {
          branchKey: 'lane_finance',
          label: '财务处理',
          nodes: [
            {
              type: 'transact',
              name: '财务核对',
              options: '<按 transact 节点示例补齐>',
            },
          ],
        },
        {
          branchKey: 'lane_hr',
          label: '人事处理',
          nodes: [
            {
              type: 'notify',
              name: '通知人事',
              options: '<按 notify 节点示例补齐>',
            },
          ],
        },
      ],
    },
  },
}

// #endregion

export const nocodeEditorFlowNodeExamples: Partial<Record<NocodeEditorFlowPlanNodeType, NocodeEditorFlowNodeExample>> = {
  'trigger-data-change': triggerDataChangeExample,
  'trigger-time-task': triggerTimeTaskExample,
  'trigger-operation': triggerOperationExample,
  approval: approvalExample,
  transact: transactExample,
  notify: notifyExample,
  'report-data': reportDataExample,
  'add-data': addDataExample,
  'edit-data': editDataExample,
  'delete-data': deleteDataExample,
  'condition-branch': conditionBranchExample,
  'parallel-branch': parallelBranchExample,
}
