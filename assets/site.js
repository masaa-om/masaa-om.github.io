(() => {
  'use strict';
  const root = document.documentElement;
  const body = document.body;
  const main = document.querySelector('main');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const $ = (selector) => document.querySelector(selector);
  const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
  const storage = {
    get(key, session = false) { try { return (session ? sessionStorage : localStorage).getItem(key); } catch { return null; } },
    set(key, value, session = false) { try { (session ? sessionStorage : localStorage).setItem(key, value); } catch { /* Private browsing remains usable. */ } },
    remove(key, session = false) { try { (session ? sessionStorage : localStorage).removeItem(key); } catch { /* Nothing to restore. */ } }
  };
  let language = root.lang === 'en' ? 'en' : 'ar';
  let pathLength = 0;
  let progress = 0;
  let targetProgress = 0;
  let travelFrame = 0;
  let introActive = false;
  let introGeneration = 0;
  let introFrame = 0;
  let morphAnimation = null;
  let previousFocus = null;
  const line = $('#journey-light');
  const bloom = $('#journey-bloom');
  const track = $('#journey-track');
  const traveller = $('#traveller');
  const canvas = $('#journey-canvas');
  const intro = $('#intro');
  const logo = $('#hero-logo');

  function setLanguage(value) {
    language = value;
    root.lang = value;
    root.dir = value === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-ar][data-en]').forEach(el => { el.textContent = el.dataset[value]; });
    document.querySelectorAll('[data-ph-ar][data-ph-en]').forEach(el => { el.placeholder = el.dataset[`ph${value[0].toUpperCase()+value.slice(1)}`]; });
    $('#language').textContent = value === 'ar' ? 'EN' : 'العربية';
    $('#language').setAttribute('aria-label', value === 'ar' ? 'Switch to English' : 'التغيير إلى العربية');
    $('#primary-nav').setAttribute('aria-label', value === 'ar' ? 'التنقل الرئيسي' : 'Main navigation');
    intro.setAttribute('aria-label', value === 'ar' ? 'مقدمة مَسعى' : 'MASA’A introduction');
    const titles = {
      home: ['مَسعى | نحو ما تسعى إليه', 'MASA’A | Towards what you aspire to'],
      about: ['عن مَسعى | الإنسان أولاً', 'About MASA’A | People first'],
      purpose: ['هدف مَسعى | من الإمكانية إلى الأثر', 'Our purpose | MASA’A'],
      service: ['خدمة مَسعى | رحلة تطور أكثر وضوحاً', 'Our service | MASA’A']
    };
    document.title = titles[body.dataset.page][value === 'ar' ? 0 : 1];
    setMenu(false);
    storage.set('masaa-language', value);
    requestAnimationFrame(buildPath);
  }

  function setMenu(open) {
    $('#primary-nav').classList.toggle('is-open', open);
    $('#menu-button').setAttribute('aria-expanded', String(open));
    $('#menu-button').setAttribute('aria-label', language === 'ar' ? (open ? 'إغلاق القائمة' : 'فتح القائمة') : (open ? 'Close menu' : 'Open menu'));
  }
  $('#language').addEventListener('click', () => setLanguage(language === 'ar' ? 'en' : 'ar'));
  $('#menu-button').addEventListener('click', () => setMenu($('#menu-button').getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('click', event => {
    if (!event.target.closest('.header-inner')) setMenu(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (introActive) finishIntro(true);
      else if ($('#menu-button').getAttribute('aria-expanded') === 'true') { setMenu(false); $('#menu-button').focus(); }
    }
    if (event.key === 'Tab' && introActive) { event.preventDefault(); intro.focus({preventScroll:true}); }
  });

  function curveThrough(points) {
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const before = points[Math.max(0, i - 1)];
      const a = points[i], b = points[i + 1];
      const after = points[Math.min(points.length - 1, i + 2)];
      d += ` C ${a.x + (b.x - before.x) / 6} ${a.y + (b.y - before.y) / 6}, ${b.x - (after.x - a.x) / 6} ${b.y - (after.y - a.y) / 6}, ${b.x} ${b.y}`;
    }
    return d;
  }

  function buildPath() {
    if (!logo || !logo.complete) return;
    const mainRect = main.getBoundingClientRect();
    const rect = logo.getBoundingClientRect();
    const width = main.clientWidth;
    const height = main.scrollHeight;
    const mobile = width < 761;
    const heroHeight = $('.hero').offsetHeight;
    const opening = $('#discover');
    const openingEnd = opening.offsetTop + opening.offsetHeight;
    const closing = $('.closing');
    // The final ى ends on the left, at 8% x / 74% y of the unchanged image.
    const x = rect.left - mainRect.left + rect.width * .081;
    const y = rect.top - mainRect.top + rect.height * .742;
    const margin = mobile ? 11 : width * .045;
    const points = [{x,y}, {x:margin,y:y+(heroHeight-y)*.7}, {x:width*.4,y:heroHeight+30},
      {x:width-margin,y:opening.offsetTop+opening.offsetHeight*.32},
      {x:width-margin,y:openingEnd-65}, {x:margin,y:openingEnd+70}];
    if (closing.offsetTop > openingEnd + 250) points.push({x:margin,y:closing.offsetTop-80});
    points.push({x:width*.7,y:closing.offsetTop+70}, {x:width-margin,y:closing.offsetTop+closing.offsetHeight*.52}, {x:width*.5,y:height-22});
    const d = curveThrough(points);
    canvas.setAttribute('viewBox', `0 0 ${width} ${height}`);
    [track, line, bloom].forEach(p => p.setAttribute('d', d));
    pathLength = track.getTotalLength();
    [line,bloom].forEach(p => { p.style.strokeDasharray = `${pathLength} ${pathLength}`; });
    const ratio = clamp((scrollY + innerHeight*.55 - y) / Math.max(1,height-y-innerHeight*.24),0,1);
    targetProgress = ratio;
    if (reduce.matches) progress = ratio;
    renderPath();
    updateScroll();
  }

  function renderPath() {
    if (!pathLength) return;
    const distance = pathLength * clamp(progress,0,1);
    line.style.strokeDashoffset = String(pathLength-distance);
    bloom.style.strokeDashoffset = String(pathLength-distance);
    const point = track.getPointAtLength(distance);
    traveller.setAttribute('transform', `translate(${point.x},${point.y})`);
    traveller.style.opacity = introActive ? '0' : '1';
  }

  function animateTravel() {
    progress += (targetProgress-progress) * .085;
    if (Math.abs(targetProgress-progress) < .00008) progress = targetProgress;
    renderPath();
    if (progress !== targetProgress) travelFrame=requestAnimationFrame(animateTravel);
    else travelFrame=0;
  }

  function updateScroll() {
    if (!pathLength || introActive) return;
    // Find the point at the reader's height rather than tying travel to path length.
    // The monotonic curve keeps the individual light visible while scrolling.
    const mainTop = main.getBoundingClientRect().top + scrollY;
    const targetY = scrollY-mainTop+innerHeight*.61;
    let lo=0, hi=pathLength;
    for(let i=0;i<17;i++) {
      const mid=(lo+hi)/2;
      if(track.getPointAtLength(mid).y < targetY) lo=mid; else hi=mid;
    }
    targetProgress=clamp((lo+hi)/2/pathLength,0,1);
    if (scrollY < 2 && body.dataset.page === 'home') targetProgress = 0;
    if (reduce.matches) { progress=targetProgress; renderPath(); }
    else if (!travelFrame) travelFrame=requestAnimationFrame(animateTravel);
  }
  addEventListener('scroll',updateScroll,{passive:true});
  let resizeTimer;
  addEventListener('resize',()=>{ clearTimeout(resizeTimer); resizeTimer=setTimeout(()=>{ if(introActive) finishIntro(true); buildPath(); },120); });
  logo?.addEventListener('load',buildPath);
  document.fonts.ready.then(buildPath);

  const observer = new IntersectionObserver(entries=>{
    entries.forEach(entry=>{ if(entry.isIntersecting){ entry.target.classList.add('in-view'); observer.unobserve(entry.target); } });
  },{threshold:.10});
  document.querySelectorAll('.reveal').forEach((el,i)=>{
    if(!reduce.matches) el.style.transitionDelay=`${(i%3)*65}ms`;
    observer.observe(el);
  });

  function setBackgroundInert(value) {
    ['.site-header','main','.site-footer'].forEach(selector=>{
      const el=$(selector);
      if(value) el.setAttribute('inert',''); else el.removeAttribute('inert');
    });
  }

  function cleanIntro(restoreFocus=false) {
    introGeneration++;
    introActive=false;
    cancelAnimationFrame(introFrame);
    if(morphAnimation) { morphAnimation.cancel(); morphAnimation=null; }
    intro.hidden=true;
    intro.classList.remove('is-lit','is-leaving');
    $('#intro-brand').style.removeProperty('transform');
    body.classList.remove('intro-playing');
    setBackgroundInert(false);
    if(restoreFocus && previousFocus?.isConnected) previousFocus.focus({preventScroll:true});
    else if(document.activeElement=== intro) {
      main.setAttribute('tabindex','-1'); main.focus({preventScroll:true});
    }
    buildPath();
  }

  function finishIntro(skip=false) {
    if(!introActive) return;
    if(skip || reduce.matches) { cleanIntro(true); return; }
    const generation=introGeneration;
    const src=$('#intro-brand').getBoundingClientRect();
    // intro-playing uses visibility, so the final mark keeps its real geometry.
    const dst=logo.getBoundingClientRect();
    intro.classList.add('is-leaving');
    $('#intro-line').animate([{opacity:1},{opacity:0}],{duration:950,fill:'forwards'});
    $('#intro-spark').animate([{opacity:1},{opacity:0}],{duration:550,fill:'forwards'});
    morphAnimation=$('#intro-brand').animate([
      {transform:'translate(0,0) scale(1)'},
      {transform:`translate(${dst.left+dst.width/2-src.left-src.width/2}px,${dst.top+dst.height/2-src.top-src.height/2}px) scale(${dst.width/src.width})`}
    ],{duration:1300,easing:'cubic-bezier(.65,0,.18,1)',fill:'forwards'});
    function carryPath() {
      if(generation!==introGeneration || !introActive) return;
      const moving=$('#intro-brand').getBoundingClientRect();
      const x=moving.left+moving.width*.081, y=moving.top+moving.height*.742;
      const w=innerWidth,h=innerHeight;
      const connected=$('#intro-line');
      connected.setAttribute('d',`M ${x} ${y} C ${x-w*.1} ${y+h*.09}, ${w*.04} ${h*.85}, ${w*.42} ${h*.85} S ${w*1.05} ${h*.98}, ${w*.80} ${h*1.18}`);
      const length=connected.getTotalLength();
      connected.style.strokeDasharray=`${length} ${length}`;
      connected.style.strokeDashoffset='0';
      introFrame=requestAnimationFrame(carryPath);
    }
    introFrame=requestAnimationFrame(carryPath);
    morphAnimation.onfinish=()=>{if(generation===introGeneration) cleanIntro();};
  }

  function startIntro() {
    if(reduce.matches) { cleanIntro(); return; }
    if(introActive) cleanIntro();
    setMenu(false);
    scrollTo({top:0,behavior:'instant'});
    previousFocus=document.activeElement;
    const generation=++introGeneration;
    introActive=true;
    body.classList.add('intro-playing');
    intro.hidden=false;
    intro.classList.remove('is-lit','is-leaving');
    setBackgroundInert(true);
    intro.focus({preventScroll:true});
    [$('#intro-line'),$('#intro-spark')].forEach(el=>el.getAnimations().forEach(a=>a.cancel()));
    const imageRect=$('#intro-brand').getBoundingClientRect();
    const x=imageRect.left+imageRect.width*.081;
    const y=imageRect.top+imageRect.height*.742;
    const w=innerWidth, h=innerHeight;
    $('#intro-svg').setAttribute('viewBox',`0 0 ${w} ${h}`);
    const introPath=$('#intro-line');
    const d=`M ${x} ${y} C ${x-w*.1} ${y+h*.09}, ${w*.04} ${h*.85}, ${w*.42} ${h*.85} S ${w*1.05} ${h*.98}, ${w*.80} ${h*1.18}`;
    introPath.setAttribute('d',d);
    const len=introPath.getTotalLength();
    introPath.style.strokeDasharray=`${len} ${len}`;
    introPath.style.strokeDashoffset=String(len);
    $('#intro-spark').setAttribute('opacity','0');
    let started;
    function frame(now) {
      if(generation!==introGeneration || !introActive) return;
      if(!started) started=now;
      const elapsed=now-started;
      if(elapsed>110) intro.classList.add('is-lit');
      if(elapsed>1250) {
        const t=clamp((elapsed-1250)/1900,0,1);
        const eased=t<.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2;
        const drawn=len*eased;
        introPath.style.strokeDashoffset=String(len-drawn);
        const point=introPath.getPointAtLength(drawn);
        $('#intro-spark').setAttribute('cx',String(point.x));
        $('#intro-spark').setAttribute('cy',String(point.y));
        $('#intro-spark').setAttribute('opacity','1');
      }
      if(elapsed>3150) { finishIntro(); return; }
      introFrame=requestAnimationFrame(frame);
    }
    introFrame=requestAnimationFrame(frame);
  }

  const conversationForm = $('#conversation-form');
  if (conversationForm) {
    const conversationStatus = $('#conversation-status');
    const submitButton = conversationForm.querySelector('.conversation-submit');

    conversationForm.addEventListener('submit', async event => {
      event.preventDefault();

      if (!conversationForm.checkValidity()) {
        conversationForm.reportValidity();
        return;
      }

      const name = $('#conversation-name')?.value.trim() || '';
      const email = $('#conversation-email')?.value.trim() || '';
      const organization = $('#conversation-org')?.value.trim() || '';
      const message = $('#conversation-message')?.value.trim() || '';
      const honey = conversationForm.querySelector('[name="_honey"]')?.value || '';

      // Silently ignore bot-filled honeypot submissions.
      if (honey) return;

      const originalLabel = submitButton?.querySelector('span')?.textContent || '';
      if (submitButton) {
        submitButton.disabled = true;
        const label = submitButton.querySelector('span');
        if (label) label.textContent = language === 'ar' ? 'جارٍ الإرسال…' : 'Sending…';
      }

      if (conversationStatus) {
        conversationStatus.className = 'conversation-status is-loading';
        conversationStatus.textContent = language === 'ar'
          ? 'جارٍ إرسال رسالتك…'
          : 'Sending your message…';
      }

      try {
        const response = await fetch('https://formsubmit.co/ajax/masaa.info.om@gmail.com', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            name,
            email,
            organization: organization || '-',
            message,
            _subject: 'New MASA’A conversation',
            _template: 'table',
            _url: location.href
          })
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok || result.success === false) {
          throw new Error(result.message || 'Unable to submit form');
        }

        conversationForm.reset();

        if (conversationStatus) {
          conversationStatus.className = 'conversation-status is-success';
          conversationStatus.textContent = language === 'ar'
            ? 'شكرًا لك. تم إرسال رسالتك إلى مَسعى.'
            : 'Thank you. Your message has been sent to MASA’A.';
        }
      } catch (error) {
        if (conversationStatus) {
          conversationStatus.className = 'conversation-status is-error';
          conversationStatus.textContent = language === 'ar'
            ? 'تعذّر إرسال الرسالة الآن. حاول مرة أخرى بعد قليل.'
            : 'Your message could not be sent right now. Please try again shortly.';
        }
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          const label = submitButton.querySelector('span');
          if (label) label.textContent = language === 'ar' ? 'أرسل اهتمامك' : 'Send your interest';
        }
      }
    });
  }

const conversationToggle = $('#conversation-toggle');
  const conversationPanel = $('#conversation-panel');
  if (conversationToggle && conversationPanel) {
    conversationToggle.addEventListener('click', () => {
      const isOpen = !conversationPanel.hasAttribute('hidden');
      if (isOpen) {
        conversationPanel.setAttribute('hidden', '');
        conversationPanel.classList.remove('is-open');
        conversationToggle.setAttribute('aria-expanded', 'false');
        return;
      }
      conversationPanel.removeAttribute('hidden');
      conversationPanel.classList.add('is-open');
      conversationToggle.setAttribute('aria-expanded', 'true');
      requestAnimationFrame(() => {
        conversationPanel.scrollIntoView({
          behavior: reduce.matches ? 'auto' : 'smooth',
          block: 'start'
        });
        const firstField = conversationPanel.querySelector('input, textarea');
        if (firstField) setTimeout(() => firstField.focus({preventScroll:true}), reduce.matches ? 0 : 450);
      });
    });
  }

  const replayButton = $('#replay');
  if (replayButton) {
    replayButton.addEventListener('click',()=>{
      if(body.dataset.page==='home') startIntro();
      else {
        storage.set('masaa-replay','yes',true);
        const homeLink = document.querySelector('.brand');
        location.assign(homeLink ? homeLink.href : location.href);
      }
    });
  }
  reduce.addEventListener('change',()=>{ if(reduce.matches && introActive) cleanIntro(); buildPath(); });

  let navigating=false;
  document.addEventListener('click',event=>{
    const anchor=event.target.closest('a[href]');
    if(!anchor || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.button!==0 || anchor.target || anchor.hasAttribute('download')) return;
    const url=new URL(anchor.href,location.href);
    const localFile = location.protocol === 'file:' && url.protocol === 'file:';
    if(!localFile && url.origin!==location.origin) return;
    if(url.pathname===location.pathname && url.hash) {
      setMenu(false);
      const target=document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if(target) {
        event.preventDefault();
        target.scrollIntoView({behavior:reduce.matches?'instant':'smooth',block:'start'});
        try { history.replaceState(null,'',url.hash); } catch(e) {}
        target.setAttribute('tabindex','-1');target.focus({preventScroll:true});
      }
      return;
    }
    if(url.pathname===location.pathname) return;
    if(!localFile && !['/','/about/','/purpose/','/service/'].includes(url.pathname)) return;
    event.preventDefault();
    if(navigating) return;
    navigating=true;
    setMenu(false);
    storage.set('masaa-internal',String(Date.now()),true);
    if(reduce.matches) { location.assign(url.href); return; }
    body.classList.add('route-leaving');
    targetProgress=Math.min(1,progress+.08);
    if(!travelFrame)travelFrame=requestAnimationFrame(animateTravel);
    setTimeout(()=>location.assign(url.href),340);
  });
  addEventListener('pageshow',event=>{
    if(event.persisted){navigating=false;body.classList.remove('route-leaving');if(introActive)cleanIntro();buildPath();}
  });
  addEventListener('pagehide',()=>{cancelAnimationFrame(travelFrame);cancelAnimationFrame(introFrame);travelFrame=0;});

  setLanguage(language);
  const internalTime=Number(storage.get('masaa-internal',true)||0);
  storage.remove('masaa-internal',true);
  const replay=storage.get('masaa-replay',true)==='yes';
  storage.remove('masaa-replay',true);
  const internal=Date.now()-internalTime<15000;
  function begin() {
    buildPath();
    if(body.dataset.page==='home' && (!internal || replay) && !location.hash) startIntro();
    else body.classList.add('route-enter');
  }
  if(logo.complete && logo.naturalWidth) begin();
  else {logo.addEventListener('load',begin,{once:true});logo.addEventListener('error',()=>{cleanIntro();body.classList.add('route-enter');},{once:true});}
})();
