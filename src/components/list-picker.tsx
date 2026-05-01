"use client";

import { Check, List } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { UserList } from "@/hooks/use-lists";

interface ListPickerProps {
  repoId: number;
  currentListIds: number[];
  lists: UserList[];
  onAssign: (repoId: number, listId: number, assigned: boolean) => void;
}

export function ListPicker({ repoId, currentListIds, lists, onAssign }: ListPickerProps) {
  const selectedIds = new Set(currentListIds);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Manage collections"
          className="size-7 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
        >
          <List className={selectedIds.size > 0 ? "size-3.5 text-primary" : "size-3.5"} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-1" onClick={(e) => e.stopPropagation()}>
        <p className="mb-1 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Collections
        </p>

        {lists.map((list) => (
          <button
            key={list.id}
            onClick={() => onAssign(repoId, list.id, !selectedIds.has(list.id))}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
          >
            <span
              className="inline-block size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: list.color }}
            />
            <span className="flex-1 truncate">{list.name}</span>
            {selectedIds.has(list.id) && <Check className="size-3.5 text-primary" />}
          </button>
        ))}

        {lists.length === 0 && (
          <p className="px-2 py-2 text-xs text-muted-foreground">
            No collections yet. Create one from the sidebar.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
