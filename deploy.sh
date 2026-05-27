#!/bin/bash
# ============================================================
#  Script de déploiement — cinely.fr
#  Usage : ./deploy.sh [build|apply|all]
#  Prérequis : docker login bamara3, kubectl configuré sur K3s
# ============================================================
set -e

DOCKER_USER="bamara3"
BACKEND_IMAGE="$DOCKER_USER/backend-app"
FRONTEND_IMAGE="$DOCKER_USER/frontend-app"
K8S_DIR="$(dirname "$0")/k8s"

# ── Couleurs ─────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ── Vérifications prérequis ───────────────────────────────────
check_prereqs() {
  command -v docker  >/dev/null 2>&1 || error "docker non trouvé"
  command -v kubectl >/dev/null 2>&1 || error "kubectl non trouvé"
  kubectl cluster-info >/dev/null 2>&1 || error "kubectl ne peut pas joindre le cluster K3s"
  info "Prérequis OK"
}

# ── Build + Push images Docker ────────────────────────────────
build_and_push() {
  info "Build image backend (target: production)..."
  docker build \
    --target production \
    --platform linux/amd64 \
    -t "$BACKEND_IMAGE:latest" \
    apps/backend/
  docker push "$BACKEND_IMAGE:latest"
  info "Backend poussé : $BACKEND_IMAGE:latest"

  info "Build image frontend (target: production)..."
  docker build \
    --target production \
    --platform linux/amd64 \
    -t "$FRONTEND_IMAGE:latest" \
    apps/frontend/
  docker push "$FRONTEND_IMAGE:latest"
  info "Frontend poussé : $FRONTEND_IMAGE:latest"
}

# ── Application des manifests K8s (ordre strict) ─────────────
apply_manifests() {
  info "Application des manifests Kubernetes..."

  # 1. Traefik ACME (kube-system) — d'abord pour que le cert resolver existe
  info "  → Traefik ACME config"
  kubectl apply -f "$K8S_DIR/65-traefik/traefik-config.yaml"
  info "  Attente redémarrage Traefik (30s)..."
  sleep 30

  # 2. Namespace
  info "  → Namespace"
  kubectl apply -f "$K8S_DIR/00-namespace/namespace.yaml"

  # 3. ConfigMap + Secrets
  info "  → ConfigMap"
  kubectl apply -f "$K8S_DIR/10-config/app-configmap.yaml"
  info "  → Secrets"
  kubectl apply -f "$K8S_DIR/20-secrets/db-secret.yaml"
  kubectl apply -f "$K8S_DIR/20-secrets/app-secret.yaml"

  # 4. Redis
  info "  → Redis"
  kubectl apply -f "$K8S_DIR/25-redis/redis.yaml"

  # 5. PostgreSQL
  info "  → PostgreSQL"
  kubectl apply -f "$K8S_DIR/30-db/postgres.yaml"
  info "  Attente PostgreSQL ready..."
  kubectl wait --for=condition=ready pod -l app=postgres \
    -n cluster-project --timeout=120s

  # 6. Backend
  info "  → Backend"
  kubectl apply -f "$K8S_DIR/40-backend/backend.yaml"
  kubectl rollout status deployment/backend -n cluster-project --timeout=120s

  # 7. Frontend
  info "  → Frontend"
  kubectl apply -f "$K8S_DIR/50-frontend/frontend.yaml"
  kubectl rollout status deployment/frontend -n cluster-project --timeout=120s

  # 8. Ingress (après les services pour éviter 502 au démarrage)
  info "  → Ingress + Middleware"
  kubectl apply -f "$K8S_DIR/60-ingress/ingress.yaml"

  # 9. HPA
  info "  → HPA"
  kubectl apply -f "$K8S_DIR/70-hpa/hpa.yaml"

  info "Tous les manifests appliqués ✓"
}

# ── Vérification finale ───────────────────────────────────────
check_cluster() {
  info "État du cluster :"
  kubectl get nodes
  echo ""
  kubectl get pods -n cluster-project
  echo ""
  kubectl get ingress -n cluster-project
  echo ""
  info "Health check backend :"
  sleep 5
  curl -sk https://cinely.fr/api/health | python3 -m json.tool 2>/dev/null || \
    warn "Health check échoué — vérifier DNS et certificat"
}

# ── Rolling update (images déjà poussées) ────────────────────
rolling_update() {
  info "Rolling update backend + frontend..."
  kubectl rollout restart deployment/backend  -n cluster-project
  kubectl rollout restart deployment/frontend -n cluster-project
  kubectl rollout status  deployment/backend  -n cluster-project --timeout=120s
  kubectl rollout status  deployment/frontend -n cluster-project --timeout=120s
  info "Rolling update terminé ✓"
}

# ── Main ──────────────────────────────────────────────────────
case "${1:-all}" in
  build)   check_prereqs; build_and_push ;;
  apply)   check_prereqs; apply_manifests; check_cluster ;;
  update)  check_prereqs; build_and_push; rolling_update; check_cluster ;;
  all)     check_prereqs; build_and_push; apply_manifests; check_cluster ;;
  *)       echo "Usage: $0 [build|apply|update|all]"; exit 1 ;;
esac
