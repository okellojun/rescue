import { z } from 'zod';

// Shared Zod schema for a ticket. Used by the API route for input validation,
// by the OpenAI structured-output call, and by the client for type inference.
// Keeping one source of truth keeps the frontend, API, and AI layer in sync.

export const ticketTypeEnum = z.enum(['request_help', 'offer_help']);
export const ticketCategoryEnum = z.enum([
  'medical',
  'water_food',
  'shelter',
  'evacuation',
  'other',
]);
export const urgencyLevelEnum = z.enum(['critical', 'high', 'medium', 'low']);
export const ticketStatusEnum = z.enum(['open', 'claimed', 'resolved']);

export const ticketSchema = z.object({
  id: z.string().uuid(),
  type: ticketTypeEnum,
  category: ticketCategoryEnum,
  urgency: urgencyLevelEnum,
  description: z.string().min(1).max(500),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  status: ticketStatusEnum,
  claimed_by: z.string().uuid().nullable(),
  claimed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Ticket = z.infer<typeof ticketSchema>;

// Shape used when inserting a new ticket (server-side, before the row exists).
export const ticketInsertSchema = z.object({
  type: ticketTypeEnum,
  category: ticketCategoryEnum,
  urgency: urgencyLevelEnum,
  description: z.string().min(1).max(500),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  status: ticketStatusEnum.optional(),
  claimed_by: z.string().uuid().nullable().optional(),
  claimed_at: z.string().nullable().optional(),
});

export type TicketInsert = z.infer<typeof ticketInsertSchema>;

// Request body for the AI ingestion route.
export const parseIncidentRequestSchema = z.object({
  rawText: z.string().min(1).max(1000),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export type ParseIncidentRequest = z.infer<typeof parseIncidentRequestSchema>;

// Structured-output schema returned by OpenAI. Mirrors the insert fields so the
// model is contractually forced to return a valid, insertable ticket payload.
export const aiIncidentSchema = z.object({
  type: ticketTypeEnum,
  category: ticketCategoryEnum,
  urgency: urgencyLevelEnum,
  description: z.string().min(1).max(500),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export type AiIncident = z.infer<typeof aiIncidentSchema>;

// Human-readable labels for the UI.
export const URGENCY_LABELS: Record<string, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const CATEGORY_LABELS: Record<string, string> = {
  medical: 'Medical',
  water_food: 'Water / Food',
  shelter: 'Shelter',
  evacuation: 'Evacuation',
  other: 'Other',
};

export const TYPE_LABELS: Record<string, string> = {
  request_help: 'Request for Help',
  offer_help: 'Offer of Help',
};
