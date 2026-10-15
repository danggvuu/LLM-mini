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
            
            # 6. Bảng Flashcard Progress (Spaced Repetition System - SRS)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS flashcard_progress (
                    notebook_id TEXT,
                    card_index INTEGER,
                    ease_factor REAL DEFAULT 2.5,
                    interval_days INTEGER DEFAULT 0,
                    repetitions INTEGER DEFAULT 0,
                    next_review_date TEXT,
                    last_rating INTEGER DEFAULT 0,
                    PRIMARY KEY (notebook_id, card_index),
                    FOREIGN KEY (notebook_id) REFERENCES notebooks (id)
                )
            ''')
            
            # Schema Migration tự động nếu các cột chưa tồn tại
            migrations = [
                ("study_guides", "quiz", "TEXT"),
                ("study_guides", "flashcards", "TEXT"),
                ("study_guides", "mindmap", "TEXT"),
                ("study_guides", "timeline_outline", "TEXT"),
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
            conn.execute("DELETE FROM flashcard_progress WHERE notebook_id = ?", (notebook_id,))
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
    def save_message(self, notebook_id: str, role: str, content: str, citations: Optional[List[Dict]] = None) -> int:
        citations_str = json.dumps(citations, ensure_ascii=False) if citations else None
        with self._get_conn() as conn:
            cursor = conn.execute(
                "INSERT INTO messages (notebook_id, role, content, citations) VALUES (?, ?, ?, ?)",
                (notebook_id, role, content, citations_str)
            )
            conn.commit()
            return cursor.lastrowid

    def get_chat_history(self, notebook_id: str) -> List[Dict]:
        with self._get_conn() as conn:
            cursor = conn.execute(
                "SELECT id, role, content, citations, created_at FROM messages WHERE notebook_id = ? ORDER BY created_at ASC",
                (notebook_id,)
            )
            rows = cursor.fetchall()
            history = []
            for r in rows:
                cites = json.loads(r[3]) if r[3] else []
                history.append({
                    "id": r[0],
                    "role": r[1],
                    "content": r[2],
                    "citations": cites,
                    "created_at": r[4]
                })
            return history

    def delete_message(self, notebook_id: str, message_id: int):
        with self._get_conn() as conn:
            conn.execute("DELETE FROM messages WHERE notebook_id = ? AND id = ?", (notebook_id, message_id))
            conn.commit()

    def clear_chat_history(self, notebook_id: str):
        with self._get_conn() as conn:
            conn.execute("DELETE FROM messages WHERE notebook_id = ?", (notebook_id,))
            conn.commit()

    # --- API Study Guide & Tri thức mở rộng ---
    def save_study_guide(
        self, 
        notebook_id: str, 
        summary: str, 
        faq: str, 
        glossary: str, 
        quiz: Any = None, 
        flashcards: Any = None,
        mindmap: Any = None,
        timeline_outline: Any = None
    ):
        # Giữ lại mindmap và timeline_outline cũ nếu không được truyền mới
        existing = self.get_study_guide(notebook_id)
        if existing:
            if mindmap is None:
                mindmap = existing.get("mindmap")
            if timeline_outline is None:
                timeline_outline = existing.get("timeline_outline")

        # Hỗ trợ nhận cả string JSON lẫn object Python (dict/list)
        quiz_str = json.dumps(quiz, ensure_ascii=False) if isinstance(quiz, (list, dict)) else quiz
        flashcards_str = json.dumps(flashcards, ensure_ascii=False) if isinstance(flashcards, (list, dict)) else flashcards
        mindmap_str = json.dumps(mindmap, ensure_ascii=False) if isinstance(mindmap, (list, dict)) else mindmap
        timeline_str = json.dumps(timeline_outline, ensure_ascii=False) if isinstance(timeline_outline, (list, dict)) else timeline_outline
        
        with self._get_conn() as conn:
            conn.execute(
                """INSERT OR REPLACE INTO study_guides 
                   (notebook_id, summary, faq, glossary, quiz, flashcards, mindmap, timeline_outline) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (notebook_id, summary, faq, glossary, quiz_str, flashcards_str, mindmap_str, timeline_str)
            )
            conn.commit()

    def get_study_guide(self, notebook_id: str) -> Optional[Dict]:
        with self._get_conn() as conn:
            cursor = conn.execute(
                "SELECT summary, faq, glossary, quiz, flashcards, mindmap, timeline_outline FROM study_guides WHERE notebook_id = ?", 
                (notebook_id,)
            )
            row = cursor.fetchone()
            if row:
                quiz_data = None
                flashcards_data = None
                mindmap_data = None
                timeline_data = None
                
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
                if row[5]:
                    try:
                        mindmap_data = json.loads(row[5])
                    except Exception:
                        mindmap_data = row[5]
                if row[6]:
                    try:
                        timeline_data = json.loads(row[6])
                    except Exception:
                        timeline_data = row[6]
                    
                return {
                    "summary": row[0], 
                    "faq": row[1], 
                    "glossary": row[2],
                    "quiz": quiz_data,
                    "flashcards": flashcards_data,
                    "mindmap": mindmap_data,
                    "timeline_outline": timeline_data
                }
            return None

    def save_mindmap(self, notebook_id: str, mindmap_data: Any):
        mindmap_str = json.dumps(mindmap_data, ensure_ascii=False) if isinstance(mindmap_data, (list, dict)) else str(mindmap_data)
        with self._get_conn() as conn:
            conn.execute(
                "INSERT INTO study_guides (notebook_id, mindmap) VALUES (?, ?) ON CONFLICT(notebook_id) DO UPDATE SET mindmap = ?",
                (notebook_id, mindmap_str, mindmap_str)
            )
            conn.commit()

    def save_timeline_outline(self, notebook_id: str, timeline_data: Any):
        timeline_str = json.dumps(timeline_data, ensure_ascii=False) if isinstance(timeline_data, (list, dict)) else str(timeline_data)
        with self._get_conn() as conn:
            conn.execute(
                "INSERT INTO study_guides (notebook_id, timeline_outline) VALUES (?, ?) ON CONFLICT(notebook_id) DO UPDATE SET timeline_outline = ?",
                (notebook_id, timeline_str, timeline_str)
            )
            conn.commit()

    # --- API Spaced Repetition System (SRS - Anki / SuperMemo-2) ---
    def get_srs_progress(self, notebook_id: str) -> Dict[str, Any]:
        with self._get_conn() as conn:
            cursor = conn.execute(
                "SELECT card_index, ease_factor, interval_days, repetitions, next_review_date, last_rating FROM flashcard_progress WHERE notebook_id = ?",
                (notebook_id,)
            )
            rows = cursor.fetchall()
            cards_progress = {}
            for r in rows:
                cards_progress[r[0]] = {
                    "card_index": r[0],
                    "ease_factor": r[1],
                    "interval_days": r[2],
                    "repetitions": r[3],
                    "next_review_date": r[4],
                    "last_rating": r[5]
                }
            return cards_progress

    def update_srs_progress(self, notebook_id: str, card_index: int, rating: int) -> Dict[str, Any]:
        """
        Cập nhật thuật toán SM-2:
        rating: 1 (Lại/Again), 2 (Khó/Hard), 3 (Tốt/Good), 4 (Dễ/Easy)
        """
        from datetime import datetime, timedelta, timezone
        
        with self._get_conn() as conn:
            cursor = conn.execute(
                "SELECT ease_factor, interval_days, repetitions FROM flashcard_progress WHERE notebook_id = ? AND card_index = ?",
                (notebook_id, card_index)
            )
            row = cursor.fetchone()
            
            if row:
                ease_factor, interval_days, reps = row[0], row[1], row[2]
            else:
                ease_factor, interval_days, reps = 2.5, 0, 0
                
            # Tính toán SuperMemo 2 rút gọn
            if rating == 1: # Again
                reps = 0
                interval_days = 0
                ease_factor = max(1.3, ease_factor - 0.2)
                next_review = datetime.now(timezone.utc) + timedelta(minutes=1)
            elif rating == 2: # Hard
                reps = reps + 1
                interval_days = 1 if interval_days <= 1 else int(interval_days * 1.2)
                ease_factor = max(1.3, ease_factor - 0.15)
                next_review = datetime.now(timezone.utc) + timedelta(days=interval_days)
            elif rating == 3: # Good
                reps = reps + 1
                if reps == 1:
                    interval_days = 1
                elif reps == 2:
                    interval_days = 6
                else:
                    interval_days = int(interval_days * ease_factor)
                next_review = datetime.now(timezone.utc) + timedelta(days=interval_days)
            else: # Easy (4)
                reps = reps + 1
                if reps == 1:
                    interval_days = 3
                else:
                    interval_days = int(interval_days * ease_factor * 1.3)
                ease_factor = ease_factor + 0.15
                next_review = datetime.now(timezone.utc) + timedelta(days=interval_days)

            next_review_str = next_review.isoformat()
            
            conn.execute(
                """INSERT OR REPLACE INTO flashcard_progress 
                   (notebook_id, card_index, ease_factor, interval_days, repetitions, next_review_date, last_rating)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (notebook_id, card_index, ease_factor, interval_days, reps, next_review_str, rating)
            )
            conn.commit()
            
            return {
                "card_index": card_index,
                "ease_factor": ease_factor,
                "interval_days": interval_days,
                "repetitions": reps,
                "next_review_date": next_review_str,
                "last_rating": rating
            }

    # --- API Xuất & Nhập Notebook (Export / Import) ---
    def export_notebook_data(self, notebook_id: str) -> Optional[Dict[str, Any]]:
        notebook = self.get_notebook(notebook_id)
        if not notebook:
            return None
            
        docs = self.get_documents(notebook_id)
        messages = self.get_chat_history(notebook_id)
        study_guide = self.get_study_guide(notebook_id)
        srs = self.get_srs_progress(notebook_id)
        
        return {
            "version": "1.0",
            "notebook": notebook,
            "documents": docs,
            "messages": messages,
            "study_guide": study_guide,
            "srs_progress": srs,
            "exported_at": datetime.now().isoformat()
        }

    def import_notebook_data(self, data: Dict[str, Any]) -> str:
        import uuid
        nb_info = data.get("notebook", {})
        new_id = str(int(datetime.now().timestamp() * 1000))
        title = nb_info.get("title", "Notebook đã nhập") + " (Bản sao)"
        
        self.create_notebook(
            notebook_id=new_id,
            title=title,
            is_private=nb_info.get("is_private", True),
            provider=nb_info.get("provider", "ollama"),
            model_name=nb_info.get("model_name", ""),
            api_key=nb_info.get("api_key", ""),
            base_url=nb_info.get("base_url", "")
        )
        
        # Import tài liệu
        for doc in data.get("documents", []):
            self.add_document(new_id, doc.get("filename", "unknown"))
            
        # Import tin nhắn
        for msg in data.get("messages", []):
            self.save_message(new_id, msg.get("role", "user"), msg.get("content", ""), msg.get("citations"))
            
        # Import study guide
        sg = data.get("study_guide")
        if sg:
            self.save_study_guide(
                new_id,
                summary=sg.get("summary", ""),
                faq=sg.get("faq", ""),
                glossary=sg.get("glossary", ""),
                quiz=sg.get("quiz"),
                flashcards=sg.get("flashcards"),
                mindmap=sg.get("mindmap"),
                timeline_outline=sg.get("timeline_outline")
            )
            
        return new_id
