export default function Loading() {
  return (
    <div className="animate-pulse space-y-10">
      <section className="space-y-3">
        <div className="h-9 w-48 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-5 w-96 max-w-full rounded bg-zinc-100 dark:bg-zinc-900" />
        <div className="flex gap-3 pt-2">
          <div className="h-10 w-28 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-10 w-20 rounded-lg bg-zinc-100 dark:bg-zinc-900" />
        </div>
      </section>

      <section className="space-y-3">
        <div className="h-5 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-7 w-20 rounded-full bg-zinc-100 dark:bg-zinc-900" />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-28 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-5 w-16 rounded bg-zinc-100 dark:bg-zinc-900" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-black"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="h-6 flex-1 rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-6 w-10 rounded bg-zinc-100 dark:bg-zinc-900" />
              </div>
              <div className="mt-3 space-y-2">
                <div className="h-4 w-full rounded bg-zinc-100 dark:bg-zinc-900" />
                <div className="h-4 w-3/4 rounded bg-zinc-100 dark:bg-zinc-900" />
              </div>
              <div className="mt-3 flex gap-2">
                <div className="h-4 w-20 rounded bg-zinc-100 dark:bg-zinc-900" />
                <div className="h-4 w-24 rounded bg-zinc-100 dark:bg-zinc-900" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
