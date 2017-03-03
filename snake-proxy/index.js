/**
 * Created by jadel on 2/24/17.
 */
const http = require('http');
const _ = require('lodash');
const PF = require('pathfinding');
const request = require("request");
const SERVER = "http://192.168.1.118:4000";

var count = 0;
var gameState = null;
var waitingForSnakeMove = false;
var gameInstance = null;
var moveResponse = null;
var setMoveResponse = null;
var getStartingStateResponse = null;
var getNextStateResponse = null;
var moveResponseTimeout = null;
var gameTimeout = 100;
var dummy = true;
var snakeName = _.get(process.env, "SNAKE_NAME", "SnakeMeat");
var snakeColor = _.get(process.env, "SNAKE_COLOR", "#bb2233");
var justWon = false;


/**
 * The snake and its fallback AI
 */
class SnakeModel {
    constructor(snakeJSON, gameModel) {
        this.gameModel = gameModel;
        this.snakeJSON = snakeJSON;
        this.name = _.get(snakeJSON, 'name');
        this.age = 0;
        this.health = _.get(snakeJSON, 'health_points');
        this.prevHealth = this.health;
        this.lastMove = null;
        this.rewardAI = true;
        this.prevId = this.id;
        this.gameEnded = false;
        this.move = "up";
    }
    get id () {
        return _.get(this.snakeJSON, "id");
    }
    updateState(snakeJSON) {
        this.lastMove = this.nextMove;
        this.age++;
        this.prevHealth = this.health;
        this.snakeJSON = snakeJSON;
        if (this.prevId != this.id) {
            console.log("NEW GAME");
        }
        this.health = _.get(snakeJSON, 'health_points');
        this.prevId = this.id;
    }
    justEaten() {
        return (this.health >= this.prevHealth);
    }
    get reward () {
        var r = 1;
        if (_.get(this.gameModel, "gameState.dead_snakes.length", null) ) {
            r += 100;
            justWon = true;
            console.log("GOT EM!");
        }
        if (this.rewardAI) {
            r += 1;
        }
        r += this.health - this.prevHealth;
        return r;
    }
    set move(move) {
        if (move == "food") {
            move = this.getFoodDir();
        }
        this.nextMove = move;
        this.rewardAI = true;
        if (!this.isSafe(this.nextMove)) {
            this.nextMove = this.getSafeDir();
            this.rewardAI = false;
        } else {
            console.log("safe!");
        }
        return true;
    }
    getFoodDir() {
        let foods = _.get(this, "gameModel.foods");
        console.log("foodsRaw:", foods);
        let headP = new Point(this.coords[0]);
        let grid = _.get(this, "gameModel.pfGrid");
        if (foods && grid) {
            foods = _.sortBy(foods, (foodC) => {
                let foodPoint = new Point(foodC);
                let l = 0;
                l = headP.astar(foodPoint, grid).length;
                if (l == 0) {
                    l = 20 * 20 + 1;
                }
                return l;
            });
            for (let i = 0; i < foods.length; i++) {
                let foodPoint = new Point(foods[i]);
                let foodPath = headP.astar(foodPoint, grid);
                console.log("foodpath:", foodPath, "head:", headP, "food:", foodPoint);
                if (foodPath.length) {
                    let nextPoint = new Point(foodPath[1]);
                    let nd  = nextPoint.sub(headP).dir;
                    console.log("foodDir", nd);
                    return nd;
                }
            }
        }
        console.log("heck");
        return "up";
    };

    isOpposite(dir1, dir2) {
        console.log("testing if opposite", dir1, dir2);
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
        console.log("next location:", nextLocation);
        return (
            (nextLocation[0] >= 0) &&
            (nextLocation[0] < this.gameModel.width) &&
            (nextLocation[1] >= 0) &&
            (nextLocation[1] < this.gameModel.height) &&
            (!this.isOpposite(dir, this.lastMove)) &&
            (!this.coordInSnake(nextLocation)) &&
            (this.canReachTail(nextLocation))
        )
    }
    canReachTail(point) {
        let snakeLen = this.coords.length;
        if (this.gameModel.pfGrid && snakeLen > 4) {
            let grid = this.gameModel.pfGrid.clone();
            let futureLength = snakeLen - 1;
            let futureTail = this.coords[futureLength];
            let aStar = new PF.AStarFinder();
            let hx, hy, tx, ty;
            [hx, hy] = point;
            [tx, ty] = futureTail;
            console.log("from:", point, "to:", futureTail);
            let path = aStar.findPath(hx, hy, tx, ty, grid);
            console.log(path, path.length);
            return (path.length)
        }
        return true;
    }
    coordInSnake(coord) {
        console.log("testing coord in snake");
        let snakeC = this.coords.slice(0,-1);
        return this.pointInList(snakeC, coord);
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
                console.log("safe direction", d);
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

class Point {
    constructor (xy) {
        this.x = null;
        this.y = null;
        this.xy  = xy;
    }
    get xy() {
        return [this.x, this.y]
    }
    set xy(xy) {
        if (xy) {
            [this.x, this.y] = xy;
        }
    }

    /**
     * @param {Point} point
     * @returns {boolean}
     */
    isEqual(point) {
        return (point.x == this.x && point.y == this.y)
    }

    /**
     * @param {Vector} vector
     * @returns {Point}
     */
    add(vector) {
        return new Point([this.x + vector.x, this.y + vector.y]);
    }

    /**
     * Only works for adjacent cells right now
     * @param {Point} point
     * @returns {Vector}
     */
    sub(point) {
        return new Vector([this.x - point.x, this.y - point.y]);
    }
    manhattan(point) {
        return ((Math.abs(point.x - this.y)) + (Math.abs(point - this.x)));
    }
    astar(point, grid) {
        let aStar = new PF.AStarFinder();
        let hx, hy, tx, ty;
        [hx, hy] = this.xy;
        [tx, ty] = point.xy;
        let g = grid.clone();
        g.setWalkableAt(point.x, point.y, true);
        return aStar.findPath(hx, hy, tx, ty, g);
    }
}
class PointList {
    constructor (list) {
        this.path = [];
        list.map((coords) => {
            this.path.push(new Point(coords));
        });
    }
    /**
     * @param {Point} point
     * @returns {boolean}
     */
    inList(point) {
        for (let i = 0; i < this.path; i++) {
            let thisPoint = this.path[i];
            if (thisPoint.isEqual(point)) {
                return true;
            }
        }
        return false;
    }
    get length () {
        return this.path.length;
    }
}
class PointPath extends PointList {
    constructor (list) {
        super(list);
    }
}

class Vector extends Point {
    constructor (xy) {
        super(xy);
    }
    get dir () {
        if (this.x == -1) {
            return "left";
        } else if (this.x == 1) {
            return "right";
        } else if (this.y == -1) {
            return "up";
        } else if (this.y == 1) {
            return "down"
        }
        return null;
    }
    set dir (dir) {
        let dirMap = {
            up : [0, -1],
            down: [0, 1],
            left: [-1, 0],
            right: [1, 0]
        };
        this.xy = dirMap[dir];
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
    get id () {
        return _.get(this.gameState, 'game_id');
    }
    makeSnakes() {
        var snakes = _.get(this.gameState, 'snakes');
        snakes.map((snake) => {
            this.snakes[snake.id] = new SnakeModel(snake, this);
        });
    }
    get enemies () {
        let snakeArray = _.toArray(this.snakes);
        console.log(snakeArray);
        let enemies = _.filter(snakeArray, (snake) => {
            return (snake.id !== this.player.id);
        });
        console.log("enemies", enemies);
        return (enemies)
    }
    drawEnemies () {
        this.enemies.map((enemy) => {
            this.drawSnake(enemy, 50);
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
        this.drawEnemies();
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
        let snakeLength = coords.length;
        coords.map((xy, i) => {
            let hue = 0;
            if (i == 0) {
                hue = 10;
            }
            this.drawPixel(xy, color + hue);
            if (i < snakeLength -1) {
                console.log("s", xy);
                let x, y;
                [x, y] = xy;
                this.pfGrid.setWalkableAt(x, y, false);
            } else { // set the last element as walkable since our tail should always be safe.
                let x, y;
                [x, y] = xy;
                this.pfGrid.setWalkableAt(x, y, true);
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
    get foods () {
        console.log("this.gameState", this.gameState);
        return _.get(this.gameState, "food");
    }
}

/**
 * /start
 * Called when the central server starts the game by hitting our /start endpoint
 * @param game
 * @returns {{name: string, color: string}}
 */
function start(game) {
    return {
        name: snakeName,
        color: snakeColor,
        head_type: _.sample(["bendr", "dead", "fang","pixel", "regular", "safe", "sand-worm", "shades", "smile", "tongue"]),
        tail_type: _.sample(["small-rattle", "skinny-tail", "round-bum", "regular", "pixel", "freckled", "fat-rattle", "curled", "block-bum"])
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
    let newGame = true;
    if (gameInstance) {
        let currentSnakeID = _.get(data, "you");
        let oldSnakeId = _.get(gameInstance, "player.id")
        newGame = currentSnakeID != oldSnakeId;
    }
    if (newGame) {
        if (gameInstance && getNextStateResponse) { // If the game is being restarted, reply to the setmove and inform the AI of failure.
            let gId = _.get(gameInstance, "id");
            let pId = _.get(gameInstance, "player.id");
            let player = _.get(gameInstance, "player");
            let nextResponse = getNextStateResponse;
            request(SERVER + "/api/games", (error, response, body) => {
                let games = JSON.parse(body);
                console.log(games);
                let game = _.head(_.filter(games, {id:gId}));
                console.log("game", game);
                let winners = _.get(game, "winners");
                console.log("winners", winners);
                let justWon = (_.indexOf(winners, pId) != -1);
                console.log("justWon:", justWon, "pId", pId);
                console.log("player", player);
                let health = _.get(player, "health");
                console.log("health", health);
                let state = getState();
                state.terminal = true;
                if (justWon) {
                    state.reward = 200;
                    console.log("player won!");
                } else {
                    state.reward = -100;
                }
                nextResponse(state);
            });
        }
        gameInstance = null;
        waitingForSnakeMove = true;
        getNextStateResponse = null;
        count = 0;
        console.log("start", data);
    }
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
    let responseTime = gameTimeout;
    if (dummy) {
        responseTime = 5;
    }
    moveResponseTimeout = setTimeout(() => {
        waitingForSnakeMove = false;
        if (moveResponse) {
            dummy = true;
            _.set(gameInstance, "player.move", "food");
            console.log("reward", _.get(gameInstance, "player.reward"));
            moveResponse({
                move: _.get(gameInstance, "player.move"),
                taunt: "Boop the snoot!",
            });
        }
    }, responseTime);
}

/**
 * /set-move
 * @param data
 * @param res
 */
function setMove(data, res) {
    dummy = false;
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
