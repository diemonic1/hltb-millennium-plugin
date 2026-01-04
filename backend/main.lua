--[[
    HLTB for Millennium - Plugin Entry Point

    Displays How Long To Beat completion times on Steam game pages.
]]

local logger = require("logger")
local millennium = require("millennium")
local json = require("json")
local hltb = require("hltb")
local steam = require("steam")
local utils = require("hltb_utils")
local name_fixes = require("name_fixes")

-- Main function called by frontend
function GetHltbData(app_id)
    local success, result = pcall(function()
        logger:info("GetHltbData called for app_id: " .. tostring(app_id))

        -- Get game name from Steam
        local game_name, name_err = steam.get_game_name(app_id)
        if not game_name then
            logger:error("Could not get game name: " .. (name_err or "unknown"))
            return json.encode({ success = false, error = "Could not get game name" })
        end

        logger:info("Got game name: " .. game_name)

        -- Sanitize first (removes ™, ®, etc.)
        local search_name = utils.sanitize_game_name(game_name)
        if search_name ~= game_name then
            logger:info("Sanitized to: " .. search_name)
        end

        -- Apply manual name fix if available
        local fixed_name = name_fixes[search_name]
        if fixed_name then
            logger:info("Applied name fix: " .. fixed_name)
            search_name = fixed_name
        end

        -- Search HLTB
        local match = hltb.search_best_match(search_name, app_id)
        if not match then
            logger:info("No HLTB results for: " .. search_name)
            return json.encode({
                success = true,
                data = { searched_name = search_name }
            })
        end

        local similarity = utils.calculate_similarity(search_name, match.game_name)
        logger:info("Found match: " .. (match.game_name or "unknown") .. " (id: " .. tostring(match.game_id) .. ", similarity: " .. tostring(similarity) .. ")")

        return json.encode({
            success = true,
            data = {
                searched_name = search_name,
                game_id = match.game_id,
                game_name = match.game_name,
                comp_main = utils.seconds_to_hours(match.comp_main),
                comp_plus = utils.seconds_to_hours(match.comp_plus),
                comp_100 = utils.seconds_to_hours(match.comp_100)
            }
        })
    end)

    if not success then
        logger:error("GetHltbData error: " .. tostring(result))
        return json.encode({ success = false, error = tostring(result) })
    end

    return result
end

-- Plugin lifecycle
local function on_load()
    logger:info("HLTB plugin loaded, Millennium " .. millennium.version())
    millennium.ready()
end

local function on_frontend_loaded()
    logger:info("HLTB: Frontend loaded")
end

local function on_unload()
    logger:info("HLTB plugin unloaded")
end

return {
    on_load = on_load,
    on_frontend_loaded = on_frontend_loaded,
    on_unload = on_unload,
    GetHltbData = GetHltbData
}
