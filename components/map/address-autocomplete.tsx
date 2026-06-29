"use client";

import { Loader2, MapPin, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type AddressSuggestion = {
  label: string;
  lat: number;
  lng: number;
  placeId: string | null;
  precision: string;
  components: {
    addressLine1?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    country?: string;
  };
};

type Props = {
  onSelect: (suggestion: AddressSuggestion) => void;
  placeholder?: string;
  proximity?: { lat: number; lng: number } | null;
  className?: string;
  label?: string;
  /** Uncontrolled seed text. */
  initialQuery?: string;
  /** Controlled mode: bind the input to external state (e.g. the address field). */
  value?: string;
  onValueChange?: (text: string) => void;
  /** Already-known location to keep the search in the right area (city/province). */
  context?: { city?: string; province?: string; postalCode?: string; country?: string };
};

export function AddressAutocomplete({
  onSelect,
  placeholder,
  proximity,
  className,
  label,
  initialQuery = "",
  value,
  onValueChange,
  context,
}: Props) {
  const isControlled = value !== undefined;
  const [internalQuery, setInternalQuery] = useState(initialQuery);
  const text = isControlled ? value : internalQuery;
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [hasSearched, setHasSearched] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const justSelectedRef = useRef(false);
  const userTypingRef = useRef(false);
  const listboxId = useId();

  function updateText(next: string) {
    if (isControlled) {
      onValueChange?.(next);
    } else {
      setInternalQuery(next);
    }
  }

  // Debounced search — but only when the user is actually typing, never when the
  // value changes programmatically (e.g. the map drag filling the address).
  useEffect(() => {
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }

    if (!userTypingRef.current) {
      return;
    }

    userTypingRef.current = false;
    const trimmed = text.trim();

    if (trimmed.length < 3) {
      setSuggestions([]);
      setLoading(false);
      setHasSearched(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        // Keep the search inside the already-known city/province so the geocoder
        // doesn't drift to a same-named street in a different town.
        const contextParts = [context?.city, context?.province, context?.country]
          .map((part) => (part || "").trim())
          .filter(Boolean);
        const queryWithContext = contextParts.length ? `${trimmed}, ${contextParts.join(", ")}` : trimmed;
        const params = new URLSearchParams({ q: queryWithContext });

        if (proximity && Number.isFinite(proximity.lat) && Number.isFinite(proximity.lng)) {
          params.set("lat", String(proximity.lat));
          params.set("lng", String(proximity.lng));
        }

        const response = await fetch(`/api/maps/search?${params.toString()}`);
        const payload = (await response.json().catch(() => null)) as { results?: AddressSuggestion[] } | null;

        if (!cancelled) {
          setSuggestions(payload?.results || []);
          setHasSearched(true);
          setOpen(true);
          setActiveIndex(-1);
        }
      } catch {
        if (!cancelled) {
          setSuggestions([]);
          setHasSearched(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [text, proximity?.lat, proximity?.lng, context?.city, context?.province, context?.country]);

  useEffect(() => {
    function handlePointerDown(event: globalThis.PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function choose(suggestion: AddressSuggestion) {
    justSelectedRef.current = true;
    userTypingRef.current = false;
    updateText(suggestion.label);
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
    onSelect(suggestion);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      choose(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={cn("vh-address-search", className)}>
      {label ? <span className="vh-address-search__label">{label}</span> : null}
      <div className="vh-address-search__field">
        <Search size={16} strokeWidth={1.9} aria-hidden="true" className="vh-address-search__icon" />
        <input
          type="text"
          className="vh-address-search__input"
          value={text}
          placeholder={placeholder || "Search building, street, or area"}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          onChange={(event) => {
            userTypingRef.current = true;
            updateText(event.target.value);
          }}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {loading ? <Loader2 size={16} className="vh-address-search__spinner" aria-hidden="true" /> : null}
      </div>
      {open ? (
        <ul className="vh-address-search__list" id={listboxId} role="listbox">
          {suggestions.map((suggestion, index) => (
            <li key={`${suggestion.placeId || suggestion.label}-${index}`} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                className={cn("vh-address-search__option", index === activeIndex && "vh-address-search__option--active")}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(suggestion)}
              >
                <MapPin size={15} strokeWidth={1.8} aria-hidden="true" />
                <span>{suggestion.label}</span>
              </button>
            </li>
          ))}
          {!loading && hasSearched && suggestions.length === 0 ? (
            <li className="vh-address-search__empty" role="presentation">
              No matching places. Try a nearby landmark or street.
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
