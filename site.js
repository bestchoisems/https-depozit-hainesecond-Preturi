(()=>{
  'use strict';

  // Magyar GitHub weboldal – meglévő menü, Akciók és Termékvideók.
  const menuButton=document.querySelector('.mobile-menu-btn');
  const menu=document.getElementById('main-navigation');
  if(menuButton&&menu){
    menuButton.addEventListener('click',()=>{
      const open=menuButton.getAttribute('aria-expanded')!=='true';
      menuButton.setAttribute('aria-expanded',String(open));
      menuButton.textContent=open?'× Bezárás':'☰ Menü';
      menu.classList.toggle('is-open',open);
    });
    menu.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{
      menu.classList.remove('is-open');
      menuButton.setAttribute('aria-expanded','false');
      menuButton.textContent='☰ Menü';
    }));
  }

  const root=document.querySelector('[data-catalog]');
  if(!root)return;
  const source=root.dataset.csv||'https://preturi.depozit-hainesecond.ro/prices.csv';
  const type=root.dataset.catalog;
  const output=document.getElementById('results');
  const count=document.getElementById('result-count');
  const search=document.getElementById('search-products');
  if(!output||!count)return;

  let products=[];
  let selectedCategory='all';

  function parseCSV(raw){
    const result=[];
    let row=[],cell='',quoted=false;
    for(let i=0;i<raw.length;i++){
      const c=raw[i];
      if(c==='"'){
        if(quoted&&raw[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;
      }else if(c===','&&!quoted){row.push(cell);cell='';}
      else if((c==='\r'||c==='\n')&&!quoted){
        if(c==='\r'&&raw[i+1]==='\n')i++;
        row.push(cell);
        if(row.some(x=>x.trim()))result.push(row);
        row=[];cell='';
      }else cell+=c;
    }
    row.push(cell);
    if(row.some(x=>x.trim()))result.push(row);
    if(result.length<2)return [];
    const headers=result.shift().map(x=>x.replace(/^\uFEFF/,'').trim().toLowerCase().replace(/\s+/g,'_'));
    return result.map(r=>Object.fromEntries(headers.map((h,i)=>[h,(r[i]||'').trim()])));
  }

  function value(row,...keys){
    for(const key of keys){
      if(Object.hasOwn(row,key)&&row[key])return row[key];
    }
    return '';
  }
  function escapeHTML(value){
    return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function name(r){return value(r,'hu_termék','hu_termek','nev_hu','termek_neve_hu','termek_hu','magyar_nev','name_hu','product_hu','termek','termék','name');}
  function description(r){return value(r,'hu_leírás','hu_leiras','leiras_hu','description_hu','leiras','leírás','description');}
  function category(r){return value(r,'kategoria','kategória','category','kategori','tipus').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
  function groupOf(r){
    const v=category(r);
    if(/promo|akcio/.test(v))return 'promo';
    if(/toamna|iarna|osz|tel|winter|autumn/.test(v))return 'winter';
    if(/primavara|vara|tavasz|nyar|summer|spring/.test(v))return 'summer';
    return 'other';
  }
  function active(r){
    const v=value(r,'aktiv','active').trim().toLocaleLowerCase('hu');
    return !v||['igen','yes','true','1','da','aktiv','active','x'].includes(v);
  }
  function ytId(raw){
    try{
      const url=new URL(raw);
      if(url.protocol!=='https:')return '';
      const host=url.hostname.toLowerCase(),parts=url.pathname.split('/').filter(Boolean);
      let id='';
      if(['youtu.be','www.youtu.be'].includes(host))id=parts[0]||'';
      else if(['youtube.com','www.youtube.com','m.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(host)){
        if(parts[0]==='watch')id=url.searchParams.get('v')||'';
        else if(['shorts','embed','live'].includes(parts[0]))id=parts[1]||'';
      }
      return /^[A-Za-z0-9_-]{11}$/.test(id)?id:'';
    }catch{return '';}
  }
  function getVideoId(r){return ytId(value(r,'video','video_url','youtube','youtube_url','link_video','video_link','url_video','link'));}
  function number(v){
    const raw=String(v??'').replace(/\s/g,'').replace(/[^\d,.-]/g,'');
    if(!raw)return NaN;
    const c=raw.lastIndexOf(','),d=raw.lastIndexOf('.');
    if(c>=0&&d>=0)return Number(raw.replace(c>d?/\./g:/,/g,'').replace(',','.'));
    return Number(raw.replace(',','.'));
  }
  function money(v){const n=number(v);return Number.isFinite(n)&&n>=0?Math.round(n).toLocaleString('hu-HU')+' Ft':escapeHTML(v);}
  function balePrice(r){return value(r,'ár/bála','ár_bála','ar/bala','ar_bala','ar_huf','ár_huf','huf_ar','huf','price_huf','price','ar','ár');}
  function pricePerKg(r){return value(r,'ár/kg','ar/kg','ár_kg','ar_kg');}
  function oldPrice(r){return value(r,'régi_ár_huf','regi_ár_huf','regi_ar_huf');}

  function card(r){
    const title=name(r),desc=description(r),kg=value(r,'kg','suly','súly','weight'),price=balePrice(r);
    const old=oldPrice(r),unit=pricePerKg(r),id=getVideoId(r),promo=groupOf(r)==='promo';
    const validOld=promo&&Number.isFinite(number(old))&&Number.isFinite(number(price))&&number(old)>number(price);
    return `<article class="product-card">${promo?'<span class="tag">AKCIÓ</span>':''}`+
      `<h2>${escapeHTML(title)}</h2>`+
      (desc?`<p class="muted">${escapeHTML(desc)}</p>`:'')+
      (validOld?`<p class="muted"><s>${money(old)}</s></p>`:'')+
      (price?`<p class="price">${money(price)}${kg?' / bála':''}</p>`:'')+
      (unit?`<p class="muted">${escapeHTML(unit)} / kg</p>`:'')+
      (kg?`<p class="muted">${escapeHTML(kg)} kg / bála</p>`:'')+
      (id?`<div class="buttons"><button class="button video-open" type="button" data-video-id="${id}" aria-label="${escapeHTML(title)} videó megtekintése">▶ Videó megtekintése</button></div>`:'')+
      '</article>';
  }

  // A CRM jóváhagyott exportsorrendje a CSV sorainak sorrendje.
  // PROMO mindig első, a téli/nyári kategóriák egymáshoz képest szezonfüggők.
  function categoryOrder(){
    const first={winter:Infinity,summer:Infinity};
    products.forEach((r,i)=>{const k=groupOf(r);if(k in first&&first[k]===Infinity)first[k]=i;});
    const seasons=['winter','summer'].sort((a,b)=>first[a]-first[b]);
    return ['promo',...seasons];
  }
  const titles={promo:'🔥 Akciók',winter:'❄️ Ősz / Tél',summer:'☀️ Tavasz / Nyár'};
  function render(){
    const q=(search?.value||'').trim().toLocaleLowerCase('hu');
    let rows=products.filter(r=>name(r)&&active(r));
    if(type==='promo')rows=rows.filter(r=>groupOf(r)==='promo');
    if(type==='videos')rows=rows.filter(r=>!!getVideoId(r));
    if(q)rows=rows.filter(r=>(name(r)+' '+description(r)).toLocaleLowerCase('hu').includes(q));

    if(type==='videos'){
      const order=categoryOrder();
      const tabs=root.querySelector('.tabs');
      if(tabs)order.forEach(k=>{const el=tabs.querySelector(`[data-filter="${k}"]`);if(el)tabs.appendChild(el);});
      const showing=selectedCategory==='all'?order:order.filter(k=>k===selectedCategory);
      output.innerHTML=showing.map(key=>{
        const groupItems=rows.filter(r=>groupOf(r)===key);
        return `<section class="video-category" id="category-${key}"><h2>${titles[key]} <small>(${groupItems.length})</small></h2>`+
          `<div class="product-grid">${groupItems.length?groupItems.map(card).join(''):'<p class="notice">Ebben a kategóriában jelenleg nincs videó.</p>'}</div></section>`;
      }).join('');
      count.textContent=rows.filter(r=>order.includes(groupOf(r))).length+' videós termék';
      return;
    }
    count.textContent=rows.length+' termék';
    output.innerHTML=rows.length?rows.map(card).join(''):'<p class="notice">Ebben a kategóriában jelenleg nincs megjeleníthető termék.</p>';
  }

  // Eseménykezelőket pontosan EGYSZER kötünk be.
  const modal=document.getElementById('videoModal');
  if(modal){
    const frame=document.getElementById('videoFrame'),external=document.getElementById('videoExternal'),close=document.getElementById('closeVideo');
    let prior=null;
    function closeModal(){
      modal.hidden=true;
      frame?.removeAttribute('src');
      document.body.style.overflow='';
      if(prior?.isConnected)prior.focus();
    }
    document.addEventListener('click',e=>{
      const button=e.target.closest('.video-open');
      if(button){
        const id=button.dataset.videoId;
        if(!/^[A-Za-z0-9_-]{11}$/.test(id))return;
        prior=button;
        external.href='https://www.youtube.com/watch?v='+id;
        frame.src='https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1&playsinline=1&rel=0';
        modal.hidden=false;
        document.body.style.overflow='hidden';
        close.focus();
      }else if(e.target===modal||e.target===close)closeModal();
    });
    document.addEventListener('keydown',e=>{
      if(modal.hidden)return;
      if(e.key==='Escape')closeModal();
      if(e.key==='Tab'){
        if(e.shiftKey&&document.activeElement===close){e.preventDefault();external.focus();}
        else if(!e.shiftKey&&document.activeElement===external){e.preventDefault();close.focus();}
      }
    });
  }
  root.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
    selectedCategory=button.dataset.filter;
    root.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===button));
    render();
  }));
  search?.addEventListener('input',render);

  fetch(source+'?v='+Date.now(),{cache:'no-store'})
    .then(res=>{if(!res.ok)throw Error('HTTP '+res.status);return res.text();})
    .then(raw=>{products=parseCSV(raw);if(!products.length)throw Error('CSV üres vagy hibás');render();})
    .catch(err=>{
      count.textContent='';
      output.innerHTML='<p class="notice">A terméklista most nem tölthető be. Az árakat a <a href="arlista.html">teljes árlistában</a> találja.</p>';
      console.error('Árlista CSV betöltési hiba:',err);
    });
})();
