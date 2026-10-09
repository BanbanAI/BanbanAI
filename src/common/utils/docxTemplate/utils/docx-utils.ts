import { Options } from "../docxTemplate";
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import i18next from 'i18next';

function parser(tag) {
  return {
    get: function get(scope) {
      if (tag === ".") {
        return scope;
      }
      if (scope) {
        return scope[tag];
      }
      return scope;
    }
  };
}
// 定义所需命名空间（前缀 → URI 映射）
const REQUIRED_NAMESPACES: Record<string, string> = {
  w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  wp: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  pic: 'http://schemas.openxmlformats.org/drawingml/2006/picture',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  w14: 'http://schemas.microsoft.com/office/word/2010/wordml',
};

const DRAWING_NAMESPACES: Record<string, string> = {
  wp: REQUIRED_NAMESPACES.wp,
  a: REQUIRED_NAMESPACES.a,
  pic: REQUIRED_NAMESPACES.pic,
  r: REQUIRED_NAMESPACES.r,
};

const DocUtils = {
  str2xml(str: string, options?: Options) {
    if (str.charCodeAt(0) === 65279) {
      // BOM sequence
      str = str.substr(1);
    }
    return new DOMParser().parseFromString(str, "text/xml");
  },
  generateRandomFileName() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      result += characters.charAt(randomIndex);
    }
    return result;
  },
  generateNextRId(relsDoc: Document): string {
    const existingIds = Array.from(
      relsDoc.getElementsByTagName('Relationship')
    ).map(el => el.getAttribute('Id') || '');
    
    const numbers = existingIds
      .map(id => id.startsWith('rId') ? parseInt(id.slice(3), 10) : NaN)
      .filter(n => !isNaN(n));
    
    const nextNum = numbers.length ? Math.max(...numbers) + 1 : 1;
    return `rId${nextNum}`;
  },
  mmToEmu(mm: number): number {
    return Math.round(mm * 36000);
  },
  // 创建图片元素
  createDrawingElement(
    doc: Document,
    rId: string,
    widthEmu: number,
    heightEmu: number,
    picId: number = 1,
    namespaceAttrs: Record<string, string> = {},
  ): Element {
    // 创建 <w:r> 元素
    const r = doc.createElement('w:r');

    const rPr = doc.createElement('w:rPr');
    const rFonts = doc.createElement('w:rFonts');
    const wlang = doc.createElement('w:lang');
    wlang.setAttribute('w:val', 'en-US');
    wlang.setAttribute('w:eastAsia', 'zh-CN');
    rFonts.setAttribute('w:hint', 'default')
    rPr.appendChild(rFonts);
    rPr.appendChild(wlang);
    r.appendChild(rPr);

    // 创建 <w:drawing>
    const drawing = doc.createElement('w:drawing');
    for (const [prefix, uri] of Object.entries(namespaceAttrs)) {
      drawing.setAttribute(`xmlns:${prefix}`, uri);
    }

    // <wp:inline>
    const inline = doc.createElement('wp:inline');
    inline.setAttribute('distT', '0');
    inline.setAttribute('distB', '0');
    inline.setAttribute('distL', '0');
    inline.setAttribute('distR', '0');

    // <wp:extent>
    const extent = doc.createElement('wp:extent');
    extent.setAttribute('cx', widthEmu.toString());
    extent.setAttribute('cy', heightEmu.toString());
    inline.appendChild(extent);

    // <wp:docPr>
    const docPr = doc.createElement('wp:docPr');
    docPr.setAttribute('id', picId.toString());
    docPr.setAttribute('name', i18next.t('docxUtils.imageName', { id: picId }));
    inline.appendChild(docPr);

    // <a:graphic>
    const graphic = doc.createElement('a:graphic');
    const graphicData = doc.createElement('a:graphicData');
    graphicData.setAttribute('uri', 'http://schemas.openxmlformats.org/drawingml/2006/picture');

    // <pic:pic>
    const pic = doc.createElement('pic:pic');

    // <pic:nvPicPr>
    const nvPicPr = doc.createElement('pic:nvPicPr');
    const cNvPr = doc.createElement('pic:cNvPr');
    cNvPr.setAttribute('id', picId.toString());
    cNvPr.setAttribute('name', `Picture ${picId}`);
    nvPicPr.appendChild(cNvPr);
    nvPicPr.appendChild(doc.createElement('pic:cNvPicPr'));
    pic.appendChild(nvPicPr);

    // <pic:blipFill>
    const blipFill = doc.createElement('pic:blipFill');
    const blip = doc.createElement('a:blip');
    const stretch = doc.createElement('a:stretch');
    stretch.appendChild(doc.createElement('a:fillRect'));
    blip.appendChild(stretch);
    blip.setAttribute('r:embed', rId); // 👈 关键：引用关系 ID
    blipFill.appendChild(blip);
    pic.appendChild(blipFill);

    // <pic:spPr>
    const spPr = doc.createElement('pic:spPr');
    const xfrm = doc.createElement('a:xfrm');
    const off = doc.createElement('a:off');
    off.setAttribute('x', '0');
    off.setAttribute('y', '0');
    const ext = doc.createElement('a:ext');
    ext.setAttribute('cx', widthEmu.toString());
    ext.setAttribute('cy', heightEmu.toString());
    xfrm.appendChild(off);
    xfrm.appendChild(ext);
    spPr.appendChild(xfrm);

    const prstGeom = doc.createElement('a:prstGeom');
    prstGeom.setAttribute('prst', 'rect');
    prstGeom.appendChild(doc.createElement('a:avLst'));
    spPr.appendChild(prstGeom);

    pic.appendChild(spPr);
    graphicData.appendChild(pic);
    graphic.appendChild(graphicData);
    inline.appendChild(graphic);
    drawing.appendChild(inline);
    
    r.appendChild(drawing);

    return r;
  },
  // 创建段落元素
  createRaragraphElement(
    doc: Document,
    text: string,
    copyStyleDoc: Document | Element
  ): Element {
    const r = doc.createElement('w:r');
    const rPr = copyStyleDoc.getElementsByTagName('w:rPr')[0];
    if (rPr) {
      const cloneRPr = rPr.cloneNode(true);
      r.appendChild(cloneRPr);
    }
    const t = doc.createElement('w:t');
    t.textContent = text;
    r.appendChild(t);
    return r;
  },
  // 克隆元素
  cloneElement(elem: Element): Element {
    return elem.cloneNode(true) as Element;
  },
  normalizeTextLineBreaks(xmlDoc: Document): void {
    const textNodes = Array.from(xmlDoc.getElementsByTagName('w:t'));

    for (const textNode of textNodes) {
      const text = textNode.textContent || '';
      if (!/[\r\n]/.test(text)) {
        continue;
      }

      const runNode = textNode.parentNode;
      if (!runNode) {
        continue;
      }

      const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const textParts = normalizedText.split('\n');
      const insertionNodes: Element[] = [];

      for (let index = 0; index < textParts.length; index++) {
        if (index > 0) {
          insertionNodes.push(xmlDoc.createElement('w:br'));
        }

        const textPartNode = textNode.cloneNode(false) as Element;
        textPartNode.textContent = textParts[index];
        insertionNodes.push(textPartNode);
      }

      for (const node of insertionNodes) {
        runNode.insertBefore(node, textNode);
      }
      runNode.removeChild(textNode);
    }
  },
  /**
 * 确保 Document 根元素包含所有必需的命名空间声明
 */
  ensureRequiredNamespaces(xmlDoc: Document): void {
    const root = xmlDoc.documentElement;
    if (!root) {
      throw new Error('Document has no root element');
    }

    // 遍历所有必需的命名空间
    for (const [prefix, uri] of Object.entries(REQUIRED_NAMESPACES)) {
      const attrName = `xmlns:${prefix}`;
      // 检查是否已存在该命名空间声明
      if (!root.hasAttribute(attrName)) {
        // 添加命名空间声明
        root.setAttribute(attrName, uri);
      }
    }
  },
  getMissingDrawingNamespaces(xmlDoc: Document): Record<string, string> {
    const root = xmlDoc.documentElement;
    const namespaceAttrs: Record<string, string> = {};
    for (const [prefix, uri] of Object.entries(DRAWING_NAMESPACES)) {
      const attrName = `xmlns:${prefix}`;
      if (!root?.hasAttribute(attrName)) {
        namespaceAttrs[prefix] = uri;
      }
    }
    return namespaceAttrs;
  }
}

export default DocUtils
