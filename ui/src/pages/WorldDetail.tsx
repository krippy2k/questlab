import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Users } from 'lucide-react';
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
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc';

export function WorldDetail() {
  const { worldId } = useParams<{ worldId: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [dirty, setDirty] = useState(false);

  const worldQuery = trpc.world.get.useQuery(
    { id: worldId! },
    { enabled: Boolean(worldId) }
  );
  const npcsQuery = trpc.npc.listByWorld.useQuery(
    { worldId: worldId! },
    { enabled: Boolean(worldId) }
  );

  const updateMutation = trpc.world.update.useMutation({
    onSuccess: () => {
      utils.world.list.invalidate();
      utils.world.get.invalidate({ id: worldId! });
      setDirty(false);
    },
  });

  const deleteMutation = trpc.world.delete.useMutation({
    onSuccess: () => {
      utils.world.list.invalidate();
      navigate('/worlds');
    },
  });

  useEffect(() => {
    if (worldQuery.data) {
      setName(worldQuery.data.name);
      setDescription(worldQuery.data.description ?? '');
      setDirty(false);
    }
  }, [worldQuery.data]);

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    if (!worldId || !name.trim()) {
      return;
    }
    updateMutation.mutate({
      id: worldId,
      name: name.trim(),
      description: description.trim() || null,
    });
  };

  if (worldQuery.isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full max-w-2xl" />
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
      <div className="space-y-8">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
            <Link to="/worlds">
              <ArrowLeft className="mr-2 h-4 w-4" />
              All worlds
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">{worldQuery.data.name}</h1>
        </div>

        <form onSubmit={handleSave} className="max-w-2xl space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setDirty(true);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setDirty(true);
              }}
              rows={5}
              placeholder="Setting, tone, factions… Used as default context for NPC generation."
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={!dirty || updateMutation.isPending || !name.trim()}>
              {updateMutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete world
            </Button>
          </div>
          {updateMutation.isError && (
            <p className="text-sm text-destructive">{updateMutation.error.message}</p>
          )}
        </form>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">NPCs</h2>
            </div>
            <Button asChild>
              <Link to={`/worlds/${worldId}/npcs`}>
                <Plus className="mr-2 h-4 w-4" />
                Create NPC
              </Link>
            </Button>
          </div>

          {npcsQuery.isLoading && <Skeleton className="h-24 w-full max-w-2xl" />}

          {npcsQuery.data?.length === 0 && !npcsQuery.isLoading && (
            <Card className="max-w-2xl">
              <CardHeader>
                <CardTitle className="text-base">No NPCs yet</CardTitle>
                <CardDescription>
                  Generate NPC characters that live in this world.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {npcsQuery.data && npcsQuery.data.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl">
              {npcsQuery.data.map((npc) => (
                <Link key={npc.id} to={`/worlds/${worldId}/npcs/${npc.id}`}>
                  <Card className="h-full overflow-hidden transition-colors hover:bg-muted/50">
                    <img
                      src={`data:${npc.image_media_type};base64,${npc.image_base64}`}
                      alt={npc.name}
                      className="aspect-square w-full object-cover"
                    />
                    <CardHeader className="py-3">
                      <CardTitle className="text-base">{npc.name}</CardTitle>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete world?</DialogTitle>
            <DialogDescription>
              This will permanently delete &ldquo;{worldQuery.data.name}&rdquo; and all NPCs in it.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => worldId && deleteMutation.mutate({ id: worldId })}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
