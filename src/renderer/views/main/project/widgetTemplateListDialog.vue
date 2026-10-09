<template>
  <div class="widget-template-list-dialog" v-show="modelValue">
    <div class="template-header" @mousedown.stop="handleHeaderDragStart">
      <div class="main-title">
        <div class="template-header__title">{{ $t("widgetList.boardWidgetTitle") }}</div>
        <div class="template-header__actions">
          <el-radio-group v-model="activeLibrary" v-show="false">
            <el-radio-button :value="library.type" v-for="library in widgetTemplateLibraryList">{{ library.label }}</el-radio-button>
          </el-radio-group>
          <el-icon
            :size="16"
            :class="{ 'is-loading': isLoading }"
            @click.stop="handelTemplateRefresh"
          >
            <i-ep-refresh />
          </el-icon>
          <button
            type="button"
            class="template-header__close"
            @click.stop="handleClose"
          >
            <el-icon :size="16">
              <i-ep-close />
            </el-icon>
          </button>
        </div>
      </div>
    </div>
    <div class="template-container" v-show="!!activeCategoryType || widgetListVisible?.isVisble" @click.stop>
        <el-container>
          <el-main>
            <vn-stack v-model="activeCategoryType" :active-name="null">
              <div class="category-tabs" :class="{ 'is-searching': !!searchValue, empty: activeCategoryType === 'all' && !currentVisibleTemplates.length }" v-show="!onlyAdded">
                <div class="category-search">
                  <el-input
                    v-model="searchValue"
                    clearable
                    ref="inputSearchRef"
                    class="search-input"
                    :placeholder="$t('widgetList.widgetSearchPlaceholder')"
                    :prefix-icon="Search"
                  />
                </div>
                <div class="category-tabs-list">
                  <template v-for="group in categoryList">
                    <vn-stack-tab class="category-tab" v-if="group.type !== 'expanded' || isUserStaff" :name="group.type"  @click="switchCategory(group.type)">
                      <img :style="{filter:activeCategoryType === group.type ? 'brightness(0) saturate(100%) invert(35%) sepia(98%) saturate(3567%) hue-rotate(208deg) brightness(102%) contrast(101%)' : 'brightness(0.6) contrast(1.5) grayscale(1) saturate(0) hue-rotate(180deg)',width: '18px',height: '18px' }" :src="handleImageUrl(group.img)">
                      <span :class="[group.type]" style="margin-left: 5px;">{{ group.label }}<span class="search-value">{{ getSearchTemplate(group) }}</span></span>
                    </vn-stack-tab>
                  </template>
                </div>
              </div>
              <div class="category-layers" :style="{ display: (isKITStyle && !onlyAdded) ? 'flex': 'unset' }">
                <div class="widgets-tabs" v-if="isKITStyle && !onlyAdded">
                  <ul class="widgets-tabs-list">
                      <li class="widgets-tabs-item" :class="{'actived': activeType === typeItem.type}" v-for="typeItem in activeCategory.children" :key="typeItem.type" @click="activeType = typeItem.type">
                        <div class="images-box">
                        <img class="images" :src="getCoverImageURL(typeItem.image)" @error="defaultBackImg" />
                        </div>
                        <div class="label">
                          {{ typeItem.label }}
                        </div>
                        <div class="mask"></div>
                    </li>
                  </ul>
                </div>
                <div class="category-layer-container">
                  <vn-stack-layer class="category-layer" :name="group.type" :key="group.type" v-for="group in categoryList" :lazy="true">
                    <div class="type-container" v-if="(group.type !== 'expanded' || isUserStaff) && group.type !== 'all' && !onlyAdded && !isKITStyle">
                        <div class="type-label" :class="activeType === 'all' ? 'active' : ''" @click="activeType = 'all'">{{ $t("widgetList.all") }}</div>
                        <div class="type-label" :class="activeType === typeItem.type ? 'active' : ''"
                          v-for="typeItem in group.children" @click="activeType = typeItem.type">
                          {{ typeItem.label }}
                        </div>
                    </div>
                    <div class="widgets-category-container" v-if="currentCategoryTags.length && group.type !== 'all' && !onlyAdded" :style="{ 'padding-left': isKITStyle ? 0 : undefined }">
                      <ul class="widget-category-tags" :style="{ 'margin-top': isKITStyle ? 0 : undefined }">
                        <li :class="['category-tag', { active: activeCategoryTag === categoryTag }]" v-for="categoryTag in currentCategoryTags" :key="categoryTag" @click.stop="activeCategoryTag=categoryTag">{{ categoryTag }}</li>
                      </ul>
                    </div>
                  </vn-stack-layer>
                  <div :class="['added-container', { empty: !searchValue || !elementsResult(activeAddedBoard).length }]" v-if="onlyAdded">
                    <div class="type-label" v-for="board in boardsList" :key="board.uid" :class="activeAddedBoard === board.uid ? 'active' : ''"
                    @click="activeAddedBoard = board.uid">
                      {{ board.label }}
                      <span v-if="searchValue">{{ `(${elementsResult(board.uid).length})`  }}</span>
                    </div>
                  </div>
                  <div class="widgets-menu" v-else-if="!onlyAdded">
                    <div class="widgets-category">
                      <template v-if="activeCategoryType=='all'">
                        <widget-lazy-list
                          class="widgets-name-list"
                          :data="currentVisibleTemplates"
                          :container-width="532"
                          :container-height="590"
                          :item-width="160"
                          :item-height="112"
                          :column-gap="13"
                          :row-gap="16"
                        >
                          <template #default="{ item }">
                            <div class="mold" :class="{'use-2n': isKITStyle }" :title="item.alias" @click.stop="clickMold(item)" draggable="true" @dragstart.stop="handleWidgetDragStart($event, item)" @dragend="handleWidgetDragEnd($event, item)">
                              <div class="image">
                                <el-image :src="getTemplateImageURL(item)" lazy  @error="defaultBackImg" :class="{'not-support':item.notSupport}">
                                  <template #placeholder>
                                    <div class="image-slot">
                                      <img :src="localFileLightUrl" alt="">
                                    </div>
                                  </template>
                                </el-image>
                                <div class="mask" v-if="item.notSupport">
                                  <p>{{ $t("widgetList.lowVersion") }}</p>
                                  <p>{{ $t("widgetList.notSupport") }}</p>
                                </div>
                              </div>
                              <span>{{ item.alias }}</span>
                            </div>
                          </template>
                        </widget-lazy-list>
                      </template>
                      <ul v-else class="widgets-name-list" :style="{
                        padding: isKITStyle ? undefined : '0 10px 0 13px'
                      }">
                        <li class="mold" :class="{'use-2n': isKITStyle }" v-for="template in currentVisibleTemplates" :title="template.alias" @click.stop="clickMold(template)" draggable="true" @dragstart.stop="handleWidgetDragStart($event, template)" @dragend="handleWidgetDragEnd($event, template)" >
                          <div class="image">
                            <el-image :src="getTemplateImageURL(template)" lazy  @error="defaultBackImg" :class="{'not-support':template.notSupport}">
                              <template #placeholder>
                                <div class="image-slot">
                                  <img :src="localFileLightUrl" alt="">
                                </div>
                              </template>
                            </el-image>
                            <div class="mask" v-if="template.notSupport">
                              <p>{{ $t("widgetList.lowVersion") }}</p>
                              <p>{{ $t("widgetList.notSupport") }}</p>
                            </div>
                          </div>
                          <span>{{ template.alias }}</span>
                        </li>
                      </ul>
                    </div>
                    <div class="widgets-category empty" v-if="!currentVisibleTemplates.length" >
                      <el-icon :size="20" color="#7A7A7A"><i-ven-search-empty /></el-icon>
                      <div class='empty-title'>{{ $t("widgetList.notFind") }}</div>
                    </div>
                  </div>
                  <div class="widgets-menu" v-else>
                    <div class="search-btn" v-if="!searchValue">
                      <el-icon :size="20" color="#7A7A7A"><i-ven-added-search /></el-icon>
                        <div class='search-title'>
                          {{ $t("widgetList.btnSearchFirst") }}
                        </div>
                    </div>
                    <div style="height:100%" v-else>
                      <div class="widgets-category">
                        <ul class="added-list" >
                          <li class="mold" v-for="element in elementsResult(activeAddedBoard)"  @click="clickElement(element)" >
                            <div class="result-image">
                              <img :src="addElementCover(element)" @error="defaultBackImg">
                            </div>
                            <span class="result-alias">
                              <span class="result-alias-text" :title="element.name">{{ element.name }}</span>
                              <span class="result-origin">
                                <span class="type-point added"></span>
                                {{ $t('widgetList.added') }}
                              </span>
                            </span>
                          </li>
                        </ul>
                      </div>
                      <div class="widgets-category empty" v-if="!elementsResult(activeAddedBoard).length">
                        <el-icon :size="20" color="#7A7A7A"><i-ven-search-empty /></el-icon>
                        <div class='empty-title'>{{ $t("widgetList.notFind") }}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </vn-stack>
          </el-main>
        </el-container>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, inject, nextTick } from 'vue';
import axios from "axios";
import { Options, OptionTableUID } from "@common/types/project";
import { OptionFileValue, isWidget } from "@renderer/b2/types";
import { PROJECT_ID } from "@renderer/types/inject";
import { Soul, WidgetSoul } from "@common/types/project";
import { Element } from "@renderer/b2/controllers/element";
import { Widget } from "@renderer/b2/controllers/widget";
import { Board } from "@renderer/b2/controllers/board";
import { usePassportStore, useProjectDialogStore, useDialogStore } from '@renderer/stores';
import { ElMessage } from 'element-plus';
import { ACTIVE_ELEMENT, ALL_BOARD, ACTIVE_BOARD_ID, SELECTED_WIDGETS, WIDGET_TEMPLATE_LIBRARY_LIST, PROJECT_TABLE_DRAGGING, ACTIVE_BOARD, NOCODE_ID, ACTIVE_WIDGET, ACTIVE_CONTAINER,GET_WIDGET_TEMPLATE_LIST } from '@renderer/types';
import { deepClone, isEmpty } from '@common/utils/object';
import {
  WidgetTemplate,
  WidgetTemplateCategory,
  WidgetTemplateList,
  WidgetTemplateSoul,
  WidgetTemplateType,
} from '@common/types/project';
import { Search } from '@element-plus/icons-vue';
import PinyinMatch from 'pinyin-match';
import i18next from "i18next";
import localFileUrl from "@renderer/assets/image/local-file.png";
import localFileLightUrl from "@renderer/assets/image/local-file-light.png";
import groupIcon3D from "@renderer/assets/image/svg_widget/group-3D.svg";
import groupIconAll from "@renderer/assets/image/svg_widget/group-all.svg";
import groupIconExpanded from "@renderer/assets/image/svg_widget/group-expanded.svg";
import groupIconFree from "@renderer/assets/image/svg_widget/group-free.svg";
import groupIconGeography from "@renderer/assets/image/svg_widget/group-geography.svg";
import groupIconKit from "@renderer/assets/image/svg_widget/group-kit.svg";
import groupIconMedia from "@renderer/assets/image/svg_widget/group-media.svg";
import groupIconOther from "@renderer/assets/image/svg_widget/group-other.svg";
import groupIconPremium from "@renderer/assets/image/svg_widget/group-premium.svg";
import groupIconShape from "@renderer/assets/image/svg_widget/group-shape.svg";
import { handlePastedWidgetsSoul } from '@renderer/utils';
import { BaseWidget } from '@renderer/b2/controllers/widget';
import { getBuiltinWidgetManifest } from '@renderer/widgets/registry';

const groupIcons = {
  "group-3D.svg": groupIcon3D,
  "group-all.svg": groupIconAll,
  "group-expanded.svg": groupIconExpanded,
  "group-free.svg": groupIconFree,
  "group-geography.svg": groupIconGeography,
  "group-kit.svg": groupIconKit,
  "group-media.svg": groupIconMedia,
  "group-other.svg": groupIconOther,
  "group-premium.svg": groupIconPremium,
  "group-shape.svg": groupIconShape,
};

const props = defineProps<{
  modelValue: boolean,
  widgetListVisible: {isVisble: boolean, type: string},
  activeLibrary: string,
  activeCategoryType: string,
  categoryList: WidgetTemplateList,
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean),
  (event: "addWidget", value: string),
  (event: "hideList"),
  (event: "showList"),
  (event: "updateCategoryType", value: string),
  (event: "updateLibrary", value: string),
  (event: "drag-start", value: MouseEvent),
}>();
const passportState = usePassportStore();
const isUserStaff = computed(() => !!passportState?.user?.staff);

const activeElement = inject(ACTIVE_ELEMENT);

const projectId = computed(() => {
  return activeElement.value?.getBoard()?.projectId;
})
const nocodeId = computed(() => {
  return activeElement.value?.getBoard()?.nocodeId;
})

const projectDialogState = useProjectDialogStore();
const dialogStorage = projectDialogState.getStorage(projectId.value);

const activeCategoryTag = ref('');
const activeType = ref('');
const activeAddedBoard = ref('all');
const searchValue = ref('');
const inputSearchRef = ref();
const widgetsRef =  ref();
const onlyAdded = ref(false);

const activeTypes = ref<WidgetTemplateType[]>([]);
const currentTypeTemplates = ref<WidgetTemplate[]>([]);
const currentTemplates = ref<WidgetTemplate[]>([]);
const currentVisibleTemplates = ref<WidgetTemplate[]>([]);
const currentCategoryTags = ref<string[]>([]);
const isLoading = ref(false)
const handelTemplateRefresh = async () => {
  isLoading.value = true;
  await getWidgetTemplates();
  isLoading.value = false;
};
const getWidgetTemplates = inject(GET_WIDGET_TEMPLATE_LIST);
const widgetTemplateLibraryList = inject(WIDGET_TEMPLATE_LIBRARY_LIST);
const allBoard = inject(ALL_BOARD);
const activeBoard = inject(ACTIVE_BOARD);
const activeBoardId = inject(ACTIVE_BOARD_ID);
const activeWidget = inject(ACTIVE_WIDGET);
const activeContainer = inject(ACTIVE_CONTAINER);
const selectedWidgets = inject(SELECTED_WIDGETS);



const isObject = (value: any) => {
  return value != null && typeof value === 'object'
}
// 处理elementOption
const handleElementOption = (options: Options) => {
  for (const key in options) {
    if (!isObject(options[key])) continue;
    if (options[key]["__opt_type"] === "element") {
      let uidArr = options[key]['elementPath'];
      if (uidArr && uidArr.length !== 0) {
        uidArr[0] = activeBoard.value.uid;
      }
    } else {
      handleElementOption(options[key] as any);
    }
  }
}

// 获取最深的容器
function pickDeepestContainerWidget(
  widgets: (Widget | Board)[]
): Widget | Board {
  return widgets.sort((a, b) => {
    return getWidgetDepth(b) - getWidgetDepth(a);
  })[0];
}

function getWidgetDepth(widget: Widget | Board): number {
  let depth = 0;
  let current = widget.parent;
  while (current && current.type !== 'board') {
    depth++;
    current = current.parent;
  }
  return depth;
}

const addWidget = async function (soul: WidgetSoul | string) {
  let index: number;
  let dropContainer: Widget | Board;
  if (lastDragPosition) {
    // const widgets = hitTestContainerWidgetsLogic(lastDragPosition.x, lastDragPosition.y)
    const elements = document.elementsFromPoint(lastDragPosition.x, lastDragPosition.y);
    // const hits = getContainerWidgetsDropAble().filter(widget => elements.includes(widget.container.dom));
    const hits = getContainerWidgetsDropAble().filter(widget => {
      if (widget.getSoul().type === "widget.group.panel") {
        const dom = widget.container?.dom;
        if (!dom) return false;

        // children为空时高度为2px, 找到最近的 .tab-panel 父节点（包含自身）
        const tabPanel = dom.closest('.tab-panel');
        if (!tabPanel) return false;

        // 判断该 tab-panel 是否被鼠标命中
        return elements.includes(tabPanel);
      } else {
        return elements.includes(widget.container.dom);
      }
    });
    dropContainer = pickDeepestContainerWidget(hits);
  } else {
    dropContainer = activeContainer.value as Widget;
  }
  if (activeWidget.value) {
    if (activeWidget.value.container) {
      index = dropContainer.container.souls.length;
    } else {
      const currIndex = dropContainer.container.souls.findIndex(item => item.uid === dropContainer.uid);
      index = currIndex > -1 ? currIndex + 1 : dropContainer.container.souls.length;
    }
  } else {
    index = dropContainer.container.souls.length;
  }
  let widget: BaseWidget;
  try{
    if (typeof soul !== 'string') {
      const clonedSoul = deepClone(soul);
      const handledSoul = (await handlePastedWidgetsSoul([ clonedSoul ], projectId.value, activeBoard.value.uid)).pastedWidgetSouls[0].widgetSoul;
      handleElementOption(handledSoul);
      handledSoul.isNew = true;
      widget = await dropContainer.container?.addWidget(handledSoul, index, true);
    } else {
      widget = await dropContainer.container?.addWidget(soul, index);
    }
    if(widget){
      const stop = watch(() => widget.dom, () => {
        if (widget.dom) {
          widget.dom.scrollIntoView();
          nextTick(()=>{
            stop()
          })
        }
      }, { deep: true, immediate: true })
      selectedWidgets.value = [widget];
      dialogStorage.show('loadingDialogVisible', { type: 'success', message: i18next.t('projectEditorTheLeft.loadSuccessMessage') })
    }else{
      dialogStorage.show('loadingDialogVisible', { type: 'fail', message: i18next.t('projectEditorTheLeft.loadFailMessage') })
    }
  }catch(err){
    dialogStorage.show('loadingDialogVisible', { type: 'fail', message: err.message })
  }

  return widget;
};

const getAllWidgets = (widgets: BaseWidget[]) => {
  const result: BaseWidget[] = [];
  for (const widget of widgets) {
    result.push(widget, ...getAllWidgets(widget.widgets));
  }
  return result;
}

const activeLibrary = ref(props.activeLibrary);
const activeCategoryType = ref("");
watch(()=>props.activeCategoryType, (value)=>{
  activeCategoryType.value = value;
}, { immediate: true });

const switchCategory = (type: string, flag?: boolean) => {
  if (activeCategoryType.value === type && flag) {
    activeCategoryType.value = '';
    return;
  }
  onlyAdded.value = false;
  activeCategoryType.value = type;
}

const focusSearchInput = () => {
  inputSearchRef.value?.focus?.();
}

const resetVisibleCatalogState = () => {
  const { type } = props.widgetListVisible ?? {};
  emit("showList");
  searchValue.value = '';
  switchCategory('all');
  activeType.value = 'all';
  activeCategoryTag.value = i18next.t("widgetList.categoryTagAll");
  onlyAdded.value = type === 'btn-click';
  activeAddedBoard.value = 'all';
}

watch(() => props.widgetListVisible?.isVisble, (visible) => {
  if (visible) {
    resetVisibleCatalogState();
    nextTick(() => {
      focusSearchInput();
    });
  }
}, {
  immediate: true,
});

const handleHeaderDragStart = (event: MouseEvent) => {
  if (event.button !== 0) {
    return;
  }
  const target = event.target as HTMLElement | null;
  if (
    target?.closest('.search-input')
    || target?.closest('.template-header__close')
    || target?.closest('.el-icon')
  ) {
    return;
  }
  emit('drag-start', event);
}

const handleClose = () => {
  hideActiveTab();
}

const boardsList = computed(() => {
  const boardsList = [];
  if(allBoard.foreBoard){
    boardsList.push({
      label: allBoard.foreBoard.name,
      uid: allBoard.foreBoard.uid,
      widgets: getAllWidgets(allBoard.foreBoard.reversedWidgets)
    })
  }
  for (const board of Object.values(allBoard.boards)) {
    boardsList.push({
      label: board.name,
      uid: board.uid,
      widgets: getAllWidgets(board.reversedWidgets)
    })
  }
  if(allBoard.backBoard){
    boardsList.push({
      label: allBoard.backBoard.name,
      uid: allBoard.backBoard.uid,
      widgets: getAllWidgets(allBoard.backBoard.reversedWidgets)
    })
  }
  boardsList.unshift({
    label: i18next.t("widgetList.categoryTagAll"),
    uid: 'all',
    widgets: boardsList.map(item => item.widgets).flat(10)
  })
  return boardsList;
})

const categoryList = computed<WidgetTemplateList>(() => {
  return props.categoryList;
})
watch(()=>categoryList.value, (value)=>{
  activeTypes.value = value?.find?.((category: WidgetTemplateCategory) => category.type === activeCategoryType.value)?.children || [];
  currentTypeTemplates.value = getCurrentTypeTemplates();
  updateVisibleTemplates();
  currentVisibleTemplates.value = getVisibleTemplates();
})

const isKITStyle = computed(() => {
  return !!activeCategory.value?.series;
})
const activeCategory = computed(() => {
  return categoryList.value.find(item => item.type === activeCategoryType.value);
});

const getCurrentTypeTemplates = () => {
  if (activeType.value === 'all') {
    let allTemplates: WidgetTemplate[] = [];
    activeTypes.value.forEach(type => {
      type.children.forEach(template => allTemplates.push(template));
    });
    return allTemplates;
  }
  return activeTypes.value.find(templateType => templateType.type === activeType.value)?.children || [];
}

const getVisibleTemplates = () => {
  let resultList: WidgetTemplate[] = currentTemplates.value;
  if (searchValue.value) {
    return resultList.filter(template => {
      const searchWords = [template.alias].concat(template.tags ?? []);
      for (const searchWord of searchWords) {
        if (PinyinMatch.match(searchWord, searchValue.value)) return true;
      }
      return false;
    });
  }
  return resultList;
}

const updateVisibleTemplates = () => {
  const categoryTags = new Set<string>();

  const otherTags = new Set<string>();
  for (const template of currentTypeTemplates.value) {
    const tags = template.categoryTags || [];
    if (isEmpty(tags)) continue;
    categoryTags.add(tags[0]);
    for (const tag of tags.slice(1)) {
      otherTags.add(tag);
    }
  }
  if (activeCategoryType.value === 'all') {
    activeCategoryTag.value = i18next.t("widgetList.categoryTagAll");
    currentCategoryTags.value = [];
  }else {
    if (categoryTags.size > 1) {
      const restTags = Array.from(otherTags).filter(tag => !categoryTags.has(tag));
      currentCategoryTags.value = [i18next.t("widgetList.categoryTagAll"), ...categoryTags, ...restTags];
      if(!currentCategoryTags.value.includes(activeCategoryTag.value)){
        activeCategoryTag.value = i18next.t("widgetList.categoryTagAll");
      }
    } else {
      activeCategoryTag.value = i18next.t("widgetList.categoryTagAll");
      currentCategoryTags.value = [];
    }
  }
  if (activeCategoryTag.value === i18next.t("widgetList.categoryTagAll")) {
    currentTemplates.value = currentTypeTemplates.value;
  } else {
    currentTemplates.value = currentTypeTemplates.value.filter(template => template.categoryTags.includes(activeCategoryTag.value));
  }

  currentVisibleTemplates.value = getVisibleTemplates();
}
watch(() => activeCategoryType.value, (value) => {
  activeTypes.value = categoryList.value.find((category: WidgetTemplateCategory) => category.type === activeCategoryType.value)?.children || [];
  if (activeTypes.value.length === 1) {
    activeType.value = activeTypes.value?.[0]?.type || '';
  } else {
    activeType.value = 'all';
  }
  if (isKITStyle.value) {
    nextTick(() => {
      activeType.value = activeCategory.value.children[0].type;
    })
  }
  currentTypeTemplates.value = getCurrentTypeTemplates();
  updateVisibleTemplates()
  emit("updateCategoryType", value);
});

watch(()=> activeLibrary.value, (value) => {
  emit("updateLibrary", value);
})

watch(() => activeType.value, (value) => {
  currentTypeTemplates.value = getCurrentTypeTemplates();
  updateVisibleTemplates()
})

watch(() => activeCategoryTag.value, (value) => {
  if (activeCategoryTag.value === i18next.t("widgetList.categoryTagAll")) {
    currentTemplates.value = currentTypeTemplates.value;
  } else {
    currentTemplates.value = currentTypeTemplates.value.filter(template => template.categoryTags.includes(activeCategoryTag.value));
  }
  currentVisibleTemplates.value = getVisibleTemplates();
})

watch(() => searchValue.value ,(value) => {
  currentVisibleTemplates.value = getVisibleTemplates();
})


const elementsResult = (type:string) => {
    let resultList:Element[]  = boardsList.value.filter(item => item.uid === type)[0].widgets;
    if (searchValue.value) {
      return resultList.filter(element => PinyinMatch.match(element.name, searchValue.value) || element.type === searchValue.value || element.uid === searchValue.value);
    }
    return resultList
}

const getSearchTemplate = (templateList:WidgetTemplateCategory) => {
  let allWidegts = getBottomChildren(templateList);
  if (searchValue.value) {
    allWidegts = allWidegts.filter(template => {
      const searchWords = [template.alias].concat(template.tags ?? []);
      for (const searchWord of searchWords) {
        if (PinyinMatch.match(searchWord, searchValue.value)) return true;
      }
      return false;
    })
  }
  return allWidegts?.length;
}
const getBottomChildren = (obj) => {
  if (!obj.children) {
    return [obj];
  } else {
    let bottomChildren = [];
    obj.children.forEach(child => {
      bottomChildren = bottomChildren.concat(getBottomChildren(child));
    });
    return bottomChildren;
  }
}

const handleImageUrl = (templateImage: string) => {
  return groupIcons[templateImage];
}
const addElementCover = (element: Element) => {
    if ((element.getOption("cover-path") as OptionFileValue)?.relativePath) {
      return `${projectId.value}/${(element.getOption("cover-path") as OptionFileValue)?.relativePath}`;
    } else {
      return localFileUrl;
    }
  };

const hideActiveTab = () => {
  if(dialogStorage.hasVisible()) return;
  activeCategoryType.value = '';
  activeType.value = '';
  searchValue.value = '';
  onlyAdded.value = false;
  activeAddedBoard.value = 'all';
  emit('hideList');
  emit('update:modelValue', false);
}

const getTemplateSoul = async (template: WidgetTemplate) => {
  const res = await axios.get(`widget/template-soul?soulUrl=${template.url}`).catch(() => {});
  if (res) return res.data;
}

let isAddByDrag = false;
const dragEndPosition = {x: 0, y: 0};
const dialogState = useDialogStore();
const localWidgetsNeedTableSelection = new Set([
  "widget.form.table",
  "widget.form.viewtable",
]);

const clickMold = async (template: WidgetTemplate) => {
  if(template.notSupport){
    dialogStorage.hide('loadingDialogVisible');
    return ElMessage.warning(i18next.t('widgetList.loadWarningMessage'));
  } 
  dialogStorage.show('loadingDialogVisible', { type: 'loading', message: i18next.t('projectEditorTheLeft.loadingMessage') })

  const isFormWidget = template.type?.startsWith('widget.form.');
  if (isFormWidget) {
    template.soul = {
      type: template.type,
      name: template.alias,
    } as WidgetTemplateSoul;
  } else {
    if (!template.soul && template.url) {
      template.soul = await getTemplateSoul(template);
    } 
    if (!template.hasCopy) {
      const res = await axios.post('widget/handle-template-resource', { nocodeId: nocodeId.value, template }).catch(() => {});
      if (res) {
        const { hasChanged, templateSoul, snapshotPath} = res.data;
        if (hasChanged) {
          template.soul = templateSoul;
        }
        template.snapshotPath = snapshotPath;
      }
      template.hasCopy = true;
    }
  }
  const templateSoul: WidgetTemplateSoul = template.soul;
  const widgetSoul = deepClone(templateSoul) as Soul;
  widgetSoul.name = template.alias;
  if(isAddByDrag){
    const size = (widgetSoul.options ?? {}).size || [200, 200];
    widgetSoul.options = Object.assign(widgetSoul.options, {"position": [dragEndPosition.x - size[0]/2, dragEndPosition.y - size[1]/2]});
    isAddByDrag = false;
  } else {
    hideActiveTab();
  }
  const widget = await addWidget(widgetSoul);
  if(widget) {
    widget.setOption(['cover-path'],{
      relativePath: template.snapshotPath,
      __opt_type: 'file'
    })
    if (isFormWidget && localWidgetsNeedTableSelection.has(template.type)) {
      dialogState.show('selectFormTableDialogVisible', (tableUID: OptionTableUID) => {
        widget.setTableOptionValue(tableUID);
      })
    }
  }
}
const projectTableDragging = inject(PROJECT_TABLE_DRAGGING);
const activeboard = inject(ACTIVE_BOARD);
const boardScale = computed(() => {
  return activeboard.value.scaling.x;
})
const handleWidgetDragStart = (event, template: WidgetTemplate) => {
  projectTableDragging.value = true;
}

let lastDragPosition: { x: number, y: number } | null= null;

const handleWidgetDragEnd = (event, template: WidgetTemplate) => {
  const elements = document.elementsFromPoint(event.clientX, event.clientY);
  const dropTarget = elements.find(el => el.classList.contains("b2container"));
  if(!dropTarget) return;
  projectTableDragging.value = false;
  const rect = dropTarget.getBoundingClientRect();
  dragEndPosition.x = (event.clientX - rect.left) / boardScale.value;
  dragEndPosition.y = (event.clientY - rect.top) / boardScale.value;
  isAddByDrag = true;

  lastDragPosition = {x: event.clientX, y: event.clientY};
  clickMold(template).finally(() => {
    lastDragPosition = null;
  });
}

function getContainerWidgetsDropAble(): (Widget | Board)[] {
  const widgets = activeBoard.value.container.getChildWidgets(true, (widget) => {
    if (widget.getSoul()?.type === "widget.group.panel") return true;
    else return undefined;
  }) as (Widget | Board)[];
  widgets.push(activeBoard.value)
  return widgets;
}

const clickElement = (element: Element) => {
    if (isWidget(element)) {
      if(element.getBoard().uid !== activeBoardId.value){
        activeBoardId.value = element.getBoard().uid;
      }
      nextTick(()=>{
        selectedWidgets.value = [ element ];
        hideActiveTab();
      })
    } 
  }

const getCoverImageURL = (url: string) => {
  return `widget/template-image?url=${url}`
}

const getTemplateImageURL = (template: WidgetTemplate) => {
  if (template.type?.startsWith('widget.form.')) {
    return getBuiltinWidgetManifest(template.type || '')?.cover || localFileUrl;
  }
  return getCoverImageURL(template.image);
}

const defaultBackImg = (event) => {
  event.target.src = localFileUrl;
  event.target.parentElement.classList += ' error-img';
}

let lastElement = activeElement.value;
watch(()=>activeElement.value?.status?.pointDwonTime , ()=>{
  const type = activeElement.value?.type;
  if(type != "board" && lastElement?.type === "board" || lastElement?.dom?.classList?.contains?.("active")) {
    // 新加组件的瞬间不需要触发隐藏
  } else if(activeElement.value && activeCategoryType.value){
    hideActiveTab();
  }
  lastElement = activeElement.value;
})

</script>

<style scoped lang='scss'>
.widget-template-list-dialog {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 99;
  --left-width: 184px;
  box-shadow: 5px 5px 15px 0px rgb(0 0 0 / 35%);

  .template-header{
    display: flex;
    cursor: move;

    .main-title {
      color: var(--text-color-secondary);
      width: 100%;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #E5E6EB;
      padding-left: 12px;

      .template-header__title {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-color-primary);
      }

      .template-header__actions {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-left: auto;
        padding-right: 4px;

        & > .el-icon {
          cursor: var(--cursor-pointer);
        }
      }

      .el-radio-group{
        flex: 1;
        flex-wrap: nowrap;
        height: 40px;
        border-radius: 2px;
        overflow: hidden;
        overflow-x: auto;
        border-left: 1px solid var(--border-color-light);

        &::-webkit-scrollbar, & ::-webkit-scrollbar-thumb {
          display: none;
        }

        .el-radio-button {
          width: 127px;
          height: 40px;

          .el-radio-button__original-radio{
            width: 0;
            height: 0;
          }

          .el-radio-button__inner{
            width: 127px;
            height: 40px;
            border-radius: 1px;
            font-size: 14px;
            text-align: center;
            line-height: 40px;
            padding: 0;
            border: none;
          }
        }
      }

      .el-checkbox {
        display: flex;
        flex-direction: row-reverse;

        .el-checkbox__label {
          font-size: 14px;
          font-weight: 500;
          margin-right: 10px;
        }
      }

      & > .el-icon svg:hover{
        cursor: var(--cursor-pointer);
      }
    }
  }

  .template-header__close {
    width: 40px;
    height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--text-color-secondary);
    cursor: var(--cursor-pointer);
    transition: color 0.18s ease, background-color 0.18s ease;
  }

  .template-container {
    display: flex;
    top: 0;
    left: 0;
    background-color: var(--bg-color-page) ;
    z-index: 999;
    backdrop-filter: blur(10px);
    --el-main-padding: 6px;

    .el-container {
      .el-main {
        display: flex;
        flex-direction: column;
        --el-main-padding: 0;
        width: 100%;
        height: 590px;
        &>.vn-stack {
          display: flex;
          flex: 1;
          overflow: hidden;
        }
        .category-tabs {
          width: var(--left-width);
          display: flex;
          flex-direction: column;
          position: relative;
          padding: 8px;
          border-right: 1px solid #E5E6EB;
          gap: 8px;

          .category-search {
            .search-input {
              width: 100%;
              --el-input-border-radius: 4px;
              
              .el-input__wrapper {
                padding: 1px 12px;

                .el-input__inner::placeholder {
                  font-size: 12px;
                }

                .el-input__prefix .el-input__icon {
                  margin-right: 6px;
                }
              }
            }
          }

          .category-tabs-list{
            width: 100%;
            flex: 1;
            min-height: 0;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 4px;
            &::-webkit-scrollbar, & ::-webkit-scrollbar-thumb {
              display: none;
            }
            .category-tab {
              position: relative;
              padding: 7px 12px;
              height: 36px;
              font-size: 14px;
              line-height: 22px;
              display: flex;
              align-items: center;
              justify-content: left;
              border-radius: 4px;
              column-gap: 2px;
              color: var(--text-color-regular);
              border-bottom: 2px solid transparent;
              cursor: var(--cursor-pointer);

              .search-value{
                position: absolute;
                right: 10px;
                opacity: 0.8;
              }
            }
            .category-tab:hover {
              background-color: #F2F3F5;
            }
            .category-tab.active{
              color: #0873FF;
              background-color: #E8F6FF;
            }
          }
          
          &::after {
            content: '';
            position: absolute;
            bottom: 0;
            right: 10px;
            width: calc(100% - 20px);
            height: 0;
            background-color: #14141499;
          }

          &.is-searching {
            &.empty::after {
              display: none;
            }
          }
        }
        .widgets-tabs {
          padding: 16px;
          padding-bottom: 0;
          background-color: var(--bg-color);
          border-radius: 2px;

          .widgets-tabs-list{
            max-height: 555px;
            display: flex;
            flex-direction: column;
            row-gap: 16px;
            overflow: scroll;

            &::-webkit-scrollbar, & ::-webkit-scrollbar-thumb {
              display: none;
            }
            .widgets-tabs-item {
              cursor: var(--cursor-pointer);
              position: relative;
              border: 1px solid rgba(0, 0, 0, 0);
              border-radius: 2px;

              &:hover {
                border-color: var(--primary-color-active);
                .mask {
                  display: none;
                }
              }
              .mask {
                position: absolute;
                width: 100%;
                height: 100%;
                left: 0;
                top: 0;
                z-index: 999;
                background-color: rgba(0, 0, 0, 0.4);
                border-radius: 2px;
              }
              .images-box {
                width: 128px;
                height: 72px;
                border-radius: 2px;
                .images {
                  width: 100%;
                  height: 100%;
                  border-radius: 2px;
                }
              }
              .label {
                position: absolute;
                left: 0;
                bottom: 0;
                width: 100%;
                height: 24px;
                background-color: rgba(0, 0, 0, 0.6);
                text-align: center;
                line-height: 16px;
                color: rgba(208, 208, 209, 1);
                padding: 4px;
                font-size: 12px;
              }
              &.actived {
                border-color: var(--primary-color-active);

                .mask {
                  display: none;
                }
              }
            }
          }
        }

        .category-layers {
          flex: 1;
          column-gap: 16px;
          .category-layer-container {
            display: flex;
            flex-direction: column;
            max-height: 580px;
            flex: 1;
            .category-layer {

              .type-container {
                display: flex;
                flex-wrap: wrap;
                padding: 4px 10px;
                margin-top: 8px;
                gap: 8px 16px;

                .type-label {
                  font-size: 14px;
                  line-height: 24px;
                  color: var(--text-color-regular);
                  cursor: var(--cursor-pointer);

                  &.active {
                    color: var(--color-primary);
                  }
                }
              }
              .widgets-category-container {
                margin-top: 8px;
                padding-top: 4px;
                padding-left: 10px;
                position: relative;

                .widget-category-tags {
                    width: 100%;
                    overflow: hidden;
                    display: flex;
                    flex-wrap: wrap;
                    position: relative;
                    column-gap: 12px;
                    row-gap: 8px;
                    margin-top: 8px;
                    .category-tag {
                      user-select: none;
                      max-width: 100px;
                      padding: 2px 8px;
                      line-height: 20px;
                      font-size: 12px;
                      background-color: var(--bg-color-overlay);
                      text-overflow: ellipsis;
                      white-space: nowrap;
                      overflow: hidden;
                      cursor: var(--cursor-pointer);
    
                      &:hover {
                        background-color: var(--bg-color-hover);
                      }
    
                      &.active {
                        color: var(--color-white);
                        background-color: var(--color-primary);
                      }
                    }
    
                }
              } 
            }
            .vn-stack-layer.active {
              flex: unset;
            }
          }
        }
        .added-container {
          display: flex;
          flex-wrap: wrap;
          padding: 4px 10px 12px;
          gap: 8px 16px;
          position: relative;
          
          &::after {
            content: '';
            position: absolute;
            width: calc(100% - 20px);
            height: 1px;
            background-color: #14141499;
            bottom: 0;
            left: 10px;
          }
          &.empty::after {
            display: none;
          }
          .type-label {
            font-size: 14px;
            line-height: 24px;
            color: #BDBDBD;
            cursor: var(--cursor-pointer);
            &.active {
              color: #228CFC;
            }
          }
        }
        .widgets-menu {
          flex: 1;
          margin-top: 16px;
          text-align: left;
          overflow: scroll;
  
          &::-webkit-scrollbar, & ::-webkit-scrollbar-thumb {
            display: none;
          }

          .widgets-category {
            color: var(--text-color-regular);
            .widgets-name-list {
              .mold {
                display: inline-block;
                position: relative;
                text-align: center;
                width: 160px;
                height: 112px;
                margin-right: 13px;
                margin-top: 16px;
                cursor: var(--cursor-pointer);
  
                img {
                  width: 100%;
                  height: 100%;
                  margin: auto;
                  display: block;
                  background-color: var(--bg-color-overlay);
                }
  
                span {
                  display: inline-block;
                  font-size: 12px;
                  padding: 10px 5px 5px 5px;
                  max-width: 150px;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                  overflow: hidden;
                }

                .image{
                  width: 100%;
                  height: 90px;
                  border: 1px solid var(--border-color);
                  position: relative;
                  overflow: hidden;
                  background-color: var(--bg-color-overlay);
                  .not-support {
                    filter: blur(5px);
                  }
                  .mask {
                    width: 100%;
                    height: 100%;
                    position: absolute;
                    left: 0;
                    top: 0;
                    z-index: 999;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    background-color: rgba(0, 0, 0, 0.6);
                  }

                }

                &:hover {
                  .image {
                    border-color: var(--color-primary);
                    .plan-mask{
                      display: flex;
                    }
                  }
                }

              }
              li:not(.use-2n):nth-child(3n) {
                margin-right: 0px;
              }
              li:not(.use-2n):nth-child(-n + 3) {
                margin-top: 0px;
              }
              .use-2n:nth-child(2n) {
                margin-right: 0px;
                border-color: red;
              }
              .use-2n:nth-child(-n + 2) {
                margin-top: 0px;
              }
            }
            .added-list {
              width: 100%;
              display: flex;
              flex-direction: column;
              padding: 0px 20px;
              li {
                width: 100%;
                height: 40px;
                display: flex;
                align-items: center;
                margin-bottom: 12px;
                color: #7A7A7A;
                cursor: var(--cursor-pointer);
                .result-image {
                  width: 64px;
                  height: 40px;
                  margin-right: 12px;
                  img {
                    width: 100%;
                    height: 100%;
                  }
                }
                .result-alias {
                  height: 100%;
                  flex: 1;
                  display: flex;
                  font-size: 14px;
                  justify-content: space-between;
                  align-items: center;
                  border-bottom: 1px solid #14141499;
                  color: #A3A3A3;

                  @mixin text-ellipsis {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                  }

                  .result-alias-text {
                    max-width: 180px;
                    @include text-ellipsis;
                  }

                  .result-origin {
                    line-height: 20px;
                    max-width: 100px;
                    text-align: right;
                    @include text-ellipsis;
                    display: flex;
                    align-items: center;
                    justify-content: right;

                    .type-point {
                      display: inline-block;
                      width: 4px;
                      height: 4px;
                      border-radius: 50%;
                      margin-right: 10px;
                      background-color: #3cb86e;

                      &.added {
                        background-color: #525252;
                      }
                    }
                  }
                }
                &:last-child {
                  margin-bottom: 0px;
                }
                &:hover .result-alias{
                    color: #D0D0D1; 
                    border-color: #228CFC;
                  }
              }
            }
            &.empty {
              display: flex;
              height: 240px;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              .el-icon {
                margin-bottom: 4px;
              }
            }
          }
          .search-btn {
            display: flex;
            height: 240px;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            .el-icon {
              margin-bottom: 4px;
            }
            .search-title{
              color: #7A7A7A;
            }
          }
        }
      }
    }
  }
  .default-widgets-menu {
    text-align: left;
    border-radius: 3px;
    height: 100%;
    overflow: auto;
    left: 0;
    top: 0;
    z-index: 999;
    padding: 9px 9px 0 9px;

    &::-webkit-scrollbar, & ::-webkit-scrollbar-thumb {
      display: none;
    }

    &.default-widgets-menu--embedded {
      width: 100%;
      background-color: var(--bg-color-page);
    }

    .widgets-category {
      &.active {
        .widgets-title {
          &::before {
            content: "";
            position: absolute;
            width: 110px;
            height: 30px;
            left: 0;
            border-bottom-right-radius: 30px;
            background-image: linear-gradient(#ffffff00, #51b6ff4d), linear-gradient(to right, #51b6ff4d, #ffffff00);
            opacity: 0.2;
          }

          &::after {
            content: "";
            position: absolute;
            width: 90px;
            height: 1px;
            bottom: 0;
            left: 0;
            background-image: linear-gradient(to right, #ffffffff, #ffffff00);
            opacity: 0.4;
          }
        }

        .widgets-name-list {
          background-color: #26292e;
        }
      }

      &.empty {
        height: 100px;
      }

      .widgets-title {
        position: relative;
        padding-left: 20px;
        height: 30px;
        line-height: 30px;
        font-size: 14px;
      }

      .widgets-name-list {
        padding: 5px 8px 0 10px;

        .mold {
          display: inline-block;
          width: 68px;
          height: 64px;
          position: relative;
          margin-bottom: 5px;
          text-align: center;
          cursor: var(--cursor-pointer);
          border-radius: 5px;
          margin-right: 3px;

          &:hover {
            background: var(--bg-color-hover);
          }

          img {
            width: 63%;
            height: 44px;
            margin: auto;
            display: block;
          }

          span {
            width: 66px;
            font-size: 11px;
            white-space: nowrap;
            overflow: hidden;
            display: inline-block;
          }
        }
      }

      .empty-result {
        text-align: center;
        height: 80px;
        line-height: 80px;
      }
    }

    .widget-search-box {
      position: sticky;
      display: inline-block;
      padding: 9px 0;
      background-color: var(--bg-color-overlay);
      width: 100%;
      z-index: 1;
      bottom: 0;

      input {
        height: 30px;
        line-height: 30px;
        width: 522px;
        background-color: var(--bg-color-overlay);
        border: 1px solid var(--border-color);
        color: var(--text-color-primary);
        padding: 0 40px;
      }

      .search-icon {
        position: absolute;
        left: 15px;
        top: 15px;
      }

      .clear-search {
        position: absolute;
        right: 10px;
        top: 15px;
        cursor: var(--cursor-pointer);
      }
    }
  }
}
</style>
