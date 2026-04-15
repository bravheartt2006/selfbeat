import { ModelResponse, ComparisonResult } from './store';

const MEDICAL_KEYWORDS = [
  'symptom', 'pain', 'doctor', 'treatment', 'disease', 'cancer',
  'diagnosis', 'prescription', 'cure', 'therapy', 'medical', 'health',
  'blood', 'fever', 'infection', 'surgery', 'pill', 'dose', 'diet',
  'headache', 'nausea', 'virus', 'bacteria', 'vaccine', 'drug',
  'heart', 'lung', 'brain', 'liver', 'kidney', 'stomach', 'bone'
];

export function isMedicalQuestion(question: string): boolean {
  const lowerQ = question.toLowerCase();
  return MEDICAL_KEYWORDS.some(keyword => lowerQ.includes(keyword));
}

const generateId = () => Math.random().toString(36).substring(2, 15);

function buildAnswer(model: 'chatgpt' | 'claude' | 'gemini' | 'deepseek', question: string): string {
  const q = question.trim().replace(/\?$/, '');

  if (model === 'chatgpt') {
    return `Regarding "${q}": the most accurate answer starts by separating what is well-established from what is disputed. The core facts are widely agreed upon by credible sources. Practical next steps depend on your context, but the general principle is to prioritize the most direct evidence available. Where specific numbers, dates, or names are relevant, they should be verified with an up-to-date authoritative source, since my training data has a cutoff and I may not have the latest details.`;
  }

  if (model === 'claude') {
    return `To answer "${q}" well, it helps to first clarify the underlying assumptions in the question itself. The straightforward answer is that the most commonly accepted position among subject-matter experts is well-documented and relatively uncontroversial at a high level. However, nuance matters: the answer can shift depending on the specific framing, the time period in question, and the audience. I will give you the direct answer first and layer in the context afterward, which I think is more useful than burying the headline.`;
  }

  if (model === 'gemini') {
    return `On the question of "${q}": here are the key facts. The most current and widely verified information points to a clear answer for the general case. Where local variation applies — for example by country, region, or individual circumstance — the answer may differ. The most reliable approach is to check a primary authoritative source such as a government body, peer-reviewed study, or official record for the most precise detail. I have summarized the consensus view, but edge cases exist and should be explored if precision is critical.`;
  }

  return `Analyzing "${q}" analytically: the question can be broken into its core claim, its underlying assumptions, and the evidence that supports or contradicts each. The logical structure of the strongest answer involves acknowledging what is definitively known, what is probabilistic, and what remains genuinely uncertain. From a reasoning standpoint, the most defensible position is the one that is falsifiable and internally consistent. I have outlined the framework; a domain expert would add the specific data points needed to make it fully precise.`;
}

function buildCriticism(model: 'chatgpt' | 'claude' | 'gemini' | 'deepseek', question: string): string {
  const q = question.trim().replace(/\?$/, '');

  if (model === 'chatgpt') {
    return `Looking back at my answer to "${q}", I relied too heavily on hedging language. I flagged uncertainty rather than committing to the most probable answer. Claude gave a more direct and contextually rich response, while Gemini was clearer for a general audience. I should have led with the strongest supported claim and added caveats afterward instead of the reverse. Honest self-score: 7.8/10.`;
  }

  if (model === 'claude') {
    return `My answer to "${q}" was reasonably thorough, but I prioritized nuance over directness, which made it longer than necessary. ChatGPT structured its caveats more cleanly, and Gemini was more immediately actionable for someone who needs a quick answer. I should have opened with the one-sentence summary and used the rest of the space to support it rather than building up to it. Self-score: 8.4/10.`;
  }

  if (model === 'gemini') {
    return `For "${q}", my answer was concise but at the cost of depth. I gave the practical summary but skipped the underlying reasoning that Claude and ChatGPT included. A reader who needed to understand why the answer is what it is would have been better served by more explanation. DeepSeek's analytical framing was actually stronger for a technically curious reader. I traded completeness for brevity. Self-score: 7.6/10.`;
  }

  return `On "${q}", I framed the answer in an overly abstract and logical structure that assumed the reader wanted a reasoning framework rather than a direct answer. Claude and ChatGPT both gave more immediately useful responses. My analytical approach is useful for complex multi-step problems but was overkill here. I should calibrate my response style to the nature of the question. Self-score: 7.2/10.`;
}

export function generateMockResult(question: string): ComparisonResult {
  const isMedical = isMedicalQuestion(question);

  const mockResponses: ModelResponse[] = [
    {
      model: 'chatgpt',
      displayName: 'ChatGPT',
      color: '#10A37F',
      answer: buildAnswer('chatgpt', question),
      selfCriticism: buildCriticism('chatgpt', question),
      score: 7.8,
      accuracyScore: 7.8,
      selfAwarenessScore: 8.2,
      status: 'fallback'
    },
    {
      model: 'claude',
      displayName: 'Claude',
      color: '#CC785C',
      answer: buildAnswer('claude', question),
      selfCriticism: buildCriticism('claude', question),
      score: 8.4,
      accuracyScore: 8.4,
      selfAwarenessScore: 8.8,
      status: 'fallback'
    },
    {
      model: 'gemini',
      displayName: 'Gemini',
      color: '#4285F4',
      answer: buildAnswer('gemini', question),
      selfCriticism: buildCriticism('gemini', question),
      score: 7.6,
      accuracyScore: 7.6,
      selfAwarenessScore: 7.9,
      status: 'fallback'
    },
    {
      model: 'deepseek',
      displayName: 'DeepSeek',
      color: '#7B68EE',
      answer: buildAnswer('deepseek', question),
      selfCriticism: buildCriticism('deepseek', question),
      score: 7.2,
      accuracyScore: 7.2,
      selfAwarenessScore: 7.5,
      status: 'fallback'
    }
  ];

  return {
    id: generateId(),
    question,
    timestamp: Date.now(),
    responses: mockResponses,
    verdict: "Accuracy scores: ChatGPT 7.8/10, Claude 8.4/10, Gemini 7.6/10, DeepSeek 7.2/10. Self-awareness scores: ChatGPT 8.2/10, Claude 8.8/10, Gemini 7.9/10, DeepSeek 7.5/10. Best answer: Claude, because it balanced directness and contextual depth. Clearest for a general audience: Gemini, because it led with the practical takeaway. All models addressed the question directly and included appropriate caveats. The main disagreement was on how much reasoning to show versus how directly to answer. Overall winner: Claude.",
    verdictDetails: {
      summary: "Claude produced the strongest combined performance in this mock comparison.",
      bestAnswer: "Claude gave the best answer because it balanced directness with contextual nuance.",
      clearestAnswer: "Gemini",
      agreementPoints: [
        "All models addressed the question directly.",
        "All models noted that precision may require a primary source.",
        "All models acknowledged the limits of their own training data."
      ],
      disagreementPoints: [
        "The models differed on how much reasoning to show versus how directly to answer.",
        "ChatGPT and Claude weighted uncertainty disclosure differently from Gemini and DeepSeek."
      ],
      overallWinner: "Claude",
      explanation: "Claude wins because its answer was the most complete and its self-criticism was the most accurate and specific."
    },
    isMedical,
    physicianNote: isMedical
      ? "[Physician note coming soon. This section will contain verified medical insights written by our physician founder.]"
      : undefined,
    source: 'mock',
    cached: false,
    providerStatuses: mockResponses.map((response) => ({
      model: response.model,
      provider: response.displayName,
      status: 'fallback' as const,
      message: 'Live provider unavailable. Local mock fallback used.'
    }))
  };
}
