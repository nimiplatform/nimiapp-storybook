# Storybook User Guide

Welcome to Storybook—an interactive narrative app that combines branching reading, character interaction, and creator authoring in one place. Experience built-in original stories or import Character Card V2 and lorebooks in **Play**, or craft portable interactive works and adapt narrative text into branching stories in **Studio**.

---

## Getting Started & Connecting to Nimi

- **Desktop App**: Open Storybook from the Nimi Home app library. It automatically uses your active Nimi Home account.
- **Hosted Web**: Open Storybook from the [Nimi App Storefront](https://nimi.ai/apps/storybook) or [storybook.nimi.xyz](https://storybook.nimi.xyz/), sign in via the official Nimi account page, and connect to your primary PC's Runtime. On first connection from this Web origin, review and approve the source once in Nimi Home on your primary PC (**Settings → Account Security → Remote access**).
- **Host PC & AI Model Setup**: Keep Nimi Home and Runtime running on your primary PC. Open **Settings & AI** in Storybook's sidebar and select a text generation (`text.generate`) model route—either Local or Cloud—before using AI improvisation, open-ended character chat, or Studio text adaptation. Authored branches in built-in stories remain playable once loaded; if no model is available, AI actions display a clear configuration notice instead of fabricating replies.

---

## Reader Guide (Play)

### 1. Story Shelf & Content Import
- **Curated Original Stories**: Your shelf includes three complete branching short stories out of the box—*Letters from Fog Harbor* (《雾港来信》), *The Last Train Without a Terminus* (《末班车没有终点》), and *The Rainy Day Letter Shop* (《雨天营业的信件店》).
- **Import Characters & Worlds**: Select **Import Character or Work** to drop or paste **Character Card V2 (JSON / PNG)**, **Storybook works (JSON)**, and **Lorebooks (JSON)** up to **8 MiB** per file (these are story and character content files, not `.nimiapp` app installers). When a PNG contains multiple embedded character payloads, Storybook lets you inspect and choose which version to import while preserving original card fields.

### 2. Branching Choices & AI Improvisation
- **Guided Choices & Free-Text Input**: Authored stories advance through contextual scene choices. Whenever you want to ask an off-script question or speak freely to the character in scene, expand the **AI Improvisation** input; after the character responds, the scene's choices remain ready to move the plot forward.
- **Direct Character Card Play**: Plain Character Card V2 files support immediate open-ended conversation and alternate greetings without requiring chapters or a Storybook Bible.

### 3. Timeline Forking, Reading Comfort & Endings
- **Rewind & Branch**: Open **My Storyline** in the reader header to review every checkpoint you passed and fork onto an alternate path; earlier journeys remain saved under **My Footprints**.
- **Reading Controls**: Use the `Aa` control to adjust font size and toggle Day / Night reading mode. How choices affect variables, relationships, or endings depends on each work's authored rules.

---

## Creator Guide (Studio)

### 1. Build Standalone Works
- Select **New Experience Work** in Studio to author a portable Storybook work using a guided form paired with a live-validated JSON definition editor. Configure title, summary, creative direction, role slots, default character cards, and lorebooks, then save to your shelf or export as standalone JSON.

### 2. Adapt Narrative Text into Branching Stories
- Select **Adapt from Narrative Text** to paste or import a `.txt` or `.md` excerpt up to **8,000 characters** (or start from built-in story seeds) and pick a narrative direction.
- AI drafts an editable story foundation—title, premise, world background, player perspective, core tension, narrative voice, and character cast—for your review. Once you approve the foundation, Storybook generates a branching chapter and runs a continuity pass.
- Inside the project workbench, switch across **Story Setup**, **Branches & Playtest**, **Advanced Editor**, and **Creative Memory** to inspect scene reachability, refine continuity with revision notes, publish to your local Play shelf, or export `.storybook.json`.

---

## Data Handling & Privacy

- **Private Storage on Your Primary PC**: Unpublished drafts, imported character cards and lorebooks, saved runs, and dialogue transcripts are stored in Nimi App private storage scoped to your account and Storybook on your primary PC. They are never mixed into shared LocalAgent memory.
- **AI Routing & Explicit Export**: AI calls follow the Local or Cloud route you select in **Settings & AI**. When using a Cloud route, only the story and dialogue context required for that turn is sent to your chosen provider. Exporting a JSON file is always an explicit user action.

---

## Current Limitations & Help

- **Pre-Alpha & In-App UI Language**: Storybook is in Pre-Alpha. The in-app interface is currently presented in Simplified Chinese, while storefront metadata and user documentation are provided in both Chinese and English.
- **Disconnects & Unsaved Edits**: If the connection drops, content already open on the page remains readable, while saving, importing, and AI generation require an active connection. Unsaved edits stay only on the current page and can be lost if you sign out or close the tab; reconnecting never auto-replays interrupted AI requests.
- **Source & Support**: Visit the [Storybook repository](https://github.com/nimiplatform/nimiapp-storybook) or report issues on [GitHub Issues](https://github.com/nimiplatform/nimiapp-storybook/issues).
