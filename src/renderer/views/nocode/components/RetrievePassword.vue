<template>
  <div class="retrieve-password">
      <retrieve-password-form ref="retrievePasswordRef"></retrieve-password-form>
      <div class="retrieve-password-footer">
        <el-button type="primary" class="btn-next" @click="handleConfirm">{{ $t("nocodeLoginDialog.confirm") }}</el-button>
      </div>
  </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';

const emit = defineEmits<{
  (event: 'confirmModifyPass')
}>();

let retrievePasswordRef = ref();
const handleConfirm = async () => {
  let res = await retrievePasswordRef.value.changePassword()
    if (res) {
      emit("confirmModifyPass")
    }
}
</script>

<style scoped lang='scss'>
.retrieve-password {
  width: 100%;
  margin-top: 28px;

  .retrieve-password-footer {
    width: 100%;
    margin: 48px 0 24px 0;

    .btn-next {
      width: 100%;
      height: 40px;
      border-radius: 4px;
      background-color: #0873FF;
      span {
        letter-spacing: 10%;
      }
      &:hover {
        background-color: #3091FF;
      }
    }
  }
}
</style>