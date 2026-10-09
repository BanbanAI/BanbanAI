<template>
  <b2-form-element>
    <div v-if="!widget.isReadonly" :class="{'inSubForm': widget.isInSubForm, 'hasLocation': widget.inputValue}">
      <div class="location-info" v-show="widget.inputValue">
        <div class="location-header" :title="`${widget.inputValue} ${subInfo}`">
          <span>{{ widget.inputValue }}</span>
          <el-icon class="close-icon" @click="cancelLocation" v-if="widget.getOption('clear-button')"><CircleClose /></el-icon>
        </div>
        <div class="sub-info">{{ subInfo }}</div>
      </div>
      <el-button :class="{'mobile': isMobileDevice}" :loading="loading" @click="getLocation">
        <div class="icon-wrapper" v-show="!loading">
          <el-icon class="location-icon" :class="{'pointer-events-none': widget.isEditable}" v-if="!widget.getIconUrl('button-icon')"><i-ven-icon-widget-form-position-location /></el-icon>
          <i class="custom-location-icon" v-else></i>
        </div>
        <span class="button-text">{{ loading ? $t('positioning') : $t('getLocation') }}</span>
      </el-button>
    </div>
    <div
      class="value"
      :class="{'mobile': isMobileDevice}"
      :style="{color: widget.inputValue ? 'unset' : 'var(--text-color-inactive)'}"
      v-else
      :title="widget.inputValue || $t('noContent')"
    >
      {{ widget.inputValue ?? $t('noLocation') }}
    </div>
  </b2-form-element>
</template>

<script lang="ts" setup>
import { isMobile } from "@renderer/utils/pure";
import { useWidget } from "@renderer/b2/types";
import { onMounted, ref } from "vue";
import { ElMessage } from 'element-plus';
import { Position } from "./position";
import IVenIconLocation from '~icons/ven-icon/widget-form-position-location';
import { CircleClose } from "@element-plus/icons-vue";
import axios from "axios";
import i18next, { $t } from "@renderer/widgets/i18next";

const isMobileDevice = isMobile();

const widget = useWidget<Position>();
const subInfo = ref('');
const loading = ref(false)

onMounted(() => {
  if (widget.getOption("auto-position")) {
    getLocation();
  }
})

const getLocation = () => {
  if (!widget.getOption("map-key")) {
    ElMessage.error({
      message: i18next.t('missingMapKey'),
      duration: 5000
    });
    return;
  }
  if (!navigator.geolocation) {
    ElMessage.error(i18next.t("doNotSupportMessage"))
    return
  }
  loading.value = true;
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const latitude = parseFloat(position.coords.latitude.toFixed(6));
      const longitude = parseFloat(position.coords.longitude.toFixed(6));
      let location = `${longitude},${latitude}`;
      await apiData(location);
      if(widget.getOption("show-coordinates")){
        subInfo.value = i18next.t('coordinates', { latitude, longitude });
      }
      loading.value = false;
    },
    (error) => {
      let msgKey;
      if (error.code === 1) {
        msgKey = 'geolocationErrorMessage';
      } else {
        msgKey = 'securityErrorMessage';
      }
      ElMessage.error({
        message: i18next.t(msgKey),
        duration: 5000
      });
      console.log(error);
      loading.value = false;
    },
    {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0
    }
  )
}

const apiData = async (location) => {
  const mapKey = widget.getOption("map-key");

  try {
    const res = await axios.get("/client/amap/regeo", {
      baseURL: "",
      params: {
        location,
        mapKey,
      }
    });
    widget.inputValue = res.data.formattedAddress;
  } catch (error) {
    console.log(error);
    ElMessage.error({
      message: error?.response?.data?.message || i18next.t("securityErrorMessage"),
      duration: 5000
    });
  }
};

const cancelLocation = () => {
  widget.inputValue = ""
}

</script>

<style lang="scss" scoped>
.location-info {
  word-wrap: break-word;
  background-color: #f5f6f8;
  border-radius: 3px;
  margin-bottom: 10px;
  padding: 6px 8px;
  word-break: break-word;
  color: #141E31;
  .location-header {
    display: flex;
    justify-content: space-between;

    span {
      font-size: 14px;
      color: #141E31;
    }

    .close-icon {
      cursor: pointer;
    }
    .custom-close-icon {
      display: block;
      cursor: pointer;
    }
  }
  .sub-info {
    margin-top: 4px;
  }
}
.el-button {
  width: 100%;
  height: 32px;
  padding: 0px;
  font-size: 14px;
  color: #141E31;
  border-width: 1px;
  border-color: #D7D9DC;
  background-color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  border-style: dashed;

  .icon-wrapper {
    margin-right: 4px;
    padding-top: 2px;
    .icon {
      display: block !important
    }
  }
}

.inSubForm.hasLocation {
  display: flex;
  flex-direction: row-reverse;
  gap: 8px;

  .location-info {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    margin-bottom: 0;
    line-height: 30px;
    padding: 0 8px;
    height: 32px;
    border: 1px solid var(--border-color);
    background-color: var(--);

    .location-header {
      width: 100%;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      display: block;
    }
  }

  .el-button {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    flex-shrink: 0;

    > span {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .icon-wrapper {
      margin: 0;
    }

    .button-text {
      display: none
    }
  }
}

.value {
  display: flex;
  min-height: 32px;
  align-items: center;
  background: var(--el-bg-color-overlay);
  color: var(--el-text-color-primary);
  border: 1px solid var(--border-color);
  border-radius: 2px;
  padding: 0 8px;
  line-height: 20px;
}

.el-button.mobile{
  height: 40px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
}
.value.mobile {
  min-height: 40px;
  border-radius: 4px;
  padding: 0 12px !important;
  line-height: 20px;
}
</style>
