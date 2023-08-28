import yaml from 'js-yaml';
import * as fs from 'fs';
import KSCompiler from 'kaitai-struct-compiler';

function compile() {
    let ksy = yaml.load(fs.readFileSync('./src/doom/wad/doom-wad.ksy'));
    let comp = new KSCompiler();
    comp.compile("javascript", ksy, null, false /* debugMode */)
    .then(function(files) {
        fs.writeFileSync('./src/doom/wad/doom-wad.ksy.js', files["DoomWad.js"]);
    });
}
compile();