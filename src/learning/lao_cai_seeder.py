import os
import json
import logging
from typing import Dict, Any

from src.ingestion.parsers.text_parser import TextParser
from src.ingestion.chunking import AdaptiveChunker

logger = logging.getLogger(__name__)

LAO_CAI_NOTEBOOK_ID = "lao-cai-sample"

LAO_CAI_STUDY_GUIDE = {
    "summary": """### 🏔️ TỔNG QUAN GIÁO DỤC ĐỊA PHƯƠNG & LỊCH SỬ TỈNH LÀO CAI
Tỉnh Lào Cai là vùng đất biên cương địa đầu phía Tây Bắc của Tổ quốc, có vị thế chiến lược đặc biệt quan trọng về quốc phòng - an ninh và giao thương kinh tế trên tuyến hành lang Côn Minh - Hải Phòng.

**4 Trọng tâm cốt lõi:**
1. **Địa lý & Thiên nhiên:** Sở hữu đỉnh Fansipan cao 3.143 m ("Nóc nhà Đông Dương"), dãy Hoàng Liên Sơn hùng vĩ, thung lũng Mường Hoa, ruộng bậc thang Y Tý kỳ vĩ; nơi con sông Hồng chảy vào đất Việt tại Lũng Pô; mỏ quặng Apatit Cam Đường lớn nhất cả nước.
2. **Lịch sử & Đấu tranh cách mạng:** Dấu tích thời tiền sử tại di chỉ hang Soi Nhụ, Cam Đường; Di tích lịch sử Đền Bảo Hà thờ danh tướng Hoàng Bảy thế kỷ 18; Khởi nghĩa Giáp Dần 1914 do đồng bào Mông, Dao đứng lên chống Pháp; Chiến thắng Phố Ràng 1949 và Ngày Giải phóng Lào Cai 01/11/1950.
3. **Bản sắc văn hóa 25 dân tộc anh em:** Cây khèn và Lễ hội Gầu Tào của người H'Mông; Nghi lễ Cấp Sắc và bài thuốc tắm lá của người Dao đỏ; Điệu Then đàn Tính và Lễ hội Lồng Tồng của người Tày; Chợ phiên rực rỡ sắc màu thổ cẩm tại Bắc Hà, Mường Khương; Ẩm thực Thắng cố, thắng dền, rượu ngô Bản Phố.
4. **Kinh tế - Xã hội hiện đại:** Khu kinh tế cửa khẩu quốc tế Lào Cai kết nối ASEAN với Tây Nam Trung Quốc; Khu du lịch quốc gia Sa Pa xanh và bền vững; Mô hình trường học đa văn hóa gắn với bảo tồn di sản tại các trường PTDTBT.""",

    "faq": """### ❓ CÂU HỎI THƯỜNG GẶP (FAQ) VỀ LÀO CAI

**Q1: Đỉnh Fansipan có độ cao bao nhiêu và thuộc dãy núi nào?**
A: Đỉnh Fansipan cao 3.143 m, thuộc dãy Hoàng Liên Sơn, được mệnh danh là "Nóc nhà Đông Dương".

**Q2: Nơi nào là điểm đầu tiên con sông Hồng chảy vào lãnh thổ Việt Nam?**
A: Tại ngã ba Lũng Pô, thuộc xã A Mú Sung, huyện Bát Xát, tỉnh Lào Cai.

**Q3: Di tích Đền Bảo Hà (Bảo Yên) thờ vị danh tướng nào trong lịch sử?**
A: Thờ danh tướng Hoàng Bảy (ông Bảy Bảo Hà) - vị tướng triều Lê có công bảo vệ vùng biên ải thế kỷ 18.

**Q4: Nghi lễ Cấp Sắc của người Dao mang ý nghĩa giáo dục gì?**
A: Là nghi lễ công nhận sự trưởng thành của người đàn ông Dao, răn dạy con người sống nhân ái, trung thực, hiếu thảo và bảo vệ rừng nguồn nước.""",

    "glossary": """### 📖 TỪ ĐIỂN THUẬT NGỮ & KHÁI NIỆM ĐỊA PHƯƠNG

- **Fansipan (Phan Xi Păng):** Đỉnh núi cao nhất Đông Dương (3.143 m), nằm trên ranh giới giữa tỉnh Lào Cai và Lai Châu.
- **Khèn Mông:** Nhạc cụ truyền thống bằng ống trúc và bầu gỗ, linh hồn trong các dịp lễ tết và đời sống tinh thần của đồng bào H'Mông.
- **Lễ Cấp Sắc:** Nghi lễ truyền thống quan trọng nhất khẳng định một người đàn ông Dao đã trưởng thành và gánh vác trách nhiệm dòng tộc.
- **Lễ hội Gầu Tào:** Lễ hội mùa xuân lớn nhất của người H'Mông nhằm tạ ơn trời đất, cầu con cháu, cầu mùa màng bội thu.
- **Lễ hội Lồng Tồng:** Lễ hội xuống đồng vào đầu năm mới của người Tày, cầu mong mưa thuận gió hòa, mùa màng tươi tốt.
- **Apatit Cam Đường:** Mỏ khoáng sản photphat lớn nhất Việt Nam dùng sản xuất phân bón nông nghiệp, trữ lượng gần 2 tỷ tấn.
- **Thắng cố:** Món ăn truyền thống từ thịt và nội tạng ngựa kết hợp hạt thảo quả, mắc khén của đồng bào vùng cao Bắc Hà, Mường Khương.""",

    "quiz": [
        {
            "question": "Đỉnh núi Fansipan được mệnh danh là 'Nóc nhà Đông Dương' có độ cao chính xác là bao nhiêu?",
            "options": ["3.143 mét", "2.814 mét", "3.045 mét", "3.200 mét"],
            "answer": 0
        },
        {
            "question": "Con sông Hồng bắt đầu chảy vào lãnh thổ Việt Nam tại địa danh nào thuộc tỉnh Lào Cai?",
            "options": ["Ngã ba Lũng Pô (Bát Xát)", "Thung lũng Mường Hoa (Sa Pa)", "Cửa khẩu Kim Thành", "Thị trấn Bát Xát"],
            "answer": 0
        },
        {
            "question": "Di tích lịch sử Đền Bảo Hà (huyện Bảo Yên, Lào Cai) gắn liền với tên tuổi của vị danh tướng nào?",
            "options": ["Danh tướng Hoàng Bảy", "Tướng quân Trần Hưng Đạo", "Tướng quân Lê Hoàn", "Tướng quân Lý Thường Kiệt"],
            "answer": 0
        },
        {
            "question": "Ngày giải phóng tỉnh Lào Cai trong cuộc kháng chiến chống thực dân Pháp là ngày nào?",
            "options": ["01/11/1950", "19/05/1949", "02/09/1945", "07/05/1954"],
            "answer": 0
        },
        {
            "question": "Nghi lễ văn hóa truyền thống nào đánh dấu sự trưởng thành của người đàn ông dân tộc Dao đỏ?",
            "options": ["Lễ Cấp Sắc", "Lễ Gầu Tào", "Lễ Lồng Tồng", "Lễ Nhảy lửa"],
            "answer": 0
        },
        {
            "question": "Nhạc cụ nào được xem là linh hồn trong đời sống tinh thần và tình cảm của chàng trai H'Mông?",
            "options": ["Cây Khèn Mông", "Đàn Tính", "Cồng chiêng", "Đàn Đáy"],
            "answer": 0
        },
        {
            "question": "Chợ phiên nào ở Lào Cai nổi tiếng là chợ phiên quy mô lớn nhất vùng cao Tây Bắc?",
            "options": ["Chợ phiên Bắc Hà", "Chợ Bến Thành", "Chợ Đồng Xuân", "Chợ nổi Cái Răng"],
            "answer": 0
        },
        {
            "question": "Mỏ khoáng sản nào có quy mô và trữ lượng đứng đầu cả nước tại Lào Cai?",
            "options": ["Quặng Apatit Cam Đường", "Quặng Bauxit", "Than đá Quảng Ninh", "Dầu khí thềm lục địa"],
            "answer": 0
        },
        {
            "question": "Lễ hội mùa xuân truyền thống cầu mùa và cầu con của đồng bào H'Mông có tên gọi là gì?",
            "options": ["Lễ hội Gầu Tào", "Lễ hội Cầu Ngư", "Lễ hội Chọi Trâu", "Lễ hội Hoa Ban"],
            "answer": 0
        },
        {
            "question": "Hành lang kinh tế quốc tế quan trọng kết nối Lào Cai với vùng kinh tế trọng điểm phía Bắc là gì?",
            "options": ["Côn Minh - Lào Cai - Hà Nội - Hải Phòng", "Vân Nam - Đà Nẵng - Cần Thơ", "Quảng Tây - Lạng Sơn - TP.HCM", "Lào Cai - Vinh - Vũng Tàu"],
            "answer": 0
        }
    ],

    "flashcards": [
        {
            "front": "Fansipan",
            "back": "Đỉnh núi cao 3.143m trên dãy Hoàng Liên Sơn, được mệnh danh là 'Nóc nhà Đông Dương'."
        },
        {
            "front": "Lũng Pô (A Mú Sung, Bát Xát)",
            "back": "Nơi con sông Hồng chính thức chảy vào lãnh thổ Việt Nam từ tỉnh Vân Nam (Trung Quốc)."
        },
        {
            "front": "Đền Bảo Hà (Bảo Yên)",
            "back": "Di tích lịch sử - văn hóa quốc gia thờ danh tướng Hoàng Bảy đánh tan giặc phương Bắc thế kỷ 18."
        },
        {
            "front": "Lễ Cấp Sắc",
            "back": "Nghi lễ trưởng thành thiêng liêng nhất của người đàn ông Dao đỏ, răn dạy đạo đức và sống có trách nhiệm."
        },
        {
            "front": "Khèn Mông",
            "back": "Nhạc cụ truyền thống bằng ống trúc, bầu gỗ biểu trưng cho khí phách và tâm hồn người H'Mông."
        },
        {
            "front": "Lễ hội Gầu Tào",
            "back": "Lễ hội mùa xuân lớn nhất của người Mông để tạ ơn thần linh, cầu phúc, cầu con và may mắn."
        },
        {
            "front": "Khởi nghĩa Giáp Dần (1914)",
            "back": "Cuộc khởi nghĩa yêu nước lớn của đồng bào Mông, Dao do Giàng Hưng Tần và Vàng Tả Chải lãnh đạo chống Pháp."
        },
        {
            "front": "01/11/1950",
            "back": "Ngày giải phóng tỉnh Lào Cai trong Chiến dịch Biên giới Thu - Đông 1950."
        },
        {
            "front": "Mỏ Apatit Cam Đường",
            "back": "Mỏ khoáng sản Apatit lớn nhất Việt Nam với trữ lượng gần 2 tỷ tấn, cung cấp nguyên liệu sản xuất phân bón."
        },
        {
            "front": "Chợ phiên Bắc Hà",
            "back": "Không gian sinh hoạt văn hóa và giao thương đặc sắc của các dân tộc Mông, Tày, Dao, Nùng vào Chủ nhật."
        }
    ],

    "mindmap": {
        "id": "root",
        "name": "Giáo Dục Địa Phương Tỉnh Lào Cai",
        "desc": "Bức tranh toàn cảnh về Thiên nhiên, Lịch sử, Văn hóa và Kinh tế tỉnh Lào Cai",
        "children": [
            {
                "id": "c1",
                "name": "1. Địa Lý & Tài Nguyên",
                "desc": "Đặc điểm tự nhiên, núi non hiểm trở và khoáng sản phong phú",
                "children": [
                    {"id": "c1_1", "name": "Đỉnh Fansipan (3.143m)", "desc": "Nóc nhà Đông Dương, cảnh quan hùng vĩ"},
                    {"id": "c1_2", "name": "Ngã ba Lũng Pô", "desc": "Nơi con sông Hồng chảy vào đất Việt"},
                    {"id": "c1_3", "name": "Khí hậu á nhiệt đới Sa Pa", "desc": "Mùa đông có tuyết rơi, sương mù"},
                    {"id": "c1_4", "name": "Quặng Apatit Cam Đường", "desc": "Trữ lượng gần 2 tỷ tấn, lớn nhất nước"}
                ]
            },
            {
                "id": "c2",
                "name": "2. Lịch Sử & Đấu Tranh",
                "desc": "Truyền thống chống giặc ngoại xâm bảo vệ biên cương",
                "children": [
                    {"id": "c2_1", "name": "Di chỉ hang Soi Nhụ", "desc": "Dấu tích con người thời tiền sử tại Lào Cai"},
                    {"id": "c2_2", "name": "Đền Bảo Hà (Thế kỷ 18)", "desc": "Danh tướng Hoàng Bảy bảo vệ biên ải"},
                    {"id": "c2_3", "name": "Khởi nghĩa Giáp Dần (1914)", "desc": "Đồng bào Mông - Dao quật khởi chống Pháp"},
                    {"id": "c2_4", "name": "Giải phóng Lào Cai (01/11/1950)", "desc": "Mốc son lịch sử trong Chiến dịch Biên giới"}
                ]
            },
            {
                "id": "c3",
                "name": "3. Văn Hóa 25 Dân Tộc",
                "desc": "Bản sắc văn hóa rực rỡ và tinh thần đại đoàn kết",
                "children": [
                    {"id": "c3_1", "name": "Dân tộc H'Mông", "desc": "Cây khèn Mông, Lễ hội Gầu Tào, thổ cẩm"},
                    {"id": "c3_2", "name": "Dân tộc Dao đỏ", "desc": "Nghi lễ Cấp Sắc, bài thuốc tắm lá cổ truyền"},
                    {"id": "c3_3", "name": "Dân tộc Tày & Giáy", "desc": "Hát Then đàn Tính, Lễ hội Lồng Tồng"},
                    {"id": "c3_4", "name": "Chợ phiên & Ẩm thực", "desc": "Chợ Bắc Hà, Thắng cố ngựa, rượu Bản Phố"}
                ]
            },
            {
                "id": "c4",
                "name": "4. Kinh Tế & Giáo Dục",
                "desc": "Phát triển bền vững gắn với chuyển đổi số",
                "children": [
                    {"id": "c4_1", "name": "Khu Kinh Tế Cửa Khẩu", "desc": "Cầu nối thương mại quốc tế Việt - Trung"},
                    {"id": "c4_2", "name": "Du Lịch Sinh Thái Sa Pa", "desc": "Phát triển du lịch xanh, homestay bản địa"},
                    {"id": "c4_3", "name": "Mô hình Trường PTDTBT", "desc": "Ứng dụng AI Offline, bảo tồn di sản đa văn hóa"}
                ]
            }
        ]
    },

    "timeline_outline": {
        "timeline": [
            {
                "period": "Thời Tiền Sử",
                "title": "Dấu tích người tiền sử tại Soi Nhụ & Cam Đường",
                "description": "Các nhà khảo cổ học phát hiện di chỉ đồ đá cũ và đồ đá mới chứng minh con người đã định cư lâu đời tại Lào Cai.",
                "tag": "Khảo cổ"
            },
            {
                "period": "Thế kỷ 18 (Thời Hậu Lê)",
                "title": "Danh tướng Hoàng Bảy đánh tan giặc phương Bắc",
                "description": "Chiêu mộ binh lính các dân tộc Tày, Nùng, Dao giải phóng vùng đất Bảo Hà, lập phòng tuyến giữ vững biên cương.",
                "tag": "Lịch sử"
            },
            {
                "period": "Năm 1914",
                "title": "Khởi nghĩa Giáp Dần của đồng bào Mông, Dao",
                "description": "Lãnh đạo bởi Giàng Hưng Tần và Vàng Tả Chải đánh vào đồn Pháp tại Chợ Chậu, Đồng Tuyển thể hiện tinh thần yêu nước quật cường.",
                "tag": "Khởi nghĩa"
            },
            {
                "period": "Tháng 6/1949",
                "title": "Trận công đồn Phố Ràng oanh liệt",
                "description": "Bộ đội chủ lực phối hợp dân quân địa phương tiêu diệt đồn Phố Ràng, tạo đà giải phóng hành lang biên giới Tây Bắc.",
                "tag": "Kháng chiến"
            },
            {
                "period": "01/11/1950",
                "title": "Toàn tỉnh Lào Cai hoàn toàn giải phóng",
                "description": "Chiến dịch Biên giới Thu - Đông 1950 thắng lợi, lá cờ đỏ sao vàng tung bay trên thị xã Lào Cai, mở toang cửa khẩu quốc tế.",
                "tag": "Mốc son"
            }
        ],
        "outline": [
            {
                "id": "1",
                "title": "I. Địa lý tự nhiên và tiềm năng tỉnh Lào Cai",
                "summary": "Vị thế chiến lược, địa hình núi cao và nguồn khoáng sản vô giá.",
                "subsections": [
                    {"id": "1.1", "title": "1. Nóc nhà Đông Dương Fansipan và dãy Hoàng Liên Sơn", "points": ["Độ cao 3.143m", "Vườn quốc gia Hoàng Liên - Vườn di sản ASEAN"]},
                    {"id": "1.2", "title": "2. Cột mốc Lũng Pô và mạng lưới sông Hồng - sông Chảy", "points": ["Điểm xuất phát sông Hồng vào Việt Nam", "Phân hóa khí hậu ôn đới"]},
                    {"id": "1.3", "title": "3. Nguồn tài nguyên quặng Apatit Cam Đường", "points": ["Trữ lượng 2 tỷ tấn", "Nền tảng công nghiệp hóa chất phân bón"]}
                ]
            },
            {
                "id": "2",
                "title": "II. Lịch sử hào hùng bảo vệ biên ải",
                "summary": "Các phong trào chống ngoại xâm từ thời phong kiến đến giải phóng tỉnh năm 1950.",
                "subsections": [
                    {"id": "2.1", "title": "1. Tướng quân Hoàng Bảy và di tích Đền Bảo Hà", "points": ["Công tích giữ yên bờ cõi", "Di sản văn hóa tâm linh"]},
                    {"id": "2.2", "title": "2. Các phong trào yêu nước chống thực dân Pháp", "points": ["Khởi nghĩa Giáp Dần 1914", "Trận Phố Ràng 1949", "Mốc son 01/11/1950"]}
                ]
            },
            {
                "id": "3",
                "title": "III. Bản sắc văn hóa 25 dân tộc anh em",
                "summary": "Kho tàng phong tục, lễ hội, nhạc cụ và tri thức dân gian độc đáo.",
                "subsections": [
                    {"id": "3.1", "title": "1. Người H'Mông và người Dao đỏ", "points": ["Khèn Mông, Lễ Gầu Tào", "Lễ Cấp Sắc, bài thuốc tắm thảo dược"]},
                    {"id": "3.2", "title": "2. Không gian sinh hoạt chợ phiên vùng cao", "points": ["Chợ phiên Bắc Hà", "Thắng cố, xôi bảy màu, rượu Bản Phố"]}
                ]
            }
        ]
    }
}


def seed_lao_cai_preset(session_manager, vector_store, embedder) -> str:
    """Khởi tạo hoặc cập nhật trọn gói Sổ tay mẫu Giáo dục Địa phương Lào Cai."""
    root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    doc_path = os.path.join(root_dir, "data", "lao_cai_curriculum", "Giao_Duc_Dia_Phuong_Lao_Cai_Chuan.md")
    
    if not os.path.exists(doc_path):
        logger.error(f"Không tìm thấy file tài liệu tại {doc_path}")
        raise FileNotFoundError(f"Missing curriculum file: {doc_path}")

    with open(doc_path, "r", encoding="utf-8") as f:
        doc_text = f.read()

    nb_id = LAO_CAI_NOTEBOOK_ID
    existing = session_manager.get_notebook(nb_id)

    # 1. Tạo hoặc cập nhật Notebook
    if not existing:
        session_manager.create_notebook(
            notebook_id=nb_id,
            title="Giáo Dục Địa Phương & Lịch Sử Tỉnh Lào Cai (Mẫu NCKH)",
            is_private=True,
            provider="ollama",
            model_name="qwen2.5:3b",
            base_url="http://127.0.0.1:11434"
        )
        logger.info(f"Đã tạo Notebook mẫu: {nb_id}")

    # 2. Parse & Index Vector Store
    parser = TextParser()
    doc_filename = "Giao_Duc_Dia_Phuong_Lao_Cai_Chuan.md"
    tree = parser.parse(doc_text, source_metadata={"filename": doc_filename, "notebook_id": nb_id})
    
    chunker = AdaptiveChunker(embedder=embedder)
    chunks = chunker.process_document(tree)

    for chunk in chunks:
        chunk["metadata"]["notebook_id"] = nb_id
        chunk["metadata"]["filename"] = doc_filename

    if vector_store:
        vector_store.index_chunks(chunks)
        logger.info(f"Đã vector hóa {len(chunks)} chunks cho Notebook Lào Cai.")

    # 3. Đăng ký tài liệu vào SessionManager
    session_manager.add_document(nb_id, doc_filename)

    # 4. Lưu Study Guide (Quiz, Flashcards, Mindmap, Timeline)
    session_manager.save_study_guide(
        notebook_id=nb_id,
        summary=LAO_CAI_STUDY_GUIDE["summary"],
        faq=LAO_CAI_STUDY_GUIDE["faq"],
        glossary=LAO_CAI_STUDY_GUIDE["glossary"],
        quiz=LAO_CAI_STUDY_GUIDE["quiz"],
        flashcards=LAO_CAI_STUDY_GUIDE["flashcards"],
        mindmap=LAO_CAI_STUDY_GUIDE["mindmap"],
        timeline_outline=LAO_CAI_STUDY_GUIDE["timeline_outline"]
    )

    # 5. Khởi tạo một số câu hỏi mẫu chào đón người dùng
    history = session_manager.get_chat_history(nb_id)
    if not history:
        session_manager.save_message(
            nb_id, 
            "user", 
            "Hãy tóm tắt cho tôi về vị trí địa lý của đỉnh Fansipan và mốc Lũng Pô tại Lào Cai?"
        )
        session_manager.save_message(
            nb_id, 
            "assistant", 
            "Chào bạn! Dựa theo tài liệu **Giáo dục Địa phương tỉnh Lào Cai**:\n\n1. **Đỉnh Fansipan:** Có độ cao chính xác là **3.143 m**, thuộc dãy Hoàng Liên Sơn, được mệnh danh là *'Nóc nhà Đông Dương'*. Nơi đây thuộc Vườn Quốc gia Hoàng Liên - Vườn di sản ASEAN với hơn 2.000 loài thực vật quý hiếm.\n\n2. **Ngã ba Lũng Pô:** Thuộc xã A Mú Sung, huyện Bát Xát, tỉnh Lào Cai. Đây là địa danh lịch sử thiêng liêng - **nơi con sông Hồng bắt đầu chảy vào lãnh thổ Việt Nam** từ tỉnh Vân Nam (Trung Quốc).\n\nBạn có thể nhấp vào thanh **Studio Học Tập** bên phải để xem ngay **Sơ đồ tư duy 2D**, làm **bài thi trắc nghiệm 10 câu** hoặc nghe **Podcast AI** về các chuyên đề này nhé!",
            citations=[{"marker": "[1]", "filename": doc_filename, "snippet": "Dãy Hoàng Liên Sơn ở phía Tây, nơi có đỉnh Fansipan cao 3.143 m..."}]
        )

    logger.info("Hoàn tất nạp Sổ tay Giáo dục Địa phương Lào Cai!")
    return nb_id
