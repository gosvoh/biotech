// Заглушка раскладки админки на Tailwind (глобальный CSS — он уже в <head>,
// в отличие от рантайм-стилей Ant Design). Показывается как Suspense fallback,
// пока antd-оболочка монтируется на клиенте, чтобы не было «голой» страницы.
// Цвета и размеры повторяют AdminShell: Sider width 220 / тёмная тема (#001529),
// Header высотой 64px на белом фоне.
export default function AdminSkeleton() {
  return (
    <div className="flex min-h-screen animate-pulse">
      {/* Sider */}
      <aside className="hidden w-[220px] shrink-0 bg-[#001529] lg:block">
        <div className="flex h-12 items-center justify-center px-2">
          <div className="h-4 w-32 rounded bg-white/20" />
        </div>
        <div className="space-y-1 px-2 pt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 rounded bg-white/10" />
          ))}
        </div>
      </aside>

      {/* Правая часть */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex h-16 items-center justify-between gap-2 border-b border-[#f0f0f0] bg-white px-4">
          <div className="h-8 w-8 rounded bg-black/10 lg:hidden" />
          <div className="ml-auto flex items-center gap-3">
            <div className="h-4 w-20 rounded bg-black/10" />
            <div className="h-8 w-24 rounded bg-black/10" />
          </div>
        </header>

        {/* Content */}
        <main className="px-4 pb-6 sm:px-6">
          <div className="py-3">
            <div className="h-4 w-40 rounded bg-black/10" />
          </div>
          <div className="space-y-3">
            <div className="h-8 w-1/3 rounded bg-black/10" />
            <div className="h-64 rounded bg-black/5" />
          </div>
        </main>
      </div>
    </div>
  );
}
