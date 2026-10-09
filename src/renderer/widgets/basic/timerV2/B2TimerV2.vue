<template>
 <b2-widget>
    <div class="text-value">
        <p :style="widget.textStyle">{{timeString}}</p>
    </div>
 </b2-widget>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount ,onMounted } from 'vue'
import { useWidget } from "@renderer/b2/types";
import {ref} from 'vue'
import { TimerV2 } from './timerV2';
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const widget = useWidget<TimerV2>();
// 当前显示时间
const timeString = ref('暂无时间');
// 定义时间格式
const formatter = ref('YYYY-MM-DD HH:mm:ss');
// 定义时区
const timeZone = ref('Etc/GMT-8');
// 定义计时器
let printer = null;
// 获取初始时间
timeString.value = dayjs().tz(timeZone.value).format(formatter.value);

let getWeekday = ()=>{
  let days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  let weekday = widget.showWeekday ? " " + days[dayjs().day()] : "";
  return weekday;
}
// 更新当前时间
const updateTime = function(){
  formatter.value = widget.fomatter === "customise" ? widget.customise : widget.fomatter;
  timeZone.value = widget.timeZoneValue;
  let weekday = getWeekday();
  timeString.value = dayjs().tz(timeZone.value).format(formatter.value) + weekday;
}

// 挂载完成后
onMounted(()=>{
  updateTime();
  printer = setInterval(()=>{
    updateTime();
  },1000);
})

// 组件销毁前清除定时器
onBeforeUnmount(()=>{
  clearInterval(printer);
})
</script>

<style lang="scss" scoped>
.text-value {
  width: 100%;
  height: 100%;
  position: relative;
  &.vertical {
    writing-mode: tb-rl;
    text-orientation: upright;
  }
  p {
    position: absolute;
    white-space: nowrap;
  }
}
</style>
