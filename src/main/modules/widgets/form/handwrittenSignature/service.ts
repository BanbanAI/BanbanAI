import { Injectable } from "@nestjs/common";

type SignatureSessionState = "pending" | "signed" | "canceled" | "expired";

type SignatureSessionRecord = {
  sessionId: string;
  fieldUid: string;
  nocodeId: string;
  launchUrl: string;
  status: SignatureSessionState;
  signatureUrl: string;
  saveForReuse: boolean;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
};

const PENDING_SESSION_TTL = 10 * 60 * 1000;
const COMPLETED_SESSION_TTL = 12 * 60 * 60 * 1000;

@Injectable()
export class HandwrittenSignatureService {
  private readonly sessions = new Map<string, SignatureSessionRecord>();
  constructor() {}

  createSession({
    sessionId,
    fieldUid,
    nocodeId,
    launchUrl
  }: {
    sessionId: string;
    fieldUid: string;
    nocodeId: string;
    launchUrl: string;
  }) {
    const now = Date.now();
    this.cleanupSessions(now);
    this.sessions.set(sessionId, {
      sessionId,
      fieldUid,
      nocodeId,
      launchUrl,
      status: "pending",
      signatureUrl: "",
      saveForReuse: false,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + PENDING_SESSION_TTL
    });

    return {
      data: {
        sessionId,
        fieldUid,
        launchUrl,
        status: "pending"
      }
    };
  }

  getSessionStatus(sessionId: string) {
    const session = this.getSession(sessionId);
    if (!session) {
      return {
        data: {
          status: "expired"
        }
      };
    }

    return {
      data: {
        status: session.status,
        signatureUrl: session.signatureUrl,
        saveForReuse: session.saveForReuse
      }
    };
  }

  completeSession(sessionId: string, signatureUrl: string, saveForReuse = false) {
    const session = this.getSession(sessionId);
    if (!session || !signatureUrl) {
      return {
        data: {
          status: "expired"
        }
      };
    }

    const now = Date.now();
    session.status = "signed";
    session.signatureUrl = signatureUrl;
    session.saveForReuse = !!saveForReuse;
    session.updatedAt = now;
    session.expiresAt = now + COMPLETED_SESSION_TTL;

    return {
      data: {
        status: session.status,
        signatureUrl: session.signatureUrl,
        saveForReuse: session.saveForReuse
      }
    };
  }

  cancelSession(sessionId: string) {
    const session = this.getSession(sessionId);
    if (!session) {
      return {
        data: {
          status: "expired"
        }
      };
    }

    const now = Date.now();
    session.status = "canceled";
    session.updatedAt = now;
    session.expiresAt = now + COMPLETED_SESSION_TTL;

    return {
      data: {
        status: session.status
      }
    };
  }

  private getSession(sessionId: string) {
    this.cleanupSessions();
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    if (session.status === "pending" && session.expiresAt <= Date.now()) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  private cleanupSessions(now = Date.now()) {
    for (const [sessionId, session] of this.sessions) {
      if (session.expiresAt <= now) {
        this.sessions.delete(sessionId);
      }
    }
  }

}
