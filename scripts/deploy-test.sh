#!/bin/bash

# Test script to manually deploy a preview environment

if [ -z "$1" ]; then
  echo "Usage: ./deploy-test.sh <pr-number>"
  echo "Example: ./deploy-test.sh 123"
  exit 1
fi

PR_NUMBER=$1
NAMESPACE="pr-${PR_NUMBER}"
NODE_PORT=$((30000 + PR_NUMBER))

echo "Deploying preview environment for PR #${PR_NUMBER}"
echo "Namespace: ${NAMESPACE}"
echo "NodePort: ${NODE_PORT}"
echo ""

# Create namespace
echo "Creating namespace..."
cat ../k8s-configs/namespace-template.yaml | \
  sed "s/PR_NAMESPACE/${NAMESPACE}/g" | \
  sed "s/PR_NUMBER/${PR_NUMBER}/g" | \
  kubectl apply -f -

# Create deployment
echo "Creating deployment..."
cat ../k8s-configs/deployment-template.yaml | \
  sed "s/PR_NAMESPACE/${NAMESPACE}/g" | \
  sed "s/PR_NUMBER/${PR_NUMBER}/g" | \
  kubectl apply -f -

# Create service
echo "Creating service..."
cat ../k8s-configs/service-template.yaml | \
  sed "s/PR_NAMESPACE/${NAMESPACE}/g" | \
  sed "s/PR_NUMBER/${PR_NUMBER}/g" | \
  sed "s/NODE_PORT/${NODE_PORT}/g" | \
  kubectl apply -f -

echo ""
echo "Preview environment deployed!"
echo ""
echo "Check status:"
echo "  kubectl get pods -n ${NAMESPACE}"
echo ""
echo "Access your app:"
echo "   http://localhost:${NODE_PORT}"
echo ""
echo "View logs:"
echo "   kubectl logs -n ${NAMESPACE} -l app=sample-app"
