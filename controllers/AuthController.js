import redis from '../utils/redis';
import { getUserFromHeader, getUserFromToken } from '../utils/helpers';

const { v4: uuidv4 } = require('uuid');

export default class AuthController {
    static async getConnect(req, res) {
        const authHeader = req.headers.authorization;
        const user = await getUserFromHeader(authHeader);
        if (!user) {
          res.status(401).json({ error: 'Unauthorized' });
        } else {
          const userId = user._id.toString();
          const token = uuidv4();
          const key = `auth_${token}`;
          const expTime = 24 * 60 * 60; // 24 hours
          console.log(userId, key, expTime);
          await redis.set(key, userId, expTime);
          res.status(200).json({ token });
        }
    }
    static async getDisconnect(req, res) {
        const header = req.headers.authorization;
        const { userId, key } = await getUserFromToken(header);
        if (!userId) {
          res.status(401).json({ error: 'Unauthorized' });
        } else {
          await redis.del(key);
          res.status(204).end();
        }
    }
}