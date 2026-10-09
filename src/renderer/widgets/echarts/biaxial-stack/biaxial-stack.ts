import { DefinedOptions } from "@renderer/b2/types";
import { TheWidget as Biaxial, component as B2Biaxial } from "@renderer/widgets/echarts/biaxial";
import i18next from "@renderer/widgets/i18next";
import resource from "./locales";
import {recursive } from "merge";

export class BiaxialStack extends Biaxial {
  static resource = recursive(true, Biaxial.resource, resource);

  get stack(): boolean {
      return true;
  }

}
