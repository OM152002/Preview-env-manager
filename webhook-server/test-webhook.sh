#!/bin/bash

# Test script to simulate GitHub webhook events

WEBHOOK_URL="http://localhost:4000/webhook"
WEBHOOK_SECRET="development-secret-123"

# Function to generate signature
generate_signature() {
  local payload=$1
  echo -n "${payload}" | openssl dgst -sha256 -hmac "${WEBHOOK_SECRET}" | sed 's/^.* //'
}

# Test PR opened event
test_pr_opened() {
  echo "Testing PR opened event..."
  
  PAYLOAD='{
    "action": "opened",
    "pull_request": {
      "number": 42,
      "title": "Test PR",
      "user": {
        "login": "testuser"
      },
      "merged": false
    },
    "repository": {
      "name": "preview-env-manager"
    }
  }'
  
  SIGNATURE="sha256=$(generate_signature "$PAYLOAD")"
  
  curl -X POST \
    -H "Content-Type: application/json" \
    -H "X-GitHub-Event: pull_request" \
    -H "X-GitHub-Delivery: test-delivery-1" \
    -H "X-Hub-Signature-256: ${SIGNATURE}" \
    -d "${PAYLOAD}" \
    ${WEBHOOK_URL}
  
  echo -e "\n"
}

# Test PR closed event
test_pr_closed() {
  echo "Testing PR closed event..."
  
  PAYLOAD='{
    "action": "closed",
    "pull_request": {
      "number": 42,
      "title": "Test PR",
      "user": {
        "login": "testuser"
      },
      "merged": true
    },
    "repository": {
      "name": "preview-env-manager"
    }
  }'
  
  SIGNATURE="sha256=$(generate_signature "$PAYLOAD")"
  
  curl -X POST \
    -H "Content-Type: application/json" \
    -H "X-GitHub-Event: pull_request" \
    -H "X-GitHub-Delivery: test-delivery-2" \
    -H "X-Hub-Signature-256: ${SIGNATURE}" \
    -d "${PAYLOAD}" \
    ${WEBHOOK_URL}
  
  echo -e "\n"
}

# Run tests
echo "Testing webhook endpoints..."
echo ""

test_pr_opened
sleep 15  # Wait for deployment

test_pr_closed
sleep 5   # Wait for cleanup

echo "Tests complete!"
