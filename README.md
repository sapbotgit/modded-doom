# Modded-doom

An attempt to make a doom more customizable, easy to use, and portable.

![DOOM map E1M1](assets/screenshot1.jpg) ![DOOM in isometric projection](assets/screenshot2.jpg)

## Description

A playable version of DOOM implemented in typescript, rendered in threejs, with a svelte UI. It is not a port of DOOM _per se_ because it deviates from the DOOM implementation where it was fun or interesting to experiment but it should still _feel_ like DOOM. Parts are derived from the [DOOM source code](https://github.com/id-Software/DOOM) - in particular for animation, monster behaviour, and timing - so if you're familiar with that code you may recognize parts of it in this implementation.

## Getting Started

Install NodeJS 16 or higher and run:
```
## Install NodeJS dependencies
npm install
## Run dev server
npm run dev
```
Open your web browser to http://localhost:5173 and the page should explain the rest.

## Roadmap

Nonexhaustive list of bugs and missing/incomplete features:

* Screen wipe
* Sounds for crushers and moving floors (door sounds work!)
* Crackling/popping sounds
* Holes in floor/ceiling geometry in some maps (eg. Doom2 MAP25~~, Plutonia MAP25 and MAP29~~)
* Load/Save games
* Lighting effects (like [light diminishing](https://doomwiki.org/wiki/Light_diminishing))
* Automap
* AI performance on large maps

WANTED:

* Better touch controls
* Multiplayer (P2P over webrtc?)
* Play demos
* Nightmare monster respawn (and other nightmare monster behaviours)
* More HUD options
* Improve the intro and menu UI. I don't have a design in mind, I just don't love what's there. It would be really fun to build something DOOM themed.
* Support more DOOM engine games (Heretic, Hexen, Strife)
* More Boom compatibility like switches, platforms, lights, etc. At least enough to play the community chest maps, ancient aliens, or sunlust.
* ZDoom compatibility like voxels, 3d models ZScript and etc.
* Generate BSP, SEGS, and SSECTOR nodes for large maps that don't have them

## Authors

* Lloyd Markle
* Sapbot
* You?

### Contributing
I'm happy to take contributions (features or bug fixes) so feel free to reach out in an issue or pull request. I'm sure there is lots of room to improve. I may not be super quick to respond.

## License

This project is licensed under the GPLv2 License - see the LICENSE file for details.

## Acknowledgments

Inspiration, code snippets, etc. (in no particular order):

* [DOOM source code](https://github.com/id-Software/DOOM)
* [smol/doom](https://github.com/smol/doom)
* [jmickle66666666/wad-js](https://github.com/jmickle66666666/wad-js)
* [cristicbz/rust-doom](https://github.com/cristicbz/rust-doom)
* [Fabien Sanglard's Game Engine Black Book: DOOM](https://fabiensanglard.net/gebbdoom/)
* [Doom wiki](https://doomwiki.org/) (see source code for specific links)
* [Doomworld Forums](https://www.doomworld.com/forum/) (see source code for specific links)
