# Developer Scripts

Scripts for maintaining `name_fixes.lua`.

## discover-name-fixes.js

Finds games where automatic HLTB name matching fails by comparing Steam names against HLTB's known mappings. Uses the same sanitize/simplify logic as the plugin to ensure accurate results.

### Windows Setup

1. Install [Scoop](https://scoop.sh/) if you don't have it:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
   ```

2. Install dependencies:
   ```powershell
   scoop install nodejs-lts luajit luarocks
   luarocks install dkjson
   ```

3. Configure Lua to find luarocks modules (restart terminal after):
   ```powershell
   [Environment]::SetEnvironmentVariable("LUA_PATH", (luarocks path --lr-path), "User")
   [Environment]::SetEnvironmentVariable("LUA_CPATH", (luarocks path --lr-cpath), "User")
   ```

4. Verify:
   ```powershell
   node --version   # 18+
   luajit -v
   ```

### Usage

```bash
node scripts/discover-name-fixes.js
```

### Configuration

Edit `PROFILES` in the script to add Steam profile IDs. Profiles must be public (game library visible without login). Find large public libraries at [steamladder.com](https://steamladder.com/ladder/games/).

### Output

**Phase 1: Validate existing fixes** - Compares entries against HLTB API data. Deviations may be false positives since the API's `hltb_name` field often echoes the Steam name rather than the actual HLTB title.

**Phase 2: Games needing fixes** - Lists games where neither sanitize nor simplify produces a match, with suggested `name_fixes.lua` entries.
