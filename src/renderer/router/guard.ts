import { Account, ADMIN_USERNAME, ServerInitStepInfo } from "@common/types/account";
import { accountUtil } from "@renderer/stores/account";
import { ref } from "vue";
import { RouteLocationNormalized } from "vue-router";
import axios from 'axios';
import { isEmpty } from "@common/utils/object";

const account = ref<Account>();
const isLogin = async () => {
  const data = await accountUtil.fetch();
  account.value = data.account;
  return !!data?.valid;
};

const serverInitInfo = ref<{
  stepInfo: ServerInitStepInfo,
}>(null);


const validServerInit = async () => {
  serverInitInfo.value = (await axios.post('user/validate-server-init').then(({ data }) => data ).catch(err => null)) || {
    stepInfo: { step: "none" },
  };
  return serverInitInfo.value;
}
const isToConfiguration = () => {
  return serverInitInfo.value && (serverInitInfo.value?.stepInfo?.step !== "complete" || serverInitInfo.value?.stepInfo?.inValid);
}

const whitelistRoutes = ["/nocode/form", "/share", "/chat", "/signature/handwritten", "/dev/virtual-table"];

export const workbenchBeforeEach = async (to: RouteLocationNormalized, from: RouteLocationNormalized) => {
  if (whitelistRoutes.some(item => to.path.includes(item))) {
    return true;
  }
  const { meta } = to.redirectedFrom || {};
  const _isLogin = (meta && "isLogin" in meta) ? meta.isLogin : await isLogin();
  Object.assign(to.meta, {
    isLogin: _isLogin,
  });

  if (!_isLogin) {
    // 未登录，所有非 `/login` 页面都跳转至登录页
    if (!to.path.includes("/login")) {
      return { 
        path: "/login",
        query: {
          redirect: to.fullPath,
        }
      };
    }
    return true;
  }
  const excludePaths = ["/", "/nocode"];
  // 处理 `/login` 跳转逻辑
  if (to.path.includes("/login")) {
    const redirectPath = location.hash.match(/redirect=([^&]*)/)?.[1];
    let path = redirectPath?.split("#")[1] || "/";
    let query = {};
    if (path.includes("?")) {
      let queryStr = path.split("?")[1];
      path = path.split("?")[0];
      const [key, value] = queryStr.split("=");
      query[key] = value;
    }
    return { 
      path, 
      query
    };
  } else if (["/organize", "/recharge-management"].some(path => to.path.includes(path))) {
    return account.value?.isAdmin === true ? true : "/";
  }

  // 处理 workbench 及其他路由
  if (excludePaths.some(item => to.path.includes(item))) {
    return true;
  }

  return true;
}

export const serverBeforeEach = async (to: RouteLocationNormalized, from: RouteLocationNormalized) => {
  if (serverInitInfo.value === null || to.path !== "/configuration" && serverInitInfo.value?.stepInfo?.step !== "complete") {
    await validServerInit();
    if (isToConfiguration() && to.path !== "/configuration") return "/configuration";
  }
  if (to.path === "/configuration") {
    return !isToConfiguration() ? "/" : true;
  }

  if (whitelistRoutes.some(item => to.path.includes(item))) {
    return true;
  }
  const { meta } = to.redirectedFrom || {};
  const _isLogin = (meta && "isLogin" in meta) ? meta.isLogin : await isLogin();
  Object.assign(to.meta, {
    isLogin: _isLogin,
  });
  if (to.path.includes("/login")) {
    if (!isEmpty(account.value)) {
      const redirectPath = location.hash.match(/redirect=([^&]*)/)?.[1];
      let path = redirectPath?.split("#")[1] || "/";
      let query = {};
      if (path.includes("?")) {
        let queryStr = path.split("?")[1];
        path = path.split("?")[0];
        const [key, value] = queryStr.split("=");
        query[key] = value;
      }
      return {
        path,
        query
      };
    }
    return true;
  } else if (!_isLogin || isEmpty(account.value)) {
    return {
      path: "/login",
      query: {
        redirect: to.path.includes("/server") ? "/": to.fullPath,
      }
    };
  } else if (to.path === "/organize" && account.value.isAdmin !== true) {
    return "/";
  } else if (to.path === "/server" && account.value.user !== ADMIN_USERNAME) {
    return "/";
  }
  return true;
}
