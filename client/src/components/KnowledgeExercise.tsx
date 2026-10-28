import { useState } from 'react';
import { api } from '../api/client';
import { Markdown } from './Markdown';
import type { KnowledgeExercise, KnowledgeExerciseResult } from '../types';

function renderOptionText(text: string) {
  return text.split('`').map((part, i) =>
    i % 2 === 1 ? (
      <code key={i} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[13px] text-slate-800">
        {part}
      </code>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export function KnowledgeExerciseCard({
  exercise,
  index,
  onResult,
}: {
  exercise: Pick<KnowledgeExercise, 'id' | 'stem' | 'options' | 'status' | 'wrong_count'>;
  index: number;
  onResult?: (result: KnowledgeExerciseResult) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<KnowledgeExerciseResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const status = result?.state?.status ?? exercise.status ?? 'unseen';
  const wrongCount = result?.state?.wrong_count ?? exercise.wrong_count ?? 0;

  async function check() {
    if (!selected || result || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const data = await api<KnowledgeExerciseResult>(
        `/knowledge/exercises/${exercise.id}/check`,
        { method: 'POST', body: JSON.stringify({ answer: selected }) }
      );
      setResult(data);
      onResult?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  function retry() {
    setSelected(null);
    setResult(null);
    setError('');
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
        <span>练习 {index}</span>
        <span>单选题</span>
        {!result && status === 'correct' && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">
            已答对
          </span>
        )}
        {!result && status === 'wrong' && (
          <span className="rounded-full bg-rose-100 px-2 py-0.5 font-medium text-rose-700">
            错题 · 已错 {wrongCount} 次，答对 2 次后移出
          </span>
        )}
      </div>

      <Markdown>{exercise.stem}</Markdown>

      <div className="mt-3 space-y-2">
        {exercise.options.map((option) => {
          const chosen = selected === option.id;
          const isCorrectOption = result?.answer === option.id;

          let className = 'border-slate-200 bg-white hover:border-brand-300';
          if (result) {
            if (isCorrectOption) className = 'border-emerald-500 bg-emerald-50';
            else if (chosen) className = 'border-rose-400 bg-rose-50';
            else className = 'border-slate-200 bg-white opacity-70';
          } else if (chosen) {
            className = 'border-brand-500 bg-brand-50';
          }

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => !result && setSelected(option.id)}
              disabled={Boolean(result)}
              className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition ${className}`}
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-xs font-semibold text-slate-500">
                {option.id}
              </span>
              <span className="text-sm text-slate-700">{renderOptionText(option.text)}</span>
            </button>
          );
        })}
      </div>

      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}

      {!result && (
        <button
          type="button"
          onClick={check}
          disabled={!selected || submitting}
          className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? '判题中…' : '提交'}
        </button>
      )}

      {result && (
        <div
          className={`mt-3 rounded-lg border p-3 text-sm ${
            result.isCorrect
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <p className="font-medium">
            {result.isCorrect ? '回答正确' : `回答错误，正确答案：${result.answer}`}
          </p>
          <div className="mt-1 text-slate-700">
            <Markdown>{result.explanation}</Markdown>
          </div>
          {result.state?.status === 'wrong' && (
            <p className="mt-2 text-xs text-rose-700">
              已加入错题本，连续答对 2 次后自动移出
            </p>
          )}
          {result.state?.status === 'correct' && result.state.wrong_count > 0 && (
            <p className="mt-2 text-xs text-emerald-700">已移出错题本</p>
          )}
        </div>
      )}

      {result?.state?.status === 'wrong' && (
        <button
          type="button"
          onClick={retry}
          className="mt-2 rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
        >
          再答一次
        </button>
      )}
    </div>
  );
}
