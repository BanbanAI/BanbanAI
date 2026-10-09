import { Module, Global, NestModule, MiddlewareConsumer } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { PassportModule } from "@nestjs/passport";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { SessionMiddleware } from "./middlewares";
import { LocalAuthGuard } from "./guards";
import { LocalStrategy } from "./strategies/local.strategy";
import { SessionSerializer } from "./serializers";
import { NocodeMiddleware } from "./middlewares/nocode.middleware";
import { ProjectModule } from "../project";

@Global()
@Module({
  imports: [
    ProjectModule,
    PassportModule.register({ session: true, property: "account" }),
  ],
  controllers: [ AuthController ],
  providers: [ 
    { provide: APP_GUARD, useClass: LocalAuthGuard },
    LocalStrategy,
    SessionSerializer,
    AuthService,
  ],
  exports: [ AuthService ],
})
export class AuthModule implements NestModule {
  async configure(consumer: MiddlewareConsumer) {
    consumer.apply(NocodeMiddleware, SessionMiddleware).forRoutes("*");
  }
}