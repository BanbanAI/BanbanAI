import { WidgetTemplateList } from "@common/types/project";
import type { BuiltinWidgetManifest } from "@main/modules/widgets/builtin-widget-registry";
const formWidgetsType = ["widget.form.table", "widget.form.viewtable", "widget.form.pivot-table"];
export const handleTemplateTree = (templates: WidgetTemplateList, _formWidgets: BuiltinWidgetManifest[]): WidgetTemplateList => {
  const formWidgets = _formWidgets.filter(widget => formWidgetsType.includes(widget.name));
  const widgetTemplateList: WidgetTemplateList = [
    {
      type: 'chart',
      label: global.i18next.t("widgetTemplateTs.chart"),
      img: 'group-free.svg',
      children: []
    },
    {
      label: global.i18next.t("widgetTemplateTs.text"),
      img: 'group-premium.svg',
      type: 'text',
      children: []
    },
    {
      label: global.i18next.t("widgetTemplateTs.media"),
      img: 'group-media.svg',
      type: 'media',
      children: [],
    },
    {
      label: global.i18next.t("widgetTemplateTs.control"),
      img: 'group-other.svg',
      type: 'control',
      children: []
    },
    {
      label: global.i18next.t("widgetTemplateTs.form"),
      img: 'group-other.svg',
      type: 'form',
      children: [
        {
          type: "form-default",
          label: global.i18next.t("widgetTemplateTs.default"),
          children: formWidgets.map(widget => {
            return {
              type: widget.name,
              alias: widget.displayName,
              image: widget.cover || '',
              category: global.i18next.t("widgetTemplateTs.form"),
            }
          })
        }
      ],
    },
  ];
  for (const category of templates) {
    const targetCategory = widgetTemplateList.find(categoryItem => categoryItem.type === category.type);
    if (targetCategory) {
      targetCategory.children = category.children;
      if (category.series) {
        targetCategory.series = category.series;
      }
    } else {
      widgetTemplateList.push({ ...category, img: 'group-expanded.svg' } as any);
    }
  }
  return widgetTemplateList;
}
