import redis from '../utils/redis';
import db from '../utils/db';

export default class AppController {
    static getStatus(req, res) {
        const redisStatus = redis.isAlive();
        const dbStatus = db.isAlive();
        res.set('Content-type', 'application/json');
        res.status(200).json({ redis: redisStatus, db: dbStatus }).end();
    }

    static async getStats(req, res) {
        const users = await db.nbUsers();
        const files = await db.nbFiles();
        res.set('Content-type', 'application/json');
        res.status(200).json({ users, files }).end();
    }
}