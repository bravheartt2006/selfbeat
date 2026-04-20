import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Target, Lightbulb } from "lucide-react";
import { SelfbeatLogo } from "@/components/SelfbeatLogo";

export default function About() {
  return (
    <div className="container py-16 max-w-4xl animate-in fade-in slide-in-from-bottom-8 duration-700">

      {/* Header */}
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-bold mb-6 font-serif">About Selfbeat</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Founded with care and a commitment to honesty — built for people who want real answers from AI, not just confident ones. We believe the best way to test an AI is to make it answer for itself.
        </p>
      </div>

      {/* Sections 1 & 2 */}
      <div className="grid gap-8 md:grid-cols-2 mb-16">
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <ShieldCheck className="h-8 w-8 text-primary mb-4" />
            <CardTitle className="font-serif text-2xl">The Problem</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground leading-relaxed">
            Standard AI benchmarks are sterile and easily gamed. When users ask questions, models often project absolute certainty, hiding their flaws, biases, and blind spots. There is no built-in mechanism for accountability or self-reflection in standard chat interfaces. You get an answer. You rarely get the truth.
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <Target className="h-8 w-8 text-primary mb-4" />
            <CardTitle className="font-serif text-2xl">The Solution</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground leading-relaxed">
            Selfbeat forces models into a three-round crucible. First, they answer blindly. Second, they see their competitors' answers and must critique their own initial response. Third, a neutral arbiter calculates a final verdict based on accuracy and self-awareness. The result is a level of transparency no standard AI interface provides.
          </CardContent>
        </Card>
      </div>

      {/* Section 3 — Why We Built This */}
      <div className="relative p-8 rounded-2xl border border-primary/20 bg-primary/5 mb-16">
        <div className="absolute top-0 right-0 p-6 opacity-10">
          <SelfbeatLogo size={128} />
        </div>
        <h2 className="text-3xl font-serif font-bold mb-6 text-primary relative z-10">Why We Built This</h2>
        <div className="space-y-4 text-lg text-foreground/90 relative z-10 max-w-2xl leading-relaxed">
          <p>
            The best systems in the world — whether in science, law, or engineering — share one thing: built-in accountability. Peer review. Audits. Error analysis. AI has largely avoided this standard. Selfbeat changes that.
          </p>
          <p>
            We believe an AI that cannot admit its flaws is fundamentally unsafe — and fundamentally untrustworthy.
          </p>
        </div>
      </div>

      {/* Section 4 — Three-Round System */}
      <div className="space-y-8">
        <h2 className="text-3xl font-serif font-bold text-center mb-10">The Three-Round System</h2>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="p-6 rounded-xl border border-border/50 bg-card">
            <div className="text-primary font-bold text-xl mb-4">Round 1: Blind</div>
            <p className="text-muted-foreground">All models receive the prompt simultaneously and generate their best initial response without seeing the others. No collaboration. No shortcuts.</p>
          </div>

          <div className="p-6 rounded-xl border border-border/50 bg-card">
            <div className="text-primary font-bold text-xl mb-4">Round 2: Critique</div>
            <p className="text-muted-foreground">The veil is lifted. Each model reads the other answers, then writes an honest self-critique of its Round 1 performance. This is where character is revealed.</p>
          </div>

          <div className="p-6 rounded-xl border border-border/50 bg-card">
            <div className="text-primary font-bold text-xl mb-4">Round 3: Verdict</div>
            <p className="text-muted-foreground">A meta-analysis calculates the final score — punishing stubbornness and rewarding intellectual honesty and the capacity for self-correction.</p>
          </div>
        </div>
      </div>

    </div>
  );
}
