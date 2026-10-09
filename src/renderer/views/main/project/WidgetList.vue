<template>
  <div class="widgets-list-wrapper" @click.stop>
    <widget-template-list-dialog 
    :modelValue="modelValue" 
    @update:modelValue="emit('update:modelValue', $event)"
    :activeCategoryType="activeCategoryType"
    :activeLibrary="activeLibrary"
    :categoryList="categoryList"
    :widgetListVisible="props.widgetListVisible"
    @addWidget="addWidget"
    @hideList="emit('hideList')"
    @updateCategoryType="updateCategoryType"
    @updateLibrary="updateLibrary"
    @drag-start="emit('drag-start', $event)"
    ></widget-template-list-dialog>
  </div>
</template>
<script setup lang="ts">
import { computed, inject, ref, provide, watch } from 'vue';
import {
  WidgetTemplateLibraryList,
  WidgetTemplateLibraryType,
  WidgetTemplateList,
} from '@common/types/project';
import { WIDGET_TEMPLATE_LIBRARY_LIST, GET_WIDGET_TEMPLATE_LIST } from '@renderer/types';
import i18next from "i18next";
import axios from "axios";

const props = defineProps<{
  modelValue: boolean,
  widgetListVisible: {isVisble: boolean, type: string},
}>();

const emit = defineEmits(["addWidget", "hideList", "update:modelValue", "drag-start"]);
const addWidget = (type: string) => {
  emit("addWidget", type);
}

const activeLibrary = ref<WidgetTemplateLibraryType>("light");
const activeCategoryType = ref('');
const currentWidgetTemplateList = computed<WidgetTemplateList>(() => {
  return widgetTemplateLibraryList.value.find(item => item.type === activeLibrary.value)?.children || [];
})

const categoryList = computed<WidgetTemplateList>(() => {
  const allWidegtes = {
    label: i18next.t("widgetList.categoryTagAll"),
    type: 'all',
    img: 'group-all.svg',
    children: [{
      label: i18next.t("widgetList.categoryTagAll"),
      type: 'all',
      children: currentWidgetTemplateList.value.map(item => item.children.map(item => item.children)).flat(10)
    }] 
  }
  return [allWidegtes, ...currentWidgetTemplateList.value] ;
})

const updateCategoryType = (type: string) => {
  activeCategoryType.value = type; 
}

const updateLibrary = (type: WidgetTemplateLibraryType) => {
  activeLibrary.value = type;
}
watch(() => props.widgetListVisible?.isVisble, (visible) => {
  if (visible) {
    activeCategoryType.value = 'all';
  }
}, {
  immediate: true,
});

const widgetTemplateLibraryList = ref<WidgetTemplateLibraryList>([]);
const normalizeTemplateList = (data: unknown): WidgetTemplateList => {
  const templateList = (Array.isArray(data) ? data : []) as WidgetTemplateList;
  return templateList.map(item => {
    return {
      ...item,
      children: item.children.map(categories => {
        return {
          ...categories,
          children: categories.children.map(template => {
            return {
              ...template,
              typeLabel: item.series ? item.series : i18next.t("projectEditorTheLeft.widgetTypeLabel"),
              categoryLabel: categories.label,
              series: item.series,
            }
          })
        }
      })
    }
  })
}

const getWidgetTemplateListByAxios = async (url: string,  options = {}) => {
  const result = await axios.get(url, options);
  return result.data;
}
const getWidgetTemplates = async () => {
  const formTemplateResponse = await getWidgetTemplateListByAxios("/widget/all-form-templates");
  const formTemplateList = normalizeTemplateList(formTemplateResponse);
  widgetTemplateLibraryList.value = [
    // {
    //   type: "dark",
    //   label: i18next.t("projectEditorTheLeft.darkMode"),
    //   children: widgetTemplateList.value
    // },
    {
      type: "light",
      label: i18next.t("projectEditorTheLeft.lightMode"),
      children: formTemplateList
    }
  ]
}
getWidgetTemplates();
provide(WIDGET_TEMPLATE_LIBRARY_LIST, widgetTemplateLibraryList);
provide(GET_WIDGET_TEMPLATE_LIST, getWidgetTemplates);
</script>

<style lang="scss" scoped>
// .widgets-list-wrapper {
//   --el-text-color-primary: #d5d5d6;
//   user-select: none;
//   height: 100%;
// }
</style>
