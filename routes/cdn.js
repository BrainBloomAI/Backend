const express = require('express');
const { FileManager, Logger } = require('../services');
const router = express.Router();

router.get('/:file', async (req, res) => {
    const file = req.params.file;

    try {
        const filePath = await FileManager.prepFile(file);
        if (!filePath.startsWith('SUCCESS')) {
            if (filePath == "ERROR: File does not exist.") {
                return res.status(404).send('ERROR: File not found.');
            } else {
                return res.status(500).send('ERROR: Failed to process request.');
            }
        }

        return res.sendFile(filePath.substring('SUCCESS: File path: '.length));
    } catch (err) {
        Logger.log(`CDN FILE ERROR: Failed to send requested file; error: ${err}`)
        return res.status(500).send('ERROR: Failed to process request.');
    }
})

module.exports = { router, at: "/cdn" };