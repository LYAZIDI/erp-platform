/**
 * Module Registry — gère le chargement et l'état des modules ERP.
 * Chaque module déclare ses routes, permissions et menu items.
 */

export interface ModuleManifest {
  id:           string;
  name:         string;
  version:      string;
  icon:         string;
  category:     string;
  dependencies: string[];
  routes:       ModuleRoute[];
  menuItems:    MenuItem[];
  permissions:  ModulePermission[];
}

export interface ModuleRoute {
  method:  'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path:    string;
  handler: string;        // nom du handler pour logging
}

export interface MenuItem {
  key:      string;
  label:    string;
  icon:     string;
  path:     string;
  order:    number;
  children?: MenuItem[];
}

export interface ModulePermission {
  module:      string;
  action:      string;
  description: string;
}

// ── Registre global ───────────────────────────────────────────────────────────
class ModuleRegistry {
  private modules = new Map<string, ModuleManifest>();

  register(manifest: ModuleManifest) {
    if (this.modules.has(manifest.id)) {
      throw new Error(`Module '${manifest.id}' déjà enregistré`);
    }
    this.modules.set(manifest.id, manifest);
    console.log(`[ModuleRegistry] ✅ Module chargé : ${manifest.name} v${manifest.version}`);
  }

  get(id: string): ModuleManifest | undefined {
    return this.modules.get(id);
  }

  getAll(): ModuleManifest[] {
    return Array.from(this.modules.values());
  }

  isRegistered(id: string): boolean {
    return this.modules.has(id);
  }

  /** Retourne le menu consolidé trié par order */
  getMenuItems(): MenuItem[] {
    return this.getAll()
      .flatMap((m) => m.menuItems)
      .sort((a, b) => a.order - b.order);
  }
}

export const registry = new ModuleRegistry();

// ── Manifestes des modules core ───────────────────────────────────────────────

registry.register({
  id: 'kernel', name: 'Noyau', version: '1.0.0', icon: 'SettingOutlined',
  category: 'system', dependencies: [],
  routes: [],
  menuItems: [
    { key: 'settings', label: 'Paramètres',         icon: 'SettingOutlined',  path: '/settings',          order: 900 },
    { key: 'users',    label: 'Utilisateurs',        icon: 'TeamOutlined',     path: '/settings/users',    order: 910 },
    { key: 'roles',    label: 'Rôles',               icon: 'SafetyOutlined',   path: '/settings/roles',    order: 911 },
    { key: 'modules',  label: 'Modules',             icon: 'AppstoreOutlined', path: '/settings/modules',  order: 912 },
    { key: 'products', label: 'Produits & Services', icon: 'ShopOutlined',     path: '/settings/products', order: 913 },
  ],
  permissions: [
    { module: 'kernel', action: 'MANAGE_USERS',   description: 'Gérer les utilisateurs' },
    { module: 'kernel', action: 'MANAGE_ROLES',   description: 'Gérer les rôles' },
    { module: 'kernel', action: 'MANAGE_MODULES', description: 'Activer/désactiver les modules' },
  ],
});

registry.register({
  id: 'crm', name: 'CRM', version: '1.0.0', icon: 'TeamOutlined',
  category: 'business', dependencies: ['kernel'],
  routes: [],
  menuItems: [
    { key: 'crm',      label: 'CRM',      icon: 'TeamOutlined',       path: '/crm', order: 100 },
    { key: 'contacts', label: 'Contacts', icon: 'ContactsOutlined',   path: '/crm/contacts', order: 101 },
    { key: 'pipeline', label: 'Pipeline', icon: 'FunnelPlotOutlined', path: '/crm/pipeline', order: 102 },
  ],
  permissions: [
    { module: 'crm', action: 'READ',   description: 'Lire les données CRM' },
    { module: 'crm', action: 'CREATE', description: 'Créer dans CRM' },
    { module: 'crm', action: 'UPDATE', description: 'Modifier dans CRM' },
    { module: 'crm', action: 'DELETE', description: 'Supprimer dans CRM' },
  ],
});

registry.register({
  id: 'ventes', name: 'Ventes', version: '1.0.0', icon: 'ShoppingCartOutlined',
  category: 'business', dependencies: ['kernel', 'crm'],
  routes: [],
  menuItems: [
    { key: 'ventes',    label: 'Ventes',     icon: 'ShoppingCartOutlined', path: '/ventes', order: 200 },
    { key: 'devis',     label: 'Devis',      icon: 'FileTextOutlined',     path: '/ventes/devis', order: 201 },
    { key: 'commandes', label: 'Commandes',  icon: 'OrderedListOutlined',  path: '/ventes/commandes', order: 202 },
    { key: 'factures',  label: 'Factures',   icon: 'AccountBookOutlined',  path: '/ventes/factures', order: 203 },
  ],
  permissions: [
    { module: 'ventes', action: 'READ',           description: 'Lire les ventes' },
    { module: 'ventes', action: 'CREATE',         description: 'Créer devis/commande' },
    { module: 'ventes', action: 'UPDATE',         description: 'Modifier ventes' },
    { module: 'ventes', action: 'DELETE',         description: 'Supprimer ventes' },
    { module: 'ventes', action: 'CONFIRM_ORDER',  description: 'Confirmer une commande' },
    { module: 'ventes', action: 'CANCEL_ORDER',   description: 'Annuler une commande' },
    { module: 'ventes', action: 'CREATE_INVOICE', description: 'Générer une facture' },
  ],
});
