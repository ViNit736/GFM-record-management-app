import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { COLORS } from '../../constants/colors';
import { YEAR_MAPPINGS } from '../../constants/Mappings';
import { supabase } from '../../services/supabase';
import { toCamelCase } from '../../storage/sqlite';

const YEARS = ['First Year', 'Second Year', 'Third Year', 'Final Year'];
const DIVISIONS = ['A', 'B', 'C'];
const isWeb = Platform.OS === 'web';

interface TrackingData {
    sessions: any[];
    batchConfigs: any[];
    absentRecords: any[];
}

export const DailyAttendanceTracking = () => {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isLargeScreen = width >= 1024;

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<TrackingData | null>(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedYear, setSelectedYear] = useState<string | null>(null);
    const [selectedDiv, setSelectedDiv] = useState<string | null>(null);
    const [historyType, setHistoryType] = useState<'daily' | 'weekly' | 'monthly'>('daily');
    const [showFilters, setShowFilters] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false); // Added state for date picker
    const [selectedSessionForDetails, setSelectedSessionForDetails] = useState<any>(null);

    useEffect(() => {
        loadData();
    }, [selectedDate, historyType]);

    const loadData = async () => {
        setLoading(true);
        try {
            let startDate = selectedDate;
            let endDate = selectedDate;

            if (historyType === 'weekly') {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() - 7);
                startDate = d.toISOString().split('T')[0];
            } else if (historyType === 'monthly') {
                const d = new Date(selectedDate);
                d.setMonth(d.getMonth() - 1);
                startDate = d.toISOString().split('T')[0];
            }

            const { data: sessions, error: sessionError } = await supabase
                .from('attendance_sessions')
                .select(`*, profiles:teacher_id (full_name)`)
                .gte('date', startDate)
                .lte('date', endDate);

            if (sessionError) throw sessionError;

            const { data: batchConfigs, error: batchError } = await supabase
                .from('teacher_batch_configs')
                .select(`*, profiles:teacher_id (full_name)`);

            if (batchError) throw batchError;

            const sessionIds = sessions.map(s => s.id);
            let absentRecords: any[] = [];
            if (sessionIds.length > 0) {
                const { data: absents, error: absentError } = await supabase
                    .from('attendance_records')
                    .select('id, student_prn, session_id, status, students:student_prn(full_name)')
                    .eq('status', 'Absent')
                    .in('session_id', sessionIds);

                if (absentError) {
                    console.error('❌ [Tracking] Error fetching absent records:', absentError);
                    absentRecords = [];
                } else {
                    absentRecords = absents || [];
                }
            }

            setData({
                sessions: sessions.map((s: any) => ({ ...toCamelCase(s), teacherName: (s as any).profiles?.full_name })),
                batchConfigs: batchConfigs.map((b: any) => ({ ...toCamelCase(b), teacherName: (b as any).profiles?.full_name })),
                absentRecords: absentRecords.map((r: any) => ({
                    ...toCamelCase(r),
                    studentName: (r as any).students?.full_name || 'Unknown'
                }))
            });

        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to load tracking data');
        } finally {
            setLoading(false);
        }
    };

    const getDefaulters = () => {
        if (!data || historyType === 'daily') return [];
        const { absentRecords } = data;
        const counts: Record<string, number> = {};
        absentRecords.forEach((r: any) => {
            counts[r.studentPrn] = (counts[r.studentPrn] || 0) + 1;
        });

        return Object.entries(counts)
            .filter(([_, count]) => count >= 3)
            .sort((a, b) => b[1] - a[1]);
    };

    if (loading || !data) return (
        <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loaderText}>Syncing Real-time Data...</Text>
        </View>
    );

    const defaulters = getDefaulters();
    const { sessions, batchConfigs, absentRecords } = data;

    let filteredBatches = batchConfigs;
    let filteredSessions = sessions;

    if (selectedYear) {
        const shortYear = (Object.entries(YEAR_MAPPINGS).find(([_, v]) => v === selectedYear)?.[0]) || selectedYear;
        filteredBatches = filteredBatches.filter((b: any) => b.class === selectedYear || b.class === shortYear);
        filteredSessions = filteredSessions.filter((s: any) => s.academicYear === selectedYear || s.academicYear === shortYear);
    }

    if (selectedDiv) {
        filteredBatches = filteredBatches.filter((b: any) => b.division === selectedDiv || (b.division && b.division[0] === selectedDiv));
        filteredSessions = filteredSessions.filter((s: any) => s.division === selectedDiv || (s.division && s.division[0] === selectedDiv));
    }

    const completedBatchIds = new Set(filteredSessions.map((s: any) => s.batchConfigId));
    const pendingBatches = filteredBatches.filter((b: any) => !completedBatchIds.has(b.id));

    const renderMobileHeader = () => (
        <View style={styles.header}>
            <View style={styles.headerContent}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={styles.titleArea}>
                    <Text style={styles.titleText}>Attendance Radar</Text>
                    <Text style={styles.subtitleText}>
                        {historyType === 'daily' ? new Date(selectedDate).toDateString() : `${historyType.charAt(0).toUpperCase() + historyType.slice(1)} Analytics`}
                    </Text>
                </View>
                <TouchableOpacity onPress={() => setShowFilters(true)} style={styles.filterToggle}>
                    <Ionicons name="funnel-outline" size={20} color="#fff" />
                    {!!(selectedYear || selectedDiv) && <View style={styles.filterDot} />}
                </TouchableOpacity>
            </View>

            <View style={styles.perspectiveTabs}>
                {(['daily', 'weekly', 'monthly'] as const).map((type) => (
                    <TouchableOpacity
                        key={type}
                        onPress={() => setHistoryType(type)}
                        style={[styles.perspectiveBtn, historyType === type && styles.perspectiveBtnActive]}
                    >
                        <Text style={[styles.perspectiveText, historyType === type && styles.perspectiveTextActive]}>
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    const renderWebHeader = () => (
        <View style={styles.webHeader}>
            <View>
                <Text style={styles.webTitle}>Attendance Monitoring Terminal</Text>
                <Text style={styles.webSubtitle}>Real-time synchronization across all departments</Text>
            </View>
            <View style={styles.webControls}>
                <View style={styles.webTabGroup}>
                    {(['daily', 'weekly', 'monthly'] as const).map((type) => (
                        <TouchableOpacity
                            key={type}
                            onPress={() => setHistoryType(type)}
                            style={[styles.webTab, historyType === type && styles.webTabActive]}
                        >
                            <Text style={[styles.webTabText, historyType === type && styles.webTabTextActive]}>
                                {type.toUpperCase()}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <TouchableOpacity onPress={() => setShowFilters(true)} style={styles.webFilterBtn}>
                    <Ionicons name="filter" size={18} color={COLORS.primary} />
                    <Text style={styles.webFilterText}>Refine Results</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderList = () => {
        if (isWeb) {
            return (
                <View style={[styles.webGrid, isLargeScreen && { flexDirection: 'row', gap: 20 }]}>
                    <View style={{ flex: 1.5 }}>
                        <Text style={styles.webSectionLabel}>OVERVIEW & RADAR</Text>

                        <View style={styles.insightGrid}>
                            <View style={[styles.insightCard, { borderLeftColor: COLORS.success }]}>
                                <Text style={styles.insightValue}>{filteredSessions.length}</Text>
                                <Text style={styles.insightLabel}>Reports Filed</Text>
                            </View>
                            <View style={[styles.insightCard, { borderLeftColor: COLORS.warning }]}>
                                <Text style={styles.insightValue}>{pendingBatches.length}</Text>
                                <Text style={styles.insightLabel}>Missing Reports</Text>
                            </View>
                            <View style={[styles.insightCard, { borderLeftColor: COLORS.error }]}>
                                <Text style={styles.insightValue}>{absentRecords.length}</Text>
                                <Text style={styles.insightLabel}>Total Absentees</Text>
                            </View>
                        </View>

                        {defaulters.length > 0 ? (
                            <View style={styles.webRadarBox}>
                                <Text style={styles.webRadarTitle}>System-wide Defaulter Flagging</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    {defaulters.map(([prn, count]) => (
                                        <View key={prn} style={styles.radarCard}>
                                            <View style={styles.radarCircle}>
                                                <Text style={styles.radarCount}>{count}</Text>
                                                <Text style={styles.radarLabel}>days</Text>
                                            </View>
                                            <View style={styles.radarInfo}>
                                                <Text style={styles.radarPrn}>PRN: {prn.slice(-4)}</Text>
                                                <TouchableOpacity style={styles.traceBtn}>
                                                    <Text style={styles.traceBtnText}>Review Profile</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))}
                                </ScrollView>
                            </View>
                        ) : null}

                        <Text style={styles.webSectionLabel}>DETAILED LOGS</Text>
                        <View style={styles.webTableCard}>
                            <View style={styles.webTableHeader}>
                                <Text style={[styles.webTableCell, { flex: 1, fontWeight: 'bold' }]}>Date</Text>
                                <Text style={[styles.webTableCell, { flex: 1.5, fontWeight: 'bold' }]}>Batch/Class</Text>
                                <Text style={[styles.webTableCell, { flex: 1, fontWeight: 'bold' }]}>Status</Text>
                                <Text style={[styles.webTableCell, { flex: 1.5, fontWeight: 'bold' }]}>GFM/Teacher</Text>
                                <Text style={[styles.webTableCell, { flex: 1, fontWeight: 'bold' }]}>Absentees</Text>
                            </View>
                            {pendingBatches.map((b: any) => (
                                <View key={b.id} style={styles.webTableRow}>
                                    <Text style={[styles.webTableCell, { flex: 1, fontSize: 12 }]}>{selectedDate}</Text>
                                    <View style={[styles.webTableCell, { flex: 1.5 }]}>
                                        <Text style={{ fontWeight: 'bold' }}>{b.class} {b.division}</Text>
                                        <Text style={{ fontSize: 11, color: COLORS.textLight }}>Batch {b.batchName || 'ALL'}</Text>
                                    </View>
                                    <View style={[styles.webTableCell, { flex: 1 }]}>
                                        <View style={{ backgroundColor: COLORS.error + '15', padding: 4, borderRadius: 4, alignSelf: 'flex-start' }}>
                                            <Text style={{ fontSize: 10, color: COLORS.error, fontWeight: 'bold' }}>PENDING</Text>
                                        </View>
                                    </View>
                                    <Text style={[styles.webTableCell, { flex: 1.5, fontSize: 12 }]}>{b.teacherName}</Text>
                                    <Text style={[styles.webTableCell, { flex: 1, color: COLORS.textLight, fontSize: 11 }]}>Not Taken</Text>
                                </View>
                            ))}
                            {filteredSessions.map((s: any) => {
                                const absents = absentRecords.filter((r: any) => r.sessionId === s.id);
                                return (
                                    <View key={s.id} style={{ borderBottomWidth: 1, borderBottomColor: '#F0F2F5' }}>
                                        <View style={styles.webTableRow}>
                                            <Text style={[styles.webTableCell, { flex: 1, fontSize: 12 }]}>{s.date}</Text>
                                            <View style={[styles.webTableCell, { flex: 1.5 }]}>
                                                <Text style={{ fontWeight: 'bold' }}>{s.academicYear} {s.division}</Text>
                                                <Text style={{ fontSize: 11, color: COLORS.textLight }}>Batch {s.batch || 'ALL'}</Text>
                                            </View>
                                            <View style={[styles.webTableCell, { flex: 1 }]}>
                                                <View style={{ backgroundColor: COLORS.success + '20', padding: 4, borderRadius: 4, alignSelf: 'flex-start' }}>
                                                    <Text style={{ fontSize: 10, color: COLORS.success, fontWeight: 'bold' }}>FILED</Text>
                                                </View>
                                            </View>
                                            <Text style={[styles.webTableCell, { flex: 1.5, fontSize: 12 }]}>{s.teacherName}</Text>
                                            <View style={[styles.webTableCell, { flex: 1 }]}>
                                                <Text style={{ fontWeight: 'bold', color: COLORS.error }}>
                                                    {absents.length}
                                                </Text>
                                            </View>
                                        </View>
                                        {absents.length > 0 ? (
                                            <View style={{ padding: 15, paddingTop: 0, paddingLeft: 60 }}>
                                                <Text style={{ fontSize: 11, color: COLORS.textLight, marginBottom: 5 }}>Absentees:</Text>
                                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                                    {absents.map((r: any, idx: number) => (
                                                        <View key={idx} style={{ backgroundColor: COLORS.error + '10', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                                            <Text style={{ fontSize: 10, color: COLORS.error, fontWeight: '600' }}>{r.studentName}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            </View>
                                        ) : null}
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                </View>
            );
        }

        return (
            <>
                {defaulters.length > 0 ? (
                    <View style={styles.radarSection}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="warning" size={20} color={COLORS.error} />
                            <Text style={styles.sectionTitle}>High Priority Defaulters</Text>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.radarScroll}>
                            {defaulters.map(([prn, count]) => (
                                <View key={prn} style={styles.radarCard}>
                                    <View style={styles.radarCircle}>
                                        <Text style={styles.radarCount}>{count}</Text>
                                        <Text style={styles.radarLabel}>days</Text>
                                    </View>
                                    <View style={styles.radarInfo}>
                                        <Text style={styles.radarPrn}>PRN: {prn.slice(-4)}</Text>
                                        <TouchableOpacity style={styles.traceBtn}>
                                            <Text style={styles.traceBtnText}>Trace</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                ) : null}

                <View style={styles.insightGrid}>
                    <View style={[styles.insightCard, { borderLeftColor: COLORS.success }]}>
                        <Text style={styles.insightValue}>{filteredSessions.length}</Text>
                        <Text style={styles.insightLabel}>Reports Filed</Text>
                    </View>
                    <View style={[styles.insightCard, { borderLeftColor: COLORS.warning }]}>
                        <Text style={styles.insightValue}>{pendingBatches.length}</Text>
                        <Text style={styles.insightLabel}>Missing Reports</Text>
                    </View>
                </View>

                <View style={styles.listSection}>
                    <Text style={styles.listSectionTitle}>Operational Status</Text>
                    {pendingBatches.map((b: any) => (
                        <View key={b.id} style={styles.premiumCard}>
                            <View style={[styles.cardTag, { backgroundColor: COLORS.error }]} />
                            <View style={styles.cardContent}>
                                <View style={styles.cardHeader}>
                                    <View>
                                        <Text style={styles.cardTitle}>{b.class} - {b.division}</Text>
                                        <Text style={{ fontSize: 10, color: COLORS.textLight }}>{selectedDate}</Text>
                                    </View>
                                    <View style={[styles.statusBadge, { backgroundColor: COLORS.error + '15' }]}>
                                        <Text style={[styles.statusText, { color: COLORS.error }]}>PENDING</Text>
                                    </View>
                                </View>
                                <Text style={styles.cardGfm}>GFM: {b.teacherName}</Text>

                                <View style={{ marginVertical: 8, padding: 8, backgroundColor: COLORS.error + '05', borderRadius: 8 }}>
                                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: COLORS.error }}>Absentees: Not Taken</Text>
                                    <Text style={{ fontSize: 10, color: COLORS.textLight }}>Attendance not yet filed by GFM</Text>
                                </View>

                                <View style={styles.cardFooter}>
                                    <View style={styles.batchLabel}>
                                        <Text style={styles.batchLabelText}>Batch {b.batchName || 'ALL'}</Text>
                                    </View>
                                    <View style={styles.rollInfo}>
                                        <Ionicons name="people-outline" size={14} color={COLORS.textLight} />
                                        <Text style={styles.cardRange}>Roll {b.rbtFrom} - {b.rbtTo}</Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    ))}

                    {filteredSessions.map((s: any) => {
                        const absents = absentRecords.filter((r: any) => r.sessionId === s.id);
                        return (
                            <View key={s.id} style={styles.premiumCard}>
                                <View style={[styles.cardTag, { backgroundColor: COLORS.success }]} />
                                <View style={[styles.cardContent, { paddingBottom: 10 }]}>
                                    <View style={styles.cardHeader}>
                                        <View>
                                            <Text style={styles.cardTitle}>{s.academicYear} - {s.division}</Text>
                                            <Text style={{ fontSize: 10, color: COLORS.textLight }}>{s.date}</Text>
                                        </View>
                                        <View style={[styles.statusBadge, { backgroundColor: COLORS.success + '15' }]}>
                                            <Text style={[styles.statusText, { color: COLORS.success }]}>FILED</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.cardGfm}>Taken by: {s.teacherName}</Text>

                                    {absents.length > 0 ? (
                                        <View style={{ marginVertical: 8, padding: 8, backgroundColor: COLORS.error + '05', borderRadius: 8 }}>
                                            <Text style={{ fontSize: 11, fontWeight: 'bold', color: COLORS.error, marginBottom: 4 }}>Absentees ({absents.length})</Text>
                                            <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>
                                                {absents.map(r => r.studentName).join(', ')}
                                            </Text>
                                        </View>
                                    ) : null}

                                    <View style={styles.cardFooter}>
                                        <View style={styles.batchLabel}>
                                            <Text style={styles.batchLabelText}>Batch {s.batch || 'ALL'}</Text>
                                        </View>
                                        <View style={styles.timeInfo}>
                                            <Ionicons name="time-outline" size={14} color={COLORS.textLight} />
                                            <Text style={styles.cardRange}>
                                                {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </View>
            </>
        )
    };

    return (
        <View style={styles.mainContainer}>
            {isWeb ? renderWebHeader() : renderMobileHeader()}

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {renderList()}
                <View style={{ height: 100 }} />
            </ScrollView>

            <Modal visible={showFilters} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Refine View</Text>
                            <TouchableOpacity onPress={() => setShowFilters(false)}>
                                <Ionicons name="close" size={24} color={COLORS.text} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalLabel}>Monitoring Date</Text>
                        <View style={{ marginBottom: 20 }}>
                            {isWeb ? (
                                <View>
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textLight, marginBottom: 8, textTransform: 'uppercase' }}>Jump to Date</Text>
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
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
                                    />
                                </View>
                            ) : (
                                <>
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textLight, marginBottom: 8, textTransform: 'uppercase' }}>Select Target Date</Text>
                                    <TouchableOpacity
                                        style={{
                                            backgroundColor: '#f8fafc',
                                            borderRadius: 12,
                                            height: 54,
                                            paddingHorizontal: 15,
                                            borderWidth: 1,
                                            borderColor: '#E2E8F0',
                                            flexDirection: 'row',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            shadowColor: "#000",
                                            shadowOffset: { width: 0, height: 2 },
                                            shadowOpacity: 0.02,
                                            shadowRadius: 4,
                                            elevation: 2
                                        }}
                                        onPress={() => setShowDatePicker(true)}
                                    >
                                        <Text style={{ color: COLORS.text, fontWeight: '600' }}>{selectedDate}</Text>
                                        <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
                                    </TouchableOpacity>
                                    {showDatePicker && (
                                        <DateTimePicker
                                            value={new Date(selectedDate)}
                                            mode="date"
                                            display="default"
                                            onChange={(event: any, date?: Date) => {
                                                setShowDatePicker(false);
                                                if (date) {
                                                    setSelectedDate(date.toISOString().split('T')[0]);
                                                }
                                            }}
                                        />
                                    )}
                                </>
                            )}
                        </View>

                        <Text style={styles.modalLabel}>Academic Year</Text>
                        <View style={styles.chipRow}>
                            {YEARS.map(y => (
                                <TouchableOpacity
                                    key={y}
                                    onPress={() => setSelectedYear(selectedYear === y ? null : y)}
                                    style={[styles.chip, selectedYear === y && styles.chipActive]}
                                >
                                    <Text style={[styles.chipText, selectedYear === y && styles.chipTextActive]}>{y}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.modalLabel}>Division</Text>
                        <View style={styles.chipRow}>
                            {DIVISIONS.map(d => (
                                <TouchableOpacity
                                    key={d}
                                    onPress={() => setSelectedDiv(selectedDiv === d ? null : d)}
                                    style={[styles.chip, selectedDiv === d && styles.chipActive]}
                                >
                                    <Text style={[styles.chipText, selectedDiv === d && styles.chipTextActive]}>Div {d}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity
                            style={styles.applyBtn}
                            onPress={() => setShowFilters(false)}
                        >
                            <Text style={styles.applyBtnText}>Apply Perspective</Text>
                        </TouchableOpacity>

                        {(selectedYear || selectedDiv) && (
                            <TouchableOpacity
                                style={styles.clearBtn}
                                onPress={() => { setSelectedYear(null); setSelectedDiv(null); }}
                            >
                                <Text style={styles.clearBtnText}>Reset All</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>

            <Modal visible={!!selectedSessionForDetails} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxHeight: '80%' }]}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Absentees List</Text>
                                <Text style={styles.modalSub}>
                                    {selectedSessionForDetails?.academicYear} {selectedSessionForDetails?.division} - {selectedSessionForDetails?.batch || 'ALL'}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setSelectedSessionForDetails(null)}>
                                <Ionicons name="close" size={24} color={COLORS.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ marginTop: 10 }}>
                            {absentRecords
                                .filter((r: any) => r.sessionId === selectedSessionForDetails?.id)
                                .map((r: any, idx: number) => (
                                    <View key={idx} style={styles.absenteeRow}>
                                        <View style={styles.absenteeIdx}>
                                            <Text style={styles.absenteeIdxText}>{idx + 1}</Text>
                                        </View>
                                        <View style={styles.absenteeInfo}>
                                            <Text style={styles.absenteeName}>{r.studentName}</Text>
                                            <Text style={styles.absenteePrn}>PRN: {r.studentPrn}</Text>
                                        </View>
                                    </View>
                                ))}
                            {absentRecords.filter((r: any) => r.sessionId === selectedSessionForDetails?.id).length === 0 && (
                                <Text style={styles.noAbsentsText}>No absentees for this session.</Text>
                            )}
                        </ScrollView>

                        <TouchableOpacity
                            style={[styles.applyBtn, { marginTop: 20 }]}
                            onPress={() => setSelectedSessionForDetails(null)}
                        >
                            <Text style={styles.applyBtnText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    mainContainer: { flex: 1, backgroundColor: '#FAFBFF' },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loaderText: { marginTop: 15, color: COLORS.textLight, fontSize: 13 },

    header: {
        backgroundColor: COLORS.primary,
        paddingTop: 50,
        paddingBottom: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        elevation: 10,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12 },
    titleArea: { flex: 1, marginLeft: 15 },
    titleText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    subtitleText: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
    filterToggle: { padding: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12 },
    filterDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accent, borderWidth: 2, borderColor: COLORS.primary },

    perspectiveTabs: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        gap: 10,
    },
    perspectiveBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
    },
    perspectiveBtnActive: {
        backgroundColor: '#fff',
    },
    perspectiveText: { color: 'rgba(255,255,255,0.6)', fontWeight: '600', fontSize: 13 },
    perspectiveTextActive: { color: COLORS.primary },

    webHeader: {
        backgroundColor: '#fff',
        padding: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#EDF0F5',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    webTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
    webSubtitle: { fontSize: 14, color: COLORS.textLight, marginTop: 4 },
    webControls: { flexDirection: 'row', gap: 25, alignItems: 'center' },
    webTabGroup: { flexDirection: 'row', backgroundColor: '#F0F2F5', padding: 4, borderRadius: 12 },
    webTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
    webTabActive: { backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
    webTabText: { fontSize: 11, fontWeight: '700', color: COLORS.textLight },
    webTabTextActive: { color: COLORS.primary },
    webFilterBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: COLORS.primary + '30' },
    webFilterText: { fontSize: 13, fontWeight: 'bold', color: COLORS.primary },
    webGrid: { marginTop: 10, width: '100%' },
    webSectionLabel: { fontSize: 11, fontWeight: '900', color: COLORS.textLight, letterSpacing: 1.5, marginBottom: 15, marginTop: 10 },
    webRadarBox: { backgroundColor: COLORS.primary + '05', padding: 20, borderRadius: 20, marginBottom: 25, borderStyle: 'dashed', borderWidth: 1, borderColor: COLORS.primary + '20' },
    webRadarTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.primary, marginBottom: 15 },
    webTableCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#EDF0F5', overflow: 'hidden', elevation: 2 },
    webTableHeader: { flexDirection: 'row', backgroundColor: '#F9FAFB', padding: 15, borderBottomWidth: 1, borderBottomColor: '#EDF0F5' },
    webTableRow: { flexDirection: 'row', padding: 15, borderBottomWidth: 1, borderBottomColor: '#F0F2F5', alignItems: 'center' },
    webTableCell: { paddingHorizontal: 10 },

    scrollContent: { padding: 20 },

    radarSection: { marginBottom: 25 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 15 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
    radarScroll: { marginLeft: -5 },
    radarCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 15,
        marginHorizontal: 5,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 3,
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 5,
    },
    radarCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.error + '10',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.error + '30',
        marginRight: 12,
    },
    radarCount: { fontSize: 16, fontWeight: 'bold', color: COLORS.error },
    radarLabel: { fontSize: 8, color: COLORS.error, marginTop: -2 },
    radarInfo: { alignItems: 'flex-start' },
    radarPrn: { fontSize: 12, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
    traceBtn: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 6,
    },
    traceBtnText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

    insightGrid: { flexDirection: 'row', gap: 15, marginBottom: 25 },
    insightCard: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 15,
        borderLeftWidth: 4,
        elevation: 2,
    },
    insightValue: { fontSize: 22, fontWeight: 'bold', color: COLORS.text },
    insightLabel: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },

    listSection: {},
    listSectionTitle: { fontSize: 15, fontWeight: 'bold', color: COLORS.textSecondary, marginBottom: 15 },
    premiumCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 15,
        flexDirection: 'row',
        elevation: 2,
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 1,
        shadowRadius: 3,
        overflow: 'hidden',
    },
    cardTag: {
        width: 6,
        height: '100%',
    },
    cardContent: { flex: 1, padding: 15 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    statusText: { fontSize: 10, fontWeight: 'bold' },
    cardGfm: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 12 },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    batchLabel: { backgroundColor: '#F0F2FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    batchLabelText: { fontSize: 10, fontWeight: 'bold', color: COLORS.primary },
    rollInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    timeInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    absentIndicator: { fontSize: 12, fontWeight: 'bold', color: COLORS.error },
    absentIndicatorContainer: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.error + '10', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    cardRange: { fontSize: 12, color: COLORS.textLight },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 25,
        paddingBottom: 40,
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
    modalLabel: { fontSize: 13, fontWeight: 'bold', color: COLORS.textLight, marginBottom: 15 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 25 },
    chip: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F5F6FA', borderWidth: 1, borderColor: '#EDF0F5' },
    chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    chipText: { fontSize: 13, color: COLORS.text, fontWeight: '600' },
    chipTextActive: { color: '#fff' },
    applyBtn: { backgroundColor: COLORS.primary, paddingVertical: 15, borderRadius: 15, alignItems: 'center', marginBottom: 12 },
    applyBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    clearBtn: { paddingVertical: 10, alignItems: 'center' },
    clearBtnText: { color: COLORS.error, fontSize: 14, fontWeight: '600' },
    modalSub: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
    absenteeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F2F5' },
    absenteeIdx: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.error + '15', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    absenteeIdxText: { fontSize: 12, fontWeight: 'bold', color: COLORS.error },
    absenteeInfo: { flex: 1 },
    absenteeName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
    absenteePrn: { fontSize: 12, color: COLORS.textLight },
    noAbsentsText: { textAlign: 'center', color: COLORS.textLight, marginTop: 20, fontStyle: 'italic' }
});
