// not sure why but I can't get doom/index.ts to work. Maybe it's an ESM thing?
// I didn't look too hard. This is a simple workaround that is easy to change
export * from './doom/wad/doomwad';
export * from './doom/wad/picture';
export * from './doom/game'
export * from './doom/map-data'
export * from './doom/map-object'
export * from './doom/map-runtime'
export * from './doom/math'
export * from './doom/things'
export * from './doom/doom-things-info'
export * from './doom/store'

export const data = {
    wads: [
        { name: 'Doom', path: 'doom', image: 'https://static.wikia.nocookie.net/doom/images/4/4b/Doom-1-.gif' },
        { name: 'Doom II', path: 'doom2', image: 'https://static.wikia.nocookie.net/doom/images/5/51/Doom2_title.png' },
        { name: 'Final Doom: Plutonia', path: 'plutonia', image: 'https://static.wikia.nocookie.net/doom/images/0/0c/Plutonia_title.gif' },
        { name: 'Final Doom: TNT Evilution', path: 'tnt', image: 'https://static.wikia.nocookie.net/doom/images/e/ed/TNT_title.gif' },
    ],
    skills: [
        { num: 1, pic: 'M_JKILL', name: "I'm too young to die." },
        { num: 2, pic: 'M_ROUGH', name: "Hey, not too rough." },
        { num: 3, pic: 'M_HURT', name: "Hurt me plenty." },
        { num: 4, pic: 'M_ULTRA', name: "Ultra Violence." },
        { num: 5, pic: 'M_NMARE', name: "Nightmare!" },
    ],
}