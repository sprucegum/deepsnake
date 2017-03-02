#!/bin/bash
docker build -t snake-proxy . && docker run -p 8889:8888 -it --rm -e "SNAKE_NAME=DummySnake" -e "SNAKE_COLOR=#0510CC" --name snake-proxy-instance-dummy snake-proxy
