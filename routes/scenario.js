const express = require('express');
const { Scenario } = require('../models');
const { Logger, FileManager, Universal, Extensions } = require('../services');
const { authoriseStaff } = require('../middleware/auth');
const { storeImage } = require('../middleware/storeImage');
const multer = require('multer');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        // Fetch all scenarios
        const scenarios = await Scenario.findAll();
        if (!scenarios) {
            return res.status(404).send(`ERROR: No scenarios found.`);
        }

        // Return scenarios
        const scenariosJSON = scenarios.map(scenario => scenario.toJSON());
        return res.status(200).send(scenariosJSON);
    } catch (err) {
        Logger.log(`SCENARIO GET ERROR: Failed to fetch scenarios; error: ${err}`);
        return res.status(500).send(`ERROR: Failed to process request.`);
    }
})

router.post('/new', authoriseStaff, async (req, res) => {
    storeImage(req, res, async (err) => {
        if (err instanceof multer.MulterError) {
            Logger.log(`SCENARIO NEW ERROR: Image upload error; error: ${err}.`);
            return res.status(400).send("ERROR: Image upload error.");
        } else if (err) {
            Logger.log(`SCENARIO NEW ERROR: Internal server error; error: ${err}.`);
            return res.status(400).send(`ERROR: ${err}`);
        } else if (req.file === undefined) {
            res.status(400).send("UERROR: No file selected.");
            return;
        }

        const backgroundImageName = req.file.filename;
        const { name, description, modelRole, userRole } = req.body;
        if (!name || !description || !modelRole || !userRole) {
            return res.status(400).send('ERROR: One or more required payloads not provided.')
        }
        try {
            const scenarioExists = await Scenario.findOne({ where: { name: name }, attributes: ['scenarioID', 'name'] });
            if (scenarioExists) {
                return res.status(400).send('ERROR: Scenario with that name already exists.');
            }
        } catch (err) {
            Logger.log(`SCENARIO NEW ERROR: Failed to check if scenario exists; error: ${err}`);
            return res.status(500).send('ERROR: Failed to process request.');
        }

        // Save to FileStore
        try {
            const fileSave = await FileManager.saveFile(backgroundImageName);
            if (fileSave !== true) {
                Logger.log(`SCENARIO NEW ERROR: Failed to save uploaded image; error: ${fileSave}`);
                return res.status(400).send('ERROR: Failed to save file.');
            }
        } catch (err) {
            Logger.log(`SCENARIO NEW ERROR: Failed to save uploaded image; error: ${err}`);
            return res.status(400).send('ERROR: Failed to save file.');
        }

        // Create new scenario
        var newScenario;
        try {
            newScenario = await Scenario.create({
                scenarioID: Universal.generateUniqueID(),
                name: name,
                backgroundImage: backgroundImageName,
                description: description,
                modelRole: modelRole,
                userRole: userRole,
                created: new Date().toISOString()
            })
            if (!newScenario) {
                return res.status(500).send('ERROR: Failed to create new scenario.');
            }
        } catch (err) {
            Logger.log(`SCENARIO NEW ERROR: Failed to create new scenario; error: ${err}`);
            return res.status(500).send('ERROR: Failed to create new scenario.');
        }

        // Return new scenario
        return res.send({
            message: `SUCCESS: Scenario created successfully.`,
            newScenario: Extensions.sanitiseData(newScenario.toJSON(), [], ["createdAt", "updatedAt"])
        })
    })
})

router.post('/update', authoriseStaff, async (req, res) => {
    storeImage(req, res, async (err) => {
        if (req.file) {
            if (err instanceof multer.MulterError) {
                Logger.log(`SCENARIO UPDATE ERROR: Image upload error; error: ${err}.`);
                return res.status(400).send("ERROR: Image upload error.");
            } else if (err) {
                Logger.log(`SCENARIO UPDATE ERROR: Internal server error; error: ${err}.`);
                return res.status(400).send(`ERROR: ${err}`);
            }
        }

        const backgroundImageName = req.file ? req.file.filename : null;
        const { scenarioID, name, description, modelRole, userRole } = req.body;
        if (!scenarioID) {
            return res.status(400).send('ERROR: One or more required payloads not provided.')
        }
        var targetScenario;
        try {
            targetScenario = await Scenario.findByPk(scenarioID);
            if (!targetScenario) {
                return res.status(404).send('ERROR: Scenario not found.');
            }
        } catch (err) {
            Logger.log(`SCENARIO UPDATE ERROR: Failed to find scenario; error: ${err}`);
            return res.status(500).send('ERROR: Failed to process request.');
        }

        if (backgroundImageName) {
            // Delete old image
            const oldImageName = targetScenario.backgroundImage;
            if (oldImageName) {
                try {
                    const fileDelete = await FileManager.deleteFile(oldImageName);
                    if (fileDelete !== true) {
                        Logger.log(`SCENARIO UPDATE ERROR: Failed to delete old image; error: ${fileDelete}`);
                    }
                } catch (err) {
                    Logger.log(`SCENARIO UPDATE ERROR: Failed to delete old image; error: ${err}`);
                }
            }

            // Save to FileStore
            try {
                const fileSave = await FileManager.saveFile(backgroundImageName);
                if (fileSave !== true) {
                    Logger.log(`SCENARIO UPDATE ERROR: Failed to save uploaded image; error: ${fileSave}`);
                    return res.status(400).send('ERROR: Failed to save file.');
                }
            } catch (err) {
                Logger.log(`SCENARIO UPDATE ERROR: Failed to save uploaded image; error: ${err}`);
                return res.status(400).send('ERROR: Failed to save file.');
            }
        }

        // Return new scenario
        var updateObject = {};
        if (name) updateObject.name = name;
        if (description) updateObject.description = description;
        if (modelRole) updateObject.modelRole = modelRole;
        if (userRole) updateObject.userRole = userRole;
        if (backgroundImageName) updateObject.backgroundImage = backgroundImageName;
        try {
            targetScenario.set(updateObject);
            await targetScenario.save();
        } catch (err) {
            Logger.log(`SCENARIO UPDATE ERROR: Failed to update scenario; error: ${err}`);
            return res.status(500).send('ERROR: Failed to update scenario.');
        }
        if (Object.keys(updateObject).length === 0) {
            return res.send({
                message: `SUCCESS: Nothing to update.`,
                newScenario: Extensions.sanitiseData(targetScenario.toJSON(), [], ["createdAt", "updatedAt"])
            })
        }

        return res.send({
            message: `SUCCESS: Scenario updated successfully.`,
            newScenario: Extensions.sanitiseData(targetScenario.toJSON(), [], ["createdAt", "updatedAt"])
        })
    })
})

module.exports = { router, at: '/scenario' };