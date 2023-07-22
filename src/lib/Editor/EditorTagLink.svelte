<script lang="ts">
    import { Mesh, Object3DInstance } from "@threlte/core";
    import type { DoomMap, LineDef, Sector } from "../../doom";
    import { useDoom } from "../useDoom";
    import { BoxGeometry, BufferGeometry, Color, DoubleSide, Line, LineBasicMaterial, MeshBasicMaterial, Vector3 } from "three";

    export let map: DoomMap;

    const { editor } = useDoom();

    const mapHeight = map.sectors.reduce((top, sec) => Math.max(sec.values.zCeil, top), -Infinity);
    const material = new MeshBasicMaterial({ color: 'cyan' });

    $: item1 = ($editor.selected && 'tag' in $editor.selected && $editor.selected.tag > 0) ? $editor.selected : null;
    $: item2 = !item1 ? null :
        'zFloor' in item1
            ? map.linedefs.find(e => e.tag === item1.tag)
            : map.sectors.find(e => e.tag === item1.tag);
    $: position1 = position(item1);
    $: position2 = position(item2);
    $: connectorLine = createShape(position1, position2)

    function createShape(position1: Vector3, position2: Vector3) {
        const geo = new BufferGeometry().setFromPoints([
            position1,
            new Vector3().copy(position1).setZ(mapHeight),
            new Vector3().copy(position2).setZ(mapHeight),
            position2,
        ]);
        return new Line(geo, new LineBasicMaterial({ color: Color.NAMES.cyan }));
    }

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
            pos.z = (rsecs[0].sector.values.zCeil + rsecs[0].sector.values.zFloor) / 2;
        } else {
            pos.x = (item.v[0].x + item.v[1].x) / 2;
            pos.y = (item.v[0].y + item.v[1].y) / 2;
            pos.z = (item.right.sector.values.zCeil + item.right.sector.values.zFloor) / 2;
        }
        return pos;
    }
    const boxSize = 24;
</script>

{#if item1 && item2}
    <Mesh
        {material}
        position={position1}
        geometry={new BoxGeometry(boxSize, boxSize, boxSize)}
    />
    <Mesh
        {material}
        position={position2}
        geometry={new BoxGeometry(boxSize, boxSize, boxSize)}
    />

    <Object3DInstance object={connectorLine} />
{/if}