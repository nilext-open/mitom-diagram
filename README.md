<p align="center">
  <img src="assets/brand/logo.png" alt="Mitom" width="140" />
</p>

<h1 align="center">Mitom Diagram</h1>

<p align="center">
  One local-first editor for every diagram an engineering team draws:<br/>
  database, architecture, sequence, flow, state, class, and more.
</p>

---

> **Status: early development (v0.1).** The database (ER) diagram editor works end to end. Everything else
> in this document is a **plan**, not a commitment. Scope and order may change as we learn.

## Why

Teams usually spread their diagrams across several tools: one for ER diagrams, another for architecture,
a text DSL for sequence diagrams, a whiteboard for everything else. The diagrams end up in different formats,
cannot reference each other, and drift away from the code.

Mitom Diagram aims to be **one editor** that:

- covers the common diagram types behind **one shared canvas engine**
- keeps diagrams as **plain, versioned JSON** that you own, stored locally
- **round-trips with text formats** (SQL, DBML, Mermaid, PlantUML, …) so diagrams can live next to code
- runs as a **single small binary** (Go daemon + web UI), with no cloud account required

## Principles

1. **Local-first.** Data lives on your machine. The app works fully offline. Sharing is opt-in.
2. **Diagram as data.** Each diagram is structured data (tables, services, messages), not just shapes, so it can
   be validated, diffed, generated and exported.
3. **Text in, text out.** Wherever a de facto text format exists, support import and export so diagrams fit into
   code review and CI.
4. **One engine, many kinds.** Canvas, selection, undo/redo, export and storage are shared. Each diagram kind is
   a module that plugs into the engine.
5. **Keep it simple.** Few dependencies, standard library first on the daemon, no infrastructure until a real
   requirement needs it.

## Diagram types

| Kind | Typical use | Text formats (planned) | Status |
| --- | --- | --- | --- |
| **Database (ERD)** | Schema design, documentation | SQL DDL, DBML, Mermaid ER, drawDB JSON | ✅ **v0.1 usable**, 🚧 extending |
| **Architecture** | C4 context/container/component, cloud & deployment views | Mermaid C4, Structurizr DSL, C4-PlantUML | 📋 Next |
| **Sequence** | API flows, service interactions | Mermaid sequence, PlantUML sequence | 📋 Planned |
| **Flowchart** | Processes, algorithms, decisions | Mermaid flowchart | 📋 Planned |
| **State machine** | Lifecycles (order, payment, ticket) | Mermaid state, SCXML (subset) | 📋 Planned |
| **Class / domain model** | OOP design, DDD aggregates | Mermaid class, PlantUML class | 📋 Planned |
| **Activity / use case** | UML behaviour modelling | PlantUML | 💡 Later |
| **Mind map** | Brainstorming, scoping | Markdown outline, Mermaid mindmap | 💡 Later |
| **Timeline / Gantt** | Roadmaps, release plans | Mermaid gantt | 💡 Later |
| **BPMN (subset)** | Business processes | BPMN 2.0 XML (subset) | 💡 Later |
| **Network / infrastructure** | Topology, VPC / subnet layout | — | 💡 Later |
| **Org chart** | Team structure | CSV | 💡 Later |

Legend: ✅ done · 🚧 in progress · 📋 planned · 💡 idea, to be validated

## Roadmap

Phases are ordered by dependency, not by date. Each phase has exit criteria so "done" is measurable.

### Phase 0: Foundation ✅

The first working product, built on the database diagram.

- [x] Go daemon: REST API, atomic file storage, serves the web build, Host allowlist + JSON-only writes
- [x] Web client (React + TypeScript + Vite): SVG canvas with pan, zoom and fit to screen
- [x] Tables, columns (type, PK, NN, UQ, AI, default, comment), indexes, colours, comments
- [x] Relationships by dragging column to column, crow's-foot notation, cardinality, ON UPDATE / ON DELETE
- [x] Sticky notes, undo / redo, duplicate, keyboard shortcuts, light / dark theme
- [x] Validation panel (duplicate names, missing PK, FK type mismatch, …)
- [x] Export: SQL (PostgreSQL, MySQL/MariaDB, SQLite, SQL Server, generic), JSON, PNG, SVG
- [x] Import: Mitom JSON, drawDB JSON
- [x] Autosave; `npm run dev` always starts the daemon alongside the UI

### Phase 1: Complete the database diagram

Make the ERD editor good enough to replace drawDB / dbdiagram.io for day-to-day work.

- [ ] Import SQL DDL (PostgreSQL, MySQL, SQLite first)
- [ ] Import / export DBML; export Mermaid ER
- [ ] Enums and custom types; check constraints; composite foreign keys
- [ ] Subject areas / table groups, multi-select, box selection, align and distribute
- [ ] Auto-layout for imported schemas
- [ ] Minimap, search and jump to table, templates (e.g. users/auth, e-commerce)
- [ ] Performance target: smooth editing with around 300 tables

**Exit criteria:** round-trip an existing real-world schema (SQL → diagram → SQL) with no manual fixes in the
supported dialects; 300-table diagram pans and drags at 60 fps on a mid-range laptop.

### Phase 2: Extract the shared canvas engine

Today the canvas is written for tables and relationships. Before adding a second diagram kind, split it into a
generic engine plus a database module. This phase is what makes every later phase cheaper.

- [ ] Generic model: nodes, ports, edges, groups/containers, labels, z-order
- [ ] Shared interaction: selection, multi-select, drag, resize, snapping, alignment guides, copy/paste
- [ ] Edge routing: straight, curved, orthogonal (with obstacle avoidance)
- [ ] Layout adapters: layered/hierarchical (e.g. ELK.js, evaluated in this phase), grid, manual
- [ ] Diagram-kind module interface (see [Architecture](#architecture))
- [ ] Content schema versioning and migrations per kind
- [ ] Port the database diagram onto the engine with **no behaviour change** (verified by existing tests plus
      visual snapshot tests)

**Exit criteria:** database diagram runs on the engine; a new "hello world" kind can be added without touching
engine code.

### Phase 3: Architecture diagrams

- [ ] C4 model: person, software system, container, component, boundaries; drill down between levels
- [ ] Generic shapes: service, database, queue, cache, storage, external system, user
- [ ] Icon packs for cloud and platform services (AWS, Azure, GCP, Kubernetes). **Licence review required**
      before bundling any vendor icons.
- [ ] Deployment view: environments, regions, VPCs/subnets as nested containers
- [ ] Edge metadata: protocol, sync/async, data classification
- [ ] Import / export Mermaid C4 and Structurizr DSL (subset)
- [ ] Link a "database" node to an existing ER diagram

**Exit criteria:** redraw a real project's C4 context and container diagrams entirely in Mitom, and export them
to Mermaid for docs.

### Phase 4: Sequence diagrams

Sequence diagrams are layout-driven, not free-form, so the editor works on an ordered list of messages and the
engine computes positions.

- [ ] Participants / lifelines (actor, service, database, queue), activation bars
- [ ] Sync, async, reply and self messages; create/destroy
- [ ] Fragments: `alt`, `opt`, `loop`, `par`, `critical`; notes
- [ ] Keyboard-first editing (type the next message quickly)
- [ ] Import / export Mermaid and PlantUML sequence syntax
- [ ] Reuse participants from an architecture diagram

**Exit criteria:** Mermaid sequence import → edit → export produces equivalent output for the supported feature set.

### Phase 5: Behaviour and structure (UML-style)

- [ ] Flowchart (start/end, process, decision, I/O, subprocess, swimlanes)
- [ ] State machine (states, composite states, transitions with guard/action, initial/final)
- [ ] Class / domain model (classes, interfaces, enums, associations, inheritance, multiplicity)
- [ ] Mermaid import / export for each of the above

### Phase 6: General-purpose and business diagrams

Validate demand before building. Candidates: mind map, timeline / Gantt, BPMN subset, network topology, org chart.

### Phase 7: Platform

- [ ] **CLI** (`src/client/command`): render diagram files to SVG/PNG, validate, convert formats. Useful in CI
      and docs pipelines.
- [ ] **Desktop app** (`src/client/desktop`): package the daemon + UI as a native app (Wails and Tauri to be
      compared; Wails would reuse the Go daemon directly)
- [ ] Workspaces / folders, tags, full-text search across diagrams
- [ ] Version history per diagram (snapshots, diff, restore)
- [ ] Cross-diagram links (e.g. architecture node → ERD → sequence)
- [ ] Sharing, multi-user and real-time collaboration. **Depends on the open decisions below.**

### Cross-cutting (every phase)

- Export: PNG, SVG, PDF, JSON; embeddable read-only viewer
- Accessibility: keyboard navigation, focus states, sufficient contrast
- Internationalisation: English and Vietnamese UI
- Quality: unit tests for models and converters, end-to-end tests for editor flows, visual snapshot tests for rendering
- Security: dependency updates, input validation on every importer, no telemetry without explicit opt-in

## Architecture

### Current (v0.1)

```
┌──────────────────────────── Browser ────────────────────────────┐
│  React UI                                                       │
│  ├─ Canvas (SVG)       tables · relationships · notes           │
│  ├─ Sidebar editors    tables · relations · notes · issues      │
│  ├─ State (zustand)    content + undo/redo history + autosave   │
│  └─ lib/               SQL generator · importers · exporters    │
└───────────────┬─────────────────────────────────────────────────┘
                │  /api (JSON over HTTP, localhost)
┌───────────────▼─────────────────────────────────────────────────┐
│  mitom-daemon (Go, stdlib)                                      │
│  ├─ REST API           /api/diagrams CRUD, /api/health          │
│  ├─ File store         one <id>.json per diagram, atomic write  │
│  └─ Static server      serves the built web UI (prod)           │
└─────────────────────────────────────────────────────────────────┘
```

### Target: engine + diagram-kind modules

```
                ┌─────────────────────────────────────────┐
                │              Canvas engine              │
                │ nodes · edges · ports · groups · layout │
                │ selection · history · export · theming  │
                └──────┬──────────┬──────────┬────────────┘
                       │          │          │
         ┌─────────────▼┐  ┌──────▼──────┐  ┌▼─────────────┐
         │   database   │  │architecture │  │   sequence   │  …
         │    module    │  │   module    │  │    module    │
         └──────────────┘  └─────────────┘  └──────────────┘
```

Each diagram-kind module provides:

| Part | Responsibility |
| --- | --- |
| `schema` | Typed, versioned content model plus migrations from older versions |
| `renderers` | How its nodes and edges are drawn on the canvas |
| `editors` | Sidebar / inspector panels |
| `validators` | Rules shown in the Issues panel |
| `importers` / `exporters` | Text format conversions (SQL, Mermaid, PlantUML, …) |
| `templates` | Starter diagrams |

The daemon stays **kind-agnostic**. It stores `{id, name, kind, content}` and treats `content` as opaque JSON,
so adding a kind needs only a client module and one entry in the daemon's `kind` allowlist.

## Getting started

**Requirements:** Go ≥ 1.22, Node.js ≥ 20.19

```bash
npm install       # first time only: installs the web client's dependencies
npm run dev       # UI at http://localhost:5173; the Go daemon is built and started automatically
make test         # go vet + go test, tsc + vitest
make run          # production build: one process serves UI + API at http://127.0.0.1:7420
```

In development, Vite builds and starts `src/daemon` on `127.0.0.1:7420` and proxies `/api` to it. It reuses a
daemon already running on that port, and stopping Vite stops the daemon it started. Daemon flags, API and
security notes are documented in [`src/daemon/README.md`](src/daemon/README.md).

### Keyboard shortcuts (database diagram)

| Shortcut | Action |
| --- | --- |
| `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` | Undo / redo |
| `Delete` / `Backspace` | Delete selected item |
| `Ctrl+D` | Duplicate selected table |
| `Ctrl+S` / `Ctrl+O` | Save now / open diagram |
| Double-click canvas | New table at the cursor |
| Drag a column's side dot onto another column | Create relationship |

## Repository layout

```
assets/brand/        Logo and brand assets
src/
├── daemon/          Go backend: REST API, file storage, static server
└── client/
    ├── web/         React + TypeScript + Vite UI
    ├── desktop/     Desktop shell (planned, Phase 7)
    └── command/     CLI (planned, Phase 7)
Makefile             dev / build / run / test
```

## Open decisions

These need an owner's decision before the related phase starts.

| Topic | Question | Affects |
| --- | --- | --- |
| Deployment model | Local/desktop tool only, or also a hosted team service? | Auth, storage, collaboration (Phase 7) |
| Authentication | None (local) plus a local API token, or SSO/OIDC for hosted use? No home-grown password system is recommended. | Daemon, deployment |
| Collaboration | Last-write-wins (current), version snapshots, or real-time (CRDT)? | Data model, daemon |
| Storage | Files only, or add SQLite once search and history arrive? | Daemon (Phase 7) |
| Layout engine | ELK.js vs. a custom layered layout | Phase 2 |
| Icon packs | Which vendor icon sets can be bundled under their licences? | Phase 3 |
| Desktop shell | Wails vs. Tauri | Phase 7 |
| Project licence | Which open-source licence? | Repository |

## Acknowledgements

The database editor is inspired by [drawDB](https://github.com/drawdb-io/drawdb). Text format support will
follow the syntax of [Mermaid](https://mermaid.js.org/), [PlantUML](https://plantuml.com/),
[DBML](https://dbml.dbdiagram.io/) and [Structurizr DSL](https://docs.structurizr.com/dsl).
