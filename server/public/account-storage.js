(function(root){'use strict';
  function create(storage,id,onBeforeChange=()=>{}){
    if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Invalid account storage identity');const prefix='cnc-account:'+id+':';
    class ScopedStorage{
      getItem(key){return storage.getItem(prefix+String(key));}
      setItem(key,value){onBeforeChange(String(key));storage.setItem(prefix+String(key),String(value));}
      removeItem(key){onBeforeChange(String(key));storage.removeItem(prefix+String(key));}
      key(index){const keys=[];for(let i=0;i<storage.length;i++){const k=storage.key(i);if(k?.startsWith(prefix))keys.push(k.slice(prefix.length));}return keys[index]??null;}
      get length(){let n=0;for(let i=0;i<storage.length;i++)if(storage.key(i)?.startsWith(prefix))n++;return n;}
      clear(){const keys=Array.from({length:this.length},(_,i)=>this.key(i));for(const k of keys)this.removeItem(k);}
    }
    return {storage:new ScopedStorage(),prefix};
  }
  const api={create};root.CNCAccountStorage=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
