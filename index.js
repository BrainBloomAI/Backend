require('./services/BootCheck').check()
const express = require('express');
const cors = require('cors');
const db = require('./models');
const { User, Scenario } = db;
const { Encryption } = require('./services');
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
    if (!await Scenario.findOne({ where: { name: "Retail" }})) {
        await Scenario.create({
            scenarioID: Universal.generateUniqueID(),
            name: "Retail",
            backgroundImage: "retail.png",
            description: "Retail stores are very commonplace. Whenever you need to buy some groceries or food, you may encounter interactions. This scenario is designed to simulate the interactions between a customer and a cashier.",
            created: new Date().toISOString()
        })
    }

    if (!await Scenario.findOne({ where: { name: "Cafetaria" }})) {
        await Scenario.create({
            scenarioID: Universal.generateUniqueID(),
            name: "Cafetaria",
            backgroundImage: "cafetaria.png",
            description: "Cafetarias are places where you can buy food and drinks. This scenario is designed to simulate the interactions between a customer and a cashier.",
            created: new Date().toISOString()
        })
    }

    if (process.env.DEBUG_MODE === "True") { }
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