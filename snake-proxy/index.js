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
var getStartingStateResponse = null;
var getNextStateResponse = null;
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
    }
    updateState(snakeJSON) {
        this.snakeJSON = snakeJSON;
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
    get coords () {
        return _.get(this.snakeJSON, 'coords');
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
        var player = _.get(this, 'player');
        if (player) {
            this.drawPlayer();
        }
    }
    drawPlayer () {
        this.drawSnake(this.player, 5);
    }
    drawSnake (snake, color) {
        let coords = _.get(snake, "coords");
        coords.map((xy, i) => {
            let hue = 0;
            if (i == 0) {
                hue = 1;
            }
            this.drawPixel(xy, color + hue);
        });
    }
    drawPixel(xy, color) {
        var x, y;
        [x, y] = xy;
        this.board[y][x] = color;
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
    if (setMoveResponse) { // If the game is being restarted, reply to the setmove and inform the AI of failure.
        setMoveResponse(getState());
        setMoveResponse = null;
    }
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
    if (getStartingStateResponse) {
        getStartingStateResponse(getState());
        getStartingStateResponse = null;
    }
    if (getNextStateResponse) {
        getNextStateResponse(getState());
        getNextStateResponse = null;
    }
    moveResponse = res;
    waitingForSnakeMove = true;
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
            waitingForSnakeMove = false;
            moveResponse({
                move: gameInstance.player.move,
                taunt: "Boop the snoot!",
            });
            moveResponse = null;
        } else {
            //res(getState());
        }
    }
    res({success:true});
}

function getStartingState(data, res) {
    getStartingStateResponse = res;
}

/**
 * /get-state
 * @returns {{gameState: *, waitingForSnakeMove: boolean, count: number}}
 */
function getState() {
    console.log("get-state");
    return {
        board: _.get(gameInstance, "board"),
        waitingForSnakeMove: waitingForSnakeMove,
        count: count,
    }
}

function getNextState(res) {
    getNextStateResponse = res;
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
        res.setHeader('Content-Type', 'application/json');
        try {
            body = JSON.parse(Buffer.concat(body).toString());
        } catch (e) {
            body = null;
        }
        //console.log(body);
        if (req.url === '/start') message = start(body);
        if (req.url === '/move') {
            move(body, respond);
            return;
        }
        if (req.url === '/get-starting-state') {
            getStartingState(body, respond);
            return;
        }
        if (req.url === '/set-move') {
            setMove(body, respond);
            return;
        }
        if (req.url === '/get-state') {
            getNextState(respond);
            return;
        }
        respond(message);
    });

    function respond(message) {
        res.end(JSON.stringify(message));
    }
}).listen(8888, "0.0.0.0");
