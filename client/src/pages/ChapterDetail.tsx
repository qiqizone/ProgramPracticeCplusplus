import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { KnowledgeExerciseCard } from '../components/KnowledgeExercise';
import { Markdown } from '../components/Markdown';
import { ProgressBar } from '../components/ProgressBar';
import { CHAPTERS } from '../constants';
import type { ChapterStat, KnowledgePoint } from '../types';

export default function ChapterDetail() {
  const { id } = useParams();
  const chapterId = Number(id);
  const meta = CHAPTERS.find((item) => item.id === chapterId);

  const [points, setPoints] = useState<KnowledgePoint[]>([]);
  const [stat, setStat] = useState<ChapterStat | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!meta) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    Promise.all([
      api<{ points: KnowledgePoint[] }>(`/knowledge?chapter=${chapterId}`),
      api<{ chapters: ChapterStat[] }>('/chapters'),
    ])
      .then(([knowledge, chapters]) => {
        setPoints(knowledge.points);
        setStat(chapters.chapters.find((item) => item.chapter === chapterId) ?? null);
        setExpanded(new Set(knowledge.points.length ? [knowledge.points[0].id] : []));
      })
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败'))
      .finally(() => setLoading(false));
  }, [chapterId, meta]);

  const allExpanded = useMemo(
    () => points.length > 0 && points.every((point) => expanded.has(point.id)),
    [points, expanded]
  );

  function toggle(id2: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id2)) next.delete(id2);
      else next.add(id2);
      return next;
    });
  }

  if (!meta) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-rose-600">章节不存在</p>
        <Link to="/" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          返回章节列表
        </Link>
      </div>
    );
  }

  const done = (stat?.correct ?? 0) + (stat?.done ?? 0);
  const total = stat?.total ?? 0;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <Link to="/" className="text-xs font-medium text-slate-400 hover:text-brand-600">
          ← 返回章节列表
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-400">第 {meta.id} 章 · 知识点复习</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-800">{meta.title}</h1>
            <p className="mt-1 text-sm text-slate-500">{meta.desc}</p>
          </div>
          <Link
            to={`/practice?mode=chapter&chapter=${meta.id}`}
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            开始本章练习
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
          <span>{points.length} 个知识点</span>
          <span>
            题目进度 {done} / {total}
          </span>
          {stat && stat.wrong > 0 && (
            <span className="text-rose-600">{stat.wrong} 道错题待复习</span>
          )}
        </div>
        <div className="mt-2">
          <ProgressBar value={done} max={total} />
        </div>
      </section>

      {loading && <p className="text-sm text-slate-500">加载中…</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      {!loading && !error && points.length === 0 && (
        <p className="text-sm text-slate-500">本章暂无知识点，可直接开始练习。</p>
      )}

      {points.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-600">先过一遍知识点，再做题更高效</p>
            <button
              type="button"
              onClick={() =>
                setExpanded(allExpanded ? new Set() : new Set(points.map((point) => point.id)))
              }
              className="text-xs font-medium text-brand-600 transition hover:text-brand-700"
            >
              {allExpanded ? '全部收起' : '展开全部'}
            </button>
          </div>

          {points.map((point, index) => {
            const open = expanded.has(point.id);
            return (
              <article
                key={point.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => toggle(point.id)}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-slate-50"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                    {index + 1}
                  </span>
                  <span className="flex-1 text-sm font-medium text-slate-800">{point.title}</span>
                  {point.exercises.length > 0 && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      {point.exercises.length} 道练习
                    </span>
                  )}
                  <span className="text-xs text-slate-400">{open ? '收起' : '展开'}</span>
                </button>

                {open && (
                  <div className="border-t border-slate-100 px-5 py-4">
                    <Markdown>{point.summary}</Markdown>

                    {point.reference_url && (
                      <a
                        href={point.reference_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-brand-700 transition hover:border-brand-300 hover:bg-brand-50"
                      >
                        cppreference 官方条目 ↗
                      </a>
                    )}

                    {point.exercises.length > 0 && (
                      <div className="mt-5">
                        <p className="text-xs font-semibold text-slate-500">
                          随堂练习 · {point.exercises.length} 题
                        </p>
                        <div className="mt-2 space-y-3">
                          {point.exercises.map((exercise, i) => (
                            <KnowledgeExerciseCard
                              key={exercise.id}
                              exercise={exercise}
                              index={i + 1}
                              onResult={(result) =>
                                setPoints((prev) =>
                                  prev.map((item) =>
                                    item.id === point.id
                                      ? {
                                          ...item,
                                          exercises: item.exercises.map((ex) =>
                                            ex.id === exercise.id
                                              ? {
                                                  ...ex,
                                                  status: result.state.status,
                                                  wrong_count: result.state.wrong_count,
                                                  correct_streak: result.state.correct_streak,
                                                }
                                              : ex
                                          ),
                                        }
                                      : item
                                  )
                                )
                              }
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50/60 p-5 text-center">
        <p className="text-sm text-slate-600">知识点过完了？用题目检验一下掌握程度。</p>
        <Link
          to={`/practice?mode=chapter&chapter=${meta.id}`}
          className="mt-3 inline-block rounded-xl bg-brand-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          开始第 {meta.id} 章练习
        </Link>
      </div>
    </div>
  );
}
