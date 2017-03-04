#!/bin/bash
#docker run -it -p 4000:4000 stembolt/battle_snake
pushd battle_snake
docker build -t battlesnake-server .
docker run -it -p 4000:4000 battlesnake-server
