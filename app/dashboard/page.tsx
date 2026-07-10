'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { Siren, Activity, ShieldCheck } from 'lucide-react';
import PanicModal from '@/components/PanicModal';

// Mapbox GL needs the browser; load the canvas client-side only.
const MapCanvas = dynamic(() => import('@/components/MapCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <Activity className="h-8 w-8 animate-pulse text-amber-400" />
        <span className="text-sm">Loading live map…</span>
      </div>
    </div>
  ),
});

export default function DashboardPage() {
  const [panicOpen, setPanicOpen] = useState(false);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-slate-950 text-slate-50">
      {/* Top bar */}
      <header className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-4 py-3">
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 backdrop-blur-md">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-tight text-slate-50">
              RescueRoute
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Live Relief Canvas
            </div>
          </div>
        </div>
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 backdrop-blur-md">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs font-semibold text-slate-300">Realtime</span>
        </div>
      </header>

      {/* Map */}
      <div className="absolute inset-0">
        <MapCanvas />
      </div>

      {/* Panic FAB */}
      <motion.button
        onClick={() => setPanicOpen(true)}
        aria-label="Request help now — panic button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-2xl shadow-red-500/40 ring-4 ring-red-500/20 sm:h-20 sm:w-20"
      >
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/40" />
        <Siren className="relative h-8 w-8 sm:h-10 sm:w-10" />
      </motion.button>

      <PanicModal open={panicOpen} onClose={() => setPanicOpen(false)} />
    </main>
  );
}
