let currentUser="";
let people=[
{name:"Arun Kumar",type:"friend",status:"online"},
{name:"Visshali",type:"friend",status:"online"},
{name:"Rajashree",type:"friend",status:"online"},
{name:"Sundaravally",type:"friend",status:"online"},
{name:"Priya Sharma",type:"employee",status:"online"},
{name:"Karthik",type:"employee",status:"offline"},
{name:"Meena Ravi",type:"employee",status:"online"}
];

let selectedPractice="Hello";
let practiceStream=null;
let meetingStream=null;
let peer=null;
let currentMeetingCode="";
let currentCall=null;
let readerActive=true;
let cameraActive=true;
let muted=false;
let recognition=null;
let hands=null;

window.onload=function(){
    const saved=localStorage.getItem("signbridgeUser");
    if(saved){
        currentUser=saved;
        enterApp();
    }
};

function login(){
    const email=document.getElementById("loginEmail").value.trim();
    const password=document.getElementById("loginPassword").value.trim();

    if(!email || !password){
        toast("Enter email and password");
        return;
    }

    currentUser=email;
    localStorage.setItem("signbridgeUser",email);
    enterApp();
}

function enterApp(){
    document.getElementById("loginScreen").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");
    document.getElementById("userEmail").textContent=currentUser;
    renderPeople();
}

function logout(){
    localStorage.removeItem("signbridgeUser");
    location.reload();
}

function showPage(id,button){
    document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));
    document.getElementById(id).classList.remove("hidden");

    document.querySelectorAll(".nav").forEach(n=>n.classList.remove("active"));
    if(button) button.classList.add("active");

    if(id==="people") renderPeople();
}

function toast(message){
    const t=document.getElementById("toast");
    t.textContent=message;
    t.classList.add("show");
    setTimeout(()=>t.classList.remove("show"),2500);
}

function openMeetChoice(){
    showPage("meet");
}

function renderPeople(filter="all"){
    const grid=document.getElementById("peopleGrid");
    grid.innerHTML="";

    people
    .filter(p=>filter==="all" || p.type===filter)
    .forEach((p,index)=>{
        const initials=p.name.split(" ").map(x=>x[0]).join("").substring(0,2);

        const card=document.createElement("div");
        card.className="person-card";

        card.innerHTML=`
            <div class="person-top">
                <div class="avatar">${initials}</div>
                <div>
                    <div class="person-name">${p.name}</div>
                    <div class="person-type">${p.type==="friend"?"Friend":"Employee"}</div>
                </div>
            </div>

            <div class="${p.status==="online"?"online":"offline"}">
                ● ${p.status}
            </div>

            <button class="primary-btn" ${p.status!=="online"?"disabled":""}
                onclick="startMeetingWith('${p.name}')">
                ${p.status==="online"?"Start Meeting":"Offline"}
            </button>
        `;

        grid.appendChild(card);
    });
}

function filterPeople(filter,button){
    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
    button.classList.add("active");
    renderPeople(filter);
}

function addPerson(){
    const name=prompt("Enter person's name:");
    if(!name) return;

    people.push({
        name:name,
        type:"friend",
        status:"online"
    });

    renderPeople();
    toast(name+" added");
}

function startMeetingWith(name){
    showPage("meet");
    setTimeout(()=>{
        createMeeting(name);
    },100);
}

function generateCode(){
    const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code="";
    for(let i=0;i<6;i++){
        code+=chars[Math.floor(Math.random()*chars.length)];
    }
    return code;
}

async function createMeeting(personName="SignBridge Meeting"){
    try{
        meetingStream=await navigator.mediaDevices.getUserMedia({
            video:true,
            audio:true
        });

        document.getElementById("localVideo").srcObject=meetingStream;

        currentMeetingCode=generateCode();

        /*
        The meeting code itself becomes the PeerJS room ID.
        This makes the code shareable with another user.
        */
        peer=new Peer(currentMeetingCode,{
            debug:1
        });

        peer.on("open",id=>{
            currentMeetingCode=id;

            document.getElementById("meetingCodeDisplay").textContent=id;
            document.getElementById("meetingTitle").textContent=
                personName==="SignBridge Meeting"
                ?"New SignBridge Meeting"
                :"Meeting with "+personName;

            document.getElementById("meetingLobby").classList.add("hidden");
            document.getElementById("meetingRoom").classList.remove("hidden");

            setupPeerIncoming();
            initMeetingHands();

            toast("Meeting created. Share code "+id);
        });

        peer.on("error",err=>{
            console.log(err);

            if(err.type==="unavailable-id"){
                peer.destroy();
                createMeeting(personName);
            }else{
                toast("Meeting connection error");
            }
        });

    }catch(error){
        console.log(error);
        toast("Please allow camera and microphone access");
    }
}

function setupPeerIncoming(){
    peer.on("call",call=>{
        currentCall=call;

        call.answer(meetingStream);

        call.on("stream",remoteStream=>{
            showRemoteStream(remoteStream);
        });

        call.on("close",()=>{
            document.getElementById("waitingRemote").style.display="flex";
        });
    });
}

async function joinMeeting(){
    const code=document.getElementById("joinCode").value
        .trim()
        .toUpperCase();

    if(!code){
        toast("Enter a meeting code");
        return;
    }

    try{
        meetingStream=await navigator.mediaDevices.getUserMedia({
            video:true,
            audio:true
        });

        document.getElementById("localVideo").srcObject=meetingStream;

        peer=new Peer();

        peer.on("open",()=>{
            currentMeetingCode=code;

            document.getElementById("meetingCodeDisplay").textContent=code;
            document.getElementById("meetingTitle").textContent="Joined Meeting";

            document.getElementById("meetingLobby").classList.add("hidden");
            document.getElementById("meetingRoom").classList.remove("hidden");

            currentCall=peer.call(code,meetingStream);

            if(!currentCall){
                toast("Meeting not found or host is unavailable");
                return;
            }

            currentCall.on("stream",remoteStream=>{
                showRemoteStream(remoteStream);
            });

            currentCall.on("close",()=>{
                document.getElementById("waitingRemote").style.display="flex";
            });

            initMeetingHands();

            toast("Joining meeting...");
        });

        peer.on("error",err=>{
            console.log(err);
            toast("Could not join meeting");
        });

    }catch(error){
        console.log(error);
        toast("Please allow camera and microphone access");
    }
}

function showRemoteStream(stream){
    const video=document.getElementById("remoteVideo");
    video.srcObject=stream;
    document.getElementById("waitingRemote").style.display="none";
    toast("Participant connected");
}

function copyMeetingCode(){
    if(!currentMeetingCode)return;

    navigator.clipboard.writeText(currentMeetingCode);
    toast("Meeting code copied");
}

function endMeeting(){
    if(currentCall){
        currentCall.close();
        currentCall=null;
    }

    if(peer){
        peer.destroy();
        peer=null;
    }

    if(meetingStream){
        meetingStream.getTracks().forEach(t=>t.stop());
        meetingStream=null;
    }

    document.getElementById("remoteVideo").srcObject=null;
    document.getElementById("localVideo").srcObject=null;

    document.getElementById("meetingRoom").classList.add("hidden");
    document.getElementById("meetingLobby").classList.remove("hidden");

    document.getElementById("joinCode").value="";

    toast("Meeting ended");
}

function toggleMute(){
    if(!meetingStream)return;

    const audio=meetingStream.getAudioTracks()[0];
    if(!audio)return;

    muted=!muted;
    audio.enabled=!muted;

    document.getElementById("muteBtn").textContent=
        muted?"🔇 Unmute":"🎙 Mute";
}

function toggleCamera(){
    if(!meetingStream)return;

    const video=meetingStream.getVideoTracks()[0];
    if(!video)return;

    cameraActive=!cameraActive;
    video.enabled=cameraActive;

    document.getElementById("cameraBtn").textContent=
        cameraActive?"📷 Camera":"📷 Camera Off";
}

function toggleReader(){
    readerActive=!readerActive;

    document.getElementById("readerStatus").textContent=
        readerActive?"● LIVE":"● OFF";

    toast(readerActive?"ISL Reader enabled":"ISL Reader disabled");
}

function selectPractice(sign,emoji,element){
    selectedPractice=sign;

    document.querySelectorAll(".sign-item")
        .forEach(x=>x.classList.remove("selected"));

    element.classList.add("selected");

    document.getElementById("practiceOverlay").textContent=
        "Practice: "+emoji+" "+sign;

    toast("Practice "+sign);
}

async function startPractice(){
    try{
        practiceStream=await navigator.mediaDevices.getUserMedia({
            video:true,
            audio:false
        });

        document.getElementById("practiceVideo").srcObject=practiceStream;
        document.getElementById("practiceStatus").textContent="Camera active";

        initPracticeHands();

    }catch(error){
        console.log(error);
        toast("Please allow camera access");
    }
}

function initPracticeHands(){
    if(hands) return;

    hands=new Hands({
        locateFile:(file)=>{
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });

    hands.setOptions({
        maxNumHands:2,
        modelComplexity:1,
        minDetectionConfidence:.55,
        minTrackingConfidence:.55
    });

    hands.onResults(results=>{
        const canvas=document.getElementById("practiceCanvas");
        const video=document.getElementById("practiceVideo");

        canvas.width=video.videoWidth||640;
        canvas.height=video.videoHeight||480;

        const ctx=canvas.getContext("2d");
        ctx.clearRect(0,0,canvas.width,canvas.height);

        if(results.multiHandLandmarks){
            results.multiHandLandmarks.forEach(hand=>{
                drawLandmarks(ctx,hand,canvas.width,canvas.height);
            });

            const sign=demoRecognition(results.multiHandLandmarks);

            document.getElementById("practiceResult").textContent=sign;
        }
    });

    const camera=new Camera(
        document.getElementById("practiceVideo"),
        {
            onFrame:async()=>{
                await hands.send({
                    image:document.getElementById("practiceVideo")
                });
            },
            width:640,
            height:480
        }
    );

    camera.start();
}

function initMeetingHands(){
    if(!meetingStream || !readerActive)return;

    const video=document.getElementById("localVideo");

    const meetingHands=new Hands({
        locateFile:(file)=>{
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });

    meetingHands.setOptions({
        maxNumHands:2,
        modelComplexity:1,
        minDetectionConfidence:.55,
        minTrackingConfidence:.55
    });

    meetingHands.onResults(results=>{
        if(!readerActive)return;

        if(results.multiHandLandmarks &&
           results.multiHandLandmarks.length>0){

            const sign=demoRecognition(results.multiHandLandmarks);

            document.getElementById("meetingSignResult").textContent=sign;

            addConversation("You",sign);
        }
    });

    const loop=async()=>{
        if(document.getElementById("meetingRoom").classList.contains("hidden"))
            return;

        if(video.readyState>=2){
            await meetingHands.send({image:video});
        }

        requestAnimationFrame(loop);
    };

    loop();
}

function drawLandmarks(ctx,landmarks,w,h){
    ctx.fillStyle="#69d7e8";

    landmarks.forEach(point=>{
        ctx.beginPath();
        ctx.arc(point.x*w,point.y*h,4,0,Math.PI*2);
        ctx.fill();
    });
}

function demoRecognition(handsData){
    /*
    Demo recognition layer.

    MediaPipe provides hand landmarks.
    A trained ISL model can replace this function later.
    */

    if(!handsData || !handsData.length)
        return "No hand detected";

    const hand=handsData[0];

    const indexUp=hand[8].y<hand[6].y;
    const middleUp=hand[12].y<hand[10].y;
    const ringUp=hand[16].y<hand[14].y;
    const pinkyUp=hand[20].y<hand[18].y;

    if(indexUp && middleUp && ringUp && pinkyUp)
        return "Hello";

    if(indexUp && !middleUp && !ringUp && !pinkyUp)
        return "Yes";

    if(!indexUp && !middleUp && !ringUp && !pinkyUp)
        return "No";

    if(indexUp && middleUp)
        return "Thank You";

    return "Sign detected";
}

function speakMeetingText(){
    const text=document.getElementById("meetingSignResult").textContent;

    if(!text || text==="Waiting for a sign...")return;

    const speech=new SpeechSynthesisUtterance(text);
    speech.lang="en-US";
    window.speechSynthesis.speak(speech);
}

function startListening(){
    const SpeechRecognition=
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if(!SpeechRecognition){
        toast("Speech recognition is not supported in this browser");
        return;
    }

    if(recognition){
        recognition.stop();
    }

    recognition=new SpeechRecognition();

    recognition.lang="en-US";
    recognition.continuous=false;
    recognition.interimResults=false;

    recognition.onstart=()=>{
        document.getElementById("speechText").textContent=
            "Listening...";
        toast("Listening");
    };

    recognition.onresult=event=>{
        const text=event.results[0][0].transcript;

        document.getElementById("speechText").textContent=text;

        addConversation("Other participant",text);
    };

    recognition.onerror=()=>{
        document.getElementById("speechText").textContent=
            "Could not hear speech. Try again.";
    };

    recognition.start();
}

function addConversation(sender,text){
    const list=document.getElementById("conversationList");

    if(!text)return;

    const item=document.createElement("div");
    item.className="message";
    item.innerHTML="<strong>"+sender+":</strong> "+text;

    list.appendChild(item);
    list.scrollTop=list.scrollHeight;
}

function clearConversation(){
    document.getElementById("conversationList").innerHTML="";
}




/* =========================================
   FRIEND / WORK LOGIN
========================================= */

(function(){

    const loginOverlay=document.getElementById("accountLogin");
    const choices=document.getElementById("accountChoices");
    const formArea=document.getElementById("loginFormArea");
    const friendChoice=document.getElementById("friendLoginChoice");
    const workChoice=document.getElementById("workLoginChoice");
    const backChoice=document.getElementById("backLoginChoice");
    const typeTitle=document.getElementById("loginTypeTitle");
    const email=document.getElementById("sbEmail");
    const password=document.getElementById("sbPassword");
    const loginButton=document.getElementById("sbLoginButton");
    const message=document.getElementById("sbLoginMessage");

    let selectedType="";

    function chooseAccount(type){

        selectedType=type;

        choices.style.display="none";
        formArea.style.display="block";

        typeTitle.textContent =
            type==="friend"
            ? "👥 Friend Login"
            : "💼 Work Login";

        email.value="";
        password.value="";
        message.textContent="";
        email.focus();
    }

    friendChoice.addEventListener(
        "click",
        () => chooseAccount("friend")
    );

    workChoice.addEventListener(
        "click",
        () => chooseAccount("work")
    );

    backChoice.addEventListener(
        "click",
        () => {

            choices.style.display="grid";
            formArea.style.display="none";
            message.textContent="";

        }
    );

    loginButton.addEventListener(
        "click",
        () => {

            if(!email.value.trim() || !password.value.trim()){

                message.textContent =
                    "Please enter your email and password.";

                return;
            }

            localStorage.setItem(
                "signbridgeAccountType",
                selectedType
            );

            localStorage.setItem(
                "signbridgeAccountEmail",
                email.value.trim()
            );

            loginOverlay.style.display="none";

        }
    );

    password.addEventListener(
        "keydown",
        event => {

            if(event.key==="Enter")
                loginButton.click();

        }
    );

})();

/* =========================================
   FRIEND / WORK LOGIN
========================================= */

(function(){

    const loginOverlay=document.getElementById("accountLogin");
    const choices=document.getElementById("accountChoices");
    const formArea=document.getElementById("loginFormArea");
    const friendChoice=document.getElementById("friendLoginChoice");
    const workChoice=document.getElementById("workLoginChoice");
    const backChoice=document.getElementById("backLoginChoice");
    const typeTitle=document.getElementById("loginTypeTitle");
    const email=document.getElementById("sbEmail");
    const password=document.getElementById("sbPassword");
    const loginButton=document.getElementById("sbLoginButton");
    const message=document.getElementById("sbLoginMessage");

    let selectedType="";

    function chooseAccount(type){

        selectedType=type;

        choices.style.display="none";
        formArea.style.display="block";

        typeTitle.textContent =
            type==="friend"
            ? "👥 Friend Login"
            : "💼 Work Login";

        email.value="";
        password.value="";
        message.textContent="";
        email.focus();
    }

    friendChoice.addEventListener(
        "click",
        () => chooseAccount("friend")
    );

    workChoice.addEventListener(
        "click",
        () => chooseAccount("work")
    );

    backChoice.addEventListener(
        "click",
        () => {

            choices.style.display="grid";
            formArea.style.display="none";
            message.textContent="";

        }
    );

    loginButton.addEventListener(
        "click",
        () => {

            if(!email.value.trim() || !password.value.trim()){

                message.textContent =
                    "Please enter your email and password.";

                return;
            }

            localStorage.setItem(
                "signbridgeAccountType",
                selectedType
            );

            localStorage.setItem(
                "signbridgeAccountEmail",
                email.value.trim()
            );

            loginOverlay.style.display="none";

        }
    );

    password.addEventListener(
        "keydown",
        event => {

            if(event.key==="Enter")
                loginButton.click();

        }
    );

})();
