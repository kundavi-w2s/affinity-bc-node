import multer from  "multer";

export function configureMulter() {
    return multer({
        storage: multer.memoryStorage(), 
        limits: {
            fileSize: 5 * 1024 * 1024, 
        },
    });
}