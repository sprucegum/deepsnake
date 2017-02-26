/**
 * Created by jadel on 2/24/17.
 */
const http = require('http');
const _ = require('lodash');

var count = 0;
var gameState = null;
var waitingForSnakeMove = false;
var gameInstance = null;
var moveResponse = null;
var setMoveResponse = null;
var moveResponseTimeout = null;
var gameTimeout = 5000;

/**
 * The snake and its fallback AI
 */
class SnakeModel {
    constructor(snakeJSON, gameModel) {
        this.gameModel = gameModel;
        this.snakeJSON = snakeJSON;
        this.name = _.get(snakeJSON, 'name');
        this.id = _.get(snakeJSON, 'id');
        this.move = "up";
        this.coords = null;
    }
    updateState(snakeJSON) {
        this.snakeJSON = snakeJSON;
        this.coords = _.get(snakeJSON, 'coords');
        console.log("snakeCoords", this.coords);
    }
    set move(move) {
        this.nextMove = move;
        // insert some kind of safety here.
        return true;
    }
    get move() {
        // maybe do some last minute safety checks here
        return this.nextMove;
    }
}

/**
 * The Game State and functions to transform the gameboard
 */
class GameModel {
    constructor (gameState) {
        this.gameState = gameState;
        this.width = _.get(gameState, 'width');
        this.height = _.get(gameState, 'height');
        this.you = _.get(gameState, 'you');
        this.board = [];
        this.snakes = {};
        this.makeSnakes();
        this.player = _.get(this.snakes, this.you);
        this.populateBoard();
    }
    makeSnakes() {
        var snakes = _.get(this.gameState, 'snakes');
        snakes.map((snake) => {
            this.snakes[snake.id] = new SnakeModel(snake, this);
        });
    }
    updateSnakes() {
        var snakes = _.get(this.gameState, 'snakes');
        snakes.map((snake) => {
            this.snakes[snake.id].updateState(snake);
        });

    }
    wipeBoard() {
        this.board = [];
        for (let i = 0; i < this.height; i++) {
            this.board.push(new Array(this.width).fill(0));
        }
    }
    populateBoard() {
        this.wipeBoard();
        var player = _.get(this.gameState, 'player');
        if (player) {
            console.log("player", player);
        }
    }
    updateState (gameState) {
        this.gameState = gameState;
        this.updateSnakes();
        this.populateBoard();
    }
    get player () {
        return this.snakes[this.playerId];
    }
    set player (player) {
        this.playerId = player.id;
    }
}

/**
 * /start
 * Called when the central server starts the game by hitting our /start endpoint
 * @param game
 * @returns {{name: string, color: string}}
 */
function start(game) {
    gameState = game;
    gameInstance = null;
    waitingForSnakeMove = true;
    count = 0;
    console.log("start", game ,_.get(game, "test"));
    return {
        name: 'SnakeMeat',
        color: '#bb2233',
    }
}

/**
 * /move
 * Called when the central server give us the result of our last action and requests our current move.
 * We have ~200ms to respond
 * @param data
 * @param res
 */
function move(data, res) {
    if (!gameInstance) {
        gameInstance = new GameModel(data);
    }
    gameInstance.updateState(data);
    //console.log("move", count++, data , _.get(data, "test"));
    if (waitingForSnakeMove) {
        // if the control AI hasn't responded, then let's use a fallback AI.
    }
    moveResponse = res;
    if (setMoveResponse) {
        setMoveResponse(getState());
        setMoveResponse = null;
        waitingForSnakeMove = true;
    }
    moveResponseTimeout = setTimeout(() => {
        waitingForSnakeMove = false;
        if (moveResponse) {
            moveResponse({
                move: gameInstance.player.move,
                taunt: "Boop the snoot!",
            });
        }
    }, gameTimeout);
}

/**
 * /set-move
 * @param data
 * @param res
 */
function setMove(data, res) {
    var d = _.get(data, "d");
    console.log("set-move", data, d);
    if (gameInstance) {
        _.set(gameInstance, "player.move", d);
        if (moveResponse && waitingForSnakeMove) {
            clearTimeout(moveResponseTimeout);
            setMoveResponse = res;
            waitingForSnakeMove = false;
            moveResponse({
                move: gameInstance.player.move,
                taunt: "Boop the snoot!",
            });
            moveResponse = null;
        } else {
            res(getState());
        }
    } else {
        res("Game not started");
    }
}

/**
 * /get-state
 * @returns {{gameState: *, waitingForSnakeMove: boolean, count: number}}
 */
function getState() {
    return {
        gameState: _.get(gameInstance, "gameState"),
        waitingForSnakeMove: waitingForSnakeMove,
        count: count
    }
}


/**
 * HTTP Server
 * Boilerplate server to receive and respond to POST requests
 * other requests will be returned immediately with no data
 */
console.log("check");
http.createServer((req, res) => {
    //if (req.method !== 'POST') return respond(); // non-game requests
    let body = [];
    req.on('data', chunk => body.push(chunk));
    req.on('end', () => {
        try {
            body = JSON.parse(Buffer.concat(body).toString());
        } catch (e) {
            respond("Bad Message");
        }
        res.setHeader('Content-Type', 'application/json');
        //console.log(body);
        if (req.url === '/start') message = start(body);
        if (req.url === '/move') {
            move(body, respond);
            return;
        }
        if (req.url === '/set-move') {
            setMove(body, respond);
            return;
        }
        if (req.url === '/get-state') message = getState(body);
        respond(message);
    });

    function respond(message) {
        res.end(JSON.stringify(message));
    }
}).listen(8888, "0.0.0.0");
