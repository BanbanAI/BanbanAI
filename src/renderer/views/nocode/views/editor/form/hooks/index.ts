import { Connection, Field, FormOption, ProcessFlow, Row, Table, } from "@common/types/project";
import { FormElement } from "@renderer/b2/controllers/form";
import { WidgetSoul } from "@common/types/project";
import { provide, InjectionKey, Ref, inject, ComputedRef } from "vue";
import { Branch, ProcessNode } from "../process/process";
import { FormElementInfo, NocodeFormData } from "@common/types/nocode";
import { BaseWidget } from "@renderer/b2/controllers/widget";

const FORM_CONNECTION: InjectionKey<Ref<NocodeFormData>> = Symbol("FORM_CONNECTION");
const FORM_TABLE: InjectionKey<Ref<Table>> = Symbol("FORM_TABLE");
const FORM_OPTION: InjectionKey<Ref<FormOption>> = Symbol("FORM_OPTION");
const IS_EXIST_CONTAINER: InjectionKey<Ref<boolean>> = Symbol("IS_EXIST_CONTAINER");
const DRAGGABLE_INDEX: InjectionKey<Ref<number>> = Symbol("DRAGGABLE_INDEX");
const FORM_WIDGET: InjectionKey<Ref<BaseWidget>> = Symbol("FORM_WIDGET");
const RENDER_WIDGETS: InjectionKey<Ref<WidgetSoul[]>> = Symbol("RENDER_WIDGETS");
const FORM_WIDGET_ROWS: InjectionKey<Ref<FormElement[][]>> = Symbol("FORM_WIDGET_ROWS");
const IS_DRAG: InjectionKey<Ref<boolean>> = Symbol("IS_DRAG");
export type FormPointerDragSession = {
  source: 'catalog' | 'form';
  widgetSoul: WidgetSoul;
  pointerId: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  moved: boolean;
  originIndex: number;
  sourceElement?: HTMLElement;
  offsetX: number;
  offsetY: number;
};
const POINTER_DRAG: InjectionKey<Ref<FormPointerDragSession | null>> = Symbol("POINTER_DRAG");
const POINTER_DRAG_CLICK_SUPPRESSED: InjectionKey<Ref<boolean>> = Symbol("POINTER_DRAG_CLICK_SUPPRESSED");
const ACTIVE_NODE: InjectionKey<ComputedRef<ProcessNode>> = Symbol("ACTIVE_NODE");
const FORM_FIELDS: InjectionKey<ComputedRef<Field[]>> = Symbol("FORM_FIELDS");
const FORM_ELEMENTS_INFO: InjectionKey<Ref<FormElementInfo[]>> = Symbol("FORM_ELEMENTS_INFO");
const ROOT_BRANCH: InjectionKey<Ref<Branch>> = Symbol("ROOT_BRANCH");
const PRE_ROW: InjectionKey<Row> = Symbol("PRE_ROW");
const PROCESS_STRUCTURE_EDITABLE: InjectionKey<Ref<boolean>> = Symbol("PROCESS_STRUCTURE_EDITABLE");
const FLOW_CANVAS_REF: InjectionKey<Ref<HTMLElement>> = Symbol("FLOW_CANVAS_REF");
const PROCESS_NODE_ISSUE_MAP: InjectionKey<Ref<Record<string, string>>> = Symbol("PROCESS_NODE_ISSUE_MAP");

export const provideFormData = (data: Ref<NocodeFormData>) => {
  return provide(FORM_CONNECTION, data);
}
export const useFormData = () => {
  return inject(FORM_CONNECTION);
}

export const provideFormTable = (data: Ref<Table>) => {
  return provide(FORM_TABLE, data);
}
export const useFormTable = () => {
  return inject(FORM_TABLE);
}

export const provideFormOption = (data: Ref<FormOption>) => {
  return provide(FORM_OPTION, data);
}
export const useFormOption = () => {
  return inject(FORM_OPTION);
}

export const provideIsExistContainer = (data: Ref<boolean>) => {
  return provide(IS_EXIST_CONTAINER, data);
}
export const useIsExistContainer = () => {
  return inject(IS_EXIST_CONTAINER);
}

export const provideDraggableIndex = (data: Ref<number>) => {
  return provide(DRAGGABLE_INDEX, data);
}
export const useDraggableIndex = () => {
  return inject(DRAGGABLE_INDEX)
}

export const provideFormWidget = (data: Ref<BaseWidget>) => {
  return provide(FORM_WIDGET, data);
}
export const useFormWidget = () => {
  return inject(FORM_WIDGET);
}

export const provideRenderWidgets = (data: Ref<any[]>) => {
  return provide(RENDER_WIDGETS, data);
}
export const useRenderWidgets = () => {
  return inject(RENDER_WIDGETS);
}

export const provideFormWidgetRows = (data: Ref<FormElement[][]>) => {
  return provide(FORM_WIDGET_ROWS, data);
}
export const useFormWidgetRows = () => {
  return inject(FORM_WIDGET_ROWS);
}

export const provideIsDrag = (data: Ref<boolean>) => {
  return provide(IS_DRAG, data);
}
export const useIsDrag = () => {
  return inject(IS_DRAG);
}

export const providePointerDrag = (data: Ref<FormPointerDragSession | null>) => {
  return provide(POINTER_DRAG, data);
}
export const usePointerDrag = () => {
  return inject(POINTER_DRAG);
}

export const providePointerDragClickSuppressed = (data: Ref<boolean>) => {
  return provide(POINTER_DRAG_CLICK_SUPPRESSED, data);
}
export const usePointerDragClickSuppressed = () => {
  return inject(POINTER_DRAG_CLICK_SUPPRESSED);
}

export const provideActiveNode = (data: ComputedRef<ProcessNode>) => {
  return provide(ACTIVE_NODE, data);
}

export const useActiveNode = () => {
  return inject(ACTIVE_NODE);
}

export const provideFormFields = (data: ComputedRef<Field[]>) => {
  return provide(FORM_FIELDS, data);
}

export const useFormFields = () => {
  return inject(FORM_FIELDS);
}

export const provideFormElementsInfo = (data: Ref<FormElementInfo[]>) => {
  return provide(FORM_ELEMENTS_INFO, data);
}

export const useFormElementsInfo = () => {
  return inject(FORM_ELEMENTS_INFO);
}

export const provideRootBranch = (data: Ref<Branch>) => {
  return provide(ROOT_BRANCH, data);
}
export const useRootBranch = () => {
  return inject(ROOT_BRANCH);
}

export const providePreRow = (data: Row) => {
  return provide(PRE_ROW, data)
}
export const usePreRow = () => {
  return inject(PRE_ROW);
}

export const provideFlowCanvasRef = (data: Ref<HTMLElement>) => {
  return provide(FLOW_CANVAS_REF, data);
}
export const useFlowCanvasRef = () => {
  return inject(FLOW_CANVAS_REF);
}

export const provideProcessNodeIssueMap = (data: Ref<Record<string, string>>) => {
  return provide(PROCESS_NODE_ISSUE_MAP, data);
}
export const useProcessNodeIssueMap = () => {
  return inject(PROCESS_NODE_ISSUE_MAP);
}

export const provideProcessStructureEditable = (data: Ref<boolean>) => {
  return provide(PROCESS_STRUCTURE_EDITABLE, data);
}

export const useProcessStructureEditable = () => {
  return inject(PROCESS_STRUCTURE_EDITABLE);
}
