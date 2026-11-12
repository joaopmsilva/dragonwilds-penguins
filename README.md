# 🐧 KGP Field Guide

**Every place a Killer Gentoo Penguin can hide in _RuneScape: Dragonwilds_, on an interactive map.**

👉 **https://joaopmsilva.github.io/dragonwilds-penguins/**

[![Buy me a coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-ffdd00?style=for-the-badge&logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/paradoxjs)
[![Quest guides](https://img.shields.io/badge/Quest%20guides-every%20quest-9a5d12?style=for-the-badge)](https://joaopmsilva.github.io/dragonwilds-quests/)
[![RSDWServerAPI](https://img.shields.io/badge/Server%20mod-RSDWServerAPI-5865F2?style=for-the-badge&logo=github&logoColor=white)](https://joaopmsilva.github.io/RSDWServerAPI/)

Update 1.0.2 hid the Killer Gentoo Penguins (the KGP) across Ashenfall. This site shows where they can be,
and how the hunt works:

- 🗺️ **All 208 spawn spots** on the game's world map, colour-coded by region, with directions from named places ("137 m south-east of Bramblemead Valley")
- ✅ **A found-it checklist** that stays in your browser. Clear it when the penguins move.
- 🔎 **Filters** by region, disguise and place, and a link to share any spot
- 📜 **A Penguin Hunting quest guide**: where to start, how the penguins work, what the shop sells, and what the gear needs to craft

## Coordinates

Every spot's world coordinates (X, Y, Z in game units, centimetres) are shown in the list and each pin's pop-up.
The penguin spots are also on the wiki's own map, on its
[Penguin Hunting](https://dragonwilds.runescape.wiki/w/Penguin_Hunting) page.

## How the hunt works

- **3 penguins per region** are out at once, 18 across the six regions.
- **They move every 7 in-game days.**
- **They hide as a box, pot, barrel or sack**, or as a desert pot or rug in Umbral Sands.
- **Each penguin gives every character one Penguin Coin**, so friends can share a find.
- **Spend coins at Façade's Front**, a talking door at the Adventurer's Guild ruins in Bramblemead Valley.

## Where the data comes from

Everything was read from the game's own files on the 1.0.2 dedicated server:

- the `PenguinHuntingSlot` actors placed in the world (positions, regions, disguise pools)
- the penguin hunting settings
- the shop's recipes and prices
- the penguin string table (dialogue)

Spots are described from the place names on the in-game map. A patch can change any of this.

## Credits and licence

- Map tiles: the [RuneScape: Dragonwilds Wiki](https://dragonwilds.runescape.wiki/) map, used under [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/).
- _RuneScape: Dragonwilds_ and its map art © Jagex Ltd.
- Fan-made and not affiliated with Jagex.
- The site's own code (`index.html`, `app.js`, `style.css`) is MIT licensed.

## ☕ Support

This guide is free and ad-free. If it saved you some hunting, **[buy me a coffee](https://buymeacoffee.com/paradoxjs)**: it keeps the data updated after each patch.

## 📜 Every other quest

**[Dragonwilds Quest Guides](https://joaopmsilva.github.io/dragonwilds-quests/)** has a guide for every quest and activity in the game, with maps, pictures and a done checklist.

## 🐉 Run a Dragonwilds server?

**[RSDWServerAPI](https://joaopmsilva.github.io/RSDWServerAPI/)** is a free server mod and Discord bot for Linux dedicated servers. It puts a penguin leaderboard in your Discord, along with live skills, two-way chat, death and quest feeds, raid alerts and admin tools. Players don't install anything.

Made by Paradox. Found a wrong spot or something the game changed? [Open an issue](https://github.com/joaopmsilva/dragonwilds-penguins/issues).
