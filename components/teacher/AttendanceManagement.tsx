import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../constants/colors';
import { getSession } from '../../services/session.service';
import { supabase } from '../../services/supabase';
import {
    AttendanceRecord,
    AttendanceSession,
    createAttendanceSession,
    getAttendanceRecords,
    saveAttendanceRecords,
    Student,
    toCamelCase
} from '../../storage/sqlite';
import { styles } from './dashboard.styles';

export const AttendanceManagement = ({
    students: authorizedStudents,
    filters,
    loadData,
    batchConfig
}: {
    students: Student[],
    filters: any,
    loadData: () => void,
    batchConfig?: any
}) => {
    const [students, setStudents] = useState<Student[]>([]);
    const [absentPrns, setAbsentPrns] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [session, setSession] = useState<AttendanceSession | null>(null);
    const [calledPrns, setCalledPrns] = useState<Set<string>>(new Set());

    const isWeb = Platform.OS === 'web';

    useEffect(() => {
        const dept = batchConfig?.department || filters.dept;
        const year = batchConfig?.class || filters.year;
        const div = batchConfig?.division || filters.div;

        if (dept !== 'All' && year !== 'All' && div !== 'All') {
            initAttendance();
        }
    }, [filters, batchConfig]);

    const initAttendance = async () => {
        setLoading(true);
        const s = await getSession();
        if (!s) return;

        try {
            const dept = batchConfig?.department || filters.dept;
            const year = batchConfig?.class || filters.year;
            const div = batchConfig?.division || filters.div;

            // Check if attendance already taken today for this division
            const today = new Date().toISOString().split('T')[0];
            const { data: existingSession, error } = await supabase
                .from('attendance_sessions')
                .select('*')
                .eq('date', today)
                .eq('department', dept)
                .eq('academic_year', year)
                .eq('division', div)
                .maybeSingle();

            if (existingSession) {
                setSession(toCamelCase(existingSession));
                const records = await getAttendanceRecords(existingSession.id);
                const absents = new Set(records.filter(r => r.status === 'Absent').map(r => r.studentPrn));
                setAbsentPrns(absents);
            } else {
                setSession(null);
                setAbsentPrns(new Set());
            }

            // Fetch calls for today
            const { data: todayCalls } = await supabase
                .from('communication_logs')
                .select('student_prn')
                .eq('communication_type', 'call')
                .gte('created_at', today + 'T00:00:00')
                .lte('created_at', today + 'T23:59:59');

            if (todayCalls) {
                setCalledPrns(new Set(todayCalls.map(c => c.student_prn)));
            }

            setStudents(authorizedStudents || []);

            if (todayCalls) {
                setCalledPrns(new Set(todayCalls.map(c => c.student_prn)));
            }

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const toggleAbsent = (prn: string) => {
        if (session?.locked) return;
        setAbsentPrns(prev => {
            const next = new Set(prev);
            if (next.has(prn)) next.delete(prn);
            else next.add(prn);
            return next;
        });
    };

    const handleSubmit = async () => {
        if (students.length === 0) return;

        const confirmMsg = `Are you sure? Marking ${absentPrns.size} students as absent out of ${students.length}.`;
        if (!isWeb) {
            Alert.alert('Confirm Submission', confirmMsg, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Submit', onPress: submitFinal }
            ]);
        } else {
            if (window.confirm(confirmMsg)) submitFinal();
        }
    };

    const submitFinal = async () => {
        setSubmitting(true);
        try {
            const s = await getSession();
            const dept = batchConfig?.department || filters.dept;
            const year = batchConfig?.class || filters.year;
            const div = batchConfig?.division || filters.div;

            const newSession = await createAttendanceSession({
                teacherId: s!.id,
                date: new Date().toISOString().split('T')[0],
                academicYear: year,
                department: dept,
                class: year,
                division: div,
                locked: true,
                batchName: batchConfig?.batchName || `${dept} ${year} Div ${div}`,
                rbtFrom: batchConfig?.rbtFrom,
                rbtTo: batchConfig?.rbtTo
            });

            const records: AttendanceRecord[] = students.map(st => ({
                sessionId: newSession.id,
                studentPrn: st.prn,
                status: absentPrns.has(st.prn) ? 'Absent' : 'Present',
                remark: ''
            }));

            await saveAttendanceRecords(records);
            setSession(newSession);
            Alert.alert('Success', 'Attendance recorded successfully');
            loadData();
        } catch (e) {
            Alert.alert('Error', 'Failed to record attendance');
        } finally {
            setSubmitting(false);
        }
    };

    if ((!batchConfig) && (filters.dept === 'All' || filters.year === 'All' || filters.div === 'All')) {
        return (
            <View style={[styles.moduleCard, { alignItems: 'center', padding: 40 }]}>
                <Ionicons name="filter-outline" size={48} color={COLORS.primary} />
                <Text style={{ marginTop: 10, fontSize: 16, fontWeight: 'bold' }}>Configuration Required</Text>
                <Text style={{ textAlign: 'center', color: COLORS.textLight, marginTop: 5 }}>
                    Your batch configuration is missing or incomplete. Please contact the Administrator.
                </Text>
            </View>
        );
    }

    if (loading) return <ActivityIndicator size="large" color={COLORS.primary} />;

    return (
        <View style={styles.moduleCard}>
            <View style={styles.moduleHeader}>
                <View>
                    <Text style={styles.moduleTitle}>Attendance Taker</Text>
                    <Text style={styles.helperText}>
                        {(batchConfig?.class || filters.year)} {(batchConfig?.division || filters.div)} | {students.length} Students
                    </Text>
                </View>
                {session?.locked ? (
                    <View style={{ backgroundColor: COLORS.success + '20', padding: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="lock-closed" size={16} color={COLORS.success} />
                        <Text style={{ color: COLORS.success, fontWeight: 'bold', marginLeft: 5 }}>Submitted</Text>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={[styles.saveBtn, { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }]}
                        onPress={handleSubmit}
                        disabled={submitting || students.length === 0}
                    >
                        {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>Submit Absentees</Text>}
                    </TouchableOpacity>
                )}
            </View>

            <Text style={[styles.helperText, { marginBottom: 15, color: COLORS.secondary }]}>
                * Tap on students who are ABSENT. All others are marked Present by default.
            </Text>

            <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableHeader]}>
                    <Text style={[styles.tableCell, { flex: 0.8 }]}>Roll / PRN</Text>
                    <Text style={[styles.tableCell, { flex: 2 }]}>Student Name</Text>
                    <Text style={[styles.tableCell, { flex: 1, textAlign: 'center' }]}>Status</Text>
                </View>
                <FlatList
                    data={students}
                    keyExtractor={item => item.prn}
                    scrollEnabled={false}
                    renderItem={({ item }) => {
                        const isAbsent = absentPrns.has(item.prn);
                        return (
                            <TouchableOpacity
                                style={[styles.tableRow, isAbsent && { backgroundColor: COLORS.error + '05' }]}
                                onPress={() => toggleAbsent(item.prn)}
                                disabled={session?.locked}
                            >
                                <Text style={[styles.tableCell, { flex: 1 }]}>{item.rollNo || item.prn.slice(-3)}</Text>
                                <Text style={[styles.tableCell, { flex: 2, fontWeight: isAbsent ? 'bold' : 'normal' }]}>{item.fullName}</Text>
                                <View style={[
                                    { flex: 1, paddingVertical: 6, borderRadius: 6, alignItems: 'center' },
                                    !isAbsent ? { backgroundColor: COLORS.success + '15' } : { backgroundColor: COLORS.error + '15' }
                                ]}>
                                    <Text style={{
                                        fontWeight: 'bold', fontSize: 12,
                                        color: !isAbsent ? COLORS.success : COLORS.error
                                    }}>
                                        {isAbsent ? 'ABSENT' : 'PRESENT'}
                                    </Text>
                                    {calledPrns.has(item.prn) && (
                                        <View style={{ position: 'absolute', top: -5, right: -5, backgroundColor: COLORS.secondary, borderRadius: 10, width: 18, height: 18, justifyContent: 'center', alignItems: 'center' }}>
                                            <Ionicons name="call" size={10} color="#fff" />
                                        </View>
                                    )}
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                />
            </View>
        </View>
    );
};
