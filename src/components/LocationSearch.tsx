import { useEffect, useRef, useState } from "react";
import { Search, MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchLocations, PRESETS, type GeocodeResult } from "@/lib/geocode";
import { cn } from "@/lib/utils";

interface Props {
  onSelect: (result: GeocodeResult & { zoom?: number }) => void;
}

// Nominatim's usage policy caps callers at 1 request/second.
const DEBOUNCE_MS = 400;

export function LocationSearch({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const found = await searchLocations(trimmed, controller.signal);
      if (!controller.signal.aborted) {
        setResults(found);
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [query]);

  // A highlighted index that survives a query/result change points at a
  // since-replaced option, so drop it every time the underlying list does.
  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [results]);

  const trimmedQuery = query.trim();
  // Arrow keys walk this single flat list, whether it holds the blank-query
  // presets or the live search results -- one code path serves both.
  const options: Array<GeocodeResult & { zoom?: number }> =
    trimmedQuery === "" ? PRESETS : results;

  const choose = (r: GeocodeResult & { zoom?: number }) => {
    onSelect(r);
    setQuery("");
    setResults([]);
    setOpen(false);
    setActiveIndex(-1);
  };

  const selectOption = (index: number) => {
    const opt = options[index];
    if (!opt) return;
    choose(trimmedQuery === "" ? opt : { ...opt, zoom: 14 });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (options.length === 0) return;
        setActiveIndex((prev) => (prev + 1) % options.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (options.length === 0) return;
        setActiveIndex((prev) => (prev <= 0 ? options.length - 1 : prev - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0) {
          selectOption(activeIndex);
        }
        break;
      case "Escape":
        setOpen(false);
        setActiveIndex(-1);
        break;
      default:
        break;
    }
  };

  // The effect above clears `results` whenever the query goes blank, so any
  // further condition here reduces to `open` in every reachable state.
  const showDropdown = open;

  const optionClassName = (i: number) =>
    cn(
      "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-small hover:bg-muted",
      i === activeIndex && "bg-muted"
    );

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="location-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder="Search any city or address…"
          className="pl-9"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="location-search-listbox"
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `location-option-${activeIndex}` : undefined}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && (
        <div
          id="location-search-listbox"
          role="listbox"
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-[var(--shadow-panel)]"
        >
          {trimmedQuery === "" && (
            <div className="p-1">
              <div className="px-3 py-1.5 text-xs text-muted-foreground">Try one of these</div>
              {options.map((opt, i) => (
                <button
                  key={opt.label}
                  id={`location-option-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectOption(i)}
                  className={optionClassName(i)}
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{opt.label}</span>
                </button>
              ))}
            </div>
          )}

          {trimmedQuery !== "" && !loading && options.length === 0 && (
            <div className="px-3 py-3 text-small text-muted-foreground">
              No matches. You can still pan and zoom the map directly.
            </div>
          )}

          {trimmedQuery !== "" && options.length > 0 && (
            <div className="p-1">
              {options.map((opt, i) => (
                <button
                  key={`${opt.lat},${opt.lng}`}
                  id={`location-option-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectOption(i)}
                  className={optionClassName(i)}
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{opt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
