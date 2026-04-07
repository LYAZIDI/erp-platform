import prisma from '../../db/prisma';

interface AuditParams {
  tenantId:   string;
  userId?:    string;
  module:     string;
  action:     string;
  entityType?: string;
  entityId?:  string;
  oldValues?: object;
  newValues?: object;
  ipAddress?: string;
  userAgent?: string;
}

export async function auditLog(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({ data: params });
  } catch {
    // Ne jamais bloquer le flux métier pour un audit raté
  }
}
