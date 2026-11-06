/* Form-specific challenge behavior; all timers and state belong to the current enemy. */
G.BossForms = (() => {
  const TAU = Math.PI * 2;
  const DEFINITIONS = {
    555: { stage: 'darmanitan', name: 'Darmanitan', forms: ['', '0001'], labels: ['Standard', 'Zen'], phaseForm: true,
      hint: 'Under 50% HP triggers Zen Mode: channels power with 80% damage reduction; special creates telegraphed blast zones.' },
    746: { stage: 'wishiwashi', name: 'Wishiwashi', forms: ['', '0001'], labels: ['Solo', 'School'], phaseForm: true,
      hint: 'Deplete phase 1 HP to summon the School form in phase 2; giant bubbles and explosive shockwave clusters fill the arena.' },
    800: { stage: 'necrozma', name: 'Necrozma', forms: ['', '0003'], labels: ['Prism', 'Ultra'], phaseForm: true,
      hint: 'Phase 1 fires bouncing Prisms off walls; phase 2 transforms to Ultra form, combining Prisms with sweeping beams.' },
    386: { stage: 'deoxys', name: 'Deoxys', forms: ['0003', '0002', '0001', ''], labels: ['Speed', 'Defense', 'Attack', 'Normal'], interval: 10,
      hint: 'Cycles Speed → Defense → Attack → Normal every 10s while preserving current phase; bullet volleys have safe lanes.' },
    479: { stage: 'rotom', name: 'Rotom', forms: ['0001', '0002', '0003', '0005'], labels: ['Heat', 'Wash', 'Frost', 'Mow'], interval: 10,
      hint: 'Swaps appliance every 10s: fire fans, whirlpool pull, freezing ice patches, and zigzag sawblades.' },
    648: { stage: 'meloetta', name: 'Meloetta', forms: ['', '0001'], labels: ['Aria', 'Pirouette'], interval: 10,
      hint: 'Relic Song changes form every 10s: Aria fires bouncing musical notes; Pirouette dashes and slashes across the arena.' }
  };
  const api = () => G.StoryEncounters.attacks;
  const arena = () => G.Rift.arena;
  const controlled = e => !!DEFINITIONS[e.dex] && G.StoryEncounters.controls(e);

  function configure(e) {
    if (!DEFINITIONS[e.dex]) return;
    const d = DEFINITIONS[e.dex], s = e.encounter;
    s.formIndex = 0; s.formTime = 0; s.formBaseScale = e.scale;
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
    e.startStoryTransformation(d.forms[index]);
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
    if (d.phaseForm && !s.formIndex && e.challengePhase2) change(e, 1);
    if (d.threshold && !s.formIndex && (e.hp / e.maxHp <= d.threshold || e.challengePhase2)) change(e, 1);
    if (d.interval && s.formTime >= d.interval) {
      const next = e.dex === 479 ? (s.formIndex + 1 + Math.floor(Math.random() * 3)) % 4 : (s.formIndex + 1) % d.forms.length;
      change(e, next);
    }
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
    return e.dex===555 && e.encounter?.formIndex===1 ? 0.2 : 1;
  }
  function onBarBreak(e) {
    if (!controlled(e)) return false;
    const d = DEFINITIONS[e.dex];
    change(e, d.threshold || d.phaseForm ? 1 : e.encounter.formIndex);
    return true;
  }
  function blocksProjectile(e,p) {
    return controlled(e) && e.dex===386 && e.encounter?.formIndex===1 && !p.pierce;
  }
  function skill(dex) {
    const d=DEFINITIONS[dex]; if(!d) return null;
    const e=G.EnemyMgr.all().find(e=>e.dex===dex && !e.dead), mode=e?.encounter?.formIndex||0;
    const names={555:['Inferno Barrage','Zen Artillery'],746:['Bubble Volley','Deluge Tsunami'],800:['Prism Storm','Ultra Light Burst'],386:['Speed Grid','Reflective Barrier','Extinction Meteor','Cosmic Double Helix'],479:['Firestorm Fan','Hydro Vortex','Blizzard Freeze','Leaf Sawblade'],648:['Echoing Cadence','Pirouette Cross-Slash']};
    return [names[dex][mode],d.hint];
  }
  for(const [dex,d] of Object.entries(DEFINITIONS)) G.StoryEncounters.STAGES[d.stage]={waves:[[Number(dex)]],description:d.hint};
  return {configure,update,move,special,damageTaken,onBarBreak,blocksProjectile,skill};
})();
