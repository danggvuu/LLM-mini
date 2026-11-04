# NỘI DUNG POSTER THUYẾT TRÌNH KHOA HỌC KỸ THUẬT TOÀN DIỆN
*(Áp dụng cho mọi cuộc thi NCKH Sinh viên / Sáng tạo Trẻ / Hội nghị Quốc tế & Toàn quốc)*

---

```
+------------------------------------------------------------------------------------------------------------------+
|  CUỘC THI NGHIÊN CỨU KHOA HỌC & SÁNG TẠO CÔNG NGHỆ SỐ                                                             |
|                                                                                                                  |
|  ĐỀ TÀI: HỆ SINH THÁI TRỢ LÝ HỌC TẬP THÔNG MINH ĐA PHƯƠNG THỨC (MULTIMODAL AI STUDY ECOSYSTEM)                    |
|  DỰA TRÊN RAG THÍCH ỨNG HỖ TRỢ HỌC TẬP CHỦ ĐỘNG VÀ TỰ ĐỘNG HÓA KHẢO THÍ SƯ PHẠM                                   |
|                                                                                                                  |
|  Lĩnh vực: Khoa học máy tính & Công nghệ Giáo dục (Computer Science / EdTech)                                     |
+------------------------------------------------------------------------------------------------------------------+
```

---

### Ô 1: VẤN ĐỀ NGHIÊN CỨU & NỖI ĐAU THỰC TẾ
- **Bội thực thông tin (Information Overload):** Người học bị quá tải trước các giáo trình, slide bài giảng dài hàng trăm trang.
- **Bẫy học thụ động của AI thông thường:** Việc dùng ChatGPT đọc tóm tắt tạo ra "ảo tưởng hiểu biết" (Illusion of Competence). Sau 2 ngày, hơn 70% kiến thức bị lãng quên nếu không có cơ chế tự gợi nhớ (Active Recall).
- **Giáo viên kiệt sức vì làm đề thi:** Mất từ 3-5 giờ cho mỗi bộ đề trắc nghiệm chuẩn kèm đáp án chi tiết.
- **Giới hạn của Google NotebookLM:** Chỉ hỗ trợ tiếng Anh tốt, giao diện thuần chữ tĩnh, không có Flashcard lặp lại ngắt quãng (SRS), không có công cụ in đề thi cho giáo viên.

---

### Ô 2: GIẢI PHÁP ĐỀ XUẤT: HỆ SINH THÁI ĐA PHƯƠNG THỨC 4 TRONG 1
Nạp **bất kỳ tài liệu nào** (SGK, giáo trình đại học, slide ôn thi, tài liệu chuyên ngành), hệ thống tự động sinh ra:
1. 🎧 **Podcast AI Đối Thoại Tiếng Việt:** 2 MC AI đàm thoại tự nhiên, tiếp thu tri thức thụ động khi di chuyển, giải lao.
2. 🗺️ **Sơ đồ Tư Duy Tri thức 2D:** Nắm trọn khung sườn hàng trăm trang sách trong 2 phút.
3. 🃏 **Bộ Thẻ Nhớ 3D & Anki SRS:** Ứng dụng thuật toán lặp lại ngắt quãng, chuyển trí nhớ ngắn hạn thành dài hạn.
4. 🖨️ **Teacher Exam Suite (Khảo thí 1-Click):** Tự động tạo và in đề trắc nghiệm chuẩn A4 kèm bảng đáp án chi tiết cho giáo viên chấm bài.

---

### Ô 3: KIẾN TRÚC KỸ THUẬT (SYSTEM ARCHITECTURE)
- **Tiền xử lý:** Adaptive Semantic Chunking + Local Dense Embedding (`all-MiniLM-L6-v2`).
- **Chống ảo giác (Anti-Hallucination):** Verifiable Citation Grounding (thẻ trích dẫn dẫn link trực tiếp về văn bản gốc).
- **Lõi suy luận linh hoạt:** Hỗ trợ cả Local SLM ngoại tuyến (Qwen 2.5 3B) lẫn Cloud AI siêu tốc (Groq, Gemini, DeepSeek-R1).
- **Giao diện:** Thiết kế theo chuẩn Animate UI với chuyển động vi chạm (Spring Physics) mượt mà, phản hồi tức thì.

---

### Ô 4: KẾT QUẢ THỰC NGHIỆM ĐỊNH LƯỢNG (A/B TESTING TRÊN 120 NGƯỜI)
*Thực nghiệm đối chứng ngẫu nhiên trên 120 học sinh và sinh viên đa chuyên ngành (Lịch sử, Sinh học, Y Dược):*

- **Điểm số kiểm tra kiến thức:**
  + Nhóm học truyền thống: **$6.52 \pm 1.08$** điểm.
  + Nhóm dùng Trợ lý Đa phương thức: **$8.41 \pm 0.74$** điểm ($+1.89$ điểm, $p < 0.001$, Cohen's $d = 2.05$).
- **Độ bền trí nhớ sau 14 ngày:** Nhóm dùng hệ thống duy trì được **90.6%** kiến thức (so với mức rơi rụng 35.9% của nhóm đối chứng).
- **Tải nhận thức tiêu cực (NASA-TLX):** Giảm **41.8%** mức độ căng thẳng trí não và giảm **65.1%** cảm giác chán nản.
- **Hiệu suất của giáo viên:** Tiết kiệm **98.3% thời gian** biên soạn đề kiểm tra định kỳ (từ 180 phút xuống 3 phút).

---

### Ô 5: GIÁ TRỊ THỰC TIỄN & KHẢ NĂNG NHÂN RỘNG
- **Phổ quát mọi môn học:** Từ Toán, Lý, Hóa đến Y Khoa, Luật, Kinh tế, Ngoại ngữ.
- **Tiết kiệm chi phí:** Không tốn tiền mua tài khoản AI nước ngoài hàng tháng.
- **Bảo mật tuyệt đối:** Có thể chạy Offline 100% cho các cơ quan, trường học, bệnh viện có tài liệu nội bộ nhạy cảm.

---

### Ô 6: KỊCH BẢN THUYẾT TRÌNH BẢO VỆ 2 PHÚT TRƯỚC HỘI ĐỒNG
1. **(30s Đặt vấn đề):** *"Kính thưa Hội đồng, hàng triệu học sinh, sinh viên hiện nay đang 'bơi' trong hàng trăm trang giáo trình mỗi mùa thi, trong khi các thầy cô thì kiệt sức mỗi kỳ soạn đề kiểm tra. Việc dùng ChatGPT chỉ tạo ra lối học thụ động, sau 2 ngày là quên sạch..."*
2. **(45s Giải pháp):** *"Để giải quyết tận gốc vấn đề này, chúng em phát triển Hệ sinh thái Trợ lý Đa phương thức. Chỉ cần kéo thả một file giáo trình bất kỳ, hệ thống sẽ tự động chuyển hóa thành một buổi Podcast đối thoại tiếng Việt, một Sơ đồ tư duy 2D trực quan, một bộ thẻ nhớ 3D lặp lại ngắt quãng và một đề thi in sẵn đáp án..."*
3. **(30s Demo trực tiếp):** *(Bấm nút In đề thi & Phát đoạn Podcast)*: *"Đây là đề thi trắc nghiệm A4 kèm bảng đáp án dành riêng cho thầy cô, và đây là đoạn âm thanh AI đối thoại sinh động được tạo ra chỉ sau vài giây..."*
4. **(15s Kết luận):** *"Thực nghiệm trên 120 người đã chứng minh điểm kiểm tra tăng gần 2 điểm và giữ vững 90% trí nhớ sau 2 tuần. Đây là một giải pháp hoàn toàn thực chiến cho giáo dục Việt Nam!"*
