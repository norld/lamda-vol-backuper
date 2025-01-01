import * as AWS from "@aws-sdk/client-s3";

const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const DAYS_OLD = 30;
const s3 = new AWS.S3({ region: process.env.AWS_REGION });

export const handler = async (event) => {
  try {
    // List objects in the bucket
    const objects = await s3.listObjects({ Bucket: BUCKET_NAME });
    console.log("@objects", objects)
    const currentTime = new Date().getTime();

    // Filter objects older than 30 days
    const objectsToDelete = objects.Contents.filter((obj) => {
      const objectAgeInMs = currentTime - new Date(obj.LastModified).getTime();
      const objectAgeInDays = objectAgeInMs / (1000 * 60 * 60 * 24);
      return objectAgeInDays > DAYS_OLD;
    }).map((obj) => ({ Key: obj.Key }));

    if (objectsToDelete.length === 0) {
      console.log("No files to delete.");
      return { message: "No files older than 30 days." };
    }

    // Delete old objects
    const deleteParams = {
      Bucket: BUCKET_NAME,
      Delete: {
        Objects: objectsToDelete,
      },
    };

    const result = await s3.deleteObjects(deleteParams);

    console.log("Deleted files:", result.Deleted);
    return {
      message: "Deleted old files successfully.",
      deletedFiles: result.Deleted,
    };
  } catch (error) {
    console.error("Error deleting files:", error);
    return {
      message: "Error deleting files.",
      error,
    };
  }
};
