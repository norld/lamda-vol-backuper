#!/bin/bash

# Load environment variables from .env file
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

VOLUME_NAME=$VOLUME_NAME_FROM_ENV
BACKUP_DIR=$(pwd)
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="${BACKUP_DIR}/backup/${VOLUME_NAME}_backup_${TIMESTAMP}.tar.gz"

# Ensure the backup directory exists
mkdir -p $BACKUP_DIR

# Run backup
docker run --rm -v $VOLUME_NAME:/data -v $(pwd):/backup alpine sh -c "cd /data && tar czvf /backup/$(basename $BACKUP_FILE) ."

if [ $? -eq 0 ]; then
    echo "Backup successful: $BACKUP_FILE"
else
    echo "Backup failed!"
    exit 1
fi
