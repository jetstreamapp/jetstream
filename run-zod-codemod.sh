#!/bin/bash

# Script to run zod v3 to v4 codemod on all tsconfig files in apps and libs that use zod

echo "Running zod v3 to v4 codemod on all relevant tsconfig files..."
echo

# Counter for processed files
count=0

# Apps that use zod
apps=(
  "api"
  "geo-ip-api"
  "jetstream"
  "jetstream-desktop"
  "jetstream-desktop-client"
  "jetstream-e2e"
  "jetstream-web-extension"
  "jetstream-web-extension-e2e"
  "landing"
)

# Libs that use zod
libs=(
  "api-config"
  "api-types"
  "auth/types"
  "desktop-types"
  "features/platform-event-monitor"
  "types"
)

# Function to run codemod if file exists
run_codemod() {
  local file=$1
  if [ -f "$file" ]; then
    echo "Processing: $file"
    npx zod-v3-to-v4 "$file"
    ((count++))
    echo
  fi
}

# Process apps
echo "=== Processing Apps ==="
for app in "${apps[@]}"; do
  echo "Checking app: $app"
  
  # Check for tsconfig.app.json
  run_codemod "apps/$app/tsconfig.app.json"
  
  # Check for tsconfig.spec.json
  run_codemod "apps/$app/tsconfig.spec.json"
  
  # Some apps might have tsconfig.json as the main config
  run_codemod "apps/$app/tsconfig.json"
done

echo
echo "=== Processing Libraries ==="
# Process libs
for lib in "${libs[@]}"; do
  echo "Checking lib: $lib"
  
  # Check for tsconfig.lib.json
  run_codemod "libs/$lib/tsconfig.lib.json"
  
  # Check for tsconfig.spec.json
  run_codemod "libs/$lib/tsconfig.spec.json"
  
  # Some libs might have tsconfig.json as the main config
  run_codemod "libs/$lib/tsconfig.json"
done

echo
echo "=== Summary ==="
echo "Total tsconfig files processed: $count"
echo "Codemod complete!"