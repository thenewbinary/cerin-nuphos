FROM ghcr.io/thenewbinary/cerin-runtime:0.1.78-claude-code
USER root
# Railway mounts one volume per service. Keep workspaces on the home volume too.
RUN rmdir /workspace && ln -s /home/node/workspace /workspace
COPY --chmod=755 start.sh /usr/local/bin/cerin-railway-start
ENTRYPOINT ["tini", "--", "/usr/local/bin/cerin-railway-start"]
CMD ["openab", "run", "-c", "/etc/openab/config.toml"]
