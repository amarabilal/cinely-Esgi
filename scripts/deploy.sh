#!/usr/bin/env bash
set -euo pipefail

NS="cluster-project"

echo "Creating namespace..."
sudo k3s kubectl apply -f k8s/00-namespace/namespace.yaml

echo "Applying configmap..."
sudo k3s kubectl apply -f k8s/10-config/app-configmap.yaml

echo "Applying secrets..."
sudo k3s kubectl apply -f k8s/20-secrets/db-secret.yaml

echo "Deploying PostgreSQL..."
sudo k3s kubectl apply -f k8s/30-db/postgres.yaml

echo "Waiting for database..."
sudo k3s kubectl -n "$NS" rollout status statefulset/postgres

echo "Deploying backend..."
sudo k3s kubectl apply -f k8s/40-backend/backend.yaml

echo "Deploying frontend..."
sudo k3s kubectl apply -f k8s/50-frontend/frontend.yaml

echo "Generating TLS certificate for app.local..."
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /tmp/tls.key -out /tmp/tls.crt \
  -subj "/CN=app.local/O=cluster-project" 2>/dev/null
sudo k3s kubectl create secret tls app-tls \
  --cert=/tmp/tls.crt --key=/tmp/tls.key \
  -n "$NS" --dry-run=client -o yaml | sudo k3s kubectl apply -f -
rm -f /tmp/tls.key /tmp/tls.crt

echo "Deploying ingress..."
sudo k3s kubectl apply -f k8s/60-ingress/ingress.yaml

echo "Waiting for backend..."
sudo k3s kubectl -n "$NS" rollout status deploy/backend

echo "Waiting for frontend..."
sudo k3s kubectl -n "$NS" rollout status deploy/frontend

echo "Applying HPA (autoscaling)..."
sudo k3s kubectl apply -f k8s/70-hpa/hpa.yaml

echo "Cluster deployed successfully!"
sudo k3s kubectl -n "$NS" get pods -o wide
sudo k3s kubectl -n "$NS" get hpa