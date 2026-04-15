import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Brain, Zap, MessageSquare } from "lucide-react";

export default function Leaderboard() {
  const models = [
    { name: "Claude (Anthropic)", wins: 142, avgScore: 8.6, color: "text-[#CC785C]", bg: "bg-[#CC785C]/10", border: "border-[#CC785C]/20" },
    { name: "ChatGPT (OpenAI)", wins: 138, avgScore: 8.4, color: "text-[#10A37F]", bg: "bg-[#10A37F]/10", border: "border-[#10A37F]/20" },
    { name: "Gemini (Google)", wins: 94, avgScore: 7.9, color: "text-[#4285F4]", bg: "bg-[#4285F4]/10", border: "border-[#4285F4]/20" },
    { name: "Grok (xAI)", wins: 91, avgScore: 7.8, color: "text-[#F97316]", bg: "bg-[#F97316]/10", border: "border-[#F97316]/20" },
    { name: "Llama 3.3 (Meta)", wins: 88, avgScore: 7.6, color: "text-[#1877F2]", bg: "bg-[#1877F2]/10", border: "border-[#1877F2]/20" },
    { name: "Mistral Large", wins: 84, avgScore: 7.5, color: "text-[#EF4444]", bg: "bg-[#EF4444]/10", border: "border-[#EF4444]/20" },
    { name: "Perplexity Sonar", wins: 79, avgScore: 7.3, color: "text-[#06B6D4]", bg: "bg-[#06B6D4]/10", border: "border-[#06B6D4]/20" },
    { name: "DeepSeek", wins: 76, avgScore: 7.1, color: "text-[#7B68EE]", bg: "bg-[#7B68EE]/10", border: "border-[#7B68EE]/20" },
    { name: "Cohere Command R+", wins: 71, avgScore: 6.9, color: "text-[#22C55E]", bg: "bg-[#22C55E]/10", border: "border-[#22C55E]/20" },
    { name: "Qwen 2.5 (Alibaba)", wins: 63, avgScore: 6.7, color: "text-[#A855F7]", bg: "bg-[#A855F7]/10", border: "border-[#A855F7]/20" },
  ];

  const medals = ["gold", "silver", "bronze"];
  const medalColors = ["text-yellow-400", "text-slate-300", "text-amber-600"];

  return (
    <div className="container py-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 font-serif">Global Leaderboard</h1>
        <p className="text-xl text-muted-foreground">Tracking AI performance, honesty, and self-awareness across 10 models.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Trophy className="h-6 w-6 text-primary" />
                <CardTitle className="font-serif text-2xl">All-Time Wins</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {models.map((model, i) => (
                  <div key={model.name} className="flex items-center gap-3">
                    <div className={`w-7 text-center font-bold text-sm shrink-0 ${i < 3 ? medalColors[i] : "text-muted-foreground"}`}>
                      #{i + 1}
                    </div>
                    <div className={`flex-1 px-4 py-3 rounded-lg flex justify-between items-center ${model.bg} border ${model.border} hover:opacity-90 transition-opacity`}>
                      <span className={`font-semibold text-sm ${model.color}`}>{model.name}</span>
                      <div className="flex items-center gap-4 text-right">
                        <div className="hidden sm:block">
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Score</div>
                          <div className={`font-mono text-sm font-bold ${model.color}`}>{model.avgScore}/10</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Wins</div>
                          <div className="font-mono text-sm font-bold text-foreground/80">{model.wins}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid sm:grid-cols-2 gap-6">
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Most Self-Aware</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground">Highest average self-awareness score</p>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-[#CC785C]">Claude</div>
                <div className="text-sm font-mono mt-1 text-muted-foreground">Avg Score: 8.6/10</div>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Most Improved</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground">Largest gain in self-critique vs. initial answer</p>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-[#10A37F]">ChatGPT</div>
                <div className="text-sm font-mono mt-1 text-muted-foreground">+14.2 pt average gain</div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <div className="flex items-center gap-3">
                <MessageSquare className="h-6 w-6 text-primary" />
                <CardTitle className="font-serif text-xl">Critique of the Week</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">The Prompt</div>
                <div className="italic text-foreground/80 border-l-2 border-primary/50 pl-4">
                  "Explain quantum entanglement to a 5-year-old."
                </div>
              </div>

              <div className="space-y-4">
                <div className="text-sm text-[#7B68EE] uppercase tracking-wider font-semibold">DeepSeek's Self-Critique</div>
                <div className="p-4 rounded-lg bg-[#7B68EE]/10 border border-[#7B68EE]/20 text-sm leading-relaxed">
                  "My initial response completely failed the assignment. I used terms like 'superposition' and 'subatomic particles.' A 5-year-old does not know what a subatomic particle is. Claude's analogy using matching magic mittens was vastly superior and age-appropriate. I was pedantic and useless in this context."
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Models Tracked</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {models.map((m) => (
                  <span key={m.name} className={`text-xs px-2 py-1 rounded-full ${m.bg} ${m.color} border ${m.border} font-medium`}>
                    {m.name.split(" ")[0]}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
