const { MongoClient } = require('mongodb');

class DBClient {
    constructor() {
        const host = process.env.DB_HOST || 'localhost';
        const port = process.env.DB_PORT || 270117;
        const database = process.env.DB_DATABASE || 'files_manager';
        const url = `mongodb://${host}:${port}/${database}`;
        this.client = new MongoClient(url, { useUnifiedTopology: true, poolSize: 10 });
        this.client.connect();
    }

    isAlive() {
        return this.client.isConnected();
    }

    async nbUsers() {
        return this.client.db().collection('users').countDocuments();
    }

    async nbFiles() {
        return this.client.db().collection('files').countDocuments();
    }
}
export default new DBClient();