# Hissuno automation sandbox image.
#
# This is the base image used by the skill-runner sandbox. It needs:
# - The hissuno CLI on PATH (the skill body shells out to it)
# - git + gh for skills that touch the repo (continuous-dev)
# - jq for parsing CLI --json output
# - bash + node for general scripting
#
# Build:
#   docker build -t hissuno-sandbox infra/sandbox/
#
# Register as an E2B template (cloud sandbox path):
#   1. Install the E2B CLI: npm i -g @e2b/cli
#   2. Initialise:          e2b template init  (uses this Dockerfile)
#   3. Build + publish:     e2b template build
#   4. Set the returned template id as `E2B_SANDBOX_TEMPLATE` and
#      `SANDBOX_PROVIDER=e2b` + `E2B_API_KEY` in the runner's env.
#
# For local dev there's no need to build this - LocalSandbox runs commands
# on the host, so just having `hissuno` on the dev machine's PATH works.

FROM node:22-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       git \
       gh \
       jq \
       ca-certificates \
       curl \
  && rm -rf /var/lib/apt/lists/*

# hissuno CLI. Replace this RUN with `npm install -g hissuno` once the
# package is published; for now we expect the runner to scope a built copy
# into the image at /usr/local/lib/hissuno-cli. Adjust the install path
# (or pull from a private registry) for your deployment.
ENV HISSUNO_CLI_DIR=/usr/local/lib/hissuno-cli
COPY hissuno-cli ${HISSUNO_CLI_DIR}
RUN ln -s ${HISSUNO_CLI_DIR}/bin/hissuno.mjs /usr/local/bin/hissuno

WORKDIR /workspace

CMD ["bash"]
