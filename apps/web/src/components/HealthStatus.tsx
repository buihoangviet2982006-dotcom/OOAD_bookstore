"use client";

import { useEffect, useState } from "react";

type HealthResponse = {
  status: string;
  database: string;
  timestamp: string;
  error?: string;
};

export function HealthStatus() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

  useEffect(() => {
    let active = true;
    fetch(`${apiUrl}/health`)
      .then(async (res) => {
        const json = (await res.json()) as HealthResponse;
        if (active) {
          setData(json);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to reach API");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [apiUrl]);

  return (
    <div className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          System Health
        </h2>
        <span className="font-mono text-xs text-zinc-500">{apiUrl}/health</span>
      </div>

      {loading ? (
        <p className="mt-3 text-sm text-zinc-500">Checking API &amp; PostgreSQL...</p>
      ) : error ? (
        <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">
          API unreachable: {error}
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-white p-3 shadow-xs dark:bg-zinc-950">
            <div className="text-xs text-zinc-500">NestJS API</div>
            <div className="mt-1 font-semibold text-emerald-600 dark:text-emerald-400">
              {data?.status ?? "unknown"}
            </div>
          </div>
          <div className="rounded-lg bg-white p-3 shadow-xs dark:bg-zinc-950">
            <div className="text-xs text-zinc-500">PostgreSQL (Prisma)</div>
            <div
              className={`mt-1 font-semibold ${
                data?.database === "connected"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {data?.database ?? "unknown"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
