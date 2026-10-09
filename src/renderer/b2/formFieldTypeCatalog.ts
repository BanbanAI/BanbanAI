export type FormFieldTypeCatalogItem = {
  type: string
  nameKey: string
  iconName?: string
}

export type FormFieldTypeCatalogGroup = {
  categoryKey: string
  children: FormFieldTypeCatalogItem[]
}

export const formFieldTypeCatalog: FormFieldTypeCatalogGroup[] = [
  {
    categoryKey: 'formFieldTypes.basicField',
    children: [
      { type: 'widget.form.textInput', nameKey: 'formFieldTypes.textInput', iconName: 'INocodeBasicTextInput' },
      { type: 'widget.form.textarea', nameKey: 'formFieldTypes.textarea', iconName: 'INocodeBasicTextarea' },
      { type: 'widget.form.numberInput', nameKey: 'formFieldTypes.numberInput', iconName: 'INocodeBasicNumberInput' },
      { type: 'widget.form.amountInput', nameKey: 'formFieldTypes.amountInput', iconName: 'INocodeBasicAmountInput' },
      { type: 'widget.form.serialNumber', nameKey: 'formFieldTypes.serialNumber', iconName: 'INocodeBasicSerialNumber' },
      { type: 'widget.form.datePicker', nameKey: 'formFieldTypes.datePicker', iconName: 'INocodeBasicDatePicker' },
      { type: 'widget.form.dateRangePicker', nameKey: 'formFieldTypes.dateRangePicker', iconName: 'INocodeBasicDateRangePicker' },
      { type: 'widget.form.timePicker', nameKey: 'formFieldTypes.timePicker', iconName: 'INocodeBasicTimePicker' },
      { type: 'widget.form.radioGroup', nameKey: 'formFieldTypes.radioGroup', iconName: 'INocodeBasicRadioGroup' },
      { type: 'widget.form.checkboxGroup', nameKey: 'formFieldTypes.checkboxGroup', iconName: 'INocodeBasicCheckboxGroup' },
      { type: 'widget.form.treeSelect', nameKey: 'formFieldTypes.treeSelect', iconName: 'INocodeBasicTreeSelect' },
      { type: 'widget.form.treeMultipleSelect', nameKey: 'formFieldTypes.treeMultipleSelect', iconName: 'INocodeBasicTreeMultipleSelect' },
      { type: 'widget.form.memberSelect', nameKey: 'formFieldTypes.memberSelect', iconName: 'INocodeBasicMemberSelect' },
      { type: 'widget.form.departmentSelect', nameKey: 'formFieldTypes.departmentSelect', iconName: 'INocodeBasicDepartmentSelect' },
      { type: 'widget.form.subform', nameKey: 'formFieldTypes.subForm', iconName: 'INocodeBasicSubform' },
    ],
  },
  {
    categoryKey: 'formFieldTypes.advancedField',
    children: [
      { type: 'widget.form.phoneInput', nameKey: 'formFieldTypes.phoneInput', iconName: 'INocodePremiumPhoneInput' },
      { type: 'widget.form.address', nameKey: 'formFieldTypes.address', iconName: 'INocodePremiumAddress' },
      { type: 'widget.form.rate', nameKey: 'formFieldTypes.rate', iconName: 'INocodePremiumRate' },
      { type: 'widget.form.position', nameKey: 'formFieldTypes.position', iconName: 'INocodePremiumPosition' },
      { type: 'widget.form.tagInput', nameKey: 'formFieldTypes.tagInput', iconName: 'IEpCollectionTag' },
      { type: 'widget.form.richTextEditor', nameKey: 'formFieldTypes.richTextEditor', iconName: 'INocodePremiumRichTextEditor' },
      { type: 'widget.form.markdownEditor', nameKey: 'formFieldTypes.markdownEditor', iconName: 'INocodePremiumMarkdownEditor' },
      { type: 'widget.form.image-uploader', nameKey: 'formFieldTypes.imageUploader', iconName: 'INocodePremiumImageUploader' },
      { type: 'widget.form.file-uploader', nameKey: 'formFieldTypes.fileUploader', iconName: 'INocodePremiumFileUploader' },
      { type: 'widget.form.switch', nameKey: 'formFieldTypes.switch', iconName: 'INocodePremiumSwitch' },
      { type: 'widget.form.searchForm', nameKey: 'formFieldTypes.searchForm', iconName: 'INocodePremiumSearchForm' },
      { type: 'widget.form.hyperlink', nameKey: 'formFieldTypes.hyperlink', iconName: 'INocodePremiumHyperlink' },
      { type: 'widget.form.autoCompute', nameKey: 'formFieldTypes.autoCompute', iconName: 'INocodePremiumAutoCompute' },
      { type: 'widget.form.handwrittenSignature', nameKey: 'formFieldTypes.handwrittenSignature', iconName: 'IAntDesignEditOutlined' },
    ],
  },
  {
    categoryKey: 'formFieldTypes.relationField',
    children: [
      { type: 'widget.form.selectData', nameKey: 'formFieldTypes.selectData', iconName: 'INocodeRelatedSelectData' },
      { type: 'widget.form.relatedData', nameKey: 'formFieldTypes.relatedData', iconName: 'INocodeRelatedRelatedData' },
    ],
  },
  {
    categoryKey: 'formFieldTypes.layoutField',
    children: [
      { type: 'widget.form.titleBar', nameKey: 'formFieldTypes.titleBar', iconName: 'INocodeBasicTitleBar' },
      { type: 'widget.form.imageTextShow', nameKey: 'formFieldTypes.imageTextShow', iconName: 'INocodeBasicImageText' },
      { type: 'widget.form.multipleTabs', nameKey: 'formFieldTypes.multipleTabs', iconName: 'INocodeBasicMultipleTabs' },
    ],
  },
]
