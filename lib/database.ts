import Database from 'better-sqlite3';
import path from 'path';

export interface ConversationEntry {
  id: number;
  timestamp: string;
  user_input: string;
  gemini_response: string;
  session_id: string;
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
        session_id TEXT NOT NULL
      )
    `);
  }

  saveConversation(
    userInput: string, 
    geminiResponse: string, 
    sessionId: string
  ): void {
    if (!this.db) {
      throw new Error('データベースが初期化されていません');
    }

    const stmt = this.db.prepare(`
      INSERT INTO conversations (user_input, gemini_response, session_id)
      VALUES (?, ?, ?)
    `);
    
    stmt.run(userInput, geminiResponse, sessionId);
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
}

// シングルトンパターン
const dbManager = new DatabaseManager();
export default dbManager;