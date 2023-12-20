<script lang="ts">
    import { useAppContext } from "./DoomContext";
    import { Game, PlayerMapObject, SoundIndex, store } from "../doom";
    import { Vector3 } from "three";

    export let game: Game;
    export let gain: GainNode;
    export let player: PlayerMapObject = null;

    const { audio } = useAppContext();

    const maxSounds = 8;
    const soundGain = (1 / maxSounds) - .1;
    // we want these as small as possible so long as the audio doesn't pop or click on start and stop
    const gainOffsetStart = 0.03;
    const gainOffsetEnd = 0.03;

    // TODO: does the compressor actually matter?
    const comp = audio.createDynamicsCompressor();
    comp.connect(gain);

    // Camera position or player position? I think camera is probably more useful (especially for orthogonal/follow cam)
    // even though it's less accurate.
    const { position: playerPosition, direction: yaw, pitch } = player ?? {};
    $: updateListener($playerPosition, $yaw, $pitch);
    function updateListener(position: Vector3, yaw: number, pitch: number) {
        if (!player) {
            // if we don't have a player, we don't need positional audio
            return;
        }
        if (audio.listener.positionX) {
            audio.listener.positionX.value = position.x;
            audio.listener.positionY.value = position.y;
            audio.listener.positionZ.value = position.z;
        } else {
            audio.listener.setPosition(position.x, position.y, position.z);
        }
        if (audio.listener.forwardX) {
            audio.listener.forwardX.value = Math.cos(yaw);
            audio.listener.forwardY.value = Math.sin(yaw);
            audio.listener.forwardZ.value = 0;
            audio.listener.upX.value = 0;
            audio.listener.upY.value = 0;
            audio.listener.upZ.value = Math.cos(pitch);
        } else {
            audio.listener.setOrientation(
                Math.cos(yaw), Math.sin(yaw), 0,
                0, 0, Math.cos(pitch));
        }
    }

    // Why not these?
    // import { AudioListener, PositionalAudio } from "@threlte/extras";
    // It turns out it's just simpler to create the audio nodes by hand. We also get a lot of clicking/popping when
    // sounds start and stop (see gain node below) and I couldn't find a way to attach those gain nodes to the
    // PositionalAudio component.

    const xyDistSqr = (v1: Vector3, v2: Vector3) => {
        const dx = v2.x - v1.x;
        const dy = v2.y - v1.y;
        return dx * dx + dy * dy;
    };

    const soundCache = new Map<string, AudioBuffer>()
    const word = (buff: Uint8Array, offset: number) => buff[offset + 1] << 8 | buff[offset];
    const dword = (buff: Uint8Array, offset: number) => word(buff, offset + 2) << 16 | word(buff, offset);
    function soundBuffer(name: string) {
        if (!soundCache.has(name)) {
            const buff = game.wad.lumpByName(name).contents as Uint8Array;
            const sampleRate = word(buff, 0x2);
            const numSamples = dword(buff, 0x4) - 32;
            const buffer = audio.createBuffer(1, numSamples, sampleRate);
            buffer.getChannelData(0).set(buff.slice(0x18, numSamples));
            soundCache.set(name, buffer);
        }
        return soundCache.get(name);
    }

    const defaultPosition = store(new Vector3());
    let activeSoundDistances: number[] = [];
    game.onSound((snd, location) => {
        const isPositional = player && location && location !== player;
        const position = !isPositional ? defaultPosition :
            ('soundTarget' in location) ? store(location.center)
            : location.position;
        // hacky way to prioritze playing closer sounds
        const dist = xyDistSqr(position.val, $playerPosition ?? $defaultPosition);
        const index = activeSoundDistances.findIndex(e => e > dist);
        if (index > maxSounds || activeSoundDistances.length >= maxSounds) {
            return;
        }
        activeSoundDistances.push(dist);
        activeSoundDistances.sort();

        const name = 'DS' + SoundIndex[snd].toUpperCase().split('_')[1];
        const buffer = soundBuffer(name);

        const now = audio.currentTime;
        const gain = audio.createGain();
        // why set the gain this way? Without it, we get a bunch of popping when sounds start and stop
        gain.gain.setValueAtTime(0.000001, now);
        gain.gain.exponentialRampToValueAtTime(soundGain, now + gainOffsetStart);
        gain.gain.setValueAtTime(soundGain, now + buffer.duration - gainOffsetEnd);
        gain.gain.exponentialRampToValueAtTime(0.000001, now + buffer.duration);
        gain.connect(comp);

        let pan: PannerNode;
        if (isPositional) {
            pan = audio.createPanner();
            pan.refDistance = 20;
            pan.rolloffFactor = 2;
            pan.connect(gain);
        }

        // Wouldn't it be cool to add convolver for reverb based on room size or flat/ceil/wall textures? We could
        // add more reverb on metal rooms or tall rooms or something.
        // Or a biquad filter to filter high sounds if the source is not visible?

        const sound = audio.createBufferSource();
        sound.addEventListener('ended', () => {
            activeSoundDistances = activeSoundDistances.filter(e => e !== dist);
        });
        sound.buffer = buffer;
        sound.start(now);
        sound.connect(pan ?? gain);

        if (pan) {
            // TODO: is subscribe/unsubscribe actually worth the effort? We could just set the position and forget it.
            const unsub = position.subscribe(pos => {
                const t = audio.currentTime + .1; // if we do this immediately, we get crackling as the sound position changes
                pan.positionX.linearRampToValueAtTime(pos.x, t);
                pan.positionY.linearRampToValueAtTime(pos.y, t);
                pan.positionZ.linearRampToValueAtTime(pos.z, t);
            });
            sound.addEventListener('ended', unsub);
        }
    });
</script>