<template>
  <div class="word-print-dialog-container">
    <el-dialog
      class="word-print-dialog"
      v-model="dialogVisible"
      center
      @close="cancel"
    >
      <div class="content">
        <div class="left">
          <div
            class="print-preview-paper"
            :style="currentEditionStyle"
          >
            <div
              class="print-preview-paper-pane"
              v-for="value in currentEditionOption.num"
              :key="value"
            >
              {{ printOrder === PrintOrder.REPEAT ? PrintEdition.ONE : value }}
            </div>
          </div>

          <div class="print-preview-name">
            {{$t('WordPrintDialog.perPage')}}{{ currentEditionOption.num }}{{ $t('WordPrintDialog.docCount') }}
          </div>
        </div>
        <div class="right">
          <div class="right-title">
            <div>{{ $t('WordPrintDialog.printSetting') }}</div>
            <div class="right-title-line" @click="close">
              <el-icon><i-ep-close></i-ep-close></el-icon>
            </div>
          </div>

          <div class="right-content">
            <div class="section">
              <div class="right-content-title">{{ $t('WordPrintDialog.printRange') }}</div>
              <el-radio-group
                class="right-content-item"
                v-model="printScope"
              >
                <div 
                  class="right-content-item-label"
                  v-for="item in printScopeOptions"
                  :key="item.value"
                >
                  <el-radio
                    :label="item.value"
                  >
                    {{ item.label }}
                  </el-radio>
                  <div 
                    v-if="item.value === PrintScope.SPECIFIED"
                    class="specified"
                  >
                    <el-input
                      v-model="specifiedPageRange"
                      placeholder="1-3，5，7-10"
                      style="border-radius: 4px;"
                    >
                    </el-input>
                  </div>
                </div>
              </el-radio-group>
            </div>

            <div class="section">
              <div class="right-content-title">{{ $t('WordPrintDialog.mergeAndScale') }}</div>
              <div class="right-content-item-label">
                <div class="span">{{ $t('WordPrintDialog.pagesPerSheet') }}</div>
                <div class="el-select-container">
                  <el-select
                    v-model="edition"
                    :placeholder="$t('WordPrintDialog.selectPagesPerSheet')"
                  >
                    <el-option
                      v-for="item in editionOptions"
                      :key="item.value"
                      :label="item.label"
                      :value="item.value"
                    />
                  </el-select>
                </div>
              </div>
            </div>

            <div class="section">
              <div class="right-content-title">{{ $t('WordPrintDialog.mergeOrder') }}</div>
              <el-radio-group
                class="right-content-item"
                v-model="printOrder"
                :disabled="edition === 1"
              >
                <div 
                  class="right-content-item-label"
                  v-for="item in printOrderOptions"
                  :key="item.value"
                >
                  <el-radio :label="item.value">
                    {{ item.label }}
                  </el-radio>
                </div>
              </el-radio-group>
            </div>
          </div>

          <div class="right-foot">
            <el-button type="primary" @click="nextStep">{{ $t('WordPrintDialog.nextStep') }}</el-button>
            <el-button @click="cancel">{{ $t('WordPrintDialog.cancel') }}</el-button>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang='ts'>
import { computed, ref } from 'vue';
import i18next from 'i18next';

// 打印范围
enum PrintScope {
  // 全部
  ALL = 'all',
  // 当前页
  CURRENT = 'current',
  // 指定页
  SPECIFIED = 'specified',
}

// 打印顺序
enum PrintOrder {
  // 从左到右
  ROW = 'row',
  // 从上到下
  COLUMN = 'column',
  // 重复
  REPEAT = 'repeat',
}
// 每页版数 1,2,4,6,8,9,16,32
enum PrintEdition {
  // 1
  ONE = 1,
  // 2
  TWO = 2,
  // 4
  FOUR = 4,
  // 6
  SIX = 6,
  // 8
  EIGHT = 8,
  // 9
  NINE = 9,
  // 16
  SIXTEEN = 16,
  // 32
  THIRTY_TWO = 32,
}
const PrintEditionStyle = {
  // 1
  [PrintEdition.ONE]: `
    grid-template-columns: repeat(1, 1fr);
    grid-template-rows: repeat(1, 1fr);
  `,
  // 2
  [PrintEdition.TWO]: `
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: repeat(1, 1fr);
  `,
  // 4
  [PrintEdition.FOUR]: `
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: repeat(2, 1fr);
  `,
  // 6
  [PrintEdition.SIX]: `
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(2, 1fr);
  `,
  // 8
  [PrintEdition.EIGHT]: `
    grid-template-columns: repeat(4, 1fr);
    grid-template-rows: repeat(2, 1fr);
  `,
  // 9
  [PrintEdition.NINE]: `
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(3, 1fr);
  `,
  // 16
  [PrintEdition.SIXTEEN]: `
    grid-template-columns: repeat(4, 1fr);
    grid-template-rows: repeat(4, 1fr);
  `,
  // 32
  [PrintEdition.THIRTY_TWO]: `
    grid-template-columns: repeat(4, 1fr);
    grid-template-rows: repeat(8, 1fr);
  `,
}
const dialogVisible = ref(false);

const resolvePromise = ref(null);

const printScope = ref<PrintScope>(PrintScope.ALL);
const printScopeOptions = ref([
  {
    get label() { return i18next.t('WordPrintDialog.all') },
    value: PrintScope.ALL,
  },
  {
    get label() { return i18next.t('WordPrintDialog.currentPage') },
    value: PrintScope.CURRENT,
  },
  {
    get label() { return i18next.t('WordPrintDialog.specifiedPage') },
    value: PrintScope.SPECIFIED,
  },
])
const printOrder = ref<PrintOrder>(PrintOrder.ROW);
const printOrderOptions = ref([
  {
    get label() { return i18next.t('WordPrintDialog.leftToRight') },
    value: PrintOrder.ROW,
  },
  {
    get label() { return i18next.t('WordPrintDialog.topToBottom') },
    value: PrintOrder.COLUMN,
  },
  {
    get label() { return i18next.t('WordPrintDialog.repeat') },
    value: PrintOrder.REPEAT,
  },
])
const editionMap = ref({
  [PrintEdition.ONE]: {
    num: PrintEdition.ONE,
    style: `
      width: 316px;
      height: 396px;
      ${PrintEditionStyle[PrintEdition.ONE]}
    `,
  },
  [PrintEdition.TWO]: {
    num: PrintEdition.TWO,
    style: `
      width: 396px;
      height: 316px;
      ${PrintEditionStyle[PrintEdition.TWO]}
    `,
  },
  [PrintEdition.FOUR]: {
    num: PrintEdition.FOUR,
    style: `
      width: 316px;
      height: 396px;
      ${PrintEditionStyle[PrintEdition.FOUR]}
    `,
  },
  [PrintEdition.SIX]: {
    num: PrintEdition.SIX,
    style: `
      width: 396px;
      height: 316px;
      ${PrintEditionStyle[PrintEdition.SIX]}
    `,
  },
  [PrintEdition.EIGHT]: {
    num: PrintEdition.EIGHT,
    style: `
      width: 396px;
      height: 316px;
      ${PrintEditionStyle[PrintEdition.EIGHT]}
    `,
  },
  [PrintEdition.NINE]: {
    num: PrintEdition.NINE,
    style: `
      width: 316px;
      height: 396px;
      ${PrintEditionStyle[PrintEdition.NINE]}
    `,
  },
  [PrintEdition.SIXTEEN]: { 
    num: PrintEdition.SIXTEEN,
    style: `
      width: 316px;
      height: 396px;
      ${PrintEditionStyle[PrintEdition.SIXTEEN]}
    `,
  },
  [PrintEdition.THIRTY_TWO]: {
    num: PrintEdition.THIRTY_TWO,
    style: `
      width: 316px;
      height: 396px;
      ${PrintEditionStyle[PrintEdition.THIRTY_TWO]}
    `,
  },
})
const edition = ref<PrintEdition>(PrintEdition.ONE);
const currentEditionOption = computed(() => {
  if (!editionMap.value[edition.value]) {
    return editionMap.value[1]
  }
  return editionMap.value[edition.value]
})
const currentEditionStyle = computed(() => {
  return `${currentEditionOption.value.style} grid-auto-flow: ${printOrder.value === PrintOrder.COLUMN ? 'column' : 'row'};`
})
const editionOptions = ref([
  {
    get label() { return i18next.t('WordPrintDialog.onePage') },
    value: PrintEdition.ONE,
  },
  {
    get label() { return i18next.t('WordPrintDialog.twoPages') },
    value: PrintEdition.TWO
  },
  {
    get label() { return i18next.t('WordPrintDialog.fourPages') },
    value: PrintEdition.FOUR
  },
  {
    get label() { return i18next.t('WordPrintDialog.sixPages') },
    value: PrintEdition.SIX
  },
  {
    get label() { return i18next.t('WordPrintDialog.eightPages') },
    value: PrintEdition.EIGHT
  },
  {
    get label() { return i18next.t('WordPrintDialog.ninePages') },
    value: PrintEdition.NINE
  },
  {
    get label() { return i18next.t('WordPrintDialog.sixteenPages') },
    value: PrintEdition.SIXTEEN
  },
  {
    get label() { return i18next.t('WordPrintDialog.thirtyTwoPages') },
    value: PrintEdition.THIRTY_TWO
  },
])
const specifiedPageRange = ref('');

const restoreDefault = () => {
  printScope.value = PrintScope.ALL;
  printOrder.value = PrintOrder.ROW;
  edition.value = PrintEdition.ONE;
  specifiedPageRange.value = '';
}
const nextStep = () => {
  if (resolvePromise.value) {
    resolvePromise.value({
      // 打印范围
      printScope: printScope.value,
      // 打印顺序
      printOrder: printOrder.value,
      // 打印版本
      edition: edition.value,
      // 指定页范围
      specifiedPageRange: specifiedPageRange.value,
    })
    dialogVisible.value = false;
  }
}
function cancel() {
  dialogVisible.value = false;
}
const show = () => {
  restoreDefault()
  dialogVisible.value = true;
  return new Promise((resolve, reject) => {
    resolvePromise.value = resolve;
  })
}
const close = () => {
  dialogVisible.value = false;
}
defineExpose({
  show,
  close,
})
</script>

<style lang="scss" scoped>
.word-print-dialog-container {
  :deep(.el-dialog.word-print-dialog) > .el-dialog__header {
    display: none;
  }
  :deep(.el-dialog.word-print-dialog) > .el-dialog__body {
    height: 100%;
    padding: 0px;

    --field-width: 122px;
    --field-border-radius: 4px;

    .content {
      height: 100%;
      width: 100%;
      display: flex;
      --right-width: 300px;
      .left {
        width: calc(100% - var(--right-width));
        height: 100%;
        background-color: #f5f5f5;

        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;

        .print-preview-paper {
          background-color: #fff; 
          border-radius: 8px;
          box-shadow: 0px 12px 32px rgba(13, 13, 13, 0.08);
          padding: 20px;
          box-sizing: border-box;
          display: grid;
          gap: 12px;

          .print-preview-paper-pane {
            border-radius: 8px;
            flex: 1;
            border: 1px solid rgba(13, 13, 13, 0.12);
            background: rgb(245, 245, 245);
            display: flex;
            justify-content: center;
            align-items: center;
            font-weight: 600;
            font-size: 20px;
            line-height: 32px;
            color: rgb(107, 107, 107);
          }

        }

        .print-preview-name {
          width: 100%;
          text-align: center;
          font-weight: 400;
          font-size: 18px;
          line-height: 30px;
          color: rgb(145, 145, 145);
          margin-top: 24px;
        }
      }
      .right {
        width: var(--right-width);
        height: 100%;
        background-color: #fff;
        display: flex;
        flex-direction: column;
        justify-content: space-between;

        .right-title {
          width: 100%;
          height: 68px;
          font-weight: 600;
          font-size: 16px;
          line-height: 24px;
          color: rgb(13, 13, 13);
          padding: 24px 24px 20px;
          border-bottom: 1px solid rgba(13, 13, 13, 0.06);

          display: flex;
          justify-content: space-between;
          align-items: center;
          .right-title-line {
            color: rgb(13, 13, 13);
            cursor: pointer;
          }
        }

        .right-content {
          width: 100%;
          flex-grow: 1;
          padding: 0 24px;
          box-sizing: border-box;
          overflow-y: auto;
        }
        .section {
          margin-top: 20px;
        }
        .right-content-title {
          font-weight: 600;
          font-size: 14px;
          line-height: 22px;
          color: rgb(13, 13, 13);
        }
        .right-content-item {
          display: flex;
          flex-direction: column;
        }
        .right-content-item-label {
          width: 100%;
          display: flex;
          justify-content: space-between;

          margin-top: 8px;
          
          .el-input {
            --el-input-border-radius: var(--field-border-radius);
            width: var(--field-width);
          }
          .el-select-container {
            --el-border-radius-base: var(--field-border-radius);
            width: var(--field-width);
          }
        }

        .right-foot {
          width: 100%;
          padding: 20px 24px;

          display: flex;
          flex-direction: column;
          gap: 10px;

          .el-button {
            width: 100%;
            height: 32px;
            margin: 0;
            border-radius: 6px;
          }
        }
      }
    }
  }
  :deep(.word-print-dialog).el-dialog {
    width: 940px;
    height: 640px;
    border-radius: 12px;
    overflow: hidden;
  }
}
</style>
