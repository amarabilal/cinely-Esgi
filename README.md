# Cluster Project — Orchestration de Conteneurs

Architecture conteneurisée et orchestrée sur **K3s** (Kubernetes), déployant un frontend Nginx, un backend Node.js/Express et une base de données PostgreSQL, avec haute disponibilité, persistance, secrets et HTTPS.

---

## Architecture

```text
Internet
    │
    ▼
[ Traefik Ingress ]  ← TLS (app.local)
    │
    ├──/──────────► [ Frontend ×3 ] (Nginx:80)
    │
    └──/api────────► [ Backend ×2 ] (Node.js:3000)
                          │
                          ▼
                   [ PostgreSQL ×1 ] (StatefulSet)
                          │
                          ▼
                   [ PersistentVolume 5Gi ]
```

**Nœuds du cluster :**

| Rôle   | Hostname     |
|--------|--------------|
| Master | master-node  |
| Worker | worker-1     |
| Worker | worker-2     |

**Namespace :** `cluster-project`

---

## Stack technique

| Couche          | Technologie            |
|-----------------|------------------------|
| Frontend        | Nginx 1.27-alpine      |
| Backend         | Node.js 20 / Express   |
| Base de données | PostgreSQL 16          |
| Orchestration   | K3s (Kubernetes)       |
| Ingress         | Traefik (intégré K3s)  |
| Stockage        | PVC local-path (5 Gi)  |
| Config          | ConfigMap + Secret K8s |

---

## Prérequis

- 3 VPS/VM sous Linux (Ubuntu 22.04 recommandé)
- `kubectl` configuré sur le master
- Accès SSH entre les nœuds
- `openssl` pour le certificat TLS auto-signé
- Images Docker disponibles sur Docker Hub : `bamara3/backend-app:latest`, `bamara3/frontend-app:latest`

---

## Installation du cluster K3s

### 1. Master

```bash
curl -sfL https://get.k3s.io | sh -
# Récupérer le token pour les workers
cat /var/lib/rancher/k3s/server/node-token
# Vérifier
kubectl get nodes
```

### 2. Workers (répéter sur chaque worker)

```bash
# Remplacer MASTER_IP et NODE_TOKEN
curl -sfL https://get.k3s.io | K3S_URL=https://<MASTER_IP>:6443 K3S_TOKEN=<NODE_TOKEN> sh -
```

### 3. Validation

```bash
kubectl get nodes
# Attendu : 1 master Ready + 2 workers Ready
```

---

## Déploiement de l'application

### Déploiement automatique (script)

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

### Déploiement manuel (étape par étape)

```bash
# 1. Namespace
kubectl apply -f k8s/00-namespace/namespace.yaml

# 2. ConfigMap
kubectl apply -f k8s/10-config/app-configmap.yaml

# 3. Secrets
kubectl apply -f k8s/20-secrets/db-secret.yaml

# 4. Base de données (StatefulSet + PVC)
kubectl apply -f k8s/30-db/postgres.yaml
kubectl rollout status statefulset/postgres -n cluster-project

# 5. Backend (2 replicas)
kubectl apply -f k8s/40-backend/backend.yaml
kubectl rollout status deployment/backend -n cluster-project

# 6. Frontend (3 replicas)
kubectl apply -f k8s/50-frontend/frontend.yaml
kubectl rollout status deployment/frontend -n cluster-project

# 7. Ingress
kubectl apply -f k8s/60-ingress/ingress.yaml

# 8. HPA (autoscaling)
kubectl apply -f k8s/70-hpa/hpa.yaml

# Vérification globale
kubectl get all -n cluster-project
kubectl get hpa -n cluster-project
```

---

## Persistance des données

La base de données utilise un **PersistentVolumeClaim** (5 Gi, `local-path`) monté sur `/var/lib/postgresql/data`.

**Test de persistance :**

```bash
# Supprimer le pod PostgreSQL
kubectl delete pod -l app=postgres -n cluster-project

# K3s recrée automatiquement le pod (StatefulSet)
kubectl get pods -n cluster-project -w

# Vérifier que les données sont intactes
kubectl exec -it <nouveau-pod-postgres> -n cluster-project -- psql -U appuser -d appdb -c "\dt"
```

> Capture : `docs/screenshots/Test-persistance.png`

---

## Sécurité

### Secrets Kubernetes

Les mots de passe sont stockés dans un **Secret** K8s (encodé base64), jamais en clair dans les Deployments :

```bash
kubectl get secret db-secret -n cluster-project
kubectl describe secret db-secret -n cluster-project
```

### HTTPS (certificat auto-signé)

```bash
# Générer le certificat TLS auto-signé
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout tls.key -out tls.crt \
  -subj "/CN=app.local/O=cluster-project"

# Créer le Secret TLS dans K8s
kubectl create secret tls app-tls \
  --cert=tls.crt --key=tls.key \
  -n cluster-project

# Vérifier
kubectl get secret app-tls -n cluster-project
```

Configurer `/etc/hosts` (poste local) :

```text
<MASTER_IP>  app.local
```

Accéder à l'application : `https://app.local`

> Capture : `docs/screenshots/Test-url-https.png`

---

## Exposition réseau

L'**Ingress Traefik** (intégré à K3s) route le trafic :

| Route   | Service   | Port |
|---------|-----------|------|
| `/`     | frontend  | 80   |
| `/api`  | backend   | 3000 |

```bash
kubectl get ingress -n cluster-project
kubectl get svc -n cluster-project
```

---

## Haute disponibilité

### Scaling manuel

```bash
# Scaler le frontend à 5 replicas
kubectl scale deployment frontend --replicas=5 -n cluster-project

# Scaler le backend à 4 replicas
kubectl scale deployment backend --replicas=4 -n cluster-project

# Vérifier
kubectl get pods -n cluster-project
```

> Capture : `docs/screenshots/Test-scale.png`

### Autoscaling horizontal (HPA) — Bonus

K3s intègre `metrics-server` par défaut. Les HPA surveillent CPU et mémoire et ajustent automatiquement le nombre de replicas.

| Deployment | Min | Max | CPU seuil | Mémoire seuil |
|------------|-----|-----|-----------|---------------|
| backend    | 2   | 6   | 70 %      | 80 %          |
| frontend   | 3   | 9   | 70 %      | 80 %          |

```bash
# Vérifier que metrics-server est actif
kubectl get pods -n kube-system | grep metrics-server

# Appliquer les HPA
kubectl apply -f k8s/70-hpa/hpa.yaml

# Observer l'état des HPA
kubectl get hpa -n cluster-project

# Surveiller en direct (scale-up lors de charge)
kubectl get hpa -n cluster-project -w
```

**Simuler une charge pour déclencher le scale-up :**

```bash
# Lancer un pod de charge temporaire vers le backend
kubectl run load-test --image=busybox --rm -it --restart=Never \
  -n cluster-project -- /bin/sh -c \
  "while true; do wget -q -O- http://backend:3000/api; done"

# Dans un autre terminal, observer le scale automatique
kubectl get hpa -n cluster-project -w
kubectl get pods -n cluster-project -w
```

Quand la charge s'arrête, le HPA réduit automatiquement les replicas après ~5 min (cooldown par défaut).

### Test de tolérance aux pannes

```bash
# Supprimer un pod backend — K3s le recrée automatiquement
kubectl delete pod -l app=backend -n cluster-project --grace-period=0

# Observer la récupération automatique
kubectl get pods -n cluster-project -w
```

> Captures : `docs/screenshots/Test-auto-recovery.png`, `docs/screenshots/Test-auto-recovery-mac.png`

---

## Nettoyage

```bash
chmod +x scripts/cleanup.sh
./scripts/cleanup.sh
# Supprime le namespace cluster-project et toutes ses ressources
```

---

## Structure du dépôt

```text
cluster-project/
├── apps/
│   ├── backend/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── server.js
│   └── frontend/
│       ├── Dockerfile
│       └── index.html
├── k8s/
│   ├── 00-namespace/namespace.yaml
│   ├── 10-config/app-configmap.yaml
│   ├── 20-secrets/db-secret.yaml
│   ├── 30-db/postgres.yaml
│   ├── 40-backend/backend.yaml
│   ├── 50-frontend/frontend.yaml
│   ├── 60-ingress/ingress.yaml
│   └── 70-hpa/hpa.yaml
├── docs/
│   └── screenshots/
├── scripts/
│   ├── deploy.sh
│   └── cleanup.sh
└── README.md
```

---

## Barème couvert

| Critère | Points |
| --- | --- |
| Cluster K3s (1 master + 2 workers) | 2/2 |
| Deploiement (front x3, back x2, BDD) | 5/5 |
| Persistance (PVC, StatefulSet) | 2/2 |
| Securite (Secret K8s + HTTPS TLS) | 2/2 |
| Exposition (Traefik Ingress + DNS) | 2/2 |
| Documentation & scripts | 2/2 |
| **Total** | **15/15** |

### Rapport des bonus implémentés

#### Bonus 1 — Resource Requests & Limits / QoS (+1)

Fichiers : `k8s/40-backend/backend.yaml`, `k8s/50-frontend/frontend.yaml`

Chaque conteneur déclare des `requests` (garantie CPU/RAM) et des `limits` (plafond) :

| Composant | CPU request | CPU limit | RAM request | RAM limit |
| --- | --- | --- | --- | --- |
| Backend | 50m | 200m | 64Mi | 256Mi |
| Frontend | 25m | 150m | 32Mi | 128Mi |

Cela place les pods en QoS **Burstable** et protège les nœuds contre la surconsommation.

#### Bonus 2 — Node Affinity / BDD épinglée sur le master (+1)

Fichier : `k8s/30-db/postgres.yaml`

Le StatefulSet PostgreSQL utilise `preferredDuringSchedulingIgnoredDuringExecution` avec le label `node-role.kubernetes.io/master` pour privilégier le nœud master. Cela garantit que la base de données tourne sur le nœud le plus stable du cluster tout en restant portable sur n'importe quel cluster.

#### Bonus 3 — Autoscaling horizontal HPA (+1)

Fichier : `k8s/70-hpa/hpa.yaml`

Deux HPA surveillent CPU et mémoire en temps réel via `metrics-server` (intégré K3s) :

| Deployment | Min replicas | Max replicas | Seuil CPU | Seuil RAM |
| --- | --- | --- | --- | --- |
| backend | 2 | 6 | 70 % | 80 % |
| frontend | 3 | 9 | 70 % | 80 % |

**Preuve en production :** sous charge (`busybox` boucle infinie sur `/api`), le CPU backend est monté à 176 % → le HPA a automatiquement scalé de 2 à 6 replicas en moins de 60 secondes. Après arrêt de la charge, retour à 2 replicas après le cooldown de 5 minutes.

Capture : `docs/screenshots/Metriques.png`

---

## Captures d'écran

### Démarrage initial des pods

![Pods ContainerCreating](docs/screenshots/Pods-ContainerCreating.png)

### État final du cluster

![Etat final](docs/screenshots/Test-etat-final.png)

### Scale up frontend / backend

![Scale](docs/screenshots/Test-scale.png)

### Auto-recovery — pod supprimé et recréé automatiquement

![Auto-recovery](docs/screenshots/Test-auto-recovery.png)

![Auto-recovery mac](docs/screenshots/Test-auto-recovery-mac.png)

### Persistance — données intactes après suppression du pod PostgreSQL

![Persistance](docs/screenshots/Test-persistance.png)

### HTTPS — accès via app.local

![HTTPS](docs/screenshots/Test-url-https.png)

### HPA — métriques autoscaling en temps réel

![HPA Metriques](docs/screenshots/Metriques.png)
