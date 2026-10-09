import { DefinedOptions } from "@renderer/b2/types";
import { TheWidget as SymbolColumn } from "@renderer/widgets/echarts/colum-symbol";
import i18next from "@renderer/widgets/i18next";
import resource from "./locales";
import { recursive } from "merge";

export class SymbolBar extends SymbolColumn {
  static resource = recursive(true, SymbolColumn.resource, resource);

  static defineOptions(): DefinedOptions[] {
    return [
      {
        style: {
          "axis": {
            children: [
              {
                name: "x-display-cluster",
                children: [
                  {
                    name: "x-data-type",
                    default: "value"
                  }
                ]
              },
              {
                name: "y-display-cluster",
                children: [
                  {
                    name: "y-data-type",
                    default: "category"
                  }
                ]
              }
            ]
          }
        }
      },
      ...super.defineOptions()
    ]
  }

  get transposed() {
    return true;
  }
}
