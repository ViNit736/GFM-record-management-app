import { Alert, Platform } from 'react-native';

export interface PDFOptions {
    fileName: string;
    data: Record<string, any>;
    htmlTemplate?: string;
}

export const generatePDF = async (options: PDFOptions): Promise<void> => {
    if (Platform.OS === 'web') {
        // Dynamically require web implementation to avoid bundling jspdf on native
        const { generateWebPDF } = require('./pdf-generator.web');
        return generateWebPDF(options);
    } else {
        // Native implementation (placeholder for now)
        Alert.alert('PDF Export', 'PDF export is currently only available on Web. Native support coming soon.');
        return Promise.resolve();
    }
};
