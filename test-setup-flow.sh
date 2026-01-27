#!/bin/bash

# Test the setup flow by checking the admin existence endpoint

echo "Testing setup flow..."
echo ""

# Wait for server to start
echo "Waiting for server to be ready..."
sleep 3

# Test check-admin endpoint
echo "Testing /api/auth?op=check-admin..."
RESPONSE=$(curl -s "http://localhost:8788/api/auth?op=check-admin")
echo "Response: $RESPONSE"
echo ""

# Extract exists value
EXISTS=$(echo $RESPONSE | grep -o '"exists":[^,}]*' | cut -d':' -f2)
echo "Admin exists: $EXISTS"

if [ "$EXISTS" = "true" ]; then
    echo "✓ Admin exists - user should be redirected to /login"
elif [ "$EXISTS" = "false" ]; then
    echo "✓ Admin does NOT exist - user should see setup form"
else
    echo "✗ Unexpected response"
fi
