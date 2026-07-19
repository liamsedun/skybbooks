export function SectionSkeleton({ height = 'h-64' }: { height?: string }) {
  return (
    <div className={`w-full ${height} bg-slate-50 animate-pulse`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="flex flex-col items-center gap-6">
          <div className="w-20 h-3 rounded-full bg-slate-200" />
          <div className="w-72 h-6 rounded-lg bg-slate-200" />
          <div className="w-96 h-3 rounded bg-slate-100" />
          <div className="grid grid-cols-3 gap-6 w-full mt-8">
            <div className="h-40 rounded-2xl bg-slate-100" />
            <div className="h-40 rounded-2xl bg-slate-100" />
            <div className="h-40 rounded-2xl bg-slate-100" />
          </div>
        </div>
      </div>
    </div>
  );
}
