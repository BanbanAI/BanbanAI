import { ElMessage } from "element-plus";
import i18next from "i18next";

export type DownloadInfo = {
  url: string,
  name?: string,
  target?: "_blank" | "_parent" | "_top",
}
export const doDownload = (info: DownloadInfo) => {
  if (info) {
    const a = document.createElement("a");
    // 指定生成的文件名
    info.name && (a.download = info.name);
    info.target && (a.target = info.target);
    a.href = info.url;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } else {
    ElMessage.warning(i18next.t("downloadTs.downloadFailed"));
  }
}