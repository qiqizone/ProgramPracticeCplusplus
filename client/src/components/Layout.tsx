import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';

const navItems = [
  { to: '/', label: '章节', end: true },
  { to: '/wrong-book', label: '错题本' },
  { to: '/stats', label: '统计' },
];

function navClass({ isActive }: { isActive: boolean }) {
  return [
    'whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition',
    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100',
  ].join(' ');
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link to="/" className="text-lg font-bold tracking-tight text-brand-600">
            C++ 闯关
          </Link>

          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
                {item.label}
              </NavLink>
            ))}
            {user?.role === 'admin' && (
              <NavLink to="/admin" className={navClass}>
                题目管理
              </NavLink>
            )}
          </nav>

          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-slate-500 sm:inline">{user?.username}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg px-3 py-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              退出
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 pb-16">
        <Outlet />
      </main>
    </div>
  );
}
