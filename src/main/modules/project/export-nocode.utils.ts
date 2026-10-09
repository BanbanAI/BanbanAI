import path from "path";
import { createWriteStream } from "fs";
import { mkdir, readdir, rename, rm, stat, writeFile } from "fs/promises";
import { ZipFile } from "yazl";
import type { Field } from "@common/types/project";

type BucketMeta = {
  tableName: string;
  tableId: string;
  fields: Field[];
  count: number;
};

export type ZipOutputEntry =
  | {
      type: "directory";
      sourcePath: string;
      zipPath: string;
      compress?: boolean;
    }
  | {
      type: "file";
      sourcePath: string;
      zipPath: string;
      compress?: boolean;
    }
  | {
      type: "buffer";
      zipPath: string;
      content: string | Buffer;
      compress?: boolean;
    };

type PendingZipEntry =
  | {
      type: "file";
      sourcePath: string;
      zipPath: string;
      compress: boolean;
    }
  | {
      type: "buffer";
      zipPath: string;
      content: string | Buffer;
      compress: boolean;
    };

export class ExportBucketJsonWriter {
  private readonly ready: Promise<void>;
  private stream: ReturnType<typeof createWriteStream> | null = null;
  private closed = false;
  private hasBucket = false;
  private bucketOpen = false;
  private firstRowInBucket = true;
  private currentBucketCount = 0;

  constructor(private readonly filePath: string) {
    this.ready = this.init();
  }

  async writeBucketStart(meta: BucketMeta) {
    this.ensureNotClosed();
    if (this.bucketOpen) {
      throw new Error("Previous bucket is not closed");
    }

    const bucketPrefix = `${this.hasBucket ? "," : ""}{"tableName":${JSON.stringify(meta.tableName)},"tableId":${JSON.stringify(meta.tableId)},"fields":${JSON.stringify(meta.fields)},"rows":[`;
    await this.write(bucketPrefix);
    this.hasBucket = true;
    this.bucketOpen = true;
    this.firstRowInBucket = true;
    this.currentBucketCount = meta.count;
  }

  async writeBucketRows(rows: Record<string, any>[]) {
    this.ensureNotClosed();
    if (!this.bucketOpen) {
      throw new Error("Bucket is not open");
    }
    if (!rows.length) {
      return;
    }

    for (const row of rows) {
      const rowContent = `${this.firstRowInBucket ? "" : ","}${JSON.stringify(row)}`;
      await this.write(rowContent);
      this.firstRowInBucket = false;
    }
  }

  async writeBucketEnd() {
    this.ensureNotClosed();
    if (!this.bucketOpen) {
      throw new Error("Bucket is not open");
    }

    await this.write(`],"count":${JSON.stringify(this.currentBucketCount)}}`);
    this.bucketOpen = false;
    this.firstRowInBucket = true;
    this.currentBucketCount = 0;
  }

  async close() {
    this.ensureNotClosed();
    if (this.bucketOpen) {
      throw new Error("Bucket is not closed");
    }

    await this.ready;
    const stream = this.getStream();
    this.closed = true;
    await new Promise<void>((resolve, reject) => {
      const handleError = (error: Error) => {
        stream.off("error", handleError);
        reject(error);
      };
      stream.once("error", handleError);
      stream.end("]", () => {
        stream.off("error", handleError);
        resolve();
      });
    });
  }

  private async init() {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await new Promise<void>((resolve, reject) => {
      const stream = createWriteStream(this.filePath);
      this.stream = stream;
      stream.once("open", () => resolve());
      stream.once("error", reject);
    });
    await this.writeRaw("[");
  }

  private async write(content: string | Buffer) {
    await this.ready;
    await this.writeRaw(content);
  }

  private async writeRaw(content: string | Buffer) {
    const stream = this.getStream();
    await new Promise<void>((resolve, reject) => {
      const handleError = (error: Error) => {
        stream.off("error", handleError);
        reject(error);
      };
      stream.once("error", handleError);
      stream.write(content, () => {
        stream.off("error", handleError);
        resolve();
      });
    });
  }

  private getStream() {
    if (!this.stream) {
      throw new Error("Writer is not ready");
    }
    return this.stream;
  }

  private ensureNotClosed() {
    if (this.closed) {
      throw new Error("Writer is already closed");
    }
  }
}

export class ExportBucketChunkFileWriter {
  private chunkIndex = 0;

  constructor(private readonly dirPath: string) {}

  async writeBucketChunk(bucket: BucketMeta, rows: Record<string, any>[]) {
    if (!rows.length) {
      return;
    }
    await mkdir(this.dirPath, { recursive: true });
    const chunkFilePath = path.join(this.dirPath, `${String(this.chunkIndex).padStart(6, "0")}.json`);
    this.chunkIndex += 1;
    await writeFile(
      chunkFilePath,
      JSON.stringify({
        tableName: bucket.tableName,
        tableId: bucket.tableId,
        fields: bucket.fields,
        count: bucket.count,
        rows,
      }),
    );
  }
}

export async function createZipFromEntries(outputPath: string, entries: ZipOutputEntry[]) {
  const zipEntries = new Map<string, PendingZipEntry>();

  for (const entry of entries) {
    if (entry.type === "directory") {
      await collectDirectoryEntries(entry.sourcePath, entry.zipPath, zipEntries, entry.compress ?? true);
      continue;
    }

    if (entry.type === "file") {
      zipEntries.set(normalizeZipPath(entry.zipPath), {
        type: "file",
        sourcePath: entry.sourcePath,
        zipPath: normalizeZipPath(entry.zipPath),
        compress: entry.compress ?? true,
      });
      continue;
    }

    zipEntries.set(normalizeZipPath(entry.zipPath), {
      type: "buffer",
      zipPath: normalizeZipPath(entry.zipPath),
      content: entry.content,
      compress: entry.compress ?? true,
    });
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  const tempOutputPath = `${outputPath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;

  const zipFile = new ZipFile();
  for (const entry of zipEntries.values()) {
    if (entry.type === "file") {
      await assertFileExists(entry.sourcePath);
      zipFile.addFile(entry.sourcePath, entry.zipPath, {
        compress: entry.compress,
      });
      continue;
    }

    zipFile.addBuffer(
      typeof entry.content === "string" ? Buffer.from(entry.content, "utf-8") : entry.content,
      entry.zipPath,
      {
        compress: entry.compress,
      },
    );
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const outputStream = createWriteStream(tempOutputPath);
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        outputStream.off("error", handleError);
        outputStream.off("close", handleClose);
        zipFile.outputStream.off("error", handleError);
        error ? reject(error) : resolve();
      };
      const handleError = (error: Error) => finish(error);
      const handleClose = () => finish();
      outputStream.on("error", handleError);
      zipFile.outputStream.on("error", handleError);
      outputStream.on("close", handleClose);
      zipFile.outputStream.pipe(outputStream);
      zipFile.end();
    });
    await rename(tempOutputPath, outputPath);
  } catch (err) {
    await rm(tempOutputPath, { force: true }).catch(() => {});
    throw err;
  }
}

export async function buildNocodePageZipEntries(pagesDir: string, pageIds: string[]): Promise<ZipOutputEntry[]> {
  const entries: ZipOutputEntry[] = [];
  for (const pageId of pageIds) {
    const pageDir = path.join(pagesDir, pageId);
    entries.push({
      type: "file",
      sourcePath: path.join(pageDir, "main.json"),
      zipPath: joinZipPath("projects", joinZipPath(pageId, "main.json")),
    });
  }
  return entries;
}

async function collectDirectoryEntries(
  sourcePath: string,
  zipPath: string,
  zipEntries: Map<string, PendingZipEntry>,
  compress: boolean,
) {
  const dirEntries = await readdir(sourcePath, { withFileTypes: true });

  for (const dirEntry of dirEntries) {
    if (/^\./.test(dirEntry.name)) {
      continue;
    }

    const childSourcePath = path.join(sourcePath, dirEntry.name);
    const childZipPath = joinZipPath(zipPath, dirEntry.name);

    if (dirEntry.isDirectory()) {
      await collectDirectoryEntries(childSourcePath, childZipPath, zipEntries, compress);
      continue;
    }

    if (!dirEntry.isFile()) {
      const childStat = await stat(childSourcePath);
      if (!childStat.isFile()) {
        continue;
      }
    }

    zipEntries.set(childZipPath, {
      type: "file",
      sourcePath: childSourcePath,
      zipPath: childZipPath,
      compress,
    });
  }
}

function joinZipPath(basePath: string, childPath: string) {
  const normalizedBasePath = normalizeDirectoryZipPath(basePath);
  return normalizeZipPath(normalizedBasePath ? `${normalizedBasePath}/${childPath}` : childPath);
}

function normalizeDirectoryZipPath(zipPath: string) {
  return zipPath.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

function normalizeZipPath(zipPath: string) {
  const normalizedZipPath = normalizeDirectoryZipPath(zipPath);
  if (!normalizedZipPath) {
    throw new Error("zip path is required");
  }
  return normalizedZipPath;
}

async function assertFileExists(filePath: string) {
  const fileStat = await stat(filePath);
  if (!fileStat.isFile()) {
    throw new Error(`zip source file is not a file: ${filePath}`);
  }
}
