import { ConsoleLogger, LogLevel } from "@nestjs/common";
import dayjs from "dayjs";
import { getRuntime } from "@main/runtime";

const defaultContext = "BANBAN";

type ColorTextFn = (text: string) => string;
const isColorAllowed = () => !getRuntime().isProduction;
const colorIfAllowed = (colorFn: ColorTextFn) => (text: string) =>
  isColorAllowed() ? colorFn(text) : text;
const clc = {
  cyan: colorIfAllowed(
    (text: string) => `\x1B[36m${text}\x1B[39m`,
  ),
  white: colorIfAllowed(
    (text: string) => `\x1B[37m${text}\x1B[39m`,
  ),
  yellow: colorIfAllowed(
    (text: string) => `\x1B[33m${text}\x1B[39m`,
  ),
  red: colorIfAllowed(
    (text: string) => `\x1B[31m${text}\x1B[39m`,
  ),
};
const yellow = colorIfAllowed(
  (text: string) => `\x1B[38;5;3m${text}\x1B[39m`,
);

export class Logger extends ConsoleLogger {
  protected printMessages(messages: unknown[], context = "", logLevel: LogLevel = "log", writeStreamType?: "stdout" | "stderr"): void {
    const message = messages.map((message)=>{
      return this.stringifyMessage(message, logLevel);
    }).join(" ");
    const timeMessage = this.colorize(this.getTimestamp(), logLevel);
    const contextMessage = context ? yellow(`[${context}] `) : '';
    const logLevelMessage = this.colorize(`[${logLevel}]`, logLevel);
    const formattedMessage = `${timeMessage} > ${contextMessage} ${logLevelMessage} ${message}\n`;

    process[writeStreamType ?? 'stdout'].write(formattedMessage);
  }

  protected getTimestamp(): string {
    return dayjs().format("YYYY-MM-DD HH:mm:ss.SSS");
  }

  protected colorize(message: string, logLevel: LogLevel): string {
    const color = this.getColorByLogLevel2(logLevel);
    return color(message);
  }

  private getColorByLogLevel2(level: LogLevel) {
    switch (level) {
      case 'warn':
        return clc.yellow;
      case 'error':
        return clc.red;
      case 'verbose':
      case 'log':
        return clc.cyan;
      case 'debug':
        return clc.white;
    }
  }
}

const logger = new Logger(defaultContext);
let levels = [];
switch (process.env.LOG_LEVEL) {
  case "error": levels = ["error"]; break;
  case "warn": levels = ["error", "warn"]; break;
  case "info": levels = ["error", "warn", "log"]; break;
  case "debug": levels = ["error", "warn", "log", "debug"]; break;
  case "verbose": levels = ["error", "warn", "log", "debug", "verbose"]; break;
  default: levels = getRuntime().isProduction ? ["error", "warn"] : ["error", "warn", "log"];
}
logger.setLogLevels(levels);

export const nodejsLogger = logger;