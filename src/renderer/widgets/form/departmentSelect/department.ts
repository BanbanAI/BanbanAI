import { FormElementConfiguration, RuleFunc, RuleFuncValue } from "@common/types/nocode";
import { Dynamic, Account, Role, Department as DepartmentType } from "@common/types/account";
import { usePassportStore } from "@renderer/stores/passport";
import { DefinedOptions, GetOptionOptions } from "@renderer/b2/types";
import { FormElement, AbstractForm, AbstractSubForm, AbstractFormLayout } from "@renderer/b2/controllers/form";
import { OptionValue, Soul } from "@common/types/project";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { Ref, ref, watch, defineAsyncComponent } from "vue";
import { deepClone, equals } from '@common/utils/object';

export type OrganizeData = {
  departments: DepartmentType[];
  users: Account[];
  roles: Role[];
  dynamic: Dynamic[];
}

export type OrganizeValue = {
  departments: string[];
  users: string[];
  roles: string[];
  dynamic: Dynamic[];
}

function findWidgetByUid(widgets, uid) {
  for (const widget of (widgets || [])) {
    if (widget.uid === uid) {
      return widget; // 找到了，直接返回
    }
    if (widget.widgets) {
      const found = findWidgetByUid(widget.widgets, uid);
      if (found) {
        return found; // 在子节点里找到了
      }
    }
  }
  return undefined; // 没找到
}

type SoulWithWidgets = Soul & {
  uid?: string;
  title?: string;
  type?: string;
  widgets?: SoulWithWidgets[];
  getOption?: (paths: string | string[]) => unknown;
};

function filterMembersToTree(
  widgets: SoulWithWidgets[] = [],
  isSelectable: (uid?: string) => boolean = () => true,
) {
  return widgets
    .map(item => {
      const children = item.widgets ? filterMembersToTree(item.widgets, isSelectable) : [];
      const isMemberField = item.type === "widget.form.memberSelect" && isSelectable(item.uid);
      if (!isMemberField && children.length === 0) {
        return null;
      }
      return {
        label: item.title,
        value: item.uid,
        type: item.type,
        children: children.length > 0 ? children : undefined
      };
    })
    .filter(Boolean);
}

type OrganizeValueEntry<T extends keyof OrganizeValue = keyof OrganizeValue> = [key:  T, value: OrganizeValue[T]];
const passportState = usePassportStore();
export class Department extends FormElement {
  static resource = resource as any;

  get defaultName() {
    return i18next.t("defaultName");
  }
  private _availableDepartmentsList = ref()//初始值为undifinded, getter中做判断是否有数据 从option获取，setter中对option赋值
  private _availableRoleList = ref()
  private _availableUserList = ref()
  private _selectedList= ref({
    departments: [],
    users: [],
    roles: [],
    dynamic: [],
  });
  private _departmentListDialogVisible = ref<boolean>(false);

  public noEffectedLinkages = ref(null);

  private _allUserList = ref<Account[]>([]);
  private _allRolesList = ref<Role[]>([]);
  private _allDepartmentsList = ref<DepartmentType[]>([]);

  get currentAccount(): Account {
    return passportState.account;
  }
  get allUserList() {
    return this._allUserList.value
  }
  set allUserList(value: Account[]){
    this._allUserList.value = value
  }
  get allRolesList() {
    return this._allRolesList.value
  }
  set allRolesList(value: Role[]){
    this._allRolesList.value = value
  }
  get allDepartmentsList() {
    return this._allDepartmentsList.value
  }
  set allDepartmentsList(value: DepartmentType[]){
    this._allDepartmentsList.value = value
  }
  protected override initAfterConstructor(): void {
    if(this._defaultValue?.dynamic?.length) {
      if(
        (this._defaultValue.dynamic.includes(Dynamic.CURRENT_USER) && this.currentType === 'member') ||
        (this._defaultValue.dynamic.includes(Dynamic.CURRENT_DEPARTMENT) && this.currentType === 'department')
      ) {
        this._isSelectCurrent.value = true
      }
    }

    this.initWatch();
  }

  private initWatch() {
    this.effectScope.run(() => {
      watch(() => {
        if (this.currentType === "department" && !this.allDepartmentsList.length) return [];
        else if (this.currentType === "member" && !this.allUserList.length) return [];
        return this.inputValue;
      }, (value, oldValue) => {
        if (!value || equals(value, oldValue)) {
          return;
        }
        this.selectedList.dynamic = []
        let filterValue = value
        if(this._isSelectCurrent.value) {
          this.selectedList.dynamic.push(this.currentType === 'member' ? Dynamic.CURRENT_USER : Dynamic.CURRENT_DEPARTMENT)
          filterValue = filterValue.filter(item => item != this.currentAccount?.id)
          for(const depId of (this.currentAccount?.departments || [])) {
            filterValue = filterValue.filter(item => item != depId)
          }
        } else {
          this.selectedList.dynamic = []
        }
        if (this.currentType === "department") {
          this.selectedList.departments = this.resolveSelectedItemsByOrder(filterValue, this.allDepartmentsList);
        } else if (this.currentType === "member") {
          this.selectedList.users = this.resolveSelectedItemsByOrder(filterValue, this.allUserList);
        }

      }, { immediate: true });

      watch(
        () => this._isSelectCurrent.value,
        (value, oldValue) => {
          this.selectedList.dynamic = []
          let filterValue = this.inputValue
          if(this._isSelectCurrent.value) {
            this.selectedList.dynamic.push(this.currentType === 'member' ? Dynamic.CURRENT_USER : Dynamic.CURRENT_DEPARTMENT)
            filterValue = filterValue.filter(item => item != this.currentAccount?.id)
            for(const depId of (this.currentAccount?.departments || [])) {
              filterValue = filterValue.filter(item => item != depId)
            }
          } else {
            this.selectedList.dynamic = []
          }
        },
        { immediate: true }
      );

      if (this.isEditable) {
        watch(() => this.getOption("range-type"), (optionRange, oldOptionRange) => {
          if (optionRange === "custom") {
            this.availableDepartmentsList = {
              departments: [],
              users: [],
              roles: [],
              dynamic: [],
            };
            this.availableRoleList = {
              departments: [],
              users: [],
              roles: [],
              dynamic: [],
            };
            this.availableUserList = {
              departments: [],
              users: [],
              roles: [],
              dynamic: [],
            };
          }
        }, { immediate: true })
      }
    })
  }

  private resolveSelectedItemsByOrder<T extends { id: string }>(ids: string[], list: T[]): T[] {
    return (ids || []).map(id => list.find(item => item.id === id)).filter(Boolean);
  }

  protected getFormWidgets() {
    let parent = this.parent;
    while (parent) {
      if (parent.type === 'widget.form.form') {
        break
      }
      parent = parent.parent as AbstractForm | AbstractSubForm | AbstractFormLayout;
    }
    return ((parent as AbstractForm)?.widgets || []) as SoulWithWidgets[];
  }

  protected getFillFieldWidget() {
    const fillField = this.getOption<string>("fill-field");
    if (!this.canUseFillFieldUid(fillField)) {
      return undefined;
    }
    const fillFieldWidget = findWidgetByUid(this.getFormWidgets(), fillField);
    return fillFieldWidget?.type === "widget.form.memberSelect" ? fillFieldWidget : undefined;
  }

  protected inspectFillFieldUid(fillField?: string) {
    if (!fillField) {
      return {
        hasCycle: false,
        reachesCurrentWidget: false,
      };
    }

    const visited = new Set<string>();
    let currentUid = fillField;

    while (currentUid) {
      if (currentUid === this.uid) {
        return {
          hasCycle: false,
          reachesCurrentWidget: true,
        };
      }

      if (visited.has(currentUid)) {
        return {
          hasCycle: true,
          reachesCurrentWidget: false,
        };
      }

      visited.add(currentUid);

      const currentWidget = findWidgetByUid(this.getFormWidgets(), currentUid) as SoulWithWidgets | undefined;
      if (!currentWidget || currentWidget.type !== "widget.form.memberSelect") {
        return {
          hasCycle: false,
          reachesCurrentWidget: false,
        };
      }

      if (currentWidget.getOption?.("auto-fill") !== "fill") {
        return {
          hasCycle: false,
          reachesCurrentWidget: false,
        };
      }

      const nextUid = currentWidget.getOption?.("fill-field");
      if (!nextUid || typeof nextUid !== "string") {
        return {
          hasCycle: false,
          reachesCurrentWidget: false,
        };
      }

      currentUid = nextUid;
    }

    return {
      hasCycle: false,
      reachesCurrentWidget: false,
    };
  }

  protected canUseFillFieldUid(fillField?: string) {
    if (!fillField) {
      return false;
    }

    const { hasCycle, reachesCurrentWidget } = this.inspectFillFieldUid(fillField);
    return !hasCycle && !reachesCurrentWidget;
  }

  //角色
  get availableRoleList() {
    return this._availableRoleList.value;
  }

  set availableRoleList(value){
    this._availableRoleList.value = value
  }

  //用户
  get availableUserList() {
    const value = this.getOption("custom-editor");
    if (!value) {
      return this._availableUserList.value
    }
    return value;
  }

  set availableUserList(value){
    this._availableUserList.value = value
  }

  set availableDepartmentsList(value){
    this._availableDepartmentsList.value = value
  }

  get availableDepartmentsList() {
    const value = this.getOption("custom-editor");
    if (!value) {
      return this._availableDepartmentsList.value
    }
    return value;
  }

  get selectedList() {
    return this._selectedList.value;
  }

  get departmentListDialogVisible(): boolean {
    return this._departmentListDialogVisible.value;
  }

  set departmentListDialogVisible(value:boolean){
    this._departmentListDialogVisible.value = value
  }

  static defineOptions(): DefinedOptions[] {
    return [
      {
        style: {
          basicStyle: {
            children: [
              {
                name: "input-width",
                alias: i18next.t("selectWidth"),
              },
              {
                name: "width-subform",
                default: 200,
              },
              {
                name: "multiple-select",
                alias: i18next.t("type"),
                type: "select(radioGroup)",
                selectChoices: [
                  { label: i18next.t("single"), value: "single" },
                  { label: i18next.t("multiple"), value: "multiple" },
                ],
                default: "single",
              },
              {
                name: "default-type",
                alias: i18next.t("defaultValue"),
                type: "select",
                selectChoices: [
                  { label: i18next.t("custom"), value: "custom-default-type" },
                  { label: i18next.t("quickSetting"), value: "formula" },
                  { label: i18next.t("autoFill"), value: "fill" },
                ],
                default: "custom",
                visible: false,
              },
              {
                name: "option-range",
                alias: i18next.t("optionRange"),
                type: "select",
                selectChoices: [
                  // {
                  //   value: "data",
                  //   label: i18next.t("data"),
                  // },
                  {
                    value: "custom",
                    label: i18next.t("custom"),
                  },
                  {
                    value: "all",
                    label: i18next.t("all")
                  }
                ],
                visible: false,
                default: "all"
              },
              {
                name: "select-range",
                alias: i18next.t("limitSelectableRange"),
                type: "boolean",
                default: true,
                visible: false,
              },
              {
                name: "range-type",
                alias: i18next.t("optionRange"),
                type: "select(radioGroup)",
                selectChoices: [
                  { label: i18next.t("all"), value: "all" },
                  { label: i18next.t("custom"), value: "custom" },
                ],
                default: "all",
                visible: (widget) => widget.getOption("select-range") === true
              },
              {
                name: "custom-editor",
                alias: null,
                type: "dialog",
                dialog: {
                  component: defineAsyncComponent(() => import("@renderer/views/nocode/views/workbench/dialog/OrganizeManagerDialog.vue")),
                  buttonText: i18next.t("setRange"),
                  componentProps: (element: Department) => {
                    return {
                      isInWidget: true,
                      multiple: true,
                      isSetting: true,
                      currentType: element.currentType,
                      dialogTitle: i18next.t("setRange"),
                      tableList: element.currentType === 'department' ? element.availableDepartmentsList : element.availableUserList,
                    }
                  }
                },
                visible: (widget) => widget.getOption("range-type") === "custom" && widget.getOption("select-range") === true
              },
              {
                name: "default-value",
                alias: i18next.t("defaultValue"),
                type: "dialog",
                dialog: {
                  component: defineAsyncComponent(() => import("@renderer/views/nocode/views/workbench/dialog/OrganizeManagerDialog.vue")),
                  buttonText: (element: Department) => {
                    const value = element._defaultValue;
                    element._isSelectCurrent.value = false
                    let result = i18next.t("setting");
                    if (!value) return result;
                    if (element.currentType === "department") {
                      if(value.departments?.length) {
                        result = i18next.t("configured");
                      }
                    } else {
                      if(value.users?.length) {
                        result = i18next.t("configured");
                      }
                    }
                    if(value.dynamic?.length) {
                      result = i18next.t("configured");
                    }
                    return result
                  },
                  buttonStyle:(element: Department) => {
                    const value = element._defaultValue;
                    element._isSelectCurrent.value = false
                    let result = {};
                    if (!value) return result;
                    if (element.currentType === "department") {
                      if(value.departments?.length) {
                        result = { color: 'var(--color-primary)' };
                      }
                    } else {
                      if(value.users?.length) {
                        result = { color: 'var(--color-primary)' };
                      }
                    }
                    if(value.dynamic?.length) {
                      result = { color: 'var(--color-primary)' };
                    }
                    return result
                  },
                  componentProps: (element: Department) => {
                    const defaultValue = element.getOption("default-value");
                    const availableValue = () => {
                      if(element.getOption('range-type') != 'all') {
                        return element.currentType === 'department' ? element.availableDepartmentsList : element.availableUserList
                      }
                      return element.currentType === 'department' ? element.allDepartmentsList : element.allUserList
                    }

                    return {
                      isInWidget: true,
                      multiple: element.getOption<string>("multiple-select") === "multiple",
                      isSetting: true,
                      currentType: element.currentType,
                      dialogTitle: i18next.t("setting"),
                      tableList: defaultValue
                        ? deepClone(defaultValue)
                        : {
                          departments: [],
                          users: [],
                          roles: [],
                          dynamic: [],
                        },
                      isSetDefault: true,
                      isAvailable: element.getOption('select-range') && element.getOption('range-type') === 'custom',
                      availableValue: availableValue(),
                    }
                  }
                },
                visible: true
              },
              {
                name: "auto-fill",
                alias: i18next.t("autoFill"),
                type: "select",
                selectChoices: (element: Department) => [
                  { label: i18next.t("notFill"), value: "unfill" },
                  {
                    label: element.currentType === 'member'
                      ? i18next.t("memberInfoOfMemberField")
                      : i18next.t("departmentOfMemberField"),
                    value: "fill"
                  },
                ],
                default: "unfill",
                visible: (element: Department) => {
                  return ['department', 'member'].includes(element.currentType)
                }
              },
              {
                name: "fill-field",
                alias: i18next.t("selectMemberField"),
                type: "select(tree,onlyCheckLeaf)",
                default: '',
                selectChoices: (widget) => {
                  return filterMembersToTree(
                    widget.getFormWidgets(),
                    fillField => widget.canUseFillFieldUid(fillField)
                  )
                },
                visible: (widget) => widget.getOption("auto-fill") === "fill"
              },
            ],
          },
          validation: {
            children: [
            ]
          },
          linkForm: {
            visible: false,
          },
        },
      },
      ...super.defineOptions(),
    ];
  }

  override setOption(paths: string | string[], value: any, history?: boolean): void {
    if (!Array.isArray(paths)) {
      paths = [paths];
    }
    if (['custom-editor', 'default-value'].includes(paths.at(-1))) {
      const result = {
        departments: [],
        users: [],
        roles: [],
        dynamic: value?.dynamic || [],
      }
      if(value.departments) {
        result.departments = value.departments.map(item => item.id)
      }
      if(value.users) {
        result.users = value.users.map(item => item.id)
      }
      if(value.roles) {
        result.roles = value.roles.map(item => item.id)
      }
      super.setOption(paths, result, history);
    } else {
      super.setOption(paths, value, history);
    }
  }

  override getOption<T extends OptionValue>(paths: string | string[], options?: GetOptionOptions): T {
    if (!Array.isArray(paths)) {
      paths = [paths];
    }
    if (['custom-editor', 'default-value'].includes(paths.at(-1))) {
      const value = super.getOption<OrganizeValue>(paths, options);
      return this.transformOrganizeValue(value) as any;
    } else {
      return super.getOption<T>(paths, options);
    }
  }

  private get _defaultValue(): OrganizeValue {
    return super.getOption<OrganizeValue>("default-value");
  }

  get defaultValue() {
    const value = this._defaultValue;
    if (!value) return [];
    let result = [];
    if (this.currentType === "department") {
      result = [...value.departments];
    } else {
      result = [...value.users];
    }
    return result
  }

  private transformOrganizeValue(value: OrganizeValue): OrganizeData {
    if (!value) return value as any;
    const userList = this.allUserList;
    const departmentList = this.allDepartmentsList;
    const data = Object.entries(value).reduce<Partial<OrganizeData>>((prev, [key, value]: OrganizeValueEntry) => {
      if (key === "users") {
        prev[key] = value.map(item => {
          if (Array.isArray(userList) && userList.length > 0) {
            return userList.find(user => user.id === item)
          }
          return item;
        });
      } else if (key === "departments") {
        prev[key] = value.map(item => {
          if (Array.isArray(departmentList) && departmentList.length > 0) {
            return departmentList.find(department => department.id === item)
          }
          return item;
        });
      } else if (key === "dynamic") {
        prev[key] = value as Dynamic[];
      } else {
        prev[key] = value.map(item => {
          if (Array.isArray(this.allRolesList) && this.allRolesList.length > 0) {
            return this.allRolesList.find(role => role.id === item)
          }
          return item
        });
      }
      return prev;
    }, {}) as OrganizeData
    console.log('data', data)
    return data
  }

  protected _inputValue: Ref<string[]> = ref();
  private _cacheInputValue = [];
  public get inputValue() {
    const hasRuntimeInputValue = this._inputValue.value != null;
    let value = this._inputValue.value ?? this.initialValue ?? this.defaultValue;
    // 仅在真正回落到初始值时，才清掉默认的“当前成员/当前部门”动态态
    if(!hasRuntimeInputValue && this.initialValue != null) {
      this._isSelectCurrent.value = false
    }
    if(this._isSelectCurrent.value) {
      if(this.currentType === 'member') {
        value = value.filter(item => item != this.currentAccount?.id)
        value.push(this.currentAccount?.id)
      } else {
        for(const depId of (this.currentAccount?.departments || [])) {
          value = value.filter(item => item != depId)
          value.push(depId)
          if (!this.isMultiple) {
            break
          }
        }
      }
    }

    const fillFieldWidget = this.getFillFieldWidget();
    if(this.getOption("auto-fill") === "fill" && fillFieldWidget) {
      if (this.currentType === 'member') {
        this.isSelectCurrent = false
        value = Array.isArray(fillFieldWidget.inputValue)
          ? Array.from(new Set(fillFieldWidget.inputValue))
          : [];
      } else if (fillFieldWidget.inputValue && this.currentType === 'department') {
        let fillValue = []
        const users = fillFieldWidget.inputValue?.map(userId => {
          return this.allUserList.find(user => user.id === userId) || undefined
        }).filter(Boolean)
        users.forEach(user => {
          if(user.departments.length) {
            fillValue.push(...user.departments)
          }
        })
        fillValue = Array.from(new Set(fillValue))

        if(fillValue.length) {
          this.isSelectCurrent = false
          value = fillValue
        }
      }
    }
    let tempValue = value;
    if (!this.isMultiple) {
      if (Array.isArray(value)) {
        tempValue = value.slice(0, 1);
      } else {
        tempValue = value != null ? [value] : [];
      }
    }
    if (!equals(this._cacheInputValue, value)) {
      this._cacheInputValue = tempValue;
    }
    return this._cacheInputValue;
  }

  public clearValue() {
    this.inputValue = [];
  }

  public set inputValue(value: string[]) {
    this._inputValue.value = value;
    this.updateLastChangeTime();
  }

  private _isSelectCurrent: Ref<boolean> = ref(false)

  public set isSelectCurrent(value: boolean) {
    this._isSelectCurrent.value = value;
  }

  public get isSelectCurrent() {
    return this._isSelectCurrent.value
  }

  public isEmpty(): boolean {
    if(this._isSelectCurrent.value) {
      return false
    }
    return super.isEmpty();
  }

  async doValidate() {
    if (this.isRequired && super.isEmpty() && this._isSelectCurrent.value) {
      throw new Error(i18next.t("currentMemberUnassignedDepartment"));
    }
  }

  get currentType(): "department" | "member" {
    return "department"
  }

  get isMultiple(): boolean {
    return this.getOption<string>("multiple-select") === "multiple";
  }

  isSelectIdInAvailableDepartments(selectedIds) {
    const allIds = this.getDepartmentsAllIds(this.availableDepartmentsList);
    return selectedIds.every(id => allIds.includes(id));
  }

  getDepartmentsAllIds(departments) {
    const ids = [];
    departments.forEach(item => {
      ids.push(item.id);
      if (item.children && item.children.length > 0) {
        ids.push(...this.getDepartmentsAllIds(item.children));
      }
    });
    return ids;
  }

  get fieldType() {
    return "array";
  }

  resolveFormSetting() {
    const extra = {
      defaultValue: this.defaultValue,
      defaultValueDynamic: this.getOption("default-value")?.dynamic || [],
      isMultiple: this.isMultiple,
    }

    return {
      ...super.resolveFormSetting(),
      subType: "department",
      extra: {
        ...(super.resolveFormSetting()?.extra || {}),
        ...extra,
      }
    };
  }

  getConfigurations(): FormElementConfiguration {
    if (this.isMultiple) {
      return {
        subType: "department",
        funcInfo: {
          [RuleFunc.CONTAIN_ANY]: RuleFuncValue.SELECT_MULTIPLE,
          [RuleFunc.CONTAIN_ALL]: RuleFuncValue.SELECT_MULTIPLE,
          [RuleFunc.EQUAL]: RuleFuncValue.SELECT_MULTIPLE,
          [RuleFunc.EMPTY]: RuleFuncValue.NULL,
          [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
        },
        // 编辑表单时使用的筛选判断条件
        editFuncInfo: {
          [RuleFunc.CONTAIN_ANY]: RuleFuncValue.SELECT_MULTIPLE,
          [RuleFunc.CONTAIN_ALL]: RuleFuncValue.SELECT_MULTIPLE,
          [RuleFunc.EMPTY]: RuleFuncValue.NULL,
          [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
        }
      };
    }
    return {
      subType: "department",
      funcInfo: {
        [RuleFunc.EQUAL]: RuleFuncValue.SELECT,
        [RuleFunc.NOT_EQUAL]: RuleFuncValue.SELECT,
        [RuleFunc.IN]: RuleFuncValue.SELECT_MULTIPLE,
        [RuleFunc.NOT_IN]: RuleFuncValue.SELECT_MULTIPLE,
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
      },
      // 编辑表单时使用的筛选判断条件
      editFuncInfo: {
        [RuleFunc.EQUAL]: RuleFuncValue.SELECT,
        [RuleFunc.NOT_EQUAL]: RuleFuncValue.SELECT,
        [RuleFunc.CONTAIN_ANY]: RuleFuncValue.SELECT_MULTIPLE,
        [RuleFunc.EMPTY]: RuleFuncValue.NULL,
        [RuleFunc.NOT_EMPTY]: RuleFuncValue.NULL,
      }
    }
  }
}
