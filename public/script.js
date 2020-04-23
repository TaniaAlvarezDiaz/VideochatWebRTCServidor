/* VARIABLES */
var constraints = {audio : true , video : true }; //interested in video & audio

//Conexión
var theStream; //to save the reference of the stream (to stop it)
var localPeerConnection;
var remoteUsername = "";

//Botones y elementos HTML
var startButton = document.getElementById("startButton");
var callButton = document.getElementById("callButton");
var hangupButton = document.getElementById("hangupButton");
var video = document.getElementById("myVideo");
var remoteVideo = document.getElementById("remoteVideo");
var message = document.getElementById("message");
var sendMessageButton = document.getElementById("sendMessage");
var chat = document.getElementById("chat");
var dataChannel;

/* ESTADOS Y ACCIONES BOTONES*/
startButton.disabled = false;
callButton.disabled = true;
hangupButton.disabled = true;
message.disabled = true; //Input, not a button
sendMessageButton.disabled = true;

startButton.onclick = start;
callButton.onclick = call;
hangupButton.onclick = hangup;
sendMessageButton.onclick = sendMessage;

/* FUNCIONES */

//Main
function start() {
    console.log("Requesting stream");
    //Request login
    login();
}

function call() {
    //Get username from input
    remoteUsername = document.getElementById("remoteUsername").value;
    console.log("Starting call");
    //Establish connection
    startingCallCommunication();
    //We're all set! Create an offer to be 'sent to the callee as soon as the local SDP is ready
    localPeerConnection.createOffer(gotLocalDescription, onSignalingError);
}

function hangup() {
    console.log("Ending call");
    hangupButton.disabled = true;
    callButton.disabled = false;

    //Close PeerConnection
    if (localPeerConnection != null) {
        localPeerConnection.close();
        localPeerConnection = null;
    }
 
    //Notify the other part that the call was hung up
    send({
        type: "leave"
    })
}

function sendMessage() {
    chat.textContent += '* ' + message.value + '\n';
    dataChannel.send(message.value);
	message.value = '';
}

//Auxiliaries
function login() {
    var name = prompt("Please enter your name", "Name");
    send ({
        type: "login",
        source: name
    })
}

function startingCallCommunication() {
    hangupButton.disabled = false;
    //Communication between browsers
    if (typeof RTCPeerConnection == "undefined")
        RTCPeerConnection = webkitRTCPeerConnection;
    console.log("RTCPeerConnection object: " + RTCPeerConnection);

    //This is an optional configuration string , associated with NAT traversal setup
    var configuration = {
        //Servers on https://gist.github.com/yetithefoot/7592580
        "iceServers": [{"url": "stun:stun.ekiga.net"}]
    }
    localPeerConnection = new RTCPeerConnection(configuration);
    console.log("Created local peer connection object");

    //Add the local stream  to the local PeerConnection
    localPeerConnection.addStream(theStream);
    console.log("Added localStream to localPeerConnection");

    //Add a handler associated with ICE protocol events
    localPeerConnection.onicecandidate = gotLocalIceCandidate;
    //...and a second handler to be activated as soon as the remote stream becomes available
    localPeerConnection.onaddstream = gotRemoteStream;

    //Configure dataChannel
    dataChannel = localPeerConnection.createDataChannel("myChannel", {});
    localPeerConnection.ondatachannel = handleDataChannel;     
}

//Sends the found candidate to the server
function gotLocalIceCandidate(event) {
    if (event.candidate) {
        send({
            type: "candidate",
            candidate: event.candidate
        })
    }
}

//Function to send the description of the local session to the other side of the connection (remote)
function gotLocalDescription(description) {
    send({
        type: "offer",
        offer: description
    })
    localPeerConnection.setLocalDescription(description);
}

function onSignalingError(error) {
    console.log("Failed to create signaling message: " + error.name);
}

//Handler to be called as soon as the remote stream becomes available
function gotRemoteStream(event) {
    //Associate the remote video element with the retrieved stream
    remoteVideo.srcObject = event.stream;
    remoteVideo.play();
}

//Handler data channel
function handleDataChannel(event) {
    event.channel.onopen = handleDataChannelOpen;
    event.channel.onmessage = handleDataChannelMessage;
    event.channel.onclose = handleDataChannelClose;
}

function handleDataChannelOpen(event) {
    console.log("DataChannel open")
    message.disabled = false;
    sendMessageButton.disabled = false;
}

function handleDataChannelMessage(event) {
    console.log("DataChannel message");
    chat.textContent += '* ' + event.data + '\n';
}

function handleDataChannelClose(event) {
    console.log("DataChannel close")
    message.disabled = true;
    sendMessageButton.disabled = true;
}

//-----------------------------------------------------------
//----------------WEB SOCKET COMMUNICATION-------------------
//-----------------------------------------------------------
var websocket = new WebSocket('ws:localhost:9002');

websocket.onopen = function() {
    console.log("Connected");
}

websocket.onmessage = function(message) {
    console.log("Got message: ", message.data);

    var data = JSON.parse(message.data);

    switch (data.type) {
        case "login":
            onLogin(data.success);
            break;
        case "offer":
            onOffer(data.offer, data.source);
            break;
        case "answer":
            onAnswer(data.answer);
            break;
        case "candidate":
            onCandidate(data.candidate);
            break;
        case "leave":
            hangup();
            break;
        default:
            break;
    }
}

websocket.onerror = function(error) {
    console.log("Got error", error);
}

//Send message to server
function send(message) {
    if (remoteUsername.length > 0)
        message.target = remoteUsername;
    websocket.send(JSON.stringify(message));
}

function onLogin(success) {
    if (success == false) {
        alert("Login unsuccesful, please try a different name");
    }else {
    startButton.disabled = true;
    //Create a MediaStream object for local devices
    //It is necessary to view video when page loaded
    navigator.mediaDevices.getUserMedia(constraints)
        .then(successCallback)
        .catch(errorCallback);
    }
}

function successCallback(stream) {
    theStream = stream;
    video.srcObject = stream;
    video.play();
    //Enable call button
    callButton.disabled = false;
}

function errorCallback(error) {
    console.log("navigator.getUserMedia error: ", error);
}

function onOffer(offer, source) {
    startingCallCommunication();

    remoteUsername = source;
    localPeerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    localPeerConnection.createAnswer(createAnswerSuccess, createAnswerError);
}

function createAnswerSuccess(answer) {
    localPeerConnection.setLocalDescription(answer);
    send({
        type: "answer",
        answer: answer
    });
}

function createAnswerError(error) {
    alert("An error has occurred");
} 

function onAnswer(answer) {
    localPeerConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

function onCandidate(candidate) {
    localPeerConnection.addIceCandidate(new RTCIceCandidate(candidate));
}
