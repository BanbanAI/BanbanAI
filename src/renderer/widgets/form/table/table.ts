import { getRelatedFields } from "@common/utils/related";
import { OptionFieldUID, FieldUID, OptionTableUID } from "@common/types/project";
import { isSystemField, getUUIDSystemField, SystemField, mappingSystemFieldAlias } from "@common/utils/connection";
import { isProcessTable } from "@common/utils/flow";
import { unique } from "@common/utils/unique";
import { OptionTableValue, DefinedOptions, LogicalOperator, GetOptionOptions } from "@renderer/b2/types";
import { Board } from "@renderer/b2/controllers/board";
import { Widget } from "@renderer/b2/controllers/widget";
import { WidgetSoul } from "@common/types/project";
import { Color } from "@renderer/b2/color";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { isEmpty } from "@common/utils/object";
import { Field, OptionValue, Table as TableType } from "@common/types/project";
import { ref, watch } from "vue";
import { resolveDataSourceSelectionMeta } from "../_common/page-permission";

export type Column = {
  uid: `f_${string}`;
  name: string;
  alias: string;
  subType: string;
  extra?: any;
  subColumns?: Column[];
  isSubColumn?: boolean;
  isSystem?: boolean;
};
type _TableData = {
  rows: object[];
  total: number;
};

const isSubTable = (table: TableType) => {
  return !isEmpty(table.meta?.extra?.primaryTable);
};

const isTableAggregateField = (field: Field) => {
  return Boolean(field.meta?.extra?.tableAggregateField);
};

const buildRuntimeDataOwnerField = (): Field =>
  ({
    uid: SystemField.DATA_OWNER,
    alias: mappingSystemFieldAlias(SystemField.DATA_OWNER),
    type: "string",
    meta: {
      name: SystemField.DATA_OWNER,
      uid: SystemField.DATA_OWNER,
      subType: "account",
      extra: {},
      isSystem: true,
    },
  }) as unknown as Field;

const getRuntimeTableFields = (table: TableType) => {
  const fields = (table?.fields || []).filter(
    (field) =>
      !isTableAggregateField(field) &&
      (!isSubTable(table) || field.meta?.name !== SystemField.DATA_OWNER),
  );
  if (
    isSubTable(table) ||
    fields.some((field) => field.meta?.name === SystemField.DATA_OWNER)
  ) {
    return fields;
  }
  return [...fields, buildRuntimeDataOwnerField()];
};

export class Table extends Widget {
  static resource = resource;

  get defaultName() {
    return i18next.t("defaultName");
  }

  static defineOptions(): DefinedOptions[] {
    return [
      {
        style: {
          basic: {
            fold: "unfold",
            children: [
              {
                name: "fluid-size",
                children: [
                  {
                    name: "fluid-height-type",
                    default: "adaptive",
                  },
                ],
              },
              {
                name: "grid-width",
                default: 60,
              },
              {
                name: "grid-height",
                default: 30,
              },
              {
                name: "table-view-meta",
                visible: false,
              },
              {
                name: "grid-width-proportion",
                alias: "",
                type: "select(radioGroup)",
                default: 0.25,
                visible: (widget: Widget) => {
                  return (
                    widget.parent.layout !== "fluid" &&
                    widget.getOption<"proportion" | "customize">(
                      "grid-width-option",
                    ) === "proportion"
                  );
                },
                selectChoices: [
                  { label: "1/2", value: 0.5 },
                  { label: i18next.t("fullRow"), value: 1 },
                ],
              },
              {
                name: "grid-width",
                alias: "",
                type: `number(unit=${i18next.t("unitGrid")},min=30,max=60,showInput)`,
                default: 60,
                visible: (widget: Widget) => {
                  return (
                    widget.parent.layout !== "fluid" &&
                    widget.getOption<"proportion" | "customize">(
                      "grid-width-option",
                    ) === "customize"
                  );
                },
              },
            ],
          },
        },
        data: {
          fields: {
            fold: "unfold",
            alias: i18next.t("dataSourceForm"),
            children: [
              {
                name: "form-table",
                alias: i18next.t("form"),
                type: "table(max=1)",
              },
              {
                name: "showFields",
                alias: i18next.t("displayFields"),
                type: "check-select(multiple,tree,allCheck)",
                selectChoices: (widget: Table | any) => {
                  const options = widget.selectShowFieldsOptions.map((f) => {
                    if (!isEmpty(f.subColumns)) {
                      return {
                        label: f.alias,
                        value: f.uid as string,
                        subType: f.subType,
                        children: f.subColumns.map((sf) => {
                          return {
                            label: sf.alias,
                            value: sf.uid as string,
                            subType: sf.subType,
                          };
                        }),
                      };
                    }
                    return {
                      label: f.alias,
                      value: f.uid as string,
                      subType: f.subType,
                    };
                  });
                  return options as any[];
                },
                default: (widget: Table) => {
                  return widget.selectTableFields
                    .filter(
                      (f) => !isSystemField(f) && !isTableAggregateField(f),
                    )
                    .map((f) => f.uid);
                },
              },
              {
                name: "hidden-fields-uid", // 保存未选中的字段uid
                visible: false,
              },
            ],
          },
        },
      },
      ...super.defineOptions(),
    ];
  }

  get nocodeId() {
    return (
      resolveDataSourceSelectionMeta(this.getBoard(), this.formTableUID)
        .nocodeId || this.getBoard().nocodeId
    );
  }

  constructor(soul: WidgetSoul, parent: Widget | Board) {
    super(soul, parent);
    this.effectScope.run(() => {
      watch(
        () => this.formTableUID,
        (val) => {
          if (isEmpty(val)) {
            this.setOption("showFields", []);
          }
        },
      );
    });
  }

  get formTableUID(): OptionTableUID {
    return this.getOption<OptionTableValue[]>("form-table")?.[0]?.uid;
  }

  get tableViewMeta() {
    return this.getOption("table-view-meta");
  }
  set tableViewMeta(meta: any) {
    this.setOption("table-view-meta", meta);
  }

  private getFormTableConnection() {
    return resolveDataSourceSelectionMeta(this.getBoard(), this.formTableUID)
      .connection;
  }

  private getFormTableTable() {
    return resolveDataSourceSelectionMeta(this.getBoard(), this.formTableUID)
      .table;
  }

  get selectTableFields() {
    if (!isEmpty(this.formTableUID)) {
      const table = this.getFormTableTable();
      return table?.fields || [];
    }
    return [];
  }

  get selectShowFieldsOptions(): Column[] {
    if (!isEmpty(this.formTableUID)) {
      const [, tableUID] = this.formTableUID;
      const connection = this.getFormTableConnection();
      const table = this.getFormTableTable();
      if (!connection || !table) return [];

      const tableFields = getRuntimeTableFields(table);
      const { baseFields, subFields } = tableFields.reduce<{
        baseFields: Field[];
        subFields: Field[];
      }>(
        (prev, f) => {
          if (isSystemField(f)) {
            if (
              (
                [SystemField.CREATE_OWNER, SystemField.DATA_OWNER] as string[]
              ).includes(f.meta.name)
            ) {
              f.meta.subType = "account";
            }
          }
          if (f.meta.subType === "subForm") {
            prev.subFields.push(f);
          } else {
            prev.baseFields.push(f);
          }
          return prev;
        },
        { baseFields: [], subFields: [] },
      );
      const startSystemFields: string[] = [
        SystemField.UUID,
        SystemField.DATA_TITLE,
      ];
      const showSystemFields: string[] = [
        // SystemField.DATA_TITLE,
        SystemField.CREATE_OWNER,
        ...(!isSubTable(table) ? [SystemField.DATA_OWNER] : []),
        SystemField.CREATE_TIME,
        SystemField.UPDATE_TIME,
      ];
      const processFields: string[] = [
        SystemField.STATUS,
        SystemField.CURRENT_NODE,
        SystemField.CURRENT_OWNER,
      ];
      const relatedFields = getRelatedFields(connection, table);
      if (!isEmpty(relatedFields)) {
        showSystemFields.unshift(SystemField.RELATED_SUB_FORM);
      }

      if (isProcessTable(connection?.formOptions?.[tableUID])) {
        showSystemFields.push(...processFields);
      }

      const startOptions = startSystemFields
        .map((name) => {
          const field = baseFields.find((f) => f.meta.name === name);
          if (!field) return null;
          return {
            alias: field.alias,
            uid: `${field.uid}`,
            isSystem: true,
            name: field.meta?.name,
            subType: field.meta?.subType,
          };
        })
        ?.filter(Boolean);

      const baseOptions = baseFields
        .filter(
          (f) => !isSystemField(f) || f.meta.name === SystemField.DATA_TITLE,
        )
        .map((f) => {
          return {
            alias: f.alias,
            uid: `${f.uid}`,
            name: f.meta?.name,
            subType: f.meta?.subType,
          };
        });
      const showSystemOptions = showSystemFields
        .map((name) => {
          const field = baseFields.find((f) => f.meta.name === name);
          if (!field) {
            if (name === SystemField.RELATED_SUB_FORM) {
              return {
                alias: mappingSystemFieldAlias(SystemField.RELATED_SUB_FORM),
                uid: SystemField.RELATED_SUB_FORM,
                name: SystemField.RELATED_SUB_FORM,
                isSystem: true,
                subType: "relatedSubForm",
              };
            }
            return null;
          }
          return {
            alias: field.alias,
            uid: `${field.uid}`,
            isSystem: true,
            subType: field.meta?.subType,
          };
        })
        ?.filter(Boolean);

      const subOptions = subFields.map((f) => {
        const subTable = connection.tables.find(
          (t) => t.uid === f.meta?.extra?.subTableUID?.[1],
        );
        const uuidField = getUUIDSystemField(subTable?.fields || []);
        const subChildren =
          subTable?.fields
            ?.filter((f) => !isSystemField(f))
            .map((sf) => {
              return {
                alias: `${sf.alias}`,
                uid: `${sf.uid}`,
                name: sf.meta?.name,
                subType: sf.meta?.subType,
              };
            }) ?? [];
        return {
          alias: `${f.alias}`,
          uid: `${f.uid}`,
          subType: f.meta?.subType,
          name: f.meta?.name,
          subColumns: [
            {
              alias: uuidField?.alias,
              uid: uuidField?.uid,
              isSystem: true,
              subType: "string",
            },
            ...subChildren,
          ],
        };
      });
      // 保持表头的顺序
      const tableFildsOptions = table.fields
        .map((f) => {
          return (
            baseOptions.find((b) => b.uid === f.uid) ||
            subOptions.find((s) => s.uid === f.uid)
          );
        })
        .filter((f) => f);

      // 系统字段放到最后，标题保留在最前面
      return [
        ...startOptions,
        ...tableFildsOptions,
        ...showSystemOptions,
      ] as Column[];
    }
    return [];
  }

  get subFormTableFields() {
    return this.selectTableFields
      .filter((f) => f.meta?.subType === "subForm")
      .map((f) => {
        const connection = this.getFormTableConnection();
        const subTable = connection?.tables?.find(
          (t) => t.uid === f.meta?.extra?.subTableUID?.[1],
        );
        return {
          fieldUID: f.uid,
          relationKey: subTable?.fields?.find(
            (f) => f.meta.name === SystemField.KEY,
          )?.uid,
          subFields: subTable?.fields,
          subTableUID: f.meta.extra?.subTableUID,
        };
      });
  }

  get hiddenFieldsUid() {
    return this.getOption("hidden-fields-uid") || [];
  }
  set hiddenFieldsUid(val: string[]) {
    this.setOption("hidden-fields-uid", val);
  }

  get preFilterRule() {
    return {
      logic: LogicalOperator.AND,
      conditions: this.getFilterConditions(),
    };
  }

  override getOption<T extends OptionValue>(
    paths: string | string[],
    options?: GetOptionOptions,
  ) {
    const path = Array.isArray(paths) ? paths.at(-1) : paths;
    if (["showFields"].includes(path)) {
      if (!isEmpty(this.selectTableFields)) {
        let curFields = super.getOption<T>(paths, options) as string[];
        let selectFormAllFieldsUID = [];
        this.selectShowFieldsOptions.forEach((f) => {
          selectFormAllFieldsUID.push(f.uid);
          if (f.subColumns) {
            selectFormAllFieldsUID = selectFormAllFieldsUID.concat(
              f.subColumns.map((f) => f.uid),
            );
          }
        });
        const oldAllFieldsUID = [...curFields, ...this.hiddenFieldsUid];

        const hasNewFields = selectFormAllFieldsUID.filter(
          (uid: `f_${string}`) => !oldAllFieldsUID.includes(uid),
        );
        const hasDeleteFields = oldAllFieldsUID.filter(
          (uid: `f_${string}`) => !selectFormAllFieldsUID.includes(uid),
        );
        if (isEmpty(hasNewFields) && isEmpty(hasDeleteFields))
          return super.getOption<T>(paths, options);

        // 字段有新增,将新增的字段加入showFields
        for (const uid of hasNewFields) {
          curFields = [...curFields, uid];
        }

        // 字段删除
        for (const uid of hasDeleteFields) {
          if (curFields.includes(uid)) {
            curFields = curFields.filter((fuid) => fuid !== uid);
          }
          if (this.hiddenFieldsUid.includes(uid)) {
            this.hiddenFieldsUid = this.hiddenFieldsUid.filter(
              (fuid) => fuid !== uid,
            );
          }
        }

        return curFields as T;
      }
    }
    return super.getOption<T>(paths, options);
  }

  override setOption(
    paths: string | string[],
    value: OptionValue,
    history?: boolean,
  ): void {
    const path = Array.isArray(paths) ? paths.at(-1) : paths;

    if (["showFields"].includes(path)) {
      if (value) {
        let allFieldsUIDs = [];
        this.selectShowFieldsOptions.forEach((f) => {
          allFieldsUIDs.push(f.uid);
          if (f.subColumns) {
            allFieldsUIDs = allFieldsUIDs.concat(
              f.subColumns.map((f) => f.uid),
            );
          }
        });
        // 获取是添加还是删除项
        const hasAddFields = (value as string[]).filter(
          (f) => !this.getOption<string[]>("showFields").includes(f),
        );
        const hasDeleteFields = this.getOption<string[]>("showFields").filter(
          (f) => !(value as string[]).includes(f),
        );

        if (!isEmpty(hasAddFields)) {
          // 获取当前子表单项的fields
          const selectSubFields = this.subFormTableFields.filter((f) =>
            hasAddFields.includes(f.fieldUID),
          );
          const selectColumns = this.selectShowFieldsOptions.filter((fc) =>
            selectSubFields.some((f) => f.fieldUID === fc.uid),
          );

          if (!isEmpty(selectColumns)) {
            selectColumns.forEach((sc) => {
              // 选中了当前子表单，其子项全部变成选中状态
              if ((value as string[]).includes(sc.uid)) {
                sc.subColumns.forEach((childrenItem) => {
                  if (!(value as string[]).includes(childrenItem.uid)) {
                    (value as string[]).push(childrenItem.uid);
                  }
                });
              }
            });
          }

          // 子表单的子项全部选中时，添加子表单项
          const allSubCloumns = this.selectShowFieldsOptions.filter(
            (f) => f.subColumns,
          );
          allSubCloumns.forEach((f) => {
            const fChildrenUID = f.subColumns.map((f) => f.uid);
            if (
              fChildrenUID.every((fcu) => (value as string[]).includes(fcu)) &&
              !(value as string[]).includes(f.uid)
            ) {
              (value as string[]).push(f.uid);
            }
          });
        }

        // 删除子表单
        if (!isEmpty(hasDeleteFields)) {
          const deleteSubFields = this.subFormTableFields.filter((f) =>
            hasDeleteFields.includes(f.fieldUID),
          );
          const deleteColumns = this.selectShowFieldsOptions.filter((fc) =>
            deleteSubFields.some((f) => f.fieldUID === fc.uid),
          );

          // 删除子表单项，其子项全部删除
          if (!isEmpty(deleteColumns)) {
            const deleteSubChildrem = deleteColumns[0].subColumns.map(
              (f) => f.uid,
            );
            value = (value as string[]).filter(
              (f) => !deleteSubChildrem.includes(f as FieldUID),
            );
          }

          // 删除子表单中的某个项，子表单项的选中删除
          const allSubCloumns = this.selectShowFieldsOptions.filter(
            (f) => f.subColumns,
          );
          allSubCloumns.forEach((f) => {
            if (
              f.subColumns.find((fc) => hasDeleteFields.includes(fc.uid)) &&
              (value as string[]).includes(f.uid)
            ) {
              value = (value as string[]).filter((v) => v !== f.uid);
            }
          });
        }

        this.hiddenFieldsUid = allFieldsUIDs.filter(
          (f) => !(value as string[]).some((s) => s === f),
        );
      }
    }
    return super.setOption(paths, value, history);
  }
}
