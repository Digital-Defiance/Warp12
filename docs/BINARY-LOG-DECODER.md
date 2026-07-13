# Binary Log Decoder

A command-line tool to convert binary-encoded debug exports back to human-readable formats for AI analysis and debugging.

## Overview

When you click "Export debug log" in the Options menu, Warp 12 now exports matches with binary-encoded action logs (~600 bytes for 200 actions instead of ~30KB+ JSON). This tool decodes those binary logs back to verbose formats that can be fed into AI assistants or used for debugging.

## Installation

No installation needed - the tool is part of the Warp 12 repo.

## Usage

```bash
yarn decode-log <input.json> [options]
```

### Options

- `--format <json|text>` - Output format (default: json)
  - `json`: Verbose JSON with full action objects
  - `text`: Human-readable text log with action descriptions
- `--round <number>` - Extract specific round only (default: all rounds)
- `--output <file>` - Write to file instead of stdout

### Examples

#### 1. Convert to Verbose JSON (for AI analysis)

```bash
yarn decode-log warp12-ABCD-2026-07-13-10-30-45.json --format json > verbose.json
```

Output: Full JSON array of GameAction objects that can be fed into AI for analysis.

#### 2. Extract Specific Round as Text

```bash
yarn decode-log debug-export.json --format text --round 3
```

Output: Human-readable text log of round 3 only.

#### 3. Full Text Log for Debugging

```bash
yarn decode-log debug-export.json --format text > full-log.txt
```

Output: Complete text narrative of the entire match.

#### 4. Extract Round to JSON File

```bash
yarn decode-log debug-export.json --format json --round 5 --output round5.json
```

Output: round5.json contains verbose JSON for round 5 only.

## Output Formats

### JSON Format

Verbose JSON array of GameAction objects:

```json
[
  {
    "type": "CHART_COORDINATE",
    "playerId": "armstrong",
    "coordinate": { "low": 6, "high": 6 },
    "route": { "kind": "warp-trail", "playerId": "armstrong" }
  },
  {
    "type": "DRAW_FROM_UNCHARTED",
    "playerId": "lovell"
  },
  ...
]
```

Perfect for AI analysis, programmatic processing, or debugging specific actions.

### Text Format

Human-readable log with action descriptions:

```
=== Match Action Log ===

   1. CHART_COORDINATE by Armstrong - 6:6 on warp-trail
   2. DRAW_FROM_UNCHARTED by Lovell
   3. CHART_COORDINATE by Nguyen - 6:9 on neutral-zone
   4. CHART_COORDINATE by Smith - 9:12 on warp-trail
   5. END_ROUND - Armstrong wins
────────────────────────────────────────────────────────────

   6. CHART_COORDINATE by Lovell - 11:11 on warp-trail
   ...
```

Perfect for quickly understanding match flow or feeding into AI for narrative analysis.

## Feeding to AI

### For Code Analysis

```bash
yarn decode-log debug-export.json --format json > verbose.json
```

Then paste verbose.json into your AI assistant with a prompt like:

> "Analyze this Warp 12 match log. Look for: 1) Tactical mistakes, 2) Optimal play sequences, 3) Module usage patterns."

### For Narrative Analysis

```bash
yarn decode-log debug-export.json --format text > narrative.txt
```

Then paste narrative.txt into your AI assistant with a prompt like:

> "Summarize this dominoes match. Who played well? What were the key moments?"

### For Specific Round Analysis

```bash
yarn decode-log debug-export.json --format json --round 8 > round8.json
```

Then:

> "This is round 8 of a match. Analyze Armstrong's play - did they miss any opportunities?"

## Technical Details

### Binary Format

The binary log uses compact encoding:
- **Action codes:** 1 byte (0x01-0x0F for 15 action types)
- **Coordinates:** 1 byte (low * 13 + high, supports Warp 9-15)
- **Player IDs:** 1 byte index (0-63 players)
- **Routes:** 1 byte packed encoding
- **Full action:** 2-5 bytes each

Compression: **50-500x** vs JSON.

### Metadata Included

The binary log export includes:
- `format`: 'binary-v1'
- `encoding`: 'base64'
- `data`: base64-encoded binary data
- `actionCount`: Number of actions
- `byteSize`: Size in bytes
- `playerIds`: Array of player IDs (for decoding)
- `maxPip`: Max pip value (9/12/15/18 for Warp factor)

### Round Boundaries

Rounds are detected by `END_ROUND` actions. The decoder automatically tracks round numbers and can extract specific rounds.

## Troubleshooting

### "No binary action log found"

The export file doesn't contain a binary log. Make sure you're using a debug export from the latest version of Warp 12 (after binary encoding was implemented).

### "Round X not found"

The match didn't have X rounds. Check the text output to see how many rounds were played:

```bash
yarn decode-log debug-export.json --format text | grep "END_ROUND"
```

### Tool not found

Make sure you're running from the Warp 12 repo root and have run `yarn install`.

## See Also

- **Binary Encoding Status:** `/docs/BINARY-ENCODING-STATUS.md`
- **Action Encoding Spec:** `/libs/engine/src/lib/serialization/`
- **Debug Export Code:** `/apps/Warp12/src/game/debug-export.ts`
