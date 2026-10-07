const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
let html=read('index.html');
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+read('style.css')+'</style>');
html=html.replace(/<script src="([\w-]+\.js)"><\/script>/g,(_,file)=>'<script>'+read(file)+'</script>');
fs.mkdirSync(path.join(root,'demo'),{recursive:true});
fs.writeFileSync(path.join(root,'demo/cnc-demo.html'),html);
console.log('Built demo/cnc-demo.html');
