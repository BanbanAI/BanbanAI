export type Coupon = {
  code: string,   // 优惠券代码，唯一字符
  description: string,    //优惠券描述
  amount: number,     // 优惠券面值
  unit: string,   // 优惠券面值单位
  overlayUsage: boolean,  // 是否可叠加使用
  expireTime: number, //  过期时间
  minPayment?: number,    // 最低消费金额
  usageType: "plan" | "coin" | "general" | "deploy", // 私有云套餐 | 鲸币 | 通用
}
export const DefaultSaasSeats = 100_0000;
export class User {
  registerTime?: number;  // 注册时间戳
  portrait?: string;  // 头像地址
  author?: number;

  constructor(
    public id = 0,
    public nickname = "",

    public loginName = "",    // 账号名
    public staff = "",  
    public key = "",    // 用户标识
    public keyAlias = "",     // 自定义用户标识
    public secret = "",
    public money = 0,     // 余额(单位：分)
    public sessionId = "",
    public sessions: object = {},
    public present = 0,
    public phone = "",  
    public noPassword = false,  // 不需要密码
    public coin = 0,    // 鲸币
    public onlineLimit = 1,   // 最大在线终端数量
    public saas = false,     //  是否开通saas
    public saasPlan: SaasPlan = SaasPlan.FREE,  // Saas套餐
    public saasSeats = DefaultSaasSeats,   // 子账号席位数
    public timeSaasEnd = 0, // saas到期时间
    public time_pay = 0,
    public coupons: Coupon[] = [],    // 优惠券
    public projectQuota = 500,

    public reportOnlineLimit = 100, // 报表门户登录并发数
    public nocodeOnlineLimit = 100, // nocode登录并发数
    public isQuotaPack = false, // 是否可以选择 打包到期时间跟saas一致
  ) { }
}

// export type UserType = typeof User
// export type UserType = typeof User["prototype"]
export type UserType = { [T in keyof User]: User[T] };

export enum SaasPlan {
  FREE = "FREE",
  PREMIUM = "PREMIUM",
  PROFESSIONAL = "PROFESSIONAL",
  BUSINESS = "BUSINESS",
  ENTERPRISE = "ENTERPRISE",
}

export enum SaasPlanLevel {
  FREE = 0,
  PREMIUM = 1,
  PROFESSIONAL = 1,
  BUSINESS = 2,
  ENTERPRISE = 3,
}

export function saasPlanToLevel(plan: SaasPlan): SaasPlanLevel {
  switch(plan) {
    case SaasPlan.FREE: return SaasPlanLevel.FREE;
    case SaasPlan.PREMIUM: return SaasPlanLevel.PREMIUM;
    case SaasPlan.PROFESSIONAL: return SaasPlanLevel.PROFESSIONAL;
    case SaasPlan.BUSINESS: return SaasPlanLevel.BUSINESS;
    case SaasPlan.ENTERPRISE: return SaasPlanLevel.ENTERPRISE;
    default: SaasPlanLevel.FREE;
  }
}

export type SaasOptions = {
  saas?: SaasPlan,
  saasDuration?: number,
  saasDurationType?: 'day' | 'month' | 'year',
  saasSeat?: number,
  payType?: 'coin' | 'money',
}

export type ThemeType = "PAYED" | "COLLECT";

export type ProxyOptions = {
  on: boolean,
  host: string,
  port: number,
  username?: string,
  password?: string,
}
