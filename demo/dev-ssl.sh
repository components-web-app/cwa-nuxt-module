#!/usr/bin/env sh

parent_path=$( cd "$(dirname "${BASH_SOURCE[0]}")" ; pwd -P )
cd "$parent_path"

openssl req -x509 \
  -nodes \
  -days 365 \
  -out ./demo/ssl/localhost.crt \
  -keyout ./demo/ssl/localhost.key \
  -sha256 \
  -subj '/C=CA/ST=QC/O=Company, Inc./CN=localhost' \
  -addext "subjectAltName=DNS:localhost" \
  -newkey rsa:4096
