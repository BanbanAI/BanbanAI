<template>
  <!-- 列表容器 -->
  <div
    class="lazy-grid-container"
    ref="containerRef"
    @scroll.passive="handleScroll"
    :style="{
      width: containerWidth + 'px',  // 支持自定义容器宽度
      height: containerHeight + 'px'
    }"
  >
    <!-- 内容区域 -->
    <div
      class="grid-content"
      :style="{
        width: contentWidth + 'px',
        height: contentHeight + 'px'
      }"
    >
      <!-- 动态渲染的可见项 -->
      <div
        v-for="item in visibleItems"
        :key="item.id"
        class="grid-item"
        :style="{
          width: itemWidth + 'px',
          height: itemHeight + 'px',
          transform: `translate(${item.x}px, ${item.y}px)`
        }"
      >
        <!-- 支持垂直居中的插槽 -->
        <div class="item-content">
          <slot :item="item.data">
            {{ item.data.name }}
          </slot>
        </div>
      </div>
    </div>

    <!-- 加载提示 -->
    <div v-if="isLoading" class="loading">Loading...</div>
    <div v-if="!hasMore" class="no-more">No more data</div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed, nextTick } from 'vue'

// ============== Props 定义 ==============
const props = defineProps({
  // 所有数据（需包含唯一 id）
  data: {
    type: Array,
    required: true
  },
  // 容器宽度
  containerWidth: {
    type: Number,
    default: 800
  },
  // 容器高度
  containerHeight: {
    type: Number,
    default: 600
  },
  // 子元素宽度
  itemWidth: {
    type: Number,
    default: 200
  },
  // 子元素高度
  itemHeight: {
    type: Number,
    default: 120
  },
  // 横向间距
  columnGap: {
    type: Number,
    default: 20
  },
  // 纵向间距
  rowGap: {
    type: Number,
    default: 20
  }
})

// ============== 响应式状态 ==============
const containerRef = ref(null)
const visibleItems = ref([])
const isLoading = ref(false)
const hasMore = ref(true)
const currentIndex = ref(0)

// ============== 计算属性 ==============
// 容器一行能容纳的列数
const columnsPerRow = computed(() => {
  return Math.floor(
    (props.containerWidth + props.columnGap) / 
    (props.itemWidth + props.columnGap)
  )
})
// 容器能容纳的行数
const rowsPerContainer = computed(() => {
  return Math.ceil(
    (props.containerHeight + props.rowGap) /
    (props.itemHeight + props.rowGap)
  )
})

// 内容区域总宽度
const contentWidth = computed(() => {
  return columnsPerRow.value * (props.itemWidth + props.columnGap) - props.columnGap
})

// 内容区域总高度
const contentHeight = computed(() => {
  const rows = Math.ceil(props.data.length / columnsPerRow.value)
  return rows * (props.itemHeight + props.rowGap) - props.rowGap
})

// ============== 核心逻辑 ==============
// 计算布局位置（包含垂直居中逻辑）
const calculateLayout = (startIndex, endIndex) => {
  return props.data.slice(startIndex, endIndex).map((item, index) => {
    const globalIndex = startIndex + index
    const row = Math.floor(globalIndex / columnsPerRow.value)
    const col = globalIndex % columnsPerRow.value

    return {
      id: item.id,
      data: item,
      x: col * (props.itemWidth + props.columnGap),
      y: row * (props.itemHeight + props.rowGap)
    }
  })
}

// 加载更多数据
const loadMore = async () => {
  if (isLoading.value || !hasMore.value) return
  isLoading.value = true

  // 每次加载 3 行数据
  const itemsPerLoad = columnsPerRow.value * rowsPerContainer.value
  const endIndex = Math.min(currentIndex.value + itemsPerLoad, props.data.length)
  
  visibleItems.value = [
    ...visibleItems.value,
    ...calculateLayout(currentIndex.value, endIndex)
  ]
  
  currentIndex.value = endIndex
  hasMore.value = currentIndex.value < props.data.length
  isLoading.value = false
}

// 滚动事件处理
const handleScroll = () => {
  if (!containerRef.value) return
  const { scrollTop, clientHeight } = containerRef.value
  
  // 滚动到 80% 时触发加载
  if (scrollTop + clientHeight > clientHeight * 0.8) {
    loadMore()
  }
}

// 初始化加载
onMounted(() => {
  loadMore() 
})

// 数据变化监听
watch(() => props.data, async () => {
  visibleItems.value = []
  currentIndex.value = 0
  hasMore.value = true
  containerRef.value.scrollTop = 0
  await nextTick()
  loadMore()
})
</script>

<style scoped lang="scss">
.lazy-grid-container {
  display: flex;
  justify-content: center;
  overflow-y: auto;
  position: relative;
  &::-webkit-scrollbar {
   display: none; 
  }
}

.grid-content {
  position: relative;
}

.grid-item {
  position: absolute;
  box-sizing: border-box;
  display: flex;          /* 新增：启用 flex 布局 */
  align-items: center;    /* 新增：垂直居中 */
  justify-content: center; /* 新增：水平居中 */
  transition: transform 0.2s;
}

.item-content {
  width: 100%;            /* 确保内容宽度填充 */
  height: 100%;           /* 确保内容高度填充 */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.loading,
.no-more {
  display: none;
  text-align: center;
  padding: 16px;
  position: sticky;
  bottom: 0;
  background: linear-gradient(
    to top,
    rgba(255, 255, 255, 1) 60%,
    rgba(255, 255, 255, 0.8)
  );
}
</style>