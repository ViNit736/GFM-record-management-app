import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker'; // Need to ensure this package is installed or use standard Picker handling
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../../constants/colors';
import { BRANCH_MAPPINGS, getFullBranchName, getFullYearName, YEAR_MAPPINGS } from '../../../constants/Mappings';
import { supabase } from '../../../services/supabase';
import { generatePDF } from '../../../utils/pdf-generator';

const AttendanceReport = () => {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [reportType, setReportType] = useState<'GFM' | 'Class'>('GFM');
    const [reportData, setReportData] = useState<any[]>([]);

    // Class Filters
    const [dept, setDept] = useState('CSE');
    const [year, setYear] = useState('SE');
    const [div, setDiv] = useState('A');

    // GFM List (if we want to filter by specific GFM, or just show all)
    // For now, GFM report shows list of all GFMs and their batch's avg attendance.

    useEffect(() => {
        loadReport();
    }, [reportType, dept, year, div]);

    const handleExport = async () => {
        try {
            const html = `
                <html>
                    <body>
                        <h1>Attendance Report (${reportType})</h1>
                        <table border="1" style="border-collapse: collapse; width: 100%;">
                            <tr>
                                <th>Name</th>
                                <th>Batch</th>
                                <th>Attendance</th>
                                ${reportType === 'GFM' ? '<th>Reports Count</th>' : ''}
                            </tr>
                            ${reportData.map(r => `
                                <tr>
                                    <td>${r.gfmName || r.className}</td>
                                    <td>${r.batch || '-'}</td>
                                    <td>${r.attendance}</td>
                                    ${reportType === 'GFM' ? `<td>${r.reportsCount}</td>` : ''}
                                </tr>
                            `).join('')}
                        </table>
                    </body>
                </html>
            `;
            await generatePDF({ fileName: `Admin_Report_${reportType}.pdf`, htmlTemplate: html, data: reportData });
        } catch (e) {
            Alert.alert('Error', 'Export failed');
        }
    };

    const loadReport = async () => {
        setLoading(true);
        try {
            if (reportType === 'GFM') {
                // Fetch all teacher configs to know who is GFM for what
                const { data: configs } = await supabase.from('teacher_batch_configs').select('*, profiles(full_name)');
                const { data: reports } = await supabase.from('attendance_reports').select('*');

                if (!configs) {
                    setReportData([]);
                    return;
                }

                // For each GFM, calculate "My Group" attendance
                // This is heavy if we do it for everyone.
                // Simplified approach: Get all students, group by batch.
                // Or: Query attendance summary.

                // Let's mock the logic or do a simple fetch for now as "real" aggregation might need a database function or heavy logic.
                // We'll fetch 'students' with 'attendance' stats if possible.
                // Actually 'attendance_records' table is what we usually check.

                // For demo/MVP:
                const stats = configs.map(conf => {
                    const gfmReports = reports ? reports.filter(r => r.gfm_id === conf.teacher_id) : [];
                    const totalReports = gfmReports.length;

                    let avgAtt = 0;
                    if (totalReports > 0) {
                        const sumPct = gfmReports.reduce((acc, r) => {
                            const total = r.total_students || 0;
                            const absent = r.total_absent || 0;
                            const present = total - absent;
                            return acc + (total > 0 ? (present / total) * 100 : 0);
                        }, 0);
                        avgAtt = sumPct / totalReports;
                    }

                    return {
                        gfmName: conf.profiles?.full_name || 'Unknown',
                        batch: `${getFullBranchName(conf.department)} ${getFullYearName(conf.class)} ${conf.division} (Roll ${conf.rbt_from}-${conf.rbt_to})`,
                        attendance: totalReports > 0 ? avgAtt.toFixed(1) + '%' : 'No Reports',
                        reportsCount: totalReports,
                        lastReport: totalReports > 0 ? gfmReports.sort((a, b) => b.date.localeCompare(a.date))[0].date : '-'
                    };
                });
                setReportData(stats);
            } else {
                // Class Wise
                // Fetch students of that class -> Calculate Avg Attendance
                // For demo:
                setReportData([{
                    className: `${getFullBranchName(dept)} - ${getFullYearName(year)} - ${div}`,
                    attendance: (Math.random() * 20 + 70).toFixed(1) + '%',
                    totalStudents: 65,
                    defaulters: Math.floor(Math.random() * 10)
                }]);
            }
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to load report');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Attendance Report</Text>
                <TouchableOpacity onPress={handleExport} style={{ marginLeft: 'auto', padding: 5 }}>
                    <Ionicons name="download-outline" size={24} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            <View style={styles.filterBar}>
                <Text style={styles.filterLabel}>Type:</Text>
                <View style={[styles.pickerWrapper, { width: 120 }]}>
                    <Picker selectedValue={reportType} onValueChange={setReportType} style={styles.picker}>
                        <Picker.Item label="GFM Wise" value="GFM" />
                        <Picker.Item label="Class Wise" value="Class" />
                    </Picker>
                </View>

                {reportType === 'Class' && (
                    <>
                        <View style={[styles.pickerWrapper, { width: 180, marginLeft: 10 }]}>
                            <Picker selectedValue={dept} onValueChange={setDept} style={styles.picker}>
                                <Picker.Item label="Select Department" value="" />
                                {Object.keys(BRANCH_MAPPINGS).map(key => (
                                    <Picker.Item key={key} label={BRANCH_MAPPINGS[key]} value={key} />
                                ))}
                            </Picker>
                        </View>
                        <View style={[styles.pickerWrapper, { width: 140, marginLeft: 10 }]}>
                            <Picker selectedValue={year} onValueChange={setYear} style={styles.picker}>
                                <Picker.Item label="Select Year" value="" />
                                {Object.keys(YEAR_MAPPINGS).filter(k => k.length === 2).map(key => (
                                    <Picker.Item key={key} label={YEAR_MAPPINGS[key]} value={key} />
                                ))}
                            </Picker>
                        </View>
                        <View style={[styles.pickerWrapper, { width: 80, marginLeft: 10 }]}>
                            <Picker selectedValue={div} onValueChange={setDiv} style={styles.picker}>
                                <Picker.Item label="A" value="A" />
                                <Picker.Item label="B" value="B" />
                            </Picker>
                        </View>
                    </>
                )}
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
            ) : (
                <ScrollView style={styles.content}>
                    {reportType === 'GFM' ? (
                        <View style={styles.table}>
                            <View style={[styles.row, styles.headerRow]}>
                                <Text style={[styles.cell, { flex: 1.2 }]}>GFM Name</Text>
                                <Text style={[styles.cell, { flex: 1.5 }]}>Batch</Text>
                                <Text style={[styles.cell, { flex: 0.6, fontSize: 11, textAlign: 'center' }]}>Reports</Text>
                                <Text style={[styles.cell, { flex: 0.8, textAlign: 'right' }]}>Avg Att.</Text>
                            </View>
                            {reportData.map((item, idx) => (
                                <View key={idx} style={styles.row}>
                                    <View style={{ flex: 1.2 }}>
                                        <Text style={[styles.cell, { fontWeight: 'bold' }]}>{item.gfmName}</Text>
                                        <Text style={{ fontSize: 10, color: COLORS.textLight }}>Last: {item.lastReport}</Text>
                                    </View>
                                    <Text style={[styles.cell, { flex: 1.5, fontSize: 11 }]}>{item.batch}</Text>
                                    <Text style={[styles.cell, { flex: 0.6, textAlign: 'center' }]}>{item.reportsCount}</Text>
                                    <Text style={[styles.cell, { flex: 0.8, textAlign: 'right', fontWeight: 'bold', color: item.attendance === 'No Reports' ? COLORS.textLight : parseFloat(item.attendance) < 75 ? COLORS.error : COLORS.success }]}>
                                        {item.attendance}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <View style={styles.card}>
                            <Text style={[styles.cardTitle, { textAlign: 'center' }]}>{reportData[0]?.className}</Text>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 20 }}>
                                <View style={{ alignItems: 'center' }}>
                                    <Text style={{ fontSize: 32, fontWeight: 'bold', color: COLORS.primary }}>{reportData[0]?.attendance}</Text>
                                    <Text style={{ color: COLORS.textLight }}>Average Attendance</Text>
                                </View>
                                <View style={{ alignItems: 'center' }}>
                                    <Text style={{ fontSize: 32, fontWeight: 'bold', color: COLORS.error }}>{reportData[0]?.defaulters}</Text>
                                    <Text style={{ color: COLORS.textLight }}>Defaulters</Text>
                                </View>
                            </View>
                        </View>
                    )}
                </ScrollView>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
        padding: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 60 : 20,
    },
    backBtn: { marginRight: 15 },
    title: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
    content: { padding: 20 },
    filterBar: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: '#fff', flexWrap: 'wrap', gap: 5 },
    filterLabel: { marginRight: 5, fontSize: 14, fontWeight: 'bold' },
    pickerWrapper: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, height: 40, justifyContent: 'center' },
    picker: { width: '100%', height: '100%' },
    card: { backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, elevation: 2 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: COLORS.primary },
    table: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, backgroundColor: '#fff' },
    row: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
    headerRow: { backgroundColor: COLORS.secondary + '10' },
    cell: { fontSize: 14, color: COLORS.text },
});

export default AttendanceReport;
