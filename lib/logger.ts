import pino from 'pino';
import fs from 'fs';
import path from 'path';

// 環境変数でログレベルを制御
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const NODE_ENV = process.env.NODE_ENV || 'development';

// ログディレクトリを作成
const LOG_DIR = path.join(process.cwd(), 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Next.jsと完全に互換性のあるシンプルな設定
const loggerConfig = {
  level: LOG_LEVEL,
  formatters: {
    level: (label: string) => {
      return { level: label };
    }
  },
  timestamp: pino.stdTimeFunctions.isoTime
};

// ロガーを作成（transportは使わない）
const logger = pino(loggerConfig);

// 開発環境と本番環境両方でファイル出力を追加
const appLogStream = fs.createWriteStream(path.join(LOG_DIR, 'app.log'), { flags: 'a' });
const errorLogStream = fs.createWriteStream(path.join(LOG_DIR, 'error.log'), { flags: 'a' });

// 元のログ関数を保存
const originalInfo = logger.info.bind(logger);
const originalError = logger.error.bind(logger);
const originalWarn = logger.warn.bind(logger);
const originalDebug = logger.debug.bind(logger);

// ファイル出力付きでラップ
logger.info = (...args: any[]) => {
  originalInfo(...args);
  if (args.length > 0) {
    const logEntry = { level: 'info', time: new Date().toISOString(), message: args[0], data: args[1] || {} };
    appLogStream.write(JSON.stringify(logEntry) + '\n');
  }
};

logger.error = (...args: any[]) => {
  originalError(...args);
  if (args.length > 0) {
    const logEntry = { level: 'error', time: new Date().toISOString(), message: args[0], error: args[1]?.stack || args[1], data: args[2] || {} };
    errorLogStream.write(JSON.stringify(logEntry) + '\n');
    appLogStream.write(JSON.stringify(logEntry) + '\n');
  }
};

logger.warn = (...args: any[]) => {
  originalWarn(...args);
  if (args.length > 0) {
    const logEntry = { level: 'warn', time: new Date().toISOString(), message: args[0], data: args[1] || {} };
    appLogStream.write(JSON.stringify(logEntry) + '\n');
  }
};

logger.debug = (...args: any[]) => {
  originalDebug(...args);
  if (args.length > 0) {
    const logEntry = { level: 'debug', time: new Date().toISOString(), message: args[0], data: args[1] || {} };
    appLogStream.write(JSON.stringify(logEntry) + '\n');
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
export const timeStart = (label: string) => {
  return process.hrtime();
};

export const timeEnd = (label: string, startTime: [number, number]) => {
  const [seconds, nanoseconds] = process.hrtime(startTime);
  const duration = seconds * 1000 + nanoseconds / 1000000; // ミリ秒
  logger.info({ label, duration: `${duration.toFixed(2)}ms` }, `${label} completed`);
  return duration;
};