'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, { Marker, MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Heart, X, Clock, MapPin, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { supabaseClient } from '@/lib/supabase-client';
import { DEFAULT_MAP_CENTER, DEFAULT_ZOOM, MAP_STYLE } from '@/lib/config';
import {
  CATEGORY_LABELS,
  TYPE_LABELS,
  URGENCY_LABELS,
  type Ticket,
} from '@/types/ticket';
import { cn } from '@/lib/utils';

const URGENCY_STYLES: Record<
  Ticket['urgency'],
  { core: string; ring: string; pulse: boolean; label: string }
> = {
  critical: { core: 'bg-red-500', ring: 'bg-red-500/60', pulse: true, label: 'Critical' },
  high: { core: 'bg-amber-500', ring: 'bg-amber-500/50', pulse: true, label: 'High' },
  medium: { core: 'bg-amber-300', ring: 'bg-amber-300/40', pulse: false, label: 'Medium' },
  low: { core: 'bg-slate-400', ring: 'bg-slate-400/40', pulse: false, label: 'Low' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function TicketMarker({
  ticket,
  onSelect,
  isSelected,
}: {
  ticket: Ticket;
  onSelect: (t: Ticket) => void;
  isSelected: boolean;
}) {
  const isOffer = ticket.type === 'offer_help';
  const style = isOffer
    ? { core: 'bg-emerald-500', ring: 'bg-emerald-500/50', pulse: false, label: 'Offer' }
    : URGENCY_STYLES[ticket.urgency];

  return (
    <Marker
      latitude={ticket.latitude}
      longitude={ticket.longitude}
      anchor="bottom"
    >
      <motion.button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(ticket);
        }}
        aria-label={`${TYPE_LABELS[ticket.type]}, ${style.label}, ${CATEGORY_LABELS[ticket.category]}: ${ticket.description.slice(0, 80)}`}
        className={cn(
          'relative flex h-4 w-4 items-center justify-center rounded-full border-2 border-white/80 shadow-lg outline-none transition-transform',
          style.core,
          isSelected && 'z-50 scale-150'
        )}
        whileHover={{ scale: 1.4 }}
        whileTap={{ scale: 0.95 }}
      >
        {style.pulse && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
              style.ring
            )}
          />
        )}
        <span className="relative h-1.5 w-1.5 rounded-full bg-white" />
      </motion.button>
    </Marker>
  );
}

function DetailDrawer({
  ticket,
  onClose,
  onClaim,
  claiming,
  claimed,
}: {
  ticket: Ticket | null;
  onClose: () => void;
  onClaim: (t: Ticket) => void;
  claiming: boolean;
  claimed: boolean;
}) {
  return (
    <AnimatePresence>
      {ticket && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            key={ticket.id}
            className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md rounded-t-2xl border border-slate-800 bg-slate-900/95 p-5 backdrop-blur-md sm:left-auto sm:right-4 sm:top-4 sm:bottom-auto sm:max-w-sm sm:rounded-2xl"
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide',
                    ticket.urgency === 'critical' && 'bg-red-500/20 text-red-400',
                    ticket.urgency === 'high' && 'bg-amber-500/20 text-amber-400',
                    ticket.urgency === 'medium' && 'bg-amber-300/20 text-amber-200',
                    ticket.urgency === 'low' && 'bg-slate-400/20 text-slate-300'
                  )}
                >
                  <ShieldAlert className="h-3 w-3" />
                  {URGENCY_LABELS[ticket.urgency]}
                </span>
                <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300">
                  {CATEGORY_LABELS[ticket.category]}
                </span>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-semibold',
                    ticket.type === 'offer_help'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-sky-500/20 text-sky-400'
                  )}
                >
                  {TYPE_LABELS[ticket.type]}
                </span>
              </div>
              <button
                onClick={onClose}
                aria-label="Close details"
                className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-4 text-sm leading-relaxed text-slate-200">
              {ticket.description}
            </p>

            <div className="mb-4 flex flex-col gap-2 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Reported {timeAgo(ticket.created_at)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {ticket.latitude.toFixed(4)}, {ticket.longitude.toFixed(4)}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 font-semibold',
                  ticket.status === 'open' && 'text-sky-400',
                  ticket.status === 'claimed' && 'text-amber-400',
                  ticket.status === 'resolved' && 'text-emerald-400'
                )}
              >
                {ticket.status === 'resolved' ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Heart className="h-3.5 w-3.5" />
                )}
                {ticket.status === 'open'
                  ? 'Awaiting a responder'
                  : ticket.status === 'claimed'
                    ? 'Claimed by a responder'
                    : 'Resolved'}
              </span>
            </div>

            {ticket.type === 'request_help' && ticket.status === 'open' && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={claiming || claimed}
                onClick={() => onClaim(ticket)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/30 transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Heart className="h-4 w-4" />
                {claiming ? 'Claiming…' : claimed ? 'Claimed' : 'Claim This Request'}
              </motion.button>
            )}
            {ticket.status === 'claimed' && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-300">
                A responder has already claimed this request.
              </div>
            )}
            {ticket.status === 'resolved' && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">
                This request has been resolved.
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export default function MapCanvas() {
  const mapRef = useRef<MapRef>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimedId, setClaimedId] = useState<string | null>(null);
  const [viewState, setViewState] = useState({
    longitude: DEFAULT_MAP_CENTER.lng,
    latitude: DEFAULT_MAP_CENTER.lat,
    zoom: DEFAULT_ZOOM,
  });

  // Keep the selected drawer in sync with realtime updates so the status badge
  // and claim button reflect the latest server state.
  useEffect(() => {
    if (!selected) return;
    const updated = tickets.find((t) => t.id === selected.id);
    if (updated && updated.updated_at !== selected.updated_at) {
      setSelected(updated);
    }
  }, [tickets, selected]);

  const upsertTicket = useCallback((t: Ticket) => {
    setTickets((prev) => {
      const idx = prev.findIndex((p) => p.id === t.id);
      if (idx === -1) return [...prev, t];
      const next = [...prev];
      next[idx] = t;
      return next;
    });
  }, []);

  // Initial fetch + realtime subscription.
  useEffect(() => {
    let channel: ReturnType<typeof supabaseClient.channel> | null = null;

    (async () => {
      const { data, error } = await supabaseClient
        .from('tickets')
        .select('*')
        .in('status', ['open', 'claimed'])
        .order('created_at', { ascending: false });

      if (error) {
        toast.error('Could not load the live map. Retrying…');
        return;
      }
      if (data) setTickets(data as Ticket[]);

      channel = supabaseClient
        .channel('tickets-realtime')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'tickets' },
          (payload) => upsertTicket(payload.new as Ticket)
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'tickets' },
          (payload) => upsertTicket(payload.new as Ticket)
        )
        .subscribe();
    })();

    return () => {
      if (channel) supabaseClient.removeChannel(channel);
    };
  }, [upsertTicket]);

  const handleClaim = useCallback(
    async (t: Ticket) => {
      setClaiming(true);
      // Optimistic: disable the button immediately.
      try {
        const { data, error } = await supabaseClient
          .from('tickets')
          .update({ status: 'claimed', claimed_at: new Date().toISOString() })
          .eq('id', t.id)
          .eq('status', 'open')
          .select()
          .single();

        if (error || !data) {
          throw new Error(error?.message ?? 'Claim failed');
        }
        setClaimedId(t.id);
        setSelected(data as Ticket);
        toast.success('You claimed this request. Help is coordinated.');
      } catch (err) {
        // Roll back the optimistic state.
        setClaimedId(null);
        toast.error('Could not claim — someone may have just taken it.');
      } finally {
        setClaiming(false);
      }
    },
    []
  );

  const stats = useMemo(() => {
    const open = tickets.filter((t) => t.status === 'open').length;
    const claimed = tickets.filter((t) => t.status === 'claimed').length;
    const critical = tickets.filter(
      (t) => t.urgency === 'critical' && t.status === 'open'
    ).length;
    const offers = tickets.filter((t) => t.type === 'offer_help').length;
    return { open, claimed, critical, offers };
  }, [tickets]);

  return (
    <div className="relative h-full w-full">
      <Map
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        mapStyle={MAP_STYLE}
        ref={mapRef}
        style={{ width: '100%', height: '100%' }}
        attributionControl
      >
        <AnimatePresence>
          {tickets.map((t) => (
            <TicketMarker
              key={t.id}
              ticket={t}
              onSelect={setSelected}
              isSelected={selected?.id === t.id}
            />
          ))}
        </AnimatePresence>
      </Map>

      {/* Live stats overlay */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="pointer-events-none absolute left-4 top-4 z-10 flex flex-wrap gap-2"
      >
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 backdrop-blur-md">
          <div className="text-2xl font-bold text-slate-50">{stats.open}</div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Open
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 backdrop-blur-md">
          <div className="text-2xl font-bold text-amber-400">{stats.claimed}</div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Claimed
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 backdrop-blur-md">
          <div className="text-2xl font-bold text-red-500">{stats.critical}</div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Critical
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 backdrop-blur-md">
          <div className="text-2xl font-bold text-emerald-500">{stats.offers}</div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Offers
          </div>
        </div>
      </motion.div>

      <DetailDrawer
        ticket={selected}
        onClose={() => setSelected(null)}
        onClaim={handleClaim}
        claiming={claiming}
        claimed={claimedId === selected?.id}
      />
    </div>
  );
}
