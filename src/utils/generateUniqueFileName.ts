
export const generateUniqueFileName = (originalname: string, mimetype: string): string => {
    const originalNameBase = originalname.split('.').slice(0, -1).join('.');
    const timestamp = Date.now();
    const extension = mimetype && mimetype.includes('/') 
        ? '.' + mimetype.split('/')[1] 
        : '';
    const filename = `${originalNameBase}_${timestamp}${extension}`;
    
    return filename;
};
