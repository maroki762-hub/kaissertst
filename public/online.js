(() => {
"use strict";
const $=id=>document.getElementById(id);
const onlineUI={
 screen:$("online-screen"),status:$("online-status"),roomInfo:$("room-info"),
 code:$("room-code"),input:$("room-code-input"),waiting:$("waiting-text"),
 leaderboard:$("leaderboard")
};
let socket=null,connected=false,onlineMode=false,roomId=null,slot=null,latest=null,lastInputAt=0;
const setStatus=(msg,error=false)=>{onlineUI.status.textContent=msg;onlineUI.status.classList.toggle("error",error)};
function openLobby(){
 $("start-screen").classList.add("hidden");onlineUI.screen.classList.remove("hidden");
 if(!socket){connect();}else if(connected){refreshRanks();}
}
function connect(){
 if(typeof io!=="function"){setStatus("تعذر تحميل مكتبة Socket.IO. تحقق من اتصال الإنترنت.",true);return}
 socket=io({transports:["websocket","polling"]});
 setStatus("جارٍ الاتصال بالسيرفر...");
 socket.on("connect",()=>{connected=true;setStatus("متصل بالسيرفر ✓ يمكنك إنشاء غرفة أو البحث عن خصم.");refreshRanks()});
 socket.on("connect_error",()=>setStatus("تعذر الاتصال. تحقق من رابط السيرفر أو أعد المحاولة.",true));
 socket.on("disconnect",()=>{connected=false;if(onlineMode){onlineMode=false;setStatus("انقطع الاتصال بالسيرفر. عد إلى القائمة وحاول مجدداً.",true);$("start-screen").classList.remove("hidden");onlineUI.screen.classList.add("hidden");}});
 socket.on("roomCreated",d=>{roomId=d.roomId;slot=d.slot;showRoom(d.roomId);setStatus("تم إنشاء الغرفة. أرسل الكود لصديقك.")});
 socket.on("joinedRoom",d=>{roomId=d.roomId;slot=d.slot;showRoom(d.roomId);setStatus("انضممت إلى الغرفة. استعد للمباراة.")});
 socket.on("waiting",()=>{onlineUI.waiting.textContent="بانتظار لاعب آخر للانضمام..."});
 socket.on("matchFound",d=>{roomId=d.roomId;slot=d.slot;onlineMode=true;onlineUI.screen.classList.add("hidden");$("start-screen").classList.add("hidden");setStatus("تم العثور على خصم!");});
 socket.on("gameStart",d=>{onlineMode=true;roomId=d.roomId;slot=d.slot;latest=d.state;onlineUI.screen.classList.add("hidden");$("start-screen").classList.add("hidden");window.dispatchEvent(new CustomEvent("pvp-online-start",{detail:{slot,state:d.state}}));});
 socket.on("state",state=>{latest=state;window.dispatchEvent(new CustomEvent("pvp-online-state",{detail:{slot,state}}));});
 socket.on("gameOver",d=>{window.dispatchEvent(new CustomEvent("pvp-online-over",{detail:d}));refreshRanks()});
 socket.on("roomError",d=>setStatus(d.message||"حدث خطأ في الغرفة.",true));
 socket.on("rankings",data=>renderRanks(data));
 socket.on("playerLeft",()=>{setStatus("غادر الخصم المباراة. يمكنك العودة للقائمة أو انتظار لاعب جديد.",true)});
 socket.on("roomWaiting",()=>setStatus("تم إنشاء الغرفة. أرسل الكود لصديقك وانتظر."));
}
function showRoom(code){onlineUI.roomInfo.classList.remove("hidden");onlineUI.code.textContent=code;onlineUI.waiting.textContent="بانتظار اللاعب الثاني..."}
function refreshRanks(){if(socket&&connected)socket.emit("getRankings")}
function renderRanks(rows){onlineUI.leaderboard.innerHTML="";if(!rows||!rows.length){onlineUI.leaderboard.innerHTML="<li>لا توجد نتائج بعد — كن أول بطل!</li>";return}rows.forEach((r,i)=>{let li=document.createElement("li");li.textContent=`${i+1}. ${r.name} — ${r.wins} فوز / ${r.losses} خسارة`;let span=document.createElement("span");span.textContent=`${r.rating} RP`;li.appendChild(span);onlineUI.leaderboard.appendChild(li)})}
function ensure(){if(!socket||!connected){setStatus("السيرفر غير متصل. انتظر الاتصال أو أعد تحميل الصفحة.",true);return false}return true}
$("online-btn").addEventListener("click",openLobby);
$("online-back-btn").addEventListener("click",()=>{onlineUI.screen.classList.add("hidden");$("start-screen").classList.remove("hidden")});
$("create-room-btn").addEventListener("click",()=>{if(!ensure())return;socket.emit("createRoom")});
$("join-room-btn").addEventListener("click",()=>{if(!ensure())return;let code=onlineUI.input.value.trim().toUpperCase();if(!code){setStatus("اكتب كود الغرفة أولاً.",true);return}socket.emit("joinRoom",{roomId:code})});
$("random-match-btn").addEventListener("click",()=>{if(!ensure())return;setStatus("نبحث عن لاعب مناسب...");socket.emit("findMatch")});
$("copy-room-btn").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(onlineUI.code.textContent);setStatus("تم نسخ كود الغرفة.")}catch(e){setStatus("انسخ الكود يدوياً: "+onlineUI.code.textContent)}});
document.addEventListener("keydown",e=>{if(e.key==="Enter"&&document.activeElement===onlineUI.input)$("join-room-btn").click()});
window.addEventListener("pvp-online-input",e=>{if(socket&&connected&&onlineMode){let now=performance.now();if(now-lastInputAt>28){lastInputAt=now;socket.emit("playerInput",e.detail)}}});
window.addEventListener("pvp-online-leave",()=>{if(socket&&connected)socket.emit("leaveRoom");onlineMode=false;roomId=null;slot=null;latest=null});
window.addEventListener("pvp-online-start",()=>{onlineMode=true});
window.addEventListener("pvp-online-over",()=>{onlineMode=false});
window.addEventListener("pvp-online-return",()=>{onlineMode=false;onlineUI.screen.classList.remove("hidden");$("start-screen").classList.add("hidden");refreshRanks()});
document.addEventListener("visibilitychange",()=>{if(document.hidden&&socket&&connected&&onlineMode)socket.emit("playerInput",{left:false,right:false,guard:false,jump:false,dash:false,attack:null})});
window.addEventListener("beforeunload",()=>{if(socket)socket.disconnect()});
})();