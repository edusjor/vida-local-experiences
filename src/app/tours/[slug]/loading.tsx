export default function TourDetailLoading() {
  return (
    <section className="relative overflow-hidden bg-[radial-gradient(circle_at_20%_12%,rgba(16,185,129,0.18),transparent_40%),radial-gradient(circle_at_85%_82%,rgba(245,158,11,0.2),transparent_34%),linear-gradient(180deg,#f8fbfa_0%,#ecf3f1_100%)]">
      <div className="mx-auto flex min-h-[70vh] w-full max-w-6xl flex-col items-center justify-center px-4 py-16 text-center">
        <div className="rounded-2xl border border-emerald-200/70 bg-white/85 px-8 py-8 shadow-[0_18px_45px_rgba(15,23,42,0.14)] backdrop-blur-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-2xl font-black text-white">GL</div>
          <div className="mx-auto mt-5 h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" aria-hidden="true" />
          <p className="mt-4 text-base font-extrabold text-slate-800">Cargando tour...</p>
          <p className="mt-1 text-sm text-slate-600">Estamos preparando la experiencia para ti.</p>
        </div>
      </div>
    </section>
  );
}
