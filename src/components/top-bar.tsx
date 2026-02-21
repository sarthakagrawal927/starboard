"use client";

import { useSession, signOut } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Search,
  ArrowUpDown,
  LayoutGrid,
  List,
  LogOut,
  Menu,
  Check,
  X,
  RefreshCw,
  Loader2,
} from "lucide-react";

export type SortOption =
  | "recently-starred"
  | "most-stars"
  | "recently-updated"
  | "name-az";

const sortLabels: Record<SortOption, string> = {
  "recently-starred": "Recently Starred",
  "most-stars": "Most Stars",
  "recently-updated": "Recently Updated",
  "name-az": "Name A-Z",
};

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  onMenuClick?: () => void;
  repoCount?: number;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  syncing?: boolean;
  onSync?: () => void;
  fetchedAt?: string | null;
}

export function TopBar({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  onMenuClick,
  repoCount,
  hasActiveFilters,
  onClearFilters,
  syncing,
  onSync,
  fetchedAt,
}: TopBarProps) {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b bg-background/80 px-3 py-2.5 backdrop-blur-sm sm:gap-3 sm:px-4 sm:py-3 md:px-6">
      {onMenuClick && (
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 md:hidden"
          onClick={onMenuClick}
          aria-label="Toggle sidebar"
        >
          <Menu className="size-5" />
        </Button>
      )}

      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search repos..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {typeof repoCount === "number" && (
        <span className="hidden shrink-0 text-sm text-muted-foreground lg:inline">
          {repoCount} {repoCount === 1 ? "repo" : "repos"}
        </span>
      )}

      {onSync && (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5 text-xs"
          onClick={onSync}
          disabled={syncing}
          title={fetchedAt ? `Last synced: ${new Date(fetchedAt).toLocaleString()}` : "Never synced"}
        >
          {syncing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          <span className="hidden sm:inline">{syncing ? "Syncing..." : "Sync"}</span>
        </Button>
      )}

      {hasActiveFilters && onClearFilters && (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5 text-xs"
          onClick={onClearFilters}
        >
          <X className="size-3" />
          <span className="hidden sm:inline">Clear filters</span>
          <span className="sm:hidden">Clear</span>
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="hidden gap-2 sm:flex">
            <ArrowUpDown className="size-3.5" />
            <span className="hidden md:inline">{sortLabels[sortBy]}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {(Object.entries(sortLabels) as [SortOption, string][]).map(
            ([value, label]) => (
              <DropdownMenuItem
                key={value}
                onClick={() => onSortChange(value)}
                className="justify-between"
              >
                {label}
                {sortBy === value && (
                  <Check className="size-4 text-primary" />
                )}
              </DropdownMenuItem>
            )
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ToggleGroup
        type="single"
        value={viewMode}
        onValueChange={(v) => {
          if (v) onViewModeChange(v as "grid" | "list");
        }}
        variant="outline"
        size="sm"
        className="hidden sm:flex"
      >
        <ToggleGroupItem value="grid" aria-label="Grid view">
          <LayoutGrid className="size-4" />
        </ToggleGroupItem>
        <ToggleGroupItem value="list" aria-label="List view">
          <List className="size-4" />
        </ToggleGroupItem>
      </ToggleGroup>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 overflow-hidden rounded-full"
          >
            {session?.user?.image ? (
              <img
                src={session.user.image}
                alt={session.user.name ?? "User"}
                className="size-8 rounded-full"
              />
            ) : (
              <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                {session?.user?.name?.[0]?.toUpperCase() ?? "?"}
              </div>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">{session?.user?.name}</p>
            <p className="text-xs text-muted-foreground">
              {session?.user?.email}
            </p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => signOut({ callbackUrl: "/" })}
            className="gap-2 text-destructive focus:text-destructive"
          >
            <LogOut className="size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
