"use client";

import { useCallback, useState } from "react";
import { Tag as TagIcon, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TagPickerProps {
  repoId: number;
  tags: string[];
  onAddTag: (repoId: number, tag: string) => void;
  onRemoveTag: (repoId: number, tag: string) => void;
  allTags?: string[];
  trigger?: React.ReactNode;
}

export function TagPicker({ repoId, tags, onAddTag, onRemoveTag, allTags = [], trigger }: TagPickerProps) {
  const [input, setInput] = useState("");

  const suggestions = allTags.filter(
    (t) => !tags.includes(t) && t.toLowerCase().includes(input.toLowerCase())
  );

  const handleAdd = useCallback(
    (tag: string) => {
      const trimmed = tag.trim().toLowerCase();
      if (trimmed && !tags.includes(trimmed)) {
        onAddTag(repoId, trimmed);
      }
      setInput("");
    },
    [repoId, tags, onAddTag]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd(input);
    }
  };

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
      <PopoverContent align="start" className="w-56 p-2" onClick={(e) => e.stopPropagation()}>
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Tags
        </p>

        {/* Current tags */}
        {tags.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1 px-2">
            {tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="gap-1 text-[10px] font-normal"
              >
                {tag}
                <button
                  onClick={() => onRemoveTag(repoId, tag)}
                  className="ml-0.5 rounded-full hover:bg-muted"
                  aria-label={`Remove tag ${tag}`}
                >
                  <X className="size-2.5" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Input for adding tags */}
        <div className="px-2">
          <Input
            placeholder="Add a tag..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-7 text-xs"
          />
        </div>

        {/* Suggestions */}
        {input.trim() && suggestions.length > 0 && (
          <div className="mt-1 flex max-h-32 flex-col gap-0.5 overflow-auto">
            {suggestions.slice(0, 8).map((tag) => (
              <button
                key={tag}
                onClick={() => handleAdd(tag)}
                className="rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent"
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
