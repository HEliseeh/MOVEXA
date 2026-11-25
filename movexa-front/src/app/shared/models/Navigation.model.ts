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
  /** Pastille : nombre d'éléments qui attendent une action (voir NavCounts). Un groupe fermé affiche la somme. */
  badge?: NavBadge;
}

/** Compteurs affichés dans le menu (GET /api/nav-counts) */
export type NavBadge = 'prospectsToday' | 'expiringSoon';

export const MANAGER = 'ROLE_ADMIN';
export const RECEPTION = 'ROLE_RECEPTION';
/** Commercial : membres, prospects, relances, statistiques commerciales */
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
const home = 'M3 11l9-8 9 8M5 9.5V21h14V9.5M10 21v-6h4v6';

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
// Menu latéral (maquette « Flex Club · MVP », composant Sidebar) :
// 3 domaines séparés par un trait, sous-éléments repliés.
// Le menu est le même pour tous : ce que le profil ne peut pas
// ouvrir reste visible, grisé, avec un cadenas.
// Les pages pas encore développées sont grisées « Bientôt ».
// ---------------------------------------------------------------
export const MENU_ITEMS: MenuStep[] = [
  // ---- Pilotage et accueil ----
  { id: 'dashboard', label: 'Tableau de bord', iconPath: ICONS.dash, route: ['/dashboard'], roles: G },
  { id: 'reception', label: 'Accueil', iconPath: home, route: ['/reception'], roles: GR },

  // ---- Clients, planning, encaissement ----
  {
    id: 'm-clients',
    label: 'Clients',
    iconPath: ICONS.members,
    route: [],
    groupStart: true,
    children: [
      { id: 'access', label: 'Accès et présence', route: ['/access'], roles: GR },
      { id: 'members', label: 'Membres', route: ['/members'] },
      { id: 'prospects', label: 'Prospects', route: ['/prospects'], badge: 'prospectsToday' },
      { id: 'reminders', label: 'Relances', route: ['/reminders'] },
      { id: 'import', label: 'Importer un fichier', route: ['/members/import'], roles: G },
    ],
  },
  {
    id: 'm-planning',
    label: 'Planning et abonnements',
    iconPath: ICONS.calendar,
    route: [],
    children: [
      { id: 'planning', label: 'Planning du club', route: ['/planning'], roles: GR },
      { id: 'coaches', label: 'Cours et coachs', route: ['/coaches'], roles: G },
      { id: 'subscriptions', label: 'Abonnements et échéances', route: ['/subscriptions'], roles: GR, badge: 'expiringSoon' },
      { id: 'plans', label: 'Formules et tarifs', route: ['/plans'], roles: G },
    ],
  },
  { id: 'payments', label: 'Encaissements', iconPath: ICONS.cash, route: ['/payments'], roles: GR },

  // ---- Équipe et pilotage ----
  { id: 'team', label: 'Équipe et rôles', iconPath: ICONS.team, route: ['/team'], roles: G, groupStart: true },
  { ...soon('stats', 'Statistiques', GC), iconPath: ICONS.chart },
  { id: 'settings', label: 'Paramètres', iconPath: ICONS.settings, route: ['/settings'], roles: G },
];
