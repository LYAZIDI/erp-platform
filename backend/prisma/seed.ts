import {
  PrismaClient, TenantPlan,
  QuoteStatus, OrderStatus, InvoiceStatus,
  ContactSource, LeadStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedVentesWorkflows } from '../src/modules/ventes/workflow/definitions';
import { seedCrmWorkflows }    from '../src/modules/crm/workflow/definitions';

const prisma = new PrismaClient();

// ── Helpers de calcul (miroir de totalsService) ───────────────────────────────
function calcLine(quantity: number, unitPrice: number, taxRate: number) {
  const subtotal  = quantity * unitPrice;
  const taxAmount = subtotal * (taxRate / 100);
  return { subtotal, taxAmount, total: subtotal + taxAmount };
}
function calcDocument(lines: { subtotal: number; taxAmount: number; total: number }[]) {
  return lines.reduce(
    (acc, l) => ({ subtotal: acc.subtotal + l.subtotal, taxAmount: acc.taxAmount + l.taxAmount, total: acc.total + l.total }),
    { subtotal: 0, taxAmount: 0, total: 0 },
  );
}

async function main() {
  console.log('🌱 Seeding database...');

  // ── 1. Modules système ────────────────────────────────────────────────────
  const modules = [
    { id: 'kernel',       name: 'Noyau',                category: 'system',   isCore: true,  version: '1.0.0', description: 'Auth, Users, RBAC, Settings',        icon: 'SettingOutlined',      dependencies: [] },
    { id: 'crm',          name: 'CRM',                  category: 'business', isCore: false, version: '1.0.0', description: 'Contacts, Leads, Opportunités',        icon: 'TeamOutlined',         dependencies: ['kernel'] },
    { id: 'ventes',       name: 'Ventes',               category: 'business', isCore: false, version: '1.0.0', description: 'Devis, Commandes, Livraisons',          icon: 'ShoppingCartOutlined', dependencies: ['kernel', 'crm'] },
    { id: 'achats',       name: 'Achats',               category: 'business', isCore: false, version: '1.0.0', description: 'Demandes, Commandes fournisseurs',      icon: 'ShopOutlined',         dependencies: ['kernel'] },
    { id: 'stock',        name: 'Stock',                category: 'business', isCore: false, version: '1.0.0', description: 'Entrepôts, Mouvements, Inventaire',     icon: 'InboxOutlined',        dependencies: ['kernel'] },
    { id: 'comptabilite', name: 'Comptabilité',         category: 'finance',  isCore: false, version: '1.0.0', description: 'Plan de comptes, Écritures, Clôtures',  icon: 'AccountBookOutlined',  dependencies: ['kernel', 'ventes', 'achats'] },
    { id: 'rh',           name: 'Ressources Humaines',  category: 'hr',       isCore: false, version: '1.0.0', description: 'Employés, Congés, Paie',                icon: 'UserOutlined',         dependencies: ['kernel'] },
    { id: 'projets',      name: 'Projets',              category: 'business', isCore: false, version: '1.0.0', description: 'Projets, Tâches, Feuilles de temps',    icon: 'ProjectOutlined',      dependencies: ['kernel', 'crm', 'rh'] },
    { id: 'production',   name: 'Production',           category: 'business', isCore: false, version: '1.0.0', description: 'Ordres de fabrication, Nomenclatures',  icon: 'BuildOutlined',        dependencies: ['kernel', 'stock'] },
  ];
  for (const mod of modules) {
    await prisma.module.upsert({ where: { id: mod.id }, update: mod, create: mod });
  }
  console.log(`✅ ${modules.length} modules créés`);

  // ── 2. Permissions système ────────────────────────────────────────────────
  const permissions: { module: string; action: string; description: string }[] = [];
  const standardModules = ['crm', 'ventes', 'achats', 'stock', 'comptabilite', 'rh', 'projets', 'production', 'kernel'];
  for (const mod of standardModules) {
    for (const action of ['READ', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT']) {
      permissions.push({ module: mod, action, description: `${action} sur ${mod}` });
    }
  }
  permissions.push(
    { module: 'ventes',       action: 'CONFIRM_ORDER',    description: 'Confirmer une commande' },
    { module: 'ventes',       action: 'CANCEL_ORDER',     description: 'Annuler une commande' },
    { module: 'ventes',       action: 'CREATE_INVOICE',   description: 'Générer une facture' },
    { module: 'achats',       action: 'APPROVE_PURCHASE', description: 'Approuver une commande achat' },
    { module: 'comptabilite', action: 'VALIDATE_ENTRY',   description: 'Valider une écriture comptable' },
    { module: 'comptabilite', action: 'CLOSE_PERIOD',     description: 'Clôturer une période' },
    { module: 'rh',           action: 'VALIDATE_LEAVE',   description: 'Valider un congé' },
    { module: 'rh',           action: 'RUN_PAYROLL',      description: 'Lancer la paie' },
    { module: 'kernel',       action: 'MANAGE_USERS',     description: 'Gérer les utilisateurs' },
    { module: 'kernel',       action: 'MANAGE_ROLES',     description: 'Gérer les rôles' },
    { module: 'kernel',       action: 'MANAGE_MODULES',   description: 'Activer/désactiver des modules' },
  );
  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { module_action: { module: perm.module, action: perm.action } },
      update: {},
      create: perm,
    });
  }
  console.log(`✅ ${permissions.length} permissions créées`);

  // ── 3. Tenant démo ────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: { slug: 'demo', name: 'Entreprise Demo', plan: TenantPlan.PROFESSIONAL },
  });
  console.log(`✅ Tenant "${tenant.name}"`);

  // ── 4. Modules activés ────────────────────────────────────────────────────
  for (const mod of modules) {
    await prisma.tenantModule.upsert({
      where: { tenantId_moduleId: { tenantId: tenant.id, moduleId: mod.id } },
      update: {},
      create: { tenantId: tenant.id, moduleId: mod.id, isEnabled: true },
    });
  }

  // ── 5. Rôles ──────────────────────────────────────────────────────────────
  const adminRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Administrateur' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Administrateur', description: 'Accès complet', isSystem: true },
  });
  const vendeurRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Vendeur' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Vendeur', description: 'Accès CRM et Ventes', isSystem: true },
  });
  const comptableRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Comptable' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Comptable', description: 'Accès Comptabilité et lecture', isSystem: true },
  });

  const allPerms    = await prisma.permission.findMany();
  const vendPerms   = await prisma.permission.findMany({ where: { module: { in: ['crm', 'ventes'] }, action: { not: 'DELETE' } } });
  const comptPerms  = await prisma.permission.findMany({ where: { OR: [{ module: 'comptabilite' }, { module: 'ventes', action: 'READ' }, { module: 'achats', action: 'READ' }] } });

  for (const perm of allPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
      update: {}, create: { roleId: adminRole.id, permissionId: perm.id },
    });
  }
  for (const perm of vendPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: vendeurRole.id, permissionId: perm.id } },
      update: {}, create: { roleId: vendeurRole.id, permissionId: perm.id },
    });
  }
  for (const perm of comptPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: comptableRole.id, permissionId: perm.id } },
      update: {}, create: { roleId: comptableRole.id, permissionId: perm.id },
    });
  }
  console.log(`✅ Rôles créés (Admin, Vendeur, Comptable)`);

  // ── 6. Utilisateurs ───────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Admin123!', 12);

  const adminUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@demo.com' } },
    update: {},
    create: { tenantId: tenant.id, email: 'admin@demo.com', passwordHash, firstName: 'Admin', lastName: 'Demo', isOwner: true },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {}, create: { userId: adminUser.id, roleId: adminRole.id },
  });

  const vendeurUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'vendeur@demo.com' } },
    update: {},
    create: { tenantId: tenant.id, email: 'vendeur@demo.com', passwordHash: await bcrypt.hash('Vendeur123!', 12), firstName: 'Youssef', lastName: 'Alami', isOwner: false },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: vendeurUser.id, roleId: vendeurRole.id } },
    update: {}, create: { userId: vendeurUser.id, roleId: vendeurRole.id },
  });

  const comptableUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'comptable@demo.com' } },
    update: {},
    create: { tenantId: tenant.id, email: 'comptable@demo.com', passwordHash: await bcrypt.hash('Comptable123!', 12), firstName: 'Amina', lastName: 'Bensouda', isOwner: false },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: comptableUser.id, roleId: comptableRole.id } },
    update: {}, create: { userId: comptableUser.id, roleId: comptableRole.id },
  });

  console.log(`✅ Utilisateurs créés :`);
  console.log(`   admin@demo.com      / Admin123!`);
  console.log(`   vendeur@demo.com    / Vendeur123!`);
  console.log(`   comptable@demo.com  / Comptable123!`);

  // ── 7. Pipeline stages ────────────────────────────────────────────────────
  const stagesData = [
    { name: 'Qualification',       color: '#8c8c8c', order: 1, probability: 10 },
    { name: 'Réunion planifiée',   color: '#1677ff', order: 2, probability: 25 },
    { name: 'Proposition envoyée', color: '#722ed1', order: 3, probability: 50 },
    { name: 'Négociation',         color: '#fa8c16', order: 4, probability: 75 },
    { name: 'Clôture',             color: '#52c41a', order: 5, probability: 90 },
  ];

  // Supprimer les stages existants pour éviter doublons (leads d'abord — FK)
  await prisma.lead.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.pipelineStage.deleteMany({ where: { tenantId: tenant.id } });
  const stages = await Promise.all(
    stagesData.map((s) => prisma.pipelineStage.create({ data: { tenantId: tenant.id, ...s } })),
  );
  console.log(`✅ ${stages.length} étapes pipeline créées`);

  // ── 8. Contacts ───────────────────────────────────────────────────────────
  const contactsData = [
    { firstName: 'Karim',   lastName: 'Benali',  email: 'k.benali@acmecorp.ma',    phone: '+212661234567', company: 'Acme Corp',     jobTitle: 'DSI',              city: 'Casablanca', source: ContactSource.LINKEDIN },
    { firstName: 'Sarah',   lastName: 'Alami',   email: 's.alami@techmaroc.com',   phone: '+212662345678', company: 'TechMaroc',      jobTitle: 'DG',               city: 'Rabat',      source: ContactSource.REFERRAL },
    { firstName: 'Mohamed', lastName: 'Fassi',   email: 'm.fassi@innovatema.com',  phone: '+212663456789', company: 'InnovateMa',     jobTitle: 'Responsable IT',   city: 'Marrakech',  source: ContactSource.WEBSITE },
    { firstName: 'Nadia',   lastName: 'Chraibi', email: 'n.chraibi@digitalhub.ma', phone: '+212664567890', company: 'DigitalHub',     jobTitle: 'CEO',              city: 'Casablanca', source: ContactSource.EMAIL_CAMPAIGN },
    { firstName: 'Hassan',  lastName: 'Tazi',    email: 'h.tazi@retailpro.ma',     phone: '+212665678901', company: 'RetailPro',      jobTitle: 'Acheteur',         city: 'Fès',        source: ContactSource.PHONE },
    { firstName: 'Fatima',  lastName: 'Ouazzani',email: 'f.ouazzani@medconsult.ma',phone: '+212666789012', company: 'MedConsult',     jobTitle: 'Directrice Admin', city: 'Rabat',      source: ContactSource.MANUAL },
    { firstName: 'Omar',    lastName: 'Berrada',  email: 'o.berrada@omegaretail.ma', phone: '+212667890123', company: 'OmegaRetail',    jobTitle: 'DSI',              city: 'Agadir',     source: ContactSource.REFERRAL },
  ];

  await prisma.contact.deleteMany({ where: { tenantId: tenant.id } });
  const contacts = await Promise.all(
    contactsData.map((c) => prisma.contact.create({ data: { tenantId: tenant.id, ...c, createdById: adminUser.id } })),
  );
  console.log(`✅ ${contacts.length} contacts créés`);

  const [cKarim, cSarah, cMohamed, cNadia, cHassan, cFatima, cOmar] = contacts;

  // ── 9. Leads ──────────────────────────────────────────────────────────────
  const [sQualif, sReunion, sProposition, sNego, sCloture] = stages;

  await prisma.lead.createMany({
    data: [
      { tenantId: tenant.id, title: 'Déploiement ERP complet',      contactId: cKarim.id,   stageId: sCloture.id,    value: 180000, probability: 85, status: LeadStatus.OPEN,   description: 'Projet ERP pour 50 utilisateurs, budget validé', assignedToId: vendeurUser.id },
      { tenantId: tenant.id, title: 'Migration infrastructure cloud',contactId: cSarah.id,   stageId: sNego.id,       value: 95000,  probability: 65, status: LeadStatus.OPEN,   description: 'Migration AWS + formation équipe', assignedToId: vendeurUser.id },
      { tenantId: tenant.id, title: 'Licence CRM 20 postes',         contactId: cMohamed.id, stageId: sProposition.id,value: 45000,  probability: 50, status: LeadStatus.OPEN,   description: 'CRM avec module support client' },
      { tenantId: tenant.id, title: 'Audit sécurité SI',             contactId: cNadia.id,   stageId: sProposition.id,value: 28000,  probability: 55, status: LeadStatus.OPEN,   description: 'Audit complet + recommandations' },
      { tenantId: tenant.id, title: 'Formation Power BI',            contactId: cFatima.id,  stageId: sReunion.id,    value: 12000,  probability: 30, status: LeadStatus.OPEN,   description: '2 jours de formation, 8 personnes' },
      { tenantId: tenant.id, title: 'Site e-commerce B2B',           contactId: cHassan.id,  stageId: sQualif.id,     value: 65000,  probability: 15, status: LeadStatus.OPEN,   description: 'Plateforme de commande en ligne' },
      { tenantId: tenant.id, title: 'Maintenance réseau 2025',       contactId: cKarim.id,   stageId: sCloture.id,    value: 36000,  probability: 95, status: LeadStatus.WON,    wonAt: new Date('2026-01-15') },
      { tenantId: tenant.id, title: 'Refonte site institutionnel',   contactId: cSarah.id,   stageId: sQualif.id,     value: 18000,  probability: 0,  status: LeadStatus.LOST,   lostReason: 'Budget revu à la baisse', lostAt: new Date('2026-02-10') },
      { tenantId: tenant.id, title: 'Déploiement ERP cloud',          contactId: cOmar.id,    stageId: sQualif.id,     value: 75000,  probability: 10, status: LeadStatus.OPEN,   description: 'Prospect entrant — premier contact en cours', assignedToId: vendeurUser.id },
    ],
  });
  console.log(`✅ 9 leads créés`);

  // ── 10. Produits ─────────────────────────────────────────────────────────
  await prisma.product.deleteMany({ where: { tenantId: tenant.id } });
  const productsData = [
    { reference: 'LIC-ERP-STD',  name: 'Licence ERP Standard',       category: 'Logiciel',   unitPrice: 15000, taxRate: 20, unit: 'licence',  description: 'Licence annuelle ERP Standard — 10 utilisateurs' },
    { reference: 'LIC-ERP-PRO',  name: 'Licence ERP Professionnelle', category: 'Logiciel',   unitPrice: 28000, taxRate: 20, unit: 'licence',  description: 'Licence annuelle ERP Pro — utilisateurs illimités' },
    { reference: 'SVC-FORM-ERP', name: 'Formation ERP (journée)',     category: 'Formation',  unitPrice: 3500,  taxRate: 20, unit: 'jour',     description: 'Formation présentielle ou distancielle, par groupe de 8' },
    { reference: 'SVC-MAINT',    name: 'Maintenance & Support annuel',category: 'Service',    unitPrice: 5000,  taxRate: 20, unit: 'an',       description: 'Support 5j/7 + mises à jour incluses' },
    { reference: 'SVC-DEPLOY',   name: 'Déploiement & Paramétrage',   category: 'Service',    unitPrice: 8500,  taxRate: 20, unit: 'forfait',  description: 'Installation, configuration et migration des données' },
    { reference: 'MAT-SRV-DELL', name: 'Serveur Dell PowerEdge R740', category: 'Matériel',   unitPrice: 25000, taxRate: 20, unit: 'unité',    description: 'Serveur rack 2U, 2x Xeon, 64Go RAM, 4x 1To SSD' },
    { reference: 'MAT-SW-24P',   name: 'Switch HP 24 ports PoE',      category: 'Matériel',   unitPrice: 4500,  taxRate: 20, unit: 'unité',    description: 'Switch manageable 24 ports Gigabit PoE+' },
    { reference: 'MAT-CABLE',    name: 'Câblage structuré Cat6 (ml)', category: 'Matériel',   unitPrice: 45,    taxRate: 20, unit: 'ml',       description: 'Câble réseau Cat6 FTP posé et testé' },
  ];
  const products = await Promise.all(
    productsData.map((p) => prisma.product.create({ data: { tenantId: tenant.id, ...p } })),
  );
  console.log(`✅ ${products.length} produits créés`);

  const [pLicStd, pLicPro, pForm, pMaint, pDeploy, pSrvDell, pSwitch, pCable] = products;

  // ── 11. Devis ─────────────────────────────────────────────────────────────
  const now   = new Date();
  const past  = (days: number) => new Date(now.getTime() - days * 86400_000);
  const future = (days: number) => new Date(now.getTime() + days * 86400_000);

  await prisma.quoteLine.deleteMany({});
  await prisma.quote.deleteMany({ where: { tenantId: tenant.id } });

  // QUO-2026-00001 : BROUILLON — Karim Benali
  const q1Lines = [
    { ...calcLine(1, 28000, 20), productId: pLicPro.id,  description: 'Licence ERP Professionnelle',  quantity: 1,  unitPrice: 28000, taxRate: 20, sortOrder: 0 },
    { ...calcLine(3, 3500, 20),  productId: pForm.id,     description: 'Formation ERP (3 journées)',    quantity: 3,  unitPrice: 3500,  taxRate: 20, sortOrder: 1 },
    { ...calcLine(1, 8500, 20),  productId: pDeploy.id,   description: 'Déploiement & Paramétrage',    quantity: 1,  unitPrice: 8500,  taxRate: 20, sortOrder: 2 },
  ];
  const q1Tot = calcDocument(q1Lines);
  const quote1 = await prisma.quote.create({
    data: {
      tenantId: tenant.id, reference: 'QUO-2026-00001', contactId: cKarim.id,
      status: QuoteStatus.DRAFT, expiryDate: future(30),
      notes: 'Offre initiale — en attente de validation budgétaire',
      ...q1Tot, createdById: adminUser.id,
      lines: { create: q1Lines },
    },
  });

  // QUO-2026-00002 : ENVOYÉ — Sarah Alami
  const q2Lines = [
    { ...calcLine(1, 15000, 20), productId: pLicStd.id,  description: 'Licence ERP Standard',          quantity: 1, unitPrice: 15000, taxRate: 20, sortOrder: 0 },
    { ...calcLine(2, 3500, 20),  productId: pForm.id,     description: 'Formation ERP (2 journées)',    quantity: 2, unitPrice: 3500,  taxRate: 20, sortOrder: 1 },
    { ...calcLine(1, 5000, 20),  productId: pMaint.id,    description: 'Maintenance & Support annuel', quantity: 1, unitPrice: 5000,  taxRate: 20, sortOrder: 2 },
  ];
  const q2Tot = calcDocument(q2Lines);
  const quote2 = await prisma.quote.create({
    data: {
      tenantId: tenant.id, reference: 'QUO-2026-00002', contactId: cSarah.id,
      status: QuoteStatus.SENT, expiryDate: future(15),
      notes: 'Envoyé par email le ' + past(3).toLocaleDateString('fr-FR'),
      ...q2Tot, createdById: vendeurUser.id,
      lines: { create: q2Lines },
    },
  });

  // QUO-2026-00003 : ACCEPTÉ → générera une commande — Mohamed Fassi
  const q3Lines = [
    { ...calcLine(1, 28000, 20), productId: pLicPro.id,  description: 'Licence ERP Professionnelle', quantity: 1, unitPrice: 28000, taxRate: 20, sortOrder: 0 },
    { ...calcLine(1, 8500, 20),  productId: pDeploy.id,  description: 'Déploiement & Paramétrage',   quantity: 1, unitPrice: 8500,  taxRate: 20, sortOrder: 1 },
    { ...calcLine(1, 5000, 20),  productId: pMaint.id,   description: 'Maintenance 1 an',             quantity: 1, unitPrice: 5000,  taxRate: 20, sortOrder: 2 },
  ];
  const q3Tot = calcDocument(q3Lines);
  const quote3 = await prisma.quote.create({
    data: {
      tenantId: tenant.id, reference: 'QUO-2026-00003', contactId: cMohamed.id,
      status: QuoteStatus.ACCEPTED, expiryDate: past(5), confirmedAt: past(7),
      notes: 'Bon de commande reçu le ' + past(7).toLocaleDateString('fr-FR'),
      ...q3Tot, createdById: vendeurUser.id,
      lines: { create: q3Lines },
    },
  });

  // QUO-2026-00004 : ACCEPTÉ → commande → facture — Nadia Chraibi
  const q4Lines = [
    { ...calcLine(1, 15000, 20), productId: pLicStd.id,  description: 'Licence ERP Standard',         quantity: 1, unitPrice: 15000, taxRate: 20, sortOrder: 0 },
    { ...calcLine(4, 3500, 20),  productId: pForm.id,    description: 'Formation ERP (4 journées)',    quantity: 4, unitPrice: 3500,  taxRate: 20, sortOrder: 1 },
    { ...calcLine(1, 8500, 20),  productId: pDeploy.id,  description: 'Déploiement & Paramétrage',    quantity: 1, unitPrice: 8500,  taxRate: 20, sortOrder: 2 },
  ];
  const q4Tot = calcDocument(q4Lines);
  const quote4 = await prisma.quote.create({
    data: {
      tenantId: tenant.id, reference: 'QUO-2026-00004', contactId: cNadia.id,
      status: QuoteStatus.ACCEPTED, expiryDate: past(20), confirmedAt: past(25),
      ...q4Tot, createdById: adminUser.id,
      lines: { create: q4Lines },
    },
  });

  // QUO-2026-00005 : EXPIRÉ — Hassan Tazi
  const q5Lines = [
    { ...calcLine(1, 25000, 20), productId: pSrvDell.id, description: 'Serveur Dell PowerEdge R740',  quantity: 1, unitPrice: 25000, taxRate: 20, sortOrder: 0 },
    { ...calcLine(2, 4500, 20),  productId: pSwitch.id,  description: 'Switch HP 24 ports PoE',       quantity: 2, unitPrice: 4500,  taxRate: 20, sortOrder: 1 },
    { ...calcLine(120, 45, 20),  productId: pCable.id,   description: 'Câblage structuré Cat6 120ml', quantity: 120, unitPrice: 45,  taxRate: 20, sortOrder: 2 },
  ];
  const q5Tot = calcDocument(q5Lines);
  await prisma.quote.create({
    data: {
      tenantId: tenant.id, reference: 'QUO-2026-00005', contactId: cHassan.id,
      status: QuoteStatus.EXPIRED, expiryDate: past(15),
      notes: 'Offre expirée — client n\'a pas donné suite',
      ...q5Tot, createdById: vendeurUser.id,
      lines: { create: q5Lines },
    },
  });

  // QUO-2026-00006 : REFUSED — Fatima Ouazzani (budget insuffisant)
  const q6Lines = [
    { ...calcLine(1, 28000, 20), productId: pLicPro.id, description: 'Licence ERP Professionnelle', quantity: 1, unitPrice: 28000, taxRate: 20, sortOrder: 0 },
    { ...calcLine(1, 8500, 20),  productId: pDeploy.id,  description: 'Déploiement & Paramétrage',   quantity: 1, unitPrice: 8500,  taxRate: 20, sortOrder: 1 },
  ];
  const q6Tot = calcDocument(q6Lines);
  const quote6 = await prisma.quote.create({
    data: {
      tenantId: tenant.id, reference: 'QUO-2026-00006', contactId: cFatima.id,
      status: QuoteStatus.REFUSED, expiryDate: past(10),
      notes: 'Client a refusé — budget insuffisant pour cette année',
      ...q6Tot, createdById: vendeurUser.id,
      lines: { create: q6Lines },
    },
  });

  // QUO-2026-00007 : ACCEPTÉ → ORD IN_PROGRESS — Hassan Tazi (nouvelle opportunité réseau)
  const q7Lines = [
    { ...calcLine(1, 25000, 20), productId: pSrvDell.id, description: 'Serveur Dell PowerEdge R740', quantity: 1,  unitPrice: 25000, taxRate: 20, sortOrder: 0 },
    { ...calcLine(1, 4500, 20),  productId: pSwitch.id,  description: 'Switch HP 24 ports PoE',      quantity: 1,  unitPrice: 4500,  taxRate: 20, sortOrder: 1 },
    { ...calcLine(80, 45, 20),   productId: pCable.id,   description: 'Câblage structuré Cat6 80ml', quantity: 80, unitPrice: 45,    taxRate: 20, sortOrder: 2 },
  ];
  const q7Tot = calcDocument(q7Lines);
  const quote7 = await prisma.quote.create({
    data: {
      tenantId: tenant.id, reference: 'QUO-2026-00007', contactId: cHassan.id,
      status: QuoteStatus.ACCEPTED, expiryDate: future(10), confirmedAt: past(3),
      notes: 'Bon de commande reçu — installation en cours',
      ...q7Tot, createdById: vendeurUser.id,
      lines: { create: q7Lines },
    },
  });

  // QUO-2026-00008 : ACCEPTÉ → ORD CANCELLED — Sarah Alami (projet annulé)
  const q8Lines = [
    { ...calcLine(1, 15000, 20), productId: pLicStd.id, description: 'Licence ERP Standard',        quantity: 1, unitPrice: 15000, taxRate: 20, sortOrder: 0 },
    { ...calcLine(1, 5000, 20),  productId: pMaint.id,  description: 'Maintenance & Support annuel', quantity: 1, unitPrice: 5000,  taxRate: 20, sortOrder: 1 },
  ];
  const q8Tot = calcDocument(q8Lines);
  const quote8 = await prisma.quote.create({
    data: {
      tenantId: tenant.id, reference: 'QUO-2026-00008', contactId: cSarah.id,
      status: QuoteStatus.ACCEPTED, expiryDate: past(5), confirmedAt: past(12),
      notes: 'Commande annulée suite à gel budgétaire du client',
      ...q8Tot, createdById: adminUser.id,
      lines: { create: q8Lines },
    },
  });

  // QUO-2026-00009 : ACCEPTÉ → ORD DELIVERED → INV DRAFT — Fatima Ouazzani (formation)
  const q9Lines = [
    { ...calcLine(3, 3500, 20), productId: pForm.id,  description: 'Formation ERP (3 journées)',    quantity: 3, unitPrice: 3500, taxRate: 20, sortOrder: 0 },
    { ...calcLine(1, 5000, 20), productId: pMaint.id, description: 'Maintenance & Support annuel', quantity: 1, unitPrice: 5000, taxRate: 20, sortOrder: 1 },
  ];
  const q9Tot = calcDocument(q9Lines);
  const quote9 = await prisma.quote.create({
    data: {
      tenantId: tenant.id, reference: 'QUO-2026-00009', contactId: cFatima.id,
      status: QuoteStatus.ACCEPTED, expiryDate: past(8), confirmedAt: past(14),
      ...q9Tot, createdById: vendeurUser.id,
      lines: { create: q9Lines },
    },
  });

  // QUO-2026-00010 : BROUILLON — Omar Berrada (scénario E2E vierge)
  const q10Lines = [
    { ...calcLine(1, 28000, 20), productId: pLicPro.id, description: 'Licence ERP Professionnelle', quantity: 1, unitPrice: 28000, taxRate: 20, sortOrder: 0 },
    { ...calcLine(2, 3500, 20),  productId: pForm.id,   description: 'Formation ERP (2 journées)',   quantity: 2, unitPrice: 3500,  taxRate: 20, sortOrder: 1 },
    { ...calcLine(1, 8500, 20),  productId: pDeploy.id, description: 'Déploiement & Paramétrage',    quantity: 1, unitPrice: 8500,  taxRate: 20, sortOrder: 2 },
  ];
  const q10Tot = calcDocument(q10Lines);
  await prisma.quote.create({
    data: {
      tenantId: tenant.id, reference: 'QUO-2026-00010', contactId: cOmar.id,
      status: QuoteStatus.DRAFT, expiryDate: future(30),
      notes: '⚡ SCÉNARIO E2E — Démarrer ici : Envoyer → Confirmer → Livrer → Facturer → Payer',
      ...q10Tot, createdById: vendeurUser.id,
      lines: { create: q10Lines },
    },
  });

  console.log(`✅ 10 devis créés (DRAFT×2, SENT, ACCEPTED×4, EXPIRED, REFUSED, + E2E vierge)`);

  // ── 12. Commandes ─────────────────────────────────────────────────────────
  await prisma.orderLine.deleteMany({});
  await prisma.order.deleteMany({ where: { tenantId: tenant.id } });

  // ORD-2026-00001 : CONFIRMED — depuis QUO-2026-00003 (Mohamed Fassi)
  const o1Lines = q3Lines.map((l, i) => ({ ...l, sortOrder: i }));
  const order1 = await prisma.order.create({
    data: {
      tenantId: tenant.id, reference: 'ORD-2026-00001',
      quoteId: quote3.id, contactId: cMohamed.id,
      status: OrderStatus.CONFIRMED,
      orderDate: past(7), deliveryDate: future(21),
      notes: 'Livraison prévue sous 3 semaines',
      ...q3Tot, createdById: vendeurUser.id,
      lines: { create: o1Lines },
    },
  });

  // ORD-2026-00002 : DELIVERED — depuis QUO-2026-00004 (Nadia Chraibi)
  const o2Lines = q4Lines.map((l, i) => ({ ...l, sortOrder: i }));
  const order2 = await prisma.order.create({
    data: {
      tenantId: tenant.id, reference: 'ORD-2026-00002',
      quoteId: quote4.id, contactId: cNadia.id,
      status: OrderStatus.DELIVERED,
      orderDate: past(25), deliveryDate: past(5),
      notes: 'Livraison effectuée et validée par le client',
      ...q4Tot, createdById: adminUser.id,
      lines: { create: o2Lines },
    },
  });

  // Mettre à jour le quoteId dans les quotes pour pointer vers les commandes
  await prisma.quote.update({ where: { id: quote3.id }, data: {} }); // déjà lié via quoteId
  await prisma.quote.update({ where: { id: quote4.id }, data: {} });

  // ORD-2026-00003 : IN_PROGRESS — depuis QUO-2026-00007 (Hassan Tazi, réseau)
  const o3Lines = q7Lines.map((l, i) => ({ ...l, sortOrder: i }));
  const order3 = await prisma.order.create({
    data: {
      tenantId: tenant.id, reference: 'ORD-2026-00003',
      quoteId: quote7.id, contactId: cHassan.id,
      status: OrderStatus.IN_PROGRESS,
      orderDate: past(3), deliveryDate: future(7),
      notes: 'Installation serveur en cours — câblage prévu cette semaine',
      ...q7Tot, createdById: vendeurUser.id,
      lines: { create: o3Lines },
    },
  });

  // ORD-2026-00004 : DELIVERED — depuis QUO-2026-00009 (Fatima Ouazzani, formation)
  const o4Lines = q9Lines.map((l, i) => ({ ...l, sortOrder: i }));
  const order4 = await prisma.order.create({
    data: {
      tenantId: tenant.id, reference: 'ORD-2026-00004',
      quoteId: quote9.id, contactId: cFatima.id,
      status: OrderStatus.DELIVERED,
      orderDate: past(14), deliveryDate: past(2),
      notes: 'Formation effectuée les 7 et 8 avril — bon de réception signé',
      ...q9Tot, createdById: vendeurUser.id,
      lines: { create: o4Lines },
    },
  });

  // ORD-2026-00005 : CANCELLED — depuis QUO-2026-00008 (Sarah Alami, gel budgétaire)
  const o5Lines = q8Lines.map((l, i) => ({ ...l, sortOrder: i }));
  await prisma.order.create({
    data: {
      tenantId: tenant.id, reference: 'ORD-2026-00005',
      quoteId: quote8.id, contactId: cSarah.id,
      status: OrderStatus.CANCELLED,
      orderDate: past(12),
      notes: 'Annulée le ' + past(8).toLocaleDateString('fr-FR') + ' — gel budgétaire côté client',
      ...q8Tot, createdById: adminUser.id,
      lines: { create: o5Lines },
    },
  });

  console.log(`✅ 5 commandes créées (CONFIRMED, IN_PROGRESS, DELIVERED×2, CANCELLED)`);

  // ── 13. Factures ─────────────────────────────────────────────────────────
  await prisma.invoiceLine.deleteMany({});
  await prisma.invoice.deleteMany({ where: { tenantId: tenant.id } });

  // INV-2026-00001 : SENT — depuis ORD-2026-00002 (Nadia Chraibi), en attente
  const i1Lines = o2Lines.map((l, i) => ({
    description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice),
    taxRate: Number(l.taxRate), subtotal: l.subtotal, taxAmount: l.taxAmount, total: l.total, sortOrder: i,
  }));
  await prisma.invoice.create({
    data: {
      tenantId: tenant.id, reference: 'INV-2026-00001',
      orderId: order2.id, contactId: cNadia.id,
      status: InvoiceStatus.SENT,
      issueDate: past(5), dueDate: future(25),
      sentAt: past(5),
      notes: 'Facture suite à livraison du ' + past(5).toLocaleDateString('fr-FR'),
      ...q4Tot, paidAmount: 0,
      createdById: adminUser.id,
      lines: { create: i1Lines },
    },
  });

  // INV-2026-00002 : PARTIALLY_PAID — Karim Benali (commande précédente hors scope)
  const i2LinesData = [
    { ...calcLine(1, 5000, 20),  description: 'Maintenance & Support annuel — Acme Corp', quantity: 1, unitPrice: 5000, taxRate: 20, sortOrder: 0 },
    { ...calcLine(2, 3500, 20),  description: 'Formation utilisateurs (2j)',               quantity: 2, unitPrice: 3500, taxRate: 20, sortOrder: 1 },
  ];
  const i2Tot = calcDocument(i2LinesData);
  await prisma.invoice.create({
    data: {
      tenantId: tenant.id, reference: 'INV-2026-00002',
      contactId: cKarim.id,
      status: InvoiceStatus.PARTIALLY_PAID,
      issueDate: past(45), dueDate: past(15),
      sentAt: past(45),
      notes: 'Paiement partiel reçu le ' + past(20).toLocaleDateString('fr-FR'),
      ...i2Tot, paidAmount: 6000,
      createdById: adminUser.id,
      lines: { create: i2LinesData.map((l, i) => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, taxRate: l.taxRate, subtotal: l.subtotal, taxAmount: l.taxAmount, total: l.total, sortOrder: i })) },
    },
  });

  // INV-2026-00003 : OVERDUE — Sarah Alami, date dépassée
  const i3LinesData = [
    { ...calcLine(1, 15000, 20), description: 'Licence ERP Standard — TechMaroc', quantity: 1, unitPrice: 15000, taxRate: 20, sortOrder: 0 },
  ];
  const i3Tot = calcDocument(i3LinesData);
  await prisma.invoice.create({
    data: {
      tenantId: tenant.id, reference: 'INV-2026-00003',
      contactId: cSarah.id,
      status: InvoiceStatus.OVERDUE,
      issueDate: past(60), dueDate: past(30),
      sentAt: past(60),
      notes: 'RELANCE URGENTE — Échéance dépassée de 30 jours',
      ...i3Tot, paidAmount: 0,
      createdById: adminUser.id,
      lines: { create: i3LinesData.map((l, i) => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, taxRate: l.taxRate, subtotal: l.subtotal, taxAmount: l.taxAmount, total: l.total, sortOrder: i })) },
    },
  });

  // INV-2026-00004 : PAID — Mohamed Fassi (ancienne facture)
  const i4LinesData = [
    { ...calcLine(1, 8500, 20), description: 'Déploiement & Paramétrage — InnovateMa', quantity: 1, unitPrice: 8500, taxRate: 20, sortOrder: 0 },
    { ...calcLine(1, 3500, 20), description: 'Formation ERP (1 journée)',               quantity: 1, unitPrice: 3500, taxRate: 20, sortOrder: 1 },
  ];
  const i4Tot = calcDocument(i4LinesData);
  await prisma.invoice.create({
    data: {
      tenantId: tenant.id, reference: 'INV-2026-00004',
      contactId: cMohamed.id,
      status: InvoiceStatus.PAID,
      issueDate: past(90), dueDate: past(60),
      sentAt: past(90), paidAt: past(58),
      ...i4Tot, paidAmount: i4Tot.total,
      createdById: adminUser.id,
      lines: { create: i4LinesData.map((l, i) => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, taxRate: l.taxRate, subtotal: l.subtotal, taxAmount: l.taxAmount, total: l.total, sortOrder: i })) },
    },
  });

  // INV-2026-00005 : DRAFT — depuis ORD-2026-00004 (Fatima Ouazzani, formation livrée)
  const i5Lines = o4Lines.map((l, i) => ({
    description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice),
    taxRate: Number(l.taxRate), subtotal: l.subtotal, taxAmount: l.taxAmount, total: l.total, sortOrder: i,
  }));
  await prisma.invoice.create({
    data: {
      tenantId: tenant.id, reference: 'INV-2026-00005',
      orderId: order4.id, contactId: cFatima.id,
      status: InvoiceStatus.DRAFT,
      issueDate: past(1), dueDate: future(29),
      notes: 'Brouillon — à vérifier avant envoi au client',
      ...q9Tot, paidAmount: 0,
      createdById: comptableUser.id,
      lines: { create: i5Lines },
    },
  });

  // INV-2026-00006 : CANCELLED — depuis ORD-2026-00003 (Hassan Tazi, facture erronée annulée)
  const i6LinesData = o3Lines.map((l, i) => ({
    description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice),
    taxRate: Number(l.taxRate), subtotal: l.subtotal, taxAmount: l.taxAmount, total: l.total, sortOrder: i,
  }));
  await prisma.invoice.create({
    data: {
      tenantId: tenant.id, reference: 'INV-2026-00006',
      orderId: order3.id, contactId: cHassan.id,
      status: InvoiceStatus.CANCELLED,
      issueDate: past(2), dueDate: future(28),
      notes: 'Annulée — montant erroné, une nouvelle facture sera émise après livraison',
      ...q7Tot, paidAmount: 0,
      createdById: comptableUser.id,
      lines: { create: i6LinesData },
    },
  });

  console.log(`✅ 6 factures créées (DRAFT, SENT, PARTIALLY_PAID, OVERDUE, PAID, CANCELLED)`);

  // ── 14. Activités leads ───────────────────────────────────────────────────
  const leadsCreated = await prisma.lead.findMany({ where: { tenantId: tenant.id }, take: 4 });
  if (leadsCreated.length >= 1) {
    await prisma.leadActivity.createMany({
      data: [
        { leadId: leadsCreated[0].id, userId: vendeurUser.id, type: 'CALL',    content: 'Appel découverte — budget confirmé à 180k MAD, décision en mars' },
        { leadId: leadsCreated[0].id, userId: adminUser.id,   type: 'MEETING', content: 'Réunion présentation démo ERP — très bon retour client' },
        { leadId: leadsCreated[0].id, userId: vendeurUser.id, type: 'EMAIL',   content: 'Envoi proposition commerciale détaillée et références clients' },
        { leadId: leadsCreated[0].id, userId: adminUser.id,   type: 'NOTE',    content: 'Client demande à inclure module RH dans la proposition finale' },
      ],
    });
  }
  if (leadsCreated.length >= 2) {
    await prisma.leadActivity.createMany({
      data: [
        { leadId: leadsCreated[1].id, userId: vendeurUser.id, type: 'CALL',  content: 'Premier contact — intérêt confirmé, RDV planifié' },
        { leadId: leadsCreated[1].id, userId: vendeurUser.id, type: 'EMAIL', content: 'Envoi plaquette commerciale et cas d\'usage cloud' },
      ],
    });
  }

  console.log(`✅ Activités leads créées`);

  // ── 15. Workflow definitions ───────────────────────────────────────────────
  await seedVentesWorkflows(tenant.id);
  await seedCrmWorkflows(tenant.id);
  console.log(`✅ Workflow definitions créées (Quote, Order, Invoice, Lead)`);

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║             SEED TERMINE AVEC SUCCES                         ║
╠══════════════════════════════════════════════════════════════╣
║  CONNEXION DEMO                                              ║
║  Tenant      : demo                                          ║
║  Admin       : admin@demo.com      / Admin123!               ║
║  Vendeur     : vendeur@demo.com    / Vendeur123!             ║
║  Comptable   : comptable@demo.com  / Comptable123!           ║
╠══════════════════════════════════════════════════════════════╣
║  DONNEES DE TEST                                             ║
║  7 contacts  (Casablanca, Rabat, Fes, Agadir...)             ║
║  9 leads     (pipeline Qualification -> Cloture)             ║
║  8 produits  catalogue                                       ║
║  10 devis    DRAFT x2, SENT, ACCEPTED x4, EXPIRED,           ║
║              REFUSED                                         ║
║  5 commandes CONFIRMED, IN_PROGRESS, DELIVERED x2,           ║
║              CANCELLED                                       ║
║  6 factures  DRAFT, SENT, PARTIALLY_PAID, OVERDUE,           ║
║              PAID, CANCELLED                                 ║
╠══════════════════════════════════════════════════════════════╣
║  SCENARIO E2E (QUO-2026-00010 - Omar Berrada)                ║
║  1. Ouvrir le devis DRAFT QUO-2026-00010                     ║
║  2. Envoyer -> statut SENT                                   ║
║  3. Confirmer -> cree la commande (CONFIRMED)                ║
║  4. Passer en IN_PROGRESS puis DELIVERED                     ║
║  5. Generer la facture (DRAFT)                               ║
║  6. Envoyer la facture -> SENT                               ║
║  7. Enregistrer le paiement -> PAID                          ║
╚══════════════════════════════════════════════════════════════╝
  `);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
