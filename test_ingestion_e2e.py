import os
import json
import sys

# Ép console xuất UTF-8 để không bị lỗi ký tự Emoji trên Windows
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

# Setup đường dẫn dự án
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.ingestion.parsers.web_parser import WebParser
from src.ingestion.markdown_renderer import MarkdownRenderer
from src.ingestion.chunking import AdaptiveChunker
from src.ingestion.embedding import LocalEmbedder
from src.ingestion.indexing import VectorStoreManager

def main():
    print("=" * 60)
    print("🚀 BẮT ĐẦU TEST E2E LUỒNG INGESTION PIPELINE")
    print("=" * 60)

    # 1. Thu thập dữ liệu (Parser)
    url_to_test = "https://vi.wikipedia.org/wiki/Tr%C3%AD_tu%E1%BB%87_nh%C3%A2n_t%E1%BA%A1o"
    print(f"\n[1/5] Đang thu thập dữ liệu từ URL: {url_to_test}...")
    web_parser = WebParser()
    try:
        document_tree = web_parser.parse(url_to_test)
        print(f"✅ Thu thập thành công! Title: {document_tree.metadata.get('title')}")
    except Exception as e:
        print(f"❌ Lỗi Parser: {e}")
        return

    # 2. Kết xuất Markdown (Optional, để kiểm chứng)
    print("\n[2/5] Đang render Document Tree sang Markdown...")
    renderer = MarkdownRenderer()
    md_content = renderer.render(document_tree)
    print(f"✅ Render thành công! Tổng độ dài: {len(md_content)} ký tự.")
    print("Trích xuất một đoạn ngắn:")
    print(f"   {md_content[500:800]}...\n")

    # 3. Khởi tạo LocalEmbedder
    print("[3/5] Khởi tạo Embedding Model (BAAI/bge-m3)...")
    embedder = LocalEmbedder()

    # 4. Chunking với AdaptiveChunker
    print("\n[4/5] Bắt đầu Adaptive Chunking...")
    chunker = AdaptiveChunker(embedder=embedder)
    chunks = chunker.process_document(document_tree)
    print(f"✅ Đã băm nhỏ thành {len(chunks)} chunks.")
    if chunks:
        print("Mẫu chunk đầu tiên:")
        print(f" - Nội dung: {chunks[0]['content'][:100]}...")
        print(f" - Metadata: {chunks[0]['metadata']}")

    # 5. Indexing vào Qdrant
    print("\n[5/5] Lưu trữ vào Vector Database (Qdrant)...")
    qdrant_manager = VectorStoreManager(embedder=embedder)
    qdrant_manager.index_chunks(chunks)

    # 6. Test Retrieval
    query = "Học máy (Machine Learning) là gì?"
    print(f"\n🔍 Đang test tìm kiếm (Retrieval) với câu hỏi: '{query}'")
    results = qdrant_manager.search(query, limit=3)
    
    print("✅ Kết quả tìm kiếm hàng đầu:")
    for i, res in enumerate(results):
        print(f"   Top {i+1} (Score: {res['score']:.4f}):")
        print(f"   Content: {res['content'][:150]}...\n")

    print("=" * 60)
    print("🎉 KỊCH BẢN TEST E2E THÀNH CÔNG HOÀN HẢO!")
    print("=" * 60)

if __name__ == "__main__":
    main()
