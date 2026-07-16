# Cinely — Application de notes collaborative

[![CI/CD](https://github.com/amarabilal/cinely-Esgi/actions/workflows/ci.yml/badge.svg)](https://github.com/amarabilal/cinely-Esgi/actions/workflows/ci.yml)

Application de prise de notes avancée avec éditeur WYSIWYG, collaboration temps réel, 2FA et versioning automatique.

**Production :** https://cinely.fr  
**API Docs :** https://cinely.fr/api/docs

---

## Contributeurs

| Pseudo GitHub | Rôle |
|---|---|
| [amarabilal](https://github.com/amarabilal) | Backend · Infrastructure K3s · CI/CD · Auth · 2FA |
| [duongdk099](https://github.com/duongdk099) | Frontend · Design System · Éditeur TipTap · Collaboration temps réel |
| [duyanhnguyen0809](https://github.com/duyanhnguyen0809) | Backend · Modules Notes · Stripe · Tests |

---

## Stack technique

| Couche | Technologie |
|--------|------------|
| Frontend | Vue 3 + Vite + TypeScript + Tailwind CSS v3 + Pinia |
| Backend | NestJS + TypeScript + Clean Architecture (Domain / Application / Infrastructure) |
| Base de données | PostgreSQL 16 + pgvector + TypeORM |
| Cache / Throttle | Redis 7 |
| Temps réel | Socket.io v4 (WebSocket) |
| Auth | JWT access 15min + refresh 7j (HttpOnly cookie) + Argon2id |
| 2FA | TOTP RFC 6238 — implémentation pure (HMAC-SHA1, Base32, sans librairie) |
| Éditeur | TipTap v2 (ProseMirror) + curseurs collaboratifs |
| Mobile | Capacitor (Android / iOS) |
| Orchestration | K3s (Kubernetes léger) — 1 master + 2 workers |
| CI/CD | GitHub Actions → Docker Hub → K3s rolling update (0 downtime) |
| Monitoring | Uptime Kuma + GlitchTip (Sentry-compatible) + Matomo (RGPD) |
| Mail (dev) | Mailhog |
| Paiement | Stripe (mode test) |

---

## Prérequis locaux

- Node.js 22+
- Docker + Docker Compose
- Git

---

## Installation locale (Docker Compose)

```bash
# 1. Cloner le dépôt
git clone https://github.com/amarabilal/cinely-Esgi.git
cd cinely-Esgi

# 2. Copier et remplir les variables d'environnement
cp .env.example .env
# Éditer .env : renseigner au minimum ANTHROPIC_API_KEY et OPENAI_API_KEY
# Les variables DB_HOST, REDIS_HOST, MAIL_HOST sont injectées automatiquement par Docker Compose

# 3. Démarrer tous les services
docker-compose up
```

L'application est accessible sur :

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| API REST | http://localhost:3000/api |
| Swagger | http://localhost:3000/api/docs |
| Mailhog (emails) | http://localhost:8025 |

> **Note :** La recherche sémantique et les fonctions IA nécessitent des clés API valides (Anthropic + OpenAI). Sans elles, la recherche bascule automatiquement en mode full-text (ILIKE).

---

## Variables d'environnement

Toutes les variables sont documentées dans `.env.example`. Les variables minimales pour démarrer :

```env
# Base de données
DB_NAME=notesdb
DB_USER=notesuser
DB_PASSWORD=changeme_strong_password

# Redis
REDIS_PASSWORD=changeme_redis_password

# JWT (générer avec : openssl rand -hex 64)
JWT_ACCESS_SECRET=changeme_access_secret_min_32_chars_long
JWT_REFRESH_SECRET=changeme_refresh_secret_min_32_chars_long

# Frontend origin (CORS)
FRONTEND_URL=http://localhost:5173

# IA — optionnel, active la recherche sémantique
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...

# Google OAuth — optionnel, active le login Google
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/callback

# Stripe — optionnel, active les abonnements (mode test)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_ID=price_...
STRIPE_PLAN_NAME=Cinely Pro
```

---

## Tests

```bash
cd apps/backend

# Tests unitaires (Jest)
npm test

# Tests fonctionnels API (Supertest)
# Prérequis : docker-compose up -d postgres
DB_HOST=localhost DB_NAME=notesdb_test DB_USER=notesuser \
DB_PASSWORD=changeme_strong_password \
JWT_ACCESS_SECRET=test-secret-min-32-chars-long \
JWT_REFRESH_SECRET=test-refresh-min-32-chars-long \
FRONTEND_URL=http://localhost:5173 \
NODE_ENV=test \
npm run test:e2e

# Couverture de code
npm run test:cov
```

---

## Architecture

```
Internet
    │
    ▼
[ Traefik Ingress ] ← Let's Encrypt SSL (cinely.fr)
    │
    ├── /             → [ Frontend ×3 ] Nginx — Vue 3 SPA
    │
    ├── /api          → [ Backend ×2 ]  NestJS
    │                       │
    │                       ├── PostgreSQL 16 + pgvector (StatefulSet)
    │                       ├── Redis 7 (throttling / sessions)
    │                       └── Socket.io WebSocket Gateway
    │
    ├── /socket.io    → [ Backend ×2 ]  WebSocket upgrade
    │
    └── /callback     → [ Backend ×2 ]  Google OAuth redirect
```

**Cluster K3s — 3 VPS OVH Ubuntu 22.04 :**

| Rôle | Hostname | Pods |
|------|----------|------|
| Master | vps-1a326886 | Traefik, Uptime Kuma |
| Worker 1 | vps-df08431f | Backend ×2, PostgreSQL |
| Worker 2 | vps-7eb840a9 | Frontend ×3, GlitchTip, Matomo |

**Namespace :** `cluster-project`

---

## Structure du projet

```
cinely-Esgi/
├── apps/
│   ├── backend/                    # NestJS — Clean Architecture
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/           # Register, login, 2FA, reset mdp, OAuth
│   │   │   │   ├── notes/          # CRUD, versioning, partage, WebSocket gateway
│   │   │   │   ├── folders/        # Dossiers
│   │   │   │   ├── tags/           # Tags colorés
│   │   │   │   ├── settings/       # Profil, sessions, 2FA setup
│   │   │   │   ├── ai/             # Embeddings (OpenAI) + recherche sémantique
│   │   │   │   ├── stripe/         # Abonnements (mode test)
│   │   │   │   └── notifications/  # Notifications in-app temps réel
│   │   │   ├── health/             # GET /api/health
│   │   │   └── shared/             # Guards, decorators, TOTP service
│   │   └── Dockerfile
│   └── frontend/                   # Vue 3 + Vite
│       ├── src/
│       │   ├── views/
│       │   │   ├── auth/           # Login, Register, 2FA, Reset mdp
│       │   │   ├── notes/          # NotesView (3 panneaux), NoteEditorView, Dashboard
│       │   │   ├── settings/       # Profil, sessions, 2FA
│       │   │   ├── public/         # Landing (Home, Features, Security, Contact)
│       │   │   └── legal/          # CGU, Confidentialité, Cookies
│       │   ├── stores/             # Pinia (auth, notes, notebooks, settings, notifications)
│       │   ├── composables/        # useNoteSync (Socket.io), RemoteCursorExtension
│       │   └── api/                # Clients Axios typés
│       └── Dockerfile
├── k8s/                            # Manifests Kubernetes
│   ├── 00-namespace/
│   ├── 10-config/                  # ConfigMap (env non-sensibles)
│   ├── 20-secrets/                 # *.yaml.example (secrets hors git)
│   ├── 25-redis/
│   ├── 30-db/                      # PostgreSQL StatefulSet + PVC
│   ├── 40-backend/                 # Deployment + Service
│   ├── 50-frontend/                # Deployment + Service
│   ├── 60-ingress/                 # Traefik Ingress + HTTPS redirect
│   ├── 65-traefik/                 # HelmChartConfig Let's Encrypt
│   └── 70-hpa/                     # HorizontalPodAutoscaler
├── .github/
│   └── workflows/ci.yml            # Pipeline CI/CD complet
├── docker-compose.yml              # Environnement de développement local
└── .env.example                    # Modèle de variables d'environnement
```

---

## Fonctionnalités

### Sécurité (conformité CNIL)
- Inscription / Connexion / Mot de passe oublié / Réinitialisation par email
- Mot de passe fort : 12 caractères min, chiffres + lettres + symboles
- Hachage Argon2id (algorithme recommandé par OWASP)
- Blocage compte après 5 tentatives échouées (15 min)
- Renouvellement mot de passe obligatoire tous les 60 jours
- Email de vérification à l'inscription (token 24h)
- Refresh tokens opaques (UUID v4) stockés hashés en base (SHA-256)

### 2FA TOTP (bonus)
- Implémentation sans librairie externe (HMAC-SHA1 pur, Base32, RFC 6238)
- Tolérance ±1 step (dérive horloge tolérée)
- 8 codes de récupération hashés SHA-256 (affichés une seule fois à l'activation)
- QR code compatible Google Authenticator / Microsoft Authenticator / Authy

### Notes
- Éditeur WYSIWYG TipTap v2 (gras, italique, listes, titres H1-H3, liens, code)
- Autosave debounce 1 500ms + indicateur visuel Saving / Saved
- Versioning automatique (debounce 60s, restauration en un clic)
- Recherche full-text ILIKE (titre + contenu)
- Recherche sémantique pgvector (cosine distance < 0.6) avec embeddings OpenAI
- Soft delete, archive, favoris, organisation par dossiers + tags colorés

### Collaboration temps réel (bonus)
- Socket.io v4 WebSocket gateway NestJS
- Curseurs live avec couleur et nom (extension ProseMirror décorative)
- Synchronisation contenu en temps réel (ProseMirror JSON)
- Gestion des permissions READ / WRITE par note
- Notification instantanée si note supprimée ou accès révoqué
- Reconnexion automatique avec re-join des rooms après restart pod

### Infrastructure
- K3s 3 nœuds + HPA autoscaling (backend 2-6 replicas, frontend 3-9 replicas)
- Let's Encrypt SSL via Traefik (renouvellement automatique)
- UFW pare-feu (ports 22, 80, 443 uniquement)
- Backup PostgreSQL quotidien 2h (CronJob K8s → OVH Object Storage Paris)
- Politique 3-2-1 : live PVC + dump local + objet S3

---

## Déploiement K3s (production)

### Prérequis VPS
- 3 VPS Ubuntu 22.04 avec Docker installé
- Accès SSH entre les nœuds

### Installation K3s

```bash
# Master
curl -sfL https://get.k3s.io | sh -
cat /var/lib/rancher/k3s/server/node-token   # copier ce token pour les workers

# Workers (remplacer MASTER_IP et NODE_TOKEN)
curl -sfL https://get.k3s.io | \
  K3S_URL=https://<MASTER_IP>:6443 \
  K3S_TOKEN=<NODE_TOKEN> sh -
```

### Créer les secrets K8s (une seule fois)

```bash
# Copier les templates
cp k8s/20-secrets/app-secret.yaml.example k8s/20-secrets/app-secret.yaml
cp k8s/20-secrets/db-secret.yaml.example  k8s/20-secrets/db-secret.yaml

# Encoder les valeurs en base64
echo -n "votre_secret" | base64

# Appliquer (sur le master)
sudo kubectl apply -f k8s/20-secrets/
```

### Déploiement des manifests

```bash
sudo kubectl apply -f k8s/00-namespace/
sudo kubectl apply -f k8s/10-config/
sudo kubectl apply -f k8s/20-secrets/
sudo kubectl apply -f k8s/25-redis/
sudo kubectl apply -f k8s/30-db/
sudo kubectl apply -f k8s/40-backend/
sudo kubectl apply -f k8s/50-frontend/
sudo kubectl apply -f k8s/60-ingress/
sudo kubectl apply -f k8s/65-traefik/
sudo kubectl apply -f k8s/70-hpa/
```

### Vérification

```bash
sudo kubectl get nodes
sudo kubectl get pods -n cluster-project
sudo kubectl get hpa -n cluster-project
curl https://cinely.fr/api/health
```

---

## CI/CD

Pipeline GitHub Actions déclenché sur chaque `git push main` :

```
push → main
  ├── 1. Tests unitaires (Jest)
  ├── 2. Tests fonctionnels API (Supertest)
  ├── 3. Audit de sécurité npm (niveau critical)
  ├── 4. Build Docker backend  → bamara3/backend-app:<sha>
  ├── 5. Build Docker frontend → bamara3/frontend-app:<sha>
  ├── 6. Injection secrets → kubectl patch secret app-secret
  ├── 7. kubectl apply manifests (backend + frontend)
  └── 8. kubectl set image → rolling update K3s (timeout 300s, 0 downtime)
```

**Secrets GitHub Actions requis :**

| Secret | Description |
|--------|-------------|
| `DOCKER_USERNAME` | Compte Docker Hub |
| `DOCKER_TOKEN` | Token Docker Hub (read/write) |
| `KUBE_CONFIG` | kubeconfig du cluster K3s (base64) |
| `GOOGLE_CLIENT_ID` | OAuth Google |
| `GOOGLE_CLIENT_SECRET` | OAuth Google |
| `GOOGLE_REDIRECT_URI` | OAuth Google callback URL |
| `SENTRY_DSN` | GlitchTip / Sentry DSN (backend) |
| `VITE_SENTRY_DSN` | GlitchTip / Sentry DSN (frontend) |
| `VITE_MATOMO_URL` | URL Matomo analytics |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe (test) |
| `STRIPE_PRICE_ID` | ID du price Stripe |
| `STRIPE_PLAN_NAME` | Nom du plan affiché |

---

## Observabilité

| Outil | URL | Usage |
|-------|-----|-------|
| Uptime Kuma | https://uptime.cinely.fr | État des services en temps réel |
| GlitchTip | https://glitchtip.cinely.fr | Signalement et tracking d'erreurs |
| Matomo | https://matomo.cinely.fr | Analytics RGPD (sans cookies tiers) |
| Health check | https://cinely.fr/api/health | Liveness / readiness probe K8s |

---

## Conformité sujet

| Critère | Statut |
|---------|--------|
| Inscription / Connexion / Reset mot de passe | ✅ |
| Mot de passe fort (CNIL) | ✅ |
| Blocage tentatives (5 → 15min) | ✅ |
| Renouvellement mot de passe 60 jours | ✅ |
| Docker + VPS | ✅ |
| Pare-feu UFW | ✅ |
| Domaine public + SSL Let's Encrypt | ✅ |
| IaC (Dockerfile, docker-compose, manifests K8s) | ✅ |
| Architecture maintenable (Clean Architecture) | ✅ |
| Responsive design | ✅ Tailwind CSS + Capacitor mobile |
| Tests unitaires | ✅ Jest |
| Tests fonctionnels | ✅ Supertest |
| Uptime Kuma | ✅ |
| GlitchTip (Sentry-compatible) | ✅ |
| Matomo analytics | ✅ |
| Backup 3-2-1 | ✅ CronJob K8s + OVH Object Storage |
| Pages légales (CGU, Confidentialité, Cookies) | ✅ |
| SEO (robots.txt, sitemap.xml, Open Graph) | ✅ |
| CI/CD GitHub Actions | ✅ |
| **BONUS** 2FA TOTP sans librairie externe | ✅ |
| **BONUS** Collaboration WebSocket temps réel | ✅ |
| **BONUS** Cluster K3s auto-hébergé | ✅ |
| **BONUS** HPA autoscaling | ✅ |
| **BONUS** Recherche sémantique pgvector | ✅ |
| **BONUS** Google OAuth | ✅ |
| **BONUS** Stripe abonnements (mode test) | ✅ |
