# Deck & Dominion - AI Assistant Guide

## Project Overview
Deck & Dominion is a cooperative deckbuilding TTRPG card game where players work together against a Dungeon Master (DM). All conflict is resolved through card games on a shared board with shared resources.

## Tech Stack
- **Monorepo** with npm workspaces: `shared/`, `server/`, `client/`
- **Server**: Node.js + Express + Socket.IO (TypeScript)
- **Client**: React + Vite + Zustand (TypeScript)
- **Database**: SQLite via better-sqlite3
- **Real-time**: Socket.IO for multiplayer

## Project Structure
```
/
├── shared/          # Shared types, constants, enums
│   └── src/types.ts # All game type definitions
├── server/
│   ├── src/
│   │   ├── index.ts           # Express + Socket.IO server entry
│   │   ├── database/
│   │   │   ├── setup.ts       # SQLite schema + initialization
│   │   │   ├── cards.ts       # Card CRUD operations
│   │   │   └── seed.ts        # Load JSON card data into DB
│   │   ├── game/
│   │   │   └── GameEngine.ts  # Core game state + combat logic
│   │   ├── lobby/
│   │   │   └── LobbyManager.ts # Lobby creation/joining
│   │   └── routes/
│   │       ├── cards.ts       # Card API endpoints
│   │       ├── cardArt.ts     # Card art upload/serve endpoints
│   │       └── decks.ts       # Deck CRUD endpoints
│   └── data/cards/            # JSON card definitions by class
├── client/
│   └── src/
│       ├── App.tsx            # Root with view routing
│       ├── store/gameStore.ts # Zustand state management
│       └── components/
│           ├── Board/         # Game board, combat log
│           ├── Card/          # Card display, detail modal
│           ├── DeckBuilder/   # Deck builder, collection view
│           ├── GameHUD/       # HP, mana, turn info
│           ├── Lobby/         # Main menu, lobby view
│           └── CardArtManager/# Drag-and-drop card art uploads
└── card-art/                  # Card art organized by class
    ├── commander/
    ├── dps/
    ├── wizard/
    ├── sorcerer/
    └── crafter/
```

## Development Commands
```bash
npm install          # Install all workspace dependencies
npm run dev          # Start both server (port 3000) and client (port 5173)
npm run dev:server   # Start only the server with hot reload
npm run dev:client   # Start only the Vite client dev server
npm run build        # Build shared types, server, and client
npm run seed         # Seed the database with card data from JSON files
```

## Game Design (Key Concepts)

### Authoritative Documents (Priority Order)
1. `Complete Feature List.pdf` - **PRIMARY** technical spec (prioritize over rulebook)
2. `deck-and-dominion-rulebook.pdf` - Player-facing rules (secondary)
3. Class base set PDFs - Card definitions for each of the 5 classes

### Classes (5)
- **Commander** (White): Tank/support, buffs, shields, team coordination
- **DPS** (Red): Damage dealer, creatures, aggression
- **Wizard** (Blue): Combo engine, spells, counters, keywords
- **Sorcerer** (Black): Graveyard master, resurrection, sacrifice, curses
- **Crafter** (Green): Economy builder, equipment, mana generation

### Archetypes (3 per class)
- Commander: Marshal, Tactician, Warden
- DPS: Swarm, Big, Undead
- Wizard: Enchanter, Illusionist, Abjurer
- Sorcerer: Necromancer, Dark Ritualist, Hexer
- Crafter: Blacksmith, Farmer, Alchemist

### Key Mechanics
- **Shared Resources**: Party HP pool (8 per player), shared mana, shared board, shared graveyard
- **Turn Phases**: Draw → Mana → Play → Attack → Resolution → End
- **Deck Limits**: 30-60 cards, max hand size 8, start with 5
- **Combat**: Taunt → First Strike → Simultaneous damage, Trample, Deathtouch, Lifelink, Poison, Shield
- **Reactions**: 1 per trigger, hold mana for DM turn
- **DM Turn**: Draws/lands equal to player count, automated AI or manual DM control

## Card Data
Card definitions live in `server/data/cards/` as JSON files, one per class:
- `commander.json`, `dps.json`, `wizard.json`, `sorcerer.json`, `crafter.json`

Card IDs follow the pattern: `{prefix}_{snake_case_name}_{number}`
- Commander: `cmd_`, DPS: `dps_`, Wizard: `wiz_`, Sorcerer: `src_`, Crafter: `crf_`

## Card Art System
Art is stored in `card-art/{class}/` directories. The web UI provides drag-and-drop upload.
Files are named by card ID: `{card_id}.{jpg|png|gif|webp}`

## API Endpoints
- `GET /api/cards` - List all cards (query: `?cardClass=`, `?rarity=`, `?search=`)
- `GET /api/cards/:id` - Get single card
- `GET /api/cards/stats` - Card count statistics
- `POST /api/card-art/:cardId` - Upload card art (multipart form)
- `GET /api/card-art/:cardId` - Get card art image
- `GET /api/card-art/class/:class` - List art status for a class
- `GET/POST/PUT/DELETE /api/decks` - Deck CRUD

## Socket Events
All real-time game communication uses Socket.IO events defined in `SocketEvent` enum in shared types.

## Conventions
- All types are in `shared/src/types.ts` - modify here for game-wide type changes
- Game logic lives in `GameEngine.ts` - modify here for mechanic changes
- Card data is JSON - edit the class JSON files to add/modify cards, then `npm run seed`
- Card art is file-based - drop images into `card-art/{class}/` or use the web UI
