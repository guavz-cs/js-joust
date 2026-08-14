/* =====================================================
   CONFIGURATION
====================================================== */

/*
CHANGE THIS AFTER DEPLOYING YOUR BACKEND.

Example:

const BACKEND_URL =
    "https://joust-backend.onrender.com";
*/

const BACKEND_URL =
    "https://YOUR-BACKEND-NAME.onrender.com";


/* =====================================================
   SOCKET
====================================================== */

let socket = null;


/* =====================================================
   GAME STATE
====================================================== */

let role = null;

let roomCode = null;

let myPlayer = null;

let players = {};

let motionEnabled = false;

let gameRunning = false;


/* =====================================================
   MOTION
====================================================== */

let previousAcceleration = {
    x: 0,
    y: 0,
    z: 0
};

let lastMotionSent = 0;


/* =====================================================
   SCREENS
====================================================== */

const homeScreen =
    document.getElementById(
        "homeScreen"
    );

const hostScreen =
    document.getElementById(
        "hostScreen"
    );

const joinScreen =
    document.getElementById(
        "joinScreen"
    );

const controllerScreen =
    document.getElementById(
        "controllerScreen"
    );

const gameScreen =
    document.getElementById(
        "gameScreen"
    );


/* =====================================================
   SCREEN SWITCHING
====================================================== */

function showScreen(screen) {

    document
        .querySelectorAll(".screen")
        .forEach(
            element =>
                element.classList.add(
                    "hidden"
                )
        );


    screen.classList.remove(
        "hidden"
    );

}


/* =====================================================
   CONNECT SOCKET
====================================================== */

function connectSocket() {

    if (socket) {

        return;

    }


    if (
        BACKEND_URL.includes(
            "YOUR-BACKEND"
        )
    ) {

        alert(
            "You need to put your Render backend URL in app.js first."
        );

        return null;

    }


    socket =
        io(
            BACKEND_URL,
            {
                transports: [
                    "websocket",
                    "polling"
                ]
            }
        );


    socket.on(
        "connect",
        () => {

            console.log(
                "Connected:",
                socket.id
            );

        }
    );


    socket.on(
        "connect_error",
        error => {

            console.error(
                "Socket connection error:",
                error
            );

            showError(
                "homeError",
                "Cannot connect to game server."
            );

        }
    );


    socket.on(
        "disconnect",
        () => {

            console.log(
                "Disconnected"
            );

        }
    );


    registerSocketEvents();


    return socket;

}


/* =====================================================
   CREATE ARENA
====================================================== */

document
    .getElementById("createBtn")
    .addEventListener(
        "click",
        createArena
    );


function createArena() {

    clearError(
        "homeError"
    );


    const connection =
        connectSocket();


    if (!connection) {

        return;

    }


    role = "host";


    const button =
        document.getElementById(
            "createBtn"
        );


    button.disabled = true;

    button.textContent =
        "CONNECTING...";


    /*
    Wait until Socket.IO is connected.
    */

    if (socket.connected) {

        sendCreateRoom();

    } else {

        socket.once(
            "connect",
            sendCreateRoom
        );

    }

}


function sendCreateRoom() {

    socket.emit(
        "createRoom",
        response => {

            const button =
                document.getElementById(
                    "createBtn"
                );


            button.disabled = false;

            button.textContent =
                "CREATE ARENA";


            if (
                !response.success
            ) {

                showError(
                    "homeError",
                    "Could not create arena."
                );

                return;

            }


            roomCode =
                response.code;


            document
                .getElementById(
                    "roomCodeDisplay"
                )
                .textContent =
                    roomCode;


            showScreen(
                hostScreen
            );

        }
    );

}


/* =====================================================
   JOIN SCREEN
====================================================== */

document
    .getElementById("showJoinBtn")
    .addEventListener(
        "click",
        () => {

            clearError(
                "joinError"
            );

            showScreen(
                joinScreen
            );

        }
    );


document
    .getElementById("backBtn")
    .addEventListener(
        "click",
        () => {

            showScreen(
                homeScreen
            );

        }
    );


/* =====================================================
   JOIN ARENA
====================================================== */

document
    .getElementById("joinBtn")
    .addEventListener(
        "click",
        joinArena
    );


function joinArena() {

    clearError(
        "joinError"
    );


    const name =
        document
            .getElementById(
                "nameInput"
            )
            .value
            .trim()
            .toUpperCase();


    const code =
        document
            .getElementById(
                "codeInput"
            )
            .value
            .trim()
            .toUpperCase();


    if (!name) {

        showError(
            "joinError",
            "Enter your name."
        );

        return;

    }


    if (code.length !== 6) {

        showError(
            "joinError",
            "Enter the 6-character room code."
        );

        return;

    }


    const connection =
        connectSocket();


    if (!connection) {

        return;

    }


    const button =
        document.getElementById(
            "joinBtn"
        );


    button.disabled = true;

    button.textContent =
        "CONNECTING...";


    function sendJoin() {

        socket.emit(
            "joinRoom",
            {
                code,
                name
            },
            response => {

                button.disabled =
                    false;

                button.textContent =
                    "JOIN";


                if (
                    !response.success
                ) {

                    showError(
                        "joinError",
                        response.message
                    );

                    return;

                }


                roomCode =
                    response.code;


                myPlayer =
                    response.player;


                document
                    .getElementById(
                        "controllerName"
                    )
                    .textContent =
                        myPlayer.name;


                showScreen(
                    controllerScreen
                );

            }
        );

    }


    if (socket.connected) {

        sendJoin();

    } else {

        socket.once(
            "connect",
            sendJoin
        );

    }

}


/* =====================================================
   SOCKET EVENTS
====================================================== */

function registerSocketEvents() {


    socket.on(
        "roomState",
        data => {

            roomCode =
                data.code;


            players = {};


            data.players.forEach(
                player => {

                    players[
                        player.id
                    ] = player;

                }
            );


            if (
                role === "host"
            ) {

                updateHostLobby();

            }


            if (
                role === "player"
            ) {

                updateControllerState(
                    data
                );

            }


            updateArena(
                data
            );

        }
    );


    socket.on(
        "countdown",
        data => {

            if (
                role === "host"
            ) {

                showScreen(
                    gameScreen
                );

            }


            if (
                role === "player"
            ) {

                showController(
                    "waiting"
                );

            }


            startCountdown(
                data.seconds
            );

        }
    );


    socket.on(
        "gameStarted",
        data => {

            gameRunning = true;


            document
                .getElementById(
                    "roundNumber"
                )
                .textContent =
                    data.round;


            if (
                role === "host"
            ) {

                showScreen(
                    gameScreen
                );

            }


            if (
                role === "player"
            ) {

                showController(
                    "playing"
                );

            }


            document
                .getElementById(
                    "gameMessage"
                )
                .textContent =
                    "STAY ALIVE";

        }
    );


    socket.on(
        "playerMovement",
        data => {

            updateMovement(
                data
            );

        }
    );


    socket.on(
        "playerEliminated",
        data => {

            if (
                data.id ===
                myPlayer?.id
            ) {

                gameRunning =
                    false;

                showController(
                    "dead"
                );

            }


            renderArena();

        }
    );


    socket.on(
        "gameWinner",
        data => {

            gameRunning =
                false;


            if (
                data.id ===
                myPlayer?.id
            ) {

                showController(
                    "winner"
                );

            }


            document
                .getElementById(
                    "gameMessage"
                )
                .textContent =
                    `${data.name} WINS!`;


            document
                .getElementById(
                    "newRoundBtn"
                )
                .classList.remove(
                    "hidden"
                );

        }
    );


    socket.on(
        "roomClosed",
        () => {

            alert(
                "The host has closed the arena."
            );


            location.reload();

        }
    );

}


/* =====================================================
   HOST LOBBY
====================================================== */

function updateHostLobby() {

    const list =
        document.getElementById(
            "playersList"
        );


    list.innerHTML = "";


    const playerArray =
        Object.values(players);


    document
        .getElementById(
            "playerCount"
        )
        .textContent =
            playerArray.length;


    playerArray.forEach(
        player => {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "playerCard";


            card.style.borderColor =
                player.color;


            card.textContent =
                player.name;


            list.appendChild(
                card
            );

        }
    );


    document
        .getElementById(
            "startBtn"
        )
        .disabled =
            playerArray.length < 2;

}


/* =====================================================
   START GAME
====================================================== */

document
    .getElementById("startBtn")
    .addEventListener(
        "click",
        () => {

            clearError(
                "hostError"
            );


            socket.emit(
                "startGame",
                {
                    code: roomCode
                },
                response => {

                    if (
                        !response.success
                    ) {

                        showError(
                            "hostError",
                            response.message
                        );

                    }

                }
            );

        }
    );


/* =====================================================
   COUNTDOWN
====================================================== */

function startCountdown(seconds) {

    const countdown =
        document.getElementById(
            "countdown"
        );


    countdown.classList.remove(
        "hidden"
    );


    let current =
        seconds;


    countdown.textContent =
        current;


    const timer =
        setInterval(
            () => {

                current--;


                if (
                    current <= 0
                ) {

                    clearInterval(
                        timer
                    );


                    countdown.textContent =
                        "GO!";


                    setTimeout(
                        () => {

                            countdown.classList.add(
                                "hidden"
                            );

                        },
                        600
                    );


                    return;

                }


                countdown.textContent =
                    current;

            },
            1000
        );

}


/* =====================================================
   CONTROLLER
====================================================== */

function updateControllerState(data) {

    if (!myPlayer) {
        return;
    }


    const updated =
        data.players.find(
            player =>
                player.id ===
                myPlayer.id
        );


    if (!updated) {
        return;
    }


    myPlayer =
        updated;


    document
        .getElementById(
            "controllerName"
        )
        .textContent =
            myPlayer.name;

}


function showController(state) {

    document
        .getElementById(
            "controllerWaiting"
        )
        .classList.add(
            "hidden"
        );


    document
        .getElementById(
            "controllerPlaying"
        )
        .classList.add(
            "hidden"
        );


    document
        .getElementById(
            "controllerDead"
        )
        .classList.add(
            "hidden"
        );


    document
        .getElementById(
            "controllerWinner"
        )
        .classList.add(
            "hidden"
        );


    if (
        state === "waiting"
    ) {

        document
            .getElementById(
                "controllerWaiting"
            )
            .classList.remove(
                "hidden"
            );

    }


    if (
        state === "playing"
    ) {

        document
            .getElementById(
                "controllerPlaying"
            )
            .classList.remove(
                "hidden"
            );

    }


    if (
        state === "dead"
    ) {

        document
            .getElementById(
                "controllerDead"
            )
            .classList.remove(
                "hidden"
            );

    }


    if (
        state === "winner"
    ) {

        document
            .getElementById(
                "controllerWinner"
            )
            .classList.remove(
                "hidden"
            );

    }

}


/* =====================================================
   MOTION PERMISSION
====================================================== */

document
    .getElementById(
        "motionBtn"
    )
    .addEventListener(
        "click",
        enableMotion
    );


async function enableMotion() {

    try {

        /*
        iPhone/iPad requires permission.
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
                permission !==
                "granted"
            ) {

                alert(
                    "Motion permission was denied."
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
                "motionBtn"
            )
            .textContent =
                "MOTION ENABLED";


        document
            .getElementById(
                "motionBtn"
            )
            .disabled =
                true;


        document
            .getElementById(
                "controllerConnection"
            )
            .textContent =
                "READY";

    } catch (error) {

        console.error(
            error
        );


        alert(
            "Could not enable motion sensors."
        );

    }

}


/* =====================================================
   DEVICE MOTION
====================================================== */

function handleMotion(event) {

    if (
        !motionEnabled ||
        !socket ||
        !socket.connected ||
        !gameRunning
    ) {

        return;

    }


    const acceleration =
        event.accelerationIncludingGravity;


    if (!acceleration) {
        return;
    }


    const x =
        acceleration.x || 0;

    const y =
        acceleration.y || 0;

    const z =
        acceleration.z || 0;


    /*
    Calculate change from previous
    acceleration.
    */

    const dx =
        x -
        previousAcceleration.x;


    const dy =
        y -
        previousAcceleration.y;


    const dz =
        z -
        previousAcceleration.z;


    previousAcceleration = {

        x,
        y,
        z

    };


    const movement =
        Math.sqrt(
            dx * dx +
            dy * dy +
            dz * dz
        );


    /*
    Update visual movement meter.
    */

    const visual =
        Math.min(
            movement * 15,
            100
        );


    document
        .getElementById(
            "movementBar"
        )
        .style.width =
            `${visual}%`;


    /*
    Don't spam the server.
    */

    const now =
        Date.now();


    if (
        now -
        lastMotionSent <
        50
    ) {

        return;

    }


    lastMotionSent =
        now;


    socket.emit(
        "motion",
        {
            x: dx,
            y: dy,
            z: dz
        }
    );

}


/* =====================================================
   MOVEMENT UPDATE
====================================================== */

function updateMovement(data) {

    if (
        !players[data.id]
    ) {

        return;

    }


    players[data.id].movement =
        data.movement;


    renderArena();

}


/* =====================================================
   ARENA
====================================================== */

function updateArena(data) {

    if (
        role !== "host"
    ) {

        return;

    }


    if (
        data.state === "playing" ||
        data.state === "countdown" ||
        data.state === "finished"
    ) {

        showScreen(
            gameScreen
        );

    }


    renderArena();

}


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
                "arenaPlayer";


            if (
                !player.alive
            ) {

                element.classList.add(
                    "dead"
                );

            }


            element.style.borderColor =
                player.color;


            const position =
                getPlayerPosition(
                    index,
                    total
                );


            element.style.left =
                `${position.x}%`;


            element.style.top =
                `${position.y}%`;


            element.textContent =
                player.name;


            container.appendChild(
                element
            );

        }
    );


    const alive =
        playerArray.filter(
            player =>
                player.alive
        ).length;


    document
        .getElementById(
            "aliveNumber"
        )
        .textContent =
            alive;

}


function getPlayerPosition(
    index,
    total
) {

    if (
        total <= 1
    ) {

        return {
            x: 50,
            y: 50
        };

    }


    const angle =
        (
            index /
            total
        ) *
        Math.PI *
        2;


    return {

        x:
            50 +
            Math.cos(angle) * 28,

        y:
            50 +
            Math.sin(angle) * 28

    };

}


/* =====================================================
   NEW ROUND
====================================================== */

document
    .getElementById(
        "newRoundBtn"
    )
    .addEventListener(
        "click",
        () => {

            socket.emit(
                "resetRound",
                {
                    code: roomCode
                }
            );


            document
                .getElementById(
                    "newRoundBtn"
                )
                .classList.add(
                    "hidden"
                );


            document
                .getElementById(
                    "gameMessage"
                )
                .textContent =
                    "WAITING FOR PLAYERS";

        }
    );


/* =====================================================
   HELPERS
====================================================== */

function showError(
    elementId,
    message
) {

    document
        .getElementById(
            elementId
        )
        .textContent =
            message;

}


function clearError(
    elementId
) {

    document
        .getElementById(
            elementId
        )
        .textContent =
            "";

}


/* =====================================================
   INITIALIZATION
====================================================== */

console.log(
    "⚔ JOUST ARENA LOADED"
);