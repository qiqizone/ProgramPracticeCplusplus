import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { Markdown } from '../components/Markdown';
import { ProgressBar } from '../components/ProgressBar';
import { CHAPTERS, DIFFICULTY_LABEL, TYPE_LABEL } from '../constants';
import type { AttemptResult, Question } from '../types';

const MODE_TITLE: Record<string, string> = {
  chapter: '章节练习',
  random: '随机练习',
  wrong: '错题重做',
  starred: '收藏练习',
};

function formatAnswer(answer: string | string[] | null) {
  if (answer === null) return '';
  return Array.isArray(answer) ? answer.join('、') : answer;
}

export default function Practice() {
  const [params] = useSearchParams();
  const mode = params.get('mode') ?? 'chapter';
  const chapter = Number(params.get('chapter') ?? 0);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);
  const [starred, setStarred] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [round, setRound] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = mode === 'chapter' ? `?mode=chapter&chapter=${chapter}` : `?mode=${mode}`;
      const data = await api<{ questions: Question[] }>(`/questions${query}`);
      setQuestions(data.questions);
      setIndex(0);
      setSelected([]);
      setText('');
      setResult(null);
      setFinished(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载题目失败');
    } finally {
      setLoading(false);
    }
  }, [mode, chapter, round]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = questions[index];

  useEffect(() => {
    setSelected([]);
    setText('');
    setResult(null);
    setShowHints(false);
    setStarred(current?.starred ?? false);
  }, [current?.id]);

  function toggleOption(id: string) {
    if (result || !current) return;
    if (current.type === 'single') {
      setSelected([id]);
    } else {
      setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    }
  }

  async function submit() {
    if (!current || submitting || result) return;

    if (current.type === 'code') {
      const body = { questionId: current.id, completed: true };
      await send(body);
      return;
    }

    let answer: string | string[];
    if (current.type === 'output') {
      if (!text.trim()) return;
      answer = text;
    } else {
      if (selected.length === 0) return;
      answer = current.type === 'single' ? selected[0] : selected;
    }

    await send({ questionId: current.id, answer });
  }

  async function send(body: Record<string, unknown>) {
    setSubmitting(true);
    try {
      const data = await api<AttemptResult>('/attempts', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleStar() {
    if (!current) return;
    try {
      const data = await api<{ starred: boolean }>(`/questions/${current.id}/star`, {
        method: 'POST',
      });
      setStarred(data.starred);
    } catch {
      // 收藏失败不打断答题流程
    }
  }

  function next() {
    if (index + 1 >= questions.length) {
      setFinished(true);
    } else {
      setIndex(index + 1);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">加载题目中…</p>;
  }

  if (error && questions.length === 0) {
    return <p className="text-sm text-rose-600">{error}</p>;
  }

  if (questions.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <p className="text-slate-600">
          {mode === 'wrong' ? '错题本是空的，先去练习吧' : '这里还没有题目'}
        </p>
        <Link to="/" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">
          返回章节列表
        </Link>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <h2 className="text-xl font-semibold text-slate-800">本轮完成</h2>
        <p className="mt-2 text-sm text-slate-500">本轮共 {questions.length} 题</p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => setRound((value) => value + 1)}
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            再来一轮
          </button>
          <Link
            to="/"
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:border-brand-300"
          >
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const correctSet = new Set(
    Array.isArray(result?.answer) ? result.answer : result?.answer ? [result.answer] : []
  );
  const chapterTitle = CHAPTERS.find((item) => item.id === current.chapter)?.title ?? '';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-slate-500">
        <div className="flex items-center gap-2">
          <Link to="/" className="hover:text-brand-600">
            {MODE_TITLE[mode] ?? '练习'}
          </Link>
          {mode === 'chapter' && (
            <>
              <span className="text-slate-300">/</span>
              <span>第 {current.chapter} 章 {chapterTitle}</span>
            </>
          )}
        </div>
        <span>
          {index + 1} / {questions.length}
        </span>
      </div>
      <ProgressBar value={index + (result ? 1 : 0)} max={questions.length} />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-brand-50 px-2.5 py-1 font-medium text-brand-700">
            {TYPE_LABEL[current.type]}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">
            {DIFFICULTY_LABEL[current.difficulty] ?? current.difficulty}
          </span>
          <span className="text-slate-400">{current.slug}</span>
          <button
            type="button"
            onClick={toggleStar}
            className={`ml-auto rounded-lg border px-2.5 py-1 transition ${
              starred
                ? 'border-amber-300 bg-amber-50 text-amber-700'
                : 'border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-600'
            }`}
          >
            {starred ? '已收藏' : '收藏'}
          </button>
        </div>

        <Markdown>{current.stem}</Markdown>

        {current.type === 'code' ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              请在本地 Visual Studio 中完成这道题，跑通后再回来标记完成。
            </div>

            {current.hints && current.hints.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowHints((value) => !value)}
                  className="text-sm font-medium text-brand-600 hover:underline"
                >
                  {showHints ? '收起提示' : '查看提示'}
                </button>
                {showHints && (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                    {current.hints.map((hint, i) => (
                      <li key={i}>{hint}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {!result && (
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="w-full rounded-xl bg-brand-600 py-3 font-medium text-white transition hover:bg-brand-700 disabled:opacity-60 sm:w-auto sm:px-6"
              >
                {submitting ? '提交中…' : '我已完成，查看参考答案'}
              </button>
            )}
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {current.type === 'output' ? (
              <div>
                <label className="mb-1 block text-sm text-slate-500" htmlFor="output-answer">
                  在下方写出程序的输出
                </label>
                <textarea
                  id="output-answer"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={Boolean(result)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50"
                />
              </div>
            ) : (
              current.options?.map((option) => {
                const chosen = selected.includes(option.id);
                const isCorrectOption = correctSet.has(option.id);

                let className = 'border-slate-200 hover:border-brand-300';
                if (result) {
                  if (isCorrectOption) className = 'border-emerald-500 bg-emerald-50';
                  else if (chosen) className = 'border-rose-400 bg-rose-50';
                  else className = 'border-slate-200 opacity-70';
                } else if (chosen) {
                  className = 'border-brand-500 bg-brand-50';
                }

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleOption(option.id)}
                    disabled={Boolean(result)}
                    className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${className}`}
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-xs font-semibold">
                      {option.id}
                    </span>
                    <span className="text-sm text-slate-700">{option.text}</span>
                  </button>
                );
              })
            )}

            {!result && (
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="w-full rounded-xl bg-brand-600 py-3 font-medium text-white transition hover:bg-brand-700 disabled:opacity-60 sm:w-auto sm:px-8"
              >
                {submitting ? '提交中…' : '提交答案'}
              </button>
            )}
            {current.type === 'multiple' && !result && (
              <p className="text-xs text-slate-400">多选题：可选中多个选项</p>
            )}
          </div>
        )}

        {result && (
          <div
            className={`mt-5 rounded-xl border p-4 ${
              result.isCorrect === false
                ? 'border-rose-200 bg-rose-50'
                : 'border-emerald-200 bg-emerald-50'
            }`}
          >
            <p
              className={`font-semibold ${
                result.isCorrect === false ? 'text-rose-700' : 'text-emerald-700'
              }`}
            >
              {result.isCorrect === null
                ? '已标记完成'
                : result.isCorrect
                  ? '回答正确'
                  : '回答错误'}
            </p>
            {result.isCorrect === false && (
              <p className="mt-1 text-sm text-rose-700">
                正确答案：{formatAnswer(result.answer)}
              </p>
            )}
            <div className="mt-2 text-sm text-slate-700">
              <Markdown>{result.explanation}</Markdown>
            </div>

            {result.referenceSolution && (
              <div className="mt-3">
                <p className="mb-1 font-medium text-slate-700">参考答案</p>
                <Markdown>{result.referenceSolution}</Markdown>
              </div>
            )}
          </div>
        )}
      </section>

      {result && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={next}
            className="rounded-xl bg-slate-800 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-slate-900"
          >
            {index + 1 >= questions.length ? '完成本轮' : '下一题'}
          </button>
        </div>
      )}
    </div>
  );
}
