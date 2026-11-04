# NỘI DUNG POSTER THUYẾT TRÌNH CUỘC THI KHKT DÀNH CHO HỌC SINH / SINH VIÊN
*(Khổ in chuẩn: 1.2m x 0.8m hoặc 3 bảng dọc A0 phục vụ gian hàng triển lãm ViSEF)*

---

```
+-------------------------------------------------------------------------------------------------------+
|  SỞ GIÁO DỤC VÀ ĐÀO TẠO TỈNH LÀO CAI - CUỘC THI KHOA HỌC KỸ THUẬT CẤP TỈNH                            |
|                                                                                                       |
|  ĐỀ TÀI: TRỢ LÝ HỌC TẬP ĐA PHƯƠNG THỨC NGOẠI TUYẾN (OFFLINE MULTIMODAL AI)                          |
|  HỖ TRỢ TỰ HỌC VÀ CHUYỂN ĐỔI SỐ CHO HỌC SINH CÁC TRƯỜNG PTDTBT TỈNH LÀO CAI                            |
|                                                                                                       |
|  Lĩnh vực: Hệ thống thông minh & Phần mềm hệ thống (System Software / AI in Education)               |
+-------------------------------------------------------------------------------------------------------+
```

---

### Ô 1: VẤN ĐỀ NGHIÊN CỨU & TÍNH CẤP THIẾT
- **Thực trạng vùng cao Lào Cai:**
  + Mạng Internet chập chờn, nhiều điểm trường bán trú không có kết nối ra ngoài (Air-gapped).
  + Học sinh dân tộc thiểu số gặp rào cản lớn khi tiếp thu các tập tài liệu chữ dày cộp.
  + Môn *Giáo dục địa phương tỉnh Lào Cai* rất thiếu học liệu số sinh động và đề thi tương tác.
- **Hạn chế của AI đám mây (ChatGPT, Google NotebookLM):**
  + Tắt mạng là ngừng hoạt động, tốn chi phí thuê bao, giao diện thuần chữ tĩnh, dễ bị ảo giác kiến thức.

---

### Ô 2: GIẢI PHÁP & TÍNH MỚI CỦA ĐỀ TÀI
- **100% Offline & Bảo mật:** Chạy cục bộ trên máy chủ LAN phòng tin học với mô hình ngôn ngữ nhỏ lượng tử hóa (Quantized SLMs: Qwen 2.5 3B).
- **Hệ sinh thái Đa giác quan:**
  1. **Podcast AI tiếng Việt:** 2 MC đối thoại tự nhiên, tóm tắt bài giảng trong 3-5 phút.
  2. **Mindmap 2D:** Biến hàng chục trang sách thành cây tri thức trực quan tương tác.
  3. **Flashcards 3D & Anki SRS:** Luyện phản xạ và trí nhớ dài hạn bằng thuật toán ngắt quãng.
  4. **Teacher Exam Suite:** Tự động tạo và in đề trắc nghiệm chuẩn Bộ GD&ĐT kèm đáp án chỉ với 1 click.

---

### Ô 3: KIẾN TRÚC HỆ THỐNG (SYSTEM ARCHITECTURE)
- **Tài liệu nguồn:** PDF/TXT/MD Giáo dục địa phương Lào Cai.
- **Xử lý ngữ nghĩa:** Adaptive Semantic Chunking + Local Dense Embedding (`all-MiniLM-L6-v2`).
- **Lưu trữ vector:** Qdrant on-disk vector database (chạy cục bộ không cần internet).
- **Lõi suy luận:** Local LLM Engine kết hợp cơ chế chống ảo giác bằng thẻ trích dẫn chính xác (`[1]`, `[2]`).
- **Giao diện:** React + Animate UI mượt mà trên nền tảng Web LAN.

---

### Ô 4: KẾT QUẢ THỰC NGHIỆM ĐỊNH LƯỢNG (A/B TESTING)
*Thực nghiệm trên 60 học sinh lớp 8-9 tại trường PTDTBT tỉnh Lào Cai trong 2 tuần:*

- **Điểm số kiểm tra kiến thức:**
  + Nhóm học truyền thống: **$6.47 \pm 1.12$** điểm.
  + Nhóm dùng Trợ lý AI: **$8.23 \pm 0.81$** điểm ($+1.76$ điểm, $p < 0.001$, Cohen's $d = 1.78$).
- **Đo lường Tải nhận thức (NASA-TLX):**
  + Tải nhận thức tiêu cực giảm **43.2%** (học sinh không bị căng thẳng, không sợ đọc bài).
  + Mức độ nản chí/thất vọng giảm **57.8%**.

---

### Ô 5: Ý NGHĨA SƯ PHẠM & KHẢ NĂNG NHÂN RỘNG
- **Bình đẳng trong tiếp cận giáo dục số:** Mang công nghệ AI hàng đầu thế giới về với học sinh bản làng vùng cao mà không tốn 1 đồng cước mạng.
- **Tiết kiệm thời gian cho giáo viên:** Giảm **3.5 giờ/tuần** cho công việc soạn đề và làm học liệu.
- **Khả năng triển khai:** Đóng gói 1-Click (`run_mac.command`, `run_windows.bat`), chỉ cần copy vào máy tính của trường là chạy vĩnh viễn.

---

### Ô 6: KỊCH BẢN THUYẾT TRÌNH NHANH 2 PHÚT TRƯỚC BAN GIÁM KHẢO
1. **(30s mở đầu):** *"Kính thưa Ban giám khảo, học sinh vùng cao Lào Cai chúng em khi tự học buổi tối ở trường nội trú bán trú gặp 2 trở ngại lớn: không có mạng Internet để tra cứu và rất ngại đọc những cuốn sách giáo khoa dày cộp nhiều chữ..."*
2. **(45s giải pháp):** *"Để giải quyết tận gốc vấn đề này, chúng em đã phát triển hệ thống Trợ lý học tập đa phương thức hoạt động hoàn toàn Offline. Chỉ với một máy tính thông thường, hệ thống tự động đọc cuốn Giáo dục địa phương Lào Cai và biến nó thành một buổi phát thanh Podcast hai bạn AI trò chuyện bằng tiếng Việt, một Sơ đồ tư duy 2D và bộ thẻ Flashcards 3D..."*
3. **(30s demo thực tế):** *(Bấm nút In đề thi & Bấm phát Podcast AI)*: *"Đây là đề thi trắc nghiệm và audio bài giảng được hệ thống sinh ra ngay tức thì không cần mạng..."*
4. **(15s kết quả):** *"Thực nghiệm trên 60 bạn học sinh đã chứng minh điểm kiểm tra tăng từ 6.47 lên 8.23 điểm và giảm hơn 40% căng thẳng não bộ. Chúng em hy vọng đề tài sẽ được nhân rộng đến tất cả các trường PTDTBT của tỉnh Lào Cai!"*
