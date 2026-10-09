import { Injectable, Logger, Inject } from "@nestjs/common"
import { Rest } from "./base.rest"
import { PREFERENCES } from "@main/constants";
import { Preferences } from "../../common";

type RechargePaymentUrlOptions = {
  number: string,
  userId: string,
  title: string,
  money: number,
  code?: string,
}

@Injectable()
export class UserRest {
  private readonly logger = new Logger('UserRest');
  constructor(
    @Inject(PREFERENCES) private readonly preferences: Preferences,
    private readonly rest: Rest,
  ) { }

  private loadSessionsFormJson(sessionsJson: string) {
    let sessions = {};
    try {
      sessions = JSON.parse(sessionsJson);
    } catch (err) { }
    for (let sessionId in sessions) {
      let parsedSession = JSON.parse(sessions[sessionId]);
      sessions[sessionId] = {
        clientIdentifier: parsedSession.client_identifier,
        lastVersion: parsedSession.last_version,
        loginTime: parsedSession.login_time
      };
    }
    return sessions;
  }

  async loginByUsername(username: string, password: string, clientIdentifier: string, sessionId: string, prevSessionId: string, clientUUID: string) {
    let res = await this.rest.post("/user/login", {
      username,
      password,
      sessionId,
      clientIdentifier,
      prevSessionId,
      remember: true,
      clientUUID,
    });
    if (res.code === 0) {
      return {
        user: res.data.user,
        loginToken: res.data.loginToken,
        sessions: this.loadSessionsFormJson(res.data.sessions),
        onlineLimit: res.data.onlineLimit,
      };
    }
    this.logger.debug("loginByUsername failed: ", res.code, res.reason);
    throw new Error(res.reason);
  }

  async loginByToken(loginToken: string, clientIdentifier: string, sessionId: string, prevSessionId: string, clientUUID: string) {
    let res = await this.rest.post("/user/login", {
      loginToken,
      sessionId,
      clientIdentifier,
      prevSessionId,
      clientUUID,
    });
    if (res.code === 0) {
      return {
        user: res.data.user,
        sessions: this.loadSessionsFormJson(res.data.sessions),
        onlineLimit: res.data.onlineLimit,
      };
    }
    this.logger.debug("loginByToken failed:", res.code, res.reason);
    throw new Error(res.reason);
  }

  async loginByPhone(
    phone: string,
    code: string,
    remember: boolean,
    sessionId: string,
    clientIdentifier: string,
    prevSessionId: string,
    clientUUID: string,
    channel: string,
  ) {
    let res = await this.rest
      .post("/user/login-by-phone", {
        phone,
        code,
        remember,
        sessionId,
        clientIdentifier,
        prevSessionId,
        clientUUID,
        channel,
      })
    if (res.code === 0) {
      return {
        user: res.data.user,
        loginToken: res.data.loginToken,
        sessions: this.loadSessionsFormJson(res.data.sessions),
        onlineLimit: res.data.onlineLimit,
      }
    }
    this.logger.debug("loginByPhone failed:", res.code, res.reason);
    throw new Error(res.reason);
  }

  async sendLoginCode(phone: string, phoneArea: string) {
    let res = await this.rest.post(this.rest.smsSign("/user/login-sms-send-v2", phone), {
      phone,
      phoneArea,
    });
    if (res.code === 0) {
      return res.data;
    }
    this.logger.debug("sendLoginCode failed:", res.code, res.reason);
    throw new Error(res.reason);
  }

  async clearSession(sessionId) {
    let res = await this.rest.post(this.rest.sign("/user/clear-session"), {
      sessionId
    })
    if (res.code === 0) {
      return res.data;
    }
    this.logger.debug("offline failed:", res.code, res.reason);
    throw new Error(res.reason);
  }

  async forcedOfflineDetection(sessionId: string, accounts: number) {
    let res = await this.rest
      .post(this.rest.sign("/user/offline-detection"), {
        sessionId,
        accounts,
      });
    if (res.code === 0) {
      return {
        valid: res.data.valid,
        user: res.data.user,
      }
    }
    this.logger.debug("checkUserInterval failed:", res.code, res.reason);
    throw new Error(res.reason);
  }

  async updateNickname(nickname: string){
    let res = await this.rest.get(this.rest.sign("/user/update-nickname?nickname=" + encodeURIComponent(nickname)));
    if (res.code === 0) {
      return res.data.user
    }
    this.logger.debug("updateNickname failed: ", res.code, res.reason);
    throw new Error(res.reason);
    
  }
  
  async updatePassword(oldPassword: string, newPassword: string, code: string) {
    let params: { password: string, passwordOld?: string, code?: string } = {
      password: newPassword
    }
    if (oldPassword) {
      params.passwordOld = oldPassword
    } else {
      params.code = code
    }
    let res = await this.rest.post(this.rest.sign("/user/change-password"),params)
    if (res.code === 0) {
      return res?.data?.user;
    }
    this.logger.debug("updatePassword failed: ", res.code, res.reason);
    throw new Error(res.reason);
    
  }

  async chargePolling(number:string){
    let res = await this.rest.get(this.rest.sign("/user/charge-polling?number=" + number));
    if (res.code === 0) {
      return res.data
    }
    this.logger.debug("changePlanSubmit failed: ", res.code, res.reason);
    throw new Error(res.reason);
  }

  async sendRecallPasswordPhoneCode(account: string, phoneArea: string) {
    let res = await this.rest.post(this.rest.smsSign("/user/send-recall-password-phone-code", account), {
      phone: account,
      phoneArea
    })
    if (res.code === 0) {
      return res.data;
    }
    this.logger.debug("sendRecallPasswordPhoneCode failed:", res.code, res.reason);
    throw new Error(res.reason);
  }

  async sendRecallPasswordEmailCode(account: string) {
    let res = await this.rest.post("/user/send-recall-password-email-code", { email: account })
    if (res.code === 0) {
      return res.data;
    }
    this.logger.debug("sendRecalPasswordEmailCode failed:", res.code, res.reason);
    throw new Error(res.reason);
  }

  async recallPasswordVerifyPhone(account: string, code: string, phoneArea: string) {
    let res = await this.rest.post("/user/recall-password-verify-phone", {
      phone: account,
      code: code,
      phoneArea
    })
    if (res.code === 0) {
      return res.data;
    }
    this.logger.debug("recallPasswordVerifyPhone failed:", res.code, res.reason);
    throw new Error(res.reason);
  }

  async recallPasswordVerifyEmail(account: string, code: string) {
    let res = await this.rest.post("/user/recall-password-verify-email", {
      email: account,
      code: code
    })
    if (res.code === 0) {
      return res.data;
    }
    this.logger.debug("recallPasswordVerifyEmail failed:", res.code, res.reason);
    throw new Error(res.reason);
  }

  async recallPassword(account: string, password: string, password2: string) {
    let res = await this.rest.post("/user/recall-password", {
      password: password,
      password2: password2,
      recallAccount: account
    })
    if (res.code === 0) {
      return res.data;
    }
    this.logger.debug("recallPassword failed:", res.code, res.reason);
    throw new Error(res.reason);
  }

  getDownloadThemeUrl(themeMd5: string) {
    return this.rest.url(this.rest.sign("/theme/download-theme?md5=" + themeMd5));
  }

  async checkTheme(themeMd5: string) {
    const res = await this.rest.get(this.rest.sign(`/theme/check-theme?md5=${themeMd5}`));
    if (res.code === 0) {
      return res.data;
    }
    throw new Error(res.reason);
  }

  async getRechargePaymentUrl(options: RechargePaymentUrlOptions) {
    const searchParams = new URLSearchParams({
      number: options.number,
      userId: options.userId,
      title: options.title,
      money: `${options.money}`,
    });
    if (options.code) {
      searchParams.set("code", options.code);
    }
    searchParams.set("type", "coin");
    return `https://payment.shanhaibi.com/banban/payment/scan?${searchParams.toString()}`;
  }

  async getUserRechargeList(params: Record<string, string>) {
    const query = new URLSearchParams(params).toString();
    const res = await this.rest.get(this.rest.sign(`/user/user-recharge-list?${query}`));
    if (res.code === 0) {
      return res.data;
    }
    this.logger.debug("getUserRechargeList failed: ", res.code, res.reason);
    throw new Error(res.reason);
  }

  async getUserOrderList(params: Record<string, string>) {
    const query = new URLSearchParams(params).toString();
    const res = await this.rest.get(this.rest.sign(`/user/user-order-list?${query}`));
    if (res.code === 0) {
      return res.data;
    }
    this.logger.debug("getUserOrderList failed: ", res.code, res.reason);
    throw new Error(res.reason);
  }

  async getBannerList(options) {
    const res = await this.rest.get(`/banner/get-banner-list?category=${options.category}&status=PUBLISHED`)
    if (res.code === 0) {
      return res.data
    }
    this.logger.debug("getBannerList failed: ", res.code, res.reason);
    throw new Error(res.reason);
    
  }

  async getPreference(name: string) {
    const res = await this.rest.get(`/preference/get-preference?name=${encodeURIComponent(name)}`, {
      timeout: 5000,
    });
    if (res.code === 0) {
      return res.data;
    }
    this.logger.debug("getPreference failed: ", res.code, res.reason);
    throw new Error(res.reason);
  }

  async sendUserData(userInfo) {
    this.rest.post(`/user/set-user-info`, userInfo).catch((err)=> {});
  }
}
