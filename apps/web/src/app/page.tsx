import { HealthStatus } from "@/components/HealthStatus";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-6 font-sans dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col gap-8 rounded-2xl border border-zinc-200 bg-white p-10 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            Next.js 16 • NestJS 12 • Prisma • PostgreSQL
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            OOAD Bookstore
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Full-stack project scaffold running with Docker Compose.
          </p>
        </div>

        <HealthStatus />
      </main>
    </div>
  );
}
