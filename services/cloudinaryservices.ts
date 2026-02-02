export const uploadToCloudinary = async (fileUri: string, fileType: string = 'image/jpeg', fileName: string = 'file.jpg', folder: string = ''): Promise<string | null> => {
  const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    console.error("Cloudinary credentials missing in environment variables.", {
      CLOUD_NAME: CLOUD_NAME || 'MISSING',
      UPLOAD_PRESET: UPLOAD_PRESET || 'MISSING'
    });
    return null;
  }

  console.log("Starting Cloudinary Upload:", { cloudName: CLOUD_NAME, preset: UPLOAD_PRESET, folder });

  const apiUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;

  const formData = new FormData();

  if (typeof window !== 'undefined' && (fileUri.startsWith('blob:') || fileUri.startsWith('data:'))) {
    const response = await fetch(fileUri);
    const blob = await response.blob();
    formData.append('file', blob, fileName);
  } else {
    formData.append('file', {
      uri: fileUri,
      type: fileType,
      name: fileName,
    } as any);
  }

  formData.append('upload_preset', UPLOAD_PRESET);
  if (folder) {
    formData.append('folder', folder);
  }


  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (data.secure_url) {
      return data.secure_url;
    } else {
      console.error("Cloudinary Error Response:", JSON.stringify(data, null, 2));
      return null;
    }
  } catch (err) {
    console.error("Fetch Error during Cloudinary upload:", err);
    return null;
  }
};