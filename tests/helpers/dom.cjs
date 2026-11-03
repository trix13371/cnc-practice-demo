class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.events={};this.dataset={};this.style={};this.disabled=false;this.open=false;this._text='';}
  set textContent(value){this._text=String(value??'');this.children=[];}
  get textContent(){return this._text+this.children.map(c=>c.textContent||'').join('');}
  set innerHTML(value){this.markup=value;this.children=[];}
  append(...nodes){for(const n of nodes){if(n.parentNode)n.parentNode.children=n.parentNode.children.filter(c=>c!==n);n.parentNode=this;this.children.push(n);}}
  replaceChildren(...nodes){this.children=[];this._text='';this.append(...nodes);}
  insertBefore(n){this.append(n);}
  setAttribute(k,v){this.attributes[k]=v;}
  removeAttribute(k){delete this.attributes[k];}
  addEventListener(k,fn){this.events[k]=fn;}
  get lastElementChild(){return this.children.at(-1);}
  all(){return [this,...this.children.flatMap(c=>c.all())];}
  querySelectorAll(selector){return this.all().filter(e=>selector.startsWith('.')?(e.className||'').split(' ').includes(selector.slice(1)):e.tagName===selector);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  click(){if(!this.disabled)this.events.click?.({target:this});}
  focus(){this.focused=true;}
  submit(answer){this.rawAnswer=answer;this.events.submit({preventDefault(){}});}
}
module.exports={Element};
