const assert=require('node:assert/strict');
function complete(m,state=m.create()){
 const t=m.task,r=a=>state=m.transition(state,a),next=()=>r({type:'next',source:state.source});
 for(const id of ['A','B','C'])r({type:'inspect',id});next();for(const id of ['reduce','frontFinish'])r({type:'append',id});r({type:'checkPlan'});assert(state.planReady);next();
 for(const a of [{type:'reference'},{type:'clamp'},{type:'tool',value:1},{type:'preset'},{type:'zero',value:'100'},{type:'door',value:true}])r(a);next();
 const source=m.planSource(state.plan);r({type:'preview',source});assert(state.correct);next();r({type:'start',source});r({type:'run'});assert(state.correct);next();r({type:'door',value:false});
 for(const [id,z]of [['dA',-t.frontLength/2],['dB',-t.frontLength-t.middleLength/2],['dC',-(t.reach+t.stock.length)/2]]){r({type:'measure',id,method:'micrometer',z:String(z)});r({type:'record',id,value:String(state.measurement.value)});}
 for(const id of ['lA','reach']){r({type:'measure',id,method:'depth',z:''});r({type:'record',id,value:String(state.measurement.value)});}r({type:'record',id:'lB',value:String(t.middleLength)});next();r({type:'verdict',route:'followed',decision:'accept',note:'Проверен другой чертёж.'});next();assert(state.complete);assert(m.report(state).includes(t.id));return state;
}
function portfolio(){const m=require('../shaft-project-model.js');let s=complete(m);for(const {id} of m.variants.slice(1))s=complete(m.forTask(id),m.transition(s,{type:'selectVariant',id}));return s;}
module.exports={complete,portfolio};
