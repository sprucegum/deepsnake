/**
 * Created by jadel on 2/24/17.
 */
const http = require('http');
const _ = require('lodash');

var count = 0;
var gameState = null;
var nextMove = "up";
var waitingForSnakeMove = false;
var gameInstance = null;

class SnakeModel {
    constructor(snakeJSON, gameModel) {
        this.gameModel = gameModel;
        this.snakeJSON = snakeJSON;
        this.name = _.get(snakeJSON, 'name');
        this.id = _.get(snakeJSON, 'id');
        this.coords = null;
    }
    updateState(snakeJSON) {
        this.gameModel = gameModel;
        this.snakeJSON = snakeJSON;
        this.coords = _.get(snakeJSON, 'coords');
        console.log("snakeCoords", this.coords);
    }

}

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
        for (var i = 0; i < this.height; i++) {
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
}

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

function move(data) {
    if (!gameInstance) {
        gameInstance = new GameModel(data);
    }
    gameInstance.updateState(data);
    console.log("move", count++, data , _.get(data, "test"));
    var move = nextMove;
    if (waitingForSnakeMove) {
        // if the control AI hasn't responded, then let's use a fallback AI.
    }
    waitingForSnakeMove = true;
    return {
        move: nextMove,
        taunt: "Boop the snoot!",
    };
}

function setMove(data) {
    var d = _.get(data, "d");
    console.log("set-move", data, d);
    waitingForSnakeMove = false;
    nextMove = d;
}

function getState() {
    return {
        gameState: gameState,
        gameUpdated: waitingForSnakeMove
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
        body = JSON.parse(Buffer.concat(body).toString());
        //console.log(body);
        if (req.url === '/start') message = start(body);
        if (req.url === '/move') message = move(body);
        if (req.url === '/set-move') message = setMove(body);
        if (req.url === '/get-state') message = getState(body);
        return respond(message);
    });

    function respond(message) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(message));
    }
}).listen(8888, "0.0.0.0");
