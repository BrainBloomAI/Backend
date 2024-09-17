require('./services/BootCheck').check()
const express = require('express');
const cors = require('cors');
const db = require('./models');
const { User, Scenario, Game, GameDialogue, DialogueAttempt, GameEvaluation } = db;
const { Universal, Logger, Cache, FileManager, Encryption, OpenAIChat } = require('./services');
require('dotenv').config()

const env = process.env.DB_CONFIG || 'development';
const config = require('./config/config.json')[env];

// Set up services
Logger.setup()

Cache.load();

if (Cache.get("usageLock") == undefined) {
    Cache.set("usageLock", false)
}

FileManager.setup()
    .then(res => { if (res !== true) { throw new Error(res) } })
    .catch(err => { Logger.logAndThrow(err) })

if (OpenAIChat.checkPermission()) {
    console.log("MAIN: OpenAI Chat service is enabled.")
    const initialisation = OpenAIChat.initialise();
    if (initialisation !== true) {
        console.log(`MAIN: OpenAI Chat service failed to initialise. Error: ${initialisation}`)
    }
}

// Import middleware
const checkHeaders = require('./middleware/headersCheck');
const logRoutes = require('./middleware/logRoutes');

// Configure express app
const app = express();
app.use(cors({ exposedHeaders: [] }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.set("view engine", "ejs");

// Top-level middleware

app.use((req, res, next) => {
    if (!req.originalUrl.startsWith("/path/to/admin/route")) {
        const usageLock = Cache.get("usageLock") === true;
        if (usageLock) {
            return res.sendStatus(503)
        }
    }
    next()
})
app.use(checkHeaders)
if (config["routeLogging"] !== false) { app.use(logRoutes) }

// Main routes
app.get("/", (req, res) => {
    res.render("index", {
        currentTime: new Date().toString()
    });
});

// Register routers
if (config["routerRegistration"] != "automated") {
    console.log("MAIN: Route registration mode: MANUAL")

    app.use(require("./routes/identity").at || '/', require("./routes/identity").router);
} else {
    console.log("MAIN: Route registration mode: AUTOMATED")
    require('./routes').forEach(({ router, at, name }) => {
        try {
            app.use(at, router)
        } catch (err) {
            Logger.logAndThrow(`MAIN: Failed to register router auto-loaded from ${name} at '${at}'. Error: ${err}`)
        }
    })
}

async function onDBSynchronise() {
    // SQL-reliant service setup
    for (const name of Object.keys(Universal.data.defaultScenarios)) {
        if (!await Scenario.findOne({ where: { name: Universal.data.defaultScenarios[name].name }})) {
            await Scenario.create({
                scenarioID: Universal.generateUniqueID(),
                name: Universal.data.defaultScenarios[name].name,
                backgroundImage: Universal.data.defaultScenarios[name].backgroundImage,
                description: Universal.data.defaultScenarios[name].description,
                modelRole: Universal.data.defaultScenarios[name].modelRole,
                userRole: Universal.data.defaultScenarios[name].userRole,
                created: new Date().toISOString()
            })
        }
    }

    if (process.env.DEBUG_MODE === "True") {
        // await Game.destroy({ where: {} })
        // await GameEvaluation.destroy({ where: {} })
        // await GameDialogue.destroy({ where: {} })
        // await DialogueAttempt.destroy({ where: {} })
        // await User.update({ activeGame: null }, { where: {} })
    }
}

// Server initialisation with sequelize sync
db.sequelize.sync()
    .then(() => {
        onDBSynchronise()
        console.log("MAIN SEQUELIZE: Database synchronised.")
        console.log()
        app.listen(process.env.SERVER_PORT, () => {
            console.log(`MAIN: Server is running on port ${process.env.SERVER_PORT}`)
            Universal.booted = true;
        })
    })
    .catch(err => {
        console.log(err)
        console.log(`MAIN: Failed to setup sequelize. Terminating boot.`)
        process.exit(1)
    })