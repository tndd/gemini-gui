import { spawn, ChildProcess } from 'child_process';

// セッションIDとGemini CLIプロセスのマッピング
const sessionProcesses = new Map<string, ChildProcess>();

export const getOrCreateGeminiProcess = (sessionId: string, workingDirectory?: string): ChildProcess => {
  // 既存プロセスがあればそれを返す
  if (sessionProcesses.has(sessionId)) {
    const existingProcess = sessionProcesses.get(sessionId)!;
    // プロセスが生きているかチェック
    if (!existingProcess.killed) {
      return existingProcess;
    }
    // 死んでいれば削除
    sessionProcesses.delete(sessionId);
  }

  // 新しいプロセスを作成
  const geminiProcess = spawn('gemini', {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: workingDirectory || process.cwd()
  });

  // プロセス終了時にマップから削除
  geminiProcess.on('exit', () => {
    sessionProcesses.delete(sessionId);
  });

  // マップに登録
  sessionProcesses.set(sessionId, geminiProcess);
  
  return geminiProcess;
};

export const terminateSessionProcess = (sessionId: string): void => {
  const process = sessionProcesses.get(sessionId);
  if (process && !process.killed) {
    process.kill();
  }
  sessionProcesses.delete(sessionId);
};

export const terminateAllProcesses = (): void => {
  sessionProcesses.forEach((process) => {
    if (!process.killed) {
      process.kill();
    }
  });
  sessionProcesses.clear();
};