import { NOCODES_DIR } from '@main/constants';
import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { join } from 'path';
import { getRuntime } from '@main/runtime';

@Injectable()
export class CommonUtil implements OnApplicationBootstrap {
  private userDataPath = '';
  constructor(
    @Inject(NOCODES_DIR) private readonly nocodesDir: string,
  ) {

  }
  async onApplicationBootstrap() {
    this.userDataPath = await getRuntime().getUserDataPath();
  }

  getPagesPath(nocodeId: string) {
    return join(this.nocodesDir, nocodeId, 'pages');
  }
}
