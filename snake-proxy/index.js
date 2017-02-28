/**
 * Created by jadel on 2/24/17.
 */
const http = require('http');
const _ = require('lodash');
const PF = require('pathfinding');

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
        this.age = 0;
        this.health = _.get(snakeJSON, 'health_points');
        this.prevHealth = this.health;
        this.lastMove = null;
        this.rewardAI = true;
        this.move = "up";
    }
    updateState(snakeJSON) {
        this.lastMove = this.nextMove;
        this.age++;
        this.prevHealth = this.health;
        this.snakeJSON = snakeJSON;
        this.health = _.get(snakeJSON, 'health_points');
    }
    justEaten() {
        return (this.health > this.prevHealth);
    }
    get reward () {
        var r = 1;
        if (this.rewardAI) {
            r += 1;
        }
        r += this.health - this.prevHealth;
        return r;
    }
    set move(move) {
        this.nextMove = move;
        // insert some kind of safety here.
        this.rewardAI = true;
        if (!this.isSafe(this.nextMove)) {
            this.nextMove = this.getSafeDir();
            this.rewardAI = false;
        } else {
            console.log("safe!");
        }
        return true;
    }
    isOpposite(dir1, dir2) {
        console.log("testing is opposide", dir1, dir2);
        return (this.getOpposite(dir1) == dir2)
    }
    getOpposite(dir) {
        let oppositeMap = {
            "up":"down",
            "down":"up",
            "left":"right",
            "right":"left"
        };
        return oppositeMap[dir]
    }
    dirToVector(dir) {
        let dirMap = {
            up : [0, -1],
            down: [0, 1],
            left: [-1, 0],
            right: [1, 0]
        };
        return dirMap[dir];
    }
    isSafe(dir) {
        console.log("testing dir:", dir);
        let c = this.coords[0];
        let x , y;
        [x, y] = this.dirToVector(dir);
        let nextLocation = [c[0] + x, c[1] + y];
        return (
            (nextLocation[0] >= 0) &&
            (nextLocation[0] < this.gameModel.width) &&
            (nextLocation[1] >= 0) &&
            (nextLocation[1] < this.gameModel.height) &&
            (!this.coordInSnake(nextLocation)) &&
            (!this.isOpposite(dir, this.lastMove)) &&
            (this.canReachTail(nextLocation))
        )
    }
    canReachTail(point) {
        let snakeLen = this.coords.length;
        if (this.gameModel.pfGrid) {
            let grid = this.gameModel.pfGrid.clone();
            let futureLength = this.justEaten() ? snakeLen -1 : snakeLen - 1;
            let futureTail = this.coords[futureLength];
            let aStar = new PF.AStarFinder();
            let hx, hy, tx, ty;
            [hx, hy] = point;
            [tx, ty] = futureTail;
            //console.log("from:", point, "to:", futureTail);
            let path = aStar.findPath(hx, hy, tx, ty, grid);
            console.log(path, path.length);
            return (path.length)
        }
        return true;
    }

    coordInSnake(coord) {
        console.log("testing coord in snake");
        return this.pointInList(this.coords, coord);
    }
    pointInList(list, point) {
        console.log("list", list, "point", point);
        return list.reduce((lastVar, currentPoint) => {
            return (lastVar || (
                currentPoint[0] == point[0] && currentPoint[1] == point[1]
            ))
        }, false);
    }
    getSafeDir() {
        let directions = ["up", "down", "left", "right"];
        directions = _.shuffle(_.difference(directions, [this.getOpposite(this.lastMove)]));
        console.log("possible directions", directions);
        let dir = this.move;
        for (let i = 0; i < directions.length; i++) {
            let d = directions[i];
            if (this.isSafe(d)) {
                console.log("safe direction", dir);
                return d;
            }
        }
        console.log("last ditch direction", dir);
        return dir
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
        this.pfGrid = null;
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
        this.pfGrid = new PF.Grid(this.width, this.height);
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
        this.drawFood();
    }
    drawPlayer () {
        this.drawSnake(this.player, 100 + this.player.health);
    }
    drawFood () {
        var foods = _.get(this.gameState, 'food', []);
        foods.map((food) => {
            this.drawPixel(food, 100);
        });
    }
    drawSnake (snake, color) {
        let coords = _.get(snake, "coords");
        console.log("snake:", coords);
        let snakeLength = coords.length - 2;
        coords.map((xy, i) => {
            let hue = 0;
            if (i == 0) {
                hue = 1;
            }
            this.drawPixel(xy, color + hue);
            if (i < snakeLength) { // Add the first half of the snake to the "wall" list for pathfinding
                console.log("s", xy);
                let x, y;
                [x, y] = xy;
                this.pfGrid.setWalkableAt(x, y, false);
            }
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
    get reward () {
        return this.player.reward;
    }
}

/**
 * /start
 * Called when the central server starts the game by hitting our /start endpoint
 * @param game
 * @returns {{name: string, color: string}}
 */
function start(game) {
    if (getNextStateResponse) { // If the game is being restarted, reply to the setmove and inform the AI of failure.
        let player = gameInstance.player;
        console.log("player", player);
        let state = getState();
        state.terminal = true;
        state.reward = -10;
        getNextStateResponse(state);
        getNextStateResponse = null;
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
    console.log("move");
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
                move: _.get(gameInstance, "player.move"),
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
        reward: _.get(gameInstance, 'reward'),
        terminal: false
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
