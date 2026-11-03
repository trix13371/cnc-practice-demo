(function(root){
  'use strict';
  const shapeKeys=['shape','stepDiameter','stepLength','bore'];
  function normalizeShape(value,diameter,length){
    if(!shapeKeys.some(k=>Object.hasOwn(value,k)))return {};
    if(value.shape==='tube'){
      if(!Object.hasOwn(value,'bore')||Object.hasOwn(value,'stepDiameter')||Object.hasOwn(value,'stepLength')||typeof value.bore!=='number'||!Number.isFinite(value.bore))return null;
      const bore=Number(value.bore.toFixed(3));return bore>=1&&Math.round(diameter*1000)-Math.round(bore*1000)>=2000?{shape:'tube',bore}:null;
    }
    if(!['shape','stepDiameter','stepLength'].every(k=>Object.hasOwn(value,k))||Object.hasOwn(value,'bore')||value.shape!=='stepped')return null;
    if(![value.stepDiameter,value.stepLength].every(v=>typeof v==='number'&&Number.isFinite(v)))return null;
    const d=Number(value.stepDiameter.toFixed(3)),l=Number(value.stepLength.toFixed(3));
    if(d<5||d>=diameter||l<1||l>Number((length-1).toFixed(3)))return null;
    return {shape:'stepped',stepDiameter:d,stepLength:l};
  }
  function profile(stock){const bore=stock.bore??0;return {segments:(stock.shape==='stepped'?[{length:Number((stock.length-stock.stepLength).toFixed(3)),diameter:stock.diameter},{length:stock.stepLength,diameter:stock.stepDiameter}]:[{length:stock.length,diameter:stock.diameter}]).map(s=>({...s,endDiameter:s.diameter,bore})),bore};}
  const api=Object.freeze({normalizeShape,profile});root.CNCStockShape=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
