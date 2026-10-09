import axios from "axios";
import type { Account } from "@common/types/account";
import { tokenStore } from "@renderer/utils/storage";
import i18next from "i18next";
import { getActivePinia } from "pinia";
import { useOrganizeCacheStore } from "./organizeCache";

export type AccountStoreType<T extends Account = Account> = Partial<T>

let checkLoginPromise: Promise<any> | null = null;
let checkLoginResult: any = null;
let hasCheckLoginResult = false;
let checkLoginCacheVersion = 0;

export const accountUtil = {

  async fetch(force = false) {
    if (!force && hasCheckLoginResult) {
      return checkLoginResult;
    }
    if (checkLoginPromise) {
      return checkLoginPromise;
    }
    const url = "auth/check-login";
    const cacheVersion = checkLoginCacheVersion;
    const request = axios.post(url).then((res) => {
      const result = res?.data?.valid ? res.data : {};
      if (cacheVersion === checkLoginCacheVersion) {
        checkLoginResult = result;
        hasCheckLoginResult = true;
      }
      return result;
    }).catch((err) => {
      if (cacheVersion === checkLoginCacheVersion) {
        checkLoginResult = null;
        hasCheckLoginResult = false;
      }
      console.debug(`auth/login ${i18next.t('account.loginExpired')}`, err);
      return {};
    }).finally(() => {
      if (checkLoginPromise === request) {
        checkLoginPromise = null;
      }
    });
    checkLoginPromise = request;
    return checkLoginPromise;
  },

  clearFetchCache() {
    checkLoginCacheVersion += 1;
    checkLoginPromise = null;
    checkLoginResult = null;
    hasCheckLoginResult = false;
  },

  async logout(id: string) {
    const url = "auth/logout";
    const res = await axios.post(url, { id });
    if (res) {
      tokenStore.remove();
      this.clearFetchCache();
      const pinia = getActivePinia();
      if (pinia) useOrganizeCacheStore(pinia).invalidate();
      return res.data;
    }
  },

  async getSubAccounts() {
    const pinia = getActivePinia();
    if (!pinia) return [];
    const result = await useOrganizeCacheStore(pinia).getUsers({ status: "all" });
    return result?.users || [];
  }

}
