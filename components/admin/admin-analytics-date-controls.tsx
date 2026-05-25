"use client";

import { CalendarDays } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type AdminAnalyticsSelectOption = {
  value: string;
  label: string;
};

type Props = {
  rangeOptions: AdminAnalyticsSelectOption[];
  compareOptions: AdminAnalyticsSelectOption[];
  selectedRange: string;
  selectedCompare: string;
};

export function AdminAnalyticsDateControls({
  rangeOptions,
  compareOptions,
  selectedRange,
  selectedCompare,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: "range" | "compare", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="vh-admin-analytics-date-controls" aria-label="Analytics date controls">
      <label>
        <CalendarDays size={17} strokeWidth={1.9} aria-hidden="true" />
        <select value={selectedRange} onChange={(event) => updateParam("range", event.target.value)}>
          {rangeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Compare to:</span>
        <select value={selectedCompare} onChange={(event) => updateParam("compare", event.target.value)}>
          {compareOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
