export function parseJson(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function toPublicQuestion(row) {
  return {
    id: row.id,
    slug: row.slug,
    chapter: row.chapter,
    type: row.type,
    difficulty: row.difficulty,
    stem: row.stem,
    options: parseJson(row.options, null),
    hints: parseJson(row.hints, null),
    orderIndex: row.order_index,
    status: row.status ?? 'unseen',
    starred: Boolean(row.starred),
    wrongCount: row.wrong_count ?? 0,
  };
}

export function toFullQuestion(row) {
  return {
    ...toPublicQuestion(row),
    answer: parseJson(row.answer, null),
    explanation: row.explanation,
    referenceSolution: row.reference_solution,
  };
}
