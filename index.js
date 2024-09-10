require('./services/BootCheck').check()
const express = require('express');
const cors = require('cors');
const db = require('./models');
const { User, Scenario, Game, GameDialogue, DialogueAttempt, GameEvaluation } = db;
const { Encryption, OpenAIChat } = require('./services');
require('dotenv').config()

const env = process.env.DB_CONFIG || 'development';
const config = require('./config/config.json')[env];

// Set up services
const Universal = require('./services/Universal')

const Logger = require('./services/Logger')
Logger.setup()

const Cache = require('./services/Cache')
Cache.load();

if (Cache.get("usageLock") == undefined) {
    Cache.set("usageLock", false)
}

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
    // await Scenario.destroy({ where: {}})
    if (!await Scenario.findOne({ where: { name: "Retail Customer Service" }})) {
        await Scenario.create({
            scenarioID: Universal.generateUniqueID(),
            name: "Retail Customer Service",
            backgroundImage: "retail.png",
            description: "An AI customer will ask for help when searching for something specific in a retail store. Learn to response courteously and in an easy-to-understand manner as a retail worker in the store.",
            modelRole: 'customer',
            userRole: 'retail worker',
            created: new Date().toISOString()
        })
    }

    if (!await Scenario.findOne({ where: { name: "Cafetaria Food Order" }})) {
        await Scenario.create({
            scenarioID: Universal.generateUniqueID(),
            name: "Cafetaria Food Order",
            backgroundImage: "cafetaria.png",
            description: "An AI customer will order food from you in a cafetaria. Understand the complexity of taking orders and responding as a vendor in the cafetaria.",
            modelRole: 'customer',
            userRole: 'vendor',
            created: new Date().toISOString()
        })
    }

    if (process.env.DEBUG_MODE === "True") {
        Universal.data = {
            "scenarioPrompts": {
                "Retail Customer Service": [
                    "Hey! How are you doing today?",
                    "There's a discount on the tomatoes if you get 3 or more. Would you like to get some?",
                    "Would you like to pay by card or cash?",
                    "Do you need a bag for your items?"
                ],
                "Cafetaria Food Order": [
                    "Hi! What's your name?",
                    "Nice to meet you! Where are you from?",
                    "What would you like to order?",
                    "Would you like to pay by card or cash?",
                ]
            }
        }

        await Game.destroy({ where: {} })
        await GameEvaluation.destroy({ where: {} })
        await GameDialogue.destroy({ where: {} })
        await DialogueAttempt.destroy({ where: {} })
        await User.update({ activeGame: null }, { where: {} })
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