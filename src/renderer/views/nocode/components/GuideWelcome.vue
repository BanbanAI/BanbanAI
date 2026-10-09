<template>
  <div class="nocode-guide-weclome server-welcome">
    <div class="content">
      <p class="title">{{ $t('guideWelcome.title') }}</p>
      <p class="introduction">{{ $t('guideWelcome.introduction') }}</p>
      <p class="assist">{{ $t('guideWelcome.assist') }}</p>
      <ul class="steps">
        <li>{{ $t('guideWelcome.step1') }}</li>
        <li>{{ $t('guideWelcome.step2') }}</li>
      </ul>
    </div>
    <el-divider class="divider"/>
    <div class="wrapper-next">
      <el-button class="app-no-drag" type="primary" @click="nextStep">{{ $t('nocodeLoginDialog.nextStep') }}</el-button>
    </div>
  </div>
</template>

<script setup lang='ts'>
const emit = defineEmits<{
  (event: 'next')
}>();
const nextStep = () => {
  emit('next');
};
</script>

<style scoped lang='scss'>
.nocode-guide-weclome {
  width: 100%;

  .content {
    width: 100%;

    p {
      font-size: 20px;
      line-height: 32px;

      &.title {
        font-size: 32px;
        font-weight: 500;
        margin-bottom: 12px;
        color: var(--text-color-primary);
      }

      &.introduction {
        line-height: 24px;
        font-size: 16px;
        color: #71757A;
      }

      &.assist {
        font-size: 20px;
        font-weight: 500;
        line-height: 32px;
        margin-top: 48px;
      }
    }

    .steps {
      margin-top: 8px;
      li {
        counter-increment: my-counter;
        position: relative;
        font-size: 14px;
        height: 24px;
        line-height: 24px;
        padding-left: 24px;
        margin-bottom: 8px;
        color: #36393D;

        &::before {
          content: counter(my-counter);
          display: inline-block;
          width: 16px;
          height: 16px;
          line-height: 16px;
          text-align: center;
          background-color: #82C5FF;
          color: white;
          border-radius: 50%;
          font-size: 12px;
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
        }
      }
    }
  }

  .divider {
    margin: 64px 0;
  }

  .wrapper-next {
    width: 100%;

    .el-button {
      width: 100%;
      height: 40px;
      border-radius: 4px;
      border: none;
      font-size: 16px;
      font-weight: 500;
    }
  }
}
.server-welcome {
  width: 1440px !important;
  padding: 0 176px;
  margin: 0 auto;
}
</style>
