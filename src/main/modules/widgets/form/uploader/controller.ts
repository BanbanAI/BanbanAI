import { Inject, Body, Controller, Get, Post, Query, UseInterceptors, UploadedFile, Request, Param, Res, Response as _Response, UploadedFiles, UseGuards } from "@nestjs/common";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { USER_CONTEXT, UserContext } from "@main/modules/user/user-context/user.context";
import { NoLocalAuthGuard } from "@main/modules/auth/guards/local-auth.guard";
import { UploaderService } from "./service";
import { diskStorage } from 'multer';
import * as os from "os";
import { existsSync } from "fs";
import { join, parse } from "path";

let uploaderController: UploaderController;
export { uploaderController }

@NoLocalAuthGuard()
@Controller("uploader")
export class UploaderController {
  constructor(
    @Inject("UPLOADER_SERVICE") private readonly uploaderService: UploaderService,
    @Inject(USER_CONTEXT) private readonly userContext: UserContext,
  ) {
    uploaderController = this;
  }

  @Post("uploadFile")
  @UseInterceptors(FileInterceptor("file", {
    storage: diskStorage({
      destination: os.tmpdir(),
      filename: (req: Request, file, cb: Function) => {
        // 保持原始文件名，如果文件已存在则添加数字后缀
        let filename = file.originalname;
        let counter = 1;
        while (existsSync(join(os.tmpdir(), filename))) {
          const nameWithoutExt = parse(file.originalname).name;
          const ext = parse(file.originalname).ext;
          filename = `${nameWithoutExt}_${counter}${ext}`;
          counter++;
        }
        cb(null, filename);
      }
    })
  }))
  uploadModelFile(@Body() data, @UploadedFile() file) {
    return this.uploaderService.uploadFile(file, data);
  }
}
