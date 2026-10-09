<template>
  <div class="nocode-guide">
    <el-main class="main">
      <guide-welcome v-if="guideStep === GuideStep.Welcome" @next="handleNext" />
      <guide-work-bench-account v-else-if="guideStep === GuideStep.WorkBenchAccount" @completed="handleCompletedGuide" />
    </el-main>
  </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';

const emit = defineEmits<{
  (event: 'completedGuide', openWorkBench: boolean)
}>();

enum GuideStep {
  Welcome,
  WorkBenchAccount
}

const guideStep = ref(GuideStep.Welcome);

const handleNext = () => {
  guideStep.value++
}

const handleCompletedGuide = (needOpenWorkBench) => {
  guideStep.value++
  emit('completedGuide', needOpenWorkBench);
}
</script>

<style scoped lang='scss'>
.nocode-guide {
  width: 100%;
  height: 100%;
  background-color: var(--bg-color-page);

  .main {
    padding: 64px 64px 0 64px;
    height: 100%;
  }
}
</style>
