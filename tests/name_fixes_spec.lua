--[[
    Name Fixes Validation Tests

    Ensures name_fixes.lua is valid Lua and contains proper mappings.

    Run with: busted tests/
]]

package.path = package.path .. ";backend/?.lua"

describe("name_fixes.lua", function()
    local name_fixes
    local file_content

    -- Read file content for duplicate detection
    setup(function()
        local file = io.open("backend/name_fixes.lua", "r")
        if file then
            file_content = file:read("*all")
            file:close()
        end
    end)

    it("loads without syntax errors", function()
        local ok, result = pcall(require, "name_fixes")
        assert.is_true(ok, "Failed to load name_fixes.lua: " .. tostring(result))
        name_fixes = result
    end)

    it("returns a table", function()
        assert.is_table(name_fixes, "name_fixes.lua should return a table")
    end)

    it("contains only string keys and string values", function()
        for key, value in pairs(name_fixes) do
            assert.is_string(key, "Key should be a string: " .. tostring(key))
            assert.is_string(value, "Value should be a string for key: " .. key)
        end
    end)

    it("has no empty keys or values", function()
        for key, value in pairs(name_fixes) do
            assert.is_true(#key > 0, "Key should not be empty")
            assert.is_true(#value > 0, "Value should not be empty for key: " .. key)
        end
    end)

    it("has no no-op mappings (key equals value)", function()
        for key, value in pairs(name_fixes) do
            assert.are_not_equal(key, value,
                "No-op mapping found: \"" .. key .. "\" maps to itself")
        end
    end)

    it("has no duplicate keys", function()
        assert.is_not_nil(file_content, "Could not read name_fixes.lua")

        local keys_seen = {}
        local duplicates = {}

        -- Match keys in the format ["key"]
        for key in file_content:gmatch('%[%"([^"]+)%"%]%s*=') do
            if keys_seen[key] then
                table.insert(duplicates, key)
            else
                keys_seen[key] = true
            end
        end

        assert.are_equal(0, #duplicates,
            "Duplicate keys found: " .. table.concat(duplicates, ", "))
    end)

    it("has keys in alphabetical order", function()
        assert.is_not_nil(file_content, "Could not read name_fixes.lua")

        local keys = {}
        for key in file_content:gmatch('%[%"([^"]+)%"%]%s*=') do
            table.insert(keys, key)
        end

        for i = 2, #keys do
            local prev, curr = keys[i-1], keys[i]
            assert.is_true(prev:lower() <= curr:lower(),
                "Keys not sorted: \"" .. prev .. "\" should come after \"" .. curr .. "\"")
        end
    end)
end)
