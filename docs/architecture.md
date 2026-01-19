# Architecture

## Overview

The plugin has two parts:
- Frontend (TypeScript/React) - runs in Steam's UI, detects game pages, displays HLTB data
- Backend (Lua) - fetches data from HLTB and Steam APIs

## Frontend

Entry point: `frontend/index.tsx`

Key responsibilities:
- On startup, initialize ID cache from HLTB Steam import (for public profiles)
- Detect when user views a game page (MutationObserver watching for game header images)
- Extract Steam App ID from image URLs
- Call backend to get HLTB data (by ID if cached, otherwise by name search)
- Cache results in localStorage (two caches: ID mappings and result data)
- Inject completion time display into the page

Supports both Desktop and Big Picture modes. Uses CSS selectors to find game page elements

IMPORTANT: these are obfuscated class names that may break on Steam updates. But other reference implementations use a similar approach.

## Backend

Entry point: `backend/main.lua`

Key responsibilities:
- Fetch Steam import data from HLTB (for ID cache initialization)
- Fetch HLTB data directly by ID (fast path when ID is cached)
- Fetch game name from Steam API and search HLTB by name (fallback path)
- Return completion times to frontend

The HLTB client (`backend/hltb.lua`) handles auth tokens, search endpoint extraction, Steam import, and game matching. See `docs/hltb-api.md` for details.

## Data Flow

### Startup (ID Cache Initialization)

1. Frontend gets current user's Steam ID from `window.App.m_CurrentUser.strSteamID`
2. Calls backend `FetchSteamImport` with Steam user ID
3. Backend calls HLTB's Steam import API to get Steam app ID -> HLTB ID mappings
4. If successful (public profile), frontend stores mappings in localStorage ID cache
5. If profile is private, ID cache remains empty - falls back to name-based search

### Game Page View

1. User navigates to a game page
2. Frontend detects game header image, extracts Steam App ID
3. Check result cache - if fresh, display cached data
4. Otherwise, check ID cache for HLTB ID mapping:
   - If found: call backend `GetHltbDataById` with HLTB ID (fast path, guaranteed match)
   - If not found: call backend `GetHltbData` with App ID (name-based search)
5. Backend returns completion times
6. Frontend caches result and displays completion times

## Key Design Decisions

- Backend handles all HLTB requests (avoids CORS, enables complex matching logic)
- MutationObserver for SPA navigation detection (Steam doesn't trigger page loads)
- localStorage for caching (simple, synchronous, sufficient for small payloads)
- Stale-while-revalidate caching (show cached data immediately, refresh in background)
- Levenshtein distance for fuzzy game name matching
