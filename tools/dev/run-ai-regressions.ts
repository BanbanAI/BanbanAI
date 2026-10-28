import { spawnSync } from 'node:child_process'
import path from 'node:path'

const SCRIPT_NAMES = [
  'blueprint-confirmation-late-question-dedupe',
  'blueprint-default-handled-questions',
  'blueprint-deletion-resolution',
  'blueprint-design-gaps',
  'blueprint-field-declaration-finality',
  'blueprint-field-identity',
  'blueprint-field-merge-safety',
  'blueprint-master-data-definition-field',
  'blueprint-open-question-notice-dedupe',
  'blueprint-related-form-scope',
  'blueprint-relation-convergence',
  'blueprint-single-apply-dependency-closure',
  'blueprint-source-reference-order',
  'blueprint-source-target-completion',
  'blueprint-tool-call-history-integrity',
  'consecutive-tool-failure-fold-evidence',
  'flow-field-decision-convergence',
  'flow-generation-three-fixes-guards',
  'flow-grounding-business-copy',
  'flow-grounding-decision-keys',
  'flow-personnel-clue-derivation',
  'flow-personnel-question-reconciliation',
  'flow-stage-tool-projection',
  'flow-decision-open-question-projection',
  'flow-decision-order-tiers',
  'flow-decision-scope-derivation',
  'flow-decision-key-heal',
  'flow-replan-open-question-convergence',
  'flow-scheme-current-round-confirmed-questions',
  'flow-scheme-prerequisite-display',
  'flow-scheme-prerequisite-no-artifact-block',
  'flow-scheme-prerequisite-not-a-question',
  'flow-scheme-prerequisite-waiting-guard',
  'flow-scheme-repair-loop',
  'flow-scheme-review-result-visibility',
  'flow-scheme-schema-size',
  'flow-scheme-trusted-answer-order',
  'flow-scheme-user-quote-settlement',
  'flow-structure-assumption-confirmation',
  'lost-tool-intent-recovery',
  'planning-card-auto-continue-display',
  'planning-scope-guard-ownership',
  'planning-scope-guard-visibility',
  'post-form-flow-intent-binding',
  'prompt-stage-split',
  'provider-output-limit',
  'provider-stream-activity',
  'provider-timeout-retry-policy',
  'required-tool-choice-policy',
  'terminal-error-narration-visibility',
  'tool-argument-sibling-wrapper-merge',
]

const projectRoot = path.resolve(__dirname, '../..')
const regressionDir = path.join(projectRoot, 'tools/regression')

for (const scriptName of SCRIPT_NAMES) {
  const scriptPath = path.join(regressionDir, `${scriptName}.ts`)
  const result = spawnSync(process.execPath, [
    '--require',
    'ts-node/register/transpile-only',
    '--require',
    'tsconfig-paths/register',
    scriptPath,
  ], {
    cwd: projectRoot,
    env: {
      ...process.env,
      TS_NODE_PROJECT: path.join(projectRoot, 'tools/tsconfig.json'),
    },
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    process.exit(result.status || 1)
  }
}

console.log(`ai regressions: ${SCRIPT_NAMES.length} scripts passed`)
