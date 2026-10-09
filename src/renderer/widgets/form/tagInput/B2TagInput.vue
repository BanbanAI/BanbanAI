<template>
  <b2-form-element class="tag-input" :class="{'mobile': isMobile()}">
    <div class="content" v-if="!widget.isReadonly">
      <el-input-tag
        v-if="!widget.isInSubForm || isMobile()"
        v-model="widget.inputValue"
        size="default"
        :placeholder="$t('inputTagPlaceholder')"
        ref="tagInputRef"
        @focus="handleFocus"
        @blur="handleBlur"
      />
      <template v-else="!widget.isInSubForm">
        <teleport to="body">
          <div class="input-tag-popper" :class="{'is-in-subform': widget.isInSubForm}" :id="`popper-${widget.uid}`"></div>
        </teleport>
        <el-popover
          width="220"
          :show-arrow="false"
          trigger="click"
          :teleported="true"
          :append-to="`#popper-${widget.uid}`"
        >
          <template #reference>
            <div class="input-tag-wrap">
              <el-input-tag readonly class="input-tag-in-subform" v-model="widget.inputValue" size="default" :placeholder="$t('addTagPlaceholder')" ref="tagInputRef">
              </el-input-tag>
            </div>
          </template>
          <el-input-tag v-model="widget.inputValue" size="default" :placeholder="i18next.t('inputTagPlaceholder')" ref="tagInputRef"></el-input-tag>
        </el-popover>
      </template>
    </div>
    <div v-else class="value" :class="{'mobile': isMobileDevice, 'empty': widget.inputValue?.length === 0}">
      <div v-if="widget.inputValue?.length > 0">
        <el-tag class="tag" v-for="(tag, index) in widget.inputValue" :key="index" type="info" :title="tag">
          {{ tag }}
        </el-tag>
      </div>
      <div class="placeholder" v-else :title="i18next.t('noContent')">{{ i18next.t('noContent') }}</div>
    </div>
  </b2-form-element>
</template>

<script lang="ts" setup>
import { isMobile } from "@renderer/utils/pure";
import { useWidget } from "@renderer/b2/types";
import { onMounted, ref, watch, nextTick } from "vue";
import { TagInput } from "./tagInput";
import i18next, { $t } from "@renderer/widgets/i18next";

const isMobileDevice = isMobile();

const inputVal = ref<string>()
const visible = ref(false)
const widget = useWidget<TagInput>();
const tagInputRef = ref<any>(null);
const isTyping = ref(false);

const handleFocus = () => {
  isTyping.value = true;
}

const handleBlur = () => {
  isTyping.value = false;
}

// 移动端自动聚焦
watch(() => widget.inputValue, async (newTags, oldTags) => {
  if (isMobile() && isTyping.value && newTags && oldTags && newTags.length > oldTags.length) {
    await nextTick();
    if (tagInputRef.value && typeof tagInputRef.value.focus === 'function') {
      tagInputRef.value.focus();
    }
  }
}, { deep: true });

</script>

<style lang="scss" scoped>
.tag-input {
  .content {
    .el-input {
      --el-input-border-radius: 4px;
    }

    :deep(.el-input-tag) {
      &.input-tag-in-subform {
        height: 32px;
        border-radius: 4px;
        pointer-events: none;

        .el-input-tag__inner {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          width: 100%;
          display: block;
          height: 32px;
          line-height: 30px;

          span {
            margin-right: 2px;

            &:last-child {
              margin-right: 0;
            }
          }
        }
      }
    }

  }
}

.value {
  display: flex;
  min-height: 32px;
  line-height: 32px;
  align-items: center;
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 2px;
  box-sizing: border-box;
  &.empty {
    color: var(--text-color-inactive);
    background: var(--el-bg-color-overlay);
    border: none;
  }
  .placeholder {
    color: var(--text-color-inactive);
  }

  > div {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
}

.content.mobile {
  .el-input-tag {
    min-height: 40px;
    border-radius: 4px;
    border: 1px solid var(--el-border-color);
    box-shadow: none !important;
    box-sizing: border-box;
  }
}
.value.mobile {
  min-height: 40px;
  line-height: 40px;
  background-color: var(--fill-color-blank);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 4px;
  align-content: initial;
}

.input-tag-popper {
  display: block;
  :deep(.el-popper) {
    background-color: var(--el-bg-color-page);
    padding: 8px;

    .el-input-tag {
      border-radius: 4px;
    }
  }
}
</style>
