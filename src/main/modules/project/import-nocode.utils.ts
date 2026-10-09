import { createReadStream } from "fs";
import { readdir, readFile } from "fs/promises";
import path from "path";
import type { Bucket, Row, Table } from "@common/types/project";
import { SystemField } from "@common/utils/connection";

export type ImportBucketChunkPayload = {
  bucket: Omit<Bucket, "rows">;
  rows: Row[];
  rowStartIndex: number;
};

const UPLOAD_PATH_ID_REGEXP = /^[a-zA-Z0-9]{12}$/;
const FLOW_RUNTIME_SYSTEM_FIELDS: Set<string> = new Set([
  SystemField.STATUS,
  SystemField.CURRENT_NODE,
  SystemField.CURRENT_OWNER,
  SystemField.TODO_ID,
  SystemField.TODO_VERSION,
]);

export function stripNocodeFlowRuntimeFields(
  rows: Row[],
  table?: Pick<Table, "fields">,
): Row[] {
  const fieldIds = new Set(FLOW_RUNTIME_SYSTEM_FIELDS);
  for (const field of table?.fields || []) {
    if (FLOW_RUNTIME_SYSTEM_FIELDS.has(field.meta?.name)) {
      fieldIds.add(field.uid);
      if (field.meta?.uid) {
        fieldIds.add(field.meta.uid);
      }
    }
  }
  return rows.map(row => {
    const normalizedRow = { ...row };
    for (const fieldId of fieldIds) {
      delete normalizedRow[fieldId];
    }
    return normalizedRow;
  });
}

export async function iterateImportBucketsByChunks(
  filePath: string,
  rowChunkSize: number,
  onChunk: (payload: ImportBucketChunkPayload) => Promise<void> | void,
) {
  const normalizedChunkSize = Math.max(1, rowChunkSize || 1);
  if (path.extname(filePath).toLowerCase() !== ".json") {
    await iterateImportBucketChunkFiles(filePath, onChunk);
    return;
  }

  await iterateImportBucketJsonFile(filePath, normalizedChunkSize, onChunk);
}

async function iterateImportBucketChunkFiles(
  dirPath: string,
  onChunk: (payload: ImportBucketChunkPayload) => Promise<void> | void,
) {
  const filenames = (await readdir(dirPath))
    .filter(filename => /\.json$/i.test(filename))
    .sort((a, b) => a.localeCompare(b));
  const tableRowOffsets = new Map<string, number>();

  for (const filename of filenames) {
    const content = await readFile(path.join(dirPath, filename), "utf-8");
    const bucket = JSON.parse(content) as Bucket;
    const rows = Array.isArray(bucket.rows) ? bucket.rows : [];
    if (!rows.length) {
      continue;
    }
    const rowStartIndex = tableRowOffsets.get(bucket.tableId) ?? 0;
    await onChunk({
      bucket: {
        tableId: bucket.tableId,
        tableName: bucket.tableName,
        fields: bucket.fields,
        count: bucket.count,
      },
      rows,
      rowStartIndex,
    });
    tableRowOffsets.set(bucket.tableId, rowStartIndex + rows.length);
  }
}

async function iterateImportBucketJsonFile(
  filePath: string,
  rowChunkSize: number,
  onChunk: (payload: ImportBucketChunkPayload) => Promise<void> | void,
) {
  const bucketMetas = await collectImportBucketMetas(filePath);
  await emitImportBucketRows(filePath, bucketMetas, rowChunkSize, onChunk);
}

async function collectImportBucketMetas(filePath: string) {
  const metas: Omit<Bucket, "rows">[] = [];
  const stream = createReadStream(filePath, { encoding: "utf-8" });
  let rootStarted = false;
  let bucketDepth = 0;
  let bucketBuffer = "";
  let topLevelState: "expectKeyOrEnd" | "readingKey" | "expectColon" | "expectValue" | "expectCommaOrEnd" = "expectKeyOrEnd";
  let currentKey = "";
  let keyBuffer = "";
  let inString = false;
  let escapeNext = false;
  let stringContext: "topKey" | "topValue" | "other" | null = null;
  let skippingRows = false;
  let rowsDepth = 0;
  let rowsInString = false;
  let rowsEscapeNext = false;

  const resetBucketState = () => {
    bucketDepth = 0;
    bucketBuffer = "";
    topLevelState = "expectKeyOrEnd";
    currentKey = "";
    keyBuffer = "";
    inString = false;
    escapeNext = false;
    stringContext = null;
    skippingRows = false;
    rowsDepth = 0;
    rowsInString = false;
    rowsEscapeNext = false;
  };

  const finalizeBucket = () => {
    const bucket = JSON.parse(bucketBuffer) as Bucket;
    metas.push({
      tableId: bucket.tableId,
      tableName: bucket.tableName,
      fields: bucket.fields,
      count: bucket.count,
    });
    resetBucketState();
  };

  for await (const chunk of stream) {
    for (const char of chunk) {
      if (!rootStarted) {
        if (/\s/.test(char)) {
          continue;
        }
        if (char !== "[") {
          throw new Error("Invalid import bucket json format");
        }
        rootStarted = true;
        continue;
      }

      if (!bucketDepth) {
        if (/\s/.test(char) || char === ",") {
          continue;
        }
        if (char === "]") {
          return metas;
        }
        if (char !== "{") {
          throw new Error("Invalid import bucket json format");
        }
        resetBucketState();
        bucketDepth = 1;
        bucketBuffer = "{";
        continue;
      }

      if (skippingRows) {
        if (rowsEscapeNext) {
          rowsEscapeNext = false;
          continue;
        }
        if (char === "\\" && rowsInString) {
          rowsEscapeNext = true;
          continue;
        }
        if (char === "\"") {
          rowsInString = !rowsInString;
          continue;
        }
        if (rowsInString) {
          continue;
        }
        if (char === "[" || char === "{") {
          rowsDepth += 1;
          continue;
        }
        if (char === "]" || char === "}") {
          rowsDepth -= 1;
          if (rowsDepth === 0) {
            bucketBuffer += "]";
            bucketDepth -= 1;
            skippingRows = false;
            topLevelState = "expectCommaOrEnd";
          }
        }
        continue;
      }

      bucketBuffer += char;

      if (escapeNext) {
        if (stringContext === "topKey") {
          keyBuffer += char;
        }
        escapeNext = false;
        continue;
      }

      if (char === "\\" && inString) {
        if (stringContext === "topKey") {
          keyBuffer += char;
        }
        escapeNext = true;
        continue;
      }

      if (char === "\"") {
        if (inString) {
          inString = false;
          if (stringContext === "topKey") {
            currentKey = keyBuffer;
            keyBuffer = "";
            topLevelState = "expectColon";
          } else if (stringContext === "topValue" && bucketDepth === 1) {
            topLevelState = "expectCommaOrEnd";
          }
          stringContext = null;
        } else {
          inString = true;
          if (bucketDepth === 1 && topLevelState === "expectKeyOrEnd") {
            stringContext = "topKey";
            keyBuffer = "";
            topLevelState = "readingKey";
          } else if (bucketDepth === 1 && topLevelState === "expectValue") {
            stringContext = "topValue";
          } else {
            stringContext = "other";
          }
        }
        continue;
      }

      if (inString) {
        if (stringContext === "topKey") {
          keyBuffer += char;
        }
        continue;
      }

      if (bucketDepth === 1) {
        if (topLevelState === "expectColon") {
          if (/\s/.test(char)) {
            continue;
          }
          if (char !== ":") {
            throw new Error("Invalid import bucket json format");
          }
          topLevelState = "expectValue";
          continue;
        }
        if (topLevelState === "expectValue") {
          if (/\s/.test(char)) {
            continue;
          }
          if (currentKey === "rows" && char === "[") {
            skippingRows = true;
            rowsDepth = 1;
            bucketDepth += 1;
            continue;
          }
          topLevelState = "expectCommaOrEnd";
        } else if (topLevelState === "expectCommaOrEnd") {
          if (/\s/.test(char)) {
            continue;
          }
          if (char === ",") {
            topLevelState = "expectKeyOrEnd";
            currentKey = "";
            continue;
          }
        } else if (topLevelState === "expectKeyOrEnd" && /\s/.test(char)) {
          continue;
        }
      }

      if (char === "{" || char === "[") {
        bucketDepth += 1;
      } else if (char === "}" || char === "]") {
        bucketDepth -= 1;
        if (bucketDepth === 0) {
          finalizeBucket();
        }
      }
    }
  }

  if (bucketDepth || skippingRows) {
    throw new Error("Invalid import bucket json format");
  }

  return metas;
}

async function emitImportBucketRows(
  filePath: string,
  bucketMetas: Omit<Bucket, "rows">[],
  rowChunkSize: number,
  onChunk: (payload: ImportBucketChunkPayload) => Promise<void> | void,
) {
  const stream = createReadStream(filePath, { encoding: "utf-8" });
  let rootStarted = false;
  let bucketDepth = 0;
  let topLevelState: "expectKeyOrEnd" | "readingKey" | "expectColon" | "expectValue" | "expectCommaOrEnd" = "expectKeyOrEnd";
  let currentKey = "";
  let keyBuffer = "";
  let inString = false;
  let escapeNext = false;
  let stringContext: "topKey" | "topValue" | "other" | null = null;
  let readingRows = false;
  let bucketIndex = -1;
  let currentBucket: Omit<Bucket, "rows"> | null = null;
  let currentRows: Row[] = [];
  let currentRowStartIndex = 0;
  let rowBuffer = "";
  let rowDepth = 0;
  let rowInString = false;
  let rowEscapeNext = false;

  const resetBucketState = () => {
    bucketDepth = 0;
    topLevelState = "expectKeyOrEnd";
    currentKey = "";
    keyBuffer = "";
    inString = false;
    escapeNext = false;
    stringContext = null;
    readingRows = false;
    currentRows = [];
    currentRowStartIndex = 0;
    rowBuffer = "";
    rowDepth = 0;
    rowInString = false;
    rowEscapeNext = false;
    currentBucket = null;
  };

  const flushCurrentRows = async () => {
    if (!currentBucket || !currentRows.length) {
      return;
    }
    const rows = currentRows;
    const rowStartIndex = currentRowStartIndex;
    currentRows = [];
    currentRowStartIndex += rows.length;
    await onChunk({
      bucket: currentBucket,
      rows,
      rowStartIndex,
    });
  };

  const pushRow = async (row: Row) => {
    if (!currentBucket) {
      throw new Error("Invalid import bucket json format");
    }
    currentRows.push(row);
    if (currentRows.length >= rowChunkSize) {
      await flushCurrentRows();
    }
  };

  const consumeRowChar = async (char: string) => {
    rowBuffer += char;

    if (rowEscapeNext) {
      rowEscapeNext = false;
      return;
    }
    if (char === "\\" && rowInString) {
      rowEscapeNext = true;
      return;
    }
    if (char === "\"") {
      rowInString = !rowInString;
      return;
    }
    if (rowInString) {
      return;
    }

    if (char === "{" || char === "[") {
      rowDepth += 1;
      return;
    }
    if (char === "}" || char === "]") {
      rowDepth -= 1;
      if (rowDepth === 0) {
        await pushRow(JSON.parse(rowBuffer) as Row);
        rowBuffer = "";
        rowInString = false;
        rowEscapeNext = false;
      }
    }
  };

  for await (const chunk of stream) {
    for (const char of chunk) {
      if (!rootStarted) {
        if (/\s/.test(char)) {
          continue;
        }
        if (char !== "[") {
          throw new Error("Invalid import bucket json format");
        }
        rootStarted = true;
        continue;
      }

      if (!bucketDepth) {
        if (/\s/.test(char) || char === ",") {
          continue;
        }
        if (char === "]") {
          if (bucketIndex + 1 !== bucketMetas.length) {
            throw new Error("Invalid import bucket json format");
          }
          return;
        }
        if (char !== "{") {
          throw new Error("Invalid import bucket json format");
        }
        resetBucketState();
        bucketIndex += 1;
        currentBucket = bucketMetas[bucketIndex];
        if (!currentBucket) {
          throw new Error("Invalid import bucket json format");
        }
        bucketDepth = 1;
        continue;
      }

      if (readingRows) {
        if (!rowDepth) {
          if (/\s/.test(char) || char === ",") {
            continue;
          }
          if (char === "]") {
            await flushCurrentRows();
            readingRows = false;
            bucketDepth -= 1;
            topLevelState = "expectCommaOrEnd";
            continue;
          }
        }
        await consumeRowChar(char);
        continue;
      }

      if (escapeNext) {
        if (stringContext === "topKey") {
          keyBuffer += char;
        }
        escapeNext = false;
        continue;
      }

      if (char === "\\" && inString) {
        if (stringContext === "topKey") {
          keyBuffer += char;
        }
        escapeNext = true;
        continue;
      }

      if (char === "\"") {
        if (inString) {
          inString = false;
          if (stringContext === "topKey") {
            currentKey = keyBuffer;
            keyBuffer = "";
            topLevelState = "expectColon";
          } else if (stringContext === "topValue" && bucketDepth === 1) {
            topLevelState = "expectCommaOrEnd";
          }
          stringContext = null;
        } else {
          inString = true;
          if (bucketDepth === 1 && topLevelState === "expectKeyOrEnd") {
            stringContext = "topKey";
            keyBuffer = "";
            topLevelState = "readingKey";
          } else if (bucketDepth === 1 && topLevelState === "expectValue") {
            stringContext = "topValue";
          } else {
            stringContext = "other";
          }
        }
        continue;
      }

      if (inString) {
        if (stringContext === "topKey") {
          keyBuffer += char;
        }
        continue;
      }

      if (bucketDepth === 1) {
        if (topLevelState === "expectColon") {
          if (/\s/.test(char)) {
            continue;
          }
          if (char !== ":") {
            throw new Error("Invalid import bucket json format");
          }
          topLevelState = "expectValue";
          continue;
        }
        if (topLevelState === "expectValue") {
          if (/\s/.test(char)) {
            continue;
          }
          if (currentKey === "rows" && char === "[") {
            readingRows = true;
            bucketDepth += 1;
            continue;
          }
          topLevelState = "expectCommaOrEnd";
        } else if (topLevelState === "expectCommaOrEnd") {
          if (/\s/.test(char)) {
            continue;
          }
          if (char === ",") {
            topLevelState = "expectKeyOrEnd";
            currentKey = "";
            continue;
          }
        } else if (topLevelState === "expectKeyOrEnd" && /\s/.test(char)) {
          continue;
        }
      }

      if (char === "{" || char === "[") {
        bucketDepth += 1;
      } else if (char === "}" || char === "]") {
        bucketDepth -= 1;
        if (bucketDepth === 0) {
          await flushCurrentRows();
        }
      }
    }
  }

  if (bucketDepth || readingRows || rowDepth) {
    throw new Error("Invalid import bucket json format");
  }
}

export function replaceNocodeIdInRow(row: Row, sourceNocodeId: string | undefined, targetNocodeId: string) {
  const replacePath = (value: string) => replaceUploadsPathNocodeId(value, sourceNocodeId, targetNocodeId);
  walkReplaceRowValue(row as Record<string, any>, replacePath);
  return row;
}

function walkReplaceRowValue(value: any, replacePath: (value: string) => string) {
  if (typeof value === "string") {
    return replacePath(value);
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      value[index] = walkReplaceRowValue(value[index], replacePath);
    }
    return value;
  }

  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      value[key] = walkReplaceRowValue(value[key], replacePath);
    }
    return value;
  }

  return value;
}

function replaceUploadsPathNocodeId(value: string, sourceNocodeId: string | undefined, targetNocodeId: string) {
  return value.replace(/uploads\/([^/"'\s]+)(\/[^"'\s]*)/g, (raw, nocodeId: string, suffix: string) => {
    if (sourceNocodeId) {
      return (nocodeId === sourceNocodeId || UPLOAD_PATH_ID_REGEXP.test(nocodeId)) ? `uploads/${targetNocodeId}${suffix}` : raw;
    }
    return UPLOAD_PATH_ID_REGEXP.test(nocodeId) ? `uploads/${targetNocodeId}${suffix}` : raw;
  });
}
