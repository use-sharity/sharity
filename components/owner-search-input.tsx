"use client";

import { useQuery } from "convex/react";
import { Search, User, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CloudinaryImage } from "@/components/cloudinary-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import {
  normalizeItemSearchInput,
  ownerTokenFromName,
  parseItemSearchQuery,
  stripTrailingOwnerComma,
} from "@/lib/item-search";
import { cn } from "@/lib/utils";

export interface SelectedOwner {
  userId: string;
  name: string | null;
  avatarUrl: string | null;
  token: string;
}

interface OwnerSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  selectedOwners: SelectedOwner[];
  onSelectedOwnersChange: (owners: SelectedOwner[]) => void;
  placeholder: string;
  className?: string;
}

interface ActiveOwnerToken {
  query: string;
  start: number;
  end: number;
}

function getActiveOwnerToken(
  value: string,
  cursor: number,
): ActiveOwnerToken | null {
  const beforeCursor = value.slice(0, cursor);
  const ownerStart = beforeCursor.toLowerCase().lastIndexOf("owner:");
  if (ownerStart === -1) return null;

  const ownerPrefix = value.slice(0, ownerStart);
  if (ownerPrefix.trim().length > 0) return null;

  const afterOwnerStart = ownerStart + "owner:".length;
  const nextSpace = value.indexOf(" ", afterOwnerStart);
  const ownerEnd = nextSpace === -1 ? value.length : nextSpace;
  if (cursor > ownerEnd) return null;

  const ownerPartBeforeCursor = value.slice(afterOwnerStart, cursor);
  const commaIndex = ownerPartBeforeCursor.lastIndexOf(",");
  const tokenStart =
    commaIndex === -1 ? afterOwnerStart : afterOwnerStart + commaIndex + 1;
  const rawToken = value.slice(tokenStart, cursor);
  if (rawToken && !rawToken.trimStart().startsWith("@")) return null;

  return {
    query: rawToken.trim().replace(/^@+/, "").replace(/[-_]+/g, " "),
    start: tokenStart,
    end: cursor,
  };
}

function buildOwnerPrefix(
  owners: SelectedOwner[],
  trailingComma: boolean,
): string {
  if (owners.length === 0) return trailingComma ? "owner:" : "";
  const prefix = `owner:${owners.map((owner) => `@${owner.token}`).join(",")}`;
  return trailingComma ? `${prefix},` : prefix;
}

export function OwnerSearchInput({
  value,
  onChange,
  selectedOwners,
  onSelectedOwnersChange,
  placeholder,
  className,
}: OwnerSearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState(value.length);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const activeToken = useMemo(
    () => getActiveOwnerToken(value, cursor),
    [value, cursor],
  );
  const ownerDropdownOpen = isOpen && activeToken !== null;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(activeToken?.query ?? "");
      setHighlightedIndex(0);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [activeToken?.query]);

  const ownerSuggestions = useQuery(
    api.users.searchOwners,
    ownerDropdownOpen ? { query: debouncedQuery, limit: 8 } : "skip",
  );

  const visibleSuggestions = (ownerSuggestions ?? []).filter(
    (owner) =>
      !selectedOwners.some((selected) => selected.userId === owner.userId),
  );

  useEffect(() => {
    const parsed = parseItemSearchQuery(value);
    const tokenSet = new Set(
      parsed.ownerQueries.map((query) => ownerTokenFromName(query)),
    );
    const nextOwners = selectedOwners.filter((owner) =>
      tokenSet.has(owner.token),
    );
    if (nextOwners.length !== selectedOwners.length) {
      onSelectedOwnersChange(nextOwners);
    }
  }, [value, selectedOwners, onSelectedOwnersChange]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        onChange(stripTrailingOwnerComma(value));
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [onChange, value]);

  const selectOwner = (owner: {
    userId: string;
    name: string | null;
    avatarUrl: string | null;
  }) => {
    const token = ownerTokenFromName(owner.name ?? owner.userId);
    const nextOwners = selectedOwners.some(
      (selected) => selected.userId === owner.userId,
    )
      ? selectedOwners
      : [...selectedOwners, { ...owner, token }];
    onSelectedOwnersChange(nextOwners);

    const parsed = parseItemSearchQuery(value);
    const nextValue = `${buildOwnerPrefix(nextOwners, true)}${
      parsed.itemQuery ? ` ${parsed.itemQuery}` : ""
    }`;
    onChange(nextValue);
    setIsOpen(true);
    window.requestAnimationFrame(() => {
      const nextCursor = buildOwnerPrefix(nextOwners, true).length;
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextCursor, nextCursor);
      setCursor(nextCursor);
    });
  };

  return (
    <div ref={rootRef} className={cn("relative flex-1", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          const nextValue = normalizeItemSearchInput(event.target.value);
          onChange(nextValue);
          const nextCursor = event.target.selectionStart ?? nextValue.length;
          setCursor(
            nextCursor + (nextValue.length - event.target.value.length),
          );
          setIsOpen(getActiveOwnerToken(nextValue, nextCursor) !== null);
        }}
        onClick={(event) => {
          const nextCursor = event.currentTarget.selectionStart ?? value.length;
          setCursor(nextCursor);
          setIsOpen(getActiveOwnerToken(value, nextCursor) !== null);
        }}
        onKeyUp={(event) => {
          const nextCursor = event.currentTarget.selectionStart ?? value.length;
          setCursor(nextCursor);
          if (event.key === "@") setIsOpen(true);
        }}
        onKeyDown={(event) => {
          if (!ownerDropdownOpen) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setHighlightedIndex((index) =>
              visibleSuggestions.length === 0
                ? 0
                : (index + 1) % visibleSuggestions.length,
            );
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlightedIndex((index) =>
              visibleSuggestions.length === 0
                ? 0
                : (index - 1 + visibleSuggestions.length) %
                  visibleSuggestions.length,
            );
          } else if (event.key === "Enter") {
            const owner = visibleSuggestions[highlightedIndex];
            if (owner) {
              event.preventDefault();
              selectOwner(owner);
            }
          } else if (event.key === "Escape") {
            event.preventDefault();
            setIsOpen(false);
            onChange(stripTrailingOwnerComma(value));
          }
        }}
        className="pl-9 pr-9"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
          onClick={() => {
            onChange("");
            onSelectedOwnersChange([]);
            inputRef.current?.focus();
          }}
        >
          <X className="h-3.5 w-3.5" />
          <span className="sr-only">Clear search</span>
        </Button>
      )}
      {ownerDropdownOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="max-h-72 overflow-y-auto p-1">
            {ownerSuggestions === undefined ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Searching owners...
              </div>
            ) : visibleSuggestions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No owners found.
              </div>
            ) : (
              visibleSuggestions.map((owner, index) => {
                const name = owner.name ?? "Anonymous";
                return (
                  <button
                    key={owner.userId}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm",
                      index === highlightedIndex && "bg-accent",
                    )}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectOwner(owner)}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                      {owner.avatarUrl ? (
                        <span className="relative h-full w-full">
                          <CloudinaryImage
                            src={owner.avatarUrl}
                            alt={name}
                            fill
                            sizes="28px"
                            className="object-cover"
                          />
                        </span>
                      ) : (
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {owner.sharedItemCount} shared{" "}
                        {owner.sharedItemCount === 1 ? "item" : "items"}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      @{ownerTokenFromName(name)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
