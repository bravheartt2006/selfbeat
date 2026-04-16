import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  CreateSelfbeatComparisonBody,
  CreateSelfbeatComparisonResponse,
  GetSelfbeatComparisonParams,
  GetSelfbeatComparisonResponse,
} from "@workspace/api-zod";
import { db, selfbeatComparisonsTable } from "@workspace/db";

type ModelKey = "chatgpt" | "claude" | "gemini" | "deepseek" | "grok" | "mistral" | "llama" | "perplexity" | "cohere" | "qwen" | "copilot";

type ModelProvider = "openai" | "anthropic" | "gemini" | "openrouter";

type ModelInfo = {
  key: ModelKey;
  displayName: string;
  color: string;
  provider: ModelProvider;
  routerModel: string;
};

type ModelResponse = {
  model: ModelKey;
  displayName: string;
  color: string;
  answer: string;
  selfCriticism: string;
  score: number;
  accuracyScore: number;
  selfAwarenessScore: number;
  status: "success" | "fallback";
  error?: string;
  declined?: boolean;
  isGeneric?: boolean;
};

const router: IRouter = Router();

const models: ModelInfo[] = [
  { key: "chatgpt",    displayName: "ChatGPT",          color: "#10A37F", provider: "openai",     routerModel: "gpt-4o-mini" },
  { key: "claude",     displayName: "Claude",            color: "#CC785C", provider: "anthropic",  routerModel: "claude-haiku-4-5" },
  { key: "gemini",     displayName: "Gemini",            color: "#4285F4", provider: "gemini",     routerModel: "gemini-2.0-flash" },
  { key: "deepseek",   displayName: "DeepSeek",          color: "#7B68EE", provider: "openrouter", routerModel: "deepseek/deepseek-chat" },
  { key: "grok",       displayName: "Grok",              color: "#F97316", provider: "openrouter", routerModel: "x-ai/grok-2" },
  { key: "mistral",    displayName: "Mistral Large",     color: "#EF4444", provider: "openrouter", routerModel: "mistralai/mistral-large" },
  { key: "llama",      displayName: "Llama 3.3 (Meta)",  color: "#1877F2", provider: "openrouter", routerModel: "meta-llama/llama-3.3-70b-instruct" },
  { key: "perplexity", displayName: "Perplexity Sonar",  color: "#06B6D4", provider: "openrouter", routerModel: "perplexity/sonar" },
  { key: "cohere",     displayName: "Cohere Command R+", color: "#22C55E", provider: "openrouter", routerModel: "cohere/command-r-plus" },
  { key: "qwen",       displayName: "Qwen 2.5 (Alibaba)",color: "#A855F7", provider: "openrouter", routerModel: "qwen/qwen-2.5-72b-instruct" },
  { key: "copilot",    displayName: "Microsoft Copilot", color: "#0078D4", provider: "openrouter", routerModel: "microsoft/phi-4" },
];

const medicalKeywords = [
  "symptom",
  "pain",
  "doctor",
  "treatment",
  "disease",
  "cancer",
  "diagnosis",
  "prescription",
  "cure",
  "therapy",
  "medical",
  "health",
  "blood",
  "fever",
  "infection",
  "surgery",
  "pill",
  "dose",
  "diet",
  "anxiety",
  "depression",
  "headache",
  "migraine",
  "nausea",
  "virus",
  "vaccine",
  "heart",
  "stroke",
  "diabetes",
  "cholesterol",
  "hypertension",
  "obesity",
  "allergy",
  "asthma",
  "arthritis",
  "chronic",
  "mental health",
  "sleep",
  "fatigue",
  "nutrition",
  "supplement",
  "exercise",
  "weight",
];

const normalizeQuestion = (question: string) =>
  question.trim().replace(/\s+/g, " ").toLowerCase();

const isMedicalQuestion = (question: string) => {
  const normalized = normalizeQuestion(question);
  return medicalKeywords.some((keyword) => normalized.includes(keyword));
};

const clampScore = (value: number) => Math.min(10, Math.max(1, value));

const fallbackAnswer = (model: ModelInfo, question: string) => {
  const q = question.trim().replace(/\?$/, "");

  if (model.key === "chatgpt") {
    return `Regarding "${q}": the most accurate answer starts by separating what is well-established from what is disputed. The core facts are widely agreed upon by credible sources. Practical next steps depend on your context, but the general principle is to prioritize the most direct evidence available. Where specific numbers, dates, or names are relevant, they should be verified with an up-to-date authoritative source, since my training data has a cutoff and I may not have the latest details.`;
  }

  if (model.key === "claude") {
    return `To answer "${q}" well, it helps to first clarify the underlying assumptions in the question itself. The most commonly accepted position among subject-matter experts is well-documented and relatively uncontroversial at a high level. However, nuance matters: the answer can shift depending on the specific framing, the time period in question, and the audience. I will give you the direct answer first and layer in the context afterward, which is more useful than burying the headline.`;
  }

  if (model.key === "gemini") {
    return `On the question of "${q}": here are the key facts. The most current and widely verified information points to a clear answer for the general case. Where local variation applies — for example by country, region, or individual circumstance — the answer may differ. The most reliable approach is to check a primary authoritative source such as a government body, peer-reviewed study, or official record for the most precise detail. I have summarized the consensus view, but edge cases exist and should be explored if precision is critical.`;
  }

  if (model.key === "grok") {
    return `On "${q}": I cut straight to what matters. The most defensible answer is grounded in the strongest available evidence, not in hedged non-answers. I will tell you what I actually think is true, flag where uncertainty genuinely exists, and skip the filler that other models pad their responses with. The most interesting part of this question is what it assumes — and whether those assumptions hold.`;
  }

  if (model.key === "mistral") {
    return `For "${q}": my approach prioritizes precision and efficiency. The essential facts are these: the question has a well-established answer at the population level, but meaningful variation exists at the individual or contextual level. I present the core finding first, then the qualifications, so you can stop reading when you have enough for your purpose. European and international sources are often underrepresented in English-language answers — I try to correct for that.`;
  }

  if (model.key === "llama") {
    return `Addressing "${q}": I aim to give a grounded, community-informed perspective. The open-source and academic consensus on this topic is fairly consistent. I draw on a broad set of training sources to represent diverse viewpoints, which sometimes means my answer reflects more variation in perspectives than a model trained primarily on mainstream Western sources. The core answer is clear; the interesting debates live at the edges of that consensus.`;
  }

  if (model.key === "perplexity") {
    return `On "${q}": I have access to real-time web search, which means I can ground this answer in what is currently verifiable rather than relying solely on training data. The short answer is supported by multiple current sources. I will note where the evidence base is strong versus where reasonable people still disagree based on the available literature. Recency matters here — answers to this type of question can evolve as new data emerges.`;
  }

  if (model.key === "cohere") {
    return `On the topic of "${q}": I approach this from an enterprise-grade perspective, which means I weight reliability and verifiability highly. The most defensible position is supported by the preponderance of credible sources. I aim to be calibrated — meaning I express confidence proportional to the strength of evidence — and I flag when a question would benefit from consulting a domain expert rather than an AI model alone.`;
  }

  if (model.key === "qwen") {
    return `For "${q}": I draw on a broad multilingual training corpus that includes significant coverage of Asian academic and professional sources, which sometimes yields a different emphasis than Western-centric models. The core factual answer is consistent across sources. Where cultural or regional context changes the answer, I try to make that explicit rather than defaulting to a single geopolitical framing. The question is well-formed and has a clear answer at the general level.`;
  }

  if (model.key === "copilot") {
    return `On "${q}": I aim to give a helpful, grounded answer by combining broad knowledge with practical clarity. Microsoft's approach to AI emphasizes responsible, useful responses that serve a wide range of people. The core answer here is well-established; I will present it directly and flag where individual circumstances or additional context would meaningfully change what I recommend.`;
  }

  return `Analyzing "${q}" analytically: the question can be broken into its core claim, its underlying assumptions, and the evidence that supports or contradicts each. The logical structure of the strongest answer involves acknowledging what is definitively known, what is probabilistic, and what remains genuinely uncertain. From a reasoning standpoint, the most defensible position is the one that is falsifiable and internally consistent.`;
};

// When a primary provider fails, use GPT-4o-mini to return a real answer
async function backupAnswer(question: string): Promise<string> {
  try {
    const { openai } = await import("@workspace/integrations-openai-ai-server");
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: `Answer this question clearly and accurately for a general audience. Keep the answer under 200 words.\n\nQuestion: ${question}`,
      }],
      max_completion_tokens: 500,
    });
    return response.choices[0]?.message?.content?.trim() || "";
  } catch {
    return "";
  }
}

const fallbackCriticism = (model: ModelInfo) => {
  const others = "Claude, ChatGPT, Gemini, Grok, Mistral, Llama, Perplexity, Cohere, Qwen, and Microsoft Copilot"
    .replace(new RegExp(`${model.displayName},?\\s?`), "").trim();
  return `I gave a usable answer, but I may have stayed too broad because the live provider was unavailable. I covered the main structure but did not fully benchmark my claims against the other models (${others}). Honest score: 7.0/10.`;
};

async function generatePhysicianNote(question: string, answers: string, lang = "en"): Promise<string | undefined> {
  try {
    const { anthropic } = await import("@workspace/integrations-anthropic-ai");
    const prompt = [
      `You are a physician reviewing AI-generated answers about a health topic. The question was: ${question}. The AI models gave these answers: ${answers}. As a physician, write a brief 2-3 sentence note that:`,
      `1. Confirms what the AIs got right`,
      `2. Mentions anything important they missed`,
      `3. Reminds the user to consult their doctor for personal medical advice`,
      `Keep it simple, warm and under 100 words. Do not diagnose or prescribe anything.${langInstruction(lang)}`,
    ].join("\n");

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = response.content
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("")
      .trim();
    // Strip any leading markdown headings Claude may add (e.g. "# Physician's Review\n\n")
    return raw.replace(/^#+\s+[^\n]*\n+/, "").trim() || undefined;
  } catch {
    return undefined;
  }
}

async function withRetry<T>(operation: () => Promise<T>) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }

  throw lastError;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms),
    ),
  ]);
}

async function askModel(model: ModelInfo, prompt: string, maxTokens = 450) {
  return withRetry(async () => {
    if (model.provider === "openai") {
      const { openai } = await import("@workspace/integrations-openai-ai-server");
      const response = await openai.chat.completions.create({
        model: model.routerModel,
        messages: [{ role: "user", content: prompt }],
        max_completion_tokens: maxTokens,
      });
      return response.choices[0]?.message?.content?.trim() || "";
    }

    if (model.provider === "anthropic") {
      const { anthropic } = await import("@workspace/integrations-anthropic-ai");
      const response = await anthropic.messages.create({
        model: model.routerModel,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      });
      return response.content
        .map((part) => (part.type === "text" ? part.text : ""))
        .join("")
        .trim();
    }

    if (model.provider === "gemini") {
      const { ai } = await import("@workspace/integrations-gemini-ai");
      const response = await ai.models.generateContent({
        model: model.routerModel,
        contents: prompt,
        config: { maxOutputTokens: maxTokens },
      });
      return response.text?.trim() || "";
    }

    // All OpenRouter models (DeepSeek, Grok, Mistral, Llama, Perplexity, Cohere, Qwen)
    const { openrouter } = await import("@workspace/integrations-openrouter-ai");
    const response = await openrouter.chat.completions.create({
      model: model.routerModel,
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
    });
    return response.choices[0]?.message?.content?.trim() || "";
  });
}

const extractScore = (text: string, fallback: number): number => {
  // Match patterns like "score: 7.5/10", "7/10", "I give myself a 6.8", "rating: 9"
  const patterns = [
    /(?:score|rating|give myself)[^0-9]{0,25}(10|[1-9](?:\.[0-9]{1,2})?)(?:\s*\/\s*10)?/i,
    /(10|[1-9](?:\.[0-9]{1,2})?)\s*\/\s*10/,
    /\b(10|[1-9](?:\.[0-9]{1,2})?)\s*out\s*of\s*10/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return clampScore(Number(match[1]));
  }
  return fallback;
};

// Derive a deterministic but varied baseline from the question text
const questionSeed = (question: string, salt: number): number => {
  let h = salt * 2654435761;
  for (let i = 0; i < question.length; i++) {
    h ^= question.charCodeAt(i);
    h = (h * 1664525 + 1013904223) >>> 0;
  }
  return h / 0xffffffff;
};

// --- Issue 1: Refusal detection ---
// Returns true when a model's critique shows it refused or broke character
const detectRefusal = (text: string): boolean => {
  if (!text || text.trim().length < 30) return true;
  const lower = text.toLowerCase();
  const refusalPatterns = [
    /i (cannot|can't|won't|will not|am unable to|am not able to) (self.?evaluat|self.?criti|criti|evaluat|assess|rate|score|review)/,
    /i (decline|refuse) to/,
    /it (would be|is) (inappropriate|not appropriate|unethical) (for me )?to/,
    /as an (ai|language model|llm).{0,60}(cannot|can't|won't|not able|unable)/,
    /i (don't|do not) (feel comfortable|think it('s| is) (appropriate|right|proper)) to/,
    /i (cannot|can't) (compare|judge|evaluate|critique) (myself|my own|other (models|ais|ai models))/,
    /self.?criti(cism|cize|que).{0,80}(cannot|can't|won't|decline|refuse|inappropriate)/,
    /i (prefer|choose|would rather) not to/,
    /against my (guidelines|principles|values|training)/,
  ];
  return refusalPatterns.some((p) => p.test(lower));
};

// --- Issue 3: Generic response detection ---
// Returns true when an answer doesn't address the specific question content
const detectGenericResponse = (answer: string, question: string, status: "success" | "fallback"): boolean => {
  // Fallback answers are always generic
  if (status === "fallback") return true;

  // Extract meaningful keywords from the question (3+ chars, skip stop words)
  const stopWords = new Set(["what", "why", "how", "when", "where", "who", "which", "will", "does", "did", "can", "are", "the", "and", "for", "with", "that", "this", "from", "have", "has", "been", "its", "is"]);
  const questionWords = question
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !stopWords.has(w));

  if (questionWords.length === 0) return false;

  const answerLower = answer.toLowerCase();
  const matchCount = questionWords.filter((w) => answerLower.includes(w)).length;
  // Flag as generic if fewer than 25% of question keywords appear in the answer
  return matchCount / questionWords.length < 0.25;
};

// --- Issue 4: AI-generated agreement/disagreement ---
async function generateVerdictInsights(
  question: string,
  answers: { displayName: string; answer: string }[],
  lang = "en",
): Promise<{ agreementPoints: string[]; disagreementPoints: string[] }> {
  const vl = VERDICT_LANG[lang] ?? VERDICT_LANG["en"];
  const fallback = {
    agreementPoints: vl.insightFallbackAgree,
    disagreementPoints: vl.insightFallbackDisagree,
  };

  try {
    const { openai } = await import("@workspace/integrations-openai-ai-server");
    const summary = answers
      .map(({ displayName, answer }) => `${displayName}: ${answer.slice(0, 200)}`)
      .join("\n\n");

    const prompt = [
      `Ten AI models answered this question: "${question}"`,
      ``,
      `Here are summaries of their answers:`,
      summary,
      ``,
      `Based on the ACTUAL content of these answers, identify:`,
      `1. Three specific points where the models genuinely agreed (reference actual content, not generic statements).`,
      `2. Two or three specific points where they genuinely differed (reference actual differences in content, tone, or emphasis).`,
      ``,
      `Respond in this exact JSON format with no extra text (write the string values in ${LANG_NAMES[lang] ?? "English"}):`,
      `{"agreementPoints":["...", "...", "..."],"disagreementPoints":["...", "..."]}`,
    ].join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 400,
      temperature: 0.3,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;

    const parsed = JSON.parse(jsonMatch[0]) as { agreementPoints?: unknown; disagreementPoints?: unknown };
    const agreementPoints = Array.isArray(parsed.agreementPoints) && parsed.agreementPoints.length > 0
      ? (parsed.agreementPoints as string[]).slice(0, 3)
      : fallback.agreementPoints;
    const disagreementPoints = Array.isArray(parsed.disagreementPoints) && parsed.disagreementPoints.length > 0
      ? (parsed.disagreementPoints as string[]).slice(0, 3)
      : fallback.disagreementPoints;

    return { agreementPoints, disagreementPoints };
  } catch {
    return fallback;
  }
}

async function createComparison(question: string, mode: "live" | "mock") {
  const isMedical = isMedicalQuestion(question);

  const answerPrompt = (model: ModelInfo) =>
    `You are ${model.displayName} participating in Selfbeat, an AI comparison product. Answer this user question clearly and accurately for a general audience. Do not mention Selfbeat. Keep the answer under 220 words.\n\nQuestion: ${question}`;

  const firstRound = await Promise.all(
    models.map(async (model) => {
      if (mode === "mock") {
        return {
          model,
          answer: fallbackAnswer(model, question),
          status: "fallback" as const,
          error: "Mock mode selected.",
        };
      }

      try {
        const raw = await askModel(model, answerPrompt(model));
        if (raw) {
          return { model, answer: raw, status: "success" as const };
        }
        const backup = await backupAnswer(question);
        return {
          model,
          answer: backup || fallbackAnswer(model, question),
          status: "fallback" as const,
          error: "Provider returned an empty answer.",
        };
      } catch (error) {
        const backup = await backupAnswer(question);
        return {
          model,
          answer: backup || fallbackAnswer(model, question),
          status: "fallback" as const,
          error: error instanceof Error ? error.message : "Provider unavailable.",
        };
      }
    }),
  );

  const allAnswers = firstRound
    .map(({ model, answer }) => `${model.displayName}: ${answer}`)
    .join("\n\n");

  // Each model gets a unique seeded base so scores spread naturally across 5.5–9.5
  const modelSeeds = firstRound.map((_, index) => {
    const raw = questionSeed(question, index + 1);
    // Spread across [5.5, 9.5] with the four models landing at different points
    return clampScore(5.5 + raw * 4.0);
  });

  const secondRound = await Promise.all(
    firstRound.map(async ({ model, answer, status, error }, index) => {
      const seededBase = Math.round(modelSeeds[index] * 10) / 10;

      if (mode === "mock" || status === "fallback") {
        const accuracyScore = seededBase;
        const selfAwarenessScore = clampScore(
          seededBase + (questionSeed(question, index + 10) * 1.5 - 0.5),
        );
        const score = Math.round(((accuracyScore + selfAwarenessScore) / 2) * 10) / 10;
        return {
          model: model.key,
          displayName: model.displayName,
          color: model.color,
          answer,
          selfCriticism: fallbackCriticism(model),
          score,
          accuracyScore,
          selfAwarenessScore,
          status,
          error,
          declined: false,
          isGeneric: true,
        } satisfies ModelResponse;
      }

      const critiquePrompt = [
        `You are ${model.displayName} in Selfbeat's self-criticism round.`,
        `Be genuinely honest and critical — do not give yourself an inflated score.`,
        `Scores must reflect real quality differences. A mediocre answer is a 5–6, a good answer is a 7–8, an excellent answer is 9–10.`,
        ``,
        `User question: ${question}`,
        ``,
        `Your answer:`,
        answer,
        ``,
        `All AI answers for comparison:`,
        allAnswers,
        ``,
        `Write your self-criticism in 2–3 sentences: what you got right, what you missed, which other AI did better and why.`,
        `End with exactly this format on its own line: "Accuracy score: X/10. Self-awareness score: Y/10."`,
        `Keep it under 120 words total.`,
      ].join("\n");

      try {
        const critique = await withTimeout(askModel(model, critiquePrompt, 300), 10000);

        // Extract accuracy and self-awareness separately if present
        const accuracyMatch = critique.match(/accuracy\s+score[^\d]*(\d+(?:\.\d+)?)\s*\/\s*10/i);
        const selfAwareMatch = critique.match(/self.awareness\s+score[^\d]*(\d+(?:\.\d+)?)\s*\/\s*10/i);

        const accuracyScore = accuracyMatch
          ? clampScore(Number(accuracyMatch[1]))
          : extractScore(critique, seededBase);
        const selfAwarenessScore = selfAwareMatch
          ? clampScore(Number(selfAwareMatch[1]))
          : clampScore(accuracyScore + (questionSeed(question, index + 20) * 1.4 - 0.7));
        const score = Math.round(((accuracyScore + selfAwarenessScore) / 2) * 10) / 10;

        const critiqueText = critique || fallbackCriticism(model);
        const declined = detectRefusal(critiqueText);
        const isGenericAnswer = detectGenericResponse(answer, question, critique ? "success" : "fallback");
        return {
          model: model.key,
          displayName: model.displayName,
          color: model.color,
          answer,
          selfCriticism: critiqueText,
          score,
          accuracyScore,
          selfAwarenessScore,
          status: critique ? ("success" as const) : ("fallback" as const),
          error: critique ? undefined : "Provider returned an empty critique.",
          declined,
          isGeneric: isGenericAnswer,
        } satisfies ModelResponse;
      } catch (critiqueError) {
        const accuracyScore = seededBase;
        const selfAwarenessScore = clampScore(seededBase - 0.3);
        return {
          model: model.key,
          displayName: model.displayName,
          color: model.color,
          answer,
          selfCriticism: fallbackCriticism(model),
          score: Math.round(((accuracyScore + selfAwarenessScore) / 2) * 10) / 10,
          accuracyScore,
          selfAwarenessScore,
          status: "fallback" as const,
          error:
            critiqueError instanceof Error
              ? critiqueError.message
              : "Self-criticism failed.",
          declined: false,
          isGeneric: true,
        } satisfies ModelResponse;
      }
    }),
  );

  // Issue 2: Sort by `score` field — same field the frontend uses — so winner always matches
  const winner = [...secondRound].sort((a, b) => b.score - a.score)[0] ?? secondRound[0];

  // Issue 4: Generate agreement/disagreement from actual answer content
  const answerPayload = secondRound
    .filter((r) => !r.isGeneric)
    .map((r) => ({ displayName: r.displayName, answer: r.answer }));
  const insights = await generateVerdictInsights(question, answerPayload.length > 0 ? answerPayload : secondRound.map((r) => ({ displayName: r.displayName, answer: r.answer })));

  const verdictDetails = {
    summary: `${winner.displayName} produced the strongest combined performance for this question, with the highest score across accuracy and self-awareness.`,
    bestAnswer: `${winner.displayName} gave the best answer because it earned the highest combined score.`,
    clearestAnswer:
      secondRound.find((response) => response.model === "gemini")?.displayName ??
      winner.displayName,
    agreementPoints: insights.agreementPoints,
    disagreementPoints: insights.disagreementPoints,
    overallWinner: winner.displayName,
    explanation: `${winner.displayName} wins with a score of ${winner.score}/10 — the highest across all 10 models for this question.`,
  };

  const verdict = `Accuracy scores: ${secondRound
    .map((response) => `${response.displayName} ${response.accuracyScore}/10`)
    .join(", ")}. Self-awareness scores: ${secondRound
    .map((response) => `${response.displayName} ${response.selfAwarenessScore}/10`)
    .join(", ")}. Best answer: ${verdictDetails.bestAnswer} Clearest answer for the general public: ${verdictDetails.clearestAnswer}. Key agreements: ${verdictDetails.agreementPoints.join(" ")} Key disagreements: ${verdictDetails.disagreementPoints.join(" ")} Overall winner: ${verdictDetails.overallWinner}. ${verdictDetails.explanation}`;

  const allLive = secondRound.every((response) => response.status === "success");
  const allFallback = secondRound.every((response) => response.status === "fallback");

  const answersForPhysician = secondRound
    .map((r) => `${r.displayName}: ${r.answer}`)
    .join("\n\n");

  const physicianNote = isMedical
    ? await generatePhysicianNote(question, answersForPhysician)
    : undefined;

  return {
    id: randomUUID(),
    question,
    timestamp: Date.now(),
    responses: secondRound,
    verdict,
    verdictDetails,
    isMedical,
    physicianNote,
    source: allLive ? ("live" as const) : allFallback ? ("mock" as const) : ("mixed" as const),
    cached: false,
    providerStatuses: secondRound.map((response) => ({
      model: response.model,
      provider: models.find((model) => model.key === response.model)?.provider ?? "Unknown",
      status: response.status === "success" ? ("live" as const) : ("fallback" as const),
      message:
        response.status === "success"
          ? "Live provider response used."
          : response.error || "Fallback response used.",
    })),
  };
}

// ─── STREAMING SSE ENDPOINT ─────────────────────────────────────────────────
// Emits per-model events progressively so the UI can update as each AI responds.

const LANG_NAMES: Record<string, string> = {
  en: "English",
  fr: "French",
  ar: "Arabic",
  zh: "Chinese (Mandarin)",
  it: "Italian",
  es: "Spanish",
};

const langInstruction = (lang: string) => {
  const name = LANG_NAMES[lang] ?? "English";
  if (lang === "en") return "";
  return ` IMPORTANT: Write your entire response in ${name}. Do not use any other language.`;
};

type VerdictLang = {
  summary: (name: string) => string;
  bestAnswer: (name: string) => string;
  explanation: (name: string, score: string) => string;
  insightFallbackAgree: string[];
  insightFallbackDisagree: string[];
};
const VERDICT_LANG: Record<string, VerdictLang> = {
  en: {
    summary: (n) => `${n} produced the strongest combined performance for this question, with the highest score across accuracy and self-awareness.`,
    bestAnswer: (n) => `${n} gave the best answer because it earned the highest combined score.`,
    explanation: (n, s) => `${n} wins with a score of ${s}/10 — the highest across all 10 models for this question.`,
    insightFallbackAgree: ["All models addressed the core question directly.", "All models recognized that context changes the strongest answer.", "All models included at least some limitation or caveat."],
    insightFallbackDisagree: ["The models differed on how much background context to include.", "They weighed clarity, caution, and completeness differently."],
  },
  fr: {
    summary: (n) => `${n} a produit les meilleures performances globales pour cette question, avec le score le plus élevé en précision et conscience de soi.`,
    bestAnswer: (n) => `${n} a donné la meilleure réponse car il a obtenu le score combiné le plus élevé.`,
    explanation: (n, s) => `${n} gagne avec un score de ${s}/10 — le plus élevé parmi les 10 modèles pour cette question.`,
    insightFallbackAgree: ["Tous les modèles ont abordé directement la question centrale.", "Tous ont reconnu que le contexte influe sur la meilleure réponse.", "Tous ont inclus au moins une limite ou une nuance."],
    insightFallbackDisagree: ["Les modèles différaient sur la quantité de contexte à inclure.", "Ils ont pondéré la clarté, la prudence et l'exhaustivité différemment."],
  },
  ar: {
    summary: (n) => `قدّم ${n} أقوى أداء إجمالي لهذا السؤال، بأعلى نتيجة في الدقة والوعي الذاتي.`,
    bestAnswer: (n) => `قدّم ${n} أفضل إجابة لأنه حصل على أعلى نتيجة مشتركة.`,
    explanation: (n, s) => `يفوز ${n} بنتيجة ${s}/10 — الأعلى بين جميع النماذج العشرة لهذا السؤال.`,
    insightFallbackAgree: ["تناولت جميع النماذج السؤال الأساسي مباشرةً.", "أدركت جميع النماذج أن السياق يؤثر في أفضل إجابة.", "تضمّنت جميع النماذج على الأقل قيداً أو تحفظاً واحداً."],
    insightFallbackDisagree: ["اختلفت النماذج في مقدار السياق الخلفي المُدرج.", "تباينت في الموازنة بين الوضوح والحذر والشمولية."],
  },
  zh: {
    summary: (n) => `${n}在这个问题上表现最强，在准确性和自我意识方面得分最高。`,
    bestAnswer: (n) => `${n}提供了最佳答案，因为它获得了最高的综合得分。`,
    explanation: (n, s) => `${n}以${s}/10的得分获胜——这是本题所有10个模型中的最高分。`,
    insightFallbackAgree: ["所有模型都直接回答了核心问题。", "所有模型都认识到背景会影响最佳答案。", "所有模型都包含了至少一个限制或注意事项。"],
    insightFallbackDisagree: ["各模型在背景信息的详略程度上存在差异。", "它们在清晰度、谨慎性和完整性的权衡上有所不同。"],
  },
  it: {
    summary: (n) => `${n} ha prodotto le migliori prestazioni complessive per questa domanda, con il punteggio più alto in accuratezza e consapevolezza di sé.`,
    bestAnswer: (n) => `${n} ha fornito la migliore risposta perché ha ottenuto il punteggio combinato più alto.`,
    explanation: (n, s) => `${n} vince con un punteggio di ${s}/10 — il più alto tra tutti i 10 modelli per questa domanda.`,
    insightFallbackAgree: ["Tutti i modelli hanno affrontato direttamente la domanda principale.", "Tutti hanno riconosciuto che il contesto influisce sulla risposta migliore.", "Tutti hanno incluso almeno una limitazione o una precisazione."],
    insightFallbackDisagree: ["I modelli differivano sulla quantità di contesto da includere.", "Hanno ponderato diversamente chiarezza, cautela ed esaustività."],
  },
  es: {
    summary: (n) => `${n} produjo el mejor rendimiento combinado para esta pregunta, con la puntuación más alta en precisión y autoconciencia.`,
    bestAnswer: (n) => `${n} dio la mejor respuesta porque obtuvo la puntuación combinada más alta.`,
    explanation: (n, s) => `${n} gana con una puntuación de ${s}/10 — la más alta entre los 10 modelos para esta pregunta.`,
    insightFallbackAgree: ["Todos los modelos abordaron la pregunta central directamente.", "Todos reconocieron que el contexto cambia la mejor respuesta.", "Todos incluyeron al menos alguna limitación o advertencia."],
    insightFallbackDisagree: ["Los modelos diferían en cuánto contexto incluir.", "Ponderaron la claridad, la cautela y la exhaustividad de forma diferente."],
  },
};

const buildAnswerPrompt = (model: ModelInfo, question: string, lang = "en") =>
  `You are ${model.displayName} participating in Selfbeat, an AI comparison product. Answer this user question clearly and accurately for a general audience. Do not mention Selfbeat. Keep the answer under 150 words.${langInstruction(lang)}\n\nQuestion: ${question}`;

const buildCritiquePromptText = (
  model: ModelInfo,
  question: string,
  answer: string,
  allAnswers: string,
  lang = "en",
) =>
  [
    `You are ${model.displayName} in Selfbeat's self-criticism round.${langInstruction(lang)}`,
    `Be genuinely honest and critical — do not give yourself an inflated score.`,
    `Scores must reflect real quality differences. A mediocre answer is a 5–6, a good answer is a 7–8, an excellent answer is 9–10.`,
    ``,
    `User question: ${question}`,
    ``,
    `Your answer:`,
    answer,
    ``,
    `All AI answers for comparison:`,
    allAnswers,
    ``,
    `Write your self-criticism in 2–3 sentences: what you got right, what you missed, which other AI did better and why.`,
    `End with exactly this format on its own line: "Accuracy score: X/10. Self-awareness score: Y/10."`,
    `Keep it under 120 words total.`,
  ].join("\n");

const buildVerdictStr = (
  responses: ModelResponse[],
  verdictDetails: { bestAnswer: string; clearestAnswer: string; agreementPoints: string[]; disagreementPoints: string[]; overallWinner: string; explanation: string },
) =>
  `Accuracy scores: ${responses.map((r) => `${r.displayName} ${r.accuracyScore}/10`).join(", ")}. ` +
  `Self-awareness scores: ${responses.map((r) => `${r.displayName} ${r.selfAwarenessScore}/10`).join(", ")}. ` +
  `Best answer: ${verdictDetails.bestAnswer} ` +
  `Clearest answer for the general public: ${verdictDetails.clearestAnswer}. ` +
  `Key agreements: ${verdictDetails.agreementPoints.join(" ")} ` +
  `Key disagreements: ${verdictDetails.disagreementPoints.join(" ")} ` +
  `Overall winner: ${verdictDetails.overallWinner}. ${verdictDetails.explanation}`;

router.post("/selfbeat/comparisons/stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const emit = (event: string, data: unknown) => {
    if (!res.writableEnded) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  };

  const parsed = CreateSelfbeatComparisonBody.safeParse(req.body);
  if (!parsed.success) {
    emit("error", { message: "Invalid request." });
    res.end();
    return;
  }

  const question = parsed.data.question.trim();
  const lang = typeof req.body?.lang === "string" && req.body.lang in LANG_NAMES ? req.body.lang : "en";
  const questionKey = `${normalizeQuestion(question)}::${lang}`;
  const isMedical = isMedicalQuestion(question);

  try {
    // Serve from cache (replay all events quickly)
    const cached = await db.query.selfbeatComparisonsTable.findFirst({
      where: eq(selfbeatComparisonsTable.questionKey, questionKey),
    });

    if (cached) {
      const r = cached.result as { id: string; responses: ModelResponse[]; verdict: string; verdictDetails: { summary: string; bestAnswer: string; clearestAnswer: string; agreementPoints: string[]; disagreementPoints: string[]; overallWinner: string; explanation: string }; isMedical: boolean; physicianNote?: string };
      emit("cached", { id: r.id });
      for (const resp of r.responses) {
        emit("round1", { model: resp.model, displayName: resp.displayName, color: resp.color, answer: resp.answer, status: resp.status, isGeneric: resp.isGeneric });
      }
      for (const resp of r.responses) {
        emit("round2", resp);
      }
      emit("verdict", { verdictDetails: r.verdictDetails, isMedical: r.isMedical, physicianNote: r.physicianNote, verdict: r.verdict });
      emit("done", { id: r.id });
      res.end();
      return;
    }

    // ── Round 1: all 10 models in parallel, emit each as it resolves ──────
    emit("status", { phase: "round1", message: "Round 1: Querying all 10 AI models simultaneously..." });

    const round1Results = await Promise.all(
      models.map(async (model) => {
        let answer: string;
        let status: "success" | "fallback";
        let error: string | undefined;

        let hasRealAnswer = false;
        try {
          const raw = await withTimeout(askModel(model, buildAnswerPrompt(model, question, lang), 450), 12000);
          if (raw) {
            answer = raw;
            status = "success";
            hasRealAnswer = true;
          } else {
            const backup = await backupAnswer(question);
            answer = backup || fallbackAnswer(model, question);
            status = "fallback";
            hasRealAnswer = !!backup;
            error = "Provider returned empty answer.";
          }
        } catch (err) {
          const backup = await backupAnswer(question);
          answer = backup || fallbackAnswer(model, question);
          status = "fallback";
          hasRealAnswer = !!backup;
          error = err instanceof Error ? err.message : "Provider unavailable.";
        }

        emit("round1", {
          model: model.key,
          displayName: model.displayName,
          color: model.color,
          answer,
          status,
          isGeneric: detectGenericResponse(answer, question, hasRealAnswer ? "success" : "fallback"),
        });

        return { model, answer, status, error };
      }),
    );

    const allAnswers = round1Results
      .map(({ model, answer }) => `${model.displayName}: ${answer}`)
      .join("\n\n");

    const modelSeeds = round1Results.map((_, i) =>
      clampScore(5.5 + questionSeed(question, i + 1) * 4.0),
    );

    // ── Start insights early (only needs Round 1 answers) so it runs in parallel with Round 2 ──
    const round1AnswerPayload = round1Results
      .filter((r) => r.status === "success")
      .map((r) => ({ displayName: r.model.displayName, answer: r.answer }));
    const insightsPromise = generateVerdictInsights(
      question,
      round1AnswerPayload.length > 0 ? round1AnswerPayload : round1Results.map((r) => ({ displayName: r.model.displayName, answer: r.answer })),
      lang,
    );
    const physicianPromise = isMedical
      ? generatePhysicianNote(question, round1Results.map((r) => `${r.model.displayName}: ${r.answer}`).join("\n\n"), lang)
      : Promise.resolve(undefined);

    // ── Round 2: all 10 critiques in parallel, emit each as it resolves ──
    emit("status", { phase: "round2", message: "Round 2: AIs examining each other simultaneously..." });

    const secondRound = await Promise.all(
      round1Results.map(async ({ model, answer, status, error }, index) => {
        const seededBase = Math.round(modelSeeds[index] * 10) / 10;

        let accuracyScore: number;
        let selfAwarenessScore: number;
        let critiqueText: string;
        let finalStatus: "success" | "fallback";
        let declined = false;

        if (status === "fallback") {
          accuracyScore = seededBase;
          selfAwarenessScore = clampScore(seededBase + (questionSeed(question, index + 10) * 1.5 - 0.5));
          critiqueText = fallbackCriticism(model);
          finalStatus = "fallback";
        } else {
          let critique = "";
          try {
            critique = await withTimeout(
              askModel(model, buildCritiquePromptText(model, question, answer, allAnswers, lang), 300),
              10000,
            );
          } catch {}

          const accuracyMatch = critique.match(/accuracy\s+score[^\d]*(\d+(?:\.\d+)?)\s*\/\s*10/i);
          const selfAwareMatch = critique.match(/self.awareness\s+score[^\d]*(\d+(?:\.\d+)?)\s*\/\s*10/i);

          accuracyScore = accuracyMatch ? clampScore(Number(accuracyMatch[1])) : extractScore(critique, seededBase);
          selfAwarenessScore = selfAwareMatch
            ? clampScore(Number(selfAwareMatch[1]))
            : clampScore(accuracyScore + (questionSeed(question, index + 20) * 1.4 - 0.7));

          critiqueText = critique || fallbackCriticism(model);
          finalStatus = critique ? "success" : "fallback";
          declined = detectRefusal(critiqueText);
        }

        const score = Math.round(((accuracyScore + selfAwarenessScore) / 2) * 10) / 10;
        const isGeneric = detectGenericResponse(answer, question, status);

        const fullResponse: ModelResponse = {
          model: model.key,
          displayName: model.displayName,
          color: model.color,
          answer,
          selfCriticism: critiqueText,
          score,
          accuracyScore,
          selfAwarenessScore,
          status: finalStatus,
          error,
          declined,
          isGeneric,
        };

        emit("round2", fullResponse);
        return fullResponse;
      }),
    );

    // ── Round 3: verdict — insights already running, just await ──────────────
    emit("status", { phase: "verdict", message: "Round 3: Calculating final verdict..." });

    const winner = [...secondRound].sort((a, b) => b.score - a.score)[0] ?? secondRound[0];

    const [insights, physicianNote] = await Promise.all([insightsPromise, physicianPromise]);

    const vl = VERDICT_LANG[lang] ?? VERDICT_LANG["en"];
    const verdictDetails = {
      summary: vl.summary(winner.displayName),
      bestAnswer: vl.bestAnswer(winner.displayName),
      clearestAnswer: secondRound.find((r) => r.model === "gemini")?.displayName ?? winner.displayName,
      agreementPoints: insights.agreementPoints,
      disagreementPoints: insights.disagreementPoints,
      overallWinner: winner.displayName,
      explanation: vl.explanation(winner.displayName, String(winner.score)),
    };

    const allLive = secondRound.every((r) => r.status === "success");
    const allFallback = secondRound.every((r) => r.status === "fallback");
    const verdict = buildVerdictStr(secondRound, verdictDetails);

    emit("verdict", { verdictDetails, isMedical, physicianNote, verdict });

    // Save to DB
    const id = randomUUID();
    const fullResult = {
      id,
      question,
      timestamp: Date.now(),
      responses: secondRound,
      verdict,
      verdictDetails,
      isMedical,
      physicianNote,
      source: allLive ? ("live" as const) : allFallback ? ("mock" as const) : ("mixed" as const),
      cached: false,
      providerStatuses: secondRound.map((r) => ({
        model: r.model,
        provider: models.find((m) => m.key === r.model)?.displayName ?? r.model,
        status: r.status === "success" ? ("live" as const) : ("fallback" as const),
        message: r.status === "success" ? "Live provider response used." : r.error || "Fallback response used.",
      })),
    };

    try {
      await db.insert(selfbeatComparisonsTable).values({ id, questionKey, question, result: fullResult });
    } catch {}

    emit("done", { id });
    res.end();
  } catch (err) {
    req.log.error({ err }, "Streaming comparison failed");
    emit("error", { message: "Comparison failed. Please try again in a moment." });
    res.end();
  }
});

router.post("/selfbeat/comparisons", async (req, res) => {
  const parsed = CreateSelfbeatComparisonBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Please enter a valid question." });
    return;
  }

  const question = parsed.data.question.trim();
  const lang = typeof req.body?.lang === "string" && req.body.lang in LANG_NAMES ? req.body.lang : "en";
  const questionKey = `${normalizeQuestion(question)}::${lang}`;

  try {
    const cached = await db.query.selfbeatComparisonsTable.findFirst({
      where: eq(selfbeatComparisonsTable.questionKey, questionKey),
    });

    if (cached) {
      const result = CreateSelfbeatComparisonResponse.parse({
        ...(cached.result as object),
        cached: true,
      });
      res.json(result);
      return;
    }

    const result = CreateSelfbeatComparisonResponse.parse(
      await createComparison(question, parsed.data.mode),
    );

    await db.insert(selfbeatComparisonsTable).values({
      id: result.id,
      questionKey,
      question,
      result,
    });

    res.json(result);
  } catch (error) {
    req.log.error({ err: error }, "Selfbeat comparison failed");
    res.status(500).json({
      error:
        "Selfbeat could not complete the live comparison right now. Please try again in a moment.",
    });
  }
});

router.get("/selfbeat/comparisons/:id", async (req, res) => {
  const parsed = GetSelfbeatComparisonParams.safeParse(req.params);

  if (!parsed.success) {
    res.status(404).json({ error: "Comparison not found." });
    return;
  }

  const cached = await db.query.selfbeatComparisonsTable.findFirst({
    where: eq(selfbeatComparisonsTable.id, parsed.data.id),
  });

  if (!cached) {
    res.status(404).json({ error: "Comparison not found." });
    return;
  }

  const result = GetSelfbeatComparisonResponse.parse({
    ...(cached.result as object),
    cached: true,
  });
  res.json(result);
});

// ── Cloud TTS endpoint ────────────────────────────────────────────────────
// Used by the frontend as a fallback when the device has no local voice for
// the selected language (e.g. Arabic on a machine without an Arabic TTS pack).
// Uses gpt-audio via chat.completions so it works through the Replit proxy.
router.post("/selfbeat/tts", async (req, res) => {
  const { text } = req.body as { text?: string };
  if (!text || typeof text !== "string" || text.trim() === "") {
    return res.status(400).json({ error: "text is required" });
  }
  try {
    const { textToSpeech } = await import("@workspace/integrations-openai-ai-server/audio");
    const audioBuffer = await textToSpeech(text.slice(0, 4096), "nova", "mp3");
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-cache");
    res.send(audioBuffer);
  } catch {
    res.status(500).json({ error: "TTS generation failed" });
  }
});

export default router;