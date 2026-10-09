<template>
  <section v-if="hasEvidence" class="ai-insight-evidence">
    <div class="ai-insight-evidence__summary">
      <div v-if="summarySourceLinks.length" class="ai-insight-evidence__group">
        <span class="ai-insight-evidence__label">{{ sourceLabel }}</span>
        <div class="ai-insight-evidence__source-list">
          <a
            v-for="link in summarySourceLinks"
            :key="`${link.label}-${link.href}`"
            class="ai-insight-evidence__source-chip"
            :href="link.href || undefined"
            @click="handleSourceLinkClick($event, link.href)"
          >
            {{ link.label }}
          </a>
          <span v-if="hiddenSourceCount > 0" class="ai-insight-evidence__source-chip is-muted">
            +{{ hiddenSourceCount }}
          </span>
        </div>
      </div>
      <div v-if="evidence?.summaryText" class="ai-insight-evidence__group">
        <span class="ai-insight-evidence__label">{{ statsLabel }}</span>
        <span class="ai-insight-evidence__summary-text">{{ evidence?.summaryText }}</span>
      </div>
    </div>
    <details
      ref="detailsRef"
      class="ai-insight-evidence__details"
      :open="detailsExpanded"
      @toggle="handleDetailsToggle"
    >
      <summary class="ai-insight-evidence__toggle">
        <span>{{ detailsExpanded ? collapseLabel : expandLabel }}</span>
        <span class="ai-insight-evidence__toggle-arrow" aria-hidden="true"></span>
      </summary>
      <div class="ai-insight-evidence__detail-body">
        <div v-if="evidence?.sourceLinks.length" class="ai-insight-evidence__detail-group">
          <div class="ai-insight-evidence__detail-title">{{ evidence?.sourceTitle }}</div>
          <ul class="ai-insight-evidence__detail-source-list">
            <li
              v-for="link in evidence?.sourceLinks"
              :key="`detail-${link.label}-${link.href}`"
              class="ai-insight-evidence__detail-source-item"
            >
              <a
                class="ai-insight-evidence__detail-link"
                :href="link.href || undefined"
                @click="handleSourceLinkClick($event, link.href)"
              >
                {{ link.label }}
              </a>
            </li>
          </ul>
        </div>
        <div v-if="evidence?.statsLines.length" class="ai-insight-evidence__detail-group">
          <div class="ai-insight-evidence__detail-title">{{ evidence?.statsTitle }}</div>
          <ul class="ai-insight-evidence__detail-list">
            <li
              v-for="(line, index) in evidence?.statsLines"
              :key="`${line}-${index}`"
              class="ai-insight-evidence__detail-item"
            >
              {{ line }}
            </li>
          </ul>
        </div>
      </div>
    </details>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import i18next from 'i18next'
import type { AiAnalysisEvidenceSummary } from '../workbenchAiInsightPanelModel'
import type { ShadowMarkdownRouteTarget } from '../shadowMarkdownRoute'
import { resolveShadowMarkdownRouteTarget } from '../shadowMarkdownRoute'

// eslint-disable-next-line vue/valid-define-props
const props = withDefaults(defineProps<{
  evidence?: AiAnalysisEvidenceSummary | null
  previewMode?: boolean
}>(), {
  evidence: null,
  previewMode: false,
})

// eslint-disable-next-line vue/valid-define-emits
const emit = defineEmits<{
  (event: 'route-click', target: ShadowMarkdownRouteTarget): void
}>()

const detailsRef = ref<HTMLDetailsElement | null>(null)

const detailsExpanded = ref(Boolean(props.previewMode))
const sourceLabel = computed(() => i18next.t('workbenchAiInsightEvidenceMeta.source'))
const statsLabel = computed(() => i18next.t('workbenchAiInsightEvidenceMeta.statistics'))
const expandLabel = computed(() => i18next.t('workbenchAiInsightEvidenceMeta.expandDetails'))
const collapseLabel = computed(() => i18next.t('workbenchAiInsightEvidenceMeta.collapseDetails'))
const hasEvidence = computed(() => (
  Boolean(props.evidence && (props.evidence.sourceLinks.length || props.evidence.statsLines.length))
))
const summarySourceLinks = computed(() => props.evidence?.sourceLinks.slice(0, 2) || [])
const hiddenSourceCount = computed(() => Math.max(0, (props.evidence?.sourceLinks.length || 0) - summarySourceLinks.value.length))

const syncDetailsExpanded = (expanded: boolean) => {
  detailsExpanded.value = expanded
  if (detailsRef.value && detailsRef.value.open !== expanded) {
    detailsRef.value.open = expanded
  }
}

watch(() => props.previewMode, (value) => {
  if (value) {
    syncDetailsExpanded(true)
  }
}, { immediate: true })

const handleDetailsToggle = (event: Event) => {
  detailsExpanded.value = Boolean((event.currentTarget as HTMLDetailsElement | null)?.open)
}

const handleSourceLinkClick = (event: MouseEvent, href?: string) => {
  const target = resolveShadowMarkdownRouteTarget(href || null)
  if (!target) {
    return
  }

  event.preventDefault()
  emit('route-click', target)
}

const expandDetails = () => {
  syncDetailsExpanded(true)
}

defineExpose({
  expandDetails,
})
</script>

<style scoped lang="scss">
.ai-insight-evidence {
  --ai-evidence-border: #e6ebf5;
  --ai-evidence-surface: #f7f9fc;
  --ai-evidence-text: #1d2129;
  --ai-evidence-subtle: #4e5969;
  --ai-evidence-accent: #165dff;
  width: 100%;
  padding: 12px;
  border: 1px solid var(--ai-evidence-border);
  border-radius: 12px;
  background: var(--ai-evidence-surface);
}

.ai-insight-evidence__summary {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ai-insight-evidence__group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ai-insight-evidence__label,
.ai-insight-evidence__detail-title {
  color: var(--ai-evidence-subtle);
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
}

.ai-insight-evidence__source-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ai-insight-evidence__source-chip {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid rgba(22, 93, 255, 0.12);
  border-radius: 999px;
  background: #fff;
  color: var(--ai-evidence-accent);
  font-size: 12px;
  line-height: 18px;
  text-decoration: none;
  transition: border-color 0.2s ease, background-color 0.2s ease, color 0.2s ease;
}

.ai-insight-evidence__source-chip:hover {
  border-color: rgba(22, 93, 255, 0.24);
  background: #f4f8ff;
}

.ai-insight-evidence__source-chip.is-muted {
  border-color: transparent;
  background: rgba(29, 33, 41, 0.06);
  color: var(--ai-evidence-subtle);
}

.ai-insight-evidence__summary-text {
  color: var(--ai-evidence-text);
  font-size: 12px;
  line-height: 18px;
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-insight-evidence__details {
  margin-top: 12px;
}

.ai-insight-evidence__toggle {
  list-style: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--ai-evidence-accent);
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  cursor: var(--cursor-pointer);
  user-select: none;
}

.ai-insight-evidence__toggle::-webkit-details-marker {
  display: none;
}

.ai-insight-evidence__toggle-arrow {
  width: 7px;
  height: 7px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(45deg);
  transition: transform 0.2s ease;
}

.ai-insight-evidence__details[open] .ai-insight-evidence__toggle-arrow {
  transform: rotate(225deg);
}

.ai-insight-evidence__detail-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed rgba(78, 89, 105, 0.18);
}

.ai-insight-evidence__detail-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-insight-evidence__detail-source-list,
.ai-insight-evidence__detail-list {
  margin: 0;
  padding-left: 18px;
  list-style: disc;
  color: var(--ai-evidence-text);
  font-size: 12px;
  line-height: 18px;
}

.ai-insight-evidence__detail-link {
  color: var(--ai-evidence-accent);
  text-decoration: underline;
  text-underline-offset: 2px;
  transition: color 0.2s ease;
}

.ai-insight-evidence__detail-link:hover {
  color: #0e42d2;
  text-decoration: underline;
}

.ai-insight-evidence__detail-source-item + .ai-insight-evidence__detail-source-item,
.ai-insight-evidence__detail-item + .ai-insight-evidence__detail-item {
  margin-top: 4px;
}
</style>
