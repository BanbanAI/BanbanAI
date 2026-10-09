import getRelsTypes from './utils/get-relation-types'
import DocUtils from './utils/docx-utils'
import PizZip from 'pizzip';
import { Field, Row } from "@common/types/project";
import { isImageField, isMultipleRelated, isNode, isSubForm } from '../other';
import { barcodeStr, fetchPathAsArrayBuffer, getImageDimensions, getKeyArr, getSize, getValue, imageFillAuto, qrcodeStr, type ReplaceExcelTemplateOptions } from '../print/shared';
import { generateBarcode } from '../print/barcode';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { getField, proportionWH } from '../formUtil';
import type { ImageFillType } from '../formUtil/excelUtil';
import { getMaxSubNum, isHasCode, isHasSubForm } from '../formUtil/excelTemplateLoadData/excelTemplateLoadData';
import i18next from 'i18next';
import { unique } from '@common/utils/unique';
import { isPrintFlowCommentFieldKey } from '../print-flow-comments';
import { shouldRenderPrintRowShareQrCode } from '../print-row-share-fields';

const xmlDocumentName = 'word/document.xml'
type integer = number;
interface Part {
  type: string;
  value: string;
  module: string;
  raw: string;
  offset: integer;
  lIndex: integer;
  num: integer;
  inverted?: boolean;
  endLindex?: integer;
  expanded?: Part[];
  subparsed?: Part[];
  position?: string;
  tag?: string;
}

interface ScopeManager {
  getValue(value: string, { part }: { part: Part }): any;
}
interface ParserContext {
  meta: {
    part: Part;
  };
  scopeList: any[];
  scopePath: string[];
  scopePathItem: integer[];
  scopePathLength: integer[];
  num: integer;
}
let ctXML = "[Content_Types].xml";
let relsFile = "_rels/.rels";
interface Parser {
  get(scope: any, context: ParserContext): any;
}
interface Syntax {
  allowUnopenedTag?: boolean;
  allowUnclosedTag?: boolean;
  allowUnbalancedLoops?: boolean;
  changeDelimiterPrefix?: string | null;
}
export type Options = {
  delimiters?: { start: string | null; end: string | null };
  paragraphLoop?: boolean;
  parser?(tag: string): Parser;
  errorLogging?: boolean | string;
  linebreaks?: boolean;
  nullGetter?(part: Part, scopeManager: ScopeManager): any;
  fileTypeConfig?: any;
  warnFn?(errors: Error[]): any;
  syntax?: Syntax;
  stripInvalidXMLChars?: boolean;
} & ReplaceExcelTemplateOptions

const renderablePartPattern = /^word\/(document|header\d+|footer\d+)\.xml$/;

const getRenderablePartNames = (zip: PizZip): string[] => {
  return Object.keys(zip.files)
    .filter((name) => renderablePartPattern.test(name))
    .sort((left, right) => {
      if (left === xmlDocumentName) return -1;
      if (right === xmlDocumentName) return 1;
      return left.localeCompare(right);
    });
};

const getRelsPathForPart = (partName: string): string => {
  const filename = partName.replace(/^word\//, '');
  return `word/_rels/${filename}.rels`;
};

const createRelationshipsDoc = (options?: Options): Document => {
  return DocUtils.str2xml(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>',
    options,
  );
};


function isBuffer(v) {
  return typeof Buffer !== "undefined" && typeof Buffer.isBuffer === "function" && Buffer.isBuffer(v);
}
function zipFileOrder(files) {
  var allFiles = [];
  for (var name in files) {
    allFiles.push(name);
  }
  /*
   * The first files that need to be put in the zip file are :
   * [Content_Types].xml and _rels/.rels
   */
  var resultFiles = [ctXML, relsFile];

  /*
   * The next files that should be in the zip file are :
   *
   * - word/* (ie word/document.xml, word/header1.xml, ...)
   * - xl/* (ie xl/worksheets/sheet1.xml)
   * - ppt/* (ie ppt/slides/slide1.xml)
   */
  var prefixes = ["word/", "xl/", "ppt/"];
  for (var _i8 = 0; _i8 < allFiles.length; _i8++) {
    var _name = allFiles[_i8];
    for (var _i0 = 0; _i0 < prefixes.length; _i0++) {
      var prefix = prefixes[_i0];
      if (_name.indexOf("".concat(prefix)) === 0) {
        resultFiles.push(_name);
      }
    }
  }
  /*
   * Push the rest of files, such as docProps/core.xml and docProps/app.xml
   */
  for (var _i10 = 0; _i10 < allFiles.length; _i10++) {
    var _name2 = allFiles[_i10];
    if (resultFiles.indexOf(_name2) === -1) {
      resultFiles.push(_name2);
    }
  }
  return resultFiles;
}

class TblCellParser {
  id: string;
  doc: XMLDocument;
  tblCellNode: Element;
  tcPrNode: Element;
  constructor(tblCellNode: Element, doc: XMLDocument) {
    this.id = unique();
    this.doc = doc;
    this.tblCellNode = tblCellNode;
     
    this.tcPrNode = this.tblCellNode.getElementsByTagName('w:tcPr')[0];
  }
  get textContent() {
    return this.tblCellNode?.textContent?.trim() || '';
  }
  setStrValue(value: string | ((text: string, rNode: Element) => string)) {
    if(typeof value === 'string') {
      const tNode = this.tblCellNode.getElementsByTagName('w:t')?.[0];
      if (tNode) {
        tNode.textContent = value;
      }
    } else if (typeof value === 'function') {
      const pNodes = this.tblCellNode.getElementsByTagName('w:p');
      if (pNodes.length > 0) {
        for (let i = 0; i < pNodes.length; i++) {
          const pNode = pNodes[i];
          const rNode = pNode.getElementsByTagName('w:r')
          let firstTextNodeItem = null;
          let pText = '';
          const deleteTextNodeArr = []
          for (let j = 0; j < rNode.length; j++) {
            const rNodeItem = rNode[j];
            const tNode = rNodeItem.getElementsByTagName('w:t')?.[0];
            if (!tNode) {
              continue;
            }
            pText += tNode.textContent;
            if (firstTextNodeItem === null) {
              firstTextNodeItem = tNode;
            } else {
              deleteTextNodeArr.push(tNode);
            }
          }
          if (firstTextNodeItem) {
            if (pText !== firstTextNodeItem.textContent) {
              firstTextNodeItem.textContent = pText;
              deleteTextNodeArr.forEach(item => {
                item.parentNode.removeChild(item);
              })
            }
            const ptextStr = value(pText, firstTextNodeItem.parentNode);
            if (ptextStr !== firstTextNodeItem.textContent) {
              firstTextNodeItem.textContent = ptextStr;
            }
          }
        }
      }
    }
  } 
  getBottomCell() {
    const getElementIndex = (element: Element) => {
      const parentNode = element.parentNode;
      if (!parentNode) {
        return -1; // 没有父元素
      }
      return Array.from(parentNode.childNodes).indexOf(element);
    }
    const currentIndex = getElementIndex(this.tblCellNode)
    const nextSibling = this.tblCellNode.parentNode.nextSibling;
    if (!nextSibling) return null;
    return new TblCellParser(nextSibling.childNodes[currentIndex] as Element, this.doc);
  }
  // 获取单元格的合并属性 restart , continue
  get vMergeVal() {
    const vMergeNode = this.tblCellNode.getElementsByTagName('w:vMerge')?.[0];
    if (!vMergeNode) return '';
    return vMergeNode?.getAttribute('w:val');
  }
  get isRestart() {
    return this.vMergeVal === 'restart';
  }
  get isContinue() {
    return this.vMergeVal === 'continue';
  }
  get isMerge() {
    return this.isRestart || this.isContinue
  }
  setVMerge(value: 'restart' | 'continue' = 'restart') {
    const vMergeNode = this.tcPrNode.getElementsByTagName('w:vMerge')?.[0];
    if (vMergeNode) {
      vMergeNode.setAttribute('w:val', value);
    } else {
      const vMergeNode = this.doc.createElement('w:vMerge');
      vMergeNode.setAttribute('w:val', value);
      this.tcPrNode.appendChild(vMergeNode);
    };
  }
}
class TblRowParser {
  id: string;
  doc: XMLDocument;
  tblRowNode: Element;
  tcNodes: Element[] = [];
  tblCells: TblCellParser[] = [];
  textContent: string;
  tblParser: TblParser
  constructor(tblRowNode: Element, tblRowParser: TblParser, doc: XMLDocument) {
    this.id = unique()
    this.doc = doc;
    this.tblRowNode = tblRowNode;
    this.tblParser = tblRowParser;
    if (this.tblRowNode?.childNodes?.length > 0) {
      for (let index = 0; index < this.tblRowNode.childNodes.length; index++) {
        const element = this.tblRowNode.childNodes[index];
        if (element.nodeName === 'w:tc') {
          this.tcNodes.push(element as Element);
          this.tblCells.push(new TblCellParser(element as Element, doc));
        }
      }
    }

    this.textContent = this.tblRowNode?.textContent?.trim() || '';
  }

  clone(subtree: boolean = true) {
    return new TblRowParser(this.tblRowNode.cloneNode(subtree) as Element, this.tblParser, this.doc);
  }

  // 插入行Element
  insertRowAfter(newTblRowParser: TblRowParser | TblRowParser[]) {
    const newTblRowParserArr = Array.isArray(newTblRowParser) ? newTblRowParser : [newTblRowParser];
    for (let i = newTblRowParserArr.length - 1; i >= 0; i--) {
      const newTblRowParser = newTblRowParserArr[i];
      this.tblParser.insertRow(newTblRowParser, this);
    }
  }
  getCell(colNumber: number) {
    return this.tblCells[colNumber];
  }
  forEachCell(callback: (tblCellParser: TblCellParser, index: number, tblCells: TblCellParser[]) => void) {
    for (let i = 0; i < this.tblCells.length; i++) {
      const tblCellParser = this.tblCells[i];
      callback(tblCellParser, i, this.tblCells);
    }
  }

  get nextRow() {
    return new TblRowParser(this.tblRowNode.nextElementSibling as Element, this.tblParser, this.doc);
  }
  get prevRow() {
    return new TblRowParser(this.tblRowNode.previousElementSibling as Element, this.tblParser, this.doc);
  }

  hasRestartCell() {
    return this.tblCells.some(tblCellParser => tblCellParser.isRestart);
  }
  hasContinueCell() {
    return this.tblCells.some(tblCellParser => tblCellParser.isContinue);
  }
  // 检查行是否有合并单元格
  hasMergeCell() {
    return this.hasRestartCell() || this.hasContinueCell();
  }
}

class TblParser {
  id: string;
  doc: XMLDocument;
  tblNode: Element;
  trNodes: Element[] = [];
  textContent: string;
  tblRows: TblRowParser[] = [];
  constructor(tblNode: Element, doc: XMLDocument) {
    this.id = unique();
    this.doc = doc;
    this.tblNode = tblNode;
    if (this.tblNode.childNodes.length > 0) {
      for (let index = 0; index < this.tblNode.childNodes.length; index++) {
        const element = this.tblNode.childNodes[index];
        if (element.nodeName === 'w:tr') {
          this.trNodes.push(element as Element);
          this.tblRows.push(new TblRowParser(element as Element, this, doc));
        }
      }
    }

    this.textContent = this.tblNode?.textContent?.trim() || '';
  }
  insertRow(newTblRowParser: TblRowParser, tblRowParser: TblRowParser) {
    if (!tblRowParser) {
      this.tblNode.appendChild(newTblRowParser.tblRowNode);
      this.tblRows.push(newTblRowParser);
      return
    }
    const tblRowNode = tblRowParser.tblRowNode;
    tblRowNode.parentNode.insertBefore(newTblRowParser.tblRowNode, tblRowNode.nextSibling);
    const index = this.tblRows.findIndex(item => item.id === tblRowParser.id);
    this.tblRows.splice(index + 1, 0, newTblRowParser);
  }

  forEachTrNode(callback: (trNode: Element, index: number, trNodes: Element[]) => void) {
    for (let i = 0; i < this.trNodes.length; i++) {
      const trNode = this.trNodes[i] as Element;
      callback(trNode, i, this.trNodes);
    }
  }
  forEachTblRows(callback: (tblRowParser: TblRowParser, index: number, tblRows: TblRowParser[]) => void) {
    for (let i = 0; i < this.tblRows.length; i++) {
      const tblRowParser = this.tblRows[i];
      callback(tblRowParser, i, this.tblRows);
    }
  }
}

export default class selfDocxTemplate {
  private options: Options = {}
  private zip: PizZip
  private xmlDocuments: Record<string, Document> = {}
  private relsTypes = {}
  constructor(zip: PizZip, options: Options) {
    this.setOptions(options)
    if (isBuffer(zip)) {
      throw new Error("You passed a Buffer to the Docxtemplater constructor. The first argument of docxtemplater's constructor must be a valid zip file (jszip v2 or pizzip v3)");
    }
    if (!zip || !zip.files || typeof zip.file !== "function") {
      throw new Error("The first argument of docxtemplater's constructor must be a valid zip file (jszip v2 or pizzip v3)");
    }
    this.loadZip(zip)
    this.compile()
  }
  
  setOptions(options: Options) {
    if (!options) {
      throw new Error("setOptions should be called with an object as first parameter");
    }
    this.options = options
  }
  loadZip(zip: PizZip) {
    this.zip = zip
    this.relsTypes = getRelsTypes(zip, this.options)
  }
  compile() {
    this.xmlDocuments = {}
    const partNames = getRenderablePartNames(this.zip);
    for (const partName of partNames) {
      const content = this.zip.files[partName]?.asText();
      if (!content) {
        continue;
      }
      this.xmlDocuments[partName] = DocUtils.str2xml(content, this.options);
    }
  }
  async replaceTemplatePlaceholders(
    xmlDoc: Document,
    row: Row | Row[],
    start: string = '${',
    end: string = '}',
    fields: Field[] = [],
    partName: string = xmlDocumentName,
  ) {
    const isMainDocumentPart = partName === xmlDocumentName;
    if (isMainDocumentPart) {
      DocUtils.ensureRequiredNamespaces(xmlDoc);
    }
    const drawingNamespaceAttrs = isMainDocumentPart
      ? {}
      : DocUtils.getMissingDrawingNamespaces(xmlDoc);
    // 转义正则特殊字符（start/end 可能含 { } 等）
    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const startEsc = escapeRegExp(start);
    const endEsc = escapeRegExp(end);
    const drawingElements = xmlDoc.getElementsByTagName('w:drawing');
    const drawingNum = drawingElements.length
    type AddImageOption = {
      isImage?: boolean;
      isQrcode?: boolean;
      isBarcode?: boolean;
      imageFillType?: ImageFillType;
      r: Element;
      value: unknown;
      width: number | 'auto';
      height: number | 'auto';
    }
    const addImageOption: AddImageOption[] = []
    const regex = new RegExp(`${startEsc}([^${endEsc}]+)${endEsc}`, 'g');
    const eg = new RegExp(`(${startEsc}[^${endEsc}]*${endEsc})`, 'g')
    const rowDatas = Array.isArray(row) ? row : [row]
    const nodeHandlers = {
      "w:p": (node: Element) => {
        const _wpFunction = (node: Element, row: Row) => {
          const cloneNode = node.cloneNode(true) as Element
          const rElements = (cloneNode as Element).getElementsByTagName("w:r");
          let stitchingText: string = "";
          let stitchingElemArr: Element[] = [];
          let stitchingState = "end";
          for (let rI = 0; rI < rElements.length; rI++) {
            const rElement = rElements[rI];
            if (!rElement.textContent) continue;
            if (rElement.textContent.includes(start)) {
              // 说明：r中间有start
              stitchingText = rElement.textContent;
              stitchingElemArr = [rElement];
              if (rElement.textContent.includes(end)) {
                stitchingState = "end";
              } else {
                stitchingState = "start";
              }
            } else if (stitchingState === "start") {
              stitchingText += rElement.textContent;
              stitchingElemArr.push(rElement);
              if (rElement.textContent.includes(end)) {
                stitchingState = "end";
              }
            }
            if (stitchingText && stitchingState === "end") {
              let textArr = stitchingText.split(eg).filter((item) => item)
              const rElementClone = stitchingElemArr[0].cloneNode(true)

              const rElementArr = textArr.map((text) => {
                const rElement = rElementClone.cloneNode(true) as Element
                const ts = rElement.getElementsByTagName("w:t")
                for (let j = 0; j < ts.length; j++) {
                  const t = ts[j]
                  if (j === 0) {
                    t.textContent = text
                  } else {
                    rElement.removeChild(t)
                  }
                }
                return rElement
              })
              for (let j = rElementArr.length - 1; j >= 0; j--) {
                const addrEl = rElementArr[j]
                cloneNode.insertBefore(addrEl, rElement.nextSibling)
              }

              stitchingElemArr.forEach((rElement, index) => {
                cloneNode.removeChild(rElement)
              })
              stitchingText = "";
              stitchingElemArr = [];
              stitchingState = "";
            }
          }

          const dealrElements = (cloneNode as Element).getElementsByTagName("w:r");

          for (let rI = 0; rI < dealrElements.length; rI++) {
            const rElement = dealrElements[rI];
            const ts = rElement.getElementsByTagName("w:t")[0]
            if (!ts || !ts.textContent) continue;
            const replaceText = (text: string) => {
              return text.replace(regex, (match, key) => {
                key = key.trim().split("#")[1];
                const fieldUid = key.split("|")[0];
                if (isPrintFlowCommentFieldKey(fieldUid)) {
                  return match;
                }
                const keyArr = getKeyArr(fieldUid)
                for (const key of keyArr) {
                  const field = getField(key, fields)
                  if (isMultipleRelated(field)) {
                    return i18next.t('docxTemplate.notSupportRelFormNotInTable');
                  }
                  if (isSubForm(field)) {
                    return i18next.t('docxTemplate.notSupportSubFormNotInTable');
                  }
                }

                const value = getValue(key, row, match, void 0, fields);
                const imageValue = Array.isArray(value) ? value : [];
                const file = getField(fieldUid, fields);
                const isImage = isImageField(file);
                let isQrcode = key.includes(qrcodeStr);
                let isBarcode = key.includes(barcodeStr);
                const size = getSize(key);
                if (imageValue.length > 0 && isImage) {
                  addImageOption.push({
                    isImage: true,
                    imageFillType: key.includes(imageFillAuto)
                      ? "auto"
                      : "fixed",
                    r: rElement,
                    value: imageValue,
                    width:
                      size?.width === "auto" ? "auto" : Number(size?.width),
                    height:
                      size?.height === "auto" ? "auto" : Number(size?.height),
                  });
                  return match;
                } else if (value && isQrcode && shouldRenderPrintRowShareQrCode(value)) {
                  addImageOption.push({
                    isQrcode: true,
                    r: rElement,
                    value,
                    width:
                      size?.width === "auto" ? "auto" : Number(size?.width),
                    height:
                      size?.height === "auto" ? "auto" : Number(size?.height),
                  });
                  return match;
                } else if (value && isBarcode) {
                  addImageOption.push({
                    isBarcode: true,
                    r: rElement,
                    value,
                    width:
                      size?.width === "auto" ? "auto" : Number(size?.width),
                    height:
                      size?.height === "auto" ? "auto" : Number(size?.height),
                  });
                  return match;
                }

                return value;
              });
            };
            ts.textContent = replaceText(ts.textContent || "");
          }
          return cloneNode
        }
        const text = node.textContent
        const state = eg.test(text)
        const state2 = regex.test(text)
        if (!state && !state2) {
          return [node.cloneNode(true) as Element]
        }
        const pNodeArr: Element[] = []
        for (let i = 0; i < rowDatas.length; i++) {
          const row = rowDatas[i];
          const pNode = _wpFunction(node, row)
          pNodeArr.push(pNode)
        }
        return pNodeArr
      },
      "w:tbl": (node: Element, doc: XMLDocument) => {
        const _tblFunction = (node: Element, row: Row) => {
          const cloneNode = node.cloneNode(true) as Element
          // 需要处理正常字段和子表单字段
          // 正常字段：直接替换
          // 子表单字段：需要根据子表单数量复制多行
          const tblParser = new TblParser(cloneNode, doc);
          // 我需要记录下所有有子表单行的节点
          const subFormRowMap: { rows: TblRowParser[]; maxSubNum: number }[] = [];
          let recordingRowNum = 0
          tblParser.forEachTblRows((tblRow, index, tblRows) => {
            if (recordingRowNum > 0) {
              subFormRowMap[subFormRowMap.length - 1].rows.push(tblRow)
              recordingRowNum--
            } else if (isHasSubForm(tblRow.textContent, fields)) {
              // 当前行有子表单的情况

              // 需要复制的次数
              const maxSubNum = getMaxSubNum(tblRow.textContent, row, fields);

              const getCellMergeNum = (tblCellParser: TblCellParser, num: number = 0) => {
                if (!tblCellParser || !tblCellParser.isContinue && !tblCellParser.isRestart) {
                  return num
                }
                if (tblCellParser.isRestart) {
                  num = 1
                }
                if (tblCellParser.isContinue) {
                  num++
                }

                return getCellMergeNum(tblCellParser.getBottomCell(), num)
              }
              // 得到当前记录的行数
              let maxRowNum = 0;
              tblRow.forEachCell((tblCellParser) => {
                if (tblCellParser.textContent && isHasSubForm(tblCellParser.textContent, fields)) {
                  maxRowNum = Math.max(maxRowNum, getCellMergeNum(tblCellParser))
                }
              })
              subFormRowMap.push({ rows: [tblRow], maxSubNum })
              recordingRowNum = maxRowNum - 1
            }
          })
          const replaceText = (text: string, subFormIndex?: number, rElement?: Element) => {
            return text.replace(regex, (match, key) => {
              key = key.trim().split("#")[1];
              const fieldUid = key.split("|")[0];
              const value = getValue(key, row, match, subFormIndex, fields);
              const imageValue = Array.isArray(value) ? value : [];
              const file = getField(fieldUid, fields);
              const isImage = isImageField(file);
              const isQrcode = key.includes(qrcodeStr);
              const isBarcode = key.includes(barcodeStr);
              const size = getSize(key);
              if (imageValue.length > 0 && isImage) {
                addImageOption.push({
                  isImage: true,
                  imageFillType: key.includes(imageFillAuto)
                    ? "auto"
                    : "fixed",
                  r: rElement,
                  value: imageValue,
                  width:
                    size?.width === "auto" ? "auto" : Number(size?.width),
                  height:
                    size?.height === "auto" ? "auto" : Number(size?.height),
                })
                return match
              } else if (value && isQrcode && shouldRenderPrintRowShareQrCode(value)) {
                addImageOption.push({
                  isQrcode: true,
                  r: rElement,
                  value,
                  width:
                    size?.width === "auto" ? "auto" : Number(size?.width),
                  height:
                    size?.height === "auto" ? "auto" : Number(size?.height),
                });
                return match;
              } else if (value && isBarcode) {
                addImageOption.push({
                  isBarcode: true,
                  r: rElement,
                  value,
                  width:
                    size?.width === "auto" ? "auto" : Number(size?.width),
                  height:
                    size?.height === "auto" ? "auto" : Number(size?.height),
                });
                return match;
              }
              return value;
            })
          }
          for (let i = 0; i < subFormRowMap.length; i++) {
            const subFormRowObj = subFormRowMap[i];

            const lastRow = subFormRowObj.rows[subFormRowObj.rows.length - 1];

            const num = subFormRowObj.maxSubNum - 1
            for (let j = 0; j < num; j++) {
              const copyArr = subFormRowObj.rows.map((Tblrow) => Tblrow.clone());
              copyArr.forEach((tblRow) => {
                tblRow.forEachCell((tblCellParser) => {
                  if (tblCellParser.textContent && !isHasSubForm(tblCellParser.textContent, fields)) {
                    tblCellParser.setStrValue('');
                    tblCellParser.setVMerge('continue');
                  } else if (tblCellParser.textContent && isHasSubForm(tblCellParser.textContent, fields)) {
                    const subFormIndex = num - j
                    tblCellParser.setStrValue((text, rNode) => replaceText(text, subFormIndex, rNode))
                  }
                })
              })

              lastRow.insertRowAfter(copyArr)
            }

            subFormRowObj.rows.forEach((tblRowParser) => {
              tblRowParser.forEachCell((tblCellParser) => {
                if (
                  tblCellParser.textContent &&
                  !isHasSubForm(tblCellParser.textContent, fields) &&
                  !tblCellParser.isMerge
                ) {
                  tblCellParser.setVMerge('restart');
                } else if (tblCellParser.textContent && isHasSubForm(tblCellParser.textContent, fields)) {
                  tblCellParser.setStrValue((text, rNode) => replaceText(text, 0, rNode))
                }
              })
            })
          }
          tblParser.forEachTblRows((tblRowParser, index) => {
            tblRowParser.forEachCell((tblCellParser, index) => {
              const state = eg.test(tblCellParser.textContent)
              const state2 = regex.test(tblCellParser.textContent)
              if (tblCellParser.textContent && (state || state2) && !isHasSubForm(tblCellParser.textContent, fields)) {
                tblCellParser.setStrValue((text, rNode) => replaceText(text, null, rNode))
              }
            })
          })

          return cloneNode
        }

        const templateNode = node.cloneNode(true) as Element;
        // 分组
        type groupItem = {
          tblRow: TblRowParser;
          hasCode: boolean;
        }
        const groups: groupItem[][] = [];
        let lastHasCodeState = null;

        // 是否需要判断当前行的合并状态
        let needJudgeMergeState = false
        let judgeColNumber = -1
        const tblParser = new TblParser(templateNode, doc);
        tblParser.forEachTblRows((tblRow, index, tblRows) => {
          // 是否开启新的分组
          let isNextGroup = false;
          // 当前行是否有代码
          const hasCode = isHasCode(tblRow.textContent, fields)
          const changeCode = hasCode !== lastHasCodeState;
          if (!needJudgeMergeState) {
            // 需要找到有代码的单元格是否是第一个合并的单元格，是的话找到最大数量的合并数量
            tblRow.forEachCell((tblCellParser, colNumber) => {
              if (tblCellParser.isRestart && isHasCode(tblCellParser.textContent, fields)) {
                needJudgeMergeState = true;
                judgeColNumber = colNumber;
              }
            })
            isNextGroup = changeCode
          } else {
            const tblCellParser = tblRow.getCell(judgeColNumber);
            const isContinue = tblCellParser.isContinue;
            if (isContinue) {
              isNextGroup = false;
            } else {
              isNextGroup = true;
              needJudgeMergeState = false;
              judgeColNumber = -1;
            }
          }

          if (changeCode) {
            lastHasCodeState = hasCode;
          }

          if (isNextGroup || !Array.isArray(groups[groups.length - 1])) {
            groups.push([]);
          }
          groups[groups.length - 1].push({
            tblRow,
            hasCode,
          });
        });
        const realRows: TblRowParser[] = [];
        for (let i = 0; i < groups.length; i++) {
          const group = groups[i];
          const hasCode = group[0].hasCode;
          const tblRows = group.map(item => item.tblRow.clone());
          if (!hasCode) {
            realRows.push(...tblRows);
            continue;
          }
          // 需要一个空的
          const tblNode = xmlDoc.createElement('w:tbl');
          const len = tblRows.length
          for (let j = 0; j < len; j++) {
            const tblRow = tblRows[j];
            tblNode.appendChild(tblRow.tblRowNode);
          }
          for (let j = 0; j < rowDatas.length; j++) {
            const rowData = rowDatas[j];
            const newTblNode = _tblFunction(tblNode, rowData);
            const newTblParser = new TblParser(newTblNode, doc);
            realRows.push(...newTblParser.tblRows);
          }
        }
        const realRowsNode = realRows.map(item => item.tblRowNode);
        const realTableNode = node.cloneNode(true) as Element;
        const tblRows = realTableNode.getElementsByTagName('w:tr');
        let len = tblRows.length
        for (let j = 0; j < len; j++) {
          const tblRow = tblRows[j];
          tblRow.parentNode.removeChild(tblRow);
        }
        for (let j = 0; j < realRowsNode.length; j++) {
          const realRowNode = realRowsNode[j];
          realTableNode.appendChild(realRowNode);
        }

        return [realTableNode]
      },
    };
    let afterFunArr = []
    const recursiveDocument = (nodes: NodeList, doc: XMLDocument) => {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
      
        if (node.textContent) {
          const nodeName = node?.nodeName;
          if (nodeHandlers[nodeName]) {
            const cloneNodes = nodeHandlers[nodeName](node as Element, doc);

            afterFunArr.push(() => {
              const parent = node.parentNode;
              // 从后往前插入，保持顺序
              for (let i = cloneNodes.length - 1; i >= 0; i--) {
                parent.insertBefore(cloneNodes[i], node.nextSibling);
              }
              parent.removeChild(node);
            })
          } else if (node?.childNodes) {
            recursiveDocument(node.childNodes, doc);
          }
        }
      }
    }
    recursiveDocument(xmlDoc.childNodes, xmlDoc)
    afterFunArr.forEach((fun) => fun())

    const relsPath = getRelsPathForPart(partName);
    const relsXml = this.zip.files[relsPath]?.asText()
    const docRelsDoc = relsXml
      ? DocUtils.str2xml(relsXml, this.options)
      : createRelationshipsDoc(this.options);
    const relships = docRelsDoc.documentElement;
    const rels = relships.getElementsByTagName('Relationship');
    type ImageObj = {
      width: number;
      height: number;
      buffer: ArrayBuffer;
    }
    for (let i = 0; i < addImageOption.length; i++) {
      let imageBufferArr: ImageObj[][] = []
      let imageIdArr: string[] = []
      const item = addImageOption[i]
      const { isImage, isQrcode, isBarcode, r, value, width, height, imageFillType } = item
      
      if (isQrcode) {
        const buffer = await generateBarcode({
          bcid: 'qrcode',
          text: value.toString(),
          width: width === 'auto' ? 30 : Number(width),
          height: height === 'auto' ? 30 : Number(height),
        }, 'ArrayBuffer') as ArrayBuffer;
        imageBufferArr.push(
          [
            {
              width: width === 'auto' ? 30 : Number(width),
              height: height === 'auto' ? 30 : Number(height),
              buffer,
            }
          ]
        );
      } else if (isBarcode) {
        const buffer = await generateBarcode({
          bcid: 'code128',
          text: value.toString(),
          width: width === 'auto' ? 30 : Number(width),
          height: height === 'auto' ? 30 : Number(height),
        }, 'ArrayBuffer') as ArrayBuffer;
        imageBufferArr.push(
          [
            {
              width: width === 'auto' ? 30 : Number(width),
              height: height === 'auto' ? 30 : Number(height),
              buffer,
            }
          ]
        );
      } else if (isImage) {
        const getDataPath = this.options?.getDataPath ?? (() => {
          if (window) {
            return window.location.origin
          }
          return ''
        })
        const userDataPath = await getDataPath()
        const getPath = (userDataPath: string, url: string) => {
          if (isNode) {
            return `${userDataPath.replace(/\\/g, '/')}/${url}`
          } else if (window) {
            return `${userDataPath}/${url}`
          }
        }
        const valueArr = Array.isArray(value) ? value : [value]
        const urlArr = valueArr
          .filter((item): item is string => typeof item === 'string' && Boolean(item))
          .map((item) => getPath(userDataPath, item))
          .filter((item): item is string => Boolean(item))
        const imageIdArr = []
        for (const url of urlArr) {
          const arrayBuffer = await this.options?.readFileToArrBuffer?.(url) ?? await fetchPathAsArrayBuffer(url)
          const { width: imgWidth, height: imgHeight } = await this.options?.getImageDimensions?.(arrayBuffer) ?? await getImageDimensions(arrayBuffer)
          const newSize = proportionWH(
            { width, height },
            { width: imgWidth, height: imgHeight },
            {
              defaultWidth: 30,
              imageFillType,
            },
          )
          imageIdArr.push(
            {
              width: (newSize?.width as number),
              height: (newSize?.height as number),
              buffer: arrayBuffer,
            }
          )
        }
        imageBufferArr.push(imageIdArr)
      }

      // 获取原元素的父节点
      const parent = r.parentNode;
      if (!parent) continue;

      const textArr = r.textContent.split(eg).filter(Boolean)

      const pushElement: Element[] = []
      for (let tI = 0; tI < textArr.length; tI++) {
        const text = textArr[tI];
        
        if (text.startsWith(start) && text.endsWith(end)) {
          // 需要创建图片标签
          for (let j = 0; j < imageBufferArr.length; j++) {
            const imageBuffer = imageBufferArr[j];
            for (let imageIndex = 0; imageIndex < imageBuffer.length; imageIndex++) {
              const imageObj = imageBuffer[imageIndex];
              const { width, height, buffer } = imageObj

              // 注册图片
              const imagePath = await this.registerImage(buffer)
              
              // 生成图片路径与id的对应关系
              const nextRId = DocUtils.generateNextRId(docRelsDoc)
              imageIdArr.push(nextRId)

              const relElem = docRelsDoc.createElement('Relationship')

              relElem.setAttribute('Id', nextRId)
              relElem.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image')
              relElem.setAttribute('Target', imagePath)
              relships.appendChild(relElem)

              // 创建图片元素
              const drawing = DocUtils.createDrawingElement(
                docRelsDoc,
                nextRId,
                DocUtils.mmToEmu(width),
                DocUtils.mmToEmu(height),
                drawingNum + j + 1,
                drawingNamespaceAttrs,
              )
              pushElement.push(drawing)
            }
          }
        } else {
          const rElement = DocUtils.createRaragraphElement(docRelsDoc, text, r)
          pushElement.push(rElement)
        }
      }
      for (let tI = pushElement.length - 1; tI >= 0; tI--) {
        const item = pushElement[tI];
        parent.insertBefore(item, r.nextSibling)
      }
      // 删除原元素
      parent.removeChild(r)
    }

    // 序列化docRelsDoc为XML字符串，打印完整的XML标签内容
    if (relsXml || addImageOption.length > 0) {
      const serializer = new XMLSerializer();
      const updatedRelsXml = serializer.serializeToString(docRelsDoc);
      this.zip.file(relsPath, updatedRelsXml);
    }

    const serializer1 = new XMLSerializer();
    const xmlString1 = serializer1.serializeToString(xmlDoc);
    // console.log('xmlString1', xmlString1)
  };
  /**
   * 注册图片 
   */
  async registerImage(buffer: ArrayBuffer): Promise<string> {
    // 调试：检查 buffer 是否有效
    if (buffer.byteLength < 100) {
      console.warn('Image buffer too small:', buffer.byteLength);
    }
    // 可选：检查是否以 PNG 头开始 (89 50 4E 47)
    const uint8 = new Uint8Array(buffer);
    if (uint8[0] !== 0x89 || uint8[1] !== 0x50) {
      console.warn('Buffer may not be PNG');
    }

    const mediaPath = `media/my_image_${DocUtils.generateRandomFileName()}.png`;
    this.zip.file(`word/${mediaPath}`, buffer);
    return mediaPath;
  }
  async render(data: Row | Row[], fields: Field[]) {
    const start = this.options.delimiters.start || '${'
    const end = this.options.delimiters.end || '}'
    // 替换模板占位符
    for (const [partName, xmlDoc] of Object.entries(this.xmlDocuments)) {
      await this.replaceTemplatePlaceholders(xmlDoc, data, start, end, fields, partName);
      if (this.options.linebreaks) {
        DocUtils.normalizeTextLineBreaks(xmlDoc);
      }
      const serializer = new XMLSerializer();
      const updatedXml = serializer.serializeToString(xmlDoc);
      this.zip.file(partName, updatedXml);
    }
  }

  toArrayBuffer(options?: object) {
    return this.zip.generate({
      compression: "DEFLATE",
      fileOrder: zipFileOrder,
      type: "arraybuffer",
      ...options,
    })
  }
}

