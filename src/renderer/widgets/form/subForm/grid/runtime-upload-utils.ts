import { getBuiltinWidgetAsset } from "@renderer/widgets/assets";

export type RuntimeUploadDisplayItem = {
  uid: string;
  name: string;
  url: string;
  size?: number;
  isImage: boolean;
  isVideo: boolean;
  isMedia: boolean;
  pending?: boolean;
  percent?: number;
};

const IMAGE_EXTENSIONS = [
  "bmp", "jpg", "jpeg", "png", "tif", "gif", "pcx", "tga", "exif", "fpx",
  "svg", "psd", "webp", "avif", "apng", "ico",
];
const VIDEO_EXTENSIONS = ["mp4", "avi", "mov", "rmvb", "mkv", "wmv", "flv", "avchd", "webm"];
const MEDIA_EXTENSIONS = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS, "pdf"];

const FILE_ICON_EXTENSIONS: Record<string, string> = {
  docx: "word.png", doc: "word.png", dotx: "word.png", docm: "word.png",
  xlsx: "excel.png", xls: "excel.png", xlsm: "excel.png", xml: "excel.png",
  ppt: "ppt.png", pptx: "ppt.png", pptm: "ppt.png",
  pdf: "pdf.png",
  wav: "audio.png", mp3: "audio.png", wma: "audio.png", ape: "audio.png",
  flac: "audio.png", ogg: "audio.png", aac: "audio.png",
  zip: "zip.png", rar: "zip.png", "7z": "zip.png", gzip: "zip.png", bzip2: "zip.png",
  txt: "txt.png",
};

export const getUploadFileExtension = (name: string) => {
  const index = name.lastIndexOf(".");
  return index > -1 ? name.slice(index + 1).toLowerCase() : "";
};

export const isImageFile = (name: string) => IMAGE_EXTENSIONS.includes(getUploadFileExtension(name));
export const isVideoFile = (name: string) => VIDEO_EXTENSIONS.includes(getUploadFileExtension(name));
export const isMediaFile = (name: string) => MEDIA_EXTENSIONS.includes(getUploadFileExtension(name));

export const isImageUploadFile = (file: File) => (
  file.type ? file.type.startsWith("image/") : isImageFile(file.name)
);

export const getUploadFileIcon = (name: string, url = "") => {
  if (isImageFile(name)) return url || getBuiltinWidgetAsset("widget.form.file-uploader", "fileTypeImg/image.png");
  const icon = FILE_ICON_EXTENSIONS[getUploadFileExtension(name)];
  return getBuiltinWidgetAsset("widget.form.file-uploader", `fileTypeImg/${icon || "unrecognized.png"}`);
};

export const formatUploadSize = (size?: number) => {
  if (!Number.isFinite(size) || !size || size <= 0) return "";
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)}KB`;
  return `${(size / (1024 * 1024)).toFixed(1)}MB`;
};

export const createUploadDisplayItem = (input: {
  name: string;
  url?: string;
  size?: number;
  uid?: string;
  pending?: boolean;
  percent?: number;
}): RuntimeUploadDisplayItem => ({
  uid: input.uid ?? `runtime-upload-${input.name}`,
  name: input.name,
  url: input.url ?? "",
  size: input.size,
  isImage: isImageFile(input.name),
  isVideo: isVideoFile(input.name),
  isMedia: isMediaFile(input.name),
  pending: input.pending,
  percent: input.percent,
});

export const normalizeUploadItems = (value: unknown): RuntimeUploadDisplayItem[] => {
  const values = Array.isArray(value) ? value : value && typeof value === "object" ? [value] : [];
  return values.flatMap((raw, index) => {
    if (typeof raw === "string") {
      return [createUploadDisplayItem({ name: raw, url: raw, uid: `runtime-upload-${index}` })];
    }
    if (!raw || typeof raw !== "object") return [];
    const record = raw as Record<string, unknown>;
    const size = Number(record.size);
    const previewUrl = String(record.previewUrl || "");
    return [createUploadDisplayItem({
      name: String(record.name ?? record.fileName ?? record.url ?? ""),
      url: previewUrl && !previewUrl.startsWith("blob:") ? previewUrl : String(record.url || ""),
      size: Number.isFinite(size) ? size : undefined,
      uid: String(record.uid ?? `runtime-upload-${index}`),
    })];
  });
};

export const downloadUploadItem = (item: { url?: string; name: string }) => {
  const url = String(item.url || "");
  if (!url) return;
  void fetch(url)
    .then(response => response.blob())
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = item.name;
      document.body.appendChild(link);
      link.click();
      URL.revokeObjectURL(blobUrl);
      link.remove();
    })
    .catch(() => undefined);
};
