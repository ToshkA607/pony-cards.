const $ = (id) => document.getElementById(id);
let questResetDeadline=0,questRefreshPending=false;
let gameState = null, toastTimer, assetManifest = {}, questClockTimer = null;

// Reuse decoded images so pack cards do not flash from an empty frame during reveal.
const decodedImageCache = new Map();
function preloadImage(src) {
 if(!src)return Promise.resolve(false);
 if(decodedImageCache.has(src))return decodedImageCache.get(src);
 const task=new Promise(resolve=>{
  const image=new Image();let settled=false;
  const finish=ok=>{if(settled)return;settled=true;const ready=!!ok&&image.naturalWidth>0;if(!ready)decodedImageCache.delete(src);resolve(ready);};
  image.decoding='async';image.onload=async()=>{try{if(image.decode)await image.decode();}catch(_){}finish(true);};
  image.onerror=()=>finish(false);
  image.src=src;
  if(image.complete&&image.naturalWidth)finish(true);
 });
 decodedImageCache.set(src,task);
 return task;
}
async function loadAssetManifest(){try{const r=await fetch('/assets/user-content/asset-manifest.json?v=2.54.0-startup-preload');if(r.ok)assetManifest=await r.json();}catch(e){console.warn('Asset manifest not loaded; using default artwork.',e);}if(assetManifest.backgrounds?.home)document.documentElement.style.setProperty('--home-background-image',`url(\"${assetManifest.backgrounds.home}\")`);if(game?.sky){game.sky.src=assetManifest.backgrounds?.flight||'/assets/sky-world-4k.jpg';if(!selectedSkin||selectedSkin==='twilight'){game.ponyOpen.src=assetManifest.characters?.open||'/assets/characters/twilight-flight-open.png?v=2.31';game.ponyFold.src=assetManifest.characters?.folded||'/assets/characters/twilight-flight-folded.png?v=2.31';}}const menuPony=document.querySelector('.home-pony img');if(menuPony&&assetManifest.characters?.menu)menuPony.src=assetManifest.characters.menu;const featuredPack=document.querySelector('.pack-preview img');if(featuredPack&&assetManifest.packs?.basic)featuredPack.src=assetManifest.packs.basic;}
async function preloadAllGameAssets(){
 const urls=new Set(['/assets/ui/logo.png','/assets/ui/heart.png','/assets/ui/coin.png','/assets/ui/card-back.png','/assets/pack-sky.svg','/assets/characters/chrysalis-boss.png','/assets/characters/nightmare-moon.png','/assets/characters/discord-boss.png','/assets/backgrounds/level-1.png','/assets/backgrounds/level-2.png','/assets/backgrounds/level-3.png']);
 Object.values(assetManifest.backgrounds||{}).forEach(u=>u&&urls.add(u));
 Object.values(assetManifest.characters||{}).forEach(u=>u&&urls.add(u));
 Object.values(assetManifest.cards||{}).forEach(u=>u&&urls.add(u));
 Object.values(assetManifest.packs||{}).forEach(u=>u&&urls.add(u));
 Object.values(assetManifest.effects||{}).forEach(u=>u&&urls.add(u));
 (skinOptions||[]).forEach(s=>[s.menu,s.flight,s.folded].forEach(u=>u&&urls.add(u)));
 document.querySelectorAll('img[src]').forEach(img=>{if(img.getAttribute('src'))urls.add(img.getAttribute('src'));});
 const queue=[...urls];
 for(let i=0;i<queue.length;i+=4){await Promise.all(queue.slice(i,i+4).map(preloadImage));await new Promise(resolve=>setTimeout(resolve,0));}
}
// Level soundtracks are separate from the existing menu music. The menu soundtrack
// and its synthesizer remain untouched; only campaign gameplay selects tracks 1–3.
const levelSoundtrack = {
  audio: null,
  mode: 'flight',
  setVolume(v){const a=this.ensure();a.volume=Math.max(0,Math.min(1,Number(v)));localStorage.setItem('ponyMusicVolume',String(a.volume));},
  ensure() {
    if (!this.audio) { this.audio = new Audio(); this.audio.loop = true; this.audio.preload = 'auto'; this.audio.volume = Number(localStorage.getItem('ponyMusicVolume') ?? 0.7); }
    return this.audio;
  },
  set(mode) {
    const a=this.ensure(), m=mode==='boss'?'boss':'flight';
    const src=`/assets/music/${m}.mp3`;
    if(this.mode!==m || !a.src.endsWith(src)){ a.pause(); a.src=src; a.currentTime=0; this.mode=m; }
    if(soundFX.enabled) a.play().catch(err=>console.warn('Soundtrack could not start:',err));
  },
  play(level) { this.set('flight'); },
  boss() { this.set('boss'); },
  pause(){if(this.audio)this.audio.pause();},
  resume(){if(this.audio&&soundFX.enabled)this.audio.play().catch(()=>{});},
  stop(){if(this.audio){this.audio.pause();this.audio.currentTime=0;}this.mode='flight';}
};
// All sounds are synthesized locally with Web Audio: no external downloads or audio files required.
const soundFX = {
  ctx: null, enabled: localStorage.getItem('ponySoundEnabled') !== 'false', music: true, master: Number(localStorage.getItem('ponyFxVolume') ?? 0.7), musicTimer: null, note: 0,
  unlock(){ if(!this.ctx){ const Ctx=window.AudioContext||window.webkitAudioContext; if(Ctx)this.ctx=new Ctx(); } if(this.ctx?.state==='suspended')this.ctx.resume(); this.updateButton(); },
  updateButton(){const b=$('sound-all-off');if(b)b.textContent=this.enabled?'Выключить всё':'Включить звук';},
  toggle(){this.enabled=!this.enabled;localStorage.setItem('ponySoundEnabled',String(this.enabled));if(this.enabled)this.unlock();this.updateButton();if(this.enabled){this.ui();if($('play')?.classList.contains('active')&&game?.running&&!game.paused)levelSoundtrack.resume();}else{this.stopMusic();levelSoundtrack.pause();}},
  tone(freq,duration=.12,type='sine',volume=.12,when=0,slide=0){if(!this.enabled||!this.ctx)return;const t=this.ctx.currentTime+when,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),t+duration);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,volume*this.master),t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(this.ctx.destination);o.start(t);o.stop(t+duration+.03);},
  ui(){this.tone(620,.055,'sine',.07);this.tone(880,.07,'sine',.045,.035);},
  flap(){this.tone(360,.09,'triangle',.08,0,-130);this.tone(520,.06,'sine',.035,.025,-100);},
  // Distinct synthesized combat cues; no external sound files required.
  attackAcid(){this.tone(260,.16,'sawtooth',.075,0,-150);this.tone(190,.22,'triangle',.045,.035,-90);},
  attackDark(){this.tone(95,.42,'sawtooth',.09,0,-55);this.tone(145,.3,'sine',.055,.06,-90);this.tone(420,.16,'triangle',.025,.12,-260);},
  attackLightning(){this.tone(980,.07,'square',.055,0,-620);this.tone(620,.12,'sawtooth',.05,.055,-390);this.tone(340,.16,'triangle',.04,.11,-180);},
  attackBlackHole(){this.tone(210,.5,'sine',.07,0,-165);this.tone(130,.55,'triangle',.06,.08,-95);this.tone(70,.42,'sawtooth',.035,.18,-25);},
  attackLaser(){this.tone(520,.24,'sawtooth',.05,0,720);this.tone(1120,.32,'square',.035,.12,-700);},
  attackVolley(){this.tone(440,.08,'triangle',.045);this.tone(660,.09,'sawtooth',.04,.09,-260);this.tone(330,.12,'triangle',.035,.18,-150);},
  playerMagic(){this.tone(720,.1,'sine',.065,0,420);this.tone(1180,.13,'triangle',.035,.045,-280);},
  coin(){this.tone(880,.12,'sine',.12);this.tone(1320,.2,'sine',.08,.055);this.tone(1760,.16,'triangle',.035,.11);},
  pass(){this.tone(520,.11,'sine',.055);this.tone(660,.12,'sine',.045,.07);},
  crash(){this.tone(170,.22,'triangle',.14,0,-100);this.tone(90,.3,'sawtooth',.045,.025,-45);},
  pack(){this.tone(280,.24,'sine',.09,0,500);this.tone(420,.3,'triangle',.06,.12,620);this.tone(650,.28,'sine',.06,.26,500);},
  reveal(rarity){const seq=rarity==='Легендарная'?[660,880,1100,1480,1760]:rarity==='Эпическая'?[520,690,870,1040]:rarity==='Редкая'?[440,590,740]:[390,520];seq.forEach((f,i)=>this.tone(f,.22,'sine',.085,i*.075));},
  startMusic(){if(!this.enabled||!this.ctx||this.musicTimer)return;const notes=[392,494,587,494,440,523,659,523];this.musicTimer=setInterval(()=>{if(!this.enabled||!this.ctx)return;const f=notes[this.note++%notes.length];this.tone(f,.48,'sine',.022);this.tone(f/2,.55,'triangle',.012,.02);},620);},
  stopMusic(){if(this.musicTimer){clearInterval(this.musicTimer);this.musicTimer=null;}}
};
async function api(url, options = {}) {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Ошибка сервера (${response.status})`);
  return data;
}
function showToast(message) { const el=$('toast'); if(!el)return; el.textContent=message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2600); }
function fmt(value){return Math.max(0,Number(value)||0).toLocaleString('ru-RU');}
function renderDailyQuests(){
 const root=$('daily-quests');if(!root||!gameState?.dailyQuests)return;
 const q=gameState.dailyQuests;if(!questResetDeadline||questResetDeadline<=Date.now())questResetDeadline=Date.now()+Math.max(0,Number(q.secondsUntilReset)||0)*1000;questRefreshPending=false;const items=[
  {id:'flight',icon:'▥',title:'Пролететь через 10 колонн',progress:Math.floor(Number(q.flightMeters||0)/10),goal:10,reward:150},
  {id:'pack',icon:'▤',title:'Открыть набор',progress:Number(q.packsOpened||0),goal:1,reward:100},
  {id:'coins',icon:'●',title:'Собрать 30 монет',progress:Number(q.coinsCollected||0),goal:30,reward:75}
 ];
 root.innerHTML='';items.forEach((it,i)=>{const claimed=(Number(q.claimedMask||0)&(1<<i))!==0,done=it.progress>=it.goal;const row=document.createElement('div');row.className='quest'+(claimed?' quest-claimed':done?' quest-done':'');const icon=document.createElement('span');icon.className='quest-symbol';icon.textContent=it.icon;const body=document.createElement('div');body.className='quest-body';const title=document.createElement('b');title.textContent=it.title;const meta=document.createElement('small');meta.textContent=`${Math.min(it.progress,it.goal)} / ${it.goal} · награда ${it.reward} монет`;const track=document.createElement('div');track.className='quest-progress';const fill=document.createElement('i');fill.style.width=`${Math.min(100,it.progress/it.goal*100)}%`;track.append(fill);body.append(title,meta,track);const btn=document.createElement('button');btn.className='quest-claim';btn.textContent=claimed?'Получено':done?'Забрать':'В процессе';btn.disabled=claimed||!done;btn.addEventListener('click',()=>claimQuest(it.id));row.append(icon,body,btn);root.append(row);});
 updateQuestTimer();if(!questClockTimer)questClockTimer=setInterval(updateQuestTimer,1000);
}
function updateQuestTimer(){const el=$('daily-quest-timer');if(!el||!gameState?.dailyQuests)return;const n=Math.max(0,Math.ceil((questResetDeadline-Date.now())/1000));const h=String(Math.floor(n/3600)).padStart(2,'0'),m=String(Math.floor(n%3600/60)).padStart(2,'0'),s=String(n%60).padStart(2,'0');el.textContent=`Сброс заданий через ${h}:${m}:${s}`;if(n===0&&!questRefreshPending){questRefreshPending=true;refresh().then(()=>{questResetDeadline=Date.now()+Math.max(0,Number(gameState?.dailyQuests?.secondsUntilReset)||3600)*1000;renderDailyQuests();}).catch(()=>{questRefreshPending=false;});}}
async function claimQuest(id){try{const r=await api('/api/quests/claim',{method:'POST',body:JSON.stringify({questId:id})});gameState=r.state;updateHeader();renderShop();renderDailyQuests();soundFX.coin();showToast(`Награда получена: +${r.reward} монет!`);}catch(e){showToast(e.message);}}
function updateHeader() {
  const p=gameState?.profile||{};
  $('coin-count').textContent=fmt(p.coins);
  $('best-score').textContent=fmt(Math.floor((Number(p.best_score)||0)/10));
  const ownedCount=Array.isArray(gameState?.collection)?gameState.collection.length:0;
  const cardCount=$('home-card-count');if(cardCount)cardCount.textContent=fmt(ownedCount);
  const bossRecord=$('best-boss-damage');if(bossRecord)bossRecord.textContent=fmt(Number(p.best_boss_damage)||0);
  renderDailyQuests();
}
async function refresh(){gameState=await api('/api/game');updateHeader();renderShop();renderCollection();renderAchievements();}
function go(screen){if(screen!=='play')levelSoundtrack.stop();document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id===screen));document.querySelectorAll('[data-screen]').forEach(b=>b.classList.toggle('selected',b.dataset.screen===screen));document.querySelectorAll('.top-link').forEach(b=>b.classList.toggle('active',b.dataset.screen===screen));if(screen==='play')requestAnimationFrame(()=>game.resize());else if(game.running)game.pause(true);}
document.querySelectorAll('[data-screen]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.screen)));
// Иллюстрации карточек намеренно оставлены пустыми: изображения можно добавить позже.
const packArt={basic:'sky-pack.png',magic:'magic-pack.png',royal:'royal-pack.png'};
function packUrl(id){return assetManifest.packs?.[id]||`/assets/packs/${packArt[id]||packArt.basic}`;}

function renderShop(){const root=$('pack-list');root.innerHTML='';gameState.packs.forEach(pack=>{const card=document.createElement('article');card.className='pack';const art=document.createElement('img');art.className='pack-cover';art.src=packUrl(pack.id);art.alt=`Обложка: ${pack.name||'набор'}`;const h=document.createElement('h3');h.textContent=pack.name||'Набор карточек';const p=document.createElement('p');p.textContent=pack.description||'Собери свою коллекцию';const odds=document.createElement('small');odds.className='pack-odds';odds.textContent=pack.odds||'Шансы на редкость';const pity=document.createElement('small');pity.className='pack-pity';pity.textContent=`До гарантированной легендарной: не более ${pack.pityRemaining} открытий`;const b=document.createElement('button');b.disabled=Number(gameState.profile.coins)<Number(pack.price);b.dataset.pack=pack.id;b.innerHTML=`<span class="coin-inline" aria-hidden="true"></span> ${fmt(pack.price)} · 1 карта`;card.append(art,h,p,odds,pity,b);root.append(card);});root.querySelectorAll('[data-pack]').forEach(b=>b.addEventListener('click',()=>openPack(b.dataset.pack)));
 const upgrades=gameState.upgrades||{};
 const upgradeDefs=[
  ['max_health','❤','Дополнительное здоровье','+1 сердце к запасу здоровья',220,1.28,5],
  
  ['magic_power','✧','Сила магии','Увеличивает урон магических атак босса на 25%',320,1.3,5],
  ['shield','◇','Прочная защита','Увеличивает время неуязвимости после попадания',320,1.3,5],
  ['regeneration','✚','Восстановление','Восстанавливает одно сердце во время долгого боя',480,1.32,3],
  ['flight_speed','⚡','Скорость полёта','Ускоряет полёт и помогает проходить башни',100,1.28,10]
 ];
 upgradeDefs.forEach(([id,icon,title,desc,base,mult,max])=>{const level=Number(upgrades[id]||0),price=Math.ceil(base*Math.pow(mult,level));const panel=document.createElement('article');panel.className='upgrade-panel';panel.innerHTML=`<div class="upgrade-emblem">${icon}</div><div class="upgrade-copy"><small>ПОСТОЯННОЕ УЛУЧШЕНИЕ</small><h3>${title}</h3><p>${desc}</p><small>Уровень ${level}/${max} · ${level>=max?'Максимум достигнут':`Следующая покупка: ${fmt(price)} монет`}</small></div><button class="upgrade-buy" ${level>=max||Number(gameState.profile.coins)<price?'disabled':''}>${level>=max?'Максимум':`Купить · <span class=\"coin-inline\" aria-hidden=\"true\"></span> ${fmt(price)}`}</button>`;panel.querySelector('button').addEventListener('click',()=>buyUpgrade(id));root.append(panel);});
 const slotLevel=Number(upgrades.card_slots||0),slotCount=1+slotLevel,slotPrice=Math.ceil(500*Math.pow(1.5,slotLevel));const slotPanel=document.createElement('article');slotPanel.className='upgrade-panel card-slot-upgrade';slotPanel.innerHTML=`<div class="upgrade-emblem">▣</div><div class="upgrade-copy"><small>ПОСТОЯННОЕ УЛУЧШЕНИЕ</small><h3>Слоты способностей</h3><p>Позволяет одновременно применять эффекты нескольких карточек.</p><small>${slotCount}/5 слотов · ${slotLevel>=4?'Максимум достигнут':`Следующее улучшение: ${fmt(slotPrice)} монет`}</small></div><button class="upgrade-buy" ${slotLevel>=4||Number(gameState.profile.coins)<slotPrice?'disabled':''}>${slotLevel>=4?'Максимум':`Купить · <span class=\"coin-inline\" aria-hidden=\"true\"></span> ${fmt(slotPrice)}`}</button>`;slotPanel.querySelector('button').addEventListener('click',()=>buyUpgrade('card_slots'));root.append(slotPanel);

}
async function buyUpgrade(id){try{const r=await api('/api/shop/upgrade',{method:'POST',body:JSON.stringify({upgradeId:id})});gameState=r.state;updateHeader();renderShop();renderCollection();showToast('Постоянное улучшение куплено!');}catch(e){showToast(e.message);}}
function renderCollection(){
 const owned=new Map((gameState.collection||[]).map(c=>[c.id,c])),count=owned.size,total=gameState.catalog?.length||0,activeSlots=gameState.activeCards||[];
 $('collection-progress-text').textContent=`${count} из ${total}`;$('progress-fill').style.width=`${total?count/total*100:0}%`;
 const panel=$('active-card-panel');panel.innerHTML='';
 const heading=document.createElement('div');heading.className='active-panel-heading';
 const eyebrow=document.createElement('small');eyebrow.textContent='ТВОИ АКТИВНЫЕ КАРТЫ';
 const title=document.createElement('b');title.textContent=activeSlots.length?`Экипировано: ${activeSlots.length}`:'Пока ничего не экипировано';
 const hint=document.createElement('span');hint.textContent='Выбери карты в коллекции и назначь их в свободные слоты.';
 heading.append(eyebrow,title,hint);panel.append(heading);
 const slots=document.createElement('div');slots.className='active-slots-list';
 const slotCount=Math.min(5,1+Number(gameState.upgrades?.card_slots||0));
 for(let i=1;i<=slotCount;i++){
  const active=activeSlots.find(c=>Number(c.slot)===i);const row=document.createElement('div');row.className='active-slot-row'+(active?' slot-filled':' slot-empty');
  const number=document.createElement('span');number.className='slot-number';number.textContent=String(i);
  const info=document.createElement('span');info.className='slot-card-info';
  if(active){const name=document.createElement('b');name.textContent=active.name;const desc=document.createElement('small');desc.textContent=active.ability_name||'Способность';info.append(name,desc);}
  else info.textContent='Свободный слот — выбери карту ниже';
  row.append(number,info);
  if(active){const off=document.createElement('button');off.className='slot-remove';off.textContent='Снять';off.addEventListener('click',()=>unequipCard(i));row.append(off);}
  slots.append(row);
 }
 panel.append(slots);
 const root=$('card-grid');const cardFragment=document.createDocumentFragment();const favoriteIds=new Set(gameState.favoriteCardIds||[]);const rarityRank={'Обычная':1,'Редкая':2,'Эпическая':3,'Легендарная':4};let cards=[...(gameState.catalog||[])];const filter=$('collection-filter')?.value||'all',sort=$('collection-sort')?.value||'rarity-desc';if(filter==='owned')cards=cards.filter(c=>owned.has(c.id));if(filter==='favorites')cards=cards.filter(c=>favoriteIds.has(c.id));cards.sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'ru'):sort==='rarity-asc'?rarityRank[a.rarity]-rarityRank[b.rarity]:rarityRank[b.rarity]-rarityRank[a.rarity]);cards.forEach(c=>{const item=owned.get(c.id),activeSlot=activeSlots.find(s=>s.id===c.id),el=document.createElement('article');el.className=`pony-card ${item?'':'locked'} rarity-${rarityClass(c.rarity)} ${activeSlot?'equipped':''}`;const art=document.createElement('div');art.className='art';art.style.setProperty('--card-color',c.color||'#9b80d8');const imageUrl=assetManifest.cards?.[c.id];if(item&&imageUrl){const image=document.createElement('img');image.className='card-art-image';image.src=imageUrl;image.alt=c.name||'Артефакт';image.loading='lazy';image.onerror=()=>{image.remove();const mark=document.createElement('span');mark.className='art-placeholder';mark.textContent=c.emoji||'✦';art.append(mark);};art.append(image);}else{const mark=document.createElement('span');mark.className=item?'art-placeholder':'locked-mark';mark.textContent=item?(c.emoji||'✦'):'?';art.append(mark);}if(item&&item.quantity>1){const qty=document.createElement('span');qty.className='qty';qty.textContent=`×${item.quantity}`;art.append(qty);}const info=document.createElement('div');info.className='info';const name=document.createElement('b');name.textContent=c.name||'Пони';const rarity=document.createElement('small');rarity.textContent=c.rarity||'Обычная';info.append(name,rarity);const ability=document.createElement('p');ability.className='card-ability';ability.textContent=item?(c.ability_name||'Способность')+': '+(c.ability_description||''):'Открой набор, чтобы узнать способность';el.append(art,info,ability);if(item){const fav=document.createElement('button');fav.type='button';fav.className='favorite-card-btn'+(favoriteIds.has(c.id)?' is-favorite':'');fav.textContent=favoriteIds.has(c.id)?'♥ В избранном':'♡ В избранное';fav.addEventListener('click',()=>toggleFavorite(c.id));el.append(fav);const equip=document.createElement('div');equip.className='equip-slot-buttons';for(let i=1;i<=slotCount;i++){const b=document.createElement('button');b.className='equip-card-btn';b.textContent=activeSlot?.slot===i?'В слоте '+i:'В слот '+i;b.disabled=activeSlot?.slot===i;b.addEventListener('click',()=>equipCard(c.id,i));equip.append(b);}el.append(equip);}cardFragment.append(el);});
 const empty=document.createElement('p');empty.className='collection-empty';empty.textContent=cards.length?'':'Здесь пока нет карточек. Измени фильтр или добавь карты в избранное.';if(!cards.length)cardFragment.append(empty);root.replaceChildren(cardFragment);root.classList.remove('cards-refresh');void root.offsetWidth;root.classList.add('cards-refresh');
}
async function toggleFavorite(cardId){try{gameState=await api('/api/cards/favorite',{method:'POST',body:JSON.stringify({cardId})});renderCollection();}catch(e){showToast(e.message);}}
function renderAchievements(){const root=$('achievement-grid');if(!root||!gameState?.achievements)return;root.innerHTML='';const list=gameState.achievements,done=list.filter(a=>a.unlocked).length;const summary=$('achievement-summary');if(summary)summary.textContent=`Получено ${done} из ${list.length} достижений`;list.forEach(a=>{const card=document.createElement('article');card.className='achievement-card'+(a.unlocked?' achievement-unlocked':'');const icon=document.createElement('span');icon.className='achievement-icon';icon.textContent=a.unlocked?'🏆':'✧';const body=document.createElement('div');body.className='achievement-body';const title=document.createElement('b');title.textContent=a.title;const desc=document.createElement('small');desc.textContent=a.description;const track=document.createElement('div');track.className='achievement-track';const fill=document.createElement('i');fill.style.width=`${Math.min(100,Number(a.progress)/Number(a.goal)*100)}%`;track.append(fill);const meta=document.createElement('small');meta.textContent=a.unlocked?`Получено · награда ${a.reward} монет`:`${fmt(a.progress)} / ${fmt(a.goal)} · награда ${a.reward} монет`;body.append(title,desc,track,meta);card.append(icon,body);root.append(card);});}

async function equipCard(cardId,slot){try{gameState=await api('/api/cards/equip',{method:'POST',body:JSON.stringify({cardId,slot:String(slot)})});updateHeader();renderCollection();showToast(`Способность применена в слот ${slot}!`);}catch(e){showToast(e.message);}}
async function unequipCard(slot){try{gameState=await api('/api/cards/unequip',{method:'POST',body:JSON.stringify({slot:String(slot)})});updateHeader();renderCollection();showToast('Способность снята.');}catch(e){showToast(e.message);}}

function rarityClass(r){return({'Обычная':'common','Редкая':'rare','Эпическая':'epic','Легендарная':'legendary'})[r]||'common';}
async function openPack(id){
 try{
  soundFX.unlock();
  const packEl=[...document.querySelectorAll('.pack')].find(el=>el.querySelector(`[data-pack="${id}"]`));
  if(packEl){packEl.classList.add('pack-opening');setTimeout(()=>packEl.classList.remove('pack-opening'),1200);}
  soundFX.pack();
  const result=await api('/api/shop/open',{method:'POST',body:JSON.stringify({packId:id})});
  const revealImages=result.opened.map(c=>assetManifest.cards?.[c.id]||c.image_url||c.imageUrl||c.art_url||c.artUrl||'');
  const cardArtReady=await Promise.all(revealImages.map(src=>src?preloadImage(src):Promise.resolve(false)));
  gameState=result.state;updateHeader();renderShop();renderCollection();
  const openedRoot=$('opened-cards');openedRoot.innerHTML='';
  result.opened.forEach((c,i)=>{
   const card=document.createElement('article');
   card.className=`opened-card rarity-${rarityClass(c.rarity)}${c.pityTriggered?' pity-triggered':''}`;
   const art=document.createElement('div');art.className='opened-card-art';
   const image=document.createElement('img');
   image.className='pack-card-image';image.decoding='async';image.loading='eager';
   image.src='/assets/ui/card-back.png';
   image.alt='Рубашка карты';
   image.onerror=()=>{image.onerror=null;image.src='';image.classList.add('pack-card-fallback');};
   art.append(image);
   const meta=document.createElement('div');meta.className='opened-card-meta';
   if(c.duplicate){const dup=document.createElement('strong');dup.className='duplicate-label';dup.textContent='ДУБЛИКАТ';meta.append(dup);}
   const name=document.createElement('b');name.textContent=c.name||'Пони';
   const rarity=document.createElement('small');rarity.textContent=c.rarity||'Обычная';
   const ability=document.createElement('p');ability.className='revealed-ability';ability.textContent=`${c.ability_name||'Способность'}: ${c.ability_description||''}`;
   meta.append(name,rarity,ability);if(c.pityTriggered){const pity=document.createElement('small');pity.className='pity-notice';pity.textContent='ГАРАНТИРОВАННАЯ ЛЕГЕНДАРКА!';meta.append(pity);}
   if(c.duplicate){const detail=document.createElement('small');detail.className='duplicate-detail';detail.textContent=`Теперь ×${c.quantity} в коллекции`;meta.append(detail);}
   card.append(art,meta);openedRoot.append(card);
   const revealImageUrl=assetManifest.cards?.[c.id]||c.image_url||c.imageUrl||c.art_url||c.artUrl||'';
   setTimeout(async()=>{
    let artReady=!!(revealImageUrl&&cardArtReady[i]);
    if(!artReady&&revealImageUrl)artReady=await preloadImage(revealImageUrl);
    if(artReady){image.src=revealImageUrl;image.alt=c.name||'Артефакт';try{if(image.decode)await image.decode();}catch(_){artReady=false;}}
    card.classList.add('is-flipping');
    setTimeout(()=>{
     if(artReady){image.classList.remove('pack-card-fallback');}
     else{image.removeAttribute('src');image.classList.add('pack-card-fallback');}
     card.classList.add('is-revealed');
    },360);
   },700+i*350);
  });
  const modalContent=$('pack-modal').querySelector('.modal-content');
  modalContent.classList.remove('revealing');void modalContent.offsetWidth;modalContent.classList.add('revealing');
  $('pack-modal').classList.remove('hidden');$('pack-modal').classList.toggle('epic-reveal',result.opened.some(c=>c.rarity==='Эпическая'));$('pack-modal').classList.toggle('legendary-reveal',result.opened.some(c=>c.rarity==='Легендарная'));renderAchievements();
  result.opened.forEach((c,i)=>setTimeout(()=>soundFX.reveal(c.rarity),900+i*350));
 }catch(e){showToast(e.message);}
}
$('modal-close').onclick=$('modal-done').onclick=()=>{$('pack-modal').classList.add('hidden');$('pack-modal').classList.remove('epic-reveal','legendary-reveal');};
$('collection-filter')?.addEventListener('change',renderCollection);$('collection-sort')?.addEventListener('change',renderCollection);
$('daily-reward').addEventListener('click',async()=>{soundFX.unlock();soundFX.ui();try{const result=await api('/api/reward/daily',{method:'POST'});gameState=result.state;updateHeader();renderShop();showToast(`Ежедневный подарок: +${result.reward} монет!`);$('daily-reward').classList.add('claimed');}catch(e){showToast(e.message);}});


const campaignLevels=[
 {id:1,name:'Зачарованный лес',difficulty:'Лёгкий',towers:10,boss:'Королева Кризалис',bossImage:'/assets/characters/chrysalis-boss.png?v=2.52',hp:7,speed:1,gap:1,hue:'0deg',background:'/assets/backgrounds/level-1.png?v=2.52',description:'Ядовитые снаряды, кислотные облака и расщепляющиеся ядра.'},
 {id:2,name:'Лунный лес',difficulty:'Средний',towers:15,boss:'Nightmare Moon',bossImage:'/assets/characters/nightmare-moon.png?v=2.52',hp:10,speed:1.18,gap:.88,hue:'250deg',background:'/assets/backgrounds/level-2.png?v=2.52',description:'Лунные лучи, два прохода между колоннами, торнадо и лунные снаряды.'},
 {id:3,name:'Цитадель хаоса',difficulty:'Кошмарный',towers:20,boss:'Дискорд',bossImage:'/assets/characters/discord-boss.png?v=2.52',hp:16,speed:1.38,gap:.76,hue:'115deg',background:'/assets/backgrounds/level-3.png?v=2.52',description:'Три лазера, чёрные дыры и разрушительные залпы из десяти снарядов.'}
];
let selectedLevel=1;
function renderCampaign(){const root=document.querySelector('.level-grid');if(!root)return;const unlocked=Number(gameState?.campaign?.unlockedLevel||1),mask=Number(gameState?.campaign?.completedMask||0);root.querySelectorAll('[data-level]').forEach(btn=>{const id=Number(btn.dataset.level),level=campaignLevels[id-1],open=id<=unlocked,done=(mask&(1<<(id-1)))!==0;btn.disabled=!open;btn.classList.toggle('locked',!open);btn.classList.toggle('completed',done);const status=btn.querySelector('strong');if(status)status.textContent=done?'Пройдено · Играть':open?'Играть':`Закрыт · пройди уровень ${id-1}`;});}
const skinOptions=[
 {id:'twilight',name:'Искорка',menu:'/assets/characters/twilight-menu-transparent.png?v=2.40',flight:'/assets/characters/twilight-flight-open.png?v=2.40',folded:'/assets/characters/twilight-flight-folded.png?v=2.40'},
 {id:'rainbow',name:'Радуга',menu:'/assets/characters/rainbow-dash-menu.png?v=2.40',flight:'/assets/characters/rainbow-dash-flight-open.png?v=2.40',folded:'/assets/characters/rainbow-dash-flight-folded.png?v=2.40'},
 {id:'fluttershy',name:'Флаттершай',menu:'/assets/characters/fluttershy-menu.png?v=2.40',flight:'/assets/characters/fluttershy-flight-open.png?v=2.40',folded:'/assets/characters/fluttershy-flight-folded.png?v=2.40'}
];
let selectedSkin=localStorage.getItem('ponySelectedSkin')||'twilight';
if(!skinOptions.some(s=>s.id===selectedSkin)){selectedSkin='twilight';localStorage.setItem('ponySelectedSkin','twilight');}
function renderSkins(){const root=$('skin-grid');if(!root)return;root.innerHTML='';skinOptions.forEach(s=>{const b=document.createElement('button');b.className='skin-choice'+(selectedSkin===s.id?' selected':'');b.type='button';const frame=document.createElement('span');frame.className='skin-art-frame';const img=document.createElement('img');img.src=s.menu;img.alt=s.name;img.loading='lazy';frame.append(img);const name=document.createElement('b');name.textContent=s.name;const status=document.createElement('small');status.textContent=selectedSkin===s.id?'Выбран':'Выбрать';b.append(frame,name,status);b.addEventListener('click',()=>{selectedSkin=s.id;localStorage.setItem('ponySelectedSkin',s.id);applySkin();renderSkins();showToast(`Скин «${s.name}» выбран`);});root.append(b);});}
function applySkin(){const skin=skinOptions.find(s=>s.id===selectedSkin)||skinOptions[0];if(game){game.ponyOpen.src=skin.flight;game.ponyFold.src=skin.folded;game.skinPortrait=false;}const menu=document.querySelector('.home-pony img');if(menu){menu.src=skin.menu;menu.classList.remove('skin-portrait');}}
class FluttershyButterflyProjectile {
 constructor(x,y,targetX,targetY,onHit){this.x=x;this.y=y;const dx=targetX-x,dy=targetY-y,d=Math.hypot(dx,dy)||1;this.speed=960;this.vx=dx/d*this.speed;this.vy=dy/d*this.speed;this.angle=Math.atan2(dy,dx);this.targetX=targetX;this.targetY=targetY;this.onHit=onHit;this.dead=false;this.time=Math.random()*Math.PI*2;this.trail=[];this.sparkles=[];this.size=20;}
 update(dt){if(this.dead)return;this.x+=this.vx*dt;this.y+=this.vy*dt;this.trail.push({x:this.x,y:this.y});if(this.trail.length>10)this.trail.shift();this.time+=dt*13;if(Math.random()<Math.min(.95,dt*24))this.sparkles.push({x:this.x+(Math.random()-.5)*26,y:this.y+(Math.random()-.5)*26,vx:(Math.random()-.5)*55,vy:(Math.random()-.5)*55,life:.55,maxLife:.55,size:1+Math.random()*1.5});for(let i=this.sparkles.length-1;i>=0;i--){const p=this.sparkles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;if(p.life<=0)this.sparkles.splice(i,1);}if(Math.hypot(this.x-this.targetX,this.y-this.targetY)<22){this.dead=true;this.onHit?.();}}
 wing(ctx,draw,fill,stroke){ctx.beginPath();draw();ctx.closePath();ctx.fillStyle=fill;ctx.strokeStyle=stroke;ctx.lineWidth=1.4;ctx.shadowColor='#ffeebb';ctx.shadowBlur=4;ctx.fill();ctx.stroke();}
 draw(ctx){const s=this.size;ctx.save();for(let i=0;i<this.trail.length;i++){const p=this.trail[i],a=i/this.trail.length*.23;ctx.globalAlpha=a;ctx.fillStyle='#ffb3d9';ctx.shadowColor='#ffb3d9';ctx.shadowBlur=6;ctx.beginPath();ctx.arc(p.x,p.y,i/this.trail.length*3.5,0,Math.PI*2);ctx.fill();}for(const p of this.sparkles){ctx.globalAlpha=Math.max(0,p.life/p.maxLife)*.48;ctx.fillStyle='#fff5d0';ctx.shadowColor='#ffeebb';ctx.shadowBlur=4;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;const glow=ctx.createRadialGradient(this.x,this.y,0,this.x,this.y,s*1.6);glow.addColorStop(0,'rgba(255,240,190,.22)');glow.addColorStop(.4,'rgba(255,232,160,.10)');glow.addColorStop(1,'rgba(255,220,120,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(this.x,this.y,s*1.6,0,Math.PI*2);ctx.fill();const flap=(Math.sin(this.time)+1)/2;ctx.translate(this.x,this.y);ctx.rotate(this.angle+Math.PI/2);const scale=.35+flap*.65;for(let side=-1;side<=1;side+=2){ctx.save();ctx.scale(side*scale,1);this.wing(ctx,()=>{ctx.moveTo(0,0);ctx.bezierCurveTo(s*.35,-s,s*1.15,-s*.95,s,-s*.35);ctx.bezierCurveTo(s*.95,-s*.1,s*.5,-s*.05,0,0);},'#ffb3d9','#d63384');ctx.globalAlpha=.9;ctx.shadowBlur=0;ctx.fillStyle='#d63384';ctx.beginPath();ctx.arc(s*.65,-s*.55,s*.13,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff5fa';ctx.beginPath();ctx.arc(s*.65,-s*.55,s*.07,0,Math.PI*2);ctx.fill();this.wing(ctx,()=>{ctx.moveTo(0,0);ctx.bezierCurveTo(s*.25,s*.45,s*.85,s*.7,s*.8,s*.25);ctx.bezierCurveTo(s*.7,s*.05,s*.35,s*.02,0,0);},'#ffcce5','#d63384');ctx.fillStyle='#d63384';ctx.beginPath();ctx.arc(s*.45,s*.35,s*.09,0,Math.PI*2);ctx.fill();ctx.restore();}ctx.globalAlpha=1;ctx.shadowBlur=0;ctx.fillStyle='#8b3a5e';ctx.beginPath();ctx.ellipse(0,s*.05,s*.07,s*.45,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(0,-s*.4,s*.1,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#d63384';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(0,-s*.45);ctx.quadraticCurveTo(-s*.25,-s*.85,-s*.35,-s*.95);ctx.moveTo(0,-s*.45);ctx.quadraticCurveTo(s*.25,-s*.85,s*.35,-s*.95);ctx.stroke();ctx.fillStyle='#d63384';ctx.beginPath();ctx.arc(-s*.35,-s*.95,s*.06,0,Math.PI*2);ctx.arc(s*.35,-s*.95,s*.06,0,Math.PI*2);ctx.fill();ctx.restore();}
}

const game={canvas:$('game-canvas'),selectedLevel:1,levelConfig:campaignLevels[0],ctx:null,w:0,h:0,dpr:1,raf:0,running:false,paused:false,over:false,score:0,coins:0,combo:0,shieldUsed:false,activeEffect:null,comboTimer:0,world:0,spawn:0,last:0,lastTap:0,obstacles:[],pickups:[],particles:[],shake:0,bossMode:false,bossFinished:false,bossTransition:null,finalObstacle:null,bossImage:new Image(),skinPortrait:false,boss:null,bossShots:[],bossAttacks:[],playerShots:[],flutterButterflies:[],bossTarget:null,sky:new Image(),ponyOpen:new Image(),ponyFold:new Image(),
 init(){this.ctx=this.canvas.getContext('2d',{alpha:false});this.bossImage.src='/assets/characters/discord-boss.png';this.coinImage=new Image();this.coinImage.src='/assets/ui/coin.png?v=2.51';this.sky.src=assetManifest.backgrounds?.flight||'/assets/sky-world-4k.jpg';this.ponyOpen.src=assetManifest.characters?.open||'/assets/characters/twilight-flight-open.png?v=2.31';this.ponyFold.src=assetManifest.characters?.folded||'/assets/characters/twilight-flight-folded.png?v=2.31';this.sky.onload=()=>{if(!this.running)this.drawIdle();};window.addEventListener('blur',()=>{if(this.running)this.pause(true);});},
 resize(){const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return;/* Match the original desktop sizing: gameplay coordinates follow the visible canvas size, while the backing store uses device pixels for crisp rendering. */this.w=r.width;this.h=r.height;this.dpr=Math.min(window.devicePixelRatio||1,2.5);const pixelWidth=Math.max(1,Math.round(r.width*this.dpr)),pixelHeight=Math.max(1,Math.round(r.height*this.dpr));if(this.canvas.width!==pixelWidth)this.canvas.width=pixelWidth;if(this.canvas.height!==pixelHeight)this.canvas.height=pixelHeight;this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);this.ctx.imageSmoothingEnabled=true;this.ctx.imageSmoothingQuality='high';if(window.PonyOriginalCombatEffects){const fx=window.PonyOriginalCombatEffects;fx.projectiles.resize(this.w,this.h);fx.blackHole.resize(this.w,this.h);fx.laser.resize(this.w,this.h);}if(!this.running)this.drawIdle();},
 start(levelId=selectedLevel,endless=false,bossPractice=false){this.bossPractice=!!bossPractice;this.totalBossDamage=0;$('boss-damage-counter')?.classList.toggle('hidden',!this.bossPractice);if($('boss-damage-total'))$('boss-damage-total').textContent='0';selectedLevel=Math.max(1,Math.min(3,Number(levelId)||1));this.selectedLevel=selectedLevel;this.endlessMode=!!endless;const playEyebrow=document.querySelector('.play-title .eyebrow');if(playEyebrow)playEyebrow.textContent=this.endlessMode?'БЕСКОНЕЧНЫЙ РЕЖИМ':`УРОВЕНЬ ${selectedLevel}`;this.levelConfig=this.endlessMode?{...campaignLevels[0],towers:999999,boss:null,hp:0,speed:1,gap:1}:campaignLevels[selectedLevel-1];this.sky.src=this.levelConfig.background;this.bossImage.src=this.levelConfig.bossImage||'/assets/characters/discord-boss.png';soundFX.unlock();levelSoundtrack.play(selectedLevel);this.resize();if(window.PonyOriginalCombatEffects){const fx=window.PonyOriginalCombatEffects;fx.projectiles.resize(this.w,this.h);fx.blackHole.resize(this.w,this.h);fx.laser.resize(this.w,this.h);fx.projectiles.clear();fx.blackHole.clear();fx.laser.clear();}cancelAnimationFrame(this.raf);this.score=0;this.coins=0;this.runDamaged=false;this.combo=0;this.shieldUsed=false;this.activeCards=gameState?.activeCards||[];this.activeEffect=this.activeCards;this.speedUpgrade=Number(gameState?.upgrades?.flight_speed||gameState?.upgrades?.flightSpeed||0);this.coinBonusRemainder=0;this.comboTimer=0;this.world=0;this.bossMode=false;this.bossFinished=false;this.bossTransition=null;this.finalObstacle=null;this.bossApproach=false;$('boss-hud')?.classList.add('hidden');$('boss-damage-counter')?.classList.add('hidden');$('touch-hint').textContent='КОРОТКО КАСАЙСЯ ЭКРАНА, ЧТОБЫ ЛЕТЕТЬ';this.boss=null;this.bossShots=[];this.bossAttacks=[];this.bossHazards=[];this.playerShots=[];this.flutterButterflies=[];this.originalBossAttackIndex=-1;this.originalPlayerAttackIndex=0;this.originalBossAttackTimer=this.selectedLevel===3?.38:.72;this.originalBlackHoleHit=false;this.originalLaserHit=false;this.multiLasers=[];this.laserEffects=[];this.multiLaserHit=false;this.boundaryHitCooldown=0;this.bossTarget=null;this.spawn=.9;this.bossCoinTimer=2.4;this.obstacles=[];this.pickups=[];this.particles=[];this.pony={x:this.w*.22,y:this.h*.46,vy:0,flap:.18,invuln:0};this.running=true;this.paused=false;this.over=false;this.runtimeErrorNotified=false;$('hud-coins').textContent='0';$('tower-count').textContent=this.endlessMode?'0':`0 / ${this.levelConfig.towers}`;$('game-overlay').classList.add('hidden');$('overlay-menu-btn')?.classList.add('hidden');if(this.activeCards.length)showToast(`Способности: ${this.activeCards.map(c=>c.ability_name).join(', ')}`);$('pause-btn').innerHTML='<span class="pause-bars" aria-hidden="true"></span>';this.last=performance.now();this.accumulator=0;this.raf=requestAnimationFrame(t=>this.loop(t));if(this.bossPractice){this.levelConfig={...campaignLevels[2],boss:'Дискорд',hp:1000000,towers:0};this.beginBoss(false);$('boss-damage-counter')?.classList.remove('hidden');$('boss-damage-total').textContent='0';}},
 
 effectValue(type){return (this.activeCards||[]).filter(c=>c.effect_type===type).reduce((sum,c)=>sum+Number(c.effect_value||0),0);},
 flap(){soundFX.unlock();if(!this.running){if(this.over||!this.paused)this.start();return;}if(this.paused)return;const now=performance.now();if(now-this.lastTap<105)return;this.lastTap=now;soundFX.flap();const p=this.pony;const jumpBonus=this.effectValue('JUMP_POWER');p.vy=-430*(1+jumpBonus);p.flap=.34;},
 pause(force){if(!this.running)return;this.paused=force??!this.paused;if(this.paused){levelSoundtrack.pause();cancelAnimationFrame(this.raf);$('overlay-title').textContent='Полёт на паузе';$('overlay-text').textContent='';$('overlay-text').classList.add('hidden');$('pause-volume-controls').classList.remove('hidden');$('pause-music-volume').value=Math.round(Number(localStorage.getItem('ponyMusicVolume')??.7)*100);$('pause-fx-volume').value=Math.round(Number(localStorage.getItem('ponyFxVolume')??.7)*100);$('pause-music-value').textContent=$('pause-music-volume').value+'%';$('pause-fx-value').textContent=$('pause-fx-volume').value+'%';$('overlay-btn').textContent='Продолжить';$('overlay-menu-btn')?.classList.add('hidden');$('game-overlay').classList.remove('hidden');$('pause-btn').innerHTML='<span class="pause-play" aria-hidden="true"></span>';}else{levelSoundtrack.resume();$('pause-volume-controls').classList.add('hidden');$('overlay-text').classList.remove('hidden');$('game-overlay').classList.add('hidden');$('pause-btn').innerHTML='<span class="pause-bars" aria-hidden="true"></span>';this.last=performance.now();this.accumulator=0;this.raf=requestAnimationFrame(t=>this.loop(t));}},
 loop(t){if(!this.running||this.paused)return;
  const elapsed=Math.max(0,Math.min((t-this.last)/1000,.1));this.last=t;
  // Isolate simulation and rendering failures: a broken boss visual must never freeze flight controls.
  if(elapsed>0){try{this.update(Math.min(elapsed,.05));}catch(error){console.error('Ошибка обновления боя:',error);if(!this.runtimeErrorNotified){this.runtimeErrorNotified=true;showToast('Ошибка одной из атак. Полёт продолжается; эффект будет пропущен.');}}}
  try{this.draw();}catch(error){console.error('Ошибка отрисовки кадра:',error);}
  if(this.running&&!this.paused)this.raf=requestAnimationFrame(n=>this.loop(n));},
 update(dt){if(this.bossMode){this.updateBoss(dt);return;}const p=this.pony,level=Math.floor(this.score/5),slow=this.effectValue('SLOW_WORLD'),speed=Math.min(390,(190+level*11)*this.levelConfig.speed*(1-slow)*(1+this.speedUpgrade*.01)*(1+this.effectValue('SPEED'))),gap=Math.max(150,this.h*.315,this.h*(.445-Math.min(.115,level*.007))*this.levelConfig.gap);p.vy=Math.min(470,p.vy+1120*dt);p.y+=p.vy*dt;p.invuln=Math.max(0,(p.invuln||0)-dt);p.flap=Math.max(0,p.flap-dt);p.wingClock=(p.wingClock||0)+dt;this.world+=speed*dt;this.spawn-=dt;this.comboTimer-=dt;if(this.comboTimer<=0)this.combo=0;
 if(this.spawn<=0&&this.score+this.obstacles.filter(o=>!o.passed).length<this.levelConfig.towers){const margin=Math.max(68,this.h*.13),half=gap/2,low=margin+half,high=this.h-margin-half;let center=low+Math.random()*Math.max(1,high-low);const nextColumnNumber=this.score+this.obstacles.filter(o=>!o.passed).length+1;if(!this.endlessMode&&this.selectedLevel>=3){const group=Math.floor((nextColumnNumber-1)/5);const drift=Math.sin(group*1.45)*this.h*.075;center=Math.max(low,Math.min(high,center+drift));}const movingColumn=!this.endlessMode&&this.selectedLevel===3&&nextColumnNumber%6===0;this.obstacles.push({x:this.w+90,center,baseCenter:center,gap,passed:false,moving:movingColumn,motionTime:Math.random()*Math.PI*2,motionAmplitude:movingColumn?this.h*.045:0});if(Math.random()<.72){const coinCount=1+(Math.random()<.28?1:0);for(let i=0;i<coinCount;i++){this.pickups.push({x:this.w+125+i*42,y:center+(Math.random()-.5)*gap*.34,taken:false,phase:Math.random()*6,value:1+(Math.random()<.22?1:0)});}}this.spawn=Math.max(1.12,1.72-level*.038);}
 for(const o of this.obstacles){o.x-=speed*dt;if(o.moving){o.motionTime+=dt*2.05;const margin=Math.max(68,this.h*.13)+o.gap/2,range=Math.max(0,this.h-margin*2);o.center=Math.max(margin,Math.min(this.h-margin,o.baseCenter+Math.sin(o.motionTime)*Math.min(o.motionAmplitude,range*.42)));}const top=o.center-o.gap/2,bottom=o.center+o.gap/2;if(!o.passed&&o.x+58<p.x){o.passed=true;soundFX.pass();this.score++;this.combo++;this.comboTimer=2.2;$('tower-count').textContent=this.endlessMode?String(this.score):`${Math.min(this.score,this.levelConfig.towers)} / ${this.levelConfig.towers}`;this.burst(p.x,p.y,7,'#ffe08b');if(!this.endlessMode&&this.score>=this.levelConfig.towers){this.startBossTransition(o);return;}}const hitX=p.x+78>o.x&&p.x-78<o.x+58;const bodyTop=p.y-55,bodyBottom=p.y+55;const hitY=bodyTop<top||bodyBottom>bottom;if(hitX&&hitY)this.hit();}
 for(const q of this.pickups){q.x-=speed*dt;q.phase+=dt*5;if(q.collecting){q.collectTimer-=dt;continue;}const magnet=this.effectValue('MAGNET');if(!q.taken&&this.ponyTouchesPoint(q.x,q.y,10+magnet*38))this.collectPickup(q);}
 this.obstacles=this.obstacles.filter(o=>o.x>-100);this.pickups=this.pickups.filter(q=>q.x>-50&&(!q.collecting||q.collectTimer>0));for(const a of this.particles){a.x+=a.vx*dt;a.y+=a.vy*dt;a.vy+=150*dt;a.life-=dt;}this.particles=this.particles.filter(a=>a.life>0);if(p.y<0||p.y>this.h)this.hit();},
 collectPickup(q){if(!q||q.collecting||q.taken)return;q.taken=true;q.collecting=true;q.collectTimer=.26;soundFX.coin();let value=q.value||1;if(this.effectValue('COIN_BONUS')>0){this.coinBonusRemainder+=value*this.effectValue('COIN_BONUS');const extra=Math.floor(this.coinBonusRemainder);value+=extra;this.coinBonusRemainder-=extra;}if(this.effectValue('EXTRA_COIN')>0&&Math.random()<this.effectValue('EXTRA_COIN'))value++;this.coins+=value;this.combo=Math.min(12,this.combo+1);this.comboTimer=2.5;this.burst(q.x,q.y,10,'#ffd65e');$('hud-coins').textContent=String(this.coins);},
 startBossTransition(lastPipe){
  if(this.bossMode)return;
  // No scene transition: the final pipe leaves the frame, then Discord enters
  // the same continuously running flight scene from beyond the right edge.
  // Keep the final column in the world: it continues scrolling left naturally.
  // Stop creating new columns, but do not clear existing scenery or pickups abruptly.
  this.finalObstacle=lastPipe||null;this.spawn=999;this.bossApproach=true;
  $('tower-count').textContent=`${this.levelConfig.towers} / ${this.levelConfig.towers}`;$('touch-hint').textContent='ПОСЛЕДНЯЯ КОЛОННА ПРОЙДЕНА';
  this.beginBoss(true);
 },
 beginBoss(entering=false){
  if(this.bossMode)return;
  this.bossMode=true;levelSoundtrack.boss();$('boss-damage-counter')?.classList.toggle('hidden',!this.bossPractice);$('boss-hud')?.classList.remove('hidden');$('boss-hud').style.opacity=entering?'0':'1';$('boss-hud').style.transition='opacity .18s linear';this.bossShots=[];this.bossAttacks=[];this.bossHazards=[];this.playerShots=[];this.flutterButterflies=[];this.originalBossAttackIndex=-1;this.originalPlayerAttackIndex=0;this.originalBossAttackTimer=this.selectedLevel===3?.38:.72;this.originalBlackHoleHit=false;this.originalLaserHit=false;this.multiLasers=[];this.laserEffects=[];this.multiLaserHit=false;if(window.PonyOriginalCombatEffects){window.PonyOriginalCombatEffects.projectiles.clear();window.PonyOriginalCombatEffects.blackHole.clear();window.PonyOriginalCombatEffects.laser.clear();}
  this.pony.x=this.w*.22;this.pony.y=Math.max(42,Math.min(this.h-42,this.pony.y));this.lastBossShot=0;
  const bossW=Math.min(220,this.w*.30);const targetX=Math.min(this.w-bossW*.52-8,Math.max(this.w*.83,this.pony.x+bossW*.68+75));const maxHp=this.levelConfig.hp;this.boss={x:entering?this.w+bossW:targetX,targetX,width:bossW,entry:entering?1.65:0,y:this.h*.5,baseY:this.h*.5,hp:maxHp,maxHp,phase:entering?'intro':'attack',phaseTime:entering?1.65:2.96,shotTimer:Math.max(.52,1.0/this.levelConfig.speed),hitFlash:0,playerHp:3+Number(gameState?.upgrades?.max_health||0),maxPlayerHp:3+Number(gameState?.upgrades?.max_health||0),attackPattern:0,attackFlash:0,regenTimer:0,playerAutoTimer:5.6};
  this.bossTarget={x:this.pony.x,y:this.pony.y};$('boss-player-hp').innerHTML=Array.from({length:this.boss.playerHp},()=>'<img class="heart-icon" src="/assets/ui/heart.png" alt="♥">').join('');$('boss-enemy-hp').innerHTML=this.bossPractice?'<span class="boss-infinite-label">∞</span>':Array.from({length:Math.min(this.boss.hp,30)},()=>'<img class="heart-icon" src="/assets/ui/heart.png" alt="♥">').join('');const enemyLabel=$('boss-hud')?.querySelector('.boss-health.enemy span');if(enemyLabel)enemyLabel.textContent=this.levelConfig.boss.toUpperCase();
  $('touch-hint').textContent='БОСС: КАСАЙСЯ ЭКРАНА, ЧТОБЫ ВЗЛЕТАТЬ И УКЛОНЯТЬСЯ';
  $('boss-hud')?.classList.remove('hidden');
  $('boss-phase-label').textContent=`${this.levelConfig.boss.toUpperCase()} ПОЯВЛЯЕТСЯ`;
  this.bossBanner=2.4;showToast(`${this.levelConfig.boss} появился!`);
 },
 setBossTarget(x,y){ /* Boss movement intentionally uses the same flap physics as the flight. */ },
 bossAttack(){ /* Player attacks are scheduled automatically; flight taps only control altitude. */ },
 updateBoss(dt){
  const b=this.boss,p=this.pony;if(!b)return;
  p.vy=Math.min(470,(p.vy||0)+1120*dt);p.y+=p.vy*dt;p.flap=Math.max(0,(p.flap||0)-dt);p.wingClock=(p.wingClock||0)+dt;
  p.invuln=Math.max(0,(p.invuln||0)-dt);this.world+=95*dt;this.bossBanner=Math.max(0,(this.bossBanner||0)-dt);
  const scenerySpeed=190;for(const o of this.obstacles)o.x-=scenerySpeed*dt;this.bossCoinTimer=(this.bossCoinTimer??3)-dt;if(this.bossCoinTimer<=0){const y=90+Math.random()*Math.max(1,this.h-180);this.pickups.push({x:this.w+28,y,taken:false,phase:Math.random()*Math.PI*2,value:Math.random()<.22?2:1});this.bossCoinTimer=3.1+Math.random()*2.1;}for(const q of this.pickups){q.x-=scenerySpeed*dt;q.phase+=dt*5;if(q.collecting){q.collectTimer-=dt;continue;}const magnet=this.effectValue('MAGNET');if(!q.taken&&this.ponyTouchesPoint(q.x,q.y,10+magnet*38))this.collectPickup(q);}this.obstacles=this.obstacles.filter(o=>o.x>-100);this.pickups=this.pickups.filter(q=>q.x>-50&&(!q.collecting||q.collectTimer>0));
  if(b.entry>0){const before=b.entry;b.entry=Math.max(0,b.entry-dt);const k=1-b.entry/1.65,ease=1-Math.pow(1-k,3),hudFade=Math.min(1,k*1.35);$('boss-hud').style.opacity=String(hudFade);b.x=(this.w+b.width)-(this.w+b.width-b.targetX)*ease;b.y=b.baseY;if(before>0&&b.entry===0){b.phase='intro-banner';b.phaseTime=2.0;$('boss-phase-label').textContent=`${this.levelConfig.boss.toUpperCase()} ВЫЗЫВАЕТ НА ПОЕДИНОК`;this.burst(b.x-b.width*.30,b.y,34,'#c59aff');}}else{b.x=b.targetX;if(b.phase==='intro-banner')b.y=b.baseY;else b.y=b.baseY+Math.sin(performance.now()/420)*this.h*.065;}
  // Automatic character attack: two strikes every 5.6 seconds, during boss recovery.
  b.playerAutoTimer=Math.max(0,(b.playerAutoTimer??5.6)-dt);
  if(b.playerAutoTimer<=0&&!b.playerBurstPending){
   b.playerAutoTimer=5.6;b.playerBurstPending=true;const bossRef=b;
   soundFX.playerMagic();this.fireOriginalPlayerAttack();
   setTimeout(()=>{if(this.running&&this.bossMode&&this.boss===bossRef&&bossRef.hp>0){soundFX.playerMagic();this.fireOriginalPlayerAttack();}},208);
   setTimeout(()=>{if(this.boss===bossRef)bossRef.playerBurstPending=false;},384);
  }
  b.hitFlash=Math.max(0,b.hitFlash-dt);if(Number(gameState?.upgrades?.regeneration||0)>0&&b.playerHp<b.maxPlayerHp){b.regenTimer+=dt;if(b.regenTimer>=Math.max(9,24-Number(gameState.upgrades.regeneration)*4)){b.regenTimer=0;b.playerHp=Math.min(b.maxPlayerHp,b.playerHp+1);$('boss-player-hp').innerHTML=Array.from({length:b.playerHp},()=>'<img class="heart-icon" src="/assets/ui/heart.png" alt="♥">').join('');this.burst(p.x,p.y,12,'#8cffb5');}}b.attackFlash=Math.max(0,(b.attackFlash||0)-dt);
  if(b.phase==='intro'){/* Discord is entering; keep the same world and let scenery drift away. */}
  else if(b.phase==='intro-banner'){b.phaseTime-=dt;if(b.phaseTime<=0){b.phase='attack';b.phaseTime=(this.selectedLevel===3?3.55:2.5)/this.levelConfig.speed;$('boss-phase-label').textContent='БОСС АТАКУЕТ — УКЛОНЯЙСЯ';}}
  else {b.phaseTime-=dt;if(b.phaseTime<=0){if(b.phase==='attack'){b.phase='rest';b.phaseTime=.96;$('boss-phase-label').textContent='ПЕРЕДЫШКА — ГОТОВЬСЯ К СЛЕДУЮЩЕЙ АТАКЕ';soundFX.pass();}else{b.phase='attack';b.phaseTime=(this.selectedLevel===3?3.55:2.5)/this.levelConfig.speed;$('boss-phase-label').textContent='АТАКА! УКЛОНЯЙСЯ';}}}
  this.updateOriginalBossAttacks(dt);this.updateBossHazards(dt);
  for(let i=this.flutterButterflies.length-1;i>=0;i--){const shot=this.flutterButterflies[i];shot.update(dt);if(shot.dead)this.flutterButterflies.splice(i,1);}
  (this.laserEffects||[]).forEach((beamFx,i)=>{beamFx.renderFrame();const state=beamFx.getState(),beam=this.multiLasers[i];if(beam){beam.phase=state.phase===1?'warning':state.phase===2?'active':state.phase===3?'fade':'done';beam.activeTime=state.phase===2?1:0;}});
  if((this.multiLasers||[]).some(beam=>beam.phase==='active')&&!this.multiLaserHit&&p.invuln<=0){const hit=(this.multiLasers||[]).some(beam=>beam.phase==='active'&&Math.abs(p.y-beam.y)<26&&p.x>b.x-this.w-100&&p.x<b.x-30);if(hit){this.multiLaserHit=true;this.damagePlayer();}}
  // All boss attack visuals and hit detection and hit detection are handled by the original HTML effect engines.
  for(const a of this.particles){a.x+=a.vx*dt;a.y+=a.vy*dt;a.vy+=95*dt;a.life-=dt;}this.particles=this.particles.filter(a=>a.life>0);
  if(p.y-38<0||p.y+38>this.h){if((this.boundaryHitCooldown||0)<=0){this.damagePlayer(true);this.boundaryHitCooldown=.72;}p.y=Math.max(44,Math.min(this.h-44,p.y));p.vy=p.y<=44?115:-115;}this.boundaryHitCooldown=Math.max(0,(this.boundaryHitCooldown||0)-dt);
 },

 fireOriginalPlayerAttack(){
  const fx=window.PonyOriginalCombatEffects,b=this.boss;
  if(!fx||!b||b.hp<=0||!this.bossMode)return;
  const projectileType=selectedSkin==='rainbow'?4:0;
  const damage=(this.effectValue('BOSS_DAMAGE')>0?Math.max(1,this.effectValue('BOSS_DAMAGE')):1)*(1+Number(gameState?.upgrades?.magic_power||0)*.25);
  let applied=false;
  const applyHit=()=>{
   if(applied||!this.boss||!this.bossMode||this.boss.hp<=0)return;
   applied=true;
   this.boss.hp=Math.max(0,this.boss.hp-damage);this.totalBossDamage=(this.totalBossDamage||0)+damage;if(this.bossPractice){const total=$('boss-damage-total');if(total)total.textContent=fmt(Math.floor(this.totalBossDamage));}
   this.boss.hitFlash=.42;
   soundFX.coin();
   $('boss-enemy-hp').innerHTML=this.bossPractice?'<span class="boss-infinite-label">∞</span>':Array.from({length:Math.min(this.boss.hp,30)},()=>'<img class="heart-icon" src="/assets/ui/heart.png" alt="♥">').join('');
   this.burst(this.boss.x-35,this.boss.y,20,'#ffe38b');
   if(this.boss.hp<=0)this.endBoss(true);
  };
  if(selectedSkin==='fluttershy'){
   const targetX=b.x-(b.width||220)*.28,targetY=b.y+(Math.random()-.5)*Math.min(90,this.h*.12);
   this.flutterButterflies.push(new FluttershyButterflyProjectile(this.pony.x+48,this.pony.y,targetX,targetY,applyHit));
   return;
  }
  // Aim through the near edge and into the visible Discord sprite, not merely
  // at a point outside its artwork. Collision is evaluated against the live boss position.
  const targetX=b.x+(b.width||220)*.28;
  const targetY=b.y;
  const shot=fx.projectiles.spawn(projectileType,this.pony.x+48,this.pony.y,targetX,targetY,applyHit);
  shot.onUpdate=(q)=>{
   const live=this.boss;
   if(!live||!this.bossMode||live.hp<=0)return false;
   const rx=(live.width||220)*.43+q.radius;
   const ry=(live.height||300)*.42+q.radius;
   const inside=Math.abs(q.x-live.x)<=rx&&Math.abs(q.y-live.y)<=ry;
   if(inside){q._hit=true;return true;}
   return false;
  };
 },
 updateOriginalBossAttacks(dt){
  const fx=window.PonyOriginalCombatEffects,b=this.boss,p=this.pony;if(!fx||!b)return;
  const spawnVolley=(type,offsets,speed=1)=>{
   offsets.forEach((offset,i)=>{
    const tx=-Math.max(220,this.w*.22),ty=p.y+offset.y;
    const shot=fx.projectiles.spawn(type,b.x-65,b.y,tx,ty,()=>{
     if(shot._hit&&this.running&&this.bossMode)this.damagePlayer();
    });
    shot.vx*=speed*1.25;shot.vy*=speed*1.25;shot.targetX=tx;shot.targetY=ty;
    shot.onUpdate=(q)=>{
     if(!this.running||!this.bossMode)return false;
     const hitRadius=type===2?31:27;
     if(Math.hypot(q.x-this.pony.x,q.y-this.pony.y)<hitRadius+22&&this.pony.invuln<=0){q._hit=true;return true;}
     return false;
    };
   });
  };
  if(b.phase==='attack'){
   this.originalBossAttackTimer=(this.originalBossAttackTimer??1.0)-dt;
   if(this.originalBossAttackTimer<=0){
    // Moon Rift is weighted a little more often so players can actually learn its pattern.
    const nightmarePatterns=[0,1,2,3,4,5];
    const levelOnePatterns=[0,1,2,3,4]; // Все пять атак из HTML-референса, включая ягоду.
    const activeMoonPillars=(this.bossHazards||[]).some(q=>q.type==='moonPillars'&&q.x+q.width>0);
    let choices=this.selectedLevel===1?levelOnePatterns:(this.selectedLevel===2?nightmarePatterns:Array.from({length:19},(_,i)=>i));
    // During Moon Pillars, suppress lasers and Moon Rift so the passage stays readable.
    if(activeMoonPillars){
     if(this.selectedLevel===2)choices=choices.filter(v=>v!==0&&v!==2);
     if(this.selectedLevel===3)choices=choices.filter(v=>v!==4&&v!==13&&v!==15);
    }
    if(!choices.length)choices=this.selectedLevel===2?[1,3,4,5]:[1,2,3,5,6,7,14,16,17,18];
    let pattern=choices[Math.floor(Math.random()*choices.length)];
    if(pattern===this.originalBossAttackIndex&&choices.length>1)pattern=choices[(choices.indexOf(pattern)+1+Math.floor(Math.random()*(choices.length-1)))%choices.length];this.originalBossAttackIndex=pattern;
    if(this.selectedLevel===1){this.spawnChrysalisAttack(pattern,spawnVolley);this.originalBossAttackTimer=.82+Math.random()*.25;}
    else if(this.selectedLevel===2){this.spawnNightmareAttack(pattern,spawnVolley);this.originalBossAttackTimer=pattern===1?1.8+Math.random()*.25:pattern===2?.85+Math.random()*.12:pattern===3?.9+Math.random()*.12:.58+Math.random()*.12;}
    else if(this.selectedLevel===3&&pattern>=8&&pattern<=12){this.spawnChrysalisAttack(pattern-8,spawnVolley);this.originalBossAttackTimer=.95+Math.random()*.35;}
    else if(this.selectedLevel===3&&pattern>=13){this.spawnNightmareAttack(pattern-13,spawnVolley);this.originalBossAttackTimer=.95+Math.random()*.35;}
    else if(pattern===0){
     // Acid: three-shot fan, then a delayed pair that closes the safe gap.
     soundFX.attackAcid();const count=[2,3,4][Math.floor(Math.random()*3)],spread=count===2?[-42,42]:count===3?[-86,0,86]:[-120,-40,40,120];spawnVolley(1,spread.map(y=>({x:-25,y})),.92+Math.random()*.18);
     if(count===3&&Math.random()<.55)setTimeout(()=>{if(this.running&&this.bossMode)spawnVolley(1,[{x:-5,y:-48},{x:-5,y:48}],1.04);},336);
     this.originalBossAttackTimer=1.45+Math.random()*.65;
    }else if(pattern===1){
     // Dark matter: wide five-shot fan.
     soundFX.attackDark();const count=[3,5,7][Math.floor(Math.random()*3)],spread=count===3?[-70,0,70]:count===5?[-125,-62,0,62,125]:[-175,-116,-58,0,58,116,175];spawnVolley(2,spread.map(y=>({x:-20,y})),.88+Math.random()*.22);
     this.originalBossAttackTimer=1.45+Math.random()*.7;
    }else if(pattern===2){
     // Turquoise lightning: staggered three-lane burst.
     soundFX.attackLightning();const count=[2,3,4][Math.floor(Math.random()*3)],spread=count===2?[-58,58]:count===3?[-105,0,105]:[-145,-48,48,145];spawnVolley(3,spread.map(y=>({x:-35,y})),1.02+Math.random()*.2);
     if(count===3&&Math.random()<.5)setTimeout(()=>{if(this.running&&this.bossMode)spawnVolley(3,[{x:-15,y:-55},{x:-15,y:55}],1.0);},240);
     this.originalBossAttackTimer=1.35+Math.random()*.65;
    }else if(pattern===3){
     // Original full black-hole animation, entering from the boss side.
     soundFX.attackBlackHole();fx.blackHole.clear();const discord=b;const spawnX=discord.x-(discord.width||Math.min(220,this.w*.30))*.34;const spawnY=Math.max(70,Math.min(this.h-70,discord.y+(discord.height||this.h*.62)*.12));fx.blackHole.spawn(spawnX,spawnY);this.originalBlackHoleHit=false;
     this.originalBossAttackTimer=2.12;
    }else if(pattern===4){
     // Original glowing laser visual, cloned into three simultaneous fixed horizontal lanes.
     soundFX.attackLaser();fx.laser.clear();this.laserEffects=[];
     const laneCount=this.selectedLevel===3?3:(Math.random()<.62?1:3),allLanes=[this.h*.20,this.h*.5,this.h*.80],lanes=laneCount===1?[allLanes[Math.floor(Math.random()*allLanes.length)]]:allLanes;
     this.multiLasers=lanes.map(y=>({y,phase:'warning',timer:.576,activeTime:0}));
     lanes.forEach(y=>{const beamFx=fx.createLaserEffect();beamFx.resize(this.w,this.h);beamFx.fire(b.x-45,y,-this.w-100,y);this.laserEffects.push(beamFx);});
     this.multiLaserHit=false;this.originalLaserHit=false;
     this.originalBossAttackTimer=this.selectedLevel===3?1.45:2.24;
    }else if(pattern===5){
     // Alternating diagonal double-wave: two quick fans with a shifted centre.
     soundFX.attackVolley();const count=[3,5,7][Math.floor(Math.random()*3)],base=[-160,-105,-52,0,52,105,160],chosen=count===3?[0,3,6]:count===5?[0,1,3,5,6]:[0,1,2,3,4,5,6],spread=chosen.map(i=>({x:(i%2?28:-28),y:base[i]+(Math.random()-.5)*24}));
     spawnVolley(Math.random()<.5?1:3,spread, .9+Math.random()*.2);
     if(Math.random()<.58)setTimeout(()=>{if(this.running&&this.bossMode)spawnVolley(2,[-80,-20,40,100].sort(()=>Math.random()-.5).slice(0,1+Math.floor(Math.random()*4)).map(y=>({x:20,y:y+(Math.random()-.5)*18})),.88+Math.random()*.18);},416);
     this.originalBossAttackTimer=1.5+Math.random()*.6;
    }else if(pattern===6){
     // Dense but readable seven-lane sweep; alternating acid and lightning.
     soundFX.attackLightning();const count=this.selectedLevel===3?(Math.random()<.62?12:9):[3,5,7][Math.floor(Math.random()*3)],base=this.selectedLevel===3?[-220,-180,-140,-100,-60,-20,20,60,100,140,180,220]:[-150,-100,-50,0,50,100,150],lanes=base.sort(()=>Math.random()-.5).slice(0,count).sort((a,b)=>a-b).map((y,i)=>({x:(i%2?18:-18),y:y+(Math.random()-.5)*16}));
     spawnVolley(1,lanes,.78+Math.random()*.16);
     if(Math.random()<.45)setTimeout(()=>{if(this.running&&this.bossMode)spawnVolley(3,[-115,-38,38,115].sort(()=>Math.random()-.5).slice(0,1+Math.floor(Math.random()*4)).map(y=>({x:-12,y})),.98+Math.random()*.18);},520);
     this.originalBossAttackTimer=this.selectedLevel===3?1.05+Math.random()*.35:1.55+Math.random()*.6;
    }else{
     // Two staggered aimed bursts: target altitude changes between volleys.
     soundFX.attackDark();const count=[2,3,5][Math.floor(Math.random()*3)],base=[-96,-48,0,48,96],first=base.sort(()=>Math.random()-.5).slice(0,count).map(y=>({x:Math.random()*35-18,y:y+(Math.random()-.5)*20}));
     spawnVolley(2,first,1.0+Math.random()*.22);
     if(Math.random()<.52)setTimeout(()=>{if(this.running&&this.bossMode){const shift=(Math.random()-.5)*120;spawnVolley(1,[-90,-30,30,90].sort(()=>Math.random()-.5).slice(0,1+Math.floor(Math.random()*4)).map(y=>({x:Math.random()*28,y:y+shift})),.86+Math.random()*.14);}},624);
     this.originalBossAttackTimer=1.55+Math.random()*.6;
    }
    if(this.selectedLevel===3)this.originalBossAttackTimer*=.78;
   }
  }
  fx.projectiles.renderFrame(Math.max(0,Math.min(.1,dt))*60);fx.blackHole.renderFrame();fx.laser.renderFrame();
  // Black-hole contact is evaluated against the player's current position, not its launch position.
  const hole=fx.blackHole.getState();
  if(hole.active&&hole.phase===2){const dx=hole.x-p.x,dy=hole.y-p.y,dist=Math.hypot(dx,dy),influence=Math.max(300,(hole.visualRadius||hole.radius*3.2)*3.8);if(Math.abs(dx)<influence&&Math.abs(dy)<influence){const strength=Math.pow(Math.max(0,1-dist/influence),1.35);const direction=Math.sign(dy);if(direction!==0){p.vy+=direction*(820*strength)*dt;p.y+=direction*(105*strength)*dt;}else{p.vy+=(p.y<hole.y?1:-1)*220*dt;}p.y=Math.max(28,Math.min(this.h-28,p.y));}}
  if(hole.active&&!this.originalBlackHoleHit&&hole.phase===2&&Math.hypot(hole.x-p.x,hole.y-p.y)<Math.max(hole.radius+28,(hole.visualRadius||0)*.42)&&p.invuln<=0){
   this.originalBlackHoleHit=true;this.damagePlayer();
  }
  // Laser collision only during the active firing phase and only if the player intersects its actual beam.
  const laser=fx.laser.getState();
  if(false&&laser.active&&laser.phase===2&&!this.originalLaserHit&&p.invuln<=0){
   const ax=laser.startX,ay=laser.startY,bx=laser.endX,by=laser.endY,dx=bx-ax,dy=by-ay;
   const t=Math.max(0,Math.min(1,((p.x-ax)*dx+(p.y-ay)*dy)/(dx*dx+dy*dy||1)));
   const dist=Math.hypot(p.x-(ax+t*dx),p.y-(ay+t*dy));
   if(dist<Math.max(16,laser.coreWidth+9)){this.originalLaserHit=true;this.damagePlayer();}
  }
 },
 spawnChrysalisAttack(pattern,spawnVolley){
  const b=this.boss,p=this.pony;
  if(pattern===0){
   // Original AcidLaser: charge and then a vivid acid-green ray ending at the player's lane.
   soundFX.attackAcid();const endX=0,endY=p.y;this.bossHazards.push({type:'acidLaser',x1:b.x-55,y1:b.y,x2:endX,y2:endY,age:0,warning:.32,life:1.25,hit:false});
  }else if(pattern===1){
   // Original ToxicCloud: warning first, then a stationary broad cloud for three seconds.
   soundFX.attackAcid();const y=Math.max(90,Math.min(this.h-90,p.y));this.bossHazards.push({type:'toxicCloud',x:Math.max(48,p.x-145),y,age:0,warning:.72,activeFor:3,life:3.72,hit:false,puffs:Array.from({length:60},()=>({ox:(Math.random()-.5)*320,oy:(Math.random()-.5)*60,r:20+Math.random()*35,px:Math.random()*6.28,py:Math.random()*6.28,speed:.02+Math.random()*.03,hue:80+Math.random()*30,delay:Math.random()*40})) ,bubbles:[]});
  }else if(pattern===2){
   // Original SplittingPoisonCore: one core splits 1 -> 2 -> 4 -> 8, retaining momentum.
   soundFX.attackAcid();const sx=b.x-65,sy=b.y,tx=-this.w*.18,ty=p.y,dx=tx-sx,dy=ty-sy,dist=Math.hypot(dx,dy)||1,speed=430;this.bossHazards.push({type:'splittingCore',x:sx,y:sy,vx:dx/dist*speed,vy:dy/dist*speed,generation:0,age:0,splitAt:.42,life:(sx+this.w*.25)/speed+1.2,r:18,trail:[],spikes:Array.from({length:8},(_,i)=>({a:i*Math.PI/4,spin:(Math.random()-.5)*.2})),hit:false});
  }else if(pattern===3){
   // Poison berries: short straight thorned green projectiles.
   soundFX.attackAcid();const count=3+Math.floor(Math.random()*3);for(let i=0;i<count;i++){const y=Math.max(65,Math.min(this.h-65,p.y+(Math.random()-.5)*210));this.bossHazards.push({type:'poisonBerry',x:b.x-65-i*18,y,vx:-(830+Math.random()*130),vy:0,r:17,age:0,life:4,hit:false});}
  }else if(pattern===4){
   // MiniLaser from the supplied HTML: a straight green beam projectile aimed at the player's current lane.
   soundFX.attackAcid();const sx=b.x-65,tx=-this.w*.16,dx=tx-sx,speed=990;[-36,0,36].forEach(offset=>{const sy=Math.max(40,Math.min(this.h-40,b.y+offset));this.bossHazards.push({type:'miniLaser',x:sx,y:sy,vx:-speed,vy:0,angle:Math.PI,age:0,life:Math.abs(dx)/speed+.45,r:8,length:40,trail:[],hit:false});});
  }
 },
 spawnNightmareAttack(pattern,spawnVolley){
  const p=this.pony;const b=this.boss;
  if(!p||!b){console.warn('Атака Nightmare пропущена: босс или игрок ещё не создан');return;}
  if(pattern===0){
   // Faithful MoonBeam timing and full-screen gradient beam from the supplied HTML.
   soundFX.attackLaser();const y=this.h*(.35+Math.random()*.3),thickness=60+Math.random()*40;this.bossHazards.push({type:'moonBeam',y,thickness,age:0,warning:50/60,activeFor:70/60,life:140/60,particles:[],hit:false});
  }else if(pattern===1){
   // Original three-segment Moon Pillars, two wide passages. Never allow more than two on screen.
   const activePillars=(this.bossHazards||[]).filter(q=>q.type==='moonPillars'&&q.x+q.width>0).length;
   if(activePillars<2){soundFX.attackDark();const margin=24,midH=56,minGap=Math.min(142,Math.max(112,this.h*.23)),maxGap=Math.min(184,Math.max(minGap,this.h*.29)),gap1H=minGap+Math.random()*(maxGap-minGap),gap2H=minGap+Math.random()*(maxGap-minGap),available=Math.max(70,this.h-margin*2-gap1H-gap2H-midH),topBottom=margin+available*(.25+Math.random()*.28),middleTop=topBottom+gap1H,middleBottom=middleTop+midH,bottomTop=middleBottom+gap2H,speed=210;this.bossHazards.push({type:'moonPillars',x:b.x-b.width*.28,width:100,g1:topBottom,g2:middleBottom,gap1H,gap2H,middleH:midH,vx:-speed,age:0,life:(this.w+300)/speed+1,hit:false,crystals:Array.from({length:8},()=>({side:Math.floor(Math.random()*3),offset:Math.random(),phase:Math.random()*6.28,size:4+Math.random()*6})),particles:[],topBottom,middleTop,middleBottom,bottomTop});}
  }else if(pattern===3){
   // Original TornadoSpiral emerges from the boss sprite itself, then flies toward the pony and off-screen.
   soundFX.attackVolley();const sx=b.x-b.width*.30,sy=b.y+Math.max(-55,Math.min(55,(p.y-b.y)*.22)),tx=-140,ty=p.y,dx=tx-sx,dy=ty-sy,dist=Math.hypot(dx,dy)||1,speed=520;this.bossHazards.push({type:'tornado',x:sx,y:sy,vx:dx/dist*speed,vy:dy/dist*speed,age:0,life:dist/speed+.55,r:26,rotation:0,hit:false,spirals:Array.from({length:8},(_,i)=>({base:i*Math.PI/4,width:.3+Math.random()*.15,hue:200+(i%3)*20,phase:Math.random()*6.28})),particles:Array.from({length:20},()=>({t:Math.random(),angle:Math.random()*6.28,speed:.1+Math.random()*.15,size:2+Math.random()*4,alpha:.4+Math.random()*.4}))});
  }else if(pattern===2){
   // Moon Rift: a moving vertical rift; only the upper and lower lanes are safe.
   soundFX.attackDark();this.bossHazards.push({type:'moonRift',x:b.x-b.width*.28,width:108,top:this.h*.27,bottom:this.h*.73,vx:-Math.max(470,this.w*.62),age:0,life:(this.w+260)/Math.max(470,this.w*.62)+.2,hit:false,particles:[]});
  }else if(pattern===4||pattern===5){
   // Source demo has two separate moon attacks. Spawn only the selected variant.
   soundFX.attackDark();const variant=pattern===4?1:2,y=Math.max(70,Math.min(this.h-70,p.y+(Math.random()-.5)*130));
   const sx=b.x-55,tx=-120,speed=variant===1?550:580;
   [-1,1,-2,2].forEach((side,index)=>{
    const sy=Math.max(40,Math.min(this.h-40,y+(variant===1?-34:48)+side*(28+index*8)));
    const ty=Math.max(35,Math.min(this.h-35,sy+(Math.random()-.5)*70)),dx=tx-sx,dy=ty-sy,dist=Math.hypot(dx,dy)||1;
    this.bossHazards.push({type:'moonCrescent',variant,x:sx-index*18,y:sy,vx:dx/dist*speed,vy:dy/dist*speed,tx,ty,r:variant===1?26:22,age:0,life:4,trail:[],sparkles:Array.from({length:variant===1?10:6},()=>({angle:Math.random()*6.28,dist:25+Math.random()*25,phase:Math.random()*6.28,size:1.5+Math.random()*2.5,speed:.02+Math.random()*.04})),hit:false});
   });
  }
 },
 updateBossHazards(dt){
  const p=this.pony;
  for(let i=this.bossHazards.length-1;i>=0;i--){const h=this.bossHazards[i];try{h.age=(h.age||0)+dt;h.life=(h.life??1)-dt;
   if(h.type==='acidLaser'&&h.age>h.warning&&!h.hit&&p.invuln<=0){const dx=h.x2-h.x1,dy=h.y2-h.y1,t=Math.max(0,Math.min(1,((p.x-h.x1)*dx+(p.y-h.y1)*dy)/(dx*dx+dy*dy||1))),dist=Math.hypot(p.x-(h.x1+t*dx),p.y-(h.y1+t*dy));if(dist<28){h.hit=true;this.damagePlayer();}}
   if(h.type==='toxicCloud'){
    if(h.age>h.warning){h.cloudAge=h.age-h.warning;if(h.cloudAge< h.activeFor&&!h.hit&&Math.abs(p.x-h.x)<285&&Math.abs(p.y-h.y)<82&&p.invuln<=0){h.hit=true;this.damagePlayer();}}
    if(h.puffs){for(const q of h.puffs){q.px+=q.speed*60*dt;q.py+=q.speed*42*dt;}if(h.cloudAge>0&&h.cloudAge<h.activeFor&&Math.random()<.6)h.bubbles.push({x:h.x+(Math.random()-.5)*480,y:h.y+(Math.random()-.5)*80,vx:(Math.random()-.5)*12,vy:-20-Math.random()*55,life:.7,maxLife:.7,size:2+Math.random()*5});for(let j=h.bubbles.length-1;j>=0;j--){const q=h.bubbles[j];q.x+=q.vx*dt;q.y+=q.vy*dt;q.life-=dt;if(q.life<=0)h.bubbles.splice(j,1);}}
   }
   if(h.type==='moonBeam'&&h.age>h.warning&&h.age<h.warning+h.activeFor&&!h.hit&&Math.abs(p.y-h.y)<h.thickness*.5+22&&p.x<this.w-20&&p.invuln<=0){h.hit=true;this.damagePlayer();}
   if(h.type==='moonPillars'){h.x+=h.vx*dt;const overlap=p.x+26>h.x&&p.x-26<h.x+h.width,inside=(p.y>h.g1&&p.y<h.g1+h.gap1H)||(p.y>h.g2&&p.y<h.g2+h.gap2H);if(overlap&&!inside&&!h.hit&&p.invuln<=0){h.hit=true;this.damagePlayer();}if(Math.random()<.7){h.particles.push({x:h.x+Math.random()*h.width,y:Math.random()*this.h,vx:-90+(Math.random()-.5)*80,vy:(Math.random()-.5)*55,life:.6,maxLife:.6,size:1.5+Math.random()*2.5,hue:240+Math.random()*60});}for(let j=h.particles.length-1;j>=0;j--){const q=h.particles[j];q.x+=q.vx*dt;q.y+=q.vy*dt;q.life-=dt;if(q.life<=0)h.particles.splice(j,1);}}
   if(h.type==='moonRift'){h.x+=h.vx*dt;const overlap=p.x+26>h.x&&p.x-26<h.x+h.width,inside=p.y<h.top||p.y>h.bottom;if(overlap&&!inside&&!h.hit&&p.invuln<=0){h.hit=true;this.damagePlayer();}}
   if(h.type==='splittingCore'){
    h.x+=h.vx*dt;h.y+=h.vy*dt;h.trail.push({x:h.x,y:h.y});if(h.trail.length>8)h.trail.shift();for(const q of h.spikes)q.a+=q.spin;
    if(!h.hit&&Math.hypot(p.x-h.x,p.y-h.y)<h.r+24&&p.invuln<=0){h.hit=true;this.damagePlayer();}
    if(h.age>=h.splitAt&&h.generation<3){h.life=0;const base=Math.atan2(h.vy,h.vx),spread=h.generation===0?.42:.34,speed=Math.max(360,Math.hypot(h.vx,h.vy)*.98);for(const sign of [-1,1]){const a=base+sign*spread,vx=Math.cos(a)*speed,vy=Math.sin(a)*speed;this.bossHazards.push({type:'splittingCore',x:h.x,y:h.y,vx,vy,generation:h.generation+1,age:0,splitAt:h.generation===0?.38:.34,life:Math.max(1.8,(h.x+this.w*.18)/Math.max(300,Math.abs(vx))+.8),r:18*Math.pow(.72,h.generation+1),trail:[],spikes:Array.from({length:8},(_,j)=>({a:j*Math.PI/4,spin:(Math.random()-.5)*.2})),hit:false});}}
   }
   if(h.type==='tornado'){h.x+=h.vx*dt;h.y+=h.vy*dt;h.rotation+=.18*60*dt;for(const q of h.particles)q.angle+=q.speed*60*dt;if(!h.hit&&Math.abs(p.x-h.x)<h.r*1.7+25&&Math.abs(p.y-h.y)<h.r*2.2+25&&p.invuln<=0){h.hit=true;this.damagePlayer();}}
   if(h.type==='miniLaser'){h.x+=h.vx*dt;h.y+=h.vy*dt;if(!h.hit&&Math.hypot(p.x-h.x,p.y-h.y)<h.r+24&&p.invuln<=0){h.hit=true;this.damagePlayer();}}
   if(h.type==='moonCrescent'){h.x+=h.vx*dt;h.y+=h.vy*dt;h.trail.push({x:h.x,y:h.y});if(h.trail.length>16)h.trail.shift();for(const q of h.sparkles)q.angle+=q.speed*60*dt;if(!h.hit&&Math.hypot(p.x-h.x,p.y-h.y)<h.r+23&&p.invuln<=0){h.hit=true;this.damagePlayer();}}
   if(h.type==='poisonBerry'){h.x+=h.vx*dt;h.y+=h.vy*dt;if(!h.hit&&Math.hypot(p.x-h.x,p.y-h.y)<h.r+25&&p.invuln<=0){h.hit=true;this.damagePlayer();}}
   if(h.life<=0||h.x<-220)this.bossHazards.splice(i,1);
  }catch(error){console.error('Пропущена ошибка атаки босса:',h?.type,error);this.bossHazards.splice(i,1);}}
 },
 drawBossHazards(c){
  for(const h of (this.bossHazards||[])){c.save();
   if(h.type==='acidLaser'){const warn=h.age<h.warning,intensity=warn?.25+.25*Math.sin(h.age*18):Math.max(0,Math.min(1,(h.life)/.35));c.strokeStyle=warn?`rgba(190,255,100,${intensity})`:`rgba(150,255,50,${.8*intensity})`;c.lineWidth=warn?3:18;c.shadowColor='#aaff00';c.shadowBlur=warn?12:28;c.setLineDash(warn?[12,9]:[]);c.beginPath();c.moveTo(h.x1,h.y1);c.lineTo(h.x2,h.y2);c.stroke();if(!warn){c.strokeStyle='#f5ffd9';c.lineWidth=5;c.setLineDash([]);c.stroke();}}
   else if(h.type==='toxicCloud'){
    if(h.age<h.warning){const pulse=.35+.25*Math.sin(h.age*18);c.globalAlpha=pulse;c.strokeStyle='#baff65';c.lineWidth=3;c.setLineDash([12,9]);c.shadowColor='#aaff00';c.shadowBlur=14;c.beginPath();c.ellipse(h.x,h.y,285,82,0,0,Math.PI*2);c.stroke();c.setLineDash([]);c.fillStyle='#d7ff9b';c.font='bold 16px system-ui';c.textAlign='center';c.fillText('⚠ ОБЛАКО ЯДА ⚠',h.x,h.y-92);}
    else{const t=h.cloudAge||0,intensity=Math.min(1,t/.28,Math.max(0,(h.activeFor-t)/.35));c.globalAlpha=intensity;c.save();c.translate(h.x,h.y);c.scale(6,1);const glow=c.createRadialGradient(0,0,0,0,0,60);glow.addColorStop(0,'rgba(100,200,0,.4)');glow.addColorStop(.5,'rgba(60,150,0,.2)');glow.addColorStop(1,'rgba(20,80,0,0)');c.fillStyle=glow;c.beginPath();c.arc(0,0,60,0,Math.PI*2);c.fill();c.restore();for(const q of h.puffs){const progress=Math.min(1,Math.max(0,(t*60-q.delay)/30));if(progress<=0)continue;const x=h.x+(q.ox+Math.sin(q.px)*20)*intensity,y=h.y+(q.oy+Math.cos(q.py)*15)*intensity,r=q.r*progress*intensity,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`hsla(${q.hue},100%,70%,${.5*intensity*progress})`);g.addColorStop(.4,`hsla(${q.hue},90%,50%,${.3*intensity*progress})`);g.addColorStop(1,`hsla(${q.hue},80%,20%,0)`);c.fillStyle=g;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}for(const q of h.bubbles){c.fillStyle=`rgba(200,255,100,${q.life/q.maxLife*.9})`;c.shadowColor='#aaff00';c.shadowBlur=12;c.beginPath();c.arc(q.x,q.y,q.size,0,Math.PI*2);c.fill();}}
   }
   else if(h.type==='moonBeam'){
    if(h.age<h.warning){const a=.3+Math.sin(h.age*18)*.3;c.strokeStyle=`rgba(200,180,255,${a})`;c.lineWidth=2;c.setLineDash([15,10]);c.lineDashOffset=-h.age*120;c.shadowColor='#aa88ff';c.shadowBlur=15;c.beginPath();c.moveTo(0,h.y);c.lineTo(this.w,h.y);c.stroke();c.setLineDash([]);const z=h.thickness*(h.age/h.warning);c.fillStyle=`rgba(150,100,255,${.15*h.age/h.warning})`;c.fillRect(0,h.y-z/2,this.w,z);c.fillStyle='#aa88ff';c.font='bold 16px system-ui';c.textAlign='center';c.fillText('⚠ ПРИГОТОВЬТЕСЬ ⚠',this.w/2,h.y-h.thickness/2-20);}
    else if(h.age<h.warning+h.activeFor){const k=Math.min(1,(h.warning+h.activeFor-h.age)/.2),g=c.createLinearGradient(0,h.y-h.thickness,0,h.y+h.thickness);g.addColorStop(0,'rgba(120,100,255,0)');g.addColorStop(.3,'rgba(150,120,255,.4)');g.addColorStop(.5,'rgba(200,180,255,.7)');g.addColorStop(.7,'rgba(150,120,255,.4)');g.addColorStop(1,'rgba(120,100,255,0)');c.fillStyle=g;c.fillRect(0,h.y-h.thickness,this.w,h.thickness*2);const beam=c.createLinearGradient(0,h.y-h.thickness/2,0,h.y+h.thickness/2);beam.addColorStop(0,'rgba(100,80,220,.5)');beam.addColorStop(.3,'rgba(180,150,255,.9)');beam.addColorStop(.5,'rgba(255,240,255,1)');beam.addColorStop(.7,'rgba(180,150,255,.9)');beam.addColorStop(1,'rgba(100,80,220,.5)');c.fillStyle=beam;c.fillRect(0,h.y-h.thickness/2,this.w,h.thickness);c.fillStyle='#fff';c.shadowColor='#aa88ff';c.shadowBlur=30;c.fillRect(0,h.y-8,this.w,16);for(let j=0;j<8;j++){const x=(h.age*300+j*200)%(this.w+100)-50,y=h.y+Math.sin(h.age*6+j)*(h.thickness*.3);c.fillStyle='rgba(255,255,255,.8)';c.beginPath();c.arc(x,y,4,0,Math.PI*2);c.fill();}}else{c.globalAlpha=Math.max(0,1-(h.age-h.warning-h.activeFor)/.25);c.fillStyle='rgba(180,150,255,.6)';c.fillRect(0,h.y-h.thickness/2,this.w,h.thickness);}
   }
   else if(h.type==='moonPillars'){
    const x=h.x,w=h.width,segments=[[0,h.topBottom],[h.middleTop,h.middleH],[h.bottomTop,this.h-h.bottomTop]];c.shadowColor='#aa88ff';c.shadowBlur=22;const grad=c.createLinearGradient(x,0,x+w,0);grad.addColorStop(0,'rgba(48,30,112,.98)');grad.addColorStop(.28,'rgba(92,68,178,.98)');grad.addColorStop(.5,'rgba(156,128,242,.98)');grad.addColorStop(.72,'rgba(92,68,178,.98)');grad.addColorStop(1,'rgba(48,30,112,.98)');
    for(let si=0;si<segments.length;si++){const [y,hh]=segments[si];if(hh<=0)continue;c.fillStyle=grad;c.fillRect(x,y,w,hh);c.strokeStyle='rgba(222,204,255,.95)';c.lineWidth=2;c.strokeRect(x+1,y+1,w-2,hh-2);for(let k=1;k<4;k++){const lx=x+w*k/4;c.strokeStyle=`rgba(205,180,255,${.28+.12*Math.sin(h.age*5+k)})`;c.lineWidth=1.5;c.beginPath();c.moveTo(lx,y+2);c.lineTo(lx,y+hh-2);c.stroke();}c.shadowBlur=0;c.fillStyle='rgba(225,210,255,.9)';c.fillRect(x,y,w,3);c.fillRect(x,y+hh-3,w,3);
     // Carved crescent sigils and luminous crystal facets, matching the supplied pillar artwork.
     const symbols=Math.max(1,Math.floor(hh/105));for(let j=0;j<symbols;j++){const cy=y+(j+.5)*hh/symbols, cx=x+w*.5,pulse=.55+.35*Math.sin(h.age*4+j);c.save();c.globalAlpha=pulse;c.translate(cx,cy);c.fillStyle='#e9ddff';c.shadowColor='#c6a5ff';c.shadowBlur=12;c.beginPath();c.arc(0,0,10,Math.PI*.25,Math.PI*1.75);c.arc(5,-2,9,Math.PI*1.75,Math.PI*.25,true);c.closePath();c.fill();c.restore();}
     for(let k=0;k<2;k++){const cy=y+hh*(.28+k*.44),cx=x+(k? w*.82:w*.18);c.save();c.translate(cx,cy);c.rotate(Math.PI/4);c.fillStyle='rgba(210,235,255,.78)';c.shadowColor='#b9a1ff';c.shadowBlur=12;c.fillRect(-5,-8,10,16);c.strokeStyle='rgba(255,255,255,.8)';c.strokeRect(-5,-8,10,16);c.restore();}
    }
    // Softly illuminated passages; keep the safe openings visually clear and wide.
    for(const [gy,gh] of [[h.topBottom,h.gap1H],[h.middleBottom,h.gap2H]]){const gg=c.createLinearGradient(x,gy,x+w,gy+gh);gg.addColorStop(0,'rgba(190,165,255,.16)');gg.addColorStop(.5,'rgba(225,210,255,.035)');gg.addColorStop(1,'rgba(190,165,255,.16)');c.fillStyle=gg;c.fillRect(x,gy,w,gh);c.fillStyle='rgba(235,225,255,.8)';c.font='bold 16px system-ui';c.textAlign='center';c.fillText('✦',x+w/2,gy+gh/2+5);}
   }
   else if(h.type==='moonRift'){const x=h.x,w=h.width;c.shadowColor='#aa88ff';c.shadowBlur=24;c.fillStyle='rgba(85,30,140,.82)';c.fillRect(x,h.top,w,h.bottom-h.top);c.fillStyle='rgba(25,0,45,.8)';c.fillRect(x+w*.2,h.top,w*.6,h.bottom-h.top);c.strokeStyle='#d6b5ff';c.lineWidth=4;c.strokeRect(x,h.top,w,h.bottom-h.top);}
   else if(h.type==='tornado'){
    c.translate(h.x,h.y);c.rotate(-.1);const s=h.r,len=s*4.5,top=-len/2;for(const sp of h.spirals){for(let pass=0;pass<3;pass++){c.beginPath();for(let j=0;j<=50;j++){const t=j/50,r=s*(1.8-t*1.6),a=sp.base+t*Math.PI*8+h.rotation+sp.phase,xx=Math.cos(a)*r+(pass-1)*s*.04,yy=top+t*len+Math.sin(a)*r*.45;if(j===0)c.moveTo(xx,yy);else c.lineTo(xx,yy);}c.strokeStyle=pass===1?`hsla(${sp.hue},70%,85%,1)`:`hsla(${sp.hue},40%,${pass===0?30:50}%,.4)`;c.lineWidth=pass===1?s*.15*sp.width:s*.1;c.shadowColor=`hsl(${sp.hue},100%,80%)`;c.shadowBlur=pass===1?15:0;c.stroke();}}for(const q of h.particles){const along=(q.t-.5)*len,r=s*(1.8-q.t*1.6),xx=Math.cos(q.angle)*r*1.1,yy=along+Math.sin(q.angle)*r*.45;c.fillStyle=`rgba(200,230,255,${q.alpha})`;c.shadowColor='#aaddff';c.shadowBlur=10;c.beginPath();c.arc(xx,yy,q.size,0,Math.PI*2);c.fill();}}
   else if(h.type==='moonCrescent'){
    const s=h.r;for(let j=0;j<h.trail.length;j++){const q=h.trail[j],t=j/h.trail.length;c.globalAlpha=t*.5;const g=c.createRadialGradient(q.x,q.y,0,q.x,q.y,t*12);g.addColorStop(0,`hsl(${250+t*30},100%,75%)`);g.addColorStop(1,'rgba(100,60,220,0)');c.fillStyle=g;c.beginPath();c.arc(q.x,q.y,t*12,0,Math.PI*2);c.fill();}c.globalAlpha=1;c.translate(h.x,h.y);c.rotate(h.age*1.8);if(h.variant===1){const glow=c.createRadialGradient(0,0,0,0,0,s*1.5);glow.addColorStop(0,'rgba(150,130,255,.6)');glow.addColorStop(.5,'rgba(90,60,200,.3)');glow.addColorStop(1,'rgba(20,0,60,0)');c.fillStyle=glow;c.beginPath();c.arc(0,0,s*1.5,0,Math.PI*2);c.fill();c.beginPath();c.arc(0,0,s*1.2,.3*Math.PI,1.7*Math.PI);c.arc(s*.5,0,s,1.65*Math.PI,.35*Math.PI,true);c.closePath();const g=c.createRadialGradient(-s*.2,-s*.2,0,0,0,s*1.4);g.addColorStop(0,'#fff');g.addColorStop(.5,'#ffffdd');g.addColorStop(1,'#ffffaa');c.fillStyle=g;c.shadowColor='#ffff88';c.shadowBlur=20;c.fill();c.strokeStyle='#cc88ff';c.lineWidth=3;c.stroke();}else{const body=c.createRadialGradient(-s*.2,-s*.2,0,0,0,s*.4);body.addColorStop(0,'#8a6adf');body.addColorStop(.6,'#1a1045');body.addColorStop(1,'#000');c.fillStyle=body;c.strokeStyle='#aa88ff';c.lineWidth=1.5;c.shadowColor='#8866dd';c.shadowBlur=15;c.beginPath();c.arc(0,0,s*.4,0,Math.PI*2);c.fill();c.stroke();for(let k=0;k<2;k++){const a=h.age*2+k*Math.PI,rr=s*1.1;c.save();c.translate(Math.cos(a)*rr,Math.sin(a)*rr*.7);c.rotate(h.age*1.4+k*Math.PI/2);c.beginPath();c.arc(0,0,s*.35,.3*Math.PI,1.7*Math.PI);c.arc(s*.14,0,s*.3,1.65*Math.PI,.35*Math.PI,true);c.closePath();c.fillStyle='#fff8c8';c.fill();c.strokeStyle='#cc88ff';c.stroke();c.restore();}}for(const q of h.sparkles){const xx=Math.cos(q.angle)*q.dist,yy=Math.sin(q.angle)*q.dist,tw=.5+.5*Math.sin(h.age*6+q.phase);c.globalAlpha=.4+tw*.6;c.fillStyle='#fff';c.shadowColor='#aaccff';c.shadowBlur=12;c.beginPath();c.arc(xx,yy,q.size,0,Math.PI*2);c.fill();}c.globalAlpha=1;
   }
   else if(h.type==='miniLaser'){
    const dx=Math.cos(h.angle),dy=Math.sin(h.angle),tailX=h.x-dx*h.length,tailY=h.y-dy*h.length;
    c.strokeStyle='rgba(100,255,0,.32)';c.lineWidth=20;c.shadowColor='#66ff00';c.shadowBlur=30;c.beginPath();c.moveTo(tailX,tailY);c.lineTo(h.x,h.y);c.stroke();c.strokeStyle='rgba(150,255,50,.9)';c.lineWidth=8;c.shadowBlur=20;c.beginPath();c.moveTo(tailX,tailY);c.lineTo(h.x,h.y);c.stroke();c.strokeStyle='#eaffcf';c.lineWidth=3;c.shadowColor='#fff';c.shadowBlur=14;c.beginPath();c.moveTo(tailX,tailY);c.lineTo(h.x,h.y);c.stroke();const g=c.createRadialGradient(h.x,h.y,0,h.x,h.y,h.r*3);g.addColorStop(0,'rgba(240,255,200,1)');g.addColorStop(.4,'rgba(150,255,50,.7)');g.addColorStop(1,'rgba(50,150,0,0)');c.fillStyle=g;c.beginPath();c.arc(h.x,h.y,h.r*3,0,Math.PI*2);c.fill();for(let k=0;k<2;k++){const rr=h.r*1.5+((h.age*8+k*10)%20);c.strokeStyle=`rgba(150,255,50,${.6-k*.3})`;c.lineWidth=1.5;c.beginPath();c.arc(h.x,h.y,rr,0,Math.PI*2);c.stroke();}
   }
   else if(h.type==='splittingCore'){
    const s=h.r;for(let j=0;j<h.trail.length;j++){const q=h.trail[j],t=j/h.trail.length;c.globalAlpha=t*.5;c.fillStyle='#aaff00';c.shadowColor='#66ff00';c.shadowBlur=10;c.beginPath();c.arc(q.x,q.y,t*s,0,Math.PI*2);c.fill();}c.globalAlpha=1;const glow=c.createRadialGradient(h.x,h.y,0,h.x,h.y,s*3);glow.addColorStop(0,'rgba(180,255,80,.8)');glow.addColorStop(.5,'rgba(100,200,20,.4)');glow.addColorStop(1,'rgba(40,100,0,0)');c.fillStyle=glow;c.beginPath();c.arc(h.x,h.y,s*3,0,Math.PI*2);c.fill();c.translate(h.x,h.y);c.strokeStyle='#ccff66';c.lineWidth=2;c.shadowColor='#aaff00';c.shadowBlur=10;for(const sp of h.spikes){c.beginPath();c.moveTo(Math.cos(sp.a)*s*.7,Math.sin(sp.a)*s*.7);c.lineTo(Math.cos(sp.a)*(s*1.5),Math.sin(sp.a)*(s*1.5));c.stroke();}const body=c.createRadialGradient(-s*.3,-s*.3,0,0,0,s);body.addColorStop(0,'#ffffcc');body.addColorStop(.4,'#bbff44');body.addColorStop(.8,'#55cc00');body.addColorStop(1,'#226600');c.fillStyle=body;c.beginPath();c.arc(0,0,s*(1+Math.sin(h.age*30)*.1),0,Math.PI*2);c.fill();c.fillStyle='#fff';c.beginPath();c.arc(0,0,s*.4,0,Math.PI*2);c.fill();
   }
   else if(h.type==='poisonBerry'){c.translate(h.x,h.y);c.rotate(h.age*2);c.shadowColor='#9dff38';c.shadowBlur=20;c.fillStyle='#a6ee42';c.beginPath();c.arc(0,0,h.r,0,Math.PI*2);c.fill();c.strokeStyle='#e4ff9d';c.lineWidth=3;for(let k=0;k<8;k++){const a=k*Math.PI/4;c.beginPath();c.moveTo(Math.cos(a)*h.r*.7,Math.sin(a)*h.r*.7);c.lineTo(Math.cos(a)*(h.r+10),Math.sin(a)*(h.r+10));c.stroke();}c.fillStyle='#fff';c.beginPath();c.arc(-5,-5,4,0,Math.PI*2);c.fill();}
   c.restore();
  }
 },
 damagePlayer(force=false){const b=this.boss,p=this.pony;if(!b||(!force&&p.invuln>0))return;this.runDamaged=true;const shieldLevel=Number(gameState?.upgrades?.shield||0);p.invuln=Math.max(p.invuln||0,1.05+shieldLevel*.28);b.playerHp--;soundFX.crash();this.burst(p.x,p.y,8,'#ff9da9');$('boss-player-hp').innerHTML=Array.from({length:Math.max(0,b.playerHp)},()=>'<img class="heart-icon" src="/assets/ui/heart.png" alt="♥">').join('');if(b.playerHp<=0)this.endBoss(false);},
 drawBossScene(){
  const c=this.ctx,w=this.w,h=this.h,b=this.boss;if(!b)return;
  c.save();
  // Arena remains one continuous scene: no divider, tint panel or split-screen overlay.

  // Discord portrait sprite on transparent background, with a gentle idle sway.
  const bw=b.width||Math.min(220,w*.30),bh=Math.min(340,h*.70);
  c.save();c.translate(b.x,b.y);c.rotate(Math.sin(performance.now()/620)*.018);
  c.filter='saturate(1.08)';c.shadowColor=b.hitFlash>0?'#fff2bd':'#d6a5ff';c.shadowBlur=b.hitFlash>0?48:30;
  if(this.bossImage.complete&&this.bossImage.naturalWidth){
   const fit=Math.min(bw/this.bossImage.naturalWidth,bh/this.bossImage.naturalHeight),dw=this.bossImage.naturalWidth*fit,dh=this.bossImage.naturalHeight*fit;c.drawImage(this.bossImage,-dw*.5,-dh*.5,dw,dh);c.filter='none';
  }else{
   c.fillStyle='#7650a8';c.beginPath();c.ellipse(0,0,bw*.30,bh*.22,0,0,Math.PI*2);c.fill();
  }
  c.restore();
  const fx=window.PonyOriginalCombatEffects;if(fx){c.drawImage(fx.projectiles.canvas,0,0,w,h);c.drawImage(fx.blackHole.canvas,0,0,w,h);c.drawImage(fx.laser.canvas,0,0,w,h);}
  this.drawBossHazards(c);this.flutterButterflies.forEach(shot=>shot.draw(c));
  for(const beamFx of (this.laserEffects||[])){if(beamFx?.canvas)c.drawImage(beamFx.canvas,0,0,w,h);}
  if((this.bossBanner||0)>0){const elapsed=2.4-this.bossBanner,alpha=Math.min(1,elapsed/.22,(this.bossBanner||0)/.28),bw=Math.min(390,w-36),bh=54,bx=(w-bw)/2,by=h*.16-Math.min(10,elapsed*10);c.save();c.globalAlpha=Math.max(0,alpha);c.shadowColor='#9d7bff';c.shadowBlur=12;c.fillStyle='rgba(25,18,48,.86)';c.strokeStyle='rgba(225,207,255,.78)';c.lineWidth=1.5;c.beginPath();c.roundRect(bx,by,bw,bh,12);c.fill();c.stroke();c.shadowBlur=0;c.fillStyle='#fff';c.textAlign='center';c.textBaseline='middle';c.font='900 19px system-ui';c.fillText(`БОЙ С ${this.levelConfig.boss.toUpperCase()}`,w/2,by+bh/2+1);c.restore();}
  c.restore();
 },
 async endBoss(won){
  if(!this.running)return;this.running=false;this.over=true;this.bossMode=false;this.bossFinished=true;$('boss-damage-counter')?.classList.add('hidden');levelSoundtrack.stop();cancelAnimationFrame(this.raf);
  if(this.bossPractice){let bestDamage=Math.floor(this.totalBossDamage),earned=0;try{const record=await api('/api/game/boss-record',{method:'POST',body:JSON.stringify({damage:bestDamage})});gameState=record.state;bestDamage=Number(record.bestBossDamage)||bestDamage;}catch(e){showToast('Не удалось сохранить рекорд: '+e.message);}try{const payout=await api('/api/game/finish',{method:'POST',body:JSON.stringify({score:0,coinsCollected:this.coins,levelId:0,bossWon:false,endless:true,damageTaken:this.runDamaged})});gameState=payout.state;earned=payout.coinsEarned;updateHeader();renderShop();}catch(e){showToast('Не удалось начислить монеты: '+e.message);} $('boss-hud')?.classList.add('hidden');$('boss-damage-counter')?.classList.add('hidden');$('overlay-title').textContent='Тренировка завершена';$('overlay-text').textContent=`Нанесено урона: ${fmt(Math.floor(this.totalBossDamage))}. Рекорд: ${fmt(bestDamage)}. Собрано монет: ${fmt(this.coins)} · награда: ${fmt(earned)} монет.`;$('overlay-btn').textContent='Ещё бой';$('overlay-menu-btn').classList.remove('hidden');$('overlay-menu-btn').textContent='В главное меню';$('game-overlay').classList.remove('hidden');return;}
  let earned=0;try{const result=await api('/api/game/finish',{method:'POST',body:JSON.stringify({score:this.score*10,coinsCollected:this.coins+(won?50:0),levelId:this.selectedLevel,bossWon:won,endless:false,damageTaken:this.runDamaged})});gameState=result.state;earned=result.coinsEarned;updateHeader();renderShop();renderCollection();renderAchievements();renderCampaign();}catch(e){showToast('Не удалось сохранить результат: '+e.message);}
  $('boss-hud')?.classList.add('hidden');
  $('overlay-title').textContent=won?`ПОБЕДА! ${this.levelConfig.boss.toUpperCase()} ПОВЕРЖЕН`:'Босс оказался сильнее';
  $('overlay-text').textContent=won?`Ты прошёл уровень ${this.selectedLevel}, победил босса и получил бонус! Награда: ${fmt(earned)} монет.`:`Уровень ${this.selectedLevel}: босс остался непобеждённым. Попробуй ещё раз! Награда: ${fmt(earned)} монет.`;
  $('overlay-btn').textContent='Заново';$('overlay-menu-btn').classList.remove('hidden');$('overlay-menu-btn').textContent='В главное меню';renderCampaign();$('game-overlay').classList.remove('hidden');
 },
 ponyTouchesPoint(x,y,radius=0){
  // Collision follows the visible pony silhouette rather than a tiny center point.
  // Convert the coin position into the pony's rotated local coordinate space.
  const p=this.pony, angle=-Math.max(-.48,Math.min(.55,p.vy/950));
  const dx=x-p.x,dy=y-p.y,cs=Math.cos(angle),sn=Math.sin(angle);
  const lx=dx*cs-dy*sn,ly=dx*sn+dy*cs;
  const shapes=[
   {x:-2,y:8,rx:47,ry:28},    // torso
   {x:42,y:-16,rx:27,ry:27},  // head and muzzle
   {x:15,y:-39,rx:25,ry:29},  // horn / forelock
   {x:-12,y:-34,rx:39,ry:34}, // wing area when spread
   {x:-53,y:1,rx:27,ry:17},   // tail
   {x:22,y:39,rx:24,ry:15},   // front legs
   {x:-28,y:39,rx:25,ry:15}   // rear legs
  ];
  return shapes.some(a=>{const nx=(lx-a.x)/(a.rx+radius),ny=(ly-a.y)/(a.ry+radius);return nx*nx+ny*ny<=1;});
 },
 hit(){if(!this.running)return;if(this.effectValue('SHIELD')>0&&!this.shieldUsed){this.shieldUsed=true;this.pony.invuln=1.25;this.pony.vy=-220;this.burst(this.pony.x,this.pony.y,24,'#9deaff');showToast('Щит спас тебя от столкновения!');return;}if(this.pony.invuln>0)return;this.runDamaged=true;soundFX.crash();this.shake=4;this.burst(this.pony.x,this.pony.y,18,'#f6b8ff');this.end();},
 burst(x,y,n,color){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=28+Math.random()*120;this.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.3+Math.random()*.35,color,r:2+Math.random()*2.5});}},
 drawBackground(){const c=this.ctx,w=this.w,h=this.h;if(this.sky.complete&&this.sky.naturalWidth){const scale=Math.max(w/this.sky.width,h/this.sky.height),sw=w/scale,sh=h/scale,range=Math.max(1,this.sky.width-sw),travel=range>8?(this.world*.035)%(range*2):0,sx=travel<=range?travel:range*2-travel,sy=Math.max(0,(this.sky.height-sh)*.5);c.drawImage(this.sky,sx,sy,sw,sh,0,0,w,h);}else{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#5a83dc');g.addColorStop(1,'#f2b9e8');c.fillStyle=g;c.fillRect(0,0,w,h);}c.save();c.fillStyle='rgba(8, 10, 24, 0.18)';c.fillRect(0,0,w,h);c.restore();if(this.selectedLevel===1){c.fillStyle='#fff9';for(let i=0;i<8;i++){const x=((i*191-this.world*.27)%(w+190)+w+190)%(w+190)-70,y=45+(i%4)*h*.14;this.cloud(c,x,y,.5+(i%3)*.12);}}},
 cloud(c,x,y,s){c.beginPath();c.arc(x,y,17*s,0,Math.PI*2);c.arc(x+22*s,y-9*s,23*s,0,Math.PI*2);c.arc(x+47*s,y,17*s,0,Math.PI*2);c.fill();},
 drawFlightBounds(){
  const c=this.ctx,w=this.w,h=this.h,top=0,bottom=h;
  const themes=[
   {edge:'#75d9a7',glow:'#b5ffcf',dark:'#285d58',gem:'#eaffc8'},
   {edge:'#5bdfff',glow:'#c4f8ff',dark:'#285b91',gem:'#e2ffff'},
   {edge:'#c58aff',glow:'#f2b5ff',dark:'#552d83',gem:'#ffe0ff'}
  ];
  const t=themes[Math.max(0,Math.min(2,(this.selectedLevel||1)-1))];
  c.save();
  for(const [idx,y] of [top,bottom].entries()){
   c.shadowColor='#ffffff';c.shadowBlur=4;c.strokeStyle='#ffffffaa';c.lineWidth=5;
   c.setLineDash([]);c.beginPath();c.moveTo(0,idx===0?Math.max(2,y+2):Math.min(this.h-2,y-2));c.lineTo(w,idx===0?Math.max(2,y+2):Math.min(this.h-2,y-2));c.stroke();c.shadowBlur=0;c.strokeStyle='#000000';c.lineWidth=3;c.beginPath();c.moveTo(0,idx===0?Math.max(2,y+2):Math.min(this.h-2,y-2));c.lineTo(w,idx===0?Math.max(2,y+2):Math.min(this.h-2,y-2));c.stroke();
  }
  c.restore();
 },
 drawObstacle(o){
  const c=this.ctx,x=o.x,w=62,top=o.center-o.gap/2,bottom=o.center+o.gap/2;
  const pillar=(y,height,flip=false)=>{
   if(height<=0)return;
   const shaftTop=flip?y+8:y,shaftHeight=Math.max(0,height-8);
   const g=c.createLinearGradient(x,0,x+w,0);
   g.addColorStop(0,'#211b48');g.addColorStop(.16,'#514080');g.addColorStop(.38,'#9b80c9');g.addColorStop(.52,'#c9b5ed');g.addColorStop(.72,'#7259a4');g.addColorStop(1,'#211a43');
   c.save();
   c.shadowColor='#9a6be8';c.shadowBlur=13;
   c.fillStyle=g;c.fillRect(x+5,shaftTop,w-10,shaftHeight);
   c.shadowBlur=0;
   // Fine inset bevels and luminous vertical facets.
   c.strokeStyle='rgba(235,218,255,.72)';c.lineWidth=1.4;c.beginPath();c.moveTo(x+10,shaftTop+2);c.lineTo(x+10,shaftTop+shaftHeight-2);c.moveTo(x+w-10,shaftTop+2);c.lineTo(x+w-10,shaftTop+shaftHeight-2);c.stroke();
   c.strokeStyle='rgba(255,255,255,.22)';c.lineWidth=2;c.beginPath();c.moveTo(x+20,shaftTop+8);c.lineTo(x+20,shaftTop+shaftHeight-8);c.stroke();
   // Repeating inset crystal/rune marks along the column.
   const count=Math.floor(Math.min(shaftHeight,420)/72);
   for(let i=0;i<count;i++){
    const yy=shaftTop+34+i*72;
    c.globalAlpha=.42;c.strokeStyle='#e8d8ff';c.lineWidth=1.2;c.beginPath();c.moveTo(x+w/2,yy-9);c.lineTo(x+w/2+6,yy);c.lineTo(x+w/2,yy+9);c.lineTo(x+w/2-6,yy);c.closePath();c.stroke();
    c.globalAlpha=.28;c.fillStyle='#d6baff';c.beginPath();c.arc(x+w/2,yy,2.2,0,Math.PI*2);c.fill();
   }
   // Ornamental end cap, facing the gap.
   const edge=flip?y:y+height;
   const capY=flip?edge-16:edge-8;
   const cg=c.createLinearGradient(x-8,capY,x+w+8,capY+16);
   cg.addColorStop(0,'#4d3979');cg.addColorStop(.25,'#d4c1f3');cg.addColorStop(.55,'#8065b1');cg.addColorStop(1,'#3b2b67');
   c.fillStyle=cg;c.strokeStyle='#e9d5ff';c.lineWidth=2;
   c.beginPath();c.roundRect(x-7,capY,w+14,18,5);c.fill();c.stroke();
   c.fillStyle='#f0ddff';c.globalAlpha=.9;c.beginPath();
   if(!flip){c.moveTo(x-11,capY+4);c.lineTo(x+4,capY-12);c.lineTo(x+w-4,capY-12);c.lineTo(x+w+11,capY+4);}
   else{c.moveTo(x-11,capY+14);c.lineTo(x+4,capY+30);c.lineTo(x+w-4,capY+30);c.lineTo(x+w+11,capY+14);}
   c.closePath();c.fill();
   // Small central crystal set into the cap.
   const gemY=flip?capY+6:capY+10;
   c.globalAlpha=1;c.shadowColor='#d8aaff';c.shadowBlur=12;c.fillStyle='#f4e7ff';c.beginPath();
   c.moveTo(x+w/2,gemY-7);c.lineTo(x+w/2+6,gemY);c.lineTo(x+w/2,gemY+7);c.lineTo(x+w/2-6,gemY);c.closePath();c.fill();
   c.restore();
  };
  pillar(0,Math.max(0,top));pillar(bottom,Math.max(0,this.h-bottom),true);
},drawPony(){const c=this.ctx,p=this.pony;c.save();c.translate(p.x,p.y);c.rotate(Math.max(-.48,Math.min(.55,p.vy/950)));if(p.invuln>0&&Math.floor(performance.now()/90)%2===0)c.globalAlpha=.48;const rising=p.vy < -35;const justFlapped=(p.flap||0)>0.04;const img=(rising||justFlapped)?this.ponyOpen:this.ponyFold;if(img.complete&&img.naturalWidth){const boxW=176,boxH=128,scale=Math.min(boxW/img.naturalWidth,boxH/img.naturalHeight),dw=img.naturalWidth*scale,dh=img.naturalHeight*scale;c.shadowColor='#29164c99';c.shadowBlur=12;c.drawImage(img,-dw/2,-dh/2,dw,dh);}else{c.fillStyle='#d9a5fa';c.beginPath();c.ellipse(0,0,22,15,0,0,Math.PI*2);c.fill();}c.restore();},
 draw(){const c=this.ctx,w=this.w,h=this.h;c.save();if(this.shake>0){c.translate((Math.random()-.5)*this.shake,(Math.random()-.5)*this.shake);this.shake*=.78;}c.clearRect(0,0,w,h);this.drawBackground();this.drawFlightBounds();this.obstacles.forEach(o=>this.drawObstacle(o));this.pickups.forEach(q=>{const y=q.y+Math.sin(q.phase)*4,fade=q.collecting?Math.max(0,q.collectTimer/.26):1,spin=q.phase+(q.collecting?(1-fade)*Math.PI*3:0);c.save();c.translate(q.x,y-(q.collecting?(1-fade)*18:0));c.rotate(q.collecting?(1-fade)*.55:Math.sin(q.phase*.35)*.08);c.scale(Math.max(.08,Math.abs(Math.cos(spin))),fade);c.globalAlpha=fade;c.shadowColor='#ffd65e';c.shadowBlur= q.collecting?24:13;if(this.coinImage?.complete&&this.coinImage.naturalWidth)c.drawImage(this.coinImage,-15,-15,30,30);else{c.fillStyle='#ffcf4d';c.beginPath();c.arc(0,0,10,0,Math.PI*2);c.fill();c.strokeStyle='#fff4ae';c.lineWidth=2;c.stroke();}c.restore();});this.particles.forEach(a=>{c.globalAlpha=Math.max(0,a.life*2.2);c.fillStyle=a.color;c.beginPath();c.arc(a.x,a.y,a.r,0,Math.PI*2);c.fill();});c.globalAlpha=1;this.drawPony();if(this.bossMode)this.drawBossScene();c.restore();},
 drawIdle(){if(!this.ctx||!this.w||!this.h)return;this.running=false;this.obstacles=[];this.pickups=[];this.particles=[];this.pony={x:this.w*.22,y:this.h*.45,vy:0,flap:.2};this.draw();},
 async end(){if(!this.running)return;this.running=false;this.over=true;this.bossMode=false;levelSoundtrack.stop();$('boss-hud')?.classList.add('hidden');cancelAnimationFrame(this.raf);let earned=0;try{const result=await api('/api/game/finish',{method:'POST',body:JSON.stringify({score:this.score*10,coinsCollected:this.coins,levelId:this.endlessMode?0:this.selectedLevel,bossWon:false,endless:!!this.endlessMode,damageTaken:this.runDamaged})});gameState=result.state;earned=result.coinsEarned;updateHeader();renderShop();renderCollection();renderAchievements();renderCampaign();}catch(e){showToast('Не удалось сохранить результат: '+e.message);}$('overlay-title').textContent='Полёт завершён!';$('overlay-text').textContent=`Башни: ${this.score} · Монеты: ${this.coins}. Награда: ${fmt(earned)} монет.`;$('overlay-btn').textContent='Заново';$('overlay-menu-btn').classList.remove('hidden');$('overlay-menu-btn').textContent='В главное меню';$('game-overlay').classList.remove('hidden');}
};
game.init();
applySkin();
const settingsToggle=$('settings-toggle'),soundSettings=$('sound-settings');settingsToggle.addEventListener('click',()=>{soundSettings.classList.toggle('hidden');settingsToggle.setAttribute('aria-expanded',String(!soundSettings.classList.contains('hidden')));});
$('sound-all-off').addEventListener('click',()=>{soundFX.toggle();soundFX.updateButton();});document.addEventListener('pointerdown',e=>{if(!e.target.closest('.topbar-actions')){soundSettings.classList.add('hidden');settingsToggle.setAttribute('aria-expanded','false');}});
$('music-volume').value=Math.round(Number(localStorage.getItem('ponyMusicVolume')??.7)*100);$('fx-volume').value=Math.round(Number(localStorage.getItem('ponyFxVolume')??.7)*100);
$('music-volume-value').textContent=$('music-volume').value+'%';$('fx-volume-value').textContent=$('fx-volume').value+'%';
$('music-volume').addEventListener('input',e=>{const v=e.target.value/100;$('music-volume-value').textContent=e.target.value+'%';levelSoundtrack.setVolume(v);});
$('fx-volume').addEventListener('input',e=>{soundFX.master=e.target.value/100;localStorage.setItem('ponyFxVolume',String(soundFX.master));$('fx-volume-value').textContent=e.target.value+'%';$('pause-fx-volume').value=e.target.value;$('pause-fx-value').textContent=e.target.value+'%';});$('pause-music-volume').addEventListener('input',e=>{const v=e.target.value/100;$('pause-music-value').textContent=e.target.value+'%';$('music-volume').value=e.target.value;$('music-volume-value').textContent=e.target.value+'%';levelSoundtrack.setVolume(v);});$('pause-fx-volume').addEventListener('input',e=>{soundFX.master=e.target.value/100;localStorage.setItem('ponyFxVolume',String(soundFX.master));$('pause-fx-value').textContent=e.target.value+'%';$('fx-volume').value=e.target.value;$('fx-volume-value').textContent=e.target.value+'%';});$('music-volume').addEventListener('input',e=>{$('pause-music-volume').value=e.target.value;$('pause-music-value').textContent=e.target.value+'%';});soundFX.updateButton();
document.addEventListener('click',e=>{if(e.target.closest('button')&&e.target.id!=='sound-all-off'&&e.target.id!=='settings-toggle'){soundFX.unlock();soundFX.ui();}},true);
function gameInput(e){if(e){e.preventDefault();}if(game.running){game.flap();}else if(game.paused){game.pause(false);}else game.start();}
game.canvas.addEventListener('pointerdown',gameInput,{passive:false});game.canvas.addEventListener('contextmenu',e=>e.preventDefault());$('start-btn').addEventListener('click',()=>{renderCampaign();go('campaign');});$('endless-mode-btn')?.addEventListener('click',()=>{go('play');requestAnimationFrame(()=>game.start(1,true));});$('boss-practice-btn')?.addEventListener('click',()=>{go('play');requestAnimationFrame(()=>game.start(3,false,true));});document.querySelectorAll('[data-level]').forEach(btn=>btn.addEventListener('click',()=>{if(btn.disabled)return;selectedLevel=Number(btn.dataset.level);go('play');requestAnimationFrame(()=>{try{game.start(selectedLevel);}catch(error){console.error('Не удалось запустить уровень:',error);showToast('Не удалось запустить уровень. Обнови страницу и попробуй ещё раз.');go('campaign');}});}));$('overlay-btn').addEventListener('click',()=>{soundFX.unlock();if(game.paused){game.pause(false);}else{game.bossFinished=false;game.start(game.selectedLevel,!!game.endlessMode,!!game.bossPractice);}});$('overlay-menu-btn')?.addEventListener('click',()=>{levelSoundtrack.stop();game.running=false;game.paused=false;game.bossFinished=false;cancelAnimationFrame(game.raf);$('game-overlay').classList.add('hidden');go('home');});$('pause-btn').addEventListener('click',()=>game.pause());$('exit-game').addEventListener('click',()=>{levelSoundtrack.stop();if(game.running){game.running=false;cancelAnimationFrame(game.raf);}go('home');});document.addEventListener('keydown',e=>{if($('play').classList.contains('active')&&game.bossMode&&(e.code==='Space'||e.code==='ArrowUp'||e.code==='KeyW')){game.flap();e.preventDefault();}else if(e.code==='Space'&&$('play').classList.contains('active'))gameInput(e);if(e.code==='Escape'&&$('play').classList.contains('active')){if(game.running)game.pause(true);else{levelSoundtrack.stop();go('home');}}});window.addEventListener('resize',()=>game.resize());if(window.ResizeObserver){const gameFrame=document.querySelector('.game-frame');if(gameFrame)new ResizeObserver(()=>game.resize()).observe(gameFrame);}(async()=>{
 const minimumLoaderTime=new Promise(resolve=>setTimeout(resolve,2000));
 try{await loadAssetManifest();await refresh();renderCampaign();renderSkins();applySkin();game.resize();}
 catch(e){console.error('Ошибка начальной загрузки:',e);showToast('Не удалось подключиться к серверу. Проверь соединение и обнови страницу.');}
 await minimumLoaderTime;
 const loader=$('startup-loader');if(loader){loader.classList.add('startup-loader-hidden');setTimeout(()=>loader.remove(),550);}
 // Finish decoding all level art, skins and card images after the menu appears.
 preloadAllGameAssets();
})();
