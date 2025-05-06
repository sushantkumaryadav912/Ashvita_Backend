const { supabase } = require('../config/supabase');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

const uploadFile = async (bucketName, filePath, fileBuffer, fileOptions = {}) => {
  try {
    if (!bucketName || typeof bucketName !== 'string') {
      logger.warn('Invalid bucket name', { bucketName });
      throw new Error('Bucket name must be a non-empty string');
    }

    if (!filePath || typeof filePath !== 'string') {
      logger.warn('Invalid file path', { filePath });
      throw new Error('File path must be a non-empty string');
    }

    if (!Buffer.isBuffer(fileBuffer)) {
      logger.warn('Invalid file buffer', { filePath });
      throw new Error('File content must be a Buffer');
    }

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, fileBuffer, {
        cacheControl: '3600',
        upsert: false,
        ...fileOptions,
      });

    if (error) {
      logger.error('Supabase Storage error uploading file', { bucketName, filePath, error: error.message });
      throw new Error('Failed to upload file: ' + error.message);
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    logger.info('File uploaded successfully', { bucketName, filePath, publicUrl: publicUrlData.publicUrl });
    return {
      filePath: data.path,
      publicUrl: publicUrlData.publicUrl,
    };
  } catch (err) {
    logger.error('Error uploading file to Supabase Storage', { bucketName, filePath, error: err.message });
    throw err;
  }
};

const getFile = async (bucketName, filePath) => {
  try {
    if (!bucketName || typeof bucketName !== 'string') {
      logger.warn('Invalid bucket name', { bucketName });
      throw new Error('Bucket name must be a non-empty string');
    }

    if (!filePath || typeof filePath !== 'string') {
      logger.warn('Invalid file path', { filePath });
      throw new Error('File path must be a non-empty string');
    }

    const { data, error } = await supabase.storage
      .from(bucketName)
      .download(filePath);

    if (error) {
      logger.error('Supabase Storage error downloading file', { bucketName, filePath, error: error.message });
      throw new Error('Failed to download file: ' + error.message);
    }

    logger.info('File downloaded successfully', { bucketName, filePath });
    return data;
  } catch (err) {
    logger.error('Error downloading file from Supabase Storage', { bucketName, filePath, error: err.message });
    throw err;
  }
};

module.exports = { uploadFile, getFile };