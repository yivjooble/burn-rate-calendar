export function LoadingSkeleton() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="h-14 border-b bg-background/95 backdrop-blur">
        <div className="h-full max-w-4xl mx-auto px-4 flex items-center justify-between">
          <div className="h-6 w-48 bg-muted animate-pulse rounded" />
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 w-24 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </div>
      </header>
      
      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
          
          {/* Calendar */}
          <div className="space-y-2">
            <div className="h-8 w-48 bg-muted animate-pulse rounded" />
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="aspect-square bg-muted animate-pulse rounded" />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
