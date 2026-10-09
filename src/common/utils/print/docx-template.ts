import { PrintTemplateType } from "@common/types/nocode";
import type { PrintTemplate } from "@common/types/nocode";
import type { Field, Row } from "@common/types/project";
import { isEmpty } from "@common/utils/object";
import Docxtemplater from "../docxTemplate/docxTemplate";
import type { Options } from "../docxTemplate/docxTemplate";
import PizZip from "pizzip";
import DocxMerger from "docx-merger";
import { formatRowData } from "./format-row-data";
import type { FormatRowDataContext } from "./format-row-data";

type ReplaceDocxTemplateOptions = Options & FormatRowDataContext;

export const replaceDocxTemplate = async (
  template: PrintTemplate,
  templateBuffer: ArrayBuffer,
  rowData: Row[],
  fields?: Field[],
  options?: ReplaceDocxTemplateOptions,
) => {
  if (isEmpty(rowData)) {
    throw new Error('data is empty')
  }
  try {
    if (template.type !== PrintTemplateType.WORD) {
      throw new Error('template math a docx file')
    }
    // 格式化数据
    const { formOptions, formTableUID, ...docOptions } = options || {};
    rowData = formatRowData(rowData, fields, {
      formOptions,
      formTableUID,
    })
    const start = '${'
    const end = '}'
    const docArr = []
    if (options?.mergePrint) {
      const templatezip = new PizZip(templateBuffer);
      const doc = new Docxtemplater(templatezip, {
        delimiters: { start, end },
        paragraphLoop: true, // 循环遍历段落中的变量
        linebreaks: true, // 自动转换换行符
        ...docOptions,
      });
      await doc.render(rowData, fields)
      docArr.push(doc.toArrayBuffer())
    } else {
      for (let i = 0; i < rowData.length; i++) {
        const row = rowData[i];
        const templatezip = new PizZip(templateBuffer);
        const doc = new Docxtemplater(templatezip, {
          delimiters: { start, end },
          paragraphLoop: true, // 循环遍历段落中的变量
          linebreaks: true, // 自动转换换行符
          ...docOptions,
        });
        await doc.render(row, fields)
        docArr.push(doc.toArrayBuffer())
      }
    }
    const docx = new DocxMerger(
      {
        pageBreak: true,
      },
      docArr,
    )

    return new Promise((resolve) => {
      docx.save('arraybuffer', (arraybuffer)=> {
        resolve([arraybuffer])
      })
    })
  } catch (error) {
    console.error(error, template)
    throw error as Error
  }
}
