import { Module, Global } from "@nestjs/common";
import { UserContext, USER_CONTEXT } from "./user.context";

@Global()
@Module({
  controllers: [],
  providers: [UserContext,
    {
      provide: USER_CONTEXT,
      useFactory: (userContext: UserContext) => {
        return userContext;
      },
      inject: [UserContext]
    }
  ],
  exports: [USER_CONTEXT],
})
export class UserContextModule { }
