export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class SDKLogger {
  public level: LogLevel;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  debug(msg: string, ...args: any[]) {
    if (this.level <= LogLevel.DEBUG) console.debug(`[CrossChainSDK DEBUG] ${msg}`, ...args);
  }

  info(msg: string, ...args: any[]) {
    if (this.level <= LogLevel.INFO) console.info(`[CrossChainSDK INFO] ${msg}`, ...args);
  }

  warn(msg: string, ...args: any[]) {
    if (this.level <= LogLevel.WARN) console.warn(`[CrossChainSDK WARN] ${msg}`, ...args);
  }

  error(msg: string, ...args: any[]) {
    if (this.level <= LogLevel.ERROR) console.error(`[CrossChainSDK ERROR] ${msg}`, ...args);
  }
}