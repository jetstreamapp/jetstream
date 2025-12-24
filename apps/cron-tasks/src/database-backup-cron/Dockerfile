FROM alpine:3.20 AS alpine

ARG POSTGRES_VERSION=16
RUN apk add --no-cache postgresql$POSTGRES_VERSION-client \
      aws-cli
WORKDIR /scripts

COPY backup.sh .
ENTRYPOINT [ "sh", "backup.sh" ]
