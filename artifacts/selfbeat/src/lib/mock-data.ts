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

export function generateMockResult(question: string): ComparisonResult {
  const isMedical = isMedicalQuestion(question);

  const mockResponses: ModelResponse[] = [
    {
      model: 'chatgpt',
      displayName: 'ChatGPT',
      color: '#10A37F',
      answer: "Here is a structured, comprehensive overview based on current consensus. The key factors to consider are A, B, and C. In most standard cases, this approach yields the highest probability of success while minimizing risks.",
      selfCriticism: "My initial response was perhaps too generalized and overly safe. I leaned heavily on structural formatting rather than directly addressing the nuance of the user's specific phrasing. The other models provided more direct, actionable insights without the unnecessary preamble.",
      score: 8.5,
      accuracyScore: 8.5,
      selfAwarenessScore: 8.7,
      status: 'fallback'
    },
    {
      model: 'claude',
      displayName: 'Claude',
      color: '#CC785C',
      answer: "I approach this by first analyzing the underlying principles. Let's break down the implications and explore the nuance. It's important to recognize that context drastically changes the optimal path forward.",
      selfCriticism: "I focused too much on the ethical and contextual framing, which made the actual answer somewhat verbose. Compared to the others, I buried the lede. I should have delivered the primary information first and provided the context as secondary support.",
      score: 9.2,
      accuracyScore: 9.2,
      selfAwarenessScore: 9,
      status: 'fallback'
    },
    {
      model: 'gemini',
      displayName: 'Gemini',
      color: '#4285F4',
      answer: "Based on the latest available data, here are the immediate facts you need to know. Option 1 is highly effective in these scenarios, while Option 2 is an emerging alternative. Be sure to verify specific local guidelines.",
      selfCriticism: "While my facts were accurate, my delivery was slightly disjointed. I failed to synthesize the information into a cohesive narrative like Claude did, and my bullet points lacked the structural rigor of ChatGPT. I need better narrative flow.",
      score: 8.8,
      accuracyScore: 8.8,
      selfAwarenessScore: 8.4,
      status: 'fallback'
    },
    {
      model: 'deepseek',
      displayName: 'DeepSeek',
      color: '#7B68EE',
      answer: "From a purely analytical standpoint, the most efficient resolution involves a multi-step logical deduction. Step 1: isolate the variable. Step 2: apply standard optimization protocols. The mathematical probability of success is highest when following this strict sequence.",
      selfCriticism: "I over-indexed on analytical rigidity and failed to account for human variables. My response reads more like a technical manual than a helpful guide. I missed the conversational empathy present in the other models' responses.",
      score: 7.9,
      accuracyScore: 7.9,
      selfAwarenessScore: 8.1,
      status: 'fallback'
    }
  ];

  return {
    id: generateId(),
    question,
    timestamp: Date.now(),
    responses: mockResponses,
    verdict: "Accuracy scores: ChatGPT 8.5/10, Claude 9.2/10, Gemini 8.8/10, DeepSeek 7.9/10. Self-awareness scores: ChatGPT 8.7/10, Claude 9.0/10, Gemini 8.4/10, DeepSeek 8.1/10. Best answer: Claude, because it balanced context, nuance, and directness. Clearest for the general public: Gemini, because its explanation was concise and immediately actionable. All AIs agreed on the main principle behind the answer, but disagreed on how much uncertainty and context should be emphasized. Overall winner: Claude, with Gemini close behind for clarity and ChatGPT strongest in self-correction.",
    verdictDetails: {
      summary: "Claude produced the strongest combined mock performance.",
      bestAnswer: "Claude gave the best answer because it balanced nuance and directness.",
      clearestAnswer: "Gemini",
      agreementPoints: ["All models addressed the core question.", "All models included important caveats."],
      disagreementPoints: ["The models differed on depth.", "The models weighted clarity and nuance differently."],
      overallWinner: "Claude",
      explanation: "Claude wins the mock comparison because it paired the strongest answer with honest self-criticism."
    },
    isMedical,
    physicianNote: isMedical ? "[Physician note will appear here for health questions]" : undefined,
    source: 'mock',
    cached: false,
    providerStatuses: mockResponses.map((response) => ({
      model: response.model,
      provider: response.displayName,
      status: 'fallback',
      message: 'Local mock fallback used.'
    }))
  };
}
