import { unique } from "@common/utils/unique";
import { isNocodeFormData } from "@common/utils/connection";
import { DefinedOptions } from "@renderer/b2/types";
import { FormElement, AbstractForm } from "@renderer/b2/controllers/form";
import { WidgetSoul } from "@common/types/project";
import { inject, Ref, ref, watch } from "vue";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { equals, isEmpty } from "@common/utils/object";
import TabsStyleDialog from "./TabsStyleDialog.vue"
import { TabPanel } from "../tabPanel/tabPanel"
import { Form } from "../../form/form";
import { Table } from "@common/types/project";

export type TabsTitleItem = {
  id: string;
  label?: string;
  value: string;
  color?: string;
};

export type TabsTitleFont = {
  family?: string,
  size: number,
  color: string,
  bold: boolean,
  italic?: boolean,
  underline?: boolean,
  "line-through"?: boolean,
};

type ColorOptions = {
  checkedValue?: string;
  isColored: boolean;
  options: TabsTitleItem[];
  otherOptions?: { id: string; value: string };
};

export type tabsTitleStyleType = {
  selectVal: string,
  tabsAlign: string,
}

export class MultipleTabs extends FormElement {
  static resource = resource as any;

  constructor(soul: WidgetSoul, parent: AbstractForm) {
    super(soul, parent)
    this.initContainer();
    // 是否是第一次（第一次主动加3个tab）避免新建多个选项卡时面板uid一样
    if(!this.getOption("is-first-create")) {
      this.setOption("tabs-option-content", {
        options: [
          {
            id: unique(),
            label: i18next.t("defaultOption1"),
            value: i18next.t("defaultOption1"),
          },

          {
            id: unique(),
            label: i18next.t("defaultOption2"),
            value: i18next.t("defaultOption2"),
          },
          {
            id: unique(),
            label: i18next.t("defaultOption3"),
            value: i18next.t("defaultOption3"),
          },
        ],
      })
      this.setOption("is-first-create", true)
    }

  }

  // @ts-ignore
  get children(): TabPanel[] {
    return super.children as unknown as TabPanel[];
  }

  public get tabsOptionList(): TabsTitleItem[] {
    return this.tabsOptionContent.options
  }

  async initAfterConstructor() {
    await super.initAfterConstructor();
    await this._watchTabs();
  }

  isChildShow(widget: FormElement) {
    return (this.topForm as Form).isChildShow(widget);
  }

  static defineOptions(): DefinedOptions[] {
    const optionText = i18next.t("option");
    const deleteTabTip = i18next.t("deleteTabTip");
    return [
      {
        style: {
          basicStyle: {
            children: [
              {
                name: "show-title",
                default: false,
                visible: false,
              },
              // {
              //   name: "title-text",
              //   visible: false,
              // },
              {
                name: "show-description",
                visible: false,
              },
              {
                name: "description-content",
                visible: false,
              },
              {
                name: "tabs-option-content",
                alias: i18next.t("optionText"),
                type: `tabs-array(draggable, defaultString=${optionText}, deleteTip=${deleteTabTip})`,
                default: {
                  options: []
                }
              },
              {
                name: "tabs-title-style",
                alias: i18next.t("tabStyle"),
                type: "dialog",
                default: {
                  selectVal: 'title_1',
                  tabsAlign: 'left',
                },
                dialog: {
                  component: TabsStyleDialog,
                  buttonText: i18next.t("selectStyle")
                }
              },
              {
                name: "tabs-title-color",
                alias: i18next.t("tabColor"),
                type: "color",
                default: "#0873FFFF",
              },
              {
                name: "tabs-title-family",
                alias: i18next.t("selectedItemFont"),
                type: "font",
                default: {
                  size: 14,
                  color: "#0873FFFF",
                  bold: false,
                  italic: false,
                  underline: false,
                  "line-through": false,
                },
              },
              {
                name: "tabs-title-gap",
                alias: i18next.t("fontGap"),
                type: "number(unit=px)",
                default: 0,
              },
              {
                name: "is-first-create",
                type: 'hidden',
                visible: false
              },
            ]
          },
          fieldProperty: {
            alias: i18next.t("fieldProperty"),
            fold: "unfold",
            children: [
              {
                name: "is-readonly",
                visible: false
              },
              {
                name: 'is-hidden',
                alias: i18next.t("hide"),
                default: false,
                type: "boolean",
              },
            ]
          },
          fieldsControl: {
            visible: false,
          },
          validation: {
            visible: false,
          },
          linkForm: {
            visible: false,
          }
        },
      },
      ...super.defineOptions()
    ]
  }

  get supportFixedWidth() {
    return false;
  }

  get tabsOptionContent() {
    return this.getOption<ColorOptions>("tabs-option-content")
  }

  get tabsTitleStyle() {
    return this.getOption<tabsTitleStyleType>("tabs-title-style")
  }

  get tabsTitleColor() {
    return this.getOption<string>("tabs-title-color")
  }

  get tabsTitleFamily() {
    return this.getOption<TabsTitleFont>("tabs-title-family")
  }
  set tabsTitleFamily(val: TabsTitleFont) {
    this.setOption("tabs-title-family", val)
  }

  get tabsTitleGap() {
    return this.getOption("tabs-title-gap")
  }

  get defaultName() {
    return i18next.t("defaultName");
  }

  private _selectTabValue = ref()
  public get selectTabValue() {
    return this._selectTabValue.value || this.tabsOptionList?.[0]?.id
  }
  public set selectTabValue(value: string) {
    this._selectTabValue.value = value;
  }

  activePanel(panel: TabPanel) {
    this.selectTabValue = panel.uid;
  }

  get defaultValue() {
    return [{}];
  }

  private _tabs: Ref<object[]> = ref();

  get tabs() {
    return this._tabs.value;
  }

  get inputValue() {
    return this.tabs;
  }
  set inputValue(tabs) {
    this._tabs.value = tabs;
  }

  private _fieldsAuth = ref();
  private shouldForwardAuthToPanels(fieldsAuth) {
    return fieldsAuth?.[this.uid] === void 0;
  }
  setWidgetAuth(fieldsAuth) {
    super.setWidgetAuth(fieldsAuth);
    this._fieldsAuth.value = fieldsAuth;
    if (this.shouldForwardAuthToPanels(fieldsAuth)) {
      for (const tabPanel of this.tabPanels) {
        tabPanel.setWidgetAuth(fieldsAuth);
      }
    }
  }

  private async _createAbstractFormLayout(tab: TabsTitleItem, isFirst: boolean, index: number): Promise<TabPanel> {
    const tabPanel = await this.container.addWidget({ type: "widget.form.tabPanel", uid: tab.id }, index) as TabPanel;
    // TODO 标题
    tabPanel.title = tab.value;
    tabPanel.name = tab.value;

    if (isFirst) {
      this.selectTabValue = this.tabsOptionList[0].id
    } else {
      this.selectTabValue = tabPanel.uid
    }
    return tabPanel
  }

  private isSyncing = false;
  private _watchTabs() {
    this.effectScope.run(async () => {
      watch(()=>{
        const tabPanelIds = this.getSoul().widgets?.map(w => w.uid)
        const optionIds = this.tabsOptionList.map(item => item.id);
        return {
          tabPanelIds,
          optionIds,
        }
      }, async (value, oldValue)=>{
        // 标签头文字变化
        if (equals(value, oldValue)) {
          value.optionIds.forEach((optionItem, index) => {
            if(optionItem === value.tabPanelIds[index]) {
              // 标签头修改(第一次刷新不会变化，this.tabPanels暂时没加载出来)
              if (this.tabPanels[index] && (this.tabsOptionList[index].value !== this.tabPanels[index].title)) {
                this.children[index].title = this.tabsOptionList[index].value
                this.children[index].name = this.tabsOptionList[index].value
              }
            }
          })
        }

        if (equals(value, oldValue) || this.isSyncing) return;

        this.isSyncing = true;
        const addedIds = value.optionIds.filter(id => !value.tabPanelIds.includes(id));
        const deletedIds = value.tabPanelIds.filter(id => !value.optionIds.includes(id))

        // 初始化defaultTabsArray时id每次都会变，所以当tabPanels有值时，将tabPanels的uid返赋值给defaultTabsArray 修改标签也在这
        if (value.tabPanelIds.length === value.optionIds.length && value.tabPanelIds.length > 0) {
          // 标签和面板id一致，顺序变化
          if (value.tabPanelIds.every(item => value.optionIds.includes(item)) && oldValue) {
            const diffArr = value.optionIds.filter((panelItem, index) => panelItem !== value.tabPanelIds[index])
            if (diffArr.length > 0) {
              let diff
              value.tabPanelIds.forEach((panelItem, index) => {
                if (panelItem === diffArr[0] && value.tabPanelIds[index + 1] !== diffArr[1]) {
                  diff = panelItem
                } else if (panelItem === diffArr[diffArr.length-1] && value.tabPanelIds[index - 1] !== diffArr[diffArr.length-2]) {
                  diff = panelItem
                }
              })
              // 获取变化位置元素的当前位置
              const currentIndex = value.optionIds.findIndex(optionItem => optionItem === diff)
              const oldIndex = value.tabPanelIds.findIndex(optionItem => optionItem === diff)
              const moveTab = this.getSoul().widgets[oldIndex]
              this.getSoul().widgets?.splice(oldIndex, 1)
              this.getSoul().widgets?.splice(currentIndex, 0, moveTab)
            }

            this.isSyncing = false;
            return
          }
          // 防止标签页的id刷新后修改
          const optionList = ref([])
          value.tabPanelIds.forEach((panelItem, index) => {
            const defaultTabsArray = this.tabsOptionContent
            defaultTabsArray.options[index].id = panelItem
            optionList.value.push({
              id: panelItem,
              label: defaultTabsArray.options[index].label,
              value: defaultTabsArray.options[index].value,
            })
          })
          this.setOption('tabs-option-content', {
            options: optionList.value,
          }, false)

          this.isSyncing = false;
          return
        }

        // 添加标签的逻辑
        for (const id of addedIds) {
          const tab = this.tabsOptionList.find(item => item.id === id);
          const tabIndex = this.tabsOptionList.findIndex(item => item.id === id)
          await this._createAbstractFormLayout(tab, oldValue === undefined, tabIndex);
        }


        const getChildrenWidgetSouls = (soul: WidgetSoul) => {
          const result: WidgetSoul[] = [];

          function traverse(widgetsArray: WidgetSoul[]) {
            for (const widget of widgetsArray) {
              result.push(widget); // 将当前widget加入结果
              if (widget.widgets && Array.isArray(widget.widgets)) {
                traverse(widget.widgets); // 递归处理子widgets
              }
            }
          }

          if (soul.widgets && Array.isArray(soul.widgets)) {
            traverse(soul.widgets);
          }

          return result;
        }
        // 删除标签的逻辑
        for (const id of deletedIds) {
          if (oldValue.optionIds.length === 1) {
            this.isSyncing = false;
            return
          }

          const deleteWidget = await this.container.removeWidget(id);
          const childrenWidgetSouls = getChildrenWidgetSouls(deleteWidget);
          const allDeleteWidgets = childrenWidgetSouls.filter(item => item.type !== "widget.form.tabPanel");
          if (!isEmpty(allDeleteWidgets)) {
            for (const _widgetItem of allDeleteWidgets) {
              this.handleIntoRecycleBinGlobal(_widgetItem, this.mainTable);
            }
          }
        }

        this.isSyncing = false;
      }, {immediate: true, deep: true});

      watch(() => {
        if (isEmpty(this.tabPanels)) return [];
        const value = this.tabPanels.map(tabPanel => tabPanel.visible);
        return String(value);
      }, (value, oldValue) => {
        if (equals(value, oldValue)) return;
        if (!this.tabPanel?.visible) {
          this.selectTabValue = this.tabPanels.find(item => !item.isHidden)?.uid;
        }
      }, { immediate: true })
    })
  }

  private handleIntoRecycleBinGlobal: ((widget: WidgetSoul, table: Table) => void);
  useHandleIntoFieldRecycleBin(handle: (widget: WidgetSoul, table: Table) => void) {
    this.handleIntoRecycleBinGlobal = handle;
  }
  get tabPanels() {
    return this.children;
  }

  get tabPanel() {
    return this.tabPanels.find(item => item.uid === this.selectTabValue)
  }

  get panelChildren() {
    return this.children.reduce((acc, item) => {
      return acc.concat(item.children);
    },[]);
  }

  get mainTable() {
    const mainFormData = this.getBoard().getConnections()?.find(c => c.uid === this.topForm.tableUID?.[0]);
    return mainFormData?.tables?.find(tableItem => tableItem.uid === this.topForm.tableUID[1]);
  }

  public getTabChildByUid(uid: string) {
    this.panelChildren.find(item => item.uid === uid);
  }

  isCreateField(): boolean {
    return false
  }

}


