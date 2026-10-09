import path, { join } from 'path';
import { readdir, stat, mkdir, rm, rename, access } from 'fs/promises';
import fs from 'fs';
import { unzip } from '@main/utils/zip';
import md5 from "md5";
import { getRuntime } from '@main/runtime';
import * as XLSX from 'xlsx';
import { CellMerge, ExcelFileData, ExcelRange } from '@common/types/excel';
import { execSync } from 'child_process';
import os from 'os';

export async function getDirSize(dir: string) {
  const files = await readdir( dir, { withFileTypes: true } );

  const paths = files.map( async file => {
    const path = join( dir, file.name );

    if ( file.isDirectory() ) return await getDirSize( path );

    if ( file.isFile() ) {
      const { size } = await stat( path );
      
      return size;
    }

    return 0;
  } );

  return ( await Promise.all( paths ) ).flat( Infinity ).reduce( ( i, size ) => i + size, 0 );
}

export const getLocalResourceDir = async () => {
  if (getRuntime().isProduction) {
    const dir = await getRuntime().getUserDataPath();
    return join(dir, 'LocalResource');
  }
  return join(process.cwd(), 'dist/LocalResource');
}

export function doRepeat(arr: any[], key: string) {
  const obj = {}
  const newArr = arr.reduce((acc, cur) => {
    if (!obj[cur[key]]) {
      obj[cur[key]] = cur[key]
      acc.push(cur)
    }
    return acc
  }, [])
  return newArr
}

export async function unzipFile(zipFile: string, extractDir: string) {
  try {
    if (!fs.existsSync(extractDir)) {
      await mkdir(extractDir, { recursive: true });
    }
    await unzip(zipFile, extractDir);
    return { extractDir: extractDir };
  } catch (err) {
    return { reason: err.message };
  }
}

export async function moveFile(oldPath: string, newPath: string) {
  try {
    await access(oldPath, fs.constants.F_OK);
    const destinationDir = path.dirname(newPath);
    try {
      await access(destinationDir, fs.constants.F_OK);
    } catch (err) {
      await mkdir(destinationDir, { recursive: true });
    }
    const sourceStat = await stat(oldPath);
    if (sourceStat.isDirectory()) {
      // 文件夹
      const items = await readdir(oldPath);
      for (const item of items) {
        const itemSource = path.join(oldPath, item);
        const itemDestination = path.join(newPath, item);
        await this.moveFile(itemSource, itemDestination);
      }
      await fs.promises.rmdir(oldPath);
    } else {
      //文件
      await rename(oldPath, newPath);
    }
  } catch (err) {
    console.error("moveFile error", err);
  }
}

export const encodePassword = (password: string) => {
  return md5(`--md5--salt--${password}`);
}

export function replaceStringInJson(json, targetString: string | RegExp, toString: string) {
  const jsonStr = JSON.stringify(json);
  const repalcedJsonStr = jsonStr.replaceAll(targetString, toString);
  return JSON.parse(repalcedJsonStr);
}

export async function parseExcelData(fullPath: string, maxRows?: number): Promise<ExcelFileData> {
  // 检查文件是否存在
  let exists = false;
  try {
    await access(fullPath);
    exists = true;
  } catch {
    exists = false;
  }

  if (!exists) {
    throw new Error(global.i18next.t('mainUtilsIndex.fileNotExist'));
  }

  // 从路径中提取文件名（不包含路径部分）
  const fullFileName = path.basename(fullPath);
  // 提取原始文件名（移除时间戳和扩展名）
  // 匹配模式：文件名_数字.xlsx → 提取下划线前的部分
  const fileNameMatch = fullFileName.match(/^(.+?)_\d+\.\w+$/);
  const originalFileName = fileNameMatch 
      ? fileNameMatch[1] // 提取第一个捕获组（下划线前的部分）
      : fullFileName.replace(/\.\w+$/, ''); // 备用：直接移除扩展名
  
  // 读取文件并解析为工作簿对象
  const workbook = XLSX.readFile(fullPath, { cellDates: true });
  // 获取所有表名
  const sheetNames = workbook.SheetNames;
  let originSheetsData: ExcelFileData['originSheetsData'] = {};

  // 遍历所有工作表并提取数据
  for (const sheetName of sheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    let isSheetNull: boolean = worksheet['!ref'] === undefined;
    if (isSheetNull) {
      originSheetsData[sheetName] = { isSheetNull, rows: [], typeData: [], mergeData: [] };
      continue;
    }

    let range: XLSX.Range = XLSX.utils.decode_range(worksheet['!ref']);

    // 将工作表转换为JSON格式
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: null });
    // 新增：计算实际有效数据行数
    let actualDataRows = jsonData.length;
    for (let i = jsonData.length - 1; i >= 0; i--) {
      if ((jsonData[i] as any[]).some(cell => cell !== null)) {
        actualDataRows = i + 1;
        break;
      }
    }

    let maxRowsToRead = maxRows !== undefined ? Math.min(actualDataRows, maxRows) : actualDataRows;
    range.e.r = range.s.r + maxRowsToRead - 1;

    let mergeData: CellMerge[][] = parseDataMerge(worksheet, range);
    maxRowsToRead = Math.min(Math.max(maxRowsToRead, mergeData.length), actualDataRows);
    range.e.r = range.s.r + maxRowsToRead - 1;

    let rows = sheetFillNull(jsonData.slice(0, maxRowsToRead) as any[][], range);
    let typeData = parseDataType(worksheet, range);

    originSheetsData[sheetName] = { isSheetNull, rows, typeData, mergeData };
  }

  return {
    fileName: originalFileName,
    sheets: sheetNames,
    originSheetsData
  }
}

function parseDataType(worksheet: XLSX.WorkSheet, range: XLSX.Range): string[][] {
  const typeData: string[][] = [];
  const typeMap = {
    n: 'number',
    s: 'string',
    b: 'boolean',
    d: 'date',
    e: 'error'
  };
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cellAddress = { c: C, r: R };
      const cellRef = XLSX.utils.encode_cell(cellAddress);
      const cellType = worksheet[cellRef]?.t ?? null;

      if (!typeData[R - range.s.r]) typeData[R - range.s.r] = [];
      typeData[R - range.s.r][C - range.s.c] = typeMap[cellType];
    }
  }
  return typeData;
}

function parseDataMerge(worksheet: XLSX.WorkSheet, range: XLSX.Range): CellMerge[][] {
  const mergeData: CellMerge[][] = [];
  const originMerge: ExcelRange[] = worksheet?.['!merges'] ?? [];
  for (const merge of originMerge) {
    if (merge.s.r > range.e.r) continue;
    const rowIndex = merge.s.r - range.s.r;
    const colIndex = merge.s.c - range.s.c;

    // 被合并单元格，rowspan与colspan都为0
    for (let R = rowIndex; R <= merge.e.r - range.s.r; R++) {
      for (let C = colIndex; C <= merge.e.c - range.s.c; C++) {
        if (!mergeData[R]) mergeData[R] = [];
        if (R === rowIndex && C === colIndex) {
          mergeData[rowIndex][colIndex] = {
            rowspan: merge.e.r - merge.s.r + 1,
            colspan: merge.e.c - merge.s.c + 1,
          };
        } else {
          // 区分被横向，纵向合并的单元格
          mergeData[R][C] = { rowspan: C === colIndex ? 0 : 1, colspan: R === rowIndex ? 0 : 1 };
        }
      }
    }
  }
  // 未赋值的单元格，rowspan与colspan都为1
  let rowCount = Math.max(mergeData.length, range.e.r - range.s.r + 1);
  for (let R = range.s.r; R < range.s.r + rowCount; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const rowIndex = R - range.s.r;
      const colIndex = C - range.s.c;
      if (!mergeData[rowIndex]) mergeData[rowIndex] = [];
      if (mergeData[rowIndex][colIndex] === undefined)
        mergeData[rowIndex][colIndex] = { rowspan: 1, colspan: 1 };
    }
  }
  return mergeData;
}

export function sheetFillNull(sheetData: any[][], range: XLSX.Range) {
  // 空单元格按最长行填充null
  const maxLength = range.e.c - range.s.c + 1;
  sheetData.forEach(row => {
    for (let i = 0; i < maxLength; i++) {
      if (row[i] === undefined) row[i] = null;
    }
  });
  return sheetData;
}

export function getOSInfo() { 
  // 基础系统信息
  const platform = os.platform();
  let osType;
  let packageManager; // deb/rpm
  // 判断基础系统类型
  switch (platform) {
    case 'win32':
      osType = 'win';
      break;
    case 'darwin':
      osType = 'mac';
      break;
    case 'linux':
      osType = 'linux';
      // Linux系统下判断包管理类型
      try {
        // 检查是否存在 dpkg（deb体系的核心命令）
        execSync('dpkg --version', { stdio: 'ignore' });
        packageManager = 'deb';
      } catch (err) {
        // 检查是否存在 rpm（rpm体系的核心命令）
        execSync('rpm --version', { stdio: 'ignore' });
        packageManager = 'rpm';
      }
      break;
  }
  return { osType, packageManager };
}

export * from './deploy-file';
export * from './project';
export * from './nocode';
