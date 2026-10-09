<template>
  <div class="validator-container">
    <el-dialog
      class="title-bar-dialog"
      :modelValue="isVisible"
      :title="$t('chooseBorder')"
      @update:modelValue="emit('update:modelValue', $event)"
      @open="onOpen"
      :align-center="true"
      width="680"
      destroy-on-close
      :close-on-click-modal="false"
      ref="dialogRef"
      style="background-color: #fff; padding: 0"
    >
      <template #header>
        <div class="my-header">{{ $t('chooseBorder') }}</div>
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
          <el-form-item class="border-select">
            <div
              class="border-select-card"
              :class="{
                'select-border': selectStyleValue === TitleType.TITLE_1,
              }"
              @click="handleSelectStyle({ selectval: TitleType.TITLE_1 })"
            >
              <div>
                <div
                  class="title-text"
                  :class="{
                    'title-center': alignRadio === 'center',
                    'title-left': alignRadio === 'left',
                  }"
                >
                  <div class="title-value">
                    <span ref="titleRef_1">{{ i18next.t('titleNamePreview') }}</span>
                  </div>
                </div>
                <div class="title-line"></div>
              </div>
            </div>
            <div
              class="border-select-card"
              :class="{
                'select-border': selectStyleValue === TitleType.TITLE_2,
              }"
              @click="handleSelectStyle({ selectval: TitleType.TITLE_2 })"
            >
              <div>
                <div
                  class="title-text"
                  :class="{
                    'title-center': alignRadio === 'center',
                    'title-left': alignRadio === 'left',
                  }"
                >
                  <div class="title-value">
                    <span ref="titleRef_2">{{ i18next.t('titleNamePreview') }}</span>
                  </div>
                  <div
                    class="title-bg-box"
                    :style="{ width: titleWidth_2 + 'px', bottom: '-10px' }"
                  ></div>
                </div>
                <div class="title-line"></div>
              </div>
            </div>
            <div
              class="border-select-card"
              :class="{
                'select-border': selectStyleValue === TitleType.TITLE_3,
              }"
              @click="handleSelectStyle({ selectval: TitleType.TITLE_3 })"
            >
              <div>
                <div
                  class="title-text"
                  :class="{
                    'title-center': alignRadio === 'center',
                    'title-left': alignRadio === 'left',
                  }"
                >
                  <div class="title-value">
                    <span ref="titleRef_3">{{ i18next.t('titleNamePreview') }}</span>
                  </div>
                  <div
                    class="title-bg-box"
                    :style="{
                      width: titleWidth_3 + 'px',
                      height: '4px',
                      bottom: '-11px',
                      borderRadius: '100px',
                    }"
                  ></div>
                </div>
                <div class="title-line"></div>
              </div>
            </div>
            <div
              class="border-select-card"
              :class="{
                'select-border': selectStyleValue === TitleType.TITLE_4,
              }"
              @click="handleSelectStyle({ selectval: TitleType.TITLE_4 })"
            >
              <div>
                <div
                  class="title-text"
                  :class="{
                    'title-center': alignRadio === 'center',
                    'title-left': alignRadio === 'left',
                  }"
                >
                  <div class="title-value">
                    <span ref="titleRef_4">{{ i18next.t('titleNamePreview') }}</span>
                  </div>
                  <div
                    class="title-bg-box"
                    :style="{
                      width: titleWidth_4 + 'px',
                      height: '6px',
                      bottom: '-14px',
                      borderBottomRightRadius: '100px',
                      borderBottomLeftRadius:
                        alignRadio === 'center' ? '100px' : '0',
                    }"
                  ></div>
                </div>
                <div class="title-line"></div>
              </div>
            </div>
            <div
              class="border-select-card"
              :class="{
                'select-border': selectStyleValue === TitleType.TITLE_5,
              }"
              @click="handleSelectStyle({ selectval: TitleType.TITLE_5 })"
            >
              <div>
                <div
                  class="title-text"
                  :class="{
                    'title-center': alignRadio === 'center',
                    'title-left': alignRadio === 'left',
                  }"
                >
                  <div
                    class="title-value"
                    :style="{
                      backgroundColor: '#fafafa',
                      paddingRight: '25px',
                      paddingLeft: alignRadio === 'center' ? '25px' : '0',
                    }"
                  >
                    <span ref="titleRef_5">{{ i18next.t('titleNamePreview') }}</span>
                  </div>
                  <div
                    class="title-bg-box"
                    :style="{
                      width:
                        alignRadio === 'left'
                          ? titleWidth_5 + 8 + 'px'
                          : titleWidth_5 + 16 + 'px',
                      bottom: '-10px',
                      height: '32px',
                      backgroundColor: '#fafafa',
                      borderBottom: '2px solid rgba(0, 137, 255, .2)',
                    }"
                  >
                    <div
                      class="oblique-left-line"
                      :style="{
                        position: 'absolute',
                        left: '-23px',
                        bottom: '8px',
                        zIndex: '999',
                        display: alignRadio === 'left' ? 'none' : 'block',
                      }"
                    ></div>
                    <div
                      class="oblique-right-line"
                      :style="{
                        position: 'absolute',
                        right: '-23px',
                        bottom: '8px',
                        zIndex: '999',
                      }"
                    ></div>
                  </div>
                </div>
                <div class="title-line" :style="{ margin: '-12px 0' }"></div>
              </div>
            </div>
            <div
              class="border-select-card"
              :class="{
                'select-border': selectStyleValue === TitleType.TITLE_6,
              }"
              @click="handleSelectStyle({ selectval: TitleType.TITLE_6 })"
            >
              <div>
                <div
                  class="title-text"
                  :class="{
                    'title-center': alignRadio === 'center',
                    'title-left': alignRadio === 'left',
                  }"
                >
                  <div
                    ref="titleRef_6"
                    class="title-value"
                    :style="{
                      padding: '0 14px',
                      position: 'absolute',
                      top: '4px',
                    }"
                  >
                    <span>{{ i18next.t('titleNamePreview') }}</span>
                  </div>
                  <div
                    class="title-bg-box"
                    :style="{
                      width: titleWidth_6 + 'px',
                      bottom: '-10px',
                      height: '32px',
                      backgroundColor: 'rgba(0, 137, 255, .2)',
                      borderTopRightRadius: '12px',
                      borderTopLeftRadius:
                        alignRadio === 'center' ? '12px' : '0',
                    }"
                  ></div>
                </div>
                <div class="title-line"></div>
              </div>
            </div>
            <div
              class="border-select-card"
              :class="{
                'select-border': selectStyleValue === TitleType.TITLE_7,
              }"
              @click="handleSelectStyle({ selectval: TitleType.TITLE_7 })"
            >
              <div>
                <div
                  class="title-text"
                  :class="{
                    'title-center': alignRadio === 'center',
                    'title-left': alignRadio === 'left',
                  }"
                >
                  <div
                    ref="titleRef_7"
                    class="title-value"
                    :style="{ padding: '0 14px', marginTop: '4px' }"
                  >
                    <span>{{ i18next.t('titleNamePreview') }}</span>
                  </div>
                  <div
                    class="title-bg-box title-corner-border"
                    :style="{
                      width: titleWidth_7 + 'px',
                      bottom: '-10px',
                      height: '32px',
                      backgroundColor: 'rgba(0, 137, 255, .2)',
                      borderRadius: '5px',
                      border: 'none',
                    }"
                  >
                    <div
                      :style="{
                        position: 'absolute',
                        top: '-1px',
                        left: '-1px',
                        width: '12px',
                        height: '12px',
                        borderTopLeftRadius: '5px',
                        borderTop: '2px solid rgb(0, 137, 255)',
                        borderLeft: '2px solid rgb(0, 137, 255)',
                      }"
                    ></div>
                    <div
                      :style="{
                        position: 'absolute',
                        bottom: '-1px',
                        right: '-1px',
                        width: '12px',
                        height: '12px',
                        borderBottomRightRadius: '5px',
                        borderRight: '2px solid rgb(0, 137, 255)',
                        borderBottom: '2px solid rgb(0, 137, 255)',
                      }"
                    ></div>
                  </div>
                </div>
                <div
                  class="title-line"
                  :style="{
                    marginLeft:
                      alignRadio === 'left' ? titleWidth_7 + 'px' : '0',
                  }"
                ></div>
                <div
                  class="short-line"
                  :style="{
                    position: 'absolute',
                    left: '8px',
                    bottom: '13px',
                    display: alignRadio === 'left' ? 'none' : 'block',
                  }"
                ></div>
                <div
                  class="short-line"
                  :style="{
                    position: 'absolute',
                    right: '8px',
                    bottom: '13px',
                  }"
                ></div>
              </div>
            </div>
            <div
              class="border-select-card"
              :class="{
                'select-border': selectStyleValue === TitleType.TITLE_8,
              }"
              @click="handleSelectStyle({ selectval: TitleType.TITLE_8 })"
            >
              <div>
                <div
                  class="title-text"
                  :class="{
                    'title-center': alignRadio === 'center',
                    'title-left': alignRadio === 'left',
                  }"
                  :style="{
                    height: '32px',
                    alignItems: 'center',
                    backgroundColor: 'rgba(0, 137, 255, .2)',
                  }"
                >
                  <div
                    ref="titleRef_8"
                    class="title-value"
                    :style="{
                      padding: '0 14px',
                      borderLeft: '2px solid rgb(0, 137, 255)',
                      borderRight:
                        alignRadio === 'center'
                          ? '2px solid rgb(0, 137, 255)'
                          : 'none',
                    }"
                  >
                    <span>{{ i18next.t('titleNamePreview') }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div
              class="border-select-card"
              :class="{
                'select-border': selectStyleValue === TitleType.TITLE_9,
              }"
              @click="handleSelectStyle({ selectval: TitleType.TITLE_9 })"
            >
              <div>
                <div
                  class="title-text"
                  :class="{
                    'title-center': alignRadio === 'center',
                    'title-left': alignRadio === 'left',
                  }"
                >
                  <div
                    ref="titleRef_9"
                    class="title-value"
                    :style="{
                      padding: '0 14px',
                      position: 'absolute',
                      top: '4px',
                      color: '#fff',
                    }"
                  >
                    <span>{{ i18next.t('titleNamePreview') }}</span>
                  </div>
                  <div
                    class="title-bg-box"
                    :style="{
                      width: titleWidth_9 + 'px',
                      bottom: '-10px',
                      height: '32px',
                      backgroundColor: 'rgb(0, 137, 255)',
                      borderTopRightRadius: '12px',
                      borderTopLeftRadius:
                        alignRadio === 'center' ? '12px' : '0',
                    }"
                  ></div>
                </div>
                <div class="title-line"></div>
              </div>
            </div>
            <div
              class="border-select-card"
              :class="{
                'select-border': selectStyleValue === TitleType.TITLE_10,
              }"
              @click="handleSelectStyle({ selectval: TitleType.TITLE_10 })"
            >
              <div>
                <div
                  class="title-text"
                  :class="{
                    'title-center': alignRadio === 'center',
                    'title-left': alignRadio === 'left',
                  }"
                >
                  <div
                    ref="titleRef_10"
                    class="title-value"
                    :style="{
                      padding: '0 14px',
                      position: 'absolute',
                      top: '4px',
                      color: '#fff',
                    }"
                  >
                    <span>{{ i18next.t('titleNamePreview') }}</span>
                  </div>
                  <div
                    class="title-bg-box"
                    :style="{
                      width: titleWidth_10 + 'px',
                      bottom: '-12px',
                      height: '36px',
                      backgroundColor: 'rgb(0, 137, 255)',
                    }"
                  >
                    <div
                      class="left-triangle"
                      :style="{
                        position: 'absolute',
                        left: '-18px',
                        top: '0',
                        display: alignRadio === 'left' ? 'none' : 'block',
                      }"
                    ></div>
                    <div
                      class="right-triangle"
                      :style="{
                        position: 'absolute',
                        right: '-18px',
                        top: '0',
                      }"
                    ></div>

                    <div
                      :style="{
                        width: '20px',
                        height: '18px',
                        overflow: 'hidden',
                        backgroundColor: '#fafafa',
                        position: 'absolute',
                        left: '-38px',
                        top: '9px',
                        zIndex: '99',
                        display: alignRadio === 'left' ? 'none' : 'block',
                      }"
                    >
                      <div
                        class="right-big-line-triangle"
                        :style="{
                          position: 'absolute',
                          top: '3px',
                          right: '-5px',
                          transform: 'rotate(225deg)',
                        }"
                      ></div>
                      <div
                        class="right-small-line-triangle"
                        :style="{
                          position: 'absolute',
                          left: '3px',
                          top: '5px',
                          transform: 'rotate(225deg)',
                        }"
                      ></div>
                    </div>
                    <div
                      :style="{
                        width: '20px',
                        height: '18px',
                        overflow: 'hidden',
                        backgroundColor: '#fafafa',
                        position: 'absolute',
                        right: '-38px',
                        top: '9px',
                        zIndex: '99',
                      }"
                    >
                      <div
                        class="right-big-line-triangle"
                        :style="{
                          position: 'absolute',
                          top: '3px',
                          left: '-5px',
                          transform: 'rotate(45deg)',
                        }"
                      ></div>
                      <div
                        class="right-small-line-triangle"
                        :style="{
                          position: 'absolute',
                          right: '3px',
                          top: '5px',
                          transform: 'rotate(45deg)',
                        }"
                      ></div>
                    </div>
                  </div>
                </div>
                <div class="title-line" :style="{ margin: '-7px 0' }"></div>
              </div>
            </div>
            <div
              class="border-select-card"
              :class="{
                'select-border': selectStyleValue === TitleType.TITLE_11,
              }"
              @click="handleSelectStyle({ selectval: TitleType.TITLE_11 })"
            >
              <div>
                <div
                  class="title-text"
                  :class="{
                    'title-center': alignRadio === 'center',
                    'title-left': alignRadio === 'left',
                  }"
                >
                  <div
                    ref="titleRef_11"
                    class="title-value"
                    :style="{
                      padding: '0 14px',
                      position: 'absolute',
                      top: '4px',
                      color: '#fff',
                    }"
                  >
                    <span>{{ i18next.t('titleNamePreview') }}</span>
                  </div>
                  <div
                    class="title-bg-box"
                    :style="{
                      width: titleWidth_11 + 'px',
                      bottom: '-12px',
                      height: '36px',
                      backgroundColor: 'rgb(0, 137, 255)',
                      borderBottomRightRadius: '12px',
                      borderBottomLeftRadius:
                        alignRadio === 'center' ? '12px' : '0',
                    }"
                  >
                    <div
                      class="right-bottom-triangle"
                      :style="{
                        position: 'absolute',
                        left: '-12px',
                        top: '0',
                        display: alignRadio === 'left' ? 'none' : 'block',
                      }"
                    ></div>
                    <div
                      class="left-bottom-triangle"
                      :style="{
                        position: 'absolute',
                        left: titleWidth_11 + 'px',
                        top: '0',
                      }"
                    ></div>
                  </div>
                </div>
                <div class="title-line" :style="{ margin: '-12px 0' }"></div>
              </div>
            </div>
            <div
              class="border-select-card"
              :class="{
                'select-border': selectStyleValue === TitleType.TITLE_12,
              }"
              @click="handleSelectStyle({ selectval: TitleType.TITLE_12 })"
            >
              <div>
                <div
                  class="title-text"
                  :class="{
                    'title-center': alignRadio === 'center',
                    'title-left': alignRadio === 'left',
                  }"
                >
                  <div
                    :style="{
                      width: '100%',
                      height: '36px',
                      backgroundColor: 'rgba(0, 137, 255, .2)',
                      position: 'absolute',
                      left: '0',
                      top: '-4px',
                    }"
                  >
                    <div
                      :style="{
                        width: '100%',
                        height: '6px',
                        backgroundColor: 'rgb(0, 137, 255)',
                        position: 'absolute',
                        top: '0',
                      }"
                    ></div>
                  </div>

                  <div
                    ref="titleRef_12"
                    class="title-value"
                    :style="{
                      padding: '0 14px',
                      position: 'absolute',
                      top: '4px',
                      color: '#fff',
                    }"
                  >
                    <span>{{ i18next.t('titleNamePreview') }}</span>
                  </div>
                  <div
                    class="title-bg-box"
                    :style="{
                      width: titleWidth_12 + 'px',
                      bottom: '-12px',
                      height: '36px',
                      backgroundColor: 'rgb(0, 137, 255)',
                      borderBottomRightRadius: '12px',
                      borderBottomLeftRadius:
                        alignRadio === 'center' ? '12px' : '0',
                    }"
                  >
                    <div
                      :style="{
                        width: '20px',
                        height: '20px',
                        borderTopRightRadius: '12px',
                        borderRight: '4px solid rgb(0, 137, 255)',
                        borderTop: '4px solid rgb(0, 137, 255)',
                        position: 'absolute',
                        left: '-16px',
                        top: '2px',
                        display: alignRadio === 'left' ? 'none' : 'block',
                      }"
                    ></div>
                    <div
                      :style="{
                        width: '20px',
                        height: '20px',
                        borderTopLeftRadius: '12px',
                        borderLeft: '4px solid rgb(0, 137, 255)',
                        borderTop: '4px solid rgb(0, 137, 255)',
                        position: 'absolute',
                        right: '-16px',
                        top: '2px',
                      }"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
            <div
              class="border-select-card"
              :class="{
                'select-border': selectStyleValue === TitleType.TITLE_13,
              }"
              @click="handleSelectStyle({ selectval: TitleType.TITLE_13 })"
            >
              <div>
                <div
                  class="title-text"
                  :class="{
                    'title-center': alignRadio === 'center',
                    'title-left': alignRadio === 'left',
                  }"
                >
                  <div
                    ref="titleRef_13"
                    class="title-value"
                    :style="{
                      padding: '0 14px',
                      position: 'absolute',
                      top: '4px',
                      color: '#fff',
                    }"
                  >
                    <span>{{ i18next.t('titleNamePreview') }}</span>
                  </div>
                  <div
                    class="title-bg-box"
                    :style="{
                      width: titleWidth_13 + 'px',
                      bottom: '-9px',
                      height: '30px',
                      backgroundColor: 'rgb(0, 137, 255)',
                    }"
                  >
                    <div
                      :style="{
                        position: 'absolute',
                        left: '-16px',
                        top: '-2px',
                        transform: 'rotate(90deg)',
                        display: alignRadio === 'left' ? 'none' : 'block',
                      }"
                    >
                      <div
                        :style="{
                          width: '34px',
                          height: '34px',
                          borderRadius: '20%',
                          backgroundColor: 'rgb(0, 137, 255)',
                          transform: 'rotate(30deg) skewY(30deg) scaleX(0.866)',
                        }"
                      ></div>
                      <div
                        :style="{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: '#fafafa',
                          position: 'absolute',
                          left: '13px',
                          bottom: '6px',
                        }"
                      ></div>
                    </div>
                    <div
                      :style="{
                        position: 'absolute',
                        right: '-16px',
                        top: '-2px',
                        transform: 'rotate(90deg)',
                      }"
                    >
                      <div
                        :style="{
                          width: '34px',
                          height: '34px',
                          borderRadius: '20%',
                          backgroundColor: 'rgb(0, 137, 255)',
                          transform: 'rotate(30deg) skewY(30deg) scaleX(0.866)',
                        }"
                      ></div>
                      <div
                        :style="{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: '#fafafa',
                          position: 'absolute',
                          left: '13px',
                          top: '6px',
                        }"
                      ></div>
                    </div>
                  </div>
                </div>
                <div class="title-line" :style="{ margin: '-7px 0' }"></div>
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
import { useWidget } from "@renderer/b2/types";
import { computed, onMounted, ref, watch } from "vue";
import { TitleBar, titleStyleType } from "../titleBar";
import { TitleType } from "../type";
import i18next, { $t } from "@renderer/widgets/i18next";

const dialogState = useDialogStore();
const props = defineProps<{
  modelValue: boolean;
  widget: TitleBar;
  value?: titleStyleType;
}>();
const emit = defineEmits<{
  (event: "update:modelValue", value: boolean);
  (event: "update", value: titleStyleType): void;
}>();

const alignRadio = ref("left");

const isVisible = computed(() => {
  return props.modelValue;
});

const titleRef_1 = ref();
const titleRef_2 = ref();
const titleRef_3 = ref();
const titleRef_4 = ref();
const titleRef_5 = ref();
const titleRef_6 = ref();
const titleRef_7 = ref();
const titleRef_8 = ref();
const titleRef_9 = ref();
const titleRef_10 = ref();
const titleRef_11 = ref();
const titleRef_12 = ref();
const titleRef_13 = ref();

const handleUpdateModelValue = (val) => {
  dialogState["formDesignerEmptyDialogVisible"] = val;
  emit("update:modelValue", val);
};

const dialogClosed = () => {
  dialogState["formDesignerEmptyDialogVisible"] = false;
  alignRadio.value = "";
  selectStyleValue.value = "";
  emit("update:modelValue", false);
};

const titleWidth_1 = ref();
const titleWidth_2 = ref();
const titleWidth_3 = ref();
const titleWidth_4 = ref();
const titleWidth_5 = ref();
const titleWidth_6 = ref();
const titleWidth_7 = ref();
const titleWidth_8 = ref();
const titleWidth_9 = ref();
const titleWidth_10 = ref();
const titleWidth_11 = ref();
const titleWidth_12 = ref();
const titleWidth_13 = ref();

const selectStyleValue = ref<string>(TitleType.TITLE_1);
const selectDivRef = ref();

const handleSelectStyle = (data) => {
  selectStyleValue.value = data.selectval;
};

const onOpen = () => {
  if (props.value) {
    alignRadio.value = props.value?.titleAlign;
    selectStyleValue.value = props.value?.selectVal;
  }
};

// 按钮提交
const confirm = () => {
  emit("update", {
    selectVal: selectStyleValue.value,
    titleAlign: alignRadio.value,
  });
  dialogClosed();
};

onMounted(() => {
  watch(titleRef_1, () => {
    if (titleRef_1.value) {
      titleWidth_1.value = titleRef_1.value.offsetWidth;
    }
  });
  watch(titleRef_2, () => {
    if (titleRef_2.value) {
      titleWidth_2.value = titleRef_2.value.offsetWidth;
    }
  });
  watch(titleRef_3, () => {
    if (titleRef_3.value) {
      titleWidth_3.value = titleRef_3.value.offsetWidth;
    }
  });
  watch(titleRef_4, () => {
    if (titleRef_4.value) {
      titleWidth_4.value = titleRef_4.value.offsetWidth;
    }
  });
  watch(titleRef_5, () => {
    if (titleRef_5.value) {
      titleWidth_5.value = titleRef_5.value.offsetWidth;
    }
  });
  watch(titleRef_6, () => {
    if (titleRef_6.value) {
      titleWidth_6.value = titleRef_6.value.offsetWidth;
    }
  });
  watch(titleRef_7, () => {
    if (titleRef_7.value) {
      titleWidth_7.value = titleRef_7.value.offsetWidth;
    }
  });
  watch(titleRef_8, () => {
    if (titleRef_8.value) {
      titleWidth_8.value = titleRef_8.value.offsetWidth;
    }
  });
  watch(titleRef_9, () => {
    if (titleRef_9.value) {
      titleWidth_9.value = titleRef_9.value.offsetWidth;
    }
  });
  watch(titleRef_10, () => {
    if (titleRef_10.value) {
      titleWidth_10.value = titleRef_10.value.offsetWidth;
    }
  });
  watch(titleRef_11, () => {
    if (titleRef_11.value) {
      titleWidth_11.value = titleRef_11.value.offsetWidth;
    }
  });
  watch(titleRef_12, () => {
    if (titleRef_12.value) {
      titleWidth_12.value = titleRef_12.value.offsetWidth;
    }
  });
  watch(titleRef_13, () => {
    if (titleRef_13.value) {
      titleWidth_13.value = titleRef_13.value.offsetWidth;
    }
  });
});
</script>

<style lang="scss" scoped>
.title-center {
  text-align: center;
  align-items: center;
  justify-content: center;
}

.title-left {
  align-items: flex-start;
  text-align: left;
}

.left-bottom-triangle {
  width: 0;
  height: 0;
  border-bottom: 12px solid rgb(6, 86, 191);
  border-right: 12px solid transparent;
}

.right-bottom-triangle {
  width: 0;
  height: 0;
  border-bottom: 12px solid rgb(6, 86, 191);
  border-left: 12px solid transparent;
}

.short-line {
  width: 12px;
  height: 2px;
  background-color: #0089ff;
}

.oblique-right-line {
  width: 28px;
  height: 2px;
  background-color: rgba(0, 137, 255, 0.2);
  transform: rotate(135deg);
}

.oblique-left-line {
  width: 28px;
  height: 2px;
  background-color: rgba(0, 137, 255, 0.2);
  transform: rotate(45deg);
}

.right-triangle {
  width: 0;
  height: 0;
  border-left: 18px solid rgb(0, 137, 255);
  border-top: 18px solid transparent;
  border-bottom: 18px solid transparent;
}

.left-triangle {
  width: 0;
  height: 0;
  border-right: 18px solid rgb(0, 137, 255);
  border-top: 18px solid transparent;
  border-bottom: 18px solid transparent;
}

.right-big-line-triangle {
  width: 12px;
  height: 12px;
  border-top: 2px solid rgb(0, 137, 255);
  border-right: 2px solid rgb(0, 137, 255);
}

.right-small-line-triangle {
  width: 8px;
  height: 8px;
  border-top: 2px solid rgb(0, 137, 255);
  border-right: 2px solid rgb(0, 137, 255);
}

.select-border {
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
  .title-bar-dialog {
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

      .border-select {
        width: 100%;
        height: 340px;
        padding: 0;

        :hover .border-select-card {
          cursor: var(--cursor-pointer);
        }

        .border-select-card {
          color: #0089ff;
          width: 100%;
          height: 60px;
          padding: 15px 8px;
          margin-bottom: 12px;
          border: 1px solid var(--border-color-light);
          background-color: #fafafa;
          border-radius: 4px;
          position: relative;
          .title-text {
            height: 20px;
            width: 100%;
            position: relative;
            display: flex;
            .title-value {
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              height: 20px;
              line-height: 20px;
              min-width: 7%;
              max-width: 76%;
              z-index: 999;
            }
            .title-bg-box {
              position: absolute;
              border-bottom: 2px solid #0089ff;
              background-color: #0089ff;
            }
          }
          .title-line {
            margin: 8px 0;
            border: 1px solid #0089ff;
            opacity: 0.2;
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
