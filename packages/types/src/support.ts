export interface ClientContact {
  id: string;
  clientId: string;
  name: string;
  phone: string;
  email: string | null;
  role: string | null;
  verifiedAt: string | null;
}
export interface ClientContactInput {
  name: string;
  phone: string;
  email?: string;
  role?: string;
  verified: boolean;
}
export interface SupportMetrics {
  resolvedWithoutTicket: number;
  stages: Array<{ stage: string; _count: number; _avg: { attempts: number | null } }>;
  usage: {
    _count: number;
    _sum: { inputTokens: number | null; outputTokens: number | null; cost: number | null };
    _avg: { latencyMs: number | null };
  };
  feedback: Array<{ feedback: number | null; _count: number }>;
  satisfaction: number | null;
  ratings: number;
  firstResponseMs: number | null;
  daily: Array<{ day: string; turns: number; cost: number | null; errors: number }>;
  recent: Array<{
    id: string;
    conversationId: string;
    model: string;
    action: string;
    latencyMs: number;
    cost: number | null;
    error: string | null;
    tools: Array<{ name: string; ok: boolean }>;
    createdAt: string;
  }>;
}
