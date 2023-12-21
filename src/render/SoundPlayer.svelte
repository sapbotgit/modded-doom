<script lang="ts">
    import { useAppContext } from "./DoomContext";
    import { Game, MapObject, PlayerMapObject, SoundIndex, store } from "../doom";
    import { Vector3 } from "three";

    export let game: Game;
    export let gain: GainNode;
    export let player: PlayerMapObject = null;

    const { audio, settings } = useAppContext();
    const { experimentalSoundHacks } = settings;

    const speedOfSound = 343; // m/s
    // https://web.archive.org/web/20211127055143/http://www.trilobite.org/doom/doom_metrics.html
    const verticalMeters = 0.03048;
    const maxSounds = 8;
    const soundGain = (1 / maxSounds) - .1;

    // we want these as small as possible so long as the audio doesn't pop or click on start and stop
    const gainOffsetStart = 0.025;
    const gainOffsetEnd = 0.025;
    function gainNode(t: number, gain: number, buffer: AudioBuffer) {
        // why set the gain this way? Without it, we get a bunch of popping when sounds start and stop
        const node = audio.createGain();
        node.gain.setValueAtTime(0.000001, t);
        node.gain.exponentialRampToValueAtTime(gain, t + gainOffsetStart);
        node.gain.setValueAtTime(gain, t + buffer.duration - gainOffsetEnd);
        node.gain.exponentialRampToValueAtTime(0.000001, t + buffer.duration);
        return node;
    }

    // TODO: does the compressor actually matter? I think it almost mutes explosions
    const root = audio.createDynamicsCompressor();
    root.connect(gain);

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
        const isSectorLocation = location && 'soundTarget' in location;
        const position = !isPositional ? defaultPosition :
            ('soundTarget' in location) ? store(location.center)
            : location.position;
        // hacky way to prioritze playing closer sounds
        const dist = xyDistSqr(position?.val ?? $defaultPosition, $playerPosition ?? $defaultPosition);
        const index = activeSoundDistances.findIndex(e => e > dist);
        if (index > maxSounds || activeSoundDistances.length >= maxSounds) {
            return;
        }
        activeSoundDistances.push(dist);
        activeSoundDistances.sort();

        const name = 'DS' + SoundIndex[snd].toUpperCase().split('_')[1];
        const buffer = soundBuffer(name);
        const now = audio.currentTime;

        const sound = audio.createBufferSource();
        sound.addEventListener('ended', () => {
            activeSoundDistances = activeSoundDistances.filter(e => e !== dist);
        });
        sound.playbackRate.value = game.settings.timescale.val;
        sound.buffer = buffer;
        sound.start(now);

        const gain = gainNode(now, isPositional ? soundGain : soundGain * .1, buffer);
        gain.connect(root);

        if (!isPositional) {
            sound.connect(gain);
        }

        const pan = audio.createPanner();
        pan.refDistance = 20;
        pan.rolloffFactor = 2;
        pan.connect(gain);
        // TODO: is subscribe/unsubscribe actually worth the effort? We could just set the position and forget it.
        const unsub = position.subscribe(pos => {
            const t = audio.currentTime + .1; // if we do this immediately, we get crackling as the sound position changes
            pan.positionX.linearRampToValueAtTime(pos.x, t);
            pan.positionY.linearRampToValueAtTime(pos.y, t);
            // use player position for sector sound sources otherwise we use the middle-z and that may be above or below the player
            pan.positionZ.linearRampToValueAtTime(isSectorLocation ? $playerPosition.z + 41 : pos.z, t);
        });
        sound.addEventListener('ended', unsub);
        sound.connect(pan);

        if (!$experimentalSoundHacks) {
            return;
        }

        // Some half baked experiments with echo/filter to for room acoustics. I'll probably not keep
        // this but it's fun to play with. Ideally we have some reverb based on sound location and room size and maybe
        // textures (wood vs marble vs metal vs stone). Maybe use filters high sounds for hidden objects? (because bass
        // sounds pass through walls)
        if (location instanceof MapObject) {
            // add a filter to play low freqency when outside but delay it based on xy distance
            if (location.sector.val.ceilFlat.val === 'F_SKY1') {
                // can't be 0 otherwise gainNode will error because we use exponential ramps
                const gain = soundGain * .4 * (1 - Math.min(.99999999, dist / 1_000_000));
                const fGain = gainNode(now, gain, buffer);
                fGain.connect(root);
                const filter = audio.createBiquadFilter();
                sound.connect(filter);
                filter.type = 'lowpass';
                filter.frequency.value = 200;
                filter.Q.value = 1;
                filter.connect(fGain);
            }
            // don't add echo if we are outside
            if (location.sector.val.ceilFlat.val !== 'F_SKY1') {
                // calculate echo based on height of the room. It's not accurate but interesting to play with.
                const heightM = (location.sector.val.zCeil.val - location.sector.val.zFloor.val) * verticalMeters;
                const delay = heightM * 2 / speedOfSound;
                const eGain = gainNode(now + delay, soundGain * .4, buffer);
                eGain.connect(root);
                const echo = audio.createDelay();
                echo.delayTime.value = delay;
                echo.connect(eGain);
                pan.connect(echo);
            }
        }
    });
</script>