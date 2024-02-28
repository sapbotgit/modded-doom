<script lang="ts">
    import { useDoom } from "../DoomContext";

    const alwaysRun = useDoom().game.settings.alwaysRun;
</script>

<div class="text-center text-xs">
    Move: <kbd class="kbd">W</kbd><kbd class="kbd">A</kbd><kbd class="kbd">S</kbd><kbd class="kbd">D</kbd><br />
    Use: <kbd class="kbd">E</kbd><br />
    Shoot: Left-click<br />
    {$alwaysRun ? "Walk" : "Run"}:<kbd class="kbd">Shift</kbd><br />
    Weapons: <kbd class="kbd">1</kbd>-<kbd class="kbd">7</kbd><br />
</div>