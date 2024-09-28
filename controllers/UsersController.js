import db from '../utils/db';

const bcrypt = require('bcryptjs');

export default class UsersController {
    static async postNew(req, res) {
        const { email, password } = req.body;
        if (!email) res.status(400).json({ error: 'Missing email'});
        if (!password) res.status(400).json({ error: 'Missing password' });
        const usersCol = await db.client.db().collection('users');
        const userExits = await usersCol.fineOne({ email });
        if (!userExits) {
            const hashedpw = await bcrypt.hash(password, 10);
            const newUser = await usersCol.insertOne({ email, password: hashedpw });
            res.status(201).json({ email, id: newUser.insertId });
        } else {
            res.status(400).json({ error: 'Already exist' });
        }
    }
}