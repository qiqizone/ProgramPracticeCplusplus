import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { ProgressBar } from '../components/ProgressBar';
import { CHAPTERS } from '../constants';
import type { ChapterStat } from '../types';

export default function Chapters() {
  const [stats, setStats] = useState<ChapterStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ chapters: ChapterStat[] }>('/chapters')
      .then((data) => setStats(data.chapters))
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败'))
      .finally(() => setLoading(false));
  }, []);

  const total = stats.reduce((sum, item) => sum + item.total, 0);
  const finished = stats.reduce((sum, item) => sum + item.correct + item.done, 0);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">练习进度</h1>
            <p className="mt-1 text-sm text-slate-500">
              已掌握 {finished} / {total} 题
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/practice?mode=random"
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              随机 20 题
            </Link>
            <Link
              to="/wrong-book"
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
            >
              错题本
            </Link>
          </div>
        </div>
        <div className="mt-4">
          <ProgressBar value={finished} max={total} />
        </div>
      </section>

      {loading && <p className="text-sm text-slate-500">加载中…</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {CHAPTERS.map((meta) => {
          const stat = stats.find((item) => item.chapter === meta.id);
          const done = (stat?.correct ?? 0) + (stat?.done ?? 0);
          const totalInChapter = stat?.total ?? 0;

          return (
            <Link
              key={meta.id}
              to={`/chapter/${meta.id}`}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-slate-400">第 {meta.id} 章</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-800 group-hover:text-brand-700">
                    {meta.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">{meta.desc}</p>
                </div>
                {stat && stat.wrong > 0 && (
                  <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-600">
                    {stat.wrong} 道错题
                  </span>
                )}
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>
                    {done} / {totalInChapter}
                  </span>
                  <span>{totalInChapter ? Math.round((done / totalInChapter) * 100) : 0}%</span>
                </div>
                <ProgressBar value={done} max={totalInChapter} />
              </div>

              <p className="mt-3 text-xs font-medium text-brand-600 group-hover:text-brand-700">
                先看知识点，再开始练习 →
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
