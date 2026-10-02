const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadDirectory = path.join(__dirname, "..", "public", "uploads", "questions");
fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
    destination: uploadDirectory,
    filename: (req, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase();
        callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`);
    }
});

const allowedImageTypes = new Map([
    [".jpg", "image/jpeg"],
    [".png", "image/png"],
    [".webp", "image/webp"],
    [".gif", "image/gif"]
]);

module.exports = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase();
        if (allowedImageTypes.get(extension) !== file.mimetype.toLowerCase()) {
            return callback(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "image_file"));
        }
        callback(null, true);
    }
});