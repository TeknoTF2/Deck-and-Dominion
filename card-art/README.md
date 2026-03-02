# Card Art Directory

This directory stores card art organized by class. Each subfolder corresponds to a class.

## Directory Structure

```
card-art/
  commander/    - Commander class card art
  dps/          - DPS class card art
  wizard/       - Wizard class card art
  sorcerer/     - Sorcerer class card art
  crafter/      - Crafter class card art
```

## How to Add Card Art

### Option 1: Web UI (Recommended)
1. Start the server (`npm run dev`)
2. Open the app in your browser
3. Click "Card Art Manager" from the main menu
4. Select a class tab
5. Drag and drop JPG/PNG files onto any card, or click the drop zone to browse

### Option 2: Manual File Drop
1. Name your image file with the card's ID (e.g., `cmd_rally_001.jpg`)
2. Drop it into the appropriate class folder (e.g., `card-art/commander/`)
3. Run `npm run seed` to update the database with art paths

### Supported Formats
- JPG / JPEG
- PNG
- GIF
- WebP

### Naming Convention
Files should be named: `{card_id}.{ext}`
Example: `cmd_rally_001.jpg`, `dps_goblin_scout_001.png`

Card IDs can be found in the Card Art Manager web UI or in the JSON files under `server/data/cards/`.
