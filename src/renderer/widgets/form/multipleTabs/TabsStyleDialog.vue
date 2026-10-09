<template>
  <div class="validator-container">
    <el-dialog
      class="multiple-tabs-bar-dialog"
      :modelValue="isVisible"
      width="680"
      @update:modelValue="emit('update:modelValue', $event)"
      @open="onOpen"
      :align-center="true"
      destroy-on-close
      :close-on-click-modal="false"
      ref="dialogRef"
      style="background-color: #fff; padding: 0"
    >
      <template #header>
        <div class="my-header">{{ $t('chooseTabStyle') }}</div>
      </template>
      <el-form class="my-contain">
        <el-form-item class="align-radio">
          <el-radio-group
            class="align-radio-group"
            v-model="alignRadio"
            size="small"
          >
            <el-radio-button class="align-radio-left" value="left">
              <span class="align-radio-group-span">{{ i18next.t('alignLeft') }}</span>
            </el-radio-button>
            <el-radio-button class="align-radio-center" value="center">
              <span class="align-radio-group-span">{{ i18next.t('alignCenter') }}</span>
            </el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-scrollbar>
          <el-form-item class="tabs-select">
            <div
              class="tab-select-card"
              :class="{
                'select-tab': selectStyleValue === TitleType.TITLE_1,
              }"
              @click="handleSelectStyle({ selectval: TitleType.TITLE_1 })"
            >
              <div
                class="custom-tabs"
                :class="{
                  'title-center': alignRadio === 'center',
                  'title-left': alignRadio === 'left',
                }"
                ref="titleRef_1"
              >
                <div
                  class="tab-header"
                  v-for="(item, index) in tabsData"
                  :key="index"
                  :style="{
                    marginRight: '16px',
                    color: index === 0 ? '#0873FF' : '#14141466',
                  }"
                >
                  <span style="font-size: 14px; font-weight: 500">{{
                    item.label
                  }}</span>
                  <div
                    class="tab-header-bg"
                    :style="{
                      width: '100%',
                      height: '2px',
                      backgroundColor: index === 0 ? '#0873FF' : 'transparent',
                      position: 'absolute',
                      left: 0,
                      bottom: 0,
                    }"
                  >
                    <div class="background-show"></div>
                  </div>
                </div>
                <div
                  class="tab-under-line"
                  :style="{
                    width: '100%',
                    height: '2px',
                    backgroundColor: '#0873FF33',
                    position: 'absolute',
                    bottom: 0,
                  }"
                ></div>
              </div>
            </div>
            <div
              class="tab-select-card"
              :class="{
                'select-tab': selectStyleValue === TitleType.TITLE_2,
              }"
              @click="handleSelectStyle({ selectval: TitleType.TITLE_2 })"
            >
              <div
                class="custom-tabs"
                :class="{
                  'title-center': alignRadio === 'center',
                  'title-left': alignRadio === 'left',
                }"
                ref="titleRef_2"
              >
                <div
                  class="tab-header"
                  v-for="(item, index) in tabsData"
                  :key="index"
                  :style="{
                    marginRight: '16px',
                    padding: '0 8px',
                    height: '100%',
                    color: index === 0 ? '#0873FF' : '#14141466',
                  }"
                >
                  <span style="font-size: 14px; font-weight: 500">{{
                    item.label
                  }}</span>
                  <div
                    class="tab-header-bg"
                    :style="{
                      width: '100%',
                      height: '2px',
                      backgroundColor: index === 0 ? '#0873FF' : 'transparent',
                      position: 'absolute',
                      left: 0,
                      bottom: '0',
                    }"
                  >
                    <div
                      class="background-show"
                      :style="{
                        width: '100%',
                        height: titleSize_2.height + 'px',
                        backgroundColor:
                          index === 0 ? '#0873FF33' : 'transparent',
                        position: 'absolute',
                        top: -titleSize_2.height + 'px',
                        borderTopLeftRadius: '4px',
                        borderTopRightRadius: '4px',
                      }"
                    ></div>
                  </div>
                </div>
                <div
                  class="tab-under-line"
                  :style="{
                    width: '100%',
                    height: '2px',
                    backgroundColor: '#0873FF33',
                    position: 'absolute',
                    bottom: 0,
                  }"
                ></div>
              </div>
            </div>
            <div
              class="tab-select-card"
              :class="{
                'select-tab': selectStyleValue === TitleType.TITLE_3,
              }"
              @click="handleSelectStyle({ selectval: TitleType.TITLE_3 })"
            >
              <div
                class="custom-tabs"
                :class="{
                  'title-center': alignRadio === 'center',
                  'title-left': alignRadio === 'left',
                }"
                ref="titleRef_3"
              >
                <div
                  class="tab-header"
                  v-for="(item, index) in tabsData"
                  :key="index"
                  :style="{
                    padding: '10px 20px',
                    color: index === 0 ? '#0873FF' : '#14141466',
                  }"
                >
                  <span style="font-size: 14px; font-weight: 500">{{
                    item.label
                  }}</span>
                  <div
                    class="tab-header-bg"
                    :style="{
                      width: '100%',
                      position: 'absolute',
                      left: 0,
                      bottom: '-2px',
                      zIndex: 99,
                    }"
                  >
                    <div
                      class="background-show"
                      :style="{
                        width: '100%',
                        height: titleSize_3.height - 12 + 'px',
                        position: 'absolute',
                        bottom: '8px',
                        borderRadius: '8px',
                        outline:
                          index === 0 ? '1.5px solid #0873FF' : 'transparent',
                      }"
                    ></div>
                  </div>
                </div>
                <div
                  class="tab-under-line"
                  :style="{
                    width: '100%',
                    height: '1px',
                    backgroundColor: '#1414141A',
                    position: 'absolute',
                    bottom: '5px',
                  }"
                ></div>
              </div>
            </div>
            <div
              class="tab-select-card"
              :class="{
                'select-tab': selectStyleValue === TitleType.TITLE_4,
              }"
              @click="handleSelectStyle({ selectval: TitleType.TITLE_4 })"
            >
              <div
                class="custom-tabs"
                :class="{
                  'title-center': alignRadio === 'center',
                  'title-left': alignRadio === 'left',
                }"
                ref="titleRef_4"
              >
                <div
                  class="tab-header"
                  v-for="(item, index) in tabsData"
                  :key="index"
                  :style="{
                    padding: '8px 15px',
                    height: '100%',
                    color: index === 1 ? '#ffffff' : '#14141466',
                  }"
                >
                  <span
                    :style="{
                      fontSize: '14px',
                      fontWeight: 500,
                      zIndex: 999,
                      position: 'relative',
                    }"
                    >{{ item.label }}</span
                  >
                  <div
                    class="tab-header-bg"
                    :style="{
                      width: '100%',
                      backgroundColor: 'transparent',
                      position: 'absolute',
                      left: 0,
                      bottom: '0',
                    }"
                  >
                    <div
                      class="background-show"
                      :style="{
                        width: '100%',
                        height: titleSize_4.height - 8 + 'px',
                        backgroundColor:
                          index === 1 ? '#0873FF' : 'transparent',
                        position: 'absolute',
                        bottom: '4px',
                        borderTopLeftRadius: '8px',
                        borderTopRightRadius: '8px',
                      }"
                    >
                      <div
                        v-if="index === 1"
                        :style="{
                          width: '20px',
                          height: '20px',
                          borderBottomLeftRadius: '10px',
                          borderLeft: '4px solid #0873FF',
                          borderBottom: '4px solid #0873FF',
                          position: 'absolute',
                          right: '-16px',
                          bottom: '0',
                        }"
                      ></div>
                      <div
                        v-if="index === 1"
                        :style="{
                          width: '20px',
                          height: '20px',
                          borderBottomRightRadius: '10px',
                          borderRight: '4px solid #0873FF',
                          borderBottom: '4px solid #0873FF',
                          position: 'absolute',
                          left: '-16px',
                          bottom: '0',
                        }"
                      ></div>
                    </div>
                  </div>
                </div>
                <div
                  class="tab-under-line"
                  :style="{
                    width: '100%',
                    height: '4px',
                    backgroundColor: '#0873FF',
                    position: 'absolute',
                    bottom: '4px',
                  }"
                ></div>
              </div>
            </div>
            <div
              class="tab-select-card"
              :class="{
                'select-tab': selectStyleValue === TitleType.TITLE_5,
              }"
              @click="handleSelectStyle({ selectval: TitleType.TITLE_5 })"
            >
              <div
                class="custom-tabs"
                :class="{
                  'title-center': alignRadio === 'center',
                  'title-left': alignRadio === 'left',
                }"
                ref="titleRef_5"
              >
                <div
                  class="tab-header"
                  v-for="(item, index) in tabsData"
                  :key="index"
                  :style="{
                    padding: getTab5Padding(index),
                    margin: getTab5Margin(index),
                    height: '100%',
                    color: index === 0 ? '#ffffff' : '#0873FF',
                  }"
                >
                  <span
                    :style="{
                      fontSize: '14px',
                      fontWeight: 500,
                      zIndex: 999,
                      position: 'relative',
                    }"
                    >{{ item.label }}</span
                  >
                  <div
                    class="tab-header-bg"
                    :style="{
                      width: '100%',
                      position: 'absolute',
                      left: 0,
                      bottom: '0',
                      backgroundColor:
                        index === 0 ? '#0873FF1A' : 'transparent',
                    }"
                  >
                    <div
                      class="background-show"
                      :style="{
                        width: '100%',
                        height: titleSize_5.height - 12 + 'px',
                        backgroundColor: index === 0 ? '#0873FF' : '#0873FF1A',
                        position: 'absolute',
                        bottom: '6px',
                        borderTopLeftRadius: index === 0 && alignRadio === 'left' ? '8px' : '',
                      }"
                    >
                      <div
                        v-if="index === 0 || index === tabsData.length - 1"
                        :style="{
                          content: '',
                          width: '100%',
                          height: '100%',
                          backgroundColor:
                            index === 0 ? '#0873FF' : '#0873FF1A',
                          position: 'absolute',
                          top: 0,
                          right: '-100%',
                          clipPath: `path('M 0,0 C 18,0 18,36 36,36 L 0,36 Z')`,
                          zIndex: index === 0 ? 999 : undefined,
                        }"
                      ></div>
                      <div
                        v-if="index === 0 && alignRadio === 'center'"
                        :style="{
                          content: '',
                          width: '100%',
                          height: '100%',
                          backgroundColor:
                            index === 0 ? '#0873FF' : '#0873FF1A',
                          position: 'absolute',
                          top: 0,
                          left: '-63%',
                          clipPath: `path('M 0,36 C 18,36 18,0 36,0 L 36,36 Z')`,
                          zIndex: index === 0 ? 999 : undefined,
                        }"
                      ></div>
                    </div>
                  </div>
                </div>
                <div
                  class="tab-under-line"
                  :style="{
                    width: '100%',
                    height: '4px',
                    backgroundColor: '#0873FF',
                    position: 'absolute',
                    bottom: '6px',
                  }"
                ></div>
              </div>
            </div>
            <div
              class="tab-select-card"
              :class="{
                'select-tab': selectStyleValue === TitleType.TITLE_6,
              }"
              @click="handleSelectStyle({ selectval: TitleType.TITLE_6 })"
            >
              <div
                class="custom-tabs"
                :class="{
                  'title-center': alignRadio === 'center',
                  'title-left': alignRadio === 'left',
                }"
                ref="titleRef_6"
              >
                <div
                  class="tab-header"
                  v-for="(item, index) in tabsData"
                  :key="index"
                  :style="{
                    padding: '10px 20px',
                    height: '100%',
                    color: index === 0 ? '#ffffff' : '#14141466',
                  }"
                >
                  <span
                    :style="{
                      fontSize: '14px',
                      fontWeight: 500,
                      zIndex: 999,
                      position: 'relative',
                    }"
                    >{{ item.label }}</span
                  >
                  <div
                    class="tab-header-bg"
                    :style="{
                      width: '100%',
                      backgroundColor: 'transparent',
                      position: 'absolute',
                      left: 0,
                      bottom: '0',
                    }"
                  >
                    <div
                      class="background-show"
                      :style="{
                        width: '100%',
                        height: titleSize_6.height - 12 + 'px',
                        backgroundColor:
                          index === 0 ? '#0873FF' : 'transparent',
                        position: 'absolute',
                        bottom: '6px',
                        borderRadius: titleSize_6.height - 12 + 'px',
                      }"
                    >
                      <div
                        :style="{
                          width: '20px',
                          height: '2px',
                          backgroundColor:
                            index === 0 ? '#ffffff' : 'transparent',
                          borderRadius: '65px',
                          position: 'absolute',
                          bottom: '4px',
                          left: '40%',
                        }"
                      ></div>
                    </div>
                  </div>
                </div>
                <div
                  class="tab-under-line"
                  :style="{
                    width: '100%',
                    height: '1px',
                    backgroundColor: '#1414141A',
                    position: 'absolute',
                    bottom: '6px',
                  }"
                ></div>
              </div>
            </div>
            <div
              class="tab-select-card"
              :class="{
                'select-tab': selectStyleValue === TitleType.TITLE_7,
              }"
              @click="handleSelectStyle({ selectval: TitleType.TITLE_7 })"
            >
              <div
                class="custom-tabs"
                :class="{
                  'title-center': alignRadio === 'center',
                  'title-left': alignRadio === 'left',
                }"
                ref="titleRef_7"
              >
                <div
                  class="tab-header"
                  v-for="(item, index) in tabsData"
                  :key="index"
                  :style="{
                    padding: '10px 20px',
                    height: '100%',
                    color: index === 1 ? '#ffffff' : '#0873FF',
                  }"
                >
                  <span
                    :style="{
                      fontSize: '14px',
                      fontWeight: 500,
                      zIndex: 999,
                      position: 'relative',
                    }"
                    >{{ item.label }}</span
                  >
                  <div
                    class="tab-header-bg"
                    :style="{
                      width: '100%',
                      backgroundColor: 'transparent',
                      position: 'absolute',
                      left: 0,
                      bottom: '0',
                    }"
                  >
                    <div
                      class="background-show"
                      :style="{
                        width: '100%',
                        height: titleSize_7.height - 12 + 'px',
                        backgroundColor: index === 1 ? '#0873FF' : '#0873FF1A',
                        position: 'absolute',
                        bottom: '6px',
                        borderTopLeftRadius: '12px',
                        borderTopRightRadius: '12px',
                      }"
                    ></div>
                  </div>
                </div>
                <div
                  class="tab-under-line"
                  :style="{
                    width: '100%',
                    height: '1px',
                    backgroundColor: '#1414141A',
                    position: 'absolute',
                    bottom: '6px',
                  }"
                ></div>
              </div>
            </div>
            <div
              class="tab-select-card"
              :class="{
                'select-tab': selectStyleValue === TitleType.TITLE_8,
              }"
              @click="handleSelectStyle({ selectval: TitleType.TITLE_8 })"
            >
              <div
                class="custom-tabs"
                :class="{
                  'title-center': alignRadio === 'center',
                  'title-left': alignRadio === 'left',
                }"
                ref="titleRef_8"
              >
                <div
                  class="tab-header"
                  v-for="(item, index) in tabsData"
                  :key="index"
                  :style="{
                    padding: '10px 0px 10px 8px',
                    marginRight: '32px',
                    height: '100%',
                    color: index === 1 ? '#ffffff' : '#0873FF',
                  }"
                >
                  <span
                    :style="{
                      fontSize: '14px',
                      fontWeight: 500,
                      zIndex: 999,
                      position: 'relative',
                    }"
                    >{{ item.label }}</span
                  >
                  <div
                    class="tab-header-bg"
                    :style="{
                      width: '100%',
                      backgroundColor: 'transparent',
                      position: 'absolute',
                      left: 0,
                      bottom: '0',
                    }"
                  >
                    <div
                      class="background-show"
                      :style="{
                        width: '100%',
                        height: titleSize_8.height - 12 + 'px',
                        backgroundColor: index === 1 ? '#0873FF' : '#0873FF1A',
                        position: 'absolute',
                        bottom: '6px',
                        borderTopLeftRadius: '8px',
                        borderBottomLeftRadius: '8px',
                      }"
                    >
                      <div
                        :style="{
                          width: titleSize_8.height - 12 + 'px',
                          position: 'absolute',
                          top: 0,
                          right: -titleSize_8.height + 12 + 'px',
                        }"
                      >
                        <IVenIconTab8Right
                          :style="{
                            fill: index === 1 ? '#0873FF' : '#0873FF1A',
                            width: titleSize_8.height - 12 + 'px',
                            height: titleSize_8.height - 12 + 'px',
                          }"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div class="tab-under-line" :style="{}"></div>
              </div>
            </div>
          </el-form-item>
        </el-scrollbar>
      </el-form>
      <template #footer>
        <div class="my-footer">
          <el-button class="cancel-bth" type="default" @click="dialogClosed"
            >{{ i18next.t('cancel') }}</el-button
          >
          <el-button class="confirm-btn" type="primary" @click="confirm"
            >{{ i18next.t('confirm') }}</el-button
          >
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { useDialogStore } from "@renderer/stores/dialog";
import { number } from "mathjs";
import { computed, onMounted, ref, watch } from "vue";
import { MultipleTabs, tabsTitleStyleType } from "./multipleTabs";
import { TitleType } from "./type";
import IVenIconTab8Right from "~icons/ven-icon/widget-form-multiple-tabs-tab-8-right";
import i18next, { $t } from "@renderer/widgets/i18next";

const dialogState = useDialogStore();
const props = defineProps<{
  modelValue: boolean;
  widget: MultipleTabs;
  value?: tabsTitleStyleType;
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean);
  (event: "update", value: tabsTitleStyleType): void;
}>();

const isVisible = computed(() => {
  return props.modelValue;
});

const alignRadio = ref("left");
const selectStyleValue = ref<string>(TitleType.TITLE_1);

const handleSelectStyle = (data) => {
  selectStyleValue.value = data.selectval;
};

const onOpen = () => {
  if (props.value) {
    alignRadio.value = props.value?.tabsAlign;
    selectStyleValue.value = props.value?.selectVal;
  }
};

const handleUpdateModelValue = (val) => {
  dialogState["formDesignerEmptyDialogVisible"] = val;
  emit("update:modelValue", val);
};

const dialogClosed = () => {
  dialogState["formDesignerEmptyDialogVisible"] = false;
  emit("update:modelValue", false);
};

// 按钮提交
const confirm = () => {
  emit("update", {
    selectVal: selectStyleValue.value,
    tabsAlign: alignRadio.value,
  });
  dialogClosed();
};

// tabs表头
const tabsData = [
  { name: i18next.t("tabPreview1"), label: i18next.t("tabPreview1") },
  { name: i18next.t("tabPreview2"), label: i18next.t("tabPreview2") },
  { name: i18next.t("tabPreview3"), label: i18next.t("tabPreview3") },
];

const titleRef_1 = ref();
const titleRef_2 = ref();
const titleRef_3 = ref();
const titleRef_4 = ref();
const titleRef_5 = ref();
const titleRef_6 = ref();
const titleRef_7 = ref();
const titleRef_8 = ref();

const titleSize_1 = ref<{
  width: number,
  height: number,
}>({
  width: undefined,
  height: undefined,
});
const titleSize_2 = ref<{
  width: number,
  height: number,
}>({
  width: undefined,
  height: undefined,
});
const titleSize_3 = ref<{
  width: number,
  height: number,
}>({
  width: undefined,
  height: undefined,
});
const titleSize_4 = ref<{
  width: number,
  height: number,
}>({
  width: undefined,
  height: undefined,
});
const titleSize_5 = ref<{
  width: number,
  height: number,
}>({
  width: undefined,
  height: undefined,
});
const titleSize_6 = ref<{
  width: number,
  height: number,
}>({
  width: undefined,
  height: undefined,
});
const titleSize_7 = ref<{
  width: number,
  height: number,
}>({
  width: undefined,
  height: undefined,
});
const titleSize_8 = ref<{
  width: number,
  height: number,
}>({
  width: undefined,
  height: undefined,
});

const getTab5Padding = (index: number) => {
  if (index === 0) {
    if (alignRadio.value === "left") {
      return "10px 0 10px 20px";
    } else {
      return "10px 0";
    }
  } else if (index === tabsData.length - 1) {
    return "10px 0 10px 20px";
  } else {
    return "10px 20px";
  }
};
const getTab5Margin = (index: number) => {
  if (index === 0) {
    if (alignRadio.value === "left") {
      return "0 10px 0 0";
    } else {
      return "0 10px";
    }
  } else if (index === tabsData.length - 1) {
    return "0 10px 0 0";
  } else {
    return "";
  }
};

onMounted(() => {
  watch(titleRef_1, () => {
    if (titleRef_1.value) {
      titleSize_1.value = {
        width: titleRef_1.value.offsetWidth,
        height: titleRef_1.value.offsetHeight,
      };
    }
  });
  watch(titleRef_2, () => {
    if (titleRef_2.value) {
      titleSize_2.value = {
        width: titleRef_2.value.offsetWidth,
        height: titleRef_2.value.offsetHeight,
      };
    }
  });
  watch(titleRef_3, () => {
    if (titleRef_3.value) {
      titleSize_3.value = {
        width: titleRef_3.value.offsetWidth,
        height: titleRef_3.value.offsetHeight,
      };
    }
  });
  watch(titleRef_4, () => {
    if (titleRef_4.value) {
      titleSize_4.value = {
        width: titleRef_4.value.offsetWidth,
        height: titleRef_4.value.offsetHeight,
      };
    }
  });
  watch(titleRef_5, () => {
    if (titleRef_5.value) {
      titleSize_5.value = {
        width: titleRef_5.value.offsetWidth,
        height: titleRef_5.value.offsetHeight,
      };
    }
  });
  watch(titleRef_6, () => {
    if (titleRef_6.value) {
      titleSize_6.value = {
        width: titleRef_6.value.offsetWidth,
        height: titleRef_6.value.offsetHeight,
      };
    }
  });
  watch(titleRef_7, () => {
    if (titleRef_7.value) {
      titleSize_7.value = {
        width: titleRef_7.value.offsetWidth,
        height: titleRef_7.value.offsetHeight,
      };
    }
  });
  watch(titleRef_8, () => {
    if (titleRef_8.value) {
      titleSize_8.value = {
        width: titleRef_8.value.offsetWidth,
        height: titleRef_8.value.offsetHeight,
      };
    }
  });
});
</script>

<style lang="scss" scoped>
.title-center {
  text-align: center;
  justify-content: center;
}

.title-left {
  align-items: flex-start;
  text-align: left;
}

.select-tab {
  border: 1px solid rgb(0, 137, 255) !important;
}

:deep(.el-radio-button:first-child) .el-radio-button__inner {
  border-top-left-radius: 4px !important;
  border-bottom-left-radius: 4px !important;
}

:deep(.el-radio-button:last-child) .el-radio-button__inner {
  border-top-right-radius: 4px !important;
  border-bottom-right-radius: 4px !important;
}

:deep(.el-dialog__header) {
  padding: 10px !important;
}

:deep(.el-dialog__footer) {
  padding: 16px;
}

.validator-container {
  .multiple-tabs-bar-dialog {
    .my-header {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      line-height: 20px;
    }

    .my-contain {
      margin: 0 auto;
      padding: 16px;
      width: 100%;
      border-top: 1px solid var(--border-color-light);
      border-bottom: 1px solid var(--border-color-light);
      .align-radio {
        width: 100%;
        margin-bottom: 24px;
        .align-radio-group {
          .align-radio-group-span {
            padding: 0 129px;
          }
        }
      }
      .tabs-select {
        width: 100%;
        height: 340px;
        padding: 0;

        :hover .tab-select-card {
          cursor: var(--cursor-pointer);
        }

        .tab-select-card {
          color: #0089ff;
          width: 100%;
          height: 60px;
          padding: 15px 8px;
          margin-bottom: 12px;
          border: 1px solid var(--border-color-light);
          background-color: #fafafa;
          border-radius: 4px;
          position: relative;
          display: flex;
          align-items: center;
          .custom-tabs {
            display: flex;
            width: 100%;
            position: relative;
            .tab-header {
              position: relative;
            }
          }
        }
      }
    }

    .my-footer {
      .cancel-bth {
        border-radius: 4px;
      }

      .confirm-btn {
        border-radius: 4px;
        margin-left: 8px;
      }
    }
  }
}
</style>
