'use strict';
const util = require('util');
const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
require('dotenv').config()
const process = require('process');
const FileOps = require('../services/FileOps');
const Universal = require('../services/Universal');
const basename = path.basename(__filename);
const env = process.env.DB_CONFIG || 'development';
const config = require('../config/config.json')[env];

if (!config) {
    throw new Error("Database configuration not found in config/config.json")
}

const ignoredFiles = ["ModelTemplate.js"]

// System Configuration Setup (e.g Logging)
if (config.logging == true) {
    if (config.loggingOptions != undefined) {
        var queryLogsFile = "sqlQueries.txt"
        if (config.loggingOptions["logsFile"] !== undefined) { queryLogsFile = config.loggingOptions["logsFile"] }

        if (config.loggingOptions["useFileLogging"] === true) {
            if (config.loggingOptions["clearUponBoot"] === true) { FileOps.writeTo(queryLogsFile, "") }
            // Log SQL query executions to a file
            config.logging = (msg) => {
                // Check whether post-boot executions are to be logged only (Use Universal.booted to check if system has booted)
                if (config.loggingOptions["logPostBootOnly"] === true && Universal.booted !== true) { return }
                const date = new Date().toISOString()
                FileOps.appendTo(queryLogsFile, `${date} - ${msg}\n`)
            }
        } else {
            // Log normally to console
            config.logging = (msg) => {
                // Check whether post-boot executions are to be logged only (Use Universal.booted to check if system has booted)
                if (config.loggingOptions["logPostBootOnly"] === true && Universal.booted !== true) { return }
                console.log(msg)
            }
        }
    }
    // If logging options not provided, sequelize will default to console.log
}

// Sequelize Initialization
/**
 * @type {Sequelize.Sequelize}
 */
let sequelize;
if (process.env.DB_MODE == "mysql") {
    if (config.use_env_variable) {
        sequelize = new Sequelize(process.env[config.use_env_variable], config);
    } else {
        sequelize = new Sequelize(config.database, config.username, config.password, config);
    }
} else {
    sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: 'database.sqlite',
        logging: config["logging"] !== undefined ? config.logging : console.log
    })
}

// Model Registration
const db = {};

// Hard-import models
db.User = require('./User')(sequelize, Sequelize.DataTypes);
db.Scenario = require('./Scenario')(sequelize, Sequelize.DataTypes);
db.Game = require('./Game')(sequelize, Sequelize.DataTypes);
db.GameEvaluation = require('./GameEvaluation')(sequelize, Sequelize.DataTypes);
db.GameDialogue = require('./GameDialogue')(sequelize, Sequelize.DataTypes);
db.DialogueAttempt = require('./DialogueAttempt')(sequelize, Sequelize.DataTypes);

// Auto-detect and import other models (intellisense will not work for these models)
// fs
//     .readdirSync(__dirname)
//     .filter(file => {
//         return (
//             file.indexOf('.') !== 0 &&
//             file !== basename &&
//             file.slice(-3) === '.js' &&
//             file.indexOf('.test.js') === -1 &&
//             !ignoredFiles.includes(file)
//         );
//     })
//     .forEach(file => {
//         const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
//         // Add model if model not hard-imported
//         if (db[model.name] == undefined) {
//             db[model.name] = model;
//         }
//     });

Object.keys(db).forEach(modelName => {
    if (db[modelName].associate) {
        db[modelName].associate(db);
    }

    if (db[modelName].hook) {
        db[modelName].hook(db);
    }
});

module.exports = { ...db, sequelize, Sequelize };