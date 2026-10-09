
<template>
  <ul class="shortcut-list">
    <li>
      <span>{{ $t("shortcutKeyList.shortcutList") }}</span>
      <span @click="emit('close')"><i class="fs fs-remove"></i></span>
    </li>
    <li v-for="shortcut in shortcutKeyList">
      <span>{{ shortcut.label }}</span>
      <span>{{ shortcut.shortcutKey }}</span>
    </li>
  </ul>
</template>

<script lang="tsx" setup>
import i18next from "i18next";

const emit = defineEmits(['close']);
const shortcutKeyList = [
  {
    get label() { return i18next.t("shortcutKeyList.shortcutNewKanban") },
    shortcutKey: "Ctrl + N"
  },
  {
    get label() { return i18next.t("shortcutKeyList.shortcutSaveProject") },
    shortcutKey: "Ctrl + S"
  },
  {
    get label() { return i18next.t("shortcutKeyList.shortcutPackProject") },
    shortcutKey: "Ctrl + E"
  },
  {
    get label() { return i18next.t("shortcutKeyList.shortcutProjectRename") },
    shortcutKey: "Ctrl + R"
  },
  {
    get label() { return i18next.t("shortcutKeyList.shortcutProjectSetting") },
    shortcutKey: "Ctrl + P"
  },
  {
    get label() { return i18next.t("shortcutKeyList.shortcutEditData") },
    shortcutKey: "Ctrl + D"
  },
  {
    get label() { return i18next.t("shortcutKeyList.shortcutRefreshData") },
    shortcutKey: "Ctrl + F5"
  },
  {
    get label() { return i18next.t("shortcutKeyList.shortcutRevoke") },
    shortcutKey: "Ctrl + Z"
  },
  {
    get label() { return i18next.t("shortcutKeyList.shortcutRestore") },
    shortcutKey: "Ctrl + Y"
  },
  {
    get label() { return i18next.t("shortcutKeyList.shortcutCopy") },
    shortcutKey: "Ctrl + C"
  },
  {
    get label() { return i18next.t("shortcutKeyList.shortcutPaste") },
    shortcutKey: "Ctrl + V"
  },
  {
    get label() { return i18next.t("shortcutKeyList.shortcutDelete") },
    shortcutKey: "Delete"
  },
  {
    get label() { return i18next.t("shortcutKeyList.shortcutSelectAll") },
    shortcutKey: "Ctrl + A"
  },
  {
    get label() { return i18next.t("shortcutKeyList.shortcutZoom") },
    get shortcutKey() { return "Ctrl + " + i18next.t("shortcutKeyList.shortcutWheel") }
  },
  {
    get label() { return i18next.t("shortcutKeyList.shortcutScroll") },
    get shortcutKey() { return "Shift + " + i18next.t("shortcutKeyList.shortcutWheel") }
  },
  {
    get label() { return i18next.t("shortcutKeyList.shortcutWidgetDisplay") },
    shortcutKey: "F1"
  },
  {
    get label() { return i18next.t("shortcutKeyList.shortcutNewGroup") },
    shortcutKey: "Ctrl + G"
  },
  {
    get label() { return i18next.t("shortcutKeyList.shortcutUngroup") },
    shortcutKey: "Ctrl + Shift + G"
  },
  {
    get label() { return i18next.t("shortcutKeyList.shortcutElementToggleEnabled") },
    shortcutKey: 'Ctrl + Shift + H',
  },
  {
    get label() { return i18next.t("shortcutKeyList.shortcutElementToggleLock") },
    shortcutKey: 'Ctrl + Shift + L',
  },
]
</script>

<style scoped lang="scss">
.shortcut-list{
  width: 230px;
  height: 480px;
  padding: 0 10px;
  overflow: scroll;
  background-color: var(--bg-color-overlay);
  border: 1px solid var(--border-color);
  border-radius: 5px;
  position: absolute;
  bottom: 30px;
  right: 300px;


  &::-webkit-scrollbar {
    display: none;
  }

  li {
    height: 30px;
    border-bottom: 1px solid var(--border-color);
    user-select: none;
    line-height: 30px;
    display: flex;
    justify-content: space-between;
    color: var(--text-color-regular);

    i{
      font-size: 14px;
      cursor: pointer;

      &:hover{
        color: var(--text-color-primary);;
      }
    }
  }

  li:last-child {
    border: none;
  }
}
</style>
