function normalize(text) {
  return String(text).replace(/\r\n/g, '\n').trim();
}

export function judge(question, submitted) {
  const expected = JSON.parse(question.answer);

  if (question.type === 'single') {
    return typeof submitted === 'string' && submitted === expected;
  }

  if (question.type === 'multiple') {
    if (!Array.isArray(submitted)) return false;
    const a = submitted.map(String).sort().join('|');
    const b = expected.map(String).sort().join('|');
    return a === b;
  }

  if (question.type === 'output') {
    if (typeof submitted !== 'string') return false;
    const value = normalize(submitted);
    return expected.map(normalize).includes(value);
  }

  return false;
}
