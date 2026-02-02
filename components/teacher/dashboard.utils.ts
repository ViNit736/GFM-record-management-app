import { Alert, Image, Linking, Platform } from 'react-native';
import { COLORS } from '../../constants/colors';
import { populateTemplate } from '../../services/pdf-template.service';
import {
    getAcademicRecordsByStudent,
    getAchievements,
    getFeePayments,
    getInternships,
    getStudentActivities,
    Student
} from '../../storage/sqlite';
import { generatePDF } from '../../utils/pdf-generator';

const isWeb = Platform.OS === 'web';
const FALLBACK_LOGO = require('../../assets/images/icon.png');
const LOGO_LEFT_IMG = require('../../assets/images/left.png');
const LOGO_RIGHT_IMG = require('../../assets/images/right.png');

export const getBase64Image = (source: any, timeout = 5000): Promise<string> => {
    return new Promise((resolve) => {
        if (!source) {
            console.warn('[getBase64Image] No source provided');
            return resolve(FALLBACK_LOGO);
        }

        // On Native, we can't easily use canvas to get base64.
        // For now, return the URI directly if it's already a string or resolve source.
        if (!isWeb) {
            if (typeof source === 'string') return resolve(source);
            const resolved = Image.resolveAssetSource(source);
            return resolve(resolved?.uri || FALLBACK_LOGO);
        }

        if (typeof source === 'string' && source.startsWith('data:')) return resolve(source);
        if (typeof source === 'string' && source.startsWith('http')) {
            return resolve(source);
        }

        let url = '';
        try {
            if (typeof source === 'string') {
                url = source;
            } else if (Image.resolveAssetSource) {
                url = Image.resolveAssetSource(source)?.uri || '';
            }
        } catch (e) {
            console.warn('[getBase64Image] Error resolving source:', e);
            return resolve(FALLBACK_LOGO);
        }

        if (!url) {
            console.warn('[getBase64Image] No URL resolved');
            return resolve(FALLBACK_LOGO);
        }

        console.log('[getBase64Image] Loading image from:', url);

        const img = document.createElement('img');
        img.setAttribute('crossOrigin', 'anonymous');

        const timer = setTimeout(() => {
            console.warn('[getBase64Image] Timeout loading image:', url);
            img.src = "";
            resolve(FALLBACK_LOGO);
        }, timeout);

        img.onload = () => {
            clearTimeout(timer);
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
            try {
                const dataUrl = canvas.toDataURL('image/png');
                console.log('[getBase64Image] Successfully converted to base64');
                resolve(dataUrl);
            } catch (e) {
                console.error('[getBase64Image] Canvas conversion error:', e);
                resolve(FALLBACK_LOGO);
            }
        };
        img.onerror = (err) => {
            clearTimeout(timer);
            console.error('[getBase64Image] Image load error:', err, 'URL:', url);
            resolve(FALLBACK_LOGO);
        };
        img.src = url;
    });
};

export const handleViewDocument = (uri: string) => {
    if (!uri) return;
    const isPdf = uri.toLowerCase().endsWith('.pdf') || uri.includes('/raw/upload/');
    if (isPdf) {
        if (isWeb) {
            window.open(uri, '_blank');
        } else {
            Linking.openURL(uri).catch(err => {
                console.error("Error opening PDF:", err);
                Alert.alert("Error", "Could not open PDF. Please try again.");
            });
        }
    } else {
        if (isWeb) {
            window.open(uri, '_blank');
        } else {
            Linking.openURL(uri).catch(err => {
                console.error("Error opening Image:", err);
                Alert.alert("Error", "Could not open Image. Please try again.");
            });
        }
    }
};

export const exportStudentPDF = async (student: Student, options: any, setLoading: (v: boolean) => void) => {
    setLoading(true);

    try {
        const academicRecords = (options.academic || options.all) ? await getAcademicRecordsByStudent(student.prn) : [];
        const fees = (options.fees || options.all) ? await getFeePayments(student.prn) : [];
        const technical = (options.activities || options.all) ? await getStudentActivities(student.prn) : [];
        const achievements = (options.activities || options.all) ? await getAchievements(student.prn) : [];
        const internships = (options.internships || options.all) ? await getInternships(student.prn) : [];

        let totalPaid = 0;
        let lastBalance = 0;
        fees.forEach(f => {
            totalPaid += (f.amountPaid || 0);
            lastBalance = f.remainingBalance || 0;
        });

        let academicTableHtml = '<table><thead><tr><th>Sem</th><th>Code</th><th>Course</th><th>MSE</th><th>ESE</th><th>Grade</th></tr></thead><tbody>';
        if (academicRecords.length > 0) {
            academicRecords.forEach(r => {
                academicTableHtml += `<tr><td>${r.semester}</td><td>${r.courseCode}</td><td>${r.courseName}</td><td>${r.mseMarks || 0}</td><td>${r.eseMarks || 0}</td><td style="color: ${r.grade === 'F' ? COLORS.error : 'inherit'}">${r.grade}</td></tr>`;
            });
        } else {
            academicTableHtml += '<tr><td colspan="6" style="text-align: center;">No academic records found</td></tr>';
        }
        academicTableHtml += '</tbody></table>';

        let feeTableHtml = '<table><thead><tr><th>Year</th><th>Inst.</th><th>Date</th><th>Paid</th><th>Balance</th><th>Mode</th></tr></thead><tbody>';
        if (fees.length > 0) {
            fees.forEach(f => {
                feeTableHtml += `<tr><td>${f.academicYear}</td><td>${f.installmentNumber}</td><td>${f.paymentDate}</td><td>₹${f.amountPaid}</td><td>₹${f.remainingBalance}</td><td>${f.paymentMode}</td></tr>`;
            });
        } else {
            feeTableHtml += '<tr><td colspan="6" style="text-align: center;">No fee records found</td></tr>';
        }
        feeTableHtml += '</tbody></table>';

        let activitiesTableHtml = `
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Activity Name</th>
            <th>Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
    `;
        const combined = [
            ...technical.map(t => ({
                date: t.activityDate,
                type: t.type === 'Co-curricular' ? 'Technical' : (t.type === 'Extra-curricular' ? 'Non-Technical' : t.type),
                name: t.activityName,
                status: t.verificationStatus
            })),
            ...achievements.map(a => ({
                date: a.achievementDate,
                type: a.type || 'Technical',
                name: a.achievementName,
                status: a.verificationStatus
            }))
        ];
        if (combined.length > 0) {
            combined.forEach(a => {
                activitiesTableHtml += `
          <tr>
            <td><strong>${a.type}</strong></td>
            <td>${a.name}</td>
            <td>${a.date}</td>
            <td class="status-${(a.status || 'Pending').toLowerCase()}">${a.status || 'Pending'}</td>
          </tr>
        `;
            });
        } else {
            activitiesTableHtml += '<tr><td colspan="4" style="text-align: center;">No activities found</td></tr>';
        }
        activitiesTableHtml += '</tbody></table>';

        let internshipsTableHtml = '<table><thead><tr><th>Company</th><th>Role</th><th>Duration</th><th>Type</th></tr></thead><tbody>';
        if (internships.length > 0) {
            internships.forEach(i => {
                internshipsTableHtml += `<tr><td>${i.companyName}</td><td>${i.role}</td><td>${i.duration}m</td><td>${i.internshipType}</td></tr>`;
            });
        } else {
            internshipsTableHtml += '<tr><td colspan="4" style="text-align: center;">No internships found</td></tr>';
        }
        internshipsTableHtml += '</tbody></table>';

        const lastReceipt = fees.find(f => f.receiptUri);
        const viewReceiptBtn = lastReceipt ? `<a href="${lastReceipt.receiptUri}" class="action-link" target="_blank">View Latest Receipt →</a>` : '';
        const lastCertificate = [...technical, ...internships].find(x => x.certificateUri);
        const viewCertBtn = lastCertificate ? `<a href="${lastCertificate.certificateUri}" class="action-link" target="_blank">View Certificates →</a>` : '';

        const b64LogoLeft = await getBase64Image(LOGO_LEFT_IMG);
        const b64LogoRight = await getBase64Image(LOGO_RIGHT_IMG);
        const b64StudentPhoto = await getBase64Image(student.photoUri || require('../../assets/images/icon.png'));

        const dataMap = {
            college_logo_left: b64LogoLeft,
            college_logo_right: b64LogoRight,
            report_title: options.all ? "Comprehensive Student Profile" : "Student Academic Report",
            gen_date: new Date().toLocaleString(),
            filters_used: `Dept: ${student.branch} | Year: ${student.yearOfStudy} | Div: ${student.division}`,
            student_photo: b64StudentPhoto,
            full_name: (student.fullName || '').toUpperCase(),
            prn: student.prn || '',
            branch: student.branch || '',
            year: student.yearOfStudy || '',
            division: student.division || '',
            dob: student.dob || '',
            gender: student.gender || '',
            email: student.email || '',
            phone: student.phone || '',
            aadhar: student.aadhar || '',
            category: student.category || '',
            permanent_addr: student.permanentAddress || '',
            temp_addr: student.temporaryAddress || student.permanentAddress || '',
            father_name: student.fatherName || '',
            mother_name: student.motherName || '',
            father_phone: student.fatherPhone || 'N/A',
            annual_income: `₹${student.annualIncome || '0'}`,
            ssc_school: student.sscSchool || 'N/A',
            ssc_total: student.sscMaxMarks ? student.sscMaxMarks.toString() : 'N/A',
            ssc_obtained: student.sscMarks ? student.sscMarks.toString() : 'N/A',
            ssc_perc: student.sscPercentage ? student.sscPercentage.toString() : '0',
            hsc_diploma_label: (student.admissionType === 'DSE' || !!student.diplomaCollege) ? 'Diploma' : 'HSC (12th)',
            hsc_diploma_college: (student.admissionType === 'DSE' || !!student.diplomaCollege) ? (student.diplomaCollege || 'N/A') : (student.hscCollege || 'N/A'),
            hsc_diploma_total: (student.admissionType === 'DSE' || !!student.diplomaCollege) ? (student.diplomaMaxMarks || 'N/A') : (student.hscMaxMarks || 'N/A'),
            hsc_diploma_obtained: (student.admissionType === 'DSE' || !!student.diplomaCollege) ? (student.diplomaMarks || 'N/A') : (student.hscMarks || 'N/A'),
            hsc_diploma_perc: (student.admissionType === 'DSE' || !!student.diplomaCollege) ? (student.diplomaPercentage || '0') : (student.hscPercentage || '0'),
            sgpa: academicRecords.length > 0 ? academicRecords[academicRecords.length - 1].sgpa?.toString() || 'N/A' : 'N/A',
            cgpa: academicRecords.length > 0 ? academicRecords[academicRecords.length - 1].cgpa?.toString() || 'N/A' : 'N/A',
            total_fee: fees.length > 0 ? (fees[0].totalFee || 0).toString() : '0',
            paid_fee: totalPaid.toString(),
            balance_fee: lastBalance.toString(),
            academic_table: academicTableHtml,
            fee_table: feeTableHtml,
            activities_table: activitiesTableHtml,
            internships_table: internshipsTableHtml,
            view_receipt_btn: viewReceiptBtn,
            view_certificate_btn: viewCertBtn
        };

        const htmlContent = populateTemplate(dataMap, false);

        await generatePDF({
            fileName: `${student.prn}_Academic_Report_${new Date().getTime()}.pdf`,
            data: student,
            htmlTemplate: htmlContent
        });

        setLoading(false);
    } catch (error) {
        console.error('Error generating PDF:', error);
        Alert.alert('Error', 'Failed to generate PDF. Please check your connection and try again.');
        setLoading(false);
    }
};
