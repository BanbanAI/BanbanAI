FROM buildpack-deps:bookworm AS runtime-deps

RUN set -eux; \
  arch="$(dpkg-architecture -qDEB_HOST_MULTIARCH)"; \
  mkdir -p "/runtime-root/etc/ssl" "/runtime-root/usr/lib/${arch}"; \
  cp -a /etc/ssl/certs /runtime-root/etc/ssl/; \
  cp -a "/usr/lib/${arch}/libstdc++.so.6"* "/runtime-root/usr/lib/${arch}/"; \
  cp -a "/lib/${arch}/libgcc_s.so.1" "/runtime-root/usr/lib/${arch}/"

FROM debian:bookworm-slim

COPY --from=runtime-deps /runtime-root/ /

WORKDIR /app

COPY __BINARY_NAME__ /app/__BINARY_NAME__
COPY config.jsonc /app/config.jsonc

RUN chmod +x /app/__BINARY_NAME__ \
  && mkdir -p /root/.config/banban

ENV TZ=Asia/Shanghai

EXPOSE 16666
VOLUME ["/root/.config/banban"]

ENTRYPOINT ["/app/__BINARY_NAME__"]
