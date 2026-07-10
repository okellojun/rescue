import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { getSupabaseServer } from '@/lib/supabase-server';
import { DEFAULT_MAP_CENTER, RATE_LIMIT } from '@/lib/config';
import {
  aiIncidentSchema,
  parseIncidentRequestSchema,
  ticketInsertSchema,
  type Ticket,
} from '@/types/ticket';

export const runtime = 'nodejs';

// --- Rate limiting (in-memory token bucket per IP) -----------------------
// Hackathon stand-in. In production use Upstash Redis so the limit is shared
// across serverless instances; in-memory state is per-instance and resets on
// cold start, so it only approximates the limit.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return true;
  }
  if (bucket.count >= RATE_LIMIT.maxRequests) return false;
  bucket.count += 1;
  return true;
}

function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return 'unknown';
}

// --- OpenAI client (lazy, server-only) ------------------------------------
function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
  return new OpenAI({ apiKey });
}

// JSON schema derived from the Zod schema, handed to OpenAI Structured Outputs
// so the model is contractually forced to return the exact shape.
const openaiResponseSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['request_help', 'offer_help'] },
    category: {
      type: 'string',
      enum: ['medical', 'water_food', 'shelter', 'evacuation', 'other'],
    },
    urgency: {
      type: 'string',
      enum: ['critical', 'high', 'medium', 'low'],
    },
    description: { type: 'string', maxLength: 500 },
    latitude: { type: 'number', minimum: -90, maximum: 90 },
    longitude: { type: 'number', minimum: -180, maximum: 180 },
  },
  required: [
    'type',
    'category',
    'urgency',
    'description',
    'latitude',
    'longitude',
  ],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You are RescueRoute's incident parser. You receive a short, possibly panicked free-text report from someone affected by a disaster, and you must return a structured incident object.

Rules:
- Infer "urgency" from distress-language intensity. Words like "trapped", "bleeding", "can't breathe", "unconscious", "drowning", "heart" -> "critical". "Urgent", "need now", "running out" -> "high". "Need soon", "low on" -> "medium". Anything calm or offering aid -> "low".
- Infer "category" from context clues even if not explicit. Medical injuries/illness -> "medical". Water, food, formula -> "water_food". Housing, roof, dry place -> "shelter". Leaving, evacuate, flood rising, fire approaching -> "evacuation". Otherwise -> "other".
- If the text describes offering help (not requesting it), set "type" to "offer_help"; otherwise "request_help".
- If coordinates are supplied in the request, use them exactly. If the text contains a recognizable place name, you may estimate approximate latitude/longitude for that area. If no coordinates are supplied AND no location can be inferred from the text, return the fallback coordinates provided to you and put the inferred area name (if any) into the description.
- Never fabricate a precise street address. If the text only implies a general area, keep the fallback coordinate and mention the area in the description.
- Keep "description" under 500 characters. Preserve the most actionable details from the original text.`;

export async function POST(req: Request) {
  // 1. Rate limit
  const ip = getClientIp(req);
  if (!rateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429 }
    );
  }

  // 2. Parse + validate input
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsedInput = parseIncidentRequestSchema.safeParse(body);
  if (!parsedInput.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsedInput.error.flatten() },
      { status: 400 }
    );
  }
  const { rawText, latitude, longitude } = parsedInput.data;

  // 3. Determine fallback coordinates: supplied coords > DEFAULT_MAP_CENTER
  const fallbackLat = latitude ?? DEFAULT_MAP_CENTER.lat;
  const fallbackLng = longitude ?? DEFAULT_MAP_CENTER.lng;

  // 4. Call OpenAI with Structured Outputs
  let aiResult: z.infer<typeof aiIncidentSchema> | null = null;
  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_schema', json_schema: { name: 'incident', schema: openaiResponseSchema, strict: true } },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Report: """${rawText}"""\n\nFallback coordinates if no location can be inferred: latitude=${fallbackLat}, longitude=${fallbackLng}. Use these only if you cannot resolve a location from the text.`,
        },
      ],
      temperature: 0,
    });

    const content = completion.choices[0]?.message?.content;
    if (content) {
      const json = JSON.parse(content);
      const validated = aiIncidentSchema.safeParse(json);
      if (validated.success) aiResult = validated.data;
    }
  } catch (err) {
    console.error('[parse-incident] OpenAI call failed:', err);
  }

  // 5. Build the insert payload. Graceful degraded path: if AI parsing failed,
  // still insert a ticket with category 'other', urgency 'medium', and the raw
  // text — a dropped report is a worse failure mode than a miscategorized one.
  const insertPayload = aiResult
    ? {
        type: aiResult.type,
        category: aiResult.category,
        urgency: aiResult.urgency,
        description: aiResult.description,
        latitude: aiResult.latitude,
        longitude: aiResult.longitude,
      }
    : {
        type: 'request_help' as const,
        category: 'other' as const,
        urgency: 'medium' as const,
        description: rawText.slice(0, 500),
        latitude: fallbackLat,
        longitude: fallbackLng,
      };

  const validatedInsert = ticketInsertSchema.safeParse(insertPayload);
  if (!validatedInsert.success) {
    return NextResponse.json(
      { error: 'Failed to build a valid incident record' },
      { status: 500 }
    );
  }

  // 6. Insert via the service-role client (server-only, bypasses RLS)
  const { data, error } = await getSupabaseServer()
    .from('tickets')
    .insert(validatedInsert.data)
    .select()
    .single();

  if (error) {
    console.error('[parse-incident] Insert failed:', error);
    return NextResponse.json(
      { error: 'Failed to store the incident report' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ticket: data as Ticket }, { status: 201 });
}
