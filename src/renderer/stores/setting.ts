import { defineStore } from "pinia";
import { computed, ref } from "vue";
import axios from "axios";
import { autoSaveStore, deleteRemindStore, localFolderPathStore } from '@renderer/utils/storage'
import { AccountRole } from "@common/types/account";
import { ProxyOptions } from "@common/types/user";
import { DBInfo } from "@common/types/nocode";

export const useSettingStore = defineStore("setting", () => {
  const loadedSettings = new Set<string>();
  const settingRequests = new Map<string, Promise<unknown>>();
  const settingRequestControllers = new Map<string, AbortController>();
  const loadSetting = <T>(key: string, currentValue: () => T, loader: (signal: AbortSignal) => Promise<T>, force = false): Promise<T> => {
    if (!force && loadedSettings.has(key)) {
      return Promise.resolve(currentValue());
    }
    const pending = settingRequests.get(key);
    if (pending) {
      return pending as Promise<T>;
    }
    const controller = new AbortController();
    const request = loader(controller.signal).then((value) => {
      if (!controller.signal.aborted) {
        loadedSettings.add(key);
        return value;
      }
      return currentValue();
    }).catch((error) => {
      if (controller.signal.aborted) {
        return currentValue();
      }
      throw error;
    }).finally(() => {
      if (settingRequests.get(key) === request) {
        settingRequests.delete(key);
        settingRequestControllers.delete(key);
      }
    });
    settingRequests.set(key, request);
    settingRequestControllers.set(key, controller);
    return request;
  };
  const getRuntimeDomain = () => {
    if (typeof window === "undefined") {
      return "http://localhost";
    }
    const origin = window.location.origin;
    if (!origin || origin === "null" || origin.startsWith("file:")) {
      return "http://localhost";
    }
    return origin;
  };
  const defaultDomain = getRuntimeDomain();

  const isPublicSharePage = () => typeof window !== "undefined" && window.location.hash.includes("/share/");
  const ifDeleteRemind = ref(deleteRemindStore.get() ?? true);
  const isAutoSaveProject = ref(false);
  const autoSaveInterval = ref(1);
  const isShowUserInfo = ref(true);
  const projectsDir = ref("");
  const share = ref({
    domain: defaultDomain,
    port: 10000,
  });
  const saas = ref({
    domain: defaultDomain,
    domainCustomized: false,
    ip: "",
    port: 16666,
    runningPort: 16666,
    protocol: 'http' as 'http' | 'https',
    runningProtocol: 'http' as 'http' | 'https',
    restartRequired: false,
    resourceProxy: false,
    consoleAccessConfigEditable: false,
  });

  const sso = ref({
    saml:{
      cert:'MIIDEjCCAfqgAwIBAgIVAMECQ1tjghafm5OxWDh9hwZfxthWMA0GCSqGSIb3DQEBCwUAMBYxFDASBgNVBAMMC3NhbWx0ZXN0LmlkMB4XDTE4MDgyNDIxMTQwOVoXDTM4MDgyNDIxMTQwOVowFjEUMBIGA1UEAwwLc2FtbHRlc3QuaWQwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC0Z4QX1NFKs71ufbQwoQoW7qkNAJRIANGA4iM0ThYghul3pC+FwrGv37aTxWXfA1UG9njKbbDreiDAZKngCgyjxj0uJ4lArgkr4AOEjj5zXA81uGHARfUBctvQcsZpBIxDOvUUImAl+3NqLgMGF2fktxMG7kX3GEVNc1klbN3dfYsaw5dUrw25DheL9np7G/+28GwHPvLb4aptOiONbCaVvh9UMHEA9F7c0zfF/cL5fOpdVa54wTI0u12CsFKt78h6lEGG5jUs/qX9clZncJM7EFkN3imPPy+0HC8nspXiH/MZW8o2cqWRkrw3MzBZW3Ojk5nQj40V6NUbjb7kfejzAgMBAAGjVzBVMB0GA1UdDgQWBBQT6Y9J3Tw/hOGc8PNV7JEE4k2ZNTA0BgNVHREELTArggtzYW1sdGVzdC5pZIYcaHR0cHM6Ly9zYW1sdGVzdC5pZC9zYW1sL2lkcDANBgkqhkiG9w0BAQsFAAOCAQEASk3guKfTkVhEaIVvxEPNR2w3vWt3fwmwJCccW98XXLWgNbu3YaMb2RSn7Th4p3h+mfyk2don6au7Uyzc1Jd39RNv80TG5iQoxfCgphy1FYmmdaSfO8wvDtHTTNiLArAxOYtzfYbzb5QrNNH/gQEN8RJaEf/g/1GTw9x/103dSMK0RXtl+fRs2nblD1JJKSQ3AdhxK/weP3aUPtLxVVJ9wMOQOfcy02l+hHMb6uAjsPOpOVKqi3M8XmcUZOpx4swtgGdeoSpeRyrtMvRwdcciNBp9UZome44qZAYH1iqrpmmjsfI9pJItsgWu3kXPjhSfj1AJGR1l9JGvJrHki1iHTA==',
      entry:'https://samltest.id/idp/profile/SAML2/Redirect/SSO',
      signAssertions: true,
      signResponse: true,
      accountRole: 'visitor' as AccountRole,
    }
  });
  const proxy = ref<ProxyOptions>({
    on: false,
    host: '',
    port: null,
    username: '',
    password: '',
  });
  
  const contactUsInfo = {}
  const ips = ref([]);
  const folderPath = ref<string>(localFolderPathStore.get() ?? '');
  const currentWatchPort = ref(10000);
  const _companyName = ref('');
  /**  自定义公网ip或域名  */
  const networkIps = ref([]);
  const getNetWorkIps = async(force = false) => {
    return loadSetting('networkIps', () => networkIps.value, async (signal) => {
      networkIps.value = await axios.get('user/network-ips', { signal }).then(({ data }) => data);
      return networkIps.value;
    }, force);
  }

  const setNetworkIps = async (ips: string[]) => {
    const previousIps = networkIps.value;
    networkIps.value = ips;
    try {
      await axios.post('user/network-ips', { ips });
      loadedSettings.add('networkIps');
    } catch (error) {
      networkIps.value = previousIps;
      throw error;
    }
  }

  const changeShareDomain = async (domain: string) => {
    share.value.domain = domain;
    await axios.post('/user/change-domain',{ domain });
  }

  const changeSharePort = async (port: number) => {
    share.value.port = port;
    await axios.post('/user/change-port', { port })
  }

  const changeServerIp = async (ip: string) => {
    const { data } = await axios.post('/user/change-server-ip', { ip });
    Object.assign(saas.value, data?.saas || {});
    return data;
  }
  const changeServerPort = async (port: number) => {
    const { data } = await axios.post('/user/change-server-port', { port });
    Object.assign(saas.value, data?.saas || {});
    return data;
  }
  const changeServerProtocol = async (protocol: 'http' | 'https') => {
    const { data } = await axios.post('/user/change-server-protocol', { protocol });
    Object.assign(saas.value, data?.saas || {});
    return data;
  }
  const changeServerDomain = async (domain: string) => {
    const { data } = await axios.post('/user/change-server-domain', { domain });
    Object.assign(saas.value, data?.saas || {});
    return data;
  }
  const resetServerDomain = async () => {
    const { data } = await axios.post('/user/reset-server-domain');
    Object.assign(saas.value, data?.saas || {});
    return data;
  }
  const restartServer = async () => {
    return await axios.post('/user/restart-server');
  }
  const getServerProtocol = async () => {
    const { data } = await axios.get('/user/server-protocol');
    return data;
  }
  const changeServerCertificate = async (type: 'key' | 'cert' | 'ca', content?: string) => {
    const { data } = await axios.post('/user/change-server-certificate', { type, content });
    return data;
  }
  const changeSSOSamlCert = async (cert: string) => {
    sso.value.saml.cert = cert;
    await axios.post('/user/change-sso-saml-cert',{ cert });
  }
  const changeSSOSamlEntry = async (entry: string) => {
    sso.value.saml.entry = entry;
    await axios.post('/user/change-sso-saml-entry',{ entry });
  }
  const changeSSOSamlSignAssertions = async (signAssertions: boolean) => {
    sso.value.saml.signAssertions = signAssertions;
    await axios.post('/user/change-sso-saml-sign-assertions',{ signAssertions });
  }
  const changeSSOSamlSignResponse = async (signResponse: boolean) => {
    sso.value.saml.signResponse = signResponse;
    await axios.post('/user/change-sso-saml-sign-response',{ signResponse });
  }
  const changeSSOAccountRole = async (accountRole: AccountRole) => {
    sso.value.saml.accountRole = accountRole;
    await axios.post('/user/change-sso-saml-account-role',{ accountRole });
  }
  const getProxyOptions = async (force = false) => {
    return loadSetting('proxy', () => proxy.value, async (signal) => {
      const proxyOptions = await axios.post('/user/get-proxy', undefined, { signal }).then(({data}) => data);
      Object.assign(proxy.value, proxyOptions || {});
      return proxy.value;
    }, force);
  }

  const getCompanyName = async (force = false) => {
    return loadSetting('companyName', () => _companyName.value, async (signal) => {
      return await axios.get("/workbench/get-company-name", { signal }).then(({ data }) => {
        _companyName.value = data;
        return data;
      });
    }, force);
  }

  const setCompanyName = async (name: string) => {
    await axios.post("/workbench/set-company-name", { companyName: name }).then(() => {
      _companyName.value = name;
      loadedSettings.add('companyName');
    })
  }
  const companyName = computed(() => {
    return _companyName.value;
  })

  const _dbInfo = ref<DBInfo>({});
  const getDbInfo = async (force = false) => {
    return loadSetting('dbInfo', () => _dbInfo.value, async (signal) => {
      await axios.get("/user/get-db-info", { signal }).then(({ data }) => {
        Object.assign(_dbInfo.value, data || {})
      });
      return _dbInfo.value;
    }, force);
  }
  const dbInfo = computed(() => {
    return _dbInfo.value;
  })

  const setProxyOptions = async (options: ProxyOptions) => {
    const previousOptions = { ...proxy.value };
    Object.assign(proxy.value, options);
    return await axios.post('/user/set-proxy', { ...proxy.value }).then(() => {
      loadedSettings.add('proxy');
      return true;
    }).catch(() => {
      proxy.value = previousOptions;
      return false;
    });
  }

  const syncCurrentWatchPort = async () => {
    currentWatchPort.value = share.value.port;
  }

  const offDeleteRemind = async () => {
    deleteRemindStore.set(false);
    ifDeleteRemind.value = false
  }

  const openDeleteRemind = async () => {
    deleteRemindStore.set(true);
    ifDeleteRemind.value = true
  }

  const setLocalFolder = (projectFolderPath: string) => {
    localFolderPathStore.set(projectFolderPath);
    folderPath.value = projectFolderPath;
  }

  // 自动保存
  const autoSaveProject = async () => {
    const data = autoSaveStore.get();
    if(data) {
      isAutoSaveProject.value = data.autoSaveProject;
      autoSaveInterval.value = data.autoSaveInterval;
      return data;
    } 
  }

  const setAutoSaveProjectInfo = async (autoSaveProjectInfo: { autoSaveProject: boolean, autoSaveInterval: number }) => {
    autoSaveStore.set(autoSaveProjectInfo);
    isAutoSaveProject.value = autoSaveProjectInfo.autoSaveProject;
    autoSaveInterval.value = autoSaveProjectInfo.autoSaveInterval;
  }


  const getIsShowUserInfo = async (force = false) => {
    return loadSetting('isShowUserInfo', () => isShowUserInfo.value, async (signal) => {
      isShowUserInfo.value = await axios.get('/user/is-show-user-info', { signal }).then(({ data }) => data);
      return isShowUserInfo.value;
    }, force);
  }

  const getDomainPort = async (force = false) => {
    if (isPublicSharePage()) return;
    return loadSetting('domainPort', () => ({ ips: ips.value, share: share.value, saas: saas.value }), async (signal) => {
      return await axios.get('user/domain-port', { signal }).then(({ data }) => {
        ips.value = data.ips;
        share.value = data.share;
        saas.value = data.saas;
        syncCurrentWatchPort();
        return data;
      });
    }, force);
  }
  const setProjectsDir = (dir: string) => {
    projectsDir.value = dir;
  }

  const showUserInfoChange = async (value: boolean) => {
    const previousValue = isShowUserInfo.value;
    isShowUserInfo.value = value;
    try {
      await axios.post('/user/show-user-info-change', {
        isShowUserInfo: value
      });
      loadedSettings.add('isShowUserInfo');
    } catch (error) {
      isShowUserInfo.value = previousValue;
      throw error;
    }
  }
  const isShowTour = ref();
  const getIsShowTour = async (force = false) => {
    return loadSetting('showTour', () => isShowTour.value, async (signal) => {
      const { data } = await axios.get("user/get-is-show-tour", { signal });
      isShowTour.value = data;
      return data;
    }, force);
  }
  const setIsShowTour = async (value:boolean) => {
    await axios.post("user/set-is-show-tour", {isShowTour: value});
    isShowTour.value = value;
    loadedSettings.add('showTour');
  }


  const clearAccountSettings = () => {
    settingRequestControllers.forEach((controller) => controller.abort());
    loadedSettings.clear();
    settingRequests.clear();
    settingRequestControllers.clear();
    _companyName.value = '';
    networkIps.value = [];
    ips.value = [];
    proxy.value = {
      on: false,
      host: '',
      port: null,
      username: '',
      password: '',
    };
    share.value = {
      domain: defaultDomain,
      port: 10000,
    };
    saas.value = {
      domain: defaultDomain,
      domainCustomized: false,
      ip: '',
      port: 16666,
      runningPort: 16666,
      protocol: 'http' as 'http' | 'https',
      runningProtocol: 'http' as 'http' | 'https',
      restartRequired: false,
      resourceProxy: false,
      consoleAccessConfigEditable: false,
    };
    _dbInfo.value = {};
    isShowUserInfo.value = true;
    isShowTour.value = undefined;
  };

  return {
    companyName,
    ifDeleteRemind,
    isAutoSaveProject,
    autoSaveInterval,
    isShowUserInfo,
    share,
    saas,
    sso,
    ips,
    networkIps,
    currentWatchPort,
    isShowTour,
    proxy,
    contactUsInfo,
    projectsDir,
    dbInfo,
    getDbInfo,
    getCompanyName,
    setCompanyName,
    setProjectsDir,
    getDomainPort,
    getIsShowUserInfo,
    getProxyOptions,
    setProxyOptions,
    getIsShowTour,
    changeShareDomain,
    changeSharePort,
    changeServerIp,
    changeServerPort,
    changeServerProtocol,
    changeServerDomain,
    resetServerDomain,
    restartServer,
    getServerProtocol,
    changeServerCertificate,
    changeSSOSamlCert,
    changeSSOSamlEntry,
    changeSSOSamlSignAssertions,
    changeSSOSamlSignResponse,
    changeSSOAccountRole,
    syncCurrentWatchPort,
    offDeleteRemind,
    openDeleteRemind,
    autoSaveProject,
    setAutoSaveProjectInfo,
    showUserInfoChange,
    getNetWorkIps,
    setNetworkIps,
    folderPath,
    setLocalFolder,
    setIsShowTour,
    clearAccountSettings,
  }
})
