import { useState } from 'react';
import { Copy, RefreshCw, Sparkles, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc';

type FormState = {
  prompt: string;
  setting: string;
  tone: string;
};

const initialForm: FormState = {
  prompt: '',
  setting: '',
  tone: '',
};

export function NpcGenerator() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [copied, setCopied] = useState(false);

  const generateMutation = trpc.npc.generate.useMutation();

  const isGenerating = generateMutation.isPending;
  const result = generateMutation.data;

  const submitGeneration = () => {
    setCopied(false);
    generateMutation.reset();
    generateMutation.mutate({
      prompt: form.prompt.trim(),
      setting: form.setting.trim() || undefined,
      tone: form.tone.trim() || undefined,
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    submitGeneration();
  };

  const handleCopyDescription = async () => {
    if (!result?.description) {
      return;
    }

    try {
      await navigator.clipboard.writeText(result.description);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleGenerateAgain = () => {
    submitGeneration();
  };

  return (
    <div className="container mx-auto p-6">
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">NPC Generator</h1>
          </div>
          <p className="mt-2 text-muted-foreground">
            Describe the NPC you need and get a name, session-ready description, and portrait.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt</Label>
            <Textarea
              id="prompt"
              placeholder="e.g. A nervous halfling fence who knows too much about the thieves' guild in Waterdeep"
              value={form.prompt}
              onChange={(event) => setForm((prev) => ({ ...prev, prompt: event.target.value }))}
              rows={4}
              required
              disabled={isGenerating}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="setting">Setting (optional)</Label>
              <Input
                id="setting"
                placeholder="e.g. Sword Coast, late autumn"
                value={form.setting}
                onChange={(event) => setForm((prev) => ({ ...prev, setting: event.target.value }))}
                disabled={isGenerating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tone">Tone (optional)</Label>
              <Input
                id="tone"
                placeholder="e.g. grim, comedic, heroic"
                value={form.tone}
                onChange={(event) => setForm((prev) => ({ ...prev, tone: event.target.value }))}
                disabled={isGenerating}
              />
            </div>
          </div>

          <Button type="submit" disabled={isGenerating || !form.prompt.trim()}>
            <Sparkles className="mr-2 h-4 w-4" />
            {isGenerating ? 'Generating…' : 'Generate'}
          </Button>
        </form>

        {generateMutation.isError && (
          <div
            role="alert"
            className="max-w-2xl rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {generateMutation.error.message}
          </div>
        )}

        {isGenerating && (
          <Card className="max-w-2xl">
            <CardHeader>
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="mx-auto aspect-square w-full max-w-xs rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </CardContent>
          </Card>
        )}

        {result && !isGenerating && (
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>{result.name}</CardTitle>
              <CardDescription>Generated NPC</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <img
                src={`data:${result.imageMediaType};base64,${result.imageBase64}`}
                alt={`Portrait of ${result.name}`}
                className="mx-auto aspect-square w-full max-w-xs rounded-lg border object-cover"
              />
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                {result.description}
              </div>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={handleCopyDescription}>
                <Copy className="mr-2 h-4 w-4" />
                {copied ? 'Copied!' : 'Copy description'}
              </Button>
              <Button type="button" variant="secondary" onClick={handleGenerateAgain}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Generate again
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
