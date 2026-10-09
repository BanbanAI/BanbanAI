export * from './B2Form.vue'
import component from './B2Form.vue'
export default component
export {
  component,
}
import FormDefaultValueDialog from './B2FormDefaultValueDialog.vue'
import {  getFormulaFieldValues, getPeerSubfieldWithColumnCompute, getQuoteFieldLastChange, hasFormulaWidgetInited, processFormulaResult, refreshSearchFormCacheIfNeeded, buildFormulaValueMap } from "./function";
import { useFormulaWatcher } from './useFormulaWatcher'
export {
  FormDefaultValueDialog,
  getFormulaFieldValues,
  getQuoteFieldLastChange,
  getPeerSubfieldWithColumnCompute,
  processFormulaResult,
  hasFormulaWidgetInited,
  refreshSearchFormCacheIfNeeded,
  buildFormulaValueMap,
  useFormulaWatcher
}
export { Form as TheWidget } from "./form";