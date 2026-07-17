import { callFunction } from './functions-client';

export type OpsAuditEntry = {
  id: string;
  action: string;
  actorUid: string;
  actorLabel: string;
  targetUid: string | null;
  targetBanId: string | null;
  detail: Record<string, unknown>;
  at: string;
};

export async function listOpsAudit(input: {
  action?: string;
  actorUid?: string;
  targetUid?: string;
  limit?: number;
}): Promise<{ entries: OpsAuditEntry[] }> {
  return callFunction('listOpsAudit', input);
}
