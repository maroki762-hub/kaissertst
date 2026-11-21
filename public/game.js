(() => {
"use strict";
const canvas=document.getElementById("game"),ctx=canvas.getContext("2d");
const $=id=>document.getElementById(id);
const ui={hud:$("hud"),start:$("start-screen"),pause:$("pause-screen"),result:$("result-screen"),how:$("how-screen"),mobile:$("mobile-controls"),pauseBtn:$("pause-btn"),timer:$("timer"),round:$("round"),message:$("message"),combo:$("combo"),comboCount:$("combo-count")};
let W=0,H=0,dpr=1,last=0,elapsed=0,remaining=99,playing=false,paused=false,ended=false,shake=0,particles=[],keys={},audioCtx=null;
let gameMode="cpu",onlineSlot=0,onlineInput={left:false,right:false,guard:false,jump:false,dash:false,attack:null},onlineLastAttack=null,onlineState=null,onlineCountdown=0;
const floorY=()=>H*.78;
const player={x:W*.28,y:0,vx:0,vy:0,health:100,stamina:100,face:1,guard:false,attack:null,attackTime:0,hitFlash:0,combo:0,comboTimer:0,walk:0,stun:0};
const enemy={x:W*.72,y:0,vx:0,vy:0,health:100,stamina:100,face:-1,guard:false,attack:null,attackTime:0,hitFlash:0,combo:0,comboTimer:0,walk:0,stun:0,ai:0};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function resize(){dpr=Math.min(devicePixelRatio||1,2);W=canvas.clientWidth;H=canvas.clientHeight;canvas.width=Math.floor(W*dpr);canvas.height=Math.floor(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);player.y=enemy.y=floorY();}
window.addEventListener("resize",resize);resize();
function sound(freq=180,dur=.07,type="sawtooth",vol=.035){try{audioCtx=audioCtx||new(window.AudioContext||window.webkitAudioContext)();let o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.setValueAtTime(freq,audioCtx.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(40,freq*.55),audioCtx.currentTime+dur);g.gain.setValueAtTime(vol,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+dur);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+dur)}catch(e){}}
function show(el){el.classList.remove("hidden")}function hide(el){el.classList.add("hidden")}
function banner(txt){ui.message.textContent=txt;show(ui.message);setTimeout(()=>hide(ui.message),1150)}
function reset(){$("again-btn").style.display="";Object.assign(player,{x:W*.28,y:floorY(),vx:0,vy:0,health:100,stamina:100,face:1,guard:false,attack:null,attackTime:0,hitFlash:0,combo:0,comboTimer:0,walk:0,stun:0});Object.assign(enemy,{x:W*.72,y:floorY(),vx:0,vy:0,health:100,stamina:100,face:-1,guard:false,attack:null,attackTime:0,hitFlash:0,combo:0,comboTimer:0,walk:0,stun:0,ai:0});remaining=99;elapsed=0;particles=[];shake=0;ended=false;updateHud();hide(ui.result);hide(ui.pause);hide(ui.start);hide(ui.how);show(ui.hud);show(ui.pauseBtn);show(ui.mobile);playing=true;paused=false;banner("FIGHT!");sound(420,.18,"square")}
function updateHud(){$("p-health").style.width=player.health+"%";$("e-health").style.width=enemy.health+"%";$("p-stamina").style.width=player.stamina+"%";$("e-stamina").style.width=enemy.stamina+"%";$("p-health-text").textContent=Math.ceil(player.health)+" / 100";$("e-health-text").textContent=Math.ceil(enemy.health)+" / 100";ui.timer.textContent=Math.ceil(remaining)}
function spawn(x,y,color,n=10){for(let i=0;i<n;i++){let a=Math.random()*Math.PI*2,s=70+Math.random()*240;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-60,life:.35+Math.random()*.4,max:.75,color,size:2+Math.random()*4})}}
function attack(f,type){if(!playing||paused||f.stun>0||f.attack||f.stamina<(type==="special"?35:type==="kick"?18:10))return;let cost=type==="special"?35:type==="kick"?18:10;f.stamina-=cost;f.attack=type;f.attackTime=type==="special"?.62:type==="kick"?.42:.3;f._hit=false;sound(type==="special"?120:type==="kick"?95:220,.09,type==="special"?"sawtooth":"triangle",.045);if(f===player&&type==="special")banner("POWER STRIKE!")}
function hit(attacker,target){if(!attacker.attack||attacker._hit)return;let reach=attacker.attack==="special"?145:attacker.attack==="kick"?112:88;let dist=Math.abs(attacker.x-target.x);let active=attacker.attackTime<(attacker.attack==="special"?.42:attacker.attack==="kick"?.29:.2);if(active&&dist<reach&&Math.abs(attacker.y-target.y)<65&&Math.sign(target.x-attacker.x)===attacker.face){attacker._hit=true;let dmg=attacker.attack==="special"?24:attacker.attack==="kick"?15:9;let blocked=target.guard&&target.stamina>2;if(blocked){dmg*=.2;target.stamina=Math.max(0,target.stamina-12);spawn(target.x,target.y-65,"#58dfff",6);sound(330,.06,"triangle")}else{target.health=Math.max(0,target.health-dmg);target.stun=.18;target.vx=attacker.face*(attacker.attack==="special"?330:attacker.attack==="kick"?220:150);target.hitFlash=.14;shake=attacker.attack==="special"?12:6;spawn(target.x,target.y-65,attacker===player?"#ffcb52":"#ff4968",attacker.attack==="special"?22:12);sound(90,.12,"sawtooth",.06);if(attacker===player){player.combo++;player.comboTimer=1.1;if(player.combo>=2){ui.comboCount.textContent=player.combo;show(ui.combo)}}} }
}
function updateFighter(f,dt,isPlayer){f.y=floorY()-Math.max(0,f.jump||0);f.stamina=clamp(f.stamina+(f.guard?4:13)*dt,0,100);f.hitFlash=Math.max(0,f.hitFlash-dt);f.stun=Math.max(0,f.stun-dt);f.comboTimer=Math.max(0,f.comboTimer-dt);if(f.comboTimer===0&&isPlayer){f.combo=0;hide(ui.combo)}if(f.attack){f.attackTime-=dt;if(f===player)hit(player,enemy);else hit(enemy,player);if(f.attackTime<=0)f.attack=null}f.x+=f.vx*dt;f.vx*=Math.pow(.001,dt);f.x=clamp(f.x,45,W-45);if(f.jump){f.jumpV-=1250*dt;f.jump+=f.jumpV*dt;if(f.jump<=0){f.jump=0;f.jumpV=0}}f.walk+=Math.abs(f.vx)*dt*.025}
function playerInput(dt){if(player.stun>0)return;let moving=0;if(keys.a||keys.arrowleft)moving=-1;if(keys.d||keys.arrowright)moving=1;player.guard=!!(keys.s||keys.arrowdown);if(player.guard) moving=0;if(moving){player.vx=moving*245;player.face=moving}else if(!player.attack)player.vx*=.7;if((keys.w||keys.arrowup)&&!player.jump){player.jump=1;player.jumpV=470;sound(280,.07,"sine")}if(keys.shift&&!player._dash&&player.stamina>=20){player.vx=player.face*530;player.stamina-=20;player._dash=true;spawn(player.x,player.y-45,"#43e8ff",8);sound(150,.08)}if(!keys.shift)player._dash=false;if(keys.j&&!player._j){attack(player,"punch");player._j=true}if(!keys.j)player._j=false;if(keys.k&&!player._k){attack(player,"kick");player._k=true}if(!keys.k)player._k=false;if(keys.l&&!player._l){attack(player,"special");player._l=true}if(!keys.l)player._l=false}
function enemyAI(dt){if(enemy.stun>0)return;let d=player.x-enemy.x;enemy.face=d>0?1:-1;enemy.ai-=dt;enemy.guard=false;if(Math.abs(d)>100){enemy.vx=Math.sign(d)* (Math.abs(d)>250?125:65)}else{enemy.vx*=.5;if(enemy.ai<=0){enemy.ai=.45+Math.random()*.9;let r=Math.random();if(r<.22&&enemy.stamina>20)enemy.guard=true;else attack(enemy,r>.83&&enemy.stamina>35?"special":r>.48?"kick":"punch")}}}
function update(dt){if(!playing||paused||ended)return;
 if(gameMode==="online"){
   let atk=null;
   if(keys.j&&!keys._oj){atk="punch";keys._oj=true}if(!keys.j)keys._oj=false;
   if(keys.k&&!keys._ok){atk="kick";keys._ok=true}if(!keys.k)keys._ok=false;
   if(keys.l&&!keys._ol){atk="special";keys._ol=true}if(!keys.l)keys._ol=false;
   onlineInput={left:!!(keys.a||keys.arrowleft),right:!!(keys.d||keys.arrowright),guard:!!(keys.s||keys.arrowdown),jump:!!(keys.w||keys.arrowup),dash:!!keys.shift,attack:atk};
   window.dispatchEvent(new CustomEvent("pvp-online-input",{detail:onlineInput}));
   if(onlineState){let mine=onlineState.fighters[onlineSlot],foe=onlineState.fighters[1-onlineSlot];
     const copy=(dst,src)=>{Object.assign(dst,src);dst.x=(src.x/1000)*W;dst.vx=(src.vx/1000)*W;dst.y=floorY()-Math.max(0,src.jump||0);dst.walk=Math.abs(src.vx||0)>.5?dst.walk+dt*5:dst.walk||0;dst.hitFlash=0;dst.stun=src.stun||0};
     copy(player,mine);copy(enemy,foe);player.face=mine.face;enemy.face=foe.face;
     
     remaining=onlineState.remaining;elapsed=onlineState.elapsed;
     updateHud();
   }
 } else {elapsed+=dt;remaining=Math.max(0,remaining-dt);playerInput(dt);enemyAI(dt);updateFighter(player,dt,true);updateFighter(enemy,dt,false);}
if(Math.abs(player.x-enemy.x)<65){let mid=(player.x+enemy.x)/2;player.x=mid-Math.sign(enemy.x-player.x)*33;enemy.x=mid+Math.sign(enemy.x-player.x)*33}for(let p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=520*dt;p.life-=dt}particles=particles.filter(p=>p.life>0);shake=Math.max(0,shake-dt*35);updateHud();if(gameMode==="cpu"&&(player.health<=0||enemy.health<=0||remaining<=0))finish(player.health>enemy.health?"win":player.health<enemy.health?"lose":"draw")}
function finish(result){ended=true;playing=false;hide(ui.mobile);hide(ui.pauseBtn);show(ui.result);$("result-title").textContent=result==="win"?"VICTORY":result==="lose"?"DEFEAT":"DRAW";$("result-desc").textContent=result==="win"?"أداء رائع! لقد سيطرت على الحلبة.":result==="lose"?"لا تستسلم، تدرب وارجع أقوى.":"انتهى الوقت بالتعادل."; $("reward-value").textContent=result==="win"?"+250":result==="draw"?"+100":"+50";sound(result==="win"?620:100,.35,"triangle")}
function drawBackground(){let g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,"#071a36");g.addColorStop(.55,"#255477");g.addColorStop(1,"#d18a65");ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 // distant skyline
 for(let i=0;i<18;i++){let x=i*W/16-W*.05,bw=W*.075,h=H*(.22+((i*17)%9)/30);ctx.fillStyle=i%2?"#18334c":"#102a43";ctx.fillRect(x,H*.54-h,bw,h);ctx.fillStyle="#5ac7ef22";for(let wy=H*.54-h+14;wy<H*.53;wy+=19)for(let wx=x+9;wx<x+bw-5;wx+=17)ctx.fillRect(wx,wy,6,8)}
 // street perspective
 let fy=floorY();ctx.fillStyle="#293e50";ctx.beginPath();ctx.moveTo(0,H*.53);ctx.lineTo(W,H*.53);ctx.lineTo(W, H);ctx.lineTo(0,H);ctx.fill();ctx.fillStyle="#a4c4c8";ctx.globalAlpha=.18;ctx.beginPath();ctx.moveTo(W*.48,H*.53);ctx.lineTo(W*.52,H*.53);ctx.lineTo(W*.94,H);ctx.lineTo(W*.06,H);ctx.fill();ctx.globalAlpha=1;
 for(let i=0;i<10;i++){let y=H*.57+i*i*H*.004;ctx.strokeStyle=`rgba(225,237,233,${.18-i*.012})`;ctx.lineWidth=1+i*.15;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
 // neon signs
 ctx.fillStyle="#f53f58";ctx.shadowColor="#f53f58";ctx.shadowBlur=18;ctx.fillRect(W*.04,H*.22,W*.12,5);ctx.fillStyle="#27dfff";ctx.shadowColor="#27dfff";ctx.fillRect(W*.82,H*.18,W*.14,5);ctx.shadowBlur=0;
 ctx.fillStyle="#061322";ctx.fillRect(0,H*.49,W,H*.045);ctx.fillStyle="#d4f1ff22";ctx.fillRect(0,H*.49,W,H*.006);
}
function drawFighter(f,isPlayer){let x=f.x,y=floorY()-(f.jump||0),s=clamp(H/650,.65,1.35),dir=f.face;ctx.save();ctx.translate(x,y);ctx.scale(s,s);
 // shadow
 ctx.fillStyle="#050b13aa";ctx.beginPath();ctx.ellipse(0,0,36,9,0,0,Math.PI*2);ctx.fill();
 // aura
 if(f.attack==="special"){ctx.strokeStyle=isPlayer?"#39eaff":"#ff4265";ctx.lineWidth=4;ctx.globalAlpha=.5+Math.sin(elapsed*30)*.3;ctx.beginPath();ctx.arc(0,-65,65+Math.sin(elapsed*20)*8,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1}
 // legs
 let step=Math.sin(f.walk*7)*7, leg1=step,leg2=-step;
 ctx.lineCap="round";ctx.lineWidth=13;ctx.strokeStyle=isPlayer?"#e4e9f1":"#172d48";ctx.beginPath();ctx.moveTo(-9,-38);ctx.lineTo(-13+leg1,-5);ctx.lineTo(-22+leg1,0);ctx.stroke();ctx.beginPath();ctx.moveTo(9,-38);ctx.lineTo(14+leg2,-6);ctx.lineTo(23+leg2,0);ctx.stroke();
 ctx.lineWidth=8;ctx.strokeStyle=isPlayer?"#263a58":"#e33b58";ctx.beginPath();ctx.moveTo(-22+leg1,0);ctx.lineTo(-7+leg1,0);ctx.moveTo(12+leg2,0);ctx.lineTo(28+leg2,0);ctx.stroke();
 // torso
 ctx.fillStyle=isPlayer?"#e5edf4":"#d92e4e";ctx.beginPath();ctx.moveTo(-18,-91);ctx.lineTo(16,-91);ctx.lineTo(22,-43);ctx.lineTo(-18,-42);ctx.closePath();ctx.fill();
 ctx.fillStyle=isPlayer?"#263d59":"#172d49";ctx.beginPath();ctx.moveTo(-18,-88);ctx.lineTo(1,-85);ctx.lineTo(13,-48);ctx.lineTo(-11,-48);ctx.closePath();ctx.fill();
 // belt
 ctx.fillStyle="#101a2c";ctx.fillRect(-18,-53,38,6);ctx.fillStyle="#f4c34b";ctx.fillRect(-2,-54,8,8);
 // arms
 let punch=f.attack? (f.attack==="special"?42:f.attack==="kick"?12:30):0;
 ctx.lineWidth=12;ctx.strokeStyle=isPlayer?"#dbe6f0":"#df4560";ctx.beginPath();ctx.moveTo(-13,-82);ctx.lineTo(-25,-64);ctx.lineTo(-19,-47);ctx.stroke();
 ctx.beginPath();ctx.moveTo(14,-82);ctx.lineTo(23+dir*punch,-67);ctx.lineTo(28+dir*punch,-61);ctx.stroke();
 ctx.fillStyle=isPlayer?"#111e34":"#101c31";ctx.beginPath();ctx.arc(28+dir*punch,-60,8,0,Math.PI*2);ctx.fill();
 // neck/head
 ctx.fillStyle="#c88f70";ctx.fillRect(-5,-103,11,13);ctx.fillStyle=isPlayer?"#d64c30":"#e7c7a2";ctx.beginPath();ctx.arc(0,-113,15,0,Math.PI*2);ctx.fill();
 ctx.fillStyle=isPlayer?"#e9472e":"#111b2a";ctx.beginPath();ctx.arc(0,-117,16,Math.PI,Math.PI*2);ctx.fill();ctx.fillRect(-15,-117,30,5);
 // visor
 ctx.fillStyle=isPlayer?"#12263a":"#1be4ff";ctx.fillRect(-12,-116,24,6);ctx.fillStyle="#fff";ctx.fillRect(dir*5-2,-115,4,2);
 // guard shield
 if(f.guard){ctx.strokeStyle="#5be9ff";ctx.lineWidth=3;ctx.globalAlpha=.8;ctx.beginPath();ctx.arc(dir*24,-73,29,-1.4,1.4);ctx.stroke();ctx.globalAlpha=1}
 if(f.hitFlash>0){ctx.globalAlpha=.55;ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(0,-70,44,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1}
 ctx.restore();
}
function render(){ctx.save();if(shake>0)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);drawBackground(); // ground perspective fighter shadows
 drawFighter(player,true);drawFighter(enemy,false);
 for(let p of particles){ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size)}ctx.globalAlpha=1;
 // stage label
 ctx.fillStyle="#d8f4ff66";ctx.font="bold 10px Orbitron";ctx.textAlign="center";ctx.fillText("NEON DISTRICT  //  FIGHTING ZONE",W/2,H*.91);
 ctx.restore()}
function loop(t){let dt=Math.min((t-last)/1000||0,.033);last=t;update(dt);render();requestAnimationFrame(loop)}requestAnimationFrame(loop);
function startPause(){if(!playing||ended)return;if(gameMode==="online"){banner("ONLINE MATCH — PAUSE DISABLED");return}paused=true;show(ui.pause);hide(ui.mobile)}
function resume(){paused=false;hide(ui.pause);show(ui.mobile)}
$("play-btn").onclick=reset;$("again-btn").onclick=reset;$("restart-btn").onclick=reset;$("resume-btn").onclick=resume;$("pause-btn").onclick=startPause;
$("home-btn").onclick=$("result-home-btn").onclick=()=>{playing=false;paused=false;hide(ui.hud);hide(ui.pause);hide(ui.result);hide(ui.pauseBtn);hide(ui.mobile);show(ui.start)};
$("how-btn").onclick=()=>{hide(ui.start);show(ui.how)};$("how-back-btn").onclick=()=>{hide(ui.how);show(ui.start)};
window.addEventListener("keydown",e=>{let k=e.key.toLowerCase();if(["arrowleft","arrowright","arrowup","arrowdown"," "].includes(k))e.preventDefault();keys[k]=true;if(k==="escape"){if(paused)resume();else startPause()}});
window.addEventListener("keyup",e=>keys[e.key.toLowerCase()]=false);
document.querySelectorAll("#mobile-controls button").forEach(b=>{let k=b.dataset.key;b.addEventListener("pointerdown",e=>{e.preventDefault();keys[k]=true;b.setPointerCapture(e.pointerId)});["pointerup","pointercancel","lostpointercapture"].forEach(ev=>b.addEventListener(ev,()=>keys[k]=false))});
document.addEventListener("visibilitychange",()=>{if(document.hidden&&playing&&!paused)startPause()});
show(ui.start);
})();