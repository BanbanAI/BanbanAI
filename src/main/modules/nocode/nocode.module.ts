import { Module, OnApplicationBootstrap, OnModuleInit, MiddlewareConsumer, Global } from '@nestjs/common';
import { NocodeController } from './nocode.controller';
import { NocodeService } from './nocode.service';
import { MikroORM, UseRequestContext } from '@mikro-orm/core';
import { MainSignInterceptor } from './Interceptors/sign.Interceptor';
import { ProjectModule } from '../project';
import { APP_INTERCEPTOR } from "@nestjs/core";

@Global()
@Module({
  imports: [ProjectModule],
  controllers: [NocodeController],
  providers: [
    NocodeService,
    {
      provide: APP_INTERCEPTOR,
      useClass: MainSignInterceptor,
    }
  ],
  exports: [NocodeService],
})
export class NocodeModule implements OnApplicationBootstrap, OnModuleInit  {
  constructor(
    private readonly orm: MikroORM, // used by @UseRequestContext()
  ) {
  }
  @UseRequestContext()
  onApplicationBootstrap() {
  };
  onModuleInit() {
  }
}
