const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.split(",") : true },
  pingInterval: 25000, pingTimeout: 20000
});
const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req,res)=>res.json({ok:true,service:"online-pvp-fight",rooms:rooms.size}));
app.get("/api/leaderboard", (_req,res)=>res.json(topRanks()));

const rooms = new Map();
const waiting = [];
const ranks = new Map();
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
function code(){let s="";do{s="";for(let i=0;i<6;i++)s+=CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)]}while(rooms.has(s));return s}
function makeFighter(x,face){return {x,y:0,vx:0,health:100,stamina:100,face,guard:false,jump:0,attack:null,attackTime:0,hitDone:false,stun:0}}
function makeRoom(id,privateRoom){return {id,privateRoom,players:[],status:"waiting",state:{remaining:99,elapsed:0,round:1,fighters:[makeFighter(260,1),makeFighter(740,-1)]},lastTick:Date.now(),ended:false}}
function playerName(socket){return String(socket.data.playerName||"Fighter-"+socket.id.slice(0,4)).slice(0,18)}
function getRank(socket){let id=socket.data.rankId||(socket.data.rankId=socket.id);if(!ranks.has(id))ranks.set(id,{id,name:playerName(socket),wins:0,losses:0,rating:1000});return ranks.get(id)}
function topRanks(){return [...ranks.values()].sort((a,b)=>b.rating-a.rating||b.wins-a.wins).slice(0,10).map(({name,wins,losses,rating})=>({name,wins,losses,rating}))}
function emitRanks(){io.emit("rankings",topRanks())}
function cleanRoom(room){for(const p of room.players){if(p&&p.connected){p.leave(room.id);p.data.roomId=null}}rooms.delete(room.id)}
function publicState(room){return {remaining:room.state.remaining,elapsed:room.state.elapsed,round:room.state.round,fighters:room.state.fighters.map(f=>({...f}))}}
function startRoom(room){if(room.players.length!==2||room.status==="playing")return;room.status="playing";room.lastTick=Date.now();room.players.forEach((p,i)=>{p.emit("gameStart",{roomId:room.id,slot:i,state:publicState(room)})})}
function joinSocket(socket,room){if(room.players.length>=2){socket.emit("roomError",{message:"الغرفة ممتلئة."});return false}let slot=room.players.length;room.players.push(socket);socket.join(room.id);socket.data.roomId=room.id;socket.data.slot=slot;getRank(socket);socket.emit("joinedRoom",{roomId:room.id,slot});if(room.players.length===1){socket.emit("roomWaiting");}else startRoom(room);return true}
function finishRoom(room){if(room.ended)return;room.ended=true;room.status="finished";let [a,b]=room.state.fighters;let result=a.health===b.health?"draw":a.health>b.health?0:1;room.players.forEach((p,i)=>{let r=getRank(p);if(result==="draw"){r.rating+=5}else if(i===result){r.wins++;r.rating+=25}else{r.losses++;r.rating=Math.max(100,r.rating-18)}p.emit("gameOver",{result:result==="draw"?"draw":result===i?"win":"lose",rating:r.rating,rank:r})});emitRanks();setTimeout(()=>cleanRoom(room),12000)}
function processAttack(attacker,target,slot){if(!attacker.attack||attacker.hitDone)return;let reach=attacker.attack==="special"?145:attacker.attack==="kick"?112:88;let active=attacker.attackTime<(attacker.attack==="special"?.42:attacker.attack==="kick"?.29:.2);if(active&&Math.abs(attacker.x-target.x)<reach&&Math.abs(attacker.y-target.y)<65&&Math.sign(target.x-attacker.x)===attacker.face){attacker.hitDone=true;let dmg=attacker.attack==="special"?24:attacker.attack==="kick"?15:9;if(target.guard&&target.stamina>2){dmg*=.2;target.stamina=Math.max(0,target.stamina-12)}else{target.health=Math.max(0,target.health-dmg);target.stun=.18;target.vx=attacker.face*(attacker.attack==="special"?330:attacker.attack==="kick"?220:150)}}}
function tick(room,dt){let fs=room.state.fighters;for(let i=0;i<2;i++){let f=fs[i],inp=room.players[i]?.data.input||{};if(f.stun<=0){let move=(inp.left?-1:0)+(inp.right?1:0);f.guard=!!inp.guard;if(f.guard)move=0;if(move){f.vx=move*245;f.face=move}else if(!f.attack)f.vx*=.7;if(inp.jump&&!f.jump){f.jump=1;f.jumpV=470}if(inp.dash&&f.stamina>=20){f.vx=f.face*420;f.stamina-=20}let a=inp.attack;if(a&&!f.attack&&f.stamina>=(a==="special"?35:a==="kick"?18:10)){f.stamina-=a==="special"?35:a==="kick"?18:10;f.attack=a;f.attackTime=a==="special"?.62:a==="kick"?.42:.3;f.hitDone=false}}
 f.stamina=clamp(f.stamina+(f.guard?4:13)*dt,0,100);f.stun=Math.max(0,f.stun-dt);if(f.attack){f.attackTime-=dt;processAttack(f,fs[1-i],i);if(f.attackTime<=0)f.attack=null}f.x=clamp(f.x+f.vx*dt,45,955);f.vx*=Math.pow(.001,dt);if(f.jump){f.jumpV-=1250*dt;f.jump+=f.jumpV*dt;if(f.jump<=0){f.jump=0;f.jumpV=0}}}
 if(Math.abs(fs[0].x-fs[1].x)<65){let mid=(fs[0].x+fs[1].x)/2;fs[0].x=mid-33;fs[1].x=mid+33}
 fs[0].face=fs[0].x<fs[1].x?1:-1;fs[1].face=-fs[0].face;room.state.elapsed+=dt;room.state.remaining=Math.max(0,room.state.remaining-dt);
 if(fs[0].health<=0||fs[1].health<=0||room.state.remaining<=0)finishRoom(room);
 io.to(room.id).emit("state",publicState(room));
}
setInterval(()=>{const now=Date.now();for(const room of rooms.values()){if(room.status!=="playing"||room.ended)continue;let dt=clamp((now-room.lastTick)/1000,0,.05);room.lastTick=now;tick(room,dt)}},1000/30);

io.on("connection",socket=>{
 getRank(socket);socket.emit("rankings",topRanks());
 socket.on("setName",name=>{socket.data.playerName=String(name||"").replace(/[<>]/g,"").slice(0,18)||playerName(socket);getRank(socket).name=playerName(socket);emitRanks()});
 socket.on("createRoom",()=>{const id=code(),room=makeRoom(id,true);rooms.set(id,room);joinSocket(socket,room);socket.emit("roomCreated",{roomId:id,slot:0})});
 socket.on("joinRoom",d=>{const id=String(d?.roomId||"").toUpperCase().replace(/[^A-Z0-9]/g,"");const room=rooms.get(id);if(!room){socket.emit("roomError",{message:"كود الغرفة غير صحيح أو انتهت صلاحيته."});return}if(room.status!=="waiting"){socket.emit("roomError",{message:"المباراة بدأت بالفعل أو الغرفة ممتلئة."});return}joinSocket(socket,room)});
 socket.on("findMatch",()=>{if(socket.data.roomId)return;let room=[...rooms.values()].find(r=>!r.privateRoom&&r.status==="waiting"&&r.players.length===1);if(!room){room=makeRoom(code(),false);rooms.set(room.id,room);waiting.push(room.id)}joinSocket(socket,room);socket.emit("matchFound",{roomId:room.id,slot:socket.data.slot})});
 socket.on("playerInput",input=>{let room=rooms.get(socket.data.roomId);if(!room||room.status!=="playing")return;let slot=socket.data.slot;if(!room.players[slot])return;const allowed={left:!!input?.left,right:!!input?.right,guard:!!input?.guard,jump:!!input?.jump,dash:!!input?.dash};let atk=["punch","kick","special"].includes(input?.attack)?input.attack:null;room.players[slot].data.input={...allowed,attack:atk};});
 socket.on("getRankings",()=>socket.emit("rankings",topRanks()));
 socket.on("leaveRoom",()=>{let id=socket.data.roomId,room=rooms.get(id);if(room){socket.to(id).emit("playerLeft");cleanRoom(room)}});
 socket.on("disconnect",()=>{let room=rooms.get(socket.data.roomId);if(room){room.players.forEach(p=>{if(p!==socket&&p.connected)p.emit("playerLeft")});cleanRoom(room)}});
});
server.listen(PORT,"0.0.0.0",()=>console.log(`ONLINE PvP server listening on ${PORT}`));
