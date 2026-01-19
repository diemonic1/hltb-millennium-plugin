--[[
    Batch processor for name matching.

    Reads JSON game list from stdin, runs each through sanitize/simplify,
    computes Levenshtein distances, and outputs results as JSON.

    This ensures the discovery script uses the exact same matching logic
    as the plugin at runtime.

    Input:  {"games": [{"steam_name": "...", "hltb_name": "..."}, ...]}
    Output: [{"sanitized": "...", "simplified": "...", "dist_sanitized": N, "dist_simplified": N}, ...]
]]

package.path = package.path .. ";backend/?.lua"
local utils = require("hltb_utils")
local json = require("dkjson")

local input_json = io.read("*a")
local input, err = json.decode(input_json)
if not input then
    io.stderr:write("Invalid JSON: " .. (err or "unknown error") .. "\n")
    os.exit(1)
end

local results = {}
for i, entry in ipairs(input.games) do
    local steam_name = entry.steam_name
    local hltb_name = entry.hltb_name

    local sanitized = utils.sanitize_game_name(steam_name)
    local simplified = utils.simplify_game_name(sanitized)

    local dist_sanitized = utils.levenshtein_distance(sanitized:lower(), hltb_name:lower())
    local dist_simplified = utils.levenshtein_distance(simplified:lower(), hltb_name:lower())

    results[i] = {
        sanitized = sanitized,
        simplified = simplified,
        dist_sanitized = dist_sanitized,
        dist_simplified = dist_simplified,
    }
end

print(json.encode(results))
