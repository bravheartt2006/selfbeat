export interface ModelResponse {
  model: 'chatgpt' | 'claude' | 'gemini' | 'deepseek';
  answer: string;
  selfCriticism: string;
  score: number;
}

export interface ComparisonResult {
  id: string;
  question: string;
  timestamp: number;
  responses: ModelResponse[];
  verdict: string;
  isMedical: boolean;
  physicianNote?: string;
}

export function saveResult(result: ComparisonResult) {
  const existing = getResults();
  localStorage.setItem('selfbeat_results', JSON.stringify([result, ...existing]));
}

export function getResult(id: string): ComparisonResult | null {
  const results = getResults();
  return results.find(r => r.id === id) || null;
}

export function getResults(): ComparisonResult[] {
  try {
    const data = localStorage.getItem('selfbeat_results');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

export function findExistingResult(question: string): ComparisonResult | null {
  const results = getResults();
  return results.find(r => r.question.toLowerCase() === question.toLowerCase()) || null;
}
