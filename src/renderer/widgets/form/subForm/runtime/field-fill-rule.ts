type FieldFillCondition = {
  value?: string;
};

type FieldFillTarget = {
  fillWidget?: string;
  linkageField?: string;
};

type FieldFillWidget = {
  fillWidget?: string;
  linkageSubFields?: readonly FieldFillTarget[];
};

type FieldFillRule = {
  id?: string;
  conditions?: readonly FieldFillCondition[];
  subTableSetting?: {
    conditions?: readonly FieldFillCondition[];
  };
  fillWidgets?: readonly FieldFillWidget[];
};

export type RuntimeFieldFillTarget = {
  fieldId: string;
  widgetId: string;
  linkageField: string;
};

export type RuntimeFieldFillBinding<T extends FieldFillRule = FieldFillRule> = {
  id: string;
  rule: T;
  sourceFields: string[];
  targetFields: string[];
  targets: RuntimeFieldFillTarget[];
};

export const compileRuntimeFieldFillBindings = <T extends FieldFillRule>(
  subFormId: string,
  rules: readonly T[],
  resolveFieldId: (widgetId: string) => string | undefined,
): RuntimeFieldFillBinding<T>[] => {
  return rules.flatMap((rule, ruleIndex) => {
    const targets = (rule.fillWidgets || [])
      .filter(item => item.fillWidget === subFormId)
      .flatMap(item => item.linkageSubFields || [])
      .map(item => {
        const fieldId = item.fillWidget ? resolveFieldId(item.fillWidget) : undefined;
        if (!fieldId || !item.fillWidget || !item.linkageField) return null;
        return { fieldId, widgetId: item.fillWidget, linkageField: item.linkageField };
      })
      .filter((target): target is RuntimeFieldFillTarget => !!target);
    if (!targets.length) return [];

    const conditions = [
      ...(rule.conditions || []),
      ...(rule.subTableSetting?.conditions || []),
    ];
    const sourceFields = conditions.reduce<string[]>((fieldIds, condition) => {
      const [ownerId, widgetId] = condition.value?.split(".") || [];
      if (ownerId !== subFormId || !widgetId) return fieldIds;
      const fieldId = resolveFieldId(widgetId);
      if (fieldId && !fieldIds.includes(fieldId)) fieldIds.push(fieldId);
      return fieldIds;
    }, []);

    return [{
      id: rule.id || `${subFormId}:${ruleIndex}`,
      rule,
      sourceFields,
      targetFields: [...new Set(targets.map(target => target.fieldId))],
      targets,
    }];
  });
};
