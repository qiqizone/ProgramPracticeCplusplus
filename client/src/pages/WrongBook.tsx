import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { CHAPTERS, TYPE_LABEL } from '../constants';
import type { Question } from '../types';

function preview(stem: string) {
  const plain = stem.replace(/```[\s\S]*?```/g, ' [代码] ').replace(/[#*`>|-]/g, ' ').trim();
  return plain.length > 90 ? `${plain.slice(0, 90)}…` : plain;
}

export default function WrongBook() {
  const [items, setItems] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ questions: Question[] }>('/questions?mode=wrong')
      .then((data) => setItems(data.questions))
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">错题本</h1>
          <p className="mt-1 text-sm text-slate-500">
            共 {items.length} 道错题，连续答对 2 次后自动移出
          </p>
        </div>
        {items.length > 0 && (
          <Link
            to="/practice?mode=wrong"
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            开始重做
          </Link>
        )}
      </div>

      {loading && <p className="text-sm text-slate-500">加载中…</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      {!loading && items.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="text-slate-600">还没有错题，继续保持</p>
          <Link to="/" className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline">
            去练习
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">
                第 {item.chapter} 章 ·{' '}
                {CHAPTERS.find((chapter) => chapter.id === item.chapter)?.title ?? ''}
              </span>
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-brand-700">
                {TYPE_LABEL[item.type]}
              </span>
              {item.wrongCount > 0 && (
                <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-600">
                  错 {item.wrongCount} 次
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-slate-700">{preview(item.stem)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
