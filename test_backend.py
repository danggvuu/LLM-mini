import json
import requests
import sys

def run_chat_stream_smoke():
    url = "http://localhost:8000/api/chat"
    try:
        notebooks_response = requests.get("http://localhost:8000/api/notebooks", timeout=10)
        notebooks_response.raise_for_status()
        notebooks = notebooks_response.json()
        if not notebooks:
            print("❌ Chưa có notebook. Hãy tạo hoặc nạp một notebook trước.")
            return 1

        notebook = notebooks[0]
        payload = {
            "query": "Tóm tắt ngắn gọn tài liệu này.",
            "notebook_id": notebook["id"]
        }
        print(f"🚀 Gửi request tới /api/chat với notebook: {notebook['title']} ({notebook['id']})...")
        with requests.post(url, json=payload, stream=True) as response:
            if response.status_code != 200:
                print(f"❌ API trả về lỗi: {response.status_code}")
                print(response.text)
                return 1

            print("✅ Đã kết nối, đang nhận Stream...")
            saw_saved_event = False
            provider_error = False
            for line in response.iter_lines():
                if line:
                    line_str = line.decode('utf-8')
                    if line_str.startswith("data: "):
                        data_str = line_str[6:]
                        try:
                            data = json.loads(data_str)
                            if data.get("type") == "citations":
                                print("\n📚 Trích dẫn tìm được:")
                                for cit in data.get("citations", []):
                                    print(f" - {cit['marker']} [{cit['filename']}]")
                                print("\n🤖 Trả lời:")
                            elif data.get("type") == "chunk":
                                # In chữ ra không xuống dòng
                                text = data.get("text", "")
                                provider_error = provider_error or text.startswith("⚠️")
                                print(text, end="", flush=True)
                            elif data.get("type") == "saved":
                                saw_saved_event = True
                            elif data.get("type") == "done":
                                print("\n\n✅ Hoàn tất luồng!")
                        except json.JSONDecodeError:
                            pass
            if provider_error or not saw_saved_event:
                print("\n❌ Chat stream kết thúc với lỗi provider hoặc thiếu sự kiện saved.")
                return 1
            return 0
    except requests.exceptions.ConnectionError:
        print("❌ Không thể kết nối tới FastAPI. Hãy chạy lệnh: uvicorn src.api.api:app --reload")
        return 1
    except requests.exceptions.RequestException as exc:
        print(f"❌ Không thể kiểm tra backend: {exc}")
        return 1

if __name__ == "__main__":
    sys.exit(run_chat_stream_smoke())
