--[[
    CLI wrapper for hltb_utils.lua functions.
    Called by discover-name-fixes.js via luajit.

    Usage:
        luajit scripts/name-utils-cli.lua sanitize "Game Name™"
        luajit scripts/name-utils-cli.lua simplify "Game Name: Enhanced Edition"
        luajit scripts/name-utils-cli.lua levenshtein "string1" "string2"
]]

package.path = package.path .. ";backend/?.lua"
local utils = require("hltb_utils")

local command = arg[1]
local input = arg[2]

if not command or not input then
    io.stderr:write("Usage: luajit name-utils-cli.lua <command> <input> [input2]\n")
    io.stderr:write("Commands: sanitize, simplify, levenshtein\n")
    os.exit(1)
end

if command == "sanitize" then
    print(utils.sanitize_game_name(input))
elseif command == "simplify" then
    print(utils.simplify_game_name(input))
elseif command == "levenshtein" then
    local s2 = arg[3]
    if not s2 then
        io.stderr:write("levenshtein requires two strings\n")
        os.exit(1)
    end
    print(utils.levenshtein_distance(input, s2))
else
    io.stderr:write("Unknown command: " .. command .. "\n")
    os.exit(1)
end
