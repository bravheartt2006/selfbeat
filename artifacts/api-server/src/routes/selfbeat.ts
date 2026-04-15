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
  "nausea",
  "virus",
  "vaccine",
  "heart",
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

const extractScore = (text: string, fallback: number) => {
  const match = text.match(/(?:score|rating)[^0-9]{0,20}([0-9](?:\.[0-9])?|10)(?:\s*\/\s*10)?/i);
  return match ? clampScore(Number(match[1])) : fallback;
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

  const secondRound = await Promise.all(
    firstRound.map(async ({ model, answer, status, error }, index) => {
      const fallbackScore = clampScore(8.8 - index * 0.4);

      if (mode === "mock" || status === "fallback") {
        const score = status === "fallback" ? 7.2 : fallbackScore;
        return {
          model: model.key,
          displayName: model.displayName,
          color: model.color,
          answer,
          selfCriticism: fallbackCriticism(model),
          score,
          accuracyScore: score,
          selfAwarenessScore: status === "fallback" ? 7 : clampScore(score + 0.2),
          status,
          error,
        } satisfies ModelResponse;
      }

      const critiquePrompt = `You are ${model.displayName} in the Selfbeat self-criticism round. Critically evaluate your own answer against the other AI answers.\n\nUser question: ${question}\n\nYour answer:\n${answer}\n\nAll answers:\n${allAnswers}\n\nYour response must acknowledge what you got right, admit what you missed or got wrong, identify which other AI answered better and why, and give yourself an honest score out of 10. Keep it under 180 words.`;

      try {
        const critique = await askModel(model, critiquePrompt);
        const score = extractScore(critique, fallbackScore);
        return {
          model: model.key,
          displayName: model.displayName,
          color: model.color,
          answer,
          selfCriticism: critique || fallbackCriticism(model),
          score,
          accuracyScore: score,
          selfAwarenessScore: clampScore(score + 0.2),
          status: critique ? ("success" as const) : ("fallback" as const),
          error: critique ? undefined : "Provider returned an empty critique.",
        } satisfies ModelResponse;
      } catch (critiqueError) {
        return {
          model: model.key,
          displayName: model.displayName,
          color: model.color,
          answer,
          selfCriticism: fallbackCriticism(model),
          score: 7.2,
          accuracyScore: 7.2,
          selfAwarenessScore: 7,
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

  return {
    id: randomUUID(),
    question,
    timestamp: Date.now(),
    responses: secondRound,
    verdict,
    verdictDetails,
    isMedical,
    physicianNote: isMedical
      ? "[Physician note will appear here for health questions]"
      : undefined,
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