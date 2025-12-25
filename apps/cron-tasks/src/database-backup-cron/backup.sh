#!/bin/bash

# Script inspired by Render's Postgres S3 backup example
# https://github.com/render-examples/postgres-s3-backups/blob/main/backup.sh

set -o errexit -o nounset -o pipefail

export AWS_ENDPOINT_URL="https://s3.$AWS_REGION.backblazeb2.com"
export AWS_PAGER=""

# validate required environment variables
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL is not set" >&2
    exit 1
fi

if [ -z "$AWS_ACCESS_KEY_ID" ]; then
    echo "Error: AWS_ACCESS_KEY_ID is not set" >&2
    exit 1
fi

if [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    echo "Error: AWS_SECRET_ACCESS_KEY is not set" >&2
    exit 1
fi

if [ -z "$S3_BUCKET_NAME" ]; then
    echo "Error: S3_BUCKET_NAME is not set" >&2
    exit 1
fi

if [ -z "$AWS_REGION" ]; then
    echo "Error: AWS_REGION is not set" >&2
    exit 1
fi

echo "Using S3 bucket: $S3_BUCKET_NAME in region: $AWS_REGION"
echo "Endpoint URL: $AWS_ENDPOINT_URL"

s3() {
    aws s3 --endpoint-url "$AWS_ENDPOINT_URL" --region "$AWS_REGION" "$@"
}

pg_dump_database() {
    pg_dump --no-owner --no-privileges --clean --if-exists --quote-all-identifiers "$DATABASE_URL"
}

create_test_backup() {
    echo "-- Test backup file created at $(date)"
    echo "-- This is a test to verify S3 connectivity"
    echo "SELECT 1;"
}

upload_to_bucket() {
    # if the zipped backup file is larger than 50 GB add the --expected-size option
    # see https://docs.aws.amazon.com/cli/latest/reference/s3/cp.html
    s3 cp - "s3://$S3_BUCKET_NAME/$(date +%Y/%m/%d/backup-%H-%M-%S.sql.gz)"
}

main() {
    # Set TEST_MODE=true to upload a small test file instead of full database dump
    if [ "${TEST_MODE:-false}" = "true" ]; then
        echo "TEST MODE: Creating and uploading test backup file..."
        create_test_backup | gzip | upload_to_bucket
        echo "Test backup uploaded successfully!"
    else
        echo "Taking backup and uploading it to S3..."
        pg_dump_database | gzip | upload_to_bucket
        echo "Done."
    fi
}

main
