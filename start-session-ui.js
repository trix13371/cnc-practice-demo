(function(root){
  'use strict';
  const engine=root.CNCStartSession;
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const button=(text,run,cls='button secondary')=>{const b=el('button',text,cls);b.type='button';b.dataset.startControl=text;b.addEventListener('click',run);return b;};
  const decimal=n=>(n/100).toFixed(2).replace('.',','),motionLabel={running:'Вращается',coasting:'Команда остановки подана · вращение ещё продолжается',stopped:'Вращение полностью остановлено'};
  const hints={2:'У резца есть отдельная режущая кромка. Найдите эту форму на новой схеме, не ориентируясь на букву из прошлого рисунка.',4:'Пока вращение продолжается, ручной прибор не подносят. В этой подготовленной сцене осталось дождаться остановки.',6:'Одна десятая — десять сотых. Сначала отложите две десятых, затем ещё четыре сотых.',8:'Вычислите, насколько уменьшился весь диаметр. Толщина слоя с одной стороны вдвое меньше этой разницы.'};
  const copy=[
    ['Три узла токарного станка','Патрон удерживает заготовку и передаёт ей вращение. Резец снимает металл режущей кромкой. Выберите каждый узел под сценой, чтобы узнать его роль.'],
    ['Два разных движения','Включите вращение на схеме, переместите резец и остановите вращение. Это иллюстрация: резец движется над заготовкой и здесь ещё не режет металл.'],
    ['Та же конструкция, другой вид','На новой схеме патрон находится справа. Найдите режущий инструмент. Буквы и расположение отличаются от объяснения.'],
    ['Остановка занимает время','Подайте команду остановки. Проследите за выбегом шпинделя и выполните контроль после полной остановки.'],
    ['Теперь другая ситуация','Команда остановки уже подана, но вращение продолжается. Инструмент отведён; остальные условия доступа выполнены в рамках этой сцены. Выполните оставшееся действие и ручной контроль.'],
    [null,'Отметьте 0,12 мм на шкале. Цена короткого деления — 0,01 мм.'],
    [null,'Установите указатель на две десятых и четыре сотых миллиметра. Запишите показание шкалы десятичным числом.'],
    ['Диаметр соединяет два края','Знак Ø обозначает диаметр. На схеме уменьшите Ø32 до Ø30. Диаметр изменится на 2 мм, а слой с одной стороны — на 1 мм: размер меняется с двух сторон. Это регулируемая схема, а не физическая обработка.'],
    ['Новые размеры без готового расчёта','На другой заготовке диаметр уменьшили с Ø36 до Ø32. Какова толщина снятого слоя с одной стороны? Все размеры в миллиметрах.']
  ];
  function phaseTrack(current) {
    const phases = el('ol', undefined, 'start-phases');
    phases.setAttribute('aria-label', 'Состояния шпинделя');
    for (const [phase, label] of [['running', 'Вращение'], ['coasting', 'Выбег'], ['stopped', 'Остановлено']]) {
      const item = el('li', label);
      item.dataset.phase = phase;
      if (phase === current) item.setAttribute('aria-current', 'step');
      phases.append(item);
    }
    return phases;
  }

  function scaleControl(read, set) {
    const ruler = el('div', undefined, 'start-ruler');
    ruler.tabIndex = 0;
    ruler.setAttribute('role', 'slider');
    ruler.setAttribute('aria-label', 'Положение указателя на шкале');
    ruler.setAttribute('aria-valuemin', '0');
    ruler.setAttribute('aria-valuemax', '1');
    const track = el('div', undefined, 'start-ruler-track');
    track.setAttribute('aria-hidden', 'true');
    const pointer = el('span', undefined, 'start-ruler-pointer');
    const previous = el('span', undefined, 'start-ruler-pointer start-ruler-previous');
    previous.hidden = true;
    const arrow = '<svg viewBox="0 0 16 32"><path d="M8 2v27M3 23l5 6 5-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    pointer.innerHTML = previous.innerHTML = arrow;
    let ticks = 'M0 .5H1000';
    for (let i = 0; i <= 100; i++) {
      ticks += 'M' + i * 10 + ' 0v' + (i % 10 === 0 ? 32 : i % 5 === 0 ? 22 : 13);
    }
    const marks = el('div', undefined, 'start-ruler-marks');
    marks.innerHTML = '<svg viewBox="0 0 1000 34" preserveAspectRatio="none"><path d="' + ticks + '" fill="none" stroke="currentColor" vector-effect="non-scaling-stroke"/></svg>';
    track.append(previous, pointer, marks);
    for (let i = 0; i <= 10; i++) {
      const label = el('span', String(i / 10).replace('.', ','), 'start-ruler-label');
      label.style.left = i * 10 + '%';
      track.append(label);
    }
    ruler.append(track);
    function select(value) {
      const state = read();
      if (state.step === 6 && state.correct) return;
      const position = Math.max(0, Math.min(100, value));
      if (position !== state.scale) set(position);
    }
    ruler.addEventListener('click', event => {
      const { left, width } = track.getBoundingClientRect();
      if (!width) return;
      ruler.focus({ preventScroll: true });
      select(Math.round((event.clientX - left) / width * 100));
    });
    ruler.addEventListener('keydown', event => {
      const value = read().scale;
      const keys = { ArrowLeft: value - 1, ArrowDown: value - 1, ArrowRight: value + 1, ArrowUp: value + 1,
        PageDown: value - 10, PageUp: value + 10, Home: 0, End: 100 };
      if (!Object.hasOwn(keys, event.key)) return;
      event.preventDefault();
      select(keys[event.key]);
    });
    let last = read().scale;
    return {
      ruler,
      sync() {
        const { scale, step, correct } = read();
        if (scale !== last) {
          previous.style.left = last + '%';
          previous.hidden = false;
          last = scale;
        }
        pointer.style.left = scale + '%';
        ruler.setAttribute('aria-valuenow', String(scale / 100));
        ruler.setAttribute('aria-valuetext', decimal(scale) + ' мм');
        ruler.setAttribute('aria-disabled', String(step === 6 && correct));
      },
    };
  }
  function diameterArt(before,after){
    return '<svg viewBox="0 0 640 285" aria-hidden="true"><circle cx="185" cy="140" r="108" fill="#f4d49a" stroke="#b18c4c" stroke-width="2"/><circle cx="185" cy="140" r="'+108*after/before+'" fill="#c9d8e3" stroke="#607c92" stroke-width="2"/><path d="M77 140H293" stroke="#345b79" stroke-dasharray="5 6"/><circle cx="185" cy="140" r="4" fill="#345b79"/><text x="345" y="90" fill="#345b79" font-size="24">Было: Ø'+before+' мм</text><text x="345" y="140" fill="#345b79" font-size="24">Стало: Ø'+after+' мм</text><text x="345" y="200" fill="#785723" font-size="19">Жёлтое кольцо —</text><text x="345" y="227" fill="#785723" font-size="19">снятый слой</text></svg>';
  }

  function ready(state) {
    if (state.step === 0) return state.seen.length === 3;
    if (state.step === 1) return state.rotated && state.moved && state.motion === 'stopped';
    if (state.step === 3) return state.measured && state.motion === 'stopped';
    return state.correct;
  }

  function create({model=engine,singleExercise=false,headingTag='h3',saved,savedDraft,onDraft=()=>true,onChange=()=>true,onDone=()=>{},onNext}={}){
    let state=model.restore(saved)||model.create(),notice='',draft=savedDraft?.step===state.step?String(savedDraft.value):'';
    const host=el('section',undefined,'start-session');
    let scene, waiting = false, syncAdjustment;
    function run(action) {
      const adjusting = action.type === 'scale' || action.type === 'diameter';
      const moveControl = action.type === 'move' ? document.activeElement?.dataset?.startControl : null;
      try {
        const next = model.transition(state, action);
        const persisted = onChange(model.snapshot(next));
        state = next;
        notice = persisted === false ? 'Сохранение недоступно. Не закрывайте страницу: действия пока находятся в памяти.' : '';
        if (action.type === 'next') draft = '';
      } catch (error) {
        notice = error.message;
      }
      if (adjusting && syncAdjustment) return syncAdjustment();
      render(action.type === 'next' && !notice ? 'title' : 'feedback');
      if (moveControl) [...host.querySelectorAll('button')].find(b => b.dataset.startControl === moveControl && !b.disabled)?.focus({ preventScroll: true });
    }

    function wait(button) {
      waiting = true;
      button.disabled = true;
      button.textContent = 'Шпиндель замедляется…';
      scene.wait(() => {
        waiting = false;
        run({ type: 'wait' });
      });
    }

    function render(focus){
      host.replaceChildren();host.dataset.startStep=String(state.step);
      syncAdjustment = null;
      if(state.complete && singleExercise){
        const title=el(headingTag,'Упражнение выполнено');
        title.tabIndex=-1;
        host.append(title,button('Все задания курса',onDone,'button primary'));
        if(focus)title.focus();
        return;
      }
      if(state.complete){host.append(el('p','Первое знакомство завершено','start-kicker'),el(headingTag,'Теперь можно перейти к первому уроку'),el('p','Вы разобрали узлы, два вида движения, ожидание остановки, десятичные доли и связь диаметра со слоем.'),el('p',state.assisted?'Во время проверки вы открывали помощь. Это нормально: самостоятельное применение проверим на следующих новых условиях.':'Проверочные действия выполнены без открытия подсказок. Это вводное знакомство, а не допуск к реальному станку.'),button('Продолжить курс',onDone,'button primary'));if(onNext)host.append(button('Далее: деталь и измерение',onNext,'button primary'));if(focus){const h=host.querySelector(headingTag);h.tabIndex=-1;h.focus();}return;}
      const step=state.step,check=[2,4,6,8].includes(step),title=el(headingTag,model.steps[step].title);title.tabIndex=-1;
      host.append(el('p','ПЕРВОЕ ЗНАКОМСТВО · '+(step+1)+' / '+model.steps.length,'start-kicker'),title);
      const meter=el('progress');meter.max=model.steps.length;meter.value=step;meter.setAttribute('aria-label','Действия вводного занятия');
      host.append(meter);
      if (copy[step][0]) host.append(el('p',copy[step][0],'start-lead'));
      host.append(el('p',copy[step][1]));
      const board = el('figure', undefined, 'start-board');
      const motionStep = [1, 3, 4].includes(step);
      let scale, section, syncControls;
      if (step <= 4) {
        scene ??= root.CNCStartSessionSceneUI.create();
        board.append(scene.canvas);
        scene.update(state);
        if (motionStep) board.append(phaseTrack(state.motion));
      } else if (step <= 6) {
        scale = scaleControl(() => state, value => run({ type: 'scale', value }));
        board.append(scale.ruler);
      } else {
        section = el('div');
        section.setAttribute('role', 'img');
        board.append(section);
        if (step === 8) {
          section.innerHTML = diameterArt(36, 32);
          section.setAttribute('aria-label', 'Поперечное сечение детали. Исходный диаметр 36 мм, после обработки 32 мм.');
        }
      }
      board.append(el('figcaption','Учебная схема · не управление оборудованием'));
      host.append(board);
      if(step===3||step===4)host.append(el('p','Другие условия доступа заданы только для этой сцены. На реальном станке ручной контроль выполняют по полной инструкции оборудования.','start-note'));
      const controls=el('div',undefined,'start-controls');
      if(step===0){for(const [part,label]of [['chuck','A · Патрон'],['stock','B · Заготовка'],['tool','C · Резец']]){const b=button(label,()=>run({type:'inspect',part}));b.setAttribute('aria-pressed',String(state.seen.includes(part)));controls.append(b);}}
      if(motionStep){
        host.append(el('p',motionLabel[state.motion],'start-motion'));
        if(step===1){const b=button('Включить вращение на схеме',()=>run({type:'rotate'}));b.disabled=state.motion!=='stopped';controls.append(b);}
        if(state.motion==='running')controls.append(button('Подать команду остановки',()=>run({type:'stop'})));
        if (state.motion === 'coasting') {
          const stop = button(waiting ? 'Шпиндель замедляется…' : 'Дождаться полной остановки', () => wait(stop));
          stop.disabled = waiting;
          controls.append(stop);
        }
        if(step===1){for(const [delta,label]of [[-1,'Сместить резец влево'],[1,'Сместить резец вправо']]){const b=button(label,()=>run({type:'move',delta}));b.disabled=state.tool+delta<0||state.tool+delta>3;controls.append(b);}}
        else{const b=button('Выполнить ручной контроль в этой сцене',()=>run({type:'measure'}));b.disabled=state.correct||state.measured;controls.append(b);}
      }
      if(step===2){for(const v of ['A','B','C']){const b=button('Область '+v,()=>run({type:'answer',value:v}));b.disabled=state.correct;controls.append(b);}}
      if (scale) {
        const offsets = [[-10, '−0,10 мм'], [-1, '−0,01 мм'], [1, '+0,01 мм'], [10, '+0,10 мм']];
        const steps = offsets.map(([delta, label]) => {
          const control = button(label, () => run({ type: 'scale', value: state.scale + delta }));
          controls.append(control);
          return [delta, control];
        });
        syncControls = () => {
          scale.sync();
          for (const [delta, control] of steps) {
            const target = state.scale + delta;
            control.disabled = target < 0 || target > 100 || (step === 6 && state.correct);
          }
        };
      }
      if (step === 7) {
        const field = el('div', undefined, 'start-diameter');
        const input = el('input');
        input.type = 'text';
        input.inputMode = 'decimal';
        input.maxLength = 12;
        input.setAttribute('aria-label', 'Диаметр на схеме, мм');
        const decrease = button('−', () => run({ type: 'diameter', value: state.diameter - 1 }));
        const increase = button('+', () => run({ type: 'diameter', value: state.diameter + 1 }));
        decrease.setAttribute('aria-label', 'Уменьшить диаметр на 1 мм');
        increase.setAttribute('aria-label', 'Увеличить диаметр на 1 мм');
        const group = el('div', undefined, 'start-diameter-input');
        group.append(decrease, input, increase);
        field.append(el('p', 'Диаметр на схеме, мм', 'start-diameter-label'), group);
        host.append(field);
        const summary = el('p', undefined, 'start-value');
        host.append(summary);
        function commit() {
          const value = model.parseNumber(input.value);
          if (value !== state.diameter) run({ type: 'diameter', value });
          else input.value = state.diameter + ',0';
        }
        input.addEventListener('change', commit);
        input.addEventListener('keydown', event => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          commit();
        });
        syncControls = () => {
          const diameter = state.diameter, difference = 32 - diameter;
          input.value = diameter + ',0';
          decrease.disabled = diameter === 28;
          increase.disabled = diameter === 32;
          section.innerHTML = diameterArt(32, diameter);
          section.setAttribute('aria-label', 'Поперечное сечение детали. Исходный диаметр 32 мм, выбранный диаметр ' + diameter + ' мм.');
          summary.textContent = 'Разница диаметров: ' + difference + ' мм · слой с одной стороны: ' + (difference / 2).toLocaleString('ru-RU') + ' мм';
        };
      }
      host.append(controls);
      if(step===6||step===8){
        const form=el('form',undefined,'start-answer'),label=el('label',step===6?'Число со шкалы, мм':'Толщина слоя с одной стороны, мм','field'),input=el('input');input.type='text';input.inputMode='decimal';input.autocomplete='off';input.maxLength=32;input.value=draft;input.disabled=state.correct;input.setAttribute('aria-label',step===6?'Число со шкалы, мм':'Толщина слоя с одной стороны, мм');input.addEventListener('input',()=>{draft=input.value;try{if(onDraft(draft)===false){notice='Сохранение недоступно. Не закрывайте страницу: черновик пока находится в памяти.';feedback.textContent=notice;}}catch(error){notice=error.message;feedback.textContent=notice;}});label.append(input);const submit=el('button','Проверить','button primary');submit.type='submit';submit.disabled=state.correct;form.append(label,submit);form.addEventListener('submit',e=>{e.preventDefault();run({type:'answer',value:draft});});host.append(form,el('p','Можно вводить запятую или точку. Без единиц и выражений.','start-note'));
      }
      const feedback=el('div',undefined,'start-feedback');feedback.setAttribute('role','status');feedback.tabIndex=-1;host.append(feedback);
      if(check&&!state.correct){const help=button(state.hints.includes(step)?'Подсказка открыта':'Нужна подсказка',()=>run({type:'hint'}));help.disabled=state.hints.includes(step);host.append(help);}
      if(state.hints.includes(step))host.append(el('p',hints[step],'start-hint'));
      const next=button(singleExercise?'Завершить упражнение':step===8?'Завершить знакомство':'Далее',()=>run({type:'next'}),'button primary');
      function sync() {
        syncControls?.();
        next.disabled = !ready(state);
        feedback.replaceChildren();
        if (notice) feedback.append(el('p', notice));
        if (state.feedback) {
          const message = step === 5 && state.scale === 12 ? 'Отметка 0,12 мм установлена.' : state.feedback;
          feedback.append(el('p', message));
        }
      }
      if (syncControls) syncAdjustment = sync;
      sync();
      host.append(next);root.CNCNormativeUI?.appendLesson(host,step===3||step===4?'safety':step>=5?'diameter':'machine');
      if(focus==='title')title.focus();else if(focus==='feedback')feedback.focus({preventScroll:true});
    }
    render();return host;
  }
  root.CNCStartSessionUI=Object.freeze({create});
})(window);
