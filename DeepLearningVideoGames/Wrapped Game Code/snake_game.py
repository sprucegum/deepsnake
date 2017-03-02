#!/usr/bin/python

import cv2
import numpy as np
import requests
import json

'''
Dummy game to test the effectiveness of the DQN.
The game starts out with a white screen, and will change
to black if given input 1. A black screen turns white on
input 2. Flipping the screen color gives reward 1,
but the wrong input for a given screen will give
-1 reward. Doing nothing always gives 0 reward.

Every ten steps, a new episode starts.

Ideally the DQN learns that the best strategy is
to continually flip the screen color to maximize reward.
'''

GAME_SERVER = "http://192.168.1.118:8888/"
headers = {'Content-type': 'application/json'}
WORLD_SIZE = 20

class GameState:
    def __init__(self):

        startingState = requests.get(GAME_SERVER + "get-starting-state", headers=headers ,timeout=None)
        gameResponse = startingState.json()
        print("startingState", gameResponse)
        self.board = np.array(gameResponse["board"], np.float32)
        print("gameboard", self.board)
        #self.screen = np.ones((WORLD_SIZE, WORLD_SIZE), np.float32) * 255
        self.screen = cv2.cvtColor(self.board, cv2.COLOR_GRAY2BGR)
        self.steps = 0

    def frame_step(self, input_vec):
        #print("gameboard-pre", self.board)
        move = {
            "d":"up"
        }
        if input_vec[0] == 1:
            move = {
                "d": "up"
            }
        elif input_vec[1] == 1:
            move = {
                "d": "down"
            }
        elif input_vec[2] == 1:
            move = {
                "d": "left"
            }
        elif input_vec[3] == 1:
            move = {
                "d": "right"
            }
        elif input_vec[4] == 1:
            move = {
                "d": "food"
            }
        requests.post(GAME_SERVER + "set-move", headers=headers, data=json.dumps(move))
        #print ("sending get-state request")
        gameState = requests.get(GAME_SERVER + "get-state", headers=headers, timeout=None).json()
        try:
            self.board = np.array(gameState.get("board"), np.float32)
            self.screen = cv2.cvtColor(self.board, cv2.COLOR_GRAY2BGR)
            reward = gameState.get("reward")
            terminal = gameState.get("reward")
        except Exception as e:
            print(gameState)

        #print("gameboard-post", self.board)

        return self.screen, reward, terminal
