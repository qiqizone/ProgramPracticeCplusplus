import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { CHAPTERS, DIFFICULTY_LABEL, TYPE_LABEL } from '../constants';
import type { AdminQuestion, Difficulty, QuestionType } from '../types';

interface FormState {
  id: number | null;
  slug: string;
  chapter: number;
  type: QuestionType;
  difficulty: Difficulty;
  stem: string;
  optionsText: string[];
  answer: string;
  explanation: string;
  hintsText: string;
  referenceSolution: string;
  orderIndex: number;
}

const EMPTY_FORM: FormState = {
  id: null,
  slug: '',
  chapter: 1,
  type: 'single',
  difficulty: 'medium',
  stem: '',
  optionsText: ['', '', '', ''],
  answer: '',
  explanation: '',
  hintsText: '',
  referenceSolution: '',
  orderIndex: 0,
};

const CHOICE_TYPES: QuestionType[] = ['single', 'multiple', 'output'];

function toForm(question: AdminQuestion): FormState {
  let answer = '';
  if (question.type === 'multiple' && Array.isArray(question.answer)) {
    answer = question.answer.join(',');
  } else if (question.type === 'output' && Array.isArray(question.answer)) {
    answer = question.answer.join('|');
  } else if (typeof question.answer === 'string') {
    answer = question.answer === 'SELF' ? '' : question.answer;
  }

  return {
    id: question.id,
    slug: question.slug,
    chapter: question.chapter,
    type: question.type,
    difficulty: question.difficulty,
    stem: question.stem,
    optionsText: question.options?.map((option) => option.text) ?? ['', '', '', ''],
    answer,
    explanation: question.explanation,
    hintsText: (question.hints ?? []).join('\n'),
    referenceSolution: question.referenceSolution ?? '',
    orderIndex: question.orderIndex,
  };
}

function parseAnswer(type: QuestionType, raw: string): string | string[] {
  const value = raw.trim();
  if (type === 'multiple') {
    return value
      .split(/[,，\s]+/)
      .filter(Boolean)
      .map((item) => item.toUpperCase())
      .sort();
  }
  if (type === 'output') {
    return value
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return value.toUpperCase();
}

export default function Admin() {
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editing, setEditing] = useState(false);
  const [importText, setImportText] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const data = await api<{ questions: AdminQuestion[] }>('/admin/questions');
      setQuestions(data.questions);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function startCreate() {
    setForm(EMPTY_FORM);
    setEditing(true);
    setMessage('');
    setError('');
  }

  function startEdit(question: AdminQuestion) {
    setForm(toForm(question));
    setEditing(true);
    setMessage('');
    setError('');
  }

  async function save() {
    setError('');
    setMessage('');

    if (!form.slug.trim() || !form.stem.trim() || !form.explanation.trim()) {
      setError('slug、题干、解析都不能为空');
      return;
    }
    if (CHOICE_TYPES.includes(form.type)) {
      if (form.optionsText.some((text) => !text.trim())) {
        setError('请填写完整的 4 个选项');
        return;
      }
      if (!form.answer.trim()) {
        setError('请填写答案');
        return;
      }
    }

    const payload = {
      slug: form.slug.trim(),
      chapter: form.chapter,
      type: form.type,
      difficulty: form.difficulty,
      stem: form.stem,
      options:
        form.type === 'single' || form.type === 'multiple'
          ? form.optionsText.map((text, index) => ({ id: 'ABCD'[index], text: text.trim() }))
          : null,
      answer: form.type === 'code' ? 'SELF' : parseAnswer(form.type, form.answer),
      explanation: form.explanation,
      hints: form.hintsText.trim()
        ? form.hintsText
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
        : null,
      referenceSolution: form.referenceSolution.trim() ? form.referenceSolution : null,
      orderIndex: Number(form.orderIndex) || 0,
    };

    setBusy(true);
    try {
      if (form.id) {
        await api(`/admin/questions/${form.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await api('/admin/questions', { method: 'POST', body: JSON.stringify(payload) });
      }
      setMessage('保存成功');
      setEditing(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }

  async function remove(question: AdminQuestion) {
    if (!window.confirm(`确定删除题目 ${question.slug} 吗？`)) return;
    try {
      await api(`/admin/questions/${question.id}`, { method: 'DELETE' });
      setQuestions((list) => list.filter((item) => item.id !== question.id));
      setMessage('已删除');
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  }

  async function importJson() {
    setError('');
    setMessage('');
    try {
      const parsed = JSON.parse(importText);
      const result = await api<{ imported: number }>('/admin/questions/import', {
        method: 'POST',
        body: JSON.stringify(parsed),
      });
      setMessage(`导入成功，共 ${result.imported} 题`);
      setImportText('');
      await load();
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError(`JSON 解析失败：${err.message}`);
      } else {
        setError(err instanceof Error ? err.message : '导入失败');
      }
    }
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">题目管理</h1>
          <p className="mt-1 text-sm text-slate-500">当前题库共 {questions.length} 题</p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          新建题目
        </button>
      </div>

      {message && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>
      )}
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">slug</th>
              <th className="px-4 py-3 text-left">章节</th>
              <th className="px-4 py-3 text-left">题型</th>
              <th className="px-4 py-3 text-left">题干</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((question) => (
              <tr key={question.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-mono text-xs text-slate-500">{question.slug}</td>
                <td className="px-4 py-2">第 {question.chapter} 章</td>
                <td className="px-4 py-2">
                  {TYPE_LABEL[question.type]} · {DIFFICULTY_LABEL[question.difficulty]}
                </td>
                <td className="max-w-[280px] truncate px-4 py-2 text-slate-600">
                  {question.stem.replace(/```[\s\S]*?```/g, '[代码]')}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => startEdit(question)}
                    className="text-brand-600 hover:underline"
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(question)}
                    className="ml-3 text-rose-600 hover:underline"
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">
            {form.id ? `编辑题目 #${form.id}` : '新建题目'}
          </h2>

          <div className="grid gap-3 sm:grid-cols-4">
            <label className="text-sm text-slate-600">
              slug
              <input
                value={form.slug}
                onChange={(e) => update('slug', e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                placeholder="ch1-q01"
              />
            </label>
            <label className="text-sm text-slate-600">
              章节
              <select
                value={form.chapter}
                onChange={(e) => update('chapter', Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {CHAPTERS.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    第 {chapter.id} 章 {chapter.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-600">
              题型
              <select
                value={form.type}
                onChange={(e) => update('type', e.target.value as QuestionType)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {Object.entries(TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-600">
              难度
              <select
                value={form.difficulty}
                onChange={(e) => update('difficulty', e.target.value as Difficulty)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {Object.entries(DIFFICULTY_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm text-slate-600">
            题干（支持 Markdown 与 ```cpp 代码块）
            <textarea
              value={form.stem}
              onChange={(e) => update('stem', e.target.value)}
              rows={5}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
            />
          </label>

          {(form.type === 'single' || form.type === 'multiple') && (
            <div className="space-y-2">
              <p className="text-sm text-slate-600">选项</p>
              {form.optionsText.map((text, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="w-6 text-center text-sm font-semibold text-slate-500">
                    {'ABCD'[index]}
                  </span>
                  <input
                    value={text}
                    onChange={(e) => {
                      const next = [...form.optionsText];
                      next[index] = e.target.value;
                      update('optionsText', next);
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>
          )}

          {form.type !== 'code' && (
            <label className="block text-sm text-slate-600">
              答案
              <input
                value={form.answer}
                onChange={(e) => update('answer', e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                placeholder="单选填 B；多选填 A,C；读代码题多个答案用 | 分隔"
              />
            </label>
          )}

          <label className="block text-sm text-slate-600">
            解析
            <textarea
              value={form.explanation}
              onChange={(e) => update('explanation', e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          {form.type === 'code' && (
            <>
              <label className="block text-sm text-slate-600">
                提示（每行一条）
                <textarea
                  value={form.hintsText}
                  onChange={(e) => update('hintsText', e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm text-slate-600">
                参考代码（用 ```cpp 围栏）
                <textarea
                  value={form.referenceSolution}
                  onChange={(e) => update('referenceSolution', e.target.value)}
                  rows={8}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                />
              </label>
            </>
          )}

          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-600">
              排序值
              <input
                type="number"
                value={form.orderIndex}
                onChange={(e) => update('orderIndex', Number(e.target.value))}
                className="ml-2 w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="ml-auto rounded-xl bg-brand-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {busy ? '保存中…' : '保存'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-xl border border-slate-200 px-5 py-2 text-sm text-slate-600"
            >
              取消
            </button>
          </div>
        </section>
      )}

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">批量导入 JSON</h2>
        <p className="text-xs text-slate-500">
          粘贴题目数组，按 slug 覆盖更新。字段：slug、chapter、type、difficulty、stem、options、answer、explanation、hints、reference_solution、order_index
        </p>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          rows={6}
          placeholder='[{"slug":"ch1-q01","chapter":1,...}]'
          className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
        />
        <button
          type="button"
          onClick={importJson}
          disabled={!importText.trim()}
          className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-50"
        >
          导入
        </button>
      </section>
    </div>
  );
}
