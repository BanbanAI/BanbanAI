import i18next from "i18next"

export const filedType = [
  {
    get name(){return i18next.t('formulaTypes.position')},
    filed: ['widget.form.position'],
    color: '#FF4D4F'
  },
  {
    get name(){return i18next.t('formulaTypes.departmentSelect')},
    filed: ['widget.form.departmentSelect'],
    color: '#FF7033'
  },
  {
    get name(){return i18next.t('formulaTypes.memberSelect')},
    filed: ['widget.form.memberSelect'],
    color: '#F24EA0'
  },
  {
    get name(){return i18next.t('formulaTypes.numberInput')},
    filed: ['widget.form.numberInput', 'widget.form.rate', 'widget.form.autoCompute'],
    color: '#FAAD14'
  },
  {
    get name(){return i18next.t('formulaTypes.datePicker')},
    filed: ['widget.form.datePicker'],
    color: '#52C41A'
  },
  {
    get name(){return i18next.t('formulaTypes.textInput')},
    filed: ['widget.form.textInput', 'widget.form.textarea', 'widget.form.serialNumber', 'widget.form.radioGroup', 'widget.form.treeSelect', 'widget.form.phoneInput'],
    color: '#1890FF'
  },
  {
    get name(){return i18next.t('formulaTypes.array')},
    filed: ['widget.form.dateRangePicker', 'widget.form.checkboxGroup', 'widget.form.treeMultipleSelect', 'widget.form.dateRangePicker', ],
    color: '#9367EB'
  },
  {
    get name(){return i18next.t('formulaTypes.boolean')},
    filed: ['widget.form.switch'],
    color: '#337ECC'
  },
]

