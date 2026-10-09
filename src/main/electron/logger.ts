import { Injectable, LoggerService } from "@nestjs/common"
import logger, {LogLevel} from 'electron-log'
import { join } from "path";
import { getRuntime } from "@main/runtime";

const defaultContext = 'BANBAN';

//设置日志级别
logger.transports.console.level = getRuntime().isProduction ? 'error' : 'silly';
logger.transports.console.useStyles = true;
logger.transports.file.resolvePath = (variables) => {
  return join(getRuntime().getUserDataPath(), 'logs', variables.fileName);
};
logger.transports.file.maxSize = 10*1024*1024;
switch (process.env.LOG_LEVEL) {
  case 'error': logger.transports.file.level = 'error'; break;
  case 'warn': logger.transports.file.level = 'warn'; break;
  case 'info': logger.transports.file.level = 'info'; break;
  case 'verbose': logger.transports.file.level = 'verbose'; break;
  case 'debug': logger.transports.file.level = 'debug'; break;
  case 'silly': logger.transports.file.level = 'debug'; break;
  default: logger.transports.file.level = 'info';
}


@Injectable()
export class Logger implements LoggerService {
  constructor(protected context: string=defaultContext) {}

  log(message: any, ...optionalParams: any[]) {
    this.info(message, ...optionalParams);
  }

  error(message: any, ...optionalParams: any[]) {
    this._log('error', message, ...optionalParams);
  }

  warn(message: any, ...optionalParams: any[]) {
    this._log('warn', message, ...optionalParams);
  }

  debug(message: any, ...optionalParams: any[]) {
    this._log('debug', message, ...optionalParams);
  }

  verbose(message: any, ...optionalParams: any[]) {
    this._log('verbose', message, ...optionalParams);
  }

  info(message: any, ...optionalParams: any[]) {
    this._log('info', message, ...optionalParams);
  }

  silly(message: any, ...optionalParams: any[]) {
    this._log('silly', message, ...optionalParams);
  }

  private _log(level: LogLevel, message: any, ...optionalParams: any[]) {
    let color = this.getColorByLogLevel(level);
    if (typeof message !== 'string') {
      optionalParams.unshift(message);
      message = '';
    }
    let context = this.context;
    const lastParam = optionalParams[optionalParams.length-1];
    if ((!context || context === defaultContext) && typeof lastParam === 'string') {
      context = lastParam;
      optionalParams = optionalParams.slice(0, optionalParams.length-1);
    }
    message = `%c[${context}] %c[${level}] ${message}`;
    logger[level](message, ...['color: yellow', `color: ${color}`].concat(optionalParams));
  }

  private getColorByLogLevel(level: LogLevel): string {
    switch (level) {
      case 'warn':
        return 'yellow';
      case 'error':
        return 'red';
      case 'verbose':
      case 'info':
        return 'cyan';
      case 'debug':
        return 'white';
      case 'silly':
        return 'magenta';
    }
  }
}

export const electronLogger = new Logger();