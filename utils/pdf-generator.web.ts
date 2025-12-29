import { jsPDF } from 'jspdf';
import { PDFOptions } from './pdf-generator';

export const generateWebPDF = async (options: PDFOptions): Promise<void> => {
    const { fileName, htmlTemplate } = options;
    if (!htmlTemplate) throw new Error('HTML Template is required for web PDF generation');

    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;top:0;left:-10000px;width:210mm;background:white;z-index:-9999';
    container.innerHTML = htmlTemplate;
    document.body.appendChild(container);

    try {
        // Wait for images to load
        const images = container.getElementsByTagName('img');
        await Promise.all(
            Array.from(images).map(
                img =>
                    img.complete
                        ? Promise.resolve()
                        : new Promise(r => {
                            img.onload = r;
                            img.onerror = r;
                        })
            )
        );

        // Give some extra time for rendering
        await new Promise(r => setTimeout(r, 800));

        const html2canvas = (window as any).html2canvas;
        if (!html2canvas) {
            const h2c = require('html2canvas');
            (window as any).html2canvas = h2c.default || h2c;
        }

        const actualH2C = (window as any).html2canvas;
        const canvas = await actualH2C(container, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            windowWidth: 800,
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        const doc = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4',
            compress: true,
        });

        const pdfWidth = 210;
        const pdfHeight = 297;
        const imgWidth = pdfWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        let heightLeft = imgHeight;
        let position = 0;

        doc.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            doc.addPage();
            doc.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
            heightLeft -= pdfHeight;
        }

        doc.save(fileName);
    } finally {
        document.body.removeChild(container);
    }
};
