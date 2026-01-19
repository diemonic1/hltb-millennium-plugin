--[[
    HLTB for Millennium - Plugin Entry Point

    Displays How Long To Beat completion times on Steam game pages.
]]

local logger = require("logger")
local millennium = require("millennium")
local json = require("json")
local hltb = require("hltb")
local steam = require("steam")
local steamhunters = require("steamhunters")
local utils = require("hltb_utils")
local name_fixes = require("name_fixes")

-- Get game name with optional fallback sources
local function get_game_name(app_id)
    -- 1. Try first-party Steam API
    local name, err = steam.get_game_name(app_id)
    if name then 
        return name 
    end

    logger:info("Steam API failed for " .. tostring(app_id) .. ": " .. (err or "unknown") .. ". Trying fallback...")

    -- 2. Fall back to SteamHunters
    local sh_name, sh_err = steamhunters.get_game_name(app_id)
    if sh_name then
        logger:info("Fallback successful: Found via SteamHunters")
        return sh_name
    end
    
    return nil, "All sources failed. Steam: " .. (err or "nil") .. ", SH: " .. (sh_err or "nil")
end

-- Main function called by frontend
function GetHltbData(app_id)
    local success, result = pcall(function()
        logger:info("GetHltbData called for app_id: " .. tostring(app_id))

        -- Check for AppID-based name fix first
        local fixed_name = name_fixes[app_id]
        local search_name

        if fixed_name then
            logger:info("Name fix (AppID " .. tostring(app_id) .. "): " .. fixed_name)
            search_name = fixed_name
        else
            -- No fix, get name from Steam
            local game_name, name_err = get_game_name(app_id)
            if not game_name then
                logger:error("Could not get game name: " .. (name_err or "unknown"))
                return json.encode({ success = false, error = "Could not get game name" })
            end

            logger:info("Raw name: " .. game_name)

            -- Sanitize (removes ™, ®, etc.)
            search_name = utils.sanitize_game_name(game_name)
            if search_name ~= game_name then
                logger:info("Sanitized: " .. search_name)
            end
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
