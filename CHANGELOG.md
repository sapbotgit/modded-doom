# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Doom random number generator (RNG) and setting
- Loading uncompressed zdoom bsp nodes (XNOD) for modern maps (like cosmogenesis)

### Changed
- Removed kaitai struct dependency for reading wads. Remove 1 dependency and 1KLoC
- Use CSS transforms (instead of changing viewbox) to make large SVGs render faster

### Fixed
- Monster interpolation even after target dies
- Custom textures from PWADs were not loaded properly
- Power up duration corrected for: rad suit, light amp, and invis
- Improve map load performance (from 3-4seconds to 400-800ms on larger maps)

## [0.6.0] - 2024-09-10

### Changed
- Renamed project (iso is not really specific enough)

## [0.5.0] - 2024-04-08

### Added
- Field of view (FOV) setting
- Interpolate movement (especially noticeable with timescale)
- full screen

### Fixed
- Added back WAD dropbox on startup screen
- Fix pain elementals spawning lost souls above the ceiling

## [0.4.1] - 2024-03-25
Fixed scrolling in menu screens (broken due to screen wipe).

## [0.4.0] - 2024-03-23

### Added
- `<noscript>` block if javascript is disabled
- Quick options in menu (camera, mute, and 486-mode)
- "Next episode" button in menu when completing M8 levels in DOOM 1
- Pressing use or attack will restart the map when dead
- Basic screen wipes

### Changed
- Smooth transition on intro menu and improve intro menu workflow
- Intro menus update url fragment which gives a nice behaviour with browser back button
- Pause game when showing menu

### Fixed
- Health showing 0% but player not dead
- Player thrust is applied consistently in different timescale and max fps
- Floating monsters not floating over obstacles
- Map transitions not working in E2, E3, and E4

## [0.3.0] - 2024-03-07

### Added
- Configuration screen for touch controls
- Keyboard control remap
- keyboard cheat codes
- aim assist setting (mostly for touch screens)

### Fixed
- several collision detection bugs
- fix monsters not opening doors
- fix crushers/doors reversing even when they've crushed objects
- fix sound propagating too far
- missile auto aim
- revenant tracer rockets turning too fast
- chainsaw idle sounds

## [0.2.0] - 2024-02-22

### Added

- Victory screens
- Fake contrast lighting
- Switch weapons wehen out of ammo
- Setting to limit fps
- Toggle fps on release builds
- Always run setting
- Mobile controls (v1). Not super friendly but they work.

### Changed
- Upgrade to threlte v7
- Lock pointer when starting game (1-less click to play)

### Fixed
- Render enemies in invisible sectors (eg. cages in plutonia MAP24)
- GL shaders on old hardware
- Layout and menu fixes and tweaks

## [0.1.0] - 2024-02-12
- Initial release with bugs and missing features (see README). We'll improve that over time.