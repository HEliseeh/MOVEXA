export interface MenuStep {
  id: string;
  label: string;
  /** Tracé SVG (attribut d="", viewBox 0 0 24 24, icône au trait) — entrées de premier niveau */
  iconPath?: string;
  /** Route de la page ; vide pour un groupe ou une page pas encore ouverte */
  route: string[];
  /** Sous-entrées optionnelles */
  children?: MenuStep[];
  /** Fonctionnalité annoncée mais non ouverte (grisée, sans lien) */
  disabled?: boolean;
  /** Trace un séparateur au-dessus de l'entrée (début de domaine) */
  groupStart?: boolean;
  /** Rôles qui peuvent ouvrir l'entrée (aucun = tout le monde). Les autres la voient grisée, avec un cadenas. */
  roles?: string[];
}

export const MANAGER = 'ROLE_ADMIN';
export const RECEPTION = 'ROLE_RECEPTION';
/** Profil commercial du design — pas encore créé côté backend */
export const COMMERCIAL = 'ROLE_COMMERCIAL';

/** Nom des profils dans l'info-bulle « Réservé au profil … » */
export const ROLE_SHORT_LABELS: Record<string, string> = {
  [MANAGER]: 'gérant',
  [RECEPTION]: 'accueil',
  [COMMERCIAL]: 'commercial',
};

const G = [MANAGER];
const GR = [MANAGER, RECEPTION];
const GC = [MANAGER, COMMERCIAL];

const ICONS = {
  dash: 'M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z',
  scan: 'M3 8V4h5M16 3h5v5M21 16v5h-5M8 21H3v-5M8 12h8',
  members:
    'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M22 20v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  calendar:
    'M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2',
  dumbbell: 'M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11',
  funnel: 'M3 4h18l-7 8v6l-4 2v-8z',
  heart:
    'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z',
  megaphone: 'M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1zM17 9a4 4 0 0 1 0 6',
  cash: 'M2 7h20v12H2zM2 11h20M6 15h4',
  bag: 'M6 7h12l1 14H5zM9 7a3 3 0 0 1 6 0',
  book: 'M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3zM18 17H7a3 3 0 0 0-3 3',
  team: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1',
  chart: 'M4 20V10M10 20V4M16 20v-7M2 20h20',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4',
};

/** Page prévue dans la maquette mais pas encore développée */
const soon = (id: string, label: string, roles?: string[]): MenuStep => ({
  id,
  label,
  route: [],
  disabled: true,
  roles,
});

// ---------------------------------------------------------------
// Menu latéral (maquette « Flex Club · E2 », composant Sidebar) :
// 5 domaines séparés par un trait, 13 modules, sous-éléments repliés.
// Le menu est le même pour tous : ce que le profil ne peut pas
// ouvrir reste visible, grisé, avec un cadenas.
// ---------------------------------------------------------------
export const MENU_ITEMS: MenuStep[] = [
  // ---- Pilotage ----
  { id: 'dashboard', label: 'Tableau de bord', iconPath: ICONS.dash, route: ['/dashboard'], roles: G },

  // ---- Opérations du club ----
  {
    id: 'access',
    label: 'Accès et présence',
    iconPath: ICONS.scan,
    route: ['/access'],
    roles: GR,
    groupStart: true,
  },
  { id: 'members', label: 'Membres', iconPath: ICONS.members, route: ['/members'] },
  {
    id: 'm-planning',
    label: 'Planning et cours',
    iconPath: ICONS.calendar,
    route: [],
    children: [
      soon('planning', 'Planning du club', GR),
      { id: 'coaches', label: 'Cours et coachs', route: ['/coaches'], roles: G },
      soon('bookings', 'Réservations', GR),
    ],
  },
  { ...soon('equipment', 'Équipements', G), iconPath: ICONS.dumbbell },

  // ---- Commercial et marketing ----
  {
    id: 'm-crm',
    label: 'Prospection',
    iconPath: ICONS.funnel,
    route: [],
    groupStart: true,
    children: [
      { id: 'prospects', label: 'Prospects', route: ['/prospects'] },
      soon('visits', 'Visites et essais'),
      soon('sales-path', 'Parcours commercial', G),
    ],
  },
  {
    id: 'm-loyalty',
    label: 'Fidélisation',
    iconPath: ICONS.heart,
    route: [],
    children: [
      { id: 'reminders', label: 'Relances', route: ['/reminders'] },
      soon('action-plans', 'Plans d’action', GC),
      soon('tasks', 'Tâches assignées', GC),
    ],
  },
  {
    id: 'm-com',
    label: 'Communication',
    iconPath: ICONS.megaphone,
    route: [],
    children: [
      soon('campaigns', 'Campagnes SMS et e-mail', GC),
      soon('notifications', 'Notifications', G),
      soon('website', 'Site vitrine', G),
    ],
  },

  // ---- Ventes et finances ----
  {
    id: 'm-cash',
    label: 'Caisse',
    iconPath: ICONS.cash,
    route: [],
    groupStart: true,
    children: [
      { id: 'payments', label: 'Encaissements', route: ['/payments'], roles: GR },
      soon('pos', 'Point de vente', GR),
      soon('safe', 'Coffre et clôture', GR),
    ],
  },
  { ...soon('shop', 'Boutique en ligne', G), iconPath: ICONS.bag },
  {
    id: 'm-accounting',
    label: 'Comptabilité',
    iconPath: ICONS.book,
    route: [],
    children: [soon('accounting', 'Gestion comptable', G)],
  },

  // ---- Équipe et pilotage ----
  {
    id: 'm-staff',
    label: 'Personnel',
    iconPath: ICONS.team,
    route: [],
    groupStart: true,
    children: [soon('staff', 'Équipe et rôles', G), soon('staff-planning', 'Plannings et congés', G)],
  },
  {
    id: 'm-stats',
    label: 'Statistiques',
    iconPath: ICONS.chart,
    route: [],
    children: [soon('stats-management', 'Gestion', G), soon('stats-sales', 'Commerciales', GC)],
  },
  {
    id: 'm-settings',
    label: 'Réglages',
    iconPath: ICONS.settings,
    route: [],
    children: [
      { id: 'settings', label: 'Paramètres', route: ['/settings'], roles: G },
      soon('sites', 'Mes salles', G),
      soon('exports', 'Exports de données', G),
      soon('support', 'Aide et support'),
    ],
  },
];
