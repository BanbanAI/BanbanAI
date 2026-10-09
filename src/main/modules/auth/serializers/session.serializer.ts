import { PassportSerializer } from '@nestjs/passport';
import { Inject, Injectable } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { Account } from '@common/types/account';
import { PREFERENCES } from '@main/constants';
import { Preferences } from '@main/modules/common';

@Injectable()
export class SessionSerializer extends PassportSerializer {
  constructor(
    private readonly authService: AuthService,
    @Inject(PREFERENCES) private readonly preferences: Preferences,
  ) {
    super();
  }

  serializeUser(
    account: Account,
    done: (err: any, payload?: string) => void
  ) {
    done(null, account.id);
  }

  async deserializeUser(
    payload: string,
    done: (err: any, user?: Account) => void
  ) {
    try {
      const isInit = this.preferences.get('isInit', false);
      if (!isInit) throw new Error('Illegal operation');
      const account = await this.authService.loadAccount(payload);
      done(null, account);
    } catch (err) {
      done(err);
    }
  }
}
