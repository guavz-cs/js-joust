const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();

app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});


/* =====================================================
   CONFIGURATION
===================================================== */

const PORT = process.env.PORT || 3000;

const MAX_PLAYERS = 8;

const MOTION_THRESHOLD = 13;


/* =====================================================
   ROOMS
===================================================== */

const rooms = new Map();


/*
Room structure:

{
    code: "ABC123",

    hostId: "socket-id",

    state: "lobby",

    round: 0,

    players: Map()
}

Player:

{
    id,
    name,
    alive,
    movement,
    color
}
*/


/* =====================================================
   PLAYER COLORS
===================================================== */

const COLORS = [
    "#ff3131",
    "#00d4ff",
    "#ffd700",
    "#a855f7",
    "#00ff88",
    "#ff7a00",
    "#ff4fd8",
    "#ffffff"
];


/* =====================================================
   HEALTH CHECK
===================================================== */

app.get("/", (req, res) => {

    res.json({
        status: "online",
        game: "Joust Arena"
    });

});


app.get("/health", (req, res) => {

    res.json({
        status: "ok"
    });

});


/* =====================================================
   GENERATE ROOM CODE
===================================================== */

function generateRoomCode() {

    const characters =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code;

    do {

        code = "";

        for (let i = 0; i < 6; i++) {

            code += characters[
                Math.floor(
                    Math.random() * characters.length
                )
            ];

        }

    } while (rooms.has(code));

    return code;

}


/* =====================================================
   SANITIZE PLAYER NAME
===================================================== */

function cleanName(name) {

    return String(name || "")
        .replace(/[<>]/g, "")
        .trim()
        .substring(0, 14)
        .toUpperCase();

}


/* =====================================================
   GET ROOM PLAYERS
===================================================== */

function getPlayers(room) {

    return Array.from(room.players.values());

}


/* =====================================================
   SEND ROOM STATE
===================================================== */

function broadcastRoom(room) {

    io.to(room.code).emit(
        "roomState",
        {
            code: room.code,

            state: room.state,

            round: room.round,

            players: getPlayers(room)
        }
    );

}


/* =====================================================
   FIND PLAYER
===================================================== */

function findPlayer(room, socketId) {

    return room.players.get(socketId);

}


/* =====================================================
   SOCKET CONNECTION
===================================================== */

io.on("connection", (socket) => {

    console.log(
        "Client connected:",
        socket.id
    );


    /* =================================================
       CREATE ROOM
    ================================================= */

    socket.on("createRoom", (callback) => {

        const code =
            generateRoomCode();


        const room = {

            code,

            hostId: socket.id,

            state: "lobby",

            round: 0,

            players: new Map()

        };


        rooms.set(code, room);

        socket.join(code);

        socket.data.roomCode = code;

        socket.data.role = "host";


        console.log(
            `Room ${code} created`
        );


        callback({

            success: true,

            code

        });


        broadcastRoom(room);

    });


    /* =================================================
       JOIN ROOM
    ================================================= */

    socket.on(
        "joinRoom",
        ({ code, name }, callback) => {

            code =
                String(code || "")
                    .trim()
                    .toUpperCase();


            name =
                cleanName(name);


            const room =
                rooms.get(code);


            if (!room) {

                callback({

                    success: false,

                    message:
                        "Room does not exist."

                });

                return;

            }


            if (room.state !== "lobby") {

                callback({

                    success: false,

                    message:
                        "Game has already started."

                });

                return;

            }


            if (
                room.players.size >=
                MAX_PLAYERS
            ) {

                callback({

                    success: false,

                    message:
                        "Room is full."

                });

                return;

            }


            if (!name) {

                callback({

                    success: false,

                    message:
                        "Enter your name."

                });

                return;

            }


            const duplicate =
                getPlayers(room)
                    .some(
                        player =>
                            player.name === name
                    );


            if (duplicate) {

                callback({

                    success: false,

                    message:
                        "That name is already taken."

                });

                return;

            }


            const player = {

                id: socket.id,

                name,

                alive: true,

                movement: 0,

                color:
                    COLORS[
                        room.players.size %
                        COLORS.length
                    ]

            };


            room.players.set(
                socket.id,
                player
            );


            socket.join(code);

            socket.data.roomCode = code;

            socket.data.role = "player";


            callback({

                success: true,

                player,

                code

            });


            broadcastRoom(room);


            console.log(
                `${name} joined ${code}`
            );

        }
    );


    /* =================================================
       START GAME
    ================================================= */

    socket.on(
        "startGame",
        ({ code }, callback) => {

            const room =
                rooms.get(code);


            if (!room) {

                callback({

                    success: false,

                    message:
                        "Room does not exist."

                });

                return;

            }


            if (
                room.hostId !==
                socket.id
            ) {

                callback({

                    success: false,

                    message:
                        "Only the host can start the game."

                });

                return;

            }


            if (room.players.size < 2) {

                callback({

                    success: false,

                    message:
                        "At least two players are required."

                });

                return;

            }


            room.round++;

            room.state = "countdown";


            room.players.forEach(
                player => {

                    player.alive = true;

                    player.movement = 0;

                }
            );


            broadcastRoom(room);


            io.to(code).emit(
                "countdown",
                {
                    seconds: 3
                }
            );


            setTimeout(() => {

                /*
                Make sure the room still exists
                and wasn't reset.
                */

                if (
                    !rooms.has(code)
                ) {
                    return;
                }


                room.state = "playing";


                io.to(code).emit(
                    "gameStarted",
                    {
                        round: room.round
                    }
                );


                broadcastRoom(room);

            }, 3500);


            callback({

                success: true

            });

        }
    );


    /* =================================================
       PLAYER MOTION
    ================================================= */

    socket.on(
        "motion",
        ({ x, y, z }) => {

            const roomCode =
                socket.data.roomCode;


            if (!roomCode) {
                return;
            }


            const room =
                rooms.get(roomCode);


            if (!room) {
                return;
            }


            if (
                room.state !==
                "playing"
            ) {
                return;
            }


            const player =
                findPlayer(
                    room,
                    socket.id
                );


            if (!player) {
                return;
            }


            if (!player.alive) {
                return;
            }


            x = Number(x) || 0;
            y = Number(y) || 0;
            z = Number(z) || 0;


            const movement =
                Math.sqrt(
                    x * x +
                    y * y +
                    z * z
                );


            player.movement =
                Math.min(
                    movement,
                    100
                );


            /*
            Tell everyone how much
            this player moved.
            */

            io.to(roomCode).emit(
                "playerMovement",
                {
                    id: player.id,

                    movement:
                        player.movement
                }
            );


            /*
            Eliminate player if movement
            exceeds the threshold.
            */

            if (
                movement >=
                MOTION_THRESHOLD
            ) {

                eliminatePlayer(
                    room,
                    player.id
                );

            }

        }
    );


    /* =================================================
       RESET ROUND
    ================================================= */

    socket.on(
        "resetRound",
        ({ code }, callback) => {

            const room =
                rooms.get(code);


            if (!room) {

                callback?.({

                    success: false

                });

                return;

            }


            if (
                room.hostId !==
                socket.id
            ) {

                callback?.({

                    success: false

                });

                return;

            }


            room.state = "lobby";


            room.players.forEach(
                player => {

                    player.alive = true;

                    player.movement = 0;

                }
            );


            broadcastRoom(room);


            callback?.({

                success: true

            });

        }
    );


    /* =================================================
       ELIMINATE PLAYER
    ================================================= */

    function eliminatePlayer(
        room,
        playerId
    ) {

        const player =
            room.players.get(
                playerId
            );


        if (
            !player ||
            !player.alive
        ) {
            return;
        }


        player.alive = false;


        console.log(
            `${player.name} eliminated`
        );


        io.to(room.code).emit(
            "playerEliminated",
            {
                id: player.id,

                name: player.name
            }
        );


        broadcastRoom(room);


        checkWinner(room);

    }


    /* =================================================
       CHECK WINNER
    ================================================= */

    function checkWinner(room) {

        const alivePlayers =
            getPlayers(room)
                .filter(
                    player =>
                        player.alive
                );


        if (
            alivePlayers.length !== 1
        ) {
            return;
        }


        const winner =
            alivePlayers[0];


        room.state = "finished";


        io.to(room.code).emit(
            "gameWinner",
            {
                id: winner.id,

                name: winner.name
            }
        );


        broadcastRoom(room);


        console.log(
            `${winner.name} wins room ${room.code}`
        );

    }


    /* =================================================
       DISCONNECT
    ================================================= */

    socket.on("disconnect", () => {

        console.log(
            "Disconnected:",
            socket.id
        );


        const roomCode =
            socket.data.roomCode;


        if (!roomCode) {
            return;
        }


        const room =
            rooms.get(roomCode);


        if (!room) {
            return;
        }


        /*
        Host disconnected.
        */

        if (
            room.hostId ===
            socket.id
        ) {

            io.to(roomCode).emit(
                "roomClosed"
            );


            rooms.delete(roomCode);

            console.log(
                `Room ${roomCode} closed`
            );

            return;

        }


        /*
        Player disconnected.
        */

        room.players.delete(
            socket.id
        );


        broadcastRoom(room);


        /*
        If only one player remains,
        determine winner.
        */

        if (
            room.state ===
            "playing"
        ) {

            checkWinner(room);

        }

    });

});


/* =====================================================
   START SERVER
===================================================== */

server.listen(
    PORT,
    () => {

        console.log(
            `Joust server running on port ${PORT}`
        );

    }
);