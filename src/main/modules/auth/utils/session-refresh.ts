import { Request } from "express";
import { SESSION_MAX_AGE_MS, SESSION_REFRESH_WINDOW_MS } from "../middlewares/session";

const SESSION_REFRESH_MARK_KEY = "__sessionRefreshAt";

const saveSession = (req: Request) => {
  return new Promise<void>((resolve, reject) => {
    req.session.save((err) => {
      err ? reject(err) : resolve();
    });
  });
}

export async function refreshSessionIfNeeded(req: Request) {
  const expires = req.session?.cookie?.expires;
  if (!expires) {
    return;
  }

  const expiresAt = new Date(expires).getTime();
  if (!Number.isFinite(expiresAt)) {
    return;
  }

  const remainingMs = expiresAt - Date.now();
  if (remainingMs > SESSION_REFRESH_WINDOW_MS) {
    return;
  }

  req.session.cookie.maxAge = SESSION_MAX_AGE_MS;
  req.session[SESSION_REFRESH_MARK_KEY] = Date.now();
  await saveSession(req);
}
