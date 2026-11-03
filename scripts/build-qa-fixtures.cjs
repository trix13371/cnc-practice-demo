'use strict';
// Instructor/developer fixtures. They are not linked or served by the learner app.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),p=require('../progress-model.js'),f=require('../tests/progress-fixtures.cjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cnc-progress-qa-'));
const full=f.full(),local=p.empty();full.createdAt=new Date().toISOString();local.sections.course.current.answers.machine=0;local.sections.base.current.draft.x=29;local.sections.gcode.current.selected='transfer-b';local.sections.gcode.current.phases['transfer-b']='practice';local.sections.gcode.current.sessions['transfer-b']=f.program('transfer-b',true);local.sections.gcode.current.drafts['transfer-b']='G00 X40 Z5\n(Мой текущий черновик)';
fs.writeFileSync(path.join(dir,'full.json'),p.stringify(full));fs.writeFileSync(path.join(dir,'local.json'),p.stringify(local));const corrupt=structuredClone(full);corrupt.sections.training.current.sessions['cycle-3'].actions.push({type:'invalid'});fs.writeFileSync(path.join(dir,'corrupt.json'),JSON.stringify(corrupt));console.log(dir);
