import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';

export function WorldNpcDetail() {
  const { worldId, npcId } = useParams<{ worldId: string; npcId: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dirty, setDirty] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [targetWorldId, setTargetWorldId] = useState('');

  const npcQuery = trpc.npc.get.useQuery({ id: npcId! }, { enabled: Boolean(npcId) });
  const worldsQuery = trpc.world.list.useQuery(undefined, { enabled: copyOpen });

  const updateMutation = trpc.npc.update.useMutation({
    onSuccess: () => {
      utils.npc.get.invalidate({ id: npcId! });
      utils.npc.listByWorld.invalidate({ worldId: worldId! });
      setDirty(false);
    },
  });

  const deleteMutation = trpc.npc.delete.useMutation({
    onSuccess: () => {
      utils.npc.listByWorld.invalidate({ worldId: worldId! });
      navigate(`/worlds/${worldId}`);
    },
  });

  const copyMutation = trpc.npc.copyToWorld.useMutation({
    onSuccess: (npc) => {
      utils.world.list.invalidate();
      setCopyOpen(false);
      navigate(`/worlds/${npc.world_id}/npcs/${npc.id}`);
    },
  });

  useEffect(() => {
    if (npcQuery.data) {
      setName(npcQuery.data.name);
      setDescription(npcQuery.data.description);
      setDirty(false);
    }
  }, [npcQuery.data]);

  const otherWorlds = worldsQuery.data?.filter((w) => w.id !== worldId) ?? [];

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    if (!npcId || !name.trim() || !description.trim()) {
      return;
    }
    updateMutation.mutate({
      id: npcId,
      name: name.trim(),
      description: description.trim(),
    });
  };

  const handleCopy = () => {
    if (!npcId || !targetWorldId) {
      return;
    }
    copyMutation.mutate({ npcId, targetWorldId });
  };

  if (npcQuery.isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mx-auto aspect-square w-full max-w-xs rounded-lg" />
      </div>
    );
  }

  if (npcQuery.isError || !npcQuery.data) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-destructive">{npcQuery.error?.message ?? 'NPC not found'}</p>
        <Button variant="link" asChild className="mt-4 px-0">
          <Link to={`/worlds/${worldId}`}>Back to world</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="space-y-6 max-w-2xl">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to={`/worlds/${worldId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to world
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>{npcQuery.data.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <img
              src={`data:${npcQuery.data.image_media_type};base64,${npcQuery.data.image_base64}`}
              alt={npcQuery.data.name}
              className="mx-auto aspect-square w-full max-w-xs rounded-lg border object-cover"
            />

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="npc-name">Name</Label>
                <Input
                  id="npc-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setDirty(true);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="npc-description">Description</Label>
                <Textarea
                  id="npc-description"
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setDirty(true);
                  }}
                  rows={10}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={!dirty || updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving…' : 'Save changes'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setCopyOpen(true)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy to world
                </Button>
                <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
              {updateMutation.isError && (
                <p className="text-sm text-destructive">{updateMutation.error.message}</p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>

      <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy to another world</DialogTitle>
            <DialogDescription>
              Creates a separate copy of this NPC in the target world. Edits to either copy are
              independent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Target world</Label>
            <Select value={targetWorldId} onValueChange={setTargetWorldId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a world" />
              </SelectTrigger>
              <SelectContent>
                {otherWorlds.map((world) => (
                  <SelectItem key={world.id} value={world.id}>
                    {world.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {otherWorlds.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Create another world first to copy this NPC.
              </p>
            )}
            {copyMutation.isError && (
              <p className="text-sm text-destructive">{copyMutation.error.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!targetWorldId || copyMutation.isPending || otherWorlds.length === 0}
              onClick={handleCopy}
            >
              {copyMutation.isPending ? 'Copying…' : 'Copy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete NPC?</DialogTitle>
            <DialogDescription>
              This will permanently delete {npcQuery.data.name}. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => npcId && deleteMutation.mutate({ id: npcId })}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
