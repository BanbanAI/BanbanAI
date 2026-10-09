import { AiActionDefinition, AiActionKind } from '../ai.types'
import { NOCODE_EDITOR_FLOW_PATCH_MAX_OPERATIONS } from '@common/utils/nocodeEditorFlowPatch'

const nocodeEditorConfirmationSchema = {
  type: 'object',
  description: 'Optional structured confirmation payload. If omitted, callers can still derive confirmation from openQuestions.',
  properties: {
    preferredSurface: {
      type: 'string',
      enum: ['inline', 'drawer', 'gate'],
      description: 'Optional preferred confirmation surface.',
    },
    status: {
      type: 'string',
      enum: ['pending', 'completed'],
      description: 'Optional confirmation status. Use completed only when every question already has an explicit confirmed answer.',
    },
    summary: {
      type: 'string',
      description: 'Optional summary for the confirmation payload.',
    },
    completionSummary: {
      type: 'string',
      description: 'Optional completed-state summary shown once all confirmations are done.',
    },
    resultSummary: {
      type: 'array',
      description: 'Optional completed-state result summary lines that explain how AI will continue.',
      items: { type: 'string' },
    },
    questions: {
      type: 'array',
      description: 'Structured confirmation questions. An explicit empty array is allowed.',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Question identifier.' },
          title: { type: 'string', description: 'Question title.' },
          scopeKind: {
            type: 'string',
            enum: ['overview', 'trigger-branch'],
            description: 'Optional question scope. Use overview for whole-flow questions and trigger-branch for a specific trigger branch.',
          },
          branchKey: {
            type: 'string',
            description: 'Optional trigger branch identifier when scopeKind is trigger-branch.',
          },
          questionKind: {
            type: 'string',
            enum: ['binary', 'single_select', 'note_only'],
            description: 'Question type. Use binary for yes/no style questions, single_select for true single-choice questions, and note_only when the answer should come from supplemental text instead of clickable options.',
          },
          description: { type: 'string', description: 'Optional question details.' },
          required: { type: 'boolean', description: 'Optional required flag.' },
          allowFreeText: { type: 'boolean', description: 'Optional free-text flag.' },
          confirmed: {
            type: 'boolean',
            description: 'Optional question-level completion flag. Set it once the user has explicitly chosen or confirmed the answer.',
          },
          selectedOptionValue: {
            type: 'string',
            description: 'Optional selected option value for completed questions. Keep the question in the array instead of deleting it.',
          },
          answerSummary: {
            type: 'string',
            description: 'Optional short answer summary for completed questions.',
          },
          answerDetail: {
            type: 'string',
            description: 'Optional answer detail shown under completed questions.',
          },
          options: {
            type: 'array',
            description: 'Optional structured options.',
            items: {
              type: 'object',
              properties: {
                value: { type: 'string', description: 'Option value.' },
                label: { type: 'string', description: 'Option label.' },
                description: { type: 'string', description: 'Optional option details.' },
                selected: {
                  type: 'boolean',
                  description: 'Optional option-level selected flag for completed questions.',
                },
              },
              required: ['value', 'label'],
            },
          },
          dependsOn: {
            type: 'array',
            description: 'Optional dependency question ids.',
            items: { type: 'string' },
          },
        },
        required: ['title'],
      },
    },
    allowContinueWithDefaults: {
      type: 'boolean',
      description: 'Optional continue-with-defaults flag.',
    },
    continueLabel: {
      type: 'string',
      description: 'Optional continue action label.',
    },
    secondaryActionLabel: {
      type: 'string',
      description: 'Optional secondary action label for completed confirmation cards.',
    },
    reviewLabel: {
      type: 'string',
      description: 'Optional review action label for completed confirmation cards and drawers.',
    },
  },
  required: ['questions'],
}

const nocodeEditorBlueprintDefaultValueSchema = {
  description: '字段静态默认值。固定文本、数字、布尔值或固定多选值使用本字段；需要动态计算时才使用 formulaSettings。',
  oneOf: [
    { type: 'string' },
    { type: 'number' },
    { type: 'boolean' },
    {
      type: 'array',
      items: { type: 'string' },
    },
  ],
}

const nocodeEditorPlanningConfirmationSchema = {
  ...nocodeEditorConfirmationSchema,
  properties: {
    ...nocodeEditorConfirmationSchema.properties,
    questions: {
      ...nocodeEditorConfirmationSchema.properties.questions,
      items: {
        ...nocodeEditorConfirmationSchema.properties.questions.items,
        properties: {
          ...nocodeEditorConfirmationSchema.properties.questions.items.properties,
          domain: {
            type: 'string',
            enum: ['app', 'form', 'flow', 'unknown'],
            description: 'Question business domain. Use form for fields/data model, flow for process behavior, app for multi-form/module structure.',
          },
        },
        required: ['id', 'title', 'questionKind', 'domain'],
      },
    },
  },
}

const nocodeEditorFlowSchemeConfirmationSchema = {
  ...nocodeEditorConfirmationSchema,
  properties: {
    ...nocodeEditorConfirmationSchema.properties,
    questions: {
      ...nocodeEditorConfirmationSchema.properties.questions,
      items: {
        ...nocodeEditorConfirmationSchema.properties.questions.items,
        additionalProperties: false,
        properties: {
          ...nocodeEditorConfirmationSchema.properties.questions.items.properties,
          decisionKey: {
            type: 'string',
            description: '跨流程版本稳定的业务决策键。同一决策即使标题改写也必须保持不变；不同缺参必须使用不同键。',
          },
        },
        required: ['id', 'decisionKey', 'title', 'questionKind'],
      },
    },
  },
}

const flowIntentSignalSchema: Record<string, any> = {
  type: 'object',
  description: '必填。模型对用户原始需求中是否明确包含表单流程、审批、审核、办理、确认、提交后处理、通过后处理、驳回后处理或归档续接意图的结构化判断。无明确流程意图时必须输出 state=none。只描述用户意图，不代表已经创建流程。',
  properties: {
    state: {
      type: 'string',
      enum: ['explicit_positive', 'explicit_negative', 'none'],
      description: 'explicit_positive 表示用户明确要求创建流程；explicit_negative 表示用户明确不要流程；none 表示没有明确流程意图。',
    },
    confidence: {
      type: 'string',
      enum: ['high', 'medium', 'low'],
      description: '只有用户原话或工作台转交原始需求有明确动作证据时才用 high；仅从表单名、字段名或行业常识推断时使用 medium 或 low。',
    },
    evidence: {
      type: 'array',
      items: { type: 'string' },
      description: '必须摘自用户原始需求或工作台转交原始需求的短语，例如“提交后部门负责人审批”。不要填写模型推理补全的句子。',
    },
    targetFormName: {
      type: 'string',
      description: '如果流程意图明确指向某张表单，填写表单名；多表但目标不明确时留空。',
    },
  },
  required: ['state', 'confidence', 'evidence'],
}

const flowPlanNodeTypes = [
  'approval',
  'transact',
  'notify',
  'report-data',
  'add-data',
  'edit-data',
  'delete-data',
  'condition-branch',
  'parallel-branch',
]

const flowPlanTriggerNodeTypes = [
  'trigger-data-change',
  'trigger-time-task',
  'trigger-operation',
]

const flowPlanNodeSchema: Record<string, any> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    nodeKey: { type: 'string', description: '节点稳定标识，可选。需要跨节点引用时优先提供。' },
    type: {
      type: 'string',
      enum: flowPlanNodeTypes,
      description: '节点类型，只能是 approval / transact / notify / report-data / add-data / edit-data / delete-data / condition-branch / parallel-branch。',
    },
    name: { type: 'string', description: '节点展示名称，可选。' },
    options: {
      type: 'object',
      description: '节点配置。editor_get_flow_summary 只负责提供节点目录和业务证据，不再提供详细结构 contract；真正输出这里的 options 前，如果结构不确定，应先调用 editor_get_flow_node_examples，按返回的字段层级、exampleValue 和 requiredWhen 组织完整配置，不要再依赖旧 semanticOptions 简化心智。',
    },
    branches: {
      type: 'array',
      description: '分支节点专用。condition-branch 与 parallel-branch 通过 branches[] 表达分支。condition-branch 下如果存在“其他情况/否则/未命中以上条件”的兜底路径，最多只能有 1 个兜底分支。',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          branchKey: { type: 'string', description: '分支稳定标识，可选。' },
          label: { type: 'string', description: '分支名称。' },
          conditions: {
            type: 'array',
            description: '条件分支的条件组；并行分支通常留空数组。对 condition-branch 而言，conditions 为空通常表示“其他情况/否则”的兜底分支；同一个 condition-branch 下不要并列生成多个 conditions 为空的分支。',
            items: {
              type: 'array',
              items: { type: 'object' },
            },
          },
          nodes: {
            type: 'array',
            description: '该分支内部的后续节点。',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                nodeKey: { type: 'string' },
                type: { type: 'string', enum: flowPlanNodeTypes },
                name: { type: 'string' },
                options: { type: 'object' },
                branches: {
                  type: 'array',
                  items: { type: 'object' },
                },
              },
              required: ['type'],
            },
          },
        },
        required: ['nodes'],
      },
    },
  },
  required: ['type'],
}

const flowPlanTriggerNodeSchema: Record<string, any> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    nodeKey: { type: 'string', description: '触发节点稳定标识，可选。需要跨节点引用时优先提供。' },
    type: {
      type: 'string',
      enum: flowPlanTriggerNodeTypes,
      description: '触发节点类型，只能是 trigger-data-change / trigger-time-task / trigger-operation。',
    },
    name: { type: 'string', description: '触发节点展示名称，可选。' },
    options: {
      type: 'object',
      description: '触发节点配置。editor_get_flow_summary 只负责提供节点目录和业务证据，不再提供详细结构 contract；真正输出这里的 options 前，如果结构不确定，应先调用 editor_get_flow_node_examples，按返回的字段层级、exampleValue 和 requiredWhen 组织完整配置。',
    },
  },
  required: ['type'],
}

const flowPlanTriggerBranchSchema: Record<string, any> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    branchKey: { type: 'string', description: '触发分支稳定标识，可选。' },
    label: { type: 'string', description: '触发分支名称，可选。优先使用触发节点业务名称。' },
    triggerNode: flowPlanTriggerNodeSchema,
    nodes: {
      type: 'array',
      description: '该触发分支下的完整后续节点链路。多个触发分支之间不共享尾链。',
      items: flowPlanNodeSchema,
    },
  },
  required: ['triggerNode', 'nodes'],
}

const flowPatchStringSchema = { type: 'string', minLength: 1 }
const flowPatchOptionsSchema = { type: 'object' }
const flowPatchPositionProperties = {
  afterNodeKey: flowPatchStringSchema,
  beforeNodeKey: flowPatchStringSchema,
}
const flowPatchOperationSchemas: Array<Record<string, unknown>> = [
  {
    type: 'object',
    additionalProperties: false,
    maxProperties: 5,
    properties: {
      op: { type: 'string', const: 'add' },
      tempKey: flowPatchStringSchema,
      parentBranchKey: flowPatchStringSchema,
      ...flowPatchPositionProperties,
      node: {
        type: 'object',
        additionalProperties: false,
        properties: {
          type: {
            type: 'string',
            enum: [
              'approval',
              'transact',
              'notify',
              'report-data',
              'add-data',
              'edit-data',
              'delete-data',
            ],
          },
          name: flowPatchStringSchema,
          options: flowPatchOptionsSchema,
        },
        required: ['type'],
      },
    },
    required: ['op', 'tempKey', 'parentBranchKey', 'node'],
  },
  {
    type: 'object',
    additionalProperties: false,
    properties: {
      op: { type: 'string', const: 'update' },
      nodeKey: flowPatchStringSchema,
      changes: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
          name: flowPatchStringSchema,
          options: flowPatchOptionsSchema,
        },
      },
    },
    required: ['op', 'nodeKey', 'changes'],
  },
  {
    type: 'object',
    additionalProperties: false,
    properties: {
      op: { type: 'string', const: 'remove' },
      nodeKey: flowPatchStringSchema,
    },
    required: ['op', 'nodeKey'],
  },
  {
    type: 'object',
    additionalProperties: false,
    maxProperties: 4,
    properties: {
      op: { type: 'string', const: 'move' },
      nodeKey: flowPatchStringSchema,
      parentBranchKey: flowPatchStringSchema,
      ...flowPatchPositionProperties,
    },
    required: ['op', 'nodeKey', 'parentBranchKey'],
  },
]

const flowSchemeQuestionSchema: Record<string, any> = {
  type: 'object',
  properties: {
    key: { type: 'string', description: '待确认业务决策键，必须与对应 confirmation.questions[].decisionKey 一致。' },
    title: { type: 'string', description: '问题标题。' },
    reason: { type: 'string', description: '为什么当前需要确认这个问题。' },
    scopeKind: {
      type: 'string',
      enum: ['global', 'step', 'branch'],
      description: '问题作用域。global 表示整体方案，step 表示某个步骤，branch 表示某个分支。',
    },
    scopeKey: { type: 'string', description: '问题作用域 key，可选。' },
  },
  required: ['key', 'title', 'reason'],
}

const flowPersonnelSourceTypes = [
  'submitter',
  'submitter_manager',
  'fixed_users',
  'fixed_roles',
  'department_manager',
  'form_member',
  'form_department',
  'unresolved',
]

const flowPersonnelRefSchema: Record<string, any> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string', minLength: 1, description: '人员或角色 ID，可选。' },
    name: { type: 'string', minLength: 1, description: '人员或角色名称，可选。' },
  },
  anyOf: [
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        id: { type: 'string', minLength: 1, description: '人员或角色 ID，可选。' },
        name: { type: 'string', minLength: 1, description: '人员或角色名称，可选。' },
      },
      required: ['id'],
    },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        id: { type: 'string', minLength: 1, description: '人员或角色 ID，可选。' },
        name: { type: 'string', minLength: 1, description: '人员或角色名称，可选。' },
      },
      required: ['name'],
    },
  ],
}

const flowPersonnelUserRefsSchema: Record<string, any> = {
  type: 'array',
  description: 'fixed_users 来源的固定人员引用。',
  items: flowPersonnelRefSchema,
}

const flowPersonnelRoleRefsSchema: Record<string, any> = {
  type: 'array',
  description: 'fixed_roles 来源的固定角色引用。',
  items: flowPersonnelRefSchema,
}

const createFlowPersonnelFieldRefSchema = (
  expectedType?: 'memberSelect' | 'departmentSelect',
): Record<string, any> => ({
  type: 'object',
  additionalProperties: false,
  properties: {
    fieldId: { type: 'string', description: '表单字段 ID，可选。' },
    fieldName: { type: 'string', description: '表单字段名称，可选。' },
    expectedType: expectedType
      ? {
        type: 'string',
        const: expectedType,
        description: `该来源必须使用 ${expectedType} 字段。`,
      }
      : {
        type: 'string',
        enum: ['memberSelect', 'departmentSelect'],
        description: 'form_member 必须使用 memberSelect，form_department 必须使用 departmentSelect。',
      },
  },
})

const flowPersonnelFieldRefSchema = createFlowPersonnelFieldRefSchema()
const flowPersonnelMemberFieldRefSchema = createFlowPersonnelFieldRefSchema('memberSelect')
const flowPersonnelDepartmentFieldRefSchema = createFlowPersonnelFieldRefSchema('departmentSelect')

const flowPersonnelDepartmentManagerSchema: Record<string, any> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    mode: {
      type: 'string',
      enum: ['up', 'down'],
      description: '部门主管查找方向。',
    },
    level: {
      type: 'number',
      minimum: 1,
      multipleOf: 1,
      description: '部门主管层级，从 1 开始。',
    },
  },
  required: ['mode', 'level'],
}

const flowPersonnelEmptyHandlerSchema: Record<string, any> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    mode: {
      type: 'string',
      enum: ['auto_approve', 'admin', 'fixed_users', 'none', 'unresolved'],
      description: '人员来源为空时的处理方式。',
    },
    userRefs: {
      type: 'array',
      description: 'mode 为 fixed_users 时使用的兜底人员引用。',
      items: flowPersonnelRefSchema,
    },
  },
  required: ['mode'],
}

const flowPersonnelRequirementSchema: Record<string, any> = {
  type: 'object',
  additionalProperties: false,
  description: '可选的结构化人员来源。来源未定时必须使用 unresolved 并向用户提问；固定角色或固定人员当前不存在时，仍在对应 refs 中保留名称，供生成后补齐。',
  properties: {
    sourceType: {
      type: 'string',
      enum: flowPersonnelSourceTypes,
      description: '人员来源判别字段。不要根据 actorHint 猜测来源。',
    },
    userRefs: flowPersonnelUserRefsSchema,
    roleRefs: flowPersonnelRoleRefsSchema,
    fieldRef: flowPersonnelFieldRefSchema,
    departmentManager: flowPersonnelDepartmentManagerSchema,
    emptyHandler: flowPersonnelEmptyHandlerSchema,
  },
  required: ['sourceType'],
  oneOf: [
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        sourceType: { type: 'string', const: 'submitter' },
        emptyHandler: flowPersonnelEmptyHandlerSchema,
      },
      required: ['sourceType'],
    },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        sourceType: { type: 'string', const: 'submitter_manager' },
        emptyHandler: flowPersonnelEmptyHandlerSchema,
      },
      required: ['sourceType'],
    },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        sourceType: { type: 'string', const: 'fixed_users' },
        userRefs: flowPersonnelUserRefsSchema,
        emptyHandler: flowPersonnelEmptyHandlerSchema,
      },
      required: ['sourceType'],
    },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        sourceType: { type: 'string', const: 'fixed_roles' },
        roleRefs: flowPersonnelRoleRefsSchema,
        emptyHandler: flowPersonnelEmptyHandlerSchema,
      },
      required: ['sourceType'],
    },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        sourceType: { type: 'string', const: 'department_manager' },
        departmentManager: flowPersonnelDepartmentManagerSchema,
        emptyHandler: flowPersonnelEmptyHandlerSchema,
      },
      required: ['sourceType'],
    },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        sourceType: { type: 'string', const: 'form_member' },
        fieldRef: flowPersonnelMemberFieldRefSchema,
        emptyHandler: flowPersonnelEmptyHandlerSchema,
      },
      required: ['sourceType'],
    },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        sourceType: { type: 'string', const: 'form_department' },
        fieldRef: flowPersonnelDepartmentFieldRefSchema,
        emptyHandler: flowPersonnelEmptyHandlerSchema,
      },
      required: ['sourceType'],
    },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        sourceType: { type: 'string', const: 'unresolved' },
      },
      required: ['sourceType'],
    },
  ],
}

const flowSchemeStepSchema: Record<string, any> = {
  type: 'object',
  properties: {
    key: { type: 'string', minLength: 1, description: '步骤稳定标识。' },
    kind: {
      type: 'string',
      description: '步骤类型，只能是 approval / notify / transact / report-data / add-data / edit-data / delete-data / condition-branch。',
    },
    title: { type: 'string', description: '步骤标题。' },
    intent: { type: 'string', description: '这一步的业务意图描述。' },
    personnelRequirement: flowPersonnelRequirementSchema,
    actorHint: { type: 'string', description: '执行人/角色提示，可选。' },
    targetHint: { type: 'string', description: '目标对象提示，可选。' },
    conditionHint: { type: 'string', description: '条件说明提示，可选。' },
  },
  required: ['key', 'kind', 'title', 'intent'],
}

const flowSchemeBranchSchema: Record<string, any> = {
  type: 'object',
  properties: {
    key: { type: 'string', description: '分支稳定标识。' },
    title: { type: 'string', description: '分支标题。' },
    when: { type: 'string', description: '分支触发条件或进入时机的自然语言描述。' },
    steps: {
      type: 'array',
      description: '该分支内的语义步骤列表。',
      items: flowSchemeStepSchema,
    },
  },
  required: ['key', 'title', 'when', 'steps'],
}

const flowSchemeSchema: Record<string, any> = {
  type: 'object',
  properties: {
    id: { type: 'string', description: '方案 ID，可选。' },
    title: { type: 'string', description: '方案标题。' },
    summary: { type: 'string', description: '当前方案摘要。' },
    target: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: '目标表单 ID，可选。' },
        formName: { type: 'string', description: '目标表单名称，可选。' },
      },
    },
    trigger: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['submit', 'update', 'manual', 'schedule', 'unknown'],
          description: '方案层的触发方式。',
        },
        description: {
          type: 'string',
          description: '对触发方式的自然语言解释。',
        },
      },
      required: ['type', 'description'],
    },
    mainPath: {
      type: 'array',
      description: '主链路语义步骤，可以为空数组。',
      items: flowSchemeStepSchema,
    },
    branches: {
      type: 'array',
      description: '分支语义步骤，可以为空数组。若表达“其他情况/否则”的兜底分支语义，应在同一层级最多只保留 1 个兜底分支，不要并列生成多个语义重复的兜底分支。',
      items: flowSchemeBranchSchema,
    },
    confirmedFacts: {
      type: 'array',
      description: '已明确确认的事实。',
      items: { type: 'string' },
    },
    assumptions: {
      type: 'array',
      description: '当前仍然采用的假设。',
      items: { type: 'string' },
    },
    openQuestions: {
      type: 'array',
      description: '仍需用户确认的问题。一个问题只表达一个缺失决策槽；只要这里非空，confirmation.questions 就必须完整覆盖这些当前待确认问题。',
      items: flowSchemeQuestionSchema,
    },
    dependencies: {
      type: 'array',
      description: '可选。由运行时或模型补充的结构化依赖列表。若不确定，可省略并由运行时回填。',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          kind: {
            type: 'string',
            enum: ['field_missing', 'field_policy_mismatch', 'source_table_missing', 'org_anchor_missing', 'mapping_conflict', 'capability_gap'],
          },
          requiredFor: {
            type: 'string',
            enum: ['approval_owner', 'condition', 'writeback', 'source_mapping', 'notify_target', 'trigger_schedule', 'owner_binding'],
          },
          scopeKind: {
            type: 'string',
            enum: ['global', 'step', 'branch'],
          },
          scopeKey: { type: 'string' },
          scopeTitle: { type: 'string' },
          targetFormId: { type: 'string' },
          targetFormName: { type: 'string' },
          fieldRef: {
            type: 'object',
            description: '字段类依赖的明确目标。已确认审批人来自表单成员字段时，use_existing + existing 必须提供当前目标表单真实 fieldId 与 fieldName；create_later + planned 必须提供 fieldName 与成员组件 expectedType=memberSelect，供应用流程前确定性创建字段。',
            properties: {
              fieldId: { type: 'string' },
              fieldName: { type: 'string' },
              expectedType: { type: 'string' },
            },
          },
          riskLevel: { type: 'string', enum: ['low', 'high'] },
          resolutionStatus: {
            type: 'string',
            enum: ['unresolved', 'resolved'],
            description: '依赖是否已在方案层收敛。若用户已明确接受“后续新增字段/表/组织锚点后再使用”，这里必须填 resolved，不要继续保留 unresolved。',
          },
          resolutionMode: {
            type: 'string',
            enum: ['use_existing', 'create_later', 'switch_strategy', 'remove_design', 'specify_org_anchor'],
            description: '依赖采用哪种收敛方式。若是后续补建资源再使用，对应填 create_later。',
          },
          materializationStatus: {
            type: 'string',
            enum: ['existing', 'planned', 'not_available'],
            description: '依赖资源当前是否已经物化存在。后续补建但当前不存在时必须填 planned，不能伪装成 existing。',
          },
          summary: { type: 'string' },
        },
        required: [
          'id',
          'kind',
          'requiredFor',
          'scopeKind',
          'riskLevel',
          'resolutionStatus',
          'materializationStatus',
          'summary',
        ],
      },
    },
    deferredConfigItems: {
      type: 'array',
      description: '可选。生成后配置项列表；运行时可以回填。',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          nodeKey: { type: 'string' },
          nodeTitle: { type: 'string' },
          category: {
            type: 'string',
            enum: ['owner_binding', 'fallback_handler', 'data_target', 'field_mapping', 'condition_detail', 'schedule_detail', 'notification_detail', 'reminder_detail', 'advanced_option', 'copywriting', 'display'],
          },
          requirementLevel: { type: 'string', enum: ['required', 'optional'] },
          supportStatus: { type: 'string', enum: ['runtime_supported', 'needs_runtime_support'] },
          summary: { type: 'string' },
          fillTiming: { type: 'string', enum: ['after_generation'] },
          severity: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['id', 'category', 'requirementLevel', 'supportStatus', 'summary', 'fillTiming', 'severity'],
      },
    },
    convergence: {
      type: 'object',
      description: '可选。由运行时补充的流程规划收敛状态摘要。',
      properties: {
        businessStatus: { type: 'string', enum: ['pending', 'resolved'] },
        dependencyStatus: { type: 'string', enum: ['pending', 'resolved'] },
        materializationStatus: { type: 'string', enum: ['all_existing', 'has_planned_dependencies'] },
        unresolvedQuestionCount: { type: 'number', minimum: 0, multipleOf: 1 },
        unresolvedDependencyCount: { type: 'number', minimum: 0, multipleOf: 1 },
        plannedDependencyCount: { type: 'number', minimum: 0, multipleOf: 1 },
        requiredDeferredConfigCount: { type: 'number', minimum: 0, multipleOf: 1 },
        optionalDeferredConfigCount: { type: 'number', minimum: 0, multipleOf: 1 },
        deferredConfigItemCount: { type: 'number', minimum: 0, multipleOf: 1 },
      },
    },
    confirmation: nocodeEditorFlowSchemeConfirmationSchema,
  },
  required: [
    'title',
    'summary',
    'trigger',
    'mainPath',
    'branches',
    'confirmedFacts',
    'assumptions',
    'openQuestions',
  ],
}

export const nocodeEditorToolDefinitions: AiActionDefinition[] = [
  {
    name: 'editor_get_host_context',
    kind: AiActionKind.FUNCTION,
    description: '读取当前低代码编辑器宿主状态，包括当前模式、当前激活表单以及可用表单列表。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'editor_create_form',
    kind: AiActionKind.FUNCTION,
    description: '在当前应用中直接创建一个新表单，并自动切换到该表单的表单设计态。适合用户明确要“先建一个空白/简化表单壳子”“轻量起手”或明确要求直接先建空表时使用；对于“从零帮我搭一个完整问卷/登记表/申请单”这类需求，默认不能拿它代替前置的表单规划清单阶段。',
    inputSchema: {
      type: 'object',
      properties: {
        tableName: { type: 'string', description: '要创建的表单名称。' },
        groupName: { type: 'string', description: '可选，创建到哪个分组下；如果分组不存在，会先自动创建分组。' },
      },
      required: ['tableName'],
    },
  },
  {
    name: 'editor_open_form',
    kind: AiActionKind.FUNCTION,
    description: '在低代码编辑器中打开指定表单。优先传 tableId；如果没有 tableId，可以传 tableName。',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        tableId: { type: 'string', description: '目标表单 ID。' },
        tableName: { type: 'string', description: '目标表单名称。' },
        tab: {
          type: 'string',
          enum: ['form-design', 'process-setting'],
          description: '可选。打开表单后切到哪个编辑页签；流程规划续接时可使用 process-setting。',
        },
      },
    },
  },
  {
    name: 'editor_get_current_task_context',
    kind: AiActionKind.FUNCTION,
    description: '读取当前已打开表单的指定任务上下文。特别是在调用 editor_open_form 切换表单后，如果后续还要生成或修改公式、默认值公式等依赖字段 token 的设置，必须先重新读取这份上下文，不能继续沿用切表前的上下文。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'editor_stage_app_plan',
    kind: AiActionKind.FUNCTION,
    description: '暂存一份应用级整体规划，并产出可供查看的“应用结构预览”，用于在当前应用内从零搭建完整应用结构、重构整体结构、新增会影响多表关系的业务模块或重新梳理核心对象关系。它只进入应用规划阶段，不代表表单、字段、流程或看板已经创建完成；如果目标只是新增单张完整表单，必须优先使用 editor_stage_single_form_plan。如果提供 outline，outline.forms 必须列出真实表单节点，每项至少包含 tableName；如果 outline.forms 只有部分有效项，仍应补齐缺失表单，不要只给 title、summary、modules 而遗漏 forms。',
    inputSchema: {
      type: 'object',
      properties: {
        plan: {
          type: 'object',
          properties: {
            id: { type: 'string', description: '规划 ID，可选。' },
            mode: { type: 'string', description: 'greenfield 或 delta-extension。' },
            goal: { type: 'string', description: '应用搭建目标。' },
            objects: {
              type: 'array',
              items: { type: 'string' },
              description: '核心业务对象。',
            },
            artifacts: {
              type: 'array',
              description: '规划制品清单。',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', description: 'form / board / process / formula / page-view / field-group / artifact。' },
                  name: { type: 'string', description: '制品名称。' },
                  executionLevel: { type: 'string', description: 'executable_now / need_confirm / planning_only。' },
                  purpose: { type: 'string', description: '制品用途。' },
                },
                required: ['type', 'name'],
              },
            },
            openQuestions: {
              type: 'array',
              items: { type: 'string' },
              description: '仍需用户确认的问题。',
            },
            flowIntent: flowIntentSignalSchema,
            confirmation: nocodeEditorPlanningConfirmationSchema,
            outline: {
              type: 'object',
              description: '可选，用于“应用结构预览”展示的结构摘要。沿用 title、summary、forms、modules、flows；如果提供 outline，必须包含真实表单节点 forms[]，每项至少提供 tableName，且部分有效时仍要补齐。',
              properties: {
                title: { type: 'string', description: '应用结构预览标题。' },
                summary: { type: 'string', description: '应用结构预览摘要。' },
                flowIntent: flowIntentSignalSchema,
                confirmation: nocodeEditorPlanningConfirmationSchema,
                forms: {
                  type: 'array',
                  description: '真实表单节点列表，不是字段分组、内容板块或纯模块名；每项至少提供 tableName。',
                  items: {
                    type: 'object',
                    properties: {
                      formKey: { type: 'string', description: '稳定表单 key，可选。' },
                      tableName: { type: 'string', description: '真实表单名称，必填。' },
                      groupName: { type: 'string', description: '所属模块或分组，可选。' },
                      description: { type: 'string', description: '表单用途说明，可选。' },
                    },
                  },
                },
                modules: {
                  type: 'array',
                  description: '模块或分组摘要，可用 formKeys/formNames 引用 forms 中的真实表单。',
                },
                flows: {
                  type: 'array',
                  description: '表单之间的流程或关系连线，可选。',
                },
              },
            },
          },
          required: ['mode', 'goal', 'objects', 'artifacts', 'openQuestions', 'flowIntent'],
        },
      },
      required: ['plan'],
    },
  },
  {
    name: 'editor_stage_single_form_plan',
    kind: AiActionKind.FUNCTION,
    description: '暂存一份单表单规划，并在存在关联结构时补充“应用结构预览”，用于“空应用直接创建一张完整表单”或“已有应用里新增单张完整表单”的高频场景。这是单表单规划工具，只描述这一张真实表单的目标、关键字段范围和待确认项；forms 默认只保留 1 条真实表单，不能把同一张表里的内容分组扩成多表。modules / flows 在单表场景通常留空或省略，不要因为申请信息、明细、附件等内容分组就扩成多模块或多表单。groupName 仅在用户明确指定分组时填写；如果 openQuestions 为空，说明单表单规划已可继续，应在同一用户回合继续调用 editor_stage_app_blueprint 生成详细蓝图；如果 openQuestions 不为空，才停在规划确认阶段等待用户补充。',
    inputSchema: {
      type: 'object',
      properties: {
        outline: {
          type: 'object',
          properties: {
            id: { type: 'string', description: '方案 ID，可选。' },
            title: { type: 'string', description: '方案标题。' },
            summary: { type: 'string', description: '方案摘要。只写表单业务目标和关键限制，不要重复 form.description 的字段范围，不要包含审批流程设计。' },
            assumptions: {
              type: 'array',
              items: { type: 'string' },
              description: '当前假设。',
            },
            openQuestions: {
              type: 'array',
              items: { type: 'string' },
              description: '仍需用户确认的问题。',
            },
            flowIntent: flowIntentSignalSchema,
            confirmation: nocodeEditorPlanningConfirmationSchema,
            forms: {
              type: 'array',
              description: '单表单规划中的真实表单列表。默认只保留 1 条真实表单，不要把同一张表里的内容分组拆成多条 form。',
              items: {
                type: 'object',
                properties: {
                  formKey: { type: 'string', description: '表单稳定标识，可选。' },
                  tableName: { type: 'string', description: '表单名称。' },
                  groupName: { type: 'string', description: '表单所属分组/模块名称。仅在用户明确指定要放入某个分组或模块时填写。' },
                  groupNameExplicit: { type: 'boolean', description: '仅当用户明确要求放入某分组/模块时为 true；模型自行推断或默认分组时不要设置为 true。' },
                  description: { type: 'string', description: '表单职责说明。只写主要字段分组或字段范围，不要重复 outline.summary 的方案摘要，不要包含审批流程设计。' },
                },
                required: ['tableName'],
              },
            },
            modules: {
              type: 'array',
              description: '流程图模块。单表场景通常留空或省略；不要把同一张表里的内容分组扩成多个模块。',
              items: {
                type: 'object',
                properties: {
                  moduleKey: { type: 'string', description: '模块稳定标识，可选。' },
                  name: { type: 'string', description: '模块名称。' },
                  description: { type: 'string', description: '模块职责说明。' },
                  color: { type: 'string', description: '可选，模块展示色。' },
                  formKeys: {
                    type: 'array',
                    description: '模块内包含的表单标识列表。',
                    items: { type: 'string' },
                  },
                },
                required: ['name'],
              },
            },
            flows: {
              type: 'array',
              description: '核心业务流转关系，from/to 请引用表单 formKey 或表单名称。单表场景通常留空或省略，不要为了表达内容分组补出多表流转。',
              items: {
                type: 'object',
                properties: {
                  from: { type: 'string', description: '起点表单 formKey 或表单名称。' },
                  to: { type: 'string', description: '终点表单 formKey 或表单名称。' },
                  label: { type: 'string', description: '可选，连线说明。' },
                },
                required: ['from', 'to'],
              },
            },
          },
          required: ['forms', 'flowIntent'],
        },
      },
      required: ['outline'],
    },
  },
  {
    name: 'editor_stage_content_plan',
    kind: AiActionKind.FUNCTION,
    description: '暂存一份非应用级的内容规划，只用于已有应用内新增单个看板/页面或局部内容调整。新的公式请求必须使用 editor_stage_formula_plan；表单流程必须使用专门的流程规划工具。当需求影响多个表单关系、模块结构或核心业务流转时，应升级为应用规划。',
    inputSchema: {
      type: 'object',
      properties: {
        plan: {
          type: 'object',
          properties: {
            scope: {
              type: 'string',
              enum: ['board', 'form-local', 'local'],
              description: '规划层级，只能是 board / form-local / local。scope 才是这里的规划边界字段。form-local 表示已有表单内局部内容规划，不表示新增完整表单；新的公式请求不使用本工具。',
            },
            title: { type: 'string', description: '内容规划标题。' },
            target: {
              type: 'object',
              properties: {
                kind: { type: 'string', description: '目标对象类型，例如 board、page、form-local 或 local；它只用于描述目标对象，不用于替代 scope 做规划边界判定；不要用 form 表示新增完整表单。' },
                name: { type: 'string', description: '目标对象名称。' },
                formName: { type: 'string', description: '可选，所属表单名称；用于表单内局部内容规划。' },
              },
              required: ['kind', 'name'],
            },
            summary: { type: 'string', description: '本次内容规划摘要。' },
            items: {
              type: 'array',
              description: '规划清单，描述看板指标、内容分组或局部调整项。',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', description: '规划项类型，例如 metric、section、step、formula、field-rule。' },
                  name: { type: 'string', description: '规划项名称。' },
                  purpose: { type: 'string', description: '规划项目的目的或说明。' },
                  executionLevel: {
                    type: 'string',
                    description: '执行层级：executable_now / need_confirm / planning_only。',
                  },
                },
                required: ['name'],
              },
            },
            openQuestions: {
              type: 'array',
              items: { type: 'string' },
              description: '仍需用户确认的问题。',
            },
            confirmation: nocodeEditorConfirmationSchema,
          },
          required: ['scope', 'title', 'target', 'summary', 'items', 'openQuestions'],
        },
      },
      required: ['plan'],
    },
  },
  {
    name: 'editor_stage_formula_plan',
    kind: AiActionKind.FUNCTION,
    description: '暂存当前已打开表单的字段公式计划。plan_only 永不写入；plan_and_apply 且没有 openQuestions 时，Host 会保持模型工具循环，模型必须在下一次工具调用中显式调用 editor_set_field_formulas({ useStagedPlan: true })，且不得传 items；Host 只执行自身 staged preflight，不会代替模型注入或执行写入。只要存在 openQuestions，必须停止并走确认框架。目标字段缺失时会被标记为 skipped；不要新增字段，不得调用 editor_add_fields 或 editor_replace_field。模型不得提供任务、应用或表单身份，这些身份由 Host 从当前运行态取得。',
    inputSchema: {
      type: 'object',
      properties: {
        plan: {
          type: 'object',
          properties: {
            title: { type: 'string', description: '公式计划标题。' },
            summary: { type: 'string', description: '公式计划摘要。' },
            executionIntent: {
              type: 'string',
              enum: ['plan_only', 'plan_and_apply'],
              description: 'plan_only 只暂存；plan_and_apply 在无待确认项时可继续调用公式写入工具。',
            },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  itemKey: { type: 'string', description: '计划项稳定标识。' },
                  target: {
                    type: 'object',
                    properties: {
                      formKey: { type: 'string' },
                      formName: { type: 'string' },
                      fieldKey: { type: 'string' },
                      fieldName: { type: 'string', description: '目标字段名称。' },
                    },
                    required: ['fieldName'],
                  },
                  formulaSettings: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        formulaPath: { type: 'string', enum: ['default-formula', 'compute-formula'] },
                        formula: { type: 'string', description: '公式表达式中的字段引用必须使用 [[field:fieldKey,字段标题]]，fieldKey 来自 editor_get_form_summary。' },
                        explanation: { type: 'string' },
                      },
                      required: ['formulaPath', 'formula'],
                    },
                  },
                },
                required: ['itemKey', 'target', 'formulaSettings'],
              },
            },
            openQuestions: {
              type: 'array',
              items: { type: 'string' },
              description: '仍需用户确认的问题。',
            },
          },
          required: ['title', 'summary', 'executionIntent', 'items', 'openQuestions'],
        },
      },
      required: ['plan'],
    },
  },
  {
    name: 'editor_get_flow_summary',
    kind: AiActionKind.FUNCTION,
    description: '读取当前打开表单的流程生成上下文，只返回三类信息：organization（组织管理信息，如用户/角色/部门）、forms（当前表单与可引用表单的字段和当前流程摘要）、availableFlowNodes（可用流程节点目录，含节点 type、名称、分类、作用和简洁设置项说明）。字段摘要会额外返回紧凑字段能力快照，包括回写能力 writePolicy、条件能力 conditionPolicy、审批人/办理人能力 ownerPolicy，以及系统字段标记、枚举来源模式 enumSourceType 与少量 enumOptionsPreview，帮助区分可回写字段、可用于条件的字段和适合解析审批人/办理人的字段。它不再负责提供详细节点结构 contract；如果需要具体节点 options 结构、exampleValue 或 requiredWhen，改用 editor_get_flow_node_examples。它只读取，不会改动当前表单流程。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'editor_patch_flow',
    kind: AiActionKind.FUNCTION,
    description: '对当前已有表单流程执行原子节点级局部修改。只能使用最近一次 editor_get_flow_summary 返回的 formId、processVersion、flowFingerprint、nodeKey 和 branchKey；只修改草稿，不启用版本；不支持的分支结构调整会返回 requires_full_rebuild。',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        target: {
          type: 'object',
          additionalProperties: false,
          properties: {
            formId: flowPatchStringSchema,
            processVersion: {
              type: 'number',
              minimum: 1,
              multipleOf: 1,
            },
            flowFingerprint: flowPatchStringSchema,
          },
          required: ['formId', 'processVersion', 'flowFingerprint'],
        },
        operations: {
          type: 'array',
          minItems: 1,
          maxItems: NOCODE_EDITOR_FLOW_PATCH_MAX_OPERATIONS,
          items: {
            oneOf: flowPatchOperationSchemas,
          },
        },
        summary: flowPatchStringSchema,
      },
      required: ['target', 'operations'],
    },
  },
  {
    name: 'editor_get_flow_node_examples',
    kind: AiActionKind.FUNCTION,
    description: '按需读取流程节点结构示例。适合在输出最终流程蓝图前，针对本次会用到的节点类型补充关键 options 结构、字段语义、exampleValue 与 requiredWhen。不要一次查询全部节点，只查询当前蓝图真正会生成的节点；若涉及 conditions、filter、finishCondition 等条件结构，可额外请求通用 operator 参考。',
    inputSchema: {
      type: 'object',
      properties: {
        nodeTypes: {
          type: 'array',
          description: '本次需要参考结构的节点类型列表。',
          items: {
            type: 'string',
            enum: [
              'trigger-data-change',
              'trigger-time-task',
              'trigger-operation',
              'approval',
              'transact',
              'notify',
              'report-data',
              'add-data',
              'edit-data',
              'delete-data',
              'condition-branch',
              'parallel-branch',
            ],
          },
        },
        includeConditionOperatorGuide: {
          type: 'boolean',
          description: '可选。若本次蓝图涉及 conditions、filter、finishCondition、branch.conditions 等条件结构，可设为 true 一并返回通用 operator 参考。',
        },
      },
      required: ['nodeTypes'],
    },
  },
  {
    name: 'editor_plan_flow_scheme',
    kind: AiActionKind.FUNCTION,
    description: '暂存一份当前表单的流程方案快照，用于需求澄清、方案规划和确认问题收敛。它只负责表达“当前打算怎么设计流程、还缺哪些关键信息”，不直接输出最终流程蓝图节点图。普通聊天阶段必须用它与用户沟通流程方案；如果还有待确认问题，不要直接进入蓝图输出。调用本工具时，顶层输入必须且只能是 { scheme: FlowScheme }。',
    notes: [
      '严格格式要求：工具 input 顶层只能有 scheme 这一个字段。不要把 title、summary、trigger、mainPath、branches、confirmedFacts、assumptions、openQuestions、confirmation、target、id 直接平铺在 input 顶层，也不要同时传顶层字段和 scheme 内字段的重复版本。',
      '如果 scheme.openQuestions 非空，scheme.confirmation.questions 必须完整包含这些当前待确认问题。可以额外保留历史已确认题，但不能漏掉任何一个当前 openQuestions。',
      '如果某个问题仍然保留在 scheme.openQuestions 里，对应的 scheme.confirmation.questions 项必须保持未回答壳子状态，必须保留 id/decisionKey/title/questionKind 等提问身份字段；options/description/required 等展示字段仅在适用时保留。仅不得填写回答态字段：不要填写 selectedOptionValue、answerSummary、answerDetail，不要把 options[].selected 设为 true，也不要把 confirmed 设为 true。',
      '系统可能会回填 scheme.dependencies、scheme.deferredConfigItems 与 scheme.convergence。修订已有方案时要尽量保留这些字段，不要把它们抹掉；如果本轮无法判断，可省略并由运行时重新回填。',
      '如果用户已确认“后续新增字段/表/组织锚点后再使用”，对应 dependency 必须写成 resolved + create_later + planned；不要继续留在 scheme.openQuestions，也不要伪装成 existing。',
      '如果上下文中的结构化确认结论已表明审批人来自表单成员字段，来源类型已经确认：不要再次询问表单字段、固定人员、角色、部门负责人或提交人上级。每个审批步骤仅可写三类结果之一：业务合适的当前表单成员字段（resolved + use_existing + existing，fieldRef 同时含真实 fieldId/fieldName）、计划新增成员字段（resolved + create_later + planned，fieldRef 同时含 fieldName/expectedType=memberSelect）、或“使用哪个成员字段作为审批人”的窄化问题（选项只能是当前表单 ownerPolicy=member 的字段）。',
      '“报销人、申请人、提交人”等申请角色不能自动复用为审批人；同名“审批人”字段当前能力不兼容时，规划“流程审批人”成员字段。目标表单或 planning context 改变后先重新读取 flow summary，不能复用旧 fieldId。',
      '正确示例：{ "scheme": { "title": "...", "summary": "...", "trigger": { "type": "submit", "description": "..." }, "mainPath": [], "branches": [], "confirmedFacts": [], "assumptions": [], "openQuestions": [], "confirmation": { "questions": [] } } }',
    ],
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      xStrictSoleRequiredObjectWrapper: true,
      properties: {
        scheme: flowSchemeSchema,
      },
      required: ['scheme'],
    },
  },
  {
    name: 'editor_stage_flow_blueprint',
    kind: AiActionKind.FUNCTION,
    description: [
      '暂存一份由 LLM 基于当前流程方案生成的流程蓝图。它接收最终蓝图节点图，并对照当前已暂存的 FlowScheme 做一致性校验后再保存。该工具本身不再提问、不再做方案规划；只有当方案已经完成澄清并通过内部复核后才允许调用。',
      '从已确认流程方案生成蓝图时，同一业务步骤必须复用流程方案中的步骤 key 作为蓝图 nodeKey；只有确实新增了方案中不存在的业务节点时，才生成新的 nodeKey。',
      '如果审批人来自固定人员、角色、部门负责人或提交人上级，不要把它伪装成表单字段引用；只有成员字段真实存在且 ownerPolicy=member 时，才使用表单字段作为审批人。',
      '如果需要审批结果分流，必须引用 flow summary 中 conditionPolicy=usable 的真实字段；如果不存在，先在流程方案中提出确认问题，不要输出 approvalResult 这类未落地字段名。',
    ].join(''),
    notes: [
      '当 approval_owner dependency 为 create_later + planned 时，审批节点 options.approver 必须使用 {"type":"formMember","fieldName":"计划字段名"}，不得传 fieldId，也不得提前调用 editor_add_fields。',
      '只有 dependency 为 use_existing + existing 且 flow summary 已验证真实成员字段时，才使用 {"form-member":["真实字段ID"]}。',
    ],
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        sourceSchemeRevision: {
          type: 'number',
          description: '这份流程蓝图所基于的流程方案 revision。',
        },
        blueprint: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string', description: '蓝图 ID，可选。' },
            title: { type: 'string', description: '流程蓝图标题。' },
            summary: { type: 'string', description: '流程蓝图摘要。' },
            target: {
              type: 'object',
              additionalProperties: false,
              properties: {
                formId: { type: 'string', description: '所属表单 ID，可选。' },
                formName: { type: 'string', description: '所属表单名称，可选。' },
              },
            },
            triggerBranches: {
              type: 'array',
              description: '最终蓝图的触发分支结构。蓝图里的每个 condition-branch 若包含“其他情况/否则/未命中以上条件”的兜底路径，同一分支节点下最多只能有 1 个兜底分支。',
              items: flowPlanTriggerBranchSchema,
            },
          },
          required: ['title', 'summary', 'triggerBranches'],
        },
      },
      required: ['sourceSchemeRevision', 'blueprint'],
    },
  },
  {
    name: 'editor_apply_staged_flow',
    kind: AiActionKind.FUNCTION,
    description: '按当前暂存的流程蓝图生成当前打开表单的表单流程。它只作用于当前表单，不会跨表单创建流程；运行时会自动补 start/end/branch-setting 等结构节点，并在生成前执行流程引用正规化和现有流程校验。若当前流程规划还有待确认问题，不要直接调用。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'editor_stage_app_blueprint',
    kind: AiActionKind.FUNCTION,
    description: '暂存一个蓝图草案，供用户确认后再统一生成表单与字段。它承接已经收敛完成的方案/单表单规划结果，而不是在“从零创建完整新表单”场景里默认一上来就成为第一步；如果当前规划里仍有待确认项，应先等待用户确认，不要绕过规划阶段直接落到蓝图。如果本轮刚输出规划卡片且不是自动搭建 kickoff，不要在同一轮立即调用本工具；等待用户确认规划后再继续。这里的“完整新表单”以用户意图为主，即使当前停留在 form-design / page-design / app-setting，也不能因为不是 idle 就跳过这一阶段。调用时必须显式指定 updateMode：patch 表示更新当前蓝图，未出现的表单、字段和子字段保留，删除必须通过 deletedFormKeys / deletedFields 明确表达；replace 表示用完整快照覆盖当前蓝图，未出现的内容会被移除。若当前已经有待确认蓝图，再次调用本工具默认是 patch，应复用当前 blueprint.id 以及已知的 formKey / fieldKey；只有用户本轮明确要求重做、整体替换或缩减范围时才能使用 replace，不能仅根据旧规划或旧确认结论选择 replace。输入必须使用 blueprint.forms；不能把 forms 放在顶层。若历史调用同时出现两处 forms，必须保留内容一致的 blueprint.forms，冲突时重新生成。blueprint.forms 枚举的是最终要创建或修改的真实表单/页面，不是字段分组，不是内容分组，也不是内容板块；同一张表内部的字段分组、模块或内容板块，应落在该 form 的 fields 与 description 中表达，不能为了这些分组再新增一个并列 form。如果用户明确要求某个明细对象作为独立表单、独立的真实表单或独立 form，必须在 forms[] 中保留并列 form，而不是降级为主表内的子表单。若上一阶段是单表单规划，则这里的 forms 通常也只能有这一张真实表单。蓝图创建成功后，应先明确说明“当前只是蓝图已创建、尚未生成到编辑器，表单和字段还没有真正创建”；若这次暂存被标记为“需要显式确认”，只有用户在最近一次暂存之后明确确认继续，或明确要求直接落地时，才再调用按蓝图生成。',
    inputSchema: {
      type: 'object',
      properties: {
        updateMode: {
          type: 'string',
          enum: ['patch', 'replace'],
          description: '必填。patch 表示按 formKey / fieldKey 增量更新当前蓝图，未出现的表单、字段和子字段全部保留；replace 表示 blueprint 是完整最终快照，未出现的内容会被移除。已有蓝图上回答待确认问题、修改部分表单或字段时使用 patch；只有用户本轮明确要求重做、整体替换或缩减范围时使用 replace。',
        },
        deletedFormKeys: {
          type: 'array',
          items: { type: 'string' },
          description: 'patch 模式下明确删除的表单 formKey 列表。未出现在 blueprint.forms 中不代表删除。',
        },
        deletedFields: {
          type: 'array',
          description: 'patch 模式下明确删除的字段列表。fieldKeys 可以指向普通字段或子表字段；未出现在 blueprint.forms[].fields 中不代表删除。',
          items: {
            type: 'object',
            properties: {
              formKey: { type: 'string', description: '所属表单的稳定 formKey。' },
              fieldKeys: {
                type: 'array',
                items: { type: 'string' },
                description: '要删除的稳定 fieldKey 列表。',
              },
            },
            required: ['formKey', 'fieldKeys'],
          },
        },
        blueprint: {
          type: 'object',
          properties: {
            id: { type: 'string', description: '蓝图 ID，可选。' },
            title: { type: 'string', description: '蓝图标题。' },
            summary: { type: 'string', description: '蓝图摘要。' },
            assumptions: {
              type: 'array',
              items: { type: 'string' },
              description: '当前假设。',
            },
            openQuestions: {
              type: 'array',
              items: { type: 'string' },
              description: '仍需用户确认的表单、字段、关系或字段能力问题。不得放入审批触发、流程节点、审批人来源、驳回处理等流程设计问题；这些问题必须在表单生成后的 flow-scheme 阶段确认。',
            },
            confirmation: nocodeEditorConfirmationSchema,
            forms: {
              type: 'array',
              description: '建议创建或修改的真实表单/页面列表。patch 模式只需列出新增或修改的表单，未列出的表单保留；replace 模式必须列出完整最终表单集合。forms[] 表示真实表单/页面，不是字段分组，不是内容分组，也不是内容板块；这里按真实表单粒度枚举，同一张表内部的内容分组应写在对应 form 的 fields 与 description 中，不能为了分组再新增并列 form。用户明确要求独立表单、独立的真实表单或独立 form 时，该对象必须作为 forms[] 中的并列 form 保留。',
              items: {
                type: 'object',
                properties: {
                  formKey: { type: 'string', description: '表单稳定标识，可选。' },
                  tableName: { type: 'string', description: '表单名称。' },
                  groupName: { type: 'string', description: '表单所属分组/模块名称。用于在左侧树中分组创建。' },
                  description: { type: 'string', description: '表单说明。' },
                  fields: {
                    type: 'array',
                    description: '表单字段列表。patch 模式只需列出新增或修改的字段，未列出的字段和子字段保留；replace 模式必须列出该表单的完整最终字段集合。',
                    items: {
                      type: 'object',
                      properties: {
                        fieldKey: { type: 'string', description: '字段稳定标识，可选。' },
                        name: { type: 'string', description: '字段名称。' },
                        widgetType: { type: 'string', description: '字段组件类型或常见别名。' },
                        description: { type: 'string', description: '字段说明。' },
                        required: { type: 'boolean', description: '是否必填。' },
                        placeholder: { type: 'string', description: '提示文字。' },
                        validationFormat: { type: 'string', description: '限定格式，例如 email、ID-number。' },
                        enumOptions: {
                          type: 'array',
                          description: '自定义枚举选项，可传字符串数组或 {label,value} 数组。',
                          items: {
                            oneOf: [
                              { type: 'string' },
                              {
                                type: 'object',
                                properties: {
                                  label: { type: 'string' },
                                  value: { type: 'string' },
                                },
                              },
                            ],
                          },
                        },
                        defaultValue: nocodeEditorBlueprintDefaultValueSchema,
                        formulaSettings: {
                          type: 'array',
                          description: '字段动态公式配置。固定文本、数字、布尔值或固定枚举默认项必须写入 defaultValue，不得包装成公式。蓝图字段引用使用 [[field:fieldKey,字段标题]]。compute-formula 只允许用于 widgetType=widget.form.autoCompute；default-formula 只用于组件支持的动态默认公式。不要为同一字段同时输出两种 formulaPath。',
                          items: {
                            type: 'object',
                            properties: {
                              formulaPath: { type: 'string', enum: ['default-formula', 'compute-formula'] },
                              formula: { type: 'string' },
                              explanation: { type: 'string' },
                            },
                            required: ['formulaPath', 'formula'],
                          },
                        },
                        source: {
                          type: 'object',
                          description: '字段值来自其他表时的引用信息。',
                          properties: {
                            formKey: { type: 'string' },
                            formName: { type: 'string' },
                            fieldKey: { type: 'string' },
                            fieldName: { type: 'string' },
                          },
                        },
                        notes: {
                          type: 'array',
                          items: { type: 'string' },
                          description: '字段备注。',
                        },
                        children: {
                          type: 'array',
                          description: '当字段是子表单时，这里填写子字段列表；不要只创建一个空子表单。',
                          items: {
                            type: 'object',
                            properties: {
                              fieldKey: { type: 'string', description: '子字段稳定标识，可选。' },
                              name: { type: 'string', description: '子字段名称。' },
                              widgetType: { type: 'string', description: '子字段组件类型或常见别名。' },
                              description: { type: 'string', description: '子字段说明。' },
                              required: { type: 'boolean', description: '是否必填。' },
                              placeholder: { type: 'string', description: '提示文字。' },
                              validationFormat: { type: 'string', description: '限定格式，例如 email、ID-number。' },
                              enumOptions: {
                                type: 'array',
                                description: '子字段自定义枚举选项。',
                                items: {
                                  oneOf: [
                                    { type: 'string' },
                                    {
                                      type: 'object',
                                      properties: {
                                        label: { type: 'string' },
                                        value: { type: 'string' },
                                      },
                                    },
                                  ],
                                },
                              },
                              defaultValue: nocodeEditorBlueprintDefaultValueSchema,
                              formulaSettings: {
                                type: 'array',
                                description: '字段动态公式配置。固定文本、数字、布尔值或固定枚举默认项必须写入 defaultValue，不得包装成公式。蓝图字段引用使用 [[field:fieldKey,字段标题]]。compute-formula 只允许用于 widgetType=widget.form.autoCompute；default-formula 只用于组件支持的动态默认公式。不要为同一字段同时输出两种 formulaPath。',
                                items: {
                                  type: 'object',
                                  properties: {
                                    formulaPath: { type: 'string', enum: ['default-formula', 'compute-formula'] },
                                    formula: { type: 'string' },
                                    explanation: { type: 'string' },
                                  },
                                  required: ['formulaPath', 'formula'],
                                },
                              },
                              source: {
                                type: 'object',
                                description: '子字段值来自其他表时的引用信息。',
                                properties: {
                                  formKey: { type: 'string' },
                                  formName: { type: 'string' },
                                  fieldKey: { type: 'string' },
                                  fieldName: { type: 'string' },
                                },
                              },
                              notes: {
                                type: 'array',
                                items: { type: 'string' },
                                description: '子字段备注。',
                              },
                            },
                            required: ['name'],
                          },
                        },
                      },
                      required: ['name'],
                    },
                  },
                },
                required: ['tableName', 'fields'],
              },
            },
          },
          required: ['forms'],
        },
      },
      required: ['updateMode', 'blueprint'],
    },
  },
  {
    name: 'editor_get_staged_app_blueprint',
    kind: AiActionKind.FUNCTION,
    description: '当聊天上下文里还没有足够的当前蓝图信息，或用户明确要求查看/核对当前蓝图时，读取当前暂存的蓝图草案。默认读取轻量状态；只有需要继续确认、核对或修改蓝图结构时，才传 detail="structure" 读取 compact 蓝图结构。读取结果只说明当前蓝图事实状态，不会自动切换到表单摘要或推荐下一步工具。如果最新聊天消息里已经有当前蓝图结果，不要重复调用。若用户只是回复“可以/继续/没问题”来确认上一条蓝图，不要先读蓝图，直接承接为按蓝图生成。确认语义必须落在最近一次蓝图暂存之后，不能拿更早的确认继续沿用。',
    inputSchema: {
      type: 'object',
      properties: {
        detail: {
          type: 'string',
          enum: ['status', 'structure'],
          description: '读取粒度。status 只返回蓝图 ref、生命周期、计数和 apply 摘要；structure 额外返回 compact 表单/字段结构。不要请求 full。',
        },
      },
    },
  },
  {
    name: 'editor_apply_staged_app_blueprint',
    kind: AiActionKind.FUNCTION,
    description: '把当前暂存的蓝图确定性生成到编辑器草稿中：创建/复用表单、补齐字段、写入常见字段设置。若最近一次蓝图暂存被标记为“需要显式确认”，只有用户在那次暂存之后明确确认继续，才能调用本工具；若用户明确要求“直接落地/不用确认”，则可直接进入这一阶段。手工点击“按蓝图生成”沿用现有前端直达链路；一旦蓝图已经成功生成，这次 gate 就视为已消费，不应继续约束后续针对已有表单/字段的增量修改。调用成功后，才能声称表单和字段已真正创建到编辑器。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'editor_clear_staged_app_blueprint',
    kind: AiActionKind.FUNCTION,
    description: '清空当前暂存的蓝图草案。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'editor_get_form_summary',
    kind: AiActionKind.FUNCTION,
    description: '读取当前打开表单的字段树摘要、当前选中字段以及可添加字段组件类型。枚举类字段会额外返回当前选项来源模式 enumSourceType 与当前选项预览 enumOptionsPreview。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'editor_get_relation_context',
    kind: AiActionKind.FUNCTION,
    description: '读取当前应用的关系上下文。它会先使用最近一次已保存的 relation context，再叠加当前未保存结构做轻量分析，返回 signalLevel、候选目标表和待确认问题。适合完整新表单生成前的关系判断，不适合替代全应用批量扫描。',
    inputSchema: {
      type: 'object',
      properties: {
        requestText: { type: 'string', description: '当前用户请求原文，用于轻量关系信号分析。' },
        draftFormName: { type: 'string', description: '当前准备生成的新表单名称。' },
      },
    },
  },
  {
    name: 'editor_get_targeted_form_summaries',
    kind: AiActionKind.FUNCTION,
    description: '定向读取指定表单摘要，只用于 relation context 已命中强信号后的深读验证。不要在完整新表单链路里默认把它当成全应用扫描。',
    inputSchema: {
      type: 'object',
      properties: {
        targets: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              tableId: { type: 'string' },
              tableName: { type: 'string' },
              reason: { type: 'string' },
            },
          },
        },
      },
    },
  },
  {
    name: 'editor_get_all_form_summaries',
    kind: AiActionKind.FUNCTION,
    description: '读取当前应用全部表单的字段摘要。适合“所有/全部/整个应用”的跨表单批量调整场景。传 enumOnly=true 时会只返回紧凑的枚举字段清单（含 enumSourceType 与当前选项预览 enumOptionsPreview），特别适合统一修改单选/下拉/多选字段选项。',
    inputSchema: {
      type: 'object',
      properties: {
        enumOnly: {
          type: 'boolean',
          description: '可选。为 true 时，只返回枚举类字段的紧凑摘要，避免全量字段树过大。',
        },
      },
    },
  },
  {
    name: 'editor_get_widget_option_schema',
    kind: AiActionKind.FUNCTION,
    description: '读取指定字段当前可配置的设置项 schema。修改复杂字段设置前必须先调用这个工具。',
    inputSchema: {
      type: 'object',
      properties: {
        widgetId: { type: 'string', description: '字段组件 ID。' },
      },
      required: ['widgetId'],
    },
  },
  {
    name: 'editor_get_widget_option_choices',
    kind: AiActionKind.FUNCTION,
    description: '读取指定字段某个设置项当前可选的动态候选值。设置来自他表字段等复杂选项前必须先调用这个工具。',
    inputSchema: {
      type: 'object',
      properties: {
        widgetId: { type: 'string', description: '字段组件 ID。' },
        optionKey: { type: 'string', description: '设置项 key。与 optionPath 二选一。' },
        optionPath: {
          type: 'array',
          description: '设置项路径。与 optionKey 二选一。',
          items: {
            type: 'string',
          },
        },
      },
      required: ['widgetId'],
    },
  },
  {
    name: 'editor_add_fields',
    kind: AiActionKind.FUNCTION,
    description: '向当前表单中批量新增字段。仅当用户明确要求新增、添加、创建字段时使用。若本轮主任务是生成、配置、更新或修改字段公式、默认值公式或计算公式，即使目标字段不存在，也不要调用本工具；应使用 editor_set_field_formulas 标记 skipped 或向用户说明未找到目标字段。字段类型必须来自 editor_get_form_summary 返回的 availableWidgetTypes，可传 type、name 或 aliases 中的常见别名。',
    inputSchema: {
      type: 'object',
      properties: {
        fields: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              requestId: { type: 'string', description: '本次请求中的字段标识，便于结果回显。' },
              widgetType: { type: 'string', description: '字段组件类型。' },
              name: { type: 'string', description: '字段名称。' },
              afterWidgetId: { type: 'string', description: '可选，插入到哪个字段后面。' },
              containerWidgetId: { type: 'string', description: '可选，插入到哪个容器字段内，比如子表单。' },
            },
            required: ['widgetType', 'name'],
          },
        },
      },
      required: ['fields'],
    },
  },
  {
    name: 'editor_delete_field',
    kind: AiActionKind.FUNCTION,
    description: '删除当前表单设计树中的已有字段，语义等同于用户在编辑器中手动删除字段：从当前设计树移除，并进入现有回收站/待保存删除链路。使用前应先通过 editor_get_form_summary 确认字段位置与 widgetId。该工具适用于已生成到当前编辑器的局部编辑，不替代蓝图调整；也不是回收站永久删除工具，不负责清空回收站或彻底移除已删除字段。',
    inputSchema: {
      type: 'object',
      properties: {
        widgetId: { type: 'string', description: '要从当前表单设计树中删除的字段组件 ID。' },
      },
      required: ['widgetId'],
    },
  },
  {
    name: 'editor_replace_field',
    kind: AiActionKind.FUNCTION,
    description: '把当前表单中某个已有字段替换为另一种字段组件类型，保留原来的位置与字段名称。适合把错误生成的单行文本改成 memberSelect、departmentSelect、treeSelect、treeMultipleSelect、switch、radioGroup、checkboxGroup、dateRangePicker、timePicker、image-uploader、file-uploader、金额、地址、自动编号等更合适的组件。若本轮主任务是生成、配置、更新或修改字段公式、默认值公式或计算公式，禁止使用本工具修改任何字段类型；公式任务必须保留目标字段当前组件类型，并使用 editor_set_field_formulas 写入公式配置。',
    inputSchema: {
      type: 'object',
      properties: {
        widgetId: { type: 'string', description: '要替换的字段组件 ID。' },
        widgetType: { type: 'string', description: '新的字段组件类型。可传 type、name 或 aliases 中的常见别名。' },
        name: { type: 'string', description: '可选，替换后字段名称；默认沿用原字段名称。' },
      },
      required: ['widgetId', 'widgetType'],
    },
  },
  {
    name: 'editor_bind_field_source',
    kind: AiActionKind.FUNCTION,
    description: '把当前表单中的字段绑定为“来自他表数据字段”。适合客户、供应商、商品、仓库、门店、班级、课程、项目、合同、物料等需要从其他表单选择的关系字段。',
    inputSchema: {
      type: 'object',
      properties: {
        widgetId: { type: 'string', description: '当前表单中的字段组件 ID。' },
        formName: { type: 'string', description: '来源表单名称。' },
        fieldName: { type: 'string', description: '来源表单中用作显示/选择的字段名称。' },
      },
      required: ['widgetId', 'formName', 'fieldName'],
    },
  },
  {
    name: 'editor_set_field_formulas',
    kind: AiActionKind.FUNCTION,
    description: '生成或修改字段公式的统一入口。只要本轮主任务是生成、配置、更新或修改字段公式、默认值公式或计算公式，就必须使用本工具表达每个目标字段的处理结果；不要新增字段来替代不存在的目标字段。单字段公式和多字段公式都必须使用本工具；批量生成或配置多个字段公式时，必须把本轮所有目标字段都放入 items，不要只处理其中一个字段，也不要改用 editor_set_field_options。能修改的字段传 status=updated 和 changes；目标字段不存在、缺少依赖信息或无法生成时传 status=skipped、fieldName 和 reason。公式计划已暂存为 plan_and_apply 且没有待确认项时，下一轮必须显式调用 editor_set_field_formulas({ useStagedPlan: true })；此时不要传 items，Host 只执行自身 staged preflight 的内部结果。公式字段引用必须使用 [[field:fieldKey,字段标题]] 完整格式，不要只传裸 token。',
    inputSchema: {
      type: 'object',
      properties: {
        useStagedPlan: {
          type: 'boolean',
          description: '仅在上一轮已暂存无待确认的 plan_and_apply 公式计划时设为 true。设为 true 时不得传 items；Host 仅使用内部 staged preflight 结果执行。',
        },
        items: {
          type: 'array',
          description: '本轮要生成或修改公式的目标字段结果列表。单字段传 1 项，批量字段传多项；每个用户明确想处理的目标字段都必须出现一次。',
          items: {
            type: 'object',
            properties: {
              status: { type: 'string', description: 'updated 表示本轮会写入公式；skipped 表示这是用户目标字段但本轮不写入公式。缺省按 updated 处理。' },
              widgetId: { type: 'string', description: '目标字段组件 ID。updated 项必须提供；skipped 项如果能定位到字段也应提供。' },
              tableId: { type: 'string', description: '目标字段所属表单 ID，可选，用于展示结果。' },
              tableName: { type: 'string', description: '目标字段所属表单名称，可选，用于展示结果。' },
              fieldName: { type: 'string', description: '目标字段名称，可选；skipped 项必须提供，updated 项用于展示结果说明。' },
              explanation: { type: 'string', description: 'updated 项的公式用途解释，用于最终结果展示。' },
              reason: { type: 'string', description: 'skipped 项未修改该目标字段公式的原因，用于最终结果展示。' },
              changes: {
                type: 'array',
                description: 'updated 项的公式相关设置项修改。实时计算字段通常包含 compute-type=formula 和 compute-formula；普通字段默认公式使用 default-formula。skipped 项不要传 changes。',
                items: {
                  type: 'object',
                  properties: {
                    key: { type: 'string', description: '设置项 key。与 path 二选一。' },
                    path: {
                      type: 'array',
                      description: '设置项路径。与 key 二选一。',
                      items: {
                        type: 'string',
                      },
                    },
                    value: { description: '设置项目标值。写入 compute-formula/default-formula 时，字段引用必须使用 [[field:fieldKey,字段标题]] 完整格式，例如 PRODUCT([[field:quantity,数量]], [[field:price,单价]])，不要只传字段 id、widgetId 或裸 token。' },
                    unset: { type: 'boolean', description: '是否清空该设置项。' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  {
    name: 'editor_set_field_options',
    kind: AiActionKind.FUNCTION,
    description: '按顺序修改字段设置项。对于存在依赖关系的设置项，必须按正确顺序传入 changes。生成或修改字段公式时不要使用本工具，应使用 editor_set_field_formulas。',
    inputSchema: {
      type: 'object',
      properties: {
        widgetId: { type: 'string', description: '字段组件 ID。' },
        changes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string', description: '设置项 key。与 path 二选一。' },
              path: {
                type: 'array',
                description: '设置项路径。与 key 二选一。',
                items: {
                  type: 'string',
                },
              },
              value: { description: '设置项目标值。' },
              unset: { type: 'boolean', description: '是否清空该设置项。' },
            },
          },
        },
      },
      required: ['widgetId', 'changes'],
    },
  },
  {
    name: 'editor_set_enum_options',
    kind: AiActionKind.FUNCTION,
    description: '批量写入枚举类字段的自定义选项，支持跨多个表单统一调整 radioGroup、checkboxGroup、treeSelect 等字段的选项；会自动切换到自定义选项模式并同步当前 AI 草稿。只有在用户已经明确给出候选项时才适合调用；如果字段本质上是来自他表的关系/多选关系，或当前选项仍不明确，就不要用它硬写默认选项。若 summary 显示 enumSourceType=from-table，除非用户明确要求改成自定义选项，否则不要调用它覆盖关系字段。',
    inputSchema: {
      type: 'object',
      properties: {
        updates: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              tableId: { type: 'string', description: '可选，目标表单 ID。' },
              tableName: { type: 'string', description: '可选，目标表单名称。' },
              widgetId: { type: 'string', description: '目标字段组件 ID。' },
              options: {
                type: 'array',
                description: '目标枚举选项，可传字符串数组或 {label,value} 数组。',
                items: {
                  oneOf: [
                    { type: 'string' },
                    {
                      type: 'object',
                      properties: {
                        label: { type: 'string' },
                        value: { type: 'string' },
                      },
                    },
                  ],
                },
              },
            },
            required: ['widgetId', 'options'],
          },
        },
      },
      required: ['updates'],
    },
  },
]
