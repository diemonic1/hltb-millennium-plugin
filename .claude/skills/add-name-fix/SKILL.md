---
name: add-name-fix
description: Add a Steam-to-HLTB game name mapping. Usage: /add-name-fix <appid>, <name>, or "Steam Name" -> "HLTB Name"
allowed-tools: Read, Edit, WebFetch, WebSearch
---

# Add Name Fix

Adds a game name mapping from Steam to HLTB in `backend/name_fixes.lua`.

## Input Formats

The skill accepts three input formats:

### 1. Steam App ID
```
/add-name-fix 1004640
```

### 2. Steam Game Name
```
/add-name-fix "FINAL FANTASY TACTICS - The Ivalice Chronicles"
```

### 3. Full Mapping
```
/add-name-fix "FINAL FANTASY TACTICS - The Ivalice Chronicles" -> "Final Fantasy Tactics: The Ivalice Chronicles"
```

## Instructions

### If given an App ID (numeric input):
1. Fetch the Steam API to get the game name:
   `https://store.steampowered.com/api/appdetails?appids={APPID}`
2. Extract the name from `response[appid].data.name`
3. Search HLTB for the game (see "Searching HLTB" below)
4. Present confirmation summary and ask user to confirm the mapping

### If given a Steam name only:
1. Search for the Steam app ID: WebSearch `{game_name} site:store.steampowered.com`
2. Fetch the Steam API to verify the exact name:
   `https://store.steampowered.com/api/appdetails?appids={APPID}`
3. Search HLTB for the game (see "Searching HLTB" below)
4. Present confirmation summary and ask user to confirm the mapping

### If given a full mapping (contains ` -> `):
1. Parse the arguments to extract the Steam name and HLTB name
2. Proceed directly to adding the mapping

### Searching HLTB
Note: Claude cannot directly access howlongtobeat.com, so use IsThereAnyDeal as a proxy.

1. Use WebSearch: `{game_name} IsThereAnyDeal`
2. Find the IsThereAnyDeal game page in results (format: `isthereanydeal.com/game/{slug}/info/`)
3. Fetch the IsThereAnyDeal page to get the HLTB game ID and name
4. Construct the HLTB URL: `https://howlongtobeat.com/game/{id}`

### Confirmation Output Format
Always present this exact format before asking for user confirmation:
```
- **Steam name:** "{exact name from Steam API}"
- **HLTB name:** "{exact name from HLTB}"
- **HLTB page:** {URL}
```

### Adding the mapping:
1. Sanitize the Steam name (see rules below)
2. Read `backend/name_fixes.lua`
3. Find the correct alphabetical position (case-insensitive) for the new key
4. Insert the new mapping at that position to maintain sorted order
5. Report the mapping that was added

## Sanitization Rules

See `backend/hltb_utils.lua` for the canonical `sanitize_game_name` implementation. Always check the code.

Current rules:
- Remove ™ (trademark symbol)
- Remove ® (registered trademark)
- Remove © (copyright symbol)
- Collapse multiple spaces to single space
- Trim leading/trailing whitespace

Update this skill so that it remains in sync with the code.

## Example Workflow

For app ID 1004640:

1. Fetch Steam API: `https://store.steampowered.com/api/appdetails?appids=1004640`
2. Steam name: "FINAL FANTASY TACTICS - The Ivalice Chronicles"
3. WebSearch: "FINAL FANTASY TACTICS IsThereAnyDeal"
4. Fetch IsThereAnyDeal page to get HLTB game ID
5. Present confirmation:
   - **Steam name:** "FINAL FANTASY TACTICS - The Ivalice Chronicles"
   - **HLTB name:** "Final Fantasy Tactics: The Ivalice Chronicles"
   - **HLTB page:** https://howlongtobeat.com/game/169173
6. User confirms mapping
7. Insert into name_fixes.lua in alphabetical order: `["FINAL FANTASY TACTICS - The Ivalice Chronicles"] = "Final Fantasy Tactics: The Ivalice Chronicles"`
