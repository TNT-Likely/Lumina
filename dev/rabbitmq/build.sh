#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# 可通过环境变量覆盖：IMAGE_TAG=myrepo/rabbitmq:3.12-delayed ./build.sh
IMAGE_TAG=${IMAGE_TAG:-sunxiao0721/rabbitmq:3.12-delayed}
echo "Building $IMAGE_TAG ..."
docker build -t "$IMAGE_TAG" -f Dockerfile .
echo "Built $IMAGE_TAG"
