const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const videoContainer = document.getElementById('video-container');
const muteAudioBtn = document.getElementById('muteAudio');
const toggleVideoBtn = document.getElementById('toggleVideo');
const chatInput = document.getElementById('chatInput');
const chatWindow = document.getElementById('chatWindow');
const sendChatBtn = document.getElementById('sendChat');
const socket = io('https://web-rtc-njye3y7nw-ramiths-projects-8937ea4c.vercel.app');

let localStream;
let peerConnections = {};

const config = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

// Queue to store ICE candidates until remote description is set
let candidatesQueue = [];

// Get user media
navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
    console.log('getUserMedia: Local stream obtained');
    localStream = stream;
    localVideo.srcObject = stream;

    socket.emit('join', 'room1'); // Join the room

    // Handling incoming signaling messages
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('candidate', handleCandidate);
});

// Handle Offer
async function handleOffer(offer, socketId) {
    console.log('Received offer:', offer);

    if (peerConnections[socketId] && peerConnections[socketId].signalingState === 'stable') {
        console.log('Already in stable state, ignoring the offer');
        return;
    }

    if (!peerConnections[socketId]) {
        peerConnections[socketId] = createPeerConnection(socketId);
    }

    try {
        await peerConnections[socketId].setRemoteDescription(new RTCSessionDescription(offer));
        console.log('Remote description set successfully');

        // Process queued ICE candidates
        processQueuedCandidates(socketId);

        // Create and send answer
        const answer = await peerConnections[socketId].createAnswer();
        await peerConnections[socketId].setLocalDescription(answer);
        console.log('Sending answer:', answer);
        socket.emit('answer', { type: 'answer', sdp: answer.sdp });

    } catch (error) {
        console.error('Error handling offer:', error);
    }
}

// Handle Answer
async function handleAnswer(answer, socketId) {
    console.log('Received answer:', answer);

    if (peerConnections[socketId].signalingState === 'stable') {
        console.log('Already in stable state, ignoring the answer');
        return;
    }

    try {
        await peerConnections[socketId].setRemoteDescription(new RTCSessionDescription(answer));
        console.log('Remote description set with answer');
        
        // Process queued ICE candidates
        processQueuedCandidates(socketId);
    } catch (error) {
        console.error('Error handling answer:', error);
    }
}

// Handle ICE Candidate
async function handleCandidate(candidate, socketId) {
    console.log('Received ICE candidate:', candidate);

    if (peerConnections[socketId].remoteDescription) {
        try {
            await peerConnections[socketId].addIceCandidate(new RTCIceCandidate(candidate));
            console.log('ICE candidate added successfully');
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
        }
    } else {
        console.log('Remote description not set, queuing ICE candidate');
        candidatesQueue.push(candidate); // Queue it for later
    }
}

// Process queued ICE candidates
async function processQueuedCandidates(socketId) {
    while (candidatesQueue.length > 0) {
        const candidate = candidatesQueue.shift();
        try {
            await peerConnections[socketId].addIceCandidate(new RTCIceCandidate(candidate));
            console.log('Processed queued ICE candidate');
        } catch (error) {
            console.error('Error processing queued ICE candidate:', error);
        }
    }
}

// Create peerConnections
function createPeerConnection(socketId) {
    const pc = new RTCPeerConnection(config);

    pc.onicecandidate = event => {
        if (event.candidate) {
            console.log('Sending ICE candidate:', event.candidate);
            socket.emit('candidate', event.candidate);  // Send candidate to other peer
        }
    };

    pc.ontrack = event => {
        console.log('Received remote track:', event);
        // Add new video element

        if (!document.getElementById(socketId)) {
            // Create and append video element only if not already created
            const newVideo = document.createElement('video');
            newVideo.id = socketId;  // Give it an ID to avoid duplication
            newVideo.autoplay = true;
            // Assign remote video stream to it
            newVideo.srcObject = event.streams[0];
            // Append this to video container
            videoContainer.appendChild(newVideo);  // Show remote video stream
        }
    };

    // Add local tracks to peer connection
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    return pc;
}

// Mute/Unmute Audio
muteAudioBtn.addEventListener('click', () => {
    const audioTrack = localStream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
    muteAudioBtn.textContent = audioTrack.enabled ? 'Mute Audio' : 'Unmute Audio';
});

// Toggle Video
toggleVideoBtn.addEventListener('click', () => {
    const videoTrack = localStream.getVideoTracks()[0];
    videoTrack.enabled = !videoTrack.enabled;
    toggleVideoBtn.textContent = videoTrack.enabled ? 'Turn Off Video' : 'Turn On Video';
});

// Chat Feature
sendChatBtn.addEventListener('click', () => {
    const message = chatInput.value;
    if (message) {
        socket.emit('chat', message);
        chatInput.value = '';
        appendMessage(`You: ${message}`);
    }
});

socket.on('chat', message => appendMessage(`Peer: ${message}`));

// Handle new user joining
socket.on('new-user', (socketId) => {
    console.log('New user joined the room');

    if (!peerConnections[socketId]) {
        peerConnections[socketId] = createPeerConnection(socketId);
    }

    peerConnections[socketId].createOffer().then(offer => {
        return peerConnections[socketId].setLocalDescription(offer).then(() => {
            console.log('Sending offer:', offer);
            socket.emit('offer', { type: 'offer', sdp: offer.sdp });  // Send offer
        });
    }).catch(error => {
        console.error('Error creating offer:', error);
    });
});

// Append messages to the chat window
function appendMessage(message) {
    const msgDiv = document.createElement('div');
    msgDiv.textContent = message;
    chatWindow.appendChild(msgDiv);
}
