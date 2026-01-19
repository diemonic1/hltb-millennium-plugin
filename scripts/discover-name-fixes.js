/**
 * Name Fix Discovery Script
 *
 * Fetches Steam libraries via HLTB's Steam import API and identifies games
 * where automatic name matching fails, requiring manual name_fixes.lua entries.
 *
 * The script uses the same sanitize/simplify logic as the plugin (via Lua)
 * to ensure consistency between discovery and runtime matching.
 *
 * Usage: node scripts/discover-name-fixes.js
 *
 * Requirements:
 *   - Node.js 18+ (for native fetch)
 *   - Lua or LuaJIT with dkjson module
 *   - Public Steam profiles in PROFILES array
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');

// Steam profiles to scan (must be public)
const PROFILES = [
  'mulard',
  '76561198017975643', // Top US Steam owner (steamladder.com/ladder/games/us)
  '76561198028121353', // Top overall Steam owner (steamladder.com/ladder/games)
  '76561198355625888',
  '76561198001237877',
  '76561198051887711',
];

const HLTB_API_URL = 'https://howlongtobeat.com/api/steam/getSteamImportData';

// Match threshold: 20% of name length, minimum 5 edits
// e.g., 30-char name allows 6 edits, 10-char name allows 5 edits
const LEVENSHTEIN_THRESHOLD = 0.2;

/**
 * Detect available Lua interpreter (prefers luajit)
 */
function detectLua() {
  for (const cmd of ['luajit', 'lua']) {
    try {
      execSync(`${cmd} -v`, { encoding: 'utf-8', stdio: 'pipe' });
      return cmd;
    } catch {
      // Try next
    }
  }
  return null;
}

/**
 * Process all games through Lua in one batch call
 */
function processGamesBatch(luaCmd, games) {
  const luaScript = join(ROOT_DIR, 'scripts', 'name-utils-cli.lua');
  const input = JSON.stringify({ games });

  try {
    const result = execSync(`${luaCmd} "${luaScript}"`, {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
      input,
      maxBuffer: 50 * 1024 * 1024, // 50MB for large libraries
    });
    return JSON.parse(result);
  } catch (err) {
    console.error('Lua batch processing failed:', err.message);
    process.exit(1);
  }
}

function isWithinThreshold(distance, name1, name2) {
  const maxLen = Math.max(name1.length, name2.length);
  const threshold = Math.max(5, Math.floor(maxLen * LEVENSHTEIN_THRESHOLD));
  return distance <= threshold;
}

/**
 * Load existing name_fixes.lua entries
 */
function loadExistingFixes() {
  const fixesPath = join(ROOT_DIR, 'backend', 'name_fixes.lua');
  const content = readFileSync(fixesPath, 'utf-8');

  const fixes = new Map();
  const regex = /\[(\d+)\]\s*=\s*"([^"]+)"/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    fixes.set(parseInt(match[1], 10), match[2]);
  }

  return fixes;
}

/**
 * Fetch HLTB Steam import data for a profile
 */
async function fetchSteamLibrary(profile) {
  const response = await fetch(HLTB_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://howlongtobeat.com/',
    },
    body: JSON.stringify({
      steamUserId: profile,
      steamOmitData: 0,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error);
  }

  if (!data.games || data.games.length === 0) {
    throw new Error(`Profile "${profile}" returned no games. Is it public?`);
  }

  return data.games;
}

/**
 * Main entry point
 */
async function main() {
  console.log('Name Fix Discovery & Validation Script');
  console.log('======================================\n');

  // Verify Lua is available
  const luaCmd = detectLua();
  if (!luaCmd) {
    console.error('Error: Neither luajit nor lua found in PATH');
    console.error('Install: scoop install luajit');
    process.exit(1);
  }
  console.log(`Using Lua interpreter: ${luaCmd}\n`);

  // Load existing fixes
  const existingFixes = loadExistingFixes();
  console.log(`Loaded ${existingFixes.size} existing name fixes\n`);

  // Fetch all profiles
  const allGames = new Map();

  for (const profile of PROFILES) {
    console.log(`Fetching profile: ${profile}...`);
    try {
      const games = await fetchSteamLibrary(profile);
      console.log(`  Found ${games.length} games`);

      for (const game of games) {
        if (!allGames.has(game.steam_id)) {
          allGames.set(game.steam_id, game);
        }
      }
    } catch (err) {
      console.error(`  Error: ${err.message}`);
    }
  }

  console.log(`\nTotal unique games: ${allGames.size}\n`);

  // Filter games that have HLTB data and no existing fix
  const gamesToProcess = [];
  for (const [steamId, game] of allGames) {
    if (game.hltb_id && game.hltb_id !== 0 && !existingFixes.has(steamId)) {
      gamesToProcess.push({
        steam_id: steamId,
        steam_name: game.steam_name,
        hltb_name: game.hltb_name,
      });
    }
  }

  console.log(`Processing ${gamesToProcess.length} games through Lua...\n`);

  // Batch process all games
  const processed = processGamesBatch(luaCmd, gamesToProcess);

  // ========================================
  // PHASE 1: Validate existing name_fixes
  // ========================================
  //
  // Compares name_fixes entries against the Steam import API's hltb_name field.
  //
  // KNOWN LIMITATION: The API's hltb_name is often just the Steam name echoed back,
  // not the actual HLTB game title. For example:
  //   - API hltb_name: "Borderlands GOTY Enhanced" (Steam's name)
  //   - Actual HLTB title: "Borderlands: Game of the Year"
  //   - Both work as search queries and find the same game (ID 1280)
  //
  // Proper validation would require HLTB search API calls for each fix (slow, rate-limited).
  // Deviations flagged here may be false positives - verify manually if needed.
  //
  console.log('='.repeat(50));
  console.log('PHASE 1: Validating existing name_fixes.lua');
  console.log('='.repeat(50) + '\n');

  // Process fixes through Lua for validation
  const fixesToValidate = [];
  for (const [appId, fixedName] of existingFixes) {
    const game = allGames.get(appId);
    if (game && game.hltb_name) {
      fixesToValidate.push({
        steam_id: appId,
        steam_name: fixedName,
        hltb_name: game.hltb_name,
      });
    }
  }

  const fixValidation = { correct: [], deviations: [], notInLibrary: [] };

  if (fixesToValidate.length > 0) {
    const fixResults = processGamesBatch(luaCmd, fixesToValidate);

    for (let i = 0; i < fixesToValidate.length; i++) {
      const fix = fixesToValidate[i];
      const result = fixResults[i];
      const distance = result.dist_sanitized;
      const matches = distance === 0 || isWithinThreshold(distance, fix.steam_name, fix.hltb_name);

      if (matches) {
        fixValidation.correct.push({ appId: fix.steam_id, fixedName: fix.steam_name, hltbName: fix.hltb_name, distance });
      } else {
        fixValidation.deviations.push({ appId: fix.steam_id, fixedName: fix.steam_name, hltbName: fix.hltb_name, distance });
      }
    }
  }

  for (const [appId, fixedName] of existingFixes) {
    const game = allGames.get(appId);
    if (!game || !game.hltb_name) {
      fixValidation.notInLibrary.push({ appId, fixedName });
    }
  }

  console.log(`Matches API hltb_name: ${fixValidation.correct.length}`);
  console.log(`Deviations from API: ${fixValidation.deviations.length}`);
  console.log(`Not in library: ${fixValidation.notInLibrary.length}`);

  if (fixValidation.deviations.length > 0) {
    console.log('\nDEVIATIONS (may be false positives - see note above):');
    for (const fix of fixValidation.deviations) {
      console.log(`  [${fix.appId}]`);
      console.log(`    Our fix:       "${fix.fixedName}"`);
      console.log(`    API hltb_name: "${fix.hltbName}"`);
      console.log(`    Distance: ${fix.distance}`);
    }
  }

  // ========================================
  // PHASE 2: Find games needing new fixes
  // ========================================
  console.log('\n' + '='.repeat(50));
  console.log('PHASE 2: Games needing new name_fixes');
  console.log('='.repeat(50) + '\n');

  // Find games where neither sanitize nor simplify matches
  const needsFix = [];
  for (let i = 0; i < gamesToProcess.length; i++) {
    const game = gamesToProcess[i];
    const result = processed[i];

    const sanitizedMatches = result.dist_sanitized === 0 || isWithinThreshold(result.dist_sanitized, result.sanitized, game.hltb_name);
    const simplifiedMatches = result.dist_simplified === 0 || isWithinThreshold(result.dist_simplified, result.simplified, game.hltb_name);

    if (!sanitizedMatches && !simplifiedMatches) {
      needsFix.push({
        steamId: game.steam_id,
        steamName: game.steam_name,
        hltbName: game.hltb_name,
        sanitized: result.sanitized,
        simplified: result.simplified,
        distSanitized: result.dist_sanitized,
        distSimplified: result.dist_simplified,
      });
    }
  }

  if (needsFix.length === 0) {
    console.log('No new fixes needed!');
  } else {
    console.log(`Found ${needsFix.length} games needing fixes:\n`);

    needsFix.sort((a, b) => a.steamId - b.steamId);

    console.log('Suggested name_fixes.lua entries:');
    console.log('-'.repeat(40) + '\n');

    for (const fix of needsFix) {
      const escapedName = fix.hltbName.replace(/"/g, '\\"');
      console.log(`    [${fix.steamId}] = "${escapedName}",`);
    }

    console.log('\n\nDetailed breakdown:');
    console.log('-'.repeat(40) + '\n');

    for (const fix of needsFix) {
      console.log(`AppID ${fix.steamId}:`);
      console.log(`  Steam:      "${fix.steamName}"`);
      console.log(`  Sanitized:  "${fix.sanitized}" (dist: ${fix.distSanitized})`);
      if (fix.simplified !== fix.sanitized) {
        console.log(`  Simplified: "${fix.simplified}" (dist: ${fix.distSimplified})`);
      }
      console.log(`  HLTB:       "${fix.hltbName}"`);
      console.log();
    }
  }

  // ========================================
  // Summary
  // ========================================
  console.log('\n' + '='.repeat(50));
  console.log('SUMMARY');
  console.log('='.repeat(50) + '\n');

  console.log(`Total games analyzed: ${allGames.size}`);
  console.log(`Existing name_fixes: ${existingFixes.size} (${fixValidation.correct.length} match API, ${fixValidation.deviations.length} deviations)`);
  console.log(`Games needing new fixes: ${needsFix.length}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
