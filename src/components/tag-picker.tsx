"use client";

import { useCallback } from "react";
import useSWR from "swr";
import { Tag as TagIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

interface Tag {
  id: number;
  user_id: string;
  name: string;
  color: string;
}

interface TagPickerProps {
  repoId: number;
  tags: Tag[];
  trigger?: React.ReactNode;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function TagPicker({ repoId, tags, trigger }: TagPickerProps) {
  const {
    data: assignedTags,
    mutate,
  } = useSWR<Tag[]>(`/api/repos/${repoId}/tags`, fetcher);

  const assignedIds = new Set(assignedTags?.map((t) => t.id) ?? []);

  const toggleTag = useCallback(
    async (tagId: number, isCurrentlyAssigned: boolean) => {
      if (isCurrentlyAssigned) {
        // Optimistic: remove from local state
        mutate(
          (prev) => (prev ?? []).filter((t) => t.id !== tagId),
          false
        );
        await fetch(`/api/repos/${repoId}/tags`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagId }),
        });
      } else {
        // Optimistic: add to local state
        const tag = tags.find((t) => t.id === tagId);
        if (tag) {
          mutate((prev) => [...(prev ?? []), tag], false);
        }
        await fetch(`/api/repos/${repoId}/tags`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagId }),
        });
      }
      // Revalidate after mutation
      mutate();
    },
    [repoId, tags, mutate]
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Manage tags"
            className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          >
            <TagIcon className="size-3.5" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Tags
        </p>
        {tags.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">
            No tags yet. Create one in the sidebar.
          </p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {tags.map((tag) => {
              const checked = assignedIds.has(tag.id);
              return (
                <label
                  key={tag.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleTag(tag.id, checked)}
                    className="size-3.5"
                  />
                  <span
                    className="inline-block size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="flex-1 truncate">{tag.name}</span>
                </label>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
