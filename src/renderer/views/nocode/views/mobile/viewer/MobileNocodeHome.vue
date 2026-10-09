<template>
   <mobile-nocode-page-view v-if="nocode" />
</template>

<script setup lang="ts" name="layout">
import { ref, provide } from 'vue';
import { usePassportStore } from '@renderer/stores';
import { Nocode } from '@common/types/nocode';
import { useRoute } from 'vue-router';
import axios from 'axios';
import { NOCODE_THEME_COLOR, NOCODE, NOCODE_ID, ORGANIZE_UTIL, ClientTheme } from '@renderer/types';

const passportState = usePassportStore();

// 获取nocodeMeta，并设置title
const route = useRoute();
const nocodeId = route.params.nocodeId as string;
const nocode = ref<Nocode>();
passportState.init(nocodeId);

const initNocode = async () => {
  try {
    const themeColor = ref("#0089ff")
    provide(NOCODE_THEME_COLOR, themeColor); 

    let res = await axios.get(`workbench/${nocodeId}/get-nocode-preview?filter=sharing`);
    const theNocode: Nocode = res.data;

    if (theNocode.body.themeColor) {
      themeColor.value = theNocode.body.themeColor;
    }

    if (theNocode?.body?.theme && theNocode.body.theme === ClientTheme.Dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    nocode.value = theNocode;
    document.title = nocode.value?.meta?.name;
  }catch(err) {
    console.log("get nocode error", err);
  }
}
initNocode();

provide(NOCODE, nocode);
provide(NOCODE_ID, nocodeId);
</script>
