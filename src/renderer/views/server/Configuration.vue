<template>
  <div class="configuration">
    <guide-view @completedGuide="handleCompletedGuide" />
  </div>
</template>

<script lang='ts' setup>
import { useRouter } from 'vue-router';
import axios from "axios";

const router = useRouter();
const handleCompletedGuide = async () => {
  await axios.post("user/complete-server-init")
  router.replace({ path: "/server"});
}
</script>

<style lang='scss' scoped>

</style>
