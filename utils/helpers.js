import db from './db';
import redis from './redis';

const { ObjectId } = require('mongodb');

/**
 * Get user information from an Authorization header.
 * @param {string} authHeader - The Authorization header containing credentials.
 * @returns {Object} The user information based on the provided credentials.
 */
export async function getUserFromHeader(authHeader) {
  const userCollection = db.client.db().collection('users');
  // Split the header to retrieve credentials
  const [, base64Credentials] = authHeader.split(' ');
  // Decode the base64-encoded credentials
  const decodedCredentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');

  // Split the decoded credentials into email and password
  const [email] = decodedCredentials.split(':');
  const user = await userCollection.findOne({ email });
  return user;
}

/**
 * Get user information from a token stored in Redis.
 * @param {string} token - The token to retrieve user information for.
 * @param {boolean} fetchFromDatabase - Specify whether to fetch user information from the database.
 * @returns {Object} An object containing userId, redisKey, and user information (if requested).
 */
export async function getUserFromToken(token, fetchFromDatabase = false) {
  const userCollection = db.client.db().collection('users');
  const redisKey = `auth_${token}`;
  const userIdFromRedis = await redis.get(redisKey);
  const userIdObjectId = new ObjectId(userIdFromRedis);
  let user;
  if (fetchFromDatabase) {
    user = await userCollection.findOne({ _id: userIdObjectId });
  }

  // Return userId, redisKey, and user information (if requested)
  return { userId: userIdFromRedis, redisKey, user };
}

/**
 * Converts a string ID to a MongoDB ObjectId.
 * @param {string} id - The string ID to convert.
 * @returns {ObjectId} The corresponding ObjectId.
 */
export function toObjId(id) {
  try {
    return new ObjectId(id);
  } catch (err) {
    console.error(err.message);
    return null;
  }
}

/**
 * Sends a JSON response with an error message and status code.
 *
 * @param {object} res - The response object.
 * @param {string} error - The error message to include in the response.
 * @param {number} [statusCode=400] - The HTTP status code to set for the response.
 * Default is 400 (Bad Request).
 */
export function respond(res, error, statusCode = 400) {
  res.status(statusCode).json({ error });
}

export async function setPublic(req, res, val) {
  console.log(req.customData);
  const { userId } = req.customData;
  const filesCollection = db.client.db().collection('files');
  console.log(req.params.id);
  const _id = toObjId(req.params.id);
  const newUpdate = {
    $set: { isPublic: val },
  };
  console.log(_id, userId);
  const file = await filesCollection.findOne({ _id, userId });
  // console.log(file);
  if (!file) respond(res, 'Not found', 404);
  else {
    const { localPath, ...response } = file;
    try {
      await filesCollection.updateOne({ _id, userId }, newUpdate);
      res.status(200).json({ ...response, isPublic: val });
    } catch (err) {
      console.error(err.message);
      respond('An error occured while updating the data', 500);
    }
  }
}