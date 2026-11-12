import { useMemo } from "react";
import type { ComponentProps } from "react";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as C,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  RadialLinearScale,
  Tooltip,
  DoughnutController,
  BarController,
  LineController,
  RadarController,
} from "chart.js";
import { Doughnut, Bar, Line, Radar } from "react-chartjs-2";

C.register(
  ArcElement,
  BarElement,
  PointElement,
  LineElement,
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  Filler,
  Tooltip,
  Legend,
  DoughnutController,
  BarController,
  LineController,
  RadarController,
);

const grid = "rgba(255,255,255,0.055)";
const tick = "#8b9cae";

const baseTooltip = {
  backgroundColor: "#0b1219",
  borderColor: "rgba(255,255,255,0.14)",
  borderWidth: 1,
  titleColor: "#ece5d8",
  bodyColor: "#c3d0dc",
  titleFont: { family: "IBM Plex Mono", size: 11 },
  bodyFont: { family: "IBM Plex Sans", size: 12 },
  padding: 10,
  cornerRadius: 3,
  displayColors: true,
  boxWidth: 8,
  boxHeight: 8,
  usePointStyle: true,
};

export function Donut({
  data,
  colors,
  labels,
  active,
  onSelect,
}: {
  data: number[];
  colors: string[];
  labels: string[];
  active: boolean[];
  onSelect: (index: number) => void;
}) {
  const cfg = useMemo(
    () => ({
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: colors,
            borderColor: "#0a1017",
            borderWidth: 3,
            hoverOffset: 12,
            offset: active.map((a) => (a ? 10 : 0)),
            hoverBorderColor: "#0a1017",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        rotation: -96,
        layout: { padding: 6 },
        animation: { animateRotate: true, duration: 900 },
        onClick: (_e: unknown, els: { index: number }[]) => els.length && onSelect(els[0].index),
        onHover: (e: { native?: boolean; chart?: { canvas: { style: { cursor: string } } } }) => {
          if (e.native && e.chart) e.chart.canvas.style.cursor = "pointer";
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...baseTooltip,
            callbacks: {
              label: (c: { label: string; parsed: number; dataset: { data: number[] } }) =>
                ` ${c.label}: ${c.parsed} (${Math.round(
                  (c.parsed / c.dataset.data.reduce((a, b) => a + b, 0)) * 100,
                )}%)`,
            },
          },
        },
      },
    }),
    [data, colors, labels, active],
  );
  return <Doughnut {...(cfg as unknown as ComponentProps<typeof Doughnut>)} />;
}

export function TrendLines({
  labels,
  series,
}: {
  labels: string[];
  series: { label: string; color: string; data: number[] }[];
}) {
  const cfg = {
    data: {
      labels,
      datasets: series.map((s) => ({
        label: s.label,
        data: s.data,
        borderColor: s.color,
        backgroundColor: s.color + "22",
        borderWidth: 2,
        tension: 0.38,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: s.color,
        pointHoverBorderColor: "#0a1017",
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index" as const, intersect: false },
      scales: {
        x: {
          stacked: true,
          grid: { color: grid },
          ticks: { color: tick, font: { family: "IBM Plex Mono", size: 10 }, maxRotation: 0 },
          border: { color: "rgba(255,255,255,0.1)" },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: { color: grid },
          ticks: { color: tick, font: { family: "IBM Plex Mono", size: 10 }, precision: 0 },
          border: { display: false },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: { ...baseTooltip, mode: "index", intersect: false },
      },
      animation: { duration: 800, easing: "easeOutQuart" as const },
    },
  };
  return <Line {...(cfg as unknown as ComponentProps<typeof Line>)} />;
}

export function HBars({
  labels,
  values,
  colors,
}: {
  labels: string[];
  values: number[];
  colors: string[];
}) {
  const cfg = {
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
          borderRadius: 2,
          barThickness: 13,
          hoverBackgroundColor: colors.map((c) => c.replace(")", ",1)")),
        },
      ],
    },
    options: {
      indexAxis: "y" as const,
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: grid },
          ticks: { color: tick, font: { family: "IBM Plex Mono", size: 10 }, precision: 0 },
          border: { display: false },
        },
        y: {
          grid: { display: false },
          ticks: { color: "#dbe4ec", font: { family: "IBM Plex Sans", size: 11 } },
          border: { color: "rgba(255,255,255,0.1)" },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: { ...baseTooltip, displayColors: false, callbacks: { title: (i: { label: string }[]) => i[0].label } },
      },
      animation: { duration: 850 },
    },
  };
  return <Bar {...(cfg as unknown as ComponentProps<typeof Bar>)} />;
}

export function HealthRadar({
  labels,
  series,
}: {
  labels: string[];
  series: { label: string; color: string; data: number[] }[];
}) {
  const cfg = {
    data: {
      labels,
      datasets: series.map((s) => ({
        label: s.label,
        data: s.data,
        borderColor: s.color,
        backgroundColor: s.color + "26",
        borderWidth: 1.8,
        pointBackgroundColor: s.color,
        pointRadius: 2.6,
        pointHoverRadius: 5,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          min: 0,
          max: 100,
          angleLines: { color: "rgba(255,255,255,0.08)" },
          grid: { color: "rgba(255,255,255,0.09)" },
          pointLabels: { color: "#9fb0c0", font: { family: "IBM Plex Mono", size: 10 } },
          ticks: { display: false, stepSize: 25 },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: { ...baseTooltip, callbacks: { label: (c: { datasetKey: string; parsed: { r: number } }) => ` ${c.datasetKey}: ${c.parsed.r}` } },
      },
      animation: { duration: 800 },
    },
  };
  return <Radar {...(cfg as unknown as ComponentProps<typeof Radar>)} />;
}
