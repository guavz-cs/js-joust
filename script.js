/*
=========================================================
JOUST ARENA
Browser-based motion multiplayer game
=========================================================
*/


/* =====================================================
   GLOBAL STATE
===================================================== */

let peer = null;

let hostConnection = null;

let isHost = false;

let roomCode = "";

let playerId = "";

let playerName = "";

let connections = {};

let players = {};

let gameStarted = false;

let gameRound = 1;

let motionEnabled = false;

let lastAcceleration = {
    x: 0,
    y: 0,
    z: 0
};

let lastMotionTime = 0;


/*
=========================================================
DOM
=========================================================
*/

const landingScreen =
    document.getElementById("landingScreen");

const hostSetup =
    document.getElementById("hostSetup");

const joinScreen =
    document.getElementById("joinScreen");

const lobbyScreen =
    document.getElementById("lobbyScreen");

const arenaScreen =
    document.getElementById("arenaScreen");

const controllerScreen =
    document.getElementById("controllerScreen");


/*
=========================================================
SCREEN MANAGEMENT
=========================================================
*/

function showScreen(screen) {

    document
        .querySelectorAll(".screen")
        .forEach(s => s.classList.add("hidden"));

    screen.classList.remove("hidden");
}


/*
=========================================================
LANDING BUTTONS
=========================================================
*/

document
    .getElementById("hostBtn")
    .addEventListener("click", () => {

        showScreen(hostSetup);

    });


document
    .getElementById("joinBtn")
    .addEventListener("click", () => {

        showScreen(joinScreen);

    });


document
    .querySelectorAll(".backBtn")
    .forEach(button => {

        button.addEventListener("click", () => {

            showScreen(landingScreen);

        });

    });


/*
=========================================================
GENERATE ROOM CODE
=========================================================
*/

function generateRoomCode() {

    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code = "";

    for (let i = 0; i < 6; i++) {

        code +=
            chars[
                Math.floor(
                    Math.random() * chars.length
                )
            ];

    }

    return code;

}


/*
=========================================================
CREATE HOST
=========================================================
*/

document
    .getElementById("createRoomBtn")
    .addEventListener("click", createRoom);


function createRoom() {

    isHost = true;

    roomCode = generateRoomCode();

    const peerId =
        "JOUST-" + roomCode;

    peer = new Peer(peerId, {

        debug: 1

    });


    peer.on("open", id => {

        console.log(
            "Host created:",
            id
        );

        document
            .getElementById("displayRoomCode")
            .textContent = roomCode;

        document
            .getElementById("bigRoomCode")
            .textContent = roomCode;

        showScreen(lobbyScreen);

    });


    peer.on("connection", connection => {

        handleHostConnection(connection);

    });


    peer.on("error", error => {

        console.error(error);

        alert(
            "Could not create arena. Try again."
        );

    });

}


/*
=========================================================
HOST CONNECTION
=========================================================
*/

function handleHostConnection(connection) {

    const id = connection.peer;

    connections[id] = connection;


    connection.on("open", () => {

        console.log(
            "Player connected:",
            id
        );

    });


    connection.on("data", data => {

        handleHostData(
            connection,
            data
        );

    });


    connection.on("close", () => {

        removePlayer(id);

    });

}


/*
=========================================================
HOST DATA
=========================================================
*/

function handleHostData(connection, data) {

    const id = connection.peer;


    /*
    -----------------------------
    PLAYER JOINED
    -----------------------------
    */

    if (data.type === "join") {

        players[id] = {

            id: id,

            name:
                sanitizeName(
                    data.name
                ),

            alive: true,

            color:
                getPlayerColor(
                    Object.keys(players).length
                ),

            movement: 0

        };


        connection.send({

            type: "joined",

            player: players[id],

            room: roomCode

        });


        broadcastPlayers();

        updateLobby();

    }


    /*
    -----------------------------
    MOTION
    -----------------------------
    */

    if (
        data.type === "motion" &&
        gameStarted
    ) {

        processMotion(
            id,
            data
        );

    }

}


/*
=========================================================
SANITIZE NAME
=========================================================
*/

function sanitizeName(name) {

    return String(name || "PLAYER")
        .replace(/[<>]/g, "")
        .trim()
        .substring(0, 12)
        .toUpperCase() || "PLAYER";

}


/*
=========================================================
PLAYER COLORS
=========================================================
*/

const playerColors = [

    "#ff3131",
    "#00d4ff",
    "#ffd700",
    "#a855f7",
    "#00ff88",
    "#ff7a00",
    "#ff4fd8",
    "#ffffff"

];


function getPlayerColor(index) {

    return playerColors[
        index % playerColors.length
    ];

}


/*
=========================================================
UPDATE LOBBY
=========================================================
*/

function updateLobby() {

    const list =
        document.getElementById(
            "lobbyPlayers"
        );

    list.innerHTML = "";


    Object.values(players)
        .forEach(player => {

            const element =
                document.createElement("div");

            element.className =
                "lobby-player";

            element.style.borderColor =
                player.color;

            element.textContent =
                player.name;

            list.appendChild(element);

        });


    document
        .getElementById("playerCount")
        .textContent =
            Object.keys(players).length;


    document
        .getElementById("startGameBtn")
        .disabled =
            Object.keys(players).length < 2;

}


/*
=========================================================
REMOVE PLAYER
=========================================================
*/

function removePlayer(id) {

    delete connections[id];

    delete players[id];

    broadcastPlayers();

    updateLobby();

    renderArena();

}


/*
=========================================================
BROADCAST PLAYER STATE
=========================================================
*/

function broadcast(message) {

    Object.values(connections)
        .forEach(connection => {

            if (connection.open) {

                connection.send(message);

            }

        });

}


function broadcastPlayers() {

    broadcast({

        type: "players",

        players: players

    });

}


/*
=========================================================
START GAME
=========================================================
*/

document
    .getElementById("startGameBtn")
    .addEventListener(
        "click",
        startGame
    );


function startGame() {

    if (
        Object.keys(players).length < 2
    ) {

        return;

    }


    gameRound++;

    gameStarted = false;


    Object.values(players)
        .forEach(player => {

            player.alive = true;

            player.movement = 0;

        });


    showScreen(arenaScreen);

    renderArena();

    broadcastPlayers();


    startCountdown();

}


/*
=========================================================
COUNTDOWN
=========================================================
*/

function startCountdown() {

    const countdown =
        document.getElementById(
            "countdown"
        );

    let count = 3;


    countdown.style.opacity = 1;

    countdown.textContent = count;


    const interval =
        setInterval(() => {

            count--;

            if (count <= 0) {

                clearInterval(interval);

                countdown.textContent =
                    "GO!";

                setTimeout(() => {

                    countdown.style.opacity =
                        0;

                    beginRound();

                }, 700);

                return;

            }

            countdown.textContent =
                count;

        }, 1000);

}


/*
=========================================================
BEGIN ROUND
=========================================================
*/

function beginRound() {

    gameStarted = true;

    document
        .getElementById("gameMessage")
        .textContent =
            "MOVE CAREFULLY";


    const music =
        document.getElementById("music");

    music.currentTime = 0;

    music.play()
        .catch(error =>
            console.warn(
                "Music blocked:",
                error
            )
        );


    broadcast({

        type: "gameStart",

        round: gameRound

    });

}


/*
=========================================================
MOTION PROCESSING
=========================================================
*/

function processMotion(id, data) {

    const player =
        players[id];

    if (
        !player ||
        !player.alive
    ) {

        return;

    }


    const movement =
        Math.sqrt(
            data.x * data.x +
            data.y * data.y +
            data.z * data.z
        );


    player.movement =
        Math.min(
            movement,
            30
        );


    /*
    ==========================================
    ELIMINATION THRESHOLD
    ==========================================
    */

    const threshold = 13;


    if (movement > threshold) {

        eliminatePlayer(id);

    }


    broadcast({

        type: "movement",

        id: id,

        movement:
            player.movement

    });


    updateArenaStats();

}


/*
=========================================================
ELIMINATE PLAYER
=========================================================
*/

function eliminatePlayer(id) {

    const player =
        players[id];

    if (
        !player ||
        !player.alive
    ) {

        return;

    }


    player.alive = false;


    broadcast({

        type: "eliminated",

        id: id

    });


    renderArena();


    checkWinner();

}


/*
=========================================================
CHECK WINNER
=========================================================
*/

function checkWinner() {

    const alivePlayers =
        Object.values(players)
            .filter(
                player =>
                    player.alive
            );


    if (
        alivePlayers.length === 1
    ) {

        gameStarted = false;


        const winner =
            alivePlayers[0];


        document
            .getElementById("gameMessage")
            .textContent =
                winner.name +
                " WINS!";


        broadcast({

            type: "winner",

            id: winner.id

        });


        document
            .getElementById(
                "resetGameBtn"
            )
            .classList.remove("hidden");

    }

}


/*
=========================================================
ARENA RENDER
=========================================================
*/

function renderArena() {

    const container =
        document.getElementById(
            "arenaPlayers"
        );

    container.innerHTML = "";


    const playerArray =
        Object.values(players);


    const total =
        playerArray.length;


    playerArray.forEach(
        (player, index) => {

            const element =
                document.createElement(
                    "div"
                );


            element.className =
                "arena-player";


            if (!player.alive) {

                element.classList.add(
                    "dead"
                );

            }


            element.style.borderColor =
                player.color;


            element.style.left =
                calculateX(
                    index,
                    total
                ) + "%";


            element.style.top =
                calculateY(
                    index,
                    total
                ) + "%";


            element.textContent =
                player.name;


            container.appendChild(
                element
            );

        }
    );


    updateArenaStats();

}


/*
=========================================================
PLAYER POSITIONS
=========================================================
*/

function calculateX(index, total) {

    if (total === 1)
        return 50;


    const angle =
        (index / total) *
        Math.PI *
        2;


    return 50 +
        Math.cos(angle) * 28;

}


function calculateY(index, total) {

    if (total === 1)
        return 50;


    const angle =
        (index / total) *
        Math.PI *
        2;


    return 50 +
        Math.sin(angle) * 28;

}


/*
=========================================================
ARENA STATS
=========================================================
*/

function updateArenaStats() {

    const alive =
        Object.values(players)
            .filter(
                p => p.alive
            )
            .length;


    document
        .getElementById(
            "aliveCount"
        )
        .textContent =
            alive;

}


/*
=========================================================
RESET GAME
=========================================================
*/

document
    .getElementById(
        "resetGameBtn"
    )
    .addEventListener(
        "click",
        () => {

            document
                .getElementById(
                    "resetGameBtn"
                )
                .classList.add(
                    "hidden"
                );


            showScreen(lobbyScreen);

            updateLobby();

        }
    );


/*
=========================================================
JOIN ARENA
=========================================================
*/

document
    .getElementById("connectBtn")
    .addEventListener(
        "click",
        joinArena
    );


function joinArena() {

    playerName =
        sanitizeName(
            document
                .getElementById(
                    "playerName"
                )
                .value
        );


    roomCode =
        document
            .getElementById(
                "roomCode"
            )
            .value
            .trim()
            .toUpperCase();


    const status =
        document
            .getElementById(
                "joinStatus"
            );


    if (!playerName) {

        status.textContent =
            "ENTER YOUR NAME";

        return;

    }


    if (
        roomCode.length !== 6
    ) {

        status.textContent =
            "ENTER A 6 CHARACTER ROOM CODE";

        return;

    }


    status.textContent =
        "CONNECTING...";


    /*
    -------------------------------
    Create random peer ID
    -------------------------------
    */

    peer =
        new Peer();


    peer.on("open", id => {

        playerId = id;


        hostConnection =
            peer.connect(
                "JOUST-" + roomCode,
                {
                    reliable: true
                }
            );


        hostConnection.on(
            "open",
            () => {

                hostConnection.send({

                    type: "join",

                    name: playerName

                });


                showScreen(
                    controllerScreen
                );


                document
                    .getElementById(
                        "controllerStatus"
                    )
                    .textContent =
                        "CONNECTED";

            }
        );


        hostConnection.on(
            "data",
            handleControllerData
        );


        hostConnection.on(
            "close",
            () => {

                document
                    .getElementById(
                        "controllerStatus"
                    )
                    .textContent =
                        "DISCONNECTED";

            }
        );

    });


    peer.on("error", error => {

        console.error(error);

        status.textContent =
            "COULD NOT CONNECT";

    });

}


/*
=========================================================
CONTROLLER DATA
=========================================================
*/

let controllerPlayer = null;


function handleControllerData(data) {


    /*
    -----------------------------
    JOIN CONFIRMED
    -----------------------------
    */

    if (data.type === "joined") {

        controllerPlayer =
            data.player;


        document
            .getElementById(
                "controllerPlayerName"
            )
            .textContent =
                controllerPlayer.name;

    }


    /*
    -----------------------------
    GAME START
    -----------------------------
    */

    if (data.type === "gameStart") {

        showControllerState(
            "controllerPlaying"
        );

    }


    /*
    -----------------------------
    ELIMINATED
    -----------------------------
    */

    if (data.type === "eliminated") {

        if (
            data.id === playerId
        ) {

            showControllerState(
                "controllerEliminated"
            );

        }

    }


    /*
    -----------------------------
    WINNER
    -----------------------------
    */

    if (data.type === "winner") {

        if (
            data.id === playerId
        ) {

            showControllerState(
                "controllerWinner"
            );

        }

    }


    /*
    -----------------------------
    PLAYER STATE
    -----------------------------
    */

    if (data.type === "players") {

        if (
            controllerPlayer &&
            data.players[playerId]
        ) {

            controllerPlayer =
                data.players[playerId];

        }

    }

}


/*
=========================================================
CONTROLLER STATE
=========================================================
*/

function showControllerState(id) {

    document
        .querySelectorAll(
            ".controllerState"
        )
        .forEach(
            state =>
                state.classList.add(
                    "hidden"
                )
        );


    document
        .getElementById(id)
        .classList.remove(
            "hidden"
        );

}


/*
=========================================================
MOTION PERMISSION
=========================================================
*/

document
    .getElementById(
        "motionPermissionBtn"
    )
    .addEventListener(
        "click",
        enableMotion
    );


async function enableMotion() {

    try {

        /*
        iOS requires permission.
        */

        if (
            typeof DeviceMotionEvent !==
            "undefined" &&
            typeof DeviceMotionEvent
                .requestPermission ===
                "function"
        ) {

            const permission =
                await DeviceMotionEvent
                    .requestPermission();


            if (
                permission !== "granted"
            ) {

                alert(
                    "Motion permission is required."
                );

                return;

            }

        }


        window.addEventListener(
            "devicemotion",
            handleMotion,
            true
        );


        motionEnabled = true;


        document
            .getElementById(
                "motionPermissionBtn"
            )
            .textContent =
                "MOTION ENABLED";


        document
            .getElementById(
                "controllerStatus"
            )
            .textContent =
                "READY";


    } catch (error) {

        console.error(error);

        alert(
            "Motion sensors could not be enabled."
        );

    }

}


/*
=========================================================
PHONE MOTION
=========================================================
*/

function handleMotion(event) {

    if (!hostConnection)
        return;


    const acceleration =
        event.accelerationIncludingGravity;


    if (!acceleration)
        return;


    const x =
        acceleration.x || 0;

    const y =
        acceleration.y || 0;

    const z =
        acceleration.z || 0;


    /*
    Smooth the movement.
    */

    const smoothing = 0.65;


    const smoothX =
        lastAcceleration.x * smoothing +
        x * (1 - smoothing);

    const smoothY =
        lastAcceleration.y * smoothing +
        y * (1 - smoothing);

    const smoothZ =
        lastAcceleration.z * smoothing +
        z * (1 - smoothing);


    const deltaX =
        Math.abs(
            smoothX -
            lastAcceleration.x
        );

    const deltaY =
        Math.abs(
            smoothY -
            lastAcceleration.y
        );

    const deltaZ =
        Math.abs(
            smoothZ -
            lastAcceleration.z
        );


    const movement =
        deltaX +
        deltaY +
        deltaZ;


    lastAcceleration = {

        x: smoothX,

        y: smoothY,

        z: smoothZ

    };


    /*
    Update visual meter.
    */

    const visualMovement =
        Math.min(
            movement * 12,
            100
        );


    const movementBar =
        document
            .getElementById(
                "movementBar"
            );


    movementBar.style.width =
        visualMovement + "%";


    /*
    Send movement to host.
    */

    const now =
        Date.now();


    if (
        now - lastMotionTime >
        60
    ) {

        lastMotionTime = now;


        hostConnection.send({

            type: "motion",

            x: deltaX,

            y: deltaY,

            z: deltaZ

        });

    }

}


/*
=========================================================
KEYBOARD TEST MODE
=========================================================
*/

/*
This lets you test the game on one computer
without needing phones.

Press SPACE while playing to simulate movement.
*/

window.addEventListener(
    "keydown",
    event => {

        if (
            event.code !== "Space"
        )
            return;


        if (
            !isHost &&
            hostConnection
        ) {

            hostConnection.send({

                type: "motion",

                x: 8,

                y: 8,

                z: 8

            });

        }

    }
);


/*
=========================================================
INITIALIZE
=========================================================
*/

console.log(
    "%c⚔ JOUST ARENA READY",
    "font-size:20px;font-weight:bold"
);