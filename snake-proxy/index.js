/**
 * Created by jadel on 2/24/17.
 */
const http = require('http');
const _ = require('lodash');
var Promise = require('promise');

var count = 0;
var gameState = null;
var nextMove = "up";
var waitForInstruction = true;
var movePromise = null;

function start(game) {
    gameState = game;
    count = 0;
    console.log("start", game ,_.get(game, "test"));
    return {
        name: 'Snek',
        color: '#bb2233',
    }
}

function move(data) {
    console.log("move", count++, data , _.get(data, "test"));
    var move = getMove();
    move.then(function (d) {
        nextMove = d;
    });
    return {
        move: nextMove,
        taunt: "Boop the snoot!",
    };
}

function getMove() {
    return new Promise(function (fulfill, reject) {
        movePromise = fulfill;
    });
}

function setMove(data) {
    var d = _.get(data, "d");
    console.log("set-move", data, d);
    movePromise(d);
}

/**
 * HTTP Server
 * Boilerplate server to receive and respond to POST requests
 * other requests will be returned immediately with no data
 */
console.log("check");
http.createServer((req, res) => {
    if (req.method !== 'POST') return respond(); // non-game requests

    let body = [];
    req.on('data', chunk => body.push(chunk));
    req.on('end', () => {
        body = JSON.parse(Buffer.concat(body).toString());
        console.log(body);
        if (req.url === '/start') message = start(body);
        if (req.url === '/move') message = move(body);
        if (req.url === '/set-move') message = setMove(body);
        return respond(message);
    });

    function respond(message) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(message));
    }
}).listen(8888, "0.0.0.0");
