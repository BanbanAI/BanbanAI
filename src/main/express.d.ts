import { Request, Response } from "express";
import { Agent } from "@common/types/agent";
import { AiThread, AiThreadShare } from "@main/modules/ai/ai.types";

//TODO
type Account = any;

declare module "express" {
  export interface Request {
    account?: Account,

    apiCredentialType?: "global" | "account",

    nocode?: {
      id: string,
    },

    agent?: Agent,

    aiThread?: AiThread,

    aiThreadShare?: AiThreadShare,

    timing?: {
      findAppById?: number,
      findAppByAlias?: number,
      getBody?: number,
      readData?: number,
      session?: number,
    },
  }
}
