#!/bin/bash
docker build -t snake-proxy . && docker run -p 8888:8888 -it --rm --name snake-proxy-instance snake-proxy
