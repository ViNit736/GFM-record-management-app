import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { COLORS } from '../../constants/colors';
import { getFullBranchName, getFullYearName } from '../../constants/Mappings';
import { populateTemplate } from '../../services/pdf-template.service';
import {
    getAcademicRecordsByStudent,
    getAchievements,
    getFeePayments,
    getInternships,
    getStudentActivities,
    Student
} from '../../storage/sqlite';
import { styles } from './dashboard.styles';
import { getBase64Image } from './dashboard.utils';
import { DetailItem } from './DetailItem';

// Correct local assets
const LOGO_LEFT_IMG = require('../../assets/images/left.png');
const LOGO_RIGHT_IMG = require('../../assets/images/right.png');

interface StudentDetailsModalProps {
    student: Student | null;
    visible: boolean;
    onClose: () => void;
    onExportPDF: (student: any, options: any) => Promise<void>;
    onQuickEdit: (student: any, section: string) => void;
}

export const StudentDetailsModal = ({ student, visible, onClose, onExportPDF, onQuickEdit }: StudentDetailsModalProps) => {
    const { width } = useWindowDimensions();
    const [viewMode, setViewMode] = useState<'details' | 'template'>('template');
    const [htmlContent, setHtmlContent] = useState('');
    const [templateLoading, setTemplateLoading] = useState(false);
    const [activities, setActivities] = useState<any[]>([]);
    const [achievements, setAchievements] = useState<any[]>([]);
    const [internships, setInternships] = useState<any[]>([]);
    const [fees, setFees] = useState<any[]>([]);
    const isWeb = Platform.OS === 'web';

    useEffect(() => {
        if (visible && student) {
            prepareHtml();
        }
    }, [visible, student]);

    const prepareHtml = async () => {
        if (!student) return;
        setTemplateLoading(true);
        try {
            const currentStudent = student; // Local variable for type narrowing
            const academicRecords = await getAcademicRecordsByStudent(currentStudent.prn);
            const feeList = await getFeePayments(currentStudent.prn);
            const activityList = await getStudentActivities(currentStudent.prn);
            const achievementList = await getAchievements(currentStudent.prn);
            const internshipList = await getInternships(currentStudent.prn);

            setActivities(activityList);
            setAchievements(achievementList);
            setInternships(internshipList);
            setFees(feeList);

            let totalPaid = 0;
            let lastBalance = 0;
            feeList.forEach(f => {
                totalPaid += (f.amountPaid || 0);
                lastBalance = f.remainingBalance || 0;
            });

            let academicTable = '<table><thead><tr><th>Sem</th><th>Course</th><th>MSE</th><th>ESE</th><th>Grade</th></tr></thead><tbody>';
            if (academicRecords.length > 0) {
                academicRecords.forEach(r => {
                    academicTable += `<tr><td>${r.semester}</td><td>${r.courseName}</td><td>${r.mseMarks || 0}</td><td>${r.eseMarks || 0}</td><td>${r.grade}</td></tr>`;
                });
            } else {
                academicTable += '<tr><td colspan="5">No academic records</td></tr>';
            }
            academicTable += '</tbody></table>';

            let feeTable = '<table><thead><tr><th>Year</th><th>Inst.</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead><tbody>';
            if (fees.length > 0) {
                fees.forEach(f => {
                    feeTable += `<tr><td>${f.academicYear}</td><td>${f.installmentNumber}</td><td>₹${f.amountPaid}</td><td>₹${f.remainingBalance}</td><td>${f.verificationStatus}</td></tr>`;
                });
            } else {
                feeTable += '<tr><td colspan="5">No fee records</td></tr>';
            }
            feeTable += '</tbody></table>';

            const combined = [
                ...activities.map(a => ({
                    date: a.activityDate,
                    type: a.type === 'Co-curricular' ? 'Technical' : (a.type === 'Extra-curricular' ? 'Non-Technical' : a.type),
                    name: a.activityName,
                    status: a.verificationStatus
                })),
                ...achievements.map(ach => ({
                    date: ach.achievementDate,
                    type: ach.type || 'Technical',
                    name: ach.achievementName,
                    status: ach.verificationStatus
                }))
            ];

            const activitiesTable = `
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Activity/Achievement Name</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${combined.length > 0 ? combined.map(a => `
                    <tr>
                      <td><strong>${a.type}</strong></td>
                      <td>${a.name}</td>
                      <td>${a.date}</td>
                      <td class="status-${(a.status || 'Pending').toLowerCase()}">${a.status || 'Pending'}</td>
                    </tr>
                  `).join('') : '<tr><td colspan="4" style="text-align:center">No records found</td></tr>'}
                </tbody>
              </table>
            `;

            const internshipsTable = `<table><thead><tr><th>Company</th><th>Role</th><th>Status</th></tr></thead><tbody>${internships.length > 0 ? internships.map(i => `<tr><td>${i.companyName}</td><td>${i.role}</td><td>${i.verificationStatus}</td></tr>`).join('') : '<tr><td colspan="3">No records</td></tr>'}</tbody></table>`;

            const b64LogoLeft = await getBase64Image(LOGO_LEFT_IMG);
            const b64LogoRight = await getBase64Image(LOGO_RIGHT_IMG);
            const b64StudentPhoto = await getBase64Image(currentStudent.photoUri || require('../../assets/images/icon.png'));

            const dataMap = {
                college_logo_left: b64LogoLeft,
                college_logo_right: b64LogoRight,
                report_title: "Full Student Academic Record",
                gen_date: new Date().toLocaleDateString(),
                filters_used: `${getFullBranchName(currentStudent.branch)} | ${getFullYearName(currentStudent.yearOfStudy)} | Div: ${currentStudent.division}`,
                student_photo: b64StudentPhoto,
                full_name: (currentStudent.fullName || '').toUpperCase(),
                prn: currentStudent.prn || '',
                branch: getFullBranchName(currentStudent.branch) || '',
                year: getFullYearName(currentStudent.yearOfStudy) || '',
                division: currentStudent.division || '',
                dob: currentStudent.dob || '',
                gender: currentStudent.gender || '',
                email: currentStudent.email || '',
                phone: currentStudent.phone || '',
                aadhar: currentStudent.aadhar || '',
                category: currentStudent.category || '',
                permanent_addr: currentStudent.permanentAddress || '',
                temp_addr: currentStudent.temporaryAddress || currentStudent.permanentAddress || '',
                father_name: currentStudent.fatherName || '',
                mother_name: currentStudent.motherName || '',
                father_phone: currentStudent.fatherPhone || 'N/A',
                annual_income: `₹${currentStudent.annualIncome || '0'}`,
                ssc_school: currentStudent.sscSchool || 'N/A',
                ssc_total: currentStudent.sscMaxMarks ? currentStudent.sscMaxMarks.toString() : 'N/A',
                ssc_obtained: currentStudent.sscMarks ? currentStudent.sscMarks.toString() : 'N/A',
                ssc_perc: currentStudent.sscPercentage ? currentStudent.sscPercentage.toString() : '0',
                hsc_diploma_label: (currentStudent.admissionType === 'DSE' || !!currentStudent.diplomaCollege) ? 'Diploma' : 'HSC (12th)',
                hsc_diploma_college: (currentStudent.admissionType === 'DSE' || !!currentStudent.diplomaCollege) ? (currentStudent.diplomaCollege || 'N/A') : (currentStudent.hscCollege || 'N/A'),
                hsc_diploma_total: (currentStudent.admissionType === 'DSE' || !!currentStudent.diplomaCollege) ? (currentStudent.diplomaMaxMarks || 'N/A') : (currentStudent.hscMaxMarks || 'N/A'),
                hsc_diploma_obtained: (currentStudent.admissionType === 'DSE' || !!currentStudent.diplomaCollege) ? (currentStudent.diplomaMarks || 'N/A') : (currentStudent.hscMarks || 'N/A'),
                hsc_diploma_perc: (currentStudent.admissionType === 'DSE' || !!currentStudent.diplomaCollege) ? (currentStudent.diplomaPercentage || '0') : (currentStudent.hscPercentage || '0'),
                sgpa: academicRecords.length > 0 ? academicRecords[academicRecords.length - 1].sgpa?.toString() || 'N/A' : 'N/A',
                cgpa: academicRecords.length > 0 ? academicRecords[academicRecords.length - 1].cgpa?.toString() || 'N/A' : 'N/A',
                total_fee: fees.length > 0 ? (fees[0].totalFee || 0).toString() : '0',
                paid_fee: totalPaid.toString(),
                balance_fee: lastBalance.toString(),
                academic_table: academicTable,
                fee_table: feeTable,
                activities_table: activitiesTable,
                internships_table: internshipsTable,
                view_receipt_btn: '',
                view_certificate_btn: ''
            };

            setHtmlContent(populateTemplate(dataMap, false));

        } catch (e) {
            console.error(e);
        } finally {
            setTemplateLoading(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={[styles.modalBody, { width: '95%', maxWidth: 900, height: '90%', padding: 0, overflow: 'hidden' }]}>
                    <View style={[styles.modalHeader, { padding: 20, marginBottom: 0 }]}>
                        <View>
                            <Text style={styles.modalTitle}>Student Profile Preview</Text>
                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 5 }}>
                                <TouchableOpacity onPress={() => setViewMode('template')} style={{ borderBottomWidth: 2, borderBottomColor: viewMode === 'template' ? COLORS.secondary : 'transparent' }}>
                                    <Text style={{ color: viewMode === 'template' ? COLORS.secondary : COLORS.textLight, fontWeight: 'bold' }}>Template View</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setViewMode('details')} style={{ borderBottomWidth: 2, borderBottomColor: viewMode === 'details' ? COLORS.secondary : 'transparent' }}>
                                    <Text style={{ color: viewMode === 'details' ? COLORS.secondary : COLORS.textLight, fontWeight: 'bold' }}>Data View</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={COLORS.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
                        {!student ? (
                            <View style={{ padding: 40, alignItems: 'center' }}>
                                <ActivityIndicator size="large" color={COLORS.secondary} />
                            </View>
                        ) : viewMode === 'template' ? (
                            isWeb ? (
                                <View style={{ padding: 20, alignItems: 'center' }}>
                                    {templateLoading ? (
                                        <View style={{ marginTop: 50, alignItems: 'center' }}>
                                            <ActivityIndicator size="large" color={COLORS.secondary} />
                                            <Text style={{ marginTop: 10, color: COLORS.textLight }}>Generating Profile Preview...</Text>
                                        </View>
                                    ) : (
                                        <div
                                            style={{
                                                backgroundColor: 'white',
                                                boxShadow: '0 0 10px rgba(0,0,0,0.1)',
                                                width: '210mm',
                                                minHeight: '297mm',
                                                transform: width < 900 ? `scale(${width / 1000})` : 'none',
                                                transformOrigin: 'top center'
                                            }}
                                            dangerouslySetInnerHTML={{ __html: htmlContent }}
                                        />
                                    )}
                                </View>
                            ) : (
                                <View style={{ padding: 20 }}>
                                    <Text>Template view is optimized for Web. Please use Data View on mobile.</Text>
                                </View>
                            )
                        ) : (
                            <View style={{ padding: 20 }}>
                                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                                    <Image
                                        source={{ uri: student.photoUri || require('../../assets/images/icon.png') }}
                                        style={{ width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: COLORS.secondary }}
                                    />
                                </View>
                                <View style={styles.detailSection}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                        <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Personal Information</Text>
                                        <TouchableOpacity onPress={() => onQuickEdit(student, 'Personal Information')}>
                                            <Ionicons name="pencil" size={18} color={COLORS.secondary} />
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.detailGrid}>
                                        <DetailItem label="PRN" value={student.prn} />
                                        <DetailItem label="Roll No" value={student.rollNo} />
                                        <DetailItem label="Full Name" value={student.fullName} />
                                        <DetailItem label="Gender" value={student.gender} />
                                        <DetailItem label="Religion" value={student.religion} />
                                        <DetailItem label="Category" value={student.category} />
                                        <DetailItem label="Caste" value={student.caste} />
                                        <DetailItem label="DOB" value={student.dob} />
                                        <DetailItem label="Aadhar" value={student.aadhar} />
                                    </View>
                                </View>

                                <View style={styles.detailSection}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                        <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Academic Status</Text>
                                        <TouchableOpacity onPress={() => onQuickEdit(student, 'Academic Status')}>
                                            <Ionicons name="pencil" size={18} color={COLORS.secondary} />
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.detailGrid}>
                                        <DetailItem label="Department" value={getFullBranchName(student.branch)} />
                                        <DetailItem label="Year" value={getFullYearName(student.yearOfStudy)} />
                                        <DetailItem label="Division" value={student.division} />
                                        <DetailItem label="Verification" value={student.verificationStatus} color={student.verificationStatus === 'Verified' ? COLORS.success : COLORS.warning} />
                                    </View>
                                </View>

                                <View style={styles.detailSection}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                        <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Contact & Address</Text>
                                        <TouchableOpacity onPress={() => onQuickEdit(student, 'Contact & Address')}>
                                            <Ionicons name="pencil" size={18} color={COLORS.secondary} />
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.detailGrid}>
                                        <DetailItem label="Phone" value={student.phone} />
                                        <DetailItem label="Email" value={student.email} />
                                        <DetailItem label="Pincode" value={student.pincode} />
                                        <DetailItem label="Permanent Address" value={student.permanentAddress} fullWidth />
                                        <DetailItem label="Temporary Address" value={student.temporaryAddress || student.permanentAddress} fullWidth />
                                    </View>
                                </View>

                                <View style={styles.detailSection}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                        <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Family Details</Text>
                                        <TouchableOpacity onPress={() => onQuickEdit(student, 'Family Details')}>
                                            <Ionicons name="pencil" size={18} color={COLORS.secondary} />
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.detailGrid}>
                                        <DetailItem label="Father's Name" value={student.fatherName} />
                                        <DetailItem label="Mother's Name" value={student.motherName} />
                                        <DetailItem label="Father's Occupation" value={student.fatherOccupation} />
                                        <DetailItem label="Annual Income" value={student.annualIncome} />
                                        <DetailItem label="Father's Phone" value={student.fatherPhone} />
                                        <DetailItem label="Mother's Phone" value={student.motherPhone} />
                                    </View>
                                </View>

                                <View style={styles.detailSection}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                        <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Education History</Text>
                                        <TouchableOpacity onPress={() => onQuickEdit(student, 'Education History')}>
                                            <Ionicons name="pencil" size={18} color={COLORS.secondary} />
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.detailGrid}>
                                        <DetailItem label="SSC School" value={student.sscSchool} />
                                        <DetailItem label="SSC Marks" value={`${student.sscMarks}/${student.sscMaxMarks} (${student.sscPercentage}%)`} />

                                        {(student.admissionType === 'DSE' || !!student.diplomaCollege) ? (
                                            <>
                                                <DetailItem label="Diploma College" value={student.diplomaCollege} />
                                                <DetailItem label="Diploma Marks" value={`${student.diplomaMarks}/${student.diplomaMaxMarks} (${student.diplomaPercentage}%)`} />
                                                <DetailItem label="Diploma Branch" value={student.diplomaBranch} />
                                            </>
                                        ) : (
                                            <>
                                                <DetailItem label="HSC College" value={student.hscCollege} />
                                                <DetailItem label="HSC Marks" value={`${student.hscMarks}/${student.hscMaxMarks} (${student.hscPercentage}%)`} />
                                            </>
                                        )}
                                    </View>
                                </View>

                                {/* New Comprehensive Sections */}
                                <View style={styles.detailSection}>
                                    <Text style={styles.sectionTitle}>Activities & Achievements</Text>
                                    {activities.length === 0 && achievements.length === 0 ? (
                                        <Text style={styles.emptyText}>No activities or achievements recorded.</Text>
                                    ) : (
                                        <View style={{ gap: 10 }}>
                                            {activities.map((a, i) => (
                                                <View key={`act-${i}`} style={{ backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#eee' }}>
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                        <Text style={{ fontWeight: 'bold', color: COLORS.text }}>{a.activityName}</Text>
                                                        <Text style={{ fontSize: 11, color: a.verificationStatus === 'Verified' ? COLORS.success : COLORS.warning }}>{a.verificationStatus}</Text>
                                                    </View>
                                                    <Text style={{ fontSize: 12, color: COLORS.textLight, marginTop: 4 }}>{a.type} • {a.activityDate}</Text>
                                                </View>
                                            ))}
                                            {achievements.map((a, i) => (
                                                <View key={`ach-${i}`} style={{ backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#eee' }}>
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                        <Text style={{ fontWeight: 'bold', color: COLORS.secondary }}>{a.achievementName}</Text>
                                                        <Text style={{ fontSize: 11, color: a.verificationStatus === 'Verified' ? COLORS.success : COLORS.warning }}>{a.verificationStatus}</Text>
                                                    </View>
                                                    <Text style={{ fontSize: 12, color: COLORS.textLight, marginTop: 4 }}>{a.type} • {a.achievementDate}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </View>

                                <View style={styles.detailSection}>
                                    <Text style={styles.sectionTitle}>Internships</Text>
                                    {internships.length === 0 ? (
                                        <Text style={styles.emptyText}>No internships recorded.</Text>
                                    ) : (
                                        <View style={{ gap: 10 }}>
                                            {internships.map((a, i) => (
                                                <View key={`int-${i}`} style={{ backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#eee' }}>
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                        <Text style={{ fontWeight: 'bold', color: COLORS.text }}>{a.companyName}</Text>
                                                        <Text style={{ fontSize: 11, color: a.verificationStatus === 'Verified' ? COLORS.success : COLORS.warning }}>{a.verificationStatus}</Text>
                                                    </View>
                                                    <Text style={{ fontSize: 12, color: COLORS.textLight, marginTop: 4 }}>{a.role} • {a.duration}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </View>

                                <View style={styles.detailSection}>
                                    <Text style={styles.sectionTitle}>Fee Payment Status</Text>
                                    {fees.length === 0 ? (
                                        <Text style={styles.emptyText}>No fee records found.</Text>
                                    ) : (
                                        <View style={{ gap: 10 }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: COLORS.primary + '10', padding: 12, borderRadius: 12, marginBottom: 5 }}>
                                                <View>
                                                    <Text style={{ fontSize: 11, color: COLORS.textLight }}>TOTAL FEE</Text>
                                                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: COLORS.primary }}>₹{fees[0].totalFee || 0}</Text>
                                                </View>
                                                <View style={{ alignItems: 'flex-end' }}>
                                                    <Text style={{ fontSize: 11, color: COLORS.textLight }}>BALANCE</Text>
                                                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: COLORS.error }}>₹{fees[fees.length - 1].remainingBalance || 0}</Text>
                                                </View>
                                            </View>
                                            {fees.map((a, i) => (
                                                <View key={`fee-${i}`} style={{ backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#eee', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <View>
                                                        <Text style={{ fontWeight: 'bold', color: COLORS.text }}>Installment {a.installmentNumber}</Text>
                                                        <Text style={{ fontSize: 12, color: COLORS.textLight }}>{a.paymentDate || 'No date'}</Text>
                                                    </View>
                                                    <View style={{ alignItems: 'flex-end' }}>
                                                        <Text style={{ fontWeight: 'bold', color: COLORS.success }}>₹{a.amountPaid}</Text>
                                                        <Text style={{ fontSize: 10, color: COLORS.textLight }}>{a.verificationStatus}</Text>
                                                    </View>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}
                    </ScrollView>

                    <View style={[styles.row, { borderTopWidth: 1, borderTopColor: '#eee', padding: 20, backgroundColor: '#fff', justifyContent: 'center', gap: 20 }]}>
                        <TouchableOpacity
                            style={[styles.btn, { backgroundColor: COLORS.secondary, maxWidth: 250 }]}
                            onPress={() => setViewMode('template')}
                        >
                            <Ionicons name="eye-outline" size={20} color="#fff" />
                            <Text style={[styles.btnText, { marginLeft: 8 }]}>Preview Report</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.btn, { backgroundColor: COLORS.primary, maxWidth: 250 }]}
                            onPress={() => onExportPDF(student, { all: true })}
                        >
                            <Ionicons name="print-outline" size={20} color="#fff" />
                            <Text style={[styles.btnText, { marginLeft: 8 }]}>Download PDF</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};
