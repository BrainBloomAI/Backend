const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    return res.status(200).send("SUCCESS: Identity route is operational.")
})

module.exports = { router, at: "/identity" }