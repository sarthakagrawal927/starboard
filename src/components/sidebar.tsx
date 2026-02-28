"use client";

import { useState } from "react";
import { UserList } from "@/hooks/use-lists";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Code2,
  List,
  Plus,
  Share2,
  Link,
  Tag as TagIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#8b5cf6", "#ec4899", "#6366f1", "#64748b",
];

interface SidebarProps {
  languageFacets: [string, number][];
  listFacets: { id: number; name: string; color: string; count: number }[];
  tagFacets: [string, number][];
  isLoading?: boolean;
  selectedLanguages: string[];
  onLanguageToggle: (language: string) => void;
  lists: UserList[];
  selectedListId: number | null;
  onListSelect: (id: number | null) => void;
  onCreateList: (name: string, color?: string) => Promise<unknown>;
  onShareList?: (id: number) => Promise<{ is_public: boolean; slug: string }>;
  selectedTag: string | null;
  onTagSelect: (tag: string | null) => void;
}

function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-1 p-4">
      {/* Languages skeleton */}
      <div className="flex items-center gap-2 px-2 py-1">
        <Skeleton className="size-4" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="mt-1 flex flex-col gap-0.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2.5 px-2 py-1.5">
            <Skeleton className="size-3.5" />
            <Skeleton className="h-3 flex-1" style={{ maxWidth: `${80 - i * 8}%` }} />
            <Skeleton className="h-3 w-6" />
          </div>
        ))}
      </div>

      <Separator className="my-3" />

      {/* Lists skeleton */}
      <div className="flex items-center gap-2 px-2 py-1">
        <Skeleton className="size-4" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="mt-1 flex flex-col gap-0.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2.5 px-2 py-1.5">
            <Skeleton className="h-3 flex-1" style={{ maxWidth: `${70 - i * 6}%` }} />
            <Skeleton className="h-3 w-6" />
          </div>
        ))}
      </div>

      <Separator className="my-3" />

      {/* Tags skeleton */}
      <div className="flex items-center gap-2 px-2 py-1">
        <Skeleton className="size-4" />
        <Skeleton className="h-3 w-12" />
      </div>

    </div>
  );
}

export function Sidebar({
  languageFacets,
  listFacets,
  tagFacets,
  isLoading,
  selectedLanguages,
  onLanguageToggle,
  lists,
  selectedListId,
  onListSelect,
  onCreateList,
  onShareList,
  selectedTag,
  onTagSelect,
}: SidebarProps) {
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListColor, setNewListColor] = useState(PRESET_COLORS[5]);
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [copiedListId, setCopiedListId] = useState<number | null>(null);

  async function handleCreateList(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newListName.trim();
    if (!trimmed) return;
    setIsCreatingList(true);
    try {
      await onCreateList(trimmed, newListColor);
      setNewListName("");
      setNewListColor(PRESET_COLORS[5]);
      setListDialogOpen(false);
    } finally {
      setIsCreatingList(false);
    }
  }

  async function handleShareList(e: React.MouseEvent, listId: number) {
    e.stopPropagation();
    if (!onShareList) return;
    try {
      const result = await onShareList(listId);
      if (result.is_public && result.slug) {
        await navigator.clipboard.writeText(
          window.location.origin + "/lists/" + result.slug
        );
        setCopiedListId(listId);
        setTimeout(() => setCopiedListId(null), 2000);
      }
    } catch {
      // silently fail
    }
  }

  if (isLoading) {
    return <SidebarSkeleton />;
  }

  return (
    <>
      <ScrollArea className="h-full">
        <div className="flex flex-col gap-1 p-4">
          {/* Languages */}
          <SectionHeader icon={Code2} label="Languages" />
          <div className="mt-1 flex flex-col gap-0.5">
            {languageFacets.slice(0, 15).map(([lang, count]) => (
              <label
                key={lang}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
              >
                <Checkbox
                  checked={selectedLanguages.includes(lang)}
                  onCheckedChange={() => onLanguageToggle(lang)}
                  className="size-3.5"
                />
                <span className="flex-1 truncate">{lang}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {count}
                </span>
              </label>
            ))}
            {languageFacets.length === 0 && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                No languages yet
              </p>
            )}
          </div>

          <Separator className="my-3" />

          {/* Lists */}
          <div className="flex items-center justify-between">
            <SectionHeader icon={List} label="Lists" />
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="New List"
              onClick={() => setListDialogOpen(true)}
            >
              <Plus className="size-3.5" />
            </Button>
          </div>
          <div className="mt-1 flex flex-col gap-0.5">
            {lists.map((list) => {
              const facet = listFacets.find((f) => f.id === list.id);
              const count = facet?.count ?? 0;
              const isShared = list.is_public === 1;
              const isCopied = copiedListId === list.id;
              return (
                <div
                  key={list.id}
                  className={cn(
                    "group flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                    selectedListId === list.id &&
                      "bg-accent text-accent-foreground"
                  )}
                >
                  <button
                    onClick={() =>
                      onListSelect(selectedListId === list.id ? null : list.id)
                    }
                    className="flex min-w-0 flex-1 items-center gap-2.5"
                  >
                    <span
                      className="inline-block size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: list.color }}
                    />
                    <span className="flex-1 truncate">{list.name}</span>
                  </button>
                  {onShareList && (
                    <button
                      onClick={(e) => handleShareList(e, list.id)}
                      className={cn(
                        "shrink-0 rounded p-0.5 transition-colors hover:bg-accent-foreground/10",
                        isShared
                          ? "text-primary"
                          : "text-muted-foreground opacity-0 group-hover:opacity-100"
                      )}
                      aria-label={
                        isCopied
                          ? "Link copied"
                          : isShared
                            ? "Shared — click to copy link or unshare"
                            : "Share list"
                      }
                      title={
                        isCopied
                          ? "Copied!"
                          : isShared
                            ? "Shared — click to copy link"
                            : "Share list"
                      }
                    >
                      {isCopied ? (
                        <Link className="size-3.5" />
                      ) : (
                        <Share2 className="size-3.5" />
                      )}
                    </button>
                  )}
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {count}
                  </span>
                </div>
              );
            })}
            {lists.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                Create lists to organize your repos
              </p>
            )}
          </div>

          <Separator className="my-3" />

          {/* Tags */}
          <SectionHeader icon={TagIcon} label="Tags" />
          <div className="mt-1 flex flex-col gap-0.5">
            {tagFacets.map(([tag, count]) => (
              <button
                key={tag}
                onClick={() =>
                  onTagSelect(selectedTag === tag ? null : tag)
                }
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                  selectedTag === tag && "bg-accent text-accent-foreground"
                )}
              >
                <TagIcon className="size-3 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{tag}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {count}
                </span>
              </button>
            ))}
            {tagFacets.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                Tags appear here when you add them to repos
              </p>
            )}
          </div>

        </div>
      </ScrollArea>

      {/* Create List Dialog */}
      <Dialog open={listDialogOpen} onOpenChange={setListDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create List</DialogTitle>
            <DialogDescription>
              Add a new list to organize your starred repos.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateList} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="list-name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="list-name"
                placeholder="e.g. Favorites, To Read..."
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Color</span>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    aria-label={preset}
                    onClick={() => setNewListColor(preset)}
                    className={cn(
                      "size-7 rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      newListColor === preset
                        ? "border-foreground scale-110"
                        : "border-transparent"
                    )}
                    style={{ backgroundColor: preset }}
                  />
                ))}
              </div>
            </div>

            {/* Preview */}
            {newListName.trim() && (
              <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
                <span
                  className="inline-block size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: newListColor }}
                />
                <span className="text-sm">{newListName.trim()}</span>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setListDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!newListName.trim() || isCreatingList}>
                {isCreatingList ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SectionHeader({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <Icon className="size-4 text-muted-foreground" />
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
