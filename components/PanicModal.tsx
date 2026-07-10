'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  HeartPulse,
  Droplets,
  Home,
  Footprints,
  HelpCircle,
  X,
  MapPin,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { z } from 'zod';
import { supabaseClient } from '@/lib/supabase-client';
import { DEFAULT_MAP_CENTER } from '@/lib/config';
import { ticketCategoryEnum } from '@/types/ticket';
import { cn } from '@/lib/utils';

type Category = z.infer<typeof ticketCategoryEnum>;

const CATEGORIES: { value: Category; label: string; icon: typeof HeartPulse; color: string }[] = [
  { value: 'medical', label: 'Medical', icon: HeartPulse, color: 'text-red-400' },
  { value: 'water_food', label: 'Water / Food', icon: Droplets, color: 'text-sky-400' },
  { value: 'shelter', label: 'Shelter', icon: Home, color: 'text-amber-400' },
  { value: 'evacuation', label: 'Evacuation', icon: Footprints, color: 'text-emerald-400' },
  { value: 'other', label: 'Other', icon: HelpCircle, color: 'text-slate-300' },
];

type Step = 'category' | 'locate' | 'submitting' | 'success';

export default function PanicModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<Step>('category');
  const [category, setCategory] = useState<Category | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoFailed, setGeoFailed] = useState(false);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);

  function reset() {
    setStep('category');
    setCategory(null);
    setCoords(null);
    setLocating(false);
    setGeoFailed(false);
    setPin(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function pickCategory(c: Category) {
    setCategory(c);
    // Every tap moves the user forward — no "Next" button.
    setStep('locate');
    requestLocation();
  }

  function requestLocation() {
    setLocating(true);
    setGeoFailed(false);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      // No geolocation API at all — fall back to default center + draggable pin.
      setLocating(false);
      setGeoFailed(true);
      setPin({ lat: DEFAULT_MAP_CENTER.lat, lng: DEFAULT_MAP_CENTER.lng });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setPin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        // Denied or failed — fall back to default center, let user drag the pin.
        setLocating(false);
        setGeoFailed(true);
        setPin({ lat: DEFAULT_MAP_CENTER.lat, lng: DEFAULT_MAP_CENTER.lng });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }

  async function submit() {
    if (!category || !pin) return;
    setStep('submitting');
    try {
      // Bypass the AI route — category is already known structurally.
      const { data, error } = await supabaseClient
        .from('tickets')
        .insert({
          type: 'request_help',
          category,
          urgency: 'critical',
          description: `Panic button request — ${category}. Location shared by reporter.`,
          latitude: pin.lat,
          longitude: pin.lng,
        })
        .select()
        .single();

      if (error || !data) throw new Error(error?.message ?? 'Insert failed');
      setStep('success');
      // Auto-close after reassurance.
      setTimeout(() => {
        handleClose();
      }, 2600);
    } catch (err) {
      toast.error('Could not send your request. Please try again.');
      setStep('locate');
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative w-full max-w-md rounded-t-3xl border border-slate-800 bg-slate-900/95 p-6 backdrop-blur-md sm:rounded-3xl"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 260 }}
          >
            <button
              onClick={handleClose}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <AnimatePresence mode="wait">
              {/* Step 1 — Category grid */}
              {step === 'category' && (
                <motion.div
                  key="category"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <h2 className="mb-1 text-2xl font-bold tracking-tight text-slate-50">
                    What do you need?
                  </h2>
                  <p className="mb-5 text-sm text-slate-400">
                    Tap one. We&apos;ll get your location next.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {CATEGORIES.map((c) => (
                      <motion.button
                        key={c.value}
                        type="button"
                        onClick={() => pickCategory(c.value)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex flex-col items-center gap-2 rounded-2xl border border-slate-800 bg-slate-800/50 p-5 transition-colors hover:border-slate-700 hover:bg-slate-800"
                      >
                        <c.icon className={cn('h-8 w-8', c.color)} />
                        <span className="text-sm font-semibold text-slate-100">
                          {c.label}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Step 2 — Locate + submit */}
              {(step === 'locate' || step === 'submitting') && (
                <motion.div
                  key="locate"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <h2 className="mb-1 text-2xl font-bold tracking-tight text-slate-50">
                    Share your location
                  </h2>
                  <p className="mb-5 text-sm text-slate-400">
                    {locating
                      ? 'Finding you on the map…'
                      : geoFailed
                        ? 'We couldn&apos;t get your exact spot. Drag the pin to where you are.'
                        : 'Got it. Confirm and send your request.'}
                  </p>

                  {locating && (
                    <div className="mb-5 flex flex-col items-center gap-3 rounded-2xl border border-slate-800 bg-slate-800/40 py-8">
                      <motion.div
                        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <MapPin className="h-10 w-10 text-amber-400" />
                      </motion.div>
                      <p className="text-sm text-slate-300">Locating you…</p>
                    </div>
                  )}

                  {!locating && pin && (
                    <div className="mb-5">
                      <div className="mb-2 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-800/40 px-4 py-3">
                        <span className="inline-flex items-center gap-2 text-sm text-slate-300">
                          <MapPin className="h-4 w-4 text-amber-400" />
                          {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
                        </span>
                        {geoFailed && (
                          <button
                            onClick={requestLocation}
                            className="text-xs font-semibold text-amber-400 hover:text-amber-300"
                          >
                            Retry
                          </button>
                        )}
                      </div>
                      {geoFailed && (
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-xs font-semibold text-slate-400">
                            Latitude
                            <input
                              type="number"
                              step="0.0001"
                              value={pin.lat}
                              onChange={(e) =>
                                setPin({ ...pin, lat: Number(e.target.value) })
                              }
                              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                            />
                          </label>
                          <label className="text-xs font-semibold text-slate-400">
                            Longitude
                            <input
                              type="number"
                              step="0.0001"
                              value={pin.lng}
                              onChange={(e) =>
                                setPin({ ...pin, lng: Number(e.target.value) })
                              }
                              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  {!locating && pin && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={submit}
                      disabled={step === 'submitting'}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500 px-6 py-5 text-lg font-bold text-white shadow-lg shadow-red-500/30 transition-colors hover:bg-red-600 disabled:opacity-70"
                    >
                      {step === 'submitting' ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Sending…
                        </>
                      ) : (
                        <>
                          <HeartPulse className="h-5 w-5" />
                          Submit Location &amp; Request Help
                        </>
                      )}
                    </motion.button>
                  )}
                </motion.div>
              )}

              {/* Step 3 — Success reassurance */}
              {step === 'success' && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex flex-col items-center py-8 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
                    className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20"
                  >
                    <CheckCircle2 className="h-9 w-9 text-emerald-400" />
                  </motion.div>
                  <h2 className="mb-2 text-2xl font-bold tracking-tight text-slate-50">
                    Help is on the way
                  </h2>
                  <p className="max-w-xs text-sm text-slate-400">
                    Your request is live on the map. Responders can see it and claim it now.
                    Stay safe.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
