import i18next from 'i18next'

import {
  formFieldTypeCatalog,
  type FormFieldTypeCatalogItem,
} from './formFieldTypeCatalog'

export type FormFieldType = {
  type: string
  name: string
  icon?: any
}

export type FormFieldTypes = {
  category: string
  children: Array<FormFieldType>
}[]

const formFieldTypeIconMap: Record<string, any> = {
  INocodeBasicTextInput: typeof INocodeBasicTextInput === 'undefined' ? undefined : INocodeBasicTextInput,
  INocodeBasicTextarea: typeof INocodeBasicTextarea === 'undefined' ? undefined : INocodeBasicTextarea,
  INocodeBasicNumberInput: typeof INocodeBasicNumberInput === 'undefined' ? undefined : INocodeBasicNumberInput,
  INocodeBasicAmountInput: typeof INocodeBasicAmountInput === 'undefined' ? undefined : INocodeBasicAmountInput,
  INocodeBasicSerialNumber: typeof INocodeBasicSerialNumber === 'undefined' ? undefined : INocodeBasicSerialNumber,
  INocodeBasicDatePicker: typeof INocodeBasicDatePicker === 'undefined' ? undefined : INocodeBasicDatePicker,
  INocodeBasicDateRangePicker: typeof INocodeBasicDateRangePicker === 'undefined' ? undefined : INocodeBasicDateRangePicker,
  INocodeBasicTimePicker: typeof INocodeBasicTimePicker === 'undefined' ? undefined : INocodeBasicTimePicker,
  INocodeBasicRadioGroup: typeof INocodeBasicRadioGroup === 'undefined' ? undefined : INocodeBasicRadioGroup,
  INocodeBasicCheckboxGroup: typeof INocodeBasicCheckboxGroup === 'undefined' ? undefined : INocodeBasicCheckboxGroup,
  INocodeBasicTreeSelect: typeof INocodeBasicTreeSelect === 'undefined' ? undefined : INocodeBasicTreeSelect,
  INocodeBasicTreeMultipleSelect: typeof INocodeBasicTreeMultipleSelect === 'undefined' ? undefined : INocodeBasicTreeMultipleSelect,
  INocodeBasicMemberSelect: typeof INocodeBasicMemberSelect === 'undefined' ? undefined : INocodeBasicMemberSelect,
  INocodeBasicDepartmentSelect: typeof INocodeBasicDepartmentSelect === 'undefined' ? undefined : INocodeBasicDepartmentSelect,
  INocodeBasicSubform: typeof INocodeBasicSubform === 'undefined' ? undefined : INocodeBasicSubform,
  INocodePremiumPhoneInput: typeof INocodePremiumPhoneInput === 'undefined' ? undefined : INocodePremiumPhoneInput,
  INocodePremiumAddress: typeof INocodePremiumAddress === 'undefined' ? undefined : INocodePremiumAddress,
  INocodePremiumRate: typeof INocodePremiumRate === 'undefined' ? undefined : INocodePremiumRate,
  INocodePremiumPosition: typeof INocodePremiumPosition === 'undefined' ? undefined : INocodePremiumPosition,
  IEpCollectionTag: typeof IEpCollectionTag === 'undefined' ? undefined : IEpCollectionTag,
  INocodePremiumRichTextEditor: typeof INocodePremiumRichTextEditor === 'undefined' ? undefined : INocodePremiumRichTextEditor,
  INocodePremiumMarkdownEditor: typeof INocodePremiumMarkdownEditor === 'undefined' ? undefined : INocodePremiumMarkdownEditor,
  INocodePremiumImageUploader: typeof INocodePremiumImageUploader === 'undefined' ? undefined : INocodePremiumImageUploader,
  INocodePremiumFileUploader: typeof INocodePremiumFileUploader === 'undefined' ? undefined : INocodePremiumFileUploader,
  INocodePremiumSwitch: typeof INocodePremiumSwitch === 'undefined' ? undefined : INocodePremiumSwitch,
  INocodePremiumSearchForm: typeof INocodePremiumSearchForm === 'undefined' ? undefined : INocodePremiumSearchForm,
  INocodePremiumHyperlink: typeof INocodePremiumHyperlink === 'undefined' ? undefined : INocodePremiumHyperlink,
  INocodePremiumAutoCompute: typeof INocodePremiumAutoCompute === 'undefined' ? undefined : INocodePremiumAutoCompute,
  IAntDesignEditOutlined: typeof IAntDesignEditOutlined === 'undefined' ? undefined : IAntDesignEditOutlined,
  INocodeRelatedSelectData: typeof INocodeRelatedSelectData === 'undefined' ? undefined : INocodeRelatedSelectData,
  INocodeRelatedRelatedData: typeof INocodeRelatedRelatedData === 'undefined' ? undefined : INocodeRelatedRelatedData,
  INocodeBasicTitleBar: typeof INocodeBasicTitleBar === 'undefined' ? undefined : INocodeBasicTitleBar,
  INocodeBasicImageText: typeof INocodeBasicImageText === 'undefined' ? undefined : INocodeBasicImageText,
  INocodeBasicMultipleTabs: typeof INocodeBasicMultipleTabs === 'undefined' ? undefined : INocodeBasicMultipleTabs,
}

const buildFormFieldType = (item: FormFieldTypeCatalogItem): FormFieldType => ({
  type: item.type,
  get name() {
    return i18next.t(item.nameKey)
  },
  icon: item.iconName ? formFieldTypeIconMap[item.iconName] : undefined,
})

export const allFormFieldTypes: FormFieldTypes = formFieldTypeCatalog.map(group => ({
  get category() {
    return i18next.t(group.categoryKey)
  },
  children: group.children.map(buildFormFieldType),
}))
