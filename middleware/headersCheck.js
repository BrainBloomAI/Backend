require('dotenv').config()

const checkHeaders = (req, res, next) => {
    // Add checks here
    next()
}

module.exports = checkHeaders;