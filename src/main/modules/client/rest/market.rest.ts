import { Injectable, Logger } from "@nestjs/common";
import { Rest } from "./base.rest";
import { SaasPlan, ThemeType } from "@common/types/user";

@Injectable()
export class MarketRest {
  private readonly logger = new Logger('MarketRest');
  constructor(
    private readonly rest: Rest
  ) {}

  async findThemeList(keyword: string, category: string, sort: string, page: Number, plan: SaasPlan, themeType: ThemeType, isBest: boolean | 'all') {
    let url = `/theme/get-theme-list-v2?keyword=${keyword}&category=${category}&sort=${sort}&page=${page}&plan=${plan}&themeType=${themeType}&limit=50&clientVersion=${__APP_VERSION__}`;
    if (isBest !== 'all') {
      url += `&isBest=${ isBest ? 1 : 0 }`;
    }
    let res = await this.rest.get(this.rest.sign(url));
    if (res.code === 0) {
      return {
        list: res.data.themes,
        count: res.data.count,
      };
    }
    this.logger.debug("findThemeList failed: ", res.code, res.reason);
    throw new Error(res.reason);

  }

  async findWidgetList(keyword: string, sort: string, page: Number) {
    const url = `/widget/get-widget-list?keyword=${keyword}&sort=${sort}&page=${page}&limit=50&clientVersion=${__APP_VERSION__}`
    let res = await this.rest.get(url);
    if (res.code === 0) {
      return {
        list: res.data.widgets,
        count: res.data.count,
      };
    }
    this.logger.debug("findWidgetList failed: ", res.code, res.reason);
    throw new Error(res.reason);
  }

  async getThemePreference() {
    let url =`/theme/get-theme-preference?name=web_sotre_theme&clientVersion=${__APP_VERSION__}`;
    let res = await this.rest.get(url);
    if (res.code === 0) {
      return res.data as string[];
    }
    this.logger.debug("getThemePreference failed: ", res.code, res.reason);
    throw new Error(res.reason);
  }

  async getWidgetPreference() {
    let url =`/theme/get-theme-preference?name=web_sotre_widget&clientVersion=${__APP_VERSION__}`;
    let res = await this.rest.get(url);
    if (res.code === 0) {
      return res.data as string[];
    }
    this.logger.debug("getWidgetPreference failed: ", res.code, res.reason);
    throw new Error(res.reason);
  }

  async setCollectTheme(themeId: number) {
    const res = await this.rest.post(this.rest.sign(`/theme/set-collect-theme`), { themeId });
    if (res.code === 0) {
      return res.data;
    }
    this.logger.debug("setCollectTheme: ", res.code, res.reason);
    throw new Error(res.reason);
  }
}
