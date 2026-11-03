(function(root){
  'use strict';
  const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
  const registry=()=>root.CNCNormative;
  function link(title,url){let valid=false;try{valid=new URL(url).protocol==='https:';}catch{}const el=node(valid?'a':'span',title);if(valid){el.href=url;el.target='_blank';el.rel='noopener noreferrer';}return el;}
  const details=title=>{const d=node('details',undefined,'normative-panel');d.append(node('summary',title));return d;};
  function list(items){const ul=node('ul');for(const item of items)ul.append(node('li',item));return ul;}
  function renderSource(source){
    const card=node('section',undefined,'normative-source');
    const p=node('p');p.append(link(source.designation+' · '+source.title,source.url));card.append(p,node('p',source.reviewLabel,'normative-status'),node('p',source.note));
    card.append(node('p','Проверка источника: '+source.checkedOn,'normative-date'));
    if(source.amendmentUrl){const a=node('p');a.append(link('Официальная публикация изменения — требуется проверка',source.amendmentUrl));card.append(a);}
    if(source.transition){const t=source.transition,p=node('p');p.append(link('Переход: '+t.title,t.url),node('span',' · введение '+t.effectiveOn+'. '+t.note));card.append(p);}
    return card;
  }
  function appendRules(parent,id,kind){
    const m=registry();if(!m||typeof id!=='string'||!parent)return;
    const key=kind+':'+id;if([...parent.children].some(n=>n.dataset?.normativeTarget===key))return;
    const rules=kind==='article'?m.rulesForArticle(id):m.rulesForLesson(id);if(!rules.length)return;
    const fold=details('Основания и ограничения');fold.dataset.normativeTarget=key;
    fold.append(node('p','Здесь разделены нормативные источники, методика курса и условности модели. Это не заключение о соответствии всего тренажёра ГОСТам.'));
    for(const rule of rules){const section=node('section',undefined,'normative-rule');section.append(node('h4',rule.title),node('p',rule.kindLabel+' · '+rule.reviewLabel,'normative-status'),node('p',rule.statement),node('p',rule.scope));if(rule.limitations.length)section.append(list(rule.limitations));fold.append(section);}
    const refs=m.sourcesForRules(rules);if(refs.length){const refsFold=details('Документы и состояние их проверки');for(const s of refs)refsFold.append(renderSource(s));fold.append(refsFold);}
    parent.append(fold);
  }
  function mountCatalog(parent){
    const m=registry();if(!m||!parent||[...parent.children].some(n=>n.dataset?.normativeCatalog==='true'))return;
    const fold=details('Нормативные источники и учебная установка');fold.classList.add('normative-catalog');fold.dataset.normativeCatalog='true';
    fold.append(node('p','Проверка источников: '+m.checkedOn+'. Автоматическое отслеживание изменений пока не включено.'),node('p','Карточка документа подтверждает сведения о нём, но не заменяет проверку полного текста и применимых пунктов. Даты введения новых редакций учитываются отдельно.'));
    const profiles=details('Паспорта двух учебных профилей');
    for(const p of m.profiles){const s=node('section',undefined,'normative-rule');s.append(node('h4',p.title),node('p',p.description),list(p.conventions),node('p','Поддерживаемые G: '+p.gCodes.map(c=>'G'+String(c).padStart(2,'0')).join(', ')),node('p','Поддерживаемые M: '+p.mCodes.map(c=>'M'+String(c).padStart(2,'0')).join(', ')),list(p.limits));profiles.append(s);}
    const sources=details('Реестр источников · '+m.sources.length);for(const s of m.sources)sources.append(renderSource(s));
    fold.append(profiles,sources,node('p','Официальное обновление документа не переписывает материалы курса автоматически. Новые уроки и нормативные правила проверяются отдельно.'));parent.append(fold);
  }
  root.CNCNormativeUI=Object.freeze({appendArticle:(parent,id)=>appendRules(parent,id,'article'),appendLesson:(parent,id)=>appendRules(parent,id,'lesson'),mountCatalog});
})(window);
