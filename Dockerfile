FROM tensorflow/tensorflow:latest-gpu
RUN apt-get update
RUN apt-get install -y python-opencv python-tk
RUN pip install Pygame
RUN pip install Requests
ENV TF_MIN_GPU_MULTIPROCESSOR_COUNT=5
VOLUME /snake
WORKDIR /snake
