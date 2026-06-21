import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Globe, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function WorldsList() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const worldsQuery = trpc.world.list.useQuery();
  const createMutation = trpc.world.create.useMutation({
    onSuccess: (world) => {
      utils.world.list.invalidate();
      setDialogOpen(false);
      setName('');
      setDescription('');
      navigate(`/worlds/${world.id}`);
    },
  });

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
    });
  };

  return (
    <div className="container mx-auto p-6">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Globe className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">Worlds</h1>
            </div>
            <p className="mt-2 text-muted-foreground">
              Create a world to hold your campaign ecosystem—NPCs, and more over time.
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New world
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreate}>
                <DialogHeader>
                  <DialogTitle>Create world</DialogTitle>
                  <DialogDescription>
                    Give your world a name and optional description to set the scene.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="world-name">Name</Label>
                    <Input
                      id="world-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. The Shattered Isles"
                      required
                      disabled={createMutation.isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="world-description">Description (optional)</Label>
                    <Textarea
                      id="world-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Setting, tone, key factions…"
                      rows={4}
                      disabled={createMutation.isPending}
                    />
                  </div>
                  {createMutation.isError && (
                    <p className="text-sm text-destructive">{createMutation.error.message}</p>
                  )}
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending || !name.trim()}>
                    {createMutation.isPending ? 'Creating…' : 'Create'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {worldsQuery.isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        {worldsQuery.isError && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {worldsQuery.error.message}
          </div>
        )}

        {worldsQuery.data?.length === 0 && !worldsQuery.isLoading && (
          <Card className="max-w-lg">
            <CardHeader>
              <CardTitle>No worlds yet</CardTitle>
              <CardDescription>
                Create your first world to start building NPCs and other campaign content.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create your first world
              </Button>
            </CardContent>
          </Card>
        )}

        {worldsQuery.data && worldsQuery.data.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {worldsQuery.data.map((world) => (
              <Link key={world.id} to={`/worlds/${world.id}`}>
                <Card className="h-full transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <CardTitle>{world.name}</CardTitle>
                    <CardDescription className="line-clamp-3">
                      {world.description || 'No description'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Updated {formatDate(world.updated_at)}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
