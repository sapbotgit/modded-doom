<script lang="ts">
    import { Mesh, Object3DInstance } from "@threlte/core";
    import type { DoomMap, LineDef, Sector } from "../../doom";
    import { useDoom } from "../useDoom";
    import { BoxGeometry, BufferGeometry, Color, Line, MeshBasicMaterial, Vector3 } from "three";
    import { LineMaterial } from "three/examples/jsm/lines/LineMaterial";

    export let map: DoomMap;

    const { editor } = useDoom();

    const mapHeight = map.sectors.reduce((top, sec) => Math.max(sec.zCeil.val, top), -Infinity);
    const lineMaterial = new MeshBasicMaterial({ color: 'cyan' });
    const sectorMaterial = new MeshBasicMaterial({ color: 'magenta' });

    $: tag = ($editor.selected && 'tag' in $editor.selected && $editor.selected.tag > 0) ? $editor.selected.tag : null;
    $: linedefs = (!tag ? [] : map.linedefs.filter(e => e.tag === tag)) as LineDef[];
    $: sectors = (!tag ? [] : map.sectors.filter(e => e.tag === tag)) as Sector[];

    const createShape = (position1: Vector3, position2: Vector3) => new Line(
        new BufferGeometry().setFromPoints([
            position1,
            new Vector3().copy(position1).setZ(mapHeight),
            new Vector3().copy(position2).setZ(mapHeight),
            position2,
        ]),
        new LineMaterial({ color:  Color.NAMES.cyan }));

    function position(item: LineDef | Sector) {
        const pos = new Vector3();
        if (!item) {
            return pos;
        }

        if ('zFloor' in item) {
            const rsecs = map.renderSectors.filter(e => e.sector === item);
            const verts = rsecs.map(e => e.vertexes).flat();
            verts.forEach(v => {
                pos.x += v.x;
                pos.y += v.y;
            });
            pos.x /= verts.length;
            pos.y /= verts.length;
            pos.z = (rsecs[0].sector.zCeil.val + rsecs[0].sector.zFloor.val) / 2;
        } else {
            pos.x = (item.v[0].x + item.v[1].x) / 2;
            pos.y = (item.v[0].y + item.v[1].y) / 2;
            pos.z = (item.right.sector.zCeil.val + item.right.sector.zFloor.val) / 2;
        }
        return pos;
    }
    const boxSize = 24;
</script>

{#each sectors ?? [] as sector}
    {@const sectorPosition = position(sector)}
    <Mesh
        material={sectorMaterial}
        position={sectorPosition}
        geometry={new BoxGeometry(boxSize, boxSize, boxSize)}
    />

    {#each linedefs ?? [] as linedef}
        {@const linedefPosition = position(linedef)}
        <Mesh
            material={lineMaterial}
            position={linedefPosition}
            geometry={new BoxGeometry(boxSize, boxSize, boxSize)}
        />

        {@const connectorLine = createShape(linedefPosition, sectorPosition)}
        <Object3DInstance object={connectorLine} />
    {/each}
{/each}