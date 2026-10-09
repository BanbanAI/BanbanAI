import { PREFERENCES, USER } from '@main/constants';
import { Injectable, Inject } from '@nestjs/common'
import { UserWrapper } from '../components/user-wrapper.component';
import { getLocalResourceDir } from '@main/utils';
import { DownloadRest } from '@main/modules/client/rest';
import { Preferences } from '@main/modules/common';

export const USER_CONTEXT = 'USER_CONTEXT'

@Injectable()
export class UserContext {
  public getLocalResourceDir = getLocalResourceDir;
  constructor(
    @Inject(USER) private readonly user: UserWrapper,
    @Inject(PREFERENCES) private readonly preferences: Preferences,
    private readonly downloadRest: DownloadRest,
  ) {}


  isStaff() {
    return !!this.user.get('staff');
  }

  downloadFile(url: string, savePath: string, onDownloadProgress?: (progress: number) => void): Promise<void> {
    return this.downloadRest.downloadFile(url, savePath, onDownloadProgress);
  }

  get proxy() {
    return this.preferences.getAxiosProxy();
  }

  getRvt2GltfExeDirs() {
    const bmColladaExportDir = this.preferences.get('bmColladaExportDir', '');
    const bmJsonExportDir = this.preferences.get('bmJsonExportDir', '');
    return {
      bmColladaExportDir,
      bmJsonExportDir,
    }
  }
  setRvt2GltfExeDirs(dirs: {bmColladaExportDir: string, bmJsonExportDir: string}) {
    const { bmColladaExportDir, bmJsonExportDir } = dirs ?? {};
    this.preferences.set({
      bmColladaExportDir: bmColladaExportDir,
      bmJsonExportDir: bmJsonExportDir,
    });
  }
}
