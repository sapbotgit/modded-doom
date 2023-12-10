<script lang="ts" context="module">
    // there should be a better way to map these names to GM numbers https://en.wikipedia.org/wiki/General_MIDI but I'm not sure how
    // wow, doom used lots of instruments :(
    // https://flaterco.com/kb/DOOM/Doom-instruments.html
    // Maybe throw the whole thing away and used https://doomwiki.org/wiki/GENMIDI ?
    const instrumentNames = {
        0: "acoustic_grand_piano", // 0??
        6: "electric_piano_2",
        10: "glockenspiel",
        11: "music_box",
        15: "tubular_bells",
        18: "percussive_organ",
        29: "electric_guitar_muted",
        30: "overdriven_guitar",
        31: "distortion_guitar",
        33: "acoustic_bass",
        34: "electric_bass_finger",
        37: "slap_bass_1",
        38: "slap_bass_2",
        39: "synth_bass_1",
        40: "synth_bass_2",
        41: "violin",
        42: "viola",
        43: "cello",
        44: "contrabass",
        45: "tremolo_strings",
        46: "pizzicato_strings",
        47: "orchestral_harp",
        48: "timpani",
        51: "synth_strings_1",
        52: "synth_strings_2",
        62: "brass_section",
        63: "synth_brass_1",
        64: "synth_brass_2",
        81: "lead_1_square",
        82: "lead_2_sawtooth",
        92: "pad_3_polysynth",
        94: "pad_6_metallic",
        102: "fx_6_goblins",
        108: "koto",
        117: "taiko_drum",
        118: "melodic_tom",
        119: "synth_drum",
        120: "reverse_cymbal",
    };
    const drumMap = {
        35: 'kick',
        36: 'kick',
        38: 'snare',
        40: 'snare',
        41: 'tom-low',
        42: 'hihat-close',
        43: 'tom-hi',
        44: 'maraca',
        45: 'tom-low',
        46: 'hihat-open',
        47: 'mid-tom',
        48: 'tom-hi',
        49: 'cymbal',
        50: 'tom-hi',
        51: 'cymbal',
        52: 'cymbal',
        53: 'cowbell',
        55: 'cowbell',
        57: 'cymbal',
        59: 'cymbal',
        75: 'clave',
    };
</script>
<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import { Buffer as buff } from 'buffer';
    import midi from 'midi-player-js';
    import { mus2midi } from 'mus2midi';
    import type { MapRuntime } from "../doom";
    import { MidiSampleStore } from "../MidiSampleStore";
    import { Soundfont, DrumMachine } from "smplr";
    import { useAppContext } from "./DoomContext";

    export let map: MapRuntime;
    const { audio } = useAppContext();

    const storage = new MidiSampleStore();
    let midiPlayer: midi.Player;
    onMount(async () => {
        const gainNode = audio.createGain();
        gainNode.gain.value = .3;
        gainNode.connect(audio.destination);

        const panners: StereoPannerNode[] = [];
        for (let i = 0; i < 10; i++) {
            panners[i] = audio.createStereoPanner();
            panners[i].connect(gainNode);
        }
        const drums = await new DrumMachine(audio, { storage, destination: panners[9] }).load;
        // doom uses 9 instrument channels (10 is percussion)
        let channels: (Soundfont | DrumMachine)[] = [null, null, null, null, null, null, null, null, null, drums];

        midiPlayer = new midi.Player(async (ev) => {
            ev.channel -= 1;
            switch(ev.name) {
                case 'Set Tempo':
                    midiPlayer.tempo = ev.data;
                    break;

                case 'Program Change':
                    if (ev.channel !== 9) {
                        if (!instrumentNames[ev.value]) console.warn('missing-instrument', ev.value)
                        const instrument = instrumentNames[ev.value] ?? instrumentNames[6];
                        channels[ev.channel] = await new Soundfont(audio, { storage, destination: panners[ev.channel], instrument }).load;
                    }
                    break;
                case 'Controller Change':
                    if (ev.number === 7) {
                        channels[ev.channel]?.output.setVolume(ev.value);
                    }
                    if (ev.number === 10) {
                        panners[ev.channel].pan.value = (ev.value - 64) / 127;
                    }
                    break;

                case 'Pitch Bend':
                    // ??
                    // console.log('pitch-bend', ev)
                    break;
                case 'Note on':
                    if (ev.channel === 9) {
                        if (!drumMap[ev.noteNumber]) console.warn('missing drum', ev.noteNumber)
                        channels[ev.channel].start({ note: drumMap[ev.noteNumber] });
                    } else {
                        channels[ev.channel]?.start({ note: ev.noteNumber, velocity: ev.velocity });
                    }
                    break;
                case 'Note off':
                    channels[ev.channel]?.stop(ev.noteNumber);
                    break;

                default:
                    console.log('unhandled midi-event',ev);
            }
        });
        const lump = map.game.wad.lumpByName('D_E1M1');
        const mid = mus2midi(buff.from(lump.contents));
        // see https://github.com/grimmdude/MidiPlayerJS/issues/25
        (midiPlayer as any).sampleRate = 1;
        midiPlayer.loadArrayBuffer(mid);
        midiPlayer.play();
    });
    onDestroy(() => {
        midiPlayer?.stop();
    });
</script>