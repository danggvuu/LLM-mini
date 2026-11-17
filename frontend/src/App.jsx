import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';

const Landing = lazy(() => import('./pages/Landing'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Studio = lazy(() => import('./pages/Studio'));

function App() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#131314]" aria-busy="true" />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/notebook/:id" element={<Studio />} />
      </Routes>
    </Suspense>
  );
}

export default App;
