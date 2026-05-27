# Guide de déploiement production — cinely.fr
> À exécuter dans l'ordre. Chaque étape doit réussir avant de passer à la suivante.

## Situation actuelle
- DNS `cinely.fr` → 141.227.151.228 ✅
- Ports 80 et 443 ouverts sur le master ✅
- kubectl local non configuré → toutes les commandes K8s sont à exécuter en SSH sur le master

---

## Étape 0 — Configurer kubectl en local (une seule fois)

Sur ton Mac :
```bash
# Récupérer le kubeconfig depuis le master
ssh root@141.227.151.228 "cat /etc/rancher/k3s/k3s.yaml" > ~/.kube/config-cinely

# Remplacer l'IP locale par l'IP publique du master
sed -i '' 's/127.0.0.1/141.227.151.228/g' ~/.kube/config-cinely

# Utiliser ce kubeconfig
export KUBECONFIG=~/.kube/config-cinely

# Vérifier
kubectl get nodes
```

---

## Étape 1 — DNS : corriger www.cinely.fr

**Problème détecté** : `www.cinely.fr` pointe sur 213.186.33.5 (page OVH), pas sur ton master.

Dans ton panel OVH / hébergeur DNS :
- Ajouter un enregistrement **A** : `www` → `141.227.151.228`
- OU ajouter un **CNAME** : `www` → `cinely.fr.`

Vérifie la propagation (peut prendre 5-15 min) :
```bash
dig +short www.cinely.fr
# Doit retourner : 141.227.151.228
```

---

## Étape 2 — UFW pare-feu sur les 3 VPS

À exécuter sur **chaque VPS** (master + worker1 + worker2) :
```bash
ssh root@141.227.151.228 "
  ufw --force reset
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow 22/tcp     # SSH
  ufw allow 80/tcp     # HTTP (Let's Encrypt + redirect)
  ufw allow 443/tcp    # HTTPS
  ufw allow 6443/tcp   # Kubernetes API (entre nœuds)
  ufw allow 10250/tcp  # Kubelet (entre nœuds)
  ufw allow 8472/udp   # Flannel VXLAN (réseau K3s)
  ufw --force enable
  ufw status"

ssh root@141.227.151.229 "
  ufw --force reset
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw allow 10250/tcp
  ufw allow 8472/udp
  ufw --force enable"

ssh root@141.227.151.230 "
  ufw --force reset
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw allow 10250/tcp
  ufw allow 8472/udp
  ufw --force enable"
```

---

## Étape 3 — Build et push des images Docker

Sur ton Mac, depuis la racine du projet :
```bash
cd /Users/bilalamara/Cours/S7/Projet-Annuel/Project-Cluster

# Connexion Docker Hub
docker login -u bamara3

# Build production backend (linux/amd64 pour les VPS Linux)
docker build --target production --platform linux/amd64 \
  -t bamara3/backend-app:latest apps/backend/

# Push
docker push bamara3/backend-app:latest

# Build production frontend
docker build --target production --platform linux/amd64 \
  -t bamara3/frontend-app:latest apps/frontend/

# Push
docker push bamara3/frontend-app:latest
```

---

## Étape 4 — Activer Let's Encrypt dans Traefik

```bash
export KUBECONFIG=~/.kube/config-cinely

# Appliquer la config Traefik ACME
kubectl apply -f k8s/65-traefik/traefik-config.yaml

# Attendre que Traefik redémarre (environ 30-60s)
kubectl rollout status daemonset/traefik -n kube-system --timeout=120s
echo "Traefik redémarré ✓"
```

---

## Étape 5 — Déployer tous les services

```bash
export KUBECONFIG=~/.kube/config-cinely

# Namespace
kubectl apply -f k8s/00-namespace/namespace.yaml

# Config + Secrets
kubectl apply -f k8s/10-config/app-configmap.yaml
kubectl apply -f k8s/20-secrets/db-secret.yaml
kubectl apply -f k8s/20-secrets/app-secret.yaml

# Redis
kubectl apply -f k8s/25-redis/redis.yaml

# PostgreSQL
kubectl apply -f k8s/30-db/postgres.yaml
echo "Attente PostgreSQL (60s max)..."
kubectl wait --for=condition=ready pod -l app=postgres \
  -n cluster-project --timeout=120s

# Backend
kubectl apply -f k8s/40-backend/backend.yaml
kubectl rollout status deployment/backend -n cluster-project --timeout=120s

# Frontend
kubectl apply -f k8s/50-frontend/frontend.yaml
kubectl rollout status deployment/frontend -n cluster-project --timeout=120s

# Ingress + HTTPS
kubectl apply -f k8s/60-ingress/ingress.yaml

# HPA
kubectl apply -f k8s/70-hpa/hpa.yaml

echo "Déploiement terminé ✓"
```

---

## Étape 6 — Vérification

```bash
export KUBECONFIG=~/.kube/config-cinely

# État des nœuds
kubectl get nodes

# État des pods
kubectl get pods -n cluster-project

# État de l'ingress
kubectl get ingress -n cluster-project

# Health check (attendre 1-2 min pour le certificat Let's Encrypt)
curl -s https://cinely.fr/api/health | python3 -m json.tool

# Vérifier le certificat
echo | openssl s_client -connect cinely.fr:443 2>/dev/null | openssl x509 -noout -issuer -dates
```

**Ce que tu dois voir :**
```
# kubectl get nodes → 3 nœuds Ready
NAME       STATUS   ROLES                  AGE
master     Ready    control-plane,master   ...
worker1    Ready    <none>                 ...
worker2    Ready    <none>                 ...

# curl health → status ok
{ "status": "ok", "db": "connected", "uptime": 42, "version": "1.0.0" }

# openssl → issuer Let's Encrypt
issuer=C=US, O=Let's Encrypt, CN=R10
```

---

## Problèmes fréquents

### Pod backend en CrashLoopBackOff
```bash
kubectl logs deployment/backend -n cluster-project --previous
# Souvent : DB_NAME/DB_USER ne correspondent pas à la BDD existante
```

### Certificat pas encore délivré (ERR_CERT_AUTHORITY_INVALID)
- Let's Encrypt peut prendre 2-5 minutes après le premier déploiement
- Vérifier que le port 80 est accessible depuis internet (pas de blocage OVH)
- Vérifier les logs Traefik : `kubectl logs daemonset/traefik -n kube-system`

### www.cinely.fr ne fonctionne pas
- Vérifier que le DNS `www` → 141.227.151.228 est propagé
- `dig +short www.cinely.fr` doit retourner 141.227.151.228

### PostgreSQL : données existantes vs nouveau schema
Si le cluster avait déjà des données avec l'ancien schema (appdb/appuser) :
```bash
# Option 1 : supprimer le PVC et recommencer (perd les données)
kubectl delete pvc pgdata-postgres-0 -n cluster-project
kubectl delete pod postgres-0 -n cluster-project

# Option 2 : garder les données — mettre à jour DB_NAME/DB_USER dans configmap
# pour correspondre à l'ancienne BDD
```

---

## Mail en production (Gmail)

Pour que les emails fonctionnent (reset mot de passe, vérification email) :
1. Aller sur [myaccount.google.com](https://myaccount.google.com)
2. Sécurité → Validation en 2 étapes → Mots de passe des applications
3. Créer un mot de passe pour "Notes App"
4. Encoder en base64 : `echo -n "motdepasseapp" | base64`
5. Mettre à jour `k8s/20-secrets/app-secret.yaml` → `MAIL_PASS`
6. `kubectl apply -f k8s/20-secrets/app-secret.yaml`
7. `kubectl rollout restart deployment/backend -n cluster-project`
