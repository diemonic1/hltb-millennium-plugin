/**
 * Name Fix Discovery & Validation Script
 *
 * Fetches Steam libraries via HLTB API and:
 * 1. Validates existing name_fixes.lua entries
 * 2. Analyzes sanitize vs simplify effectiveness
 * 3. Identifies games needing new fixes
 *
 * Usage: node scripts/discover-name-fixes.js
 *
 * Requirements:
 *   - luajit or lua in PATH
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
  // Add more public profiles for broader coverage
];

const HLTB_API_URL = 'https://howlongtobeat.com/api/steam/getSteamImportData';
const LEVENSHTEIN_THRESHOLD = 0.2; // 20% of name length

// Detect available Lua interpreter
let LUA_CMD = null;

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
 * Call Lua function via CLI
 */
function callLua(command, ...args) {
  const luaScript = join(ROOT_DIR, 'scripts', 'name-utils-cli.lua');
  const escapedArgs = args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ');
  const cmd = `${LUA_CMD} "${luaScript}" ${command} ${escapedArgs}`;

  try {
    const result = execSync(cmd, { cwd: ROOT_DIR, encoding: 'utf-8' });
    return result.trim();
  } catch (err) {
    console.error(`Lua call failed: ${cmd}`);
    console.error(err.message);
    process.exit(1);
  }
}

function sanitize(name) {
  return callLua('sanitize', name);
}

function simplify(name) {
  return callLua('simplify', name);
}

function levenshtein(s1, s2) {
  return parseInt(callLua('levenshtein', s1, s2), 10);
}

/**
 * Check if distance is within threshold
 */
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
 * Main
 */
async function main() {
  console.log('Name Fix Discovery & Validation Script');
  console.log('======================================\n');

  // Verify Lua is available
  LUA_CMD = detectLua();
  if (!LUA_CMD) {
    console.error('Error: Neither luajit nor lua found in PATH');
    console.error('Install LuaJIT: https://luajit.org/download.html');
    process.exit(1);
  }
  console.log(`Using Lua interpreter: ${LUA_CMD}\n`);

  // Load existing fixes
  const existingFixes = loadExistingFixes();
  console.log(`Loaded ${existingFixes.size} existing name fixes\n`);

  // Fetch all profiles
  const allGames = new Map(); // steam_id -> game data

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

  const fixValidation = {
    correct: [],
    deviations: [],
    notInLibrary: [],
  };

  for (const [appId, fixedName] of existingFixes) {
    const game = allGames.get(appId);
    if (!game) {
      fixValidation.notInLibrary.push({ appId, fixedName });
      continue;
    }

    const hltbName = game.hltb_name;
    const distance = levenshtein(fixedName.toLowerCase(), hltbName.toLowerCase());
    const matches = distance === 0 || isWithinThreshold(distance, fixedName, hltbName);

    if (matches) {
      fixValidation.correct.push({ appId, fixedName, hltbName, distance });
    } else {
      fixValidation.deviations.push({ appId, fixedName, hltbName, distance });
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
  // PHASE 2: Analyze sanitize vs simplify
  // ========================================
  //
  // The main code searches with sanitize(name) first, then falls back to simplify(sanitize(name)).
  // This analysis validates that approach by categorizing games:
  //
  // Case A: Both match - no problem either way
  // Case B: Sanitize matches, simplify BREAKS - proves we can't always simplify
  //   Examples: "Baldur's Gate: Enhanced Edition", "BioShock Remastered"
  //   HLTB uses the full name with suffix, so stripping it would break matching.
  // Case C: Sanitize fails, simplify HELPS - proves simplify is needed as fallback
  //   Examples: "Artifact Classic" -> "Artifact", "Company of Heroes - Legacy Edition" -> "Company of Heroes"
  //   HLTB omits the suffix, so stripping it helps find the match.
  // Case D: Neither matches - needs manual name_fix entry
  //
  console.log('\n' + '='.repeat(50));
  console.log('PHASE 2: Analyzing sanitize vs simplify');
  console.log('='.repeat(50) + '\n');

  const cases = {
    A: [], // Both match
    B: [], // Sanitize matches, simplify breaks
    C: [], // Sanitize fails, simplify helps
    D: [], // Neither matches (needs fix)
  };

  let skippedNoHltb = 0;
  let skippedHasFix = 0;

  for (const [steamId, game] of allGames) {
    // Skip games not on HLTB
    if (!game.hltb_id || game.hltb_id === 0) {
      skippedNoHltb++;
      continue;
    }

    // Skip games with existing fixes (they bypass this logic)
    if (existingFixes.has(steamId)) {
      skippedHasFix++;
      continue;
    }

    const steamName = game.steam_name;
    const hltbName = game.hltb_name;

    const sanitized = sanitize(steamName);
    const simplified = simplify(sanitized);

    const distSanitized = levenshtein(sanitized.toLowerCase(), hltbName.toLowerCase());
    const distSimplified = levenshtein(simplified.toLowerCase(), hltbName.toLowerCase());

    const sanitizedMatches = distSanitized === 0 || isWithinThreshold(distSanitized, sanitized, hltbName);
    const simplifiedMatches = distSimplified === 0 || isWithinThreshold(distSimplified, simplified, hltbName);

    const entry = {
      steamId,
      steamName,
      hltbName,
      sanitized,
      simplified,
      distSanitized,
      distSimplified,
    };

    if (sanitizedMatches && simplifiedMatches) {
      cases.A.push(entry);
    } else if (sanitizedMatches && !simplifiedMatches) {
      cases.B.push(entry);
    } else if (!sanitizedMatches && simplifiedMatches) {
      cases.C.push(entry);
    } else {
      cases.D.push(entry);
    }
  }

  console.log('Case Analysis (games without name_fixes):');
  console.log(`  Case A (both match):        ${cases.A.length}`);
  console.log(`  Case B (simplify BREAKS):   ${cases.B.length} ← CRITICAL if > 0`);
  console.log(`  Case C (simplify helps):    ${cases.C.length}`);
  console.log(`  Case D (neither, needs fix): ${cases.D.length}`);
  console.log(`  Skipped (not on HLTB):      ${skippedNoHltb}`);
  console.log(`  Skipped (has name_fix):     ${skippedHasFix}`);

  if (cases.B.length > 0) {
    console.log('\n*** CRITICAL: Case B games (simplify would BREAK matching) ***');
    for (const entry of cases.B) {
      console.log(`  [${entry.steamId}] ${entry.steamName}`);
      console.log(`    Sanitized:  "${entry.sanitized}" (dist: ${entry.distSanitized}) ✓`);
      console.log(`    Simplified: "${entry.simplified}" (dist: ${entry.distSimplified}) ✗`);
      console.log(`    HLTB:       "${entry.hltbName}"`);
    }
    console.log('\n*** Cannot simplify code - simplify() breaks some matches ***');
  } else {
    console.log('\n✓ No Case B found - safe to always use simplify(sanitize(name))');
  }

  if (cases.C.length > 0) {
    console.log(`\nCase C examples (simplify helps - first 5):`);
    for (const entry of cases.C.slice(0, 5)) {
      console.log(`  [${entry.steamId}] ${entry.steamName}`);
      console.log(`    Sanitized:  "${entry.sanitized}" (dist: ${entry.distSanitized})`);
      console.log(`    Simplified: "${entry.simplified}" (dist: ${entry.distSimplified})`);
      console.log(`    HLTB:       "${entry.hltbName}"`);
    }
  }

  // ========================================
  // PHASE 3: Find games needing new fixes
  // ========================================
  console.log('\n' + '='.repeat(50));
  console.log('PHASE 3: Games needing new name_fixes');
  console.log('='.repeat(50) + '\n');

  const needsFix = cases.D;

  if (needsFix.length === 0) {
    console.log('No new fixes needed!');
  } else {
    console.log(`Found ${needsFix.length} games needing fixes:\n`);

    // Sort by steam_id
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
  console.log(`Games handled automatically: ${cases.A.length + cases.C.length}`);
  console.log(`Games needing new fixes: ${needsFix.length}`);
  console.log(`Safe to simplify code: ${cases.B.length === 0 ? 'YES' : 'NO'}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
