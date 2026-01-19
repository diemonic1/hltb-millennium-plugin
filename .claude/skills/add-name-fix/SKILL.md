---
name: add-name-fix
description: Add a Steam-to-HLTB game name mapping. Usage: /add-name-fix <appid>, <name>, or "Steam Name" -> "HLTB Name"
allowed-tools: Read, Edit, WebFetch, WebSearch
---

# Add Name Fix

Adds a game name mapping from Steam AppID to HLTB name in `backend/name_fixes.lua`.

## Input Formats

The skill accepts three input formats:

### 1. Steam App ID (preferred)
```
/add-name-fix 1004640
```

### 2. Steam Game Name
```
/add-name-fix "FINAL FANTASY TACTICS - The Ivalice Chronicles"
```

### 3. Full Mapping
```
/add-name-fix 1004640 -> "Final Fantasy Tactics: The Ivalice Chronicles"
```

## Instructions

### If given an App ID (numeric input):
1. Fetch the Steam store page to verify the AppID exists:
   `https://store.steampowered.com/app/{APPID}`
2. Search HLTB for the game (see "Searching HLTB" below)
3. Present confirmation summary and ask user to confirm the mapping

### If given a Steam name only:
1. Search for the Steam app ID: WebSearch `{game_name} site:store.steampowered.com`
2. Extract the AppID from the Steam URL (format: `store.steampowered.com/app/{APPID}/...`)
3. Verify by fetching: `https://store.steampowered.com/app/{APPID}`
4. Search HLTB for the game (see "Searching HLTB" below)
5. Present confirmation summary and ask user to confirm the mapping

### If given a full mapping (contains ` -> `):
1. Parse the arguments to extract the AppID and HLTB name
2. Verify the AppID by fetching: `https://store.steampowered.com/app/{APPID}`
3. Proceed directly to adding the mapping

### Searching HLTB
Note: Claude cannot directly access howlongtobeat.com, so use IsThereAnyDeal as a proxy.

1. Use WebSearch: `{game_name} IsThereAnyDeal`
2. Find the IsThereAnyDeal game page in results (format: `isthereanydeal.com/game/{slug}/info/`)
3. Fetch the IsThereAnyDeal page to get the HLTB game ID and name
4. Construct the HLTB URL: `https://howlongtobeat.com/game/{id}`

### Confirmation Output Format
Always present this exact format before asking for user confirmation:
```
- **AppID:** {appid}
- **Steam name:** "{name from Steam page}"
- **HLTB name:** "{exact name from HLTB}"
- **HLTB page:** {URL}
```

### Adding the mapping:
1. Read `backend/name_fixes.lua`
2. Find the correct position to maintain numerical order (ascending by AppID)
3. Insert the new mapping: `[{APPID}] = "{HLTB name}",`
4. Report the mapping that was added

## Example Workflow

For app ID 1004640:

1. Fetch Steam page: `https://store.steampowered.com/app/1004640`
2. Steam name: "FINAL FANTASY TACTICS - The Ivalice Chronicles"
3. WebSearch: "FINAL FANTASY TACTICS IsThereAnyDeal"
4. Fetch IsThereAnyDeal page to get HLTB game ID
5. Present confirmation:
   - **AppID:** 1004640
   - **Steam name:** "FINAL FANTASY TACTICS - The Ivalice Chronicles"
   - **HLTB name:** "Final Fantasy Tactics: The Ivalice Chronicles"
   - **HLTB page:** https://howlongtobeat.com/game/169173
6. User confirms mapping
7. Insert into name_fixes.lua in numerical order: `[1004640] = "Final Fantasy Tactics: The Ivalice Chronicles",`
