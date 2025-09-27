FROM debian:trixie-backports  AS ai-dev

############################################################################
# Install system commands and libraries
############################################################################
RUN apt-get -y update \
    && apt-get install -y \
       curl \
       wget \
       git \
       zip \
       unzip \
       dos2unix \
       findutils \
       jq \
       grep \
       gawk \
       sed


############################################################################
# Create proper security higene for enviornemnt.
# Manage SSH keys https://medium.com/trabe/use-your-local-ssh-keys-inside-a-docker-contaieragener-ea1d117515dc
############################################################################
#ENV GIT_SSL_NO_VERIFY="1"
RUN useradd -m user \
    && mkdir -p /home/user/.ssh \
#    && ssh-keyscan github.com >> /home/user/.ssh/known_hosts \
#    && echo "Host *\n\tStrictHostKeyChecking no\n" >> /home/user/.ssh/config \
    && chown -R user:user /home/user/.ssh \
    && echo "password\npassword" | passwd root

############################################################################
# Install Node.js LTS from NodeSource
############################################################################
RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \
    && apt-get install -y nodejs

############################################################################
# Install Typescript
############################################################################
RUN npm install -g typescript

USER user
WORKDIR /project
CMD ["/bin/bash"]
# Add our script files to the path so they can be found
ENV PATH /home/user/.npm-packages/bin:/app/bin:$PATH
ENV NODE_PATH="/home/user/.npm-packages/lib/node_modules:$NODE_PATH"
ENV MANPATH="/home/user/.npm-packages/share/man:$(manpath)"

############################################################################
# Fix Github permissions issues
############################################################################
RUN git config --global --add safe.directory /project

############################################################################
# Install Claude CLI
############################################################################
RUN cd /home/user \
    && mkdir "/home/user/.npm-packages" \
    && echo "prefix=/home/user/.npm-packages" >> /home/user/.npmrc \
    && npm install -g @anthropic-ai/claude-code

############################################################################
# Inside Docker Let Claude Run Free...
############################################################################
RUN echo "alias claude='claude --dangerously-skip-permissions'\n" >> /home/user/.bashrc

############################################################################
# Set Claude Code timeouts to 5 minutes
############################################################################
ENV BASH_DEFAULT_TIMEOUT_MS=300000
ENV BASH_MAX_TIMEOUT_MS=300000
ENV MCP_TOOL_TIMEOUT=300000

############################################################################
# Install Gemini CLI
############################################################################
RUN cd /home/user \
    && npm install -g @google/gemini-cli

############################################################################
# Inside Docker Let Gemini Run Free...
############################################################################
RUN echo "alias gemini='gemini --yolo'\n" >> /home/user/.bashrc

############################################################################
# Setup Claude/Gemini configuration file copying
############################################################################
RUN echo "# Check for Claude system configuration and copy if exists" >> /home/user/.bashrc \
    && echo "if [ -f /home/user/.claude.json.system ]; then" >> /home/user/.bashrc \
    && echo "    cp /home/user/.claude.json.system /home/user/.claude.json" >> /home/user/.bashrc \
    && echo "fi" >> /home/user/.bashrc \
    && echo "if [ -f /home/user/.claude.system/.credentials.json ]; then" >> /home/user/.bashrc \
    && echo "    mkdir -p /home/user/.claude" >> /home/user/.bashrc \
    && echo "    cp /home/user/.claude.system/.credentials.json /home/user/.claude/.credentials.json" >> /home/user/.bashrc \
    && echo "fi" >> /home/user/.bashrc \
    && echo "if [ -d /home/user/.gemini.system ]; then" >> /home/user/.bashrc \
    && echo "    mkdir -p /home/user/.gemini" >> /home/user/.bashrc \
    && echo "    cp /home/user/.gemini.system/installation_id /home/user/.gemini/installation_id" >> /home/user/.bashrc \
#    && echo "    cp /home/user/.gemini.system/credentials.json /home/user/.gemini/credentials.json" >> /home/user/.bashrc \
    && echo "    cp /home/user/.gemini.system/google_accounts.json /home/user/.gemini/google_accounts.json" >> /home/user/.bashrc \
    && echo "    cp /home/user/.gemini.system/oauth_creds.json /home/user/.gemini/oauth_creds.json" >> /home/user/.bashrc \
    && echo "    cp /home/user/.gemini.system/settings.json /home/user/.gemini/settings.json" >> /home/user/.bashrc \
    && echo "fi" >> /home/user/.bashrc

