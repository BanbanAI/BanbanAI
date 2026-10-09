import { Module, Global } from "@nestjs/common";
import { USER } from "@main/constants";
import { UserWrapper } from "./components/user-wrapper.component";
import { UserController } from "./user.controllers";
import { UserService } from "./user.service";
import { UserContextModule } from "./user-context/user-context.module";

@Global()
@Module({
  imports: [ UserContextModule ],
  controllers: [UserController],
  providers: [
    UserService, 
    {
      provide: USER,
      useFactory: () => {
        return new UserWrapper();
      },
    },
  ],
  exports: [UserService, USER],
})
export class UserModule { }
