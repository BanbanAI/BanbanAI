<template>
  <b2-form-element class="image-text-show">
    <div
      class="image-text-content"
      :class="{'mobile': isMobile()}"
      ref="imageTextRef"
      v-if="widget.inputValue && widget.inputValue != '<p><br></p>'"
      v-html="widget.inputValue"
    ></div>
    <div v-else class="empty-show">
      <el-empty :image-size="64" :description="$t('noData')">
        <template #image>
          <i-ven-icon-widget-form-image-text-show-empty-icon fill="#F5F6F7"></i-ven-icon-widget-form-image-text-show-empty-icon>
        </template>
      </el-empty>
    </div>
  </b2-form-element>
</template>

<script lang="ts" setup>
import { isMobile } from "@renderer/utils/pure";
import { useWidget } from "@renderer/b2/types";
import { ImageTextShow } from "./imageTextShow";
import IVenIconEmptyIcon from "~icons/ven-icon/widget-form-image-text-show-empty-icon"
import { onMounted, ref } from "vue";
import i18next, { $t } from "@renderer/widgets/i18next";

const widget = useWidget<ImageTextShow>();

// 获取image-text-content中所有的p标签
const imageTextRef = ref()
const imageTextPs = ref()

// 判断p标签是否有设置行高,没有默认行高为1.5
const pLineHeight = () => {
  if (imageTextRef.value) {
    imageTextPs.value = imageTextRef.value.querySelectorAll('p');
    imageTextPs.value.forEach(pItem => {
      console.log('imageTextPs',pItem.style.lineHeight);
      if (!pItem.style.lineHeight) {
        pItem.style.lineHeight = '1.5'
      }
    });
  }
}
onMounted(() => {
  pLineHeight()
})
</script>

<style lang="scss" scoped>
:deep(.image-text-content) {
  img,
  video,
  iframe,
  table {
    max-width: 100%;
  }
}

:deep(.image-text-content.mobile) {
  img {
    max-width: 100%;
    // object-fit: cover;
  }
}
</style>
