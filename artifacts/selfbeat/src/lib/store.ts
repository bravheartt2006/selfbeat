import type {
  SelfbeatComparisonResult,
  SelfbeatModelResponse,
} from "@workspace/api-client-react";

export type ModelResponse = SelfbeatModelResponse;
export type ComparisonResult = SelfbeatComparisonResult;

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
