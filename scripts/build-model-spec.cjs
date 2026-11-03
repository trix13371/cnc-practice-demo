'use strict';
const fs=require('node:fs'),path=require('node:path'),spec=require('../model-spec-model.js'),root=path.join(__dirname,'..'),manifest=spec.manifest();
fs.mkdirSync(path.join(root,'docs'),{recursive:true});
fs.writeFileSync(path.join(root,'MODEL-SPECIFICATION.md'),spec.markdown());
fs.writeFileSync(path.join(root,'docs/model-specification.json'),JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(root,'docs/model-examples.json'),JSON.stringify({specVersion:manifest.specVersion,notes:'Трассы текущей реализации, не отдельный протокол испытаний.',examples:manifest.examples.map(e=>spec.example(e.id))},null,2)+'\n');
console.log(`Built formal specification ${manifest.specVersion}: Markdown, JSON and ${manifest.examples.length} executable example traces.`);
