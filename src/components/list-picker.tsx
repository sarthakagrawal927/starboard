"use client";

import { List, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import type { UserList } from "@/hooks/use-lists";

interface ListPickerProps {
  repoId: number;
  currentListId: number | null;
  lists: UserList[];
  onAssign: (repoId: number, listId: number | null) => void;
}

export function ListPicker({ repoId, currentListId, lists, onAssign }: ListPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Move to list"
          className="size-7 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
        >
          <List className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-1" onClick={(e) => e.stopPropagation()}>
        <p className="mb-1 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Move to list
        </p>

        {/* "None" option to unassign */}
        <button
          onClick={() => onAssign(repoId, null)}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
        >
          <span className="flex-1 text-muted-foreground">None</span>
          {currentListId === null && <Check className="size-3.5 text-primary" />}
        </button>

        {lists.map((list) => (
          <button
            key={list.id}
            onClick={() => onAssign(repoId, list.id)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
          >
            <span
              className="inline-block size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: list.color }}
            />
            <span className="flex-1 truncate">{list.name}</span>
            {currentListId === list.id && <Check className="size-3.5 text-primary" />}
          </button>
        ))}

        {lists.length === 0 && (
          <p className="px-2 py-2 text-xs text-muted-foreground">
            No lists yet. Create one from the sidebar.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
