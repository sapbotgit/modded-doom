<script lang="ts" context="module">
    // there should be a better way to map these names to GM numbers https://en.wikipedia.org/wiki/General_MIDI but I'm not sure how
    // wow, doom used lots of instruments!
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

    const word = (buff: Uint8Array, offset: number) => buff[offset + 1] << 8 | buff[offset];
    // Nifty little hack! https://stackoverflow.com/questions/50179214
    const toInt16 = (num: number) => (num << 16) >> 16;
    // https://doomwiki.org/wiki/GENMIDI
    const genmidi = map.game.wad.lumpByName('GENMIDI').contents;
    const header = String.fromCharCode(genmidi[0], genmidi[1], genmidi[2], genmidi[3], genmidi[4], genmidi[5], genmidi[6], genmidi[7]);
    // ^^^ #OPL_II#

    const A4 = 440;
    function mtof(note: number): number {
        return A4 * Math.pow(2, (note - 69) / 12);
    }
    const now = () => audio.currentTime;

    // Some helpful resources. This was much more complex than I imagined but kind of fun to learn about.
    // https://www.redblobgames.com/x/1618-webaudio/
    // https://greweb.me/2013/08/FM-audio-api
    function readGMInstrument(data: Uint8Array, num: number) {
        const o = num * 36 + 8;
        const flags = word(data, o);
        const fineTuning = data[o + 2];
        const noteNumber = data[o + 3];

        const fixedPitch = Boolean(flags & 1);
        const unknown = Boolean(flags & 2);
        const doubleVoice = Boolean(flags & 4);

        const gain = audio.createGain();
        gain.gain.setValueAtTime(0.0, now());
        const v1 = instrumentVoice(gain, data, o + 4);
        const v2 = doubleVoice ? instrumentVoice(gain, data, o + 20) : null;

        const stop = () => {
            v1.keyUp();
            v2?.keyUp();
            gain.gain.setTargetAtTime(0.0, now(), 0.2);
        };
        const start = ev => {
            gain.gain.setTargetAtTime(ev.velocity / 127, now(), 0.05);
            v1.keyDown(ev);
            v2?.keyDown(ev);
        };
        return { gain, start, stop };
    }

    function instrumentVoice(root: GainNode, data: Uint8Array, o: number) {
        const modulator = fmCell(data, o, 'mod');
        const modulatorFeedback = data[o + 6];
        const carrier = fmCell(data, o + 7, 'car');
        const noteOffset = toInt16(word(data, o + 14));

        const gain = audio.createGain();
        gain.connect(root);
        modulator.gain.connect(carrier.osc.frequency);
        carrier.gain.connect(root);
        return {
            keyDown: ev => {
                modulator.keyDown(ev.noteNumber + noteOffset);
                carrier.keyDown(ev.noteNumber + noteOffset);
            },
            keyUp: () => {
                modulator.keyUp();
                carrier.keyUp();
            },
        }
    }

    function fmCell(data: Uint8Array, offset: number, type: 'car' | 'mod') {
        const tremolo = data[offset + 0];
        const attackDecay = data[offset + 1];
        const sustainRelease = data[offset + 2];
        const waveform = data[offset + 3];
        const keyScale = data[offset + 4];
        const output = data[offset + 5];

        const attack = (attackDecay >> 4) / 15;
        const decay = (attackDecay & 0xF) / 15;
        const sustain = (sustainRelease >> 4) / 15;
        const release = (sustainRelease & 0xF) / 15;

        console.log(type, waveform, [keyScale, output], [attack, decay, sustain, release])
        const gain = audio.createGain();
        const osc = audio.createOscillator();
        osc.connect(gain);
        osc.start();
        const keyDown = (note: number) => {
            // attack and decay
            const t = now();
            osc.frequency.setValueAtTime(mtof(note), t);
            gain.gain.linearRampToValueAtTime(0.0, t);
            gain.gain.linearRampToValueAtTime(1.0, t + attack);
            gain.gain.linearRampToValueAtTime(sustain, t + attack + decay);
        }
        const keyUp = () => {
            // release (sustain is the time between down and up)
            gain.gain.linearRampToValueAtTime(0.0, now() + release);
        }
        return { waveform, gain, osc, keyDown, keyUp };
    }

    const storage = new MidiSampleStore();
    let midiPlayer: midi.Player;
    onMount(async () => {
        const gainNode = audio.createGain();
        gainNode.gain.value = .3;
        gainNode.connect(audio.destination);

        const panners: StereoPannerNode[] = [];
        // D_INTRO sets pan on channel 11 (which shouldn't happen but... meh?)
        for (let i = 0; i < 11; i++) {
            panners[i] = audio.createStereoPanner();
            panners[i].connect(gainNode);
        }
        const drums = await new DrumMachine(audio, { storage, destination: panners[9] }).load;
        // doom uses 9 instrument channels (10 is percussion)
        // type Instrument = Soundfont;
        type Instrument = ReturnType<typeof readGMInstrument>;
        let channels: (Instrument | DrumMachine)[] = [null, null, null, null, null, null, null, null, null, drums];

        midiPlayer = new midi.Player(async (ev) => {
            ev.channel -= 1;
            switch(ev.name) {
                case 'Set Tempo':
                    midiPlayer.tempo = ev.data;
                    break;

                case 'Program Change':
                    if (ev.channel !== 9) {
                        if (!instrumentNames[ev.value]) console.warn('missing-instrument', ev.value)
                        // const instrument = instrumentNames[ev.value] ?? instrumentNames[6];
                        // channels[ev.channel] = await new Soundfont(audio, { storage, destination: panners[ev.channel], instrument }).load;
                        if (channels[ev.channel]) {
                            (channels[ev.channel] as Instrument).stop();
                            (channels[ev.channel] as Instrument).gain.disconnect();
                        }
                        channels[ev.channel] = readGMInstrument(genmidi, ev.value);
                        (channels[ev.channel] as Instrument).gain.connect(gainNode);
                    }
                    break;
                case 'Controller Change':
                    if (ev.number === 7) {
                        console.log(ev)
                        // channels[ev.channel]?.output.setVolume(ev.value);
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
                        // channels[ev.channel]?.start({ note: ev.noteNumber, velocity: ev.velocity });
                        channels[ev.channel]?.start(ev);
                    }
                    break;
                case 'Note off':
                    channels[ev.channel]?.stop(ev.noteNumber);
                    break;

                default:
                    console.log('unhandled midi-event',ev);
            }
        });
        const lump = map.game.wad.lumpByName('D_E1M8');
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