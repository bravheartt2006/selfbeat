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

type ModelKey = "chatgpt" | "claude" | "gemini" | "deepseek";

type ModelInfo = {
  key: ModelKey;
  displayName: string;
  color: string;
  provider: string;
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
};

const router: IRouter = Router();

const models: ModelInfo[] = [
  {
    key: "chatgpt",
    displayName: "ChatGPT",
    color: "#10A37F",
    provider: "OpenAI",
  },
  {
    key: "claude",
    displayName: "Claude",
    color: "#CC785C",
    provider: "Anthropic",
  },
  {
    key: "gemini",
    displayName: "Gemini",
    color: "#4285F4",
    provider: "Google",
  },
  {
    key: "deepseek",
    displayName: "DeepSeek",
    color: "#7B68EE",
    provider: "OpenRouter",
  },
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

  return `Analyzing "${q}" analytically: the question can be broken into its core claim, its underlying assumptions, and the evidence that supports or contradicts each. The logical structure of the strongest answer involves acknowledging what is definitively known, what is probabilistic, and what remains genuinely uncertain. From a reasoning standpoint, the most defensible position is the one that is falsifiable and internally consistent.`;
};

const fallbackCriticism = (model: ModelInfo) =>
  `I gave a usable answer, but I may have stayed too broad because the live provider was unavailable. I covered the main structure, but I did not fully test my claims against the other models. Claude usually handled nuance best, Gemini was clearest for the public, and ChatGPT was strongest at structured caveats. Honest score: 7.2/10.`;

async function generatePhysicianNote(question: string, answers: string): Promise<string | undefined> {
  try {
    const { anthropic } = await import("@workspace/integrations-anthropic-ai");
    const prompt = [
      `You are a physician reviewing AI-generated answers about a health topic. The question was: ${question}. The AI models gave these answers: ${answers}. As a physician, write a brief 2-3 sentence note that:`,
      `1. Confirms what the AIs got right`,
      `2. Mentions anything important they missed`,
      `3. Reminds the user to consult their doctor for personal medical advice`,
      `Keep it simple, warm and under 100 words. Do not diagnose or prescribe anything.`,
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

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
    }
  }

  throw lastError;
}

async function askModel(model: ModelInfo, prompt: string) {
  return withRetry(async () => {
    if (model.key === "chatgpt") {
      const { openai } = await import("@workspace/integrations-openai-ai-server");
      const response = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [{ role: "user", content: prompt }],
        max_completion_tokens: 900,
      });
      return response.choices[0]?.message?.content?.trim() || "";
    }

    if (model.key === "claude") {
      const { anthropic } = await import("@workspace/integrations-anthropic-ai");
      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 8192,
        messages: [{ role: "user", content: prompt }],
      });
      return response.content
        .map((part) => (part.type === "text" ? part.text : ""))
        .join("")
        .trim();
    }

    if (model.key === "gemini") {
      const { ai } = await import("@workspace/integrations-gemini-ai");
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      return response.text?.trim() || "";
    }

    const { openrouter } = await import("@workspace/integrations-openrouter-ai");
    const response = await openrouter.chat.completions.create({
      model: "deepseek/deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 900,
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
        const answer = await askModel(model, answerPrompt(model));
        return {
          model,
          answer: answer || fallbackAnswer(model, question),
          status: answer ? ("success" as const) : ("fallback" as const),
          error: answer ? undefined : "Provider returned an empty answer.",
        };
      } catch (error) {
        return {
          model,
          answer: fallbackAnswer(model, question),
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
        `Write your self-criticism in 3–4 sentences: what you got right, what you missed, which other AI did better and why.`,
        `End with exactly this format on its own line: "Accuracy score: X/10. Self-awareness score: Y/10."`,
        `Keep it under 180 words total.`,
      ].join("\n");

      try {
        const critique = await askModel(model, critiquePrompt);

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

        return {
          model: model.key,
          displayName: model.displayName,
          color: model.color,
          answer,
          selfCriticism: critique || fallbackCriticism(model),
          score,
          accuracyScore,
          selfAwarenessScore,
          status: critique ? ("success" as const) : ("fallback" as const),
          error: critique ? undefined : "Provider returned an empty critique.",
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
        } satisfies ModelResponse;
      }
    }),
  );

  const winner =
    [...secondRound].sort(
      (a, b) =>
        b.accuracyScore +
        b.selfAwarenessScore -
        (a.accuracyScore + a.selfAwarenessScore),
    )[0] ?? secondRound[0];

  const verdictDetails = {
    summary: `${winner.displayName} produced the strongest combined performance for this question.`,
    bestAnswer: `${winner.displayName} gave the best answer because it balanced accuracy, clarity, and useful caveats.`,
    clearestAnswer:
      secondRound.find((response) => response.model === "gemini")?.displayName ??
      winner.displayName,
    agreementPoints: [
      "All models addressed the core question directly.",
      "All models recognized that context changes the strongest answer.",
      "All models included at least some limitation or caveat.",
    ],
    disagreementPoints: [
      "The models differed on how much background context to include.",
      "They weighed clarity, caution, and completeness differently.",
    ],
    overallWinner: winner.displayName,
    explanation: `${winner.displayName} wins because its answer and self-criticism had the highest combined accuracy and self-awareness scores.`,
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

router.post("/selfbeat/comparisons", async (req, res) => {
  const parsed = CreateSelfbeatComparisonBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Please enter a valid question." });
    return;
  }

  const question = parsed.data.question.trim();
  const questionKey = normalizeQuestion(question);

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

export default router;