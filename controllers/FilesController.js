import {
    getUserFromToken, toObjId, respond, setPublic,
  } from '../utils/helpers';
import db from '../utils/db';
import fileQueue from '../worker';


const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const mime = require('mime-types');

export default class FilesController {
    static async postUpLoad(req, res) {
        const legalTypes = ['file', 'image', 'folder'];
        const {
            name, type, parentId, isPublic, data,
        } = req.body;
        const { userId } = req.customData;
        if (!name) {
            respond(res, 'Missing name');
            return;
        }
        if (!typpe || !legalTypes.includes(type)) {
            respond(res, 'Missing type');
            return;
        }
        if (!data && type !== 'folder') {
            respond(res, 'Missing data');
            return;
        }
        const filesCollection = db.client.db().collection('files');
        let folder = process.env.FOLDER_PATH || '/tmp/files_manager';
        let localPath = `${folder}/${uuidv4()}`;
        if (parentId) {
            const _id = toObjId(parentId);
            const { type, localPath: parentPath } = await filesCollection.findOne({ _id });
            localPath = `${parentPath}/${uuidv4()}`;
            if (!type) {
                respond(res, 'Parent not found');
                return;
            }
            if (type !== 'folder') {
                respond(res, 'Parent is not a folder');
                return;
            }
        }
        if (type === 'folder') folder = localPath;

        // save locally
        fs.mkdir(folder, { recursive: true }, (err) => {
            if (!err) {
              if (['file', 'image'].includes(type)) {
                let fileData = Buffer.from(data, 'base64');
                if (type === 'file') fileData = fileData.toString('utf-8');
                fs.writeFile(localPath, fileData, (err) => {
                  if (err) {
                    console.error('Error saving file', err.message);
                  }
                });
              }
            } else {
              console.error('Error creating folder', err.message);
            }
        });
        // save to mongodb
        const fileDoc = {
            userId,
            name,
            type,
            isPublic: isPublic || false,
            parentId: parentId || 0,
            localPath,
          };
          const newFile = await filesCollection.insertOne(fileDoc);
          const response = {
            id: newFile.insertedId,
            userId,
            name,
            isPublic: isPublic || false,
            parentId: parentId || 0,
            type,
          };
          if (type === 'image') {
            await fileQueue.add({ userId, fileId: response.id });
          }
          res.status(201).json(response);
    }

    static async getShow(req, res) {
        const { userId } = req.customData;
    
        const filesCollection = db.client.db().collection('files');
        const _id = toObjId(req.params.id);
    
        const userFile = await filesCollection.findOne({ userId, _id });
        console.log(userFile);
        if (!userFile) {
          respond(res, 'Not found', 404);
        } else {
          const { localPath, ...response } = userFile;
          res.status(200).json(response);
        }
    }

    static async getIndex(req, res) {
        const { userId } = req.customData;
    
        const parentId = req.query.parentId || 0;
        const page = req.query.page || 1;
        const filesCollection = db.client.db().collection('files');
        const limit = 20;
        const skip = (page - 1) * limit;
        const pipeline = {
          $match: { parentId, userId },
          $skip: skip,
          $limit: limit,
          $project: { localPath: 0 },
        };
        try {
          const items = await filesCollection.aggregate(pipeline).toArray();
          res.json(items);
        } catch (err) {
          respond('An error occured with the database');
          console.error(err);
        }
    }

    static async putPublish(req, res) {
        await setPublic(req, res, true);
    }
    
    static async putUnpublish(req, res) {
        await setPublic(req, res, false);
    }

    static async getFile(req, res) {
        const fileId = req.params.id;
        const _id = toObjId(fileId);
        const filesCollection = db.client.db().collection('files');
        const file = await filesCollection.findOne({ _id });
        const token = req.headers['x-token'];
        const { userId } = await getUserFromToken(token);
        if (!file) {
          respond(res, 'Not found', 404);
        } else if (!file.isPublic && file.userId !== userId) {
          respond(res, 'Not found', 404);
        } else if (file.type === 'folder') {
          respond(res, "A folder doesn't have content");
        } else {
          const size = req.query.size ? `_${req.query.size}` : '';
          const mimeType = mime.lookup(file.name);
          const encoding = mimeType.split('/')[0] === 'text' ? 'utf-8' : 'binary';
          console.log(encoding, mimeType);
          const filePath = file.localPath + size;
          console.log(filePath);
          fs.readFile(filePath, encoding, (err, data) => {
            if (!err) {
              res.setHeader('Content-Type', mimeType);
              res.json(data);
            } else if (err.code === 'ENOENT') {
              console.error("file doesn't exist at", file.localPath);
            } else {
              console.error('Error reading message', err.message);
            }
          });
        }
    }
}