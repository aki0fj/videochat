"use strict"; 

// Global Variables
const g_elementCheckboxCamera = document.getElementById( "checkbox_camera" );
const g_elementCheckboxMicrophone = document.getElementById( "checkbox_microphone" );
const g_elementVideoLocal = document.getElementById( "video_local" );
const g_elementVideoRemote = document.getElementById( "video_remote" );
const g_elementAudioRemote = document.getElementById( "audio_remote" );
const g_socket = io.connect();

const g_elementCanvasLocal = document.getElementById( "canvas_local" );
const g_elementCanvasRemote = document.getElementById( "canvas_remote" );
const g_contextLocal = g_elementCanvasLocal.getContext('2d');
const g_contextRemote = g_elementCanvasLocal.getContext('2d');
const g_coverImage = new Image();
g_coverImage.src = 'images/laughing_man.png';

const inputSize = 224;
const scoreThreshold = 0.5;
const g_faceApiOptions = new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold });

let g_rtcPeerConnection = null;

// UI functions

window.onload = function()
{
    console.log( "UI Event : onload start." );

    faceapi.nets.tinyFaceDetector.load('models/')
    faceapi.loadFaceLandmarkModel('models/')

    console.log( "UI Event : onload end." );
}

// Send OfferSDP
function onclickButton_SendOfferSDP()
{
    console.log( "UI Event : 'Send OfferSDP.' button clicked." );

    // onclickButton_CreateOfferSDP()と同様の処理

    if( g_rtcPeerConnection )
    {
        alert( "Connection object already exists." );
        return;
    }

    // RTCPeerConnectionオブジェクトの作成
    console.log( "Call : createPeerConnection()" );
    let rtcPeerConnection = createPeerConnection( g_elementVideoLocal.srcObject );
    g_rtcPeerConnection = rtcPeerConnection;    // グローバル変数に設定

    // OfferSDPの作成
    createOfferSDP( rtcPeerConnection );
}

// Leave Chat
function onclickButton_LeaveChat()
{
    console.log( "UI Event : 'Leave Chat.' button clicked." );

    if( g_rtcPeerConnection )
    {
        console.log( "Call : endPeerConnection()" );
        endPeerConnection( g_rtcPeerConnection );
    }
}

// Camera and Microphone On/Off
function onclickCheckbox_CameraMicrophone()
{
    console.log( "UI Event : Camera/Microphone checkbox clicked." );

    // previous status
    let trackCamera_old = null;
    let trackMicrophone_old = null;
    let bCamera_old = false;
    let bMicrophone_old = false;
    let stream = g_elementVideoLocal.srcObject;
    if( stream )
    {
        trackCamera_old = stream.getVideoTracks()[0];
        if( trackCamera_old )
        {
            bCamera_old = true;
        }
        trackMicrophone_old = stream.getAudioTracks()[0];
        if( trackMicrophone_old )
        {
            bMicrophone_old = true;
        }
    }

    // get checkbox value
    let bCamera_new = false;
    if( g_elementCheckboxCamera.checked )
    {
        bCamera_new = true;
    }
    let bMicrophone_new = false;
    if( g_elementCheckboxMicrophone.checked )
    {
        bMicrophone_new = true;
    }

    // check status
    console.log( "Camera :  %s => %s", bCamera_old, bCamera_new );
    console.log( "Microphoneo : %s = %s", bMicrophone_old, bMicrophone_new );

    if( bCamera_old === bCamera_new && bMicrophone_old === bMicrophone_new )
    {   // status not change
        return;
    }

    // stop media stream track (Canceling the media stream of HTML element does not stop the camera)
    if( trackCamera_old )
    {
        console.log( "Call : trackCamera_old.stop()" );
        trackCamera_old.stop();
    }
    if( trackMicrophone_old )
    {
        console.log( "Call : trackMicrophone_old.stop()" );
        trackMicrophone_old.stop();
    }
    // Canceling the media stream of HTML element
    console.log( "Call : setStreamToElement( Video_Local, null )" );
    setStreamToElement( g_elementVideoLocal, g_elementCanvasLocal, null );

    if( !bCamera_new && !bMicrophone_new )
    {   // both camera and microphone is Off
        return;
    }

    // camera or microphone is On
    console.log( "Call : navigator.mediaDevices.getUserMedia( video=%s, audio=%s )", bCamera_new, bMicrophone_new );
    navigator.mediaDevices.getUserMedia( { video: bCamera_new, audio: bMicrophone_new } )
        .then( ( stream ) =>
        {
            // set the media stream to HTML element
            console.log( "Call : setStreamToElement( Video_Local, stream )" );
            setStreamToElement( g_elementVideoLocal, g_elementCanvasLocal, stream );
        } )
        .catch( ( error ) =>
        {
            console.error( "Error : ", error );
            alert( "Could not start Camera." );
            g_elementCheckboxCamera.checked = false;
            g_elementCheckboxMicrophone.checked = false;
            return;
        } );
}

// Socket.IO functions
g_socket.on(
    "connect",
    () =>
    {
        console.log( "Socket Event : connect" );
    }
);

g_socket.on(
    "signaling",
    ( objData ) =>
    {
        console.log( "Socket Event : signaling" );
        console.log( "- type : ", objData.type );
        console.log( "- data : ", objData.data );

        if( "offer" === objData.type )
        {
            if( g_rtcPeerConnection )
            {
                alert( "Connection object already exists." );
                return;
            }

            console.log( "Call : createPeerConnection()" );
            let rtcPeerConnection = createPeerConnection( g_elementVideoLocal.srcObject );
            g_rtcPeerConnection = rtcPeerConnection;

            console.log( "Call : setOfferSDP_and_createAnswerSDP()" );
            setOfferSDP_and_createAnswerSDP( rtcPeerConnection, objData.data );
        }
        else if( "answer" === objData.type )
        {
            if( !g_rtcPeerConnection )
            {
                alert( "Connection object does not exist." );
                return;
            }

            console.log( "Call : setAnswerSDP()" );
            setAnswerSDP( g_rtcPeerConnection, objData.data );
        }
        else
        {
            console.error( "Unexpected : Socket Event : signaling" );
        }
    }
);

// Data Channel functions

// RTCPeerConnection functions

function createPeerConnection( stream )
{
    let config = { "iceServers": [
            { "urls": "stun:stun.l.google.com:19302" },
            { "urls": "stun:stun1.l.google.com:19302" },
            { "urls": "stun:stun2.l.google.com:19302" },
        ]
    };

    let rtcPeerConnection = new RTCPeerConnection( config );

    setupRTCPeerConnectionEventHandler( rtcPeerConnection );

    if( stream )
    {
        stream.getTracks().forEach( ( track ) =>
        {
            rtcPeerConnection.addTrack( track, stream );
        } );
    }
    else
    {
        console.log( "No local stream." );
    }

    return rtcPeerConnection;
}

function setupRTCPeerConnectionEventHandler( rtcPeerConnection )
{
    // Negotiation needed
    //   see : https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/onnegotiationneeded
    rtcPeerConnection.onnegotiationneeded = () =>
    {
        console.log( "Event : Negotiation needed" );
    };

    // ICE candidate
    //   see : https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/onicecandidate
    rtcPeerConnection.onicecandidate = ( event ) =>
    {
        console.log( "Event : ICE candidate" );
        if( event.candidate )
        {
            console.log( "- ICE candidate : ", event.candidate );

            // Vanilla ICE : do nothing
            // Trickle ICE : Send ICE candidate to the other party
        }
        else
        {
            console.log( "- ICE candidate : empty" );
        }
    };

    // ICE candidate error 
    //   see : https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/onicecandidateerror
    rtcPeerConnection.onicecandidateerror = ( event ) =>
    {
        console.error( "Event : ICE candidate error. error code : ", event.errorCode );
    };

    // ICE gathering state change
    //   see : https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/onicegatheringstatechange
    rtcPeerConnection.onicegatheringstatechange = () =>
    {
        console.log( "Event : ICE gathering state change" );
        console.log( "- ICE gathering state : ", rtcPeerConnection.iceGatheringState );

        if( "complete" === rtcPeerConnection.iceGatheringState )
        {
            // Vanilla ICE : Send Offer SDP / Answer SDP including ICE candidate to the other partyる
            // Trickle ICE : do nothing
            if( "offer" === rtcPeerConnection.localDescription.type )
            {
                console.log( "- Send OfferSDP to server" );
                g_socket.emit( "signaling", { type: "offer", data: rtcPeerConnection.localDescription } );
            }
            else if( "answer" === rtcPeerConnection.localDescription.type )
            {
                console.log( "- Send AnswerSDP to server" );
                g_socket.emit( "signaling", { type: "answer", data: rtcPeerConnection.localDescription } );

            }
            else
            {
                console.error( "Unexpected : Unknown localDescription.type. type = ", rtcPeerConnection.localDescription.type );
            }
        }
    };

    // ICE connection state change
    // - ordinary status change : new -> checking -> connected -> completed
    //   see : https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/iceconnectionstatechange_event
    rtcPeerConnection.oniceconnectionstatechange = () =>
    {
        console.log( "Event : ICE connection state change" );
        console.log( "- ICE connection state : ", rtcPeerConnection.iceConnectionState );
        // see : https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/iceConnectionState
    };

    // Signaling state change 
    //   see : https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/onsignalingstatechange
    rtcPeerConnection.onsignalingstatechange = () =>
    {
        console.log( "Event : Signaling state change" );
        console.log( "- Signaling state : ", rtcPeerConnection.signalingState );
    };

    // Connection state change
    //   see : https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/onconnectionstatechange
    rtcPeerConnection.onconnectionstatechange = () =>
    {
        console.log( "Event : Connection state change" );
        console.log( "- Connection state : ", rtcPeerConnection.connectionState );
        // see : https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/connectionState
        if( "failed" === rtcPeerConnection.connectionState )
        {
            console.log( "Call : endPeerConnection()" );
            endPeerConnection( rtcPeerConnection );
        }
    };

    // Track event hundler
    //   see : https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/ontrack
    rtcPeerConnection.ontrack = ( event ) =>
    {
        console.log( "Event : Track" );
        console.log( "- stream", event.streams[0] );
        console.log( "- track", event.track );

        // set the media stream to HTML element
        let stream = event.streams[0];
        let track = event.track;
        if( "video" === track.kind )
        {
            console.log( "Call : setStreamToElement( Video_Remote, stream )" );
            setStreamToElement( g_elementVideoRemote, g_elementCanvasRemote, stream );
        }
        else if( "audio" === track.kind )
        {
            console.log( "Call : setStreamToElement( Audio_Remote, stream )" );
            setStreamToElement( g_elementAudioRemote, null, stream );
        }
        else
        {
            console.error( "Unexpected : Unknown track kind : ", track.kind );
        }
    };
}

function endPeerConnection( rtcPeerConnection )
{
    // Stop remote video
    console.log( "Call : setStreamToElement( Video_Remote, null )" );
    setStreamToElement( g_elementVideoRemote, null );
    // Stop remote audio
    console.log( "Call : setStreamToElement( Audio_Remote, null )" );
    setStreamToElement( g_elementAudioRemote, null );

    g_rtcPeerConnection = null;

    rtcPeerConnection.close();
}

function createOfferSDP( rtcPeerConnection )
{
    console.log( "Call : rtcPeerConnection.createOffer()" );
    rtcPeerConnection.createOffer()
        .then( ( sessionDescription ) =>
        {
            console.log( "Call : rtcPeerConnection.setLocalDescription()" );
            return rtcPeerConnection.setLocalDescription( sessionDescription );
        } )
        .then( () =>
        {
            // Vanilla ICE : not sent SDP to the other party yet
            // Trickle ICE : Send initial SDP to the other party
        } )
        .catch( ( error ) =>
        {
            console.error( "Error : ", error );
        } );
}

function setOfferSDP_and_createAnswerSDP( rtcPeerConnection, sessionDescription )
{
    console.log( "Call : rtcPeerConnection.setRemoteDescription()" );
    rtcPeerConnection.setRemoteDescription( sessionDescription )
        .then( () =>
        {
            // create AnswerSDP
            console.log( "Call : rtcPeerConnection.createAnswer()" );
            return rtcPeerConnection.createAnswer();
        } )
        .then( ( sessionDescription ) =>
        {
            // set AnswerSDP to LocalDescription
            console.log( "Call : rtcPeerConnection.setLocalDescription()" );
            return rtcPeerConnection.setLocalDescription( sessionDescription );
        } )
        .then( () =>
        {
            // Vanilla ICE : not sent SDP to the other party yet
            // Trickle ICE : Send initial SDP to the other party
        } )
        .catch( ( error ) =>
        {
            console.error( "Error : ", error );
        } );
}

// set AnswerSDP
function setAnswerSDP( rtcPeerConnection, sessionDescription )
{
    console.log( "Call : rtcPeerConnection.setRemoteDescription()" );
    rtcPeerConnection.setRemoteDescription( sessionDescription )
        .catch( ( error ) =>
        {
            console.error( "Error : ", error );
        } );
}

// other internal functions

function setStreamToElement( elementMedia, canvas, stream )
{
    // set the media stream to srcObj of HTML element
    elementMedia.srcObject = stream;

    if( !stream )
    {   // canceling the media stream setting
        return;
    }

    // volume setting
    if( "VIDEO" === elementMedia.tagName )
    {   // VIDEO
        console.log( "Video volume setting" );
        elementMedia.volume = 0.0;
        elementMedia.muted = true;
        elementMedia.onloadedmetadata = function() {
            onPlayVideo(elementMedia, canvas);
        };
    }
    else if( "AUDIO" === elementMedia.tagName )
    {   // AUDIO
        console.log( "Audio volume setting" );
        elementMedia.volume = 1.0;
        elementMedia.muted = false;
    }
    else
    {
        console.error( "Unexpected : Unknown ElementTagName : ", elementMedia.tagName );
    }
}

function onPlayVideo(video, canvas)
{
    if(video.paused || video.ended || !faceapi.nets.tinyFaceDetector.params)
        return setTimeout(() => onPlayVideo(video, canvas))
	    
    const displaySize = { width: video.width, height: video.height };
    const dims = faceapi.matchDimensions(canvas, displaySize)
    setInterval(async () => {
        const results = await faceapi.detectAllFaces(video, g_faceApiOptions)
        if (results.length > 0) {
            const resizedResults = faceapi.resizeResults(results, dims)
            canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
            // faceapi.draw.drawDetections(canvas, resizedResult)
            // faceapi.draw.drawFaceLandmarks(canvas, resizedResult)
            resizedResults.forEach(detection => {
                const marginVal = 0.4;
                const width = detection.box.width;
                const height = detection.box.height * (1.0 + marginVal);
                const x = detection.box.x;
                const y = detection.box.y - detection.box.height * marginVal;
                canvas.getContext("2d").drawImage(g_coverImage, x, y, width, height);
            });
        }
        else
        {
            canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
        }
    }, 100);
}
