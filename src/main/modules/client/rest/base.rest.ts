import { Injectable, Inject, Logger } from "@nestjs/common";
import axios, { AxiosRequestConfig } from "axios";
import md5 from "md5";
import { Preferences } from "../../common";
import { PREFERENCES, SERVER_ENDPOINT } from "@main/constants";
import { UserWrapper } from "../../user/components/user-wrapper.component";
import dayjs from "dayjs";
import { unique } from "@common/utils/unique";

@Injectable()
export class Rest {
  protected readonly logger = new Logger("Rest");

  constructor(
    @Inject(SERVER_ENDPOINT) private readonly serverEndpoint: string,
    @Inject(PREFERENCES) private readonly preferences: Preferences,
    @Inject("USER") private user: UserWrapper
  ) { }

  async post(url: string, data = {}, config: AxiosRequestConfig = {}, onlyData = true) {
    if (!/^https?:\/\//i.test(url)) {
      url = this.serverEndpoint + url;
    }
    let ua =
      "Banban Client version " + __APP_VERSION__ + " " + process.platform + " community";
    if (!config.headers) {
      config.headers = {};
    }
    config.headers["User-Agent"] = ua;
    config.headers["Content-Type"] = "application/json";
    config.headers["v3"] = true;
    // TODO axios 没有 compressed rejectUnauthorized 配置项
    // options.compressed = true;
    // options.rejectUnauthorized = false;
    let proxy = this.preferences.getAxiosProxy();
    if (proxy?.on) config.httpsAgent = proxy.httpsAgent;

    const res = await axios.post(url, data, config);
    if (res.status >= 400) {
      console.log("statusCode", res.status, res.statusText);
      this.logger.log(
        "POST ",
        url,
        "\n",
        res.status,
        res.statusText,
        "\n",
        res.data
      );
      throw new Error(res.status + " " + res.statusText);
    }
    return onlyData ? res.data : res;
  }

  async get(url: string, config: AxiosRequestConfig = {}, onlyData = true) {
    if (!/^https?:\/\//i.test(url)) {
      url = this.serverEndpoint + url;
    }
    let ua =
      "Banban Client version " + __APP_VERSION__ + " " + process.platform + " " + "community";
    if (!config.headers) {
      config.headers = {};
    }
    config.headers["User-Agent"] = ua;
    config.headers["v3"] = true;
    
    // TODO axios 没有 compressed rejectUnauthorized 配置项
    // compressed: true,
    // rejectUnauthorized: false,
    let proxy = this.preferences.getAxiosProxy();
    if (proxy?.on) config.httpsAgent = proxy.httpsAgent;
    const res = await axios.get(url, config);
    if (res.status >= 400) {
      console.log("statusCode", res.status, res.statusText);
      this.logger.log(
        "GET ",
        url,
        "\n",
        res.status,
        res.statusText,
        "\n",
        res.data
      );
      throw new Error(res.status + " " + res.statusText);
    }
    return onlyData ? res.data : res;
  }

  sign(url: string) {
    if(url.indexOf("?") === -1) url += "?";
    const key = this.user.get("key");
    const secret = this.user.get("secret");
    const timestamp = Math.floor(new Date().getTime() / 1000);
    const sign = md5(key + timestamp + secret);
    
    let urlPostfix = "userKey=" + key + "&timestamp=" + timestamp + "&sign=" + sign;
    if (!/\?$/.test(url)) {
      urlPostfix = "&" + urlPostfix;
    }
    return url + urlPostfix;
  }

  url(url: string): string {
    if (!/^https?:\/\//i.test(url)) {
      url = this.serverEndpoint + url;
    }
    return url;
  }

  smsSign(url: string, phone: string): string {
    const timestamp = dayjs().unix();
    const salt = "duosuan@@";
    const str = unique(18);
    const sign = md5(phone + str + timestamp + salt);
    return url + `?sign=${sign}&timestamp=${timestamp}&key=${str}`;
  }
}
