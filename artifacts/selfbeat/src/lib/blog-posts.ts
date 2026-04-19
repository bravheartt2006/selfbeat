export type BlogPost = {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  metaDescription: string;
  content: string;
};

// ─── Add new posts by appending to this array ─────────────────────────────────
// Content supports basic HTML tags: <p>, <h2>, <h3>, <ul>, <li>, <strong>, <em>, <blockquote>

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "introducing-selfbeat",
    title: "Introducing Selfbeat: Where AI Meets Its Match",
    date: "April 10, 2026",
    excerpt:
      "We built Selfbeat because we kept noticing something: AI models sound confident even when they are wrong. What happens when you force them to evaluate their own answers?",
    metaDescription:
      "We built Selfbeat to find out what happens when AI models are forced to evaluate their own answers. The results reveal something important.",
    content: `
      <p>We built Selfbeat because we kept noticing something uncomfortable: AI models sound confident even when they are wrong. They do not hedge. They do not say "I am not sure." They give you an answer, and they give it with the same polished certainty whether they are correct or completely off base.</p>

      <p>As a physician, that pattern is dangerous. A patient does not know whether an AI is giving them a textbook-accurate answer or a plausible-sounding mistake. And neither, frankly, do most developers who ship AI-powered tools.</p>

      <h2>The idea behind Selfbeat</h2>

      <p>The core idea is simple: if a model is confident, it should be able to defend its answer when challenged by a peer. Selfbeat puts eleven AI models in the same room, asks them all the same question, and then makes each one read and critique every other answer.</p>

      <p>The result is Round 2 — the self-critique phase. Each model re-reads the full set of responses and then evaluates its own accuracy, reasoning quality, and self-awareness. We score each model on these dimensions and produce a final verdict.</p>

      <h2>Why eleven models?</h2>

      <p>The current lineup includes ChatGPT, Claude, Gemini, DeepSeek, Grok, Mistral Large, Llama 3.3, Perplexity Sonar, Cohere Command R+, Qwen, and Yi. We chose these models because they represent a genuine spread: different training data, different architectures, different company philosophies about how an AI should behave.</p>

      <p>When they all agree on an answer, that agreement is meaningful. When they diverge, that divergence tells you something important about the difficulty of the question and the limits of the technology.</p>

      <h2>What we found in testing</h2>

      <p>Some results surprised us. On medical questions, models that gave confident first-round answers often gave the most honest self-critiques — acknowledging the limits of their training and recommending physician consultation. On factual questions with a clear right answer, the spread in scores was enormous. The best-performing models were not always the most famous ones.</p>

      <p>That is the whole point. Selfbeat gives you a way to see beyond the marketing and into the actual performance.</p>

      <blockquote>Where AI meets its match — itself.</blockquote>

      <p>We are just getting started. The leaderboard will grow. The models will change. And the questions users bring to Selfbeat will continue to surprise us. We hope you find it as revealing as we do.</p>
    `,
  },
  {
    slug: "why-ai-models-disagree",
    title: "Why AI Models Give Different Answers to the Same Question",
    date: "April 14, 2026",
    excerpt:
      "Ask eleven AI models the same question and you will rarely get the same answer twice. Understanding why tells you something important about the limits of every AI tool you use.",
    metaDescription:
      "Ask eleven AI models the same question and they rarely agree. Understanding why reveals the real limits of every AI tool you rely on.",
    content: `
      <p>Ask eleven AI models the same question and you will rarely get the same answer twice. Sometimes the differences are minor — a word choice, a level of detail. Sometimes they are fundamental: different facts, different recommendations, even different conclusions about what the question is asking.</p>

      <p>This is not a bug. It is a feature of how large language models work. But it has real consequences for anyone who relies on AI for decisions that matter.</p>

      <h2>Three reasons models disagree</h2>

      <h3>1. Different training data</h3>
      <p>Every model is trained on a different corpus of text, curated by a different team with different priorities. A model trained heavily on academic papers will respond to a medical question differently from one trained on web content. The raw knowledge base differs, and so do the answers.</p>

      <h3>2. Different alignment tuning</h3>
      <p>After pre-training, models go through a fine-tuning phase designed to make them helpful, safe, and honest. Different companies have different definitions of those words. One company might train its model to give direct answers; another might train for caution and hedging. These choices show up clearly when you compare outputs side by side.</p>

      <h3>3. Temperature and sampling</h3>
      <p>Language models are probabilistic. Even the same model, given the same prompt, can produce different answers on different runs. Some of what looks like disagreement between models is actually just variance in the sampling process — the model picking a different path through its probability distribution.</p>

      <h2>What disagreement tells you</h2>

      <p>When we run a question through Selfbeat and the eleven models cluster around the same answer, that consensus is worth something. It suggests the answer is well-established in the training data and that multiple independent architectures have converged on the same conclusion.</p>

      <p>When the models scatter — giving contradictory answers, refusing to commit, or producing wildly different levels of detail — that scatter is itself informative. It usually means one of three things: the question is genuinely hard, the evidence base is contested, or the models do not have reliable information and are filling gaps with plausible-sounding text.</p>

      <h2>The self-critique layer</h2>

      <p>This is why Selfbeat adds Round 2. Seeing the raw answers is useful. But watching each model evaluate its own response in light of what the others said is more useful still. A model that gave a confident answer and then hedges significantly in its self-critique is telling you something. A model that reads ten other responses and still defends its original answer is telling you something different.</p>

      <p>The disagreements between models are not noise to be averaged away. They are signal. Selfbeat is built to surface that signal clearly.</p>
    `,
  },
  {
    slug: "medical-ai-accuracy",
    title: "The Medical AI Problem: Why Confidence Is Not the Same as Correctness",
    date: "April 17, 2026",
    excerpt:
      "AI models give medical advice with startling confidence. I find that gap between confidence and correctness one of the most important problems in technology today.",
    metaDescription:
      "AI models give medical advice with startling confidence. I explain why the gap between confidence and correctness is so dangerous.",
    content: `
      <p>I am a physician. I have spent years learning how to communicate uncertainty to patients — how to say "the evidence suggests" instead of "you definitely have" and "we should consider" instead of "you must." That vocabulary of calibrated uncertainty is a core clinical skill. It protects patients from overconfident recommendations.</p>

      <p>AI models, by and large, have not learned this skill. They give medical answers with startling confidence. They do not say "I am not sure." They do not say "this is an area where the evidence is contested." They say: here is your answer.</p>

      <h2>The confidence problem</h2>

      <p>When we tested Selfbeat on a set of medical questions, the results were striking. In Round 1 — the initial answers — most models responded confidently and at length. The answers were often accurate on the surface. They used correct terminology. They mentioned the right conditions and the right drug names.</p>

      <p>But in Round 2, when models were forced to critique their own answers, the picture changed. Several models acknowledged that their initial response had not adequately flagged the need for professional medical consultation. Some noted that they had presented contested evidence as settled fact. A few explicitly downgraded the confidence level of their own earlier answer.</p>

      <p>That gap between the Round 1 answer and the Round 2 self-critique is one of the most important things Selfbeat measures.</p>

      <h2>Why this matters</h2>

      <p>A patient searching for health information does not get a Round 2. They get the first answer. And if that answer sounds confident and specific, they are likely to trust it — even if a self-aware model would have hedged significantly when given the chance.</p>

      <p>This is not a reason to avoid AI tools for health information. Good AI can be extraordinarily useful: it can explain conditions clearly, help patients formulate questions for their doctors, and surface relevant information quickly. The problem is not capability. It is calibration.</p>

      <h2>What to look for</h2>

      <p>When you use an AI for any health-related question, watch for a few things. Does the model acknowledge the limits of its knowledge? Does it recommend consulting a professional? Does it distinguish between well-established medical consensus and areas where evidence is still developing?</p>

      <p>On Selfbeat, you can see how eleven different models handle these signals — and then see how honestly each one evaluates itself. That comparison is more informative than any single answer.</p>

      <blockquote>The goal of Selfbeat is not to replace clinical judgment. It is to give you a clearer view of what AI actually knows — and what it only thinks it knows.</blockquote>
    `,
  },
  {
    slug: "how-selfbeat-scoring-works",
    title: "How Selfbeat Scores AI Models",
    date: "April 19, 2026",
    excerpt:
      "Every Selfbeat comparison ends with a leaderboard and a score for each model. Here is exactly what those numbers mean and how we calculate them.",
    metaDescription:
      "Every Selfbeat comparison ends with scores and a verdict. Here is exactly what those numbers mean and how accuracy and self-awareness are measured.",
    content: `
      <p>Every Selfbeat comparison ends with a ranked leaderboard. Each model gets a score out of ten, and the final verdict names an overall winner. A lot of work goes into producing those numbers. Here is exactly what they mean.</p>

      <h2>Two scores, one total</h2>

      <p>Each model is evaluated on two dimensions in Round 2:</p>

      <ul>
        <li><strong>Accuracy</strong> — How correct and well-supported was the original answer? Does it align with established knowledge? Is the reasoning sound?</li>
        <li><strong>Self-awareness</strong> — How honestly did the model evaluate its own response? Did it identify genuine weaknesses, or did it give itself a pass? Did it acknowledge uncertainty where uncertainty was warranted?</li>
      </ul>

      <p>These two scores are combined into a composite score out of ten. Neither dimension is weighted more heavily than the other — a model that gives a brilliant answer but then refuses to acknowledge any of its limitations will score lower than a model that gave a slightly weaker answer but evaluated it honestly.</p>

      <h2>Why self-awareness matters</h2>

      <p>Most AI benchmarks measure accuracy alone. They ask: did the model get the right answer? That is important, but it misses something. In practice, you often cannot verify whether an AI answer is correct. You are trusting the model's judgment.</p>

      <p>Self-awareness measures something different: does the model know when it is uncertain? A model that says "I am confident in this answer" when the evidence is mixed is more dangerous than a model that gets the answer slightly wrong but flags the uncertainty. Selfbeat rewards calibration, not just correctness.</p>

      <h2>The verdict</h2>

      <p>Beyond individual scores, the final verdict synthesizes the full picture. It identifies where the models agreed — which usually means the answer is reliable — and where they diverged, which usually means the question is contested or the models lacked good information.</p>

      <p>The verdict names an overall winner: the model with the best combined score. But it also notes the best answer on accuracy alone and the clearest, most accessible explanation. Different users have different priorities, and the verdict is designed to surface all of them.</p>

      <h2>What the scores cannot tell you</h2>

      <p>The scores reflect one comparison, on one question, at one moment in time. Models are updated regularly. A model that performs well on a factual question may perform poorly on a nuanced ethical one. We encourage users to run multiple comparisons and to use the leaderboard as a starting point, not a final verdict on any model's overall quality.</p>

      <p>The point of Selfbeat is not to declare a permanent winner. It is to give you a structured, honest view of how AI models perform on the specific questions you care about.</p>
    `,
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
