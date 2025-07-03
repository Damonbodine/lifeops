#!/bin/bash

echo "🧪 Testing Smart Message API with curl..."
echo "📍 Endpoint: http://localhost:3000/api/smart-message"

curl -X POST http://localhost:3000/api/smart-message \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "6462566056",
    "contactName": "Matthew Sandoval", 
    "daysBack": 30
  }' \
  -w "\n\nHTTP Status: %{http_code}\nTime: %{time_total}s\n" | jq . 2>/dev/null || cat