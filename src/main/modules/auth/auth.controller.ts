import { Controller, Post, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { AuthService } from "./auth.service";
import { LocalAuthGuardLogin, SessionRefreshGuard } from "./guards";


@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) { }

  @Post("auth/login")
  @LocalAuthGuardLogin()
  async login(@Req() req: Request) {
    return {
      account: req.account,
      user: this.authService.getUser(),
    };
  }

  @Post("auth/logout")
  async logout(@Req() req: Request) {
    await this._logout(req);
    return {};
  }

  @Post("auth/check-login")
  @UseGuards(SessionRefreshGuard)
  async checkLogin(@Req() req: Request) {
    this.authService.addAccountRecord(req.account.id);
    return {
      valid: true,
      account: req.account,
      user: this.authService.getUser(),
    };
  }

  private _logout(req: Request) {
    return new Promise<void>((resolve, reject)=>{
      req.logout({}, (err)=>{
        err ? reject(err) : resolve();
      });
    });
  }

}
