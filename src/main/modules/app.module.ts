import { DynamicModule, Module, ModuleMetadata, NestModule, MiddlewareConsumer } from '@nestjs/common'
import { CommonModule } from './common/common.module'
import * as projectEntities from './project/entities'
import * as WorkbenchEntities from "./workbench/entities";
import * as FormDataEntities from "./formData/entities";
import * as AiEntities from './ai/entities'
import { ProjectModule } from './project'
import { UserModule } from './user'
import { MarketModule } from './market'
import { ClientModule } from './client'
import { ScheduleModule } from '@nestjs/schedule'
import { NocodeModule } from './nocode/nocode.module'
import { WorkbenchModule } from "./workbench";
import { AuthModule } from "./auth/auth.module";
import {ApiModule} from "./api/api.module"
import { AiModule } from './ai'
import { MikroOrmMiddleware } from '@mikro-orm/nestjs'
import { FormDataModule } from './formData/form-data.module';
import { LogMiddleware, RequestStorageMiddleware, CorsMiddleware, MethodOverrideMiddleware } from '@main/middleware';
import { OfficeModule } from './office/office.module';
import { WidgetsModule } from './widgets/widgets.module';

export const entities = [ ...Object.values(projectEntities), ...Object.values(WorkbenchEntities), ...Object.values(FormDataEntities), ...Object.values(AiEntities) ];

const appImports = [
  CommonModule,
  ClientModule,
  ProjectModule,
  UserModule,
  AuthModule,
  MarketModule,
  WidgetsModule,
  NocodeModule,
  WorkbenchModule,
  ApiModule,
  AiModule,
  FormDataModule,
  OfficeModule,
  ScheduleModule.forRoot(),
];

@Module({ imports: appImports })
export class AppModule implements NestModule {
  static register(imports: ModuleMetadata["imports"] = []): DynamicModule {
    return {
      module: AppModule,
      imports: [...appImports, ...imports],
    };
  }

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestStorageMiddleware).forRoutes('*');
    consumer.apply(LogMiddleware).forRoutes("*");
    consumer.apply(CorsMiddleware).forRoutes('/api/');
    consumer.apply(MethodOverrideMiddleware).forRoutes('/api/*');
    consumer.apply(MikroOrmMiddleware).forRoutes("*");
  }
}
