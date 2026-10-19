import { Global, Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { getRuntime } from "@main/runtime";
import { PREFERENCES, COMMON_UTIL, COMMON_UTILS_SERVICE } from "@main/constants";
import { Preferences } from "./components/preferences.component";
import { readFile } from "fs/promises";
import { join } from "path";
import { GlobalExceptionFilter } from "./filters/global-exception.filter";
import { CommonUtil } from "./common.util";
import { CommonUtilsService } from "./common-utils.service";

@Global()
@Module({
  providers: [
    CommonUtilsService,
    { provide: COMMON_UTILS_SERVICE, useExisting: CommonUtilsService },
    {
      provide: PREFERENCES,
      async useFactory() {
        const userDataPath = await getRuntime().getUserDataPath();
        let prop  = {};
        try {
          const jsonFile = await readFile(join(__dirname, "../locales/preferences.json"), {encoding:"utf-8"});
          prop = JSON.parse(jsonFile);
        } catch(err) {}
        return new Preferences(prop, {
          cwd: userDataPath,
          configName: "Pref",
          fileExtension: "",
          encryptionKey: "shanhaibipreferences",
        });
      },
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    CommonUtil,
    {
      provide: COMMON_UTIL,
      async useFactory(commonUtil: CommonUtil) {
        return commonUtil;
      },
      inject: [CommonUtil],
    },
  ],
  exports: [ PREFERENCES, COMMON_UTIL, COMMON_UTILS_SERVICE ],
})
export class CommonModule {}
