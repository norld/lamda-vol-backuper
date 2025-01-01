import * as AWS from "@aws-sdk/client-s3";
import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';

const { VOLUME_NAME_FROM_ENV, S3_BUCKET_NAME, AWS_REGION } = process.env;

// Initialize S3 client
const s3 = new AWS.S3({ region: process.env.AWS_REGION });

export const handler = async (event, context) => {
  // Function to perform the backup
  async function performBackup() {
    // Configuration from environment variables
    const ssh = new Client();
    const backupFile = `/root/backup_${new Date().toISOString().split('T')[0]}.tar.gz`;
    return new Promise((resolve, reject) => {
      ssh.on('ready', () => {
        console.log("SSH connection ready");
        ssh.exec(`docker run --rm -v ${VOLUME_NAME_FROM_ENV}:/data -v $(pwd):/backup alpine sh -c "cd /data && tar czvf /backup/$(basename backup_$(date +"%Y-%m-%d")).tar.gz ."`, (err, stream) => {
          if (err) {
            console.error("Error executing backup command:", err);
            reject(err);
            return;
          }

          stream.on('data', (data) => {
            console.log(`STDOUT: ${data.toString()}`);
          });

          stream.on('close', (code, signal) => {
            if (code !== 0) {
              reject(new Error(`Backup process exited with code ${code}`));
              return;
            }
            console.log(`Backup file created: ${backupFile}`);
            ssh.sftp((err, sftp) => {
              if (err) {
                reject(err);
                return;
              }
              const remoteFilePath = backupFile;
              const localFilePath = `/tmp/${path.basename(backupFile)}`;
              sftp.fastGet(remoteFilePath, localFilePath, (err) => {
                if (err) {
                  reject(err);
                  return;
                }
                console.log(`Backup file downloaded to: ${localFilePath}`);
                
                // Read the file content
                const fileContent = fs.readFileSync(localFilePath);
                
                // Upload to S3
                const params = {
                  Bucket: S3_BUCKET_NAME,
                  Key: `backup-${Date.now()}.tar.gz`,
                  Body: fileContent
                };
                console.log("@params", params)
                s3.putObject(params, (s3Err, data) => {
                  if (s3Err) {
                    console.log("@s3Err", s3Err);
                    reject(s3Err);
                    return;
                  }
                  if (fs.existsSync(localFilePath)) {
                    fs.unlinkSync(localFilePath); // Synchronous deletion
                    console.log(`Temporary file deleted: ${localFilePath}`);
                  } else {
                    console.log("Temporary file does not exist.");
                  }
                  console.log(`File uploaded successfully at ${params.Key}`);

                  // Remove the backup file on the server
                  sftp.unlink(remoteFilePath, (unlinkErr) => {
                    if (unlinkErr) {
                      console.error(`Failed to delete remote backup file: ${unlinkErr}`);
                    } else {
                      console.log(`Remote backup file deleted: ${remoteFilePath}`);
                    }
                    resolve(`File uploaded successfully at ${params.Key}`);
                    ssh.end();
                  });
                });
              });
            });
          }).stderr.on('data', (data) => {
            console.error(`STDERR: ${data}`);
          });
        });
      }).connect({
        host: process.env.SSH_HOST,
        port: process.env.SSH_PORT || 22,
        username: process.env.SSH_USER,
        password: process.env.SSH_PASS
      });
    });
  }

  try {
    const result = await performBackup();
    console.log('Backup process completed.');
    return result;
  } catch (error) {
    console.error('Backup process failed:', error);
    throw error;
  }
};
