# NotebookLM Mini

NotebookLM Mini là trợ lý học tập cá nhân dựa trên kiến trúc **Retrieval-Augmented Generation (RAG)**. Ứng dụng hỗ trợ mô hình local (Ollama/LM Studio) và các provider cloud tùy cấu hình. Khi dùng provider cloud hoặc nạp URL/YouTube, dữ liệu được gửi qua mạng tới dịch vụ tương ứng.

Dự án cho phép bạn tải lên tài liệu cá nhân (PDF, DOCX, PPTX, HTML...), tự động phân tích và tương tác qua:
- 💬 **Hỏi đáp siêu tốc** với trích dẫn chính xác.
- 📝 **Tóm tắt thông minh** sử dụng kỹ thuật Map-Reduce.
- 🎯 **Tạo bài trắc nghiệm (Quiz) & Flashcards** tự động để ôn tập.

---

## Chạy bằng Docker

```bash
docker compose up --build
```

Mở `http://localhost:8000`. Dữ liệu SQLite, Qdrant, BM25, tài liệu và uploads được lưu trong các thư mục đã mount từ máy chủ.

## Chạy khi phát triển

Backend:

```bash
python -m pip install -r requirements.txt
uvicorn src.api.api:app --reload --port 8000
```

Frontend trong terminal khác:

```bash
cd frontend
npm install
npm run dev
```

Vite proxy các request `/api` tới `http://127.0.0.1:8000`.

## Kiểm tra

```bash
pytest -q
python -m compileall -q src tests
cd frontend && npm run lint && npm run build
```

## Cấu hình

Sao chép `.env.example` thành `.env` nếu cần tùy chỉnh. Mặc định model embedding chỉ được đọc từ cache local. Đặt `RAG_ALLOW_MODEL_DOWNLOAD=true` khi chủ động muốn cho phép Hugging Face tải model còn thiếu. File upload giới hạn mặc định 100 MB (`RAG_MAX_UPLOAD_SIZE_MB`); loại file được kiểm tra trước khi parse.

## Tính năng

- Chat với nguồn tài liệu và streaming trả lời kèm citations.
- Hybrid retrieval gồm Qdrant semantic search và BM25; reranker tùy chọn.
- Nạp PDF, Office, văn bản, bảng tính, ảnh, audio, URL và transcript YouTube (tùy parser/dependency).
- Tạo study guide, summary, quiz, flashcard/SRS, mindmap, timeline, podcast, so sánh tài liệu và ghi chú.
- Chọn mô hình local hoặc cloud trong cài đặt. Các model Hugging Face thiếu trong cache không tự tải trừ khi bật `RAG_ALLOW_MODEL_DOWNLOAD=true`.

---

## 📖 HƯỚNG DẪN SỬ DỤNG CHI TIẾT

### Yêu cầu cấu hình máy

Tài nguyên cần thiết phụ thuộc vào model local được chọn. Model cloud cần kết nối mạng và API key. Có thể chạy ứng dụng local mà không tải model mới nếu embedding/LLM cần thiết đã có trong cache hoặc dịch vụ local đang chạy.

---

### Cách thao tác trên web

#### Bước 1: Tạo thẻ làm việc (Notebook)
- Ngay khi vào màn hình chính, gõ tên cho Thẻ (Ví dụ: *Luật Kinh Tế* hoặc *Giáo trình AI*) và ấn **+ Tạo Thẻ Mới**.
- Hệ thống hỗ trợ nhiều Thẻ (Notebook) độc lập. Dữ liệu Thẻ này không bị lẫn vào Thẻ kia.

#### Bước 2: Tải tài liệu lên
- Bấm vào tên Thẻ bạn vừa tạo.
- Ở cột menu bên tay trái, tìm khu vực **Nguồn (Tài liệu đã nạp)**.
- Kéo thả file PDF, DOCX, hoặc PPTX vào ô tải lên. Hệ thống sẽ mất vài giây để đọc, cắt nhỏ và phân tích nội dung lưu vào não bộ.

#### Bước 3: Tương tác với tài liệu
Ở giữa màn hình có 4 tab tính năng chính:

1. **💬 Hỏi đáp (Chat):**
   - Đặt bất kỳ câu hỏi nào liên quan đến tài liệu.
   - AI sẽ mất khoảng 4-8 giây để "đọc tài liệu" (xoay vòng tròn) và sau đó sẽ gõ chữ trả lời cực nhanh. Cuối câu trả lời sẽ có trích dẫn nguồn cụ thể (Trích từ file nào).
   
2. **📝 Tóm tắt:**
   - Ấn một nút, AI sẽ tự động đọc lướt toàn bộ tài liệu bạn đã tải lên, tóm tắt các ý chính và gạch đầu dòng những điểm quan trọng nhất.

3. **🧠 Trắc nghiệm (Quiz):**
   - AI sẽ tự động soi tài liệu và tạo ra 1 bộ câu hỏi trắc nghiệm A-B-C-D. Bạn có thể tự test kiến thức của mình và xem đáp án giải thích ngay bên dưới.

4. **⚡ Flashcards:**
   - Tạo ra các thẻ lật (Mặt trước câu hỏi - Mặt sau khái niệm) để bạn học thuộc lòng từ vựng hoặc khái niệm nhanh chóng.

---

### Xử lý lỗi thường gặp

- **Lỗi Terminal báo "Connection refused" / "Lỗi từ Backend":** 
  Kiểm tra backend ở cổng 8000 còn chạy không. Với Docker, xem log bằng `docker compose logs -f`.
  
- **Lần đầu khởi động chậm?**
  Model embedding có thể cần được tải vào RAM/VRAM. Cần cài và khởi động model provider đã chọn (ví dụ Ollama) trước khi chat.
  
- **Trình duyệt không tự mở?**
  Mở `http://localhost:8000` khi chạy Docker hoặc địa chỉ Vite được in ra khi chạy frontend dev server.

---

## Kiến trúc

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Tầng Giao diện & Định tuyến API                                    │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐     │
│  │  React/Vite UI       │◄─►│  FastAPI Backend (SSE Support)  │     │
│  └──────────────────────┘  └──────────┬───────────────────────┘     │
└───────────────────────────────────────┬─────────────────────────────┘
                                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Tầng Trí Tuệ Nhân Tạo (Local AI Engine)                            │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐     │
│  │ Local / Cloud LLM    │  │ Ollama, LM Studio, API providers │     │
│  │ Provider configurable│  │ Cloud requires network/API key   │     │
│  └──────────┬───────────┘  └──────────────────────────────────┘     │
└─────────────┼───────────────────────────────────────────────────────┘
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Tầng Xử lý Dữ liệu & RAG Pipeline                                  │
│  ┌────────────────┐  ┌───────────────┐  ┌──────────────────────┐    │
│  │ MarkItDown     │─►│ Hybrid Search │─►│ Cross-Encoder        │    │
│  │ Parser (OCR)   │  │ (Qdrant+BM25) │  │ Reranker (BGE-m3)    │    │
│  └────────────────┘  └───────────────┘  └──────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

Bạn có thể thay đổi cách hệ thống hoạt động thông qua file `.env` ẩn:
- `RAG_LLM_TEMPERATURE`: Khuyên dùng 0.4 - 0.6.
- `RAG_HYBRID_INITIAL_K` và `RAG_HYBRID_RERANK_K`: Số đoạn văn lấy ra, giảm xuống sẽ đẩy nhanh tốc độ đọc.

---
Ứng dụng có thêm giao diện Streamlit legacy trong `src/interfaces/ui.py`; giao diện React là SPA được phục vụ trong cấu hình Docker.
