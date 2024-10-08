const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const imageFileFilter = require('./imageFileFilter');

const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        callback(null, path.join(__dirname, '../FileStore'))
    },
    filename: (req, file, callback) => {
        callback(null, uuidv4() + path.extname(file.originalname))
    }
})

const storeImage = multer({
    storage: storage,
    limits: { fileSize: 1024 * 1024 * 10 },
    fileFilter: imageFileFilter
})
.single('image')

module.exports = { storeImage };