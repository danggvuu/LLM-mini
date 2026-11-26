import { Component, lazy, Suspense } from 'react';
import { Routes, Route, Link, useLocation, useParams } from 'react-router-dom';

const Landing = lazy(() => import('./pages/Landing'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Studio = lazy(() => import('./pages/Studio'));

class AppErrorBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error) { console.error('Application error:', error); }
  render() {
    if (this.state.hasError) return (
      <main className="min-h-dvh bg-[#131314] text-white flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-5" role="alert">
          <h1 className="text-xl font-semibold">Chưa thể hiển thị trang này</h1>
          <p className="text-sm text-slate-400 leading-6">Tải lại trang để thử lại. Nếu lỗi tiếp tục, quay về danh sách sổ tay và kiểm tra cài đặt.</p>
          <div className="flex gap-3 justify-center"><Link to="/dashboard" className="rounded-xl px-4 py-3 border border-white/15">Về sổ tay</Link><button onClick={() => window.location.reload()} className="rounded-xl px-4 py-3 bg-blue-600">Tải lại trang</button></div>
        </div>
      </main>
    );
    return this.props.children;
  }
}

function NotebookRoute() {
  const { id } = useParams();
  return <Studio key={id} />;
}

function App() {
  const { pathname } = useLocation();
  return (
    <AppErrorBoundary key={pathname}>
    <a href="#main-content" className="skip-link">Đến nội dung chính</a>
    <Suspense fallback={<div className="min-h-dvh bg-[#131314] text-slate-300 flex items-center justify-center text-sm" role="status">Đang mở trang...</div>}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/notebook/:id" element={<NotebookRoute />} />
        <Route path="*" element={<main id="main-content" className="min-h-dvh bg-[#131314] text-white flex flex-col items-center justify-center gap-5 p-6 text-center"><h1 className="text-2xl font-bold">Không tìm thấy trang</h1><p className="text-slate-400 text-sm">Đường dẫn có thể đã thay đổi hoặc không còn tồn tại.</p><Link to="/dashboard" className="bg-blue-600 px-5 py-3 rounded-xl">Về danh sách sổ tay</Link></main>} />
      </Routes>
    </Suspense>
    </AppErrorBoundary>
  );
}

export default App;
