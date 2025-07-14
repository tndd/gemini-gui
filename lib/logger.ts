import pino from 'pino';
import fs from 'fs';
import path from 'path';

// 環境変数でログレベルを制御
const CONSOLE_LOG_LEVEL = process.env.CONSOLE_LOG_LEVEL || 'info';  // コンソール用
const FILE_LOG_LEVEL = process.env.FILE_LOG_LEVEL || 'debug';       // ファイル用

// ログディレクトリを作成
const LOG_DIR = path.join(process.cwd(), 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// コンソール用のロガー（最小限の出力）
const consoleLoggerConfig = {
  level: CONSOLE_LOG_LEVEL,
  formatters: {
    level: (label: string) => {
      return { level: label };
    }
  },
  timestamp: pino.stdTimeFunctions.isoTime
};

// ファイル用のロガー（詳細な出力）
const fileLoggerConfig = {
  level: FILE_LOG_LEVEL,
  formatters: {
    level: (label: string) => {
      return { level: label };
    }
  },
  timestamp: pino.stdTimeFunctions.isoTime
};

// ロガーを作成
const consoleLogger = pino(consoleLoggerConfig);
const fileLogger = pino(fileLoggerConfig);

// ファイル出力ストリーム
const appLogStream = fs.createWriteStream(path.join(LOG_DIR, 'app.log'), { flags: 'a' });
const errorLogStream = fs.createWriteStream(path.join(LOG_DIR, 'error.log'), { flags: 'a' });

// ログレベルの優先度
const LOG_LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const getLogLevel = (level: string) => LOG_LEVELS[level as keyof typeof LOG_LEVELS] || 0;

// 統合ロガーオブジェクトを作成
const logger = {
  info: (msg: any, obj?: any) => {
    // コンソール出力（infoレベル以上）
    if (getLogLevel('info') >= getLogLevel(CONSOLE_LOG_LEVEL)) {
      consoleLogger.info(msg, obj);
    }
    // ファイル出力（常に詳細）
    if (getLogLevel('info') >= getLogLevel(FILE_LOG_LEVEL)) {
      const logEntry = { level: 'info', time: new Date().toISOString(), message: msg, data: obj || {} };
      appLogStream.write(JSON.stringify(logEntry) + '\n');
    }
  },

  error: (msg: any, err?: any, obj?: any) => {
    // コンソール出力（errorレベル以上）
    if (getLogLevel('error') >= getLogLevel(CONSOLE_LOG_LEVEL)) {
      consoleLogger.error(msg, err, obj);
    }
    // ファイル出力（常に詳細）
    if (getLogLevel('error') >= getLogLevel(FILE_LOG_LEVEL)) {
      const logEntry = { level: 'error', time: new Date().toISOString(), message: msg, error: err?.stack || err, data: obj || {} };
      errorLogStream.write(JSON.stringify(logEntry) + '\n');
      appLogStream.write(JSON.stringify(logEntry) + '\n');
    }
  },

  warn: (msg: any, obj?: any) => {
    // コンソール出力（warnレベル以上）
    if (getLogLevel('warn') >= getLogLevel(CONSOLE_LOG_LEVEL)) {
      consoleLogger.warn(msg, obj);
    }
    // ファイル出力（常に詳細）
    if (getLogLevel('warn') >= getLogLevel(FILE_LOG_LEVEL)) {
      const logEntry = { level: 'warn', time: new Date().toISOString(), message: msg, data: obj || {} };
      appLogStream.write(JSON.stringify(logEntry) + '\n');
    }
  },

  debug: (msg: any, obj?: any) => {
    // コンソール出力（debugレベル以上）
    if (getLogLevel('debug') >= getLogLevel(CONSOLE_LOG_LEVEL)) {
      consoleLogger.debug(msg, obj);
    }
    // ファイル出力（常に詳細）
    if (getLogLevel('debug') >= getLogLevel(FILE_LOG_LEVEL)) {
      const logEntry = { level: 'debug', time: new Date().toISOString(), message: msg, data: obj || {} };
      appLogStream.write(JSON.stringify(logEntry) + '\n');
    }
  },

  child: (obj: any) => {
    // 子ロガーも同じ仕組みで作成
    return {
      info: (msg: any, childObj?: any) => logger.info(msg, { ...obj, ...childObj }),
      error: (msg: any, err?: any, childObj?: any) => logger.error(msg, err, { ...obj, ...childObj }),
      warn: (msg: any, childObj?: any) => logger.warn(msg, { ...obj, ...childObj }),
      debug: (msg: any, childObj?: any) => logger.debug(msg, { ...obj, ...childObj })
    };
  }
};

// セッション固有のロガーを作成するヘルパー
export const createSessionLogger = (sessionId: string) => {
  return logger.child({ sessionId });
};

// 各モジュール用のロガーを作成するヘルパー
export const createModuleLogger = (module: string) => {
  return logger.child({ module });
};

// デフォルトロガーをエクスポート
export default logger;

// 型定義
export interface LogContext {
  sessionId?: string;
  module?: string;
  userId?: string;
  requestId?: string;
  duration?: number;
  [key: string]: any;
}

// 便利なログ関数
export const logInfo = (msg: string, context?: LogContext) => {
  logger.info(context, msg);
};

export const logError = (msg: string, error?: Error, context?: LogContext) => {
  logger.error({ ...context, error: error?.stack }, msg);
};

export const logDebug = (msg: string, context?: LogContext) => {
  logger.debug(context, msg);
};

export const logWarn = (msg: string, context?: LogContext) => {
  logger.warn(context, msg);
};

// パフォーマンス測定用
export const timeStart = (_label: string) => {
  return process.hrtime();
};

export const timeEnd = (label: string, startTime: [number, number]) => {
  const [seconds, nanoseconds] = process.hrtime(startTime);
  const duration = seconds * 1000 + nanoseconds / 1000000; // ミリ秒
  logger.info(`${label} completed`, { label, duration: `${duration.toFixed(2)}ms` });
  return duration;
};