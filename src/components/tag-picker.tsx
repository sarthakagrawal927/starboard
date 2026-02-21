"use client";

import { useCallback } from "react";
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
  assignedTagIds: number[];
  onAssignTag: (repoId: number, tagId: number) => void;
  onRemoveTag: (repoId: number, tagId: number) => void;
  trigger?: React.ReactNode;
}

export function TagPicker({ repoId, tags, assignedTagIds, onAssignTag, onRemoveTag, trigger }: TagPickerProps) {
  const assignedSet = new Set(assignedTagIds);

  const toggleTag = useCallback(
    (tagId: number, isCurrentlyAssigned: boolean) => {
      if (isCurrentlyAssigned) {
        onRemoveTag(repoId, tagId);
      } else {
        onAssignTag(repoId, tagId);
      }
    },
    [repoId, onAssignTag, onRemoveTag]
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Manage tags"
            className="size-7 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
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
              const checked = assignedSet.has(tag.id);
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
