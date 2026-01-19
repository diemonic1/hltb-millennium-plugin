---
name: name-fix-review
description: Reviews name_fixes.lua for duplicates, then removes them. Ensures numerical sort order.
allowed-tools: Read, Edit, Bash
---

# Name Fix Review

Cleans up `backend/name_fixes.lua` by removing duplicates and ensuring numerical sort order.

## Instructions

### Step 1: Run tests to check current state

```bash
cmd //c "busted tests/name_fixes_spec.lua"
```

Report whether tests pass or fail.

If busted is not available, see `docs/development.md` section "Running Lua Tests" for setup instructions.

### Step 2: Read and parse the file

1. Read `backend/name_fixes.lua`
2. Parse each mapping line to extract AppID and HLTB name
3. Identify issues:
   - Duplicates: Same AppID appearing more than once (keep first occurrence)

Note: No-ops are not possible with AppID-based keys (the key is a number, the value is a string).

### Step 3: Remove duplicates (if any)

Use targeted Edit operations to remove duplicate lines (keep the first occurrence).

IMPORTANT: Only use Edit to delete problematic lines. Do not rewrite content.

### Step 4: Verify numerical sort order

Check that AppIDs are in ascending numerical order. If not sorted:

Use this bash pipeline to sort numerically while preserving exact bytes:

```bash
head -n 6 backend/name_fixes.lua > backend/name_fixes_sorted.lua && \
grep '^\s*\[' backend/name_fixes.lua | sort -t'[' -k2 -n >> backend/name_fixes_sorted.lua && \
echo "}" >> backend/name_fixes_sorted.lua && \
mv backend/name_fixes_sorted.lua backend/name_fixes.lua
```

### Step 5: Verify

Run tests again to confirm the file is valid:

```bash
cmd //c "busted tests/name_fixes_spec.lua"
```

## Output Format

```
Running tests...
[PASS/FAIL]

Found N issue(s):
- Removed duplicate: AppID {id}

Sorted N entries numerically.

Verifying...
[PASS]

Done.
```

If no issues found and already sorted, report "No changes needed."
