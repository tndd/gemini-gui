import * as pty from 'node-pty';

// セッションIDとptyプロセスのマッピング
const sessionTerminals = new Map<string, pty.IPty>();

export const getOrCreateTerminal = (sessionId: string, workingDirectory?: string): pty.IPty => {
  // 既存ターミナルがあればそれを返す
  if (sessionTerminals.has(sessionId)) {
    const existingTerminal = sessionTerminals.get(sessionId)!;
    return existingTerminal;
  }

  // 新しいptyターミナルを作成してGemini CLIを起動
  const terminal = pty.spawn('gemini', ['--model', 'gemini-2.5-flash'], {
    name: 'xterm-color',
    cwd: workingDirectory || process.cwd(),
    env: process.env,
  });

  // ターミナル終了時にマップから削除
  terminal.onExit(() => {
    sessionTerminals.delete(sessionId);
  });

  // マップに登録
  sessionTerminals.set(sessionId, terminal);
  
  return terminal;
};

export const terminateTerminal = (sessionId: string): void => {
  const terminal = sessionTerminals.get(sessionId);
  if (terminal) {
    terminal.kill();
  }
  sessionTerminals.delete(sessionId);
};

export const terminateAllTerminals = (): void => {
  sessionTerminals.forEach((terminal) => {
    terminal.kill();
  });
  sessionTerminals.clear();
};

export const sendToTerminal = (sessionId: string, data: string): void => {
  const terminal = sessionTerminals.get(sessionId);
  if (terminal) {
    terminal.write(data);
  }
};

export const getTerminalOutput = (sessionId: string, callback: (data: string) => void): void => {
  const terminal = sessionTerminals.get(sessionId);
  if (terminal) {
    terminal.onData(callback);
  }
};