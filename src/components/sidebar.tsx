"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { StarredRepo } from "@/lib/github";
import { categories, categorizeRepos } from "@/lib/categories";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Code2,
  FolderOpen,
  Hash,
  Layers,
  Plus,
  Tag as TagIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CreateTagDialog } from "@/components/create-tag-dialog";
import { CreateCollectionDialog } from "@/components/create-collection-dialog";

interface Tag {
  id: number;
  user_id: string;
  name: string;
  color: string;
}

interface Collection {
  id: number;
  user_id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
}

interface SidebarProps {
  repos: StarredRepo[];
  selectedLanguages: string[];
  onLanguageToggle: (language: string) => void;
  selectedCategory: string | null;
  onCategorySelect: (slug: string | null) => void;
  tags: Tag[];
  selectedTagId: number | null;
  onTagSelect: (id: number | null) => void;
  collections: Collection[];
  selectedCollectionId: number | null;
  onCollectionSelect: (id: number | null) => void;
  onCreateTag: (name: string, color: string) => Promise<unknown>;
  onCreateCollection: (name: string, description?: string) => Promise<unknown>;
}

export function Sidebar({
  repos,
  selectedLanguages,
  onLanguageToggle,
  selectedCategory,
  onCategorySelect,
  tags,
  selectedTagId,
  onTagSelect,
  collections,
  selectedCollectionId,
  onCollectionSelect,
  onCreateTag,
  onCreateCollection,
}: SidebarProps) {
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);

  const languageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const repo of repos) {
      if (repo.language) {
        counts[repo.language] = (counts[repo.language] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
  }, [repos]);

  const categoryCounts = useMemo(() => {
    const grouped = categorizeRepos(repos);
    return categories.map((cat) => ({
      ...cat,
      count: grouped[cat.slug]?.length ?? 0,
    }));
  }, [repos]);

  return (
    <>
      <ScrollArea className="h-full">
        <div className="flex flex-col gap-1 p-4">
          {/* Languages */}
          <SectionHeader icon={Code2} label="Languages" />
          <div className="mt-1 flex flex-col gap-0.5">
            {languageCounts.map(([lang, count]) => (
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
            {languageCounts.length === 0 && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                No languages yet
              </p>
            )}
          </div>

          <Separator className="my-3" />

          {/* Categories */}
          <SectionHeader icon={Layers} label="Categories" />
          <div className="mt-1 flex flex-col gap-0.5">
            {categoryCounts.map((cat) => (
              <button
                key={cat.slug}
                onClick={() =>
                  onCategorySelect(selectedCategory === cat.slug ? null : cat.slug)
                }
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                  selectedCategory === cat.slug &&
                    "bg-accent text-accent-foreground"
                )}
              >
                <span className="flex-1 truncate">{cat.name}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {cat.count}
                </span>
              </button>
            ))}
          </div>

          <Separator className="my-3" />

          {/* Tags */}
          <div className="flex items-center justify-between">
            <SectionHeader icon={TagIcon} label="Tags" />
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="New Tag"
              onClick={() => setTagDialogOpen(true)}
            >
              <Plus className="size-3.5" />
            </Button>
          </div>
          <div className="mt-1 flex flex-col gap-0.5">
            {tags.map((tag) => (
              <button
                key={tag.id}
                onClick={() =>
                  onTagSelect(selectedTagId === tag.id ? null : tag.id)
                }
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                  selectedTagId === tag.id && "bg-accent text-accent-foreground"
                )}
              >
                <span
                  className="inline-block size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="flex-1 truncate">{tag.name}</span>
              </button>
            ))}
            {tags.length === 0 && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                No tags yet
              </p>
            )}
          </div>

          <Separator className="my-3" />

          {/* Collections */}
          <div className="flex items-center justify-between">
            <SectionHeader icon={FolderOpen} label="Collections" />
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="New Collection"
              onClick={() => setCollectionDialogOpen(true)}
            >
              <Plus className="size-3.5" />
            </Button>
          </div>
          <div className="mt-1 flex flex-col gap-0.5">
            {collections.map((col) => (
              <Link
                key={col.id}
                href={`/stars/collection/${col.slug}`}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                  selectedCollectionId === col.id &&
                    "bg-accent text-accent-foreground"
                )}
                onClick={() => onCollectionSelect(col.id)}
              >
                <Hash className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{col.name}</span>
              </Link>
            ))}
            {collections.length === 0 && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                No collections yet
              </p>
            )}
          </div>
        </div>
      </ScrollArea>

      <CreateTagDialog
        open={tagDialogOpen}
        onOpenChange={setTagDialogOpen}
        onCreateTag={async (name, color) => {
          await onCreateTag(name, color);
        }}
      />

      <CreateCollectionDialog
        open={collectionDialogOpen}
        onOpenChange={setCollectionDialogOpen}
        onCreateCollection={async (name, description) => {
          await onCreateCollection(name, description);
        }}
      />
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
