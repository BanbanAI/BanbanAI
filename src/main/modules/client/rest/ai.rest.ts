import { PREFERENCES } from "@main/constants";
import { Preferences } from "@main/modules/common";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Rest } from "./base.rest";


@Injectable()
export class AIRest {
  private readonly logger = new Logger('AIRest');
  constructor(
    @Inject(PREFERENCES) private readonly preferences: Preferences,
    private readonly rest: Rest,
  ) { }

  async getModelsV4() {
    const res = await this.rest.get(this.rest.sign(`/ai/models-v4`));
    if (res) {
      return res;
    }
    throw new Error(res?.reason);
  }

}
