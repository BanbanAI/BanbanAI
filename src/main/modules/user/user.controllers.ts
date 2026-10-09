import { UserService } from "./user.service";
import { Body, Controller, Get, Post, Inject, Query, UseGuards } from '@nestjs/common'
import { Preferences } from "../common";
import { PREFERENCES } from "@main/constants";
import { osLocale } from 'os-locale';
import { AccountRole, ValidateMainUserOptions } from "@common/types/account";
import { NoLocalAuthGuard } from "../auth/guards";
import { AdminPermissionsGuard } from "../workbench/guards";

@Controller("user")
export class UserController {
  constructor(
    private readonly userService: UserService,
    @Inject(PREFERENCES) private readonly preferences: Preferences,
  ) { }

  @Get("data")
  @NoLocalAuthGuard()
  getUser() {
    return this.userService.getUser();
  }

  @Post("send-login-code")
  @NoLocalAuthGuard()
  async sendLoginCode(@Body("phone") phone: string, @Body("phoneArea") phoneArea: string) {
    return await this.userService.sendLoginCode(
      phone,
      phoneArea,
    );
  }

  @Post("login-by-phone")
  @NoLocalAuthGuard()
  async loginByPhone(@Body("phone") phone: string, @Body("code") code: string) {
    const user = await this.userService.loginByPhone(
      phone,
      code,
    );
    return {
      user: user.getInstance(),
      terminalOutLimit: user.isOutOfOnlineLimit(),
    }
  }

  @Post("login")
  @NoLocalAuthGuard()
  async login(@Body("username") username: string, @Body("password") password: string) {
    const user = await this.userService.loginByUsername(username, password);
    return {
      user: user.getInstance(),
      terminalOutLimit: user.isOutOfOnlineLimit(),
    }
  }

  @Post("login-by-token")
  @NoLocalAuthGuard()
  async loginByToken() {
    let user, errorMsg;
    if (this.preferences.get("loginToken")) {
      try {
        user = await this.userService.loginByToken();
      } catch (err) {
        errorMsg = err.message;
      }
    }
    if (!user && errorMsg) {
      throw new Error(errorMsg);
    }
    return user;
  }

  @Post("logout")
  @NoLocalAuthGuard()
  async logout() {
    return await this.userService.logout();
  }

  @Post("force-offline")
  @NoLocalAuthGuard()
  async forceOffline(@Body("sessionId") sessionId: string) {
    return await this.userService.forceOffline(sessionId)
  }

  @Post("clear-session")
  async clearSession(@Body("sessionId") sessionId: string) {
    if (!sessionId) return
    return await this.userService.clearSession(sessionId);
  }

  @Post("update-nickname")
  async updateNickname(@Body("nickname") nickname: string) {
    return await this.userService.actionUpdateNickname(nickname)
  }

  @Post("update-password")
  async updatePassword(@Body("oldPassword") oldPassword: string, @Body("newPassword") newPassword: string, @Body("code") code: string) {
    return await this.userService.actionUpdatePassword(oldPassword, newPassword, code)
  }

  @Post("send-recall-password-phone-code")
  async sendRecallPasswordPhoneCode(@Body("account") account: string, @Body("phoneArea") phoneArea: string) {
    return await this.userService.sendRecallPasswordPhoneCode(account, phoneArea)
  }

  @Post("send-recall-password-email-code")
  async sendRecalPasswordEmailCode(@Body("account") account: string) {
    return await this.userService.sendRecallPasswordEmailCode(account)
  }

  @Post("recall-password-verify-phone")
  async recallPasswordVerifyPhone(@Body("account") account: string, @Body("code") code: string, @Body("phoneArea") phoneArea: string) {
    return await this.userService.recallPasswordVerifyPhone(account, code, phoneArea)
  }

  @Post("recall-password-verify-email")
  async recallPasswordVerifyEmail(@Body("account") account: string, @Body("code") code: string) {
    return await this.userService.recallPasswordVerifyEmail(account, code)
  }

  @Post("recall-password")
  async recallPassword(@Body("account") account: string, @Body("password") password: string, @Body("password2") password2: string) {
    return await this.userService.recallPassword(account, password, password2)
  }

  @Post("get-recharge-payment-url")
  async rechargePaymentUrl(
    @Body("number") number: string,
    @Body("title") title: string,
    @Body("money") money: number,
    @Body("code") code?: string,
  ) {
    const userId = `${this.getUser().id}`;
    return this.userService.getRechargePaymentUrl({ number, userId, title, money, code });
  }

  @Post("charge-polling")
  async chargePolling(@Body("number") number: string) {
    return await this.userService.actionChargePolling(number);
  }

  @Post("change-domain")
  async changeDomain(@Body('domain') domain:string){
    return await this.userService.changeShareDomain(domain);
  }
  @Post("change-port")
  async changePort(@Body("port") port:number){
    return await this.userService.changeSharePort(port);
  }
  @Post("change-server-ip")
  async changeServerIp(@Body('ip') ip:string){
    return await this.userService.changeServerIp(ip);
  }
  @Post("change-server-port")
  async changeServerPort(@Body('port') port:number){
    return await this.userService.changeServerPort(port);
  }
  @Post("change-server-protocol")
  async changeServerProtocol(@Body('protocol') protocol:"http" | "https"){
    return await this.userService.changeServerProtocol(protocol);
  }
  @Get("server-protocol")
  async getServerProtocol(){
    return await this.userService.getServerProtocol();
  }
  @Post("change-server-certificate")
  async changeServerCertificate(@Body("type") type:"key" | "cert" | "ca", @Body("content") content?:string){
    return await this.userService.changeServerCertificate(type, content);
  }
  @Post("change-server-domain")
  async changeServerDomain(@Body('domain') domain:string){
    return await this.userService.changeServerDomain(domain);
  }
  @Post("reset-server-domain")
  async resetServerDomain(){
    return await this.userService.resetServerDomain();
  }
  @Post("restart-server")
  async restartServer(){
    return await this.userService.restartServer();
  }
  @Get("domain-port")
  async getDomainPort() {
    const res = await this.userService.getDomainPort();
    return res;
  }
  @Post("save-server-access-config")
  async saveServerAccessConfig(@Body("listen") listen?: number, @Body("baseURL") baseURL?: string, @Body("protocol") protocol?: "http" | "https") {
    return await this.userService.saveServerAccessConfig(listen, baseURL, protocol);
  }
  @Post("reset-sass-domain")
  async resetSaasDomain(){
    return await this.userService.resetSaasDomain();
  }

  @Post("change-sso-saml-cert")
  async changeSSOSamlCert(@Body('cert') cert:string){
    return await this.userService.changeSSOSamlCert(cert);
  }
  @Post("change-sso-saml-entry")
  async changeSSOSamlEntry(@Body('entry') entry:string){
    return await this.userService.changeSSOSamlEntry(entry);
  }
  @Post("change-sso-saml-sign-assertions")
  async changeSSOSamlSignAssertions(@Body('signAssertions') signAssertions:boolean){
    return await this.userService.changeSSOSamlSignAssertions(signAssertions);
  }
  @Post("change-sso-saml-sign-response")
  async changeSSOSamlSignResponse(@Body('signResponse') signResponse:boolean){
    return await this.userService.changeSSOSamlSignResponse(signResponse);
  }
  @Post("change-sso-saml-account-role")
  changeSSOSamlAccountRole(@Body('accountRole') accountRole: AccountRole) {
    return this.userService.changeSSOSamlAccountRole(accountRole);
  }

  @Post("set-proxy")
  async setProxy(@Body() proxyOptions){
    return  await this.userService.actionSetProxy(proxyOptions)
  }

  @Post("get-proxy")
  @NoLocalAuthGuard()
  async getProxy(){
    return this.preferences.get("proxy", { on: false });
  }

  @Get("clear-cache")
  async clearCache(){
    return await this.userService.actionClearCache();
  }

  @Post('save')
  save(@Body() body) {
    return this.userService.actionSave(body)
  }

  @Post('show-user-info-change')
  showUserInfoChange(@Body('isShowUserInfo') isShowUserInfo: boolean) {
    return this.userService.showUserInfoChange(isShowUserInfo);
  }

  @Get('is-show-user-info')
  @NoLocalAuthGuard()
  isShowUserInfo() {
    return this.userService.isShowUserInfo();
  }

  @Get("sync-user-info")
  @NoLocalAuthGuard()
  async syncUserInfo() {
    return this.userService.getUserInfo();
  }

  @Post('change-lang')
  async changLang(@Body('lang') lang: string) {
    this.preferences.set({lang: lang});
    if (lang) await global.i18next.changeLanguage(lang);
  }

  @Get('get-language')
  async getLanguage() {
    let lang = this.preferences.get("lang");
    return lang ? lang : await osLocale();
  }

  @Post('client-info')
  @NoLocalAuthGuard()
  async initLang(@Body('lang') lang: string) {
    const curr = this.preferences.get("lang");
    const final = !curr ? lang ? lang : await osLocale() : curr;
    if (final != curr) this.preferences.set({lang: final});
    if (final) await global.i18next.changeLanguage(final);
    return {lang: final, clientUUID: this.preferences.get("clientUUID")};
  }
  
  // ----------------------------------     server 编辑器     ----------------------------------

  @Post('validate-main-user')
  @NoLocalAuthGuard()
  async validateMainUser(@Body() options: ValidateMainUserOptions) {
    if (options.type === 'phone') {
      await this.userService.loginByPhone(options.phone, options.code);
    } else if (options.type === 'user') {
      await this.userService.loginByUsername(options.username, options.password);
    }
    // 校验是否符合;
    const user = this.getUser();
    return user;
  }

  @Post("complete-server-init")
  @NoLocalAuthGuard()
  async completeServerInit() {
    this.preferences.set({
      serverInitStepInfo: {
        step: "complete",
      }
    })
  }

  @Post("validate-server-init")
  @NoLocalAuthGuard()
  async validateServerInit() {
    return await this.userService.validateServerInit();
  }


  @Get("network-ips")
  @NoLocalAuthGuard()
  async getNetWorkIps() {
    return this.preferences.get('networkIps', ['']);
  }

  @Post("network-ips")
  async setNetWorkIps(@Body('ips') ips: string[]) {
    return this.preferences.set({ networkIps: ips });
  }

  @UseGuards(AdminPermissionsGuard)
  @Get("user-recharge-list")
  async getUserRechargeList(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("timeStart") timeStart?: string,
    @Query("timeEnd") timeEnd?: string,
  ) {
    const params: Record<string, string> = {};
    if (page !== undefined) params.page = page;
    if (limit !== undefined) params.limit = limit;
    if (timeStart !== undefined) params.timeStart = timeStart;
    if (timeEnd !== undefined) params.timeEnd = timeEnd;
    return await this.userService.getUserRechargeList(params);
  }

  @UseGuards(AdminPermissionsGuard)
  @Get("user-order-list")
  async getUserOrderList(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("timeStart") timeStart?: string,
    @Query("timeEnd") timeEnd?: string,
  ) {
    const params: Record<string, string> = {};
    if (page !== undefined) params.page = page;
    if (limit !== undefined) params.limit = limit;
    if (timeStart !== undefined) params.timeStart = timeStart;
    if (timeEnd !== undefined) params.timeEnd = timeEnd;
    return await this.userService.getUserOrderList(params);
  }

  @Get("get-is-show-tour")
  @NoLocalAuthGuard()
  gstIsShowTour() {
    return this.preferences.get("isShowTour", true)

  }

  @Post("set-is-show-tour")
  async setIsShowTour(@Body('isShowTour') isShowTour: boolean) {
    return this.preferences.set({ isShowTour });
  }

  @Get("get-db-info")
  async getDBInfo() {
    return await this.userService.getDBInfo();
  }

}
