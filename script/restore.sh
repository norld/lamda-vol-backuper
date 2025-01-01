#!/bin/bash

# Load environment variables from .env file
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

VOLUME_NAME=$VOLUME_NAME_FROM_ENV
BACKUP_FILE=$(pwd)"/backup_2025-01-01_08-45-32.tar.gz"

# Verify the backup file exists
if [ ! -f $BACKUP_FILE ]; then
    echo "Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Restore the volume
docker run --rm -v $VOLUME_NAME:/data -v $(dirname $BACKUP_FILE):/backup alpine sh -c "cd /data && tar xzvf /backup/$(basename $BACKUP_FILE) --strip 1"

if [ $? -eq 0 ]; then
    echo "Restore successful"
else
    echo "Restore failed!"
    exit 1
fi
