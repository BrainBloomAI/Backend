const fs = require('fs');
const path = require('path');
const BootCheck = require('./BootCheck');
const Cache = require('./Cache');
const Encryption = require('./Encryption');
const Extensions = require('./Extensions');
const FileOps = require('./FileOps');
const HTMLRenderer = require('./HTMLRenderer');
const Logger = require('./Logger');
const Universal = require('./Universal');
const OpenAIChat = require('./OpenAIChat');
const FireStorage = require('./FireStorage');
const FileManager = require('./FileManager');

const services = {
    BootCheck,
    Cache,
    Encryption,
    Extensions,
    FileManager,
    FileOps,
    FireStorage,
    HTMLRenderer,
    Logger,
    OpenAIChat,
    Universal
};

fs.readdirSync(__dirname)
    .filter(file => file.endsWith('.js') && file !== 'index.js')
    .forEach(file => {
        const service = require(path.join(__dirname, file));
        if (service.name != undefined && services[service.name] == undefined) {
            services[service.name] = service;
        }
    })

module.exports = services;