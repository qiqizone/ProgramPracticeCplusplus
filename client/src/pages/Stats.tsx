import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { ProgressBar } from '../components/ProgressBar';
import { CHAPTERS } from '../constants';
import type { StatsData } from '../types';

export default function Stats() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api<StatsData>('/stats')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-slate-500">加载中…</p>;
  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!data) return null;

  const maxDaily = Math.max(1, ...data.daily.map((day) => day.count));
  const cards = [
    { label: '累计答题', value: data.totals.attempts },
    { label: '选择题正确率', value: `${data.totals.accuracy}%` },
    { label: '当前错题', value: data.wrongCount },
    { label: '完成编程题', value: data.totals.codeDone },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-slate-800">学习统计</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-800">{card.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">近 7 天答题量</h2>
        <div className="mt-4 flex h-40 items-end gap-2">
          {data.daily.map((day) => (
            <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-xs text-slate-500">{day.count}</span>
              <div
                className="w-full rounded-t-lg bg-brand-500/80"
                style={{ height: `${Math.max(4, (day.count / maxDaily) * 100)}%` }}
                title={`${day.date}: ${day.count} 题`}
              />
              <span className="text-[10px] text-slate-400">{day.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">各章掌握度</h2>
        <div className="mt-4 space-y-4">
          {data.chapters.map((chapter) => {
            const meta = CHAPTERS.find((item) => item.id === chapter.chapter);
            return (
              <div key={chapter.chapter}>
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <span>
                    第 {chapter.chapter} 章 · {meta?.title ?? ''}
                  </span>
                  <span>
                    {chapter.mastery}%（错题 {chapter.wrong}）
                  </span>
                </div>
                <ProgressBar value={chapter.mastery ?? 0} max={100} />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
