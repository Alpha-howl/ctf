
function handleJoinRoomRequest() {
    if( NOT isLoggedIn(request.jwt) ) {
        response.send({
            success: false,
            message: "must-be-logged-in"
        });
        return;
    }
    var username = getUsernameFromJwt(request.jwt);

    var lastRoomId = getLastRoomJoined();
    var lastRoomHasSpace = NOT roomIsFull(lastRoomId);

    var mazeData;
    if(lastRoomHasSpace) {
        // the last room has an empty space - join it
        var roomData = database.RoomTable.get(lastRoomId);
        roomData.joinedPlayers.append(username);
        database.RoomTable.set(lastRoomId, {
            mazeData: roomData.mazeData,
            joinedPlayers: roomData.joinedPlayers,
            preparedPlayers: roomData.preparedPlayers,
            fullyReadyPlayers: roomData.fullyReadyPlayers,
            state: roomData.state,
            startTime: roomData.startTime,
            teamsInfo: roomData.teamsInfo,
            ttl: roomData.ttl // half an hour
        });
        mazeData = roomData.mazeData;
    } else {
        // the room is full, join the next one
        // next room = current room's id + 1:
        lastRoomId += 1;
        // then generate what will be the new room's maze
        mazeData = generateMaze();
        // inside the overflows table, increment the value of overflows
        incrementOverflows();
        // create the record of the new room using all the data described
        // in the ERD
        database.RoomTable.set(lastRoomId, {
            mazeData: mazeData,
            joinedPlayers: [username],
            preparedPlayers: [],
            fullyReadyPlayers: {},
            state: "loading",
            startTime: undefined,
            teamsInfo: undefined,
            ttl: Math.floor(Date.now() / 1000) + 30*60 // half an hour
        });
    }

    // finally report back to the user and send the maze data
    // so the client can display it in a lobby-like manner while
    // waiting for more players to join
    response.send({
        success: true,
        message: "joined-room",
        mazeData: mazeData
    });

}
function handleReadyToPlayRequest() {
    var roomId = request.roomId;
    var roomData = database.RoomTable.get(roomId);
    var username = getUsernameFromJwt(request.jwt);

    if(NOT userIsLoggedIn(request.jwt)) {
        response.send({
            success: false, 
            message: "must-be-logged-in"
        });
        return;
    }

    if(NOT username in roomData.joinedPlayers) {
        // if the user has tampered with the request payload
        // reject their request
        response.send({
            success: false, message: "unknown-error"
        });
        return;
    }
    if(roomData.joinedPlayers.length < MAX_NUMBER_OF_PLAYERS) {
        // not enough players have joined, wait for more
        response.send({
            success: false, 
            message: "waiting-for-players"
        });
        return;
    } else {
        // there are enough players now: create the pubnub channel
        if(NOT username in roomData.preparedPlayers) {
            roomData.preparedPlayers.append(username);
        }

        if(roomData.preparedPlayers.length < MAX_NUMBER_OF_PLAYERS) {
            // some players have not displayed the maze
            response.send({
                success: false, 
                message: "waiting-for-players"
            });
            return;
        } else {
            // enough players are now "prepared"
            // pick teams, generate pubnub and send res. to start game
            var teamsInfo = pickTeams(roomData.preparedPlayers); // todo: define func
            
            var pubnubChannelName = "ctf-room-" + roomId; // eg "ctf-room-19"
            pubnub.subscribe({channels: [pubnubChannelName]}); // from pubnub docs
            pubnub.addListener({
                message: function(receivedMessage) {
                    handlePubNubReceivedMessage(receivedMessage);
                }
            });
            
            response.send({
                success: true,
                message: "start-game",
                pubnubChannelName,
                teamsInfo
            });
        }
    }
}
function handlePubNubReceivedMessage(receivedMessage) {

    var username = getUsernameFromJwt(receivedMessage.message.jwt);
    var roomId = receivedMessage.message.roomId;

    var roomData = database.RoomTable.get(roomId);
    if(NOT username in roomData.preparedPlayers) {
        return;
    }

    if(NOT jwtIsValid(receivedMessage.message.jwt)) {
        return;
    }

    var action = receivedMessage.action;
    switch(action) {
        case "ready-to-play": {
            // client is ready to start playing
            var teamsInfo = roomData.teamsInfo;
            var userTeamInfo = teamsInfo.teamA.players.contains(username) ? 
                ["teamA", teamsInfo.teamA] : ["teamB", teamsInfo.teamB];
            var spawnPoint = userTeamInfo[1].spawnPoint;
            var team = userTeamInfo[0];
            roomData.fullyReadyPlayers[username] = {
                position: spawnPoint, isDead: false, team: team
            }
            var numOfPlayers = Object.keys(roomData.fullyReadyPlayers).length
            if(numOfPlayers == MAX_NUMBER_OF_PLAYERS) {
                PubNub.publish({
                    channel: "ctf-room-" + roomId,
                    message: {message: "start-in-3s"}
                });
                setTimeout(() => {
                    roomData.state = "playing";
                    database.RoomTable.set(roomId, {
                        mazeData: roomData.mazeData,
                        joinedPlayers: roomData.joinedPlayers,
                        preparedPlayers: roomData.preparedPlayers,
                        fullyReadyPlayers: roomData.fullyReadyPlayers,
                        state: roomData.state,
                        startTime: Date.now(),
                        teamsInfo: roomData.teamsInfo,
                        ttl: Math.floor(Date.now() / 1000) + 30*60
                    });
                }, 3200);
            } else {
                database.RoomTable.set(roomId, {
                    mazeData: roomData.mazeData,
                    joinedPlayers: roomData.joinedPlayers,
                    preparedPlayers: roomData.preparedPlayers,
                    fullyReadyPlayers: roomData.fullyReadyPlayers,
                    state: roomData.state,
                    startTime: undefined,
                    teamsInfo: roomData.teamsInfo,
                    ttl: roomData.ttl
                });
            }
            break;
        }
    }
}















































function playOnlineButtonClick() 

    displaySearchingForGameScreen();

    var response = $.ajax("https://.../join-room", {
        method: "POST",
        data: {
            jwt: localStorage.getItem("jwt")
        }
    });

    if(response.message = "must-be-logged-in") 
        // error: user not signed in: display error message
        document.getElementById("sign-in-msg").classList.remove("hidden");
        return;
    endif

    // user is signed in and has joined a room
    // display the maze
    GRID = response.mazeData; // global GRID
    drawMaze(); // do not draw any sprites yet

    var roomId = response.roomId;

    function sendReq()
        return $.ajax("https://.../ready-to-play", {
            method: "POST",
            data: {
                jwt: localStorage.getItem("jwt"),
                roomId: roomId
            }
        });
    endfunc

    var response = sendReq();

    while(response.message = "waiting-for-players") 
        sleep 10 // wait 10 seconds
        response = sendReq();
    endwhile

    if(response.message != "start-game")
        return;
    endif
    

    // if code is still running, the response contains:
    // teamsInfo, pubnubChannelName

    displayTeamsScreen(response.teamsInfo);
    drawSprites(response.teamsInfo);
    
    sessionStorage.setItem("pubnubChannelName", response.pubnubChannelName);
    pubnub.subscribe({channels: [response.pubnubChannelName]});
    pubnub.addListener({
        message: function(receivedMessage) {
            handleClientPubNubReceivedMessage(receivedMessage);
        }
    });
    await pubnub.publish({
        channel: response.pubnubChannelName,
        message: {
            action: "ready-to-play",
            jwt: localStorage.getItem("jwt"),
            roomId: roomId, 
        }
    });
endfunc

function handleClientPubNubReceivedMessage(receivedMessage)
    var action = receivedMessage.message.action;
    switch(action) {
        case "start-in-3s": {
            addArrowKeysEventListeners();
            displayCountdown(3);
            break;
        }
    }
endfunc