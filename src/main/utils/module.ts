import { User } from "@common/types/user"
import { DynamicModule, Global, Module, ValueProvider, FactoryProvider } from "@nestjs/common"

export type ProviderStorageModuleOptions = {
  providers: (ValueProvider | FactoryProvider)[],
  exports: string[],
}

@Global()
@Module({})
export class ProviderModule {
  static forRoot(options: ProviderStorageModuleOptions): DynamicModule  {
    return {
      global: true,
      module: ProviderModule,
      providers: options.providers || [],
      exports: options.exports || [],
    }
  }
}

export interface ClientContext {
  getUser(): User,
  getProjectsDir(): string,
  getReportsDir(): string,
}