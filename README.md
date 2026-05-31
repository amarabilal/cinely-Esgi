# Cinely — Application de notes collaborative

Application de prise de notes avancée avec éditeur WYSIWYG, collaboration temps réel, 2FA et versioning automatique.

**Production :** https://cinely.fr

---

## Stack technique

| Couche | Technologie |
|--------|------------|
| Frontend | Vue 3 + Vite + TypeScript + Tailwind CSS + Pinia |
| Backend | NestJS + TypeScript + Clean Architecture |
| Base de données | PostgreSQL 16 + TypeORM |
| Cache / Throttle | Redis 7 |
| Temps réel | Socket.io (WebSocket) |
| Auth | JWT (access 15min + refresh 7j HttpOnly) + Argon2 |
| 2FA | TOTP RFC 6238 (HMAC-SHA1, sans librairie externe) |
| Éditeur | Tiptap (ProseMirror) |
| Orchestration | K3s (Kubernetes) — 1 master + 2 workers |
| CI/CD | GitHub Actions → Docker Hub → K3s rolling update |
| Monitoring | Uptime Kuma + GlitchTip + Matomo |
| Mail (dev) | Mailhog |

---

## Prérequis locaux

- Node.js 20+
- Docker + Docker Compose
- Git

---

## Installation locale

```bash
git clone https://github.com/amarabilal/cinely-Esgi.git
cd cinely-Esgi

# Copier les variables d'environnement
cp .env.example .env

# Démarrer tous les services (backend, frontend, postgres, redis, mailhog)
docker-compose up
```

L'application est accessible sur :

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| API | http://localhost:3000/api |
| Mailhog (emails dev) | http://localhost:8025 |

---

## Variables d'environnement

Toutes les variables sont dans `.env.example` :

```env
# Base de données
DB_NAME=notesdb
DB_USER=notesuser
DB_PASSWORD=changeme_strong_password

# Redis
REDIS_PASSWORD=changeme_redis_password

# JWT (générer avec : openssl rand -hex 64)
JWT_ACCESS_SECRET=changeme_access_secret_min_32_chars
JWT_REFRESH_SECRET=changeme_refresh_secret_min_32_chars

# URL du frontend (CORS)
FRONTEND_URL=http://localhost:5173
```

---

## Tests

```bash
cd apps/backend

# Tests unitaires (59 tests — Jest)
npm test

# Tests fonctionnels API (26 tests — Supertest)
# Nécessite : docker-compose up -d postgres
DB_HOST=localhost DB_NAME=notesdb_test DB_USER=notesuser \
DB_PASSWORD=changeme_strong_password \
JWT_ACCESS_SECRET=test-secret JWT_REFRESH_SECRET=test-refresh \
NODE_ENV=test npm run test:e2e

# Couverture
npm run test:cov
```

```bash
# Tests E2E interface (Playwright)
cd apps/frontend
npx playwright test
```

---

## Architecture

```
Internet
    │
    ▼
[ Traefik Ingress ] ← Let's Encrypt SSL (cinely.fr)
    │
    ├── /          → [ Frontend ×3 ] Nginx (Vue 3 SPA)
    │
    ├── /api       → [ Backend ×2 ] NestJS
    │                     │
    │                     ├── PostgreSQL (StatefulSet)
    │                     ├── Redis (throttling)
    │                     └── Socket.io (WebSocket)
    │
    ├── /socket.io → [ Backend ×2 ] WebSocket upgrade
    │
    └── Sous-domaines :
        uptime.cinely.fr   → Uptime Kuma
        glitchtip.cinely.fr → GlitchTip
        matomo.cinely.fr   → Matomo
```

**Cluster K3s — 3 VPS Ubuntu 22.04 :**

| Rôle | IP | Pods |
|------|----|------|
| Master | 141.227.151.228 | Traefik, Uptime Kuma |
| Worker 1 | — | Backend ×2, PostgreSQL |
| Worker 2 | — | Frontend ×3, GlitchTip, Matomo |

**Namespace :** `cluster-project`

---

## Structure du projet

```
cinely-Esgi/
├── apps/
│   ├── backend/                    # NestJS — Clean Architecture
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/           # Register, login, 2FA, reset mdp
│   │   │   │   ├── notes/          # CRUD, versioning, partage, WebSocket
│   │   │   │   ├── folders/        # Dossiers
│   │   │   │   ├── tags/           # Tags colorés
│   │   │   │   └── settings/       # Profil, sessions, 2FA setup
│   │   │   ├── health/             # GET /api/health
│   │   │   └── shared/             # Guards, decorators, TOTP service
│   │   └── Dockerfile
│   └── frontend/                   # Vue 3 + Vite
│       ├── src/
│       │   ├── views/
│       │   │   ├── auth/           # Login, Register, 2FA, Reset mdp
│       │   │   ├── notes/          # NotesView (3 panneaux), Dashboard
│       │   │   ├── settings/       # Profil, sessions, 2FA
│       │   │   ├── public/         # SEO (Home, Features, Security, Contact)
│       │   │   └── legal/          # CGU, Confidentialité, Cookies
│       │   ├── stores/             # Pinia (auth, notes, settings)
│       │   ├── composables/        # useNoteSync, RemoteCursorExtension
│       │   └── api/                # Clients Axios
│       └── Dockerfile
├── k8s/                            # Manifests Kubernetes
│   ├── 00-namespace/
│   ├── 10-config/                  # ConfigMap
│   ├── 20-secrets/                 # *.yaml.example (secrets hors git)
│   ├── 25-redis/
│   ├── 30-db/                      # PostgreSQL StatefulSet
│   ├── 40-backend/                 # Deployment + Service
│   ├── 50-frontend/                # Deployment + Service
│   ├── 60-ingress/                 # Traefik IngressRoute
│   ├── 65-traefik/
│   └── 70-hpa/                     # HPA (backend 2-6, frontend 3-9)
├── scripts/
│   ├── deploy.sh
│   └── cleanup.sh
├── .github/workflows/ci.yml        # Pipeline CI/CD
├── docker-compose.yml              # Dev local
└── .env.example
```

---

## Fonctionnalités

### Sécurité (CNIL)
- Inscription / Connexion / Mot de passe oublié / Réinitialisation
- Mot de passe fort : 12 caractères min, chiffres + lettres + symboles
- Blocage compte après 5 tentatives (15 min)
- Renouvellement mot de passe obligatoire tous les 60 jours
- Email de vérification à l'inscription (token 24h)

### 2FA TOTP (bonus)
- Implémentation sans librairie externe (HMAC-SHA1 pur, Base32, RFC 6238)
- Tolérance ±1 step (dérive horloge)
- 8 codes de récupération SHA-256 (affichés une seule fois)
- QR code compatible Google/Microsoft Authenticator

### Notes
- Éditeur WYSIWYG Tiptap (gras, italique, listes, titres...)
- Autosave debounce 1500ms + indicateur Saving/Saved
- Versioning automatique (debounce 60s, restauration)
- Recherche full-text ILIKE (titre + contenu)
- Soft delete, archive, favoris
- Organisation : dossiers + tags colorés

### Collaboration temps réel (bonus)
- Socket.io + WebSocket gateway NestJS
- Curseurs live avec couleur et nom (extension ProseMirror)
- Synchronisation permissions READ/WRITE en temps réel
- Notification si note supprimée ou accès révoqué

### Infrastructure
- K3s 3 nœuds + HPA autoscaling
- Let's Encrypt SSL (renouvellement automatique)
- UFW pare-feu (ports 22, 80, 443 uniquement)
- Backup PostgreSQL quotidien 2h (CronJob K8s, politique 3-2-1)

---

## Déploiement K3s

### Prérequis VPS
- 3 VPS Ubuntu 22.04
- Docker installé sur chaque nœud
- Accès SSH entre les nœuds

### Installation K3s

```bash
# Master
curl -sfL https://get.k3s.io | sh -
cat /var/lib/rancher/k3s/server/node-token

# Workers (remplacer MASTER_IP et NODE_TOKEN)
curl -sfL https://get.k3s.io | \
  K3S_URL=https://<MASTER_IP>:6443 \
  K3S_TOKEN=<NODE_TOKEN> sh -
```

### Créer les secrets (à faire une seule fois)

```bash
# Copier les exemples
cp k8s/20-secrets/app-secret.yaml.example k8s/20-secrets/app-secret.yaml
cp k8s/20-secrets/db-secret.yaml.example k8s/20-secrets/db-secret.yaml

# Remplir les valeurs en base64 :
echo -n "votre_secret" | base64

# Appliquer
sudo kubectl apply -f k8s/20-secrets/
```

### Déploiement complet

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
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

Pipeline GitHub Actions déclenché sur chaque push `main` :

```
push → main
  ├── Tests unitaires (Jest — 59 tests)
  ├── Tests fonctionnels (Supertest — 26 tests)
  ├── npm audit (high/critical)
  ├── Build Docker backend  → bamara3/backend-app:sha
  ├── Build Docker frontend → bamara3/frontend-app:sha
  └── kubectl set image → rolling update K3s (0 downtime)
```

---

## Observabilité

| Outil | URL | Usage |
|-------|-----|-------|
| Uptime Kuma | https://uptime.cinely.fr | État des services |
| GlitchTip | https://glitchtip.cinely.fr | Signalement erreurs |
| Matomo | https://matomo.cinely.fr | Analytics RGPD |
| Health | https://cinely.fr/api/health | Liveness probe |

---

## Conformité sujet

| Critère | Statut |
|---------|--------|
| Inscription / Connexion / Reset mdp | ✅ |
| Mot de passe fort (CNIL) | ✅ |
| Blocage tentatives (5 → 15min) | ✅ |
| Renouvellement mdp 60 jours | ✅ |
| Docker + VPS | ✅ |
| Pare-feu UFW | ✅ |
| Domaine public + SSL Let's Encrypt | ✅ |
| IaC (Dockerfile, docker-compose) | ✅ |
| Architecture maintenable | ✅ Clean Architecture NestJS |
| Responsive design | ✅ Tailwind CSS |
| Tests unitaires | ✅ 59 tests Jest |
| Tests fonctionnels | ✅ 26 tests Supertest |
| Tests E2E | ✅ Playwright |
| Uptime Kuma | ✅ |
| GlitchTip (Sentry) | ✅ |
| Matomo analytics | ✅ |
| Backup 3-2-1 | ✅ CronJob K8s |
| Pages légales (CGU, Privacy, Cookies) | ✅ |
| SEO (robots.txt, sitemap, OG) | ✅ |
| CI/CD GitHub Actions | ✅ |
| **BONUS** 2FA TOTP sans librairie | ✅ |
| **BONUS** Collaboration WebSocket | ✅ |
| **BONUS** Cluster K3s auto-hébergé | ✅ |
| **BONUS** HPA autoscaling | ✅ |

---

## Contributeurs

- Bilal Amara
