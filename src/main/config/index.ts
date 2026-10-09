

import { readFileSync, writeFileSync } from "fs";
import JSON5 from "json5";

type Config = {
  /** 服务监听端口 */
  listen?: number,
  hostname?: string,
  baseURL?: string,
  protocol?: "http" | "https",
  /** 服务证书配置，若无，则使用http协议 */
  cert?: {
    key: string,
    cert: string, 
    ca?: string,
  },
  /** 数据库配置，若无，则使用内嵌数据库 */
  db?: {
    type: "mysql",
    host: string,
    port: number,
    name: string,
    password: string,
    dbName: string
  } |  {
    type: "mongo",
    clientUrl: string,  //mongodb://mongoadmin:123456@localhost:27017/publish?authSource=admin
  }
  adminPass: string,
}

let _config: Partial<Config> = {};
export const readConfig = () => {
  try {
    _config = JSON5.parse(readFileSync("config.jsonc", "utf8"));
  } catch (err){
    try {
      _config = JSON5.parse(readFileSync("config.json", "utf8"));
    } catch (err) {
      //ignored
    }
  }
  return _config;
};
readConfig();

export const serverConfig = _config;

export const updateConfig = async (key: string, value: any) => {
  if (!_config) return false;
  _config[key] = value;
  await writeFileSync("config.json", JSON.stringify(_config, null, 2), "utf8");
  return true;
};
