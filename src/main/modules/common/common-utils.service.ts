import { Injectable, Inject } from "@nestjs/common";
import { EntityManager } from "@mikro-orm/core";
import { Nocode, NocodeCache, NocodeRepository } from "../project/entities";
import { RequestStorage } from "../../middleware";
import { getNocodeBody } from "../../utils";
import { NOCODES_DIR } from "../../constants";

/**
 * 公共方法集：身份敏感、无法随产物拷贝的宿主能力收敛在这里，其他模块也可直接复用。
 * api 模块（混淆产物）以字符 token（@main/constants 的 COMMON_UTILS_SERVICE）注入本服务：
 * - getNocodeMeta：应用元信息查询（缓存 → 仓储 id/别名 → 回写缓存 → 计时）
 * - getNocodeBody：读应用 body（闭包宿主自己的 nocodesDir）
 * - requestStorage：RequestStorage 类本体（AsyncLocalStorage 实例身份必须在宿主侧）
 */
@Injectable()
export class CommonUtilsService {
  private readonly nocodeRepository: NocodeRepository;

  constructor(
    private readonly entityManager: EntityManager,
    @Inject(NOCODES_DIR) private readonly nocodesDir: string,
  ) {
    this.nocodeRepository = this.entityManager.getRepository(Nocode);
  }

  async getNocodeMeta(appSign: string) {
    let app = NocodeCache.get(appSign);
    if (!app) {
      const t0 = Date.now();
      app = await this.nocodeRepository.findOne({ id: appSign });
      const t1 = Date.now();
      if (!app) {
        app = await this.nocodeRepository.findOne({ apiAlias: appSign });
      }
      NocodeCache.set(app);
      const t2 = Date.now();
      RequestStorage.current.req.timing.findAppById = t1 - t0;
      RequestStorage.current.req.timing.findAppByAlias = t2 - t1;
    }
    return app;
  }

  getNocodeBody(nocodeId: string) {
    return getNocodeBody(this.nocodesDir, nocodeId);
  }

  get requestStorage() {
    return RequestStorage;
  }
}
