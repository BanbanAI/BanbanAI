import { DefaultSaasSeats, SaasPlan, User } from "@common/types/user"
import dayjs from "dayjs";

export class UserWrapper {
  private user: User;
  public valid: boolean = true;
  constructor() {
    this.init();
  }

  init() {
    this.user = new User();
  }

  load(obj) {
    const planUser = !!obj.plan && obj.plan !== SaasPlan.FREE;
    if (obj) {
      this.user.id = obj.id || 0;
      this.user.nickname = obj.nameNick;
      this.user.loginName = obj.nameLogin;
      this.user.staff = obj.staff;
      this.user.key = obj.key;
      this.user.keyAlias = obj.keyAlias;
      this.user.secret = obj.secret;
      this.user.money = obj.money || 0;
      this.user.portrait = obj.portrait;
      this.user.author = obj.author || 0;
      obj.present && (this.user.present = obj.present);
      this.user.phone = obj.phone;
      this.user.noPassword = obj.noPassword;
      obj.coin && (this.user.coin = obj.coin);
      obj.registerTime && (this.user.registerTime = obj.timeRegister * 1000);
      this.user.time_pay = obj.timePay || 0;
      this.user.coupons = obj.coupons || [];
      this.user.projectQuota = obj.quotaProject;
      this.user.isQuotaPack = obj.isQuotaPack || false;

      this.user.saas = planUser ? true : false;
      this.user.saasPlan = obj.plan ? obj.plan : SaasPlan.FREE;
      this.user.saasSeats = planUser ? obj.saasSeats || 0 : DefaultSaasSeats;
      this.user.timeSaasEnd = planUser ? obj.timePlanEnd : dayjs().add(100, "year").unix();
    }
    return this;
  }

  update(user: Partial<User>) {
    for (let property in user) {
      this.user[property] = user[property]
    }
    return this;
  }

  getInstance() {
    return this.user;
  }

  get<T extends keyof User>(key: T): User[T] {
    return this.user[key];
  }

  isOutOfOnlineLimit() {
    return Object.keys(this.user.sessions).length > this.user.onlineLimit;
  }

  isLogin() {
    return !!this.user.id && this.user.id !== 0;
  }

}
