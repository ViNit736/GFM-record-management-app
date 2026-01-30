import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { COLORS } from '../../constants/colors';
import { getAdminAnalytics } from '../../storage/sqlite';

const isWeb = Platform.OS === 'web';

export const AdminReportsManagement = ({ filters }: any) => {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isLargeScreen = width >= 1024;

    const [reportType, setReportType] = useState('attendance');
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        loadData();
    }, [filters]);

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

    const getAttendanceMetrics = () => {
        if (!stats) return [];

        const relevantBatches = stats.batchConfigs.filter((b: any) =>
            (filters.dept === 'All' || b.department === filters.dept) &&
            (filters.academicYear === 'All' || b.class === filters.academicYear)
        );

        return relevantBatches.map((batch: any) => {
            const mainDiv = batch.division ? batch.division[0].toUpperCase() : '';

            const batchAbsents = stats.absentRecords.filter((r: any) => {
                const rollNo = parseInt(r.studentPrn.slice(-3));
                const fromVal = parseInt(batch.rbtFrom);
                const toVal = parseInt(batch.rbtTo);

                const session = stats.sessions.find((s: any) => s.id === r.sessionId);
                if (!session) return false;

                const matchDept = session.department === batch.department;
                const matchDiv = session.division === mainDiv;

                return matchDept && matchDiv && !isNaN(rollNo) && !isNaN(fromVal) && !isNaN(toVal) && rollNo >= fromVal && rollNo <= toVal;
            });

            return {
                label: `${batch.division} [${batch.rbtFrom}-${batch.rbtTo}]`,
                value: batchAbsents.length,
                mainDiv: mainDiv,
                teacherName: batch.teacherName,
                color: mainDiv === 'A' ? '#4CAF50' : mainDiv === 'B' ? '#2196F3' : '#FFC107'
            };
        });
    };

    const exportCSV = () => {
        if (!stats) return;
        let csv = 'Type,Student PRN,GFM Name,Communication,Reason,Timestamp,Notes,Report/Receipt Link\n';

        if (reportType === 'attendance') {
            (stats.calls || []).forEach((c: any) => {
                csv += `Call,${c.studentPrn},"${c.teacherName || 'GFM'}","${c.communicationType}","${c.reason || ''}",${c.createdAt},"${c.notes || ''}","${c.reportUrl || ''}"\n`;
            });
        }

        if (isWeb) {
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Admin_${reportType}_Report.csv`;
            a.click();
        } else {
            Alert.alert('Export', 'CSV Exported (Simulation)');
        }
    };

    if (loading) return (
        <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loaderText}>Generating Analytics...</Text>
        </View>
    );

    const attendanceMetrics = getAttendanceMetrics();

    const renderMobileHeader = () => (
        <View style={styles.header}>
            <View style={styles.headerContent}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={styles.titleArea}>
                    <Text style={styles.titleText}>Attendance History</Text>
                    <Text style={styles.subtitleText}>{filters.dept} | {filters.academicYear}</Text>
                </View>
                <TouchableOpacity onPress={loadData} style={styles.refreshBtn}>
                    <Ionicons name="refresh" size={20} color="#fff" />
                </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
                <View style={styles.tabsContainer}>
                    {['Attendance', 'GFM Calls', 'System Logs'].map((type) => {
                        const id = type.toLowerCase().replace(' ', '-');
                        const active = reportType === id;
                        return (
                            <TouchableOpacity
                                key={type}
                                onPress={() => setReportType(id)}
                                style={[styles.tab, active && styles.tabActive]}
                            >
                                <Text style={[styles.tabText, active && styles.tabTextActive]}>{type}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </ScrollView>
        </View>
    );

    const renderWebHeader = () => (
        <View style={styles.webHeader}>
            <View>
                <Text style={styles.webTitle}>Administrative Analytics Repository</Text>
                <Text style={styles.webSubtitle}>{filters.dept} • {filters.academicYear} • {new Date().toLocaleDateString()}</Text>
            </View>
            <View style={styles.webControls}>
                <View style={styles.webTabGroup}>
                    {['attendance', 'gfm-calls', 'system-logs'].map((type) => (
                        <TouchableOpacity
                            key={type}
                            onPress={() => setReportType(type)}
                            style={[styles.webTab, reportType === type && styles.webTabActive]}
                        >
                            <Text style={[styles.webTabText, reportType === type && styles.webTabTextActive]}>
                                {type.replace('-', ' ').toUpperCase()}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <TouchableOpacity onPress={loadData} style={styles.webRefreshBtn}>
                    <Ionicons name="refresh" size={18} color={COLORS.primary} />
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderContent = () => {
        if (isWeb) {
            return (
                <View style={[styles.webGrid, isLargeScreen && { flexDirection: 'row', gap: 20 }]}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.webSectionLabel}>PERFORMANCE METRICS</Text>
                        <View style={styles.webMetricGrid}>
                            {attendanceMetrics.map((item: any, index: number) => (
                                <View key={index} style={styles.webMetricCard}>
                                    <View style={styles.webMetricInfo}>
                                        <Text style={styles.webMetricLabel}>{item.label}</Text>
                                        <Text style={[styles.webMetricValue, { color: item.color }]}>{item.value}</Text>
                                    </View>
                                    <View style={styles.progressBg}>
                                        <View style={[styles.progressFill, { backgroundColor: item.color, width: `${Math.min((item.value / 20) * 100, 100)}%` }]} />
                                    </View>
                                    <Text style={styles.webMetricSub}>GFM: {item.teacherName}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    <View style={{ flex: 2 }}>
                        <Text style={styles.webSectionLabel}>DATA REPOSITORY</Text>
                        {reportType === 'gfm-calls' ? (
                            <View style={styles.webTableCard}>
                                <View style={styles.webTableHeader}>
                                    <Text style={[styles.webTableCell, { flex: 1, fontWeight: 'bold' }]}>Date</Text>
                                    <Text style={[styles.webTableCell, { flex: 1, fontWeight: 'bold' }]}>GFM</Text>
                                    <Text style={[styles.webTableCell, { flex: 1, fontWeight: 'bold' }]}>Student PRN</Text>
                                    <Text style={[styles.webTableCell, { flex: 2, fontWeight: 'bold' }]}>Reason</Text>
                                </View>
                                {(stats.calls || []).map((call: any, i: number) => (
                                    <View key={i} style={styles.webTableRow}>
                                        <Text style={[styles.webTableCell, { flex: 1, fontSize: 12 }]}>{new Date(call.createdAt).toLocaleDateString()}</Text>
                                        <Text style={[styles.webTableCell, { flex: 1, fontWeight: 'bold' }]}>{call.teacherName}</Text>
                                        <Text style={[styles.webTableCell, { flex: 1 }]}>{call.studentPrn}</Text>
                                        <Text style={[styles.webTableCell, { flex: 2, fontSize: 12, color: COLORS.textSecondary }]}>{call.reason}</Text>
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <View style={styles.webEmptyState}>
                                <Ionicons name="folder-open-outline" size={48} color={COLORS.textLight} />
                                <Text style={styles.webEmptyText}>Detailed system logs are available via CSV export below.</Text>
                            </View>
                        )}

                        <View style={styles.webExportBox}>
                            <View>
                                <Text style={styles.exportTitle}>System Audit Export</Text>
                                <Text style={styles.exportSub}>Download the full dataset for offline analysis and archival.</Text>
                            </View>
                            <TouchableOpacity onPress={exportCSV} style={styles.exportBtn}>
                                <Ionicons name="download" size={18} color="#fff" />
                                <Text style={styles.exportBtnText}>Generate CSV</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            );
        }

        return (
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {reportType === 'attendance' && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Sub-Division Analysis</Text>
                            <Ionicons name="stats-chart" size={18} color={COLORS.primary} />
                        </View>
                        {attendanceMetrics.map((item: any, index: number) => (
                            <View key={index} style={styles.metricCard}>
                                <View style={styles.metricInfo}>
                                    <View>
                                        <Text style={styles.metricLabel}>{item.label}</Text>
                                        <Text style={styles.metricSub}>GFM: {item.teacherName}</Text>
                                    </View>
                                    <Text style={[styles.metricValue, { color: item.color }]}>{item.value} Absentees</Text>
                                </View>
                                <View style={styles.progressBg}>
                                    <View style={[styles.progressFill, { backgroundColor: item.color, width: `${Math.min((item.value / 20) * 100, 100)}%` }]} />
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {reportType === 'gfm-calls' && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Communication Logs</Text>
                            <Ionicons name="call" size={18} color={COLORS.primary} />
                        </View>
                        {(stats.calls || []).map((call: any, i: number) => (
                            <View key={i} style={styles.callCard}>
                                <View style={styles.callHeader}>
                                    <View style={styles.callGfmBadge}>
                                        <Text style={styles.callGfmText}>{call.teacherName}</Text>
                                    </View>
                                    <Text style={styles.callTime}>
                                        {new Date(call.createdAt).toLocaleDateString()}
                                    </Text>
                                </View>
                                <View style={styles.callBody}>
                                    <View style={styles.callStudent}>
                                        <Text style={styles.callPrn}>PRN: {call.studentPrn}</Text>
                                        <Text style={styles.callReason}>{call.reason}</Text>
                                    </View>
                                    <Ionicons name="chatbox-ellipses-outline" size={24} color={COLORS.primary} />
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                <View style={styles.exportSection}>
                    <Text style={styles.exportTitle}>Download Data</Text>
                    <Text style={styles.exportSub}>Export filtered logs as a CSV file for offline reporting.</Text>
                    <TouchableOpacity onPress={exportCSV} style={styles.exportBtn}>
                        <Ionicons name="download" size={20} color="#fff" />
                        <Text style={styles.exportBtnText}>Export detailed CSV</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        );
    };

    return (
        <View style={styles.container}>
            {isWeb ? renderWebHeader() : renderMobileHeader()}
            {renderContent()}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FAFBFF' },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loaderText: { marginTop: 15, color: COLORS.textLight },

    // Mobile Header
    header: {
        backgroundColor: COLORS.primary,
        paddingTop: 50,
        paddingBottom: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        elevation: 8,
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
    refreshBtn: { padding: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12 },

    tabsScroll: { paddingHorizontal: 20 },
    tabsContainer: { flexDirection: 'row', gap: 12 },
    tab: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 15,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    tabActive: { backgroundColor: '#fff' },
    tabText: { color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
    tabTextActive: { color: COLORS.primary },

    // Web Header
    webHeader: {
        backgroundColor: '#fff',
        padding: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#EDF0F5',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    webTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
    webSubtitle: { fontSize: 13, color: COLORS.textLight, marginTop: 4 },
    webControls: { flexDirection: 'row', gap: 20, alignItems: 'center' },
    webTabGroup: { flexDirection: 'row', backgroundColor: '#F0F2F5', padding: 4, borderRadius: 12 },
    webTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
    webTabActive: { backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
    webTabText: { fontSize: 11, fontWeight: '700', color: COLORS.textLight },
    webTabTextActive: { color: COLORS.primary },
    webRefreshBtn: { padding: 8, borderRadius: 10, borderWidth: 1, borderColor: COLORS.primary + '30' },

    // Web Content
    webGrid: { padding: 24, flex: 1 },
    webSectionLabel: { fontSize: 11, fontWeight: '900', color: COLORS.textLight, letterSpacing: 1.5, marginBottom: 20 },
    webMetricGrid: { gap: 15 },
    webMetricCard: { backgroundColor: '#fff', padding: 20, borderRadius: 16, elevation: 2, borderWeight: 1, borderColor: '#EDF0F5' },
    webMetricInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    webMetricLabel: { fontSize: 15, fontWeight: 'bold', color: COLORS.text },
    webMetricValue: { fontSize: 18, fontWeight: '900' },
    webMetricSub: { fontSize: 11, color: COLORS.textLight, marginTop: 12 },
    webTableCard: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', elevation: 2, borderWidth: 1, borderColor: '#EDF0F5' },
    webTableHeader: { flexDirection: 'row', backgroundColor: '#F9FAFB', padding: 15, borderBottomWidth: 1, borderBottomColor: '#EDF0F5' },
    webTableRow: { flexDirection: 'row', padding: 15, borderBottomWidth: 1, borderBottomColor: '#F0F2F5', alignItems: 'center' },
    webTableCell: { paddingHorizontal: 10 },
    webEmptyState: { height: 300, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, borderStyle: 'dashed', borderWidth: 2, borderColor: '#EDF0F5' },
    webEmptyText: { color: COLORS.textLight, marginTop: 15, fontSize: 13 },
    webExportBox: { marginTop: 20, backgroundColor: COLORS.primary + '03', padding: 20, borderRadius: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.primary + '20' },

    scrollContent: { padding: 20 },

    section: { marginBottom: 25 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },

    metricCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 15,
        elevation: 2,
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 1,
        shadowRadius: 3,
    },
    metricInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    metricLabel: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
    metricSub: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
    metricValue: { fontSize: 14, fontWeight: 'bold' },
    progressBg: { height: 8, backgroundColor: '#F0F2F5', borderRadius: 4, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 4 },

    callCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 15,
        elevation: 2,
    },
    callHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    callGfmBadge: { backgroundColor: COLORS.primary + '10', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    callGfmText: { color: COLORS.primary, fontWeight: 'bold', fontSize: 12 },
    callTime: { fontSize: 11, color: COLORS.textLight },
    callBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    callStudent: { flex: 1 },
    callPrn: { fontSize: 15, fontWeight: 'bold', color: COLORS.text, marginBottom: 4 },
    callReason: { fontSize: 13, color: COLORS.textSecondary },

    exportSection: {
        backgroundColor: COLORS.white,
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#EDF0F5',
        marginTop: 10,
    },
    exportTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: 8 },
    exportSub: { fontSize: 13, color: COLORS.textLight, textAlign: 'center', marginBottom: 20 },
    exportBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: COLORS.success,
        paddingHorizontal: 25,
        paddingVertical: 12,
        borderRadius: 12,
    },
    exportBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});
