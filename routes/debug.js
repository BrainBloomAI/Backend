const express = require('express');
const { Logger, FileManager, Cache } = require('../services');
const { User, Scenario } = require('../models');
const router = express.Router();

function authoriseSuperadmin(req, res, next) {
    try {
        const key = req.originalUrl.slice(7, 7 + process.env.SUPER_KEY.length);
        if (key === process.env.SUPER_KEY) {
            next();
        } else {
            return res.status(401).send('ERROR: Access unauthorised.')
        }
    } catch {
        res.status(503).send('ERROR: Service unavailable.')
    }
}

router.use(authoriseSuperadmin);

router.get('/', (req, res) => {
    return res.send('SUCCESS: Access granted. Welcome super admin.')
})

router.get('/logs', async (req, res) => {
    const logs = Logger.readLogs();
    if (typeof logs === "string") {
        return res.send(logs);
    } else {
        return res.send(logs.join("<br>"));
    }
})

router.get('/softReset', async (req, res) => {
    try {
        await User.destroy({ where: {} })
        await Scenario.destroy({ where: {} })

        Logger.log("DEBUG SOFTRESET: Super admin soft resetted system.")
        return res.send('SUCCESS: Soft reset completed.')
    } catch (err) {
        Logger.log(`DEBUG SOFTRESET ERROR: Failed to soft reset. Error: ${err}`)
        return res.send(`ERROR: Failed to soft reset. Error: ${err}`);
    }
})

router.get('/fmContext', (req, res) => {
    try {
        return res.send(FileManager.getContext());
    } catch (err) {
        Logger.log(`DEBUG FMCONTEXT ERROR: Failed to get file manager context. Error: ${err}`)
    }
})

router.get('/toggleLock', async (req, res) => {
    try {
        const saveResult = Cache.set("usageLock", !(Cache.get("usageLock") === true))

        if (saveResult !== true) {
            Logger.log(`DEBUG TOGGLELOCK ERROR: Failed to toggle usage lock. Error: ${saveResult}`)
            return res.status(500).send(`ERROR: Failed to toggle usage lock. Error: ${saveResult}`);
        }

        Logger.log(`DEBUG TOGGLELOCK: Usage lock toggled to ${Cache.get("usageLock")}`)
        return res.send(`SUCCESS: Usage lock toggled to ${Cache.get("usageLock")}`)
    } catch (err) {
        Logger.log(`DEBUG TOGGLELOCK ERROR: Failed to toggle usage lock. Error: ${err}`)
        return res.status(500).send(`ERROR: Failed to toggle usage lock. Error: ${err}`);
    }
})

module.exports = { router, at: '/debug/:superKey' };