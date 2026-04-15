import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Brain, Zap, MessageSquare } from "lucide-react";

export default function Leaderboard() {
  const models = [
    { name: "Claude 3.5 Sonnet", wins: 142, color: "text-[hsl(15_54%_58%)]", bg: "bg-[hsl(15_54%_58%)]/10" },
    { name: "GPT-4o", wins: 138, color: "text-[hsl(165_82%_35%)]", bg: "bg-[hsl(165_82%_35%)]/10" },
    { name: "Gemini 1.5 Pro", wins: 94, color: "text-[hsl(217_89%_61%)]", bg: "bg-[hsl(217_89%_61%)]/10" },
    { name: "DeepSeek Coder V2", wins: 87, color: "text-[hsl(248_80%_67%)]", bg: "bg-[hsl(248_80%_67%)]/10" }
  ];

  return (
    <div className="container py-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 font-serif">Global Leaderboard</h1>
        <p className="text-xl text-muted-foreground">Tracking AI performance, honesty, and self-awareness.</p>
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
              <div className="space-y-6">
                {models.map((model, i) => (
                  <div key={model.name} className="flex items-center gap-4">
                    <div className="w-8 text-center font-bold text-lg text-muted-foreground">
                      #{i + 1}
                    </div>
                    <div className={`flex-1 p-4 rounded-lg flex justify-between items-center ${model.bg} border border-transparent hover:border-current/20 transition-colors`}>
                      <span className={`font-semibold ${model.color}`}>{model.name}</span>
                      <span className="font-mono text-foreground/80">{model.wins} wins</span>
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
                <p className="text-sm text-muted-foreground">Highest average critique score</p>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-[hsl(15_54%_58%)]">Claude 3.5 Sonnet</div>
                <div className="text-sm font-mono mt-1 text-muted-foreground">Avg Score: 92.4</div>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Most Improved</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground">Largest delta between R1 and R2</p>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-[hsl(165_82%_35%)]">GPT-4o</div>
                <div className="text-sm font-mono mt-1 text-muted-foreground">+14.2 pt average gain</div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="border-primary/30 bg-primary/5 h-full">
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
                <div className="text-sm text-[hsl(248_80%_67%)] uppercase tracking-wider font-semibold">DeepSeek's Self-Critique</div>
                <div className="p-4 rounded-lg bg-[hsl(248_80%_67%)]/10 border border-[hsl(248_80%_67%)]/20 text-sm leading-relaxed">
                  "My initial response completely failed the assignment. I used terms like 'superposition' and 'subatomic particles.' A 5-year-old does not know what a subatomic particle is. Claude's analogy using matching magic mittens was vastly superior and age-appropriate. I was pedantic and useless in this context."
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
