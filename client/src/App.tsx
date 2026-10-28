import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import Admin from './pages/Admin';
import Chapters from './pages/Chapters';
import ChapterDetail from './pages/ChapterDetail';
import Login from './pages/Login';
import Practice from './pages/Practice';
import Stats from './pages/Stats';
import WrongBook from './pages/WrongBook';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<Chapters />} />
          <Route path="/chapter/:id" element={<ChapterDetail />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/wrong-book" element={<WrongBook />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/admin" element={<Admin />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
