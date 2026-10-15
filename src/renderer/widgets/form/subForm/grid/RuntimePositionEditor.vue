<template>
  <div class="runtime-position-editor" :class="{ 'is-filled': hasValue }" @click.stop>
    <div v-if="hasValue" class="runtime-position-editor__info" :title="infoTitle">
      <span class="runtime-position-editor__value">{{ draft }}</span>
      <el-icon v-if="clearButton" class="runtime-position-editor__clear" @click="clear"><CircleClose /></el-icon>
    </div>
    <button
      type="button"
      class="runtime-position-editor__button"
      :disabled="loading"
      @click="locate"
    >
      <IVenIconLocation v-if="!loading" class="runtime-position-editor__icon" />
      <span class="runtime-position-editor__text">{{ loading ? positioningText : getLocationText }}</span>
    </button>
  </div>
</template>

<script lang="ts" setup>
import axios from "axios";
import { computed, onMounted, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { CircleClose } from "@element-plus/icons-vue";
import IVenIconLocation from "~icons/ven-icon/widget-form-position-location";
import i18next from "@renderer/widgets/i18next";

const props = defineProps<{
  modelValue: unknown;
  mapKey?: unknown;
  clearButton?: boolean;
  showCoordinates?: boolean;
  autoPosition?: boolean;
  autoPositionKey?: string;
}>();
const emit = defineEmits<{ (event: "commit", value: string): void; (event: "cancel"): void }>();

const getLocationText = computed(() => i18next.t("subFormPositionGetLocation"));
const positioningText = computed(() => i18next.t("subFormPositionPositioning"));

const toText = (value: unknown) => (value === null || value === undefined ? "" : String(value));

const draft = ref(toText(props.modelValue));
const subInfo = ref("");
const loading = ref(false);
const hasValue = computed(() => !!draft.value);
const infoTitle = computed(() => (subInfo.value ? `${draft.value} ${subInfo.value}` : draft.value));

watch(() => props.modelValue, value => {
  if (loading.value) return;
  draft.value = toText(value);
  if (!draft.value) subInfo.value = "";
});

const autoLocatedKeys = new Set<string>();

onMounted(() => {
  if (!props.autoPosition || !props.autoPositionKey || draft.value) return;
  if (autoLocatedKeys.has(props.autoPositionKey)) return;
  autoLocatedKeys.add(props.autoPositionKey);
  locate();
});

function clear() {
  subInfo.value = "";
  draft.value = "";
  emit("commit", "");
}

function locate() {
  if (loading.value) return;
  if (!props.mapKey) {
    ElMessage.error(i18next.t("subFormPositionMissingMapKey"));
    return;
  }
  if (!navigator.geolocation) {
    ElMessage.error(i18next.t("subFormPositionUnsupported"));
    return;
  }
  loading.value = true;
  navigator.geolocation.getCurrentPosition(
    async position => {
      try {
        const latitude = parseFloat(position.coords.latitude.toFixed(6));
        const longitude = parseFloat(position.coords.longitude.toFixed(6));
        const location = `${longitude},${latitude}`;
        const response = await axios.get("/client/amap/regeo", {
          baseURL: "",
          params: { location, mapKey: props.mapKey },
        });
        draft.value = String(response.data?.formattedAddress || location);
        subInfo.value = props.showCoordinates
          ? i18next.t("subFormPositionCoordinates", { latitude, longitude })
          : "";
        emit("commit", draft.value);
      } catch (error) {
        ElMessage.error({
          message: (error as any)?.response?.data?.message || i18next.t("subFormPositionFailed"),
          duration: 5000,
        });
      } finally {
        loading.value = false;
      }
    },
    error => {
      ElMessage.error({
        message: error?.code === 1
          ? i18next.t("subFormPositionDenied")
          : i18next.t("subFormPositionTimeout"),
        duration: 5000,
      });
      loading.value = false;
    },
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
  );
}
</script>

<style scoped>
.runtime-position-editor {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  height: 32px;
}

.runtime-position-editor.is-filled {
  flex-direction: row-reverse;
}

.runtime-position-editor__info {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--el-border-color, var(--border-color));
  border-radius: 4px;
  background: var(--el-fill-color-light, #f5f6f8);
}

.runtime-position-editor__value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  line-height: 1.2;
  color: var(--el-text-color-regular, var(--text-color-primary));
}

.runtime-position-editor__clear {
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
  font-size: 14px;
  cursor: pointer;
  color: var(--el-text-color-secondary, var(--text-color-secondary));
}

.runtime-position-editor__clear:hover {
  color: var(--el-color-primary, var(--color-primary));
}

.runtime-position-editor__button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0 8px;
  border: 1px dashed var(--el-border-color, var(--border-color));
  border-radius: 4px;
  background: var(--el-fill-color-blank, #fff);
  color: var(--el-text-color-regular, var(--text-color-primary));
  font: inherit;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}

.runtime-position-editor__button:hover:not(:disabled) {
  border-color: var(--el-color-primary, var(--color-primary));
  color: var(--el-color-primary, var(--color-primary));
}

.runtime-position-editor__button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 1px var(--el-color-primary, var(--color-primary)) inset;
}

.runtime-position-editor__button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.is-filled .runtime-position-editor__button {
  flex: 0 0 28px;
  width: 28px;
  padding: 0;
}

.runtime-position-editor__icon {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
}

.runtime-position-editor__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.is-filled .runtime-position-editor__text {
  display: none;
}
</style>
