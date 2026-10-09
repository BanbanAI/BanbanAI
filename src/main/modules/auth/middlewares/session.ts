import session from "express-session";
import { RequestHandler } from "express";
import nedbSessionStore from "nedb-session-store";
import { getRuntime } from "@main/runtime";
import { join } from "path";

export const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;
export const SESSION_REFRESH_WINDOW_MS = 1000 * 60 * 60 * 72;

let expressSession: RequestHandler;
export async function getExpressSession() {
  if (!expressSession) {
    const NeDBStore = nedbSessionStore(session);
    //不要touch，每次touch会更新session，nedb会新增数据
    delete NeDBStore.prototype.touch;
    const userDataPath = await getRuntime().getUserDataPath();
    const store = new NeDBStore({
      filename: join(userDataPath, "resources", "sessions.db"),
      autoCompactInterval: 3600*1000,
      corruptAlertThreshold: 1,
    });
    expressSession = session({
      name: "community_bb_sid",
      secret: "bb.zcjpodf",
      resave: false,
      saveUninitialized: false,
      cookie: {maxAge: SESSION_MAX_AGE_MS},//7天
      store: store,
    });
  }
  return expressSession;
}
