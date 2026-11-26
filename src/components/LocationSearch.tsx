import { useEffect, useRef, useState } from "react";
import { Search, MapPin, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { lookupLocations, PRESETS, type GeocodeResult } from "@/lib/geocode";
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
  const [unavailable, setUnavailable] = useState(false);
  const [retry, setRetry] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    setResults([]);
    setUnavailable(false);
    if (!trimmed) {
      setLoading(false);
      return;
    }

    let active = true;
    let requestTimeout: ReturnType<typeof setTimeout> | undefined;
    setLoading(true);
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      requestTimeout = setTimeout(() => {
        if (!active) return;
        controller.abort();
        setUnavailable(true);
        setLoading(false);
      }, 8_000);

      const found = await lookupLocations(trimmed, controller.signal);
      clearTimeout(requestTimeout);
      if (active && !controller.signal.aborted) {
        setResults(found.results);
        setUnavailable(found.status === "unavailable");
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
      clearTimeout(requestTimeout);
      abortRef.current?.abort();
    };
  }, [query, retry]);

  // A highlighted index that survives a query/result change points at a
  // since-replaced option, so drop it every time the underlying list does.
  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [results]);

  useEffect(() => {
    if (open && activeIndex >= 0) {
      document.getElementById(`location-option-${activeIndex}`)?.scrollIntoView?.({ block: "nearest" });
    }
  }, [activeIndex, open]);

  const trimmedQuery = query.trim();
  // Arrow keys walk this single flat list, whether it holds the blank-query
  // presets or the live search results -- one code path serves both.
  const options: Array<GeocodeResult & { zoom?: number }> =
    trimmedQuery === "" ? PRESETS : loading ? [] : results;

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
        setOpen(true);
        if (options.length === 0) return;
        setActiveIndex((prev) => (prev + 1) % options.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setOpen(true);
        if (options.length === 0) return;
        setActiveIndex((prev) => (prev <= 0 ? options.length - 1 : prev - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (!open) { setOpen(true); return; }
        if (activeIndex >= 0) {
          selectOption(activeIndex);
        } else if (trimmedQuery !== "" && options.length > 0) {
          // Type a place and hit Enter: take the top hit. Requiring an arrow
          // key first made Enter silently do nothing.
          selectOption(0);
        }
        break;
      case "Escape":
        e.stopPropagation();
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
      "flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-small hover:bg-muted",
      i === activeIndex && "bg-muted"
    );

  return (
    <div className="relative" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="location-search"
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search any city or address…"
          className="pl-9 pr-11"
          role="combobox"
          aria-label="Search for a city or address"
          aria-expanded={showDropdown}
          aria-controls="location-search-listbox"
          aria-autocomplete="list"
          aria-busy={loading}
          autoComplete="off"
          aria-activedescendant={open && activeIndex >= 0 ? `location-option-${activeIndex}` : undefined}
        />
        {query !== "" && (
          <button
            type="button"
            aria-label="Clear location search"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuery("");
              setResults([]);
              setActiveIndex(-1);
              inputRef.current?.focus();
            }}
            className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto overscroll-contain rounded-lg border border-border bg-popover shadow-[var(--shadow-panel)]"
        >
          <div id="location-search-listbox" role="listbox" aria-label="Places" aria-busy={loading}>
          {trimmedQuery === "" && (
            <div className="p-1">
              <div className="px-3 py-1.5 text-xs text-muted-foreground">Try one of these</div>
              {options.map((opt, i) => (
                <button
                  key={opt.label}
                  // Explicitly a button, not a submit: this list can render
                  // inside a <form> (the Analyze scan panel), where an
                  // untyped button defaults to submit and would fire the scan
                  // on a location pick, before flyTo reaches the place.
                  type="button"
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

          {trimmedQuery !== "" && options.length > 0 && (
            <div className="p-1">
              {options.map((opt, i) => (
                <button
                  key={`${opt.lat},${opt.lng}`}
                  type="button"
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
          {loading && <p role="status" className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" aria-hidden="true" />Searching for places…</p>}
          {trimmedQuery !== "" && !loading && options.length === 0 && (
            <div className="px-3 py-3 text-sm text-muted-foreground">
              <p role="status">{unavailable ? "Place search is unavailable. You can still pan and zoom the map." : "No matches. Try a city and country, or pan and zoom the map directly."}</p>
              {unavailable && <button type="button" className="mt-2 min-h-11 font-medium text-primary" onMouseDown={(e) => e.preventDefault()} onClick={() => setRetry((value) => value + 1)}>Try search again</button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
