import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import { COLORS } from '../../constants/colors';
import { generateDetailedGFMReportCSV, generateTodayAttendanceCSV, saveAndShareCSV } from '../../services/csv.service';
import { getAdminAnalytics } from '../../storage/sqlite';
import { handleViewDocument } from './dashboard.utils';

const isWeb = Platform.OS === 'web';
const screenWidth = Dimensions.get("window").width;

interface AuditItem {
    dept: string;
    year: string;
    div: string;
    batch: string;
    name: string;
    rollNo: string;
    prn: string;
    date: string;
    status: string;
    gfmName: string;
    callTime: string;
    reason: string;
    leaveNote: string;
    leaveProofUrl?: string | null;
    leaveAddedAt?: string;
    isCompliant: boolean;
    fullDate: string;
}

export const AdminReportsManagement = ({ filters }: any) => {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isLargeScreen = width >= 1024;

    const [reportType, setReportType] = useState<'attendance' | 'gfm-audit'>('attendance');
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);
    const [showFilterModal, setShowFilterModal] = useState(false);

    // Initial state from props
    const [localFilters, setLocalFilters] = useState({
        dept: filters.dept || 'All',
        year: filters.year || 'All',
        div: filters.div || 'All',
        date: new Date().toISOString().split('T')[0],
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        gfmSearch: ''
    });

    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    useEffect(() => {
        setLocalFilters(prev => ({
            ...prev,
            dept: filters.dept || 'All',
            year: filters.year || 'All',
            div: filters.div || 'All',
        }));
    }, [filters]);

    useEffect(() => {
        loadData();
    }, [localFilters.dept, localFilters.year]);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await getAdminAnalytics();
            setStats(data);
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to load report data');
        } finally {
            setLoading(false);
        }
    };

    const getPieChartData = () => {
        if (!stats) return [];

        const relevantBatches = stats.batchConfigs.filter((b: any) => {
            const batchYear = b.class || '';
            const filterYear = localFilters.year || 'All';
            const yearMatch = filterYear === 'All' ||
                batchYear === filterYear ||
                (filterYear === 'First Year' && (batchYear === 'FE' || batchYear === '1st')) ||
                (filterYear === 'Second Year' && (batchYear === 'SE' || batchYear === '2nd')) ||
                (filterYear === 'Third Year' && (batchYear === 'TE' || batchYear === '3rd')) ||
                (filterYear === 'Final Year' && (batchYear === 'BE' || batchYear === '4th'));

            return (localFilters.dept === 'All' || b.department === localFilters.dept) && yearMatch;
        });

        if (localFilters.div !== 'All') {
            const subBatchStats: Record<string, number> = {};
            relevantBatches
                .filter((b: any) => b.division && (b.division[0].toUpperCase() === localFilters.div.toUpperCase()))
                .forEach((batch: any) => {
                    const batchKey = batch.batchName || 'Default';
                    if (!subBatchStats[batchKey]) subBatchStats[batchKey] = 0;

                    const extractTailNum = (str: string) => {
                        const match = String(str).match(/\d+$/);
                        return match ? parseInt(match[0]) : NaN;
                    };

                    const batchAbsents = stats.absentRecords.filter((r: any) => {
                        const rollNo = extractTailNum(r.rollNo || r.studentPrn);
                        const fromVal = extractTailNum(batch.rbtFrom);
                        const toVal = extractTailNum(batch.rbtTo);
                        const session = stats.sessions.find((s: any) => s.id === r.sessionId);

                        if (isNaN(rollNo) || isNaN(fromVal) || isNaN(toVal)) return false;

                        // Modulo logic for multi-year safety
                        const seq = rollNo % 1000;
                        const fSeq = fromVal % 1000;
                        const tSeq = toVal % 1000;

                        return session &&
                            session.department === batch.department &&
                            session.division === batch.division &&
                            seq >= fSeq && seq <= tSeq;
                    });
                    subBatchStats[batchKey] += batchAbsents.length;
                });

            const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];
            return Object.entries(subBatchStats)
                .map(([name, count], idx) => ({
                    name: `Batch ${name}`,
                    population: count,
                    color: colors[idx % colors.length],
                    legendFontColor: '#7F7F7F',
                    legendFontSize: 12
                }))
                .filter(d => d.population > 0);
        }

        const divisionStats: any = { 'A': 0, 'B': 0, 'C': 0 };
        const extractTailNum = (str: string) => {
            const match = String(str).match(/\d+$/);
            return match ? parseInt(match[0]) : NaN;
        };

        relevantBatches.forEach((batch: any) => {
            const mainDiv = batch.division ? batch.division[0].toUpperCase() : 'Unknown';
            if (!divisionStats[mainDiv]) divisionStats[mainDiv] = 0;

            const batchAbsents = stats.absentRecords.filter((r: any) => {
                const rollNo = extractTailNum(r.rollNo || r.studentPrn);
                const fromVal = extractTailNum(batch.rbtFrom);
                const toVal = extractTailNum(batch.rbtTo);
                const session = stats.sessions.find((s: any) => s.id === r.sessionId);

                if (isNaN(rollNo) || isNaN(fromVal) || isNaN(toVal)) return false;

                const seq = rollNo % 1000;
                const fSeq = fromVal % 1000;
                const tSeq = toVal % 1000;

                return session &&
                    session.department === batch.department &&
                    session.division === mainDiv &&
                    seq >= fSeq && seq <= tSeq;
            });
            divisionStats[mainDiv] += batchAbsents.length;
        });

        return [
            { name: 'Div A', population: divisionStats['A'] || 0, color: '#FF6384', legendFontColor: '#7F7F7F', legendFontSize: 12 },
            { name: 'Div B', population: divisionStats['B'] || 0, color: '#36A2EB', legendFontColor: '#7F7F7F', legendFontSize: 12 },
            { name: 'Div C', population: divisionStats['C'] || 0, color: '#FFCE56', legendFontColor: '#7F7F7F', legendFontSize: 12 },
        ].filter(d => d.population > 0);
    };

    const getAuditData = () => {
        if (!stats) return [];

        let filteredAbsents = stats.absentRecords;

        if (localFilters.startDate && localFilters.endDate && localFilters.endDate !== localFilters.startDate) {
            filteredAbsents = filteredAbsents.filter((r: any) => {
                const rDate = new Date(r.createdAt || new Date()).toISOString().split('T')[0];
                return rDate >= localFilters.startDate && rDate <= localFilters.endDate;
            });
        } else {
            const targetDate = localFilters.startDate || localFilters.date;
            filteredAbsents = filteredAbsents.filter((r: any) => {
                const rDate = new Date(r.createdAt || new Date()).toISOString().split('T')[0];
                return rDate === targetDate;
            });
        }

        return filteredAbsents.map((absent: any) => {
            const absentDateStr = new Date(absent.createdAt || new Date()).toLocaleDateString();
            const callLog = stats.calls.find((c: any) =>
                c.studentPrn === absent.studentPrn &&
                new Date(c.createdAt).toLocaleDateString() === absentDateStr
            );

            const session = stats.sessions.find((s: any) => s.id === absent.sessionId);

            if (localFilters.dept !== 'All' && session?.department !== localFilters.dept) return null;

            const sessionYear = session?.academicYear || '';
            const filterYear = localFilters.year || 'All';
            const yearMatch = filterYear === 'All' ||
                sessionYear === filterYear ||
                (filterYear === 'First Year' && (sessionYear === 'FE' || sessionYear === '1st')) ||
                (filterYear === 'Second Year' && (sessionYear === 'SE' || sessionYear === '2nd')) ||
                (filterYear === 'Third Year' && (sessionYear === 'TE' || sessionYear === '3rd')) ||
                (filterYear === 'Final Year' && (sessionYear === 'BE' || sessionYear === '4th'));

            if (!yearMatch) return null;
            if (localFilters.div !== 'All' && session?.division !== localFilters.div && session?.division[0] !== localFilters.div) return null;

            const extractTailNum = (str: string) => {
                const match = String(str).match(/\d+$/);
                return match ? parseInt(match[0]) : NaN;
            };

            const student = stats.students?.find((s: any) => s.prn === absent.studentPrn);
            const batch = stats.batchConfigs.find((b: any) => {
                const roll = extractTailNum(student?.rollNo || absent.studentPrn);
                const fromRoll = extractTailNum(b.rbtFrom);
                const toRoll = extractTailNum(b.rbtTo);

                if (isNaN(roll) || isNaN(fromRoll) || isNaN(toRoll)) return false;

                const seq = roll % 1000;
                const fSeq = fromRoll % 1000;
                const tSeq = toRoll % 1000;

                return session && b.department === session.department &&
                    b.class === session.academicYear &&
                    b.division === session.division &&
                    seq >= fSeq && seq <= tSeq;
            });
            const leave = stats.leaveNotes?.find((l: any) =>
                l.studentPrn === absent.studentPrn &&
                l.startDate <= localFilters.date && l.endDate >= localFilters.date
            );

            const auditItem = {
                dept: session?.department || '-',
                year: session?.academicYear || '-',
                div: session?.division || '-',
                batch: batch?.batchName || '-',
                name: student?.fullName || student?.full_name || absent.studentPrn,
                rollNo: student?.rollNo || student?.roll_no || absent.studentPrn,
                prn: absent.studentPrn,
                date: absentDateStr,
                status: callLog ? 'Called' : (leave ? 'Leave Note' : 'Pending'),
                gfmName: callLog?.teacherName || batch?.teacherName || 'Unknown',
                callTime: callLog ? new Date(callLog.createdAt).toLocaleTimeString() : '-',
                reason: callLog?.reason || 'No Call Logged',
                leaveNote: leave ? `${leave.reason}${leave.proof_url ? ' (Proof Uploaded)' : ''}` : '-',
                leaveProofUrl: leave?.proof_url || null,
                leaveAddedAt: leave?.createdAt ? new Date(leave.createdAt).toLocaleTimeString() : undefined,
                isCompliant: !!callLog || !!leave,
                fullDate: absent.createdAt || new Date().toISOString()
            } as AuditItem;

            // Apply GFM Search filter
            if (localFilters.gfmSearch && !auditItem.gfmName.toLowerCase().includes(localFilters.gfmSearch.toLowerCase())) {
                return null;
            }

            return auditItem;
        }).filter(Boolean).sort((a: any, b: any) => new Date(b.fullDate).getTime() - new Date(a.fullDate).getTime());
    };

    const pieData = getPieChartData();
    const auditData: AuditItem[] = getAuditData();

    if (loading) return (
        <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loaderText}>Analyzing Records...</Text>
        </View>
    );

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, reportType === 'attendance' && styles.tabActive]}
                    onPress={() => setReportType('attendance')}
                >
                    <Text style={[styles.tabText, reportType === 'attendance' && styles.tabTextActive]}>Absenteeism Overview</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, reportType === 'gfm-audit' && styles.tabActive]}
                    onPress={() => setReportType('gfm-audit')}
                >
                    <Text style={[styles.tabText, reportType === 'gfm-audit' && styles.tabTextActive]}>GFM Call Audit</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.actionRow}>

                <TouchableOpacity style={[styles.actionButton, { backgroundColor: COLORS.accent }]} onPress={() => setShowFilterModal(true)}>
                    <Ionicons name="filter" size={16} color="white" />
                    <Text style={styles.actionText}>Refine Filters</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionButton, { backgroundColor: COLORS.secondary }]} onPress={async () => {
                    if (reportType === 'attendance') {
                        const csv = generateTodayAttendanceCSV(pieData.map(p => ({
                            division: p.name.replace('Div ', ''),
                            present: 0,
                            absent: p.population,
                            total: 0
                        })));
                        await saveAndShareCSV(csv, 'attendance_report.csv');
                    } else {
                        const csv = generateDetailedGFMReportCSV(auditData);
                        await saveAndShareCSV(csv, `detailed_gfm_report_${localFilters.date}.csv`);
                    }
                }}>
                    <Ionicons name="download" size={16} color="white" />
                    <Text style={styles.actionText}>Download CSV</Text>
                </TouchableOpacity>
            </View>

            {reportType === 'attendance' && (
                <View style={styles.chartCard}>
                    <View style={styles.chartHeader}>
                        <Text style={styles.cardTitle}>Absentees Distribution</Text>
                        <View style={styles.activeFilterBadge}>
                            <Text style={styles.activeFilterText}>
                                {localFilters.div === 'All' ? 'By Division' : `By Batch (${localFilters.div})`}
                            </Text>
                        </View>
                    </View>
                    {pieData.length > 0 ? (
                        <PieChart
                            data={pieData}
                            width={screenWidth > 600 ? 500 : screenWidth - 60}
                            height={220}
                            chartConfig={{
                                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                            }}
                            accessor="population"
                            backgroundColor="transparent"
                            paddingLeft="15"
                            absolute
                        />
                    ) : (
                        <View style={styles.noData}><Text style={styles.noDataText}>No absenteeism data found.</Text></View>
                    )}
                </View>
            )}

            {reportType === 'gfm-audit' && (
                <View style={styles.auditContainer}>
                    <View style={styles.auditHeader}>
                        <Text style={styles.auditTitle}>GFM Compliance Report</Text>
                        <Text style={styles.auditSub}>Attendance records for {localFilters.date}</Text>
                    </View>

                    {auditData.length === 0 ? (
                        <View style={styles.noData}><Text>No records found.</Text></View>
                    ) : (
                        auditData.map((item, index) => (
                            <View key={index} style={[styles.auditRow, !item.isCompliant && styles.auditRowWarning]}>
                                <View style={styles.auditInfo}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={styles.auditPrn}>{item.name}</Text>
                                        <View style={{ flexDirection: 'row', gap: 6 }}>
                                            <Text style={styles.auditRollBadge}>Roll: {item.rollNo}</Text>
                                            <Text style={styles.auditBatchBadge}>{item.batch}</Text>
                                        </View>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                        <Text style={styles.auditDate}>{item.date}</Text>
                                        <View style={styles.vDivider} />
                                        <Text style={styles.auditPrn}>{item.prn}</Text>
                                        <View style={styles.vDivider} />
                                        <Text style={styles.auditGfm}>GFM: {item.gfmName}</Text>
                                    </View>
                                    {item.leaveNote !== '-' && (
                                        <Text style={styles.leaveNoteText}>📝 {item.leaveNote}</Text>
                                    )}
                                </View>
                                <View style={styles.auditStatus}>
                                    <View style={[styles.badge, { backgroundColor: item.status === 'Called' ? '#4CAF50' : (item.status === 'Leave Note' ? COLORS.secondary : '#F44336') }]}>
                                        <Text style={styles.badgeText}>{item.status.toUpperCase()}</Text>
                                    </View>
                                    {item.status === 'Called' && item.callTime !== '-' && (
                                        <View style={styles.timestampRow}>
                                            <Ionicons name="time-outline" size={10} color="#666" />
                                            <Text style={styles.timestampText}>{item.callTime}</Text>
                                        </View>
                                    )}
                                    {item.status === 'Leave Note' && item.leaveAddedAt && (
                                        <View style={styles.timestampRow}>
                                            <Ionicons name="time-outline" size={10} color="#666" />
                                            <Text style={styles.timestampText}>{item.leaveAddedAt}</Text>
                                        </View>
                                    )}
                                    <Text style={styles.auditReason}>{item.reason}</Text>
                                    {item.leaveProofUrl && (
                                        <TouchableOpacity style={styles.viewProofBtn} onPress={() => handleViewDocument(item.leaveProofUrl!)}>
                                            <Ionicons name="eye" size={12} color={COLORS.primary} />
                                            <Text style={styles.viewProofText}>View Proof</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        ))
                    )}
                </View>
            )}

            <Modal visible={showFilterModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Refine View</Text>
                            <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                                <Ionicons name="close" size={24} color={COLORS.text} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalLabel}>View History</Text>
                        {/* Date Picker Logic */}
                        {isWeb ? (
                            <View style={{ flexDirection: 'row', gap: 30, marginBottom: 20 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textLight, marginBottom: 8, textTransform: 'uppercase' }}>Start Date</Text>
                                    <input
                                        type="date"
                                        style={{
                                            backgroundColor: '#f8fafc',
                                            borderRadius: 12,
                                            padding: '0 15px',
                                            height: '54px',
                                            border: '1px solid #E2E8F0',
                                            width: '100%',
                                            fontFamily: 'inherit',
                                            fontSize: '14px',
                                            outline: 'none',
                                            color: '#1E293B',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                        }}
                                        value={localFilters.startDate}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            setLocalFilters({ ...localFilters, startDate: v, date: v });
                                        }}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textLight, marginBottom: 8, textTransform: 'uppercase' }}>End Date</Text>
                                    <input
                                        type="date"
                                        style={{
                                            backgroundColor: '#f8fafc',
                                            borderRadius: 12,
                                            padding: '0 15px',
                                            height: '54px',
                                            border: '1px solid #E2E8F0',
                                            width: '100%',
                                            fontFamily: 'inherit',
                                            fontSize: '14px',
                                            outline: 'none',
                                            color: '#1E293B',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                        }}
                                        value={localFilters.endDate}
                                        onChange={(e) => setLocalFilters({ ...localFilters, endDate: e.target.value })}
                                    />
                                </View>
                            </View>
                        ) : (
                            <>
                                <View style={{ flexDirection: 'row', gap: 30, marginBottom: 20 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textLight, marginBottom: 8, textTransform: 'uppercase' }}>Start Date</Text>
                                        <TouchableOpacity
                                            style={[styles.filterInput, { justifyContent: 'center', height: 54 }]}
                                            onPress={() => setShowStartPicker(true)}
                                        >
                                            <Text style={{ color: localFilters.startDate ? COLORS.text : COLORS.textLight, fontWeight: '600' }}>
                                                {localFilters.startDate || "Select Date"}
                                            </Text>
                                            <Ionicons name="calendar-outline" size={18} color={COLORS.primary} style={{ position: 'absolute', right: 15 }} />
                                        </TouchableOpacity>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textLight, marginBottom: 8, textTransform: 'uppercase' }}>End Date</Text>
                                        <TouchableOpacity
                                            style={[styles.filterInput, { justifyContent: 'center', height: 54 }]}
                                            onPress={() => setShowEndPicker(true)}
                                        >
                                            <Text style={{ color: localFilters.endDate ? COLORS.text : COLORS.textLight, fontWeight: '600' }}>
                                                {localFilters.endDate || "Optional"}
                                            </Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', position: 'absolute', right: 15 }}>
                                                {!!localFilters.endDate && (
                                                    <TouchableOpacity onPress={(e) => { e.stopPropagation(); setLocalFilters({ ...localFilters, endDate: '' }); }}>
                                                        <Ionicons name="close-circle" size={16} color={COLORS.error} style={{ marginRight: 5 }} />
                                                    </TouchableOpacity>
                                                )}
                                                <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
                                            </View>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {showStartPicker && (
                                    <DateTimePicker
                                        value={localFilters.startDate ? new Date(localFilters.startDate) : new Date()}
                                        mode="date"
                                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                        onChange={(event: any, selectedDate?: Date) => {
                                            setShowStartPicker(false);
                                            if (selectedDate) {
                                                const d = selectedDate.toISOString().split('T')[0];
                                                setLocalFilters({ ...localFilters, startDate: d, date: d });
                                            }
                                        }}
                                    />
                                )}

                                {showEndPicker && (
                                    <DateTimePicker
                                        value={localFilters.endDate ? new Date(localFilters.endDate) : new Date()}
                                        mode="date"
                                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                        onChange={(event: any, selectedDate?: Date) => {
                                            setShowEndPicker(false);
                                            if (selectedDate) {
                                                const d = selectedDate.toISOString().split('T')[0];
                                                setLocalFilters({ ...localFilters, endDate: d });
                                            }
                                        }}
                                    />
                                )}
                            </>
                        )}

                        <Text style={[styles.modalLabel, { textTransform: 'uppercase', color: COLORS.primary, letterSpacing: 0.5 }]}>Search GFM</Text>
                        <TextInput
                            style={[styles.filterInput, { marginBottom: 25, height: 54 }]}
                            value={localFilters.gfmSearch}
                            onChangeText={(v) => setLocalFilters({ ...localFilters, gfmSearch: v })}
                            placeholder="Type GFM name..."
                            placeholderTextColor="#94A3B8"
                        />

                        <Text style={[styles.modalLabel, { marginTop: 20 }]}>Academic Year</Text>
                        <View style={styles.chipRow}>
                            {['All', 'First Year', 'Second Year', 'Third Year', 'Final Year'].map(y => (
                                <TouchableOpacity
                                    key={y}
                                    onPress={() => setLocalFilters({ ...localFilters, year: y })}
                                    style={[styles.chip, localFilters.year === y && styles.chipActive]}
                                >
                                    <Text style={[styles.chipText, localFilters.year === y && styles.chipTextActive]}>{y}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.modalLabel}>Division</Text>
                        <View style={styles.chipRow}>
                            {['All', 'A', 'B', 'C'].map(d => (
                                <TouchableOpacity
                                    key={d}
                                    onPress={() => setLocalFilters({ ...localFilters, div: d })}
                                    style={[styles.chip, localFilters.div === d && styles.chipActive]}
                                >
                                    <Text style={[styles.chipText, localFilters.div === d && styles.chipTextActive]}>{d === 'All' ? 'All' : `Div ${d}`}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity style={styles.applyBtn} onPress={() => setShowFilterModal(false)}>
                            <Text style={styles.applyBtnText}>Apply Perspective</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa' },
    scrollContent: { padding: 16, paddingBottom: 50 },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', height: 300 },
    loaderText: { marginTop: 10, color: COLORS.textSecondary },
    tabContainer: { flexDirection: 'row', marginBottom: 20, backgroundColor: 'white', borderRadius: 12, padding: 4, elevation: 2 },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
    tabActive: { backgroundColor: COLORS.primary },
    tabText: { color: COLORS.textSecondary, fontWeight: '600' },
    tabTextActive: { color: 'white', fontWeight: 'bold' },
    actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginBottom: 15, flexWrap: 'wrap' },
    actionButton: { flexDirection: 'row', backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignItems: 'center', gap: 6 },
    actionText: { color: 'white', fontWeight: 'bold', fontSize: 11 },
    chartCard: { backgroundColor: 'white', borderRadius: 16, padding: 16, alignItems: 'center', elevation: 3 },
    chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 15 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
    activeFilterBadge: { backgroundColor: COLORS.primary + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    activeFilterText: { fontSize: 10, color: COLORS.primary, fontWeight: 'bold' },
    noData: { padding: 40, alignItems: 'center' },
    noDataText: { color: COLORS.textLight, fontStyle: 'italic' },
    auditContainer: { backgroundColor: 'white', borderRadius: 16, padding: 16, elevation: 3 },
    auditHeader: { marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10 },
    auditTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
    auditSub: { fontSize: 12, color: COLORS.textLight },
    auditRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', flexDirection: 'row', gap: 10 },
    auditRowWarning: { backgroundColor: '#fff8f8' },
    auditInfo: { flex: 2 },
    auditPrn: { fontSize: 14, fontWeight: 'bold', color: COLORS.text },
    auditBatchBadge: { backgroundColor: '#E3F2FD', color: '#1976D2', fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
    auditDate: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
    auditGfm: { fontSize: 11, color: COLORS.textSecondary },
    vDivider: { width: 1, height: 10, backgroundColor: '#ddd' },
    auditRollBadge: { backgroundColor: COLORS.primary + '10', color: COLORS.primary, fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontWeight: 'bold', overflow: 'hidden' },
    leaveNoteText: { fontSize: 11, color: '#666', marginTop: 4, backgroundColor: '#f5f5f5', padding: 4, borderRadius: 4 },

    auditStatus: { alignItems: 'flex-end', flex: 1 },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginBottom: 4 },
    badgeText: { color: 'white', fontSize: 9, fontWeight: 'bold' },
    auditReason: { fontSize: 10, color: COLORS.textLight, textAlign: 'right' },
    viewProofBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
    viewProofText: { fontSize: 10, color: COLORS.primary, fontWeight: 'bold' },
    timestampRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2, marginBottom: 4 },
    timestampText: { fontSize: 9, color: '#666', fontStyle: 'italic' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold' },
    modalLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textLight, marginBottom: 8 },
    filterInput: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', height: 54 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 25 },
    chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#E2E8F0' },
    chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary, elevation: 3, shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowRadius: 5 },
    chipText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
    chipTextActive: { color: 'white', fontWeight: 'bold' },
    applyBtn: { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    applyBtnText: { color: 'white', fontWeight: 'bold' }
});

export default AdminReportsManagement;
