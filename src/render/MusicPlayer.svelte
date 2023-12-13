<script lang="ts" context="module">
    // There should be a better way to map these names to GM numbers https://en.wikipedia.org/wiki/General_MIDI but I'm not sure how.
    // Maybe throw the whole thing away and used https://doomwiki.org/wiki/GENMIDI ?
    // Also, wow(!),  doom used lots of instruments https://flaterco.com/kb/DOOM/Doom-instruments.html.
    const instrumentNames = {
        0: "acoustic_grand_piano", // 0??
        1: "acoustic_grand_piano",
        2: "bright_acoustic_piano",
        3: "electric_grand_piano",
        4: "honkytonk_piano",
        5: "electric_piano_1",
        6: "electric_piano_2",
        7: "harpsichord",
        8: "clavinet",
        9: "celesta",
        10: "glockenspiel",
        11: "music_box",
        12: "vibraphone",
        13: "marimba",
        14: "xylophone",
        15: "tubular_bells",
        16: "dulcimer",
        17: "drawbar_organ",
        18: "percussive_organ",
        19: "rock_organ",
        20: "church_organ",
        21: "reed_organ",
        22: "accordion",
        23: "harmonica",
        24: "tango_accordion",
        25: "acoustic_guitar_nylon",
        26: "acoustic_guitar_steel",
        27: "electric_guitar_jazz",
        28: "electric_guitar_clean",
        29: "electric_guitar_muted",
        30: "overdriven_guitar",
        31: "distortion_guitar",
        32: "guitar_harmonics",
        33: "acoustic_bass",
        34: "electric_bass_finger",
        35: "electric_bass_pick",
        36: "fretless_bass",
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
        49: "string_ensemble_1",
        50: "string_ensemble_2",
        51: "synth_strings_1",
        52: "synth_strings_2",
        53: "choir_aahs",
        54: "voice_oohs",
        55: "synth_choir",
        56: "orchestra_hit",
        57: "trumpet",
        58: "trombone",
        59: "tuba",
        60: "muted_trumpet",
        61: "french_horn",
        62: "brass_section",
        63: "synth_brass_1",
        64: "synth_brass_2",
        65: "soprano_sax",
        66: "alto_sax",
        67: "tenor_sax",
        68: "baritone_sax",
        69: "oboe",
        70: "english_horn",
        71: "bassoon",
        72: "clarinet",
        73: "piccolo",
        74: "flute",
        75: "recorder",
        76: "pan_flute",
        77: "blown_bottle",
        78: "shakuhachi",
        79: "whistle",
        80: "ocarina",
        81: "lead_1_square",
        82: "lead_2_sawtooth",
        83: "lead_3_calliope",
        84: "lead_4_chiff",
        85: "lead_5_charang",
        86: "lead_6_voice",
        87: "lead_7_fifths",
        88: "lead_8_bass__lead",
        89: "pad_1_new_age",
        90: "pad_2_warm",
        91: "pad_3_polysynth",
        92: "pad_4_choir",
        93: "pad_5_bowed",
        94: "pad_6_metallic",
        95: "pad_7_halo",
        96: "pad_8_sweep",
        97: "fx_1_rain",
        98: "fx_2_soundtrack",
        99: "fx_3_crystal",
        100: "fx_4_atmosphere",
        101: "fx_5_brightness",
        102: "fx_6_goblins",
        103: "fx_7_echoes",
        104: "fx_8_scifi",
        105: "sitar",
        106: "banjo",
        107: "shamisen",
        108: "koto",
        109: "kalimba",
        110: "bagpipe",
        111: "fiddle",
        112: "shanai",
        113: "tinkle_bell",
        114: "agogo",
        115: "steel_drums",
        116: "woodblock",
        117: "taiko_drum",
        118: "melodic_tom",
        119: "synth_drum",
        120: "reverse_cymbal",
        121: "guitar_fret_noise",
        122: "breath_noise",
        123: "seashore",
        124: "bird_tweet",
        125: "telephone_ring",
        126: "helicopter",
        127: "applause",
        128: "gunshot",

    };
    // an incomplete (sometime incorrect) drum mapping...
    const drumMap = {
        35: 'kick/bd0010', // Acoustic Bass Drum
        36: 'kick/bd0000', // Electric Bass Drum
        37: 'rimshot', // Side Stick
        38: 'snare/sd0075', // Acoustic Snare
        39: 'clap', // Hand Clap
        40: 'snare/sd7575', // Electric Snare
        41: 'tom-low', // Low Floor Tom
        42: 'hihat-close', // Closed Hi-hat
        43: 'tom-hi', // High Floor Tom
        44: 'hihat-open/oh25', // Pedal Hi-hat
        45: 'tom-low', // Low Tom
        46: 'hihat-open', // Open Hi-hat
        47: 'tom-low/lt10', // Low-Mid Tom
        48: 'mid-tom/mt10', // High-Mid Tom
        49: 'cymbal/cy0025', // Crash Cymbal 1
        50: 'tom-hi', // High Tom
        51: 'cymbal/cy1025', // Ride Cymbal 1
        52: 'cymbal/cy7500', // Chinese Cymbal
        53: 'cymbal/cy1025', // Ride Bell
        55: 'cymbal/cy0075', // Splash Cymbal
        56: 'cowbell', // Cowbell
        57: 'cymbal/cy0025', // Crash Cymbal 2
        59: 'cymbal/cy1010', // Ride Cymbal 2
        62: 'conga-hi', // Mute High Conga
        63: 'conga-hi/hc25', // Open High Conga
        64: 'conga-low', // Low Conga
        70: 'maraca', // Maracas
        75: 'clave', // Claves
        // 54: '', // Tambourine
        // 58: '', // Vibraslap
        // 60: '', // High Bongo
        // 61: '', // Low Bongo
        // 65: '', // High Timbale
        // 66: '', // Low Timbale
        // 67: '', // High Agogô
        // 68: '', // Low Agogô
        // 69: '', // Cabasa
        // 71: '', // Short Whistle
        // 72: '', // Long Whistle
        // 73: '', // Short Guiro
        // 74: '', // Long Guiro
        // 76: '', // High Woodblock
        // 77: '', // Low Woodblock
        // 78: '', // Mute Cuica
        // 79: '', // Open Cuica
        // 80: '', // Mute Triangle
        // 81: '', // Open Triangle
    };
</script>
<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import { Buffer as buff } from 'buffer';
    import midiplay from 'midi-player-js';
    import { mus2midi } from 'mus2midi';
    import type { MapRuntime } from "../doom";
    import { MidiSampleStore } from "../MidiSampleStore";
    import { Soundfont, DrumMachine } from "smplr";
    import { useAppContext } from "./DoomContext";
    import { MIDIParser } from 'lumidi'
    import { Buffer } from 'buffer'
    import PicoAudio from 'picoaudio'
    import JZZ from 'jzz';
    import { SMF } from 'jzz-midi-smf';
    import { Tiny } from 'jzz-synth-tiny';
    import WebAudioTinySynth from 'webaudio-tinysynth';

    export let map: MapRuntime;
    const { audio } = useAppContext();

    JZZ.lib.getAudioContext = () => audio;
    SMF(JZZ);
    Tiny(JZZ);
    (JZZ as any).synth.Tiny.register('Web Audio');

    const word = (buff: Uint8Array, offset: number) => buff[offset + 1] << 8 | buff[offset];
    // Nifty little hack! https://stackoverflow.com/questions/50179214
    const toInt16 = (num: number) => (num << 16) >> 16;
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

        // console.log(type, waveform, [keyScale, output], [attack, decay, sustain, release])
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
    let stopTheMusic = () => {};
    onMount(async () => {
        const gainNode = audio.createGain();
        gainNode.gain.value = .3;
        gainNode.connect(audio.destination);

        const effects: { pan: StereoPannerNode, bq: BiquadFilterNode }[] = [];
        // D_INTRO sets pan on channel 11 (which shouldn't happen but... meh?)
        for (let i = 0; i < 11; i++) {
            const pan = audio.createStereoPanner();
            const bq = audio.createBiquadFilter();
            effects[i] = { pan, bq };
        }
        const drums = await new DrumMachine(audio, { storage, destination: gainNode }).load;
        // drums.output.addInsert(effects[9].bq);
        drums.output.addInsert(effects[9].pan);

        // doom uses 9 instrument channels (10 is percussion)
        type Instrument = Soundfont;
        // type Instrument = ReturnType<typeof readGMInstrument>;
        let channels: (Instrument | DrumMachine)[] = [null, null, null, null, null, null, null, null, null, drums];

        const midiPlayer = new midiplay.Player(async (ev) => {
            ev.channel -= 1;
            switch(ev.name) {
                case 'Set Tempo':
                    midiPlayer.tempo = ev.data;
                    break;

                case 'Program Change':
                    if (ev.channel !== 9) {
                        if (!instrumentNames[ev.value]) console.warn('missing-instrument', ev.value)
                        const instrument = instrumentNames[ev.value] ?? instrumentNames[6];
                        const sf = await new Soundfont(audio, { storage, instrument, destination: gainNode }).load;;
                        sf.output.addInsert(effects[ev.channel].pan);
                        // sf.output.addInsert(effects[ev.channel].bq);
                        channels[ev.channel] = sf;
                        console.log(ev.channel,ev.value)
                        // if (channels[ev.channel]) {
                        //     (channels[ev.channel] as Instrument).stop();
                        //     (channels[ev.channel] as Instrument).gain.disconnect();
                        // }
                        // channels[ev.channel] = readGMInstrument(genmidi, ev.value);
                        // (channels[ev.channel] as Instrument).gain.connect(gainNode);
                    }
                    break;
                case 'Controller Change':
                    if (ev.number === 7) {
                        channels[ev.channel]?.output.setVolume(ev.value);
                    }
                    if (ev.number === 10) {
                        effects[ev.channel].pan.pan.value = (ev.value - 64) / 127;
                    }
                    break;

                case 'Pitch Bend':
                    // ??
                    // console.log('pitch-bend', ev)
                    break;
                case 'Note on':
                    if (ev.channel === 9) {
                        if (!drumMap[ev.noteNumber]) console.warn('missing drum', ev.noteNumber)
                        channels[ev.channel].start({ note: drumMap[ev.noteNumber], velocity: ev.velocity });
                    } else {
                        console.log(ev.channel)
                        channels[ev.channel]?.start({ note: ev.noteNumber, velocity: ev.velocity });
                        // channels[ev.channel]?.start(ev);
                    }
                    break;
                case 'Note off':
                    channels[ev.channel]?.stop(ev.noteNumber);
                    break;

                default:
                    console.log('unhandled midi-event',ev);
            }
        });
        const lump = map.game.wad.lumpByName('D_E1M2');
        const midi = mus2midi(buff.from(lump.contents));

        // // see https://github.com/grimmdude/MidiPlayerJS/issues/25
        // (midiPlayer as any).sampleRate = 0;
        // midiPlayer.loadArrayBuffer(midi);
        // midiPlayer.play();
        // stopTheMusic = () => midiPlayer.stop();

        const synth = new WebAudioTinySynth();
        synth.setAudioContext(audio, gainNode);
        synth.setLoop(1);
        synth.loadMIDI(midi);
        synth.playMIDI();
        // actually, it would be really cool to use GENMIDI here to configure the oscillars WebAudioTinySynth creates.
        // We can inject the OPL3 waveforms too via the synth.wave map by synth.wave['w-opl3-0'] = PeriodicWave(...), etc.
        stopTheMusic = () => synth.stopMIDI();

        // const midiout = JZZ().openMidiOut();
        // const smf = new (JZZ.MIDI as any).SMF(midi);
        // const player = smf.player();
        // player.connect(midiout);
        // player.play();
        // stopTheMusic = () => player.stop();

        // const picoAudio = new PicoAudio();
        // picoAudio.init();
        // const smf = picoAudio.parseSMF(midi);
        // picoAudio.setData(smf);
        // picoAudio.play();
        // stopTheMusic = () => picoAudio.stop();

        // window.Buffer = Buffer;
        // console.log('midi', MIDIParser.parse(midi))
    });
    onDestroy(() => {
        stopTheMusic();
    });
</script>