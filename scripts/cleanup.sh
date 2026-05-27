#!/usr/bin/env bash
set -euo pipefail

NS="cluster-project"

echo "Deleting namespace $NS ..."

sudo k3s kubectl delete namespace "$NS" --ignore-not-found=true

echo ""
echo "Cleanup finished."
echo "All resources from $NS have been removed."