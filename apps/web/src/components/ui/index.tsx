"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

type BadgeVariant = "sage" | "amber" | "crimson" | "blue" | "slate";

export function Badge({
  children,
  variant = "slate",
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
}) {
  const classes: Record<BadgeVariant, string> = {
    sage: "bg-[#E8F3EE] text-[#2D6A4F] border-[#CBE4D7]",
    amber: "bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]",
    crimson: "bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]",
    blue: "bg-[#EFF6FF] text-[#1D4ED8] border-[#DBEAFE]",
    slate: "bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]",
  };

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${classes[variant]}`}
    >
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  trendText,
  subText,
  icon,
  iconBg = "bg-[#E8F3EE] text-[#2D6A4F]",
  sparkline = [20, 32, 28, 45, 40, 56, 52, 68],
  sparkColor = "#2D6A4F",
}: {
  label: string;
  value: string;
  trendText?: string;
  subText?: string;
  icon: React.ReactNode;
  iconBg?: string;
  sparkline?: number[];
  sparkColor?: string;
}) {
  const min = Math.min(...sparkline);
  const max = Math.max(...sparkline);
  const span = max - min || 1;
  const width = 108;
  const height = 34;

  const points = sparkline
    .map((val, idx) => {
      const x = (idx / Math.max(1, sparkline.length - 1)) * width;
      const y = height - ((val - min) / span) * (height - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="rounded-2xl border border-[#E6E8E5] bg-white p-6 transition-colors hover:border-[#D4D9D2]">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-500">{label}</span>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
          {icon}
        </div>
      </div>

      <div className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">{value}</div>

      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          {trendText && (
            <div className="text-xs font-semibold text-[#2D6A4F]">↗ {trendText}</div>
          )}
          {subText && <div className="mt-0.5 text-xs text-zinc-400">{subText}</div>}
        </div>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
          <polyline
            fill="none"
            stroke={sparkColor}
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />
        </svg>
      </div>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = "max-w-2xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
      <div
        className={`flex max-h-[90vh] w-full ${maxWidth} flex-col rounded-2xl border border-[#E6E8E5] bg-white shadow-xl`}
      >
        <div className="flex items-start justify-between border-b border-[#E6E8E5] px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
            {subtitle && <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2.5 border-t border-[#E6E8E5] bg-[#F7F8F6] px-6 py-3.5 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = "max-w-xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  if (!open) return null;

  return (
    <div className="no-print fixed inset-0 z-50 flex justify-end bg-black/30">
      <div className={`flex h-full w-full ${width} flex-col border-l border-[#E6E8E5] bg-white shadow-2xl`}>
        <div className="flex items-start justify-between border-b border-[#E6E8E5] px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
            {subtitle && <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2.5 border-t border-[#E6E8E5] bg-[#F7F8F6] px-6 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}
