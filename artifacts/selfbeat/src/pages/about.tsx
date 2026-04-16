import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Target, Zap } from "lucide-react";
import { SelfbeatLogo } from "@/components/SelfbeatLogo";

export default function About() {
  return (
    <div className="container py-16 max-w-4xl animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-bold mb-6 font-serif">About Selfbeat</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Founded by a physician to bring honesty and rigor to AI evaluation. 
          We believe the best way to test an AI is to make it criticize itself.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2 mb-16">
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <ShieldCheck className="h-8 w-8 text-primary mb-4" />
            <CardTitle className="font-serif text-2xl">The Problem</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground leading-relaxed">
            Standard AI benchmarks are sterile and easily gamed. When users ask questions, 
            models often project absolute certainty, hiding their flaws, biases, and blind spots. 
            There is no built-in mechanism for accountability or self-reflection in standard chat interfaces.
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <Target className="h-8 w-8 text-primary mb-4" />
            <CardTitle className="font-serif text-2xl">The Solution</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground leading-relaxed">
            Selfbeat forces models into a three-round crucible. First, they answer blindly. 
            Second, they see their competitors' answers and are forced to critique their own 
            initial response. Third, a neutral arbiter calculates a final verdict based on 
            accuracy and self-awareness.
          </CardContent>
        </Card>
      </div>

      <div className="relative p-8 rounded-2xl border border-primary/20 bg-primary/5 mb-16">
        <div className="absolute top-0 right-0 p-6 opacity-10">
          <SelfbeatLogo size={128} />
        </div>
        <h2 className="text-3xl font-serif font-bold mb-6 text-primary relative z-10">Physician Founded</h2>
        <div className="space-y-4 text-lg text-foreground/90 relative z-10 max-w-2xl leading-relaxed">
          <p>
            In medicine, the M&M (Morbidity and Mortality) conference is a sacred tradition. 
            It's a safe space where doctors openly discuss their mistakes, learn from them, 
            and improve systemic care.
          </p>
          <p>
            Selfbeat applies this clinical rigor to Artificial Intelligence. We demand that 
            models exhibit not just knowledge, but humility, adaptability, and the capacity 
            for self-correction. An AI that cannot admit its flaws is fundamentally unsafe.
          </p>
        </div>
      </div>

      <div className="space-y-8">
        <h2 className="text-3xl font-serif font-bold text-center mb-10">The Three-Round System</h2>
        
        <div className="grid gap-6 md:grid-cols-3">
          <div className="p-6 rounded-xl border border-border/50 bg-card">
            <div className="text-primary font-bold text-xl mb-4">Round 1: Blind</div>
            <p className="text-muted-foreground">All four models receive the prompt simultaneously and generate their best initial response without seeing the others.</p>
          </div>
          
          <div className="p-6 rounded-xl border border-border/50 bg-card">
            <div className="text-primary font-bold text-xl mb-4">Round 2: Critique</div>
            <p className="text-muted-foreground">The veil is lifted. Each model reads the other three answers, then writes a brutal self-critique of its Round 1 performance.</p>
          </div>
          
          <div className="p-6 rounded-xl border border-border/50 bg-card">
            <div className="text-primary font-bold text-xl mb-4">Round 3: Verdict</div>
            <p className="text-muted-foreground">A meta-analysis calculates the final score, punishing stubbornness and rewarding intellectual honesty and course-correction.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
