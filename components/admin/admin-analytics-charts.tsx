"use client";

import { useMemo, useState } from "react";

export type AdminAnalyticsSalesPoint = {
  key: string;
  label: string;
  currentRevenue: number;
  previousRevenue: number;
  currentOrders: number;
  previousOrders: number;
};

export type AdminAnalyticsDonutSegment = {
  label: string;
  value: number;
  color: string;
  detail: string;
};

export type AdminAnalyticsTrafficPoint = {
  key: string;
  label: string;
  value: number;
};

type SalesChartProps = {
  points: AdminAnalyticsSalesPoint[];
  currentLabel: string;
  previousLabel: string | null;
  title?: string;
  subtitle?: string;
};

type DonutChartProps = {
  segments: AdminAnalyticsDonutSegment[];
  totalLabel: string;
};

type TrafficChartProps = {
  points: AdminAnalyticsTrafficPoint[];
};

const SVG_WIDTH = 760;
const SVG_HEIGHT = 280;
const CHART_LEFT = 58;
const CHART_RIGHT = 734;
const CHART_TOP = 36;
const CHART_BOTTOM = 226;
const CHART_WIDTH = CHART_RIGHT - CHART_LEFT;
const CHART_HEIGHT = CHART_BOTTOM - CHART_TOP;

function formatCompactCurrency(value: number) {
  if (value >= 1000) {
    return `P${Math.round(value / 1000)}K`;
  }

  return `P${Math.round(value)}`;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", { notation: value >= 1000 ? "compact" : "standard" }).format(value);
}

function buildLinePoints(values: number[], maxValue: number) {
  const safeValues = values.length ? values : [0];

  return safeValues.map((value, index) => {
    const x = safeValues.length === 1 ? CHART_LEFT + CHART_WIDTH / 2 : CHART_LEFT + (index / (safeValues.length - 1)) * CHART_WIDTH;
    const y = CHART_TOP + ((maxValue - value) / maxValue) * CHART_HEIGHT;

    return { x, y, value };
  });
}

function linePath(points: Array<{ x: number; y: number }>) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
}

function areaPath(points: Array<{ x: number; y: number }>) {
  if (!points.length) {
    return "";
  }

  return `M ${points[0].x.toFixed(2)} ${CHART_BOTTOM} ${points
    .map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ")} L ${points.at(-1)?.x.toFixed(2)} ${CHART_BOTTOM} Z`;
}

function getLabelStep(length: number) {
  if (length > 24) {
    return Math.ceil(length / 6);
  }

  if (length > 12) {
    return Math.ceil(length / 7);
  }

  return 1;
}

export function AdminAnalyticsSalesChart({
  points,
  currentLabel,
  previousLabel,
  title = "Sales Overview",
  subtitle = "Revenue and order movement for the selected period.",
}: SalesChartProps) {
  const [metric, setMetric] = useState<"revenue" | "orders">("revenue");
  const chartValues = useMemo(() => {
    const current = points.map((point) => metric === "revenue" ? point.currentRevenue : point.currentOrders);
    const previous = points.map((point) => metric === "revenue" ? point.previousRevenue : point.previousOrders);
    const maxValue = Math.max(...current, ...previous, 1);

    return {
      current,
      previous,
      currentPoints: buildLinePoints(current, maxValue),
      previousPoints: buildLinePoints(previous, maxValue),
      maxValue,
      hasData: current.some((value) => value > 0) || previous.some((value) => value > 0),
    };
  }, [metric, points]);
  const labelStep = getLabelStep(points.length);
  const yLabels = [1, 0.75, 0.5, 0.25, 0].map((ratio) => chartValues.maxValue * ratio);
  const yFormatter = metric === "revenue" ? formatCompactCurrency : formatCompactNumber;

  return (
    <div className="vh-admin-analytics-chart-card">
      <div className="vh-admin-panel__header">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <select value={metric} aria-label="Sales chart metric" onChange={(event) => setMetric(event.target.value as "revenue" | "orders")}>
          <option value="revenue">Revenue</option>
          <option value="orders">Orders</option>
        </select>
      </div>
      <div className="vh-admin-analytics-legend" aria-hidden="true">
        <span><b />{currentLabel}</span>
        {previousLabel ? <span><b data-variant="previous" />{previousLabel}</span> : null}
      </div>
      <div className="vh-admin-analytics-line-chart">
        <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} role="img" aria-label={`${metric} line chart`}>
          <defs>
            <linearGradient id="vh-analytics-revenue-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
            </linearGradient>
          </defs>
          {yLabels.map((value, index) => {
            const y = CHART_TOP + (index / (yLabels.length - 1)) * CHART_HEIGHT;

            return (
              <g key={value}>
                <line x1={CHART_LEFT} x2={CHART_RIGHT} y1={y} y2={y} />
                <text x="18" y={y + 4}>{yFormatter(value)}</text>
              </g>
            );
          })}
          <path d={areaPath(chartValues.currentPoints)} className="vh-admin-analytics-line-chart__area" fill="url(#vh-analytics-revenue-fill)" />
          {previousLabel ? (
            <path d={linePath(chartValues.previousPoints)} className="vh-admin-analytics-line-chart__previous" />
          ) : null}
          <path d={linePath(chartValues.currentPoints)} className="vh-admin-analytics-line-chart__current" />
          {chartValues.currentPoints.map((point, index) => (
            <circle key={`${points[index]?.key || index}-dot`} cx={point.x} cy={point.y} r="4" />
          ))}
          {points.map((point, index) => {
            if (index !== 0 && index !== points.length - 1 && index % labelStep !== 0) {
              return null;
            }

            const x = chartValues.currentPoints[index]?.x || CHART_LEFT;

            return <text key={`${point.key}-label`} x={x} y="260" textAnchor="middle">{point.label}</text>;
          })}
        </svg>
        {!chartValues.hasData ? (
          <div className="vh-admin-analytics-chart-empty">
            <strong>No sales data for this range.</strong>
            <p>Confirmed payments and orders will appear here when they exist in the selected period.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AdminAnalyticsDonutChart({ segments, totalLabel }: DonutChartProps) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const radius = 78;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="vh-admin-analytics-donut-wrap">
      <svg viewBox="0 0 210 210" role="img" aria-label="Sales by channel donut chart">
        <circle cx="105" cy="105" r={radius} className="vh-admin-analytics-donut__track" />
        {segments.map((segment) => {
          const length = total ? (segment.value / total) * circumference : 0;
          const circle = (
            <circle
              key={segment.label}
              cx="105"
              cy="105"
              r={radius}
              stroke={segment.color}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              className="vh-admin-analytics-donut__segment"
            />
          );
          offset += length;
          return circle;
        })}
        <text x="105" y="101" textAnchor="middle" className="vh-admin-analytics-donut__value">{totalLabel}</text>
        <text x="105" y="124" textAnchor="middle" className="vh-admin-analytics-donut__label">Total</text>
      </svg>
    </div>
  );
}

export function AdminAnalyticsTrafficChart({ points }: TrafficChartProps) {
  const safePoints = points.length ? points : [{ key: "empty", label: "No data", value: 0 }];
  const maxValue = Math.max(...safePoints.map((point) => point.value), 1);
  const width = 420;
  const height = 170;
  const left = 28;
  const right = width - 16;
  const top = 18;
  const bottom = height - 34;
  const usableWidth = right - left;
  const usableHeight = bottom - top;
  const svgPoints = safePoints.map((point, index) => ({
    ...point,
    x: safePoints.length === 1 ? left + usableWidth / 2 : left + (index / (safePoints.length - 1)) * usableWidth,
    y: top + ((maxValue - point.value) / maxValue) * usableHeight,
  }));
  const path = svgPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
  const fillPath = `M ${svgPoints[0]?.x || left} ${bottom} ${svgPoints
    .map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ")} L ${svgPoints.at(-1)?.x || right} ${bottom} Z`;
  const labelStep = getLabelStep(svgPoints.length);

  return (
    <div className="vh-admin-analytics-traffic-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Traffic overview chart">
        <defs>
          <linearGradient id="vh-analytics-traffic-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={fillPath} className="vh-admin-analytics-traffic-chart__area" fill="url(#vh-analytics-traffic-fill)" />
        <path d={path} className="vh-admin-analytics-traffic-chart__line" />
        {svgPoints.map((point, index) => (
          <g key={point.key}>
            <circle cx={point.x} cy={point.y} r="3" />
            {(index === 0 || index === svgPoints.length - 1 || index % labelStep === 0) ? (
              <text x={point.x} y="158" textAnchor="middle">{point.label}</text>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  );
}
