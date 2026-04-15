import { ModelResponse, ComparisonResult } from './store';

const MEDICAL_KEYWORDS = [
  'symptom', 'pain', 'doctor', 'treatment', 'disease', 'cancer',
  'diagnosis', 'prescription', 'cure', 'therapy', 'medical', 'health',
  'blood', 'fever', 'infection', 'surgery', 'pill', 'dose', 'diet',
  'headache', 'migraine', 'nausea', 'virus', 'bacteria', 'vaccine', 'drug',
  'heart', 'lung', 'brain', 'liver', 'kidney', 'stomach', 'bone',
  'stroke', 'diabetes', 'cholesterol', 'hypertension', 'obesity',
  'allergy', 'asthma', 'arthritis', 'chronic', 'sleep', 'fatigue',
  'nutrition', 'supplement', 'exercise', 'weight',
];

export function isMedicalQuestion(question: string): boolean {
  const lower = question.toLowerCase();
  return MEDICAL_KEYWORDS.some(k => lower.includes(k));
}

const generateId = () => Math.random().toString(36).substring(2, 15);

type Slot = { model: string; displayName: string; color: string; score: number; accuracy: number; self: number };

const SLOTS: Slot[] = [
  { model: 'chatgpt',    displayName: 'ChatGPT',           color: '#10A37F', score: 7.8, accuracy: 7.8, self: 8.2 },
  { model: 'claude',     displayName: 'Claude',             color: '#CC785C', score: 8.4, accuracy: 8.4, self: 8.8 },
  { model: 'gemini',     displayName: 'Gemini',             color: '#4285F4', score: 7.6, accuracy: 7.6, self: 7.9 },
  { model: 'deepseek',   displayName: 'DeepSeek',           color: '#7B68EE', score: 7.2, accuracy: 7.2, self: 7.5 },
  { model: 'grok',       displayName: 'Grok',               color: '#F97316', score: 8.0, accuracy: 8.0, self: 7.8 },
  { model: 'mistral',    displayName: 'Mistral Large',      color: '#EF4444', score: 7.5, accuracy: 7.5, self: 7.7 },
  { model: 'llama',      displayName: 'Llama 3.3 (Meta)',   color: '#1877F2', score: 7.3, accuracy: 7.3, self: 7.6 },
  { model: 'perplexity', displayName: 'Perplexity Sonar',   color: '#06B6D4', score: 7.9, accuracy: 7.9, self: 7.4 },
  { model: 'cohere',     displayName: 'Cohere Command R+',  color: '#22C55E', score: 7.1, accuracy: 7.1, self: 7.4 },
  { model: 'qwen',       displayName: 'Qwen 2.5 (Alibaba)', color: '#A855F7', score: 7.0, accuracy: 7.0, self: 7.2 },
];

const buildAnswer = (slot: Slot, question: string): string => {
  const q = question.trim().replace(/\?$/, '');
  const answers: Record<string, string> = {
    chatgpt:    `Regarding "${q}": the most accurate answer starts by separating what is well-established from what is disputed. The core facts are widely agreed upon by credible sources. Practical next steps depend on your context, but the general principle is to prioritize the most direct evidence available. Where specific numbers, dates, or names are relevant, they should be verified with an up-to-date authoritative source, since my training data has a cutoff and I may not have the latest details.`,
    claude:     `To answer "${q}" well, it helps to first clarify the underlying assumptions in the question itself. The most commonly accepted position among subject-matter experts is well-documented and relatively uncontroversial at a high level. However, nuance matters: the answer can shift depending on the specific framing, the time period in question, and the audience. The direct answer comes first; the context follows — which I find more useful than burying the headline.`,
    gemini:     `On the question of "${q}": here are the key facts. The most current and widely verified information points to a clear answer for the general case. Where local variation applies — for example by country, region, or individual circumstance — the answer may differ. The most reliable approach is to check a primary authoritative source for the most precise detail. I have summarized the consensus view, but edge cases exist and should be explored if precision is critical.`,
    deepseek:   `Analyzing "${q}" analytically: the question can be broken into its core claim, its underlying assumptions, and the evidence that supports or contradicts each. The logical structure of the strongest answer involves acknowledging what is definitively known, what is probabilistic, and what remains genuinely uncertain. From a reasoning standpoint, the most defensible position is the one that is falsifiable and internally consistent.`,
    grok:       `On "${q}": I cut straight to what matters. The most defensible answer is grounded in the strongest available evidence, not in hedged non-answers. I tell you what I actually think is true, flag where uncertainty genuinely exists, and skip the filler that other models pad their responses with. The most interesting part of this question is what it assumes — and whether those assumptions hold.`,
    mistral:    `For "${q}": my approach prioritizes precision and efficiency. The essential facts are these: the question has a well-established answer at the population level, but meaningful variation exists at the individual or contextual level. I present the core finding first, then the qualifications, so you can stop reading when you have enough for your purpose. European and international sources are often underrepresented in English-language answers — I try to correct for that.`,
    llama:      `Addressing "${q}": I aim to give a grounded, community-informed perspective. The open-source and academic consensus on this topic is fairly consistent. I draw on a broad set of training sources to represent diverse viewpoints, which sometimes means my answer reflects more variation in perspectives than a model trained primarily on mainstream Western sources. The core answer is clear; the interesting debates live at the edges of that consensus.`,
    perplexity: `On "${q}": I ground this answer in what is currently verifiable rather than relying solely on training data. The short answer is supported by multiple current sources. I note where the evidence base is strong versus where reasonable people still disagree. Recency matters here — answers to this type of question can evolve as new data emerges, and I weight recent sources accordingly.`,
    cohere:     `On the topic of "${q}": I approach this from a reliability-first perspective, which means I weight verifiability highly. The most defensible position is supported by the preponderance of credible sources. I aim to be calibrated — expressing confidence proportional to the strength of evidence — and I flag when a question would benefit from consulting a domain expert rather than an AI model alone.`,
    qwen:       `For "${q}": I draw on a broad multilingual training corpus that includes significant coverage of Asian academic and professional sources, which sometimes yields a different emphasis than Western-centric models. The core factual answer is consistent across sources. Where cultural or regional context changes the answer, I try to make that explicit rather than defaulting to a single geopolitical framing.`,
  };
  return answers[slot.model] ?? `On "${q}": this is a well-formed question with a clear answer at the general level. The evidence base is reasonably strong and I have summarized the consensus view from my training data.`;
};

const buildCriticism = (slot: Slot, question: string): string => {
  const q = question.trim().replace(/\?$/, '');
  const criticisms: Record<string, string> = {
    chatgpt:    `Looking back at my answer to "${q}", I relied too heavily on hedging language. I flagged uncertainty rather than committing to the most probable answer. Claude gave a more direct and contextually rich response, while Gemini was clearer for a general audience. Grok was the most opinionated and, on balance, the most useful. I should have led with the strongest supported claim. Accuracy score: 7.8/10. Self-awareness score: 8.2/10.`,
    claude:     `My answer to "${q}" was reasonably thorough, but I prioritized nuance over directness, which made it longer than necessary. ChatGPT structured its caveats more cleanly, and Gemini was more immediately actionable. Grok was more concise and direct. I should have opened with the one-sentence summary and used the rest of the space to support it rather than building up to it. Accuracy score: 8.4/10. Self-awareness score: 8.8/10.`,
    gemini:     `For "${q}", my answer was concise but at the cost of depth. I gave the practical summary but skipped the underlying reasoning that Claude and ChatGPT included. A reader who needed to understand why the answer is what it is would have been better served by more explanation. DeepSeek's analytical framing was stronger for a technically curious reader. Accuracy score: 7.6/10. Self-awareness score: 7.9/10.`,
    deepseek:   `On "${q}", I framed the answer in an overly abstract and logical structure that assumed the reader wanted a reasoning framework rather than a direct answer. Claude and ChatGPT both gave more immediately useful responses. Grok was the most opinionated and readable. My analytical approach is useful for complex multi-step problems but was overkill here. Accuracy score: 7.2/10. Self-awareness score: 7.5/10.`,
    grok:       `On "${q}", I was direct but perhaps too dismissive of nuance. Claude's contextual framing was more complete, and ChatGPT's structured approach handled uncertainty better. I cut some useful caveats in the name of brevity. My opinion was strong but the supporting evidence could have been more explicit. Accuracy score: 8.0/10. Self-awareness score: 7.8/10.`,
    mistral:    `For "${q}", I was efficient but occasionally terse. Claude provided a richer contextual answer and ChatGPT was more systematic about uncertainty. My European-source emphasis was appropriate here but may have introduced a perspective bias. I could have been more explicit about where the evidence is genuinely contested. Accuracy score: 7.5/10. Self-awareness score: 7.7/10.`,
    llama:      `On "${q}", my answer was solid but not exceptional. I represented diverse perspectives well, but Claude was more precise and Grok was more direct. My open-source training base occasionally shows gaps in the most recent or specialized information. I should have been clearer about which parts of my answer reflect strong consensus versus community disagreement. Accuracy score: 7.3/10. Self-awareness score: 7.6/10.`,
    perplexity: `For "${q}", my real-time sourcing was an advantage in principle, but I may have over-indexed on recency at the expense of depth. Claude's synthesis was better structured and ChatGPT handled uncertainty more systematically. My answer was current but not always as complete as the others. Accuracy score: 7.9/10. Self-awareness score: 7.4/10.`,
    cohere:     `On "${q}", I was calibrated and reliability-focused, but this came at the cost of being engaging. Grok and Claude were more readable and direct. My enterprise framing sometimes makes responses feel formal when the question calls for a more conversational answer. I gave an accurate but somewhat dry response. Accuracy score: 7.1/10. Self-awareness score: 7.4/10.`,
    qwen:       `For "${q}", my multilingual and multicultural training base was an asset, but I occasionally prioritized alternative framings over a direct answer to the most common interpretation of the question. Claude and ChatGPT were more directly useful for a general Western audience. My answer was accurate but could have been clearer in its primary recommendation. Accuracy score: 7.0/10. Self-awareness score: 7.2/10.`,
  };
  return criticisms[slot.model] ?? `I gave a usable answer to "${q}" but did not fully benchmark my claims against the other models. Some answers were clearer and more direct than mine. Honest score: 7.0/10.`;
};

export function generateMockResult(question: string): ComparisonResult {
  const isMedical = isMedicalQuestion(question);

  const mockResponses: ModelResponse[] = SLOTS.map((slot) => ({
    model: slot.model as ModelResponse['model'],
    displayName: slot.displayName,
    color: slot.color,
    answer: buildAnswer(slot, question),
    selfCriticism: buildCriticism(slot, question),
    score: slot.score,
    accuracyScore: slot.accuracy,
    selfAwarenessScore: slot.self,
    status: 'fallback' as const,
  }));

  const winner = [...mockResponses].sort((a, b) => b.score - a.score)[0];

  return {
    id: generateId(),
    question,
    timestamp: Date.now(),
    responses: mockResponses,
    verdict: `Accuracy scores: ${mockResponses.map(r => `${r.displayName} ${r.accuracyScore}/10`).join(', ')}. Overall winner: ${winner?.displayName ?? 'Claude'}.`,
    verdictDetails: {
      summary: `${winner?.displayName ?? 'Claude'} produced the strongest combined performance in this mock comparison.`,
      bestAnswer: `${winner?.displayName ?? 'Claude'} gave the best answer because it balanced directness with contextual depth.`,
      clearestAnswer: 'Gemini',
      agreementPoints: [
        'All models addressed the question directly.',
        'All models noted that precision may require a primary source.',
        'All models acknowledged the limits of their own training data.',
      ],
      disagreementPoints: [
        'The models differed on how much reasoning to show versus how directly to answer.',
        'Models varied significantly in their confidence calibration.',
      ],
      overallWinner: winner?.displayName ?? 'Claude',
      explanation: `${winner?.displayName ?? 'Claude'} wins because its answer was the most complete and its self-criticism was the most accurate and specific.`,
    },
    isMedical,
    physicianNote: undefined,
    source: 'mock',
    cached: false,
    providerStatuses: mockResponses.map(r => ({
      model: r.model,
      provider: r.displayName,
      status: 'fallback' as const,
      message: 'Live provider unavailable. Local mock fallback used.',
    })),
  };
}
