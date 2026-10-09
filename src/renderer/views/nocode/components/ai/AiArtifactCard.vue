<template>
  <div class="artifact-message">
    <div class="artifact-caption">{{ caption }}</div>
    <div
      class="artifact-card"
      :class="[
        `is-${block.kind}`,
        {
          'is-loading': block.status === 'loading',
          'is-error': block.status === 'error',
        },
      ]"
    >
      <div class="artifact-card-content">
        <div class="artifact-card-heading">
          <div class="artifact-card-title-wrap">
            <div class="artifact-card-icon">
              <el-icon
                :size="18"
                :class="{ 'is-loading': block.status === 'loading' }"
              >
                <i-ep-loading v-if="block.status === 'loading'" />
                <i-ep-folder-opened v-else-if="block.kind === 'nocode-app'" />
                <i-ep-grid v-else />
              </el-icon>
            </div>
            <div class="artifact-card-title">{{ title }}</div>
          </div>
          <div class="artifact-card-heading-meta">
            <span v-if="versionLabel" class="artifact-card-version">{{ versionLabel }}</span>
            <span
              v-if="statusTag"
              :class="['artifact-card-status', statusTagTone && `is-${statusTagTone}`]"
            >
              {{ statusTag }}
            </span>
          </div>
        </div>
        <div v-if="subtitle" class="artifact-card-subtitle">{{ subtitle }}</div>
        <div v-if="statMeta.length" class="artifact-card-stats">
          <span v-for="item in statMeta" :key="item">{{ decodeHtml(item) }}</span>
        </div>
        <div v-if="timeMeta" class="artifact-card-time">{{ decodeHtml(timeMeta) }}</div>
        <div
          v-if="canOpen"
          class="artifact-card-action-row"
          role="button"
          tabindex="0"
          @click="emit('view', block)"
          @keydown.enter.prevent="emit('view', block)"
          @keydown.space.prevent="emit('view', block)"
        >
          <span>{{ viewLabel }}</span>
          <span class="artifact-card-arrow">→</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AiAssistantArtifactBlock } from '@common/types/ai'
import { computed } from 'vue'
import {
  canOpenAiArtifact,
  resolveAiArtifactCaption,
  resolveAiArtifactMeta,
  resolveAiArtifactStatusTag,
  resolveAiArtifactStatusTagTone,
  resolveAiArtifactSubtitle,
  resolveAiArtifactTitle,
  resolveAiArtifactViewLabel,
  resolveAiArtifactVersionLabel,
} from './artifactBlock'
import i18next from 'i18next';
import { decodeHtml } from '@renderer/utils/replace';

const props = withDefaults(defineProps<{
  block: AiAssistantArtifactBlock
  applying?: boolean
}>(), {
  applying: false,
})

const emit = defineEmits<{
  (event: 'view', block: AiAssistantArtifactBlock): void
}>()

const caption = computed(() => resolveAiArtifactCaption(props.block))
const title = computed(() => resolveAiArtifactTitle(props.block))
const subtitle = computed(() => resolveAiArtifactSubtitle(props.block))
const meta = computed(() => resolveAiArtifactMeta(props.block))
const timeMeta = computed(() => meta.value.find(item => item.startsWith(i18next.t('artifactBlock.stagedAt', { time: '' }).trim())) || '')
const statMeta = computed(() => meta.value.filter(item => item !== timeMeta.value))
const canOpen = computed(() => canOpenAiArtifact(props.block))
const viewLabel = computed(() => resolveAiArtifactViewLabel(props.block))
const versionLabel = computed(() => resolveAiArtifactVersionLabel(props.block))
const statusTag = computed(() => resolveAiArtifactStatusTag(props.block, {
  applying: props.applying,
}))
const statusTagTone = computed(() => resolveAiArtifactStatusTagTone(statusTag.value))
</script>

<style scoped lang="scss">
.artifact-message {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.artifact-caption {
  font-size: 12px;
  color: var(--text-color-secondary);
}

.artifact-card {
  --artifact-card-border: #e3eaf3;
  --artifact-card-background:
    linear-gradient(180deg, #ffffff 0%, #f8fbff 100%),
    radial-gradient(circle at left top, rgba(126, 151, 185, 0.08), transparent 36%);
  --artifact-card-shadow: 0 6px 14px rgba(45, 71, 108, 0.05);
  --artifact-card-icon-background: linear-gradient(180deg, #f3f7fc 0%, #eaf1f9 100%);
  --artifact-card-icon-color: #587191;
  --artifact-card-title-color: #243a59;
  --artifact-card-subtitle-color: #6a7f98;
  --artifact-card-meta-color: #7a8ea5;
  --artifact-card-action-color: #315f9f;
  --artifact-card-pill-background: #eef3f9;
  --artifact-card-pill-color: #607791;
  cursor: default;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid var(--artifact-card-border);
  background: var(--artifact-card-background);
  box-shadow: var(--artifact-card-shadow);
}

.artifact-card.is-nocode-app {
  --artifact-card-border: #dcece8;
  --artifact-card-background:
    linear-gradient(180deg, #fbfffe 0%, #f3fbf9 100%),
    radial-gradient(circle at left top, rgba(97, 199, 190, 0.12), transparent 34%);
  --artifact-card-icon-background: linear-gradient(180deg, #ebfaf7 0%, #dcf3ef 100%);
  --artifact-card-icon-color: #3c837d;
}

.artifact-card.is-blueprint {
  --artifact-card-border: #e3eaf3;
  --artifact-card-background:
    linear-gradient(180deg, #ffffff 0%, #f8fbff 100%),
    radial-gradient(circle at left top, rgba(126, 151, 185, 0.08), transparent 36%);
  --artifact-card-shadow: 0 6px 14px rgba(45, 71, 108, 0.05);
  --artifact-card-icon-background: linear-gradient(180deg, #f3f7fc 0%, #eaf1f9 100%);
  --artifact-card-icon-color: #587191;
}

.artifact-card.is-form-plan {
  --artifact-card-border: #dcebe2;
  --artifact-card-background:
    linear-gradient(180deg, #fcfffd 0%, #f4fbf7 100%),
    radial-gradient(circle at left top, rgba(143, 213, 159, 0.12), transparent 34%);
  --artifact-card-icon-background: linear-gradient(180deg, #eefaf2 0%, #dff4e7 100%);
  --artifact-card-icon-color: #4d8562;
}

.artifact-card.is-loading {
  --artifact-card-border: #d8e3ef;
}

.artifact-card.is-error {
  --artifact-card-border: #efd8d8;
  --artifact-card-background:
    linear-gradient(180deg, #fffafa 0%, #fff2f2 100%),
    radial-gradient(circle at left top, rgba(255, 131, 131, 0.14), transparent 34%);
  --artifact-card-icon-background: linear-gradient(180deg, #fff1f1 0%, #fee5e5 100%);
  --artifact-card-icon-color: #bf5c5c;
  --artifact-card-title-color: #6e2f2f;
  --artifact-card-subtitle-color: #926363;
  --artifact-card-meta-color: #a17676;
  --artifact-card-action-color: #9b4b4b;
  --artifact-card-pill-background: #fce7e7;
  --artifact-card-pill-color: #b25555;
}

.artifact-card-icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: var(--artifact-card-icon-background);
  color: var(--artifact-card-icon-color);
}

.artifact-card-content {
  min-width: 0;
  flex: 1;
}

.artifact-card-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.artifact-card-title-wrap {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.artifact-card-title {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.5;
  color: var(--artifact-card-title-color);
}

.artifact-card-heading-meta {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.artifact-card-status,
.artifact-card-version {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--artifact-card-pill-background);
  color: var(--artifact-card-pill-color);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.4;
  white-space: nowrap;
}

.artifact-card-status.is-pending {
  background: #fff3de;
  color: #a56a10;
}

.artifact-card-status.is-ready {
  background: #eef4ff;
  color: #3770cb;
}

.artifact-card-status.is-applying {
  background: #eef1ff;
  color: #5d73d8;
}

.artifact-card-status.is-applied {
  background: #edf8f2;
  color: #2c8b66;
}

.artifact-card-subtitle {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--artifact-card-subtitle-color);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.artifact-card-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
  font-size: 11px;
  color: var(--artifact-card-meta-color);
}

.artifact-card-time {
  margin-top: 6px;
  font-size: 11px;
  color: var(--artifact-card-meta-color);
}

.artifact-card-action-row {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(92, 116, 148, 0.12);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--artifact-card-action-color);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  outline: none;
}

.artifact-card-action-row:hover,
.artifact-card-action-row:focus {
  color: #204d86;
}

.artifact-card-arrow {
  font-size: 14px;
  line-height: 1;
}
</style>
