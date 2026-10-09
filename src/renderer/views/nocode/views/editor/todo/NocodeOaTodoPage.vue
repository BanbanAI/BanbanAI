<template>
  <div
    class="nocode-oa-todo-page"
    v-loading="loading"
    :element-loading-text="$t('nocodeOaTodoPage.loading')"
  >
    <template v-if="authorized">
      <MobileNocodeTodoBox v-if="isMobileDevice" @initialized="loading = false" />
      <NocodeTodoBox v-else :isShowSearch="true" @initialized="loading = false" />
    </template>
  </div>
</template>

<script lang='ts' setup>
import { provide, ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NOCODE_ID, ORGANIZE_UTIL } from '@renderer/types';
import { isMobile } from '@renderer/utils/pure';
import { OrganizeUtil } from '@renderer/views/nocode/utils';
import NocodeTodoBox from './NocodeTodoBox.vue';
import MobileNocodeTodoBox from '../../mobile/editor/todo/MobileNocodeTodoBox.vue';
import axios from 'axios';

const route = useRoute();
const router = useRouter();
const nocodeId = route.params.nocodeId as string;
const loading = ref(true);
const authorized = ref(false);
const isMobileDevice = isMobile();
const organizeUtil = new OrganizeUtil();

provide(NOCODE_ID, nocodeId);
provide(ORGANIZE_UTIL, organizeUtil);

onMounted(async () => {
  try {
    const { data } = await axios.get(`/project/can-view-nocode?nocodeId=${nocodeId}`);
    if (data) {
      authorized.value = true;
    } else {
      router.replace('/');
    }
  } catch {
    router.replace('/');
  }
});
</script>

<style lang='scss' scoped>
.nocode-oa-todo-page {
  width: 100%;
  height: 100%;
  background-color: var(--bg-color-page);
}
</style>
