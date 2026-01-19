# Developer Scripts

Scripts for maintaining `name_fixes.lua`.

## discover-name-fixes.js

Analyzes Steam libraries to find games needing manual name fixes and validates the sanitize/simplify matching logic.

### Windows Setup

1. Install [Scoop](https://scoop.sh/) if you don't have it:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
   ```

2. Install Node.js and LuaJIT:
   ```powershell
   scoop install nodejs-lts luajit
   ```

3. Verify installation:
   ```powershell
   node --version   # Should be 18+
   luajit -v        # Should show LuaJIT version
   ```

### Usage

From the repository root:

```bash
node scripts/discover-name-fixes.js
```

### Configuration

Edit the `PROFILES` array in the script to add Steam profile names:

```javascript
const PROFILES = [
  'mulard',
  'your_steam_profile',  // Add your public profile
];
```

Profiles must have public game libraries. To check: visit `steamcommunity.com/id/YOUR_PROFILE/games` - if you can see the games list without logging in, it's public.

### Output

The script runs two phases:

**Phase 1: Validate existing name_fixes**

Compares entries against the Steam import API's `hltb_name` field. Note: This field often echoes the Steam name rather than the actual HLTB title, so deviations may be false positives.

**Phase 2: Analyze sanitize vs simplify**

Categorizes games to validate our two-step search approach:
- Case A: Both sanitize and simplify match
- Case B: Sanitize matches, simplify would break (proves we need the two-step approach)
- Case C: Sanitize fails, simplify helps (proves simplify is needed as fallback)
- Case D: Neither matches (needs manual name_fix entry)

**Phase 3: Games needing fixes**

Lists games that need new `name_fixes.lua` entries with suggested values.
