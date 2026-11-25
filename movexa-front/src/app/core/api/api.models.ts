/**
 * Types renvoyés par l'API du service movexa-back1 (records Java côté serveur).
 * Les dates « jour » sont au format AAAA-MM-JJ, les instants au format ISO 8601 (UTC).
 */

export type PaymentMethod = 'CASH' | 'MTN_MOMO' | 'MOOV_MONEY' | 'PAYMENT_LINK';
export type PaymentStatus = 'PENDING' | 'PAID' | 'CANCELLED';
export type SubscriptionState = 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'NONE';
export type CheckInMethod = 'QR' | 'SEARCH';
/** REFUSED : abonnement expiré ou inexistant ; REFUSED_ACTIVITY : activité non incluse dans la formule */
export type CheckInResult = 'ALLOWED' | 'ALLOWED_EXPIRING' | 'REFUSED' | 'REFUSED_ACTIVITY';
export type ReminderChannel = 'SMS' | 'WHATSAPP';
export type ReminderRule = 'BEFORE_7' | 'BEFORE_1' | 'AFTER_1' | 'AFTER_7';
export type ProspectSource = 'WALK_IN' | 'REFERRAL' | 'WORD_OF_MOUTH' | 'SOCIAL' | 'FLYER' | 'OTHER';
export type ProspectStatus = 'NEW' | 'CONTACTED' | 'TRIAL' | 'CONVERTED' | 'LOST';

export interface Plan {
  id: number;
  name: string;
  price: number;
  /** 0 = valable le jour même (séance unique) */
  durationDays: number;
  active: boolean;
  /** Membres dont c'est la formule en cours */
  memberCount: number | null;
  /** Ajoutés au prix pour la première formule du membre (0 = aucun) */
  registrationFee: number;
  freezeAllowed: boolean;
  activityIds: number[];
  activityNames: string[];
  /** Ventes payées depuis le 1er du mois */
  salesThisMonth: number | null;
}

export type PlanPayload = Omit<Plan, 'id' | 'memberCount' | 'activityNames' | 'salesThisMonth'> & { id?: number };

/** Activité de la salle (musculation, cours collectifs, sauna…) */
export interface Activity {
  id: number;
  name: string;
  active: boolean;
  /** Nombre de formules qui l'incluent */
  planCount: number | null;
}

/** Coach de la salle et ses disciplines */
export interface Coach {
  id: number;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  active: boolean;
  disciplines: string[];
  /** Membres suivis (lecture seule) */
  memberCount: number | null;
  createdAt: string | null;
}

export type CoachPayload = Omit<Coach, 'id' | 'memberCount' | 'createdAt'>;

/** Membre en version légère (recherche, accueil, pointage, cache hors ligne) */
export interface MemberLite {
  id: number;
  memberNumber: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  planName: string | null;
  endDate: string | null;
  state: SubscriptionState;
  daysLeft: number | null;
  qrToken: string;
  /** Une photo existe (affichée à l'accueil) */
  hasPhoto?: boolean;
}

export interface Payment {
  id: number;
  memberId: number;
  memberName: string;
  memberNumber: string;
  memberPhone: string | null;
  planId: number | null;
  planName: string | null;
  amount: number;
  /** Part des frais d'inscription comprise dans le montant (première formule), sinon null */
  registrationFee: number | null;
  method: PaymentMethod;
  status: PaymentStatus;
  receiptNumber: string | null;
  reference: string | null;
  paymentUrl: string | null;
  createdAt: string;
  createdBy: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  validFrom: string | null;
  validTo: string | null;
}

export interface PaymentRequest {
  memberId: number;
  planId: number;
  method: PaymentMethod;
  amount?: number | null;
  startDate?: string | null;
  reference?: string | null;
}

export interface Receipt {
  paymentId: number;
  number: string | null;
  status: PaymentStatus;
  paidAt: string | null;
  amount: number;
  method: PaymentMethod;
  memberName: string;
  memberNumber: string;
  memberPhone: string | null;
  planName: string | null;
  validFrom: string | null;
  validTo: string | null;
  agent: string | null;
  gymName: string | null;
  gymAddress: string | null;
  gymPhone: string | null;
  footer: string | null;
  cancelReason: string | null;
}

export interface CheckIn {
  id: number;
  memberId: number;
  memberName: string;
  memberNumber: string;
  memberPhone: string | null;
  method: CheckInMethod;
  result: CheckInResult;
  checkedAt: string;
  agent: string | null;
  state: SubscriptionState;
  planName: string | null;
  endDate: string | null;
  daysLeft: number | null;
  /** Activité pointée (null si non précisée) */
  activityName: string | null;
  /** Activités incluses dans la formule en cours (seulement dans la réponse à un pointage) */
  includedActivities: string[];
  /** Le membre a une photo (affichée à l'accueil pour le reconnaître) */
  memberHasPhoto: boolean;
}

export interface CheckInRequest {
  memberId?: number;
  qrToken?: string;
  method: CheckInMethod;
  clientId?: string;
  checkedAt?: string;
  /** Activité demandée ; absente = pas de vérification d'activité */
  activityId?: number | null;
}

export interface Subscription {
  id: number;
  planName: string;
  price: number;
  startDate: string;
  endDate: string;
  cancelled: boolean;
  createdAt: string;
  /** Jours ajoutés par des gels */
  frozenDays: number;
}

export interface ReminderQueueItem {
  memberId: number;
  memberName: string;
  phone: string | null;
  rule: ReminderRule;
  channel: ReminderChannel;
  targetEndDate: string;
  planName: string | null;
  amount: number | null;
  expired: boolean;
  message: string;
}

export interface Reminder {
  id: number;
  memberId: number;
  memberName: string;
  rule: ReminderRule;
  channel: ReminderChannel;
  targetEndDate: string | null;
  sentAt: string;
  sentBy: string | null;
  outcome: 'RENEWED' | 'WAITING' | 'NO_RESPONSE';
  outcomeText: string;
}

export interface ReminderStats {
  sent: number;
  sms: number;
  whatsapp: number;
  renewed: number;
  recoveredAmount: number;
  toSendToday: number;
}

export interface Prospect {
  id: number;
  name: string | null;
  phone: string;
  source: ProspectSource;
  status: ProspectStatus;
  firstContactDate: string;
  interestedPlan: string | null;
  notes: string | null;
  score: number;
  lastInteractionAt: string;
  nextFollowUp: string | null;
  followUpStep: number;
  convertedMemberId: number | null;
  closedAt: string | null;
  dueToday: boolean;
  lastChance: boolean;
}

export interface ProspectPayload {
  name: string | null;
  phone: string;
  source: ProspectSource;
  interestedPlan: string | null;
  notes: string | null;
}

export interface ProspectEvent {
  id: number;
  label: string;
  delta: number | null;
  createdAt: string;
  createdBy: string | null;
}

export interface SourceStats {
  source: ProspectSource;
  converted: number;
  lost: number;
  expired: number;
  averageDaysToDecision: number | null;
}

export interface DayCount {
  day: string;
  count: number;
}

export interface DueMember {
  member: MemberLite;
  reminderCount: number;
}

export interface Dashboard {
  period: 'DAY' | 'WEEK' | 'MONTH';
  from: string;
  totalPaid: number;
  paidByMethod: Record<PaymentMethod, number>;
  paymentsCount: number;
  cancelledCount: number;
  activeMembers: number;
  newMembers: number;
  expiredMembers: number;
  remindersSentWeek: number;
  renewedAfterReminderWeek: number;
  attendance: DayCount[];
  expiringCount: number;
  expiring: DueMember[];
  expiredCount: number;
  expired: DueMember[];
  /** Abonnements arrivés à échéance depuis le début de la période, et ceux déjà renouvelés */
  renewalsDue: number;
  renewalsDone: number;
  /** Objectifs du mois (Paramètres), null si non fixés */
  revenueGoal: number | null;
  newMembersGoal: number | null;
}

export interface ReceptionToday {
  entriesToday: number;
  refusedToday: number;
  paymentsToday: number;
  visitedToRenew: MemberLite[];
  prospectsToFollow: Prospect[];
}

export interface CashClosure {
  id: number;
  closingDate: string;
  expectedCash: number;
  countedCash: number;
  expectedMtn: number;
  countedMtn: number;
  expectedMoov: number;
  countedMoov: number;
  expectedLink: number;
  reason: string | null;
  closedBy: string | null;
  closedAt: string;
}

export interface CashDay {
  date: string;
  expectedCash: number;
  expectedMtn: number;
  expectedMoov: number;
  expectedLink: number;
  paymentsCount: number;
  closure: CashClosure | null;
}

export interface GymSettings {
  id: number;
  name: string | null;
  phone: string | null;
  address: string | null;
  openingHours: string | null;
  momoNumber: string | null;
  moovNumber: string | null;
  receiptFooter: string | null;
  expiringSoonDays: number;
  /** Personnes accueillies en même temps (facultatif) */
  capacity: number | null;
  /** Objectifs du mois affichés au tableau de bord (facultatifs) */
  revenueGoal: number | null;
  newMembersGoal: number | null;
  cashEnabled: boolean;
  mtnEnabled: boolean;
  moovEnabled: boolean;
  aggregator: string | null;
  paymentLinkBaseUrl: string | null;
  reminderBefore7Sms: boolean;
  reminderBefore7Whatsapp: boolean;
  reminderBefore1Sms: boolean;
  reminderBefore1Whatsapp: boolean;
  reminderAfter1Sms: boolean;
  reminderAfter1Whatsapp: boolean;
  reminderAfter7Sms: boolean;
  reminderAfter7Whatsapp: boolean;
  scoreWalkIn: number;
  scoreReferral: number;
  scoreWordOfMouth: number;
  scoreSocial: number;
  scoreFlyer: number;
  scoreOther: number;
  pointsReply: number;
  pointsVisit: number;
  pointsTrial: number;
  graceDays: number;
  decayPerDay: number;
  alertThreshold: number;
}

export interface ImportRow {
  line: number;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  phone?: string | null;
  planName?: string | null;
  endDate?: string | null;
}

export interface ImportLine {
  line: number;
  name: string;
  phone: string;
  planName: string | null;
  endDate: string | null;
  status: 'READY' | 'DUPLICATE' | 'MISSING_PHONE' | 'INVALID' | 'IMPORTED' | 'UPDATED' | 'SKIPPED';
  message: string;
}

export interface ImportResult {
  ready: number;
  duplicates: number;
  invalid: number;
  imported: number;
  updated: number;
  lines: ImportLine[];
}

/** Rôle d'un compte du personnel. OTHER : compte sans rôle MOVEXA (aucun accès). */
export type StaffRole = 'MANAGER' | 'RECEPTION' | 'COMMERCIAL' | 'OTHER';

/** Compte du personnel (gateway, GET /api/admin/staff) */
export interface StaffAccount {
  id: number;
  login: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  activated: boolean;
  role: StaffRole;
  createdDate: string | null;
  lastModifiedDate: string | null;
}

/** L'adresse e-mail sert à se connecter (le serveur en fait aussi l'identifiant) */
export interface CreateStaffPayload {
  firstName: string;
  lastName: string | null;
  email: string;
  role: StaffRole;
  password: string;
}

export interface UpdateStaffPayload {
  firstName: string;
  lastName: string | null;
  email: string;
  role: StaffRole;
  activated: boolean;
}

/** Pastilles du menu latéral (GET /api/nav-counts) */
export interface NavCounts {
  /** Prospects à relancer aujourd'hui */
  prospectsToday: number;
  /** Abonnements qui finissent dans le seuil « expire bientôt » */
  expiringSoon: number;
}

// ---- Cours collectifs et planning (lot 5) ----

/** Couleurs des cours dans le planning */
export type CourseColor = 'mint' | 'peach' | 'lavender' | 'lime' | 'sky' | 'rose';

/** Créneau hebdomadaire : jour 1 = lundi … 7 = dimanche, heure « 18:00 » */
export interface CourseSlot {
  id?: number;
  courseId?: number;
  dayOfWeek: number;
  startTime: string;
  /** Vide = la salle du cours */
  room: string | null;
  /** Vide = le coach du cours */
  coachId: number | null;
  coachName?: string | null;
}

export interface Course {
  id: number;
  name: string;
  description: string | null;
  coachId: number | null;
  coachName: string | null;
  /** Activité pointée pour ce cours (sert à compter les présents) */
  activityId: number | null;
  activityName: string | null;
  durationMinutes: number;
  capacity: number;
  room: string | null;
  color: CourseColor;
  active: boolean;
  slots: CourseSlot[];
  /** Remplissage moyen sur 4 semaines (%), null si non mesuré */
  avgFillPct: number | null;
}

export type CoursePayload = Omit<Course, 'id' | 'coachName' | 'activityName' | 'slots' | 'avgFillPct'>;

/** Une séance du planning (créneau × date) */
export interface CourseSession {
  slotId: number;
  courseId: number;
  courseName: string;
  date: string;
  startTime: string;
  endTime: string;
  coachName: string | null;
  room: string | null;
  capacity: number;
  color: CourseColor;
  /** Présents pointés sur l'activité du cours (null si à venir ou non mesuré) */
  present: number | null;
}

export interface PlanningWeek {
  weekStart: string;
  sessions: CourseSession[];
}

// ---- Statistiques (GET /api/stats/management, /api/stats/sales) ----
export type StatsPeriod = 'MONTH' | 'QUARTER' | 'YEAR';

export interface MonthStat {
  /** AAAA-MM */
  month: string;
  revenue: number;
  joined: number;
  left: number;
}

export interface ManagementStats {
  period: StatsPeriod;
  from: string;
  to: string;
  revenue: number;
  revenuePrevious: number;
  activeMembers: number;
  newMembers: number;
  renewalsDue: number;
  renewalsDone: number;
  avgSpendPerMemberMonth: number | null;
  months: MonthStat[];
  /** [lundi = 0 … dimanche = 6][heure 0–23] : entrées des dernières semaines */
  heatmap: number[][];
  heatmapWeeks: number;
  plans: { plan: string; members: number }[];
}

export interface SalesStats {
  period: StatsPeriod;
  from: string;
  to: string;
  prospects: number;
  contacted: number;
  converted: number;
  avgDaysToConvert: number | null;
  sources: { source: ProspectSource; prospects: number; converted: number }[];
  sellers: { login: string; prospects: number; converted: number; onTimePct: number | null }[];
  remindersSent: number;
  remindersWhatsapp: number;
  lapsedReminded: number;
  lapsedCameBack: number;
}

// ---- Pages publiques envoyées au membre (sans connexion) ----
export interface PublicCard {
  firstName: string;
  lastName: string | null;
  memberNumber: string | null;
  gymName: string | null;
  endDate: string | null;
  state: SubscriptionState | null;
  qrToken: string;
}

export interface PublicReceipt {
  number: string | null;
  status: PaymentStatus;
  paidAt: string | null;
  amount: number;
  registrationFee: number | null;
  method: PaymentMethod;
  memberName: string;
  planName: string | null;
  validFrom: string | null;
  validTo: string | null;
  agent: string | null;
  gymName: string | null;
  gymAddress: string | null;
  gymPhone: string | null;
  footer: string | null;
  /** Jeton de la carte du membre (bouton « Mon QR code »), absent si le reçu est annulé */
  cardToken: string | null;
}
