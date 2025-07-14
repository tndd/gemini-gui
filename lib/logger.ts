import pino from 'pino';
import path from 'path';

// 環境変数でログレベルを制御
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const NODE_ENV = process.env.NODE_ENV || 'development';

// ログディレクトリを作成
const LOG_DIR = path.join(process.cwd(), 'logs');

// 開発環境用の設定
const developmentConfig = {
  level: LOG_LEVEL,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
      ignore: 'pid,hostname'
    }
  }
};

// 本番環境用の設定
const productionConfig = {
  level: LOG_LEVEL,
  formatters: {
    level: (label: string) => {
      return { level: label };
    }
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // ファイル出力設定
  transport: {
    targets: [
      {
        target: 'pino/file',
        options: {
          destination: path.join(LOG_DIR, 'app.log'),
          mkdir: true
        }
      },
      {
        target: 'pino/file',
        level: 'error',
        options: {
          destination: path.join(LOG_DIR, 'error.log'),
          mkdir: true
        }
      }
    ]
  }
};

// 環境に応じてロガーを作成
const logger = pino(
  NODE_ENV === 'development' ? developmentConfig : productionConfig
);

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