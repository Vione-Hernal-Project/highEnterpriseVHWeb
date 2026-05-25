"use client";

import { useMemo, useState } from "react";

export type AdminSalesRangeKey = "today" | "last7" | "last30" | "month" | "all";

export type AdminSalesPoint = {
  key: string;
  label: string;
  value: number;
};

export type AdminSalesDataset = {
  key: AdminSalesRangeKey;
  label: string;
  description: string;
  points: AdminSalesPoint[];
};

type Props = {
  datasets: AdminSalesDataset[];
};

const RANGE_OPTIONS: Array<{ key: AdminSalesRangeKey; label: string }> = [
  { key: "today", label: "Today" },
  { key: "last7", label: "Last 7 days" },
  { key: "last30", label: "Last 30 days" },
  { key: "month", label: "This month" },
  { key: "all", label: "All time" },
];

const CHART_WIDTH = 620;
const CHART_LEFT = 78;
const CHART_RIGHT = 582;
const CHART_TOP = 34;
const CHART_BOTTOM = 178;

function getNiceMax(value: number) {
  if (value <= 0) {
    return 1000;
  }

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;

  return niceNormalized * magnitude;
}

function formatAxisAmount(value: number) {
  return `₱${Math.round(value).toLocaleString("en-PH")}`;
}

function formatPhp(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function buildChart(points: AdminSalesPoint[]) {
  const safePoints = points.length ? points : [{ key: "empty", label: "No data", value: 0 }];
  const max = getNiceMax(Math.max(...safePoints.map((point) => point.value), 0));
  const usableWidth = CHART_RIGHT - CHART_LEFT;
  const usableHeight = CHART_BOTTOM - CHART_TOP;
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((ratio) => ({
    value: max * ratio,
    y: CHART_BOTTOM - ratio * usableHeight,
  }));

  const svgPoints = safePoints.map((point, index) => {
    const x = safePoints.length === 1 ? (CHART_LEFT + CHART_RIGHT) / 2 : CHART_LEFT + (index / (safePoints.length - 1)) * usableWidth;
    const y = CHART_BOTTOM - (point.value / max) * usableHeight;

    return {
      ...point,
      x,
      y,
    };
  });

  return { points: svgPoints, ticks };
}

export function AdminSalesOverview({ datasets }: Props) {
  const [selectedRange, setSelectedRange] = useState<AdminSalesRangeKey>("last7");
  const selectedDataset = datasets.find((dataset) => dataset.key === selectedRange) || datasets[0];
  const chart = useMemo(() => buildChart(selectedDataset?.points || []), [selectedDataset]);
  const svgPoints = chart.points;
  const chartPath = svgPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const chartArea = `M ${svgPoints[0]?.x || CHART_LEFT} ${CHART_BOTTOM} ${svgPoints
    .map((point) => `L ${point.x} ${point.y}`)
    .join(" ")} L ${svgPoints.at(-1)?.x || CHART_RIGHT} ${CHART_BOTTOM} Z`;
  const labelStep = svgPoints.length > 20 ? Math.ceil(svgPoints.length / 6) : svgPoints.length > 12 ? Math.ceil(svgPoints.length / 7) : 1;
  const shouldShowLabel = (index: number) => {
    if (svgPoints.length <= 1) {
      return true;
    }

    if (index === 0) {
      return true;
    }

    if (index === svgPoints.length - 1) {
      const previousShownIndex = Math.floor((index - 1) / labelStep) * labelStep;
      const previousShownPoint = svgPoints[previousShownIndex];

      return !previousShownPoint || Math.abs(svgPoints[index].x - previousShownPoint.x) > 54;
    }

    return index % labelStep === 0;
  };

  return (
    <section className="vh-admin-panel vh-admin-panel--wide">
      <div className="vh-admin-panel__header">
        <div>
          <h2>Sales Overview</h2>
          <p>{selectedDataset.description}</p>
        </div>
        <select
          value={selectedRange}
          aria-label="Sales range"
          onChange={(event) => setSelectedRange(event.target.value as AdminSalesRangeKey)}
        >
          {RANGE_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="vh-admin-chart" aria-label={`${selectedDataset.label} revenue line chart`}>
        <svg viewBox={`0 0 ${CHART_WIDTH} 225`} role="img">
          <defs>
            <linearGradient id="vh-admin-chart-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
            </linearGradient>
          </defs>
          {chart.ticks.map((tick) => (
            <g key={tick.value}>
              <line x1={CHART_LEFT} x2={CHART_RIGHT} y1={tick.y} y2={tick.y} stroke="#edf0f6" strokeWidth="1" />
              <text x={CHART_LEFT - 12} y={tick.y + 4} textAnchor="end">
                {formatAxisAmount(tick.value)}
              </text>
            </g>
          ))}
          <path d={chartArea} fill="url(#vh-admin-chart-fill)" />
          <path d={chartPath} fill="none" stroke="#7c3aed" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
          {svgPoints.map((point, index) => (
            <g key={point.key}>
              <title>{`${point.label}: ${formatPhp(point.value)}`}</title>
              <circle cx={point.x} cy={point.y} r="4" fill="#7c3aed" />
              {shouldShowLabel(index) ? (
                <text x={point.x} y="205" textAnchor="middle">
                  {point.label}
                </text>
              ) : null}
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}
