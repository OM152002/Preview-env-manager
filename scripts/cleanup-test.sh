#!/bin/bash

# Test script to manually cleanup a preview environment
# Usage: ./cleanup-test.sh <pr-number>

if [ -z "$1" ]; then
  echo "Usage: ./cleanup-test.sh <pr-number>"
  echo "Example: ./cleanup-test.sh 123"
  exit 1
fi

PR_NUMBER=$1
NAMESPACE="pr-${PR_NUMBER}"

echo "Cleaning up preview environment for PR #${PR_NUMBER}"
echo "Namespace: ${NAMESPACE}"
echo ""

# Delete namespace (this deletes everything in it)
kubectl delete namespace ${NAMESPACE}

echo ""
echo "Preview environment cleaned up!"
