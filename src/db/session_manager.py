import sqlite3
import os
import json
import logging
from datetime import datetime
from typing import List, Dict, Optional, Any

logger = logging.getLogger(__name__)

class SessionManager:
    """Quản lý CSDL SQLite cho Notebooks, tin nhắn, Cài đặt hệ thống và Study Guides."""
    
    def __init__(self, db_path: str = "storage/notebooks.db"):
        self.db_path = db_path
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self._init_db()
        
    def _get_conn(self):
        return sqlite3.connect(self.db_path, check_same_thread=False)
        
    def _init_db(self):
        with self._get_conn() as conn:
            cursor = conn.cursor()
            
            # 1. Bảng Notebooks (hỗ trợ đa nhà cung cấp model: Local Ollama, LM Studio, Gemini, OpenAI, Groq...)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS notebooks (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    is_private BOOLEAN NOT NULL DEFAULT 1,
                    gemini_api_key TEXT,
                    provider TEXT DEFAULT 'ollama',
                    model_name TEXT DEFAULT '',
                    api_key TEXT DEFAULT '',
                    base_url TEXT DEFAULT '',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # 2. Bảng Documents (Tài liệu tải lên)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS documents (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    notebook_id TEXT,
                    filename TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (notebook_id) REFERENCES notebooks (id)
                )
            ''')
            
            # 3. Bảng Messages (Tin nhắn Chat)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    notebook_id TEXT,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    citations TEXT, -- JSON string
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (notebook_id) REFERENCES notebooks (id)
                )
            ''')
            
            # 4. Bảng Study Guides
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS study_guides (
                    notebook_id TEXT PRIMARY KEY,
                    summary TEXT,
                    faq TEXT,
                    glossary TEXT,
                    quiz TEXT,
                    flashcards TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (notebook_id) REFERENCES notebooks (id)
                )
            ''')

            # 5. Bảng App Settings (Lưu trữ cấu hình toàn cục: API Keys, Local Endpoints, Model mặc định)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS app_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )
            ''')
            
            # Schema Migration tự động nếu các cột chưa tồn tại
            migrations = [
                ("study_guides", "quiz", "TEXT"),
                ("study_guides", "flashcards", "TEXT"),
                ("notebooks", "is_private", "BOOLEAN NOT NULL DEFAULT 1"),
                ("notebooks", "gemini_api_key", "TEXT"),
                ("notebooks", "provider", "TEXT DEFAULT 'ollama'"),
                ("notebooks", "model_name", "TEXT DEFAULT ''"),
                ("notebooks", "api_key", "TEXT DEFAULT ''"),
                ("notebooks", "base_url", "TEXT DEFAULT ''"),
            ]
            
            for table, col, col_type in migrations:
                try:
                    cursor.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
                except sqlite3.OperationalError:
                    pass # Cột đã tồn tại
                    
            conn.commit()

    # --- API Cài đặt Toàn Cục (Global Settings) ---
    def get_app_settings(self) -> Dict[str, Any]:
        """Lấy toàn bộ cài đặt hệ thống."""
        default_settings = {
            "default_provider": "ollama",
            "default_model": "qwen2.5:3b",
            "ollama_base_url": "http://localhost:11434",
            "lm_studio_base_url": "http://localhost:1234/v1",
            "gemini_api_key": "",
            "gemini_model": "gemini-2.5-flash",
            "openai_api_key": "",
            "openai_model": "gpt-4o-mini",
            "groq_api_key": "",
            "groq_model": "llama-3.3-70b-versatile",
            "openrouter_api_key": "",
            "openrouter_model": "deepseek/deepseek-r1",
            "router9_api_key": "",
            "router9_base_url": "http://localhost:20128/v1",
            "router9_model": "claude-3-5-sonnet",
            "custom_base_url": "",
            "custom_api_key": "",
            "custom_model": ""
        }
        with self._get_conn() as conn:
            cursor = conn.execute("SELECT key, value FROM app_settings")
            for key, val in cursor.fetchall():
                default_settings[key] = val

        # Đọc bổ sung từ biến môi trường (Environment Variables / .env)
        env_mappings = {
            "router9_api_key": "ROUTER9_API_KEY",
            "router9_base_url": "ROUTER9_BASE_URL",
            "router9_model": "ROUTER9_MODEL",
            "groq_api_key": "GROQ_API_KEY",
            "gemini_api_key": "GEMINI_API_KEY",
            "openai_api_key": "OPENAI_API_KEY",
            "openrouter_api_key": "OPENROUTER_API_KEY"
        }
        for s_key, env_var in env_mappings.items():
            if not default_settings.get(s_key) and os.getenv(env_var):
                default_settings[s_key] = os.getenv(env_var)

        return default_settings

    def save_app_settings(self, settings_dict: Dict[str, Any]):
        """Lưu các cài đặt hệ thống vào SQLite."""
        with self._get_conn() as conn:
            for key, val in settings_dict.items():
                if val is not None:
                    conn.execute(
                        "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)",
                        (key, str(val))
                    )
            conn.commit()

    # --- API Quản lý Notebooks ---
    def create_notebook(
        self, 
        notebook_id: str, 
        title: str = "Notebook mới", 
        is_private: bool = True, 
        gemini_api_key: Optional[str] = None,
        provider: Optional[str] = None,
        model_name: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None
    ):
        # Thiết lập provider mặc định nếu chưa truyền
        if not provider:
            provider = "ollama" if is_private else "gemini"
        actual_key = api_key or gemini_api_key or ""
        
        with self._get_conn() as conn:
            conn.execute(
                """INSERT OR IGNORE INTO notebooks 
                   (id, title, is_private, gemini_api_key, provider, model_name, api_key, base_url) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (notebook_id, title, is_private, gemini_api_key, provider, model_name or "", actual_key, base_url or "")
            )
            conn.commit()

    def update_notebook_settings(
        self, 
        notebook_id: str, 
        title: Optional[str] = None,
        provider: Optional[str] = None, 
        model_name: Optional[str] = None, 
        api_key: Optional[str] = None, 
        base_url: Optional[str] = None,
        is_private: Optional[bool] = None
    ):
        """Cập nhật cấu hình mô hình hoặc quyền riêng tư cho Notebook."""
        updates = []
        params = []
        if title is not None:
            updates.append("title = ?")
            params.append(title)
        if provider is not None:
            updates.append("provider = ?")
            params.append(provider)
        if model_name is not None:
            updates.append("model_name = ?")
            params.append(model_name)
        if api_key is not None:
            updates.append("api_key = ?")
            params.append(api_key)
            updates.append("gemini_api_key = ?")
            params.append(api_key)
        if base_url is not None:
            updates.append("base_url = ?")
            params.append(base_url)
        if is_private is not None:
            updates.append("is_private = ?")
            params.append(is_private)
            
        if not updates:
            return
            
        params.append(notebook_id)
        query = f"UPDATE notebooks SET {', '.join(updates)} WHERE id = ?"
        with self._get_conn() as conn:
            conn.execute(query, tuple(params))
            conn.commit()

    def list_notebooks(self) -> List[Dict]:
        with self._get_conn() as conn:
            cursor = conn.execute("""
                SELECT id, title, is_private, gemini_api_key, provider, model_name, api_key, base_url, created_at 
                FROM notebooks ORDER BY created_at DESC
            """)
            rows = cursor.fetchall()
            return [
                {
                    "id": r[0], 
                    "title": r[1], 
                    "is_private": bool(r[2]), 
                    "gemini_api_key": r[3], 
                    "provider": r[4] or ("ollama" if bool(r[2]) else "gemini"),
                    "model_name": r[5] or "",
                    "api_key": r[6] or r[3] or "",
                    "base_url": r[7] or "",
                    "created_at": r[8]
                } for r in rows
            ]

    def update_notebook_privacy(self, notebook_id: str, is_private: bool):
        with self._get_conn() as conn:
            conn.execute("UPDATE notebooks SET is_private = ? WHERE id = ?", (is_private, notebook_id))
            conn.commit()

    def delete_notebook(self, notebook_id: str):
        with self._get_conn() as conn:
            conn.execute("DELETE FROM study_guides WHERE notebook_id = ?", (notebook_id,))
            conn.execute("DELETE FROM messages WHERE notebook_id = ?", (notebook_id,))
            conn.execute("DELETE FROM documents WHERE notebook_id = ?", (notebook_id,))
            conn.execute("DELETE FROM notebooks WHERE id = ?", (notebook_id,))
            conn.commit()
            
        # Dọn dẹp chỉ mục BM25
        try:
            from ..retrieval.bm25_index import delete_bm25_folder
            delete_bm25_folder(notebook_id)
        except Exception as e:
            logger.warning(f"Lỗi dọn dẹp BM25 khi xóa notebook {notebook_id}: {e}")

    def get_notebook_privacy(self, notebook_id: str) -> bool:
        with self._get_conn() as conn:
            cursor = conn.execute("SELECT is_private FROM notebooks WHERE id = ?", (notebook_id,))
            row = cursor.fetchone()
            return bool(row[0]) if row else True

    def get_notebook(self, notebook_id: str) -> Optional[Dict]:
        with self._get_conn() as conn:
            cursor = conn.execute("""
                SELECT id, title, is_private, gemini_api_key, provider, model_name, api_key, base_url, created_at 
                FROM notebooks WHERE id = ?
            """, (notebook_id,))
            row = cursor.fetchone()
            if row:
                return {
                    "id": row[0], 
                    "title": row[1], 
                    "is_private": bool(row[2]), 
                    "gemini_api_key": row[3],
                    "provider": row[4] or ("ollama" if bool(row[2]) else "gemini"),
                    "model_name": row[5] or "",
                    "api_key": row[6] or row[3] or "",
                    "base_url": row[7] or "",
                    "created_at": row[8]
                }
            return None

    # --- API Quản lý Tài liệu ---
    def add_document(self, notebook_id: str, filename: str):
        with self._get_conn() as conn:
            conn.execute("INSERT INTO documents (notebook_id, filename) VALUES (?, ?)", (notebook_id, filename))
            conn.commit()

    def delete_document(self, notebook_id: str, filename: str):
        with self._get_conn() as conn:
            conn.execute("DELETE FROM documents WHERE notebook_id = ? AND filename = ?", (notebook_id, filename))
            conn.commit()
            
        # Cập nhật lại BM25 index
        try:
            from ..retrieval.bm25_index import get_bm25_index
            bm25 = get_bm25_index(notebook_id)
            bm25.remove_document(filename)
            bm25.save()
        except Exception as e:
            logger.warning(f"Lỗi cập nhật BM25 khi xóa tài liệu {filename}: {e}")

    def get_documents(self, notebook_id: str) -> List[Dict]:
        with self._get_conn() as conn:
            cursor = conn.execute("SELECT id, filename, created_at FROM documents WHERE notebook_id = ? ORDER BY created_at ASC", (notebook_id,))
            rows = cursor.fetchall()
            return [{"id": r[0], "filename": r[1], "created_at": r[2]} for r in rows]

    # --- API Quản lý Tin nhắn ---
    def save_message(self, notebook_id: str, role: str, content: str, citations: Optional[List[Dict]] = None):
        citations_str = json.dumps(citations, ensure_ascii=False) if citations else None
        with self._get_conn() as conn:
            conn.execute(
                "INSERT INTO messages (notebook_id, role, content, citations) VALUES (?, ?, ?, ?)",
                (notebook_id, role, content, citations_str)
            )
            conn.commit()

    def get_chat_history(self, notebook_id: str) -> List[Dict]:
        with self._get_conn() as conn:
            cursor = conn.execute(
                "SELECT role, content, citations FROM messages WHERE notebook_id = ? ORDER BY created_at ASC",
                (notebook_id,)
            )
            rows = cursor.fetchall()
            history = []
            for r in rows:
                cites = json.loads(r[2]) if r[2] else []
                history.append({
                    "role": r[0],
                    "content": r[1],
                    "citations": cites
                })
            return history

    # --- API Study Guide ---
    def save_study_guide(self, notebook_id: str, summary: str, faq: str, glossary: str, quiz: Any = None, flashcards: Any = None):
        # Hỗ trợ nhận cả string JSON lẫn object Python (dict/list)
        quiz_str = json.dumps(quiz, ensure_ascii=False) if isinstance(quiz, (list, dict)) else quiz
        flashcards_str = json.dumps(flashcards, ensure_ascii=False) if isinstance(flashcards, (list, dict)) else flashcards
        
        with self._get_conn() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO study_guides (notebook_id, summary, faq, glossary, quiz, flashcards) VALUES (?, ?, ?, ?, ?, ?)",
                (notebook_id, summary, faq, glossary, quiz_str, flashcards_str)
            )
            conn.commit()

    def get_study_guide(self, notebook_id: str) -> Optional[Dict]:
        with self._get_conn() as conn:
            cursor = conn.execute("SELECT summary, faq, glossary, quiz, flashcards FROM study_guides WHERE notebook_id = ?", (notebook_id,))
            row = cursor.fetchone()
            if row:
                quiz_data = None
                flashcards_data = None
                if row[3]:
                    try:
                        quiz_data = json.loads(row[3])
                    except Exception:
                        quiz_data = row[3]
                if row[4]:
                    try:
                        flashcards_data = json.loads(row[4])
                    except Exception:
                        flashcards_data = row[4]
                    
                return {
                    "summary": row[0], 
                    "faq": row[1], 
                    "glossary": row[2],
                    "quiz": quiz_data,
                    "flashcards": flashcards_data
                }
            return None
