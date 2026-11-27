# Flexclubmanagement

Application web de gestion de salle de sport : membres, abonnements, encaissements, pointage par QR code, cours collectifs, prospects, relances et statistiques.

Pour l'instant l'application gère **une seule salle**. Le mode multi-salles est prévu (voir [Feuille de route](#feuille-de-route)).

---

## Sommaire

- [Architecture](#architecture)
- [Structure du dépôt](#structure-du-dépôt)
- [Fonctionnalités](#fonctionnalités)
- [Rôles](#rôles)
- [Prérequis](#prérequis)
- [Déploiement avec Docker](#déploiement-avec-docker)
- [Développement en local](#développement-en-local)
- [Données de test](#données-de-test)
- [Bases de données et migrations](#bases-de-données-et-migrations)
- [Sécurité](#sécurité)
- [Feuille de route](#feuille-de-route)
- [Documentation complémentaire](#documentation-complémentaire)

---

## Architecture

```
            Navigateur
                │
                ▼
   ┌──────────────────────────┐
   │ frontend (Nginx, port 80)│  Angular + reverse proxy /api et /services
   └────────────┬─────────────┘
                ▼
   ┌──────────────────────────┐       ┌────────────────────┐
   │ gateway (port 8080)      │◄─────►│ jhipster-registry  │  Eureka + config centrale
   │ connexion JWT, comptes,  │       │ (port 8761)        │
   │ routage vers les services│       └─────────▲──────────┘
   └────────────┬─────────────┘                 │
                ▼  /services/flexclubmanagement-back1/api/...
   ┌──────────────────────────┐                 │
   │ back1 (port 8081)        │─────────────────┘
   │ toute la logique métier  │
   └────────────┬─────────────┘
                ▼
     PostgreSQL 16  ·  Redis 7  ·  Mailpit (e-mails de test)
```

- **Le front ne parle qu'au gateway.** Il n'appelle jamais directement le back1 ni le registre.
- **Le gateway** reçoit les identifiants, émet le jeton JWT et stocke les comptes du personnel. Il transmet ensuite chaque requête `/services/...` au bon microservice, qu'il trouve grâce à Eureka.
- **Le back1** vérifie la signature du JWT. Le gateway et le back1 partagent pour cela la même clé, `JWT_BASE64_SECRET`.

| Brique | Technologies |
|---|---|
| Gateway | JHipster 9.1, Spring Boot, WebFlux (réactif), R2DBC, Liquibase, Java 21 |
| Back1 | JHipster 9.1 (microservice), Spring Boot, Spring MVC, JPA/Hibernate, cache Redis, Liquibase, Java 21 |
| Front | Angular 20 (composants standalone, signaux), Angular Material/CDK, `jsqr` (lecture QR), `qrcode` (génération QR) |
| Infrastructure | Docker Compose, PostgreSQL 16, Redis 7, JHipster Registry, Mailpit, Nginx |

---

## Structure du dépôt

```
flexclubmanagement/
├── registry/
│   └── central-server-config/application.yml   configuration partagée (lit JWT_BASE64_SECRET)
├── flexclubmanagement-gateway/                  passerelle + authentification (Maven)
├── flexclubmanagement-back1/                    service métier (Maven)
├── flexclubmanagement-front/                    application Angular (+ Dockerfile, nginx.conf)
└── deploy/
    ├── deploy.sh             construit les images puis lance la pile
    ├── docker-compose.yml    tous les conteneurs
    ├── init-db.sql           crée les bases « gateway » et « flexclubmanagementback1 »
    ├── .env.example          modèle des variables (à copier en .env)
    └── seed/                 données de test (seed.sh, seed_gen.py)
```

---

## Fonctionnalités

| Module | Ce qu'il fait |
|---|---|
| Tableau de bord | Chiffres du jour et du mois, alertes (réservé au gérant) |
| Membres | Fiche membre avec photo et QR code, recherche, archivage (pas de suppression), détection des doublons par téléphone, import depuis un fichier |
| Formules et activités | Catalogue des formules (durée, prix, activités incluses) |
| Abonnements | Souscription, renouvellement (à partir de la date de fin si l'abonnement est encore actif), gel. Statut calculé : actif, expire bientôt, expiré ou sans abonnement |
| Encaissements | Paiements avec reçu numéroté, annulation avec motif (aucune suppression d'argent), clôture de caisse, liens de paiement, webhook signé (HMAC) |
| Pointage | Scan du QR code avec la caméra. Fonctionne aussi **hors ligne** : synchronisation au retour du réseau, sans doublon |
| Planning et cours | Coachs, cours collectifs, créneaux, capacité de la salle |
| Prospects | Suivi commercial, interactions, relances, perte avec motif. Une tâche de nuit (2 h) fait baisser la priorité des prospects inactifs |
| Relances | File de relances, envoi par lien WhatsApp (`wa.me`) ou SMS depuis le téléphone de la salle, historique |
| Statistiques | Indicateurs de gestion et indicateurs commerciaux |
| Pages publiques | Carte de membre (`/carte/:token`) et reçu (`/recu/:token`), à envoyer par WhatsApp, sans compte |
| Comptes | Connexion par e-mail, mot de passe oublié (e-mail), comptes du personnel |

---

## Rôles

| Rôle | Qui | Accès |
|---|---|---|
| `ROLE_ADMIN` | Gérant | Tout |
| `ROLE_RECEPTION` | Réceptionniste | Pointage, encaissements, abonnements, planning, membres, prospects, relances |
| Commercial | Commercial | Membres, prospects, relances (ni caisse ni pointage) |

Les droits sont vérifiés deux fois : par le serveur, et par le front pour masquer les écrans (`flexclubmanagement-front/src/app/app.routes.ts`).

---

## Prérequis

- **Docker Desktop** (avec Docker Compose)
- **Java 21** (JDK), pour construire le gateway et le back1. Maven est fourni par le wrapper `mvnw`.
- **Node.js 20+** et npm, pour le front en développement
- Un terminal **bash** pour `deploy.sh` (Git Bash sous Windows)
- Python 3, uniquement pour les données de test

---

## Déploiement avec Docker

1. **Créer le fichier d'environnement**

   ```bash
   cp deploy/.env.example deploy/.env
   ```

   Remplir au minimum les variables suivantes :

   | Variable | Rôle |
   |---|---|
   | `DB_PASSWORD` | Mot de passe PostgreSQL |
   | `REGISTRY_PASSWORD` | Mot de passe du registre (utilisateur `admin`) |
   | `JWT_BASE64_SECRET` | Clé de signature des jetons. Générer avec `openssl rand -base64 64 \| tr -d '\n'` |
   | `FLEXCLUBMANAGEMENT_ADMIN_INITIAL_PASSWORD` | Mot de passe du compte `admin` au premier démarrage (10 caractères minimum) |
   | `APP_URL` | Adresse publique, utilisée dans les liens des e-mails |
   | `MAIL_*` | Serveur SMTP. Vide = Mailpit, une boîte de test qui n'envoie rien vraiment |

2. **Construire et lancer**

   ```bash
   ./deploy/deploy.sh            # tout construire puis démarrer
   ./deploy/deploy.sh flexclubmanagement-back1     # reconstruire une seule brique
   ./deploy/deploy.sh flexclubmanagement-gateway
   ./deploy/deploy.sh flexclubmanagement-front
   ```

   Le script construit les images Java avec Jib (`mvnw -Pprod verify jib:dockerBuild`) et l'image du front avec Docker. Il lance ensuite `docker compose up -d`.

3. **Accéder à l'application**

   | Service | Adresse |
   |---|---|
   | Application | http://localhost |
   | Registre (Eureka, config) | http://localhost:8761 |
   | Boîte e-mail de test (Mailpit) | http://localhost:8025 (depuis la machine uniquement) |

Commandes utiles (depuis `deploy/`) :

```bash
docker compose --env-file .env ps              # état des conteneurs
docker compose --env-file .env logs -f backend # journaux d'un service
docker compose --env-file .env down            # arrêter (les données restent dans le volume pgdata)
```

---

## Développement en local

Chaque brique peut tourner hors Docker. Il faut Docker Desktop démarré pour PostgreSQL, Redis et le registre.

**Registre** (dans le dossier du gateway ou du back1) :

```bash
docker compose -f src/main/docker/jhipster-registry.yml up -d
```

**Gateway** (port 8080) et **back1** (port 8081), chacun dans son dossier :

```bash
./mvnw          # profil dev par défaut. Sous PowerShell : .\mvnw
```

Le support Docker Compose de Spring Boot démarre la base de chaque service. Les identifiants de dev se trouvent dans `src/main/resources/config/application-dev.yml`.

**Front** (port 4200) :

```bash
cd flexclubmanagement-front
npm install
npx ng serve --proxy-config proxy.conf.json    # http://localhost:4200
```

Le fichier `proxy.conf.json` redirige `/api` et `/services` vers le gateway (`localhost:8080`), ce qui évite les problèmes de CORS en dev.

Comptes de développement : `admin` / `admin` (gérant) et `user` / `user` (réceptionniste). **À changer avant tout déploiement.**

---

## Données de test

Une fois la pile lancée (les tables doivent déjà exister) :

```bash
./deploy/seed/seed.sh
```

Le script ajoute des membres, abonnements, paiements, pointages, cours et prospects, datés à partir du jour courant. Il crée aussi deux comptes du personnel, avec le mot de passe `Test1234!` :

- `rose@flexclub.test` : accueil
- `serge@flexclub.test` : commercial

Il refuse de s'exécuter si la base contient déjà des membres. **À ne jamais lancer en production.**

---

## Bases de données et migrations

| Base | Service | Contenu |
|---|---|---|
| `gateway` | Gateway | Comptes, rôles (`jhi_user`, `jhi_authority`…) |
| `flexclubmanagementback1` | Back1 | Données métier (membres, abonnements, paiements, etc.) |

Le schéma est géré par **Liquibase**. Les migrations se trouvent dans `src/main/resources/config/liquibase/changelog/` de chaque service.

> Règle : ne jamais modifier une migration déjà exécutée, sinon Liquibase signale une erreur de checksum. Pour tout changement, ajouter un nouveau fichier et le référencer dans `master.xml`.

---

## Sécurité

- `deploy/.env` contient les secrets. Il ne doit **jamais** être commité.
- `JWT_BASE64_SECRET` doit être identique pour le gateway et le back1, et propre à chaque environnement. Les clés présentes dans les fichiers `.yo-rc.json` ne servent qu'au développement.
- Changer les comptes par défaut (`admin`, `user`) avant toute mise en ligne.
- Le webhook de paiement est vérifié par signature HMAC (`application.payment.webhook-secret`).
- Côté front : pas de `innerHTML` avec des données utilisateur, aucun secret dans le bundle. Lancer `npm audit` régulièrement.

---

## Feuille de route

- **Multi-salles** : colonne `tenant_id` et identifiant de salle dans le JWT
- **Paiement mobile** : intégration réelle de KKiaPay ou FedaPay (le webhook générique est déjà en place)
- **SMS automatiques** via un fournisseur (aujourd'hui, envoi manuel par WhatsApp ou SMS)
- Paiements hors ligne, import direct de fichiers `.xlsx`
- Tests automatisés des services métier
- Administration de la plateforme (toutes les salles)

---

## Documentation complémentaire

- [flexclubmanagement-front/FLEXCLUBMANAGEMENT_PROJECT.md](flexclubmanagement-front/FLEXCLUBMANAGEMENT_PROJECT.md) : contexte global, décisions d'architecture, backend
- [flexclubmanagement-front/FLEXCLUBMANAGEMENT_FRONT.md](flexclubmanagement-front/FLEXCLUBMANAGEMENT_FRONT.md) : organisation du front Angular
- `README.md` de chaque sous-projet : commandes propres à JHipster et Angular
