import { toObjId } from './utils/helpers';

const Queue = require('bull');
const imageThumbnail = require('image-thumbnail');
const fs = require('fs');
const { default: db } = require('./utils/db');

const fileQueue = new Queue('Thumbnail Generator');
fileQueue.process(async (job, done) => {
  const { userId, fileId } = job.data;
  if (!fileId) {
    throw new Error('Missing fileId');
  } else if (!userId) {
    throw new Error('Missing userId');
  } else {
    const filesCollection = db.client.db().collection('files');
    const _id = toObjId(fileId);
    const file = await filesCollection.findOne({ _id, userId });
    if (!file) {
      throw new Error('File not found');
    } else {
      const thumbnailSizes = [500, 250, 100];
      let progress = 0;
      for await (const width of thumbnailSizes) {
        const thumbnail = await imageThumbnail(file.localPath, { width });
        const filePath = `${file.localPath}_${width}`;
        progress += 30;
        job.progress(progress);
        fs.writeFile(filePath, thumbnail, (err) => {
          if (err) console.error(err);
        });
      }
      done();
    }
  }
});
export default fileQueue;