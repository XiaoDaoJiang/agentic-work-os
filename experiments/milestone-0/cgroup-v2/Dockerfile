FROM ubuntu:24.04

ARG NODE_VERSION=22.16.0
ARG RUST_TOOLCHAIN=1.88.0

ENV DEBIAN_FRONTEND=noninteractive
ENV PATH="/opt/node/bin:/root/.cargo/bin:${PATH}"

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        ca-certificates \
        curl \
        pkg-config \
        xz-utils \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSLo /tmp/node.tar.xz \
      "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
    && mkdir -p /opt/node \
    && tar -xJf /tmp/node.tar.xz -C /opt/node --strip-components=1 \
    && rm /tmp/node.tar.xz \
    && node --version

RUN curl -fsSLo /tmp/rustup-init https://sh.rustup.rs \
    && sh /tmp/rustup-init -y --profile minimal --default-toolchain "${RUST_TOOLCHAIN}" \
    && rm /tmp/rustup-init \
    && rustc --version \
    && cargo --version

WORKDIR /work
