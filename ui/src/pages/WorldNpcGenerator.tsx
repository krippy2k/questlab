import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, RefreshCw, Save, Sparkles, Users } from 'lucide-react';
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

export function WorldNpcGenerator() {
  const { worldId } = useParams<{ worldId: string }>();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>({ prompt: '', setting: '', tone: '' });
  const [settingTouched, setSettingTouched] = useState(false);
  const [copied, setCopied] = useState(false);

  const worldQuery = trpc.world.get.useQuery(
    { id: worldId! },
    { enabled: Boolean(worldId) }
  );

  const generateMutation = trpc.npc.generate.useMutation();
  const createMutation = trpc.npc.create.useMutation({
    onSuccess: (npc) => {
      navigate(`/worlds/${worldId}/npcs/${npc.id}`);
    },
  });

  useEffect(() => {
    if (worldQuery.data?.description && !settingTouched) {
      setForm((prev) => ({ ...prev, setting: worldQuery.data.description ?? '' }));
    }
  }, [worldQuery.data?.description, settingTouched]);

  const isGenerating = generateMutation.isPending;
  const isSaving = createMutation.isPending;
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

  const handleSaveToWorld = () => {
    if (!result || !worldId) {
      return;
    }
    createMutation.mutate({
      worldId,
      name: result.name,
      description: result.description,
      imageBase64: result.imageBase64,
      imageMediaType: result.imageMediaType,
      generationPrompt: form.prompt.trim() || undefined,
      generationSetting: form.setting.trim() || undefined,
      generationTone: form.tone.trim() || undefined,
    });
  };

  if (worldQuery.isLoading) {
    return (
      <div className="container mx-auto p-6">
        <Skeleton className="h-8 w-64" />
      </div>
    );
  }

  if (worldQuery.isError || !worldQuery.data) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-destructive">{worldQuery.error?.message ?? 'World not found'}</p>
        <Button variant="link" asChild className="mt-4 px-0">
          <Link to="/worlds">Back to worlds</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="space-y-6">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
            <Link to={`/worlds/${worldId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {worldQuery.data.name}
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Create NPC</h1>
          </div>
          <p className="mt-2 text-muted-foreground">
            Generate an NPC for {worldQuery.data.name}. Save it to add the character to this world.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt</Label>
            <Textarea
              id="prompt"
              placeholder="e.g. A nervous halfling fence who knows too much about the thieves' guild"
              value={form.prompt}
              onChange={(e) => setForm((prev) => ({ ...prev, prompt: e.target.value }))}
              rows={4}
              required
              disabled={isGenerating || isSaving}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="setting">Setting (optional)</Label>
              <Input
                id="setting"
                placeholder="Pre-filled from world description"
                value={form.setting}
                onChange={(e) => {
                  setSettingTouched(true);
                  setForm((prev) => ({ ...prev, setting: e.target.value }));
                }}
                disabled={isGenerating || isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tone">Tone (optional)</Label>
              <Input
                id="tone"
                placeholder="e.g. grim, comedic, heroic"
                value={form.tone}
                onChange={(e) => setForm((prev) => ({ ...prev, tone: e.target.value }))}
                disabled={isGenerating || isSaving}
              />
            </div>
          </div>

          <Button type="submit" disabled={isGenerating || isSaving || !form.prompt.trim()}>
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

        {createMutation.isError && (
          <div
            role="alert"
            className="max-w-2xl rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {createMutation.error.message}
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
              <CardDescription>Generated NPC — save to add to {worldQuery.data.name}</CardDescription>
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
              <Button type="button" onClick={handleSaveToWorld} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? 'Saving…' : 'Save to world'}
              </Button>
              <Button type="button" variant="outline" onClick={handleCopyDescription}>
                <Copy className="mr-2 h-4 w-4" />
                {copied ? 'Copied!' : 'Copy description'}
              </Button>
              <Button type="button" variant="secondary" onClick={submitGeneration} disabled={isSaving}>
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
