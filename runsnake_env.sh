#!/bin/bash
docker build -t shallowsnake .
nvidia-docker run --rm -v $(pwd)/DeepLearningVideoGames:/snake -it --entrypoint /snake/deep_q_network.py shallowsnake
