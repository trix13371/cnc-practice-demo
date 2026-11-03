'use strict';
const model=require('../start-session-model.js');
function complete(){let state=model.create();const actions=[
  {type:'inspect',part:'stock'},{type:'inspect',part:'chuck'},{type:'inspect',part:'tool'},{type:'next'},
  {type:'rotate'},{type:'move',delta:1},{type:'stop'},{type:'wait'},{type:'next'},
  {type:'answer',value:'A'},{type:'next'},
  {type:'stop'},{type:'wait'},{type:'measure'},{type:'next'},
  {type:'wait'},{type:'measure'},{type:'next'},
  {type:'scale',value:10},{type:'scale',value:12},{type:'next'},
  {type:'scale',value:24},{type:'answer',value:'0,24'},{type:'next'},
  {type:'diameter',value:30},{type:'next'},
  {type:'answer',value:'2'},{type:'next'}
];for(const a of actions)state=model.transition(state,a);return state;}
module.exports={complete};
