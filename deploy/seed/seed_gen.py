"""Génère des données de test réalistes pour FLEXCLUBMANAGEMENT (back1 + gateway), relatives à la date du jour.

Usage : python -I seed_gen.py <dossier de sortie>
Produit seed_back1.sql et seed_gateway.sql (chacun à exécuter en une transaction).
"""
import datetime as dt
import random
import sys

random.seed(2026)
OUT = sys.argv[1]
TODAY = dt.date.today()
BENIN = dt.timedelta(hours=1)  # UTC+1 : les colonnes timestamp sont en UTC

RECEPTION = 'rose@flexclub.test'
COMMERCIAL = 'serge@flexclub.test'
MANAGER = 'admin@localhost'

PLANS = {  # id: (nom, prix, jours)
    1: ('Séance unique', 1500, 0),
    2: ('Semaine', 5000, 7),
    3: ('Mensuel', 15000, 30),
    4: ('Trimestriel', 40000, 90),
    5: ('Semestriel', 75000, 180),
    6: ('Annuel', 140000, 365),
}
METHODS = ['CASH'] * 5 + ['MTN_MOMO'] * 4 + ['MOOV_MONEY'] * 2

FIRST_F = ['Awa', 'Inès', 'Grâce', 'Rose', 'Nadia', 'Clarisse', 'Edwige', 'Bénédicte', 'Fifamè', 'Mariam', 'Sarah', 'Aïcha',
           'Léa', 'Camille', 'Sènami', 'Mireille', 'Gloria', 'Prisca', 'Ornella', 'Josiane']
FIRST_M = ['Koffi', 'Yacine', 'Brice', 'Dieudonné', 'Fortuné', 'Romuald', 'Thomas', 'Mamadou', 'Serge', 'Marc', 'Ange',
           'Romaric', 'Ulrich', 'Junior', 'Arnaud', 'Gildas', 'Hervé', 'Sylvain', 'Landry', 'Rodrigue']
LAST = ['Diallo', 'Benali', 'Mensah', 'Hounkpatin', 'Ahyi', 'Kpade', 'Sagbo', 'Gbaguidi', 'Kiki', 'Lefèvre', 'Sow', 'Moreau',
        'Nguyen', 'Houngbo', 'Agbo', 'Dossou', 'Adjovi', 'Koné', 'Ahouansou', 'Hounsou', 'Akakpo', 'Tossou', 'Zinsou',
        'Assogba', 'Dégbé', 'Glèlè', 'Kakpo', 'Quenum', 'Yessoufou', 'Bio']
NOTES = [None] * 6 + ['Genou droit fragile, éviter les sauts.', 'Objectif : perdre 8 kg avant mars.', 'Parrainé par un membre.',
                      'Préfère le cours du soir.', 'Asthme léger : prévoir des pauses.']

out = []


def q(v):
    """Littéral SQL."""
    if v is None:
        return 'NULL'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, dt.datetime):
        return "'" + v.strftime('%Y-%m-%d %H:%M:%S') + "'"
    if isinstance(v, dt.date):
        return "'" + v.isoformat() + "'"
    return "'" + str(v).replace("'", "''") + "'"


def utc(day, hour, minute=0):
    """Heure du Bénin → instant UTC (colonne timestamp)."""
    return dt.datetime.combine(day, dt.time(hour, minute)) - BENIN


used_phones = set()


def phone():
    while True:
        p = random.choice(['97', '96', '61', '62', '66', '67', '90', '91', '95']) + ''.join(random.choice('0123456789') for _ in range(6))
        if p not in used_phones:
            used_phones.add(p)
            return f'{p[0:2]} {p[2:4]} {p[4:6]} {p[6:8]}', p


# ============================================================ back1
out.append("""-- Données de test FLEXCLUBMANAGEMENT (générées le %s). Une seule transaction.
DO $$ BEGIN
  IF (SELECT count(*) FROM member) > 0 THEN
    RAISE EXCEPTION 'La base contient déjà des membres : injection annulée pour ne rien écraser.';
  END IF;
END $$;

UPDATE gym_settings SET name = 'Flex Club', phone = '01 97 00 11 22', address = 'Haie Vive, Cotonou',
  opening_hours = '06 h 00 à 22 h 00', capacity = 120, revenue_goal = 1500000, new_members_goal = 15
WHERE id = 1 AND (name IS NULL OR name = 'Ma salle');

CREATE TEMP TABLE seed_map (k int PRIMARY KEY, member_id bigint) ON COMMIT DROP;
""" % TODAY.isoformat())

# ---- Coachs, cours, créneaux
coaches = [
    ('Marc', 'Kouassi', '97 52 18 40', ['Cardio-boxe', 'Circuit training', 'Musculation']),
    ('Grâce', 'Ahouansou', '66 31 07 92', ['Zumba', 'Danse']),
    ('Bénédicte', 'Hounsou', '61 44 25 13', ['Renforcement', 'Stretching']),
]
for f, l, ph, disc in coaches:
    out.append(f"INSERT INTO coach (first_name, last_name, phone, active, created_at) VALUES ({q(f)}, {q(l)}, {q(ph)}, true, {q(utc(TODAY - dt.timedelta(days=200), 9))});")
    for d in disc:
        out.append(f"INSERT INTO coach_discipline (coach_id, discipline) SELECT id, {q(d)} FROM coach WHERE first_name = {q(f)} AND last_name = {q(l)};")

courses = [  # nom, description, coach, durée, places, salle, couleur, créneaux (jour 1-7, heure)
    ('Cardio-boxe', 'Tous niveaux · intense', 'Marc', 60, 20, 'Salle de combat', 'lavender', [(1, '18:00'), (3, '18:00'), (5, '18:00')]),
    ('Zumba', 'Débutants bienvenus', 'Grâce', 60, 25, 'Studio', 'peach', [(1, '19:00'), (3, '19:00'), (6, '10:00')]),
    ('Réveil musculaire', 'Doux · le matin', 'Bénédicte', 60, 15, 'Studio', 'lime', [(1, '07:00'), (3, '07:00'), (5, '07:00'), (2, '09:00'), (4, '09:00'), (7, '09:00')]),
    ('Circuit training', 'Intermédiaire', 'Marc', 60, 16, 'Plateau musculation', 'mint', [(2, '17:30'), (4, '17:30'), (6, '11:30')]),
]
for name, desc, coach, dur, cap, room, color, slots in courses:
    out.append(
        f"INSERT INTO course (name, description, coach_id, activity_id, duration_minutes, capacity, room, color, active, created_at) "
        f"SELECT {q(name)}, {q(desc)}, (SELECT id FROM coach WHERE first_name = {q(coach)}), 2, {dur}, {cap}, {q(room)}, {q(color)}, true, {q(utc(TODAY - dt.timedelta(days=60), 9))};")
    for day, t in slots:
        out.append(f"INSERT INTO course_slot (course_id, day_of_week, start_time) SELECT id, {day}, {q(t)} FROM course WHERE name = {q(name)};")

# ---- Membres
# profil : (nb, situation) ; situation = active / soon / expired / none
profiles = ['active'] * 26 + ['soon'] * 6 + ['expired'] * 8 + ['none'] * 3
random.shuffle(profiles)
members = []
for k, kind in enumerate(profiles, start=1):
    female = random.random() < 0.5
    first = random.choice(FIRST_F if female else FIRST_M)
    last = random.choice(LAST)
    ph, digits = phone()
    join = TODAY - dt.timedelta(days=random.randint(3, 240))
    plan_id = random.choice([3, 3, 3, 3, 3, 4, 4, 5, 6, 2])
    periods = []  # (début, fin, plan)
    if kind != 'none':
        if kind == 'active':
            end = TODAY + dt.timedelta(days=random.randint(8, 80))
        elif kind == 'soon':
            end = TODAY + dt.timedelta(days=random.randint(0, 6))
        else:
            end = TODAY - dt.timedelta(days=random.randint(1, 45))
        days = PLANS[plan_id][2]
        if plan_id == 6:
            end = min(end, join + dt.timedelta(days=365))
        # périodes successives jusqu'à remonter à l'inscription
        e = end
        while True:
            s = e - dt.timedelta(days=days)
            if s < join - dt.timedelta(days=2):
                s = max(join, s)
                periods.append((s, e, plan_id))
                break
            periods.append((s, e, plan_id))
            e = s
            if len(periods) >= 8:
                break
        periods.reverse()
        join = min(join, periods[0][0])
    members.append(dict(k=k, kind=kind, female=female, first=first, last=last, phone=ph, digits=digits, join=join,
                        plan_id=plan_id if periods else None, periods=periods, coach=random.choice([None, None, None, 'Marc', 'Bénédicte']),
                        assiduity=random.uniform(0.12, 0.6), notes=random.choice(NOTES)))

for m in members:
    plan_name = PLANS[m['plan_id']][0] if m['plan_id'] else None
    end = m['periods'][-1][1] if m['periods'] else None
    start = m['periods'][-1][0] if m['periods'] else m['join']
    status = 'ACTIVE' if end and end >= TODAY else ('EXPIRED' if end else 'UNPAID')
    coach_sql = f"(SELECT id FROM coach WHERE first_name = {q(m['coach'])})" if m['coach'] else 'NULL'
    coach_name = None
    if m['coach']:
        coach_name = next(f'{c[0]} {c[1]}' for c in coaches if c[0] == m['coach'])
    out.append(f"""WITH u AS (
  INSERT INTO app_user (id, first_name, last_name, sex, status, date_of_creation, phone, phone_digits, comment_text)
  VALUES (nextval('sequence_generator'), {q(m['first'])}, {q(m['last'])}, {q('FEMALE' if m['female'] else 'MALE')}, 'CLIENT',
          {q(utc(m['join'], 10))}, {q(m['phone'])}, {q(m['digits'])}, {q(m['notes'])}) RETURNING id
), mm AS (
  INSERT INTO member (id, user_id, status, plan, coach, coach_id, join_date, expiry_date, subscription_start_date, auto_renew, qr_token,
                      archived, visits_last_30_days, custom_access, has_photo, notes_updated_by, notes_updated_at)
  SELECT nextval('sequence_generator'), u.id, {q(status)}, {q(plan_name)}, {q(coach_name)}, {coach_sql}, {q(m['join'])}, {q(end)}, {q(start)},
         false, md5(random()::text || clock_timestamp()::text), false, 0, false, false,
         {q(RECEPTION if m['notes'] else None)}, {q(utc(m['join'], 10) if m['notes'] else None)}
  FROM u RETURNING id
) INSERT INTO seed_map (k, member_id) SELECT {m['k']}, id FROM mm;""")

out.append("UPDATE member SET member_number = 'A-' || lpad(id::text, 4, '0') WHERE member_number IS NULL;")

# ---- Abonnements et paiements
all_payments = []
for m in members:
    for i, (s, e, pid) in enumerate(m['periods']):
        name, price, _ = PLANS[pid]
        method = random.choice(METHODS)
        agent = random.choice([RECEPTION, RECEPTION, MANAGER])
        paid_day = s if s <= TODAY else TODAY
        paid_at = utc(paid_day, random.randint(7, 20), random.randint(0, 59))
        ref = f'MP{random.randint(10**9, 10**10 - 1)}' if method in ('MTN_MOMO', 'MOOV_MONEY') else None
        out.append(f"""WITH s AS (
  INSERT INTO subscription (member_id, plan_id, plan_name, price, start_date, end_date, cancelled, created_at, created_by, frozen_days)
  SELECT member_id, {pid}, {q(name)}, {price}, {q(s)}, {q(e)}, false, {q(paid_at)}, {q(agent)}, 0 FROM seed_map WHERE k = {m['k']}
  RETURNING id, member_id
) INSERT INTO payment (member_id, plan_id, subscription_id, plan_name, amount, method, status, receipt_number, reference, start_date,
                       created_at, created_by, paid_at, registration_fee)
  SELECT member_id, {pid}, id, {q(name)}, {price}, {q(method)}, 'PAID', 'R-' || lpad(nextval('receipt_seq')::text, 5, '0'), {q(ref)},
         {q(s)}, {q(paid_at)}, {q(agent)}, {q(paid_at)}, 0 FROM s;""")

# Un paiement annulé (doublon de saisie), pour l'historique
dup = next(m for m in members if m['kind'] == 'active')
d_at = utc(TODAY - dt.timedelta(days=12), 18, 5)
out.append(f"""INSERT INTO payment (member_id, plan_id, plan_name, amount, method, status, receipt_number, created_at, created_by, paid_at,
                     cancelled_at, cancelled_by, cancel_reason)
SELECT member_id, 3, 'Mensuel', 15000, 'CASH', 'CANCELLED', 'R-' || lpad(nextval('receipt_seq')::text, 5, '0'), {q(d_at)}, {q(RECEPTION)}, {q(d_at)},
       {q(d_at + dt.timedelta(minutes=20))}, {q(MANAGER)}, 'Doublon de saisie' FROM seed_map WHERE k = {dup['k']};""")

# ---- Pointages (4 dernières semaines + séances de cours)
slot_index = {}
for name, desc, coach, dur, cap, room, color, slots in courses:
    for day, t in slots:
        slot_index.setdefault(day, []).append((name, int(t[:2]), int(t[3:]), cap))

HOURS = [6, 7, 7, 8, 9, 10, 12, 12, 13, 16, 17, 17, 18, 18, 18, 19, 19, 20]
checkins = []
for m in members:
    if not m['periods'] and m['kind'] != 'none':
        continue
    for back in range(0, 28):
        day = TODAY - dt.timedelta(days=back)
        if day < m['join']:
            continue
        covered = any(s <= day <= e for s, e, _ in m['periods'])
        p = m['assiduity'] * (0.6 if day.isoweekday() == 7 else 1)
        if back == 0:
            p *= 0.55  # la journée n'est pas finie
        if random.random() > p:
            continue
        hour = random.choice(HOURS)
        if back == 0 and hour > dt.datetime.now().hour:
            continue
        minute = random.randint(0, 59)
        activity = (1, 'Musculation et cardio')
        # proche d'un créneau de cours ce jour-là → pointage « Cours collectifs »
        for cname, h, mi, cap in slot_index.get(day.isoweekday(), []):
            if abs(h - hour) <= 1 and random.random() < 0.7:
                hour, minute = (h - 1, 50 + random.randint(0, 9)) if mi == 0 else (h, mi - random.randint(1, 15))
                activity = (2, 'Cours collectifs')
                break
        if covered:
            end = next(e for s, e, _ in m['periods'] if s <= day <= e)
            result = 'ALLOWED_EXPIRING' if (end - day).days <= 7 else 'ALLOWED'
        else:
            if random.random() > 0.15:
                continue
            result = 'REFUSED'
        checkins.append((m['k'], utc(day, max(6, min(hour, 21)), minute), random.choice(['QR'] * 4 + ['SEARCH']), result, activity))

# Séances de cours passées : quelques présents en plus pour remplir le planning
for back in range(0, 28):
    day = TODAY - dt.timedelta(days=back)
    for cname, h, mi, cap in slot_index.get(day.isoweekday(), []):
        if back == 0 and h >= dt.datetime.now().hour:
            continue
        actives = [m for m in members if any(s <= day <= e for s, e, _ in m['periods'])]
        for m in random.sample(actives, min(len(actives), random.randint(cap // 3, int(cap * 0.85)))):
            at = utc(day, h, mi) - dt.timedelta(minutes=random.randint(2, 25))
            checkins.append((m['k'], at, 'QR', 'ALLOWED', (2, 'Cours collectifs')))

for k, at, method, result, (aid, aname) in checkins:
    out.append(f"INSERT INTO check_in (member_id, checked_at, method, result, agent, client_id, activity_id, activity_name) "
               f"SELECT member_id, {q(at)}, {q(method)}, {q(result)}, {q(RECEPTION)}, md5(random()::text || clock_timestamp()::text), {aid}, {q(aname)} "
               f"FROM seed_map WHERE k = {k};")

out.append("""UPDATE member m SET
  last_visit_date = (SELECT max((c.checked_at + interval '1 hour')::date) FROM check_in c WHERE c.member_id = m.id AND c.result IN ('ALLOWED', 'ALLOWED_EXPIRING')),
  visits_last_30_days = (SELECT count(DISTINCT (c.checked_at + interval '1 hour')::date) FROM check_in c
                         WHERE c.member_id = m.id AND c.result IN ('ALLOWED', 'ALLOWED_EXPIRING') AND c.checked_at >= now() - interval '30 days')
WHERE m.id IN (SELECT member_id FROM seed_map);""")

# ---- Relances envoyées aux membres
for m in members:
    if m['kind'] not in ('soon', 'expired') or not m['periods']:
        continue
    end = m['periods'][-1][1]
    if m['kind'] == 'soon':
        rule, sent_day = 'BEFORE_7', max(TODAY - dt.timedelta(days=3), end - dt.timedelta(days=7))
    else:
        rule, sent_day = ('AFTER_1' if (TODAY - end).days < 7 else 'AFTER_7'), min(TODAY, end + dt.timedelta(days=random.choice([1, 7])))
    if random.random() < 0.3:
        continue
    msg = f"Bonjour {m['first']}, votre abonnement {PLANS[m['plan_id']][0]} à Flex Club se termine le {end.strftime('%d/%m')}. Renouvelez à l'accueil ou par MoMo."
    out.append(f"INSERT INTO reminder (member_id, rule, channel, target_end_date, message, sent_at, sent_by) "
               f"SELECT member_id, {q(rule)}, {q(random.choice(['WHATSAPP'] * 4 + ['SMS']))}, {q(end)}, {q(msg)}, {q(utc(sent_day, 8, random.randint(0, 50)))}, {q(RECEPTION)} "
               f"FROM seed_map WHERE k = {m['k']};")

# ---- Prospects
SOURCES = ['WALK_IN'] * 4 + ['SOCIAL'] * 4 + ['FLYER'] * 2 + ['WORD_OF_MOUTH'] * 2 + ['REFERRAL'] * 2 + ['OTHER']
prospect_states = (['NEW'] * 5 + ['CONTACTED'] * 6 + ['TRIAL'] * 3 + ['CONVERTED'] * 4 + ['LOST'] * 3)
INITIAL = {'WALK_IN': 50, 'REFERRAL': 60, 'WORD_OF_MOUTH': 40, 'SOCIAL': 30, 'FLYER': 20, 'OTHER': 30}
for i, st in enumerate(prospect_states, start=1):
    female = random.random() < 0.5
    name = None if random.random() < 0.15 else f"{random.choice(FIRST_F if female else FIRST_M)} {random.choice(LAST)}"
    ph, digits = phone()
    src = random.choice(SOURCES)
    first = TODAY - dt.timedelta(days=random.randint(0, 55))
    who = random.choice([COMMERCIAL, COMMERCIAL, COMMERCIAL, RECEPTION, MANAGER])
    step = {'NEW': 0, 'CONTACTED': random.randint(1, 2), 'TRIAL': random.randint(1, 3), 'CONVERTED': random.randint(1, 3), 'LOST': 3}[st]
    score = {'NEW': INITIAL[src], 'CONTACTED': INITIAL[src] + random.randint(-15, 20), 'TRIAL': random.randint(70, 90),
             'CONVERTED': 100, 'LOST': random.randint(5, 25)}[st]
    score = max(5, min(100, score))
    closed = st in ('CONVERTED', 'LOST')
    closed_day = min(TODAY, first + dt.timedelta(days=random.randint(2, 14))) if closed else None
    last_inter = utc(closed_day or min(TODAY, first + dt.timedelta(days=random.randint(0, 6))), random.randint(9, 19))
    nxt = None
    if not closed:
        nxt = random.choice([TODAY, TODAY, TODAY - dt.timedelta(days=1), TODAY + dt.timedelta(days=1), TODAY + dt.timedelta(days=3)])
    plan = random.choice([None, 'Mensuel', 'Mensuel', 'Trimestriel', 'Annuel'])
    out.append(f"""INSERT INTO prospect (name, phone, phone_digits, source, status, first_contact_date, interested_plan, score, last_interaction_at,
                      next_follow_up, follow_up_step, closed_at, created_at, created_by)
VALUES ({q(name)}, {q(ph)}, {q(digits)}, {q(src)}, {q(st)}, {q(first)}, {q(plan)}, {score}, {q(last_inter)}, {q(nxt)}, {step},
        {q(utc(closed_day, 17) if closed else None)}, {q(utc(first, random.randint(9, 19)))}, {q(who)});""")
    events = [('Prospect enregistré', None, first)]
    if step >= 1:
        events.append(('Relance J+1 par WhatsApp', None, min(TODAY, first + dt.timedelta(days=1))))
    if st in ('TRIAL', 'CONVERTED'):
        events.append(('Séance d’essai faite', 20, min(TODAY, first + dt.timedelta(days=3))))
    if st == 'CONVERTED':
        events.append(('Inscrit comme membre', None, closed_day))
    if st == 'LOST':
        events.append(('Marqué perdu par ' + who, None, closed_day))
    for label, delta, day in events:
        out.append(f"INSERT INTO prospect_event (prospect_id, label, delta, created_at, created_by) "
                   f"SELECT currval(pg_get_serial_sequence('prospect', 'id')), {q(label)}, {q(delta)}, {q(utc(day, 12))}, {q(who)};")
    if closed:
        out.append(f"INSERT INTO prospect_outcome (source, outcome, days_to_decision, recorded_at) VALUES "
                   f"({q(src)}, {q(st)}, {(closed_day - first).days}, {q(utc(closed_day, 17))});")

open(OUT + '/seed_back1.sql', 'w', encoding='utf-8', newline='\n').write('\n'.join(out) + '\n')

# ============================================================ gateway
gw = """-- Comptes de test : accueil et commercial (mot de passe : Test1234!)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
INSERT INTO jhi_user (id, login, password_hash, first_name, last_name, email, activated, lang_key, created_by, created_date, phone)
SELECT nextval('jhi_user_id_seq'), v.login, crypt('Test1234!', gen_salt('bf', 10)), v.fn, v.ln, v.login, true, 'fr', 'seed', now(), v.ph
FROM (VALUES ('rose@flexclub.test', 'Rose', 'Adjovi', '97 11 22 33'), ('serge@flexclub.test', 'Serge', 'Dossou', '96 44 55 66')) v(login, fn, ln, ph)
WHERE NOT EXISTS (SELECT 1 FROM jhi_user u WHERE u.login = v.login);
INSERT INTO jhi_user_authority (user_id, authority_name)
SELECT u.id, a.name FROM jhi_user u
JOIN (VALUES ('rose@flexclub.test', 'ROLE_RECEPTION'), ('rose@flexclub.test', 'ROLE_USER'),
             ('serge@flexclub.test', 'ROLE_COMMERCIAL'), ('serge@flexclub.test', 'ROLE_USER')) a(login, name) ON a.login = u.login
WHERE NOT EXISTS (SELECT 1 FROM jhi_user_authority x WHERE x.user_id = u.id AND x.authority_name = a.name);
DROP EXTENSION pgcrypto;
"""
open(OUT + '/seed_gateway.sql', 'w', encoding='utf-8', newline='\n').write(gw)
print(f'{len(members)} membres, {sum(len(m["periods"]) for m in members)} abonnements, {len(checkins)} pointages, {len(prospect_states)} prospects')
