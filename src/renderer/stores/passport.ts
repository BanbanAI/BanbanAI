import { defineStore } from "pinia";
import { UserStoreType, userUtil } from './user';
import { AccountStoreType, accountUtil } from './account';
import axios from "axios";
import { computed, ComputedRef, Ref, ref, watch } from "vue";
import dayjs from "dayjs";
import { isEmpty } from "@common/utils/object";
import i18next from "i18next";
import { SaasPlan } from "@common/types/user";
import { ADMIN_USERNAME } from "@common/types/account";
import { useSettingStore } from "./setting";
import router from "@renderer/router";
import { env } from "@renderer/utils/env";

type PassportMode = 'user' | 'account';

export const usePassportStore = defineStore("passport", () => {

  const settingState = useSettingStore();

  const user: Ref<UserStoreType> = ref({});
  const account: Ref<AccountStoreType> = ref({});
  const subAccounts = ref<AccountStoreType[]>([]);
  const currentLanguage = ref(i18next.language);
  let isActiveAccountLogout = false;

  i18next.on("languageChanged", language => {
    currentLanguage.value = language;
  });

  const currentSaasSeats = computed(() => subAccounts.value.length);
  const isMainAccount = computed(() => {
    return account.value?.user === ADMIN_USERNAME;
  });

  const mode: ComputedRef<PassportMode> = computed(() => {
    return env.inClient() ? 'user' : 'account';
  });

  const nickname = computed(() => {
    if (mode.value === 'user') {
      return user.value.nickname;
    } else {
      return account.value.user;
    }
  })

  const isLoginUser = computed(() => {
    return typeof user.value.id === 'number' && user.value.id !== 0;
  });

  const isLoginAccount = computed(() => {
    return !!account.value.user;
  })

  const isLogin = computed(() => {
    if (mode.value === 'user') {
      return isLoginUser.value;
    } else {
      return isLoginAccount.value;
    }
  })

  const isShowSaas = computed(() => {
    return true;
  });

  const timeSaasEnd = computed(() => {
    if (isLogin.value) {
      if (isPermanent(user.value.timeSaasEnd)) {
        return i18next.t("passportTs.unlimited");
      } else {
        return dayjs.unix(user.value.timeSaasEnd).format('YYYY-MM-DD');
      }
    }
  });

  const isPermanent = (time: number) => {
    return dayjs.unix(time).diff(dayjs(), 'year') >= 30;
  };

  const getUsername = () => {
    void currentLanguage.value;
    if (user.value.staff) {
      return user.value.staff + "-" + i18next.t("passportTs.userStaff")
    } else if (!user.value.nickname) {
      return user.value.loginName
    } else {
      return user.value.nickname
    }
  }
  const showNickname = computed(() => {
    if (mode.value === 'user') {
      return getUsername();
    } else {
      return account.value.realname;
    }
  })
  const showUserNickname = computed(() => getUsername());

  /** @deprecated 已弃用，终端即将改成saas席位 */
  const isOutOfOnlineLimit = computed(() => {
    return user.value.sessions && Object.keys(user.value.sessions).length > user.value.onlineLimit
  })

  /** @deprecated 已弃用，终端即将改成saas席位 */
  const onlineTerminal = computed(() => {
    if (user.value.sessions) {
      return Object.keys(user.value.sessions).length
    }
    return 0
  })


  /*******************************      methods     ******************************************* */

  const companyNameEditable = computed(() => true)

  const nocodeId = ref();
  let isInit = false;
  const init = async (id?: string) => {
    if (isInit) return;
    isInit = true;
    nocodeId.value = id;
    if (mode.value === 'user') {
      updateUser(await userUtil.fetch() || {});
    } else {
      const data = await accountUtil.fetch();
      updateUser(data.user);
      updateAccount(data.account);
    }
    initWatch();
    if (mode.value === 'user') initSync();
  }

  let browserTimer = null;
  let browserSyncLoopVersion = 0;
  let clientTimer = null;
  let clientSyncLoopVersion = 0;

  const stopBrowserSync = () => {
    browserSyncLoopVersion += 1;
    clearTimeout(browserTimer);
    browserTimer = null;
  }

  const initSync = () => {
    if (mode.value === 'user') {
      clientSyncLoopVersion += 1;
      const currentVersion = clientSyncLoopVersion;
      clearInterval(clientTimer);
      clientTimer = setInterval(() => void syncInClient(currentVersion), 8 * 1000);
      return;
    }
    stopBrowserSync();
    const currentBrowserSyncLoopVersion = browserSyncLoopVersion;
    const runSyncInBrowserLoop = () => {
      if (browserSyncLoopVersion !== currentBrowserSyncLoopVersion) return;
      browserTimer = setTimeout(async () => {
        await syncInBrowser(currentBrowserSyncLoopVersion);
        runSyncInBrowserLoop();
      }, 8 * 1000);
    };
    runSyncInBrowserLoop();
  }

  const logoutAccount = async () => {
    const data = await accountUtil.logout(account.value.id);
    updateAccount(data);
  }
  const logoutUser = async () => {
    const data = await userUtil.logout();
    updateUser(data);
  }
  const logoutAccountActively = async () => {
    const redirectPath = router.currentRoute.value.fullPath;
    isActiveAccountLogout = true;
    try {
      const data = await accountUtil.logout(account.value.id);
      subAccounts.value.length = 0;
      settingState.clearAccountSettings();
      updateAccount(data);
      await router.replace({
        path: "/login",
        query: { redirect: redirectPath },
      });
    } finally {
      isActiveAccountLogout = false;
    }
  }

  const logout = async () => {
    if (mode.value === 'user') await logoutUser();
    else await logoutAccount();
    subAccounts.value.length = 0;
    if (mode.value === 'account') settingState.clearAccountSettings();
  }

  const syncInClient = async (syncLoopVersion = clientSyncLoopVersion) => {
    try {
      const { data } = await axios.get('/user/sync-user-info');
      if (syncLoopVersion !== clientSyncLoopVersion) return;
      updateUser(data?.user || {});
      if (!data?.valid) updateUser({ id: 0 });
    } catch {
      if (syncLoopVersion === clientSyncLoopVersion) updateUser({ id: 0 });
    }
  }

  const syncInBrowser = async (syncLoopVersion = browserSyncLoopVersion) => {
    const data = await accountUtil.fetch(true);
    if (syncLoopVersion !== browserSyncLoopVersion) return;
    if (data) {
      updateAccount(data?.account ?? {});
      updateUser(data?.user ?? {});
    }
  }

  const updateUser = (data: UserStoreType) => {
    if(isEmpty(data)) {
      user.value = {};
    } else {
      Object.assign(user.value, data);
    }
  }

  const updateAccount = (data: AccountStoreType) => {
    const previousAccountId = account.value.id;
    const nextAccountId = data?.id;
    if (previousAccountId && previousAccountId !== nextAccountId) {
      settingState.clearAccountSettings();
    }
    if(isEmpty(data)) {
      account.value = {};
    } else {
      Object.assign(account.value, data);
    }
  }

  /** @deprecated update 已弃用，请使用 updateUser 或 updateAccount  */
  const update = (data: UserStoreType | AccountStoreType) => {
    if (mode.value === 'user') {
      updateUser(data as UserStoreType);
    } else {
      updateAccount(data as AccountStoreType);
    }
  }


  const formatDate = (timeStamp = Date.now(), format = 'YYYY-MM-DD') => {
    if (String(timeStamp).length === 10) {
      timeStamp = timeStamp * 1000;
    }
    return dayjs(timeStamp).format(format);
  }

  const syncSubAccounts = async () => {
    subAccounts.value = await accountUtil.getSubAccounts();
  }

  const isSaasPlan = (saasPlan: SaasPlan) => {
    if (user.value.saas && user.value.timeSaasEnd > dayjs().unix()) {
      return user.value.saasPlan === saasPlan;
    } else {
      return SaasPlan.FREE === saasPlan;
    }
  };

  /**************************     watch       ********************************** */
  const initWatch = () => {
    const excludeToLoginPaths = ['nocode'];
    const publicWhitelist = ['/login', '/configuration'];
    const guestOnlyPages = ['/login'];
    if (__IS_SERVER__) publicWhitelist.push('/server');

    watch(() => [isLogin.value, mode.value], ([isLoggedIn]) => {
      if (isLoggedIn) initSync();
      else {
        stopBrowserSync();
      }
      const path = location.href;
      if (!isLoggedIn) {
        if (isActiveAccountLogout) return;
        if (publicWhitelist.some(item => path.includes(item))) return;
        if (env.inClient()) return;
        const redirectPath = location.href;
        location.href = `#/login?redirect=${redirectPath}`;
        if (!excludeToLoginPaths.some(item => redirectPath.includes(item))) {
          location.reload();
        }
      } else {
        if (!guestOnlyPages.some(item => path.includes(item))) return;
        let redirectPath = location.hash.match(/redirect=(.*)/)?.[1] || "#/";
        if (!redirectPath.startsWith("#/") && !redirectPath.startsWith("http")) {
          redirectPath = '/#' + redirectPath;
        }
        if (redirectPath.includes("/server")) redirectPath = "/";
        location.href = redirectPath;
        // 获取saas的子账号
        if(mode.value === 'user' || isMainAccount.value) {
          syncSubAccounts();
        }
      }
    }, { immediate: true });
  }

  const clearSession = async () => {
    if (mode.value === 'user') {
      await axios.post("/user/clear-session", { sessionId: user.value.sessionId })
    }
  }


  return {
    user,
    account,
    mode,
    nickname,
    showNickname,
    showUserNickname,
    isLoginUser,
    isLoginAccount,
    isLogin,
    isShowSaas,
    formatMoney: computed(() => (user.value.money / 100).toFixed(2)),
    currentSaasSeats,
    subAccounts,
    isMainAccount,
    isPermanent,
    timeSaasEnd,
    isOutOfOnlineLimit,   // 是否终端超出限制
    onlineTerminal,

    companyNameEditable,

    init,
    update,
    updateUser,
    updateAccount,
    logoutUser,
    logoutAccount,
    logoutAccountActively,
    logout,
    formatDate,
    clearSession,
    syncSubAccounts,

    isSaasPlan,
  }
})
