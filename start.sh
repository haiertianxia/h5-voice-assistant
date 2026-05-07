#!/bin/bash
# H5 Voice Assistant - Quick Start
#
# Prerequisites:
#   1. Copy .env.example to .env and fill in your keys
#   2. npm install
#
# Usage:
#   npm start      # Production
#   npm run dev    # Development (auto-reload)
#
# Then open: http://localhost:3000

PORT=3000

# Check for .env
if [ ! -f .env ]; then
  echo "Warning: .env not found. Copy .env.example to .env and add your API keys."
fi

node server/index.js
