--[[
    SteamHunters API Unit Tests

    Tests for fallback API functionality.
    Run with: busted tests/steamhunters_spec.lua
]]

package.path = package.path .. ";backend/?.lua"

local json = require("dkjson")

-- Mock dependencies
package.loaded["json"] = json
package.loaded["http"] = { get = function() return nil, "No mock configured" end }

-- Mock HTTP factory (copied from steam_spec.lua pattern)
local function create_mock_http(responses)
    return {
        get = function(url, opts)
            local mock = responses[url]
            if not mock then
                return nil, "No mock for URL: " .. url
            end
            if mock.error then
                return nil, mock.error
            end
            return {
                status = mock.status or 200,
                body = mock.body
            }
        end
    }
end

describe("steamhunters", function()
    local sh

    before_each(function()
        package.loaded["steamhunters"] = nil
        sh = require("steamhunters")
    end)

    describe("build_url", function()
        it("constructs correct URL", function()
            local url = sh.build_url(1004640)
            assert.equals("https://steamhunters.com/api/apps/1004640", url)
        end)
    end)

    describe("parse_response", function()
        it("extracts name from valid response", function()
            local data = { id = 1004640, name = "Final Fantasy Tactics" }
            local name, err = sh.parse_response(data)
            assert.is_nil(err)
            assert.equals("Final Fantasy Tactics", name)
        end)

        it("returns error if name is missing", function()
            local data = { id = 1004640, description = "No name here" }
            local name, err = sh.parse_response(data)
            assert.is_nil(name)
            assert.equals("Name field missing in response", err)
        end)

        it("returns error on nil data", function()
            local name, err = sh.parse_response(nil)
            assert.is_nil(name)
            assert.equals("No data", err)
        end)
    end)

    describe("get_game_name", function()
        it("returns game name on success", function()
            local mock_response = { id = 123, name = "Test Game" }
            sh._http = create_mock_http({
                ["https://steamhunters.com/api/apps/123"] = {
                    status = 200,
                    body = json.encode(mock_response)
                }
            })

            local name, err = sh.get_game_name(123)
            assert.is_nil(err)
            assert.equals("Test Game", name)
        end)

        it("returns error on HTTP 404", function()
            sh._http = create_mock_http({
                ["https://steamhunters.com/api/apps/999"] = {
                    status = 404,
                    body = "Not found"
                }
            })

            local name, err = sh.get_game_name(999)
            assert.is_nil(name)
            assert.equals("HTTP 404", err)
        end)

        it("returns error on network fail", function()
            sh._http = create_mock_http({
                ["https://steamhunters.com/api/apps/123"] = { error = "Timeout" }
            })
            local name, err = sh.get_game_name(123)
            assert.is_nil(name)
            assert.matches("Request failed", err)
        end)

        it("returns error when API returns null for non-existent game", function()
            sh._http = create_mock_http({
                ["https://steamhunters.com/api/apps/7363"] = {
                    status = 200,
                    body = "null"
                }
            })
            local name, err = sh.get_game_name(7363)
            assert.is_nil(name)
            assert.equals("Game not found", err)
        end)
    end)
end)
