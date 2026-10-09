<template>
  <b2-tab></b2-tab>
</template>

<script lang="ts" setup>
import { equals } from '@common/utils/object';
import { useWidget, useActiveWidget } from "@renderer/b2/types";
import { Widget } from "@renderer/b2/controllers/widget";
import { onMounted, watch, ref, computed } from "vue";
import { debounce } from "lodash";
import { TheWidget as Tab, component as B2Tab } from "@renderer/widgets/group/tab";
import { PanelTab } from "./panelTab"

const panelTab = useWidget<PanelTab>();
const activeWidget = useActiveWidget();
const containerWidgetsMap = computed(() => {
  const map = {};
  const widgets = panelTab.container.reversedWidgets;
  widgets.forEach(container => {
    const widgetsUID = container.container.getChildWidgets(true).map((widget) => widget.uid);
    if (!containerWidgetsMap[container.uid]) {
      map[container.uid] = widgetsUID;
    }
  });
  return map
})

onMounted(async () => {
  let lastVal = null;
  let triggerByOption = false;
  let triggerByCatalog = false;

  if(panelTab.getOption("first-paint")) {
    let names = panelTab.panelButtonNameOptionList|| [];
    for(let key in names) {
      let newPanel = await panelTab.container.addWidget("widget.group.panel", 0, false);
      newPanel.name = names[key].value;
    }
    panelTab.setOption("first-paint", false, false);
  }

  let isSyncing = false;
  watch(() => panelTab.panelButtonNameOptionList, async (val, oldVal) => {
    if (equals(val, oldVal) || isSyncing) return;
    isSyncing = true;
    if(triggerByOption || triggerByCatalog) {
      triggerByOption = false;
      triggerByCatalog = false;
      return;
    }
    if(lastVal !== null && JSON.stringify(lastVal) !== JSON.stringify(val)) {
      if(lastVal.length === val.length) {
        const oldIds = lastVal.map(item => item.id);
        const newIds = val.map(item => item.id);
        if (equals(oldIds, newIds)) {
          // 修改
          for (const key in newIds) {
            if (lastVal[key].value !== val[key].value) {
              panelTab.container.reversedWidgets[key].name = val[key].value;
              break;
            }
          }
        } else {
          // 换位置
          const diffArr = val.filter((panelItem, index) => panelItem.id !== lastVal[index].id);
          if (diffArr.length > 0) {
            let diff
            for (const [index, diffItem] of lastVal.entries()) {
              if (diffItem.id === diffArr[0]?.id && lastVal[index + 1]?.id !== diffArr[1]?.id) {
                diff = diffItem
              } else if (diffItem.id === diffArr[diffArr.length-1]?.id && lastVal[index - 1]?.id !== diffArr[diffArr.length-2]?.id) {
                diff = diffItem
              }
            }
            const oldIndex = lastVal.findIndex(item => item.id === diff.id);
            const movePanel = panelTab.container.reversedWidgets[oldIndex];
            await panelTab.container.removeWidget(movePanel.uid);
            const currentIndex = val.slice().reverse().findIndex(item => item.id === diff.id);
            await panelTab.container.addWidget(movePanel.getSoul(), currentIndex, false);
          }
        }
      } else {
        const addedIds = val.filter(item => !lastVal.find(lastItem => lastItem.id === item.id)).map(item => item.id);
        const removedIds = lastVal.filter(lastItem => !val.find(item => item.id === lastItem.id)).map(item => item.id);
        if (addedIds.length > 0) {
          // 新增
          for (const addedId of addedIds) {
            const reverseVal = val.slice().reverse()
            const addIndex = reverseVal.findIndex(item => item.id === addedId);
            if (addIndex !== -1) {
              let newPanel = await panelTab.container.addWidget("widget.group.panel", addIndex, false);
              newPanel.name = reverseVal[addIndex].value;
            }
          }
        }

        if (removedIds.length > 0) {
          // 删除
          for (const removedId of removedIds) {
            const removeIndex = lastVal.findIndex(item => item.id === removedId);
            if (removeIndex !== -1) {
              let targetUid = panelTab.container.reversedWidgets[removeIndex].uid;
              await panelTab.container.removeWidget(targetUid);
            }
          }
        }
      }
    }
    lastVal = JSON.parse(JSON.stringify(val));
    isSyncing = false;
  }, {immediate: true, deep: true})


  watch(activeWidget, (widget) => {
    const activeUID = widget?.uid;
    if (!activeUID) return;

    const containers = Object.keys(containerWidgetsMap.value);
    let tabIndex = containers.findIndex(container => {
      return container === activeUID || containerWidgetsMap.value[container].includes(activeUID);
    });
    if(tabIndex !== -1 ){
      panelTab.setSelectedItem(tabIndex);
    }
  },{immediate: true})


})

</script>

<style lang="scss" scoped></style>
