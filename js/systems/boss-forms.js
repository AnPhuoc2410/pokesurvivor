/* Form-specific challenge behavior; all timers and state belong to the current enemy. */
G.BossForms = (() => {
  const TAU = Math.PI * 2;
  const DEFINITIONS = {
    718: { stage: 'zygarde', name: 'Zygarde', forms: ['0001', '', '0002'], labels: ['10%', '50%', 'Hoàn chỉnh'],
      hint: 'Dưới 50% HP hóa rắn và rải độc; dưới 10% hóa Hoàn chỉnh, hồi 50% HP một lần và quét laser xuyên sân.' },
    720: { stage: 'hoopa', name: 'Hoopa', forms: ['', '0001'], labels: ['Confined', 'Unbound'], phaseForm: true,
      hint: 'Confined ném vòng phản đạn; chiêu đặc biệt gọi sáu cổng quanh sân, lần lượt bắn tia vào vị trí đã khóa. Hết thanh máu đầu hóa Unbound và gọi cầu khổng lồ rơi xuống.' },
    1024: { stage: 'terapagos', name: 'Terapagos', forms: ['', '0001', '0002'], labels: ['Normal', 'Terastal', 'Stellar'],
      hint: 'Dưới 60% thanh máu đầu hóa Terastal; hết thanh đầu hóa Stellar. Nhặt Nước phá khiên Lửa, Cỏ phá Nước, Lửa phá Cỏ rồi đánh boss để mở 8 giây tấn công.' },
    555: { stage: 'darmanitan', name: 'Darmanitan', forms: ['', '0001'], labels: ['Thường', 'Zen'], phaseForm: true,
      hint: 'Dưới 50% HP chuyển Zen: đứng tụ lực, giảm 80% sát thương; special chỉ tạo nhiều điểm nổ có báo trước.' },
    746: { stage: 'wishiwashi', name: 'Wishiwashi', forms: ['', '0001'], labels: ['Solo', 'School'], phaseForm: true,
      hint: 'Hết thanh máu phase 1 mới gọi đàn cá ở phase 2; bong bóng lớn và cụm sóng nổ khắp arena.' },
    800: { stage: 'necrozma', name: 'Necrozma', forms: ['', '0003'], labels: ['Lăng kính', 'Ultra'], phaseForm: true,
      hint: 'Phase 1 bắn Prism nảy khỏi rìa rồi quay về; phase 2 hóa Ultra, vừa bắn Prism vừa quét tia.' },
    386: { stage: 'deoxys', name: 'Deoxys', forms: ['0003', '0002', '0001', ''], labels: ['Speed', 'Defense', 'Attack', 'Normal'], interval: 10,
      hint: 'Mỗi 10 giây đổi Speed → Defense → Attack → Normal, giữ phase hiện tại; mưa đạn có khe né.' },
    479: { stage: 'rotom', name: 'Rotom', forms: ['0001', '0002', '0003', '0005'], labels: ['Heat', 'Wash', 'Frost', 'Mow'], interval: 10,
      hint: 'Mỗi 10 giây đổi thiết bị: quạt lửa, xoáy nước hút, băng làm chậm, lưỡi cưa zíc zắc.' },
    648: { stage: 'meloetta', name: 'Meloetta', forms: ['', '0001'], labels: ['Aria', 'Pirouette'], interval: 10,
      hint: 'Relic Song đổi dạng mỗi 10 giây: Aria bắn nốt nhạc nảy; Pirouette lướt chém khắp sân.' }
  };
  const api = () => G.StoryEncounters.attacks;
  const arena = () => G.Rift.arena;
  const controlled = e => !!DEFINITIONS[e.dex] && G.StoryEncounters.controls(e);
  const TERA_SHELLS = [
    {type:'fire',name:'Lửa',counter:'water'},
    {type:'water',name:'Nước',counter:'grass'},
    {type:'grass',name:'Cỏ',counter:'fire'}
  ];
  const elementName = type => TERA_SHELLS.find(shell => shell.type === type)?.name || type;

  function configure(e) {
    if (!DEFINITIONS[e.dex]) return;
    const d = DEFINITIONS[e.dex], s = e.encounter;
    s.formIndex = 0; s.formTime = 0; s.formBaseScale = e.scale;
    // Zygarde uses HP thresholds and a single heal instead of a second full HP bar.
    if (e.dex === 718) e.challengeBoss = false;
    e.name = d.name + ' · ' + d.labels[0];
    e.setStoryForm(d.forms[0]);
    for (const form of d.forms) for (const anim of G.Sprites.ANIMS || []) G.Sprites.sheet(e.dex, anim, false, '', form);
  }
  function change(e, index) {
    const d = DEFINITIONS[e.dex], s = e.encounter;
    s.formIndex = index; s.formTime = 0; s.dash = null; s.cooldown = 1;
    e.name = d.name + ' · ' + d.labels[index];
    // School art is already much larger than Solo; avoid multiplying its native size again.
    if (e.dex === 746) e.scale = 1.5;
    if (e.dex === 718 || e.dex === 720 || e.dex === 1024) {
      e.scale = Math.min(s.formBaseScale,160 / G.Sprites.bodyHeight(e.dex,1,d.forms[index]));
      G.Projectiles.clearHostile();
      G.Hazards.clear();
    }
    e.startStoryTransformation(d.forms[index]);
    if (e.dex === 1024) resetTeraShell(e, index === 1 ? 0 : (s.shellIndex + 1) % TERA_SHELLS.length);
    G.Spawner.say(e.name, 2, true);
    if (e.dex === 800) { api().applyStatus(G.Game.player, 'dark'); G.Game.flash('#7666aa', 0.4); }
    if (e.dex === 648) {
      G.FX.ring(e.x,e.y,e.r,api().radius(),'#f7b8ff',1.5,6);
      G.Audio.sfx('shot', {type:'psychic'});
    }
  }
  function update(e, dt) {
    if (!controlled(e) || e.transformT > 0) return;
    const d = DEFINITIONS[e.dex], s = e.encounter;
    s.formTime += dt;
    if (onDamage(e)) return;
    if (d.phaseForm && !s.formIndex && e.challengePhase2) change(e, 1);
    if (d.threshold && !s.formIndex && (e.hp / e.maxHp <= d.threshold || e.challengePhase2)) change(e, 1);
    if (d.interval && s.formTime >= d.interval) {
      const next = e.dex === 479 ? (s.formIndex + 1 + Math.floor(Math.random() * 3)) % 4 : (s.formIndex + 1) % d.forms.length;
      change(e, next);
    }
  }
  function onDamage(e) {
    if (!controlled(e) || e.transformT > 0) return false;
    const mode = e.encounter.formIndex;
    if (e.dex === 1024) {
      if (mode === 0 && e.hp <= e.maxHp * 0.6) {
        e.hp = Math.max(e.hp,e.maxHp*0.6);
        change(e,1);
        return true;
      }
      return false;
    }
    if (e.dex !== 718) return false;
    if (mode === 0 && e.hp <= e.maxHp * 0.5) {
      // A lethal burst must not skip either transformation.
      e.hp = Math.max(e.hp, e.maxHp * 0.5);
      change(e, 1);
      return true;
    }
    if (mode === 1 && e.hp <= e.maxHp * 0.1) {
      e.hp = Math.min(e.maxHp, Math.max(0, e.hp) + e.maxHp * 0.5);
      change(e, 2);
      return true;
    }
    return false;
  }
  function radial(e, count, speed, options = {}, phase = 0) {
    for (let i = 0; i < count; i++) api().shot(e, phase + i * TAU / count, { speed, ...options });
  }
  function openRadial(e, count, speed, options, phase, safeAngle) {
    // Keep the same open sector across all three waves; avoid layering aimed shots into it.
    for (let i = 0; i < count; i++) {
      const angle = phase + i * TAU / count;
      const delta = Math.atan2(Math.sin(angle - safeAngle), Math.cos(angle - safeAngle));
      if (Math.abs(delta) >= 0.38) api().shot(e, angle, { speed, ...options });
    }
  }
  function lane(e, angle, offset, width, type, delay = 0.8) {
    const a = arena(), r = api().attackRadius(), dx = Math.cos(angle), dy = Math.sin(angle);
    api().beam(e,{x:a.x-dx*r-dy*offset,y:a.y-dy*r+dx*offset},{x:a.x+dx*r-dy*offset,y:a.y+dy*r+dx*offset},width,delay,type);
  }
  function explosions(e, wave, type, count, size) {
    const a=arena(), r=api().radius(), p=G.Game.player;
    // Distribute danger over the floor, including the player's current perimeter position.
    for(let i=0;i<count;i++) {
      const angle=i*2.39996+wave*0.7, distance=Math.sqrt((i+0.5)/count)*r*0.92;
      const point=i<3?api().pointNear(p,i*70):{x:a.x+Math.cos(angle)*distance,y:a.y+Math.sin(angle)*distance};
      G.Hazards.add({kind:'zone',...point,r:size,delay:0.65+(i%3)*0.13,dmg:e.dmg*0.8,type,color:G.U.TYPE_COLOR[type],enc:true});
    }
  }
  function move(e, dt, p, spd) {
    if (!controlled(e)) return null;
    if (e.transformT > 0) return [0,0,'Charge'];
    const s=e.encounter, mode=s.formIndex, a=Math.atan2(p.y-e.y,p.x-e.x), d=Math.hypot(p.x-e.x,p.y-e.y);
    if (e.dex === 1024) {
      if (s.cooldown <= 0) {
        s.cooldown = mode === 2 ? 2.4 : 2.8;
        terapagosAttack(e,p);
      }
      const speed = mode ? 0 : spd*0.45;
      return [Math.cos(a)*speed,Math.sin(a)*speed,mode?'Charge':'Walk'];
    }
    if (e.dex === 718) {
      if (s.cooldown <= 0) {
        s.cooldown = mode === 0 ? 2 : 2.8;
        if (mode === 0) {
          api().fan(e,p,5,0.8,{type:'dragon',speed:230,r:4});
          api().startDash(e,p,{across:true,wind:0.65,duration:0.35,type:'ground'});
        } else if (mode === 1) zygardePoison(e,0,false,p);
        else sweepingLaser(e,0,false);
      }
      return mode === 2 ? [0,0,'Charge'] : [Math.cos(a)*spd*0.65,Math.sin(a)*spd*0.65,'Walk'];
    }
    if (e.dex === 720) {
      if (s.cooldown <= 0) {
        s.cooldown = mode ? 3 : 2.6;
        if (mode) hoopaRain(e,0,false,p);
        else api().fan(e,p,3,1.5,{type:'psychic',speed:95,r:23,life:3.5,enc:{shape:'portal',portal:true}});
      }
      const speed = spd * 0.45 * (d > 240 ? 1 : d < 180 ? -1 : 0);
      return [Math.cos(a)*speed,Math.sin(a)*speed,'Walk'];
    }
    const dash = (e.dex===386 && mode===0) || (e.dex===648 && mode===1);
    if(s.cooldown<=0) {
      s.cooldown=1.8;
      if(dash) api().startDash(e,p,{across:true,trail:true,type:e.dex===648?'fighting':'psychic'});
      else if(e.dex===555) api().fan(e,p,mode?5:9,1.7,{type:mode?'psychic':'fire',speed:155,enc:{homing:mode?0.8:0}});
      else if(e.dex===746) api().fan(e,p,mode?9:5,2,{type:'water',r:mode?18:5,speed:mode?125:200,enc:{shape:'bubble'}});
      else if(e.dex===800) {
        if(mode) lane(e,a,0,32,'psychic');
        openRadial(e,mode?16:12,mode?145:150,{type:'psychic',r:5,life:3.2,
          enc:{bounce:true,maxBounces:1,returnToOwner:true,shape:'prism'}},s.age,s.safeAngle||a+0.65);
        s.cooldown=2.4;
      } else if(e.dex===386) {radial(e,mode===2?16:12,mode===2?165:145,{type:'psychic',r:5,life:2.6},s.age);s.cooldown=2.4;}
      else if(e.dex===479) rotom(e,mode,false);
      else if(e.dex===648) radial(e,16,160,{type:'psychic',life:7,enc:{bounce:true,shape:'note'}},s.age);
    }
    if((e.dex===555 && mode) || (e.dex===386 && mode===1)) return [0,0,'Charge'];
    const speed=spd*(e.dex===555?1.1:0.6)*(d>170?1:-0.4);
    return [Math.cos(a)*speed,Math.sin(a)*speed,'Walk'];
  }
  function resetTeraShell(e, index) {
    const s=e.encounter, stage=arena(), radius=api().radius()*0.62;
    s.shellIndex=index;s.shellActive=true;s.shellOpen=0;s.energyType=null;
    s.crystalTime=0;
    s.crystals=TERA_SHELLS.map((shell,i)=>({type:shell.type,
      x:stage.x+Math.cos(i*TAU/3-Math.PI/2)*radius,
      y:stage.y+Math.sin(i*TAU/3-Math.PI/2)*radius}));
  }
  function updateArena(e, dt) {
    if (!controlled(e) || e.dex !== 1024 || !e.encounter.formIndex || e.transformT > 0) return;
    const s=e.encounter,p=G.Game.player;
    s.crystalTime+=dt;
    if (!s.shellActive) {
      // Evade phases must not consume the player's earned damage window.
      if (!G.Rift.specialLock) s.shellOpen=Math.max(0,s.shellOpen-dt);
      if (s.shellOpen===0) resetTeraShell(e,(s.shellIndex+1)%TERA_SHELLS.length);
      return;
    }
    if (p.dead || G.Rift.cinematic || s.energyType===TERA_SHELLS[s.shellIndex].counter) return;
    const crystal=s.crystals.find(c=>!c.collected && Math.hypot(p.x-c.x,p.y-c.y)<p.r+18);
    if (!crystal) return;
    crystal.collected=true;s.energyType=crystal.type;
    const correct=crystal.type===TERA_SHELLS[s.shellIndex].counter;
    G.Spawner.say(correct?'Đã nạp '+elementName(crystal.type)+'! Đánh Terapagos để phá khiên.':
      'Cần năng lượng '+elementName(TERA_SHELLS[s.shellIndex].counter)+' để phá khiên này.',2.5,true);
    G.FX.ring(crystal.x,crystal.y,6,45,G.U.TYPE_COLOR[crystal.type],0.5,4);
  }
  function teraDamageTaken(e) {
    const s=e.encounter;
    if (!s.formIndex || !s.shellActive) return 1;
    if (G.Rift.specialLock || s.energyType!==TERA_SHELLS[s.shellIndex].counter) return 0;
    s.shellActive=false;s.shellOpen=8;s.energyType=null;s.crystals=[];
    e.applyStun(1.5);
    G.FX.ring(e.x,e.y,e.r,e.r*4,'#fff3b0',0.6,8);
    G.Spawner.say('Khiên vỡ! 8 giây để tấn công Terapagos.',2.5,true);
    return 1;
  }
  function terapagosAttack(e,p) {
    const s=e.encounter,attacks=api();
    if (!s.formIndex) {
      attacks.fan(e,p,7,1.8,{type:'normal',speed:150,r:6,enc:{shape:'prism'}});
      return;
    }
    const type=TERA_SHELLS[s.shellIndex].type;
    if (s.formIndex===2) {
      s.stellarTurn=(s.stellarTurn||0)+1;
      if (s.stellarTurn%2) teraStarfall(e,p,0,false);
      else {
        const angle=Math.atan2(p.y-e.y,p.x-e.x);
        lane(e,angle,0,28,'psychic',0.85);
        openRadial(e,16,145,{type:'dragon',r:5,life:2,enc:{shape:'prism'}},s.age,angle+0.65);
      }
    } else if (type==='fire') {
      attacks.fan(e,p,9,2.1,{type,speed:170,r:6,enc:{shape:'prism'}});
    } else if (type==='water') {
      attacks.fan(e,p,11,2.8,{type,speed:130,r:7,life:2.4,enc:{curve:0.25,shape:'bubble'}});
    } else {
      const angle=Math.atan2(p.y-e.y,p.x-e.x);
      for(let i=-1;i<=1;i++) lane(e,angle,i*api().radius()*0.38,24,type,0.8);
    }
  }
  function teraStarfall(e,p,wave,special) {
    const stage=arena(),radius=api().radius(),count=special?6:3;
    for(let i=0;i<count;i++) {
      const angle=i*TAU/count+wave*0.45;
      const point=i===0?{x:p.x,y:p.y}:{x:stage.x+Math.cos(angle)*radius*0.76,y:stage.y+Math.sin(angle)*radius*0.76};
      G.Hazards.add({kind:'zone',...point,r:44,delay:0.78+i*0.045,end:0.25,dmg:e.dmg*0.75,
        type:'psychic',color:['#6eeaff','#f6c5ff','#ffe583'][i%3],cat:e.cat,enc:true,vis:'teraCrystal'});
    }
  }
  function terapagosSpecial(e,wave,p) {
    const s=e.encounter,mode=s.formIndex,radius=api().radius();
    if (!mode) {
      openRadial(e,18,145,{type:'normal',r:6,life:1.2,enc:{shape:'prism'}},wave*0.2,s.safeAngle);
      return;
    }
    if (mode===2) {
      if (wave===0) teraStarfall(e,p,wave,true);
      else if (wave===1) {
        for(let i=-2;i<=2;i++) if(i!==0) lane(e,Math.PI/4,i*radius*0.34,28,'psychic',0.8);
      } else {
        openRadial(e,30,180,{type:'dragon',r:5,life:1.2,enc:{shape:'prism'}},wave*0.18,s.safeAngle);
        G.Hazards.add({kind:'zone',x:p.x,y:p.y,r:42,delay:0.85,end:0.25,dmg:e.dmg*0.8,
          type:'psychic',color:'#f9e8ff',cat:e.cat,enc:true,vis:'teraCrystal'});
      }
      return;
    }
    const type=TERA_SHELLS[s.shellIndex].type;
    if (type==='fire') {
      for(let i=-2;i<=2;i++) if(i!==0) lane(e,wave*Math.PI/6,i*radius*0.34,28,type,0.8);
    } else if (type==='water') {
      openRadial(e,24,155,{type,r:7,life:1.2,enc:{shape:'bubble'}},wave*0.2,s.safeAngle);
    } else {
      for(let i=0;i<6;i++) {
        const angle=i*TAU/6+wave*0.3,stage=arena();
        G.Hazards.add({kind:'zone',x:stage.x+Math.cos(angle)*radius*0.82,y:stage.y+Math.sin(angle)*radius*0.82,
          r:45,delay:0.75+(i%2)*0.15,end:0.25,dmg:e.dmg*0.7,type,color:'#9cf0a1',cat:e.cat,enc:true,vis:'teraCrystal'});
      }
    }
  }
  function drawGround(ctx,e) {
    if (!controlled(e) || e.dex!==1024 || !e.encounter.formIndex) return;
    const s=e.encounter,shell=TERA_SHELLS[s.shellIndex];
    ctx.save();
    if (s.shellActive) {
      ctx.strokeStyle=G.U.TYPE_COLOR[shell.type];ctx.fillStyle=ctx.strokeStyle;
      ctx.globalAlpha=0.65;ctx.lineWidth=4;ctx.beginPath();
      for(let i=0;i<=6;i++) {
        const angle=i*TAU/6, x=e.x+Math.cos(angle)*(e.r+24),y=e.y+Math.sin(angle)*(e.r+24)*0.7;
        i?ctx.lineTo(x,y):ctx.moveTo(x,y);
      }
      ctx.stroke();
    }
    for(const c of s.crystals||[]) if(!c.collected) {
      const color=G.U.TYPE_COLOR[c.type],y=c.y-10-Math.sin(s.crystalTime*3)*4;
      ctx.globalAlpha=0.85;ctx.fillStyle=color;ctx.strokeStyle='#ffffff';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(c.x,y-13);ctx.lineTo(c.x+10,y);ctx.lineTo(c.x,y+13);ctx.lineTo(c.x-10,y);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.font='700 12px Pixelify, sans-serif';ctx.textAlign='center';ctx.strokeStyle='#182337';ctx.lineWidth=3;
      const label=elementName(c.type)+(c.type===shell.counter?' ✓':'');
      ctx.strokeText(label,c.x,c.y+27);ctx.fillText(label,c.x,c.y+27);
    }
    ctx.restore();
  }
  function statusLabel(e) {
    if (!controlled(e) || e.dex!==1024 || !e.encounter.formIndex) return '';
    const s=e.encounter,shell=TERA_SHELLS[s.shellIndex];
    if(!s.shellActive) return 'Khiên vỡ · '+Math.ceil(s.shellOpen)+' giây tấn công';
    const energy=elementName(shell.counter);
    if(s.energyType===shell.counter) return 'Đã nạp '+energy+' · '+(G.Rift.specialLock?'Né xong rồi đánh để phá khiên':'Đánh Terapagos để phá khiên');
    return 'Khiên '+shell.name+' · Nhặt tinh thể '+energy+' rồi đánh boss';
  }
  function zygardePoison(e, wave, special, p = G.Game.player) {
    const a = api(), count = special ? 5 : 3;
    for (let i = 0; i < count; i++) {
      const point = i === 0 ? {x:p.x,y:p.y} : a.bound(a.pointNear(p,110+i*45),70);
      a.pool(e,point,'poison',null,{radius:55,delay:0.8,duration:special?2:3,
        damage:e.dmg*0.28,special});
    }
    a.fan(e,p,special?11:5,2,{type:'poison',speed:135,r:6});
  }
  function sweepingLaser(e, wave, special) {
    const a = arena(), r = api().attackRadius();
    const heading = Math.atan2(a.y-e.y,a.x-e.x) + wave * 0.45;
    // Sequential warning strips sweep across the entire arena, leaving time to cross behind them.
    const strips = special ? 5 : 3, step = r * 2 / strips;
    for (let i = 0; i < strips; i++) lane(e,heading,-r+(i+0.5)*step,step*0.58,'dragon',0.6+i*0.11);
  }
  function hoopaPortalBeams(e, wave, p) {
    const stage = arena(), attacks = api(), radius = attacks.attackRadius();
    const s = e.encounter;
    if (wave === 0) {
      s.portalAngle = Math.atan2(p.y-stage.y,p.x-stage.x) + Math.PI / 6;
      s.portals = Array.from({length:6}, (_, i) => {
        const angle = s.portalAngle + i * TAU / 6;
        const point = {x:stage.x+Math.cos(angle)*radius*0.94,y:stage.y+Math.sin(angle)*radius*0.94};
        attacks.pool(e,point,'psychic',null,{shape:'hoopaGate',radius:28,delay:0,duration:4,damage:0,special:true});
        return point;
      });
    }
    if (!s.portals) return;
    // Each pair locks the current position; the warning never tracks the player afterward.
    for (let side = 0; side < 2; side++) {
      const origin = s.portals[wave % 3 + side * 3];
      G.Hazards.add({kind:'beam',...origin,angle:Math.atan2(p.y-origin.y,p.x-origin.x),len:radius*2.2,w:30,
        delay:0.68+side*0.3,end:0.25,dmg:e.dmg*0.8,type:'psychic',color:'#df9bff',cat:e.cat,enc:true,vis:'hoopaBeam'});
    }
  }
  function hoopaRain(e, wave, special, p = G.Game.player) {
    const a = arena(), r = api().attackRadius(), count = special ? 7 : 3;
    for (let i = 0; i < count; i++) {
      const angle = i * 2.39996 + wave * 0.8;
      const distance = r * Math.sqrt((i+0.5)/count) * 0.8;
      const point = i === 0 ? {x:p.x,y:p.y} : {x:a.x+Math.cos(angle)*distance,y:a.y+Math.sin(angle)*distance};
      G.Hazards.add({kind:'zone',...point,r:special?56:46,delay:0.85+(i%3)*0.08,end:0.25,
        dmg:e.dmg*(special?0.95:0.75),type:'dark',color:'#cc83ff',cat:e.cat,enc:true,vis:'hoopaOrb'});
    }
  }
  function intercept(p) {
    if (!p.friendly || p.orb || p.ghost) return false;
    if (!G.EnemyMgr.all().some(e => controlled(e) && e.dex === 720 && !e.dead && e.encounter?.formIndex === 0)) return false;
    const ring = G.Projectiles.all().find(shot => !shot.friendly && shot.enc?.portal && shot.t < shot.life &&
      segmentDistance(p.px ?? p.x,p.py ?? p.y,p.x,p.y,shot.x,shot.y) <= shot.r+p.r);
    if (!ring) return false;
    const owner = G.EnemyMgr.get(ring.enc.owner);
    if (!owner || owner.dead) return false;
    // Reflected shots use boss damage so strong player builds cannot one-shot their owner.
    api().shot(owner,Math.atan2(-p.vy,-p.vx),{x:p.x,y:p.y,type:'psychic',speed:Math.min(220,Math.max(140,Math.hypot(p.vx,p.vy))),
      dmg:owner.dmg*0.45,r:5,life:2,enc:{shape:'prism',reflected:true}});
    return true;
  }
  function segmentDistance(ax,ay,bx,by,x,y) {
    const dx=bx-ax,dy=by-ay,length=dx*dx+dy*dy;
    const t=length?Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/length)):0;
    return Math.hypot(x-ax-dx*t,y-ay-dy*t);
  }
  function rotom(e, mode, special, wave=0) {
    const p=G.Game.player, a=api(), count=special?27:11;
    if(mode===0) {
      a.fan(e,p,count,3.5,{type:'fire',speed:205,r:6});
      if(special) explosions(e,wave,'fire',9,42);
    } else if(mode===1) {
      const points=special?[p,a.pointNear(p,180),a.pointNear(p,300)]:[p];
      for(const point of points) a.pool(e,point,'water','slow',{shape:'vortex',pull:80,radius:special?160:90,delay:0.65,duration:2.3,special,damage:e.dmg*0.22});
      radial(e,special?28:12,165,{type:'water',enc:{curve:0.4}},wave);
    } else if(mode===2) {
      radial(e,special?36:12,175,{type:'ice',r:6,enc:{effect:'slow',shape:'shard'}},wave*0.3);
      if(special) for(let i=0;i<4;i++) a.pool(e,a.pointNear(p,i*95),'ice','ice',{radius:55,delay:0.7,duration:2,special:true});
    } else {
      const r=a.attackRadius(), stage=arena(), total=special?15:7;
      for(let i=0;i<total;i++) if(i!==wave+5) {
        const offset=(i/(total-1)-0.5)*r*1.8;
        a.shot(e,Math.PI/2,{x:stage.x+offset,y:stage.y-Math.sqrt(r*r-offset*offset)+12,type:'grass',speed:190,r:10,enc:{zigzag:true,shape:'saw'}});
      }
    }
  }
  function special(e, wave) {
    if(!controlled(e)) return false;
    const s=e.encounter, mode=s.formIndex, a=api(), r=a.attackRadius(), p=G.Game.player;
    if (wave === 0 || s.safeAngle == null) {
      // Require a short sidestep into the opening instead of rewarding standing still.
      s.safeAngle = Math.atan2(p.y-e.y,p.x-e.x) + (Math.random() < 0.5 ? -0.65 : 0.65);
    }
    G.FX.ring(e.x,e.y,e.r,e.r*5,G.U.TYPE_COLOR[e.atkType]||'#eee',0.6,8);
    G.FX.burst(e.x,e.y-e.bodyH/2,G.U.TYPE_COLOR[e.atkType]||'#eee',30,200);
    switch(e.dex) {
      case 1024: terapagosSpecial(e,wave,p);break;
      case 718:
        if (mode === 0) {
          a.startDash(e,p,{across:true,special:true,wind:0.7,duration:0.35,type:'ground'});
          openRadial(e,18,210,{type:'dragon',r:4,life:2.6},wave*0.25,s.safeAngle);
        } else if (mode === 1) zygardePoison(e,wave,true,p);
        else sweepingLaser(e,wave,true);
        break;
      case 720:
        if (mode) hoopaRain(e,wave,true,p);
        else hoopaPortalBeams(e,wave,p);
        break;
      case 555:
        explosions(e,wave,mode?'psychic':'fire',12,mode?58:52);
        break;
      case 746:
        explosions(e,wave,'water',14,mode?70:48);
        radial(e,mode?28:20,125,{type:'water',r:mode?16:9,enc:{shape:'bubble'}},wave*0.2);break;
      case 800:
        if(mode) {
          const angle=wave*Math.PI/3+0.2;
          for(let i=-2;i<=2;i++) if(i!==0) lane(e,angle,i*r*0.34,24,'psychic',1+Math.abs(i)*0.04);
          openRadial(e,26,155,{type:'psychic',r:5,life:3.2,enc:{bounce:true,maxBounces:1,returnToOwner:true,shape:'prism'}},wave*0.2,s.safeAngle);
        } else openRadial(e,26,155,{type:'psychic',r:5,life:3.2,enc:{bounce:true,maxBounces:1,returnToOwner:true,shape:'prism'}},wave*0.2,s.safeAngle);
        break;
      case 386:
        if(mode===0) {for(let i=-2;i<=2;i++) lane(e,wave*Math.PI/3,i*r*0.36,24,'psychic');}
        else if(mode===1) {radial(e,20,130,{type:'psychic',r:5,life:2.6,enc:{curve:0.16}},wave*0.3);explosions(e,wave,'psychic',5,32);}
        else if(mode===2) openRadial(e,24,175,{type:'psychic',r:4,life:2.6},wave*0.16,s.safeAngle);
        else radial(e,22,150,{type:'psychic',r:5,life:2.6,enc:{curve:wave%2?-.2:.2}},wave*0.25);
        break;
      case 479: rotom(e,mode,true,wave);break;
      case 648:
        if(mode) a.startDash(e,p,{across:true,special:true,duration:0.65,type:'fighting'});
        else radial(e,30,180,{type:'psychic',life:7,enc:{bounce:true,shape:'note'}},wave*0.3);
        break;
    }
    return true;
  }
  function damageTaken(e) {
    if(!controlled(e)) return 1;
    if(e.dex===1024) return teraDamageTaken(e);
    return e.dex===555 && e.encounter?.formIndex===1 ? 0.2 : 1;
  }
  function onBarBreak(e) {
    if (!controlled(e)) return false;
    const d = DEFINITIONS[e.dex];
    if (e.dex===1024) {change(e,2);return true;}
    change(e, d.threshold || d.phaseForm ? 1 : e.encounter.formIndex);
    return true;
  }
  function blocksProjectile(e,p) {
    return controlled(e) && e.dex===386 && e.encounter?.formIndex===1 && !p.pierce;
  }
  function skill(dex) {
    const d=DEFINITIONS[dex]; if(!d) return null;
    const e=G.EnemyMgr.all().find(e=>e.dex===dex && !e.dead), mode=e?.encounter?.formIndex||0;
    const names={1024:['Vòng tinh thể','Lăng kính nguyên tố','Tera Starstorm'],718:['Nanh đất thần tốc','Địa mạch độc','Quang phá Hoàn chỉnh'],720:['Lục môn truy kích','Mưa hủy diệt Unbound'],555:['Hỏa ngục liên hoàn','Pháo kích Zen'],746:['Thủy cầu liên hoàn','Đại hồng thủy'],800:['Bão lăng kính','Quang phá Ultra'],
      386:['Mạng lưới tốc độ','Vòng chắn phản kích','Mưa sao hủy diệt','Xoắn kép vũ trụ'],479:['Bão lửa','Lốc xoáy hút','Bão băng','Cưa cắt lá'],648:['Khúc ca hỗn loạn','Vũ điệu xuyên sân']};
    return [names[dex][mode],d.hint];
  }
  for(const [dex,d] of Object.entries(DEFINITIONS)) G.StoryEncounters.STAGES[d.stage]={waves:[[Number(dex)]],description:d.hint};
  return {configure,update,updateArena,drawGround,statusLabel,move,special,damageTaken,onDamage,onBarBreak,blocksProjectile,intercept,skill};
})();
