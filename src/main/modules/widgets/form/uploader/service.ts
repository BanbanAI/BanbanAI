import { Injectable, Inject } from "@nestjs/common";
import { REPORTS_DIR, NOCODES_DIR, PROJECTS_DIR, UPLOADS_DIR } from "@main/constants";
import { USER_CONTEXT, UserContext } from "@main/modules/user/user-context/user.context";
import { writeFile, mkdir, copyFile, cp, readFile, rm, stat, readdir, rename, rmdir } from "fs/promises";
import path, { join, basename, dirname, extname } from "path";
import { getFileMd5 } from '@main/utils/md5';

@Injectable()
export class UploaderService {
  constructor(
    @Inject(UPLOADS_DIR) private readonly uploadsDir: string,
  ) {}


  public async uploadFile(file, fileMessage) {
    let filename = fileMessage.filename;
    const nocodeId = fileMessage.nocodeId;
    const destDir = path.join(this.uploadsDir, nocodeId)

    const ext = path.extname(filename);
    const basename = path.basename(filename, ext);
    filename = `${basename}_${Date.now()}${ext}`;

    // 文件夹不存在即创建文件夹
    try {
      await mkdir(destDir, { recursive: true });
    } catch (error) {
      //ignored
    }
    //写入文件
    try {
      const fileMd5 = await getFileMd5(file.path);
      const finalFilename = `${fileMd5}${ext}`;
      const filePath = path.join(destDir, finalFilename);
      await cp(file.path, filePath, { recursive: true });
      await rm(file.path);
      return { url: `uploads/${nocodeId}/${finalFilename}`, md5: fileMd5};
    } catch (error) {
      console.error(error);
      return { url: null };
    }
  }


}
