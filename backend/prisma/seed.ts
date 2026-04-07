import { PrismaClient, TenantPlan } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── 1. Modules système ────────────────────────────────────────────────────
  const modules = [
    { id: 'kernel',        name: 'Noyau',           category: 'system',  isCore: true,  version: '1.0.0', description: 'Auth, Users, RBAC, Settings', icon: 'SettingOutlined',   dependencies: [] },
    { id: 'crm',           name: 'CRM',              category: 'business', isCore: false, version: '1.0.0', description: 'Contacts, Leads, Opportunités', icon: 'TeamOutlined',      dependencies: ['kernel'] },
    { id: 'ventes',        name: 'Ventes',           category: 'business', isCore: false, version: '1.0.0', description: 'Devis, Commandes, Livraisons',  icon: 'ShoppingCartOutlined', dependencies: ['kernel', 'crm'] },
    { id: 'achats',        name: 'Achats',           category: 'business', isCore: false, version: '1.0.0', description: 'Demandes, Commandes fournisseurs', icon: 'ShopOutlined',    dependencies: ['kernel'] },
    { id: 'stock',         name: 'Stock',            category: 'business', isCore: false, version: '1.0.0', description: 'Entrepôts, Mouvements, Inventaire', icon: 'InboxOutlined',  dependencies: ['kernel'] },
    { id: 'comptabilite',  name: 'Comptabilité',     category: 'finance',  isCore: false, version: '1.0.0', description: 'Plan de comptes, Écritures, Clôtures', icon: 'AccountBookOutlined', dependencies: ['kernel', 'ventes', 'achats'] },
    { id: 'rh',            name: 'Ressources Humaines', category: 'hr',   isCore: false, version: '1.0.0', description: 'Employés, Congés, Paie',         icon: 'UserOutlined',      dependencies: ['kernel'] },
    { id: 'projets',       name: 'Projets',          category: 'business', isCore: false, version: '1.0.0', description: 'Projets, Tâches, Feuilles de temps', icon: 'ProjectOutlined', dependencies: ['kernel', 'crm', 'rh'] },
    { id: 'production',    name: 'Production',       category: 'business', isCore: false, version: '1.0.0', description: 'Ordres de fabrication, Nomenclatures', icon: 'BuildOutlined', dependencies: ['kernel', 'stock'] },
  ];

  for (const mod of modules) {
    await prisma.module.upsert({
      where: { id: mod.id },
      update: mod,
      create: mod,
    });
  }
  console.log(`✅ ${modules.length} modules créés`);

  // ── 2. Permissions système ────────────────────────────────────────────────
  const permissions: { module: string; action: string; description: string }[] = [];

  const standardModules = ['crm', 'ventes', 'achats', 'stock', 'comptabilite', 'rh', 'projets', 'production', 'kernel'];
  const standardActions = ['READ', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT'];

  for (const mod of standardModules) {
    for (const action of standardActions) {
      permissions.push({ module: mod, action, description: `${action} sur ${mod}` });
    }
  }

  // Permissions métier spécifiques
  const bizPerms = [
    { module: 'ventes',       action: 'CONFIRM_ORDER',    description: 'Confirmer une commande' },
    { module: 'ventes',       action: 'CANCEL_ORDER',     description: 'Annuler une commande' },
    { module: 'ventes',       action: 'CREATE_INVOICE',   description: 'Générer une facture' },
    { module: 'achats',       action: 'APPROVE_PURCHASE', description: 'Approuver une commande achat' },
    { module: 'comptabilite', action: 'VALIDATE_ENTRY',   description: "Valider une écriture comptable" },
    { module: 'comptabilite', action: 'CLOSE_PERIOD',     description: "Clôturer une période" },
    { module: 'rh',           action: 'VALIDATE_LEAVE',   description: 'Valider un congé' },
    { module: 'rh',           action: 'RUN_PAYROLL',      description: 'Lancer la paie' },
    { module: 'kernel',       action: 'MANAGE_USERS',     description: 'Gérer les utilisateurs' },
    { module: 'kernel',       action: 'MANAGE_ROLES',     description: 'Gérer les rôles' },
    { module: 'kernel',       action: 'MANAGE_MODULES',   description: 'Activer/désactiver des modules' },
  ];

  permissions.push(...bizPerms);

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
    create: {
      slug: 'demo',
      name: 'Entreprise Demo',
      plan: TenantPlan.PROFESSIONAL,
    },
  });
  console.log(`✅ Tenant "${tenant.name}" créé`);

  // ── 4. Modules activés pour le tenant démo ────────────────────────────────
  for (const mod of modules) {
    await prisma.tenantModule.upsert({
      where: { tenantId_moduleId: { tenantId: tenant.id, moduleId: mod.id } },
      update: {},
      create: { tenantId: tenant.id, moduleId: mod.id, isEnabled: true },
    });
  }

  // ── 5. Rôles système ──────────────────────────────────────────────────────
  const adminRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Administrateur' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Administrateur',
      description: 'Accès complet à tous les modules',
      isSystem: true,
    },
  });

  const vendeurRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Vendeur' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Vendeur',
      description: 'Accès CRM et Ventes',
      isSystem: true,
    },
  });

  const comptableRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Comptable' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Comptable',
      description: 'Accès Comptabilité et lecture Ventes/Achats',
      isSystem: true,
    },
  });

  // Toutes les permissions → Admin
  const allPerms = await prisma.permission.findMany();
  for (const perm of allPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: perm.id },
    });
  }

  // Permissions Vendeur : crm + ventes (sauf delete)
  const vendeurPerms = await prisma.permission.findMany({
    where: { module: { in: ['crm', 'ventes'] }, action: { not: 'DELETE' } },
  });
  for (const perm of vendeurPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: vendeurRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: vendeurRole.id, permissionId: perm.id },
    });
  }

  // Permissions Comptable
  const comptablePerms = await prisma.permission.findMany({
    where: {
      OR: [
        { module: 'comptabilite' },
        { module: 'ventes',  action: 'READ' },
        { module: 'achats',  action: 'READ' },
      ],
    },
  });
  for (const perm of comptablePerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: comptableRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: comptableRole.id, permissionId: perm.id },
    });
  }

  console.log(`✅ Rôles créés (Admin, Vendeur, Comptable)`);

  // ── 6. Utilisateur admin ──────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Admin123!', 12);

  const adminUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@demo.com' } },
    update: {},
    create: {
      tenantId:     tenant.id,
      email:        'admin@demo.com',
      passwordHash,
      firstName:    'Admin',
      lastName:     'Demo',
      isOwner:      true,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id },
  });

  console.log(`✅ Utilisateur admin créé : admin@demo.com / Admin123!`);
  console.log('\n🎉 Seed terminé !');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
