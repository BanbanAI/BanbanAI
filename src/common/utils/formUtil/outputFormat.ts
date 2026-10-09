import axios from 'axios';
import i18next from 'i18next';

export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  // 在 Node.js 或支持 Buffer 的环境中
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64');
  }

  // 浏览器环境 fallback
  const uint8Array = new Uint8Array(buffer);
  let binaryString = '';
  for (let i = 0; i < uint8Array.byteLength; i++) {
    binaryString += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binaryString);
}
export const base64ToArrayBuffer = (base64) => {
  const cleanBase64 = base64.replace(/^data:.*?;base64,/, '');

  if (typeof Buffer !== 'undefined') {
    // Node.js 环境
    const buffer = Buffer.from(cleanBase64, 'base64');
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    );
  } else {
    // 浏览器环境
    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

/**
 * 根据列索引获取对应的Excel列字母
 * @param colIndex 列索引（从0开始）
 * @returns 对应的Excel列字母
 * @example
 * getColumnLetter(0) => 'A'
 * getColumnLetter(25) => 'Z'
 * getColumnLetter(26) => 'AA'
 */
export const _getColumnLetter = (colIndex: number): string => {
  if (colIndex < 0) throw new Error(i18next.t('outputFormat.columnIndexNotNegative'));
  
  let dividend = colIndex + 1;
  let columnName = '';
  
  while (dividend > 0) {
    const modulo = (dividend - 1) % 26;
    columnName = String.fromCharCode(65 + modulo) + columnName;
    dividend = Math.floor((dividend - modulo) / 26);
  }
  
  return columnName;
}
export const getAddress = (col: number, row: number) => {
  return `${_getColumnLetter(col - 1)}${row}`
}
export const pngBase64ToDataUrl = (base64String: string, mimeType: string = 'image/png'): string => {
  try {
    // 输入验证
    if (!base64String || typeof base64String !== 'string') {
      throw new Error(i18next.t('outputFormat.inputMustValidBase64'));
    }
    // 移除可能存在的空白字符和换行符
    const cleanBase64 = base64String.replace(/\s+/g, '');
    // 检查是否已经是data URL格式
    if (cleanBase64.startsWith('data:')) {
      return cleanBase64;
    }
    // 基本验证base64格式（简单检查，实际应用中可能需要更严格的验证）
    const base64Regex = /^[A-Za-z0-9+/=]+$/;
    if (!base64Regex.test(cleanBase64)) {
      console.warn(i18next.t('outputFormat.inputMayInvalidBase64TryProcess'));
    }
    // 返回完整的data URL格式
    return `data:${mimeType};base64,${cleanBase64}`;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(i18next.t('outputFormat.svgBase64ToDataUrlFail'), errorMessage);
    throw new Error(`${i18next.t('outputFormat.svgBase64ToDataUrlFail')} ${errorMessage}`);
  }
}
export const fetchUrlToBase64 = async (url: string): Promise<string> => {
  const res = await axios({
    url,
    method: 'GET',
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: {
      'Accept': 'image/*, */*'
    }
  });
  
  // 获取Content-Type响应头
  const contentType = res.headers['content-type'] || '';
  // 提取MIME类型
  const mimeType = contentType.split(';')[0].trim() || 'application/octet-stream';
  
  // 转换为base64
  const base64 = arrayBufferToBase64(res.data);
  const dataUrl = pngBase64ToDataUrl(base64, mimeType);
  return dataUrl; 
};
export interface Rectangle {
  left: number
  top: number
  right: number
  bottom: number
}
/**
 * 判断两个矩形是否相交
 * @param rectangle1 第一个矩形对象
 * @param rectangle2 第二个矩形对象
 * @returns 如果矩形相交返回true，否则返回false
 */
export const areRectanglesIntersecting = (rectangle1: Rectangle, rectangle2: Rectangle): boolean => {
  // 解构获取两个矩形的边界坐标
  const { left: left1, top: top1, right: right1, bottom: bottom1 } = rectangle1
  const { left: left2, top: top2, right: right2, bottom: bottom2 } = rectangle2
  
  // 判断不相交的四种情况
  // 1. 矩形1在矩形2的左侧: rectangle1.right < rectangle2.left
  // 2. 矩形1在矩形2的右侧: rectangle1.left > rectangle2.right
  // 3. 矩形1在矩形2的上方: rectangle1.bottom < rectangle2.top
  // 4. 矩形1在矩形2的下方: rectangle1.top > rectangle2.bottom
  const isDisjoint = right1 < left2 || left1 > right2 || bottom1 < top2 || top1 > bottom2
  
  // 如果不是不相交，则表示相交
  return !isDisjoint
}

export const numPTToPX = (pt: number) => {
  return pt * 1.3333333333333333
}

export const numPXToPT = (px: number) => {
  return px / 1.3333333333333333
}