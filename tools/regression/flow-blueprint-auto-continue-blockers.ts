import assert from 'node:assert/strict'

import {
  shouldSuppressFlowBlueprintAutoContinueForRepeatedFailure,
} from '../../src/renderer/views/nocode/views/editor/ai/flowSchemeAutoContinue'

const planningContextKey = 'form-plan:sol-1793427288883-6961cc:form-leave:2:1793427288884'

// 会话回放：目标表单没打开时严格校验必定失败，自动续跑只会原样再失败一次。
// 这类要用户先做动作的失败首次出现就要停，不再等连续 3 次。
assert.equal(
  shouldSuppressFlowBlueprintAutoContinueForRepeatedFailure({
    failureState: { planningContextKey, code: 'target_form_not_open', count: 1 },
    planningContextKey,
  }),
  true,
)

// 人员节点与方案步骤对不上时，同一份蓝图再自动提交一次必然再失败：
// 除了一次无意义的重试，还会把同一段失败文案重复给用户看。
assert.equal(
  shouldSuppressFlowBlueprintAutoContinueForRepeatedFailure({
    failureState: { planningContextKey, code: 'flow_personnel_source_mismatch', count: 1 },
    planningContextKey,
  }),
  true,
)

// 其他原因仍按“连续同一原因失败”的阈值收敛，单次失败不拦自动续跑。
assert.equal(
  shouldSuppressFlowBlueprintAutoContinueForRepeatedFailure({
    failureState: { planningContextKey, code: 'form_not_found', count: 1 },
    planningContextKey,
  }),
  false,
)
assert.equal(
  shouldSuppressFlowBlueprintAutoContinueForRepeatedFailure({
    failureState: { planningContextKey, code: 'form_not_found', count: 3 },
    planningContextKey,
  }),
  true,
)

console.log('flow blueprint auto continue blockers: ok')
