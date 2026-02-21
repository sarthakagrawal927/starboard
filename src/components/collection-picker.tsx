"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { FolderPlus, Check, Loader2, Hash } from "lucide-react";

interface Collection {
  id: number;
  user_id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
}

interface CollectionPickerProps {
  repoId: number;
  collections: Collection[];
  trigger?: React.ReactNode;
}

export function CollectionPicker({
  repoId,
  collections,
  trigger,
}: CollectionPickerProps) {
  const [open, setOpen] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  async function handleAdd(collection: Collection) {
    if (addingTo || added.has(collection.slug)) return;

    setAddingTo(collection.slug);
    try {
      const res = await fetch(`/api/collections/${collection.slug}/repos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoId }),
      });

      if (res.ok || res.status === 409) {
        // 409 means already added, treat as success
        setAdded((prev) => new Set(prev).add(collection.slug));
      }
    } catch {
      // Silently handle network errors
    } finally {
      setAddingTo(null);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      // Reset state when closing
      setAdded(new Set());
      setAddingTo(null);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
            aria-label="Add to collection"
          >
            <FolderPlus className="size-3.5" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2">
        <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Add to Collection
        </p>
        {collections.length === 0 ? (
          <p className="px-2 py-3 text-center text-sm text-muted-foreground">
            No collections yet. Create one from the sidebar.
          </p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {collections.map((col) => {
              const isAdding = addingTo === col.slug;
              const isAdded = added.has(col.slug);

              return (
                <button
                  key={col.id}
                  onClick={() => handleAdd(col)}
                  disabled={isAdding || isAdded}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent disabled:pointer-events-none"
                >
                  <Hash className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{col.name}</span>
                  {isAdding && (
                    <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
                  )}
                  {isAdded && (
                    <Check className="size-3.5 shrink-0 text-green-500" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
