<template>
  <b2-widget>
    <div class="pdf-wrap" ref="pdfWrap" v-show="!showLoading">
      <!-- pdf控制按钮区域 -->
      <div class="pdf-control">
        <button @click="prev">&lt</button>
        <span class="page-num"> {{ state.pageNum }}/{{ state.pageCount }}{{ $t("page") }}</span>
        <button @click.prevent="next">></button>
        <button class="min" @click="minus">-</button>
        <button class="max" @click="addscale">+</button>
      </div>
      <!-- pdf文件内容渲染区域 -->
      <div class="pdf-content" ref="pdfContent"></div>
    </div>
    <el-container v-loading="showLoading" v-show="showLoading" :element-loading-background="loadingColor"></el-container>
  </b2-widget>
</template>

<script lang="ts" setup>
import { watch, ref, onMounted, computed, onUnmounted } from 'vue';
import { OptionFontValue, useWidget } from "@renderer/b2/types";
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';
import { reactive } from 'vue';
import { ElContainer } from 'element-plus';
import { Pdf } from './pdf';
import i18next, { $t } from "@renderer/widgets/i18next";

const pdf = useWidget<Pdf>();
const pdfWrap = ref<HTMLDivElement>(null);
const pdfContent = ref(null);
const showLoading = ref(false)
// PDF文件解析后的信息
const state = reactive<any>({
  pdfJs: null, // 加载的pdfjs
  pdfDoc: null, // pdfjs读取的页面信息
  pageNum: 0, // 当前页数
  pageCount: 0, // 总页数
  pageRendering: false, // 当前页面是否在渲染中
  pageNumPending: null, // 将要进行渲染的页面页数
  scale: pdf.getOption("loading-scall"), // 放大倍数
  maxscale: 5, // 最大放大倍数
  minscale: 0.3, // 最小放大倍数
})

const loadingColor = computed(() => {
  return pdf.getOption("loading-background-color");
})

let lastLoaded = "";
// pdfjs加载
const loadPdfJs = function (pdfResource) {
  if (pdfResource === '') return;
  if (lastLoaded !== pdfResource) {
    showLoading.value = true;
    lastLoaded = pdfResource;
  }
  if (state.pdfJs) {
    getDocument(pdfResource)
  } else {
    // 引入pdfjs，或以同步方式const pdfJs = require('pdfjs-dist')
    import('pdfjs-dist')
      .then((pdfJs) => {
        if (!pdfResource) {
          return
        }
        state.pdfJs = pdfJs
        // 注意：应该始终设置`workerSrc`选项，以防止发生操作使PDF.js库出现问题，该选项为一个包含工作文件的路径和文件名的字符串
        pdfJs.GlobalWorkerOptions.workerSrc = pdfjsWorker;
        getDocument(pdfResource);
      });
  }
}

// 读取pdf文件资源
const getDocument = function (pdfResource) {
  if (!pdfResource || typeof pdfResource !== 'string') return;
  // const encodedPdfResource = encodeURIComponent(pdfResource);
  state.pdfJs.getDocument(pdfResource)
    .promise.then((pdfDoc) => {
      state.pageNum = 1;
      state.pdfDoc = pdfDoc;
      state.pageCount = pdfDoc.numPages;
      renderPage(state.pageNum);
    });
}

// 渲染指定页面
const renderPage = function (num) {
  state.pageRendering = true;
  state.pdfDoc.getPage(num)
    .then((page) => {
      // 获取当前pdf页面信息
      const viewport = page.getViewport({ scale: state.scale });
      // 创建供当前pdf页面渲染的canvas元素
      const canvas = document.createElement('canvas');
      // 使用获取到的pdf信息，给canvas元素设定宽高
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      // 设定canvas元素样式信息
      canvas.setAttribute('style', 'margin: 0 auto;')
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(255, 255, 255, 0)';

      page.render({ canvasContext: ctx, viewport })
        .promise.then(() => {
          showLoading.value = false;
          // 画布进行实际的绘制
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          // 若当前页面已经存在已渲染的pdf画布dom，则移除
          const domCanvas = pdfContent.value.querySelector('canvas')
          if (domCanvas && domCanvas.parentElement === pdfContent.value) pdfContent.value.removeChild(domCanvas)
          // 将绘制好的canvas插入到页面dom中
          pdfContent.value.appendChild(canvas)
          state.pageRendering = false;
          // 若当前有还未渲染的下一页，则渲染下一页
          if (state.pageNumPending !== null) {
            renderPage(state.pageNumPending);
            state.pageNumPending = null;
          }
        });
    });
}

const pageTurn = ()=>{
  let btnClick = pdf.getOption("btn-click");
  if(!btnClick) return;
  let pageNum = state.pageNum
  btnClick ? next() : false;
  if(pageNum == state.pageCount) {
    state.pageNum = 1;
    queueRenderPage(state.pageNum)
  }
}

const handelMouseDown = (event)=>{
  const { screenX, screenY } = event;
  const style = pdfContent.value.style;
  let [startX, startY] = (style.translate ?? "none").replaceAll("px", "").split(" ").map(it=>Number(it));
  if(startY == undefined){
    [startX, startY] = [0,0];
  }
  const mousemoveFn = (ev)=>{
    let offsetX = startX + ev.screenX - screenX;
    let offsetY = startY + ev.screenY - screenY;
    style.translate = `${offsetX}px ${offsetY}px`;
  }
  const mouseupFn = (evt)=>{
    // 修改位置
    if(screenX == evt.screenX && screenY == evt.screenY){
      pageTurn();
    }
    document.removeEventListener("mousemove", mousemoveFn);
    document.removeEventListener("mouseup", mouseupFn);
  }
  document.addEventListener("mousemove", mousemoveFn);
  document.addEventListener("mouseup", mouseupFn)
}
onMounted(() => {
  watch(() => pdf.pdfFilePath, (val, oldVal) => {
    if (val !== oldVal) {
      if (pdfContent.value) {
        const domCanvas = pdfContent.value.querySelector('canvas');
        if (domCanvas && domCanvas.parentElement === pdfContent.value) pdfContent.value.removeChild(domCanvas);
      }
      loadPdfJs(pdf.pdfFilePath);
    }
    if(val) {
      let newItems = [];
      if(pdf.status.error?.data?.length) {
        pdf.status.error.data.forEach(item=>{
          if(["filed-empty", "filed-incomplete", "data-error"].indexOf(item.type) === -1) {
            newItems.push(item);
          }
        });
      }
      pdf.status.error.data = newItems;
    } else {
      pdf.status.error.data = [{ key: undefined, type: "filed-empty" }];
    }
  }, { deep: true, immediate: true })
  pdfWrap.value.addEventListener("mousedown", handelMouseDown);
})
onUnmounted(() => {
  pdfWrap.value.removeEventListener("mousedown", handelMouseDown);
})
// 监听右侧选中的路径变化

// 放大
const addscale = function () {
  if (!pdf.pdfFilePath) return;
  if (state.scale >= state.maxscale) {
    return;
  }
  state.scale += 0.1;
  pdf.setOption("loading-scall",state.scale)
  queueRenderPage(state.pageNum);
  pdfContent.value.style.translate = "none";
}

const getScreenRatio = () => {
  let ratio = 0;
  let screen = window.screen as any;
  let ua = navigator.userAgent.toLowerCase();

  if (window.devicePixelRatio !== undefined) {
    ratio = window.devicePixelRatio;
  } else if (~ua.indexOf('msie')) {
    if (screen.deviceXDPI && screen.logicalXDPI) {
      ratio = screen.deviceXDPI / screen.logicalXDPI;
    }
  } else if (window.outerWidth !== undefined && window.innerWidth !== undefined) {
    ratio = window.outerWidth / window.innerWidth;
  }
  if (ratio) {
    ratio = Math.round(ratio * 100);
  }
  return ratio;
}

// 缩小
const minus = function () {
  if (!pdf.pdfFilePath) return;
  if (state.scale <= state.minscale) {
    return;
  }
  state.scale -= 0.1;
  pdf.setOption("loading-scall",state.scale)
  queueRenderPage(state.pageNum);
  pdfContent.value.style.translate = "none";
}

// 上一页
const prev = function () {
  if (!pdf.pdfFilePath) return;
  if (state.pageNum <= 1) {
    return;
  }
  state.pageNum--;
  queueRenderPage(state.pageNum);
}

// 下一页
const next = function () {
  if (!pdf.pdfFilePath) return;
  if (state.pageNum >= state.pageCount) {
    return;
  }
  state.pageNum++;
  queueRenderPage(state.pageNum);
}

// 渲染队列
const queueRenderPage = function (num) {
  const number = Number(num);
  if (state.pageRendering) {
    state.pageNumPending = number;
  } else {
    renderPage(number);
  }
}


const btnStyle = computed(() => {
  let btnStyle: any = {};
  let btnFont= pdf.getOption<OptionFontValue>("btn-font")
  btnStyle.width = pdf.getOption("btn-size")+"px";
  btnStyle.height = pdf.getOption("btn-size")+"px";
  btnStyle.fontSize = btnFont.size+"px"
  btnStyle.family = btnFont.family;
  btnStyle.italic = btnFont.italic ? "italic" : "normal";
  btnStyle.bold = btnFont.bold ? "bold" : "normal";
  btnStyle.color = btnFont.color;
  return btnStyle
})

</script>

<style lang="scss" scoped>
.el-container {
  height: 100%;
  width: 100%;
}

.pdf-wrap {
  display: flex;
  justify-content: center;
  height: 100%;
  &:hover {
    .pdf-control {
      visibility: visible;
    }
  }

  .pdf-control {
    position: absolute;
    right: 0;
    bottom: 0;
    margin: 0 auto;
    height: v-bind("btnStyle.height");
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 12;
    visibility: hidden;
    text-align: center;
    font-size: v-bind("btnStyle.fontSize");
    color: v-bind("btnStyle.color");
    .page-number-input {
      width: 50px;
      border: none;
      border-radius: 2px;
      padding: 2px 4px;
    }

    .page-num {
      width: v-bind("btnStyle.width");
      height: v-bind("btnStyle.height");
      line-height: v-bind("btnStyle.height");
      background-color: rgba(42, 42, 42, 0.69);
    }

    button {
      color: v-bind("btnStyle.color");
      font-size: v-bind("btnStyle.size");
      font-weight: 600;
      cursor: pointer;
      width: v-bind("btnStyle.width");
      height: v-bind("btnStyle.height");
      border-radius: 50%;
      background-color: rgba(42, 42, 42, 0.69);
      border: none;
      margin: 0 5px;
      line-height: v-bind("btnStyle.height");
    }
    .pdf-choose {
      margin-left: 100px;
      color: white;
    }
  }
  .pdf-content{
    height: fit-content;
  }
}
</style>
