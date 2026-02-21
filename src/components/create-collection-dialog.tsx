"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

interface CreateCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateCollection: (name: string, description?: string) => Promise<void>;
}

export function CreateCollectionDialog({
  open,
  onOpenChange,
  onCreateCollection,
}: CreateCollectionDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  function resetForm() {
    setName("");
    setDescription("");
    setIsCreating(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setIsCreating(true);
    try {
      await onCreateCollection(
        trimmedName,
        description.trim() || undefined
      );
      resetForm();
      onOpenChange(false);
    } catch {
      // Keep dialog open on error so user can retry
      setIsCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Collection</DialogTitle>
          <DialogDescription>
            Organize your starred repos into collections.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="collection-name"
              className="text-sm font-medium leading-none"
            >
              Name
            </label>
            <Input
              id="collection-name"
              placeholder="e.g. Frontend Tools"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              disabled={isCreating}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="collection-description"
              className="text-sm font-medium leading-none"
            >
              Description{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </label>
            <textarea
              id="collection-description"
              placeholder="What is this collection about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={isCreating}
              className="border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-[60px] w-full rounded-md border px-3 py-2 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isCreating}>
              {isCreating && <Loader2 className="size-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
