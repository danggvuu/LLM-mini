import { useNavigate } from 'react-router-dom';
import { BookOpen, ArrowRight, FileText, MessageSquare, Layers, Quote } from 'lucide-react';

function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#F9F9FB] text-gray-900 font-sans selection:bg-blue-200">
      
      {/* Header */}
      <header className="flex items-center justify-between gap-3 px-4 sm:px-8 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          <BookOpen className="text-gray-700" size={24} />
          <span className="font-semibold text-base sm:text-xl tracking-tight text-gray-800">NotebookLM Mini</span>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium text-gray-600">
          <a href="#how-it-works" className="hidden sm:inline hover:text-blue-600">Cách sử dụng</a>
          <button onClick={() => navigate('/dashboard')} className="rounded-xl bg-gray-900 text-white px-4 py-2.5 text-xs sm:text-sm">Mở sổ tay</button>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="flex-1 max-w-6xl w-full mx-auto px-5 sm:px-8 py-14 sm:py-24">
        <section className="grid lg:grid-cols-[1.2fr_1fr] gap-12 lg:gap-16 items-center">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-blue-600 mb-6">Tài liệu của bạn. Cách học của bạn.</p>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.08] mb-6">Đọc sâu hơn.<br /><span className="text-blue-600">Hiểu rõ hơn.</span></h1>
            <p className="text-base sm:text-lg text-gray-600 max-w-xl mb-8 leading-relaxed">Biến những trang tài liệu thành cuộc trò chuyện, ghi chú và bài ôn tập. Bắt đầu bằng nguồn bạn tin cậy, tìm câu trả lời kèm trích dẫn.</p>
            <button onClick={() => navigate('/dashboard')} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 rounded-xl font-semibold inline-flex items-center gap-3 transition shadow-lg shadow-blue-500/15">Bắt đầu với sổ tay <ArrowRight size={18} /></button>
            <p className="mt-4 text-xs text-gray-500">Chọn mô hình trên máy hoặc kết nối nhà cung cấp AI của bạn.</p>
          </div>
          <div className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-7 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.3)]">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-100"><div className="rounded-xl bg-blue-50 p-3"><BookOpen size={22} className="text-blue-600" /></div><div><p className="font-semibold">Một chủ đề, nhiều cách học</p><p className="text-xs text-gray-500 mt-1">Minh họa không gian sổ tay</p></div></div>
            <div className="flex gap-2 mt-5 text-xs text-gray-500"><span className="border border-gray-200 rounded-lg p-2 flex gap-2 items-center"><FileText size={14} /> Tài liệu.pdf</span><span className="border border-gray-200 rounded-lg p-2 flex gap-2 items-center"><FileText size={14} /> Ghi chú.md</span></div>
            <p className="mt-5 ml-8 p-4 rounded-2xl rounded-br-sm bg-gray-100 text-sm">Các ý chính trong tài liệu là gì?</p>
            <div className="mt-4 p-4 rounded-2xl rounded-bl-sm bg-blue-50 border border-blue-100"><Quote size={18} className="text-blue-500 mb-2" /><p className="text-sm text-gray-700 leading-6">Kết nối các ý chính, giải thích bằng ngôn ngữ dễ hiểu và quay lại nguồn để đọc sâu hơn.</p><p className="mt-3 text-[11px] text-blue-600">Trích dẫn đi cùng câu trả lời</p></div>
            <div className="grid grid-cols-3 gap-2 mt-5 text-center text-xs"><span className="rounded-lg bg-gray-50 py-3">Sơ đồ tư duy</span><span className="rounded-lg bg-gray-50 py-3">Thẻ ôn tập</span><span className="rounded-lg bg-gray-50 py-3">Podcast</span></div>
          </div>
        </section>
        <section id="how-it-works" className="pt-20 sm:pt-28 scroll-mt-6">
          <h2 className="text-2xl font-semibold mb-7">Bắt đầu trong ba bước</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { icon: FileText, title: '1. Thêm nguồn', text: 'Tạo sổ tay rồi tải tài liệu, thêm đường dẫn hoặc dán văn bản. Chọn nguồn bạn muốn sử dụng.' },
              { icon: MessageSquare, title: '2. Hỏi để hiểu', text: 'Yêu cầu tóm tắt, giải thích khái niệm hoặc ví dụ. Mở trích dẫn để đối chiếu với nội dung gốc.' },
              { icon: Layers, title: '3. Ôn theo cách bạn thích', text: 'Tạo thẻ học, trắc nghiệm, sơ đồ hoặc podcast. Ghim điều cần nhớ và xuất dữ liệu khi cần.' },
            ].map(step => <article key={step.title} className="border-t border-gray-200 pt-5"><step.icon size={22} className="text-blue-600 mb-4" /><h3 className="font-semibold mb-2">{step.title}</h3><p className="text-sm leading-6 text-gray-500">{step.text}</p></article>)}
          </div>
        </section>
      </main>

      {/* Footer Title */}
      <footer className="py-6 px-5 text-center text-xs text-gray-500 border-t border-gray-200">NotebookLM Mini · Kiểm tra nguồn trích dẫn trước khi sử dụng thông tin do AI tạo.</footer>

    </div>
  );
}

export default Landing;
