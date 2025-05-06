const { supabase } = require('../config/supabase');

const uploadFile = async (bucketName, filePath, file, options = {}) => {
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, options);

    if (error) {
      console.error(`Supabase Storage error uploading file to ${bucketName}/${filePath}:`, error.message);
      throw new Error('Failed to upload file: ' + error.message);
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return {
      path: data.path,
      publicUrl: publicUrlData.publicUrl,
    };
  } catch (err) {
    console.error('Error in uploadFile:', err.message);
    throw err;
  }
};

const downloadFile = async (bucketName, filePath) => {
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .download(filePath);

    if (error) {
      console.error(`Supabase Storage error downloading file from ${bucketName}/${filePath}:`, error.message);
      throw new Error('Failed to download file: ' + error.message);
    }

    return data;
  } catch (err) {
    console.error('Error in downloadFile:', err.message);
    throw err;
  }
};

const deleteFile = async (bucketName, filePath) => {
  try {
    const { error } = await supabase.storage
      .from(bucketName)
      .remove([filePath]);

    if (error) {
      console.error(`Supabase Storage error deleting file from ${bucketName}/${filePath}:`, error.message);
      throw new Error('Failed to delete file: ' + error.message);
    }

    return true;
  } catch (err) {
    console.error('Error in deleteFile:', err.message);
    throw err;
  }
};

module.exports = { uploadFile, downloadFile, deleteFile };