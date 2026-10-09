import bwipjs, { RenderOptions } from "bwip-js";
import i18next from "i18next";
import { isNode } from "../other";

async function canvasToArrayBuffer(canvas: HTMLCanvasElement): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to create blob from canvas'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        // reader.result 是 ArrayBuffer
        resolve(blob.arrayBuffer());
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    }, 'image/png'); // 可选 MIME 类型，如 'image/jpeg'
  });
}
export const generateBarcode = async (options: RenderOptions, type?: 'base64' | 'ArrayBuffer'): Promise<string | ArrayBuffer | ArrayBufferLike> => {
  try {
    if (!options.text) {
      throw new Error(i18next.t('commonUtilsOther.barcodeTextRequired'))
    }
    const defaultOptions = {
      bcid: 'code128',
      scale: 1,
      includetext: false,
      ...options,
    };
        
    if (isNode) {
      // Node环境
      try {
        const buffer = await bwipjs.toBuffer(defaultOptions);
        if (type === 'ArrayBuffer') {
          return buffer.buffer;
        }
        return buffer.toString('base64');
      } catch (nodeError) {
        console.error(i18next.t('commonUtilsOther.nodeConvertPngFail'), nodeError);
        throw new Error(i18next.t('commonUtilsOther.nodeConvertBarcodeToPngFail'));
      }
    } else if (window && window.document) {
      // 浏览器环境
      let canvas: any;
      let ctx: any;
      const canvasWidth = 200;
      const canvasHeight = 100;

      // 尝试使用浏览器的canvas API (浏览器环境)
      if (typeof window !== 'undefined' && window.document) {
        canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        ctx = canvas.getContext('2d');
        const canvasBuffer = await (bwipjs as any).toCanvas(canvas, defaultOptions);
        if (type === 'ArrayBuffer') {
          return await canvasToArrayBuffer(canvas);
        }
        return canvasBuffer.toDataURL('image/png');
      }
    }
  } catch (error) {
    console.error(error)
    return ''
  }
}
