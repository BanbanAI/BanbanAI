<template>
  <b2-widget>
    <div class="trend" :style="widget.trendStyle.trendStyle">
      <i :class="widget.getIconClass()" :style="widget.trendStyle.iconStyleStart"></i>
      <img :src="widget.getImageSrc()" :style="widget.trendStyle.imageStyleStart"/>
      <p class="trendData" :style="widget.trendStyle.valueStyle">
        {{ trendValue }}
      </p>
      <i :class="widget.getIconClass()" :style="widget.trendStyle.iconStyleEnd"></i>
      <img :src="widget.getImageSrc()" :style="widget.trendStyle.imageStyleEnd"/>
      <p class="unit" v-if="widget.getOption('unit-text') && widget.getOption('unit')" :style="widget.trendStyle.unitStyle">
        {{ widget.getOption("unit-text") }}
      </p>
    </div>
  </b2-widget>
</template>

<script lang="ts" setup>
import { useWidget } from "@renderer/b2/types";
import { ref, watch, onMounted } from "vue";
import { Trend } from "./trend";
const widget = useWidget<Trend>();
let trendValue = ref<any>(widget.trendValues);
let placeholder: any;

//数据格式判断
const dataFormat = (data, format) => {
  if (parseFloat(data) < 0) {
    placeholder = data.toString().split("-")[1]; //去掉负数符号
  } else {
    placeholder = data;
  }
  if (format == "normal") {
    trendValue.value =
      trendShow(
        widget.getOption("trend-show-positive"),
        widget.getOption("trend-show-negative")
      ) +
      decimalPlaces(
        parseFloat(placeholder),
        widget.getOption("decimal-places"),
        widget.getOption("complete-zero")
      );
  }
  if (format == "percent") {
    trendValue.value =
      trendShow(
        widget.getOption("trend-show-positive"),
        widget.getOption("trend-show-negative")
      ) +
      decimalPlaces(
        parseFloat(placeholder) * 100,
        widget.getOption("decimal-places"),
        widget.getOption("complete-zero")
      ) +
      "%";
  }
};
//小数位数判断与补零
const decimalPlaces = (data, places, zero) => {
  let placesValue = data;
  let arrs = placesValue.toString().split(".");
  let values;
  //根据补零的开启来判断
  if (zero) {
    if (arrs.length == 1) {
      if (places != 0) {
        values = placesValue.toString() + ".";
        for (let i = 0; i < places; i++) {
          values += "0";
        }
      } else {
        values = placesValue;
      }
    }
    if (arrs.length > 1) {
      if (arrs[1].length < places) {
        values = placesValue.toString();
        for (let i = arrs[1].length; i < places; i++) {
          values += "0";
        }
      } else if (arrs[1].length > places) {
        values = arrs[0] + "." + arrs[1].substring(0, places);
      } else if (arrs[1].length == places) {
        values = placesValue;
      } else {
        values = arrs[0];
      }
    }
    return (trendValue.value = values);
  } else {
    if (arrs.length == 1) {
      values = placesValue;
    }
    if (places != 0) {
      if (arrs.length > 1) {
        if (arrs[1].length <= places) {
          values = placesValue;
        } else {
          values = arrs[0] + "." + arrs[1].substring(0, places);
        }
      }
    } else {
      values = arrs[0];
    }
    return (trendValue.value = values);
  }
};
//显示正号和负号
const trendShow = (positive, negative) => {
  if (positive && widget.trendValues >= 0) {
    return "+";
  } else if (negative && widget.trendValues < 0) {
    return "-";
  } else {
    return "";
  }
};
onMounted(() => {
  dataFormat(widget.trendValues, widget.getOption("trend-data-format"));
});
watch(
  () => [
    widget.trendValues,
    widget.positive,
    widget.negative,
    widget.completeZero,
    widget.decimalplaces,
    widget.placeholders,
    widget.dataFormat
  ],
  (newData, oldData) => {
    trendValue.value = parseFloat(widget.trendValues);
    dataFormat(trendValue.value, widget.getOption("trend-data-format"));
  },
  { deep: true }
);
</script>

<style lang="scss" scoped>
.trend {
  width: 100%;
  display: flex;
  // align-items: center;
  height: 100%;
  line-height: 100%;
  text-align: center;
  overflow: hidden;
}
</style>