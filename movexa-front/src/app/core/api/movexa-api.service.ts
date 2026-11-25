import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { silent } from '../loading/loading.interceptor';
import {
  Activity,
  Course,
  CoursePayload,
  CourseSlot,
  PlanningWeek,
  CashClosure,
  CashDay,
  CheckIn,
  Coach,
  CoachPayload,
  CheckInRequest,
  Dashboard,
  CreateStaffPayload,
  StaffAccount,
  UpdateStaffPayload,
  GymSettings,
  ImportResult,
  ImportRow,
  MemberLite,
  NavCounts,
  Payment,
  PaymentRequest,
  Plan,
  PlanPayload,
  Prospect,
  ProspectEvent,
  ProspectPayload,
  ReceptionToday,
  Receipt,
  Reminder,
  ReminderChannel,
  ReminderQueueItem,
  ReminderRule,
  ReminderStats,
  SourceStats,
} from './api.models';

/**
 * Accès HTTP aux modules du MVP (formules, encaissements, pointage, relances, prospects,
 * tableau de bord, caisse, paramètres). Les membres ont leur propre service (MembersService).
 * Tout passe par le gateway : /services/movexa-back1/api/...
 *
 * Un seul service pour tous ces petits appels : chaque méthode est une ligne, les séparer en
 * huit fichiers n'apporterait rien pour l'instant.
 */
@Injectable({ providedIn: 'root' })
export class MovexaApi {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.servicesUrl}/movexa-back1/api`;

  /** Paramètres mis en cache le temps de la session (rechargés après modification). */
  private settings$?: Observable<GymSettings>;

  // ---- Formules ----
  plans(all = false): Observable<Plan[]> {
    return this.http.get<Plan[]>(`${this.api}/plans`, { params: { all } });
  }
  createPlan(p: PlanPayload): Observable<Plan> {
    return this.http.post<Plan>(`${this.api}/plans`, p);
  }
  updatePlan(id: number, p: PlanPayload): Observable<Plan> {
    return this.http.put<Plan>(`${this.api}/plans/${id}`, p);
  }

  // ---- Cours collectifs et planning ----
  courses(): Observable<Course[]> {
    return this.http.get<Course[]>(`${this.api}/courses`);
  }
  createCourse(c: CoursePayload): Observable<Course> {
    return this.http.post<Course>(`${this.api}/courses`, c);
  }
  updateCourse(id: number, c: CoursePayload): Observable<Course> {
    return this.http.put<Course>(`${this.api}/courses/${id}`, c);
  }
  addSlot(courseId: number, s: CourseSlot): Observable<CourseSlot> {
    return this.http.post<CourseSlot>(`${this.api}/courses/${courseId}/slots`, s);
  }
  updateSlot(id: number, s: CourseSlot): Observable<CourseSlot> {
    return this.http.put<CourseSlot>(`${this.api}/course-slots/${id}`, s);
  }
  deleteSlot(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/course-slots/${id}`);
  }
  /** Séances de la semaine contenant ce jour (aaaa-mm-jj) */
  planning(week: string): Observable<PlanningWeek> {
    return this.http.get<PlanningWeek>(`${this.api}/planning`, { params: { week } });
  }

  // ---- Activités de la salle ----
  activities(): Observable<Activity[]> {
    return this.http.get<Activity[]>(`${this.api}/activities`);
  }
  createActivity(name: string): Observable<Activity> {
    return this.http.post<Activity>(`${this.api}/activities`, { name });
  }
  updateActivity(a: Pick<Activity, 'id' | 'name' | 'active'>): Observable<Activity> {
    return this.http.put<Activity>(`${this.api}/activities/${a.id}`, a);
  }

  // ---- Coachs ----
  coaches(): Observable<Coach[]> {
    return this.http.get<Coach[]>(`${this.api}/coaches`);
  }
  coachDisciplines(): Observable<string[]> {
    return this.http.get<string[]>(`${this.api}/coaches/disciplines`);
  }
  createCoach(c: CoachPayload): Observable<Coach> {
    return this.http.post<Coach>(`${this.api}/coaches`, c);
  }
  updateCoach(id: number, c: CoachPayload): Observable<Coach> {
    return this.http.put<Coach>(`${this.api}/coaches/${id}`, c);
  }
  deleteCoach(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/coaches/${id}`);
  }

  // ---- Membres (recherche et cache) ----
  searchMembers(q: string, limit = 8): Observable<MemberLite[]> {
    return this.http.get<MemberLite[]>(`${this.api}/members/search`, { params: { q, limit }, context: silent() });
  }
  /** Copie locale pour le pointage hors ligne : chargée en arrière-plan, sans loader */
  membersLite(): Observable<MemberLite[]> {
    return this.http.get<MemberLite[]>(`${this.api}/members/lite`, { context: silent() });
  }
  importMembers(rows: ImportRow[], updateExisting: boolean, dryRun: boolean): Observable<ImportResult> {
    return this.http.post<ImportResult>(`${this.api}/members/import`, { rows, updateExisting, dryRun });
  }

  // ---- Encaissements ----
  payments(date?: string): Observable<Payment[]> {
    const params = date ? new HttpParams().set('date', date) : undefined;
    return this.http.get<Payment[]>(`${this.api}/payments`, { params });
  }
  paymentLinks(): Observable<Payment[]> {
    return this.http.get<Payment[]>(`${this.api}/payments/links`);
  }
  pay(req: PaymentRequest): Observable<Payment> {
    return this.http.post<Payment>(`${this.api}/payments`, req);
  }
  cancelPayment(id: number, reason: string): Observable<Payment> {
    return this.http.post<Payment>(`${this.api}/payments/${id}/cancel`, { reason });
  }
  confirmPayment(id: number): Observable<Payment> {
    return this.http.post<Payment>(`${this.api}/payments/${id}/confirm`, {});
  }
  receipt(id: number): Observable<Receipt> {
    return this.http.get<Receipt>(`${this.api}/payments/${id}/receipt`);
  }
  cashDay(date?: string): Observable<CashDay> {
    const params = date ? new HttpParams().set('date', date) : undefined;
    return this.http.get<CashDay>(`${this.api}/cash`, { params });
  }
  closeCash(body: { date: string; countedCash: number; countedMtn: number; countedMoov: number; reason: string | null }): Observable<CashClosure> {
    return this.http.post<CashClosure>(`${this.api}/cash/closures`, body);
  }

  // ---- Pointage ----
  /** background = true : envoi de la file hors ligne, sans loader */
  checkIn(req: CheckInRequest, background = false): Observable<CheckIn> {
    return this.http.post<CheckIn>(`${this.api}/check-ins`, req, background ? { context: silent() } : {});
  }
  checkInsToday(): Observable<CheckIn[]> {
    return this.http.get<CheckIn[]>(`${this.api}/check-ins/today`);
  }

  // ---- Relances membres ----
  reminderQueue(): Observable<ReminderQueueItem[]> {
    return this.http.get<ReminderQueueItem[]>(`${this.api}/reminders/queue`);
  }
  /** Messages prêts pour des membres choisis à la main (cases cochées dans la liste) */
  reminderCompose(memberIds: number[]): Observable<ReminderQueueItem[]> {
    return this.http.post<ReminderQueueItem[]>(`${this.api}/reminders/compose`, memberIds);
  }
  reminderSent(body: { memberId: number; rule: ReminderRule; channel: ReminderChannel; targetEndDate: string | null; message: string }): Observable<Reminder> {
    return this.http.post<Reminder>(`${this.api}/reminders`, body);
  }
  reminderHistory(days = 30): Observable<Reminder[]> {
    return this.http.get<Reminder[]>(`${this.api}/reminders/history`, { params: { days } });
  }
  reminderStats(): Observable<ReminderStats> {
    return this.http.get<ReminderStats>(`${this.api}/reminders/stats`);
  }

  // ---- Prospects ----
  prospects(scope: 'TODAY' | 'OPEN' | 'CLOSED'): Observable<Prospect[]> {
    return this.http.get<Prospect[]>(`${this.api}/prospects`, { params: { scope } });
  }
  searchProspects(q: string): Observable<Prospect[]> {
    return this.http.get<Prospect[]>(`${this.api}/prospects/search`, { params: { q }, context: silent() });
  }
  prospect(id: number): Observable<Prospect> {
    return this.http.get<Prospect>(`${this.api}/prospects/${id}`);
  }
  prospectEvents(id: number): Observable<ProspectEvent[]> {
    return this.http.get<ProspectEvent[]>(`${this.api}/prospects/${id}/events`);
  }
  prospectStats(): Observable<SourceStats[]> {
    return this.http.get<SourceStats[]>(`${this.api}/prospects/stats`);
  }
  createProspect(p: ProspectPayload): Observable<Prospect> {
    return this.http.post<Prospect>(`${this.api}/prospects`, p);
  }
  updateProspect(id: number, p: ProspectPayload): Observable<Prospect> {
    return this.http.put<Prospect>(`${this.api}/prospects/${id}`, p);
  }
  prospectInteraction(id: number, type: 'REPLY' | 'VISIT' | 'TRIAL'): Observable<Prospect> {
    return this.http.post<Prospect>(`${this.api}/prospects/${id}/interactions`, { type });
  }
  prospectFollowUp(id: number, channel: ReminderChannel): Observable<Prospect> {
    return this.http.post<Prospect>(`${this.api}/prospects/${id}/follow-ups`, { channel });
  }
  prospectLost(id: number): Observable<Prospect> {
    return this.http.post<Prospect>(`${this.api}/prospects/${id}/lost`, {});
  }
  runProspectDecay(): Observable<unknown> {
    return this.http.post(`${this.api}/prospects/decay`, {});
  }

  // ---- Tableau de bord, accueil, paramètres ----
  dashboard(period: 'DAY' | 'WEEK' | 'MONTH'): Observable<Dashboard> {
    return this.http.get<Dashboard>(`${this.api}/dashboard`, { params: { period } });
  }
  /** Pastilles du menu, rechargées à chaque changement de page (sans loader) */
  navCounts(): Observable<NavCounts> {
    return this.http.get<NavCounts>(`${this.api}/nav-counts`, { context: silent() });
  }
  receptionToday(): Observable<ReceptionToday> {
    return this.http.get<ReceptionToday>(`${this.api}/reception/today`);
  }
  settings(): Observable<GymSettings> {
    this.settings$ ??= this.http.get<GymSettings>(`${this.api}/settings`).pipe(shareReplay(1));
    return this.settings$;
  }
  saveSettings(s: GymSettings): Observable<GymSettings> {
    this.settings$ = undefined;
    return this.http.put<GymSettings>(`${this.api}/settings`, s);
  }

  // ---- Comptes du personnel (gateway, réservé au gérant) ----
  staff(): Observable<StaffAccount[]> {
    return this.http.get<StaffAccount[]>(`${environment.apiUrl}/admin/staff`);
  }
  createStaff(payload: CreateStaffPayload): Observable<StaffAccount> {
    return this.http.post<StaffAccount>(`${environment.apiUrl}/admin/staff`, payload);
  }
  updateStaff(id: number, payload: UpdateStaffPayload): Observable<StaffAccount> {
    return this.http.put<StaffAccount>(`${environment.apiUrl}/admin/staff/${id}`, payload);
  }
  resetStaffPassword(id: number, password: string): Observable<void> {
    return this.http.put<void>(`${environment.apiUrl}/admin/staff/${id}/password`, { password });
  }

  // ---- Mon compte (gateway) ----
  changeMyPassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/account/change-password`, { currentPassword, newPassword });
  }
}
