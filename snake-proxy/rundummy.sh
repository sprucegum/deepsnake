#!/bin/bash
docker build -t snake-proxy . && docker run -p 8889:8888 -it --rm --name snake-proxy-instance-dummy snake-proxy
