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

    it("contains only number keys (AppIDs) and string values", function()
        for key, value in pairs(name_fixes) do
            assert.is_number(key, "Key should be a number (AppID): " .. tostring(key))
            assert.is_string(value, "Value should be a string for AppID: " .. tostring(key))
        end
    end)

    it("has no empty values", function()
        for key, value in pairs(name_fixes) do
            assert.is_true(#value > 0, "Value should not be empty for AppID: " .. tostring(key))
        end
    end)

    it("has no duplicate keys", function()
        assert.is_not_nil(file_content, "Could not read name_fixes.lua")

        local keys_seen = {}
        local duplicates = {}

        -- Match keys in the format [12345]
        for key in file_content:gmatch('%[(%d+)%]%s*=') do
            if keys_seen[key] then
                table.insert(duplicates, key)
            else
                keys_seen[key] = true
            end
        end

        assert.are_equal(0, #duplicates,
            "Duplicate AppIDs found: " .. table.concat(duplicates, ", "))
    end)

    it("has keys in numerical order", function()
        assert.is_not_nil(file_content, "Could not read name_fixes.lua")

        local keys = {}
        for key in file_content:gmatch('%[(%d+)%]%s*=') do
            table.insert(keys, tonumber(key))
        end

        for i = 2, #keys do
            local prev, curr = keys[i-1], keys[i]
            assert.is_true(prev <= curr,
                "AppIDs not sorted: " .. tostring(prev) .. " should come before " .. tostring(curr))
        end
    end)
end)
