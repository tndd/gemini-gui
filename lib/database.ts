import Database from 'better-sqlite3';
import path from 'path';

export interface ConversationEntry {
  id: number;
  timestamp: string;
  user_input: string;
  gemini_response: string;
  session_id: string;
  working_directory: string;
}

class DatabaseManager {
  private db: Database.Database | null = null;

  init(): void {
    if (this.db) return;

    // データベースファイルをプロジェクトルートに作成
    const dbPath = path.join(process.cwd(), 'conversations.db');
    this.db = new Database(dbPath);

    // テーブル作成
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_input TEXT NOT NULL,
        gemini_response TEXT NOT NULL,
        session_id TEXT NOT NULL,
        working_directory TEXT NOT NULL
      )
    `);

    // 既存のテーブルに working_directory カラムを追加（存在しない場合）
    try {
      this.db.exec(`
        ALTER TABLE conversations 
        ADD COLUMN working_directory TEXT DEFAULT '${process.cwd()}'
      `);
    } catch (error) {
      // カラムが既に存在する場合はエラーを無視
    }
  }

  saveConversation(
    userInput: string, 
    geminiResponse: string, 
    sessionId: string,
    workingDirectory: string
  ): void {
    if (!this.db) {
      throw new Error('データベースが初期化されていません');
    }

    const stmt = this.db.prepare(`
      INSERT INTO conversations (user_input, gemini_response, session_id, working_directory)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(userInput, geminiResponse, sessionId, workingDirectory);
  }

  getConversationHistory(sessionId: string): ConversationEntry[] {
    if (!this.db) {
      throw new Error('データベースが初期化されていません');
    }

    const stmt = this.db.prepare(`
      SELECT * FROM conversations 
      WHERE session_id = ? 
      ORDER BY timestamp ASC
    `);
    
    return stmt.all(sessionId) as ConversationEntry[];
  }

  getAllConversations(): ConversationEntry[] {
    if (!this.db) {
      throw new Error('データベースが初期化されていません');
    }

    const stmt = this.db.prepare('SELECT * FROM conversations ORDER BY timestamp DESC');
    return stmt.all() as ConversationEntry[];
  }

  getSessionWorkingDirectory(sessionId: string): string | null {
    if (!this.db) {
      throw new Error('データベースが初期化されていません');
    }

    const stmt = this.db.prepare(`
      SELECT working_directory FROM conversations 
      WHERE session_id = ? 
      ORDER BY timestamp DESC 
      LIMIT 1
    `);
    
    const result = stmt.get(sessionId) as { working_directory: string } | undefined;
    return result?.working_directory || null;
  }

  getSessionsByWorkingDirectory(): { [directory: string]: ConversationEntry[] } {
    if (!this.db) {
      throw new Error('データベースが初期化されていません');
    }

    const conversations = this.getAllConversations();
    const sessionsByDir: { [directory: string]: ConversationEntry[] } = {};
    
    conversations.forEach(conv => {
      const dir = conv.working_directory || process.cwd();
      if (!sessionsByDir[dir]) {
        sessionsByDir[dir] = [];
      }
      sessionsByDir[dir].push(conv);
    });

    return sessionsByDir;
  }
}

// シングルトンパターン
const dbManager = new DatabaseManager();
export default dbManager;