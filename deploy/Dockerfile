FROM alpine:latest
WORKDIR /app
COPY dist/hamsterstore-linux /app/hamsterstore
COPY config/ /app/config/
COPY public/ /app/public/
COPY assets/ /app/assets/
RUN chmod +x /app/hamsterstore
EXPOSE 5678
EXPOSE 49152-65535
ENTRYPOINT ["/app/hamsterstore"]