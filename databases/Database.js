const mysql = require('mysql');
const MongoClient = require('mongodb').MongoClient;


module.exports.Mysql = class {


    constructor() {
        this.db = undefined;
        this.dbName = undefined;
    }


    /**
     * Establish the connection with the database.
     * @param host {string} The host URL
     * @param user {string} The database access username
     * @param password {string} The database access password
     * @param dbName {string} The database name
     * @returns {Promise<mysql<Connection>>} The database connection
     */
    async connect(host, user, password, dbName) {
        return new Promise(resolve => {
            const db = mysql.createConnection({
                host,
                user,
                password
            });
            db.connect(err => {
                if (err) throw err;
                console.log(`[Sql] Server connected on host ${host}`);
                this.db = db;
                this.dbName = dbName;
                resolve(db);
            });
        });
    }


    /**
     * Setup the database : delete the old one and recreate the structure
     * @returns {Promise<void>}
     */
    async setup() {
        // Prepare the database
        await this.prepareDatabase();
        // Create new tables
        await this.createTable('flows');
        await this.createTable('reviews');
    }


    /**
     * Delete a table in the database if it exists
     * @param tableName The name of the table to delete
     * @returns {Promise<void>}
     */
    async deleteTable(tableName) {
        let res = await this.makeQuery(`SHOW TABLES LIKE '%${tableName}%'`);
        if (res.length > 0) {
            await this.makeQuery(`DROP TABLE \`${this.dbName}\`.\`${tableName}\``);
            console.log(`[Sql] Table ${tableName} deleted!`);
        }
    }


    /**
     * Delete the database if it exists and create a new one
     * @returns {Promise<void>}
     */
    async prepareDatabase() {
        const dbCount = await this.makeQuery(`SHOW DATABASES LIKE '${this.dbName}'`);
        if (dbCount.length === 1) {
            console.log(`[Sql] Database '${this.dbName}' found, deleting...`);
            await this.makeQuery(`DROP DATABASE \`${this.dbName}\``);
        }
        await this.makeQuery(`CREATE DATABASE \`${this.dbName}\``);
        console.log(`[Sql] Database ${this.dbName} created`);
        await this.makeQuery(`USE \`${this.dbName}\``);
    }


    /**
     * Instructions to create a table with its structure, defined in the sql-tables.json file
     * @param tableName {string} The name of the table to create
     * @returns {Promise<void>}
     */
    async createTable(tableName) {
        const createRequests = require('./sql-tables');
        await this.makeQuery(createRequests[tableName]);
        console.log(`[Sql] Table ${tableName} created!`);
    }


    /**
     * Make a SQL query to the db
     * @param sql {string} The sql syntax
     * @param params {Array<*>} The parameters
     * @returns {Promise<Array<*>>} The query result
     */
    async makeQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.query(sql, params, (err, res) => {
                if (err)
                    return reject(err);
                res = JSON.parse(JSON.stringify(res)); // Convert it to plain object
                resolve(res);
            });
        });
    }


    /**
     * Transform a timestamp into a valid MySql date string
     * @param timestamp The timestamp to convert
     * @returns {string} The valid MySql date string
     */
    mySqlDateTime(timestamp) {
        let date = new Date(timestamp);
        return `${date.toISOString().split('T')[0]} ${date.toTimeString().split(' ')[0]}`;
    }


    /**
     * Add data to the DB
     * @param data {Array<*>} The data to add
     * @returns {Promise<void>}
     */
    async addData(data) {
        await this.makeQuery(
            `INSERT INTO \`${this.dbName}\`.flows(\`id\`, \`user_id\`, \`category_id\`, \`title\`, \`description\`, \`downloads\`, \`featured\`, \`created\`, \`modified\`, \`upload-version\`, \`data-version\`, \`base64-data\`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                data['id'],
                data['user']['id'],
                data['category']['id'],
                data['title'],
                data['description'],
                data['downloads'],
                data['featured'] ? 1 : 0,
                this.mySqlDateTime(data['created']),
                this.mySqlDateTime(data['modified']),
                data['uploadVersion'],
                data['dataVersion'],
                data['b64Data']
            ]
        );
        for await (const review of data['reviews']) {
            await this.makeQuery(
                `INSERT INTO \`${this.dbName}\`.reviews(\`id\`, \`user_id\`, \`flow_id\`, \`comment\`,  \`rating\`, \`created\`, \`modified\`) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    review['id'],
                    review['user']['id'],
                    data['id'],
                    review['comment'],
                    review['rating'],
                    this.mySqlDateTime(review['created']),
                    this.mySqlDateTime(review['modified'])
                ]
            );
        }
    }


    /**
     * Initialisate the db disconnection and await it's finished
     * @returns {Promise<void>}
     */
    async disconnect() {
        await new Promise(resolve => {
            this.db.end(() => {
                resolve();
            });
        });
    }

};


module.exports.Mongo = class {


    /**
     * Establish the connection with the database
     * @param uri {string} The database URI
     * @param options {Object} The connection options
     * @param dbName {string} The database name
     * @returns {Promise<Db>} The database connection
     */
    async connect(uri, options, dbName) {
        const connection = await MongoClient.connect(uri, {
            ...options,
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        const db = connection.db(dbName);
        this.db = db;
        console.log(`[Mongo] Database ${dbName} connected!`);
        return db;
    }


    /**
     * Setup the database : delete the old one
     * @returns {Promise<void>}
     */
    async setup() {

    }


};
